@AGENTS.md

# Full Hub

Plataforma interna da agência **Full Connect Key**: uma aplicação, um banco,
duas áreas — **Painel Interno** (`/painel`, equipe) e **Portal do Cliente**
(`/portal`). O que separa as duas é o perfil de acesso, aplicado pelo RLS do
Postgres e reforçado no servidor.

> **O histórico completo de decisões mora em `docs/decisoes.md`** (grande — não
> leia inteiro). Antes de mexer num módulo, procure nele com `grep` pelo nome
> do módulo, da tabela ou da migration (`0128`, `Day Off`, `approval_rounds`).
> Decisão nova de produto se registra LÁ, em poucas linhas, não aqui.

O Full Hub é o sistema único da agência: nunca cite ferramenta externa de
gestão (Trello, ClickUp…) na interface, em ajuda ou em nome de campo.

## Stack

Next.js 16 (App Router; `middleware.ts` chama-se `src/proxy.ts`) + TypeScript ·
Tailwind v4 + shadcn/ui · Supabase (Auth, Postgres com RLS, Storage, Realtime)
· react-hook-form + zod · date-fns `ptBR` · lucide-react. Build com
`next build --webpack`.

## Perfis e funções SQL

`cliente` (portal, só as empresas de `client_users`) · `colaborador` ·
`desenvolvedor` · `socio` (único que altera perfil de outra pessoa).

`auth_role()`, `is_staff()`, `is_gestor()` (desenvolvedor+sócio), `is_socio()`,
`my_client_ids()`, `is_atendimento()` (função Atendimento **ou** gestão — é
quem abre task, campanha, mês de social). Perfil de acesso ≠ função na agência
(`team_members.funcao`). Na tela, pergunte ao banco (`souDoAtendimento()`),
nunca `if (role === ...)`; menu e permissão saem de
`src/lib/auth/permissions.ts`.

## Modelo, em uma tela

- **Task agrupa, SUBTAREFA é a unidade de trabalho** (responsável, prazo,
  tempo, aprovação). `tasks` não tem responsável/prazo/estimativa. Três níveis
  (demanda → etapa → sub-etapa); quem tem filha vira agrupadora e toda soma
  conta só folhas (`folhas()`, `subtask_eh_agrupadora()`).
- Status da Task é calculado por trigger; marcar à mão liga `status_manual`.
- Aprovação: `approval_rounds (content_type, content_id)` para subtask, post e
  deliverable. Rodada interna antes da do cliente; rodada fechada não se
  reescreve; ajuste e recusa exigem motivo. Cores e rótulos em
  `lib/aprovacoes/decisoes.ts`.
- Rascunho de task = `publicada_em is null` (não é valor de enum).
- Social: o mês é UMA demanda (`tasks.social_do_mes`), fases são subtarefas
  (`social_papel`), o trabalho por peça é `post_etapa_progresso`; a aprovação é
  por post. Campanha: nasce com a demanda, cada peça (`deliverables`) é uma
  etapa; arquivo da etapa ⇄ versão da peça (`lib/acoes/ponte-de-arquivos.ts`).
- O cliente só vê material ENVIADO; isso mora nas policies, não nas consultas.
- Tempo em minutos (`lib/dominio/tempo.ts`); "hoje" é `hojeNaAgencia()`.
- Day Off: vocabulário sem termos da CLT (day off, afastamento, ausência
  pontual, "de acordo / preciso remarcar") — a equipe é PJ.

## Convenções

**Banco**
- Todo SQL em `supabase/migrations/`, numerado, re-executável. Nada pelo painel.
- RLS obrigatório em toda tabela nova, na mesma migration. Policies usam as
  funções acima. **Policy não limita coluna** — isso é trigger.
- Funções em `plpgsql`. `create or replace` não avisa quando o texto novo tem
  menos coisa: copie a função inteira, ou remende pelo catálogo
  (`pg_get_functiondef` + `replace` contado). Sem `$$` dentro de comentário.
- `revoke` de `public` **e** de `anon` em função `security definer`.
- Valor novo de enum não pode ser usado na mesma transação em que nasce.
- Cada migration ganha uma linha em `scripts/onde-esta-o-banco.sql` (ou um
  `-- SEM LINHA:` com motivo) e os tipos em `src/lib/supabase/database.types.ts`
  (escrito à mão). Migration que reverte regra reescreve os cenários de
  `supabase/testes/` no mesmo commit.
- Projeto Supabase: `xjgietgcrjkjaylhcscl`. O deploy NÃO aplica migration.

**Código**
- Interface em pt-BR com acento. Inglês só em tabela/coluna, `components/ui`,
  `components/shared` e `permissions.ts`.
- Server Action: `executarAcao()` + guardas de `lib/acoes/guardas.ts` (nunca
  `forbidden()`), devolve `{ ok, mensagem | error }`; escrita termina com
  `.select()` e zero linhas é recusa; validação via `recusaDeValidacao()`.
  Na tela, `chamarAcao()` e `toast`. Nenhuma escrita falha em silêncio.
- A guarda da action não pode ser mais apertada que o RLS.
- Leitura em `lib/dados/` (`server-only`) com `ouFalha()`; nunca
  `ouFalha(...maybeSingle())` — use `.limit(1)`. Evite embutidos do PostgREST.
- Função pura compartilhada vai em `lib/dominio/`. Valor de arquivo
  `"use client"` não vale no servidor, e valor de módulo `server-only` não entra
  em arquivo cliente (`import type` pode).
- `getUser()`, nunca `getSession()`. Chave de serviço só em
  `lib/supabase/admin.ts`.
- Cor literal só em `src/app/globals.css`; par nomeado, nunca opacidade em cor
  de estado ou de superfície. Caixa com borda tem `bg-` de repouso.
- URL assinada não passa por `next/image` — use `ImagemAssinada`.
- Filtro e visão de listagem moram na URL. Carregamento com `LoadingSkeleton`.
- Portal sem jargão interno ("task", "subtarefa", "etapa", "workflow").
  Nenhum texto de tela cita sprint ou vocabulário de desenvolvimento.
- Tela nova acrescenta os `data-tour` dela (`lib/tour/ancoras.ts`).
- Módulo novo de `lib/dados/` precisa de stub em `scripts/prototipo/`.
- Pessoa e cliente com histórico não se apagam: `ativo = false`.

## Verificação antes de commitar

`npm run typecheck` · `npm run lint` · `npm run check:cores` ·
`check:mensagens` · `check:migrations` · `check:tipos` · `check:acoes` ·
`check:fronteira` · `check:prototipo` · e `npm run build` (o CI bloqueia o
deploy se ele falhar). Bateria de SQL: `supabase/testes/rodar.sh` (Postgres 16
em `/usr/lib/postgresql/16/bin`, cluster em `/var/lib/postgresql/bateria`,
porta 5433).

## Deploy

Hospedagem Hostinger com Git do hPanel. Trabalho vai para a branch de
trabalho; produção sai da `main`, só quando o usuário pedir. O rodapé do
painel mostra o commit que está no ar.

## Estrutura

`src/app/(auth)` · `(interno)/painel` · `(cliente)/portal` ·
`components/{ui,shared,painel,portal}` · `lib/{auth,acoes,dados,dominio,tasks,tour,email,drive,supabase}` ·
`supabase/{migrations,testes,seed.sql}` · `scripts/`.
