"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Clock, Sparkles } from "lucide-react";

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
 * "RECOMENDADAS PARA VOCÊ" VEM ANTES DE TUDO, e é a razão de a Academy e as
 * Skills valerem juntas mais do que separadas: são as trilhas que tocam uma
 * skill que a pessoa marcou como "quero desenvolver" no Sprint 7. Sem essa
 * faixa, a Academy seria um catálogo que ninguém sabe por onde começar.
 *
 * Ela só aparece com o filtro em "Todas": filtrar por "Concluídas" e ainda ver
 * uma vitrine de recomendações no topo seria a tela ignorando o que a pessoa
 * acabou de pedir.
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

  const recomendadas = trilhas.filter((t) => t.recomendada);
  const mostrarVitrine = filtro === "todas" && !area && recomendadas.length > 0;

  return (
    <div className="space-y-6">
      {mostrarVitrine ? (
        <section className="space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles aria-hidden className="text-accent-strong mt-0.5 size-4 shrink-0" />
            <div>
              <h2 className="text-text-primary text-sm font-semibold">
                Recomendadas para você
              </h2>
              <p className="text-text-muted text-xs">
                Trilhas que tocam o que você marcou como “quero desenvolver” em Meu
                Desenvolvimento.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recomendadas.map((trilha) => (
              <CartaoDaTrilha key={trilha.id} trilha={trilha} destacada />
            ))}
          </div>
        </section>
      ) : null}

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

function CartaoDaTrilha({
  trilha,
  destacada = false,
}: {
  trilha: TrilhaDaGrade;
  destacada?: boolean;
}) {
  const concluida = trilha.situacao === "concluida";

  return (
    <Link
      href={`/painel/academy/${trilha.id}`}
      className={cn(
        "rounded-card bg-surface-card flex flex-col gap-3 border p-4 transition-shadow hover:shadow-sm",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        destacada && "border-accent-strong",
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
