"use client";

import { useTransition, useState, useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Images } from "lucide-react";
import { toast } from "sonner";

import { GrupoDobravel } from "@/components/shared/grupo-dobravel";
import { SeletorDeStatusDaSubtarefa } from "@/components/shared/seletor-de-status";
import { chamarAcao } from "@/lib/acoes/cliente";
import { agruparSocialPorConta, rotuloDaData } from "@/lib/dominio/posts";
import { cn } from "@/lib/utils";
import type { EtapaDeSocialMinha } from "@/lib/dados/social-media";
import type { SubtaskStatus } from "@/lib/supabase/database.types";

import { moverEtapaDoPost } from "../social-media/acoes";

/**
 * As minhas etapas do Social, dentro de Minhas Tasks.
 *
 * **Bloco próprio e não itens misturados à lista de etapas de demanda**, e a
 * razão é o que cada uma carrega. A etapa de demanda é uma `SubtarefaDetalhada`
 * — rodada de aprovação, cronômetro, dependência cadastrada, a máquina de
 * estados que decide qual botão aparece. Uma etapa de post não tem nada disso,
 * e fabricar os campos para ela caber no mesmo molde faria a tela oferecer
 * "Enviar para aprovação" onde o banco responde outra coisa. O molde errado
 * mente com mais convicção que a ausência.
 *
 * **O QUE SE PERDE, e é consequência aceita:** a ordem não é global entre os
 * dois tipos — uma etapa de social que vence amanhã fica abaixo de uma etapa
 * de demanda que vence semana que vem. O que se ganha é que o redator abre UMA
 * tela para saber o que faz hoje, em vez de duas; duas caixas de entrada são
 * uma caixa que alguém deixa de olhar.
 *
 * A camada de dados já tirou daqui as que ainda não podem começar: uma etapa
 * de Layout cujo Conteúdo ninguém escreveu não é trabalho meu hoje, e o banco
 * recusaria o clique.
 *
 * **ELE FICA ACIMA DO SELETOR DE VISÃO, e não dentro da Lista com as outras
 * duas áreas.** A razão é mecânica e não de gosto: o board desenha colunas dos
 * seis status da etapa de demanda e o calendário desenha prazos de demanda —
 * nenhum dos dois sabe desenhar uma etapa de post. Posto dentro da Lista, o
 * Social sumiria em duas das três visões, e quem trabalha no board perderia a
 * área inteira sem nada dizendo por quê.
 *
 * ---------------------------------------------------------------------------
 * **SÃO TRÊS NÍVEIS: CONTA › DEMANDA DO MÊS › POST**, e não mais uma lista
 * corrida. Relato do usuário: *"Quando abro um mês de social, ele ainda não
 * está ficando separado pelo Social de mês específico, de uma conta
 * específica (…) Preciso que ele apareça como uma Task mãe, com cada post
 * sendo uma subtarefa"*.
 *
 * **Ele estava certo, e os três níveis já existiam no banco** — a conta, a
 * demanda do mês (`tasks.social_do_mes`, migration 0061) e o post
 * (`posts.subtask_id`, 0032). O que faltava era a tela atravessar a ponte, e
 * é por isso que nada disto tem migration: é leitura e desenho.
 *
 * **O que a lista corrida custava:** dezoito etapas "Layout" seguidas, todas
 * com o mesmo nome, e a conta repetida dezoito vezes na linhagem. O olho não
 * tinha como ver que são o mesmo trabalho do mesmo mês da mesma conta — que é
 * exatamente a informação que decide em que ordem a pessoa os faz.
 *
 * **O ITEM CONTINUA SENDO A ETAPA, e isto é regra e não detalhe.** Se a Pauta
 * e o Programar do mesmo post são meus, são **duas linhas** — dois trabalhos,
 * em dois momentos. É a decisão do Sprint 10 ("Minhas Tasks lista ETAPAS, não
 * demandas"), e o agrupamento muda o que fica ACIMA da linha, nunca o que a
 * linha é.
 *
 * **DENTRO DO GRUPO, O POST É QUE CARREGA O PESO.** É a inversão de fora: na
 * lista corrida o título era a etapa, porque era ela que variava. Agrupado por
 * mês, o nome da etapa é quase sempre o MESMO em todas as linhas do grupo
 * ("Layout", dezoito vezes), e o que distingue uma linha da outra é o post.
 * É a decisão do selo de status que some dentro do grupo: o que o cabeçalho e
 * os vizinhos já dizem não ganha a escala grande.
 *
 * **A FAIXA DO MÊS É UM LINK PARA A DEMANDA**, e é ela que entrega o pedido
 * dele: a Task mãe existe, tem nome, e dali se vê o mês inteiro com os posts
 * das outras pessoas. Sem o link, "Task mãe" seria uma palavra na tela sem
 * nada atrás.
 *
 * **O POST AVULSO ENTRA NA CONTA, SEM FAIXA.** Ele não nasceu de um mês
 * aberto, então não há demanda a nomear — e uma faixa inventada afirmaria que
 * existe uma que ninguém abriu.
 *
 * **A CONTA DOBRA, e o que está fechado mora na URL** (`socialFechado`), como
 * todo filtro de listagem. Parâmetro próprio para não se misturar com os
 * grupos de status da Lista, que é a razão pela qual `GrupoDobravel` tem o
 * `parametro`.
 * ---------------------------------------------------------------------------
 */
export function EtapasDeSocial({ etapas }: { etapas: EtapaDeSocialMinha[] }) {
  const [, comecar] = useTransition();
  const [mexendo, setMexendo] = useState<string | null>(null);

  const contas = useMemo(() => agruparSocialPorConta(etapas), [etapas]);

  if (etapas.length === 0) return null;

  function mover(etapa: EtapaDeSocialMinha, status: SubtaskStatus) {
    setMexendo(etapa.id);
    comecar(async () => {
      const r = await chamarAcao(() => moverEtapaDoPost(etapa.id, { status }));
      setMexendo(null);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.error);
    });
  }

  return (
    <section className="space-y-2" aria-labelledby="social-titulo">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="social-titulo"
          className="text-text-primary flex items-center gap-2 text-sm font-semibold"
        >
          <Images aria-hidden className="text-text-muted size-4" />
          Social Media
          {/* A CONTAGEM DIZ AS DUAS COISAS, porque o grupo fechado esconde as
              linhas e não os números: quantas etapas são minhas e em quantas
              contas elas estão. "18" sozinho num dia em que elas vêm de duas
              empresas esconde justamente o que o agrupamento existe para
              mostrar. */}
          <span className="text-text-muted font-normal tabular-nums">
            {contas.length > 1
              ? `${etapas.length} em ${contas.length} contas`
              : etapas.length}
          </span>
        </h2>
        <Link
          href="/painel/social-media"
          className="text-accent-strong text-xs hover:underline"
        >
          Ver a área
        </Link>
      </div>

      <div className="space-y-2.5">
        {contas.map((conta) => (
          <div
            key={conta.clienteId}
            className="border-border bg-surface-card rounded-card shadow-cartao border p-3"
          >
            <GrupoDobravel
              chave={conta.clienteId}
              titulo={conta.cliente}
              contagem={conta.total}
              parametro="socialFechado"
            >
              <div className="space-y-3 pt-1">
                {conta.meses.map((mes) => (
                  <div key={mes.demanda?.id ?? "avulsos"} className="space-y-1.5">
                    {mes.demanda ? (
                      <div className="bg-action-soft flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl px-3 py-2">
                        <Link
                          href={`/painel/gestao-tasks/${mes.demanda.id}`}
                          className="text-action-text text-sm font-semibold hover:underline"
                        >
                          {mes.demanda.titulo}
                        </Link>
                        {/* SEM `/85`, e foi o axe que cobrou: opacidade em texto dá uma cor
                            que ninguém mediu, e no tema escuro dá outra — a
                            regra que o produto já tinha escrita para o selo de
                            estado, valendo aqui. `--action-text` sobre
                            `--action-soft` é o par medido (5,88:1), e quem
                            separa o título da contagem é o PESO, que é o
                            sinal que não depende de a pessoa enxergar bem. */}
                        <span className="text-action-text text-xs font-normal tabular-nums">
                          {mes.etapas.length === 1
                            ? "1 etapa sua"
                            : `${mes.etapas.length} etapas suas`}
                        </span>
                      </div>
                    ) : (
                      /* SEM FAIXA DE MÊS, e com o rótulo dizendo por quê: um
                         post avulso não veio de um mês aberto. */
                      <p className="text-text-muted px-1 text-xs">
                        Fora de um mês aberto
                      </p>
                    )}

                    <ul className="space-y-1.5">
                      {mes.etapas.map((etapa) => (
                        <li
                          key={etapa.id}
                          className="border-border flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2.5"
                        >
                          <span className="min-w-0 flex-1">
                            <Link
                              href={`/painel/social-media?post=${etapa.postId}`}
                              className="text-text-primary block truncate text-sm font-medium hover:underline"
                            >
                              {etapa.tema}
                            </Link>
                            {/* A ETAPA, agora como linhagem: dentro do mês ela
                                é quase sempre a mesma em todas as linhas, e o
                                que varia é o post acima. */}
                            <span className="text-text-secondary block truncate text-xs">
                              {etapa.nome}
                            </span>
                          </span>

                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              etapa.dataPublicacao
                                ? "text-text-secondary"
                                : "text-text-muted",
                            )}
                          >
                            {/* A DATA DO POST E NÃO UM PRAZO DA ETAPA: a etapa
                                não tem prazo próprio quando o mês abre em
                                branco, e o que a pessoa precisa saber é quando
                                aquilo vai ao ar. "Sem data" é a instrução —
                                alguém ainda vai escolher o dia. */}
                            {rotuloDaData(
                              etapa.dataPublicacao
                                ? format(parseISO(etapa.dataPublicacao), "dd/MM")
                                : null,
                            )}
                          </span>

                          <SeletorDeStatusDaSubtarefa
                            status={etapa.status}
                            podeEditar={mexendo !== etapa.id}
                            aoMudar={(status) => mover(etapa, status)}
                            compacto
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </GrupoDobravel>
          </div>
        ))}
      </div>
    </section>
  );
}
