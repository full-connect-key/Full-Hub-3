import "server-only";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  variaveisFaltando,
} from "@/lib/env";
import { criarClienteServidor } from "./server";

/**
 * Diagnostico da conexao com o Supabase.
 *
 * Existe para responder, sem adivinhacao, a pergunta "esta conectado?" --
 * tanto na tela /status quanto no terminal (npm run check:supabase) e em
 * /api/status/supabase depois do deploy.
 *
 * Nenhuma chave e devolvida: so o host do projeto (que ja vai no bundle do
 * navegador de qualquer forma) e o resultado de cada checagem.
 */

export type Situacao = "ok" | "alerta" | "falha";

export type Checagem = {
  nome: string;
  situacao: Situacao;
  detalhe: string;
  /** O que fazer quando nao esta ok. */
  comoResolver?: string;
};

export type Diagnostico = {
  situacaoGeral: Situacao;
  host: string | null;
  verificadoEm: string;
  checagens: Checagem[];
};

const TEMPO_LIMITE_MS = 8000;

/** As variaveis publicas estao preenchidas e a URL faz sentido? */
function checarVariaveis(): Checagem {
  const faltando = variaveisFaltando();

  if (faltando.length > 0) {
    return {
      nome: "Variaveis de ambiente",
      situacao: "falha",
      detalhe: `Faltando: ${faltando.join(", ")}.`,
      comoResolver:
        "Copie .env.example para .env.local e preencha com os dados de Supabase > Project Settings > Data API e API Keys.",
    };
  }

  try {
    const url = new URL(SUPABASE_URL);
    if (url.protocol !== "https:") {
      return {
        nome: "Variaveis de ambiente",
        situacao: "alerta",
        detalhe: `A URL usa ${url.protocol} em vez de https.`,
        comoResolver: "Em producao a URL do Supabase precisa comecar com https://.",
      };
    }
  } catch {
    return {
      nome: "Variaveis de ambiente",
      situacao: "falha",
      detalhe: "NEXT_PUBLIC_SUPABASE_URL nao e uma URL valida.",
      comoResolver: "O formato correto e https://<referencia-do-projeto>.supabase.co (sem barra no final).",
    };
  }

  return {
    nome: "Variaveis de ambiente",
    situacao: "ok",
    detalhe: "URL e chave anon preenchidas.",
  };
}

/** O servidor do Supabase responde? */
async function checarAlcance(): Promise<Checagem> {
  try {
    const resposta = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });

    if (resposta.ok) {
      return {
        nome: "Conexao com o Supabase",
        situacao: "ok",
        detalhe: "Servico de autenticacao respondeu normalmente.",
      };
    }

    if (resposta.status === 401) {
      return {
        nome: "Conexao com o Supabase",
        situacao: "falha",
        detalhe: "O projeto respondeu, mas recusou a chave (401).",
        comoResolver:
          "A NEXT_PUBLIC_SUPABASE_ANON_KEY nao confere com o projeto da URL. Copie as duas do mesmo projeto.",
      };
    }

    return {
      nome: "Conexao com o Supabase",
      situacao: "falha",
      detalhe: `Resposta inesperada: HTTP ${resposta.status}.`,
      comoResolver:
        "Confira em supabase.com se o projeto esta ativo -- projetos gratuitos hibernam depois de um periodo sem uso.",
    };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    return {
      nome: "Conexao com o Supabase",
      situacao: "falha",
      detalhe: `Nao foi possivel alcancar o servidor (${motivo}).`,
      comoResolver:
        "Verifique a URL e se a maquina tem saida para a internet. Na VPS, confira o firewall para saidas HTTPS.",
    };
  }
}

/** A migration 0001 ja foi aplicada neste projeto? */
async function checarSchema(): Promise<Checagem> {
  try {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("perfis").select("id", { count: "exact", head: true });

    if (!error) {
      return {
        nome: "Tabela perfis",
        situacao: "ok",
        detalhe: "Tabela encontrada e respondendo com RLS ativo.",
      };
    }

    // 42P01 = undefined_table no Postgres
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return {
        nome: "Tabela perfis",
        situacao: "alerta",
        detalhe: "A tabela public.perfis ainda nao existe.",
        comoResolver:
          "Abra Supabase > SQL Editor, cole o conteudo de supabase/migrations/0001_perfis.sql e clique em Run.",
      };
    }

    return {
      nome: "Tabela perfis",
      situacao: "alerta",
      detalhe: `${error.message} (codigo ${error.code ?? "?"}).`,
    };
  } catch (erro) {
    return {
      nome: "Tabela perfis",
      situacao: "alerta",
      detalhe: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

/** A chave de servico esta disponivel? Opcional, por isso nunca e "falha". */
function checarChaveDeServico(): Checagem {
  if (SUPABASE_SERVICE_ROLE_KEY) {
    return {
      nome: "Chave de servico",
      situacao: "ok",
      detalhe: "Configurada e disponivel apenas no servidor.",
    };
  }
  return {
    nome: "Chave de servico",
    situacao: "alerta",
    detalhe: "SUPABASE_SERVICE_ROLE_KEY nao configurada (opcional).",
    comoResolver:
      "So e necessaria para rotinas administrativas, como criar usuarios pelo proprio dashboard.",
  };
}

function consolidar(checagens: Checagem[]): Situacao {
  if (checagens.some((c) => c.situacao === "falha")) return "falha";
  if (checagens.some((c) => c.situacao === "alerta")) return "alerta";
  return "ok";
}

export async function diagnosticarSupabase(): Promise<Diagnostico> {
  const variaveis = checarVariaveis();

  // Sem credenciais validas as outras checagens nao teriam o que testar.
  if (variaveis.situacao === "falha") {
    return {
      situacaoGeral: "falha",
      host: null,
      verificadoEm: new Date().toISOString(),
      checagens: [variaveis],
    };
  }

  const [alcance, schema] = await Promise.all([checarAlcance(), checarSchema()]);
  const checagens = [variaveis, alcance, schema, checarChaveDeServico()];

  return {
    situacaoGeral: consolidar(checagens),
    host: new URL(SUPABASE_URL).host,
    verificadoEm: new Date().toISOString(),
    checagens,
  };
}
