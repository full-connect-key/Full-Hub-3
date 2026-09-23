import "server-only";

import { SUPABASE_ANON_KEY, SUPABASE_URL, variaveisFaltando } from "@/lib/env";
import { servicoConfigurado } from "./admin";
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

    // Barra no final, ou qualquer caminho depois do dominio. E invisivel na
    // tela e quebra toda chamada montada por concatenacao -- o supabase-js
    // guarda a URL como recebeu, sem tirar a barra.
    const temBarraFinal = SUPABASE_URL.trimEnd().endsWith("/");
    if (url.pathname !== "/" || temBarraFinal) {
      // A URL certa sai da errada: o que sobra tirando o caminho. Mostrar o
      // valor pronto poupa a viagem ao painel do Supabase -- e é lá que o
      // erro nasce, porque a tela do Data API mostra o "Project URL" e o
      // endereço REST (`.../rest/v1`) um do lado do outro.
      const correta = `${url.protocol}//${url.host}`;

      return {
        nome: "Variáveis de ambiente",
        situacao: "falha",
        detalhe:
          url.pathname === "/"
            ? "A URL termina com uma barra. Ela é invisível na tela e quebra as chamadas."
            : `A URL tem um caminho depois do domínio: "${url.pathname}".`,
        comoResolver:
          `O valor correto é exatamente ${correta} — sem caminho e sem barra no final. ` +
          "Se você copiou o endereço REST (terminado em /rest/v1), pegue o campo “Project URL” em Supabase > Project Settings > Data API. " +
          "Depois de corrigir, RECONSTRUA: este valor é embutido no build, e só reiniciar não muda nada.",
      };
    }

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

/**
 * O servico de autenticacao responde -- e o login por e-mail esta ligado?
 *
 * Pergunta a `/auth/v1/settings` e nao a `/auth/v1/health`. As duas dizem se
 * o servico esta de pe, mas so `settings` responde a PERGUNTA SEGUINTE, que e
 * a que interessa: quais provedores de login estao habilitados.
 *
 * A troca veio de um caso real. O diagnostico acusava "HTTP 404" no
 * `/health` e sugeria que o projeto estivesse hibernando -- enquanto a
 * checagem da tabela `profiles`, logo abaixo, passava. Projeto hibernado nao
 * serve `profiles`, entao a dica estava errada e mandava procurar no lugar
 * errado. Duas checagens na mesma tela dizendo coisas incompativeis e pior
 * que uma checagem a menos.
 *
 * A URL e normalizada antes de concatenar porque aqui o `fetch` e cru: o
 * cliente do supabase-js NAO tira a barra final, entao uma barra sobrando no
 * .env.local vira `//auth/v1/...` e o gateway devolve 404 -- um 404 que nao
 * tem nada a ver com o servidor estar no ar.
 */
async function checarAlcance(): Promise<Checagem> {
  const base = SUPABASE_URL.replace(/\/+$/, "");

  try {
    const resposta = await fetch(`${base}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });

    if (resposta.ok) {
      const config = (await resposta.json()) as {
        external?: Record<string, boolean>;
        disable_signup?: boolean;
      };

      // O provedor de e-mail desligado e a causa mais silenciosa de "criei o
      // usuario e nao consigo entrar": a conta existe, a senha esta certa, e
      // o Supabase recusa o login inteiro. Na tela do Supabase o interruptor
      // fica ao lado do "Enable Sign Ups", que e o que a gente de fato quer
      // desmarcar -- dai a troca.
      if (config.external?.email === false) {
        return {
          nome: "Login por e-mail",
          situacao: "falha",
          detalhe: "O serviço respondeu, mas o provedor Email está DESLIGADO.",
          comoResolver:
            "Em Supabase > Authentication > Sign In / Providers, religue o provedor Email. O que fecha o cadastro público é “Enable Sign Ups”, e ele pode continuar desmarcado.",
        };
      }

      return {
        nome: "Login por e-mail",
        situacao: "ok",
        detalhe: config.disable_signup
          ? "Provedor Email ligado, e o cadastro público fechado — como deve ser."
          : "Provedor Email ligado. Atenção: o cadastro público está ABERTO.",
      };
    }

    if (resposta.status === 401) {
      return {
        nome: "Login por e-mail",
        situacao: "falha",
        detalhe: "O projeto respondeu, mas recusou a chave (401).",
        comoResolver:
          "A NEXT_PUBLIC_SUPABASE_ANON_KEY não confere com o projeto da URL. Copie as duas do mesmo projeto.",
      };
    }

    return {
      nome: "Login por e-mail",
      situacao: "falha",
      detalhe: `O serviço de autenticação respondeu HTTP ${resposta.status} em ${base}/auth/v1/settings.`,
      comoResolver:
        "Se a checagem da tabela profiles passou, o projeto está no ar e a chave vale — então o problema é o endereço. Confira se NEXT_PUBLIC_SUPABASE_URL é exatamente https://<referência>.supabase.co, sem barra no final e sem nada depois do .co.",
    };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    return {
      nome: "Login por e-mail",
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

/**
 * A chave de servico esta disponivel?
 *
 * Sem ela nao da para cadastrar ninguem: criar conta no Auth e operacao
 * administrativa. Por isso o alerta aqui diz exatamente o que para de
 * funcionar, em vez de chamar a chave de "opcional".
 */
function checarChaveDeServico(): Checagem {
  if (servicoConfigurado()) {
    return {
      nome: "Chave de serviço",
      situacao: "ok",
      detalhe: "Configurada e disponível apenas no servidor.",
    };
  }
  return {
    nome: "Chave de serviço",
    situacao: "alerta",
    detalhe:
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Sem ela não é possível adicionar " +
      "colaboradores nem convidar usuários para o portal do cliente.",
    comoResolver:
      "Pegue a chave em Supabase > Project Settings > API Keys > service_role, coloque no " +
      ".env.local como SUPABASE_SERVICE_ROLE_KEY (sem o prefixo NEXT_PUBLIC_) e reinicie o servidor.",
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
