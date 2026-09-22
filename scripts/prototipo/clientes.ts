/**
 * Versao de prototipo de src/lib/dados/clientes.ts.
 * Devolve a empresa de exemplo, sem falar com o Supabase.
 */
import { EMPRESAS_EXEMPLO } from "./dados-exemplo";

export async function obterMinhasEmpresas() {
  return EMPRESAS_EXEMPLO;
}
