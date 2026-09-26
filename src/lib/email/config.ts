import "server-only";

/**
 * O e-mail que SAI do Full Hub (Sprint 16, Parte B).
 *
 * Este arquivo não envia nada: ele responde duas perguntas antes de qualquer
 * envio — se dá para enviar, e **para quem o envio pode ir de verdade**. A
 * segunda é a que importa, e é a razão de ela morar sozinha aqui em vez de
 * dentro do `fetch`.
 *
 * ---------------------------------------------------------------------------
 * A TRAVA É POSITIVA: SÓ VAI PARA UM ENDEREÇO REAL QUEM LIGOU `EMAIL_AO_VIVO`.
 *
 * O jeito óbvio de separar desenvolvimento de produção é `NODE_ENV`. Ele está
 * errado para isto, e o modo de falha é concreto: `NODE_ENV` é `production`
 * em TODO build — inclusive num `npm run build && npm start` na máquina de
 * quem está depurando, inclusive numa cópia de homologação, inclusive no
 * gerador de protótipo. Quem copia o `.env` de produção para reproduzir um
 * bug — que é exatamente o que se faz para reproduzir um bug — manda e-mail
 * para cliente de verdade sem ter decidido isso em lugar nenhum.
 *
 * Então a pergunta não é "é produção?", é **"alguém digitou que pode ir para
 * fora?"**. `EMAIL_AO_VIVO=true`, escrito à mão, uma vez, no ambiente que
 * publica. Qualquer outro valor — ausente, vazio, `false`, `1`, `sim` — desvia
 * tudo.
 *
 * **E desviar é melhor que não enviar.** A alternativa seria engolir o envio
 * fora de produção, e aí ninguém nunca vê o e-mail que está escrevendo: o
 * assunto quebrado, o link errado, o nome trocado só apareceriam para o
 * cliente. O desvio manda a mensagem inteira para um endereço que não é de
 * ninguém, com o destinatário pretendido escrito no assunto.
 *
 * O padrão é `delivered@resend.dev`, que é o sumidouro do próprio Resend:
 * aceita, responde 200 e não entrega a lugar nenhum. Quem quiser ver as
 * mensagens de verdade põe o próprio endereço em `EMAIL_DESVIO`.
 * ---------------------------------------------------------------------------
 *
 * **A credencial mora aqui e o arquivo é `server-only`**, pela mesma razão de
 * `lib/supabase/admin.ts`: `RESEND_API_KEY` não tem prefixo `NEXT_PUBLIC_`, e
 * ainda assim nem o NOME dela pode aparecer num arquivo que o navegador
 * carrega. `lib/env.ts` é importado pelo cliente de navegador; este não é, e
 * o `import "server-only"` faz o build quebrar se alguém tentar.
 *
 * **Tudo é lido de dentro das funções, e não em `const` de topo de módulo.**
 * Um `const` congela o valor na primeira importação, e a varredura de
 * `npm run check:email` precisa provar a trava nos dois sentidos dentro de um
 * processo só — com o valor congelado, ela testaria duas vezes o mesmo ramo e
 * diria que está tudo certo.
 */

/**
 * O sumidouro do Resend. Aceita qualquer mensagem, responde 200 e não entrega
 * a ninguém — é o endereço que existe para isto.
 */
export const DESVIO_PADRAO = "delivered@resend.dev";

/**
 * O remetente de quem ainda não verificou domínio no Resend. Sem domínio
 * próprio, este é o ÚNICO `from` que a API aceita — e é melhor sair por ele
 * do que a primeira tentativa de envio voltar com um erro de domínio que
 * ninguém sabe ler.
 */
export const REMETENTE_PADRAO = "Full Hub <onboarding@resend.dev>";

/** A chave da API do Resend. Vazia quer dizer "não configurado". */
export function chaveDoResend(): string {
  return (process.env.RESEND_API_KEY ?? "").trim();
}

/** Dá para enviar alguma coisa? */
export function emailConfigurado(): boolean {
  return chaveDoResend().length > 0;
}

/** De quem a mensagem vem. */
export function remetente(): string {
  return (process.env.EMAIL_REMETENTE ?? "").trim() || REMETENTE_PADRAO;
}

/**
 * Alguém autorizou, por escrito, que o e-mail vá para endereços de verdade?
 *
 * A comparação é com a string `"true"` e nada mais. Aceitar `"1"`, `"sim"` ou
 * qualquer coisa não vazia transformaria um `EMAIL_AO_VIVO=false` — que é o
 * que alguém escreve para DESLIGAR — num ligamento.
 */
export function envioAoVivo(): boolean {
  return (process.env.EMAIL_AO_VIVO ?? "").trim().toLowerCase() === "true";
}

/** Para onde vai tudo o que não pode ir para o destinatário de verdade. */
export function enderecoDeDesvio(): string {
  return (process.env.EMAIL_DESVIO ?? "").trim() || DESVIO_PADRAO;
}

export type Destino = {
  /** O endereço que o Resend vai receber. */
  para: string;
  /** Este envio foi desviado do destinatário de verdade? */
  desviado: boolean;
  /** Para quem ele iria se estivesse ao vivo. */
  pretendido: string;
};

/**
 * Para onde este envio vai DE VERDADE.
 *
 * É o único lugar do produto que decide isso, e por isso `enviarEmail()` não
 * aceita um endereço final: ele aceita o destinatário pretendido e chama esta
 * função. Um segundo caminho até o `fetch` seria um caminho sem a trava, e a
 * primeira vez que alguém o usasse ninguém notaria — o e-mail chegaria, que é
 * o que se espera de um e-mail.
 */
export function destinoDoEnvio(pretendido: string): Destino {
  const limpo = pretendido.trim();

  if (envioAoVivo()) {
    return { para: limpo, desviado: false, pretendido: limpo };
  }

  return { para: enderecoDeDesvio(), desviado: true, pretendido: limpo };
}

/**
 * O assunto, com o aviso de desvio na frente.
 *
 * Quem abre a caixa de teste precisa saber **para quem aquilo iria**: sem o
 * nome no assunto, dez mensagens desviadas viram dez mensagens iguais, e a
 * única coisa que se queria conferir — o e-mail certo para a pessoa certa —
 * é justamente a que some.
 */
export function assuntoDoEnvio(assunto: string, destino: Destino): string {
  return destino.desviado ? `[teste → ${destino.pretendido}] ${assunto}` : assunto;
}
