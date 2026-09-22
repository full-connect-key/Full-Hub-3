# Banco de dados

Todo o SQL do projeto fica versionado em `migrations/`, em ordem numerica.
Assim o banco pode ser recriado do zero a qualquer momento, e qualquer pessoa
da equipe consegue ver o historico de mudancas do schema.

## Aplicando uma migration

**Pelo painel (mais simples):** Supabase > SQL Editor > New query > cole o
arquivo **inteiro** > Run.

> Nao deixe texto selecionado no editor: quando ha uma selecao, o Supabase roda
> so ela. Rodar um trecho do meio de uma migration produz erros do tipo
> `relation "public.<tabela>" does not exist`, porque as tabelas sao criadas no
> inicio do arquivo. As migrations daqui sao idempotentes, entao basta rodar o
> arquivo completo de novo.

**Pela CLI (melhor quando houver varias migrations):**

```bash
npx supabase login
npx supabase link --project-ref <referencia-do-projeto>
npx supabase db push
```

A referencia do projeto e a parte do meio da URL:
`https://<referencia>.supabase.co`.

Depois de aplicar, regenere os tipos para o TypeScript acompanhar o schema:

```bash
npx supabase gen types typescript --linked > ../src/lib/supabase/database.types.ts
```

## O que a 0001 cria

| Objeto | Para que serve |
| --- | --- |
| `public.perfis` | Dados da equipe: nome, cargo, papel. Ligada 1-para-1 com `auth.users` |
| `lidar_com_novo_usuario()` + trigger | Cria o perfil sozinho quando um usuario e cadastrado |
| `tocar_atualizado_em()` + trigger | Mantem a coluna `atualizado_em` sempre correta |
| `e_admin()` | Usada pelas policies para saber se quem pediu e administrador |
| `proteger_papel_do_perfil()` + trigger | Impede que alguem se promova a admin criando ou editando o proprio perfil |
| 5 policies de RLS | Cada pessoa le, cria e edita o proprio perfil; admin ve e edita todos |

O Supabase ja guarda e-mail e senha em `auth.users`, que e uma tabela dele e
nao deve ser alterada. Tudo que for "nosso" sobre a pessoa fica em
`public.perfis`.

## Por que `security definer` em algumas funcoes

`e_admin()` consulta a tabela `perfis`. Se ela rodasse com as permissoes de
quem chamou, o Postgres avaliaria o RLS de `perfis` para responder — e o RLS de
`perfis` chama `e_admin()`. Loop infinito. `security definer` faz a funcao
rodar com os privilegios de quem a criou, quebrando o ciclo.

O mesmo vale para `lidar_com_novo_usuario()`: ela roda no instante do cadastro,
quando ainda nao existe sessao para o RLS avaliar.

## Por que as funcoes sao todas `plpgsql`

O Postgres valida o corpo de uma funcao `language sql` na hora de cria-la. Se a
funcao mencionar uma tabela que ainda nao existe, o `create function` falha --
mesmo que a tabela va ser criada logo em seguida. Funcoes `plpgsql` tem o corpo
verificado so na primeira execucao, o que torna a migration imune a problemas
de ordem e a execucoes parciais.

## Promovendo alguem a admin

```sql
update public.perfis set papel = 'admin' where email = 'pessoa@suaagencia.com.br';
```

Funciona no SQL Editor porque ali nao existe sessao de usuario (`auth.uid()` e
nulo) e o trigger de protecao libera a mudanca. A mesma linha rodando em nome
de um usuario logado comum nao teria efeito sobre a coluna `papel` -- que e
exatamente a intencao.

## Regra para toda tabela nova

```sql
alter table public.<tabela> enable row level security;
```

Sem isso, a tabela fica legivel por qualquer pessoa que tenha a chave `anon` —
e essa chave vai no bundle que o navegador baixa, entao considere que todo
mundo tem. Com RLS ligado e nenhuma policy, ninguem le nada: cada policy abre
uma excecao especifica. Sempre prefira comecar fechado e abrir o necessario.

Um teste rapido depois de criar a tabela:

```bash
curl -s "https://<referencia>.supabase.co/rest/v1/<tabela>?select=*" \
  -H "apikey: <chave-anon>"
```

Se isso devolver linhas sem voce estar logado, o RLS nao esta protegendo a
tabela.

## Convencoes

- Nomes de tabelas e colunas em portugues, minusculo, com `_` (`nome_completo`).
- Datas sempre em `timestamptz` — guarda o fuso e evita confusao no horario de
  verao.
- Preferir desativar (`ativo = false`) a apagar registros, para nao perder o
  historico.
- `criado_em` e `atualizado_em` em toda tabela que representa algo do mundo real.
