/**
 * Versao de prototipo de src/lib/dados/recorrencias.ts.
 *
 * Duas regras, uma de cada modo, e uma delas PAUSADA com falha recente -- e
 * de proposito: a lista precisa mostrar os tres estados que ela separa, e o
 * terceiro (com erro) e o unico que nao aparece num ambiente saudavel. Uma
 * imagem so com regras verdes nao prova que o selo vermelho cabe na linha.
 */
import type {
  ExecucaoNaTela as ExecucaoReal,
  RecorrenciaNaTela as RecorrenciaReal,
} from "../../src/lib/dados/recorrencias";

export type RecorrenciaNaTela = RecorrenciaReal;
export type ExecucaoNaTela = ExecucaoReal;

const VERDE = "c0000000-0000-0000-0000-00000000000a";
const OTICA = "c0000000-0000-0000-0000-00000000000b";

function hojeMais(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const REGRAS: RecorrenciaNaTela[] = [
  {
    id: "f0000000-0000-0000-0000-000000000001",
    client_id: VERDE,
    nome: "Stories diários",
    modo: "mensal_agrupada",
    frequencia: "diaria",
    dias_semana: [1, 2, 3, 4, 5],
    dia_mes: null,
    pular_feriados: true,
    data_inicio: hojeMais(-60),
    data_fim: null,
    antecedencia_dias: 3,
    gerar_como_rascunho: false,
    modelo: {
      titulo: "Stories {MES}/{ANO} — {CLIENTE}",
      pasta_entrega: "https://drive.google.com/drive/folders/stories",
      prioridade: "normal",
      responsavel_padrao: "a0000000-0000-0000-0000-000000000006",
      subtarefa_diaria: { titulo: "Stories {DATA}" },
      subtarefas: [],
      referencias: [],
    },
    task_type_id: null,
    ativo: true,
    ultima_geracao_em: hojeMais(-24),
    proxima_geracao_em: hojeMais(4),
    criado_por: "a0000000-0000-0000-0000-000000000003",
    created_at: hojeMais(-60),
    updated_at: hojeMais(-24),
    cliente: "Mundo Verde",
    criadoPor: "Carla Nunes",
    geradas: 3,
    errosRecentes: 0,
  },
  {
    id: "f0000000-0000-0000-0000-000000000002",
    client_id: OTICA,
    nome: "Relatório mensal de mídia",
    modo: "task_por_ocorrencia",
    frequencia: "mensal",
    dias_semana: null,
    dia_mes: 5,
    pular_feriados: true,
    data_inicio: hojeMais(-120),
    data_fim: null,
    antecedencia_dias: 5,
    gerar_como_rascunho: false,
    modelo: {
      titulo: "Relatório de mídia — {MES}/{ANO}",
      pasta_entrega: "https://drive.google.com/drive/folders/relatorios",
      prioridade: "alta",
      subtarefa_diaria: null,
      subtarefas: [
        { titulo: "Coletar os números", prazo_offset_dias: 1 },
        { titulo: "Montar o relatório", prazo_offset_dias: 3 },
        { titulo: "Revisar com o cliente", prazo_offset_dias: 5 },
      ],
      referencias: [],
    },
    task_type_id: null,
    ativo: true,
    ultima_geracao_em: hojeMais(-20),
    proxima_geracao_em: hojeMais(11),
    criado_por: "a0000000-0000-0000-0000-000000000003",
    created_at: hojeMais(-120),
    updated_at: hojeMais(-20),
    cliente: "Óptica Visão",
    criadoPor: "Carla Nunes",
    geradas: 4,
    errosRecentes: 0,
  },
  {
    // PAUSADA E COM FALHA: a regra ficou sem pasta de entrega, errou tres
    // madrugadas seguidas e alguem a pausou. E o estado que a lista precisa
    // deixar visivel de relance -- no banco ele nao aparece em lugar nenhum
    // alem do historico.
    id: "f0000000-0000-0000-0000-000000000003",
    client_id: VERDE,
    nome: "Newsletter quinzenal",
    modo: "task_por_ocorrencia",
    frequencia: "quinzenal",
    dias_semana: [3],
    dia_mes: null,
    pular_feriados: false,
    data_inicio: hojeMais(-90),
    data_fim: null,
    antecedencia_dias: 2,
    gerar_como_rascunho: true,
    modelo: {
      titulo: "Newsletter {DATA}",
      pasta_entrega: "",
      prioridade: "normal",
      subtarefa_diaria: null,
      subtarefas: [{ titulo: "Escrever", prazo_offset_dias: 2 }],
      referencias: [],
    },
    task_type_id: null,
    ativo: false,
    ultima_geracao_em: hojeMais(-14),
    proxima_geracao_em: null,
    criado_por: "a0000000-0000-0000-0000-000000000003",
    created_at: hojeMais(-90),
    updated_at: hojeMais(-14),
    cliente: "Mundo Verde",
    criadoPor: "Carla Nunes",
    geradas: 2,
    errosRecentes: 3,
  },
] as unknown as RecorrenciaNaTela[];

export async function listarRecorrencias(): Promise<RecorrenciaNaTela[]> {
  return REGRAS;
}

export async function buscarRecorrencia(id: string) {
  return (REGRAS.find((r) => r.id === id) ?? REGRAS[0]) as never;
}

export async function execucoesDaRecorrencia(
  _recurrenceId?: string,
): Promise<ExecucaoNaTela[]> {
  return [
    {
      id: "e1",
      chave: hojeMais(-24).slice(0, 7),
      status: "gerada",
      taskId: "11111111-1111-1111-1111-111111111111",
      tituloDaTask: "Stories Setembro/2026 — Mundo Verde",
      motivo: null,
      avisos: [],
      subtarefas: 21,
      quando: hojeMais(-24),
    },
  ];
}

export async function tasksDaRecorrencia(_recurrenceId?: string) {
  return [];
}

export async function feriadosParaAPrevia(): Promise<string[]> {
  return [];
}

export async function modeloDeUmaTask(_taskId: string) {
  return null;
}
