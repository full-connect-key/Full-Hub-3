\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

-- ===========================================================================
-- Sprint 7 -- Skills e desenvolvimento
--
-- Dois criterios de aceite pedem explicitamente "testar via API tambem":
-- ninguem edita a skill de outra pessoa, e o registro semanal de alguem nao e
-- acessivel por ninguem, nem pelo socio. E o que esta bateria faz -- ela nao
-- passa pela tela.
-- ===========================================================================

delete from public.skill_avaliacoes;
delete from public.user_skills;
delete from public.weekly_notes;
delete from public.weekly_entries;
delete from public.skills where sugerida_por is not null;


-- --- O catalogo ------------------------------------------------------------

select teste.cenario('A equipe le o catalogo', :BRUNO,
  'select 1 from public.skills where ativa', 'ok', 20);

select teste.cenario('O cliente nao le o catalogo', :JOANA,
  'select 1 from public.skills', 'ok', 0);

select teste.cenario('A gestao cria skill direto no catalogo', :DIEGO,
  format($fmt$
    insert into public.skills (nome, categoria) values (%L, %L)
  $fmt$, 'Produção Musical', 'Audiovisual'), 'ok', 1);

-- Quem descobre que falta uma skill precisa poder sugerir. Se dependesse de
-- pedir para alguem por fora do sistema, ninguem pediria.
select teste.cenario('O colaborador SUGERE, e a sugestao nasce inativa', :BRUNO,
  format($fmt$
    insert into public.skills (nome, categoria, ativa, sugerida_por)
    values (%L, %L, false, %L)
  $fmt$, 'Ilustração Digital', 'Design', :BRUNO), 'ok', 1);

select teste.cenario('Mas nao cria uma skill ja ativa', :BRUNO,
  format($fmt$
    insert into public.skills (nome, ativa, sugerida_por)
    values (%L, true, %L)
  $fmt$, 'Skill que o Bruno ativou sozinho', :BRUNO), 'recusa');

select teste.cenario('Nem sugere no nome de outra pessoa', :BRUNO,
  format($fmt$
    insert into public.skills (nome, ativa, sugerida_por)
    values (%L, false, %L)
  $fmt$, 'Sugestao forjada', :CARLA), 'recusa');

select teste.cenario('O colaborador nao aprova a propria sugestao', :BRUNO,
  format($fmt$
    update public.skills set ativa = true where nome = %L
  $fmt$, 'Ilustração Digital'), 'recusa');

select teste.cenario('A gestao aprova', :DIEGO,
  format($fmt$
    update public.skills set ativa = true, sugerida_por = null where nome = %L
  $fmt$, 'Ilustração Digital'), 'ok', 1);

select teste.cenario('Skill nao se apaga -- ela e arquivada', :ANA,
  format('delete from public.skills where nome = %L', 'Ilustração Digital'), 'recusa');


-- --- O perfil de cada um ---------------------------------------------------

select teste.cenario('Bruno cadastra 5 skills', :BRUNO,
  format($fmt$
    insert into public.user_skills (user_id, skill_id, nivel, quer_desenvolver)
    select %L, s.id,
           (case s.nome
              when 'After Effects' then 'especialista'
              when 'Photoshop'     then 'avancado'
              when 'Illustrator'   then 'avancado'
              when 'Motion'        then 'intermediario'
              else 'iniciante' end)::public.skill_nivel,
           s.nome in ('Figma', 'Motion')
      from public.skills s
     where s.nome in ('After Effects', 'Photoshop', 'Illustrator', 'Motion', 'Figma')
  $fmt$, :BRUNO), 'ok', 5);

select teste.cenario('E duas ficaram marcadas como "quero desenvolver"', :BRUNO,
  format('select 1 from public.user_skills where user_id = %L and quer_desenvolver', :BRUNO),
  'ok', 2);

-- O criterio de aceite: "um colaborador nao consegue editar as skills de
-- outra pessoa (testar via API tambem)".
select teste.cenario('A Carla NAO escreve no perfil do Bruno', :CARLA,
  format($fmt$
    insert into public.user_skills (user_id, skill_id, nivel)
    select %L, id, 'especialista' from public.skills where nome = 'SEO'
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Nem muda o nivel que ele se deu', :CARLA,
  format($fmt$
    update public.user_skills set nivel = 'iniciante' where user_id = %L
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Nem apaga', :CARLA,
  format('delete from public.user_skills where user_id = %L', :BRUNO), 'recusa');

-- Nivel e AUTOAVALIACAO. Se a gestao pudesse escrever, o numero passaria a
-- dizer duas coisas ao mesmo tempo. A opiniao dela tem lugar proprio.
select teste.cenario('Nem a socia escreve o nivel de alguem', :ANA,
  format($fmt$
    update public.user_skills set nivel = 'iniciante' where user_id = %L
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('Mas a gestao LE todas -- e o que faz a matriz existir', :DIEGO,
  'select 1 from public.user_skills', 'ok', 5);

select teste.cenario('O colaborador le so as proprias', :CARLA,
  'select 1 from public.user_skills', 'ok', 0);

select teste.cenario('O cliente nao alcanca nada disso', :JOANA,
  'select 1 from public.user_skills', 'ok', 0);

-- "Quem sabe fazer X?" e a pergunta mais usada do modulo.
select teste.conferir('Quem sabe After Effects, pelo nivel',
  (select string_agg(p.nome || ' (' || u.nivel || ')', ', ' order by u.nivel desc)
     from public.user_skills u
     join public.skills s on s.id = u.skill_id
     join public.profiles p on p.id = u.user_id
    where s.nome = 'After Effects'),
  'Bruno Alves (especialista)');


-- --- A observacao da gestao ------------------------------------------------

select teste.cenario('O desenvolvedor registra uma observacao', :DIEGO,
  format($fmt$
    insert into public.skill_avaliacoes (user_id, autor_id, texto)
    values (%L, %L, %L)
  $fmt$, :BRUNO, :DIEGO, 'Evoluiu muito em motion no ultimo trimestre.'), 'ok', 1);

select teste.cenario('O colaborador nao escreve observacao sobre ninguem', :CARLA,
  format($fmt$
    insert into public.skill_avaliacoes (user_id, autor_id, texto)
    values (%L, %L, %L)
  $fmt$, :BRUNO, :CARLA, 'Opiniao que a Carla nao deveria registrar'), 'recusa');

select teste.cenario('Nem no proprio nome, assinando como outro', :CARLA,
  format($fmt$
    insert into public.skill_avaliacoes (user_id, autor_id, texto)
    values (%L, %L, %L)
  $fmt$, :CARLA, :DIEGO, 'Assinatura forjada'), 'recusa');

-- Avaliacao que o avaliado nao pode ler e feedback pelas costas.
select teste.cenario('O AVALIADO le o que escreveram sobre ele', :BRUNO,
  format('select 1 from public.skill_avaliacoes where user_id = %L', :BRUNO), 'ok', 1);

select teste.cenario('A Carla nao le a observacao sobre o Bruno', :CARLA,
  'select 1 from public.skill_avaliacoes', 'ok', 0);

select teste.cenario('O Bruno nao reescreve a observacao que fizeram dele', :BRUNO,
  format($fmt$
    update public.skill_avaliacoes set texto = %L where user_id = %L
  $fmt$, 'Sou otimo em tudo', :BRUNO), 'recusa');

-- Um gestor reescrevendo a observacao de outro apagaria de quem era a opiniao.
select teste.cenario('A socia nao reescreve a observacao do desenvolvedor', :ANA,
  format('update public.skill_avaliacoes set texto = %L', 'Outro texto'), 'recusa');

select teste.cenario('O autor corrige o proprio texto', :DIEGO,
  format('update public.skill_avaliacoes set texto = %L', 'Evoluiu muito em motion.'),
  'ok', 1);


-- --- O registro semanal e privado ------------------------------------------
--
-- Criterio de aceite: "o diario de uma pessoa nao e acessivel por outra, nem
-- pelo socio (testar via API)".

select teste.cenario('Bruno escreve sobre a semana', :BRUNO,
  format($fmt$
    insert into public.weekly_notes (user_id, semana, conteudo_texto, humor)
    values (%L, date_trunc('week', current_date)::date, %L, 'bom')
  $fmt$, :BRUNO, 'Semana puxada, mas a campanha saiu.'), 'ok', 1);

select teste.cenario('E le o proprio', :BRUNO,
  'select 1 from public.weekly_notes', 'ok', 1);

select teste.cenario('A SOCIA nao le o registro do Bruno', :ANA,
  'select 1 from public.weekly_notes', 'ok', 0);

select teste.cenario('O desenvolvedor tambem nao', :DIEGO,
  'select 1 from public.weekly_notes', 'ok', 0);

select teste.cenario('Ninguem escreve no registro de outra pessoa', :ANA,
  format($fmt$
    insert into public.weekly_notes (user_id, semana, conteudo_texto)
    values (%L, date_trunc('week', current_date)::date, %L)
  $fmt$, :BRUNO, 'Texto que a Ana inventou'), 'recusa');

select teste.cenario('Nem apaga', :ANA, 'delete from public.weekly_notes', 'recusa');

-- Registro do que ainda nao aconteceu nao e registro, e ficcao.
select teste.cenario('Semana futura e recusada', :BRUNO,
  format($fmt$
    insert into public.weekly_notes (user_id, semana, conteudo_texto)
    values (%L, (date_trunc('week', current_date) + interval '7 days')::date, %L)
  $fmt$, :BRUNO, 'Na semana que vem eu vou...'), 'recusa');

select teste.cenario('Entrega com data futura tambem', :BRUNO,
  format($fmt$
    insert into public.weekly_entries (user_id, data, descricao)
    values (%L, current_date + 3, %L)
  $fmt$, :BRUNO, 'Entrega que ainda nao aconteceu'), 'recusa');

-- A semana e sempre a segunda-feira. Sem essa trava, duas telas com ideias
-- diferentes de onde a semana comeca criariam dois registros para a mesma
-- semana, e o `unique` nao pegaria.
select teste.cenario('Semana que nao comeca numa segunda e recusada', :BRUNO,
  format($fmt$
    insert into public.weekly_notes (user_id, semana, conteudo_texto)
    values (%L, (date_trunc('week', current_date) - interval '1 day')::date, %L)
  $fmt$, :BRUNO, 'Domingo nao e comeco de semana aqui'), 'recusa');

select teste.cenario('Um registro por semana, por pessoa', :BRUNO,
  format($fmt$
    insert into public.weekly_notes (user_id, semana, conteudo_texto)
    values (%L, date_trunc('week', current_date)::date, %L)
  $fmt$, :BRUNO, 'Segundo registro da mesma semana'), 'recusa');
