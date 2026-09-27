import "server-only";

import { assinarArquivos, enderecoDaArte } from "@/lib/dados/conteudo";
import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  ClientRequest,
  RequestAttachment,
  RequestMessage,
  RequestType,
  SolicitacaoStatus,
} from "@/lib/supabase/database.types";

/**
 * As consultas dos pedidos do cliente (0068).
 *
 * ---------------------------------------------------------------------------
 * **NENHUMA CONSULTA AQUI FILTRA POR EMPRESA, e é de propósito.**
 *
 * Quem separa "o pedido da minha empresa" do "pedido da outra" é
 * `client_requests_select` no banco: `is_staff()` ou `my_client_ids()`.
 * Repetir o filtro aqui criaria um segundo lugar onde a regra pode divergir —
 * e o lado que esquecesse seria o que mostra o pedido de um cliente para
 * outro. É a decisão de `lib/dados/portal.ts` e de `lib/dados/posts.ts`.
 *
 * `ouFalha()` em todas: este módulo nasce depois da lição da campanha
 * invisível, e uma lista vazia aqui é indistinguível de "ninguém pediu nada" —
 * que é a resposta mais comum e a mais plausível deste módulo.
 * ---------------------------------------------------------------------------
 */

// O NOME DO BUCKET MORA EM `lib/dominio/`, porque a tela do pedido é
// `"use client"` e precisa dele para subir o arquivo. Reexportado aqui para
// quem já lia deste módulo continuar lendo — a mesma forma de
// `PRAZO_DE_APROVACAO_PADRAO` em `fluxo-do-cliente.ts`.
export { BUCKET_DOS_PEDIDOS } from "@/lib/dominio/solicitacoes";
import { BUCKET_DOS_PEDIDOS } from "@/lib/dominio/solicitacoes";

export type Pessoa = { id: string; nome: string; avatar_url: string | null };

export type PedidoNaLista = ClientRequest & {
  empresa: string | null;
  autor: Pessoa | null;
  tipo: string | null;
  quantosAnexos: number;
  quantasMensagens: number;
  /** A demanda que ele virou, quando virou. */
  demanda: { id: string; titulo: string } | null;
};

export type MensagemDoPedido = RequestMessage & { autor: Pessoa | null };

export type AnexoDoPedido = RequestAttachment & {
  /** O endereço assinado, ou null quando a assinatura falhou. */
  assinado: string | null;
};

export type PedidoCompleto = PedidoNaLista & {
  mensagens: MensagemDoPedido[];
  anexos: AnexoDoPedido[];
  roteiro: RequestType | null;
};

/** Os tipos que o formulário oferece. A RLS já esconde o desligado do cliente. */
export async function tiposDePedido(): Promise<RequestType[]> {
  const supabase = await criarClienteServidor();
  const r = await supabase.from("request_types").select("*").order("ordem");
  return ouFalha("tipos de pedido", r) ?? [];
}

/**
 * Monta os campos derivados de um lote de pedidos.
 *
 * **Quatro consultas e não um embed, e a razão é a lição da campanha
 * invisível:** um `select` com embutido errado é recusado INTEIRO pelo
 * PostgREST, e o que a tela recebe é uma lista vazia — que aqui quer dizer
 * "ninguém pediu nada", a resposta mais plausível do módulo. Com consultas
 * separadas, um join que falha derruba o `ouFalha()` daquela consulta e diz
 * qual.
 */
async function enfeitar(pedidos: ClientRequest[]): Promise<PedidoNaLista[]> {
  if (pedidos.length === 0) return [];

  const supabase = await criarClienteServidor();
  const ids = pedidos.map((p) => p.id);
  const empresas = [...new Set(pedidos.map((p) => p.client_id))];
  const autores = [...new Set(pedidos.map((p) => p.criado_por).filter(Boolean))] as string[];
  const tipos = [...new Set(pedidos.map((p) => p.request_type_id).filter(Boolean))] as string[];

  const [rEmpresas, rAutores, rTipos, rAnexos, rMensagens, rDemandas] = await Promise.all([
    supabase.from("clients").select("id, nome_empresa").in("id", empresas),
    autores.length
      ? supabase.from("profiles").select("id, nome, avatar_url").in("id", autores)
      : null,
    tipos.length ? supabase.from("request_types").select("id, nome").in("id", tipos) : null,
    supabase.from("request_attachments").select("request_id").in("request_id", ids),
    supabase.from("request_messages").select("request_id").in("request_id", ids),
    supabase.from("tasks").select("id, titulo, request_id").in("request_id", ids),
  ]);

  const porEmpresa = new Map(
    (ouFalha("empresas dos pedidos", rEmpresas) ?? []).map((c) => [c.id, c.nome_empresa]),
  );
  const porAutor = new Map(
    (rAutores ? (ouFalha("autores dos pedidos", rAutores) ?? []) : []).map((p) => [p.id, p]),
  );
  const porTipo = new Map(
    (rTipos ? (ouFalha("tipos dos pedidos", rTipos) ?? []) : []).map((t) => [t.id, t.nome]),
  );

  const anexos = ouFalha("anexos dos pedidos", rAnexos) ?? [];
  const mensagens = ouFalha("mensagens dos pedidos", rMensagens) ?? [];
  const demandas = ouFalha("demandas dos pedidos", rDemandas) ?? [];
  const porPedido = new Map(demandas.map((t) => [t.request_id as string, t]));

  return pedidos.map((p) => ({
    ...p,
    empresa: porEmpresa.get(p.client_id) ?? null,
    autor: p.criado_por ? (porAutor.get(p.criado_por) ?? null) : null,
    tipo: p.request_type_id ? (porTipo.get(p.request_type_id) ?? null) : null,
    quantosAnexos: anexos.filter((a) => a.request_id === p.id).length,
    quantasMensagens: mensagens.filter((m) => m.request_id === p.id).length,
    demanda: porPedido.get(p.id)
      ? { id: porPedido.get(p.id)!.id, titulo: porPedido.get(p.id)!.titulo }
      : null,
  }));
}

/**
 * A caixa de entrada do Atendimento.
 *
 * **A ORDEM É DO MAIS ANTIGO PARA O MAIS NOVO**, ao contrário de toda outra
 * listagem do produto. A pergunta desta tela não é "o que chegou?", é "quem
 * está esperando há mais tempo?" — e uma fila em que o pedido de ontem aparece
 * acima do de semana passada é a fila em que o de semana passada nunca é
 * atendido. É o mesmo índice que a 0068 criou de propósito.
 *
 * Os encerrados vão para o fim, e não para fora: o Atendimento precisa achar
 * o que já respondeu quando o cliente pergunta de novo.
 */
export async function caixaDeEntrada(filtros?: {
  status?: SolicitacaoStatus | null;
  clienteId?: string | null;
}): Promise<PedidoNaLista[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase.from("client_requests").select("*");
  if (filtros?.status) consulta = consulta.eq("status", filtros.status);
  if (filtros?.clienteId) consulta = consulta.eq("client_id", filtros.clienteId);

  const r = await consulta.order("created_at", { ascending: true });
  const pedidos = ouFalha("caixa de entrada de pedidos", r) ?? [];

  const enfeitados = await enfeitar(pedidos);
  const abertos = enfeitados.filter((p) => p.status === "nova" || p.status === "em_analise");
  const resto = enfeitados
    .filter((p) => p.status !== "nova" && p.status !== "em_analise")
    .reverse();

  return [...abertos, ...resto];
}

/** Os pedidos da empresa de quem está olhando — do mais novo para o mais antigo. */
export async function meusPedidos(clienteId?: string): Promise<PedidoNaLista[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase.from("client_requests").select("*");
  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const r = await consulta.order("created_at", { ascending: false });
  return enfeitar(ouFalha("meus pedidos", r) ?? []);
}

export async function pedido(id: string): Promise<PedidoCompleto | null> {
  const supabase = await criarClienteServidor();

  const r = await supabase.from("client_requests").select("*").eq("id", id).maybeSingle();
  // `ouFalha` ANTES do `if (!data)`: sem linha é a RLS dizendo "isto não é
  // seu", e a tela responde 404; erro é o `select` recusado inteiro, e juntar
  // os dois faria "pedido não encontrado" aparecer para um pedido que existe.
  const linha = ouFalha("pedido", r);
  if (!linha) return null;

  const [base] = await enfeitar([linha]);

  const [rMensagens, rAnexos, rTipo] = await Promise.all([
    supabase
      .from("request_messages")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("request_attachments")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
    linha.request_type_id
      ? supabase.from("request_types").select("*").eq("id", linha.request_type_id).maybeSingle()
      : null,
  ]);

  const mensagensCruas = ouFalha("conversa do pedido", rMensagens) ?? [];
  const anexosCrus = ouFalha("anexos do pedido", rAnexos) ?? [];

  const idsDeAutor = [...new Set(mensagensCruas.map((m) => m.autor_id))];
  const rPessoas = idsDeAutor.length
    ? await supabase.from("profiles").select("id, nome, avatar_url").in("id", idsDeAutor)
    : null;
  const porPessoa = new Map(
    (rPessoas ? (ouFalha("autores da conversa", rPessoas) ?? []) : []).map((p) => [p.id, p]),
  );

  const assinados = await assinarArquivos(
    BUCKET_DOS_PEDIDOS,
    anexosCrus.map((a) => a.caminho),
  );

  return {
    ...base,
    mensagens: mensagensCruas.map((m) => ({ ...m, autor: porPessoa.get(m.autor_id) ?? null })),
    anexos: anexosCrus.map((a) => ({ ...a, assinado: enderecoDaArte(a.caminho, assinados) })),
    roteiro: rTipo ? (ouFalha("roteiro do pedido", rTipo) ?? null) : null,
  };
}

/**
 * Quantos pedidos esperam alguém — o selo da aba, e nada mais.
 *
 * **Conta só `nova` e `em_analise`**, e nunca o total: um pedido já em
 * produção não pede decisão nenhuma, e somá-lo faria o selo cobrar uma ação
 * que metade da fila não pede. É a decisão do selo de Aprovações Internas.
 *
 * **E o par "nenhum" não existe**: um selo com zero é a mesma linha com um
 * número a mais, e a ausência é a resposta.
 */
export async function quantosPedidosEsperando(): Promise<number> {
  const supabase = await criarClienteServidor();
  const r = await supabase
    .from("client_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["nova", "em_analise"]);

  if (r.error) {
    // Um selo que derruba a tela inteira é pior que um selo que não aparece —
    // ele é enfeite sobre uma navegação que precisa funcionar. `ouFalha` seria
    // a escolha errada aqui, e o mínimo para não falhar calado é o log.
    console.error("[consulta:contador de pedidos]", r.error);
    return 0;
  }
  return r.count ?? 0;
}

/** A conta aceita pedido? Lido pela tela do portal para desenhar o botão. */
export async function contaAceitaPedidos(clienteId: string): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const r = await supabase
    .from("clients")
    .select("aceita_solicitacoes")
    .eq("id", clienteId)
    .maybeSingle();

  const linha = ouFalha("a conta aceita pedidos", r);
  return linha?.aceita_solicitacoes ?? false;
}
