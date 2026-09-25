/**
 * Versao de prototipo de src/lib/dados/auditoria.ts.
 *
 * OS CASOS QUE A IMAGEM PRECISA PROVAR, e que so aparecem se o stub os
 * produzir:
 *
 *   - uma troca de PERFIL DE ACESSO, que e o evento mais importante do produto;
 *   - um APAGAMENTO, que e o unico selo em tom de erro;
 *   - uma linha SEM PESSOA, para a tela escrever "sistema" em vez de deixar
 *     branco -- o seed e a chave de servico escrevem sem sessao;
 *   - um valor NULO virando "(vazio)", senao a linha sai com um buraco que
 *     parece defeito;
 *   - um INSERT com muitos campos, para a celula cortar em cinco e dizer
 *     quantos sobraram em vez de empurrar a tabela para fora da tela.
 *
 * As datas sao relativas a hoje. Data fixa envelhece, e meses depois a imagem
 * mostra uma auditoria que parece abandonada -- o mesmo criterio do stub do
 * Full Days.
 */
import type {
  FiltrosDaAuditoria,
  LinhaDaAuditoria,
  PaginaDaAuditoria,
} from "../../src/lib/dados/auditoria";

export type { FiltrosDaAuditoria, LinhaDaAuditoria, PaginaDaAuditoria };

function horasAtras(quantas: number): string {
  return new Date(Date.now() - quantas * 3600_000).toISOString();
}

const ANA = { id: "a0000000-0000-0000-0000-000000000001", nome: "Ana Souza" };
const DIEGO = { id: "a0000000-0000-0000-0000-000000000002", nome: "Diego Lima" };

const LINHAS: LinhaDaAuditoria[] = [
  {
    id: "au-1",
    tabela: "profiles",
    registroId: "a0000000-0000-0000-0000-000000000005",
    operacao: "UPDATE",
    quando: horasAtras(2),
    quem: ANA,
    antes: { role: "colaborador" },
    depois: { role: "desenvolvedor" },
  },
  {
    id: "au-2",
    tabela: "campaigns",
    registroId: "ca000000-0000-0000-0000-00000000000f",
    operacao: "DELETE",
    quando: horasAtras(6),
    quem: ANA,
    antes: {
      nome: "Wave de teste",
      status: "planejamento",
      inicio: "2026-08-01",
      fim: "2026-08-30",
    },
    depois: null,
  },
  {
    id: "au-3",
    tabela: "finance_entries",
    registroId: "fe000000-0000-0000-0000-000000000003",
    operacao: "UPDATE",
    quando: horasAtras(20),
    quem: ANA,
    // SO AS COLUNAS QUE MUDARAM, como o trigger faz. A primeira versao deste
    // stub repetia `valor: 8400` nos dois lados, e a tela desenhou
    // "valor: 8400 -> 8400" -- um estado que o produto nao consegue produzir,
    // porque `registrar_auditoria()` so grava o que ficou diferente. Dado de
    // exemplo que mostra o produto como ele nao e engana quem olha a imagem.
    antes: { status: "previsto", pagamento: null },
    depois: { status: "pago", pagamento: "2026-09-22" },
  },
  {
    id: "au-4",
    tabela: "client_users",
    registroId: "cu000000-0000-0000-0000-000000000007",
    operacao: "INSERT",
    quando: horasAtras(30),
    quem: DIEGO,
    antes: null,
    depois: {
      client_id: "c0000000-0000-0000-0000-00000000000a",
      user_id: "u0000000-0000-0000-0000-000000000009",
      criado_por: DIEGO.id,
      cargo: "Marketing",
      telefone: null,
      observacoes: "Segundo acesso da conta",
      created_at: horasAtras(30),
    },
  },
  {
    id: "au-5",
    tabela: "hr_requests",
    registroId: "hr000000-0000-0000-0000-000000000004",
    operacao: "UPDATE",
    quando: horasAtras(52),
    // SEM PESSOA de proposito: o lancamento retroativo desta linha veio de um
    // script, e a tela tem que escrever "sistema".
    quem: null,
    antes: { dias_uteis: 5, status: "pendente" },
    depois: { dias_uteis: 4, status: "aprovada" },
  },
  {
    id: "au-6",
    tabela: "clients",
    registroId: "c0000000-0000-0000-0000-00000000000b",
    operacao: "UPDATE",
    quando: horasAtras(74),
    quem: DIEGO,
    antes: { telefone: null, contato: "" },
    depois: { telefone: "(11) 98888-1122", contato: "Otto Visão" },
  },
];

export async function trilhaDeAuditoria(
  filtros: FiltrosDaAuditoria,
): Promise<PaginaDaAuditoria> {
  let linhas = LINHAS;
  if (filtros.tabela) linhas = linhas.filter((l) => l.tabela === filtros.tabela);
  if (filtros.quem) linhas = linhas.filter((l) => l.quem?.id === filtros.quem);
  return { linhas, temMais: false };
}

export async function quemApareceNaAuditoria(): Promise<{ id: string; nome: string }[]> {
  return [ANA, DIEGO];
}
