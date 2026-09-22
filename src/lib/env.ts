/**
 * Leitura centralizada das variaveis de ambiente.
 *
 * Nada aqui lanca erro no momento do import: o projeto precisa compilar e
 * subir mesmo antes das credenciais existirem. O erro so aparece quando algo
 * realmente tenta falar com o Supabase -- e vem com instrucao do que fazer.
 *
 * Importante: `process.env.NEXT_PUBLIC_*` precisa ser escrito por extenso
 * (e nao via variavel) para o Next conseguir substituir o valor no bundle
 * que vai para o navegador.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// A chave de servico NAO mora aqui de proposito: este arquivo e importado
// por lib/supabase/client.ts, que roda no navegador. Mesmo que o Next nunca
// substitua o valor de uma variavel sem NEXT_PUBLIC_, o nome apareceria no
// bundle. Ela vive em lib/supabase/admin.ts, que tem `import "server-only"`.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** As credenciais publicas do Supabase estao preenchidas? */
export function supabaseConfigurado(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/** Lista das variaveis publicas que faltam, para mostrar na tela de status. */
export function variaveisFaltando(): string[] {
  const faltando: string[] = [];
  if (!SUPABASE_URL) faltando.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) faltando.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return faltando;
}

/** Usado pelos clientes Supabase antes de tentar qualquer conexao. */
export function exigirConfigSupabase(): { url: string; anonKey: string } {
  const faltando = variaveisFaltando();
  if (faltando.length > 0) {
    throw new Error(
      `Supabase não configurado. Faltando: ${faltando.join(", ")}. ` +
        "Copie .env.local.example para .env.local, preencha os valores do seu projeto " +
        "e rode `npm run check:supabase` para validar.",
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}
