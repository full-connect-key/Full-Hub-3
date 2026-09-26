import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteAdmin, servicoConfigurado } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Data do último acesso de cada pessoa.
 *
 * Esse dado mora em auth.users, que só a chave de serviço alcança. Quando ela
 * não está configurada, devolvemos vazio em vez de quebrar a tela: a lista de
 * acessos continua útil sem essa coluna.
 */
export async function ultimosAcessos(
  ids: string[],
): Promise<Record<string, string | null>> {
  if (ids.length === 0 || !servicoConfigurado()) return {};

  try {
    const admin = criarClienteAdmin();
    const entradas = await Promise.all(
      ids.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id);
        return [id, data.user?.last_sign_in_at ?? null] as const;
      }),
    );
    return Object.fromEntries(entradas);
  } catch {
    return {};
  }
}

/**
 * Quem DA AGÊNCIA abriu o portal deste cliente.
 *
 * ---------------------------------------------------------------------------
 * **`client_portal_views` era gravada desde a 0009 e nada a lia.**
 *
 * A visualização administrativa (`/portal/{slug}`) grava uma linha a cada
 * abertura desde o Sprint 3C, e o CLAUDE.md registrava a ausência em uma
 * frase: *"nada lê essa tabela ainda"*. Um rastro que ninguém consulta não é
 * auditoria — é um `insert` que custa uma ida ao banco por visita e não
 * responde pergunta nenhuma.
 *
 * A pergunta que ele responde está na ficha do cliente, ao lado de quem tem
 * acesso e de quando cada um entrou: **quem daqui andou olhando o portal
 * dele**. Numa conversa em que o cliente diz "vocês viram o que eu comentei?",
 * é a linha que responde.
 * ---------------------------------------------------------------------------
 *
 * **Não entra em `/painel/auditoria`**, e a 0058 já dizia por quê: aquela
 * trilha é do sócio e cobre acesso, gente, dinheiro e decisão. Esta é
 * operacional e é da gestão, que é exatamente o que a policy de SELECT diz
 * desde a 0009 — `is_gestor()`. Juntar as duas obrigaria a abrir a trilha do
 * sócio para o desenvolvedor, que é a porta dos fundos do Financeiro.
 *
 * **Sem `.select()` de escrita e sem filtro repetido:** a policy é quem
 * decide, e quem não é gestão recebe lista vazia. Por isso a tela só desenha
 * o bloco para quem é — uma lista vazia por RLS é indistinguível de "ninguém
 * abriu", que é o modo de falha de sempre.
 */
export type VisitaAoPortal = {
  id: string;
  quem: string;
  quando: string;
};

export async function visitasAoPortal(
  clienteId: string,
  limite = 8,
): Promise<VisitaAoPortal[]> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "as visitas ao portal",
    await supabase
      .from("client_portal_views")
      .select("id, staff_user_id, iniciado_em")
      .eq("client_id", clienteId)
      .order("iniciado_em", { ascending: false })
      // O CORTE É AQUI E NÃO NA TELA: a tabela ganha uma linha por abertura, e
      // uma conta que a gestão confere toda semana acumula centenas em um ano.
      // Trazer tudo para mostrar oito é pagar a consulta inteira por nada.
      .limit(limite),
  );

  if (!linhas || linhas.length === 0) return [];

  const ids = [...new Set(linhas.map((l) => l.staff_user_id))];
  const { data: pessoas } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("id", ids);

  const nomes = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));

  return linhas.map((l) => ({
    id: l.id,
    // "Alguém da equipe" e não espaço em branco: a pessoa pode ter sido
    // desligada, e a linha continua sendo um fato sobre a conta.
    quem: nomes.get(l.staff_user_id) ?? "Alguém da equipe",
    quando: l.iniciado_em,
  }));
}
