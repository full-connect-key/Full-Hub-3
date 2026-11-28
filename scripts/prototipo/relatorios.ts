/**
 * Versao de prototipo de src/lib/dados/relatorios.ts.
 *
 * Um relatorio publicado com os cinco tipos de bloco: a tela de leitura
 * precisa mostrar o grafico de crescimento com uma linha que cresceu e uma
 * que nao.
 */
import type {
  RelatorioAberto,
  RelatorioNaLista,
} from "../../src/lib/dados/relatorios";

export type { RelatorioAberto, RelatorioNaLista };

export const BUCKET_DO_RELATORIO = "posts-artes";

const ABERTO: RelatorioAberto = {
  id: "5d000000-0000-0000-0000-000000000001",
  clienteId: "c1000000-0000-0000-0000-000000000001",
  cliente: "Mundo Verde",
  titulo: "Relatório de outubro",
  subtitulo: "Editoriais de receita",
  periodoInicio: "2026-10-01",
  periodoFim: "2026-10-31",
  publicadoEm: new Date().toISOString(),
  imagens: {},
  blocos: [
    {
      tipo: "destaques",
      titulo: "Destaques do período",
      itens: [
        { numero: "1,2 mi", legenda: "visualizações", texto: "O maior mês do ano." },
        { numero: "+3.480", legenda: "novos seguidores", texto: "" },
        { numero: "48 mil", legenda: "interações", texto: "" },
      ],
    },
    {
      tipo: "crescimento",
      titulo: "Crescimento em relação ao período anterior",
      texto: "As receitas em vídeo puxaram o alcance.",
      linhas: [
        { metrica: "Seguidores", anterior: 52000, atual: 55480 },
        { metrica: "Alcance", anterior: 310000, atual: 472000 },
        { metrica: "Interações", anterior: 49000, atual: 48000 },
      ],
    },
    {
      tipo: "posts",
      titulo: "Conteúdos em destaque",
      rede: "Instagram",
      texto: "",
      itens: [
        {
          nome: "Bolo de cenoura sem açúcar",
          publicadoEm: "12 de outubro",
          metricas: [
            { rotulo: "Visualizações", valor: "312 mil" },
            { rotulo: "Alcance", valor: "198 mil" },
            { rotulo: "Interações", valor: "9,4 mil" },
            { rotulo: "Tempo de visualização", valor: "41 h" },
          ],
          legenda: "A receita mais salva do mês.",
          imagem: null,
        },
      ],
    },
    {
      tipo: "texto",
      titulo: "Próximos passos",
      texto: "Mais receitas em vídeo curto, duas por semana.",
    },
  ],
};

export async function listarRelatorios(): Promise<RelatorioNaLista[]> {
  return [ABERTO];
}

export async function obterRelatorio(): Promise<RelatorioAberto | null> {
  return ABERTO;
}
