import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-borda bg-superficie p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitulo({
  children,
  acao,
}: {
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <h2 className="text-sm font-semibold tracking-tight text-texto">{children}</h2>
      {acao}
    </div>
  );
}
