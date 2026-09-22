"use client";

import { createBrowserClient } from "@supabase/ssr";

import { exigirConfigSupabase } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente Supabase para uso dentro de Client Components.
 *
 * Usa apenas a chave anon, entao tudo que ele consegue ler ou escrever passa
 * pelas politicas de RLS do banco. A sessao fica em cookies (e nao em
 * localStorage) para que o servidor tambem enxergue o usuario logado.
 */
export function criarClienteNavegador() {
  const { url, anonKey } = exigirConfigSupabase();
  return createBrowserClient<Database>(url, anonKey);
}
