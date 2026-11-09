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

/**
 * TROCAR QUEM APROVA, DEPOIS DO ENVIO (item 15, migration 0129).
 *
 * ---------------------------------------------------------------------------
 * **É UMA RPC E NÃO UM `update`, e a razão foi medida.** `approval_rounds` tem
 * UMA policy de UPDATE — `approval_rounds_decide` —, e ela é
 * `pode_aprovar_subtarefa / _post / _entregavel`, que depois da 0029 é
 * `is_gestor()`: a policy que governaria a troca é a que responde *"quem
 * DECIDE"*. E quem ENVIA não é a mesma lista — `enviar_mes_ao_cliente` é
 * `is_gestor() or is_atendimento()` desde a 0090 —, então o colaborador do
 * Atendimento que mandou o mês não conseguiria corrigir quem recebe. Alargar
 * aquela policy resolveria a troca e daria de lambuja o poder de decidir uma
 * rodada interna, que a 0029 manteve fechado. São duas perguntas, então a
 * troca é `security definer` com a dela escrita à mão.
 *
 * **A GUARDA DA ACTION É `exigirEquipeNaAcao()` e não uma de gestão**, que é a
 * lição da 0059: uma pergunta mais apertada aqui não acrescentaria trava
 * nenhuma — ela recusaria quem o banco aceita, e o banco já pergunta
 * `is_gestor() or is_atendimento()` na primeira linha da função.
 */
export async function trocarAprovadores(
  roundId: string,
  aprovadorIds: string[],
): Promise<Resultado<number>> {
  return executarAcao("trocarAprovadores", async () => {
    await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase.rpc("definir_aprovadores_da_rodada", {
      p_round_id: roundId,
      p_aprovadores: aprovadorIds,
    });

    if (error) return falha(error.message);

    return sucesso(
      data === 1
        ? "Uma pessoa está nomeada para aprovar."
        : `${data} pessoas estão nomeadas para aprovar.`,
      data ?? 0,
    );
  });
}

/**
 * REENVIAR O AVISO, SEM RECRIAR A RODADA (item 15, migration 0129).
 *
 * ---------------------------------------------------------------------------
 * *"Reenviar sem recriar a task"* é o pedido. Abrir outra rodada afirmaria que
 * existe uma VERSÃO nova do material — o número da rodada é a versão da peça
 * desde a 0033 —, e o material é o mesmo: o que se repete é o toque no sino.
 *
 * **E a mensagem conta quantos avisos saíram**, porque `notificar()` devolve
 * `null` sem derrubar a escrita quando não há a quem avisar (0062): zero é uma
 * resposta possível, e dizer "reenviado" sobre zero avisos seria a tela
 * afirmando o que não aconteceu.
 */
export async function reenviarAviso(roundId: string): Promise<Resultado<number>> {
  return executarAcao("reenviarAviso", async () => {
    await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase.rpc("reenviar_aviso_da_rodada", {
      p_round_id: roundId,
    });

    if (error) return falha(error.message);

    return sucesso(
      data === 0
        ? "Ninguém foi avisado: confira quem está nomeado."
        : data === 1
          ? "O aviso saiu de novo."
          : `O aviso saiu de novo para ${data} pessoas.`,
      data ?? 0,
    );
  });
}
