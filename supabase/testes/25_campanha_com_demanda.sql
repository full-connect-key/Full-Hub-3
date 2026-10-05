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


-- ===========================================================================
-- 0053 - A ENTREGA TEM VARIOS ARQUIVOS, E NEM TODOS SAO IMAGEM
--
-- "Algumas artes eu devo poder upar mais de uma versao. E ate mesmo arquivos
-- -- ja que algumas entregas sao em PDF, PSD ou AI." Decisao do usuario.
--
-- Mais de uma versao ja funcionava desde a 0033. O que faltava era mais de um
-- ARQUIVO na mesma versao: "Lamina A5" e o PDF de impressao, o AI aberto e o
-- JPG de conferencia -- tres arquivos, uma entrega, uma decisao do cliente.
-- ===========================================================================
\set C53  '''c0530000-0000-0000-0000-000000000001'''
\set D53  '''d0530000-0000-0000-0000-000000000001'''

insert into public.campaigns (id, client_id, nome, data_inicio, data_fim, criado_por, status)
values (:C53, :VERDE, 'Wave dos arquivos', current_date, current_date + 10, :DIEGO, 'ativa');

insert into public.deliverables (id, campaign_id, nome, ordem)
values (:D53, :C53, 'Lamina A5', 0);

-- 1. A CAPA E A PRIMEIRA IMAGEM, E NAO O PRIMEIRO ARQUIVO
--
-- O PSD vem primeiro na lista de proposito: e a ordem em que o designer sobe
-- (o arquivo aberto, depois o fechado, depois a previa). Com "o primeiro" como
-- capa, o cartao e a miniatura do portal ficariam com uma moldura quebrada --
-- e ninguem ligaria uma coisa a outra.
insert into public.deliverable_versions (deliverable_id, arquivos, notas_mudanca, criado_por)
values (:D53,
  '[{"url":"verde/entregaveis/lamina.psd","nome":"lamina.psd"},
    {"url":"verde/entregaveis/lamina.pdf","nome":"lamina.pdf"},
    {"url":"verde/entregaveis/lamina.jpg","nome":"lamina.jpg"}]'::jsonb,
  'Primeira leva', :BRUNO);

select teste.conferir('A capa e a primeira IMAGEM da lista, e nao o PSD',
  (select arte_url from public.deliverables where id = :D53),
  'verde/entregaveis/lamina.jpg');

-- 2. E O NOME CONTA QUANTOS SAO
--
-- Mostrar o nome do primeiro e sumir com os outros dois e a mesma mentira que
-- a lista de slides do carrossel ja tinha contado uma vez.
select teste.conferir('Com tres arquivos, o cartao diz quantos sao',
  (select arquivo_nome from public.deliverables where id = :D53), '3 arquivos');

-- 3. COM UM SO, O NOME E O DO ARQUIVO
insert into public.deliverable_versions (deliverable_id, arquivos, criado_por)
values (:D53, '[{"url":"verde/entregaveis/final.pdf","nome":"lamina-final.pdf"}]'::jsonb, :BRUNO);

select teste.conferir('Com um arquivo so, o cartao mostra o nome dele',
  (select arquivo_nome from public.deliverables where id = :D53), 'lamina-final.pdf');

-- 4. E A CAPA ANTIGA NAO E APAGADA POR UMA VERSAO SEM IMAGEM
--
-- O `coalesce` e o que segura isso: subir so o PDF final nao pode apagar a
-- previa que o cliente esta vendo. Este cenario e o unico que falha se alguem
-- trocar o `coalesce` por atribuicao direta.
select teste.conferir('Versao sem imagem nao apaga a capa',
  (select arte_url from public.deliverables where id = :D53),
  'verde/entregaveis/lamina.jpg');

-- 5. A VERSAO CONTINUA SENDO NUMERADA PELO BANCO
select teste.conferir('A segunda versao e a v2',
  (select max(numero_versao)::text from public.deliverable_versions
    where deliverable_id = :D53), '2');

-- 6. E O CLIENTE NAO ESCREVE VERSAO NENHUMA
--
-- Nao existe botao de reverter em lugar nenhum do portal, e a trava e esta --
-- nao a ausencia do botao.
select teste.cenario('Joana nao grava versao de entregavel', :JOANA,
  format($fmt$insert into public.deliverable_versions (deliverable_id, arquivos)
    values (%L, '[]'::jsonb)$fmt$, :D53), 'recusa');


-- ===========================================================================
-- 0054 - VER A CAMPANHA E ABRIR UMA CAMPANHA SAO DUAS DECISOES
--
-- "Essa area deve ser visivel para os colaboradores (...) ja que quem vao
-- upar e fazer os conteudos sao os responsaveis e NAO O ATENDIMENTO."
-- Decisao do usuario -- e a frase separa as duas coisas na mesma linha.
--
-- Estes cenarios sao o que avisa se alguem abrir a segunda junto com a
-- primeira, achando que uma acompanha a outra.
-- ===========================================================================

-- 1. O COLABORADOR VE A CAMPANHA. E o ponto inteiro da mudanca: o modulo
--    aparece para ele porque o material e dele.
select teste.cenario('O colaborador enxerga as campanhas', :BRUNO,
  format('select 1 from public.campaigns where id = %L', :C53), 'ok', 1);

-- 2. E SOBE ARQUIVO NELA. Gravar versao sempre foi `is_staff()` desde a 0033
--    -- o que faltava era a tela.
select teste.cenario('E grava versao do entregavel', :BRUNO,
  format($fmt$insert into public.deliverable_versions (deliverable_id, arquivos, criado_por)
    values (%L, '[{"url":"verde/e/a.pdf","nome":"a.pdf"}]'::jsonb, %L)$fmt$, :D53, :BRUNO),
  'ok', 1);

-- 3. MAS NAO ABRE CAMPANHA.
--
-- Antes da 0054 `campaigns_insert` era `is_staff()`, e com o modulo aberto
-- ela passaria a valer para ele -- a guarda de tela seria a unica coisa entre
-- o colaborador e uma campanha aberta por engano.
select teste.cenario('O colaborador nao abre campanha', :BRUNO,
  format($fmt$insert into public.campaigns (client_id, nome, data_inicio, data_fim, criado_por)
    values (%L, 'Campanha minha', current_date, current_date + 5, %L)$fmt$, :VERDE, :BRUNO),
  'recusa');

-- 4. NEM PELA RPC, que e por onde a tela abre.
select teste.cenario('Nem pela funcao que a tela usa', :BRUNO,
  format($fmt$select public.abrir_campanha(
    %L, 'Campanha minha', null, current_date, current_date + 5, 'ativa',
    'https://exemplo/pasta', null, null, null, '[]'::jsonb)$fmt$, :VERDE),
  'recusa');

-- 5. E O ATENDIMENTO ABRE SENDO COLABORADOR.
--
-- ESTE E O CENARIO QUE SEPARA `is_atendimento()` DE `is_gestor()`. Marina e
-- colaboradora e e do Atendimento: perfil de acesso e funcao na agencia sao
-- coisas diferentes, e uma checagem de role na tela ("desenvolvedor ou
-- socio") a deixaria de fora do trabalho que e dela.
update public.team_members set funcao = 'Atendimento' where user_id = :MARINA;

select teste.cenario('Marina, do Atendimento, abre campanha sendo colaboradora', :MARINA,
  format($fmt$insert into public.campaigns (client_id, nome, data_inicio, data_fim, criado_por)
    values (%L, 'Campanha do Atendimento', current_date, current_date + 5, %L)$fmt$,
    :VERDE, :MARINA),
  'ok', 1);

-- 6. E APAGAR CONTINUA SENDO DA GESTAO, mesmo com o modulo aberto.
select teste.cenario('O colaborador continua sem apagar campanha', :BRUNO,
  format('delete from public.campaigns where id = %L', :C53), 'recusa');


-- ===========================================================================
-- 0078 -- EDITAR A CAMPANHA DEPOIS DE ABERTA
--
-- Decisao do usuario. O que estes cenarios guardam:
--
--   1. `campaigns_update` e `is_staff()` desde a 0033 e TEM que continuar
--      sendo -- e por ela que quem produz troca a CAPA (0050). Entao a trava
--      de nome, periodo e estado nao pode estar na policy: ela e um trigger de
--      coluna, como `posts_protege_colunas`. Os dois primeiros cenarios sao a
--      mesma pessoa, na mesma tabela, com a mesma policy: um passa e o outro
--      nao. **Tirando o trigger, o segundo passa** -- e e esse o furo.
--
--   2. A EMPRESA NAO SE TROCA PARA NINGUEM, nem para o socio. `abrir_campanha`
--      cria a demanda com o mesmo `client_id`, e a visibilidade de cada peca
--      no portal sai dai: trocar a empresa deixaria as pecas ja enviadas
--      visiveis para quem nao as pediu.
--
--   3. O TITULO DA DEMANDA ACOMPANHA O NOME, e o PERIODO nao -- o da demanda e
--      derivado das etapas desde a 0028, e espelha-lo seria gravar um valor
--      que o proximo recalculo desfaz.
-- ===========================================================================

\set C78 '''c0780000-0000-0000-0000-000000000001'''

-- A campanha COM demanda, pela RPC, que e o caminho que a tela usa.
select teste.cenario('Abre a campanha que vai ser editada', :ANA,
  format($fmt$select public.abrir_campanha(
    %L, 'Wave de outubro', null, current_date, current_date + 20, 'ativa',
    'https://drive.google.com/wave78', null, null, null,
    '[{"nome":"Lamina","prazo":null,"responsavelId":null,"filhos":[]}]'::jsonb)$fmt$,
    :VERDE),
  'ok');

do $$
declare c uuid;
begin
  select id into c from public.campaigns where nome = 'Wave de outubro';
  perform set_config('teste.campanha_78', c::text, false);
end
$$;

-- 1. O COLABORADOR TROCA A CAPA -- a policy e `is_staff()`, e e por isso que
-- a trava das outras colunas nao pode morar nela.
select teste.cenario('O colaborador troca a capa', :BRUNO,
  format($fmt$update public.campaigns set capa_url = 'verde/capas/x.png' where id = %L$fmt$,
    current_setting('teste.campanha_78')),
  'ok', 1);

-- 2. E NAO TROCA O NOME, NEM O PERIODO, NEM O ESTADO.
select teste.cenario('Mas nao renomeia a campanha', :BRUNO,
  format($fmt$update public.campaigns set nome = 'Wave do Bruno' where id = %L$fmt$,
    current_setting('teste.campanha_78')),
  'recusa');

select teste.cenario('Nem mexe no periodo combinado', :BRUNO,
  format($fmt$update public.campaigns set data_fim = current_date + 90 where id = %L$fmt$,
    current_setting('teste.campanha_78')),
  'recusa');

select teste.cenario('Nem no estado da campanha', :BRUNO,
  format($fmt$update public.campaigns set status = 'cancelada' where id = %L$fmt$,
    current_setting('teste.campanha_78')),
  'recusa');

-- 3. O ATENDIMENTO EDITA SENDO COLABORADOR -- Marina virou Atendimento na
-- secao 5 acima, e e o mesmo cenario que separa `is_atendimento()` de
-- `is_gestor()`.
select teste.cenario('Marina, do Atendimento, edita sendo colaboradora', :MARINA,
  format($fmt$update public.campaigns
     set nome = 'Wave de outubro e novembro', data_fim = current_date + 40
   where id = %L$fmt$, current_setting('teste.campanha_78')),
  'ok', 1);

-- 4. O TITULO DA DEMANDA ACOMPANHOU.
select teste.conferir('O titulo da demanda acompanha o nome da campanha',
  (select t.titulo from public.tasks t
     join public.campaigns c on c.task_id = t.id
    where c.id = current_setting('teste.campanha_78')::uuid),
  'Wave de outubro e novembro');

-- 5. E O PERIODO DA DEMANDA *NAO* ACOMPANHOU.
--
-- E O CENARIO QUE IMPEDE A SIMETRIA. Espelhar o periodo parece o par obvio do
-- titulo, e seria gravar um valor que `recalcular_periodo_da_task()` (0028)
-- desfaz na proxima escrita em `subtasks` -- a escolha passa e some depois,
-- sem ninguem ver. Quem acrescentar `data_fim` ao espelho derruba este.
select teste.conferir('O periodo da demanda continua sendo o das etapas',
  (select (t.data_fim is distinct from c.data_fim)::text
     from public.tasks t
     join public.campaigns c on c.task_id = t.id
    where c.id = current_setting('teste.campanha_78')::uuid),
  'true');

-- 6. A EMPRESA NAO SE TROCA, NEM PARA O SOCIO.
--
-- A unica recusa deste trigger que vale para todo mundo, e ela vem ANTES do
-- `return` de `is_atendimento()` de proposito.
select teste.cenario('Nem o socio troca a empresa da campanha', :ANA,
  format($fmt$update public.campaigns set client_id = 'aaaaaaaa-0000-0000-0000-000000000002'
   where id = %L$fmt$, current_setting('teste.campanha_78')),
  'recusa');


-- ===========================================================================
-- A ANALISE INTERNA DA PECA, E A PONTE QUE NINGUEM ATRAVESSAVA
--
-- Decisao do usuario: *"quando o colaborador sobe uma arte dentro de uma
-- campanha, apareca um botao de enviar para analise ao inves de enviar para o
-- cliente (...) os desenvolvedores e socios devem avaliar a arte e enviar para
-- o cliente, ou solicitar alteracao"*.
--
-- **NAO HA MIGRATION, E E O PONTO.** `validar_nova_rodada` recusa a rodada de
-- escopo `cliente` num entregavel enquanto nao houver a INTERNA do mesmo
-- numero aprovada -- esta no banco desde a 0033, na mesma forma do post. O que
-- faltava era a acao que abre a interna: a tela de producao tinha "Enviar ao
-- cliente" e mais nada, e o banco recusava.
--
-- Estes cenarios guardam o caminho inteiro, e o ultimo e o que importa: subir
-- uma versao nova DEPOIS do aval invalida o aval. Sem ele, o designer subiria
-- a v2 e o botao continuaria ligado -- mandando ao cliente uma arte que
-- ninguem olhou.
-- ===========================================================================

\set CAN '''ca000000-0000-0000-0000-000000000001'''
\set PEC '''be000000-0000-0000-0000-000000000001'''

insert into public.campaigns (id, client_id, nome, data_inicio, data_fim, criado_por, status)
values (:CAN, :VERDE, 'Wave da analise', current_date, current_date + 10, :DIEGO, 'ativa');

-- A PECA E DO BRUNO, que e colaborador: e ele quem produz e quem manda para
-- analise.
insert into public.deliverables (id, campaign_id, nome, ordem, responsavel_id)
values (:PEC, :CAN, 'Lamina da analise', 0, :BRUNO);

-- 1. SEM ARQUIVO O BANCO NAO TEM O QUE RECUSAR -- quem recusa e a tela, e e
-- escolha: `arte_url` nulo nao e regra de aprovacao, e uma trava a mais no
-- trigger seria uma segunda verdade sobre a mesma coisa. O cenario fica para
-- registrar que a trava NAO esta aqui.
select teste.cenario('A primeira versao, com arquivo', :BRUNO,
  format($fmt$insert into public.deliverable_versions (deliverable_id, arquivos, criado_por)
    values (%L, '[{"url":"verde/e/v1.pdf","nome":"v1.pdf"}]'::jsonb, %L)$fmt$, :PEC, :BRUNO),
  'ok', 1);

-- 2. E A GESTAO NAO ENVIA AO CLIENTE ANTES DO AVAL INTERNO.
--
-- E O CENARIO QUE PROVA QUE A ANALISE NAO E DECORATIVA. Ele passava
-- despercebido porque ninguem conseguia chegar ate aqui: a acao da tela
-- montava a rodada com `max + 1`, que nunca casa com a interna.
select teste.cenario('A gestao nao envia ao cliente sem o aval interno', :ANA,
  format($fmt$insert into public.approval_rounds
      (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('deliverable', %L, 1, 'cliente', %L)$fmt$, :PEC, :ANA),
  'recusa');

-- 3. QUEM PRODUZIU MANDA PARA ANALISE.
select teste.cenario('Quem produziu manda a peca para analise', :BRUNO,
  format($fmt$insert into public.approval_rounds
      (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('deliverable', %L, 1, 'interna', %L)$fmt$, :PEC, :BRUNO),
  'ok', 1);

-- 4. E O COLABORADOR NAO DECIDE A PROPRIA ANALISE.
--
-- Quem barra e `approval_rounds_decide`, por `pode_aprovar_entregavel()`. A
-- 0029 tirou a trava de autoaprovacao da GESTAO; o colaborador continua sem
-- decidir nada, que e a outra metade daquela decisao.
select teste.cenario('O colaborador nao decide a propria analise', :BRUNO,
  format($fmt$update public.approval_rounds set status = 'aprovada'
   where content_type = 'deliverable' and content_id = %L and escopo = 'interna'$fmt$, :PEC),
  'recusa');

select teste.cenario('A gestao aprova a analise', :ANA,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L
   where content_type = 'deliverable' and content_id = %L and escopo = 'interna'$fmt$,
   :ANA, :PEC),
  'ok', 1);

-- 5. AGORA O ENVIO AO CLIENTE PASSA.
select teste.cenario('Com o aval, a gestao envia ao cliente', :ANA,
  format($fmt$insert into public.approval_rounds
      (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('deliverable', %L, 1, 'cliente', %L)$fmt$, :PEC, :ANA),
  'ok', 1);

-- E O ENVIO CARIMBOU A PECA, por `marcar_conteudo_como_enviado` (0033): e
-- assim que ela passa a existir para o cliente.
select teste.conferir('O envio carimbou a peca',
  (select (enviado_em is not null)::text from public.deliverables where id = :PEC),
  'true');

-- 6. A VERSAO NOVA INVALIDA O AVAL.
--
-- E O CENARIO QUE IMPEDE A ARTE NAO OLHADA DE SAIR. Subir a v2 depois do aval
-- da v1 e o caso real: o designer corrige uma coisa e manda. Com o numero da
-- rodada casado com a versao, a v2 nao tem interna aprovada e o banco recusa.
-- Se alguem voltar a numerar por `max + 1`, ou a pedir a interna com um numero
-- proprio, este cenario cai.
select teste.cenario('A segunda versao', :BRUNO,
  format($fmt$insert into public.deliverable_versions (deliverable_id, arquivos, criado_por)
    values (%L, '[{"url":"verde/e/v2.pdf","nome":"v2.pdf"}]'::jsonb, %L)$fmt$, :PEC, :BRUNO),
  'ok', 1);

select teste.conferir('A peca esta na v2',
  (select versao_atual::text from public.deliverables where id = :PEC), '2');

select teste.cenario('E a v2 nao vai ao cliente com o aval da v1', :ANA,
  format($fmt$insert into public.approval_rounds
      (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('deliverable', %L, 2, 'cliente', %L)$fmt$, :PEC, :ANA),
  'recusa');


-- ===========================================================================
-- 0079 - A PECA VOLTA PARA QUEM A PRODUZIU, COM O PEDIDO ESCRITO
--
-- Relato do usuario: *"quando o atendimento devolve uma peca da campanha para
-- ajuste, ela nao esta voltando (...) e que as notificacoes comecem a
-- funcionar"*.
--
-- A causa era uma decisao minha: `decidirRodadaDeEntregavel` nao mexia em
-- `deliverables.status`, copiando a regra do post -- e o motivo dela nao
-- valia aqui, porque nao existe trigger em `deliverables.status` falando do
-- cliente. A rodada virava `ajustes_solicitados` e nada mais acontecia.
--
-- ESTES CENARIOS SAO O QUE NENHUMA TELA MOSTRARIA, e sao quatro fatos de uma
-- decisao so: a peca volta para a producao, a ETAPA dela volta para o
-- trabalho (e e isso que a devolve ao Minhas Tasks de quem produziu), o
-- pedido vira comentario na demanda, e o sino toca.
--
-- E o ultimo guarda o lado oposto: `aprovado` NAO e desfeito. Sem ele, a
-- recusa interna da v2 apagaria a aprovacao que o cliente deu na v1.
-- ===========================================================================
\set C79 '''c0790000-0000-0000-0000-000000000001'''

create temporary table alvo79 (id uuid);
grant all on alvo79 to authenticated;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :DIEGO, true);
insert into alvo79
select public.abrir_campanha(
  :VERDE, 'Wave que volta', null,
  current_date, current_date + 20, 'ativa',
  'https://drive.google.com/volta', null, null, null,
  '[{"nome":"Lamina que volta","prazo":null,"responsavel":"44444444-4444-4444-4444-444444444444","filhos":[]}]'::jsonb
);
commit;
reset role;

-- A peca e a etapa, nomeadas por uma vista so: o id sai do nome, porque o
-- `abrir_campanha` gera uuid e guardar o retorno daria o da CAMPANHA.
create temporary view peca79 as
  select d.id, d.subtask_id, s.task_id
    from public.deliverables d
    join public.campaigns c on c.id = d.campaign_id
    join public.subtasks s on s.id = d.subtask_id
   where c.nome = 'Wave que volta';
grant all on peca79 to authenticated;

insert into public.deliverable_versions (deliverable_id, arquivos, criado_por)
select id, '[{"url":"verde/volta/v1.pdf","nome":"v1.pdf"}]'::jsonb, :BRUNO from peca79;

-- A ETAPA COMECA O TRABALHO, senao ela esta em `nao_iniciada` e a volta para
-- `em_andamento` nao prova nada -- seria o estado que o espelho da 0080 ja
-- deixaria. Daqui ela vai para `enviada_aprovacao`? Nao: a rodada e do
-- ENTREGAVEL, e a trava 3 cobra uma rodada da propria subtarefa. A etapa fica
-- em `em_andamento` e e justamente de la que ela nao pode sair sozinha.
update public.subtasks set status = 'aguardando_informacoes'
 where id in (select subtask_id from peca79);

delete from public.notifications;

select teste.cenario('Quem produziu manda a lamina para analise', :BRUNO,
  format($fmt$insert into public.approval_rounds
      (content_type, content_id, numero_rodada, escopo, solicitado_por)
    select 'deliverable', id, 1, 'interna', %L from peca79$fmt$, :BRUNO),
  'ok', 1);

-- ---------------------------------------------------------------------------
-- A GESTAO ATIVA INTEIRA E AVISADA quando a conta nao tem aprovador
-- configurado -- e era este o buraco do "as notificacoes nao funcionam":
-- `avisa_aprovador_da_conta()` so avisava `client_flow_defaults.aprovador_interno_id`,
-- que e opcional e esta nulo na maioria das contas. E `deliverable` nem
-- chegava ali: caia num `else return new`.
--
-- O Bruno abriu a rodada, entao ele nao recebe -- e `notificar()` quem
-- garante. Ana e Diego sao a gestao do seed; a contagem e por isso 2.
-- ---------------------------------------------------------------------------
select teste.conferir('A gestao foi avisada da analise da peca',
  (select count(*)::text from public.notifications n
     join public.profiles p on p.id = n.user_id
    where n.tipo = 'aprovacao' and p.role in ('desenvolvedor', 'socio')),
  '2');

select teste.conferir('E o aviso nomeia a peca',
  (select (count(*) > 0)::text from public.notifications
    where corpo like 'Lamina que volta%'),
  'true');

select teste.conferir('Quem pediu a analise nao recebe aviso',
  (select count(*)::text from public.notifications where user_id = :BRUNO),
  '0');

delete from public.notifications;

-- ---------------------------------------------------------------------------
-- E AGORA A DECISAO. Ana pede ajustes, com o recado.
-- ---------------------------------------------------------------------------
select teste.cenario('A gestao pede ajustes na analise da peca', :ANA,
  format($fmt$update public.approval_rounds
     set status = 'ajustes_solicitados', decidido_por = %L, decidido_em = now(),
         comentario = 'O logo no rodape ficou pequeno.'
   where content_type = 'deliverable' and escopo = 'interna'
     and content_id in (select id from peca79)$fmt$, :ANA),
  'ok', 1);

select teste.conferir('A peca voltou para a producao',
  (select d.status::text from public.deliverables d where d.id in (select id from peca79)),
  'em_producao');

-- O CENARIO QUE RESPONDE AO RELATO. Sem a linha da etapa no trigger, a peca
-- nao aparece no Minhas Tasks de quem a produziu -- e e lá que ele a procura.
select teste.conferir('E a ETAPA dela voltou para o trabalho',
  (select s.status::text from public.subtasks s
    where s.id in (select subtask_id from peca79)),
  'em_andamento');

-- `em_ajustes` NAO e o status da etapa, e o cenario registra por que: a trava
-- 4 de `validar_transicao_de_subtarefa` cobra uma rodada `ajustes_solicitados`
-- na propria SUBTAREFA, e esta rodada e do entregavel. Quem trocar
-- `em_andamento` por `em_ajustes` no trigger derruba a decisao da gestao com
-- uma excecao sobre a etapa.
select teste.conferir('O pedido de ajuste virou comentario na demanda',
  (select (count(*) > 0)::text from public.task_comentarios c
    where c.subtask_id in (select subtask_id from peca79)
      and c.texto like '%logo no rodape ficou pequeno%'
      and c.interno),
  'true');

select teste.conferir('E quem produziu recebeu o sino',
  (select count(*)::text from public.notifications
    where user_id = :BRUNO and tipo = 'aprovacao'
      and titulo like 'Ajustes pedidos%'),
  '1');

select teste.conferir('Com o recado no corpo do aviso',
  (select corpo from public.notifications
    where user_id = :BRUNO and titulo like 'Ajustes pedidos%' limit 1),
  'O logo no rodape ficou pequeno.');

-- ---------------------------------------------------------------------------
-- O `aprovado` NAO E DESFEITO, e este e o cenario que impede a correcao de
-- virar um estrago: a recusa interna de uma versao nova nao pode apagar a
-- aprovacao que o cliente deu na anterior. O que ela diz e "esta versao nao
-- sai", nao "a outra deixou de valer".
-- ---------------------------------------------------------------------------
update public.deliverables set status = 'aprovado' where id in (select id from peca79);
delete from public.notifications;

select teste.cenario('A segunda analise da mesma lamina', :BRUNO,
  format($fmt$insert into public.approval_rounds
      (content_type, content_id, numero_rodada, escopo, solicitado_por)
    select 'deliverable', id, 2, 'interna', %L from peca79$fmt$, :BRUNO),
  'ok', 1);

select teste.cenario('E a gestao recusa esta', :ANA,
  format($fmt$update public.approval_rounds
     set status = 'rejeitada', decidido_por = %L, decidido_em = now(),
         comentario = 'Nao e isso.'
   where content_type = 'deliverable' and escopo = 'interna' and numero_rodada = 2
     and content_id in (select id from peca79)$fmt$, :ANA),
  'ok', 1);

select teste.conferir('A peca aprovada pelo cliente continua aprovada',
  (select d.status::text from public.deliverables d where d.id in (select id from peca79)),
  'aprovado');


-- ===========================================================================
-- 0080 - A CAMPANHA E A TASK MAE, E AS SUBTAREFAS SAO OS ITENS DELA
--
-- Decisao do usuario: *"quero que a campanha apareca como uma task. A
-- campanha e a task mae, e as subtarefas sao os itens da campanha."*
--
-- A frase ja era verdade, e so no instante da abertura: dali em diante os dois
-- lados andavam separados. Nao havia caminho nenhum para acrescentar item a
-- uma campanha aberta, e acrescentar ETAPA na demanda -- o caminho que
-- existe, e que a tela de producao MANDA usar -- nao criava peca.
--
-- O PRIMEIRO CENARIO E O QUE IMPEDE A REGRESSAO CARA: `abrir_campanha()`
-- parou de inserir entregavel, porque o espelho o cria. Devolvendo os dois
-- `insert into deliverables` a ela, cada item nasce DUAS vezes -- e a
-- contagem cai aqui em vez de aparecer como uma campanha com o dobro dos
-- itens que a demanda tem.
-- ===========================================================================
\set C80 '''c0800000-0000-0000-0000-000000000001'''

create temporary table alvo80 (id uuid);
grant all on alvo80 to authenticated;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :DIEGO, true);
insert into alvo80
select public.abrir_campanha(
  :VERDE, 'Wave espelhada', null,
  current_date, current_date + 20, 'ativa',
  'https://drive.google.com/espelho', null, null, null,
  '[{"nome":"Cartaz espelhado","prazo":null,"responsavel":null,
     "filhos":[{"nome":"Versao A4","prazo":null,"responsavel":null}]}]'::jsonb
);
commit;
reset role;

create temporary view camp80 as
  select c.id, c.task_id from public.campaigns c where c.nome = 'Wave espelhada';
grant all on camp80 to authenticated;

select teste.conferir('A abertura nao duplica o item',
  (select count(*)::text from public.deliverables d
    where d.campaign_id in (select id from camp80)),
  '2');

select teste.conferir('E a arvore chegou com o sub-item debaixo do pai',
  (select count(*)::text from public.deliverables f
    join public.deliverables p on p.id = f.parent_id
   where f.campaign_id in (select id from camp80) and f.nome = 'Versao A4'
     and p.nome = 'Cartaz espelhado'),
  '1');

-- ---------------------------------------------------------------------------
-- A ETAPA NOVA NA DEMANDA VIRA PECA, que e o caminho que nao existia -- e a
-- frase da tela de producao (*"Acrescente na demanda - cada etapa vira uma
-- peca aqui"*) era uma promessa que o produto nao cumpria.
-- ---------------------------------------------------------------------------
select teste.cenario('O Atendimento acrescenta uma etapa na demanda da campanha', :MARINA,
  $$insert into public.subtasks (task_id, titulo, ordem, responsavel_id)
    select task_id, 'Tabloide novo', 9, '44444444-4444-4444-4444-444444444444' from camp80$$,
  'ok', 1);

select teste.conferir('E ela virou peca da campanha',
  (select count(*)::text from public.deliverables d
    where d.campaign_id in (select id from camp80) and d.nome = 'Tabloide novo'),
  '1');

select teste.conferir('Com o responsavel e a ordem da etapa',
  (select (d.responsavel_id = :BRUNO and d.ordem = 9)::text
     from public.deliverables d
    where d.campaign_id in (select id from camp80) and d.nome = 'Tabloide novo'),
  'true');

-- ---------------------------------------------------------------------------
-- RENOMEAR A ETAPA RENOMEIA A PECA. Sem isto a peca fica com o nome de
-- fabrica para sempre -- o bug que o titulo da subtarefa de post ja teve.
-- ---------------------------------------------------------------------------
select teste.cenario('Renomear a etapa', :MARINA,
  $$update public.subtasks set titulo = 'Tabloide A3'
     where task_id in (select task_id from camp80) and titulo = 'Tabloide novo'$$,
  'ok', 1);

select teste.conferir('A peca acompanhou o nome',
  (select count(*)::text from public.deliverables d
    where d.campaign_id in (select id from camp80) and d.nome = 'Tabloide A3'),
  '1');

-- ---------------------------------------------------------------------------
-- APAGAR A ETAPA VAZIA APAGA A PECA -- e so a vazia. A peca com versao
-- gravada FICA, sem etapa: levar junto a arte que o cliente aprovou por causa
-- de um clique numa lista de etapas e perda de material, e a regra da casa e
-- que apagar nao e desfazer.
-- ---------------------------------------------------------------------------
select teste.cenario('Apagar a etapa sem material', :ANA,
  $$delete from public.subtasks
     where task_id in (select task_id from camp80) and titulo = 'Tabloide A3'$$,
  'ok', 1);

select teste.conferir('A peca vazia foi com ela',
  (select count(*)::text from public.deliverables d
    where d.campaign_id in (select id from camp80) and d.nome = 'Tabloide A3'),
  '0');

insert into public.deliverable_versions (deliverable_id, arquivos, criado_por)
select d.id, '[{"url":"verde/espelho/v1.pdf","nome":"v1.pdf"}]'::jsonb, :BRUNO
  from public.deliverables d
 where d.campaign_id in (select id from camp80) and d.nome = 'Cartaz espelhado';

select teste.cenario('Apagar a etapa da peca que tem material', :ANA,
  $$delete from public.subtasks
     where task_id in (select task_id from camp80) and titulo = 'Cartaz espelhado'$$,
  'ok', 1);

select teste.conferir('A peca com arquivo ficou, e sem etapa',
  (select (count(*) filter (where d.subtask_id is null))::text
     from public.deliverables d
    where d.campaign_id in (select id from camp80) and d.nome = 'Cartaz espelhado'),
  '1');

-- ---------------------------------------------------------------------------
-- E O ESPELHO NAO ALCANCA DEMANDA QUE NAO E DE CAMPANHA, que e a outra metade:
-- sem `campanha_da_task()` devolvendo null, toda etapa da agencia viraria
-- entregavel de uma campanha qualquer.
-- ---------------------------------------------------------------------------
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('c0800000-0000-0000-0000-0000000000ff', :VERDE, 'Demanda sem campanha',
        :DIEGO, current_date, 'https://drive.google.com/sem-campanha');

select teste.cenario('Uma etapa de demanda comum', :MARINA,
  $$insert into public.subtasks (task_id, titulo, ordem)
    values ('c0800000-0000-0000-0000-0000000000ff', 'Etapa solta', 0)$$,
  'ok', 1);

select teste.conferir('Ela nao virou peca de campanha nenhuma',
  (select count(*)::text from public.deliverables d where d.nome = 'Etapa solta'),
  '0');
