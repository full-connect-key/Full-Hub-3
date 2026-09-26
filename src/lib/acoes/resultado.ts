import "server-only";

import type { Resultado } from "./tipos";
import { traduzirErroDoBanco } from "./migration-pendente";

/**
 * Contrato de toda Server Action do Full Hub.
 *
 * REGRA DO PROJETO: nenhuma operação de escrita pode falhar em silêncio.
 *
 * Toda action devolve `{ ok: false, error }` com a mensagem real do Supabase
 * em vez de lançar exceção, porque exceção lançada dentro de uma action chega
 * ao navegador como uma promise rejeitada genérica: o formulário não sabe o
 * que dizer e a tela não muda. Foi exatamente isso que fez os cadastros
 * "não acontecerem" sem nenhum aviso.
 */

export type { Resultado } from "./tipos";

export function sucesso<T = undefined>(mensagem: string, dados?: T): Resultado<T> {
  return { ok: true, mensagem, dados };
}

/**
 * A recusa que a pessoa lê.
 *
 * **Passa por `traduzirErroDoBanco()`, e é a única coisa que ela faz.** A
 * mensagem do Postgres e a do PostgREST chegam aqui cruas de propósito — é o
 * que faz a tela dizer *"esta demanda tem etapa sem aprovação"* com os nomes
 * que o `hint` do banco escreveu. O que a tradução cobre é a única família em
 * que a mensagem crua é exata E inútil: o schema desatualizado. Ali o texto
 * fala de cache e de listas de parâmetros, e a resposta é rodar uma migration
 * — duas coisas que não se ligam sozinhas na cabeça de quem está do lado de
 * fora do repositório.
 */
export function falha<T = undefined>(error: string): Resultado<T> {
  return { ok: false, error: traduzirErroDoBanco(error) };
}

/**
 * Erro previsto de uma action: perfil sem permissão, registro inexistente,
 * confirmação que não confere. A mensagem é escrita para a pessoa ler.
 */
export class ErroDeAcao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeAcao";
  }
}

/**
 * `redirect()` e `forbidden()` funcionam lançando um erro com `digest`. O
 * redirect precisa continuar subindo para o Next navegar; o 403 precisa virar
 * mensagem, senão a action morre calada.
 */
function digestDe(erro: unknown): string {
  return typeof erro === "object" && erro !== null && "digest" in erro
    ? String((erro as { digest?: unknown }).digest ?? "")
    : "";
}

function ehRedirect(erro: unknown): boolean {
  return digestDe(erro).startsWith("NEXT_REDIRECT");
}

function ehForbidden(erro: unknown): boolean {
  return digestDe(erro).startsWith("NEXT_HTTP_ERROR_FALLBACK;403");
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  return String(erro);
}

/**
 * Invólucro de toda action.
 *
 * O erro completo (com stack) vai para o console do servidor, para o log do
 * gerenciador de processo do servidor; a pessoa na tela recebe a mensagem
 * legível.
 */
export async function executarAcao<T = undefined>(
  rotulo: string,
  fn: () => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  try {
    return await fn();
  } catch (erro) {
    if (ehRedirect(erro)) throw erro;

    if (ehForbidden(erro)) {
      console.error(`[acao:${rotulo}] acesso negado`);
      return falha("Seu perfil não permite esta ação.");
    }

    console.error(`[acao:${rotulo}] falhou:`, erro);

    if (erro instanceof ErroDeAcao) return falha(erro.message);
    return falha(mensagemDeErro(erro));
  }
}
