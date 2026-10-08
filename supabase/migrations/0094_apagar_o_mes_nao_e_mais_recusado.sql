-- ===========================================================================
-- 0094 - APAGAR O MES DE SOCIAL DEIXA DE SER RECUSADO
--
-- Decisao do usuario, depois de bater na trava: *"quando tento excluir um mes
-- de social, ele bloqueia, com a seguinte mensagem: Este mes tem 2 post(s)
-- que ja foram ao cliente, e apaga-lo destruiria o historico de aprovacao. -
-- libera para ser excluido mesmo assim"*.
--
-- ---------------------------------------------------------------------------
-- O QUE A TRAVA DIZIA, E POR QUE ELA SAI
--
-- A 0086 escreveu que uma peca que o cliente viu "deixou de ser rascunho da
-- agencia e virou prova de trabalho combinado". O argumento continua valendo
-- como DESCRICAO do que se perde; o que ele nao e, e nunca foi, e uma razao
-- para o produto decidir isso no lugar de quem responde pela agencia.
--
-- Quem apaga um mes de social e `is_gestor()` -- desenvolvedor ou socio --, e
-- essa guarda FICA. O que sai e a segunda pergunta embaixo dela, e isto e a
-- 0060 pela terceira vez: a primeira pergunta ja barra todo mundo que nao
-- deve apagar, e a de baixo so alcancava exatamente as duas pessoas que o
-- usuario acabou de liberar.
--
-- **O QUE SE PERDE ESTA DITO, e e consequencia aceita por quem decidiu:** com
-- os posts vao as versoes, as artes, os comentarios e `approval_rounds` --
-- quem aprovou, quando, com que comentario. Nao ha volta, e o produto nao
-- guarda copia em lugar nenhum. As duas saidas que a recusa oferecia
-- continuam existindo e continuam sendo melhores quando servem: ARQUIVAR e um
-- carimbo (`tasks.arquivada_em`) que tira o mes da navegacao sem apagar nada,
-- e LIMPAR SO OS POSTS preserva a demanda, as fases, os responsaveis e as
-- datas. O que muda e que elas passam a ser escolha, e nao o unico caminho.
--
-- ---------------------------------------------------------------------------
-- A TRAVA ESTAVA EM TRES LUGARES, E DESFAZER UM SO NAO DESFAZ NADA
--
-- E a licao da 0029 e da 0060, e aqui ela e tripla:
--
--   1. `tasks_apaga_o_social()` -- o trigger, que e quem vale: ele pega o
--      "Excluir task" do board E qualquer `delete` montado a mao;
--   2. `apagar_mes_de_social()` -- a porta do Social Media;
--   3. `limpar_posts_do_mes()` -- a terceira porta, com a frase "limpa-lo".
--
-- Tirando so a 2, o botao do Social Media passaria a chamar a funcao e levar
-- a recusa do TRIGGER, com a mesma frase -- e quem lesse o diff concluiria
-- que a mudanca nao funcionou. Tirando so a 1 e a 2, "Apagar so os posts"
-- continuaria recusando, que e o caso mais provavel de todos: quem errou a
-- grade de um mes que ja saiu.
--
-- As tres saem nesta migration, e as frases das tres entram no
-- `npm run check:cores` -- que ja guarda as duas da 0029 e as duas da 0060
-- exatamente por isso.
--
-- ---------------------------------------------------------------------------
-- O QUE FICA DE PE
--
-- - `is_gestor()` nas duas funcoes. Abrir o mes e do Atendimento desde a 0046;
--   destruir o mes nao e, e essa separacao nao foi tocada.
-- - A ordem do PASSO 4 da 0086: os posts saem antes da demanda, entao o
--   trigger encontra zero post e o laco nao existe por construcao.
-- - `before delete` e nao `after`, pela mesma pegadinha de la: num `after` o
--   cascade ja zerou `posts.subtask_id`, `posts_do_mes()` acharia zero e os
--   posts ficariam orfaos sem erro nenhum.
-- - A recusa de "esta demanda nao e um mes de social", que nao e uma trava de
--   permissao: e a funcao dizendo que foi chamada sobre a coisa errada.
--
-- ---------------------------------------------------------------------------
-- E O AVISO FICA, AGORA DIZENDO O QUE SAIU
--
-- A 0086 ja emitia `raise notice` com os posts decididos pelo cliente, com a
-- razao escrita: *"ele existe para o dia em que alguem quiser contar isso na
-- mensagem"*. Esse dia e hoje, e o aviso passou a contar as DUAS coisas --
-- quantos foram ao cliente e quantos ele decidiu. Ele nao substitui nada: o
-- que faz alguem parar e a CONTAGEM no dialogo, que o Social Media ja mostra
-- antes do clique e que esta migration nao encosta.
--
-- Nenhuma tabela, nenhuma coluna, nenhuma policy mudam aqui.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O TRIGGER, QUE E QUEM VALE
-- ---------------------------------------------------------------------------
create or replace function public.tasks_apaga_o_social()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  enviados  integer;
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

  -- AQUI HAVIA A RECUSA, e ela saiu na 0094 por decisao do usuario. A
  -- contagem continua sendo feita porque e ela que vira o aviso abaixo: sem
  -- ele, um mes que levou junto a aprovacao do cliente sairia sem deixar
  -- nenhum rastro no log do banco.

  -- OS POSTS VAO JUNTO. O cascade de `post_versions`, `post_etapa_progresso`,
  -- `comments` e `approval_rounds` ja esta escrito nas migrations deles --
  -- aqui basta apagar o post.
  delete from public.posts p where p.id in (select id from public.posts_do_mes(old.id));

  if enviados > 0 then
    raise notice
      'Mês de social apagado com % post(s) que já tinham ido ao cliente (% decidido(s) por ele).',
      enviados, decididos;
  end if;

  return old;
end;
$$;

comment on function public.tasks_apaga_o_social is
  'Apagar a demanda do mes apaga os posts dele (0086). A recusa do post ja enviado saiu na 0094, por decisao do usuario: o que resta e o aviso no log. E `before delete` porque num `after` o cascade ja zerou `posts.subtask_id` e os posts ficariam orfaos sem erro.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A PORTA DO SOCIAL MEDIA
--
-- Ela devolve quantas pecas sairam, e esse numero e o que a tela usa na
-- mensagem de sucesso -- por isso o `select` continua aqui mesmo sem a trava.
-- ---------------------------------------------------------------------------
create or replace function public.apagar_mes_de_social(p_task_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  mes     date;
  quantos integer;
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

  select count(*) into quantos from public.posts_do_mes(p_task_id) p;

  delete from public.tasks where id = p_task_id;
  return quantos;
end;
$$;

comment on function public.apagar_mes_de_social(uuid) is
  'Apaga um mes de social inteiro -- os posts e a demanda -- numa transacao so (0086). Os posts saem primeiro, entao o trigger `tasks_apaga_o_social` encontra zero e o laco nao existe por construcao. A recusa do post ja enviado saiu na 0094.';

revoke all on function public.apagar_mes_de_social(uuid) from public, anon;
grant execute on function public.apagar_mes_de_social(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 3 - LIMPAR SO OS POSTS
--
-- *"Util quando a grade saiu errada mas os responsaveis e prazos estao
-- certos."* Ela apaga os posts e deixa a demanda, as fases, os responsaveis e
-- as datas de pe -- e e justamente a saida que a recusa da 0086 oferecia e
-- depois negava, porque a mesma trava valia aqui.
-- ---------------------------------------------------------------------------
create or replace function public.limpar_posts_do_mes(p_task_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  quantos integer;
begin
  if not public.is_gestor() then
    raise exception 'Limpar os posts de um mês é do desenvolvedor ou do sócio.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.tasks t where t.id = p_task_id and t.social_do_mes is not null) then
    raise exception 'Esta demanda não é um mês de social.';
  end if;

  select count(*) into quantos from public.posts_do_mes(p_task_id) p;

  delete from public.posts p where p.id in (select id from public.posts_do_mes(p_task_id));
  return quantos;
end;
$$;

comment on function public.limpar_posts_do_mes(uuid) is
  'Apaga os posts de um mes e deixa a demanda, as fases e os prazos de pe (0086), para quem errou a grade. A recusa do post ja enviado saiu na 0094, por decisao do usuario.';

revoke all on function public.limpar_posts_do_mes(uuid) from public, anon;
grant execute on function public.limpar_posts_do_mes(uuid) to authenticated;


-- ===========================================================================
-- CONFERENCIA, para colar depois de aplicar.
--
-- As tres funcoes nao podem mais conter a frase da recusa. E a mesma forma do
-- `select` de conferencia da 0087: o que se mede e o CORPO, porque uma funcao
-- reescrita pela metade compila e recusa do mesmo jeito.
-- ===========================================================================
-- select p.proname,
--        position('já foram ao cliente' in p.prosrc) = 0 as sem_a_trava
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('tasks_apaga_o_social', 'apagar_mes_de_social', 'limpar_posts_do_mes')
--  order by 1;
