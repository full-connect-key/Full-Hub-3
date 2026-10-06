\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set CARLA   '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

\set PASTA   '''https://drive.google.com/drive/folders/PASTA-DE-TESTE'''

-- ===========================================================================
-- 31 - O MES DE SOCIAL E UMA DEMANDA (0061), E A ETAPA DELA E A FASE (0088)
--
-- A 0061 atendeu *"quero que mude o fluxo para Uma task do Social do mes em
-- questao, e uma subtarefa, para cada um dos posts"*. A 0088 trocou a segunda
-- metade por *"a producao vira mensal, a aprovacao continua por post"*: a
-- subtarefa passou a ser a ETAPA do mes.
--
-- ---------------------------------------------------------------------------
-- O ARQUIVO INTEIRO ESTA VIRADO DO AVESSO, e e a parte que vale ler
--
-- Ele perseguia tres AUSENCIAS -- a subtarefa do post nao tinha dono, nao
-- tinha prazo e nao tinha relogio --, e cada uma era uma decisao da 0061. As
-- tres viraram PRESENCAS: a etapa do mes tem dono, tem periodo e tem relogio,
-- porque ela e trabalho de gente. Devolvendo a subtarefa por post, os
-- cenarios de baixo acham tres onde esperam uma.
--
-- O que NAO virou do avesso e o que a 0061 acertou e continua de pe: a demanda
-- do mes nasce UMA vez e e reusada na segunda abertura, e a unicidade e o
-- INDICE e nao o `select` que a funcao faz antes.
-- ===========================================================================

select teste.limpar();
delete from public.comments;
delete from public.post_versions;
delete from public.posts;
delete from public.tasks where social_do_mes is not null;

-- UMA DEMANDA COMUM, com uma etapa comum: e o CONTROLE. Metade dos cenarios
-- deste arquivo afirma que a etapa do mes FAZ alguma coisa que a etapa do post
-- nao fazia, e sem uma etapa normal ao lado eles passariam num produto que
-- parou de distinguir as duas -- que e a metade que falta em toda checagem.
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
  format($fmt$select public.abrir_mes_de_social(%L, '2027-06', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb)$fmt$,
    :VERDE),
  'precisa da pasta de entrega');

select teste.recusa_com_dica('E a dica diz que o mes e uma demanda', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2027-06', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb)$fmt$,
    :VERDE),
  'O mês de social é uma demanda só');

select teste.conferir('E nenhum post ficou para tras da recusa',
  (select count(*)::text from public.posts where client_id = :VERDE), '0');


-- ---------------------------------------------------------------------------
-- 2. A DEMANDA DO MES, E UMA ETAPA POR FASE
-- ---------------------------------------------------------------------------
select teste.cenario('O Atendimento abre tres posts de junho', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-06', '[{"redes": ["instagram"], "quantidade": 3}]'::jsonb,
    p_responsaveis => jsonb_build_object('Social Media', %L::text, 'Design', %L::text),
    p_prazos => jsonb_build_object('Pauta', jsonb_build_object('inicio','2027-05-05','fim','2027-05-10')),
    p_link_entrega => %L)$fmt$, :VERDE, :MARINA, :BRUNO, :PASTA),
  'ok', 1);

select teste.conferir('Nasceu UMA demanda do mes',
  (select count(*)::text from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'), '1');

select teste.conferir('Com o nome do mes e do cliente',
  (select titulo from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'),
  'Social · Junho/2027 de Mundo Verde');

-- NASCE PUBLICADA e nao como rascunho: rascunho e de quem o criou, e
-- esconderia da equipe as etapas que acabaram de ser distribuidas.
select teste.conferir('A demanda do mes nasce publicada',
  (select (publicada_em is not null)::text from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'), 'true');

select teste.conferir('Com a pasta de entrega gravada',
  (select link_entrega from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'), :PASTA);

select set_config('t31.mes',
  (select id::text from public.tasks where client_id = :VERDE and social_do_mes = '2027-06-01'),
  false);

-- CINCO ETAPAS PARA TRES POSTS, e este e o cenario virado do avesso: ele media
-- "tres etapas, uma por post".
select teste.conferir('Cinco etapas na demanda, uma por FASE e nao uma por post',
  (select count(*)::text from public.subtasks s
    where s.task_id = current_setting('t31.mes')::uuid), '5');

select teste.conferir('E as cinco sao etapas de mes de social',
  (select count(*)::text from public.etapas_do_mes(current_setting('t31.mes')::uuid)), '5');

-- A PONTE NOVA (0088). `posts.subtask_id` existia desde a 0032 e a 0061 a
-- atravessou; com a subtarefa deixando de ser o post, a pergunta passou a ser
-- de que MES o post e.
select teste.conferir('Todo post aponta para a demanda do mes',
  (select count(*)::text from public.posts
    where client_id = :VERDE and social_task_id = current_setting('t31.mes')::uuid), '3');

select teste.conferir('E `posts_do_mes()` responde pela ponte nova',
  (select count(*)::text from public.posts_do_mes(current_setting('t31.mes')::uuid)), '3');


-- ---------------------------------------------------------------------------
-- 3. AS TRES AUSENCIAS DA 0061 VIRARAM TRES PRESENCAS
--
-- Era isto que a 0061 decidia, e as tres razoes dela estao no cabecalho
-- daquela migration: o trabalho de um post tem CINCO donos, o dia do post ja
-- aparece duas vezes no calendario, e o relogio da linha do post andaria o mes
-- inteiro. As tres valiam porque a linha era o POST. A etapa do mes e a FASE,
-- e as cinco pessoas sao as cinco etapas.
-- ---------------------------------------------------------------------------
select teste.conferir('A etapa do mes TEM dono',
  (select count(*)::text from public.etapas_do_mes(current_setting('t31.mes')::uuid)
    where responsavel_id is not null), '3');

select teste.conferir('E a Pauta TEM periodo',
  (select data_inicio || '→' || prazo from public.etapas_do_mes(current_setting('t31.mes')::uuid)
    where titulo = 'Pauta'), '2027-05-05→2027-05-10');

select teste.conferir('E `subtarefa_de_post()` nao existe mais para perguntar',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'subtarefa_de_post'), '0');

-- E A PERGUNTA NOVA SABE DISTINGUIR AS DUAS. Sem ela, `etapas_do_mes()`
-- devolveria toda subtarefa da demanda, e a etapa comum do controle entraria
-- na corrente de um mes de social.
select teste.conferir('Uma etapa comum nao e etapa de mes',
  (select (social_papel is null)::text from public.subtasks
    where id = 'dddddddd-0061-0000-0000-000000000001'), 'true');


-- ---------------------------------------------------------------------------
-- 4. O STATUS DA DEMANDA SAI DAS FASES
--
-- `recalcular_status_task` (0030) conta so as folhas, e as cinco fases sao
-- folhas. O que saiu daqui foi o MIRROR: a 0061 copiava o status da corrente
-- de cada post para a linha dele, com um de-para que nunca escrevia
-- `enviada_aprovacao` nem `em_ajustes`. Sem linha de post nao ha o que
-- espelhar -- a fase e escrita por quem a faz.
-- ---------------------------------------------------------------------------
select teste.conferir('As cinco fases nascem nao iniciadas',
  (select count(*)::text from public.etapas_do_mes(current_setting('t31.mes')::uuid)
    where status = 'nao_iniciada'), '5');

select teste.conferir('E a demanda do mes tambem',
  (select status::text from public.tasks where id = current_setting('t31.mes')::uuid),
  'nao_iniciada');

select teste.cenario('A Pauta comeca', :MARINA,
  format($fmt$update public.subtasks set status = 'em_andamento'
     where id = (select id from public.etapas_do_mes(%L) where titulo = 'Pauta')$fmt$,
    current_setting('t31.mes')), 'ok', 1);

select teste.conferir('A demanda do mes acompanhou',
  (select status::text from public.tasks where id = current_setting('t31.mes')::uuid),
  'em_andamento');

-- E O MIRROR SAIU. A funcao que o fazia era `recalcular_status_da_subtarefa_do_post`,
-- e ela respondia sobre uma linha que nao existe mais.
select teste.conferir('A funcao do mirror saiu com a linha do post',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'recalcular_status_da_subtarefa_do_post'), '0');


-- ---------------------------------------------------------------------------
-- 5. O RELOGIO CORRE NA ETAPA DO MES
--
-- A 0061 desligou o cronometro da linha do post, e com razao: ela entrava em
-- `em_andamento` pelo mirror e ficaria andando o mes inteiro -- centenas de
-- horas numa linha em que ninguem trabalhou. A etapa do mes e o contrario
-- disso, e e metade do que o 3J entrega: ela mede, ela declara o tempo real ao
-- concluir, e `disponibilidade_bruta()` passa a ve-la.
-- ---------------------------------------------------------------------------
select teste.conferir('A etapa do mes abriu passagem no relogio',
  (select (andando_desde is not null)::text from public.etapas_do_mes(
    current_setting('t31.mes')::uuid) where titulo = 'Pauta'), 'true');

-- E A ETAPA COMUM CONTINUA MEDINDO. Sem este cenario, alguem poderia desligar
-- o cronometro inteiro e o de cima passaria.
update public.subtasks set status = 'em_andamento'
 where id = 'dddddddd-0061-0000-0000-000000000001';

select teste.conferir('A etapa comum continua com o relogio correndo',
  (select (andando_desde is not null)::text from public.subtasks
    where id = 'dddddddd-0061-0000-0000-000000000001'), 'true');

-- E A ISENCAO DA AGRUPADORA (0022) CONTINUA DE PE, que e a outra metade do
-- `or` que a 0088 tirou do cronometro: tirando as duas, este cenario cai.
insert into public.subtasks (id, task_id, parent_id, titulo, ordem)
values ('dddddddd-0061-0000-0000-000000000002', 'cccccccc-0061-0000-0000-000000000001',
        'dddddddd-0061-0000-0000-000000000001', 'Sub-etapa', 10)
on conflict (id) do nothing;

update public.subtasks set status = 'em_andamento'
 where id = 'dddddddd-0061-0000-0000-000000000001';

select teste.conferir('A agrupadora continua sem relogio',
  (select (andando_desde is null)::text from public.subtasks
    where id = 'dddddddd-0061-0000-0000-000000000001'), 'true');


-- ---------------------------------------------------------------------------
-- 6. ABRIR O MES DE NOVO REUSA A DEMANDA, E NAO REFAZ AS ETAPAS
--
-- Doze no Instagram hoje, quatro no LinkedIn amanha. Sem o reuso a agencia
-- ficaria com duas demandas "Social de Junho" do mesmo cliente, com os posts
-- espalhados entre as duas e nenhum lugar mostrando o mes inteiro.
--
-- E AS ETAPAS NAO SAO REFEITAS, que e o que mudou na 0088: antes cada post
-- novo ganhava uma corrente nova, e os dois mapas eram aplicados a ela. Agora
-- as etapas existem, com dono e periodo que alguem pode ter ajustado --
-- reescreve-los na segunda chamada desfaria a distribuicao por causa de um
-- "abrir mais dois posts". E a ordem de `coalesce(etapa, padrao)` da 0041.
-- ---------------------------------------------------------------------------
select teste.cenario('A gestao troca o dono da Pauta a mao', :ANA,
  format($fmt$update public.subtasks set responsavel_id = %L
     where id = (select id from public.etapas_do_mes(%L) where titulo = 'Pauta')$fmt$,
    :BRUNO, current_setting('t31.mes')), 'ok', 1);

select teste.cenario('A segunda abertura do mesmo mes dispensa a pasta', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-06', '[{"redes": ["linkedin"], "quantidade": 2}]'::jsonb,
    p_responsaveis => jsonb_build_object('Social Media', %L::text))$fmt$, :VERDE, :MARINA),
  'ok', 1);

select teste.conferir('Continua sendo UMA demanda de junho',
  (select count(*)::text from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'), '1');

select teste.conferir('Continua com cinco etapas, e nao dez',
  (select count(*)::text from public.etapas_do_mes(current_setting('t31.mes')::uuid)), '5');

select teste.conferir('Agora com cinco posts',
  (select count(*)::text from public.posts_do_mes(current_setting('t31.mes')::uuid)), '5');

-- E A DISTRIBUICAO A MAO SOBREVIVEU A SEGUNDA CHAMADA. Este e o cenario que
-- impede a inversao: se `abrir_mes_de_social` reescrevesse os responsaveis, a
-- Pauta voltaria para a Marina.
select teste.conferir('E o dono que alguem ajustou nao foi reescrito',
  (select responsavel_id::text from public.etapas_do_mes(current_setting('t31.mes')::uuid)
    where titulo = 'Pauta'), '44444444-4444-4444-4444-444444444444');

-- E OS POSTS NOVOS GANHARAM CAIXINHA DAS CINCO ETAPAS, pelo gatilho
-- `posts_entra_no_mes`. Sem ele a etapa mostraria "0 de 3" num mes de cinco.
select teste.conferir('Cinco posts vezes cinco etapas: vinte e cinco caixinhas',
  (select count(*)::text from public.post_etapa_progresso g
    where g.post_id in (select id from public.posts_do_mes(current_setting('t31.mes')::uuid))),
  '25');

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
-- 7. O POST SOME, E AS CAIXINHAS DELE SOMEM -- AS ETAPAS FICAM
--
-- Este e o cenario virado do avesso: ele conferia que apagar o post apagava a
-- LINHA dele na demanda, por trigger, porque deste lado nao existia chave.
-- Agora existe -- `post_etapa_progresso.post_id` e `on delete cascade` --, e o
-- que nao pode acontecer e a etapa do mes sair junto: ela e o trabalho de uma
-- pessoa sobre os outros quatro posts.
-- ---------------------------------------------------------------------------
select set_config('t31.post',
  (select id::text from public.posts_do_mes(current_setting('t31.mes')::uuid)
    order by tema limit 1), false);

delete from public.posts where id = current_setting('t31.post')::uuid;

select teste.conferir('As caixinhas do post apagado sumiram',
  (select count(*)::text from public.post_etapa_progresso
    where post_id = current_setting('t31.post')::uuid), '0');

select teste.conferir('E a demanda continua com as cinco etapas',
  (select count(*)::text from public.etapas_do_mes(current_setting('t31.mes')::uuid)), '5');

select teste.conferir('Com o denominador certo',
  (select feitos || ' de ' || total from public.progresso_da_etapa(
    (select id from public.etapas_do_mes(current_setting('t31.mes')::uuid)
      where titulo = 'Pauta'))), '0 de 4');


-- ---------------------------------------------------------------------------
-- 8. O TEMA DO POST NAO MEXE EM ETAPA NENHUMA
--
-- Virado do avesso: a 0061 fazia o titulo da linha acompanhar o tema, porque a
-- linha ERA o post -- sem isso o board mostraria o nome de fabrica para
-- sempre. A etapa do mes se chama "Pauta", e o tema de um post nao tem o que
-- renomear nela.
-- ---------------------------------------------------------------------------
select set_config('t31.outro',
  (select id::text from public.posts_do_mes(current_setting('t31.mes')::uuid)
    order by tema limit 1), false);

update public.posts set tema = 'Bastidores da nova linha'
 where id = current_setting('t31.outro')::uuid;

select teste.conferir('As cinco etapas continuam com o nome da fase',
  (select string_agg(titulo, ' > ' order by ordem)
     from public.etapas_do_mes(current_setting('t31.mes')::uuid)),
  'Pauta > Conteúdo > Layout > Envio > Programar');

select teste.conferir('E o espelho de titulo saiu com a linha do post',
  (select count(*)::text from pg_trigger
    where tgname in ('posts_sincroniza_a_subtarefa', 'posts_apaga_a_subtarefa')
      and not tgisinternal), '0');
