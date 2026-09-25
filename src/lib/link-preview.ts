import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Os metadados de um link, para o formulário se preencher sozinho.
 *
 * ---------------------------------------------------------------------------
 * ISTO FAZ O SERVIDOR BUSCAR UM ENDEREÇO QUE UM USUÁRIO ESCOLHEU
 *
 * E é a única coisa no produto que faz isso. Toda outra escrita sai de um
 * formulário e vai para o Postgres; aqui o texto que a pessoa cola vira uma
 * requisição que **parte de dentro da VPS**, com o IP dela e o acesso que ela
 * tem. É a família de falha conhecida como SSRF, e ela não precisa de nada
 * sofisticado para doer: `http://localhost:3000`, o IP interno do Postgres, ou
 * o endereço de metadados que quase todo provedor de nuvem serve em
 * `169.254.169.254` — que costuma devolver credencial da máquina.
 *
 * O buscador do Open Graph é o lugar clássico desse furo justamente porque
 * parece inofensivo: ele só lê `<title>`.
 *
 * Por isso as cinco travas abaixo, e a ordem delas importa:
 *
 *   1. Só `http` e `https`. `file://` leria o disco, `gopher://` e afins já
 *      serviram para falar com Redis e Memcached por engano.
 *   2. O host é RESOLVIDO e o IP conferido antes de qualquer conexão. Conferir
 *      só o texto do host não basta: `interno.exemplo.com` pode apontar para
 *      `10.0.0.5`, e nenhuma lista de nomes pega isso.
 *   3. Nada de IP privado, loopback, link-local ou reservado — a lista inclui
 *      o `169.254.169.254` dos metadados de nuvem, que é o alvo mais comum.
 *   4. **Redirecionamento é seguido À MÃO, um por vez, com a mesma checagem a
 *      cada salto.** É o passo que quase todo mundo esquece: um endereço
 *      público que responde `302` para `127.0.0.1` passa por todas as travas
 *      acima e cai dentro assim mesmo. `redirect: "manual"` é o que permite
 *      olhar cada destino.
 *   5. Tempo limite, teto de tamanho e teto de saltos — para o servidor não
 *      ficar preso num endereço que nunca responde, nem ler um arquivo de
 *      500 MB procurando uma `<meta>`.
 *
 * **E o que ela devolve nunca é a verdade final.** Título, descrição e imagem
 * vêm do site de fora: ficam nos campos do formulário, editáveis, e a pessoa
 * confirma. É o que o sprint pede, e também o que impede um site de escrever
 * sozinho numa tela da agência.
 * ---------------------------------------------------------------------------
 */
export type PreviaDoLink = {
  titulo: string | null;
  descricao: string | null;
  imagem: string | null;
};

const TEMPO_LIMITE = 5000;
/** 512 KB. As metatags vivem no `<head>` — ninguém precisa do corpo inteiro. */
const TETO = 512 * 1024;
const SALTOS = 3;

/**
 * Este IP é de rede interna?
 *
 * A lista é por FAIXA e não por nome, porque é o IP que decide para onde o
 * pacote vai. `169.254.0.0/16` aparece separado no comentário porque é o link
 * local — e dentro dele mora o `169.254.169.254` dos metadados de nuvem.
 */
function ehInterno(ip: string): boolean {
  if (isIP(ip) === 6) {
    const normal = ip.toLowerCase();
    return (
      normal === "::1" ||
      normal === "::" ||
      normal.startsWith("fc") || // único local
      normal.startsWith("fd") ||
      normal.startsWith("fe80") || // link local
      normal.startsWith("::ffff:") // IPv4 disfarçado de IPv6
    );
  }

  const [a, b] = ip.split(".").map(Number);
  if (Number.isNaN(a) || Number.isNaN(b)) return true; // não entendi, não vou
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** O endereço é seguro de buscar? Devolve o motivo quando não. */
async function conferir(url: URL): Promise<string | null> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Só endereços http e https.";
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (isIP(host)) {
    return ehInterno(host) ? "Endereço de rede interna." : null;
  }

  try {
    // `all: true` PORQUE UM NOME PODE TER VÁRIOS IPs, e basta um interno para
    // o pedido acabar lá dentro — quem escolhe qual usar é o sistema, não nós.
    const enderecos = await lookup(host, { all: true });
    if (enderecos.length === 0) return "Endereço não resolvido.";
    if (enderecos.some((e) => ehInterno(e.address))) {
      return "Endereço de rede interna.";
    }
    return null;
  } catch {
    return "Endereço não resolvido.";
  }
}

/** O conteúdo de uma metatag, por `property` ou por `name`. */
function meta(html: string, chave: string): string | null {
  const padroes = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${chave}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${chave}["']`,
      "i",
    ),
  ];

  for (const padrao of padroes) {
    const achado = html.match(padrao);
    if (achado?.[1]) return decodificar(achado[1]).trim() || null;
  }
  return null;
}

/**
 * As cinco entidades que aparecem em título de página.
 *
 * Não é um parser de HTML, e não precisa ser: o que sai daqui vai para um
 * campo de texto que a pessoa confere. Uma entidade exótica que escape vira
 * um `&hellip;` visível no campo, que ela apaga — não vira HTML na tela,
 * porque o React escapa o que renderiza.
 */
function decodificar(texto: string): string {
  return texto
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export async function buscarMetadados(
  endereco: string,
): Promise<{ ok: true; previa: PreviaDoLink } | { ok: false; motivo: string }> {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return { ok: false, motivo: "Endereço inválido." };
  }

  let resposta: Response | null = null;

  // OS SALTOS SÃO SEGUIDOS À MÃO, e cada destino passa pela mesma checagem.
  // Com `redirect: "follow"` o fetch iria sozinho até o fim, e o 302 para
  // `127.0.0.1` seria obedecido sem ninguém olhar.
  for (let salto = 0; salto <= SALTOS; salto++) {
    const recusa = await conferir(url);
    if (recusa) return { ok: false, motivo: recusa };

    const parar = AbortSignal.timeout(TEMPO_LIMITE);
    try {
      resposta = await fetch(url, {
        redirect: "manual",
        signal: parar,
        headers: {
          // O nome do produto, para quem olhar o log do outro lado saber quem
          // bateu — e um Accept que diz que só interessa HTML.
          "user-agent": "FullHub/1.0 (+prévia de link)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch {
      return { ok: false, motivo: "O site não respondeu." };
    }

    if (resposta.status >= 300 && resposta.status < 400) {
      const destino = resposta.headers.get("location");
      if (!destino) return { ok: false, motivo: "O site não respondeu." };
      try {
        url = new URL(destino, url);
      } catch {
        return { ok: false, motivo: "O site não respondeu." };
      }
      continue;
    }

    break;
  }

  if (!resposta || !resposta.ok) {
    return { ok: false, motivo: "O site não respondeu." };
  }

  const tipo = resposta.headers.get("content-type") ?? "";
  if (!tipo.includes("html")) {
    return { ok: false, motivo: "O endereço não é uma página." };
  }

  // LÊ ATÉ O TETO E PARA. `resposta.text()` traria o arquivo inteiro para a
  // memória antes de qualquer corte — e o teto existe justamente para o caso
  // de o outro lado mandar algo enorme.
  const leitor = resposta.body?.getReader();
  if (!leitor) return { ok: false, motivo: "O site não respondeu." };

  const pedacos: Uint8Array[] = [];
  let tamanho = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done || !value) break;
      pedacos.push(value);
      tamanho += value.length;
      if (tamanho >= TETO) break;
    }
  } finally {
    await leitor.cancel().catch(() => {});
  }

  const html = new TextDecoder().decode(
    pedacos.reduce<Uint8Array>((tudo, p) => {
      const junto = new Uint8Array(tudo.length + p.length);
      junto.set(tudo);
      junto.set(p, tudo.length);
      return junto;
    }, new Uint8Array()),
  );

  const titulo =
    meta(html, "og:title") ??
    meta(html, "twitter:title") ??
    decodificar(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim() ??
    null;

  const imagem = meta(html, "og:image") ?? meta(html, "twitter:image");

  return {
    ok: true,
    previa: {
      titulo: titulo || null,
      descricao:
        meta(html, "og:description") ??
        meta(html, "twitter:description") ??
        meta(html, "description"),
      // A IMAGEM PODE VIR RELATIVA (`/capa.png`), e uma URL relativa no `src`
      // de um `<img>` do Full Hub apontaria para o Full Hub. Resolver contra
      // a página é o que a faz apontar para o site de onde veio.
      imagem: imagem ? new URL(imagem, url).toString() : null,
    },
  };
}
