"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAtendimentoNaAcao } from "@/lib/acoes/guardas";
import { falha, executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { FUNCOES } from "@/lib/dominio/equipe";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações de Configurações do fluxo (migration 0064).
 *
 * ---------------------------------------------------------------------------
 * QUEM PODE: `is_atendimento()`, e não `is_gestor()`
 *
 * É a **mesma** pergunta que `tasks_insert` faz desde a 0006, e não uma
 * parecida: distribuir o trabalho de uma conta e abrir a demanda dela são a
 * mesma decisão, e quem sabe quem escreve para a Mundo Verde é quem atende a
 * Mundo Verde.
 *
 * E a guarda não é a proteção: as policies da 0064 recusam no banco. Isto
 * escreve a frase em português antes de a pessoa levar um "nenhuma linha
 * voltou" — que é o modo de falha que a convenção do projeto proíbe.
 * ---------------------------------------------------------------------------
 */

const ROTA = "/painel/pessoas";

/**
 * O upsert é pela CHAVE `client_id`, e não por id.
 *
 * A tela não sabe se a conta já tem linha — e não precisa saber: quem abre a
 * aba pela primeira vez e escolhe o aprovador faz um `insert`, quem volta
 * depois faz um `update`, e a mesma ação serve os dois. Perguntar antes seria
 * duas idas ao banco e uma janela entre elas: duas abas abertas na mesma conta
 * passariam pela consulta antes de qualquer uma gravar, e a segunda levaria a
 * recusa do índice único. O `on conflict` é o que fecha essa janela.
 */
const esquemaDosPadroes = z.object({
  client_id: z.string().uuid(),
  aprovador_interno_id: z.string().uuid().nullable().optional(),
  pasta_entrega_url: z
    .union([
      z
        .string()
        .regex(/^https?:\/\//i, "A pasta de entrega precisa começar com http:// ou https://."),
      z.literal(""),
    ])
    .optional()
    .nullable(),
  prazo_aprovacao_cliente_dias: z
    .number()
    .int()
    .min(1, "O prazo de aprovação é de pelo menos um dia.")
    .max(365, "Um prazo acima de um ano deixaria a conta fora de qualquer alerta."),
  /**
   * O FLUXO de social que os meses desta conta usam por padrão (0087).
   *
   * **Isto era uma lista de nomes de etapa** — `social_aprovacoes`, com um
   * `z.enum` montado a partir da corrente escrita em TypeScript, porque o
   * banco não tinha `check` com os nomes. Hoje a chave é um uuid e quem recusa
   * um fluxo inventado é a chave estrangeira: a validação que precisava de uma
   * lista copiada deixou de existir.
   *
   * Nulo volta ao padrão da casa, e é escolha de verdade — a conta que não tem
   * combinado próprio não deve carregar um fluxo só para preencher o campo.
   */
  social_flow_id: z.string().uuid().nullable().optional(),
});

const ROTULOS_DOS_PADROES: Record<string, string> = {
  client_id: "cliente",
  aprovador_interno_id: "aprovador interno",
  pasta_entrega_url: "pasta de entrega",
  prazo_aprovacao_cliente_dias: "prazo de aprovação do cliente",
  social_flow_id: "fluxo de social desta conta",
};

export async function salvarPadroesDaConta(dados: unknown): Promise<Resultado> {
  return executarAcao("salvarPadroesDaConta", async () => {
    await exigirAtendimentoNaAcao("Configurar os padrões de uma conta");

    const lido = esquemaDosPadroes.safeParse(dados);
    if (!lido.success) {
      return falha(
        recusaDeValidacao(
          "salvarPadroesDaConta",
          lido.error,
          dados,
          "Confira os padrões desta conta.",
          ROTULOS_DOS_PADROES,
        ),
      );
    }

    const entrada = lido.data;
    const supabase = await criarClienteServidor();

    // `.select()` no fim porque a policy pode barrar: sem ele um update
    // recusado volta sem erro e sem linha, e a tela diz "salvo" à toa.
    const { data, error } = await supabase
      .from("client_flow_defaults")
      .upsert(
        {
          client_id: entrada.client_id,
          aprovador_interno_id: entrada.aprovador_interno_id ?? null,
          pasta_entrega_url: entrada.pasta_entrega_url?.trim() || null,
          prazo_aprovacao_cliente_dias: entrada.prazo_aprovacao_cliente_dias,
          social_flow_id: entrada.social_flow_id ?? null,
        },
        { onConflict: "client_id" },
      )
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Seu perfil não permite configurar os padrões desta conta.");
    }

    revalidatePath(`${ROTA}/clientes/${entrada.client_id}`);
    return sucesso("Padrões da conta salvos.");
  });
}

const esquemaDaFuncao = z.object({
  client_id: z.string().uuid(),
  funcao: z.enum(FUNCOES),
  /** Nulo tira a função da conta. */
  user_id: z.string().uuid().nullable(),
});

export async function definirFuncaoDaConta(dados: unknown): Promise<Resultado> {
  return executarAcao("definirFuncaoDaConta", async () => {
    await exigirAtendimentoNaAcao("Definir a equipe de uma conta");

    const lido = esquemaDaFuncao.safeParse(dados);
    if (!lido.success) {
      return falha(
        recusaDeValidacao("definirFuncaoDaConta", lido.error, dados, "Confira a função e a pessoa.", {
          client_id: "cliente",
          funcao: "função",
          user_id: "pessoa",
        }),
      );
    }

    const { client_id, funcao, user_id } = lido.data;
    const supabase = await criarClienteServidor();

    // TIRAR A FUNÇÃO É APAGAR A LINHA, e não gravar `user_id` nulo.
    //
    // A coluna é `not null` de propósito: uma linha dizendo "o Redator desta
    // conta é ninguém" e a ausência de linha significam a mesma coisa para toda
    // consulta, e duas formas de dizer o mesmo é onde a próxima consulta
    // esquece uma delas.
    if (user_id === null) {
      const { data, error } = await supabase
        .from("client_function_defaults")
        .delete()
        .eq("client_id", client_id)
        .eq("funcao", funcao)
        .select("id");

      if (error) return falha(`Não foi possível tirar: ${error.message}`);
      revalidatePath(`${ROTA}/clientes/${client_id}`);
      return sucesso(
        data && data.length > 0
          ? `${funcao} saiu dos padrões desta conta.`
          : `Esta conta já não tinha ninguém em ${funcao}.`,
      );
    }

    const { data, error } = await supabase
      .from("client_function_defaults")
      .upsert({ client_id, funcao, user_id }, { onConflict: "client_id,funcao" })
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Seu perfil não permite definir a equipe desta conta.");
    }

    revalidatePath(`${ROTA}/clientes/${client_id}`);
    return sucesso(`${funcao} definido para esta conta.`);
  });
}

/**
 * Duplica um workflow global para a conta.
 *
 * A ação de duplicar **já existe** em `/painel/gestao-tasks?aba=workflows` desde o Sprint 3B, e
 * é ela que é chamada: reimplementar aqui daria duas cópias da mesma cadeia de
 * escritas (o template, as etapas, o tipo) e a segunda esqueceria uma coluna na
 * primeira vez que alguém acrescentasse uma.
 *
 * ---------------------------------------------------------------------------
 * ESTA É A ÚNICA AÇÃO DA ABA QUE NÃO É DE `is_atendimento()`, e não é descuido.
 *
 * Duplicar um fluxo é ESCREVER um fluxo, e `workflow_templates_write` fecha em
 * `is_gestor()` desde a 0008. Quem guarda é `duplicarWorkflow`, com a guarda
 * que ela sempre teve — **e é por isso que não há uma segunda guarda aqui**:
 * uma `exigirAtendimentoNaAcao` em cima recusaria antes com a frase errada, e
 * deixaria passar o colaborador do Atendimento para levar a recusa da gestão
 * uma linha adiante. É a lição da 0029 vista de perto: quando a regra mora nos
 * dois lados, o lado de cima não pode ter uma pergunta diferente da de baixo.
 *
 * O que esta camada acrescenta é o destino e a revalidação: lá a duplicação é
 * geral, aqui ela já sai no nome deste cliente e a ficha dele se redesenha.
 * ---------------------------------------------------------------------------
 */
export async function duplicarFluxoParaAConta(
  tipoId: string,
  clienteId: string,
): Promise<Resultado<string>> {
  const { duplicarWorkflow } = await import("../../../gestao-tasks/workflows/acoes");
  const resultado = await duplicarWorkflow(tipoId, clienteId);

  if (resultado.ok) revalidatePath(`${ROTA}/clientes/${clienteId}`);
  return resultado;
}
