/**
 * Versao de prototipo de src/lib/dados/portais-de-clientes.ts.
 */
import type { Client } from "@/lib/supabase/database.types";

import { CLIENTES_EXEMPLO } from "./dados-exemplo";

export async function listarPortaisDeClientes(): Promise<
  { id: string; nome_empresa: string; slug: string }[]
> {
  return (CLIENTES_EXEMPLO as unknown as Client[])
    .filter((cliente) => cliente.ativo)
    .map((cliente) => ({
      id: cliente.id,
      nome_empresa: cliente.nome_empresa,
      slug: cliente.slug ?? gerarSlug(cliente.nome_empresa),
    }));
}

export async function obterClientePeloSlug(
  slug: string,
): Promise<Client | null> {
  const lista = CLIENTES_EXEMPLO as unknown as Client[];
  return (
    lista.find((c) => (c.slug ?? gerarSlug(c.nome_empresa)) === slug) ??
    lista[0] ??
    null
  );
}

/** Espelho do gerar_slug() do Postgres, para o exemplo nao inventar endereco. */
function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function usuariosDoPortal(
  _clienteId: string,
): Promise<
  {
    user_id: string;
    nome: string;
    email: string;
    ultimo_acesso: string | null;
  }[]
> {
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  return [
    {
      user_id: "c1",
      nome: "Joana Prado",
      email: "joana@mundoverde.com.br",
      ultimo_acesso: ontem.toISOString(),
    },
    {
      user_id: "c2",
      nome: "Rafael Lima",
      email: "rafael@mundoverde.com.br",
      ultimo_acesso: null,
    },
  ];
}
