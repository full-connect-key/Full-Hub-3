"use client";

import Link from "next/link";

import { useTheme } from "next-themes";
import { startTransition } from "react";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
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
import { ANCORAS, ancora } from "@/lib/tour/ancoras";

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
  avatarUrl = null,
  hrefDosDados = "/portal/configuracoes",
}: {
  nome: string;
  email: string;
  /**
   * A foto de quem está logado.
   *
   * **QUEM ELA SERVE HOJE É A VISUALIZAÇÃO ADMINISTRATIVA**, e isso fica dito
   * em vez de escondido: em `/portal/{slug}` quem está logado é da equipe, com
   * a foto que ela subiu em Meu Perfil. Na sessão do CLIENTE ela cai nas
   * iniciais quase sempre, porque o portal não tem onde subir foto de pessoa —
   * o que ele tem é o logo da EMPRESA, que é outro campo e aparece no
   * cabeçalho.
   *
   * Ela entra assim mesmo porque o custo é uma propriedade e o caminho é o
   * mesmo: no dia em que o cliente ganhar onde subir a dele, não há segundo
   * lugar para lembrar.
   */
  avatarUrl?: string | null;
  hrefDosDados?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* O ÚLTIMO PASSO DO TOUR DO PORTAL aponta para cá, e não para o item
            "Meus dados" de dentro: a lista do menu só existe na página com ele
            aberto, e o tour não abre menu de ninguém — quem abre é quem o
            encontrou, que é exatamente o que este passo ensina. */}
        <Button
          variant="ghost"
          size="icon"
          className="disco-da-topbar rounded-full"
          aria-label="Menu do usuário"
          {...ancora(ANCORAS.portalConfiguracoes)}
        >
          {/* `UserAvatar` com `tooltip={false}`: o círculo mora dentro deste
              botão, e o `TooltipTrigger` do Radix dentro de um `<button>` é
              `nested-interactive`. A razão inteira está em `user-avatar.tsx`. */}
          <UserAvatar name={nome} src={avatarUrl} size="md" tooltip={false} />
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
