\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set RAFAEL  '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

-- ===========================================================================
-- 44 - O TOUR DE PRIMEIRO ACESSO (0101)
--
-- Sprint 3M. O banco guarda UMA coisa: por onde cada pessoa passou. Os passos
-- moram no codigo, porque eles sao interface e versionam junto com a tela.
--
-- ---------------------------------------------------------------------------
-- O QUE ESTE ARQUIVO EXISTE PARA MEDIR sao tres coisas, e nenhuma delas
-- aparece na tela de ninguem quando quebra:
--
--   1. AS DUAS DATAS SAO DO TRIGGER. A pessoa escreve a propria linha a cada
--      passo que avanca -- e policy nao limita coluna. Sem os dois ramos do
--      `case`, avancar um passo moveria a data de conclusao de uma linha ja
--      encerrada, e refazer o tour nao recomecaria a passada. Nenhuma das duas
--      estoura: as duas dao uma data plausivel e errada, que e o modo de falha
--      desta casa.
--
--   2. AS DUAS LISTAS DE PASSOS PULADOS SAO FATOS OPOSTOS. `passos_pulados` e
--      a ESCOLHA de quem fez o tour; `passos_sem_ancora` e o DEFEITO -- o
--      elemento nao apareceu em dois segundos e o tour seguiu em silencio.
--      Numa coluna so, o alarme de tour quebrado contaria quem clicou em
--      "pular", e o numero ficaria alto e sem significado.
--
--   3. O ACOMPANHAMENTO DEVOLVE LINHA PARA QUEM NUNCA COMECOU. *"Saber quem
--      ainda nao se ambientou"* e, quase sempre, alguem que nao tem linha
--      nenhuma nesta tabela -- e um `select` em `tour_progresso` seria cego
--      justamente para essa pessoa. A lista vazia ali leria como "todo mundo
--      esta em dia".
-- ===========================================================================

delete from public.tour_progresso;


-- --- 1. A linha nasce, e ela e de quem a escreveu --------------------------

select teste.cenario('A Carla abre o proprio progresso do tour do painel', :CARLA,
  format($fmt$insert into public.tour_progresso (user_id, tour_id)
     values (%L, 'painel')$fmt$, :CARLA), 'ok', 1);

select teste.conferir('Ela nasce em andamento, no passo zero',
  (select status || '/' || passo_atual from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  'em_andamento/0');

select teste.conferir('E sem data de fim -- o tour nao terminou',
  (select coalesce(finalizado_em::text, 'nulo') from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  'nulo');

-- `not null default '{}'` NAS DUAS, e nao nulo: array nulo ao lado de array
-- vazio sao dois jeitos de dizer "nenhum", e a 0048 ja pagou o preco de o
-- vazio significar duas coisas.
select teste.conferir('As duas listas nascem vazias, e nao nulas',
  (select (passos_pulados = '{}' and passos_sem_ancora = '{}')::text
     from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  'true');

select teste.cenario('Ninguem abre o progresso no nome de outra pessoa', :CARLA,
  format($fmt$insert into public.tour_progresso (user_id, tour_id)
     values (%L, 'painel')$fmt$, :MARINA), 'recusa');

-- MOVER A PROPRIA LINHA PARA O NOME DE OUTRA E RECUSADO, e sem isso o
-- acompanhamento passaria a dizer que a Marina fez um tour que ela nao fez.
--
-- QUEM RECUSA AQUI E O `using`, e nao o `with check` -- e eu havia escrito o
-- contrario na 0101. Num policy de UPDATE o Postgres usa a expressao do
-- `using` tambem como check quando o `with check` nao existe, entao tirar a
-- segunda linha da policy nao derruba este cenario nem nenhum outro. O zero
-- esta no cabecalho da migration, e e ele que prova a frase.
select teste.cenario('E ninguem move a propria linha para o nome de outra', :CARLA,
  format($fmt$update public.tour_progresso set user_id = %L
     where user_id = %L and tour_id = 'painel'$fmt$, :MARINA, :CARLA), 'recusa');

select teste.cenario('A Carla le o proprio progresso', :CARLA,
  format($fmt$select * from public.tour_progresso where user_id = %L$fmt$,
    :CARLA), 'ok', 1);

select teste.cenario('A Marina nao le o da Carla', :MARINA,
  format($fmt$select * from public.tour_progresso where user_id = %L$fmt$,
    :CARLA), 'recusa');

select teste.conferir_como('A gestao le o de todos -- e o acompanhamento depende disso', :DIEGO,
  $$select count(*)::text from public.tour_progresso$$, '1');

-- SEM POLICY DE DELETE, nem para o socio. Refazer e um UPDATE que volta o
-- status; apagar a linha apagaria o registro de que a pessoa passou por ali.
-- Sem policy nenhuma o `delete` nao estoura: ele acha zero linhas, que e a
-- recusa que a RLS da.
select teste.cenario('A pessoa nao apaga o proprio progresso', :CARLA,
  format($fmt$delete from public.tour_progresso where user_id = %L$fmt$,
    :CARLA), 'recusa');

select teste.cenario('Nem o socio apaga', :ANA,
  $$delete from public.tour_progresso$$, 'recusa');

select teste.cenario('Uma linha por pessoa por tour', :CARLA,
  format($fmt$insert into public.tour_progresso (user_id, tour_id)
     values (%L, 'painel')$fmt$, :CARLA), 'recusa');

-- ENUM E NAO `text`, ao contrario do que o sprint escreve. E a decisao de
-- `midia` na 0042: o que a tela desenha por cima precisa ser um nome que o
-- compilador confere -- a mesma palavra com acento entraria calada num `text`,
-- e a pessoa ficaria com o tour pela metade para sempre.
select teste.cenario('A mesma palavra com acento nao entra no status', :CARLA,
  format($fmt$update public.tour_progresso set status = 'concluído'
     where user_id = %L and tour_id = 'painel'$fmt$, :CARLA), 'recusa');


-- --- 2. As duas datas sao consequencia do status ---------------------------

select set_config('t44.inicio',
  (select iniciado_em::text from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'), false);

-- AVANCAR UM PASSO E UM UPDATE COM `em_andamento`, e o `old.status is distinct
-- from new.status` e o que impede a data de inicio de voltar a cada clique em
-- Proximo. Sem ele, "comecou ha 3 segundos" seria o que o acompanhamento
-- mostraria de quem esta no tour desde ontem.
select teste.cenario('A Carla avanca tres passos, e escreve a data de fim a mao', :CARLA,
  format($fmt$update public.tour_progresso
     set passo_atual = 3, finalizado_em = '2020-01-01'
   where user_id = %L and tour_id = 'painel'$fmt$, :CARLA), 'ok', 1);

select teste.conferir('Avancar nao move a data de inicio',
  (select iniciado_em::text from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  current_setting('t44.inicio'));

-- O TRIGGER E DONO DA COLUNA, e descarta o que vier no pedido: um PATCH
-- montado a mao poria "terminado em 2020" numa linha que diz "em andamento" --
-- tres fatos sobre a mesma linha, dois deles errados.
select teste.conferir('E a data de fim escrita a mao e descartada',
  (select coalesce(finalizado_em::text, 'nulo') from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  'nulo');

select teste.cenario('Ela conclui o tour', :CARLA,
  format($fmt$update public.tour_progresso set status = 'concluido'
     where user_id = %L and tour_id = 'painel'$fmt$, :CARLA), 'ok', 1);

select teste.conferir('E agora a data de fim existe',
  (select (finalizado_em is not null)::text from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  'true');

select set_config('t44.fim',
  (select coalesce(finalizado_em::text, 'nulo') from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'), false);

-- O RAMO QUE MAIS IMPORTA: o status nao mudou, entao a data fica onde estava.
-- Sem a linha `when tg_op = 'UPDATE' and old.status = new.status`, qualquer
-- escrita numa linha ja encerrada -- e a tela escreve a cada passo -- moveria
-- a conclusao para hoje. O relatorio de "em quanto tempo a equipe se
-- ambientou" passaria a medir o ultimo clique de cada um.
select teste.cenario('Ela mexe na linha ja encerrada', :CARLA,
  format($fmt$update public.tour_progresso set passo_atual = 7
     where user_id = %L and tour_id = 'painel'$fmt$, :CARLA), 'ok', 1);

select teste.conferir('E a data de conclusao nao andou',
  (select coalesce(finalizado_em::text, 'nulo') from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  current_setting('t44.fim'));

select teste.cenario('Nem escrevendo outra data a mao', :CARLA,
  format($fmt$update public.tour_progresso set finalizado_em = '2020-01-01'
     where user_id = %L and tour_id = 'painel'$fmt$, :CARLA), 'ok', 1);

select teste.conferir('A data continua sendo a que o trigger carimbou',
  (select coalesce(finalizado_em::text, 'nulo') from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  current_setting('t44.fim'));

-- REFAZER O TOUR e a TRANSICAO de volta para `em_andamento`, e ela recomeca a
-- passada: a data de inicio volta a agora e a de fim volta a nula. O par passa
-- a descrever a passada CORRENTE, que e o que o acompanhamento pergunta.
select teste.cenario('A Carla refaz o tour', :CARLA,
  format($fmt$update public.tour_progresso
     set status = 'em_andamento', passo_atual = 0
   where user_id = %L and tour_id = 'painel'$fmt$, :CARLA), 'ok', 1);

select teste.conferir('A data de fim voltou a ser nula',
  (select coalesce(finalizado_em::text, 'nulo') from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  'nulo');

select teste.conferir('E a passada recomecou: a data de inicio e outra',
  (select (iniciado_em > current_setting('t44.inicio')::timestamptz)::text
     from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  'true');

-- `pulado` TAMBEM ENCERRA. "Pular por agora" nao e o mesmo que concluir, e os
-- dois sao estados finais da passada -- a diferenca mora no status, e nao em
-- haver ou nao data.
select teste.cenario('Ela pula o micro-tour do Full Days', :CARLA,
  format($fmt$insert into public.tour_progresso (user_id, tour_id, status)
     values (%L, 'full-days', 'pulado')$fmt$, :CARLA), 'ok', 1);

select teste.conferir('E pular carimba a data igual a concluir',
  (select (finalizado_em is not null)::text from public.tour_progresso
    where user_id = :CARLA and tour_id = 'full-days'),
  'true');


-- --- 3. As duas listas de passos pulados sao colunas diferentes ------------
--
-- E A SECAO QUE O SPRINT NAO SABE QUE PEDE DUAS VEZES: *"deixe Pular este
-- passo disponivel"* e *"mostre os passos pulados por elemento ausente,
-- agregados -- e o alarme de tour quebrado"*. A primeira frase e escolha, a
-- segunda e defeito.

select teste.cenario('A Carla pula um passo, e dois outros nao acharam o elemento', :CARLA,
  format($fmt$update public.tour_progresso
     set passo_atual = 2,
         passos_pulados    = array['nova-task'],
         passos_sem_ancora = array['menu-lateral', 'sino']
   where user_id = %L and tour_id = 'painel'$fmt$, :CARLA), 'ok', 1);

-- UMA COLUNA SO DARIA 3 NOS DOIS LADOS. A escolha continua sendo uma, e o
-- alarme continua sendo dois -- e e o segundo numero que manda alguem
-- consertar um seletor que envelheceu junto com a tela.
select teste.conferir('A escolha conta uma, e o alarme conta duas',
  (select array_length(passos_pulados, 1) || '/' || array_length(passos_sem_ancora, 1)
     from public.tour_progresso
    where user_id = :CARLA and tour_id = 'painel'),
  '1/2');

-- `versao` E O CONVITE PARA REVER, E ELE E DERIVADO: "quem concluiu a versao
-- anterior" e `status = 'concluido' and versao < <a de hoje>`, e a de hoje
-- mora no codigo, ao lado dos passos. O banco guarda a versao e nao decide
-- nada com ela -- uma segunda coluna dizendo "precisa rever" envelheceria
-- sozinha no dia em que alguem subisse o numero.
select teste.cenario('O Diego concluiu o tour do painel na versao 1', :DIEGO,
  format($fmt$insert into public.tour_progresso (user_id, tour_id, versao, status)
     values (%L, 'painel', 1, 'concluido')$fmt$, :DIEGO), 'ok', 1);

select teste.conferir('E nada no banco o convida a rever -- a comparacao e da tela',
  (select versao || '/' || status from public.tour_progresso
    where user_id = :DIEGO and tour_id = 'painel'),
  '1/concluido');


-- --- 4. O acompanhamento da gestao -----------------------------------------
--
-- A RECUSA CHEGA COMO ERRO E NAO COMO LISTA VAZIA, e a diferenca e tudo: "voce
-- nao pode" contra "ninguem comecou nenhum tour". E por isso a funcao nao e
-- `security definer` -- `profiles_select_gestor` e `team_members_select` ja
-- deixam o gestor ler as duas tabelas pelo caminho normal.

-- O cliente tambem faz tour, e o dele e o unico que quebraria calado: o Portal
-- e a area que a equipe nunca abre.
select teste.cenario('A Joana comeca o tour do portal', :JOANA,
  format($fmt$insert into public.tour_progresso (user_id, tour_id, passo_atual)
     values (%L, 'portal', 2)$fmt$, :JOANA), 'ok', 1);

select teste.recusa_com('O colaborador NAO abre o acompanhamento', :RAFAEL,
  $$select * from public.tour_acompanhamento()$$,
  'acompanhamento dos tours');

select teste.recusa_com('Nem o cliente', :JOANA,
  $$select * from public.tour_acompanhamento()$$,
  'acompanhamento dos tours');

select teste.cenario('A gestao abre', :DIEGO,
  $$select * from public.tour_acompanhamento()$$, 'ok');

select teste.conferir_como('E o socio tambem', :ANA,
  $$select (count(*) > 0)::text from public.tour_acompanhamento()$$, 'true');

-- A METADE QUE O `left join` RESOLVE. O Bruno nunca abriu tour nenhum, e e
-- ele que a tela procura -- um `select` em `tour_progresso` nao teria como
-- devolve-lo, e a ausencia leria como "em dia".
select teste.conferir_como('Quem nunca comecou tem linha, com tour_id nulo', :DIEGO,
  format($fmt$select count(*)::text from public.tour_acompanhamento()
     where user_id = %L and tour_id is null$fmt$, :BRUNO), '1');

select teste.conferir_como('O tour do portal aparece, porque e o que quebraria calado', :DIEGO,
  $$select count(*)::text from public.tour_acompanhamento() where tour_id = 'portal'$$,
  '1');

select teste.conferir_como('E a linha diz em que passo a pessoa parou', :DIEGO,
  format($fmt$select passo_atual::text from public.tour_acompanhamento()
     where user_id = %L and tour_id = 'painel'$fmt$, :CARLA), '2');

-- O ALARME DE TOUR QUEBRADO E A SOMA DA MESMA LISTA, e nao uma segunda funcao
-- agregando no banco: duas contas sobre as mesmas linhas seriam o cartao de
-- "11 entregues" com sete na lista embaixo.
select teste.conferir_como('O alarme de tour quebrado soma dois passos sem ancora', :DIEGO,
  $$select coalesce(sum(coalesce(array_length(passos_sem_ancora, 1), 0)), 0)::text
      from public.tour_acompanhamento()$$, '2');

select teste.conferir_como('E ele NAO conta quem escolheu pular', :DIEGO,
  $$select coalesce(sum(coalesce(array_length(passos_pulados, 1), 0)), 0)::text
      from public.tour_acompanhamento()$$, '1');

-- QUEM SAIU NAO DEVE AMBIENTACAO. `ativo = false` e o que o desligamento
-- escreve, e cobrar o tour de quem foi embora poria a lista para crescer para
-- sempre. O desligamento e desfeito logo abaixo.
select teste.conferir_como('O Rafael esta no acompanhamento', :DIEGO,
  format($fmt$select count(*)::text from public.tour_acompanhamento()
     where user_id = %L$fmt$, :RAFAEL), '1');

update public.profiles set ativo = false where id = '66666666-6666-6666-6666-666666666666';

select teste.conferir_como('Desligado, ele sai', :DIEGO,
  format($fmt$select count(*)::text from public.tour_acompanhamento()
     where user_id = %L$fmt$, :RAFAEL), '0');

update public.profiles set ativo = true where id = '66666666-6666-6666-6666-666666666666';

select teste.conferir('E o Rafael voltou a ativo',
  (select ativo::text from public.profiles
    where id = '66666666-6666-6666-6666-666666666666'),
  'true');

-- A PORTA FECHADA, e a bateria mede o PRIVILEGIO e nao a mensagem: o Postgres
-- concede `execute` a `public` em toda funcao nova, e o PostgREST publica o
-- schema `public` sozinho. Sem o `revoke`, `anon` -- cuja chave vai no bundle
-- que o navegador baixa -- leria o nome de toda a equipe e de todo cliente da
-- agencia. E a licao da 0097 com `academy_vencidos()`.
select teste.recusa_como_anon(
  'anon NAO chama o acompanhamento (seria a lista de gente da agencia)',
  $$select * from public.tour_acompanhamento()$$,
  'permission denied');
