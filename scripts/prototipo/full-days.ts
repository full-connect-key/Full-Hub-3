/**
 * Versao de prototipo de src/lib/dados/full-days.ts.
 *
 * O conjunto foi montado para as quatro abas mostrarem o que importa sem
 * ninguem precisar clicar em nada antes:
 *
 *   - a Marina (Criacao) de FERIAS APROVADAS, que pintam a matriz de roxo e
 *     bloqueiam aqueles dias no calendario do Rafael, da mesma area;
 *   - o Rafael com um pedido PENDENTE que se sobrepoe ao dela -- e o aviso
 *     "quem mais da area esta fora" na fila do socio;
 *   - a Ana com 14 meses sem ferias, para o alerta de risco trabalhista
 *     aparecer no relatorio;
 *   - um dia de remoto marcado a mao, que e o outro caminho da matriz.
 *
 * Tudo relativo a hoje: datas fixas envelhecem e, semanas depois, o prototipo
 * mostra "ferias" num passado que ninguem reconhece.
 */
import type {
  HrRequest,
  HrStatus,
  PresencaStatus,
} from "@/lib/supabase/database.types";
import type {
  LinhaDaMatriz,
  LinhaDoRelatorio,
  PessoaDoTime,
  SolicitacaoNaTela,
} from "../../src/lib/dados/full-days";

export type { LinhaDaMatriz, LinhaDoRelatorio, PessoaDoTime, SolicitacaoNaTela };

function emDias(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Um dia do MES CORRENTE, fixo.
 *
 * As ferias do exemplo precisam cair no mes que a matriz abre. Com "daqui a 14
 * dias", rodar o prototipo no dia 22 joga tudo para o mes seguinte e a matriz
 * nasce sem nenhuma ferias -- que e exatamente o que ela existe para mostrar.
 */
function nesteMes(dia: number): string {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${hoje.getFullYear()}-${mes}-${String(dia).padStart(2, "0")}`;
}

function mesesAtras(meses: number): string {
  const data = new Date();
  data.setMonth(data.getMonth() - meses);
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

const TIME: PessoaDoTime[] = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    nome: "Ana Souza",
    avatarUrl: null,
    area: "Direção",
    cargo: "Sócia-diretora",
    diasFeriasAno: 15,
    maxParcelas: 2,
  },
  {
    id: "a0000000-0000-0000-0000-000000000003",
    nome: "Carla Nunes",
    avatarUrl: null,
    area: "Atendimento",
    cargo: "Analista de contas",
    diasFeriasAno: 15,
    maxParcelas: 2,
  },
  {
    id: "a0000000-0000-0000-0000-000000000005",
    nome: "Bruno Lima",
    avatarUrl: null,
    area: "Criação",
    cargo: "Designer",
    diasFeriasAno: 15,
    maxParcelas: 2,
  },
  {
    id: "a0000000-0000-0000-0000-000000000006",
    nome: "Marina Costa",
    avatarUrl: null,
    area: "Criação",
    cargo: "Social media",
    diasFeriasAno: 15,
    maxParcelas: 2,
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    nome: "Diego Reis",
    avatarUrl: null,
    area: "Tecnologia",
    cargo: "Desenvolvedor",
    diasFeriasAno: 15,
    maxParcelas: 2,
  },
];

const MARINA = TIME[3];
const BRUNO = TIME[2];

const PEDIDOS: HrRequest[] = [
  {
    id: "fd1",
    user_id: MARINA.id,
    tipo: "ferias",
    data_inicio: nesteMes(8),
    data_fim: nesteMes(14),
    dias_uteis: 5,
    motivo: "Viagem em família",
    status: "aprovada",
    motivo_reprovacao: null,
    aprovado_por: TIME[0].id,
    decidido_em: new Date().toISOString(),
    origem: "solicitacao",
    ano_referencia: null,
    lancado_por: null,
    lancado_em: null,
    created_at: new Date(Date.now() - 6 * 864e5).toISOString(),
  },
  {
    id: "fd2",
    user_id: BRUNO.id,
    tipo: "ferias",
    data_inicio: nesteMes(12),
    data_fim: nesteMes(18),
    dias_uteis: 5,
    motivo: "Casamento da irmã",
    status: "pendente",
    motivo_reprovacao: null,
    aprovado_por: null,
    decidido_em: null,
    origem: "solicitacao",
    ano_referencia: null,
    lancado_por: null,
    lancado_em: null,
    created_at: new Date(Date.now() - 864e5).toISOString(),
  },
  {
    id: "fd3",
    user_id: TIME[1].id,
    tipo: "licenca",
    data_inicio: emDias(-40),
    data_fim: emDias(-36),
    dias_uteis: 3,
    motivo: "Consulta médica",
    status: "reprovada",
    motivo_reprovacao: "A semana já tinha duas pessoas do Atendimento fora.",
    aprovado_por: TIME[0].id,
    decidido_em: new Date(Date.now() - 38 * 864e5).toISOString(),
    origem: "solicitacao",
    ano_referencia: null,
    lancado_por: null,
    lancado_em: null,
    created_at: new Date(Date.now() - 45 * 864e5).toISOString(),
  },
];

/** Os dias uteis entre duas datas, pulando fim de semana. */
function diasUteisEntre(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const cursor = new Date(`${inicio}T12:00:00`);
  const ate = new Date(`${fim}T12:00:00`);
  while (cursor <= ate) {
    const semana = cursor.getDay();
    if (semana !== 0 && semana !== 6) {
      const mes = String(cursor.getMonth() + 1).padStart(2, "0");
      const dia = String(cursor.getDate()).padStart(2, "0");
      dias.push(`${cursor.getFullYear()}-${mes}-${dia}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export async function listarTime(): Promise<PessoaDoTime[]> {
  return TIME;
}

export async function feriadosEntre(inicio: string, fim: string): Promise<Set<string>> {
  void inicio;
  void fim;
  // Sem feriado no exemplo: o conjunto de dados cobre um mes so, e um feriado
  // no meio dele mudaria a contagem de dias uteis que a tela mostra sem
  // acrescentar nada ao que se quer validar.
  return new Set<string>();
}

export async function feriadosComNome(
  inicio: string,
  fim: string,
): Promise<{ data: string; nome: string }[]> {
  void inicio;
  void fim;
  return [];
}

export async function matrizDoPeriodo(
  inicio: string,
  fim: string,
): Promise<LinhaDaMatriz[]> {
  const feriasDaMarina = new Set(diasUteisEntre(PEDIDOS[0].data_inicio, PEDIDOS[0].data_fim));
  const remotoDaCarla = emDias(-1);

  return TIME.map((pessoa) => {
    const dias = new Map<
      string,
      { data: string; status: PresencaStatus; observacao: string | null; deSolicitacao: boolean }
    >();

    for (const data of diasUteisEntre(inicio, fim)) {
      if (pessoa.id === MARINA.id && feriasDaMarina.has(data)) {
        dias.set(data, { data, status: "ferias", observacao: null, deSolicitacao: true });
      } else if (pessoa.id === TIME[1].id && data === remotoDaCarla) {
        dias.set(data, { data, status: "remoto", observacao: null, deSolicitacao: false });
      }
    }

    // O saldo espelha a mesma regra da camada real: pendente conta como usado.
    // A Marina tem o descanso combinado, e por isso aparece com menos dias.
    const usados = PEDIDOS.filter(
      (p) => p.user_id === pessoa.id && p.tipo === "ferias" && p.status !== "reprovada",
    ).reduce((total, p) => total + p.dias_uteis, 0);

    return { ...pessoa, dias, saldo: Math.max(0, pessoa.diasFeriasAno - usados) };
  });
}

export async function minhasSolicitacoes(usuarioId: string): Promise<HrRequest[]> {
  const meus = PEDIDOS.filter((p) => p.user_id === usuarioId);
  // Quem esta vendo o prototipo pode ser a socia, que nao tem pedido proprio.
  // Mostrar a lista vazia esconderia a tela que interessa validar.
  return meus.length > 0 ? meus : PEDIDOS;
}

export async function filaDeAprovacoes(status: HrStatus): Promise<SolicitacaoNaTela[]> {
  const porPessoa = new Map(TIME.map((p) => [p.id, p]));

  return PEDIDOS.filter((p) => p.status === status).map((pedido) => {
    const pessoa = porPessoa.get(pedido.user_id) ?? null;

    const colegasFora = PEDIDOS.filter((outro) => {
      if (outro.id === pedido.id || outro.status !== "aprovada") return false;
      const colega = porPessoa.get(outro.user_id);
      if (!colega || !pessoa || colega.area !== pessoa.area) return false;
      return outro.data_inicio <= pedido.data_fim && outro.data_fim >= pedido.data_inicio;
    }).map((outro) => ({
      nome: porPessoa.get(outro.user_id)?.nome ?? "—",
      inicio: outro.data_inicio,
      fim: outro.data_fim,
    }));

    return { ...pedido, pessoa, colegasFora };
  });
}

export async function contarPorStatus(): Promise<Record<HrStatus, number>> {
  const contagem: Record<HrStatus, number> = {
    pendente: 0,
    aprovada: 0,
    reprovada: 0,
    cancelada: 0,
  };
  for (const pedido of PEDIDOS) contagem[pedido.status] += 1;
  return contagem;
}

export async function diasBloqueadosDaArea(
  usuarioId: string,
  inicio: string,
  fim: string,
): Promise<Map<string, string[]>> {
  void usuarioId;
  void inicio;
  void fim;
  // As ferias aprovadas da Marina bloqueiam o calendario de quem e da Criacao.
  const bloqueados = new Map<string, string[]>();
  for (const dia of diasUteisEntre(PEDIDOS[0].data_inicio, PEDIDOS[0].data_fim)) {
    bloqueados.set(dia, [MARINA.nome]);
  }
  return bloqueados;
}

export async function relatorioDoPeriodo(
  inicio: string,
  fim: string,
  hojeISO: string,
): Promise<LinhaDoRelatorio[]> {
  void inicio;
  void fim;
  void hojeISO;
  return TIME.map((pessoa, indice) => {
    const tiradas = indice === 1 ? 10 : indice === 4 ? 5 : 0;
    const agendadas = pessoa.id === MARINA.id ? 5 : 0;
    const pendentes = pessoa.id === BRUNO.id ? 5 : 0;

    // A Ana esta ha 14 meses sem ferias: e o caso que o alerta de risco
    // trabalhista existe para mostrar.
    const ultimasFerias = indice === 0 ? mesesAtras(14) : indice === 1 ? mesesAtras(3) : null;
    const admissao = indice === 0 ? "2021-03-01" : "2024-02-05";
    const mesesSemFerias = indice === 0 ? 14 : indice === 1 ? 3 : 8;

    return {
      ...pessoa,
      tiradas,
      agendadas,
      pendentes,
      saldo: pessoa.diasFeriasAno - tiradas - agendadas - pendentes,
      ausencias: indice === 1 ? 2 : 0,
      licencas: 0,
      ultimasFerias,
      admissao,
      mesesSemFerias,
      vencendo: mesesSemFerias >= 12,
    };
  });
}

export async function foraHoje(hojeISO: string): Promise<
  { nome: string; area: string; status: PresencaStatus }[]
> {
  void hojeISO;
  return [];
}

export type { LancamentoNaTela } from "../../src/lib/dados/full-days";

/**
 * Dois registros lancados pela gestao, para a aba nascer com o que ela
 * existe para mostrar: um descanso do ANO PASSADO (o caso real -- historico
 * anterior ao Full Hub) e uma ausencia pontual de um dia, combinada por fora.
 *
 * Nenhum deles e `solicitacao`: esta lista e justamente o que a fila de
 * pedidos NAO mostra, e um pedido aqui faria a aba parecer uma segunda fila.
 */
export async function lancamentosDaGestao(): Promise<
  import("../../src/lib/dados/full-days").LancamentoNaTela[]
> {
  const anoPassado = new Date().getFullYear() - 1;
  return [
    {
      id: "lanc1",
      user_id: MARINA.id,
      tipo: "ferias",
      data_inicio: `${anoPassado}-12-20`,
      data_fim: `${anoPassado}-12-29`,
      dias_uteis: 10,
      motivo: "Planilha de 2025, fechamento do ano.",
      status: "aprovada",
      motivo_reprovacao: null,
      aprovado_por: TIME[0].id,
      decidido_em: new Date(Date.now() - 30 * 864e5).toISOString(),
      origem: "lancamento_retroativo",
      ano_referencia: anoPassado,
      lancado_por: TIME[0].id,
      lancado_em: new Date(Date.now() - 30 * 864e5).toISOString(),
      created_at: new Date(Date.now() - 30 * 864e5).toISOString(),
      pessoa: MARINA,
      lancadoPor: TIME[0].nome,
    },
    {
      id: "lanc2",
      user_id: BRUNO.id,
      tipo: "ausencia",
      data_inicio: emDias(-9),
      data_fim: emDias(-9),
      dias_uteis: 1,
      motivo: "Avisou por mensagem na hora, entrou depois.",
      status: "aprovada",
      motivo_reprovacao: null,
      aprovado_por: TIME[0].id,
      decidido_em: new Date(Date.now() - 8 * 864e5).toISOString(),
      origem: "lancamento_retroativo",
      ano_referencia: new Date().getFullYear(),
      lancado_por: TIME[0].id,
      lancado_em: new Date(Date.now() - 8 * 864e5).toISOString(),
      created_at: new Date(Date.now() - 8 * 864e5).toISOString(),
      pessoa: BRUNO,
      lancadoPor: TIME[0].nome,
    },
  ];
}
