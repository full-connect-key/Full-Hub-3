"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { EditorRico, VisualizadorRico } from "@/components/shared/editor-rico";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TaskCompleta } from "@/lib/dados/tasks";

import { atualizarTask } from "../acoes";
import { chamarAcao } from "@/lib/acoes/cliente";

/**
 * Título e briefing do detalhe.
 *
 * O briefing é um editor só, sempre no lugar: o que a pessoa vê é o que está
 * salvo. Antes havia um botão "Editar" que trocava o texto formatado por uma
 * caixa de edição — e alternar entre editor e pré-visualização faz a pessoa
 * duvidar de qual dos dois é o conteúdo de verdade.
 *
 * O salvamento é explícito, num botão que só aparece quando há alteração
 * pendente: salvar a cada tecla mandaria uma escrita por letra digitada.
 */
export function PrincipalDaTask({ task, podeEditar }: { task: TaskCompleta; podeEditar: boolean }) {
  const router = useRouter();

  const rascunho = useRef<{ json: JSONContent; texto: string } | null>(null);
  const [temMudanca, setTemMudanca] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvarBriefing() {
    if (!rascunho.current) return;
    setSalvando(true);
    try {
      const resultado = await chamarAcao(() =>
        atualizarTask(task.id, {
          briefing_rico: rascunho.current!.json,
          briefing_texto: rascunho.current!.texto,
        }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success("Briefing salvo.");
        setTemMudanca(false);
        router.refresh();
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* O TÍTULO SAIU DAQUI e virou `TituloDaTask`, acima das propriedades.
          Ele nomeia a demanda inteira: deixá-lo dentro da aba Trabalho fazia
          a tela abrir com a grade de campos antes do nome do que se está
          lendo — e sumir com o nome ao trocar para o Histórico. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Briefing</h2>
          {podeEditar && temMudanca ? (
            <Button size="sm" onClick={salvarBriefing} disabled={salvando}>
              {salvando ? <Loader2 className="animate-spin" /> : <Check aria-hidden />}
              Salvar briefing
            </Button>
          ) : null}
        </div>

        {podeEditar ? (
          <EditorRico
            conteudo={(task.briefing_rico as JSONContent | null) ?? null}
            onChange={(dados) => {
              rascunho.current = dados;
              if (!temMudanca) setTemMudanca(true);
            }}
          />
        ) : task.briefing_rico ? (
          <div className="rounded-lg border p-4">
            <VisualizadorRico conteudo={task.briefing_rico as JSONContent} />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Sem briefing.</p>
        )}
      </section>
    </div>
  );
}

/**
 * O título da demanda, editável em dois cliques.
 *
 * Componente separado porque mora FORA das abas: ele nomeia a Task inteira, e
 * o que troca entre Trabalho e Histórico é o conteúdo, não o assunto.
 */
export function TituloDaTask({ task, podeEditar }: { task: TaskCompleta; podeEditar: boolean }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(task.titulo);
  const [editando, setEditando] = useState(false);

  function salvar() {
    setEditando(false);
    if (titulo.trim() === task.titulo || titulo.trim().length < 2) {
      setTitulo(task.titulo);
      return;
    }
    void (async () => {
      const resultado = await chamarAcao(() => atualizarTask(task.id, { titulo }));
      if (!resultado.ok) {
        toast.error(resultado.error);
        setTitulo(task.titulo);
      } else router.refresh();
    })();
  }

  if (editando && podeEditar) {
    return (
      <Input
        value={titulo}
        autoFocus
        className="h-auto py-1 text-xl font-semibold md:text-xl"
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setTitulo(task.titulo);
            setEditando(false);
          }
        }}
      />
    );
  }

  return (
    <h1
      className="text-xl font-semibold tracking-tight text-balance"
      onDoubleClick={() => podeEditar && setEditando(true)}
      title={podeEditar ? "Clique duas vezes para renomear" : undefined}
    >
      {task.titulo}
    </h1>
  );
}
