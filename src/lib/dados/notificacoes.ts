import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Notification } from "@/lib/supabase/database.types";

/**
 * As notificações de quem está logado.
 *
 * A RLS de `notifications` fecha em `user_id = auth.uid()` — esta camada não
 * repete a regra, confia no banco.
 *
 * Não existe policy de INSERT: quem cria aviso é a função `notificar()` no
 * Postgres, chamada de dentro das outras funções e ações. É por isso que não
 * há uma `criarNotificacao()` aqui.
 */

const QUANTAS = 20;

export type NotificacaoNaTela = Notification & {
  origem: { id: string; nome: string; avatar_url: string | null } | null;
};

export async function minhasNotificacoes(): Promise<{
  lista: NotificacaoNaTela[];
  naoLidas: number;
}> {
  const supabase = await criarClienteServidor();

  // Duas perguntas, e a segunda NÃO é `lista.filter(...)`: a lista é só as 20
  // mais recentes, e contar dentro dela diria "20" para quem tem 50 por ler.
  const [{ data: linhas }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(QUANTAS),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("lida_em", null),
  ]);

  const lista = linhas ?? [];
  if (lista.length === 0) return { lista: [], naoLidas: count ?? 0 };

  const idsDeOrigem = [...new Set(lista.map((n) => n.origem_id).filter(Boolean))] as string[];

  const { data: pessoas } = idsDeOrigem.length
    ? await supabase.from("profiles").select("id, nome, avatar_url").in("id", idsDeOrigem)
    : { data: [] as { id: string; nome: string; avatar_url: string | null }[] };

  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));

  return {
    lista: lista.map((n) => ({
      ...n,
      origem: n.origem_id ? (porPessoa.get(n.origem_id) ?? null) : null,
    })),
    naoLidas: count ?? 0,
  };
}
