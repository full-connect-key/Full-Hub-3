/**
 * O RELATÓRIO EM BLOCOS (migration 0159).
 *
 * Um relatório é uma lista ordenada de blocos, gravada inteira em
 * `relatorios.blocos`. Este arquivo é a forma de cada bloco e a leitura
 * defensiva do jsonb — o banco só garante que é um array.
 *
 * **O crescimento só mostra o que cresceu em destaque.** Decisão do usuário:
 * o relatório promove o trabalho; a queda aparece como número, sem alarde.
 */

export type MetricaDoPost = { rotulo: string; valor: string };

export type PostEmDestaque = {
  nome: string;
  publicadoEm: string;
  metricas: MetricaDoPost[];
  legenda: string;
  imagem: string | null;
};

export type LinhaDeCrescimento = {
  metrica: string;
  anterior: number;
  atual: number;
};

export type BlocoDoRelatorio =
  | {
      tipo: "destaques";
      titulo: string;
      itens: { numero: string; legenda: string; texto: string }[];
    }
  | {
      tipo: "crescimento";
      titulo: string;
      texto: string;
      linhas: LinhaDeCrescimento[];
    }
  | {
      tipo: "posts";
      titulo: string;
      rede: string;
      texto: string;
      itens: PostEmDestaque[];
    }
  | { tipo: "texto"; titulo: string; texto: string }
  | {
      tipo: "referencias";
      titulo: string;
      itens: { titulo: string; texto: string; link: string; imagem: string | null }[];
    };

export type TipoDeBloco = BlocoDoRelatorio["tipo"];

export const TIPOS_DE_BLOCO: {
  tipo: TipoDeBloco;
  rotulo: string;
  descricao: string;
}[] = [
  {
    tipo: "destaques",
    rotulo: "Destaques do período",
    descricao: "Os números grandes que abrem o relatório.",
  },
  {
    tipo: "crescimento",
    rotulo: "Crescimento",
    descricao: "O período contra o anterior, em gráfico.",
  },
  {
    tipo: "posts",
    rotulo: "Conteúdos em destaque",
    descricao: "Os conteúdos que mais renderam, com os números de cada um.",
  },
  {
    tipo: "texto",
    rotulo: "Texto",
    descricao: "Uma leitura: o que aprendemos, os próximos passos.",
  },
  {
    tipo: "referencias",
    rotulo: "Referências",
    descricao: "Ideias e exemplos para os próximos conteúdos.",
  },
];

export const METRICAS_PADRAO_DO_POST = [
  "Visualizações",
  "Alcance",
  "Interações",
  "Tempo de visualização",
];

export const METRICAS_PADRAO_DE_CRESCIMENTO = [
  "Seguidores",
  "Alcance",
  "Visualizações",
  "Interações",
];

export function blocoNovo(tipo: TipoDeBloco): BlocoDoRelatorio {
  switch (tipo) {
    case "destaques":
      return {
        tipo,
        titulo: "Destaques do período",
        itens: [{ numero: "", legenda: "", texto: "" }],
      };
    case "crescimento":
      return {
        tipo,
        titulo: "Crescimento em relação ao período anterior",
        texto: "",
        linhas: METRICAS_PADRAO_DE_CRESCIMENTO.map((metrica) => ({
          metrica,
          anterior: 0,
          atual: 0,
        })),
      };
    case "posts":
      return {
        tipo,
        titulo: "Conteúdos em destaque",
        rede: "Instagram",
        texto: "",
        itens: [postNovo()],
      };
    case "texto":
      return { tipo, titulo: "", texto: "" };
    case "referencias":
      return {
        tipo,
        titulo: "Referências para os próximos conteúdos",
        itens: [{ titulo: "", texto: "", link: "", imagem: null }],
      };
  }
}

export function postNovo(): PostEmDestaque {
  return {
    nome: "",
    publicadoEm: "",
    metricas: METRICAS_PADRAO_DO_POST.map((rotulo) => ({ rotulo, valor: "" })),
    legenda: "",
    imagem: null,
  };
}

/** O relatório novo já nasce com o gráfico de crescimento: ele é obrigatório. */
export function blocosIniciais(): BlocoDoRelatorio[] {
  return [blocoNovo("destaques"), blocoNovo("crescimento"), blocoNovo("posts")];
}

/* ------------------------------------------------------- leitura do jsonb */

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const numero = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
const lista = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v)
    ? v.filter(
        (i): i is Record<string, unknown> => typeof i === "object" && i !== null,
      )
    : [];
const caminho = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

export function lerBlocos(bruto: unknown): BlocoDoRelatorio[] {
  const blocos: BlocoDoRelatorio[] = [];
  for (const b of lista(bruto)) {
    switch (b.tipo) {
      case "destaques":
        blocos.push({
          tipo: "destaques",
          titulo: texto(b.titulo),
          itens: lista(b.itens).map((i) => ({
            numero: texto(i.numero),
            legenda: texto(i.legenda),
            texto: texto(i.texto),
          })),
        });
        break;
      case "crescimento":
        blocos.push({
          tipo: "crescimento",
          titulo: texto(b.titulo),
          texto: texto(b.texto),
          linhas: lista(b.linhas).map((l) => ({
            metrica: texto(l.metrica),
            anterior: numero(l.anterior),
            atual: numero(l.atual),
          })),
        });
        break;
      case "posts":
        blocos.push({
          tipo: "posts",
          titulo: texto(b.titulo),
          rede: texto(b.rede),
          texto: texto(b.texto),
          itens: lista(b.itens).map((i) => ({
            nome: texto(i.nome),
            publicadoEm: texto(i.publicadoEm),
            metricas: lista(i.metricas).map((m) => ({
              rotulo: texto(m.rotulo),
              valor: texto(m.valor),
            })),
            legenda: texto(i.legenda),
            imagem: caminho(i.imagem),
          })),
        });
        break;
      case "texto":
        blocos.push({
          tipo: "texto",
          titulo: texto(b.titulo),
          texto: texto(b.texto),
        });
        break;
      case "referencias":
        blocos.push({
          tipo: "referencias",
          titulo: texto(b.titulo),
          itens: lista(b.itens).map((i) => ({
            titulo: texto(i.titulo),
            texto: texto(i.texto),
            link: texto(i.link),
            imagem: caminho(i.imagem),
          })),
        });
        break;
    }
  }
  return blocos;
}

/** Todos os caminhos de imagem do relatório, para assinar de uma vez. */
export function imagensDosBlocos(blocos: BlocoDoRelatorio[]): string[] {
  const caminhos: string[] = [];
  for (const b of blocos) {
    if (b.tipo === "posts" || b.tipo === "referencias") {
      for (const i of b.itens) if (i.imagem) caminhos.push(i.imagem);
    }
  }
  return caminhos;
}

/* ------------------------------------------------------------ crescimento */

export type VariacaoDaLinha = {
  /** Largura da barra de cada período, de 0 a 100, na mesma escala. */
  larguraAnterior: number;
  larguraAtual: number;
  /** `null` quando não há base de comparação (anterior zerado). */
  percentual: number | null;
  cresceu: boolean;
};

export function variacaoDaLinha(linha: LinhaDeCrescimento): VariacaoDaLinha {
  const teto = Math.max(linha.anterior, linha.atual, 1);
  const percentual =
    linha.anterior > 0
      ? Math.round(((linha.atual - linha.anterior) / linha.anterior) * 100)
      : null;
  return {
    larguraAnterior: Math.round((linha.anterior / teto) * 100),
    larguraAtual: Math.round((linha.atual / teto) * 100),
    percentual,
    cresceu: linha.atual > linha.anterior,
  };
}

const MILHAR = new Intl.NumberFormat("pt-BR");
export const numeroPorExtenso = (n: number): string => MILHAR.format(n);

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "1 a 31 de outubro de 2026" — as datas chegam como `AAAA-MM-DD`. */
export function periodoPorExtenso(inicio: string, fim: string): string {
  const [ai, mi, di] = inicio.split("-").map(Number);
  const [af, mf, df] = fim.split("-").map(Number);
  if (!ai || !mi || !di || !af || !mf || !df) return "";
  if (ai === af && mi === mf)
    return `${di} a ${df} de ${MESES[mf - 1]} de ${af}`;
  if (ai === af)
    return `${di} de ${MESES[mi - 1]} a ${df} de ${MESES[mf - 1]} de ${af}`;
  return `${di} de ${MESES[mi - 1]} de ${ai} a ${df} de ${MESES[mf - 1]} de ${af}`;
}
