"use server";

import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirEquipeNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import type { Conteudo } from "@/lib/aprovacoes/conteudo";

export type AprovadorDaConta = { id: string; nome: string; email: string };

export type QuemPodeAprovar = {
  /** A empresa do material. Preenchida pela ação, nunca escolhida. */
  clienteId: string;
  empresa: string;
  /** As pessoas ATIVAS com acesso ao portal daquela empresa. */
  aprovadores: AprovadorDaConta[];
};

/**
 * QUEM PODE APROVAR O MATERIAL QUE ESTÁ SENDO ENVIADO.
 *
 * ---------------------------------------------------------------------------
 * **É LEITURA NUMA ACTION, e tem precedente**: `buscarDisponibilidade` e
 * `buscarPreviaDoLink` fazem o mesmo. A convenção manda leitura para
 * `lib/dados/`, que é `server-only` e serve quem renderiza no servidor; aqui
 * quem pergunta é o modal de envio, que é `"use client"` e abre em quatro
 * telas diferentes.
 *
 * **E É POR ISSO QUE ELA RECEBE O CONTEÚDO, e não o `client_id`.** Dos quatro
 * chamadores, só um tem a empresa em mãos: a etapa de demanda conhece o
 * `task_id`, a fila de aprovações internas conhece o par `(tipo, id)`, e o
 * editor do post não carrega `client_id` nenhum. Passar a empresa obrigaria
 * as quatro telas a descobri-la por conta própria — quatro consultas novas, e
 * a quarta erraria. `cliente_da_rodada()` (0064) responde pelos três tipos
 * desde então, e é a MESMA função que o gatilho usa.
 *
 * **E A LISTA SAI DA MESMA FUNÇÃO QUE A TRAVA CONSULTA**, que é a linha que
 * faz o modal não poder discordar do banco: `aprovadores_da_conta()` (0128) é
 * a definição única de quem aprova pela conta — ativos, com acesso ao portal
 * —, e `validar_nova_rodada` confere a pertinência contra ela. Uma consulta
 * própria aqui com o mesmo `where` seria o lugar onde o seletor oferece quem
 * o banco recusa. É `ICONE_DA_AREA`, que tinha três cópias e duas já
 * divergidas.
 *
 * **A LISTA VAZIA É RESPOSTA, e não falha.** Em 27 das 28 contas deste banco
 * é esse o caso, e é o que o modal precisa saber para dizer onde se dá o
 * acesso em vez de abrir um seletor sem opção — a decisão da 0023. Quem
 * recusa o envio é o banco.
 */
export async function quemPodeAprovar(
  conteudo: Conteudo,
): Promise<Resultado<QuemPodeAprovar>> {
  return executarAcao("quemPodeAprovar", async () => {
    await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data: clienteId, error: erroDoCliente } = await supabase.rpc(
      "cliente_da_rodada",
      { p_tipo: conteudo.tipo, p_id: conteudo.id },
    );

    if (erroDoCliente) return falha(erroDoCliente.message);
    if (!clienteId) {
      return falha("Este material não está no nome de nenhuma empresa.");
    }

    const [{ data: empresa }, { data: lista, error: erroDaLista }] =
      await Promise.all([
        supabase
          .from("clients")
          .select("nome_empresa")
          .eq("id", clienteId)
          .maybeSingle(),
        supabase.rpc("aprovadores_da_conta", { p_client_id: clienteId }),
      ]);

    if (erroDaLista) return falha(erroDaLista.message);

    return sucesso("", {
      clienteId,
      empresa: empresa?.nome_empresa ?? "esta empresa",
      aprovadores: (lista ?? []).map((pessoa) => ({
        id: pessoa.user_id,
        nome: pessoa.nome,
        email: pessoa.email,
      })),
    });
  });
}
