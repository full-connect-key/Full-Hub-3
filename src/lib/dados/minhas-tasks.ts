import "server-only";

import {
  enriquecer,
  type ItemDeCalendario,
  type Pessoa,
  type SubtarefaDetalhada,
  type TaskDaLista,
} from "./tasks";
import { fimDaSemanaNaAgencia, hojeNaAgencia } from "@/lib/dominio/datas";
import {
  agrupadoras,
  combinaComFoco,
  folhas,
  quemMaisEstaNa,
  situacaoDoPrazo,
  type FocoDoDia,
} from "@/lib/dominio/tasks";
import { situacaoDasRodadas } from "@/lib/tasks/state-machine";
import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ApprovalRound, Subtask, Task } from "@/lib/supabase/database.types";

/**
 * Consultas da tela Minhas Tasks.
 *
 * A regra é uma só, e é o coração do módulo: **o meu trabalho são as minhas
 * SUBTAREFAS.** A Task não tem responsável desde o Sprint 3B — ela é o
 * agrupador da demanda, e aparece aqui porque tem alguma etapa no meu nome.
 *
 * Consequência prática: a Task aparece UMA vez, mesmo quando tenho três
 * subtarefas nela, e os contadores de prazo olham para o prazo das minhas
 * subtarefas, nunca para o período da Task.
 */

export type MinhaSubtarefa = SubtarefaDetalhada & {
  /** O título da etapa de cima, quando esta é uma sub-etapa. É a linhagem que
   *  a lista mostra: "Campanha de verão › Arte". Vem daqui e não da tela
   *  porque a mãe é agrupadora e não entra em nenhuma das duas listas de
   *  subtarefas — ela deixou de ser trabalho no instante em que teve filha. */
  etapaDeCima: string | null;
  /**
   * A campanha de que esta etapa é a peça, quando ela é uma.
   *
   * -------------------------------------------------------------------------
   * **A PEÇA DE CAMPANHA JÁ ERA UMA ETAPA MINHA, e o que faltava era o
   * caminho de volta.** A 0051 decidiu que abrir a campanha cria a demanda com
   * uma etapa por entregável, no nome de quem vai produzi-la — então ela
   * aparece nesta lista desde então, com prazo, cronômetro e o botão certo. O
   * que ela não tinha era como dizer que é uma peça de campanha, nem como
   * levar à tela onde o arquivo sobe: o painel lateral daqui abre a DEMANDA, e
   * o material mora em `/painel/aprovacoes/campanhas/{id}`.
   *
   * Sem isto, quem produz lia "Lâmina A5" na lista, clicava, e caía numa tela
   * de demanda sem lugar nenhum para subir o PDF.
   * -------------------------------------------------------------------------
   *
   * **A pergunta é por `deliverables.subtask_id`**, a ponte que a 0033 criou e
   * a 0051 passou a escrever. Pelo caminho longo (`task → campaign`) a etapa
   * de uma campanha sem entregável responderia "sim" — e ela não é peça de
   * nada.
   */
  campanha: { id: string; nome: string } | null;
};

export type MinhaTask = TaskDaLista & {
  /** As subtarefas desta task que estão no meu nome. */
  minhasSubtarefas: MinhaSubtarefa[];
  /** As outras, em cinza, como contexto de quem mais está na demanda. */
  outrasSubtarefas: { id: string; titulo: string; status: Subtask["status"]; responsavel: Pessoa | null }[];
};

export type Prazos = {
  hoje: string;
  fimDaSemana: string;
  /** O instante do servidor, para o cronômetro das subtarefas começar de lá. */
  agora: number;
};

/**
 * A régua de datas, calculada uma vez no servidor.
 *
 * A semana termina no domingo, como no calendário do módulo. Passar estes dois
 * valores adiante (em vez de cada tela ler o relógio) é o que impede o
 * contador dizer "3 para hoje" e a lista mostrar 2 porque o navegador da
 * pessoa está em outro fuso.
 */
export function prazosDeHoje(): Prazos {
  const agora = new Date();
  return {
    // O FUSO É O DA AGÊNCIA, e não o do processo. O porquê está em
    // `lib/dominio/datas.ts`: com o do processo, das 21h à meia-noite toda
    // etapa que vence hoje passava a ler atrasada.
    hoje: hojeNaAgencia(agora),
    fimDaSemana: fimDaSemanaNaAgencia(agora),
    agora: agora.getTime(),
  };
}

/** As tasks que têm subtarefa minha, cada uma uma vez só. */
async function carregar(userId: string): Promise<MinhaTask[]> {
  const supabase = await criarClienteServidor();

  const minhasSubs = ouFalha(
    "as minhas etapas",
    await supabase.from("subtasks").select("*").eq("responsavel_id", userId),
  );

  const candidatas = (minhasSubs ?? []) as Subtask[];
  if (candidatas.length === 0) return [];

  const idsDeTasks = [...new Set(candidatas.map((s) => s.task_id))];

  const [tasks, todasAsSubs] = await Promise.all([
    // Rascunho fora, inclusive o meu: a etapa que eu rascunhei no nome de
    // alguém ainda não é trabalho de ninguém (migration 0028).
    supabase
      .from("tasks")
      .select("*")
      .in("id", idsDeTasks)
      .not("publicada_em", "is", null)
      .then((r) => ouFalha("as demandas das minhas etapas", r)),
    supabase
      .from("subtasks")
      .select("id, task_id, parent_id, titulo, status, responsavel_id, ordem")
      .in("task_id", idsDeTasks)
      .order("ordem")
      .then((r) => ouFalha("as etapas das minhas demandas", r)),
  ]);

  // O MEU TRABALHO SÃO AS FOLHAS. Uma etapa minha que ganhou sub-etapas deixou
  // de ser trabalho meu: quem executa são as filhas, e cada uma tem o próprio
  // dono. Ela sair daqui é o que faz o contador bater com a lista — a
  // agrupadora não tem prazo nem tempo próprios para contar.
  const ehAgrupadora = agrupadoras(todasAsSubs ?? []);
  const subtarefas = candidatas.filter((s) => !ehAgrupadora.has(s.id));
  if (subtarefas.length === 0) return [];

  const [rodadas, dependencias] = await Promise.all([
    supabase
      .from("approval_rounds")
      .select("*")
      .eq("content_type", "subtask")
      .in(
        "content_id",
        subtarefas.map((s) => s.id),
      )
      .order("numero_rodada", { ascending: false })
      .then((r) => ouFalha("as rodadas das minhas etapas", r)),
    supabase
      .from("subtask_dependencies")
      .select("subtask_id, depende_de_id")
      .in(
        "subtask_id",
        subtarefas.map((s) => s.id),
      )
      .then((r) => ouFalha("as dependências das minhas etapas", r)),
  ]);

  // A PEÇA DE CAMPANHA, numa ida só para todas as etapas — e não uma consulta
  // por linha, que é a diferença entre uma tela e trinta idas ao banco. É o
  // mesmo formato da consulta que o Social usa para trazer a etapa Programar
  // do mês inteiro de uma vez.
  const pecas = ouFalha(
    "as peças de campanha entre as minhas etapas",
    await supabase
      .from("deliverables")
      .select("subtask_id, campaign_id")
      .in(
        "subtask_id",
        subtarefas.map((s) => s.id),
      ),
  );

  // DUAS CONSULTAS, e não um embutido `campaigns(nome)`. O PostgREST recusa o
  // `select` INTEIRO quando não acha a relação pelo nome que a gente escreveu
  // — e o erro é jogado fora por quem não usa `ouFalha`, deixando a tela dizer
  // "nada aqui" com toda a confiança. Foi assim que uma campanha recém-criada
  // não aparecia em lugar nenhum. Duas idas ao banco custam menos que essa
  // classe de bug, e `database.types.ts` nem declara essa relação.
  const idsDeCampanha = [...new Set(((pecas ?? []) as { campaign_id: string }[]).map((p) => p.campaign_id))];
  const nomesDeCampanha = idsDeCampanha.length
    ? ouFalha(
        "os nomes das campanhas das minhas etapas",
        await supabase.from("campaigns").select("id, nome").in("id", idsDeCampanha),
      )
    : [];
  const nomePorCampanha = new Map((nomesDeCampanha ?? []).map((c) => [c.id, c.nome]));

  const campanhaPorSubtarefa = new Map<string, { id: string; nome: string }>();
  for (const peca of (pecas ?? []) as { subtask_id: string | null; campaign_id: string }[]) {
    if (!peca.subtask_id) continue;
    campanhaPorSubtarefa.set(peca.subtask_id, {
      id: peca.campaign_id,
      nome: nomePorCampanha.get(peca.campaign_id) ?? "Campanha",
    });
  }

  // As dos outros, como contexto — também só as folhas: ver "Arte" em cinza
  // ao lado de "Conceito" e "Layout", que são o que ela agrupa, é ver a mesma
  // coisa três vezes.
  const outras = folhas(todasAsSubs ?? []).filter((s) => s.responsavel_id !== userId);
  const idsDePessoas = [...new Set(outras.map((s) => s.responsavel_id).filter(Boolean))] as string[];

  const pessoas: Pessoa[] =
    idsDePessoas.length === 0
      ? []
      : ouFalha(
          "os nomes de quem divide a demanda comigo",
          await supabase.from("profiles").select("id, nome, avatar_url").in("id", idsDePessoas),
        );

  const eu = ouFalha(
    "a minha ficha",
    await supabase
      .from("profiles")
      .select("id, nome, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
  );

  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));
  const porId = new Map((todasAsSubs ?? []).map((s) => [s.id, s]));
  const enriquecidas = await enriquecer((tasks ?? []) as Task[]);

  const minhasPorTask = new Map<string, MinhaSubtarefa[]>();
  for (const sub of subtarefas) {
    const minhasRodadas = ((rodadas ?? []) as ApprovalRound[]).filter(
      (r) => r.content_id === sub.id,
    );
    const dependeDe = (dependencias ?? [])
      .filter((d) => d.subtask_id === sub.id)
      .map((d) => porId.get(d.depende_de_id))
      .filter(Boolean)
      .map((dep) => ({ id: dep!.id, titulo: dep!.titulo, status: dep!.status }));

    const detalhada: MinhaSubtarefa = {
      ...sub,
      etapaDeCima: sub.parent_id ? (porId.get(sub.parent_id)?.titulo ?? null) : null,
      campanha: campanhaPorSubtarefa.get(sub.id) ?? null,
      responsavel: (eu as Pessoa | null) ?? null,
      dependeDe,
      dependenciasAbertas: dependeDe.filter((d) => d.status !== "concluida").map((d) => d.titulo),
      // O painel pessoal não abre as rodadas em detalhe: ele precisa saber se
      // há uma esperando decisão para escolher o botão. O acordeão completo
      // fica no detalhe da Task.
      rodadas: minhasRodadas.map((r) => ({ ...r, solicitante: null, decisor: null })),
      entregas: [],
      ...situacaoDasRodadas(minhasRodadas, sub.tipo_aprovacao),
    };

    minhasPorTask.set(sub.task_id, [...(minhasPorTask.get(sub.task_id) ?? []), detalhada]);
  }

  return enriquecidas
    .filter((task) => (minhasPorTask.get(task.id) ?? []).length > 0)
    .map((task) => ({
    ...task,
    minhasSubtarefas: (minhasPorTask.get(task.id) ?? []).sort((a, b) => a.ordem - b.ordem),
    outrasSubtarefas: outras
      .filter((s) => s.task_id === task.id)
      .map((s) => ({
        id: s.id,
        titulo: s.titulo,
        status: s.status,
        responsavel: s.responsavel_id ? (porPessoa.get(s.responsavel_id) ?? null) : null,
      })),
    }));
}

/**
 * Uma task entra na lista quando alguma subtarefa minha combina com o foco, e
 * só as que combinam ficam visíveis — senão "Para hoje" traria junto a etapa
 * que vence semana que vem.
 */
function aplicarFoco(tasks: MinhaTask[], foco: FocoDoDia | null, prazos: Prazos): MinhaTask[] {
  if (!foco) return tasks;

  const resultado: MinhaTask[] = [];
  for (const task of tasks) {
    const combinam = task.minhasSubtarefas.filter((sub) =>
      combinaComFoco(
        situacaoDoPrazo(sub.prazo, sub.status === "concluida", prazos.hoje, prazos.fimDaSemana),
        foco,
      ),
    );
    if (combinam.length > 0) resultado.push({ ...task, minhasSubtarefas: combinam });
  }
  return resultado;
}

/**
 * Ordenação padrão: pelo prazo mais apertado entre as MINHAS subtarefas, e
 * quem não tem prazo por último. O período da Task não entra nessa conta.
 */
function meuPrazo(task: MinhaTask): string | null {
  const prazos = task.minhasSubtarefas
    .filter((s) => s.status !== "concluida")
    .map((s) => s.prazo)
    .filter(Boolean) as string[];
  if (prazos.length === 0) return null;
  return prazos.sort()[0];
}

function porPrazo(a: MinhaTask, b: MinhaTask): number {
  const pa = meuPrazo(a);
  const pb = meuPrazo(b);
  if (pa === pb) return a.titulo.localeCompare(b.titulo, "pt-BR");
  if (!pa) return 1;
  if (!pb) return -1;
  return pa.localeCompare(pb);
}

export async function minhasTasks(
  userId: string,
  foco: FocoDoDia | null = null,
  prazos: Prazos = prazosDeHoje(),
): Promise<MinhaTask[]> {
  const todas = await carregar(userId);
  return aplicarFoco(todas, foco, prazos).sort(porPrazo);
}

/**
 * Os três contadores do cabeçalho.
 *
 * Contam SUBTAREFAS minhas, não tasks: é a unidade de trabalho, e é o mesmo
 * conjunto que as listas mostram, calculado pela mesma função — é isso que faz
 * o número bater com a tela.
 */
export async function contadoresPessoais(
  userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<Record<FocoDoDia, number>> {
  const todas = await carregar(userId);
  const contagem: Record<FocoDoDia, number> = { atrasadas: 0, hoje: 0, semana: 0 };

  for (const task of todas) {
    for (const sub of task.minhasSubtarefas) {
      const situacao = situacaoDoPrazo(
        sub.prazo,
        sub.status === "concluida",
        prazos.hoje,
        prazos.fimDaSemana,
      );
      if (combinaComFoco(situacao, "atrasadas")) contagem.atrasadas += 1;
      if (combinaComFoco(situacao, "hoje")) contagem.hoje += 1;
      if (combinaComFoco(situacao, "semana")) contagem.semana += 1;
    }
  }

  return contagem;
}

/**
 * Os mesmos itens, no formato que o calendário compartilhado já entende.
 *
 * Só as subtarefas: cada uma no dia do prazo dela. O período da Task não
 * aparece aqui — na visão pessoal ele seria ruído, porque não é o que a pessoa
 * entrega.
 */
export async function itensPessoaisDoCalendario(
  userId: string,
  foco: FocoDoDia | null = null,
  prazos: Prazos = prazosDeHoje(),
): Promise<ItemDeCalendario[]> {
  const tasks = await minhasTasks(userId, foco, prazos);
  const itens: ItemDeCalendario[] = [];

  for (const task of tasks) {
    for (const sub of task.minhasSubtarefas) {
      if (!sub.prazo) continue;
      itens.push({
        chave: `subtarefa-${sub.id}`,
        tipo: "subtarefa",
        taskId: task.id,
        titulo: sub.titulo,
        // A LINHAGEM VALE AQUI TAMBÉM, e é o mesmo componente: duas etapas
        // chamadas "Layout" na mesma semana são dois trabalhos, e o nome da
        // demanda é o que diz de qual campanha é cada uma.
        demanda: task.titulo,
        prazo: sub.prazo,
        prioridade: sub.prioridade,
        status: task.status,
        concluida: sub.status === "concluida",
        responsavel: sub.responsavel,
        cliente: task.cliente?.nome_empresa ?? null,
      });
    }
  }

  return itens.sort((a, b) => a.prazo.localeCompare(b.prazo));
}

export type ItemDoDia = {
  chave: string;
  id: string;
  taskId: string;
  titulo: string;
  tituloDaMae: string;
  cliente: string | null;
  prazo: string | null;
  atrasada: boolean;
  estimativaMinutos: number | null;
  /**
   * O cronômetro, para "Meu dia" oferecer o mesmo número medido que o detalhe
   * da Task. Sem eles, concluir daqui cairia na estimativa e a mesma etapa
   * sugeriria dois tempos diferentes conforme a tela de onde foi concluída.
   */
  tempoMedidoSegundos: number;
  andandoDesde: string | null;
  /**
   * QUEM MAIS ESTÁ NA DEMANDA, uma vez cada — a pilha de avatares da linha.
   *
   * Não custa consulta: `carregar()` já traz as etapas dos outros com a ficha
   * de cada responsável desde o Sprint 4. Ver que a arte não saiu é o que
   * explica por que o agendamento está parado, e a pergunta seguinte —
   * *quem está com ela?* — não tinha resposta nesta tela.
   */
  outrosNaDemanda: Pessoa[];
  /** O que fazer com ela — vem da máquina de estados, não do palpite da tela. */
  requerAprovacao: boolean;
  tipoAprovacao: "interna" | "cliente" | null;
  dependenciasAbertas: string[];
  status: Subtask["status"];
};

/**
 * O widget "Meu dia": o que vence hoje e o que já passou do prazo.
 *
 * Deliberadamente curto — é a primeira coisa que a pessoa lê ao abrir a tela,
 * e serve para responder "o que eu entrego hoje?" sem rolagem.
 */
export async function meuDia(userId: string, prazos: Prazos = prazosDeHoje()): Promise<ItemDoDia[]> {
  const tasks = await carregar(userId);
  const itens: ItemDoDia[] = [];

  for (const task of tasks) {
    for (const sub of task.minhasSubtarefas) {
      const situacao = situacaoDoPrazo(
        sub.prazo,
        sub.status === "concluida",
        prazos.hoje,
        prazos.fimDaSemana,
      );
      if (situacao !== "atrasada" && situacao !== "hoje") continue;
      itens.push({
        chave: `subtarefa-${sub.id}`,
        id: sub.id,
        taskId: task.id,
        titulo: sub.titulo,
        tituloDaMae: task.titulo,
        cliente: task.cliente?.nome_empresa ?? null,
        prazo: sub.prazo,
        atrasada: situacao === "atrasada",
        estimativaMinutos: sub.estimativa_minutos,
        tempoMedidoSegundos: sub.tempo_medido_segundos,
        andandoDesde: sub.andando_desde,
        outrosNaDemanda: quemMaisEstaNa(task.outrasSubtarefas),
        requerAprovacao: sub.requer_aprovacao,
        tipoAprovacao: sub.tipo_aprovacao,
        dependenciasAbertas: sub.dependenciasAbertas,
        status: sub.status,
      });
    }
  }

  // Atrasado primeiro, depois por prazo: a ordem em que a pessoa deve atacar.
  return itens.sort((a, b) => {
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
    return (a.prazo ?? "").localeCompare(b.prazo ?? "");
  });
}

export type EtapaEmAndamento = {
  id: string;
  taskId: string;
  titulo: string;
  tituloDaMae: string;
  cliente: string | null;
  tempoMedidoSegundos: number;
  andandoDesde: string;
  /** Quantas OUTRAS estão com o relógio andando no meu nome agora. */
  outras: number;
};

/**
 * A ETAPA QUE ESTÁ COM O RELÓGIO ANDANDO AGORA, no meu nome.
 *
 * ---------------------------------------------------------------------------
 * **Ela NÃO sai de `meuDia()`, e a razão é a que faz esta consulta existir.**
 * Aquela lista é o que vence hoje e o que já passou do prazo — e o relógio
 * esquecido aberto quase nunca está numa etapa que vence hoje. Ele está na que
 * a pessoa começou às cinco da tarde de sexta, com prazo na quarta-feira
 * seguinte, e que passou o fim de semana correndo. Derivar daqui a lista de lá
 * mostraria o cartão exatamente nos casos em que ele não é necessário e o
 * esconderia no único em que ele é.
 * ---------------------------------------------------------------------------
 *
 * **São três consultas, e as três são pequenas** — bem menos que o `carregar()`
 * de Minhas Tasks, que traz demanda, rodada, dependência e a máquina de
 * estados inteira. Aqui a pergunta é uma só e a resposta é uma linha.
 *
 * **A agrupadora fica de fora**, como em todo lugar: o relógio dela não corre
 * (0022), e uma etapa que estava andando no instante em que ganhou a primeira
 * filha carrega o `andando_desde` antigo. Mostrá-la poria na primeira dobra da
 * Home um número que o produto inteiro diz que não conta.
 *
 * **E o rascunho fica de fora**, como em toda lista: a etapa que eu rascunhei
 * ainda não é trabalho de ninguém (0028).
 *
 * Mais de uma correndo é caso real — ninguém para a anterior ao começar a
 * seguinte —, e quem aparece é **a que está andando há mais tempo**, que é
 * justamente a esquecida. As outras viram contagem: repetir o cartão N vezes
 * na primeira dobra trocaria o aviso por uma segunda lista.
 */
export async function etapaEmAndamento(userId: string): Promise<EtapaEmAndamento | null> {
  const supabase = await criarClienteServidor();

  const correndo = (ouFalha(
    "as minhas etapas em andamento",
    await supabase
      .from("subtasks")
      .select("id, task_id, titulo, tempo_medido_segundos, andando_desde")
      .eq("responsavel_id", userId)
      .not("andando_desde", "is", null)
      // A mais antiga primeiro: é a que a pessoa esqueceu.
      .order("andando_desde", { ascending: true }),
  ) ?? []) as {
    id: string;
    task_id: string;
    titulo: string;
    tempo_medido_segundos: number;
    andando_desde: string | null;
  }[];

  if (correndo.length === 0) return null;

  const [comFilha, tasks] = await Promise.all([
    supabase
      .from("subtasks")
      .select("parent_id")
      .in("parent_id", correndo.map((s) => s.id))
      .then((r) => ouFalha("as sub-etapas das minhas etapas em andamento", r)),
    supabase
      .from("tasks")
      .select("id, titulo, client_id")
      .in("id", [...new Set(correndo.map((s) => s.task_id))])
      .not("publicada_em", "is", null)
      .then((r) => ouFalha("as demandas das minhas etapas em andamento", r)),
  ]);

  const agrupadora = new Set((comFilha ?? []).map((f) => f.parent_id).filter(Boolean) as string[]);
  const porId = new Map((tasks ?? []).map((t) => [t.id, t]));

  const validas = correndo.filter((s) => !agrupadora.has(s.id) && porId.has(s.task_id));
  const primeira = validas[0];
  if (!primeira || !primeira.andando_desde) return null;

  const mae = porId.get(primeira.task_id)!;

  let cliente: string | null = null;
  if (mae.client_id) {
    const empresa = ouFalha(
      "o cliente da minha etapa em andamento",
      await supabase
        .from("clients")
        .select("nome_empresa")
        .eq("id", mae.client_id)
        .limit(1),
    );
    cliente = empresa?.[0]?.nome_empresa ?? null;
  }

  return {
    id: primeira.id,
    taskId: primeira.task_id,
    titulo: primeira.titulo,
    tituloDaMae: mae.titulo,
    cliente,
    tempoMedidoSegundos: primeira.tempo_medido_segundos,
    andandoDesde: primeira.andando_desde,
    outras: validas.length - 1,
  };
}

/**
 * A pessoa logada pode criar task?
 *
 * Pergunta ao próprio banco, com `is_atendimento()`, em vez de repetir a regra
 * em TypeScript. É o que mantém o botão na tela e a policy do Postgres sempre
 * de acordo: se a regra mudar na migration, a tela acompanha sem alteração.
 *
 * Esconder o botão não é a proteção — a policy `tasks_insert` é. Isto só evita
 * oferecer um caminho que terminaria em erro.
 */
export async function souDoAtendimento(): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("is_atendimento");

  if (error) {
    console.error("[minhas-tasks] is_atendimento falhou:", error);
    return false;
  }
  return data === true;
}
