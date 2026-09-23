-- ===========================================================================
-- A subtarefa dentro da subtarefa (migration 0022).
--
-- Duas perguntas, e a segunda e a que importa:
--
--   1. da para pendurar uma sub-etapa numa etapa, e so uma vez?
--   2. quando isso acontece, a etapa de cima PARA de contar como trabalho?
--
-- A segunda e onde mora o risco. Se a mae continuar somando tempo, contando
-- como etapa e sendo concluida a mao, cada desdobramento passa a contar duas
-- vezes -- e o relatorio de rentabilidade, que cruza receita com o tempo das
-- subtarefas, cobra do cliente um trabalho que aconteceu uma vez so.
--
-- Roda como GENTE: Ana e socia, Diego desenvolvedor, Carla do Atendimento,
-- Marina executa. Como postgres tudo passaria.
-- ===========================================================================

\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

select teste.limpar();

create or replace function teste.status_da_sub(p uuid) returns text
language sql stable as $$ select status::text from public.subtasks where id = p $$;

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('a0000000-0000-0000-0000-00000000000a', :VERDE, 'Campanha com etapas dentro de etapas',
        :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

-- "Arte" vai virar agrupadora; "Midia" fica folha o tempo todo, e e ela que
-- prova que a regra nao pegou quem nao tem filha.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, estimativa_minutos) values
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'Arte',  1, :MARINA, '2026-10-10', 240),
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'Midia', 2, :MARINA, '2026-10-12', 60);

-- ---------------------------------------------------------------------------
-- Pendurar uma sub-etapa
-- ---------------------------------------------------------------------------

select teste.cenario('Atendimento cria uma sub-etapa dentro de uma etapa', :CARLA,
  $$insert into public.subtasks (id, task_id, parent_id, titulo, ordem, responsavel_id, estimativa_minutos)
    values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
            'b0000000-0000-0000-0000-00000000000a', 'Conceito', 1,
            '55555555-5555-5555-5555-555555555555', 90)$$, 'ok', 1);

select teste.cenario('E uma segunda, irma da primeira', :CARLA,
  $$insert into public.subtasks (id, task_id, parent_id, titulo, ordem, responsavel_id, estimativa_minutos)
    values ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a',
            'b0000000-0000-0000-0000-00000000000a', 'Layout', 2,
            '55555555-5555-5555-5555-555555555555', 150)$$, 'ok', 1);

-- ---------------------------------------------------------------------------
-- TRES NIVEIS, NUNCA QUATRO
--
-- O neto e a coisa que este arquivo mais precisa recusar: uma arvore de quatro
-- niveis e uma arvore que ninguem acompanha, e o recuo na tela deixa de
-- significar alguma coisa.
-- ---------------------------------------------------------------------------

select teste.recusa_com('Neto e recusado', :CARLA,
  $$insert into public.subtasks (task_id, parent_id, titulo, ordem, responsavel_id)
    values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001',
            'Neto', 1, '55555555-5555-5555-5555-555555555555')$$,
  'sub-etapa não recebe sub-etapa');

select teste.recusa_com_dica('E a recusa diz onde criar no lugar', :CARLA,
  $$insert into public.subtasks (task_id, parent_id, titulo, ordem, responsavel_id)
    values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001',
            'Neto', 1, '55555555-5555-5555-5555-555555555555')$$,
  'Crie a sub-etapa na etapa de cima');

-- Pelo outro lado da mesma porta: quem ja tem filha nao vira filha.
select teste.recusa_com('Quem ja tem filha nao vira sub-etapa de outra', :CARLA,
  $$update public.subtasks set parent_id = 'b0000000-0000-0000-0000-00000000000b'
     where id = 'b0000000-0000-0000-0000-00000000000a'$$,
  'não pode virar sub-etapa');

select teste.recusa_com('Sub-etapa dela mesma e recusada', :CARLA,
  $$update public.subtasks set parent_id = 'c0000000-0000-0000-0000-000000000001'
     where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'não pode ser sub-etapa dela mesma');

-- A sub-etapa mora na mesma demanda. Sem isto, uma etapa apareceria numa task
-- e contaria na soma de outra.
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('a0000000-0000-0000-0000-00000000000b', :VERDE, 'Outra demanda', :CARLA, '2026-10-01',
        'https://drive.google.com/drive/folders/outra');

select teste.recusa_com('Sub-etapa de etapa em OUTRA demanda e recusada', :CARLA,
  $$insert into public.subtasks (task_id, parent_id, titulo, ordem, responsavel_id)
    values ('a0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000a',
            'Fora de lugar', 1, '55555555-5555-5555-5555-555555555555')$$,
  'é de outra demanda');

-- ---------------------------------------------------------------------------
-- O status da agrupadora e CALCULADO
-- ---------------------------------------------------------------------------

select teste.conferir('Duas filhas paradas: a mae fica nao_iniciada',
  teste.status_da_sub('b0000000-0000-0000-0000-00000000000a'), 'nao_iniciada');

update public.subtasks set status = 'em_andamento' where id = 'c0000000-0000-0000-0000-000000000001';
select teste.conferir('Uma filha andando: a mae anda',
  teste.status_da_sub('b0000000-0000-0000-0000-00000000000a'), 'em_andamento');

update public.subtasks set status = 'aguardando_informacoes' where id = 'c0000000-0000-0000-0000-000000000001';
select teste.conferir('Todas esperando informacao: a mae espera',
  teste.status_da_sub('b0000000-0000-0000-0000-00000000000a'), 'aguardando_informacoes');

-- Escrever o status da agrupadora a mao nao adianta: o trigger reescreve com
-- o calculo, como as duas colunas do cronometro. Policy nao limita coluna, e
-- sem isto um PATCH no PostgREST diria "concluida" com duas filhas em aberto.
update public.subtasks set status = 'concluida' where id = 'b0000000-0000-0000-0000-00000000000a';
select teste.conferir('Status escrito a mao na agrupadora e descartado',
  teste.status_da_sub('b0000000-0000-0000-0000-00000000000a'), 'aguardando_informacoes');

-- A MAE NUNCA FICA EM enviada_aprovacao NEM EM em_ajustes: esses dois afirmam
-- que existe uma rodada DELA, e a fila de aprovacoes iria procura-la.
update public.subtasks set requer_aprovacao = true, tipo_aprovacao = 'interna', status = 'em_andamento'
 where id = 'c0000000-0000-0000-0000-000000000001';
insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por)
values ('c0000000-0000-0000-0000-000000000001', 1, 'interna', :MARINA);
update public.subtasks set status = 'enviada_aprovacao' where id = 'c0000000-0000-0000-0000-000000000001';

select teste.conferir('Filha em aprovacao: a mae fica em_andamento, nao enviada_aprovacao',
  teste.status_da_sub('b0000000-0000-0000-0000-00000000000a'), 'em_andamento');

update public.approval_rounds set status = 'ajustes_solicitados', decidido_por = :DIEGO,
       comentario = 'Refazer o conceito'
 where content_id = 'c0000000-0000-0000-0000-000000000001';
update public.subtasks set status = 'em_ajustes' where id = 'c0000000-0000-0000-0000-000000000001';

select teste.conferir('Filha em ajustes: a mae tambem fica em_andamento',
  teste.status_da_sub('b0000000-0000-0000-0000-00000000000a'), 'em_andamento');

-- Fecha as duas filhas: a mae conclui sozinha.
insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por, status, decidido_por, decidido_em)
values ('c0000000-0000-0000-0000-000000000001', 2, 'interna', :MARINA, 'aprovada', :DIEGO, now());
update public.subtasks set status = 'concluida' where id = 'c0000000-0000-0000-0000-000000000001';
update public.subtasks set status = 'concluida' where id = 'c0000000-0000-0000-0000-000000000002';

select teste.conferir('Todas as filhas concluidas: a mae conclui',
  teste.status_da_sub('b0000000-0000-0000-0000-00000000000a'), 'concluida');

-- ---------------------------------------------------------------------------
-- A SOMA DA TASK CONTA SO AS FOLHAS
--
-- A task tem quatro subtarefas gravadas: Arte (agrupadora), Conceito, Layout
-- e Midia. As de trabalho sao tres. Se a agrupadora contasse, a task nunca
-- chegaria a `concluido` -- ela so conclui depois das filhas, e a contagem
-- ficaria sempre um atras.
-- ---------------------------------------------------------------------------

update public.subtasks set status = 'concluida' where id = 'b0000000-0000-0000-0000-00000000000b';

select teste.conferir('Com as tres folhas concluidas, a task conclui',
  (select status::text from public.tasks where id = 'a0000000-0000-0000-0000-00000000000a'),
  'concluido');

-- ---------------------------------------------------------------------------
-- O cronometro nao corre na agrupadora
--
-- E o ponto onde a contagem dobrada apareceria em dinheiro.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('a0000000-0000-0000-0000-00000000000c', :VERDE, 'Relogio', :CARLA, '2026-10-01',
        'https://drive.google.com/drive/folders/relogio');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id)
values ('b0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000c', 'Video', 1, :MARINA);

-- Ela comeca como folha, e o relogio corre normalmente.
update public.subtasks set status = 'em_andamento' where id = 'b0000000-0000-0000-0000-00000000000c';
select pg_sleep(1.2);

select teste.conferir('Enquanto e folha, o relogio corre',
  (select (andando_desde is not null)::text from public.subtasks where id = 'b0000000-0000-0000-0000-00000000000c'),
  'true');

-- Ganha uma filha no meio do trabalho. A passagem aberta e FECHADA e somada:
-- o que ja tinha sido medido nao se perde, so para de crescer.
insert into public.subtasks (id, task_id, parent_id, titulo, ordem, responsavel_id)
values ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000c',
        'b0000000-0000-0000-0000-00000000000c', 'Captacao', 1, :MARINA);

-- O insert da filha recalcula a mae, e e nesse update que o cronometro fecha.
select teste.conferir('Virou agrupadora: o relogio dela parou',
  (select (andando_desde is null)::text from public.subtasks where id = 'b0000000-0000-0000-0000-00000000000c'),
  'true');

select teste.conferir('E o que ja tinha sido medido ficou gravado',
  (select (tempo_medido_segundos between 1 and 60)::text from public.subtasks
    where id = 'b0000000-0000-0000-0000-00000000000c'),
  'true');

-- Mandar a agrupadora para `em_andamento` nao reabre o relogio: o status dela
-- e calculado, e o cronometro recusa a passagem de qualquer jeito.
update public.subtasks set status = 'em_andamento' where id = 'b0000000-0000-0000-0000-00000000000c';
select teste.conferir('E nao reabre nem mandando em_andamento a mao',
  (select (andando_desde is null)::text from public.subtasks where id = 'b0000000-0000-0000-0000-00000000000c'),
  'true');

-- O MEDIDO DA AGRUPADORA E A SOMA DAS FILHAS, e nao o numero parado dela.
--
-- Com os dois medindo um segundo cada, a conta em minutos daria zero dos dois
-- jeitos -- o cenario passaria sem separar uma resposta da outra. Por isso a
-- filha recebe uma hora cheia com o cronometro DESLIGADO: e o unico jeito de
-- construir em um segundo um estado que leva uma hora para acontecer, e agora
-- as duas respostas possiveis sao 60 e 0.
alter table public.subtasks disable trigger subtasks_cronometro;
update public.subtasks set tempo_medido_segundos = 3600, status = 'concluida'
 where id = 'c0000000-0000-0000-0000-000000000003';
alter table public.subtasks enable trigger subtasks_cronometro;

select teste.conferir('A mae, sozinha, tem quase nada medido',
  (select (tempo_medido_segundos < 60)::text from public.subtasks
    where id = 'b0000000-0000-0000-0000-00000000000c'),
  'true');

select teste.conferir('E o medido dela devolve a hora da filha, nao o zero dela',
  public.tempo_medido_da_subtarefa('b0000000-0000-0000-0000-00000000000c')::text,
  '60');

-- A folha continua respondendo por si: a soma so vale para quem agrupa.
select teste.conferir('A folha devolve o proprio numero',
  public.tempo_medido_da_subtarefa('c0000000-0000-0000-0000-000000000003')::text,
  '60');

select teste.conferir('E a subtarefa que nao existe continua devolvendo null',
  (select public.tempo_medido_da_subtarefa('00000000-0000-0000-0000-000000000000')::text),
  null);

-- ---------------------------------------------------------------------------
-- Agrupadora nao espera, nao entrega e nao exige aval
--
-- As tres sao afirmacoes sobre uma unidade de trabalho, e a agrupadora deixou
-- de ser uma.
-- ---------------------------------------------------------------------------

select teste.recusa_com('Dependencia COM agrupadora do lado que espera: recusa', :CARLA,
  $$insert into public.subtask_dependencies (subtask_id, depende_de_id)
    values ('b0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000003')$$,
  'não depende de ninguém por si só');

select teste.recusa_com('Dependencia COM agrupadora do lado esperado: recusa', :CARLA,
  $$insert into public.subtask_dependencies (subtask_id, depende_de_id)
    values ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000c')$$,
  'ela agrupa sub-etapas');

select teste.recusa_com('Rodada de aprovacao na agrupadora: recusa', :DIEGO,
  $$insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por)
    values ('b0000000-0000-0000-0000-00000000000c', 1, 'interna',
            '22222222-2222-2222-2222-222222222222')$$,
  'não é ela que vai para aprovação');

select teste.recusa_com('Exigencia de aval na agrupadora: recusa', :CARLA,
  $$update public.subtasks set requer_aprovacao = true, tipo_aprovacao = 'interna'
     where id = 'b0000000-0000-0000-0000-00000000000c'$$,
  'quem exige aprovação é quem entrega');

-- E pelo outro lado: uma etapa que JA exige aval nao vira agrupadora, porque a
-- conclusao dela passaria a vir das filhas e a trava da aprovacao recusaria.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('b0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000c',
        'Arte que pede aval', 2, :MARINA, true, 'cliente');

select teste.recusa_com('Etapa que exige aval nao vira agrupadora', :CARLA,
  $$insert into public.subtasks (task_id, parent_id, titulo, ordem, responsavel_id)
    values ('a0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000d',
            'Filha indevida', 1, '55555555-5555-5555-5555-555555555555')$$,
  'não pode virar agrupadora');

select teste.recusa_com_dica('E a dica manda marcar o aval nas sub-etapas', :CARLA,
  $$insert into public.subtasks (task_id, parent_id, titulo, ordem, responsavel_id)
    values ('a0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000d',
            'Filha indevida', 1, '55555555-5555-5555-5555-555555555555')$$,
  'marque-a nas sub-etapas');

-- E quem ESPERA alguem tambem nao: a espera e da folha.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id)
values ('b0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000c',
        'Etapa que espera', 3, :MARINA);

insert into public.subtask_dependencies (subtask_id, depende_de_id)
values ('b0000000-0000-0000-0000-00000000000e', 'b0000000-0000-0000-0000-00000000000d');

select teste.recusa_com('Etapa que espera outra nao vira agrupadora', :CARLA,
  $$insert into public.subtasks (task_id, parent_id, titulo, ordem, responsavel_id)
    values ('a0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000e',
            'Filha de quem espera', 1, '55555555-5555-5555-5555-555555555555')$$,
  'espera outra etapa');

-- ---------------------------------------------------------------------------
-- Mudar de mae, e ficar sem filha
-- ---------------------------------------------------------------------------

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id)
values ('b0000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-00000000000c', 'Outra frente', 4, :MARINA);

select teste.cenario('Sub-etapa muda de etapa', :CARLA,
  $$update public.subtasks set parent_id = 'b0000000-0000-0000-0000-00000000000f'
     where id = 'c0000000-0000-0000-0000-000000000003'$$, 'ok', 1);

-- As DUAS recalculam: a que perdeu a filha e a que ganhou.
select teste.conferir('A mae nova herda o status da filha concluida',
  teste.status_da_sub('b0000000-0000-0000-0000-00000000000f'), 'concluida');

-- A mae antiga ficou sem filha nenhuma: voltou a ser folha, e o status que
-- ela tinha e dela de novo. Nao e zerado -- apagar o que estava gravado por
-- causa de um arrasto que a pessoa pode desfazer seria perda sem aviso.
select teste.cenario('A etapa que ficou sem filha volta a aceitar status a mao', :MARINA,
  $$update public.subtasks set status = 'aguardando_informacoes'
     where id = 'b0000000-0000-0000-0000-00000000000c'$$, 'ok', 1);

select teste.conferir('E o status a mao FICA, porque ela e folha de novo',
  teste.status_da_sub('b0000000-0000-0000-0000-00000000000c'), 'aguardando_informacoes');

-- Apagar a mae leva as filhas junto: `on delete cascade`. Sub-etapa orfa
-- seria etapa invisivel somando na task.
select teste.cenario('Apagar a agrupadora leva as sub-etapas', :CARLA,
  $$delete from public.subtasks where id = 'b0000000-0000-0000-0000-00000000000f'$$, 'ok', 1);

select teste.conferir('A sub-etapa foi junto',
  (select count(*)::text from public.subtasks where id = 'c0000000-0000-0000-0000-000000000003'),
  '0');

-- ===========================================================================
-- O PERIODO DA ETAPA (migration 0027)
--
-- A etapa passou a ter `data_inicio` alem de `prazo`. Os dois continuam
-- opcionais -- etapa sem data e caso normal --, e o que nao se aceita e
-- periodo invertido.
-- ===========================================================================

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('a0000000-0000-0000-0000-00000000000d', :VERDE, 'Periodo da etapa', :CARLA, '2026-10-01',
        'https://drive.google.com/drive/folders/periodo');

select teste.cenario('Etapa com inicio e fim entra', :CARLA,
  $$insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, data_inicio, prazo)
    values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000d',
            'Com periodo', 1, '55555555-5555-5555-5555-555555555555', '2026-10-05', '2026-10-09')$$,
  'ok', 1);

select teste.cenario('Etapa sem data nenhuma continua entrando', :CARLA,
  $$insert into public.subtasks (task_id, titulo, ordem, responsavel_id)
    values ('a0000000-0000-0000-0000-00000000000d', 'Sem data', 2,
            '55555555-5555-5555-5555-555555555555')$$, 'ok', 1);

select teste.cenario('So o prazo, sem inicio, tambem', :CARLA,
  $$insert into public.subtasks (task_id, titulo, ordem, responsavel_id, prazo)
    values ('a0000000-0000-0000-0000-00000000000d', 'So prazo', 3,
            '55555555-5555-5555-5555-555555555555', '2026-10-09')$$, 'ok', 1);

select teste.recusa_com('Periodo invertido e recusado', :CARLA,
  $$insert into public.subtasks (task_id, titulo, ordem, responsavel_id, data_inicio, prazo)
    values ('a0000000-0000-0000-0000-00000000000d', 'De tras para frente', 4,
            '55555555-5555-5555-5555-555555555555', '2026-10-20', '2026-10-05')$$,
  'subtasks_periodo');

-- E nao da para inverter depois, editando so uma das pontas.
select teste.recusa_com('Nem inverter depois, mexendo numa ponta so', :CARLA,
  $$update public.subtasks set prazo = '2026-10-01'
     where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'subtasks_periodo');

-- Comecar e terminar no mesmo dia vale: etapa de um dia e a mais comum.
select teste.cenario('Comecar e terminar no mesmo dia vale', :CARLA,
  $$update public.subtasks set data_inicio = '2026-10-09', prazo = '2026-10-09'
     where id = 'd0000000-0000-0000-0000-000000000001'$$, 'ok', 1);
