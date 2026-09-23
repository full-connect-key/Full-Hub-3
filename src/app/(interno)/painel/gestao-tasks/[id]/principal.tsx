"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * O título da demanda, sempre editável, salvando sozinho.
 *
 * Era um `h1` que virava input em dois cliques. Com o rascunho (migration
 * 0028) a tela abre com o título VAZIO e o cursor dentro dele — um `h1` em
 * branco esperando dois cliques seria uma tela que não diz o que fazer.
 *
 * SALVA APÓS UMA PAUSA de 600 ms e também ao sair do campo. A pausa é para
 * não gravar letra a letra; o blur é para não perder o que foi digitado quem
 * fecha a aba logo depois. Os dois juntos, porque cada um cobre o que o outro
 * deixa passar.
 *
 * Componente separado porque mora FORA das abas: ele nomeia a Task inteira, e
 * o que troca entre Trabalho e Histórico é o conteúdo, não o assunto.
 */
export function TituloDaTask({
  task,
  podeEditar,
  aoSalvar,
}: {
  task: TaskCompleta;
  podeEditar: boolean;
  /** Avisa a barra de estado: "salvando" e depois "salvo", ou o erro. */
  aoSalvar?: (estado: "salvando" | "salvo" | { erro: string }) => void;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(task.titulo);
  const pendente = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gravar = useCallback(
    async (valor: string) => {
      if (valor === task.titulo) return;
      aoSalvar?.("salvando");
      const resultado = await chamarAcao(() => atualizarTask(task.id, { titulo: valor }));
      if (!resultado.ok) {
        // O VALOR DIGITADO FICA NA TELA. Devolver o título antigo apagaria o
        // que a pessoa escreveu por causa de uma falha de rede — e ela não
        // tem como saber que perdeu.
        aoSalvar?.({ erro: resultado.error });
        toast.error(resultado.error);
        return;
      }
      aoSalvar?.("salvo");
      router.refresh();
    },
    [task.id, task.titulo, aoSalvar, router],
  );

  useEffect(() => {
    return () => {
      if (pendente.current) clearTimeout(pendente.current);
    };
  }, []);

  function digitou(valor: string) {
    setTitulo(valor);
    if (pendente.current) clearTimeout(pendente.current);
    pendente.current = setTimeout(() => void gravar(valor), 600);
  }

  function saiu() {
    if (pendente.current) clearTimeout(pendente.current);
    void gravar(titulo);
  }

  if (!podeEditar) {
    return (
      <h1 className="text-xl font-semibold tracking-tight text-balance">
        {task.titulo || "Sem título"}
      </h1>
    );
  }

  return (
    <Input
      value={titulo}
      // O cursor começa aqui quando a demanda acabou de nascer. Numa que já
      // tem nome, roubar o foco atrapalharia quem veio ler o briefing.
      autoFocus={task.titulo === ""}
      placeholder="Nome da task"
      aria-label="Título da demanda"
      className="h-auto border-transparent px-2 py-1 text-xl font-semibold shadow-none md:text-xl"
      onChange={(e) => digitou(e.target.value)}
      onBlur={saiu}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
