-- ===========================================================================
-- 0139 - A BIBLIOTECA TEM PASTAS, E QUEM AS MONTA E A GESTAO
--
-- Decisao do usuario, em duas frases: *"a biblioteca do cliente, deve permitir
-- acessar logo, banners, e tudo mais que ele precisar, como um deskify sabe?"*
-- e *"quero que desenvolvedores e socios, possam mexer e criar pastas novas no
-- portal do cliente / dentro da biblioteca / e outras abas que sejam
-- necessarias"*.
--
-- ---------------------------------------------------------------------------
-- ESTA MIGRATION E A AUSENCIA QUE A BIBLIOTECA JA TINHA ESCRITA
--
-- `lib/dominio/biblioteca.ts` registra, desde a 0119, por que a tela tem UMA
-- secao e nenhuma aba:
--
--   *"O roteiro pede CINCO abas, e quatro delas nao tem nada por tras.
--   'Entregas finais', 'Arquivos da marca', 'Cronogramas', 'Relatorios' e
--   'Historico': das cinco, so a primeira existe no produto. As outras tres
--   nomeadas pedem uma tabela, um bucket e uma tela do lado da agencia para
--   alguem subir o arquivo -- nada disso existe."*
--
-- E a frase seguinte diz de quem era a decisao: *"o que falta e decisao de
-- quem usa, nao de quem escreve"*. Ela foi tomada.
--
-- ---------------------------------------------------------------------------
-- AS "OUTRAS ABAS" SAO PASTAS, E E ISSO QUE FAZ UM MECANISMO COBRIR AS TRES
--
-- A leitura literal de *"e outras abas que sejam necessarias"* seria uma aba
-- por assunto -- Arquivos da marca, Cronogramas, Relatorios --, cada uma com
-- a tabela, o bucket e a tela de upload dela. As tres sao a MESMA coisa: uma
-- pasta que a agencia monta e o cliente baixa.
--
-- Com pasta, a quarta ("Contratos", "Manual de uso") nasce de um clique de
-- quem usa o produto, e nao de uma migration. E a regra da Biblioteca fica
-- inteira: **uma aba que nunca tem nada dentro e pior que uma aba a menos** --
-- uma pasta vazia e a agencia nao ter montado ainda, que e diferente de uma
-- aba que o produto nao sabe encher.
--
-- ---------------------------------------------------------------------------
-- DUAS TABELAS, E NAO O BUCKET NAVEGADO PELO PREFIXO DO CAMINHO
--
-- A tentacao e nao criar tabela nenhuma: `storage.objects` guarda o caminho, e
-- `{conta}/marca/logo.png` se le como uma pasta. Ela se desfaz em quatro
-- pontos, e os quatro aparecem no primeiro dia de uso:
--
--   - **pasta vazia nao existe** no Storage, e "acabei de criar a pasta e vou
--     subir o arquivo depois" e o estado normal de quem monta;
--   - **renomear e mover N objetos um a um**, sem transacao -- e o nome da
--     pasta e justamente o que se corrige;
--   - **a ordem seria alfabetica**, e "Logos" antes de "Tipografia" e escolha
--     de quem monta, nao do alfabeto;
--   - e a **RLS do Storage** so sabe perguntar pelo primeiro segmento do
--     caminho (`storage.foldername(name))[1]`), entao o resto da arvore nao
--     tem como ser decidido por policy.
--
-- ---------------------------------------------------------------------------
-- DOIS NIVEIS E NUNCA TRES, que e a forma da 0033
--
-- `client_folders_dois_niveis` recusa o neto, pela razao escrita em
-- `deliverables_dois_niveis` e em `subtasks_agrupadora`: arvore que passa de
-- dois niveis na tela do cliente e arvore que ninguem acompanha, e o recuo
-- deixa de significar alguma coisa.
--
-- **E com dois niveis o ciclo e impossivel por construcao**: um filho nao pode
-- ser pai de ninguem, entao nao ha o `A -> B -> A` que `subtask_dependencias`
-- precisa recusar na criacao.
--
-- "Marca / Logos", "Marca / Tipografia", "Campanhas / Outubro Rosa" -- dois
-- niveis e o que um acervo de marca pede.
--
-- ---------------------------------------------------------------------------
-- O ARQUIVO ACEITA BUCKET E LINK, NUMA COLUNA SO
--
-- `url` guarda o caminho no bucket OU um endereco `https://`, e quem decide o
-- rotulo do botao e a propria string -- a forma de `subtask_entregas` e o par
-- que `assinarArquivos()` / `enderecoDaArte()` ja fazem em todo o produto:
-- *"nem toda arte mora no bucket -- algumas sao link de Drive ou de Figma"*.
--
-- **NAO e um enum como o `formato` da 0115**, e a diferenca decide: lah o
-- valor escolhe QUAL TELA o item vira (o e-book interativo abre dentro do
-- painel, com progresso por capitulo); aqui ele decide so se o botao diz
-- "Baixar" ou "Abrir", e **o que da para calcular nao se guarda**.
--
-- **E NAO HA COLUNA DE MIME**, e a ausencia e medida: a 0120 mediu que o
-- `type` do `File` responde `application/octet-stream` para `.psd` em metade
-- dos sistemas e `application/pdf` para um `.ai` moderno. Quem responde o
-- formato e a EXTENSAO DO NOME, por `formatoDoArquivo()` -- a mesma funcao que
-- decide o teto do upload e o filtro da Biblioteca.
--
-- ---------------------------------------------------------------------------
-- `folder_id` E `not null`, e isso mata um ramo inteiro de tela
--
-- Um arquivo na raiz e um arquivo que ninguem classificou, numa tela cujo
-- trabalho inteiro e classificar -- e a pasta e um clique. O preco esta dito:
-- na primeira vez, quem sobe o logo cria "Marca" antes. Uma biblioteca tem
-- pastas.
--
-- ---------------------------------------------------------------------------
-- QUEM ESCREVE E `is_gestor()`, E ISSO DESFAZ UMA BORDA DA 0133
--
-- Aquela migration levou o Portal do Cliente para `EQUIPE` e escreveu, sobre a
-- frase *"edicao limitada a atendimento, e Socios"*, que ela nao tinha
-- referente -- *"dentro de `/portal/{slug}` ninguem edita nada hoje, para
-- perfil nenhum"* -- e deixou a borda: *"no dia em que a tela ganhar uma acao,
-- ela nasce `is_atendimento()`, e ai e migration propria"*.
--
-- **E a migration propria, e o perfil e outro**, porque este pedido nomeia
-- quem pode: *"desenvolvedores e socios"*, que e `is_gestor()` letra por
-- letra. Fica como reversao declarada e nao como troca silenciosa: a borda
-- supunha uma acao operacional, e montar o acervo de marca de uma conta e
-- configuracao do produto -- a separacao da 0046 e da 0068, onde abrir o mes e
-- do Atendimento e desenhar a corrente e da gestao.
--
-- ---------------------------------------------------------------------------
-- O CLIENTE NAO ESCREVE NADA, e a ausencia e a regra do Portal
--
-- Nenhuma policy de INSERT, UPDATE ou DELETE para ele, nas duas tabelas e no
-- bucket. E a mesma linha da aba "Quem tem acesso", que nao tem botao nenhum:
-- *"quem entra e quem sai e decisao da agencia"*. Uma biblioteca que o cliente
-- enche e um Drive compartilhado, que e outro produto.
--
-- ---------------------------------------------------------------------------
-- O BUCKET E PRIVADO E A PRIMEIRA PASTA E O ID DA CONTA, que e a convencao dos
-- outros tres (`posts-artes`, `campanhas-arquivos`, `biblioteca-arquivos`):
-- e por ela que a policy do Storage pergunta de quem e o arquivo sem abrir
-- tabela nenhuma.
--
-- ---------------------------------------------------------------------------
-- CONFERENCIA no fim do arquivo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 - O BUCKET VEM PRIMEIRO
--
-- Privado, com a PRIMEIRA PASTA sendo o id da conta -- a convencao dos outros
-- tres, e e por ela que a policy pergunta de quem e o arquivo sem abrir tabela
-- nenhuma.
--
-- E a `allowed_mime_types` NAO entra aqui, ao contrario de `campanhas-arquivos`
-- na 0120: um acervo de marca guarda o que a agencia entrega -- EPS, INDD,
-- ZIP, o manual em PDF --, e a 0120 escreveu que *"uma lista fechada erraria na
-- primeira extensao que a agencia passasse a usar, e o erro seria o seletor
-- recusando um arquivo sem dizer por que"*. O teto de tamanho fica, porque ele
-- recusa com uma frase que a pessoa entende.
--
-- E ELE VEM PRIMEIRO, que e a decisao da 0110: o marcador do
-- `onde-esta-o-banco.sql` aponta para a ULTIMA coisa que a migration cria,
-- e com o bucket no fim uma colagem que morresse antes dele deixaria as duas
-- tabelas de pe com o upload sem lugar para onde ir -- e o marcador diria
-- `ok`. No comeco, a colagem parcial deixa um bucket vazio e o marcador diz
-- FALTA, que e a resposta certa.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets nao existe neste banco; o bucket nao foi criado.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit)
  values ('biblioteca-arquivos', 'biblioteca-arquivos', false, 524288000)
  on conflict (id) do update set file_size_limit = 524288000;

  execute 'drop policy if exists "biblioteca: equipe le" on storage.objects';
  execute 'drop policy if exists "biblioteca: cliente le" on storage.objects';
  execute 'drop policy if exists "biblioteca: gestao escreve" on storage.objects';
  execute 'drop policy if exists "biblioteca: gestao troca" on storage.objects';
  execute 'drop policy if exists "biblioteca: gestao apaga" on storage.objects';

  execute $politica$
    create policy "biblioteca: equipe le" on storage.objects
      for select to authenticated
      using (bucket_id = 'biblioteca-arquivos' and public.is_staff())
  $politica$;

  execute $politica$
    create policy "biblioteca: cliente le" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'biblioteca-arquivos'
        and (storage.foldername(name))[1]::uuid in (select public.my_client_ids())
      )
  $politica$;

  execute $politica$
    create policy "biblioteca: gestao escreve" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'biblioteca-arquivos' and public.is_gestor())
  $politica$;

  execute $politica$
    create policy "biblioteca: gestao troca" on storage.objects
      for update to authenticated
      using (bucket_id = 'biblioteca-arquivos' and public.is_gestor())
  $politica$;

  execute $politica$
    create policy "biblioteca: gestao apaga" on storage.objects
      for delete to authenticated
      using (bucket_id = 'biblioteca-arquivos' and public.is_gestor())
  $politica$;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - As pastas
-- ---------------------------------------------------------------------------

create table if not exists public.client_folders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- NULO E PASTA DE TOPO. O `cascade` aqui e o que faz apagar "Marca" levar
  -- "Marca / Logos": a sub-pasta nao existe sem a mae.
  pasta_pai_id uuid references public.client_folders(id) on delete cascade,
  nome text not null,
  -- A ORDEM E ESCOLHIDA e nao alfabetica: "Logos" vem antes de "Tipografia"
  -- porque quem montou decidiu assim.
  ordem int not null default 0,
  -- QUEM CRIOU, para a trilha. `on delete set null` e nao `cascade`: ninguem
  -- com historico e apagado neste produto, e se fosse, a pasta ficaria.
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_folders_nome_nao_vazio check (btrim(nome) <> '')
);

comment on table public.client_folders is
  'As pastas do acervo de marca de cada conta, montadas pela gestao e lidas pelo cliente no portal dele. DOIS NIVEIS e nunca tres (client_folders_dois_niveis), pela razao de deliverables_dois_niveis (0033).';

comment on column public.client_folders.pasta_pai_id is
  'Nulo e pasta de topo. Com dois niveis o ciclo e impossivel por construcao: um filho nao pode ser pai.';

comment on column public.client_folders.ordem is
  'Escolhida por quem monta. Alfabetica poria "Banners" antes de "Logos" numa conta onde a marca vem primeiro.';

create index if not exists client_folders_conta_idx
  on public.client_folders (client_id, pasta_pai_id, ordem);

-- UMA PASTA POR NOME NO MESMO NIVEL, e e trava e nao enfeite: duas "Logos"
-- irmas sao duas pastas identicas na tela, e o cliente nao tem como saber em
-- qual esta o arquivo que ele procura. O indice e PARCIAL porque `pasta_pai_id`
-- nulo nao e distinto de nulo num `unique` comum -- a pegadinha que a 0096
-- resolveu com indice parcial e que a 0104 desfez com `nulls not distinct`;
-- aqui sao dois indices, porque o de topo compara (conta, nome) e o de dentro
-- compara (conta, mae, nome).
create unique index if not exists client_folders_nome_no_topo
  on public.client_folders (client_id, lower(btrim(nome)))
  where pasta_pai_id is null;

create unique index if not exists client_folders_nome_na_mae
  on public.client_folders (pasta_pai_id, lower(btrim(nome)))
  where pasta_pai_id is not null;

alter table public.client_folders enable row level security;

drop policy if exists client_folders_select on public.client_folders;
create policy client_folders_select on public.client_folders
  for select to authenticated
  using (
    public.is_staff()
    or client_id in (select public.my_client_ids())
  );

drop policy if exists client_folders_insert on public.client_folders;
create policy client_folders_insert on public.client_folders
  for insert to authenticated
  with check (public.is_gestor());

drop policy if exists client_folders_update on public.client_folders;
create policy client_folders_update on public.client_folders
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

drop policy if exists client_folders_delete on public.client_folders;
create policy client_folders_delete on public.client_folders
  for delete to authenticated
  using (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 3 - DOIS NIVEIS E NUNCA TRES
--
-- A forma de `deliverables_dois_niveis` (0033) e de `subtasks_agrupadora`
-- (0022). E ele confere TAMBEM a conta: uma pasta nao pode ser filha de uma
-- pasta de outra empresa -- seria o material de uma conta aparecendo na arvore
-- da outra, o vazamento que a 0118 recusa um nivel acima.
-- ---------------------------------------------------------------------------

create or replace function public.client_folders_dois_niveis()
returns trigger
language plpgsql
as $FN$
declare
  v_mae record;
begin
  if new.pasta_pai_id is null then
    return new;
  end if;

  if new.pasta_pai_id = new.id then
    raise exception 'Uma pasta nao pode ser filha de si mesma.';
  end if;

  select client_id, pasta_pai_id, nome
    into v_mae
    from public.client_folders
   where id = new.pasta_pai_id;

  if not found then
    raise exception 'A pasta de cima nao existe.';
  end if;

  if v_mae.client_id <> new.client_id then
    raise exception 'A pasta "%" e de outra conta.', v_mae.nome
      using hint = 'Crie a pasta dentro da conta certa. Uma pasta nunca atravessa empresas.';
  end if;

  if v_mae.pasta_pai_id is not null then
    raise exception 'A pasta "%" ja esta dentro de outra.', v_mae.nome
      using hint = 'A biblioteca tem dois niveis: pasta e subpasta. Ponha o arquivo aqui, ou crie outra pasta de cima.';
  end if;

  return new;
end;
$FN$;

comment on function public.client_folders_dois_niveis() is
  'Recusa o neto e a pasta de outra conta. Dois niveis e a decisao de deliverables_dois_niveis (0033): arvore de tres niveis na tela do cliente e arvore que ninguem acompanha.';

drop trigger if exists client_folders_dois_niveis on public.client_folders;
create trigger client_folders_dois_niveis
  before insert or update of pasta_pai_id, client_id on public.client_folders
  for each row
  execute function public.client_folders_dois_niveis();


-- ---------------------------------------------------------------------------
-- PASSO 4 - Os arquivos
-- ---------------------------------------------------------------------------

create table if not exists public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- `not null` DE PROPOSITO: um arquivo na raiz e um arquivo que ninguem
  -- classificou, numa tela cujo trabalho inteiro e classificar.
  folder_id uuid not null references public.client_folders(id) on delete cascade,
  nome text not null,
  -- O CAMINHO NO BUCKET OU UM ENDERECO `https://`. Quem decide e a propria
  -- string, por `ehEnderecoDeFora()` -- o que da para calcular nao se guarda.
  url text not null,
  -- UMA LINHA sobre o que e o arquivo. Opcional: "logo-full.svg" ja se explica.
  descricao text,
  -- NULO NO LINK: um Google Doc nao tem tamanho que o produto possa afirmar.
  tamanho bigint,
  ordem int not null default 0,
  enviado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint client_files_nome_nao_vazio check (btrim(nome) <> ''),
  constraint client_files_url_nao_vazia check (btrim(url) <> '')
);

comment on table public.client_files is
  'Os arquivos do acervo de marca de cada conta. `url` guarda o caminho no bucket OU um endereco https (a forma de subtask_entregas), e quem decide o rotulo do botao e a propria string. Nao ha coluna de mime: a 0120 mediu que o navegador mente sobre .psd e .ai, e o formato sai da extensao do nome.';

comment on column public.client_files.folder_id is
  'not null de proposito: um arquivo na raiz e um arquivo que ninguem classificou.';

comment on column public.client_files.tamanho is
  'Nulo no link: um Google Doc nao tem tamanho que o produto possa afirmar.';

create index if not exists client_files_pasta_idx
  on public.client_files (folder_id, ordem, created_at);

create index if not exists client_files_conta_idx
  on public.client_files (client_id);

alter table public.client_files enable row level security;

drop policy if exists client_files_select on public.client_files;
create policy client_files_select on public.client_files
  for select to authenticated
  using (
    public.is_staff()
    or client_id in (select public.my_client_ids())
  );

drop policy if exists client_files_insert on public.client_files;
create policy client_files_insert on public.client_files
  for insert to authenticated
  with check (public.is_gestor());

drop policy if exists client_files_update on public.client_files;
create policy client_files_update on public.client_files
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

drop policy if exists client_files_delete on public.client_files;
create policy client_files_delete on public.client_files
  for delete to authenticated
  using (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 5 - O ARQUIVO E DA CONTA DA PASTA
--
-- `client_id` esta nas duas tabelas -- na pasta porque a arvore de topo e por
-- conta, no arquivo porque e por ele que a policy do SELECT e o indice
-- respondem sem um join. Duas colunas para o mesmo fato e onde as duas
-- verdades comecam a divergir, entao o gatilho ESCREVE a do arquivo a partir
-- da pasta em vez de conferi-la: a forma de `posts_normaliza` e de
-- `comments_normaliza`, onde o que e consequencia nao se digita.
-- ---------------------------------------------------------------------------

create or replace function public.client_files_herda_a_conta()
returns trigger
language plpgsql
as $FN$
declare
  v_conta uuid;
begin
  select client_id into v_conta
    from public.client_folders
   where id = new.folder_id;

  if not found then
    raise exception 'A pasta nao existe.';
  end if;

  new.client_id := v_conta;
  return new;
end;
$FN$;

comment on function public.client_files_herda_a_conta() is
  'client_id do arquivo e consequencia da pasta, nunca digitado: o que e consequencia nao se escreve duas vezes (a forma de posts_normaliza).';

drop trigger if exists client_files_herda_a_conta on public.client_files;
create trigger client_files_herda_a_conta
  before insert or update of folder_id, client_id on public.client_files
  for each row
  execute function public.client_files_herda_a_conta();


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------

select
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('client_folders', 'client_files'))   as tabelas_deve_ser_2,
  (select count(*) from pg_policy
    where polrelid = 'public.client_folders'::regclass)       as policies_pasta_deve_ser_4,
  (select count(*) from pg_policy
    where polrelid = 'public.client_files'::regclass)         as policies_arquivo_deve_ser_4,
  (select count(*) from pg_trigger
    where tgrelid = 'public.client_folders'::regclass
      and tgname = 'client_folders_dois_niveis')              as gatilho_niveis_deve_ser_1,
  (select count(*) from pg_trigger
    where tgrelid = 'public.client_files'::regclass
      and tgname = 'client_files_herda_a_conta')              as gatilho_conta_deve_ser_1,
  (select count(*) from pg_indexes
    where schemaname = 'public'
      and indexname in ('client_folders_nome_no_topo', 'client_folders_nome_na_mae'))
                                                              as unicos_deve_ser_2;
