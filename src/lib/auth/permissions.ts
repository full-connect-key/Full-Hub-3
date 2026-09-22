import {
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  PiggyBank,
  Sparkles,
  Sun,
  ThumbsUp,
  UserRound,
  Users,
  Wrench,
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

export type MenuSection = "trabalho" | "gestao" | "pessoal";

export const SECTION_LABELS: Record<MenuSection, string> = {
  trabalho: "Trabalho",
  gestao: "Gestão",
  pessoal: "Pessoal",
};

export const SECTION_ORDER: MenuSection[] = ["trabalho", "gestao", "pessoal"];

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
  /** Peso visual reduzido no menu. */
  muted?: boolean;
};

export const MENU: MenuItem[] = [
  // --- Trabalho ------------------------------------------------------------
  {
    label: "Home",
    href: "/painel",
    icon: LayoutDashboard,
    roles: EQUIPE,
    section: "trabalho",
    description: "A visão geral do seu dia na agência.",
  },
  {
    label: "Minhas Tasks",
    href: "/painel/minhas-tasks",
    icon: ListChecks,
    roles: EQUIPE,
    section: "trabalho",
    description: "As tarefas atribuídas a você, com prazo e prioridade.",
  },
  {
    label: "Gestão de Tasks",
    href: "/painel/gestao-tasks",
    icon: ClipboardList,
    roles: GESTAO,
    section: "trabalho",
    description: "Distribuição e acompanhamento das tarefas de toda a equipe.",
  },
  {
    label: "Calendário",
    href: "/painel/calendario",
    icon: CalendarDays,
    roles: EQUIPE,
    section: "trabalho",
    description: "Prazos, publicações e compromissos em uma linha do tempo.",
  },
  {
    label: "Aprovações e Conteúdo",
    href: "/painel/aprovacoes",
    icon: FileCheck2,
    roles: GESTAO,
    section: "trabalho",
    description: "Fluxo de aprovação dos conteúdos, do briefing ao aprovado.",
  },

  // --- Gestão --------------------------------------------------------------
  {
    label: "Clientes",
    href: "/painel/clientes",
    icon: Users,
    roles: GESTAO,
    section: "gestao",
    description: "As empresas atendidas, contatos e acessos ao portal.",
  },
  {
    label: "Equipe e Skills",
    href: "/painel/equipe",
    icon: UserRound,
    roles: GESTAO,
    section: "gestao",
    description: "Quem é da casa, função, área e as habilidades de cada um.",
  },
  {
    label: "Full Days",
    href: "/painel/full-days",
    icon: Sun,
    roles: EQUIPE,
    section: "gestao",
    description: "Solicitação e aprovação de folgas.",
  },
  {
    label: "Financeiro e NFs",
    href: "/painel/financeiro",
    icon: CircleDollarSign,
    roles: SOCIO,
    section: "gestao",
    description: "Faturamento, notas fiscais e a saúde financeira da agência.",
  },

  // --- Pessoal -------------------------------------------------------------
  {
    label: "Minhas Skills",
    href: "/painel/minhas-skills",
    icon: Wrench,
    roles: EQUIPE,
    section: "pessoal",
    description: "Suas habilidades registradas e o que você quer desenvolver.",
  },
  {
    label: "Diário",
    href: "/painel/diario",
    icon: NotebookPen,
    roles: EQUIPE,
    section: "pessoal",
    description: "Seu registro do dia a dia de trabalho.",
  },
  {
    label: "Academy",
    href: "/painel/academy",
    icon: BookOpen,
    roles: EQUIPE,
    section: "pessoal",
    description: "Trilhas e materiais de formação da agência.",
  },
  {
    label: "Recomendações",
    href: "/painel/recomendacoes",
    icon: ThumbsUp,
    roles: EQUIPE,
    section: "pessoal",
    description: "Reconhecimento entre colegas.",
  },
  {
    // Módulo opcional: o uso real pela equipe ainda é incerto, então entra no
    // fim da seção e com peso visual reduzido. Não destacar nem no onboarding.
    label: "Financeiro Pessoal",
    href: "/painel/financeiro-pessoal",
    icon: PiggyBank,
    roles: EQUIPE,
    section: "pessoal",
    description: "Controle das suas finanças pessoais. Opcional.",
    muted: true,
  },

  // --- Fora do menu --------------------------------------------------------
  {
    label: "Meu perfil",
    href: "/painel/meu-perfil",
    icon: UserRound,
    roles: EQUIPE,
    section: "pessoal",
    description: "Seus dados de acesso e preferências.",
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
    section: "pessoal",
    description: "Demonstração dos componentes compartilhados.",
    hiddenFromMenu: true,
  },
];

/**
 * Rotas que entram em sprints futuros. Ficam registradas para ninguém
 * reaproveitar o caminho por engano, e não são criadas agora.
 *
 *   /painel/metricas   e  /painel/resumo    -> Sprint 15
 *   /painel/auditoria  (somente socio)      -> Sprint 16
 */
export const ROTAS_FUTURAS = ["/painel/metricas", "/painel/resumo", "/painel/auditoria"];

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
