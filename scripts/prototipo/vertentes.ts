/**
 * As vertentes de exemplo (migration 0118).
 *
 * **A MUNDO VERDE TEM AS CINCO DO PEDIDO**, e elas são as do usuário: *"o
 * exemplo apresenta cinco vertentes, considerando 'Nutricionistas e
 * Franqueados' uma única área"*.
 *
 * **A ÓPTICA VISÃO NÃO TEM NENHUMA, de propósito.** Conta sem vertente é um
 * estado de verdade do produto — a demanda dela não pede área —, e com as
 * duas contas cadastradas nenhuma imagem mostraria o vazio nem o seletor
 * ausente. É a lição da Óptica Visão sem atendente (0062) e da peça de
 * campanha sem fixture: o exemplo que mostra o produto num estado só esconde
 * uma classe inteira de bug.
 *
 * **E UMA DELAS ESTÁ DESATIVADA**, pela mesma razão: ela é o único jeito de a
 * imagem provar que a lista distingue a ativa da aposentada, e que a
 * desativada continua na tela em vez de sumir.
 */
import type { Vertente } from "@/lib/dominio/vertentes";

const MUNDO_VERDE = "c0000000-0000-0000-0000-00000000000a";

export const VERTENTES_EXEMPLO: Vertente[] = [
  { id: "ee000000-0000-0000-0000-000000000001", client_id: MUNDO_VERDE, nome: "Institucional", ordem: 10, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000002", client_id: MUNDO_VERDE, nome: "Lojas Próprias", ordem: 20, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000003", client_id: MUNDO_VERDE, nome: "Marca Própria", ordem: 30, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000004", client_id: MUNDO_VERDE, nome: "Nutricionistas e Franqueados", ordem: 40, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000005", client_id: MUNDO_VERDE, nome: "E-commerce", ordem: 50, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000006", client_id: MUNDO_VERDE, nome: "Feiras e eventos", ordem: 60, ativa: false, created_at: "2026-01-10T10:00:00.000Z" },
];

export async function vertentesDoCliente(clienteId: string | null): Promise<Vertente[]> {
  if (!clienteId) return [];
  return VERTENTES_EXEMPLO.filter((v) => v.client_id === clienteId);
}

export async function vertentesDasContas(
  clienteIds: string[],
): Promise<Map<string, Vertente[]>> {
  const mapa = new Map<string, Vertente[]>();
  for (const v of VERTENTES_EXEMPLO) {
    if (!clienteIds.includes(v.client_id)) continue;
    const lista = mapa.get(v.client_id) ?? [];
    lista.push(v);
    mapa.set(v.client_id, lista);
  }
  return mapa;
}

/**
 * DE QUE VERTENTE É CADA MATERIAL (migration 0119).
 *
 * **A chave é `tipo-conteudoId`**, igual à da função de verdade, e os ids são
 * os mesmos do stub de `portal.ts` — é o que faz a imagem conferir a ligação e
 * não o stub.
 *
 * **E A ESCOLHA DE QUEM TEM O QUÊ É O QUE A IMAGEM PROVA:**
 *
 *  * DOIS materiais aprovados na MESMA vertente (os dois de E-commerce), senão
 *    todo chip sairia com "1" e a contagem não provaria que ela conta;
 *  * UM aprovado SEM vertente nenhuma, senão o chip "Sem vertente" não sairia
 *    em imagem nenhuma — e ele é o estado comum de toda conta que não cadastrou
 *    frente;
 *  * a PEÇA DE CAMPANHA com vertente, porque ela é a razão de a migration
 *    existir: a vertente dela mora na demanda da campanha, que o cliente não
 *    enxerga. Sem ela, a imagem provaria só o caminho da etapa de demanda;
 *  * e a maioria das seis vertentes SEM material, que é a resposta certa para
 *    uma frente recém-cadastrada — e o que a fileira tem de dizer em vez de
 *    esconder o chip.
 */
const VERTENTE_DO_MATERIAL: Record<string, string> = {
  // Os dois de E-commerce: a contagem do chip sai "2".
  "subtask-i3": "ee000000-0000-0000-0000-000000000005",
  "subtask-i5": "ee000000-0000-0000-0000-000000000005",
  // A peça de campanha — o caminho que só a 0119 alcança.
  "deliverable-d-kv": "ee000000-0000-0000-0000-000000000001",
  // `subtask-i6` fica FORA de propósito: é ele o "Sem vertente".
  // Os de fora da Biblioteca (não aprovados) ficam porque a função é do
  // material e não desta tela: o relatório por vertente vai lê-los.
  "post-p1": "ee000000-0000-0000-0000-000000000002",
  "subtask-i1": "ee000000-0000-0000-0000-000000000003",
};

export async function vertenteDosMateriais(ids: {
  subtasks: string[];
  posts: string[];
  entregaveis: string[];
}): Promise<Map<string, string>> {
  // ELE FILTRA DE VERDADE, pelos ids recebidos. Um stub que devolve o mapa
  // inteiro passaria por uma tela que mandou a lista errada — é a lição do
  // filtro de vertente do board, que a imagem pegou porque o stub aplicava o
  // cliente e não a vertente.
  const chaves = [
    ...ids.subtasks.map((id) => `subtask-${id}`),
    ...ids.posts.map((id) => `post-${id}`),
    ...ids.entregaveis.map((id) => `deliverable-${id}`),
  ];

  const mapa = new Map<string, string>();
  for (const chave of chaves) {
    const vertente = VERTENTE_DO_MATERIAL[chave];
    if (vertente) mapa.set(chave, vertente);
  }
  return mapa;
}
