\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

-- ===========================================================================
-- Sprint 6 -- Full Days
--
-- Ana e socia (a unica que decide), Diego desenvolvedor, Carla e Bruno
-- colaboradores, Joana e cliente.
--
-- A pergunta: as regras de ferias -- 15 dias por ano em ate duas parcelas --
-- valem quando alguem chama o Supabase direto, sem passar pela tela?
-- ===========================================================================

delete from public.team_presence;
delete from public.hr_requests;
delete from public.notifications;


-- --- Dia util --------------------------------------------------------------

select teste.conferir('Abril de 2026 tem 20 dias uteis',
  public.dias_uteis('2026-04-01', '2026-04-30')::text, '20');

select teste.conferir('A semana do carnaval de 2026 tem 3 dias uteis',
  public.dias_uteis('2026-02-16', '2026-02-20')::text, '3');

select teste.conferir('Sexta-feira Santa nao e dia util',
  public.dias_uteis('2026-04-03', '2026-04-03')::text, '0');

select teste.conferir('Fim de semana sozinho da zero',
  public.dias_uteis('2026-04-04', '2026-04-05')::text, '0');


-- --- Quem cria pedido ------------------------------------------------------

select teste.cenario('Bruno pede 5 dias de ferias', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, motivo)
    values (%L, 'ferias', '2026-03-02', '2026-03-06', 5, 'Descanso')
  $fmt$, :BRUNO), 'ok', 1);

select teste.cenario('Ninguem pede ferias no nome de outra pessoa', :CARLA,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, motivo)
    values (%L, 'ferias', '2026-05-04', '2026-05-08', 5, 'Ferias que a Carla inventou')
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Cliente nao tem Full Days', :JOANA,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', '2026-03-02', '2026-03-06', 5)
  $fmt$, :JOANA), 'recusa');

select teste.cenario('Periodo sem nenhum dia util e recusado', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ausencia', '2026-04-04', '2026-04-05', 0)
  $fmt$, :BRUNO), 'recusa');


-- --- As 15 e as duas parcelas ----------------------------------------------

select teste.cenario('Sobreposicao com pedido proprio e recusada', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'licenca', '2026-03-04', '2026-03-10', 5)
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('A segunda parcela cabe: 5 + 10 = 15', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', '2026-07-06', '2026-07-17', 10)
  $fmt$, :BRUNO), 'ok', 1);

select teste.cenario('A terceira parcela e recusada, mesmo com saldo zerado', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', '2026-09-07', '2026-09-08', 1)
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Carla pede 16 dias de uma vez e o banco recusa', :CARLA,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', '2026-06-01', '2026-06-22', 16)
  $fmt$, :CARLA), 'recusa');

select teste.cenario('Ferias atravessando o ano sao recusadas', :CARLA,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', '2026-12-28', '2027-01-05', 5)
  $fmt$, :CARLA), 'recusa');

-- Licenca e ausencia NAO descontam do saldo: entram na matriz e no relatorio,
-- e nada mais. Carla ja tem o saldo inteiro livre, e pede licenca a vontade.
select teste.cenario('Licenca nao desconta do saldo de ferias', :CARLA,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'licenca', '2026-08-03', '2026-08-28', 20)
  $fmt$, :CARLA), 'ok', 1);

select teste.conferir('O saldo da Carla continua 15',
  public.saldo_de_ferias('33333333-3333-3333-3333-333333333333', 2026)::text, '15');

select teste.conferir('O do Bruno zerou',
  public.saldo_de_ferias('44444444-4444-4444-4444-444444444444', 2026)::text, '0');

select teste.conferir('E ele ja usou as duas parcelas',
  public.parcelas_de_ferias('44444444-4444-4444-4444-444444444444', 2026)::text, '2');


-- --- Quem le ---------------------------------------------------------------

select teste.cenario('Bruno le os proprios pedidos', :BRUNO,
  format('select 1 from public.hr_requests where user_id = %L', :BRUNO), 'ok', 2);

select teste.cenario('Carla NAO le o pedido do Bruno', :CARLA,
  format('select 1 from public.hr_requests where user_id = %L', :BRUNO), 'ok', 0);

select teste.cenario('A gestao le todos', :DIEGO,
  'select 1 from public.hr_requests', 'ok', 3);


-- --- Quem decide -----------------------------------------------------------

select teste.cenario('O colaborador nao aprova o proprio pedido com um update', :BRUNO,
  format($fmt$
    update public.hr_requests set status = 'aprovada'
     where user_id = %L and tipo = 'ferias' and data_inicio = '2026-03-02'
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Nem chamando a funcao de decisao', :BRUNO,
  format($fmt$
    select public.decidir_solicitacao(
      (select id from public.hr_requests where user_id = %L and data_inicio = '2026-03-02'),
      'aprovada', null)
  $fmt$, :BRUNO), 'recusa');

-- O sprint e explicito: SO o socio decide. O desenvolvedor e gestao para todo
-- o resto do sistema, e aqui nao.
select teste.cenario('O DESENVOLVEDOR tambem nao decide Full Days', :DIEGO,
  format($fmt$
    select public.decidir_solicitacao(
      (select id from public.hr_requests where user_id = %L and data_inicio = '2026-03-02'),
      'aprovada', null)
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('A socia aprova', :ANA,
  format($fmt$
    select public.decidir_solicitacao(
      (select id from public.hr_requests where user_id = %L and data_inicio = '2026-03-02'),
      'aprovada', null)
  $fmt$, :BRUNO), 'ok');

select teste.conferir('O pedido ficou aprovado',
  (select status::text from public.hr_requests
    where user_id = '44444444-4444-4444-4444-444444444444' and data_inicio = '2026-03-02'),
  'aprovada');

-- 2 a 6 de marco de 2026 e uma semana cheia sem feriado: 5 dias uteis, 5
-- linhas. Sabado e domingo nao viram linha -- pintar fim de semana de "ferias"
-- faria a matriz discordar do numero de dias uteis pedido.
select teste.conferir('Aprovar pintou os 5 dias uteis na matriz',
  (select count(*)::text from public.team_presence
    where user_id = '44444444-4444-4444-4444-444444444444'
      and status = 'ferias'),
  '5');

select teste.conferir('E o solicitante foi avisado',
  (select count(*)::text from public.notifications
    where user_id = '44444444-4444-4444-4444-444444444444' and tipo = 'full_days'),
  '1');

select teste.cenario('A mesma solicitacao nao e decidida duas vezes', :ANA,
  format($fmt$
    select public.decidir_solicitacao(
      (select id from public.hr_requests where user_id = %L and data_inicio = '2026-03-02'),
      'reprovada', 'mudei de ideia')
  $fmt$, :BRUNO), 'recusa');


-- --- A matriz nao apaga ferias aprovadas -----------------------------------

select teste.cenario('A gestao NAO troca na mao um dia que veio de pedido aprovado', :DIEGO,
  format($fmt$
    update public.team_presence set status = 'presente'
     where user_id = %L and status = 'ferias'
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Mas marca um dia solto de quem quiser', :DIEGO,
  format($fmt$
    insert into public.team_presence (user_id, data, status, atualizado_por)
    values (%L, '2026-04-08', 'remoto', %L)
  $fmt$, :CARLA, :DIEGO), 'ok', 1);

select teste.cenario('A pessoa marca o PROPRIO dia de hoje', :CARLA,
  format($fmt$
    insert into public.team_presence (user_id, data, status)
    values (%L, current_date, 'remoto')
  $fmt$, :CARLA), 'ok', 1);

select teste.cenario('Mas nao reescreve a semana passada', :CARLA,
  format($fmt$
    insert into public.team_presence (user_id, data, status)
    values (%L, current_date - 7, 'remoto')
  $fmt$, :CARLA), 'recusa');

select teste.cenario('Nem marca o dia de outra pessoa', :CARLA,
  format($fmt$
    insert into public.team_presence (user_id, data, status)
    values (%L, current_date, 'ferias')
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('A equipe toda enxerga a matriz', :BRUNO,
  'select 1 from public.team_presence', 'ok', 7);

select teste.cenario('O cliente nao enxerga a matriz', :JOANA,
  'select 1 from public.team_presence', 'ok', 0);


-- --- Cancelar --------------------------------------------------------------

select teste.cenario('Bruno cancela o pedido que ainda espera decisao', :BRUNO,
  format($fmt$
    select public.cancelar_solicitacao(
      (select id from public.hr_requests where user_id = %L and data_inicio = '2026-07-06'))
  $fmt$, :BRUNO), 'ok');

select teste.cenario('Mas nao cancela o que ja foi aprovado', :BRUNO,
  format($fmt$
    select public.cancelar_solicitacao(
      (select id from public.hr_requests where user_id = %L and data_inicio = '2026-03-02'))
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Nem cancela o pedido de outra pessoa', :BRUNO,
  format($fmt$
    select public.cancelar_solicitacao(
      (select id from public.hr_requests where user_id = %L))
  $fmt$, :CARLA), 'recusa');

-- Cancelada devolve o saldo e a parcela: 15 contratados menos os 5 aprovados.
select teste.conferir('Cancelar devolveu o saldo',
  public.saldo_de_ferias('44444444-4444-4444-4444-444444444444', 2026)::text, '10');

select teste.conferir('E devolveu a parcela',
  public.parcelas_de_ferias('44444444-4444-4444-4444-444444444444', 2026)::text, '1');


-- --- O sino ----------------------------------------------------------------

select teste.cenario('Bruno le as proprias notificacoes', :BRUNO,
  'select 1 from public.notifications', 'ok', 1);

select teste.cenario('Carla nao le a notificacao do Bruno', :CARLA,
  'select 1 from public.notifications', 'ok', 0);

-- Nao existe policy de INSERT: o sino so e escrito pela funcao `notificar`,
-- que roda como dona da tabela. Um aviso forjavel e pior que nenhum aviso.
select teste.cenario('Ninguem forja uma notificacao, nem para si', :BRUNO,
  format($fmt$
    insert into public.notifications (user_id, tipo, titulo)
    values (%L, 'sistema', 'Aviso inventado')
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Nem a socia insere direto', :ANA,
  format($fmt$
    insert into public.notifications (user_id, tipo, titulo)
    values (%L, 'sistema', 'Aviso inventado')
  $fmt$, :CARLA), 'recusa');

select teste.cenario('Marcar como lida funciona', :BRUNO,
  'update public.notifications set lida_em = now() where lida_em is null', 'ok', 1);

select teste.cenario('Mas reescrever o titulo do proprio aviso e recusado', :BRUNO,
  format($fmt$
    update public.notifications set titulo = %L
  $fmt$, 'Outro texto'), 'recusa');
