import "server-only";

import { criarClienteAdmin, servicoConfigurado } from "@/lib/supabase/admin";

/**
 * Para quem o e-mail vai (Sprint 16, Parte B).
 *
 * ---------------------------------------------------------------------------
 * **AQUI A CHAVE DE SERVIÇO NÃO É ATALHO, É A ÚNICA PORTA.**
 *
 * `client_notification_prefs` fecha em `user_id = auth.uid()` nas quatro
 * operações desde a 0031 — **nem o sócio lê**. Foi decisão, e continua de pé:
 * preferência de aviso que outra pessoa edita não é preferência.
 *
 * Só que quem precisa da preferência é justamente quem não é a pessoa: o
 * despachante, no instante em que a agência envia material. Com o cliente do
 * usuário logado, a consulta volta vazia e o produto lê isso como "ninguém
 * quer receber" — o pior resultado possível, porque **lista vazia é
 * indistinguível da verdade** e ninguém abre um chamado dizendo que não
 * recebeu um e-mail que não sabe que existe.
 *
 * As saídas eram três, e duas são piores:
 *
 * - **Afrouxar a policy** para a gestão ler: desfaz a promessa da 0031 para
 *   resolver um problema de máquina.
 * - **Uma função `security definer`** que devolvesse só o agregado, como
 *   `usuarios_do_meu_cliente()` faz com o registro de acesso: seria a forma
 *   certa se quem perguntasse estivesse logado. Aqui não há sessão nenhuma —
 *   o envio acontece depois da resposta, dentro de `after()`.
 * - **A chave de serviço**, que é o que sobra, e é honesta pelo mesmo motivo
 *   que o limite de tentativas usa a mesma chave: a pergunta é do servidor, e
 *   o servidor não tem `auth.uid()`.
 *
 * O que fica gravado é o limite: **este arquivo lê a preferência e mais nada
 * dela**. Ele não devolve a linha, não a mostra em tela nenhuma e não a
 * escreve — devolve endereços.
 * ---------------------------------------------------------------------------
 *
 * **Quem nunca mexeu recebe o padrão**, e não fica de fora. A 0031 decidiu que
 * a linha nasce quando a pessoa mexe, e que criá-la na leitura seria escrever
 * por causa de um olhar; a consequência aqui é que a ausência de linha quer
 * dizer "os três ligados, na hora" — que é o default das colunas.
 */

/** As três caixas do portal. `frequencia` é tratada à parte. */
export type AvisoDoCliente = "novo_conteudo" | "novo_comentario" | "lembrete_pendencias";

type Preferencia = {
  novo_conteudo: boolean;
  novo_comentario: boolean;
  lembrete_pendencias: boolean;
  frequencia: string;
};

const PADRAO: Preferencia = {
  novo_conteudo: true,
  novo_comentario: true,
  lembrete_pendencias: true,
  frequencia: "imediato",
};

/**
 * Os e-mails das pessoas de uma empresa que querem este aviso agora.
 *
 * **`frequencia !== 'imediato'` fica de fora, e os dois casos são
 * diferentes.** `nunca` é a pessoa dizendo que não quer — e o produto
 * obedece. `diario` é a pessoa pedindo um resumo por dia, que **depende de
 * uma varredura que não existe**: a parte do sprint que agendaria isso saiu
 * junto com a VPS. Mandar um por evento seria dar a ela o contrário do que
 * ela escolheu; não mandar nada e não avisar seria o silêncio que este
 * produto já corrigiu em duas telas. Por isso a tela de Configurações do
 * portal diz, embaixo da opção, que ela ainda não sai.
 */
export async function clientesQueQueremReceber(
  clientId: string,
  aviso: AvisoDoCliente,
  /**
   * Quem causou o aviso, e por isso não o recebe — a mesma regra de
   * `notificar()` desde a 0011. Sem isto, quem comenta recebe o e-mail do
   * próprio comentário, que é a primeira coisa que faz alguém criar um filtro
   * na caixa de entrada.
   */
  exceto?: string | null,
): Promise<string[]> {
  if (!servicoConfigurado()) return [];

  const admin = criarClienteAdmin();

  const { data: vinculos, error: erroVinculo } = await admin
    .from("client_users")
    .select("user_id")
    .eq("client_id", clientId);

  if (erroVinculo) {
    console.error("[email:destinatarios] client_users:", erroVinculo.message);
    return [];
  }

  const ids = (vinculos ?? []).map((v) => v.user_id);
  if (ids.length === 0) return [];

  const { data: pessoas, error: erroPessoa } = await admin
    .from("profiles")
    .select("id, email, ativo")
    .in("id", ids);

  if (erroPessoa) {
    console.error("[email:destinatarios] profiles:", erroPessoa.message);
    return [];
  }

  const { data: prefs, error: erroPref } = await admin
    .from("client_notification_prefs")
    .select("user_id, novo_conteudo, novo_comentario, lembrete_pendencias, frequencia")
    .in("user_id", ids);

  if (erroPref) {
    console.error("[email:destinatarios] client_notification_prefs:", erroPref.message);
    return [];
  }

  const porPessoa = new Map<string, Preferencia>();
  for (const p of prefs ?? []) porPessoa.set(p.user_id, p as Preferencia);

  return (pessoas ?? [])
    // DESLIGADO NÃO RECEBE. Quem perdeu o acesso ao portal não pode continuar
    // sabendo o que a agência produz para aquela empresa.
    .filter((p) => p.ativo)
    .filter((p) => p.id !== exceto)
    .filter((p) => {
      const pref = porPessoa.get(p.id) ?? PADRAO;
      return pref[aviso] && pref.frequencia === "imediato";
    })
    .map((p) => p.email);
}

/**
 * Os e-mails de gente da agência, por id.
 *
 * Não há preferência do lado de cá, e a ausência é o desenho: quem trabalha
 * aqui recebe o que é dele. O que existe é a mesma regra do sino —
 * **`exceto` tira quem causou o aviso**, porque avisar alguém do que ela
 * acabou de fazer é ruído, e é a primeira coisa que faz alguém criar um
 * filtro na caixa de entrada.
 */
export async function emailsDaEquipe(
  userIds: (string | null | undefined)[],
  exceto?: string | null,
): Promise<string[]> {
  if (!servicoConfigurado()) return [];

  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))].filter(
    (id) => id !== exceto,
  );
  if (ids.length === 0) return [];

  const admin = criarClienteAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("email, ativo")
    .in("id", ids);

  if (error) {
    console.error("[email:destinatarios] equipe:", error.message);
    return [];
  }

  return (data ?? []).filter((p) => p.ativo).map((p) => p.email);
}
