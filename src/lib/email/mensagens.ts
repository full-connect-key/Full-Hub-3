import { SITE_URL } from "@/lib/env";

/**
 * O que cada e-mail diz (Sprint 16, Parte B).
 *
 * ---------------------------------------------------------------------------
 * **NENHUMA COR, E É DECISÃO — não é falta de capricho.**
 *
 * A tentação é trazer a marca: `--brand-blue` no botão, o cinza da casa no
 * texto. Três coisas desaconselham, e as três são mecânicas:
 *
 * 1. `src/app/globals.css` é o arquivo com cor literal do produto, e o `.svg`
 *    do ícone e o editor rico são as exceções registradas. Um HTML de e-mail
 *    com hex dentro seria a quarta, e ela cresceria: cada mensagem nova traz
 *    a sua.
 * 2. `var(--brand-blue)` não existe do lado de lá. O e-mail é lido por um
 *    programa que não carrega a folha de estilo do app, exatamente como o
 *    `icon.svg` — e ali a saída foi repetir o valor, que aqui seria repeti-lo
 *    em toda mensagem.
 * 3. O tema escuro do Gmail e do Outlook **reescreve** a cor que você mandou,
 *    por conta própria e sem regra publicada. Um par texto/fundo medido aqui
 *    chega lá como outro par, e a medição de `check:cores` não alcança a
 *    caixa de entrada de ninguém.
 *
 * O que sobra funciona melhor: hierarquia por tamanho e espaço, e o link como
 * link. Renderiza igual em todo lugar, nos dois temas, e não promete uma
 * identidade visual que o cliente de e-mail vai desfazer.
 * ---------------------------------------------------------------------------
 *
 * **Toda mensagem tem HTML e texto puro.** O texto não é cortesia: filtro de
 * spam pontua melhor quem manda os dois, e leitor de tela em cliente de
 * e-mail antigo lê o `text/plain`. Escrever só o HTML deixaria essas pessoas
 * com a marcação crua na tela.
 */

export type Mensagem = {
  assunto: string;
  html: string;
  texto: string;
};

/** Escapa o que vem do banco antes de virar HTML. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * O endereço absoluto de uma rota do produto.
 *
 * `SITE_URL` e não um caminho relativo: um `/portal/social-media` dentro de
 * um e-mail é um link que não abre em lugar nenhum.
 */
export function enderecoDe(rota: string): string {
  return new URL(rota, SITE_URL).toString();
}

/**
 * A casca de toda mensagem.
 *
 * `linhas` é o corpo, um parágrafo por item; `acao` vira o link do fim. A
 * assinatura é a mesma sempre — quem recebe precisa saber de onde isto veio
 * antes de clicar em qualquer coisa.
 */
function montar({
  assunto,
  titulo,
  linhas,
  acao,
}: {
  assunto: string;
  titulo: string;
  linhas: string[];
  acao?: { rotulo: string; url: string };
}): Mensagem {
  const corpoHtml = linhas
    .map((l) => `<p style="margin:0 0 12px;line-height:1.5">${escapar(l)}</p>`)
    .join("\n");

  const acaoHtml = acao
    ? `<p style="margin:24px 0 0"><a href="${escapar(acao.url)}">${escapar(acao.rotulo)}</a></p>`
    : "";

  const html = [
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;max-width:560px">`,
    `<h1 style="font-size:18px;margin:0 0 16px">${escapar(titulo)}</h1>`,
    corpoHtml,
    acaoHtml,
    `<hr style="margin:32px 0 12px;border:0;border-top:1px solid" />`,
    `<p style="margin:0;font-size:13px">Full Hub — Full Connect Key</p>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n");

  const texto = [
    titulo,
    "",
    ...linhas,
    ...(acao ? ["", `${acao.rotulo}: ${acao.url}`] : []),
    "",
    "—",
    "Full Hub — Full Connect Key",
  ].join("\n");

  return { assunto, html, texto };
}

/**
 * A Full enviou material para o cliente decidir.
 *
 * É o único evento que o produto sabe produzir para `novo_conteudo`, e sai
 * de onde a rodada de escopo cliente nasce — não de uma segunda ação ao lado
 * dela, porque "enviar ao cliente É abrir a rodada" desde a 0032.
 */
export function materialParaAprovar(dados: {
  titulo: string;
  /** "post" e "material" — a palavra que o cliente usa, nunca "subtarefa". */
  oQueE: string;
  rota: string;
}): Mensagem {
  const url = enderecoDe(dados.rota);
  return montar({
    assunto: `Novo material para aprovar: ${dados.titulo}`,
    titulo: "Tem material esperando você",
    linhas: [
      `A Full Connect Key enviou ${dados.oQueE} para a sua aprovação: “${dados.titulo}”.`,
      "Você pode aprovar, pedir ajustes ou recusar direto no portal.",
    ],
    acao: { rotulo: "Abrir no portal", url },
  });
}

const DECISOES: Record<string, { rotulo: string; frase: string }> = {
  aprovada: { rotulo: "aprovou", frase: "Está liberado para seguir." },
  ajustes_solicitados: {
    rotulo: "pediu ajustes",
    frase: "O material volta para a produção.",
  },
  rejeitada: { rotulo: "recusou", frase: "O material não segue como está." },
};

/**
 * O cliente decidiu, e a agência precisa saber.
 *
 * **Este é o caminho inverso, e ele existe por um motivo só:** é do lado de
 * cá que alguém está com a fila aberta esperando esta resposta. É a mesma
 * razão pela qual o aviso ao vivo da decisão sai no canal da equipe.
 */
export function clienteDecidiu(dados: {
  cliente: string;
  titulo: string;
  decisao: string;
  comentario: string | null;
  rota: string;
}): Mensagem {
  const d = DECISOES[dados.decisao] ?? {
    rotulo: "respondeu",
    frase: "Confira no painel.",
  };

  const linhas = [`${dados.cliente} ${d.rotulo} “${dados.titulo}”.`, d.frase];
  // O MOTIVO VAI NO CORPO, e não só no painel: quem recebe um "pediu ajustes"
  // sem saber o que ajustar abre a tela para descobrir uma linha de texto.
  if (dados.comentario) linhas.push(`O que ele escreveu: “${dados.comentario}”`);

  return montar({
    assunto: `${dados.cliente} ${d.rotulo}: ${dados.titulo}`,
    titulo: `O cliente ${d.rotulo}`,
    linhas,
    acao: { rotulo: "Abrir no painel", url: enderecoDe(dados.rota) },
  });
}

/**
 * Alguém comentou num material que o cliente vê.
 *
 * **O TEXTO DO COMENTÁRIO NÃO VAI NO E-MAIL, e é decisão.** Ele viaja pela
 * caixa de entrada de quem recebe, que é um lugar fora do portal — e o portal
 * é onde o produto decide o que cada empresa enxerga. Um assunto com o começo
 * da conversa também contaria o conteúdo a quem vir a tela do celular por
 * cima do ombro. O que sai é que há conversa nova, e onde ela está.
 */
export function comentarioNovo(dados: {
  autor: string;
  titulo: string;
  rota: string;
}): Mensagem {
  return montar({
    assunto: `Novo comentário em: ${dados.titulo}`,
    titulo: "Tem comentário novo",
    linhas: [
      `${dados.autor} comentou em “${dados.titulo}”.`,
      "O texto está no portal, junto com o material.",
    ],
    acao: { rotulo: "Ler no portal", url: enderecoDe(dados.rota) },
  });
}
