/**
 * Versao de prototipo de src/lib/dados/calendario.ts.
 *
 * ---------------------------------------------------------------------------
 * UM MES DE EVENTOS, E SO DELES (0105).
 *
 * Ele tinha as seis camadas ao mesmo tempo -- a campanha de trinta dias que
 * provava o `diaNaGrade()`, a ausencia de cinco dias, a peca de campanha, a
 * fase do mes de social e oito posts. As cinco origens sairam da view por
 * decisao do usuario, e com elas a razao de cada um daqueles itens existir
 * aqui: *"ele deve ser apenas para eventos que serao lancados nele, nada de
 * outros abas"*.
 *
 * O QUE O EXEMPLO PRECISA PROVAR MUDOU, e sao quatro coisas:
 *
 *   - UMA FAIXA DE TRES DIAS, para a faixa do topo da semana atravessar a
 *     grade (um item de um dia nao provaria nada);
 *   - UM DIA COM MAIS DE TRES ITENS, para o "+ N mais" sair em imagem -- e ele
 *     e a unica linha que nenhuma outra tela do produto desenha;
 *   - OS CINCO PARES DE COR da legenda, um evento de cada, senao a imagem
 *     mostra cinco entradas de legenda e um tom so na grade. Eram quatro ate a
 *     0109, que deu o azul a "Eventos Fullers" e mandou convencao e feira
 *     para o roxo -- e sem um evento da casa a imagem mostraria a legenda
 *     nova com a amostra azul e nenhum chip azul na grade;
 *   - UM EVENTO SEM EMPRESA e um COM, porque a segunda linha do chip e o
 *     cliente e ela nao aparece quando nao ha -- a convencao da casa.
 *
 * E ELE NAO TEM MAIS `userId` NEM `pessoa`: a view nao escreve `user_id` desde
 * a 0105, e `ItemDoCalendario` perdeu os dois campos. Um stub que os mandasse
 * nao compilaria, o que e o desenho -- `check:prototipo` existe porque o
 * `typecheck` nao ve os stubs.
 * ---------------------------------------------------------------------------
 */
import type {
  EventoDetalhado,
  ItemDoCalendario,
  PessoaDoCalendario,
} from "../../src/lib/dominio/calendario";

const HOJE = new Date();
const dia = (delta: number) =>
  new Date(HOJE.getTime() + delta * 864e5).toISOString().slice(0, 10);

const VERDE = "c0000000-0000-0000-0000-00000000000a";
const OPTICA = "c0000000-0000-0000-0000-00000000000b";

const ANA = { id: "a0000000-0000-0000-0000-000000000001", nome: "Ana Souza", avatar_url: null };
const BRUNO = { id: "a0000000-0000-0000-0000-000000000004", nome: "Bruno Lima", avatar_url: null };
const MARINA = { id: "a0000000-0000-0000-0000-000000000005", nome: "Marina Costa", avatar_url: null };
const CARLA = { id: "a0000000-0000-0000-0000-000000000003", nome: "Carla Nunes", avatar_url: null };
const RAFAEL = { id: "a0000000-0000-0000-0000-000000000006", nome: "Rafael Dias", avatar_url: null };

// A LISTA SERVE AOS PARTICIPANTES DO EVENTO, e mais nada: o filtro "Filtrar
// por responsavel" saiu na 0105, porque a view nao escreve `user_id` e ele
// devolveria zero sempre.
export const PESSOAS: PessoaDoCalendario[] = [CARLA, BRUNO, MARINA, RAFAEL, ANA];

/** `status` carrega `events.tipo`, e e dele que sai a cor do chip. */
const evento = (
  id: string,
  titulo: string,
  tipo: string,
  de: number,
  ate: number,
  cliente: { id: string; nome: string } | null,
): ItemDoCalendario => ({
  id,
  tipo: "evento",
  titulo,
  dataInicio: dia(de),
  dataFim: dia(ate),
  clientId: cliente?.id ?? null,
  cliente: cliente?.nome ?? null,
  status: tipo,
  link: `/painel/calendario?evento=${id}`,
});

const MV = { id: VERDE, nome: "Mundo Verde" };
const OV = { id: OPTICA, nome: "Óptica Visão" };

const ITENS: ItemDoCalendario[] = [
  // A FAIXA DE TRES DIAS, que e o que atravessa a semana no topo da grade.
  evento("ev-feira", "Feira do Mundo Verde", "feira", 2, 4, MV),
  // SEM EMPRESA: a segunda linha do chip nao aparece, que e o estado da
  // convencao e do feriado da casa.
  evento("ev-convencao", "Convenção da agência", "convencao", 9, 10, null),
  // O PAR DO AZUL, que e o da propria agencia (0109). Sem empresa pela
  // definicao da categoria: um evento dos Fullers nao e de conta nenhuma.
  evento("ev-fullers", "Confraternização dos Fullers", "evento_fullers", 12, 12, null),
  // OS OUTROS TRES PARES DA LEGENDA, um de cada.
  evento("ev-lancamento", "Lançamento da linha Verão", "lancamento", 5, 5, MV),
  evento("ev-feriado", "Feriado da Óptica Visão", "feriado_cliente", 5, 5, OV),
  evento("ev-reuniao", "Reunião de planejamento", "reuniao", 5, 5, MV),
  evento("ev-treinamento", "Treinamento de atendimento", "treinamento", 5, 5, null),
  // O QUARTO ITEM DO MESMO DIA, e nao o terceiro: a celula do mes corta em
  // tres, e sem ele o "+ N mais" nao sai em imagem nenhuma.
  evento("ev-outro", "Visita do fornecedor", "outro", 5, 5, OV),
  evento("ev-reuniao-2", "Reunião com a Óptica", "reuniao", 1, 1, OV),
  evento("ev-lancamento-2", "Lançamento do app", "lancamento", 16, 16, MV),
];

/**
 * O STUB HONRA OS FILTROS, e nao devolve a lista inteira sempre.
 *
 * A primeira versao ignorava tudo, e a imagem saia com o chip aceso e as
 * mesmas vinte linhas de antes -- uma imagem que afirma que o filtro existe e
 * nao prova que ele filtra.
 *
 * SOBROU UM FILTRO, e ele e o unico que a 0105 deixou de pe: `camadas`,
 * `responsaveis` e `soMinhas` sairam porque os tres perguntavam por uma coisa
 * que a view nao escreve mais.
 */
export async function itensDoCalendario(filtros: {
  de: string;
  ate: string;
  clientes?: string[];
}): Promise<ItemDoCalendario[]> {
  let visiveis = ITENS;

  if (filtros.clientes?.length) {
    visiveis = visiveis.filter((i) => i.clientId && filtros.clientes!.includes(i.clientId));
  }

  return visiveis;
}

export async function pessoasDaEquipeNoCalendario(): Promise<PessoaDoCalendario[]> {
  return PESSOAS;
}

export async function obterEvento(id: string): Promise<EventoDetalhado | null> {
  if (id === "ev-convencao") {
    return {
      id,
      nome: "Convenção da agência",
      descricao: "Dois dias fora do escritório. Ninguém marca entrega nesta semana.",
      tipo: "convencao",
      clientId: null,
      cliente: null,
      dataInicio: dia(9),
      dataFim: dia(10),
      diaInteiro: true,
      horaInicio: null,
      horaFim: null,
      local: "Expo Center Norte",
      link: "https://exemplo.com/convencao",
      bloqueiaFerias: true,
      participantes: [BRUNO, MARINA, CARLA],
    };
  }
  if (id === "ev-feira") {
    return {
      id,
      nome: "Feira do Mundo Verde",
      descricao: null,
      tipo: "feira",
      clientId: VERDE,
      cliente: "Mundo Verde",
      dataInicio: dia(2),
      dataFim: dia(4),
      diaInteiro: true,
      horaInicio: null,
      horaFim: null,
      local: null,
      link: null,
      bloqueiaFerias: false,
      participantes: [],
    };
  }
  return null;
}
