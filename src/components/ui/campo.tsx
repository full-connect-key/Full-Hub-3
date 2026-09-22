import type { ComponentProps, ReactNode } from "react";

export function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-texto">{rotulo}</span>
      {children}
      {dica ? <span className="mt-1.5 block text-xs text-texto-tenue">{dica}</span> : null}
    </label>
  );
}

export function Entrada({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto placeholder:text-texto-tenue focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
