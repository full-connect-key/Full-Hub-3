"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Loader2, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { CalendarioRolavel } from "@/components/shared/calendario-rolavel";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
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
import { chamarAcao } from "@/lib/acoes/cliente";
import type { LancamentoNaTela, PessoaDoTime } from "@/lib/dados/full-days";
import {
  ROTULOS_DE_TIPO,
  contarDiasDoPedido,
  rotuloDosDias,
} from "@/lib/dominio/full-days";
import type { HrTipo } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { apagarLancamento, corrigirLancamento, lancarPeriodo } from "./acoes";

/**
 * Registrar um período que JÁ ACONTECEU, em nome de outra pessoa.
 *
 * **Esta aba é da gestão, e só dela.** Quem decide é `QUEM_VE` em `page.tsx`,
 * a mesma constante que monta a barra de abas: não existe o caso de a aba
 * aparecer e a tela recusar, nem o contrário. Digitar `?aba=lancamentos` sem
 * ser gestão devolve 403; montar a chamada à mão esbarra em `is_gestor()`
 * dentro de `lancar_periodo()` e na policy de INSERT de `hr_requests`.
 *
 * **Por que não passa pela fila.** O período já ocorreu — perguntar "de
 * acordo?" sobre a semana passada é teatro: não há decisão a tomar, há um
 * fato a registrar. O registro nasce `aprovada`, com `origem =
 * 'lancamento_retroativo'`, e pinta a matriz na mesma transação.
 *
 * **E ele desconta saldo como qualquer outro.** É o ponto inteiro: sem isto,
 * quem tirou dez dias em janeiro, antes de o Full Hub existir, aparece com os
 * quinze disponíveis em outubro. O número gravado sai de `dias_do_pedido()`
 * no banco, não da conta desta tela — aqui ela existe para mostrar o número
 * enquanto a pessoa escolhe.
 *
 * **O que fica de fora, e é decisão:** importar planilha. O histórico que a
 * agência tem cabe em algumas dezenas de linhas, e uma importação sem
 * pré-visualização grava trinta registros errados de uma vez. Se vier, vem
 * com a tela de conferência junto.
 */
export function Lancamentos({
  lancamentos,
  time,
  feriados,
  hojeISO,
}: {
  lancamentos: LancamentoNaTela[];
  time: PessoaDoTime[];
  feriados: { data: string; nome: string }[];
  hojeISO: string;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();

  const [editando, setEditando] = useState<string | null>(null);
  const [pessoa, setPessoa] = useState<string>("");
  const [tipo, setTipo] = useState<HrTipo>("ferias");
  const [de, setDe] = useState<string | null>(null);
  const [ate, setAte] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");

  const feriadoDe = useMemo(
    () => new Map(feriados.map((f) => [f.data, f.nome])),
    [feriados],
  );
  const conjuntoDeFeriados = useMemo(
    () => new Set(feriados.map((f) => f.data)),
    [feriados],
  );

  const dias =
    de && ate ? contarDiasDoPedido(tipo, de, ate, conjuntoDeFeriados) : 0;

  const alvo = time.find((p) => p.id === pessoa) ?? null;

  /**
   * O calendário aqui recusa o FUTURO, e é o espelho exato da aba de propor —
   * lá o passado é que é recusado para descanso e afastamento.
   *
   * O motivo não é simetria: é que um registro nasce aprovado, sem ninguém
   * responder. Para um período que ainda não aconteceu a decisão AINDA EXISTE
   * — cobrir a ausência, remarcar —, e ela é do sócio, na fila. Lançar para
   * frente seria pular a única pergunta que o módulo existe para fazer.
   *
   * **É guarda de tela, e não vale como trava:** `lancar_periodo()` não olha
   * data. Quem chamar a função direto grava um período futuro do mesmo jeito.
   * Se um dia isso precisar ser trava, é um `if` dentro da função, não mais
   * um `if` aqui.
   *
   * E não há bloqueio por área: dois designers fora na mesma semana do ano
   * passado é um fato, não um conflito a evitar.
   */
  function recusaDoDia(dia: string): string | null {
    if (dia > hojeISO) {
      return "Aqui se registra o que já aconteceu. Período que ainda vem é proposto pela pessoa, e o sócio responde.";
    }
    return null;
  }

  function limpar() {
    setEditando(null);
    setPessoa("");
    setTipo("ferias");
    setDe(null);
    setAte(null);
    setObservacao("");
  }

  function editar(lancamento: LancamentoNaTela) {
    setEditando(lancamento.id);
    setPessoa(lancamento.user_id);
    setTipo(lancamento.tipo);
    setDe(lancamento.data_inicio);
    setAte(lancamento.data_fim);
    setObservacao(lancamento.motivo ?? "");
  }

  function gravar() {
    if (!pessoa || !de || !ate) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        editando
          ? corrigirLancamento({
              id: editando,
              tipo,
              data_inicio: de,
              data_fim: ate,
              observacao,
            })
          : lancarPeriodo({
              user_id: pessoa,
              tipo,
              data_inicio: de,
              data_fim: ate,
              observacao,
            }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        limpar();
        router.refresh();
      }
    });
  }

  function apagar(id: string) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => apagarLancamento(id));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        if (editando === id) limpar();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* A FAIXA DIZ PARA QUE SERVE, e não é enfeite: esta é a única tela do
          produto onde alguém escreve no saldo de outra pessoa. Quem abre sem
          saber disso acha que é mais um formulário de pedido. */}
      <section className="bg-warning-soft text-warning rounded-xl p-6">
        <p className="text-xs font-semibold tracking-widest uppercase">
          Registro de período que já aconteceu
        </p>
        <p className="text-text-primary mt-1.5 text-2xl font-semibold tracking-tight">
          Isto grava no saldo de outra pessoa, e não passa pela fila
        </p>
        <p className="mt-1.5 text-sm">
          É o caminho para o histórico anterior ao Full Hub, e para o período
          combinado por fora. Nasce como acertado, aparece na matriz da equipe
          e desconta o saldo do ano — quem propõe o próprio período continua
          usando a aba Propor período.
        </p>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="bg-surface-card rounded-xl border p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">
              {editando ? "Corrigir registro" : "Novo registro"}
            </h2>
            {editando ? (
              <Button variant="ghost" size="sm" onClick={limpar}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lanc-pessoa">De quem é o período</Label>
              {/* A PESSOA NÃO TROCA NA CORREÇÃO. Mudar o dono de um registro
                  já gravado seria apagar os dias de um e pintar os de outro
                  numa ação chamada "corrigir" — e `corrigir_lancamento()` nem
                  aceita o parâmetro. Trocou de pessoa: apaga e lança de novo. */}
              <Select
                value={pessoa}
                onValueChange={setPessoa}
                disabled={Boolean(editando)}
              >
                <SelectTrigger id="lanc-pessoa" className="w-full">
                  <SelectValue placeholder="Escolha alguém da equipe" />
                </SelectTrigger>
                <SelectContent>
                  {time.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {p.area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-text-muted text-xs font-semibold tracking-wider uppercase">
                Tipo de período
              </span>
              <div
                role="radiogroup"
                aria-label="Tipo de período"
                className="grid grid-cols-3 gap-2"
              >
                {(
                  [
                    ["ferias", "desconta saldo"],
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
                        tipo === valor
                          ? "text-accent-strong"
                          : "text-text-muted",
                      )}
                    >
                      {nota}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <dl className="space-y-1.5 border-t pt-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-secondary">De</dt>
                <dd className="font-medium tabular-nums">
                  {de ? format(parseISO(de), "dd/MM/yyyy") : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-secondary">Até</dt>
                <dd className="font-medium tabular-nums">
                  {ate ? format(parseISO(ate), "dd/MM/yyyy") : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-secondary">
                  {tipo === "ferias" ? "Dias corridos" : "Dias úteis"}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {de && ate ? dias : "—"}
                </dd>
              </div>
            </dl>

            {!de ? (
              <p className="text-text-muted text-xs">
                Nenhum período escolhido ainda. Use o calendário ao lado.
              </p>
            ) : null}

            {tipo === "ferias" && alvo ? (
              <p className="text-text-muted text-xs">
                {alvo.nome} tem {alvo.diasFeriasAno} dias de descanso por ano.
                Este registro desconta {dias || 0} deles.
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="lanc-obs">Observação (opcional)</Label>
              <Textarea
                id="lanc-obs"
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="De onde veio este registro? (planilha de 2025, combinado por mensagem…)"
              />
            </div>

            <Button
              className="w-full"
              disabled={!pessoa || !de || !ate || salvando}
              onClick={gravar}
            >
              {salvando ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              {editando ? "Salvar correção" : "Registrar período"}
            </Button>
          </div>
        </aside>

        <section className="min-w-0">
          <p className="text-text-muted mb-3 text-xs">
            Clique na data inicial e depois na final — ou arraste de uma até a
            outra. O calendário vai de janeiro de 2025 até hoje.
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
            bloqueados={{}}
            recusaDoDia={recusaDoDia}
            recusaDoIntervalo={() => ""}
            aoRecusar={(frase) => toast.error(frase)}
          />
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold">Períodos registrados</h2>

        {lancamentos.length === 0 ? (
          <EmptyState
            icon={TriangleAlert}
            title="Nenhum período registrado ainda"
            description="O que aparece aqui é só o que a gestão lançou. Pedido que a pessoa propôs fica na aba Pedidos da equipe."
          />
        ) : (
          <ul className="space-y-2">
            {lancamentos.map((item) => (
              <li
                key={item.id}
                className="bg-surface-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-4"
              >
                <UserAvatar
                  name={item.pessoa?.nome ?? "—"}
                  src={item.pessoa?.avatarUrl ?? null}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.pessoa?.nome ?? "Pessoa removida"}
                  </p>
                  <p className="text-text-muted text-xs">
                    {item.lancadoPor
                      ? `registrado por ${item.lancadoPor}`
                      : "registrado pela gestão"}
                    {item.origem === "importacao" ? " · importação" : ""}
                  </p>
                </div>

                <Badge variant="outline">{ROTULOS_DE_TIPO[item.tipo]}</Badge>

                <span className="text-sm tabular-nums">
                  {format(parseISO(item.data_inicio), "dd/MM/yy")} a{" "}
                  {format(parseISO(item.data_fim), "dd/MM/yy")}
                </span>

                <span className="text-text-secondary text-xs">
                  {rotuloDosDias(item.tipo, item.dias_uteis)}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editar(item)}
                  >
                    <Pencil aria-hidden className="size-4" />
                    Corrigir
                  </Button>
                  {/* APAGAR E NÃO DESATIVAR, ao contrário de pessoa e de
                      cliente: aqui não há histórico a preservar. Um registro
                      errado é um fato que não aconteceu, e deixá-lo marcado
                      como cancelado seria deixar um dia pintado na matriz de
                      alguém que trabalhou naquele dia. */}
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Trash2 aria-hidden className="size-4" />
                        <span className="sr-only">
                          Apagar o registro de {item.pessoa?.nome ?? "—"}
                        </span>
                      </Button>
                    }
                    title="Apagar este registro?"
                    description={`O período de ${item.pessoa?.nome ?? "—"} sai da matriz da equipe e o saldo dele volta. Não há como desfazer.`}
                    confirmLabel="Apagar"
                    destructive
                    onConfirm={() => apagar(item.id)}
                  />
                </div>

                {item.motivo ? (
                  <p className="text-text-secondary w-full border-t pt-2 text-sm">
                    {item.motivo}
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
