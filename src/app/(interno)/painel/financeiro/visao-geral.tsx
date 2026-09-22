"use client";

import { parseISO } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarClock, FileWarning, TrendingUp } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { GraficoDeBarras } from "@/components/shared/grafico-de-barras";
import { GraficoDeLinhas } from "@/components/shared/grafico-de-linhas";
import { SeletorDeMes } from "@/components/shared/seletor-de-mes";
import { Badge } from "@/components/ui/badge";
import type { VisaoGeral } from "@/lib/dados/financeiro";
import { formatarDinheiro, formatarDinheiroCurto } from "@/lib/dominio/financeiro";
import { cn } from "@/lib/utils";

/**
 * A visão geral do mês.
 *
 * PREVISTO E REALIZADO APARECEM JUNTOS, sempre. Um cartão de receita sozinho
 * responde à pergunta errada: "quanto a agência faturou" e "quanto entrou na
 * conta" são números diferentes no dia 10, e é a diferença entre os dois que
 * diz se está faltando cobrar alguém.
 */
export function VisaoGeralDoFinanceiro({
  dados,
  hojeISO,
}: {
  dados: VisaoGeral;
  hojeISO: string;
}) {
  return (
    <div className="space-y-6">
      <SeletorDeMes competencia={dados.competencia} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao
          rotulo="Receita do mês"
          valor={dados.receitaRealizada}
          apoio={`de ${formatarDinheiro(dados.receitaPrevista)} previstos`}
          proporcao={dados.receitaPrevista > 0 ? dados.receitaRealizada / dados.receitaPrevista : null}
        />
        <Cartao
          rotulo="Despesas do mês"
          valor={dados.despesaRealizada}
          apoio={`de ${formatarDinheiro(dados.despesaPrevista)} previstas`}
          proporcao={dados.despesaPrevista > 0 ? dados.despesaRealizada / dados.despesaPrevista : null}
        />
        <Cartao
          rotulo="Resultado do mês"
          valor={dados.resultadoRealizado}
          apoio={`${formatarDinheiro(dados.resultadoPrevisto)} previsto`}
          /* O resultado é o único cartão que muda de cor com o sinal: aqui
             negativo é de fato um alerta, e não só um fato do mês. */
          colorirPeloSinal
        />
        <Cartao
          rotulo="Em atraso"
          valor={dados.inadimplencia}
          apoio={
            dados.quantosInadimplentes === 0
              ? "nenhum título vencido"
              : `${dados.quantosInadimplentes} título(s) vencido(s), de qualquer mês`
          }
          alerta={dados.inadimplencia > 0}
        />
      </div>

      <section className="bg-surface-card rounded-card border p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-text-primary text-sm font-semibold">Receita e despesa, 12 meses</h2>
          <p className="text-text-muted flex items-center gap-1.5 text-xs">
            <TrendingUp aria-hidden className="size-3.5" />
            Receita recorrente contratada: {formatarDinheiro(dados.receitaRecorrente)}/mês
          </p>
        </div>

        <GraficoDeLinhas
          pontos={dados.serie.map((ponto) => ({
            rotulo: format(parseISO(ponto.competencia), "MMM", { locale: ptBR }),
            valores: [ponto.receita, ponto.despesa] as [number, number],
          }))}
          series={["Receita", "Despesa"]}
          formatarValor={formatarDinheiroCurto}
        />

        {/* A visão em tabela existe porque o gráfico não pode ser a única
            porta para o número: quem usa leitor de tela, quem imprime e quem
            só quer conferir um mês chegam por aqui. */}
        <details className="mt-3">
          <summary className="text-text-secondary cursor-pointer text-xs">
            Ver os números em tabela
          </summary>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-text-muted text-left">
                <th className="py-1 font-medium">Mês</th>
                <th className="py-1 text-right font-medium">Receita</th>
                <th className="py-1 text-right font-medium">Despesa</th>
                <th className="py-1 text-right font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {dados.serie.map((ponto) => (
                <tr key={ponto.competencia} className="border-t">
                  <td className="py-1 first-letter:uppercase">
                    {format(parseISO(ponto.competencia), "MMM/yy", { locale: ptBR })}
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatarDinheiro(ponto.receita)}</td>
                  <td className="py-1 text-right tabular-nums">{formatarDinheiro(ponto.despesa)}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatarDinheiro(ponto.receita - ponto.despesa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-surface-card rounded-card border p-4">
          <h2 className="text-text-primary mb-3 text-sm font-semibold">
            Receita por cliente no mês
          </h2>
          <GraficoDeBarras barras={dados.porCliente} formatarValor={formatarDinheiro} />
        </section>

        <section className="bg-surface-card rounded-card border p-4">
          <h2 className="text-text-primary mb-3 text-sm font-semibold">O que pede atenção</h2>

          {dados.alertas.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nada vencendo nem vencido"
              description="Nenhum título nos próximos 7 dias e nenhum contrato terminando em 60."
            />
          ) : (
            <ul className="divide-y">
              {dados.alertas.map((alerta, i) => (
                <li key={`${alerta.tipo}-${alerta.data}-${i}`} className="flex items-start gap-3 py-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 shrink-0",
                      alerta.tipo === "atrasado" ? "text-danger" : "text-text-muted",
                    )}
                  >
                    {alerta.tipo === "atrasado" ? (
                      <AlertTriangle className="size-4" />
                    ) : alerta.tipo === "contrato-terminando" ? (
                      <FileWarning className="size-4" />
                    ) : (
                      <CalendarClock className="size-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary truncate text-sm">{alerta.titulo}</p>
                    <p className="text-text-muted text-xs">{alerta.detalhe}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-text-primary text-sm tabular-nums">
                      {formatarDinheiro(alerta.valor)}
                    </p>
                    {alerta.tipo === "atrasado" ? (
                      <Badge variant="outline" className="bg-danger-soft text-danger mt-0.5 border-0">
                        Atrasado
                      </Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="text-text-muted mt-3 text-xs">
            Situação calculada em {format(parseISO(hojeISO), "dd/MM/yyyy", { locale: ptBR })}.
          </p>
        </section>
      </div>
    </div>
  );
}

/**
 * Um número em destaque, com o previsto de apoio.
 *
 * A barrinha fina de proporção existe porque "R$ 18.400 de R$ 32.000" é uma
 * fração que a pessoa calcula de cabeça toda vez; uma linha resolve de
 * relance. É um medidor contra um limite — não um gráfico de uma barra só.
 */
function Cartao({
  rotulo,
  valor,
  apoio,
  proporcao,
  colorirPeloSinal,
  alerta,
}: {
  rotulo: string;
  valor: number;
  apoio: string;
  proporcao?: number | null;
  colorirPeloSinal?: boolean;
  alerta?: boolean;
}) {
  return (
    <div className="bg-surface-card rounded-card border p-4">
      <p className="text-text-muted text-xs">{rotulo}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          colorirPeloSinal && valor < 0 && "text-danger",
          colorirPeloSinal && valor >= 0 && "text-success",
          alerta && valor > 0 && "text-danger",
          !colorirPeloSinal && !alerta && "text-text-primary",
        )}
      >
        {formatarDinheiro(valor)}
      </p>
      <p className="text-text-muted mt-1 text-xs">{apoio}</p>

      {proporcao !== null && proporcao !== undefined ? (
        <span className="bg-neutral-soft mt-2 block h-1.5 w-full overflow-hidden rounded-full">
          <span
            className="bg-serie-1 block h-full rounded-full"
            style={{ width: `${Math.min(Math.max(proporcao, 0), 1) * 100}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}
