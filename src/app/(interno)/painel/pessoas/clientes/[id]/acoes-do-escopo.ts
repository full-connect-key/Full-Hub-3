"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { escopoDaConta } from "@/lib/dados/escopo";
import { PASSO_DA_ORDEM, type LinhaDoEscopo } from "@/lib/dominio/escopo";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O escopo do contrato mensal de uma conta (migration 0149).
 *
 * ---------------------------------------------------------------------------
 * **QUEM PODE: `is_gestor()`**, que é a mesma pergunta das vertentes (0118) e
 * pela mesma razão: o escopo é o que foi CONTRATADO, e quem responde pelo
 * contrato é sócio ou desenvolvedor. A guarda daqui não acrescenta trava
 * nenhuma — a ficha do cliente é `GESTAO` na rota desde o Sprint 3C —, e ela
 * existe para escrever a frase em português antes de a pessoa levar um
 * "nenhuma linha voltou", que é o modo de falha que a convenção proíbe. Quem
 * recusa de verdade são as seis policies da 0149.
 *
 * ---------------------------------------------------------------------------
 * **NÃO EXISTE APAGAR**, nem o item nem o consumo, e a tabela nasce sem policy
 * de DELETE: apagar um item levaria junto o consumo de **todo mês** que aponta
 * para ele, e é justamente o histórico que o bloco do portal lê. Um item que
 * saiu do contrato se DESATIVA, que é a forma de `client_vertentes` (0118) e da
 * etiqueta do Acervo (`skills.ativa`).
 * ---------------------------------------------------------------------------
 */

const ROTA = "/painel/pessoas";

const esquemaDoItem = z.object({
  descricao: z
    .string()
    .trim()
    .min(2, "O item precisa de um nome.")
    .max(80, "Um nome acima de oitenta caracteres não cabe na linha do portal."),
  /**
   * O TETO É 100 MIL e o piso é 1, que é o `check` do banco repetido deste
   * lado para a frase ser em português: o Postgres recusaria com
   * "violates check constraint", e quantidade zero é um item que não dá
   * direito a nada — um item assim não é escopo, é uma linha que sobrou.
   */
  quantidade: z.coerce
    .number()
    .int("A quantidade é um número inteiro.")
    .min(1, "Um item com quantidade zero não dá direito a nada.")
    .max(100000, "Confira a quantidade: esse número parece um zero a mais."),
  unidade: z
    .string()
    .trim()
    .max(20, "A unidade é uma palavra curta — \"horas\", \"GB\".")
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

const esquemaDeCriacao = esquemaDoItem.extend({
  client_id: z.string().uuid(),
});

/**
 * A ORDEM NOVA É A ÚLTIMA MAIS DEZ, e não `count * 10` — a razão das
 * vertentes: com a contagem, desativar um item e criar outro daria a mesma
 * posição duas vezes, e duas linhas empatadas saem numa sequência que o
 * Postgres não garante.
 */
export async function criarItemDoEscopo(dados: unknown): Promise<Resultado> {
  return executarAcao("criarItemDoEscopo", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeCriacao.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao("criarItemDoEscopo", validacao.error, dados, "Confira o item.", ROTULOS),
      );

    const supabase = await criarClienteServidor();
    const { data: ultimo } = await supabase
      .from("client_scope_items")
      .select("ordem")
      .eq("client_id", validacao.data.client_id)
      .order("ordem", { ascending: false })
      .limit(1);

    const { error } = await supabase.from("client_scope_items").insert({
      client_id: validacao.data.client_id,
      descricao: validacao.data.descricao,
      quantidade: validacao.data.quantidade,
      unidade: validacao.data.unidade,
      ordem: (ultimo?.[0]?.ordem ?? 0) + PASSO_DA_ORDEM,
    });

    // O ÍNDICE ÚNICO FALA EM INGLÊS, e a pessoa não tem o que fazer com
    // "duplicate key value violates unique constraint".
    if (error?.code === "23505") {
      return falha(`O contrato desta conta já tem um item chamado "${validacao.data.descricao}".`);
    }
    if (error) return falha(`Não foi possível criar o item: ${error.message}`);

    revalidatePath(ROTA);
    return sucesso("Item do contrato criado.");
  });
}

const esquemaDeEdicao = esquemaDoItem.extend({
  id: z.string().uuid(),
});

/**
 * Editar NÃO reescreve o passado, e isso é consequência do modelo: o consumo
 * aponta para a LINHA, então trocar a quantidade de "Posts no feed" de 12 para
 * 16 muda a porcentagem de todos os meses — inclusive os fechados.
 *
 * **E é o certo.** A quantidade é a cláusula do contrato, não um número de
 * cada mês: quando ela muda de verdade — o contrato foi renegociado —, o que
 * a agência quer é um item NOVO, e o antigo desativado. A frase embaixo do
 * campo diz isso na tela, que é onde a decisão é tomada.
 */
export async function editarItemDoEscopo(dados: unknown): Promise<Resultado> {
  return executarAcao("editarItemDoEscopo", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeEdicao.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao("editarItemDoEscopo", validacao.error, dados, "Confira o item.", ROTULOS),
      );

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_scope_items")
      .update({
        descricao: validacao.data.descricao,
        quantidade: validacao.data.quantidade,
        unidade: validacao.data.unidade,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validacao.data.id)
      .select("id");

    if (error?.code === "23505") {
      return falha(`O contrato desta conta já tem um item chamado "${validacao.data.descricao}".`);
    }
    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Só sócio e desenvolvedor mexem no escopo do contrato.");
    }

    revalidatePath(ROTA);
    return sucesso("Item salvo.");
  });
}

const esquemaDeAtivacao = z.object({
  id: z.string().uuid(),
  ativo: z.boolean(),
});

/**
 * Desativar TIRA DO PORTAL e não encosta no que já foi lançado.
 *
 * O consumo dos meses anteriores continua no banco, e é isso que mantém de pé
 * o histórico. O que o cliente deixa de ver é o DIREITO: um item que saiu do
 * contrato mostrado com "8 de 12" afirmaria que ele ainda tem quatro.
 */
export async function alternarItemDoEscopo(dados: unknown): Promise<Resultado> {
  return executarAcao("alternarItemDoEscopo", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeAtivacao.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao("alternarItemDoEscopo", validacao.error, dados, "Confira os dados.", ROTULOS),
      );

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_scope_items")
      .update({ ativo: validacao.data.ativo, updated_at: new Date().toISOString() })
      .eq("id", validacao.data.id)
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Só sócio e desenvolvedor mexem no escopo do contrato.");
    }

    revalidatePath(ROTA);
    return sucesso(validacao.data.ativo ? "Item reativado." : "Item desativado.");
  });
}

const esquemaDoConsumo = z.object({
  item_id: z.string().uuid(),
  /** `YYYY-MM-01`. O gatilho da 0149 carimba o dia 1 de qualquer forma. */
  competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A competência é um mês."),
  usado: z.coerce
    .number()
    .int("O usado é um número inteiro.")
    .min(0, "O usado não é negativo.")
    .max(1000000, "Confira o número: ele parece um zero a mais."),
  observacao: z
    .string()
    .trim()
    .max(280, "A observação é uma frase — o cliente a lê na linha do item.")
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

/**
 * Quanto a conta usou de um item NAQUELE mês.
 *
 * ---------------------------------------------------------------------------
 * **É `upsert` e não `insert` mais `update`**, pela razão da idempotência da
 * recorrência (0040): o mesmo item no mesmo mês é digitado várias vezes — a
 * agência lança no dia 10 e corrige no dia 25 —, e duas abas abertas passariam
 * pelas duas consultas antes de qualquer uma gravar. O índice único
 * `(item_id, competencia)` é a trava, e o `on conflict` é uma instrução só.
 *
 * **O ZERO É UMA RESPOSTA e é gravado**, em vez de a ação apagar a linha: ele
 * quer dizer *"conferi este mês, e não usamos nada"*, que é diferente de
 * *"ninguém olhou ainda"* — e é essa diferença que a ficha desenha.
 *
 * **E ELE PODE PASSAR DO CONTRATADO.** Nenhuma trava compara `usado` com
 * `quantidade`, nem aqui nem no banco: o mês em que o cliente pediu mais do
 * que contratou é exatamente o fato que o bloco do portal existe para
 * mostrar, e recusá-lo faria a agência registrar um número que não aconteceu.
 * ---------------------------------------------------------------------------
 */
export async function lancarConsumoDoEscopo(dados: unknown): Promise<Resultado> {
  return executarAcao("lancarConsumoDoEscopo", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDoConsumo.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao("lancarConsumoDoEscopo", validacao.error, dados, "Confira o número.", ROTULOS),
      );

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_scope_usage")
      .upsert(
        {
          item_id: validacao.data.item_id,
          competencia: validacao.data.competencia,
          usado: validacao.data.usado,
          observacao: validacao.data.observacao,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "item_id,competencia" },
      )
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Só sócio e desenvolvedor lançam o consumo do contrato.");
    }

    revalidatePath(ROTA);
    return sucesso("Consumo salvo.");
  });
}

/**
 * O escopo da conta NOUTRO mês, para o seletor da ficha.
 *
 * ---------------------------------------------------------------------------
 * **É LEITURA NUMA ACTION, e tem precedente:** `buscarDisponibilidade` e
 * `buscarPreviaDoLink` fazem o mesmo. A convenção manda leitura para
 * `lib/dados/`, que é `server-only` e serve quem renderiza no servidor; aqui
 * quem pergunta é a aba, que é `"use client"` e troca de mês sem recarregar a
 * página — e recarregar a página devolveria a ficha para a aba Dados, porque
 * as abas são `defaultValue` e não estado na URL.
 *
 * **A GUARDA É `is_gestor()`, a MESMA do banco**, e não a rota: a ficha é
 * `GESTAO` de qualquer forma, e a pergunta certa é a que a policy faz — é a
 * lição da 0059 e de `buscarDisponibilidade`, onde uma guarda mais apertada
 * que o banco recusava quem o banco aceita.
 * ---------------------------------------------------------------------------
 */
export async function buscarEscopoDoMes(
  clienteId: string,
  competencia: string,
): Promise<Resultado<LinhaDoEscopo[]>> {
  return executarAcao("buscarEscopoDoMes", async () => {
    await exigirGestorNaAcao();

    const validacao = z
      .object({
        clienteId: z.string().uuid(),
        competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A competência é um mês."),
      })
      .safeParse({ clienteId, competencia });

    if (!validacao.success)
      return falha(
        recusaDeValidacao(
          "buscarEscopoDoMes",
          validacao.error,
          { clienteId, competencia },
          "Confira o mês.",
          ROTULOS,
        ),
      );

    const linhas = await escopoDaConta(validacao.data.clienteId, validacao.data.competencia);
    return sucesso("", linhas);
  });
}

/** O rótulo de cada campo, para a recusa de validação falar português. */
const ROTULOS: Record<string, string> = {
  client_id: "conta",
  id: "item do contrato",
  item_id: "item do contrato",
  descricao: "nome do item",
  quantidade: "quantidade contratada",
  unidade: "unidade",
  ativo: "situação",
  competencia: "mês",
  clienteId: "conta",
  usado: "quantidade usada",
  observacao: "observação",
};
