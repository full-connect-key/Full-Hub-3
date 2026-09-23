"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
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
  diasFeriasAno: number;
  saldo: number;
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
 *   **Dias seguidos com o mesmo estado viram UMA faixa.** Vinte quadradinhos
 *   soltos obrigam a contar de um em um para saber que o descanso foi de
 *   segunda a sexta; a faixa mostra o período de relance, que é a leitura que
 *   a grade existe para dar. A junção é só visual — cada dia continua sendo
 *   seu próprio alvo de clique, senão a gestão perderia a edição por dia.
 *
 *   **O saldo fica ao lado do nome.** É a pergunta seguinte de quem viu que
 *   alguém está fora: quanto ainda resta. Antes estava só no Relatório, uma
 *   aba adiante.
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
  quemSouEu,
}: {
  linhas: Linha[];
  feriados: { data: string; nome: string }[];
  inicio: string;
  fim: string;
  mes: string;
  podeEditar: boolean;
  /** Para a própria linha ficar marcada: numa grade de vinte nomes, achar o seu é o primeiro movimento. */
  quemSouEu: string;
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

        {/* A legenda sobe para a mesma linha do navegador. Embaixo, numa
            linha só dela, ela empurrava a grade para fora da primeira tela —
            e a grade é o conteúdo. */}
        <Legenda />

        <Button variant="outline" size="sm" className="ml-auto" onClick={exportar}>
          <Download aria-hidden />
          Exportar CSV
        </Button>
      </div>

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
                        "text-text-muted border-b px-0 py-1.5 text-center text-[10px] font-medium tabular-nums",
                        fimDeSemana && "bg-neutral-soft",
                      )}
                    >
                      {/* A inicial do dia da semana em cima do número. Sem
                          ela, achar "a semana que vem" numa fita de 30
                          números é contar de sete em sete com o dedo. */}
                      <span className="block text-[9px] leading-none uppercase opacity-70">
                        {format(parseISO(data), "EEEEE", { locale: ptBR })}
                      </span>
                      <span className="block leading-tight">{format(parseISO(data), "dd")}</span>
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
                  quemSouEu={quemSouEu}
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
  quemSouEu,
}: {
  area: string;
  pessoas: Linha[];
  dias: string[];
  feriadoDe: Map<string, string>;
  statusDoDia: (linha: Linha, data: string) => PresencaStatus;
  podeEditar: boolean;
  salvando: boolean;
  trocar: (pessoa: Linha, data: string, status: PresencaStatus) => void;
  quemSouEu: string;
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
        const souEu = pessoa.id === quemSouEu;
        return (
          <tr key={pessoa.id} className={cn(souEu && "bg-accent/40")}>
            <th
              scope="row"
              className={cn(
                "sticky left-0 z-10 border-b border-r px-3 py-1.5 text-left font-normal",
                souEu ? "bg-accent" : "bg-surface-card",
              )}
            >
              <div className="flex items-center gap-2">
                <UserAvatar name={pessoa.nome} src={pessoa.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <span className="block truncate text-sm">{pessoa.nome}</span>
                  {/* O saldo, e não o cargo: quem olha a grade já sabe de que
                      área é a linha (elas vêm agrupadas por área), e o que
                      falta saber é quanto a pessoa ainda tem. */}
                  <span className="text-text-secondary block truncate text-[11px] tabular-nums">
                    {pessoa.saldo} de {pessoa.diasFeriasAno} dias
                  </span>
                </div>
              </div>
            </th>

            {dias.map((data, indice) => {
              const status = statusDoDia(pessoa, data);
              const anterior = indice > 0 ? statusDoDia(pessoa, dias[indice - 1]) : null;
              const seguinte =
                indice < dias.length - 1 ? statusDoDia(pessoa, dias[indice + 1]) : null;
              return (
                <Celula
                  key={data}
                  pessoa={pessoa}
                  data={data}
                  status={status}
                  abreBloco={status !== anterior}
                  fechaBloco={status !== seguinte}
                  feriado={feriadoDe.get(data) ?? null}
                  deSolicitacao={pessoa.dias[data]?.deSolicitacao ?? false}
                  podeEditar={podeEditar}
                  salvando={salvando}
                  trocar={trocar}
                />
              );
            })}

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

/**
 * Um dia da grade.
 *
 * `abreBloco` e `fechaBloco` são o que faz dias seguidos com o mesmo estado
 * parecerem UMA faixa: só as pontas ganham canto arredondado e a folga
 * lateral, e o miolo encosta. A junção é aparência — cada dia continua sendo
 * seu próprio botão, senão a gestão perderia a edição por dia, que é para o
 * que a matriz serve.
 */
function Celula({
  pessoa,
  data,
  status,
  abreBloco,
  fechaBloco,
  feriado,
  deSolicitacao,
  podeEditar,
  salvando,
  trocar,
}: {
  pessoa: Linha;
  data: string;
  status: PresencaStatus;
  abreBloco: boolean;
  fechaBloco: boolean;
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

  const faixa = (
    <span
      aria-hidden
      className={cn(
        "block size-full min-h-6",
        CORES_DE_PRESENCA[status],
        abreBloco && "rounded-l-md",
        fechaBloco && "rounded-r-md",
      )}
    />
  );

  // A folga lateral fica FORA da faixa, e só na ponta: assim o miolo de um
  // bloco encosta no vizinho e vira uma peça só, enquanto blocos diferentes
  // continuam separados.
  const caixa = cn("block h-7", abreBloco && "pl-px", fechaBloco && "pr-px");

  // Dia que veio de pedido aprovado, ou feriado: não abre menu. O banco recusa
  // de qualquer forma — a tela só evita oferecer o que vai dar erro.
  if (!podeEditar || deSolicitacao || status === "feriado") {
    return (
      <td className="w-6 border-b p-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={caixa}>{faixa}</span>
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
    <td className="w-6 border-b p-0">
      <DropdownMenu open={aberto} onOpenChange={setAberto}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={salvando}
            aria-label={descricao}
            className={cn(caixa, "w-full disabled:opacity-60")}
          >
            {faixa}
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
