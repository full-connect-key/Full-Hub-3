/**
 * Versao de prototipo de src/lib/supabase/diagnostico.ts.
 *
 * Mostra a conexao saudavel, que e o estado normal do dia a dia -- e o que
 * interessa ver ao validar o visual.
 *
 * Os tipos sao reexportados do arquivo real, entao nunca saem de sincronia.
 */
export type { Situacao, Checagem, Diagnostico } from "../../src/lib/supabase/diagnostico";

import type { Diagnostico } from "../../src/lib/supabase/diagnostico";

export async function diagnosticarSupabase(): Promise<Diagnostico> {
  return {
    situacaoGeral: "ok",
    host: "seu-projeto.supabase.co",
    verificadoEm: new Date().toISOString(),
    checagens: [
      { nome: "Variáveis de ambiente", situacao: "ok", detalhe: "URL e chave anon preenchidas." },
      {
        nome: "Conexão com o Supabase",
        situacao: "ok",
        detalhe: "Serviço de autenticação respondeu normalmente.",
      },
      {
        nome: "Tabela profiles",
        situacao: "ok",
        detalhe: "Tabela encontrada e respondendo com RLS ativo.",
      },
      {
        nome: "Chave de serviço",
        situacao: "ok",
        detalhe: "Configurada e disponível apenas no servidor.",
      },
    ],
  };
}
