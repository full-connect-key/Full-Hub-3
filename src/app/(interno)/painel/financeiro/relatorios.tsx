"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Info } from "lucide-react";

import { GraficoDeBarras } from "@/components/shared/grafico-de-barras";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { DRE, RentabilidadeDoCliente } from "@/lib/dados/financeiro";
import { formatarDinheiro, montarCSV } from "@/lib/dominio/financeiro";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { cn } from "@/lib/utils";

import { baixar } from "./lancamentos";

/**
 * DRE simplificado e rentabilidade por cliente.
 *
 * A RENTABILIDADE É O INDICADOR QUE MOSTRA QUAL CONTA DÁ LUCRO, e ela cruza a
 * receita do período com as HORAS DAS SUBTAREFAS daquele cliente — não com um
 * campo da task. Desde o Sprint 3B quem tem tempo é a subtarefa
 * (`tempo_real_minutos`); a task perdeu `tempo_real_horas` de propósito, e
 * ressuscitá-la traria um número zerado com cara de medição.
 *
 * Cliente sem hora lançada aparece com um travessão, nunca com zero: zero é
 * uma afirmação sobre a conta ("não deu trabalho"), e o que se quer dizer é
 * "ninguém registrou o tempo".
 */
export function Relatorios({
  dre,
  rentabilidade,
  de,
  ate,
}: {
  dre: DRE;
  rentabilidade: RentabilidadeDoCliente[];
  de: string;
  ate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  function mudarPeriodo(chave: "de" | "ate", valor: string) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set(chave, valor);
    router.replace(`${pathname}?${destino.toString()}`, { scroll: false });
  }

  function exportarDRE() {
    const csv = montarCSV(
      ["grupo", "categoria", "valor"],
      [
        ...dre.receitas.map((l) => ["Receita", l.categoria, l.valor.toFixed(2).replace(".", ",")]),
        ...dre.despesas.map((l) => ["Despesa", l.categoria, l.valor.toFixed(2).replace(".", ",")]),
        ["Total", "Receitas", dre.totalReceitas.toFixed(2).replace(".", ",")],
        ["Total", "Despesas", dre.totalDespesas.toFixed(2).replace(".", ",")],
        ["Total", "Resultado", dre.resultado.toFixed(2).replace(".", ",")],
      ],
    );
    baixar(csv, `dre-${de.slice(0, 7)}-a-${ate.slice(0, 7)}.csv`);
  }

  function exportarRentabilidade() {
    const csv = montarCSV(
      ["cliente", "receita", "horas", "receita_por_hora"],
      rentabilidade.map((r) => [
        r.nome,
        r.receita.toFixed(2).replace(".", ","),
        (r.minutos / 60).toFixed(2).replace(".", ","),
        r.receitaPorHora !== null ? r.receitaPorHora.toFixed(2).replace(".", ",") : "",
      ]),
    );
    baixar(csv, `rentabilidade-${de.slice(0, 7)}-a-${ate.slice(0, 7)}.csv`);
  }

  const comHoras = rentabilidade.filter((r) => r.receitaPorHora !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rel-de" className="text-xs">
            De
          </Label>
          <Input
            id="rel-de"
            type="month"
            className="w-40"
            value={de.slice(0, 7)}
            onChange={(e) => mudarPeriodo("de", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rel-ate" className="text-xs">
            Até
          </Label>
          <Input
            id="rel-ate"
            type="month"
            className="w-40"
            value={ate.slice(0, 7)}
            onChange={(e) => mudarPeriodo("ate", e.target.value)}
          />
        </div>
        <p className="text-text-muted pb-2 text-xs">
          Por competência — o mês a que o valor se refere.
        </p>
      </div>

      {/* --- DRE --- */}
      <section className="bg-surface-card rounded-card border p-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-text-primary text-sm font-semibold">Resultado do período</h2>
            <p className="text-text-muted text-xs first-letter:uppercase">
              {format(parseISO(de), "MMM/yy", { locale: ptBR })} a{" "}
              {format(parseISO(ate), "MMM/yy", { locale: ptBR })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportarDRE}>
            <Download aria-hidden />
            Exportar CSV
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GrupoDoDRE titulo="Receitas" linhas={dre.receitas} total={dre.totalReceitas} cor="serie-1" />
          <GrupoDoDRE titulo="Despesas" linhas={dre.despesas} total={dre.totalDespesas} cor="serie-2" />
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
          <p className="text-text-primary text-sm font-semibold">Resultado</p>
          <p
            className={cn(
              "text-xl font-semibold tabular-nums",
              dre.resultado < 0 ? "text-danger" : "text-success",
            )}
          >
            {formatarDinheiro(dre.resultado)}
          </p>
        </div>
      </section>

      {/* --- Rentabilidade --- */}
      <section className="bg-surface-card rounded-card border p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-text-primary text-sm font-semibold">Rentabilidade por cliente</h2>
          </div>
          <Button variant="outline" size="sm" onClick={exportarRentabilidade}>
            <Download aria-hidden />
            Exportar CSV
          </Button>
        </div>

        {rentabilidade.length === 0 ? (
          <p className="text-text-muted rounded-card border border-dashed p-8 text-center text-sm">
            Nenhuma receita nem hora registrada neste período.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted border-b text-left">
                    <th className="py-2 font-medium">Cliente</th>
                    <th className="py-2 text-right font-medium">Receita</th>
                    <th className="py-2 text-right font-medium">Horas</th>
                    <th className="py-2 text-right font-medium">Receita por hora</th>
                  </tr>
                </thead>
                <tbody>
                  {rentabilidade.map((linha) => (
                    <tr key={linha.clientId ?? linha.nome} className="border-b last:border-0">
                      <td className="py-2">{linha.nome}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatarDinheiro(linha.receita)}
                      </td>
                      <td className="text-text-secondary py-2 text-right tabular-nums">
                        {linha.minutos > 0 ? formatarMinutos(linha.minutos) : "—"}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {linha.receitaPorHora !== null ? (
                          formatarDinheiro(linha.receitaPorHora)
                        ) : (
                          <span className="text-text-muted font-normal">sem hora registrada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {comHoras.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-text-muted mb-3 text-xs font-semibold tracking-wide uppercase">
                  Receita por hora, do maior para o menor
                </h3>
                <GraficoDeBarras
                  barras={comHoras.map((r) => ({ nome: r.nome, valor: r.receitaPorHora! }))}
                  formatarValor={formatarDinheiro}
                />
              </div>
            ) : null}

            <p className="text-text-muted mt-4 flex items-start gap-1.5 text-xs">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              As horas vêm das etapas concluídas com tempo registrado, contadas pela data de
              conclusão. Registrar o tempo ao concluir é opcional, então um cliente pode aparecer
              sem horas mesmo tendo dado trabalho.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function GrupoDoDRE({
  titulo,
  linhas,
  total,
  cor,
}: {
  titulo: string;
  linhas: { categoria: string; valor: number }[];
  total: number;
  cor: "serie-1" | "serie-2";
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">{titulo}</h3>
        <p className="text-text-primary text-sm font-semibold tabular-nums">
          {formatarDinheiro(total)}
        </p>
      </div>

      {linhas.length === 0 ? (
        <p className="text-text-muted text-sm">Nada lançado no período.</p>
      ) : (
        <GraficoDeBarras
          barras={linhas.map((l) => ({ nome: l.categoria, valor: l.valor }))}
          formatarValor={formatarDinheiro}
          cor={cor}
        />
      )}
    </div>
  );
}
