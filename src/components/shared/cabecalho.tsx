import { LogOut } from "lucide-react";

import { AlternadorDeTema } from "@/components/shared/alternador-de-tema";
import { Logo } from "@/components/shared/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sair } from "@/lib/auth/acoes";
import { iniciais } from "@/lib/auth/dal";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/supabase/database.types";

/**
 * Barra do topo, usada pelas duas areas.
 *
 * O menu lateral completo entra no proximo sprint; por enquanto a barra segura
 * o essencial: quem esta logado, o tema e a saida.
 */
export function Cabecalho({
  nome,
  email,
  role,
  area,
}: {
  nome: string;
  email: string;
  role: UserRole;
  area: string;
}) {
  return (
    <header className="bg-background/90 sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 backdrop-blur lg:px-6">
      <Logo tamanho="sm" />
      <span className="text-muted-foreground hidden text-sm sm:inline">/ {area}</span>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {ROTULOS_DE_ROLE[role]}
        </Badge>

        <div className="hidden text-right md:block">
          <p className="text-sm leading-tight font-medium">{nome}</p>
          <p className="text-muted-foreground text-xs leading-tight">{email}</p>
        </div>

        <Avatar>
          <AvatarFallback>{iniciais(nome)}</AvatarFallback>
        </Avatar>

        <AlternadorDeTema />

        <form action={sair}>
          <Button type="submit" variant="ghost" size="icon" title="Sair">
            <LogOut aria-hidden />
            <span className="sr-only">Sair</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
