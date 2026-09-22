import { LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

export type ItemDeMenu = {
  rotulo: string;
  href: string;
  Icone: LucideIcon;
};

/**
 * Menu lateral do dashboard.
 *
 * Ponto unico de cadastro: a cada sprint, crie a pagina em
 * src/app/(dashboard)/<rota>/page.tsx e adicione uma linha aqui.
 * O item ativo, o destaque e a versao mobile ja funcionam sozinhos.
 *
 * Exemplo:
 *   { rotulo: "Clientes", href: "/clientes", Icone: Users },
 */
export const MENU: ItemDeMenu[] = [
  { rotulo: "Visao geral", href: "/dashboard", Icone: LayoutDashboard },
  { rotulo: "Configuracoes", href: "/configuracoes", Icone: Settings },
];

/** Marca o item ativo, considerando tambem as sub-rotas (/clientes/123). */
export function itemAtivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
