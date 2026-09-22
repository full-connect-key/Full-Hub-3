import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

type Tipo = "erro" | "sucesso" | "info";

const estilos: Record<Tipo, { caixa: string; Icone: typeof Info }> = {
  erro: { caixa: "bg-negativo-suave text-negativo", Icone: AlertCircle },
  sucesso: { caixa: "bg-positivo-suave text-positivo", Icone: CheckCircle2 },
  info: { caixa: "bg-brand-suave text-brand", Icone: Info },
};

export function Aviso({ tipo = "info", children }: { tipo?: Tipo; children: ReactNode }) {
  const { caixa, Icone } = estilos[tipo];
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm ${caixa}`}
      role={tipo === "erro" ? "alert" : "status"}
    >
      <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
