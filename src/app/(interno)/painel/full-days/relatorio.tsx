"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contarDiasUteis } from "@/lib/dominio/full-days";
import type { LinhaDoRelatorio } from "@/lib/dados/full-days";
import { cn } from "@/lib/utils";

const TODAS = "__todas__";

/**
 * O relatório gerencial.
 *
 * O ALERTA DE FÉRIAS VENCENDO vem antes da tabela, e não como mais uma coluna
 * dentro dela: passados 12 meses da admissão (ou das últimas férias) sem o
 * descanso, a empresa passa a dever em dobro. É risco trabalhista, não
 * organização — uma coluna a mais numa tabela de nove colunas não seria lida.
 */
export function RelatorioGerencial({
  linhas,
  pendentes,
  inicio,
  fim,
  mes,
  feriados,
  hojeISO,
}: {
  linhas: LinhaDoRelatorio[];
  pendentes: number;
  inicio: string;
  fim: string;
  mes: string;
  feriados: string[];
  hojeISO: string;
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [area, setArea] = useState(TODAS);

  const areas = [...new Set(linhas.map((l) => l.area))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visiveis = area === TODAS ? linhas : linhas.filter((l) => l.area === area);

  const contratadas = visiveis.reduce((t, l) => t + l.diasFeriasAno, 0);
  const tiradas = visiveis.reduce((t, l) => t + l.tiradas, 0);
  const ausencias = visiveis.reduce((t, l) => t + l.ausencias, 0);
  const licencas = visiveis.reduce((t, l) => t + l.licencas, 0);

  // Taxa de ausência: dias de ausência sobre a capacidade do período. A
  // capacidade é dias úteis vezes pessoas — sem multiplicar pelas pessoas, uma
  // ausência de 5 dias num time de dez viraria "25% do time fora".
  const uteis = contarDiasUteis(inicio, fim, new Set(feriados));
  const capacidade = uteis * visiveis.length;
  const taxa = capacidade > 0 ? (ausencias / capacidade) * 100 : 0;

  const foraHoje = visiveis.filter(
    (l) => l.ultimasFerias !== null && l.ultimasFerias >= hojeISO,
  ).length;

  const vencendo = visiveis.filter((l) => l.vencendo);

  function irParaMes(passo: number) {
    const [ano, mesNumero] = mes.split("-").map(Number);
    const destinoData = new Date(ano, mesNumero - 1 + passo, 1);
    const destino = new URLSearchParams(parametros.toString());
    destino.set("mes", format(destinoData, "yyyy-MM"));
    router.push(`?${destino.toString()}`);
  }

  function exportar() {
    const cabecalho = [
      "Pessoa", "Área", "Dias no ano", "Tiradas", "Agendadas", "Pendentes",
      "Saldo", "Ausências no período", "Licenças no período", "Meses sem férias",
    ];
    const corpo = visiveis.map((l) => [
      l.nome, l.area, l.diasFeriasAno, l.tiradas, l.agendadas, l.pendentes,
      l.saldo, l.ausencias, l.licencas, l.mesesSemFerias ?? "—",
    ]);
    const texto = [cabecalho, ...corpo]
      .map((celulas) => celulas.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const arquivo = new Blob([`﻿${texto}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = `full-days-relatorio-${mes}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => irParaMes(-1)}>
          <ChevronLeft aria-hidden />
        </Button>
        {/* first-letter, e não capitalize: este maiúsculiza cada palavra e
            produziria "Setembro De 2026". */}
        <p className="text-sm font-medium first-letter:uppercase">
          {format(parseISO(inicio), "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
        <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => irParaMes(1)}>
          <ChevronRight aria-hidden />
        </Button>

        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-48" aria-label="Filtrar por área">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="ml-auto" onClick={exportar}>
          <Download aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Férias no ano"
          valor={`${tiradas} de ${contratadas}`}
          apoio="dias tirados, do total contratado"
        />
        <Indicador
          titulo="Taxa de ausência"
          valor={`${taxa.toFixed(1)}%`}
          apoio={`${ausencias} dia(s) sobre ${capacidade} de capacidade`}
        />
        <Indicador
          titulo="Esperando decisão"
          valor={String(pendentes)}
          apoio={pendentes === 1 ? "solicitação" : "solicitações"}
        />
        <Indicador
          titulo="Licenças no período"
          valor={String(licencas)}
          apoio={`e ${foraHoje} pessoa(s) em férias agora`}
        />
      </div>

      {vencendo.length > 0 ? (
        <section className="bg-danger-soft rounded-card border p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle aria-hidden className="text-danger mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-danger text-sm font-semibold">
                Férias vencendo — {vencendo.length} pessoa(s)
              </h2>
              <p className="text-text-secondary mt-0.5 text-sm">
                Passados 12 meses sem descanso, a empresa passa a dever as férias em dobro. Não é
                uma questão de organização.
              </p>
              <ul className="mt-2 space-y-0.5">
                {vencendo.map((l) => (
                  <li key={l.id} className="text-text-primary text-sm">
                    <strong>{l.nome}</strong> — {l.mesesSemFerias} meses desde{" "}
                    {l.ultimasFerias
                      ? `as últimas férias (${format(parseISO(l.ultimasFerias), "dd/MM/yyyy")})`
                      : l.admissao
                        ? `a admissão (${format(parseISO(l.admissao), "dd/MM/yyyy")})`
                        : "o início"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <div className="rounded-card overflow-x-auto border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Área</TableHead>
              <TableHead className="text-right">No ano</TableHead>
              <TableHead className="text-right">Tiradas</TableHead>
              <TableHead className="text-right">Agendadas</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="w-32">Consumo</TableHead>
              <TableHead className="text-right">Ausências</TableHead>
              <TableHead className="text-right">Licenças</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground text-center">
                  Ninguém nesta área.
                </TableCell>
              </TableRow>
            ) : (
              visiveis.map((linha) => {
                const usados = linha.tiradas + linha.agendadas + linha.pendentes;
                const proporcao =
                  linha.diasFeriasAno > 0
                    ? Math.min(100, Math.round((usados / linha.diasFeriasAno) * 100))
                    : 0;

                return (
                  <TableRow key={linha.id}>
                    <TableCell className="font-medium">
                      {linha.nome}
                      {linha.vencendo ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          vencendo
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{linha.area}</TableCell>
                    <TableCell className="text-right tabular-nums">{linha.diasFeriasAno}</TableCell>
                    <TableCell className="text-right tabular-nums">{linha.tiradas}</TableCell>
                    <TableCell className="text-right tabular-nums">{linha.agendadas}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        linha.saldo <= 0 && "text-muted-foreground",
                      )}
                    >
                      {linha.saldo}
                    </TableCell>
                    <TableCell>
                      <div
                        className="bg-neutral-soft h-2 w-full overflow-hidden rounded-full"
                        role="img"
                        aria-label={`${proporcao}% das férias comprometidas`}
                      >
                        <div
                          className={cn("h-full rounded-full", proporcao >= 100 ? "bg-warning" : "bg-ferias")}
                          style={{ width: `${proporcao}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{linha.ausencias}</TableCell>
                    <TableCell className="text-right tabular-nums">{linha.licencas}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Indicador({ titulo, valor, apoio }: { titulo: string; valor: string; apoio: string }) {
  return (
    <div className="bg-surface-card rounded-card border p-4">
      <p className="text-text-muted text-xs font-medium tracking-wide uppercase">{titulo}</p>
      <p className="text-text-primary mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-text-muted mt-0.5 text-xs">{apoio}</p>
    </div>
  );
}
