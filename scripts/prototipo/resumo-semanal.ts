/**
 * Versao de prototipo de src/lib/dados/resumo-semanal.ts.
 *
 * As datas sao relativas a hoje, e caem na SEMANA CORRENTE: com datas fixas o
 * prototipo abriria na semana de hoje e mostraria a lista vazia, que e
 * exatamente a tela que nao se quer validar.
 */
import type { EntregaDaSemana } from "../../src/lib/dados/resumo-semanal";

export type { EntregaDaSemana };

const VERDE = { id: "c0000000-0000-0000-0000-00000000000a", nome_empresa: "Mundo Verde" };

/** A segunda-feira desta semana, mais `dias`. */
function nestaSemana(dias: number): string {
  const hoje = new Date();
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7) + dias);
  const mes = String(segunda.getMonth() + 1).padStart(2, "0");
  const dia = String(segunda.getDate()).padStart(2, "0");
  return `${segunda.getFullYear()}-${mes}-${dia}`;
}

export async function entregasDaSemana(
  inicio: Date,
  fim: Date,
): Promise<EntregaDaSemana[]> {
  void inicio;
  void fim;
  return [
    {
      id: "w1",
      data: nestaSemana(0),
      descricao: "Fechei a arte da campanha de outubro e mandei para aprovação.",
      cliente: VERDE,
      subtarefa: { id: "s1", titulo: "Criar KV" },
    },
    {
      id: "w2",
      data: nestaSemana(1),
      descricao: "Reunião de alinhamento do calendário editorial do trimestre.",
      cliente: null,
      subtarefa: null,
    },
    {
      id: "w3",
      data: nestaSemana(2),
      descricao: "Ajustes pedidos pelo cliente na peça de lançamento.",
      cliente: VERDE,
      subtarefa: null,
    },
  ];
}

export async function subtarefasConcluidasNaSemana(
  usuarioId: string,
  inicio: Date,
  fim: Date,
): Promise<
  { id: string; titulo: string; cliente: string | null; clientId: string | null }[]
> {
  void usuarioId;
  void inicio;
  void fim;
  return [
    { id: "s1", titulo: "Criar KV", cliente: "Mundo Verde", clientId: VERDE.id },
    { id: "s2", titulo: "Agendamento", cliente: "Mundo Verde", clientId: VERDE.id },
  ];
}
