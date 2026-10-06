-- ===========================================================================
-- 30 - A CORRENTE DO MES TEM UM DIA POR ETAPA (0059, 0083, 0084 e 0088)
--
-- O que estes cenarios guardam, em uma frase: o dia de cada etapa e escolhido
-- ao abrir o mes e vale para o mes INTEIRO, a corrente nao vence de tras para
-- a frente, e a etapa com dia nao entra no calendario -- ela entra na CARGA.
--
-- ---------------------------------------------------------------------------
-- OS CENARIOS DA 0059 FICARAM, VIRADOS DO AVESSO -- DUAS VEZES
--
-- A 0059 datava cada etapa por OFFSET da publicacao de cada post, e a 0083
-- desfez isso: *"ele precisa parar de ficar marcada para ser feita em X dias
-- antes do post ser publicado"*. A 0084 acrescentou a segunda ponta. E a 0088
-- desfez o resto: a etapa deixou de ser DE CADA POST e passou a ser DO MES.
--
-- Entao o cenario central deste arquivo mudou de forma sem mudar de assunto.
-- Ele era *"as tres Pautas do mes vencem no mesmo dia"* -- tres linhas com a
-- mesma data, que era o jeito de a 0084 dizer "uma Pauta por mes" com um
-- modelo que nao sabia diz-lo. Agora e UMA Pauta, e o cenario confere isso:
-- se alguem devolver a corrente por post, ele acha tres onde espera uma.
-- ===========================================================================

-- Estado de partida escrito aqui, como nos arquivos 27 e 29: os cenarios
-- afirmam datas exatas, e isso so e verdade a partir de um ponto conhecido.
delete from public.posts where tema like '%· Novembro/2027';
delete from public.tasks where social_do_mes = '2027-11-01';


-- ---------------------------------------------------------------------------
-- 1. O OFFSET SAIU DO BANCO, e a tabela que o carregava saiu depois
--
-- A coluna primeiro: ela era a regra, e deixa-la parada manteria no schema
-- algo que nenhum caminho escreve e que a proxima pessoa leria como ativo --
-- a decisao da 0023. E a 0088 levou a tabela inteira, pela mesma razao.
-- ---------------------------------------------------------------------------

select teste.conferir('`post_etapas` não existe mais, e o offset com ela',
  (select coalesce(to_regclass('public.post_etapas')::text, '(nenhuma)')), '(nenhuma)');

-- E OS DOIS TRIGGERS SAIRAM JUNTO, que é a metade que importa mais: o da
-- esquerda moveria o dia da Pauta do mês inteiro porque alguém trocou a data
-- de UM post, e é exatamente o comportamento que o usuário pediu para tirar.
-- Tirar só a tela deixaria o banco desfazendo a escolha por baixo — a lição
-- da 0029, onde a regra morava nos dois lados.
select teste.conferir('o trigger que recalculava o prazo pela data do post saiu',
  (select count(*)::text from pg_trigger
    where tgname in ('posts_recalcula_prazos', 'post_etapas_solta_o_offset',
                     'posts_monta_corrente')
      and not tgisinternal), '0');

select teste.conferir('e as funções dele também',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('recalcular_prazos_do_post', 'post_etapas_solta_o_offset',
                        'montar_etapas_do_post')), '0');


-- ---------------------------------------------------------------------------
-- 2. UMA ETAPA POR FASE, COM O PERIODO DO MES
--
-- O CENARIO QUE JUSTIFICA A MIGRATION. A frase do usuário em uma linha: *"em
-- um dia X de Outubro, a Social Media vai ter um dia para fazer a pauta do mês
-- todo"*. Três posts, três datas de publicação diferentes — e uma Pauta só.
-- ---------------------------------------------------------------------------

select teste.cenario('A gestão abre três posts com um dia por etapa',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-11', '[{"redes": ["instagram"], "quantidade": 3}]'::jsonb,
      null, '{}'::jsonb,
      '{"Pauta":     {"inicio": "2027-10-01", "fim": "2027-10-05"},
        "Conteúdo":  {"inicio": "2027-10-06", "fim": "2027-10-12"},
        "Layout":    {"inicio": "2027-10-13", "fim": "2027-10-20"},
        "Envio":     {"inicio": "2027-10-21", "fim": "2027-10-25"},
        "Programar": {"inicio": "2027-10-26", "fim": "2027-10-30"}}'::jsonb,
      'https://drive.google.com/drive/folders/PASTA-0083')$$,
  'ok', 1);

select set_config('t30.mes',
  (select id::text from public.tasks where social_do_mes = '2027-11-01'
    order by created_at desc limit 1), false);

-- UMA PAUTA, E NAO TRES. Este e o cenario virado do avesso: ele media
-- "1 de 3" -- uma data em tres linhas --, e mede "1 de 1". Devolvendo a
-- corrente por post, ele acha 3.
select teste.conferir('o mês tem UMA Pauta, e não uma por post',
  (select count(*)::text from public.etapas_do_mes(current_setting('t30.mes')::uuid)
    where titulo = 'Pauta'), '1');

select teste.conferir('e cinco etapas no total, para três posts',
  (select count(*)::text from public.etapas_do_mes(current_setting('t30.mes')::uuid)), '5');

select teste.conferir('e o período dela é o que foi escolhido',
  (select data_inicio || '→' || prazo
     from public.etapas_do_mes(current_setting('t30.mes')::uuid) where titulo = 'Pauta'),
  '2027-10-01→2027-10-05');

select teste.conferir('cada etapa tem o SEU dia, e a corrente anda na ordem',
  (select string_agg(prazo::text, ',' order by ordem)
     from public.etapas_do_mes(current_setting('t30.mes')::uuid)),
  '2027-10-05,2027-10-12,2027-10-20,2027-10-25,2027-10-30');

-- AS CINCO TEM INICIO, e não só a primeira: um `insert` que gravasse o início
-- de uma etapa só passaria no cenário de cima e deixaria as outras quatro sem
-- bloco nenhum na agenda — e é o bloco que a carga lê.
select teste.conferir('as cinco etapas têm as duas pontas',
  (select count(*)::text from public.etapas_do_mes(current_setting('t30.mes')::uuid)
    where data_inicio is not null and prazo is not null), '5');

select teste.conferir('cada etapa começa no seu dia',
  (select string_agg(data_inicio::text, ',' order by ordem)
     from public.etapas_do_mes(current_setting('t30.mes')::uuid)),
  '2027-10-01,2027-10-06,2027-10-13,2027-10-21,2027-10-26');

-- A DATA NAO PRECISA CAIR DENTRO DO MES, e é decisão: o social de novembro é
-- produzido em outubro inteiro. A trava óbvia — "a etapa vence dentro do mês"
-- — recusaria exatamente o caso que o usuário descreveu.
select teste.conferir('as cinco datas são de OUTUBRO, e o mês é novembro',
  (select count(*)::text from public.etapas_do_mes(current_setting('t30.mes')::uuid)
    where extract(month from prazo) = 10), '5');


-- ---------------------------------------------------------------------------
-- 3. O POST ANDA E A CORRENTE FICA ONDE ESTA
--
-- É o avesso do cenário central da 0059, onde mover a publicação movia as
-- cinco etapas junto. Agora o dia da Pauta é do MÊS, e não existe mais um
-- caminho pelo qual um post possa toca-lo.
-- ---------------------------------------------------------------------------

do $$
declare v_post uuid;
begin
  select p.id into v_post from public.posts p
   where p.tema = 'Instagram 1 de 3 · Novembro/2027';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.posts set data_publicacao = '2027-11-28' where id = v_post;
  reset role;
end $$;

select teste.conferir('o post andou e a Pauta do mês NÃO andou junto',
  (select prazo::text from public.etapas_do_mes(current_setting('t30.mes')::uuid)
    where titulo = 'Pauta'), '2027-10-05');


-- ---------------------------------------------------------------------------
-- 4. DATAR A ETAPA A MAO VALE PARA O MES INTEIRO
--
-- E agora isso e literalmente verdade, e nao uma consequencia: ha UMA linha, e
-- escrever nela e escrever o dia em que a agencia vai pautar o mes. Na 0059
-- isso precisava limpar a regra daquela etapa, porque senao o proximo
-- recalculo a desfaria.
-- ---------------------------------------------------------------------------

select teste.cenario('A gestão troca o dia do Layout do mês',
  '11111111-1111-1111-1111-111111111111',
  format($fmt$update public.subtasks set prazo = '2027-10-22'
     where id = (select id from public.etapas_do_mes(%L) where titulo = 'Layout')$fmt$,
    current_setting('t30.mes')), 'ok', 1);

select teste.conferir('e o dia novo vale para os três posts, porque é um só',
  (select prazo::text from public.etapas_do_mes(current_setting('t30.mes')::uuid)
    where titulo = 'Layout'), '2027-10-22');

select teste.conferir('e não encostou nas outras quatro',
  (select string_agg(prazo::text, ',' order by ordem)
     from public.etapas_do_mes(current_setting('t30.mes')::uuid) where titulo <> 'Layout'),
  '2027-10-05,2027-10-12,2027-10-25,2027-10-30');

-- MEXER NO STATUS NAO ENCOSTA NA DATA. O trigger da 0059 precisava de duas
-- condições para não apagar a regra de passagem; sem ele, a pergunta continua
-- valendo e a resposta é mais simples — nada toca a data senão quem a escreve.
select teste.cenario('A Pauta começa',
  '11111111-1111-1111-1111-111111111111',
  format($fmt$update public.subtasks set status = 'em_andamento'
     where id = (select id from public.etapas_do_mes(%L) where titulo = 'Pauta')$fmt$,
    current_setting('t30.mes')), 'ok', 1);

select teste.conferir('mexer no status não apaga o dia da etapa',
  (select prazo::text from public.etapas_do_mes(current_setting('t30.mes')::uuid)
    where titulo = 'Pauta'), '2027-10-05');


-- ---------------------------------------------------------------------------
-- 5. A ETAPA NAO ENTRA MAIS NO CALENDARIO, E ENTRA NA CARGA
--
-- A sexta origem da `calendar_events` saiu na 0088, pela frase do usuario que
-- fechou o 3J: *"a corrente do social vive so em minhas tasks e na carga"*. E
-- a decisao da 0077, que tirou a demanda e a etapa pela mesma razao.
--
-- OS CENARIOS DA 0059 FICARAM VIRADOS DO AVESSO: eles conferiam que a etapa
-- APARECIA no calendario da equipe e NAO aparecia para o cliente. Hoje o
-- primeiro mede o contrario, e o segundo continua igual -- ele nunca dependeu
-- da camada existir.
-- ---------------------------------------------------------------------------

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.subtasks set responsavel_id = '33333333-3333-3333-3333-333333333333'
   where social_papel is not null and titulo = 'Conteúdo'
     and task_id = current_setting('t30.mes')::uuid;
  reset role;
end $$;

select teste.conferir_como(
  'a etapa do mês NÃO aparece mais no calendário da equipe',
  '33333333-3333-3333-3333-333333333333',
  $$select count(*)::text from public.calendar_events where tipo = 'etapa_de_post'$$,
  '0');

select teste.conferir_como(
  'e o cliente continua não vendo nenhuma',
  '77777777-7777-7777-7777-777777777777',
  $$select count(*)::text from public.calendar_events where tipo = 'etapa_de_post'$$,
  '0');

-- E O QUE ENTROU NO LUGAR E O PESO. `carga_do_dia()` le `subtasks` direto e
-- nunca leu `post_etapas` -- entao o dia em que a redatora escreve as doze
-- legendas aparecia VAZIO na Linha do Tempo e na faixa de disponibilidade. Com
-- a etapa sendo subtarefa, ele passa a existir sem uma linha de mudanca
-- naquela funcao.
--
-- 180 MINUTOS E A ETAPA EM BRANCO DA 0081, distribuida pela janela: sete dias
-- uteis entre 06/10 e 12/10 (a etapa Conteudo) dao um pedaco por dia, e o que
-- este cenario mede e que ele NAO E ZERO.
select teste.conferir(
  'e a carga da redatora no dia da etapa deixou de ser zero',
  (select (minutos_comprometidos > 0)::text from public.carga_do_dia(
    '33333333-3333-3333-3333-333333333333', '2027-10-07')), 'true');

select teste.conferir(
  'num dia fora da janela dela, continua zero',
  (select minutos_comprometidos::text from public.carga_do_dia(
    '33333333-3333-3333-3333-333333333333', '2027-09-01')), '0');


-- ---------------------------------------------------------------------------
-- 6. O QUE A FUNCAO RECUSA
-- ---------------------------------------------------------------------------

select teste.recusa_com(
  'a corrente não pode vencer de trás para a frente',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-12', '[{"redes": ["instagram"], "quantidade": 1}]'::jsonb, null, '{}'::jsonb,
      '{"Conteúdo": {"inicio": "2027-11-15", "fim": "2027-11-20"},
        "Layout":   {"inicio": "2027-11-05", "fim": "2027-11-10"}}'::jsonb)$$,
  'venceria antes da etapa anterior');

select teste.recusa_com(
  'etapa que não existe na corrente é recusada pelo nome',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-12', '[{"redes": ["instagram"], "quantidade": 1}]'::jsonb, null, '{}'::jsonb,
      '{"Revisão": {"inicio": "2027-11-05", "fim": "2027-11-10"}}'::jsonb)$$,
  'não tem etapa chamada');

-- AS DUAS FORMAS ANTIGAS SAO RECUSADAS COM FRASE PROPRIA, e não com um erro
-- sobre sintaxe de entrada de `date`. Quem cair aqui está mandando a 0059 (o
-- número) ou a 0083 (a data solta), e a recusa precisa dizer qual é a nova — é
-- a decisão do objeto de quantidades na 0082.
--
-- A SOLTA É A QUE IMPORTA MAIS: ela é uma data válida, então sem esta recusa
-- ela entraria como "só o fim" e o mês abriria com a corrente inteira sem
-- início — que não dá erro em lugar nenhum e some na carga de quem produz.
select teste.recusa_com_dica(
  'o número da 0059 é recusado dizendo que agora é período',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-12', '[{"redes": ["instagram"], "quantidade": 1}]'::jsonb, null, '{}'::jsonb,
      '{"Pauta": -10}'::jsonb)$$,
  'as duas pontas');

select teste.recusa_com_dica(
  'e a data solta da 0083 também',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-12', '[{"redes": ["instagram"], "quantidade": 1}]'::jsonb, null, '{}'::jsonb,
      '{"Pauta": "2027-11-10"}'::jsonb)$$,
  'as duas pontas');

-- PERIODO INVERTIDO E RECUSADO NOMEANDO A ETAPA, e não pelo `check` da tabela:
-- "subtasks_periodo" não diz qual das cinco está trocada.
select teste.recusa_com_dica(
  'a etapa que termina antes de começar é recusada pelo nome',
  '11111111-1111-1111-1111-111111111111',
  $$select public.abrir_mes_de_social(
      (select id from public.clients order by created_at limit 1),
      '2027-12', '[{"redes": ["instagram"], "quantidade": 1}]'::jsonb, null, '{}'::jsonb,
      '{"Layout": {"inicio": "2027-11-20", "fim": "2027-11-10"}}'::jsonb)$$,
  'os dois campos não estão trocados');

-- E O `check` DA TABELA SEGURA QUEM MONTA O UPDATE A MAO, que é a diferença de
-- sempre entre "a tela não faz" e "o banco não aceita". Ele passou a ser o de
-- `subtasks` (0027), que e o mesmo de toda etapa do produto -- e e isso que o
-- 3J entrega: a etapa do social deixou de ter travas proprias.
select teste.recusa_com(
  'e o banco recusa o período invertido escrito à mão',
  '11111111-1111-1111-1111-111111111111',
  format($fmt$update public.subtasks set data_inicio = '2027-10-30'
     where id = (select id from public.etapas_do_mes(%L) where titulo = 'Pauta')$fmt$,
    current_setting('t30.mes')),
  'subtasks_periodo');


-- ---------------------------------------------------------------------------
-- 7. UMA VERSAO SO DA FUNCAO
--
-- Acrescentar um parametro cria uma funcao NOVA no Postgres: a de sete
-- argumentos continuaria existindo, e o PostgREST escolheria uma das duas
-- conforme o corpo do pedido. Duas versoes da mesma funcao e o lugar onde as
-- duas verdades comecam a divergir -- e a que ficasse para tras abriria o mes
-- ignorando as datas, sem erro nenhum.
-- ---------------------------------------------------------------------------

-- A 0087 ACRESCENTOU `p_flow_id`, e e por isso que ela faz o `drop` da
-- assinatura de sete ANTES do `create` da de oito. A 0088 nao acrescenta
-- parametro nenhum, e e por isso que ela nao tem `drop` -- reescrever o corpo
-- com a mesma assinatura e o caso em que `create or replace` basta.
select teste.conferir(
  'existe UMA abrir_mes_de_social, e ela recebe os prazos e o fluxo',
  (select string_agg(pg_get_function_identity_arguments(p.oid), ' | ')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'abrir_mes_de_social'),
  'p_client_id uuid, p_mes text, p_quantidades jsonb, p_responsavel_id uuid, p_responsaveis jsonb, p_prazos jsonb, p_link_entrega text, p_flow_id uuid');

-- E A VIEW CONTINUA COM `security_invoker`. O `create or replace view` da 0059
-- teve que repetir a clausula, a 0077 de novo e a 0088 pela quarta vez: ele
-- NAO herda a do objeto que substitui, e sem ela a view leria as tabelas de
-- origem inteiras para qualquer pessoa autenticada.
select teste.conferir(
  'calendar_events continua com security_invoker depois do replace',
  (select (reloptions @> array['security_invoker=true'])::text
     from pg_class where relname = 'calendar_events'),
  'true');
