"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, FileEdit } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RascunhoDaLista } from "@/lib/dados/tasks";
import { cn } from "@/lib/utils";

/**
 * O grupo RASCUNHOS, no topo da Lista.
 *
 * **Só aparece para quem tem rascunho**, e recolhido. Um grupo vazio ou aberto
 * por padrão roubaria o topo da tela de quem veio ver o trabalho da agência —
 * e o rascunho é, por definição, o que ainda não é trabalho da agência.
 *
 * A contagem fica no cabeçalho justamente para não ser preciso abrir: quem
 * tem um rascunho pendente quer saber que ele existe, não necessariamente
 * voltar a ele agora.
 *
 * **O prazo de validade aparece em cada linha.** Rascunho sem alteração some
 * em 7 dias, e "há 6 dias" ao lado do nome é o que transforma a regra numa
 * informação em vez de numa surpresa.
 */
export function GrupoDeRascunhos({ rascunhos }: { rascunhos: RascunhoDaLista[] }) {
  const [aberto, setAberto] = useState(false);

  if (rascunhos.length === 0) return null;

  return (
    <section className="rounded-lg border">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="hover:bg-accent flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left"
      >
        <ChevronRight
          aria-hidden
          className={cn("text-text-muted size-4 transition-transform", aberto && "rotate-90")}
        />
        <FileEdit aria-hidden className="text-text-muted size-4" />
        <span className="text-xs font-semibold tracking-wide uppercase">Rascunhos</span>
        <Badge variant="secondary" className="tabular-nums">
          {rascunhos.length}
        </Badge>
        <span className="text-text-muted ml-auto text-xs">Só você enxerga</span>
      </button>

      {aberto ? (
        <ul className="divide-y border-t">
          {rascunhos.map((r) => (
            <li key={r.id}>
              <Link
                href={`/painel/gestao-tasks/${r.id}`}
                className="hover:bg-accent flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
              >
                {/* Rascunho sem nome tem nome: sem isto a linha apareceria em
                    branco e a pessoa não teria em que clicar. */}
                <span className={cn("min-w-0 flex-1 truncate", !r.titulo && "text-text-muted italic")}>
                  {r.titulo || "Sem título"}
                </span>

                {r.cliente ? (
                  <Badge variant="outline" className="shrink-0">
                    {r.cliente}
                  </Badge>
                ) : null}

                <span className="text-text-muted shrink-0 text-xs">
                  {r.subtarefas === 0
                    ? "sem etapas"
                    : `${r.subtarefas} etapa${r.subtarefas === 1 ? "" : "s"}`}
                </span>

                <span className="text-text-muted shrink-0 text-xs">
                  mexido{" "}
                  {formatDistanceToNowStrict(parseISO(r.updated_at), {
                    locale: ptBR,
                    addSuffix: true,
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
