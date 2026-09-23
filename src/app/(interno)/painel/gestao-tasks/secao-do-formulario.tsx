import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Uma seção numerada do formulário de abertura de demanda.
 *
 * O formulário de Nova Task pede muita coisa, e isso não é acidente: uma
 * demanda mal aberta custa uma semana de idas e vindas. Mas uma coluna de
 * quinze campos soltos faz a pessoa preencher no piloto automático e errar
 * justamente no que importa.
 *
 * O número não é enfeite: ele dá à conversa um jeito de apontar ("faltou a
 * 5") sem que ninguém precise descrever onde o campo fica na tela.
 *
 * **NÃO TEM `explicacao`, e a ausência é deliberada.** A linha embaixo de
 * cada título saiu por decisão do produto. A prop foi removida junto com as
 * chamadas, e não só as chamadas: prop opcional que ninguém usa volta na
 * primeira seção nova que alguém escrever copiando outra.
 */
export function SecaoDoFormulario({
  numero,
  titulo,
  acao,
  children,
  className,
}: {
  numero: number;
  titulo: string;
  /** Botão do canto direito do cabeçalho, quando a seção tem um. */
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-text-primary flex items-center gap-2 text-sm font-semibold">
            <span
              aria-hidden
              className="bg-blue-soft text-accent-strong flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
            >
              {numero}
            </span>
            {titulo}
          </h3>
        </div>
        {acao ? <div className="shrink-0">{acao}</div> : null}
      </div>

      {children}
    </section>
  );
}
