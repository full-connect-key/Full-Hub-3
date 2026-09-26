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

  const anexosDe = (entregas: { id: string; nome: string | null; url: string }[]) =>
    entregas.map((e) => ({ id: e.id, nome: e.nome ?? "Entrega", url: e.url }));

  return {
    esperando: [
      {
        rodadaId: "rod-kv",
        tipo: "subtask",
        contentId: kv.id,
        numeroRodada: 2,
        titulo: kv.titulo,
        contexto: "em Campanha de Instagram — linha de verão",
        rota: `/painel/gestao-tasks/${kv.task_id}`,
        cliente: "Mundo Verde",
        responsavel: BRUNO,
        tipoAprovacao: "cliente",
        desde: horasAtras(26),
        anexos: anexosDe(kv.entregas),
      },
      // O POST NA FILA, e ele precisa estar no protótipo: a imagem é onde se
      // confere que as duas linhas convivem sem o selo virar enfeite.
      {
        rodadaId: "rod-post",
        tipo: "post",
        contentId: "post-carrossel",
        numeroRodada: 3,
        titulo: "Carrossel: 5 pontos da COF",
        contexto: "instagram · 14/10",
        rota: "/painel/social-media?post=post-carrossel",
        cliente: "Óptica Visão",
        responsavel: CARLA,
        tipoAprovacao: "cliente",
        desde: horasAtras(9),
        anexos: [
          { id: "arte-carrossel", nome: "Arte", url: "https://exemplo.invalid/arte.png" },
        ],
      },
      {
        rodadaId: "rod-landing",
        tipo: "subtask",
        contentId: landing.id,
        numeroRodada: 1,
        titulo: landing.titulo,
        contexto: "em Landing page da promoção",
        rota: `/painel/gestao-tasks/${landing.task_id}`,
        cliente: "Mundo Verde",
        responsavel: DIEGO,
        tipoAprovacao: "interna",
        desde: horasAtras(5),
        anexos: anexosDe(landing.entregas),
      },
    ],
    prontasParaOCliente: [
      {
        rodadaId: null,
        tipo: "subtask",
        contentId: roteiro.id,
        numeroRodada: 1,
        titulo: roteiro.titulo,
        contexto: "em Reels institucional",
        rota: `/painel/gestao-tasks/${roteiro.task_id}`,
        cliente: "Óptica Visão",
        responsavel: CARLA,
        tipoAprovacao: "cliente",
        desde: horasAtras(4),
        anexos: anexosDe(roteiro.entregas),
      },
      // UM POST JÁ COM AVAL, esperando só o envio -- que é o estado que nunca
      // era alcançável antes desta mudança.
      {
        rodadaId: null,
        tipo: "post",
        contentId: "post-estatico",
        numeroRodada: 1,
        titulo: "Antes de assinar: o que entender",
        contexto: "linkedin · 17/10",
        rota: "/painel/social-media?post=post-estatico",
        cliente: "Mundo Verde",
        responsavel: BRUNO,
        tipoAprovacao: "cliente",
        desde: horasAtras(2),
        anexos: [
          { id: "arte-estatico", nome: "Arte", url: "https://exemplo.invalid/arte2.png" },
        ],
      },
    ],
  };
}
