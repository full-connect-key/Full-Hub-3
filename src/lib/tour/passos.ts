import { ANCORAS, type Ancora } from "./ancoras";

import type { TourStatus, UserRole } from "@/lib/supabase/database.types";

/**
 * OS PASSOS DE CADA TOUR.
 *
 * ---------------------------------------------------------------------------
 * **ELES MORAM AQUI E NÃO NO BANCO, e é a decisão que define a 0101.** Um
 * passo é um pedaço da interface — o seletor que ele aponta, a rota onde ele
 * acontece, a frase que ele diz. Isso muda no mesmo commit em que a tela muda,
 * e tem de ser versionado junto com ela: uma tabela de passos obrigaria uma
 * migration a cada ajuste de layout, e no dia em que alguém esquecesse de
 * aplicar, o tour apontaria para um elemento que não existe mais.
 *
 * O banco guarda uma coisa só: por onde cada pessoa passou.
 * ---------------------------------------------------------------------------
 *
 * **O TOUR ENSINA A INTERFACE; O PROCESSO É DO FULL ACADEMY.** Nenhuma frase
 * aqui explica como a agência trabalha — isso mora nos playbooks, e duplicá-lo
 * criaria duas versões do mesmo combinado, com a daqui envelhecendo primeiro
 * porque ninguém a revisa. O último passo convida para a trilha.
 */

/**
 * O que o banco guarda de uma passada, do jeito que a tela lê.
 *
 * Ele mora AQUI e não em `lib/dados/tour.ts`, que é `server-only`: o convite
 * e o menu de ajuda são de cliente e precisam do molde, e a convenção manda o
 * que os dois lados usam para a camada compartilhada.
 */
export type ProgressoDeTour = {
  tourId: string;
  versao: number;
  status: TourStatus;
  passoAtual: number;
  finalizadoEm: string | null;
};

export type TipoDePasso = "explicativo" | "interativo";

export type PassoDoTour = {
  /**
   * O id ESTÁVEL do passo, e é ele que vai para `passos_pulados` e para
   * `passos_sem_ancora` no banco. Nunca o índice: um passo que entra no meio
   * da lista renumeraria todos os seguintes, e o alarme de tour quebrado
   * passaria a apontar para o passo errado em todo histórico já gravado.
   */
  id: string;
  ancora: Ancora;
  titulo: string;
  texto: string;
  tipo: TipoDePasso;
  /** Onde o passo acontece. O tour navega, espera o elemento, e continua. */
  rota?: string;
  /**
   * O ELEMENTO PODE LEGITIMAMENTE NÃO ESTAR NA TELA, e a ausência dele não é
   * alarme.
   *
   * É a terceira situação que o sprint pede em duas frases separadas sem notar
   * que são três: a pessoa PULOU (escolha), o seletor ENVELHECEU (defeito), e
   * a tela simplesmente não tem aquilo hoje — "pula se a pessoa não tiver
   * nenhuma subtarefa", nas palavras dele. Sem esta bandeira as três cairiam
   * em `passos_sem_ancora`, e o alarme de tour quebrado passaria a contar
   * gente que acabou de entrar na agência e ainda não tem trabalho.
   */
  opcional?: boolean;
};

export type Tour = {
  id: string;
  versao: number;
  passos: PassoDoTour[];
};

export const TOUR_DO_PAINEL = "painel";
export const TOUR_DO_PORTAL = "portal";

/**
 * A VERSÃO DE CADA TOUR, e ela sobe quando o tour muda DE VERDADE.
 *
 * Trocar uma palavra de um balão não é mudar o tour; acrescentar um passo,
 * tirar outro ou trocar a ordem é. Quem já concluiu a versão anterior recebe
 * o convite para rever — e a comparação é DERIVADA (`status = 'concluido' and
 * versao < a de hoje`), que é por que o número mora aqui, ao lado dos passos,
 * e não numa segunda coluna do banco dizendo "precisa rever".
 *
 * **Subir isto à toa custa caro:** é um convite para a agência inteira refazer
 * um tour que não mudou, e quem o recebe duas vezes à toa para de olhar o
 * terceiro.
 */
export const VERSAO_DO_TOUR: Readonly<Record<string, number>> = {
  [TOUR_DO_PAINEL]: 1,
  [TOUR_DO_PORTAL]: 1,
};

/** O teto do sprint, e ele é a regra que decide o que entra em cada perfil. */
export const MAXIMO_DE_PASSOS = 12;

/**
 * O teto de texto de um balão.
 *
 * **ELE NÃO PROVA AS DUAS LINHAS, e dizer que prova seria afirmar sem
 * provar:** quantas linhas uma frase ocupa depende da largura do balão, do
 * corpo da letra e da língua. O balão tem 360px e cerca de 50 caracteres por
 * linha, então duas linhas são por volta de 100 — e a frase mais longa que o
 * sprint escreve tem 105.
 *
 * O que o teto impede de verdade é o PARÁGRAFO, que é o que o sprint proíbe em
 * voz alta. Quem passar de 140 está escrevendo documentação dentro de um
 * balão, e o lugar disso é o Full Academy.
 */
export const MAXIMO_DE_TEXTO = 140;

// ---------------------------------------------------------------------------
// O TOUR DO PAINEL
//
// SETE PASSOS PARA TODO PERFIL INTERNO, mais um bloco por perfil. E o bloco é
// UM, nunca somado: o sprint lista Atendimento +4, desenvolvedor +4 e sócio
// +3 como se empilhassem, e também diz "nunca mais de 12 passos" — as duas
// coisas não cabem juntas (o sócio chegaria a dezoito). O teto é a regra dura,
// então cada perfil recebe o bloco dele e mais nada.
//
// **O QUE O SÓCIO PERDE ESTÁ DITO:** os dois passos do desenvolvedor que
// falam de Gestão de Tasks e dos workflows. Ele alcança as duas telas, e o
// micro-tour de cada módulo cobre a primeira visita — que é onde a pessoa está
// olhando a coisa de verdade, e não ouvindo falar dela.
//
// **E TODA ÂNCORA DESTE TOUR EXISTE SEM DADO NENHUM** — item de menu, aba,
// topbar. É a regra que faz o teto ser alcançável e o alarme ser honesto: um
// passo que precisa de uma demanda ABERTA não tem como existir no primeiro
// acesso, quando não há nenhuma. O briefing, o responsável de uma etapa e o
// "Enviar ao cliente" são micro-tour do módulo deles, e é lá que eles estão.
//
// A exceção declarada é "A subtarefa", que o sprint põe aqui com as próprias
// palavras — "pula se a pessoa não tiver nenhuma". Ela é `opcional`.
//
// ---------------------------------------------------------------------------
// **E TODO PASSO DE ITEM DE MENU É `opcional`, POR CAUSA DO CELULAR.**
//
// Abaixo de 1024px a barra lateral vira gaveta, e a gaveta do Radix **não
// existe na página** enquanto está fechada: os itens não têm como ser
// encontrados, e o tour os pula. Sem a bandeira, cada tour feito num celular
// gravaria cinco linhas em `passos_sem_ancora` — e o alarme de tour quebrado
// passaria a acusar um defeito que é o desenho responsivo do menu.
//
// **O TOUR NÃO ABRE A GAVETA, e a ausência é escolha.** Ele poderia — e aí
// teria de mexer no estado de um componente que não é dele, e a navegação do
// passo seguinte a fecharia de novo. O primeiro passo aponta para o BOTÃO da
// gaveta no celular, que é o que ensina onde o menu está; os itens, quem os
// encontra é quem abriu.
//
// *O que se perde, e é dito em vez de escondido:* no celular o tour do painel
// tem quatro passos em vez de sete ou onze. **O sprint pede 375px para o
// PORTAL**, com essas palavras, e o tour de lá aponta para conteúdo de página
// — que existe em qualquer largura.
// ---------------------------------------------------------------------------

const BASE_DO_PAINEL: PassoDoTour[] = [
  {
    id: "menu",
    ancora: ANCORAS.menu,
    titulo: "Tudo fica aqui",
    texto: "A seção PRINCIPAL é o seu dia a dia; a de Gestão é o que você faz sobre os outros.",
    // EXPLICATIVO, e não interativo como o sprint pede ("clique para abrir").
    // No desktop a barra lateral já está aberta: não há o que abrir, e um
    // passo que espera um clique sem razão para acontecer é exatamente o
    // travamento que o próprio sprint proíbe. No celular quem carrega a âncora
    // é o botão da gaveta, e o provedor pega o primeiro visível.
    tipo: "explicativo",
  },
  {
    id: "minhas-tasks",
    ancora: ANCORAS.menuMinhasTasks,
    titulo: "Minhas Tasks",
    texto: "O que está com você. É a tela que você mais vai abrir.",
    tipo: "interativo",
    opcional: true,
  },
  {
    id: "etapa",
    ancora: ANCORAS.etapaDaLista,
    titulo: "O trabalho acontece nas etapas",
    texto: "Cada uma tem um responsável e um prazo — e você vê as suas em destaque.",
    tipo: "explicativo",
    rota: "/painel/minhas-tasks",
    opcional: true,
  },
  {
    id: "calendario",
    ancora: ANCORAS.menuCalendario,
    titulo: "Calendário Full",
    texto: "Seus prazos e os da equipe, no mês.",
    tipo: "explicativo",
    opcional: true,
  },
  {
    id: "full-days",
    ancora: ANCORAS.menuFullDays,
    titulo: "Full Days",
    texto: "Descanso, afastamento e ausência pontual são propostos por aqui.",
    tipo: "explicativo",
    opcional: true,
  },
  {
    id: "sino",
    ancora: ANCORAS.sino,
    titulo: "O sino",
    texto: "Quando algo chega para você, aparece aqui.",
    tipo: "explicativo",
  },
  {
    id: "perfil",
    ancora: ANCORAS.menuDoUsuario,
    titulo: "Seu perfil",
    texto: "Foto, senha e seus dados. Vale completar agora.",
    tipo: "explicativo",
  },
];

const PASSOS_DO_ATENDIMENTO: PassoDoTour[] = [
  {
    id: "nova-task",
    ancora: ANCORAS.novaTask,
    titulo: "Você pode abrir demandas",
    texto: "A demanda nasce no clique e salva sozinha, campo a campo.",
    tipo: "interativo",
    rota: "/painel/gestao-tasks",
  },
  {
    id: "solicitacoes",
    ancora: ANCORAS.menuSolicitacoes,
    titulo: "Solicitações",
    texto: "Quando um cliente pede algo pelo portal, chega aqui.",
    tipo: "explicativo",
    opcional: true,
  },
];

const PASSOS_DA_GESTAO: PassoDoTour[] = [
  {
    id: "gestao-tasks",
    ancora: ANCORAS.menuGestaoTasks,
    titulo: "Gestão de Tasks",
    texto: "O trabalho da agência inteira: as demandas, os workflows e a fila de aval.",
    tipo: "explicativo",
    opcional: true,
  },
  {
    id: "aprovacoes-internas",
    ancora: ANCORAS.abaAprovacoesInternas,
    titulo: "Aprovações internas",
    texto: "Nada sai para o cliente sem passar por aqui. O selo conta quantas esperam.",
    tipo: "explicativo",
    rota: "/painel/gestao-tasks",
  },
  {
    id: "pessoas",
    ancora: ANCORAS.menuPessoas,
    titulo: "Clientes e equipe",
    texto: "As empresas e as pessoas da casa, nas duas abas.",
    tipo: "explicativo",
    opcional: true,
  },
  {
    id: "workflows",
    ancora: ANCORAS.abaWorkflows,
    titulo: "Workflows",
    texto: "A cadeia de etapas que toda demanda daquele tipo de trabalho percorre.",
    tipo: "explicativo",
    rota: "/painel/gestao-tasks",
  },
];

const PASSOS_DO_SOCIO: PassoDoTour[] = [
  {
    id: "aprovacoes-internas",
    ancora: ANCORAS.abaAprovacoesInternas,
    titulo: "Aprovações internas",
    texto: "Nada sai para o cliente sem passar por aqui. O selo conta quantas esperam.",
    tipo: "explicativo",
    rota: "/painel/gestao-tasks",
  },
  {
    id: "financeiro",
    ancora: ANCORAS.menuFinanceiro,
    titulo: "Financeiro",
    texto: "As notas da equipe e os gastos da casa. Só você alcança esta tela.",
    tipo: "explicativo",
    opcional: true,
  },
  {
    id: "aprovacoes-full-days",
    ancora: ANCORAS.abaAprovacoesFullDays,
    titulo: "Quem responde aos períodos",
    texto: "Descanso e ausência esperam a sua resposta nesta aba.",
    tipo: "explicativo",
    rota: "/painel/full-days",
  },
  {
    id: "metricas",
    ancora: ANCORAS.menuMetricas,
    titulo: "Métricas",
    texto: "Produção, prazo, estimativa e qualidade da entrega, no período que você escolher.",
    tipo: "explicativo",
    opcional: true,
  },
];

/**
 * QUEM VÊ O QUÊ.
 *
 * `ehAtendimento` vem do banco, por `souDoAtendimento()` — que chama
 * `is_atendimento()`, a mesma função que `tasks_insert` usa desde a 0006.
 * Repetir a pergunta aqui ("funcao === 'Atendimento'") criaria a segunda
 * verdade que aquela função existe para não ter: perfil de acesso e função na
 * agência são coisas diferentes.
 *
 * E a ordem das perguntas é da mais específica para a mais geral, que é a de
 * `coalesce(etapa, padrão)` (0041) e de `etapas_resolvidas_do_workflow()`
 * (0064): o sócio é gestão e é atendimento, e sem a ordem ele cairia no
 * primeiro `if` que casasse.
 */
export function tourDoPainel(quem: {
  role: UserRole;
  ehAtendimento: boolean;
}): Tour {
  const extras =
    quem.role === "socio"
      ? PASSOS_DO_SOCIO
      : quem.role === "desenvolvedor"
        ? PASSOS_DA_GESTAO
        : quem.ehAtendimento
          ? PASSOS_DO_ATENDIMENTO
          : [];

  return {
    id: TOUR_DO_PAINEL,
    versao: VERSAO_DO_TOUR[TOUR_DO_PAINEL],
    passos: [...BASE_DO_PAINEL, ...extras],
  };
}

// ---------------------------------------------------------------------------
// O TOUR DO PORTAL
//
// CINCO PASSOS, E NENHUM JARGÃO INTERNO. "task", "subtarefa", "etapa",
// "workflow" e "sprint" são palavras da agência; o cliente recebe MATERIAL, e
// ele pertence a uma DEMANDA. `check:cores` varre `src/app/(cliente)/` e
// `src/components/portal/` atrás das formas portuguesas — e este arquivo mora
// em `lib/tour/`, FORA da varredura, então quem mexer nas frases daqui mexe
// sem rede. É o caso da frase do portão que nasce em `lib/dominio/`.
// ---------------------------------------------------------------------------

const PASSOS_DO_PORTAL: PassoDoTour[] = [
  {
    id: "pendencias",
    ancora: ANCORAS.portalPendencias,
    titulo: "O que espera você",
    texto: "Tudo o que a Full enviou e ainda não teve resposta aparece aqui.",
    tipo: "explicativo",
  },
  {
    id: "material",
    ancora: ANCORAS.portalMaterial,
    titulo: "Abra um material",
    texto: "A arte abre grande, com zoom de verdade — dá para ler o rodapé pequeno.",
    tipo: "interativo",
    opcional: true,
  },
  {
    id: "decisoes",
    ancora: ANCORAS.portalDecisoes,
    titulo: "Três respostas possíveis",
    texto: "Aprovar, recusar ou pedir ajustes. Pedir ajustes é o caminho mais comum.",
    tipo: "explicativo",
    opcional: true,
  },
  {
    id: "comentarios",
    ancora: ANCORAS.portalComentarios,
    titulo: "Comentários",
    texto: "Escreva aqui o que precisa mudar. A equipe que produziu é quem lê.",
    tipo: "explicativo",
    opcional: true,
  },
  {
    id: "configuracoes",
    ancora: ANCORAS.portalConfiguracoes,
    // "SEUS DADOS", e não "Configurações": o caminho até a tela é este menu, e
    // é o rótulo que ele usa. Um balão dizendo "Configurações" apontando para
    // um menu escrito "Meus dados" manda a pessoa procurar a palavra errada.
    titulo: "Seus dados",
    texto: "Aqui ficam seus dados, seus avisos por e-mail e quem mais da sua empresa tem acesso.",
    tipo: "explicativo",
  },
];

export function tourDoPortal(): Tour {
  return {
    id: TOUR_DO_PORTAL,
    versao: VERSAO_DO_TOUR[TOUR_DO_PORTAL],
    passos: PASSOS_DO_PORTAL,
  };
}

// ---------------------------------------------------------------------------
// A CHECAGEM NO CARREGAMENTO DO MÓDULO
//
// Ela estoura se algum tour passar do teto de passos ou se algum balão virar
// parágrafo — e é a forma de `seletor-de-status.tsx`, que estoura se um status
// ficar fora de todo grupo, e de `STATUS_EM_ORDEM`, que confere se a ordem
// cobre o enum inteiro.
//
// **SEM ELA O ESTRAGO É INVISÍVEL:** um passo a mais não dá erro em lugar
// nenhum — ele dá um tour de catorze passos que a pessoa abandona no nono, e o
// acompanhamento registraria isso como desistência dela. O mesmo vale para o
// texto: um parágrafo num balão de 360px empurra os botões para fora da tela
// no celular, e quem não encontra o "Próximo" não termina o tour.
//
// E ela roda contra TODOS os perfis, e não contra a base: o teto é por tour
// montado, e o do sócio é o mais longo. Um `tourDoPainel()` sem argumento
// mediria o caso que nunca acontece.
// ---------------------------------------------------------------------------
const TODOS_OS_TOURS: Tour[] = [
  tourDoPainel({ role: "colaborador", ehAtendimento: false }),
  tourDoPainel({ role: "colaborador", ehAtendimento: true }),
  tourDoPainel({ role: "desenvolvedor", ehAtendimento: true }),
  tourDoPainel({ role: "socio", ehAtendimento: true }),
  tourDoPortal(),
];

for (const tour of TODOS_OS_TOURS) {
  if (tour.passos.length > MAXIMO_DE_PASSOS) {
    throw new Error(
      `O tour "${tour.id}" tem ${tour.passos.length} passos, e o teto é ${MAXIMO_DE_PASSOS}. ` +
        "Um passo a mais não dá erro em lugar nenhum: ele vira desistência no acompanhamento.",
    );
  }

  const ids = new Set<string>();
  for (const passo of tour.passos) {
    // ID REPETIDO É PIOR QUE ID ERRADO: os dois passos gravariam a mesma linha
    // em `passos_pulados`, e o acompanhamento não teria como dizer qual deles
    // a pessoa pulou.
    if (ids.has(passo.id)) {
      throw new Error(`O tour "${tour.id}" tem dois passos com o id "${passo.id}".`);
    }
    ids.add(passo.id);

    if (passo.texto.length > MAXIMO_DE_TEXTO) {
      throw new Error(
        `O passo "${passo.id}" do tour "${tour.id}" tem ${passo.texto.length} caracteres, ` +
          `e o teto é ${MAXIMO_DE_TEXTO}. Balão não é documentação — isso é Full Academy.`,
      );
    }
  }
}
