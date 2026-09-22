/**
 * Versao de prototipo de src/lib/dados/resumo-semanal.ts.
 *
 * As datas sao relativas a hoje, e caem na SEMANA CORRENTE: com datas fixas o
 * prototipo abriria na semana de hoje e mostraria a lista vazia, que e
 * exatamente a tela que nao se quer validar.
 */
import type {
  AchadoDaBusca,
  EntregaDaSemana,
  SubtarefaConcluida,
} from "../../src/lib/dados/resumo-semanal";
import type { WeeklyNote } from "../../src/lib/supabase/database.types";

export type { AchadoDaBusca, EntregaDaSemana, SubtarefaConcluida };

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
): Promise<SubtarefaConcluida[]> {
  void usuarioId;
  void inicio;
  void fim;
  return [
    {
      id: "s1",
      titulo: "Criar KV",
      cliente: "Mundo Verde",
      clientId: VERDE.id,
      concluidaEm: nestaSemana(0),
    },
    {
      id: "s2",
      titulo: "Agendamento",
      cliente: "Mundo Verde",
      clientId: VERDE.id,
      concluidaEm: nestaSemana(1),
    },
  ];
}

export async function notaDaSemana(inicioISO: string): Promise<WeeklyNote | null> {
  return {
    id: "n1",
    user_id: "u1",
    semana: inicioISO,
    conteudo_rico: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Semana boa. A campanha de outubro saiu do papel e o cliente aprovou o KV na primeira rodada.",
            },
          ],
        },
      ],
    } as never,
    conteudo_texto:
      "Semana boa. A campanha de outubro saiu do papel e o cliente aprovou o KV na primeira rodada.",
    humor: "bom",
    created_at: `${inicioISO}T09:00:00Z`,
    updated_at: `${inicioISO}T09:00:00Z`,
  } as WeeklyNote;
}

export async function buscarNoHistorico(termo: string): Promise<AchadoDaBusca[]> {
  const limpo = termo.trim().toLowerCase();
  const tudo: AchadoDaBusca[] = [
    {
      semana: nestaSemana(0),
      trecho: "Fechei a arte da campanha de outubro e mandei para aprovação.",
      origem: "entrega",
    },
    {
      semana: nestaSemana(0),
      trecho:
        "…a campanha de outubro saiu do papel e o cliente aprovou o KV na primeira rodada.",
      origem: "nota",
    },
    {
      semana: nestaSemana(-7),
      trecho: "Briefing da campanha de outubro com o time de mídia.",
      origem: "entrega",
    },
  ];
  return tudo.filter((achado) => achado.trecho.toLowerCase().includes(limpo));
}

export async function historicoParaExportar(): Promise<
  {
    semana: string;
    nota: string | null;
    humor: string | null;
    entregas: { data: string; descricao: string }[];
  }[]
> {
  return [
    {
      semana: nestaSemana(0),
      nota: "Semana boa. A campanha de outubro saiu do papel.",
      humor: "bom",
      entregas: [
        { data: nestaSemana(0), descricao: "Fechei a arte da campanha de outubro." },
        { data: nestaSemana(1), descricao: "Reunião de alinhamento do calendário." },
      ],
    },
  ];
}

export async function subtarefasAindaNaoRegistradas(
  usuarioId: string,
  inicio: Date,
  fim: Date,
): Promise<SubtarefaConcluida[]> {
  void usuarioId;
  void inicio;
  void fim;
  return [
    {
      id: "s2",
      titulo: "Agendamento",
      cliente: "Mundo Verde",
      clientId: VERDE.id,
      concluidaEm: nestaSemana(1),
    },
  ];
}
