-- ===========================================================================
-- Sprint 3L -- Full Academy (playbook, e-book, curso) e Recomendacoes
--
-- Ana e socia, Diego desenvolvedor (os dois sao `is_gestor()`), Carla, Bruno,
-- Marina e Rafael sao colaboradores, Joana e cliente. As funcoes vem de
-- `_dados_de_teste.sql` e importam aqui: Carla e Atendimento, Bruno e Design,
-- Marina e Social Media, Rafael e Trafego -- e e por elas que a
-- obrigatoriedade por FUNCAO tem o que medir.
--
-- As perguntas deste arquivo:
--
--   rascunho vaza, nem pela API?
--   uma versao que EXIGE releitura devolve a pendencia a quem ja confirmou?
--   e uma versao LEVE deixa quem confirmou em paz?
--   a anotacao pessoal e ilegivel por todos, INCLUSIVE o socio?
--   a busca acha um termo no meio do corpo de um playbook?
--   o obrigatorio sai da funcao, e o prazo conta da data de admissao?
--   o cliente alcanca qualquer coisa disto?
--
-- Cada cenario roda como uma PESSOA. Rodando como postgres tudo passaria --
-- superusuario ignora RLS, e nenhuma destas regras estaria provada.
--
--
-- O QUE ESTES CENARIOS ENCONTRARAM, e nao foi no que eles mediam
--
-- Rodando pela primeira vez, 41 cenarios reprovaram -- e 39 deles nao eram
-- deste arquivo. A 0096 apagou tres tabelas e deixou DUAS funcoes vivas lendo
-- elas, nenhuma no modulo Academy: `busca_global()` (a busca da topbar, em
-- toda tela do Painel) e `feedback_metricas()`. Quem consertou foi a 0097, e
-- o cabecalho dela conta o resto. Vale aqui porque e a razao de a bateria
-- existir: a verificacao de tipo, o lint e o build passam os tres com uma
-- funcao apontando para tabela apagada.
--
-- E os DOIS que sobraram eram deste arquivo, medindo o que o sprint pede:
-- `academy_vencidos()` e `security definer` e devolve o nome de toda a equipe
-- com o que cada um deve -- e estava ao alcance de `anon` e de
-- `authenticated`, porque `revoke all ... from public` nao alcanca o grant que
-- o `alter default privileges` do Supabase faz a papel nomeado. E a licao da
-- 0071 outra vez, e so aparece para quem mede o PRIVILEGIO em vez da mensagem
-- de recusa.
--
-- **Medido com tres mutacoes nos cenarios deste arquivo:** comparar a
-- releitura com a versao corrente derruba 1 (e e o "a leve nao cobra nada");
-- tirar o `distinct on (i.id)` de `academy_obrigatorios_de` derruba 1; abrir
-- a anotacao para a gestao derruba 3, e um deles e o socio.
--
--
-- O QUE ESTE ARQUIVO NAO CONSEGUE MEDIR, e fica escrito em vez de escondido
--
-- A CONVERSAO DO MODELO ANTIGO (0017 -> 0096). O `rodar.sh` carrega os dados
-- de teste logo depois da 0006, e `academy_tracks` nasce na 0017 -- onze
-- migrations adiante. Nao ha onde por uma trilha antiga para a 0096 converter:
-- quando este arquivo roda, ela ja rodou e as tres tabelas velhas sumiram. E a
-- mesma impossibilidade que a 0087 registrou para `social_aprovacoes`.
--
-- O que da para medir aqui e que elas SAIRAM, virado do avesso -- e esta na
-- secao final. A conversao propriamente dita foi conferida a mao, contra um
-- Postgres 16 com o modelo velho povoado com um material de cada um dos seis
-- tipos, e o resultado esta escrito no cabecalho da 0096.
-- ===========================================================================

\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set RAFAEL  '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

-- Os itens deste arquivo. A 0096 semeia dezoito playbooks e tres trilhas como
-- rascunho no PASSO 15, e eles ficam: os cenarios abaixo criam os seus com id
-- proprio e medem por id, nunca por contagem do acervo inteiro -- um cenario
-- que contasse `select count(*) from academy_items` passaria a falhar no dia
-- em que o acervo inicial ganhasse o decimo nono playbook.
\set PLAYBOOK  '''ac000001-0000-4000-8000-000000000001'''
\set EBOOK     '''ac000002-0000-4000-8000-000000000002'''
\set CURSO     '''ac000003-0000-4000-8000-000000000003'''
\set RASCUNHO  '''ac000004-0000-4000-8000-000000000004'''
\set VAZIO     '''ac000005-0000-4000-8000-000000000005'''
\set MODULO    '''ac00000a-0000-4000-8000-00000000000a'''
\set AULA1     '''ac00000b-0000-4000-8000-00000000000b'''
\set AULA2     '''ac00000c-0000-4000-8000-00000000000c'''
\set TRILHA    '''ac00000d-0000-4000-8000-00000000000d'''
\set TRILHAR   '''ac00000e-0000-4000-8000-00000000000e'''
\set DORASCUNHO '''ac00000f-0000-4000-8000-00000000000f'''

delete from public.recommendation_comments;
delete from public.recommendation_likes;
delete from public.recommendations;
delete from public.academy_anotacoes;
delete from public.academy_progresso;
delete from public.academy_trilha_itens;
delete from public.academy_trilhas;
delete from public.academy_obrigatorios;
delete from public.academy_playbook_versoes;
delete from public.academy_arquivos;
delete from public.academy_aulas;
delete from public.academy_modulos;
delete from public.academy_items;
delete from public.notifications;

-- ---------------------------------------------------------------------------
-- QUEM MONTA O ACERVO
-- ---------------------------------------------------------------------------

select teste.cenario('Colaborador NAO cria item no acervo', :CARLA,
  format($fmt$
    insert into public.academy_items (tipo, titulo, slug, autor_id)
    values ('playbook', 'Playbook da Carla', 'playbook-da-carla', %L)
  $fmt$, :CARLA), 'recusa');

select teste.cenario('Gestao cria o playbook', :DIEGO,
  format($fmt$
    insert into public.academy_items
      (id, tipo, titulo, slug, resumo, descricao, categoria, tags, autor_id, publicado)
    values (%L, 'playbook', 'Como abrir uma demanda', 'como-abrir-uma-demanda',
            'O caminho de um pedido ate o board da agencia.',
            'Quem abre, o que preencher e quem recebe.',
            'Producao', array['demanda','briefing'], %L, true)
  $fmt$, :PLAYBOOK, :DIEGO), 'ok', 1);

-- `autor_id` tem que ser quem esta criando. Sem o `with check`, daria para
-- assinar um playbook no nome de outra pessoa -- e o autor e quem alcanca o
-- proprio rascunho, entao assinar no nome de alguem e dar a ele a chave.
select teste.cenario('Gestao NAO assina item no nome de outro', :DIEGO,
  format($fmt$
    insert into public.academy_items (tipo, titulo, slug, autor_id)
    values ('playbook', 'Assinado pela Ana', 'assinado-pela-ana', %L)
  $fmt$, :ANA), 'recusa');

select teste.cenario('Gestao cria o e-book', :DIEGO,
  format($fmt$
    insert into public.academy_items (id, tipo, titulo, slug, resumo, categoria, autor_id, publicado)
    values (%L, 'ebook', 'A marca da casa', 'a-marca-da-casa',
            'O manual de marca em PDF.', 'Marca', %L, true)
  $fmt$, :EBOOK, :DIEGO), 'ok', 1);

select teste.cenario('Gestao cria o curso', :DIEGO,
  format($fmt$
    insert into public.academy_items (id, tipo, titulo, slug, resumo, categoria, autor_id, publicado)
    values (%L, 'curso', 'Trafego do zero', 'trafego-do-zero',
            'Dois modulos sobre midia paga.', 'Producao', %L, true)
  $fmt$, :CURSO, :DIEGO), 'ok', 1);

-- O SLUG E UNICO, e e ele que esta na URL de cada item. Dois playbooks com o
-- mesmo endereco fariam o segundo ser inalcancavel -- sem erro em lugar
-- nenhum, porque a tela abriria o primeiro.
select teste.cenario('Dois itens NAO dividem o mesmo slug', :DIEGO,
  format($fmt$
    insert into public.academy_items (tipo, titulo, slug, autor_id)
    values ('ebook', 'Outro com o mesmo endereco', 'como-abrir-uma-demanda', %L)
  $fmt$, :DIEGO), 'recusa');

-- ---------------------------------------------------------------------------
-- RASCUNHO NAO VAZA, NEM PELA API
--
-- O item nasce com `publicado = false`. Ate a gestao publicar, ele nao existe
-- para o resto da equipe -- e isso e RLS, nao filtro de consulta: um
-- `.eq("publicado", true)` esquecido numa tela nova vazaria o rascunho, e o
-- criterio de aceite do sprint manda medir VIA API, que e exatamente o que o
-- `select` cru abaixo faz.
-- ---------------------------------------------------------------------------

select teste.cenario('Gestao cria um playbook em rascunho', :DIEGO,
  format($fmt$
    insert into public.academy_items (id, tipo, titulo, slug, resumo, autor_id)
    values (%L, 'playbook', 'O que ninguem leu ainda', 'o-que-ninguem-leu-ainda',
            'Um rascunho com a palavra jabuticaba dentro.', %L)
  $fmt$, :RASCUNHO, :DIEGO), 'ok', 1);

select teste.cenario('O colaborador NAO enxerga o rascunho', :CARLA,
  format($fmt$select * from public.academy_items where id = %L$fmt$, :RASCUNHO),
  'recusa');

select teste.cenario('A gestao enxerga', :DIEGO,
  format($fmt$select * from public.academy_items where id = %L$fmt$, :RASCUNHO),
  'ok', 1);

select teste.cenario('O socio tambem', :ANA,
  format($fmt$select * from public.academy_items where id = %L$fmt$, :RASCUNHO),
  'ok', 1);

select teste.cenario('E o item publicado, esse o colaborador enxerga', :CARLA,
  format($fmt$select * from public.academy_items where id = %L$fmt$, :PLAYBOOK),
  'ok', 1);

-- O AUTOR REBAIXADO CONTINUA ENXERGANDO O PROPRIO RASCUNHO, e este e o unico
-- cenario que faz o terceiro ramo de `academy_items_select` existir.
--
-- `academy_items_insert` exige `is_gestor()`, entao um colaborador nunca NASCE
-- autor -- o `autor_id = auth.uid()` do select so tem a quem servir depois de
-- uma troca de perfil. Ela acontece: o desenvolvedor que escreveu o playbook
-- e passou a colaborador continua sendo o autor daquele texto, e esconder dele
-- o proprio rascunho seria apagar o trabalho dele da tela dele.
--
-- Sem este cenario aquele ramo e codigo que ninguem mede, e um `or` que nunca
-- dispara e um `or` que alguem tira achando que nao serve a ninguem.
update public.profiles set role = 'desenvolvedor' where id = '44444444-4444-4444-4444-444444444444';

select teste.cenario('Bruno (gestao por um instante) cria o rascunho dele', :BRUNO,
  format($fmt$
    insert into public.academy_items (id, tipo, titulo, slug, autor_id)
    values (%L, 'playbook', 'O rascunho do Bruno', 'o-rascunho-do-bruno', %L)
  $fmt$, :DORASCUNHO, :BRUNO), 'ok', 1);

update public.profiles set role = 'colaborador' where id = '44444444-4444-4444-4444-444444444444';

select teste.cenario('Rebaixado, Bruno continua enxergando o dele', :BRUNO,
  format($fmt$select * from public.academy_items where id = %L$fmt$, :DORASCUNHO),
  'ok', 1);

select teste.cenario('E a Carla continua sem enxergar', :CARLA,
  format($fmt$select * from public.academy_items where id = %L$fmt$, :DORASCUNHO),
  'recusa');

-- ---------------------------------------------------------------------------
-- O PLAYBOOK E VERSIONADO, E A RELEITURA COMPARA COM A ULTIMA QUE A EXIGIU
--
-- Esta e a secao que justifica o sprint. "Li e estou ciente" grava
-- `versao_confirmada`, e nao um booleano: "eu li" sem numero nao sobrevive a
-- uma versao nova -- e e justamente a versao nova que o modulo existe para
-- levar as pessoas.
--
-- E a comparacao e com `academy_versao_de_releitura()`, a ultima que EXIGIU
-- releitura, nunca com a corrente. Com a corrente, corrigir uma virgula
-- cobraria releitura de catorze pessoas, e na terceira vez ninguem mais clica.
-- ---------------------------------------------------------------------------

select teste.cenario('Colaborador NAO publica versao de playbook', :CARLA,
  format($fmt$
    insert into public.academy_playbook_versoes
      (item_id, numero_versao, conteudo_rico, conteudo_texto, publicado_por)
    values (%L, 1, '{}'::jsonb, 'texto da Carla', %L)
  $fmt$, :PLAYBOOK, :CARLA), 'recusa');

select teste.cenario('Gestao publica a v1', :DIEGO,
  format($fmt$
    insert into public.academy_playbook_versoes
      (item_id, numero_versao, conteudo_rico, conteudo_texto, notas_mudanca, publicado_por)
    values (%L, 1, '{"type":"doc"}'::jsonb,
            'Toda demanda nasce no Atendimento. Quem abre preenche o cliente, '
            'a pasta de entrega e o briefing, e so entao distribui as etapas. '
            'A palavra rinoceronte esta no meio deste paragrafo de proposito, '
            'para a busca ter o que achar longe do titulo.',
            'Primeira versao.', %L)
  $fmt$, :PLAYBOOK, :DIEGO), 'ok', 1);

select teste.conferir_como('A versao corrente e a 1', :CARLA,
  format($fmt$select public.academy_versao_corrente(%L)::text$fmt$, :PLAYBOOK), '1');

-- Sem nenhuma versao que exija releitura, a funcao devolve NULO -- e nao zero.
-- Zero seria um numero, e `v_confirmada < 0` nunca e verdade: o ramo pareceria
-- funcionar e a releitura nunca mais cobraria nada de ninguem.
select teste.conferir_como('E nenhuma versao exige releitura ainda', :CARLA,
  format($fmt$select coalesce(public.academy_versao_de_releitura(%L)::text, '(nulo)')$fmt$,
         :PLAYBOOK), '(nulo)');

select teste.conferir_como('Quem nao confirmou nada esta em nao_iniciado', :CARLA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :CARLA, :PLAYBOOK),
  'nao_iniciado');

select teste.cenario('Carla clica em "Li e estou ciente" na v1', :CARLA,
  format($fmt$
    insert into public.academy_progresso (user_id, item_id, versao_confirmada)
    values (%L, %L, 1)
  $fmt$, :CARLA, :PLAYBOOK), 'ok', 1);

select teste.conferir_como('E passa a estar concluido', :CARLA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :CARLA, :PLAYBOOK),
  'concluido');

-- A VERSAO LEVE NAO GERA PENDENCIA. E o criterio de aceite, e o contrario e o
-- que mataria a confirmacao de leitura: se toda publicacao cobrasse releitura,
-- a frase "Li e estou ciente" viraria um clique de reflexo.
select teste.cenario('Gestao publica a v2 LEVE', :DIEGO,
  format($fmt$
    insert into public.academy_playbook_versoes
      (item_id, numero_versao, conteudo_rico, conteudo_texto, notas_mudanca,
       exige_releitura, publicado_por)
    values (%L, 2, '{"type":"doc"}'::jsonb, 'Mesmo texto, uma virgula no lugar.',
            'Ajuste de pontuacao.', false, %L)
  $fmt$, :PLAYBOOK, :DIEGO), 'ok', 1);

select teste.conferir_como('A corrente virou 2', :CARLA,
  format($fmt$select public.academy_versao_corrente(%L)::text$fmt$, :PLAYBOOK), '2');

select teste.conferir_como('E a Carla CONTINUA concluida -- a leve nao cobra nada', :CARLA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :CARLA, :PLAYBOOK),
  'concluido');

-- A VERSAO QUE EXIGE RELEITURA DEVOLVE A PENDENCIA A QUEM JA CONFIRMOU. O
-- outro criterio de aceite, e o par do de cima: sem ele a gestao nao tem como
-- saber se o processo novo chegou as pessoas.
select teste.cenario('Gestao publica a v3, que EXIGE releitura', :DIEGO,
  format($fmt$
    insert into public.academy_playbook_versoes
      (item_id, numero_versao, conteudo_rico, conteudo_texto, notas_mudanca,
       exige_releitura, publicado_por)
    values (%L, 3, '{"type":"doc"}'::jsonb,
            'A pasta de entrega passou a ser obrigatoria na abertura.',
            'Mudou quem distribui as etapas.', true, %L)
  $fmt$, :PLAYBOOK, :DIEGO), 'ok', 1);

select teste.conferir_como('A releitura passou a ser a 3', :CARLA,
  format($fmt$select public.academy_versao_de_releitura(%L)::text$fmt$, :PLAYBOOK), '3');

select teste.conferir_como('E a Carla VOLTOU a dever leitura', :CARLA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :CARLA, :PLAYBOOK),
  'releitura');

select teste.cenario('Carla confirma a v3', :CARLA,
  format($fmt$
    update public.academy_progresso set versao_confirmada = 3
     where user_id = %L and item_id = %L and aula_id is null
  $fmt$, :CARLA, :PLAYBOOK), 'ok', 1);

select teste.conferir_como('E fica concluida de novo', :CARLA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :CARLA, :PLAYBOOK),
  'concluido');

select teste.conferir_como('Quem nunca confirmou segue em nao_iniciado', :MARINA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :MARINA, :PLAYBOOK),
  'nao_iniciado');

-- VERSAO FECHADA NUNCA E REESCRITA NEM APAGADA, e a trava e a AUSENCIA de
-- policy: `academy_playbook_versoes` tem select e insert, e mais nada. E a
-- mesma regra da rodada de aprovacao fechada -- o que a equipe confirmou ter
-- lido nao pode mudar de texto depois.
select teste.cenario('Nem a gestao reescreve uma versao publicada', :DIEGO,
  format($fmt$
    update public.academy_playbook_versoes set conteudo_texto = 'reescrito'
     where item_id = %L and numero_versao = 1
  $fmt$, :PLAYBOOK), 'recusa');

select teste.cenario('Nem o socio apaga uma versao publicada', :ANA,
  format($fmt$
    delete from public.academy_playbook_versoes where item_id = %L and numero_versao = 1
  $fmt$, :PLAYBOOK), 'recusa');

select teste.cenario('E o numero de versao nao se repete', :DIEGO,
  format($fmt$
    insert into public.academy_playbook_versoes
      (item_id, numero_versao, conteudo_rico, conteudo_texto, publicado_por)
    values (%L, 3, '{}'::jsonb, 'outra v3', %L)
  $fmt$, :PLAYBOOK, :DIEGO), 'recusa');

select teste.cenario('O colaborador NAO le a versao de um rascunho', :CARLA,
  format($fmt$
    select * from public.academy_playbook_versoes where item_id = %L
  $fmt$, :RASCUNHO), 'recusa');

-- ---------------------------------------------------------------------------
-- A ANOTACAO E PRIVADA, E E POR ISSO QUE ELA E TABELA PROPRIA
--
-- O sprint pede `academy_progresso.anotacoes` e, na linha seguinte, que ela
-- seja ilegivel "nem pelo gestor" -- testando VIA API. As duas coisas nao
-- cabem na mesma tabela, porque **policy nao limita coluna** e a gestao
-- PRECISA ler o progresso: a aba Acompanhamento existe por causa dela.
--
-- A 0017 tentou resolver com uma view sem a coluna, e o comentario dela mesma
-- admitia o furo. Aqui a linha fica FORA DO ALCANCE, e os cenarios abaixo
-- medem com o comando cru -- que e o que uma tela nova, um PATCH no PostgREST
-- ou um `select=texto` encontrariam.
-- ---------------------------------------------------------------------------

select teste.cenario('Carla anota no playbook', :CARLA,
  format($fmt$
    insert into public.academy_anotacoes (user_id, item_id, texto)
    values (%L, %L, 'Nao entendi a parte da pasta de entrega.')
  $fmt$, :CARLA, :PLAYBOOK), 'ok', 1);

select teste.cenario('Carla le a propria', :CARLA,
  format($fmt$select texto from public.academy_anotacoes where user_id = %L$fmt$, :CARLA),
  'ok', 1);

select teste.cenario('O colega NAO le a anotacao da Carla', :BRUNO,
  format($fmt$select texto from public.academy_anotacoes where user_id = %L$fmt$, :CARLA),
  'recusa');

select teste.cenario('A gestao NAO le a anotacao da Carla', :DIEGO,
  format($fmt$select texto from public.academy_anotacoes where user_id = %L$fmt$, :CARLA),
  'recusa');

-- O criterio de aceite escrito no sprint, palavra por palavra: *"nao sao
-- legiveis por ninguem, nem pelo socio"*.
select teste.cenario('E O SOCIO TAMBEM NAO', :ANA,
  format($fmt$select texto from public.academy_anotacoes where user_id = %L$fmt$, :CARLA),
  'recusa');

select teste.cenario('Ninguem anota no nome de outra pessoa', :BRUNO,
  format($fmt$
    insert into public.academy_anotacoes (user_id, item_id, texto)
    values (%L, %L, 'escrito pelo Bruno')
  $fmt$, :CARLA, :PLAYBOOK), 'recusa');

select teste.cenario('Carla reescreve a dela', :CARLA,
  format($fmt$
    update public.academy_anotacoes set texto = 'Entendi depois da v3.'
     where user_id = %L and item_id = %L
  $fmt$, :CARLA, :PLAYBOOK), 'ok', 1);

select teste.cenario('E o socio nao apaga a anotacao de ninguem', :ANA,
  format($fmt$delete from public.academy_anotacoes where user_id = %L$fmt$, :CARLA),
  'recusa');

-- OS DOIS CENARIOS VIRADOS DO AVESSO: se alguem devolver a anotacao para
-- dentro do progresso, o primeiro falha e diz qual. Eles medem o SCHEMA e nao
-- uma policy, porque a decisao deste sprint foi estrutural -- a unica forma
-- de a promessa valer e a coluna nao existir onde a gestao le.
select teste.conferir('A anotacao NAO e coluna de academy_progresso',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'academy_progresso'
      and column_name in ('anotacoes', 'anotacao')),
  '0');

select teste.conferir('E a view que admitia o furo nao existe mais',
  (select count(*)::text from information_schema.views
    where table_schema = 'public' and table_name = 'academy_progresso_da_equipe'),
  '0');

-- ---------------------------------------------------------------------------
-- O PROGRESSO: A PESSOA ESCREVE, A GESTAO LE
--
-- A assimetria e o modulo inteiro. Sem a gestao lendo, nao ha Acompanhamento;
-- sem a pessoa sendo a unica que escreve, o progresso deixa de dizer o que ela
-- viu e passa a dizer o que alguem marcou por ela.
-- ---------------------------------------------------------------------------

select teste.cenario('Marina marca o e-book como lido', :MARINA,
  format($fmt$
    insert into public.academy_progresso (user_id, item_id, concluido)
    values (%L, %L, true)
  $fmt$, :MARINA, :EBOOK), 'ok', 1);

select teste.conferir('E o banco carimba a data, nao a tela',
  (select (concluido_em is not null)::text from public.academy_progresso
    where user_id = '55555555-5555-5555-5555-555555555555'
      and item_id = 'ac000002-0000-4000-8000-000000000002' and aula_id is null),
  'true');

select teste.conferir_como('O estado do e-book e concluido', :MARINA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :MARINA, :EBOOK),
  'concluido');

-- Desmarcar limpa a data: uma conclusao desfeita que guardasse a data diria
-- que a pessoa leu num dia em que ela mesma afirmou que nao leu.
select teste.cenario('Marina desmarca', :MARINA,
  format($fmt$
    update public.academy_progresso set concluido = false
     where user_id = %L and item_id = %L and aula_id is null
  $fmt$, :MARINA, :EBOOK), 'ok', 1);

select teste.conferir('E a data sai junto',
  (select (concluido_em is null)::text from public.academy_progresso
    where user_id = '55555555-5555-5555-5555-555555555555'
      and item_id = 'ac000002-0000-4000-8000-000000000002' and aula_id is null),
  'true');

select teste.cenario('Ninguem marca progresso no nome de outro', :BRUNO,
  format($fmt$
    insert into public.academy_progresso (user_id, item_id, concluido)
    values (%L, %L, true)
  $fmt$, :MARINA, :CURSO), 'recusa');

select teste.cenario('A GESTAO LE o progresso da equipe', :DIEGO,
  format($fmt$select * from public.academy_progresso where user_id = %L$fmt$, :MARINA),
  'ok', 1);

select teste.cenario('O colega NAO le o progresso de outro colega', :BRUNO,
  format($fmt$select * from public.academy_progresso where user_id = %L$fmt$, :MARINA),
  'recusa');

-- ---------------------------------------------------------------------------
-- O CURSO: O ESTADO SAI DAS AULAS, E CURSO SEM AULA NAO NASCE CONCLUIDO
-- ---------------------------------------------------------------------------

select teste.cenario('Gestao monta o modulo', :DIEGO,
  format($fmt$
    insert into public.academy_modulos (id, item_id, titulo, ordem)
    values (%L, %L, 'Fundamentos', 0)
  $fmt$, :MODULO, :CURSO), 'ok', 1);

select teste.cenario('Colaborador NAO acrescenta aula', :CARLA,
  format($fmt$
    insert into public.academy_aulas (modulo_id, titulo, tipo)
    values (%L, 'Aula da Carla', 'texto')
  $fmt$, :MODULO), 'recusa');

select teste.cenario('Gestao acrescenta as duas aulas', :DIEGO,
  format($fmt$
    insert into public.academy_aulas (id, modulo_id, titulo, tipo, duracao_minutos, ordem)
    values (%L, %L, 'O que e CPM', 'video', 12, 0),
           (%L, %L, 'Montando o primeiro conjunto', 'texto', 20, 1)
  $fmt$, :AULA1, :MODULO, :AULA2, :MODULO), 'ok', 2);

select teste.cenario('O colaborador LE as aulas do curso publicado', :CARLA,
  format($fmt$
    select a.* from public.academy_aulas a
      join public.academy_modulos m on m.id = a.modulo_id
     where m.item_id = %L
  $fmt$, :CURSO), 'ok', 2);

select teste.conferir_como('Com nenhuma aula vista, o curso e nao_iniciado', :CARLA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :CARLA, :CURSO),
  'nao_iniciado');

select teste.cenario('Carla ve a primeira aula', :CARLA,
  format($fmt$
    insert into public.academy_progresso (user_id, item_id, aula_id, concluido)
    values (%L, %L, %L, true)
  $fmt$, :CARLA, :CURSO, :AULA1), 'ok', 1);

select teste.conferir_como('Uma de duas e em_andamento', :CARLA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :CARLA, :CURSO),
  'em_andamento');

select teste.cenario('Carla ve a segunda', :CARLA,
  format($fmt$
    insert into public.academy_progresso (user_id, item_id, aula_id, concluido)
    values (%L, %L, %L, true)
  $fmt$, :CARLA, :CURSO, :AULA2), 'ok', 1);

select teste.conferir_como('Duas de duas e concluido', :CARLA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :CARLA, :CURSO),
  'concluido');

-- CURSO SEM AULA NENHUMA NAO NASCE CONCLUIDO.
--
-- *E o que ele NAO consegue separar, e fica dito:* a funcao tem duas guardas
-- em sequencia -- `v_total = 0` e depois `v_vistas = 0` --, e a segunda cobre
-- o mesmo caso. Tirar a primeira NAO derruba este cenario: zero aulas vistas
-- cai na segunda e devolve `nao_iniciado` do mesmo jeito. A afirmacao sobre o
-- produto esta certa; a guarda de cima e redundante, e isso e melhor escrito
-- aqui do que medido com um numero que nao mede nada.
select teste.cenario('Gestao cria um curso ainda sem aula', :DIEGO,
  format($fmt$
    insert into public.academy_items (id, tipo, titulo, slug, autor_id, publicado)
    values (%L, 'curso', 'Curso que vai nascer', 'curso-que-vai-nascer', %L, true)
  $fmt$, :VAZIO, :DIEGO), 'ok', 1);

select teste.conferir_como('E ele NAO aparece como concluido', :CARLA,
  format($fmt$select public.academy_estado_do_item(%L, %L)$fmt$, :CARLA, :VAZIO),
  'nao_iniciado');

-- E a aula de um RASCUNHO nao vaza. A policy da aula nao olha `publicado`
-- direto: ela pergunta ao modulo, que pergunta ao item -- e sem esse `exists`
-- a lista de aulas de um playbook em rascunho sairia inteira para a equipe.
select teste.cenario('Gestao monta um modulo dentro do rascunho', :DIEGO,
  format($fmt$
    insert into public.academy_modulos (item_id, titulo) values (%L, 'Escondido')
  $fmt$, :RASCUNHO), 'ok', 1);

select teste.cenario('O colaborador NAO le o modulo do rascunho', :CARLA,
  format($fmt$select * from public.academy_modulos where item_id = %L$fmt$, :RASCUNHO),
  'recusa');

-- ---------------------------------------------------------------------------
-- A BUSCA: PLAYBOOK QUE NINGUEM ACHA NAO EXISTE
--
-- Duas coisas sao medidas, e elas sao diferentes. A primeira e que o termo e
-- achado no MEIO do corpo da versao, e nao so no titulo -- e o criterio de
-- aceite do sprint. A segunda e que a busca NAO devolve rascunho para quem
-- nao e gestao: ela passa pela RLS como qualquer outra leitura, e um
-- `security definer` aqui entregaria o acervo inteiro.
--
-- O `academy_texto_do_item()` existe porque `array_to_string` e STABLE e nao
-- IMMUTABLE, e expressao de indice exige immutable. A primeira versao da 0096
-- foi recusada por isso.
-- ---------------------------------------------------------------------------

select teste.conferir_como('A busca acha um termo do RESUMO', :CARLA,
  $$select count(*)::text from public.academy_items
     where to_tsvector('portuguese',
             public.academy_texto_do_item(titulo, resumo, descricao, tags))
           @@ plainto_tsquery('portuguese', 'board')$$,
  '1');

select teste.conferir_como('E um termo que so esta nas TAGS', :CARLA,
  $$select count(*)::text from public.academy_items
     where to_tsvector('portuguese',
             public.academy_texto_do_item(titulo, resumo, descricao, tags))
           @@ plainto_tsquery('portuguese', 'briefing')$$,
  '1');

select teste.conferir_como('E o termo NO MEIO DO CORPO da versao', :CARLA,
  $$select count(*)::text from public.academy_playbook_versoes
     where to_tsvector('portuguese', coalesce(conteudo_texto, ''))
           @@ plainto_tsquery('portuguese', 'rinoceronte')$$,
  '1');

-- O rascunho carrega a palavra "jabuticaba" no resumo. Para a Carla a busca
-- devolve zero; para a gestao, um. E a MESMA consulta -- o que muda e quem
-- pergunta, que e o ponto de a busca nao ser `security definer`.
select teste.conferir_como('A busca NAO entrega o rascunho ao colaborador', :CARLA,
  $$select count(*)::text from public.academy_items
     where to_tsvector('portuguese',
             public.academy_texto_do_item(titulo, resumo, descricao, tags))
           @@ plainto_tsquery('portuguese', 'jabuticaba')$$,
  '0');

select teste.conferir_como('E entrega para a gestao', :DIEGO,
  $$select count(*)::text from public.academy_items
     where to_tsvector('portuguese',
             public.academy_texto_do_item(titulo, resumo, descricao, tags))
           @@ plainto_tsquery('portuguese', 'jabuticaba')$$,
  '1');

-- ---------------------------------------------------------------------------
-- O OBRIGATORIO E DERIVADO: A REGRA MAIS A FICHA DA PESSOA
--
-- Nao existe tabela pessoa x item, e e a decisao do cabecalho da 0096: ela
-- precisaria ser reescrita por cinco caminhos para continuar verdadeira. A
-- consequencia boa e que "cadastrar alguem novo monta a lista da funcao dela"
-- vale sem trigger nenhum -- a lista E a pergunta.
--
-- Carla e Atendimento, Bruno e Design. E a ficha de todo mundo tem
-- `data_admissao` de catorze meses atras (`_dados_de_teste.sql`), entao um
-- prazo de 30 dias apos a admissao esta no PASSADO -- que e o que da a este
-- arquivo um vencido de verdade para medir.
-- ---------------------------------------------------------------------------

select teste.cenario('Colaborador NAO cria regra de obrigatoriedade', :CARLA,
  format($fmt$
    insert into public.academy_obrigatorios (item_id, funcao) values (%L, 'Design')
  $fmt$, :PLAYBOOK), 'recusa');

select teste.cenario('Gestao torna o e-book obrigatorio para Design, em 30 dias', :DIEGO,
  format($fmt$
    insert into public.academy_obrigatorios (item_id, funcao, prazo_dias_apos_admissao)
    values (%L, 'Design', 30)
  $fmt$, :EBOOK), 'ok', 1);

select teste.conferir_como('Bruno (Design) deve o e-book', :BRUNO,
  format($fmt$
    select count(*)::text from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :BRUNO, :EBOOK), '1');

select teste.conferir_como('E a Carla (Atendimento) nao deve', :CARLA,
  format($fmt$
    select count(*)::text from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :CARLA, :EBOOK), '0');

-- O PRAZO CONTA DA DATA DE ADMISSAO, e nao da data da regra. Uma regra criada
-- hoje com 30 dias nao da 30 dias a quem entrou ha um ano -- ela diz que
-- aquela pessoa devia ter lido no primeiro mes dela.
select teste.conferir('O prazo e admissao + 30 dias',
  (select (prazo = (select data_admissao + 30 from public.team_members
                     where user_id = '44444444-4444-4444-4444-444444444444'))::text
     from public.academy_obrigatorios_de('44444444-4444-4444-4444-444444444444')
    where item_id = 'ac000002-0000-4000-8000-000000000002'),
  'true');

select teste.conferir_como('E ele esta vencido, porque o Bruno nao leu', :BRUNO,
  format($fmt$
    select vencido::text from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :BRUNO, :EBOOK), 'true');

-- CONCLUIDO DEPOIS DO PRAZO NAO FICA VERMELHO PARA SEMPRE. Sem esta metade, a
-- aba Acompanhamento acumularia pendencia resolvida -- e uma lista que so
-- cresce e uma lista que ninguem abre.
select teste.cenario('Bruno le o e-book, fora do prazo', :BRUNO,
  format($fmt$
    insert into public.academy_progresso (user_id, item_id, concluido)
    values (%L, %L, true)
  $fmt$, :BRUNO, :EBOOK), 'ok', 1);

select teste.conferir_como('E ele deixa de estar vencido', :BRUNO,
  format($fmt$
    select vencido::text from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :BRUNO, :EBOOK), 'false');

select teste.conferir_como('Mas continua na lista, agora concluido', :BRUNO,
  format($fmt$
    select estado from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :BRUNO, :EBOOK), 'concluido');

-- REGRA SEM FUNCAO VALE PARA TODO MUNDO. E o que `obrigatoria = true` da 0017
-- queria dizer, e e como a conversao da 0096 a traduziu.
select teste.cenario('Gestao torna o playbook obrigatorio para a agencia inteira', :DIEGO,
  format($fmt$
    insert into public.academy_obrigatorios (item_id, prazo_dias_apos_admissao)
    values (%L, 400)
  $fmt$, :PLAYBOOK), 'ok', 1);

select teste.conferir_como('A Marina deve o playbook', :MARINA,
  format($fmt$
    select count(*)::text from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :MARINA, :PLAYBOOK), '1');

-- UMA LINHA POR ITEM, E VALE O PRAZO MAIS APERTADO.
--
-- O playbook passa a ser obrigatorio por DUAS regras para a Marina: a da
-- agencia inteira (400 dias) e a de Social Media (10 dias). Sem o
-- `distinct on (i.id)` ela apareceria duas vezes na tela dela -- e o
-- `order by` sozinho nao deduplica nada, o que foi um bug desta funcao antes
-- de a 0096 ser aplicada.
select teste.cenario('E tambem obrigatorio para Social Media, em 10 dias', :DIEGO,
  format($fmt$
    insert into public.academy_obrigatorios (item_id, funcao, prazo_dias_apos_admissao)
    values (%L, 'Social Media', 10)
  $fmt$, :PLAYBOOK), 'ok', 1);

select teste.conferir_como('A Marina ve UMA linha, nao duas', :MARINA,
  format($fmt$
    select count(*)::text from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :MARINA, :PLAYBOOK), '1');

-- E ELE VAI POR `conferir_como` E NAO POR `conferir`, e a razao saiu do teste
-- de mutacao desta mesma regra. `teste.conferir` avalia a expressao FORA do
-- auxiliar, como argumento: tirando o `distinct on`, a subconsulta devolve duas
-- linhas, o Postgres estoura *more than one row returned by a subquery* e leva
-- o ARQUIVO INTEIRO junto -- os cenarios abaixo deste nem rodam, e a proxima
-- mutacao se esconderia atras dessa queda.
--
-- **O QUE ELE PASSA A MEDIR DEPOIS DA TROCA E MENOS, e isso e dito em vez de
-- escondido:** `conferir_como` faz `execute ... into`, e `into` sem `strict`
-- pega a PRIMEIRA linha calada. Entao com a duplicacao ele continua passando --
-- a primeira linha e a do prazo mais apertado. Quem mede a deduplicacao e a
-- contagem logo acima, e e so ela; este confere o prazo, que e outra pergunta.
-- Medido: a mutacao derruba um cenario, e e o de cima.
select teste.conferir_como('E o prazo e o mais apertado dos dois', :MARINA,
  format($fmt$
    select (prazo = (select data_admissao + 10 from public.team_members
                      where user_id = %L))::text
      from public.academy_obrigatorios_de(%L)
     where item_id = %L
  $fmt$, :MARINA, :MARINA, :PLAYBOOK), 'true');

-- ITEM NAO PUBLICADO NAO E OBRIGATORIO DE NINGUEM. A 0096 semeia dezoito
-- playbooks como rascunho de proposito -- *"nao publicar item sem conteudo
-- apenas para preencher o acervo"* --, e sem o `where i.publicado` a primeira
-- pessoa a abrir a tela leria dezoito pendencias de paginas em branco.
select teste.cenario('Gestao torna o RASCUNHO obrigatorio', :DIEGO,
  format($fmt$insert into public.academy_obrigatorios (item_id) values (%L)$fmt$,
         :RASCUNHO), 'ok', 1);

select teste.conferir_como('E ele nao cobra nada de ninguem', :CARLA,
  format($fmt$
    select count(*)::text from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :CARLA, :RASCUNHO), '0');

-- SEM DATA DE ADMISSAO NAO HA PRAZO, E O ITEM CONTINUA OBRIGATORIO.
--
-- Contar de `created_at` da ficha seria inventar uma data de entrada, e o
-- prazo que ela produz venceria sem ninguem entender por que. O que NAO pode
-- acontecer e o item sair da lista: a leitura continua devida, ela e que nao
-- tem data.
--
-- O `update` abaixo e desfeito tres linhas adiante, de proposito: `Rafael`
-- aparece em seis arquivos depois deste, e um fixture que mexe no contrato de
-- alguem e nao devolve e conveniencia ocupando o lugar do cenario -- a licao
-- do `responsavel_atendimento_id` do arquivo 15.
update public.team_members set data_admissao = null
 where user_id = '66666666-6666-6666-6666-666666666666';

select teste.conferir_como('Sem admissao, o playbook continua obrigatorio', :RAFAEL,
  format($fmt$
    select count(*)::text from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :RAFAEL, :PLAYBOOK), '1');

select teste.conferir_como('Mas sem prazo, e portanto sem vencido', :RAFAEL,
  format($fmt$
    select coalesce(prazo::text, '(nulo)') || '/' || vencido::text
      from public.academy_obrigatorios_de(%L) where item_id = %L
  $fmt$, :RAFAEL, :PLAYBOOK), '(nulo)/false');

update public.team_members set data_admissao = current_date - interval '14 months'
 where user_id = '66666666-6666-6666-6666-666666666666';

select teste.conferir('E a data do Rafael voltou',
  (select (data_admissao is not null)::text from public.team_members
    where user_id = '66666666-6666-6666-6666-666666666666'),
  'true');

-- ---------------------------------------------------------------------------
-- O ACOMPANHAMENTO E DA GESTAO, E A RECUSA VEM DO BANCO
--
-- A recusa chega como ERRO e nao como lista vazia, e a diferenca e tudo: "voce
-- nao pode" contra "ninguem deve nada". Por isso a frase faz parte do que se
-- verifica -- uma trava que recusasse pelo motivo errado passaria por um
-- cenario que so olha se houve excecao.
-- ---------------------------------------------------------------------------

select teste.recusa_com('O colaborador NAO abre o Acompanhamento', :CARLA,
  $$select * from public.academy_acompanhamento()$$,
  'Apenas a gestao acompanha');

select teste.recusa_com('Nem o cliente', :JOANA,
  $$select * from public.academy_acompanhamento()$$,
  'Apenas a gestao acompanha');

select teste.cenario('A gestao abre', :DIEGO,
  $$select * from public.academy_acompanhamento()$$, 'ok');

select teste.conferir_como('E o socio tambem', :ANA,
  $$select (count(*) > 0)::text from public.academy_acompanhamento()$$, 'true');

-- QUEM SAIU DA AGENCIA NAO DEVE LEITURA NENHUMA. Deixa-lo na tabela encheria
-- a aba de pendencias que ninguem vai resolver -- a mesma razao pela qual
-- `notificar()` nao avisa quem foi desligado. O desligamento e desfeito logo
-- abaixo, pela razao da data do Rafael.
select teste.conferir_como('A Marina esta no Acompanhamento', :DIEGO,
  format($fmt$
    select (count(*) > 0)::text from public.academy_acompanhamento() where user_id = %L
  $fmt$, :MARINA), 'true');

update public.profiles set ativo = false where id = '55555555-5555-5555-5555-555555555555';

select teste.conferir_como('Desligada, ela sai', :DIEGO,
  format($fmt$
    select count(*)::text from public.academy_acompanhamento() where user_id = %L
  $fmt$, :MARINA), '0');

update public.profiles set ativo = true where id = '55555555-5555-5555-5555-555555555555';

select teste.conferir('E a Marina voltou a ativa',
  (select ativo::text from public.profiles
    where id = '55555555-5555-5555-5555-555555555555'),
  'true');

-- ---------------------------------------------------------------------------
-- A LISTA DE VENCIDOS E A PORTA DA ROTINA, E SO DELA
--
-- `academy_vencidos()` e `security definer` porque quem a chama e o `pg_cron`,
-- que roda como `service_role` e nao e `is_gestor()`. O `revoke all from
-- public` da 0096 e o que impede que ela vire a porta que devolve a lista de
-- pendencias da equipe para quem tiver a chave anon.
--
-- E a bateria mede o PRIVILEGIO e nao a mensagem: uma funcao pode recusar por
-- dentro e continuar executavel, e ai o que se mediu foi o corpo dela e nao a
-- porta. E a distincao da 0071, e e por isso que `teste.como_a_rotina` existe
-- -- usar `teste.cenario` aqui pediria de volta o `execute` que a 0096 tirou.
-- ---------------------------------------------------------------------------

select teste.cenario('Nem a gestao chama academy_vencidos()', :DIEGO,
  $$select * from public.academy_vencidos()$$, 'recusa');

select teste.cenario('Nem o socio', :ANA,
  $$select * from public.academy_vencidos()$$, 'recusa');

select teste.como_a_rotina('A rotina chama, e e a unica que chama',
  $$select * from public.academy_vencidos()$$, 'ok');

-- ---------------------------------------------------------------------------
-- A TRILHA
--
-- Ela agrupa itens numa ordem -- "o que ler no primeiro mes" --, e segue a
-- regra do item: rascunho e da gestao, publicada e de todo mundo.
-- ---------------------------------------------------------------------------

select teste.cenario('Colaborador NAO cria trilha', :CARLA,
  $$insert into public.academy_trilhas (nome) values ('A trilha da Carla')$$,
  'recusa');

select teste.cenario('Gestao cria a trilha publicada', :DIEGO,
  format($fmt$
    insert into public.academy_trilhas (id, nome, descricao, funcao, publicada)
    values (%L, 'Primeiros 30 dias', 'O que ler ao chegar.', null, true)
  $fmt$, :TRILHA), 'ok', 1);

select teste.cenario('E uma em rascunho', :DIEGO,
  format($fmt$
    insert into public.academy_trilhas (id, nome, publicada)
    values (%L, 'Trilha que nao saiu', false)
  $fmt$, :TRILHAR), 'ok', 1);

select teste.cenario('O colaborador le a publicada', :CARLA,
  format($fmt$select * from public.academy_trilhas where id = %L$fmt$, :TRILHA),
  'ok', 1);

select teste.cenario('E NAO le a em rascunho', :CARLA,
  format($fmt$select * from public.academy_trilhas where id = %L$fmt$, :TRILHAR),
  'recusa');

select teste.cenario('Gestao monta a sequencia', :DIEGO,
  format($fmt$
    insert into public.academy_trilha_itens (trilha_id, item_id, ordem)
    values (%L, %L, 0), (%L, %L, 1)
  $fmt$, :TRILHA, :PLAYBOOK, :TRILHA, :EBOOK), 'ok', 2);

select teste.cenario('O mesmo item nao entra duas vezes na trilha', :DIEGO,
  format($fmt$
    insert into public.academy_trilha_itens (trilha_id, item_id) values (%L, %L)
  $fmt$, :TRILHA, :PLAYBOOK), 'recusa');

select teste.cenario('O colaborador le a sequencia da trilha publicada', :CARLA,
  format($fmt$select * from public.academy_trilha_itens where trilha_id = %L$fmt$, :TRILHA),
  'ok', 2);

-- O item da trilha segue a TRILHA, e nao o item. Sem o `exists` na policy, a
-- sequencia de uma trilha em rascunho sairia inteira para a equipe -- e e ela
-- que revela o que a gestao esta montando.
select teste.cenario('Gestao poe um item na trilha em rascunho', :DIEGO,
  format($fmt$
    insert into public.academy_trilha_itens (trilha_id, item_id) values (%L, %L)
  $fmt$, :TRILHAR, :PLAYBOOK), 'ok', 1);

select teste.cenario('E o colaborador NAO le essa sequencia', :CARLA,
  format($fmt$select * from public.academy_trilha_itens where trilha_id = %L$fmt$, :TRILHAR),
  'recusa');

select teste.cenario('Colaborador NAO monta sequencia', :CARLA,
  format($fmt$
    insert into public.academy_trilha_itens (trilha_id, item_id) values (%L, %L)
  $fmt$, :TRILHA, :CURSO), 'recusa');

-- ---------------------------------------------------------------------------
-- O CLIENTE NAO ALCANCA NADA DISTO
--
-- As dez tabelas, uma a uma. O Academy nao abre para o Portal do Cliente, e a
-- trava e a RLS -- nao a ausencia de rota: `(interno)` e uma pasta, e uma
-- pasta nao recusa um POST no PostgREST.
-- ---------------------------------------------------------------------------

select teste.cenario('Cliente nao le academy_items', :JOANA,
  $$select * from public.academy_items$$, 'recusa');
select teste.cenario('Cliente nao le academy_playbook_versoes', :JOANA,
  $$select * from public.academy_playbook_versoes$$, 'recusa');
select teste.cenario('Cliente nao le academy_arquivos', :JOANA,
  $$select * from public.academy_arquivos$$, 'recusa');
select teste.cenario('Cliente nao le academy_modulos', :JOANA,
  $$select * from public.academy_modulos$$, 'recusa');
select teste.cenario('Cliente nao le academy_aulas', :JOANA,
  $$select * from public.academy_aulas$$, 'recusa');
select teste.cenario('Cliente nao le academy_progresso', :JOANA,
  $$select * from public.academy_progresso$$, 'recusa');
select teste.cenario('Cliente nao le academy_anotacoes', :JOANA,
  $$select * from public.academy_anotacoes$$, 'recusa');
select teste.cenario('Cliente nao le academy_obrigatorios', :JOANA,
  $$select * from public.academy_obrigatorios$$, 'recusa');
select teste.cenario('Cliente nao le academy_trilhas', :JOANA,
  $$select * from public.academy_trilhas$$, 'recusa');
select teste.cenario('Cliente nao le academy_trilha_itens', :JOANA,
  $$select * from public.academy_trilha_itens$$, 'recusa');

select teste.cenario('E nao escreve progresso nem no nome dele', :JOANA,
  format($fmt$
    insert into public.academy_progresso (user_id, item_id, concluido)
    values (%L, %L, true)
  $fmt$, :JOANA, :PLAYBOOK), 'recusa');

-- ---------------------------------------------------------------------------
-- OS DOIS BUCKETS SAO PRIVADOS
--
-- `academy-arquivos` guarda o PDF do e-book e `academy-capas` guarda a capa de
-- cada item. Nenhum dos dois e publico: material que a agencia produz e dela,
-- e um bucket publico poe o manual de marca num endereco que qualquer pessoa
-- com o link abre, para sempre.
-- ---------------------------------------------------------------------------

select teste.conferir('Os dois buckets do Academy existem e sao privados',
  (select count(*)::text from storage.buckets
    where id in ('academy-arquivos', 'academy-capas') and not public),
  '2');

select teste.cenario('A equipe LE o arquivo do acervo', :CARLA,
  $$select * from storage.objects where bucket_id = 'academy-arquivos'$$, 'ok');

select teste.cenario('O colaborador NAO sobe arquivo no acervo', :CARLA,
  $$insert into storage.objects (bucket_id, name, owner)
    values ('academy-arquivos', 'manual.pdf', null)$$, 'recusa');

select teste.cenario('A gestao sobe', :DIEGO,
  $$insert into storage.objects (bucket_id, name, owner)
    values ('academy-arquivos', 'manual-da-marca.pdf', null)$$, 'ok', 1);

select teste.cenario('O cliente nao alcanca o bucket', :JOANA,
  $$select * from storage.objects where bucket_id = 'academy-arquivos'$$, 'recusa');

select teste.cenario('E o colaborador NAO apaga o que a gestao subiu', :CARLA,
  $$delete from storage.objects
     where bucket_id = 'academy-arquivos' and name = 'manual-da-marca.pdf'$$, 'recusa');

-- ---------------------------------------------------------------------------
-- O MODELO ANTIGO SAIU, VIRADO DO AVESSO
--
-- A conversao nao da para medir aqui -- o cabecalho deste arquivo diz por que.
-- O que da e conferir que as tres tabelas da 0017 e a view que admitia o furo
-- da anotacao sumiram: se alguem as ressuscitar, estes cenarios falham e dizem
-- qual. E a mesma forma dos cenarios de `user_skills` logo abaixo.
-- ---------------------------------------------------------------------------

select teste.conferir('As tres tabelas do Academy antigo nao existem mais',
  (select count(*)::text from information_schema.tables
    where table_schema = 'public'
      and table_name in ('academy_tracks', 'academy_materials', 'academy_progress')),
  '0');

select teste.conferir('E as dez tabelas novas estao todas de pe',
  (select count(*)::text from information_schema.tables
    where table_schema = 'public' and table_name in
      ('academy_items', 'academy_playbook_versoes', 'academy_arquivos',
       'academy_modulos', 'academy_aulas', 'academy_progresso',
       'academy_anotacoes', 'academy_obrigatorios', 'academy_trilhas',
       'academy_trilha_itens')),
  '10');

-- E TODA TABELA `academy_` TEM RLS LIGADA. Uma tabela nova sem RLS e legivel
-- por qualquer pessoa com a chave anon -- e essa chave vai no bundle que o
-- navegador baixa. O numero esta escrito e nao derivado da lista acima de
-- proposito: um cenario que contasse "todas as que achou" passaria num banco
-- onde metade nao existe.
--
-- **O NUMERO SUBIU DE 10 PARA 12 NA 0102**, e e o cenario fazendo o trabalho
-- dele: ele reprovou no dia em que `academy_ebook_capitulos` e
-- `academy_ebook_checklists` nasceram, e so voltou a passar depois de alguem
-- conferir que as duas tem RLS. E por isso que ele conta pelo PREFIXO e nao
-- pela lista nominal de cima: a lista so sabe das que alguem lembrou de
-- escrever nela, e o prefixo pega a decima terceira.
select teste.conferir('E toda tabela do acervo tem RLS ligada',
  (select count(*)::text from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity
      and c.relname like 'academy\_%'),
  '12');

-- ---------------------------------------------------------------------------
-- A ETIQUETA DO MATERIAL SAIU COM O MATERIAL; O CATALOGO FICA
--
-- Ate a 0043 havia aqui "Recomendadas para voce": as trilhas cujos materiais
-- tocavam uma skill que a pessoa marcou como `quer_desenvolver`. A tabela que
-- guardava essa marca saiu do produto com o Meu Desenvolvimento, e a vitrine
-- saiu junto -- sem a origem do sinal nao ha o que recomendar.
--
-- E A 0096 LEVOU A ULTIMA LEITORA DO CATALOGO. `academy_materials.skill_id`
-- era o unico caminho que ligava `skills` a alguma coisa; com aquela tabela
-- fora, `skills` passa a ser um catalogo que nada le e nada escreve. Pela
-- regra da 0023 isso se apaga -- e apagar um catalogo que o usuario mandou
-- guardar nao e decisao de uma migration de outro assunto. Fica registrado
-- aqui para ser decidido, e nao para ser esquecido.
--
-- Os cenarios abaixo sao os de antes VIRADOS DO AVESSO: se alguem ressuscitar
-- `user_skills`, o primeiro falha e diz qual.
-- ---------------------------------------------------------------------------

select teste.conferir('A tabela da autoavaliacao nao existe mais',
  (select count(*)::text from information_schema.tables
    where table_schema = 'public' and table_name in ('user_skills', 'skill_avaliacoes')),
  '0');

select teste.conferir('E o catalogo de etiquetas continua de pe',
  (select count(*)::text from information_schema.tables
    where table_schema = 'public' and table_name = 'skills'),
  '1');

-- A SUGESTAO DE SKILL SAIU JUNTO, e e a parte que passa batida: o catalogo
-- tinha dois caminhos de entrada, e o segundo -- qualquer pessoa da equipe
-- sugerindo -- tinha a fila de aprovacao em Meu Desenvolvimento. Sem aquela
-- tela, a policy oferecia um caminho que nao existe.
select teste.cenario('O colaborador nao cria skill no catalogo', :BRUNO,
  $$insert into public.skills (nome, categoria) values ('Sugerida a mao', 'Design')$$,
  'recusa');

select teste.cenario('A gestao cria', :DIEGO,
  $$insert into public.skills (nome, categoria) values ('Criada pela gestao', 'Design')$$,
  'ok', 1);

-- ---------------------------------------------------------------------------
-- O FEED
-- ---------------------------------------------------------------------------

select teste.cenario('Colaborador posta uma recomendacao', :CARLA,
  format($fmt$
    insert into public.recommendations (id, autor_id, categoria, titulo, descricao, url, tags)
    values ('c1c1c1c1-0000-0000-0000-00000000000a', %L, 'ferramenta',
            'Figma Slides', 'Serve para apresentacao de campanha.',
            'https://figma.com/slides', array['Design', ' figma ', 'FIGMA', ''])
  $fmt$, :CARLA), 'ok', 1);

-- Tag e etiqueta, nao frase. Sem normalizar, "Figma", "figma" e " figma "
-- virariam tres nuvens diferentes na mesma tela.
select teste.conferir('As tags sao normalizadas e deduplicadas',
  (select array_to_string(array(select unnest(tags) order by 1), ',')
     from public.recommendations where id = 'c1c1c1c1-0000-0000-0000-00000000000a'),
  'design,figma');

select teste.cenario('Ninguem posta no nome de outra pessoa', :BRUNO,
  format($fmt$
    insert into public.recommendations (autor_id, categoria, titulo)
    values (%L, 'livro', 'Assinado pela Carla')
  $fmt$, :CARLA), 'recusa');

select teste.cenario('O cliente NAO ve o feed', :JOANA,
  $$select 1 from public.recommendations$$, 'recusa');

-- --- Editar e apagar --------------------------------------------------------

select teste.cenario('O autor edita o proprio post', :CARLA,
  $$update public.recommendations set descricao = 'Editado pela autora.'
     where id = 'c1c1c1c1-0000-0000-0000-00000000000a'$$, 'ok', 1);

select teste.cenario('Colaborador NAO edita o post de outro', :BRUNO,
  $$update public.recommendations set titulo = 'Sequestrado'
     where id = 'c1c1c1c1-0000-0000-0000-00000000000a'$$, 'recusa');

-- A gestao MODERA APAGANDO, nao reescrevendo: um gestor que edita o texto de
-- outra pessoa deixa no feed uma frase assinada por quem nao a escreveu.
select teste.cenario('Nem a gestao edita o post de outro', :ANA,
  $$update public.recommendations set titulo = 'Moderado na marra'
     where id = 'c1c1c1c1-0000-0000-0000-00000000000a'$$, 'recusa');

select teste.cenario('Colaborador NAO apaga o post de outro', :BRUNO,
  $$delete from public.recommendations
     where id = 'c1c1c1c1-0000-0000-0000-00000000000a'$$, 'recusa');

-- --- Curtidas ---------------------------------------------------------------

select teste.cenario('Bruno curte o post da Carla', :BRUNO,
  format($fmt$
    insert into public.recommendation_likes (recommendation_id, user_id)
    values ('c1c1c1c1-0000-0000-0000-00000000000a', %L)
  $fmt$, :BRUNO), 'ok', 1);

select teste.cenario('A mesma pessoa nao curte duas vezes', :BRUNO,
  format($fmt$
    insert into public.recommendation_likes (recommendation_id, user_id)
    values ('c1c1c1c1-0000-0000-0000-00000000000a', %L)
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Ninguem curte no nome de outra pessoa', :BRUNO,
  format($fmt$
    insert into public.recommendation_likes (recommendation_id, user_id)
    values ('c1c1c1c1-0000-0000-0000-00000000000a', %L)
  $fmt$, :MARINA), 'recusa');

-- Moderar e sobre o que foi publicado, nao sobre quem gostou.
select teste.cenario('Nem a gestao tira a curtida de outra pessoa', :ANA,
  format($fmt$
    delete from public.recommendation_likes
     where recommendation_id = 'c1c1c1c1-0000-0000-0000-00000000000a' and user_id = %L
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Descurtir e apagar a propria curtida', :BRUNO,
  format($fmt$
    delete from public.recommendation_likes
     where recommendation_id = 'c1c1c1c1-0000-0000-0000-00000000000a' and user_id = %L
  $fmt$, :BRUNO), 'ok', 1);

-- --- O sino -----------------------------------------------------------------

select teste.cenario('Bruno curte de novo, para o aviso nascer', :BRUNO,
  format($fmt$
    insert into public.recommendation_likes (recommendation_id, user_id)
    values ('c1c1c1c1-0000-0000-0000-00000000000a', %L)
  $fmt$, :BRUNO), 'ok', 1);

select teste.conferir('A curtida avisa a autora',
  (select titulo from public.notifications
    where user_id = '33333333-3333-3333-3333-333333333333' and tipo = 'recomendacao'
    order by created_at desc limit 1),
  'Bruno Alves curtiu sua recomendacao');

-- O sino e para o que os OUTROS fizeram. `notificar()` ja recusa avisar quem
-- causou o aviso, e este cenario e a prova de que a regra vale aqui tambem.
select teste.cenario('A autora curte o proprio post', :CARLA,
  format($fmt$
    insert into public.recommendation_likes (recommendation_id, user_id)
    values ('c1c1c1c1-0000-0000-0000-00000000000a', %L)
  $fmt$, :CARLA), 'ok', 1);

-- A afirmacao certa nao e "a Carla tem N avisos" -- ela tem dois, do Bruno,
-- que curtiu, descurtiu e curtiu de novo, e os dois sao legitimos. E que
-- NENHUM aviso tem a mesma pessoa nos dois lados.
select teste.conferir('Nenhum aviso tem quem causou e quem recebe na mesma pessoa',
  (select count(*)::text from public.notifications where user_id = origem_id),
  '0');

-- --- Comentarios ------------------------------------------------------------

select teste.cenario('Marina comenta', :MARINA,
  format($fmt$
    insert into public.recommendation_comments (id, recommendation_id, autor_id, texto)
    values ('d1d1d1d1-0000-0000-0000-00000000000a',
            'c1c1c1c1-0000-0000-0000-00000000000a', %L, 'Uso todo dia.')
  $fmt$, :MARINA), 'ok', 1);

select teste.conferir('O comentario avisa a autora do post',
  (select titulo from public.notifications
    where user_id = '33333333-3333-3333-3333-333333333333' and tipo = 'recomendacao'
    order by created_at desc limit 1),
  'Marina Costa comentou sua recomendacao');

-- Responder avisa QUEM ESCREVEU O COMENTARIO, nao o dono do post: quem
-- responde esta falando com aquela pessoa. Sem isso, uma conversa de cinco
-- respostas encheria o sino de quem so postou o link.
select teste.cenario('Bruno responde a Marina', :BRUNO,
  format($fmt$
    insert into public.recommendation_comments
      (recommendation_id, autor_id, texto, resposta_a)
    values ('c1c1c1c1-0000-0000-0000-00000000000a', %L, 'Tambem uso.',
            'd1d1d1d1-0000-0000-0000-00000000000a')
  $fmt$, :BRUNO), 'ok', 1);

select teste.conferir('A resposta avisa quem foi respondido, nao o dono do post',
  (select titulo from public.notifications
    where user_id = '55555555-5555-5555-5555-555555555555' and tipo = 'recomendacao'
    order by created_at desc limit 1),
  'Bruno Alves respondeu voce');

-- A thread tem UM nivel. Resposta a resposta viraria arvore sem fundo num feed.
select teste.recusa_com('Resposta a resposta e recusada', :MARINA,
  format($fmt$
    insert into public.recommendation_comments
      (recommendation_id, autor_id, texto, resposta_a)
    values ('c1c1c1c1-0000-0000-0000-00000000000a', %L, 'E eu tambem.',
            (select id from public.recommendation_comments
              where resposta_a is not null limit 1))
  $fmt$, :MARINA), 'um nivel so');

select teste.cenario('Colaborador NAO apaga o comentario de outro', :BRUNO,
  $$delete from public.recommendation_comments
     where id = 'd1d1d1d1-0000-0000-0000-00000000000a'$$, 'recusa');

-- Aqui a gestao APAGA, sim: e o que moderacao quer dizer.
select teste.cenario('A gestao apaga o comentario de outro, para moderar', :ANA,
  $$delete from public.recommendation_comments
     where id = 'd1d1d1d1-0000-0000-0000-00000000000a'$$, 'ok', 1);

select teste.cenario('A gestao apaga o post de outro, para moderar', :ANA,
  $$delete from public.recommendations
     where id = 'c1c1c1c1-0000-0000-0000-00000000000a'$$, 'ok', 1);

-- --- O cliente, de novo, nas outras portas ----------------------------------

select teste.cenario('O cliente NAO ve curtidas', :JOANA,
  $$select 1 from public.recommendation_likes$$, 'recusa');

select teste.cenario('O cliente NAO ve comentarios', :JOANA,
  $$select 1 from public.recommendation_comments$$, 'recusa');

select teste.cenario('O cliente NAO posta no feed', :JOANA,
  format($fmt$
    insert into public.recommendations (autor_id, categoria, titulo)
    values (%L, 'outro', 'Oi')
  $fmt$, :JOANA), 'recusa');
-- ===========================================================================
-- O BUCKET DAS CAPAS (0067)
--
-- A capa de uma recomendacao e baixada pelo servidor e guardada aqui, porque
-- o CSP recusa `<img>` de qualquer host de fora. O que estes cenarios provam
-- nao e o download -- isso e `npm run check:preview`, em JavaScript -- e sim
-- QUEM alcanca o arquivo depois que ele existe.
--
-- E a bateria alcanca isso porque `_fixture_supabase.sql` finge
-- `storage.objects` com RLS ligada e `storage.foldername()`. Sem os cenarios,
-- a unica conferencia das tres policies seria olhar o SQL -- e "a pasta e de
-- quem indica" e exatamente do tipo que nao se responde de olho: sem o recorte
-- da pasta, `is_staff()` sozinho deixaria qualquer pessoa da equipe
-- sobrescrever a capa da recomendacao de outra, e a troca passaria calada,
-- porque o endereco gravado continua o mesmo.
-- ===========================================================================

delete from storage.objects where bucket_id = 'recomendacoes-capas';

select teste.cenario('Quem indica grava a capa na pasta dela', :CARLA,
  format($fmt$
    insert into storage.objects (bucket_id, name)
    values ('recomendacoes-capas', %L)
  $fmt$, :CARLA || '/capa-1.jpg'), 'ok');

-- A TROCA SILENCIOSA: Bruno e da equipe e passa em `is_staff()`. O que o
-- recusa e a pasta, e mais nada.
select teste.cenario('Colaborador NAO grava na pasta de outro', :BRUNO,
  format($fmt$
    insert into storage.objects (bucket_id, name)
    values ('recomendacoes-capas', %L)
  $fmt$, :CARLA || '/capa-2.jpg'), 'recusa');

-- E nem o socio: quem sobe a capa e quem indica. A gestao MODERA APAGANDO,
-- que e a regra do proprio feed -- ela nao reescreve o que outra pessoa pos.
select teste.cenario('Nem o socio grava na pasta de outro', :ANA,
  format($fmt$
    insert into storage.objects (bucket_id, name)
    values ('recomendacoes-capas', %L)
  $fmt$, :CARLA || '/capa-3.jpg'), 'recusa');

-- A EQUIPE INTEIRA LE, e nao so quem postou: o feed e de todo mundo, e uma
-- capa que so o autor enxerga seria uma moldura quebrada para os outros oito.
select teste.conferir_como('Bruno enxerga a capa que a Carla subiu', :BRUNO,
  $$select count(*)::text from storage.objects
     where bucket_id = 'recomendacoes-capas'$$, '1');

-- O CLIENTE NAO ALCANCA NADA DISTO, como nas seis tabelas do modulo: as
-- Recomendacoes nao abrem para o Portal.
select teste.conferir_como('O cliente nao enxerga capa nenhuma', :JOANA,
  $$select count(*)::text from storage.objects
     where bucket_id = 'recomendacoes-capas'$$, '0');

select teste.cenario('O cliente NAO grava no bucket das capas', :JOANA,
  format($fmt$
    insert into storage.objects (bucket_id, name)
    values ('recomendacoes-capas', %L)
  $fmt$, :JOANA || '/capa.jpg'), 'recusa');

select teste.cenario('Quem pos apaga a dela', :CARLA,
  format($fmt$
    delete from storage.objects
     where bucket_id = 'recomendacoes-capas' and name = %L
  $fmt$, :CARLA || '/capa-1.jpg'), 'ok');

-- E a gestao apaga a de qualquer um, que e a outra metade de "moderar e
-- apagar".
insert into storage.objects (bucket_id, name)
values ('recomendacoes-capas', :CARLA || '/capa-4.jpg');

select teste.cenario('A gestao apaga a capa de outra pessoa', :DIEGO,
  format($fmt$
    delete from storage.objects
     where bucket_id = 'recomendacoes-capas' and name = %L
  $fmt$, :CARLA || '/capa-4.jpg'), 'ok');

-- NAO HA POLICY DE UPDATE, e a ausencia e a regra: trocar o arquivo por baixo
-- de um endereco ja gravado e trocar a imagem sem deixar rastro. Nem a dona
-- dele consegue -- o caminho e gravar outro e apontar a recomendacao para la.
insert into storage.objects (bucket_id, name)
values ('recomendacoes-capas', :CARLA || '/capa-5.jpg');

select teste.cenario('Ninguem reescreve o arquivo, nem quem o pos', :CARLA,
  format($fmt$
    update storage.objects set name = %L
     where bucket_id = 'recomendacoes-capas' and name = %L
  $fmt$, :CARLA || '/outra.jpg', :CARLA || '/capa-5.jpg'), 'recusa');
