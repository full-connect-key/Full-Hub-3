import "server-only";

import { assinarArquivos, enderecoDaArte } from "@/lib/dados/conteudo";
import { ouFalha } from "@/lib/dados/consulta";
import type { ArquivoDaMarca, PastaDaMarca } from "@/lib/dominio/biblioteca-de-marca";
import { criarClienteServidor } from "@/lib/supabase/server";

/** O bucket do acervo de marca (migration 0139). Privado, como todos. */
export const BUCKET_DA_MARCA = "biblioteca-arquivos";

/**
 * O ACERVO DE MARCA DE UMA CONTA — as pastas com os arquivos dentro.
 *
 * ---------------------------------------------------------------------------
 * **QUEM RECORTA É A POLICY, e esta consulta não repete a pergunta.**
 * `client_folders_select` e `client_files_select` são
 * `is_staff() or client_id in my_client_ids()` desde a 0139, então a MESMA
 * função serve o portal do cliente e a visualização administrativa — e o
 * cliente só alcança a conta dele sem uma linha a respeito aqui. Repetir o
 * filtro criaria o segundo lugar onde a regra pode divergir, e o que divergiria
 * é este, que a equipe quase não abre.
 *
 * **O `eq("client_id", …)` que existe é RECORTE e não trava:** ele é o que
 * permite à equipe abrir o acervo de UMA conta — sem ele, a visualização
 * administrativa traria o acervo de todas as empresas numa tela só.
 * ---------------------------------------------------------------------------
 * **SÃO DUAS IDAS AO BANCO E NÃO UM EMBUTIDO**, pela razão que a campanha
 * recém-criada já pagou: o PostgREST recusa o `select` INTEIRO quando não acha
 * a relação pelo nome escrito, e o nome do `fkey` de `client_files.folder_id`
 * não está escrito em lugar nenhum deste repositório — escrevê-lo seria
 * adivinhá-lo.
 *
 * **E UMA IDA SÓ AO STORAGE**, para o acervo inteiro: `assinarArquivos()`
 * recebe um array, e uma assinatura por arquivo seriam quarenta chamadas para
 * desenhar uma tela. Ela deixa passar o que começa com `http`, então o link do
 * Drive atravessa sem ser assinado — que é o par de `ehLinkDeFora()` do lado
 * do domínio.
 */
export async function acervoDeMarca(
  clienteId: string | null,
): Promise<PastaDaMarca[]> {
  if (!clienteId) return [];

  const supabase = await criarClienteServidor();

  const pastas = ouFalha(
    "pastas do acervo de marca",
    await supabase
      .from("client_folders")
      .select("id, pasta_pai_id, nome, ordem")
      .eq("client_id", clienteId)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true }),
  );

  if (pastas.length === 0) return [];

  const arquivos = ouFalha(
    "arquivos do acervo de marca",
    await supabase
      .from("client_files")
      .select("id, folder_id, nome, descricao, tamanho, url, ordem, created_at")
      .in(
        "folder_id",
        pastas.map((p) => p.id),
      )
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true }),
  );

  const assinadas = await assinarArquivos(
    BUCKET_DA_MARCA,
    arquivos.map((a) => a.url),
  );

  const porPasta = new Map<string, ArquivoDaMarca[]>();
  for (const a of arquivos) {
    const lista = porPasta.get(a.folder_id) ?? [];
    lista.push({
      id: a.id,
      nome: a.nome,
      descricao: a.descricao,
      tamanho: a.tamanho,
      url: a.url,
      href: enderecoDaArte(a.url, assinadas),
      criadoEm: a.created_at,
    });
    porPasta.set(a.folder_id, lista);
  }

  return pastas.map((p) => ({
    id: p.id,
    pastaPaiId: p.pasta_pai_id,
    nome: p.nome,
    ordem: p.ordem,
    arquivos: porPasta.get(p.id) ?? [],
  }));
}
