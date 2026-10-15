-- ===========================================================================
-- 46 - A ETAPA DO WORKFLOW TEM SUB-ETAPA (migration 0108)
--
-- Decisao do usuario: *"quando crio um workflow, ele nao esta permitindo que
-- eu aplique ela na campanha. E tambem preciso poder colocar uma subtarefa, na
-- etapa do workflow, para ele ja aparecer montado completo"*.
--
-- OS DOIS CENARIOS QUE JUSTIFICAM O ARQUIVO sao as travas 4 e 5, e a razao
-- esta um nivel abaixo: `subtasks_agrupadora` (0022) RECUSA -- nao descarta --
-- a filha de uma etapa que exige aprovacao, e a filha de uma etapa que espera
-- outra. Sem as duas travas no MODELO, um workflow assim e gravado sem erro e
-- a recusa chega no dia em que alguem o aplica, com a demanda ja criada, as
-- etapas antigas ja apagadas, e uma mensagem falando de subtarefa sobre um
-- workflow montado semanas antes. Elas vem acompanhadas do cenario que prova
-- que a recusa da 0022 CONTINUA DE PE -- sem ele, as duas travas pareceriam
-- zelo em vez de o que elas sao.
-- ===========================================================================

\set ANA    '''11111111-1111-1111-1111-111111111111'''
\set DIEGO  '''22222222-2222-2222-2222-222222222222'''
\set BRUNO  '''44444444-4444-4444-4444-444444444444'''
\set MARINA '''55555555-5555-5555-5555-555555555555'''

\set VERDE  '''aaaaaaaa-0000-0000-0000-000000000001'''

\set WARV   '''e1080000-0000-4000-8000-000000000001'''
\set WLACO  '''e1080000-0000-4000-8000-000000000002'''
\set WRUIM  '''e1080000-0000-4000-8000-000000000003'''

select teste.limpar();


-- ---------------------------------------------------------------------------
-- 1. O WORKFLOW DE DOIS NIVEIS E ACEITO
--
-- A cadeia inteira num `insert` so, que e como `regravarEtapas()` grava: um
-- `delete` do modelo e um `insert` de todas as etapas. Com gatilho `for each
-- row` este cenario falharia -- o filho entraria antes de o pai existir para a
-- linha dele.
-- ---------------------------------------------------------------------------
insert into public.workflow_templates (id, nome)
values (:WARV, 'Campanha com enxoval')
on conflict (id) do nothing;

insert into public.workflow_steps
  (template_id, nome, ordem, parent_ordem, funcao_padrao, prazo_offset_dias)
values
  (:WARV, 'KV',                  10, null, 'Design',  3),
  (:WARV, 'Enxoval',             20, null, 'Design',  10),
  (:WARV, 'Lamina A5',           21,   20, 'Design',  8),
  (:WARV, 'Banner A5',           22,   20, 'Design',  9),
  (:WARV, 'Tabloide',            30, null, 'Design',  12);

select teste.conferir('O workflow de dois niveis e aceito',
  (select count(*)::text from public.workflow_steps where template_id = :WARV),
  '5');

select teste.conferir('As duas sub-etapas apontam para a etapa de cima',
  (select count(*)::text from public.workflow_steps
    where template_id = :WARV and parent_ordem = 20),
  '2');


-- ---------------------------------------------------------------------------
-- 2. A RESOLUCAO PELA CONTA CARREGA O PAI
--
-- `etapas_resolvidas_do_workflow()` foi recriada com uma coluna a mais, e o
-- `drop function` antes do `create` e obrigatorio -- `create or replace` nao
-- troca o tipo de retorno de uma funcao `returns table`, que e a pegadinha da
-- 0088. Sem esta coluna a tela resolveria o responsavel pela conta e PERDERIA
-- a arvore: as cinco etapas nasceriam soltas, e o pedido do usuario -- "ja
-- aparecer montado completo" -- morreria exatamente no caminho que resolve o
-- dono de cada uma.
-- ---------------------------------------------------------------------------
select teste.conferir_como('A resolucao pela conta devolve o pai de cada etapa', :ANA,
  format($fmt$
    select coalesce(parent_ordem::text, 'topo')
      from public.etapas_resolvidas_do_workflow(%L, %L)
     where nome = 'Lamina A5'
  $fmt$, :WARV, :VERDE),
  '20');

select teste.conferir_como('E a etapa de topo volta sem pai', :ANA,
  format($fmt$
    select coalesce(parent_ordem::text, 'topo')
      from public.etapas_resolvidas_do_workflow(%L, %L)
     where nome = 'KV'
  $fmt$, :WARV, :VERDE),
  'topo');


-- ---------------------------------------------------------------------------
-- 3. AS CINCO RECUSAS
--
-- Cada uma NOMEIA a etapa, que e a decisao da 0023: "ha etapa errada neste
-- workflow" manda a pessoa conferir uma por uma; dizer qual e a diferenca
-- entre uma recusa e uma instrucao.
-- ---------------------------------------------------------------------------
select teste.recusa_com('A etapa nao e sub-etapa dela mesma', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem, parent_ordem)
    values (%L, 'Etapa torta', 40, 40)
  $fmt$, :WARV),
  'não pode ser sub-etapa dela mesma');

select teste.recusa_com('A etapa de cima tem de estar no mesmo workflow', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem, parent_ordem)
    values (%L, 'Filha orfa', 41, 999)
  $fmt$, :WARV),
  'não está neste workflow');

select teste.recusa_com('Sub-etapa nao recebe sub-etapa', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem, parent_ordem)
    values (%L, 'Neta', 42, 21)
  $fmt$, :WARV),
  'sub-etapa não recebe sub-etapa');

-- A dica da trava de tres niveis diz o que fazer no lugar, e `recusa_com` le
-- so a mensagem: uma trava com a dica apagada passaria por ele. E a decisao do
-- `teste.recusa_com_dica` da trava de `cancelada`.
select teste.recusa_com_dica('E a recusa de tres niveis diz onde por a etapa', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem, parent_ordem)
    values (%L, 'Neta', 43, 22)
  $fmt$, :WARV),
  'São dois níveis no workflow');

select teste.recusa_com('Etapa com sub-etapa nao exige aprovacao', :ANA,
  format($fmt$
    update public.workflow_steps set requer_aprovacao = true, tipo_aprovacao = 'interna'
     where template_id = %L and ordem = 20
  $fmt$, :WARV),
  'não pode exigir aprovação');

select teste.recusa_com('Etapa com sub-etapa nao espera outra etapa', :ANA,
  format($fmt$
    update public.workflow_steps set depende_de_ordem = 10
     where template_id = %L and ordem = 20
  $fmt$, :WARV),
  'não pode esperar outra etapa');

-- E O OUTRO SENTIDO DAS DUAS: na etapa de TOPO, sem filho, as duas coisas
-- passam. Sem este cenario, uma trava que recusasse `requer_aprovacao` em
-- qualquer etapa passaria pelos dois de cima -- e o workflow do produto, onde
-- quase toda etapa de entrega pede aval, pararia de poder ser gravado.
select teste.cenario('A etapa SEM sub-etapa exige aprovacao normalmente', :ANA,
  format($fmt$
    update public.workflow_steps set requer_aprovacao = true, tipo_aprovacao = 'interna'
     where template_id = %L and ordem = 30
  $fmt$, :WARV),
  'ok');

select teste.cenario('E a etapa SEM sub-etapa espera outra normalmente', :ANA,
  format($fmt$
    update public.workflow_steps set depende_de_ordem = 10
     where template_id = %L and ordem = 30
  $fmt$, :WARV),
  'ok');


-- ---------------------------------------------------------------------------
-- 4. O LACO FUNCIONA, DESDE QUE O PAI VENHA PRIMEIRO
--
-- Aqui a trava por instrucao nao cobra o que a da 0087 cobrava. La a pergunta
-- e "existe exatamente UMA entrega", e a primeira etapa de um fluxo novo nao a
-- satisfaz sozinha -- entao gravar num laco era recusado, e a consequencia era
-- "um fluxo e gravado de uma vez". As travas daqui sao da forma "SE existe
-- filho, entao...", e cada instrucao de um laco em ordem passa.
--
-- OS DOIS SENTIDOS, e o segundo e o que mede: invertida a ordem, o filho
-- sozinho leva a recusa de que o pai nao esta no modelo. Sem ele, este cenario
-- diria "o laco funciona" sem separar a ordem certa da errada.
-- ---------------------------------------------------------------------------
insert into public.workflow_templates (id, nome)
values (:WLACO, 'Gravado etapa por etapa')
on conflict (id) do nothing;

select teste.cenario('O pai entra sozinho numa instrucao', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem) values (%L, 'Arte', 10)
  $fmt$, :WLACO),
  'ok');

select teste.cenario('E o filho entra na instrucao seguinte', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem, parent_ordem)
    values (%L, 'Conceito', 11, 10)
  $fmt$, :WLACO),
  'ok');

select teste.recusa_com('Invertido, o filho sozinho e recusado', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem, parent_ordem)
    values (%L, 'KV sem pai', 20, 19)
  $fmt$, :WLACO),
  'não está neste workflow');


-- ---------------------------------------------------------------------------
-- 5. APAGAR O PAI A MAO NAO DEIXA FILHO ORFAO
--
-- `regravarEtapas()` apaga o modelo INTEIRO e reinsere, e um modelo sem etapa
-- nenhuma e valido -- entao a conferencia do delete passa sozinha naquele
-- caminho. O que ela fecha e o `delete` parcial, montado a mao: sem ela o
-- filho ficaria apontando para uma posicao que nao existe mais, e a aplicacao
-- do workflow levaria a recusa de `subtasks_agrupadora` sobre uma etapa de
-- cima que ninguem consegue achar na tela.
-- ---------------------------------------------------------------------------
select teste.recusa_com('Apagar so a etapa de cima e recusado', :ANA,
  format($fmt$
    delete from public.workflow_steps where template_id = %L and ordem = 10
  $fmt$, :WLACO),
  'não está neste workflow');

select teste.cenario('Apagar o modelo inteiro passa', :ANA,
  format($fmt$
    delete from public.workflow_steps where template_id = %L
  $fmt$, :WLACO),
  'ok');


-- ---------------------------------------------------------------------------
-- 6. A RECUSA DA 0022 CONTINUA DE PE, e e ela que justifica as travas 4 e 5
--
-- ESTE E O CENARIO VIRADO DO AVESSO: se alguem tirar a trava 4 do modelo
-- achando que ela e zelo, e este que diz o que acontece no lugar dela -- a
-- recusa chega na materializacao, falando de subtarefa, para quem clicou em
-- aplicar um workflow.
-- ---------------------------------------------------------------------------
insert into public.tasks (id, client_id, titulo, criado_por, link_entrega)
values ('e1080000-0000-4000-8000-0000000000a1', :VERDE, 'Demanda para medir a 0022',
        :ANA, 'https://drive.google.com/pasta-0108')
on conflict (id) do nothing;

insert into public.subtasks (id, task_id, titulo, ordem, requer_aprovacao, tipo_aprovacao)
values ('e1080000-0000-4000-8000-0000000000b1', 'e1080000-0000-4000-8000-0000000000a1',
        'Etapa que pede aval', 1, true, 'interna')
on conflict (id) do nothing;

select teste.recusa_com('A 0022 recusa sub-etapa de etapa que pede aval', :ANA,
  $fmt$
    insert into public.subtasks (task_id, parent_id, titulo, ordem)
    values ('e1080000-0000-4000-8000-0000000000a1',
            'e1080000-0000-4000-8000-0000000000b1', 'Filha', 1)
  $fmt$,
  'não pode virar agrupadora');
