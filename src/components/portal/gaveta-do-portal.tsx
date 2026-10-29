"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import {
  CartaoDeQuemEntrou,
  ListaDaBarraDoPortal,
} from "@/components/portal/barra-lateral-do-portal";
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

/**
 * A barra lateral do portal no celular.
 *
 * **É ELA QUE RESPONDE A OBJEÇÃO QUE TINHA MANTIDO O PORTAL SEM SIDEBAR** —
 * *"no celular ela cobra um toque a mais"*. A proposta pede, com estas palavras,
 * que abaixo de 1024px a barra vire menu recolhível, e é o que isto é: o
 * mesmo `ListaDaBarraDoPortal` da barra fixa, dentro de uma gaveta.
 *
 * **A LISTA É A MESMA FUNÇÃO, nunca uma cópia.** Duas listas de seções no
 * mesmo produto divergem na primeira vez que alguém acrescenta uma — e a que
 * ficaria para trás é a do celular, que é justamente por onde o cliente abre o
 * portal quase sempre. É a lição de `ICONE_DA_AREA`, que tinha três cópias e
 * duas já divergidas.
 *
 * **E ela FECHA ao navegar**, pelo `aoNavegar`: sem isso a gaveta ficaria
 * aberta por cima da tela que acabou de carregar, e a pessoa tocaria fora para
 * descobrir que a navegação já tinha acontecido.
 */
export function GavetaDoPortal({
  base = "/portal",
  nome,
  nomeDaEmpresa,
  avatarUrl = null,
  aprovacoesPendentes = 0,
}: {
  base?: string;
  nome: string;
  nomeDaEmpresa: string | null;
  avatarUrl?: string | null;
  aprovacoesPendentes?: number;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir as seções do portal"
        >
          <Menu aria-hidden className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="bg-surface-sidebar flex w-72 flex-col justify-between border-none px-3 py-5"
      >
        <div>
          <SheetHeader className="px-3 pt-0 pb-6">
            <SheetTitle className="text-left">
              <Logo tamanho="sm" />
            </SheetTitle>
            <SheetDescription className="sr-only">
              As seções do seu portal
            </SheetDescription>
          </SheetHeader>

          <ListaDaBarraDoPortal
            base={base}
            aprovacoesPendentes={aprovacoesPendentes}
            aoNavegar={() => setAberto(false)}
          />
        </div>

        <CartaoDeQuemEntrou
          nome={nome}
          nomeDaEmpresa={nomeDaEmpresa}
          avatarUrl={avatarUrl}
        />
      </SheetContent>
    </Sheet>
  );
}
