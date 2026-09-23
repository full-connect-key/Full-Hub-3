"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SecaoDoFormulario } from "@/components/shared/secao-do-formulario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  ROTULOS_DE_STATUS,
  ROTULOS_DE_TIPO,
  bloqueiosNoIntervalo,
  contarDiasUteis,
  diasEntre,
  lerData,
  motivoDoBloqueio,
  ordenar,
  paraISO,
} from "@/lib/dominio/full-days";
import type { HrRequest, HrTipo } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { cancelarSolicitacao, solicitar } from "./acoes";

/**
 * O calendário de seleção.
 *
 * Substituiu a lista de datas do módulo antigo por um motivo simples: pedir
 * descanso é escolher um pedaço do calendário, e digitar duas datas num campo
 * obriga a pessoa a abrir um calendário de verdade em outra janela para saber
 * se o dia 14 cai numa sexta.
 *
 * **Dia bloqueado mostra de QUEM é o bloqueio.** "Afastado" sem nome é uma
 * recusa que a pessoa não tem como contornar nem entender — com o nome, ela
 * fala com o colega e os dois se organizam, que é o resultado que interessa.
 *
 * A seleção conta dias úteis aqui, para mostrar o número enquanto se arrasta.
 * O número GRAVADO sai do banco: se viesse desta conta, bastaria alterar o
 * corpo da requisição para pedir 15 dias dizendo que são 3.
 */
export function Solicitar({
  solicitacoes,
  feriados,
  bloqueados,
  hojeISO,
  mes,
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
  mes: string;
  diasFeriasAno: number;
  maxParcelas: number;
  usadosNoAno: number;
  parcelasUsadas: number;
  minhaArea: string;
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [enviando, iniciar] = useTransition();

  const [de, setDe] = useState<string | null>(null);
  const [ate, setAte] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [tipo, setTipo] = useState<HrTipo>("ferias");
  const [motivo, setMotivo] = useState("");

  const feriadoDe = useMemo(() => new Map(feriados.map((f) => [f.data, f.nome])), [feriados]);
  const conjuntoDeFeriados = useMemo(() => new Set(feriados.map((f) => f.data)), [feriados]);

  const referencia = parseISO(`${mes}-01`);
  const inicioDoMes = startOfMonth(referencia);
  const fimDoMes = endOfMonth(referencia);

  const [inicioSel, fimSel] = de && ate ? ordenar(de, ate) : de ? [de, de] : [null, null];
  const uteisSelecionados =
    inicioSel && fimSel ? contarDiasUteis(inicioSel, fimSel, conjuntoDeFeriados) : 0;

  const saldo = diasFeriasAno - usadosNoAno;
  const saldoDepois = tipo === "ferias" ? saldo - uteisSelecionados : saldo;

  const excedeSaldo = tipo === "ferias" && uteisSelecionados > saldo;
  const semParcela = tipo === "ferias" && parcelasUsadas >= maxParcelas;

  /**
   * A recusa por colega da área, ou string vazia.
   *
   * A PERGUNTA É SOBRE O INTERVALO. Antes a tela olhava dia a dia, e por isso
   * clicar no dia 8 não fazia nada enquanto escolher de 5 a 20 — que passa
   * por cima do 8 — era aceito. Eram duas respostas para a mesma situação,
   * conforme o caminho do clique.
   */
  function recusaDoIntervalo(de: string, ate: string): string {
    return motivoDoBloqueio(bloqueiosNoIntervalo(de, ate, bloqueados), minhaArea);
  }

  function irParaMes(passo: number) {
    const [ano, mesNumero] = mes.split("-").map(Number);
    const destinoData = new Date(ano, mesNumero - 1 + passo, 1);
    const destino = new URLSearchParams(parametros.toString());
    destino.set("mes", format(destinoData, "yyyy-MM"));
    router.push(`?${destino.toString()}`);
  }

  function clicar(dia: string) {
    // O dia em si. A recusa DIZ POR QUE: um clique que não faz nada e não
    // explica manda a pessoa clicar de novo, mais forte, e desistir.
    const noDia = recusaDoIntervalo(dia, dia);
    if (noDia) {
      toast.error(noDia);
      return;
    }

    if (!de || (de && ate)) {
      setDe(dia);
      setAte(null);
      setArrastando(true);
      return;
    }

    // O segundo clique fecha o intervalo, e é aqui que o período pode
    // atravessar um bloqueio sem que nenhuma das pontas esteja bloqueada.
    const noIntervalo = recusaDoIntervalo(de, dia);
    if (noIntervalo) {
      toast.error(noIntervalo);
      return;
    }

    setAte(dia);
    setArrastando(false);
  }

  function passarPor(dia: string) {
    if (!arrastando || !de) return;
    // Arrastando, a recusa é SILENCIOSA: a seleção simplesmente não passa do
    // bloqueio. Um toast por movimento do mouse empilharia dez avisos iguais
    // antes de a pessoa soltar o botão — quem larga em cima do dia bloqueado
    // recebe a explicação pelo clique.
    if (recusaDoIntervalo(de, dia)) return;
    setAte(dia);
  }

  function limpar() {
    setDe(null);
    setAte(null);
    setArrastando(false);
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

  const dias = diasEntre(paraISO(inicioDoMes), paraISO(fimDoMes));
  // Quantos quadrados em branco antes do dia 1, para a coluna bater com o dia
  // da semana. Segunda é a primeira coluna.
  const vazios = (inicioDoMes.getDay() + 6) % 7;

  return (
    <div className="space-y-8">
      {/* O SALDO ABRE A TELA, e não fica no painel da direita.
          É a primeira coisa que quem entra aqui quer saber, e era preciso
          varrer o olho até a coluna lateral para achar. Para quem pede
          afastamento ou ausência pontual ele não conta, e some. */}
      {tipo === "ferias" ? (
        <p className="text-text-secondary text-sm">
          Você tem <strong className="text-text-primary tabular-nums">{saldo} dias</strong> de{" "}
          {diasFeriasAno} disponíveis este ano, em até {maxParcelas} vezes — você já usou{" "}
          {parcelasUsadas} de {maxParcelas}.
        </p>
      ) : (
        <p className="text-text-secondary text-sm">
          {ROTULOS_DE_TIPO[tipo]} não desconta do seu saldo. Entra na matriz da equipe e no
          relatório.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <SecaoDoFormulario
          numero={1}
          titulo="Escolha as datas"
          acao={
            <div className="flex items-center gap-2">
              <Label htmlFor="fd-tipo" className="text-text-secondary text-xs font-normal">
                Tipo de pedido
              </Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as HrTipo)}>
                <SelectTrigger id="fd-tipo" size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ferias">Descanso</SelectItem>
                  <SelectItem value="licenca">Afastamento</SelectItem>
                  <SelectItem value="ausencia">Ausência pontual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
        <section className="bg-surface-card rounded-card border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => irParaMes(-1)}>
              <ChevronLeft aria-hidden />
            </Button>
            {/* first-letter, e não capitalize — veja o calendário de tasks. */}
            <p className="flex-1 text-center text-sm font-medium first-letter:uppercase">
              {format(inicioDoMes, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => irParaMes(1)}>
              <ChevronRight aria-hidden />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1" onMouseLeave={() => setArrastando(false)}>
            {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((nome) => (
              <div key={nome} className="text-text-muted pb-1 text-center text-[11px] font-medium">
                {nome}
              </div>
            ))}

            {Array.from({ length: vazios }, (_, i) => (
              <div key={`vazio-${i}`} />
            ))}

            {dias.map((dia) => (
              <Dia
                key={dia}
                dia={dia}
                hojeISO={hojeISO}
                feriado={feriadoDe.get(dia) ?? null}
                bloqueadoPor={bloqueados[dia] ?? []}
                dentroDaSelecao={Boolean(inicioSel && fimSel && dia >= inicioSel && dia <= fimSel)}
                aoClicar={clicar}
                aoPassar={passarPor}
              />
            ))}
          </div>

          <ul className="text-text-secondary mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="bg-accent-strong size-3 rounded-sm" />
              Selecionado
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="bg-danger-soft border-danger size-3 rounded-sm border" />
              Bloqueado: alguém da sua área está fora
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="listrado size-3 rounded-sm" />
              Feriado ou fim de semana
            </li>
          </ul>

          {/* A instrução fica NO PÉ DO CALENDÁRIO, onde a mão está.
              Um calendário de seleção por intervalo não se explica sozinho:
              quem nunca usou clica num dia, vê um quadrado azul e não
              descobre que falta o segundo clique. */}
          <p className="text-text-muted mt-3 border-t pt-3 text-xs">
            Clique na data inicial e depois na final.
          </p>
        </section>
        </SecaoDoFormulario>

        <div className="space-y-6">
        <SecaoDoFormulario numero={2} titulo="Período selecionado">
        <aside className="bg-surface-card rounded-card h-fit space-y-4 border p-4">
          <dl className="space-y-1.5 text-sm">
            <Campo rotulo="De" valor={inicioSel ? format(parseISO(inicioSel), "dd/MM/yyyy") : "—"} />
            <Campo rotulo="Até" valor={fimSel ? format(parseISO(fimSel), "dd/MM/yyyy") : "—"} />
            <Campo
              rotulo="Dias úteis"
              valor={inicioSel ? String(uteisSelecionados) : "—"}
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

          {excedeSaldo ? (
            <Aviso tom="erro">
              São {uteisSelecionados} dias e você tem {saldo} de saldo. Escolha um período menor.
            </Aviso>
          ) : null}

          {semParcela ? (
            <Aviso tom="erro">
              O descanso pode ser partido em até {maxParcelas} vezes por ano, e você já usou as{" "}
              {maxParcelas}.
            </Aviso>
          ) : null}

        </aside>
        </SecaoDoFormulario>

        <SecaoDoFormulario numero={3} titulo="Observação (opcional)">
        <aside className="bg-surface-card rounded-card h-fit space-y-4 border p-4">
          <div className="space-y-2">
            <Label htmlFor="fd-motivo" className="sr-only">
              Observação
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
              <Button variant="outline" size="sm" onClick={limpar} disabled={enviando}>
                <X aria-hidden />
                Limpar
              </Button>
            ) : null}
            <Button
              className="flex-1"
              disabled={enviando || !inicioSel || uteisSelecionados === 0 || excedeSaldo || semParcela}
              onClick={enviar}
            >
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Enviar pedido
            </Button>
          </div>
        </aside>
        </SecaoDoFormulario>
        </div>
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
                  {pedido.dias_uteis} dia{pedido.dias_uteis === 1 ? "" : "s"} útil
                  {pedido.dias_uteis === 1 ? "" : "eis"}
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
                      const resultado = await chamarAcao(() => cancelarSolicitacao(pedido.id));
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

function Dia({
  dia,
  hojeISO,
  feriado,
  bloqueadoPor,
  dentroDaSelecao,
  aoClicar,
  aoPassar,
}: {
  dia: string;
  hojeISO: string;
  feriado: string | null;
  bloqueadoPor: string[];
  dentroDaSelecao: boolean;
  aoClicar: (dia: string) => void;
  aoPassar: (dia: string) => void;
}) {
  const data = lerData(dia);
  const fimDeSemana = data?.getDay() === 0 || data?.getDay() === 6;
  const naoUtil = fimDeSemana || feriado !== null;
  const bloqueado = bloqueadoPor.length > 0;
  const hoje = dia === hojeISO;

  const botao = (
    <button
      type="button"
      disabled={bloqueado}
      onMouseDown={() => aoClicar(dia)}
      onMouseEnter={() => aoPassar(dia)}
      aria-label={`${format(parseISO(dia), "d 'de' MMMM", { locale: ptBR })}${
        feriado ? ` — ${feriado}` : ""
      }${bloqueado ? ` — ${bloqueadoPor.join(", ")} fora` : ""}`}
      aria-pressed={dentroDaSelecao}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-md border text-sm tabular-nums transition-colors",
        naoUtil && !dentroDaSelecao && "listrado text-text-muted",
        bloqueado && "bg-danger-soft border-danger text-danger cursor-not-allowed",
        dentroDaSelecao && "bg-accent-strong border-accent-strong text-white font-medium",
        !dentroDaSelecao && !bloqueado && !naoUtil && "hover:bg-accent",
        hoje && !dentroDaSelecao && "ring-ring ring-2",
      )}
    >
      {format(parseISO(dia), "d")}
    </button>
  );

  if (!feriado && !bloqueado) return botao;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{botao}</TooltipTrigger>
      <TooltipContent>
        {feriado ? <span className="block">{feriado}</span> : null}
        {bloqueado ? (
          <span className="block">
            {bloqueadoPor.join(", ")} {bloqueadoPor.length === 1 ? "está" : "estão"} fora
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
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
      <dd className={cn("tabular-nums", destaque && "font-semibold")}>{valor}</dd>
    </div>
  );
}

function Aviso({ tom, children }: { tom: "erro" | "atencao"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-md p-2.5 text-xs",
        tom === "erro" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
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
