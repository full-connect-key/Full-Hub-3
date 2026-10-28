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
  avisoDoDiaEscolhido,
  rotuloDoMotivo,
  type DiaDeDisponibilidade,
} from "@/lib/dominio/disponibilidade";
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
 * **O DIA SE EXPLICA EMBAIXO DA GRADE.** A célula tem cerca de 62px num painel
 * de 512px: cabe o número e um fio de carga, e mais nada — nem um título de
 * etapa truncado, que não identifica nenhuma. O detalhe fica numa faixa logo
 * abaixo, onde há largura para o cliente e os minutos.
 */

type Props = {
  /** Quem vai receber o trabalho. */
  userId: string;
  nome: string;
  /** O prazo gravado hoje, em ISO. É ele que a grade marca. */
  prazo: string | null;
  /** Grava o prazo. A faixa não sabe como — ela devolve a data escolhida. */
  aoEscolher: (data: string) => void;
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

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function FaixaDeDisponibilidade({
  userId,
  nome,
  prazo,
  aoEscolher,
  buscar,
  rotuloDoClique = "Clicar num dia escreve o prazo da etapa.",
}: Props) {
  // O MÊS ABRE NO DO PRAZO quando há um, e no corrente quando não há: quem
  // está mexendo numa etapa já datada quer ver aquele mês, não este.
  const [ancora, setAncora] = useState(() =>
    startOfMonth(prazo ? parseISO(prazo) : new Date()),
  );
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

  const inicio = format(ancora, "yyyy-MM-dd");
  const fim = format(endOfMonth(ancora), "yyyy-MM-dd");

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
  const chave = `${userId}|${inicio}|${fim}|${tentativa}`;
  const buscando = carregado !== chave;

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const r = await chamarAcao(() => buscar(userId, inicio, fim));
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
  }, [userId, inicio, fim, buscar, chave]);

  const porData = useMemo(() => {
    const mapa = new Map<string, DiaDeDisponibilidade>();
    for (const d of dias ?? []) mapa.set(d.data, d);
    return mapa;
  }, [dias]);

  const celulas = useMemo(() => montarGrade(ancora), [ancora]);
  const escolhido = prazo ? porData.get(prazo) : undefined;

  const aviso = escolhido
    ? avisoDoDiaEscolhido(
        escolhido,
        nome.split(" ")[0],
        format(parseISO(escolhido.data), "d 'de' MMMM", { locale: ptBR }),
      )
    : null;

  return (
    <div className="space-y-3 rounded-xl border p-3">
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
        <div className={cn("grid grid-cols-7 gap-0.5", buscando && "opacity-60")}>
          {celulas.map((celula) => {
            const dia = porData.get(celula.iso);
            return (
              <Celula
                key={celula.iso}
                iso={celula.iso}
                numero={celula.numero}
                doMes={celula.doMes}
                dia={dia}
                escolhido={prazo === celula.iso}
                aoEscolher={aoEscolher}
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

      {escolhido ? <DiaEscolhido dia={escolhido} /> : null}

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
  escolhido,
  aoEscolher,
}: {
  iso: string;
  numero: number;
  doMes: boolean;
  dia: DiaDeDisponibilidade | undefined;
  escolhido: boolean;
  aoEscolher: (data: string) => void;
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

  return (
    <button
      type="button"
      aria-pressed={escolhido}
      aria-label={partes.join(", ")}
      title={partes.join(" · ")}
      onClick={() => aoEscolher(iso)}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-transparent py-1.5 hover:border-input",
        escolhido && "border-accent-strong bg-accent",
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
          (!doMes || semCapacidade) && "text-muted-foreground",
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
