#!/usr/bin/env bash
#
# Junta as migrations que ainda nao foram aplicadas num arquivo so, para colar
# no SQL Editor do Supabase.
#
#   scripts/migrations-pendentes.sh 0019 0020 0021
#
# POR QUE ISTO EXISTE: o deploy NAO aplica migration, e isso e decisao do
# projeto -- uma migration que falha no meio deixa o banco num estado que o
# proximo deploy nao conserta, com ninguem olhando. Entao toda entrega que
# traz SQL novo termina com alguem colando SQL a mao, e sem isto esse alguem
# monta a colagem no olho: abre tres arquivos, copia na ordem errada, ou
# esquece um.
#
# A SAIDA NAO E VERSIONADA (`/pendentes/` no .gitignore). Ela e uma copia do
# que ja esta em supabase/migrations/, e copia de SQL versionado dentro do
# repositorio e a receita para alguem editar a copia.
#
# Para saber o que falta no banco: no SQL Editor, procure o que a migration
# cria. A 0019 e `select ... from information_schema.columns where
# table_name='profiles' and column_name='deve_trocar_senha'` -- zero linhas
# quer dizer que ela nao rodou.
set -Eeuo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SAIDA="$RAIZ/pendentes/aplicar-no-supabase.sql"

if [ "$#" -eq 0 ]; then
  echo "uso: scripts/migrations-pendentes.sh 0019 0020 0021" >&2
  echo >&2
  echo "migrations disponiveis:" >&2
  for f in "$RAIZ"/supabase/migrations/*.sql; do
    echo "  $(basename "$f")" >&2
  done
  exit 1
fi

# Confere TODAS antes de escrever qualquer coisa: um arquivo pela metade e
# pior do que nenhum, porque alguem cola o que tem.
for n in "$@"; do
  encontrados=("$RAIZ"/supabase/migrations/"$n"_*.sql)
  if [ ! -f "${encontrados[0]}" ]; then
    echo "Nao existe migration comecando em '$n'." >&2
    exit 1
  fi
  if [ "${#encontrados[@]}" -gt 1 ]; then
    echo "'$n' casou com mais de uma migration. Seja especifico." >&2
    exit 1
  fi
done

mkdir -p "$RAIZ/pendentes"

{
  echo "-- ==========================================================================="
  echo "-- APLICAR NO SQL EDITOR DO SUPABASE, DE UMA VEZ SO."
  echo "--"
  echo "-- O deploy nao aplica migration: schema vai a mao, por quem decidiu aplicar."
  echo "--"
  echo "-- Nesta colagem:"
  for n in "$@"; do
    echo "--   $(basename "$(echo "$RAIZ"/supabase/migrations/"$n"_*.sql)")"
  done
  echo "--"
  echo "-- Todas rodam mais de uma vez sem erro. Se alguma ja tiver sido aplicada,"
  echo "-- ela so avisa \"already exists, skipping\" e segue."
  echo "-- ==========================================================================="
  echo

  for n in "$@"; do
    arquivo="$(echo "$RAIZ"/supabase/migrations/"$n"_*.sql)"
    echo
    echo "-- ####################  $(basename "$arquivo")  ####################"
    echo
    cat "$arquivo"
    echo
  done

  cat <<'RODAPE'

-- ===========================================================================
-- Se o erro de "schema cache" continuar depois de aplicar
--
-- O Supabase costuma avisar o PostgREST sozinho quando o schema muda, mas
-- quando nao avisa a API continua respondendo com o schema velho -- e o
-- sintoma e exatamente "Could not find the 'x' column ... in the schema
-- cache", com a coluna JA existindo no banco. Esta linha forca o aviso.
-- ===========================================================================
notify pgrst, 'reload schema';
RODAPE
} > "$SAIDA"

echo "Pronto: ${SAIDA#"$RAIZ"/}"
echo "$(wc -l < "$SAIDA" | tr -d ' ') linhas, $# migration(s)."
