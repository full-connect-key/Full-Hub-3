import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { NfStatus, TeamInvoice } from "@/lib/supabase/database.types";

/**
 * As notas fiscais da equipe (0065).
 *
 * ---------------------------------------------------------------------------
 * **NENHUMA CONSULTA AQUI FILTRA POR PESSOA, e é de propósito.**
 *
 * Quem separa "a minha nota" de "a nota do colega" é `team_invoices_select` no
 * banco: a própria pessoa ou o sócio. Repetir o filtro aqui criaria um segundo
 * lugar onde a regra pode divergir — e o lado que esquecesse seria o que
 * mostra a folha de pagamento da agência para quem não pode vê-la.
 *
 * É a mesma decisão de `lib/dados/portal.ts`, que não repete o filtro por
 * empresa. A consulta pede tudo; o Postgres devolve o que é de quem pergunta.
 * ---------------------------------------------------------------------------
 */

export type NotaDaEquipe = TeamInvoice & {
  pessoa: { id: string; nome: string; avatar_url: string | null } | null;
  /** O endereço assinado do arquivo, quando ele ainda existe no bucket. */
  arquivoAssinado: string | null;
};

const BUCKET = "notas-fiscais";

/**
 * Assina os arquivos de um lote de notas.
 *
 * Separado de `assinarArquivos` de `conteudo.ts` por causa do BUCKET: aquele é
 * dos materiais de campanha, e um endereço de nota fiscal assinado com o
 * bucket errado volta nulo sem dizer por quê. A duplicação é o nome do bucket,
 * não a lógica.
 */
async function assinarNotas(caminhos: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(caminhos.filter(Boolean))];
  if (unicos.length === 0) return {};

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unicos, 3600);

  // O ERRO NÃO PODE SUMIR, e também não pode estourar: uma assinatura que
  // falha deixa o link do PDF sem abrir, e o resto da linha — valor, mês,
  // situação — continua certo. Derrubar a tela por causa do anexo trocaria uma
  // falha parcial por uma total. É a mesma decisão de `assinarArquivos`.
  if (error) console.error("[storage:assinar notas]", error);

  const mapa: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
  }
  return mapa;
}

async function montar(linhas: TeamInvoice[]): Promise<NotaDaEquipe[]> {
  if (linhas.length === 0) return [];

  const supabase = await criarClienteServidor();
  const ids = [...new Set(linhas.map((l) => l.user_id))];

  const [pessoas, assinados] = await Promise.all([
    ouFalha(
      "as pessoas das notas fiscais",
      await supabase.from("profiles").select("id, nome, avatar_url").in("id", ids),
    ),
    assinarNotas(linhas.map((l) => l.arquivo_url)),
  ]);

  const porId = new Map((pessoas ?? []).map((p) => [p.id, p]));

  return linhas.map((linha) => ({
    ...linha,
    pessoa: porId.get(linha.user_id) ?? null,
    arquivoAssinado: assinados[linha.arquivo_url] ?? null,
  }));
}

/**
 * As notas de quem está pedindo.
 *
 * O `eq` no próprio id parece redundante com a policy, e não é: sem ele o
 * SÓCIO abriria "Minhas notas" e veria as de todo mundo — o RLS devolve o que
 * ele pode ler, que é tudo. A policy responde "o que é permitido"; esta linha
 * responde "o que esta tela pergunta".
 */
export async function minhasNotas(): Promise<NotaDaEquipe[]> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const linhas = ouFalha(
    "as minhas notas fiscais",
    await supabase
      .from("team_invoices")
      .select("*")
      .eq("user_id", user.id)
      .order("competencia", { ascending: false })
      .order("created_at", { ascending: false }),
  );

  return montar((linhas ?? []) as TeamInvoice[]);
}

/** Os meses em que esta pessoa já tem nota viva — o seletor não os oferece. */
export async function mesesJaEnviados(): Promise<string[]> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const linhas = ouFalha(
    "os meses ja enviados",
    await supabase
      .from("team_invoices")
      .select("competencia")
      .eq("user_id", user.id)
      .neq("status", "recusada"),
  );

  return (linhas ?? []).map((l) => l.competencia.slice(0, 7));
}

/**
 * A fila do sócio.
 *
 * **Sem `eq` de pessoa nenhuma**, ao contrário da de cima: aqui a pergunta é
 * "o que a agência deve". Quem não é sócio recebe lista vazia pelo RLS — e por
 * isso a rota confere o perfil antes, em vez de desenhar uma fila vazia que
 * afirma que não há nota nenhuma para pagar.
 */
export type FilaDeNotas = {
  aConferir: NotaDaEquipe[];
  aPagar: NotaDaEquipe[];
  encerradas: NotaDaEquipe[];
};

export async function filaDeNotas(): Promise<FilaDeNotas> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "a fila de notas fiscais",
    await supabase
      .from("team_invoices")
      .select("*")
      .order("competencia", { ascending: false })
      .order("created_at", { ascending: false }),
  );

  const todas = await montar((linhas ?? []) as TeamInvoice[]);
  const de = (...estados: NfStatus[]) => todas.filter((n) => estados.includes(n.status));

  return {
    aConferir: de("enviada"),
    aPagar: de("aprovada"),
    encerradas: de("paga", "recusada"),
  };
}

/**
 * Quantas notas esperam o sócio — para o bloco "Precisa de mim" da Home.
 *
 * Devolve zero para quem não é sócio, e é o RLS que garante: a contagem sai da
 * mesma consulta que a fila.
 */
export async function notasEsperandoOSocio(): Promise<number> {
  const supabase = await criarClienteServidor();
  const { count, error } = await supabase
    .from("team_invoices")
    .select("id", { count: "exact", head: true })
    .in("status", ["enviada", "aprovada"]);

  if (error) {
    console.error("[consulta:notas esperando o socio]", error);
    return 0;
  }
  return count ?? 0;
}

/** A minha nota recusada que ainda não foi reenviada — o quarto item da Home. */
export async function minhasNotasRecusadas(): Promise<NotaDaEquipe[]> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const linhas = ouFalha(
    "as minhas notas recusadas",
    await supabase
      .from("team_invoices")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "recusada")
      .order("competencia", { ascending: false }),
  );

  const recusadas = (linhas ?? []) as TeamInvoice[];
  if (recusadas.length === 0) return [];

  // UMA RECUSADA CUJO MÊS JÁ TEM NOTA NOVA NÃO É PENDÊNCIA. Sem esta conta, a
  // Home cobraria para sempre um mês que a pessoa já reenviou — e um aviso que
  // não sai depois de resolvido é o que ensina a ignorar o aviso.
  const vivas = new Set(await mesesJaEnviados());
  return montar(recusadas.filter((n) => !vivas.has(n.competencia.slice(0, 7))));
}
