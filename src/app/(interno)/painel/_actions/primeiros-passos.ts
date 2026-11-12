"use server";

import { revalidatePath } from "next/cache";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * TICAR E DESTICAR UM ITEM DE PRIMEIROS PASSOS (0131).
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"quero que o tutorial seja possível ticar os itens,
 * caso a pessoa já saiba como fazer, sem precisar fazer o tutorial
 * necessariamente"*. O que a ação grava é a DISPENSA — *"eu já sei fazer
 * isto"* —, e nunca o fato: o item fecha com `derivado OR dispensado`, e a
 * conta mora em `lib/dados/primeiros-passos.ts`, num lugar só.
 *
 * **ELA NÃO MORA EM `lib/tour/acoes.ts`**, e a razão está no título daquele
 * arquivo: *"UMA AÇÃO SÓ GRAVA O TOUR"*. Esta não grava o tour — ela não
 * encosta em `tour_progresso`, nem quando o item ticado é o do tour. Uma
 * segunda action ali contradiria a frase que o arquivo usa para existir.
 * ---------------------------------------------------------------------------
 *
 * **É UMA AÇÃO E NÃO DUAS**, e é a decisão de `salvarOTour`: ticar e desticar
 * parecem duas coisas e são a mesma linha de `(user_id, chave)` existindo ou
 * não. Duas actions com o mesmo `exigirSessaoNaAcao`, a mesma tabela e o mesmo
 * `revalidatePath` divergiriam na primeira vez que alguém mexesse numa — e a
 * que divergiria é a de desticar, que roda muito menos.
 *
 * **E `user_id` VEM DA SESSÃO, nunca do navegador.** A trava é a policy, que
 * fecha em `auth.uid()` nas quatro operações; aqui é a pergunta certa — sem
 * ela a recusa chegaria como erro de RLS numa tela que está só anotando um
 * tique.
 */
export async function dispensarPrimeiroPasso(
  chave: string,
  dispensar: boolean,
): Promise<Resultado> {
  return executarAcao("dispensarPrimeiroPasso", async () => {
    const sessao = await exigirSessaoNaAcao();
    const supabase = await criarClienteServidor();

    if (dispensar) {
      // `upsert` COM `onConflict`, e não um `insert`: dois cliques rápidos no
      // mesmo item passariam os dois pela checagem antes de qualquer um
      // gravar, e o segundo levaria a recusa do índice único — uma frase sobre
      // chave duplicada numa tela que acabou de fazer o que foi pedido.
      const { error } = await supabase.from("primeiros_passos_dispensados").upsert(
        { user_id: sessao.usuarioId, chave },
        { onConflict: "user_id,chave" },
      );
      if (error) return falha(error.message);
    } else {
      // O `eq("user_id")` É REDUNDANTE E FICA, pela razão de sempre: a policy
      // de DELETE já recorta em `auth.uid()`, e sem a linha um `delete` que
      // alcançasse outra pessoa dependeria da policy para não acontecer. Duas
      // travas independentes custam uma condição.
      const { error } = await supabase
        .from("primeiros_passos_dispensados")
        .delete()
        .eq("user_id", sessao.usuarioId)
        .eq("chave", chave);
      if (error) return falha(error.message);
    }

    // `/painel` E SEM `"layout"`: o bloco mora na tela Início e em mais
    // nenhuma, e revalidar o layout remontaria a barra, a topbar e o sino por
    // causa de um tique. E o caminho é limpo de propósito — `revalidatePath`
    // casa por CAMINHO, e uma string com `?` não bate com rota nenhuma: a
    // chamada passaria sem erro e não revalidaria nada.
    revalidatePath("/painel");

    return sucesso(dispensar ? "Marcado como já sei fazer." : "De volta à lista.");
  });
}
