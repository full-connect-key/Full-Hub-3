"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CircleAlert,
  Copy,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  ROTULOS_DE_FREQUENCIA,
  ROTULOS_DE_MODO,
  DIAS_DA_SEMANA,
} from "@/lib/dominio/recorrencias";
import type { RecorrenciaNaTela } from "@/lib/dados/recorrencias";

import {
  alternarRecorrencia,
  apagarRecorrencia,
  duplicarRecorrencia,
  gerarAgora,
} from "../acoes-de-recorrencia";

const TODOS = "__todos__";

/** As três situações que a lista separa. Ver **A situação, e por que são três**. */
export type Situacao = "ativas" | "pausadas" | "com_erro";

export const ROTULOS_DE_SITUACAO: Record<Situacao, string> = {
  ativas: "Ativas",
  pausadas: "Pausadas",
  com_erro: "Com erro",
};

/**
 * A cadência, em uma linha.
 *
 * "Semanal" sozinho não diz em que dia, e é justamente o que alguém abre a
 * lista para conferir — uma regra configurada no domingo errado só aparece na
 * madrugada seguinte.
 */
export function descreverCadencia(regra: RecorrenciaNaTela): string {
  if (regra.frequencia === "mensal") {
    return `Todo dia ${regra.dia_mes ?? 1} do mês`;
  }
  const dias = regra.dias_semana ?? [];
  const nomes = DIAS_DA_SEMANA.filter((d) => dias.includes(d.valor)).map((d) => d.curto);
  const quando = nomes.length > 0 ? nomes.join(", ") : "todos os dias";

  if (regra.frequencia === "diaria") return quando;
  if (regra.frequencia === "quinzenal") return `De 15 em 15 dias (${quando})`;
  return nomes.length > 0 ? `Toda semana: ${quando}` : "De 7 em 7 dias";
}

function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  return format(parseISO(iso.slice(0, 10)), "dd/MM/yyyy", { locale: ptBR });
}

export function ListaDeRecorrencias({
  regras,
  clientes,
  podeConfigurar,
}: {
  regras: RecorrenciaNaTela[];
  clientes: { id: string; nome_empresa: string }[];
  /**
   * `is_atendimento()`, respondido pelo servidor. A lista é de `is_staff()` —
   * quem não configura ainda precisa saber que a demanda de amanhã nasce
   * sozinha, senão vai abri-la à mão.
   */
  podeConfigurar: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const [emAcao, setEmAcao] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const situacao = (parametros.get("situacao") ?? TODOS) as Situacao | typeof TODOS;
  const cliente = parametros.get("cliente") ?? TODOS;
  const modo = parametros.get("modo") ?? TODOS;

  function trocarFiltro(chave: string, valor: string) {
    const destino = new URLSearchParams(parametros.toString());
    if (valor === TODOS) destino.delete(chave);
    else destino.set(chave, valor);
    router.push(`${pathname}?${destino.toString()}`, { scroll: false });
  }

  async function rodar(id: string, tarefa: () => Promise<unknown>) {
    setEmAcao(id);
    try {
      await tarefa();
    } finally {
      setEmAcao(null);
    }
  }

  async function alternar(regra: RecorrenciaNaTela) {
    await rodar(regra.id, async () => {
      const r = await chamarAcao(() => alternarRecorrencia(regra.id, !regra.ativo));
      if (r.ok) {
        toast.success(r.mensagem);
        iniciar(() => router.refresh());
      } else {
        toast.error(r.error);
      }
    });
  }

  async function gerar(regra: RecorrenciaNaTela) {
    await rodar(regra.id, async () => {
      const r = await chamarAcao(() => gerarAgora(regra.id));
      if (r.ok) {
        toast.success(r.mensagem);
        iniciar(() => router.refresh());
      } else {
        toast.error(r.error);
      }
    });
  }

  async function duplicar(regra: RecorrenciaNaTela) {
    await rodar(regra.id, async () => {
      const r = await chamarAcao(() => duplicarRecorrencia(regra.id));
      if (r.ok) {
        toast.success(r.mensagem);
        router.push(`${pathname}?aba=recorrencias&regra=${r.dados}`);
      } else {
        toast.error(r.error);
      }
    });
  }

  async function apagar(regra: RecorrenciaNaTela) {
    await rodar(regra.id, async () => {
      const r = await chamarAcao(() => apagarRecorrencia(regra.id));
      if (r.ok) {
        toast.success(r.mensagem);
        iniciar(() => router.refresh());
      } else {
        toast.error(r.error);
      }
    });
  }

  const visiveis = regras.filter((r) => {
    if (situacao === "ativas" && !r.ativo) return false;
    if (situacao === "pausadas" && r.ativo) return false;
    if (situacao === "com_erro" && r.errosRecentes === 0) return false;
    if (cliente !== TODOS && r.client_id !== cliente) return false;
    if (modo !== TODOS && r.modo !== modo) return false;
    return true;
  });

  const temFiltro = situacao !== TODOS || cliente !== TODOS || modo !== TODOS;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select
            value={situacao}
            onValueChange={(v) => trocarFiltro("situacao", v)}
          >
            <SelectTrigger className="w-44" aria-label="Situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as situações</SelectItem>
              {(Object.keys(ROTULOS_DE_SITUACAO) as Situacao[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {ROTULOS_DE_SITUACAO[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cliente} onValueChange={(v) => trocarFiltro("cliente", v)}>
            <SelectTrigger className="w-52" aria-label="Cliente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os clientes</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modo} onValueChange={(v) => trocarFiltro("modo", v)}>
            <SelectTrigger className="w-64" aria-label="Modo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Os dois modos</SelectItem>
              <SelectItem value="mensal_agrupada">
                {ROTULOS_DE_MODO.mensal_agrupada}
              </SelectItem>
              <SelectItem value="task_por_ocorrencia">
                {ROTULOS_DE_MODO.task_por_ocorrencia}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {podeConfigurar ? (
          <Button asChild>
            <Link href={`${pathname}?aba=recorrencias&regra=nova`}>
              <Plus aria-hidden className="size-4" />
              Nova recorrência
            </Link>
          </Button>
        ) : null}
      </div>

      {visiveis.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={temFiltro ? "Nenhuma regra com esses filtros" : "Nenhuma demanda recorrente"}
          description={
            temFiltro
              ? "Tire um filtro para ver o resto."
              : "Uma recorrência abre a demanda sozinha, na data — o stories de toda segunda, o relatório de todo dia 5. Nada é gerado para trás: a primeira sai da próxima data que a regra alcançar."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visiveis.map((regra) => {
            const ocupada = emAcao === regra.id || pendente;
            return (
              <li
                key={regra.id}
                className="border-border bg-surface-card rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-text-primary font-medium">{regra.nome}</h3>
                      {regra.ativo ? (
                        <Badge variant="outline">Ativa</Badge>
                      ) : (
                        <Badge className="bg-muted text-text-secondary">Pausada</Badge>
                      )}
                      {regra.errosRecentes > 0 ? (
                        <Badge className="bg-danger-soft text-danger gap-1">
                          <CircleAlert aria-hidden className="size-3" />
                          {regra.errosRecentes} de 3 falharam
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-text-secondary text-sm">
                      {regra.cliente} · {descreverCadencia(regra)} ·{" "}
                      {ROTULOS_DE_FREQUENCIA[regra.frequencia]}
                    </p>

                    <p className="text-text-muted text-xs">
                      {ROTULOS_DE_MODO[regra.modo]}
                      {regra.gerar_como_rascunho ? " · nasce como rascunho" : ""}
                      {regra.pular_feriados ? " · pula feriado" : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {podeConfigurar ? (
                      <>
                        {/* SOME NA REGRA PAUSADA, e o banco recusa junto
                            (0041): oferecer "Gerar agora" ao lado de "Nada
                            mais é gerado até você retomar" é a tela
                            desmentindo a si mesma. */}
                        {regra.ativo ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={ocupada}
                            onClick={() => gerar(regra)}
                          >
                            {ocupada ? (
                              <Loader2 aria-hidden className="size-4 animate-spin" />
                            ) : (
                              <Zap aria-hidden className="size-4" />
                            )}
                            Gerar agora
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={ocupada}
                          onClick={() => alternar(regra)}
                        >
                          {regra.ativo ? (
                            <Pause aria-hidden className="size-4" />
                          ) : (
                            <Play aria-hidden className="size-4" />
                          )}
                          {regra.ativo ? "Pausar" : "Retomar"}
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`${pathname}?aba=recorrencias&regra=${regra.id}`}>
                            <Pencil aria-hidden className="size-4" />
                            Editar
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={ocupada}
                          onClick={() => duplicar(regra)}
                          aria-label={`Duplicar ${regra.nome}`}
                        >
                          <Copy aria-hidden className="size-4" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={ocupada}
                              aria-label={`Excluir ${regra.nome}`}
                            >
                              <Trash2 aria-hidden className="size-4" />
                            </Button>
                          }
                          title="Excluir esta recorrência?"
                          // A FRASE DIZ O QUE **NÃO** ACONTECE, porque é a
                          // dúvida de quem clica: apagar a regra não apaga as
                          // demandas que ela já abriu — elas têm comentário,
                          // tempo lançado e aprovação.
                          description={`"${regra.nome}" para de gerar a partir de agora. As ${regra.geradas} demandas que ela já abriu continuam onde estão, com tudo o que foi feito nelas.`}
                          confirmLabel="Excluir a regra"
                          destructive
                          onConfirm={() => apagar(regra)}
                        />
                      </>
                    ) : null}
                  </div>
                </div>

                <dl className="border-border text-text-secondary mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t pt-3 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-text-muted">Próxima geração</dt>
                    {/* SEM `DateBadge`: esta data não é prazo a vencer, e
                        pintá-la de vermelho ao passar diria "atrasada" sobre
                        uma regra que gerou no dia certo. */}
                    <dd className="font-medium tabular-nums">
                      {regra.ativo ? dataCurta(regra.proxima_geracao_em) : "pausada"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Última</dt>
                    <dd className="tabular-nums">{dataCurta(regra.ultima_geracao_em)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Já geradas</dt>
                    <dd className="tabular-nums">{regra.geradas}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Configurada por</dt>
                    <dd className="truncate">{regra.criadoPor ?? "—"}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}
