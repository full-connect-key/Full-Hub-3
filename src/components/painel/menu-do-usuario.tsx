"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { startTransition } from "react";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ANCORAS, ancora } from "@/lib/tour/ancoras";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sair } from "@/lib/auth/acoes";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/supabase/database.types";

export function MenuDoUsuario({
  nome,
  email,
  role,
  avatarUrl,
  hrefDoPerfil,
}: {
  nome: string;
  email: string;
  role: UserRole;
  /** A foto do Meu Perfil. Nulo cai nas iniciais, como em todo avatar. */
  avatarUrl: string | null;
  hrefDoPerfil: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          {...ancora(ANCORAS.menuDoUsuario)}
          variant="ghost"
          size="icon"
          className="disco-da-topbar rounded-full"
          aria-label="Menu do usuário"
        >
          {/* O AVATAR MAIS OLHADO DO PRODUTO, e ele não mostrava a foto.
              Esta é a única coisa que acompanha a pessoa em toda tela do
              painel, e por doze sprints ela desenhou `AvatarFallback` sem
              `AvatarImage` nenhum: quem subia a foto em Meu Perfil a via na
              ficha, no board e na barra lateral, e não aqui.

              `UserAvatar` E NÃO O `Avatar` À MÃO, que é a regra escrita:
              todo avatar do produto passa por ele, porque é ele que carrega
              o `object-cover object-center` do `AvatarImage` — e uma segunda
              forma de desenhar o círculo é onde essa propriedade se perde.
              Foi assim que a foto saiu achatada na plataforma inteira uma
              vez.

              `tooltip={false}` porque o círculo mora DENTRO deste botão: o
              `TooltipTrigger` do Radix é interativo, e interativo dentro de
              interativo é `nested-interactive` — crítico no axe, e duas
              paradas de Tab para a mesma coisa. O nome já está no
              `aria-label` do botão e na primeira linha do menu aberto. */}
          <UserAvatar name={nome} src={avatarUrl} size="md" tooltip={false} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-medium">{nome}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {ROTULOS_DE_ROLE[role]}
          </p>
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
