import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  PiggyBank,
  Receipt,
  Sparkles,
  Sun,
  ThumbsUp,
  TrendingUp,
  UserRound,
  Users,
  Workflow,
  type LucideIcon,
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
  /**
   * Item de menu com peso visual reduzido: ícone menor e cor mais apagada.
   *
   * Para módulo OPCIONAL, que existe para quem quiser e não deve disputar
   * atenção com o trabalho. Não é uma permissão — quem vê o item pode abrir
   * a tela normalmente.
   */
  discreto?: boolean;
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
    label: "Resumo Semanal",
    href: "/painel/resumo-semanal",
    icon: NotebookPen,
    roles: EQUIPE,
    section: "principal",
    description: "O que você entregou em cada semana, na sua letra.",
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
    label: "Meu Desenvolvimento",
    href: "/painel/meu-desenvolvimento",
    icon: TrendingUp,
    roles: EQUIPE,
    section: "principal",
    description: "Suas habilidades registradas e o que você quer desenvolver.",
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
    description: "O que a equipe anda indicando: filme, curso, ferramenta, referência.",
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
    label: "Meu Perfil",
    href: "/painel/perfil",
    icon: UserRound,
    roles: EQUIPE,
    section: "principal",
    description: "Seus dados de acesso, foto e preferências.",
  },
  {
    // ÚLTIMO da seção, e com peso visual reduzido de propósito.
    //
    // Foi aba de Meu Perfil do Sprint 3C ao 8, e voltou ao menu quando o
    // módulo passou a existir de verdade — duas portas para a mesma tela
    // confundem quem procura. O que não muda é o posicionamento: ele é
    // opcional, o uso real pela equipe é incerto, e ele não pode competir
    // com os módulos do trabalho. Por isso `discreto`, por isso último, e
    // por isso fora da tela inicial, sem notificação e sem selo.
    label: "Financeiro Pessoal",
    href: "/painel/financeiro-pessoal",
    icon: PiggyBank,
    roles: EQUIPE,
    section: "principal",
    description: "Controle das suas finanças pessoais. Opcional e privado.",
    discreto: true,
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
    description: "A fila de entregas esperando validação — e as prontas para ir ao cliente.",
  },
  {
    label: "Aprovações & Conteúdo",
    href: "/painel/aprovacoes",
    icon: FileCheck2,
    roles: GESTAO,
    section: "gestao",
    description: "Fluxo de aprovação dos conteúdos, do briefing ao aprovado.",
  },
  {
    label: "Equipe & Skills",
    href: "/painel/equipe",
    icon: Users,
    roles: GESTAO,
    section: "gestao",
    description: "Quem é da casa, função, área e as habilidades de cada um.",
  },
  {
    label: "Clientes",
    href: "/painel/clientes",
    icon: Users,
    roles: GESTAO,
    section: "gestao",
    description: "As empresas atendidas, contatos e acessos ao portal.",
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
    // SÓ O SÓCIO. O desenvolvedor é gestão para todo o resto do sistema e
    // aqui não: faturamento por cliente, margem e inadimplência são a
    // informação mais sensível da casa. Esconder o item não é a proteção —
    // ela está em `exigirAcessoARota` e, principalmente, na RLS da 0013.
    label: "Financeiro",
    href: "/painel/financeiro",
    icon: CircleDollarSign,
    roles: SOCIO,
    section: "gestao",
    description: "Contratos, receitas, despesas e a rentabilidade de cada conta.",
  },

  // --- Fora do menu --------------------------------------------------------
  {
    // Saiu do menu no Sprint 3C: é assunto de quem já está dentro do perfil,
    // e como item solto competia com módulos do trabalho. Chega-se a ele por
    // uma aba dentro de Meu Perfil.
    label: "Financeiro Pessoal",
    href: "/painel/financeiro-pessoal",
    icon: PiggyBank,
    roles: EQUIPE,
    section: "principal",
    description: "Controle das suas finanças pessoais. Opcional.",
    hiddenFromMenu: true,
  },
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
  { de: "/painel/diario", para: "/painel/resumo-semanal" },
  { de: "/painel/minhas-skills", para: "/painel/meu-desenvolvimento" },
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
 * `/painel/clientes/123` cai em `/painel/clientes`. A busca é do caminho mais
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
export function getMenuForRole(role: UserRole): { section: MenuSection; items: MenuItem[] }[] {
  return SECTION_ORDER.map((section) => ({
    section,
    items: MENU.filter(
      (item) => item.section === section && !item.hiddenFromMenu && item.roles.includes(role),
    ),
  })).filter((grupo) => grupo.items.length > 0);
}
