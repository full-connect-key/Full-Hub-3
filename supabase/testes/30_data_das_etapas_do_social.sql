-- ===========================================================================
-- 30 - A CORRENTE DO MES TEM UM DIA POR ETAPA (migrations 0059 e 0083)
--
-- O que estes cenarios guardam, em uma frase: o dia de cada etapa e escolhido
-- ao abrir o mes e vale para o mes INTEIRO, a corrente nao vence de tras para
-- a frente, e a etapa com dia entra no calendario de quem e dela -- e so dele.
--
-- ---------------------------------------------------------------------------
-- OS CENARIOS DA 0059 FICARAM, VIRADOS DO AVESSO
--
-- Ela datava cada etapa por OFFSET da publicacao de cada post, e a 0083
-- desfez isso por decisao do usuario: *"ele precisa parar de ficar marcada
-- para ser feita em X dias antes do post ser publicado"*. Os cenarios que
-- provavam o offset -- a regra guardada esperando o dia, o recalculo quando o
-- post anda, o volante que se pega datando a mao -- continuam aqui medindo o
-- contrario: se alguem devolver a coluna ou qualquer um dos dois triggers, um
-- deles falha e diz qual.
-- ===========================================================================

-- Estado de partida escrito aqui, como nos arquivos 27 e 29: os cenarios
-- afirmam datas exatas, e isso so e verdade a partir de um ponto conhecido.
delete from public.post_etapas e
 using public.posts p
 where p.id = e.post_id and p.tema like 'Bateria 0083%';
delete from public.posts where tema like 'Bateria 0083%';


-- ---------------------------------------------------------------------------
-- 1. O OFFSET SAIU DO BANCO, com os dois triggers que o serviam
--
-- A coluna primeiro: ela era a regra, e deixa-la parada manteria no schema
-- algo que nenhum caminho escreve e que a proxima pessoa leria como ativo --
-- a decisao da 0023.
-- ---------------------------------------------------------------------------

select teste.conferir('`post_etapas.prazo_offset_dias` não existe mais',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'post_etapas'
      and column_name = 'prazo_offset_dias'), '0');

-- E OS DOIS TRIGGERS SAIRAM JUNTO, que é a metade que importa mais: o da
-- esquerda moveria o dia da Pauta do mês inteiro porque alguém trocou a data
-- de UM post, e é exatamente o comportamento que o usuário pediu para tirar.
-- Tirar só a tela deixaria o banco desfazendo a escolha por baixo — a lição
-- da 0029, onde a regra morava nos dois lados.
select teste.conferir('o trigger que recalculava o prazo pela data do post saiu',
  (select count(*)::text from pg_trigger
    where tgname in ('posts_recalcula_prazos', 'post_etapas_solta_o_offset')
      and not tgisinternal), '0');

select teste.conferir('e as duas funções dele também',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('recalcular_prazos_do_post', 'post_etapas_solta_o_offset')), '0');


-- ---------------------------------------------------------------------------
-- 2. UM DIA POR ETAPA, IGUAL PARA O MES INTEIRO
--
-- O CENARIO QUE JUSTIFICA A MIGRATION. A frase do usuário em uma linha: *"em
-- um dia X de Outubro, a Social Media vai ter um dia para fazer a pauta do mês
-- todo"*. Três posts, três datas de publicação diferentes — e uma Pauta só, no
-- mesmo dia para os três.
-- ---------------------------------------------------------------------------

select teste.cenario('A gestão abre três posts com um dia por etapa',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-11', '[{"redes": ["instagram"], "quantidade": 3}]'::jsonb,
      null, '{}'::jsonb,
      '{"Pauta": "2027-10-05", "Conteúdo": "2027-10-12",
        "Layout": "2027-10-20", "Envio": "2027-10-25",
        "Programar": "2027-10-30"}'::jsonb,
      'https://drive.google.com/drive/folders/PASTA-0083')$$,
  'ok', 1);

-- AS TRES PAUTAS VENCEM NO MESMO DIA, e é isso que o modelo antigo não sabia
-- fazer: com offset, cada uma caía dez dias antes da publicação do SEU post.
select teste.conferir('as três Pautas do mês vencem no mesmo dia',
  (select count(distinct prazo)::text || ' de ' || count(*)::text
     from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema like '%· Novembro/2027' and e.nome = 'Pauta'), '1 de 3');

-- `string_agg(distinct)` E NAO `select distinct`: com mais de uma data o
-- segundo estoura com *"more than one row returned by a subquery"*, que
-- derruba o ARQUIVO em vez de reprovar o cenario -- e um cenario que explode
-- não diz qual é a resposta errada. Medido com mutação: fazendo o prazo
-- depender do post de novo, este aqui responde as três datas.
select teste.conferir('e esse dia é o que foi escolhido',
  (select string_agg(distinct prazo::text, ',' order by prazo::text)
     from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema like '%· Novembro/2027' and e.nome = 'Pauta'), '2027-10-05');

select teste.conferir('cada etapa tem o SEU dia, e a corrente anda na ordem',
  (select string_agg(distinct prazo::text, ',' order by prazo::text)
     from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema like '%· Novembro/2027'),
  '2027-10-05,2027-10-12,2027-10-20,2027-10-25,2027-10-30');

-- A DATA NAO PRECISA CAIR DENTRO DO MES, e é decisão: o social de novembro é
-- produzido em outubro inteiro. A trava óbvia — "a etapa vence dentro do mês"
-- — recusaria exatamente o caso que o usuário descreveu.
select teste.conferir('as cinco datas são de OUTUBRO, e o mês é novembro',
  (select count(*)::text from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema like '%· Novembro/2027' and extract(month from e.prazo) = 10), '15');


-- ---------------------------------------------------------------------------
-- 3. O POST ANDA E A CORRENTE FICA ONDE ESTA
--
-- É o avesso do cenário central da 0059, onde mover a publicação movia as
-- cinco etapas junto. Agora o dia da Pauta é do MÊS: trocar a data de um post
-- não mexe no dia em que a social media vai pautar o mês inteiro.
-- ---------------------------------------------------------------------------

do $$
declare v_post uuid;
begin
  select p.id into v_post from public.posts p
   where p.tema = 'Instagram 1 de 3 · Novembro/2027';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.posts set data_publicacao = '2027-11-28' where id = v_post;
  reset role;
end $$;

select teste.conferir('o post andou e a Pauta dele NÃO andou junto',
  (select e.prazo::text from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Instagram 1 de 3 · Novembro/2027' and e.nome = 'Pauta'),
  '2027-10-05');

-- E AS TRES CONTINUAM NO MESMO DIA. Com o trigger antigo de pé, só a deste
-- post teria se mexido — e a resposta aqui seria "2 de 3", que é o estado em
-- que a corrente do mês deixa de ser do mês.
select teste.conferir('e as três Pautas continuam sendo uma data só',
  (select count(distinct prazo)::text || ' de ' || count(*)::text
     from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema like '%· Novembro/2027' and e.nome = 'Pauta'), '1 de 3');


-- ---------------------------------------------------------------------------
-- 4. DATAR UMA ETAPA A MAO CONTINUA VALENDO, e agora sem efeito colateral
--
-- Na 0059 isso limpava a regra daquela etapa, porque senão o próximo recálculo
-- a desfaria. Sem recálculo, a escrita à mão é só uma escrita à mão — e as
-- outras não são tocadas.
-- ---------------------------------------------------------------------------

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.post_etapas e set prazo = '2027-10-22'
   from public.posts p
   where p.id = e.post_id and p.tema = 'Instagram 2 de 3 · Novembro/2027'
     and e.nome = 'Layout';
  reset role;
end $$;

select teste.conferir('datar uma etapa à mão grava o dia dela',
  (select e.prazo::text from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Instagram 2 de 3 · Novembro/2027' and e.nome = 'Layout'),
  '2027-10-22');

select teste.conferir('e não encosta no Layout dos outros dois',
  (select count(*)::text from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema like '%· Novembro/2027' and e.nome = 'Layout'
      and e.prazo = '2027-10-20'), '2');

-- MEXER NO STATUS NAO ENCOSTA NA DATA. O trigger da 0059 precisava de duas
-- condições para não apagar a regra de passagem; sem ele, a pergunta continua
-- valendo e a resposta é mais simples — nada toca a data senão quem a escreve.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.post_etapas e set status = 'em_andamento'
   from public.posts p
   where p.id = e.post_id and p.tema = 'Instagram 3 de 3 · Novembro/2027'
     and e.nome = 'Pauta';
  reset role;
end $$;

select teste.conferir('mexer no status não apaga o dia da etapa',
  (select e.prazo::text from public.post_etapas e join public.posts p on p.id = e.post_id
    where p.tema = 'Instagram 3 de 3 · Novembro/2027' and e.nome = 'Pauta'),
  '2027-10-05');


-- ---------------------------------------------------------------------------
-- 5. A ETAPA NO CALENDARIO, e quem NAO a vê
--
-- A sexta origem da `calendar_events`. O cenário do cliente é o que importa: a
-- corrente de produção é interna, e o portal mostra material enviado — não o
-- ritmo de quem o faz.
-- ---------------------------------------------------------------------------

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.post_etapas e set responsavel_id = '33333333-3333-3333-3333-333333333333'
   from public.posts p
   where p.id = e.post_id and p.tema like '%· Novembro/2027' and e.nome = 'Conteúdo';
  reset role;
end $$;

select teste.conferir_como(
  'a etapa com dia aparece no calendário da equipe',
  '33333333-3333-3333-3333-333333333333',
  $$select count(*)::text from public.calendar_events
     where tipo = 'etapa_de_post' and titulo like 'Conteúdo · Instagram % de 3 · Novembro/2027'$$,
  '3');

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
     where tipo = 'etapa_de_post'
       and titulo like 'Conteúdo · Instagram 1 de 3 · Novembro/2027' limit 1$$,
  'true');

select teste.conferir_como(
  'a etapa carrega o responsável, senão não entra no calendário de ninguém',
  '33333333-3333-3333-3333-333333333333',
  $$select user_id::text from public.calendar_events
     where tipo = 'etapa_de_post'
       and titulo like 'Conteúdo · Instagram 1 de 3 · Novembro/2027' limit 1$$,
  '33333333-3333-3333-3333-333333333333');


-- ---------------------------------------------------------------------------
-- 6. O QUE A FUNCAO RECUSA
-- ---------------------------------------------------------------------------

select teste.recusa_com(
  'a corrente não pode vencer de trás para a frente',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-12', '[{"redes": ["instagram"], "quantidade": 1}]'::jsonb, null, '{}'::jsonb,
      '{"Conteúdo": "2027-11-20", "Layout": "2027-11-10"}'::jsonb)$$,
  'venceria antes da etapa anterior');

select teste.recusa_com(
  'etapa que não existe na corrente é recusada pelo nome',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-12', '[{"redes": ["instagram"], "quantidade": 1}]'::jsonb, null, '{}'::jsonb,
      '{"Revisão": "2027-11-10"}'::jsonb)$$,
  'não tem etapa chamada');

-- O OFFSET DA 0059 E RECUSADO COM FRASE PROPRIA, e não com um erro sobre
-- sintaxe de entrada de `date`. Quem cair aqui está mandando a forma antiga, e
-- a recusa precisa dizer qual é a nova — é a decisão do objeto de quantidades
-- na 0082.
select teste.recusa_com_dica(
  'o número da 0059 é recusado dizendo que agora é dia',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-12', '[{"redes": ["instagram"], "quantidade": 1}]'::jsonb, null, '{}'::jsonb,
      '{"Pauta": -10}'::jsonb)$$,
  'não mais um número de dias antes da publicação');


-- ---------------------------------------------------------------------------
-- 7. UMA VERSAO SO DA FUNCAO
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
  'p_client_id uuid, p_mes text, p_quantidades jsonb, p_responsavel_id uuid, p_responsaveis jsonb, p_prazos jsonb, p_link_entrega text');

-- E A VIEW CONTINUA COM `security_invoker`. O `create or replace view` da 0059
-- teve que repetir a clausula: ele NAO herda a do objeto que substitui, e sem
-- ela a view leria as tabelas de origem inteiras para qualquer pessoa
-- autenticada.
select teste.conferir(
  'calendar_events continua com security_invoker depois do replace',
  (select (reloptions @> array['security_invoker=true'])::text
     from pg_class where relname = 'calendar_events'),
  'true');
