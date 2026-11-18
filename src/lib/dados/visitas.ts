import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * AS ROTAS QUE ESTA PESSOA MAIS ABRE, da mais usada para a menos (0142).
 *
 * ---------------------------------------------------------------------------
 * **DEVOLVE `string[]` E NÃO AS LINHAS, e é a assinatura estreita de
 * `nivelDaCarga()`.** O `peso` é COMO a ordem é calculada, e a ORDEM é a
 * informação — ninguém no produto desenha o número, e devolvê-lo obrigaria
 * todo chamador (a tela, o stub do protótipo) a carregar um campo que ele não
 * lê. É a lição escrita daquela função: *"pedindo o tipo inteiro, quem tem o
 * número de outra consulta precisaria inventar `userId`, `dia` e `ausente` — e
 * o molde errado mente com mais convicção que a ausência"*.
 *
 * **E NÃO HÁ PISO DE PESO**, que é a trava que parece faltar: uma rota aberta
 * duas vezes na vida não deveria virar atalho. Ela não vira — o cartão mostra
 * TRÊS, e o fallback preenche o que sobrar, então um piso só adiantaria a
 * lista fixa que a 0142 existe para tirar. Para quem abriu pouca coisa, as
 * duas ou três rotas que ela abriu **são** as mais usadas dela.
 * ---------------------------------------------------------------------------
 *
 * **A LEITURA É SÓ DA PRÓPRIA PESSOA, e quem garante é a policy.** As três de
 * `route_visits` fecham em `auth.uid()`, e **nem o sócio lê a de outra
 * pessoa**: é a régua de `client_notification_prefs` e de `academy_anotacoes`
 * — saber quais módulos um colega abre mais é vigilância, não gestão, e um
 * relatório disso nunca foi pedido.
 *
 * Por isso a consulta **não filtra por `user_id`**: repetir o recorte seria o
 * segundo lugar decidindo a mesma coisa, e a 0060 escreve o que isso vale.
 *
 * **O TETO É DE DOZE E NÃO DE TRÊS**, e o três é do CARTÃO e não da consulta:
 * quem corta é o bloco, depois de filtrar por perfil. Com o corte aqui, um
 * colaborador cuja rota mais usada fosse uma que ele deixou de alcançar
 * receberia duas linhas em vez de três — e o cartão encolheria sem nada
 * dizendo.
 *
 * **E `ouFalha` NÃO vale aqui, que é a exceção declarada.** Aquela regra
 * existe porque uma lista vazia é indistinguível da verdade — e aqui ela não
 * é: o Acesso Rápido tem FALLBACK, os três atalhos de sempre, então uma falha
 * de leitura mostra a lista fixa que o cartão sempre teve. Derrubar a tela
 * Início inteira por causa da ORDEM de um cartão seria trocar uma imprecisão
 * por uma falha total — é a decisão da faixa de novidades de Minhas Tasks e a
 * de `rotinasAgendadas()`. O erro vai para o log, porque sem ele ninguém
 * saberia por que o cartão parou de aprender.
 */
export async function minhasRotasMaisUsadas(): Promise<string[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("route_visits")
    .select("href")
    .order("peso", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[consulta:rotas mais usadas]", error);
    return [];
  }

  // A ORDEM É DO POSTGRES e não de um `sort` aqui, e isso não é preguiça: o
  // `peso` é `numeric`, e o PostgREST o entrega como STRING para não perder
  // precisão — um `sort` em JavaScript sobre o que veio ordenaria "9" acima de
  // "32". Ordenando no banco, o número nunca chega à tela.
  return (data ?? []).map((linha) => linha.href);
}
