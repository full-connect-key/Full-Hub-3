/**
 * Versao de prototipo de src/lib/dados/financeiro.ts.
 *
 * SO GASTO, e nenhuma receita (0095): a aba de faturamento saiu do produto, e
 * um stub que continuasse devolvendo receita mostraria na imagem uma tela que
 * nao existe mais -- o pior tipo de dado de exemplo.
 *
 * Os meses sao relativos a hoje: com competencia fixa, o prototipo abriria no
 * mes corrente e mostraria tudo zerado -- exatamente a tela que nao se quer
 * validar.
 *
 * Um gasto JA VENCIDO e nao pago existe de proposito: e ele que prova, na
 * captura, que "atrasado" aparece sem ninguem ter gravado esse status. E um
 * SEGUNDO, de competencia anterior, existe para a faixa ambar de atraso de
 * meses passados sair em imagem -- sem ele ela nao aparece em nenhuma, e ela e
 * justamente a linha que nenhuma outra tela do produto desenha.
 */
import type { LancamentoComRelacoes } from "../../src/lib/dados/financeiro";
import type { FinanceCategory } from "../../src/lib/supabase/database.types";
import { situacaoDoLancamento } from "../../src/lib/dominio/financeiro";

export type { LancamentoComRelacoes };

const VERDE = { id: "c0000000-0000-0000-0000-00000000000a", nome_empresa: "Mundo Verde" };

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

/** O dia 1 de N meses atras. */
function mesAtras(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.toISOString().slice(0, 7)}-01`;
}

const CATEGORIAS: FinanceCategory[] = [
  { id: "cat-4", nome: "Salários e pró-labore" },
  { id: "cat-5", nome: "Ferramentas e software" },
  { id: "cat-6", nome: "Estrutura" },
  { id: "cat-7", nome: "Freelancers" },
  { id: "cat-8", nome: "Mídia paga" },
];

export async function listarCategorias(): Promise<FinanceCategory[]> {
  return CATEGORIAS;
}

function gastosCrus() {
  const mes = mesCorrente();
  return [
    {
      id: "fe-5",
      client_id: null,
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
    },
    {
      id: "fe-6",
      client_id: null,
      category_id: "cat-5",
      descricao: "Adobe Creative Cloud",
      valor: 890,
      competencia: mes,
      vencimento: diaDoMes(14),
      pagamento: null,
      status: "previsto" as const,
      fornecedor: "Adobe",
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: null,
      categoria: { id: "cat-5", nome: "Ferramentas e software" },
    },
    {
      id: "fe-7",
      client_id: null,
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
    },
    {
      // JA VENCIDO e nao pago, no mes corrente. Gravado como "previsto"; a
      // tela tem que mostrar "Atrasado".
      id: "fe-8",
      client_id: null,
      category_id: "cat-7",
      descricao: "Edição de vídeo — freelancer",
      valor: 1800,
      competencia: mes,
      vencimento: somarDias(-9),
      pagamento: null,
      status: "previsto" as const,
      fornecedor: "Lucas Ferraz",
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: null,
      categoria: { id: "cat-7", nome: "Freelancers" },
    },
    {
      // GASTO DE UMA CONTA, e nao da casa: e ele que faz a coluna Cliente
      // mostrar alguma coisa em vez de sete travessoes.
      id: "fe-9",
      client_id: VERDE.id,
      category_id: "cat-8",
      descricao: "Impulsionamento de outubro",
      valor: 3500,
      competencia: mes,
      vencimento: somarDias(4),
      pagamento: null,
      status: "faturado" as const,
      fornecedor: "Meta",
      observacoes: null,
      criado_por: "u1",
      created_at: `${mes}T09:00:00Z`,
      cliente: VERDE,
      categoria: { id: "cat-8", nome: "Mídia paga" },
    },
  ];
}

/** O atrasado de DOIS meses atras, que mora fora da lista do mes. */
function atrasadoDeOutroMes() {
  const mes = mesAtras(2);
  return {
    id: "fe-velho",
    client_id: null,
    category_id: "cat-5",
    descricao: "Licença do Figma",
    valor: 1240,
    competencia: mes,
    vencimento: somarDias(-71),
    pagamento: null,
    status: "previsto" as const,
    fornecedor: "Figma",
    observacoes: null,
    criado_por: "u1",
    created_at: `${mes}T09:00:00Z`,
    cliente: null,
    categoria: { id: "cat-5", nome: "Ferramentas e software" },
  };
}

export async function lancamentosDaCompetencia(
  competencia: string,
  hoje: string,
): Promise<LancamentoComRelacoes[]> {
  void competencia;
  return gastosCrus().map((g) => ({
    ...g,
    situacao: situacaoDoLancamento(g, hoje),
  })) as LancamentoComRelacoes[];
}

export async function gastosVencidos(hoje: string): Promise<LancamentoComRelacoes[]> {
  // Os dois: o do mes corrente (que a tela desconta, porque ele ja esta na
  // lista) e o de dois meses atras (que e o que a faixa conta).
  const vencidos = [...gastosCrus().filter((g) => g.id === "fe-8"), atrasadoDeOutroMes()];
  return vencidos.map((g) => ({
    ...g,
    situacao: situacaoDoLancamento(g, hoje),
  })) as LancamentoComRelacoes[];
}
