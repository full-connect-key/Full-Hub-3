import "server-only";

import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/env";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Data do último acesso de cada pessoa.
 *
 * Esse dado mora em auth.users, que só a chave de serviço alcança. Quando ela
 * não está configurada, devolvemos vazio em vez de quebrar a tela: a lista de
 * acessos continua útil sem essa coluna.
 */
export async function ultimosAcessos(ids: string[]): Promise<Record<string, string | null>> {
  if (ids.length === 0 || !SUPABASE_SERVICE_ROLE_KEY) return {};

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
