-- ===========================================================================
-- Sprint 3E -- As solicitacoes do cliente (migration 0068)
--
-- Ana e socia, Diego desenvolvedor (os dois sao `is_gestor()`), CARLA e do
-- Atendimento -- colaboradora, e `is_atendimento()` e verdadeira para ela --,
-- Bruno e do Design e nao e. Joana e cliente da Mundo Verde, Otto da Optica
-- Visao.
--
-- As perguntas deste arquivo:
--
--   * o pedido de uma empresa vaza para a outra?
--   * quem tria e quem so olha?
--   * o pedido anda sozinho quando o rascunho nasce -- que e o erro que este
--     sprint existe para nao cometer?
--   * a conta que nao aceita pedido recusa no BANCO, ou so esconde o botao?
--
-- Cada cenario roda como uma PESSOA. Rodando como postgres tudo passaria.
-- ===========================================================================

\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

select teste.limpar();
delete from public.request_messages;
delete from public.request_attachments;
delete from public.client_requests;

-- A Mundo Verde tem atendente; a Optica NAO -- e a ausencia e o cenario, nao
-- descuido. Foi um banco em que toda empresa tinha atendente que escondeu o
-- bug da 0062 por meses.
update public.clients set responsavel_atendimento_id = :CARLA where id = :VERDE;
update public.clients set responsavel_atendimento_id = null,
                          aceita_solicitacoes = true     where id = :OPTICA;
update public.clients set aceita_solicitacoes = true      where id = :VERDE;


-- ---------------------------------------------------------------------------
-- QUEM ABRE O PEDIDO
-- ---------------------------------------------------------------------------

select teste.cenario('Joana abre pedido na empresa dela', :JOANA,
  format($fmt$
    insert into public.client_requests (id, client_id, titulo, descricao, data_desejada)
    values ('dddddddd-0000-0000-0000-000000000001', %L,
            'Arte para o dia das maes', 'Uma peca de feed', '2027-05-01')
  $fmt$, :VERDE), 'ok');

-- A TROCA DE EMPRESA E O FURO OBVIO, e a policy o fecha: `my_client_ids()`
-- nao devolve a Optica para a Joana.
select teste.cenario('Joana NAO abre pedido na empresa do Otto', :JOANA,
  format($fmt$
    insert into public.client_requests (client_id, titulo)
    values (%L, 'Pedido na conta errada')
  $fmt$, :OPTICA), 'recusa');

select teste.conferir_como('Otto nao enxerga o pedido da Mundo Verde', :OTTO,
  $$select count(*)::text from public.client_requests$$, '0');

select teste.conferir_como('A equipe enxerga o pedido', :BRUNO,
  $$select count(*)::text from public.client_requests$$, '1');

-- O PEDIDO NASCE `nova`, E QUEM ESCREVE NAO ESCOLHE.
--
-- Sem o trigger, uma requisicao montada a mao criaria o pedido ja
-- `em_andamento` -- e a caixa de entrada, que ordena por quem espera ha mais
-- tempo, nunca o mostraria. Pedido invisivel e pior que pedido recusado.
select teste.cenario('Joana tenta nascer em_andamento', :JOANA,
  format($fmt$
    insert into public.client_requests (id, client_id, titulo, status)
    values ('dddddddd-0000-0000-0000-000000000002', %L, 'Pedido esperto', 'em_andamento')
  $fmt$, :VERDE), 'ok');

select teste.conferir('E o banco devolveu ele para `nova`',
  (select status::text from public.client_requests
    where id = 'dddddddd-0000-0000-0000-000000000002'), 'nova');

-- E O AUTOR E QUEM ESTA LOGADO, porque policy nao limita coluna: sem o
-- trigger, um PATCH assinaria o pedido com o nome de outra pessoa da empresa.
select teste.cenario('Joana tenta assinar o pedido como o Otto', :JOANA,
  format($fmt$
    insert into public.client_requests (id, client_id, titulo, criado_por)
    values ('dddddddd-0000-0000-0000-000000000003', %L, 'Pedido assinado errado', %L)
  $fmt$, :VERDE, :OTTO), 'ok');

select teste.conferir('E quem assina e a Joana',
  (select criado_por::text from public.client_requests
    where id = 'dddddddd-0000-0000-0000-000000000003'),
  '77777777-7777-7777-7777-777777777777');

-- A CONTA QUE NAO ACEITA RECUSA NO BANCO, e nao so esconde o botao.
update public.clients set aceita_solicitacoes = false where id = :OPTICA;

select teste.cenario('Conta com pedidos desligados recusa o insert', :OTTO,
  format($fmt$
    insert into public.client_requests (client_id, titulo)
    values (%L, 'Pedido numa conta desligada')
  $fmt$, :OPTICA), 'recusa');

-- E A EQUIPE CONTINUA PODENDO REGISTRAR: o Atendimento que recebeu o pedido
-- por telefone poe ali, e a conversa passa a ter um lugar.
select teste.cenario('O Atendimento registra pedido mesmo na conta desligada', :CARLA,
  format($fmt$
    insert into public.client_requests (id, client_id, titulo)
    values ('dddddddd-0000-0000-0000-000000000004', %L, 'Pedido que chegou por telefone')
  $fmt$, :OPTICA), 'ok');

update public.clients set aceita_solicitacoes = true where id = :OPTICA;


-- ---------------------------------------------------------------------------
-- A CONTA SEM ATENDENTE NAO DERRUBA O PEDIDO
--
-- E a licao da 0062, virada do avesso: `notificar()` devolve null quando nao
-- ha a quem avisar, em vez de estourar o `not null` de `notifications.user_id`
-- e levar junto a escrita que a chamou. A Optica nao tem atendente, e o insert
-- acima passou -- este cenario e o que prova que passou POR ISSO, e nao por
-- acaso.
-- ---------------------------------------------------------------------------
select teste.conferir('Ninguem foi avisado do pedido da conta sem atendente',
  (select count(*)::text from public.notifications
    where tipo = 'solicitacao' and corpo = 'Pedido que chegou por telefone'), '0');

select teste.conferir('E a Carla foi avisada do pedido da Mundo Verde',
  (select count(*)::text from public.notifications
    where tipo = 'solicitacao' and user_id = :CARLA
      and corpo = 'Arte para o dia das maes'), '1');


-- ---------------------------------------------------------------------------
-- QUEM TRIA
--
-- `is_atendimento()`, a MESMA funcao que `tasks_insert` usa desde a 0006 --
-- converter o pedido em demanda e criar a demanda, entao duas perguntas
-- diferentes dariam a tela que oferece o botao e o banco que recusa o clique.
-- ---------------------------------------------------------------------------

select teste.cenario('Bruno (Design) NAO tria', :BRUNO,
  $$update public.client_requests set status = 'em_analise'
     where id = 'dddddddd-0000-0000-0000-000000000001'$$, 'recusa');

select teste.cenario('Carla (Atendimento) tria', :CARLA,
  $$update public.client_requests set status = 'em_analise'
     where id = 'dddddddd-0000-0000-0000-000000000001'$$, 'ok');

-- O CLIENTE NAO MEXE DEPOIS DE MANDAR, e a ausencia da policy de update e a
-- regra: editar o titulo de um pedido que ja virou demanda trocaria o
-- combinado embaixo de quem esta trabalhando nele. O caminho e a conversa.
select teste.cenario('Joana nao edita o proprio pedido depois de mandar', :JOANA,
  $$update public.client_requests set titulo = 'Outra coisa'
     where id = 'dddddddd-0000-0000-0000-000000000001'$$, 'recusa');

-- RECUSAR EXIGE MOTIVO, na acao e no banco.
select teste.recusa_com('Recusar sem motivo e recusado', :CARLA,
  $$update public.client_requests set status = 'recusada'
     where id = 'dddddddd-0000-0000-0000-000000000002'$$,
  'client_requests_recusa_com_motivo');

select teste.cenario('Recusar com motivo passa', :CARLA,
  $$update public.client_requests
       set status = 'recusada',
           motivo_recusa = 'Esta peca ja esta no pacote de outubro.'
     where id = 'dddddddd-0000-0000-0000-000000000002'$$, 'ok');

select teste.conferir('E a decisao ficou carimbada',
  (select (decidida_em is not null)::text from public.client_requests
    where id = 'dddddddd-0000-0000-0000-000000000002'), 'true');

select teste.conferir('E a Joana foi avisada, com o motivo',
  (select count(*)::text from public.notifications
    where user_id = :JOANA and titulo = 'Sobre o seu pedido'
      and corpo like '%pacote de outubro%'), '1');

-- APAGAR E DA GESTAO. Existe para o pedido em duplicidade, nao para limpar a
-- fila -- recusar com motivo deixa rastro dos dois lados.
select teste.cenario('Carla NAO apaga pedido', :CARLA,
  $$delete from public.client_requests
     where id = 'dddddddd-0000-0000-0000-000000000003'$$, 'recusa');

select teste.cenario('A gestao apaga pedido', :DIEGO,
  $$delete from public.client_requests
     where id = 'dddddddd-0000-0000-0000-000000000003'$$, 'ok');


-- ---------------------------------------------------------------------------
-- ANEXOS
-- ---------------------------------------------------------------------------

select teste.cenario('Joana anexa no pedido dela', :JOANA,
  $$insert into public.request_attachments (request_id, caminho, nome)
    values ('dddddddd-0000-0000-0000-000000000001',
            'aaaaaaaa-0000-0000-0000-000000000001/dddddddd-0000-0000-0000-000000000001/a.png',
            'referencia.png')$$, 'ok');

select teste.cenario('Otto NAO anexa no pedido da Joana', :OTTO,
  $$insert into public.request_attachments (request_id, caminho, nome)
    values ('dddddddd-0000-0000-0000-000000000001', 'x/y/z.png', 'intruso.png')$$, 'recusa');

select teste.conferir_como('Otto nao enxerga o anexo da Joana', :OTTO,
  $$select count(*)::text from public.request_attachments$$, '0');

-- O TETO E DEZ, E ELE RECUSA EM VEZ DE CORTAR.
--
-- Ao contrario do limite por task da recorrencia: la o excesso vem de uma
-- regra de calendario, e cortar deixa o mes incompleto e anotado; aqui cada
-- arquivo foi escolhido por uma pessoa, e descartar o decimo primeiro calado
-- faria o cliente achar que mandou o que nao chegou.
insert into public.request_attachments (request_id, caminho, nome)
select 'dddddddd-0000-0000-0000-000000000001',
       'aaaaaaaa-0000-0000-0000-000000000001/dddddddd-0000-0000-0000-000000000001/f' || i || '.png',
       'f' || i || '.png'
  from generate_series(2, 10) as i;

select teste.recusa_com('O decimo primeiro anexo e recusado', :JOANA,
  $$insert into public.request_attachments (request_id, caminho, nome)
    values ('dddddddd-0000-0000-0000-000000000001', 'x/onze.png', 'onze.png')$$,
  'ja tem 10 arquivos');


-- ---------------------------------------------------------------------------
-- A CONVERSA
--
-- NAO EXISTE `interno` AQUI, e a ausencia e a regra do modulo: tudo o que se
-- escreve na conversa do pedido e para o cliente ler. Quem precisa falar da
-- agencia para dentro fala em `task_comentarios`, na demanda.
-- ---------------------------------------------------------------------------

select teste.cenario('Joana escreve no pedido dela', :JOANA,
  $$insert into public.request_messages (request_id, texto)
    values ('dddddddd-0000-0000-0000-000000000001', 'Pode ser em tons de verde?')$$, 'ok');

select teste.cenario('Otto NAO escreve no pedido da Joana', :OTTO,
  $$insert into public.request_messages (request_id, texto)
    values ('dddddddd-0000-0000-0000-000000000001', 'Oi?')$$, 'recusa');

select teste.cenario('A Carla responde', :CARLA,
  $$insert into public.request_messages (request_id, texto)
    values ('dddddddd-0000-0000-0000-000000000001', 'Pode sim, vou passar para o Design.')$$, 'ok');

select teste.conferir('A resposta da agencia avisou a Joana',
  (select count(*)::text from public.notifications
    where user_id = :JOANA and titulo = 'Resposta no seu pedido'), '1');

-- E O AUTOR E QUEM ESTA LOGADO, dos dois lados.
select teste.cenario('Joana tenta escrever no nome da Carla', :JOANA,
  format($fmt$
    insert into public.request_messages (id, request_id, autor_id, texto)
    values ('eeeeeeee-0000-0000-0000-000000000001',
            'dddddddd-0000-0000-0000-000000000001', %L, 'Assinado por outra pessoa')
  $fmt$, :CARLA), 'ok');

select teste.conferir('E quem assina e a Joana',
  (select autor_id::text from public.request_messages
    where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  '77777777-7777-7777-7777-777777777777');

-- MENSAGEM NAO SE EDITA NEM SE APAGA, e nem pelo socio.
--
-- E o oposto do feed de Recomendacoes, onde o autor edita: la a frase e uma
-- opiniao dele; aqui ela e o combinado entre duas empresas sobre o que vai ser
-- feito. Reescrever "pode ser azul" depois da peca pronta e reescrever o
-- pedido -- a razao pela qual rodada de aprovacao fechada nunca e reescrita.
select teste.cenario('Ninguem edita mensagem, nem quem escreveu', :JOANA,
  $$update public.request_messages set texto = 'Outra coisa'
     where id = 'eeeeeeee-0000-0000-0000-000000000001'$$, 'recusa');

select teste.cenario('Nem o socio apaga mensagem', :ANA,
  $$delete from public.request_messages
     where id = 'eeeeeeee-0000-0000-0000-000000000001'$$, 'recusa');


-- ---------------------------------------------------------------------------
-- O CORACAO DO SPRINT: O RASCUNHO NAO MOVE O PEDIDO
--
-- Converter abre um RASCUNHO, e rascunho e pensamento pela metade. Se o status
-- andasse ali, o cliente leria "estamos fazendo" sobre uma demanda que ninguem
-- da equipe enxerga ainda -- e que pode ser abandonada.
--
-- E o cenario que segura isso e este: se alguem puser o mirror no `insert` da
-- task em vez de na publicacao, ele falha e diz qual.
-- ---------------------------------------------------------------------------

insert into public.client_requests (id, client_id, titulo, criado_por, status)
values ('dddddddd-0000-0000-0000-00000000000a', :VERDE,
        'Banner para a feira', :JOANA, 'em_analise');

select teste.cenario('Carla abre o rascunho ligado ao pedido', :CARLA,
  format($fmt$
    insert into public.tasks (id, client_id, titulo, link_entrega, criado_por,
                              publicada_em, request_id)
    values ('cccccccc-0000-0000-0000-00000000000a', %L, 'Banner para a feira',
            'https://drive.exemplo/banner', %L, null,
            'dddddddd-0000-0000-0000-00000000000a')
  $fmt$, :VERDE, :CARLA), 'ok');

select teste.conferir('O rascunho NAO moveu o pedido',
  (select status::text from public.client_requests
    where id = 'dddddddd-0000-0000-0000-00000000000a'), 'em_analise');

select teste.conferir('E ninguem avisou o cliente ainda',
  (select count(*)::text from public.notifications
    where user_id = :JOANA and titulo = 'Seu pedido virou trabalho'), '0');

-- PUBLICAR E O INSTANTE HONESTO, porque e quando a demanda passa a existir
-- para a equipe.
select teste.cenario('Carla publica a demanda', :CARLA,
  $$update public.tasks set publicada_em = now()
     where id = 'cccccccc-0000-0000-0000-00000000000a'$$, 'ok');

select teste.conferir('Publicar moveu o pedido para em_andamento',
  (select status::text from public.client_requests
    where id = 'dddddddd-0000-0000-0000-00000000000a'), 'em_andamento');

select teste.conferir('E o cliente foi avisado, uma vez',
  (select count(*)::text from public.notifications
    where user_id = :JOANA and titulo = 'Seu pedido virou trabalho'), '1');

-- ENTREGAR FECHA O PEDIDO. Sem esta metade, todo pedido ja entregue ficaria
-- para sempre na caixa de entrada -- e uma fila que so cresce e uma fila que
-- ninguem abre.
select teste.cenario('Carla marca a demanda como entregue', :CARLA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'cccccccc-0000-0000-0000-00000000000a'$$, 'ok');

select teste.conferir('Entregar fechou o pedido',
  (select status::text from public.client_requests
    where id = 'dddddddd-0000-0000-0000-00000000000a'), 'concluida');

-- O MIRROR NAO RESSUSCITA PEDIDO RECUSADO.
--
-- Uma demanda aberta a partir de um pedido que a agencia depois recusou --
-- acontece: o Atendimento converte, alguem revisa e recusa -- nao pode fazer o
-- pedido voltar a "em andamento" no portal do cliente, contando a ele uma
-- historia que a agencia ja desmentiu.
insert into public.client_requests (id, client_id, titulo, criado_por, status, motivo_recusa)
values ('dddddddd-0000-0000-0000-00000000000b', :VERDE,
        'Pedido recusado depois', :JOANA, 'recusada', 'Fora do escopo do contrato.');

insert into public.tasks (id, client_id, titulo, link_entrega, criado_por,
                          publicada_em, request_id)
values ('cccccccc-0000-0000-0000-00000000000b', :VERDE, 'Demanda orfa',
        'https://drive.exemplo/orfa', :CARLA, null,
        'dddddddd-0000-0000-0000-00000000000b');

select teste.cenario('Publicar a demanda de um pedido recusado', :CARLA,
  $$update public.tasks set publicada_em = now()
     where id = 'cccccccc-0000-0000-0000-00000000000b'$$, 'ok');

select teste.conferir('O pedido recusado continua recusado',
  (select status::text from public.client_requests
    where id = 'dddddddd-0000-0000-0000-00000000000b'), 'recusada');

-- UM PEDIDO VIRA UMA DEMANDA, e o indice unico e quem garante. Sem ele, dois
-- cliques no botao de converter dariam duas demandas iguais no board, e o
-- cliente veria duas notificacoes dizendo que o pedido dele virou trabalho.
select teste.recusa_com('Um pedido nao vira duas demandas', :CARLA,
  format($fmt$
    insert into public.tasks (client_id, titulo, link_entrega, criado_por, request_id)
    values (%L, 'Banner de novo', 'https://drive.exemplo/x', %L,
            'dddddddd-0000-0000-0000-00000000000a')
  $fmt$, :VERDE, :CARLA),
  'tasks_request_unico_idx');


-- ---------------------------------------------------------------------------
-- OS TIPOS DE PEDIDO
--
-- A EQUIPE LE TODOS; O CLIENTE LE SO OS ATIVOS -- a forma de
-- `academy_tracks_select` com a trilha em rascunho: o tipo que saiu do ar
-- continua existindo para a gestao e para os pedidos antigos que o citam, e
-- some do formulario de quem vai abrir um novo.
-- ---------------------------------------------------------------------------

insert into public.request_types (id, nome, ordem, ativo)
values ('ffffffff-0000-0000-0000-000000000001', 'Tipo aposentado', 99, false)
on conflict (id) do nothing;

select teste.conferir_como('O cliente nao ve o tipo desligado', :JOANA,
  $$select count(*)::text from public.request_types where ativo = false$$, '0');

select teste.conferir_como('A equipe ve o tipo desligado', :BRUNO,
  $$select count(*)::text from public.request_types where ativo = false$$, '1');

select teste.conferir_como('Os quatro tipos iniciais nasceram com a migration', :JOANA,
  $$select count(*)::text from public.request_types where ativo$$, '4');

-- QUEM EDITA O ROTEIRO E A GESTAO, e nao `is_atendimento()` como quem abre o
-- pedido: o roteiro vale para TODAS as contas. Abrir uma demanda e trabalho do
-- dia; mudar a pergunta que todo cliente vai responder e configuracao do
-- produto.
select teste.cenario('A Carla do Atendimento NAO edita o roteiro', :CARLA,
  $$update public.request_types set nome = 'Outro nome'
     where id = 'ffffffff-0000-0000-0000-000000000001'$$, 'recusa');

select teste.cenario('A gestao edita o roteiro', :DIEGO,
  $$update public.request_types set nome = 'Tipo renomeado'
     where id = 'ffffffff-0000-0000-0000-000000000001'$$, 'ok');

-- O ROTEIRO E UMA LISTA, e o check existe porque um objeto gravado aqui nao
-- quebra nada na hora: ele quebra na tela do cliente, que faz `.map()` no que
-- veio e mostra um formulario sem campo nenhum -- sem erro e sem log.
select teste.recusa_com('Roteiro que nao e lista e recusado', :DIEGO,
  $$update public.request_types set campos_json = '{"chave":"x"}'::jsonb
     where id = 'ffffffff-0000-0000-0000-000000000001'$$,
  'request_types_campos_lista');


-- ---------------------------------------------------------------------------
-- O BUCKET
--
-- A pasta e da EMPRESA, e e ela que separa um cliente do outro: a policy de
-- storage nao enxerga a tabela do pedido sem um join que `storage.foldername()`
-- nao faz.
-- ---------------------------------------------------------------------------
delete from storage.objects where bucket_id = 'solicitacoes-arquivos';

select teste.cenario('Joana grava na pasta da empresa dela', :JOANA,
  format($fmt$
    insert into storage.objects (bucket_id, name)
    values ('solicitacoes-arquivos', %L)
  $fmt$, 'aaaaaaaa-0000-0000-0000-000000000001/ped/a.png'), 'ok');

select teste.cenario('Joana NAO grava na pasta da Optica', :JOANA,
  format($fmt$
    insert into storage.objects (bucket_id, name)
    values ('solicitacoes-arquivos', %L)
  $fmt$, 'aaaaaaaa-0000-0000-0000-000000000002/ped/b.png'), 'recusa');

select teste.conferir_como('Otto nao enxerga o arquivo da Mundo Verde', :OTTO,
  $$select count(*)::text from storage.objects
     where bucket_id = 'solicitacoes-arquivos'$$, '0');

select teste.conferir_como('A equipe enxerga o arquivo', :BRUNO,
  $$select count(*)::text from storage.objects
     where bucket_id = 'solicitacoes-arquivos'$$, '1');
