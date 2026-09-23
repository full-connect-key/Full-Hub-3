"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { rotuloDoStatus } from "@/components/shared/status-badge";
import {
  ROTULOS_DE_PRAZO,
  ROTULO_DO_TIPO,
  TIPOS_DE_ITEM,
  type FiltrosDoPortal,
  type FocoDePrazo,
  type TipoDeItem,
} from "@/lib/dominio/portal";
import { STATUS_DE_CONTEUDO } from "@/components/shared/status-badge";
import type { ContentStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * Os filtros do portal.
 *
 * **Moram na URL, como em toda listagem do produto.** "Olha o que está
 * esperando você" precisa ser um link que abre já filtrado, e a escolha
 * precisa sobreviver a um F5 no meio da aprovação.
 *
 * **Em chips, e não em `<select>`.** No celular — que é de onde o cliente
 * aprova — um select abre uma roda nativa por cima da tela inteira para
 * escolher entre três coisas. Chip é um toque.
 */

const PRAZOS: FocoDePrazo[] = ["urgente", "semana", "adiante"];

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
        // min-h-9 não é decoração: é o alvo mínimo confortável para o polegar.
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

export function FiltrosDoPortalCliente({
  filtros,
  encontrados,
  comBusca = false,
}: {
  filtros: FiltrosDoPortal;
  encontrados: number;
  comBusca?: boolean;
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

  const algumAtivo =
    filtros.tipo !== null ||
    filtros.status !== null ||
    filtros.prazo !== null ||
    filtros.busca !== "";

  return (
    <div className="space-y-4">
      {comBusca ? (
        <div className="relative">
          <Search
            aria-hidden
            className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            defaultValue={filtros.busca}
            onChange={(evento) => navegar({ busca: evento.target.value })}
            placeholder="Buscar por material, demanda ou empresa"
            aria-label="Buscar"
            className="pl-9"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TIPOS_DE_ITEM.map((tipo: TipoDeItem) => (
          <Chip
            key={tipo}
            ativo={filtros.tipo === tipo}
            aoClicar={() =>
              navegar({ tipo: filtros.tipo === tipo ? null : tipo })
            }
          >
            {ROTULO_DO_TIPO[tipo]}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {PRAZOS.map((prazo) => (
          <Chip
            key={prazo}
            ativo={filtros.prazo === prazo}
            aoClicar={() =>
              navegar({ prazo: filtros.prazo === prazo ? null : prazo })
            }
          >
            {ROTULOS_DE_PRAZO[prazo]}
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
        {/* O contador de resultados fica ao lado do botão de limpar: é ali que
            a pessoa olha quando o filtro não deu o que ela esperava. */}
        <Badge variant="secondary">
          {encontrados} {encontrados === 1 ? "material" : "materiais"}
        </Badge>

        {algumAtivo ? (
          <button
            type="button"
            onClick={() =>
              navegar({ tipo: null, status: null, prazo: null, busca: null })
            }
            className="text-text-muted hover:text-foreground inline-flex items-center gap-1 text-sm underline underline-offset-4"
          >
            <X aria-hidden className="size-3.5" />
            Limpar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
