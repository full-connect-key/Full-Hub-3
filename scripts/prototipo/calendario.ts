/**
 * Versao de prototipo de src/lib/dados/calendario.ts.
 *
 * Um mes com as sete origens ao mesmo tempo, que e o unico estado em que a
 * tela tem o que mostrar:
 *
 *   - uma FEIRA de tres dias, para a faixa atravessar a semana (item dia a dia
 *     nao provaria nada);
 *   - uma CONVENCAO que bloqueia periodo, com participantes;
 *   - uma CAMPANHA de trinta dias, que na grade do mes precisa aparecer NUM
 *     dia so -- e na Linha do Tempo como barra longa. E o par que prova o
 *     `diaNaGrade()`;
 *   - etapas espalhadas por varias pessoas, com uma sobrecarregada, para a
 *     Linha do Tempo ter o que pintar de vermelho;
 *   - uma AUSENCIA de cinco dias em cima de uma etapa, que e exatamente o
 *     caso que o calendario existe para mostrar.
 */
import type {
  CargaDeUmDia,
  EventoDetalhado,
  ItemDoCalendario,
  PessoaDaLinha,
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

export const PESSOAS: PessoaDaLinha[] = [
  { ...CARLA, area: "Atendimento", capacidadeMinutos: 480 },
  { ...BRUNO, area: "Criação", capacidadeMinutos: 480 },
  { ...MARINA, area: "Criação", capacidadeMinutos: 480 },
  // MEIO PERIODO, e e por isso que a capacidade e coluna e nao constante: a
  // mesma carga que e folga para quem tem 8h estoura para quem tem 4h.
  { ...RAFAEL, area: "Mídia", capacidadeMinutos: 240 },
  { ...ANA, area: "Direção", capacidadeMinutos: 480 },
];

const ITENS: ItemDoCalendario[] = [
  // A CAMPANHA DE TRINTA DIAS. Na grade do mes ela sai no dia em que acaba;
  // na Linha do Tempo, como barra. Uma linha, dois desenhos.
  {
    id: "camp-wave",
    tipo: "campanha",
    titulo: "Wave Outubro Rosa",
    dataInicio: dia(-12),
    dataFim: dia(8),
    clientId: VERDE,
    cliente: "Mundo Verde",
    userId: null,
    pessoa: null,
    prioridade: null,
    status: "ativa",
    link: "/painel/aprovacoes/campanhas/camp-wave",
  },
  {
    id: "ev-feira",
    tipo: "evento",
    titulo: "Feira do Mundo Verde",
    dataInicio: dia(2),
    dataFim: dia(4),
    clientId: VERDE,
    cliente: "Mundo Verde",
    userId: null,
    pessoa: null,
    prioridade: null,
    status: "feira",
    link: "/painel/calendario?evento=ev-feira",
  },
  {
    id: "ev-convencao",
    tipo: "evento",
    titulo: "Convenção da agência",
    dataInicio: dia(9),
    dataFim: dia(10),
    clientId: null,
    cliente: null,
    userId: null,
    pessoa: null,
    prioridade: null,
    status: "convencao",
    link: "/painel/calendario?evento=ev-convencao",
  },
  // A AUSENCIA EM CIMA DAS ETAPAS DO BRUNO: o caso que o calendario existe
  // para mostrar.
  {
    id: "aus-bruno",
    tipo: "ausencia",
    titulo: "Descanso",
    dataInicio: dia(3),
    dataFim: dia(7),
    clientId: null,
    cliente: null,
    userId: BRUNO.id,
    pessoa: BRUNO,
    prioridade: null,
    status: "aprovada",
    link: "/painel/full-days",
  },
  // A PECA DA CAMPANHA E A ETAPA DO POST: as duas camadas que o stub nao
  // cobria. Depois da 0077 a `calendar_events` tem SEIS origens, e uma imagem
  // que mostra quatro delas nao prova a legenda -- e e ela que o protótipo
  // existe para conferir.
  {
    id: "ent-lamina",
    tipo: "entregavel",
    titulo: "Lâmina A5",
    dataInicio: dia(4),
    dataFim: dia(4),
    clientId: OPTICA,
    cliente: "Óptica Visão",
    userId: CARLA.id,
    pessoa: CARLA,
    prioridade: null,
    status: "em_producao",
    link: "/painel/aprovacoes/campanhas/camp-wave?item=ent-lamina",
  },
  // A FASE DO MÊS, e não a etapa de uma peça: o título é o nome da fase e o
  // link vai para o MÊS, que é o que a origem da 0090 escreve
  // (`'/painel/social-media?mes=' || t.id`). Com o título de uma peça aqui, a
  // imagem mostraria a camada que a 0088 tirou.
  {
    id: "fase-layout-mv",
    tipo: "fase_de_social",
    titulo: "Layout",
    dataInicio: dia(2),
    dataFim: dia(2),
    clientId: VERDE,
    cliente: "Mundo Verde",
    userId: BRUNO.id,
    pessoa: BRUNO,
    prioridade: null,
    status: "em_andamento",
    link: "/painel/social-media?mes=mes-mv-10",
  },
];

// ---------------------------------------------------------------------------
// AS ETAPAS NAO SAO MAIS ITEM DO CALENDARIO, E CONTINUAM SENDO CARGA.
//
// A 0077 tirou a demanda e a etapa da `calendar_events` -- elas vivem em
// Minhas Tasks. O que NAO saiu e o peso delas: a cor da celula da Linha do
// Tempo e OCUPACAO, e ela vem de `carga_da_equipe()` chamando `carga_do_dia()`
// (0035), que leem `subtasks` direto e nao a view.
//
// Por isso esta lista deixou de ser empurrada para `ITENS` e passou a
// alimentar so a carga -- que e exatamente a separacao do produto. Deixa-la
// nos itens faria a imagem do prototipo mostrar uma camada que a tela nao tem,
// e e esse tipo de dado de exemplo que mostra o produto como ele nao e.
//
// Com o Bruno carregado e o Rafael estourado: sem uma pessoa em cada extremo,
// a barra de carga sairia toda da mesma cor e a legenda nao significaria nada.
// ---------------------------------------------------------------------------
const ETAPAS: [number, typeof BRUNO][] = [
  [1, BRUNO],
  [2, BRUNO],
  [2, MARINA],
  [3, RAFAEL],
  [3, RAFAEL],
  [5, CARLA],
  [6, MARINA],
];

const ETAPAS_POR_DIA = ETAPAS.map(([delta, pessoa]) => ({
  dia: dia(delta),
  userId: pessoa.id,
}));

const POSTS = [1, 1, 2, 5, 5, 8];
POSTS.forEach((delta, i) => {
  ITENS.push({
    id: `post-${i}`,
    tipo: "post",
    titulo: `Post ${i + 1} — dica do dia`,
    dataInicio: dia(delta),
    dataFim: dia(delta),
    clientId: VERDE,
    cliente: "Mundo Verde",
    userId: MARINA.id,
    pessoa: MARINA,
    prioridade: null,
    status: "em_aprovacao",
    link: `/painel/social-media?post=post-${i}`,
  });
});

/**
 * O STUB HONRA OS FILTROS, e nao devolve a lista inteira sempre.
 *
 * A primeira versao ignorava tudo. A imagem do colaborador saia com o chip
 * "So minha pauta" aceso e as mesmas vinte linhas de antes -- uma imagem que
 * afirma que o filtro existe e nao prova que ele filtra. E o mesmo defeito de
 * uma checagem que so sabe dizer "ok".
 */
export async function itensDoCalendario(filtros: {
  de: string;
  ate: string;
  camadas?: string[];
  clientes?: string[];
  responsaveis?: string[];
  soMinhas?: string | null;
}): Promise<ItemDoCalendario[]> {
  let visiveis = ITENS;

  if (filtros.camadas?.length) {
    visiveis = visiveis.filter((i) => filtros.camadas!.includes(i.tipo));
  }
  if (filtros.clientes?.length) {
    visiveis = visiveis.filter((i) => i.clientId && filtros.clientes!.includes(i.clientId));
  }
  if (filtros.responsaveis?.length) {
    visiveis = visiveis.filter((i) => i.userId && filtros.responsaveis!.includes(i.userId));
  }
  if (filtros.soMinhas) {
    // O que e meu MAIS o que e da agencia -- a mesma regra do app: a convencao
    // da semana que vem muda o meu dia sem ter o meu nome.
    visiveis = visiveis.filter((i) => i.userId === filtros.soMinhas || i.userId === null);
  }

  return visiveis;
}

export async function pessoasDaLinhaDoTempo(): Promise<PessoaDaLinha[]> {
  return PESSOAS;
}

export async function cargaDaEquipe(inicio: string, fim: string): Promise<CargaDeUmDia[]> {
  const carga: CargaDeUmDia[] = [];
  const cursor = new Date(`${inicio}T12:00:00Z`);
  const ate = new Date(`${fim}T12:00:00Z`);

  while (cursor <= ate) {
    const iso = cursor.toISOString().slice(0, 10);
    const diaDaSemana = cursor.getUTCDay();
    if (diaDaSemana !== 0 && diaDaSemana !== 6) {
      for (const pessoa of PESSOAS) {
        const dela = ETAPAS_POR_DIA.filter((e) => e.userId === pessoa.id && e.dia === iso);
        carga.push({
          userId: pessoa.id,
          dia: iso,
          // 300 minutos por etapa e o que faz DUAS etapas estourarem um dia
          // de 8h -- e uma so ja estourar o de meio periodo do Rafael.
          minutos: dela.length * 300,
          etapas: dela.length,
          semEstimativa: 0,
          ausente: ITENS.some(
            (i) =>
              i.tipo === "ausencia" &&
              i.userId === pessoa.id &&
              iso >= i.dataInicio &&
              iso <= i.dataFim,
          ),
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return carga;
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
