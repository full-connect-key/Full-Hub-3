"use client";

import { useState, useTransition } from "react";
import { Check, Lock, Play } from "lucide-react";
import { toast } from "sonner";

import { SeletorDeStatusDaSubtarefa } from "@/components/shared/seletor-de-status";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  bloqueioDaEtapa,
  etapaDaVez,
  etapaSeMarcaAMao,
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
        <h3 id="corrente-titulo" className="text-text-primary text-sm font-semibold">
          Corrente
        </h3>
        <span className="text-text-muted text-xs tabular-nums">
          {concluidas} de {total} concluídas
        </span>
      </div>

      <ol className="space-y-1.5">
        {etapas.map((etapa) => {
          const bloqueio = bloqueioDaEtapa(etapa, etapas);
          const minha = etapa.responsavelId === quemSou;
          const podeMover = (minha || ehGestao) && etapaSeMarcaAMao(etapa) && !bloqueio;
          const eADaVez = vez?.id === etapa.id;

          return (
            <li
              key={etapa.id}
              className={cn(
                "rounded-xl border px-3 py-2.5 transition-colors",
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
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                    etapa.status === "concluida"
                      ? "bg-success-soft text-success"
                      : bloqueio
                        ? "bg-muted text-text-muted"
                        : "bg-blue-strong text-white",
                  )}
                  aria-hidden
                >
                  {etapa.status === "concluida" ? (
                    <Check className="size-3.5" />
                  ) : bloqueio ? (
                    <Lock className="size-3" />
                  ) : (
                    <Play className="size-3" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="text-text-primary block text-sm font-medium">
                    {etapa.nome}
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
                <p className="text-text-muted mt-1.5 pl-9 text-xs">{bloqueio}</p>
              ) : !etapaSeMarcaAMao(etapa) ? (
                <p className="text-text-muted mt-1.5 pl-9 text-xs">
                  Acompanha a decisão do cliente — use a ação Enviar ao cliente.
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
