\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

-- ===========================================================================
-- O QUE SOBROU DO SPRINT 7 (migration 0043)
--
-- Este arquivo tinha 27 cenarios e era todo do Meu Desenvolvimento: a
-- autoavaliacao que so a propria pessoa escrevia, a observacao que a gestao
-- registrava, a matriz da agencia. O modulo saiu do produto por decisao do
-- usuario, e as duas tabelas foram apagadas.
--
-- O QUE FICA E O CATALOGO, com um papel so: o vocabulario de etiquetas do Full
-- Academy, por `academy_materials.skill_id`. Apagar `skills` junto levaria a
-- etiqueta de cada material -- e a Academy perderia a unica coisa que organiza
-- o que ela guarda.
--
-- OS CENARIOS DE ANTES FICARAM, VIRADOS DO AVESSO. Um modulo apagado volta de
-- um jeito especifico: alguem copia uma tela antiga, ou reabre a migration
-- para "so consultar". Se `user_skills` ou `skill_avaliacoes` renascerem, o
-- primeiro cenario falha e diz qual.
-- ===========================================================================

select teste.conferir('As duas tabelas do modulo nao existem mais',
  (select count(*)::text from information_schema.tables
    where table_schema = 'public'
      and table_name in ('user_skills', 'skill_avaliacoes')),
  '0');

-- A COLUNA DA SUGESTAO SAIU JUNTO, e nao por arrumacao: `ativa = false` tinha
-- DOIS significados, e `sugerida_por` era o que os distinguia -- arquivada
-- pela gestao, ou sugerida por alguem esperando decisao. A fila que decidia
-- morava em Meu Desenvolvimento. Sem ela, a coluna vira campo que nenhum
-- caminho preenche e nenhuma tela le.
select teste.conferir('E `skills.sugerida_por` tambem nao',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'skills'
      and column_name = 'sugerida_por'),
  '0');


-- --- O catalogo continua, e continua sendo da equipe -----------------------

select teste.cenario('A equipe le o catalogo', :BRUNO,
  'select 1 from public.skills where ativa', 'ok', 20);

-- O CLIENTE NUNCA ALCANCOU, e a 0043 nao pode ter aberto essa porta. A
-- migration mexeu em quem ESCREVE; este cenario e a pergunta de leitura feita
-- de novo.
select teste.cenario('O cliente nao le o catalogo', :JOANA,
  'select 1 from public.skills', 'ok', 0);


-- --- Quem escreve no catalogo ----------------------------------------------

select teste.cenario('A gestao cria etiqueta', :DIEGO,
  $fmt$insert into public.skills (nome, categoria) values ('Motion 3D', 'Design')$fmt$,
  'ok', 1);

select teste.cenario('O socio tambem', :ANA,
  $fmt$insert into public.skills (nome, categoria) values ('Copy para anuncio', 'Redacao')$fmt$,
  'ok', 1);

-- ERA `is_staff()` COM `ativa = false`, e a policy passou a ser so
-- `is_gestor()`: quem decide o vocabulario de etiqueta da Academy e quem
-- cuida da Academy. Uma policy que permite o que nenhuma tela oferece e uma
-- porta que so quem monta requisicao a mao encontra.
select teste.cenario('O colaborador NAO cria, nem como sugestao', :BRUNO,
  $fmt$insert into public.skills (nome, categoria, ativa) values ('Sugerida', 'Design', false)$fmt$,
  'recusa');

select teste.cenario('E nao edita o que existe', :BRUNO,
  $fmt$update public.skills set nome = 'Renomeada por fora' where ativa$fmt$,
  'recusa');

-- SEM DELETE PARA NINGUEM, e e a regra de sempre: etiqueta citada num material
-- antigo vira historico. Arquivar e `ativa = false`.
select teste.cenario('Nem o socio apaga etiqueta do catalogo', :ANA,
  $fmt$delete from public.skills where nome = 'Motion 3D'$fmt$,
  'recusa');

select teste.cenario('Arquivar, sim', :ANA,
  $fmt$update public.skills set ativa = false where nome = 'Motion 3D'$fmt$,
  'ok', 1);
