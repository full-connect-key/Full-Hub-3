import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  Database,
  FeedbackPeriodicidade,
  FeedbackStatus,
} from "@/lib/supabase/database.types";

/**
 * O FEEDBACK DE DESENVOLVIMENTO (Sprint 3H, migration 0075).
 *
 * ---------------------------------------------------------------------------
 * **NENHUMA CONSULTA AQUI FILTRA POR PESSOA NEM POR STATUS, e é de propósito.**
 *
 * Quem separa "o meu feedback enviado" de "o rascunho que a gestão está
 * revisando" é `feedback_reports_select` no banco: `is_gestor()`, ou a própria
 * pessoa **e** `status = 'enviado'`. Repetir o filtro aqui criaria um segundo
 * lugar onde a regra pode divergir — e o lado que esquecesse seria o que mostra
 * a alguém um rascunho sobre ela mesma, que é o dano que o módulo inteiro foi
 * desenhado para não causar.
 *
 * É a decisão de `lib/dados/portal.ts` e de `lib/dados/notas-fiscais.ts`. A
 * consulta pede; o Postgres devolve o que é de quem pergunta.
 * ---------------------------------------------------------------------------
 */

type LinhaDoRelatorio = Database["public"]["Tables"]["feedback_reports"]["Row"];
type LinhaDaResposta = Database["public"]["Tables"]["feedback_replies"]["Row"];
type LinhaDoAlerta = Database["public"]["Tables"]["workload_alerts"]["Row"];
type LinhaDaConfig = Database["public"]["Tables"]["feedback_config"]["Row"];

export type Pessoa = { id: string; nome: string; avatar_url: string | null };

export type RelatorioDeFeedback = LinhaDoRelatorio & {
  pessoa: Pessoa | null;
  revisor: Pessoa | null;
};

export type RespostaDoFeedback = LinhaDaResposta & { autor: Pessoa | null };

export type AlertaDeCarga = LinhaDoAlerta & { pessoa: Pessoa | null };

export type ConfigDoFeedback = LinhaDaConfig & { revisor: Pessoa | null };

export type LinhaDaFila = {
  userId: string;
  nome: string;
  concluidas: number;
  jaTem: boolean;
  statusAtual: FeedbackStatus | null;
  relatorioId: string | null;
};

/**
 * As pessoas em `profiles`, por id.
 *
 * SEGUNDA CONSULTA e não um embutido, pela razão que o produto já pagou uma
 * vez: o PostgREST recusa o `select` INTEIRO quando não acha a relação pelo
 * nome escrito, e foi assim que uma campanha recém-criada não apareceu em lugar
 * nenhum. Duas idas ao banco custam menos que essa classe de bug.
 */
async function pessoasPorId(ids: (string | null)[]): Promise<Map<string, Pessoa>> {
  const unicos = [...new Set(ids.filter((i): i is string => !!i))];
  if (unicos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "as pessoas do feedback",
    await supabase.from("profiles").select("id, nome, avatar_url").in("id", unicos),
  );
  return new Map(linhas.map((p) => [p.id, p as Pessoa]));
}

const COLUNAS = "*";

/**
 * A fila da gestão para um período.
 *
 * A LISTA DE QUEM ENTRA VEM DA MESMA FUNÇÃO QUE A GERAÇÃO USA
 * (`quem_recebe_feedback`), pela razão de `quem_deve_nota()` no Financeiro: a
 * tela existe para escrever a frase que o banco vai confirmar, e duas contas
 * dariam um diálogo prometendo cinco pessoas e uma geração alcançando quatro.
 *
 * O `relatorioId` vem de uma segunda leitura porque a função devolve o status e
 * não o id — e a tela precisa do id para abrir. Poderia ir na função; sai
 * daqui porque a leitura dos relatórios do período já acontece para a lista, e
 * uma coluna a mais na função seria um segundo lugar dizendo a mesma coisa.
 */
export async function filaDoPeriodo(
  de: string,
  ate: string,
  periodicidade: FeedbackPeriodicidade,
): Promise<{ fila: LinhaDaFila[]; relatorios: RelatorioDeFeedback[] }> {
  const supabase = await criarClienteServidor();

  const [naFila, linhas] = await Promise.all([
    ouFalha(
      "a fila de feedback do período",
      await supabase.rpc("quem_recebe_feedback", {
        p_de: de,
        p_ate: ate,
        p_periodicidade: periodicidade,
      }),
    ),
    ouFalha(
      "os relatórios de feedback do período",
      await supabase
        .from("feedback_reports")
        .select(COLUNAS)
        .eq("periodo_inicio", de)
        .eq("periodicidade", periodicidade)
        .order("created_at", { ascending: true }),
    ),
  ]);

  const pessoas = await pessoasPorId([
    ...naFila.map((l) => l.user_id),
    ...linhas.map((l) => l.user_id),
    ...linhas.map((l) => l.revisado_por),
  ]);

  const porPessoa = new Map(linhas.map((l) => [l.user_id, l]));

  return {
    fila: naFila.map((l) => ({
      userId: l.user_id,
      nome: l.nome,
      concluidas: l.concluidas,
      jaTem: l.ja_tem,
      statusAtual: l.status_atual,
      relatorioId: porPessoa.get(l.user_id)?.id ?? null,
    })),
    relatorios: linhas.map((l) => ({
      ...l,
      pessoa: pessoas.get(l.user_id) ?? null,
      revisor: l.revisado_por ? pessoas.get(l.revisado_por) ?? null : null,
    })),
  };
}

/**
 * Um relatório com a conversa.
 *
 * Devolve `null` quando não há linha, e é a resposta certa em vez de um erro: a
 * RLS dizendo "isto não é seu" e o id inexistente chegam iguais, e a tela
 * responde 404 nos dois casos. `ouFalha()` vem ANTES dessa checagem — sem linha
 * é 404, erro de consulta é erro, e juntá-los faria "feedback não encontrado"
 * aparecer para um feedback que existe.
 */
export async function relatorioComConversa(id: string): Promise<{
  relatorio: RelatorioDeFeedback;
  respostas: RespostaDoFeedback[];
} | null> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "o relatório de feedback",
    await supabase.from("feedback_reports").select(COLUNAS).eq("id", id).limit(1),
  );
  const linha = linhas[0];
  if (!linha) return null;

  const respostas = ouFalha(
    "as respostas do feedback",
    await supabase
      .from("feedback_replies")
      .select("*")
      .eq("report_id", id)
      .order("created_at", { ascending: true }),
  );

  const pessoas = await pessoasPorId([
    linha.user_id,
    linha.revisado_por,
    ...respostas.map((r) => r.autor_id),
  ]);

  return {
    relatorio: {
      ...linha,
      pessoa: pessoas.get(linha.user_id) ?? null,
      revisor: linha.revisado_por ? pessoas.get(linha.revisado_por) ?? null : null,
    },
    respostas: respostas.map((r) => ({
      ...r,
      autor: pessoas.get(r.autor_id) ?? null,
    })),
  };
}

/**
 * Os feedbacks que chegaram a esta pessoa, do mais novo para o mais antigo.
 *
 * Sem filtro de status e sem filtro de pessoa: a policy devolve só os
 * `enviado` dela. Quem chama com sessão de gestão recebe os da agência inteira,
 * e é por isso que a tela da pessoa lê pelo próprio `auth.uid()` e não por um
 * parâmetro — um `user_id` na assinatura seria um convite a passar o de outra.
 */
export async function meusFeedbacks(): Promise<RelatorioDeFeedback[]> {
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getUser();
  const eu = sessao.user?.id;
  if (!eu) return [];

  const linhas = ouFalha(
    "os meus feedbacks",
    await supabase
      .from("feedback_reports")
      .select(COLUNAS)
      .eq("user_id", eu)
      .order("periodo_inicio", { ascending: false }),
  );

  const pessoas = await pessoasPorId([
    ...linhas.map((l) => l.user_id),
    ...linhas.map((l) => l.revisado_por),
  ]);

  return linhas.map((l) => ({
    ...l,
    pessoa: pessoas.get(l.user_id) ?? null,
    revisor: l.revisado_por ? pessoas.get(l.revisado_por) ?? null : null,
  }));
}

/**
 * O aviso da Home: chegou feedback novo, e a pessoa ainda não respondeu nada.
 *
 * **DEVOLVE `null` QUANDO A CONSULTA FALHA**, ao contrário do `ouFalha()` das
 * leituras que SÃO a tela. A Home funciona inteira sem este bloco, e derrubá-la
 * por causa de um aviso seria trocar uma falha parcial por uma total — a
 * decisão da faixa de novidades de Minhas Tasks. O erro vai para o log.
 */
export async function feedbackNovoParaMim(): Promise<{
  id: string;
  periodoInicio: string;
} | null> {
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getUser();
  const eu = sessao.user?.id;
  if (!eu) return null;

  const { data, error } = await supabase
    .from("feedback_reports")
    .select("id, periodo_inicio")
    .eq("user_id", eu)
    .order("periodo_inicio", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[consulta:feedback novo para mim]", error);
    return null;
  }
  const linha = data?.[0];
  if (!linha) return null;

  const { data: respostas, error: erroResp } = await supabase
    .from("feedback_replies")
    .select("id")
    .eq("report_id", linha.id)
    .eq("autor_id", eu)
    .limit(1);

  if (erroResp) {
    console.error("[consulta:respostas do feedback novo]", erroResp);
    return null;
  }
  // JÁ RESPONDEU É JÁ VIU, e o aviso sai. Um `visto_em` próprio daria dois
  // números sobre o mesmo fato, e ninguém saberia qual acreditar — a decisão
  // de "marcar como vistas É marcar como lidas" na faixa de Minhas Tasks.
  if ((respostas?.length ?? 0) > 0) return null;

  return { id: linha.id, periodoInicio: linha.periodo_inicio };
}

/** Os alertas de carga de um período. Só a gestão recebe linha — pelo RLS. */
export async function alertasDeCarga(
  de: string,
  incluirResolvidos = false,
): Promise<AlertaDeCarga[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("workload_alerts")
    .select("*")
    .eq("periodo_inicio", de)
    .order("tipo", { ascending: true });

  if (!incluirResolvidos) consulta = consulta.eq("resolvido", false);

  const linhas = ouFalha("os alertas de carga", await consulta);
  const pessoas = await pessoasPorId(linhas.map((l) => l.user_id));

  return linhas.map((l) => ({ ...l, pessoa: pessoas.get(l.user_id) ?? null }));
}

/**
 * Os alertas abertos para o Pulso da agência, de qualquer período.
 *
 * Devolve lista vazia quando a consulta falha, pela mesma razão do aviso da
 * Home: o Pulso é um bloco entre nove, e derrubar a tela inicial da gestão por
 * causa dele seria caro por nada.
 */
export async function alertasAbertos(): Promise<AlertaDeCarga[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("workload_alerts")
    .select("*")
    .eq("resolvido", false)
    .order("periodo_inicio", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[consulta:alertas de carga abertos]", error);
    return [];
  }

  const pessoas = await pessoasPorId((data ?? []).map((l) => l.user_id));
  return (data ?? []).map((l) => ({
    ...l,
    pessoa: pessoas.get(l.user_id) ?? null,
  }));
}

/** A configuração do módulo. A equipe inteira lê; só o sócio escreve. */
export async function configDoFeedback(): Promise<ConfigDoFeedback | null> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "a configuração do feedback",
    await supabase.from("feedback_config").select("*").limit(1),
  );
  const linha = linhas[0];
  if (!linha) return null;

  const pessoas = await pessoasPorId([linha.revisor_id]);
  return {
    ...linha,
    revisor: linha.revisor_id ? pessoas.get(linha.revisor_id) ?? null : null,
  };
}

/**
 * A escolha desta pessoa, para Meu Perfil e para a tela de transparência.
 *
 * `recebe` cai para `true` quando não há ficha na equipe, e a ausência é
 * deliberada: o default da coluna é `true`, e mostrar o interruptor desligado a
 * quem nunca o tocou diria que ela optou por algo que ela não escolheu.
 */
export async function minhaEscolhaDeFeedback(): Promise<{
  recebe: boolean;
  explicadoEm: string | null;
}> {
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getUser();
  const eu = sessao.user?.id;
  if (!eu) return { recebe: true, explicadoEm: null };

  const linhas = ouFalha(
    "a minha escolha de feedback",
    await supabase
      .from("team_members")
      .select("recebe_feedback_ia, feedback_explicado_em")
      .eq("user_id", eu)
      .limit(1),
  );
  const linha = linhas[0];
  return {
    recebe: linha?.recebe_feedback_ia ?? true,
    explicadoEm: linha?.feedback_explicado_em ?? null,
  };
}

/** Os números crus do período, para o diálogo de geração conferir antes. */
export async function metricasEContexto(
  userId: string,
  de: string,
  ate: string,
): Promise<{ metricas: unknown; contexto: unknown }> {
  const supabase = await criarClienteServidor();
  const [metricas, contexto] = await Promise.all([
    ouFalha(
      "as métricas do feedback",
      await supabase.rpc("feedback_metricas", {
        p_user_id: userId,
        p_de: de,
        p_ate: ate,
      }),
    ),
    ouFalha(
      "o contexto do feedback",
      await supabase.rpc("feedback_contexto", {
        p_user_id: userId,
        p_de: de,
        p_ate: ate,
      }),
    ),
  ]);
  return { metricas, contexto };
}

/** Quem pode ser o revisor: a gestão ativa. */
export async function gestoresAtivos(): Promise<Pessoa[]> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "os gestores ativos",
    await supabase
      .from("profiles")
      .select("id, nome, avatar_url, role, ativo")
      .in("role", ["desenvolvedor", "socio"])
      .eq("ativo", true)
      .order("nome", { ascending: true }),
  );
  return linhas.map((p) => ({
    id: p.id,
    nome: p.nome,
    avatar_url: p.avatar_url,
  }));
}
