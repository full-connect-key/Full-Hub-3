"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  CORES_DE_PRESENCA,
  PRESENCAS_EDITAVEIS,
  ROTULOS_DE_PRESENCA,
  diasEntre,
  lerData,
} from "@/lib/dominio/full-days";
import type { PresencaStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { marcarPresenca } from "./acoes";

type Dia = { data: string; status: PresencaStatus; observacao: string | null; deSolicitacao: boolean };

type Linha = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  area: string;
  cargo: string | null;
  dias: Record<string, Dia>;
};

/**
 * A matriz: pessoas nas linhas, dias nas colunas.
 *
 * Duas decisões de desenho:
 *
 *   **A primeira coluna é fixa.** Numa grade de 30 colunas, rolar para ver o
 *   dia 28 e perder de vista de quem é a linha torna a matriz inútil
 *   exatamente onde ela precisa servir.
 *
 *   **As pessoas vêm agrupadas por ÁREA.** É a pergunta real que a grade
 *   responde: não "quem está fora", e sim "quem do Design está fora". Duas
 *   designers na mesma semana param a produção; dois nomes quaisquer não
 *   dizem nada.
 *
 * Um dia que veio de pedido aprovado não se edita aqui. O banco recusa de
 * qualquer forma; a tela nem oferece, e diz por quê.
 */
export function MatrizDaEquipe({
  linhas,
  feriados,
  inicio,
  fim,
  mes,
  podeEditar,
}: {
  linhas: Linha[];
  feriados: { data: string; nome: string }[];
  inicio: string;
  fim: string;
  mes: string;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [salvando, iniciar] = useTransition();

  const dias = diasEntre(inicio, fim);
  const feriadoDe = new Map(feriados.map((f) => [f.data, f.nome]));

  const areas = [...new Set(linhas.map((l) => l.area))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  function irParaMes(passo: number) {
    const [ano, mesNumero] = mes.split("-").map(Number);
    const destinoData = new Date(ano, mesNumero - 1 + passo, 1);
    const destino = new URLSearchParams(parametros.toString());
    destino.set("mes", format(destinoData, "yyyy-MM"));
    router.push(`?${destino.toString()}`);
  }

  function trocar(pessoa: Linha, data: string, status: PresencaStatus) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        marcarPresenca({ user_id: pessoa.id, data, status }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(`${pessoa.nome}: ${ROTULOS_DE_PRESENCA[status]}`);
        router.refresh();
      }
    });
  }

  function exportar() {
    // O CSV sai com ponto e vírgula e BOM porque quem vai abrir isso é o Excel
    // em português: com vírgula, ele joga a linha inteira numa célula só, e
    // sem o BOM os acentos viram caracteres estranhos.
    const cabecalho = ["Pessoa", "Área", ...dias.map((d) => format(parseISO(d), "dd/MM"))];
    const corpo = linhas.map((linha) => [
      linha.nome,
      linha.area,
      ...dias.map((d) => ROTULOS_DE_PRESENCA[statusDoDia(linha, d)]),
    ]);

    const texto = [cabecalho, ...corpo]
      .map((celulas) => celulas.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const arquivo = new Blob([`﻿${texto}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = `full-days-${mes}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function statusDoDia(linha: Linha, data: string): PresencaStatus {
    const registro = linha.dias[data];
    if (registro) return registro.status;
    if (feriadoDe.has(data)) return "feriado";
    const dataLocal = lerData(data);
    if (dataLocal && (dataLocal.getDay() === 0 || dataLocal.getDay() === 6)) return "folga";
    return "presente";
  }

  return (
    <div className="space-y-4">
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

        <Button variant="outline" size="sm" className="ml-auto" onClick={exportar}>
          <Download aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <Legenda />

      {linhas.length === 0 ? (
        <p className="text-muted-foreground rounded-card border border-dashed p-6 text-center text-sm">
          Nenhuma pessoa ativa na equipe.
        </p>
      ) : (
        <div className="rounded-card overflow-x-auto border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="bg-surface-card text-text-muted sticky left-0 z-20 border-b border-r px-3 py-2 text-left text-xs font-medium">
                  Pessoa
                </th>
                {dias.map((data) => {
                  const dataLocal = lerData(data);
                  const fimDeSemana = dataLocal?.getDay() === 0 || dataLocal?.getDay() === 6;
                  return (
                    <th
                      key={data}
                      scope="col"
                      className={cn(
                        "text-text-muted border-b px-0 py-2 text-center text-[10px] font-medium tabular-nums",
                        fimDeSemana && "bg-neutral-soft",
                      )}
                    >
                      {format(parseISO(data), "dd")}
                    </th>
                  );
                })}
                <th className="bg-surface-card text-text-muted border-b border-l px-2 py-2 text-center text-[10px] font-medium">
                  Totais
                </th>
              </tr>
            </thead>

            <tbody>
              {areas.map((area) => (
                <Grupo
                  key={area}
                  area={area}
                  pessoas={linhas.filter((l) => l.area === area)}
                  dias={dias}
                  feriadoDe={feriadoDe}
                  statusDoDia={statusDoDia}
                  podeEditar={podeEditar}
                  salvando={salvando}
                  trocar={trocar}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Grupo({
  area,
  pessoas,
  dias,
  feriadoDe,
  statusDoDia,
  podeEditar,
  salvando,
  trocar,
}: {
  area: string;
  pessoas: Linha[];
  dias: string[];
  feriadoDe: Map<string, string>;
  statusDoDia: (linha: Linha, data: string) => PresencaStatus;
  podeEditar: boolean;
  salvando: boolean;
  trocar: (pessoa: Linha, data: string, status: PresencaStatus) => void;
}) {
  return (
    <>
      <tr>
        <th
          colSpan={dias.length + 2}
          scope="colgroup"
          className="bg-neutral-soft text-text-secondary border-b px-3 py-1 text-left text-[11px] font-semibold tracking-wide uppercase"
        >
          {area}
        </th>
      </tr>

      {pessoas.map((pessoa) => {
        const totais = contarTotais(pessoa, dias, statusDoDia);
        return (
          <tr key={pessoa.id}>
            <th
              scope="row"
              className="bg-surface-card sticky left-0 z-10 border-b border-r px-3 py-1.5 text-left font-normal"
            >
              <span className="block truncate text-sm">{pessoa.nome}</span>
              {pessoa.cargo ? (
                <span className="text-text-muted block truncate text-[11px]">{pessoa.cargo}</span>
              ) : null}
            </th>

            {dias.map((data) => (
              <Celula
                key={data}
                pessoa={pessoa}
                data={data}
                status={statusDoDia(pessoa, data)}
                feriado={feriadoDe.get(data) ?? null}
                deSolicitacao={pessoa.dias[data]?.deSolicitacao ?? false}
                podeEditar={podeEditar}
                salvando={salvando}
                trocar={trocar}
              />
            ))}

            <td className="text-text-muted border-b border-l px-2 py-1.5 text-center text-[11px] whitespace-nowrap tabular-nums">
              {totais.presente}p · {totais.remoto}r · {totais.ferias}f · {totais.ausente}a
            </td>
          </tr>
        );
      })}
    </>
  );
}

function contarTotais(
  pessoa: Linha,
  dias: string[],
  statusDoDia: (linha: Linha, data: string) => PresencaStatus,
) {
  const totais = { presente: 0, remoto: 0, ferias: 0, ausente: 0 };
  for (const data of dias) {
    const status = statusDoDia(pessoa, data);
    if (status === "presente") totais.presente += 1;
    else if (status === "remoto") totais.remoto += 1;
    else if (status === "ferias") totais.ferias += 1;
    else if (status === "ausente" || status === "licenca") totais.ausente += 1;
  }
  return totais;
}

function Celula({
  pessoa,
  data,
  status,
  feriado,
  deSolicitacao,
  podeEditar,
  salvando,
  trocar,
}: {
  pessoa: Linha;
  data: string;
  status: PresencaStatus;
  feriado: string | null;
  deSolicitacao: boolean;
  podeEditar: boolean;
  salvando: boolean;
  trocar: (pessoa: Linha, data: string, status: PresencaStatus) => void;
}) {
  const [aberto, setAberto] = useState(false);

  const descricao = `${pessoa.nome}, ${format(parseISO(data), "dd/MM", { locale: ptBR })}: ${
    ROTULOS_DE_PRESENCA[status]
  }${feriado ? ` (${feriado})` : ""}${deSolicitacao ? " — de solicitação aprovada" : ""}`;

  const quadrado = (
    <span
      aria-hidden
      className={cn("block size-full min-h-6", CORES_DE_PRESENCA[status])}
    />
  );

  // Dia que veio de pedido aprovado, ou feriado: não abre menu. O banco recusa
  // de qualquer forma — a tela só evita oferecer o que vai dar erro.
  if (!podeEditar || deSolicitacao || status === "feriado") {
    return (
      <td className="border-b p-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block h-7 w-6 px-px">{quadrado}</span>
          </TooltipTrigger>
          <TooltipContent>
            {descricao}
            {deSolicitacao ? (
              <span className="mt-0.5 block text-[11px] opacity-80">
                Desfaça a solicitação para mudar.
              </span>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </td>
    );
  }

  return (
    <td className="border-b p-0">
      <DropdownMenu open={aberto} onOpenChange={setAberto}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={salvando}
            aria-label={descricao}
            className="block h-7 w-6 px-px disabled:opacity-60"
          >
            {quadrado}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PRESENCAS_EDITAVEIS.map((opcao) => (
            <DropdownMenuItem
              key={opcao}
              onSelect={() => trocar(pessoa, data, opcao)}
              className="gap-2"
            >
              <span aria-hidden className={cn("size-3 rounded-sm", CORES_DE_PRESENCA[opcao])} />
              {ROTULOS_DE_PRESENCA[opcao]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  );
}

function Legenda() {
  const ordem: PresencaStatus[] = [
    "presente",
    "remoto",
    "ferias",
    "licenca",
    "ausente",
    "folga",
    "feriado",
  ];

  return (
    <ul className="text-text-secondary flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {ordem.map((status) => (
        <li key={status} className="inline-flex items-center gap-1.5">
          {/* A borda existe para o feriado: o padrão listrado é claro demais
              para se distinguir do cartão branco num quadrado de 12px. Nas
              outras a borda some sob a cor cheia. */}
          <span
            aria-hidden
            className={cn("size-3 rounded-sm border", CORES_DE_PRESENCA[status])}
          />
          {ROTULOS_DE_PRESENCA[status]}
        </li>
      ))}
    </ul>
  );
}
