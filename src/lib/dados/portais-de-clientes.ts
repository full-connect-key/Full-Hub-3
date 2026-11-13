import "server-only";

import { ouFalha } from "./consulta";
import { assinarArquivos, enderecoDaArte } from "./conteudo";

import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/database.types";

/**
 * Os portais de clientes, vistos pela equipe.
 *
 * O QUE ISTO NÃO É: login como cliente. A sessão continua sendo a da pessoa da
 * agência, com o `auth.uid()` dela. Nenhum token é trocado, nada é
 * "impersonado". A gestão já podia ler os dados desses clientes pelo painel —
 * o que /portal/{slug} acrescenta é o ARRANJO: ver a mesma informação na tela
 * em que o cliente vê, para conferir o que ele está enxergando antes de uma
 * reunião.
 *
 * Por isso a visualização é só leitura, e por isso ela deixa rastro.
 */

/** Uma empresa na grade do Portal do Cliente. */
export type PortalDeCliente = {
  id: string;
  nome_empresa: string;
  slug: string;
  /** O logo da conta, já assinado — nulo quando ela não subiu nenhum. */
  fotoAssinada: string | null;
};

/**
 * As empresas ativas, com o LOGO de cada uma.
 *
 * **O logo é o pedido do usuário** — *"no ícone do lado do nome troque para a
 * foto do logo da conta"* — e a coluna já existia: `clients.logo_url` nasceu
 * na 0002. O que falta é o ENDEREÇO: ele mora no bucket PRIVADO
 * `campanhas-arquivos`, e caminho de bucket num `src` é o navegador pedindo ao
 * próprio site e levando 404 — o bug que `ImagemAssinada` existe para não
 * deixar voltar. Quem assina é `assinarArquivos`, **numa ida só para a lista
 * inteira**, que é a forma de `contasComFoto()` em Gestão de Tasks.
 *
 * **E a assinatura mora AQUI e não numa segunda função ao lado**, ao contrário
 * de lá: esta leitura tem um chamador só — a grade —, e ela desenha o logo. Um
 * par de funções, uma com foto e outra sem, seria duas respostas para "quais
 * são os portais" esperando divergir.
 */
export const listarPortaisDeClientes = cache(
  async (): Promise<PortalDeCliente[]> => {
    const supabase = await criarClienteServidor();

    const data = ouFalha(
      "os clientes com portal",
      await supabase
        .from("clients")
        .select("id, nome_empresa, slug, logo_url")
        .eq("ativo", true)
        .order("nome_empresa"),
    );

    const comSlug = data.filter(
      (c): c is {
        id: string;
        nome_empresa: string;
        slug: string;
        logo_url: string | null;
      } => Boolean(c.slug),
    );

    const assinadas = await assinarArquivos(
      "campanhas-arquivos",
      comSlug.map((c) => c.logo_url),
    );

    return comSlug.map((c) => ({
      id: c.id,
      nome_empresa: c.nome_empresa,
      slug: c.slug,
      fotoAssinada: enderecoDaArte(c.logo_url, assinadas),
    }));
  },
);

/** A empresa de um endereço. Null quando o slug não existe ou está inativa. */
export const obterClientePeloSlug = cache(
  async (slug: string): Promise<Client | null> => {
    const supabase = await criarClienteServidor();

    const data = ouFalha(
      "as visitas ao portal de cada cliente",
      await supabase
        .from("clients")
        .select("*")
        .eq("slug", slug)
        .maybeSingle(),
    );

    return data ?? null;
  },
);

/**
 * Quem tem acesso ao portal de uma empresa, com a data do último login.
 *
 * É o mesmo conteúdo da aba "Quem tem acesso" que o cliente vê, montado por
 * outro caminho: `usuarios_do_meu_cliente()` fecha em `my_client_ids()`, que é
 * vazio para quem é da agência. Aqui as policies já fazem o trabalho —
 * `client_users`, `profiles` e `client_access_log` abrem para `is_staff()` —,
 * então basta perguntar direto.
 */
export async function usuariosDoPortal(
  clienteId: string,
): Promise<
  {
    user_id: string;
    nome: string;
    email: string;
    ultimo_acesso: string | null;
  }[]
> {
  const supabase = await criarClienteServidor();

  const vinculos = ouFalha(
    "os vínculos de acesso ao portal",
    await supabase
      .from("client_users")
      .select("user_id")
      .eq("client_id", clienteId),
  );

  const ids = [...new Set(vinculos.map((v) => v.user_id))];
  if (ids.length === 0) return [];

  const [resposta0, resposta1] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", ids)
      .order("nome"),
    supabase
      .from("client_access_log")
      .select("user_id, created_at")
      .eq("acao", "login")
      .in("user_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  const pessoas = ouFalha("as pessoas com acesso ao portal", resposta0);
  const acessos = ouFalha("o último acesso de cada pessoa", resposta1);

  // O último login de cada pessoa é a primeira linha dela na lista ordenada.
  const ultimo = new Map<string, string>();
  for (const linha of acessos) {
    if (!ultimo.has(linha.user_id)) ultimo.set(linha.user_id, linha.created_at);
  }

  return pessoas.map((pessoa) => ({
    user_id: pessoa.id,
    nome: pessoa.nome,
    email: pessoa.email,
    ultimo_acesso: ultimo.get(pessoa.id) ?? null,
  }));
}
