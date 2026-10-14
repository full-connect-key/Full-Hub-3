-- ===========================================================================
-- 0105 - O CALENDARIO FULL E SO DE EVENTOS
--
-- Decisao do usuario, palavra por palavra: *"No calendario da full, ainda
-- estao aparecendo tasks, e social, campanhas, entre outros, ele deve ser
-- apenas para eventos que serao lancados nele, nada de outros abas."*
--
-- A `calendar_events` nasceu na 0055 juntando OITO origens num formato so, e
-- a conta de cada remocao esta no cabecalho dela: a demanda e a etapa sairam
-- na 0077 (*"quero que elas fiquem apenas dentro do Minhas Tasks"*), a etapa
-- de post saiu na 0088 (*"a corrente do social vive so em minhas tasks e na
-- carga"*), e a fase do mes voltou na 0090 com outro recorte. Esta migration
-- e a ultima dessa sequencia, e ela tira as CINCO que sobraram: fica o
-- `evento`, que e o que alguem LANCA nesta tela.
--
-- ---------------------------------------------------------------------------
-- A AUSENCIA SAI TAMBEM, e foi a unica pergunta que precisou ser feita.
--
-- Ela era a outra camada que ninguem "lanca" em outro modulo com a mesma
-- cara: um descanso combinado nao e uma demanda nem um post, e ele muda o
-- calendario de quem distribui trabalho. A leitura literal da frase ganhou:
-- a ausencia e lancada no Full Days, que e outra aba.
--
-- O QUE SE PERDE ESTA DITO, porque e informacao e nao enfeite: esta era a
-- unica tela onde se via a agenda da agencia JUNTO com quem nao vai estar. A
-- pergunta "quem esta disponivel" continua tendo resposta em dois lugares, e
-- os dois sao onde ela e feita de verdade -- a matriz do Full Days (quem olha
-- a semana da equipe) e a faixa de disponibilidade no painel da etapa (quem
-- esta distribuindo trabalho, antes de escrever a data). O que nao existe
-- mais e o retrato das duas coisas na mesma grade.
--
-- ---------------------------------------------------------------------------
-- AS CINCO SAEM DA VIEW, e nao so da lista de camadas da tela.
--
-- E a decisao da 0077 e da 0088, e a licao da 0090 no meio delas. Uma camada
-- e um INTERRUPTOR: tirar o interruptor deixando a origem produzindo esconde
-- as linhas desta tela e as entrega de graca ao proximo consumidor da view --
-- a exportacao, um relatorio, uma tela nova. E o caminho contrario tambem
-- cobra: a 0088 tirou a origem da view e DEIXOU o interruptor, e quando a
-- 0090 devolveu uma origem com nome novo o `in("tipo", camadas)` da tela
-- passou a filtrar fora exatamente as linhas que a migration acabara de
-- criar. Aqui as duas pontas saem no mesmo commit.
--
-- ---------------------------------------------------------------------------
-- `security_invoker = true` PELA SEXTA VEZ -- 0055, 0059, 0077, 0088, 0090 e
-- aqui. `create or replace view` NAO HERDA a clausula do objeto que
-- substitui, e sem ela a view volta a rodar com os direitos de quem a criou:
-- ela passa a ler as tabelas de origem INTEIRAS para qualquer pessoa
-- autenticada, num objeto que o PostgREST publica sozinho.
--
-- **E o furo passa despercebido num banco com um cliente so:** ele ve seis
-- campanhas, que e o total, e "seis de seis" tem a mesma cara com a RLS
-- ligada e desligada. A bateria mede com material de DUAS empresas.
--
-- ---------------------------------------------------------------------------
-- DUAS COLUNAS PASSAM A SER SEMPRE NULAS, e elas FICAM.
--
-- `create or replace view` nao deixa TIRAR coluna -- so acrescentar no fim --,
-- e um `drop`/`create` derrubaria junto os grants de um objeto que o PostgREST
-- publica. Entao `user_id` vai fazer companhia a `prioridade`, que esta nessa
-- situacao desde a 0077: a coluna fica, e nenhum caminho a escreve. E a mesma
-- situacao de `cancelada` no enum de `task_status` vista de outro angulo.
--
-- A CONSEQUENCIA ESTA NA TELA, e e por isso que ela sai no mesmo commit: o
-- filtro "Filtrar por responsavel" perguntava por `user_id` e passaria a
-- devolver ZERO sempre, e o chip "So minha pauta" -- que deixa passar o que
-- tem o meu nome MAIS o que e da agencia -- passaria a deixar passar tudo.
-- Um filtro que so sabe esvaziar a tela e um botao que nao muda nada sao o
-- interruptor da 0088 em outra forma.
--
-- `client_id` CONTINUA SENDO ESCRITA, e por isso o filtro por cliente fica:
-- a feira e o feriado de uma conta tem empresa, a convencao da casa nao tem.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- A VIEW, com uma origem so
-- ---------------------------------------------------------------------------
create or replace view public.calendar_events
with (security_invoker = true) as

  -- O QUE ACONTECE: convencao, feira, lancamento, reuniao, treinamento,
  -- feriado de cliente. Quem abre e `is_atendimento()`, a mesma funcao que
  -- `tasks_insert` usa desde a 0006.
  --
  -- AS DEZ COLUNAS SAEM NOMEADAS AQUI. Ate aqui a primeira origem carregava
  -- os nomes e o resto vinha por posicao; com uma origem so, ela e a unica
  -- que os declara -- e `create or replace view` exige a MESMA lista, na
  -- mesma ordem, com os mesmos tipos.
  select
    e.id                                   as id,
    'evento'::text                         as tipo,
    e.nome                                 as titulo,
    e.data_inicio                          as data_inicio,
    e.data_fim                             as data_fim,
    e.client_id                            as client_id,
    -- SEMPRE NULA a partir daqui: quem a escrevia era a ausencia, o post, a
    -- fase do mes e a peca de campanha. O evento tem PARTICIPANTES, que sao
    -- varios por linha -- um `user_id` aqui teria que escolher um deles.
    null::uuid                             as user_id,
    -- SEMPRE NULA DESDE A 0077: quem a escrevia era a etapa de demanda.
    null::text                             as prioridade,
    e.tipo::text                           as status,
    '/painel/calendario?evento=' || e.id   as link
  from public.events e;

comment on view public.calendar_events is
  'O Calendário Full, e ele é só de eventos (0105, decisão do usuário). '
  'Nasceu na 0055 juntando oito origens; a demanda e a etapa saíram na 0077, '
  'a etapa de post na 0088, e a 0105 tirou as cinco que sobravam — ausência, '
  'post, fase do mês de social, campanha e entregável —, cada uma delas '
  'lançada e lida no módulo dela. As colunas user_id e prioridade ficam sem '
  'ninguém que as escreva: create or replace view não deixa tirar coluna. '
  'security_invoker = true: a RLS de events continua valendo por baixo.';


-- ---------------------------------------------------------------------------
-- CONFERENCIA -- nao escreve nada
--
-- AS SONDAS LEEM O TEXTO DEPARSADO, e e por isso que elas nao citam o schema:
-- `pg_views.definition` reescreve a view sem o prefixo -- `from events e`, e
-- nao `from public.events e`. Procurar `public.posts` responderia "a origem
-- saiu" numa view que a le, que e o pior jeito de uma conferencia estar
-- errada. E a mesma forma das sondas da bateria (`%post_etapas%`,
-- `%social_papel%`, `%gestao-tasks%`), que procuram o nome nu.
--
-- Esperado: t | 1 | 0 | 0
-- ---------------------------------------------------------------------------
select
  (select (array_to_string(reloptions, ',') like '%security_invoker=true%')
     from pg_class where relname = 'calendar_events')   as security_invoker,
  (select count(*) from pg_views
    where schemaname = 'public' and viewname = 'calendar_events'
      and definition like '%FROM events%')              as le_events,
  (select count(*) from pg_views
    where schemaname = 'public' and viewname = 'calendar_events'
      and (definition like '%hr_requests%'
        or definition like '%posts%'
        or definition like '%campaigns%'
        or definition like '%deliverables%'
        or definition like '%social_papel%'))            as origens_que_sairam,
  (select count(*) from public.calendar_events
    where tipo <> 'evento')                             as linhas_que_nao_sao_evento;
