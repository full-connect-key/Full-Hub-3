"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { startTransition } from "react";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sair } from "@/lib/auth/acoes";
import { iniciaisDe } from "@/components/shared/user-avatar";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/supabase/database.types";

export function MenuDoUsuario({
  nome,
  email,
  role,
  hrefDoPerfil,
}: {
  nome: string;
  email: string;
  role: UserRole;
  hrefDoPerfil: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu do usuário">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs font-medium">{iniciaisDe(nome)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-medium">{nome}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
          <p className="text-muted-foreground mt-1 text-xs">{ROTULOS_DE_ROLE[role]}</p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={hrefDoPerfil}>
            <UserRound aria-hidden />
            Meu perfil
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={(evento) => {
            // Sem isto o menu fecha antes de o tema trocar, e a mudança some.
            evento.preventDefault();
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          }}
        >
          <Moon aria-hidden className="block dark:hidden" />
          <Sun aria-hidden className="hidden dark:block" />
          Alternar tema
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onSelect={() => startTransition(() => void sair())}
        >
          <LogOut aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
