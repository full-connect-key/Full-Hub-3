import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Boxes } from "lucide-react";

import type { MeuComodato } from "@/lib/dados/comodatos";
import { ICONE_DO_TIPO, ROTULOS_DE_TIPO } from "@/lib/dominio/comodatos";
import { cn } from "@/lib/utils";

/**
 * O equipamento da agência que está comigo — na tela inicial.
 *
 * **Ele SOME para quem não tem nenhum**, como todo bloco de exceção da Home:
 * uma caixa fixa dizendo "nenhum equipamento" ocuparia todo dia, na primeira
 * tela de todo mundo, o lugar de uma informação que interessa em alguns dias.
 *
 * **E o recebimento pendente é o que ele destaca.** Um comodato sem confirmar
 * é a única coisa aqui que pede ação da pessoa, e é o que faz o bloco valer
 * mais que a linha do menu: quem não abre Comodatos por hábito descobre por
 * aqui que alguém entregou algo no nome dele.
 *
 * **TRÊS ITENS E O LINK**, e não a lista inteira: quem tem oito equipamentos
 * transformaria a Home numa tela de inventário, e o lugar do inventário é o
 * módulo.
 */
const NO_MAXIMO = 3;

export function MeusEquipamentos({ comodatos }: { comodatos: MeuComodato[] }) {
  const comigo = comodatos.filter((c) => !c.devolvido);
  if (comigo.length === 0) return null;

  const pendentes = comigo.filter((c) => c.aceito_em === null);
  const mostrar = [...pendentes, ...comigo.filter((c) => c.aceito_em !== null)].slice(0, NO_MAXIMO);
  const sobraram = comigo.length - mostrar.length;

  return (
    <section className="space-y-3" aria-labelledby="meus-equipamentos-titulo">
      <h2
        id="meus-equipamentos-titulo"
        className="text-text-primary flex items-center gap-2 text-sm font-semibold tracking-wide uppercase"
      >
        <Boxes aria-hidden className="size-4" />
        Meus equipamentos
        <Link
          href="/painel/comodatos"
          className="text-accent-strong ms-auto text-xs font-normal tracking-normal normal-case hover:underline"
        >
          Ver todos
        </Link>
      </h2>

      {pendentes.length > 0 ? (
        <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-xs">
          <AlertTriangle aria-hidden className="me-1 inline size-3.5 align-text-bottom" />
          {pendentes.length === 1
            ? "Um recebimento espera a sua confirmação."
            : `${pendentes.length} recebimentos esperam a sua confirmação.`}
        </p>
      ) : null}

      <ul className="divide-border divide-y rounded-xl border">
        {mostrar.map((c) => {
          const Icone = ICONE_DO_TIPO[c.tipo];
          return (
            <li key={c.loan_id}>
              <Link
                href="/painel/comodatos"
                className="hover:bg-accent/50 flex items-center gap-3 px-3 py-2.5 transition-colors"
              >
                <span className="bg-muted text-text-muted grid size-8 shrink-0 place-items-center rounded">
                  <Icone aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-text-primary block truncate text-sm">{c.nome}</span>
                  <span className="text-text-muted block truncate text-xs">
                    {ROTULOS_DE_TIPO[c.tipo]}
                    {c.codigo ? ` · ${c.codigo}` : ""} · desde{" "}
                    {format(parseISO(c.data_entrega), "dd/MM/yy", { locale: ptBR })}
                  </span>
                </span>
                {c.aceito_em === null ? (
                  <span
                    className={cn(
                      "bg-warning-soft text-warning shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    )}
                  >
                    confirmar
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {sobraram > 0 ? (
        <p className="text-text-muted text-xs">
          e mais {sobraram} {sobraram === 1 ? "equipamento" : "equipamentos"}.
        </p>
      ) : null}
    </section>
  );
}
