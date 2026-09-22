# Banco de dados

Todo o SQL do projeto fica versionado em `migrations/`, em ordem numérica.
Assim o banco pode ser recriado do zero a qualquer momento, e qualquer pessoa
da equipe vê o histórico de mudanças do schema.

| Arquivo | O que faz |
| --- | --- |
| `0001_perfis.sql` | Primeira versão, com a tabela `perfis`. Mantida só pelo histórico. |
| `0002_estrutura_base.sql` | Estrutura do produto. Migra o que existir da 0001 e remove a tabela antiga. |
| `0003_equipe_e_clientes.sql` | Enum `team_funcao`, colunas de RH e de cliente, `is_atendimento()` e o bucket de avatares. |
| `0004_tasks.sql` | Tasks, subtarefas, referências e comentários, com `pode_editar_task()` e o bucket privado `task-arquivos`. |
| `0005_escrita_e_permissoes.sql` | Policies separadas por comando (INSERT/UPDATE/DELETE), DELETE só de sócio, o cliente editando o próprio contato e o trigger de criação de perfil que não derruba mais o cadastro. |
| `seed.sql` | 6 pessoas na equipe, 3 usuários de cliente, 3 empresas e os vínculos. |

Rode na ordem: `0002`, `0003`, `0004`, `0005`. A `0001` só interessa a quem
aplicou a primeira versão. Todas podem rodar mais de uma vez.

## Aplicando uma migration

**Pelo painel (mais simples):** Supabase > SQL Editor > New query > cole o
arquivo **inteiro** > Run.

> Não deixe texto selecionado no editor: quando há uma seleção, o Supabase roda
> só ela. Rodar um trecho do meio produz erros do tipo
> `relation "public.<tabela>" does not exist`, porque as tabelas são criadas no
> início do arquivo. As migrations são idempotentes, então basta rodar o
> arquivo completo de novo.

**Pela CLI:**

```bash
npx supabase login
npx supabase link --project-ref <referência-do-projeto>
npx supabase db push
```

Depois de aplicar, regenere os tipos para o TypeScript acompanhar o schema:

```bash
npx supabase gen types typescript --linked > ../src/lib/supabase/database.types.ts
```

## O que a 0002 cria

| Objeto | Para que serve |
| --- | --- |
| `user_role` | Enum com os quatro perfis: cliente, colaborador, desenvolvedor, socio |
| `profiles` | Uma linha por usuário, ligada 1-para-1 com `auth.users` |
| `clients` | Empresas atendidas pela agência |
| `client_users` | Vínculo N:N entre usuários cliente e empresas |
| `team_members` | Dados de RH da equipe interna |
| `handle_new_user()` + trigger | Cria o profile sozinho quando alguém é cadastrado |
| `protect_profile_role()` + trigger | Impede que alguém mude o próprio perfil de acesso |
| `auth_role()`, `is_staff()`, `is_gestor()`, `is_socio()`, `my_client_ids()` | Base de todo o RLS |
| `is_atendimento()` (0003) | Atendimento mais gestão — quem pode criar tasks |
| `pode_editar_task(id)` (0004) | Atendimento, gestão ou o responsável pela task |
| policies | Quem lê e quem escreve em cada tabela. A partir da 0005 são uma por comando: `clients_insert`, `clients_update_gestor`, `clients_update_proprio`, `clients_delete`, e assim por diante. Policy de SELECT sozinha bloqueia a escrita sem dar erro — o `update` simplesmente não encontra a linha. |
| `protect_client_columns()` + trigger (0005) | O usuário cliente edita só `nome_contato`, `email_contato` e `telefone` da própria empresa |

O Supabase guarda e-mail e senha em `auth.users`, que é tabela dele e não deve
ser alterada. Tudo que é "nosso" sobre a pessoa fica em `public.profiles`.

## Quem alcança o quê

| Tabela | Leitura | Criar | Editar | Apagar |
| --- | --- | --- | --- | --- |
| `profiles` | o próprio registro; `is_gestor()` lê todos | só o trigger de cadastro | o próprio registro ou `is_gestor()`; `role` só por `is_socio()` | ninguém (cai junto com `auth.users`) |
| `clients` | `is_staff()`; cliente vê só as de `my_client_ids()` | `is_gestor()` | `is_gestor()`; o cliente edita só o contato da própria empresa | `is_socio()` |
| `client_users` | `is_gestor()`; cliente vê só as próprias linhas | `is_gestor()` | `is_gestor()` | `is_gestor()` |
| `team_members` | `is_staff()` | `is_gestor()` | `is_gestor()` | `is_socio()` |

Cliente não alcança `team_members` de forma nenhuma.

A diferença entre editar e apagar é de propósito: desativar é o caminho normal
e a gestão resolve sozinha; apagar destrói histórico e fica só com o sócio — e
a aplicação ainda barra quando existe qualquer vínculo.

## Por que `security definer` nas funções

`is_staff()` e as outras consultam `profiles`. Se rodassem com as permissões de
quem chamou, o Postgres avaliaria o RLS de `profiles` para responder — e o RLS
de `profiles` chama essas funções. Loop infinito. `security definer` faz a
função rodar com os privilégios de quem a criou, quebrando o ciclo.

O mesmo vale para `handle_new_user()`: ela roda no instante do cadastro, quando
ainda não existe sessão para o RLS avaliar.

## Por que as funções são todas `plpgsql`

O Postgres valida o corpo de uma função `language sql` na hora de criá-la. Se a
função mencionar uma tabela que ainda não existe, o `create function` falha —
mesmo que a tabela venha a ser criada logo em seguida. Funções `plpgsql` têm o
corpo verificado só na primeira execução, o que torna a migration imune a
problemas de ordem e a execuções parciais.

## Promovendo alguém

```sql
update public.profiles set role = 'socio'
where email = 'pessoa@fullconnectkey.com.br';
```

Funciona no SQL Editor porque ali não existe sessão de usuário (`auth.uid()` é
nulo) e o trigger de proteção libera a mudança. A mesma linha rodando em nome
de um usuário logado comum não teria efeito sobre `role` — que é exatamente a
intenção.

## Cadastro aberto precisa ficar desligado

O trigger lê o perfil pedido em `raw_user_meta_data`, que é preenchido por quem
se cadastra. Isso é o que permite criar uma pessoa já com o perfil certo pelo
painel. Mas, se o cadastro aberto for ligado em **Authentication > Providers**,
qualquer pessoa poderia pedir `socio` no próprio cadastro.

Mantenha o cadastro desligado. Usuários são criados pela equipe, em
**Authentication > Users**. `raw_app_meta_data`, que só o admin escreve, tem
prioridade sobre `raw_user_meta_data` na leitura do perfil.

## Regra para toda tabela nova

```sql
alter table public.<tabela> enable row level security;
```

Sem isso, a tabela fica legível por qualquer pessoa que tenha a chave `anon` — e
essa chave vai no bundle que o navegador baixa, então considere que todo mundo
tem. Com RLS ligado e nenhuma policy, ninguém lê nada: cada policy abre uma
exceção específica. Sempre comece fechado e abra o necessário.

Um teste rápido depois de criar a tabela:

```bash
curl -s "https://<referência>.supabase.co/rest/v1/<tabela>?select=*" \
  -H "apikey: <chave-anon>"
```

Se isso devolver linhas sem você estar logado, o RLS não está protegendo a
tabela.

## Convenções

- Nomes de tabelas e colunas em inglês (`profiles`, `created_at`); a interface
  e os identificadores do app em português.
- `uuid` como chave primária em tudo.
- Datas em `timestamptz` — guarda o fuso e evita confusão no horário de verão.
- Preferir desativar (`ativo = false`) a apagar registros, para não perder o
  histórico.
- Migrations precisam poder rodar mais de uma vez sem erro.
