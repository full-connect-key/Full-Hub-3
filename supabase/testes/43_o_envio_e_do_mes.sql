\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

\set FLUXOJUNTO    '''43000000-0000-0000-0000-000000000001'''
\set FLUXOPARALELO '''43000000-0000-0000-0000-000000000002'''
\set FLUXOSEMAVAL  '''43000000-0000-0000-0000-000000000003'''

-- ===========================================================================
-- 43 - O ENVIO E DO MES, EM LOTE (0090)
--
-- Decisao do usuario, Sprint 3K: a gestao deixa de clicar "Enviar ao cliente"
-- peca por peca e passa a clicar "Enviar o mes ao cliente", uma vez. O cliente
-- recebe o conjunto e decide peca por peca.
--
-- ---------------------------------------------------------------------------
-- OS DOIS CENARIOS QUE JUSTIFICAM O ARQUIVO INTEIRO sao os dois bugs que esta
-- migration consertou, e os dois foram MEDIDOS contra o Postgres antes dela:
--
--   1. O post enviado num portao do MEIO nao aparecia para o cliente, porque
--      a consulta da tela filtrava por `data_publicacao` e o mes abre sem data
--      (0044). A metade que o banco responde esta na secao 3; a outra metade e
--      de `lib/dados/posts.ts` e e medida pelo `check:cores`.
--
--   2. E depois de um pedido de ajustes, o portao do meio NAO PODIA SER
--      REENVIADO: `approval_rounds_conteudo_rodada_key` e unico em
--      `(content_type, content_id, numero_rodada, escopo)`, e a rodada de
--      cliente era numerada por `posts.versao_atual` -- que a Pauta nao
--      incrementa, porque `post_versions` e arte e legenda. O reenvio levava
--      *"duplicate key value violates unique constraint"*, e nao havia caminho
--      nenhum: a peca voltava e nao tinha como sair de novo. A secao 4 mede.
--
-- Sao os dois cenarios que caem se alguem devolver a numeracao antiga, e os
-- dois que nenhuma tela mostra -- o primeiro parece "o cliente nao olhou" e o
-- segundo so aparece para quem clica duas vezes.
-- ===========================================================================

select teste.limpar();
delete from public.social_lotes;
delete from public.comments;
delete from public.post_versions;
delete from public.posts;


-- --- 1. O que nasceu, e o que ele NAO guarda -------------------------------

select teste.conferir('O aval interno nasceu ligado em todo elo que ja existia',
  (select count(*) filter (where not aprovacao_interna)::text
     from public.social_flow_steps), '0');

-- O LOTE NAO GUARDA DECISAO, e este cenario mede a TABELA e nao o
-- comportamento. Quantos aprovados, quantos com ajustes, quantos decididos --
-- tudo sai das rodadas. Uma coluna dessas aqui seria a segunda fonte de
-- verdade que o lote existe para nao ter, e o jeito de ela aparecer e alguem
-- "otimizar" uma contagem.
select teste.conferir(
  'O lote nao tem coluna de decisao nenhuma',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'social_lotes'
      and column_name in ('status','aprovadas','ajustes','decididas','recusadas','pendentes')),
  '0');

-- E NAO EXISTE POLICY DE DELETE. Um envio nao se desfaz, que e a decisao de
-- `approval_rounds` desde a 0032: rodada fechada nunca e reescrita nem
-- apagada.
select teste.conferir('E nao ha policy de DELETE em social_lotes',
  (select count(*)::text from pg_policies
    where tablename = 'social_lotes' and cmd = 'DELETE'), '0');


-- --- 2. O mes anda junto, que e o PADRAO -----------------------------------
--
-- A frase do sprint: *"o portao so e vencido quando todos os posts forem
-- aprovados nele. Enquanto 3 estiverem em ajustes na Pauta, o Layout nao
-- comeca para nenhum"*. E a frase do usuario com outras palavras -- a peca e
-- individual, mas faz parte de um conjunto.

select public.salvar_fluxo_de_social(
  'Fluxo que anda junto',
  jsonb_build_array(
    jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                       'campo','pauta','aprovacao_cliente',true),
    jsonb_build_object('nome','Conteúdo','funcao','Redator','papel','producao',
                       'campo','legenda'),
    jsonb_build_object('nome','Envio','funcao','Gestao','papel','entrega')
  ),
  :FLUXOJUNTO);

select teste.conferir('O fluxo nasce andando junto, sem ninguem escolher',
  (select avanca_em_paralelo::text from public.social_flows where id = :FLUXOJUNTO),
  'false');

select teste.cenario('A gestao abre maio com ele', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-05', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb,
    %L, jsonb_build_object('Social Media', %L::text, 'Redator', %L::text),
    '{}'::jsonb, 'https://drive.google.com/drive/folders/MAIO', %L)$fmt$,
    :VERDE, :MARINA, :MARINA, :CARLA, :FLUXOJUNTO), 'ok', 1);

select set_config('t43.maio',
  (select id::text from public.tasks where client_id = :VERDE and social_do_mes = '2027-05-01'),
  false);
select set_config('t43.pauta',
  (select id::text from public.etapas_do_mes(current_setting('t43.maio')::uuid)
    where titulo = 'Pauta'), false);
select set_config('t43.conteudo',
  (select id::text from public.etapas_do_mes(current_setting('t43.maio')::uuid)
    where titulo = 'Conteúdo'), false);
select set_config('t43.envio',
  (select id::text from public.etapas_do_mes(current_setting('t43.maio')::uuid)
    where titulo = 'Envio'), false);
select set_config('t43.a',
  (select id::text from public.posts_do_mes(current_setting('t43.maio')::uuid)
    order by tema limit 1), false);
select set_config('t43.b',
  (select id::text from public.posts_do_mes(current_setting('t43.maio')::uuid)
    order by tema desc limit 1), false);

-- O SNAPSHOT VIAJOU, e e ele que a trava le. Sem esta linha a trava
-- perguntaria ao fluxo direto, e editar a configuracao da conta mudaria o
-- comportamento de um mes que esta correndo.
select teste.conferir('E a demanda do mes guardou a copia',
  (select social_paralelo::text from public.tasks where id = current_setting('t43.maio')::uuid),
  'false');

select teste.conferir('Cada etapa guardou a copia do aval interno',
  (select count(*) filter (where social_aval_interno)::text
     from public.etapas_do_mes(current_setting('t43.maio')::uuid)), '3');

select teste.conferir('O portao do mes e a Pauta',
  (select titulo from public.subtasks
    where id = (select id from public.portoes_do_mes(current_setting('t43.maio')::uuid)
                 order by ordem limit 1)), 'Pauta');

-- A Marina marca a Pauta das DUAS pecas
select teste.cenario('A Marina marca a Pauta da peca A', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.a'), current_setting('t43.pauta')), 'ok', 1);
select teste.cenario('E a da peca B', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.b'), current_setting('t43.pauta')), 'ok', 1);

-- E O CONTEUDO NAO COMECA, porque o cliente nao decidiu a Pauta de nenhuma.
--
-- QUEM RECUSA AQUI E A TRAVA DO MES, e nao a da peca -- e eu havia escrito o
-- contrario. Com zero aprovacoes nas duas, as duas travas valem, e a do mes
-- vem primeiro de proposito: ela diz *quantas* faltam, que e a informacao que
-- decide se a pessoa espera ou cobra o cliente. A trava por peca tem cenario
-- proprio na secao 5, com o paralelismo ligado -- que e o unico estado em que
-- ela e a unica a falar.
select teste.recusa_com('O Conteudo espera o mes decidir a Pauta', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.a'), current_setting('t43.conteudo')),
  'O mês anda junto, e 2 peças ainda não passaram por Pauta');


-- --- 3. O ENVIO EM LOTE, e as pecas SEM DATA chegando ao cliente -----------
--
-- E A SECAO DO BUG 1. As duas pecas de maio nao tem data nenhuma -- o mes abre
-- em branco desde a 0044 --, e a Pauta e um portao do MEIO: a trava de data
-- vale so na entrega (0076), porque exigi-la na primeira etapa da corrente
-- seria uma recusa que ela nao tem como satisfazer.

-- Antes de qualquer coisa, o aval interno de cada peca.
select teste.cenario('A Marina pede o aval interno da peca A', :MARINA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'interna', %L, 'pendente')$fmt$,
    current_setting('t43.a'), :MARINA), 'ok', 1);
select teste.cenario('E da peca B', :MARINA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'interna', %L, 'pendente')$fmt$,
    current_setting('t43.b'), :MARINA), 'ok', 1);

-- SEM O AVAL APROVADO O LOTE NAO SAI, e a recusa NOMEIA as pecas: e a decisao
-- da 0023, e o que separa um "nao pode" de uma instrucao.
select teste.recusa_com_dica('Sem o aval aprovado, o lote nao sai', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.maio'), current_setting('t43.pauta')),
  'falta o aval interno desta versão');

select teste.cenario('Diego aprova os dois avais internos', :DIEGO,
  $$update public.approval_rounds set status = 'aprovada',
        decidido_por = '22222222-2222-2222-2222-222222222222', decidido_em = now()
    where escopo = 'interna' and status = 'pendente'$$, 'ok', 2);

-- O LOTE SAI, com as duas pecas sem data nenhuma.
select teste.cenario('A gestao envia o mes ao cliente', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, 'Olha a pauta de maio.')$fmt$,
    current_setting('t43.maio'), current_setting('t43.pauta')), 'ok', 1);

select teste.conferir('Nasceu UM lote, na rodada 1',
  (select format('%s/%s', count(*), min(numero_rodada)) from public.social_lotes
    where task_id = current_setting('t43.maio')::uuid), '1/1');

select teste.conferir('Com as DUAS rodadas apontando para ele',
  (select count(*)::text from public.approval_rounds r
     join public.social_lotes l on l.id = r.lote_id
    where l.task_id = current_setting('t43.maio')::uuid), '2');

select teste.conferir('E o recado da agencia viajou com o envio',
  (select recado from public.social_lotes
    where task_id = current_setting('t43.maio')::uuid), 'Olha a pauta de maio.');

-- AS DUAS PECAS ESTAO SEM DATA, e e exatamente o caso do bug 1.
select teste.conferir('As duas pecas que sairam nao tem data de publicacao',
  (select count(*) filter (where data_publicacao is null)::text
     from public.posts_do_mes(current_setting('t43.maio')::uuid)), '2');

-- E O CLIENTE ENXERGA AS DUAS. Este e o cenario do bug 1 pelo lado do banco:
-- a RLS sempre deixou, e quem escondia era a consulta da tela.
select teste.cenario('E o cliente enxerga as duas, sem data', :JOANA,
  format($fmt$select 1 from public.posts where social_task_id = %L$fmt$,
    current_setting('t43.maio')), 'ok', 2);

select teste.conferir('O carimbo de envio e consequencia da rodada, nao um segundo comando',
  (select count(*) filter (where enviado_em is not null)::text
     from public.posts_do_mes(current_setting('t43.maio')::uuid)), '2');

-- UM AVISO POR PESSOA, E NAO UM POR PECA. Dezoito sinos para um envio e o
-- caminho mais curto para o sino virar ruido.
select teste.conferir('O cliente recebeu UM aviso, nao dois',
  (select count(*)::text from public.notifications
    where user_id = :JOANA and titulo like 'Pauta%'), '1');

-- E O LOTE DA OUTRA EMPRESA NAO VAZA. O furo passaria despercebido num banco
-- com um cliente so: ele ve um lote, que e o total.
select teste.cenario('E o cliente da outra empresa nao ve o lote', :OTTO,
  format($fmt$select 1 from public.social_lotes where task_id = %L$fmt$,
    current_setting('t43.maio')), 'recusa');

select teste.cenario('Mas o cliente desta ve, por causa do recado', :JOANA,
  format($fmt$select 1 from public.social_lotes where task_id = %L$fmt$,
    current_setting('t43.maio')), 'ok', 1);


-- --- 4. A rodada 2 leva so o que voltou -- E O BUG 2 ----------------------

select set_config('t43.rodA',
  (select r.id::text from public.approval_rounds r
    where r.content_id = current_setting('t43.a')::uuid and r.escopo = 'cliente'
      and r.status = 'pendente'), false);
select set_config('t43.rodB',
  (select r.id::text from public.approval_rounds r
    where r.content_id = current_setting('t43.b')::uuid and r.escopo = 'cliente'
      and r.status = 'pendente'), false);

select teste.cenario('O cliente aprova a peca A', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(%L, 'aprovada', null)$fmt$,
    current_setting('t43.rodA')), 'ok', 1);

select teste.conferir('O lote NAO fechou com uma peca pendente',
  (select (fechado_em is null)::text from public.social_lotes
    where task_id = current_setting('t43.maio')::uuid), 'true');

select teste.cenario('E pede ajustes na peca B', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(%L, 'ajustes_solicitados', 'Troca o gancho.')$fmt$,
    current_setting('t43.rodB')), 'ok', 1);

select teste.conferir('Agora o lote fechou sozinho',
  (select (fechado_em is not null)::text from public.social_lotes
    where task_id = current_setting('t43.maio')::uuid), 'true');

-- O RESUMO E DERIVADO DAS RODADAS, e nao de coluna nenhuma do lote.
select teste.conferir('E quem enviou recebeu o resumo, com os dois numeros',
  (select corpo from public.notifications
    where user_id = :ANA and titulo like '%o cliente respondeu%'
    order by created_at desc limit 1), '1 aprovadas, 1 com ajustes');

-- A PECA APROVADA AVANCOU O PORTAO; a que voltou, nao.
select teste.conferir('A peca A passou do portao da Pauta',
  public.aprovacoes_do_cliente_no_post(current_setting('t43.a')::uuid)::text, '1');
select teste.conferir('E a peca B continua em zero: rodada recusada nao conta',
  public.aprovacoes_do_cliente_no_post(current_setting('t43.b')::uuid)::text, '0');

-- E O PEDIDO CAIU NA CAIXINHA de quem escreveu a pauta, em vez de ficar so na
-- rodada -- que nenhuma tela de producao mostra.
select teste.conferir('O pedido de ajustes caiu na caixinha da peca B',
  (select observacao from public.post_etapa_progresso
    where post_id = current_setting('t43.b')::uuid
      and subtask_id = current_setting('t43.pauta')::uuid), 'Troca o gancho.');

-- A Marina refaz a pauta da B e marca de novo.
select teste.cenario('A Marina refaz a pauta da peca B', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.b'), current_setting('t43.pauta')), 'ok', 1);

-- E A RODADA 2 SAI. Com a numeracao antiga este cenario levava
-- *"duplicate key value violates unique constraint"*, e era o bug 2.
select teste.cenario('A rodada 2 do portao sai', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, 'Pauta refeita.')$fmt$,
    current_setting('t43.maio'), current_setting('t43.pauta')), 'ok', 1);

select teste.conferir('Sao dois lotes agora, 1 e 2',
  (select string_agg(numero_rodada::text, ', ' order by numero_rodada)
     from public.social_lotes where task_id = current_setting('t43.maio')::uuid), '1, 2');

-- E ELE LEVA SO A QUE VOLTOU. O cliente nao re-decide o que ja aprovou.
select teste.conferir('E o lote 2 leva UMA peca, a que voltou',
  (select count(*)::text from public.approval_rounds r
     join public.social_lotes l on l.id = r.lote_id
    where l.task_id = current_setting('t43.maio')::uuid and l.numero_rodada = 2), '1');

select teste.conferir('E ela e a peca B',
  (select p.tema = (select tema from public.posts where id = current_setting('t43.b')::uuid)
     from public.approval_rounds r
     join public.posts p on p.id = r.content_id
     join public.social_lotes l on l.id = r.lote_id
    where l.task_id = current_setting('t43.maio')::uuid and l.numero_rodada = 2)::text, 'true');

-- A NUMERACAO DA RODADA DE CLIENTE E A SEQUENCIA DO POST, e e esta linha que
-- separa a implementacao certa da que colidia: devolvendo `posts.versao_atual`
-- a `proxima_rodada_do_cliente()`, os dois numeros sairiam 1 e 1.
select teste.conferir('A peca B tem duas rodadas de cliente, 1 e 2',
  (select string_agg(numero_rodada::text, ', ' order by numero_rodada)
     from public.approval_rounds
    where content_id = current_setting('t43.b')::uuid and escopo = 'cliente'), '1, 2');

select teste.conferir('E a versao da arte dela continua em 1',
  (select versao_atual::text from public.posts
    where id = current_setting('t43.b')::uuid), '1');


-- --- 5. O mes anda junto: a trava, e o paralelismo que a desliga -----------
--
-- A peca A passou da Pauta e a B nao. Com o mes andando junto, o Conteudo NAO
-- comeca para nenhuma -- nem para a que passou.

select teste.recusa_com('O Conteudo da peca A espera o mes inteiro', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.a'), current_setting('t43.conteudo')),
  'O mês anda junto');

-- A FRASE DIZ QUANTAS FALTAM, e nao "o mes nao pode andar": quem le precisa
-- saber se falta uma peca ou dezessete para decidir se espera ou se cobra.
select teste.recusa_com('E a recusa diz quantas pecas faltam, e em que portao', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.a'), current_setting('t43.conteudo')),
  '1 peça ainda não passou por Pauta');

-- E A DICA DIZ COMO DESLIGAR, que e a outra metade da decisao da 0023.
select teste.recusa_com_dica('E a dica diz onde ligar o paralelismo', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.a'), current_setting('t43.conteudo')),
  'as peças aprovadas avançam');

-- NEM A SOCIA PASSA. A trava e sobre o fato -- o mes -- e nao sobre o perfil.
select teste.recusa_com('Nem a socia passa por cima do mes', :ANA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.a'), current_setting('t43.conteudo')),
  'O mês anda junto');

-- E AGORA O MESMO MES COM PARALELISMO LIGADO, para provar que a trava e a
-- opcao e nao uma regra fixa. O snapshot e da DEMANDA, entao e nela que se
-- liga -- editar o fluxo nao alcanca um mes que esta correndo, e e isso que o
-- snapshot existe para garantir.
select teste.cenario('A gestao liga o paralelismo neste mes', :ANA,
  format($fmt$update public.tasks set social_paralelo = true where id = %L$fmt$,
    current_setting('t43.maio')), 'ok', 1);

select teste.cenario('E a peca aprovada avanca sem esperar as demais', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.a'), current_setting('t43.conteudo')), 'ok', 1);

-- MAS A TRAVA POR PECA CONTINUA, e e o que impede o paralelismo de virar
-- "qualquer um marca qualquer coisa": a peca B nao passou da Pauta.
select teste.recusa_com('Mas a peca que nao passou continua travada', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.b'), current_setting('t43.conteudo')),
  'ainda não aprovou Pauta');

select teste.cenario('E a gestao desliga de novo, para o resto do arquivo', :ANA,
  format($fmt$update public.tasks set social_paralelo = false where id = %L$fmt$,
    current_setting('t43.maio')), 'ok', 1);


-- --- 6. Quem envia o mes -- e quem nao envia -------------------------------
--
-- Decisao do usuario: `is_gestor() or is_atendimento()`. Era `is_gestor()` e
-- mais nada desde a 0060, e a abertura foi pedida duas vezes no sprint.

select teste.cenario('O Design nao envia o mes ao cliente', :BRUNO,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.maio'), current_setting('t43.pauta')), 'recusa');

select teste.recusa_com('E a recusa diz de quem e', :BRUNO,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.maio'), current_setting('t43.pauta')),
  'da gestão ou do Atendimento');

-- A SOCIAL MEDIA TAMBEM NAO, e e a parte que prova que a abertura nao e para
-- "todo colaborador": a Marina produziu as duas pautas e nao e Atendimento.
select teste.cenario('A Social Media que produziu tambem nao envia', :MARINA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.maio'), current_setting('t43.pauta')), 'recusa');

-- E A SEGUNDA PERGUNTA DA 0060 VOLTA A TER A QUEM RECUSAR. Ela foi tirada
-- porque `is_gestor()` acima ja barrava todo colaborador -- ela nao alcancava
-- ninguem. Com o Atendimento passando, ela alcanca exatamente uma pessoa: o
-- colaborador do Atendimento que produziu a peca.
select teste.cenario('A Carla, do Atendimento, passa a envia-lo', :CARLA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, 'Terceira rodada.')$fmt$,
    current_setting('t43.maio'), current_setting('t43.envio')), 'recusa');


-- --- 7. O aval interno opcional -------------------------------------------
--
-- A marcacao e do ELO, e e independente de `aprovacao_cliente`: as quatro
-- combinacoes sao legitimas, e nenhum `check` as amarra.

select public.salvar_fluxo_de_social(
  'Fluxo sem aval interno',
  jsonb_build_array(
    jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                       'campo','pauta','aprovacao_cliente',true,
                       'aprovacao_interna',false),
    jsonb_build_object('nome','Entrega','funcao','Design','papel','entrega',
                       'aprovacao_interna',false)
  ),
  :FLUXOSEMAVAL);

select teste.conferir('O elo gravou o aval interno desligado',
  (select string_agg(aprovacao_interna::text, ', ' order by ordem)
     from public.social_flow_steps where flow_id = :FLUXOSEMAVAL), 'false, false');

-- E A FORMA SEM A CHAVE CONTINUA LIGANDO. O default e `true` nos dois lados --
-- na coluna e na funcao --, pela decisao do default `publicada` da 0028:
-- esquecer o campo mantem o que ja acontecia.
select teste.conferir('E o elo que nao fala do aval nasce com ele ligado',
  (select aprovacao_interna::text from public.social_flow_steps
    where flow_id = :FLUXOJUNTO and nome = 'Pauta'), 'true');

select teste.cenario('A gestao abre junho com o fluxo sem aval', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-06', '[{"redes": ["instagram"], "quantidade": 1}]'::jsonb,
    %L, jsonb_build_object('Social Media', %L::text, 'Design', %L::text),
    '{}'::jsonb, 'https://drive.google.com/drive/folders/JUNHO', %L)$fmt$,
    :VERDE, :MARINA, :MARINA, :BRUNO, :FLUXOSEMAVAL), 'ok', 1);

select set_config('t43.junho',
  (select id::text from public.tasks where client_id = :VERDE and social_do_mes = '2027-06-01'),
  false);
select set_config('t43.jpauta',
  (select id::text from public.etapas_do_mes(current_setting('t43.junho')::uuid)
    where titulo = 'Pauta'), false);
select set_config('t43.jpost',
  (select id::text from public.posts_do_mes(current_setting('t43.junho')::uuid) limit 1), false);

select teste.conferir('A etapa do mes guardou o aval desligado',
  (select social_aval_interno::text from public.subtasks
    where id = current_setting('t43.jpauta')::uuid), 'false');

select teste.cenario('A Marina marca a Pauta', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t43.jpost'), current_setting('t43.jpauta')), 'ok', 1);

-- E O LOTE SAI SEM AVAL INTERNO NENHUM. E a entrega do sprint.
select teste.cenario('E o mes vai ao cliente SEM aval interno', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.junho'), current_setting('t43.jpauta')), 'ok', 1);

select teste.conferir('Sem nenhuma rodada interna ter existido',
  (select count(*)::text from public.approval_rounds
    where content_id = current_setting('t43.jpost')::uuid and escopo = 'interna'), '0');


-- --- 8. A recusa da entrega NOMEIA as pecas sem data ----------------------
--
-- O sprint pede isso por nome: *"a mensagem precisa dizer quais pecas estao
-- sem data"*. E a decisao da 0023 -- dizer quais e a diferenca entre uma
-- recusa e uma instrucao, e dizer quais errado e pior que nao dizer.
--
-- A trava de data vale SO na entrega, e esta secao e o contraponto da 3: lá as
-- pecas sem data SAIRAM, porque o portao era do meio.

select teste.cenario('O cliente aprova a Pauta de junho', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select r.id from public.approval_rounds r
      where r.content_id = %L and r.escopo = 'cliente' and r.status = 'pendente'),
    'aprovada', null)$fmt$, current_setting('t43.jpost')), 'ok', 1);

select set_config('t43.jentrega',
  (select id::text from public.etapas_do_mes(current_setting('t43.junho')::uuid)
    where titulo = 'Entrega'), false);

select teste.recusa_com_dica('A entrega recusa, e a dica NOMEIA a peca sem data', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.junho'), current_setting('t43.jentrega')),
  'não tem data de publicação');

-- E A DICA CARREGA O ID DA PECA, que e o que a tela usa para montar o link.
--
-- `conferir_como` E NAO `conferir`, e a razao e a guarda da secao 9: a funcao e
-- `security definer` com `is_staff()` no corpo, e `conferir` avalia a expressao
-- como dono do banco -- sem sessao, entao `is_staff()` e falso e ela recusa a
-- si mesma. E a mesma pegadinha que `descanso_do_ciclo()` registrou na 0085.
select teste.conferir_como('E `o_que_falta_no_portao` devolve o id da peca, para o link',
  :ANA,
  $$select count(*)::text from public.o_que_falta_no_portao(
      current_setting('t43.junho')::uuid, current_setting('t43.jentrega')::uuid)
     where post_id = current_setting('t43.jpost')::uuid$$, '1');

select teste.cenario('A Marina escolhe o dia', :MARINA,
  format($fmt$update public.posts set data_publicacao = '2027-06-10' where id = %L$fmt$,
    current_setting('t43.jpost')), 'ok', 1);

select teste.conferir_como('E agora nao falta nada no portao', :ANA,
  $$select count(*)::text from public.o_que_falta_no_portao(
      current_setting('t43.junho')::uuid, current_setting('t43.jentrega')::uuid)$$, '0');

select teste.cenario('E a entrega vai ao cliente', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.junho'), current_setting('t43.jentrega')), 'ok', 1);

-- E A APROVACAO DA ENTREGA FECHA A PECA, que e a regra da 0032 de pe.
select teste.cenario('O cliente aprova a entrega', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select r.id from public.approval_rounds r
      where r.content_id = %L and r.escopo = 'cliente' and r.status = 'pendente'),
    'aprovada', null)$fmt$, current_setting('t43.jpost')), 'ok', 1);

select teste.conferir('E AGORA a peca esta aprovada, e nao antes',
  (select status::text from public.posts where id = current_setting('t43.jpost')::uuid),
  'aprovado');

select teste.conferir('E a caixinha da entrega fechou sozinha',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t43.jpost')::uuid
      and subtask_id = current_setting('t43.jentrega')::uuid), 'true');


-- --- 9. As tres funcoes que devolvem dado de peca sao da EQUIPE ------------
--
-- As tres sao `security definer` e leem `posts` e `subtasks` sem passar pela
-- RLS. Sem a guarda escrita a mao, elas responderiam sobre o mes de QUALQUER
-- empresa para quem tiver o uuid -- e `authenticated` inclui o cliente. E a
-- forma de `o_que_o_cliente_decide()` na 0076: definer para devolver o
-- agregado, com a pergunta de quem pode escrita dentro.
--
-- O FURO PASSARIA DESPERCEBIDO num banco com um cliente so, que e a licao da
-- `calendar_events`: ele veria o mes dele, que e o total.

select teste.cenario('O cliente nao chama portao_atual_do_mes', :JOANA,
  format($fmt$select public.portao_atual_do_mes(%L)$fmt$, current_setting('t43.maio')),
  'recusa');

select teste.recusa_com('E a recusa diz que a consulta e da equipe', :JOANA,
  format($fmt$select public.portao_atual_do_mes(%L)$fmt$, current_setting('t43.maio')),
  'Essa consulta é da equipe');

select teste.cenario('Nem posts_elegiveis_do_portao', :JOANA,
  format($fmt$select public.posts_elegiveis_do_portao(%L, %L)$fmt$,
    current_setting('t43.maio'), current_setting('t43.pauta')), 'recusa');

select teste.cenario('Nem o_que_falta_no_portao', :JOANA,
  format($fmt$select public.o_que_falta_no_portao(%L, %L)$fmt$,
    current_setting('t43.maio'), current_setting('t43.pauta')), 'recusa');

-- E A EQUIPE CHAMA AS TRES, que e a metade positiva: so a de cima passaria
-- numa funcao que recusa todo mundo.
select teste.cenario('E a equipe chama as tres', :BRUNO,
  format($fmt$select public.portao_atual_do_mes(%L)$fmt$, current_setting('t43.maio')),
  'ok');


-- --- 10. O lote e do mes, e de um portao DELE -----------------------------

select teste.recusa_com('Uma etapa de outro mes nao abre lote', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.maio'), current_setting('t43.jpauta')),
  'não é um portão deste mês');

-- E UMA ETAPA QUE NAO E PORTAO TAMBEM NAO. Sem esta trava o lote abriria uma
-- rodada que o cliente nunca decide: ele veria material sem ter onde
-- responder.
select teste.recusa_com('E uma etapa que nao e portao tambem nao', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.maio'), current_setting('t43.conteudo')),
  'não é um portão deste mês');

-- E SEM PECA ELEGIVEL O LOTE NAO NASCE VAZIO. Um lote de zero pecas e um
-- cabecalho no portal dizendo "0 pecas esperando voce".
select teste.recusa_com('E um portao sem peca esperando nao abre lote', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%L, %L, null)$fmt$,
    current_setting('t43.junho'), current_setting('t43.jentrega')),
  'Não há peça esperando a sua vez');


-- --- 11. A fase do social voltou ao Calendario Full ------------------------
--
-- Decisao do usuario. Ela entrou na 0059 como etapa de POST -- uma linha por
-- peca --, saiu na 0088, e volta como a fase do MES: cinco pontos por mes, nao
-- dezoito. A diferenca e o que torna a volta barata.

-- AS FASES PRECISAM DE PRAZO PARA ENTRAR, e os meses deste arquivo nascem sem
-- nenhum -- `p_prazos` e `'{}'` nas tres chamadas. A primeira versao desta
-- secao nao media NADA por causa disso: a view devolvia zero, a subconsulta
-- tambem, e `0 = 0` passava. Foi o teste de mutacao que mostrou -- desligando
-- a origem inteira, nenhum cenario caia.
--
-- E O `p_linhas` E A OUTRA METADE do mesmo descuido: `teste.cenario(..., 'ok')`
-- sem contagem aceita ZERO linhas, entao ele passava com a camada desligada.
update public.subtasks set prazo = '2027-04-20'
 where id = current_setting('t43.pauta')::uuid;
update public.subtasks set prazo = '2027-04-25'
 where id = current_setting('t43.conteudo')::uuid;

select teste.cenario('As fases com prazo aparecem no calendario da equipe', :ANA,
  format($fmt$select 1 from public.calendar_events
     where tipo = 'fase_de_social' and client_id = %L$fmt$, :VERDE), 'ok', 2);

-- E SO AS QUE TEM PRAZO, que e a regra de toda origem desta view. A terceira
-- fase de maio -- o Envio -- continua sem prazo, e fica de fora.
select teste.conferir_como('E a fase sem prazo fica de fora', :ANA,
  $$select count(*)::text from public.calendar_events
     where tipo = 'fase_de_social' and titulo = 'Envio'$$, '0');

select teste.conferir_como('E o titulo que entra e o da fase, nao o do post', :ANA,
  format($fmt$select string_agg(titulo, ', ' order by titulo) from public.calendar_events
     where tipo = 'fase_de_social' and client_id = %L$fmt$, :VERDE), 'Conteúdo, Pauta');

-- E O CLIENTE NAO ALCANCA NENHUMA. A corrente e conversa interna -- quem esta
-- com o material, qual fase travou, quem atrasou.
select teste.cenario('E o cliente nao ve fase nenhuma', :JOANA,
  $$select 1 from public.calendar_events where tipo = 'fase_de_social'$$, 'recusa');

-- E O LINK LEVA AO SOCIAL MEDIA, e nao a Gestao de Tasks: e o que distingue
-- esta origem da etapa de demanda que a 0077 tirou, e e a sonda que o arquivo
-- 26 usa desde a 0090.
select teste.conferir_como('E o link dela leva ao Social Media', :ANA,
  $$select (bool_and(link like '/painel/social-media%'))::text
     from public.calendar_events where tipo = 'fase_de_social'$$, 'true');

-- `security_invoker` FOI REPETIDA PELA QUINTA VEZ, e este cenario e o unico
-- que a mede. Sem a clausula a view roda com os direitos de quem a criou e le
-- as tabelas de origem inteiras para qualquer pessoa autenticada.
select teste.conferir('E a view continua com security_invoker',
  (select (array_to_string(reloptions, ',') like '%security_invoker=true%')::text
     from pg_class where relname = 'calendar_events'), 'true');


-- --- 12. O arquivamento depois de 90 dias ---------------------------------

select teste.conferir('A rotina nao e chamavel por quem esta logado',
  (select has_function_privilege('authenticated',
            'public.arquivar_meses_de_social(integer)', 'execute')::text), 'false');

-- E O CARIMBO DE CONCLUSAO NASCE E SE LIMPA. Sem a limpeza, uma demanda
-- reaberta ficaria com a data antiga e a rotina arquivaria trabalho em
-- producao.
select teste.cenario('A gestao conclui o mes de junho a mao', :ANA,
  format($fmt$update public.tasks set status = 'concluido', status_manual = true where id = %L$fmt$,
    current_setting('t43.junho')), 'ok', 1);

select teste.conferir('E o carimbo de conclusao nasceu',
  (select (concluida_em is not null)::text from public.tasks
    where id = current_setting('t43.junho')::uuid), 'true');

select teste.cenario('A gestao reabre o mes', :ANA,
  format($fmt$update public.tasks set status = 'em_andamento' where id = %L$fmt$,
    current_setting('t43.junho')), 'ok', 1);

select teste.conferir('E o carimbo se limpou',
  (select (concluida_em is null)::text from public.tasks
    where id = current_setting('t43.junho')::uuid), 'true');

-- E A ROTINA SO ALCANCA O QUE PASSOU DO PRAZO. O teto e por parametro para o
-- cenario nao depender de esperar noventa dias.
select teste.cenario('A gestao conclui de novo', :ANA,
  format($fmt$update public.tasks set status = 'concluido', status_manual = true where id = %L$fmt$,
    current_setting('t43.junho')), 'ok', 1);

select teste.conferir('Com 90 dias a rotina nao alcanca um mes concluido hoje',
  (select public.arquivar_meses_de_social(90)::text), '0');

select teste.conferir('E o mes nao foi arquivado',
  (select (arquivada_em is null)::text from public.tasks
    where id = current_setting('t43.junho')::uuid), 'true');

-- Recuando o carimbo, ela alcanca -- e e a unica forma de medir isto sem
-- esperar.
update public.tasks set concluida_em = now() - interval '100 days'
 where id = current_setting('t43.junho')::uuid;

select teste.conferir('Com o carimbo recuado, ela arquiva',
  (select public.arquivar_meses_de_social(90)::text), '1');

select teste.conferir('E o mes ficou arquivado',
  (select (arquivada_em is not null)::text from public.tasks
    where id = current_setting('t43.junho')::uuid), 'true');

-- E ELA NAO ARQUIVA DUAS VEZES, que e o que faz a rotina diaria ser inofensiva.
select teste.conferir('E rodar de novo nao arquiva nada',
  (select public.arquivar_meses_de_social(90)::text), '0');

-- E ELA NAO TOCA DEMANDA QUE NAO E DE SOCIAL. Uma demanda comum concluida ha
-- um ano nao tem nada a ver com o arquivamento do social.
insert into public.tasks (id, client_id, titulo, link_entrega, criado_por, status, status_manual)
values ('43000000-0000-0000-0000-00000000aaaa', :VERDE, 'Demanda comum concluida',
        'https://exemplo.com/pasta', :ANA, 'concluido', true)
on conflict (id) do nothing;
update public.tasks set concluida_em = now() - interval '400 days'
 where id = '43000000-0000-0000-0000-00000000aaaa';

select teste.conferir('E ela nao arquiva demanda que nao e de social',
  (select public.arquivar_meses_de_social(90)::text), '0');

select teste.conferir('Que continua sem carimbo de arquivo',
  (select (arquivada_em is null)::text from public.tasks
    where id = '43000000-0000-0000-0000-00000000aaaa'), 'true');
