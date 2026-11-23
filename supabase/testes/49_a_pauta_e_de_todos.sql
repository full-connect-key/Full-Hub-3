\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set RAFAEL  '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

\set DEMANDA '''49000000-0000-0000-0000-0000000000d1'''
\set ETAPA_B '''49000000-0000-0000-0000-0000000000e1'''
\set ETAPA_M '''49000000-0000-0000-0000-0000000000e2'''
\set ETAPA_A '''49000000-0000-0000-0000-0000000000e3'''
\set ETAPA_D '''49000000-0000-0000-0000-0000000000e4'''
\set FASE    '''49000000-0000-0000-0000-0000000000e5'''

-- AS ETAPAS DA BUSCA POR TITULO (0147). Elas sao cinco e nenhuma e de enfeite:
-- cada uma e um caso que a busca precisa distinguir.
\set ETAPA_V '''49000000-0000-0000-0000-0000000000e6'''
\set ETAPA_G '''49000000-0000-0000-0000-0000000000e7'''
\set ETAPA_F '''49000000-0000-0000-0000-0000000000e8'''
\set ETAPA_S '''49000000-0000-0000-0000-0000000000e9'''
\set DEMANDA_V '''49000000-0000-0000-0000-0000000000d3'''
\set RASCUNHO '''49000000-0000-0000-0000-0000000000d2'''
\set ETAPA_R '''49000000-0000-0000-0000-0000000000ea'''

-- ===========================================================================
-- 49 - A PAUTA E DE TODOS, E QUEM MEXE NELA ASSUME (migration 0144)
--
-- Decisao do usuario, item 22: *"todos os colaboradores devem poder visualizar
-- as pautas de todos"*. Item 23: *"ao realizar uma alteracao em uma pauta que
-- nao e sua, a responsabilidade dela passa a ser de quem alterou"*.
--
-- ---------------------------------------------------------------------------
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "o Bruno muda o prazo da etapa
-- da Marina, e a etapa passa a ser dele". Ele mede as DUAS metades de uma vez,
-- e e por isso que ele vem primeiro: a policy aberta (sem ela sao zero linhas)
-- e o takeover (sem ele a etapa continua da Marina). Tirando qualquer um dos
-- dois, ele cai -- e so ele diz qual dos dois saiu, porque a forma da falha e
-- diferente: zero linha de um lado, responsavel velho do outro.
--
-- E O CENARIO QUE SEPARA O CERTO DO PLAUSIVEL e "a segunda pessoa do vinculo
-- nao assume". `subtasks.responsavel_id` e a PRIMEIRA pessoa desde a 0114, e
-- quem manda e `subtask_responsaveis` -- uma leitura ingenua da coluna
-- promoveria a segunda pessoa a primeira no instante em que ela mexesse na
-- PROPRIA etapa. Medir so a coluna passaria nos outros cenarios todos.
--
-- E O TERCEIRO, o que ninguem pensa em escrever: "o Atendimento muda o status
-- e NAO sai uma segunda linha de historico". `subtasks_registra_status` (0035)
-- ja grava `status_da_etapa` com autor e hora em toda mudanca de status, de
-- qualquer pessoa, e o status e a alteracao mais comum da pauta -- uma linha
-- de `editou_a_etapa` ao lado dela diria o mesmo fato duas vezes no mesmo
-- feed. Sem este cenario, tirar a guarda nao derruba nada.
-- ===========================================================================

select teste.limpar();


-- ---------------------------------------------------------------------------
-- A DEMANDA E AS QUATRO ETAPAS
--
-- Uma demanda publicada da Mundo Verde, com pasta de entrega -- as duas coisas
-- que `tasks_publicar_exige_minimo` e `tasks_exige_pasta_de_entrega` cobram.
-- As etapas nascem com dono para as perguntas deste arquivo existirem: uma do
-- Bruno (Design), duas da Marina (Social Media), uma da Marina com o Rafael
-- vinculado ao lado -- a segunda pessoa da 0114 -- e uma quinta, que e uma
-- FASE de mes de social.
-- ---------------------------------------------------------------------------
insert into public.tasks
  (id, client_id, titulo, status, criado_por, publicada_em, link_entrega)
values
  (:DEMANDA, :VERDE, 'Campanha de aniversario', 'nao_iniciada', :CARLA,
   now(), 'https://drive.google.com/drive/folders/aniversario');

insert into public.subtasks
  (id, task_id, titulo, status, responsavel_id, prazo, ordem)
values
  (:ETAPA_B, :DEMANDA, 'KV',                  'nao_iniciada', :BRUNO,  '2027-04-10', 1),
  (:ETAPA_M, :DEMANDA, 'Conteudo',            'nao_iniciada', :MARINA, '2027-04-12', 2),
  (:ETAPA_A, :DEMANDA, 'Adaptacoes',          'nao_iniciada', :MARINA, '2027-04-14', 3),
  (:ETAPA_D, :DEMANDA, 'Subida de midia',     'nao_iniciada', :MARINA, '2027-04-16', 4);

-- O RAFAEL ENTRA COMO SEGUNDA PESSOA da ultima, pela tabela da 0114 -- e a
-- coluna continua apontando para a Marina, que e o que a 0114 decidiu.
insert into public.subtask_responsaveis (subtask_id, user_id)
values (:ETAPA_D, :RAFAEL)
on conflict do nothing;

-- E UMA FASE DE MES DE SOCIAL, da Marina.
--
-- Ela e uma `subtasks` com `social_papel`, que e o que a 0088 fez da corrente
-- do mes -- e e por isso que ela cabe aqui sem um mes inteiro montado: o que a
-- GUARDA 5 pergunta e a COLUNA, nao a existencia de peca nenhuma.
--
-- E ela e escrita SEM SESSAO, de proposito: `subtasks_protege_o_social` (0088)
-- recusa a escrita das tres colunas de social por quem esta logado, justamente
-- para o colaborador que tem a fase nao virar a propria etapa em portao do
-- cliente. A fixture roda como dono da tabela, e passa.
insert into public.subtasks
  (id, task_id, titulo, status, responsavel_id, prazo, ordem, social_papel)
values
  (:FASE, :DEMANDA, 'Layout', 'nao_iniciada', :MARINA, '2027-04-18', 5, 'producao');

-- A ETAPA QUE PEDE AVAL DO CLIENTE, para a trava do PASSO 5 ter o que recusar.
update public.subtasks
   set requer_aprovacao = true, tipo_aprovacao = 'cliente'
 where id = :ETAPA_A;


-- ---------------------------------------------------------------------------
-- A SEGUNDA DEMANDA, E ELA EXISTE PARA A BUSCA POR TITULO (0147)
--
-- Ela e uma SEGUNDA e nao mais quatro etapas na primeira, por uma razao de
-- medicao: o cenario de cima conta *as cinco etapas da demanda*, e pendurar
-- as da busca ali trocaria o numero de um cenario que mede outra coisa --
-- quem lesse a falha iria atras da policy, que esta certa.
--
-- E o titulo dela NAO carrega "video", de proposito: a busca casa com o
-- titulo da DEMANDA tambem, entao um titulo com o termo dentro faria toda
-- etapa dela casar e as distincoes abaixo deixariam de distinguir nada.
--
-- SAO CINCO ETAPAS E NENHUMA E DE ENFEITE -- cada uma e um caso:
--
--   `Video institucional`  uma pessoa, e o ACENTO: buscar "video" sem acento
--                          tem de achar "Video" com ele, que e o que
--                          `sem_acento()` (0073) existe para fazer e o que
--                          nenhuma etapa da fixture antiga podia provar,
--                          porque os titulos de lá sao todos sem acento
--   `Videos do mes`        a AGRUPADORA, que fica fora da busca (0022)
--   `Video 1 do mes`       a filha dela, que entra -- e ela tem DUAS pessoas,
--                          entao ela volta em DUAS linhas
--   `Video sem dono`       sem responsavel, que e um estado que o produto
--                          desenha (0114): ela volta com a pessoa nula
--   `Video do rascunho`    numa demanda NAO publicada, e a demanda e DO BRUNO
--                          -- sem isso o cenario mediria a RLS restritiva da
--                          0028 e nao o `publicada_em is not null` da funcao
-- ---------------------------------------------------------------------------
insert into public.tasks
  (id, client_id, titulo, status, criado_por, publicada_em, link_entrega)
values
  (:DEMANDA_V, :VERDE, 'Institucional do trimestre', 'nao_iniciada', :CARLA,
   now(), 'https://drive.google.com/drive/folders/institucional');

insert into public.subtasks
  (id, task_id, titulo, status, responsavel_id, prazo, ordem)
values
  (:ETAPA_V, :DEMANDA_V, 'Vídeo institucional', 'nao_iniciada', :BRUNO, '2027-05-10', 1),
  (:ETAPA_G, :DEMANDA_V, 'Videos do mes',       'nao_iniciada', :BRUNO, '2027-05-12', 2),
  (:ETAPA_S, :DEMANDA_V, 'Video sem dono',      'nao_iniciada', null,   '2027-05-16', 4);

-- A FILHA ENTRA DEPOIS DA MAE, senao nao ha a quem pendurar -- e e o insert
-- dela que faz da `Videos do mes` uma agrupadora.
insert into public.subtasks
  (id, task_id, parent_id, titulo, status, responsavel_id, prazo, ordem)
values
  (:ETAPA_F, :DEMANDA_V, :ETAPA_G, 'Video 1 do mes', 'nao_iniciada', :MARINA,
   '2027-05-14', 1);

insert into public.subtask_responsaveis (subtask_id, user_id)
values (:ETAPA_F, :RAFAEL)
on conflict do nothing;

-- O RASCUNHO E DO BRUNO, e e ele quem busca nos cenarios abaixo.
insert into public.tasks
  (id, client_id, titulo, status, criado_por, publicada_em)
values
  (:RASCUNHO, :VERDE, 'Pensando no trimestre', 'nao_iniciada', :BRUNO, null);

insert into public.subtasks
  (id, task_id, titulo, status, responsavel_id, ordem)
values
  (:ETAPA_R, :RASCUNHO, 'Video do rascunho', 'nao_iniciada', :BRUNO, 1);


-- ---------------------------------------------------------------------------
-- 1. A PAUTA E DE TODOS: o que o item 22 pedia JA ERA do banco
--
-- `subtasks_select` e `is_staff()` desde a 0007 e `profiles_select` passou a
-- ser `is_staff() and role <> 'cliente'` na 0132. Estes dois cenarios existem
-- para registrar isso MEDIDO: o item 22 era TELA, e o unico SQL dele e o
-- `revoke` do PASSO 1 mais a policy de UPDATE do PASSO 2.
-- ---------------------------------------------------------------------------
select teste.cenario('O Bruno le as cinco etapas da demanda, inclusive as que nao sao dele',
  :BRUNO,
  format($fmt$select 1 from public.subtasks where task_id = %L$fmt$, :DEMANDA),
  'ok', 5);

select teste.cenario('E le o nome de quem as faz', :BRUNO,
  format($fmt$select 1 from public.profiles where id in (%L, %L)$fmt$, :BRUNO, :MARINA),
  'ok', 2);

-- E O CLIENTE CONTINUA FORA, que e a outra metade de toda policy deste
-- produto: a pauta e de toda a EQUIPE, nao de quem contratou.
select teste.cenario('A Joana nao le etapa nenhuma desta demanda', :JOANA,
  format($fmt$select 1 from public.subtasks where task_id = %L$fmt$, :DEMANDA),
  'ok', 0);


-- ---------------------------------------------------------------------------
-- 2. O CENARIO QUE JUSTIFICA O ARQUIVO
--
-- Antes da 0144 este update daria ZERO LINHAS: `subtasks_update` era
-- `is_atendimento() or <e o responsavel>`, e o Bruno nao e nenhum dos dois.
-- ---------------------------------------------------------------------------
select teste.cenario('O Bruno muda o prazo de uma etapa da Marina', :BRUNO,
  format($fmt$update public.subtasks set prazo = '2027-04-20' where id = %L$fmt$, :ETAPA_M),
  'ok', 1);

select teste.conferir('E a etapa passou a ser dele',
  (select responsavel_id::text from public.subtasks where id = :ETAPA_M),
  :BRUNO);

select teste.conferir('Com a linha no historico, dizendo o dono antigo e o novo',
  (select format('%s->%s', de_valor, para_valor) from public.task_history
    where subtask_id = :ETAPA_M and acao = 'assumiu_a_etapa'),
  format('%s->%s', :MARINA, :BRUNO));

-- E O VINCULO DA 0114 ACOMPANHOU SOZINHO: `subtasks_vincula_o_responsavel`
-- dispara no `after update` da coluna e TIRA a pessoa antiga -- e e por isso
-- que o takeover nao escreve em `subtask_responsaveis` por conta propria.
select teste.conferir('E o vinculo da 0114 trocou junto, sem um segundo insert',
  (select string_agg(user_id::text, ',') from public.subtask_responsaveis
    where subtask_id = :ETAPA_M),
  :BRUNO);


-- ---------------------------------------------------------------------------
-- 3. NA PROPRIA PAUTA NAO HA O QUE ASSUMIR, NEM O QUE REGISTRAR
--
-- A pauta propria se edita o dia inteiro, e e justamente o ruido que a 0035
-- recusa de proposito -- *"salvar o titulo de uma etapa nao e um evento de
-- fluxo"*. Sem este cenario, uma versao que registrasse TODA edicao passaria.
-- ---------------------------------------------------------------------------
select teste.cenario('O Bruno muda o prazo da PROPRIA etapa', :BRUNO,
  format($fmt$update public.subtasks set prazo = '2027-04-11' where id = %L$fmt$, :ETAPA_B),
  'ok', 1);

select teste.conferir('E nada foi registrado',
  (select count(*)::text from public.task_history
    where subtask_id = :ETAPA_B and acao in ('assumiu_a_etapa', 'editou_a_etapa')),
  '0');


-- ---------------------------------------------------------------------------
-- 4. A GESTAO E O ATENDIMENTO ALTERAM SEM ASSUMIR
--
-- E o pedido do usuario em quantas palavras. O que eles NAO escapam e o
-- registro: a alteracao em etapa alheia fica no feed, com autor e hora.
-- ---------------------------------------------------------------------------
select teste.cenario('A Ana (socia) muda o prazo de uma etapa da Marina', :ANA,
  format($fmt$update public.subtasks set prazo = '2027-04-22' where id = %L$fmt$, :ETAPA_A),
  'ok', 1);

select teste.conferir('E a etapa continua sendo da Marina',
  (select responsavel_id::text from public.subtasks where id = :ETAPA_A),
  :MARINA);

select teste.conferir('Mas a alteracao ficou registrada, no nome dela',
  (select autor_id::text from public.task_history
    where subtask_id = :ETAPA_A and acao = 'editou_a_etapa'),
  :ANA);

select teste.cenario('O Atendimento tambem altera sem assumir', :CARLA,
  format($fmt$update public.subtasks set prioridade = 'alta' where id = %L$fmt$, :ETAPA_A),
  'ok', 1);

select teste.conferir('E a etapa continua sendo da Marina',
  (select responsavel_id::text from public.subtasks where id = :ETAPA_A),
  :MARINA);


-- ---------------------------------------------------------------------------
-- 5. O TERCEIRO CENARIO: o status nao vira uma segunda linha
--
-- `subtasks_registra_status` (0035) ja gravou `status_da_etapa`. Uma linha de
-- `editou_a_etapa` ao lado dela diria o mesmo fato duas vezes no feed, e o
-- status e a alteracao mais comum da pauta.
-- ---------------------------------------------------------------------------
select teste.conferir('A etapa da Marina esta em nao_iniciada antes do passo',
  (select status::text from public.subtasks where id = :ETAPA_D),
  'nao_iniciada');

select teste.cenario('A Carla move o status de uma etapa da Marina', :CARLA,
  format($fmt$update public.subtasks set status = 'em_andamento' where id = %L$fmt$, :ETAPA_D),
  'ok', 1);

select teste.conferir('A 0035 registrou a mudanca de status',
  (select count(*)::text from public.task_history
    where subtask_id = :ETAPA_D and acao = 'status_da_etapa'),
  '1');

select teste.conferir('E a 0144 NAO acrescentou uma segunda linha',
  (select count(*)::text from public.task_history
    where subtask_id = :ETAPA_D and acao = 'editou_a_etapa'),
  '0');


-- ---------------------------------------------------------------------------
-- 6. O CENARIO QUE SEPARA O CERTO DO PLAUSIVEL
--
-- O Rafael e a SEGUNDA pessoa da etapa pela tabela da 0114, e a coluna aponta
-- para a Marina. Lendo so a coluna, ele seria promovido a primeira pessoa no
-- instante em que mexesse na PROPRIA etapa.
-- ---------------------------------------------------------------------------
select teste.conferir('O Rafael esta no vinculo da etapa, e a coluna e da Marina',
  (select format('%s|%s',
            (select count(*) from public.subtask_responsaveis
              where subtask_id = :ETAPA_D and user_id = :RAFAEL),
            (select responsavel_id from public.subtasks where id = :ETAPA_D))),
  format('1|%s', :MARINA));

select teste.cenario('O Rafael muda a estimativa da etapa que ele faz', :RAFAEL,
  format($fmt$update public.subtasks set estimativa_minutos = 120 where id = %L$fmt$, :ETAPA_D),
  'ok', 1);

select teste.conferir('E a coluna continua apontando para a Marina',
  (select responsavel_id::text from public.subtasks where id = :ETAPA_D),
  :MARINA);

select teste.conferir('E nada foi registrado, porque a etapa ja era dele',
  (select count(*)::text from public.task_history
    where subtask_id = :ETAPA_D and acao in ('assumiu_a_etapa', 'editou_a_etapa')),
  '0');


-- ---------------------------------------------------------------------------
-- 7. QUEM ESCREVE O NOME MANDA (0041)
--
-- Se a alteracao E a troca de responsavel, a pessoa nomeou alguem de proposito
-- -- sobrescrever seria *aceitar e desfazer calado*, que a 0025 diz ser pior
-- que recusar com explicacao. E a linha de registro pega o caso de qualquer
-- forma.
-- ---------------------------------------------------------------------------
select teste.cenario('O Bruno passa uma etapa da Marina para o Rafael', :BRUNO,
  format($fmt$update public.subtasks set responsavel_id = %L where id = %L$fmt$,
    :RAFAEL, :ETAPA_A),
  'ok', 1);

select teste.conferir('E ela ficou com o Rafael, e nao com o Bruno',
  (select responsavel_id::text from public.subtasks where id = :ETAPA_A),
  :RAFAEL);

-- UMA LINHA DO BRUNO, e as outras duas sao da Ana e da Carla -- a mesma etapa
-- passou por tres maos neste arquivo, e cada uma deixou a sua.
select teste.conferir('E a passagem ficou registrada no nome do Bruno',
  (select string_agg(distinct autor_id::text, ',' order by autor_id::text)
     from public.task_history
    where subtask_id = :ETAPA_A and acao = 'editou_a_etapa'),
  (select string_agg(distinct u::text, ',' order by u::text)
     from unnest(array[:ANA, :CARLA, :BRUNO]::uuid[]) u));


-- ---------------------------------------------------------------------------
-- 8. O QUE O PASSO 2 NAO ABRIU: a exigencia de aval
--
-- Com `subtasks_update` em `is_staff()`, quem nao e gestao nem Atendimento
-- poderia desligar `requer_aprovacao` e concluir em seguida --
-- `subtasks_bloqueia_conclusao_sem_aprovacao` (0007) contornada por um
-- booleano. A recusa diz o caminho, que e a 0023.
-- ---------------------------------------------------------------------------
select teste.recusa_com('O Bruno nao desliga a exigencia de aval', :BRUNO,
  format($fmt$update public.subtasks set requer_aprovacao = false where id = %L$fmt$, :ETAPA_A),
  'Quem decide se esta etapa precisa de aprovacao');

select teste.recusa_com_dica('E a recusa diz onde se muda', :BRUNO,
  format($fmt$update public.subtasks set requer_aprovacao = false where id = %L$fmt$, :ETAPA_A),
  'Gestao de Tasks');

select teste.recusa_com('Nem troca o escopo do aval', :BRUNO,
  format($fmt$update public.subtasks set tipo_aprovacao = 'interna' where id = %L$fmt$, :ETAPA_A),
  'Quem decide se esta etapa precisa de aprovacao');

select teste.cenario('A Ana desliga, porque a exigencia e de quem abre a demanda', :ANA,
  format($fmt$update public.subtasks set requer_aprovacao = false, tipo_aprovacao = null
     where id = %L$fmt$, :ETAPA_A),
  'ok', 1);

-- E A CONCLUSAO CONTINUA TRAVADA onde a exigencia ficou de pe: a 0144 nao
-- afrouxou a 0007, ela so impediu que a exigencia fosse desligada por fora.
update public.subtasks
   set requer_aprovacao = true, tipo_aprovacao = 'cliente'
 where id = :ETAPA_B;

select teste.recusa_com('O Bruno nao conclui a propria etapa sem a rodada aprovada', :BRUNO,
  format($fmt$update public.subtasks set status = 'concluida' where id = %L$fmt$, :ETAPA_B),
  'aprova');


-- ---------------------------------------------------------------------------
-- 9. O QUE O PASSO 2 NAO ABRIU: a corrente de um mes de social
--
-- Esta e a recusa que a BATERIA achou, e nao a leitura do pedido. Com o PASSO
-- 2 solto, tres cenarios do arquivo 22 caem -- e dois deles em CASCATA, que e
-- o que mede o tamanho do furo: dando a si mesmo a fase `Pauta` de um mes,
-- `tenho_etapa_no_post()` (0047) passa a ser verdadeira, e com ela vem a
-- escrita no CARD de todas as pecas daquele mes.
--
-- O cenario de la e `E o Design nao distribui etapa que nao e dele`, e ele
-- MUDOU DE FORMA na 0144: era zero linha pela policy, e passou a ser excecao
-- pelo trigger. A regra do mes de social nao mudou em nada.
-- ---------------------------------------------------------------------------
select teste.conferir('O gatilho que recusa existe, e roda ANTES do takeover',
  (select string_agg(tgname, ',' order by tgname) from pg_trigger
    where tgrelid = 'public.subtasks'::regclass
      and tgname in ('subtasks_o_que_e_de_quem_abre', 'subtasks_quem_mexe_assume')),
  'subtasks_o_que_e_de_quem_abre,subtasks_quem_mexe_assume');

-- A TROCA EXPLICITA e recusada pelo gatilho do PASSO 5, com a frase que diz
-- onde a fase se redistribui.
select teste.recusa_com('O Bruno nao passa a fase do mes para si', :BRUNO,
  format($fmt$update public.subtasks set responsavel_id = %L where id = %L$fmt$,
    :BRUNO, :FASE),
  'Quem distribui a corrente de um mes de social');

select teste.recusa_com_dica('E a recusa manda para o Social Media', :BRUNO,
  format($fmt$update public.subtasks set responsavel_id = %L where id = %L$fmt$,
    :BRUNO, :FASE),
  'Social Media');

-- ---------------------------------------------------------------------------
-- O CENARIO QUE A ORDEM DOS GATILHOS EXIGE, e ele e o unico que mede a
-- GUARDA 5.
--
-- A recusa de cima NAO cobre o takeover, e o cenario acima e a razao: o
-- gatilho dela pergunta `new.responsavel_id is distinct from old`, e os dois
-- sao `before update` -- entao o Postgres os roda em ordem ALFABETICA,
-- `subtasks_o_que_e_de_quem_abre` antes de `subtasks_quem_mexe_assume`. No
-- caminho do takeover a coluna AINDA NAO TROCOU quando ele pergunta: a troca
-- acontece depois, dentro do outro gatilho.
--
-- Quer dizer que a GUARDA 5 nao e uma segunda trava de um caso que a recusa
-- do PASSO 5 ja pega -- ela e a UNICA coisa entre um `update` de prazo e a
-- fase do mes trocando de dono em silencio. Sem este cenario, tira-la nao
-- derrubava nada, e o teste de mutacao e que mostrou: zero falhas, num ramo
-- que protege o mes inteiro de uma conta.
-- ---------------------------------------------------------------------------
select teste.cenario('O Bruno muda o prazo da fase do mes', :BRUNO,
  format($fmt$update public.subtasks set prazo = '2027-04-20' where id = %L$fmt$, :FASE),
  'ok', 1);

select teste.conferir('E a fase continua sendo da Marina',
  (select responsavel_id::text from public.subtasks where id = :FASE),
  :MARINA);

-- E NADA FOI REGISTRADO: a fase nao e uma pauta pessoal que alguem assume, e
-- uma linha de `editou_a_etapa` aqui poria no feed da demanda do mes um
-- "alterou a etapa" por cada mexida de prazo de cada fase.
select teste.conferir('E nada foi registrado na fase',
  (select count(*)::text from public.task_history
    where subtask_id = :FASE and acao in ('assumiu_a_etapa', 'editou_a_etapa')),
  '0');


-- ---------------------------------------------------------------------------
-- 10. O QUE A 0144 NAO ABRIU, E NAO E COLUNA: abrir e apagar etapa
--
-- `subtasks_insert` e `subtasks_delete` continuam `is_atendimento()`. Abrir
-- trabalho e destruir trabalho sao duas decisoes, e nenhuma das duas e
-- "alterar uma pauta" -- e a separacao da 0006, que a 0144 nao encosta.
-- ---------------------------------------------------------------------------
select teste.cenario('O Bruno nao abre etapa nova na demanda', :BRUNO,
  format($fmt$insert into public.subtasks (task_id, titulo, ordem)
     values (%L, 'etapa que eu inventei', 9)$fmt$, :DEMANDA),
  'recusa');

select teste.cenario('Nem apaga a etapa de outra pessoa', :BRUNO,
  format($fmt$delete from public.subtasks where id = %L$fmt$, :ETAPA_D),
  'ok', 0);

select teste.cenario('Nem a propria', :BRUNO,
  format($fmt$delete from public.subtasks where id = %L$fmt$, :ETAPA_B),
  'ok', 0);


-- ---------------------------------------------------------------------------
-- 11. `carga_da_equipe()` PERDEU O EXECUTE DO `anon`
--
-- A 0055 a criou sem `revoke`, e o Postgres concede `execute` a `public` em
-- toda funcao nova. Nao era furo -- ela nao e `security definer`, e a RLS de
-- `profiles` e `team_members` devolve zero para `anon` --, era inconsistencia:
-- a protecao dela era inteira a RLS de duas tabelas, e a 0132 acabara de
-- alargar uma delas.
--
-- MEDIDO PELO PRIVILEGIO e nao pela mensagem de recusa, que e a licao da
-- 0071: uma funcao pode recusar por dentro e continuar executavel, e aí o que
-- se mediu foi o corpo dela, nao a porta.
-- ---------------------------------------------------------------------------
select teste.conferir('O anon nao executa mais carga_da_equipe',
  has_function_privilege('anon', 'public.carga_da_equipe(date,date)', 'EXECUTE')::text,
  'false');

select teste.conferir('E a equipe continua executando',
  has_function_privilege('authenticated', 'public.carga_da_equipe(date,date)', 'EXECUTE')::text,
  'true');

-- E `e_responsavel_pela_etapa()` NASCEU FECHADA: quem a chama sao os dois
-- gatilhos, que sao `security definer` e rodam com os privilegios do dono.
select teste.conferir('E a pergunta do vinculo nao e alcancavel de fora',
  format('%s|%s',
    has_function_privilege('anon', 'public.e_responsavel_pela_etapa(uuid,uuid)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.e_responsavel_pela_etapa(uuid,uuid)', 'EXECUTE')::text),
  'false|false');


-- ---------------------------------------------------------------------------
-- 12. ACHAR A ETAPA PELO TITULO (migration 0147)
--
-- Decisao do usuario, na segunda metade do item 1: *"poder pesquisar por
-- titulo, para achar a task caso nao lembre quem fez"*.
--
-- A FRASE DECIDE QUE A BUSCA E DA EQUIPE INTEIRA, e nao da pessoa escolhida:
-- uma busca que exige o nome primeiro nao responde nada a quem nao lembra o
-- nome. Entao a resposta de cada linha e a PESSOA, e e por isso que os
-- cenarios abaixo leem `pessoa` e nao so contam.
--
-- E ELA E `invoker` E NAO `security definer`, que e a linha que mais importa:
-- a RLS de `subtasks` (0007) e de `profiles` (0132) ja permite, e manter a
-- funcao `invoker` e o que impede ela de ser a porta dos fundos da tabela.
-- Por isso TODO cenario desta secao passa por `conferir_como`, que entra como
-- `authenticated` e seta o `sub` -- medir como dono do banco nao mediria nada.
-- ---------------------------------------------------------------------------

-- O CENARIO DO PEDIDO: o Bruno, que e Design e nao e gestao, acha a etapa da
-- Marina sem saber que ela e da Marina -- e a busca diz de quem ela e.
select teste.conferir_como('O Bruno acha a etapa de outra pessoa, e a busca diz de quem ela e',
  :BRUNO,
  $q$select string_agg(pessoa, ', ' order by pessoa)
       from public.pauta_por_titulo('video 1')$q$,
  'Marina Costa, Rafael Dias');

-- O ACENTO NAO IMPORTA, nos dois sentidos -- e e o unico cenario da bateria
-- que mede isso num titulo de etapa, porque os titulos da fixture antiga sao
-- todos sem acento.
select teste.conferir_como('O acento nao importa: "video" acha "Video"',
  :BRUNO,
  $q$select etapa from public.pauta_por_titulo('video institucional')$q$,
  'Vídeo institucional');

select teste.conferir_como('E a caixa tambem nao',
  :BRUNO,
  $q$select etapa from public.pauta_por_titulo('VIDEO INSTITUCIONAL')$q$,
  'Vídeo institucional');

-- O PISO DE DUAS LETRAS, que e o que impede uma letra de varrer a agencia
-- inteira enquanto a pessoa digita.
select teste.conferir_como('Uma letra nao busca nada',
  :BRUNO,
  $q$select count(*)::text from public.pauta_por_titulo('v')$q$,
  '0');

-- A AGRUPADORA FICA FORA E A FILHA ENTRA, e os dois num cenario so: "do mes"
-- casa com as duas, e so uma volta.
select teste.conferir_como('A agrupadora fica fora da busca, e a filha dela entra',
  :BRUNO,
  $q$select string_agg(distinct etapa, ' + ' order by etapa)
       from public.pauta_por_titulo('do mes')$q$,
  'Video 1 do mes');

-- A ETAPA SEM DONO VOLTA, DIZENDO QUE NAO TEM -- descarta-la seria esconder
-- justamente o pior tipo de trabalho, o que existe e ninguem sabe que e seu.
select teste.conferir_como('A etapa sem dono volta, com a pessoa nula',
  :BRUNO,
  $q$select format('%s|%s', etapa, coalesce(pessoa, 'sem dono'))
       from public.pauta_por_titulo('video sem dono')$q$,
  'Video sem dono|sem dono');

-- O RASCUNHO FICA FORA, E ELE E DO BRUNO: os dois cenarios juntos e que
-- separam as duas metades -- o segundo prova que a RLS DEIXA ele ler a etapa,
-- entao quem a esconde da busca e o `publicada_em is not null` da funcao.
select teste.conferir_como('O rascunho fica fora da busca',
  :BRUNO,
  $q$select count(*)::text from public.pauta_por_titulo('video do rascunho')$q$,
  '0');

select teste.conferir_como('E nao e a RLS que o esconde: o rascunho e dele, e ele le a etapa',
  :BRUNO,
  format($q$select count(*)::text from public.subtasks where id = %L$q$, :ETAPA_R),
  '1');

-- A SEGUNDA PESSOA E UMA SEGUNDA LINHA, E `total` CONTA ETAPAS.
--
-- E o cenario que separa linha de etapa, e ele existe porque a funcao devolve
-- uma linha por (etapa, pessoa) de proposito: `check:tipos` nao confere a
-- FORMA de um `returns table`, entao um jsonb de pessoas ali seria um molde
-- que nenhuma verificacao olha. Quem agrupa e a tela, e `total` e o que ela
-- usa para dizer quantas ficaram de fora do corte.
--
-- "video" casa com quatro etapas e volta tres: a institucional (1 linha), a
-- filha (2 linhas, duas pessoas), a sem dono (1 linha) -- a agrupadora e o
-- rascunho ficam fora.
select teste.conferir_como('Sao quatro linhas para tres etapas, e o total conta as etapas',
  :BRUNO,
  $q$select format('%s linhas, total %s', count(*), max(total))
       from public.pauta_por_titulo('video')$q$,
  '4 linhas, total 3');

-- E A BUSCA CASA COM O TITULO DA DEMANDA TAMBEM, que e a outra metade do
-- pedido -- quem lembra a campanha e nao a etapa acha pela campanha. E a
-- linha volta com o nome da conta, que e o join com `clients`.
select teste.conferir_como('O nome da demanda tambem acha, e a linha diz a conta',
  :BRUNO,
  $q$select distinct cliente
       from public.pauta_por_titulo('institucional do trimestre')$q$,
  'Mundo Verde');

-- E A CLIENTE NAO ACHA NADA, que e o cenario que prova a decisao do
-- `invoker`: a RLS de `subtasks` vale DENTRO da funcao. Com `security
-- definer` ela devolveria a pauta da agencia para quem contratou.
select teste.conferir_como('A Joana nao acha etapa nenhuma',
  :JOANA,
  $q$select count(*)::text from public.pauta_por_titulo('video')$q$,
  '0');

-- E O PRIVILEGIO E MEDIDO, nao a mensagem de recusa -- a licao da 0071: uma
-- funcao pode recusar por dentro e continuar executavel pelo `anon`, e ai o
-- que se mediu foi o corpo dela e nao a porta.
select teste.conferir('O anon nao executa a busca da pauta',
  format('%s|%s',
    has_function_privilege('anon', 'public.pauta_por_titulo(text,integer)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.pauta_por_titulo(text,integer)', 'EXECUTE')::text),
  'false|true');

-- E ELA NAO E `security definer`, medido no catalogo e nao na intencao.
select teste.conferir('E ela nao e security definer',
  (select prosecdef::text from pg_proc
    where oid = 'public.pauta_por_titulo(text,integer)'::regprocedure),
  'false');
