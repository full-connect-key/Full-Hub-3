import { ROTULOS_DE_STATUS } from "@/lib/dominio/tasks";
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

export const ROTULOS_DE_SUBTAREFA: Record<SubtaskStatus, string> = {
  nao_iniciada: "Iniciar",
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
  aguardando_informacoes: "Alguma subtarefa está parada esperando informação, e nenhuma está andando.",
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
  em_andamento: ["aguardando_informacoes", "enviada_aprovacao", "concluida", "nao_iniciada"],
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
export function podeIrPara(ctx: ContextoDaSubtarefa, destino: SubtaskStatus): Veredito {
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
    return nao(`Esta subtarefa exige aprovação ${tipo} e não pode ser concluída direto.`);
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
 *   requer_aprovacao = true, interna  → Enviar para aprovação
 *   requer_aprovacao = true, cliente  → Enviar para aprovação
 *
 * O responsável NUNCA vê "Concluir", "Entregar", "Finalizar" nem "Enviar para
 * o cliente" quando há aprovação — e não é só uma questão de layout: o banco
 * recusaria as duas coisas.
 */
export function acoesDaSubtarefa(ctx: ContextoDaSubtarefa): AcaoDeSubtarefa[] {
  const acoes: AcaoDeSubtarefa[] = [];
  const bloqueada = ctx.dependenciasAbertas.length > 0;
  const motivoDoBloqueio = bloqueada ? `Aguardando: ${ctx.dependenciasAbertas.join(", ")}` : undefined;

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

    if (ctx.status === "em_ajustes" || ctx.status === "aguardando_informacoes") {
      acoes.push({ id: "retomar", rotulo: "Retomar", principal: true, desabilitada: false });
    }

    if (ctx.status === "em_andamento") {
      if (ctx.requerAprovacao) {
        acoes.push({
          id: "enviar_aprovacao",
          rotulo: "Enviar para aprovação",
          principal: true,
          desabilitada: false,
        });
      } else {
        acoes.push({ id: "concluir", rotulo: "Concluir", principal: true, desabilitada: false });
      }
      acoes.push({
        id: "aguardar_informacoes",
        rotulo: "Marcar como aguardando informações",
        principal: false,
        desabilitada: false,
      });
    }
  }

  // Decisão: da gestão, e nunca de quem produziu.
  if (ctx.status === "enviada_aprovacao" && ctx.rodadaPendente) {
    const souOAutor = ctx.souOResponsavel;
    if (ctx.souGestor) {
      acoes.push({
        id: "aprovar",
        rotulo: "Aprovar",
        principal: true,
        desabilitada: souOAutor,
        motivo: souOAutor ? "Ninguém aprova a própria entrega." : undefined,
      });
      acoes.push({
        id: "solicitar_ajustes",
        rotulo: "Solicitar ajustes",
        principal: false,
        desabilitada: souOAutor,
        motivo: souOAutor ? "Ninguém decide a própria entrega." : undefined,
      });
    }
  }

  // "Enviar para o cliente" é do Desenvolvedor, e só depois do aval interno.
  //
  // `!souOResponsavel` não é excesso de zelo: quem produziu não manda material
  // ao cliente em circunstância nenhuma, nem sendo desenvolvedor. Quem deu o
  // aval interno já foi outra pessoa — é ela quem envia.
  if (
    ctx.souGestor &&
    !ctx.souOResponsavel &&
    ctx.requerAprovacao &&
    ctx.tipoAprovacao === "cliente" &&
    ctx.avalInterno &&
    !ctx.enviadaAoCliente &&
    ctx.status !== "concluida"
  ) {
    acoes.push({
      id: "enviar_cliente",
      rotulo: "Enviar para o cliente",
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

/**
 * O status da Task é calculado pelas subtarefas — arrastar no board não muda
 * isso. Só estes três não têm como ser derivados, e por isso são os únicos que
 * o arrasto aceita.
 */
export const STATUS_MANUAIS_DA_TASK: TaskStatus[] = [
  "entregue",
  "aguardando_informacoes",
];

export type ContextoDaTask = {
  status: TaskStatus;
  souGestorOuAtendimento: boolean;
  /** Título da subtarefa com aprovação pendente, se houver. */
  aprovacaoPendenteEm: string | null;
  temSubtarefaEmAjustes: boolean;
};

/**
 * Arrastar a Task para outra coluna.
 *
 * Recusa com o motivo por extenso — "Existe aprovação pendente na subtarefa
 * Criar KV" diz o que fazer; "transição inválida" não diz nada.
 */
export function podeMoverTaskPara(ctx: ContextoDaTask, destino: TaskStatus): Veredito {
  if (destino === ctx.status) return nao("A Task já está nesse status.");

  if (!ctx.souGestorOuAtendimento) {
    return nao("Mudar o status da Task é da gestão ou do Atendimento.");
  }

  if (!STATUS_MANUAIS_DA_TASK.includes(destino)) {
    return nao(
      `"${ROTULOS_DE_STATUS[destino]}" é calculado pelas subtarefas — não dá para marcar à mão. ` +
        "Mova as subtarefas, e a Task acompanha.",
    );
  }

  if (ctx.aprovacaoPendenteEm) {
    return nao(`Existe aprovação pendente na subtarefa ${ctx.aprovacaoPendenteEm}.`);
  }

  if (ctx.temSubtarefaEmAjustes) {
    return nao("Existe subtarefa em ajustes — a Task volta sozinha para Em ajustes.");
  }

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
  const avalFinal = tipo === "cliente" ? doCliente?.status === "aprovada" : avalInterno;

  return {
    rodadaAtual,
    rodadaPendente: rodadas.some((r) => r.status === "pendente"),
    avalInterno,
    avalFinal,
    enviadaAoCliente: doCliente !== undefined,
  };
}
