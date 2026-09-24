"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarRange, Loader2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { CalendarioRolavel } from "@/components/shared/calendario-rolavel";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  ROTULOS_DE_STATUS,
  ROTULOS_DE_TIPO,
  bloqueiosNoIntervalo,
  contarDiasDoPedido,
  motivoDoBloqueio,
  rotuloDosDias,
} from "@/lib/dominio/full-days";
import type { HrRequest, HrTipo } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { cancelarSolicitacao, solicitar } from "./acoes";

/**
 * A aba Solicitar: calendário rolável à esquerda, painel de confirmação à
 * direita.
 *
 * **A SELEÇÃO MORA AQUI, e é a correção do bug relatado.** Antes o mês vivia
 * na URL e entrava no `key` do `<Suspense>` da página: trocar de mês
 * desmontava a subárvore e o componente novo nascia com `de` e `ate` em null.
 * Pedir de 28/10 a 03/11 era impossível — a primeira ponta sumia ao virar o
 * mês. Agora não existe virar o mês: `CalendarioRolavel` empilha os meses e
 * rola, recebe a seleção por propriedade e devolve por callback, e nunca é
 * remontado.
 *
 * A conta aparece aqui para mostrar o número enquanto se escolhe — corrido no
 * descanso, dias úteis nos outros dois. O número GRAVADO sai do banco: se
 * viesse desta conta, bastaria alterar o corpo da requisição para pedir 15
 * dias dizendo que são 3.
 */
export function Solicitar({
  solicitacoes,
  feriados,
  bloqueados,
  hojeISO,
  diasFeriasAno,
  maxParcelas,
  usadosNoAno,
  parcelasUsadas,
  minhaArea,
}: {
  solicitacoes: HrRequest[];
  feriados: { data: string; nome: string }[];
  bloqueados: Record<string, string[]>;
  hojeISO: string;
  diasFeriasAno: number;
  maxParcelas: number;
  usadosNoAno: number;
  parcelasUsadas: number;
  minhaArea: string;
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const [de, setDe] = useState<string | null>(null);
  const [ate, setAte] = useState<string | null>(null);
  const [tipo, setTipo] = useState<HrTipo>("ferias");
  const [motivo, setMotivo] = useState("");

  const feriadoDe = useMemo(
    () => new Map(feriados.map((f) => [f.data, f.nome])),
    [feriados],
  );
  const conjuntoDeFeriados = useMemo(
    () => new Set(feriados.map((f) => f.data)),
    [feriados],
  );

  const inicioSel = de;
  const fimSel = ate;

  // A conta MUDA COM O TIPO: o descanso é corrido, os outros dois contam dias
  // úteis. Trocar o tipo com um período já selecionado troca o número na hora,
  // que é onde a pessoa percebe a diferença sem ninguém precisar explicar.
  const diasSelecionados =
    inicioSel && fimSel
      ? contarDiasDoPedido(tipo, inicioSel, fimSel, conjuntoDeFeriados)
      : 0;

  const saldo = diasFeriasAno - usadosNoAno;
  const saldoDepois = tipo === "ferias" ? saldo - diasSelecionados : saldo;

  const excedeSaldo = tipo === "ferias" && diasSelecionados > saldo;
  const semParcela = tipo === "ferias" && parcelasUsadas >= maxParcelas;
  const retroativo = Boolean(inicioSel && inicioSel < hojeISO);

  /**
   * Por que este dia não pode ser escolhido, ou null.
   *
   * **O PASSADO DEPENDE DO TIPO**, e essa é a regra que o calendário não tem
   * como saber sozinho: descanso e afastamento são combinados antes, então
   * para trás não faz sentido; ausência pontual é registrada DEPOIS de
   * acontecer — foi ontem que a pessoa faltou.
   */
  function recusaDoDia(dia: string): string | null {
    const fora = bloqueados[dia];
    if (fora?.length) {
      return `${fora.join(", ")} ${fora.length === 1 ? "está" : "estão"} fora neste dia, e ${
        fora.length === 1 ? "é" : "são"
      } da sua área.`;
    }
    if (dia < hojeISO && tipo !== "ausencia") {
      return `${ROTULOS_DE_TIPO[tipo]} se combina antes. Para registrar um dia que já passou, escolha Ausência pontual.`;
    }
    return null;
  }

  /**
   * A recusa por colega da área, ou string vazia.
   *
   * A PERGUNTA É SOBRE O INTERVALO. Antes a tela olhava dia a dia, e por isso
   * clicar no dia 8 não fazia nada enquanto escolher de 5 a 20 — que passa
   * por cima do 8 — era aceito. Eram duas respostas para a mesma situação,
   * conforme o caminho do clique.
   */
  function recusaDoIntervalo(inicio: string, fim: string): string {
    return motivoDoBloqueio(
      bloqueiosNoIntervalo(inicio, fim, bloqueados),
      minhaArea,
    );
  }

  function limpar() {
    setDe(null);
    setAte(null);
    setMotivo("");
  }

  function enviar() {
    if (!inicioSel || !fimSel) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        solicitar({ tipo, data_inicio: inicioSel, data_fim: fimSel, motivo }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        limpar();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* O SALDO ABRE A TELA NUM BANNER, e não numa frase corrida.
          Ele já abria a tela — a decisão anterior foi tirá-lo da coluna
          lateral, porque era preciso varrer o olho até a direita para achar.
          O que muda agora é o peso: o número é a primeira coisa que quem
          entra aqui quer saber, e um parágrafo o escondia no meio de uma
          explicação sobre dias corridos. A barra dá a mesma resposta pelo
          formato, para quem não lê o número.

          Quem pede afastamento ou ausência pontual não vê saldo nenhum: não
          desconta, e mostrar um número que não muda ensina a ignorá-lo. */}
      {tipo === "ferias" ? (
        <section className="bg-blue-soft flex flex-wrap items-center justify-between gap-6 rounded-xl p-6">
          <div className="min-w-0 space-y-1.5">
            <p className="text-accent-strong text-xs font-semibold tracking-widest uppercase">
              Saldo de descanso do ano
            </p>
            <p className="text-text-primary text-3xl font-semibold tracking-tight">
              Você tem {saldo} de {diasFeriasAno} dias disponíveis
            </p>
            <p className="text-accent-strong text-sm">
              O descanso conta corrido: sair numa sexta e voltar na segunda são
              quatro dias.
            </p>
          </div>

          <div className="bg-surface-card w-full max-w-xs shrink-0 rounded-lg p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-text-secondary text-sm">Usado no ano</span>
              <span className="text-sm font-semibold tabular-nums">
                {diasFeriasAno > 0
                  ? Math.round((usadosNoAno / diasFeriasAno) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-accent-strong h-full rounded-full"
                style={{
                  width: `${diasFeriasAno > 0 ? Math.min(100, Math.round((usadosNoAno / diasFeriasAno) * 100)) : 0}%`,
                }}
              />
            </div>
            <p className="text-text-muted mt-2 text-right text-xs tabular-nums">
              {usadosNoAno} {usadosNoAno === 1 ? "dia" : "dias"} em{" "}
              {parcelasUsadas} de {maxParcelas}{" "}
              {maxParcelas === 1 ? "parcela" : "parcelas"}
            </p>
          </div>
        </section>
      ) : (
        <section className="bg-surface-card rounded-xl border p-5">
          <p className="text-text-secondary text-sm">
            <strong className="text-text-primary font-medium">
              {ROTULOS_DE_TIPO[tipo]}
            </strong>{" "}
            não desconta do seu saldo. Entra na matriz da equipe e no relatório.
          </p>
        </section>
      )}

      {/* CONFIGURAR À ESQUERDA, CALENDÁRIO À DIREITA — a ordem da versão A.
          A inversão não é gosto: o tipo de pedido muda o que o calendário
          significa (descanso conta corrido, os outros contam útil) e muda
          quais dias o passado aceita. Com o seletor à direita, a pessoa
          escolhia as datas primeiro e descobria a regra depois.

          As seções perderam a numeração que a tela tinha. Ela vinha do Nova
          Task, onde as seções são etapas de um formulário que se percorre de
          cima para baixo; aqui são duas colunas lado a lado, e numerar dois
          blocos simultâneos promete uma ordem que a tela não tem. */}
      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="bg-surface-card rounded-card space-y-4 border p-5">
          <h2 className="text-base font-semibold">Configurar pedido</h2>

          {/* TRÊS BOTÕES À VISTA, e não uma lista suspensa. São três opções e
              nunca mais, e cada uma carrega a informação que decide a escolha:
              se desconta do saldo ou não. Dentro de um `select` isso só
              aparecia depois de abrir — e a diferença entre descanso e
              ausência pontual é exatamente essa.

              `radiogroup` e não três botões soltos: o leitor de tela anuncia
              "1 de 3" e a seta move entre eles, que é o comportamento certo
              para escolha única. */}
          <div className="space-y-2">
            <span className="text-text-muted text-xs font-semibold tracking-wider uppercase">
              Tipo de pedido
            </span>
            <div
              role="radiogroup"
              aria-label="Tipo de pedido"
              className="grid grid-cols-3 gap-2"
            >
              {(
                [
                  ["ferias", `desconta (${diasFeriasAno}d)`],
                  ["licenca", "não desconta"],
                  ["ausencia", "não desconta"],
                ] as const
              ).map(([valor, nota]) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={tipo === valor}
                  onClick={() => setTipo(valor)}
                  className={cn(
                    "rounded-lg border px-2 py-2.5 text-center transition-colors",
                    tipo === valor
                      ? "border-accent-strong bg-blue-soft"
                      : "hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "block text-[13px]",
                      tipo === valor ? "font-semibold" : "font-medium",
                    )}
                  >
                    {ROTULOS_DE_TIPO[valor]}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[11px]",
                      tipo === valor ? "text-accent-strong" : "text-text-muted",
                    )}
                  >
                    {nota}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <dl className="space-y-1.5 border-t pt-3 text-sm">
            <Campo
              rotulo="De"
              valor={
                inicioSel ? format(parseISO(inicioSel), "dd/MM/yyyy") : "—"
              }
            />
            <Campo
              rotulo="Até"
              valor={fimSel ? format(parseISO(fimSel), "dd/MM/yyyy") : "—"}
            />
            <Campo
              rotulo={tipo === "ferias" ? "Dias corridos" : "Dias úteis"}
              valor={inicioSel ? String(diasSelecionados) : "—"}
              destaque
            />
            {tipo === "ferias" ? (
              <Campo
                rotulo="Saldo depois"
                valor={`${saldoDepois} de ${diasFeriasAno}`}
                destaque={saldoDepois < 0}
              />
            ) : null}
          </dl>

          {!inicioSel ? (
            <p className="text-text-muted text-xs">
              Nenhum período escolhido ainda. Use o calendário ao lado.
            </p>
          ) : null}

          {retroativo ? (
            <Aviso tom="atencao">
              Este período já começou. Registro do que passou é para ausência
              pontual — o sócio vai ver a data ao responder.
            </Aviso>
          ) : null}

          {excedeSaldo ? (
            <Aviso tom="erro">
              São {diasSelecionados} dias corridos e você tem {saldo} de saldo.
              Escolha um período menor.
            </Aviso>
          ) : null}

          {semParcela ? (
            <Aviso tom="erro">
              O descanso pode ser partido em até {maxParcelas} vezes por ano, e
              você já usou as {maxParcelas}.
            </Aviso>
          ) : null}

          <div className="space-y-2 border-t pt-3">
            <Label htmlFor="fd-motivo" className="text-text-secondary text-xs">
              Observação (opcional)
            </Label>
            <Textarea
              id="fd-motivo"
              rows={3}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Algo que o sócio deva saber sobre este período?"
            />
          </div>

          <div className="flex gap-2">
            {inicioSel ? (
              <Button
                variant="outline"
                size="sm"
                onClick={limpar}
                disabled={enviando}
              >
                <X aria-hidden />
                Limpar
              </Button>
            ) : null}
            <Button
              className="flex-1"
              disabled={
                enviando ||
                !inicioSel ||
                diasSelecionados === 0 ||
                excedeSaldo ||
                semParcela
              }
              onClick={enviar}
            >
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Enviar pedido
            </Button>
          </div>
        </aside>

        <section className="min-w-0">
          {/* A instrução fica COLADA NO CALENDÁRIO, onde a mão está: seleção
            por intervalo não se explica sozinha, e quem nunca usou clica
            num dia, vê um quadrado azul e não descobre que falta o segundo
            clique. A segunda frase é nova e responde à pergunta que gerou
            este ajuste — sim, dá para atravessar o mês. */}
          <p className="text-text-muted mb-3 text-xs">
            Clique na data inicial e depois na final — ou arraste de uma até a
            outra. Role para alcançar os outros meses: a seleção não se perde.
          </p>

          <CalendarioRolavel
            de={de}
            ate={ate}
            aoSelecionar={(novoDe, novoAte) => {
              setDe(novoDe);
              setAte(novoAte);
            }}
            hojeISO={hojeISO}
            feriados={feriadoDe}
            bloqueados={bloqueados}
            recusaDoDia={recusaDoDia}
            recusaDoIntervalo={recusaDoIntervalo}
            aoRecusar={(frase) => toast.error(frase)}
          />

          <ul className="text-text-secondary mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <li className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="bg-accent-strong size-3 rounded-sm"
              />
              Selecionado
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="bg-warning-soft border-warning size-3 rounded-sm border"
              />
              Alguém da sua área está fora
            </li>
          </ul>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Meus períodos</h2>

        {solicitacoes.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Você ainda não pediu nada"
            description="Escolha um período no calendário acima e envie. Os sócios são avisados na hora."
          />
        ) : (
          <ul className="space-y-2">
            {solicitacoes.map((pedido) => (
              <li
                key={pedido.id}
                className="bg-surface-card rounded-card flex flex-wrap items-center gap-3 border p-3"
              >
                <Badge variant="outline">{ROTULOS_DE_TIPO[pedido.tipo]}</Badge>

                <span className="text-sm tabular-nums">
                  {format(parseISO(pedido.data_inicio), "dd/MM/yy")} a{" "}
                  {format(parseISO(pedido.data_fim), "dd/MM/yy")}
                </span>

                <span className="text-text-muted text-xs">
                  {rotuloDosDias(pedido.tipo, pedido.dias_uteis)}
                </span>

                <SeloDeStatus status={pedido.status} />

                <span className="text-text-muted ml-auto text-xs tabular-nums">
                  pedido em {format(parseISO(pedido.created_at), "dd/MM/yy")}
                </span>

                {pedido.status === "pendente" ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm">
                        Cancelar
                      </Button>
                    }
                    title="Cancelar este pedido?"
                    description="Ele sai da fila dos sócios e o saldo volta para você."
                    confirmLabel="Cancelar pedido"
                    destructive
                    onConfirm={async () => {
                      const resultado = await chamarAcao(() =>
                        cancelarSolicitacao(pedido.id),
                      );
                      if (!resultado.ok) toast.error(resultado.error);
                      else {
                        toast.success(resultado.mensagem);
                        router.refresh();
                      }
                    }}
                  />
                ) : null}

                {pedido.status === "reprovada" && pedido.motivo_reprovacao ? (
                  <p className="text-text-secondary w-full text-sm">
                    Motivo: {pedido.motivo_reprovacao}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-text-muted text-xs">{rotulo}</dt>
      <dd className={cn("tabular-nums", destaque && "font-semibold")}>
        {valor}
      </dd>
    </div>
  );
}

function Aviso({
  tom,
  children,
}: {
  tom: "erro" | "atencao";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-md p-2.5 text-xs",
        tom === "erro"
          ? "bg-danger-soft text-danger"
          : "bg-warning-soft text-warning",
      )}
    >
      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function SeloDeStatus({ status }: { status: HrRequest["status"] }) {
  const classe =
    status === "aprovada"
      ? "bg-success-soft text-success"
      : status === "reprovada"
        ? "bg-danger-soft text-danger"
        : status === "cancelada"
          ? "bg-neutral-soft text-muted-foreground"
          : "bg-warning-soft text-warning";

  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", classe)}>
      {ROTULOS_DE_STATUS[status]}
    </span>
  );
}
