import "server-only";

import { cache } from "react";

import { assinarArquivos, enderecoDaArte } from "@/lib/dados/conteudo";
import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/database.types";

/**
 * Consultas de clientes.
 *
 * Os relacionamentos são resolvidos com uma segunda consulta e juntados aqui,
 * em vez de usar o embed do PostgREST. É mais previsível: o embed depende do
 * nome exato da constraint de chave estrangeira e quebra em silêncio quando
 * ela muda de nome numa migration.
 *
 * Nenhuma consulta filtra por usuário: o RLS de `clients` já faz isso — a
 * equipe vê todas, o cliente vê só as vinculadas a ele. Repetir o filtro aqui
 * seria manter a mesma regra em dois lugares.
 */

export type ClienteComResumo = Client & {
  responsavel: { id: string; nome: string } | null;
  usuariosComAcesso: number;
};

/** Empresas que a pessoa logada enxerga. Usada pelo Portal. */
export const obterMinhasEmpresas = cache(async () => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("clients")
    .select("id, nome_empresa")
    .eq("ativo", true)
    .order("nome_empresa");

  return data ?? [];
});

export const listarClientes = cache(async (): Promise<ClienteComResumo[]> => {
  const supabase = await criarClienteServidor();

  const [{ data: clientes }, { data: vinculos }] = await Promise.all([
    supabase.from("clients").select("*").order("nome_empresa"),
    supabase.from("client_users").select("client_id, user_id"),
  ]);

  if (!clientes) return [];

  const idsDeResponsaveis = [
    ...new Set(clientes.map((c) => c.responsavel_atendimento_id).filter(Boolean)),
  ] as string[];

  const { data: responsaveis } = idsDeResponsaveis.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsDeResponsaveis)
    : { data: [] };

  const porId = new Map((responsaveis ?? []).map((p) => [p.id, p]));
  const contagem = new Map<string, number>();
  for (const vinculo of vinculos ?? []) {
    contagem.set(vinculo.client_id, (contagem.get(vinculo.client_id) ?? 0) + 1);
  }

  return clientes.map((cliente) => ({
    ...cliente,
    responsavel: cliente.responsavel_atendimento_id
      ? (porId.get(cliente.responsavel_atendimento_id) ?? null)
      : null,
    usuariosComAcesso: contagem.get(cliente.id) ?? 0,
  }));
});

export const obterCliente = cache(async (id: string): Promise<Client | null> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  return data ?? null;
});

/** Pessoas do lado do cliente com acesso ao portal desta empresa. */
export const usuariosDoCliente = cache(async (clientId: string) => {
  const supabase = await criarClienteServidor();

  const { data: vinculos } = await supabase
    .from("client_users")
    .select("id, user_id, created_at")
    .eq("client_id", clientId);

  if (!vinculos || vinculos.length === 0) return [];

  const { data: perfis } = await supabase
    .from("profiles")
    .select("id, nome, email, ativo")
    .in(
      "id",
      vinculos.map((v) => v.user_id),
    );

  const porId = new Map((perfis ?? []).map((p) => [p.id, p]));

  return vinculos
    .map((vinculo) => {
      const perfil = porId.get(vinculo.user_id);
      return perfil
        ? { vinculoId: vinculo.id, vinculadoEm: vinculo.created_at, ...perfil }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
});

/**
 * O que impede apagar um cliente de verdade.
 *
 * Regra: QUALQUER vínculo bloqueia. Um cliente com gente acessando o portal ou
 * com task no nome dele não pode sumir do banco — o caminho é desativar, que
 * tira das listas sem perder nada. DELETE só sobra para empresa recém-criada e
 * vazia, cadastrada por engano.
 *
 * Campanhas, posts e lançamentos financeiros chegam em sprints futuros: basta
 * somar a contagem aqui, e a tela passa a barrar sozinha, porque ela só olha
 * para este resultado.
 */
export async function vinculosDoCliente(clientId: string) {
  const supabase = await criarClienteServidor();

  const [{ count: acessos }, { count: tasks }] = await Promise.all([
    supabase
      .from("client_users")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .not("publicada_em", "is", null),
  ]);

  const usuarios = acessos ?? 0;
  const tasksVinculadas = tasks ?? 0;

  // Sprint 5+: campanhas, posts e lançamentos financeiros entram aqui.
  const campanhas = 0;
  const posts = 0;
  const lancamentos = 0;

  const total = usuarios + tasksVinculadas + campanhas + posts + lancamentos;

  return {
    usuarios,
    tasks: tasksVinculadas,
    campanhas,
    posts,
    lancamentos,
    total,
    impedeExclusao: total > 0,
  };
}

/**
 * A identidade visual do portal de uma empresa: capa e foto, assinadas (0063).
 *
 * ---------------------------------------------------------------------------
 * **`clienteId` OPCIONAL, como em todo o resto do Portal.**
 *
 * Para o cliente ele é nulo e quem filtra é o RLS — repetir o filtro aqui
 * seria criar o segundo lugar onde a regra pode divergir, que é a decisão
 * registrada de `lib/dados/portal.ts`. Ele existe para a visualização
 * administrativa, onde quem pergunta é da equipe e enxerga todas.
 * ---------------------------------------------------------------------------
 *
 * **As duas assinadas numa ida só.** O bucket é privado e a URL vale uma hora;
 * duas chamadas seriam duas idas à rede para desenhar um cabeçalho.
 *
 * `enderecoDaArte` e não o mapa direto: nem toda imagem mora no bucket — a do
 * seed é um caminho do próprio site, e assinar um endereço que não é do
 * Storage devolve erro, o que faria a imagem sumir da tela sem nada avisando.
 * É a mesma linha da capa da campanha.
 */
export async function identidadeDoPortal(
  clienteId?: string,
): Promise<{ nome: string; capaAssinada: string | null; fotoAssinada: string | null } | null> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("clients")
    .select("id, nome_empresa, capa_url, logo_url")
    .eq("ativo", true)
    .order("nome_empresa")
    .limit(1);

  if (clienteId) consulta = consulta.eq("id", clienteId);

  // A LISTA E O PRIMEIRO, e não `maybeSingle()`: sem `clienteId` — que é o
  // caso do cliente, onde quem filtra é o RLS — a pessoa pode responder por
  // duas empresas, e `maybeSingle()` estoura com "mais de uma linha" em vez
  // de devolver alguma. O `limit(1)` já escolheu; aqui só se lê.
  const linhas = ouFalha("a identidade do portal", await consulta) ?? [];
  const linha = linhas[0];
  if (!linha) return null;

  const assinadas = await assinarArquivos("campanhas-arquivos", [
    linha.capa_url,
    linha.logo_url,
  ]);

  return {
    nome: linha.nome_empresa,
    capaAssinada: enderecoDaArte(linha.capa_url, assinadas),
    fotoAssinada: enderecoDaArte(linha.logo_url, assinadas),
  };
}
