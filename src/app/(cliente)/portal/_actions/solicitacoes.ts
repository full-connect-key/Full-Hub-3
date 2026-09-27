"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import { exigirCotaDeComentario } from "@/lib/acoes/limite";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações do cliente sobre os pedidos que ele abre (0068).
 *
 * ---------------------------------------------------------------------------
 * **O QUE ELE NÃO PODE ESTÁ NA AUSÊNCIA, e é o desenho do módulo.**
 *
 * Não existe aqui uma ação de editar o pedido, nem de mudar o status, nem de
 * apagá-lo. Depois de mandar, o caminho é a CONVERSA: uma mensagem nova, com
 * data e autor. Editar o título de um pedido que o Atendimento já leu — ou que
 * já virou demanda — trocaria o combinado embaixo de quem está trabalhando
 * nele.
 *
 * E quem recusa não é a ausência da função: `client_requests_update` fecha em
 * `is_atendimento()`, e não há policy de DELETE para o cliente. Isto aqui
 * escreve a frase em português antes de a pessoa levar um "nenhuma linha
 * voltou".
 * ---------------------------------------------------------------------------
 */

const ROTA_DO_CLIENTE = "/portal/solicitacoes";
const ROTA_DA_EQUIPE = "/painel/solicitacoes";

/**
 * As duas rotas são revalidadas juntas, sempre.
 *
 * O pedido tem duas telas, e cada escrita muda as duas: o cliente manda e o
 * Atendimento precisa ver na fila; o Atendimento responde e o cliente precisa
 * ver a resposta. Revalidar só a de quem clicou deixaria a outra mostrando o
 * estado anterior até alguém recarregar à mão.
 */
function revalidarOsDoisLados(id?: string) {
  revalidatePath(ROTA_DO_CLIENTE);
  revalidatePath(ROTA_DA_EQUIPE);
  if (id) {
    revalidatePath(`${ROTA_DO_CLIENTE}/${id}`);
    revalidatePath(`${ROTA_DA_EQUIPE}/${id}`);
  }
}

const esquemaDoPedido = z.object({
  client_id: z.string().uuid("Escolha a empresa."),
  request_type_id: z.string().uuid().optional().nullable(),
  titulo: z.string().trim().min(3, "Dê um nome ao que você precisa."),
  descricao: z.string().trim().max(4000).optional().nullable(),
  respostas: z.record(z.string(), z.string()).default({}),
  data_desejada: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Data inválida." })
    .optional()
    .nullable(),
});

const ROTULOS = {
  client_id: "empresa",
  titulo: "o que você precisa",
  data_desejada: "data desejada",
};

/**
 * O cliente abre o pedido.
 *
 * **`status` e `criado_por` não são enviados**, e não é esquecimento: o
 * trigger `client_requests_normaliza` reescreve os dois, então eles ficam fora
 * do `Insert` dos tipos — tentar gravá-los é erro de tipo antes de ser uma
 * escrita que o banco descarta em silêncio.
 *
 * **E a conta desligada é recusada pelo BANCO.** A tela esconde o botão, mas
 * quem garante é o `with check` de `client_requests_insert`: botão escondido
 * não é regra de segurança neste produto.
 */
export async function abrirSolicitacao(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("abrirSolicitacao", async () => {
    await exigirSessaoNaAcao();

    const validacao = esquemaDoPedido.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao(
          "abrirSolicitacao",
          validacao.error,
          dados,
          "Confira os campos.",
          ROTULOS,
        ),
      );
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_requests")
      .insert({
        client_id: entrada.client_id,
        request_type_id: entrada.request_type_id || null,
        titulo: entrada.titulo,
        descricao: entrada.descricao?.trim() || null,
        respostas: entrada.respostas,
        data_desejada: entrada.data_desejada?.trim() || null,
      })
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível enviar: ${error.message}`);
    if (!data) {
      return falha(
        "O banco recusou. Esta conta pode estar com os pedidos pelo Portal desligados — fale com o seu atendimento.",
      );
    }

    revalidarOsDoisLados();
    return sucesso("Pedido enviado. A gente responde por aqui.", data.id);
  });
}

/**
 * Registra o anexo que o navegador acabou de subir.
 *
 * **O arquivo vai para o bucket pelo navegador, com a sessão de quem está
 * logado**, como em todo upload do produto — e é a policy do Storage que
 * confere a pasta da empresa. Esta ação grava a LINHA, que é o que a tela
 * lista e o que o teto de dez conta.
 *
 * O teto é do banco, e não daqui: dez abas somando um arquivo cada passam por
 * dez contagens na tela antes de qualquer uma gravar.
 */
export async function registrarAnexo(
  requestId: string,
  arquivo: { caminho: string; nome: string; tipo?: string | null; tamanho?: number | null },
): Promise<Resultado> {
  return executarAcao("registrarAnexo", async () => {
    const sessao = await exigirSessaoNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("request_attachments")
      .insert({
        request_id: requestId,
        caminho: arquivo.caminho,
        nome: arquivo.nome,
        tipo: arquivo.tipo ?? null,
        tamanho: arquivo.tamanho ?? null,
        enviado_por: sessao.usuarioId,
      })
      .select("id")
      .maybeSingle();

    // O `hint` do trigger do teto diz o que fazer no lugar; descartá-lo
    // deixaria um "não foi possível" mudo.
    if (error) return falha(`${error.message}${error.hint ? ` ${error.hint}` : ""}`);
    if (!data) return falha("O banco recusou o anexo.");

    revalidarOsDoisLados(requestId);
    return sucesso("Arquivo anexado.");
  });
}

/**
 * Apagar um anexo é de quem o pôs, ou da gestão.
 *
 * **O objeto continua no bucket**, como na 0048: apagar não é desfazer, e o
 * que sobra está na pasta da própria empresa. O que some é a linha, que é o
 * que a tela lista.
 */
export async function apagarAnexo(id: string, requestId: string): Promise<Resultado> {
  return executarAcao("apagarAnexo", async () => {
    await exigirSessaoNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("request_attachments")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível apagar: ${error.message}`);
    if (!data) return falha("Só quem anexou apaga o arquivo.");

    revalidarOsDoisLados(requestId);
    return sucesso("Arquivo removido.");
  });
}

/**
 * A conversa do pedido, e ela é UMA ação para os DOIS lados.
 *
 * ---------------------------------------------------------------------------
 * **A tela do painel importa esta função**, e a exceção à convenção — cada
 * rota com as ações dela ao lado — está aqui de propósito.
 *
 * É a mesma escrita, na mesma tabela, com a mesma validação e a mesma cota: o
 * que muda é só quem está logado, e quem decide o que fazer com isso é o
 * trigger `request_messages_avisa`, no banco. Duas cópias dariam dois limites
 * de tamanho e duas cotas para a mesma conversa — e a que divergisse seria a
 * do lado que ninguém testa.
 *
 * **Ela mora no lado do CLIENTE porque é ele quem a tabela protege.** Não
 * existe `interno` em `request_messages`: tudo o que se escreve ali é para ele
 * ler, e uma ação de conversa guardada na pasta do painel convidaria a
 * primeira pessoa que a abrisse a acrescentar o campo.
 * ---------------------------------------------------------------------------
 */
export async function escreverNaSolicitacao(
  requestId: string,
  texto: unknown,
): Promise<Resultado> {
  return executarAcao("escreverNaSolicitacao", async () => {
    const sessao = await exigirSessaoNaAcao();

    const validacao = z
      .string()
      .trim()
      .min(1, "Escreva alguma coisa.")
      .max(4000, "A mensagem ficou longa demais.")
      .safeParse(texto);

    if (!validacao.success) {
      return falha(
        recusaDeValidacao("escreverNaSolicitacao", validacao.error, texto, "Mensagem inválida."),
      );
    }

    await exigirCotaDeComentario(sessao.usuarioId);

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("request_messages")
      .insert({ request_id: requestId, texto: validacao.data })
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível enviar: ${error.message}`);
    if (!data) return falha("O banco recusou. Esta conversa não é sua.");

    revalidarOsDoisLados(requestId);
    return sucesso("Enviado.");
  });
}
