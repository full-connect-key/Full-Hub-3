\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

-- ===========================================================================
-- 0051 -- A CAMPANHA NASCE COM A DEMANDA, E SE FINALIZA SOZINHA
--
-- Duas decisoes do usuario, e as duas pontas do mesmo fio: uma liga a
-- campanha ao trabalho, a outra desliga quando ele acaba.
--
-- O que estes cenarios guardam, e que nenhuma tela mostraria:
--
--   1. A arvore chega inteira dos DOIS lados -- entregavel e etapa --, e o
--      sub-item e sub-etapa DA ETAPA CERTA. O bug natural aqui nao estoura:
--      ele monta uma arvore de quatro niveis, e quem recusa e um trigger de
--      outra migration, falando de outra coisa.
--   2. A funcao NAO e `security definer`. Quem nao pode abrir demanda
--      continua nao podendo, mesmo chamando a RPC.
--   3. A finalizacao vale nos DOIS sentidos.
-- ===========================================================================

select teste.limpar();
delete from public.comments;
delete from public.deliverables;
delete from public.campaigns;

\set CAMP_ID '''00000000-0000-0000-0000-000000000000'''


-- ---------------------------------------------------------------------------
-- 1. A GESTAO ABRE, E VEM TUDO JUNTO
-- ---------------------------------------------------------------------------
create temporary table alvo (id uuid);
-- A TABELA E DO `postgres`, e o cenario roda como `authenticated`: sem o
-- grant, o insert leva "permission denied" -- que parece recusa de RLS e nao
-- e, e custaria uma rodada de investigacao no lugar errado.
grant all on alvo to authenticated;

-- DENTRO DE UMA TRANSACAO EXPLICITA, e isto nao e estilo: `set local` fora de
-- transacao e descartado no fim do proprio comando, e o psql roda cada linha
-- na sua. Sem o `begin`, a funcao rodaria com `auth.uid()` nulo -- e o erro
-- sai tres telas adiante, num `not null` de `tasks.criado_por`, falando de
-- outra coisa. `teste.cenario` nao tem esse problema porque o corpo de uma
-- funcao plpgsql ja e uma transacao.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :DIEGO, true);

insert into alvo
select public.abrir_campanha(
  :VERDE,
  'Wave com demanda',
  'A campanha do mes.',
  current_date,
  current_date + 20,
  'ativa',
  'https://drive.google.com/pasta-da-wave',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"O conceito da Wave."}]}]}'::jsonb,
  'O conceito da Wave.',
  null,
  '[{"nome":"KV","prazo":null,"responsavel":"44444444-4444-4444-4444-444444444444","filhos":[]},
    {"nome":"Enxoval","prazo":null,"responsavel":null,
     "filhos":[{"nome":"Lamina","prazo":null,"responsavel":"44444444-4444-4444-4444-444444444444"},
               {"nome":"Banner","prazo":null,"responsavel":"55555555-5555-5555-5555-555555555555"}]}]'::jsonb
);

commit;
reset role;

select teste.conferir('A campanha nasceu com uma demanda',
  (select (task_id is not null)::text from public.campaigns
    where id = (select id from alvo)), 'true');

select teste.conferir('O briefing foi para a demanda, e nao para a campanha',
  (select t.briefing_texto from public.tasks t
    join public.campaigns c on c.task_id = t.id
   where c.id = (select id from alvo)), 'O conceito da Wave.');

-- A PASTA DE ENTREGA E DA DEMANDA, e `tasks_exige_pasta_de_entrega` recusa
-- demanda nova sem ela desde a 0015. Este cenario prova que o campo da tela
-- de campanha chega ate la -- sem ele a criacao inteira seria recusada.
select teste.conferir('E a pasta de entrega tambem',
  (select t.link_entrega from public.tasks t
    join public.campaigns c on c.task_id = t.id
   where c.id = (select id from alvo)),
  'https://drive.google.com/pasta-da-wave');

select teste.conferir('Tres entregaveis: KV, Enxoval e os dois filhos',
  (select count(*)::text from public.deliverables
    where campaign_id = (select id from alvo)), '4');

select teste.conferir('E tres etapas na demanda, uma por entregavel',
  (select count(*)::text from public.subtasks s
    join public.campaigns c on c.task_id = s.task_id
   where c.id = (select id from alvo)), '4');

select teste.conferir('Todo entregavel aponta para a etapa dele',
  (select count(*)::text from public.deliverables
    where campaign_id = (select id from alvo) and subtask_id is null), '0');

select teste.conferir('O responsavel do KV viajou para a etapa',
  (select s.responsavel_id::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo) and d.nome = 'KV'),
  '44444444-4444-4444-4444-444444444444');


-- ---------------------------------------------------------------------------
-- 2. O SUB-ITEM E SUB-ETAPA DA ETAPA CERTA
--
-- ESTE E O CENARIO QUE NAO DA PARA TIRAR. A variavel que guarda a etapa e
-- reaproveitada pela sub-etapa dentro do laco; sem devolver o pai antes do
-- proximo filho, o segundo sub-item nasce filho do PRIMEIRO -- uma arvore de
-- quatro niveis, que o trigger `subtasks_agrupadora` recusa tres linhas
-- adiante falando de outra coisa. Aqui a pergunta e direta: os dois filhos
-- tem o MESMO pai, e o pai e a etapa do Enxoval.
-- ---------------------------------------------------------------------------
select teste.conferir('Os dois sub-itens tem o mesmo pai',
  (select count(distinct s.parent_id)::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo) and d.nome in ('Lamina', 'Banner')),
  '1');

select teste.conferir('E o pai e a etapa do Enxoval',
  (select (s.parent_id = (
             select se.id from public.deliverables de
               join public.subtasks se on se.id = de.subtask_id
              where de.campaign_id = (select id from alvo) and de.nome = 'Enxoval'
           ))::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo) and d.nome = 'Lamina'),
  'true');

select teste.conferir('Nenhuma etapa em quarto nivel',
  (select count(*)::text
     from public.subtasks neto
     join public.subtasks pai on pai.id = neto.parent_id
    where pai.parent_id is not null), '0');


-- ---------------------------------------------------------------------------
-- 3. A RPC NAO FURA A RLS
--
-- `abrir_campanha()` NAO e `security definer`, e este cenario e o que avisa
-- se alguem acrescentar a palavra: Joana e cliente, e cliente nao abre
-- demanda nem campanha. Uma funcao definer aqui deixaria qualquer pessoa
-- logada criar campanha em nome de qualquer empresa.
-- ---------------------------------------------------------------------------
select teste.cenario('Joana nao abre campanha pela RPC', :JOANA,
  format($fmt$select public.abrir_campanha(
    %L, 'Minha campanha', null, current_date, current_date + 5, 'ativa',
    'https://exemplo/pasta', null, null, null, '[]'::jsonb)$fmt$, :VERDE),
  'recusa');


-- ---------------------------------------------------------------------------
-- 4. A CAMPANHA SE FINALIZA SOZINHA -- E SO PELAS FOLHAS
--
-- Aprovar o KV e os dois sub-itens fecha tudo: sao as tres FOLHAS. O Enxoval
-- e grupo, e o status dele e derivado -- conta-lo tambem faria a campanha
-- esperar por um valor que ja saiu dos filhos.
-- ---------------------------------------------------------------------------
select teste.conferir('Antes de aprovar, a campanha esta ativa',
  (select status::text from public.campaigns where id = (select id from alvo)), 'ativa');

update public.deliverables set status = 'aprovado'
 where campaign_id = (select id from alvo) and nome = 'KV';

select teste.conferir('Com uma folha aprovada, continua ativa',
  (select status::text from public.campaigns where id = (select id from alvo)), 'ativa');

update public.deliverables set status = 'aprovado'
 where campaign_id = (select id from alvo) and nome in ('Lamina', 'Banner');

select teste.conferir('Com as tres folhas aprovadas, finaliza sozinha',
  (select status::text from public.campaigns where id = (select id from alvo)), 'finalizada');


-- ---------------------------------------------------------------------------
-- 5. E REABRE SOZINHA
--
-- "So e finalizada quando todas as suas etapas sao entregues e finalizadas"
-- vale nos dois sentidos: uma campanha com peca em producao nao esta
-- finalizada. Sem este ramo, acrescentar um entregavel deixaria a campanha na
-- aba que o cliente so abre para ver o que ja acabou.
-- ---------------------------------------------------------------------------
insert into public.deliverables (campaign_id, nome, ordem)
values ((select id from alvo), 'Peca que faltou', 9);

select teste.conferir('Entregavel novo reabre a campanha',
  (select status::text from public.campaigns where id = (select id from alvo)), 'ativa');

delete from public.deliverables
 where campaign_id = (select id from alvo) and nome = 'Peca que faltou';

select teste.conferir('E apagar a peca que faltava finaliza de novo',
  (select status::text from public.campaigns where id = (select id from alvo)), 'finalizada');


-- ---------------------------------------------------------------------------
-- 6. CAMPANHA SEM ENTREGAVEL NUNCA FINALIZA
--
-- `count(*) = 0` e `count(*) filter (where aprovado) = 0` sao iguais, e sem a
-- guarda toda campanha recem-aberta nasceria finalizada -- indo direto para a
-- aba que o cliente so abre para ver o que ja acabou.
-- ---------------------------------------------------------------------------
\set VAZIA '''c0510000-0000-0000-0000-000000000001'''
insert into public.campaigns (id, client_id, nome, data_inicio, data_fim, criado_por, status)
values (:VAZIA, :VERDE, 'Campanha vazia', current_date, current_date + 5, :DIEGO, 'ativa');

insert into public.deliverables (campaign_id, nome, ordem)
values (:VAZIA, 'Uma peca', 0);
delete from public.deliverables where campaign_id = :VAZIA;

select teste.conferir('Campanha sem entregavel continua ativa',
  (select status::text from public.campaigns where id = :VAZIA), 'ativa');


-- ---------------------------------------------------------------------------
-- 7. `planejamento` NAO E TOCADO
--
-- Promover a finalizada uma campanha que nem comecou -- porque ela nao tem
-- entregavel aprovado nenhum -- seria afirmar que acabou o que nao comecou.
-- ---------------------------------------------------------------------------
\set PLAN '''c0510000-0000-0000-0000-000000000002'''
insert into public.campaigns (id, client_id, nome, data_inicio, data_fim, criado_por, status)
values (:PLAN, :VERDE, 'Campanha do mes que vem', current_date + 30, current_date + 60, :DIEGO, 'planejamento');

insert into public.deliverables (campaign_id, nome, ordem, status)
values (:PLAN, 'Peca ja aprovada', 0, 'aprovado');

select teste.conferir('Campanha em planejamento nao vira finalizada',
  (select status::text from public.campaigns where id = :PLAN), 'planejamento');

drop table alvo;


-- ===========================================================================
-- 0052 - QUEM APROVA A PECA CONCLUI A ETAPA
--
-- "O responsavel entrega, e o cliente conclui, quando aprova" -- decisao do
-- usuario. E o fecho do fio que a 0051 comecou: sem isto a etapa ficava
-- aberta para sempre, e quem a fez tinha que voltar ao Minhas Tasks para
-- marcar concluida uma peca que o cliente ja tinha aprovado.
--
-- O CENARIO QUE NAO DA PARA TIRAR e o quarto: o trigger nunca pode derrubar a
-- aprovacao do cliente. Ele esta do outro lado, sem ninguem por perto, e o
-- que veria seria a aprovacao dele falhando com uma mensagem sobre uma etapa
-- que ele nem sabe que existe.
-- ===========================================================================
\set C52  '''c0520000-0000-0000-0000-000000000001'''

create temporary table alvo52 (id uuid);
grant all on alvo52 to authenticated;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :DIEGO, true);
insert into alvo52
select public.abrir_campanha(
  :VERDE, 'Wave que o cliente fecha', null,
  current_date, current_date + 20, 'ativa',
  'https://drive.google.com/pasta', null, null, null,
  '[{"nome":"Cartaz","prazo":null,"responsavel":"44444444-4444-4444-4444-444444444444","filhos":[]},
    {"nome":"Folder","prazo":null,"responsavel":"44444444-4444-4444-4444-444444444444","filhos":[]}]'::jsonb
);
commit;
reset role;

select teste.conferir('A etapa nasce nao iniciada',
  (select s.status::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo52) and d.nome = 'Cartaz'),
  'nao_iniciada');

-- 1. O CLIENTE APROVA, E A ETAPA FECHA
update public.deliverables set status = 'aprovado'
 where campaign_id = (select id from alvo52) and nome = 'Cartaz';

select teste.conferir('Aprovar a peca concluiu a etapa',
  (select s.status::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo52) and d.nome = 'Cartaz'),
  'concluida');

-- O CARIMBO VEM DE `validar_transicao_de_subtarefa`, e nao do trigger novo:
-- ele ja preenchia `concluida_em` desde a 0007. Escrever a data aqui tambem
-- seria a segunda verdade sobre a mesma coisa.
select teste.conferir('E com a data de conclusao carimbada',
  (select (s.concluida_em is not null)::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo52) and d.nome = 'Cartaz'),
  'true');

-- E SO A DELA. Aprovar o Cartaz nao fecha o Folder -- o criterio de aceite
-- que mais teria como passar batido numa tela: ver o contador subir nao prova
-- que a etapa irma ficou parada.
select teste.conferir('A etapa do Folder nao se mexeu',
  (select s.status::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo52) and d.nome = 'Folder'),
  'nao_iniciada');

-- 2. PEDIR AJUSTES REABRE
update public.deliverables set status = 'ajustes'
 where campaign_id = (select id from alvo52) and nome = 'Cartaz';

select teste.conferir('Pedir ajustes devolve a etapa ao trabalho',
  (select s.status::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo52) and d.nome = 'Cartaz'),
  'em_andamento');

select teste.conferir('E a data de conclusao foi apagada',
  (select (s.concluida_em is null)::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo52) and d.nome = 'Cartaz'),
  'true');

-- 3. A ETAPA QUE EXIGE AVAL PROPRIO FICA ABERTA
--
-- `requer_aprovacao = true` e alguem dizendo "isto precisa de validacao
-- interna antes de fechar", e a aprovacao do cliente no entregavel nao e essa
-- validacao. A etapa continua aberta -- que e a verdade, e e o que a pessoa
-- ve em Minhas Tasks.
update public.subtasks set requer_aprovacao = true, tipo_aprovacao = 'interna'
 where id = (select d.subtask_id from public.deliverables d
              where d.campaign_id = (select id from alvo52) and d.nome = 'Folder');

update public.deliverables set status = 'aprovado'
 where campaign_id = (select id from alvo52) and nome = 'Folder';

select teste.conferir('Etapa que exige aval proprio nao fecha pela aprovacao do cliente',
  (select s.status::text
     from public.deliverables d join public.subtasks s on s.id = d.subtask_id
    where d.campaign_id = (select id from alvo52) and d.nome = 'Folder'),
  'nao_iniciada');

-- 4. E A APROVACAO DO CLIENTE PASSA ASSIM MESMO
--
-- ESTE E O CENARIO QUE PROTEGE QUEM ESTA DO OUTRO LADO. Se o trigger
-- levantasse excecao no caso acima, o que o cliente veria era a aprovacao
-- dele falhando com uma mensagem sobre uma etapa que ele nem sabe que existe
-- -- e a peca continuaria esperando por ele, para sempre.
select teste.conferir('Mas a peca ficou aprovada',
  (select status::text from public.deliverables
    where campaign_id = (select id from alvo52) and nome = 'Folder'),
  'aprovado');

drop table alvo52;
