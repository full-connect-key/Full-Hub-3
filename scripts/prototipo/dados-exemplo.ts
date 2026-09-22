/**
 * Dados de exemplo usados APENAS na geracao de prototipos.
 *
 * A cada sprint, acrescente aqui as linhas ficticias do modulo novo. E o unico
 * arquivo que precisa crescer para as telas novas aparecerem nas imagens.
 *
 * Nada daqui entra no app publicado: o gerador trabalha sobre uma copia
 * temporaria do projeto (veja scripts/prototipo.mjs).
 */
import type { Profile } from "@/lib/supabase/database.types";

export const PROFILE_EQUIPE: Profile = {
  id: "a0000000-0000-0000-0000-000000000001",
  email: "ana@fullconnectkey.com.br",
  nome: "Ana Souza",
  role: "socio",
  avatar_url: null,
  ativo: true,
  created_at: "2026-01-15T10:00:00.000Z",
};

export const PROFILE_CLIENTE: Profile = {
  id: "a0000000-0000-0000-0000-000000000004",
  email: "contato@clientealfa.com.br",
  nome: "Caio Alves",
  role: "cliente",
  avatar_url: null,
  ativo: true,
  created_at: "2026-01-15T10:00:00.000Z",
};

export const USUARIO_EXEMPLO = {
  id: PROFILE_EQUIPE.id,
  email: PROFILE_EQUIPE.email,
  user_metadata: { nome: PROFILE_EQUIPE.nome },
};

export const EMPRESAS_EXEMPLO = [
  { id: "c0000000-0000-0000-0000-00000000000a", nome_empresa: "Cliente Alfa" },
];
