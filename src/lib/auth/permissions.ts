import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChartColumn,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  Images,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Sparkles,
  Sun,
  ThumbsUp,
  type LucideIcon,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";

import type { UserRole } from "@/lib/supabase/database.types";

/**
 * Fonte única de verdade do menu e das permissões do Painel Interno.
 *
 * Todo o resto do projeto consulta este arquivo. Nunca espalhe
 * `if (role === "socio")` pelas telas: acrescentar um módulo tem que ser
 * acrescentar uma linha em MENU, e mais nada.
 *
 * Esconder o item no menu NÃO é proteção. Cada rota valida o perfil no
 * servidor (veja exigirAcessoARota em src/lib/auth/dal.ts) e o RLS do Postgres
 * decide o que o banco devolve.
 *
 * Os nomes aqui são em inglês porque a especificação do sprint os fixou
 * (canAccess, getMenuForRole, label/href/icon/roles) e os próximos sprints vão
 * se referir a eles por esse nome.
 */

/** Perfis internos. O perfil `cliente` nunca alcança o painel. */
export const EQUIPE: UserRole[] = ["colaborador", "desenvolvedor", "socio"];
export const GESTAO: UserRole[] = ["desenvolvedor", "socio"];
export const SOCIO: UserRole[] = ["socio"];

/**
 * Duas seções, e a divisão é sobre a PESSOA, não sobre o assunto.
 *
 * PRINCIPAL é o que todo mundo da casa usa no dia: as próprias tarefas, o
 * próprio registro da semana, o próprio descanso, a própria nota fiscal. GESTÃO é
 * o que se faz sobre os outros — distribuir trabalho, aprovar, cadastrar
 * gente, ver dinheiro.
 *
 * A separação antiga era por tema (Trabalho / Gestão / Pessoal), e por isso
 * "Full Days" caía em Gestão sendo o período fora de quem clica, e "Minhas
 * Skills" caía em Pessoal ao lado do controle de finanças pessoais.
 */
export type MenuSection = "principal" | "gestao";

export const SECTION_LABELS: Record<MenuSection, string> = {
  principal: "Principal",
  gestao: "Gestão",
};

/**
 * O selo ao lado do nome da seção. Só GESTÃO tem um: ele avisa, para quem
 * enxerga a seção, que dali para baixo o que se faz alcança a agência inteira.
 * Quem não é da gestão nunca vê nem a seção nem o selo.
 */
export const SECTION_PILLS: Partial<Record<MenuSection, string>> = {
  gestao: "Admin",
};

export const SECTION_ORDER: MenuSection[] = ["principal", "gestao"];

export type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  section: MenuSection;
  /** Frase mostrada no placeholder do módulo enquanto ele não existe. */
  description: string;
  /** Fora do menu, mas a rota existe e continua validando o perfil. */
  hiddenFromMenu?: boolean;
};

export const MENU: MenuItem[] = [
  // --- Principal -----------------------------------------------------------
  {
    label: "Início",
    href: "/painel",
    icon: LayoutDashboard,
    roles: EQUIPE,
    section: "principal",
    description: "Seus atalhos e o que precisa da sua atenção hoje.",
  },
  {
    label: "Minhas Tasks",
    href: "/painel/minhas-tasks",
    icon: ListChecks,
    roles: EQUIPE,
    section: "principal",
    description: "As tarefas atribuídas a você, com prazo e prioridade.",
  },
  {
    // SOCIAL MEDIA É UMA LINHA SÓ DO MENU, e fica na PRINCIPAL. Decisão do
    // usuário, depois de ela ter passado por Gestão e por duas entradas ao
    // mesmo tempo no mesmo dia — o histórico fica registrado porque a ideia
    // pode voltar.
    //
    // O QUE DECIDIU: a tela já muda sozinha por perfil. "Abrir o mês" e
    // "+ Novo post" só aparecem para quem pode, e quem recusa de verdade é a
    // RLS e os triggers. Uma segunda entrada não acrescentava trava nenhuma —
    // só um segundo caminho para o mesmo lugar, com o mesmo nome — que é o
    // mesmo problema que o produto já desfez uma vez, quando um módulo se
    // chamava de dois jeitos e quem usava tinha que descobrir sozinho que era
    // a mesma coisa. O porquê daquela vez está no CLAUDE.md, fora de `src/`:
    // a varredura de nomes mortos acusaria o próprio texto que a explica, e
    // acusou — este comentário já citou os dois nomes e foi pego.
    //
    // E É NA PRINCIPAL porque a divisão do menu é sobre a PESSOA e não sobre
    // o assunto: Gestão carrega o selo Admin e significa "o que eu faço sobre
    // os outros". O redator escrevendo a legenda dele não está fazendo nada
    // sobre ninguém — é o trabalho do dia dele, como Minhas Tasks.
    label: "Social Media",
    href: "/painel/social-media",
    icon: Images,
    roles: EQUIPE,
    section: "principal",
    description:
      "Os posts da agência, da pauta ao envio ao cliente.",
  },
  {
    // DE `GESTAO` PARA `EQUIPE`, e da seção Gestão para a Principal — decisão
    // do usuário, e é palavra por palavra o argumento do Social Media: quem
    // sobe a arte e escreve a justificativa é o responsável pela peça, não o
    // Atendimento. Esconder o módulo dele seria esconder o trabalho dele.
    //
    // **E o nome mudou junto.** "Aprovações & Conteúdo" ficava ao lado de
    // "Aprovações Internas" na mesma seção, e as duas telas não são a mesma
    // coisa: uma é a fila de validação da gestão, a outra é onde o material
    // da campanha é produzido. Dois rótulos parecidos para telas diferentes
    // é como se aprende a procurar na errada. O módulo tem campanhas dentro,
    // e é assim que o cliente já o chama no portal dele.
    //
    // **Abrir campanha continua sendo do Atendimento**, e quem recusa é o
    // banco: `campaigns_insert` e `tasks_insert` (0054). Ver o módulo e abrir
    // trabalho nele são duas decisões — a segunda não acompanha a primeira.
    label: "Campanhas",
    href: "/painel/aprovacoes",
    icon: FileCheck2,
    roles: EQUIPE,
    section: "principal",
    description:
      "As campanhas da agência: o material de cada peça, versão a versão.",
  },
  {
    label: "Full Days",
    href: "/painel/full-days",
    icon: Sun,
    roles: EQUIPE,
    section: "principal",
    description: "Combinar períodos fora e responder a quem combinou.",
  },
  {
    label: "Full Academy",
    href: "/painel/academy",
    icon: BookOpen,
    roles: EQUIPE,
    section: "principal",
    description: "Trilhas de formação da agência, com o seu progresso.",
  },
  {
    label: "Calendário Full",
    href: "/painel/calendario",
    icon: CalendarDays,
    roles: EQUIPE,
    section: "principal",
    description: "Prazos, publicações e compromissos em uma linha do tempo.",
  },
  {
    // "Recomendações da SEMANA" com "reconhecimento entre colegas" era outro
    // módulo: elogio a quem trabalhou bem. O que o Sprint 9 entregou é um feed
    // de indicações — filme, curso, ferramenta, referência. Dois nomes para
    // coisas diferentes na mesma linha do menu confundem quem procura.
    label: "Recomendações",
    href: "/painel/recomendacoes",
    icon: ThumbsUp,
    roles: EQUIPE,
    section: "principal",
    description:
      "O que a equipe anda indicando: filme, curso, ferramenta, referência.",
  },
  {
    // A nota fiscal DA PESSOA, não o financeiro da agência. Cada um envia a
    // sua e acompanha o pagamento. O financeiro da casa é outro módulo, na
    // Gestão, e só o sócio alcança.
    label: "Notas Fiscais",
    href: "/painel/notas-fiscais",
    icon: Receipt,
    roles: EQUIPE,
    section: "principal",
    description: "Envie sua nota fiscal e acompanhe o pagamento.",
  },

  {
    // FORA DO MENU, E A ROTA DE PÉ — decisão do usuário: Meu Perfil estava na
    // barra lateral E no avatar do canto superior direito, que é onde todo
    // produto com login o coloca. Dois caminhos para a mesma tela não são
    // duas formas de chegar: são dois lugares onde alguém procura, e um deles
    // está sempre errado para quem procurou no outro.
    //
    // **E é `hiddenFromMenu` e não a linha apagada**, porque `canAccess()`
    // responde pelo `MENU`: sem a entrada, `/painel/perfil` viraria rota
    // desconhecida e `exigirAcessoARota` devolveria 403 — a tela que o sprint
    // manda manter. A bandeira existe exatamente para isto, e já servia à
    // vitrine de componentes.
    label: "Meu Perfil",
    href: "/painel/perfil",
    icon: UserRound,
    roles: EQUIPE,
    section: "principal",
    description: "Seus dados de acesso, foto e preferências.",
    hiddenFromMenu: true,
  },

  // --- Gestão --------------------------------------------------------------
  {
    label: "Gestão de Tasks",
    href: "/painel/gestao-tasks",
    icon: ClipboardList,
    roles: GESTAO,
    section: "gestao",
    description: "Distribuição e acompanhamento das tarefas de toda a equipe.",
  },
  {
    label: "Aprovações Internas",
    href: "/painel/aprovacoes-internas",
    icon: BadgeCheck,
    roles: GESTAO,
    section: "gestao",
    description:
      "A fila de entregas esperando validação — e as prontas para ir ao cliente.",
  },
  {
    // ERAM DOIS ITENS — "Equipe" e "Clientes" — e viraram um, por decisão do
    // usuário, escolhida entre três propostas de layout. As duas listas são as
    // mesmas; o que mudou é que dividem uma rota e uma barra de abas.
    //
    // As fichas moram em `/painel/pessoas/clientes/[id]` e
    // `/painel/pessoas/equipe/[id]`, e não precisam de entrada própria aqui:
    // `findMenuItem` casa por prefixo, então as duas caem nesta linha e
    // `canAccess` responde por elas. Os caminhos antigos viram 308 em
    // ROTAS_RENOMEADAS, logo abaixo.
    label: "Gestão de Pessoas",
    href: "/painel/pessoas",
    icon: Users,
    roles: GESTAO,
    section: "gestao",
    description: "Quem é da casa e quem é cliente: função, área e acessos.",
  },
  {
    label: "Workflows",
    href: "/painel/workflows",
    icon: Workflow,
    roles: GESTAO,
    section: "gestao",
    description: "Os workflows da agência e a cadeia de etapas de cada um.",
  },
  {
    // GESTÃO, e não só o sócio — mas a aba de rentabilidade dentro dela é
    // dele. É o mesmo desenho da 0035: quatro funções exigem `is_gestor()`,
    // a quinta exige `is_socio()`. O desenvolvedor distribui trabalho e
    // responde por prazo, então produção, tempo e qualidade são dele; o que
    // ele não alcança é faturamento por cliente.
    label: "Métricas",
    href: "/painel/metricas",
    icon: ChartColumn,
    roles: GESTAO,
    section: "gestao",
    description:
      "Produção, onde o tempo vai, estimativa contra real e quanto a entrega volta.",
  },
  {
    // SÓ O SÓCIO. O desenvolvedor é gestão para todo o resto do sistema e
    // aqui não: faturamento por cliente, margem e inadimplência são a
    // informação mais sensível da casa. Esconder o item não é a proteção —
    // ela está em `exigirAcessoARota` e, principalmente, na RLS da 0013.
    label: "Financeiro",
    href: "/painel/financeiro",
    icon: CircleDollarSign,
    roles: SOCIO,
    section: "gestao",
    description:
      "Contratos, receitas, despesas e a rentabilidade de cada conta.",
  },

  // --- Fora do menu --------------------------------------------------------
  {
    label: "Componentes",
    // Sem underline no começo da pasta: no App Router, um diretório iniciado
    // por "_" é privado e não vira rota. O sprint sugeria /painel/_dev/, que
    // não seria acessível.
    href: "/painel/dev/componentes",
    icon: Sparkles,
    roles: GESTAO,
    section: "gestao",
    description: "Demonstração dos componentes compartilhados.",
    hiddenFromMenu: true,
  },
];

/**
 * As rotas que mudaram de nome no Sprint 3C.
 *
 * O redirecionamento permanente vive em next.config.ts, e sai desta mesma
 * lista: link salvo no favorito de alguém não pode virar 404 porque o módulo
 * ganhou um nome melhor.
 */
export const ROTAS_RENOMEADAS: { de: string; para: string }[] = [
  // Equipe e Clientes viraram as duas abas de Gestão de Pessoas.
  //
  // AS FICHAS VÊM PRIMEIRO, e a ordem não é estilo: o Next casa os redirects
  // na ordem da lista, e `/painel/clientes/:id` precisa ser testado antes de
  // `/painel/clientes` — invertido, a ficha de um cliente cairia na lista e o
  // id se perderia no caminho.
  { de: "/painel/clientes/:id", para: "/painel/pessoas/clientes/:id" },
  { de: "/painel/equipe/:id", para: "/painel/pessoas/equipe/:id" },
  { de: "/painel/clientes", para: "/painel/pessoas?aba=clientes" },
  { de: "/painel/equipe", para: "/painel/pessoas?aba=equipe" },
];

/**
 * Rotas que entram em sprints futuros. Ficam registradas para ninguém
 * reaproveitar o caminho por engano, e não são criadas agora.
 *
 *   /painel/metricas  e  /painel/resumo-agencia  -> Sprint 15
 *   /painel/auditoria (somente socio)            -> Sprint 16
 */
export const ROTAS_FUTURAS = [
  "/painel/metricas",
  "/painel/resumo-agencia",
  "/painel/auditoria",
];

/**
 * Acha o item de menu de uma rota, considerando sub-rotas.
 *
 * `/painel/pessoas/clientes/123` cai em `/painel/pessoas`. A busca é do caminho mais
 * longo para o mais curto, senão `/painel` (que é prefixo de tudo) responderia
 * por todo mundo.
 */
export function findMenuItem(href: string): MenuItem | undefined {
  const candidatos = MENU.filter(
    (item) => href === item.href || href.startsWith(`${item.href}/`),
  );
  if (candidatos.length === 0) return undefined;
  return candidatos.reduce((maisEspecifico, item) =>
    item.href.length > maisEspecifico.href.length ? item : maisEspecifico,
  );
}

/** Este perfil pode abrir esta rota? Rota desconhecida é sempre não. */
export function canAccess(role: UserRole, href: string): boolean {
  const item = findMenuItem(href);
  if (!item) return false;
  return item.roles.includes(role);
}

/** Os itens visíveis no menu deste perfil, agrupados por seção e em ordem. */
export function getMenuForRole(
  role: UserRole,
): { section: MenuSection; items: MenuItem[] }[] {
  return SECTION_ORDER.map((section) => ({
    section,
    items: MENU.filter(
      (item) =>
        item.section === section &&
        !item.hiddenFromMenu &&
        item.roles.includes(role),
    ),
  })).filter((grupo) => grupo.items.length > 0);
}
