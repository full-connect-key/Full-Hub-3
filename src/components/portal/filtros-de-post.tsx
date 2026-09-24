"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  rotuloDoStatus,
  STATUS_DE_CONTEUDO,
} from "@/components/shared/status-badge";
import {
  PLATAFORMAS,
  ROTULO_DA_PLATAFORMA,
  type FiltrosDePost,
} from "@/lib/dominio/posts";
import type {
  ContentStatus,
  PlataformaSocial,
} from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * Plataforma e status, em chips, na URL.
 *
 * Mesmo desenho dos filtros do resto do Portal: chip e não `<select>`, porque
 * no celular — que é de onde o cliente aprova — um select abre uma roda nativa
 * por cima da tela inteira para escolher entre sete coisas.
 *
 * Mexer no filtro NÃO mexe no mês nem no dia aberto: eles são outros
 * parâmetros, e perder o mês ao filtrar por Instagram jogaria a pessoa de
 * volta para hoje no meio da conferência.
 */
function Chip({
  ativo,
  children,
  aoClicar,
}: {
  ativo: boolean;
  children: React.ReactNode;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition-colors",
        ativo
          ? "border-accent-strong bg-accent text-accent-foreground font-medium"
          : "hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function FiltrosDePosts({
  filtros,
  encontrados,
}: {
  filtros: FiltrosDePost;
  encontrados: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  function navegar(mudancas: Record<string, string | null>) {
    const proximos = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") proximos.delete(chave);
      else proximos.set(chave, valor);
    }
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  const algumAtivo = filtros.plataforma !== null || filtros.status !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PLATAFORMAS.map((rede: PlataformaSocial) => (
          <Chip
            key={rede}
            ativo={filtros.plataforma === rede}
            aoClicar={() =>
              navegar({
                plataforma: filtros.plataforma === rede ? null : rede,
              })
            }
          >
            {ROTULO_DA_PLATAFORMA[rede]}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_DE_CONTEUDO.map((status: ContentStatus) => (
          <Chip
            key={status}
            ativo={filtros.status === status}
            aoClicar={() =>
              navegar({ status: filtros.status === status ? null : status })
            }
          >
            {rotuloDoStatus(status)}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">
          {encontrados} {encontrados === 1 ? "material" : "materiais"}
        </Badge>

        {algumAtivo ? (
          <button
            type="button"
            onClick={() => navegar({ plataforma: null, status: null })}
            className="text-text-muted hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <X aria-hidden className="size-3.5" />
            Limpar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
