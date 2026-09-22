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
      nome: "Variáveis de ambiente",
      situacao: "falha",
      detalhe: `Faltando: ${faltando.join(", ")}.`,
      comoResolver:
        "Copie .env.local.example para .env.local e preencha com os dados de Supabase > Project Settings > Data API e API Keys.",
    };
  }

  try {
    const url = new URL(SUPABASE_URL);
    if (url.protocol !== "https:") {
      return {
        nome: "Variáveis de ambiente",
        situacao: "alerta",
        detalhe: `A URL usa ${url.protocol} em vez de https.`,
        comoResolver: "Em produção a URL do Supabase precisa começar com https://.",
      };
    }
  } catch {
    return {
      nome: "Variáveis de ambiente",
      situacao: "falha",
      detalhe: "NEXT_PUBLIC_SUPABASE_URL não é uma URL válida.",
      comoResolver: "O formato correto é https://<referência-do-projeto>.supabase.co (sem barra no final).",
    };
  }

  return {
    nome: "Variáveis de ambiente",
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
        nome: "Conexão com o Supabase",
        situacao: "ok",
        detalhe: "Serviço de autenticação respondeu normalmente.",
      };
    }

    if (resposta.status === 401) {
      return {
        nome: "Conexão com o Supabase",
        situacao: "falha",
        detalhe: "O projeto respondeu, mas recusou a chave (401).",
        comoResolver:
          "A NEXT_PUBLIC_SUPABASE_ANON_KEY não confere com o projeto da URL. Copie as duas do mesmo projeto.",
      };
    }

    return {
      nome: "Conexão com o Supabase",
      situacao: "falha",
      detalhe: `Resposta inesperada: HTTP ${resposta.status}.`,
      comoResolver:
        "Confira em supabase.com se o projeto está ativo — projetos gratuitos hibernam depois de um período sem uso.",
    };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    return {
      nome: "Conexão com o Supabase",
      situacao: "falha",
      detalhe: `Não foi possível alcançar o servidor (${motivo}).`,
      comoResolver:
        "Verifique a URL e se a máquina tem saída para a internet. Na VPS, confira o firewall para saídas HTTPS.",
    };
  }
}

/** A migration 0002 ja foi aplicada neste projeto? */
async function checarSchema(): Promise<Checagem> {
  try {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });

    if (!error) {
      return {
        nome: "Tabela profiles",
        situacao: "ok",
        detalhe: "Tabela encontrada e respondendo com RLS ativo.",
      };
    }

    // 42P01 = undefined_table no Postgres
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return {
        nome: "Tabela profiles",
        situacao: "alerta",
        detalhe: "A tabela public.profiles ainda não existe.",
        comoResolver:
          "Abra Supabase > SQL Editor, cole o conteúdo de supabase/migrations/0002_estrutura_base.sql e clique em Run.",
      };
    }

    return {
      nome: "Tabela profiles",
      situacao: "alerta",
      detalhe: `${error.message} (codigo ${error.code ?? "?"}).`,
    };
  } catch (erro) {
    return {
      nome: "Tabela profiles",
      situacao: "alerta",
      detalhe: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

/** A chave de servico esta disponivel? Opcional, por isso nunca e "falha". */
function checarChaveDeServico(): Checagem {
  if (SUPABASE_SERVICE_ROLE_KEY) {
    return {
      nome: "Chave de serviço",
      situacao: "ok",
      detalhe: "Configurada e disponível apenas no servidor.",
    };
  }
  return {
    nome: "Chave de serviço",
    situacao: "alerta",
    detalhe: "SUPABASE_SERVICE_ROLE_KEY não configurada (opcional).",
    comoResolver:
      "Só é necessária para rotinas administrativas, como criar usuários pelo próprio dashboard.",
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
