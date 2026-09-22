import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { exigirConfigSupabase } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 *
 * Precisa ser criado a cada requisicao (nunca guardado em variavel global),
 * porque carrega os cookies de sessao daquele usuario especifico.
 */
export async function criarClienteServidor() {
  // Ler os cookies primeiro nao e detalhe de estilo: e o que marca a rota como
  // dinamica. Se a configuracao fosse checada antes, uma pagina privada tentaria
  // ser gerada no build e quebraria a compilacao em vez de so pedir login.
  const armazemDeCookies = await cookies();
  const { url, anonKey } = exigirConfigSupabase();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return armazemDeCookies.getAll();
      },
      setAll(cookiesParaGravar) {
        try {
          for (const { name, value, options } of cookiesParaGravar) {
            armazemDeCookies.set(name, value, options);
          }
        } catch {
          // Server Components nao podem gravar cookies. Tudo bem ignorar:
          // quem renova a sessao e o proxy (src/proxy.ts), que roda antes.
        }
      },
    },
  });
}
