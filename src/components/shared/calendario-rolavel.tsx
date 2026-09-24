"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  PRIMEIRO_MES_DO_CALENDARIO,
  ULTIMO_MES_DO_CALENDARIO,
  diasEntre,
  lerData,
  ordenar,
  paraISO,
} from "@/lib/dominio/full-days";
import { cn } from "@/lib/utils";

/**
 * Calendário de meses empilhados, em rolagem contínua.
 *
 * **NÃO EXISTE "MUDAR DE MÊS", E É ISSO QUE CONSERTA O BUG.** A tela antiga
 * navegava por mês pela URL, e o `mes` entrava no `key` do `<Suspense>` da
 * página: trocar de mês desmontava a subárvore inteira e o componente novo
 * nascia com a seleção zerada. Quem quisesse pedir de 28/10 a 03/11 perdia a
 * primeira ponta ao virar o mês. Aqui não há navegação — há rolagem —, e o
 * componente nunca é remontado.
 *
 * **ELE NÃO GUARDA A SELEÇÃO.** `de` e `ate` chegam por propriedade e saem
 * por `aoSelecionar`. O que mora aqui é só o transitório do gesto: se o
 * ponteiro está pressionado, se o intervalo espera a ponta final, e qual dia
 * está sob o cursor. A seleção pertence a quem vai enviá-la, e é por isso que
 * ela sobrevive a rolar para frente e para trás quantas vezes for.
 *
 * O componente não sabe nada de descanso, de área nem de saldo: quem responde
 * "este dia pode?" é `recusaDoDia`, e "este intervalo pode?" é
 * `recusaDoIntervalo`, as duas de quem chamou. Assim o mesmo calendário serve
 * ao pedido da pessoa e ao lançamento retroativo da gestão, que têm regras
 * opostas sobre o passado.
 */

export type RecusaDeDia = (dia: string) => string | null;

const PASSO_DA_JANELA = 3;


export function CalendarioRolavel({
  de,
  ate,
  aoSelecionar,
  hojeISO,
  primeiroMes = PRIMEIRO_MES_DO_CALENDARIO,
  ultimoMes = ULTIMO_MES_DO_CALENDARIO,
  feriados,
  bloqueados,
  recusaDoDia,
  recusaDoIntervalo,
  aoRecusar,
  className,
}: {
  de: string | null;
  ate: string | null;
  aoSelecionar: (de: string | null, ate: string | null) => void;
  hojeISO: string;
  /** Primeiro mês que a rolagem alcança, `yyyy-MM`. */
  primeiroMes?: string;
  /** Último mês que a rolagem alcança, `yyyy-MM`. */
  ultimoMes?: string;
  /** Data ISO → nome do feriado. */
  feriados: Map<string, string>;
  /** Data ISO → nomes de quem está fora naquele dia. */
  bloqueados: Record<string, string[]>;
  /** Por que este dia não pode ser escolhido, ou null. */
  recusaDoDia: RecusaDeDia;
  /** Por que este intervalo não pode, ou string vazia. */
  recusaDoIntervalo: (de: string, ate: string) => string;
  /** Chamado com a frase da recusa quando o clique é barrado. */
  aoRecusar: (frase: string) => void;
  className?: string;
}) {
  const rolagem = useRef<HTMLDivElement>(null);
  const [arrastando, setArrastando] = useState(false);
  // O intervalo tem uma ponta e espera a outra — pelo segundo clique, ou por
  // soltar o botão depois de arrastar.
  const [aberta, setAberta] = useState(false);
  const arrastou = useRef(false);
  const [sobrevoo, setSobrevoo] = useState<string | null>(null);

  /**
   * A ÂNCORA É O MÊS CORRENTE, e a janela é contada a partir dela.
   *
   * O intervalo é fixo (janeiro de 2025 a dezembro de 2030) mas a tela ABRE
   * NO DIA DE HOJE: quem entra não quer rolar setenta e dois meses para achar
   * esta semana. A conta converte as duas bordas fixas em "quantos meses para
   * trás" e "quantos para frente" a partir de hoje, que é o que a janela de
   * montagem já sabia usar.
   *
   * **A âncora é GRAMPEADA dentro do intervalo.** Passado dezembro de 2030,
   * abrir "no mês corrente" seria abrir num mês que o calendário não oferece —
   * uma tela com um dia de hoje que não existe em lugar nenhum da lista. Aí
   * ela abre na borda, e o botão Hoje some: não há para onde ir, e um botão
   * que não faz nada é pior que um botão a menos. Quando 2031 chegar, o que
   * muda é a constante — e ela está a duas linhas daqui.
   */
  const { ancora, mesesAtras, mesesAdiante, hojeNoIntervalo } = useMemo(() => {
    const primeiro = startOfMonth(parseISO(`${primeiroMes}-01`));
    const ultimo = startOfMonth(parseISO(`${ultimoMes}-01`));
    const corrente = startOfMonth(parseISO(`${hojeISO.slice(0, 7)}-01`));
    const dentro = corrente >= primeiro && corrente <= ultimo;
    const base = dentro ? corrente : corrente < primeiro ? primeiro : ultimo;
    return {
      ancora: base,
      mesesAtras: Math.max(0, differenceInCalendarMonths(base, primeiro)),
      mesesAdiante: Math.max(0, differenceInCalendarMonths(ultimo, base)),
      hojeNoIntervalo: dentro,
    };
  }, [hojeISO, primeiroMes, ultimoMes]);

  // Quantos meses, para frente e para trás da âncora, estão montados. Cresce
  // conforme a pessoa chega na ponta: montar os setenta e dois meses de uma
  // vez são mais de dois mil botões que ninguém vai olhar.
  //
  // ABRE EM ZERO, no mês da âncora. A primeira versão abria em -1 e a
  // sentinela de cima já nascia visível: o calendário crescia para trás
  // sozinho na montagem e a tela abria três meses antes de hoje. Quem entra
  // para combinar um período quer ver esta semana, não o que passou.
  const [janela, setJanela] = useState(() => ({
    primeiro: 0,
    ultimo: Math.min(2, mesesAdiante),
  }));
  const [mesEmVista, setMesEmVista] = useState(format(ancora, "yyyy-MM"));

  const meses = useMemo(() => {
    const lista: string[] = [];
    for (let i = janela.primeiro; i <= janela.ultimo; i++) {
      lista.push(format(addMonths(ancora, i), "yyyy-MM"));
    }
    return lista;
  }, [ancora, janela]);

  // O intervalo só está DE FATO esperando a segunda ponta se houver primeira.
  // Derivado, e não sincronizado por efeito: quem limpa a seleção por fora
  // (o botão Limpar, o envio) zera `de`, e com isso `esperando` cai sozinho.
  // Um `useEffect` que chamasse `setAberta(false)` faria o mesmo por um
  // caminho mais longo, com uma renderização a mais e um lugar novo onde
  // alguém, um dia, acrescentaria o mês nas dependências.
  const esperando = aberta && de !== null;

  // A seleção desenhada: a gravada, ou a prévia sob o cursor enquanto a
  // segunda ponta não foi escolhida.
  const pontaFinal = esperando && sobrevoo ? sobrevoo : ate;
  const [inicioSel, fimSel] =
    de && pontaFinal ? ordenar(de, pontaFinal) : de ? [de, de] : [null, null];

  /**
   * Soltar o ponteiro encerra o arrasto, e o ouvinte é da JANELA porque a
   * pessoa solta onde quiser — fora da grade, fora da página. Sem ele,
   * `arrastando` seguia verdadeiro depois de o botão subir e o simples passar
   * do mouse continuava mexendo na seleção.
   */
  useEffect(() => {
    if (!arrastando) return;
    function soltou() {
      setArrastando(false);
      if (arrastou.current) setAberta(false);
      arrastou.current = false;
    }
    window.addEventListener("pointerup", soltou);
    window.addEventListener("pointercancel", soltou);
    return () => {
      window.removeEventListener("pointerup", soltou);
      window.removeEventListener("pointercancel", soltou);
    };
  }, [arrastando]);

  function clicar(dia: string) {
    const recusa = recusaDoDia(dia);
    if (recusa) {
      aoRecusar(recusa);
      return;
    }

    // O segundo clique fecha o intervalo, e é aqui que o período pode
    // atravessar um bloqueio sem que nenhuma das pontas esteja bloqueada.
    if (esperando && de) {
      const noIntervalo = recusaDoIntervalo(...ordenar(de, dia));
      if (noIntervalo) {
        aoRecusar(noIntervalo);
        return;
      }
      // Fim antes do início INVERTE em vez de recusar: quem escolheu de trás
      // para a frente disse a mesma coisa por outro caminho.
      const [i, f] = ordenar(de, dia);
      aoSelecionar(i, f);
      setAberta(false);
      setArrastando(false);
      setSobrevoo(null);
      return;
    }

    // O primeiro clique ancora, e já vale como um dia só — em vez de deixar a
    // seleção sem ponta final até a pessoa descobrir que falta clicar de novo.
    // Clicar dentro de um intervalo já fechado recomeça daqui, que é o que a
    // pessoa quer dizer ao clicar de novo no meio do que ela mesma marcou.
    aoSelecionar(dia, dia);
    setAberta(true);
    setArrastando(true);
    setSobrevoo(dia);
    arrastou.current = false;
  }

  function passarPor(dia: string) {
    if (esperando) setSobrevoo(dia);
    if (!arrastando || !de) return;
    // Arrastando, a recusa é SILENCIOSA: a seleção simplesmente não passa do
    // bloqueio. Um toast por movimento do mouse empilharia dez avisos iguais
    // antes de a pessoa soltar o botão — quem larga em cima do dia bloqueado
    // recebe a explicação pelo clique.
    if (recusaDoDia(dia)) return;
    if (recusaDoIntervalo(...ordenar(de, dia))) return;
    if (dia !== de) arrastou.current = true;
    aoSelecionar(...ordenar(de, dia));
  }

  const irParaHoje = useCallback(() => {
    const alvo = rolagem.current?.querySelector(
      `[data-mes="${hojeISO.slice(0, 7)}"]`,
    );
    alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hojeISO]);

  /**
   * Crescer a janela nas pontas e dizer qual mês está no topo.
   *
   * **UM TRATADOR DE ROLAGEM, E NÃO UM IntersectionObserver.** A primeira
   * versão usava observador, e ele errava as duas coisas: no desktop os meses
   * vêm DOIS POR LINHA, então dois cabeçalhos cruzam o topo ao mesmo tempo e
   * o rótulo ficava com o que chegasse por último — na imagem de
   * verificação, "Julho" enquanto a tela mostrava outubro e novembro. E a
   * sentinela de cima nascia visível, fazendo o calendário crescer para trás
   * antes de a pessoa rolar.
   *
   * Lendo a posição, as duas respostas são a mesma pergunta: onde a rolagem
   * está. O primeiro mês cujo fim ainda não passou do topo é o mês em vista,
   * e chegar a 200px de uma ponta pede mais meses.
   */
  const medir = useCallback(() => {
    const raiz = rolagem.current;
    if (!raiz) return;

    const topo = raiz.getBoundingClientRect().top;
    let emVista: string | null = null;
    for (const no of raiz.querySelectorAll<HTMLElement>("[data-mes]")) {
      const caixa = no.getBoundingClientRect();
      if (caixa.bottom > topo + 8) {
        emVista = no.dataset.mes ?? null;
        break;
      }
    }
    if (emVista) setMesEmVista(emVista);

    if (raiz.scrollTop < 200) {
      setJanela((j) =>
        j.primeiro <= -mesesAtras
          ? j
          : {
              ...j,
              primeiro: Math.max(-mesesAtras, j.primeiro - PASSO_DA_JANELA),
            },
      );
    }
    if (raiz.scrollTop + raiz.clientHeight > raiz.scrollHeight - 200) {
      setJanela((j) =>
        j.ultimo >= mesesAdiante
          ? j
          : {
              ...j,
              ultimo: Math.min(mesesAdiante, j.ultimo + PASSO_DA_JANELA),
            },
      );
    }
  }, [mesesAdiante, mesesAtras]);

  /**
   * Meses que entram POR CIMA empurram o conteúdo para baixo, e a tela salta.
   *
   * O navegador tem `overflow-anchor` para isso, mas ele só age em rolagem do
   * usuário — aqui quem acrescenta o conteúdo somos nós, no mesmo quadro. A
   * conta é direta: o quanto o documento cresceu é o quanto a rolagem precisa
   * descer para a pessoa continuar olhando para o mesmo dia.
   */
  const alturaAnterior = useRef(0);
  useLayoutEffect(() => {
    const raiz = rolagem.current;
    if (!raiz) return;
    const cresceu = raiz.scrollHeight - alturaAnterior.current;
    if (alturaAnterior.current > 0 && cresceu > 0 && raiz.scrollTop < 200) {
      raiz.scrollTop += cresceu;
    }
    alturaAnterior.current = raiz.scrollHeight;
  }, [janela.primeiro]);

  function porTeclado(evento: React.KeyboardEvent<HTMLDivElement>) {
    const foco = document.activeElement as HTMLElement | null;
    const dia = foco?.dataset?.dia;
    if (!dia) return;

    const passos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (evento.key === "Escape") {
      evento.preventDefault();
      aoSelecionar(null, null);
      return;
    }

    if (evento.key === "Enter" || evento.key === " ") return; // o botão resolve

    const passo = passos[evento.key];
    if (passo === undefined) return;
    evento.preventDefault();

    const base = lerData(dia);
    if (!base) return;
    base.setDate(base.getDate() + passo);
    const destino = paraISO(base);

    const alvo = rolagem.current?.querySelector<HTMLElement>(
      `[data-dia="${destino}"]`,
    );
    if (alvo) {
      alvo.focus();
      alvo.scrollIntoView({ block: "nearest" });
    }
  }

  return (
    <div
      className={cn(
        "bg-surface-card overflow-hidden rounded-xl border",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        {/* Faixa de CONTEXTO, e não um segundo título: cada mês já carrega o
            nome dele dentro da rolagem, e os dois em tamanho igual, colados,
            liam como o mesmo título repetido. Aqui ele responde "onde eu
            estou" enquanto se rola, que é outra pergunta. */}
        <p
          className="text-text-secondary text-xs font-semibold tracking-wider uppercase"
          aria-live="polite"
        >
          {format(parseISO(`${mesEmVista}-01`), "MMMM 'de' yyyy", {
            locale: ptBR,
          })}
        </p>
        {/* Sem hoje dentro do intervalo não há para onde ir, e um botão que
            não faz nada é pior que um botão a menos. */}
        {hojeNoIntervalo && (
          <Button variant="outline" size="sm" onClick={irParaHoje}>
            Hoje
          </Button>
        )}
      </div>

      {/* Os nomes dos dias ficam FORA da rolagem: dentro, eles se repetiriam a
          cada mês e a pessoa leria "seg ter qua" quinze vezes descendo. */}
      {/* Os nomes dos dias moram no cabeçalho de CADA MÊS, e não aqui.
          Fixos no topo eles teriam que adivinhar quantos meses cabem na
          linha, e desalinhavam no instante em que a largura mudasse. */}

      <div
        ref={rolagem}
        onKeyDown={porTeclado}
        onScroll={medir}
        className="max-h-[32rem] overflow-y-auto overscroll-contain px-4 py-3"
      >
        {/* DOIS MESES SÓ QUANDO CABEM DOIS. `repeat(auto-fill, minmax(...))`
            pergunta pela largura em vez de pelo breakpoint: a coluna do
            calendário muda de tamanho com o painel ao lado, e um `lg:` fixo
            dava 60px por célula — onde "Marina" virava "Ma…", que não
            identifica ninguém e ainda ocupa a linha. Abaixo de 420px por mês,
            um mês por linha.

            O `min(420px, 100%)` é a parte que não dá para tirar. `minmax(420px,
            1fr)` cria uma faixa que NUNCA encolhe abaixo de 420, então num
            celular de 375 o mês fica mais largo que a tela: sábado e domingo
            saem para fora da borda e os dias 10, 17, 24 e 31 aparecem cortados
            pela metade — um calendário sem fim de semana, sem nada avisando.
            Foi assim que ele saiu na imagem de 375px. */}
        <div
          className="grid gap-x-6 gap-y-5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(min(420px, 100%), 1fr))",
          }}
        >
          {meses.map((mes) => (
            <Mes
              key={mes}
              mes={mes}
              hojeISO={hojeISO}
              inicioSel={inicioSel}
              fimSel={fimSel}
              feriados={feriados}
              bloqueados={bloqueados}
              recusaDoDia={recusaDoDia}
              aoClicar={clicar}
              aoPassar={passarPor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Mes({
  mes,
  hojeISO,
  inicioSel,
  fimSel,
  feriados,
  bloqueados,
  recusaDoDia,
  aoClicar,
  aoPassar,
}: {
  mes: string;
  hojeISO: string;
  inicioSel: string | null;
  fimSel: string | null;
  feriados: Map<string, string>;
  bloqueados: Record<string, string[]>;
  recusaDoDia: RecusaDeDia;
  aoClicar: (dia: string) => void;
  aoPassar: (dia: string) => void;
}) {
  const referencia = parseISO(`${mes}-01`);
  const inicio = startOfMonth(referencia);
  const fim = endOfMonth(referencia);
  const dias = diasEntre(paraISO(inicio), paraISO(fim));
  // Segunda é a primeira coluna: a semana de trabalho começa nela, e o locale
  // pt-BR começa no domingo, que é a convenção de calendário de parede.
  const vazios = (inicio.getDay() + 6) % 7;

  return (
    <section data-mes={mes} className="space-y-2">
      <h3
        data-cabecalho={mes}
        className="text-text-secondary text-sm font-medium first-letter:uppercase"
      >
        {format(inicio, "MMMM 'de' yyyy", { locale: ptBR })}
      </h3>

      <div className="text-text-muted grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: vazios }, (_, i) => (
          <div key={`vazio-${i}`} />
        ))}
        {dias.map((dia) => (
          <Dia
            key={dia}
            dia={dia}
            hoje={dia === hojeISO}
            feriado={feriados.get(dia)}
            quemEstaFora={bloqueados[dia]}
            recusa={recusaDoDia(dia)}
            dentroDaSelecao={Boolean(
              inicioSel && fimSel && dia >= inicioSel && dia <= fimSel,
            )}
            pontaInicial={dia === inicioSel}
            pontaFinal={dia === fimSel}
            aoClicar={aoClicar}
            aoPassar={aoPassar}
          />
        ))}
      </div>
    </section>
  );
}

function Dia({
  dia,
  hoje,
  feriado,
  quemEstaFora,
  recusa,
  dentroDaSelecao,
  pontaInicial,
  pontaFinal,
  aoClicar,
  aoPassar,
}: {
  dia: string;
  hoje: boolean;
  feriado: string | undefined;
  quemEstaFora: string[] | undefined;
  recusa: string | null;
  dentroDaSelecao: boolean;
  pontaInicial: boolean;
  pontaFinal: boolean;
  aoClicar: (dia: string) => void;
  aoPassar: (dia: string) => void;
}) {
  const data = lerData(dia);
  const numero = data ? data.getDate() : 0;
  const fimDeSemana = data ? data.getDay() === 0 || data.getDay() === 6 : false;
  const bloqueado = Boolean(quemEstaFora?.length);

  // O título carrega o motivo inteiro: um dia que recusa sem dizer por quê
  // manda a pessoa clicar de novo, mais forte, e desistir.
  const titulo = [
    format(data ?? new Date(), "dd/MM/yyyy"),
    feriado,
    bloqueado ? `Fora: ${quemEstaFora!.join(", ")}` : null,
    recusa,
  ]
    .filter(Boolean)
    .join(" · ");

  // O PRIMEIRO NOME BASTA, e a lista inteira fica no título. "Gabriela" cabe
  // numa célula; "Gabriela Oliveira, Rafael Antunes" não cabe em nenhuma, e
  // truncar dois nomes no meio não identifica nenhum dos dois.
  const primeiroNome = quemEstaFora?.[0]?.trim().split(/\s+/)[0] ?? "";
  const maisDeUm = (quemEstaFora?.length ?? 0) > 1;

  return (
    <button
      type="button"
      data-dia={dia}
      title={titulo}
      aria-label={titulo}
      aria-pressed={dentroDaSelecao}
      onPointerDown={(e) => {
        e.preventDefault();
        aoClicar(dia);
      }}
      onPointerEnter={() => aoPassar(dia)}
      className={cn(
        // A CÉLULA É ALTA E TEM DUAS LINHAS, e não é decoração: a de baixo
        // carrega o NOME de quem está fora. Antes isso vivia só no `title`, e
        // um tooltip não existe para quem usa toque nem para quem varre a
        // tela com o olho — a pessoa via um quadrado âmbar, não sabia de quem
        // era, e clicava para descobrir.
        "relative flex min-h-14 flex-col items-start justify-between gap-0.5 rounded-lg border px-2 py-1.5 text-left text-sm tabular-nums transition-colors",
        // Fim de semana e feriado continuam PINTADOS dentro do intervalo: a
        // pessoa está fora neles também. O cinza só aparece fora dela.
        !dentroDaSelecao && "bg-surface-card border-border",
        (fimDeSemana || feriado) &&
          !dentroDaSelecao &&
          !bloqueado &&
          "bg-surface-page text-text-muted",
        recusa &&
          !dentroDaSelecao &&
          "text-text-muted cursor-not-allowed opacity-60",
        bloqueado &&
          !dentroDaSelecao &&
          "bg-warning-soft border-warning text-warning",
        dentroDaSelecao && "bg-accent-strong border-accent-strong text-white",
        !dentroDaSelecao && !recusa && !bloqueado && "hover:bg-accent",
        hoje && !dentroDaSelecao && "ring-ring ring-2",
      )}
    >
      <span
        className={cn(
          dentroDaSelecao && (pontaInicial || pontaFinal) && "font-semibold",
        )}
      >
        {numero}
      </span>

      {/* A legenda da célula responde "e daí?" sem clicar: quem está fora,
          que feriado é, ou onde o período começa e acaba. */}
      {dentroDaSelecao && pontaInicial ? (
        <span className="text-[11px] leading-tight opacity-90">início</span>
      ) : dentroDaSelecao && pontaFinal ? (
        <span className="text-[11px] leading-tight opacity-90">fim</span>
      ) : bloqueado && !dentroDaSelecao ? (
        <span className="w-full truncate text-[11px] leading-tight">
          {maisDeUm
            ? `${primeiroNome} +${quemEstaFora!.length - 1}`
            : primeiroNome}
        </span>
      ) : feriado && !dentroDaSelecao ? (
        <span className="text-text-muted w-full truncate text-[11px] leading-tight">
          {feriado}
        </span>
      ) : null}
    </button>
  );
}
