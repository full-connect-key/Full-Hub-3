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
 *   - e, desde a 0135, uma BUSCA que casa: a coluna "O que mudou" saiu da
 *     tabela, e o campo encontrado e a unica coisa que diz por que aquela
 *     linha esta no resultado. Sem o stub busca-lo, a peca nova nao sairia em
 *     imagem nenhuma -- a lição da duplicata do Cronograma.
 *
 * O `antes`/`depois` CONTINUA AQUI DENTRO, e deixou de sair daqui: a funcao de
 * verdade procura dentro dele no Postgres e devolve so o campo que casou. O
 * stub faz a mesma coisa em TypeScript -- guardar o jsonb e a unica forma de
 * ele poder responder a busca, e devolve-lo seria a coluna voltando por outro
 * caminho.
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
import type { Operacao } from "../../src/lib/dominio/auditoria";

export type { FiltrosDaAuditoria, LinhaDaAuditoria, PaginaDaAuditoria };

function horasAtras(quantas: number): string {
  return new Date(Date.now() - quantas * 3600_000).toISOString();
}

const ANA = { id: "a0000000-0000-0000-0000-000000000001", nome: "Ana Souza" };
const DIEGO = { id: "a0000000-0000-0000-0000-000000000002", nome: "Diego Lima" };

/** A linha como ela mora no banco: com o que mudou dentro. */
type NoBanco = {
  id: string;
  tabela: string;
  registroId: string | null;
  operacao: Operacao;
  quando: string;
  quem: { id: string; nome: string } | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
};

const LINHAS: NoBanco[] = [
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
    // ELA E A LINHA QUE A BUSCA ENCONTRA, e e por isso que ela renomeia a
    // empresa: `registrar_auditoria()` grava so as colunas que mudaram, entao
    // o nome de um cliente so esta na linha em que ele FOI o que mudou. Com
    // ela aqui, a imagem da busca por "Optica" mostra o campo encontrado --
    // e a de sem acento mostra que `sem_acento()` dobra os dois lados.
    quando: horasAtras(74),
    quem: DIEGO,
    antes: { nome_empresa: "Otica Visao", telefone: null },
    depois: { nome_empresa: "Óptica Visão", telefone: "(11) 98888-1122" },
  },
];

/** Dobra caixa e acento, como `sem_acento()` no Postgres (0073). */
function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * O campo que casou, na ordem de `depois` antes de `antes`.
 *
 * E a mesma ordem do `left join lateral` da 0135: os dois valores sao
 * procurados -- quem busca o nome ANTIGO acha a linha que o trocou -- e o de
 * depois e o que aparece.
 */
function encontrar(linha: NoBanco, termo: string) {
  const alvo = semAcento(termo);
  for (const documento of [linha.depois, linha.antes]) {
    for (const [campo, valor] of Object.entries(documento ?? {})) {
      if (valor === null || valor === undefined) continue;
      const texto = String(valor);
      if (semAcento(texto).includes(alvo)) return { campo, valor: texto };
    }
  }
  return null;
}

export async function trilhaDeAuditoria(
  filtros: FiltrosDaAuditoria,
): Promise<PaginaDaAuditoria> {
  let linhas = LINHAS;
  if (filtros.tabela) linhas = linhas.filter((l) => l.tabela === filtros.tabela);
  if (filtros.quem) linhas = linhas.filter((l) => l.quem?.id === filtros.quem);

  const termo = filtros.busca?.trim() ?? "";

  const comBusca = linhas.map((linha) => ({
    linha,
    encontrado: termo === "" ? null : encontrar(linha, termo),
  }));

  const visiveis =
    termo === ""
      ? comBusca
      : comBusca.filter(
          (l) =>
            l.encontrado !== null ||
            semAcento(l.linha.quem?.nome ?? "").includes(semAcento(termo)),
        );

  return {
    temMais: false,
    linhas: visiveis.map(({ linha, encontrado }) => ({
      id: linha.id,
      tabela: linha.tabela,
      registroId: linha.registroId,
      operacao: linha.operacao,
      quando: linha.quando,
      quem: linha.quem,
      encontrado,
    })),
  };
}

export async function quemApareceNaAuditoria(): Promise<{ id: string; nome: string }[]> {
  return [ANA, DIEGO];
}
