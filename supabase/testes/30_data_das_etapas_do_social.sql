-- ===========================================================================
-- 30 - A DATA DE CADA ETAPA DO SOCIAL (migration 0059)
--
-- O que estes cenarios guardam, em uma frase: a regra de data se aplica
-- sozinha, o volante se pega, e a etapa que ganhou dia entra no calendario
-- de quem e dela -- e so dele.
-- ===========================================================================

-- Estado de partida escrito aqui, como nos arquivos 27 e 29: os cenarios
-- afirmam datas exatas, e isso so e verdade a partir de um ponto conhecido.
delete from public.post_etapas e
 using public.posts p
 where p.id = e.post_id and p.tema like 'Bateria 0059%';
delete from public.posts where tema like 'Bateria 0059%';

do $$
declare v_post uuid; v_cliente uuid;
begin
  select id into v_cliente from public.clients order by created_at limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);

  insert into public.posts (client_id, tema, plataforma, midia, criado_por, responsavel_id)
  values (v_cliente, 'Bateria 0059 · post com regra', 'instagram', 'imagem',
          '11111111-1111-1111-1111-111111111111',
          '33333333-3333-3333-3333-333333333333')
  returning id into v_post;

  -- As cinco etapas nascem por trigger (0045). A regra entra aqui, como
  -- `abrir_mes_de_social` faz.
  update public.post_etapas set prazo_offset_dias = case nome
      when 'Pauta' then -10 when 'Conteúdo' then -7 when 'Layout' then -4
      when 'Envio' then -3 when 'Programar' then 0 end
   where post_id = v_post;

  update public.post_etapas set responsavel_id = '33333333-3333-3333-3333-333333333333'
   where post_id = v_post and nome = 'Conteúdo';

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- A REGRA FICA GUARDADA ESPERANDO O DIA
--
-- O mes abre em branco desde a 0044, e "sem data ainda" e um estado de
-- verdade do trabalho. Sem este cenario, alguem poderia "consertar" a funcao
-- para exigir data na abertura -- desfazendo a decisao da 0044 por dentro.
-- ---------------------------------------------------------------------------

select teste.conferir(
  'com o post sem data, as cinco etapas tem regra e nenhuma tem dia',
  (select count(*) filter (where prazo_offset_dias is not null)::text || '/' ||
          count(*) filter (where prazo is not null)::text
     from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Bateria 0059 · post com regra'),
  '5/0');

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.posts set data_publicacao = '2026-11-15'
   where tema = 'Bateria 0059 · post com regra';
  reset role;
end $$;

select teste.conferir(
  'escrever o dia da publicação põe as cinco no calendário de uma vez',
  (select string_agg(prazo::text, ',' order by ordem)
     from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Bateria 0059 · post com regra'),
  '2026-11-05,2026-11-08,2026-11-11,2026-11-12,2026-11-15');


-- ---------------------------------------------------------------------------
-- O VOLANTE
--
-- Editar o prazo a mao limpa a regra daquela etapa, e so dela. E a decisao da
-- 0025 aplicada aqui: aceitar o clique e desfaze-lo no proximo recalculo e
-- pior que recusar, porque a escolha some sem ninguem ver.
-- ---------------------------------------------------------------------------

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.post_etapas e set prazo = '2026-11-13'
   from public.posts p
   where p.id = e.post_id and p.tema = 'Bateria 0059 · post com regra'
     and e.nome = 'Layout';
  reset role;
end $$;

select teste.conferir(
  'datar uma etapa a mão limpa a REGRA dela',
  (select coalesce(prazo_offset_dias::text, '(sem regra)')
     from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Bateria 0059 · post com regra' and e.nome = 'Layout'),
  '(sem regra)');

select teste.conferir(
  'e não mexe na regra das outras quatro',
  (select count(*)::text from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Bateria 0059 · post com regra' and e.prazo_offset_dias is not null),
  '4');

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.posts set data_publicacao = '2026-11-22'
   where tema = 'Bateria 0059 · post com regra';
  reset role;
end $$;

select teste.conferir(
  'o post anda e as com regra andam junto',
  (select prazo::text from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Bateria 0059 · post com regra' and e.nome = 'Pauta'),
  '2026-11-12');

-- O CENARIO QUE PROVA O VOLANTE. Sem ele, um recalculo que ignorasse o offset
-- nulo passaria em todos os de cima e sobrescreveria a data que alguem pos.
select teste.conferir(
  'a etapa datada à mão NÃO anda com o post',
  (select prazo::text from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Bateria 0059 · post com regra' and e.nome = 'Layout'),
  '2026-11-13');

-- E O UPDATE QUE NAO MEXE NO PRAZO NAO PODE LIMPAR REGRA NENHUMA. Sem a
-- condicao dupla do trigger, mudar o status de uma etapa apagaria a data dela
-- de passagem -- e o sintoma seria uma etapa que para de andar com o post sem
-- ninguem ter tocado na data.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.post_etapas e set status = 'em_andamento'
   from public.posts p
   where p.id = e.post_id and p.tema = 'Bateria 0059 · post com regra'
     and e.nome = 'Pauta';
  reset role;
end $$;

select teste.conferir(
  'mexer no status não apaga a regra de data',
  (select prazo_offset_dias::text from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Bateria 0059 · post com regra' and e.nome = 'Pauta'),
  '-10');


-- ---------------------------------------------------------------------------
-- A ETAPA NO CALENDARIO, e quem NAO a vê
--
-- A oitava origem da `calendar_events`. O cenario do cliente é o que importa:
-- a corrente de produção é interna, e o portal mostra material enviado — não
-- o ritmo de quem o faz.
-- ---------------------------------------------------------------------------

select teste.conferir_como(
  'a etapa com dia aparece no calendário da equipe',
  '33333333-3333-3333-3333-333333333333',
  $$select count(*)::text from public.calendar_events
     where tipo = 'etapa_de_post' and titulo like 'Conteúdo · Bateria 0059%'$$,
  '1');

select teste.conferir_como(
  'o CLIENTE não vê etapa de post no calendário',
  '77777777-7777-7777-7777-777777777777',
  $$select count(*)::text from public.calendar_events where tipo = 'etapa_de_post'$$,
  '0');

-- O `client_id` VEM DO POST, e sem o join ele seria nulo: o filtro por cliente
-- do calendário deixaria estas linhas passar SEMPRE, o que parece "sem filtro"
-- e é pauta de uma conta aparecendo na tela de quem filtrou por outra.
select teste.conferir_como(
  'a etapa carrega o cliente do post',
  '33333333-3333-3333-3333-333333333333',
  $$select (client_id is not null)::text from public.calendar_events
     where tipo = 'etapa_de_post' and titulo like 'Conteúdo · Bateria 0059%' limit 1$$,
  'true');

select teste.conferir_como(
  'a etapa carrega o responsável, senão não entra no calendário de ninguém',
  '33333333-3333-3333-3333-333333333333',
  $$select user_id::text from public.calendar_events
     where tipo = 'etapa_de_post' and titulo like 'Conteúdo · Bateria 0059%' limit 1$$,
  '33333333-3333-3333-3333-333333333333');


-- ---------------------------------------------------------------------------
-- O QUE A FUNCAO RECUSA
-- ---------------------------------------------------------------------------

select teste.recusa_com(
  'a corrente não pode vencer de trás para a frente',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2026-12', '{"instagram": 1}'::jsonb, null, '{}'::jsonb,
      '{"Conteúdo": -3, "Layout": -9}'::jsonb)$$,
  'venceria antes da etapa anterior');

select teste.recusa_com(
  'etapa que não existe na corrente é recusada pelo nome',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2026-12', '{"instagram": 1}'::jsonb, null, '{}'::jsonb,
      '{"Revisão": -3}'::jsonb)$$,
  'não tem etapa chamada');

select teste.recusa_com(
  'prazo absurdo é erro de digitação, e o banco diz isso',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2026-12', '{"instagram": 1}'::jsonb, null, '{}'::jsonb,
      '{"Pauta": -900}'::jsonb)$$,
  'dias da publicação');


-- ---------------------------------------------------------------------------
-- UMA VERSAO SO DA FUNCAO
--
-- Acrescentar um parametro cria uma funcao NOVA no Postgres: a de cinco
-- argumentos continuaria existindo, e o PostgREST escolheria uma das duas
-- conforme o corpo do pedido. Duas versoes da mesma funcao e o lugar onde as
-- duas verdades comecam a divergir -- e a que ficasse para tras abriria o mes
-- ignorando as datas, sem erro nenhum.
-- ---------------------------------------------------------------------------

select teste.conferir(
  'existe UMA abrir_mes_de_social, e ela recebe os prazos',
  (select string_agg(pg_get_function_identity_arguments(p.oid), ' | ')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'abrir_mes_de_social'),
  'p_client_id uuid, p_mes text, p_quantidades jsonb, p_responsavel_id uuid, p_responsaveis jsonb, p_prazos jsonb');

-- E A VIEW CONTINUA COM `security_invoker`. O `create or replace view` da 0059
-- teve que repetir a clausula: ele NAO herda a do objeto que substitui, e sem
-- ela a view leria as oito tabelas inteiras para qualquer pessoa autenticada.
select teste.conferir(
  'calendar_events continua com security_invoker depois do replace',
  (select (reloptions @> array['security_invoker=true'])::text
     from pg_class where relname = 'calendar_events'),
  'true');
