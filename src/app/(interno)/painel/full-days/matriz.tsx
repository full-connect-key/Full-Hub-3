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
import { baixarCSV, montarCSV } from "@/lib/dominio/csv";
import {
  CORES_DE_PRESENCA,
  PRESENCAS_EDITAVEIS,
  ROTULOS_DE_PRESENCA,
  coberturaDaArea,
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

    baixarCSV(montarCSV(cabecalho, corpo), `full-days-${mes}.csv`);
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
                      <span className="block text-[9px] leading-none uppercase">
                        {format(parseISO(data), "EEEEE", { locale: ptBR })}
                      </span>
                      <span className="block leading-tight">{format(parseISO(data), "dd")}</span>
                    </th>
                  );
                })}
                <th
                  title="Por pessoa, os dias de cada estado no mês. Na linha da área, em quantos dias dois ou mais dela estiveram fora ao mesmo tempo."
                  className="bg-surface-card text-text-muted border-b border-l px-2 py-2 text-center text-[10px] font-medium"
                >
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
  // A RÉGUA DE COBERTURA da área, dia a dia. A conta mora em
  // `lib/dominio/full-days.ts` porque o limiar precisa ser o MESMO do
  // calendário de pedido — duas telas com dois limiares seriam duas verdades
  // sobre a mesma equipe, e a pessoa descobriria isso levando um "não" num dia
  // que a matriz pintou de verde.
  const cobertura = coberturaDaArea(dias, (dia) =>
    pessoas.map((pessoa) => statusDoDia(pessoa, dia)),
  );

  return (
    <>
      <tr>
        <th
          scope="colgroup"
          className="bg-neutral-soft text-text-secondary sticky left-0 z-20 border-b border-r px-3 py-1 text-left text-[11px] font-semibold tracking-wide uppercase"
        >
          {area}{" "}
          <span className="text-text-muted font-medium normal-case">
            · {pessoas.length} {pessoas.length === 1 ? "pessoa" : "pessoas"}
          </span>
        </th>

        {/* UMA CÉLULA POR DIA, com quantos da área estão fora nele. O número
            em vez de só a cor: "2" diz quantos, e a cor sozinha obrigaria a
            contar as linhas embaixo para descobrir — que é exatamente o
            trabalho que esta faixa existe para poupar.

            O dia sem ninguém fora fica com um ponto e não vazio: uma fila de
            trinta células em branco lê como uma linha quebrada. */}
        {dias.map((data) => {
          const fora = cobertura.get(data) ?? 0;
          const rotulo = `${format(parseISO(data), "dd/MM")}: ${
            fora === 0
              ? `ninguém do ${area} fora`
              : `${fora} do ${area} ${fora === 1 ? "fora" : "fora ao mesmo tempo"}`
          }`;
          return (
            <td
              key={data}
              title={rotulo}
              aria-label={rotulo}
              className={cn(
                "bg-neutral-soft border-b px-0 py-0.5 text-center text-[10px] font-semibold tabular-nums",
                fora === 0 && "text-text-muted/50",
                fora === 1 && "bg-warning-soft text-warning",
                // O PAR NOMEADO, e não `bg-danger text-white`: no tema
                // escuro `--danger` clareia bastante, e branco por cima dele
                // não chega a 3:1. `--destructive-foreground` acompanha o
                // fundo — escuro lá, branco aqui —, e é um dos pares que
                // `check:cores` mede nos DOIS temas.
                //
                // (Escrevi o valor escuro aqui dentro na primeira versão e a
                // varredura acusou o próprio comentário. É a regra de sempre:
                // a explicação não carrega o que ela proíbe.)
                fora >= 2 && "bg-destructive text-destructive-foreground",
              )}
            >
              {fora === 0 ? "·" : fora}
            </td>
          );
        })}

        <td className="bg-neutral-soft text-text-muted border-b border-l px-2 py-0.5 text-center text-[10px] font-medium tabular-nums">
          {[...cobertura.values()].filter((n) => n >= 2).length > 0
            ? `${[...cobertura.values()].filter((n) => n >= 2).length}d`
            : "—"}
        </td>
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

  // SÓ A EXCEÇÃO É PINTADA, e é o que torna a grade legível.
  //
  // Até aqui todo dia recebia a cor do seu estado, "Disponível" inclusive — e
  // como quase todo dia de quase todo mundo é disponível, o resultado era uma
  // parede verde com alguns furos. A pessoa procurava o furo; o desenho
  // pedia que ela procurasse a informação. Agora o dia normal não tem cor
  // nenhuma, e o que salta é justamente quem está fora.
  //
  // Fim de semana e feriado ficam com um cinza CLARO, e não em branco: eles
  // não são exceção, mas também não são dia útil — sem a distinção, uma faixa
  // de descanso de sexta a segunda parece ter um buraco no meio.
  const discreto = status === "presente";
  const faixa = (
    <span
      aria-hidden
      className={cn(
        "block size-full min-h-6",
        discreto ? "bg-transparent" : CORES_DE_PRESENCA[status],
        status === "folga" && "bg-neutral-soft",
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
              <span className="mt-0.5 block text-[11px]">
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
  // `presente` SAIU DA LEGENDA porque saiu da grade: desde que só a exceção é
  // pintada, o dia disponível não tem cor nenhuma. Um item de legenda para
  // uma cor que não aparece é pior que um item a menos — a pessoa procura o
  // verde, não acha, e passa a desconfiar do resto da legenda.
  const ordem: PresencaStatus[] = [
    "remoto",
    "ferias",
    "licenca",
    "ausente",
    "folga",
    "feriado",
  ];

  // A amostra de "sem alocação" acompanha o tom CLARO que a grade passou a
  // usar para fim de semana. Com o cinza cheio de `CORES_DE_PRESENCA`, a
  // legenda mostraria uma cor que a tela não desenha em lugar nenhum.
  function amostra(status: PresencaStatus) {
    return status === "folga" ? "bg-neutral-soft" : CORES_DE_PRESENCA[status];
  }

  return (
    <ul className="text-text-secondary flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {/* A RÉGUA VEM PRIMEIRO na legenda, e não por ordem de chegada: ela é a
          única coisa na tela que a pessoa não reconhece de outro lugar. As
          sete cores de estado ela já viu no calendário e no relatório; um
          número numa faixa âmbar, não. */}
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="bg-destructive text-destructive-foreground inline-flex size-4 items-center justify-center rounded-sm text-[9px] font-semibold"
        >
          2
        </span>
        quantos da área estão fora no dia — remoto não conta
      </li>
      <li aria-hidden className="bg-border h-3.5 w-px" />
      {ordem.map((status) => (
        <li key={status} className="inline-flex items-center gap-1.5">
          {/* A borda existe para o feriado: o padrão listrado é claro demais
              para se distinguir do cartão branco num quadrado de 12px. Nas
              outras a borda some sob a cor cheia. */}
          <span
            aria-hidden
            className={cn("size-3 rounded-sm border", amostra(status))}
          />
          {ROTULOS_DE_PRESENCA[status]}
        </li>
      ))}
    </ul>
  );
}
