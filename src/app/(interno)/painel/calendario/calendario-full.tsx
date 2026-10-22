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


import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  COR_DO_TIPO_DE_EVENTO,
  ROTULOS_DE_VISAO,
  VISOES,
  montarIcs,
  rotuloDoEvento,
  type ItemDoCalendario,
  type VisaoDoCalendario,
  type EventoDetalhado,
  type PessoaDoCalendario,
} from "@/lib/dominio/calendario";

import { cn } from "@/lib/utils";

import { DetalheDoEvento } from "./detalhe-do-evento";
import { FormularioDeEvento } from "./formulario-de-evento";
import { somarMeses, type Janela } from "./periodo";
import { VisaoDeMes } from "./visao-mes";
import { VisaoDeSemana } from "./visao-semana";

/**
 * A LEGENDA, e ela AGRUPA quem divide a cor.
 *
 * São oito tipos de evento em cinco pares — a decisão está em
 * `COR_DO_TIPO_DE_EVENTO` —, e cinco entradas com oito nomes é o que a
 * legenda do portal já faz com os sete status em cinco tons. Oito linhas e
 * cinco cores seria pior que cinco: a pessoa procura a diferença entre duas
 * amostras iguais, não acha, e passa a desconfiar do resto.
 *
 * **"Eventos Fullers" ABRE A LISTA e carrega o azul** (0109, decisão do
 * usuário). Ele é o único par de um tipo só, e por isso é também o único cujo
 * rótulo na legenda é o mesmo do seletor: não há o que agrupar.
 *
 * **ELA É LEGENDA E NÃO FILTRO, e isso é a 0105.** Até aqui a fileira era as
 * duas coisas na mesma peça — "a legenda e o interruptor são a mesma coisa, e
 * separá-los daria uma legenda que pode discordar do que está desenhado" —, e
 * o que a mantém honesta hoje é a cor sair do MESMO mapa que desenha o chip.
 * Um filtro por tipo de evento é outra decisão, e ninguém a pediu.
 */
const LEGENDA: { cor: string; rotulo: string }[] = [
  { cor: COR_DO_TIPO_DE_EVENTO.evento_fullers, rotulo: "Eventos Fullers" },
  { cor: COR_DO_TIPO_DE_EVENTO.convencao, rotulo: "Convenção e feira" },
  { cor: COR_DO_TIPO_DE_EVENTO.lancamento, rotulo: "Lançamento" },
  { cor: COR_DO_TIPO_DE_EVENTO.feriado_cliente, rotulo: "Feriado do cliente" },
  { cor: COR_DO_TIPO_DE_EVENTO.reuniao, rotulo: "Reunião, treinamento e outro" },
];

/**
 * O casco do Calendário Full: navegação, camadas, filtros e a visão escolhida.
 *
 * ---------------------------------------------------------------------------
 * SÃO DUAS VISÕES, e eram quatro — a decisão e o que ela custou estão em
 * `lib/dominio/calendario.ts`, ao lado da união que as define. Aqui sobra a
 * consequência: um `? :` de dois ramos em vez de quatro, e o `.ics` do
 * cabeçalho passando a ser o único jeito de levar o mês embora.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * AS CAMADAS NÃO EXISTEM MAIS, e com elas saíram dois filtros (0105).
 *
 * Elas eram seis links na URL — nunca caixas no `localStorage`, pela razão de
 * todo filtro do produto. Com uma origem só não há o que desligar, e os dois
 * filtros que perguntavam por `user_id` passariam a mentir: "Filtrar por
 * responsável" devolveria zero sempre, e "Só minha pauta" deixaria passar
 * tudo. Um filtro que só sabe esvaziar a tela e um botão que não muda nada são
 * o interruptor que a 0088 deixou para trás, em outra forma.
 *
 * O filtro de CLIENTE fica, e é o único que continua respondendo: a feira e o
 * feriado de uma conta têm empresa, a convenção da casa não tem.
 * ---------------------------------------------------------------------------
 */
export function CalendarioFull({
  visao,
  mes,
  janela,
  itens,
  clientes,
  pessoas,
  evento,
  usuarioId,
  podeEscrever,
}: {
  visao: VisaoDoCalendario;
  mes: string;
  janela: Janela;
  itens: ItemDoCalendario[];
  clientes: { id: string; nome: string }[];
  /** Os participantes do formulário e do detalhe. Não é filtro desde a 0105. */
  pessoas: PessoaDoCalendario[];
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

  const titulo = useMemo(
    () => format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR }),
    [mes],
  );


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

      {/* A LEGENDA DOS TIPOS DE EVENTO. A amostra é a MESMA classe do chip
          de verdade, pelo mapa compartilhado: uma legenda que mostra outra
          coisa que a tela é uma legenda que ensina errado.

          ELA QUEBRA DE LINHA, e não rola para o lado: a fileira das camadas
          rolava porque eram seis BOTÕES, e um botão dá acesso de teclado à
          região que rola. Esta é estática — não há o que clicar —, e o axe
          reprovou a primeira versão em 375px por `scrollable-region-focusable`:
          uma região rolável sem nada focável dentro é uma região que o teclado
          não alcança. A saída não é um `tabIndex` numa lista que não decide
          nada (uma parada de Tab que não faz coisa alguma); é não rolar. Com
          quatro entradas, duas linhas no celular é o resultado certo. */}
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {LEGENDA.map((entrada) => (
          <li
            key={entrada.rotulo}
            className="text-text-secondary flex shrink-0 items-center gap-1.5"
          >
            <span aria-hidden className={cn("size-2.5 rounded-full", entrada.cor)} />
            {entrada.rotulo}
          </li>
        ))}
      </ul>

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

      </div>

      {/* A VISÃO */}
      {itens.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nada neste período"
          description={
            clienteFiltrado
              ? "Nenhum evento desta conta neste período."
              : "Nenhum evento marcado."
          }
        />
      ) : visao === "mes" ? (
        <VisaoDeMes
          mes={mes}
          itens={itens}
          aoAbrir={setEmFoco}
          aoSelecionar={podeEscrever ? setAbrindo : undefined}
        />
      ) : (
        <VisaoDeSemana janela={janela} itens={itens} aoAbrir={setEmFoco} />
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
                  {rotuloDoEvento(emFoco)}
                  {emFoco.cliente ? ` · ${emFoco.cliente}` : ""}
                </p>
                <p className="text-sm">
                  {emFoco.dataInicio === emFoco.dataFim
                    ? format(parseISO(emFoco.dataInicio), "dd 'de' MMMM", {
                        locale: ptBR,
                      })
                    : `${format(parseISO(emFoco.dataInicio), "dd/MM")} a ${format(parseISO(emFoco.dataFim), "dd/MM")}`}
                </p>
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
          pessoas={pessoas}
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
