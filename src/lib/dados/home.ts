import "server-only";

import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O resumo da tela inicial — um JSON, uma ida ao banco.
 *
 * **Uma chamada e não sete.** Os números da Home são contagens sobre cinco
 * tabelas, e sete `select` pelo PostgREST seriam sete idas à rede em série
 * para desenhar a primeira tela que todo mundo abre, todo dia. A conta inteira
 * mora em `home_summary()` (0049) e volta montada.
 *
 * **E NÃO EXISTE CACHE ENTRE REQUISIÇÕES, que é onde o sprint pedia
 * `unstable_cache` de 5 minutos.** O motivo é mecânico antes de ser de
 * produto: `home_summary()` não é `security definer` — ela pergunta
 * `auth.uid()` e o RLS decide o que cada `select` de dentro enxerga. Um cache
 * de servidor precisa de um cliente sem cookie para rodar dentro dele, e sem
 * cookie a função devolve `{}`; com o cookie, `cookies()` dentro de
 * `unstable_cache` estoura.
 *
 * Daria para contornar lendo o id da pessoa fora e usando a chave de serviço
 * dentro — e aí o cache passaria a guardar, sob uma chave montada à mão, um
 * resumo que depende de permissão. **Uma chave errada ali mostra os números da
 * agência inteira para um colaborador**, e o erro não aparece: os números
 * existem, só são de outra pessoa. Não vale os 5 minutos.
 *
 * O `cache()` do React fica: ele deduplica dentro da MESMA renderização, que é
 * o caso real de a Home pedir o resumo em dois blocos diferentes.
 */
export type ResumoDaHome = {
  meu_dia?: { atrasadas?: number; hoje?: number; semana?: number };
  precisa_de_mim?: {
    aprovacoes?: number;
    comentarios?: number;
    pedidos_rh?: number;
  };
  fora_hoje?: { nome: string; estado: string }[];
  /** Só para gestão — a função não devolve as duas para o resto. */
  pulso?: {
    /* `etapas_abertas` SAIU (0141): o cartão passou a mostrar as etapas de
       HOJE de quem olha, por `meu_dia.hoje`, e a contagem da agência inteira
       ficou sem leitor — então ela saiu da função também, pela 0023. Um campo
       declarado aqui que o banco não devolve é a deriva que `check:tipos`
       existe para pegar um andar abaixo. */
    atrasadas?: number;
    concluidas_semana?: number;
    posts_com_cliente?: number;
    campanhas_ativas?: number;
  };
  clientes_em_atencao?: {
    cliente: string;
    cliente_id: string;
    paradas: number;
    dias: number;
  }[];
};

export const resumoDaHome = cache(async (): Promise<ResumoDaHome> => {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("home_summary");

  if (error) {
    // A HOME NÃO CAI POR CAUSA DO RESUMO, e é a única leitura do produto que
    // pode falhar assim. Ela é a primeira tela de todo mundo: perder os
    // números é ruim, perder o acesso ao menu é pior. O erro vai para o log
    // do servidor, e os blocos somem — nenhum deles mostra zero, que seria
    // uma afirmação sobre a agência.
    console.error("[home] home_summary falhou:", error);
    return {};
  }

  return (data ?? {}) as ResumoDaHome;
});

/**
 * ONDE ESTÁ o comentário de cliente sem resposta mais antigo.
 *
 * ---------------------------------------------------------------------------
 * `home_summary()` CONTA os materiais cujo último comentário é do cliente, e a
 * linha do Início levava sempre a `/painel/social-media` — o índice de meses.
 * O comentário pode estar numa peça de campanha, e mesmo num post o índice não
 * é o post. Esta é a mesma pergunta daquela conta, devolvendo o ENDEREÇO.
 *
 * **O MAIS ANTIGO, e não o primeiro que houver:** é quem espera há mais tempo,
 * que é a ordem da caixa de entrada das solicitações.
 *
 * **ELA NÃO DERRUBA O INÍCIO:** a tela funciona inteira sem este endereço — a
 * linha cai no módulo, como antes. O erro vai para o log.
 * ---------------------------------------------------------------------------
 */
export async function comentarioSemResposta(): Promise<string | null> {
  const supabase = await criarClienteServidor();

  const { data: linhas, error } = await supabase
    .from("comments")
    .select("content_type, content_id, autor_id, created_at")
    .eq("interno", false)
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    console.error("[consulta:o comentário de cliente sem resposta]", error);
    return null;
  }
  if (!linhas || linhas.length === 0) return null;

  // A lista vem do mais novo para o mais antigo, então a primeira linha de
  // cada material é o ÚLTIMO comentário dele.
  const ultimo = new Map<string, (typeof linhas)[number]>();
  for (const l of linhas) {
    const chave = `${l.content_type}:${l.content_id}`;
    if (!ultimo.has(chave)) ultimo.set(chave, l);
  }

  const { data: autores } = await supabase
    .from("profiles")
    .select("id, role")
    .in("id", [...new Set([...ultimo.values()].map((l) => l.autor_id))]);
  const papel = new Map((autores ?? []).map((a) => [a.id, a.role]));

  const esperando = [...ultimo.values()]
    .filter((l) => papel.get(l.autor_id) === "cliente")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const alvo = esperando[0];
  if (!alvo) return null;

  if (alvo.content_type === "post") {
    return `/painel/social-media?post=${alvo.content_id}`;
  }

  if (alvo.content_type === "deliverable") {
    const { data: pecas } = await supabase
      .from("deliverables")
      .select("campaign_id")
      .eq("id", alvo.content_id)
      .limit(1);
    const campanha = pecas?.[0]?.campaign_id;
    return campanha
      ? `/painel/aprovacoes/campanhas/${campanha}?peca=${alvo.content_id}`
      : null;
  }

  return null;
}
