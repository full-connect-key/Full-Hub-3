import { ANCORAS } from "./ancoras";
import type { PassoDoTour, Tour } from "./passos";

/**
 * OS MICRO-TOURS DE MÓDULO.
 *
 * ---------------------------------------------------------------------------
 * **TRÊS A CINCO PASSOS SOBRE AQUELA TELA, na primeira visita** — e cada um é
 * `tour_id` próprio, pulável e refazível independente do tour de boas-vindas.
 * É o pedido do sprint, e a frase dele sobre eles é *"é aqui que mora a maior
 * parte do valor"*: o tour do painel ensina onde as coisas estão, e o
 * micro-tour ensina o que a tela faz.
 * ---------------------------------------------------------------------------
 *
 * **AS ÂNCORAS SÃO AS DA CASCA, e o que muda é o TEXTO.** A razão está escrita
 * em `ancoras.ts`: nove módulos com três passos cada seriam trinta e cinco
 * elementos marcados em nove telas, e trinta e cinco lugares onde um seletor
 * envelhece. A barra de contexto, a fileira de ações e a área de conteúdo são
 * o esqueleto de todas elas.
 *
 * Onde o módulo JÁ TEM âncora própria — o "+ Nova task", a aba de aprovações
 * internas, a aba dos pedidos do Full Days —, o passo aponta para ela: ali a
 * frase e o elemento dizem a mesma coisa.
 *
 * **E TODO PASSO AQUI É `opcional`**, com uma exceção nenhuma. O que estes
 * tours apontam depende do perfil e do estado da tela: a barra de contexto não
 * existe num módulo de uma seção só ("menos de duas seções não vira barra"), a
 * fileira de ações só existe onde há ação, e a aba de aprovações internas é da
 * gestão. Sem a bandeira, cada micro-tour feito por um colaborador gravaria
 * linhas em `passos_sem_ancora` — e o alarme de tour quebrado passaria a
 * acusar as regras de perfil do produto.
 */

/** Monta um passo explicativo opcional, que é a forma de quase todos. */
function passo(
  id: string,
  ancora: PassoDoTour["ancora"],
  titulo: string,
  texto: string,
): PassoDoTour {
  return { id, ancora, titulo, texto, tipo: "explicativo", opcional: true };
}

/**
 * ROTA → MICRO-TOUR, e a chave é o PREFIXO da rota.
 *
 * Quem resolve é `microTourDaRota()`, pelo prefixo mais longo — a mesma forma
 * de `findMenuItem` em `lib/auth/permissions.ts`. Com igualdade exata, o
 * micro-tour de Gestão de Tasks sumiria na tela de detalhe de uma demanda, que
 * é onde a pessoa chega primeiro vindo de um aviso do sino.
 */
const MICRO_TOURS: Readonly<Record<string, Tour>> = {
  "/painel/gestao-tasks": {
    id: "modulo:gestao-tasks",
    versao: 1,
    passos: [
      passo(
        "secoes",
        ANCORAS.secoesDoModulo,
        "Quatro seções, um assunto",
        "As demandas, os workflows, as recorrentes e a fila de aval interno.",
      ),
      passo(
        "nova-task",
        ANCORAS.novaTask,
        "A demanda nasce no clique",
        "Ela abre como rascunho, só sua, e tudo salva sozinho campo a campo.",
      ),
      passo(
        "visao",
        ANCORAS.seletorDeVisao,
        "Board, Lista ou Calendário",
        "São três desenhos do mesmo recorte. O filtro continua o mesmo ao trocar.",
      ),
      passo(
        "aval",
        ANCORAS.abaAprovacoesInternas,
        "Nada sai sem passar aqui",
        "O selo conta quantas peças esperam decisão. Sem fila, ele não aparece.",
      ),
    ],
  },

  "/painel/minhas-tasks": {
    id: "modulo:minhas-tasks",
    versao: 1,
    passos: [
      passo(
        "etapa",
        ANCORAS.etapaDaLista,
        "Cada linha é uma etapa",
        "E não uma demanda: duas etapas da mesma demanda são dois trabalhos seus.",
      ),
      passo(
        "visao",
        ANCORAS.seletorDeVisao,
        "Lista, board ou calendário",
        "No board o card arrasta — mover é a própria ação de mudar o andamento.",
      ),
      passo(
        "coluna",
        ANCORAS.conteudoDoModulo,
        "A coluna da direita",
        "O cronômetro do que está correndo, os contadores e quem está fora hoje.",
      ),
    ],
  },

  "/painel/calendario": {
    id: "modulo:calendario",
    versao: 1,
    passos: [
      passo(
        "camadas",
        ANCORAS.acoesDoModulo,
        "As camadas são links",
        "Ligar e desligar o que aparece muda o endereço — dá para mandar o recorte.",
      ),
      passo(
        "grade",
        ANCORAS.conteudoDoModulo,
        "Mês ou semana",
        "O que atravessa dias vira faixa no topo da semana, e não um item por dia.",
      ),
      passo(
        "visao",
        ANCORAS.seletorDeVisao,
        "A semana dá espaço ao texto",
        "No mês a célula tem 90px: cabe o nome e o cliente, e o resto no título.",
      ),
    ],
  },

  "/painel/full-days": {
    id: "modulo:full-days",
    versao: 1,
    passos: [
      passo(
        "secoes",
        ANCORAS.secoesDoModulo,
        "A matriz, o relatório e a sua proposta",
        "A matriz pinta só a exceção: o dia normal não tem cor nenhuma.",
      ),
      passo(
        "calendario",
        ANCORAS.conteudoDoModulo,
        "O saldo abre a tela",
        "Quantos dias você tem neste ciclo, e quando os próximos chegam.",
      ),
      passo(
        "fila",
        ANCORAS.abaAprovacoesFullDays,
        "Quem responde é o sócio",
        "Os períodos da equipe esperam a resposta dele nesta aba.",
      ),
    ],
  },

  "/painel/academy": {
    id: "modulo:academy",
    versao: 1,
    passos: [
      passo(
        "acervo",
        ANCORAS.conteudoDoModulo,
        "O que a agência sabe, escrito",
        "Playbooks, e-books e cursos. Sem nota, sem certificado, sem ranking.",
      ),
      passo(
        "secoes",
        ANCORAS.secoesDoModulo,
        "O acompanhamento é da gestão",
        "Ela lê quem concluiu o quê — e nunca a sua anotação, que é só sua.",
      ),
    ],
  },

  "/painel/comodatos": {
    id: "modulo:comodatos",
    versao: 1,
    passos: [
      passo(
        "secoes",
        ANCORAS.secoesDoModulo,
        "O que está com você, e o resto",
        "A sua aba mostra o seu equipamento; as outras são o inventário da casa.",
      ),
      passo(
        "conteudo",
        ANCORAS.conteudoDoModulo,
        "O termo vale do dia da entrega",
        "Ele é congelado na hora, e o seu aceite aparece nele depois de acontecer.",
      ),
    ],
  },

  "/painel/notas-fiscais": {
    id: "modulo:notas-fiscais",
    versao: 1,
    passos: [
      passo(
        "enviar",
        ANCORAS.acoesDoModulo,
        "Uma nota por mês de serviço",
        "O valor é digitado a cada mês, porque ele muda por hora, projeto ou bônus.",
      ),
      passo(
        "lista",
        ANCORAS.conteudoDoModulo,
        "A recusada abre com o motivo",
        "Ela é a única linha que pede ação, e o botão ali já escolhe o mesmo mês.",
      ),
    ],
  },

  "/painel/social-media": {
    id: "modulo:social-media",
    versao: 1,
    passos: [
      passo(
        "indice",
        ANCORAS.conteudoDoModulo,
        "Conta e depois mês",
        "Um cartão por empresa, com os meses dentro. Clicar no mês abre as peças.",
      ),
      passo(
        "abrir",
        ANCORAS.acoesDoModulo,
        "O mês abre em branco",
        "Quantas peças, em que redes e quem produz. As datas vêm do fluxo da conta.",
      ),
      passo(
        "secoes",
        ANCORAS.secoesDoModulo,
        "Os fluxos são da gestão",
        "A sequência de ações que o mês percorre, e qual etapa o cliente aprova.",
      ),
    ],
  },

  "/painel/aprovacoes": {
    id: "modulo:campanhas",
    versao: 1,
    passos: [
      passo(
        "arvore",
        ANCORAS.conteudoDoModulo,
        "Cada peça decide por si",
        "O grupo é um rótulo: quem recebe arquivo e tem versão é a peça dentro dele.",
      ),
      passo(
        "acoes",
        ANCORAS.acoesDoModulo,
        "A arte passa pela análise interna",
        "Quem produz pede o aval; quem envia ao cliente é a gestão. São duas decisões.",
      ),
    ],
  },

  "/painel/financeiro": {
    id: "modulo:financeiro",
    versao: 1,
    passos: [
      passo(
        "secoes",
        ANCORAS.secoesDoModulo,
        "As notas da equipe e os gastos da casa",
        "As duas são dinheiro saindo: a nota que você marca paga vira gasto ao lado.",
      ),
      passo(
        "conteudo",
        ANCORAS.conteudoDoModulo,
        "Competência, vencimento e pagamento",
        "São três datas e não uma: o mês a que se refere, quando sai, e quando saiu.",
      ),
    ],
  },
};

/** O prefixo mais longo que casa — a forma de `findMenuItem`. */
export function microTourDaRota(caminho: string): Tour | null {
  let achado: Tour | null = null;
  let maior = -1;

  for (const [rota, tour] of Object.entries(MICRO_TOURS)) {
    const casa = caminho === rota || caminho.startsWith(`${rota}/`);
    if (casa && rota.length > maior) {
      achado = tour;
      maior = rota.length;
    }
  }

  return achado;
}

/** Os ids, para a tela de acompanhamento nomear o módulo de cada linha. */
export const ROTULO_DO_MICRO_TOUR: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(MICRO_TOURS).map(([rota, tour]) => [
      tour.id,
      rota.replace("/painel/", ""),
    ]),
  );

// A MESMA CHECAGEM DE CARREGAMENTO dos tours grandes, e aqui ela pega um erro
// a mais: dois módulos com o mesmo `tour_id` gravariam na mesma linha, e o
// acompanhamento mostraria o progresso de um módulo no nome do outro.
const vistos = new Set<string>();
for (const tour of Object.values(MICRO_TOURS)) {
  if (vistos.has(tour.id)) {
    throw new Error(`Dois micro-tours com o id "${tour.id}".`);
  }
  vistos.add(tour.id);

  if (tour.passos.length > 5) {
    throw new Error(
      `O micro-tour "${tour.id}" tem ${tour.passos.length} passos. ` +
        "O sprint pede de três a cinco: mais que isso é o tour de boas-vindas, não uma volta rápida.",
    );
  }

  const ids = new Set<string>();
  for (const p of tour.passos) {
    if (ids.has(p.id)) {
      throw new Error(`O micro-tour "${tour.id}" tem dois passos "${p.id}".`);
    }
    ids.add(p.id);
    if (p.texto.length > 140) {
      throw new Error(
        `O passo "${p.id}" de "${tour.id}" tem ${p.texto.length} caracteres, e o teto é 140.`,
      );
    }
  }
}
