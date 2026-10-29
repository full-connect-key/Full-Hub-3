"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { PASSO_DA_ORDEM } from "@/lib/dominio/vertentes";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As vertentes de uma conta (migration 0118).
 *
 * ---------------------------------------------------------------------------
 * QUEM PODE: `is_gestor()`, e é a frase do usuário palavra por palavra —
 * *"somente Sócios e Desenvolvedores poderão gerenciar o cadastro das
 * vertentes"*.
 *
 * **A guarda daqui não acrescenta trava nenhuma, e vale dizer:** a ficha do
 * cliente mora em `/painel/pessoas`, que é `GESTAO` na rota desde o Sprint 3C,
 * então quem chega à tela já é sócio ou desenvolvedor. Ela existe para
 * escrever a frase em português antes de a pessoa levar um "nenhuma linha
 * voltou" — o modo de falha que a convenção do projeto proíbe. Quem recusa de
 * verdade são as policies da 0118.
 *
 * ---------------------------------------------------------------------------
 * **NÃO EXISTE APAGAR**, e a ausência é o pedido lido ao pé da letra:
 * *"adicionar, editar, reorganizar e desativar"*. A tabela nasce sem policy
 * de DELETE, então nem o sócio apaga — e aqui não há uma ação que tentasse.
 * ---------------------------------------------------------------------------
 */

const ROTA = "/painel/pessoas";

const esquemaDeCriacao = z.object({
  client_id: z.string().uuid(),
  nome: z
    .string()
    .trim()
    .min(2, "A vertente precisa de um nome.")
    .max(60, "Um nome acima de sessenta caracteres não cabe no seletor da task."),
});

/**
 * A ORDEM NOVA É A ÚLTIMA MAIS DEZ, e não `count * 10`.
 *
 * Com a contagem, desativar uma vertente e criar outra daria a mesma ordem
 * duas vezes — e duas linhas empatadas no `order by` saem numa sequência que
 * o Postgres não garante, então a lista trocaria de ordem sozinha entre duas
 * visitas. O máximo é um número que só cresce.
 */
export async function criarVertente(dados: unknown): Promise<Resultado> {
  return executarAcao("criarVertente", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeCriacao.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao("criarVertente", validacao.error, dados, "Confira o nome da vertente.", ROTULOS),
      );

    const supabase = await criarClienteServidor();
    const { data: ultima } = await supabase
      .from("client_vertentes")
      .select("ordem")
      .eq("client_id", validacao.data.client_id)
      .order("ordem", { ascending: false })
      .limit(1);

    const { error } = await supabase.from("client_vertentes").insert({
      client_id: validacao.data.client_id,
      nome: validacao.data.nome,
      ordem: (ultima?.[0]?.ordem ?? 0) + PASSO_DA_ORDEM,
    });

    // O ÍNDICE ÚNICO FALA EM INGLÊS, e a pessoa não tem o que fazer com
    // "duplicate key value violates unique constraint". A frase diz o que
    // aconteceu e o que fazer.
    if (error?.code === "23505") {
      return falha(`Esta conta já tem uma vertente chamada "${validacao.data.nome}".`);
    }
    if (error) return falha(`Não foi possível criar a vertente: ${error.message}`);

    revalidatePath(ROTA);
    return sucesso("Vertente criada.");
  });
}

const esquemaDeRenomear = z.object({
  id: z.string().uuid(),
  nome: z
    .string()
    .trim()
    .min(2, "A vertente precisa de um nome.")
    .max(60, "Um nome acima de sessenta caracteres não cabe no seletor da task."),
});

/**
 * Renomear NÃO perde histórico, e isso é consequência do modelo e não de
 * código: a task aponta para a LINHA, então o nome mora num lugar só e toda
 * tela que o desenha passa a dizer o novo. É o *"qualquer alteração de nome
 * deverá ser refletida em todas as áreas relacionadas, sem perder o
 * histórico"* do pedido, de graça.
 */
export async function renomearVertente(dados: unknown): Promise<Resultado> {
  return executarAcao("renomearVertente", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeRenomear.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao("renomearVertente", validacao.error, dados, "Confira o nome da vertente.", ROTULOS),
      );

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_vertentes")
      .update({ nome: validacao.data.nome })
      .eq("id", validacao.data.id)
      .select("id");

    if (error?.code === "23505") {
      return falha(`Esta conta já tem uma vertente chamada "${validacao.data.nome}".`);
    }
    if (error) return falha(`Não foi possível renomear: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Só sócio e desenvolvedor mexem nas vertentes de uma conta.");
    }

    revalidatePath(ROTA);
    return sucesso("Nome trocado.");
  });
}

const esquemaDeAtivacao = z.object({
  id: z.string().uuid(),
  ativa: z.boolean(),
});

/**
 * Desativar TIRA DO SELETOR e não encosta no que já foi classificado.
 *
 * É a forma da etiqueta do Acervo (`skills.ativa`) e do fluxo de social
 * desativado. Aqui ela é mais que convenção: as demandas que apontam para
 * esta vertente continuam apontando, e é isso que mantém de pé o relatório
 * por vertente do que já foi entregue.
 */
export async function alternarVertente(dados: unknown): Promise<Resultado> {
  return executarAcao("alternarVertente", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeAtivacao.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao("alternarVertente", validacao.error, dados, "Confira os dados.", ROTULOS),
      );

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_vertentes")
      .update({ ativa: validacao.data.ativa })
      .eq("id", validacao.data.id)
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Só sócio e desenvolvedor mexem nas vertentes de uma conta.");
    }

    revalidatePath(ROTA);
    return sucesso(validacao.data.ativa ? "Vertente reativada." : "Vertente desativada.");
  });
}

const esquemaDaOrdem = z.object({
  client_id: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(2, "Reordenar uma lista de um item não muda nada."),
});

/**
 * A ORDEM INTEIRA VAI DE UMA VEZ, e não um "subir/descer" por linha.
 *
 * Duas razões, e a segunda é a que decide: mover um item no meio de uma lista
 * de seis muda a posição de todos os que vêm depois, então um `update` por
 * clique seriam cinco idas ao banco com a lista inconsistente entre elas. E o
 * `upsert` em lote é uma transação só — ou a ordem nova inteira vale, ou
 * nenhuma parte dela.
 *
 * As posições são reescritas do zero com o passo de dez. Guardar os números
 * antigos e só trocar dois seria mais esperto e pior: depois de algumas
 * arrastadas os valores convergem, e duas linhas empatadas saem numa ordem
 * que o Postgres não garante.
 */
export async function reordenarVertentes(dados: unknown): Promise<Resultado> {
  return executarAcao("reordenarVertentes", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDaOrdem.safeParse(dados);
    if (!validacao.success)
      return falha(
        recusaDeValidacao("reordenarVertentes", validacao.error, dados, "Confira a ordem.", ROTULOS),
      );

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("client_vertentes")
      .upsert(
        validacao.data.ids.map((id, i) => ({
          id,
          client_id: validacao.data.client_id,
          // O `nome` não viaja: `upsert` sem ele deixaria a coluna `not null`
          // sem valor num INSERT. Como todos os ids já existem, o caminho é
          // sempre o UPDATE do `on conflict` — e é por isso que a ação exige
          // os ids em vez de aceitar linhas novas.
          ordem: (i + 1) * PASSO_DA_ORDEM,
        })) as never,
        { onConflict: "id" },
      )
      .select("id");

    if (error) return falha(`Não foi possível reordenar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Só sócio e desenvolvedor mexem nas vertentes de uma conta.");
    }

    revalidatePath(ROTA);
    return sucesso("Ordem salva.");
  });
}

/** O rótulo de cada campo, para a recusa de validação falar português. */
const ROTULOS: Record<string, string> = {
  client_id: "conta",
  id: "vertente",
  nome: "nome da vertente",
  ativa: "situação",
  ids: "ordem",
};
