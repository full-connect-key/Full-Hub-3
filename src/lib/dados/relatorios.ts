import "server-only";

import { assinarArquivos } from "@/lib/dados/conteudo";
import { ouFalha } from "@/lib/dados/consulta";
import {
  imagensDosBlocos,
  lerBlocos,
  type BlocoDoRelatorio,
} from "@/lib/dominio/relatorios";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Onde moram as imagens: o cliente lê pela primeira pasta, que é a conta. */
export const BUCKET_DO_RELATORIO = "posts-artes";

export type RelatorioNaLista = {
  id: string;
  clienteId: string;
  cliente: string;
  titulo: string;
  periodoInicio: string;
  periodoFim: string;
  publicadoEm: string | null;
};

export type RelatorioAberto = RelatorioNaLista & {
  subtitulo: string | null;
  blocos: BlocoDoRelatorio[];
  /** caminho no bucket → endereço assinado. */
  imagens: Record<string, string>;
};

const COLUNAS_DA_LISTA =
  "id, client_id, titulo, periodo_inicio, periodo_fim, publicado_em";

async function nomesDasContas(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await criarClienteServidor();
  const contas = ouFalha(
    "as contas dos relatórios",
    await supabase.from("clients").select("id, nome_empresa").in("id", ids),
  );
  return new Map(contas.map((c) => [c.id, c.nome_empresa]));
}

/**
 * Os relatórios que quem olha enxerga. Para o cliente, o RLS já devolve só os
 * publicados das empresas dele; `clienteId` estreita para uma conta.
 */
export async function listarRelatorios(
  clienteId?: string | null,
): Promise<RelatorioNaLista[]> {
  const supabase = await criarClienteServidor();
  let consulta = supabase
    .from("relatorios")
    .select(COLUNAS_DA_LISTA)
    .order("periodo_inicio", { ascending: false })
    .limit(200);
  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const linhas = ouFalha("os relatórios", await consulta);
  const nomes = await nomesDasContas([...new Set(linhas.map((l) => l.client_id))]);

  return linhas.map((l) => ({
    id: l.id,
    clienteId: l.client_id,
    cliente: nomes.get(l.client_id) ?? "",
    titulo: l.titulo,
    periodoInicio: l.periodo_inicio,
    periodoFim: l.periodo_fim,
    publicadoEm: l.publicado_em,
  }));
}

export async function obterRelatorio(
  id: string,
): Promise<RelatorioAberto | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "o relatório",
    await supabase.from("relatorios").select("*").eq("id", id).limit(1),
  );
  const l = linhas[0];
  if (!l) return null;

  const blocos = lerBlocos(l.blocos);
  const [nomes, imagens] = await Promise.all([
    nomesDasContas([l.client_id]),
    assinarArquivos(BUCKET_DO_RELATORIO, imagensDosBlocos(blocos)),
  ]);

  return {
    id: l.id,
    clienteId: l.client_id,
    cliente: nomes.get(l.client_id) ?? "",
    titulo: l.titulo,
    subtitulo: l.subtitulo,
    periodoInicio: l.periodo_inicio,
    periodoFim: l.periodo_fim,
    publicadoEm: l.publicado_em,
    blocos,
    imagens,
  };
}
