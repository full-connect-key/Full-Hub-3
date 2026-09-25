import { execFileSync } from "node:child_process";

import type { NextConfig } from "next";

import { ROTAS_RENOMEADAS } from "./src/lib/auth/permissions";

/**
 * De qual commit este build saiu.
 *
 * Lido AQUI, no build, e congelado no bundle — não consultado em tempo de
 * execução. O que está no ar é uma pasta `.next` já compilada; se alguém
 * puxasse código sem reconstruir, uma consulta ao git do servidor devolveria
 * um commit que não é o que está rodando, que é pior que não mostrar nada.
 *
 * A variável de ambiente ganha do git para o caso de o build sair de um
 * lugar sem clone (um tarball, uma imagem). Se nenhum dos dois responder,
 * o rodapé diz "versão local" — e quem vê isso sabe na hora que não está
 * olhando uma versão publicada.
 */
function lerDoGit(...args: string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const COMMIT = process.env.NEXT_PUBLIC_COMMIT || lerDoGit("rev-parse", "--short", "HEAD");
const COMMIT_EM =
  process.env.NEXT_PUBLIC_COMMIT_EM || lerDoGit("log", "-1", "--format=%cI");

const nextConfig: NextConfig = {
  // `env` embute o valor no código que vai para o navegador, do mesmo jeito
  // que um NEXT_PUBLIC_ do .env.local — a diferença é que este é calculado
  // no build em vez de digitado num arquivo que alguém esqueceria de trocar.
  env: {
    NEXT_PUBLIC_COMMIT: COMMIT,
    NEXT_PUBLIC_COMMIT_EM: COMMIT_EM,
  },

  /**
   * Onde o build é gravado.
   *
   * Em desenvolvimento e ao rodar `npm run build` na mão, é `.next` — o
   * padrão. O DEPLOY passa `NEXT_DIST_DIR=.next-novo`, constrói ali e só
   * troca a pasta quando o build termina bem.
   *
   * Sem isso, `npm run build` na VPS reescreve o `.next` de que o processo
   * em produção está servindo. Durante o minuto e meio de build a pessoa que
   * estiver com o painel aberto pede um arquivo que já não existe e leva 404
   * — e se o build falhar no meio, o site fica quebrado até alguém perceber.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  experimental: {
    // Habilita forbidden(), que devolve HTTP 403 de verdade quando alguem
    // tenta abrir uma area que nao e do seu perfil. Sem isso so daria para
    // mostrar uma tela bonita com status 200, o que engana monitoramento e
    // ferramentas de auditoria.
    authInterrupts: true,
  },

  /**
   * As rotas que mudaram de nome no Sprint 3C.
   *
   * `permanent: true` manda 308: o navegador guarda, e o link que alguem
   * deixou no favorito ou colou num grupo continua chegando ao lugar certo
   * em vez de virar 404 porque o modulo ganhou um nome melhor.
   *
   * A lista sai de permissions.ts, que e a fonte unica das rotas -- aqui so
   * se traduz o formato.
   */
  async redirects() {
    return ROTAS_RENOMEADAS.map(({ de, para }) => ({
      source: de,
      destination: para,
      permanent: true,
    }));
  },

  /**
   * Os cabecalhos de seguranca.
   *
   * -------------------------------------------------------------------------
   * O CSP E O QUE PRECISA DE CUIDADO, e por uma razao especifica: um CSP
   * errado NAO derruba o build, nao aparece no lint e nao quebra a pagina de
   * um jeito obvio -- ele bloqueia um recurso, o navegador escreve no console
   * e a tela sai sem a fonte, sem o estilo ou sem o script. E o mesmo modo de
   * falha da classe de cor que o Tailwind nao conhece, e do `grep -i` lendo
   * acento pelo locale: passa em tudo e some na tela.
   *
   * Por isso cada diretiva aqui tem o motivo escrito, e a conferencia e a
   * imagem do prototipo com o console limpo -- nao o build.
   *
   * `'unsafe-inline'` em script-src e a concessao que este app faz hoje: o
   * Next injeta o payload de hidratacao em `<script>` inline, e o caminho
   * certo (nonce por requisicao) exige que todo HTML passe pelo proxy, o que
   * torna cada pagina dinamica. E decisao com custo dito, nao descuido: para
   * fechar, e um nonce em `src/proxy.ts` e `'strict-dynamic'` aqui.
   *
   * `'unsafe-eval'` NAO entra. Ele e o que separa um CSP que atrapalha um
   * ataque de um que so enfeita o cabecalho.
   * -------------------------------------------------------------------------
   */
  async headers() {
    // O HOST DO SUPABASE E LIDO NO BUILD, e isso e consequencia e nao
    // escolha: `headers()` e avaliado uma vez e gravado no manifesto das
    // rotas. Trocar o projeto do Supabase por variavel de ambiente e
    // reiniciar o processo NAO troca o CSP -- precisa reconstruir, como o
    // commit do rodape. Sao os dois valores que o build congela.
    //
    // Vazio nao e caso a tratar aqui: sem a URL o bundle tambem nao tem a
    // chave anon, entao o app nao fala com o Supabase de jeito nenhum e o
    // /status diz qual variavel falta. Os dois faltam juntos.
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    // O websocket do Realtime e o MESMO host do Supabase, em wss://. Sem ele
    // na lista, a subscription cai sem dizer por que -- e o sintoma e uma
    // tela que simplesmente nao atualiza sozinha.
    const supabaseWs = supabase.replace(/^https:/, "wss:");

    const csp = [
      "default-src 'self'",
      // `unsafe-inline`: o payload de hidratacao do Next. Sem `unsafe-eval`.
      "script-src 'self' 'unsafe-inline'",
      // `unsafe-inline` em estilo e do Tailwind e do Radix, que escrevem
      // `style=` calculado (posicao de popover, altura de animacao).
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // `blob:` e do visualizador de arte e do CSV que a tela monta na hora;
      // `data:` e dos SVG embutidos. O host do Supabase e de onde vem toda
      // imagem assinada.
      // -------------------------------------------------------------------
      // `https://www.google.com` E O FAVICON DO FEED DE RECOMENDACOES, e ele
      // so entrou aqui porque a conferencia o encontrou: a primeira versao
      // deste CSP nao o tinha, e o cartao saia com a moldura quebrada no
      // lugar do icone do site indicado. Nenhum build teria dito isso.
      //
      // O QUE ISSO CUSTA, e fica escrito para ser decidido e nao herdado: o
      // navegador de cada pessoa da equipe pede um favicon ao Google para
      // CADA link recomendado, e nesse pedido vai o dominio do link. Ou
      // seja, o Google fica sabendo o que a agencia anda indicando
      // internamente. Para fechar, e tirar o `<img>` de
      // `recomendacoes/cartao.tsx` -- o cartao ja tem o dominio escrito por
      // extenso embaixo do titulo, entao o icone e enfeite, nao informacao.
      // -------------------------------------------------------------------
      `img-src 'self' data: blob: https://www.google.com ${supabase}`,
      `connect-src 'self' ${supabase} ${supabaseWs}`,
      // O upload manda o arquivo para o Storage do Supabase.
      `form-action 'self'`,
      // NINGUEM EMBUTE O FULL HUB NUM IFRAME. E a mesma coisa que o
      // X-Frame-Options logo abaixo diz, e os dois ficam: navegador antigo
      // ignora `frame-ancestors` e obedece o header.
      "frame-ancestors 'none'",
      // A Academy INCORPORA video do YouTube e do Vimeo, e so deles: o
      // `modoDeAbrir()` manda o resto para aba nova justamente porque iframe
      // de terceiro quebra login e cookie.
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          // A plataforma e interna: nao deve aparecer em buscadores.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Content-Security-Policy", value: csp },
          // Dois anos, subdominios incluidos. O painel so e servido por
          // HTTPS; sem HSTS, a PRIMEIRA visita de cada navegador ainda pode
          // ser interceptada em texto claro.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // `strict-origin-when-cross-origin`: um link para fora leva o
          // dominio, nunca o caminho. O caminho carrega id de cliente e de
          // campanha, e material de campanha tem link para fora com
          // frequencia.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // O produto nao usa camera, microfone nem localizacao em lugar
          // nenhum. Desligar o que nao se usa e o que faz um XSS futuro ter
          // menos com o que trabalhar.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
