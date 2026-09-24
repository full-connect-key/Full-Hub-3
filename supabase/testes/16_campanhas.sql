\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

\set CAMP    '''c1130000-0000-0000-0000-000000000001'''
\set OUTRA   '''c1130000-0000-0000-0000-000000000002'''
\set KV      '''d1130000-0000-0000-0000-000000000001'''
\set ENXOVAL '''d1130000-0000-0000-0000-000000000002'''
\set LAMINA  '''d1130000-0000-0000-0000-000000000003'''
\set PRECIF  '''d1130000-0000-0000-0000-000000000004'''
\set BANNER  '''d1130000-0000-0000-0000-000000000005'''
\set TABLOID '''d1130000-0000-0000-0000-000000000006'''

-- ===========================================================================
-- Sprint 13 -- Campanhas e entregaveis
--
-- Tres perguntas:
--
--   1. O cliente alcanca exatamente o que foi ENVIADO, e nada alem -- a mesma
--      pergunta do post, com uma diferenca: a CAMPANHA ele ve desde o
--      planejamento, e o entregavel nao.
--
--   2. Decidir um sub-item mexe SO nele. E o criterio de aceite que mais teria
--      como passar batido numa tela: aprovar um item do Enxoval e olhar o
--      contador subir nao prova que os catorze irmaos ficaram parados.
--
--   3. O status do grupo e calculado, e ninguem consegue escrever nele.
-- ===========================================================================

select teste.limpar();
delete from public.comments;
delete from public.deliverables;
delete from public.campaigns;


-- ---------------------------------------------------------------------------
-- A MONTAGEM
--
-- Uma Wave enxuta: KV solto, um grupo Enxoval com tres itens e um Tabloide.
-- Tres itens bastam para provar o que quinze provariam, e a bateria que lê
-- rapido e a que alguem roda.
-- ---------------------------------------------------------------------------
update public.clients set responsavel_atendimento_id = :MARINA where id = :VERDE;

insert into public.campaigns (id, client_id, nome, descricao, data_inicio, data_fim, criado_por, status)
values (:CAMP, :VERDE, 'Wave Outubro Rosa', 'A campanha do mes.',
        current_date - 3, current_date + 5, :DIEGO, 'ativa'),
       (:OUTRA, :OPTICA, 'Wave da Optica', null,
        current_date, current_date + 20, :DIEGO, 'ativa');

insert into public.deliverables (id, campaign_id, parent_id, nome, ordem, responsavel_id) values
  (:KV,      :CAMP, null,     'KV',        1, :BRUNO),
  (:ENXOVAL, :CAMP, null,     'Enxoval',   2, null),
  (:LAMINA,  :CAMP, :ENXOVAL, 'Lâmina A5', 1, :BRUNO),
  (:PRECIF,  :CAMP, :ENXOVAL, 'Precificador', 2, :BRUNO),
  (:BANNER,  :CAMP, :ENXOVAL, 'Banner A5', 3, :BRUNO),
  (:TABLOID, :CAMP, null,     'Tabloide',  3, :BRUNO);

select teste.conferir('Entregavel nasce aguardando informacoes',
  (select status::text from public.deliverables where id = :KV), 'aguardando_informacoes');

select teste.conferir('E nasce sem carimbo de envio',
  (select (enviado_em is null)::text from public.deliverables where id = :KV), 'true');


-- ---------------------------------------------------------------------------
-- 1. DOIS NIVEIS, E NUNCA TRES
--
-- Mesma razao da sub-etapa: arvore de tres niveis na tela do cliente e arvore
-- que ninguem acompanha, e o recuo deixa de significar alguma coisa.
-- ---------------------------------------------------------------------------
select teste.recusa_com('Neto e recusado, e a recusa diz o que fazer', :DIEGO,
  format($fmt$insert into public.deliverables (campaign_id, parent_id, nome, ordem)
    values (%L, %L, 'Neto', 1)$fmt$, :CAMP, :LAMINA),
  'dois níveis');


-- ---------------------------------------------------------------------------
-- 2. A CAMPANHA O CLIENTE VE; O ENTREGAVEL EM PRODUCAO, NAO
--
-- As duas coisas na mesma secao de proposito: a diferenca entre elas e uma
-- decisao de produto, e um cenario ao lado do outro e o que a deixa visivel
-- para quem for mexer.
-- ---------------------------------------------------------------------------
select teste.cenario('Joana ve a campanha, mesmo sem nada enviado', :JOANA,
  format('select 1 from public.campaigns where id = %L', :CAMP), 'ok', 1);

select teste.cenario('Otto nao ve a campanha da outra empresa', :OTTO,
  format('select 1 from public.campaigns where id = %L', :CAMP), 'recusa');

select teste.cenario('Joana nao ve entregavel nenhum ainda', :JOANA,
  'select 1 from public.deliverables', 'recusa');

select teste.cenario('Nem pelo id na mao', :JOANA,
  format('select 1 from public.deliverables where id = %L', :KV), 'recusa');

select teste.cenario('A equipe ve os seis', :DIEGO,
  format('select 1 from public.deliverables where campaign_id = %L', :CAMP), 'ok', 6);


-- ---------------------------------------------------------------------------
-- 3. O CLIENTE NAO EDITA ESTRUTURA, PRAZO NEM ARQUIVO
-- ---------------------------------------------------------------------------
select teste.cenario('Joana nao cria entregavel', :JOANA,
  format($fmt$insert into public.deliverables (campaign_id, nome, ordem)
    values (%L, 'Item que eu quero', 9)$fmt$, :CAMP),
  'recusa');

select teste.cenario('Joana nao muda o prazo de um entregavel', :JOANA,
  format($fmt$update public.deliverables set prazo = current_date where id = %L$fmt$, :KV),
  'recusa');

select teste.cenario('Joana nao apaga entregavel', :JOANA,
  format($fmt$delete from public.deliverables where id = %L$fmt$, :KV), 'recusa');

select teste.cenario('Joana nao mexe na campanha', :JOANA,
  format($fmt$update public.campaigns set nome = 'Outro nome' where id = %L$fmt$, :CAMP),
  'recusa');

-- O TEMPLATE E PROCESSO INTERNO. Ele e a lista do que a agencia entrega numa
-- Wave; para o cliente e uma estrutura vazia de coisas que talvez nem entrem.
select teste.cenario('Joana nao le os templates da casa', :JOANA,
  'select 1 from public.campaign_templates', 'recusa');

select teste.cenario('A equipe le', :DIEGO,
  $fmt$select 1 from public.campaign_templates where nome = 'Wave Outubro Rosa'$fmt$, 'ok', 1);


-- ---------------------------------------------------------------------------
-- 4. GRUPO NAO VAI PARA APROVACAO
--
-- Mesma regra da etapa agrupadora: o status dele e calculado, entao uma rodada
-- dele prometeria uma decisao que o calculo desfaz no instante seguinte.
-- ---------------------------------------------------------------------------
select teste.recusa_com('Grupo nao abre rodada, e a recusa diz quem abre', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('deliverable', %L, 1, 'interna', %L)$fmt$, :ENXOVAL, :BRUNO),
  'quem vai para aprovação são os itens de dentro');


-- ---------------------------------------------------------------------------
-- 5. O CAMINHO DE UM SUB-ITEM ATE O CLIENTE
-- ---------------------------------------------------------------------------
select teste.cenario('Bruno manda a Lamina para aprovacao interna', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('deliverable', %L, 1, 'interna', %L)$fmt$, :LAMINA, :BRUNO),
  'ok', 1);

select teste.cenario('Bruno nao aprova a propria rodada interna', :BRUNO,
  format($fmt$update public.approval_rounds set status = 'aprovada'
     where content_type = 'deliverable' and content_id = %L and escopo = 'interna'$fmt$, :LAMINA),
  'recusa');

select teste.cenario('Diego aprova', :DIEGO,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L, decidido_em = now()
     where content_type = 'deliverable' and content_id = %L and escopo = 'interna'$fmt$, :DIEGO, :LAMINA),
  'ok', 1);

select teste.recusa_com('Bruno nao envia ao cliente a propria entrega', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('deliverable', %L, 1, 'cliente', %L)$fmt$, :LAMINA, :BRUNO),
  'Enviar para o cliente é do Desenvolvedor');

select teste.cenario('Diego envia', :DIEGO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('deliverable', %L, 1, 'cliente', %L)$fmt$, :LAMINA, :DIEGO),
  'ok', 1);

select teste.conferir('Enviar carimbou o entregavel',
  (select (enviado_em is not null)::text from public.deliverables where id = :LAMINA), 'true');

select teste.conferir('E o status virou em aprovacao',
  (select status::text from public.deliverables where id = :LAMINA), 'em_aprovacao');

select teste.cenario('Agora Joana ve a Lamina', :JOANA,
  format('select 1 from public.deliverables where id = %L', :LAMINA), 'ok', 1);

select teste.cenario('E continua sem ver os irmaos, que nao foram enviados', :JOANA,
  format('select 1 from public.deliverables where id in (%L, %L)', :PRECIF, :BANNER), 'recusa');

-- O GRUPO E UM DOS QUE ELA NAO VE, e e consequencia e nao descuido: ele
-- tambem tem `enviado_em` nulo. A arvore da tela monta o pai a partir dos
-- filhos que voltaram -- e essa e a razao de a consulta de campanhas ler os
-- entregaveis e nao um `parent_id in (...)`.
select teste.cenario('Nem o grupo, que nunca e enviado', :JOANA,
  format('select 1 from public.deliverables where id = %L', :ENXOVAL), 'recusa');


-- ---------------------------------------------------------------------------
-- 6. DECIDIR UM SUB-ITEM MEXE SO NELE
--
-- O criterio de aceite que mais teria como passar batido numa tela.
-- ---------------------------------------------------------------------------
select id as rodada_lamina from public.approval_rounds
 where content_type = 'deliverable' and content_id = :LAMINA and escopo = 'cliente'
\gset

select teste.recusa_com('Rejeitar sem motivo e recusado', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(%L, 'rejeitada', null)$fmt$, :'rodada_lamina'),
  'Diga por que o material foi recusado');

select teste.recusa_com('Otto nao decide a aprovacao de outra empresa', :OTTO,
  format($fmt$select public.decidir_rodada_do_cliente(%L, 'aprovada', null)$fmt$, :'rodada_lamina'),
  'Sem acesso a esta aprovação');

select teste.cenario('Joana aprova a Lamina', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(%L, 'aprovada', 'Ficou ótima.')$fmt$, :'rodada_lamina'),
  'ok');

select teste.conferir('A Lamina esta aprovada',
  (select status::text from public.deliverables where id = :LAMINA), 'aprovado');

select teste.conferir('O Precificador nao se mexeu',
  (select status::text from public.deliverables where id = :PRECIF), 'aguardando_informacoes');

select teste.conferir('O Banner tambem nao',
  (select status::text from public.deliverables where id = :BANNER), 'aguardando_informacoes');

select teste.conferir('E o KV, que nem e do grupo, muito menos',
  (select status::text from public.deliverables where id = :KV), 'aguardando_informacoes');

-- FILTRADO PELO TITULO, e nao so por pessoa: a Marina ja recebeu avisos nos
-- arquivos anteriores da bateria -- `teste.limpar()` nao mexe em
-- `notifications` --, e contar todos os dela daria tres. Escrevi assim na
-- primeira versao e a bateria corrigiu.
select teste.conferir('A equipe foi avisada pelo sino, com o nome da peca',
  (select count(*)::text from public.notifications
    where user_id = :MARINA and tipo = 'aprovacao' and titulo like '%Lâmina A5%'), '1');


-- ---------------------------------------------------------------------------
-- 7. O STATUS DO GRUPO E CALCULADO, E NINGUEM ESCREVE NELE
-- ---------------------------------------------------------------------------
select teste.conferir('Com um aprovado e dois esperando, o grupo aguarda informacoes',
  (select public.status_do_entregavel(:ENXOVAL)::text), 'aguardando_informacoes');

update public.deliverables set status = 'em_aprovacao' where id = :PRECIF;
select teste.conferir('Com um em aprovacao, o grupo fica em aprovacao',
  (select public.status_do_entregavel(:ENXOVAL)::text), 'em_aprovacao');

update public.deliverables set status = 'rejeitado' where id = :BANNER;
-- REJEITADO NO FILHO NAO PINTA O GRUPO DE VERMELHO. Ninguem recusou o grupo;
-- recusaram uma peca dentro dele, e o que ele precisa dizer e "tem coisa para
-- refazer aqui".
select teste.conferir('Com um rejeitado, o grupo pede ajustes e nao fica rejeitado',
  (select public.status_do_entregavel(:ENXOVAL)::text), 'ajustes');

update public.deliverables set status = 'aprovado' where parent_id = :ENXOVAL;
select teste.conferir('Com todos aprovados, o grupo esta aprovado',
  (select public.status_do_entregavel(:ENXOVAL)::text), 'aprovado');

select teste.conferir('E o que esta gravado na coluna do grupo continua sendo o inicial',
  (select status::text from public.deliverables where id = :ENXOVAL), 'aguardando_informacoes');

select teste.conferir('Folha responde por si mesma',
  (select public.status_do_entregavel(:KV)::text), 'aguardando_informacoes');


-- ---------------------------------------------------------------------------
-- 8. COMENTARIO POR SUB-ITEM, E A PAREDE DO INTERNO
-- ---------------------------------------------------------------------------
select teste.cenario('Joana comenta na Lamina', :JOANA,
  format($fmt$insert into public.comments (content_type, content_id, autor_id, texto)
    values ('deliverable', %L, %L, 'Dá para clarear o fundo?')$fmt$, :LAMINA, :JOANA),
  'ok', 1);

select teste.cenario('Diego comenta internamente na Lamina', :DIEGO,
  format($fmt$insert into public.comments (content_type, content_id, autor_id, texto, interno)
    values ('deliverable', %L, %L, 'Cliente sempre pede isso. Já nascer claro.', true)$fmt$,
    :LAMINA, :DIEGO),
  'ok', 1);

select teste.cenario('Joana nao ve o comentario interno', :JOANA,
  format($fmt$select 1 from public.comments where content_type = 'deliverable' and content_id = %L and interno$fmt$, :LAMINA),
  'recusa');

-- CADA SUB-ITEM TEM A PROPRIA THREAD. O comentario da Lamina nao aparece no
-- Precificador -- que e o que faz a conversa sobre uma peca ficar com ela.
select teste.conferir('O comentario ficou na Lamina, e so nela',
  (select count(*)::text from public.comments
    where content_type = 'deliverable' and content_id = :PRECIF), '0');

select teste.cenario('Joana nao comenta em entregavel que nao foi enviado', :JOANA,
  format($fmt$insert into public.comments (content_type, content_id, autor_id, texto)
    values ('deliverable', %L, %L, 'Oi')$fmt$, :KV, :JOANA),
  'recusa');


-- ---------------------------------------------------------------------------
-- 9. VERSOES
-- ---------------------------------------------------------------------------
insert into public.deliverable_versions (deliverable_id, numero_versao, arte_url, arquivo_nome, notas_mudanca, criado_por)
values (:LAMINA, 999, 'https://exemplo/lamina-v1.png', 'lamina-v1.png', 'Primeira arte', :BRUNO);

select teste.conferir('O numero pedido foi ignorado: a versao e a 1',
  (select numero_versao::text from public.deliverable_versions where deliverable_id = :LAMINA order by numero_versao limit 1),
  '1');

insert into public.deliverable_versions (deliverable_id, numero_versao, arte_url, arquivo_nome, notas_mudanca, criado_por)
values (:LAMINA, 1, 'https://exemplo/lamina-v2.png', 'lamina-v2.png', 'Fundo mais claro', :BRUNO);

select teste.conferir('A segunda virou 2',
  (select max(numero_versao)::text from public.deliverable_versions where deliverable_id = :LAMINA), '2');

select teste.conferir('E o entregavel aponta para o arquivo novo',
  (select arte_url from public.deliverables where id = :LAMINA), 'https://exemplo/lamina-v2.png');

select teste.cenario('Joana le o historico do que ela recebeu', :JOANA,
  format('select 1 from public.deliverable_versions where deliverable_id = %L', :LAMINA), 'ok', 2);

-- NAO EXISTE REVERTER NO PORTAL, e a trava nao e a ausencia do botao.
select teste.cenario('Joana nao grava versao', :JOANA,
  format($fmt$insert into public.deliverable_versions (deliverable_id, numero_versao, arte_url, criado_por)
    values (%L, 3, 'https://exemplo/minha.png', %L)$fmt$, :LAMINA, :JOANA),
  'recusa');

insert into public.deliverable_versions (deliverable_id, numero_versao, arte_url, criado_por)
values (:KV, 1, 'https://exemplo/kv.png', :BRUNO);

select teste.cenario('E nao alcanca o historico de um entregavel nao enviado', :JOANA,
  format('select 1 from public.deliverable_versions where deliverable_id = %L', :KV), 'recusa');


-- ---------------------------------------------------------------------------
-- 10. APAGAR LEVA JUNTO O QUE APONTAVA PARA O ENTREGAVEL
-- ---------------------------------------------------------------------------
select teste.conferir('Antes de apagar, a Lamina tem rodada e comentario',
  (select (count(*) > 0)::text from public.approval_rounds
    where content_type = 'deliverable' and content_id = :LAMINA), 'true');

delete from public.deliverables where id = :LAMINA;

select teste.conferir('Rodadas do entregavel apagado sumiram',
  (select count(*)::text from public.approval_rounds
    where content_type = 'deliverable' and content_id = :LAMINA), '0');

select teste.conferir('E os comentarios tambem',
  (select count(*)::text from public.comments
    where content_type = 'deliverable' and content_id = :LAMINA), '0');

-- APAGAR A CAMPANHA LEVA A ARVORE INTEIRA, por chave estrangeira -- e os
-- filhos do grupo vao pelo `parent_id`, que tambem e cascade.
delete from public.campaigns where id = :CAMP;

select teste.conferir('Apagar a campanha levou os entregaveis',
  (select count(*)::text from public.deliverables where campaign_id = :CAMP), '0');
