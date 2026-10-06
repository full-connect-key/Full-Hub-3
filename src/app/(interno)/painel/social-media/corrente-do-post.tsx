"use client";

import { useState, useTransition } from "react";
import { Check, Lock, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { chamarAcao } from "@/lib/acoes/cliente";
import {
  andamentoDoMes,
  bloqueioDaCaixinha,
  caixinhaSeMarcaAMao,
  etapaDaVezDoPost,
  rotuloDoEnvio,
  type CaixinhaDoPost,
  type EtapaDoMes,
} from "@/lib/dominio/posts";
import { ROTULOS_DE_SUBTAREFA } from "@/lib/tasks/state-machine";
import { cn } from "@/lib/utils";

import { marcarPostNaEtapa } from "./acoes";

/**
 * A corrente do MÊS, vista de dentro de um post (0088).
 *
 * -------------------------------------------------------------------------
 * **O QUE MUDOU: A LINHA É A ETAPA DO MÊS, E O QUE SE MARCA É A CAIXINHA.**
 *
 * Até a 0087 esta lista era a corrente DO POST: cinco subtarefas por peça,
 * cada uma com responsável, prazo e seletor de status próprios. Com dezoito
 * posts isso eram noventa etapas, e a redatora via dezoito linhas "Conteúdo"
 * vencendo no mesmo dia — dezoito trabalhos onde a frase do usuário descreve
 * UM: *"a redatora vai ter um dia pra fazer o conteúdo"* do mês todo.
 *
 * Agora a etapa é do mês e o trabalho é por peça, então a pergunta que esta
 * tela faz mudou de lado: não é "em que pé está a etapa?" — isso é do mês, e
 * o seletor de status dela mora em Gestão de Tasks, onde ela é uma subtarefa
 * comum com cronômetro e as travas da 0007. É **"este post já passou por
 * ela?"**, e a resposta é uma caixa.
 *
 * O seletor de status saiu daqui por isso, e não por simplificação: ele
 * mudaria o andamento do MÊS a partir do painel de uma peça entre dezoito —
 * um clique cujo efeito a pessoa não tem como prever olhando esta tela. O
 * status da etapa fica como SELO, que é honesto: é um fato sobre a fase, e
 * não uma ação sobre este post.
 * -------------------------------------------------------------------------
 *
 * **É UMA LISTA VERTICAL E NÃO UM STEPPER HORIZONTAL**, e a razão não mudou:
 * cada linha carrega a caixa, o nome da fase, quem está com ela e o "12 de
 * 18". Em 375px um stepper de cinco passos com isso embaixo dá setenta pixels
 * por passo — "Marina" vira "Ma…", que não identifica ninguém.
 */
export function CorrenteDoPost({
  etapas,
  caixinhas,
  postId,
  aprovacoesDoCliente,
  quemSou,
  ehGestao,
}: {
  etapas: EtapaDoMes[];
  caixinhas: CaixinhaDoPost[];
  postId: string;
  aprovacoesDoCliente: number;
  quemSou: string;
  ehGestao: boolean;
}) {
  const [pendente, comecarTransicao] = useTransition();
  const [mexendo, setMexendo] = useState<string | null>(null);

  const vez = etapaDaVezDoPost(etapas, caixinhas, postId);
  const { concluidas, total } = andamentoDoMes(etapas);
  const marcado = new Map(
    caixinhas.filter((c) => c.postId === postId).map((c) => [c.etapaId, c]),
  );

  function marcar(etapa: EtapaDoMes, concluido: boolean) {
    setMexendo(etapa.id);
    comecarTransicao(async () => {
      const r = await chamarAcao(() =>
        marcarPostNaEtapa(postId, etapa.id, concluido),
      );
      setMexendo(null);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.error);
    });
  }

  if (etapas.length === 0) return null;

  return (
    <section className="space-y-2" aria-labelledby="corrente-titulo">
      <div className="flex items-baseline justify-between gap-2">
        <h3
          id="corrente-titulo"
          className="text-text-secondary text-[11px] font-bold tracking-wider uppercase"
        >
          Corrente do mês
        </h3>
        {/* O ANDAMENTO AQUI É DO MÊS, e o rótulo diz isso. Sem a palavra, "2 de
            5 fases" numa tela de um post lia como o andamento desta peça — e
            quem contasse as caixinhas marcadas acharia outro número. */}
        <span className="text-text-muted text-xs tabular-nums">
          {concluidas} de {total} fases do mês
        </span>
      </div>

      {/* CADA ELO É UM CARTÃO SOLTO COM A CAIXA À ESQUERDA, e a caixa ocupa o
          lugar do ladrilho de ícone de antes: ali ele era decoração que
          repetia o status, e aqui é a única coisa desta tela sobre a qual
          alguém decide. */}
      <ol className="space-y-2">
        {etapas.map((etapa) => {
          const caixinha = marcado.get(etapa.id);
          const feito = caixinha?.concluido ?? false;
          const bloqueio = bloqueioDaCaixinha(
            etapa,
            etapas,
            caixinhas,
            postId,
            aprovacoesDoCliente,
          );
          const minha = etapa.responsavelId === quemSou;
          const aMao = caixinhaSeMarcaAMao(etapa);
          const podeMarcar = (minha || ehGestao) && aMao && !bloqueio;
          const eADaVez = vez?.id === etapa.id;

          return (
            <li
              key={etapa.id}
              className={cn(
                "rounded-card shadow-cartao border px-3 py-2.5 transition-colors",
                feito
                  ? "border-border bg-muted"
                  : eADaVez
                    ? "border-accent-strong bg-blue-soft"
                    : "border-border bg-surface-card",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {podeMarcar ? (
                  /* Checkbox nativo, como no resto do produto: o Radix traria
                     uma dependência inteira para um controle que o navegador
                     já faz bem, e `accent-brand` já o pinta com a cor da
                     marca. */
                  <input
                    type="checkbox"
                    className="accent-brand size-4 shrink-0"
                    checked={feito}
                    disabled={pendente && mexendo === etapa.id}
                    onChange={(e) => marcar(etapa, e.target.checked)}
                    aria-label={
                      feito
                        ? `Desmarcar este post em ${etapa.titulo}`
                        : `Marcar este post em ${etapa.titulo}`
                    }
                  />
                ) : (
                  /* SEM A CAIXA DESLIGADA, e isto é regra deste produto: uma
                     caixa cinza não diz por quê. O que entra é o estado — o
                     visto de quem já passou, o cadeado de quem não pode —, e a
                     razão vai escrita na linha de baixo. */
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-md",
                      feito ? "bg-success-soft text-success" : "bg-muted text-text-muted",
                    )}
                    aria-hidden
                  >
                    {feito ? <Check className="size-3" /> : <Lock className="size-2.5" />}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-text-primary text-sm font-bold tracking-[-0.01em]">
                      {etapa.titulo}
                    </span>
                    {/* O SELO DIZ QUE ESTA FASE SAI DA AGÊNCIA (0076), e é a
                        informação que muda o que a pessoa faz: ela escreve a
                        pauta e para — não marca, envia. Sem o selo, a única
                        pista seria a recusa do banco no clique, e descobrir uma
                        regra levando "não" é o que este produto evita desde o
                        botão desligado com a razão escrita. */}
                    {etapa.portao ? (
                      <span
                        className="bg-warning-soft text-warning inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                        title="Esta conta pede o aval do cliente nesta etapa."
                      >
                        <UserCheck aria-hidden className="size-3 shrink-0" />
                        Cliente aprova
                      </span>
                    ) : null}
                  </span>
                  {/* QUEM ESTÁ COM A FASE E O ANDAMENTO DELA. O "12 de 18" é o
                      contexto que faltava: a minha caixinha é uma de dezoito, e
                      sem o total a pessoa não sabe se é a primeira ou a última
                      da fila da própria fase. */}
                  <span className="text-text-secondary block text-xs">
                    {etapa.responsavel ?? "sem dono"}
                    {etapa.total > 0 ? ` · ${etapa.feitos} de ${etapa.total}` : ""}
                  </span>
                </span>

                {/* O STATUS DA FASE É SELO E NUNCA SELETOR, e é honesto: ele é
                    do mês, calculado pelo trabalho das dezoito peças, e mexer
                    nele daqui mudaria a fase a partir de uma delas. */}
                <span className="text-text-secondary bg-muted rounded-lg px-2 py-1 text-xs">
                  {ROTULOS_DE_SUBTAREFA[etapa.status]}
                </span>
              </div>

              {/* O PEDIDO DO CLIENTE VEM PRIMEIRO, e é a única coisa desta tela
                  que alguém de fora escreveu.

                  Ele é o que sobrou da etapa de Ajustes da 0045: com a etapa
                  sendo do mês, criar uma "Ajustes" por pedido afirmaria que o
                  mês inteiro voltou por causa de uma peça. Quem escreve é
                  `posts_corrente_do_cliente`, no instante da recusa, e ele
                  aparece aqui porque é aqui que quem refaz vai olhar — não na
                  rodada, que a tela de produção não mostra. */}
              {caixinha?.observacao ? (
                <p className="text-warning bg-warning-soft rounded-card mt-1.5 ml-8 px-2 py-1.5 text-xs">
                  O cliente pediu: {caixinha.observacao}
                </p>
              ) : null}

              {/* A RAZÃO FICA ESCRITA, e não numa caixa desligada. Esta tela
                  aprendeu isso com o seletor de status da etapa de demanda:
                  quem recusa é o banco, e a recusa dele diz o caminho. */}
              {bloqueio ? (
                <p className="text-text-muted mt-1.5 ml-8 text-xs">{bloqueio}</p>
              ) : !aMao ? (
                /* A CAIXINHA DA ENTREGA É CONSEQUÊNCIA DA APROVAÇÃO, nunca da
                   mão de ninguém — a regra da 0045 um nível abaixo. Marcar
                   afirmaria que a peça foi e voltou aprovada sem nada ter
                   saído da agência.

                   O nome do botão sai de `rotuloDoEnvio`, e não escrito aqui:
                   a instrução e o botão que ela manda apertar divergiriam na
                   primeira vez que alguém mexesse num dos dois. */
                <p className="text-text-muted mt-1.5 ml-8 text-xs">
                  Fecha com a aprovação do cliente — use a ação{" "}
                  {rotuloDoEnvio(etapa)}.
                </p>
              ) : etapa.portao && !feito ? (
                <p className="text-text-muted mt-1.5 ml-8 text-xs">
                  Marque quando terminar esta peça; quem fecha a fase com o
                  cliente é a ação {rotuloDoEnvio(etapa)}.
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * ---------------------------------------------------------------------------
 * `ResumoDaCorrente` SAIU, e ela nunca teve chamador nenhum.
 *
 * Ela dizia, no próprio comentário, que era "o resumo de uma linha, para o
 * cartão da lista e o card do calendário" — e nenhuma das duas telas a
 * importava, em nenhum momento desde que ela nasceu. Era uma promessa escrita
 * ao lado de código que o produto não executava, que é a classe de coisa que
 * alguém lê três sprints depois como se fosse verdade.
 *
 * **E não foi mantida ao lado da `CorrenteDoPost` nova**, que é a decisão da
 * 0023: a fase da vez de uma peça pede as caixinhas DELA
 * (`etapaDaVezDoPost()`), e a lista do mês tem até duzentas linhas — carregar
 * noventa caixinhas para escrever uma palavra por cartão é exatamente o que a
 * consulta do selo "Programado" existe para não fazer. O que a linha já diz é
 * a MÃO do post, que é derivada das colunas dele e não custa consulta
 * nenhuma.
 *
 * Se um dia a lista precisar da fase por peça, o caminho é uma consulta em
 * bloco das caixinhas dos posts da página — não este componente de volta.
 * ---------------------------------------------------------------------------
 */
