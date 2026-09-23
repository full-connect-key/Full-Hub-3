#!/usr/bin/env bash
#
# Roda a bateria inteira contra um Postgres 16 de verdade, do zero.
#
#   supabase/testes/rodar.sh [nome_do_banco]
#
# Precisa de um Postgres alcancavel. Configure pelo ambiente do psql:
#
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=... \
#     supabase/testes/rodar.sh
#
# O banco e APAGADO E RECRIADO a cada rodada -- a bateria precisa comecar
# sempre do mesmo lugar, senao um cenario passa por causa de uma linha que
# sobrou da rodada anterior.
#
# A ORDEM NAO E ALFABETICA, e e por isso que este arquivo existe:
#
#   1. o fixture, que finge o `auth` e o `storage` do Supabase;
#   2. as migrations ATE a 0006;
#   3. os dados de teste -- eles precisam existir antes da 0007, que e a
#      migration que converte o modelo antigo de task no novo. Rodar a 0007
#      num banco vazio nao prova que a conversao preserva o que ja havia;
#   4. o resto das migrations;
#   5. a ferramenta de teste, e depois cada arquivo de cenario.
#
# Migration nova entra sozinha: o corte e pelo numero do arquivo, nao por uma
# lista escrita a mao que alguem esqueceria de atualizar.
#
set -Eeuo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BANCO="${1:-fullhub_bateria}"
LOG="${BATERIA_LOG:-$(mktemp -t bateria.XXXXXX.log)}"

# Ate esta migration (inclusive), depois entram os dados de teste.
CORTE="0006"

: > "$LOG"

psql -q -d postgres -c "drop database if exists $BANCO" >>"$LOG" 2>&1
psql -q -d postgres -c "create database $BANCO"         >>"$LOG" 2>&1

rodar() {
  if ! psql -q -v ON_ERROR_STOP=1 -d "$BANCO" -f "$1" >>"$LOG" 2>&1; then
    echo "ERRO em $(basename "$1")"
    tail -30 "$LOG"
    exit 1
  fi
}

numero() { basename "$1" | cut -c1-4; }

rodar "$RAIZ/supabase/testes/_fixture_supabase.sql"

# `if` e nao `[ ... ] && rodar`: sob `set -e` a lista com && tem uma excecao
# que depende de qual comando falhou, e uma regra que precisa ser lembrada
# para o script estar certo e uma regra que alguem vai esquecer.
for f in "$RAIZ"/supabase/migrations/*.sql; do
  if [ "$(numero "$f")" \< "$CORTE" ] || [ "$(numero "$f")" = "$CORTE" ]; then
    rodar "$f"
  fi
done

rodar "$RAIZ/supabase/testes/_dados_de_teste.sql"

for f in "$RAIZ"/supabase/migrations/*.sql; do
  if [ "$(numero "$f")" \> "$CORTE" ]; then
    rodar "$f"
  fi
done

rodar "$RAIZ/supabase/testes/00_ferramenta.sql"

# `[0-9][0-9]_` e nao `0[1-9]_`: o glob antigo casava de 01 a 09 e teria
# PULADO EM SILENCIO o 10_ do proximo sprint -- a bateria continuaria dizendo
# "todos passaram" com um arquivo inteiro de cenarios fora da conta. Foi um
# teste proposital de falha que mostrou isso, e nao a leitura do glob.
CENARIOS=0
for f in "$RAIZ"/supabase/testes/[0-9][0-9]_*.sql; do
  case "$(basename "$f")" in
    00_*) continue ;;   # a ferramenta ja rodou acima
  esac
  rodar "$f"
  CENARIOS=$((CENARIOS + 1))
done

if [ "$CENARIOS" -eq 0 ]; then
  echo "Nenhum arquivo de cenario foi encontrado. Isto e um erro, nao um sucesso."
  exit 1
fi

echo "$CENARIOS arquivo(s) de cenario."

echo "--- resultado ---"
psql -d "$BANCO" -c \
  "select situacao, count(*) from teste.resultado group by situacao order by 1"

FALHAS="$(psql -At -d "$BANCO" -c \
  "select count(*) from teste.resultado where situacao <> 'passou'")"

if [ "$FALHAS" != "0" ]; then
  psql -d "$BANCO" -c \
    "select descricao, detalhe from teste.resultado where situacao <> 'passou'"
  echo
  echo "$FALHAS cenario(s) reprovaram."
  exit 1
fi

echo "Todos passaram."
