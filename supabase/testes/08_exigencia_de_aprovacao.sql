-- ===========================================================================
-- A aprovacao e de CADA ETAPA (migrations 0014, 0015 e 0023).
--
-- A pergunta que estes cenarios respondem: "marcar entregue" respeita o aval
-- que cada etapa pediu, mesmo para quem chamar a API direto?
--
-- ATE A 0023 A PERGUNTA ERA OUTRA, e mais fraca: a task tinha
-- `exigencia_aprovacao` e bastava UMA rodada aprovada daquele escopo em
-- QUALQUER subtarefa. Uma campanha com conceito, layout e midia passava com o
-- conceito aprovado e o resto nunca visto. A coluna saiu; a exigencia mora
-- onde o trabalho mora.
--
-- Cada cenario roda como uma PESSOA -- Ana e socia, Diego e desenvolvedor,
-- Carla e do Atendimento. Rodando como postgres tudo passaria, porque
-- superusuario ignora RLS e a trava nao seria provada contra ninguem.
-- ===========================================================================

\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

select teste.limpar();

-- ---------------------------------------------------------------------------
-- Demanda sem etapa que peca aval nao trava nada
--
-- Sem este cenario, uma trava boa demais passaria por correta: recusar TUDO
-- tambem faz "recusou quando devia" virar verdade.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('dddddddd-0000-0000-0000-00000000000a', :VERDE, 'Sem exigencia', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('cccccccc-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000a',
        'Subida de midia', 1, :MARINA, false, null);

select teste.cenario('Nenhuma etapa pede aval: socia marca entregue', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000a'$$, 'ok', 1);

-- A coluna da task saiu de vez. Um `update` nela nao pode voltar a existir por
-- descuido numa migration futura -- seria a regra fraca de volta, calada.
select teste.recusa_com('A exigencia da task nao existe mais', :ANA,
  $$update public.tasks set exigencia_aprovacao = 'cliente'
     where id = 'dddddddd-0000-0000-0000-00000000000a'$$,
  'exigencia_aprovacao');

-- ---------------------------------------------------------------------------
-- Uma etapa que pede aval interno
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('dddddddd-0000-0000-0000-00000000000b', :VERDE, 'Exige interna', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('cccccccc-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000b',
        'Arte do post', 1, :MARINA, true, 'interna');

select teste.recusa_com('Etapa sem rodada aprovada: recusa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000b'$$,
  'ainda não tem aprovação');

-- E a recusa NOMEIA a etapa. "Esta demanda tem etapa sem aprovacao" manda
-- abrir uma por uma; dizer qual e a diferenca entre recusa e instrucao.
select teste.recusa_com('E a recusa nomeia a etapa que falta', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000b'$$,
  '"Arte do post"');

-- A rodada existe mas esta pendente: continua recusando. Pedir aprovacao nao e
-- ter aprovacao, e esta e a confusao que a trava existe para impedir.
insert into public.approval_rounds (id, subtask_id, numero_rodada, escopo, solicitado_por)
values ('bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000b', 1, 'interna', :MARINA);

select teste.recusa_com('Rodada interna PENDENTE nao serve: recusa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000b'$$,
  'ainda não tem aprovação');

update public.approval_rounds
   set status = 'aprovada', decidido_por = '22222222-2222-2222-2222-222222222222', decidido_em = now()
 where id = 'bbbbbbbb-0000-0000-0000-00000000000b';

select teste.cenario('Rodada interna aprovada: entregue passa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000b'$$, 'ok', 1);

-- ---------------------------------------------------------------------------
-- O BURACO QUE A 0023 FECHOU
--
-- Duas etapas pedem aval interno e SO UMA foi aprovada. Pela regra antiga a
-- demanda passava: existia uma rodada interna aprovada nela. E a peca da outra
-- etapa saia como "entregue" sem ninguem ter olhado.
--
-- Este e o cenario que separa as duas regras. Sem ele, a trava nova parece
-- igual a velha.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('dddddddd-0000-0000-0000-000000000010', :VERDE, 'Duas etapas, um aval', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao) values
  ('cccccccc-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-000000000010', 'Conceito', 1, :MARINA, true, 'interna'),
  ('cccccccc-0000-0000-0000-000000000011', 'dddddddd-0000-0000-0000-000000000010', 'Layout',   2, :MARINA, true, 'interna');

insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por, status, decidido_por, decidido_em)
values ('cccccccc-0000-0000-0000-000000000010', 1, 'interna', :MARINA, 'aprovada', :DIEGO, now());

select teste.recusa_com('Uma etapa aprovada nao responde pela outra', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-000000000010'$$,
  '"Layout"');

-- E nomeia SO a que falta: listar a que ja foi aprovada mandaria a pessoa
-- procurar um problema que nao existe.
select teste.recusa_com('E nao acusa a etapa que ja tem aval', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-000000000010'$$,
  'Uma etapa desta demanda');

insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por, status, decidido_por, decidido_em)
values ('cccccccc-0000-0000-0000-000000000011', 1, 'interna', :MARINA, 'aprovada', :DIEGO, now());

select teste.cenario('Com as duas aprovadas, entregue passa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-000000000010'$$, 'ok', 1);

-- Com TRES faltando, a mensagem conta e lista as tres. O plural nao e enfeite:
-- "uma etapa" quando sao tres manda a pessoa resolver uma e bater de novo.
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('dddddddd-0000-0000-0000-000000000012', :VERDE, 'Tres faltando', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao) values
  ('dddddddd-0000-0000-0000-000000000012', 'Roteiro', 1, :MARINA, true, 'interna'),
  ('dddddddd-0000-0000-0000-000000000012', 'Captacao', 2, :MARINA, true, 'interna'),
  ('dddddddd-0000-0000-0000-000000000012', 'Edicao',  3, :MARINA, true, 'interna');

select teste.recusa_com('Tres faltando: a mensagem conta quantas', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-000000000012'$$,
  '3 etapas desta demanda');

select teste.recusa_com('E lista as tres, na ordem da demanda', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-000000000012'$$,
  '"Roteiro", "Captacao", "Edicao"');

-- ---------------------------------------------------------------------------
-- O tipo de aval e da etapa, e a interna nao vale pela do cliente
--
-- Toda aprovacao abre primeiro uma rodada interna (0007). A interna aprovada
-- NAO satisfaz quem pediu aval do cliente: sem este cenario, uma trava que so
-- olhasse "existe rodada aprovada?" passaria, e peca iria por entregue com o
-- cliente sem ter visto.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('dddddddd-0000-0000-0000-00000000000c', :VERDE, 'Exige cliente', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('cccccccc-0000-0000-0000-00000000000c', 'dddddddd-0000-0000-0000-00000000000c',
        'KV da campanha', 1, :MARINA, true, 'cliente');

insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por, status, decidido_por, decidido_em)
values ('cccccccc-0000-0000-0000-00000000000c', 1, 'interna', :MARINA, 'aprovada', :DIEGO, now());

select teste.recusa_com('Etapa de cliente com so a interna aprovada: recusa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000c'$$,
  '"KV da campanha"');

-- A rodada do cliente so a gestao abre, e nao o responsavel pela subtarefa
-- (validar_nova_rodada, migration 0007). Por isso ela entra como o Diego, que
-- e desenvolvedor -- inserir isso como postgres passaria por cima da regra e o
-- fixture estaria provando a trava contra um estado que o produto nao produz.
select teste.cenario('So a gestao abre a rodada do cliente', :DIEGO,
  $$insert into public.approval_rounds
      (subtask_id, numero_rodada, escopo, solicitado_por, status, decidido_por, decidido_em)
    values ('cccccccc-0000-0000-0000-00000000000c', 1, 'cliente',
            '22222222-2222-2222-2222-222222222222', 'aprovada',
            '77777777-7777-7777-7777-777777777777', now())$$, 'ok', 1);

select teste.cenario('Rodada do cliente aprovada: entregue passa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000c'$$, 'ok', 1);

-- ---------------------------------------------------------------------------
-- Exigir aval sem dizer qual nao exige nada
--
-- `subtask_tem_aval()` devolve true quando o tipo e nulo: nao ha escopo para
-- procurar. Uma etapa assim diria "exijo aprovacao" e passaria por todas as
-- travas. Quem fecha a porta e o check `subtasks_tipo_aprovacao_coerente`, da
-- 0007 -- a 0023 nao criou trava nova, so passou a depender desta.
-- ---------------------------------------------------------------------------

select teste.recusa_com('Etapa que exige aval sem dizer o tipo: recusa', :CARLA,
  $$insert into public.subtasks (task_id, titulo, ordem, responsavel_id, requer_aprovacao)
    values ('dddddddd-0000-0000-0000-00000000000a', 'Aval de nada', 9,
            '55555555-5555-5555-5555-555555555555', true)$$,
  'subtasks_tipo_aprovacao_coerente');

select teste.cenario('Com o tipo preenchido, entra', :CARLA,
  $$insert into public.subtasks (task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
    values ('dddddddd-0000-0000-0000-00000000000a', 'Aval de verdade', 9,
            '55555555-5555-5555-5555-555555555555', true, 'interna')$$, 'ok', 1);

-- E a etapa nova, sem aval, derrubou o `entregue` que a demanda 'a' tinha?
-- Nao: o recalculo nao escreve `entregue`, e quem reassume do manual sao
-- ajuste, rodada pendente e conclusao. Mas o PROXIMO entregue ja nao passa.
-- Tira o `entregue` de la para que a proxima marcacao seja mesmo uma
-- TRANSICAO -- a trava so olha quando o status muda.
update public.tasks set status = 'aguardando_informacoes', status_manual = true
 where id = 'dddddddd-0000-0000-0000-00000000000a';

select teste.recusa_com('A etapa nova passa a segurar o proximo entregue', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000a'$$,
  '"Aval de verdade"');

-- ---------------------------------------------------------------------------
-- O que a trava NAO alcanca
--
-- Ela olha uma transicao para `entregue`, e so. Corrigir o titulo de uma ja
-- entregue, marcar que a demanda esta esperando informacao e o recalculo
-- automatico do status seguem funcionando -- do contrario a trava teria
-- virado um freio em tudo.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('dddddddd-0000-0000-0000-00000000000d', :VERDE, 'Etapa sem aval', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('cccccccc-0000-0000-0000-00000000000d', 'dddddddd-0000-0000-0000-00000000000d',
        'Arte pendente', 1, :MARINA, true, 'interna');

select teste.cenario('Aguardando informacoes nao passa pela trava', :ANA,
  $$update public.tasks set status = 'aguardando_informacoes', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000d'$$, 'ok', 1);

select teste.cenario('Editar o titulo de uma task ja entregue continua valendo', :ANA,
  $$update public.tasks set titulo = 'Exige cliente (revisado)'
     where id = 'dddddddd-0000-0000-0000-00000000000c'$$, 'ok', 1);

-- O `entregue` marcado a mao resiste: so rodada pendente, ajuste ou conclusao
-- reassumem. Uma subtarefa nova em andamento NAO e nenhum dos tres.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, status)
values ('cccccccc-0000-0000-0000-00000000000e', 'dddddddd-0000-0000-0000-00000000000b',
        'Ajuste pedido depois', 2, :MARINA, 'em_andamento');

select teste.conferir('Subtarefa em andamento nao desfaz o entregue marcado a mao',
  (select status::text from public.tasks where id = 'dddddddd-0000-0000-0000-00000000000b'),
  'entregue');

-- Uma rodada PENDENTE tambem nao desfaz, desde a 0025: os sete status se
-- marcam a mao, e marcar a mao dura ate a pessoa devolver o volante. Antes
-- ajuste, rodada pendente e conclusao reassumiam.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('cccccccc-0000-0000-0000-00000000000f', 'dddddddd-0000-0000-0000-00000000000b',
        'Segunda arte', 3, :MARINA, true, 'interna');

insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por)
values ('cccccccc-0000-0000-0000-00000000000f', 1, 'interna', :MARINA);

select teste.conferir('Nem a rodada pendente desfaz o entregue marcado a mao',
  (select status::text from public.tasks where id = 'dddddddd-0000-0000-0000-00000000000b'),
  'entregue');

-- Devolvendo o volante, o calculo reassume e acha a rodada pendente.
update public.tasks set status_manual = false
 where id = 'dddddddd-0000-0000-0000-00000000000b';

select teste.conferir('Devolvido o volante, o calculo acha a rodada pendente',
  (select status::text from public.tasks where id = 'dddddddd-0000-0000-0000-00000000000b'),
  'em_aprovacao');

-- ---------------------------------------------------------------------------
-- Quem pode mexer nisso
--
-- A exigencia agora e da etapa, e mexer nela e mexer na subtarefa: gestao e
-- Atendimento, ou o proprio responsavel. Quem nao alcanca a subtarefa nao
-- afrouxa o aval dela pelas costas.
-- ---------------------------------------------------------------------------

select teste.cenario('Atendimento marca o aval de uma etapa', :CARLA,
  $$update public.subtasks set requer_aprovacao = true, tipo_aprovacao = 'interna'
     where id = 'cccccccc-0000-0000-0000-00000000000a'$$, 'ok', 1);

select teste.cenario('Quem nao e da etapa nem da gestao nao tira o aval dela', :DIEGO,
  $$update public.subtasks set requer_aprovacao = false, tipo_aprovacao = null
     where id = 'cccccccc-0000-0000-0000-00000000000d'$$, 'ok', 1);

-- ---------------------------------------------------------------------------
-- O link de entrega
--
-- Endereco tem que ser endereco: o campo e o que alguem vai clicar semanas
-- depois procurando o material final.
-- ---------------------------------------------------------------------------

select teste.cenario('Link de entrega https e aceito', :CARLA,
  $$update public.tasks set link_entrega = 'https://drive.google.com/drive/folders/abc'
     where id = 'dddddddd-0000-0000-0000-00000000000a'$$, 'ok', 1);

select teste.recusa_com('Link de entrega que nao e endereco: recusa', :CARLA,
  $$update public.tasks set link_entrega = 'ver com a Ana'
     where id = 'dddddddd-0000-0000-0000-00000000000a'$$,
  'tasks_link_entrega_http');

-- Ate a 0014 dava para deixar a task sem link. A 0015 fechou essa porta, e a
-- prova de que ela fechou esta na secao da pasta obrigatoria, mais abaixo.

-- ---------------------------------------------------------------------------
-- A pasta de entrega e obrigatoria (migration 0015)
--
-- Toda demanda nova diz onde o material final vai ficar. Sem a trava, o campo
-- vira aquele que ninguem preenche: quem abre esta com pressa, quem procura o
-- material esta semanas depois, e raramente sao a mesma pessoa.
-- ---------------------------------------------------------------------------

select teste.recusa_com('Demanda nova sem pasta de entrega: recusa', :CARLA,
  $$insert into public.tasks (client_id, titulo, criado_por, data_inicio)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Sem pasta',
            '33333333-3333-3333-3333-333333333333', current_date)$$,
  'precisa da pasta de entrega');

select teste.recusa_com('Pasta de entrega em branco tambem e recusada', :CARLA,
  $$insert into public.tasks (client_id, titulo, criado_por, data_inicio, link_entrega)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Pasta vazia',
            '33333333-3333-3333-3333-333333333333', current_date, '   ')$$,
  'precisa da pasta de entrega');

select teste.cenario('Demanda nova COM pasta de entrega entra', :CARLA,
  $$insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
    values ('dddddddd-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-000000000001',
            'Com pasta', '33333333-3333-3333-3333-333333333333', current_date,
            'https://figma.com/arquivo/xyz')$$, 'ok', 1);

-- A pasta de quem ja tem nao se apaga: apagar deixa o material sem paradeiro,
-- e e uma perda que so aparece quando alguem vai procurar.
select teste.recusa_com('A pasta de entrega nao se apaga', :CARLA,
  $$update public.tasks set link_entrega = null
     where id = 'dddddddd-0000-0000-0000-00000000000e'$$,
  'não se apaga');

select teste.recusa_com('Nem esvaziando com espacos', :CARLA,
  $$update public.tasks set link_entrega = '  '
     where id = 'dddddddd-0000-0000-0000-00000000000e'$$,
  'não se apaga');

-- Trocar continua valendo: pasta muda de lugar.
select teste.cenario('Trocar a pasta por outra vale', :CARLA,
  $$update public.tasks set link_entrega = 'https://drive.google.com/drive/folders/nova'
     where id = 'dddddddd-0000-0000-0000-00000000000e'$$, 'ok', 1);

-- E continua tendo que ser um endereco: as duas travas convivem.
select teste.recusa_com('A pasta trocada continua tendo que ser endereco', :CARLA,
  $$update public.tasks set link_entrega = 'pergunta pro Bruno'
     where id = 'dddddddd-0000-0000-0000-00000000000e'$$,
  'tasks_link_entrega_http');
