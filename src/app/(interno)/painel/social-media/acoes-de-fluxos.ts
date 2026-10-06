"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { falha, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { FUNCOES } from "@/lib/dominio/equipe";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações dos fluxos de social (migration 0087).
 *
 * ---------------------------------------------------------------------------
 * QUEM PODE: `is_gestor()`, e não `is_atendimento()` como quem abre o mês.
 *
 * É a separação da 0046 e da 0068, aplicada de novo: *abrir o mês é trabalho do
 * dia; desenhar a corrente que todo mês daquela conta vai percorrer é
 * configuração do produto.* O Atendimento abre a demanda de hoje e escolhe o
 * fluxo dela entre os que existem; quem decide quais existem é quem responde
 * pelo contrato.
 *
 * E a guarda não é a proteção: `social_flows_write` e `social_flow_steps_write`
 * recusam no banco, e `salvar_fluxo_de_social` é `security invoker` justamente
 * para que seja a policy a decidir. Isto escreve a frase em português antes de
 * a pessoa levar um "row-level security" na tela.
 * ---------------------------------------------------------------------------
 */

const ROTA = "/painel/social-media";

/**
 * **`papel` NÃO TEM DEFAULT AQUI**, ao contrário do banco, onde a coluna nasce
 * `producao`.
 *
 * O default do banco serve a quem monta a chamada à mão; a tela sempre sabe o
 * papel, porque ele é um seletor com três opções e nenhuma delas é "não dito".
 * Um default nesta validação esconderia o campo que a pessoa esqueceu de
 * preencher — e o campo que decide onde o material sai da agência.
 */
const esquemaDaEtapa = z.object({
  nome: z.string().trim().min(1, "Toda etapa do fluxo precisa de um nome."),
  funcao: z.enum(FUNCOES),
  papel: z.enum(["producao", "entrega", "pos_entrega"]),
  campo: z.enum(["pauta", "legenda"]).nullable().optional(),
  aprovacao_cliente: z.boolean().optional(),
  // AS DUAS PONTAS SÃO DIAS ANTES DO DIA 1 do mês, e podem ser nulas: o fluxo
  // que não sugere nada deixa os campos de data em branco, e quem abre o mês
  // escolhe. Negativo seria "depois do dia 1", que é caso real — a corrente
  // pode atravessar a virada do mês — e por isso o mínimo não é zero.
  comeca_dias_antes: z.number().int().min(-365).max(365).nullable().optional(),
  termina_dias_antes: z.number().int().min(-365).max(365).nullable().optional(),
});

const esquemaDoFluxo = z.object({
  flow_id: z.string().uuid().nullable().optional(),
  nome: z.string().trim().min(2, "Dê um nome ao fluxo."),
  descricao: z.string().trim().max(500).nullable().optional(),
  ativo: z.boolean().optional(),
  etapas: z.array(esquemaDaEtapa).min(1, "Monte a corrente do fluxo."),
});

const ROTULOS = {
  flow_id: "fluxo",
  nome: "nome do fluxo",
  descricao: "descrição",
  ativo: "fluxo ativo",
  etapas: "etapas da corrente",
};

/**
 * Grava um fluxo com a corrente dele.
 *
 * **Uma chamada só, e é `rpc` e não um `delete` mais N `insert` daqui.** Os
 * elos são apagados e reescritos, e pelo PostgREST isso seriam N+1 transações
 * — a terceira falhando deixaria o fluxo com metade da corrente, que é
 * exatamente o estado que o gatilho de coerência recusa. É a decisão de
 * `abrir_campanha()` (0051).
 */
export async function salvarFluxoDeSocial(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("salvarFluxoDeSocial", async () => {
    await exigirGestorNaAcao();

    const lido = esquemaDoFluxo.safeParse(dados);
    if (!lido.success) {
      return falha(
        recusaDeValidacao("salvarFluxoDeSocial", lido.error, dados, "Confira o fluxo.", ROTULOS),
      );
    }

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase.rpc("salvar_fluxo_de_social", {
      p_nome: lido.data.nome,
      p_etapas: lido.data.etapas.map((e) => ({
        nome: e.nome,
        funcao: e.funcao,
        papel: e.papel,
        campo: e.campo ?? null,
        aprovacao_cliente: e.aprovacao_cliente ?? false,
        comeca_dias_antes: e.comeca_dias_antes ?? null,
        termina_dias_antes: e.termina_dias_antes ?? null,
      })),
      p_flow_id: lido.data.flow_id ?? null,
      p_descricao: lido.data.descricao ?? null,
      p_ativo: lido.data.ativo ?? true,
    });

    if (error) {
      // O `hint` É METADE DA RECUSA: "o fluxo precisa de uma etapa de entrega"
      // diz o que falta, e a dica diz por que ela existe. É a mesma
      // concatenação de `atualizarTask`.
      return falha([error.message, error.hint].filter(Boolean).join(" "));
    }

    revalidatePath(ROTA);
    // A FICHA DO CLIENTE TAMBÉM, porque a aba Configurações do fluxo lista os
    // fluxos ativos: desativar um ali tem que sair da lista de lá sem
    // recarregar à mão.
    revalidatePath("/painel/pessoas");
    return sucesso(
      lido.data.flow_id ? "Fluxo salvo." : "Fluxo criado.",
      String(data ?? ""),
    );
  });
}

/**
 * Desativa ou reativa um fluxo.
 *
 * **NÃO EXISTE APAGAR**, e a ausência é a regra do módulo: um fluxo que não
 * serve mais se desativa, como a etiqueta da Academy (`skills.ativa`). Apagar
 * levaria junto o nome que os meses já abertos apontam — `tasks.social_flow_id`
 * é `on delete set null`, então a demanda ficaria apontando para ninguém e
 * ninguém mais saberia com que corrente aquele mês foi aberto.
 *
 * E a corrente dos meses já abertos não se perde de qualquer jeito: desde a
 * 0088 ela está materializada em `subtasks`, uma etapa por fase, com o papel
 * de cada elo copiado em `social_papel` no instante em que o mês abriu. É
 * SNAPSHOT e não uma chave para `social_flow_steps`, pela razão de
 * `tasks.workflow_snapshot`: editar o fluxo depois não muda nenhum mês que já
 * está correndo.
 */
const esquemaDoEstado = z.object({
  flow_id: z.string().uuid(),
  ativo: z.boolean(),
});

export async function mudarEstadoDoFluxo(dados: unknown): Promise<Resultado> {
  return executarAcao("mudarEstadoDoFluxo", async () => {
    await exigirGestorNaAcao();

    const lido = esquemaDoEstado.safeParse(dados);
    if (!lido.success) {
      return falha(
        recusaDeValidacao("mudarEstadoDoFluxo", lido.error, dados, "Confira o fluxo.", ROTULOS),
      );
    }

    const supabase = await criarClienteServidor();

    // `.select()` no fim porque a policy pode barrar: sem ele um update
    // recusado volta sem erro e sem linha, e a tela diz "salvo" à toa.
    const { data, error } = await supabase
      .from("social_flows")
      .update({ ativo: lido.data.ativo, updated_at: new Date().toISOString() })
      .eq("id", lido.data.flow_id)
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Seu perfil não permite mexer nos fluxos de social.");
    }

    revalidatePath(ROTA);
    revalidatePath("/painel/pessoas");
    return sucesso(lido.data.ativo ? "Fluxo reativado." : "Fluxo desativado.");
  });
}
