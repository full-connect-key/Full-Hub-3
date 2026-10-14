"use client";

import {
  corDoEvento,
  ehFaixa,
  ocupaODia,
  rotuloDoEvento,
  type ItemDoCalendario,
} from "@/lib/dominio/calendario";
import { cn } from "@/lib/utils";

import { ehDoMes, ehFimDeSemana, semanasDoMes } from "./periodo";
import { hojeNaAgencia } from "@/lib/dominio/datas";

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Quantos itens cabem na célula antes do "+ N mais". */
const NO_DIA = 3;

/**
 * A segunda linha do chip: de quem é isto.
 *
 * **É A EMPRESA, e ela é a única das duas que sobrou.** "Feira" e "Lançamento"
 * são nomes que se repetem na agenda de várias contas, e sem a empresa o chip
 * não diz de que trabalho ele é; a convenção e o feriado da casa não têm
 * empresa, e aí a linha não aparece.
 *
 * O SEGUNDO RAMO ERA O PRIMEIRO NOME de quem era responsável, e ele saiu com a
 * camada de ausência (0105): a view não escreve mais `user_id`, e o evento tem
 * PARTICIPANTES — vários por linha —, então não há um nome para pôr aqui. A
 * lista deles continua no detalhe, que é onde ela cabe.
 */
function segundaLinha(item: ItemDoCalendario): string | null {
  return item.cliente;
}

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
 * **E A FAIXA É O PERÍODO CRU desde a 0105.** Havia um desvio aqui —
 * `diaNaGrade()`, que punha a campanha no dia em que ela ACABA, porque uma
 * Wave de trinta dias pintaria trinta células e empurraria para baixo tudo o
 * que acontece em cada uma. Com a campanha fora da view não há mais duas
 * respostas para a mesma pergunta, e o argumento ficou registrado em
 * `lib/dominio/calendario.ts`, no lugar da função: ele volta a valer no dia em
 * que uma origem de período longo voltar a esta tela.
 * ---------------------------------------------------------------------------
 *
 * **Sempre seis semanas.** Um mês que cabe em cinco e outro que precisa de
 * seis fazem a grade mudar de altura ao trocar de mês, e a página inteira
 * pula debaixo do cursor.
 *
 * ---------------------------------------------------------------------------
 * A COR É O CHIP, e não mais um ponto de seis pixels.
 *
 * Decisão do usuário: *"mudar a visualização do evento, para dar mais
 * destaque dentro da data, está muito minimalista"*. Ele estava certo, e a
 * incoerência estava dentro deste arquivo: a FAIXA de três dias já saía como
 * pílula inteira no par nomeado da camada, e o item de um dia só saía como
 * texto cinza com um pontinho ao lado — duas respostas para a mesma pergunta,
 * a dois centímetros de distância. A visão de Semana já pintava o chip
 * inteiro desde que nasceu, então eram três desenhos no mesmo módulo.
 *
 * **É a mesma decisão que o calendário da Gestão de Tasks tomou** quando a
 * queixa foi esta: *"quatro fios de quatro pixels numa célula não se leem à
 * distância de que a grade do mês é olhada"*. A barra cheia fica, como borda
 * de leitura entre duas linhas do mesmo tom.
 *
 * **Par nomeado, nunca opacidade**, e nenhum par novo: as cores saem de
 * `COR_DA_CAMADA`, que `check:cores` já mede nos dois temas — a segunda linha
 * herda o primeiro-plano do chip, então ela é o mesmo par medido.
 *
 * *O que o chip custa, e é dito em vez de escondido:* ele passou de uma linha
 * para duas, então um dia com três itens ocupa a célula inteira e a linha da
 * semana cresce. É o preço de a célula dizer de quem é o trabalho em vez de
 * só nomeá-lo, e é a conta que o calendário da Gestão de Tasks já pagou.
 * ---------------------------------------------------------------------------
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
                      const de = faixa.dataInicio;
                      const ate = faixa.dataFim;
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
                            title={`${rotuloDoEvento(faixa)}: ${faixa.titulo}`}
                            style={{ gridColumnStart: inicio + 1, gridColumnEnd: fim + 2 }}
                            className={cn(
                              "truncate rounded px-2 py-1 text-left text-xs font-semibold",
                              corDoEvento(faixa),
                            )}
                          >
                            {faixa.titulo}
                            {segundaLinha(faixa) ? ` · ${segundaLinha(faixa)}` : ""}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="bg-border grid grid-cols-7 gap-px">
                  {semana.map((dia) => {
                    // ERAM DUAS LISTAS, e a segunda era a pilha de avatares
                    // de quem estava fora, no topo da célula. Ela saiu com a
                    // camada de ausência (0105): o avatar vinha de
                    // `item.pessoa`, que a view não escreve mais, e a pergunta
                    // "quem está disponível" é respondida na matriz do Full
                    // Days e na faixa de disponibilidade do painel da etapa.
                    const doDia = pontuais.filter((i) => ocupaODia(i, dia));

                    return (
                      <div
                        key={dia}
                        className={cn(
                          "min-h-32 p-1 text-xs",
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
                        <div className="flex items-center px-1">
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

                        </div>

                        <ul className="mt-1 space-y-1">
                          {doDia.slice(0, NO_DIA).map((item) => {
                            const abaixo = segundaLinha(item);
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => aoAbrir(item)}
                                  title={`${rotuloDoEvento(item)}: ${item.titulo}${item.cliente ? ` — ${item.cliente}` : ""}`}
                                  className={cn(
                                    "block w-full rounded px-1.5 py-1 text-left leading-tight",
                                    corDoEvento(item),
                                  )}
                                >
                                  <span className="block truncate font-semibold">
                                    {item.titulo}
                                  </span>
                                  {abaixo ? (
                                    <span className="block truncate text-[0.6875rem]">
                                      {abaixo}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                          {doDia.length > NO_DIA ? (
                            <li className="text-text-muted px-1.5">
                              + {doDia.length - NO_DIA} mais
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
