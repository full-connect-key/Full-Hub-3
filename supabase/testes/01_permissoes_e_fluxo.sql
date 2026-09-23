\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set RAFAEL  '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

select teste.limpar();
truncate teste.resultado;

-- ===========================================================================
-- CENARIO BASE: uma Task da Mundo Verde com quatro subtarefas.
--   1 Conceito    Marina   sem aprovacao
--   2 KV          Bruno    aprovacao CLIENTE      depende de 1
--   3 Landing     Diego    aprovacao INTERNA      (o proprio desenvolvedor)
--   4 Agendamento Marina   sem aprovacao          depende de 2
-- ===========================================================================
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, data_fim, link_entrega)
values ('cccccccc-0000-0000-0000-00000000000a', :VERDE, 'Campanha de Instagram',
        :CARLA, '2026-10-01', '2026-10-30', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, requer_aprovacao, tipo_aprovacao) values
  ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-00000000000a','Criar conceito',1,:MARINA,'2026-10-05',false,null),
  ('dddddddd-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-00000000000a','Criar KV',      2,:BRUNO, '2026-10-10',true,'cliente'),
  ('dddddddd-0000-0000-0000-000000000003','cccccccc-0000-0000-0000-00000000000a','Desenvolver landing',3,:DIEGO,'2026-10-20',true,'interna'),
  ('dddddddd-0000-0000-0000-000000000004','cccccccc-0000-0000-0000-00000000000a','Agendamento',   4,:MARINA,'2026-10-25',false,null);

insert into public.subtask_dependencies (subtask_id, depende_de_id) values
  ('dddddddd-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000004','dddddddd-0000-0000-0000-000000000002');

-- Uma task da OUTRA empresa, para o teste de isolamento.
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('cccccccc-0000-0000-0000-00000000000b', :OPTICA, 'Vitrine da Óptica', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('dddddddd-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-00000000000b','Arte da vitrine',1,:BRUNO,true,'cliente');


-- ---------------------------------------------------------------------------
-- QUEM CRIA O QUE
-- ---------------------------------------------------------------------------
select teste.cenario('Colaborador fora do Atendimento NAO cria task', :MARINA,
  format('insert into public.tasks (client_id, titulo, criado_por, data_inicio, link_entrega) values (%L, %L, %L, current_date, ''https://drive.google.com/drive/folders/teste'')', :VERDE, 'Tentativa', :MARINA),
  'recusa');

select teste.cenario('Carla (colaboradora do Atendimento) cria task', :CARLA,
  format('insert into public.tasks (client_id, titulo, criado_por, data_inicio, link_entrega) values (%L, %L, %L, current_date, ''https://drive.google.com/drive/folders/teste'')', :VERDE, 'Task da Carla', :CARLA),
  'ok', 1);

select teste.cenario('Colaborador fora do Atendimento NAO cria subtarefa', :MARINA,
  'insert into public.subtasks (task_id, titulo, ordem) values (''cccccccc-0000-0000-0000-00000000000a'', ''Puxadinho'', 9)',
  'recusa');

-- Cliente deixou de ser `not null` na 0028: o rascunho nasce sem ele, e a
-- exigencia passou para a PUBLICACAO. Uma demanda publicada sem cliente
-- continua sendo recusada -- so mudou a porta onde isso e cobrado.
select teste.cenario('Task PUBLICADA sem cliente e recusada', :CARLA,
  format($fmt$insert into public.tasks (client_id, titulo, criado_por, data_inicio, link_entrega, publicada_em)
    values (null, %L, %L, current_date, 'https://drive.google.com/drive/folders/teste', now())$fmt$,
    'Sem dono', :CARLA),
  'recusa');


-- ---------------------------------------------------------------------------
-- DEPENDENCIAS
-- ---------------------------------------------------------------------------
select teste.cenario('Subtarefa bloqueada NAO sai de nao_iniciada', :BRUNO,
  'update public.subtasks set status = ''em_andamento'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'recusa');

select teste.cenario('Dependencia circular e recusada', :CARLA,
  'insert into public.subtask_dependencies (subtask_id, depende_de_id) values (''dddddddd-0000-0000-0000-000000000001'', ''dddddddd-0000-0000-0000-000000000002'')',
  'recusa');

select teste.cenario('Dependencia entre tasks diferentes e recusada', :CARLA,
  'insert into public.subtask_dependencies (subtask_id, depende_de_id) values (''dddddddd-0000-0000-0000-000000000001'', ''dddddddd-0000-0000-0000-00000000000b'')',
  'recusa');


-- ---------------------------------------------------------------------------
-- FLUXO SEM APROVACAO
-- ---------------------------------------------------------------------------
select teste.cenario('Marina conclui a subtarefa dela, que nao exige aprovacao', :MARINA,
  'update public.subtasks set status = ''concluida'', tempo_real_minutos = 150 where id = ''dddddddd-0000-0000-0000-000000000001''',
  'ok', 1);

select teste.cenario('Concluida a dependencia, a seguinte destrava', :BRUNO,
  'update public.subtasks set status = ''em_andamento'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'ok', 1);

select teste.cenario('Colaborador NAO mexe na subtarefa de outra pessoa', :RAFAEL,
  'update public.subtasks set status = ''concluida'' where id = ''dddddddd-0000-0000-0000-000000000004''',
  'recusa');


-- ---------------------------------------------------------------------------
-- FLUXO COM APROVACAO
-- ---------------------------------------------------------------------------
select teste.cenario('Responsavel NAO conclui subtarefa que exige aprovacao', :BRUNO,
  'update public.subtasks set status = ''concluida'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'recusa');

select teste.cenario('Nem a gestao conclui direto uma que exige aprovacao', :ANA,
  'update public.subtasks set status = ''concluida'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'recusa');

select teste.cenario('enviada_aprovacao sem rodada pendente e recusado', :BRUNO,
  'update public.subtasks set status = ''enviada_aprovacao'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'recusa');

select teste.cenario('Bruno anexa a entrega dele', :BRUNO,
  format('insert into public.subtask_entregas (subtask_id, tipo, url, nome, enviado_por) values (''dddddddd-0000-0000-0000-000000000002'', ''link'', ''https://drive/kv'', ''KV v1'', %L)', :BRUNO),
  'ok', 1);

select teste.cenario('Bruno abre a rodada 1 interna', :BRUNO,
  format('insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por) values (''dddddddd-0000-0000-0000-000000000002'', 1, ''interna'', %L)', :BRUNO),
  'ok', 1);

select teste.cenario('Agora sim a subtarefa vai para enviada_aprovacao', :BRUNO,
  'update public.subtasks set status = ''enviada_aprovacao'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'ok', 1);

select teste.cenario('Rafael (colaborador) NAO aprova rodada nenhuma', :RAFAEL,
  format('update public.approval_rounds set status = ''aprovada'', decidido_por = %L where content_id = ''dddddddd-0000-0000-0000-000000000002'' and numero_rodada = 1', :RAFAEL),
  'recusa');

-- Bruno e colaborador, e depois da 0029 e isso -- e so isso -- que o barra.
-- Ate a 0029 ele era recusado DUAS vezes (por nao ser gestao e por ser o dono
-- da entrega), e o cenario nao distinguia uma da outra. Agora a unica trava
-- que sobra e `pode_aprovar_subtarefa` = `is_gestor()`, e a recusa vem como
-- zero linhas da policy, nao como excecao.
select teste.cenario('Bruno (colaborador) NAO decide rodada nenhuma, nem a dele', :BRUNO,
  format('update public.approval_rounds set status = ''aprovada'', decidido_por = %L where content_id = ''dddddddd-0000-0000-0000-000000000002'' and numero_rodada = 1', :BRUNO),
  'recusa');

select teste.cenario('Desenvolvedor pede ajustes SEM comentario: recusado', :DIEGO,
  format('update public.approval_rounds set status = ''ajustes_solicitados'', decidido_por = %L where content_id = ''dddddddd-0000-0000-0000-000000000002'' and numero_rodada = 1', :DIEGO),
  'recusa');

select teste.cenario('Desenvolvedor pede ajustes COM comentario', :DIEGO,
  format('update public.approval_rounds set status = ''ajustes_solicitados'', decidido_por = %L, comentario = ''Trocar a cor do fundo'' where content_id = ''dddddddd-0000-0000-0000-000000000002'' and numero_rodada = 1', :DIEGO),
  'ok', 1);

select teste.cenario('Subtarefa volta para em_ajustes', :DIEGO,
  'update public.subtasks set status = ''em_ajustes'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'ok', 1);

select teste.cenario('Rodada fechada NAO muda de resultado', :DIEGO,
  format('update public.approval_rounds set status = ''aprovada'', decidido_por = %L where content_id = ''dddddddd-0000-0000-0000-000000000002'' and numero_rodada = 1', :DIEGO),
  'recusa');

select teste.cenario('Bruno abre a rodada 2, sem apagar a 1', :BRUNO,
  format('insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por) values (''dddddddd-0000-0000-0000-000000000002'', 2, ''interna'', %L)', :BRUNO),
  'ok', 1);

select teste.cenario('Volta para enviada_aprovacao na rodada 2', :BRUNO,
  'update public.subtasks set status = ''enviada_aprovacao'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'ok', 1);

select teste.cenario('Desenvolvedor aprova a rodada 2 (interna)', :DIEGO,
  format('update public.approval_rounds set status = ''aprovada'', decidido_por = %L where content_id = ''dddddddd-0000-0000-0000-000000000002'' and numero_rodada = 2', :DIEGO),
  'ok', 1);

-- tipo_aprovacao = cliente: o aval interno NAO conclui a subtarefa
select teste.cenario('Aval interno nao conclui subtarefa de tipo cliente', :DIEGO,
  'update public.subtasks set status = ''concluida'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'recusa');

select teste.cenario('Responsavel NAO envia ao cliente', :BRUNO,
  format('insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por) values (''dddddddd-0000-0000-0000-000000000002'', 2, ''cliente'', %L)', :BRUNO),
  'recusa');

select teste.cenario('Desenvolvedor envia ao cliente (rodada 2, escopo cliente)', :DIEGO,
  format('insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por) values (''dddddddd-0000-0000-0000-000000000002'', 2, ''cliente'', %L)', :DIEGO),
  'ok', 1);


-- ---------------------------------------------------------------------------
-- A GESTAO APROVA A SI MESMA (migration 0029)
--
-- Era o cenario "Diego (desenvolvedor) NAO aprova a propria subtarefa", e ele
-- virou do avesso por decisao do usuario. O bloco maior mais abaixo cobre os
-- tres estados em que essa trava aparecia; este cobre o caminho comum -- a
-- etapa e dele, a rodada e dele, ele decide.
-- ---------------------------------------------------------------------------
select teste.cenario('Diego pede aprovacao da subtarefa dele', :DIEGO,
  format('insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por) values (''dddddddd-0000-0000-0000-000000000003'', 1, ''interna'', %L)', :DIEGO),
  'ok', 1);

select teste.cenario('Diego (desenvolvedor) aprova a propria subtarefa', :DIEGO,
  format('update public.approval_rounds set status = ''aprovada'', decidido_por = %L where content_id = ''dddddddd-0000-0000-0000-000000000003'' and numero_rodada = 1', :DIEGO),
  'ok', 1);

-- E o que a 0029 NAO afrouxou: rodada decidida continua fechada, nem para a
-- socia. Sem este, "a gestao pode tudo" passaria por correto aqui.
select teste.recusa_com('E nem a socia reescreve a rodada ja decidida', :ANA,
  format('update public.approval_rounds set status = ''ajustes_solicitados'', decidido_por = %L, comentario = ''mudei de ideia'' where content_id = ''dddddddd-0000-0000-0000-000000000003'' and numero_rodada = 1', :ANA),
  'já decidida não muda de resultado');

select teste.cenario('Com aval interno, a de tipo interna conclui', :DIEGO,
  'update public.subtasks set status = ''concluida'' where id = ''dddddddd-0000-0000-0000-000000000003''',
  'ok', 1);


-- ---------------------------------------------------------------------------
-- O CLIENTE
-- ---------------------------------------------------------------------------
select teste.cenario('Joana ve a rodada de cliente da empresa dela', :JOANA,
  'select 1 from public.approval_rounds where content_id = ''dddddddd-0000-0000-0000-000000000002'' and escopo = ''cliente''',
  'ok', 1);

select teste.cenario('Joana NAO ve nenhuma rodada interna', :JOANA,
  'select 1 from public.approval_rounds where escopo = ''interna''',
  'ok', 0);

select teste.cenario('Joana ve a entrega anexada', :JOANA,
  'select 1 from public.subtask_entregas where subtask_id = ''dddddddd-0000-0000-0000-000000000002''',
  'ok', 1);

select teste.cenario('Joana NAO le o historico interno', :JOANA,
  'select 1 from public.task_history',
  'ok', 0);

select teste.cenario('Joana NAO escreve em subtasks', :JOANA,
  'update public.subtasks set status = ''concluida'' where id = ''dddddddd-0000-0000-0000-000000000002''',
  'ok', 0);

select teste.cenario('Otto (outro cliente) NAO ve a task da Mundo Verde', :OTTO,
  'select 1 from public.tasks where id = ''cccccccc-0000-0000-0000-00000000000a''',
  'ok', 0);

select teste.cenario('Otto NAO ve a subtarefa da Mundo Verde', :OTTO,
  'select 1 from public.subtasks where id = ''dddddddd-0000-0000-0000-000000000002''',
  'ok', 0);

select teste.cenario('Otto NAO ve a rodada da Mundo Verde', :OTTO,
  'select 1 from public.approval_rounds where content_id = ''dddddddd-0000-0000-0000-000000000002''',
  'ok', 0);

select teste.cenario('Otto NAO ve a entrega da Mundo Verde', :OTTO,
  'select 1 from public.subtask_entregas where subtask_id = ''dddddddd-0000-0000-0000-000000000002''',
  'ok', 0);

select teste.cenario('Otto NAO decide a rodada da Mundo Verde', :OTTO,
  '(select public.decidir_rodada_do_cliente((select id from public.approval_rounds where content_id = ''dddddddd-0000-0000-0000-000000000002'' and escopo = ''cliente''), ''aprovada'', null))',
  'recusa');

select teste.cenario('Joana pede ajustes SEM dizer o que ajustar: recusado', :JOANA,
  '(select public.decidir_rodada_do_cliente((select id from public.approval_rounds where content_id = ''dddddddd-0000-0000-0000-000000000002'' and escopo = ''cliente''), ''ajustes_solicitados'', ''  ''))',
  'recusa');

select teste.cenario('Joana aprova, e a subtarefa conclui', :JOANA,
  '(select public.decidir_rodada_do_cliente((select id from public.approval_rounds where content_id = ''dddddddd-0000-0000-0000-000000000002'' and escopo = ''cliente''), ''aprovada'', ''Perfeito''))',
  'ok');


-- ---------------------------------------------------------------------------
-- HISTORICO NAO SE REESCREVE
-- ---------------------------------------------------------------------------
select teste.cenario('Ninguem apaga o historico', :ANA,
  'delete from public.task_history',
  'ok', 0);

select teste.cenario('Ninguem edita o historico', :ANA,
  'update public.task_history set acao = ''nada''',
  'ok', 0);

select teste.cenario('Ninguem apaga uma rodada de aprovacao', :ANA,
  'delete from public.approval_rounds',
  'ok', 0);

-- ===========================================================================
-- A GESTAO APROVA, INCLUSIVE O PROPRIO TRABALHO (migration 0029)
--
-- DECISAO DO USUARIO, e ela desfaz a 0026: "se uma task precisar de
-- aprovacao, qualquer pessoa com acesso de desenvolvedor, consegue aprovar".
--
-- Estes cenarios eram os tres furos que a 0026 fechou. Ficam aqui, virados do
-- avesso: os mesmos tres caminhos, agora provando que PASSAM. Eles nao sao
-- redundantes entre si nem depois da virada -- cada um monta um estado
-- diferente (etapa sem dono, rodada aberta pela propria pessoa, entrega
-- anexada antes da troca de responsavel), e e exatamente nesses tres estados
-- que a trava antiga aparecia. Se alguem reintroduzir qualquer uma das tres
-- perguntas, um destes falha e diz qual.
--
-- O QUE CONTINUA RECUSADO, e por isso os dois ultimos existem: colaborador
-- nao decide nada (a policy), e a rodada de cliente continua sendo do
-- cliente.
-- ===========================================================================

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('dddddddd-0000-0000-0000-0000000000f0', :VERDE, 'Demanda do proprio Diego', :DIEGO,
        '2026-10-01', 'https://drive.google.com/drive/folders/auto');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao) values
  ('dddddddd-0000-0000-0000-0000000000f1', 'dddddddd-0000-0000-0000-0000000000f0',
   'Etapa sem dono', 1, null, true, 'interna'),
  ('dddddddd-0000-0000-0000-0000000000f2', 'dddddddd-0000-0000-0000-0000000000f0',
   'Etapa da Marina', 2, :MARINA, true, 'interna'),
  ('dddddddd-0000-0000-0000-0000000000f3', 'dddddddd-0000-0000-0000-0000000000f0',
   'Etapa que o Diego entregou', 3, :DIEGO, true, 'interna');

-- --- Caminho 1: etapa SEM responsavel ---------------------------------------
select teste.cenario('Diego abre a rodada de uma etapa sem responsavel', :DIEGO,
  format($fmt$insert into public.approval_rounds (id, content_id, numero_rodada, escopo, solicitado_por)
    values ('eeeeeeee-0000-0000-0000-0000000000f1', 'dddddddd-0000-0000-0000-0000000000f1',
            1, 'interna', %L)$fmt$, :DIEGO), 'ok', 1);

select teste.cenario('E decide a rodada da etapa sem dono', :DIEGO,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L, decidido_em = now()
     where id = 'eeeeeeee-0000-0000-0000-0000000000f1'$fmt$, :DIEGO), 'ok', 1);

-- --- Caminho 2: quem PEDIU decide -------------------------------------------
-- A etapa esta no nome da Marina, e a gestao pode abrir a rodada dela para
-- destravar. Abrir e decidir viraram dois cliques da mesma pessoa, e e o que
-- o usuario pediu.
select teste.cenario('Diego destrava a etapa da Marina abrindo a rodada', :DIEGO,
  format($fmt$insert into public.approval_rounds (id, content_id, numero_rodada, escopo, solicitado_por)
    values ('eeeeeeee-0000-0000-0000-0000000000f2', 'dddddddd-0000-0000-0000-0000000000f2',
            1, 'interna', %L)$fmt$, :DIEGO), 'ok', 1);

select teste.cenario('E decide a rodada que ele mesmo abriu', :DIEGO,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L, decidido_em = now()
     where id = 'eeeeeeee-0000-0000-0000-0000000000f2'$fmt$, :DIEGO), 'ok', 1);

-- --- Caminho 3: entregou, e a etapa e dele -----------------------------------
-- E o caso que o usuario relatou de dentro do produto: "nao estou conseguindo
-- aprovar minha propria task". A etapa esta no nome dele, a entrega e dele, a
-- rodada e dele -- os tres de uma vez.
select teste.cenario('Diego anexa a entrega da etapa dele', :DIEGO,
  format($fmt$insert into public.subtask_entregas (subtask_id, tipo, url, nome, enviado_por)
    values ('dddddddd-0000-0000-0000-0000000000f3', 'link', 'https://figma.com/arte', 'Arte v1', %L)$fmt$,
    :DIEGO), 'ok', 1);

select teste.cenario('E abre a rodada da propria etapa', :DIEGO,
  format($fmt$insert into public.approval_rounds (id, content_id, numero_rodada, escopo, solicitado_por)
    values ('eeeeeeee-0000-0000-0000-0000000000f3', 'dddddddd-0000-0000-0000-0000000000f3',
            1, 'interna', %L)$fmt$, :DIEGO), 'ok', 1);

select teste.cenario('E aprova a propria entrega: e a regra nova', :DIEGO,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L, decidido_em = now()
     where id = 'eeeeeeee-0000-0000-0000-0000000000f3'$fmt$, :DIEGO), 'ok', 1);

-- --- E o que NAO caiu junto --------------------------------------------------
-- Sem estes, "liberar tudo" passaria por correto. A regra mudou de "a gestao
-- menos quem fez" para "a gestao", e nao para "todo mundo".
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('dddddddd-0000-0000-0000-0000000000f4', 'dddddddd-0000-0000-0000-0000000000f0',
        'Etapa do Rafael', 4, :RAFAEL, true, 'interna');

select teste.cenario('Rafael abre a rodada da etapa dele', :RAFAEL,
  format($fmt$insert into public.approval_rounds (id, content_id, numero_rodada, escopo, solicitado_por)
    values ('eeeeeeee-0000-0000-0000-0000000000f4', 'dddddddd-0000-0000-0000-0000000000f4',
            1, 'interna', %L)$fmt$, :RAFAEL), 'ok', 1);

select teste.cenario('E NAO aprova: colaborador nao decide, nem a propria', :RAFAEL,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L, decidido_em = now()
     where id = 'eeeeeeee-0000-0000-0000-0000000000f4'$fmt$, :RAFAEL), 'recusa');

-- Pedir ajustes sem dizer o que ajustar continua recusado, e a frase continua
-- a mesma. A 0029 mexeu em QUEM decide, nao em COMO se decide.
select teste.recusa_com('E o gestor ainda nao pede ajustes sem comentario', :DIEGO,
  format($fmt$update public.approval_rounds set status = 'ajustes_solicitados', decidido_por = %L, decidido_em = now()
     where id = 'eeeeeeee-0000-0000-0000-0000000000f4'$fmt$, :DIEGO),
  'Pedir ajustes exige um comentário');

-- E a socia decide a rodada de outra pessoa, que e o caso de sempre. A 0029
-- acrescentou um caminho; nao tirou este.
select teste.cenario('E a socia decide a rodada do Rafael', :ANA,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L, decidido_em = now()
     where id = 'eeeeeeee-0000-0000-0000-0000000000f4'$fmt$, :ANA), 'ok', 1);

-- A trava saiu do banco INTEIRA, e nao virou um corpo que devolve `new`
-- calado. Um trigger com o nome antigo parado na tabela e a separacao que
-- alguem vai jurar que existe.
select teste.conferir('O trigger de autoaprovacao nao existe mais',
  (select count(*)::text from pg_trigger
    where tgname = 'approval_rounds_sem_autoaprovacao' and not tgisinternal),
  '0');

select teste.conferir('E a funcao dele tambem nao',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'bloquear_autoaprovacao'),
  '0');
