import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O dashboard e uma ferramenta interna: nao deve aparecer em buscadores.
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
