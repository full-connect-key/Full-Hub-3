import { BadgeCheck, Home, Megaphone, Settings, Share2, type LucideIcon } from "lucide-react";

/**
 * Navegação do Portal do Cliente.
 *
 * Separada do menu do painel de propósito: o portal é curto, plano e sem
 * perfis — todo cliente vê os mesmos itens. Misturar as duas navegações num
 * arquivo só faria a regra de permissão do painel valer para quem não tem
 * perfil de acesso interno.
 */
export type ItemDoPortal = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const NAVEGACAO_DO_PORTAL: ItemDoPortal[] = [
  {
    label: "Início",
    href: "/portal",
    icon: Home,
    description: "O panorama do que está acontecendo na sua conta.",
  },
  {
    label: "Aprovações",
    href: "/portal/aprovacoes",
    icon: BadgeCheck,
    description: "O que a agência enviou para a sua aprovação.",
  },
  {
    label: "Social Media",
    href: "/portal/social-media",
    icon: Share2,
    description: "Os conteúdos das suas redes, para acompanhar e aprovar.",
  },
  {
    label: "Campanhas",
    href: "/portal/campanhas",
    icon: Megaphone,
    description: "Suas campanhas em andamento e os resultados de cada uma.",
  },
  {
    label: "Configurações",
    href: "/portal/configuracoes",
    icon: Settings,
    description: "Seus dados de contato e preferências de acesso.",
  },
];

export function acharItemDoPortal(pathname: string): ItemDoPortal | undefined {
  const candidatos = NAVEGACAO_DO_PORTAL.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (candidatos.length === 0) return undefined;
  return candidatos.reduce((maior, item) => (item.href.length > maior.href.length ? item : maior));
}

/**
 * A mesma navegação, com outro prefixo.
 *
 * Serve a visualização administrativa, em /portal/{slug}: os itens são os
 * mesmos do portal do cliente — é esse o ponto, mostrar o que ele vê — e só o
 * caminho muda.
 */
export function navegacaoComBase(base: string): ItemDoPortal[] {
  if (base === "/portal") return NAVEGACAO_DO_PORTAL;
  return NAVEGACAO_DO_PORTAL.map((item) => ({
    ...item,
    href: item.href === "/portal" ? base : `${base}${item.href.slice("/portal".length)}`,
  }));
}
