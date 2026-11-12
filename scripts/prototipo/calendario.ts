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

/**
 * A SEMANA QUE A VISAO DE SEMANA ABRE e a do DIA 1 do mes --
 * `janelaDoPeriodo()` faz `segundaDaSemana(primeiroDiaDoMes(mes))` --, e todo
 * item deste arquivo era datado a FRENTE de hoje. Com isso
 * `92-calendario-semana` saia com a semana VAZIA: sete cabecalhos de dia e nada
 * dentro, numa imagem que nao provava chip nenhum -- nem o par de cor, nem a
 * segunda linha do cliente, nem a marca do aniversario. Foi a entrega da marca
 * (o bolo no chip) que encontrou, porque ela precisava da imagem para ser
 * conferida.
 *
 * O DIA 1 e o unico que esta naquela semana em QUALQUER mes: a segunda-feira
 * dela cai entre o dia 26 do mes anterior e o proprio dia 1, entao o dia 2 so
 * as vezes. E ele e CALCULADO e nao literal, que e a licao dos meses da nota
 * fiscal: uma data fixa para de cair na janela sozinha, e a imagem sai igual
 * sem nada reclamar.
 */
const DIA_UM = `${dia(0).slice(0, 8)}01`;

/** Delta de dias a partir de hoje, ou a data pronta. */
const emQue = (d: number | string) => (typeof d === "number" ? dia(d) : d);

/** `status` carrega `events.tipo`, e e dele que sai a cor do chip. */
const evento = (
  id: string,
  titulo: string,
  tipo: string,
  de: number | string,
  ate: number | string,
  cliente: { id: string; nome: string } | null,
): ItemDoCalendario => ({
  id,
  tipo: "evento",
  titulo,
  dataInicio: emQue(de),
  dataFim: emQue(ate),
  clientId: cliente?.id ?? null,
  cliente: cliente?.nome ?? null,
  status: tipo,
  link: `/painel/calendario?evento=${id}`,
});

/**
 * O ANIVERSARIO (0130), que vem da ficha da equipe e nao de `events`.
 *
 * Sem empresa, sem `status` e sem link: ele nao e um evento que alguem
 * lancou, e o chip dele nao abre painel nenhum.
 */
const aniversario = (id: string, nome: string, quando: number | string): ItemDoCalendario => ({
  id,
  tipo: "aniversario",
  titulo: nome,
  dataInicio: emQue(quando),
  dataFim: emQue(quando),
  clientId: null,
  cliente: null,
  status: null,
  link: "",
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
  // O EVENTO DA SEMANA DA VIRADA, e ele divide o dia com um aniversario de
  // proposito: lado a lado, a imagem da semana prova que a marca DISTINGUE o
  // chip rosa do chip ao lado -- com o aniversario sozinho na coluna, ela
  // provaria so que o bolo aparece. E ele tem empresa, porque a segunda linha
  // do chip da semana e o cliente e ela nao saia em imagem nenhuma.
  //
  // E ELE NAO E `reuniao`, que foi a primeira versao: aquele tipo usa o par
  // CINZA (`bg-muted`), e a celula de fim de semana e a de outro mes usam o
  // MESMO `bg-muted` -- o dia 1 cai num sabado ou num domingo em dois meses de
  // sete, e nesses a imagem saia com o chip vizinho sem chao nenhum, lido como
  // texto solto. Um par visivel em qualquer celula e o que faz a comparacao
  // valer no mes que for.
  evento("ev-briefing", "Lançamento do catálogo", "lancamento", DIA_UM, DIA_UM, MV),

  // OS ANIVERSARIOS (0130), e SAO DOIS e nao um.
  //
  // Sem nenhum, a legenda ganharia a sexta amostra e a grade nao teria um
  // chip rosa: a imagem mostraria uma entrada de legenda sem par na tela, que
  // e exatamente o que a 0109 pagou ao acrescentar o quinto.
  //
  // E sao dois porque um deles divide o dia com outros eventos e o outro esta
  // sozinho: com um so, a imagem provaria que o chip aparece e nao que ele se
  // distingue do que esta ao lado.
  //
  // `tipo: "aniversario"` E A ORIGEM, e e por ela que `corDoEvento()` escolhe
  // o rosa e `abreDetalhe()` recusa abrir o painel. `status` e nulo de
  // proposito: um aniversario nao tem `events.tipo`.
  // A ANA DIVIDE O DIA COM O EVENTO AZUL, e nao com os quatro do dia 16: la
  // ela caiu dentro do "+ 3 mais" e a imagem mostrava um chip rosa sozinho
  // numa celula vazia -- provando que ele aparece, e nao que ele se distingue
  // do que esta ao lado. Foi a imagem que mostrou.
  aniversario("ani-ana", "Ana Lima", 12),
  aniversario("ani-bruno", "Bruno Tavares", 19),
  // O TERCEIRO ESTA NA SEMANA DA VIRADA, que e a unica que a visao de SEMANA
  // abre, e o NOME DELE E LONGO de proposito: o chip ganhou o bolo, e o bolo
  // come 16px da linha -- com um nome curto a imagem nao mostraria o `truncate`
  // valendo, que e o bug que o selo de prazo do board de etapas e a coluna de
  // domingo do Cronograma pagaram cada um uma vez (item de flex se recusa a
  // ficar menor que o conteudo, e o texto estoura em vez de cortar).
  aniversario("ani-duda", "Maria Eduarda Nogueira", DIA_UM),
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
