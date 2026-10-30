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

/**
 * O HOST DIRETO DO STORAGE, para o upload resumível.
 *
 * ---------------------------------------------------------------------------
 * A documentação do Supabase é explícita: *"for optimal performance when
 * uploading large files you should always use the direct storage hostname"* —
 * `projeto.storage.supabase.co` em vez de `projeto.supabase.co`. E aqui isso
 * não é otimização de margem: o item 30 abriu o upload para vídeo, e um corte
 * de três minutos em 4K passa de 400 MB.
 *
 * **É DERIVADO, como o `supabaseWs` do CSP** (que troca `https:` por `wss:`
 * no mesmo valor), e pela mesma razão: uma segunda variável de ambiente é mais
 * um jeito de a hospedagem seguinte nascer errada sem nada na tela dizendo.
 *
 * **E ELE CAI PARA O HOST NORMAL quando a URL não é `*.supabase.co`** — um
 * domínio próprio ou um Supabase auto-hospedado não tem esse host, e inventá-lo
 * mandaria o upload para um endereço que não existe. O host normal serve o
 * mesmo endpoint; o que se perde é a otimização.
 *
 * **A OUTRA PONTA É O `connect-src` do CSP**, em `next.config.ts`, que carrega
 * os DOIS hosts justamente porque esta função tem dois ramos. Sem a origem
 * certa na lista, o upload é recusado pelo navegador e a única pista é uma
 * linha no console — o furo que o `frame-src` da 0102 já pagou uma vez.
 * ---------------------------------------------------------------------------
 */
export const SUPABASE_STORAGE_URL = SUPABASE_URL.replace(
  /^https:\/\/([^./]+)\.supabase\.co\/?$/,
  "https://$1.storage.supabase.co",
);

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
