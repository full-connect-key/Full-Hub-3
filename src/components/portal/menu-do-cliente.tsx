"use client";

import Link from "next/link";

import { useTheme } from "next-themes";
import { startTransition } from "react";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";

import { iniciaisDe } from "@/components/shared/user-avatar";
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

/**
 * `hrefDosDados` existe por causa da visualização administrativa. Na tela do
 * cliente, "Meus dados" leva às Configurações do portal. Em /portal/{slug},
 * quem está logado é da equipe: mandá-la para as Configurações do portal seria
 * mandá-la para uma rota que `exigirCliente()` recusa com 403 — o menu levaria
 * a pessoa para fora, e para um erro.
 */
export function MenuDoCliente({
  nome,
  email,
  hrefDosDados = "/portal/configuracoes",
}: {
  nome: string;
  email: string;
  hrefDosDados?: string;
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
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={hrefDosDados}>
            <UserRound aria-hidden />
            Meus dados
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={(evento) => {
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
