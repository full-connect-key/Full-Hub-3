\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''

-- ===========================================================================
-- 48 - O ACESSO RAPIDO APRENDE O QUE CADA PESSOA USA (migration 0142)
--
-- Decisao do usuario: *"registrar o uso numa tabela nova, por pessoa e por
-- rota, com RLS fechada no dono da linha. O Acesso Rapido ordena por
-- frequencia e so oferece o que o perfil alcanca."*
--
-- ---------------------------------------------------------------------------
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "a rota largada cai abaixo da
-- semanal". Ele e a diferenca entre as duas leituras do pedido: uma CONTAGEM
-- de vida inteira responde *quanto eu ja usei* e nunca esquece, e o pedido diz
-- FREQUENCIA. Sem este cenario, trocar o decaimento por `peso + 1` passaria em
-- todos os outros -- a primeira visita, o respiro do F5 e a RLS respondem
-- igual nas duas versoes.
--
-- E O CENARIO QUE SEPARA O CERTO DO PLAUSIVEL e "o F5 nao reancora". Nao
-- contar duas vezes e o obvio; o que quase escapa e que uma visita dentro do
-- respiro tambem nao pode mexer em `visto_em` -- reancorar sem contar apagaria
-- o decaimento acumulado, e a visita seguinte decairia de MENOS. Ele le a
-- ancora, e nao so o peso.
--
-- E A RLS SE MEDE NOS DOIS SENTIDOS, com o socio no lado de fora: esta tabela
-- e a regua de `client_notification_prefs` -- nem ele le a de outra pessoa.
-- Medir so "a Marina le a dela" passaria numa policy que abre para todo mundo.
-- ===========================================================================

select teste.limpar();
delete from public.route_visits;

-- --- 1. A PRIMEIRA VISITA -------------------------------------------------

select teste.cenario('A pessoa registra a propria visita', :MARINA,
  $$select public.registrar_visita('/painel/social-media')$$, 'passa');

select teste.conferir_como('A primeira visita nasce com peso 1', :MARINA,
  $$select round(peso, 2)::text from public.route_visits
     where href = '/painel/social-media'$$,
  '1.00');

-- --- 2. O F5 NAO CONTA, E NAO REANCORA ------------------------------------

-- A ANCORA RECUA 9 MINUTOS -- dentro do respiro, e longe o bastante do agora
-- para a reancoragem APARECER. Sem este recuo, o cenario mede o peso e deixa
-- passar a versao que reancora: os dois estados ficam no mesmo segundo.
update public.route_visits set visto_em = now() - interval '9 minutes'
 where href = '/painel/social-media';

select teste.montar_como(:MARINA,
  $$select public.registrar_visita('/painel/social-media')$$);
select teste.montar_como(:MARINA,
  $$select public.registrar_visita('/painel/social-media')$$);

select teste.conferir_como('O F5 dentro do respiro nao soma', :MARINA,
  $$select round(peso, 2)::text from public.route_visits
     where href = '/painel/social-media'$$,
  '1.00');

-- E A ANCORA TEM DE ESTAR INTACTA, que e o que separa "nao conta" de "nao
-- conta e nao reancora": reancorar sem contar apagaria o decaimento acumulado
-- desde a ultima visita de verdade, e a proxima decairia de MENOS.
select teste.conferir_como('O F5 tambem nao reancora', :MARINA,
  $$select case when now() - visto_em > interval '8 minutes'
                then 'intacta' else 'reancorou' end
      from public.route_visits where href = '/painel/social-media'$$,
  'intacta');

update public.route_visits set visto_em = now() - interval '10 days'
 where href = '/painel/social-media';
select teste.montar_como(:MARINA,
  $$select public.registrar_visita('/painel/social-media')$$);

select teste.conferir_como('Passado o respiro, a visita conta com decaimento', :MARINA,
  $$select round(peso, 2)::text from public.route_visits
     where href = '/painel/social-media'$$,
  -- 1 * 0,5^(10/30) + 1 = 1,7937...
  '1.79');

-- --- 3. A ROTA LARGADA CAI ABAIXO DA SEMANAL ------------------------------

delete from public.route_visits;

-- DIARIA: 60 visitas, uma por dia.
do $$
begin
  for i in 1..60 loop
    perform teste.montar_como('55555555-5555-5555-5555-555555555555',
      $m$select public.registrar_visita('/painel/minhas-tasks')$m$);
    update public.route_visits set visto_em = visto_em - interval '1 day'
     where href = '/painel/minhas-tasks';
  end loop;
end $$;

-- SEMANAL: 60 visitas, uma por semana.
do $$
begin
  for i in 1..60 loop
    perform teste.montar_como('55555555-5555-5555-5555-555555555555',
      $m$select public.registrar_visita('/painel/financeiro')$m$);
    update public.route_visits set visto_em = visto_em - interval '7 days'
     where href = '/painel/financeiro';
  end loop;
end $$;

-- LARGADA: a mesma rotina da diaria, parada ha 120 dias.
do $$
begin
  for i in 1..60 loop
    perform teste.montar_como('55555555-5555-5555-5555-555555555555',
      $m$select public.registrar_visita('/painel/gestao-tasks')$m$);
    update public.route_visits set visto_em = visto_em - interval '1 day'
     where href = '/painel/gestao-tasks';
  end loop;
end $$;
update public.route_visits set visto_em = now() - interval '120 days'
 where href = '/painel/gestao-tasks';
select teste.montar_como(:MARINA,
  $$select public.registrar_visita('/painel/gestao-tasks')$$);

select teste.conferir_como('A ordem e a da frequencia de HOJE', :MARINA,
  $$select string_agg(href, ' > ' order by peso desc) from public.route_visits$$,
  '/painel/minhas-tasks > /painel/financeiro > /painel/gestao-tasks');

-- E o NUMERO, porque "a ordem certa" tambem sai de uma contagem de vida
-- inteira quando as tres tem o mesmo numero de visitas. O que separa as duas
-- versoes e a rota largada estar ABAIXO da semanal.
select teste.conferir_como('A rota largada cai abaixo da semanal', :MARINA,
  $$select case when
       (select peso from public.route_visits where href = '/painel/gestao-tasks')
       < (select peso from public.route_visits where href = '/painel/financeiro')
     then 'cai' else 'nao cai' end$$,
  'cai');

-- --- 4. A RLS, NOS DOIS SENTIDOS ------------------------------------------

select teste.conferir_como('A pessoa le a propria lista', :MARINA,
  $$select count(*)::text from public.route_visits$$, '3');

select teste.conferir_como('O colega nao le a lista dela', :BRUNO,
  $$select count(*)::text from public.route_visits$$, '0');

-- O SOCIO TAMBEM NAO, e e por este que a regua existe: esta tabela diz quais
-- rotas uma pessoa abre mais, e isso e vigilancia e nao gestao.
select teste.conferir_como('Nem o socio le a lista de outra pessoa', :ANA,
  $$select count(*)::text from public.route_visits$$, '0');

select teste.cenario('Ninguem escreve na linha de outra pessoa', :BRUNO,
  $$insert into public.route_visits (user_id, href, peso)
    values ('55555555-5555-5555-5555-555555555555', '/painel/financeiro', 99)$$,
  'recusa');

-- --- 5. A ACL -------------------------------------------------------------

-- O `revoke from public` NAO basta, e isto foi medido: o Supabase deixa um
-- `alter default privileges` ligado no schema, e `anon` continuava executando.
-- E a licao da 0071.
select teste.conferir('anon nao executa registrar_visita',
  has_function_privilege('anon', 'public.registrar_visita(text)', 'execute')::text,
  'false');

select teste.conferir('authenticated executa registrar_visita',
  has_function_privilege('authenticated', 'public.registrar_visita(text)', 'execute')::text,
  'true');

-- --- 6. NAO HA POLICY DE DELETE -------------------------------------------

-- A ausencia e a decisao: a lista e derivada, e a rota que a pessoa deixa de
-- abrir cai sozinha pelo decaimento. Sem este cenario, acrescentar uma policy
-- de DELETE nao derrubaria nada.
select teste.conferir('route_visits nao tem policy de DELETE',
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'route_visits' and cmd = 'DELETE'),
  '0');

delete from public.route_visits;
