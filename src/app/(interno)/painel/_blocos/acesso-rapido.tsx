import Link from "next/link";
import { ArrowRight, ListChecks, Receipt, UserRound } from "lucide-react";

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
    // O terceiro atalho é sempre uma tarefa PESSOAL e recorrente — daquelas
    // que se lembram ao chegar e se esquecem depois. É o critério, e é por
    // ele que o ocupante mudou quando o anterior saiu do produto.
    label: "Notas Fiscais",
    frase: "Envio e pagamento",
    href: "/painel/notas-fiscais",
    icone: Receipt,
  },
  {
    label: "Meu Perfil",
    frase: "Foto e dados pessoais",
    href: "/painel/perfil",
    icone: UserRound,
  },
];

/**
 * **A LISTA É VERTICAL, e não mais três cartões lado a lado.** Ela mudou de
 * lugar com a composição do desenho aprovado: era uma faixa na largura inteira
 * da página, e virou o último cartão da coluna de 306px. Em três colunas ali
 * cada atalho ficava com noventa e poucos pixels, e o rótulo e a frase embaixo
 * dele saíam truncados os dois — "Notas Fisc…" acima de "Envio e paga…".
 */
export function AcessoRapido() {
  return (
    <section className="bg-surface-card rounded-card space-y-2.5 border p-4">
      <h2 className="text-text-secondary text-xs font-bold tracking-wider uppercase">
        Acesso rápido
      </h2>

      <ul className="flex flex-col gap-1">
        {ATALHOS.map((atalho) => (
          <li key={atalho.href}>
            <Link
              href={atalho.href}
              className="hover:bg-accent/50 focus-visible:ring-ring/50 group -mx-1.5 flex h-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span
                aria-hidden
                className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
              >
                <atalho.icone className="size-4" />
              </span>

              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-text-primary truncate text-sm font-semibold">
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
