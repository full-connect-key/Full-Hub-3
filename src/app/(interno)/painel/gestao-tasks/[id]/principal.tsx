"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { EditorRico, VisualizadorRico } from "@/components/shared/editor-rico";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TaskCompleta } from "@/lib/dados/tasks";

import { atualizarTask } from "../acoes";

/**
 * Título e briefing do detalhe.
 *
 * Os dois são editáveis no lugar, sem sair da tela. O briefing entra em modo
 * de edição por botão em vez de ao clicar: o texto tem links, e clicar num
 * link não pode virar "começar a editar".
 */
export function PrincipalDaTask({
  task,
  podeEditar,
}: {
  task: TaskCompleta;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();

  const [titulo, setTitulo] = useState(task.titulo);
  const [editandoTitulo, setEditandoTitulo] = useState(false);

  const [editandoBriefing, setEditandoBriefing] = useState(false);
  const [rascunho, setRascunho] = useState<{ json: JSONContent; texto: string } | null>(null);
  const [salvandoBriefing, setSalvandoBriefing] = useState(false);

  function salvarTitulo() {
    setEditandoTitulo(false);
    if (titulo.trim() === task.titulo || titulo.trim().length < 2) {
      setTitulo(task.titulo);
      return;
    }
    iniciar(async () => {
      const resultado = await atualizarTask(task.id, { titulo });
      if (resultado.erro) {
        toast.error(resultado.erro);
        setTitulo(task.titulo);
      } else router.refresh();
    });
  }

  async function salvarBriefing() {
    if (!rascunho) {
      setEditandoBriefing(false);
      return;
    }
    setSalvandoBriefing(true);
    try {
      const resultado = await atualizarTask(task.id, {
        briefing_rico: rascunho.json,
        briefing_texto: rascunho.texto,
      });
      if (resultado.erro) toast.error(resultado.erro);
      else {
        toast.success("Briefing salvo.");
        setEditandoBriefing(false);
        router.refresh();
      }
    } finally {
      setSalvandoBriefing(false);
    }
  }

  return (
    <div className="space-y-6">
      {editandoTitulo && podeEditar ? (
        <Input
          value={titulo}
          autoFocus
          className="h-auto py-1 text-xl font-semibold md:text-xl"
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={salvarTitulo}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setTitulo(task.titulo);
              setEditandoTitulo(false);
            }
          }}
        />
      ) : (
        <h1
          className="text-xl font-semibold tracking-tight text-balance"
          onDoubleClick={() => podeEditar && setEditandoTitulo(true)}
          title={podeEditar ? "Clique duas vezes para renomear" : undefined}
        >
          {task.titulo}
        </h1>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Briefing</h2>
          {podeEditar && !editandoBriefing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditandoBriefing(true)}>
              <Pencil aria-hidden />
              Editar
            </Button>
          ) : null}
        </div>

        {editandoBriefing ? (
          <div className="space-y-2">
            <EditorRico
              conteudo={(task.briefing_rico as JSONContent | null) ?? null}
              onChange={setRascunho}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRascunho(null);
                  setEditandoBriefing(false);
                }}
                disabled={salvandoBriefing}
              >
                <X aria-hidden />
                Cancelar
              </Button>
              <Button size="sm" onClick={salvarBriefing} disabled={salvandoBriefing}>
                {salvandoBriefing ? <Loader2 className="animate-spin" /> : <Check aria-hidden />}
                Salvar briefing
              </Button>
            </div>
          </div>
        ) : task.briefing_rico ? (
          <div className="rounded-lg border p-4">
            <VisualizadorRico conteudo={task.briefing_rico as JSONContent} />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Sem briefing. {podeEditar ? "Use Editar para descrever o que precisa ser feito." : null}
          </p>
        )}
      </section>
    </div>
  );
}
