/**
 * O ACERVO DE MARCA DE EXEMPLO (migration 0139).
 *
 * ---------------------------------------------------------------------------
 * **A MUNDO VERDE TEM PASTA E A ÓPTICA VISÃO NÃO TEM NENHUMA**, de propósito:
 * conta sem acervo é o estado do primeiro dia de uso, e com as duas montadas
 * nenhuma imagem mostraria o vazio — nem o "Crie uma pasta" da gestão, nem a
 * frase que o cliente lê enquanto a agência não guardou nada. É a lição da
 * Óptica Visão sem atendente (0062) e das vertentes de exemplo.
 *
 * **E A ÁRVORE PROVA AS QUATRO COISAS QUE A TELA SABE FAZER:**
 *
 *   - **dois níveis** — "Marca" com "Logos" e "Tipografia" dentro —, porque
 *     com pastas de topo só a imagem não mostraria o recuo nem o fio;
 *   - **uma pasta VAZIA** ("Manual da marca"), que é o estado em que a pasta
 *     se lê como pasta que não carregou se ela não disser "vazia";
 *   - **um LINK de fora** ao lado de arquivos do bucket, porque com os dois do
 *     mesmo tipo a imagem provaria que o botão aparece e não que ele
 *     **distingue** "Baixar" de "Abrir" — é a razão do evento de cada par da
 *     legenda do calendário;
 *   - **um arquivo com descrição e um sem**, pela mesma razão.
 *
 * ---------------------------------------------------------------------------
 * **O `href` VEM PREENCHIDO, e é o que a assinatura faria.** No produto quem o
 * escreve é `enderecoDaArte()` sobre o mapa de `assinarArquivos()`; aqui não
 * há Storage, e devolver nulo poria a frase *"Não foi possível abrir agora"* em
 * toda linha — a imagem conferiria o estado de falha no lugar do que se quer
 * ver. **Menos num arquivo**, que é o único jeito de aquela frase sair em
 * imagem alguma.
 */
import type { PastaDaMarca } from "@/lib/dominio/biblioteca-de-marca";

export const BUCKET_DA_MARCA = "biblioteca-arquivos";

const MUNDO_VERDE = "c0000000-0000-0000-0000-00000000000a";

const PASTAS: PastaDaMarca[] = [
  {
    id: "fa000000-0000-0000-0000-000000000001",
    pastaPaiId: null,
    nome: "Marca",
    ordem: 10,
    arquivos: [
      {
        id: "fb000000-0000-0000-0000-000000000001",
        nome: "mundo-verde-logo.svg",
        descricao: "Versão principal, fundo claro.",
        tamanho: 48_112,
        url: `${MUNDO_VERDE}/fa000000-0000-0000-0000-000000000001/logo.svg`,
        href: "/exemplos/logo-1.svg",
        criadoEm: "2026-02-10T13:00:00.000Z",
      },
      {
        id: "fb000000-0000-0000-0000-000000000002",
        nome: "Paleta e fontes no Figma",
        descricao: null,
        tamanho: null,
        url: "https://www.figma.com/file/exemplo-mundo-verde",
        href: "https://www.figma.com/file/exemplo-mundo-verde",
        criadoEm: "2026-02-10T13:04:00.000Z",
      },
    ],
  },
  {
    id: "fa000000-0000-0000-0000-000000000002",
    pastaPaiId: "fa000000-0000-0000-0000-000000000001",
    nome: "Logos",
    ordem: 10,
    arquivos: [
      {
        id: "fb000000-0000-0000-0000-000000000003",
        nome: "logo-monocromatico.pdf",
        descricao: "Para impressão em uma cor.",
        tamanho: 1_204_992,
        url: `${MUNDO_VERDE}/fa000000-0000-0000-0000-000000000002/mono.pdf`,
        href: "/exemplos/logo-1.svg",
        criadoEm: "2026-02-11T09:10:00.000Z",
      },
    ],
  },
  {
    id: "fa000000-0000-0000-0000-000000000003",
    pastaPaiId: "fa000000-0000-0000-0000-000000000001",
    nome: "Tipografia",
    ordem: 20,
    arquivos: [
      {
        id: "fb000000-0000-0000-0000-000000000004",
        nome: "fontes-da-marca.zip",
        descricao: null,
        tamanho: 8_421_376,
        // O ÚNICO SEM `href`: é o único jeito de a frase da assinatura que
        // falhou sair em imagem alguma.
        url: `${MUNDO_VERDE}/fa000000-0000-0000-0000-000000000003/fontes.zip`,
        href: null,
        criadoEm: "2026-02-11T09:12:00.000Z",
      },
    ],
  },
  {
    id: "fa000000-0000-0000-0000-000000000004",
    pastaPaiId: null,
    nome: "Banners",
    ordem: 20,
    arquivos: [
      {
        id: "fb000000-0000-0000-0000-000000000005",
        nome: "banner-outubro-1080x1350.jpg",
        descricao: null,
        tamanho: 642_048,
        url: `${MUNDO_VERDE}/fa000000-0000-0000-0000-000000000004/banner.jpg`,
        href: "/exemplos/arte-1.svg",
        criadoEm: "2026-10-02T11:00:00.000Z",
      },
    ],
  },
  {
    // A PASTA VAZIA, e ela é o estado que a frase "vazia" existe para nomear.
    id: "fa000000-0000-0000-0000-000000000005",
    pastaPaiId: null,
    nome: "Manual da marca",
    ordem: 30,
    arquivos: [],
  },
];

export async function acervoDeMarca(
  clienteId: string | null,
): Promise<PastaDaMarca[]> {
  if (clienteId !== MUNDO_VERDE) return [];
  return PASTAS;
}
