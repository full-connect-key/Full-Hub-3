/**
 * Configuracao do PM2 -- o gerenciador que mantem o dashboard rodando na VPS.
 *
 * O PM2 reinicia o processo se ele cair e sobe tudo de novo depois de um
 * reboot da maquina (desde que voce tenha rodado `pm2 startup` e `pm2 save`).
 *
 * Na VPS:
 *   npm ci && npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: "full-hub",
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3000",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // As variaveis sensiveis ficam no .env.local da VPS, que o Next le
      // sozinho -- assim nenhuma credencial precisa entrar neste arquivo,
      // que vai para o repositorio.
      error_file: "logs/erro.log",
      out_file: "logs/saida.log",
      time: true,
    },
  ],
};
