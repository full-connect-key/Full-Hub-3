"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  exigirEquipeNaAcao,
  exigirGestorNaAcao,
  exigirSocioNaAcao,
} from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações do Full Days.
 *
 * Três delas não escrevem direto na tabela, e sim chamam uma função do
 * Postgres: `decidir_solicitacao` e `cancelar_solicitacao`. Não é preferência
 * de estilo — é o que o sprint pede quando diz que aprovar tem que ser
 * transacional. Aprovar muda o status, pinta os dias na matriz e avisa o
 * solicitante; três chamadas pelo PostgREST são três transações, e a segunda
 * falhando deixaria um pedido "aprovada" sem nenhum dia pintado.
 *
 * As guardas daqui escrevem a mensagem em português. Quem recusa de verdade é
 * o banco: `decidir_solicitacao` confere `is_socio()` na primeira linha, e
 * quem montar a chamada à mão é recusado lá.
 */

const ROTA = "/painel/full-days";

const esquemaDeSolicitacao = z.object({
  tipo: z.enum(["ferias", "licenca", "ausencia"]),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data inicial."),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data final."),
  motivo: z.string().trim().max(1000).nullable().optional(),
});

export async function solicitar(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("solicitar", async () => {
    const sessao = await exigirEquipeNaAcao();

    const validacao = esquemaDeSolicitacao.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("solicitar", validacao.error, dados, "Confira as datas do pedido."));
    }
    const entrada = validacao.data;

    if (entrada.data_fim < entrada.data_inicio) {
      return falha("A data final não pode ser antes da inicial.");
    }

    const supabase = await criarClienteServidor();

    // Os dias úteis saem do BANCO, não da conta que a tela fez. A tela conta
    // para mostrar o número enquanto a pessoa seleciona; se o gravado viesse
    // dali, bastaria alterar o corpo da requisição para pedir 15 dias
    // dizendo que são 3.
    const { data: dias, error: erroDosDias } = await supabase.rpc("dias_uteis", {
      inicio: entrada.data_inicio,
      fim: entrada.data_fim,
    });

    if (erroDosDias) return falha(`Não foi possível contar os dias: ${erroDosDias.message}`);
    if (!dias || dias <= 0) {
      return falha("O período escolhido não tem nenhum dia útil — só fim de semana e feriado.");
    }

    const { data, error } = await supabase
      .from("hr_requests")
      .insert({
        user_id: sessao.usuarioId,
        tipo: entrada.tipo,
        data_inicio: entrada.data_inicio,
        data_fim: entrada.data_fim,
        dias_uteis: dias,
        motivo: entrada.motivo?.trim() || null,
      })
      .select("id")
      .single();

    // Os triggers do descanso devolvem a mensagem já escrita para gente ler —
    // "são 15 dias por ano, você já tem 10 comprometidos". Repassar o texto do
    // banco é melhor que traduzir aqui e arriscar as duas versões divergirem.
    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou o pedido.");

    await avisarOsSocios(supabase, sessao.usuarioId, entrada.tipo, dias);

    revalidatePath(ROTA);
    return sucesso(
      `Pedido enviado: ${dias} dia(s) útil(eis). Os sócios foram avisados.`,
      data.id,
    );
  });
}

/**
 * Avisa todos os sócios de que chegou pedido.
 *
 * Falhar aqui NÃO desfaz o pedido: o pedido já está no banco e aparece na fila
 * de aprovações de qualquer forma. Perder o aviso atrasa; perder o pedido
 * apaga o trabalho de quem pediu.
 */
async function avisarOsSocios(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  autorId: string,
  tipo: string,
  dias: number,
) {
  try {
    const { data: socios } = await supabase
      .from("profiles")
      .select("id, nome")
      .eq("role", "socio")
      .eq("ativo", true);

    const { data: autor } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", autorId)
      .maybeSingle();

    const rotulo =
      tipo === "ferias" ? "descanso" : tipo === "licenca" ? "afastamento" : "ausência";

    for (const socio of socios ?? []) {
      await supabase.rpc("notificar", {
        p_user_id: socio.id,
        p_tipo: "full_days",
        p_titulo: `${autor?.nome ?? "Alguém"} pediu ${rotulo}`,
        p_corpo: `${dias} dia(s) útil(eis), esperando sua decisão.`,
        p_link: "/painel/full-days?aba=aprovacoes",
      });
    }
  } catch (erro) {
    console.error("[full-days] sócios não avisados:", erro);
  }
}

export async function cancelarSolicitacao(id: string): Promise<Resultado> {
  return executarAcao("cancelarSolicitacao", async () => {
    await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { error } = await supabase.rpc("cancelar_solicitacao", { p_request_id: id });
    if (error) return falha(error.message);

    revalidatePath(ROTA);
    return sucesso("Pedido cancelado.");
  });
}

export async function decidir(
  id: string,
  decisao: "aprovada" | "reprovada",
  motivo: string,
): Promise<Resultado> {
  return executarAcao("decidir", async () => {
    await exigirSocioNaAcao();
    const supabase = await criarClienteServidor();

    const { error } = await supabase.rpc("decidir_solicitacao", {
      p_request_id: id,
      p_decisao: decisao,
      p_motivo: motivo.trim() || null,
    });

    if (error) return falha(error.message);

    revalidatePath(ROTA);
    return sucesso(decisao === "aprovada" ? "Aprovado." : "Reprovado. O solicitante foi avisado.");
  });
}

/**
 * Aprovar várias de uma vez.
 *
 * Cada uma é uma chamada, e uma falha NÃO interrompe as outras: se a terceira
 * de cinco esbarrar numa regra, as outras quatro já estão aprovadas e o
 * resultado diz quantas passaram. Parar tudo por causa de uma obrigaria o
 * sócio a descobrir qual era e refazer a seleção.
 */
export async function aprovarEmLote(ids: string[]): Promise<Resultado> {
  return executarAcao("aprovarEmLote", async () => {
    await exigirSocioNaAcao();
    if (ids.length === 0) return falha("Nenhum pedido selecionado.");

    const supabase = await criarClienteServidor();
    const recusados: string[] = [];
    let aprovados = 0;

    for (const id of ids) {
      const { error } = await supabase.rpc("decidir_solicitacao", {
        p_request_id: id,
        p_decisao: "aprovada",
        p_motivo: null,
      });
      if (error) recusados.push(error.message);
      else aprovados += 1;
    }

    revalidatePath(ROTA);

    if (aprovados === 0) {
      return falha(`Nenhum foi aprovado. O banco disse: ${recusados[0] ?? "erro"}`);
    }
    if (recusados.length > 0) {
      return sucesso(
        `${aprovados} aprovado(s). ${recusados.length} ficou(aram) de fora: ${recusados[0]}`,
      );
    }
    return sucesso(`${aprovados} pedido(s) aprovado(s).`);
  });
}

const esquemaDePresenca = z.object({
  user_id: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["presente", "remoto", "ferias", "licenca", "ausente", "folga", "feriado"]),
  observacao: z.string().trim().max(200).nullable().optional(),
});

/**
 * Trocar o status de um dia na matriz.
 *
 * Gestão. O dia que veio de pedido aprovado é recusado pelo trigger
 * `team_presence_proteger` — sem ele, um clique apagaria o descanso de alguém e
 * o pedido continuaria dizendo "aprovada", duas verdades sobre o mesmo dia.
 */
export async function marcarPresenca(dados: unknown): Promise<Resultado> {
  return executarAcao("marcarPresenca", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = esquemaDePresenca.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("marcarPresenca", validacao.error, dados, "Confira o dia."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("team_presence")
      .upsert(
        {
          user_id: entrada.user_id,
          data: entrada.data,
          status: entrada.status,
          observacao: entrada.observacao ?? null,
          atualizado_por: sessao.usuarioId,
        },
        { onConflict: "user_id,data" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Editar a matriz é da gestão.");

    revalidatePath(ROTA);
    return sucesso("Dia atualizado.");
  });
}
