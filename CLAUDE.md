@AGENTS.md

# Full Hub

Plataforma interna da agência **Full Connect Key**: Painel Interno (`/painel`,
equipe) e Portal do Cliente (`/portal`), um banco só, separados por perfil
(RLS + servidor). Nunca cite ferramenta externa de gestão na interface.

Histórico de decisões: `docs/decisoes.md` (enorme — **nunca leia inteiro nem
dê grep sem `cut -c1-200`**; procure pelo nome do módulo ou da migration).
Decisão nova se registra lá, em poucas linhas.

**Stack:** Next.js 16 App Router (`src/proxy.ts` é o middleware) · TS ·
Tailwind v4 + shadcn · Supabase (`xjgietgcrjkjaylhcscl`) · zod · date-fns
`ptBR` · lucide. Build: `next build --webpack`.

**Perfis:** `cliente` · `colaborador` · `desenvolvedor` · `socio`. SQL:
`is_staff()`, `is_gestor()`, `is_socio()`, `is_atendimento()`,
`my_client_ids()`. Menu e permissão saem de `src/lib/auth/permissions.ts`;
na tela pergunte ao banco, nunca `if (role === ...)`.

## Modelo

- Task agrupa; **subtarefa é a unidade** (responsável, prazo, tempo,
  aprovação). Três níveis; somas contam só folhas (`folhas()`).
- Aprovação: `approval_rounds (content_type, content_id)` para subtask, post
  e deliverable. Interna antes do cliente; ajuste e recusa exigem motivo.
- Rascunho de task = `publicada_em is null`.
- Social: o mês é uma demanda; aprovação por post. Campanha: cada peça
  (`deliverables`) é uma etapa (`lib/acoes/ponte-de-arquivos.ts`).
- Relatórios: `relatorios.blocos` jsonb (0159), `/painel/relatorios` e
  `/portal/relatorios`.
- O cliente só vê o ENVIADO/PUBLICADO — isso mora nas policies.
- Tempo em minutos; "hoje" é `hojeNaAgencia()` (`lib/dominio/datas.ts`).
- Equipe é PJ: sem vocabulário de CLT (day off, afastamento).

## Banco

- SQL só em `supabase/migrations/`, numerado e re-executável; RLS na mesma
  migration. Policy não limita coluna (isso é trigger).
- Funções em `plpgsql`; para alterar, copie a função inteira ou remende pelo
  catálogo. `revoke` de `public` e `anon` em `security definer`.
- Cada migration: linha em `scripts/onde-esta-o-banco.sql` (ou `-- SEM
  LINHA:`) e tipos à mão em `src/lib/supabase/database.types.ts`.
- O deploy NÃO aplica migration: aplique pelo MCP do Supabase.

## Código

- Interface em pt-BR com acento. Portal sem jargão interno (task,
  subtarefa, etapa, workflow).
- Server Action: `executarAcao()` + guardas de `lib/acoes/guardas.ts`,
  devolve `{ ok, mensagem | error }`; escrita termina com `.select()` e zero
  linhas é recusa. Na tela, `chamarAcao()` + `toast`.
- Leitura em `lib/dados/` (`server-only`) com `ouFalha()` e `.limit(1)`
  (nunca `maybeSingle` dentro dele). Módulo novo precisa de stub em
  `scripts/prototipo/` com as MESMAS assinaturas.
- Função pura compartilhada em `lib/dominio/`. Arquivo cliente só importa
  TIPO de módulo `server-only`.
- `getUser()`, nunca `getSession()`. Chave de serviço só em
  `lib/supabase/admin.ts`.
- Cor literal só em `globals.css`. URL assinada usa `ImagemAssinada`.
- Filtro de listagem mora na URL. Pessoa/cliente não se apaga: `ativo = false`.

## Antes de commitar

`npm run typecheck` · `npx eslint <arquivos>` · `check:cores` ·
`check:mensagens` · `check:migrations` · `check:tipos` · `check:acoes` ·
`check:fronteira` · `check:prototipo` · `npm run build`. Imagem de
conferência: `PROTOTIPO_SO=<nome> npm run prototipo`.

## Deploy

Hostinger publica o FORK `fullconnectkey/Full-Hub-3`, branch
`claude/determined-newton-22lfcy`. Após cada commit: push para a branch de
trabalho E para `claude/determined-newton-22lfcy`; o usuário faz **Sync fork
→ Update branch**. `main` só quando o usuário pedir. O rodapé mostra o commit
no ar.
