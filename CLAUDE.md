@AGENTS.md

# Full Hub / Full Flow

Plataforma interna da agência **Full Connect Key**.

## O produto

Uma única aplicação, um único banco de dados, duas áreas:

| Área | Quem usa | Rota |
| --- | --- | --- |
| **Painel Interno** | equipe da agência | `/painel` |
| **Portal do Cliente** | clientes da agência | `/portal` |

As duas leem e escrevem nas mesmas tabelas. O que separa uma da outra não é o
banco: é o perfil de acesso da pessoa, aplicado pelo Row Level Security do
Postgres e reforçado no servidor a cada página.

**O Full Hub é o sistema único da agência.** Não existe integração com Trello,
ClickUp ou qualquer ferramenta externa de gestão. Nunca cite essas ferramentas
na interface, em texto de ajuda ou em nome de campo.

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| Estilo | Tailwind CSS v4 + shadcn/ui (tema neutro, claro e escuro) |
| Backend | Supabase: Auth, Postgres com RLS, Storage, Realtime |
| Formulários | react-hook-form + zod |
| Datas | date-fns com locale pt-BR |
| Ícones | lucide-react |

> **Sobre a versão do Next:** o sprint pedia Next.js 15; o projeto está no 16,
> que é a versão estável atual. A diferença que aparece no código: o arquivo
> `middleware.ts` passou a se chamar `proxy.ts`, com a mesma função. É por isso
> que a renovação de sessão vive em `src/proxy.ts` e não em `middleware.ts`.

## Os quatro perfis de acesso

O tipo `user_role` no banco, e `src/lib/auth/roles.ts` no código.

| Perfil | Área | O que alcança |
| --- | --- | --- |
| `cliente` | Portal | Apenas as empresas às quais está vinculado em `client_users`. Não enxerga nada da equipe. |
| `colaborador` | Painel | Acesso operacional: lê clientes e a equipe, edita o próprio perfil. |
| `desenvolvedor` | Painel | Tudo do colaborador mais gestão: cadastra clientes, vínculos e dados de equipe. |
| `socio` | Painel | Acesso total. **É o único que altera o perfil de acesso de outra pessoa.** |

Funções SQL que traduzem isso, reutilizadas por todo o RLS:

| Função | Verdadeira para |
| --- | --- |
| `auth_role()` | devolve o perfil de quem está logado (null se inativo) |
| `is_staff()` | colaborador, desenvolvedor, socio |
| `is_gestor()` | desenvolvedor, socio |
| `is_socio()` | socio |
| `my_client_ids()` | ids das empresas do cliente logado |
| `is_atendimento()` | quem está no Atendimento, mais a gestão |

### Regra da função Atendimento

`team_members.funcao` é o enum `team_funcao`: Atendimento, Social Media,
Redator, Design, Audiovisual, Trafego, Desenvolvimento, Gestao, Outro.

**Quem tem `funcao = 'Atendimento'` pode criar tasks mesmo sendo
`colaborador`.** Perfil de acesso e função na agência são coisas diferentes:
o perfil diz o que a pessoa alcança na plataforma, a função diz o que ela faz
no dia a dia.

A regra mora na função SQL `is_atendimento()` — verdadeira para quem está no
Atendimento **ou** para gestão. Nenhum módulo deve repetir essa consulta.

### Timeout de sessão

Só o perfil `cliente` cai por inatividade: aviso aos 28 minutos, saída aos 30.
Ele acessa de fora da agência, às vezes de um computador compartilhado. Os
perfis internos ficam o dia todo no sistema e não têm esse timeout.

## Convenções

**Banco**

- Todo SQL vive em `supabase/migrations/`, numerado e versionado. Nada de
  alterar schema direto pelo painel do Supabase: o que não está em migration
  não existe para o próximo ambiente.
- **RLS é obrigatório em toda tabela nova.** `alter table ... enable row level
  security` mais as policies, na mesma migration que cria a tabela. Sem isso a
  tabela fica legível por qualquer pessoa com a chave anon — e essa chave vai
  no bundle que o navegador baixa.
- Policies chamam `is_staff()`, `is_gestor()`, `is_socio()` e `my_client_ids()`
  em vez de repetir a consulta.
- Funções SQL em `plpgsql`, não `language sql`: o Postgres valida o corpo de
  uma função `sql` na hora de criá-la, o que quebra a migration se a tabela
  citada ainda não existir.
- `uuid` como chave primária, `created_at timestamptz not null default now()`.
- Migrations precisam poder rodar mais de uma vez sem erro.

**Código**

- Toda a interface em **português do Brasil**, com acento.
- Idioma dos identificadores, por camada:
  - **inglês** — nomes de tabela e coluna (`profiles`, `created_at`), a API dos
    componentes de `components/ui/` e `components/shared/` (`DataTable`,
    `PageHeader`, props `title`/`columns`) e `lib/auth/permissions.ts`
    (`canAccess`, `getMenuForRole`), porque são camadas genéricas;
  - **português** — todo o resto: rotas, componentes de domínio, funções,
    variáveis.
- Datas sempre com `date-fns` e locale `ptBR`. Nada de `toLocaleDateString`
  espalhado.
- Formulários com react-hook-form + zod. O mesmo esquema zod valida no
  navegador e de novo na server action — validação de navegador não protege
  nada.
- No servidor, sempre `supabase.auth.getUser()`, nunca `getSession()`:
  `getSession` só lê o cookie, que o navegador pode ter adulterado.
- Proteção de rota no servidor, não no menu. Esconder o link não é segurança.
- **Nenhuma escrita pode falhar em silêncio.** Toda Server Action devolve
  `{ ok: true, mensagem }` ou `{ ok: false, error }` com a mensagem real do
  Supabase, envolvida por `executarAcao()` de `lib/acoes/resultado.ts`, que
  loga o erro completo no console do servidor. Na tela, `chamarAcao()` de
  `lib/acoes/cliente.ts` embrulha a chamada para nem a queda do servidor
  passar batida. Action **nunca** chama `forbidden()`: dentro de uma action o
  403 vira promise rejeitada e some — use as guardas de `lib/acoes/guardas.ts`.
- **Escrita que o RLS pode barrar termina com `.select()`.** Sem isso, um
  `update` bloqueado volta sem erro e sem linha, e a tela diz "salvo" à toa.
  Se não voltou linha, é recusa — e a mensagem precisa dizer isso.
- **Criar usuário só em Server Action do servidor**, com a chave de serviço
  (`app/(interno)/painel/_actions/usuarios.ts`). Essa chave ignora todo o RLS
  e nunca pode chegar ao navegador: ela é lida em `lib/supabase/admin.ts`, que
  tem `import "server-only"` — e não em `lib/env.ts`, que o navegador carrega.
  O resto usa Server Actions com o cliente do próprio usuário, para o RLS
  continuar valendo.
- **Criar conta não depende de e-mail.** `createUser` primeiro, envio do link
  de senha depois. `inviteUserByEmail` faz o contrário: se o e-mail não sai
  — e sem SMTP próprio o Supabase entrega pouquíssimo —, a conta não é criada
  e o cadastro se perde. Quando o envio falha, a tela mostra o link para a
  equipe passar pela mão.
- **Criação em vários passos tem rollback.** Se a ficha falha depois da conta
  criada, a conta é apagada. Cadastro pela metade é pior que nenhum: o e-mail
  fica ocupado e ninguém entende por quê.
- **Pessoa e cliente nunca são apagados quando têm histórico.** Desligar é
  `ativo = false` mais revogação do acesso; o nome continua nos registros
  antigos, porque é isso que preserva a autoria do que foi feito.
- `DateBadge` é para prazo. Data que só registra quando algo aconteceu
  (admissão, cadastro, último acesso) se formata com date-fns — senão o
  passado aparece em vermelho como se fosse atraso.
- **Função não atravessa a fronteira servidor/cliente.** Uma função pura que
  os dois lados usam vai para `lib/dominio/`; `lib/dados/` é `server-only` e o
  que sai de lá são dados, nunca funções.
- Filtro e visualização de tela de listagem moram na URL, não em estado: o
  link precisa ser compartilhável e sobreviver à troca de visualização.
- Permissão e menu saem de `src/lib/auth/permissions.ts`, e só de lá. Nunca
  escreva `if (role === "socio")` numa tela: acrescentar um módulo é
  acrescentar uma linha em `MENU`.
- Componente novo que vários módulos vão usar vai para `components/shared/` e
  ganha uma seção em `/painel/dev/componentes`.
- Feedback de ação com `toast` (sonner), nunca `alert()`.
- Carregamento com `LoadingSkeleton`, nunca tela branca.

**Três camadas de proteção, e elas são independentes**

1. `src/proxy.ts` manda quem não tem sessão para o login.
2. `exigirEquipe()` / `exigirCliente()` no layout de cada área devolvem HTTP
   403 para quem está na área errada.
3. O RLS do Postgres decide o que cada um lê e escreve. Esta é a que vale de
   verdade: funciona mesmo que alguém chame a API do Supabase direto.

## Estrutura

```
src/
  proxy.ts                    Renova a sessão e barra quem não está logado
  app/
    (auth)/                   login, esqueci-senha, redefinir-senha
    (interno)/painel/         Painel Interno — exige equipe
    (cliente)/portal/         Portal do Cliente — exige cliente
    auth/callback/            Chegada dos links enviados por e-mail
    forbidden.tsx             Tela do HTTP 403
    status/                   Diagnóstico da conexão com o Supabase
    api/status/supabase/      O mesmo diagnóstico em JSON
  components/ui/              shadcn/ui
  components/shared/          Componentes do produto
  hooks/
  lib/auth/                   roles, DAL, actions, esquemas zod
  lib/acoes/                  contrato das Server Actions, guardas e contas
  lib/supabase/               clients, proxy, tipos, diagnóstico
supabase/migrations/          SQL versionado
supabase/seed.sql             9 usuários de teste, 3 empresas (uma desativada)
scripts/                      Verificação de conexão e gerador de protótipos
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe em desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` / `npm run typecheck` | Padrões e tipos |
| `npm run check:supabase` | Testa a conexão com o Supabase pelo terminal |
| `npm run prototipo` | Gera imagens das telas em `prototipos/` |

## Histórico de sprints

| Sprint | Entrega |
| --- | --- |
| Sprint 0 | Esqueleto: shadcn/ui com tema claro/escuro, login por e-mail e senha, recuperação de senha, os 4 perfis de acesso, tabelas `profiles` / `clients` / `client_users` / `team_members` com RLS, proteção de rota por perfil com HTTP 403, timeout de inatividade do portal, seed de desenvolvimento e homes vazias das duas áreas. |
| Correção do Sprint 2 | Gravação dos cadastros: criação de usuário virou Server Action com `createUser` + link de senha (não depende mais de SMTP) e rollback; policies de `clients`, `client_users` e `team_members` separadas por comando, com DELETE só de sócio; `profiles` passou a aceitar edição da gestão; usuário cliente ganhou UPDATE das próprias três colunas de contato, com trigger travando o resto; contrato `{ ok, error }` em todas as actions com erro real na tela e no log; exclusão de cliente bloqueada por qualquer vínculo; desligamento transferindo tasks em aberto de verdade; ativar/desativar colaborador pela gestão; seed com 6 colaboradores, 3 empresas e 3 acessos ao portal. |
| Sprint 3 | Gestão de Tasks: tabelas `tasks` / `subtasks` / `task_referencias` / `task_comentarios` com RLS por `pode_editar_task()`, board com arrastar e soltar otimista, lista com edição inline e ações em massa, calendário mensal e semanal mostrando prazo de task e de subtarefa separados, editor rico TipTap no briefing, detalhe em duas colunas com comentários e referências em bucket privado, filtros na URL e atalhos N e /. |
| Sprint 2 | Cadastro base: módulos Clientes e Equipe completos, criação de usuários no servidor com chave de serviço, convite de acesso ao portal, enum `team_funcao` com `is_atendimento()`, desligamento em duas etapas com transferência, exclusão de cliente em duas etapas bloqueada por vínculos, e Meu perfil com avatar no Storage. |
| Sprint 1 | Estrutura do dashboard: `lib/auth/permissions.ts` como fonte única do menu e das permissões, menu lateral colapsável com seções e gaveta no celular, topbar com trilha, busca (casca), sino e menu do usuário, 15 rotas placeholder validando o perfil no servidor, cor de marca em variável CSS, 10 componentes compartilhados com vitrine em `/painel/dev/componentes`, e o casco do Portal do Cliente com navegação superior. Nenhuma tabela nova. |
