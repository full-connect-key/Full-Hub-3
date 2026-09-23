"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Rocket, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";

import { publicarTask } from "../acoes";

export type EstadoDoSalvamento = "parado" | "salvando" | "salvo" | { erro: string };

/**
 * A barra do rascunho: o que ainda falta, e o botão que publica.
 *
 * **A DEMANDA JÁ ESTÁ SALVA.** Tudo que a pessoa preenche grava sozinho, campo
 * a campo — o botão não salva nada. Ele muda uma coisa só: a demanda passa a
 * existir para a equipe. Por isso ele se chama "Criar task" e não "Salvar", e
 * por isso fechar a aba no meio não perde nada.
 *
 * **SEM ETAPA, AVISA E DEIXA SEGUIR.** Uma demanda pode nascer antes de
 * alguém saber como ela se divide; travar aqui obrigaria a inventar uma etapa
 * para poder criar. Quem trava de verdade — título, cliente e pasta — é o
 * banco, e a mensagem dele já diz qual dos três falta.
 */
export function BarraDoRascunho({
  taskId,
  temEtapas,
  estado,
}: {
  taskId: string;
  temEtapas: boolean;
  estado: EstadoDoSalvamento;
}) {
  const router = useRouter();
  const [publicando, iniciar] = useTransition();

  function publicar() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => publicarTask(taskId));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-warning-soft flex flex-wrap items-center gap-3 rounded-card border px-4 py-3">
      <Badge variant="outline" className="shrink-0 uppercase">
        Rascunho
      </Badge>

      <p className="text-text-secondary min-w-0 flex-1 text-sm">
        Só você enxerga esta demanda. Ninguém é avisado enquanto ela for um rascunho.
      </p>

      <EstadoDoSalvamentoNaTela estado={estado} />

      {temEtapas ? (
        <Button onClick={publicar} disabled={publicando} className="shrink-0">
          {publicando ? <Loader2 className="animate-spin" /> : <Rocket aria-hidden />}
          Criar task
        </Button>
      ) : (
        // SEM ETAPA O AVISO VEM ANTES, e não é bloqueio: o diálogo diz o que
        // vai acontecer e a pessoa decide. Travar obrigaria a inventar uma
        // etapa só para conseguir criar a demanda.
        <ConfirmDialog
          trigger={
            <Button disabled={publicando} className="shrink-0">
              {publicando ? <Loader2 className="animate-spin" /> : <Rocket aria-hidden />}
              Criar task
            </Button>
          }
          title="Esta task não tem subtarefas"
          description="Ninguém vai ser responsável por nada. Criar assim mesmo?"
          confirmLabel="Criar assim mesmo"
          onConfirm={async () => publicar()}
        />
      )}
    </div>
  );
}

/**
 * "Salvando…" → "Salvo".
 *
 * Discreto de propósito: um spinner grande a cada tecla faria a tela parecer
 * instável justamente quando ela está fazendo o certo. O que precisa ficar
 * visível é o ERRO — e ele fica, porque é o único caso em que a pessoa
 * precisa agir.
 */
export function EstadoDoSalvamentoNaTela({ estado }: { estado: EstadoDoSalvamento }) {
  if (estado === "parado") return null;

  if (estado === "salvando") {
    return (
      <span className="text-text-muted inline-flex shrink-0 items-center gap-1.5 text-xs">
        <Loader2 aria-hidden className="size-3 animate-spin" />
        Salvando…
      </span>
    );
  }

  if (estado === "salvo") {
    return (
      <span className="text-success inline-flex shrink-0 items-center gap-1.5 text-xs">
        <Check aria-hidden className="size-3" />
        Salvo
      </span>
    );
  }

  return (
    <span className="text-danger inline-flex shrink-0 items-center gap-1.5 text-xs">
      <TriangleAlert aria-hidden className="size-3" />
      {estado.erro}
    </span>
  );
}
