/**
 * CSV: montar e ler.
 *
 * ---------------------------------------------------------------------------
 * MÓDULO PRÓPRIO, E ELE SAIU DE DENTRO DO FINANCEIRO
 *
 * Estas funções nasceram em `lib/dominio/financeiro.ts` no Sprint 8, quando o
 * único módulo que exportava planilha era aquele. Depois a Academy passou a
 * importar `montarCSV` de lá — e "importar do Financeiro" para baixar o
 * acompanhamento de uma trilha é o tipo de dependência que ninguém escolhe,
 * só herda. As Métricas seriam o terceiro.
 *
 * O que ficou no Financeiro é o que é dele: `formatarDinheiro`,
 * `situacaoDoLancamento`, o vocabulário. O CSV não é de módulo nenhum.
 * ---------------------------------------------------------------------------
 *
 * **Sem diretiva**: a tela monta o arquivo no navegador e o servidor monta o
 * mesmo formato quando precisa — os dois lados usam as mesmas funções, como
 * `situacaoDoLancamento()`.
 */

/**
 * Uma linha de CSV.
 *
 * Ponto e vírgula, e não vírgula: o Excel em português lê o arquivo separado
 * por vírgula como uma coluna só, e o valor `1.234,56` tem vírgula dentro.
 * Quem abre o CSV do Full Hub abre no Excel, não num script.
 */
export function linhaCSV(campos: (string | number | null | undefined)[]): string {
  return campos
    .map((campo) => {
      if (campo === null || campo === undefined) return "";
      const texto = String(campo);
      if (/[";\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
      return texto;
    })
    .join(";");
}

/**
 * O CSV inteiro, com BOM.
 *
 * O BOM (﻿) é o que faz o Excel entender que o arquivo é UTF-8. Sem ele,
 * "Óptica Visão" abre como "Ã“ptica VisÃ£o" e a planilha vai para o contador
 * assim.
 */
export function montarCSV(cabecalho: string[], linhas: (string | number | null)[][]): string {
  return "﻿" + [linhaCSV(cabecalho), ...linhas.map(linhaCSV)].join("\n");
}

/**
 * Lê um CSV colado ou enviado.
 *
 * Aceita `;` e `,` como separador — descobre qual olhando o cabeçalho, porque
 * um arquivo exportado de outro sistema pode vir de qualquer jeito. Respeita
 * aspas, inclusive com o separador dentro.
 */
export function lerCSV(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (limpo === "") return [];

  const primeiraLinha = limpo.split("\n")[0];
  const separador =
    (primeiraLinha.match(/;/g) ?? []).length >= (primeiraLinha.match(/,/g) ?? []).length ? ";" : ",";

  const linhas: string[][] = [];
  let campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];

    if (dentroDeAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        atual += c;
      }
      continue;
    }

    if (c === '"') dentroDeAspas = true;
    else if (c === separador) {
      campos.push(atual);
      atual = "";
    } else if (c === "\n") {
      campos.push(atual);
      linhas.push(campos);
      campos = [];
      atual = "";
    } else {
      atual += c;
    }
  }

  campos.push(atual);
  linhas.push(campos);

  return linhas.filter((linha) => linha.some((campo) => campo.trim() !== ""));
}

/**
 * Baixa um texto como arquivo, sem passar pelo servidor.
 *
 * **Estava exportado de um arquivo `"use client"`** (`financeiro/lancamentos.tsx`)
 * e vinha sendo importado só por outros arquivos cliente, o que funcionava.
 * Valor exportado de módulo cliente chega ao Server Component como referência
 * de cliente e estoura com *"is not a function"* — e o `npm run build` não
 * pega. Aqui ele não tem como cair nessa.
 *
 * Só roda no navegador: é `document` e `URL` que fazem o download acontecer.
 */
export function baixarCSV(conteudo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
