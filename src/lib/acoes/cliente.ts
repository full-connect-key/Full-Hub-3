"use client";

import { toast } from "sonner";

import type { Resultado } from "./tipos";

/**
 * A página aberta é de um build que já saiu do ar?
 *
 * Cada Server Action é identificada por um id calculado no build. Uma versão
 * nova gera ids novos — e quem estava com a aba aberta desde antes continua
 * chamando o id velho, que o servidor não conhece mais. O Next devolve
 * "Failed to find Server Action", em inglês e com link para a documentação
 * dele, numa tela que é toda em português.
 *
 * Não é erro de quem está usando, e recarregar resolve. Os docs do Next
 * pedem exatamente isto: mostrar um caminho de volta em vez de uma falha
 * seca. Por isso vira mensagem própria, com o que fazer.
 */
function ehAcaoDeOutroBuild(mensagem: string): boolean {
  return (
    mensagem.includes("Failed to find Server Action") ||
    mensagem.includes("was not found on the server")
  );
}

/**
 * O outro lado da regra "nada falha em silêncio": a tela.
 *
 * Mesmo com toda action devolvendo `{ ok: false, error }`, uma chamada pode
 * quebrar antes de chegar lá — servidor fora do ar, sessão perdida, erro de
 * serialização. Sem try/catch, essa rejeição some e a tela não diz nada.
 *
 * `chamarAcao` fecha esse buraco: qualquer falha vira um resultado com
 * mensagem, e o erro completo vai para o console do navegador.
 */
export async function chamarAcao<T>(
  executar: () => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  try {
    return await executar();
  } catch (erro) {
    console.error("[acao] a chamada não chegou ao fim:", erro);
    const detalhe = erro instanceof Error ? erro.message : String(erro);

    if (ehAcaoDeOutroBuild(detalhe)) {
      return {
        ok: false,
        error:
          "Esta página é de uma versão que saiu do ar. Recarregue (Ctrl+Shift+R) e refaça — nada foi gravado.",
      };
    }

    return {
      ok: false,
      error: `Não foi possível falar com o servidor: ${detalhe}`,
    };
  }
}

/**
 * Mostra o resultado e diz se deu certo, para a tela decidir o que fazer
 * depois. Erro sempre em toast vermelho com a mensagem real.
 */
export function mostrarResultado<T>(resultado: Resultado<T>): resultado is Extract<
  Resultado<T>,
  { ok: true }
> {
  if (!resultado.ok) {
    toast.error(resultado.error);
    return false;
  }
  toast.success(resultado.mensagem);
  return true;
}

/** Atalho para o caso mais comum: chamar, mostrar e devolver o resultado. */
export async function chamarEMostrar<T>(
  executar: () => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  const resultado = await chamarAcao(executar);
  mostrarResultado(resultado);
  return resultado;
}
