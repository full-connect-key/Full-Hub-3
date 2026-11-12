"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * o que alimentava o filtro "pauta de" que vivia neste cabeçalho e que saiu
 * depois (o porquê está no lugar dele, mais abaixo). **A ponte estava
 * construída e ninguém a atravessava**, e quem a atravessa é a linha, que é
 * onde a pergunta é feita: *a arte vence quinta, quem está com ela?*
 *
 * **Ele é `tooltip={false}`, e isso é mecânico:** o chip inteiro é um
 * `<button>`, e o `TooltipTrigger` do Radix dentro dele seria
 * `nested-interactive` — crítico no axe, e duas paradas de Tab para a mesma
 * coisa. O nome viaja no `title` e no `aria-label` do chip, junto com o resto.
 *
 * **Etapa sem dono não ganha círculo genérico**, que é a regra da pilha de
 * avatares: um círculo ali afirmaria que existe alguém. A campanha também não
 * tem — o encerramento dela não é trabalho de ninguém, e a peça dela é uma
 * subtarefa desde a 0051, então ela já aparece pelo ramo da etapa, com o rosto
 * certo.
 * ---------------------------------------------------------------------------
 */
export function CalendarioDeTasks({
  itens,
  prazos,
  aoAbrir,
}: {
  itens: ItemDeCalendario[];
  /** Régua de datas calculada no servidor, para não classificar por fuso. */
  prazos: { hoje: string; fimDaSemana: string };
  /** Quando existe, o item abre isto em vez de navegar para a página. */
  aoAbrir?: (taskId: string) => void;
}) {
  const router = useRouter();
  const [referencia, setReferencia] = useState(new Date());
  const [modo, setModo] = useState<"mes" | "semana">("mes");
  // O DIA ABERTO EMBAIXO DA GRADE — decisão do usuário: *"quando tiver muitas
  // tasks no mesmo dia, deixe uma aba a ser aberta para mostrar todas"*.
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

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
    for (const item of itens) {
      mapa.set(item.prazo, [...(mapa.get(item.prazo) ?? []), item]);
    }
    return mapa;
  }, [itens]);

  // QUANTOS CABEM NA CÉLULA É POR VISÃO, porque a altura da célula é por
  // visão: `min-h-32` no mês e `min-h-64` na semana. O chip tem três linhas e
  // uns 54px, então três enchem a célula do mês sem a linha da semana virar
  // uma página — era a queixa, *"muitas tasks no mesmo dia"*. Um número só
  // para as duas ou deixaria a semana cortando o que cabe, ou deixaria o mês
  // crescendo do mesmo jeito.
  const cabemNaCelula = modo === "semana" ? 6 : 3;

  // O DIA ABERTO É DERIVADO, e não sincronizado: se ele não está na grade de
  // agora — porque alguém trocou de mês ou de visão —, o painel não é
  // desenhado. Guardar um `useEffect` para limpá-lo seria uma
  // segunda verdade sobre qual dia está aberto, e é a razão pela qual atraso
  // não é coluna.
  const chavesNaGrade = useMemo(
    () => new Set(dias.map((dia) => format(dia, "yyyy-MM-dd"))),
    [dias],
  );
  const aberto = diaAberto && chavesNaGrade.has(diaAberto) ? diaAberto : null;
  const itensDoDiaAberto = aberto ? (porDia.get(aberto) ?? []) : [];

  // UM LUGAR SÓ DECIDE PARA ONDE O CHIP LEVA, e ele é lido pela célula e pelo
  // painel: duas cópias divergiriam no destino, que é a única coisa que o
  // chip faz.
  function abrir(item: ItemDeCalendario) {
    // A campanha tem destino próprio e não abre o painel lateral de demanda:
    // ela não é uma, e o painel mostraria campos que ela não tem.
    if (item.href) return router.push(item.href);
    if (aoAbrir) return aoAbrir(item.taskId);
    router.push(`/painel/gestao-tasks/${item.taskId}`);
  }

  // O PAINEL ROLA PARA A VISTA, e isto não é enfeite: a grade do mês tem seis
  // semanas e passa de mil pixels, então o painel nasce abaixo da dobra —
  // clicar no "+2" pareceria não fazer nada. `block: "nearest"` e não
  // `"center"`: quando ele já está visível, nada se mexe.
  const painelDoDia = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (aberto) painelDoDia.current?.scrollIntoView({ block: "nearest" });
  }, [aberto]);

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

        {/* ------------------------------------------------------------------
            O SELETOR DE RESPONSÁVEL SAIU DAQUI, e a ausência é a entrega.

            Decisão do usuário: *"a aba de toda a equipe saia — deixando
            apenas o filtro dos responsáveis"*. Ele era um `Select` de quinze
            nomes com "Pauta de toda a equipe" na primeira linha, e o que
            estava errado não era o rótulo: era ele existir.

            **ERAM DOIS FILTROS PARA A MESMA PERGUNTA, e o de cima é o que
            vale.** `BarraDeFiltrosDeTask` tem um seletor de Responsável desde
            o Sprint 3, ele mora em `?responsavel=` — como todo filtro de
            listagem deste produto — e **o servidor já o aplica aos itens
            deste calendário**: `itensDoCalendario` descarta a etapa de outra
            pessoa antes de a lista chegar aqui. Este, ao contrário, era
            `useState` local: ele não sobrevive ao `refresh`, não entra no link
            que alguém cola no chat, e some ao trocar de visão.

            **E OS DOIS PODIAM SE CONTRADIZER.** Com a barra filtrando a Ana e
            este seletor no Bruno, a grade saía vazia — duas respostas para
            *de quem é este trabalho*, uma na URL e uma no componente, com a
            tela afirmando que não há nada no mês.

            **EM MINHAS TASKS ELE ERA PIOR QUE DUPLICATA.** Lá os itens vêm de
            `itensPessoaisDoCalendario`, que traz só as etapas de quem está
            olhando — então catorze dos quinze nomes do seletor só sabiam
            esvaziar a tela, e o décimo quinto não mudava nada. É o
            interruptor de luz da 0105 em outra forma.

            **COM ELE FOI A PROP `equipe`**, que era o único leitor dela aqui —
            e em `minhas-tasks` ela era o único leitor da prop do painel, o que
            fez `listarEquipeAtiva()` deixar de ser consultada naquela tela. Em
            Gestão de Tasks a lista FICA, porque a barra de filtros a usa: é
            ela que desenha o rosto de cada pessoa no seletor que sobrou.
            ------------------------------------------------------------------ */}
        <div className="ml-auto flex items-center gap-2">
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

      {/* O CALENDÁRIO NÃO PINTAVA FUNDO NENHUM, e o que aparecia dentro dele
          era a PÁGINA — decisão do usuário: *"substituir o fundo cinza atual
          do calendário por branco"*. Ele estava certo sobre o que via, e a
          causa não era de token: `--surface-card` já é o branco puro desde a
          interface Leve, e este contêiner tinha `border` e `rounded-xl` e
          mais nada. (O hexadecimal que ele mandou é o valor daquele token, e
          ele NÃO se escreve aqui: a explicação não pode carregar o que ela
          proíbe — é a armadilha que esta casa já pagou sete vezes.) É o achado dos três contêineres de Minhas Tasks pela
          segunda vez, agora na grade do mês — e aqui ele pega a tela inteira,
          porque a grade É a tela.

          SÃO TRÊS TONS E NENHUM VEM DE OPACIDADE. O dia é `--surface-card`, a
          faixa dos nomes da semana é `--muted` e o dia de outro mês é
          `--surface-page` — o mesmo par que o calendário do portal e o
          Cronograma já usam, então os quatro calendários do produto passam a
          dizer a mesma coisa com a mesma cor. O que saiu foi `bg-muted/40` e
          `bg-muted/30`: opacidade sobre um fundo qualquer dá uma cor que
          ninguém mediu, e no tema escuro dá outra — a regra que o produto
          tem escrita para selo de estado desde sempre. */}
      <div className="bg-surface-card overflow-hidden rounded-xl border">
        <div className="bg-muted text-muted-foreground grid grid-cols-7 border-b text-xs">
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
                  foraDoMes && "bg-surface-page",
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
                  {doDia.slice(0, cabemNaCelula).map((item) => (
                    <ChipDoItem
                      key={item.chave}
                      item={item}
                      prazos={prazos}
                      abrir={abrir}
                    />
                  ))}
                </ul>

                {/* O "+N" É BOTÃO E NÃO LINK, ao contrário do Cronograma do
                    portal, e a razão é de onde mora o estado: lá o MÊS está na
                    URL, então `?dia=` aponta para um dia que a grade com
                    certeza mostra; aqui o mês, a visão e o filtro são estado
                    local, e um endereço com o dia abriria num mês que não é o
                    dele. */}
                {doDia.length > cabemNaCelula ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDiaAberto(aberto === chave ? null : chave)
                    }
                    // O RÓTULO ACESSÍVEL DIZ O DIA, e o visível não: quem
                    // lê a tela vê o "+2" dentro da célula de 12 de março e
                    // não precisa que ele se repita; quem OUVE chega no
                    // botão sem o contexto da célula.
                    aria-label={`Ver os ${doDia.length} itens de ${format(dia, "d 'de' MMMM", { locale: ptBR })}`}
                    aria-expanded={aberto === chave}
                    className="text-text-secondary hover:text-text-primary mt-1 w-full rounded px-1 py-0.5 text-left text-[11px] font-medium underline-offset-2 hover:underline"
                  >
                    {aberto === chave
                      ? "fechar"
                      : `+${doDia.length - cabemNaCelula} ${doDia.length - cabemNaCelula === 1 ? "item" : "itens"}`}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* O DIA CHEIO, EMBAIXO DA GRADE e não num diálogo. Um modal por cima do
          calendário esconde justamente a semana de que o dia faz parte — e a
          pergunta de quem clica no "+4" é *o que mais cai neste dia*, que se
          responde olhando os dois. É a forma do Cronograma do portal, que
          resolveu a mesma coisa.

          E ELE DESENHA O DIA INTEIRO, não só os que sobraram: a lista
          truncada obrigaria a juntar de cabeça o que está na célula com o que
          está aqui embaixo. */}
      {aberto && itensDoDiaAberto.length > 0 ? (
        <section
          ref={painelDoDia}
          className="bg-surface-card rounded-card shadow-cartao space-y-2 border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-text-primary text-sm font-semibold">
              {format(new Date(`${aberto}T12:00:00`), "EEEE, d 'de' MMMM", {
                locale: ptBR,
              })}
              <span className="text-text-secondary ml-2 font-normal">
                {itensDoDiaAberto.length === 1
                  ? "1 item"
                  : `${itensDoDiaAberto.length} itens`}
              </span>
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDiaAberto(null)}
            >
              Fechar
            </Button>
          </div>

          {/* DUAS COLUNAS A PARTIR DE `sm`, e não uma lista corrida: o chip é
              estreito por desenho — ele foi feito para uma célula de 158px —,
              e numa faixa de 1100px uma coluna só deixaria dois terços da
              linha vazios. */}
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {itensDoDiaAberto.map((item) => (
              <ChipDoItem
                key={item.chave}
                item={item}
                prazos={prazos}
                abrir={abrir}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {/* A LEGENDA TEM QUATRO ENTRADAS, e não seis nem uma nota de pé de
          página. A amostra é o chip de verdade — fundo tingido mais a barra —
          porque uma legenda que mostra outra coisa que a tela é uma legenda
          que ensina errado. A lista e a ordem moram em
          `LEGENDA_DO_CALENDARIO`: duas cópias divergiriam na primeira vez que
          alguém mexesse numa, e a tela discordaria da própria legenda. */}
      {/* E A LEGENDA ERA O MESMO BURACO, numa caixa própria: `rounded-lg
          border` sem fundo, logo abaixo da grade. Com a grade branca ela
          ficaria sendo a única faixa cinza da tela. Branco e borda, sem
          sombra: ela é informação subordinada, não um cartão a levantar. */}
      <div className="bg-surface-card text-text-secondary flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2 text-xs">
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
          Campanha — abre em outro módulo
        </span>
      </div>
    </div>
  );
}

/**
 * O chip de um item, desenhado na célula do dia E no painel do dia cheio.
 *
 * **Ele virou componente por causa do painel**, e não por tamanho: as duas
 * telas desenham o MESMO chip, e uma segunda cópia divergiria na primeira
 * mudança — a que divergiria é a do painel, que se abre menos. É a história
 * das sete cópias de `abas.tsx` em miniatura.
 */
function ChipDoItem({
  item,
  prazos,
  abrir,
}: {
  item: ItemDeCalendario;
  prazos: { hoje: string; fimDaSemana: string };
  abrir: (item: ItemDeCalendario) => void;
}) {
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
    <li>
      <button
        type="button"
        onClick={() => abrir(item)}
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
          // a campanha vive em outro módulo, e o traço diz
          // isso sem ocupar espaço.
          rotulo && "border-border border-dotted",
        )}
      >
        {/* A barra é a cor cheia, e ela fica: sobre o chip
          tingido ela é a borda de leitura que separa uma
          linha da de baixo quando as duas são do mesmo
          tom. */}
        <span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 w-1", tinta.barra)}
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
}
