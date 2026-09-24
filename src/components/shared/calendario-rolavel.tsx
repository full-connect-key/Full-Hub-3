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
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { diasEntre, lerData, ordenar, paraISO } from "@/lib/dominio/full-days";
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
  mesesAdiante = 12,
  mesesAtras = 3,
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
  /** Quantos meses depois do corrente a rolagem alcança. */
  mesesAdiante?: number;
  /** Quantos meses antes. Três no pedido; vinte e quatro no lançamento. */
  mesesAtras?: number;
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

  // Quantos meses, para frente e para trás do corrente, estão montados. Cresce
  // conforme a pessoa chega na ponta: montar trinta e sete meses de uma vez
  // são mil e quinhentos botões que ninguém vai olhar.
  //
  // ABRE EM ZERO, no mês corrente. A primeira versão abria em -1 e a sentinela
  // de cima já nascia visível: o calendário crescia para trás sozinho na
  // montagem e a tela abria em julho, três meses antes de hoje. Quem entra
  // para pedir descanso quer ver o mês que vem, não o que passou.
  const [janela, setJanela] = useState({ primeiro: 0, ultimo: 2 });
  const [mesEmVista, setMesEmVista] = useState(hojeISO.slice(0, 7));

  const hoje = useMemo(
    () => startOfMonth(parseISO(`${hojeISO.slice(0, 7)}-01`)),
    [hojeISO],
  );

  const meses = useMemo(() => {
    const lista: string[] = [];
    for (let i = janela.primeiro; i <= janela.ultimo; i++) {
      lista.push(format(addMonths(hoje, i), "yyyy-MM"));
    }
    return lista;
  }, [hoje, janela]);

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
        <p
          className="text-sm font-medium first-letter:uppercase"
          aria-live="polite"
        >
          {format(parseISO(`${mesEmVista}-01`), "MMMM 'de' yyyy", {
            locale: ptBR,
          })}
        </p>
        <Button variant="outline" size="sm" onClick={irParaHoje}>
          Hoje
        </Button>
      </div>

      {/* Os nomes dos dias ficam FORA da rolagem: dentro, eles se repetiriam a
          cada mês e a pessoa leria "seg ter qua" quinze vezes descendo. */}
      <div className="text-text-muted grid grid-cols-7 gap-1 border-b px-4 py-2 text-center text-xs lg:grid-cols-14">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => (
          <div key={d}>{d}</div>
        ))}
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => (
          <div key={`${d}-2`} className="hidden lg:block">
            {d}
          </div>
        ))}
      </div>

      <div
        ref={rolagem}
        onKeyDown={porTeclado}
        onScroll={medir}
        className="max-h-[26rem] overflow-y-auto overscroll-contain px-4 py-3"
      >
        <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
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

      <div className="grid grid-cols-7 gap-1">
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
        "relative flex h-9 items-center justify-center rounded-md border border-transparent text-sm tabular-nums transition-colors",
        // Fim de semana e feriado continuam PINTADOS dentro do intervalo: a
        // pessoa está fora neles também. O listrado só aparece fora dela.
        (fimDeSemana || feriado) && !dentroDaSelecao && "text-text-muted",
        recusa &&
          !dentroDaSelecao &&
          "text-text-muted cursor-not-allowed opacity-60",
        bloqueado && !dentroDaSelecao && "bg-warning-soft text-warning",
        dentroDaSelecao && "bg-accent-strong border-accent-strong text-white",
        dentroDaSelecao && (pontaInicial || pontaFinal) && "font-semibold",
        !dentroDaSelecao && !recusa && !bloqueado && "hover:bg-accent",
        hoje && !dentroDaSelecao && "ring-ring ring-2",
      )}
    >
      {numero}
    </button>
  );
}
