/**
 * "Could not find the function … in the schema cache" quer dizer uma coisa só:
 * A MIGRATION NÃO RODOU.
 *
 * ---------------------------------------------------------------------------
 * **A mensagem do PostgREST é exata e inútil**, e isto aconteceu de verdade:
 * o Social Media respondeu
 *
 *   *Could not find the function public.abrir_mes_de_social(p_client_id,
 *   p_mes, p_prazos, p_quantidades, p_responsaveis, p_responsavel_id) in the
 *   schema cache. Perhaps you meant to call the function
 *   public.abrir_mes_de_social(p_client_id, p_mes, p_quantidades,
 *   p_responsaveis, p_responsavel_id)*
 *
 * — em inglês, com duas listas de parâmetros quase idênticas, e a única coisa
 * que a pessoa consegue tirar dali é que alguma coisa está errada. A causa é
 * que o código subiu e o `alter`/`create` correspondente nunca foi aplicado:
 * o banco tem a função antiga, a tela chama a nova.
 *
 * O `CLAUDE.md` já descrevia esta família pela variante de coluna — *"Could
 * not find the 'x' column of 'y' in the schema cache"* —, com a frase que
 * importa: **não é cache errado, é a migration que não rodou.** O que faltava
 * era a tela dizer isso para quem está do lado de fora do repositório.
 * ---------------------------------------------------------------------------
 *
 * **É tradução, não engolir.** A mensagem original vai inteira para o log do
 * servidor por `executarAcao()`, como toda outra; o que muda é a frase que a
 * pessoa lê. Um erro que some é pior que um erro ilegível.
 *
 * **E ela não adivinha QUAL migration falta**, de propósito. Dava para mapear
 * nome de função para número, e esse mapa envelheceria calado: a função que
 * uma migration cria outra reescreve, e a lista certa hoje é a errada em três
 * sprints. Quem responde isso é `scripts/onde-esta-o-banco.sql`, que é escrito
 * à mão e cuja cobertura o `check:migrations` confere a cada push.
 */

/**
 * Os dois códigos do PostgREST para "o schema não tem o que você pediu".
 * Vêm no corpo do erro e também aparecem na mensagem quando ela é repassada
 * como texto — e é como texto que ela chega em `falha()`.
 */
const SINAIS = [
  "could not find the function",
  "could not find the",
  "schema cache",
  "pgrst202",
  "pgrst204",
];

/** É um erro de schema desatualizado? */
export function ehMigrationPendente(mensagem: string): boolean {
  const m = mensagem.toLowerCase();
  // As DUAS metades: "não achei" e "no cache de schema". Só a segunda pegaria
  // qualquer menção a cache; só a primeira pegaria um "não encontrado"
  // qualquer, que é a metade das recusas do produto.
  return m.includes("schema cache") && SINAIS.some((s) => m.includes(s));
}

/**
 * A frase que a pessoa lê no lugar.
 *
 * Nomeia o que aconteceu, o que fazer e quem faz — nessa ordem. "Fale com
 * quem cuida do banco" sozinho manda a pessoa abrir um chamado sobre uma
 * coisa que ela não sabe descrever.
 */
export function explicarMigrationPendente(mensagem: string): string {
  return (
    "Esta tela está pedindo ao banco uma coisa que ele ainda não tem — o código " +
    "subiu e a migration correspondente não foi aplicada. Não é erro seu nem da " +
    "tela: alguém precisa rodar as migrations pendentes no Supabase (o " +
    "scripts/onde-esta-o-banco.sql diz qual falta). Detalhe técnico: " +
    mensagem
  );
}

/** Traduz se for o caso; devolve a original se não for. */
export function traduzirErroDoBanco(mensagem: string): string {
  return ehMigrationPendente(mensagem) ? explicarMigrationPendente(mensagem) : mensagem;
}
