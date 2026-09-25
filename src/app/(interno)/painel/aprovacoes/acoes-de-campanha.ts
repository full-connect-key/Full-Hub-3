"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirRotaNaAcao } from "@/lib/acoes/guardas";
import {
  executarAcao,
  falha,
  sucesso,
  type Resultado,
} from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { colunasDoConteudo, doEntregavel } from "@/lib/aprovacoes/conteudo";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Criar a campanha, enviar o entregável, registrar a versão.
 *
 * Tudo passa pelo cliente Supabase da própria pessoa: quem pode criar e editar
 * é o RLS que decide (`campaigns_insert` e `deliverables_insert` exigem
 * `is_staff()`). A checagem de rota aqui é a primeira barreira, não a única.
 *
 * **Enviar ao cliente não tem ação própria, e é de propósito.** Enviar É abrir
 * a rodada de escopo cliente: o carimbo em `deliverables.enviado_em` sai do
 * trigger `approval_rounds_marca_conteudo`. Uma ação que escrevesse a coluna
 * daria material carimbado sem rodada nenhuma — o cliente vendo a peça sem ter
 * onde decidir.
 */

const ROTA = "/painel/aprovacoes";

const CAMPOS = {
  nome: "nome da campanha",
  clienteId: "cliente",
  dataInicio: "data de início",
  dataFim: "data de encerramento",
};

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data.");
const dataOpcional = z.union([data, z.literal(""), z.null()]).optional();

const esquemaDoItem = z.object({
  nome: z.string().trim().min(1, "Todo item precisa de um nome."),
  prazo: dataOpcional,
});

const esquemaDoNo = esquemaDoItem.extend({
  filhos: z.array(esquemaDoItem).default([]),
});

const esquemaDaCampanha = z
  .object({
    nome: z.string().trim().min(2, "Dê um nome à campanha."),
    clienteId: z.string().uuid("Escolha o cliente."),
    descricao: z.string().trim().optional(),
    dataInicio: data,
    dataFim: data,
    /** De onde a estrutura saiu. Guardado como procedência, não como regra. */
    templateId: z.string().uuid().nullable().optional(),
    /**
     * O estado da campanha, e ele PRECISA estar aqui.
     *
     * A coluna tem default `planejamento` no banco, e a primeira versão desta
     * tela não oferecia o campo — então toda campanha nascia em planejamento,
     * e tanto a listagem do portal (que abre em "Ativas") quanto o bloco
     * "Campanhas ativas" da tela inicial a escondiam. Ela existia e não
     * aparecia em lugar nenhum, que é o pior desfecho possível para um
     * "Criar".
     */
    status: z
      .enum(["planejamento", "ativa", "finalizada", "cancelada"])
      .default("ativa"),
    /**
     * A ÁRVORE COMO A PESSOA A DEIXOU, e não o modelo de onde ela saiu.
     *
     * Quem expande o template é a tela, no instante em que ele é escolhido —
     * e daí em diante o Atendimento acrescenta, remove e datilografa prazos.
     * Se a action reexpandisse o modelo, tudo isso seria desfeito no clique
     * de salvar: a pessoa veria uma árvore e gravaria outra.
     */
    estrutura: z.array(esquemaDoNo).default([]),
  })
  .refine((v) => v.dataFim >= v.dataInicio, {
    path: ["dataFim"],
    message: "O encerramento não pode ser antes do início.",
  });

export type NovaCampanha = z.input<typeof esquemaDaCampanha>;

/**
 * Cria a campanha e materializa a árvore de entregáveis.
 *
 * **Os entregáveis nascem em `aguardando_informacoes` e SEM `enviado_em`.** A
 * estrutura existe para a equipe se organizar; o cliente só passa a enxergar
 * cada peça quando ela for enviada, uma a uma. Criar a campanha já visível
 * com quarenta linhas vazias faria a tela dele prometer material que ninguém
 * começou.
 *
 * Os filhos entram DEPOIS dos pais, e não juntos: `parent_id` aponta para uma
 * linha que precisa existir. Dois `insert` em vez de um — e é o mínimo,
 * porque a árvore tem dois níveis e nunca três.
 */
export async function criarCampanha(entrada: NovaCampanha): Promise<Resultado> {
  return executarAcao("criarCampanha", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validado = esquemaDaCampanha.safeParse(entrada);
    if (!validado.success) {
      return falha(recusaDeValidacao("criarCampanha", validado.error, entrada, "Confira os dados da campanha.", CAMPOS));
    }
    const dados = validado.data;

    const supabase = await criarClienteServidor();

    const { data: criada, error } = await supabase
      .from("campaigns")
      .insert({
        client_id: dados.clienteId,
        nome: dados.nome,
        descricao: dados.descricao || null,
        data_inicio: dados.dataInicio,
        data_fim: dados.dataFim,
        status: dados.status,
        template_id: dados.templateId ?? null,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error) return falha(error.message);
    if (!criada) {
      return falha(
        "O banco recusou a criação. Normalmente é o RLS: abrir campanha é da equipe interna.",
      );
    }

    if (dados.estrutura.length > 0) {
      const erro = await materializar(criada.id, dados.estrutura);
      if (erro) return falha(erro);
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso("Campanha criada.");
  });
}

type NoParaGravar = z.output<typeof esquemaDoNo>;

/**
 * Transforma a árvore em linhas de `deliverables`.
 *
 * A campanha JÁ EXISTE quando isto roda, e se a estrutura falhar no meio ela
 * fica lá com o que deu certo. É diferente da criação de usuário, que tem
 * rollback: lá o cadastro pela metade ocupa um e-mail e ninguém entende por
 * quê; aqui a campanha é uma linha visível, com nome e período, e a equipe
 * acrescenta o que faltar pela própria tela. Apagá-la perderia mais.
 *
 * **Os pais voltam com o id, e o casamento é por POSIÇÃO.** Casar por nome
 * quebraria em silêncio na campanha que tem dois grupos chamados igual — e
 * "Feed/Story site" aparece duas vezes na Wave, uma no Enxoval e outra no
 * Deskfy. O `insert` do PostgREST devolve as linhas na ordem em que foram
 * mandadas, e é dela que o `parent_id` de cada filho sai.
 */
async function materializar(
  campanhaId: string,
  estrutura: NoParaGravar[],
): Promise<string | null> {
  const supabase = await criarClienteServidor();

  const { data: criados, error } = await supabase
    .from("deliverables")
    .insert(
      estrutura.map((no, i) => ({
        campaign_id: campanhaId,
        nome: no.nome,
        ordem: i,
        prazo: no.prazo || null,
      })),
    )
    .select("id");

  if (error) return error.message;
  if (!criados || criados.length !== estrutura.length) {
    return "O banco recusou a estrutura da campanha.";
  }

  const filhos = estrutura.flatMap((no, i) =>
    no.filhos.map((filho, j) => ({
      campaign_id: campanhaId,
      parent_id: criados[i].id,
      nome: filho.nome,
      ordem: j,
      prazo: filho.prazo || null,
    })),
  );

  if (filhos.length === 0) return null;

  const { error: erroDosFilhos } = await supabase
    .from("deliverables")
    .insert(filhos)
    .select("id");

  return erroDosFilhos ? erroDosFilhos.message : null;
}

/**
 * Manda o entregável ao cliente — abrindo a rodada de escopo cliente.
 *
 * Uma escrita só, e é a rodada. O `enviado_em` e o `status` do entregável saem
 * do trigger, na mesma transação: separá-los daria rodada de cliente num
 * material que ele não enxerga (a fila mostraria uma decisão impossível) e
 * material carimbado sem rodada nenhuma.
 *
 * Quem recusa o resto é `validar_nova_rodada`: aval interno antes do envio,
 * e *"ninguém envia ao cliente a própria entrega"*.
 */
export async function enviarEntregavelAoCliente(
  entregavelId: string,
): Promise<Resultado> {
  return executarAcao("enviarEntregavelAoCliente", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const conteudo = doEntregavel(entregavelId);

    // A numeração continua de onde a anterior parou. Rodada fechada nunca é
    // reescrita nem apagada — cada ciclo de ajuste cria uma nova, com número
    // maior, e as anteriores ficam com o que foi pedido e decidido.
    const { data: anteriores } = await supabase
      .from("approval_rounds")
      .select("numero_rodada")
      .eq("content_type", conteudo.tipo)
      .eq("content_id", conteudo.id)
      .order("numero_rodada", { ascending: false })
      .limit(1);

    const numero = (anteriores?.[0]?.numero_rodada ?? 0) + 1;

    const { data, error } = await supabase
      .from("approval_rounds")
      .insert({
        ...colunasDoConteudo(conteudo),
        numero_rodada: numero,
        escopo: "cliente",
        solicitado_por: sessao.usuarioId,
      })
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("O banco recusou o envio deste material.");
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso("Enviado ao cliente.");
  });
}

/**
 * Troca — ou tira — a capa do cartão da campanha.
 *
 * **O arquivo sobe pelo navegador, e aqui só entra o CAMINHO.** É a mesma
 * divisão do editor de post: quem sobe é a sessão da própria pessoa, então a
 * policy do Storage continua valendo; mandar o binário por Server Action o
 * faria atravessar o servidor do Next sem ganhar nenhuma checagem.
 *
 * **O caminho precisa começar pela pasta do cliente**, senão a capa aparece
 * para a equipe e some para quem ela foi feita: `"campanhas: cliente le"`
 * compara `(storage.foldername(name))[1]` com as empresas de quem pede. Quem
 * monta o caminho é a tela, e esta checagem é a segunda leitura da mesma
 * regra — barata, e o sintoma dela é uma imagem quebrada no portal.
 *
 * **Tirar a capa é `null`, e não apagar o arquivo.** O cartão volta ao
 * desenho de texto na hora; o arquivo fica no bucket, que é onde ele não
 * incomoda ninguém. Apagar junto transformaria um clique de "não era esta" em
 * perda de arquivo.
 */
export async function trocarCapaDaCampanha(
  campanhaId: string,
  caminho: string | null,
): Promise<Resultado> {
  return executarAcao("trocarCapaDaCampanha", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    const { data: campanha } = await supabase
      .from("campaigns")
      .select("client_id")
      .eq("id", campanhaId)
      .maybeSingle();

    if (!campanha) {
      return falha("Esta campanha não existe, ou o seu acesso não a alcança.");
    }

    if (caminho && !caminho.startsWith(`${campanha.client_id}/`)) {
      return falha(
        "A capa precisa ficar na pasta do cliente, senão ela não aparece no portal dele.",
      );
    }

    // `.select()` porque o RLS pode recusar em silêncio: sem ele, um update
    // barrado volta sem erro e sem linha, e a tela diz "pronto" à toa.
    const { data, error } = await supabase
      .from("campaigns")
      .update({ capa_url: caminho })
      .eq("id", campanhaId)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("O banco recusou a troca da capa. Trocar capa é da equipe interna.");
    }

    revalidatePath(ROTA);
    revalidatePath("/portal/campanhas");
    return sucesso(caminho ? "Capa trocada." : "Capa retirada.");
  });
}
