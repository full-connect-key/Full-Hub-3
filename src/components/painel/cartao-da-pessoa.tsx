import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { iniciaisDe } from "@/components/shared/user-avatar";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/supabase/database.types";

/**
 * Quem está logado, no pé da barra lateral.
 *
 * Três linhas com papéis diferentes: o NOME é quem você é, o CARGO é o que
 * você faz na agência, e o PERFIL é o que você alcança na plataforma. As duas
 * últimas se confundem o tempo todo — uma pessoa pode ser "Social Media" de
 * cargo e "Desenvolvedor" de perfil de acesso —, por isso o perfil vem em azul
 * da marca, separado do resto.
 *
 * Não usa o UserAvatar compartilhado: aquele traz um tooltip com o nome, que
 * aqui seria repetir o que já está escrito ao lado. As primitivas do Avatar
 * são as mesmas; o que muda são as cores, porque esta barra tem fundo próprio.
 */
export function CartaoDaPessoa({
  nome,
  cargo,
  role,
  avatarUrl,
}: {
  nome: string;
  cargo: string | null;
  role: UserRole;
  avatarUrl: string | null;
}) {
  return (
    <Link
      href="/painel/perfil"
      className="bg-surface-sidebar-2 hover:bg-surface-sidebar-2/70 focus-visible:ring-brand-blue/60 recolhido:lg:justify-center recolhido:lg:px-2 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Avatar className="size-8 shrink-0">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="bg-brand-blue text-brand-foreground text-xs font-semibold">
          {iniciaisDe(nome)}
        </AvatarFallback>
      </Avatar>

      <span className="recolhido:lg:hidden flex min-w-0 flex-col leading-tight">
        <span className="text-text-on-dark truncate text-sm font-medium">{nome}</span>
        {cargo ? <span className="text-text-muted truncate text-xs">{cargo}</span> : null}
        <span className="text-brand-blue truncate text-[11px] font-medium">
          {ROTULOS_DE_ROLE[role]}
        </span>
      </span>
    </Link>
  );
}
