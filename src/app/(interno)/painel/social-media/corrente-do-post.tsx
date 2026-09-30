"use client";

import { useState, useTransition } from "react";
import { Check, Lock, Play, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { SeletorDeStatusDaSubtarefa } from "@/components/shared/seletor-de-status";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  bloqueioDaEtapa,
  etapaDaVez,
  etapaEsperaOCliente,
  etapaSeMarcaAMao,
  rotuloDoEnvio,
  andamentoDaCorrente,
  type EtapaDoPost,
} from "@/lib/dominio/posts";
import { ROTULOS_DE_SUBTAREFA } from "@/lib/tasks/state-machine";
import { cn } from "@/lib/utils";
import type { SubtaskStatus } from "@/lib/supabase/database.types";

import { moverEtapaDoPost } from "./acoes";

/**
 * A corrente de etapas do post (0045).
 *
 * Pauta → Conteúdo → Layout → Envio → Programar, com "Ajustes" entrando entre
 * as duas últimas quando o cliente pede.
 *
 * **É UMA LISTA VERTICAL E NÃO UM STEPPER HORIZONTAL**, e a razão é o número
 * de etapas somado ao que cada uma carrega: cinco vira seis, sete, oito a cada
 * pedido do cliente, e cada uma precisa mostrar o nome de quem está com ela.
 * Em 375px um stepper de oito passos com nome embaixo dá quarenta pixels por
 * passo — "Marina" vira "Ma…", que não identifica ninguém.
 *
 * **O andamento é o SELETOR, e não um botão de concluir**, como o selo de
 * status de cada etapa no detalhe da Task: quem faz a etapa muda o próprio
 * andamento onde já estava olhando. As duas exceções viram texto e não item
 * desligado — item cinza não diz por quê.
 */
export function CorrenteDoPost({
  etapas,
  quemSou,
  ehGestao,
}: {
  etapas: EtapaDoPost[];
  quemSou: string;
  ehGestao: boolean;
}) {
  const [pendente, comecarTransicao] = useTransition();
  const [mexendo, setMexendo] = useState<string | null>(null);

  const vez = etapaDaVez(etapas);
  const { concluidas, total } = andamentoDaCorrente(etapas);

  function mover(etapa: EtapaDoPost, status: SubtaskStatus) {
    setMexendo(etapa.id);
    comecarTransicao(async () => {
      const r = await chamarAcao(() => moverEtapaDoPost(etapa.id, { status }));
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
          Corrente
        </h3>
        <span className="text-text-muted text-xs tabular-nums">
          {concluidas} de {total} concluídas
        </span>
      </div>

      {/* CADA ELO É UM CARTÃO SOLTO COM LADRILHO DE ÍCONE, e é o desenho do
          "Precisa de mim" da Home aplicado aqui: cada etapa é o trabalho de
          uma pessoa diferente, e num contêiner com fios o que se lê primeiro é
          a caixa. O ladrilho quadrado troca o círculo de antes pelo mesmo
          formato que o produto usa para dizer "isto é uma linha sobre a qual
          alguém decide". */}
      <ol className="space-y-2">
        {etapas.map((etapa) => {
          const bloqueio = bloqueioDaEtapa(etapa, etapas);
          const minha = etapa.responsavelId === quemSou;
          const podeMover = (minha || ehGestao) && etapaSeMarcaAMao(etapa) && !bloqueio;
          const eADaVez = vez?.id === etapa.id;

          return (
            <li
              key={etapa.id}
              className={cn(
                "rounded-card shadow-cartao border px-3 py-2.5 transition-colors",
                etapa.status === "concluida"
                  ? "border-border bg-muted"
                  : eADaVez
                    ? "border-accent-strong bg-blue-soft"
                    : "border-border bg-surface-card",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs",
                    etapa.status === "concluida"
                      ? "bg-success-soft text-success"
                      : bloqueio
                        ? "bg-muted text-text-muted"
                        : "bg-action-soft text-action-text",
                  )}
                  aria-hidden
                >
                  {etapa.status === "concluida" ? (
                    <Check className="size-4" />
                  ) : bloqueio ? (
                    <Lock className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-text-primary text-sm font-bold tracking-[-0.01em]">
                      {etapa.nome}
                    </span>
                    {/* O SELO DIZ QUE ESTA ETAPA SAI DA AGÊNCIA (0076), e é a
                        informação que muda o que a pessoa faz: ela produz a
                        pauta e para — não conclui, envia. Sem o selo, a única
                        pista seria a recusa do banco no clique de concluir, e
                        descobrir uma regra levando "não" é o que este produto
                        evita desde o botão desligado com a razão escrita. */}
                    {etapaEsperaOCliente(etapa) ? (
                      <span
                        className="bg-warning-soft text-warning inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                        title="Esta conta pede o aval do cliente nesta etapa."
                      >
                        <UserCheck aria-hidden className="size-3 shrink-0" />
                        Cliente aprova
                      </span>
                    ) : null}
                  </span>
                  {/* A FUNÇÃO E A PESSOA, e não só a pessoa: "Design" é o que a
                      etapa é, e o nome é quem está com ela hoje. Sem o nome,
                      ninguém sabe a quem perguntar; sem a função, a etapa sem
                      dono não diz nem que tipo de gente ela espera. */}
                  <span className="text-text-secondary block text-xs">
                    {etapa.funcao}
                    {etapa.responsavel ? ` · ${etapa.responsavel}` : " · sem dono"}
                  </span>
                </span>

                {podeMover ? (
                  <SeletorDeStatusDaSubtarefa
                    status={etapa.status}
                    podeEditar={!(pendente && mexendo === etapa.id)}
                    aoMudar={(status) => mover(etapa, status)}
                    compacto
                  />
                ) : (
                  <span className="text-text-secondary bg-muted rounded-lg px-2 py-1 text-xs">
                    {ROTULOS_DE_SUBTAREFA[etapa.status]}
                  </span>
                )}
              </div>

              {/* A RAZÃO FICA ESCRITA, e não num item desligado do seletor.
                  Esta tela aprendeu isso com o seletor de status da etapa de
                  demanda: quem recusa é o banco, e a recusa dele diz o
                  caminho. */}
              {bloqueio ? (
                <p className="text-text-muted mt-1.5 pl-11 text-xs">{bloqueio}</p>
              ) : !etapaSeMarcaAMao(etapa) ? (
                <p className="text-text-muted mt-1.5 pl-11 text-xs">
                  Acompanha a decisão do cliente — use a ação Enviar ao cliente.
                </p>
              ) : etapaEsperaOCliente(etapa) && etapa.status !== "concluida" ? (
                /* O SELETOR CONTINUA AQUI, e a frase diz onde ele para: quem
                   escreve a pauta marca "em andamento" e trabalha; quem fecha
                   esta etapa é a decisão de fora. Trocar o seletor por um selo
                   travaria a primeira etapa da corrente para sempre.

                   **E ela SOME quando a etapa fecha**, que foi o que a imagem
                   do protótipo mostrou: instrução em cima de coisa que já
                   aconteceu é ruído na linha que a pessoa lê para saber o que
                   fazer agora. O SELO fica — ele não manda fazer nada, diz que
                   aquela etapa passou pelo cliente, e isso continua sendo um
                   fato sobre ela depois de fechada.

                   O nome do botão sai de `rotuloDoEnvio`, e não escrito aqui:
                   a instrução e o botão que ela manda apertar divergiriam na
                   primeira vez que alguém mexesse num dos dois. */
                <p className="text-text-muted mt-1.5 pl-11 text-xs">
                  Quem fecha esta etapa é o cliente — use a ação{" "}
                  {rotuloDoEnvio(etapa)}.
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** O resumo de uma linha, para o cartão da lista e o card do calendário. */
export function ResumoDaCorrente({ etapas }: { etapas: EtapaDoPost[] }) {
  const vez = etapaDaVez(etapas);
  if (!vez) return null;
  return (
    <span className="text-text-secondary text-xs">
      {vez.nome}
      {vez.responsavel ? ` · ${vez.responsavel}` : ""}
    </span>
  );
}
