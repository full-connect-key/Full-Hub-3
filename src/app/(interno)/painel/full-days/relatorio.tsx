"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { baixarCSV, montarCSV } from "@/lib/dominio/csv";
import { contarDiasUteis } from "@/lib/dominio/full-days";
import type { LinhaDoRelatorio } from "@/lib/dados/full-days";
import { cn } from "@/lib/utils";

const TODAS = "__todas__";

/**
 * O relatório gerencial.
 *
 * O ALERTA DE QUEM ESTÁ HÁ MUITO TEMPO SEM DESCANSO vem antes da tabela, e não
 * como mais uma coluna dentro dela: alguém que não para há mais de um ano é
 * um problema de capacidade e de saúde, e uma coluna a mais numa tabela de
 * nove colunas não seria lida.
 *
 * ESTE TEXTO JÁ FOI OUTRO, e a versão anterior era o problema. Ela afirmava
 * na tela que, passados 12 meses sem descanso, a empresa passava a dever em
 * dobro — o art. 137 da CLT escrito dentro de um produto usado por uma equipe
 * toda PJ. Um sistema da própria empresa afirmando dever verba trabalhista a
 * prestador de serviço é prova pronta num processo de reconhecimento de
 * vínculo. O vocabulário desta tela está em `lib/dominio/full-days.ts`.
 *
 * O alerta continua, porque o fato que ele aponta é real e útil. O que mudou é
 * o que ele afirma: ninguém para há muito tempo, e isso é risco de entrega e
 * de esgotamento — não uma dívida da empresa.
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
      "Saldo", "Ausências no período", "Afastamentos no período", "Meses sem descanso",
    ];
    const corpo = visiveis.map((l) => [
      l.nome, l.area, l.diasFeriasAno, l.tiradas, l.agendadas, l.pendentes,
      l.saldo, l.ausencias, l.licencas, l.mesesSemFerias ?? "—",
    ]);
    baixarCSV(montarCSV(cabecalho, corpo), `full-days-relatorio-${mes}.csv`);
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-card rounded-card shadow-cartao flex flex-wrap items-center gap-2 border p-3">
        <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => irParaMes(-1)}>
          <ChevronLeft aria-hidden />
        </Button>
        {/* first-letter, e não capitalize: este maiúsculiza cada palavra e
            produziria "Setembro De 2026". */}
        <p className="text-[15px] font-bold tracking-[-0.02em] first-letter:uppercase">
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

      {/* OS QUATRO NÚMEROS PASSARAM A SER O `CartaoDeNumero` compartilhado, e
          não um `Indicador` local. Ele nasceu no Sprint 15 para a Home e as
          Métricas; esta cópia era a terceira forma do mesmo cartão no produto,
          e já divergia — o rótulo dela é `--text-muted` fixo, que é justamente
          o par que a varredura de acessibilidade reprovou sobre fundo tingido.
          Com o componente, o tom decide a cor do rótulo junto.

          "Esperando decisão" ganha o tom de atenção quando há fila, e vira um
          link para ela: o número era um beco — a pessoa lia "3" e voltava ao
          menu para chegar na tela que resolve os três. */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoDeNumero
          rotulo="Descanso no ano"
          valor={`${tiradas} de ${contratadas}`}
          apoio="dias usados, do total previsto em contrato"
        />
        <CartaoDeNumero
          rotulo="Taxa de ausência"
          valor={`${taxa.toFixed(1)}%`}
          apoio={`${ausencias} dia(s) sobre ${capacidade} de capacidade`}
        />
        <CartaoDeNumero
          rotulo="Esperando decisão"
          valor={pendentes}
          apoio={pendentes === 1 ? "solicitação" : "solicitações"}
          tom={pendentes > 0 ? "atencao" : "neutro"}
          href={pendentes > 0 ? "/painel/full-days?aba=aprovacoes" : undefined}
        />
        <CartaoDeNumero
          rotulo="Afastamentos"
          valor={licencas}
          apoio={`e ${foraHoje} pessoa(s) em descanso agora`}
        />
      </div>

      {/* O ALERTA É `--warning`, E NUNCA `--danger`, e a troca é a regra do
          produto aplicada onde ela faltava: vermelho é erro, e uma pessoa há
          um ano sem parar não é um erro — é um risco de entrega e de
          esgotamento que alguém precisa combinar. Numa tela que se abre uma
          vez por semana, vermelho permanente treina o hábito de ignorar
          vermelho, que é a razão pela qual o alerta de 7 dias do portal e os
          quatro sinais de carga do Feedback também são âmbar. */}
      {vencendo.length > 0 ? (
        <section className="bg-warning-soft rounded-card border p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle aria-hidden className="text-warning mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-warning text-sm font-semibold">
                Há mais de um ano sem descanso — {vencendo.length} pessoa(s)
              </h2>
              <ul className="mt-2 space-y-0.5">
                {vencendo.map((l) => (
                  <li key={l.id} className="text-text-primary text-sm">
                    <strong>{l.nome}</strong> — {l.mesesSemFerias} meses desde{" "}
                    {l.ultimasFerias
                      ? `o último descanso (${format(parseISO(l.ultimasFerias), "dd/MM/yyyy")})`
                      : l.admissao
                        ? `o início do contrato (${format(parseISO(l.admissao), "dd/MM/yyyy")})`
                        : "o início"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <div className="bg-surface-card rounded-card shadow-cartao overflow-x-auto border">
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
              <TableHead className="text-right">Afast.</TableHead>
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
                        aria-label={`${proporcao}% do descanso comprometido`}
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

