\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set PAULO   '''99999999-9999-9999-9999-999999999999'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

\set SEMP    '''47000000-0000-0000-0000-0000000000c1'''

-- ===========================================================================
-- 47 - QUEM RECEBE A APROVACAO DO CLIENTE (migration 0128)
--
-- Decisao do usuario, item 14: ao enviar um material ao cliente, escolher quem
-- aprova e obrigatorio; o envio registra quem mandou, quem recebeu e quando; a
-- pessoa escolhida e avisada; e a pendencia aparece.
--
-- ---------------------------------------------------------------------------
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "a conta sem ninguem no portal
-- recusa o envio, nomeando a empresa" -- e ele existe por uma MEDICAO, nao por
-- uma suposicao: das 28 contas do banco de producao, UMA tem alguem com acesso
-- ao portal. Quer dizer que hoje o material enviado para as outras 27 nao
-- chega a pessoa nenhuma, e nada na tela diz isso. A trava nao cria o
-- problema: ela o revela, e a recusa diz onde consertar.
--
-- E O CENARIO QUE SEPARA O CERTO DO PLAUSIVEL e "o aviso vai para UMA pessoa".
-- Antes da 0128 o gatilho avisava toda a empresa, em laco. Nomear um aprovador
-- e continuar cobrando todos seria um campo que nao decide nada -- o pior tipo
-- de campo (0023) --, e a Mundo Verde tem DUAS pessoas no portal desde o
-- arquivo 14, o que e exatamente o que permite medir a diferenca. Com uma so,
-- o laco e o aviso unico dariam o mesmo numero.
-- ===========================================================================

select teste.limpar();

-- A LIMPEZA E A DO ARQUIVO 43, e a ordem dela e a de `apagar_mes_de_social()`:
-- o material sai antes da casca. `teste.limpar()` ja tira o post de um mes de
-- social; o avulso e deste arquivo, e sai aqui.
delete from public.social_lotes;
delete from public.comments;
delete from public.post_versions;
delete from public.posts;
delete from public.notifications;

-- A CONTA SEM NINGUEM NO PORTAL. Ela comeca vazia de proposito: e o estado de
-- 27 das 28 contas de producao, e e o unico em que a recusa da secao 2 tem o
-- que recusar.
insert into public.clients (id, nome_empresa, nome_contato, email_contato, slug, ativo)
values (:SEMP, 'Sem Portal Ltda', 'Sueli', 'sueli@semportal.com', 'sem-portal', true)
on conflict (id) do nothing;

delete from public.client_users where client_id = :SEMP;


-- ---------------------------------------------------------------------------
-- 1. A LISTA DE QUEM APROVA E DA EQUIPE, e ela e a mesma que a trava consulta
--
-- Duas funcoes respondendo "quem aprova por esta conta" seriam dois lugares
-- para divergir, e o que divergiria e o da TELA -- o modal ofereceria alguem
-- que o banco recusa, e a recusa chegaria depois do clique.
-- ---------------------------------------------------------------------------
select teste.conferir_como('A Mundo Verde tem as duas pessoas do portal', :ANA,
  format($fmt$select string_agg(nome, ', ' order by nome)
     from public.aprovadores_da_conta(%L)$fmt$, :VERDE),
  'Joana Verde, Paulo Verde');

select teste.conferir_como('A Optica tem uma', :DIEGO,
  format($fmt$select string_agg(nome, ', ') from public.aprovadores_da_conta(%L)$fmt$, :OPTICA),
  'Otto Visao');

-- LISTA VAZIA E UMA RESPOSTA, e nao uma falha: e por isso que a funcao nao
-- recusa a conta sem portal. Quem recusa e quem ENVIA.
select teste.conferir_como('A conta sem portal devolve zero, sem estourar', :ANA,
  format($fmt$select count(*)::text from public.aprovadores_da_conta(%L)$fmt$, :SEMP),
  '0');

-- O COLABORADOR LE, porque quem produz abre o painel do post e precisa saber
-- quem vai receber -- `is_staff()` e nao `is_gestor()`.
select teste.cenario('O colaborador tambem le a lista', :CARLA,
  format($fmt$select 1 from public.aprovadores_da_conta(%L)$fmt$, :VERDE), 'ok', 2);

-- E O CLIENTE NAO LE. A funcao e `security definer`, entao a RLS de
-- `client_users` nao a alcanca por dentro: a guarda e escrita a mao, e e ela
-- que impede a lista de contatos de uma conta de sair para quem tem a chave.
select teste.recusa_com('A Joana nao le quem aprova pela conta dela', :JOANA,
  format($fmt$select 1 from public.aprovadores_da_conta(%L)$fmt$, :VERDE),
  'Só a equipe lê quem aprova pela conta');


-- ---------------------------------------------------------------------------
-- 2. O MATERIAL, E AS TRES RECUSAS DO ENVIO
--
-- Um post avulso da Mundo Verde, com a arte e o aval interno aprovados: o
-- estado em que a unica coisa que falta e a decisao do cliente.
-- ---------------------------------------------------------------------------
select teste.cenario('A gestao abre o post', :ANA,
  format($fmt$insert into public.posts
    (id, client_id, tema, data_publicacao, plataformas, midia, criado_por,
     responsavel_id, arte_url)
   values ('47000000-0000-0000-0000-00000000a001', %L, 'Promocao de abril',
           '2027-04-10', '{instagram}', 'imagem', %L, %L, 'verde/arte.png')$fmt$,
    :VERDE, :ANA, :BRUNO), 'ok', 1);

select teste.cenario('O Bruno pede o aval interno', :BRUNO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a001', 1, 'interna', %L)$fmt$,
    :BRUNO), 'ok', 1);

select teste.cenario('E o Diego aprova', :DIEGO,
  format($fmt$update public.approval_rounds set status = 'aprovada',
         decidido_por = %L, decidido_em = now()
    where content_id = '47000000-0000-0000-0000-00000000a001'
      and escopo = 'interna'$fmt$, :DIEGO), 'ok', 1);

-- RECUSA 1: SEM NINGUEM NOMEADO.
--
-- Ela e inalcancavel pela tela -- o modal nao solta o botao sem a escolha --, e
-- e exatamente por isso que ela e trava de banco: o que ela cobre e o PATCH
-- montado a mao, que e o caminho que ninguem duvidava.
select teste.recusa_com_dica('Sem aprovador nomeado, o envio nao sai', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a001', 1, 'cliente', %L)$fmt$,
    :ANA),
  'O envio registra quem recebeu');

select teste.recusa_com('E a frase diz o que fazer', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a001', 1, 'cliente', %L)$fmt$,
    :ANA),
  'Escolha quem vai aprovar este material');

-- RECUSA 2: ALGUEM DE OUTRA CONTA.
--
-- E a recusa NOMEIA a empresa, que e a decisao da 0023: "essa pessoa nao
-- aprova" manda procurar qual conta e a certa; dizer qual e a instrucao. Otto
-- e cliente de verdade, com acesso ao portal -- da Optica.
select teste.recusa_com('O Otto nao aprova pela Mundo Verde', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, aprovador_id, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a001', 1, 'cliente', %L, %L)$fmt$,
    :OTTO, :ANA),
  'não aprova pela Mundo Verde');

-- E NEM A ANA, que e da AGENCIA. A pergunta e `client_users`, e nao "existe um
-- profile com este id" -- sem ela, qualquer uuid de pessoa passaria.
select teste.recusa_com('Nem alguem da equipe aprova pela conta', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, aprovador_id, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a001', 1, 'cliente', %L, %L)$fmt$,
    :ANA, :ANA),
  'não aprova pela Mundo Verde');

-- A PESSOA DESLIGADA TAMBEM NAO, e este cenario e o unico que mede o `ativo`
-- de `aprovadores_da_conta()`. Sem ele, tirar aquele filtro nao derrubaria
-- nada -- e a tela passaria a oferecer quem perdeu o acesso.
update public.profiles set ativo = false where id = :PAULO;

select teste.recusa_com('O Paulo desligado nao aprova mais', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, aprovador_id, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a001', 1, 'cliente', %L, %L)$fmt$,
    :PAULO, :ANA),
  'não aprova pela Mundo Verde');

select teste.conferir_como('E ele sai da lista que a tela oferece', :ANA,
  format($fmt$select string_agg(nome, ', ') from public.aprovadores_da_conta(%L)$fmt$, :VERDE),
  'Joana Verde');

update public.profiles set ativo = true where id = :PAULO;


-- ---------------------------------------------------------------------------
-- 3. A RECUSA DA CONTA SEM NINGUEM NO PORTAL
--
-- Ela vem ANTES da escolha, e a ordem e a decisao: "escolha quem aprova" numa
-- conta onde nao ha ninguem para escolher e uma recusa que a pessoa nao tem
-- como satisfazer -- e o portao ficaria fechado para sempre, que e a licao da
-- 0076.
-- ---------------------------------------------------------------------------
select teste.cenario('Um post da conta sem portal', :ANA,
  format($fmt$insert into public.posts
    (id, client_id, tema, data_publicacao, plataformas, midia, criado_por,
     responsavel_id, arte_url)
   values ('47000000-0000-0000-0000-00000000a002', %L, 'Abertura da loja',
           '2027-04-12', '{instagram}', 'imagem', %L, %L, 'semp/arte.png')$fmt$,
    :SEMP, :ANA, :BRUNO), 'ok', 1);

select teste.cenario('Com o aval interno aprovado', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, status, solicitado_por,
     decidido_por, decidido_em)
   values ('post', '47000000-0000-0000-0000-00000000a002', 1, 'interna',
           'aprovada', %L, %L, now())$fmt$, :BRUNO, :DIEGO), 'ok', 1);

select teste.recusa_com('A conta sem portal recusa o envio, nomeando a empresa', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a002', 1, 'cliente', %L)$fmt$,
    :ANA),
  'A Sem Portal Ltda ainda não tem ninguém com acesso ao portal');

select teste.recusa_com_dica('E a dica manda para onde se da o acesso', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a002', 1, 'cliente', %L)$fmt$,
    :ANA),
  'Gestão de Pessoas › Clientes');

-- NOMEAR ALGUEM NAO CONTORNA: a falta de acesso e da CONTA, e nao da escolha.
select teste.recusa_com('E nomear a Joana nao contorna a falta de acesso', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, aprovador_id, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a002', 1, 'cliente', %L, %L)$fmt$,
    :JOANA, :ANA),
  'ainda não tem ninguém com acesso ao portal');

-- A CONTA GANHA ACESSO, E O ENVIO PASSA: e a instrucao da recusa, cumprida.
-- Sem este cenario a secao prova que a trava recusa e nao que ela se resolve.
insert into auth.users (id, email) values
  ('47000000-0000-0000-0000-0000000000a9', 'sueli@semportal.com')
on conflict do nothing;

update public.profiles set nome = 'Sueli Portal', role = 'cliente', ativo = true
 where id = '47000000-0000-0000-0000-0000000000a9';

insert into public.client_users (client_id, user_id)
values (:SEMP, '47000000-0000-0000-0000-0000000000a9')
on conflict do nothing;

select teste.cenario('Com a Sueli no portal, o envio passa', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, aprovador_id, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a002', 1, 'cliente',
           '47000000-0000-0000-0000-0000000000a9', %L)$fmt$, :ANA), 'ok', 1);


-- ---------------------------------------------------------------------------
-- 4. A TRAVA NOVA NAO ENGOLIU AS ANTIGAS
--
-- O bloco do aprovador roda ANTES dos tres ramos, entao um post sem aval
-- interno e sem aprovador leva a recusa do aprovador. Este cenario prova que
-- com o aprovador CERTO a trava de baixo continua de pe -- senao a 0128 teria
-- aberto o envio de material nao olhado.
-- ---------------------------------------------------------------------------
select teste.cenario('Um post sem aval interno nenhum', :ANA,
  format($fmt$insert into public.posts
    (id, client_id, tema, data_publicacao, plataformas, midia, criado_por,
     responsavel_id, arte_url)
   values ('47000000-0000-0000-0000-00000000a003', %L, 'Teaser de maio',
           '2027-05-02', '{instagram}', 'imagem', %L, %L, 'verde/teaser.png')$fmt$,
    :VERDE, :ANA, :BRUNO), 'ok', 1);

select teste.recusa_com('Com o aprovador certo, o aval interno continua sendo cobrado', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, aprovador_id, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a003', 1, 'cliente', %L, %L)$fmt$,
    :JOANA, :ANA),
  'ainda não passou pela aprovação interna');

-- E A RODADA INTERNA NAO EXIGE APROVADOR, que e a outra metade: a decisao
-- interna e da gestao, e `aprovador_id` e sobre quem decide DO LADO DE FORA.
select teste.cenario('A rodada interna passa sem aprovador', :BRUNO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por)
   values ('post', '47000000-0000-0000-0000-00000000a003', 1, 'interna', %L)$fmt$,
    :BRUNO), 'ok', 1);


-- ---------------------------------------------------------------------------
-- 5. O QUE O ENVIO REGISTRA
--
-- "Registrar quem enviou, quem recebeu e quando" era meio pedido e meio
-- pronto: `solicitado_por` e `solicitado_em` existem desde a 0007. O que nao
-- existia era quem RECEBEU.
-- ---------------------------------------------------------------------------
select teste.cenario('A gestao envia o post ao cliente, com recado', :ANA,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, aprovador_id, solicitado_por,
     mensagem)
   values ('post', '47000000-0000-0000-0000-00000000a001', 1, 'cliente', %L, %L,
           'Joana, confere o preco do combo antes de aprovar.')$fmt$,
    :JOANA, :ANA), 'ok', 1);

select teste.conferir('A rodada guarda quem enviou e quem recebeu',
  (select format('%s / %s',
            (select nome from public.profiles where id = r.solicitado_por),
            (select nome from public.profiles where id = r.aprovador_id))
     from public.approval_rounds r
    where r.content_id = '47000000-0000-0000-0000-00000000a001'
      and r.escopo = 'cliente'),
  'Ana Souza / Joana Verde');

select teste.conferir('E o quando, que ja existia desde a 0007',
  (select case when solicitado_em is not null then 'tem' else 'falta' end
     from public.approval_rounds
    where content_id = '47000000-0000-0000-0000-00000000a001' and escopo = 'cliente'),
  'tem');

-- A MENSAGEM NAO E O `comentario`, e os dois convivem na mesma linha: um e o
-- que a agencia disse ao MANDAR, o outro e o que o cliente disse ao DECIDIR.
-- Reaproveitar a coluna faria o pedido de ajustes apagar o recado do envio.
select teste.conferir('A mensagem do envio esta na linha, e o comentario vazio',
  (select format('%s | %s', coalesce(mensagem, '-'), coalesce(comentario, '-'))
     from public.approval_rounds
    where content_id = '47000000-0000-0000-0000-00000000a001' and escopo = 'cliente'),
  'Joana, confere o preco do combo antes de aprovar. | -');

select teste.cenario('A Joana pede ajustes, com o motivo dela', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_id = '47000000-0000-0000-0000-00000000a001' and escopo = 'cliente'),
    'ajustes_solicitados', 'O preco do combo esta errado.')$fmt$), 'ok', 1);

select teste.conferir('E as duas frases continuam na linha, cada uma na sua coluna',
  (select format('%s | %s', coalesce(mensagem, '-'), coalesce(comentario, '-'))
     from public.approval_rounds
    where content_id = '47000000-0000-0000-0000-00000000a001' and escopo = 'cliente'),
  'Joana, confere o preco do combo antes de aprovar. | O preco do combo esta errado.');


-- ---------------------------------------------------------------------------
-- 6. O AVISO VAI PARA UMA PESSOA, E NAO PARA A EMPRESA INTEIRA
--
-- Antes da 0128 o gatilho avisava toda a empresa, em laco. A Mundo Verde tem
-- DUAS pessoas no portal, e e isso que faz este bloco medir: com uma so, o
-- laco e o aviso unico dariam o mesmo numero.
-- ---------------------------------------------------------------------------
select teste.conferir('A Joana foi avisada do post que ela recebeu',
  (select count(*)::text from public.notifications
    where user_id = :JOANA and titulo like 'Promocao de abril%'), '1');

select teste.conferir('E o Paulo, que nao recebeu o material, nao foi cobrado',
  (select count(*)::text from public.notifications
    where user_id = :PAULO and titulo like 'Promocao de abril%'), '0');

-- O CORPO DO AVISO E A MENSAGEM DO ENVIO, quando ela existe: e o unico lugar
-- onde o recado chega a pessoa sem ela abrir o portal.
select teste.conferir('O corpo do aviso e o recado que a agencia escreveu',
  (select corpo from public.notifications
    where user_id = :JOANA and titulo like 'Promocao de abril%'),
  'Joana, confere o preco do combo antes de aprovar.');

-- E SEM RECADO ELE DIZ O QUE ACONTECEU, em vez de chegar vazio.
select teste.conferir('A Sueli recebeu o aviso padrao, sem recado nenhum',
  (select corpo from public.notifications
    where user_id = '47000000-0000-0000-0000-0000000000a9'::uuid),
  'A Full enviou e está aguardando a sua decisão.');


-- ---------------------------------------------------------------------------
-- 7. O LOTE RECUSA ANTES DE ESCREVER
--
-- `validar_nova_rodada` e por LINHA, entao num mes de dezoito pecas ele
-- recusaria a decima e deixaria nove rodadas e um lote gravados -- e a
-- mensagem falaria de UMA peca. Por isso `enviar_mes_ao_cliente()` repete as
-- mesmas perguntas ANTES de inserir qualquer coisa, que e a ordem de
-- `abrir_mes_de_social`: ela confere os cinco periodos antes de abrir post
-- nenhum. O que estes cenarios medem e o que SOBROU depois das recusas.
--
-- O FLUXO E SEM AVAL E COM A PAUTA COMO PORTAO de proposito: num portao de
-- ENTREGA o `o_que_falta_no_portao()` recusaria primeiro, por falta de data e
-- de aval -- e a recusa que este bloco existe para medir nunca apareceria.
-- ---------------------------------------------------------------------------
select public.salvar_fluxo_de_social(
  'Fluxo 47 sem aval',
  jsonb_build_array(
    jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                       'campo','pauta','aprovacao_cliente',true,
                       'aprovacao_interna',false),
    jsonb_build_object('nome','Entrega','funcao','Design','papel','entrega',
                       'aprovacao_interna',false)
  ),
  '47000000-0000-0000-0000-0000000000f1');

select teste.cenario('A gestao abre junho com o fluxo sem aval', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-06', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb,
    %L, jsonb_build_object('Social Media', %L::text, 'Design', %L::text),
    '{}'::jsonb, 'https://drive.google.com/drive/folders/JUNHO47',
    '47000000-0000-0000-0000-0000000000f1')$fmt$,
    :VERDE, :MARINA, :MARINA, :BRUNO), 'ok', 1);

select set_config('t47.junho',
  (select id::text from public.tasks
    where client_id = :VERDE and social_do_mes = '2027-06-01'), false);
select set_config('t47.pauta',
  (select id::text from public.etapas_do_mes(current_setting('t47.junho')::uuid)
    where titulo = 'Pauta'), false);

select teste.cenario('A Marina marca a Pauta das duas pecas', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where subtask_id = %L$fmt$, current_setting('t47.pauta')), 'ok', 2);

-- AGORA NAO FALTA NADA NO PORTAO, e o que sobra para recusar e o aprovador.
-- Sem este cenario os dois de baixo passariam pela recusa errada, dizendo que
-- falta peca -- e a mutacao do bloco do aprovador nao derrubaria nenhum.
select teste.conferir_como('O portao esta pronto: nenhuma peca faltando', :ANA,
  format($fmt$select count(*)::text from public.o_que_falta_no_portao(%1$L::uuid,
    (select id from public.etapas_do_mes(%1$L::uuid) where titulo = 'Pauta'))$fmt$,
    current_setting('t47.junho')),
  '0');

select teste.recusa_com('O lote sem aprovador nao sai', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%1$L, %2$L, null, null)$fmt$,
    current_setting('t47.junho'), current_setting('t47.pauta')),
  'Escolha quem vai aprovar este mês');

select teste.recusa_com_dica('E a dica diz que qualquer um da empresa responde', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%1$L, %2$L, null, null)$fmt$,
    current_setting('t47.junho'), current_setting('t47.pauta')),
  'Qualquer pessoa da empresa continua podendo responder');

select teste.recusa_com('E o lote com alguem de outra conta tambem nao', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%1$L, %2$L, null, %3$L)$fmt$,
    current_setting('t47.junho'), current_setting('t47.pauta'), :OTTO),
  'não aprova pela Mundo Verde');

-- E NADA FOI GRAVADO PELAS TRES TENTATIVAS, que e o ponto do bloco.
select teste.conferir('Nenhum lote ficou para tras',
  (select count(*)::text from public.social_lotes
    where task_id = current_setting('t47.junho')::uuid), '0');

select teste.conferir('E nenhuma rodada de cliente ficou pela metade',
  (select count(*)::text from public.approval_rounds r
    join public.posts p on p.id = r.content_id
   where p.social_task_id = current_setting('t47.junho')::uuid
     and r.escopo = 'cliente'), '0');

-- COM A JOANA NOMEADA O LOTE SAI, e as duas rodadas nascem com ela.
select teste.cenario('Com a Joana nomeada, o lote sai', :ANA,
  format($fmt$select public.enviar_mes_ao_cliente(%1$L, %2$L,
    'Olha a pauta de junho.', %3$L)$fmt$,
    current_setting('t47.junho'), current_setting('t47.pauta'), :JOANA), 'ok', 1);

select teste.conferir('As duas rodadas do lote nasceram no nome da Joana',
  (select format('%s de %s', count(*) filter (where aprovador_id = :JOANA::uuid), count(*))
     from public.approval_rounds r
     join public.posts p on p.id = r.content_id
    where p.social_task_id = current_setting('t47.junho')::uuid
      and r.escopo = 'cliente'), '2 de 2');

-- E O AVISO DO LOTE E UM SO, para a aprovadora -- e nao um por peca, que e o
-- ruido que a 0090 existiu para nao produzir, nem um por pessoa da empresa,
-- que e o que a 0128 desfez. O gatilho de linha se cala quando ha `lote_id`.
select teste.conferir('Um aviso do mes, e so para a Joana',
  (select count(*)::text from public.notifications
    where user_id = :JOANA and titulo like '%para a sua aprovação'
      and titulo like '2 materiais%'), '1');

select teste.conferir('E o Paulo nao foi cobrado do mes',
  (select count(*)::text from public.notifications
    where user_id = :PAULO and titulo like '%para a sua aprovação'), '0');

-- O LOTE GUARDA QUEM ENVIOU; quem RECEBEU mora na rodada, uma por peca. Uma
-- coluna `aprovador_id` aqui tambem seria a segunda verdade sobre o mesmo
-- fato -- e ela divergiria no primeiro reenvio de uma peca so.
select teste.conferir('O lote guarda quem enviou, e o recado',
  (select format('%s / %s',
            (select nome from public.profiles where id = l.enviado_por),
            l.recado)
     from public.social_lotes l
    where l.task_id = current_setting('t47.junho')::uuid),
  'Ana Souza / Olha a pauta de junho.');

select teste.conferir('E o lote nao tem coluna de aprovador',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'social_lotes'
      and column_name = 'aprovador_id'), '0');
