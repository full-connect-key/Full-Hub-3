"use client";

import { useState } from "react";

import type { TaskCompleta } from "@/lib/dados/tasks";

import { BarraDoRascunho, EstadoDoSalvamentoNaTela, type EstadoDoSalvamento } from "./barra-do-rascunho";
import { TituloDaTask } from "./principal";

/**
 * Título e, quando é rascunho, a barra que publica.
 *
 * Existe porque o estado do salvamento nasce no título (que grava sozinho ao
 * digitar) e precisa ser mostrado na barra, ao lado do botão. Eram dois
 * componentes irmãos sem nada entre eles; este é o pedaço de cliente que
 * segura o "Salvando… / Salvo" para os dois.
 *
 * Fora do rascunho a barra some e o indicador vai para o lado do título: a
 * demanda publicada continua salvando sozinha, e quem edita o nome de uma
 * campanha no ar quer a mesma confirmação de que gravou.
 */
export function CabecalhoDaTask({
  task,
  podeEditar,
  temEtapas,
}: {
  task: TaskCompleta;
  podeEditar: boolean;
  temEtapas: boolean;
}) {
  const [estado, setEstado] = useState<EstadoDoSalvamento>("parado");
  const ehRascunho = task.publicada_em === null;

  return (
    <div className="space-y-3">
      {ehRascunho ? (
        <BarraDoRascunho taskId={task.id} temEtapas={temEtapas} estado={estado} />
      ) : null}

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <TituloDaTask task={task} podeEditar={podeEditar} aoSalvar={setEstado} />
        </div>
        {ehRascunho ? null : <EstadoDoSalvamentoNaTela estado={estado} />}
      </div>
    </div>
  );
}
