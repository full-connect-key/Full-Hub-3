-- ===========================================================================
-- 11 — o cronometro da subtarefa (migration 0021)
--
-- O relogio corre enquanto a subtarefa esta `em_andamento`, pausa quando ela
-- sai, e volta a correr quando ela volta. Quem escreve as duas colunas e o
-- trigger, NUNCA o cliente: policy nao limita coluna, entao sem isso bastaria
-- um PATCH no PostgREST para a etapa de alguem dizer que levou oito horas.
--
-- Os cenarios usam `pg_sleep`. Sao segundos de verdade num relogio de verdade,
-- e e por isso que a conferencia e `>= 1` e nao `= 1`: uma bateria que exige o
-- numero exato do relogio reprova sozinha num dia de maquina carregada.
-- ===========================================================================

\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

select teste.limpar();

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('dddddddd-1111-0000-0000-00000000000a', :VERDE, 'Demanda com relogio', :CARLA,
        '2026-10-01', 'https://drive.google.com/drive/folders/cronometro');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id)
values ('cccccccc-1111-0000-0000-00000000000a', 'dddddddd-1111-0000-0000-00000000000a',
        'Etapa medida', 1, :MARINA);

-- ---------------------------------------------------------------------------
-- Nasce parada
--
-- Subtarefa criada nao e subtarefa comecada. Se o relogio partisse na criacao,
-- toda etapa planejada com antecedencia chegaria ao dia de execucao com dias
-- de "trabalho" no contador.
-- ---------------------------------------------------------------------------
select teste.conferir('Subtarefa nova nasce com o relogio parado',
  (select (andando_desde is null)::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

select teste.conferir('E com zero segundos medidos',
  (select tempo_medido_segundos::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), '0');

-- ---------------------------------------------------------------------------
-- Entrar em andamento abre a contagem
-- ---------------------------------------------------------------------------
update public.subtasks set status = 'em_andamento'
 where id = 'cccccccc-1111-0000-0000-00000000000a';

select teste.conferir('Em andamento: o relogio comeca a correr',
  (select (andando_desde is not null)::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

-- ---------------------------------------------------------------------------
-- O cliente NAO escreve o relogio
--
-- Este e o cenario que justifica o trigger existir. Sem ele o update abaixo
-- passaria, e a medicao viraria um campo de texto livre com aparencia de
-- medicao -- que e pior do que nao medir.
-- ---------------------------------------------------------------------------
update public.subtasks
   set andando_desde = now() - interval '9 hours',
       tempo_medido_segundos = 99999
 where id = 'cccccccc-1111-0000-0000-00000000000a';

select teste.conferir('Escrever tempo_medido_segundos a mao nao cola',
  (select tempo_medido_segundos::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), '0');

select teste.conferir('Recuar andando_desde a mao nao cola',
  (select (andando_desde > now() - interval '1 minute')::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

-- A mesma tentativa pela pessoa responsavel, que e quem tem a policy a favor:
-- o RLS deixa passar o update, e quem recusa o valor e o trigger.
select teste.cenario('A responsavel tem permissao de update', :MARINA,
  $$update public.subtasks set tempo_medido_segundos = 40000
     where id = 'cccccccc-1111-0000-0000-00000000000a'$$, 'ok', 1);

select teste.conferir('Mas o numero dela tambem foi descartado',
  (select tempo_medido_segundos::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), '0');

-- ---------------------------------------------------------------------------
-- Sair de andamento fecha a passagem e soma
-- ---------------------------------------------------------------------------
select pg_sleep(1.2);

update public.subtasks set status = 'aguardando_informacoes'
 where id = 'cccccccc-1111-0000-0000-00000000000a';

select teste.conferir('Ao sair de andamento o relogio para',
  (select (andando_desde is null)::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

-- Faixa, e nao `>= 1`: o numero tem que ser PLAUSIVEL para uma passagem de
-- pouco mais de um segundo. Com `>= 1` este cenario passaria tambem com o
-- 99999 que o cliente tentou escrever la em cima -- ou seja, passaria
-- justamente no dia em que o trigger tivesse caido.
select teste.conferir('E a passagem foi somada, num numero plausivel',
  (select (tempo_medido_segundos between 1 and 60)::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

-- ---------------------------------------------------------------------------
-- Parada nao conta
--
-- "Aguardando informacoes" e a pessoa ESPERANDO, nao trabalhando. Se o relogio
-- corresse aqui, o tempo de uma etapa incluiria os dias em que ela ficou
-- parada esperando o cliente responder.
-- ---------------------------------------------------------------------------
create temporary table medida_na_pausa as
  select tempo_medido_segundos as valor from public.subtasks
   where id = 'cccccccc-1111-0000-0000-00000000000a';

select pg_sleep(1.2);

select teste.conferir('Tempo parado nao entra na conta',
  (select (s.tempo_medido_segundos = m.valor)::text
     from public.subtasks s, medida_na_pausa m
    where s.id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

select teste.conferir('E a leitura tambem nao anda com o relogio parado',
  (select (public.tempo_medido_da_subtarefa('cccccccc-1111-0000-0000-00000000000a')
           = round(m.valor / 60.0)::integer)::text from medida_na_pausa m), 'true');

-- ---------------------------------------------------------------------------
-- Voltar a andar abre uma passagem nova, e a anterior nao se perde
-- ---------------------------------------------------------------------------
update public.subtasks set status = 'em_andamento'
 where id = 'cccccccc-1111-0000-0000-00000000000a';

select teste.conferir('Voltando a andar, o acumulado continua la',
  (select (s.tempo_medido_segundos = m.valor)::text
     from public.subtasks s, medida_na_pausa m
    where s.id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

select pg_sleep(1.2);

update public.subtasks set status = 'concluida'
 where id = 'cccccccc-1111-0000-0000-00000000000a';

select teste.conferir('A segunda passagem SOMOU a primeira, nao substituiu',
  (select (s.tempo_medido_segundos > m.valor)::text
     from public.subtasks s, medida_na_pausa m
    where s.id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

select teste.conferir('E concluida deixa o relogio parado',
  (select (andando_desde is null)::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

-- ---------------------------------------------------------------------------
-- O medido nao mexe no declarado
--
-- Sao dois numeros com significados diferentes, e e por isso que sao duas
-- colunas. `tempo_real_minutos` continua vazio ate alguem confirmar o numero
-- no dialogo -- o cronometro sugere, nunca grava por cima.
-- ---------------------------------------------------------------------------
select teste.conferir('O cronometro nao preencheu tempo_real_minutos sozinho',
  (select coalesce(tempo_real_minutos::text, 'vazio') from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), 'vazio');

select teste.cenario('A pessoa confirma o tempo real, e esse sim e gravado', :MARINA,
  $$update public.subtasks set tempo_real_minutos = 95
     where id = 'cccccccc-1111-0000-0000-00000000000a'$$, 'ok', 1);

select teste.conferir('O declarado e o que a pessoa disse',
  (select tempo_real_minutos::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000a'), '95');

select teste.conferir('E o medido nao foi alterado por isso',
  (select (s.tempo_medido_segundos > m.valor)::text
     from public.subtasks s, medida_na_pausa m
    where s.id = 'cccccccc-1111-0000-0000-00000000000a'), 'true');

-- ---------------------------------------------------------------------------
-- Update que nao toca o status nao mexe no relogio
--
-- Reordenar, trocar o responsavel, corrigir o titulo: o trigger roda em toda
-- escrita, e se ele reabrisse a passagem a cada update o tempo de uma etapa
-- dependeria de quantas vezes alguem a editou.
-- ---------------------------------------------------------------------------
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, status)
values ('cccccccc-1111-0000-0000-00000000000b', 'dddddddd-1111-0000-0000-00000000000a',
        'Etapa que so e editada', 2, :MARINA, 'em_andamento');

create temporary table desde_antes as
  select andando_desde as valor from public.subtasks
   where id = 'cccccccc-1111-0000-0000-00000000000b';

select pg_sleep(1.2);

update public.subtasks set titulo = 'Etapa renomeada'
 where id = 'cccccccc-1111-0000-0000-00000000000b';

select teste.conferir('Renomear nao reinicia a contagem',
  (select (s.andando_desde = d.valor)::text
     from public.subtasks s, desde_antes d
    where s.id = 'cccccccc-1111-0000-0000-00000000000b'), 'true');

select teste.conferir('Nem adianta o acumulado antes da hora',
  (select tempo_medido_segundos::text from public.subtasks
    where id = 'cccccccc-1111-0000-0000-00000000000b'), '0');

-- ---------------------------------------------------------------------------
-- A leitura inclui a passagem em curso
-- ---------------------------------------------------------------------------
select teste.conferir('A funcao de leitura conta a passagem aberta',
  (select (public.tempo_medido_da_subtarefa('cccccccc-1111-0000-0000-00000000000b') >= 0)::text), 'true');

select teste.conferir('E devolve null para subtarefa que nao existe',
  coalesce(public.tempo_medido_da_subtarefa('cccccccc-1111-0000-0000-0000000000ff')::text, 'null'),
  'null');
