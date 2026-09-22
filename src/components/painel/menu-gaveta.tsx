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
import type { UserRole } from "@/lib/supabase/database.types";

/** Abaixo de 1024px o menu lateral vira gaveta. */
export function MenuGaveta({ role }: { role: UserRole }) {
  const [aberto, setAberto] = useState(false);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle className="text-left">
            <Logo tamanho="sm" />
          </SheetTitle>
          <SheetDescription className="sr-only">Módulos do painel interno</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-3 pb-6">
          <ListaDoMenu role={role} aoNavegar={() => setAberto(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
