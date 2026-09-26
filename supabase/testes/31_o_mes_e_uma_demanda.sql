\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set CARLA   '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

\set PASTA   '''https://drive.google.com/drive/folders/PASTA-DE-TESTE'''

-- ===========================================================================
-- 0061 -- O mes de social e UMA demanda, e cada post e uma etapa dela
--
-- Decisao do usuario: *"quero que mude o fluxo para Uma task do Social do mes
-- em questao, e uma subtarefa, para cada um dos posts"*.
--
-- O arquivo persegue tres coisas que a tela nao mostra:
--
--   1. a demanda do mes nasce UMA vez e e reusada na segunda abertura -- e a
--      unicidade e o INDICE, nao o `select` que a funcao faz antes;
--   2. a etapa do post nao tem dono, nao tem prazo e nao tem relogio -- as
--      tres ausencias sao decisao, e cada uma tem o cenario que avisa se
--      alguem as preencher;
--   3. o status dela sai da CORRENTE do post, e nunca fica em
--      `enviada_aprovacao` nem em `em_ajustes`.
-- ===========================================================================

select teste.limpar();
delete from public.comments;
delete from public.post_versions;
delete from public.posts;
delete from public.tasks where social_do_mes is not null;

-- UMA DEMANDA COMUM, com uma etapa comum: e o CONTROLE. Metade dos cenarios
-- deste arquivo afirma que a etapa do post NAO faz alguma coisa, e sem uma
-- etapa normal ao lado eles passariam num produto que parou de fazer aquilo
-- para todo mundo -- que e a metade que falta em toda checagem de ausencia.
insert into public.tasks (id, client_id, titulo, link_entrega, criado_por)
values ('cccccccc-0061-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'Demanda comum, para comparar', 'https://exemplo.com/pasta',
        '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

insert into public.subtasks (id, task_id, titulo, ordem)
values ('dddddddd-0061-0000-0000-000000000001', 'cccccccc-0061-0000-0000-000000000001',
        'Etapa comum', 10)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 1. SEM PASTA DE ENTREGA A DEMANDA NAO NASCE, E O MES NAO ABRE
--
-- `tasks_exige_pasta_de_entrega` (0015) recusa demanda nova sem ela, e nao ha
-- excecao a abrir para o modulo que abre sessenta demandas por mes -- uma
-- trava com excecao para o caso frequente e uma trava desligada.
-- ---------------------------------------------------------------------------
select teste.recusa_com('Abrir o mes sem pasta de entrega e recusado', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2027-06', '{"instagram": 2}'::jsonb)$fmt$,
    :VERDE),
  'precisa da pasta de entrega');

select teste.recusa_com_dica('E a dica diz que o mes e uma demanda', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2027-06', '{"instagram": 2}'::jsonb)$fmt$,
    :VERDE),
  'O mês de social é uma demanda só');

select teste.conferir('E nenhum post ficou para tras da recusa',
  (select count(*)::text from public.posts where client_id = :VERDE), '0');


-- ---------------------------------------------------------------------------
-- 2. A DEMANDA DO MES, E UMA ETAPA POR POST
-- ---------------------------------------------------------------------------
select teste.cenario('O Atendimento abre tres posts de junho', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-06', '{"instagram": 3}'::jsonb, p_link_entrega => %L)$fmt$, :VERDE, :PASTA),
  'ok', 1);

select teste.conferir('Nasceu UMA demanda do mes',
  (select count(*)::text from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'), '1');

select teste.conferir('Com o nome do mes e do cliente',
  (select titulo from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'),
  'Social · Junho/2027 de Mundo Verde');

-- NASCE PUBLICADA e nao como rascunho: rascunho e de quem o criou, e
-- esconderia da equipe os tres posts que acabaram de ser abertos.
select teste.conferir('A demanda do mes nasce publicada',
  (select (publicada_em is not null)::text from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'), 'true');

select teste.conferir('Com a pasta de entrega gravada',
  (select link_entrega from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'), :PASTA);

select teste.conferir('Tres etapas na demanda, uma por post',
  (select count(*)::text from public.subtasks s
    join public.tasks t on t.id = s.task_id
   where t.social_do_mes = '2027-06-01'), '3');

-- A PONTE DA 0032, ATRAVESSADA. `posts.subtask_id` existia desde aquela
-- migration e nenhuma linha a escrevia.
select teste.conferir('Todo post aponta para a etapa dele',
  (select count(*)::text from public.posts
    where client_id = :VERDE and subtask_id is not null), '3');

select teste.conferir('E a etapa se chama como o post',
  (select count(*)::text from public.posts p
    join public.subtasks s on s.id = p.subtask_id
   where s.titulo = p.tema), '3');


-- ---------------------------------------------------------------------------
-- 3. AS TRES AUSENCIAS, e cada uma e uma decisao
--
-- Se alguem preencher qualquer uma delas, um destes tres falha e diz qual.
-- ---------------------------------------------------------------------------
select teste.conferir('A etapa do post nao tem dono',
  (select count(*)::text from public.posts p
    join public.subtasks s on s.id = p.subtask_id
   where s.responsavel_id is null), '3');

select teste.conferir('Nem prazo',
  (select count(*)::text from public.posts p
    join public.subtasks s on s.id = p.subtask_id
   where s.prazo is null and s.data_inicio is null), '3');

select teste.conferir('E a funcao sabe reconhece-la',
  (select count(*)::text from public.posts p
   where public.subtarefa_de_post(p.subtask_id)), '3');

select teste.conferir('Uma etapa comum nao e etapa de post',
  (select public.subtarefa_de_post(
     'dddddddd-0061-0000-0000-000000000001'::uuid)::text),
  'false');


-- ---------------------------------------------------------------------------
-- 4. O STATUS SAI DA CORRENTE, E NUNCA DAS DUAS PALAVRAS DE RODADA
-- ---------------------------------------------------------------------------
select id as post_um from public.posts
 where client_id = :VERDE and tema like 'Instagram 1 de 3%' \gset

select subtask_id as etapa_um from public.posts where id = :'post_um' \gset

select teste.conferir('A etapa do post nasce nao iniciada',
  (select status::text from public.subtasks where id = :'etapa_um'), 'nao_iniciada');

update public.post_etapas set status = 'em_andamento'
 where post_id = :'post_um' and nome = 'Pauta';

select teste.conferir('Corrente andando deixa a etapa em andamento',
  (select status::text from public.subtasks where id = :'etapa_um'), 'em_andamento');

update public.post_etapas set status = 'aguardando_informacoes'
 where post_id = :'post_um' and nome = 'Pauta';

select teste.conferir('Corrente esperando informacao aparece na etapa',
  (select status::text from public.subtasks where id = :'etapa_um'), 'aguardando_informacoes');

-- A REGRA DA AGRUPADORA (0022), aplicada um nivel abaixo: os dois status que
-- afirmam uma rodada da propria linha viram `em_andamento`, porque a fila de
-- aprovacoes iria procurar uma rodada que nao existe.
update public.post_etapas set status = 'enviada_aprovacao'
 where post_id = :'post_um' and nome = 'Pauta';

select teste.conferir('Corrente em aprovacao NAO poe a etapa em enviada_aprovacao',
  (select status::text from public.subtasks where id = :'etapa_um'), 'em_andamento');

update public.post_etapas set status = 'em_ajustes'
 where post_id = :'post_um' and nome = 'Pauta';

select teste.conferir('Nem em em_ajustes',
  (select status::text from public.subtasks where id = :'etapa_um'), 'em_andamento');

update public.post_etapas set status = 'concluida' where post_id = :'post_um';

select teste.conferir('Corrente inteira concluida conclui a etapa',
  (select status::text from public.subtasks where id = :'etapa_um'), 'concluida');

-- E A DEMANDA DO MES ANDA SOZINHA, pelo `recalcular_status_task` da 0030 --
-- que conta so as folhas, e a etapa do post e folha.
select teste.conferir('A demanda do mes acompanhou',
  (select status::text from public.tasks where social_do_mes = '2027-06-01'),
  'em_andamento');


-- ---------------------------------------------------------------------------
-- 5. O RELOGIO NAO CORRE NA ETAPA DO POST
--
-- Sem isto ela entraria em `em_andamento` pelo mirror e ficaria andando o mes
-- inteiro: o detalhe da demanda mostraria centenas de horas numa linha em que
-- ninguem trabalhou, e a rentabilidade cobraria em dobro o que as cinco etapas
-- da corrente ja mediram.
-- ---------------------------------------------------------------------------
select id as post_dois from public.posts
 where client_id = :VERDE and tema like 'Instagram 2 de 3%' \gset

select subtask_id as etapa_dois from public.posts where id = :'post_dois' \gset

update public.post_etapas set status = 'em_andamento'
 where post_id = :'post_dois' and nome = 'Pauta';

select teste.conferir('A etapa do post esta em andamento',
  (select status::text from public.subtasks where id = :'etapa_dois'), 'em_andamento');

select teste.conferir('E o relogio dela nao abriu passagem',
  (select (andando_desde is null)::text from public.subtasks where id = :'etapa_dois'), 'true');

select teste.conferir('Nem acumulou segundo nenhum',
  (select tempo_medido_segundos::text from public.subtasks where id = :'etapa_dois'), '0');

-- E A ETAPA COMUM CONTINUA MEDINDO. Sem este cenario, alguem poderia desligar
-- o cronometro inteiro e os dois de cima passariam.
update public.subtasks set status = 'em_andamento'
 where id = 'dddddddd-0061-0000-0000-000000000001';

select teste.conferir('A etapa comum continua com o relogio correndo',
  (select (andando_desde is not null)::text from public.subtasks
    where id = 'dddddddd-0061-0000-0000-000000000001'), 'true');


-- ---------------------------------------------------------------------------
-- 6. ABRIR O MES DE NOVO REUSA A DEMANDA, E NAO CRIA A GEMEA
--
-- Doze no Instagram hoje, quatro no LinkedIn amanha. Sem o reuso a agencia
-- ficaria com duas demandas "Social de Junho" do mesmo cliente, com os posts
-- espalhados entre as duas e nenhum lugar mostrando o mes inteiro.
-- ---------------------------------------------------------------------------
select teste.cenario('A segunda abertura do mesmo mes dispensa a pasta', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-06', '{"linkedin": 2}'::jsonb)$fmt$, :VERDE),
  'ok', 1);

select teste.conferir('Continua sendo UMA demanda de junho',
  (select count(*)::text from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'), '1');

select teste.conferir('Agora com cinco etapas',
  (select count(*)::text from public.subtasks s
    join public.tasks t on t.id = s.task_id
   where t.social_do_mes = '2027-06-01'), '5');

-- A ORDEM CONTINUA DE ONDE PAROU. Reiniciar em 1 poria dois posts na mesma
-- posicao, e a lista da demanda passaria a depender da ordem de leitura.
select teste.conferir('E cinco posicoes distintas',
  (select count(distinct s.ordem)::text from public.subtasks s
    join public.tasks t on t.id = s.task_id
   where t.social_do_mes = '2027-06-01'), '5');

-- A UNICIDADE E O INDICE, e nao o `select` que a funcao faz antes. Duas abas
-- clicando ao mesmo tempo passam pelas duas consultas antes de qualquer uma
-- gravar -- e a segunda leva a recusa do indice.
select teste.recusa_com('E o indice recusa a demanda gemea montada a mao', :ANA,
  format($fmt$insert into public.tasks (client_id, titulo, link_entrega, social_do_mes, criado_por)
    values (%L, 'Social de junho, a segunda', %L, '2027-06-01', %L)$fmt$,
    :VERDE, :PASTA, :ANA),
  'duplicate key');

select teste.recusa_com('E o mes tem que ser o dia 1', :ANA,
  format($fmt$insert into public.tasks (client_id, titulo, link_entrega, social_do_mes, criado_por)
    values (%L, 'Social do meio de julho', %L, '2027-07-15', %L)$fmt$,
    :VERDE, :PASTA, :ANA),
  'tasks_social_do_mes_dia_1');


-- ---------------------------------------------------------------------------
-- 7. O POST SOME, E A LINHA DELE NA DEMANDA SOME JUNTO
--
-- `posts.subtask_id` e `on delete set null` no outro sentido (a etapa saiu, o
-- post fica); deste lado nao existe chave. Sem o trigger a demanda continuaria
-- contando um post que nao existe mais, e "4 de 5" nunca fecharia.
-- ---------------------------------------------------------------------------
delete from public.posts where id = :'post_dois';

select teste.conferir('A etapa do post apagado sumiu',
  (select count(*)::text from public.subtasks where id = :'etapa_dois'), '0');

select teste.conferir('E a demanda voltou a quatro etapas',
  (select count(*)::text from public.subtasks s
    join public.tasks t on t.id = s.task_id
   where t.social_do_mes = '2027-06-01'), '4');


-- ---------------------------------------------------------------------------
-- 8. O TEMA MUDA, E O TITULO DA ETAPA ACOMPANHA
--
-- O tema nasce "Instagram 1 de 3 · Junho/2027" e quem pega a Pauta o
-- reescreve. Sem isto o board da agencia mostraria o nome de fabrica para
-- sempre -- doze linhas com o mesmo titulo.
-- ---------------------------------------------------------------------------
update public.posts set tema = 'Bastidores da nova linha' where id = :'post_um';

select teste.conferir('O titulo da etapa acompanhou o tema',
  (select titulo from public.subtasks where id = :'etapa_um'),
  'Bastidores da nova linha');
