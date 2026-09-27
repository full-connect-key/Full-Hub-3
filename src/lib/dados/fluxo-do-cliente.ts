import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  ClientFlowDefaults,
  TeamFuncao,
  WorkflowStep,
} from "@/lib/supabase/database.types";

/**
 * Os padrões de fluxo de UMA conta (migration 0064).
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE MÓDULO NÃO GUARDA, e é a parte que evita duas verdades
 *
 * **O atendimento da conta não mora aqui.** Ele é
 * `clients.responsavel_atendimento_id`, que existe desde a 0002 e que a 0062
 * tornou crítico: é a pessoa que o Portal notifica quando o cliente comenta ou
 * decide. Uma segunda coluna com o mesmo papel divergiria em silêncio da que o
 * aviso usa, e o sintoma seria o comentário do cliente chegando para quem saiu
 * da conta.
 *
 * **As particularidades da conta também não.** São `clients.observacoes`, que a
 * ficha do cliente já desenha. O que faltava não era a coluna: era ela
 * APARECER na abertura da demanda, que é onde a particularidade decide alguma
 * coisa.
 *
 * As duas continuam sendo lidas e escritas pelo formulário do cliente, que já
 * as tem. Este módulo cuida das três coisas que não existiam.
 * ---------------------------------------------------------------------------
 */

/** Uma pessoa como a tela a desenha: nome e foto. */
export type PessoaDoFluxo = {
  id: string;
  nome: string;
  avatar_url: string | null;
};

export type PadroesDaConta = {
  /**
   * Nulo quando a conta nunca foi configurada.
   *
   * **A linha NÃO é criada na leitura**, e é a mesma decisão de
   * `client_notification_prefs` desde a 0031: escrever por causa de um olhar
   * poria uma linha no banco para cada cliente que alguém abriu por curiosidade
   * — e a trilha de auditoria registraria um `insert` que ninguém pediu.
   */
  linha: ClientFlowDefaults | null;
  aprovadorInterno: PessoaDoFluxo | null;
  /** Quem exerce cada função nesta conta, na ordem do enum. */
  porFuncao: { funcao: TeamFuncao; pessoa: PessoaDoFluxo }[];
};

// O PRAZO PADRÃO MORA EM `lib/dominio/`, porque a aba é `"use client"` e este
// arquivo é `server-only`: um valor importado daqui por um componente de
// cliente quebra o build apontando para `supabase/server.ts`, três importações
// abaixo. Ele é reexportado para quem já lia deste módulo continuar lendo.
export { PRAZO_DE_APROVACAO_PADRAO } from "@/lib/dominio/fluxo-do-cliente";

export async function padroesDaConta(clienteId: string): Promise<PadroesDaConta> {
  const supabase = await criarClienteServidor();

  const [linha, funcoes] = await Promise.all([
    supabase
      .from("client_flow_defaults")
      .select("*")
      .eq("client_id", clienteId)
      .maybeSingle(),
    supabase
      .from("client_function_defaults")
      .select("funcao, user_id")
      .eq("client_id", clienteId),
  ]);

  // `ouFalha` ANTES de decidir que a conta não tem padrões: sem linha é "ainda
  // não configuraram", e é resposta legítima; erro é o `select` recusado
  // inteiro. Juntando os dois, uma consulta quebrada apareceria como conta sem
  // configuração — e alguém reconfiguraria por cima, achando que tinha sumido.
  const padroes = ouFalha<ClientFlowDefaults | null>(
    "os padrões de fluxo da conta",
    linha,
  );
  const daFuncao = ouFalha("a equipe por função da conta", funcoes);

  const ids = [
    ...new Set(
      [padroes?.aprovador_interno_id, ...daFuncao.map((f) => f.user_id)].filter(
        Boolean,
      ),
    ),
  ] as string[];

  const pessoas = ids.length
    ? ouFalha(
        "as pessoas dos padrões da conta",
        await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", ids),
      )
    : [];

  const porId = new Map(pessoas.map((p) => [p.id, p]));

  return {
    linha: padroes,
    aprovadorInterno: padroes?.aprovador_interno_id
      ? (porId.get(padroes.aprovador_interno_id) ?? null)
      : null,
    // Ordenado pelo NOME da função e não pela ordem de inserção: a lista muda
    // de ordem a cada troca de pessoa se ela vier como o banco devolveu, e uma
    // lista de cinco linhas que se reorganiza a cada salvamento faz a pessoa
    // perder de vista a que acabou de mexer.
    porFuncao: daFuncao
      .map((f) => ({ funcao: f.funcao, pessoa: porId.get(f.user_id) }))
      .filter((f): f is { funcao: TeamFuncao; pessoa: PessoaDoFluxo } => Boolean(f.pessoa))
      .sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR")),
  };
}

/**
 * Só o mapa função → pessoa, para quem vai resolver etapas.
 *
 * Existe separado de `padroesDaConta` porque quem aplica um workflow não
 * precisa do aprovador nem da pasta, e uma consulta a mais na abertura de toda
 * demanda é uma consulta a mais em toda demanda.
 */
export async function equipePorFuncaoDaConta(
  clienteId: string,
): Promise<Map<TeamFuncao, string>> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "a equipe por função da conta",
    await supabase
      .from("client_function_defaults")
      .select("funcao, user_id")
      .eq("client_id", clienteId),
  );

  return new Map(linhas.map((l) => [l.funcao, l.user_id]));
}

/**
 * Os workflows que valem para esta conta, com a cadeia em resumo.
 *
 * `listarWorkflows` já filtra "os globais mais os dele" — o que falta ali é a
 * cadeia, e esta tela precisa dela para mostrar "Pauta → Conteúdo → Arte →
 * Agendamento" com o cadeado nas que exigem aval. **O editor continua em
 * `/painel/gestao-tasks?aba=workflows`**, e esta lista leva para lá: dois editores do mesmo
 * fluxo divergiriam na primeira mudança, e a divergência apareceria no que a
 * demanda nasce fazendo.
 */
export type FluxoDaConta = {
  id: string;
  nome: string;
  /** Nulo no global, o id do cliente no específico. É o que o selo diz. */
  clientId: string | null;
  etapas: {
    nome: string;
    requerAprovacao: boolean;
    /** A função que a etapa pede, quando ela pede uma. */
    funcao: TeamFuncao | null;
    /** Verdadeiro quando a função existe e a conta não tem ninguém nela. */
    semDono: boolean;
  }[];
};

export async function fluxosDaConta(clienteId: string): Promise<FluxoDaConta[]> {
  const supabase = await criarClienteServidor();

  const tipos = ouFalha(
    "os fluxos da conta",
    await supabase
      .from("task_types")
      .select("id, nome, client_id, workflow_template_id")
      .eq("ativo", true)
      .or(`client_id.is.null,client_id.eq.${clienteId}`)
      .order("nome"),
  );

  if (tipos.length === 0) return [];

  const idsDeFluxos = [
    ...new Set(tipos.map((t) => t.workflow_template_id).filter(Boolean)),
  ] as string[];

  const [etapas, porFuncao] = await Promise.all([
    idsDeFluxos.length
      ? ouFalha(
          "as etapas dos fluxos da conta",
          await supabase
            .from("workflow_steps")
            .select("template_id, nome, ordem, requer_aprovacao, funcao_padrao, responsavel_padrao_id")
            .in("template_id", idsDeFluxos)
            .order("ordem"),
        )
      : [],
    equipePorFuncaoDaConta(clienteId),
  ]);

  const porFluxo = new Map<string, typeof etapas>();
  for (const etapa of etapas) {
    const lista = porFluxo.get(etapa.template_id) ?? [];
    lista.push(etapa);
    porFluxo.set(etapa.template_id, lista);
  }

  return tipos.map((tipo) => ({
    id: tipo.id,
    nome: tipo.nome,
    clientId: tipo.client_id,
    etapas: (tipo.workflow_template_id
      ? (porFluxo.get(tipo.workflow_template_id) ?? [])
      : []
    ).map((etapa) => ({
      nome: etapa.nome,
      requerAprovacao: etapa.requer_aprovacao,
      funcao: etapa.funcao_padrao,
      // A MESMA ORDEM DO `coalesce` DO BANCO, e é de propósito que ela apareça
      // aqui: a tela precisa dizer qual fluxo vai nascer com etapa órfã ANTES
      // de alguém aplicá-lo. Pessoa escrita na etapa manda, então uma etapa
      // com dono explícito nunca é "sem dono" por causa da função.
      semDono:
        etapa.responsavel_padrao_id === null &&
        etapa.funcao_padrao !== null &&
        !porFuncao.has(etapa.funcao_padrao),
    })),
  }));
}

/**
 * As recorrências desta conta, só para LER.
 *
 * A aba mostra o que a conta gera sozinha sem a pessoa sair da ficha do
 * cliente — e leva para `/painel/gestao-tasks?aba=recorrencias` para editar.
 * Reimplementar o editor aqui seria a mesma duplicação que a lista de fluxos
 * recusa: uma recorrência é a única coisa do produto que cria trabalho de
 * madrugada, e dois lugares de onde mexer nela é um a mais do que dá para
 * conferir.
 */
export type RecorrenciaDaConta = {
  id: string;
  nome: string;
  frequencia: string;
  ativo: boolean;
  proximaGeracaoEm: string | null;
};

export async function recorrenciasDaConta(
  clienteId: string,
): Promise<RecorrenciaDaConta[]> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "as recorrências da conta",
    await supabase
      .from("task_recurrences")
      .select("id, nome, frequencia, ativo, proxima_geracao_em")
      .eq("client_id", clienteId)
      .order("ativo", { ascending: false })
      .order("nome"),
  );

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    frequencia: l.frequencia,
    ativo: l.ativo,
    proximaGeracaoEm: l.proxima_geracao_em,
  }));
}

/** O tipo de uma etapa de workflow como as consultas daqui a devolvem. */
export type EtapaResumida = Pick<
  WorkflowStep,
  "nome" | "requer_aprovacao" | "funcao_padrao"
>;
