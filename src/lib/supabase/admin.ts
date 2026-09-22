import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_SERVICE_ROLE_KEY, exigirConfigSupabase } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente administrativo: ignora TODAS as regras de RLS.
 *
 * O import de "server-only" faz o build quebrar caso este arquivo seja
 * importado por engano em algum componente de navegador -- a chave nunca
 * pode sair do servidor.
 *
 * Use so para rotinas administrativas de verdade: criar usuario para um novo
 * membro da equipe, importacoes em massa, jobs agendados.
 */
export function criarClienteAdmin() {
  const { url } = exigirConfigSupabase();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY nao configurada. Pegue a chave em " +
        "Supabase > Project Settings > API Keys > service_role e coloque no .env.local. " +
        "Ela nunca deve ir para o navegador nem para o repositorio.",
    );
  }

  return createClient<Database>(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
