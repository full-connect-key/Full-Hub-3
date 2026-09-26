#!/usr/bin/env node
/**
 * A trava do e-mail continua impedindo que um endereço de verdade receba?
 *
 * `lib/email/config.ts` é a ÚNICA coisa entre o Full Hub e a caixa de entrada
 * de um cliente de verdade. Tudo o que o produto envia passa por
 * `destinoDoEnvio()`, e a regra é uma: sem `EMAIL_AO_VIVO=true`, ninguém
 * recebe — vai tudo para o desvio.
 *
 * ---------------------------------------------------------------------------
 * **ELA NÃO QUEBRA COM ERRO. ELA PASSA A FUNCIONAR.**
 *
 * É a mesma família de `check-preview.mjs`, e o motivo de as duas existirem:
 * uma trava que, quando some, faz o programa fazer MAIS coisas não derruba
 * build, não derruba tipo e não derruba teste de tela. Tirando a condição
 * daqui, o `npm run build` continua verde, o protótipo continua bonito, e a
 * primeira notícia é um cliente respondendo um e-mail de teste.
 *
 * E o estrago não se desfaz: e-mail enviado não volta.
 * ---------------------------------------------------------------------------
 *
 * **E ELA MEDE OS DOIS SENTIDOS.** Só a metade "desviou" passaria numa função
 * que desvia SEMPRE — que não é a trava certa, é uma trava quebrada: aí
 * nenhum cliente receberia nada em produção, e ninguém descobriria, porque
 * e-mail que não chega não avisa. Por isso o último caso liga `EMAIL_AO_VIVO`
 * e exige que o endereço de verdade passe.
 */
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const REAL = "cliente@empresa-de-verdade.com.br";
const MEU = "eu@agencia.example";

/** [o que está no ambiente, o que tem que sair, por quê] */
const CASOS = [
  [{}, "delivered@resend.dev", "sem nada configurado, vai para o sumidouro do Resend"],
  [{ EMAIL_AO_VIVO: "" }, "delivered@resend.dev", "vazio não liga"],
  [{ EMAIL_AO_VIVO: "false" }, "delivered@resend.dev", "\"false\" não liga"],
  [{ EMAIL_AO_VIVO: "1" }, "delivered@resend.dev", "\"1\" não liga"],
  [{ EMAIL_AO_VIVO: "sim" }, "delivered@resend.dev", "\"sim\" não liga"],
  [{ EMAIL_AO_VIVO: "TRUE " }, REAL, "\"TRUE \" liga — maiúscula e espaço não deveriam atrapalhar"],
  [{ EMAIL_DESVIO: MEU }, MEU, "com EMAIL_DESVIO, o desvio é o endereço de quem configurou"],
  [{ EMAIL_AO_VIVO: "true", EMAIL_DESVIO: MEU }, REAL, "AO VIVO: o endereço de verdade passa"],
];

// O `import "server-only"` estoura fora do Next -- ele existe justamente para
// impedir que este módulo vá para o navegador. A cópia sem a primeira linha é
// o mesmo código; o que muda é onde ele pode ser carregado.
const fonte = await readFile("src/lib/email/config.ts", "utf8");
const pasta = await mkdtemp(join(tmpdir(), "fh-email-"));
const copia = join(pasta, "config.ts");
await writeFile(copia, fonte.replace(/^import "server-only";\n/, ""));

let falhas = 0;
try {
  const { destinoDoEnvio, assuntoDoEnvio } = await import(pathToFileURL(copia).href);

  console.log("\nSó vai para endereço de verdade quem ligou EMAIL_AO_VIVO\n");

  for (const [ambiente, esperado, porque] of CASOS) {
    // Limpa as duas antes de cada caso: um resíduo do caso anterior faria o
    // teste seguinte medir outra coisa e passar pelo motivo errado.
    delete process.env.EMAIL_AO_VIVO;
    delete process.env.EMAIL_DESVIO;
    Object.assign(process.env, ambiente);

    const destino = destinoDoEnvio(REAL);
    const certo = destino.para === esperado;
    if (!certo) falhas++;

    console.log(
      `  ${certo ? "ok     " : "FALHA  "} ${porque}` +
        (certo ? "" : `\n          esperava "${esperado}", veio "${destino.para}"`),
    );
  }

  // O AVISO NO ASSUNTO é a outra metade do desvio: sem ele, dez mensagens
  // desviadas viram dez mensagens iguais, e quem confere não sabe para quem
  // cada uma iria -- que é justamente o que se queria conferir.
  delete process.env.EMAIL_AO_VIVO;
  delete process.env.EMAIL_DESVIO;
  const desviado = destinoDoEnvio(REAL);
  const assunto = assuntoDoEnvio("Novo material para aprovar", desviado);
  const nomeia = assunto.includes(REAL);
  if (!nomeia) falhas++;
  console.log(
    `  ${nomeia ? "ok     " : "FALHA  "} o assunto desviado nomeia o destinatário pretendido` +
      (nomeia ? "" : `\n          veio "${assunto}"`),
  );

  // E AO VIVO ELE NÃO APARECE: um "[teste → …]" no assunto de um e-mail que
  // chegou ao cliente é pior que o desvio, porque ele lê.
  process.env.EMAIL_AO_VIVO = "true";
  const aoVivo = destinoDoEnvio(REAL);
  const limpo = assuntoDoEnvio("Novo material para aprovar", aoVivo) === "Novo material para aprovar";
  if (!limpo) falhas++;
  console.log(
    `  ${limpo ? "ok     " : "FALHA  "} ao vivo, o assunto sai sem aviso de teste`,
  );
} finally {
  await rm(pasta, { recursive: true, force: true });
}

console.log(
  falhas === 0
    ? "\nTudo certo.\n"
    : `\n${falhas} caso(s) em que a trava do e-mail não se comportou.\n`,
);
process.exit(falhas === 0 ? 0 : 1);
