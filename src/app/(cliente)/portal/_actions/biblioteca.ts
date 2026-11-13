"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { BUCKET_DA_MARCA } from "@/lib/dados/biblioteca-de-marca";
import { ehLinkDeFora } from "@/lib/dominio/biblioteca-de-marca";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O ACERVO DE MARCA — as pastas e os arquivos que a gestão monta no portal de
 * cada conta (migration 0139).
 *
 * ---------------------------------------------------------------------------
 * **QUEM PODE: `is_gestor()`, e é a frase do usuário palavra por palavra** —
 * *"quero que desenvolvedores e sócios, possam mexer e criar pastas novas no
 * portal do cliente"*.
 *
 * **E ISSO DESFAZ UMA BORDA DA 0133.** Aquela migration levou o Portal do
 * Cliente para `EQUIPE` e escreveu, sobre o *"edição limitada a atendimento, e
 * Sócios"* do pedido de então, que a frase não tinha referente — *"dentro de
 * `/portal/{slug}` ninguém edita nada hoje, para perfil nenhum"* — deixando a
 * borda: *"no dia em que a tela ganhar uma ação, ela nasce `is_atendimento()`,
 * e aí é migration própria"*. É a migration própria, e o perfil é outro porque
 * este pedido nomeia quem pode. Fica como reversão declarada e não como troca
 * silenciosa.
 *
 * **A guarda daqui não acrescenta trava nenhuma**, e vale dizer: quem recusa
 * são as policies da 0139 e as do bucket. Ela existe para escrever a frase em
 * português antes de a pessoa levar um "nenhuma linha voltou" — o modo de
 * falha que a convenção do projeto proíbe.
 *
 * ---------------------------------------------------------------------------
 * **O CLIENTE NÃO ESCREVE NADA**, e a ausência é a regra do Portal: não há
 * ação dele em nenhuma destas seis. É a mesma linha da aba "Quem tem acesso",
 * que não tem botão nenhum — *"quem entra e quem sai é decisão da agência"*.
 * ---------------------------------------------------------------------------
 * **UMA REVALIDAÇÃO DE LAYOUT E NÃO DUAS DE PÁGINA.** O acervo aparece em duas
 * rotas — `/portal/biblioteca` e `/portal/{slug}/biblioteca` —, e a segunda é
 * dinâmica: revalidar as duas à mão exigiria o slug, que estas ações não
 * recebem e não deveriam receber. `revalidatePath("/portal", "layout")` é a
 * forma que as notificações do painel já usam.
 * ---------------------------------------------------------------------------
 */

const ROTULOS: Record<string, string> = {
  client_id: "empresa",
  folder_id: "pasta",
  pasta_pai_id: "pasta de cima",
  nome: "nome",
  url: "arquivo",
  descricao: "descrição",
};

/** Revalida as duas rotas do portal de uma vez. */
function revalidar() {
  revalidatePath("/portal", "layout");
}

/**
 * O NOME DA PASTA, e por que o teto é 60.
 *
 * É o mesmo da vertente (0118), e pela mesma razão: o nome vira cabeçalho numa
 * coluna estreita, e acima disso ele não cabe sem truncar — e um nome de pasta
 * truncado não distingue "Logos para impressão" de "Logos para digital".
 */
const nomeDePasta = z
  .string()
  .trim()
  .min(2, "A pasta precisa de um nome.")
  .max(60, "Um nome acima de sessenta caracteres não cabe no cabeçalho da pasta.");

const esquemaDePasta = z.object({
  client_id: z.string().uuid(),
  nome: nomeDePasta,
  /** Nulo é pasta de topo. A 0139 recusa o neto, e a tela não oferece. */
  pasta_pai_id: z.string().uuid().nullable().optional(),
});

/**
 * A ORDEM NOVA É A ÚLTIMA MAIS DEZ, e não a contagem.
 *
 * É a decisão de `criarVertente` palavra por palavra: com a contagem, apagar
 * uma pasta e criar outra daria a mesma ordem duas vezes — e duas linhas
 * empatadas no `order by` saem numa sequência que o Postgres não garante,
 * então a lista trocaria de ordem sozinha entre duas visitas. O máximo é um
 * número que só cresce.
 */
const PASSO_DA_ORDEM = 10;

export async function criarPastaDaMarca(dados: unknown): Promise<Resultado> {
  return executarAcao("criarPastaDaMarca", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDePasta.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao(
          "criarPastaDaMarca",
          validacao.error,
          dados,
          "Confira o nome da pasta.",
          ROTULOS,
        ),
      );

    const { client_id, nome, pasta_pai_id = null } = validacao.data;

    const supabase = await criarClienteServidor();

    // A ÚLTIMA ORDEM DO MESMO NÍVEL, e não da conta inteira: uma subpasta nova
    // herdaria a ordem da última pasta de topo e nasceria no fim de uma lista
    // de que ela não faz parte.
    const consulta = supabase
      .from("client_folders")
      .select("ordem")
      .eq("client_id", client_id)
      .order("ordem", { ascending: false })
      .limit(1);
    const { data: ultima } = await (pasta_pai_id
      ? consulta.eq("pasta_pai_id", pasta_pai_id)
      : consulta.is("pasta_pai_id", null));

    const { error } = await supabase.from("client_folders").insert({
      client_id,
      nome,
      pasta_pai_id,
      ordem: (ultima?.[0]?.ordem ?? 0) + PASSO_DA_ORDEM,
    });

    // O ÍNDICE ÚNICO FALA EM INGLÊS, e a pessoa não tem o que fazer com
    // "duplicate key value violates unique constraint".
    if (error?.code === "23505")
      return falha(`Já existe uma pasta chamada "${nome}" aqui.`);
    if (error) return falha(`Não foi possível criar a pasta: ${error.message}`);

    revalidar();
    return sucesso("Pasta criada.");
  });
}

export async function renomearPastaDaMarca(dados: unknown): Promise<Resultado> {
  return executarAcao("renomearPastaDaMarca", async () => {
    await exigirGestorNaAcao();

    const esquema = z.object({ id: z.string().uuid(), nome: nomeDePasta });
    const validacao = esquema.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao(
          "renomearPastaDaMarca",
          validacao.error,
          dados,
          "Confira o nome da pasta.",
          ROTULOS,
        ),
      );

    const supabase = await criarClienteServidor();
    // RENOMEAR NÃO MEXE NO ARQUIVO, e é consequência do modelo: o caminho no
    // bucket não carrega o nome da pasta — ele é `{conta}/{uuid}-{nome}`. É por
    // isso que corrigir o nome é um `update` e não mover N objetos, que era o
    // argumento inteiro contra navegar o bucket pelo prefixo.
    const { data, error } = await supabase
      .from("client_folders")
      .update({ nome: validacao.data.nome, updated_at: new Date().toISOString() })
      .eq("id", validacao.data.id)
      .select("id");

    if (error?.code === "23505")
      return falha(`Já existe uma pasta chamada "${validacao.data.nome}" aqui.`);
    if (error) return falha(`Não foi possível renomear: ${error.message}`);
    // SEM LINHA É RECUSA, e não sucesso: a policy barrou, e sem esta pergunta
    // a tela diria "Pronto." sobre um update que não aconteceu.
    if (!data || data.length === 0)
      return falha("Esta pasta não foi renomeada. Só sócio e desenvolvedor mexem no acervo.");

    revalidar();
    return sucesso("Pasta renomeada.");
  });
}

/**
 * APAGAR A PASTA LEVA AS SUBPASTAS E OS ARQUIVOS, pelo `cascade` da 0139.
 *
 * **E quem diz o tamanho do estrago é o diálogo, contando**, que é a decisão
 * do diálogo de apagar campanha: *"'Apagar esta campanha?' não informa nada; a
 * contagem é a única coisa que faz alguém parar"*. `arquivosQueSaemCom()` é
 * quem a escreve, do lado do domínio.
 *
 * ***O que fica no bucket, e é dito em vez de escondido:*** os objetos dos
 * arquivos que saíram. Apagá-los daqui seria uma segunda escrita que pode
 * falhar depois de a linha já ter ido — e aí a recusa falaria de um arquivo que
 * não existe mais na tela. É a forma da 0048: *"o arquivo continua no bucket"*.
 */
export async function apagarPastaDaMarca(dados: unknown): Promise<Resultado> {
  return executarAcao("apagarPastaDaMarca", async () => {
    await exigirGestorNaAcao();

    const validacao = z.object({ id: z.string().uuid() }).safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao(
          "apagarPastaDaMarca",
          validacao.error,
          dados,
          "Não foi possível identificar a pasta.",
          ROTULOS,
        ),
      );

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_folders")
      .delete()
      .eq("id", validacao.data.id)
      .select("id");

    if (error) return falha(`Não foi possível apagar a pasta: ${error.message}`);
    if (!data || data.length === 0)
      return falha("Esta pasta não foi apagada. Só sócio e desenvolvedor mexem no acervo.");

    revalidar();
    return sucesso("Pasta apagada.");
  });
}

/**
 * O ARQUIVO — do bucket ou um link de fora, numa coluna só.
 *
 * **`url` aceita as duas formas**, e quem decide o rótulo do botão é
 * `ehLinkDeFora()`: a forma de `subtask_entregas` e o par que
 * `assinarArquivos()` já faz em todo o produto. O que esta validação garante é
 * que a string seja uma das duas — um `url` vazio ou um `ftp://` sairia como um
 * botão que não leva a lugar nenhum.
 */
const esquemaDeArquivo = z.object({
  folder_id: z.string().uuid(),
  nome: z
    .string()
    .trim()
    .min(2, "O arquivo precisa de um nome.")
    .max(120, "Um nome acima de cento e vinte caracteres não cabe no cartão."),
  url: z
    .string()
    .trim()
    .min(1, "Falta o arquivo ou o endereço.")
    .refine(
      (valor) => ehLinkDeFora(valor) || !/^[a-z][a-z0-9+.-]*:/i.test(valor),
      "Um endereço precisa começar com http:// ou https://.",
    ),
  descricao: z
    .string()
    .trim()
    .max(300, "A descrição passa de trezentos caracteres.")
    .optional()
    // VAZIO VIRA NULO, pela regra do briefing: guardar uma string em branco é
    // guardar o formato do nada, e a tela teria de perguntar as duas coisas.
    .transform((valor) => (valor ? valor : null)),
  tamanho: z.number().int().nonnegative().nullable().optional(),
});

export async function anexarArquivoDaMarca(dados: unknown): Promise<Resultado> {
  return executarAcao("anexarArquivoDaMarca", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = esquemaDeArquivo.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao(
          "anexarArquivoDaMarca",
          validacao.error,
          dados,
          "Confira o arquivo.",
          ROTULOS,
        ),
      );

    const { folder_id, nome, url, descricao, tamanho = null } = validacao.data;

    const supabase = await criarClienteServidor();
    const { data: ultimo } = await supabase
      .from("client_files")
      .select("ordem")
      .eq("folder_id", folder_id)
      .order("ordem", { ascending: false })
      .limit(1);

    // `client_id` NÃO VIAJA, e nem poderia: `client_files_herda_a_conta`
    // escreve a conta a partir da pasta, e a coluna fica fora de `Insert` no
    // tipo — o que é consequência não se digita.
    const { error } = await supabase.from("client_files").insert({
      folder_id,
      nome,
      url,
      descricao,
      // LINK NÃO TEM TAMANHO, e nulo é a resposta honesta: um documento do
      // Drive muda de peso sem ninguém avisar.
      tamanho: ehLinkDeFora(url) ? null : tamanho,
      ordem: (ultimo?.[0]?.ordem ?? 0) + PASSO_DA_ORDEM,
      enviado_por: sessao.usuarioId,
    });

    if (error) return falha(`Não foi possível anexar: ${error.message}`);

    revalidar();
    return sucesso(ehLinkDeFora(url) ? "Link anexado." : "Arquivo anexado.");
  });
}

export async function renomearArquivoDaMarca(dados: unknown): Promise<Resultado> {
  return executarAcao("renomearArquivoDaMarca", async () => {
    await exigirGestorNaAcao();

    const esquema = esquemaDeArquivo
      .pick({ nome: true, descricao: true })
      .extend({ id: z.string().uuid() });
    const validacao = esquema.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao(
          "renomearArquivoDaMarca",
          validacao.error,
          dados,
          "Confira o nome do arquivo.",
          ROTULOS,
        ),
      );

    const supabase = await criarClienteServidor();
    // `url` NÃO ESTÁ AQUI, de propósito: trocar o endereço por baixo de um
    // arquivo que o cliente já baixou é trocar o material sem deixar rastro —
    // a decisão de `post_referencias`, que não tem policy de UPDATE. Trocou o
    // arquivo, anexa outro e apaga este.
    const { data, error } = await supabase
      .from("client_files")
      .update({ nome: validacao.data.nome, descricao: validacao.data.descricao })
      .eq("id", validacao.data.id)
      .select("id");

    if (error) return falha(`Não foi possível renomear: ${error.message}`);
    if (!data || data.length === 0)
      return falha("Este arquivo não foi alterado. Só sócio e desenvolvedor mexem no acervo.");

    revalidar();
    return sucesso("Arquivo atualizado.");
  });
}

/**
 * APAGAR O ARQUIVO apaga a linha, e TENTA apagar o objeto.
 *
 * **A linha é o fato e o objeto é consequência**, nessa ordem: a remoção do
 * bucket é uma segunda escrita, e uma falha nela não desfaz nada — o arquivo já
 * saiu da tela. Então ela AVISA no log em vez de recusar, que é a forma da 0052
 * e a das segundas escritas da 0125.
 *
 * **E o link de fora não tem objeto para apagar:** `ehLinkDeFora()` decide, e
 * mandar um endereço `https://` para o Storage seria pedir a remoção de um
 * caminho que nunca existiu lá.
 */
export async function apagarArquivoDaMarca(dados: unknown): Promise<Resultado> {
  return executarAcao("apagarArquivoDaMarca", async () => {
    await exigirGestorNaAcao();

    const validacao = z.object({ id: z.string().uuid() }).safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao(
          "apagarArquivoDaMarca",
          validacao.error,
          dados,
          "Não foi possível identificar o arquivo.",
          ROTULOS,
        ),
      );

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_files")
      .delete()
      .eq("id", validacao.data.id)
      .select("url");

    if (error) return falha(`Não foi possível apagar: ${error.message}`);
    if (!data || data.length === 0)
      return falha("Este arquivo não foi apagado. Só sócio e desenvolvedor mexem no acervo.");

    const caminho = data[0]?.url;
    if (caminho && !ehLinkDeFora(caminho)) {
      const { error: doBucket } = await supabase.storage
        .from(BUCKET_DA_MARCA)
        .remove([caminho]);
      // NENHUMA ESCRITA FALHA CALADA, e o mínimo aqui é o log: um objeto que
      // ficou para trás não aparece em tela nenhuma, e sem esta linha a única
      // pista seria o painel do Supabase.
      if (doBucket) console.error("[storage:apagar-marca]", doBucket);
    }

    revalidar();
    return sucesso("Arquivo apagado.");
  });
}
