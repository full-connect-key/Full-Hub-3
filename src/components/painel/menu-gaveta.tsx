"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { ListaDoMenu } from "@/components/painel/lista-do-menu";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ANCORAS, ancora } from "@/lib/tour/ancoras";
import type { UserRole } from "@/lib/supabase/database.types";

/**
 * Abaixo de 1024px o menu lateral vira gaveta.
 *
 * Mesmo fundo escuro da barra do desktop: os itens do menu foram escritos para
 * ler sobre escuro, e uma gaveta clara os deixaria quase invisíveis.
 */
export function MenuGaveta({
  role,
  ehAtendimento,
}: {
  role: UserRole;
  /** Repassado a `ListaDoMenu`: o item de Solicitações é do Atendimento. */
  ehAtendimento: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        {/* A MESMA ÂNCORA DA `<nav>` da barra lateral, de propósito: no
            celular esta é a única das duas que existe na página, e o provedor
            do tour escolhe o primeiro VISÍVEL. Sem isso o primeiro passo do
            tour seria pulado em silêncio em toda largura abaixo de 1024px. */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir menu"
          {...ancora(ANCORAS.menu)}
        >
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-surface-sidebar w-72 border-none p-0">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle className="text-left">
            <Logo tamanho="sm" />
          </SheetTitle>
          <SheetDescription className="sr-only">Módulos do painel interno</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-3 pb-6">
          <ListaDoMenu
            role={role}
            ehAtendimento={ehAtendimento}
            aoNavegar={() => setAberto(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
