/**
 * Versao de prototipo de src/lib/auth/dal.ts.
 *
 * Devolve sessoes ficticias para as telas privadas renderizarem sem Supabase e
 * sem login. O perfil da equipe vem de PROTOTIPO_ROLE, entao um build so serve
 * para conferir o menu e os 403 dos quatro perfis.
 *
 * A validacao de rota continua sendo a de verdade: chama o mesmo canAccess de
 * permissions.ts e o mesmo forbidden() do Next. Só a sessao e falsa.
 */
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { canAccess } from "@/lib/auth/permissions";
import type { Profile, UserRole } from "@/lib/supabase/database.types";
import { PROFILE_CLIENTE, PROFILE_EQUIPE, USUARIO_EXEMPLO } from "./dados-exemplo";

export type Sessao = { usuarioId: string; email: string; profile: Profile };

const PERFIS_VALIDOS: UserRole[] = ["colaborador", "desenvolvedor", "socio"];

function roleDoAmbiente(): UserRole {
  // Colchetes de proposito: o Next substitui `process.env.NOME` pelo valor do
  // build. Lido assim, o valor vem de verdade do ambiente na hora do pedido, e
  // o mesmo build serve para conferir os tres perfis.
  const pedido = process.env["PROTOTIPO_ROLE"] as UserRole | undefined;
  return pedido && PERFIS_VALIDOS.includes(pedido) ? pedido : "socio";
}

const NOMES: Record<string, { nome: string; email: string }> = {
  socio: { nome: "Ana Souza", email: "socia@fullconnectkey.com.br" },
  desenvolvedor: { nome: "Diego Reis", email: "dev@fullconnectkey.com.br" },
  colaborador: { nome: "Carla Nunes", email: "colab@fullconnectkey.com.br" },
};

function profileDaEquipe(): Profile {
  const role = roleDoAmbiente();
  return { ...PROFILE_EQUIPE, ...NOMES[role], role };
}

function sessaoDe(profile: Profile): Sessao {
  return { usuarioId: profile.id, email: profile.email, profile };
}

/**
 * O dal de verdade le cookies, e isso faz o Next tratar a rota como dinamica.
 * Aqui nao ha cookies, entao as paginas seriam pre-renderizadas no build e
 * congelariam o perfil daquele momento. Ler os cabecalhos devolve o mesmo
 * comportamento: cada requisicao renderiza de novo.
 */
async function marcarComoDinamica() {
  await headers();
}

export async function obterUsuario(): Promise<User | null> {
  await marcarComoDinamica();
  return USUARIO_EXEMPLO as unknown as User;
}

export async function obterSessao(): Promise<Sessao | null> {
  await marcarComoDinamica();
  return sessaoDe(profileDaEquipe());
}

export async function exigirSessao(): Promise<Sessao> {
  await marcarComoDinamica();
  return sessaoDe(profileDaEquipe());
}

export async function exigirEquipe(): Promise<Sessao> {
  await marcarComoDinamica();
  return sessaoDe(profileDaEquipe());
}

export async function exigirAcessoARota(href: string): Promise<Sessao> {
  await marcarComoDinamica();
  const sessao = sessaoDe(profileDaEquipe());
  if (!canAccess(sessao.profile.role, href)) forbidden();
  return sessao;
}

export async function exigirCliente(): Promise<Sessao> {
  await marcarComoDinamica();
  return sessaoDe(PROFILE_CLIENTE);
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
