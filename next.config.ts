import type { NextConfig } from "next";

import { ROTAS_RENOMEADAS } from "./src/lib/auth/permissions";

const nextConfig: NextConfig = {
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
