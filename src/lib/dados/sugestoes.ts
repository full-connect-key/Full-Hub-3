import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";

export type SugestaoNaTela = {
  id: string;
  texto: string;
  autor: string;
  criadaEm: string;
  vista: boolean;
};

/**
 * As sugestões que a GESTÃO lê — as cinquenta mais novas.
 *
 * Quem recorta é a policy (`autor_id = auth.uid() or is_gestor()`): chamada por
 * quem não é gestão, ela devolveria só as da própria pessoa. O layout só a
 * chama para a gestão, que é quem tem o que ler.
 */
export async function sugestoesParaLer(): Promise<SugestaoNaTela[]> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "as sugestões para o hub",
    await supabase
      .from("sugestoes")
      .select("id, texto, autor_id, vista_em, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  );

  const ids = [...new Set(linhas.map((l) => l.autor_id))];
  const pessoas =
    ids.length === 0
      ? []
      : ouFalha(
          "quem escreveu as sugestões",
          await supabase.from("profiles").select("id, nome").in("id", ids),
        );
  const nomes = new Map(pessoas.map((p) => [p.id, p.nome]));

  return linhas.map((l) => ({
    id: l.id,
    texto: l.texto,
    autor: nomes.get(l.autor_id) ?? "Alguém da equipe",
    criadaEm: l.created_at,
    vista: l.vista_em !== null,
  }));
}
