/**
 * Versao de prototipo de src/lib/dados/calendario.ts.
 *
 * Um mes com as seis camadas ao mesmo tempo, que e o unico estado em que a
 * tela tem o que mostrar:
 *
 *   - uma FEIRA de tres dias, para a faixa atravessar a semana (item dia a dia
 *     nao provaria nada);
 *   - uma CONVENCAO que bloqueia periodo, com participantes;
 *   - uma CAMPANHA de trinta dias, que na grade do mes aparece NUM dia so, o
 *     do encerramento: e ela que prova o `diaNaGrade()`;
 *   - uma AUSENCIA de cinco dias, que e exatamente o caso que o calendario
 *     existe para mostrar;
 *   - um DIA COM MAIS DE TRES itens, para o "+ N mais" sair em imagem.
 *
 * A CARGA SAIU COM A LINHA DO TEMPO. Havia aqui uma lista de etapas por
 * pessoa, com uma sobrecarregada, que alimentava `cargaDaEquipe()` e mais
 * nada -- e a visao que a pintava nao existe mais. Quem continua provando a
 * escala de carga em imagem e a faixa de disponibilidade, no painel da etapa.
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

// A LISTA SERVE AO FILTRO DE RESPONSAVEL e aos participantes do evento, e
// mais nada: area e capacidade sairam do tipo junto com a Linha do Tempo, que
// era quem agrupava por area e dividia os minutos pela capacidade.
export const PESSOAS: PessoaDoCalendario[] = [CARLA, BRUNO, MARINA, RAFAEL, ANA];

const ITENS: ItemDoCalendario[] = [
  // A CAMPANHA DE TRINTA DIAS. Na grade do mes ela sai no dia em que ACABA, e
  // nao como faixa de trinta celulas: e ela que prova o `diaNaGrade()`.
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

// QUATRO NO MESMO DIA, e nao tres: a celula do mes corta em tres, e sem o
// quarto o "+ N mais" nao sai em imagem nenhuma -- que e justamente a linha
// que nenhuma outra tela do produto desenha.
const POSTS = [1, 1, 1, 1, 2, 5, 5, 8];
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
