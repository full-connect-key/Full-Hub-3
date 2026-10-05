"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import {
  COR_DA_CAMADA,
  ROTULOS_DE_CAMADA,
  diaNaGrade,
  ehFaixa,
  ocupaODia,
  type ItemDoCalendario,
} from "@/lib/dominio/calendario";
import { cn } from "@/lib/utils";

import { ehDoMes, ehFimDeSemana, semanasDoMes } from "./periodo";
import { hojeNaAgencia } from "@/lib/dominio/datas";

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Quantos itens cabem na célula antes do "+ N mais". */
const NO_DIA = 3;

/**
 * A grade do mês.
 *
 * ---------------------------------------------------------------------------
 * O QUE ATRAVESSA DIAS VIRA FAIXA NO TOPO DA SEMANA, e não item da lista de
 * cada dia.
 *
 * Uma feira de três dias listada dia a dia são três linhas que a pessoa
 * precisa juntar de cabeça, e elas competem por espaço com os prazos daquele
 * dia — que é a informação que a célula existe para mostrar. Como faixa, ela
 * se lê como um bloco contínuo e ocupa uma linha só.
 *
 * **E a campanha não vira faixa de trinta células.** `diaNaGrade()` a coloca
 * no dia em que ela acaba, que é o dia em que ela cobra alguma coisa de
 * alguém. A view carrega o período inteiro para a Linha do Tempo desenhar a
 * barra longa; a decisão de qual dia a grade pinta mora num lugar só.
 * ---------------------------------------------------------------------------
 *
 * **Sempre seis semanas.** Um mês que cabe em cinco e outro que precisa de
 * seis fazem a grade mudar de altura ao trocar de mês, e a página inteira
 * pula debaixo do cursor.
 */
export function VisaoDeMes({
  mes,
  itens,
  aoAbrir,
  aoSelecionar,
}: {
  mes: string;
  itens: ItemDoCalendario[];
  aoAbrir: (item: ItemDoCalendario) => void;
  /** Selecionar um intervalo abre o formulário de evento já com as datas. */
  aoSelecionar?: (periodo: { de: string; ate: string }) => void;
}) {
  // ---------------------------------------------------------------------------
  // O ARRASTO SAIU COM AS ETAPAS (0077).
  //
  // Ele valia para uma camada só — a etapa, porque o prazo dela é escrito por
  // quem a faz. O período da demanda é derivado, a campanha tem período
  // combinado e a ausência é decisão do sócio: oferecê-lo neles prometia uma
  // mudança que o banco desfaz ou recusa. Sem a camada da etapa não sobra nada
  // nesta grade que se mova arrastando, e um alvo de solta que recusa tudo é
  // um gesto que não faz nada — o pior tipo de recusa.
  //
  // Quem arrasta agora é o board de etapas de Minhas Tasks, que é onde a
  // etapa passou a viver.
  // ---------------------------------------------------------------------------
  const semanas = semanasDoMes(mes);
  const hoje = hojeNaAgencia();

  const faixas = itens.filter(ehFaixa);
  const pontuais = itens.filter((i) => !ehFaixa(i));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[42rem]">
        <div className="text-text-muted grid grid-cols-7 gap-px pb-1 text-xs font-medium">
          {DIAS.map((d) => (
            <div key={d} className="px-2 capitalize">
              {d}
            </div>
          ))}
        </div>

        <div className="bg-border grid gap-px overflow-hidden rounded-lg border">
          {semanas.map((semana) => {
            const daSemana = faixas.filter((f) =>
              semana.some((dia) => ocupaODia(f, dia)),
            );

            return (
              <div key={semana[0]} className="bg-border grid gap-px">
                {/* AS FAIXAS DA SEMANA */}
                {daSemana.length > 0 ? (
                  <div className="bg-surface-card space-y-1 p-1">
                    {daSemana.map((faixa) => {
                      const { de, ate } = diaNaGrade(faixa);
                      // Quem começa antes da semana entra na coluna 1; quem
                      // acaba depois vai até a 7. É isso que faz uma feira de
                      // 27 a 29 sair colada na borda direita numa semana e na
                      // esquerda na seguinte, em vez de virar dois blocos
                      // soltos no meio.
                      const inicio = semana.findIndex((d) => d >= de);
                      const fim = semana.findLastIndex((d) => d <= ate);
                      if (inicio === -1 || fim === -1 || fim < inicio) return null;

                      return (
                        // CADA FAIXA É UMA GRADE DE SETE COLUNAS, e não uma
                        // caixa com margem em porcentagem.
                        //
                        // A primeira versão misturava as duas coisas —
                        // `gridColumnStart` num pai `flex`, onde ele não faz
                        // nada, mais `marginLeft`/`width` calculados em
                        // sétimos. O resultado foi uma barra de semana
                        // inteira parando no meio da quinta-feira. Com a
                        // grade, a coluna é a coluna: o mesmo `grid-cols-7`
                        // dos dias embaixo, e as duas linhas não têm como
                        // discordar.
                        <div key={faixa.id} className="grid grid-cols-7 gap-px">
                          <button
                            type="button"
                            onClick={() => aoAbrir(faixa)}
                            title={`${ROTULOS_DE_CAMADA[faixa.tipo]}: ${faixa.titulo}`}
                            style={{ gridColumnStart: inicio + 1, gridColumnEnd: fim + 2 }}
                            className={cn(
                              "truncate rounded px-2 py-0.5 text-left text-xs font-medium",
                              COR_DA_CAMADA[faixa.tipo],
                            )}
                          >
                            {faixa.titulo}
                            {faixa.pessoa ? ` · ${faixa.pessoa.nome.split(" ")[0]}` : ""}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="bg-border grid grid-cols-7 gap-px">
                  {semana.map((dia) => {
                    const doDia = pontuais.filter((i) => ocupaODia(i, dia));
                    const ausencias = doDia.filter((i) => i.tipo === "ausencia");
                    const trabalho = doDia.filter((i) => i.tipo !== "ausencia");

                    return (
                      <div
                        key={dia}
                        className={cn(
                          "min-h-28 p-1 text-xs",
                          // TRÊS ESTADOS E NÃO DOIS: dia do mês, fim de
                          // semana e dia de outro mês. A primeira versão
                          // pintava os dois últimos com a mesma cor, e o
                          // sábado do meio do mês ficava idêntico ao dia 2 do
                          // mês seguinte — que é a diferença entre "ninguém
                          // trabalha" e "isto não é deste mês".
                          // `opacity-60` SAIU, e ele era o bug: opacidade no
                          // contêiner desbota TUDO o que está dentro, inclusive
                          // o texto — e o axe reprovou o número do dia por
                          // contraste em todas as visões do mês. É a mesma
                          // regra que o produto já aplica aos selos de estado:
                          // opacidade sobre um fundo qualquer dá uma cor que
                          // ninguém mediu, e no tema escuro dá outra.
                          //
                          // O que o dia de outro mês precisa é ser MAIS claro
                          // que o fim de semana, não mais apagado: o par
                          // `bg-muted/text-text-muted` já diz "não é aqui", e o
                          // que distingue os dois passa a ser a borda pontilhada
                          // — uma diferença de forma, que sobrevive ao tema e ao
                          // daltonismo, em vez de uma diferença de lavagem.
                          !ehDoMes(dia, mes)
                            ? "bg-muted border-border border-dashed"
                            : ehFimDeSemana(dia)
                              ? "bg-muted"
                              : "bg-surface-card",
                        )}
                        onDoubleClick={() => aoSelecionar?.({ de: dia, ate: dia })}
                      >
                        <div className="flex items-center justify-between px-1">
                          <span
                            className={cn(
                              "tabular-nums",
                              dia === hoje
                                ? "bg-brand-blue text-text-primary rounded-full px-1.5 font-semibold"
                                : ehDoMes(dia, mes)
                                  ? "text-text-secondary"
                                  : "text-neutral",
                            )}
                          >
                            {Number(dia.slice(8, 10))}
                          </span>

                          {/* QUEM ESTÁ FORA fica no topo da célula, com a foto.
                              É o que evita marcar entrega no dia em que o
                              responsável não está — e um avatar se lê de
                              relance, enquanto uma linha na lista some no
                              meio dos prazos. */}
                          {ausencias.length > 0 ? (
                            <span
                              className="flex -space-x-1"
                              title={`Fora: ${ausencias.map((a) => a.pessoa?.nome ?? "—").join(", ")}`}
                            >
                              {ausencias.slice(0, 3).map((a) => (
                                <UserAvatar
                                  key={a.id}
                                  name={a.pessoa?.nome ?? "—"}
                                  src={a.pessoa?.avatar_url ?? null}
                                  size="sm"
                                />
                              ))}
                            </span>
                          ) : null}
                        </div>

                        <ul className="mt-1 space-y-0.5">
                          {trabalho.slice(0, NO_DIA).map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => aoAbrir(item)}
                                title={`${ROTULOS_DE_CAMADA[item.tipo]}: ${item.titulo}${item.cliente ? ` — ${item.cliente}` : ""}`}
                                className="hover:bg-muted flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left"
                              >
                                <span
                                  aria-hidden
                                  className={cn("size-1.5 shrink-0 rounded-full", COR_DA_CAMADA[item.tipo])}
                                />
                                <span className="truncate">{item.titulo}</span>
                              </button>
                            </li>
                          ))}
                          {trabalho.length > NO_DIA ? (
                            <li className="text-text-muted px-1">
                              + {trabalho.length - NO_DIA} mais
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-text-muted mt-2 text-xs">
        Clique duas vezes num dia para abrir um evento.
      </p>
    </div>
  );
}
