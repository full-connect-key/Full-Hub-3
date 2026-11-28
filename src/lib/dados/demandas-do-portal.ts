import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EtapaNoPortal = {
  titulo: string;
  estado: "concluida" | "em_andamento" | "a_fazer";
};

export type DemandaNoPortal = {
  id: string;
  titulo: string;
  prazo: string | null;
  concluida: boolean;
  /** Há material esperando a decisão do cliente. */
  esperando: boolean;
  etapas: EtapaNoPortal[];
};

const ESTADOS = new Set(["concluida", "em_andamento", "a_fazer"]);

/**
 * As demandas abertas da conta, como o portal as mostra (0160). Vem de uma
 * função `security definer` que devolve só nome, etapas e o sinal de
 * aprovação — o cliente não tem policy em `tasks` nem em `subtasks`.
 */
export async function demandasDoPortal(
  clienteId?: string | null,
): Promise<DemandaNoPortal[]> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "as demandas em andamento",
    await supabase.rpc("demandas_do_portal", {
      p_cliente: clienteId ?? undefined,
    }),
  );

  const demandas = linhas.map((l) => ({
    id: l.task_id,
    titulo: l.titulo,
    prazo: l.prazo,
    concluida: l.concluida,
    esperando: l.esperando,
    etapas: (Array.isArray(l.etapas) ? l.etapas : [])
      .map((e) => e as { titulo?: unknown; estado?: unknown })
      .filter((e) => typeof e.titulo === "string" && ESTADOS.has(String(e.estado)))
      .map((e) => ({
        titulo: e.titulo as string,
        estado: e.estado as EtapaNoPortal["estado"],
      })),
  }));

  // O que espera o cliente sobe; o concluído desce.
  const peso = (d: DemandaNoPortal) => (d.esperando ? 0 : d.concluida ? 2 : 1);
  return demandas.sort((a, b) => peso(a) - peso(b));
}
