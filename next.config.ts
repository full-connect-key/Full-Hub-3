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

  // A plataforma e interna: nao deve aparecer em buscadores.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
