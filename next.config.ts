import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Habilita forbidden(), que devolve HTTP 403 de verdade quando alguem
    // tenta abrir uma area que nao e do seu perfil. Sem isso so daria para
    // mostrar uma tela bonita com status 200, o que engana monitoramento e
    // ferramentas de auditoria.
    authInterrupts: true,
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
