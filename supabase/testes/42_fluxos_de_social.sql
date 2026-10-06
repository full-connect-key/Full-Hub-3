-- ===========================================================================
-- 42 - FLUXOS DE SOCIAL: a corrente deixa de ser fixa (migration 0087)
--
-- Decisao do usuario: *"algumas contas possuem um fluxo de aprovacao
-- diferentes (...) Algumas contas validam pauta e conteudo, antes de ir para
-- Producao de Layout. E apos o layout feito, ele tambem vai para aprovacao do
-- cliente. Preciso poder montar fluxos de Social diferentes, para serem
-- aplicados em determinados socials, de meses de determinadas contas."*
--
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "um fluxo que chama a entrega de
-- outro nome continua tendo portao do cliente". Ele atravessa a unica coisa
-- que esta migration podia quebrar de forma cara: ate ela, SEIS comparacoes do
-- produto perguntavam `nome = 'Envio'`, e com a cadeia editavel um fluxo que
-- chamasse aquele elo de "Entrega" ficaria sem portao nenhum -- o mes abriria,
-- os doze posts nasceriam, e "Enviar ao cliente" ficaria desligado para
-- sempre, sem erro em lugar nenhum.
--
-- E OS DOIS FLUXOS DESTE ARQUIVO SAO DE PROPOSITO, um com os nomes da casa e
-- um com nomes proprios: medindo so o da casa, todo cenario passaria com as
-- comparacoes por nome de volta no lugar -- que e a licao da `calendar_events`
-- com um cliente so.
-- ===========================================================================

\set ANA    '''11111111-1111-1111-1111-111111111111'''
\set DIEGO  '''22222222-2222-2222-2222-222222222222'''
\set CARLA  '''33333333-3333-3333-3333-333333333333'''
\set BRUNO  '''44444444-4444-4444-4444-444444444444'''
\set MARINA '''55555555-5555-5555-5555-555555555555'''
\set JOANA  '''77777777-7777-7777-7777-777777777777'''
\set OTTO   '''88888888-8888-8888-8888-888888888888'''

\set CASA   '''f1000000-0000-4000-8000-000000000001'''

\set FCLI   '''e0870000-0000-0000-0000-0000000000c1'''
\set FTRES  '''e0870000-0000-0000-0000-0000000000f1'''
\set FNOMES '''e0870000-0000-0000-0000-0000000000f2'''
\set FENTR  '''e0890000-0000-0000-0000-0000000000f3'''

select teste.limpar();

insert into public.clients (id, nome_empresa, nome_contato, email_contato, slug, ativo)
values (:FCLI, 'Fluxo & Cia', 'Sueli', 'sueli@fluxo.com', 'fluxo-cia', true)
on conflict (id) do nothing;

insert into public.client_users (client_id, user_id)
values (:FCLI, :JOANA) on conflict do nothing;


-- ---------------------------------------------------------------------------
-- 1. O FLUXO DA CASA NASCE NA MIGRATION
--
-- Catalogo vazio no primeiro dia faz o modulo estrear sem funcionar -- quem
-- abre o mes encontra um seletor sem opcao e conclui que a area nao esta
-- pronta. E a decisao dos workflows da 0008.
-- ---------------------------------------------------------------------------

select teste.conferir('O fluxo da casa tem as cinco etapas da 0045',
  (select string_agg(nome, ' > ' order by ordem) from public.social_flow_steps
    where flow_id = :CASA),
  'Pauta > Conteúdo > Layout > Envio > Programar');

select teste.conferir('E o Envio e a entrega, nao o Programar',
  (select string_agg(nome || ':' || papel, ', ' order by ordem)
     from public.social_flow_steps
    where flow_id = :CASA and papel <> 'producao'),
  'Envio:entrega, Programar:pos_entrega');

select teste.conferir('Sem conta nem mes escolhendo, o fluxo e o da casa',
  (select public.fluxo_do_mes(:FCLI)::text), :CASA);

-- AS DUAS PONTAS SUGERIDAS CHEGARAM A VIAJAR COM O FLUXO (0087) E SAIRAM NA
-- 0089 -- decisao do usuario: *"tem uma aba comeca quantos dias antes do mes,
-- e termina quantos dias antes do mes, nao faz sentido, por que cada mes tem um
-- prazo de fluxo diferente, mas sempre que for aberto o social, o fluxo, deve
-- ter a mesma sequencia de acoes"*.
--
-- O CENARIO FICOU, VIRADO DO AVESSO: ele provava que a Pauta sugeria 31/27, e
-- hoje confere que as colunas SAIRAM. Quem as devolver derruba este e o de
-- baixo, e o de baixo diz o que acontece com quem mandar a forma antiga.
select teste.conferir('As duas pontas de data sairam do fluxo',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'social_flow_steps'
      and column_name in ('comeca_dias_antes', 'termina_dias_antes')),
  '0');

-- E A FORMA ANTIGA DE `p_etapas` E RECUSADA COM FRASE PROPRIA, nao ignorada.
-- `p_etapas` e `jsonb`, entao uma chave a mais entra CALADA: quem mandar
-- `comeca_dias_antes` gravaria o fluxo sem erro nenhum e descobriria no mes
-- seguinte que as datas que ele acha que combinou nao estao em lugar nenhum. E
-- a decisao do objeto de quantidades (0082) e da data solta (0084).
select teste.recusa_com_dica('A forma antiga de p_etapas e recusada dizendo qual e a nova', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo com os dias de volta',
      jsonb_build_array(
        jsonb_build_object('nome','Faz','funcao','Design','papel','producao',
                           'comeca_dias_antes',19,'termina_dias_antes',12),
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega')))$$,
  'as datas são do mês');

select teste.recusa_com('E a mensagem diz que o fluxo nao guarda mais os dias', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo com os dias de volta',
      jsonb_build_array(
        jsonb_build_object('nome','Faz','funcao','Design','papel','producao',
                           'termina_dias_antes',12),
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega')))$$,
  'não guarda mais os dias de cada etapa');

-- E O DE-PARA DO CARD (0046) VIROU COLUNA, e nao o nome da etapa: renomear
-- "Pauta" fazia a tela do portal abrir o portao com a caixa de texto vazia.
select teste.conferir('A Pauta enche o campo pauta e o Conteudo a legenda',
  (select string_agg(nome || '=' || campo, ', ' order by ordem)
     from public.social_flow_steps where flow_id = :CASA and campo is not null),
  'Pauta=pauta, Conteúdo=legenda');


-- ---------------------------------------------------------------------------
-- 2. MONTAR UM FLUXO: O CASO QUE O USUARIO DESCREVEU
--
-- Tres avaliacoes do cliente antes da arte sair como peca fechada -- pauta,
-- conteudo e layout --, que e o arranjo que a corrente fixa nao sabia
-- representar.
-- ---------------------------------------------------------------------------

select teste.conferir_como('O desenvolvedor monta o fluxo de tres avais', :DIEGO,
  format($q$select (public.salvar_fluxo_de_social(
    'Três avaliações do cliente',
    jsonb_build_array(
      jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                         'campo','pauta','aprovacao_cliente',true),
      jsonb_build_object('nome','Conteúdo','funcao','Redator','papel','producao',
                         'campo','legenda','aprovacao_cliente',true),
      jsonb_build_object('nome','Layout','funcao','Design','papel','producao',
                         'aprovacao_cliente',true),
      jsonb_build_object('nome','Envio','funcao','Gestao','papel','entrega'),
      jsonb_build_object('nome','Programar','funcao','Social Media','papel','pos_entrega')
    ), %L) = %L)::text$q$, :FTRES, :FTRES),
  'true');

select teste.conferir('Os tres portoes do meio estao marcados',
  (select string_agg(nome, ', ' order by ordem) from public.social_flow_steps
    where flow_id = :FTRES and aprovacao_cliente),
  'Pauta, Conteúdo, Layout');

-- A ORDEM SAI DA POSICAO NA LISTA, com espaco de dez: a etapa de Ajustes nasce
-- ENTRE duas, e sem a folga um pedido do cliente obrigaria a renumerar as
-- seguintes (0045).
select teste.conferir('E a ordem tem folga de dez',
  (select string_agg(ordem::text, ',' order by ordem) from public.social_flow_steps
    where flow_id = :FTRES),
  '10,20,30,40,50');

-- O COLABORADOR NAO MONTA FLUXO, e quem barra e a policy -- nao a funcao, que
-- e `security invoker` justamente para que seja a policy a decidir. Um definer
-- aqui entregaria a edicao do fluxo a quem a corrente manda trabalhar.
select teste.recusa_com('O colaborador nao monta fluxo', :MARINA,
  $$select public.salvar_fluxo_de_social('Fluxo da Marina',
      jsonb_build_array(
        jsonb_build_object('nome','Fazer','funcao','Design','papel','producao'),
        jsonb_build_object('nome','Mandar','funcao','Gestao','papel','entrega')))$$,
  'row-level security');

select teste.recusa_com('Nem o cliente', :JOANA,
  $$select public.salvar_fluxo_de_social('Fluxo da Joana',
      jsonb_build_array(
        jsonb_build_object('nome','Mandar','funcao','Gestao','papel','entrega')))$$,
  'row-level security');

-- E ELE NEM LE A CORRENTE DE NINGUEM: o fluxo e conversa interna -- quem
-- produz o que, em que ordem --, e a ausencia de policy e a trava, como em
-- `post_etapas` desde a 0045.
select teste.conferir_como('O cliente nao le fluxo nenhum', :JOANA,
  $$select count(*)::text from public.social_flows$$, '0');

select teste.conferir_como('Mas quem produz le, porque a corrente e dele', :MARINA,
  $$select (count(*) > 0)::text from public.social_flow_steps$$, 'true');


-- ---------------------------------------------------------------------------
-- 3. A TRAVA DA CORRENTE: producao* entrega pos_entrega*
--
-- UM FLUXO COM ETAPA E SEM ENTREGA e um mes cujos posts nunca chegam ao
-- cliente: o mes abre, os doze posts nascem, e "Enviar ao cliente" fica
-- desligado para sempre sem nada na tela dizendo por que. E o modo de falha
-- mais caro que a 0087 cria, entao e trava de banco e nao validacao de tela.
-- ---------------------------------------------------------------------------

select teste.recusa_com('Fluxo sem entrega e recusado', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo sem entrega',
      jsonb_build_array(
        jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao'),
        jsonb_build_object('nome','Layout','funcao','Design','papel','producao')))$$,
  'precisa de uma etapa de entrega');

-- E QUANDO HA UM PORTAO DE CLIENTE E NENHUMA ENTREGA, A RECUSA NOMEIA O ELO.
--
-- Relato do usuario: *"quando tento montar um fluxo, ele aparece: Falta a etapa
-- de entrega ao cliente -- mas essa etapa ja esta vinculada ao fato que o
-- cliente, aprova a etapa de layout, que e a ultima de producao"*. O fluxo dele
-- E representavel -- Layout com `papel = 'entrega'`, porque o papel e coluna
-- desde a 0087 exatamente para o NOME ser livre --, e a recusa generica nomeava
-- o que falta a quem acabou de marcar, na mesma tela, um interruptor escrito "o
-- cliente aprova esta etapa". As duas frases falam do cliente. Dizer QUAL etapa
-- marcar e a diferenca entre uma recusa e uma instrucao (0023).
--
-- O ELO NOMEADO E O ULTIMO PORTAO e nao o primeiro: numa conta que aprova pauta
-- e layout, mandar a pessoa marcar a Pauta como entrega poria o envio ao
-- cliente no inicio da corrente.
select teste.recusa_com_dica('Sem entrega mas com portao, a recusa nomeia o ultimo portao', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo que acha que entregou',
      jsonb_build_array(
        jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                           'aprovacao_cliente',true),
        jsonb_build_object('nome','Layout','funcao','Design','papel','producao',
                           'aprovacao_cliente',true)))$$,
  'Se é em Layout que o cliente dá a palavra final');

select teste.recusa_com('E a mensagem diz que marcar "o cliente aprova" nao entrega', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo que acha que entregou',
      jsonb_build_array(
        jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                           'aprovacao_cliente',true),
        jsonb_build_object('nome','Layout','funcao','Design','papel','producao',
                           'aprovacao_cliente',true)))$$,
  'Marcar "o cliente aprova" em Layout não entrega o material');

-- E O FLUXO QUE O USUARIO QUERIA PASSA: a entrega E a ultima producao, com o
-- nome dela e a funcao de quem a faz. E o cenario que prova que a recusa de
-- cima e uma instrucao e nao um beco.
select teste.conferir_como('A entrega pode ser a ultima producao, com nome proprio', :DIEGO,
  format($q$select (public.salvar_fluxo_de_social(
    'Layout é a palavra final',
    jsonb_build_array(
      jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                         'campo','pauta','aprovacao_cliente',true),
      jsonb_build_object('nome','Conteúdo','funcao','Redator','papel','producao',
                         'campo','legenda'),
      jsonb_build_object('nome','Layout','funcao','Design','papel','entrega'),
      jsonb_build_object('nome','Programar','funcao','Social Media','papel','pos_entrega')
    ), %L) = %L)::text$q$, :FENTR, :FENTR),
  'true');

-- E ELA CONTINUA SENDO O PORTAO FINAL, que e a unica coisa que a 0089 nao
-- afrouxou: `portoes_do_mes()` entra pelo PAPEL e nao pelo nome, entao a
-- entrega chamada "Layout" e portao do mesmo jeito.
select teste.conferir('E a entrega chamada Layout e portao, pelo papel',
  (select string_agg(nome, ', ' order by ordem) from public.social_flow_steps
    where flow_id = :FENTR and (aprovacao_cliente or papel = 'entrega')),
  'Pauta, Layout');

-- E A FUNCAO DELA E PERGUNTADA: `funcoesDoFluxo()` pulava a entrega com o
-- argumento de que ela nao e trabalho de ninguem (0087) -- verdadeiro do 'Envio'
-- da casa, falso aqui. Desde a 0088 ela e uma subtarefa de verdade, e entrega
-- sem dono nao aparece no "Minhas Tasks" de ninguem.
select teste.conferir('E o Design continua sendo quem faz a entrega dela',
  (select funcao::text from public.social_flow_steps
    where flow_id = :FENTR and papel = 'entrega'),
  'Design');

select teste.recusa_com('Duas entregas tambem', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo com duas entregas',
      jsonb_build_array(
        jsonb_build_object('nome','Manda uma','funcao','Gestao','papel','entrega'),
        jsonb_build_object('nome','Manda outra','funcao','Gestao','papel','entrega')))$$,
  'a entrega é uma só');

-- E A TRAVA DO BANCO E A QUE VALE: as duas recusas acima saem da funcao, que
-- escreve a frase antes de gravar nada -- a decisao da maquina de estados da
-- subtarefa ao lado dos gatilhos da 0007. Estas duas vao direto na tabela, que
-- e o caminho de quem monta a chamada a mao.
-- E A FRASE E A MESMA DOS DOIS LADOS, que e a licao da 0029 e da 0060: uma
-- regra que mora em dois lugares com duas frases diferentes manda a pessoa a
-- dois lugares diferentes. `:FTRES` tem os tres portoes do meio marcados, entao
-- a recusa certa aqui e a ESPECIFICA -- a que nomeia o Layout --, e e ela que o
-- gatilho precisa dizer tambem. Era 'precisa de uma etapa de entrega' ate a
-- 0089, e o cenario mudou de agulha porque a frase mudou dos dois lados juntos.
select teste.recusa_com('E o gatilho recusa o mesmo, na tabela', :DIEGO,
  format($q$delete from public.social_flow_steps
            where flow_id = %L and papel = 'entrega'$q$, :FTRES),
  'Marcar "o cliente aprova" em Layout não entrega o material');

-- O ELO ESCOLHIDO AQUI E O PROGRAMAR e nao o Layout, e a razao e um achado da
-- propria bateria: o Layout carrega a marca do cliente neste fluxo, entao o
-- `check` de LINHA -- a marca so cabe em elo de producao -- dispara antes do
-- gatilho, e o cenario passaria medindo a trava errada.
select teste.recusa_com('E recusa a segunda entrega escrita a mao', :DIEGO,
  format($q$update public.social_flow_steps set papel = 'entrega'
            where flow_id = %L and nome = 'Programar'$q$, :FTRES),
  'a entrega é uma só');

-- A ORDEM TAMBEM, e a recusa NOMEIA a etapa fora de lugar: "a ordem esta
-- errada" manda a pessoa conferir seis linhas; dizer qual e a diferenca entre
-- uma recusa e uma instrucao (0023).
select teste.recusa_com_dica('Producao depois da entrega e recusada, nomeando a etapa', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo de tras para frente',
      jsonb_build_array(
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega'),
        jsonb_build_object('nome','Faz a arte','funcao','Design','papel','producao')))$$,
  'produção, entrega e depois');

select teste.recusa_com('E a frase nomeia qual elo esta do lado errado', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo de tras para frente 2',
      jsonb_build_array(
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega'),
        jsonb_build_object('nome','Faz a arte','funcao','Design','papel','producao')))$$,
  'Faz a arte');

-- O PORTAO SO CABE NUM ELO DE PRODUCAO, e e `check` de linha: a entrega JA e o
-- portao, e o pos_entrega vem depois da decisao. Ate a 0076 isso era um FILTRO
-- na leitura -- `montar_etapas_do_post` descartava a marca do Envio e do
-- Programar --, e virou trava de escrita.
select teste.recusa_com('A entrega nao recebe a marca do cliente', :DIEGO,
  format($q$update public.social_flow_steps set aprovacao_cliente = true
            where flow_id = %L and papel = 'entrega'$q$, :FTRES),
  'social_flow_steps_portao_coerente');

select teste.recusa_com('Nem o que vem depois da decisao', :DIEGO,
  format($q$update public.social_flow_steps set aprovacao_cliente = true
            where flow_id = %L and papel = 'pos_entrega'$q$, :FTRES),
  'social_flow_steps_portao_coerente');

-- FLUXO SEM ETAPA NENHUMA passa pelo gatilho de proposito -- e o estado entre
-- o `delete` e o `insert` de quem o esta reescrevendo --, e e a FUNCAO que o
-- recusa. Recusar no gatilho travaria a edicao para proteger o uso.
select teste.recusa_com('Mas um fluxo vazio nao se salva', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo pelado', '[]'::jsonb)$$,
  'sem etapa nenhuma não abre mês nenhum');

select teste.cenario('E esvaziar os elos de um fluxo passa, porque e o meio da edicao',
  :DIEGO,
  format($q$delete from public.social_flow_steps where flow_id = %L$q$, :FTRES),
  'passa');

-- E O FLUXO VOLTA, porque os cenarios de baixo o usam.
select teste.conferir_como('O fluxo e remontado', :DIEGO,
  format($q$select (public.salvar_fluxo_de_social(
    'Três avaliações do cliente',
    jsonb_build_array(
      jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                         'campo','pauta','aprovacao_cliente',true),
      jsonb_build_object('nome','Conteúdo','funcao','Redator','papel','producao',
                         'campo','legenda','aprovacao_cliente',true),
      jsonb_build_object('nome','Layout','funcao','Design','papel','producao',
                         'aprovacao_cliente',true),
      jsonb_build_object('nome','Envio','funcao','Gestao','papel','entrega'),
      jsonb_build_object('nome','Programar','funcao','Social Media','papel','pos_entrega')
    ), %L) = %L)::text$q$, :FTRES, :FTRES),
  'true');

-- DUAS ETAPAS COM O MESMO NOME nao e detalhe: `p_prazos` e um mapa POR NOME
-- desde a 0059, e as duas receberiam o mesmo periodo -- com a trava da ordem
-- recusando o mes em seguida, por uma razao que a mensagem nao explicaria.
select teste.recusa_com('Duas etapas homonimas no mesmo fluxo', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo com nome repetido',
      jsonb_build_array(
        jsonb_build_object('nome','Arte','funcao','Design','papel','producao'),
        jsonb_build_object('nome','Arte','funcao','Design','papel','producao'),
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega')))$$,
  'duas etapas chamadas "Arte"');


-- ---------------------------------------------------------------------------
-- 4. UM FLUXO COM NOMES PROPRIOS -- O CENARIO QUE JUSTIFICA O ARQUIVO
--
-- Nenhum elo deste fluxo se chama Envio, Pauta, Conteudo, Layout ou Programar.
-- Se qualquer uma das seis comparacoes por nome voltar ao produto, os cenarios
-- desta secao caem -- e e o unico jeito de medir isso, porque com os nomes da
-- casa eles passariam dos dois jeitos.
-- ---------------------------------------------------------------------------

select teste.conferir_como('Um fluxo que nao usa nenhum dos cinco nomes', :DIEGO,
  format($q$select (public.salvar_fluxo_de_social(
    'Fluxo com outro vocabulário',
    jsonb_build_array(
      jsonb_build_object('nome','Briefing do mês','funcao','Social Media','papel','producao',
                         'campo','pauta','aprovacao_cliente',true),
      jsonb_build_object('nome','Produção de Layout','funcao','Design','papel','producao',
                         'campo','legenda'),
      jsonb_build_object('nome','Entrega ao cliente','funcao','Gestao','papel','entrega'),
      jsonb_build_object('nome','Agendamento','funcao','Social Media','papel','pos_entrega')
    ), %L) = %L)::text$q$, :FNOMES, :FNOMES),
  'true');

insert into public.client_flow_defaults (client_id, social_flow_id)
values (:FCLI, :FNOMES)
on conflict (client_id) do update set social_flow_id = :FNOMES;

-- O POST ENTRA NUM MES (0088), e nao mais avulso: a corrente e do MES desde
-- entao, e um post fora de um mes aberto nao tem etapa nenhuma. Sem o mes,
-- esta secao mediria a ausencia da corrente em vez da presenca dela.
select teste.cenario('O Atendimento abre maio com o fluxo de vocabulário próprio', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-05',
           '[{"redes":["instagram"],"quantidade":1}]'::jsonb,
           %L, jsonb_build_object('Design', %L::text),
           '{}'::jsonb, 'https://drive.com/maio', %L)$q$,
         :FCLI, :BRUNO, :CARLA, :FNOMES), 'ok', 1);

select set_config('t42.maio',
  (select id::text from public.tasks where client_id = :FCLI and social_do_mes = '2027-05-01'),
  false);
select set_config('t42.post1',
  (select id::text from public.posts_do_mes(current_setting('t42.maio')::uuid) limit 1),
  false);

select teste.conferir('A corrente do mes saiu do fluxo escolhido',
  (select string_agg(titulo, ' > ' order by ordem)
     from public.etapas_do_mes(current_setting('t42.maio')::uuid)),
  'Briefing do mês > Produção de Layout > Entrega ao cliente > Agendamento');

-- ESTE E O CENARIO. Com `nome = 'Envio'` de volta em
-- `porta_do_cliente_no_post`, o primeiro portao aberto deste post seria o
-- "Briefing do mes" -- que esta certo, porque ele TEM a marca -- e depois de
-- concluido nao haveria mais nenhum: o post nunca sairia da agencia.
select teste.conferir('Os dois portoes do mes, na ordem e sem se chamarem Envio',
  (select string_agg(titulo, ' > ' order by ordem)
     from public.portoes_do_mes(current_setting('t42.maio')::uuid)),
  'Briefing do mês > Entrega ao cliente');

select teste.conferir('O primeiro portao e o briefing, que a conta aprova',
  (public.porta_do_cliente_no_post(current_setting('t42.post1')::uuid)).titulo,
  'Briefing do mês');

-- E A ENTREGA E RECONHECIDA PELO PAPEL. Com `nome = 'Envio'` de volta em
-- `portoes_do_mes`, este mes teria UM portao -- o briefing -- e depois dele
-- nenhum: o post nunca sairia da agencia, sem erro em lugar nenhum.
select teste.conferir('E a segunda e a entrega sem se chamar Envio',
  (select social_papel::text from public.portoes_do_mes(current_setting('t42.maio')::uuid)
    order by ordem desc limit 1), 'entrega');

-- E A CAIXINHA DA ENTREGA NAO SE MARCA A MAO, nem pela gestao -- ela e
-- consequencia da APROVACAO daquele post, como `posts.enviado_em` e desde a
-- 0032. A trava perguntava pelo nome; agora pergunta pelo papel.
select teste.recusa_com('A caixinha da entrega nao se marca a mao, mesmo com outro nome', :DIEGO,
  format($q$update public.post_etapa_progresso set concluido = true
            where post_id = %L and subtask_id = (
              select id from public.etapas_do_mes(%L) where titulo = 'Entrega ao cliente')$q$,
         current_setting('t42.post1'), current_setting('t42.maio')),
  'não se marca à mão');

-- E O QUE O CLIENTE DECIDE sai do CAMPO e nao do nome: com
-- `case e.nome when 'Pauta'` de volta, esta tela abriria em branco.
select teste.cenario('A gestao escreve o briefing', :DIEGO,
  format($q$update public.posts set pauta = 'Três telas, tom de conversa.'
            where id = %L$q$, current_setting('t42.post1')), 'ok', 1);

-- A RODADA INTERNA APROVADA E FIXTURE, e entra como o arquivo 21 e o 39 a
-- poem: por `insert` cru, sem sessao. `approval_rounds_insert` aceita rodada
-- `pendente` de quem produziu (0032), e gravar uma ja aprovada pela mao de
-- quem decide e um estado, nao uma acao.
do $$
begin
  insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
  values ('post', current_setting('t42.post1')::uuid, 1, 'interna',
          '44444444-4444-4444-4444-444444444444', 'aprovada',
          '22222222-2222-2222-2222-222222222222');
end $$;

select teste.cenario('A gestao manda o briefing ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$,
    current_setting('t42.post1'), :DIEGO), 'ok', 1);

select teste.conferir_como('O cliente le o texto do portao, pelo campo', :JOANA,
  format($q$select texto from public.o_que_o_cliente_decide(%L)$q$,
    current_setting('t42.post1')), 'Três telas, tom de conversa.');

select teste.conferir_como('E o nome do portao e o do fluxo dele', :JOANA,
  format($q$select etapa from public.o_que_o_cliente_decide(%L)$q$,
    current_setting('t42.post1')), 'Briefing do mês');

-- O CLIENTE APROVA, E O POST NAO FICA APROVADO -- a linha que a 0076 existe
-- para proteger, atravessando a 0087: o portao decidido nao e a entrega, entao
-- o post volta para producao. Com `porta.nome <> 'Envio'` de volta, este post
-- ficaria verde no calendario dele com a arte inexistente.
select teste.cenario('A Joana aprova o briefing', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'aprovada', 'Pode seguir.')$fmt$, current_setting('t42.post1')), 'ok', 1);

select teste.conferir('O post voltou para producao, e nao ficou aprovado',
  (select status::text from public.posts where id = current_setting('t42.post1')::uuid),
  'em_producao');

select teste.conferir('E o portao passou a ser a entrega, pelo papel',
  (public.porta_do_cliente_no_post(current_setting('t42.post1')::uuid)).titulo,
  'Entrega ao cliente');


-- ---------------------------------------------------------------------------
-- 5. O AJUSTE VOLTA PARA QUEM ENTREGOU, E NAO PARA A PALAVRA 'Layout'
--
-- Com a cadeia editavel, `e.nome = 'Layout'` devolveria o ajuste para NINGUEM
-- num fluxo que chame aquela etapa de outra coisa -- a caixinha de ninguem
-- desmarcaria, e o pedido do cliente nao chegaria a pessoa nenhuma.
--
-- NAO NASCE ETAPA (0088): com a etapa sendo do MES, criar uma "Ajustes" por
-- pedido afirmaria que o mes inteiro voltou por causa de um post. O que volta
-- e a CAIXINHA, na etapa de quem fez o ultimo elo de producao -- que neste
-- fluxo e a "Producao de Layout", da Carla.
-- ---------------------------------------------------------------------------

select set_config('t42.prod',
  (select id::text from public.etapas_do_mes(current_setting('t42.maio')::uuid)
    where titulo = 'Produção de Layout'), false);

select teste.conferir('A etapa de producao e da Carla, pela funcao Design',
  (select responsavel_id::text from public.subtasks where id = current_setting('t42.prod')::uuid),
  :CARLA);

-- A CAIXINHA DO BRIEFING JA ESTA FECHADA pela aprovacao da secao 4? NAO: num
-- portao do MEIO a caixinha e marcada por quem fez o trabalho, e a aprovacao
-- do cliente nao a toca -- ela ja estava marcada. O que a aprovacao destravou
-- foi a TRAVA B da etapa seguinte.
select teste.cenario('A Social Media marca o briefing daquele post', :CARLA,
  format($q$update public.post_etapa_progresso set concluido = true
            where post_id = %L and subtask_id = (
              select id from public.etapas_do_mes(%L) where titulo = 'Briefing do mês')$q$,
    current_setting('t42.post1'), current_setting('t42.maio')), 'ok', 0);

do $$
begin
  update public.post_etapa_progresso set concluido = true
   where post_id = current_setting('t42.post1')::uuid
     and subtask_id = (select id from public.etapas_do_mes(
       current_setting('t42.maio')::uuid) where titulo = 'Briefing do mês');
end $$;

select teste.cenario('A Carla fecha a caixinha dela naquele post', :CARLA,
  format($q$update public.post_etapa_progresso set concluido = true
            where post_id = %L and subtask_id = %L$q$,
    current_setting('t42.post1'), current_setting('t42.prod')), 'ok', 1);

do $$
begin
  insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
  values ('post', current_setting('t42.post1')::uuid, 2, 'interna',
          '44444444-4444-4444-4444-444444444444', 'aprovada',
          '22222222-2222-2222-2222-222222222222');
end $$;

select teste.cenario('A gestao data o post', :DIEGO,
  format($q$update public.posts set data_publicacao = '2027-05-10' where id = %L$q$,
    current_setting('t42.post1')), 'ok', 1);

select teste.cenario('A gestao manda a peca pronta', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 2, 'cliente', %L, 'pendente')$fmt$,
    current_setting('t42.post1'), :DIEGO), 'ok', 1);

select teste.cenario('E a Joana pede ajustes', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
        and numero_rodada = 2),
    'ajustes_solicitados', 'Trocar a cor do fundo.')$fmt$,
    current_setting('t42.post1')), 'ok', 1);

select teste.conferir('Nao nasceu etapa de Ajustes nenhuma',
  (select count(*)::text from public.subtasks
    where task_id = current_setting('t42.maio')::uuid and titulo like 'Ajustes%'), '0');

select teste.conferir('A caixinha do ultimo elo de PRODUCAO desmarcou',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t42.post1')::uuid
      and subtask_id = current_setting('t42.prod')::uuid), 'false');

select teste.conferir('E o pedido ficou na observacao dela',
  (select observacao from public.post_etapa_progresso
    where post_id = current_setting('t42.post1')::uuid
      and subtask_id = current_setting('t42.prod')::uuid), 'Trocar a cor do fundo.');

-- E E DA CARLA QUE O AVISO SAIU, e nao de quem enviou: quem refaz a arte e
-- quem a fez (0045), e a pergunta e POSICIONAL.
select teste.conferir('E a Carla foi avisada, porque a etapa e dela',
  (select count(*)::text from public.notifications
    where user_id = :CARLA and titulo like 'O cliente pediu ajustes%'), '1');


-- ---------------------------------------------------------------------------
-- 6. A ORDEM E MES -> CONTA -> CASA
--
-- Quem escreveu no lugar mais especifico mandou -- a ordem de
-- `coalesce(etapa, padrao)` (0041) e de `etapas_resolvidas_do_workflow()`
-- (0064). Lendo a conta primeiro, trocar o padrao dela reescreveria a corrente
-- dos meses que estao correndo, e a frase do usuario e o contrario.
-- ---------------------------------------------------------------------------

select teste.conferir_como('O Atendimento abre novembro com o fluxo de tres avais', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-11',
           '[{"redes":["instagram"],"quantidade":2}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/fluxo-nov', %L)::text$q$,
         :FCLI, :FTRES),
  '2');

select teste.conferir('A demanda do mes guardou o fluxo escolhido',
  (select social_flow_id::text from public.tasks
    where client_id = :FCLI and social_do_mes = '2027-11-01'), :FTRES);

-- O FLUXO DO MES GANHA DO DA CONTA, e este e o cenario que cai se
-- `fluxo_do_post()` ler a conta primeiro: a conta aponta para o fluxo de
-- vocabulario proprio, e os posts de novembro nasceram com a corrente da casa.
select teste.conferir('As etapas do mes sairam da corrente DELE, nao a da conta',
  (select string_agg(titulo, ' > ' order by ordem)
     from public.etapas_do_mes((select id from public.tasks
                                 where client_id = :FCLI and social_do_mes = '2027-11-01'))),
  'Pauta > Conteúdo > Layout > Envio > Programar');

select teste.conferir('E `fluxo_do_post` responde o do mes',
  (select public.fluxo_do_post(p.id)::text
     from public.posts_do_mes((select id from public.tasks
                                where client_id = :FCLI and social_do_mes = '2027-11-01')) p
    limit 1),
  :FTRES);

-- E O POST AVULSO CAI NA CONTA, que e a verdade do que ele e: um post que
-- ninguem abriu dentro de um mes (0061).
insert into public.posts (id, client_id, tema, data_publicacao, plataformas,
                          midia, criado_por, responsavel_id)
values ('e0870000-0000-0000-0000-0000000000a9', :FCLI, 'Story avulso', '2027-05-20',
        '{instagram}', 'imagem', :ANA, :BRUNO);

select teste.conferir('O post avulso responde o fluxo da conta',
  (select public.fluxo_do_post('e0870000-0000-0000-0000-0000000000a9'::uuid)::text), :FNOMES);

-- E ELE NAO TEM ETAPA NENHUMA (0088): a corrente e do MES, e um post fora de
-- um mes aberto volta a se comportar como um post anterior a 0045.
select teste.conferir('Mas ele nao tem corrente nenhuma',
  coalesce((public.porta_do_cliente_no_post(
    'e0870000-0000-0000-0000-0000000000a9'::uuid)).titulo, '(nenhum)'), '(nenhum)');

-- ABRIR O MESMO MES EM DUAS VEZES USA A MESMA CORRENTE, e e para isso que
-- `tasks.social_flow_id` existe: sem ela a segunda chamada usaria o fluxo da
-- conta, e o mes ficaria com metade dos posts indo ao cliente por um caminho e
-- metade por outro.
select teste.conferir_como('A segunda chamada acrescenta posts ao mesmo mes', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-11',
           '[{"redes":["facebook"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, null, %L)::text$q$, :FCLI, :FNOMES),
  '1');

-- E AS ETAPAS NAO FORAM REFEITAS. Antes cada post novo ganhava uma corrente
-- nova, e a segunda chamada podia dar-lhe outra; agora as etapas existem, e o
-- terceiro post ganhou a CAIXINHA de cada uma das cinco que ja estavam la.
select teste.conferir('E o mes continua com as cinco etapas do fluxo pedido',
  (select string_agg(titulo, ' > ' order by ordem)
     from public.etapas_do_mes((select id from public.tasks
                                 where client_id = :FCLI and social_do_mes = '2027-11-01'))),
  'Pauta > Conteúdo > Layout > Envio > Programar');

select teste.conferir('E o terceiro post ganhou a caixinha das cinco',
  (select count(*)::text from public.post_etapa_progresso g
    where g.post_id = (select p.id from public.posts_do_mes(
                          (select id from public.tasks where client_id = :FCLI
                            and social_do_mes = '2027-11-01')) p
                        where p.plataformas = '{facebook}'::public.plataforma_social[]
                        limit 1)), '5');

select teste.conferir('O mes continua apontando para o fluxo original',
  (select social_flow_id::text from public.tasks
    where client_id = :FCLI and social_do_mes = '2027-11-01'), :FTRES);


-- ---------------------------------------------------------------------------
-- 7. ABRIR O MES PERGUNTA PELAS ETAPAS DO FLUXO, E A DICA NOMEIA AS DELE
--
-- Com a lista fixa das cinco escrita a mao na dica, a recusa mandaria a pessoa
-- procurar "Pauta" num fluxo que nao tem nenhuma.
-- ---------------------------------------------------------------------------

select teste.recusa_com_dica('O periodo de uma etapa que o fluxo nao tem, com a dica certa',
  :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2028-01',
           '[{"redes":["instagram"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb,
           '{"Pauta": {"inicio": "2027-12-01", "fim": "2027-12-05"}}'::jsonb,
           'https://drive.com/x', %L)$q$, :FCLI, :FNOMES),
  'Briefing do mês');

select teste.recusa_com('E a mensagem diz que o fluxo deste mes nao a tem', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2028-01',
           '[{"redes":["instagram"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb,
           '{"Pauta": {"inicio": "2027-12-01", "fim": "2027-12-05"}}'::jsonb,
           'https://drive.com/x', %L)$q$, :FCLI, :FNOMES),
  'não tem etapa chamada "Pauta"');

-- E A ORDEM DO FLUXO CONTINUA SENDO CONFERIDA PELO FIM (0084), com os nomes
-- dele na dica.
select teste.recusa_com_dica('A corrente nao vence de tras para a frente', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2028-02',
           '[{"redes":["instagram"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb,
           '{"Briefing do mês": {"fim": "2028-01-20"},
             "Produção de Layout": {"fim": "2028-01-10"}}'::jsonb,
           'https://drive.com/y', %L)$q$, :FCLI, :FNOMES),
  'A ordem deste fluxo é Briefing do mês, Produção de Layout');

-- FLUXO VAZIO NAO ABRE MES, e a recusa diz o que falta. A trava do gatilho o
-- deixa existir de proposito; o que ele nao pode e abrir um mes.
\set FVAZIO '''e0870000-0000-0000-0000-0000000000f3'''

select teste.conferir_como('Um fluxo nasce e os elos dele saem', :DIEGO,
  format($q$select (public.salvar_fluxo_de_social('Fluxo que vai ficar vazio',
      jsonb_build_array(
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega')),
      %L) = %L)::text$q$, :FVAZIO, :FVAZIO),
  'true');

select teste.cenario('Os elos dele sao apagados', :DIEGO,
  format($q$delete from public.social_flow_steps where flow_id = %L$q$, :FVAZIO),
  'passa');

select teste.recusa_com_dica('E ele nao abre mes nenhum', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2028-03',
           '[{"redes":["instagram"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/z', %L)$q$,
         :FCLI, :FVAZIO),
  'Monte a corrente dele antes de abrir o mês');


-- ---------------------------------------------------------------------------
-- 8. A CONVERSAO DE `social_aprovacoes`, E A COLUNA QUE SAIU
--
-- A decisao da 0023: a coluna sai, nao fica parada ao lado da nova. E a
-- CONVERSAO e a metade que importa -- sem ela, toda conta que combinou aprovar
-- a pauta perderia o portao no instante em que a migration fosse aplicada, e a
-- frase do contrato deixaria de valer sem ninguem ter decidido isso.
--
-- O CENARIO NAO DA PARA MONTAR AQUI, e vale dito em vez de escondido: a coluna
-- nao existe mais neste banco, entao nao ha como criar o estado de antes. O
-- que se mede e que ela SAIU e que a conversao DEIXOU rastro -- a Mundo Verde
-- do `_dados_de_teste.sql` nao tinha lista, entao quem prova a conversao e o
-- fluxo que o arquivo 39 monta e aponta.
-- ---------------------------------------------------------------------------

select teste.conferir('A coluna social_aprovacoes nao existe mais',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'client_flow_defaults'
      and column_name = 'social_aprovacoes'), '0');

select teste.conferir('E nem a funcao que dizia quais etapas davam para marcar',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'etapas_que_o_cliente_pode_aprovar'), '0');

-- `etapas_padrao_do_social()` SAIU TAMBEM, e nao virou apelido: duas funcoes
-- respondendo "qual e a corrente" sao o lugar onde as duas verdades comecam a
-- divergir, e a segunda seria a que alguem chama sem perceber que ela ignora o
-- fluxo da conta.
select teste.conferir('E nem a corrente fixa da 0045',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'etapas_padrao_do_social'), '0');


-- ---------------------------------------------------------------------------
-- 9. O PAPEL VIAJA DO ELO PARA A ETAPA DO MES
--
-- Sem a copia, todo mes aberto ficaria com as cinco etapas em `producao` -- e
-- `portoes_do_mes()`, que pergunta pelo papel, nao acharia portao nenhum: o
-- produto inteiro pararia de conseguir enviar material ao cliente, nos meses
-- que JA estao correndo.
--
-- ESTE BLOCO ESTA VIRADO DO AVESSO: ele media `post_etapas`, que a 0088
-- apagou. O que se mede e o mesmo fato um nivel acima -- a etapa do MES.
-- ---------------------------------------------------------------------------

select teste.conferir('Todo Envio materializado e entrega',
  (select count(*)::text from public.subtasks
    where social_papel is not null and titulo = 'Envio'
      and social_papel <> 'entrega'), '0');

select teste.conferir('Todo Programar e pos-entrega',
  (select count(*)::text from public.subtasks
    where social_papel is not null and titulo = 'Programar'
      and social_papel <> 'pos_entrega'), '0');

select teste.conferir('E toda Pauta enche o campo pauta',
  (select count(*)::text from public.subtasks
    where social_papel is not null and titulo = 'Pauta'
      and social_campo is distinct from 'pauta'), '0');

-- E TODO MES TEM EXATAMENTE UMA ENTREGA, que e a trava do fluxo (0087) vista
-- no material: um mes com duas entregas poria o cliente decidindo duas vezes a
-- mesma peca, e um sem nenhuma nunca a entregaria.
select teste.conferir('E todo mes aberto tem UMA entrega',
  (select count(*)::text from (
     select t.id, count(*) filter (where s.social_papel = 'entrega') as entregas
       from public.tasks t
       join public.subtasks s on s.task_id = t.id and s.social_papel is not null
      where t.social_do_mes is not null
      group by t.id
   ) x where x.entregas <> 1), '0');


-- ---------------------------------------------------------------------------
-- 10. O QUE QUEM PRODUZ NAO TROCA NA ETAPA
--
-- Policy nao limita coluna: sem o trigger, um PATCH no PostgREST diria que a
-- etapa dele E a entrega ao cliente -- e o portao do post passaria a ser ela.
-- ---------------------------------------------------------------------------

-- A TRAVA MUDOU DE TABELA COM O MODELO (0088): era
-- `post_etapas_regras`, e passou a ser `subtasks_protege_o_social` -- estreito
-- de proposito, so as tres colunas. A policy de `subtasks` deixa o dono da
-- etapa escrever nela, que e o certo e e como ele move o andamento; o que ele
-- nao decide e se a etapa dele E a entrega ao cliente.
select teste.recusa_com_dica('Quem produz nao troca o papel da etapa dele', :CARLA,
  format($q$update public.subtasks set social_papel = 'entrega' where id = %L$q$,
    current_setting('t42.prod')),
  'Social Media → Fluxos');

-- O VALOR AQUI E 'pauta' e nao 'legenda', e e o segundo achado da bateria: a
-- etapa ja enche a legenda neste fluxo, entao `new.social_campo is distinct
-- from old.social_campo` seria falso e o cenario passaria sem a trava ter sido
-- exercida -- um teste que afirma sem provar.
select teste.recusa_com('Nem o campo que ela enche', :CARLA,
  format($q$update public.subtasks set social_campo = 'pauta' where id = %L$q$,
    current_setting('t42.prod')),
  'é da gestão');

select teste.recusa_com('Nem liga o portao do cliente na etapa dela', :CARLA,
  format($q$update public.subtasks set social_portao = true where id = %L$q$,
    current_setting('t42.prod')),
  'é da gestão');

-- E A GESTAO TROCA, porque e ela quem decide. Sem este cenario, alguem poderia
-- travar as tres colunas para todo mundo e os tres de cima passariam.
select teste.cenario('E a gestao troca o campo da etapa', :DIEGO,
  format($q$update public.subtasks set social_campo = 'pauta' where id = %L$q$,
    current_setting('t42.prod')), 'ok', 1);

-- E O ANDAMENTO CONTINUA SENDO DELA, que e a metade que o gatilho estreito
-- preserva: travar `subtasks` inteira para quem produz fecharia a unica coisa
-- que ela faz na etapa. O `update` que o prova e o de `estimativa_minutos`, e
-- nao o de `status`: a etapa dela depende do briefing, que ainda nao foi
-- concluido, e `validar_transicao_de_subtarefa` (0007) recusaria sair de
-- `nao_iniciada` -- uma recusa certa, pela trava errada para o que se mede.
select teste.cenario('Mas o resto da etapa continua sendo dela', :CARLA,
  format($q$update public.subtasks set estimativa_minutos = 120 where id = %L$q$,
    current_setting('t42.prod')), 'ok', 1);


-- ---------------------------------------------------------------------------
-- 11. O FLUXO DA CASA PODE SAIR, E A VOLTA E O MAIS ANTIGO ATIVO
--
-- Uma agencia que montou os fluxos dela nao precisa carregar o padrao que veio
-- de fabrica. Nao havendo nenhum, quem recusa e `abrir_mes_de_social` com a
-- frase que diz o que falta -- `fluxo_padrao_da_casa()` devolver nulo e dizer
-- a verdade.
-- ---------------------------------------------------------------------------

select teste.cenario('O socio desativa o fluxo da casa', :ANA,
  format($q$update public.social_flows set ativo = false where id = %L$q$, :CASA),
  'passa');

select teste.conferir('A volta e um fluxo ativo, e nao nulo',
  (select (public.fluxo_padrao_da_casa() is not null)::text), 'true');

select teste.conferir('E ele nao e o da casa',
  (select (public.fluxo_padrao_da_casa() = :CASA)::text), 'false');

select teste.cenario('E ele volta', :ANA,
  format($q$update public.social_flows set ativo = true where id = %L$q$, :CASA),
  'passa');

select teste.conferir('O padrao da casa voltou a ser o da casa',
  (select public.fluxo_padrao_da_casa()::text), :CASA);
