"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Linha de filtros das telas de listagem: selects para escolha única e chips
 * para ligar/desligar.
 *
 * O botão "Limpar filtros" só aparece quando há algo aplicado — botão morto
 * ocupando espaço é ruído, e sem ele a pessoa fica sem saída quando a lista
 * some por causa de um filtro que ela esqueceu.
 */

export type SelectFilter = {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Rótulo da opção que não filtra nada. */
  allLabel?: string;
};

export type ChipFilter = {
  id: string;
  label: string;
  active: boolean;
  onToggle: () => void;
};

/** Valor usado para "sem filtro". O Select do Radix não aceita valor vazio. */
export const SEM_FILTRO = "__todos__";

export function FilterBar({
  selects = [],
  chips = [],
  onClear,
  children,
  className,
}: {
  selects?: SelectFilter[];
  chips?: ChipFilter[];
  onClear?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const algumAtivo =
    selects.some((filtro) => filtro.value !== SEM_FILTRO && filtro.value !== "") ||
    chips.some((chip) => chip.active);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {selects.map((filtro) => (
        <Select key={filtro.id} value={filtro.value || SEM_FILTRO} onValueChange={filtro.onChange}>
          <SelectTrigger size="sm" aria-label={filtro.label}>
            <SelectValue placeholder={filtro.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_FILTRO}>{filtro.allLabel ?? filtro.label}</SelectItem>
            {filtro.options.map((opcao) => (
              <SelectItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onToggle}
          aria-pressed={chip.active}
          className={cn(
            "focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
            chip.active
              ? "border-blue-muted bg-accent text-accent-strong"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {chip.label}
        </button>
      ))}

      {children}

      {algumAtivo && onClear ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X aria-hidden />
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
