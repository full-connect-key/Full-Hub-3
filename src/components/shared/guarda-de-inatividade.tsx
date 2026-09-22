"use client";

import { useTimeoutDeInatividade } from "@/hooks/use-timeout-de-inatividade";

/**
 * Liga o timeout de inatividade. Nao desenha nada: existe so para rodar o
 * hook dentro de um layout que e Server Component.
 */
export function GuardaDeInatividade() {
  useTimeoutDeInatividade(true);
  return null;
}
