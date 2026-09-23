import Link from "next/link";
import { FileEdit } from "lucide-react";

import { rascunhosAExpirar } from "@/lib/dados/tasks";

/**
 * O aviso do sexto dia.
 *
 * Rascunho sem alteração some no sétimo dia. Apagar sem avisar seria apagar
 * de surpresa — e o que some é justamente o que alguém começou e não
 * terminou, que é o tipo de coisa cuja falta só se percebe tarde.
 *
 * **Não aparece quando não há nada a avisar**, e é o normal: um bloco fixo
 * dizendo "nenhum rascunho para expirar" ocuparia todo dia o lugar de uma
 * informação que interessa em raríssimos dias.
 */
export async function RascunhosAExpirar() {
  const rascunhos = await rascunhosAExpirar();
  if (rascunhos.length === 0) return null;

  return (
    <section className="bg-warning-soft rounded-card border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <FileEdit aria-hidden className="size-4" />
        {rascunhos.length === 1
          ? "Um rascunho seu some amanhã"
          : `${rascunhos.length} rascunhos seus somem amanhã`}
      </h2>

      <p className="text-text-secondary mt-1 text-sm">
        Rascunho sem alteração há 7 dias é apagado. Abrir e mexer em qualquer campo já reinicia a
        contagem.
      </p>

      <ul className="mt-3 space-y-1">
        {rascunhos.map((r) => (
          <li key={r.id}>
            <Link
              href={`/painel/gestao-tasks/${r.id}`}
              className="text-accent-strong text-sm hover:underline"
            >
              {r.titulo || "Sem título"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
