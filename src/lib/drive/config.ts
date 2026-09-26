import "server-only";

/**
 * As credenciais do Google Drive (Sprint 16, Parte C).
 *
 * ---------------------------------------------------------------------------
 * **É CONTA DE SERVIÇO NUM DRIVE COMPARTILHADO, e as duas metades importam.**
 *
 * A conta de serviço não é uma pessoa: ela não recebe e-mail, não sai da
 * agência e não tem "Meu Drive" próprio — o Google não dá cota de
 * armazenamento a ela. Num Drive Compartilhado isso deixa de ser problema,
 * porque o dono do espaço é a unidade e não quem criou: a pasta nasce lá
 * dentro já visível para todo mundo que tem acesso ao Drive, sem nenhuma
 * chamada de compartilhamento.
 *
 * O caminho contrário — conta pessoal e "Meu Drive" — funcionaria e tem um
 * custo que não aparece no dia um: a pasta ficaria pendurada na conta de uma
 * pessoa, e some com ela no dia em que sair da agência. Com dez clientes e
 * dois anos de material, isso é a agência inteira atrás de um acesso.
 * ---------------------------------------------------------------------------
 *
 * **A chave privada é lida aqui e em mais nenhum lugar**, e o arquivo é
 * `server-only` pela mesma razão de `lib/supabase/admin.ts`: `GOOGLE_*` não
 * tem prefixo `NEXT_PUBLIC_`, mas nem o nome pode aparecer num arquivo que o
 * navegador carrega.
 *
 * **Tudo lido de dentro das funções**, e não em `const` de topo: um `const`
 * congela o valor na primeira importação, e a checagem precisa medir a
 * configuração nos dois estados dentro de um processo só.
 */

/** O e-mail da conta de serviço (`...@...iam.gserviceaccount.com`). */
export function contaDeServico(): string {
  return (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "").trim();
}

/**
 * A chave privada PEM da conta de servico.
 *
 * O `.replace` não é gambiarra: o JSON que o Google entrega guarda a chave
 * com `\n` escapado, e é assim que ela sobrevive a uma variável de ambiente
 * de uma linha. Sem desfazer isso, o `crypto` recusa a chave com um erro
 * sobre PEM que não diz nada sobre a causa.
 */
export function chavePrivada(): string {
  return (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
}

/**
 * O id do Drive Compartilhado onde as pastas nascem.
 *
 * **Obrigatório, e de propósito.** Sem ele a API criaria a pasta no "Meu
 * Drive" da conta de serviço — que não tem cota, então o material iria para
 * um lugar que ninguém abre e que enche. É melhor não criar nada.
 */
export function driveCompartilhado(): string {
  return (process.env.GOOGLE_DRIVE_ID ?? "").trim();
}

/**
 * Uma pasta dentro do Drive Compartilhado, para pendurar tudo embaixo dela.
 *
 * Opcional: vazio quer dizer a raiz do Drive. Existe porque uma agência pode
 * usar o mesmo Drive para outras coisas, e "Clientes" ao lado de "Financeiro"
 * e "RH" é mais fácil de achar que trinta pastas de cliente na raiz.
 */
export function pastaRaiz(): string {
  return (process.env.GOOGLE_DRIVE_PASTA_RAIZ ?? "").trim() || driveCompartilhado();
}

/** Dá para falar com o Drive? */
export function driveConfigurado(): boolean {
  return (
    contaDeServico().length > 0 &&
    chavePrivada().length > 0 &&
    driveCompartilhado().length > 0
  );
}

/** O que falta, para a tela de status dizer qual das três. */
export function faltandoNoDrive(): string[] {
  const faltando: string[] = [];
  if (!contaDeServico()) faltando.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!chavePrivada()) faltando.push("GOOGLE_PRIVATE_KEY");
  if (!driveCompartilhado()) faltando.push("GOOGLE_DRIVE_ID");
  return faltando;
}

/**
 * O nome de pasta que o Drive aceita, e que a busca consegue procurar depois.
 *
 * ---------------------------------------------------------------------------
 * **A BARRA É O QUE IMPORTA AQUI.** No Drive, `/` dentro de um nome de pasta
 * é legal — e é o que faz "Feed/story site", que já existe como nome de
 * entregável na Wave, virar uma pasta cujo nome se lê como dois níveis que
 * não existem. Quem procura "story site" não acha, e quem baixa pelo cliente
 * de sincronização do Google leva um nome que o sistema de arquivos recusa.
 *
 * As aspas simples são a outra metade, e essa é de segurança: a busca do
 * Drive é uma linguagem de consulta com `name = 'x'`, e o nome vem de um
 * campo que a pessoa digita. O escape está em `escaparParaBusca()`, mas tirar
 * a aspa do nome já na criação é a trava de baixo — duas independentes, como
 * a RLS e a guarda de tela.
 * ---------------------------------------------------------------------------
 */
export function nomeDePasta(bruto: string): string {
  const limpo = bruto
    .replace(/[/\\]/g, "-")
    .replace(/['"]/g, "")
    // Caractere de controle vira espaço: ele não aparece na tela e deixa dois
    // nomes visualmente idênticos serem pastas diferentes.
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // O Drive aceita até 32.767 caracteres; o limite prático é a tela de quem
    // procura, e uma pasta com duzentos caracteres não cabe em lugar nenhum.
    .slice(0, 120)
    .trim();

  return limpo || "Sem nome";
}

/**
 * O escape da linguagem de consulta do Drive.
 *
 * `files.list` recebe um `q` como `name = 'Mundo Verde'`. Com o nome indo cru,
 * um cliente chamado `O'Brien` **quebra a consulta** — e é o caso benigno. O
 * maligno é um nome montado para fechar a aspa e acrescentar cláusula: a
 * consulta passa a procurar outra coisa, e a resposta do Drive é uma lista de
 * arquivos de outro lugar.
 *
 * Contrabarra primeiro, aspa depois. Na ordem inversa, o escape da aspa seria
 * escapado de novo e a aspa voltaria a fechar a string.
 */
export function escaparParaBusca(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
