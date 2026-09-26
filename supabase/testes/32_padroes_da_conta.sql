\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set RAFAEL  '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

-- O workflow GLOBAL "Post de feed", semeado pela 0008 com quatro etapas que
-- apontam para FUNCAO e para pessoa nenhuma:
--   Pauta (Social Media) -> Conteudo (Redator) -> Arte (Design) -> Agendamento (Social Media)
--
-- PELO NOME, E NAO PELO ID. `rodar.sh` apaga e recria o banco a cada rodada, e
-- o id sai de `gen_random_uuid()` -- um uuid colado aqui casa na primeira
-- rodada e devolve zero linhas na segunda, com toda afirmacao deste arquivo
-- passando a medir uma lista vazia. Foi o que aconteceu na primeira versao.
\set FEED    '(select workflow_template_id from public.task_types where nome = ''Post de feed'' and client_id is null)'

-- ===========================================================================
-- 0064 -- Os padroes da conta, e a etapa que aponta para uma FUNCAO
--
-- O que este arquivo persegue:
--
--   1. A ORDEM DO `coalesce`. Pessoa explicita na etapa vence a funcao da
--      conta, e o cenario 4 e o UNICO que falha se os lados trocarem -- a
--      mesma forma da 0041, onde inverter transformaria o campo numa arma.
--   2. O MESMO workflow global resolvendo pessoas DIFERENTES em duas contas.
--      E o criterio que justifica a tabela existir: sem ele, "Post de feed"
--      teria que ser duplicado por cliente so porque o redator muda.
--   3. A ausencia NOMEADA. Sem ninguem na funcao a etapa nasce sem dono --
--      nao e recusada --, e a funcao que faltou volta na coluna, para a tela
--      poder dizer QUAL falta em vez de "alguma".
--   4. Quem escreve. `is_gestor() or is_atendimento()`, a mesma pergunta que
--      `tasks_insert` faz desde a 0006 -- e o colaborador que NAO e do
--      Atendimento nao escreve nada disso.
--   5. Que o cliente nao alcanca as duas tabelas.
-- ===========================================================================

select teste.limpar();
delete from public.client_function_defaults;
delete from public.client_flow_defaults;

-- A base do arquivo, gravada como dono da tabela: ela nao afirma nada, e por
-- isso nao e cenario. O que os cenarios medem e a RESOLUCAO e a RLS -- e em
-- 15_posts_e_comentarios.sql uma linha de montagem como esta chegou a esconder
-- o bug da 0062 por garantir, sem querer, a unica condicao em que ele nao
-- acontece. Aqui a montagem e de OUTRA conta que nao a do cenario 4, que e o
-- que mede a ordem: o que ela deixa pronto nenhum cenario precisa que exista.
insert into public.client_function_defaults (client_id, funcao, user_id) values
  (:VERDE,  'Social Media', :MARINA),
  (:VERDE,  'Redator',      :BRUNO),
  (:VERDE,  'Design',       :CARLA),
  (:OPTICA, 'Redator',      :RAFAEL);


-- ---------------------------------------------------------------------------
-- 1. A FUNCAO DA CONTA VIRA O RESPONSAVEL
--
-- O workflow nao nomeia ninguem: as quatro etapas tem `funcao_padrao` e
-- `responsavel_padrao_id` nulo. Antes da 0064 as quatro nasciam ORFAS, e etapa
-- sem dono nao aparece no "Minhas Tasks" de ninguem -- o pior tipo de trabalho
-- gerado, o que ninguem sabe que nasceu.
-- ---------------------------------------------------------------------------
select teste.conferir(
  'A Pauta da Mundo Verde resolve para o Social Media da conta',
  (select responsavel_id::text from public.etapas_resolvidas_do_workflow(:FEED, :VERDE)
    where nome = 'Pauta'),
  '55555555-5555-5555-5555-555555555555');

select teste.conferir(
  'O Conteudo da Mundo Verde resolve para o Redator da conta',
  (select responsavel_id::text from public.etapas_resolvidas_do_workflow(:FEED, :VERDE)
    where nome = 'Conteúdo'),
  '44444444-4444-4444-4444-444444444444');

select teste.conferir(
  'Nenhuma das quatro etapas da Mundo Verde fica sem dono',
  (select count(*)::text from public.etapas_resolvidas_do_workflow(:FEED, :VERDE)
    where responsavel_id is null),
  '0');


-- ---------------------------------------------------------------------------
-- 2. O MESMO WORKFLOW, OUTRA CONTA, OUTRA PESSOA
--
-- E o criterio que faz a tabela valer a pena. Se esta linha falhar, o produto
-- voltou a precisar de um workflow por cliente.
-- ---------------------------------------------------------------------------
select teste.conferir(
  'O mesmo workflow global resolve OUTRO redator na Optica',
  (select responsavel_id::text from public.etapas_resolvidas_do_workflow(:FEED, :OPTICA)
    where nome = 'Conteúdo'),
  '66666666-6666-6666-6666-666666666666');

select teste.conferir(
  'E as duas contas nao resolvem a mesma pessoa para a mesma etapa',
  (select case
            when (select responsavel_id from public.etapas_resolvidas_do_workflow(:FEED, :VERDE)
                   where nome = 'Conteúdo')
                 is distinct from
                 (select responsavel_id from public.etapas_resolvidas_do_workflow(:FEED, :OPTICA)
                   where nome = 'Conteúdo')
            then 'diferentes' else 'iguais' end),
  'diferentes');


-- ---------------------------------------------------------------------------
-- 3. A FUNCAO SEM NINGUEM: nulo, e a funcao nomeada
--
-- A Optica so tem Redator cadastrado. As outras tres etapas ficam sem dono, e
-- a resolucao DIZ QUAL funcao faltou -- "alguma etapa ficou sem dono" mandaria
-- a pessoa abrir a configuracao para procurar qual das cinco. E a mesma
-- diferenca entre uma recusa e uma instrucao que a 0023 paga ao nomear cada
-- etapa sem aprovacao.
-- ---------------------------------------------------------------------------
select teste.conferir(
  'Na Optica, tres das quatro etapas ficam sem dono',
  (select count(*)::text from public.etapas_resolvidas_do_workflow(:FEED, :OPTICA)
    where responsavel_id is null),
  '3');

select teste.conferir(
  'E a resolucao nomeia as funcoes que faltaram',
  (select string_agg(distinct funcao_sem_dono::text, ', ' order by funcao_sem_dono::text)
     from public.etapas_resolvidas_do_workflow(:FEED, :OPTICA)
    where funcao_sem_dono is not null),
  'Design, Social Media');

select teste.conferir(
  'A etapa que TEM dono nao aparece como funcao sem dono',
  (select coalesce(funcao_sem_dono::text, 'nulo')
     from public.etapas_resolvidas_do_workflow(:FEED, :OPTICA)
    where nome = 'Conteúdo'),
  'nulo');


-- ---------------------------------------------------------------------------
-- 4. PESSOA EXPLICITA VENCE A FUNCAO DA CONTA
--
-- ESTE E O CENARIO QUE MEDE A ORDEM, e o unico que falha se alguem trocar os
-- dois primeiros ramos do `coalesce`.
--
-- Monta-se um workflow proprio, com UMA etapa que tem as duas coisas: a funcao
-- Redator (que na Mundo Verde e o Bruno) e a pessoa Diego escrita na etapa.
-- Quem escreveu o nome na etapa mandou. Invertido, encher a tabela de funcoes
-- da conta apagaria a distribuicao que alguem montou etapa por etapa -- que e
-- exatamente a armadilha que a 0041 descreve.
-- ---------------------------------------------------------------------------
insert into public.workflow_templates (id, nome)
values ('ffffffff-0064-0000-0000-000000000001', 'Fluxo com pessoa escrita na etapa')
on conflict (id) do nothing;

insert into public.workflow_steps
  (id, template_id, nome, ordem, funcao_padrao, responsavel_padrao_id)
values
  ('ffffffff-0064-0000-0000-000000000011', 'ffffffff-0064-0000-0000-000000000001',
   'Texto com dono escrito', 10, 'Redator', :DIEGO)
on conflict (id) do nothing;

select teste.conferir(
  'A pessoa escrita na etapa vence a funcao da conta',
  (select responsavel_id::text
     from public.etapas_resolvidas_do_workflow('ffffffff-0064-0000-0000-000000000001', :VERDE)),
  '22222222-2222-2222-2222-222222222222');

-- E A METADE DE CIMA DO MESMO CENARIO: na conta que NAO tem Redator, a mesma
-- etapa resolve a mesma pessoa. Sem esta linha, a de cima passaria numa
-- resolucao que ignorasse a tabela de funcoes por completo.
select teste.conferir(
  'E ela vence tambem onde a conta nao tem ninguem naquela funcao',
  (select responsavel_id::text
     from public.etapas_resolvidas_do_workflow('ffffffff-0064-0000-0000-000000000001',
                                               '50700000-0000-0000-0000-0000000000c1')),
  '22222222-2222-2222-2222-222222222222');


-- ---------------------------------------------------------------------------
-- 5. PESSOA DESLIGADA NAO VIRA RESPONSAVEL
--
-- A pergunta e a mesma que a 0041 faz. Sem ela, quem sai da agencia continua
-- herdando etapa de toda demanda daquela conta -- e a etapa nasce no Minhas
-- Tasks de alguem que ninguem abre mais.
--
-- E a funcao volta como SEM DONO: a conta tem a linha, mas nao tem quem a
-- exerca. Dizer que esta resolvida seria pior que dizer que falta.
-- ---------------------------------------------------------------------------
-- `pessoa_desligada()` le `profiles.ativo`, e nao `team_members`: e a ficha de
-- acesso que diz se a pessoa ainda esta na agencia. Desligar pelo lado errado
-- deixaria o cenario verde sem provar nada.
update public.profiles set ativo = false where id = :BRUNO;

select teste.conferir(
  'Desligado nao vira responsavel pela funcao da conta',
  (select coalesce(responsavel_id::text, 'nulo')
     from public.etapas_resolvidas_do_workflow(:FEED, :VERDE)
    where nome = 'Conteúdo'),
  'nulo');

select teste.conferir(
  'E a funcao dele conta como sem dono',
  (select coalesce(funcao_sem_dono::text, 'nulo')
     from public.etapas_resolvidas_do_workflow(:FEED, :VERDE)
    where nome = 'Conteúdo'),
  'Redator');

update public.profiles set ativo = true where id = :BRUNO;


-- ---------------------------------------------------------------------------
-- 6. QUEM ESCREVE: `is_gestor() or is_atendimento()`
--
-- A mesma pergunta que `tasks_insert` faz desde a 0006, e nao uma parecida.
-- Distribuir o trabalho de uma conta e abrir a demanda dela sao a mesma
-- decisao -- e o Bruno, que e Design, nao participa dela.
-- ---------------------------------------------------------------------------
select teste.cenario('Socio define o aprovador interno da conta', :ANA,
  format($fmt$insert into public.client_flow_defaults (client_id, aprovador_interno_id)
          values (%L, %L)
          on conflict (client_id) do update set aprovador_interno_id = excluded.aprovador_interno_id$fmt$,
    :VERDE, :DIEGO),
  'ok');

select teste.cenario('Desenvolvedor tambem define', :DIEGO,
  format($fmt$update public.client_flow_defaults
             set prazo_aprovacao_cliente_dias = 5 where client_id = %L$fmt$, :VERDE),
  'ok', 1);

select teste.cenario('Colaborador DO ATENDIMENTO define a equipe por funcao', :MARINA,
  format($fmt$insert into public.client_function_defaults (client_id, funcao, user_id)
          values (%L, 'Audiovisual', %L)$fmt$, :VERDE, :RAFAEL),
  'ok');

select teste.cenario('Colaborador que NAO e do Atendimento nao define nada', :BRUNO,
  format($fmt$insert into public.client_function_defaults (client_id, funcao, user_id)
          values (%L, 'Trafego', %L)$fmt$, :VERDE, :BRUNO),
  'recusa');

select teste.cenario('E nao muda o prazo de aprovacao da conta', :BRUNO,
  format($fmt$update public.client_flow_defaults
             set prazo_aprovacao_cliente_dias = 60 where client_id = %L$fmt$, :VERDE),
  'recusa');

-- MAS ELE LE, e a metade positiva importa: quem produz precisa saber quem
-- aprova nesta conta, e a tela de abertura da demanda le estes padroes para
-- qualquer perfil interno. Esconder deles seria esconder o trabalho deles.
select teste.cenario('Colaborador LE os padroes da conta', :BRUNO,
  format($fmt$select 1 from public.client_flow_defaults where client_id = %L$fmt$, :VERDE),
  'ok', 1);

select teste.cenario('E le a equipe por funcao', :BRUNO,
  format($fmt$select 1 from public.client_function_defaults where client_id = %L and funcao = 'Redator'$fmt$,
    :VERDE),
  'ok', 1);


-- ---------------------------------------------------------------------------
-- 7. O CLIENTE NAO ALCANCA NENHUMA DAS DUAS
--
-- E a razao pela qual as tres colunas novas nao foram para `clients`: o
-- cliente ESCREVE naquela tabela -- `clients_update_proprio` deixa a linha
-- inteira passar de proposito, e quem separa e o trigger, que ja esqueceu o
-- `slug` uma vez (0009 -> 0031). Aqui nao existe policy para o perfil dele:
-- nao existe coluna para alguem esquecer.
-- ---------------------------------------------------------------------------
select teste.cenario('Cliente nao le os padroes da propria conta', :JOANA,
  format($fmt$select 1 from public.client_flow_defaults where client_id = %L$fmt$, :VERDE),
  'recusa');

select teste.cenario('Cliente nao le a equipe por funcao', :JOANA,
  format($fmt$select 1 from public.client_function_defaults where client_id = %L$fmt$, :VERDE),
  'recusa');

select teste.cenario('Cliente nao escreve o prazo de aprovacao dele mesmo', :JOANA,
  format($fmt$update public.client_flow_defaults
             set prazo_aprovacao_cliente_dias = 90 where client_id = %L$fmt$, :VERDE),
  'recusa');


-- ---------------------------------------------------------------------------
-- 8. OS CHECKS
--
-- A pasta com `http` pela mesma razao da 0014: sem esta recusa, "ver com a
-- Ana" digitado aqui viaja para o `link_entrega` de toda demanda daquele
-- cliente, e a recusa sai na tela da task, com uma mensagem sobre http que
-- ninguem ligaria a esta configuracao.
-- ---------------------------------------------------------------------------
select teste.recusa_com('Pasta de entrega que nao e endereco e recusada', :ANA,
  format($fmt$update public.client_flow_defaults
             set pasta_entrega_url = 'ver com a Ana' where client_id = %L$fmt$, :VERDE),
  'client_flow_defaults_pasta_http');

select teste.cenario('Pasta com https passa', :ANA,
  format($fmt$update public.client_flow_defaults
             set pasta_entrega_url = 'https://drive.google.com/drive/folders/X'
           where client_id = %L$fmt$, :VERDE),
  'ok', 1);

select teste.recusa_com('Prazo zero e recusado', :ANA,
  format($fmt$update public.client_flow_defaults
             set prazo_aprovacao_cliente_dias = 0 where client_id = %L$fmt$, :VERDE),
  'client_flow_defaults_prazo_razoavel');

select teste.recusa_com('Prazo de 400 dias e recusado', :ANA,
  format($fmt$update public.client_flow_defaults
             set prazo_aprovacao_cliente_dias = 400 where client_id = %L$fmt$, :VERDE),
  'client_flow_defaults_prazo_razoavel');


-- ---------------------------------------------------------------------------
-- 9. UMA LINHA POR CLIENTE, UMA PESSOA POR FUNCAO
--
-- Sem o `unique (client_id, funcao)` a pergunta "quem e o Redator da Mundo
-- Verde?" teria duas respostas, e a tela escolheria pela ordem de insercao --
-- que muda quando alguem reescreve a consulta.
-- ---------------------------------------------------------------------------
select teste.cenario('Segunda linha de padroes para o mesmo cliente e recusada', :ANA,
  format($fmt$insert into public.client_flow_defaults (client_id) values (%L)$fmt$, :VERDE),
  'recusa');

select teste.cenario('Duas pessoas na mesma funcao da mesma conta e recusado', :ANA,
  format($fmt$insert into public.client_function_defaults (client_id, funcao, user_id)
          values (%L, 'Redator', %L)$fmt$, :VERDE, :RAFAEL),
  'recusa');

-- A MESMA FUNCAO EM DUAS CONTAS PASSA, e e o desenho: a Optica ja tem Redator,
-- e a Mundo Verde tambem. Sem este cenario, um `unique (funcao)` mal escrito
-- passaria pelo de cima e quebraria o produto inteiro.
select teste.cenario('A mesma funcao em outra conta passa', :ANA,
  format($fmt$insert into public.client_function_defaults (client_id, funcao, user_id)
          values (%L, 'Design', %L)$fmt$, :OPTICA, :CARLA),
  'ok');


-- ---------------------------------------------------------------------------
-- 10. A TROCA ENTRA NA TRILHA DE AUDITORIA (0058)
--
-- Distribuir o trabalho de uma conta e decisao sobre gente, e a trilha guarda
-- "acesso, gente, dinheiro e decisao". Sem isto, trocar o redator de uma conta
-- seria a unica mudanca de responsabilidade do produto que nao deixa rastro.
-- ---------------------------------------------------------------------------
delete from public.audit_log;

select teste.cenario('Trocar o aprovador interno da conta', :ANA,
  format($fmt$update public.client_flow_defaults
             set aprovador_interno_id = %L where client_id = %L$fmt$, :ANA, :VERDE),
  'ok', 1);

select teste.conferir(
  'A troca do aprovador virou linha na trilha de auditoria',
  (select count(*)::text from public.audit_log
    where tabela = 'client_flow_defaults' and operacao = 'UPDATE'),
  '1');

select teste.conferir(
  'E a trilha guarda a coluna que mudou, nao a linha inteira',
  (select case when depois ? 'aprovador_interno_id' and not (depois ? 'client_id')
               then 'so a que mudou' else 'a linha inteira' end
     from public.audit_log
    where tabela = 'client_flow_defaults' and operacao = 'UPDATE' limit 1),
  'so a que mudou');
