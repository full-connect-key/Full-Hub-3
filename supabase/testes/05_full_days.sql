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

-- ERA RECUSADO ATE A 0039, e virou o contrario. A trava existia porque a
-- conta era por ano civil: 28/12 a 05/01 viravam duas contas de saldo para o
-- mesmo pedido, e a mensagem mandava combinar dois. Com o saldo corrido nao ha
-- duas contas -- sao cinco dias, e o ano em que caem nao muda nada.
--
-- O cenario fica virado do avesso em vez de sumir: se alguem trouxer a trava
-- de volta junto com o modelo de ano, este e o que avisa.
select teste.cenario('Descanso atravessando o ano PASSA desde o ciclo de 12 meses', :CARLA,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', '2026-12-28', '2027-01-05', 5)
  $fmt$, :CARLA), 'ok', 1);

-- Licenca e ausencia NAO descontam do saldo: entram na matriz e no relatorio,
-- e nada mais. A Carla tem 5 dias de descanso comprometidos (o periodo da
-- virada, acima) e pede 20 dias de afastamento -- se afastamento descontasse,
-- os 20 estourariam o contrato dela na hora.
select teste.cenario('Licenca nao desconta do saldo de ferias', :CARLA,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'licenca', '2026-08-03', '2026-08-28', 20)
  $fmt$, :CARLA), 'ok', 1);

select teste.conferir('O saldo da Carla segue nos 10 do descanso dela',
  public.saldo_de_ferias('33333333-3333-3333-3333-333333333333')::text, '10');

select teste.conferir('O do Bruno zerou',
  public.saldo_de_ferias('44444444-4444-4444-4444-444444444444')::text, '0');

select teste.conferir('E ele ja usou as duas parcelas',
  public.parcelas_de_ferias('44444444-4444-4444-4444-444444444444')::text, '2');


-- --- Quem le ---------------------------------------------------------------

select teste.cenario('Bruno le os proprios pedidos', :BRUNO,
  format('select 1 from public.hr_requests where user_id = %L', :BRUNO), 'ok', 2);

select teste.cenario('Carla NAO le o pedido do Bruno', :CARLA,
  format('select 1 from public.hr_requests where user_id = %L', :BRUNO), 'ok', 0);

select teste.cenario('A gestao le todos', :DIEGO,
  'select 1 from public.hr_requests', 'ok', 4);


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

-- 2 a 6 de marco de 2026 e uma semana cheia de segunda a sexta: 5 dias
-- corridos e 5 uteis, entao 5 linhas pelas duas contas. O caso que separa as
-- duas -- um descanso atravessando o fim de semana -- esta na secao dos dias
-- corridos, no fim deste arquivo.
select teste.conferir('Aprovar pintou os 5 dias na matriz',
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
  public.saldo_de_ferias('44444444-4444-4444-4444-444444444444')::text, '10');

select teste.conferir('E devolveu a parcela',
  public.parcelas_de_ferias('44444444-4444-4444-4444-444444444444')::text, '1');


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

-- ===========================================================================
-- O VOCABULARIO (migration 0016)
--
-- A equipe e toda PJ. Palavra de direito trabalhista numa mensagem do proprio
-- sistema e prova documental num pedido de reconhecimento de vinculo -- o
-- sistema da contratante concedendo ferias e registrando folga e exatamente o
-- que se junta aos autos.
--
-- Estes cenarios existem porque a tela NAO alcanca estas frases: elas nascem
-- no Postgres e chegam prontas. Trocar `ROTULOS_DE_TIPO` no TypeScript nao
-- mexe em nenhuma delas, e e assim que o vocabulario velho voltaria sem
-- ninguem notar.
-- ===========================================================================

delete from public.team_presence;
delete from public.hr_requests;
delete from public.notifications;

-- Bruno tem 15 dias. Pedir 20 estoura o contrato, e a recusa precisa falar de
-- DESCANSO EM CONTRATO, nao de ferias por ano.
select teste.recusa_com('A recusa por saldo fala de descanso, nao de ferias', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', '2027-03-01', '2027-03-28', 20)
  $fmt$, :BRUNO),
  'dias de descanso a cada 12 meses em contrato');

-- E A FRASE DIZ A CONTA INTEIRA: quantos o contrato da, quantos ja estao
-- comprometidos, quantos sobram. Quem leva um "nao" com um numero so vai
-- conferir por fora e concluir que o sistema errou.
select teste.recusa_com('E ela diz quantos sobram', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', '2027-03-01', '2027-03-28', 20)
  $fmt$, :BRUNO),
  'entao sobram 15');

-- Quem responde continua sendo so o socio -- o que mudou foi como a recusa
-- diz isso. "Aprovar e reprovar" saiu porque hierarquia de aprovacao e um dos
-- indicios de subordinacao.
insert into public.hr_requests (id, user_id, tipo, data_inicio, data_fim, dias_uteis)
values ('dadadada-0000-0000-0000-00000000000a', :BRUNO, 'ferias', '2027-05-03', '2027-05-07', 5);

select teste.recusa_com('Nem o desenvolvedor responde, e a recusa nao diz "aprovar"', :DIEGO,
  $$select public.decidir_solicitacao('dadadada-0000-0000-0000-00000000000a', 'aprovada', null)$$,
  'So o socio responde aos periodos fora');

-- E o aviso do sino. Ja mudou duas vezes: "Ferias aprovada" virou "Recesso
-- combinado" na 0016, e "Descanso combinado" na 0018.
select teste.cenario('A socia responde, de acordo', :ANA,
  $$select public.decidir_solicitacao('dadadada-0000-0000-0000-00000000000a', 'aprovada', null)$$,
  'ok');

select teste.conferir('O sino diz "Descanso combinado", nunca "Ferias aprovada"',
  (select titulo from public.notifications
    where user_id = '44444444-4444-4444-4444-444444444444'
      and tipo = 'full_days'
    order by created_at desc limit 1),
  'Descanso combinado');

-- E a matriz recusa editar o dia sem falar de solicitacao aprovada.
select teste.recusa_com('A matriz fala de periodo combinado', :ANA,
  $$update public.team_presence set status = 'presente'
     where user_id = '44444444-4444-4444-4444-444444444444'
       and hr_request_id = 'dadadada-0000-0000-0000-00000000000a'
       and data = '2027-05-03'$$,
  'periodo ja combinado');

-- A VARREDURA: nenhuma das frases antigas pode sobreviver no corpo das
-- funcoes. E o mesmo espirito do `check:cores`, que varre `src/` atras de nome
-- que saiu do produto -- aqui a varredura e no corpo das funcoes, que e onde a
-- tela nao alcanca.
--
-- Por FRASE e nao por palavra, de proposito: `dias_ferias_ano` e nome de
-- coluna e continua como esta por decisao do usuario, enquanto "dias de ferias
-- por ano" era a frase que a pessoa lia. Uma varredura por palavra confundiria
-- as duas -- e confundiu, na primeira versao deste cenario.
do $$
declare
  frase   text;
  achados text[] := '{}';
  antigas text[] := array[
    'dias de ferias por ano',
    'As ferias podem ser partidas',
    'Ferias que atravessam',
    'Aprovar e reprovar',
    'A decisao e aprovar',
    'solicitacao aprovada',
    'Esta solicitacao ja foi decidida',
    'Solicitacao nao encontrada',
    'then ''Ferias''',
    'then ''Licenca''',
    '%s aprovada',
    '%s reprovada',
    -- Segunda rodada (0018). O vocabulario da 0016 tambem saiu, e a lista
    -- cresce em vez de ser substituida: nenhuma geracao de palavra pode
    -- voltar, nao so a ultima.
    'dias de recesso por ano',
    'O recesso pode ser partido',
    'Um recesso que atravessa',
    -- Terceira rodada (0039). O saldo deixou de ser por ano civil, e as duas
    -- frases que diziam "por ano" sairam junto com ele -- mais a trava do
    -- periodo entre anos, que so existia por causa da conta anual. A lista
    -- CRESCE: nenhuma geracao pode voltar, nao so a ultima.
    'dias de descanso por ano em contrato',
    'partido em ate %s vezes por ano',
    'Um descanso que atravessa o ano',
    'then ''Recesso''',
    'then ''Indisponibilidade''',
    'recesso programado, indisponibilidade'
  ];
begin
  foreach frase in array antigas loop
    if exists (
      select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('validar_solicitacao', 'decidir_solicitacao',
                           'proteger_presenca_de_pedido')
         and position(frase in p.prosrc) > 0
    ) then
      achados := achados || frase;
    end if;
  end loop;

  insert into teste.resultado (descricao, situacao, detalhe)
  values ('Nenhuma funcao do Full Days carrega as frases antigas',
          case when cardinality(achados) = 0 then 'passou' else 'FALHOU' end,
          case when cardinality(achados) = 0
               then format('%s frases conferidas', cardinality(antigas))
               else array_to_string(achados, ' | ') end);
end
$$;

-- E o outro lado: as frases NOVAS precisam estar la. Sem este, apagar a
-- mensagem inteira passaria pela varredura acima.
do $$
declare
  frase   text;
  faltam  text[] := '{}';
  novas   text[] := array[
    'dias de descanso a cada 12 meses em contrato',
    'O descanso pode ser partido',
    'So o socio responde aos periodos fora',
    'then ''Descanso''',
    'then ''Afastamento''',
    'periodo ja combinado'
  ];
begin
  foreach frase in array novas loop
    if not exists (
      select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('validar_solicitacao', 'decidir_solicitacao',
                           'proteger_presenca_de_pedido')
         and position(frase in p.prosrc) > 0
    ) then
      faltam := faltam || frase;
    end if;
  end loop;

  insert into teste.resultado (descricao, situacao, detalhe)
  values ('As frases novas do Full Days estao no lugar',
          case when cardinality(faltam) = 0 then 'passou' else 'FALHOU' end,
          case when cardinality(faltam) = 0
               then format('%s frases conferidas', cardinality(novas))
               else array_to_string(faltam, ' | ') end);
end
$$;


-- ===========================================================================
-- O DESCANSO CONTA CORRIDO (migration 0024)
--
-- Decisao do usuario: quinze dias de descanso sao quinze dias de calendario.
-- Os outros dois tipos continuam em dias uteis -- eles nao descontam saldo, e
-- o numero deles serve para dizer quantos dias de TRABALHO a pessoa ficou
-- fora.
--
-- 10 de julho de 2026 e uma sexta; 13 e a segunda seguinte. Quatro dias
-- corridos, dois uteis. E o intervalo que separa as duas contas -- com uma
-- semana de segunda a sexta os dois numeros batem, e o cenario passaria sem
-- provar nada.
-- ===========================================================================

select teste.conferir('Descanso de sexta a segunda: 4 dias corridos',
  public.dias_do_pedido('ferias', '2026-07-10', '2026-07-13')::text, '4');

select teste.conferir('Ausencia no mesmo intervalo: 2 dias uteis',
  public.dias_do_pedido('ausencia', '2026-07-10', '2026-07-13')::text, '2');

select teste.conferir('Afastamento tambem continua em dias uteis',
  public.dias_do_pedido('licenca', '2026-07-10', '2026-07-13')::text, '2');

select teste.conferir('Periodo invertido nao vira numero negativo',
  public.dias_do_pedido('ferias', '2026-07-13', '2026-07-10')::text, '0');

-- E a pintura da matriz acompanha: o descanso ocupa o fim de semana do meio,
-- senao a matriz mostraria menos dias do que o pedido diz que sao.
select teste.cenario('Bruno combina o descanso de sexta a segunda', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, motivo)
    values (%L, 'ferias', '2026-07-10', '2026-07-13',
            public.dias_do_pedido('ferias', '2026-07-10', '2026-07-13'), 'Prolongado')
  $fmt$, :BRUNO), 'ok', 1);

select teste.cenario('A socia responde de acordo', :ANA,
  format($fmt$
    select public.decidir_solicitacao(
      (select id from public.hr_requests where user_id = %L and data_inicio = '2026-07-10'),
      'aprovada', null)
  $fmt$, :BRUNO), 'ok');

select teste.conferir('Os quatro dias foram pintados, sabado e domingo inclusive',
  (select count(*)::text from public.team_presence
    where user_id = '44444444-4444-4444-4444-444444444444'
      and data between '2026-07-10' and '2026-07-13'
      and status = 'ferias'),
  '4');

select teste.conferir('E o sabado esta la',
  (select status::text from public.team_presence
    where user_id = '44444444-4444-4444-4444-444444444444' and data = '2026-07-11'),
  'ferias');

-- O saldo desconta os corridos. Chegando aqui o Bruno tem dois descansos de
-- pe: o de julho de 2026, de quatro dias CORRIDOS, e o de maio de 2027, de
-- cinco. Quinze menos nove deixam seis.
--
-- ERAM ONZE ATE A 0039, e a diferenca e a mudanca inteira: com a conta por ano
-- civil, o descanso de 2027 nao entrava no saldo de 2026 -- eram duas contas
-- que nao se viam. Agora ha uma so, corrida.
select teste.conferir('O saldo desconta os dias corridos, de todos os anos',
  public.saldo_de_ferias('44444444-4444-4444-4444-444444444444')::text, '6');

-- Vinte dias corridos com 11 de saldo: estoura. E a recusa DIZ que a conta e
-- corrida -- sem isso, quem levar o "nao" vai conferir no calendario de dias
-- uteis, achar que cabia, e concluir que o sistema errou. (Em dias uteis esse
-- mesmo periodo seriam 14, que tambem estouraria; o que o cenario prova e a
-- frase, e o numero de corridos esta no cenario da funcao, acima.)
select teste.recusa_com('Estourar o saldo diz que a conta e corrida', :BRUNO,
  $$insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, motivo)
    values ('44444444-4444-4444-4444-444444444444', 'ferias', '2026-09-01', '2026-09-20',
            public.dias_do_pedido('ferias', '2026-09-01', '2026-09-20'), 'Longo demais')$$,
  'contados corridos');

-- A ausencia pontual num sabado continua sendo recusada: para ela o numero e
-- de dias uteis, e um sabado nao e um dia em que alguem deixou de entregar.
select teste.recusa_com('Ausencia so no fim de semana continua recusada', :CARLA,
  $$insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values ('33333333-3333-3333-3333-333333333333', 'ausencia', '2026-07-11', '2026-07-12',
            public.dias_do_pedido('ausencia', '2026-07-11', '2026-07-12'))$$,
  'nenhum dia util');


-- --- O ciclo de 12 meses (migration 0039) ----------------------------------
--
-- O saldo deixou de zerar em 1 de janeiro. Cada ciclo de 12 meses contado da
-- ENTRADA DA PESSOA soma 15 dias e 2 parcelas, e o que sobrou de um ciclo
-- continua la no seguinte.
--
-- Esta secao mexe na `data_admissao` de propósito e DEVOLVE no fim: os
-- arquivos seguintes contam com a ficha como ela estava.

delete from public.team_presence;
delete from public.hr_requests;

-- Sem data de entrada, a ancora e `created_at` -- e na bateria a ficha nasceu
-- agora. Uma pessoa sem admissao nao pode ficar sem saldo nenhum: e o caso
-- comum de cadastro incompleto, e zero dias na tela de quem acabou de chegar e
-- um erro que ninguem sabe explicar.
update public.team_members set data_admissao = null where user_id = :BRUNO;

select teste.conferir('Sem data de entrada, a pessoa esta no primeiro ciclo',
  public.ciclos_de_descanso(:BRUNO)::text, '1');

select teste.conferir('E tem os 15 dias do primeiro ciclo',
  public.saldo_de_ferias(:BRUNO)::text, '15');

-- Entrou hoje: primeiro ciclo, 15 dias JA. A outra leitura possivel de "a cada
-- 12 meses soma 15" e conceder so no fim do ciclo -- que e a regra do periodo
-- aquisitivo da CLT, e deixaria quem entrou ontem doze meses sem descansar.
-- Este cenario e o que trava a decisao: se alguem tirar o `+ 1` de
-- `ciclos_de_descanso()`, ele falha e diz qual regra mudou.
update public.team_members set data_admissao = current_date where user_id = :BRUNO;

select teste.conferir('Quem entrou hoje ja esta no ciclo 1',
  public.ciclos_de_descanso(:BRUNO)::text, '1');

select teste.conferir('E ja tem 15 dias, nao zero',
  public.saldo_de_ferias(:BRUNO)::text, '15');

-- Onze meses: ainda no primeiro. Doze: no segundo. E a virada, e ela e de
-- calendario e nao de 365 dias -- `age()` e nao uma divisao.
update public.team_members set data_admissao = current_date - interval '11 months'
 where user_id = :BRUNO;

select teste.conferir('Onze meses ainda e o primeiro ciclo',
  public.ciclos_de_descanso(:BRUNO)::text, '1');

update public.team_members set data_admissao = current_date - interval '12 months'
 where user_id = :BRUNO;

select teste.conferir('Doze meses abrem o segundo ciclo',
  public.ciclos_de_descanso(:BRUNO)::text, '2');

select teste.conferir('E os dias SOMAM: 30, e nao 15 de novo',
  public.saldo_de_ferias(:BRUNO)::text, '30');

select teste.conferir('As parcelas somam junto: 4',
  public.parcelas_concedidas(:BRUNO)::text, '4');

-- O CICLO ATUAL COMECOU NO ULTIMO ANIVERSARIO DA ENTRADA, e a tela mostra essa
-- data: um numero que a pessoa nao sabe de onde veio e um numero em que ela
-- nao confia.
-- Entrou ha exatamente doze meses: o segundo ciclo comecou HOJE, no
-- aniversario da entrada. Nao na data da entrada -- essa foi o comeco do
-- primeiro, que acabou ontem.
select teste.conferir('O ciclo atual comecou no aniversario da entrada',
  public.inicio_do_ciclo(:BRUNO)::text, current_date::text);

-- TRES ANOS SEM PARAR sao QUATRO ciclos, e nao tres: o primeiro comecou na
-- entrada, e os outros tres nos aniversarios. Sessenta dias -- e e a diferenca
-- inteira entre os dois modelos, porque no ano civil o que nao se usou ate 31
-- de dezembro sumia.
update public.team_members set data_admissao = current_date - interval '3 years'
 where user_id = :BRUNO;

select teste.conferir('Tres anos sem parar abrem o quarto ciclo',
  public.ciclos_de_descanso(:BRUNO)::text, '4');

select teste.conferir('E acumulam 60 dias',
  public.saldo_de_ferias(:BRUNO)::text, '60');

-- E O QUE FOI USADO CONTINUA CONTANDO, sem olhar em que ano foi. Um descanso
-- de dois anos atras nao "expira" -- se expirasse, os dias do outro lado da
-- conta tambem teriam que expirar, e ai o modelo seria o do ano civil com
-- outro nome.
select teste.cenario('Um descanso de dois anos atras, lancado pela socia', :ANA,
  format($fmt$
    select public.lancar_periodo(%L, 'ferias',
      (current_date - interval '2 years')::date,
      (current_date - interval '2 years' + interval '9 days')::date)
  $fmt$, :BRUNO), 'ok');

select teste.conferir('Ele desconta do saldo de hoje: 60 menos 10',
  public.saldo_de_ferias(:BRUNO)::text, '50');

select teste.conferir('E gastou uma das oito parcelas',
  public.parcelas_de_ferias(:BRUNO)::text, '1');

select teste.conferir('Que sao oito: duas por ciclo, em quatro ciclos',
  public.parcelas_concedidas(:BRUNO)::text, '8');

-- A TRAVA DO PEDIDO USA A MESMA CONTA. Sem isso a tela mostraria 35 e o banco
-- recusaria a 16, que e o pior dos dois mundos: um numero que promete o que a
-- trava nao cumpre.
select teste.cenario('Com 50 de saldo, um descanso de 30 dias passa', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', current_date + 40, current_date + 69, 30)
  $fmt$, :BRUNO), 'ok', 1);

-- Sobram 20. Pedir 25 estoura, e a frase diz os tres numeros.
select teste.recusa_com('E um de 25 em cima dele estoura o saldo', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis)
    values (%L, 'ferias', current_date + 100, current_date + 124, 25)
  $fmt$, :BRUNO), 'entao sobram 20');

-- Devolve a ficha como estava, para os arquivos seguintes.
delete from public.team_presence;
delete from public.hr_requests;
update public.team_members set data_admissao = null where user_id = :BRUNO;
