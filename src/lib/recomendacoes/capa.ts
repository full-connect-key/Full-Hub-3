import "server-only";

import { baixarImagem, extensaoDoTipo } from "@/lib/link-preview";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * A capa da recomendação vem para o bucket da agência.
 *
 * ---------------------------------------------------------------------------
 * **A COLUNA JÁ EXISTIA, E O QUE ELA GUARDAVA NÃO APARECIA.**
 *
 * `recommendations.imagem_url` nasceu na 0017, está no formulário desde o
 * Sprint 9 e o cartão do feed a desenha. O que nunca existiu foi de onde ela
 * viesse sem alguém colar um endereço à mão — e, pior, o endereço colado **não
 * aparece**: o CSP fecha `img-src` em `'self' data: blob:` mais o Google e o
 * Supabase, então uma capa hospedada em qualquer outro lugar é recusada pelo
 * navegador e o cartão sai com a moldura quebrada. Nenhum build diz isso, e o
 * protótipo não pega — os exemplos dele apontam para `/exemplos/`, caminho
 * local.
 * ---------------------------------------------------------------------------
 *
 * **Por que BAIXAR em vez de abrir o CSP**, e as três razões são mecânicas:
 *
 *   1. O comentário do próprio CSP já calculou o preço de UMA origem externa —
 *      o favicon do Google faz cada navegador da equipe contar ao Google o que
 *      a agência anda indicando. Abrir `img-src` para `https:` seria um host
 *      novo por recomendação, com o mesmo custo multiplicado.
 *   2. **Capa apontada lá fora SOME.** O poster muda de endereço, o site sai do
 *      ar, e o feed de três anos atrás fica cheio de moldura quebrada.
 *   3. Um `<img>` para fora vaza o `Referer` de quem está olhando.
 *
 * **E ela NUNCA derruba a publicação.** Uma capa que não veio é uma
 * recomendação sem capa, e o cartão já tem esse estado desenhado — a cor da
 * categoria com o ícone dela. Devolver `null` é a resposta, não a falha: travar
 * o post porque um site não tem `og:image` seria pôr uma porta onde havia um
 * caminho, que é a mesma decisão de `buscarPreviaDoLink`.
 *
 * **O upload sai da sessão de quem postou, não da chave de serviço.** A policy
 * da 0067 exige que a primeira pasta do caminho seja `auth.uid()`, então o RLS
 * continua valendo: com a chave de serviço a trava da pasta existiria e nunca
 * seria exercida, e o dia em que o caminho fosse montado errado passaria calado.
 */
export async function guardarCapa(
  autorId: string,
  endereco: string | null | undefined,
): Promise<string | null> {
  const alvo = endereco?.trim();
  if (!alvo) return null;

  // JÁ ESTÁ NO BUCKET: devolve o mesmo caminho, sem baixar nada. É o que chega
  // pela tela — a prévia do link já guardou a capa antes de a pessoa publicar —
  // e sem esta linha cada publicação criaria um segundo arquivo idêntico, ou
  // pior, apagaria a capa que já existia devolvendo nulo.
  if (!/^https?:\/\//i.test(alvo)) return alvo;

  const baixada = await baixarImagem(alvo);
  if (!baixada.ok) {
    // O motivo vai para o log e não para a tela: quem publicou não pediu a
    // capa, ela é consequência do link. Mas some sem registro seria a
    // varredura do dia em que todas as capas pararem de chegar.
    console.error("[capa:recomendacao]", alvo, baixada.motivo);
    return null;
  }

  const supabase = await criarClienteServidor();
  // A pasta é do autor, porque é o que a policy confere. O nome é sorteado e
  // não derivado do endereço: um nome vindo de fora entra num caminho de
  // Storage, e `../` num caminho é a mesma família do `q` do Drive.
  const caminho = `${autorId}/${crypto.randomUUID()}.${extensaoDoTipo(baixada.tipo)}`;

  const { error } = await supabase.storage
    .from("recomendacoes-capas")
    .upload(caminho, baixada.bytes, { contentType: baixada.tipo });

  if (error) {
    console.error("[capa:recomendacao:upload]", caminho, error);
    return null;
  }

  return caminho;
}
