-- ===========================================================================
-- A exigencia de aprovacao da Task (migration 0014).
--
-- A pergunta que estes cenarios respondem: "marcar entregue" respeita o que a
-- demanda exige, mesmo para quem chamar a API direto?
--
-- Cada um roda como uma PESSOA -- Ana e socia, Diego e desenvolvedor, Carla e
-- do Atendimento. Rodando como postgres tudo passaria, porque superusuario
-- ignora RLS e a trava nao seria provada contra ninguem.
-- ===========================================================================

\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

select teste.limpar();

-- ---------------------------------------------------------------------------
-- O padrao nao trava nada
--
-- Demanda que nao exige aprovacao nenhuma continua encerrando como sempre. Sem
-- este cenario, uma trava boa demais passaria por correta: recusar TUDO
-- tambem faz "recusou quando devia" virar verdade.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('dddddddd-0000-0000-0000-00000000000a', :VERDE, 'Sem exigencia', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

select teste.conferir('Exigencia nasce em "nenhuma"',
  (select exigencia_aprovacao::text from public.tasks where id = 'dddddddd-0000-0000-0000-00000000000a'),
  'nenhuma');

select teste.cenario('Sem exigencia: socia marca entregue', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000a'$$, 'ok', 1);

-- ---------------------------------------------------------------------------
-- Exigencia interna
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, exigencia_aprovacao, link_entrega)
values ('dddddddd-0000-0000-0000-00000000000b', :VERDE, 'Exige interna', :CARLA, '2026-10-01', 'interna', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('cccccccc-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000b',
        'Arte do post', 1, :MARINA, true, 'interna');

select teste.recusa_com('Exige interna, sem rodada aprovada: recusa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000b'$$,
  'ainda não há nenhuma rodada aprovada');

-- A rodada existe mas esta pendente: continua recusando. Pedir aprovacao nao e
-- ter aprovacao, e esta e a confusao que a trava existe para impedir.
insert into public.approval_rounds (id, subtask_id, numero_rodada, escopo, solicitado_por)
values ('bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000b', 1, 'interna', :MARINA);

select teste.recusa_com('Rodada interna PENDENTE nao serve: recusa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000b'$$,
  'ainda não há nenhuma rodada aprovada');

update public.approval_rounds
   set status = 'aprovada', decidido_por = '22222222-2222-2222-2222-222222222222', decidido_em = now()
 where id = 'bbbbbbbb-0000-0000-0000-00000000000b';

select teste.cenario('Rodada interna aprovada: entregue passa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000b'$$, 'ok', 1);

-- ---------------------------------------------------------------------------
-- Exigencia do cliente
--
-- A interna aprovada NAO satisfaz a exigencia do cliente. E o cenario que
-- separa as duas: sem ele, uma trava que so olhasse "existe rodada aprovada?"
-- passaria, e peca iria por entregue com o cliente sem ter visto.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, exigencia_aprovacao, link_entrega)
values ('dddddddd-0000-0000-0000-00000000000c', :VERDE, 'Exige cliente', :CARLA, '2026-10-01', 'cliente', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('cccccccc-0000-0000-0000-00000000000c', 'dddddddd-0000-0000-0000-00000000000c',
        'KV da campanha', 1, :MARINA, true, 'cliente');

insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por, status, decidido_por, decidido_em)
values ('cccccccc-0000-0000-0000-00000000000c', 1, 'interna', :MARINA, 'aprovada', :DIEGO, now());

select teste.recusa_com('Exige cliente, so a interna aprovada: recusa', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000c'$$,
  'aprovação do cliente para ser entregue');

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
-- O beco sem saida, e a mensagem que aponta a saida
--
-- Exigir aprovacao do cliente numa demanda onde NENHUMA subtarefa pede
-- aprovacao do cliente trava o encerramento para sempre. A recusa e certa, mas
-- "nao pode" mandaria a pessoa adivinhar: o caminho nao e aprovar mais rapido,
-- e marcar a etapa que precisa de aval. A mensagem tem que dizer isso, e e
-- isso que este cenario verifica.
-- ---------------------------------------------------------------------------

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, exigencia_aprovacao, link_entrega)
values ('dddddddd-0000-0000-0000-00000000000d', :VERDE, 'Exige sem quem cumpra', :CARLA, '2026-10-01', 'cliente', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('cccccccc-0000-0000-0000-00000000000d', 'dddddddd-0000-0000-0000-00000000000d',
        'Subida de midia', 1, :MARINA, false, null);

select teste.recusa_com('Exigencia sem subtarefa que a cumpra: a mensagem aponta a saida', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000d'$$,
  'nenhuma subtarefa dela pede essa aprovação');

-- ---------------------------------------------------------------------------
-- O que a trava NAO alcanca
--
-- Ela olha uma transicao para `entregue`, e so. Cancelar uma demanda,
-- corrigir o titulo de uma ja entregue e o recalculo automatico do status
-- seguem funcionando -- do contrario a trava teria virado um freio em tudo.
-- ---------------------------------------------------------------------------

select teste.cenario('Cancelar nao passa pela exigencia', :ANA,
  $$update public.tasks set status = 'cancelada', status_manual = true
     where id = 'dddddddd-0000-0000-0000-00000000000d'$$, 'ok', 1);

select teste.cenario('Editar o titulo de uma task ja entregue continua valendo', :ANA,
  $$update public.tasks set titulo = 'Exige cliente (revisado)'
     where id = 'dddddddd-0000-0000-0000-00000000000c'$$, 'ok', 1);

-- O recalculo escreve status sem passar pela exigencia -- e nao ha conflito,
-- porque ele NAO escreve `entregue` (so `entregue` e `cancelada` sao manuais).
--
-- E o `entregue` marcado a mao resiste: so rodada pendente, ajuste ou
-- conclusao reassumem. Uma subtarefa nova em andamento NAO e nenhum dos tres.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, status)
values ('cccccccc-0000-0000-0000-00000000000e', 'dddddddd-0000-0000-0000-00000000000b',
        'Ajuste pedido depois', 2, :MARINA, 'em_andamento');

select teste.conferir('Subtarefa em andamento nao desfaz o entregue marcado a mao',
  (select status::text from public.tasks where id = 'dddddddd-0000-0000-0000-00000000000b'),
  'entregue');

-- Uma rodada PENDENTE, sim: e um dos tres, e reassume zerando status_manual.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('cccccccc-0000-0000-0000-00000000000f', 'dddddddd-0000-0000-0000-00000000000b',
        'Segunda arte', 3, :MARINA, true, 'interna');

insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por)
values ('cccccccc-0000-0000-0000-00000000000f', 1, 'interna', :MARINA);

select teste.conferir('Rodada pendente reassume, mesmo depois de entregue',
  (select status::text from public.tasks where id = 'dddddddd-0000-0000-0000-00000000000b'),
  'em_aprovacao');

select teste.conferir('E zera o status_manual',
  (select status_manual::text from public.tasks where id = 'dddddddd-0000-0000-0000-00000000000b'),
  'false');

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
-- Quem pode mexer nisso
--
-- A exigencia e do Atendimento e da gestao, como a propria task. Quem nao
-- edita a task nao muda a regra de aprovacao dela pelas costas.
-- ---------------------------------------------------------------------------

select teste.cenario('Atendimento define a exigencia da propria demanda', :CARLA,
  $$update public.tasks set exigencia_aprovacao = 'interna'
     where id = 'dddddddd-0000-0000-0000-00000000000a'$$, 'ok', 1);

select teste.cenario('Quem nao edita a task nao afrouxa a exigencia dela', :MARINA,
  $$update public.tasks set exigencia_aprovacao = 'nenhuma'
     where id = 'dddddddd-0000-0000-0000-00000000000c'$$, 'recusa');

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
