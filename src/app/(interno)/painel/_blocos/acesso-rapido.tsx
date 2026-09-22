import Link from "next/link";
import { ArrowRight, ListChecks, NotebookPen, UserRound } from "lucide-react";

/**
 * Os três caminhos que a equipe percorre todo dia.
 *
 * O cartão inteiro é clicável, não só a seta: alvo pequeno em tela de celular
 * é erro de clique, e a seta aqui é indicação de direção, não botão.
 */
const ATALHOS = [
  {
    label: "Minhas Tasks",
    frase: "Tarefas em andamento",
    href: "/painel/minhas-tasks",
    icone: ListChecks,
  },
  {
    label: "Resumo Semanal",
    frase: "Status de entregas",
    href: "/painel/resumo-semanal",
    icone: NotebookPen,
  },
  {
    label: "Meu Perfil",
    frase: "Foto e dados pessoais",
    href: "/painel/perfil",
    icone: UserRound,
  },
];

export function AcessoRapido() {
  return (
    <section className="space-y-3">
      <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
        Acesso rápido
      </h2>

      <ul className="grid gap-3 sm:grid-cols-3">
        {ATALHOS.map((atalho) => (
          <li key={atalho.href}>
            <Link
              href={atalho.href}
              className="bg-surface-card rounded-card hover:border-blue-muted focus-visible:ring-ring/50 group flex h-full items-center gap-3 border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span
                aria-hidden
                className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <atalho.icone className="size-5" />
              </span>

              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-text-primary truncate text-sm font-medium">
                  {atalho.label}
                </span>
                <span className="text-text-muted truncate text-xs">{atalho.frase}</span>
              </span>

              <ArrowRight
                aria-hidden
                className="text-text-muted group-hover:text-accent-strong ml-auto size-4 shrink-0 transition-colors"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
