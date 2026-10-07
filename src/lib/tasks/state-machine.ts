import type {
  EscopoRodada,
  StatusRodada,
  SubtaskStatus,
  TaskStatus,
  TipoAprovacao,
} from "@/lib/supabase/database.types";

/**
 * A máquina de estados da subtarefa e da Task.
 *
 * Esta é a cópia que a INTERFACE lê para saber qual botão mostrar. A cópia que
 * vale está no banco, na migration 0007: triggers que recusam a transição
 * inválida mesmo quando o pedido chega montado à mão contra a API do Supabase.
 * As duas existem de propósito — esconder o botão não é regra de negócio, e
 * mostrar um botão que o banco vai recusar é pior ainda.
 *
 * Toda função aqui é pura: a mesma conta serve ao componente e à Server Action
 * que valida de novo antes de gravar.
 */

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

export const STATUS_DE_SUBTAREFA: SubtaskStatus[] = [
  "nao_iniciada",
  "em_andamento",
  "aguardando_informacoes",
  "enviada_aprovacao",
  "em_ajustes",
  "concluida",
];

/**
 * O rótulo do ESTADO da subtarefa, que não é o rótulo do BOTÃO.
 *
 * "Não iniciada" e não "Iniciar", ao contrário do status da Task: aqui o selo
 * fica ao lado do botão de ação, e o botão dessa etapa se chama exatamente
 * "Iniciar". Os dois com a mesma palavra viravam duas vezes a mesma coisa na
 * mesma linha — foi a imagem do protótipo que mostrou. Na Task o rótulo é
 * "Iniciar" porque lá ele é o CABEÇALHO DA COLUNA do board: a coluna de onde
 * a demanda sai, sem botão nenhum concorrendo ao lado.
 */
export const ROTULOS_DE_SUBTAREFA: Record<SubtaskStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  aguardando_informacoes: "Aguardando informações",
  enviada_aprovacao: "Enviada para aprovação",
  em_ajustes: "Em ajustes",
  concluida: "Concluída",
};

/**
 * "Entregue" e "Aprovado" são coisas diferentes, e é aqui que o texto precisa
 * deixar isso claro: `entregue` diz que o material saiu, não que alguém o
 * validou. Estas frases vão para o tooltip de cada status.
 */
export const EXPLICACAO_DO_STATUS: Record<TaskStatus, string> = {
  nao_iniciada: "Nenhuma subtarefa começou.",
  em_andamento: "Alguma subtarefa está em andamento ou já foi concluída.",
  aguardando_informacoes:
    "Alguma subtarefa está parada esperando informação, e nenhuma está andando.",
  entregue: "Marcado à mão: o material saiu. Não quer dizer que foi aprovado.",
  em_aprovacao: "Existe uma rodada de aprovação esperando decisão.",
  em_ajustes: "Alguma subtarefa voltou com pedido de ajustes.",
  concluido: "Todas as subtarefas concluídas e nenhuma aprovação pendente.",
  // Saiu do produto na 0020. Fica aqui só para o `Record` fechar e para uma
  // linha antiga ter tooltip em vez de vazio — nenhuma lista a oferece, e o
  // trigger recusa gravá-la.
  cancelada: "Status retirado do produto.",
};

export const ROTULO_DA_APROVACAO: Record<TipoAprovacao, string> = {
  interna: "Interna",
  cliente: "Cliente",
};

export const ROTULO_DO_ESCOPO: Record<EscopoRodada, string> = {
  interna: "Interna",
  cliente: "Cliente",
};

// ---------------------------------------------------------------------------
// Transições da subtarefa
// ---------------------------------------------------------------------------

/**
 * Para onde cada status pode ir. `concluida` não aparece como destino de
 * `enviada_aprovacao` por acaso: quando existe aprovação, a conclusão não é um
 * movimento de quem executa, é o resultado de uma decisão de outra pessoa.
 */
const DESTINOS: Record<SubtaskStatus, SubtaskStatus[]> = {
  nao_iniciada: ["em_andamento", "aguardando_informacoes"],
  em_andamento: [
    "aguardando_informacoes",
    "enviada_aprovacao",
    "concluida",
    "nao_iniciada",
  ],
  aguardando_informacoes: ["em_andamento"],
  enviada_aprovacao: ["concluida", "em_ajustes"],
  em_ajustes: ["em_andamento"],
  concluida: ["em_andamento"],
};

export type ContextoDaSubtarefa = {
  status: SubtaskStatus;
  requerAprovacao: boolean;
  tipoAprovacao: TipoAprovacao | null;
  /** Quem está olhando é o responsável por ela? */
  souOResponsavel: boolean;
  /** Quem está olhando é desenvolvedor ou sócio? */
  souGestor: boolean;
  /**
   * Ela é uma FASE do mês de social (`subtasks.social_papel` preenchido)?
   *
   * Quem fecha uma fase é a última caixinha dela, e não a mão de ninguém
   * (0093). Sem este campo o botão "Concluir" apareceria ligado numa fase com
   * dezoito peças em aberto e o banco recusaria o clique — que é a frase do
   * cabeçalho desta função: o botão não é questão de layout, ele não pode
   * oferecer o que o banco recusa.
   */
  faseDeSocial?: boolean;
  /** Títulos das dependências que ainda não terminaram. Vazio = liberada. */
  dependenciasAbertas: string[];
  /** Existe rodada esperando decisão? */
  rodadaPendente: boolean;
  /** A rodada atual já passou pelo aval interno? */
  avalInterno: boolean;
  /** Já existe a decisão final do tipo exigido (interna, ou do cliente)? */
  avalFinal: boolean;
  /** A rodada atual já foi enviada ao cliente? */
  enviadaAoCliente: boolean;
};

export type Veredito = { ok: true } | { ok: false; motivo: string };

const SIM: Veredito = { ok: true };
const nao = (motivo: string): Veredito => ({ ok: false, motivo });

/**
 * Esta transição é legítima?
 *
 * Espelha, uma a uma, as quatro regras invioláveis que o trigger
 * `validar_transicao_de_subtarefa` aplica no banco.
 */
export function podeIrPara(
  ctx: ContextoDaSubtarefa,
  destino: SubtaskStatus,
): Veredito {
  if (destino === ctx.status) return nao("A subtarefa já está nesse status.");

  if (!DESTINOS[ctx.status].includes(destino)) {
    return nao(
      `Não dá para ir de "${ROTULOS_DE_SUBTAREFA[ctx.status]}" para "${ROTULOS_DE_SUBTAREFA[destino]}".`,
    );
  }

  if (ctx.status === "nao_iniciada" && ctx.dependenciasAbertas.length > 0) {
    return nao(`Aguardando: ${ctx.dependenciasAbertas.join(", ")}.`);
  }

  if (destino === "concluida" && ctx.requerAprovacao && !ctx.avalFinal) {
    const tipo = ctx.tipoAprovacao === "cliente" ? "do cliente" : "interna";
    return nao(
      `Esta subtarefa exige aprovação ${tipo} e não pode ser concluída direto.`,
    );
  }

  if (destino === "enviada_aprovacao" && !ctx.rodadaPendente) {
    return nao("Não existe rodada de aprovação pendente.");
  }

  if (destino === "em_ajustes" && !ctx.rodadaPendente && !ctx.avalInterno) {
    return nao("Nenhuma rodada pediu ajustes.");
  }

  return SIM;
}

// ---------------------------------------------------------------------------
// Os botões
// ---------------------------------------------------------------------------

export type IdDeAcao =
  | "iniciar"
  | "retomar"
  | "aguardar_informacoes"
  | "concluir"
  | "enviar_aprovacao"
  | "aprovar"
  | "solicitar_ajustes"
  | "enviar_cliente";

export type AcaoDeSubtarefa = {
  id: IdDeAcao;
  rotulo: string;
  /** `principal` é o botão em destaque da linha; o resto vai no menu. */
  principal: boolean;
  desabilitada: boolean;
  /** Por que está desabilitada, para o tooltip. */
  motivo?: string;
};

/**
 * Quais botões aparecem, para quem está olhando.
 *
 * A tabela da Parte 3.2 do sprint, em código:
 *
 *   requer_aprovacao = false          → Concluir
 *   requer_aprovacao = true, interna  → Pedir aval interno
 *   requer_aprovacao = true, cliente  → Pedir aval interno
 *
 * O responsável NUNCA vê "Concluir", "Entregar", "Finalizar" nem "Enviar para
 * o cliente" quando há aprovação — e não é só uma questão de layout: o banco
 * recusaria as duas coisas.
 */
export function acoesDaSubtarefa(ctx: ContextoDaSubtarefa): AcaoDeSubtarefa[] {
  const acoes: AcaoDeSubtarefa[] = [];
  const bloqueada = ctx.dependenciasAbertas.length > 0;
  const motivoDoBloqueio = bloqueada
    ? `Aguardando: ${ctx.dependenciasAbertas.join(", ")}`
    : undefined;

  const podeAgir = ctx.souOResponsavel || ctx.souGestor;

  if (podeAgir) {
    if (ctx.status === "nao_iniciada") {
      acoes.push({
        id: "iniciar",
        rotulo: "Iniciar",
        principal: true,
        desabilitada: bloqueada,
        motivo: motivoDoBloqueio,
      });
    }

    if (
      ctx.status === "em_ajustes" ||
      ctx.status === "aguardando_informacoes"
    ) {
      acoes.push({
        id: "retomar",
        rotulo: "Retomar",
        principal: true,
        desabilitada: false,
      });
    }

    if (ctx.status === "em_andamento") {
      if (ctx.requerAprovacao) {
        acoes.push({
          id: "enviar_aprovacao",
          rotulo: "Pedir aval interno",
          principal: true,
          desabilitada: false,
        });
      } else {
        // A FASE DO MÊS NÃO SE CONCLUI À MÃO (0093), e o botão aparece
        // DESLIGADO com a razão em vez de sumir: um botão que some ensina que
        // não existe; um desligado que diz por quê ensina a regra — a mesma
        // decisão do "Enviar ao cliente" do Social Media.
        //
        // E a regra é do banco: `subtasks_fase_fecha_pelas_caixinhas` recusa,
        // contando quantas peças faltam. Aqui a frase é escrita antes do
        // clique, e as duas saíram no mesmo commit — a lição da 0029.
        acoes.push({
          id: "concluir",
          rotulo: "Concluir",
          principal: true,
          desabilitada: Boolean(ctx.faseDeSocial),
          motivo: ctx.faseDeSocial
            ? "Ela fecha sozinha quando a última peça for marcada, no painel de cada post dentro do mês."
            : undefined,
        });
      }
      acoes.push({
        id: "aguardar_informacoes",
        rotulo: "Marcar como aguardando informações",
        principal: false,
        desabilitada: false,
      });
    }
  }

  // Decisão: da gestão, e de mais ninguém.
  //
  // **INCLUSIVE do próprio responsável** (migration 0029, decisão do
  // usuário). Era a única pergunta que sobrava depois de `souGestor`, e ela
  // saiu: numa equipe em que o desenvolvedor é quem executa e quem valida,
  // exigir outra pessoa parava o trabalho. O que se perde está escrito no
  // cabeçalho da 0029 — a rodada deixa de ser checagem independente e passa a
  // ser registro de quem decidiu, quando e com que comentário.
  if (
    ctx.status === "enviada_aprovacao" &&
    ctx.rodadaPendente &&
    ctx.souGestor
  ) {
    acoes.push({
      id: "aprovar",
      rotulo: "Aprovar",
      principal: true,
      desabilitada: false,
    });
    acoes.push({
      id: "solicitar_ajustes",
      rotulo: "Solicitar ajustes",
      principal: false,
      desabilitada: false,
    });
  }

  // "Enviar ao cliente" é da gestão, e só depois do aval interno.
  //
  // **É UMA PERGUNTA SÓ desde a 0060**, e aqui ela era duas: havia um
  // `!souOResponsavel` ao lado do `souGestor`. Aquela migration tirou a
  // segunda pergunta dos TRÊS ramos de `validar_nova_rodada` — subtarefa
  // inclusive —, e este lado ficou para trás: o desenvolvedor dono de uma
  // etapa que pede aval do cliente não via o botão, embora o banco aceitasse
  // o clique dele. O motivo está no cabeçalho da 0060 e no CLAUDE.md, fora de
  // `src/`, porque `check:cores` varre a frase que saiu.
  //
  // **É a lição da 0029 na direção contrária.** Lá a bateria ficou verde com
  // a action ainda recusando; aqui o banco liberou e a TELA continuou
  // escondendo — o mesmo furo, com o lado que sobrou invertido. E a varredura
  // não pegou porque o comentário dizia a mesma coisa com outras palavras;
  // ela ganhou essa forma também.
  //
  // A regra que o usuário pediu continua inteira: `souGestor` já recusa todo
  // colaborador, dono do material ou não.
  if (
    ctx.souGestor &&
    ctx.requerAprovacao &&
    ctx.tipoAprovacao === "cliente" &&
    ctx.avalInterno &&
    !ctx.enviadaAoCliente &&
    ctx.status !== "concluida"
  ) {
    acoes.push({
      id: "enviar_cliente",
      rotulo: "Enviar ao cliente",
      principal: true,
      desabilitada: false,
    });
  }

  return acoes;
}

/** O destino de cada ação que muda o status da subtarefa direto. */
export const DESTINO_DA_ACAO: Partial<Record<IdDeAcao, SubtaskStatus>> = {
  iniciar: "em_andamento",
  retomar: "em_andamento",
  aguardar_informacoes: "aguardando_informacoes",
  concluir: "concluida",
  enviar_aprovacao: "enviada_aprovacao",
};

// ---------------------------------------------------------------------------
// A Task
// ---------------------------------------------------------------------------

export type ContextoDaTask = {
  status: TaskStatus;
  souGestorOuAtendimento: boolean;
};

/**
 * Arrastar a Task para outra coluna.
 *
 * Recusa com o motivo por extenso — "Existe aprovação pendente na subtarefa
 * Criar KV" diz o que fazer; "transição inválida" não diz nada.
 */
export function podeMoverTaskPara(
  ctx: ContextoDaTask,
  destino: TaskStatus,
): Veredito {
  if (destino === ctx.status) return nao("A Task já está nesse status.");

  if (!ctx.souGestorOuAtendimento) {
    return nao("Mudar o status da Task é da gestão ou do Atendimento.");
  }

  // OS SETE SÃO MARCÁVEIS (migration 0025). Antes só `entregue` e
  // `aguardando_informacoes` passavam, e os outros cinco eram recusados com
  // "é calculado pelas subtarefas". Decisão do usuário: todos se marcam à
  // mão, e `status_manual` é o que faz a escolha durar — sem ele, aceitar o
  // arrasto e desfazê-lo na próxima mexida numa etapa seria pior que recusar.
  //
  // As recusas por aprovação pendente e por etapa em ajustes saíram junto,
  // pela mesma razão: elas existiam porque o recálculo ia desfazer o arrasto.
  // Não desfaz mais.
  //
  // O que CONTINUA de pé é a trava do banco: marcar `entregue` segue exigindo
  // que toda etapa que pede aval tenha a rodada aprovada dela
  // (`tasks_entregue_exige_cada_etapa`, 0023). Poder escolher o status não é
  // poder afirmar que o cliente aprovou.
  return SIM;
}

// ---------------------------------------------------------------------------
// Leitura das rodadas
// ---------------------------------------------------------------------------

export type RodadaResumida = {
  numero_rodada: number;
  escopo: EscopoRodada;
  status: StatusRodada;
};

export type SituacaoDasRodadas = {
  /** O número da rodada em curso. 0 quando ainda não houve nenhuma. */
  rodadaAtual: number;
  /** Alguma rodada esperando decisão. */
  rodadaPendente: boolean;
  /** A rodada atual já passou pelo aval interno. */
  avalInterno: boolean;
  /** Já existe a decisão final que o tipo exige. */
  avalFinal: boolean;
  /** A rodada atual já foi enviada ao cliente. */
  enviadaAoCliente: boolean;
};

/**
 * O estado das aprovações de uma subtarefa, lido das rodadas.
 *
 * Pura de propósito: a camada de dados usa para montar a linha, e o gerador de
 * protótipo usa a mesma função sobre dados de exemplo — assim o protótipo
 * mostra o mesmo botão que o app mostraria.
 *
 * "Rodada atual" é sempre a de maior número. Rodada anterior não é apagada
 * nem sobrescrita: ela continua no banco com o que foi pedido e decidido, e é
 * disso que o acordeão do histórico é feito.
 */
export function situacaoDasRodadas(
  rodadas: RodadaResumida[],
  tipo: TipoAprovacao | null,
): SituacaoDasRodadas {
  if (rodadas.length === 0) {
    return {
      rodadaAtual: 0,
      rodadaPendente: false,
      avalInterno: false,
      avalFinal: false,
      enviadaAoCliente: false,
    };
  }

  const rodadaAtual = Math.max(...rodadas.map((r) => r.numero_rodada));
  const daAtual = rodadas.filter((r) => r.numero_rodada === rodadaAtual);

  const interna = daAtual.find((r) => r.escopo === "interna");
  const doCliente = daAtual.find((r) => r.escopo === "cliente");

  const avalInterno = interna?.status === "aprovada";
  const avalFinal =
    tipo === "cliente" ? doCliente?.status === "aprovada" : avalInterno;

  return {
    rodadaAtual,
    rodadaPendente: rodadas.some((r) => r.status === "pendente"),
    avalInterno,
    avalFinal,
    enviadaAoCliente: doCliente !== undefined,
  };
}
