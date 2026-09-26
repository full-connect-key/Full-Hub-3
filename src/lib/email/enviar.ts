import "server-only";

import { after } from "next/server";

import {
  assuntoDoEnvio,
  chaveDoResend,
  destinoDoEnvio,
  emailConfigurado,
  remetente,
} from "./config";
import type { Mensagem } from "./mensagens";

/**
 * O envio propriamente dito (Sprint 16, Parte B).
 *
 * ---------------------------------------------------------------------------
 * **É `fetch`, e não o pacote `resend`.**
 *
 * A API é um POST com JSON e quatro campos. O SDK envolveria isso numa
 * dependência a mais no `package.json`, com o próprio ciclo de versão, para
 * economizar dez linhas — e o projeto já tomou essa decisão duas vezes pelo
 * mesmo motivo: os gráficos são SVG à mão porque toda biblioteca traz a
 * própria paleta, e a marca é SVG à mão porque um PNG congelaria a cor. Aqui
 * o que se evita é menor e a conta é a mesma.
 * ---------------------------------------------------------------------------
 *
 * **NADA AQUI PODE DERRUBAR A AÇÃO.** O e-mail é o aviso; a escrita é o
 * trabalho. Se o Resend estiver fora, o cliente que recebeu o material
 * continua vendo o material no portal — o sino, esse é do banco e sai na
 * mesma transação. É a mesma decisão de `anunciar()`, e o oposto da trilha de
 * auditoria: lá, se não dá para registrar, não se faz.
 *
 * **E o inverso também vale: o e-mail não entra no caminho crítico.** Sem o
 * `after()`, cada "Enviar ao cliente" ficaria esperando uma ida ao Resend
 * antes de a tela responder, e um Resend lento viraria um produto lento.
 */

const ENDPOINT = "https://api.resend.com/emails";

/** Quanto tempo se espera pelo Resend antes de desistir e registrar. */
const TEMPO_LIMITE_MS = 8000;

export type ResultadoDoEnvio = {
  ok: boolean;
  /** O endereço que o Resend recebeu — o de verdade, ou o desvio. */
  para: string;
  /** Foi desviado por não haver `EMAIL_AO_VIVO`? */
  desviado: boolean;
  erro?: string;
};

/**
 * Envia e ESPERA. Devolve o que aconteceu em vez de estourar.
 *
 * Não é o que as actions chamam — para isso existe `despacharEmail()`. Esta
 * fica exportada porque é ela que `npm run check:email` exercita: uma trava
 * que só dá para exercitar através de um `after()` do Next é uma trava que
 * nenhuma checagem alcança.
 */
export async function enviarEmail(
  paraQuem: string,
  mensagem: Mensagem,
): Promise<ResultadoDoEnvio> {
  // A TRAVA VEM ANTES DE TUDO, inclusive de perguntar se há chave. Assim o
  // valor de `para` que sai daqui é o desviado mesmo quando o envio nem
  // acontece — e a checagem consegue medir a decisão sem uma chave de API.
  const destino = destinoDoEnvio(paraQuem);

  if (destino.para.length === 0) {
    return { ok: false, para: destino.para, desviado: destino.desviado, erro: "sem destinatário" };
  }

  if (!emailConfigurado()) {
    return {
      ok: false,
      para: destino.para,
      desviado: destino.desviado,
      erro: "RESEND_API_KEY não configurada",
    };
  }

  const corpo = {
    from: remetente(),
    to: [destino.para],
    subject: assuntoDoEnvio(mensagem.assunto, destino),
    html: mensagem.html,
    text: mensagem.texto,
  };

  try {
    const resposta = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chaveDoResend()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      return {
        ok: false,
        para: destino.para,
        desviado: destino.desviado,
        erro: `HTTP ${resposta.status} ${detalhe.slice(0, 300)}`,
      };
    }

    return { ok: true, para: destino.para, desviado: destino.desviado };
  } catch (erro) {
    return {
      ok: false,
      para: destino.para,
      desviado: destino.desviado,
      erro: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

/**
 * Manda depois da resposta, para uma pessoa ou para várias.
 *
 * **Uma requisição por destinatário, e não um `to` com a lista.** Pôr três
 * endereços no mesmo envio mostra a cada cliente quem mais recebeu — que num
 * produto onde uma empresa não pode saber da outra é vazamento, não
 * inconveniência. E o assunto com o aviso de desvio só nomeia um.
 */
export function despacharEmail(paraQuem: string | string[], mensagem: Mensagem): void {
  const lista = (Array.isArray(paraQuem) ? paraQuem : [paraQuem])
    .map((e) => e.trim())
    .filter(Boolean);

  if (lista.length === 0) return;

  after(async () => {
    for (const endereco of lista) {
      const r = await enviarEmail(endereco, mensagem);
      if (!r.ok) {
        // O LOG É A ÚNICA COISA QUE SOBRA quando o envio falha: a pessoa que
        // clicou já viu "enviado", e o destinatário não tem como saber que
        // faltou um e-mail que ele nunca recebeu.
        console.error(`[email] falhou para ${r.para}: ${r.erro}`);
      }
    }
  });
}

/**
 * Faz o trabalho de descobrir PARA QUEM avisar depois da resposta.
 *
 * ---------------------------------------------------------------------------
 * **`despacharEmail()` sozinho não bastava, e o motivo é latência.**
 *
 * Ele já manda depois da resposta — mas quem o chama precisa antes descobrir
 * os destinatários, e isso são três ou quatro idas ao banco: o dono do
 * conteúdo, a empresa dele, as preferências, os endereços. Feitas antes do
 * `return`, elas entram no caminho crítico de quem clicou. No comentário, que
 * é a ação mais repetida do portal, isso é meio segundo a mais por clique
 * para mandar um e-mail que a pessoa nem sabe que existe.
 *
 * Aqui dentro, a resposta já saiu. O custo é que um erro na descoberta não
 * tem mais como virar mensagem na tela — e está certo que não tenha: a
 * escrita deu certo, e é dela que a pessoa precisa saber.
 * ---------------------------------------------------------------------------
 */
export function avisarDepois(rotulo: string, trabalho: () => Promise<void>): void {
  after(async () => {
    try {
      await trabalho();
    } catch (erro) {
      console.error(`[email:${rotulo}] não deu para avisar:`, erro);
    }
  });
}
