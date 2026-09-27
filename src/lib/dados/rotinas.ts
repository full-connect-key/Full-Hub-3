import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As rotinas diárias estão agendadas?
 *
 * ---------------------------------------------------------------------------
 * **DUAS FAIXAS DO PRODUTO PRECISAM SABER ISSO PARA NÃO MENTIR:** a de
 * Recorrências e o bloco de rascunho parado da Home. Até a 0072 as duas
 * afirmavam, em texto escrito à mão, que a geração é manual — e passariam a
 * depender de alguém lembrar de trocar a frase no dia em que o agendamento
 * fosse ligado, e de trocar de volta no dia em que fosse desligado.
 *
 * É a armadilha da tabela de migrations pendentes do CLAUDE.md: prosa mantida
 * à mão, lida justamente por quem está em dúvida. Agora quem responde é o
 * banco — `cron.job` é uma tabela, e `rotinas_agendadas()` a lê pelo recorte
 * de um booleano.
 *
 * **FALHA PARA "NÃO ESTÁ AGENDADO", e é de propósito.** Ela não usa
 * `ouFalha()`, que é a regra para toda leitura que É a tela: aqui a consulta
 * decide só qual de duas frases verdadeiras aparece, e derrubar a Home ou a
 * lista de Recorrências por causa dela seria trocar uma imprecisão por uma
 * falha total — a mesma decisão da faixa de novidades de Minhas Tasks.
 *
 * E o lado do erro é o seguro: `false` faz a tela dizer que a geração é
 * manual, que no pior caso manda alguém clicar em "Gerar agora" sem
 * precisar — e o índice único da 0040 recusa a geração repetida. O erro
 * contrário fazia a pessoa parar de clicar, e o cliente descobrir no dia da
 * entrega.
 * ---------------------------------------------------------------------------
 */
export async function rotinasAgendadas(): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("rotinas_agendadas");

  if (error) {
    // Sem a 0072 aplicada a RPC não existe, e o log precisa dizer isso: a tela
    // não quebra, e sem esta linha ninguém saberia por que ela insiste em
    // dizer que a geração é manual num banco onde o pg_cron está ligado.
    console.error("[consulta:rotinas agendadas]", error);
    return false;
  }

  return data === true;
}
