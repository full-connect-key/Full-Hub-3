"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  LEGENDA_DO_CALENDARIO,
  ROTULO_DO_ITEM_DE_CALENDARIO,
  ROTULOS_DE_PRIORIDADE,
  TINTA_DA_SITUACAO,
  situacaoDoPrazo,
} from "@/lib/dominio/tasks";
import type { ItemDeCalendario } from "@/lib/dados/tasks";
import { cn } from "@/lib/utils";

const SEM_FILTRO = "__todos__";
const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/**
 * Calendário de prazos.
 *
 * A pergunta que ele tem de responder de relance é "o que entrega em que dia",
 * e cada chip responde com três coisas: a COR da situação do prazo (e não da
 * prioridade — o que aperta é a data), o nome da etapa com a linhagem embaixo,
 * e o rosto de quem está com ela.
 *
 * ---------------------------------------------------------------------------
 * **O QUE MUDOU, e as quatro partes são decisão do usuário.**
 *
 * **1. A linha da Demanda saiu**, e com ela a palavra "Etapa" — *"não
 * considere no calendário a data final da task, apenas o prazo final da
 * última subtarefa"* e *"tirar as palavras Etapa"*. As duas metades são a
 * mesma decisão: `tasks.data_fim` é `max(prazo das folhas)` desde a 0028, a
 * linha da Demanda caía no mesmo dia que a última etapa, e o rótulo era a
 * única coisa que dizia qual das duas era qual. Sem ela, a etapa é a entidade
 * desta tela, e nomear a entidade da tela em cada linha gasta a largura do
 * título. O porquê inteiro está em `ROTULO_DO_ITEM_DE_CALENDARIO`.
 *
 * **2. A LINHAGEM entrou no lugar** — *"que apareça o nome da task mãe, junto
 * com o nome da Subtarefa"*. `Cliente · Demanda` embaixo do nome da etapa, que
 * é a forma de Minhas Tasks desde o Sprint 10: ela responde *"de que demanda
 * é este Layout?"*, que é a pergunta de quem tem três campanhas correndo e a
 * que o rótulo nunca respondeu.
 *
 * **3. A COR É O CHIP, e não mais um fio de quatro pixels** — *"mude as cores
 * das legendas do calendário, deixe ele visualmente mais colorido"*, com as
 * três que ele nomeou: concluído verde, em produção azul, vencido vermelho.
 * Par nomeado, nunca opacidade; os quatro pares e o porquê da fusão de "esta
 * semana" com "em produção" estão em `TINTA_DA_SITUACAO`.
 *
 * **4. O ROSTO DE QUEM É DONO DA ETAPA** — *"coloque o rosto da pessoa
 * responsável na visualização da task, dentro de gestão de task, visualização
 * de calendário"*. Ele não custa consulta nenhuma: `itensDoCalendario` já traz
 * `profiles(id, nome, avatar_url)` de cada responsável desde o Sprint 4 — era
 * o que alimentava o filtro "pauta de" deste cabeçalho. **A ponte estava
 * construída e ninguém a atravessava**, e quem a atravessa é a linha, que é
 * onde a pergunta é feita: *a arte vence quinta, quem está com ela?*
 *
 * **Ele é `tooltip={false}`, e isso é mecânico:** o chip inteiro é um
 * `<button>`, e o `TooltipTrigger` do Radix dentro dele seria
 * `nested-interactive` — crítico no axe, e duas paradas de Tab para a mesma
 * coisa. O nome viaja no `title` e no `aria-label` do chip, junto com o resto.
 *
 * **Etapa sem dono não ganha círculo genérico**, que é a regra da pilha de
 * avatares: um círculo ali afirmaria que existe alguém. Post, campanha e
 * entregável também não têm — o post não tem a coluna, e a peça de campanha é
 * uma subtarefa desde a 0051, então ela já aparece pelo ramo da etapa, com o
 * rosto certo.
 * ---------------------------------------------------------------------------
 */
export function CalendarioDeTasks({
  itens,
  equipe,
  prazos,
  aoAbrir,
}: {
  itens: ItemDeCalendario[];
  equipe: { id: string; nome: string }[];
  /** Régua de datas calculada no servidor, para não classificar por fuso. */
  prazos: { hoje: string; fimDaSemana: string };
  /** Quando existe, o item abre isto em vez de navegar para a página. */
  aoAbrir?: (taskId: string) => void;
}) {
  const router = useRouter();
  const [referencia, setReferencia] = useState(new Date());
  const [modo, setModo] = useState<"mes" | "semana">("mes");
  const [responsavel, setResponsavel] = useState(SEM_FILTRO);

  const visiveis = useMemo(
    () =>
      responsavel === SEM_FILTRO
        ? itens
        : itens.filter((item) => item.responsavel?.id === responsavel),
    [itens, responsavel],
  );

  const dias = useMemo(() => {
    if (modo === "semana") {
      const inicio = startOfWeek(referencia, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: inicio, end: addDays(inicio, 6) });
    }
    // A grade do mês começa na segunda da primeira semana e termina no domingo
    // da última, para as colunas ficarem alinhadas.
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(referencia), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(referencia), { weekStartsOn: 1 }),
    });
  }, [modo, referencia]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, ItemDeCalendario[]>();
    for (const item of visiveis) {
      mapa.set(item.prazo, [...(mapa.get(item.prazo) ?? []), item]);
    }
    return mapa;
  }, [visiveis]);

  function navegar(passo: number) {
    setReferencia((atual) =>
      modo === "semana" ? addWeeks(atual, passo) : addMonths(atual, passo),
    );
  }

  const titulo =
    modo === "semana"
      ? `${format(startOfWeek(referencia, { weekStartsOn: 1 }), "d 'de' MMM", { locale: ptBR })} – ${format(endOfWeek(referencia, { weekStartsOn: 1 }), "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
      : format(referencia, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navegar(-1)}
            aria-label="Anterior"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navegar(1)}
            aria-label="Próximo"
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReferencia(new Date())}
          >
            Hoje
          </Button>
        </div>

        {/* first-letter, e não capitalize: este maiúsculiza cada palavra e
            produziria "Setembro De 2026". */}
        <h2 className="text-sm font-medium first-letter:uppercase">{titulo}</h2>

        <div className="ml-auto flex items-center gap-2">
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger aria-label="Responsável" size="sm" className="w-48">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_FILTRO}>Pauta de toda a equipe</SelectItem>
              {equipe.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Pauta de {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={modo}
            onValueChange={(v) => setModo(v as "mes" | "semana")}
          >
            <SelectTrigger aria-label="Visualização" size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mês</SelectItem>
              <SelectItem value="semana">Semana</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="bg-muted/40 text-muted-foreground grid grid-cols-7 border-b text-xs">
          {DIAS_DA_SEMANA.map((dia) => (
            <div key={dia} className="px-2 py-1.5 text-center font-medium">
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const chave = format(dia, "yyyy-MM-dd");
            const doDia = porDia.get(chave) ?? [];
            const foraDoMes = modo === "mes" && !isSameMonth(dia, referencia);

            return (
              <div
                key={chave}
                className={cn(
                  "min-h-32 border-r border-b p-1.5 last:border-r-0",
                  modo === "semana" && "min-h-64",
                  foraDoMes && "bg-muted/30",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                      // `text-muted-foreground` inteiro, sem o `/60`: a 60%
                      // sobre `bg-muted/30` o número do dia dava 2,68:1. O dia
                      // de outro mês já se distingue pelo fundo da célula.
                      foraDoMes && "text-muted-foreground",
                      isToday(dia) &&
                        "bg-brand text-brand-foreground font-medium",
                    )}
                  >
                    {format(dia, "d")}
                  </span>
                </div>

                <ul className="space-y-1">
                  {doDia.map((item) => {
                    const situacao = situacaoDoPrazo(
                      item.prazo,
                      item.concluida,
                      prazos.hoje,
                      prazos.fimDaSemana,
                    );
                    const tinta = TINTA_DA_SITUACAO[situacao];
                    // O rótulo é de MÓDULO, e a etapa não tem nenhum: ela é a
                    // entidade desta tela. O mapa é um `Record` sobre a união
                    // justamente para um tipo novo não cair calado no último
                    // ramo de um `? :` — foi assim que "entregável" quase
                    // virou "Etapa".
                    const rotulo = ROTULO_DO_ITEM_DE_CALENDARIO[item.tipo];
                    // A LINHAGEM É UMA LINHA PARA CADA, e não um `Cliente ·
                    // Demanda` só: decisão do usuário, a proposta C. Juntas
                    // numa linha de 158px, a primeira que trunca é a demanda
                    // — e é ela que diz de que trabalho a etapa é.
                    const descricao = [
                      item.cliente,
                      item.demanda,
                      rotulo ? `${rotulo}: ${item.titulo}` : item.titulo,
                      item.responsavel ? `com ${item.responsavel.nome}` : null,
                      `prioridade ${ROTULOS_DE_PRIORIDADE[item.prioridade].toLowerCase()}`,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <li key={item.chave}>
                        <button
                          type="button"
                          onClick={() =>
                            // Post, campanha e entregável têm destino
                            // próprio e não abrem o painel lateral de demanda:
                            // não são uma, e o painel mostraria campos que
                            // eles não têm.
                            item.href
                              ? router.push(item.href)
                              : aoAbrir
                                ? aoAbrir(item.taskId)
                                : router.push(
                                    `/painel/gestao-tasks/${item.taskId}`,
                                  )
                          }
                          title={descricao}
                          aria-label={descricao}
                          className={cn(
                            "relative w-full overflow-hidden rounded border border-transparent py-1 pr-1.5 pl-2.5 text-left text-xs transition-opacity hover:opacity-85",
                            // A COR É O CHIP. Era um cartão branco com um fio
                            // de quatro pixels, e quatro fios numa célula não
                            // se leem à distância de que a grade do mês é
                            // olhada.
                            tinta.chip,
                            // Pontilhado para o que não é etapa de demanda:
                            // post, campanha e entregável vivem em outro
                            // módulo, e o traço diz isso sem ocupar espaço.
                            rotulo && "border-border border-dotted",
                          )}
                        >
                          {/* A barra é a cor cheia, e ela fica: sobre o chip
                              tingido ela é a borda de leitura que separa uma
                              linha da de baixo quando as duas são do mesmo
                              tom. */}
                          <span
                            aria-hidden
                            className={cn(
                              "absolute inset-y-0 left-0 w-1",
                              tinta.barra,
                            )}
                          />

                          {/* TRÊS LINHAS: cliente, demanda, etapa.
                              Decisão do usuário, a proposta C — e a ordem é a
                              do print dele: o que dá o contexto em cima, o
                              trabalho embaixo e em destaque.

                              O peso faz o trabalho que a cor faria: medium,
                              normal e semibold, três tamanhos, uma família de
                              tom só. Dar uma cor própria ao cliente exigiria
                              medi-la contra os quatro fundos tingidos do
                              chip, e o que ela acrescentaria é o que o
                              tamanho já diz. */}
                          {item.cliente ? (
                            <span className="text-text-secondary block truncate text-[10px] font-medium">
                              {item.cliente}
                            </span>
                          ) : null}

                          {item.demanda ? (
                            <span className="text-text-muted block truncate text-[10px] leading-tight">
                              {item.demanda}
                            </span>
                          ) : null}

                          <span className="mt-0.5 flex items-center gap-1">
                            {rotulo ? (
                              <span
                                className={cn(
                                  "shrink-0 text-[10px] font-medium uppercase",
                                  tinta.rotulo,
                                )}
                              >
                                {rotulo}
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "text-text-primary min-w-0 flex-1 truncate text-[13px] leading-tight font-semibold",
                                item.concluida && "line-through",
                              )}
                            >
                              {item.titulo}
                            </span>
                            {/* Sem tooltip: o chip é um botão, e um gatilho
                                interativo dentro dele é nested-interactive. */}
                            {item.responsavel ? (
                              <UserAvatar
                                name={item.responsavel.nome}
                                src={item.responsavel.avatar_url}
                                size="xs"
                                tooltip={false}
                                className="ring-background shrink-0 ring-1"
                              />
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* A LEGENDA TEM QUATRO ENTRADAS, e não seis nem uma nota de pé de
          página. A amostra é o chip de verdade — fundo tingido mais a barra —
          porque uma legenda que mostra outra coisa que a tela é uma legenda
          que ensina errado. A lista e a ordem moram em
          `LEGENDA_DO_CALENDARIO`: duas cópias divergiriam na primeira vez que
          alguém mexesse numa, e a tela discordaria da própria legenda. */}
      <div className="text-text-secondary flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2 text-xs">
        <span className="text-text-primary font-medium">Legenda</span>
        {LEGENDA_DO_CALENDARIO.map(({ situacao, rotulo }) => {
          const tinta = TINTA_DA_SITUACAO[situacao];
          return (
            <span key={situacao} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "relative h-4 w-6 overflow-hidden rounded",
                  tinta.chip,
                )}
              >
                <span
                  className={cn("absolute inset-y-0 left-0 w-1", tinta.barra)}
                />
              </span>
              {rotulo}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="border-border size-2.5 rounded border border-dotted"
          />
          Post, campanha e entregável — abrem em outro módulo
        </span>
      </div>
    </div>
  );
}
