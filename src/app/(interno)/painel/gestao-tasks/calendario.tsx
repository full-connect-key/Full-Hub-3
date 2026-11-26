"use client";

import {
  type ComponentPropsWithoutRef,
  type Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
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
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

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
 * O prefixo que `lib/dados/tasks.ts` põe na chave de uma etapa.
 *
 * A chave é `subtarefa-<uuid>` desde o Sprint 4, e é dela que sai o id que a
 * ação de mover recebe. Tirar o prefixo aqui, num lugar só e nomeado, é o que
 * impede a mesma fatia de string de aparecer no meio de um `aoSoltar`.
 */
const PREFIXO_DA_ETAPA = "subtarefa-";

/**
 * O DIA EM QUE A FAIXA COMEÇA na grade — o início quando há, o prazo quando não.
 *
 * O `<=` é defensivo e não decoração: o `check subtasks_periodo` recusa período
 * invertido no banco desde a 0027, e este componente desenha também os dados de
 * exemplo do protótipo e as linhas de Minhas Tasks. Uma data torta vira um chip
 * de UM dia, que é visível, em vez de uma faixa de largura negativa, que não é.
 */
function comecoDoItem(item: ItemDeCalendario) {
  return item.inicio && item.inicio <= item.prazo ? item.inicio : item.prazo;
}

/**
 * A data de uma chave `yyyy-MM-dd`, ao MEIO-DIA e nunca à meia-noite.
 *
 * É a mesma razão do painel do dia logo abaixo: à zero hora qualquer
 * deslocamento de fuso ou de horário de verão troca o DIA, e aqui trocar o dia
 * troca o prazo que a pessoa acabou de arrastar.
 */
function dataDaChave(chave: string) {
  return new Date(`${chave}T12:00:00`);
}

/** Um trecho de faixa dentro de UMA semana da grade. */
type PedacoDaSemana = {
  item: ItemDeCalendario;
  /** 1 a 7, como `gridColumnStart`. */
  col: number;
  /** Exclusivo, como `gridColumnEnd`: 8 é "até o fim da semana". */
  colFim: number;
  /** A faixa começa ANTES desta semana — o canto achatado e sem a barra. */
  continua: boolean;
  /** A faixa termina DEPOIS desta semana. */
  segue: boolean;
  /** A linha da grade onde o pedaço cabe, contada do zero. */
  trilha: number;
};

/**
 * OS PEDAÇOS DE UMA SEMANA, empacotados em trilhas.
 *
 * ---------------------------------------------------------------------------
 * **Uma faixa que atravessa a virada da semana não é um elemento, são dois.**
 * Numa grade de sete colunas um item de grade não dobra de linha, então a
 * campanha de 28/09 a 03/10 é um pedaço que vai de segunda ao domingo com o
 * canto direito achatado, e outro que vai de segunda ao fim com o canto
 * esquerdo achatado — e é o SEGUNDO que perde a barra de cor, porque ela marca
 * o início e o início não está ali.
 *
 * **O empacotamento é guloso e a ordem é determinada**: começo, depois a faixa
 * mais LONGA, depois o prazo, depois a chave. Sem o último critério duas etapas
 * do mesmo dia trocariam de trilha entre dois `render`, e o chip saltaria de
 * linha sem ninguém ter mexido em nada.
 *
 * **A trilha é a primeira LIVRE e não a primeira vazia**: `fimDaTrilha` guarda
 * até que coluna cada uma está ocupada, e uma faixa de quinta a domingo deixa
 * segunda, terça e quarta daquela trilha livres para quem couber lá.
 *
 * **E o `+N` conta por DIA e não por semana.** Um dia pode ter três faixas
 * passando por cima dele e nenhuma delas começar ali — então o que transborda
 * é contado célula por célula, que é o número que a pessoa reconcilia com o
 * que está desenhado.
 *
 * **`trilhas` devolve quantas CABEM**, nunca o teto: com duas faixas no mês, o
 * `+N` num `gridRow` fixo deixaria duas linhas de `gap-y` vazias embaixo de
 * toda semana.
 * ---------------------------------------------------------------------------
 */
function pedacosDaSemana(
  semana: string[],
  itens: ItemDeCalendario[],
  teto: number,
) {
  const primeiro = semana[0];
  const ultimo = semana[semana.length - 1];

  const crus = itens
    .map((item) => {
      const de = comecoDoItem(item);
      if (de > ultimo || item.prazo < primeiro) return null;
      const col = semana.indexOf(de > primeiro ? de : primeiro) + 1;
      const colFim =
        item.prazo < ultimo ? semana.indexOf(item.prazo) + 2 : semana.length + 1;
      return {
        item,
        col,
        colFim,
        continua: de < primeiro,
        segue: item.prazo > ultimo,
      };
    })
    .filter((pedaco): pedaco is NonNullable<typeof pedaco> => pedaco !== null)
    .sort(
      (a, b) =>
        a.col - b.col ||
        (b.colFim - b.col) - (a.colFim - a.col) ||
        a.item.prazo.localeCompare(b.item.prazo) ||
        a.item.chave.localeCompare(b.item.chave),
    );

  const fimDaTrilha: number[] = [];
  const pedacos: PedacoDaSemana[] = [];
  const escondidos = new Map<string, number>();

  for (const cru of crus) {
    let trilha = fimDaTrilha.findIndex((fim) => fim < cru.col);
    if (trilha === -1) {
      trilha = fimDaTrilha.length;
      fimDaTrilha.push(0);
    }
    fimDaTrilha[trilha] = cru.colFim - 1;

    if (trilha < teto) {
      pedacos.push({ ...cru, trilha });
      continue;
    }
    for (let coluna = cru.col; coluna < cru.colFim; coluna += 1) {
      const chave = semana[coluna - 1];
      escondidos.set(chave, (escondidos.get(chave) ?? 0) + 1);
    }
  }

  return { pedacos, escondidos, trilhas: Math.min(fimDaTrilha.length, teto) };
}

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
  aoMover,
}: {
  itens: ItemDeCalendario[];
  /** Régua de datas calculada no servidor, para não classificar por fuso. */
  prazos: { hoje: string; fimDaSemana: string };
  /** Quando existe, o item abre isto em vez de navegar para a página. */
  aoAbrir?: (taskId: string) => void;
  /**
   * ARRASTAR E SOLTAR PARA MUDAR A DATA — decisão do usuário: *"quero poder
   * mexer nas datas apenas clicando e arrastando os cards (…) assim posso
   * reorganizar em escala sem precisar entrar task por task"*.
   *
   * **É PROP E NÃO UMA CHAMADA DIRETA À ACTION, e a razão é uma guarda.**
   * `atualizarSubtarefa` abre com `exigirRotaNaAcao("/painel/gestao-tasks")`,
   * que é `GESTAO` — e este MESMO componente desenha o calendário de Minhas
   * Tasks, que é `EQUIPE`. Com a chamada escrita aqui dentro, o arrasto de um
   * colaborador levaria *"Seu perfil não permite esta ação"* numa escrita que
   * o banco aceita, porque `subtasks_update` é `is_staff()` desde a 0144 —
   * **a guarda mais apertada que o banco**, que é a classe de bug que a 0059 e
   * a faixa de disponibilidade já pagaram duas vezes.
   *
   * Então quem passa `aoMover` é a Gestão de Tasks e mais ninguém, que é o
   * pedido em quantas palavras (*"na visualização de calendário da gestão de
   * tasks"*): **sem a prop não há arrasto**, e os dois lados nunca divergem.
   */
  aoMover?: (
    etapa: { id: string; taskId: string },
    datas: { data_inicio: string | null; prazo: string },
  ) => Promise<{ ok: boolean; error?: string }>;
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

  /**
   * A GRADE EM SEMANAS, porque uma faixa não dobra de linha.
   *
   * A grade era UMA de sete colunas sobre os 42 dias, uma `<div>` por dia — e
   * naquela forma um chip não tem como atravessar a borda de uma célula. Com
   * uma linha por semana, o pedaço vira item de grade e toma
   * `gridColumnStart`/`gridColumnEnd`.
   */
  const semanas = useMemo(() => {
    const chaves = dias.map((dia) => format(dia, "yyyy-MM-dd"));
    const fatias: string[][] = [];
    for (let i = 0; i < chaves.length; i += 7) fatias.push(chaves.slice(i, i + 7));
    return fatias;
  }, [dias]);

  /**
   * AS DATAS NOVAS VALEM NA TELA ANTES DE O BANCO RESPONDER, e voltam sozinhas
   * quando ele recusa — a mesma decisão do board da Gestão de Tasks. Sem isto
   * a faixa saltaria de volta ao lugar antigo e só depois para o novo, que é o
   * arrasto se desfazendo na frente de quem arrastou.
   */
  const [movidos, setMovidos] = useState<
    Record<string, { inicio: string | null; prazo: string }>
  >({});

  const itensNaTela = useMemo(
    () =>
      itens.map((item) =>
        movidos[item.chave] ? { ...item, ...movidos[item.chave] } : item,
      ),
    [itens, movidos],
  );

  /**
   * QUEM PASSA POR CADA DIA, e não mais quem VENCE nele.
   *
   * O mapa era `item.prazo` → itens, então cada item caía em exatamente uma
   * célula. Com a faixa, um dia tem o que começa, o que vence e o que só passa
   * por cima — e é esse conjunto que o `+N` conta e o painel do dia desenha,
   * senão os três números da tela discordariam entre si.
   *
   * **É uma varredura dos 42 dias da grade e não um laço de `inicio` a
   * `prazo`**, que é o que a torna barata e segura: ela é limitada por
   * construção, e uma data de ano torto não vira um laço de mil voltas.
   */
  const porDia = useMemo(() => {
    const mapa = new Map<string, ItemDeCalendario[]>();
    for (const semana of semanas) {
      for (const chave of semana) {
        mapa.set(
          chave,
          itensNaTela.filter(
            (item) => comecoDoItem(item) <= chave && chave <= item.prazo,
          ),
        );
      }
    }
    return mapa;
  }, [semanas, itensNaTela]);

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

  /**
   * QUEM ARRASTA É A ETAPA, e só ela.
   *
   * **A campanha não arrasta**, e é a razão escrita do Calendário Full virada
   * do avesso: lá o arrasto saiu porque *"valia para uma camada só — porque o
   * prazo dela é escrito por quem a faz —, e nas outras prometia uma mudança
   * que o banco desfaz ou recusa"*. Aqui a lista é de ETAPAS, cujo prazo é
   * escrito por quem as faz; a campanha entra pelo ENCERRAMENTO, que é o
   * combinado com o cliente e que `campaigns_protege_colunas` guarda em
   * `is_atendimento()` desde a 0078.
   *
   * **E a etapa CONCLUÍDA também não**, que é dito em vez de escondido: o
   * prazo dela é a data de uma coisa que já aconteceu, e um gesto de seis
   * pixels reescrevendo isso é o arrasto mudando o passado. Quem precisa
   * corrigir uma data antiga abre a etapa.
   */
  const podeMover = (item: ItemDeCalendario) =>
    Boolean(aoMover) && item.tipo === "subtarefa" && !item.concluida;

  const [arrastando, setArrastando] = useState<string | null>(null);
  const itemArrastado = arrastando
    ? (itensNaTela.find((item) => item.chave === arrastando) ?? null)
    : null;

  const sensores = useSensors(
    // Só começa a arrastar depois de 6px, como o board: sem isso um clique
    // para abrir a etapa viraria um arrasto acidental.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  /**
   * O INÍCIO CAI NO DIA DA SOLTA, E A DURAÇÃO SE PRESERVA.
   *
   * É a única regra que dá o mesmo resultado quer a faixa tenha um dia ou
   * dez, e quer a solta seja na mesma semana ou três semanas adiante. A
   * alternativa — preservar o ponto em que o ponteiro desceu dentro da faixa —
   * depende de ONDE a pessoa pegou o chip, e numa faixa de um dia, que é a
   * maioria, as duas são idênticas de qualquer forma.
   *
   * **Sem início, só o prazo anda**, que é a 0027 palavra por palavra: os dois
   * são opcionais de propósito, e *"exigir as duas faria a pessoa inventar
   * uma"* — inventar um início aqui seria gravar uma data que ninguém escolheu.
   */
  async function aoSoltar(evento: DragEndEvent) {
    setArrastando(null);
    if (!aoMover) return;

    const chave = String(evento.active.id);
    const destino = evento.over ? String(evento.over.id) : null;
    if (!destino) return;

    const item = itensNaTela.find((atual) => atual.chave === chave);
    if (!item || !podeMover(item)) return;

    const de = comecoDoItem(item);
    if (de === destino) return;

    const duracao = differenceInCalendarDays(
      dataDaChave(item.prazo),
      dataDaChave(de),
    );
    const prazo = format(addDays(dataDaChave(destino), duracao), "yyyy-MM-dd");
    const datas = { data_inicio: item.inicio ? destino : null, prazo };

    const antes = { inicio: item.inicio, prazo: item.prazo };
    setMovidos((atual) => ({
      ...atual,
      [chave]: { inicio: datas.data_inicio, prazo },
    }));

    const resultado = await aoMover(
      { id: chave.slice(PREFIXO_DA_ETAPA.length), taskId: item.taskId },
      datas,
    );
    if (!resultado.ok) {
      setMovidos((atual) => ({ ...atual, [chave]: antes }));
      toast.error(resultado.error ?? "Não foi possível mover a etapa.");
      return;
    }
    router.refresh();
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

        {/* ------------------------------------------------------------------
            A FAIXA DE UMA ETAPA, E O ARRASTO — decisão do usuário: *"não está
            aparecendo a data de inicio da tarefa, apenas o final (…) quero
            poder mexer nas datas apenas clicando e arrastando os cards"*.

            **ISTO DESFAZ METADE DE UMA DECISÃO DA 0027, e fica registrado
            como reversão declarada.** Aquela migration deu período à etapa e
            escreveu: *"atraso continua sendo do `prazo`, e o calendário
            continua mostrando só ele. Começar tarde não é atrasar; entregar
            tarde é. E uma barra por data dobraria os itens do mês."* **A
            primeira frase fica inteira** — a cor do chip continua saindo da
            situação do PRAZO, por `situacaoDoPrazo(item.prazo, …)`. A segunda
            cai, e ela supunha DOIS chips: a faixa é UM chip mais largo, então
            o mês não ganha item nenhum.

            **A GRADE PASSOU A SER UMA LINHA POR SEMANA.** Era uma de sete
            colunas sobre os 42 dias, uma `<div>` por dia, e naquela forma um
            chip não tem como atravessar a borda de uma célula. Agora cada
            semana é uma linha com duas camadas: o CHÃO (as bordas, o dia de
            outro mês e os alvos de solta) por baixo, em `absolute`, e o
            CONTEÚDO por cima, em fluxo normal — é ele que decide a altura,
            porque é ele que cresce com as trilhas.
            ------------------------------------------------------------------ */}
        <DndContext
          sensors={sensores}
          /* O DIA DA SOLTA É O DIA SOB O PONTEIRO, e este é o único
             `collisionDetection` escrito no produto. O padrão do dnd-kit é a
             maior sobreposição de retângulos, e uma faixa de cinco dias
             arrastada por cima de células de um sétimo da largura deixa "a
             maior" ambígua — o board de demandas não tem esse problema porque
             lá o card é mais estreito que a coluna. */
          collisionDetection={pointerWithin}
          onDragStart={(evento) => setArrastando(String(evento.active.id))}
          onDragCancel={() => setArrastando(null)}
          onDragEnd={aoSoltar}
        >
          {semanas.map((semana) => {
            const { pedacos, escondidos, trilhas } = pedacosDaSemana(
              semana,
              itensNaTela,
              cabemNaCelula,
            );

            return (
              <div
                key={semana[0]}
                className={cn(
                  "relative min-h-32",
                  modo === "semana" && "min-h-64",
                )}
              >
                {/* O CHÃO É `absolute` porque a ALTURA é do conteúdo: uma
                    célula com `min-h` própria aqui brigaria com a linha que a
                    semana cheia precisa. E o `pointer-events-none` não tira o
                    alvo de solta — o dnd-kit mede o RETÂNGULO do nó, não faz
                    teste de acerto no DOM —, ele tira o clique de cima dos
                    chips. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 grid grid-cols-7"
                >
                  {semana.map((chave) => (
                    <CelulaDoDia
                      key={chave}
                      dia={chave}
                      foraDoMes={
                        modo === "mes" &&
                        !isSameMonth(dataDaChave(chave), referencia)
                      }
                      alvo={Boolean(arrastando)}
                    />
                  ))}
                </div>

                <div className="relative grid grid-cols-7 gap-y-1 py-1.5">
                  {semana.map((chave, coluna) => (
                    <div
                      key={`numero-${chave}`}
                      className="px-1.5"
                      style={{ gridColumnStart: coluna + 1, gridRow: 1 }}
                    >
                      <span
                        className={cn(
                          "inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                          // `text-muted-foreground` inteiro, sem o `/60`: a
                          // 60% o número do dia dava 2,68:1. O dia de outro
                          // mês já se distingue pelo fundo da célula.
                          modo === "mes" &&
                            !isSameMonth(dataDaChave(chave), referencia) &&
                            "text-muted-foreground",
                          isToday(dataDaChave(chave)) &&
                            "bg-brand text-brand-foreground font-medium",
                        )}
                      >
                        {format(dataDaChave(chave), "d")}
                      </span>
                    </div>
                  ))}

                  {pedacos.map((pedaco) => (
                    <div
                      // A CHAVE LEVA A SEMANA, porque a mesma faixa aparece
                      // em duas linhas quando ela atravessa a virada — dois
                      // elementos para um item só, e com a chave do item
                      // sozinha o React veria duplicata.
                      key={`${pedaco.item.chave}-${semana[0]}`}
                      // `min-w-0` é o que faz o `truncate` do título valer:
                      // sem ele o item de grade se recusa a ficar menor que o
                      // conteúdo e a faixa estoura a coluna — é a coluna de
                      // domingo do Cronograma pela quarta vez.
                      className={cn(
                        "min-w-0 px-1.5",
                        pedaco.continua && "pl-0",
                        pedaco.segue && "pr-0",
                      )}
                      style={{
                        gridColumnStart: pedaco.col,
                        gridColumnEnd: pedaco.colFim,
                        gridRow: pedaco.trilha + 2,
                      }}
                    >
                      <PedacoArrastavel
                        pedaco={pedaco}
                        prazos={prazos}
                        abrir={abrir}
                        arrastavel={podeMover(pedaco.item)}
                        arrastando={arrastando === pedaco.item.chave}
                      />
                    </div>
                  ))}

                  {semana.map((chave, coluna) => {
                    const sobraram = escondidos.get(chave) ?? 0;
                    if (sobraram === 0) return null;
                    const doDia = porDia.get(chave) ?? [];

                    return (
                      <div
                        key={`mais-${chave}`}
                        className="px-1.5"
                        style={{
                          gridColumnStart: coluna + 1,
                          gridRow: trilhas + 2,
                        }}
                      >
                        {/* O "+N" É BOTÃO E NÃO LINK, ao contrário do
                            Cronograma do portal, e a razão é de onde mora o
                            estado: lá o MÊS está na URL, então `?dia=` aponta
                            para um dia que a grade com certeza mostra; aqui o
                            mês, a visão e o filtro são estado local, e um
                            endereço com o dia abriria num mês que não é o
                            dele.

                            E ELE CONTA POR DIA e não por semana: um dia pode
                            ter três faixas passando por cima dele e nenhuma
                            delas começar ali. */}
                        <button
                          type="button"
                          onClick={() =>
                            setDiaAberto(aberto === chave ? null : chave)
                          }
                          // O RÓTULO ACESSÍVEL DIZ O DIA, e o visível não:
                          // quem lê a tela vê o "+2" dentro da célula de 12
                          // de março e não precisa que ele se repita; quem
                          // OUVE chega no botão sem o contexto da célula.
                          aria-label={`Ver os ${doDia.length} itens de ${format(dataDaChave(chave), "d 'de' MMMM", { locale: ptBR })}`}
                          aria-expanded={aberto === chave}
                          className="text-text-secondary hover:text-text-primary w-full rounded px-1 py-0.5 text-left text-[11px] font-medium underline-offset-2 hover:underline"
                        >
                          {aberto === chave
                            ? "fechar"
                            : `+${sobraram} ${sobraram === 1 ? "item" : "itens"}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* O QUE SE ARRASTA É UMA CÓPIA, como no board de demandas: o
              original fica no lugar com `opacity-60`, e é esta cópia que
              segue o ponteiro. Ela é de UM dia de propósito — a faixa inteira
              acompanhando o cursor cobriria metade da semana e esconderia o
              dia em que a pessoa está mirando. */}
          <DragOverlay dropAnimation={null}>
            {itemArrastado ? (
              <div className="w-36">
                <ChipDoItem item={itemArrastado} prazos={prazos} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
              <li key={item.chave}>
                <ChipDoItem
                  item={item}
                  prazos={prazos}
                  onClick={() => abrir(item)}
                />
              </li>
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
 * O CHÃO DE UM DIA, e o alvo de solta dele.
 *
 * Ele não desenha conteúdo nenhum — é `aria-hidden` dentro de uma camada
 * `aria-hidden` —, e é por isso que o `ref` do dnd-kit pode morar aqui sem
 * custo de acessibilidade: não há nada focável dentro de um alvo que o leitor
 * de tela anunciaria sem saber do quê.
 *
 * **`disabled` enquanto nada está sendo arrastado** porque medir 42 retângulos
 * a cada render é trabalho que ninguém pediu: o dnd-kit só precisa deles
 * durante o gesto.
 */
function CelulaDoDia({
  dia,
  foraDoMes,
  alvo,
}: {
  dia: string;
  foraDoMes: boolean;
  alvo: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dia, disabled: !alvo });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-r border-b last:border-r-0",
        foraDoMes && "bg-surface-page",
        // O MESMO PAR DO BOARD DE DEMANDAS (`bg-accent`), porque é o mesmo
        // gesto: duas telas pintando o alvo de duas cores fariam a pessoa
        // reaprender o que o realce quer dizer.
        isOver && "bg-accent",
      )}
    />
  );
}

/**
 * A ALÇA. Ela existe porque o `ref` e os `listeners` do dnd-kit precisam de um
 * componente — gancho não se chama de dentro de um `.map`, que é a razão pela
 * qual a linha de Minhas Tasks e a da `DataTable` também viraram componente.
 */
function PedacoArrastavel({
  pedaco,
  prazos,
  abrir,
  arrastavel,
  arrastando,
}: {
  pedaco: PedacoDaSemana;
  prazos: { hoje: string; fimDaSemana: string };
  abrir: (item: ItemDeCalendario) => void;
  arrastavel: boolean;
  arrastando: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: pedaco.item.chave,
    disabled: !arrastavel,
  });

  // O dnd-kit devolve `role="button"` e `tabIndex` em `attributes`, e o chip
  // JÁ É um `<button>`: espalhá-los daria o papel repetido e duas paradas de
  // Tab para a mesma coisa — `nested-interactive`, crítico no axe, que o
  // cartão do board de demandas já pagou uma vez.
  const { role: _papel, tabIndex: _parada, ...aria } = attributes;

  return (
    <ChipDoItem
      ref={setNodeRef}
      item={pedaco.item}
      prazos={prazos}
      continua={pedaco.continua}
      segue={pedaco.segue}
      arrastavel={arrastavel}
      arrastando={arrastando || isDragging}
      // O NATIVO `click` SAI DEPOIS DO `pointerup`, então soltar a faixa
      // abriria a demanda por cima do calendário que a pessoa acabou de
      // reorganizar. A guarda é a do board, palavra por palavra.
      onClick={(evento) => {
        if (isDragging) {
          evento.preventDefault();
          return;
        }
        abrir(pedaco.item);
      }}
      {...aria}
      {...listeners}
    />
  );
}

/**
 * O chip de um item, desenhado na célula do dia E no painel do dia cheio.
 *
 * **Ele virou componente por causa do painel**, e não por tamanho: as duas
 * telas desenham o MESMO chip, e uma segunda cópia divergiria na primeira
 * mudança — a que divergiria é a do painel, que se abre menos. É a história
 * das sete cópias de `abas.tsx` em miniatura.
 *
 * **ELE NÃO EMBRULHA MAIS O `<li>`**, e a mudança é o que permite a faixa: na
 * grade por semana ele é um item de GRADE posicionado por coluna, e no painel
 * do dia ele é o conteúdo de um `<li>` que o chamador escreve. Um `<li>` aqui
 * dentro seria um item de lista solto no meio de uma grade.
 */
function ChipDoItem({
  item,
  prazos,
  continua = false,
  segue = false,
  arrastavel = false,
  arrastando = false,
  ref,
  ...resto
}: ComponentPropsWithoutRef<"button"> & {
  item: ItemDeCalendario;
  prazos: { hoje: string; fimDaSemana: string };
  /** A faixa começou numa semana anterior: a ponta da esquerda fica reta. */
  continua?: boolean;
  /** Ela segue na semana seguinte: a ponta da direita fica reta. */
  segue?: boolean;
  arrastavel?: boolean;
  arrastando?: boolean;
  ref?: Ref<HTMLButtonElement>;
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
    // O PERÍODO ENTRA AQUI e não numa linha do chip: a faixa já o DESENHA —
    // ela vai do início ao prazo —, e quem usa leitor de tela não tem a
    // largura. Com uma data só ele não aparece: repetir o dia que o chip já
    // está ocupando seria a mesma informação duas vezes.
    item.inicio && item.inicio !== item.prazo
      ? `de ${format(dataDaChave(item.inicio), "dd/MM")} a ${format(dataDaChave(item.prazo), "dd/MM")}`
      : null,
    item.responsavel ? `com ${item.responsavel.nome}` : null,
    `prioridade ${ROTULOS_DE_PRIORIDADE[item.prioridade].toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
        ref={ref}
        type="button"
        title={descricao}
        aria-label={descricao}
        className={cn(
          "relative w-full overflow-hidden border border-transparent py-1 text-left text-xs transition-opacity hover:opacity-85",
          // AS PONTAS SÃO UM PAR `rounded-l`/`rounded-r`, e nunca um
          // `rounded` com um `rounded-l-none` atrás: o tailwind-merge
          // descarta a classe ANTERIOR em conflito, então o atalho perderia
          // também os cantos da direita.
          continua ? "rounded-l-none" : "rounded-l",
          segue ? "rounded-r-none" : "rounded-r",
          // A barra da esquerda só existe onde a faixa COMEÇA, e o respiro
          // acompanha: no pedaço que continua, ela seria um segundo começo no
          // meio da mesma etapa.
          continua ? "pr-1.5 pl-1.5" : "pr-1.5 pl-2.5",
          arrastavel && "cursor-grab active:cursor-grabbing",
          // O ORIGINAL FICA NO LUGAR, apagado, e quem segue o ponteiro é a
          // cópia do `DragOverlay` — a decisão do board de demandas.
          arrastando && "opacity-60",
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
        {...resto}
      >
        {/* A barra é a cor cheia, e ela fica: sobre o chip
          tingido ela é a borda de leitura que separa uma
          linha da de baixo quando as duas são do mesmo
          tom. */}
        {continua ? null : (
          <span
            aria-hidden
            className={cn("absolute inset-y-0 left-0 w-1", tinta.barra)}
          />
        )}

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
  );
}
