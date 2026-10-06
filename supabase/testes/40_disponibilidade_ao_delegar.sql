-- ===========================================================================
-- 40 - A DISPONIBILIDADE DE QUEM VAI RECEBER O TRABALHO (migration 0081)
--
-- A 0081 subiu inacabada, com cinco cenarios vermelhos e o cabecalho mandando
-- nao aplicar. O que faltava era a DECISAO de como a carga se mede, e ela veio
-- do usuario: etapa em branco conta 3 horas sem aparecer na tela, o expediente
-- tem 9 horas, concluir uma libera o dia, e sobrecarga avisa e nunca recusa.
--
-- OS CENARIOS DESTE ARQUIVO SAO A REGRA DELE, UM A UM. Eles existem porque
-- duas das quatro regras ja funcionavam por acidente de implementacao --
-- "concluida nao conta" e "nada recusa por carga" sao, as duas, a AUSENCIA de
-- codigo. Regra que funciona por ausencia e regra que o proximo refactor
-- apaga sem ninguem notar.
--
-- A FRASE QUE RESUME TUDO: TRES ETAPAS EM BRANCO ENCHEM UM DIA. 3h+3h+3h = 9h.
--
-- As datas moram em marco de 2027, e a escolha nao e estilo: `disponibilidade()`
-- projeta a partir de `current_date`, e um cenario datado no passado mediria
-- uma coisa hoje e outra no ano que vem. A semana de 01 a 05/03/2027 tem os
-- cinco dias uteis -- o primeiro cenario confere isso antes de qualquer conta,
-- porque um feriado entrando ali mudaria todas as outras sem dizer por que.
-- ===========================================================================

\set ANA      '''11111111-1111-1111-1111-111111111111'''
\set DIEGO    '''22222222-2222-2222-2222-222222222222'''
\set CARLA    '''33333333-3333-3333-3333-333333333333'''
\set BRUNO    '''44444444-4444-4444-4444-444444444444'''
\set MARINA   '''55555555-5555-5555-5555-555555555555'''
\set TRAFEGO  '''66666666-6666-6666-6666-666666666666'''
\set OTTO     '''88888888-8888-8888-8888-888888888888'''

\set DCLI  '''d1500000-0000-0000-0000-0000000000c1'''
\set DEM   '''d1500000-0000-0000-0000-000000000001'''
\set DRASC '''d1500000-0000-0000-0000-000000000002'''
\set DMAE  '''d1500000-0000-0000-0000-00000000000a'''

select teste.limpar();

insert into public.clients (id, nome_empresa, nome_contato, email_contato, ativo)
values (:DCLI, 'Delegar S.A.', 'Dora', 'dora@delegar.com', true)
on conflict (id) do nothing;

-- A demanda COMECA EM JANEIRO de proposito, e e ela que mostrava o bug: a
-- primeira versao caia em `tasks.data_inicio` quando a etapa nao tinha inicio
-- proprio, e aquela coluna e derivada das etapas desde a 0028 -- o menor prazo
-- da demanda inteira. A etapa herdava a janela da DEMANDA.
insert into public.tasks (id, client_id, titulo, criado_por, link_entrega, publicada_em, data_inicio)
values (:DEM,   :DCLI, 'Demanda de delegar',  :CARLA, 'https://drive.com/d1', now(), '2027-01-04'),
       (:DRASC, :DCLI, 'Rascunho de delegar', :CARLA, 'https://drive.com/d2', null,  '2027-03-01')
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 1. A SEMANA ESCOLHIDA TEM OS CINCO DIAS UTEIS
-- ---------------------------------------------------------------------------
select teste.conferir('A semana de 01 a 05/03/2027 tem cinco dias uteis',
  (select public.dias_uteis('2027-03-01', '2027-03-05')::text), '5');


-- ---------------------------------------------------------------------------
-- 2. O EXPEDIENTE DE NOVE HORAS
--
-- O default da COLUNA e o que a 0081 troca; o `coalesce` dentro da funcao e
-- outro caso -- quem nao tem ficha de equipe. Os dois dizem 540, e por isso o
-- cenario mede o catalogo e nao a conta: a conta diria 540 mesmo com o default
-- parado em 480, e o proximo cadastro nasceria com 8 horas.
-- ---------------------------------------------------------------------------
select teste.conferir('O default da capacidade e de nove horas',
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'team_members'
      and column_name = 'capacidade_minutos_dia'), '540');

-- A LINHA QUE JA EXISTIA FOI LEVADA JUNTO, e este cenario mede o `update` de
-- verdade: o fixture insere a equipe antes da 0055, entao e o
-- `add column ... not null default 480` dela que preenche todas as fichas com
-- 480 -- exatamente o estado de producao. A 0081 as encontra e leva para 540.
-- Tirando o `update`, todas ficam em 480 e este cenario cai: a decisao do
-- usuario valeria so para quem entrar amanha.
select teste.conferir('A capacidade herdada de oito horas foi para nove',
  (select capacidade_minutos_dia::text from public.team_members where user_id = :BRUNO),
  '540');

-- O QUE ESTA BATERIA NAO CONSEGUE MEDIR, e fica dito em vez de escondido: a
-- outra metade do `where`, que e meio periodo ESCOLHIDO nao ser sobrescrito.
-- Para prova-la seria preciso uma ficha em 240 no instante em que a 0081 roda,
-- e nao ha onde pô-la: o `rodar.sh` carrega o fixture depois da 0006 e a
-- coluna nasce na 0055, dezenas de migrations adiante. A garantia e o
-- `where capacidade_minutos_dia = 480` da 0081, com a razao escrita ao lado
-- dele -- e quem o tirar nao derruba cenario nenhum. Vale saber disso antes de
-- mexer ali.


-- ---------------------------------------------------------------------------
-- 3. TRES ETAPAS EM BRANCO ENCHEM UM DIA
--
-- E o exemplo do usuario, palavra por palavra: "se eu preencho o dia com 3
-- tasks em branco". Tres vezes 180 sao 540, que e o expediente -- o dia fica a
-- 100% e nao a 101% nem a 99%: e a conta fechando.
--
-- NENHUMA DELAS TEM ESTIMATIVA, e nenhuma tem `data_inicio`: a janela e o
-- proprio prazo, um dia. Quem trocar o 180 do `coalesce` por qualquer outro
-- numero derruba os dois cenarios abaixo e diz qual.
-- ---------------------------------------------------------------------------
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, status)
values ('d1500000-0000-0000-0000-000000000101', :DEM, 'Branco 1', 1, :MARINA, '2027-03-03', 'nao_iniciada'),
       ('d1500000-0000-0000-0000-000000000102', :DEM, 'Branco 2', 2, :MARINA, '2027-03-03', 'nao_iniciada'),
       ('d1500000-0000-0000-0000-000000000103', :DEM, 'Branco 3', 3, :MARINA, '2027-03-03', 'nao_iniciada')
on conflict (id) do nothing;

select teste.conferir('Tres etapas em branco somam as nove horas do dia',
  (select minutos_comprometidos::text from public.carga_do_dia(:MARINA, '2027-03-03')), '540');

--
-- OS CENARIOS QUE CHAMAM `disponibilidade()` PASSAM POR `conferir_como`, e nao
-- e zelo: ela e `security definer` com `is_staff()` na porta, e avaliada como
-- dono do banco -- sem sessao -- recusa a si mesma. A mesma pegadinha de
-- `descanso_do_ciclo()` na 0085. `carga_do_dia()` nao tem porta e por isso vai
-- por `conferir`.
select teste.conferir_como('E o dia fica exatamente a 100% da capacidade', :ANA,
  $q$select ocupacao_pct::text from public.disponibilidade(
       '55555555-5555-5555-5555-555555555555', '2027-03-03', '2027-03-03')$q$, '100');

-- O NUMERO NAO APARECE NA TELA, e e a outra metade do pedido -- "sem mostrar
-- para a pessoa". `estimativa_presumida()` saiu inteira, e o `~` que a marcava
-- saiu com ela. Se alguem a devolver, este cenario cai.
select teste.conferir('E `estimativa_presumida()` nao existe mais',
  (select count(*)::text from pg_proc where proname = 'estimativa_presumida'), '0');

-- A CONTAGEM DE QUEM NAO TEM ESTIMATIVA FICA, e e por ela que o Feedback sabe
-- que ninguem estimou -- a proporcao se declara incerta em vez de acusar
-- ociosidade (0075). Contar 180 minutos nao e a mesma coisa que ter estimado.
select teste.conferir('As tres continuam contadas como sem estimativa',
  (select etapas_sem_estimativa::text from public.carga_do_dia(:MARINA, '2027-03-03')), '3');


-- ---------------------------------------------------------------------------
-- 4. CONCLUIR UMA LIBERA O DIA, SEM O AVISO
--
-- "Se a pessoa finaliza uma delas antes do tempo, deve ja liberar para ser
-- colocadas mais tasks sem o aviso." A conta e do que esta EM ABERTO, e isso
-- e o `status <> 'concluida'` do `where` -- que estava ali desde a primeira
-- linha da funcao e nunca tinha sido medido.
-- ---------------------------------------------------------------------------
update public.subtasks set status = 'em_andamento'
 where id = 'd1500000-0000-0000-0000-000000000101';
update public.subtasks set status = 'concluida', tempo_real_minutos = 90
 where id = 'd1500000-0000-0000-0000-000000000101';

select teste.conferir('Concluida uma, sobram seis horas no dia',
  (select minutos_comprometidos::text from public.carga_do_dia(:MARINA, '2027-03-03')), '360');

select teste.conferir_como('E o dia volta a caber mais trabalho, a 67%', :ANA,
  $q$select ocupacao_pct::text from public.disponibilidade(
       '55555555-5555-5555-5555-555555555555', '2027-03-03', '2027-03-03')$q$, '67');

-- E O RETRATO HISTORICO AINDA A VE, que e a outra pergunta: o Feedback olha um
-- periodo que passou e precisa somar o que foi entregue. O parametro existe
-- para isso, e sem ele a mesma funcao responderia duas perguntas com a
-- resposta de uma.
select teste.conferir('Mas o retrato que inclui concluidas soma as tres',
  (select minutos_comprometidos::text from public.carga_do_dia(:MARINA, '2027-03-03', true)), '540');


-- ---------------------------------------------------------------------------
-- 5. A ESTIMATIVA SE DISTRIBUI PELA JANELA
--
-- E o criterio de aceite do sprint, escrito nele: "uma subtarefa de 8h com
-- janela de 5 dias uteis aparece como ~1h36 por dia, nao 8h no ultimo dia".
-- 480 / 5 = 96 minutos.
--
-- CONTAR A ESTIMATIVA INTEIRA EM CADA DIA e o que a 0035 fazia, e e o retrato
-- falso: cinco etapas de 4h vencendo na sexta mostravam 20h na sexta e a
-- semana vazia, quando na vida a pessoa trabalha nelas a semana toda.
-- ---------------------------------------------------------------------------
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, data_inicio, prazo, estimativa_minutos, status)
values ('d1500000-0000-0000-0000-000000000201', :DEM, 'Oito horas em cinco dias', 11, :BRUNO,
        '2027-03-01', '2027-03-05', 480, 'nao_iniciada')
on conflict (id) do nothing;

select teste.conferir('A etapa de 8h em cinco dias uteis da 96 minutos na segunda',
  (select minutos_comprometidos::text from public.carga_do_dia(:BRUNO, '2027-03-01')), '96');

-- O CENARIO QUE SEPARA AS DUAS IMPLEMENTACOES: contando inteira, a sexta --
-- que e o prazo -- diria 480. Ele e o unico que distingue "distribui" de
-- "soma no dia do prazo", e os outros quatro desta secao passariam nas duas.
select teste.conferir('E a sexta, que e o prazo, tambem da 96 e nao 480',
  (select minutos_comprometidos::text from public.carga_do_dia(:BRUNO, '2027-03-05')), '96');

select teste.conferir('O sabado fica de fora da distribuicao',
  (select minutos_comprometidos::text from public.carga_do_dia(:BRUNO, '2027-03-06')), '0');

-- O QUE VENCE NO DIA E A OUTRA PERGUNTA, e por isso o modo existe: a sexta
-- tem 96 minutos de carga e UMA entrega de 480. As duas sao verdade, e quem
-- monta a agenda da semana precisa das duas.
select teste.conferir_como('No modo entregas, a sexta mostra as 8h inteiras', :ANA,
  $q$select carga_minutos::text from public.disponibilidade(
       '44444444-4444-4444-4444-444444444444', '2027-03-05', '2027-03-05', 'entregas')$q$, '480');


-- ---------------------------------------------------------------------------
-- 6. A ETAPA NAO HERDA A JANELA DA DEMANDA
--
-- O BUG QUE A BATERIA ACHOU, e ele nao era expectativa errada. A primeira
-- versao escrevia `coalesce(s.data_inicio, t.data_inicio, s.prazo)`, e
-- `tasks.data_inicio` e DERIVADO das etapas desde a 0028 -- o menor prazo da
-- demanda inteira. Uma etapa sem inicio proprio passava a cobrir o periodo
-- todo da demanda: quatro etapas datadas ao longo de um mes cobriam o mes
-- cada uma, e a carga de um dia somava trinta e oito etapas em vez de quatro.
--
-- A demanda deste arquivo comeca em 04/01/2027. Sem o conserto, a etapa de
-- 20/03 ocuparia de janeiro a marco -- e o dia 10/02, que nao tem etapa
-- nenhuma, mostraria carga.
-- ---------------------------------------------------------------------------
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, estimativa_minutos, status)
values ('d1500000-0000-0000-0000-000000000301', :DEM, 'Sem inicio proprio', 21, :DIEGO,
        '2027-03-19', 600, 'nao_iniciada')
on conflict (id) do nothing;

select teste.conferir('A etapa sem inicio proprio ocupa UM dia, o do prazo',
  (select minutos_comprometidos::text from public.carga_do_dia(:DIEGO, '2027-03-19')), '600');

select teste.conferir('E nao desagua num dia de fevereiro que nao tem etapa',
  (select minutos_comprometidos::text from public.carga_do_dia(:DIEGO, '2027-02-10')), '0');

select teste.conferir('Nem conta a etapa num dia que ela nao cobre',
  (select etapas::text from public.carga_do_dia(:DIEGO, '2027-02-10')), '0');


-- ---------------------------------------------------------------------------
-- 7. SOBRECARGA AVISA, NUNCA RECUSA
--
-- "O atendimento, os socios e desenvolvedores devem poder registrar mesmo
-- assim." Nenhuma trava deste produto olha carga, e a afirmacao precisa de
-- cenario porque ela e uma AUSENCIA: o dia que ninguem vigia e o dia em que
-- alguem acrescenta um `if` achando que esta protegendo a pessoa.
-- ---------------------------------------------------------------------------
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, estimativa_minutos, status)
values ('d1500000-0000-0000-0000-000000000401', :DEM, 'A quarta no dia cheio', 31, :MARINA,
        '2027-03-03', 600, 'nao_iniciada')
on conflict (id) do nothing;

select teste.conferir_como('O dia passa de 100% e o banco aceita a etapa', :ANA,
  $q$select case when ocupacao_pct > 100 then 'passou de 100' else ocupacao_pct::text end
       from public.disponibilidade(
         '55555555-5555-5555-5555-555555555555', '2027-03-03', '2027-03-03')$q$,
  'passou de 100');

-- E A SEGUNDA METADE DA FRASE NAO TEM A QUEM RECUSAR, que e a lição da 0060:
-- quem distribui trabalho e `is_atendimento()` desde a 0006 -- Atendimento
-- mais gestao, que sao exatamente os tres que ele nomeou.
select teste.conferir_como('O Atendimento registra no dia cheio sem recusa', :CARLA,
  $q$insert into public.subtasks (task_id, titulo, ordem, responsavel_id, prazo, estimativa_minutos)
     values ('d1500000-0000-0000-0000-000000000001', 'A quinta no dia cheio', 32,
             '55555555-5555-5555-5555-555555555555', '2027-03-03', 600)
     returning 'gravou'$q$,
  'gravou');


-- ---------------------------------------------------------------------------
-- 8. A ETAPA VENCIDA COMPETE POR HOJE AO DELEGAR, E NAO NO RETRATO
--
-- As duas portas fazem perguntas diferentes, e e a unica coisa que as separa.
-- Projetando, a etapa que passou do prazo continua pendente e disputa o tempo
-- de HOJE -- esconde-la e o jeito mais facil de sobrecarregar alguem sem
-- perceber. Olhando para tras, isso e falso: o que aconteceu aconteceu.
--
-- Foi este par que a primeira rodada da 0081 errou nos dois sentidos: sem o
-- parametro, toda etapa vencida da agencia desaguava no dia de hoje e o
-- retrato historico do Feedback herdava isso.
-- ---------------------------------------------------------------------------
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, estimativa_minutos, status)
values ('d1500000-0000-0000-0000-000000000501', :DEM, 'Venceu e ninguem fez', 41, :TRAFEGO,
        current_date - 30, 120, 'nao_iniciada')
on conflict (id) do nothing;

select teste.conferir_como('Ao delegar, a etapa vencida aparece no dia de hoje', :ANA,
  $q$select carga_minutos::text from public.disponibilidade(
       '66666666-6666-6666-6666-666666666666', current_date, current_date)$q$, '120');

select teste.conferir('E no retrato de hoje ela nao esta, porque o prazo passou',
  (select minutos_comprometidos::text from public.carga_do_dia(:TRAFEGO, current_date)), '0');


-- ---------------------------------------------------------------------------
-- 9. O QUE FICA DE FORA DA CONTA
-- ---------------------------------------------------------------------------
--
-- RASCUNHO NAO ENTRA EM INDICADOR NENHUM (0028), e o filtro e `publicada_em`
-- e nao um status: `rascunho` nunca foi valor do enum.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, estimativa_minutos, status)
values ('d1500000-0000-0000-0000-000000000601', :DRASC, 'Etapa de rascunho', 1, :DIEGO,
        '2027-03-12', 480, 'nao_iniciada')
on conflict (id) do nothing;

select teste.conferir('A etapa de um rascunho nao entra na carga de ninguem',
  (select minutos_comprometidos::text from public.carga_do_dia(:DIEGO, '2027-03-12')), '0');

-- AGRUPADORA NAO E UNIDADE DE TRABALHO: quem mede sao as filhas (0022).
-- Contar as duas faria a mae somar duas vezes o mesmo trabalho, que e a conta
-- dobrada que este produto recusa em toda soma.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, estimativa_minutos, status)
values (:DMAE, :DEM, 'A mae', 51, :DIEGO, '2027-03-26', 900, 'nao_iniciada')
on conflict (id) do nothing;

insert into public.subtasks (id, task_id, parent_id, titulo, ordem, responsavel_id, prazo, estimativa_minutos, status)
values ('d1500000-0000-0000-0000-00000000000b', :DEM, :DMAE, 'A filha', 52, :DIEGO,
        '2027-03-26', 300, 'nao_iniciada')
on conflict (id) do nothing;

select teste.conferir('A carga do dia soma a filha e nao a mae',
  (select minutos_comprometidos::text from public.carga_do_dia(:DIEGO, '2027-03-26')), '300');

select teste.conferir('E a mae nao aparece na contagem de etapas',
  (select etapas::text from public.carga_do_dia(:DIEGO, '2027-03-26')), '1');


-- ---------------------------------------------------------------------------
-- 10. AS DUAS PORTAS, E A CONTA QUE NAO TEM PORTA
--
-- `disponibilidade_bruta()` devolve TITULO E CLIENTE das etapas de outra
-- pessoa. Sem o revoke, ela seria a agenda da equipe inteira ao alcance de
-- quem tiver a chave anon -- que vai no bundle que o navegador baixa.
--
-- O CENARIO MEDE PRIVILEGIO E NAO MENSAGEM, pela razao do arquivo 36: uma
-- funcao pode recusar por dentro e continuar executavel, e aí o que se mediu
-- foi o corpo dela e nao a porta.
-- ---------------------------------------------------------------------------
select teste.tem_execute('A conta crua nao e chamavel por quem tem a chave anon',
  'anon', 'public.disponibilidade_bruta(uuid, date, date, text, boolean, boolean)', false);

select teste.tem_execute('Nem por quem esta logado',
  'authenticated', 'public.disponibilidade_bruta(uuid, date, date, text, boolean, boolean)', false);

select teste.tem_execute('E a porta de delegar e, porque ela pergunta is_staff()',
  'authenticated', 'public.disponibilidade(uuid, date, date, text, boolean, boolean)', true);

-- O CLIENTE NAO CONSULTA A AGENDA DE NINGUEM. A guarda e `is_staff()`, e sem
-- ela `security definer` entregaria titulo e cliente das etapas da equipe.
select teste.recusa_com('O cliente leva recusa na porta de delegar', :OTTO,
  $q$select count(*) from public.disponibilidade(
       '55555555-5555-5555-5555-555555555555', '2027-03-01', '2027-03-05')$q$,
  'Só a equipe interna consulta');

-- E O TETO DE 120 DIAS, que e a unica recusa desta funcao -- e e sobre o
-- tamanho do periodo pedido, nunca sobre quanto trabalho a pessoa tem.
select teste.recusa_com_dica('Um ano de uma vez e recusado, com o que fazer no lugar', :ANA,
  $q$select * from public.disponibilidade(
       '55555555-5555-5555-5555-555555555555', '2027-01-01', '2027-12-31')$q$,
  'O calendário pede um mês por vez.');
