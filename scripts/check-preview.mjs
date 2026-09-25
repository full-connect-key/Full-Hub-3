#!/usr/bin/env node
/**
 * O guarda do preview de link continua recusando rede interna?
 *
 * `lib/link-preview.ts` é a ÚNICA parte do produto que faz o servidor buscar
 * um endereço escolhido por um usuário. Toda outra escrita sai de um
 * formulário e vai para o Postgres; ali o texto colado vira uma requisição que
 * parte de dentro da VPS, com o IP e o acesso dela. É a família de falha
 * conhecida como SSRF.
 *
 * **E ela não quebra com erro — ela passa a funcionar.** Um `ehInterno` que
 * deixe de cobrir uma faixa não derruba build, não derruba teste de tela, e o
 * preview continua preenchendo título e imagem como sempre. O que muda é que
 * `http://169.254.169.254/latest/meta-data/` passa a responder.
 *
 * Por isso a lista abaixo roda em toda verificação, e não uma vez: critério
 * que diz "não alcança" é o tipo que volta sem ninguém perceber.
 *
 * ---------------------------------------------------------------------------
 * E ELA CONFERE O MOTIVO, NÃO SÓ A RECUSA
 *
 * A primeira versão perguntava `r.ok === false` e nada mais. Tirei a linha do
 * `169.254` de propósito para ver a checagem estourar — e ela passou: sem o
 * guarda, o endereço é BUSCADO, ninguém responde nesta máquina, e a função
 * devolve "O site não respondeu". Recusado pela rede, não pela trava. Verde
 * pelo motivo errado.
 *
 * Na VPS, onde `169.254.169.254` responde de verdade, essa mesma checagem
 * continuaria verde no dia em que o furo existisse. É o mesmo erro que o
 * produto já pagou duas vezes: um teste que não separa a resposta certa da
 * errada afirma sem provar.
 * ---------------------------------------------------------------------------
 */
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const INTERNA = "Endereço de rede interna.";
const PROTOCOLO = "Só endereços http e https.";
const INVALIDO = "Endereço inválido.";

/** [endereço, o que é, o motivo que a trava TEM que dar] */
const CASOS = [
  ["file:///etc/passwd", "protocolo de arquivo", PROTOCOLO],
  ["gopher://127.0.0.1:6379/_INFO", "protocolo que fala com Redis", PROTOCOLO],
  ["http://localhost:3000/painel", "loopback pelo nome", INTERNA],
  ["http://127.0.0.1/", "loopback", INTERNA],
  ["http://[::1]/", "loopback IPv6", INTERNA],
  ["http://169.254.169.254/latest/meta-data/", "metadados da nuvem", INTERNA],
  ["http://10.0.0.5/", "rede privada 10/8", INTERNA],
  ["http://192.168.1.1/", "rede privada 192.168/16", INTERNA],
  ["http://172.16.0.1/", "rede privada 172.16/12", INTERNA],
  ["http://100.64.0.1/", "CGNAT", INTERNA],
  ["http://0.0.0.0/", "rota padrão", INTERNA],
  ["nao e uma url", "endereço inválido", INVALIDO],
];

// O `import "server-only"` estoura fora do Next -- ele existe justamente para
// impedir que este módulo vá para o navegador. A cópia sem a primeira linha é
// o mesmo código; o que muda é onde ele pode ser carregado.
const fonte = await readFile("src/lib/link-preview.ts", "utf8");
const pasta = await mkdtemp(join(tmpdir(), "fh-preview-"));
const copia = join(pasta, "lp.ts");
await writeFile(copia, fonte.replace(/^import "server-only";\n/, ""));

let falhas = 0;
try {
  const { buscarMetadados } = await import(pathToFileURL(copia).href);

  console.log("\nO preview recusa endereço de rede interna\n");
  for (const [alvo, porque, motivo] of CASOS) {
    const r = await buscarMetadados(alvo);
    // O MOTIVO, e não só a recusa: "O site não respondeu" é recusa da REDE, e
    // numa máquina onde o endereço responde ela vira um preview.
    const certo = r.ok === false && r.motivo === motivo;
    if (!certo) falhas++;
    console.log(
      `  ${certo ? "ok     " : "FALHA  "} ${porque.padEnd(28)} ${alvo}` +
        (certo ? "" : `\n          esperava "${motivo}", veio "${r.ok ? "passou" : r.motivo}"`),
    );
  }
} finally {
  await rm(pasta, { recursive: true, force: true });
}

console.log(
  falhas === 0
    ? "\nTudo certo.\n"
    : `\n${falhas} endereço(s) não foram recusados PELA TRAVA.\n`,
);
process.exit(falhas === 0 ? 0 : 1);
