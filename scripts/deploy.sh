#!/usr/bin/env bash
#
# Deploy do Full Hub na VPS.
#
# Roda NA VPS, chamado pelo GitHub Actions por SSH -- ou na mao, se preferir:
#
#   /var/www/full-hub/scripts/deploy.sh
#   /var/www/full-hub/scripts/deploy.sh --reverter    volta para o build anterior
#
# O QUE ELE NAO FAZ, e de proposito:
#
#   NAO roda migration. Schema de banco nao se aplica sozinho junto com um
#   push: uma migration que falha no meio deixa o banco num estado que o
#   proximo deploy nao conserta, e ninguem estava olhando. As migrations
#   continuam indo a mao pelo SQL Editor, na ordem, por quem decidiu aplica-las.
#
#   NAO toca no .env.local. Ele vive so na VPS e nunca vem do repositorio.
#
# Variaveis que dao para trocar:
#   FULL_HUB_DIR     onde o projeto esta         (padrao /var/www/full-hub)
#   FULL_HUB_BRANCH  de qual ramo puxar          (padrao main)
#
set -Eeuo pipefail

PASTA="${FULL_HUB_DIR:-/var/www/full-hub}"
RAMO="${FULL_HUB_BRANCH:-main}"
APP="full-hub"
NOVO=".next-novo"
ANTERIOR=".next-anterior"

cd "$PASTA"

dizer() { printf '\n==> %s\n' "$*"; }

# ---------------------------------------------------------------------------
# Um deploy por vez.
#
# Dois pushes seguidos disparam duas Actions, e as duas chegam aqui. Sem a
# trava, uma faria `npm ci` enquanto a outra constroi -- e o resultado seria
# um build feito com metade das dependencias de cada versao.
# ---------------------------------------------------------------------------
exec 9>"$PASTA/.deploy.lock"
if ! flock -n 9; then
  echo "Outro deploy esta rodando. Saindo sem fazer nada."
  exit 75   # EX_TEMPFAIL: a Action mostra como falha, e e so tentar de novo
fi

# ---------------------------------------------------------------------------
# Reverter
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--reverter" ]; then
  if [ ! -d "$ANTERIOR" ]; then
    echo "Nao existe build anterior para voltar."
    exit 1
  fi
  dizer "Voltando para o build anterior"
  rm -rf .next.descartado
  mv .next .next.descartado
  mv "$ANTERIOR" .next
  if [ -f .deploy-commit-anterior ]; then
    git reset --hard "$(cat .deploy-commit-anterior)"
    npm ci --no-audit --no-fund
  fi
  pm2 reload "$APP" --update-env
  rm -rf .next.descartado
  echo "Pronto. O painel voltou para a versao anterior."
  exit 0
fi

# ---------------------------------------------------------------------------
# 1. Puxar o codigo
# ---------------------------------------------------------------------------
ANTES="$(git rev-parse HEAD)"

dizer "Buscando $RAMO"
git fetch --prune origin "$RAMO"

DEPOIS="$(git rev-parse "origin/$RAMO")"

if [ "$ANTES" = "$DEPOIS" ] && [ -d .next ]; then
  echo "Ja esta em $(git rev-parse --short "$DEPOIS"). Nada a fazer."
  exit 0
fi

# `reset --hard` e nao `pull`: a VPS e destino de deploy, nao lugar de
# editar arquivo. Se alguem mexeu em algo por SSH, o certo e essa mudanca
# ser descartada e aparecer no repositorio -- nao sobreviver calada e fazer
# a VPS servir um codigo que nao existe em lugar nenhum.
git reset --hard "origin/$RAMO"

# ---------------------------------------------------------------------------
# 2. Dependencias
# ---------------------------------------------------------------------------
dizer "Instalando dependencias"
npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# 3. Build numa pasta separada
#
# O `.next` que esta no ar nao e tocado. Se o build falhar -- e a causa mais
# comum numa VPS pequena e falta de memoria, nao codigo errado --, o painel
# continua servindo a versao anterior e a Action fica vermelha.
# ---------------------------------------------------------------------------
dizer "Construindo em $NOVO"
rm -rf "$NOVO"
NEXT_DIST_DIR="$NOVO" npm run build

if [ ! -d "$NOVO" ]; then
  echo "O build terminou sem erro mas nao gerou $NOVO. Abortando."
  exit 1
fi

# O Next reescreve o tsconfig.json durante o build, acrescentando o caminho
# de tipos do distDir da vez -- entao depois desta linha a arvore esta suja
# com uma referencia a "$NOVO". Nao e problema: o proximo deploy comeca com
# `reset --hard`. Mas e por isso que `git status` na VPS nunca aparece limpo,
# e nao ha nada para consertar ai.
git checkout -- tsconfig.json 2>/dev/null || true

# ---------------------------------------------------------------------------
# 4. A troca
#
# Aqui sim o .next muda, e sao dois `mv` numa mesma particao: renomear
# diretorio e operacao de metadados, da ordem de milissegundos.
# ---------------------------------------------------------------------------
dizer "Trocando o build"
rm -rf "$ANTERIOR"
if [ -d .next ]; then
  mv .next "$ANTERIOR"
  echo "$ANTES" > .deploy-commit-anterior
fi
mv "$NOVO" .next

# ---------------------------------------------------------------------------
# 5. Reiniciar
#
# `reload` e nao `restart`: em modo cluster ele troca os processos um a um e
# ninguem ve. Com `instances: 1` em modo fork -- que e a configuracao atual --
# o reload e um restart mesmo, com um ou dois segundos de indisponibilidade.
# Para uma ferramenta interna isso e aceitavel; o README explica como subir
# para duas instancias se um dia nao for.
# ---------------------------------------------------------------------------
dizer "Recarregando o PM2"
if pm2 describe "$APP" > /dev/null 2>&1; then
  pm2 reload "$APP" --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save --force > /dev/null

dizer "Deploy concluido"
echo "  de   $(git --no-pager log -1 --format=%h%x20%s "$ANTES" 2>/dev/null || echo "$ANTES")"
echo "  para $(git --no-pager log -1 --format=%h%x20%s HEAD)"
echo
echo "Se alguma migration nova entrou neste deploy, ela AINDA NAO FOI"
echo "aplicada -- rode no SQL Editor do Supabase, na ordem."
