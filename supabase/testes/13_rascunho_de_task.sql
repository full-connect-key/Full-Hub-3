-- ===========================================================================
-- O RASCUNHO DE TASK (migration 0028).
--
-- A pergunta que estes cenarios respondem: o rascunho de uma pessoa some
-- mesmo para todo o resto da agencia -- inclusive para quem chamar a API
-- direto com o id na mao?
--
-- E a pergunta que importa. Um filtro de tela que esconde o rascunho da lista
-- nao esconde nada: basta abrir /painel/gestao-tasks/<id>. Por isso a trava e
-- de RLS, e por isso estes cenarios rodam como GENTE -- Carla do Atendimento
-- escreve o rascunho, Diego (desenvolvedor) e Ana (socia) tentam ler, e
-- Joana (cliente) tambem.
--
-- Nem o socio enxerga, e isso e deliberado: um rascunho e um pensamento pela
-- metade, nao um documento da agencia.
-- ===========================================================================

\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

select teste.limpar();

create or replace function teste.conta_tasks_visiveis(p_uid uuid, p_id uuid)
returns text language plpgsql as $$
declare n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  select count(*) into n from public.tasks where id = p_id;
  execute 'reset role';
  return n::text;
end $$;

-- ---------------------------------------------------------------------------
-- O rascunho nasce vazio, e isso e o ponto
--
-- Sem titulo, sem cliente, sem pasta de entrega. Se qualquer um dos tres
-- fosse exigido aqui, a tela teria que pedi-lo antes de abrir -- que e a
-- etapa a mais que este sprint existe para eliminar.
-- ---------------------------------------------------------------------------

select teste.cenario('Carla cria um rascunho vazio', :CARLA,
  format($fmt$insert into public.tasks (id, client_id, titulo, criado_por, publicada_em)
    values ('faaaaaaa-0000-0000-0000-00000000000a', null, '', %L, null)$fmt$, :CARLA),
  'ok', 1);

select teste.conferir('Carla enxerga o proprio rascunho',
  teste.conta_tasks_visiveis(:CARLA, 'faaaaaaa-0000-0000-0000-00000000000a'), '1');

-- ---------------------------------------------------------------------------
-- E nao vaza para mais ninguem, nem com o id na mao
-- ---------------------------------------------------------------------------

select teste.conferir('O desenvolvedor NAO enxerga o rascunho da Carla',
  teste.conta_tasks_visiveis(:DIEGO, 'faaaaaaa-0000-0000-0000-00000000000a'), '0');

select teste.conferir('Nem a socia',
  teste.conta_tasks_visiveis(:ANA, 'faaaaaaa-0000-0000-0000-00000000000a'), '0');

select teste.conferir('Nem o cliente',
  teste.conta_tasks_visiveis(:JOANA, 'faaaaaaa-0000-0000-0000-00000000000a'), '0');

-- Nem editar: a policy de update cai junto, porque ela precisa achar a linha.
select teste.cenario('O desenvolvedor nao edita o rascunho alheio', :DIEGO,
  $$update public.tasks set titulo = 'mexi aqui'
     where id = 'faaaaaaa-0000-0000-0000-00000000000a'$$, 'ok', 0);

-- ---------------------------------------------------------------------------
-- O que esta DENTRO do rascunho tambem nao vaza
--
-- Esconder a task e deixar a subtarefa aparecer seria esconder a capa e
-- deixar o miolo na mesa. A fila de aprovacoes, o calendario e Minhas Tasks
-- leem subtarefa direto.
-- ---------------------------------------------------------------------------

select teste.cenario('Carla monta uma etapa dentro do rascunho', :CARLA,
  format($fmt$insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id)
    values ('fbbbbbbb-0000-0000-0000-00000000000a', 'faaaaaaa-0000-0000-0000-00000000000a',
            'Etapa do rascunho', 1, %L)$fmt$, :MARINA), 'ok', 1);

select teste.cenario('E a Marina, que e a responsavel, NAO ve essa etapa', :MARINA,
  $$update public.subtasks set status = 'em_andamento'
     where id = 'fbbbbbbb-0000-0000-0000-00000000000a'$$, 'ok', 0);

select teste.cenario('Nem o desenvolvedor ve a etapa do rascunho', :DIEGO,
  $$update public.subtasks set prioridade = 'urgente'
     where id = 'fbbbbbbb-0000-0000-0000-00000000000a'$$, 'ok', 0);

select teste.cenario('Carla anexa uma referencia no rascunho', :CARLA,
  format($fmt$insert into public.task_referencias (id, task_id, tipo, url, adicionado_por)
    values ('fccccccc-0000-0000-0000-00000000000a', 'faaaaaaa-0000-0000-0000-00000000000a',
            'link', 'https://figma.com/rascunho', %L)$fmt$, :CARLA), 'ok', 1);

select teste.cenario('E o desenvolvedor nao alcanca a referencia', :DIEGO,
  $$delete from public.task_referencias
     where id = 'fccccccc-0000-0000-0000-00000000000a'$$, 'ok', 0);

-- ---------------------------------------------------------------------------
-- O que a publicacao exige
--
-- Titulo, cliente e pasta. Um de cada vez, para a recusa de cada um ser
-- provada -- se fossem todos juntos, bastaria uma das tres travas funcionar
-- para o cenario passar.
-- ---------------------------------------------------------------------------

select teste.recusa_com('Publicar sem titulo: recusa', :CARLA,
  $$update public.tasks set publicada_em = now()
     where id = 'faaaaaaa-0000-0000-0000-00000000000a'$$,
  'precisa de um título');

update public.tasks set titulo = 'Campanha de novembro'
 where id = 'faaaaaaa-0000-0000-0000-00000000000a';

select teste.recusa_com('Com titulo e sem cliente: recusa, e aponta o cliente', :CARLA,
  $$update public.tasks set publicada_em = now()
     where id = 'faaaaaaa-0000-0000-0000-00000000000a'$$,
  'Escolha o cliente');

update public.tasks set client_id = :VERDE
 where id = 'faaaaaaa-0000-0000-0000-00000000000a';

select teste.recusa_com('Com cliente e sem pasta: recusa, e aponta a pasta', :CARLA,
  $$update public.tasks set publicada_em = now()
     where id = 'faaaaaaa-0000-0000-0000-00000000000a'$$,
  'precisa da pasta de entrega');

update public.tasks set link_entrega = 'https://drive.google.com/drive/folders/nov'
 where id = 'faaaaaaa-0000-0000-0000-00000000000a';

-- E a etapa NAO e exigida: o sprint diz que publicar sem subtarefa avisa e
-- deixa seguir. (Esta tem uma, mas o cenario da task sem etapa nenhuma esta
-- logo abaixo.)
select teste.cenario('Com os tres, publica', :CARLA,
  $$update public.tasks set publicada_em = now()
     where id = 'faaaaaaa-0000-0000-0000-00000000000a'$$, 'ok', 1);

select teste.conferir('E agora o desenvolvedor enxerga',
  teste.conta_tasks_visiveis(:DIEGO, 'faaaaaaa-0000-0000-0000-00000000000a'), '1');

select teste.cenario('E a etapa de dentro tambem apareceu', :DIEGO,
  $$update public.subtasks set prioridade = 'alta'
     where id = 'fbbbbbbb-0000-0000-0000-00000000000a'$$, 'ok', 1);

-- Publicar sem nenhuma etapa passa: o aviso e da tela, nao do banco.
select teste.cenario('Demanda sem etapa nenhuma tambem publica', :CARLA,
  format($fmt$insert into public.tasks (client_id, titulo, criado_por, link_entrega, publicada_em)
    values (%L, 'Sem etapas', %L, 'https://drive.google.com/drive/folders/x', now())$fmt$,
    :VERDE, :CARLA), 'ok', 1);

-- Corrigir o titulo de uma ja publicada nao passa pela trava de novo.
select teste.cenario('Editar o titulo de uma ja publicada continua valendo', :CARLA,
  $$update public.tasks set titulo = 'Campanha de novembro (revisada)'
     where id = 'faaaaaaa-0000-0000-0000-00000000000a'$$, 'ok', 1);

-- ---------------------------------------------------------------------------
-- O PERIODO DA TASK SAI DAS ETAPAS (0028)
--
-- Era dois campos de data editaveis no topo, e isso criava duas verdades
-- sobre a mesma demanda: a que a pessoa digitou e a que as etapas dizem.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, link_entrega)
values ('faaaaaaa-0000-0000-0000-00000000000b', :VERDE, 'Periodo derivado', :CARLA,
        'https://drive.google.com/drive/folders/p');

select teste.conferir('Sem etapa com data, a task nao tem fim',
  (select (data_fim is null)::text from public.tasks
    where id = 'faaaaaaa-0000-0000-0000-00000000000b'), 'true');

insert into public.subtasks (task_id, titulo, ordem, data_inicio, prazo) values
  ('faaaaaaa-0000-0000-0000-00000000000b', 'Roteiro', 1, '2026-11-03', '2026-11-05'),
  ('faaaaaaa-0000-0000-0000-00000000000b', 'Edicao',  2, '2026-11-06', '2026-11-12');

select teste.conferir('O inicio da task e o da primeira etapa',
  (select data_inicio::text from public.tasks
    where id = 'faaaaaaa-0000-0000-0000-00000000000b'), '2026-11-03');

select teste.conferir('E o fim e o da ultima',
  (select data_fim::text from public.tasks
    where id = 'faaaaaaa-0000-0000-0000-00000000000b'), '2026-11-12');

-- Esticar uma etapa estica a demanda, sem ninguem digitar nada no topo.
update public.subtasks set prazo = '2026-11-20'
 where task_id = 'faaaaaaa-0000-0000-0000-00000000000b' and titulo = 'Edicao';

select teste.conferir('Esticar a etapa estica a demanda',
  (select data_fim::text from public.tasks
    where id = 'faaaaaaa-0000-0000-0000-00000000000b'), '2026-11-20');

-- E apagar a ultima devolve o fim para a etapa que sobrou.
delete from public.subtasks
 where task_id = 'faaaaaaa-0000-0000-0000-00000000000b' and titulo = 'Edicao';

select teste.conferir('Apagar a ultima etapa encolhe a demanda',
  (select data_fim::text from public.tasks
    where id = 'faaaaaaa-0000-0000-0000-00000000000b'), '2026-11-05');

-- ---------------------------------------------------------------------------
-- A limpeza dos abandonados
--
-- Sete dias sem alteracao. O trigger `tasks_updated_at` reescreve a coluna a
-- cada update, entao envelhecer um rascunho no cenario exige desliga-lo -- e
-- o unico jeito de construir em um segundo um estado que leva uma semana.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, publicada_em) values
  ('faaaaaaa-0000-0000-0000-0000000000c1', null, 'Rascunho velho',  :CARLA, null),
  ('faaaaaaa-0000-0000-0000-0000000000c2', null, 'Rascunho novo',   :CARLA, null);

alter table public.tasks disable trigger tasks_updated_at;
update public.tasks set updated_at = now() - interval '8 days'
 where id = 'faaaaaaa-0000-0000-0000-0000000000c1';
update public.tasks set updated_at = now() - interval '2 days'
 where id = 'faaaaaaa-0000-0000-0000-0000000000c2';
-- Uma PUBLICADA antiga, para provar que a limpeza nao encosta nela.
update public.tasks set updated_at = now() - interval '300 days'
 where id = 'faaaaaaa-0000-0000-0000-00000000000a';
alter table public.tasks enable trigger tasks_updated_at;

select teste.conferir('A limpeza apaga um rascunho so',
  public.limpar_rascunhos_abandonados()::text, '1');

select teste.conferir('O velho foi',
  (select count(*)::text from public.tasks where id = 'faaaaaaa-0000-0000-0000-0000000000c1'), '0');

select teste.conferir('O de dois dias ficou',
  (select count(*)::text from public.tasks where id = 'faaaaaaa-0000-0000-0000-0000000000c2'), '1');

select teste.conferir('E a demanda publicada de 300 dias nao foi tocada',
  (select count(*)::text from public.tasks where id = 'faaaaaaa-0000-0000-0000-00000000000a'), '1');
