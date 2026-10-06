\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

-- ===========================================================================
-- 21 - A CORRENTE DO SOCIAL E DO MES (migrations 0045, 0076, 0087 e 0088)
--
-- O modelo deste arquivo mudou duas vezes. A 0045 deu ao POST uma corrente de
-- cinco etapas; a 0088 colapsou isso para UMA etapa por fase do MES, por
-- decisao do usuario:
--
--   "A producao vira mensal, a aprovacao continua por post."
--
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "o cliente pede ajustes e a
-- caixinha daquele post desmarca". Ele atravessa a unica coisa que a 0088
-- podia quebrar de forma cara: a etapa e de dezoito posts, e o pedido e de um.
-- Sem ele, ou o mes inteiro volta por causa de uma peca, ou a peca volta sem
-- nada na tela dizendo.
--
-- OS CENARIOS DA CORRENTE POR POST FICARAM, VIRADOS DO AVESSO: se alguem
-- devolver `post_etapas` ou a subtarefa por post, um deles falha e diz qual.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. O MODELO ANTIGO SAIU INTEIRO
--
-- Apagar e nao aposentar (0023). Deixar a tabela parada com os gatilhos de pe
-- seria pior que uma tabela morta: eles disparavam a cada escrita em `posts`,
-- e o banco ficaria com DUAS correntes do mesmo trabalho.
-- ---------------------------------------------------------------------------

select teste.conferir('`post_etapas` nao existe mais',
  (select coalesce(to_regclass('public.post_etapas')::text, '(nenhuma)')), '(nenhuma)');

select teste.conferir('Nem a ponte `posts.subtask_id`',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'subtask_id'), '0');

-- AS QUATRO FUNCOES DA SUBTAREFA POR POST SAIRAM JUNTO. Elas respondiam sobre
-- uma linha que nao existe mais, e funcao orfa e o que alguem reaproveita
-- errado tres sprints depois achando que ainda significa alguma coisa.
select teste.conferir('E as funcoes da subtarefa por post tambem',
  (select string_agg(p.proname, ', ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('subtarefa_de_post', 'montar_etapas_do_post',
                        'recalcular_status_da_subtarefa_do_post',
                        'posts_sincroniza_a_subtarefa', 'post_etapas_regras')),
  null);

-- E O CALENDARIO FULL PERDEU A SEXTA ORIGEM. Ela sai da VIEW e nao so da lista
-- de camadas (0077): uma camada e um interruptor, e tirar o interruptor
-- deixando a origem produzindo esconde as linhas desta tela e as entrega de
-- graca ao proximo consumidor da view.
--
-- E ESTE CENARIO MEDE O TEXTO DA VIEW, nao a contagem: num banco sem etapa
-- nenhuma a contagem passaria com a origem de pe.
select teste.conferir('A `calendar_events` nao cita mais a etapa de post',
  (select case when pg_get_viewdef('public.calendar_events'::regclass) like '%post_etapas%'
               then 'cita' else 'nao cita' end), 'nao cita');

select teste.conferir('E continua `security_invoker`, que `create or replace` nao herda',
  (select case when 'security_invoker=true' = any(c.reloptions) then 'sim' else 'nao' end
     from pg_class c where c.oid = 'public.calendar_events'::regclass), 'sim');


-- ---------------------------------------------------------------------------
-- 2. ABRIR O MES CRIA UMA ETAPA POR FASE, E NAO UMA CORRENTE POR POST
--
-- A conta do usuario: *"o redator escreve as 18 legendas, nao uma por task"*.
-- Um mes de tres posts tinha 3 subtarefas e 15 linhas de corrente; passa a ter
-- 5 subtarefas e 15 caixinhas -- e as 5 sao trabalho de gente, com dono, prazo
-- e relogio.
--
-- UMA PESSOA POR FUNCAO e nao uma por etapa, decisao do usuario desde a 0045:
-- a Pauta e o Programar do mesmo mes sao da mesma social media.
--
-- A Carla e Atendimento e nao Redatora, e entra como Redator de proposito: o
-- mapa diz QUEM FAZ ESTA ETAPA, e a funcao diz O QUE A ETAPA E. Cobrar que a
-- pessoa tenha a funcao viraria uma trava que impede a agencia pequena de se
-- arranjar num dia de aperto.
-- ---------------------------------------------------------------------------

select teste.cenario('A gestao abre tres posts distribuindo a corrente', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-01', '[{"redes": ["instagram"], "quantidade": 3}]'::jsonb, %L,
    jsonb_build_object('Social Media', %L::text, 'Redator', %L::text, 'Design', %L::text),
    jsonb_build_object('Pauta', jsonb_build_object('inicio','2026-12-05','fim','2026-12-10')),
    'https://drive.google.com/drive/folders/PASTA-DE-TESTE')$fmt$,
    :VERDE, :BRUNO, :MARINA, :CARLA, :BRUNO), 'ok', 1);

-- O MES INTEIRO NUMA DEMANDA SO (0061), e agora com cinco folhas em vez de
-- doze: o status dela e calculado pelas folhas desde a 0007, entao a demanda
-- do mes anda conforme as FASES andam.
select teste.conferir('A demanda do mes tem cinco etapas, e nao tres',
  (select count(*)::text from public.etapas_do_mes(
    (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))), '5');

select teste.conferir('Na ordem que o fluxo ditou',
  (select string_agg(titulo, ' > ' order by ordem) from public.etapas_do_mes(
    (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))),
  'Pauta > Conteúdo > Layout > Envio > Programar');

select teste.conferir('Com o papel de cada uma',
  (select string_agg(titulo || ':' || social_papel, ', ' order by ordem)
     from public.etapas_do_mes(
       (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))
    where social_papel <> 'producao'),
  'Envio:entrega, Programar:pos_entrega');

-- A ORDEM TEM FOLGA DE DEZ, que vem do elo do fluxo (0087): a etapa de Ajustes
-- nascia ENTRE duas, e a folga continua sendo o que permite acrescentar uma
-- fase no meio sem renumerar as seguintes.
select teste.conferir('Com folga entre os numeros',
  (select string_agg(ordem::text, ',' order by ordem) from public.etapas_do_mes(
    (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))),
  '10,20,30,40,50');

select teste.conferir('A Pauta e o Programar sairam na mesma social media',
  (select count(*)::text from public.etapas_do_mes(
    (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))
    where responsavel_id = :MARINA), '2');

select teste.conferir('E o Conteudo saiu na Carla',
  (select responsavel_id::text from public.etapas_do_mes(
    (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))
    where titulo = 'Conteúdo'), '33333333-3333-3333-3333-333333333333');

-- O ENVIO FICA SEM DONO, e e de proposito: a funcao dele e `Gestao`, e o mapa
-- nao traz `Gestao`. Enviar ao cliente e da gestao desde a 0007 -- quem envia
-- e quem estiver de plantao, nao um nome escolhido no comeco do mes.
select teste.conferir('E o Envio nao tem dono',
  (select (responsavel_id is null)::text from public.etapas_do_mes(
    (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))
    where titulo = 'Envio'), 'true');

-- FUNCAO SEM DONO AVISA, NUNCA RECUSA (0064), e a frase NOMEIA a funcao que
-- faltou -- "ha etapa sem responsavel" manda abrir uma por uma.
select teste.conferir('E o aviso dela nomeia a funcao que faltou',
  (select (aviso_geracao like '%Gestao%')::text from public.etapas_do_mes(
    (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))
    where titulo = 'Envio'), 'true');

-- O PERIODO E DO MES E NAO DE CADA POST (0084): se a Pauta comeca no dia X,
-- essa data vale para todos os posts. Era isso que a 0084 fazia escrevendo a
-- mesma data em doze correntes.
select teste.conferir('O periodo da Pauta e UM, do mes',
  (select data_inicio || ' a ' || prazo from public.etapas_do_mes(
    (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))
    where titulo = 'Pauta'), '2026-12-05 a 2026-12-10');

select teste.conferir('A Marina foi avisada da etapa dela',
  (select case when count(*) >= 1 then 'sim' else 'nao' end
     from public.notifications where user_id = :MARINA and tipo = 'task'), 'sim');


-- ---------------------------------------------------------------------------
-- 3. A CORRENTE E DEPENDENCIA DE VERDADE
--
-- `post_etapas_regras` reimplementava a dependencia de subtarefa pela ORDEM da
-- tabela. Com a etapa sendo subtarefa, quem recusa e
-- `validar_transicao_de_subtarefa` (0007) -- a mesma trava do resto do produto,
-- e a tela mostra o cadeado com o que esta faltando.
-- ---------------------------------------------------------------------------

select teste.conferir('As cinco etapas estao encadeadas',
  (select count(*)::text from public.subtask_dependencies d
     join public.subtasks s on s.id = d.subtask_id
    where s.task_id = (select id from public.tasks
                        where client_id = :VERDE and social_do_mes = '2027-01-01')), '4');

select teste.recusa_com('O Conteudo nao comeca antes da Pauta', :CARLA,
  format($fmt$update public.subtasks set status = 'em_andamento'
     where titulo = 'Conteúdo' and social_papel is not null
       and task_id = (select id from public.tasks
                       where client_id = %L and social_do_mes = '2027-01-01')$fmt$, :VERDE),
  'aguardando: Pauta');

select teste.cenario('A Pauta comeca, porque e a primeira', :MARINA,
  format($fmt$update public.subtasks set status = 'em_andamento'
     where titulo = 'Pauta' and social_papel is not null
       and task_id = (select id from public.tasks
                       where client_id = %L and social_do_mes = '2027-01-01')$fmt$, :VERDE),
  'ok', 1);

-- E O RELOGIO CORRE NELA, que e metade do que o 3J entrega. A subtarefa de
-- post tinha a isencao do cronometro (0061) porque o status dela vinha do
-- mirror da corrente -- "720h" numa etapa em que ninguem trabalhou. A etapa do
-- mes e trabalho de gente.
select teste.conferir('E o relogio dela comecou a correr',
  (select (andando_desde is not null)::text from public.subtasks
    where titulo = 'Pauta' and social_papel is not null
      and task_id = (select id from public.tasks
                      where client_id = :VERDE and social_do_mes = '2027-01-01')), 'true');


-- ---------------------------------------------------------------------------
-- 4. A CAIXINHA: O "12 DE 18" DO CABECALHO
--
-- *"As linhas sao criadas junto com o plano: um registro por post x etapa."*
-- Elas nascem por GATILHO e nao por uma linha dentro de `abrir_mes_de_social`
-- (0088), pela razao da auditoria: o post pode entrar num mes que ja existe, e
-- a etapa pode entrar num mes que ja tem posts.
-- ---------------------------------------------------------------------------

select teste.conferir('Tres posts vezes cinco etapas: quinze caixinhas',
  (select count(*)::text from public.post_etapa_progresso g
     join public.posts p on p.id = g.post_id
    where p.social_task_id = (select id from public.tasks
                               where client_id = :VERDE and social_do_mes = '2027-01-01')), '15');

select teste.conferir('E nenhuma marcada ainda',
  (select feitos || ' de ' || total from public.progresso_da_etapa(
    (select id from public.etapas_do_mes(
      (select id from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'))
      where titulo = 'Pauta'))), '0 de 3');

select set_config('t21.mes',
  (select id::text from public.tasks where client_id = :VERDE and social_do_mes = '2027-01-01'), false);
select set_config('t21.post',
  (select id::text from public.posts where social_task_id = current_setting('t21.mes')::uuid
    order by tema limit 1), false);
select set_config('t21.pauta',
  (select id::text from public.etapas_do_mes(current_setting('t21.mes')::uuid) where titulo = 'Pauta'), false);
select set_config('t21.conteudo',
  (select id::text from public.etapas_do_mes(current_setting('t21.mes')::uuid) where titulo = 'Conteúdo'), false);
select set_config('t21.layout',
  (select id::text from public.etapas_do_mes(current_setting('t21.mes')::uuid) where titulo = 'Layout'), false);
select set_config('t21.envio',
  (select id::text from public.etapas_do_mes(current_setting('t21.mes')::uuid) where titulo = 'Envio'), false);
select set_config('t21.programar',
  (select id::text from public.etapas_do_mes(current_setting('t21.mes')::uuid) where titulo = 'Programar'), false);

-- QUEM MARCA E QUEM ESTA COM A ETAPA, e `minha_etapa_do_mes()` e a porta.
select teste.cenario('A Marina marca a Pauta de um post', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.pauta')), 'ok', 1);

select teste.conferir('E o cabecalho dela anda',
  (select feitos || ' de ' || total
     from public.progresso_da_etapa(current_setting('t21.pauta')::uuid)), '1 de 3');

select teste.conferir('Com o carimbo de quem marcou',
  (select concluido_por::text from public.post_etapa_progresso
    where post_id = current_setting('t21.post')::uuid
      and subtask_id = current_setting('t21.pauta')::uuid),
  '55555555-5555-5555-5555-555555555555');

-- A CAIXINHA DE OUTRA ETAPA NAO E DELA. A etapa Layout e do Bruno, e a Marina
-- passa pela policy de `post_etapa_progresso` so nas linhas da etapa dela.
select teste.cenario('A Marina nao marca a caixinha do Layout', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.layout')), 'ok', 0);


-- ---------------------------------------------------------------------------
-- 5. AS DUAS TRAVAS DA CAIXINHA
--
-- A corrente mensal e dependencia de subtarefa, e isso e sobre a ETAPA. A
-- pergunta do dia a dia e sobre o POST: posso marcar o Layout DESTE post?
-- ---------------------------------------------------------------------------

-- TRAVA A - a corrente, neste post. E a regra da 0045 -- *"o redator
-- escrevendo antes de a pauta existir escreve sobre o que achou"* -- por post
-- em vez de por etapa. A RECUSA NOMEIA O QUE FALTA, e todas.
select teste.recusa_com_dica('O Layout de um post sem Conteudo e recusado', :BRUNO,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.layout')),
  'post por post');

select teste.recusa_com('E a recusa nomeia a fase que falta', :BRUNO,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.layout')),
  'falta Conteúdo');

select teste.cenario('Com o Conteudo marcado, o Layout passa', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.conteudo')), 'ok', 1);

select teste.cenario('E agora o Bruno marca o Layout', :BRUNO,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.layout')), 'ok', 1);

-- A CAIXINHA DA ENTREGA NAO SE MARCA A MAO, NEM PELA SOCIA. E a regra da 0045
-- um nivel abaixo: a etapa Envio era consequencia da rodada de escopo cliente,
-- e a caixinha dela e consequencia da APROVACAO daquele post.
select teste.recusa_com('Nem a socia marca a caixinha da entrega', :ANA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.envio')),
  'não se marca à mão');

-- TRAVA B - "ninguem programa o que o cliente nao aprovou", que era a trava da
-- etapa Programar na 0045. Ela sai da MESMA conta dos portoes: antes do
-- Programar ha um portao (o Envio), entao ele precisa de uma aprovacao.
select teste.recusa_com('O Programar espera o cliente', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.programar')),
  'ainda não aprovou Envio');

-- E O POST E A ETAPA NAO TROCAM DE LUGAR. Policy nao limita coluna: sem esta
-- trava, um PATCH moveria a marcacao de um post para outro, e o "12 de 18"
-- continuaria dizendo doze.
select teste.recusa_com('A caixinha nao muda de post', :BRUNO,
  format($fmt$update public.post_etapa_progresso set post_id = (
       select id from public.posts where social_task_id = %L
         and id <> %L limit 1)
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.mes'), current_setting('t21.post'),
     current_setting('t21.post'), current_setting('t21.layout')),
  'nenhum dos dois muda');

-- E A CAIXINHA SO EXISTE EM ETAPA DE MES. Uma subtarefa comum nao tem posts
-- dentro dela: o progresso dela e o status.
select teste.recusa_com('Caixinha em subtarefa comum e recusada', :ANA,
  format($fmt$insert into public.post_etapa_progresso (post_id, subtask_id)
    values (%L, (select s.id from public.subtasks s
                  where s.social_papel is null limit 1))$fmt$,
     current_setting('t21.post')),
  'etapa de mês de social');


-- ---------------------------------------------------------------------------
-- 6. O CENARIO QUE JUSTIFICA O ARQUIVO: O CLIENTE PEDE AJUSTES
--
-- A etapa e de tres posts e o pedido e de um. Sem esta parte, ou o mes inteiro
-- volta por causa de uma peca -- que e o que uma etapa "Ajustes" do mes
-- afirmaria --, ou a peca volta sem nada na tela dizendo.
--
-- E AS TRAVAS RODAM COM O `auth.uid()` DO CLIENTE, porque `security definer`
-- nao troca quem esta logado: sem a saida do GUC, a caixinha da entrega
-- recusaria a desmarcacao e o cliente levaria um erro de banco clicando no
-- unico botao que ele tem. E a trava nova quebrando a acao mais antiga do
-- portal, que foi o que a 0045 registrou.
-- ---------------------------------------------------------------------------

-- A CORRENTE DO MES SE FECHA EM ORDEM, e quem recusa fora de ordem e
-- `validar_transicao_de_subtarefa` (0007): a etapa de Layout nao conclui antes
-- de o Conteudo fechar. Era `post_etapas_regras` que reimplementava isso.
select teste.cenario('A Pauta do mes se conclui', :MARINA,
  format($fmt$update public.subtasks set status = 'concluida' where id = %L$fmt$,
     current_setting('t21.pauta')), 'ok', 1);

select teste.cenario('O Conteudo tambem', :CARLA,
  format($fmt$update public.subtasks set status = 'concluida' where id = %L$fmt$,
     current_setting('t21.conteudo')), 'ok', 1);

select teste.cenario('E agora a de Layout', :BRUNO,
  format($fmt$update public.subtasks set status = 'concluida' where id = %L$fmt$,
     current_setting('t21.layout')), 'ok', 1);

-- POST SEM DATA NAO VAI AO CLIENTE (0044), e o mes abre em branco: a data e de
-- quem produz, e sem ela o cliente abriria a tela para decidir sobre a arte
-- sem saber quando ela vai ao ar.
select teste.cenario('A gestao data o post', :DIEGO,
  format($fmt$update public.posts set data_publicacao = '2027-01-15' where id = %L$fmt$,
     current_setting('t21.post')), 'ok', 1);

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', current_setting('t21.post')::uuid, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao envia o post ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$,
    current_setting('t21.post'), :DIEGO), 'ok', 1);

select teste.cenario('A Joana pede ajustes', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'ajustes_solicitados', 'O logo ficou pequeno no rodape.')$fmt$,
    current_setting('t21.post')), 'ok', 1);

-- NAO NASCE ETAPA NENHUMA, e e a simplificacao do 3J. Este cenario e o da
-- 0045 virado do avesso: la ele conferia que a etapa "Ajustes" nascia.
select teste.conferir('Nao nasceu etapa de Ajustes nenhuma',
  (select count(*)::text from public.subtasks
    where task_id = current_setting('t21.mes')::uuid and titulo like 'Ajustes%'), '0');

select teste.conferir('E o mes continua com cinco etapas',
  (select count(*)::text from public.etapas_do_mes(current_setting('t21.mes')::uuid)), '5');

-- QUEM REFAZ A ARTE E QUEM A FEZ, e nao quem a enviou. A regra da 0045
-- sobrevive inteira, e e a unica parte da etapa de Ajustes que fica -- a
-- pergunta e POSICIONAL (o ultimo elo de producao antes da entrega) e nao pelo
-- nome 'Layout', pela razao da 0087.
select teste.conferir('A caixinha do LAYOUT daquele post desmarcou',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t21.post')::uuid
      and subtask_id = current_setting('t21.layout')::uuid), 'false');

select teste.conferir('E o pedido dele ficou na observacao daquela caixinha',
  (select observacao from public.post_etapa_progresso
    where post_id = current_setting('t21.post')::uuid
      and subtask_id = current_setting('t21.layout')::uuid),
  'O logo ficou pequeno no rodape.');

-- A CAIXINHA DO CONTEUDO NAO DESMARCA, e e a metade que importa: o cliente
-- recusou a ARTE, nao o texto. Desmarcar a corrente inteira poria o redator
-- para reescrever o que ninguem pediu.
select teste.conferir('E a do Conteudo continua marcada',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t21.post')::uuid
      and subtask_id = current_setting('t21.conteudo')::uuid), 'true');

-- A ETAPA REABRE, e e isso que devolve o trabalho para quem o fez: ela estava
-- concluida, um post voltou, e ela nao esta mais.
select teste.conferir('A etapa de Layout reabriu',
  (select status::text from public.subtasks where id = current_setting('t21.layout')::uuid),
  'em_andamento');

select teste.conferir('O Bruno foi avisado do pedido',
  (select count(*)::text from public.notifications
    where user_id = :BRUNO and titulo like 'O cliente pediu ajustes%'), '1');

-- OS OUTROS DOIS POSTS NAO FORAM TOCADOS, que e a frase do usuario em SQL: a
-- producao e mensal, a aprovacao e por post.
select teste.conferir('E os outros posts do mes nao foram tocados',
  (select count(*)::text from public.post_etapa_progresso g
    where g.subtask_id = current_setting('t21.layout')::uuid
      and g.post_id <> current_setting('t21.post')::uuid
      and g.observacao is not null), '0');

-- E O GUC DESLIGA ANTES DE A FUNCAO DEVOLVER. Se ele ficasse ligado, a mesma
-- transacao passaria pelas travas caladas -- a saida de emergencia virando
-- porta destrancada. Numa transacao nova ela esta de pe outra vez.
select teste.recusa_com('E a trava da entrega continua de pe depois disso', :ANA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.envio')),
  'não se marca à mão');


-- ---------------------------------------------------------------------------
-- 7. APROVAR FECHA A CAIXINHA DA ENTREGA
-- ---------------------------------------------------------------------------

select teste.cenario('O Bruno refaz e marca de novo', :BRUNO,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.layout')), 'ok', 1);

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', current_setting('t21.post')::uuid, 2, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('Segunda volta ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 2, 'cliente', %L, 'pendente')$fmt$,
    current_setting('t21.post'), :DIEGO), 'ok', 1);

select teste.cenario('E agora ela aprova', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
        and numero_rodada = 2),
    'aprovada', 'Ficou ótimo.')$fmt$, current_setting('t21.post')), 'ok', 1);

select teste.conferir('A caixinha da entrega fechou sozinha',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t21.post')::uuid
      and subtask_id = current_setting('t21.envio')::uuid), 'true');

select teste.conferir('E so a daquele post',
  (select feitos || ' de ' || total
     from public.progresso_da_etapa(current_setting('t21.envio')::uuid)), '1 de 3');

-- AGORA O PROGRAMAR PASSA, naquele post e so nele. A trava B conta os portoes
-- anteriores, e o cliente aprovou o unico que havia.
select teste.cenario('O Programar daquele post passa', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
     current_setting('t21.post'), current_setting('t21.programar')), 'ok', 1);

-- E A RECUSA DO OUTRO POST NOMEIA O PORTAO, e nao a corrente: a trava B vem
-- antes da A de proposito -- a caixinha da entrega so fecha pela aprovacao,
-- entao as duas valeriam, e "falta Envio" e verdade sem dizer de quem a bola
-- esta.
select teste.recusa_com('E o de outro post continua travado', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where subtask_id = %L and post_id <> %L$fmt$,
     current_setting('t21.programar'), current_setting('t21.post')),
  'ainda não aprovou Envio');


-- ---------------------------------------------------------------------------
-- 8. O CLIENTE NAO ENXERGA A CORRENTE, NEM A CAIXINHA
--
-- A corrente e conversa interna: ele decide sobre o material, nao acompanha
-- quem da casa esta com ele na mao. E a trava e a AUSENCIA de policy para ele
-- -- nao um filtro na consulta. Era assim em `post_etapas` desde a 0045, e
-- continua sendo em `post_etapa_progresso`.
-- ---------------------------------------------------------------------------

select teste.cenario('O cliente nao ve caixinha nenhuma', :JOANA,
  $fmt$select id from public.post_etapa_progresso$fmt$, 'ok', 0);

select teste.cenario('Nem do proprio post que ele aprovou', :JOANA,
  format($fmt$select id from public.post_etapa_progresso where post_id = %L$fmt$,
    current_setting('t21.post')), 'ok', 0);

select teste.cenario('E nao escreve em nenhuma', :JOANA,
  format($fmt$update public.post_etapa_progresso set concluido = false
     where post_id = %L$fmt$, current_setting('t21.post')), 'ok', 0);

select teste.cenario('Nem cria uma', :JOANA,
  format($fmt$insert into public.post_etapa_progresso (post_id, subtask_id)
    values (%L, %L)$fmt$, current_setting('t21.post'), current_setting('t21.pauta')),
  'recusa');

-- O QUE ELE PRECISA SABER SAI DE UMA FUNCAO `security definer`, devolvendo so
-- o agregado -- a forma de `usuarios_do_meu_cliente()` (0031). Na ENTREGA ela
-- devolve nada: a entrega manda o material pronto, e a tela dela ja e a de
-- sempre.
select teste.conferir_como('E `o_que_o_cliente_decide` nao anuncia a entrega', :JOANA,
  format($fmt$select count(*)::text from public.o_que_o_cliente_decide(%L)$fmt$,
    current_setting('t21.post')), '0');


-- ---------------------------------------------------------------------------
-- 9. APAGAR
-- ---------------------------------------------------------------------------

-- `on delete cascade` nas DUAS chaves, e nao trigger: aqui as chaves
-- estrangeiras existem -- ao contrario de `approval_rounds.content_id`, que
-- aponta para tabelas diferentes conforme o tipo e por isso precisou do
-- gatilho da 0030.
select teste.cenario('A socia apaga um post do mes', :ANA,
  format($fmt$delete from public.posts where id = %L$fmt$, current_setting('t21.post')),
  'ok', 1);

select teste.conferir('E as caixinhas dele foram junto',
  (select count(*)::text from public.post_etapa_progresso
    where post_id = current_setting('t21.post')::uuid), '0');

select teste.conferir('A etapa continua, com o denominador certo',
  (select feitos || ' de ' || total
     from public.progresso_da_etapa(current_setting('t21.pauta')::uuid)), '0 de 2');

-- E APAGAR A ETAPA LEVA AS CAIXINHAS DELA. Nao existe policy de DELETE em
-- `post_etapa_progresso`, e a ausencia e a regra: apagar uma a mao deixaria a
-- etapa com "11 de 17" num mes de dezoito posts -- um denominador que mente.
select teste.cenario('A socia apaga a etapa Programar', :ANA,
  format($fmt$delete from public.subtasks where id = %L$fmt$, current_setting('t21.programar')),
  'ok', 1);

select teste.conferir('E as caixinhas dela foram junto',
  (select count(*)::text from public.post_etapa_progresso
    where subtask_id = current_setting('t21.programar')::uuid), '0');
