"use client";

import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { Resultado } from "@/lib/acoes/resultado";
import { COR_DO_NIVEL, nivelDaCarga, ROTULOS_DE_NIVEL } from "@/lib/dominio/calendario";
import {
  avisoDoPeriodoEscolhido,
  resumoDoPeriodo,
  rotuloDoMotivo,
  type DiaDeDisponibilidade,
} from "@/lib/dominio/disponibilidade";
import { diasEntre, ordenar } from "@/lib/dominio/full-days";
import { formatarMinutosCurto } from "@/lib/dominio/tempo";
import { cn } from "@/lib/utils";

/**
 * Os dias de quem vai receber o trabalho, dentro do painel da etapa.
 *
 * **ELA MORA NO PAINEL E NÃO NUM DIÁLOGO**, e o motivo é mecânico antes de ser
 * de desenho: aquele painel SALVA CAMPO A CAMPO, sem botão de salvar, desde a
 * 0028. Um diálogo de confirmação prometeria uma etapa de "revisar antes de
 * gravar" que não existe ali — e cobriria justamente a etapa que a pessoa está
 * datando. A faixa é consulta, e **o clique no dia é o salvamento**.
 *
 * **A ESCALA DE CARGA VEM DE `lib/dominio/calendario.ts`**, e é por isso que
 * ela sobreviveu: `nivelDaCarga()`, `COR_DO_NIVEL` e `ROTULOS_DE_NIVEL` eram
 * compartilhados com a Linha do Tempo do Calendário Full — quatro degraus,
 * limiares de 80% e 100% —, porque duas escalas para a mesma pergunta seriam
 * descobertas pela pessoa no dia em que uma tela pintasse de verde o dia que
 * a outra pintou de âmbar. **Aquela visão saiu do produto**, por decisão do
 * usuário, e esta faixa passou a ser a única tela que pinta um dia por
 * ocupação. As três continuam onde estão: carga de um dia é vocabulário do
 * calendário, e mover a escala por causa de um leitor a menos é churn sem
 * nada em troca.
 *
 * **ELA SELECIONA UM PERÍODO, e não mais um dia solto** — decisão do usuário:
 * *"o primeiro dia clicado deve ser automaticamente a data de início, o
 * segundo a data final; todos os dias entre as duas devem ser selecionados e
 * contabilizados; um terceiro clique inicia uma nova seleção"*.
 *
 * **ISSO FECHA UMA PERGUNTA QUE ESTAVA ESCRITA AQUI EM ABERTO**, e o
 * parágrafo dela previa exatamente isto: *"o arrasto de um dia a outro
 * escreveria o PERÍODO (início mais prazo), e o clique simples resolve o caso
 * comum"*. O caso comum continua resolvido por um clique — o que mudou é que
 * o segundo deixou de ser uma nova escolha e passou a ser a outra ponta.
 *
 * **A FAIXA NÃO DECIDE O QUE FAZER COM AS DUAS PONTAS**, e isso é o que
 * permite ela servir aos dois chamadores sem desfazer a decisão de nenhum.
 * Ela devolve `(início, fim)`, com `fim` nulo no primeiro clique; quem grava
 * resolve:
 *
 *   - no painel da etapa, o primeiro clique vira um período de UM DIA
 *     (`data_inicio = prazo`), porque ali o clique é o salvamento e meio
 *     período gravado é um período que o `check subtasks_periodo` pode
 *     recusar;
 *   - na abertura do mês de social, ele escreve só o DIA e deixa a entrega em
 *     branco, que é a decisão da 0089 palavra por palavra — *"a data de final
 *     fica sempre em branco, pois na maioria dos casos a task dura apenas um
 *     dia"*. Lá o branco QUER DIZER um dia, e preenchê-lo sozinho seria
 *     desfazer o que ele pediu na mesma conversa.
 *
 * **E A JANELA DE BUSCA COBRE A SELEÇÃO, não só o mês à vista.** Sem isso um
 * período de 28/10 a 03/11 contaria os dias de outubro e ignoraria os três de
 * novembro — o resumo sairia baixo, plausível e errado, que é o modo de falha
 * desta casa. A busca pede a união do mês visível com o período escolhido, e
 * a chave do efeito já carrega as duas pontas, então trocar de mês com uma
 * seleção aberta não perde a primeira.
 *
 * **O DIA SE EXPLICA EMBAIXO DA GRADE.** A célula tem cerca de 62px num painel
 * de 512px: cabe o número e um fio de carga, e mais nada — nem um título de
 * etapa truncado, que não identifica nenhuma. O detalhe fica numa faixa logo
 * abaixo, onde há largura para o cliente e os minutos.
 */

type Props = {
  /** Quem vai receber o trabalho. */
  userId: string;
  nome: string;
  /** A primeira ponta do período gravado hoje, em ISO. */
  inicio: string | null;
  /** A segunda ponta. Igual ao início quer dizer um período de um dia. */
  fim: string | null;
  /**
   * Devolve o período escolhido. `fim` é nulo no PRIMEIRO clique, e quem
   * grava decide o que isso significa — a razão está no cabeçalho.
   */
  aoEscolher: (inicio: string, fim: string | null) => void;
  /**
   * Busca os dias. Vem de fora, e não de um import, para este componente não
   * puxar `lib/dados/`, que é `server-only` — um componente de cliente que o
   * importa quebra o build com um erro sobre `next/headers`.
   */
  buscar: (
    userId: string,
    inicio: string,
    fim: string,
  ) => Promise<Resultado<DiaDeDisponibilidade[]>>;
  /**
   * A FRASE DO RODAPE: o que o clique num dia escreve.
   *
   * Ela era fixa — *"escreve o prazo da etapa"* —, e é verdade no painel da
   * etapa em Gestão de Tasks, onde o clique É o salvamento do prazo. Na tela de
   * abrir o mês de social ele escreve o DIA da etapa, e a frase fixa nomeava o
   * campo errado a dois centímetros do campo certo. Um rodapé que descreve
   * outra coisa é pior que rodapé nenhum: ele ensina errado com toda a
   * confiança.
   *
   * O padrão é o do primeiro chamador, então nada muda onde já estava certo.
   */
  rotuloDoClique?: string;
};

/** Onde o dia cai dentro do período escolhido. */
type NaSelecao = "fora" | "ponta" | "meio";

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function FaixaDeDisponibilidade({
  userId,
  nome,
  inicio,
  fim,
  aoEscolher,
  buscar,
  rotuloDoClique = "Clique num dia para abrir o período e noutro para fechar.",
}: Props) {
  // O MÊS ABRE NO DO PERÍODO quando há um, e no corrente quando não há: quem
  // está mexendo numa etapa já datada quer ver aquele mês, não este. A
  // primeira ponta manda — abrir no fim de um período de três semanas
  // esconderia justamente o começo dele.
  const [ancora, setAncora] = useState(() =>
    startOfMonth(inicio ?? fim ? parseISO((inicio ?? fim) as string) : new Date()),
  );
  // A PONTA ABERTA: o primeiro clique de uma seleção que ainda espera a
  // segunda. Ela mora AQUI e não no pai porque é transitório do gesto — o
  // período gravado continua sendo propriedade, como no calendário rolável,
  // e é isso que a faz sobreviver a trocar de mês quantas vezes for.
  const [pendente, setPendente] = useState<string | null>(null);
  // O dia sob o cursor, para a prévia do intervalo entre os dois cliques. Sem
  // ela, o segundo clique é uma aposta: nada na tela diz o que ele vai pegar.
  const [sobrevoo, setSobrevoo] = useState<string | null>(null);
  const [dias, setDias] = useState<DiaDeDisponibilidade[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // O CONTADOR É O BOTÃO "Tentar de novo", e ele mora na lista de dependências
  // do efeito: um `tentativa + 1` refaz a mesma busca sem trocar de mês nem
  // remontar o componente. Sem ele, a única saída de uma falha de transporte
  // era fechar e reabrir o painel — e quem fecha o painel perde de vista a
  // etapa que estava datando.
  const [tentativa, setTentativa] = useState(0);
  const [carregado, setCarregado] = useState<string | null>(null);

  // `useTransition` CONTINUA, e só pelo embrulho das escritas: o
  // `react-hooks/set-state-in-effect` do projeto reprova `setState` no corpo
  // de um efeito, e `startTransition` é o que o satisfaz. O que ele NÃO serve
  // é para dizer se a busca está em curso — a razão está logo abaixo.
  const [, iniciarBusca] = useTransition();

  // A JANELA É A UNIÃO DO MÊS COM A SELEÇÃO, e é ela que faz o período
  // atravessar meses sem mentir no resumo. `min`/`max` de texto bastam:
  // `yyyy-MM-dd` ordena igual como string e como data.
  const mesInicio = format(ancora, "yyyy-MM-dd");
  const mesFim = format(endOfMonth(ancora), "yyyy-MM-dd");
  const pontas = [inicio, fim, pendente].filter(Boolean) as string[];
  const janelaInicio = [mesInicio, ...pontas].reduce((a, b) => (a <= b ? a : b));
  const janelaFim = [mesFim, ...pontas].reduce((a, b) => (a >= b ? a : b));

  // ------------------------------------------------------------------------
  // O "CARREGANDO" É DERIVADO DE UMA CHAVE, e isso é um conserto.
  //
  // Ele era o primeiro elemento do `useTransition`, e aquele número era
  // SEMPRE falso durante a requisição: a busca vivia dentro de
  // `iniciarBusca(() => { void (async () => …)() })`, e aquele retorno de
  // chamada devolve na hora — ele só DISPARA a promessa. A transição fechava
  // antes do primeiro byte, então o `opacity-60` da grade nunca apareceu.
  //
  // Na prática era isso que fazia uma falha de transporte parecer tela
  // quebrada em vez de tentativa que não voltou: não havia sinal nenhum entre
  // abrir a faixa e o erro. Comparar a chave pedida com a chave que voltou
  // responde a mesma pergunta sem guardar um segundo booleano — é "atraso não
  // é coluna" dentro de um componente.
  // ------------------------------------------------------------------------
  const chave = `${userId}|${janelaInicio}|${janelaFim}|${tentativa}`;
  const buscando = carregado !== chave;

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const r = await chamarAcao(() => buscar(userId, janelaInicio, janelaFim));
      if (cancelado) return;
      iniciarBusca(() => {
        if (r.ok) {
          setDias(r.dados ?? []);
          setErro(null);
        } else {
          // A FALHA APARECE, e não vira grade vazia: aqui "não achei nada"
          // seria indistinguível de "a pessoa está livre o mês todo", que é a
          // resposta mais perigosa que esta tela pode dar.
          //
          // E ELA APARECE COM A MENSAGEM CRUA, de propósito: `chamarAcao` já
          // devolve *"Não foi possível falar com o servidor: Failed to
          // fetch"* — português na frente e a causa de verdade atrás. Trocar
          // isso por uma frase redonda esconderia justamente o que diz se o
          // problema foi a rede, a sessão ou o banco.
          setDias(null);
          setErro(r.error ?? "Não foi possível ler os dias.");
        }
        setCarregado(chave);
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [userId, janelaInicio, janelaFim, buscar, chave]);

  const porData = useMemo(() => {
    const mapa = new Map<string, DiaDeDisponibilidade>();
    for (const d of dias ?? []) mapa.set(d.data, d);
    return mapa;
  }, [dias]);

  const celulas = useMemo(() => montarGrade(ancora), [ancora]);

  // ------------------------------------------------------------------------
  // O QUE ESTÁ DESTACADO AGORA.
  //
  // Com a seleção aberta, o intervalo desenhado vai da ponta pendente até o
  // dia sob o cursor — e ele cai de volta na própria ponta quando o ponteiro
  // sai da grade, para a célula clicada continuar marcada. Fechada, ele é o
  // período que o pai tem gravado.
  //
  // `ordenar()` é o que faz a seleção de trás para frente funcionar: clicar
  // no 20 e depois no 12 dá o mesmo período que o caminho contrário, e é a
  // mesma função que o calendário do Day Off usa desde o Sprint 6.
  // ------------------------------------------------------------------------
  const faixa = useMemo<[string, string] | null>(() => {
    if (pendente) return ordenar(pendente, sobrevoo ?? pendente);
    if (inicio && fim) return ordenar(inicio, fim);
    if (inicio) return [inicio, inicio];
    if (fim) return [fim, fim];
    return null;
  }, [pendente, sobrevoo, inicio, fim]);

  const diasDaFaixa = useMemo(
    () => (faixa ? diasEntre(faixa[0], faixa[1]) : []),
    [faixa],
  );

  // OS DIAS DO PERÍODO QUE JÁ VOLTARAM DO BANCO. Enquanto a busca da janela
  // nova não chega, o resumo conta o que tem — e é por isso que ele some
  // durante o carregamento em vez de mostrar um número pela metade.
  const diasEscolhidos = useMemo(
    () => diasDaFaixa.map((d) => porData.get(d)).filter(Boolean) as DiaDeDisponibilidade[],
    [diasDaFaixa, porData],
  );

  const aviso =
    diasEscolhidos.length === diasDaFaixa.length
      ? avisoDoPeriodoEscolhido(
          diasEscolhidos,
          nome.split(" ")[0],
          diasEscolhidos[0]
            ? format(parseISO(diasEscolhidos[0].data), "d 'de' MMMM", { locale: ptBR })
            : "",
        )
      : null;

  /**
   * O CLIQUE: abre, fecha, e o terceiro recomeça.
   *
   * O primeiro devolve `(dia, null)` e deixa a ponta aberta. O segundo
   * devolve o par ordenado e fecha. O terceiro cai no primeiro ramo de novo,
   * porque `pendente` voltou a ser nulo — não existe um estado em que a faixa
   * espere a terceira.
   */
  function aoClicar(dia: string) {
    if (pendente) {
      const [de, ate] = ordenar(pendente, dia);
      setPendente(null);
      setSobrevoo(null);
      aoEscolher(de, ate);
      return;
    }
    setPendente(dia);
    aoEscolher(dia, null);
  }

  return (
    // ELA PINTA O PRÓPRIO FUNDO, e não pintava — é o terceiro contêiner do
    // produto com `border` e `rounded-xl` e mais nada, atrás do calendário de
    // Gestão de Tasks e da legenda dele. Aqui ele doía mais do que parece: o
    // `SheetContent` é `bg-background`, que aponta para `--surface-page`,
    // então a grade dos dias saía CINZA dentro de um painel cinza — e é
    // justamente ela o "indicador de sobrecarga" que a decisão do fundo
    // branco manda preservar. Num contêiner que depende do pai, a cor muda
    // conforme a tela que o abriga: a abertura do mês de social o põe sobre
    // cartão branco e o painel da etapa sobre a página.
    <div className="bg-surface-card space-y-3 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <p className="grow text-sm font-semibold">Os dias de {nome.split(" ")[0]}</p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          aria-label="Mês anterior"
          onClick={() => setAncora((m) => addMonths(m, -1))}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="min-w-[96px] text-center text-xs font-medium">
          {format(ancora, "MMMM 'de' yyyy", { locale: ptBR })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          aria-label="Mês seguinte"
          onClick={() => setAncora((m) => addMonths(m, 1))}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {/* A RECUSA TRAZ O CAMINHO DE VOLTA, e é a diferença entre uma falha e
          um beco. Uma leitura que não voltou costuma ser passageira — rede,
          um processo reiniciando, a sessão renovando —, e sem o botão a
          pessoa fica olhando a mesma mensagem até fechar o painel.

          O BOTÃO USA O PAR NOMEADO DA PRÓPRIA CAIXA (`--danger` sobre
          `--danger-soft`), que o `check:cores` já mede. Um `Button` do
          shadcn aqui traria as cores dele para dentro de um fundo tingido —
          opacidade e par não medido no mesmo lugar. */}
      {erro ? (
        <div className="bg-danger-soft text-danger space-y-1 rounded-lg px-3 py-2 text-xs">
          <p>{erro}</p>
          <button
            type="button"
            onClick={() => setTentativa((n) => n + 1)}
            disabled={buscando}
            className="font-semibold underline disabled:opacity-60"
          >
            {buscando ? "Tentando…" : "Tentar de novo"}
          </button>
        </div>
      ) : null}

      <div>
        <div className="grid grid-cols-7">
          {SEMANA.map((d, i) => (
            <div
              key={`${d}-${i}`}
              aria-hidden
              className="text-muted-foreground pb-1 text-center text-[9px] font-bold tracking-wider uppercase"
            >
              {d}
            </div>
          ))}
        </div>
        {/* O `gap` SAIU da grade e virou borda, e é o que faz o intervalo se
            ler como um intervalo: com meio pixel de vão entre as células, um
            período de sete dias aparece como sete retângulos soltos da mesma
            cor em vez de uma faixa. O respiro de cada dia virou padding
            dentro da própria célula.

            `onMouseLeave` no contêiner zera o sobrevoo: sem ele, tirar o
            ponteiro da grade deixa a prévia congelada no último dia tocado,
            afirmando um período que ninguém escolheu. */}
        <div
          className={cn("grid grid-cols-7", buscando && "opacity-60")}
          onMouseLeave={() => setSobrevoo(null)}
        >
          {celulas.map((celula) => {
            const dia = porData.get(celula.iso);
            const na: NaSelecao = !faixa
              ? "fora"
              : celula.iso === faixa[0] || celula.iso === faixa[1]
                ? "ponta"
                : celula.iso > faixa[0] && celula.iso < faixa[1]
                  ? "meio"
                  : "fora";
            return (
              <Celula
                key={celula.iso}
                iso={celula.iso}
                numero={celula.numero}
                doMes={celula.doMes}
                dia={dia}
                na={na}
                aberta={pendente !== null}
                aoClicar={aoClicar}
                aoSobrevoar={setSobrevoo}
              />
            );
          })}
        </div>
      </div>

      {/* A LEGENDA É A DO PRODUTO, e o "vazio" fica de fora: aqui ele é a
          maioria das células, e um item de legenda para a ausência de carga
          é um item que não informa nada. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {(["folgado", "cheio", "estourado"] as const).map((nivel) => (
          <span key={nivel} className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
            <span className={cn("h-1.5 w-4 rounded-full", COR_DO_NIVEL[nivel])} />
            {ROTULOS_DE_NIVEL[nivel]}
          </span>
        ))}
      </div>

      {/* UM DIA SE EXPLICA ITEM A ITEM; UM PERÍODO SE EXPLICA CONTANDO.
          Numa etapa de três semanas a lista detalhada seriam cinco linhas
          por dia — cem linhas num painel de 512px, que é a lista que esconde
          a informação em vez de dá-la. O que o período precisa dizer é o
          total e quantos dias apertam. */}
      {diasEscolhidos.length === 1 ? (
        <DiaEscolhido dia={diasEscolhidos[0]} />
      ) : diasEscolhidos.length > 1 ? (
        <PeriodoEscolhido dias={diasEscolhidos} />
      ) : null}

      {/* A PONTA ABERTA DIZ QUE ESTÁ ABERTA. Sem esta linha, entre o primeiro
          e o segundo clique a tela fica idêntica à de um dia escolhido, e
          quem parou no meio não tem como saber que o próximo clique vai
          esticar o período em vez de trocá-lo. */}
      {pendente ? (
        <p className="text-accent-strong text-[11px] font-medium">
          Período aberto em{" "}
          {format(parseISO(pendente), "d 'de' MMMM", { locale: ptBR })}. Clique
          noutro dia para fechar.
        </p>
      ) : null}

      {aviso ? (
        <p className="bg-warning-soft text-warning flex items-start gap-2 rounded-lg px-3 py-2 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {aviso}
        </p>
      ) : null}

      <p className="text-muted-foreground text-[11px]">
        {rotuloDoClique}
      </p>
    </div>
  );
}

function Celula({
  iso,
  numero,
  doMes,
  dia,
  na,
  aberta,
  aoClicar,
  aoSobrevoar,
}: {
  iso: string;
  numero: number;
  doMes: boolean;
  dia: DiaDeDisponibilidade | undefined;
  na: NaSelecao;
  /** Há uma ponta esperando a segunda: o rótulo acessível muda por isso. */
  aberta: boolean;
  aoClicar: (data: string) => void;
  aoSobrevoar: (data: string | null) => void;
}) {
  const motivo = rotuloDoMotivo(dia?.indisponivelMotivo ?? null);
  const semCapacidade = dia ? dia.capacidadeMinutos === 0 : false;
  const nivel = dia
    ? nivelDaCarga({ minutos: dia.cargaMinutos, etapas: dia.etapas }, dia.capacidadeMinutos)
    : "vazio";

  // O RÓTULO ACESSÍVEL CARREGA O QUE A CÉLULA NÃO CABE. Em 62px não entra nem
  // o motivo nem a ocupação, e quem usa leitor de tela não tem a cor.
  const partes = [format(parseISO(iso), "d 'de' MMMM", { locale: ptBR })];
  if (motivo) partes.push(motivo);
  else if (dia && dia.etapas > 0)
    partes.push(
      `${formatarMinutosCurto(dia.cargaMinutos)} de ${formatarMinutosCurto(dia.capacidadeMinutos)}`,
      ROTULOS_DE_NIVEL[nivel],
    );
  else partes.push(ROTULOS_DE_NIVEL.vazio);

  // O RÓTULO ACESSÍVEL DIZ O QUE O CLIQUE FAZ, e ele muda com a ponta aberta:
  // quem não vê a faixa azul não tem como saber se o próximo clique abre um
  // período novo ou fecha o que está aberto.
  partes.push(aberta ? "fecha o período aqui" : "abre o período aqui");

  return (
    <button
      type="button"
      aria-pressed={na !== "fora"}
      aria-label={partes.join(", ")}
      title={partes.join(" · ")}
      onClick={() => aoClicar(iso)}
      onMouseEnter={() => aoSobrevoar(iso)}
      onFocus={() => aoSobrevoar(iso)}
      className={cn(
        // A FAIXA É CONTÍNUA, e as pontas é que são arredondadas: um raio em
        // toda célula partiria o intervalo em sete pílulas. É o desenho do
        // calendário rolável do Day Off, que resolve a mesma seleção.
        "flex cursor-pointer flex-col items-center gap-1 border border-transparent px-0.5 py-1.5",
        na === "fora" && "rounded-lg hover:border-input",
        na === "meio" && "bg-accent",
        na === "ponta" && "bg-accent-strong rounded-lg text-white",
      )}
    >
      {/* O DIA DE FORA DO MÊS E O DIA SEM CAPACIDADE RECUAM PELO TOM, nunca
          por opacidade. A primeira versão usava `opacity-40`, e o axe a
          reprovou na primeira rodada: opacidade em texto dá uma cor que
          ninguém mediu, e no tema escuro dá outra. É a regra que o produto já
          tinha escrita para o selo de estado e que o `opacity-80` do
          `DateBadge` já pagou uma vez.

          Os dois recuam pelo MESMO tom, e é honesto: nenhum dos dois é o foco
          da grade, e quem os distingue é o fio de carga — o dia sem
          capacidade não tem nenhum. */}
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          // A PONTA LEVA O TEXTO BRANCO DO PRÓPRIO FUNDO, e o recuo de tom
          // dos outros dois casos não vale sobre ela: `--text-muted` sobre
          // `--accent-strong` seria um par que ninguém mediu.
          na !== "ponta" && (!doMes || semCapacidade) && "text-muted-foreground",
        )}
      >
        {numero}
      </span>
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-[70%] rounded-full",
          semCapacidade ? "bg-transparent" : COR_DO_NIVEL[nivel],
        )}
      />
    </button>
  );
}

function DiaEscolhido({ dia }: { dia: DiaDeDisponibilidade }) {
  const motivo = rotuloDoMotivo(dia.indisponivelMotivo);
  const dataLegivel = format(parseISO(dia.data), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="bg-accent space-y-1.5 rounded-lg px-3 py-2">
      <p className="text-accent-strong text-xs font-semibold first-letter:uppercase">
        {dataLegivel}
        {dia.capacidadeMinutos > 0
          ? ` · ${formatarMinutosCurto(dia.cargaMinutos)} de ${formatarMinutosCurto(dia.capacidadeMinutos)}`
          : ""}
        {motivo && dia.capacidadeMinutos === 0 ? ` · ${motivo}` : ""}
        {dia.ocupacaoPct !== null && dia.capacidadeMinutos > 0 ? ` · ${dia.ocupacaoPct}%` : ""}
      </p>

      {dia.itens.length > 0 ? (
        <ul className="space-y-0.5">
          {dia.itens.map((item) => (
            <li key={item.id} className="flex items-baseline gap-2 text-[11px]">
              <span className="min-w-[38px] font-semibold tabular-nums">
                {formatarMinutosCurto(item.minutos)}
              </span>
              <span className="min-w-0 grow truncate">{item.titulo}</span>
              {item.cliente ? (
                <span className="text-muted-foreground shrink-0 text-[10px]">{item.cliente}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : dia.capacidadeMinutos > 0 ? (
        <p className="text-muted-foreground text-[11px]">Nenhuma etapa neste dia.</p>
      ) : null}

      {/* A FUNÇÃO DEVOLVE ATÉ CINCO, e o resto é contagem. Sem esta linha, um
          dia com oito etapas pareceria ter cinco — e a decisão de prazo seria
          tomada sobre um número incompleto. */}
      {dia.etapas > dia.itens.length ? (
        <p className="text-muted-foreground text-[10px]">
          e mais {dia.etapas - dia.itens.length}{" "}
          {dia.etapas - dia.itens.length === 1 ? "etapa" : "etapas"}
        </p>
      ) : null}
    </div>
  );
}

/**
 * O PERÍODO INTEIRO, contado — e não a lista de todos os dias dele.
 *
 * Um dia escolhido mostra as etapas que já ocupam aquele dia, item a item,
 * porque cabem cinco linhas. Um período de três semanas mostraria cem, num
 * painel de 512px: a lista que esconde a informação em vez de dar.
 *
 * O que ele diz são os três números que decidem a data: quanto tempo a pessoa
 * já tem no período, quanto o período comporta, e em quantos dias ela passa
 * disso. O quarto — os dias em que ela está fora — só aparece quando existe,
 * porque é a exceção, e a regra do produto é pintar só a exceção.
 */
function PeriodoEscolhido({ dias }: { dias: DiaDeDisponibilidade[] }) {
  const resumo = resumoDoPeriodo(dias);
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];

  return (
    <div className="bg-accent space-y-1.5 rounded-lg px-3 py-2">
      <p className="text-accent-strong text-xs font-semibold">
        {format(parseISO(primeiro.data), "d 'de' MMM", { locale: ptBR })} a{" "}
        {format(parseISO(ultimo.data), "d 'de' MMM", { locale: ptBR })} ·{" "}
        {resumo.dias} dias
      </p>

      <dl className="space-y-0.5 text-[11px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Dias de trabalho</dt>
          <dd className="font-semibold tabular-nums">{resumo.diasComCapacidade}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Já ocupado</dt>
          <dd className="font-semibold tabular-nums">
            {formatarMinutosCurto(resumo.cargaMinutos)} de{" "}
            {formatarMinutosCurto(resumo.capacidadeMinutos)}
          </dd>
        </div>
        {/* OS DOIS DE BAIXO SOMEM NO ZERO, e é a decisão da matriz do Day Off:
            uma linha dizendo "0 dias acima da capacidade" em todo período
            tranquilo é a linha que ensina a não ler o bloco. A ausência é a
            resposta. */}
        {resumo.diasEstourados > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Acima da capacidade</dt>
            <dd className="text-warning font-semibold tabular-nums">
              {resumo.diasEstourados}{" "}
              {resumo.diasEstourados === 1 ? "dia" : "dias"}
            </dd>
          </div>
        ) : null}
        {resumo.diasIndisponiveis > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Fora</dt>
            <dd className="text-warning font-semibold tabular-nums">
              {resumo.diasIndisponiveis}{" "}
              {resumo.diasIndisponiveis === 1 ? "dia" : "dias"}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/**
 * As células do mês, começando na segunda-feira.
 *
 * Ela inclui os dias do mês vizinho que completam a primeira e a última
 * semana: sem eles a grade começaria no meio de uma linha, e o dia 1 de um mês
 * que cai no domingo apareceria sozinho na coluna errada.
 */
function montarGrade(ancora: Date): { iso: string; numero: number; doMes: boolean }[] {
  const primeiro = startOfMonth(ancora);
  const ultimo = endOfMonth(ancora);

  // `getDay()` devolve 0 no domingo; a grade começa na segunda, então o
  // domingo é o sexto recuo e não o nenhum.
  const recuo = (primeiro.getDay() + 6) % 7;
  const celulas: { iso: string; numero: number; doMes: boolean }[] = [];

  const comeco = new Date(primeiro);
  comeco.setDate(comeco.getDate() - recuo);

  const total = Math.ceil((recuo + ultimo.getDate()) / 7) * 7;
  for (let i = 0; i < total; i += 1) {
    const d = new Date(comeco);
    d.setDate(d.getDate() + i);
    celulas.push({
      iso: format(d, "yyyy-MM-dd"),
      numero: d.getDate(),
      doMes: d.getMonth() === primeiro.getMonth(),
    });
  }
  return celulas;
}
