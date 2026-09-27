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
 * requisição que **parte de dentro do servidor**, com o IP dele e o acesso que ele
 * tem.
 *
 * **São DUAS buscas e uma trava só.** `buscarMetadados()` lê o `<head>` para o
 * formulário se preencher; `baixarImagem()` traz a capa que aquele `<head>`
 * apontou, para ela ficar no bucket da agência em vez de num servidor de fora.
 * As duas passam pelo mesmo `abrir()`, e é ele que segue redirecionamento à mão
 * conferindo cada salto — uma segunda cópia daquele laço seria exatamente onde a
 * conferência do salto ficaria de fora, porque ela é a linha que parece
 * redundante. **E a segunda é a mais exposta, não a menos:** o endereço que ela
 * busca foi escolhido pelo SITE, não pela pessoa. É a família de falha conhecida como SSRF, e ela não precisa de nada
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

/**
 * Abre um endereço seguindo os redirecionamentos À MÃO, conferindo cada salto.
 *
 * ---------------------------------------------------------------------------
 * **ELE É UM SÓ PORQUE A CHECAGEM DO SALTO É O QUE SE ESQUECE.**
 *
 * Duas coisas do produto buscam um endereço que alguém digitou: a prévia do
 * link, que lê o `<head>`, e a capa da recomendação, que baixa a imagem que
 * aquele `<head>` apontou. A segunda nasceu depois — e uma segunda cópia deste
 * laço seria o lugar onde a conferência do salto fica de fora, porque ela é
 * justamente a linha que parece redundante: o endereço já foi conferido uma vez
 * antes de entrar no laço.
 *
 * O que muda entre as duas é o teto de bytes e o `accept`. O que não muda é a
 * trava, e é por isso que ela mora aqui.
 * ---------------------------------------------------------------------------
 */
async function abrir(
  inicial: URL,
  aceita: string,
): Promise<{ ok: true; resposta: Response; url: URL } | { ok: false; motivo: string }> {
  let url = inicial;

  for (let salto = 0; salto <= SALTOS; salto++) {
    const recusa = await conferir(url);
    if (recusa) return { ok: false, motivo: recusa };

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TEMPO_LIMITE),
        headers: {
          // O nome do produto, para quem olhar o log do outro lado saber quem
          // bateu.
          "user-agent": "FullHub/1.0 (+prévia de link)",
          accept: aceita,
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
      // O corpo de um 302 não interessa, e deixá-lo pendurado prende o socket
      // até o coletor passar.
      await resposta.body?.cancel().catch(() => {});
      continue;
    }

    if (!resposta.ok) return { ok: false, motivo: "O site não respondeu." };
    return { ok: true, resposta, url };
  }

  // Estourou o teto de saltos: é isto que impede dois endereços apontando um
  // para o outro de prenderem o servidor.
  return { ok: false, motivo: "O site não respondeu." };
}

/**
 * Lê o corpo da resposta até o teto e PARA.
 *
 * `resposta.text()` e `resposta.arrayBuffer()` trazem o arquivo inteiro para a
 * memória antes de qualquer corte — e o teto existe justamente para o caso de o
 * outro lado mandar algo enorme.
 */
async function lerAteOTeto(
  resposta: Response,
  teto: number,
): Promise<Uint8Array | null> {
  const leitor = resposta.body?.getReader();
  if (!leitor) return null;

  const pedacos: Uint8Array[] = [];
  let tamanho = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done || !value) break;
      pedacos.push(value);
      tamanho += value.length;
      if (tamanho >= teto) break;
    }
  } finally {
    await leitor.cancel().catch(() => {});
  }

  const junto = new Uint8Array(Math.min(tamanho, teto));
  let onde = 0;
  for (const p of pedacos) {
    if (onde >= junto.length) break;
    const cabe = Math.min(p.length, junto.length - onde);
    junto.set(p.subarray(0, cabe), onde);
    onde += cabe;
  }
  return junto;
}

export async function buscarMetadados(
  endereco: string,
): Promise<{ ok: true; previa: PreviaDoLink } | { ok: false; motivo: string }> {
  let inicial: URL;
  try {
    inicial = new URL(endereco);
  } catch {
    return { ok: false, motivo: "Endereço inválido." };
  }

  const aberto = await abrir(inicial, "text/html,application/xhtml+xml");
  if (!aberto.ok) return aberto;

  const { resposta, url } = aberto;

  const tipo = resposta.headers.get("content-type") ?? "";
  if (!tipo.includes("html")) {
    await resposta.body?.cancel().catch(() => {});
    return { ok: false, motivo: "O endereço não é uma página." };
  }

  const bytes = await lerAteOTeto(resposta, TETO);
  if (!bytes) return { ok: false, motivo: "O site não respondeu." };

  const html = new TextDecoder().decode(bytes);

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

/** 3 MB. Um poster de filme tem algumas centenas de KB; 40 MB é outra coisa. */
const TETO_DA_IMAGEM = 3 * 1024 * 1024;

/**
 * O que dá para desenhar num `<img>` sem virar vetor de script.
 *
 * **`image/svg+xml` FICA DE FORA**, e é a mesma decisão de `EH_IMAGEM` nas
 * campanhas: SVG de terceiro dentro de `<img>` é vetor de script, e uma capa
 * vem de fora por definição — é o caso que a regra descreve, não a exceção.
 */
const TIPOS_DE_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** A extensão que o arquivo ganha no bucket, a partir do tipo que chegou. */
export function extensaoDoTipo(contentType: string): string {
  const tipo = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (tipo === "image/png") return "png";
  if (tipo === "image/webp") return "webp";
  if (tipo === "image/gif") return "gif";
  return "jpg";
}

/**
 * Baixa a capa para o servidor guardar.
 *
 * ---------------------------------------------------------------------------
 * **ELA PASSA PELA MESMA TRAVA, e não é por elegância.**
 *
 * O endereço que chega aqui saiu de um `og:image` — isto é, foi escolhido pelo
 * SITE DE FORA e não pela pessoa. É pior que o caso da prévia, não melhor: um
 * site pode servir uma página inofensiva com
 * `<meta property="og:image" content="http://169.254.169.254/latest/meta-data/">`
 * e o servidor buscaria o endereço sem ninguém ter digitado nada. Conferir só o
 * link que a pessoa colou deixaria essa porta escancarada.
 *
 * E o `content-type` é conferido NA RESPOSTA e não pela extensão do endereço:
 * `capa.jpg` pode devolver HTML, e um HTML gravado no bucket com nome de imagem
 * é um arquivo que o navegador vai tentar interpretar.
 * ---------------------------------------------------------------------------
 *
 * **Ela nunca é o caminho crítico**, e quem chama trata a recusa como ausência
 * de capa — não como falha do post. A recomendação existe sem imagem, e o
 * cartão já tem um estado desenhado para isso.
 */
export async function baixarImagem(
  endereco: string,
): Promise<{ ok: true; bytes: Uint8Array; tipo: string } | { ok: false; motivo: string }> {
  let inicial: URL;
  try {
    inicial = new URL(endereco);
  } catch {
    return { ok: false, motivo: "Endereço inválido." };
  }

  const aberto = await abrir(inicial, TIPOS_DE_IMAGEM.join(","));
  if (!aberto.ok) return aberto;

  const { resposta } = aberto;

  const bruto = resposta.headers.get("content-type") ?? "";
  const tipo = bruto.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!(TIPOS_DE_IMAGEM as readonly string[]).includes(tipo)) {
    await resposta.body?.cancel().catch(() => {});
    return { ok: false, motivo: "O endereço não é uma imagem." };
  }

  const bytes = await lerAteOTeto(resposta, TETO_DA_IMAGEM);
  if (!bytes || bytes.length === 0) {
    return { ok: false, motivo: "O site não respondeu." };
  }

  return { ok: true, bytes, tipo };
}
