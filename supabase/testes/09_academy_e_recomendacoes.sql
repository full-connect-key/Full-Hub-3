-- ===========================================================================
-- Sprint 9 -- Full Academy e Recomendacoes
--
-- Ana e socia, Diego desenvolvedor (os dois sao `is_gestor()`), Carla e Bruno
-- e Marina sao colaboradores, Joana e cliente.
--
-- As perguntas: trilha em rascunho vaza? anotacao pessoal vaza? um colaborador
-- apaga o post de outro? o cliente alcanca qualquer coisa disto?
--
-- Cada cenario roda como uma PESSOA. Rodando como postgres tudo passaria --
-- superusuario ignora RLS, e nenhuma destas regras estaria provada.
-- ===========================================================================

\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

delete from public.recommendation_comments;
delete from public.recommendation_likes;
delete from public.recommendations;
delete from public.academy_progress;
delete from public.academy_materials;
delete from public.academy_tracks;
delete from public.notifications;

-- ---------------------------------------------------------------------------
-- QUEM MONTA A TRILHA
-- ---------------------------------------------------------------------------

select teste.cenario('Colaborador NAO cria trilha', :CARLA,
  format($fmt$
    insert into public.academy_tracks (titulo, area, criado_por)
    values ('Trilha da Carla', 'Design', %L)
  $fmt$, :CARLA), 'recusa');

select teste.cenario('Gestor cria trilha', :DIEGO,
  format($fmt$
    insert into public.academy_tracks (id, titulo, descricao, area, obrigatoria, criado_por)
    values ('a1a1a1a1-0000-0000-0000-00000000000a', 'Onboarding da casa',
            'Como a agencia trabalha.', 'Processos', true, %L)
  $fmt$, :DIEGO), 'ok', 1);

-- `criado_por` tem que ser quem esta criando. Sem o `with check`, daria para
-- assinar uma trilha no nome de outra pessoa.
select teste.cenario('Gestor NAO assina trilha no nome de outro', :DIEGO,
  format($fmt$
    insert into public.academy_tracks (titulo, criado_por)
    values ('Assinada pela Ana', %L)
  $fmt$, :ANA), 'recusa');

-- ---------------------------------------------------------------------------
-- RASCUNHO NAO VAZA
--
-- A trilha nasce com `publicada = false`. Ate a gestao publicar, ela nao
-- existe para o resto da equipe -- e isso e RLS, nao filtro de consulta: um
-- `.eq("publicada", true)` esquecido numa tela nova vazaria o rascunho.
-- ---------------------------------------------------------------------------

select teste.cenario('Trilha em rascunho: a gestao ve', :DIEGO,
  $$select 1 from public.academy_tracks where id = 'a1a1a1a1-0000-0000-0000-00000000000a'$$,
  'ok', 1);

select teste.cenario('Trilha em rascunho: o colaborador NAO ve', :CARLA,
  $$select 1 from public.academy_tracks where id = 'a1a1a1a1-0000-0000-0000-00000000000a'$$,
  'recusa');

-- O material segue a trilha. Sem o `exists` na policy do material, a lista de
-- materiais entregaria o conteudo do rascunho para quem nao pode ver a trilha.
insert into public.academy_materials (id, track_id, titulo, tipo, url, duracao_minutos, ordem)
values ('b1b1b1b1-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-00000000000a',
        'Video de boas-vindas', 'video', 'https://youtube.com/watch?v=x', 12, 1),
       ('b1b1b1b1-0000-0000-0000-000000000002', 'a1a1a1a1-0000-0000-0000-00000000000a',
        'Manual em PDF', 'pdf', null, 30, 2),
       ('b1b1b1b1-0000-0000-0000-000000000003', 'a1a1a1a1-0000-0000-0000-00000000000a',
        'Curso externo', 'curso_externo', 'https://exemplo.invalid/curso', 90, 3);

select teste.cenario('Material de trilha em rascunho: o colaborador NAO ve', :CARLA,
  $$select 1 from public.academy_materials
     where track_id = 'a1a1a1a1-0000-0000-0000-00000000000a'$$, 'recusa');

update public.academy_tracks set publicada = true
 where id = 'a1a1a1a1-0000-0000-0000-00000000000a';

select teste.cenario('Publicada: o colaborador ve a trilha', :CARLA,
  $$select 1 from public.academy_tracks where id = 'a1a1a1a1-0000-0000-0000-00000000000a'$$,
  'ok', 1);

select teste.cenario('Publicada: o colaborador ve os tres materiais', :CARLA,
  $$select 1 from public.academy_materials
     where track_id = 'a1a1a1a1-0000-0000-0000-00000000000a'$$, 'ok', 3);

select teste.cenario('Colaborador NAO edita material', :CARLA,
  $$update public.academy_materials set titulo = 'Mexi aqui'
     where id = 'b1b1b1b1-0000-0000-0000-000000000001'$$, 'recusa');

-- ---------------------------------------------------------------------------
-- O PROGRESSO E DE QUEM ESTUDA
-- ---------------------------------------------------------------------------

select teste.cenario('Carla marca o proprio progresso', :CARLA,
  format($fmt$
    insert into public.academy_progress (user_id, material_id, concluido, anotacoes)
    values (%L, 'b1b1b1b1-0000-0000-0000-000000000001', true,
            'Reassistir a parte do briefing.')
  $fmt$, :CARLA), 'ok', 1);

select teste.conferir('concluido_em e carimbado pelo banco',
  (select case when concluido_em is null then 'nulo' else 'carimbado' end
     from public.academy_progress
    where user_id = '33333333-3333-3333-3333-333333333333'
      and material_id = 'b1b1b1b1-0000-0000-0000-000000000001'),
  'carimbado');

-- Desmarcar limpa a data: uma conclusao desfeita que guardasse a data diria
-- que foi concluida e nao foi.
update public.academy_progress set concluido = false
 where user_id = '33333333-3333-3333-3333-333333333333'
   and material_id = 'b1b1b1b1-0000-0000-0000-000000000001';

select teste.conferir('Desmarcar limpa a data',
  (select case when concluido_em is null then 'nulo' else 'carimbado' end
     from public.academy_progress
    where user_id = '33333333-3333-3333-3333-333333333333'
      and material_id = 'b1b1b1b1-0000-0000-0000-000000000001'),
  'nulo');

update public.academy_progress set concluido = true
 where user_id = '33333333-3333-3333-3333-333333333333'
   and material_id = 'b1b1b1b1-0000-0000-0000-000000000001';

select teste.cenario('Bruno NAO marca progresso no nome da Carla', :BRUNO,
  format($fmt$
    insert into public.academy_progress (user_id, material_id, concluido)
    values (%L, 'b1b1b1b1-0000-0000-0000-000000000002', true)
  $fmt$, :CARLA), 'recusa');

select teste.cenario('Bruno NAO ve o progresso da Carla', :BRUNO,
  $$select 1 from public.academy_progress
     where user_id = '33333333-3333-3333-3333-333333333333'$$, 'recusa');

select teste.cenario('Bruno NAO altera o progresso da Carla', :BRUNO,
  $$update public.academy_progress set concluido = false
     where user_id = '33333333-3333-3333-3333-333333333333'$$, 'recusa');

-- ---------------------------------------------------------------------------
-- A ANOTACAO E PRIVADA, E POLICY NAO LIMITA COLUNA
--
-- A gestao PRECISA ler o progresso -- a aba Acompanhamento existe porque
-- trilha obrigatoria sem quem confira e recado, nao trilha. Mas a anotacao
-- pessoal nao e da conta dela: e onde se escreve "nao entendi", e uma nota
-- dessas que a gestao pudesse ler nao seria escrita.
--
-- Como policy nao limita coluna, a separacao mora na VIEW. Estes dois
-- cenarios sao o par que prova isso: a view entrega a conclusao e NAO tem a
-- coluna da anotacao.
-- ---------------------------------------------------------------------------

select teste.cenario('A gestao le o progresso pela view', :DIEGO,
  $$select 1 from public.academy_progresso_da_equipe
     where user_id = '33333333-3333-3333-3333-333333333333' and concluido$$, 'ok', 1);

do $$
declare
  tem boolean;
begin
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'academy_progresso_da_equipe'
       and column_name = 'anotacoes'
  ) into tem;

  insert into teste.resultado (descricao, situacao, detalhe)
  values ('A view do acompanhamento NAO tem a coluna anotacoes',
          case when tem then 'FALHOU' else 'passou' end,
          case when tem then 'a coluna esta la -- a anotacao vazaria para a gestao'
               else 'coluna ausente, como tem que ser' end);
end
$$;

-- ---------------------------------------------------------------------------
-- A ETIQUETA DO MATERIAL FICA; A PONTE COM O SPRINT 7 SAIU
--
-- Ate a 0043 havia aqui "Recomendadas para voce": as trilhas cujos materiais
-- tocavam uma skill que a pessoa marcou como `quer_desenvolver`. A tabela que
-- guardava essa marca saiu do produto com o Meu Desenvolvimento, e a vitrine
-- saiu junto -- sem a origem do sinal nao ha o que recomendar.
--
-- O QUE FICA, E E DECISAO DO USUARIO: o catalogo `skills` continua, agora como
-- vocabulario de etiquetas do Academy. Os cenarios abaixo sao os de antes
-- VIRADOS DO AVESSO: se alguem ressuscitar `user_skills`, o primeiro falha e
-- diz qual.
-- ---------------------------------------------------------------------------

insert into public.skills (id, nome, categoria)
values ('5c5c5c5c-0000-0000-0000-00000000000a', 'Motion graphics', 'Design')
on conflict (nome) do nothing;

update public.academy_materials
   set skill_id = (select id from public.skills where nome = 'Motion graphics')
 where id = 'b1b1b1b1-0000-0000-0000-000000000001';

select teste.conferir('A tabela da autoavaliacao nao existe mais',
  (select count(*)::text from information_schema.tables
    where table_schema = 'public' and table_name in ('user_skills', 'skill_avaliacoes')),
  '0');

select teste.conferir('Mas o catalogo continua, e o material segue etiquetado',
  (select s.nome from public.academy_materials m
     join public.skills s on s.id = m.skill_id
    where m.id = 'b1b1b1b1-0000-0000-0000-000000000001'),
  'Motion graphics');

-- A SUGESTAO DE SKILL SAIU JUNTO, e e a parte que passa batida: o catalogo
-- tinha dois caminhos de entrada, e o segundo -- qualquer pessoa da equipe
-- sugerindo -- tinha a fila de aprovacao em Meu Desenvolvimento. Sem aquela
-- tela, a policy oferecia um caminho que nao existe.
select teste.cenario('O colaborador nao cria skill no catalogo', :BRUNO,
  $fmt$insert into public.skills (nome, categoria) values ('Sugerida a mao', 'Design')$fmt$,
  'recusa');

select teste.cenario('A gestao cria', :DIEGO,
  $fmt$insert into public.skills (nome, categoria) values ('Criada pela gestao', 'Design')$fmt$,
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

select teste.cenario('O cliente NAO ve a Academy', :JOANA,
  $$select 1 from public.academy_tracks$$, 'recusa');

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

select teste.cenario('O cliente NAO ve materiais', :JOANA,
  $$select 1 from public.academy_materials$$, 'recusa');

select teste.cenario('O cliente NAO ve curtidas', :JOANA,
  $$select 1 from public.recommendation_likes$$, 'recusa');

select teste.cenario('O cliente NAO ve comentarios', :JOANA,
  $$select 1 from public.recommendation_comments$$, 'recusa');

select teste.cenario('O cliente NAO posta no feed', :JOANA,
  format($fmt$
    insert into public.recommendations (autor_id, categoria, titulo)
    values (%L, 'outro', 'Oi')
  $fmt$, :JOANA), 'recusa');

-- ---------------------------------------------------------------------------
-- REORDENAR NAO E PORTA LATERAL
--
-- `academy_reordenar` existe porque arrastar dez materiais sao dez UPDATEs, e
-- pelo PostgREST seriam dez transacoes -- a quinta falhando deixaria a trilha
-- numa ordem que nunca existiu na tela.
--
-- Mas uma funcao que roda no banco e o lugar classico onde uma regra vaza: um
-- `security definer` distraido faria qualquer pessoa reordenar a trilha de
-- todo mundo. Ela NAO e security definer de proposito, e estes dois cenarios
-- sao o que prova isso -- sem eles, trocar a funcao por uma versao com
-- `security definer` passaria na bateria inteira.
-- ---------------------------------------------------------------------------

-- Repoe a trilha publicada num estado conhecido.
delete from public.academy_materials
 where track_id = 'a1a1a1a1-0000-0000-0000-00000000000a';

insert into public.academy_materials (id, track_id, titulo, tipo, url, ordem) values
  ('b2b2b2b2-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-00000000000a',
   'Primeiro', 'artigo', 'https://exemplo.invalid/1', 1),
  ('b2b2b2b2-0000-0000-0000-000000000002', 'a1a1a1a1-0000-0000-0000-00000000000a',
   'Segundo', 'artigo', 'https://exemplo.invalid/2', 2);

select teste.cenario('A gestao reordena os materiais', :DIEGO,
  $$select public.academy_reordenar(
      'a1a1a1a1-0000-0000-0000-00000000000a',
      array['b2b2b2b2-0000-0000-0000-000000000002',
            'b2b2b2b2-0000-0000-0000-000000000001']::uuid[])$$, 'ok');

select teste.conferir('E a ordem mudou mesmo',
  (select titulo from public.academy_materials
    where track_id = 'a1a1a1a1-0000-0000-0000-00000000000a' order by ordem limit 1),
  'Segundo');

-- O colaborador chama a mesma funcao. Ela NAO estoura -- a policy de UPDATE
-- simplesmente nao casa nenhuma linha --, e por isso a prova nao e "deu erro":
-- e que NADA mudou. Um cenario que so esperasse excecao passaria mesmo com a
-- funcao aberta.
select teste.cenario('O colaborador chama a funcao e ela nao muda nada', :CARLA,
  $$select public.academy_reordenar(
      'a1a1a1a1-0000-0000-0000-00000000000a',
      array['b2b2b2b2-0000-0000-0000-000000000001',
            'b2b2b2b2-0000-0000-0000-000000000002']::uuid[])$$, 'ok');

select teste.conferir('A ordem continua a que a gestao deixou',
  (select titulo from public.academy_materials
    where track_id = 'a1a1a1a1-0000-0000-0000-00000000000a' order by ordem limit 1),
  'Segundo');

-- E a funcao nao atravessa trilhas: o `where track_id` amarra a operacao a
-- uma so. Sem ele, uma lista com ids de trilhas diferentes reordenaria as
-- duas ao mesmo tempo.
insert into public.academy_tracks (id, titulo, criado_por, publicada)
values ('a2a2a2a2-0000-0000-0000-00000000000a', 'Outra trilha', :DIEGO, true);

insert into public.academy_materials (id, track_id, titulo, tipo, url, ordem)
values ('b3b3b3b3-0000-0000-0000-000000000001', 'a2a2a2a2-0000-0000-0000-00000000000a',
        'De outra trilha', 'artigo', 'https://exemplo.invalid/3', 7);

select teste.cenario('Reordenar uma trilha nao toca na outra', :DIEGO,
  $$select public.academy_reordenar(
      'a1a1a1a1-0000-0000-0000-00000000000a',
      array['b3b3b3b3-0000-0000-0000-000000000001',
            'b2b2b2b2-0000-0000-0000-000000000001']::uuid[])$$, 'ok');

select teste.conferir('O material da outra trilha ficou onde estava',
  (select ordem::text from public.academy_materials
    where id = 'b3b3b3b3-0000-0000-0000-000000000001'),
  '7');
