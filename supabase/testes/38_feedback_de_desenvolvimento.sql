\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

-- ===========================================================================
-- SPRINT 3H -- FEEDBACK DE DESENVOLVIMENTO ASSISTIDO POR IA (0075)
--
-- O CRITERIO QUE ATRAVESSA O ARQUIVO: **um rascunho vazado e pior que nenhum
-- feedback**. A pessoa nao pode ler o texto que a gestao ainda esta
-- revisando -- inclusive um que vai ser descartado por estar errado sobre
-- ela. Isso vale para os cinco status que nao sao `enviado`, e vale pela
-- policy e nao pela tela: a bateria pergunta ao banco como a pessoa.
--
-- A segunda metade do arquivo mede as CONTAS, e aqui um erro nao estoura --
-- uma metrica errada so mostra outro numero. Por isso todo cenario compara
-- um valor exato, num cliente e num periodo que sao so deste arquivo.
-- ===========================================================================

\set FCLI    '''50750000-0000-0000-0000-0000000000c1'''
\set FPUB    '''50750000-0000-0000-0000-000000000001'''
\set FRASC   '''50750000-0000-0000-0000-000000000002'''
\set FMAE    '''50750000-0000-0000-0000-00000000000a'''
\set FFILHA  '''50750000-0000-0000-0000-00000000000b'''
\set REL_ENV '''50750000-0000-0000-0000-0000000000e1'''
\set REL_RAS '''50750000-0000-0000-0000-0000000000e2'''
\set REL_OUT '''50750000-0000-0000-0000-0000000000e3'''

-- O PERIODO E FIXO E NO PASSADO, e isso e deliberado. `current_date` como
-- inicio faria o periodo anterior cair em cima do que outros arquivos da
-- bateria criam, e os numeros mudariam quando o arquivo 19 crescesse -- a
-- licao que o 23 registrou. Aqui o mes e um mes que ninguem mais usa.
\set P_DE    '''2027-04-01'''
\set P_ATE   '''2027-04-30'''

insert into public.clients (id, nome_empresa, nome_contato, email_contato, ativo, slug)
values (:FCLI, 'Feedback SA', 'Teste', 'teste@fb.com', true, 'feedback-sa')
on conflict (id) do nothing;

insert into public.tasks (id, client_id, titulo, criado_por, link_entrega, publicada_em)
values (:FPUB,  :FCLI, 'Demanda do feedback',  :ANA, 'https://drive.com/fb1', now()),
       (:FRASC, :FCLI, 'Rascunho do feedback', :ANA, 'https://drive.com/fb2', null)
on conflict (id) do nothing;

-- A CARLA e a pessoa medida. Cinco folhas concluidas em abril de 2027: tres
-- no prazo, uma fora, e uma sem prazo -- que e o caso que a taxa deixa de
-- fora, e nao conta como acerto.
insert into public.subtasks (task_id, titulo, ordem, responsavel_id, prazo, status,
                             concluida_em, estimativa_minutos, tempo_real_minutos)
values
  (:FPUB, 'Entregue no prazo 1', 1, :CARLA, '2027-04-10', 'concluida', '2027-04-09', 120, 150),
  (:FPUB, 'Entregue no prazo 2', 2, :CARLA, '2027-04-15', 'concluida', '2027-04-15',  60,  90),
  (:FPUB, 'Entregue no prazo 3', 3, :CARLA, '2027-04-20', 'concluida', '2027-04-18', 120, 120),
  (:FPUB, 'Entregue com atraso', 4, :CARLA, '2027-04-05', 'concluida', '2027-04-09', 120, 240),
  (:FPUB, 'Entregue sem prazo',  5, :CARLA, null,         'concluida', '2027-04-22',  60,  60),
  -- O periodo ANTERIOR (marco de 2027): duas concluidas, as duas no prazo.
  -- Sao elas que fazem a comparacao consigo mesma ter um numero.
  (:FPUB, 'De marco 1',          6, :CARLA, '2027-03-10', 'concluida', '2027-03-09', 60, 60),
  (:FPUB, 'De marco 2',          7, :CARLA, '2027-03-20', 'concluida', '2027-03-19', 60, 60),
  -- A DO RASCUNHO. Se `publicada_em is not null` cair de qualquer consulta
  -- deste modulo, `concluidas` vira 6 e o cenario diz qual.
  (:FRASC, 'Do rascunho',        1, :CARLA, '2027-04-11', 'concluida', '2027-04-11', 480, 960)
on conflict do nothing;

-- A AGRUPADORA E A FILHA. A mae tem estimativa e tempo gravados, e os dois
-- param de contar no instante em que ela ganha filha (0022). Sem a exclusao,
-- o mesmo trabalho entraria duas vezes na soma de minutos.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, prazo, status,
                             concluida_em, estimativa_minutos, tempo_real_minutos)
values (:FMAE, :FPUB, 'Arte do feedback', 8, :CARLA, '2027-04-25', 'concluida',
        '2027-04-25', 600, 600)
on conflict (id) do nothing;

insert into public.subtasks (id, task_id, parent_id, titulo, ordem, responsavel_id, prazo,
                             status, concluida_em, estimativa_minutos, tempo_real_minutos)
values (:FFILHA, :FPUB, :FMAE, 'Conceito do feedback', 1, :CARLA, '2027-04-24',
        'concluida', '2027-04-24', 60, 60)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 1. UM RASCUNHO VAZADO E PIOR QUE NENHUM FEEDBACK
-- ---------------------------------------------------------------------------

insert into public.feedback_reports
  (id, user_id, periodo_inicio, periodo_fim, metricas_json, contexto_json,
   texto_gerado, texto_final, status, revisado_por, revisado_em, enviado_em)
values
  (:REL_ENV, :CARLA, :P_DE, :P_ATE, '{"entrega":{"concluidas":5}}', '{}',
   'Texto gerado pela IA.', 'Texto revisado pela gestão.', 'enviado',
   :ANA, now(), now()),
  (:REL_RAS, :CARLA, '2027-03-01', '2027-03-31', '{"entrega":{"concluidas":2}}', '{}',
   'Rascunho que a gestão ainda está lendo.', null, 'rascunho', null, null, null),
  (:REL_OUT, :BRUNO, :P_DE, :P_ATE, '{"entrega":{"concluidas":9}}', '{}',
   'Texto sobre o Bruno.', 'Texto sobre o Bruno.', 'enviado', :ANA, now(), now())
on conflict (id) do nothing;

select teste.conferir_como('A pessoa le o feedback dela que foi enviado', :CARLA,
  $q$select count(*)::text from public.feedback_reports where status = 'enviado' and user_id = '33333333-3333-3333-3333-333333333333'$q$,
  '1');

-- O CENARIO CENTRAL DO ARQUIVO. Tirando `and status = 'enviado'` da policy,
-- ele passa a devolver 2 e diz exatamente o que vazou.
select teste.conferir_como('E NAO le o rascunho que a gestao esta revisando', :CARLA,
  $q$select count(*)::text from public.feedback_reports where user_id = '33333333-3333-3333-3333-333333333333'$q$,
  '1');

select teste.conferir_como('Nem pelo texto: o rascunho nao volta em select nenhum', :CARLA,
  $q$select coalesce(string_agg(coalesce(texto_gerado, ''), '|'), '(nada)') from public.feedback_reports$q$,
  'Texto gerado pela IA.');

select teste.conferir_como('E nao le o feedback de um colega', :CARLA,
  $q$select count(*)::text from public.feedback_reports where user_id = '44444444-4444-4444-4444-444444444444'$q$,
  '0');

select teste.conferir_como('A gestao le os tres', :ANA,
  $q$select count(*)::text from public.feedback_reports where id in ('50750000-0000-0000-0000-0000000000e1','50750000-0000-0000-0000-0000000000e2','50750000-0000-0000-0000-0000000000e3')$q$,
  '3');

-- OS QUATRO OUTROS STATUS TAMBEM SAO INVISIVEIS, e nao so `rascunho`. A
-- primeira versao deste cenario media um status so, e uma policy escrita como
-- `status <> 'rascunho'` passaria nele -- deixando `gerando`, `revisado` e
-- `descartado` vazarem.
select teste.cenario('A gestao move o relatorio para revisado', :ANA,
  $q$update public.feedback_reports set status = 'revisado' where id = '50750000-0000-0000-0000-0000000000e2'$q$,
  'ok');
select teste.conferir_como('Revisado ainda nao e da pessoa', :CARLA,
  $q$select count(*)::text from public.feedback_reports where user_id = '33333333-3333-3333-3333-333333333333'$q$,
  '1');

select teste.cenario('A gestao descarta o relatorio', :ANA,
  $q$update public.feedback_reports set status = 'descartado' where id = '50750000-0000-0000-0000-0000000000e2'$q$,
  'ok');
select teste.conferir_como('Descartado nunca chega a pessoa', :CARLA,
  $q$select count(*)::text from public.feedback_reports where user_id = '33333333-3333-3333-3333-333333333333'$q$,
  '1');

select teste.cenario('A gestao devolve o relatorio para rascunho', :ANA,
  $q$update public.feedback_reports set status = 'rascunho' where id = '50750000-0000-0000-0000-0000000000e2'$q$,
  'ok');

-- A PESSOA NAO ESCREVE RELATORIO, nem sobre si mesma: quem gera e a gestao.
select teste.cenario('A pessoa nao cria relatorio sobre si', :CARLA,
  $q$insert into public.feedback_reports (user_id, periodo_inicio, periodo_fim, metricas_json, contexto_json, status) values ('33333333-3333-3333-3333-333333333333', '2027-05-01', '2027-05-31', '{}', '{}', 'enviado')$q$,
  'recusa');

-- E NAO REESCREVE O QUE FOI DITO SOBRE ELA. O caminho e responder, que e a
-- proxima secao -- discordar fica no historico, nao apaga o texto.
select teste.cenario('A pessoa nao reescreve o feedback dela', :CARLA,
  $q$update public.feedback_reports set texto_final = 'outro texto' where id = '50750000-0000-0000-0000-0000000000e1'$q$,
  'ok', 0);

select teste.cenario('O colaborador nao apaga relatorio', :CARLA,
  $q$delete from public.feedback_reports where id = '50750000-0000-0000-0000-0000000000e1'$q$,
  'ok', 0);


-- ---------------------------------------------------------------------------
-- 2. RESPONDER E DIREITO, E A RESPOSTA NAO SE APAGA
--
-- Feedback sem direito de resposta e comunicado, nao feedback. E por isso a
-- resposta nao tem policy de UPDATE nem de DELETE: ela e o registro de que a
-- pessoa discordou, e reescreve-la depois apagaria a discordancia.
-- ---------------------------------------------------------------------------

select teste.cenario('A pessoa responde ao feedback dela', :CARLA,
  $q$insert into public.feedback_replies (report_id, autor_id, texto) values ('50750000-0000-0000-0000-0000000000e1', '33333333-3333-3333-3333-333333333333', 'Nesse mês eu peguei duas campanhas fora do combinado.')$q$,
  'ok');

select teste.cenario('E a gestao responde de volta', :ANA,
  $q$insert into public.feedback_replies (report_id, autor_id, texto) values ('50750000-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'Faz sentido, vamos rever a distribuição.')$q$,
  'ok');

select teste.conferir_como('A conversa aparece para a pessoa', :CARLA,
  $q$select count(*)::text from public.feedback_replies where report_id = '50750000-0000-0000-0000-0000000000e1'$q$,
  '2');

-- ASSINAR NO NOME DE OUTRA PESSOA E RECUSADO pelo `with check`, e nao
-- corrigido em silencio: aqui, ao contrario de `comments_normaliza`, a autoria
-- da resposta e o proprio conteudo dela.
select teste.cenario('Ninguem responde no nome de outra pessoa', :CARLA,
  $q$insert into public.feedback_replies (report_id, autor_id, texto) values ('50750000-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'assinado pela gestao')$q$,
  'recusa');

-- RESPONDER NUM RASCUNHO SERIA A PORTA DOS FUNDOS para descobrir que existe
-- um rascunho sobre ela. Sem o `and r.status = 'enviado'` no `with check`, este
-- insert passa -- e o erro que ele NAO daria contaria a novidade.
select teste.cenario('Nao se responde a um rascunho que nao se pode ler', :CARLA,
  $q$insert into public.feedback_replies (report_id, autor_id, texto) values ('50750000-0000-0000-0000-0000000000e2', '33333333-3333-3333-3333-333333333333', 'vi o rascunho')$q$,
  'recusa');

select teste.cenario('Nem a autora reescreve a resposta dela', :CARLA,
  $q$update public.feedback_replies set texto = 'reescrito' where autor_id = '33333333-3333-3333-3333-333333333333'$q$,
  'recusa');

select teste.cenario('Nem o socio apaga uma resposta', :ANA,
  $q$delete from public.feedback_replies where report_id = '50750000-0000-0000-0000-0000000000e1'$q$,
  'recusa');

select teste.cenario('Resposta em branco nao e resposta', :CARLA,
  $q$insert into public.feedback_replies (report_id, autor_id, texto) values ('50750000-0000-0000-0000-0000000000e1', '33333333-3333-3333-3333-333333333333', '   ')$q$,
  'recusa');


-- ---------------------------------------------------------------------------
-- 3. OS ALERTAS DE CARGA SAO DA GESTAO, E A PESSOA NAO OS VE
--
-- Um alerta de sobrecarga na tela dela viraria cobranca por uma decisao que
-- nao foi dela. O que e dela chega pelo feedback, relativizado.
-- ---------------------------------------------------------------------------

insert into public.workload_alerts (user_id, periodo_inicio, periodo_fim, tipo, detalhes)
values (:CARLA, :P_DE, :P_ATE, 'sobrecarga', '{"proporcao": 148.0}')
on conflict (user_id, periodo_inicio, tipo) do nothing;

select teste.conferir_como('A gestao ve o alerta de sobrecarga', :ANA,
  $q$select count(*)::text from public.workload_alerts where user_id = '33333333-3333-3333-3333-333333333333' and periodo_inicio = '2027-04-01'$q$,
  '1');

select teste.conferir_como('A pessoa NAO ve o alerta sobre ela mesma', :CARLA,
  $q$select count(*)::text from public.workload_alerts$q$,
  '0');

select teste.cenario('A pessoa nao escreve alerta', :CARLA,
  $q$insert into public.workload_alerts (user_id, periodo_inicio, periodo_fim, tipo, detalhes) values ('33333333-3333-3333-3333-333333333333', '2027-05-01', '2027-05-31', 'ociosidade', '{}')$q$,
  'recusa');

select teste.cenario('Nem o socio apaga um alerta: o caminho e resolver', :ANA,
  $q$delete from public.workload_alerts where user_id = '33333333-3333-3333-3333-333333333333'$q$,
  'recusa');

select teste.cenario('Tipo de alerta que o produto nao conhece e recusado', :ANA,
  $q$insert into public.workload_alerts (user_id, periodo_inicio, periodo_fim, tipo, detalhes) values ('44444444-4444-4444-4444-444444444444', '2027-04-01', '2027-04-30', 'desmotivacao', '{}')$q$,
  'recusa');


-- ---------------------------------------------------------------------------
-- 4. A CONFIGURACAO: A EQUIPE LE, SO O SOCIO ESCREVE
--
-- `exige_revisao` decide se um texto de maquina vai direto para uma pessoa, e
-- isso e decisao de quem responde pela agencia -- a razao da fila de notas.
-- ---------------------------------------------------------------------------

select teste.conferir('A revisao humana nasce EXIGIDA',
  (select exige_revisao::text from public.feedback_config), 'true');

select teste.conferir('E o minimo de etapas nasce em cinco',
  (select minimo_subtarefas::text from public.feedback_config), '5');

select teste.conferir_como('O colaborador le a configuracao', :CARLA,
  $q$select count(*)::text from public.feedback_config$q$, '1');

select teste.cenario('O colaborador nao desliga a revisao humana', :CARLA,
  $q$update public.feedback_config set exige_revisao = false$q$, 'ok', 0);

-- O DESENVOLVEDOR E GESTAO PARA O RESTO DO SISTEMA E AQUI NAO, como no
-- Financeiro e na fila de notas.
select teste.cenario('Nem o desenvolvedor desliga a revisao humana', :DIEGO,
  $q$update public.feedback_config set exige_revisao = false$q$, 'ok', 0);

select teste.cenario('O socio desliga, e e ele quem responde por isso', :ANA,
  $q$update public.feedback_config set exige_revisao = false$q$, 'ok');

select teste.cenario('E religa', :ANA,
  $q$update public.feedback_config set exige_revisao = true$q$, 'ok');

select teste.cenario('Nao existe uma segunda linha de configuracao', :ANA,
  $q$insert into public.feedback_config (unica) values (true)$q$, 'recusa');

select teste.cenario('E a linha nao se apaga', :ANA,
  $q$delete from public.feedback_config$q$, 'recusa');


-- ---------------------------------------------------------------------------
-- 5. AS METRICAS SAO DA GESTAO, E A IA NAO CALCULA NADA
-- ---------------------------------------------------------------------------

select teste.recusa_com('O colaborador nao calcula as metricas de ninguem', :CARLA,
  $q$select public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30')$q$,
  'gestão');

-- CINCO FOLHAS, e nao seis nem sete: a do rascunho fica fora, e a agrupadora
-- tambem -- a filha dela conta, que e a folha.
select teste.conferir_como('Cinco folhas concluidas, e a filha da agrupadora conta', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'entrega' ->> 'concluidas')$q$,
  '6');

select teste.conferir_como('A agrupadora NAO conta', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'por_workflow' -> 0 ->> 'concluidas')$q$,
  '6');

-- A TAXA NO PRAZO DEIXA DE FORA QUEM NAO TEM PRAZO. Cinco com prazo, quatro
-- dentro: 80%. Somando a sem prazo como acerto daria 83,3% -- e a taxa subiria
-- exatamente onde ninguem combinou data.
select teste.conferir_como('A taxa no prazo nao conta a etapa sem prazo', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'entrega' ->> 'taxa_no_prazo')$q$,
  '80.0');

select teste.conferir_como('E a sem prazo aparece, em vez de sumir', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'entrega' ->> 'sem_prazo')$q$,
  '1');

select teste.conferir_como('Media de dias de atraso: quatro dias na unica atrasada', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'entrega' ->> 'dias_de_atraso_media')$q$,
  '4.0');

-- A UNICA COMPARACAO PERMITIDA. O periodo anterior tem o MESMO comprimento e
-- termina no dia antes. Abril tem 30 dias, entao o anterior vai de 02/03 a
-- 31/03 -- e nao o mes de marco inteiro, que teria 31.
select teste.conferir_como('O periodo anterior tem o mesmo comprimento', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'periodo_anterior' ->> 'inicio')$q$,
  '2027-03-02');

select teste.conferir_como('E ele traz as concluidas do periodo anterior', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'periodo_anterior' ->> 'concluidas')$q$,
  '2');

-- A CALIBRACAO. Estimado 540 (120+60+120+120+60+60 da filha), real 720
-- (150+90+120+240+60+60): 33,3% acima.
select teste.conferir_como('O desvio de estimativa vem em pontos percentuais', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'calibracao' ->> 'desvio_percentual')$q$,
  '33.3');

-- A TENDENCIA E A PALAVRA, e nao o sinal: "subestima" e o que a pessoa
-- reconhece. A faixa de 10% no meio existe para um desvio de 3% nao ser
-- chamado de tendencia.
select teste.conferir_como('E a tendencia vem escrita', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'calibracao' ->> 'tendencia')$q$,
  'subestima');

-- QUEM NAO TEM O QUE MEDIR VOLTA NULO, e nao zero: zero e uma afirmacao sobre
-- a conta, e o que se quer dizer e que ninguem mediu. A decisao de
-- `receita_por_hora` na 0035.
select teste.conferir_como('Periodo sem entrega devolve taxa NULA, nao zero', :ANA,
  $q$select coalesce((public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-01-01', '2027-01-31') -> 'entrega' ->> 'taxa_no_prazo'), '(nulo)')$q$,
  '(nulo)');

-- O RASCUNHO. Este e o cenario que cai se `publicada_em is not null` sair de
-- qualquer ramo: a etapa do rascunho custou 960 minutos reais, e o total
-- pularia de 720 para 1680.
select teste.conferir_como('Os minutos reais nao trazem a etapa do rascunho', :ANA,
  $q$select (public.feedback_metricas('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'entrega' ->> 'minutos_reais')$q$,
  '720');


-- ---------------------------------------------------------------------------
-- 6. O CONTEXTO E O QUE IMPEDE A LEITURA ERRADA
--
-- A metade do modulo que evita o dano: os numeros de entrega, sozinhos,
-- cobram de quem esteve fora metade do mes.
-- ---------------------------------------------------------------------------

select teste.recusa_com('O colaborador nao calcula o contexto de ninguem', :CARLA,
  $q$select public.feedback_contexto('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30')$q$,
  'gestão');

-- A CARGA DE UM PERIODO FECHADO TEM NUMERO, em vez de zero -- e este cenario e
-- o que prova o terceiro argumento da `carga_do_dia()`. Trocando aquele `true`
-- por `false`, ele devolve 0 e o feedback passa a dizer a quem entregou o mes
-- inteiro que a entrega baixa dela foi distribuicao de trabalho.
--
-- SAO 300 MINUTOS, e a conta explica o que a funcao deixa de fora: das etapas
-- da Carla em abril, a de 10/04 cai num sabado e a filha da agrupadora em
-- 24/04 tambem (a carga so olha dia util), a sem prazo nao entra em dia nenhum
-- -- nao da para alocar o que ninguem datou -- e a agrupadora nunca conta.
-- Sobram 60 + 120 + 120.
select teste.conferir_como('A carga de um mes fechado nao e zero', :ANA,
  $q$select (public.feedback_contexto('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'carga' ->> 'minutos_comprometidos')$q$,
  '300');

-- E COM POUCO TRABALHO DATADO, A RESSALVA DE OCIOSIDADE SAI -- e esta certa:
-- 300 minutos em 21 dias uteis e 3% da capacidade dela.
select teste.conferir_como('Carga baixa de verdade vira ressalva de ociosidade', :ANA,
  $q$select (public.feedback_contexto('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'ressalvas' ->> 0)$q$,
  'A carga atribuída a esta pessoa no período foi de 3.0% da capacidade dela. Entrega baixa aqui é distribuição de trabalho, não desempenho.');

-- DEZ DIAS FORA em abril de 2027, que tem 22 uteis: 45%.
insert into public.team_presence (user_id, data, status)
select :CARLA, d::date, 'ferias'
  from generate_series('2027-04-05'::date, '2027-04-16'::date, interval '1 day') d
 where extract(isodow from d) < 6
on conflict (user_id, data) do update set status = 'ferias';

select teste.conferir_como('Dez dias fora aparecem na contagem', :ANA,
  $q$select (public.feedback_contexto('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'ausencia' ->> 'dias_fora')$q$,
  '10');

-- A RESSALVA NASCE COM O FATO, e e uma frase pronta em portugues -- nao um
-- numero que o modelo precise interpretar na direcao certa. Tirando o bloco
-- das ressalvas, este cenario cai e diz que o texto passou a ser escrito sem
-- a instrucao de relativizar.
select teste.conferir_como('E viram uma ressalva escrita, para o texto relativizar', :ANA,
  $q$select ((public.feedback_contexto('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'ressalvas' ->> 0) like '%esteve fora 10 dos 21 dias úteis%')::text$q$,
  'true');

-- FERIADO NAO E AUSENCIA DE NINGUEM -- e um fato sobre o dia. Sem a lista
-- fechada de tres status, o Natal viraria um dia de ausencia da pessoa.
insert into public.team_presence (user_id, data, status)
values (:CARLA, '2027-04-21', 'feriado')
on conflict (user_id, data) do update set status = 'feriado';

select teste.conferir_como('Feriado nao conta como ausencia dela', :ANA,
  $q$select (public.feedback_contexto('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'ausencia' ->> 'dias_fora')$q$,
  '10');

-- A CAPACIDADE E POR PESSOA, e vem de `team_members` -- meio periodo existe, e
-- mudar contrato nao pode exigir deploy (0055).
select teste.conferir_como('A capacidade diaria vem da ficha da pessoa', :ANA,
  $q$select (public.feedback_contexto('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30') -> 'carga' ->> 'capacidade_minutos_dia')$q$,
  '480');


-- ---------------------------------------------------------------------------
-- 6b. A PROPORCAO SE DECLARA INCERTA EM VEZ DE ACUSAR OCIOSIDADE
--
-- E A TRAVA QUE EVITA O PIOR DANO DO MODULO. Num periodo em que ninguem
-- preencheu estimativa, `carga_do_dia()` soma quase zero, a proporcao cai
-- abaixo de 50% e a ressalva de ociosidade diz a pessoa que a entrega baixa
-- dela foi distribuicao de trabalho -- quando a verdade e que a agencia nao
-- estimou. A conta se recusa a responder, como `receita_por_hora` na 0035.
--
-- O BRUNO E O CASO: quatro etapas datadas em maio de 2027, nenhuma com
-- estimativa. Tirando a guarda, `proporcao` volta a ser 0.0 e os dois cenarios
-- abaixo caem juntos.
-- ---------------------------------------------------------------------------

insert into public.subtasks (task_id, titulo, ordem, responsavel_id, prazo, status, concluida_em)
values (:FPUB, 'Sem estimativa 1', 21, :BRUNO, '2027-05-04', 'concluida', '2027-05-04'),
       (:FPUB, 'Sem estimativa 2', 22, :BRUNO, '2027-05-11', 'concluida', '2027-05-11'),
       (:FPUB, 'Sem estimativa 3', 23, :BRUNO, '2027-05-18', 'concluida', '2027-05-18'),
       (:FPUB, 'Sem estimativa 4', 24, :BRUNO, '2027-05-25', 'concluida', '2027-05-25')
on conflict do nothing;

select teste.conferir_como('As quatro etapas sem estimativa aparecem na contagem', :ANA,
  $q$select (public.feedback_contexto('44444444-4444-4444-4444-444444444444', '2027-05-01', '2027-05-31') -> 'carga' ->> 'etapas_sem_estimativa')$q$,
  '4');

select teste.conferir_como('E a proporcao volta NULA, nao zero', :ANA,
  $q$select coalesce((public.feedback_contexto('44444444-4444-4444-4444-444444444444', '2027-05-01', '2027-05-31') -> 'carga' ->> 'proporcao_da_capacidade'), '(nulo)')$q$,
  '(nulo)');

select teste.conferir_como('Entao nao ha ressalva de ociosidade sobre ele', :ANA,
  $q$select jsonb_array_length(public.feedback_contexto('44444444-4444-4444-4444-444444444444', '2027-05-01', '2027-05-31') -> 'ressalvas')::text$q$,
  '0');

-- E O ALERTA DE OCIOSIDADE TAMBEM NAO NASCE, que e a outra metade: sem a
-- guarda, a gestao veria no Pulso da agencia um alerta sobre uma pessoa que
-- entregou quatro etapas.
select teste.cenario('Grava os alertas do Bruno', :ANA,
  $q$select public.registrar_alertas_de_carga('44444444-4444-4444-4444-444444444444', '2027-05-01', '2027-05-31')$q$,
  'ok');

select teste.conferir_como('E nenhum alerta de ociosidade nasceu', :ANA,
  $q$select count(*)::text from public.workload_alerts where user_id = '44444444-4444-4444-4444-444444444444' and tipo = 'ociosidade'$q$,
  '0');


-- ---------------------------------------------------------------------------
-- 7. A FILA: QUEM OPTOU POR NAO RECEBER NAO APARECE
-- ---------------------------------------------------------------------------

select teste.recusa_com('O colaborador nao abre a fila de feedback', :CARLA,
  $q$select * from public.quem_recebe_feedback('2027-04-01', '2027-04-30')$q$,
  'gestão');

select teste.conferir_como('A Carla esta na fila, com as seis folhas dela', :ANA,
  $q$select concluidas::text from public.quem_recebe_feedback('2027-04-01', '2027-04-30') where user_id = '33333333-3333-3333-3333-333333333333'$q$,
  '6');

select teste.conferir_como('E ela ja tem relatorio do periodo', :ANA,
  $q$select ja_tem::text from public.quem_recebe_feedback('2027-04-01', '2027-04-30') where user_id = '33333333-3333-3333-3333-333333333333'$q$,
  'true');

-- OPTAR POR NAO RECEBER TIRA A PESSOA DA FILA, e nao a deixa desligada: uma
-- linha cinza com o nome dela contaria a gestao uma escolha pessoal que nao
-- decide nada ali.
-- O CENARIO QUE ACHOU O FURO. Na primeira versao ele era um `update` direto em
-- `team_members`, passava como 'ok' -- e nao mexia em nada, porque aquela
-- tabela e `is_gestor()` desde o Sprint 2. A checagem seguinte e que mostrou:
-- a pessoa dizia que nao queria receber e continuava na fila.
select teste.cenario('A pessoa nao mexe na ficha dela direto', :CARLA,
  $q$update public.team_members set recebe_feedback_ia = false where user_id = '33333333-3333-3333-3333-333333333333'$q$,
  'ok', 0);

select teste.cenario('A pessoa opta por nao receber, pela funcao', :CARLA,
  $q$select public.escolher_receber_feedback(false)$q$,
  'ok');

select teste.conferir_como('E sai da fila', :ANA,
  $q$select count(*)::text from public.quem_recebe_feedback('2027-04-01', '2027-04-30') where user_id = '33333333-3333-3333-3333-333333333333'$q$,
  '0');

select teste.cenario('E volta quando quiser: a escolha e reversivel', :CARLA,
  $q$select public.escolher_receber_feedback(true)$q$,
  'ok');

-- E A FUNCAO SO ALCANCA A PROPRIA LINHA. Sem essa trava, `security definer`
-- seria a porta que deixa alguem desligar o feedback de um colega -- e o dele
-- pararia de ser gerado sem ninguem notar.
select teste.cenario('A Carla desliga o dela e nao o do Bruno', :CARLA,
  $q$select public.escolher_receber_feedback(false)$q$, 'ok');
select teste.conferir('O Bruno continua recebendo',
  (select recebe_feedback_ia::text from public.team_members
    where user_id = '44444444-4444-4444-4444-444444444444'), 'true');
select teste.cenario('E a Carla volta', :CARLA,
  $q$select public.escolher_receber_feedback(true)$q$, 'ok');

-- A EXPLICACAO SO SE MARCA UMA VEZ: a data e quando ela soube, e nao quando
-- abriu a pagina pela ultima vez.
select teste.cenario('A pessoa marca que leu a explicacao', :CARLA,
  $q$select public.marcar_feedback_explicado()$q$, 'ok');
select teste.conferir_como('E marcar de novo nao reescreve a data', :CARLA,
  $q$select (public.marcar_feedback_explicado() = (select feedback_explicado_em from public.team_members where user_id = '33333333-3333-3333-3333-333333333333'))::text$q$,
  'true');

select teste.conferir_como('E volta para a fila', :ANA,
  $q$select count(*)::text from public.quem_recebe_feedback('2027-04-01', '2027-04-30') where user_id = '33333333-3333-3333-3333-333333333333'$q$,
  '1');


-- ---------------------------------------------------------------------------
-- 8. SOBRECARGA EXIGE DOIS PERIODOS SEGUIDOS
--
-- A segunda condicao e o que separa um alerta de um ruido: um mes apertado e
-- normal numa agencia, dois seguidos e uma decisao de distribuicao que
-- ninguem revisou.
-- ---------------------------------------------------------------------------

select teste.recusa_com('O colaborador nao grava alerta de carga', :CARLA,
  $q$select public.registrar_alertas_de_carga('44444444-4444-4444-4444-444444444444', '2027-04-01', '2027-04-30')$q$,
  'gestão');

-- A idempotencia e o indice unico e nao a consulta: rodar de novo nao
-- empilha o mesmo alerta, e o Pulso nao mostra dois numeros para o mesmo fato.
select teste.cenario('Rodar os alertas duas vezes nao duplica nada', :ANA,
  $q$select public.registrar_alertas_de_carga('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30')$q$,
  'ok');

select teste.conferir_como('Continua um alerta de sobrecarga so', :ANA,
  $q$select count(*)::text from public.workload_alerts where user_id = '33333333-3333-3333-3333-333333333333' and periodo_inicio = '2027-04-01' and tipo = 'sobrecarga'$q$,
  '1');


-- ---------------------------------------------------------------------------
-- 9. O PRIVILEGIO, E NAO A MENSAGEM DE RECUSA
--
-- Uma funcao pode recusar por dentro e continuar executavel, e ai o que se
-- mediu foi o corpo dela e nao a porta. E a licao da 0071.
-- ---------------------------------------------------------------------------

select teste.tem_execute('anon nao calcula metrica de pessoa nenhuma',
  'anon', 'public.feedback_metricas(uuid, date, date)', false);

select teste.tem_execute('anon nao le o contexto de pessoa nenhuma',
  'anon', 'public.feedback_contexto(uuid, date, date)', false);

select teste.tem_execute('anon nao abre a fila de feedback',
  'anon', 'public.quem_recebe_feedback(date, date, public.feedback_periodicidade)', false);

select teste.tem_execute('anon nao grava alerta de carga',
  'anon', 'public.registrar_alertas_de_carga(uuid, date, date)', false);

-- E o grant a `authenticated` EXISTE de proposito: sem ele a recusa chegaria
-- como "function does not exist", que manda quem leu procurar um bug de
-- schema em vez de ler a regra.
select teste.tem_execute('o usuario logado chama, e leva a recusa escrita',
  'authenticated', 'public.feedback_metricas(uuid, date, date)', true);


-- ---------------------------------------------------------------------------
-- 10. UM RELATORIO POR PESSOA POR PERIODO
--
-- A trava e o indice unico e nao a consulta da action: duas abas clicando em
-- "Gerar" ao mesmo tempo passam pelas duas consultas antes de qualquer uma
-- gravar. E por isso que a linha nasce em `gerando` ANTES da chamada a API --
-- uma chamada de IA leva segundos, que e tempo de sobra.
-- ---------------------------------------------------------------------------

select teste.cenario('Nao se gera duas vezes o mesmo periodo da mesma pessoa', :ANA,
  $q$insert into public.feedback_reports (user_id, periodo_inicio, periodo_fim, metricas_json, contexto_json) values ('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-04-30', '{}', '{}')$q$,
  'recusa');

-- MAS O TRIMESTRE E OUTRO RELATORIO, e a periodicidade entra na chave por
-- isso: o mes de abril e o trimestre que comeca em abril sao duas leituras do
-- mesmo trabalho, e uma nao substitui a outra.
select teste.cenario('Mas o trimestre do mesmo inicio e outro relatorio', :ANA,
  $q$insert into public.feedback_reports (user_id, periodo_inicio, periodo_fim, metricas_json, contexto_json, periodicidade) values ('33333333-3333-3333-3333-333333333333', '2027-04-01', '2027-06-30', '{}', '{}', 'trimestral')$q$,
  'ok');

select teste.cenario('Periodo invertido e recusado', :ANA,
  $q$insert into public.feedback_reports (user_id, periodo_inicio, periodo_fim, metricas_json, contexto_json) values ('44444444-4444-4444-4444-444444444444', '2027-08-31', '2027-08-01', '{}', '{}')$q$,
  'recusa');
