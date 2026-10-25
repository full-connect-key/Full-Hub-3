/**
 * OS NOMES QUE O TOUR APONTA, num arquivo só.
 *
 * ---------------------------------------------------------------------------
 * **NUNCA CLASSE DO TAILWIND, NUNCA POSIÇÃO, NUNCA O TEXTO DO BOTÃO** — é a
 * primeira regra do sprint, e as três alternativas falham do mesmo jeito: elas
 * envelhecem junto com a tela e **não dão erro**. Uma classe muda no dia em
 * que alguém troca o espaçamento; um `nth-child` muda no dia em que um item
 * entra no meio da lista; o texto muda no dia em que o rótulo é reescrito — e
 * em todos eles o tour continua rodando, apontando para o elemento errado ou
 * para nada.
 *
 * `data-tour` é um atributo que existe POR CAUSA do tour: ele não é lido por
 * mais ninguém, então mexer no layout não o move, e apagá-lo é uma decisão
 * visível no diff.
 * ---------------------------------------------------------------------------
 *
 * **O NOME É UMA CONSTANTE, E O ATRIBUTO SAI DE `ancora()`.** Escrever
 * `data-tour="menu-minhas-taks"` à mão é um erro que o TypeScript não vê: o
 * atributo aceita qualquer string, o passo não acha o elemento, e o tour pula
 * em silêncio — e o pior é que isso vira linha em `passos_sem_ancora`, o alarme
 * de tour quebrado, apontando para um defeito que é um typo.
 *
 * **E UM NOME PODE ESTAR EM MAIS DE UM LUGAR DA ÁRVORE**, de propósito: o menu
 * é a barra lateral no desktop e a gaveta no celular, e os dois carregam
 * `menu`. Quem escolhe é o provedor, que pega o PRIMEIRO VISÍVEL — sem isso, o
 * tour no celular pularia o primeiro passo todos os dias e o alarme contaria
 * um defeito que não existe.
 */

export const ANCORAS = {
  // --- o painel, para todo perfil interno ---------------------------------
  menu: "menu",
  menuMinhasTasks: "menu-minhas-tasks",
  etapaDaLista: "etapa-da-lista",
  menuCalendario: "menu-calendario",
  menuFullDays: "menu-full-days",
  sino: "sino",
  menuDoUsuario: "menu-do-usuario",

  // --- quem abre demanda ---------------------------------------------------
  novaTask: "nova-task",
  menuSolicitacoes: "menu-solicitacoes",

  // --- a gestão ------------------------------------------------------------
  menuGestaoTasks: "menu-gestao-tasks",
  abaAprovacoesInternas: "aba-aprovacoes-internas",
  menuPessoas: "menu-pessoas",
  abaWorkflows: "aba-workflows",

  // --- só o sócio ----------------------------------------------------------
  menuFinanceiro: "menu-financeiro",
  menuMetricas: "menu-metricas",
  abaAprovacoesFullDays: "aba-aprovacoes-full-days",

  // --- A CASCA DE TODO MÓDULO, e é ela que faz os micro-tours caberem ------
  //
  // **NOVE MÓDULOS COM TRÊS A CINCO PASSOS CADA SERIAM TRINTA E CINCO
  // ELEMENTOS MARCADOS EM NOVE TELAS** — e trinta e cinco lugares onde um
  // seletor envelhece junto com o layout. A casca compartilhada já é o
  // esqueleto de todas elas: a barra de contexto, as ações do módulo, a área
  // de conteúdo e o seletor de visão. Três atributos nela dão a todo módulo o
  // micro-tour dele de graça.
  //
  // **E O QUE DISTINGUE UM MICRO-TOUR DO OUTRO É O TEXTO**, que é o que o
  // sprint pede — *"3 a 5 passos sobre aquela tela"*. O passo que aponta a
  // barra de contexto do Financeiro diz "notas recebidas e gastos da casa"; o
  // do Full Days diz "a matriz, o relatório e a sua proposta". Mesma âncora,
  // frases diferentes, nenhum seletor a mais para envelhecer.
  //
  // *O que fica em aberto, e é dito em vez de escondido:* um passo que aponte
  // para um widget DENTRO de um módulo — a coluna do kanban de notas, a linha
  // da matriz do Full Days — é uma âncora nova aqui e um atributo na tela
  // dele. É acréscimo de um passo, não de um mecanismo.
  secoesDoModulo: "secoes-do-modulo",
  acoesDoModulo: "acoes-do-modulo",
  conteudoDoModulo: "conteudo-do-modulo",
  seletorDeVisao: "seletor-de-visao",

  // --- a tela Início -------------------------------------------------------
  primeirosPassos: "primeiros-passos",

  // --- o portal do cliente -------------------------------------------------
  portalPendencias: "portal-pendencias",
  portalCronograma: "portal-cronograma",
  portalMaterial: "portal-material",
  portalDecisoes: "portal-decisoes",
  portalComentarios: "portal-comentarios",
  portalConfiguracoes: "portal-configuracoes",
} as const;

export type Ancora = (typeof ANCORAS)[keyof typeof ANCORAS];

/**
 * O atributo, para ser espalhado no elemento: `<nav {...ancora(ANCORAS.menu)}>`.
 *
 * Ele existe para o nome passar pelo compilador. Um objeto literal escrito na
 * tela (`{"data-tour": "menu"}`) aceita qualquer string e devolve o typo em
 * silêncio.
 */
export function ancora(nome: Ancora): { "data-tour": Ancora } {
  return { "data-tour": nome };
}

/**
 * O SELETOR, num lugar só.
 *
 * O provedor é quem procura o elemento, e ele precisa do seletor montado — mas
 * escrever `[data-tour="${nome}"]` lá dentro poria a forma do atributo em dois
 * arquivos, e o dia em que o nome do atributo mudasse um dos dois ficaria para
 * trás. É a decisão de `rodadasDo()` em `lib/aprovacoes/conteudo.ts`: um lugar
 * só nomeia a coluna.
 */
export function seletorDaAncora(nome: Ancora): string {
  return `[data-tour="${nome}"]`;
}

/**
 * QUAL ITEM DO MENU CARREGA QUAL ÂNCORA, pelo `href`.
 *
 * **A chave é a ROTA e não o rótulo**, e isso resolve dois problemas de uma
 * vez. O primeiro é a divergência: a barra lateral e a gaveta do celular são
 * dois componentes que desenham o MESMO `MENU`, e marcar item por item em cada
 * um deixaria o tour funcionando numa largura e pulando passos na outra — que
 * é a classe de bug que `ICONE_DA_AREA` já pagou com três cópias, duas delas
 * divergidas. O segundo é o rótulo: ele é texto de tela e muda, e a regra
 * acima diz em quantas palavras que texto de tela não vira seletor.
 *
 * Item de menu sem entrada aqui simplesmente não ganha atributo — e é a
 * maioria deles. Nenhum passo do tour aponta para um módulo que ele não
 * explica.
 */
export const ANCORA_DO_MENU: Readonly<Record<string, Ancora>> = {
  "/painel/minhas-tasks": ANCORAS.menuMinhasTasks,
  "/painel/calendario": ANCORAS.menuCalendario,
  "/painel/full-days": ANCORAS.menuFullDays,
  "/painel/solicitacoes": ANCORAS.menuSolicitacoes,
  "/painel/gestao-tasks": ANCORAS.menuGestaoTasks,
  "/painel/pessoas": ANCORAS.menuPessoas,
  "/painel/financeiro": ANCORAS.menuFinanceiro,
  "/painel/metricas": ANCORAS.menuMetricas,
};
