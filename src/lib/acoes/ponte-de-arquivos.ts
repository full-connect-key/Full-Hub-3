import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

/**
 * O ARQUIVO DA ETAPA E O ARQUIVO DA PEÇA SÃO O MESMO, nos dois sentidos.
 *
 * Decisão do usuário: *"quero unificar isso, quando sobe o arquivo na task,
 * vai automaticamente pra campanha"* — e o caminho inverso também. **Vale só
 * para ARQUIVO, nunca para link.**
 *
 * A peça de campanha é uma etapa da demanda desde a 0051, e havia dois lugares
 * para subir o mesmo PDF: "Arquivos da entrega" na etapa e "Subir os arquivos"
 * na campanha. Quem subia num só deixava o outro vazio — e o que o cliente
 * decide é a VERSÃO da peça, que só o segundo gravava.
 *
 * **É CÓPIA DE OBJETO, e não um ponteiro**, por causa da leitura do cliente:
 * cada bucket tem a policy dele (`campanhas-arquivos` pela pasta da empresa,
 * `task-arquivos` pela etapa), e um caminho de um bucket assinado no outro é
 * recusado.
 *
 * **AS DUAS AVISAM EM VEZ DE RECUSAR** (a decisão da 0052): quando a ponte
 * falha, o arquivo já está gravado no lado em que a pessoa subiu — o que resta
 * é dizer que o outro lado não recebeu.
 *
 * *O que ela não faz:* remover num lado não remove no outro.
 */

type Cliente = SupabaseClient<Database>;

const DA_TASK = "task-arquivos";
const DA_CAMPANHA = "campanhas-arquivos";

function extensao(nome: string) {
  const partes = nome.split(".");
  return partes.length > 1 ? partes.pop()! : "bin";
}

/**
 * Da ETAPA para a PEÇA: o arquivo vira uma versão da peça.
 *
 * **A versão nova carrega os arquivos da atual enquanto a atual não foi a
 * análise** — três arquivos anexados na etapa são uma entrega, e não três
 * versões de um arquivo cada. Depois de a versão ter rodada, o arquivo novo
 * começa uma versão limpa: aí ele é a correção.
 *
 * Devolve `null` quando não havia peça ou quando deu certo; a frase, quando
 * a peça existe e não recebeu.
 */
export async function levarParaACampanha(
  supabase: Cliente,
  subtaskId: string,
  arquivo: { url: string; nome: string | null },
  usuarioId: string,
): Promise<string | null> {
  const { data: pecas } = await supabase
    .from("deliverables")
    .select("id, campaign_id, versao_atual")
    .eq("subtask_id", subtaskId)
    .limit(1);
  const peca = pecas?.[0];
  if (!peca) return null;

  const { data: campanhas } = await supabase
    .from("campaigns")
    .select("client_id")
    .eq("id", peca.campaign_id)
    .limit(1);
  const clienteId = campanhas?.[0]?.client_id;
  if (!clienteId) return "A peça da campanha não recebeu o arquivo: a campanha não foi encontrada.";

  const nome = arquivo.nome ?? arquivo.url.split("/").pop() ?? "arquivo";
  const destino = `${clienteId}/entregaveis/${peca.id}-${Date.now()}.${extensao(nome)}`;

  const copia = await supabase.storage
    .from(DA_TASK)
    .copy(arquivo.url, destino, { destinationBucket: DA_CAMPANHA });
  if (copia.error) {
    console.error("[ponte:task→campanha]", copia.error);
    return `A peça da campanha não recebeu o arquivo: ${copia.error.message}`;
  }

  let anteriores: { url: string; nome: string }[] = [];
  if (peca.versao_atual > 0) {
    const [{ data: rodadas }, { data: versoes }] = await Promise.all([
      supabase
        .from("approval_rounds")
        .select("id")
        .eq("content_type", "deliverable")
        .eq("content_id", peca.id)
        .eq("numero_rodada", peca.versao_atual)
        .limit(1),
      supabase
        .from("deliverable_versions")
        .select("arquivos")
        .eq("deliverable_id", peca.id)
        .eq("numero_versao", peca.versao_atual)
        .limit(1),
    ]);
    if ((rodadas ?? []).length === 0 && Array.isArray(versoes?.[0]?.arquivos)) {
      anteriores = versoes[0].arquivos as { url: string; nome: string }[];
    }
  }

  const { data, error } = await supabase
    .from("deliverable_versions")
    .insert({
      deliverable_id: peca.id,
      arquivos: [...anteriores, { url: destino, nome }] as unknown as Json,
      notas_mudanca: null,
      criado_por: usuarioId,
    })
    .select("id");

  if (error || !data || data.length === 0) {
    console.error("[ponte:task→campanha] versão", error);
    return `A peça da campanha não recebeu o arquivo: ${error?.message ?? "o banco recusou a versão"}.`;
  }
  return null;
}

/**
 * Da PEÇA para a ETAPA: cada arquivo da versão vira um anexo de entrega.
 *
 * Recebe só os arquivos que ACABARAM de subir — a tela da campanha manda os
 * novos, então não há o que deduplicar.
 */
export async function levarParaAEtapa(
  supabase: Cliente,
  entregavelId: string,
  arquivos: { url: string; nome: string }[],
  usuarioId: string,
): Promise<{ taskId: string | null; aviso: string | null }> {
  const { data: pecas } = await supabase
    .from("deliverables")
    .select("subtask_id")
    .eq("id", entregavelId)
    .limit(1);
  const subtaskId = pecas?.[0]?.subtask_id;
  if (!subtaskId) return { taskId: null, aviso: null };

  const { data: etapas } = await supabase
    .from("subtasks")
    .select("task_id")
    .eq("id", subtaskId)
    .limit(1);
  const taskId = etapas?.[0]?.task_id ?? null;

  let falhas = 0;
  for (const [i, arquivo] of arquivos.entries()) {
    // Link de fora não é arquivo do bucket: a ponte é só de arquivo.
    if (/^https?:\/\//.test(arquivo.url)) continue;

    const destino = `entregas/${subtaskId}/${Date.now()}-${i}-${arquivo.nome}`;
    const copia = await supabase.storage
      .from(DA_CAMPANHA)
      .copy(arquivo.url, destino, { destinationBucket: DA_TASK });
    if (copia.error) {
      console.error("[ponte:campanha→task]", copia.error);
      falhas += 1;
      continue;
    }

    const { data, error } = await supabase
      .from("subtask_entregas")
      .insert({
        subtask_id: subtaskId,
        tipo: "arquivo",
        url: destino,
        nome: arquivo.nome,
        enviado_por: usuarioId,
      })
      .select("id");
    if (error || !data || data.length === 0) {
      console.error("[ponte:campanha→task] entrega", error);
      falhas += 1;
    }
  }

  return {
    taskId,
    aviso:
      falhas > 0
        ? `${falhas === 1 ? "Um arquivo não chegou" : `${falhas} arquivos não chegaram`} à etapa da demanda.`
        : null,
  };
}
