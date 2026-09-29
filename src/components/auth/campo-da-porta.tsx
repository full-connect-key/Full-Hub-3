"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Um campo da porta: rótulo, ícone à esquerda e o campo em vidro.
 *
 * **Ele existe para as QUATRO telas de (auth) não divergirem.** A casca é a
 * mesma em login, esqueci-senha, redefinir-senha e trocar-senha, e cada uma
 * tinha os campos montados por conta própria. Com o desenho novo isso passaria
 * a significar quatro versões do mesmo campo de vidro, e a que divergisse seria
 * a de trocar-senha — a tela que ninguém abre depois do primeiro acesso.
 *
 * **É o `Input` do shadcn com as cores trocadas, e não um `<input>` cru.**
 * O que vem de graça dali é o que custa caro reescrever: o anel de foco, o
 * `aria-invalid` pintando a borda, e o estado desabilitado.
 *
 * **O olho mora aqui, e não em cada tela.** Ele é um botão de verdade, com
 * rótulo que troca — "Mostrar a senha" / "Esconder a senha" —, senão quem usa
 * leitor de tela ouve "botão" e mais nada.
 */
export function CampoDaPorta({
  id,
  rotulo,
  icone: Icone,
  registro,
  tipo = "text",
  senha = false,
  erro,
  dica,
  ...props
}: {
  id: string;
  rotulo: string;
  icone: LucideIcon;
  registro: UseFormRegisterReturn;
  tipo?: "text" | "email";
  /** Liga o olho, e o campo nasce escondido. */
  senha?: boolean;
  erro?: string;
  /** A linha de apoio que aparece quando não há erro. */
  dica?: string;
} & Omit<React.ComponentProps<"input">, "id" | "type">) {
  const [aberta, abrir] = useState(false);

  return (
    <div className="space-y-[7px] text-left">
      <Label htmlFor={id} className="text-auth-rotulo text-[12.5px]">
        {rotulo}
      </Label>

      <div className="relative flex items-center">
        <Icone
          aria-hidden
          className="text-auth-apoio pointer-events-none absolute left-[14px] size-[17px]"
        />
        <Input
          id={id}
          type={senha ? (aberta ? "text" : "password") : tipo}
          aria-invalid={!!erro}
          className={cn(
            "bg-auth-campo border-auth-campo-borda text-auth-texto placeholder:text-auth-apoio",
            "h-auto rounded-xl py-[13px] pl-[42px] text-sm shadow-none",
            "focus-visible:border-brand-blue focus-visible:ring-brand-blue/20",
            senha && "pr-11",
          )}
          {...props}
          {...registro}
        />
        {senha ? (
          <button
            type="button"
            onClick={() => abrir((v) => !v)}
            aria-label={aberta ? "Esconder a senha" : "Mostrar a senha"}
            className="text-auth-apoio hover:text-auth-rotulo absolute right-[9px] grid place-items-center rounded-md p-[7px] transition-colors"
          >
            {aberta ? (
              <EyeOff aria-hidden className="size-[18px]" />
            ) : (
              <Eye aria-hidden className="size-[18px]" />
            )}
          </button>
        ) : null}
      </div>

      {erro ? (
        <p className="text-destructive text-xs">{erro}</p>
      ) : dica ? (
        <p className="text-auth-apoio text-xs">{dica}</p>
      ) : null}
    </div>
  );
}
