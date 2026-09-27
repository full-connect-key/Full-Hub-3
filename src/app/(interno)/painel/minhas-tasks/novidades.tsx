"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, Images, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { NovidadeDeArea } from "@/lib/dados/novidades";

import { marcarNovidadesComoVistas } from "../_actions/notificacoes";

const AREAS = {
  social: {
    rotulo: "Social Media",
    href: "/painel/social-media",
    Icone: Images,
  },
  campanhas: {
    rotulo: "Campanhas",
    href: "/painel/aprovacoes",
    Icone: FolderKanban,
  },
} as const;

/**
 * "Chegou coisa nova para você" — Social Media e Campanhas dentro de Minhas
 * Tasks (decisão do usuário).
 *
 * ---------------------------------------------------------------------------
 * **AS DUAS ÁREAS JÁ ESTAVAM AQUI, e é por isso que esta faixa é um sinal e
 * não uma terceira lista.**
 *
 * As etapas da corrente do Social têm bloco próprio nesta tela desde o Sprint
 * 14. E a peça de campanha é uma SUBTAREFA desde a 0051 — abrir a campanha
 * cria a demanda com uma etapa por entregável, no nome de quem vai produzi-la
 * —, então ela já aparece na lista de etapas, com prazo, cronômetro e o botão
 * certo. Desenhar um bloco "Campanhas" aqui poria o MESMO trabalho duas vezes
 * na mesma tela, que é exatamente o que a 0061 recusou para a subtarefa do
 * post.
 *
 * O que faltava era o aviso: quem ganha um post ou uma peça descobre pelo
 * sino, e o sino é uma lista que se abre por hábito — some da vista no
 * primeiro clique e não volta. Esta faixa põe o mesmo fato na tela em que a
 * pessoa já está.
 * ---------------------------------------------------------------------------
 *
 * **"Marcar como vistas" é marcar como LIDAS**, a mesma escrita do sino. Por
 * isso os dois apagam juntos: um `visto_em` próprio daria dois números sobre o
 * mesmo fato, e a pessoa não teria como saber qual acreditar.
 *
 * **E ela some quando não há nada**, como todo bloco de exceção do produto —
 * uma faixa fixa dizendo "nenhuma novidade" ocupa todo dia, no topo da tela de
 * trabalho, o lugar de uma informação que interessa em alguns dias.
 */
export function Novidades({ novidades }: { novidades: NovidadeDeArea[] }) {
  const router = useRouter();
  const [marcando, marcar] = useTransition();

  if (novidades.length === 0) return null;

  const todos = novidades.flatMap((n) => n.ids);

  function verTudo() {
    marcar(async () => {
      const r = await chamarEMostrar(() => marcarNovidadesComoVistas(todos));
      if (r.ok) router.refresh();
    });
  }

  return (
    <section
      className="bg-blue-soft flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-3.5 py-2.5"
      aria-labelledby="novidades-titulo"
    >
      <h2
        id="novidades-titulo"
        className="text-text-primary flex items-center gap-2 text-sm font-semibold"
      >
        <Sparkles aria-hidden className="size-4" />
        Chegou para você
      </h2>

      <ul className="flex flex-wrap items-center gap-2">
        {novidades.map(({ area, ids }) => {
          const { rotulo, href, Icone } = AREAS[area];
          return (
            <li key={area}>
              {/* O NOME DA ÁREA É O LINK, e o número vai dentro dele: são a
                  mesma coisa dita duas vezes, e separá-los daria um número
                  que não leva a lugar nenhum ao lado de um link que não diz
                  quanto. */}
              <Link
                href={href}
                className="bg-surface-card text-text-primary hover:bg-surface-page flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm transition-colors"
              >
                <Icone aria-hidden className="text-text-secondary size-3.5" />
                {rotulo}
                <span className="text-accent-strong font-semibold tabular-nums">
                  {ids.length}
                </span>
                <span className="sr-only">
                  {ids.length === 1 ? "novidade" : "novidades"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Button
        variant="ghost"
        size="sm"
        className="ms-auto"
        onClick={verTudo}
        disabled={marcando}
      >
        Marcar como vistas
      </Button>
    </section>
  );
}
