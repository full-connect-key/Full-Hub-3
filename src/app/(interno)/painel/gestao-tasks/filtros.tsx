"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { format, parseISO } from "date-fns";
import { CalendarRange } from "lucide-react";

import { FilterBar, SEM_FILTRO } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRIORIDADES, ROTULOS_DE_PRIORIDADE, ROTULOS_DE_STATUS, STATUS_DE_TASK } from "@/lib/dominio/tasks";
import { cn } from "@/lib/utils";

export type Visao = "board" | "lista" | "calendario";

export type Filtros = {
  cliente: string;
  responsavel: string;
  prioridade: string;
  status: string;
  de: string;
  ate: string;
  atrasadas: boolean;
  visao: Visao;
};

export function lerFiltros(params: URLSearchParams): Filtros {
  const visao = params.get("visao");
  return {
    cliente: params.get("cliente") ?? SEM_FILTRO,
    responsavel: params.get("responsavel") ?? SEM_FILTRO,
    prioridade: params.get("prioridade") ?? SEM_FILTRO,
    status: params.get("status") ?? SEM_FILTRO,
    de: params.get("de") ?? "",
    ate: params.get("ate") ?? "",
    atrasadas: params.get("atrasadas") === "1",
    visao: visao === "lista" || visao === "calendario" ? visao : "board",
  };
}

/**
 * Filtros e visualização vivem na URL, não em estado do componente.
 *
 * Assim o link é compartilhável — "olha as urgentes atrasadas do Cliente Alfa"
 * vira um endereço que a pessoa cola no chat — e trocar de visualização
 * preserva o que já estava filtrado.
 */
export function useFiltros() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filtros = lerFiltros(new URLSearchParams(params.toString()));

  const definir = useCallback(
    (campos: Partial<Record<keyof Filtros, string | boolean>>) => {
      const proximos = new URLSearchParams(params.toString());

      for (const [chave, valor] of Object.entries(campos)) {
        const vazio =
          valor === SEM_FILTRO || valor === "" || valor === false || valor === undefined;
        if (vazio) proximos.delete(chave);
        else proximos.set(chave, valor === true ? "1" : String(valor));
      }

      // replace, e não push: filtrar não é navegar. Senão o botão voltar do
      // navegador desfaz filtro por filtro em vez de sair da tela.
      router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const limpar = useCallback(() => {
    const proximos = new URLSearchParams();
    if (filtros.visao !== "board") proximos.set("visao", filtros.visao);
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }, [filtros.visao, pathname, router]);

  return { filtros, definir, limpar };
}

/** "12/03 → 20/03", ou "de 12/03", ou "até 20/03". Nunca as duas datas por extenso. */
function rotuloDoPrazo(de: string, ate: string) {
  const curta = (iso: string) => format(parseISO(iso), "dd/MM");
  if (de && ate) return `${curta(de)} → ${curta(ate)}`;
  if (de) return `de ${curta(de)}`;
  if (ate) return `até ${curta(ate)}`;
  return "Prazo";
}

/**
 * O PAR DE DATAS VIROU UM CHIP, e é a mesma decisão dos contadores nesta tela.
 *
 * Eram dois rótulos e dois `<input type="date">` de 144px cada, o que dava uma
 * segunda linha de filtros — 320 pixels de largura e uma faixa inteira da
 * primeira dobra — para um recorte que quase ninguém usa, acima da peça que
 * todo mundo veio ver. Agora a linha inteira cabe numa só, ao lado dos quatro
 * selects e da pílula de atrasadas.
 *
 * **O QUE SE PERDE, e é dito em vez de escondido:** as datas deixam de estar à
 * vista e pedem um clique. O que impede isso de virar um filtro invisível é o
 * RÓTULO — com valor, o chip para de dizer "Prazo" e passa a dizer
 * "12/03 → 20/03", aceso. É a regra da faixa de áreas de Minhas Tasks: quem
 * recolhe continua dizendo o que tem dentro, senão não é recolher, é esconder.
 *
 * **E ele é local, não uma prop nova da `FilterBar`.** Aquela barra é de sete
 * telas, e um par de datas embutido nela seria um campo que seis não usam —
 * a razão pela qual o "Prazo" entra por `children`, que é a porta que ela já
 * tem. As duas datas continuam em `?de=` e `?ate=`, como todo filtro deste
 * produto: o link continua sendo o que ele era.
 */
function ChipDePrazo({
  de,
  ate,
  aoDefinir,
}: {
  de: string;
  ate: string;
  aoDefinir: (campos: Partial<Record<keyof Filtros, string | boolean>>) => void;
}) {
  const ativo = Boolean(de || ate);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filtrar por prazo"
          className={cn(
            "focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
            ativo
              ? "border-blue-muted bg-accent text-accent-strong"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <CalendarRange aria-hidden className="size-3.5 shrink-0" />
          <span className="tabular-nums">{rotuloDoPrazo(de, ate)}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="prazo-de" className="text-muted-foreground text-xs">
            De
          </Label>
          <Input
            id="prazo-de"
            type="date"
            className="h-8"
            value={de}
            onChange={(e) => aoDefinir({ de: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prazo-ate" className="text-muted-foreground text-xs">
            Até
          </Label>
          <Input
            id="prazo-ate"
            type="date"
            className="h-8"
            value={ate}
            onChange={(e) => aoDefinir({ ate: e.target.value })}
          />
        </div>

        {/* Limpar SÓ o prazo, e não a barra inteira: "Limpar filtros" da
            `FilterBar` derruba os quatro selects junto, e quem abriu este
            popover veio mexer numa coisa só. */}
        {ativo ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => aoDefinir({ de: "", ate: "" })}
          >
            Limpar o prazo
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function BarraDeFiltrosDeTask({
  clientes,
  equipe,
}: {
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
}) {
  const { filtros, definir, limpar } = useFiltros();

  return (
    <FilterBar
      selects={[
        {
          id: "cliente",
          label: "Cliente",
          value: filtros.cliente,
          allLabel: "Todos os clientes",
          onChange: (v) => definir({ cliente: v }),
          options: clientes.map((c) => ({ value: c.id, label: c.nome_empresa })),
        },
        {
          id: "responsavel",
          label: "Responsável",
          value: filtros.responsavel,
          allLabel: "Todos os responsáveis",
          onChange: (v) => definir({ responsavel: v }),
          options: equipe.map((p) => ({ value: p.id, label: p.nome })),
        },
        {
          id: "prioridade",
          label: "Prioridade",
          value: filtros.prioridade,
          allLabel: "Todas as prioridades",
          onChange: (v) => definir({ prioridade: v }),
          options: PRIORIDADES.map((p) => ({ value: p, label: ROTULOS_DE_PRIORIDADE[p] })),
        },
        {
          id: "status",
          label: "Status",
          value: filtros.status,
          allLabel: "Todos os status",
          onChange: (v) => definir({ status: v }),
          options: STATUS_DE_TASK.map((s) => ({ value: s, label: ROTULOS_DE_STATUS[s] })),
        },
      ]}
      chips={[
        {
          id: "atrasadas",
          label: "Só atrasadas",
          active: filtros.atrasadas,
          onToggle: () => definir({ atrasadas: !filtros.atrasadas }),
        },
      ]}
      onClear={limpar}
    >
      <ChipDePrazo de={filtros.de} ate={filtros.ate} aoDefinir={definir} />
    </FilterBar>
  );
}
