"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { EditorRico, VisualizadorRico } from "@/components/shared/editor-rico";
import { NomeEditavel } from "@/components/shared/nome-editavel";
import { Button } from "@/components/ui/button";
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
export function PrincipalDaTask({
  task,
  podeEditar,
}: {
  task: TaskCompleta;
  podeEditar: boolean;
}) {
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
              {salvando ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check aria-hidden />
              )}
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
 * **A MECÂNICA SAIU DAQUI e virou `NomeEditavel`**, quando o nome da ETAPA
 * passou a ser editável: a pausa de 600 ms, o `blur`, o `Enter` e o "o que
 * falhou fica na tela" eram para ser escritos duas vezes, e o segundo é o que
 * ninguém relê. O que fica aqui é o que é DESTA tela — a escala do texto, o
 * foco no rascunho recém-nascido, e o aviso para a barra de estado.
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

  return (
    <NomeEditavel
      valor={task.titulo}
      podeEditar={podeEditar}
      rotulo="Título da demanda"
      placeholder="Nome da task"
      className="text-xl font-semibold md:text-xl"
      // O cursor começa aqui quando a demanda acabou de nascer. Numa que já
      // tem nome, roubar o foco atrapalharia quem veio ler o briefing.
      autoFocus={task.titulo === ""}
      comoTexto={() => (
        <h1 className="text-xl font-semibold tracking-tight text-balance">
          {task.titulo || "Sem título"}
        </h1>
      )}
      aoGravar={async (novo) => {
        aoSalvar?.("salvando");
        const resultado = await chamarAcao(() =>
          atualizarTask(task.id, { titulo: novo }),
        );
        if (!resultado.ok) {
          aoSalvar?.({ erro: resultado.error });
          toast.error(resultado.error);
          return resultado.error;
        }
        aoSalvar?.("salvo");
        router.refresh();
        return null;
      }}
    />
  );
}
