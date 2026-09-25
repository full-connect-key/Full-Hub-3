"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Clock } from "lucide-react";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { EmptyState } from "@/components/shared/empty-state";
import {
  FILTROS_DE_TRILHA,
  ROTULOS_DE_FILTRO,
  ROTULOS_DE_SITUACAO,
  combinaComFiltro,
} from "@/lib/dominio/academy";
import type { FiltroDeTrilha } from "@/lib/dominio/academy";
import type { TrilhaDaGrade } from "@/lib/dados/academy";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { cn } from "@/lib/utils";

/**
 * A grade de trilhas.
 *
 * O FILTRO MORA NA URL, como em toda listagem do produto: o link precisa ser
 * compartilhável ("olha as obrigatórias que faltam") e sobreviver ao voltar do
 * navegador.
 *
 * A vitrine que esta tela teve no topo saiu na 0043 — o comentário dentro do
 * componente diz por quê, e não repete o nome dela.
 */
export function GradeDeTrilhas({
  trilhas,
  areas,
}: {
  trilhas: TrilhaDaGrade[];
  areas: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const filtro = (parametros.get("filtro") ?? "todas") as FiltroDeTrilha;
  const area = parametros.get("area");

  function navegar(chave: string, valor: string | null) {
    const destino = new URLSearchParams(parametros.toString());
    if (valor) destino.set(chave, valor);
    else destino.delete(chave);
    router.replace(`${pathname}?${destino.toString()}`, { scroll: false });
  }

  const visiveis = trilhas.filter(
    (t) =>
      combinaComFiltro(filtro, t.obrigatoria, t.situacao) &&
      (!area || t.area === area),
  );

  /*
   * A GRADE NÃO TEM MAIS VITRINE DE SUGESTÃO (migration 0043): o sinal que a
   * alimentava saiu do produto com o módulo que o coletava, e sem origem não
   * há o que sugerir — inventar uma preferência que a pessoa nunca declarou
   * gastaria a credibilidade da seção inteira. O porquê está no cabeçalho da
   * 0043 e no CLAUDE.md; aqui não, porque a varredura de nomes mortos
   * acusaria o próprio texto que explica.
   */

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS_DE_TRILHA.map((chave) => (
          <button
            key={chave}
            type="button"
            onClick={() => navegar("filtro", chave === "todas" ? null : chave)}
            aria-pressed={filtro === chave}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              filtro === chave
                ? "border-accent-strong bg-blue-soft text-accent-strong font-medium"
                : "text-text-secondary hover:bg-muted",
            )}
          >
            {ROTULOS_DE_FILTRO[chave]}
          </button>
        ))}

        {areas.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-text-muted text-xs">Área:</span>
            <button
              type="button"
              onClick={() => navegar("area", null)}
              aria-pressed={!area}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                !area
                  ? "border-accent-strong bg-blue-soft text-accent-strong font-medium"
                  : "text-text-secondary hover:bg-muted",
              )}
            >
              Todas
            </button>
            {areas.map((nome) => (
              <button
                key={nome}
                type="button"
                onClick={() => navegar("area", nome)}
                aria-pressed={area === nome}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  area === nome
                    ? "border-accent-strong bg-blue-soft text-accent-strong font-medium"
                    : "text-text-secondary hover:bg-muted",
                )}
              >
                {nome}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {visiveis.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhuma trilha aqui"
          description={
            filtro === "todas" && !area
              ? "Quando a gestão publicar uma trilha, ela aparece nesta grade."
              : "Nenhuma trilha combina com esse filtro. Experimente “Todas”."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((trilha) => (
            <CartaoDaTrilha key={trilha.id} trilha={trilha} />
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoDaTrilha({ trilha }: { trilha: TrilhaDaGrade }) {
  const concluida = trilha.situacao === "concluida";

  return (
    <Link
      href={`/painel/academy/${trilha.id}`}
      className={cn(
        "rounded-card bg-surface-card flex flex-col gap-3 border p-4 transition-shadow hover:shadow-sm",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-text-primary text-sm leading-snug font-semibold">
            {trilha.titulo}
          </h3>
          {trilha.area ? (
            <p className="text-text-muted text-xs">{trilha.area}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {/* Par nomeado, nunca opacidade: `bg-warning/10` sobre um fundo
              qualquer dá uma cor que ninguém mediu, e no tema escuro dá
              outra. */}
          {trilha.obrigatoria ? (
            <span className="bg-warning-soft text-warning rounded-full px-2 py-0.5 text-[11px] font-medium">
              Obrigatória
            </span>
          ) : null}
          {!trilha.publicada ? (
            <span className="bg-neutral-soft text-neutral rounded-full px-2 py-0.5 text-[11px] font-medium">
              Rascunho
            </span>
          ) : null}
        </div>
      </div>

      {trilha.descricao ? (
        <p className="text-text-secondary line-clamp-2 text-xs leading-relaxed">
          {trilha.descricao}
        </p>
      ) : null}

      <div className="text-text-muted mt-auto flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1">
          <BookOpen aria-hidden className="size-3.5" />
          {trilha.quantosMateriais}{" "}
          {trilha.quantosMateriais === 1 ? "material" : "materiais"}
        </span>
        {/* Trilha sem duração informada omite a linha em vez de mostrar
            "0min": zero é uma afirmação sobre o tempo, e o que se quer dizer é
            que ninguém informou. */}
        {trilha.duracaoMinutos !== null ? (
          <span className="flex items-center gap-1">
            <Clock aria-hidden className="size-3.5" />
            {formatarMinutos(trilha.duracaoMinutos)}
          </span>
        ) : null}
        <span className="ml-auto">{ROTULOS_DE_SITUACAO[trilha.situacao]}</span>
      </div>

      <BarraDeProgresso
        valor={trilha.quantosConcluidos}
        total={trilha.quantosMateriais}
        tom={concluida ? "sucesso" : "marca"}
        rotulo={`${trilha.quantosConcluidos} de ${trilha.quantosMateriais} concluídos`}
      />
    </Link>
  );
}
