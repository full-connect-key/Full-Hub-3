"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, Send } from "lucide-react";

import { comentarNoPost } from "@/app/(cliente)/portal/_actions/posts";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { ComentarioDoPost } from "@/lib/dados/posts";
import { tempoRelativo } from "@/lib/dominio/recomendacoes";
import { cn } from "@/lib/utils";

/**
 * A conversa sobre o material.
 *
 * **Um nível de resposta, e o banco garante isso** — `comments_um_nivel`
 * reescreve resposta de resposta como resposta da raiz. Aqui a tela só não
 * oferece o botão na resposta; é a mesma divisão de sempre: a tela evita o
 * caso, o banco é quem o impede.
 *
 * **Comentário interno não chega aqui**, e não é esta tela que filtra:
 * `comments_select_cliente` exige `interno = false`. Para a equipe, que lê os
 * dois, o marcador aparece — é a única diferença entre as duas visões.
 *
 * **O "agora" desce do servidor.** `tempoRelativo` recebe o instante em vez de
 * ler o relógio, senão o servidor renderiza "há 2 horas" e o navegador, noutro
 * fuso, recalcula outra coisa na hidratação.
 */
export function ThreadDeComentarios({
  postId,
  comentarios,
  agora,
  nomeDaEmpresa,
  somenteLeitura = false,
}: {
  postId: string;
  comentarios: ComentarioDoPost[];
  agora: string;
  nomeDaEmpresa: string;
  somenteLeitura?: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const raizes = comentarios.filter((c) => c.respostaA === null);
  const respostas = (id: string) =>
    comentarios.filter((c) => c.respostaA === id);

  function enviar() {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        comentarNoPost(postId, texto, respondendo),
      );
      if (resultado.ok) {
        setTexto("");
        setRespondendo(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Comentários</h2>

      {raizes.length === 0 ? (
        <p className="text-text-muted text-sm">
          Nenhum comentário ainda. Use este espaço para falar sobre este
          material.
        </p>
      ) : (
        <ul className="space-y-4">
          {raizes.map((comentario) => (
            <li key={comentario.id} className="space-y-3">
              <Comentario
                comentario={comentario}
                agora={agora}
                nomeDaEmpresa={nomeDaEmpresa}
                aoResponder={
                  somenteLeitura
                    ? undefined
                    : () => setRespondendo(comentario.id)
                }
              />

              {respostas(comentario.id).length > 0 ? (
                <ul className="space-y-3 border-l pl-4 sm:pl-6">
                  {respostas(comentario.id).map((resposta) => (
                    <li key={resposta.id}>
                      <Comentario
                        comentario={resposta}
                        agora={agora}
                        nomeDaEmpresa={nomeDaEmpresa}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {somenteLeitura ? null : (
        // NO CELULAR O CAMPO FICA PRESO AO RODAPÉ. Numa thread longa, um campo
        // no fim da lista obriga a rolar até o fim para responder — e a pessoa
        // perde de vista o comentário que estava lendo.
        <div className="bg-surface-card sticky bottom-0 -mx-4 space-y-2 border-t p-4 sm:static sm:mx-0 sm:rounded-xl sm:border sm:p-4">
          {respondendo ? (
            <p className="text-text-muted flex items-center gap-1.5 text-xs">
              <CornerDownRight aria-hidden className="size-3.5" />
              Respondendo
              <button
                type="button"
                onClick={() => setRespondendo(null)}
                className="text-accent-strong hover:underline"
              >
                cancelar
              </button>
            </p>
          ) : null}

          <Textarea
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            rows={3}
            placeholder="Escreva um comentário"
            aria-label="Novo comentário"
          />

          <div className="flex justify-end">
            <Button
              onClick={enviar}
              disabled={enviando || texto.trim().length === 0}
            >
              <Send aria-hidden className="size-4" />
              Comentar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Comentario({
  comentario,
  agora,
  nomeDaEmpresa,
  aoResponder,
}: {
  comentario: ComentarioDoPost;
  agora: string;
  nomeDaEmpresa: string;
  aoResponder?: () => void;
}) {
  const quando = tempoRelativo(comentario.quando, agora);

  return (
    <div className="flex gap-3">
      <UserAvatar name={comentario.autor} size="sm" className="shrink-0" />

      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{comentario.autor}</span>
          {/* A identificação é a ORGANIZAÇÃO, e não o cargo: o cliente não
              precisa saber quem é desenvolvedor e quem é social media. */}
          <span className="text-text-muted text-xs">
            {comentario.daAgencia ? "Full Connect Key" : nomeDaEmpresa}
          </span>
          {quando ? (
            <span className="text-text-muted text-xs">{quando}</span>
          ) : null}
          {comentario.interno ? (
            <span className="bg-warning-soft text-warning rounded px-1.5 py-0.5 text-[0.65rem] font-medium">
              Interno
            </span>
          ) : null}
        </p>

        <p
          className={cn(
            "text-sm whitespace-pre-wrap",
            comentario.interno && "italic",
          )}
        >
          {comentario.texto}
        </p>

        {aoResponder ? (
          <button
            type="button"
            onClick={aoResponder}
            className="text-accent-strong text-xs hover:underline"
          >
            Responder
          </button>
        ) : null}
      </div>
    </div>
  );
}
