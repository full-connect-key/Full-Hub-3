import "server-only";

import { ouFalha } from "./consulta";

// PELO ALIAS, e não por caminho relativo: o gerador de protótipo troca
// `@/lib/dados/portal` por um stub através do `paths` do TypeScript, e um
// `./portal` escaparia da troca.
import { itensDoPortal } from "@/lib/dados/portal";
import { criarClienteServidor } from "@/lib/supabase/server";

import type {
  ApprovalRound,
  SubtaskEntrega,
  TipoDeConteudo,
} from "@/lib/supabase/database.types";

/**
 * O que o cliente vê no Portal.
 *
 * Só o que foi enviado a ele: rodadas de escopo `cliente`. A aprovação interna
 * inteira — quem pediu, quem aprovou, o que foi comentado — fica do lado de cá
 * da parede, e isso não é uma escolha desta consulta: as policies
 * `approval_rounds_select_cliente` e `subtasks_select_cliente` já recusam o
 * resto. Aqui só montamos o que passou.
 *
 * `clienteId` é para a visualização administrativa em /portal/{slug}. Para a
 * pessoa cliente ele é dispensável — o RLS já limita as linhas às empresas
 * dela. Para quem é da equipe, NÃO É: `is_staff()` enxerga todos os clientes,
 * e sem este filtro o portal da Mundo Verde mostraria as aprovações da Óptica
 * Visão. O isolamento por cliente continua valendo; o que muda é que aqui ele
 * precisa ser dito, porque quem pergunta tem permissão para ver mais.
 */

export type AprovacaoDoCliente = {
  rodadaId: string;
  /**
   * DE QUE FRENTE ELE É.
   *
   * **A fila cobre as TRÊS, e cobrir só uma era uma incoerência visível na
   * mesma tela.** Ela listava só o material que vem de uma demanda — o
   * comentário da consulta dizia, desde o Sprint 3B, que "post e entregável
   * entram nos Sprints 12 e 13", e eles entraram no produto sem entrar aqui.
   * O resultado: o selo da barra lateral contava 2 e o Início dizia "3
   * esperando você", a dois centímetros um do outro.
   *
   * **O que muda por frente é o que o card OFERECE**, não o que ele mostra:
   * o material de demanda traz os arquivos entregues, a conversa e os botões
   * de decidir — tudo o que se precisa para decidir está ali; o post e a peça
   * de campanha trazem um link, porque a decisão deles mora na tela em que a
   * arte abre grande, e decidir sem olhar é o erro que aquela tela existe
   * para evitar.
   */
  tipo: TipoDeConteudo;
  /** Onde o material abre, quando ele tem tela própria. Relativo à base. */
  caminho: string | null;
  subtaskId: string;
  titulo: string;
  /** A demanda a que o material pertence. */
  demanda: string;
  numeroRodada: number;
  /** O prazo da etapa, quando ela tem um. É por ele que a fila ordena. */
  prazo: string | null;
  status: ApprovalRound["status"];
  enviadaEm: string;
  decididaEm: string | null;
  comentario: string | null;
  entregas: SubtaskEntrega[];
  /** Os comentários que a agência marcou como visíveis ao cliente. */
  conversa: { id: string; texto: string; created_at: string; meu: boolean }[];
};

export async function minhasAprovacoes(
  usuarioId: string,
  clienteId?: string,
): Promise<{
  esperando: AprovacaoDoCliente[];
  decididas: AprovacaoDoCliente[];
}> {
  /* ------------------------------------------- AS DUAS METADES SÃO DUAS --
     E JUNTÁ-LAS NUM CAMINHO SÓ FOI O BUG, encontrado pelo usuário: o selo
     dizia 6 e a tela dizia "Nada esperando você", a dois centímetros um do
     outro — exatamente a incoerência que o sprint anterior existiu para
     desfazer, de volta pelo outro lado.

     A causa: a leitura da ETAPA desistia cedo — sem demanda do cliente, sem
     subtarefa, ou sem rodada de etapa nenhuma, ela devolvia a resposta
     INTEIRA vazia — e o bloco que monta o post e a peça de campanha vinha
     depois, então nunca rodava. Num banco em que toda rodada de cliente é de
     post, isso é a fila inteira sumindo.

     As duas perguntas são independentes: uma empresa pode ter social sem
     nenhuma demanda, e uma demanda sem nenhuma etapa que peça aval. Cada
     metade desiste por conta própria agora, devolvendo a lista dela vazia —
     nunca a resposta das duas. */
  const [montadas, outros] = await Promise.all([
    aprovacoesDeEtapa(usuarioId, clienteId),
    materiaisDasOutrasFrentes(clienteId),
  ]);

  return {
    // A FILA ORDENA POR PRAZO, e não pela ordem em que as coisas chegaram.
    //
    // A consulta traz por `solicitado_em` decrescente, que é a ordem certa
    // para o HISTÓRICO — o que foi decidido por último em cima — e a errada
    // para a fila: o material que vence amanhã ficava embaixo do que chegou
    // hoje e vence semana que vem. É a decisão da caixa de entrada das
    // solicitações, virada: lá a pergunta é quem espera há mais tempo, aqui é
    // o que vence primeiro.
    //
    // **Sem prazo vai para o FIM**, nunca para o topo: um material sem data é
    // o que menos cobra, e `null` ordenado como string o poria na frente de
    // tudo. É a regra de `focoDoPrazo` e de `ordenarPorUrgencia`.
    esperando: [
      ...montadas.filter((a) => a.status === "pendente"),
      ...outros,
    ].sort(porUrgencia),
    decididas: montadas.filter((a) => a.status !== "pendente"),
  };
}

/**
 * O material que vem de uma DEMANDA: a etapa com rodada de escopo cliente.
 *
 * Ela é a única das três frentes que traz os arquivos entregues e a conversa,
 * porque é a única que decide aqui dentro — o post e a peça de campanha
 * decidem na tela em que a arte abre grande.
 *
 * **Ela desiste devolvendo `[]` e nunca a resposta inteira**: as outras duas
 * frentes são perguntas separadas, e a ausência desta não diz nada sobre elas.
 */
async function aprovacoesDeEtapa(
  usuarioId: string,
  clienteId?: string,
): Promise<AprovacaoDoCliente[]> {
  const supabase = await criarClienteServidor();

  // Com cliente definido, a pergunta começa pelas tasks dele: assim o filtro
  // acontece no banco, e não depois de trazer o que não interessa.
  let idsPermitidos: string[] | null = null;
  if (clienteId) {
    const tasksDoCliente = ouFalha(
      "as demandas da empresa",
      await supabase.from("tasks").select("id").eq("client_id", clienteId),
    );

    const ids = tasksDoCliente.map((t) => t.id);
    if (ids.length === 0) return [];

    const subtarefasDoCliente = ouFalha(
      "as etapas das demandas da empresa",
      await supabase.from("subtasks").select("id").in("task_id", ids),
    );

    idsPermitidos = subtarefasDoCliente.map((s) => s.id);
    if (idsPermitidos.length === 0) return [];
  }

  let consulta = supabase
    .from("approval_rounds")
    .select("*")
    .eq("escopo", "cliente")
    // Idem: esta tela monta cada item a partir de uma subtarefa. Post e
    // entregável entram nos Sprints 12 e 13, com a consulta deles.
    .eq("content_type", "subtask");
  if (idsPermitidos) consulta = consulta.in("content_id", idsPermitidos);

  const rodadas = ouFalha(
    "as aprovações do cliente",
    await consulta.order("solicitado_em", { ascending: false }),
  );

  const todas = rodadas as ApprovalRound[];
  if (todas.length === 0) return [];

  const idsDeSubtarefas = [...new Set(todas.map((r) => r.content_id))];

  const [respostaDeSubtarefas, respostaDeEntregas] = await Promise.all([
    supabase
      .from("subtasks")
      .select("id, task_id, titulo, prazo")
      .in("id", idsDeSubtarefas),
    supabase
      .from("subtask_entregas")
      .select("*")
      .in("subtask_id", idsDeSubtarefas),
  ]);
  const subtarefas = ouFalha("as etapas em aprovação", respostaDeSubtarefas);
  const entregas = ouFalha("os arquivos entregues", respostaDeEntregas);

  const idsDeTasks = [...new Set(subtarefas.map((s) => s.task_id))];

  const [respostaDeTasks, respostaDeComentarios] = await Promise.all([
    idsDeTasks.length
      ? supabase.from("tasks").select("id, titulo").in("id", idsDeTasks)
      : Promise.resolve({
          data: [] as { id: string; titulo: string }[],
          error: null,
        }),
    supabase
      .from("task_comentarios")
      .select("id, subtask_id, autor_id, texto, created_at")
      .eq("interno", false)
      .in("subtask_id", idsDeSubtarefas)
      .order("created_at"),
  ]);
  const tasks = ouFalha("as demandas em aprovação", respostaDeTasks);
  const comentarios = ouFalha(
    "a conversa de cada material",
    respostaDeComentarios,
  );

  const porSubtarefa = new Map(subtarefas.map((s) => [s.id, s]));
  const porTask = new Map(tasks.map((t) => [t.id, t]));

  const montar = (rodada: ApprovalRound): AprovacaoDoCliente | null => {
    const sub = porSubtarefa.get(rodada.content_id);
    if (!sub) return null;
    return {
      rodadaId: rodada.id,
      tipo: "subtask",
      caminho: null,
      subtaskId: sub.id,
      titulo: sub.titulo,
      demanda: porTask.get(sub.task_id)?.titulo ?? "",
      numeroRodada: rodada.numero_rodada,
      prazo: sub.prazo,
      status: rodada.status,
      enviadaEm: rodada.solicitado_em,
      decididaEm: rodada.decidido_em,
      comentario: rodada.comentario,
      entregas: entregas.filter((e) => e.subtask_id === sub.id),
      conversa: comentarios
        .filter((c) => c.subtask_id === sub.id)
        .map((c) => ({
          id: c.id,
          texto: c.texto,
          created_at: c.created_at,
          meu: c.autor_id === usuarioId,
        })),
    };
  };

  return todas.map(montar).filter(Boolean) as AprovacaoDoCliente[];
}

/**
 * O POST E A PEÇA DE CAMPANHA, no mesmo molde.
 *
 * **Eles vêm de `itensDoPortal`, que já os agrega** — e não de duas consultas
 * novas aqui: uma segunda leitura nomeando as mesmas colunas seria o lugar
 * onde as duas divergem, e a que divergiria é esta, que a equipe quase nunca
 * abre.
 *
 * `rodadaId` preenchido é o que define "esperando": ele só existe quando a
 * rodada corrente está PENDENTE. E a fatia `subtask` fica de fora, porque ela
 * vem inteira do outro lado, com os arquivos e a conversa — somar as duas
 * poria o mesmo material duas vezes na mesma lista.
 *
 * **Só o que espera decisão**, e a ausência das decididas é consequência e não
 * esquecimento: o que diz que a rodada corrente está pendente é o `rodadaId`,
 * e a decidida não traz nenhum. O histórico delas mora na tela de cada
 * material, que é onde a arte abre grande.
 */
async function materiaisDasOutrasFrentes(
  clienteId?: string,
): Promise<AprovacaoDoCliente[]> {
  return (await itensDoPortal(clienteId))
    .filter((item) => item.tipo !== "subtask" && item.rodadaId)
    .map(
      (item): AprovacaoDoCliente => ({
        rodadaId: item.rodadaId!,
        tipo: item.tipo,
        caminho: item.caminho,
        // SEM SUBTAREFA, e o campo fica vazio em vez de inventar um id: ele é
        // a chave do material de demanda, e aqui não há um.
        subtaskId: "",
        titulo: item.titulo,
        demanda: item.demanda,
        // A RODADA é a corrente, e o número dela não viaja em `ItemDoPortal`.
        // Um número inventado apareceria como "Rodada 1" numa peça que já foi
        // e voltou três vezes — e a tela esconde o selo quando ele é zero.
        numeroRodada: 0,
        prazo: item.prazo,
        status: "pendente",
        enviadaEm: item.enviadoEm ?? "",
        decididaEm: null,
        comentario: null,
        // OS ARQUIVOS E A CONVERSA FICAM VAZIOS DE PROPÓSITO: eles moram na
        // tela do material, que é onde a arte abre grande. Trazê-los para cá
        // seria oferecer a decisão sem a peça, que é o erro que aquela tela
        // existe para evitar.
        entregas: [],
        conversa: [],
      }),
    );
}

/** Prazo crescente, e quem não tem prazo no fim. */
function porUrgencia(a: AprovacaoDoCliente, b: AprovacaoDoCliente): number {
  if (a.prazo !== b.prazo) {
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return a.prazo.localeCompare(b.prazo);
  }
  // O DESEMPATE É A CHEGADA, da mais antiga para a mais nova: entre dois
  // materiais que vencem no mesmo dia, o que está esperando há mais tempo vem
  // primeiro.
  return a.enviadaEm.localeCompare(b.enviadaEm);
}

/**
 * QUANTOS MATERIAIS ESPERAM A DECISÃO — o número do selo de Aprovações.
 *
 * ---------------------------------------------------------------------------
 * **O selo existia na barra lateral desde que ela nasceu, e nada o alimentava.**
 * O comentário de `ListaDaBarraDoPortal` dizia que ele seria ligado "quando a
 * tela de Aprovações entrar" — e ela já estava lá. Mais uma ponte construída e
 * não atravessada.
 *
 * **É UMA CONTAGEM E NÃO `minhasAprovacoes()`**, que é a razão de ela existir:
 * aquela função faz seis idas ao banco e monta a conversa de cada material,
 * e esta roda no LAYOUT — ou seja, em toda tela do portal. O que o selo
 * precisa é de um número.
 *
 * **E ela conta exatamente o que a fila lista**, `content_type = 'subtask'` e
 * escopo cliente: um selo que cobrasse mais do que a tela de destino mostra
 * mandaria a pessoa procurar um material que não está lá.
 *
 * **E ELA NÃO RECEBE `clienteId`**, de propósito: quem a chama é o layout do
 * portal do CLIENTE, onde a RLS já recorta as linhas dele. A casca da
 * visualização administrativa não desenha selo nenhum — e se um dia
 * desenhar, o recorte por empresa precisa de um filtro por tipo de conteúdo
 * que esta contagem não tem. Não aceitar o parâmetro é o que impede alguém de
 * passá-lo achando que ele funciona.
 *
 * **Ela não derruba a tela**, e é a decisão de `rotinasAgendadas()`: o portal
 * funciona inteiro sem o selo, e trocar uma informação a menos por uma falha
 * total seria o pior dos dois. O erro vai para o log, senão um selo que
 * parasse de aparecer para todo mundo seria descoberto por alguém perguntando
 * à agência se o material chegou.
 * ---------------------------------------------------------------------------
 */
export async function quantasEsperamDecisao(): Promise<number> {
  const supabase = await criarClienteServidor();

  // AS TRÊS FRENTES, e não só `subtask`: o selo conta o que a fila lista, e
  // ela passou a listar as três. Contar uma só fazia o selo dizer 2 numa tela
  // em que o Início dizia "3 esperando você".
  const { count, error } = await supabase
    .from("approval_rounds")
    .select("id", { count: "exact", head: true })
    .eq("escopo", "cliente")
    .eq("status", "pendente");

  if (error) {
    console.error("[consulta:o selo de aprovações do portal]", error);
    return 0;
  }
  return count ?? 0;
}
