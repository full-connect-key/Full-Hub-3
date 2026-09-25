-- ===========================================================================
-- 28 - QUEM OUVE O CANAL DA EQUIPE (migration 0057)
--
-- O Painel se atualiza sozinho por um canal de broadcast do Realtime. Esta
-- policy e a UNICA coisa que decide quem escuta -- o nome do canal e uma
-- palavra, e ela viaja no bundle que o navegador baixa.
--
-- O aviso nao carrega dado nenhum, so `{ "motivo": "task" }`. Mas carrega
-- RITMO: um cliente inscrito veria a agencia trabalhando ao vivo -- quantas
-- mexidas por hora, em que horario, em que dia nao teve nenhuma.
--
-- O QUE ESTES CENARIOS NAO PROVAM, e fica escrito: `realtime.messages` aqui e
-- o stub do `_fixture_supabase.sql`. Ele reproduz a forma que a policy le
-- (o topico, a extensao) e nao o servidor de Realtime. O que se verifica e a
-- REGRA -- quem passa e quem nao passa --, que e a parte que mora neste
-- repositorio.
-- ===========================================================================

-- Como `teste.cenario`, mas informando tambem o topico que esta sendo
-- autorizado -- e o que `realtime.topic()` le.
create or replace function teste.ouve_o_canal(
  p_descricao text,
  p_uid       uuid,
  p_topico    text,
  p_esperado  boolean       -- true = recebe a mensagem
) returns void
language plpgsql
as $$
declare
  achou integer;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    perform set_config('realtime.topic', p_topico, true);
    select count(*) into achou from realtime.messages;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'FALHOU', left(sqlerrm, 120));
    return;
  end;

  insert into teste.resultado (descricao, situacao, detalhe)
  values (p_descricao,
          case when (achou > 0) = p_esperado then 'passou' else 'FALHOU' end,
          format('viu %s mensagem(ns) no topico %s', achou, p_topico));
end;
$$;

-- Uma mensagem no canal da equipe, escrita como o servidor escreveria.
do $$
begin
  set local role service_role;
  insert into realtime.messages (topic, extension, event, payload)
  values ('equipe', 'broadcast', 'mudou', '{"motivo":"task"}'::jsonb);
  -- E uma num canal que ninguem deste produto usa, para provar que a policy
  -- olha o TOPICO e nao so o perfil.
  insert into realtime.messages (topic, extension, event, payload)
  values ('outro-canal', 'broadcast', 'mudou', '{"motivo":"task"}'::jsonb);
  reset role;
end $$;

select teste.ouve_o_canal('o socio ouve o canal da equipe',
  '11111111-1111-1111-1111-111111111111', 'equipe', true);

select teste.ouve_o_canal('o desenvolvedor ouve o canal da equipe',
  '22222222-2222-2222-2222-222222222222', 'equipe', true);

select teste.ouve_o_canal('o colaborador ouve o canal da equipe',
  '33333333-3333-3333-3333-333333333333', 'equipe', true);

-- O CENARIO QUE IMPORTA.
select teste.ouve_o_canal('o CLIENTE nao ouve o canal da equipe',
  '77777777-7777-7777-7777-777777777777', 'equipe', false);

select teste.ouve_o_canal('o segundo cliente tambem nao',
  '88888888-8888-8888-8888-888888888888', 'equipe', false);

-- A POLICY OLHA O TOPICO, e nao so quem esta perguntando. Sem esta linha,
-- `is_staff()` sozinho abriria a equipe para qualquer canal que alguem
-- inventasse -- inclusive um que uma tela futura usasse para outra coisa.
select teste.ouve_o_canal('nem a equipe ouve um canal que nao e o dela',
  '11111111-1111-1111-1111-111111111111', 'outro-canal', false);


-- ---------------------------------------------------------------------------
-- NINGUEM PUBLICA NO CANAL, e a ausencia de policy de INSERT e a regra
--
-- Se o navegador pudesse publicar, qualquer pessoa da equipe mandaria "mudou"
-- em laco e poria a tela de todo mundo recarregando sem parar -- com a chave
-- anon, que e publica. O aviso sai do servidor, com a chave de servico.
-- ---------------------------------------------------------------------------

do $$
declare deu boolean := false;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub',
                       '11111111-1111-1111-1111-111111111111', true);
    perform set_config('realtime.topic', 'equipe', true);
    insert into realtime.messages (topic, extension, event, payload)
    values ('equipe', 'broadcast', 'mudou', '{"motivo":"forjado"}'::jsonb);
    deu := true;
    reset role;
  exception when others then
    reset role;
  end;
  insert into teste.resultado (descricao, situacao, detalhe)
  values ('nem o socio PUBLICA no canal da equipe',
          case when deu then 'FALHOU' else 'passou' end,
          case when deu then 'o insert passou' else 'recusado, como deve' end);
end $$;

select teste.conferir(
  'realtime.messages tem RLS ligada',
  (select relrowsecurity::text from pg_class where oid = 'realtime.messages'::regclass),
  'true');

select teste.conferir(
  'existe UMA policy no canal, e ela e de select',
  (select string_agg(policyname || ':' || cmd, ',' order by policyname)
     from pg_policies where schemaname = 'realtime' and tablename = 'messages'),
  'equipe_ouve_o_canal:SELECT');


-- ---------------------------------------------------------------------------
-- NENHUMA TABELA ENTRA NA PUBLICACAO DO REALTIME
--
-- Este cenario guarda a decisao inteira do Sprint 16 / Parte A: o caminho
-- obvio (`postgres_changes`) empurra a LINHA INTEIRA para cada navegador
-- inscrito, e neste produto o Painel e o Portal leem as mesmas tabelas. Um
-- `alter publication supabase_realtime add table public.tasks` posto sem
-- pensar poria a corretude de um filtro do outro lado de um servico que esta
-- bateria nao alcanca -- e num banco com um cliente so, vazar tudo e mostrar
-- o certo tem a mesma cara.
--
-- O stub do fixture nao cria a publicacao, entao aqui a resposta e zero de
-- qualquer jeito; num banco de verdade ela conta o que foi publicado. O
-- cenario existe para o dia em que alguem acrescentar a linha.
-- ---------------------------------------------------------------------------

select teste.conferir(
  'nenhuma tabela deste produto entra na publicacao do Realtime',
  (select coalesce(count(*)::text, '0') from pg_publication p
     join pg_publication_rel pr on pr.prpubid = p.oid
    where p.pubname = 'supabase_realtime'),
  '0');
