/**
 * Versao de prototipo de src/lib/dados/financeiro.ts.
 *
 * Os meses sao relativos a hoje: com competencia fixa, o prototipo abriria no
 * mes corrente e mostraria tudo zerado -- exatamente a tela que nao se quer
 * validar.
 *
 * Um titulo JA VENCIDO e nao pago existe de proposito: e ele que prova, na
 * captura, que "atrasado" aparece sem ninguem ter gravado esse status.
 */
import type {
  Alerta,
  ContratoComCliente,
  DRE,
  LancamentoComRelacoes,
  PontoDoMes,
  RentabilidadeDoCliente,
  VisaoGeral,
} from "../../src/lib/dados/financeiro";
import type { FinanceCategory } from "../../src/lib/supabase/database.types";
import { situacaoDoLancamento, ultimasCompetencias } from "../../src/lib/dominio/financeiro";

export type {
  Alerta,
  ContratoComCliente,
  DRE,
  LancamentoComRelacoes,
  PontoDoMes,
  RentabilidadeDoCliente,
  VisaoGeral,
};

const VERDE = { id: "c0000000-0000-0000-0000-00000000000a", nome_empresa: "Mundo Verde" };
const OPTICA = { id: "c0000000-0000-0000-0000-00000000000b", nome_empresa: "Óptica Visão" };
const CORPO = { id: "c0000000-0000-0000-0000-00000000000c", nome_empresa: "Academia Corpo Livre" };

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function mesCorrente(): string {
  return `${hojeISO().slice(0, 7)}-01`;
}

function diaDoMes(dia: number): string {
  return `${hojeISO().slice(0, 7)}-${String(dia).padStart(2, "0")}`;
}

function somarDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const CATEGORIAS: FinanceCategory[] = [
  { id: "cat-1", nome: "Fee mensal", tipo: "receita" },
  { id: "cat-2", nome: "Projeto pontual", tipo: "receita" },
  { id: "cat-3", nome: "Verba de mídia", tipo: "receita" },
  { id: "cat-4", nome: "Salários e pró-labore", tipo: "despesa" },
  { id: "cat-5", nome: "Ferramentas e software", tipo: "despesa" },
  { id: "cat-6", nome: "Estrutura", tipo: "despesa" },
  { id: "cat-7", nome: "Freelancers", tipo: "despesa" },
];

export async function listarCategorias(): Promise<FinanceCategory[]> {
  return CATEGORIAS;
}

const CONTRATOS: ContratoComCliente[] = [
  {
    id: "ct-1",
    client_id: VERDE.id,
    nome: "Fee mensal — social media",
    valor: 4800,
    recorrencia: "mensal",
    dia_vencimento: 10,
    data_inicio: "2026-01-15",
    data_fim: null,
    ativo: true,
    observacoes: null,
    created_at: "2026-01-15T09:00:00Z",
    cliente: VERDE,
  },
  {
    id: "ct-2",
    client_id: OPTICA.id,
    nome: "Fee mensal — conteúdo e mídia",
    valor: 3200,
    recorrencia: "mensal",
    dia_vencimento: 5,
    data_inicio: "2026-04-01",
    // Termina dentro de 60 dias: e o que faz o alerta de contrato terminando
    // aparecer na visao geral.
    data_fim: somarDias(45),
    ativo: true,
    observacoes: null,
    created_at: "2026-04-01T09:00:00Z",
    cliente: OPTICA,
  },
  {
    id: "ct-3",
    client_id: CORPO.id,
    nome: "Campanha trimestral",
    valor: 9000,
    recorrencia: "trimestral",
    dia_vencimento: 20,
    data_inicio: "2026-03-01",
    data_fim: null,
    ativo: true,
    observacoes: null,
    created_at: "2026-03-01T09:00:00Z",
    cliente: CORPO,
  },
];

export async function listarContratos(): Promise<ContratoComCliente[]> {
  return CONTRATOS;
}

function lancamentosCrus() {
  const mes = mesCorrente();
  return [
    {
      id: "fe-1",
      tipo: "receita" as const,
      client_id: VERDE.id,
      contract_id: "ct-1",
      category_id: "cat-1",
      descricao: "Fee mensal — social media",
      valor: 4800,
      competencia: mes,
      vencimento: diaDoMes(10),
      pagamento: diaDoMes(9),
      status: "pago" as const,
      fornecedor: null,
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: VERDE,
      categoria: { id: "cat-1", nome: "Fee mensal" },
      contrato: { id: "ct-1", nome: "Fee mensal — social media" },
    },
    {
      id: "fe-2",
      tipo: "receita" as const,
      client_id: OPTICA.id,
      contract_id: "ct-2",
      category_id: "cat-1",
      descricao: "Fee mensal — conteúdo e mídia",
      valor: 3200,
      competencia: mes,
      vencimento: diaDoMes(5),
      pagamento: null,
      status: "faturado" as const,
      fornecedor: null,
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: OPTICA,
      categoria: { id: "cat-1", nome: "Fee mensal" },
      contrato: { id: "ct-2", nome: "Fee mensal — conteúdo e mídia" },
    },
    {
      // JA VENCIDO e nao pago. Gravado como "faturado"; a tela tem que
      // mostrar "Atrasado".
      id: "fe-3",
      tipo: "receita" as const,
      client_id: CORPO.id,
      contract_id: null,
      category_id: "cat-2",
      descricao: "Produção de vídeo institucional",
      valor: 6500,
      competencia: mes,
      vencimento: somarDias(-9),
      pagamento: null,
      status: "faturado" as const,
      fornecedor: null,
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: CORPO,
      categoria: { id: "cat-2", nome: "Projeto pontual" },
      contrato: null,
    },
    {
      id: "fe-4",
      tipo: "receita" as const,
      client_id: VERDE.id,
      contract_id: null,
      category_id: "cat-3",
      descricao: "Verba de mídia de outubro",
      valor: 5200,
      competencia: mes,
      vencimento: somarDias(4),
      pagamento: null,
      status: "faturado" as const,
      fornecedor: null,
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: VERDE,
      categoria: { id: "cat-3", nome: "Verba de mídia" },
      contrato: null,
    },
    {
      id: "fe-5",
      tipo: "despesa" as const,
      client_id: null,
      contract_id: null,
      category_id: "cat-4",
      descricao: "Folha da equipe",
      valor: 14200,
      competencia: mes,
      vencimento: diaDoMes(15),
      pagamento: diaDoMes(15),
      status: "pago" as const,
      fornecedor: null,
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: null,
      categoria: { id: "cat-4", nome: "Salários e pró-labore" },
      contrato: null,
    },
    {
      id: "fe-6",
      tipo: "despesa" as const,
      client_id: null,
      contract_id: null,
      category_id: "cat-5",
      descricao: "Assinaturas e licenças",
      valor: 890,
      competencia: mes,
      vencimento: diaDoMes(14),
      pagamento: null,
      status: "previsto" as const,
      fornecedor: "Adobe, Meta, Google",
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: null,
      categoria: { id: "cat-5", nome: "Ferramentas e software" },
      contrato: null,
    },
    {
      id: "fe-7",
      tipo: "despesa" as const,
      client_id: null,
      contract_id: null,
      category_id: "cat-6",
      descricao: "Aluguel e contas",
      valor: 2400,
      competencia: mes,
      vencimento: diaDoMes(14),
      pagamento: diaDoMes(14),
      status: "pago" as const,
      fornecedor: null,
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: null,
      categoria: { id: "cat-6", nome: "Estrutura" },
      contrato: null,
    },
  ];
}

export async function lancamentosDaCompetencia(
  competencia: string,
  hoje: string,
): Promise<LancamentoComRelacoes[]> {
  void competencia;
  return lancamentosCrus().map((l) => ({
    ...l,
    situacao: situacaoDoLancamento(l, hoje),
  })) as LancamentoComRelacoes[];
}

export async function lancamentosDoPeriodo(
  de: string,
  ate: string,
  hoje: string,
): Promise<LancamentoComRelacoes[]> {
  void de;
  void ate;
  return lancamentosDaCompetencia(ate, hoje);
}

export async function visaoGeralDoMes(competencia: string, hoje: string): Promise<VisaoGeral> {
  const lancamentos = await lancamentosDaCompetencia(competencia, hoje);
  const somar = (tipo: "receita" | "despesa", soPagos: boolean) =>
    lancamentos
      .filter((l) => l.tipo === tipo && (!soPagos || l.pagamento !== null))
      .reduce((t, l) => t + Number(l.valor), 0);

  const receitaPrevista = somar("receita", false);
  const receitaRealizada = somar("receita", true);
  const despesaPrevista = somar("despesa", false);
  const despesaRealizada = somar("despesa", true);

  const base = [26800, 29400, 27900, 33500, 31200, 35700, 30800, 34900, 36400, 38100, 37200, 39800];
  const gastos = [18900, 20100, 19400, 22300, 21700, 23800, 21100, 23400, 24600, 25100, 24300, 25900];

  const serie: PontoDoMes[] = ultimasCompetencias(competencia, 12).map((mes, i) => ({
    competencia: mes,
    receita: base[i],
    despesa: gastos[i],
  }));

  const atrasado = lancamentos.find((l) => l.situacao === "atrasado");
  const vencendo = lancamentos.find((l) => l.id === "fe-4");

  const alertas: Alerta[] = [
    ...(atrasado
      ? [
          {
            tipo: "atrasado" as const,
            titulo: atrasado.descricao,
            detalhe: `Venceu em ${atrasado.vencimento!.split("-").reverse().join("/")}`,
            valor: Number(atrasado.valor),
            data: atrasado.vencimento!,
          },
        ]
      : []),
    ...(vencendo
      ? [
          {
            tipo: "vence" as const,
            titulo: vencendo.descricao,
            detalhe: `Recebe em ${vencendo.vencimento!.split("-").reverse().join("/")}`,
            valor: Number(vencendo.valor),
            data: vencendo.vencimento!,
          },
        ]
      : []),
    {
      tipo: "contrato-terminando" as const,
      titulo: "Fee mensal — conteúdo e mídia",
      detalhe: `Óptica Visão — termina em ${somarDias(45).split("-").reverse().join("/")}`,
      valor: 3200,
      data: somarDias(45),
    },
  ];

  const porCliente = [
    { nome: "Produção — Academia Corpo Livre", valor: 6500 },
    { nome: "Mundo Verde", valor: 10000 },
    { nome: "Óptica Visão", valor: 3200 },
  ].sort((a, b) => b.valor - a.valor);

  return {
    competencia,
    receitaPrevista,
    receitaRealizada,
    despesaPrevista,
    despesaRealizada,
    resultadoPrevisto: receitaPrevista - despesaPrevista,
    resultadoRealizado: receitaRealizada - despesaRealizada,
    inadimplencia: atrasado ? Number(atrasado.valor) : 0,
    quantosInadimplentes: atrasado ? 1 : 0,
    receitaRecorrente: 4800 + 3200 + 9000 / 3,
    serie,
    porCliente,
    alertas,
  };
}

export async function relatorioDoPeriodo(
  de: string,
  ate: string,
): Promise<{ dre: DRE; rentabilidade: RentabilidadeDoCliente[] }> {
  void de;
  void ate;

  const receitas = [
    { categoria: "Fee mensal", valor: 48000 },
    { categoria: "Verba de mídia", valor: 15600 },
    { categoria: "Projeto pontual", valor: 13000 },
  ];
  const despesas = [
    { categoria: "Salários e pró-labore", valor: 85200 },
    { categoria: "Estrutura", valor: 14400 },
    { categoria: "Freelancers", valor: 10800 },
    { categoria: "Ferramentas e software", valor: 5340 },
  ];
  const totalReceitas = receitas.reduce((t, l) => t + l.valor, 0);
  const totalDespesas = despesas.reduce((t, l) => t + l.valor, 0);

  const rentabilidade: RentabilidadeDoCliente[] = [
    { clientId: VERDE.id, nome: "Mundo Verde", receita: 43800, minutos: 9600, receitaPorHora: 43800 / 160 },
    { clientId: OPTICA.id, nome: "Óptica Visão", receita: 19200, minutos: 7200, receitaPorHora: 19200 / 120 },
    // Sem hora lancada: a tela tem que dizer "sem hora registrada", e nao 0.
    { clientId: CORPO.id, nome: "Academia Corpo Livre", receita: 13600, minutos: 0, receitaPorHora: null },
  ].sort((a, b) => (b.receitaPorHora ?? -1) - (a.receitaPorHora ?? -1));

  return {
    dre: { receitas, despesas, totalReceitas, totalDespesas, resultado: totalReceitas - totalDespesas },
    rentabilidade,
  };
}

export async function contratosSemLancamento(competencia: string): Promise<ContratoComCliente[]> {
  void competencia;
  // O trimestral ainda nao tem lancamento no mes; os dois mensais ja tem.
  return [CONTRATOS[2]];
}

export { competenciaDe } from "../../src/lib/dominio/financeiro";
