"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { chamarAcao } from "@/lib/acoes/cliente";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CAMADAS,
  COR_DA_CAMADA,
  ROTULOS_DE_CAMADA,
  ROTULOS_DE_VISAO,
  VISOES,
  montarIcs,
  type CargaDeUmDia,
  type ItemDoCalendario,
  type VisaoDoCalendario,
  type EventoDetalhado,
  type PessoaDaLinha,
} from "@/lib/dominio/calendario";

import type { TipoNoCalendario } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { moverPrazoDaEtapa } from "./acoes";
import { DetalheDoEvento } from "./detalhe-do-evento";
import { FormularioDeEvento } from "./formulario-de-evento";
import { somarMeses, type Janela } from "./periodo";
import { VisaoDeLinha } from "./visao-linha";
import { VisaoDeLista } from "./visao-lista";
import { VisaoDeMes } from "./visao-mes";
import { VisaoDeSemana } from "./visao-semana";

/**
 * O casco do Calendário Full: navegação, camadas, filtros e a visão escolhida.
 *
 * ---------------------------------------------------------------------------
 * AS CAMADAS SÃO LINKS, e não caixas de seleção com estado.
 *
 * O sprint pede caixas guardadas no `localStorage`. Elas viram links na URL
 * pela mesma razão que todo filtro do produto: "olha a semana do dia 15 sem
 * as ausências" precisa ser um link que abre igual para quem recebe. E com as
 * duas fontes — URL e navegador — a tela abriria com a camada que o link diz
 * e trocaria sozinha um instante depois para a que estava lembrada.
 * ---------------------------------------------------------------------------
 */
export function CalendarioFull({
  visao,
  mes,
  janela,
  itens,
  clientes,
  pessoas,
  carga,
  camadas,
  foco,
  evento,
  usuarioId,
  podeEscrever,
}: {
  visao: VisaoDoCalendario;
  mes: string;
  janela: Janela;
  itens: ItemDoCalendario[];
  clientes: { id: string; nome: string }[];
  pessoas: PessoaDaLinha[];
  carga: CargaDeUmDia[];
  camadas: TipoNoCalendario[];
  foco: "minhas" | "todos";
  evento: EventoDetalhado | null;
  usuarioId: string;
  podeEscrever: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const [emFoco, setEmFoco] = useState<ItemDoCalendario | null>(null);
  const [abrindo, setAbrindo] = useState<{ de: string; ate: string } | null>(
    null,
  );
  const [editando, setEditando] = useState(false);

  function navegar(mudancas: Record<string, string | null>) {
    const busca = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) busca.delete(chave);
      else busca.set(chave, valor);
    }
    router.push(`${pathname}?${busca.toString()}`);
  }

  const clienteFiltrado = parametros.get("cliente");
  const responsavelFiltrado = parametros.get("responsavel");
  const soMinhas = foco === "minhas";
  const todasAsCamadas = camadas.length === CAMADAS.length;

  function alternarCamada(camada: TipoNoCalendario) {
    // Ligadas todas, clicar numa DESLIGA só ela. É o gesto que a pessoa
    // espera: "quero ver tudo menos as ausências" em um clique, e não em seis.
    const proximas = todasAsCamadas
      ? CAMADAS.filter((c) => c !== camada)
      : camadas.includes(camada)
        ? camadas.filter((c) => c !== camada)
        : [...camadas, camada];

    navegar({
      camadas:
        proximas.length === 0 || proximas.length === CAMADAS.length
          ? null
          : proximas.join(","),
    });
  }

  const titulo = useMemo(
    () => format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR }),
    [mes],
  );

  /**
   * Arrastar uma etapa, com DESFAZER.
   *
   * O desfazer não é enfeite: arrastar é o gesto mais fácil de fazer sem
   * querer numa grade cheia, e a pessoa só percebe quando a linha já está no
   * outro dia. O toast guarda a data antiga e chama a mesma ação de volta —
   * um caminho só, que não tem como divergir do de ida.
   */
  function mover(item: ItemDoCalendario, novoDia: string) {
    const antes = item.dataInicio;
    void chamarAcao(() => moverPrazoDaEtapa(item.id, novoDia)).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `"${item.titulo}" agora vence em ${format(parseISO(novoDia), "dd/MM")}.`,
        {
          action: {
            label: "Desfazer",
            onClick: () => {
              void chamarAcao(() => moverPrazoDaEtapa(item.id, antes)).then(
                (volta) => {
                  if (volta.ok) {
                    toast.success("Prazo devolvido.");
                    router.refresh();
                  } else {
                    toast.error(volta.error);
                  }
                },
              );
            },
          },
        },
      );
      router.refresh();
    });
  }

  function exportarIcs() {
    // O ARQUIVO SAI DO QUE ESTÁ NA TELA, e não de uma segunda consulta: o
    // botão diz "os eventos filtrados", e buscar de novo com outros
    // parâmetros entregaria um arquivo diferente do que a pessoa está vendo.
    const texto = montarIcs(itens, new Date().toISOString());
    const url = URL.createObjectURL(
      new Blob([texto], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `full-hub-${mes}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* NAVEGAÇÃO E VISÃO */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mês anterior"
            onClick={() => navegar({ mes: somarMeses(mes, -1) })}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="outline" onClick={() => navegar({ mes: null })}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo mês"
            onClick={() => navegar({ mes: somarMeses(mes, 1) })}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>

        <h2 className="text-text-primary min-w-[10rem] text-lg font-semibold capitalize">
          {titulo}
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {VISOES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => navegar({ visao: v === "mes" ? null : v })}
              aria-pressed={visao === v}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                visao === v
                  ? "border-accent-strong bg-blue-soft text-accent-strong font-medium"
                  : "text-text-secondary hover:bg-muted",
              )}
            >
              {ROTULOS_DE_VISAO[v]}
            </button>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={exportarIcs}
            disabled={itens.length === 0}
          >
            <Download aria-hidden className="size-4" />
            .ics
          </Button>

          {podeEscrever ? (
            <Button
              size="sm"
              onClick={() => {
                setEditando(false);
                setAbrindo({ de: janela.inicio, ate: janela.inicio });
              }}
            >
              <Plus aria-hidden className="size-4" />
              Novo evento
            </Button>
          ) : null}
        </div>
      </div>

      {/* AS CAMADAS. Cada uma carrega a própria cor: a legenda e o
          interruptor são a mesma coisa, e separá-los daria uma legenda que
          pode discordar do que está desenhado. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {CAMADAS.map((camada) => {
          const ligada = camadas.includes(camada);
          return (
            <button
              key={camada}
              type="button"
              onClick={() => alternarCamada(camada)}
              aria-pressed={ligada}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                ligada ? "text-text-primary" : "text-text-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2.5 rounded-full",
                  ligada ? COR_DA_CAMADA[camada] : "bg-muted",
                )}
              />
              {ROTULOS_DE_CAMADA[camada]}
            </button>
          );
        })}
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={clienteFiltrado ?? ""}
          onChange={(e) => navegar({ cliente: e.target.value || null })}
          aria-label="Filtrar por cliente"
          className="border-border bg-surface-card text-text-primary rounded-md border px-2 py-1.5"
        >
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        <select
          value={responsavelFiltrado ?? ""}
          onChange={(e) => navegar({ responsavel: e.target.value || null })}
          aria-label="Filtrar por responsável"
          className="border-border bg-surface-card text-text-primary rounded-md border px-2 py-1.5"
        >
          <option value="">Toda a equipe</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>

        <button
          type="button"
          // GRAVA O VALOR NOS DOIS SENTIDOS, e nunca `null`: com o
          // padrão vindo do perfil, tirar o parâmetro devolveria a escolha
          // para o perfil e o clique não faria nada para o colaborador.
          onClick={() => navegar({ foco: soMinhas ? "todos" : "minhas" })}
          aria-pressed={soMinhas}
          className={cn(
            "rounded-full border px-3 py-1.5 transition-colors",
            soMinhas
              ? "border-accent-strong bg-blue-soft text-accent-strong font-medium"
              : "text-text-secondary hover:bg-muted",
          )}
        >
          Só minha pauta
        </button>
      </div>

      {/* A VISÃO */}
      {itens.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nada neste período"
          description={
            camadas.length < CAMADAS.length ||
            clienteFiltrado ||
            responsavelFiltrado ||
            soMinhas
              ? "Nenhum item combina com os filtros ligados."
              : "Nem entrega, nem ausência, nem evento marcado."
          }
        />
      ) : visao === "mes" ? (
        <VisaoDeMes
          mes={mes}
          itens={itens}
          aoAbrir={setEmFoco}
          aoSelecionar={podeEscrever ? setAbrindo : undefined}
          aoMover={mover}
        />
      ) : visao === "semana" ? (
        <VisaoDeSemana janela={janela} itens={itens} aoAbrir={setEmFoco} />
      ) : visao === "linha" ? (
        <VisaoDeLinha
          janela={janela}
          itens={itens}
          pessoas={pessoas}
          carga={carga}
          aoAbrir={setEmFoco}
        />
      ) : (
        <VisaoDeLista janela={janela} itens={itens} />
      )}

      {/* O DETALHE, em painel lateral: quem está varrendo o mês volta para o
          mesmo ponto, com os mesmos filtros, sem recarregar. É a mesma
          decisão de Minhas Tasks e das Recomendações. */}
      <Sheet open={emFoco !== null} onOpenChange={(v) => !v && setEmFoco(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {emFoco ? (
            <>
              <SheetHeader>
                <SheetTitle>{emFoco.titulo}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <p className="text-text-muted text-xs">
                  {ROTULOS_DE_CAMADA[emFoco.tipo]}
                  {emFoco.cliente ? ` · ${emFoco.cliente}` : ""}
                </p>
                <p className="text-sm">
                  {emFoco.dataInicio === emFoco.dataFim
                    ? format(parseISO(emFoco.dataInicio), "dd 'de' MMMM", {
                        locale: ptBR,
                      })
                    : `${format(parseISO(emFoco.dataInicio), "dd/MM")} a ${format(parseISO(emFoco.dataFim), "dd/MM")}`}
                </p>
                {emFoco.pessoa ? (
                  <p className="text-text-secondary text-sm">
                    {emFoco.pessoa.nome}
                  </p>
                ) : null}
                <Button asChild variant="outline" className="w-full">
                  <a href={emFoco.link}>Abrir</a>
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* O EVENTO ABERTO pela URL — é o que faz `?evento=` do sino levar
          direto ao detalhe. */}
      {evento ? (
        <DetalheDoEvento
          evento={evento}
          podeEscrever={podeEscrever}
          aoFechar={() => navegar({ evento: null })}
          aoEditar={() => {
            setEditando(true);
            setAbrindo({ de: evento.dataInicio, ate: evento.dataFim });
          }}
        />
      ) : null}

      {abrindo ? (
        <FormularioDeEvento
          inicial={editando && evento ? evento : null}
          periodo={abrindo}
          clientes={clientes}
          pessoas={pessoas.map((p) => ({
            id: p.id,
            nome: p.nome,
            avatar_url: p.avatar_url,
          }))}
          usuarioId={usuarioId}
          aoFechar={() => {
            setAbrindo(null);
            setEditando(false);
          }}
        />
      ) : null}
    </div>
  );
}
