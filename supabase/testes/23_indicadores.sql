\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

-- ===========================================================================
-- SPRINT 15 -- A CAMADA DE INDICADORES (0035) E O RESUMO DA HOME (0049)
--
-- O CRITERIO QUE ATRAVESSA O ARQUIVO INTEIRO: **rascunho nao entra em conta
-- nenhuma**, e so FOLHA conta. Os dois sao faceis de quebrar sem ninguem
-- notar, porque uma metrica errada nao estoura -- ela so mostra outro numero.
-- ===========================================================================

\set MEUCLI  '''50700000-0000-0000-0000-0000000000c1'''
\set TDEMANDA '''50700000-0000-0000-0000-000000000001'''
\set TRASCUNHO '''50700000-0000-0000-0000-000000000002'''
\set MAE      '''50700000-0000-0000-0000-00000000000a'''
\set FILHA    '''50700000-0000-0000-0000-00000000000b'''

-- Uma demanda publicada e uma em rascunho, lado a lado. A do rascunho tem
-- etapa com prazo vencido no nome do Bruno -- se ela vazar para alguma conta,
-- os numeros do Bruno mudam e os cenarios dizem qual.
-- UM CLIENTE SO DESTE ARQUIVO. A primeira versao media `producao_do_periodo`
-- pelo numero absoluto da agencia, e ela falhou na hora: a bateria roda todos
-- os arquivos contra o MESMO banco, e o arquivo 19 cria posts, o 21 cria
-- correntes, o 22 cria cards. Um indicador que conta a agencia inteira nao
-- pode ser conferido por um numero fixo -- ele muda quando outro arquivo
-- cresce, e o cenario passa a falhar por um motivo que nao tem nada a ver com
-- ele.
insert into public.clients (id, nome_empresa, nome_contato, email_contato, ativo, slug)
values (:MEUCLI, 'Indicadores SA', 'Teste', 'teste@ind.com', true, 'indicadores-sa')
on conflict (id) do nothing;

insert into public.tasks (id, client_id, titulo, criado_por, link_entrega, publicada_em)
values (:TDEMANDA, :MEUCLI, 'Demanda publicada', :ANA, 'https://drive.com/x', now()),
       (:TRASCUNHO, :MEUCLI, 'Demanda em rascunho', :ANA, 'https://drive.com/y', null);

insert into public.subtasks (task_id, titulo, ordem, responsavel_id, prazo, status, estimativa_minutos)
values (:TDEMANDA, 'Atrasada de verdade', 1, :BRUNO, current_date - 5, 'em_andamento', 120),
       (:TDEMANDA, 'Para hoje',           2, :BRUNO, current_date,     'nao_iniciada', 60),
       (:TDEMANDA, 'Esta semana',         3, :BRUNO, current_date + 3, 'nao_iniciada', 90),
       (:TDEMANDA, 'Mes que vem',         4, :BRUNO, current_date + 40, 'nao_iniciada', 60),
       (:TRASCUNHO, 'Do rascunho',        1, :BRUNO, current_date - 9, 'em_andamento', 300);

-- A agrupadora e a filha: a mae tem estimativa e prazo gravados, e eles param
-- de contar no instante em que ela ganha filha. Apagar seria destruir dado por
-- causa de um clique que a pessoa desfaz em seguida.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, status, estimativa_minutos)
values (:MAE, :TDEMANDA, 'Arte', 5, :BRUNO, current_date, 'em_andamento', 480);
-- A filha PEDE AVAL: sem `requer_aprovacao`, a rodada da secao 2 e recusada
-- com "essa subtarefa nao exige aprovacao" -- e a trava esta certa, o cenario
-- e que estava montando uma rodada impossivel.
insert into public.subtasks (id, task_id, parent_id, titulo, ordem, responsavel_id, prazo, status, estimativa_minutos, requer_aprovacao, tipo_aprovacao)
values (:FILHA, :TDEMANDA, :MAE, 'Conceito', 1, :BRUNO, current_date, 'em_andamento', 60, true, 'interna');


-- --- 1. home_summary: os contadores de quem abre a tela -------------------

select teste.conferir_como('Meu dia conta a etapa vencida', :BRUNO,
  $q$select (public.home_summary()->'meu_dia'->>'atrasadas')$q$, '1');

-- O RASCUNHO NAO ENTRA, e este e o cenario que prova. A etapa dele vence ha
-- nove dias no nome do Bruno: se `publicada_em is not null` cair de qualquer
-- uma das consultas, este numero vira 2.
select teste.conferir_como('E a do rascunho fica de fora', :BRUNO,
  $q$select (public.home_summary()->'meu_dia'->>'atrasadas')$q$, '1');

-- SO FOLHA CONTA. "Para hoje" tem a etapa solta e a FILHA -- a mae, que tem o
-- mesmo prazo, nao entra. Se a agrupadora vazar, este numero vira 3 e a carga
-- do Bruno passa a somar 480 minutos que ninguem vai trabalhar.
select teste.conferir_como('Hoje conta a folha, nunca a agrupadora', :BRUNO,
  $q$select (public.home_summary()->'meu_dia'->>'hoje')$q$, '2');

select teste.conferir_como('E a semana nao arrasta o mes que vem', :BRUNO,
  $q$select (public.home_summary()->'meu_dia'->>'semana')$q$, '1');


-- --- 2. O que cada perfil recebe ------------------------------------------
--
-- OS BLOCOS DE GESTAO NAO EXISTEM NA RESPOSTA DO COLABORADOR. A chave nao vem
-- vazia: ela nao vem. Uma chave com zero diria "a agencia nao tem nada
-- atrasado", que e outra afirmacao.

select teste.conferir_como('O colaborador nao recebe o pulso', :BRUNO,
  $q$select case when public.home_summary() ? 'pulso' then 'veio' else 'nao veio' end$q$, 'nao veio');

select teste.conferir_como('Nem os clientes em atencao', :BRUNO,
  $q$select case when public.home_summary() ? 'clientes_em_atencao'
               then 'veio' else 'nao veio' end$q$, 'nao veio');

select teste.conferir_como('A gestao recebe o pulso', :DIEGO,
  $q$select case when public.home_summary() ? 'pulso' then 'veio' else 'nao veio' end$q$, 'veio');

-- E A FILA DE APROVACAO E DE QUEM DECIDE. Para o colaborador o numero e zero
-- porque a policy de `approval_rounds` nao devolve a linha -- nao porque um
-- `if` a escondeu.
insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
select 'subtask', s.id, 1, 'interna', :BRUNO, 'pendente'
  from public.subtasks s where s.id = :FILHA;

select teste.conferir_como('A gestao ve a rodada esperando decisao', :DIEGO,
  $q$select (public.home_summary()->'precisa_de_mim'->>'aprovacoes')$q$, '1');

select teste.conferir_como('E o colaborador nao', :BRUNO,
  $q$select (public.home_summary()->'precisa_de_mim'->>'aprovacoes')$q$, '0');

-- PEDIDO DE FULL DAYS E DO SOCIO, e nem o desenvolvedor responde -- esta
-- escrito na primeira linha de `decidir_solicitacao()` desde a 0011.
insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, status, origem)
values (:MARINA, 'ausencia', current_date + 10, current_date + 10, 1, 'pendente', 'solicitacao');

-- "TEM PEDIDO", e nao "tem UM pedido": outros arquivos da bateria tambem
-- deixam solicitacao pendente, e um numero fixo aqui mediria o banco inteiro
-- em vez desta linha. O que o cenario precisa provar e que o socio alcanca a
-- fila e o desenvolvedor nao -- e isso nao depende do total.
select teste.conferir_como('O socio ve o pedido de Full Days', :ANA,
  $q$select case when (public.home_summary()->'precisa_de_mim'->>'pedidos_rh')::int >= 1
       then 'tem' else 'nao tem' end$q$, 'tem');

select teste.conferir_como('O desenvolvedor nao responde por ele', :DIEGO,
  $q$select (public.home_summary()->'precisa_de_mim'->>'pedidos_rh')$q$, '0');


-- --- 3. Quem esta fora hoje ------------------------------------------------
--
-- REMOTO NAO E ESTAR FORA, e e a distincao inteira: quem trabalha de outro
-- lugar esta trabalhando. A mesma regra da regua de cobertura do Full Days.

insert into public.team_presence (user_id, data, status)
values (:MARINA, current_date, 'ferias'),
       (:CARLA,  current_date, 'remoto');

select teste.conferir_como('Quem esta de descanso aparece', :DIEGO,
  $q$select jsonb_array_length(public.home_summary()->'fora_hoje')::text$q$, '1');

select teste.conferir_como('E e o nome certo', :DIEGO,
  $q$select public.home_summary()->'fora_hoje'->0->>'nome'$q$, 'Marina Costa');


-- --- 4. A carga do dia, que e a unica conta de carga do produto -----------

-- 120 SAO AS DUAS FOLHAS de hoje (a etapa solta e a filha), e a mae fica de
-- fora com os 480 dela. Se a agrupadora vazar, o numero vira 600 -- e a barra
-- de carga do Bruno diz que ele tem dez horas comprometidas num dia em que
-- tem duas.
select teste.conferir('A carga de hoje soma as folhas e nao a mae',
  (select minutos_comprometidos::text from public.carga_do_dia(:BRUNO, current_date)),
  '120');

-- ETAPA SEM ESTIMATIVA ENTRA COMO ZERO E APARECE NA CONTAGEM: ela ocupa a
-- pessoa, so ninguem disse quanto. Sumir com ela faria a barra de carga dizer
-- que o dia esta livre.
insert into public.subtasks (task_id, titulo, ordem, responsavel_id, prazo, status)
values (:TDEMANDA, 'Sem estimativa', 6, :BRUNO, current_date, 'nao_iniciada');

select teste.conferir('A etapa sem estimativa e contada a parte',
  (select etapas_sem_estimativa::text from public.carga_do_dia(:BRUNO, current_date)),
  '1');

select teste.conferir('E a soma de minutos nao muda por causa dela',
  (select minutos_comprometidos::text from public.carga_do_dia(:BRUNO, current_date)),
  '120');


-- --- 5. Producao do periodo -----------------------------------------------

-- A FUNCAO COBRA GESTAO NA PRIMEIRA LINHA, e por isso ela e chamada COMO
-- alguem: rodar como dono do banco passaria por cima da unica trava que ela
-- tem, e o cenario diria que o indicador funciona sem provar quem o alcanca.
-- SETE FOLHAS PUBLICADAS deste cliente: quatro com prazo, a filha, a sem
-- estimativa, e a mae fica de fora. A do rascunho tambem. Com o filtro de
-- cliente, o numero e so meu e nao anda quando outro arquivo cresce.
select teste.conferir_como('As criadas do periodo nao contam o rascunho', :DIEGO,
  $q$select criadas::text from public.producao_do_periodo(
       current_date - 1, current_date + 1,
       '50700000-0000-0000-0000-0000000000c1')$q$, '6');

select teste.recusa_com('E o colaborador nao abre indicador de agencia', :BRUNO,
  $q$select * from public.producao_do_periodo(current_date - 1, current_date + 1)$q$,
  'apenas gestão');

-- `p_client_id` FILTRA, e o cenario existe porque um filtro que nao filtra
-- passa despercebido: o numero continua plausivel.
-- E O FILTRO FILTRA. O cenario existe porque um filtro que nao filtra passa
-- despercebido: o numero continua plausivel, so que e o da agencia inteira.
select teste.conferir_como('E o filtro por cliente vale', :DIEGO,
  $q$select case
       when (select criadas from public.producao_do_periodo(
               current_date - 1, current_date + 1,
               '50700000-0000-0000-0000-0000000000c1'))
          < (select criadas from public.producao_do_periodo(
               current_date - 1, current_date + 1))
       then 'filtra' else 'nao filtra' end$q$, 'filtra');


-- --- 6. O historico de status, que e de onde sai o tempo por etapa --------
--
-- ELE COMECA AGORA, e a 0035 diz isso no cabecalho: etapa que passou por
-- producao antes da migration nao deixou rastro, e nenhuma conta inventa o que
-- nao foi medido.

select teste.cenario('Mover a etapa grava a transicao', :BRUNO,
  format($fmt$update public.subtasks set status = 'aguardando_informacoes'
     where id = %L$fmt$, :FILHA), 'ok', 1);

select teste.conferir('E ela ficou no historico com o de-para',
  (select de_valor || '->' || para_valor from public.task_history
    where subtask_id = :FILHA and acao = 'status_da_etapa'
    order by created_at desc limit 1), 'em_andamento->aguardando_informacoes');

-- SALVAR SEM MUDAR O STATUS NAO E EVENTO DE FLUXO. Uma linha por save encheria
-- a tabela de ruido, e a aba Historico -- que le a mesma tabela -- ficaria
-- ilegivel.
select teste.cenario('Mas salvar o titulo nao grava nada', :BRUNO,
  format($fmt$update public.subtasks set titulo = 'Conceito revisado'
     where id = %L$fmt$, :FILHA), 'ok', 1);

select teste.conferir('O historico continua com uma transicao so',
  (select count(*)::text from public.task_history
    where subtask_id = :FILHA and acao = 'status_da_etapa'), '1');
