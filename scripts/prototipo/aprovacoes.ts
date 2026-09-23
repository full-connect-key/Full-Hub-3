/**
 * Versao de prototipo de src/lib/dados/aprovacoes.ts.
 *
 * A fila do desenvolvedor com os casos que ela precisa mostrar: um item
 * esperando decisao, um ja com aval interno esperando o envio, e um em que o
 * proprio desenvolvedor e o responsavel -- que desde a migration 0029 aparece
 * COM os botoes, porque a gestao decide inclusive o proprio trabalho.
 */
import type { FilaDeAprovacoes, ItemDaFila } from "../../src/lib/dados/aprovacoes";

import { BRUNO, CARLA, DIEGO, SUBTAREFAS } from "./tasks";

export type { FilaDeAprovacoes, ItemDaFila };

const AGORA = Date.now();
const horasAtras = (h: number) => new Date(AGORA - h * 3600_000).toISOString();

export async function filaDeAprovacoes(): Promise<FilaDeAprovacoes> {
  const kv = SUBTAREFAS.find((s) => s.titulo === "Criar KV")!;
  const landing = SUBTAREFAS.find((s) => s.titulo === "Desenvolver landing")!;
  const roteiro = SUBTAREFAS.find((s) => s.titulo === "Roteiro do reels")!;

  return {
    esperando: [
      {
        rodadaId: "rod-kv",
        subtaskId: kv.id,
        taskId: kv.task_id,
        numeroRodada: 2,
        subtarefa: kv.titulo,
        task: "Campanha de Instagram — linha de verão",
        cliente: "Mundo Verde",
        responsavel: BRUNO,
        tipoAprovacao: "cliente",
        desde: horasAtras(26),
        entregas: kv.entregas,
      },
      {
        rodadaId: "rod-landing",
        subtaskId: landing.id,
        taskId: landing.task_id,
        numeroRodada: 1,
        subtarefa: landing.titulo,
        task: "Landing page da promoção",
        cliente: "Mundo Verde",
        responsavel: DIEGO,
        tipoAprovacao: "interna",
        desde: horasAtras(5),
        entregas: landing.entregas,
      },
    ],
    prontasParaOCliente: [
      {
        rodadaId: null,
        subtaskId: roteiro.id,
        taskId: roteiro.task_id,
        numeroRodada: 1,
        subtarefa: roteiro.titulo,
        task: "Reels institucional",
        cliente: "Óptica Visão",
        responsavel: CARLA,
        tipoAprovacao: "cliente",
        desde: horasAtras(4),
        entregas: roteiro.entregas,
      },
    ],
  };
}
