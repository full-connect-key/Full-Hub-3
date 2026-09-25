/**
 * Versao de prototipo de src/lib/dados/metricas.ts.
 *
 * ---------------------------------------------------------------------------
 * OS NUMEROS RESPONDEM AO PERIODO, e nao sao fixos.
 *
 * Uma aba de metrica que mostra os mesmos numeros em "30 dias" e em "este ano"
 * e uma imagem que prova que a tela desenha -- e nao que ela filtra. E
 * justamente o erro que o stub do calendario cometeu ignorando os filtros. A
 * escala aqui e proporcional aos dias do recorte, que e o que a pessoa espera
 * ver mudar ao trocar o seletor.
 *
 * A rentabilidade continua devolvendo lista: quem decide se o socio a alcanca
 * e a pagina, pelo mesmo `QUEM_VE` que o banco espelha -- o stub nao pode ser
 * o lugar que esconde, senao a imagem do desenvolvedor provaria a regra
 * errada.
 * ---------------------------------------------------------------------------
 */
import type {
  DesvioDaPessoa,
  Producao,
  QualidadeDoCliente,
  RentabilidadeDoCliente,
  TempoDeAprovacao,
  TempoEmStatus,
} from "../../src/lib/dados/metricas";

export type {
  DesvioDaPessoa,
  Producao,
  QualidadeDoCliente,
  RentabilidadeDoCliente,
  TempoDeAprovacao,
  TempoEmStatus,
};

/** Quantos dias o recorte cobre. E o que faz os numeros responderem a ele. */
function dias(de: string, ate: string): number {
  const ms = new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/** Uma escala estavel: o mesmo recorte devolve sempre o mesmo numero. */
function porDia(de: string, ate: string, taxa: number): number {
  return Math.max(0, Math.round(dias(de, ate) * taxa));
}

export async function producaoDoPeriodo(
  de: string,
  ate: string,
  clienteId?: string | null,
): Promise<Producao> {
  // O FILTRO DE CLIENTE PRECISA MUDAR ALGUMA COISA, senao a imagem com o
  // filtro aplicado nao prova nada.
  const fatia = clienteId ? 0.35 : 1;
  const concluidas = Math.round(porDia(de, ate, 1.6) * fatia);
  const noPrazo = Math.round(concluidas * 0.72);
  const foraDoPrazo = Math.round(concluidas * 0.18);

  return {
    criadas: Math.round(porDia(de, ate, 1.9) * fatia),
    concluidas,
    atrasadas: Math.round(5 * fatia),
    no_prazo: noPrazo,
    fora_do_prazo: foraDoPrazo,
    sem_prazo: concluidas - noPrazo - foraDoPrazo,
    minutos_reais: concluidas * 95,
  };
}

export async function tempoPorStatus(de: string, ate: string): Promise<TempoEmStatus[]> {
  const base = porDia(de, ate, 1);
  return [
    { status: "em_andamento", minutos: base * 420, ocorrencias: base * 2 },
    { status: "aguardando_informacoes", minutos: base * 260, ocorrencias: base },
    { status: "enviada_aprovacao", minutos: base * 180, ocorrencias: base },
    { status: "em_ajustes", minutos: base * 95, ocorrencias: Math.max(1, Math.round(base / 2)) },
    { status: "nao_iniciada", minutos: base * 60, ocorrencias: base },
  ].sort((a, b) => b.minutos - a.minutos);
}

export async function tempoDeAprovacao(de: string, ate: string): Promise<TempoDeAprovacao[]> {
  const base = porDia(de, ate, 0.4);
  return [
    { escopo: "interna", cliente: "Mundo Verde", horasMedia: 5.4, rodadas: base, pendentes: 2 },
    { escopo: "interna", cliente: "Óptica Visão", horasMedia: 9.1, rodadas: Math.max(1, Math.round(base / 2)), pendentes: 1 },
    // CLIENTE NULO E CASO NORMAL: a rodada interna de etapa sem cliente nao
    // tem de onde tirar um, e a tela escreve "Sem cliente".
    { escopo: "interna", cliente: null, horasMedia: 3.2, rodadas: 2, pendentes: 0 },
    { escopo: "cliente", cliente: "Mundo Verde", horasMedia: 31.7, rodadas: Math.max(1, Math.round(base / 2)), pendentes: 3 },
    { escopo: "cliente", cliente: "Óptica Visão", horasMedia: 52.3, rodadas: Math.max(1, Math.round(base / 3)), pendentes: 1 },
  ];
}

export async function desvioDeEstimativa(de: string, ate: string): Promise<DesvioDaPessoa[]> {
  const base = porDia(de, ate, 0.3);
  const linhas: DesvioDaPessoa[] = [
    { responsavelId: "44444444-4444-4444-4444-444444444444", nome: "Bruno Camargo", etapas: base, minutosEstimados: base * 120, minutosReais: base * 198, desvioPercentual: 65 },
    // O SUBESTIMADOR TEM QUE APARECER NO TOPO: e o cenario que prova a ordem
    // por modulo. Com ordem por sinal, ele cairia para o fim da lista.
    { responsavelId: "55555555-5555-5555-5555-555555555555", nome: "Marina Alves", etapas: base, minutosEstimados: base * 180, minutosReais: base * 101, desvioPercentual: -44 },
    { responsavelId: "33333333-3333-3333-3333-333333333333", nome: "Carla Nunes", etapas: base, minutosEstimados: base * 150, minutosReais: base * 174, desvioPercentual: 16 },
    { responsavelId: "22222222-2222-2222-2222-222222222222", nome: "Diego Reis", etapas: Math.max(1, Math.round(base / 2)), minutosEstimados: base * 90, minutosReais: base * 96, desvioPercentual: 7 },
  ];
  return linhas.sort((a, b) => Math.abs(b.desvioPercentual) - Math.abs(a.desvioPercentual));
}

export async function qualidadeDaEntrega(de: string, ate: string): Promise<QualidadeDoCliente[]> {
  const base = porDia(de, ate, 0.5);
  return [
    { clienteId: "c0000000-0000-0000-0000-00000000000a", cliente: "Mundo Verde", conteudos: base, aprovadosDePrima: Math.round(base * 0.7), rodadasMedia: 1.4, rejeitados: 0 },
    { clienteId: "c0000000-0000-0000-0000-00000000000b", cliente: "Óptica Visão", conteudos: Math.max(1, Math.round(base * 0.6)), aprovadosDePrima: Math.round(base * 0.2), rodadasMedia: 2.3, rejeitados: 2 },
  ].sort((a, b) => b.conteudos - a.conteudos);
}

export async function rentabilidadeDoPeriodo(
  de: string,
  ate: string,
): Promise<RentabilidadeDoCliente[]> {
  const meses = Math.max(1, Math.round(dias(de, ate) / 30));
  return [
    {
      clienteId: "c0000000-0000-0000-0000-00000000000a",
      cliente: "Mundo Verde",
      receita: 8500 * meses,
      despesa: 1200 * meses,
      horas: 64 * meses,
      receitaPorHora: Math.round((8500 / 64) * 100) / 100,
    },
    {
      // SEM HORA LANCADA: o caso que a tela escreve por extenso em vez de
      // mostrar zero. Sem ele na imagem, a regra nao aparece em lugar nenhum.
      clienteId: "c0000000-0000-0000-0000-00000000000b",
      cliente: "Óptica Visão",
      receita: 4200 * meses,
      despesa: 600 * meses,
      horas: 0,
      receitaPorHora: null,
    },
  ];
}
