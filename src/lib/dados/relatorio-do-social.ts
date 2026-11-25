import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { competenciaDoMes, mesAnterior } from "@/lib/dominio/relatorio-do-social";
import type {
  NumeroDoRelatorio,
  RelatorioDoSocial,
} from "@/lib/dominio/relatorio-do-social";
import { PLATAFORMAS } from "@/lib/dominio/posts";
import type { PlataformaSocial } from "@/lib/supabase/database.types";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O relatório de desempenho do social (migration 0150).
 *
 * ---------------------------------------------------------------------------
 * **NÃO É `security definer`, e é a linha que mais importa.**
 * `social_reports_select` é `is_staff() or (<a conta é do cliente> and
 * publicado_em is not null)` — a RLS **já permite**, então uma função de banco
 * com `definer` não destravaria nada e entregaria o relatório de qualquer
 * conta a quem tiver a chave anon. É a forma de `busca_global()` (0073) e do
 * leitor do escopo (0149): a policy vale dentro da consulta, e a MESMA função
 * serve a tela da social media e o portal.
 *
 * **E É ELA QUE FAZ O FILTRO DO RASCUNHO NÃO SER REPETIDO AQUI.** A tela do
 * portal não pergunta `publicado_em`: quem responde é o Postgres, e um
 * segundo filtro em TypeScript seria o segundo lugar onde a regra pode
 * divergir — e o que divergiria é este, porque ninguém o relê.
 * ---------------------------------------------------------------------------
 */

/** O relatório de UM mês de UMA conta, com os números dele. */
export type RelatorioComNumeros = {
  relatorio: RelatorioDoSocial | null;
  numeros: NumeroDoRelatorio[];
  /** Os números do mês anterior PUBLICADO, para a comparação. */
  anteriores: NumeroDoRelatorio[];
};

/**
 * O relatório de UM MÊS de N CONTAS, com os números e o mês anterior.
 *
 * ---------------------------------------------------------------------------
 * **ELA RECEBE N IDS porque o PORTAL recebe N contas**, e é uma leitura só
 * para as duas telas: quem responde por duas empresas abre o mês de social e vê
 * as peças das duas misturadas desde a 0091 — uma chamada por conta seriam
 * quatro idas ao banco por empresa, e duas implementações da pergunta *"em que
 * pé está o relatório deste mês"* divergiriam no mês ANTERIOR, que é a metade
 * que decide o selo de ganho.
 *
 * **SÃO QUATRO IDAS E NÃO UM EMBUTIDO**, pela razão escrita no leitor do
 * escopo: o PostgREST recusa o `select` INTEIRO quando não acha a relação pelo
 * nome escrito, e foi assim que uma campanha recém-criada não apareceu em lugar
 * nenhum. Quatro consultas custam menos que essa classe de bug — e são quatro
 * **qualquer que seja o número de contas**, porque cada uma é um `in (…)`.
 *
 * **E A TERCEIRA SÓ ACONTECE QUANDO ALGUM MÊS TEM NÚMERO, que é o item 18:**
 * num mês vazio não há o que comparar, e a consulta montaria uma comparação que
 * nenhuma linha usaria.
 * ---------------------------------------------------------------------------
 */
export async function relatoriosDoMes(
  clienteIds: string[],
  mes: string,
): Promise<Map<string, RelatorioComNumeros>> {
  const limpos = [...new Set(clienteIds.filter(Boolean))];
  const mapa = new Map<string, RelatorioComNumeros>();
  if (limpos.length === 0) return mapa;

  const supabase = await criarClienteServidor();

  const relatorios: RelatorioDoSocial[] = ouFalha(
    "o relatório do social",
    await supabase
      .from("social_reports")
      .select("*")
      .in("client_id", limpos)
      .eq("competencia", competenciaDoMes(mes)),
  );
  if (relatorios.length === 0) return mapa;

  const numeros: NumeroDoRelatorio[] = ouFalha(
    "os números do relatório do social",
    await supabase
      .from("social_report_metrics")
      .select("*")
      .in(
        "report_id",
        relatorios.map((r) => r.id),
      ),
  );

  // O MÊS ANTERIOR SÓ É LIDO PARA QUEM TEM NÚMERO NESTE, e não para toda conta
  // da lista: a comparação é desenhada ao lado de um número, então uma conta
  // cujo mês está em branco não tem onde pôr o ganho.
  const comNumero = new Set(numeros.map((n) => n.report_id));
  const contasComNumero = relatorios
    .filter((r) => comNumero.has(r.id))
    .map((r) => r.client_id);

  const anteriores =
    contasComNumero.length > 0
      ? await numerosDoMesAnterior(supabase, contasComNumero, mes)
      : new Map<string, NumeroDoRelatorio[]>();

  for (const relatorio of relatorios) {
    mapa.set(relatorio.client_id, {
      relatorio,
      numeros: numeros.filter((n) => n.report_id === relatorio.id),
      anteriores: anteriores.get(relatorio.client_id) ?? [],
    });
  }
  return mapa;
}

/**
 * O relatório de UMA conta, que é o que a tela da social media abre.
 *
 * **Ela é um recorte de `relatoriosDoMes()` e não uma segunda consulta**, pela
 * razão de `carga_do_dia()` ser um recorte de `disponibilidade()`: a pergunta é
 * a mesma, e duas respostas divergiriam — o que divergiria é esta, porque o
 * portal é a tela que a equipe nunca abre.
 */
export async function relatorioDoMes(
  clienteId: string,
  mes: string,
): Promise<RelatorioComNumeros> {
  const mapa = await relatoriosDoMes([clienteId], mes);
  return (
    mapa.get(clienteId) ?? { relatorio: null, numeros: [], anteriores: [] }
  );
}

/**
 * Os números do mês anterior de cada conta, e **só se ele foi PUBLICADO**.
 *
 * **Comparar com um rascunho daria um selo que muda sozinho**: a social media
 * está digitando aqueles números agora, e o ganho de novembro contra um
 * outubro pela metade afirmaria um crescimento que não aconteceu. É a mesma
 * pergunta que a policy do cliente faz, aqui pelo lado da agência.
 */
async function numerosDoMesAnterior(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  clienteIds: string[],
  mes: string,
): Promise<Map<string, NumeroDoRelatorio[]>> {
  const porConta = new Map<string, NumeroDoRelatorio[]>();

  const antes: RelatorioDoSocial[] = ouFalha(
    "o relatório do mês anterior",
    await supabase
      .from("social_reports")
      .select("*")
      .in("client_id", clienteIds)
      .eq("competencia", competenciaDoMes(mesAnterior(mes)))
      .not("publicado_em", "is", null),
  );
  if (antes.length === 0) return porConta;

  const numeros: NumeroDoRelatorio[] = ouFalha(
    "os números do mês anterior do social",
    await supabase
      .from("social_report_metrics")
      .select("*")
      .in(
        "report_id",
        antes.map((r) => r.id),
      ),
  );

  for (const r of antes) {
    porConta.set(
      r.client_id,
      numeros.filter((n) => n.report_id === r.id),
    );
  }
  return porConta;
}

/**
 * Em que pé está o relatório de cada mês de uma conta.
 *
 * **O ÍNDICE DO SOCIAL JÁ DESENHA A FAIXA DE MESES**, e é nela que o selo
 * mora: quem abre o módulo precisa ver de relance qual mês ainda não tem
 * relatório publicado. Uma consulta por mês seriam doze idas ao banco para
 * desenhar doze selos.
 */
export async function estadoDosRelatorios(
  clienteIds: string[],
): Promise<Map<string, RelatorioDoSocial>> {
  const limpos = [...new Set(clienteIds.filter(Boolean))];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const linhas: RelatorioDoSocial[] = ouFalha(
    "os relatórios do social",
    await supabase
      .from("social_reports")
      .select("*")
      .in("client_id", limpos)
      .order("competencia", { ascending: false }),
  );

  // A CHAVE É `cliente|mes`, que é o `unique (client_id, competencia)` da
  // 0150 escrito do lado de cá: uma conta tem no máximo um relatório por mês,
  // e é isso que faz o mapa poder ser lido direto pela faixa de meses.
  const mapa = new Map<string, RelatorioDoSocial>();
  for (const l of linhas) {
    mapa.set(`${l.client_id}|${l.competencia.slice(0, 7)}`, l);
  }
  return mapa;
}

/**
 * As redes em que a conta publicou naquele mês.
 *
 * ---------------------------------------------------------------------------
 * **O FORMULÁRIO SÃO 7 REDES × 10 MÉTRICAS, e setenta campos em branco não
 * são um formulário.** Quem preenche abre o Insights de UMA rede — às vezes
 * duas — e digita os números dela. Então a tela começa pelas redes que o mês
 * TEM, e oferece as outras num chip: o que a conta usa é um fato que o próprio
 * mês já carrega, e perguntá-lo seria pedir uma resposta que o banco sabe.
 *
 * **O RECORTE É A DEMANDA DO MÊS e nunca `data_publicacao`**, que é a regra do
 * Sprint 3K e o que a varredura de `check:cores` cobra fora dos dois arquivos
 * salvos: desde a 0044 o mês abre com todo post sem data, então um filtro por
 * data deixaria de fora exatamente o mês que está sendo produzido — e o
 * relatório é preenchido no fim dele, quando metade das peças pode ainda não
 * ter dia marcado.
 *
 * **E ELA DEVOLVE A ORDEM DE `PLATAFORMAS`, nunca a ordem em que os posts
 * apareceram**: duas visitas à mesma tela mostrariam as seções em ordens
 * diferentes conforme a consulta, que é a razão pela qual o seletor de redes
 * do social ordena pelo enum e não pelo clique.
 * ---------------------------------------------------------------------------
 */
export async function redesDoMes(
  clienteId: string,
  mes: string,
): Promise<PlataformaSocial[]> {
  const supabase = await criarClienteServidor();

  const demanda: { id: string }[] = ouFalha(
    "a demanda do mês de social",
    await supabase
      .from("tasks")
      .select("id")
      .eq("client_id", clienteId)
      .eq("social_do_mes", `${mes}-01`)
      .limit(1),
  );
  if (demanda.length === 0) return [];

  const linhas: { plataformas: PlataformaSocial[] }[] = ouFalha(
    "as redes do mês de social",
    await supabase
      .from("posts")
      .select("plataformas")
      .eq("social_task_id", demanda[0].id),
  );

  const usadas = new Set(linhas.flatMap((l) => l.plataformas ?? []));
  return PLATAFORMAS.filter((p) => usadas.has(p));
}
