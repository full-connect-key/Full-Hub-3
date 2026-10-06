-- ===========================================================================
-- 0086 - O MES DE SOCIAL E A DEMANDA DELE SAO UMA COISA SO
--
-- Decisao do usuario, nestas palavras: *"preciso que o social seja vinculado
-- como um todo. Se eu apago a demanda, o social deve ser deletado em todos os
-- locais. Se eu apago o social, a demanda deve ser deletada."*
--
-- E antes dela, o pedido que a motivou: *"gostaria que desse pra deletar tudo
-- que eu montei do mes, caso tenha errado"* -- hoje so da post a post, e a
-- demanda do mes fica para tras, vazia.
--
-- ---------------------------------------------------------------------------
-- O VINCULO SE DESFAZIA EM SILENCIO, E ISSO E UM FURO DE VERDADE
--
-- `posts.subtask_id` e `on delete set null` desde a 0032. Entao apagar a
-- demanda do mes em Gestao de Tasks apagava as subtarefas e deixava os POSTS
-- ORFAOS: eles continuavam no Social Media, continuavam no portal do cliente,
-- e nao tinham mais mes nenhum. Sem erro, sem aviso, e sem nada na tela
-- ligando uma coisa a outra.
--
-- ---------------------------------------------------------------------------
-- A TRAVA MORA NO TRIGGER, E NAO NA ACTION
--
-- E a linha que mais importa desta migration. Com a simetria ligada existem
-- DUAS portas para o mesmo estrago -- o botao do Social Media e o "Excluir
-- task" do board --, e uma trava escrita so no dialogo do Social Media
-- transformaria a outra na porta dos fundos dela: a que nao pergunta nada.
--
-- E a licao da 0029 e da 0060, as duas vezes em que a regra morava em dois
-- lados e desfazer um nao desfez nada. Quem recusa aqui e o banco.
--
-- ---------------------------------------------------------------------------
-- E ELE NAO PODE VIRAR LACO
--
-- O trigger em `tasks` apaga os posts do mes; a funcao apaga os posts e
-- DEPOIS a demanda, e aí o trigger encontra zero post e nao faz nada. E a
-- forma da 0080, onde o espelho vai num sentido so de proposito.
--
-- ---------------------------------------------------------------------------
-- UMA DIVERGENCIA DO TEXTO DO SPRINT, e ela e para MAIS e nao para menos
--
-- O sprint 3J abre o "Excluir mes" para `is_gestor() or is_atendimento()`.
-- Aqui ele e `is_gestor()` e mais nada, que e quem ja apaga UM post desde a
-- 0042. Apagar sessenta posts, as versoes, os comentarios e o registro de
-- cada aprovacao nao pode ser mais facil que apagar um -- e o Atendimento, que
-- ABRE o mes desde a 0046, continua abrindo: abrir trabalho e destruir
-- trabalho sao duas decisoes.
--
-- ---------------------------------------------------------------------------
-- MEDIDO COM TRES MUTACOES, e a do meio e a que vale ler
--
--   o trigger `tasks_apaga_o_social` sai ................... 10 cenarios
--   a trava sai do TRIGGER e fica so na funcao .............  1 cenario
--   `before delete` vira `after delete` .................... 10 cenarios
--
-- O UM E O NUMERO IMPORTANTE. Com a trava escrita so na funcao, tudo continua
-- verde menos "E apagar a demanda dele no board tambem" -- e e exatamente
-- esse o estrago: o Social Media recusaria e o board apagaria calado. Um
-- cenario so separa as duas implementacoes, e sem ele a diferenca entre
-- "a regra esta no banco" e "a regra esta na tela" nao apareceria em lugar
-- nenhum.
--
-- E a terceira confirma a escolha do `before`: num `after`, o cascade ja zerou
-- `posts.subtask_id` e `posts_do_mes()` acha zero -- os posts ficam orfaos
-- sem erro, que e o furo que esta migration existe para fechar.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - ARQUIVAR, QUE E O QUE A TRAVA OFERECE NO LUGAR
--
-- `arquivada_em` e um CARIMBO e nao um valor de enum, pela razao da 0028:
-- `task_status` tem sete valores e nenhum deles e "arquivado", e `alter type
-- ... add value` nao pode ser USADO na mesma transacao em que nasce -- o SQL
-- Editor do Supabase roda o arquivo colado como uma transacao so, e a
-- migration falharia na hora de aplicar.
--
-- E arquivado nao e estado do TRABALHO, e sim do ciclo de vida: no enum ele
-- entraria no seletor dos sete status e viraria coluna no board. E a mesma
-- decisao de `publicada_em`, letra por letra.
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists arquivada_em timestamptz;

comment on column public.tasks.arquivada_em is
  'Quando alguem tirou esta demanda da navegacao padrao. E carimbo e nao status pela razao de `publicada_em` (0028): arquivado e estado do ciclo de vida e nao do trabalho, e no enum viraria coluna no board. Reversivel: basta limpar.';

create index if not exists tasks_social_arquivada_idx
  on public.tasks (client_id, social_do_mes)
  where social_do_mes is not null and arquivada_em is null;


-- ---------------------------------------------------------------------------
-- PASSO 2 - QUAIS POSTS SAO DESTE MES
--
-- UM LUGAR SO RESPONDE ISSO, e e o ponto deste passo. A ligacao e
-- `posts.subtask_id -> subtasks.task_id`, e ela aparece em quatro lugares
-- daqui para baixo; escrita quatro vezes, a quarta e a que esquece o
-- `publicada_em` ou troca o join. E a decisao de `subtask_eh_agrupadora()` e
-- de `dono_do_post()`.
--
-- Ela NAO e `security definer`: quem chama ja passou pela policy de `posts` e
-- de `subtasks`, e abrir aqui entregaria a lista de posts de qualquer mes a
-- quem tiver o uuid da demanda.
-- ---------------------------------------------------------------------------
create or replace function public.posts_do_mes(p_task_id uuid)
returns setof public.posts
language sql
stable
set search_path = public
as $$
  select p.*
    from public.posts p
    join public.subtasks s on s.id = p.subtask_id
   where s.task_id = p_task_id;
$$;

comment on function public.posts_do_mes(uuid) is
  'Os posts de um mes de social, pela ponte `posts.subtask_id -> subtasks.task_id` (0061). Um lugar so responde isso: escrita em cada chamador, a quarta copia e a que troca o join.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - A TRAVA, E ELA VALE PELAS DUAS PORTAS
--
-- *"Com algum post ja enviado ao cliente, a exclusao e bloqueada e o
-- arquivamento e oferecido."* No instante em que o cliente viu alguma coisa,
-- aquilo deixou de ser rascunho da agencia e virou prova de trabalho
-- combinado -- e o registro de cada aprovacao sai junto com o post.
--
-- A RECUSA DIZ O QUE FAZER NO LUGAR, pela razao da 0020: `hint` com as duas
-- saidas, arquivar e limpar so os posts. Uma trava que so diz "nao pode"
-- devolve a pessoa ao apagar um por um, que e justamente o que o pedido quer
-- resolver.
--
-- `before delete` e nao `after`: num `after` as subtarefas ja sairam pelo
-- cascade e `posts.subtask_id` ja esta nulo -- `posts_do_mes()` acharia zero,
-- e os posts ficariam orfaos sem erro nenhum. E a pegadinha que a 0080 pagou.
-- ---------------------------------------------------------------------------
create or replace function public.tasks_apaga_o_social()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  enviados integer;
  decididos integer;
begin
  -- A demanda que nao e de social sai por aqui sem custo nenhum.
  if old.social_do_mes is null then
    return old;
  end if;

  select count(*) filter (where p.enviado_em is not null),
         count(*) filter (where p.status in ('aprovado', 'ajustes', 'rejeitado'))
    into enviados, decididos
    from public.posts_do_mes(old.id) p;

  if enviados > 0 then
    raise exception
      'Este mês tem % post(s) que já foram ao cliente, e apagá-lo destruiria o histórico de aprovação.',
      enviados
      using hint =
        'Arquive o mês para tirá-lo da navegação sem apagar nada, ou use "Limpar os posts do mês" se o que saiu errado foi a grade.';
  end if;

  -- SEM POST ENVIADO, OS POSTS VAO JUNTO. O cascade de `post_versions`,
  -- `post_etapas`, `comments` e `approval_rounds` ja esta escrito nas
  -- migrations deles -- aqui basta apagar o post.
  delete from public.posts p where p.id in (select id from public.posts_do_mes(old.id));

  -- `decididos` nao e usado para recusar: ele existe para o dia em que alguem
  -- quiser contar isso na mensagem. Sem esta linha o `select` acima teria uma
  -- coluna que ninguem le, que e pior.
  if decididos > 0 then
    raise notice 'Mês apagado com % post(s) decididos pelo cliente, nenhum enviado.', decididos;
  end if;

  return old;
end;
$$;

drop trigger if exists tasks_apaga_o_social on public.tasks;
create trigger tasks_apaga_o_social
  before delete on public.tasks
  for each row
  execute function public.tasks_apaga_o_social();

comment on function public.tasks_apaga_o_social is
  'Apagar a demanda do mes apaga os posts dele (0086, decisao do usuario), e recusa quando algum ja foi ao cliente. E `before delete` porque num `after` o cascade ja zerou `posts.subtask_id` e os posts ficariam orfaos sem erro.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - A OUTRA PORTA: APAGAR O MES PELO SOCIAL MEDIA
--
-- TUDO NUMA FUNCAO SO, porque e uma transacao so: pelo PostgREST seriam
-- sessenta chamadas, e a terceira falhando deixaria meio mes apagado sem nada
-- na tela dizendo o que sobrou. E a decisao de `abrir_campanha()` (0051) e de
-- `solicitar_notas_do_mes()` (0066).
--
-- Ela apaga os posts PRIMEIRO e a demanda depois, e nessa ordem o trigger do
-- PASSO 3 encontra zero post: o laco nao existe por construcao, e nao por um
-- `if` que alguem precisa lembrar de manter.
-- ---------------------------------------------------------------------------
create or replace function public.apagar_mes_de_social(p_task_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  mes       date;
  enviados  integer;
  quantos   integer;
begin
  if not public.is_gestor() then
    raise exception 'Apagar um mês de social é do desenvolvedor ou do sócio.'
      using errcode = 'insufficient_privilege',
            hint = 'Quem abre o mês é o Atendimento; quem o apaga é a gestão.';
  end if;

  select t.social_do_mes into mes from public.tasks t where t.id = p_task_id;
  if mes is null then
    raise exception 'Esta demanda não é um mês de social.'
      using hint = 'Apagar uma demanda comum é pelo "Excluir task", no fim da tela dela.';
  end if;

  select count(*) filter (where p.enviado_em is not null), count(*)
    into enviados, quantos
    from public.posts_do_mes(p_task_id) p;

  -- A MESMA RECUSA DO TRIGGER, ANTES DELE. Ela nao e redundante: aqui a
  -- mensagem pode falar do MES, e o trigger fala da demanda -- e sem ela a
  -- pessoa leria a frase de um objeto que a tela dela nao nomeia. O trigger
  -- continua sendo quem vale: tirando esta, nada passa a ser permitido.
  if enviados > 0 then
    raise exception
      'Este mês tem % post(s) que já foram ao cliente, e apagá-lo destruiria o histórico de aprovação.',
      enviados
      using hint =
        'Arquive o mês para tirá-lo da navegação sem apagar nada, ou use "Limpar os posts do mês" se o que saiu errado foi a grade.';
  end if;

  delete from public.tasks where id = p_task_id;
  return quantos;
end;
$$;

comment on function public.apagar_mes_de_social(uuid) is
  'Apaga um mes de social inteiro -- os posts e a demanda -- numa transacao so (0086). Os posts saem primeiro, entao o trigger `tasks_apaga_o_social` encontra zero e o laco nao existe por construcao.';

revoke all on function public.apagar_mes_de_social(uuid) from public, anon;
grant execute on function public.apagar_mes_de_social(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 5 - LIMPAR SO OS POSTS, PARA QUEM ERROU A GRADE
--
-- *"Util quando a grade saiu errada mas os responsaveis e prazos estao
-- certos."* Ela apaga os posts e deixa a demanda, as etapas, os responsaveis
-- e as datas de pe.
--
-- A MESMA TRAVA VALE AQUI, e e o ponto: ela e sobre o MATERIAL que o cliente
-- viu, nao sobre a casca. Sem isso, "limpar os posts" seria o caminho de
-- apagar o que o cliente aprovou sem passar por recusa nenhuma -- a porta dos
-- fundos de novo, com outro nome.
-- ---------------------------------------------------------------------------
create or replace function public.limpar_posts_do_mes(p_task_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  enviados integer;
  quantos  integer;
begin
  if not public.is_gestor() then
    raise exception 'Limpar os posts de um mês é do desenvolvedor ou do sócio.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.tasks t where t.id = p_task_id and t.social_do_mes is not null) then
    raise exception 'Esta demanda não é um mês de social.';
  end if;

  select count(*) filter (where p.enviado_em is not null), count(*)
    into enviados, quantos
    from public.posts_do_mes(p_task_id) p;

  if enviados > 0 then
    raise exception
      'Este mês tem % post(s) que já foram ao cliente, e limpá-lo destruiria o histórico de aprovação.',
      enviados
      using hint = 'Arquive o mês, ou apague os posts que ainda não saíram, um a um.';
  end if;

  delete from public.posts p where p.id in (select id from public.posts_do_mes(p_task_id));
  return quantos;
end;
$$;

comment on function public.limpar_posts_do_mes(uuid) is
  'Apaga os posts de um mes e deixa a demanda, as etapas e os prazos de pe (0086), para quem errou a grade. A trava do post ja enviado vale aqui tambem: ela e sobre o material, nao sobre a casca.';

revoke all on function public.limpar_posts_do_mes(uuid) from public, anon;
grant execute on function public.limpar_posts_do_mes(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 6 - O QUE VAI JUNTO, PARA O DIALOGO CONTAR ANTES
--
-- O dialogo CONTA o que vai junto em vez de perguntar "tem certeza?" -- a
-- decisao do dialogo de apagar campanha. E a contagem sai da MESMA ponte que
-- o apagamento usa, pela razao de `quem_deve_nota()` na 0066: duas contas
-- dariam um dialogo prometendo doze e um apagamento alcancando onze.
-- ---------------------------------------------------------------------------
create or replace function public.o_que_vai_com_o_mes(p_task_id uuid)
returns table (
  posts          integer,
  enviados       integer,
  aprovados      integer,
  versoes        integer,
  etapas         integer,
  comentarios    integer
)
language plpgsql
security invoker
stable
set search_path = public
as $$
begin
  return query
  with p as (select * from public.posts_do_mes(p_task_id))
  select
    (select count(*) from p)::integer,
    (select count(*) from p where p.enviado_em is not null)::integer,
    (select count(*) from p where p.status = 'aprovado')::integer,
    (select count(*) from public.post_versions v where v.post_id in (select id from p))::integer,
    (select count(*) from public.post_etapas e where e.post_id in (select id from p))::integer,
    -- `comments` e POLIMORFICA desde a 0030: ela aponta por
    -- `(content_type, content_id)` e nao tem chave estrangeira, porque o
    -- alvo muda conforme o tipo. Quem a limpa ao apagar um post e o trigger
    -- `posts_limpa_conteudo` (0032), e por isso a contagem tem que perguntar
    -- do mesmo jeito que ele apaga.
    (select count(*) from public.comments c
      where c.content_type = 'post' and c.content_id in (select id from p))::integer;
end;
$$;

comment on function public.o_que_vai_com_o_mes(uuid) is
  'O que sai junto ao apagar um mes de social (0086), para o dialogo contar antes em vez de perguntar "tem certeza?". Sai da mesma ponte do apagamento: duas contas dariam um dialogo prometendo doze e um apagamento alcancando onze.';

revoke all on function public.o_que_vai_com_o_mes(uuid) from public, anon;
grant execute on function public.o_que_vai_com_o_mes(uuid) to authenticated;

notify pgrst, 'reload schema';
