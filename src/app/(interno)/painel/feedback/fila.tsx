"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { LinhaDaFila, RelatorioDeFeedback } from "@/lib/dados/feedback";
import { ROTULOS_DE_STATUS, lerAlertas } from "@/lib/dominio/feedback";
import type { FeedbackPeriodicidade } from "@/lib/supabase/database.types";

import { gerarFeedback } from "./acoes";

/**
 * A FILA DO PERÍODO.
 *
 * **O PERÍODO MORA NA URL**, como todo filtro de listagem do produto: "olha o
 * feedback de abril" precisa ser um link. E ele é o INÍCIO e não um mês solto,
 * porque o trimestral também começa num dia 1 — uma forma serve aos dois.
 *
 * ---------------------------------------------------------------------------
 * **A LISTA DIZ QUEM VAI RECEBER, PELO NOME, ANTES DO CLIQUE.**
 *
 * Um botão que dispara N chamadas de IA e só depois conta quantas foram é um
 * botão que se aperta com medo — e o medo tem razão: cada chamada custa, e o
 * relatório não se desfaz. É a decisão do diálogo de "Pedir as notas do mês"
 * (0066), que conta o que vai junto em vez de perguntar "tem certeza?".
 *
 * A contagem de etapas de cada pessoa vem da MESMA função que a geração usa
 * (`quem_recebe_feedback`), pela razão de `quem_deve_nota()`: duas contas
 * dariam uma lista prometendo cinco e uma geração alcançando quatro.
 * ---------------------------------------------------------------------------
 *
 * **QUEM OPTOU POR NÃO RECEBER NÃO APARECE, nem desligado.** Uma linha cinza
 * com o nome dela contaria à gestão uma escolha pessoal que não decide nada
 * ali.
 */
export function FilaDoFeedback({
  fila,
  relatorios,
  periodo,
  periodicidade,
  minimo,
  temChave,
  selecionado,
}: {
  fila: LinhaDaFila[];
  relatorios: RelatorioDeFeedback[];
  periodo: { inicio: string; fim: string };
  periodicidade: FeedbackPeriodicidade;
  minimo: number;
  temChave: boolean;
  selecionado: string | null;
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [gerando, setGerando] = useState<string | null>(null);

  const porPessoa = new Map(relatorios.map((r) => [r.user_id, r]));

  function irPara(mudancas: Record<string, string | null>) {
    const busca = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) busca.delete(chave);
      else busca.set(chave, valor);
    }
    router.push(`/painel/feedback?${busca.toString()}`);
  }

  async function gerar(userId: string) {
    setGerando(userId);
    await chamarEMostrar(() =>
      gerarFeedback({
        user_id: userId,
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        periodicidade,
      }),
    );
    setGerando(null);
    router.refresh();
  }

  const mesesOferecidos = mesesAnteriores(periodicidade, 12);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            htmlFor="feedback-periodicidade"
            className="text-text-secondary text-xs font-medium"
          >
            Periodicidade
          </label>
          <Select
            value={periodicidade}
            onValueChange={(v) => irPara({ periodicidade: v, periodo: null })}
          >
            <SelectTrigger
              id="feedback-periodicidade"
              className="w-40"
              aria-label="Periodicidade do feedback"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="trimestral">Trimestral</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="feedback-periodo"
            className="text-text-secondary text-xs font-medium"
          >
            Período
          </label>
          <Select
            value={periodo.inicio}
            onValueChange={(v) => irPara({ periodo: v })}
          >
            <SelectTrigger
              id="feedback-periodo"
              className="w-56"
              aria-label="Período do feedback"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mesesOferecidos.map((inicio) => (
                <SelectItem key={inicio} value={inicio}>
                  {rotuloDoPeriodo(inicio, periodicidade)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!temChave ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          A <code>ANTHROPIC_API_KEY</code> não está no ambiente do servidor,
          então o texto não é escrito. As métricas do período continuam sendo
          calculadas e gravadas.
        </p>
      ) : null}

      {fila.length === 0 ? (
        <p className="text-text-muted text-sm">
          Ninguém da equipe está marcado para receber feedback neste período.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {fila.map((linha) => {
            const relatorio = porPessoa.get(linha.userId) ?? null;
            const alertas = relatorio ? lerAlertas(relatorio.alertas_json) : [];
            const poucoDado = linha.concluidas < minimo;

            return (
              <li
                key={linha.userId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-sm font-medium">
                    {linha.nome}
                  </p>
                  <p className="text-text-muted text-xs">
                    {linha.concluidas} etapa(s) concluída(s) no período
                    {poucoDado ? ` · abaixo do mínimo de ${minimo}` : ""}
                    {alertas.length > 0
                      ? ` · ${alertas.length} alerta(s) da verificação`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {relatorio ? (
                    <>
                      {/* O SELO É O DO FEEDBACK e não o `StatusBadge` do
                          produto: aquele conhece os status de task e de etapa, e
                          um de-para entre `feedback_status` e eles seria o lugar
                          onde as duas verdades começam a divergir -- a decisão
                          das colunas do board de etapas. */}
                      <Badge
                        variant={
                          relatorio.status === "enviado"
                            ? "success"
                            : relatorio.status === "descartado" ||
                                relatorio.status === "dados_insuficientes"
                              ? "secondary"
                              : alertas.length > 0
                                ? "warning"
                                : "outline"
                        }
                      >
                        {ROTULOS_DE_STATUS[relatorio.status]}
                      </Badge>
                      <Button
                        size="sm"
                        variant={
                          selecionado === relatorio.id ? "default" : "outline"
                        }
                        onClick={() => irPara({ relatorio: relatorio.id })}
                      >
                        {selecionado === relatorio.id ? "Aberto" : "Abrir"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void gerar(linha.userId)}
                      disabled={gerando !== null}
                    >
                      {gerando === linha.userId ? "Gerando…" : "Gerar"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Os períodos que o seletor oferece: os N fechados mais recentes.
 *
 * **O PERÍODO CORRENTE NÃO ENTRA**, e é a mesma decisão do padrão de 30 dias
 * nas Métricas: no dia 2, "este mês" mede duas etapas e mostra um número que
 * parece medição e é ruído.
 *
 * A conta usa `Date.UTC` e não o fuso do processo: `new Date(ano, mes)` num
 * servidor a leste viraria o mês na virada, e o seletor ofereceria um período
 * diferente do que a tela está mostrando.
 */
function mesesAnteriores(
  periodicidade: FeedbackPeriodicidade,
  quantos: number,
): string[] {
  const hoje = new Date();
  const passo = periodicidade === "trimestral" ? 3 : 1;
  const dois = (n: number) => String(n).padStart(2, "0");

  // O início do período corrente, para começar UM passo antes dele.
  const mesBase =
    periodicidade === "trimestral"
      ? Math.floor(hoje.getUTCMonth() / 3) * 3
      : hoje.getUTCMonth();

  const lista: string[] = [];
  for (let i = 1; i <= quantos; i += 1) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), mesBase - i * passo, 1));
    lista.push(`${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-01`);
  }
  return lista;
}

function rotuloDoPeriodo(
  inicio: string,
  periodicidade: FeedbackPeriodicidade,
): string {
  const d = parseISO(inicio);
  if (periodicidade === "mensal") {
    return format(d, "MMMM 'de' yyyy", { locale: ptBR });
  }
  const trimestre = Math.floor(d.getMonth() / 3) + 1;
  return `${trimestre}º trimestre de ${format(d, "yyyy")}`;
}
