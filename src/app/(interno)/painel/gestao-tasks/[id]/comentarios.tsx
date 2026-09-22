"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CornerDownRight, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Pessoa } from "@/lib/dados/tasks";
import type { TaskComentario } from "@/lib/supabase/database.types";

import { comentar, removerComentario } from "../acoes-de-itens";
import { chamarAcao } from "@/lib/acoes/cliente";

type ComentarioCompleto = TaskComentario & { autor: Pessoa | null };

/**
 * Destaca as menções no texto.
 *
 * Por ora é só visual: a notificação de quem foi mencionado entra no Sprint 16.
 * O destaque já existe porque, sem ele, um "@ana" no meio do parágrafo some.
 */
function ComTexto({ texto }: { texto: string }) {
  const partes = texto.split(/(@[\p{L}][\p{L}0-9._-]*)/gu);
  return (
    <p className="text-sm whitespace-pre-wrap">
      {partes.map((parte, indice) =>
        parte.startsWith("@") ? (
          <span key={indice} className="bg-brand/10 text-brand rounded px-1 font-medium">
            {parte}
          </span>
        ) : (
          <span key={indice}>{parte}</span>
        ),
      )}
    </p>
  );
}

function Comentario({
  comentario,
  respostas,
  taskId,
  usuarioId,
  podeModerar,
  aoResponder,
}: {
  comentario: ComentarioCompleto;
  respostas: ComentarioCompleto[];
  taskId: string;
  usuarioId: string;
  podeModerar: boolean;
  aoResponder: (id: string, nome: string) => void;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const meu = comentario.autor_id === usuarioId;

  function remover(id: string) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => removerComentario(id, taskId));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  return (
    <li className="space-y-3">
      <div className="flex gap-3">
        <UserAvatar
          name={comentario.autor?.nome ?? "Alguém"}
          src={comentario.autor?.avatar_url}
          size="sm"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">{comentario.autor?.nome ?? "Alguém"}</span>
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(parseISO(comentario.created_at), {
                locale: ptBR,
                addSuffix: true,
              })}
            </span>
          </div>

          <ComTexto texto={comentario.texto} />

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => aoResponder(comentario.id, comentario.autor?.nome ?? "")}
            >
              Responder
            </Button>
            {meu || podeModerar ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => remover(comentario.id)}
              >
                <Trash2 aria-hidden className="size-3" />
                Remover
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {respostas.length > 0 ? (
        <ul className="ml-4 space-y-3 border-l pl-4">
          {respostas.map((resposta) => (
            <li key={resposta.id} className="flex gap-3">
              <CornerDownRight aria-hidden className="text-muted-foreground mt-1 size-3.5 shrink-0" />
              <UserAvatar
                name={resposta.autor?.nome ?? "Alguém"}
                src={resposta.autor?.avatar_url}
                size="sm"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium">{resposta.autor?.nome ?? "Alguém"}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(parseISO(resposta.created_at), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <ComTexto texto={resposta.texto} />
                {resposta.autor_id === usuarioId || podeModerar ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => remover(resposta.id)}
                  >
                    <Trash2 aria-hidden className="size-3" />
                    Remover
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Comentarios({
  taskId,
  comentarios,
  usuarioId,
  podeModerar,
}: {
  taskId: string;
  comentarios: ComentarioCompleto[];
  usuarioId: string;
  podeModerar: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState<{ id: string; nome: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  const raiz = comentarios.filter((c) => !c.resposta_a);
  const porPai = new Map<string, ComentarioCompleto[]>();
  for (const comentario of comentarios) {
    if (!comentario.resposta_a) continue;
    porPai.set(comentario.resposta_a, [...(porPai.get(comentario.resposta_a) ?? []), comentario]);
  }

  function publicar() {
    if (texto.trim().length === 0) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() => comentar(taskId, texto, respondendo?.id ?? null));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        setTexto("");
        setRespondendo(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold">
        Comentários{" "}
        {comentarios.length > 0 ? (
          <span className="text-muted-foreground font-normal tabular-nums">
            {comentarios.length}
          </span>
        ) : null}
      </h2>

      {raiz.length > 0 ? (
        <ul className="space-y-5">
          {raiz.map((comentario) => (
            <Comentario
              key={comentario.id}
              comentario={comentario}
              respostas={porPai.get(comentario.id) ?? []}
              taskId={taskId}
              usuarioId={usuarioId}
              podeModerar={podeModerar}
              aoResponder={(id, nome) => setRespondendo({ id, nome })}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nenhum comentário ainda. Use @ para mencionar alguém.
        </p>
      )}

      <div className="space-y-2">
        {respondendo ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <CornerDownRight aria-hidden className="size-3.5" />
            Respondendo {respondendo.nome}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              onClick={() => setRespondendo(null)}
            >
              cancelar
            </Button>
          </div>
        ) : null}

        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentário. Use @ para mencionar alguém."
          rows={3}
        />
        <div className="flex justify-end">
          <Button onClick={publicar} disabled={enviando || texto.trim().length === 0}>
            {enviando ? <Loader2 className="animate-spin" /> : <Send aria-hidden />}
            Comentar
          </Button>
        </div>
      </div>
    </section>
  );
}
