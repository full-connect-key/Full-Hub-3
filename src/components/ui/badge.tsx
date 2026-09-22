import type { ReactNode } from "react";

type Tom = "neutro" | "positivo" | "atencao" | "negativo" | "brand";

const tons: Record<Tom, string> = {
  neutro: "bg-superficie-suave text-texto-suave",
  positivo: "bg-positivo-suave text-positivo",
  atencao: "bg-atencao-suave text-atencao",
  negativo: "bg-negativo-suave text-negativo",
  brand: "bg-brand-suave text-brand",
};

export function Badge({ children, tom = "neutro" }: { children: ReactNode; tom?: Tom }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tons[tom]}`}
    >
      {children}
    </span>
  );
}
