/**
 * Versao de prototipo de src/lib/dados/portais-de-clientes.ts.
 */
import type { Client } from "@/lib/supabase/database.types";

import { APROVADOR_DO_CLIENTE, CLIENTES_EXEMPLO } from "./dados-exemplo";

/**
 * O LOGO VEM DO EXEMPLO e nao de um valor fixo aqui.
 *
 * `CLIENTES_EXEMPLO` tem logo em UMA das tres contas, de proposito (a licao da
 * duplicata do Cronograma): com as tres preenchidas a imagem provaria que o
 * circulo aparece, e nao que ele ESCOLHE entre a foto e as iniciais. Lendo a
 * coluna, a grade sai com os dois estados lado a lado.
 *
 * E o caminho ja e um endereco (`/exemplos/...`), entao nao ha o que assinar:
 * `enderecoDaArte` do produto deixa passar o que comeca com `/` e com `http`.
 */
export type PortalDeCliente = {
  id: string;
  nome_empresa: string;
  slug: string;
  fotoAssinada: string | null;
};

export async function listarPortaisDeClientes(): Promise<PortalDeCliente[]> {
  return (CLIENTES_EXEMPLO as unknown as Client[])
    .filter((cliente) => cliente.ativo)
    .map((cliente) => ({
      id: cliente.id,
      nome_empresa: cliente.nome_empresa,
      slug: cliente.slug ?? gerarSlug(cliente.nome_empresa),
      fotoAssinada: cliente.logo_url ?? null,
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
      // A MESMA PESSOA que o seletor de aprovadores oferece e que o historico
      // nomeia: no produto quem responde as tres e `aprovadores_da_conta()`,
      // e tres copias aqui sao tres lugares para divergir.
      user_id: APROVADOR_DO_CLIENTE.id,
      nome: APROVADOR_DO_CLIENTE.nome,
      email: APROVADOR_DO_CLIENTE.email,
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
