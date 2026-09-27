#!/usr/bin/env bash
#
# AS ROTINAS DIÁRIAS DO FULL HUB, num lugar só.
#
# ---------------------------------------------------------------------------
# NADA NO PRODUTO RODAVA SOZINHO, e duas funções esperavam por isso desde 2026:
# `gerar_recorrencias()` (0040) e `limpar_rascunhos_abandonados()` (0028). As
# duas existem, funcionam e nunca tiveram quem as chamasse — o agendamento era
# de um sprint que perdeu a VPS antes de acontecer. Sem a primeira, o módulo de
# recorrências é decorativo: a regra guarda a cadência, a prévia mostra as
# cinco próximas, e a demanda só nasce se alguém abrir a regra e clicar.
#
# **O AGENDAMENTO NÃO PRECISA DE MÁQUINA**, e é isso que o traz de volta depois
# da VPS: é uma chamada HTTP ao PostgREST. Quem a agenda é
# `.github/workflows/rotinas.yml`, que chama ESTE arquivo — a mesma decisão do
# `verificar.yml` ser chamado pelo deploy em vez de copiado: uma cópia da
# rotina envelhece em silêncio, e a que roda de madrugada é justamente a que
# ninguém olha.
#
# À MÃO, para ver o que ela faria:
#   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
#     bash scripts/rodar-rotinas.sh
# ---------------------------------------------------------------------------
set -euo pipefail

: "${SUPABASE_URL:?falta SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?falta SUPABASE_SERVICE_ROLE_KEY}"

base="${SUPABASE_URL%/}/rest/v1/rpc"
# O `-` no fim de `--config` faz o curl ler os cabeçalhos da ENTRADA PADRÃO, e
# é o que mantém a chave fora da linha de comando: `ps` de qualquer processo na
# máquina lê argumento de outro, e o log do Actions ecoa o comando que falhou.
cabecalhos=$(printf 'header = "apikey: %s"\nheader = "Authorization: Bearer %s"\n' \
  "$SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY")

falhou=0

# ---------------------------------------------------------------------------
# chamar <função> <rótulo>
#
# **A ROTINA NÃO PODE FALHAR CALADA**, que é a regra do produto aplicada a um
# lugar sem tela: aqui não há ninguém para ler um toast. O código HTTP é
# conferido, o corpo da resposta vai para o log, e um erro sai como
# `::error::` — que o GitHub mostra na cara do commit e manda por e-mail.
# ---------------------------------------------------------------------------
chamar() {
  local funcao="$1" rotulo="$2" corpo codigo
  echo "→ $rotulo"

  # `-o` e `-w` separados em vez de `--fail`: com `--fail` o curl descarta o
  # corpo, e o corpo é onde o PostgREST escreve o motivo da recusa — "permission
  # denied for function" é a resposta que se vai procurar aqui, e ela viria em
  # branco.
  corpo=$(printf '%s' "$cabecalhos" | curl -sS --config - \
    -X POST "$base/$funcao" \
    -H "Content-Type: application/json" \
    -d '{}' \
    -w $'\n%{http_code}' \
    --max-time 300) || {
      echo "::error title=$rotulo::a chamada não completou (rede, DNS ou tempo esgotado)"
      falhou=1
      return
    }

  codigo=$(printf '%s' "$corpo" | tail -n1)
  corpo=$(printf '%s' "$corpo" | sed '$d')

  if [ "$codigo" != "200" ]; then
    echo "::error title=$rotulo::o Postgres recusou (HTTP $codigo): $corpo"
    falhou=1
    return
  fi

  echo "  $corpo"
  printf -- "- **%s** — HTTP 200\n\n\`\`\`json\n%s\n\`\`\`\n\n" \
    "$rotulo" "$corpo" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

  # UMA REGRA QUE FALHA NÃO DERRUBA AS OUTRAS DEZENOVE — o `exception` de
  # `gerar_recorrencias()` fica DENTRO do laço, de propósito, e o erro vira
  # linha no histórico daquela regra. A consequência é que a chamada devolve
  # HTTP 200 com o estrago dentro, e sem esta leitura o Actions ficaria verde
  # numa madrugada em que nada nasceu.
  if printf '%s' "$corpo" | grep -q '"erro"[[:space:]]*:[[:space:]]*"'; then
    echo "::error title=$rotulo::alguma regra falhou — o motivo está no corpo acima e no histórico dela"
    falhou=1
  fi
}

# A ORDEM É ESTA: gerar primeiro. A limpeza apaga rascunho parado há sete dias e
# a geração cria demanda publicada — não se cruzam —, mas se a segunda falhar, a
# primeira já aconteceu. Invertida, uma falha na limpeza atrasaria em um dia o
# stories de segunda.
chamar gerar_recorrencias "Gerar as demandas recorrentes do dia"
chamar limpar_rascunhos_abandonados "Apagar rascunhos parados há mais de 7 dias"

exit "$falhou"
