"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

/**
 * A foto da pessoa, CORTADA no círculo e nunca achatada.
 *
 * `object-cover` não é detalhe de estilo: um `<img>` sem `object-fit` usa o
 * padrão `fill`, que ESTICA a imagem até preencher a caixa — e a caixa aqui é
 * `aspect-square size-full`, quadrada por definição. O resultado é que toda
 * foto que não é quadrada sai deformada: a vertical some pelos lados, a
 * horizontal achata o rosto. Com `cover` a proporção fica, e o que sobra é
 * cortado pelo `overflow-hidden` do `Avatar` — que é o que se espera de um
 * avatar redondo.
 *
 * `center` é explícito pela mesma razão do par nomeado em cor de estado: ele é
 * o padrão do CSS, e escrevê-lo impede que alguém o troque sem perceber que
 * está escolhendo onde o retrato é cortado. Rosto costuma estar no meio ou no
 * alto; o meio é a aposta que erra menos, e o alto exigiria saber onde o rosto
 * está, que esta camada não sabe.
 */
function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover object-center", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
