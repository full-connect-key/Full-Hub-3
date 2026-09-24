\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set PAULO   '''99999999-9999-9999-9999-999999999999'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

-- ===========================================================================
-- Sprint 11 -- A aprovacao generica e o Portal do Cliente
--
-- Duas perguntas:
--
--   1. A rodada deixou de ser so da subtarefa SEM perder nenhuma trava, e sem
--      deixar um tipo novo entrar por baixo?
--   2. O cliente alcanca exatamente a empresa dele, e nada alem -- inclusive
--      quando ele monta a chamada a mao contra a API?
--
-- PAULO e o segundo usuario da Mundo Verde, e existe por causa de um criterio
-- de aceite: "dois usuarios da mesma empresa veem exatamente as mesmas coisas
-- e tem os mesmos poderes". Com um usuario por empresa isso nao da para
-- provar, e um criterio que nao da para provar e um criterio que ninguem
-- checa.
-- ===========================================================================

-- E O PERFIL VEM POR UPDATE, nao por insert.
--
-- `on_auth_user_created` (o gatilho que o Supabase tem e que o fixture imita)
-- cria o profile no instante em que a linha entra em `auth.users`, com role
-- `colaborador` e o nome tirado do e-mail. Um `insert ... on conflict (id) do
-- nothing` depois disso nao faz nada -- a linha ja existe.
--
-- Foi o que aconteceu na primeira versao deste arquivo: Paulo nasceu
-- COLABORADOR, `is_staff()` deu verdadeiro, e ele enxergou o sistema inteiro.
-- Os dois cenarios que reprovaram estavam certos; quem estava errado era a
-- montagem. Vale registrar porque o proximo arquivo de bateria que criar
-- usuario vai cair nisto.
insert into auth.users (id, email) values (:PAULO, 'paulo.verde@ex.com')
on conflict do nothing;

update public.profiles
   set nome = 'Paulo Verde', role = 'cliente', ativo = true
 where id = :PAULO;

insert into public.client_users (client_id, user_id) values (:VERDE, :PAULO)
on conflict do nothing;

select teste.conferir('Paulo nasceu como cliente, e nao como colaborador',
  (select role::text from public.profiles where id = :PAULO),
  'cliente');


-- ---------------------------------------------------------------------------
-- A CONVERSAO NAO PERDEU NINGUEM
-- ---------------------------------------------------------------------------
select teste.conferir('Toda rodada que existia virou content_type = subtask',
  (select count(*)::text from public.approval_rounds where content_type <> 'subtask'),
  '0');

select teste.conferir('E nenhuma ficou sem conteudo',
  (select count(*)::text from public.approval_rounds where content_id is null),
  '0');


-- ---------------------------------------------------------------------------
-- TIPO SEM REGRA NAO PASSA
--
-- 'post' e 'deliverable' estao no check porque a coluna precisa deles, e as
-- tabelas chegam nos Sprints 12 e 13. Ate la, abrir rodada de um deles seria
-- abrir uma aprovacao que nenhuma trava sabe conferir.
--
-- O SPRINT 12 CHEGOU, e este cenario mudou de dono por causa disso: 'post'
-- agora TEM regra (migration 0032), entao quem prova a frase e 'deliverable'.
-- O cenario nao foi apagado porque a frase que ele guarda continua valendo --
-- so o tipo que a exemplifica e que mudou. As regras do post estao em
-- 15_posts_e_comentarios.sql.
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('cccccccc-0000-0000-0000-0000000000b0', :VERDE, 'Demanda do Sprint 11', :DIEGO,
        '2026-10-01', 'https://drive.google.com/drive/folders/s11');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('dddddddd-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-0000000000b0',
        'Etapa do Sprint 11', 1, :BRUNO, true, 'interna');

select teste.recusa_com('Rodada de entregavel ainda nao tem regra, e e recusada', :DIEGO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('deliverable', 'dddddddd-0000-0000-0000-0000000000b1', 1, 'interna', %L)$fmt$, :DIEGO),
  'ainda não tem regra');

-- SAO DUAS TRAVAS, E O TRIGGER CHEGA PRIMEIRO. Um BEFORE INSERT roda antes do
-- CHECK da tabela, entao um tipo inventado e recusado pelo trigger -- e o
-- check nunca e alcancado por este caminho. Escrevi este cenario esperando a
-- mensagem do check, e foi a bateria que corrigiu a expectativa.
select teste.recusa_com('Tipo inventado tambem para no trigger', :DIEGO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('campanha', 'dddddddd-0000-0000-0000-0000000000b1', 1, 'interna', %L)$fmt$, :DIEGO),
  'ainda não tem regra');

-- E o check existe, e vale para quem passar por baixo do trigger -- que e
-- exatamente o caso de uma escrita administrativa. Sem desligar o trigger,
-- este cenario nunca tocaria a trava que diz testar.
alter table public.approval_rounds disable trigger approval_rounds_valida_nova;

do $$
begin
  begin
    insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('campanha', 'dddddddd-0000-0000-0000-0000000000b1', 9, 'interna',
            '22222222-2222-2222-2222-222222222222');
    insert into teste.resultado (descricao, situacao, detalhe)
    values ('O check do content_type recusa o tipo inventado', 'FALHOU',
            'passou quando devia ser recusado');
  exception when others then
    insert into teste.resultado (descricao, situacao, detalhe)
    values ('O check do content_type recusa o tipo inventado',
            case when position('approval_rounds_content_type_valido' in sqlerrm) > 0
                 then 'passou' else 'FALHOU' end,
            left(sqlerrm, 90));
  end;
end
$$;

alter table public.approval_rounds enable trigger approval_rounds_valida_nova;


-- ---------------------------------------------------------------------------
-- A UNICIDADE MUDOU DE COLUNA E CONTINUA VALENDO
-- ---------------------------------------------------------------------------
select teste.cenario('Bruno abre a rodada 1 da etapa dele', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por)
    values ('dddddddd-0000-0000-0000-0000000000b1', 1, 'interna', %L)$fmt$, :BRUNO), 'ok', 1);

select teste.conferir('E ela nasceu com content_type = subtask, pelo default',
  (select content_type from public.approval_rounds
    where content_id = 'dddddddd-0000-0000-0000-0000000000b1' and numero_rodada = 1),
  'subtask');

select teste.recusa_com('A mesma rodada duas vezes e recusada', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por)
    values ('dddddddd-0000-0000-0000-0000000000b1', 1, 'interna', %L)$fmt$, :BRUNO),
  'approval_rounds_conteudo_rodada_key');


-- ---------------------------------------------------------------------------
-- O CAMINHO INTEIRO, COM AS COLUNAS NOVAS
--
-- Nao e repeticao do arquivo 01: la o fluxo foi provado com `subtask_id`. Aqui
-- ele e refeito com `(content_type, content_id)`, porque e a conversao que
-- esta sendo testada -- e porque sem uma rodada de escopo CLIENTE nenhuma
-- demanda aparece no portal, e os cenarios de isolamento abaixo comparariam
-- dois zeros.
-- ---------------------------------------------------------------------------
select teste.cenario('Diego aprova a rodada interna', :DIEGO,
  format($fmt$update public.approval_rounds
     set status = 'aprovada', decidido_por = %L, decidido_em = now()
   where content_type = 'subtask'
     and content_id = 'dddddddd-0000-0000-0000-0000000000b1'
     and numero_rodada = 1 and escopo = 'interna'$fmt$, :DIEGO), 'ok', 1);

select teste.cenario('E manda ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por)
    values ('dddddddd-0000-0000-0000-0000000000b1', 1, 'cliente', %L)$fmt$, :DIEGO), 'ok', 1);

select teste.cenario('Agora a demanda aparece para a Joana', :JOANA,
  $$select 1 from public.tasks where id = 'cccccccc-0000-0000-0000-0000000000b0'$$,
  'ok', 1);

select teste.cenario('E para o Paulo, da mesma empresa, tambem', :PAULO,
  $$select 1 from public.tasks where id = 'cccccccc-0000-0000-0000-0000000000b0'$$,
  'ok', 1);

select teste.cenario('Mas nao para o Otto, que e de outra', :OTTO,
  $$select 1 from public.tasks where id = 'cccccccc-0000-0000-0000-0000000000b0'$$,
  'ok', 0);


-- ---------------------------------------------------------------------------
-- O CASCADE QUE A CHAVE ESTRANGEIRA FAZIA
--
-- `subtask_id` tinha `on delete cascade`; `content_id` nao pode ter chave
-- estrangeira, porque aponta para tabelas diferentes conforme o tipo. Sem o
-- trigger que repoe isso, apagar a etapa deixaria a rodada orfa -- e a fila de
-- aprovacoes tentaria mostrar a etapa que nao existe mais.
-- ---------------------------------------------------------------------------
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('dddddddd-0000-0000-0000-0000000000b2', 'cccccccc-0000-0000-0000-0000000000b0',
        'Etapa que vai ser apagada', 2, :BRUNO, true, 'interna');

insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por)
values ('dddddddd-0000-0000-0000-0000000000b2', 1, 'interna', :BRUNO);

select teste.conferir('A etapa a apagar tem 1 rodada',
  (select count(*)::text from public.approval_rounds
    where content_id = 'dddddddd-0000-0000-0000-0000000000b2'),
  '1');

delete from public.subtasks where id = 'dddddddd-0000-0000-0000-0000000000b2';

select teste.conferir('Apagar a etapa apaga a rodada dela junto',
  (select count(*)::text from public.approval_rounds
    where content_id = 'dddddddd-0000-0000-0000-0000000000b2'),
  '0');


-- ---------------------------------------------------------------------------
-- RODADA DE OUTRO TIPO NAO MEXE NO STATUS DA DEMANDA
--
-- Este e o cenario que a generalizacao exige, e ele so prova alguma coisa com
-- o id REPETIDO: a rodada de post usa exatamente o mesmo uuid da subtarefa.
-- Sem `content_type = 'subtask'` no calculo, o `join` casaria pelo id e a
-- demanda iria para "em aprovacao" sem nenhuma etapa em aprovacao.
--
-- O trigger de validacao precisa sair do caminho para montar o estado: ele
-- recusa 'post' de proposito, e e outra trava que esta sendo testada aqui.
-- ---------------------------------------------------------------------------
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('cccccccc-0000-0000-0000-0000000000b3', :VERDE, 'Demanda so com etapa concluida', :DIEGO,
        '2026-10-01', 'https://drive.google.com/drive/folders/s11b');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, status)
values ('dddddddd-0000-0000-0000-0000000000b4', 'cccccccc-0000-0000-0000-0000000000b3',
        'Unica etapa', 1, :BRUNO, 'concluida');

select teste.conferir('A demanda esta concluida',
  (select status::text from public.tasks where id = 'cccccccc-0000-0000-0000-0000000000b3'),
  'concluido');

alter table public.approval_rounds disable trigger approval_rounds_valida_nova;
insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
values ('post', 'dddddddd-0000-0000-0000-0000000000b4', 1, 'interna', :DIEGO, 'pendente');
alter table public.approval_rounds enable trigger approval_rounds_valida_nova;

select public.recalcular_status_task('cccccccc-0000-0000-0000-0000000000b3');

select teste.conferir('Rodada de post pendente NAO arrasta a demanda para em aprovacao',
  (select status::text from public.tasks where id = 'cccccccc-0000-0000-0000-0000000000b3'),
  'concluido');


-- ---------------------------------------------------------------------------
-- O CLIENTE ALCANCA A EMPRESA DELE, E NADA ALEM
-- ---------------------------------------------------------------------------
select teste.cenario('Otto nao le nenhuma task da Mundo Verde', :OTTO,
  format('select 1 from public.tasks where client_id = %L', :VERDE),
  'ok', 0);

select teste.cenario('Joana nao le nenhuma task da Optica Visao', :JOANA,
  format('select 1 from public.tasks where client_id = %L', :OPTICA),
  'ok', 0);

select teste.cenario('E nao le rodada de aprovacao da Optica', :JOANA,
  $$select 1 from public.approval_rounds r
     join public.subtasks s on s.id = r.content_id and r.content_type = 'subtask'
     join public.tasks t on t.id = s.task_id
    where t.client_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  'ok', 0);

-- OS DOIS DA MESMA EMPRESA VEEM O MESMO.
--
-- `a > 0` nao e zelo: sem ele, duas pessoas que nao enxergam nada dariam o
-- cenario por passado, e a igualdade estaria provando o nada.
do $$
declare
  a integer;
  b integer;
begin
  set local role authenticated;

  perform set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
  select count(*) into a from public.tasks;

  perform set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
  select count(*) into b from public.tasks;

  reset role;

  insert into teste.resultado (descricao, situacao, detalhe)
  values ('Joana e Paulo, da mesma empresa, enxergam a mesma quantidade de demandas',
          case when a = b and a > 0 then 'passou' else 'FALHOU' end,
          format('Joana %s, Paulo %s', a, b));
end
$$;


-- ---------------------------------------------------------------------------
-- O SLUG ESTAVA ABERTO, E ESTE E O CENARIO QUE PROVA A CORRECAO
--
-- `protect_client_columns` (0005) lista as colunas que o cliente nao mexe. A
-- coluna `slug` nasceu na 0009, depois da funcao, e ninguem a acrescentou --
-- entao o cliente trocava o endereco do proprio portal por um PATCH. A 0031
-- fechou.
-- ---------------------------------------------------------------------------
select teste.cenario('Joana edita o telefone da empresa dela', :JOANA,
  format('update public.clients set telefone = ''11 99999-0000'' where id = %L', :VERDE),
  'ok', 1);

select teste.conferir('E o telefone mudou de verdade',
  (select telefone from public.clients where id = :VERDE),
  '11 99999-0000');

-- A policy deixa a linha passar de proposito; quem separa o que ele pode do
-- que ele nao pode e o trigger. Por isso a escrita PASSA e o valor NAO muda --
-- e por isso o cenario confere o valor, e nao o numero de linhas.
select teste.cenario('Joana manda trocar o slug, e a escrita passa', :JOANA,
  format('update public.clients set slug = ''mundo-verde-hackeado'' where id = %L', :VERDE),
  'ok', 1);

select teste.conferir('Mas o slug continua o que era',
  (select count(*)::text from public.clients
    where id = :VERDE and slug = 'mundo-verde-hackeado'),
  '0');

select teste.cenario('Joana manda renomear a empresa, e a escrita passa', :JOANA,
  format('update public.clients set nome_empresa = ''Outra Empresa'' where id = %L', :VERDE),
  'ok', 1);

select teste.conferir('Mas o nome continua Mundo Verde',
  (select nome_empresa from public.clients where id = :VERDE),
  'Mundo Verde');

select teste.cenario('E Joana nao alcanca a Optica nem para escrever', :JOANA,
  format('update public.clients set telefone = ''0000'' where id = %L', :OPTICA),
  'ok', 0);


-- ---------------------------------------------------------------------------
-- PREFERENCIAS DE NOTIFICACAO: SO A PROPRIA PESSOA
-- ---------------------------------------------------------------------------
select teste.cenario('Joana grava as preferencias dela', :JOANA,
  format($fmt$insert into public.client_notification_prefs (user_id, novo_conteudo, frequencia)
    values (%L, false, 'diario')$fmt$, :JOANA), 'ok', 1);

select teste.cenario('E nao grava em nome do Paulo', :JOANA,
  format($fmt$insert into public.client_notification_prefs (user_id) values (%L)$fmt$, :PAULO),
  'recusa');

select teste.cenario('Paulo nao le as preferencias da Joana', :PAULO,
  format('select 1 from public.client_notification_prefs where user_id = %L', :JOANA),
  'ok', 0);

select teste.cenario('Nem a socia le', :ANA,
  format('select 1 from public.client_notification_prefs where user_id = %L', :JOANA),
  'ok', 0);

select teste.recusa_com('Frequencia fora das tres e recusada', :PAULO,
  format($fmt$insert into public.client_notification_prefs (user_id, frequencia)
    values (%L, 'quando der')$fmt$, :PAULO),
  'client_prefs_frequencia_valida');


-- ---------------------------------------------------------------------------
-- REGISTRO DE ACESSO: EM NOME PROPRIO, E NAO SE APAGA
-- ---------------------------------------------------------------------------
select teste.cenario('Joana registra o proprio acesso', :JOANA,
  format($fmt$insert into public.client_access_log (user_id, client_id, acao)
    values (%L, %L, 'login')$fmt$, :JOANA, :VERDE), 'ok', 1);

select teste.cenario('E nao registra acesso em nome do Paulo', :JOANA,
  format($fmt$insert into public.client_access_log (user_id, client_id, acao)
    values (%L, %L, 'login')$fmt$, :PAULO, :VERDE), 'recusa');

select teste.cenario('Nem registra acesso a uma empresa que nao e dela', :JOANA,
  format($fmt$insert into public.client_access_log (user_id, client_id, acao)
    values (%L, %L, 'login')$fmt$, :JOANA, :OPTICA), 'recusa');

select teste.cenario('Ninguem apaga o registro de acesso', :ANA,
  'delete from public.client_access_log', 'ok', 0);

select teste.cenario('Nem reescreve', :JOANA,
  'update public.client_access_log set acao = ''download''', 'ok', 0);

select teste.cenario('A equipe le o registro para auditar', :ANA,
  'select 1 from public.client_access_log', 'ok', 1);

select teste.cenario('E Paulo nao le o rastro da Joana', :PAULO,
  format('select 1 from public.client_access_log where user_id = %L', :JOANA), 'ok', 0);


-- ---------------------------------------------------------------------------
-- A ABA USUARIOS LE A DATA SEM LER O RASTRO
--
-- A policy de `client_access_log` esconde o rastro alheio de proposito. A aba
-- precisa da DATA do ultimo login de cada pessoa, sem precisar da lista -- e e
-- por isso que a funcao e `security definer` e devolve so um agregado.
-- ---------------------------------------------------------------------------
select teste.cenario('Joana ve as duas pessoas da Mundo Verde', :JOANA,
  'select 1 from public.usuarios_do_meu_cliente()', 'ok', 2);

select teste.cenario('Otto ve so a pessoa da Optica', :OTTO,
  'select 1 from public.usuarios_do_meu_cliente()', 'ok', 1);

select teste.cenario('E a data do ultimo login da Joana chegou junto', :JOANA,
  format($fmt$select 1 from public.usuarios_do_meu_cliente() u
    where u.user_id = %L and u.ultimo_acesso is not null$fmt$, :JOANA), 'ok', 1);
