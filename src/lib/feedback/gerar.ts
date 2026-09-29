import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  MODELO_PADRAO,
  PROMPT_VERSAO,
  type ContextoDoFeedback,
  type MetricasDoFeedback,
} from "@/lib/dominio/feedback";
import { TEXTO_DO_SISTEMA, mensagemComOsDados } from "@/lib/feedback/prompt";

/**
 * A CHAMADA A CLAUDE (Sprint 3H).
 *
 * `server-only`, e aqui isso não é zelo: `ANTHROPIC_API_KEY` não tem prefixo
 * `NEXT_PUBLIC_`, e mesmo assim nem o NOME dela pode aparecer num arquivo que
 * o navegador carrega. É a regra de `lib/supabase/admin.ts` e de
 * `lib/email/config.ts` — a chave é lida DENTRO da função, nunca num `const`
 * de topo de módulo, senão ela é capturada na primeira importação e a
 * verificação de `/status` passa a responder sobre um valor congelado.
 *
 * ---------------------------------------------------------------------------
 * A GERAÇÃO NÃO RODA SOZINHA, E O MOTIVO ESTÁ REGISTRADO.
 *
 * O sprint manda isto para uma Edge Function chamada pela rotina agendada.
 * Neste projeto não há Edge Functions, e o Postgres não fala HTTP: as rotinas
 * do `pg_cron` chamam RPC do PostgREST, e nenhuma delas alcança a API da
 * Anthropic. Então a chamada mora aqui, no Next, e **quem a dispara é a
 * gestão, por botão**.
 *
 * A geração periódica depende de uma coisa que a rotina não tem: **a URL do
 * app**. É a mesma pendência que deixa o rodapé do painel dizendo "versão
 * local" desde que a VPS saiu. No dia em que houver o endereço, isto vira uma
 * linha em `scripts/rodar-rotinas.sh` — e nada aqui muda.
 * ---------------------------------------------------------------------------
 *
 * **SEM A CHAVE, NADA QUEBRA.** O botão de gerar diz o que falta, e o resto do
 * módulo continua de pé: os relatórios já gerados abrem, a revisão funciona, o
 * envio funciona. É a decisão de `RESEND_API_KEY` — o que se perde é a
 * geração, não o módulo.
 */

/** Se dá para chamar a API. `/status` pergunta isto. */
export function temChaveDaAnthropic() {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim().length > 0;
}

export type TextoGerado = {
  texto: string;
  modelo: string;
  promptVersao: string;
};

/**
 * Escreve o feedback a partir dos números que o banco já calculou.
 *
 * **Não faz verificação nenhuma**, de propósito: quem confere o texto é
 * `verificarOTexto()`, que é puro e mora em domínio. Se a conferência morasse
 * aqui, ela viraria `server-only` e a tela de revisão não poderia recontar o
 * que foi achado ao mostrar um relatório antigo.
 */
export async function escreverOFeedback(
  nome: string,
  metricas: MetricasDoFeedback,
  contexto: ContextoDoFeedback,
): Promise<TextoGerado> {
  const chave = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!chave) {
    throw new Error(
      "A geração de feedback precisa da ANTHROPIC_API_KEY no ambiente do servidor.",
    );
  }

  const cliente = new Anthropic({ apiKey: chave });

  let resposta;
  try {
    resposta = await cliente.messages.create({
      model: MODELO_PADRAO,
      max_tokens: 8000,
      system: TEXTO_DO_SISTEMA,
      // ADAPTATIVO, e não desligado: a tarefa parece simples e não é. O modelo
      // precisa ler dois JSONs, escolher DOIS pontos de melhoria entre vários
      // candidatos, e não escorregar em nenhuma das regras absolutas — e é
      // instrução que ele precisa seguir, não texto que ele precisa produzir.
      thinking: { type: "adaptive" },
      // `medium` ESCRITO, e não herdado: é o default do modelo hoje, e um
      // default que muda sem ninguém tocar no código mudaria o custo e o tom
      // de todo feedback da agência de uma vez.
      output_config: { effort: "medium" },
      messages: [
        { role: "user", content: mensagemComOsDados(nome, metricas, contexto) },
      ],
    });
  } catch (erro) {
    // DO MAIS ESPECÍFICO PARA O MAIS GERAL, porque cada um destes pede uma
    // coisa diferente de quem clicou -- e "erro ao gerar o feedback" mandaria
    // a pessoa procurar em qual dos quatro.
    if (erro instanceof Anthropic.AuthenticationError) {
      throw new Error(
        "A chave da API da Anthropic foi recusada. Confira ANTHROPIC_API_KEY no ambiente do servidor.",
      );
    }
    if (erro instanceof Anthropic.RateLimitError) {
      throw new Error(
        "A API da Anthropic recusou por limite de uso. Espere alguns minutos e gere de novo — nada foi gravado.",
      );
    }
    if (erro instanceof Anthropic.BadRequestError) {
      throw new Error(
        `A API da Anthropic recusou o pedido: ${erro.message}. O relatório não foi gerado.`,
      );
    }
    if (erro instanceof Anthropic.APIError) {
      throw new Error(
        `A API da Anthropic respondeu com erro: ${erro.message}. O relatório não foi gerado.`,
      );
    }
    throw erro;
  }

  // A RECUSA DO MODELO É UM DESFECHO, e não uma exceção: `stop_details` só vem
  // preenchido quando `stop_reason` é `refusal`, então ler antes de conferir
  // seria ler `undefined` na maioria das vezes.
  if (resposta.stop_reason === "refusal") {
    throw new Error(
      "O modelo recusou escrever este feedback. Confira as métricas do período; nada foi gravado.",
    );
  }

  // `content` é uma união discriminada: sem o filtro por `type`, um bloco de
  // raciocínio entraria no texto que a pessoa vai ler.
  const texto = resposta.content
    .filter((bloco): bloco is Anthropic.TextBlock => bloco.type === "text")
    .map((bloco) => bloco.text)
    .join("\n")
    .trim();

  if (!texto) {
    throw new Error(
      "O modelo respondeu sem texto. Gere de novo; nada foi gravado.",
    );
  }

  return {
    texto,
    // O modelo que RESPONDEU, e não o que foi pedido: eles podem divergir, e
    // quem investiga um texto estranho precisa do que escreveu.
    modelo: resposta.model ?? MODELO_PADRAO,
    promptVersao: PROMPT_VERSAO,
  };
}
