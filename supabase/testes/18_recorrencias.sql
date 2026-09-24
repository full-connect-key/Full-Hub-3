\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set TRAFEGO '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

-- ===========================================================================
-- Sprint 3D -- Demandas recorrentes
--
-- Ana e socia, Diego desenvolvedor, Carla e Bruno e Marina colaboradores.
-- CARLA e a do ATENDIMENTO na ficha de teste, e e ela quem prova a regra que
-- mais importa aqui: quem cria demanda cria recorrencia, mesmo sendo
-- colaboradora. Bruno e colaborador sem essa funcao, e nao cria.
--
-- A PERGUNTA DESTE ARQUIVO: uma rotina que cria trabalho sozinha, de
-- madrugada, sem ninguem olhando. Tudo o que ela faz errado so aparece de
-- manha -- e o que ela cria em duplicata aparece como trabalho de verdade na
-- fila de alguem. Por isso a idempotencia e a primeira coisa verificada, e
-- por isso ela e verificada com a rotina chamada DUAS VEZES, nao lendo o
-- indice.
-- ===========================================================================

delete from public.recurrence_runs;
delete from public.task_recurrences;
delete from public.notifications;
select teste.limpar();

-- O modelo minimo: titulo com variaveis, pasta de entrega e a subtarefa diaria.
create or replace function teste.modelo_diario() returns jsonb language sql immutable as $fn$
  select jsonb_build_object(
    'titulo', 'Stories {CLIENTE} — {MES}/{ANO}',
    'prioridade', 'normal',
    'pasta_entrega', 'https://drive.google.com/pasta-stories',
    'subtarefa_diaria', jsonb_build_object(
      'titulo', 'Stories {DATA}',
      'responsavel_id', '55555555-5555-5555-5555-555555555555',
      'prioridade', 'normal',
      'estimativa_minutos', 30,
      'requer_aprovacao', false)
  )
$fn$;

-- O CENARIO RODA COMO `authenticated`, e esse papel nao alcanca o schema
-- `teste` por padrao. Sem estes dois grants o helper morre com "permission
-- denied for schema teste" DENTRO do insert -- e como `teste.cenario` trata
-- qualquer excecao, o cenario passaria como "recusa" onde a recusa nao tem
-- nada a ver com RLS. Foi o que aconteceu na primeira rodada: vinte cenarios
-- reprovados em cascata a partir de um helper inalcancavel.
grant usage on schema teste to authenticated;
grant execute on function teste.modelo_diario() to authenticated;


-- --- Quem configura --------------------------------------------------------

-- A REGRA QUE MAIS IMPORTA, e e a mesma de `tasks_insert` desde a 0006:
-- `is_atendimento()` e verdadeira para quem esta no Atendimento OU para a
-- gestao. Uma recorrencia e uma demanda que ainda nao aconteceu -- se a Carla
-- pode abrir a de hoje, configura a de todo mes.
select teste.cenario('A CARLA do Atendimento cria recorrencia, sendo colaboradora', :CARLA,
  format($fmt$
    insert into public.task_recurrences
      (client_id, nome, modo, frequencia, dias_semana, data_inicio, modelo, criado_por)
    values (%L, 'Stories Mundo Verde', 'mensal_agrupada', 'diaria',
            array[1,2,3,4,5]::smallint[], current_date, teste.modelo_diario(), %L)
  $fmt$, :VERDE, :CARLA), 'ok', 1);

select teste.cenario('O colaborador SEM Atendimento nao cria', :BRUNO,
  format($fmt$
    insert into public.task_recurrences
      (client_id, nome, modo, frequencia, data_inicio, modelo, criado_por)
    values (%L, 'Regra do Bruno', 'mensal_agrupada', 'diaria',
            current_date, teste.modelo_diario(), %L)
  $fmt$, :VERDE, :BRUNO), 'recusa');

select teste.cenario('Nem edita a que ja existe', :BRUNO,
  $$update public.task_recurrences set nome = 'Renomeada pelo Bruno'$$, 'recusa');

select teste.cenario('Nem apaga', :BRUNO,
  $$delete from public.task_recurrences$$, 'recusa');

select teste.cenario('Mas LE -- a equipe inteira enxerga o que esta configurado', :BRUNO,
  'select 1 from public.task_recurrences', 'ok', 1);

select teste.cenario('O cliente nao alcanca recorrencia nenhuma', :JOANA,
  'select 1 from public.task_recurrences', 'ok', 0);

-- O HISTORICO DE EXECUCAO NAO TEM PORTA DE ESCRITA, como `notifications`.
-- Sem esta trava daria para forjar uma chave de ocorrencia e, com ela,
-- impedir para sempre que aquele mes fosse gerado.
select teste.cenario('Ninguem grava no historico de execucao a mao', :ANA,
  $$insert into public.recurrence_runs (recurrence_id, chave_ocorrencia, status)
    values ((select id from public.task_recurrences limit 1), '2099-01', 'gerada')$$,
  'recusa');


-- --- Modo A: mensal agrupada ----------------------------------------------

select teste.cenario('A socia gera a ocorrencia do mes', :ANA,
  $$select public.gerar_ocorrencia(
      (select id from public.task_recurrences where nome = 'Stories Mundo Verde'),
      date_trunc('month', current_date)::date)$$, 'ok');

select teste.conferir('Saiu UMA task para o mes, nao trinta',
  (select count(*)::text from public.tasks where recurrence_id is not null), '1');

select teste.conferir('As variaveis do titulo resolveram',
  (select titulo from public.tasks where recurrence_id is not null),
  'Stories Mundo Verde — ' ||
    initcap((array['janeiro','fevereiro','marco','abril','maio','junho','julho',
                   'agosto','setembro','outubro','novembro','dezembro'])
            [extract(month from current_date)::integer]) ||
    '/' || to_char(current_date, 'YYYY'));

-- UMA SUBTAREFA POR DIA UTIL, e o numero sai da mesma conta que o calendario
-- do Full Days usa: `dias_uteis()` desconta sabado, domingo e feriado.
--
-- E A CONTA COMECA NA `data_inicio` DA REGRA, nao no dia 1: esta regra comeca
-- hoje, entao o mes corrente sai pela metade. Escrevi a expectativa com o mes
-- inteiro na primeira versao e a bateria acusou -- a funcao estava certa, e a
-- expectativa e que descrevia um comportamento que seria errado (uma regra
-- criada dia 24 gerando as etapas do dia 1 ao 23 e geracao retroativa com
-- outro nome).
select teste.conferir('Uma subtarefa por dia util, contado do inicio da regra',
  (select count(*)::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
    where t.recurrence_id is not null),
  public.dias_uteis(current_date,
                    (date_trunc('month', current_date) + interval '1 month - 1 day')::date)::text);

select teste.conferir('Nenhuma delas caiu em sabado ou domingo',
  (select count(*)::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
    where t.recurrence_id is not null
      and extract(isodow from s.prazo) in (6, 7)), '0');

select teste.conferir('Nenhuma caiu em feriado',
  (select count(*)::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
     join public.holidays h on h.data = s.prazo
    where t.recurrence_id is not null), '0');

-- O PERIODO DA TASK SAI CALCULADO, como manda o modelo desde o Sprint 3B: a
-- Task nao tem prazo proprio, tem o que as etapas dizem.
select teste.conferir('O periodo da task vai da primeira a ultima etapa',
  (select (t.data_inicio = min(s.prazo) and t.data_fim = max(s.prazo))::text
     from public.tasks t join public.subtasks s on s.task_id = t.id
    where t.recurrence_id is not null
    group by t.id, t.data_inicio, t.data_fim), 'true');

select teste.conferir('Cada etapa tem o prazo do proprio dia, e o titulo com a data',
  (select count(*)::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
    where t.recurrence_id is not null
      and s.titulo <> 'Stories ' || to_char(s.prazo, 'DD/MM')), '0');


-- --- Idempotencia ----------------------------------------------------------

-- IDEMPOTENCIA, EM DOIS CENARIOS QUE PROVAM COISAS DIFERENTES -- e a
-- distincao so ficou clara depois de mutar a funcao de proposito.
--
-- Os cenarios abaixo chamam a geracao duas vezes EM SEQUENCIA. Isso prova
-- que o caminho normal nao duplica, e e o que a pessoa faz ao clicar em
-- "Gerar agora" duas vezes. **Mas nao prova a trava contra a corrida**: uma
-- implementacao ingenua (consultar `recurrence_runs` e so depois inserir)
-- passa por estes cenarios exatamente igual. Foi o que a mutacao mostrou --
-- troquei o `on conflict` por um `if exists` e os 743 continuaram verdes.
--
-- Quem garante o caso concorrente -- a rotina noturna e o botao clicados no
-- mesmo segundo -- e o INDICE UNICO, verificado logo abaixo, mais a ordem em
-- que `gerar_ocorrencia()` escreve: a linha do run ANTES da task. Duas
-- sessoes nao cabem numa bateria de psql; o que cabe e afirmar a garantia do
-- banco e dizer, aqui, que os dois cenarios seguintes nao a cobrem.
select teste.conferir('Existe indice unico por (regra, ocorrencia) -- a trava da corrida',
  (select count(*)::text from pg_indexes
    where schemaname = 'public' and tablename = 'recurrence_runs'
      and indexdef like '%UNIQUE%'
      and indexdef like '%recurrence_id%' and indexdef like '%chave_ocorrencia%'), '1');

select teste.cenario('Gerar a MESMA ocorrencia de novo nao cria nada', :ANA,
  $$select public.gerar_ocorrencia(
      (select id from public.task_recurrences where nome = 'Stories Mundo Verde'),
      date_trunc('month', current_date)::date)$$, 'ok');

select teste.conferir('Continua UMA task, e nao duas',
  (select count(*)::text from public.tasks where recurrence_id is not null), '1');

select teste.conferir('E UMA linha no historico de execucao',
  (select count(*)::text from public.recurrence_runs), '1');

-- E a rotina inteira tambem: duas passadas no mesmo dia.
select teste.cenario('A rotina roda', :ANA, 'select * from public.gerar_recorrencias()', 'ok');
select teste.cenario('A rotina roda de novo', :ANA, 'select * from public.gerar_recorrencias()', 'ok');

select teste.conferir('Duas rodadas da rotina nao duplicaram o mes corrente',
  (select count(*)::text from public.recurrence_runs r
     join public.task_recurrences reg on reg.id = r.recurrence_id
    where reg.nome = 'Stories Mundo Verde'
      and r.chave_ocorrencia = to_char(current_date, 'YYYY-MM')), '1');


-- --- Nunca retroativo ------------------------------------------------------

-- ATIVAR UMA REGRA ANTIGA NAO CRIA OS MESES QUE PASSARAM. Sem esta regra,
-- configurar em outubro uma rotina que "comecou em janeiro" despejaria dez
-- meses de demanda vencida na fila de alguem -- e cada uma com prazo no
-- passado, o que a tela mostra em vermelho.
select teste.cenario('Uma regra que diz ter comecado ha um ano', :ANA,
  format($fmt$
    insert into public.task_recurrences
      (client_id, nome, modo, frequencia, dias_semana, data_inicio, modelo, criado_por)
    values (%L, 'Antiga', 'mensal_agrupada', 'diaria', array[1,2,3,4,5]::smallint[],
            (current_date - interval '1 year')::date, teste.modelo_diario(), %L)
  $fmt$, :OPTICA, :ANA), 'ok', 1);

select teste.conferir('O proximo periodo dela e o MES CORRENTE, nao janeiro',
  public.proximo_periodo_da_recorrencia(
    (select id from public.task_recurrences where nome = 'Antiga'))::text,
  date_trunc('month', current_date)::date::text);

select teste.cenario('A rotina roda com ela ativa', :ANA,
  'select * from public.gerar_recorrencias()', 'ok');

select teste.conferir('E ela gerou no maximo o limite de tasks por rodada',
  (select (count(*) <= public.limite_tasks_por_rodada())::text
     from public.tasks t
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Antiga'), 'true');

select teste.conferir('Nenhuma task dela comeca antes do mes corrente',
  (select count(*)::text from public.tasks t
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Antiga'
      and t.data_inicio < date_trunc('month', current_date)::date), '0');


-- --- Antecedencia ----------------------------------------------------------

-- A TASK DE NOVEMBRO APARECE NO FIM DE OUTUBRO. Sem antecedencia, a demanda
-- do mes nasce no dia 1 -- e quem monta a agenda da semana no dia 28 nao ve
-- nada do mes seguinte.
select teste.conferir('Com 5 dias de antecedencia, a data de geracao antecede o periodo',
  (select (proxima_geracao_em <= proximo_periodo_da_recorrencia(id))::text
     from public.task_recurrences where nome = 'Antiga'), 'true');

select teste.cenario('Uma regra mensal com 5 dias de antecedencia', :ANA,
  format($fmt$
    insert into public.task_recurrences
      (client_id, nome, modo, frequencia, dia_mes, data_inicio, antecedencia_dias,
       modelo, criado_por)
    values (%L, 'Fechamento', 'task_por_ocorrencia', 'mensal', 10,
            (date_trunc('month', current_date) + interval '2 months')::date, 5,
            jsonb_build_object(
              'titulo', 'Fechamento {MES}/{ANO}',
              'pasta_entrega', 'https://drive.google.com/fechamento',
              'subtarefas', jsonb_build_array(
                jsonb_build_object('titulo', 'Coletar dados', 'responsavel_id', %L,
                                   'prazo_offset_dias', 1),
                jsonb_build_object('titulo', 'Montar', 'responsavel_id', %L,
                                   'prazo_offset_dias', 2),
                jsonb_build_object('titulo', 'Revisar', 'responsavel_id', %L,
                                   'prazo_offset_dias', 3, 'requer_aprovacao', true,
                                   'tipo_aprovacao', 'interna', 'depende_de_ordem', 2))),
            %L)
  $fmt$, :VERDE, :MARINA, :BRUNO, :CARLA, :ANA), 'ok', 1);

select teste.conferir('A geracao dela e 5 dias antes do dia 10',
  (select (proximo_periodo_da_recorrencia(id) - proxima_geracao_em)::text
     from public.task_recurrences where nome = 'Fechamento'), '5');

select teste.conferir('E ela NAO entra na rodada de hoje',
  (select (proxima_geracao_em > current_date)::text
     from public.task_recurrences where nome = 'Fechamento'), 'true');


-- --- Modo B: task por ocorrencia, e as dependencias ------------------------

select teste.cenario('Gerar a ocorrencia do Fechamento a mao', :ANA,
  $$select public.gerar_ocorrencia(
      (select id from public.task_recurrences where nome = 'Fechamento'),
      (select proximo_periodo_da_recorrencia(id)
         from public.task_recurrences where nome = 'Fechamento'))$$, 'ok');

select teste.conferir('Saiu uma task com as TRES etapas do modelo',
  (select count(*)::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Fechamento'), '3');

-- OS PRAZOS SAEM DOS OFFSETS, contados do inicio da ocorrencia.
select teste.conferir('Os prazos seguem os offsets: 1, 2 e 3 dias',
  (select string_agg((s.prazo - t.data_inicio)::text, ',' order by s.ordem)
     from public.subtasks s
     join public.tasks t on t.id = s.task_id
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Fechamento'), '0,1,2');

-- A DEPENDENCIA E RECRIADA, e ela aponta para a frente no modelo: a terceira
-- depende da segunda. Num passe so de insercao isso sumiria calado, porque a
-- segunda ainda nao existia quando a terceira foi criada -- por isso a funcao
-- faz um segundo passe.
select teste.conferir('A dependencia do modelo foi recriada',
  (select count(*)::text
     from public.subtask_dependencies d
     join public.subtasks s on s.id = d.subtask_id
     join public.tasks t on t.id = s.task_id
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Fechamento'), '1');

select teste.conferir('E ela liga a etapa 3 a etapa 2, na ordem certa',
  (select (alvo.ordem = 3 and origem.ordem = 2)::text
     from public.subtask_dependencies d
     join public.subtasks alvo on alvo.id = d.subtask_id
     join public.subtasks origem on origem.id = d.depende_de_id
     join public.tasks t on t.id = alvo.task_id
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Fechamento'), 'true');

select teste.conferir('A etapa que pede aval guardou o escopo dela',
  (select tipo_aprovacao::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Fechamento' and s.requer_aprovacao), 'interna');


-- --- Rascunho --------------------------------------------------------------

-- `publicada_em = null`, E NAO UM STATUS. O pedido do sprint dizia
-- `tasks.status = 'rascunho'`; esse valor nao existe no enum, e a ausencia e
-- decisao da 0028 com tres motivos escritos la.
select teste.cenario('Uma regra que gera como rascunho', :CARLA,
  format($fmt$
    insert into public.task_recurrences
      (client_id, nome, modo, frequencia, dias_semana, data_inicio,
       gerar_como_rascunho, modelo, criado_por)
    values (%L, 'Rascunhada', 'task_por_ocorrencia', 'semanal',
            array[extract(isodow from current_date)::smallint], current_date,
            true,
            jsonb_build_object('titulo', 'Rascunho {DATA}',
              'pasta_entrega', 'https://drive.google.com/r',
              'subtarefas', jsonb_build_array(
                jsonb_build_object('titulo', 'Unica', 'prazo_offset_dias', 0))),
            %L)
  $fmt$, :VERDE, :CARLA), 'ok', 1);

select teste.cenario('A Carla gera', :CARLA,
  $$select public.gerar_ocorrencia(
      (select id from public.task_recurrences where nome = 'Rascunhada'), current_date)$$, 'ok');

select teste.conferir('A task nasceu sem data de publicacao',
  (select (publicada_em is null)::text from public.tasks t
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Rascunhada'), 'true');

-- O RASCUNHO E DE QUEM O CRIOU, E DE MAIS NINGUEM -- nem da socia. A regra e
-- da 0028, e vale para o que a recorrencia gera tambem: um rascunho e um
-- pensamento pela metade, nao um documento da agencia.
select teste.cenario('A Carla enxerga o proprio rascunho', :CARLA,
  $$select 1 from public.tasks t join public.task_recurrences r on r.id = t.recurrence_id
     where r.nome = 'Rascunhada'$$, 'ok', 1);

select teste.cenario('A SOCIA nao enxerga o rascunho da Carla', :ANA,
  $$select 1 from public.tasks t join public.task_recurrences r on r.id = t.recurrence_id
     where r.nome = 'Rascunhada'$$, 'ok', 0);

select teste.conferir('E ninguem foi notificado por causa dele',
  (select count(*)::text from public.notifications
    where titulo like 'Nova demanda recorrente: Rascunho%'), '0');


-- --- Pausar, retomar, apagar ----------------------------------------------

select teste.cenario('A gestao pausa a regra', :DIEGO,
  $$update public.task_recurrences set ativo = false where nome = 'Stories Mundo Verde'$$,
  'ok', 1);

select teste.conferir('Pausada, ela some da fila de geracao',
  (select (proxima_geracao_em is null)::text
     from public.task_recurrences where nome = 'Stories Mundo Verde'), 'true');

select teste.cenario('E retomar devolve a proxima ocorrencia', :DIEGO,
  $$update public.task_recurrences set ativo = true where nome = 'Stories Mundo Verde'$$,
  'ok', 1);

select teste.conferir('A data de geracao voltou, e nao e no passado',
  (select (proxima_geracao_em is not null and proxima_geracao_em >= current_date)::text
     from public.task_recurrences where nome = 'Stories Mundo Verde'), 'true');

-- APAGAR A REGRA NAO APAGA AS TASKS GERADAS. Elas sao trabalho de verdade,
-- com comentario, tempo lancado e aprovacao. `on delete set null` no
-- `recurrence_id` e o que garante isso.
select teste.conferir('Antes de apagar, a regra Antiga tem tasks',
  (select (count(*) > 0)::text from public.tasks t
     join public.task_recurrences r on r.id = t.recurrence_id where r.nome = 'Antiga'), 'true');

do $$
declare n integer;
begin
  select count(*) into n from public.tasks t
    join public.task_recurrences r on r.id = t.recurrence_id where r.nome = 'Antiga';
  perform set_config('teste.antes', n::text, false);
end $$;

select teste.cenario('A gestao apaga a regra', :DIEGO,
  $$delete from public.task_recurrences where nome = 'Antiga'$$, 'ok', 1);

select teste.conferir('As tasks dela continuam la, so sem o vinculo',
  (select count(*)::text from public.tasks
    where titulo like 'Stories Óptica Visão%'),
  current_setting('teste.antes'));


-- --- Cliente desativado ----------------------------------------------------

-- Uma regra que continua marcada como ativa e nunca gera e uma regra que
-- alguem vai passar meses achando quebrada. Pausar de verdade poe o motivo na
-- tela.
select teste.cenario('A socia desativa o cliente', :ANA,
  format($fmt$update public.clients set ativo = false where id = %L$fmt$, :VERDE), 'ok', 1);

select teste.conferir('As recorrencias dele foram pausadas',
  (select count(*)::text from public.task_recurrences
    where client_id = :VERDE and ativo), '0');

-- E REATIVAR O CLIENTE NAO RETOMA SOZINHO: um cliente volta depois de meses
-- parado, e gerar demanda para uma conta cujo escopo mudou e pior que nao
-- gerar. Quem retoma e uma pessoa, uma regra de cada vez.
select teste.cenario('A socia reativa o cliente', :ANA,
  format($fmt$update public.clients set ativo = true where id = %L$fmt$, :VERDE), 'ok', 1);

select teste.conferir('E as regras continuam pausadas, de proposito',
  (select count(*)::text from public.task_recurrences
    where client_id = :VERDE and ativo), '0');


-- --- Responsavel desligado e responsavel fora ------------------------------

delete from public.recurrence_runs;
delete from public.task_recurrences;
select teste.limpar();
delete from public.team_presence;

select teste.cenario('Uma regra semanal no nome da Marina', :ANA,
  format($fmt$
    insert into public.task_recurrences
      (client_id, nome, modo, frequencia, dias_semana, data_inicio, modelo, criado_por)
    values (%L, 'Semanal da Marina', 'task_por_ocorrencia', 'semanal',
            array[extract(isodow from current_date + 2)::smallint], current_date,
            jsonb_build_object('titulo', 'Semanal {DATA}',
              'pasta_entrega', 'https://drive.google.com/s',
              'subtarefas', jsonb_build_array(
                jsonb_build_object('titulo', 'Fazer', 'responsavel_id', %L,
                                   'prazo_offset_dias', 0))),
            %L)
  $fmt$, :OPTICA, :MARINA, :ANA), 'ok', 1);

-- Marina de recesso no dia da ocorrencia.
insert into public.team_presence (user_id, data, status)
values (:MARINA, (current_date + 2)::date, 'ferias')
on conflict (user_id, data) do update set status = 'ferias';

select teste.cenario('Gera com a Marina fora no dia', :ANA,
  $$select public.gerar_ocorrencia(
      (select id from public.task_recurrences where nome = 'Semanal da Marina'),
      (current_date + 2)::date)$$, 'ok');

-- NAO REATRIBUI SOZINHO. Trocar o dono porque a pessoa esta de recesso parece
-- prestativo e e o contrario: a troca acontece calada, aparece na fila de
-- outra pessoa sem explicacao, e desfaz o combinado que existia fora do
-- sistema. Quem decide e o Atendimento, avisado.
select teste.conferir('A etapa continua com a Marina -- ninguem foi reatribuido',
  (select (responsavel_id = :MARINA)::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Semanal da Marina'), 'true');

select teste.conferir('Mas ela nasceu COM O AVISO, onde quem abrir a etapa ve',
  (select (aviso_geracao is not null)::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Semanal da Marina'), 'true');

select teste.conferir('E o Atendimento foi avisado',
  (select (count(*) > 0)::text from public.notifications
    where titulo like 'Recorrente%gerada com aviso%'), 'true');

-- Responsavel desligado: a regra NAO quebra.
update public.profiles set ativo = false where id = :MARINA;

select teste.cenario('Gera de novo, com a Marina ja desligada', :ANA,
  $$select public.gerar_ocorrencia(
      (select id from public.task_recurrences where nome = 'Semanal da Marina'),
      (current_date + 9)::date)$$, 'ok');

select teste.conferir('A etapa nasceu SEM responsavel, e a geracao nao quebrou',
  (select (responsavel_id is null)::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
    where t.data_inicio = (current_date + 9)::date), 'true');

select teste.conferir('Com o aviso dizendo que a pessoa saiu',
  (select (aviso_geracao like '%nao esta mais na equipe%')::text from public.subtasks s
     join public.tasks t on t.id = s.task_id
    where t.data_inicio = (current_date + 9)::date), 'true');

update public.profiles set ativo = true where id = :MARINA;


-- --- O modelo sem pasta de entrega vira ERRO, nao exception ---------------

-- A pasta e obrigatoria desde a 0015. Sem este cenario, uma regra assim
-- derrubaria a geracao com uma mensagem sobre `link_entrega` que ninguem
-- ligaria a recorrencia -- e, pior, derrubaria a rodada inteira.
select teste.cenario('Uma regra sem pasta de entrega no modelo', :ANA,
  format($fmt$
    insert into public.task_recurrences
      (client_id, nome, modo, frequencia, dias_semana, data_inicio, modelo, criado_por)
    values (%L, 'Sem pasta', 'task_por_ocorrencia', 'semanal',
            array[extract(isodow from current_date)::smallint], current_date,
            jsonb_build_object('titulo', 'Sem pasta {DATA}',
              'subtarefas', jsonb_build_array(
                jsonb_build_object('titulo', 'Unica', 'prazo_offset_dias', 0))),
            %L)
  $fmt$, :OPTICA, :ANA), 'ok', 1);

select teste.cenario('Gerar nao estoura: vira registro de erro', :ANA,
  $$select public.gerar_ocorrencia(
      (select id from public.task_recurrences where nome = 'Sem pasta'), current_date)$$, 'ok');

select teste.conferir('O erro ficou gravado no historico, com o nome da regra',
  (select (status = 'erro' and detalhes->>'motivo' like '%Sem pasta%')::text
     from public.recurrence_runs rr
     join public.task_recurrences r on r.id = rr.recurrence_id
    where r.nome = 'Sem pasta'), 'true');

select teste.conferir('E nenhuma task foi criada por ela',
  (select count(*)::text from public.tasks t
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Sem pasta'), '0');

-- UMA REGRA COM ERRO NAO IMPEDE AS OUTRAS DE RODAREM. Sem o bloco `exception`
-- dentro do laco, a agencia acordaria sem nenhuma demanda gerada --
-- descobrindo o problema pela ausencia, que e a pior forma de descobrir.
select teste.cenario('A rotina roda com a regra quebrada no meio', :ANA,
  'select * from public.gerar_recorrencias()', 'ok');

select teste.conferir('E as OUTRAS regras geraram assim mesmo',
  (select (count(*) > 0)::text from public.tasks t
     join public.task_recurrences r on r.id = t.recurrence_id
    where r.nome = 'Semanal da Marina'), 'true');


-- --- O limite por task -----------------------------------------------------

-- Uma regra diaria sem dias da semana e sem pular feriado, num mes inteiro,
-- passa dos 31 -- mas o limite e 60, entao o corte so aparece num periodo
-- grande. O que o cenario prova e que o limite EXISTE e e respeitado, nao o
-- numero exato.
select teste.conferir('Nenhuma task gerada passou do limite de subtarefas',
  (select count(*)::text from (
     select t.id from public.tasks t
      where t.recurrence_id is not null
      group by t.id
     having count((select 1 from public.subtasks s where s.task_id = t.id)) > public.limite_subtarefas_por_task()
   ) x), '0');

select teste.conferir('O limite por task e 60, e o por rodada e 20',
  public.limite_subtarefas_por_task()::text || '/' || public.limite_tasks_por_rodada()::text,
  '60/20');


-- --- As variaveis do titulo -----------------------------------------------

select teste.conferir('{CLIENTE} e {ANO} resolvem',
  public.resolver_variaveis('Post {CLIENTE} {ANO}', 'Mundo Verde', 'mundo-verde',
                            '2026-10-05'::date),
  'Post Mundo Verde 2026');

select teste.conferir('{DATA} sai como dd/mm',
  public.resolver_variaveis('Stories {DATA}', 'X', 'x', '2026-10-05'::date),
  'Stories 05/10');

select teste.conferir('{MES} sai por extenso e com inicial maiuscula',
  public.resolver_variaveis('{MES}', 'X', 'x', '2026-10-05'::date), 'Outubro');

select teste.conferir('{DIA_SEMANA} conhece a segunda-feira',
  public.resolver_variaveis('{DIA_SEMANA}', 'X', 'x', '2026-10-05'::date), 'Segunda');

-- Variavel que nao existe fica como esta, e e escolha: apagar um `{FOO}`
-- digitado errado esconderia o erro, e o titulo sairia com um buraco que
-- ninguem liga ao que digitou.
select teste.conferir('Variavel desconhecida fica visivel no titulo',
  public.resolver_variaveis('X {FOO} Y', 'C', 'c', '2026-10-05'::date), 'X {FOO} Y');


-- --- O dia 31 em mes curto -------------------------------------------------

-- Um fechamento marcado "no fim do mes" tem que acontecer em fevereiro
-- tambem. Sem o `least`, o dia 31 pularia o mes inteiro -- calado.
select teste.cenario('Uma regra mensal no dia 31', :ANA,
  format($fmt$
    insert into public.task_recurrences
      (client_id, nome, modo, frequencia, dia_mes, pular_feriados,
       data_inicio, data_fim, modelo, criado_por)
    values (%L, 'Dia 31', 'task_por_ocorrencia', 'mensal', 31, false,
            '2027-02-01', '2027-02-28',
            jsonb_build_object('titulo', 'Fecha {DATA}',
              'pasta_entrega', 'https://drive.google.com/f',
              'subtarefas', jsonb_build_array(
                jsonb_build_object('titulo', 'Fechar', 'prazo_offset_dias', 0))),
            %L)
  $fmt$, :OPTICA, :ANA), 'ok', 1);

select teste.conferir('Em fevereiro de 2027 ela cai no dia 28, nao pula o mes',
  (select min(x)::text from public.datas_da_recorrencia(
     (select id from public.task_recurrences where nome = 'Dia 31'),
     '2027-02-01', '2027-02-28') x), '2027-02-28');
