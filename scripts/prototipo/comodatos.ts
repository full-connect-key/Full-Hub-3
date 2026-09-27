/**
 * Versao de prototipo de src/lib/dados/comodatos.ts.
 *
 * O inventario foi escolhido para as imagens mostrarem o que a tela FAZ, e nao
 * so o que ela desenha:
 *
 *   - um notebook com a Marina, ACEITO -- o caso normal, e a referencia contra
 *     a qual os outros se leem;
 *   - uma camera com o Bruno, SEM ACEITE e com devolucao ATRASADA: sao os dois
 *     destaques da tela do colaborador e dois dos cartoes do painel de uma vez;
 *   - um monitor com alguem que SAIU DA AGENCIA, que e o alerta em `--danger`
 *     -- sem ele a faixa mais importante da visao geral nunca apareceria numa
 *     imagem;
 *   - um tripe DISPONIVEL, para o dialogo de emprestar ter o que oferecer;
 *   - uma lente em MANUTENCAO, para o selo do quarto status existir;
 *   - um HD BAIXADO, que e o que prova que a baixa nao apaga.
 */
import type {
  IndicadoresDoInventario,
  ItemDoInventario,
  LinhaDaFolha,
  MeuComodato,
  PessoaComEquipamento,
} from "../../src/lib/dados/comodatos";

export type { IndicadoresDoInventario, ItemDoInventario, LinhaDaFolha, MeuComodato, PessoaComEquipamento };

export { indicadoresDoInventario } from "../../src/lib/dados/comodatos";

const MARINA = "a0000000-0000-0000-0000-000000000005";
const BRUNO = "a0000000-0000-0000-0000-000000000004";
const SAIU = "a0000000-0000-0000-0000-00000000000f";

const ONTEM = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const ITENS: ItemDoInventario[] = [
  {
    id: "as-1",
    codigo: "FCK-0001",
    tipo: "notebook",
    nome: "MacBook Pro 14 M3",
    marca: "Apple",
    modelo: "A2918",
    numero_serie: "C02X1LMNPQ",
    status: "emprestado",
    estado: "bom",
    valor_aquisicao: 18500,
    foto_url: null,
    foto: null,
    observacoes: null,
    data_aquisicao: "2026-02-10",
    comodato: {
      id: "ln-1",
      user_id: MARINA,
      pessoa: "Marina Alves",
      pessoa_ativa: true,
      avatar: null,
      data_entrega: "2026-03-02",
      data_prevista_devolucao: null,
      aceito_em: "2026-03-03T09:14:00Z",
    },
  },
  {
    id: "as-2",
    codigo: "FCK-0002",
    tipo: "camera",
    nome: "Sony A7 IV",
    marca: "Sony",
    modelo: "ILCE-7M4",
    numero_serie: "SN-778812",
    status: "emprestado",
    estado: "bom",
    valor_aquisicao: 22000,
    foto_url: null,
    foto: null,
    observacoes: null,
    data_aquisicao: "2026-05-20",
    comodato: {
      id: "ln-2",
      user_id: BRUNO,
      pessoa: "Bruno Lima",
      pessoa_ativa: true,
      avatar: null,
      data_entrega: "2026-08-15",
      data_prevista_devolucao: ONTEM(),
      aceito_em: null,
    },
  },
  {
    id: "as-3",
    codigo: "FCK-0003",
    tipo: "monitor",
    nome: 'Monitor LG 27"',
    marca: "LG",
    modelo: "27UP650",
    numero_serie: "LG-4471",
    status: "emprestado",
    estado: "regular",
    valor_aquisicao: 2400,
    foto_url: null,
    foto: null,
    observacoes: null,
    data_aquisicao: "2025-11-03",
    comodato: {
      id: "ln-3",
      user_id: SAIU,
      pessoa: "Tiago Moraes",
      pessoa_ativa: false,
      avatar: null,
      data_entrega: "2026-01-09",
      data_prevista_devolucao: null,
      aceito_em: "2026-01-10T11:02:00Z",
    },
  },
  {
    id: "as-4",
    codigo: "FCK-0004",
    tipo: "tripe",
    nome: "Tripé Manfrotto",
    marca: "Manfrotto",
    modelo: "MK055",
    numero_serie: null,
    status: "disponivel",
    estado: "novo",
    valor_aquisicao: 1800,
    foto_url: null,
    foto: null,
    observacoes: null,
    data_aquisicao: "2027-01-15",
    comodato: null,
  },
  {
    id: "as-5",
    codigo: "FCK-0005",
    tipo: "lente",
    nome: "Sigma 50mm 1.4",
    marca: "Sigma",
    modelo: "Art",
    numero_serie: "SG-2210",
    status: "manutencao",
    estado: "ruim",
    valor_aquisicao: 4200,
    foto_url: null,
    foto: null,
    observacoes: "Foco automático travando.",
    data_aquisicao: "2025-06-01",
    comodato: null,
  },
  {
    id: "as-6",
    codigo: "FCK-0006",
    tipo: "hd_externo",
    nome: "HD externo 4TB",
    marca: "Seagate",
    modelo: null,
    numero_serie: "ST-9931",
    status: "baixado",
    estado: "ruim",
    valor_aquisicao: 900,
    foto_url: null,
    foto: null,
    observacoes: null,
    data_aquisicao: "2024-03-12",
    comodato: null,
  },
];

const MEUS: MeuComodato[] = [
  {
    loan_id: "ln-2",
    asset_id: "as-2",
    codigo: "FCK-0002",
    tipo: "camera",
    nome: "Sony A7 IV",
    marca: "Sony",
    modelo: "ILCE-7M4",
    numero_serie: "SN-778812",
    foto_url: null,
    foto: null,
    data_entrega: "2026-08-15",
    data_prevista_devolucao: ONTEM(),
    data_devolucao: null,
    estado_entrega: "bom",
    estado_devolucao: null,
    acessorios: "duas baterias, cartão 128GB, alça",
    observacoes_entrega: null,
    aceito_em: null,
    devolvido: false,
  },
  {
    loan_id: "ln-1",
    asset_id: "as-1",
    codigo: "FCK-0001",
    tipo: "notebook",
    nome: "MacBook Pro 14 M3",
    marca: "Apple",
    modelo: "A2918",
    numero_serie: "C02X1LMNPQ",
    foto_url: null,
    foto: null,
    data_entrega: "2026-03-02",
    data_prevista_devolucao: null,
    data_devolucao: null,
    estado_entrega: "novo",
    estado_devolucao: null,
    acessorios: "carregador, capa",
    observacoes_entrega: null,
    aceito_em: "2026-03-03T09:14:00Z",
    devolvido: false,
  },
  {
    loan_id: "ln-0",
    asset_id: "as-4",
    codigo: "FCK-0004",
    tipo: "tripe",
    nome: "Tripé Manfrotto",
    marca: "Manfrotto",
    modelo: "MK055",
    numero_serie: null,
    foto_url: null,
    foto: null,
    data_entrega: "2026-04-01",
    data_prevista_devolucao: "2026-06-01",
    data_devolucao: "2026-05-28",
    estado_entrega: "bom",
    estado_devolucao: "bom",
    acessorios: null,
    observacoes_entrega: null,
    aceito_em: "2026-04-01T14:00:00Z",
    devolvido: true,
  },
];

export async function meusComodatos(): Promise<MeuComodato[]> {
  return MEUS;
}

export async function inventario(): Promise<ItemDoInventario[]> {
  return ITENS;
}

export async function porPessoa(itens: ItemDoInventario[]): Promise<PessoaComEquipamento[]> {
  const nomes: [string, string, boolean][] = [
    [MARINA, "Marina Alves", true],
    [BRUNO, "Bruno Lima", true],
    [SAIU, "Tiago Moraes", false],
    ["a0000000-0000-0000-0000-000000000003", "Carla Nunes", true],
  ];
  return nomes
    .map(([id, nome, ativo]) => ({
      user_id: id,
      nome,
      ativo,
      avatar: null,
      itens: itens.filter((i) => i.comodato?.user_id === id),
    }))
    .sort((a, b) => b.itens.length - a.itens.length || a.nome.localeCompare(b.nome));
}

export async function equipamento(id: string): Promise<ItemDoInventario | null> {
  return ITENS.find((i) => i.id === id) ?? ITENS[0] ?? null;
}

// A FOLHA DO PROTOTIPO TEM CONTEUDO, e nao a lista vazia que ela tinha antes
// de a tela existir: a imagem de uma tela em estado vazio nao mostra a tela,
// mostra o estado vazio -- e o que precisa ser conferido aqui e a linha do
// tempo com duas pessoas, que e a razao de a folha existir.
export async function folhaDoEquipamento(_assetId: string): Promise<LinhaDaFolha[]> {
  return [
    {
      id: "f6",
      tipo: "emprestado",
      texto: null,
      estado: "bom",
      // O NOME AQUI E O MESMO DO CARTAO DE CIMA (`as-2`, com o Bruno). A
      // primeira versao punha outra pessoa, e a imagem saiu dizendo "com quem
      // esta: Bruno Lima" sobre uma folha cuja ultima entrega era de outra --
      // dois fatos contraditorios lado a lado, que e como um protótipo
      // inventa um defeito que o produto nao tem.
      pessoa: "Bruno Lima",
      quem: "Ana Souza",
      created_at: "2026-08-15T11:00:00Z",
    },
    {
      id: "f5",
      tipo: "voltou",
      texto: "Sensor limpo na assistencia.",
      estado: "bom",
      pessoa: null,
      quem: "Ana Souza",
      created_at: "2026-08-12T16:30:00Z",
    },
    {
      id: "f4",
      tipo: "manutencao",
      texto: null,
      estado: "ruim",
      pessoa: null,
      quem: "Ana Souza",
      created_at: "2026-07-30T09:20:00Z",
    },
    {
      id: "f3",
      tipo: "devolvido",
      texto: "Devolveu com marca de poeira no sensor.",
      estado: "ruim",
      pessoa: "Marina Alves",
      quem: "Ana Souza",
      created_at: "2026-07-29T17:05:00Z",
    },
    // A ENTREGA QUE PRECEDE A DEVOLUCAO: sem ela a folha mostraria alguem
    // devolvendo o que nunca recebeu, e a linha do tempo deixaria de contar
    // uma historia -- que e a unica coisa que uma folha faz.
    {
      id: "f2",
      tipo: "emprestado",
      texto: null,
      estado: "bom",
      pessoa: "Marina Alves",
      quem: "Ana Souza",
      created_at: "2026-03-02T10:40:00Z",
    },
    {
      id: "f1",
      tipo: "cadastrado",
      texto: null,
      estado: "bom",
      pessoa: null,
      quem: "Ana Souza",
      created_at: "2024-11-04T10:00:00Z",
    },
  ];
}

export async function comodatosEmAbertoDe(_userId: string) {
  return [] as { loan_id: string; codigo: string | null; nome: string; data_entrega: string }[];
}

export async function modeloDoTermo(): Promise<string> {
  return `TERMO DE COMODATO DE EQUIPAMENTO

Pelo presente instrumento, a FULL CONNECT KEY, doravante COMODANTE, entrega a
{{PESSOA}}, doravante COMODATARIA, o equipamento descrito abaixo, em regime de
comodato, para uso exclusivamente profissional nas atividades contratadas.

EQUIPAMENTO
{{EQUIPAMENTO}}
Patrimonio: {{PATRIMONIO}}
Acessorios entregues: {{ACESSORIOS}}
Estado na entrega: {{ESTADO}}
Data da entrega: {{DATA_ENTREGA}}

{{ACEITE}}`;
}

export async function comodatoParaOTermo(
  _loanId: string,
): Promise<Awaited<ReturnType<typeof import("../../src/lib/dados/comodatos").comodatoParaOTermo>>> {
  return null;
}

export async function fotosDoComodato(_loanId: string) {
  return [] as { id: string; momento: string; url: string; assinada: string | null }[];
}
