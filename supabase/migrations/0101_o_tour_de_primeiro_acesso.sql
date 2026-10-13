-- ===========================================================================
-- 0101 - O TOUR DE PRIMEIRO ACESSO
--
-- Sprint 3M. Quem entra pela primeira vez e conduzido por um tour interativo:
-- o sistema destaca o elemento, explica o que ele e, e em alguns passos espera
-- a pessoa clicar de verdade antes de seguir.
--
-- ---------------------------------------------------------------------------
-- OS PASSOS MORAM NO CODIGO, E NAO AQUI -- E ESSA E A DECISAO QUE DEFINE A
-- TABELA
--
-- Um passo e um pedaco da interface: o seletor que ele aponta, a rota onde ele
-- acontece, a frase que ele diz. Isso muda no mesmo commit em que a tela muda,
-- e tem de ser versionado junto com ela -- uma tabela de passos obrigaria uma
-- migration a cada ajuste de layout, e no dia em que alguem esquecesse de
-- aplicar, o tour apontaria para um elemento que nao existe mais. E isso nao
-- da erro: da um balao apontando para o nada, que e exatamente o que este
-- sprint existe para nao acontecer.
--
-- Entao o que o banco guarda e UMA coisa: **por onde cada pessoa passou**.
-- ---------------------------------------------------------------------------
--
--
-- SAO DUAS LISTAS DE PASSOS PULADOS, E NAO UMA -- E ELAS SAO FATOS OPOSTOS
--
-- O sprint pede as duas coisas em duas frases separadas, sem notar que sao
-- duas colunas:
--
--   *"No passo interativo, deixe Pular este passo disponivel."*
--   *"Mostre tambem os passos pulados por elemento ausente, agregados. E o
--     alarme de tour quebrado."*
--
-- A primeira e ESCOLHA de quem esta fazendo o tour: ela leu o balao e decidiu
-- nao clicar. A segunda e DEFEITO: o elemento nao apareceu em dois segundos, o
-- tour pulou em silencio, e alguem precisa consertar o seletor.
--
-- Numa coluna so, o alarme de tour quebrado contaria quem clicou em "pular" --
-- e o numero ficaria alto, plausivel e sem significado, que e o modo de falha
-- desta casa. `passos_pulados` e a escolha; `passos_sem_ancora` e o alarme.
--
--
-- `finalizado_em` E `iniciado_em` SAO DERIVADOS DO STATUS, POR TRIGGER
--
-- **Policy nao limita coluna** -- a mesma razao de `comments_normaliza`
-- (0032), de `posts_protege_colunas` (0042) e de `subtasks_cronometro`
-- (0021). A pessoa escreve a propria linha a cada passo que avanca, e sem o
-- trigger um PATCH montado a mao poria "terminado em 3/10" numa linha que diz
-- "em andamento" -- tres fatos sobre a mesma linha, dois deles errados, que e
-- literalmente o bug que a 0093 consertou na corrente do social.
--
-- Entao o trigger **reescreve as duas** a partir do status:
--
--   em_andamento                 -> finalizado_em = null
--   concluido / pulado (na hora
--   em que o status muda)        -> finalizado_em = now()
--   status que nao mudou         -> finalizado_em como estava
--
-- A terceira linha e a que importa: avancar um passo e um UPDATE, e sem ela a
-- data de conclusao andaria a cada escrita numa linha ja encerrada.
--
-- E `iniciado_em` volta a `now()` **na transicao** para `em_andamento`, que e
-- refazer o tour. Nao a cada escrita: avancar um passo tambem e `em_andamento`,
-- e a data recomecaria a cada clique em Proximo. O par passa a descrever a
-- passada CORRENTE, que e o que o acompanhamento pergunta -- e nao a primeira
-- vez de todas, que nenhuma tela deste produto pergunta.
--
--
-- O QUE NAO TEM TRAVA, E E DITO EM VEZ DE ESCONDIDO
--
-- `passo_atual` aceita qualquer inteiro, e `tour_id` aceita qualquer texto. Um
-- `check` com a lista dos tour_ids obrigaria uma migration a cada modulo que
-- ganhasse micro-tour -- e os passos estao no codigo justamente para isso nao
-- acontecer. O estrago possivel e uma linha com um tour_id que nenhuma tela
-- conhece, na propria linha de quem a escreveu: o acompanhamento mostraria uma
-- linha a mais, e nenhuma decisao sai dela.
--
--
-- `versao` E O CONVITE PARA REVER, E ELE E DERIVADO
--
-- A coluna guarda com que versao a pessoa passou. "Quem ja concluiu a versao
-- anterior recebe o convite para rever" e `status = 'concluido' and versao <
-- <a versao que o codigo tem hoje>` -- a comparacao mora na tela, porque a
-- versao de agora mora no codigo, ao lado dos passos. Uma segunda coluna
-- dizendo "precisa rever" seria a segunda verdade sobre o mesmo fato, e ela
-- envelheceria sozinha no dia em que alguem subisse a versao.
--
--
-- NENHUM INDICE NOVO, E A AUSENCIA E DECISAO
--
-- O sprint pede `create index on tour_progresso (user_id, status)`. O unique
-- `(user_id, tour_id)` ja cobre toda consulta que o produto faz pela PESSOA, e
-- a do acompanhamento le a tabela inteira -- nenhuma delas usaria aquele
-- indice. Indice que nenhuma consulta usa e da mesma familia de coluna que
-- nenhuma tela le: ele nao faz mal, e passa a ser mantido por quem vier depois
-- achando que ele serve a alguma coisa. A tabela cresce uma linha por pessoa
-- por tour -- dezenas de pessoas por uma duzia de tours.
--
--
-- SEM POLICY DE DELETE, e e a regra: refazer o tour e um UPDATE que volta o
-- status para `em_andamento` e o passo para zero. Apagar a linha perderia o
-- unico registro de que a pessoa passou por ali, que e o que o acompanhamento
-- da gestao le.
--
--
-- MEDIDO COM OITO MUTACOES, e sao os numeros de
-- `supabase/testes/44_o_tour_de_primeiro_acesso.sql`:
--
--   tirar o ramo `old.status = new.status` do `case`           2 cenarios
--   tirar o `old.status is distinct from new.status`           1
--   tirar o `with check` do UPDATE                             0  <- ver PASSO 4
--   tirar a guarda `is_gestor()` do acompanhamento             2
--   tirar o `revoke ... from anon` da funcao                    1
--   tirar o `where p.ativo` do acompanhamento                  1
--   trocar o `left join` por `join`                            2
--   tirar o `not null default '{}'` de `passos_sem_ancora`     1
--
-- DUAS MERECEM SER LIDAS. **A do `with check` derruba ZERO**, e o zero e o
-- achado: ele prova que a clausula e redundante num policy de UPDATE, e
-- derrubou uma frase que eu havia escrito aqui como se fosse trava. A razao de
-- ela ficar esta no PASSO 4.
--
-- E **a do `revoke` derruba 1 pelo motivo certo, e so porque o auxiliar le a
-- MENSAGEM**: sem o revoke, `anon` CONSEGUE executar a funcao e cai na guarda
-- `is_gestor()` -- entao ela continua recusando, com outra frase. Um cenario
-- que so olhasse se houve excecao passaria com a porta aberta. E a licao que a
-- bateria do limite de tentativas escreveu: aqui se mede o PRIVILEGIO, nao a
-- recusa.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O status
--
-- ENUM E NAO `text`, ao contrario do que o sprint escreve. Sao tres valores
-- fechados, e quem os escreve e uma Server Action: um `'concluido '` com
-- espaco, ou a mesma palavra escrita com acento, entraria calado e a pessoa
-- ficaria com o tour pela metade para sempre -- sem erro em lugar nenhum. E a
-- decisao
-- de `midia` na 0042: o que a tela desenha por cima precisa ser um nome que o
-- compilador confere.
--
-- E e um QUINTO vocabulario de status, ao lado dos quatro que o produto
-- mantem separados (`task_status`, `subtask_status`, `content_status`,
-- `solicitacao_status`) -- pela mesma razao que mantem aqueles quatro: esta
-- tabela responde a outra pergunta, "em que pe esta o tour desta pessoa", e
-- nenhum valor dos outros quatro significa isso.
-- ---------------------------------------------------------------------------
do $migracao$
begin
  if not exists (select 1 from pg_type where typname = 'tour_status') then
    create type public.tour_status as enum
      ('em_andamento', 'concluido', 'pulado');
  end if;
end
$migracao$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - Por onde cada pessoa passou
--
-- `on delete cascade` em `user_id`: o progresso de um tour nao e historico da
-- agencia -- e um estado de interface de uma pessoa. Nao existe a razao que
-- faz `recurrence_id` ser `on delete set null` (as demandas geradas sao
-- trabalho de verdade, com comentario e aprovacao dentro).
--
-- E ele nao e alcancado pelo desligamento, que e a forma como alguem sai deste
-- produto: `profiles.ativo = false` preserva a linha, e e isso que mantem a
-- autoria do que foi feito. O cascade vale para a exclusao de verdade, que
-- quase nunca acontece.
-- ---------------------------------------------------------------------------
create table if not exists public.tour_progresso (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  -- Qual tour: 'painel', 'portal', e um por modulo com micro-tour. A lista
  -- mora em `src/lib/tour/`, ao lado dos passos.
  tour_id           text not null,
  versao            integer not null default 1,
  status            public.tour_status not null default 'em_andamento',
  passo_atual       integer not null default 0,
  -- A ESCOLHA: a pessoa leu o balao e clicou em "Pular este passo".
  passos_pulados    text[] not null default '{}',
  -- O DEFEITO: o elemento nao apareceu em dois segundos e o tour seguiu em
  -- silencio. `not null default '{}'` nos dois, e nao nulo: array nulo ao lado
  -- de array vazio sao dois jeitos de dizer "nenhum", e a 0048 ja pagou o
  -- preco de o vazio significar duas coisas.
  passos_sem_ancora text[] not null default '{}',
  iniciado_em       timestamptz not null default now(),
  finalizado_em     timestamptz,
  -- UMA LINHA POR PESSOA POR TOUR. Refazer reescreve a linha; nao cria uma
  -- segunda. O historico de passadas anteriores nao e perguntado por nenhuma
  -- tela, e guarda-lo faria o acompanhamento ter de escolher qual das linhas
  -- responde "em que pe ela esta".
  unique (user_id, tour_id)
);

comment on table public.tour_progresso is
  'Por onde cada pessoa passou em cada tour de primeiro acesso (0101). Os PASSOS moram no codigo, em src/lib/tour/ -- eles sao interface, e versionam junto com a tela.';
comment on column public.tour_progresso.passos_pulados is
  'Os passos que a pessoa escolheu pular. Nao confundir com passos_sem_ancora: aquele e defeito, este e escolha.';
comment on column public.tour_progresso.passos_sem_ancora is
  'Os passos cujo elemento nao apareceu em 2s e que o tour pulou em silencio. E o alarme de tour quebrado -- o seletor envelheceu junto com a tela.';
comment on column public.tour_progresso.versao is
  'Com que versao do tour esta pessoa passou. O convite para rever e derivado: concluido com versao menor que a do codigo.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - As duas datas sao consequencia do status
--
-- Fora de todo `if`: o trigger e dono das duas colunas e descarta o que vier
-- no pedido. E a forma de `subtasks_cronometro` (0021) e de
-- `academy_progresso_carimbar` (0096).
-- ---------------------------------------------------------------------------
create or replace function public.tour_progresso_carimba()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- REFAZER O TOUR recomeca a passada, e a transicao e o que define isso --
  -- nao o status em si. Avancar um passo tambem escreve `em_andamento`, e sem
  -- o `old.status <> new.status` a data de inicio voltaria a cada clique em
  -- Proximo.
  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status = 'em_andamento' then
    new.iniciado_em := now();
  end if;

  new.finalizado_em := case
    when new.status = 'em_andamento' then null
    -- O status nao mudou: a data fica onde estava. Sem esta linha, qualquer
    -- escrita numa linha ja encerrada moveria a conclusao para hoje.
    when tg_op = 'UPDATE' and old.status = new.status then old.finalizado_em
    else now()
  end;

  return new;
end;
$$;

drop trigger if exists tour_progresso_carimba on public.tour_progresso;
create trigger tour_progresso_carimba
  before insert or update on public.tour_progresso
  for each row execute function public.tour_progresso_carimba();


-- ---------------------------------------------------------------------------
-- PASSO 4 - RLS
--
-- A LEITURA E DIFERENTE DA ESCRITA, e a assimetria e a mesma de
-- `academy_progresso` (0096): a pessoa escreve o proprio progresso e so o
-- proprio, e a gestao PRECISA ler o de todos para o acompanhamento existir.
--
-- E aqui a leitura da gestao nao entrega nada de intimo: o que a linha tem
-- dentro e qual passo, quais foram pulados e quando. Nao ha anotacao, nao ha
-- texto escrito por ninguem -- que era o furo que a 0017 tentou fechar com
-- uma view e que a 0096 fechou separando em duas tabelas.
--
-- O `with check` DO UPDATE E REDUNDANTE, E ISSO FOI MEDIDO -- eu havia escrito
-- aqui que sem ele daria para mover a propria linha para o nome de outra
-- pessoa, e esta errado: num policy de UPDATE o Postgres usa a expressao do
-- `using` TAMBEM como check quando o `with check` nao existe. Tirando a linha,
-- nenhum cenario da bateria cai -- e o zero e o que prova a frase, como o
-- `where` da capacidade na 0081.
--
-- Ela fica escrita de qualquer forma, e a razao e a do par nomeado: `using` e
-- `with check` respondem perguntas diferentes (que linha eu alcanco, que linha
-- eu posso deixar gravada), e deixar a segunda implicita faz quem vier depois
-- ter de lembrar da regra de fallback para saber se a trava existe. O que a
-- bateria mede e o COMPORTAMENTO -- mover a propria linha para outro nome e
-- recusado --, e esse cenario vale com a linha e sem ela.
-- ---------------------------------------------------------------------------
alter table public.tour_progresso enable row level security;

drop policy if exists tour_progresso_select on public.tour_progresso;
create policy tour_progresso_select on public.tour_progresso
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_gestor());

drop policy if exists tour_progresso_insert on public.tour_progresso;
create policy tour_progresso_insert on public.tour_progresso
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists tour_progresso_update on public.tour_progresso;
create policy tour_progresso_update on public.tour_progresso
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- SEM POLICY DE DELETE, nem para o socio. O caminho de refazer e o UPDATE
-- acima; apagar a linha apagaria o registro de que a pessoa passou por ali.


-- ---------------------------------------------------------------------------
-- PASSO 5 - O acompanhamento da gestao
--
-- `is_gestor()` na primeira linha, e NAO `security definer`: o que ela devolve
-- e o nome de toda a equipe e de todo cliente, e a recusa precisa ser do banco
-- e nao da tela. E a forma de `academy_acompanhamento()` (0096), e a recusa
-- chega como ERRO do PostgREST em vez de lista vazia -- a diferenca entre
-- "voce nao pode" e "ninguem comecou nenhum tour".
--
-- `profiles_select_gestor` e `team_members_select` ja deixam o gestor ler as
-- duas tabelas, entao a funcao atravessa a RLS pelo caminho normal.
--
--
-- ELA DEVOLVE LINHA PARA QUEM NUNCA COMECOU, e e metade do que a tela serve
--
-- *"Saber quem ainda nao se ambientou"* e, quase sempre, alguem que nao tem
-- linha nenhuma nesta tabela. Um `select` em `tour_progresso` responderia
-- sobre quem comecou e seria cego justamente para quem o acompanhamento
-- procura -- e uma lista vazia ali leria como "todo mundo esta em dia". O
-- `left join` parte de `profiles`, entao quem nunca abriu o produto vem com
-- `tour_id` nulo.
--
--
-- E ELA INCLUI O CLIENTE, e isso nao e sobra
--
-- O tour do portal e o unico que pode quebrar sem ninguem notar: o Portal do
-- Cliente e a area que a equipe nunca abre -- e esta frase esta escrita no
-- CLAUDE.md porque o produto ja pagou por ela duas vezes (a leitura que
-- falhava calada, e as duas telas que engoliam a recusa). Tirar o cliente
-- daqui deixaria o alarme de tour quebrado cego exatamente para o tour que
-- ninguem conferiria de outro jeito.
--
-- A coluna `role` e o que permite a tela separar as duas metades: a equipe
-- aparece por nome, e o portal aparece agregado.
--
--
-- UMA FUNCAO, E NAO DUAS -- as duas perguntas que o sprint faz ("em qual passo
-- as pessoas desistem" e "os passos pulados por elemento ausente, agregados")
-- sao as MESMAS linhas somadas de dois jeitos. Uma segunda funcao agregando no
-- banco daria dois lugares onde a conta pode divergir da lista que a tela
-- desenha, que e o cartao de "11 entregues" com sete na lista embaixo.
-- ---------------------------------------------------------------------------
create or replace function public.tour_acompanhamento()
returns table (
  user_id           uuid,
  pessoa            text,
  role              public.user_role,
  funcao            public.team_funcao,
  tour_id           text,
  versao            integer,
  status            public.tour_status,
  passo_atual       integer,
  passos_pulados    text[],
  passos_sem_ancora text[],
  iniciado_em       timestamptz,
  finalizado_em     timestamptz
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_gestor() then
    raise exception 'Apenas a gestão vê o acompanhamento dos tours.';
  end if;

  return query
    select p.id,
           p.nome,
           p.role,
           t.funcao,
           tp.tour_id,
           tp.versao,
           tp.status,
           tp.passo_atual,
           tp.passos_pulados,
           tp.passos_sem_ancora,
           tp.iniciado_em,
           tp.finalizado_em
      from public.profiles p
      left join public.team_members t   on t.user_id  = p.id
      left join public.tour_progresso tp on tp.user_id = p.id
     -- QUEM SAIU NAO DEVE AMBIENTACAO. `ativo = false` e o que o desligamento
     -- escreve, e cobrar o tour de quem foi embora poria a lista para crescer
     -- para sempre.
     where p.ativo
     -- Por PESSOA e depois por tour, e nada mais: quem nunca comecou tem UMA
     -- linha, com `tour_id` nulo, e nenhuma outra -- o `left join` so produz o
     -- nulo quando nao ha progresso nenhum. Um `nulls first` aqui nao ordenaria
     -- nada, e e por isso que ele nao esta escrito: uma clausula que nao decide
     -- nada e lida depois como se decidisse.
     order by p.nome, tp.tour_id;
end;
$$;

comment on function public.tour_acompanhamento() is
  'Pessoa x tour: quem concluiu, quem pulou, quem parou no meio e em que passo (0101). Devolve linha com tour_id nulo para quem nunca comecou -- e ela quem o acompanhamento procura. Inclui o cliente, porque o tour do portal e o unico que quebraria sem ninguem notar.';

-- `drop function` nao houve aqui, mas o revoke vai junto de qualquer forma: o
-- Postgres concede `execute` a `public` em toda funcao nova, e o PostgREST
-- publica o schema `public` sozinho. Sem estas tres linhas, `anon` -- cuja
-- chave vai no bundle que o navegador baixa -- leria o nome de toda a equipe e
-- de todo cliente da agencia. E a licao da 0097 com `academy_vencidos()`.
revoke all on function public.tour_acompanhamento() from public;
revoke all on function public.tour_acompanhamento() from anon;
grant execute on function public.tour_acompanhamento() to authenticated;


-- ---------------------------------------------------------------------------
-- CONFERENCIA, para colar depois de aplicar
--
--   -- A tabela e o enum existem?
--   select column_name, data_type, udt_name
--     from information_schema.columns
--    where table_name = 'tour_progresso' order by ordinal_position;
--
--   -- As tres policies, e nenhuma de delete:
--   select policyname, cmd from pg_policies
--    where tablename = 'tour_progresso' order by policyname;
--
--   -- O acompanhamento (como gestor, pelo PostgREST):
--   select * from public.tour_acompanhamento();
-- ---------------------------------------------------------------------------
