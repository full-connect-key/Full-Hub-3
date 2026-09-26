-- ---------------------------------------------------------------------------
-- 0062 - AVISAR NINGUEM NAO E ERRO: `notificar()` PARA DE DERRUBAR A ESCRITA
--
-- Relato do usuario: *"Na portal do cliente, nao consigo nem aprovar,
-- reprovar, solicitar ajuste, nem comentar, um post"*. Quatro botoes, e uma
-- causa so -- que nao esta em nenhum dos quatro.
--
-- ---------------------------------------------------------------------------
-- A CADEIA, INTEIRA
--
--   `clients.responsavel_atendimento_id` e NULAVEL desde a 0003, e ainda por
--   cima `on delete set null`;
--       v
--   `decidir_rodada_do_cliente` (0032) e o trigger `comments_avisa_a_equipe`
--   (0032) leem essa coluna e chamam `notificar(atendente, ...)`;
--       v
--   `notificar()` (0011) nao pergunta se ha alguem: ela vai direto ao
--   `insert into notifications`;
--       v
--   `notifications.user_id` e `not null references profiles`;
--       v
--   *null value in column "user_id" violates not-null constraint*;
--       v
--   a transacao inteira volta -- e o que o cliente perde nao e o aviso, e a
--   PROPRIA DECISAO.
--
-- Empresa sem responsavel de atendimento preenchido e um estado normal: o
-- campo e opcional no cadastro desde o Sprint 2. E `on delete set null`
-- transforma isso em bomba com relogio -- no dia em que a pessoa do
-- atendimento sai da agencia, todo cliente dela para de conseguir aprovar
-- qualquer coisa, sem nada mudando na tela.
--
-- ---------------------------------------------------------------------------
-- O CONSERTO E AQUI, E NAO NOS 23 LUGARES QUE CHAMAM
--
-- `perform public.notificar(...)` aparece 23 vezes nas migrations, e varias
-- passam coluna legitimamente nulavel -- `clients.responsavel_atendimento_id`,
-- `posts.criado_por`, `subtasks.responsavel_id`, `deliverables.responsavel_id`.
-- Pôr um `if ... is not null` em cada chamada seria criar 23 lugares para
-- lembrar, e a 24a esqueceria: e a mesma razao pela qual a auditoria e trigger
-- e nao action, e pela qual o aviso do Realtime pega carona na revalidacao em
-- vez de morar em vinte actions.
--
-- **E o retorno certo e `null`, nao uma excecao.** "Nao ha ninguem para
-- avisar" nao e falha de nada: e a resposta. A funcao ja devolve `null` no
-- outro caso em que nao ha nada a fazer -- quando quem seria avisado e quem
-- causou o aviso --, e este e o mesmo tipo de nada.
--
-- ---------------------------------------------------------------------------
-- POR QUE A BATERIA NAO PEGOU, e e a segunda vez na mesma armadilha
--
-- `15_posts_e_comentarios.sql` abria com
-- `update public.clients set responsavel_atendimento_id = :MARINA` -- uma
-- linha de montagem que, sem querer, garantia a unica condicao em que o bug
-- nao acontece. Os 1069 cenarios ficavam verdes com o produto quebrado.
--
-- E a mesma coisa que o Sprint 16 encontrou em `19_social_media_interno.sql`,
-- onde um `update` solto deixava o post com aval sem afirmar nada sobre quem
-- consegue dar aquele aval: **conveniencia de fixture ocupando o lugar do
-- cenario**. A montagem fica -- ela existe para os cenarios que precisam do
-- atendente --, e ao lado dela entram os cenarios da empresa que nao tem
-- nenhum, com a decisao e o comentario do cliente dela.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------
create or replace function public.notificar(
  p_user_id uuid,
  p_tipo    public.notification_tipo,
  p_titulo  text,
  p_corpo   text default null,
  p_link    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := (select auth.uid());
  novo uuid;
begin
  -- NAO HA NINGUEM PARA AVISAR, e isso nao e erro. Antes desta linha, o
  -- `insert` batia no `not null` de `user_id` e levava junto a escrita que
  -- chamou -- a aprovacao do cliente, o comentario dele, a geracao da
  -- recorrencia da madrugada.
  if p_user_id is null then
    return null;
  end if;

  -- Ninguem e avisado do que fez. O sino existe para o que os OUTROS fizeram.
  if p_user_id = quem then
    return null;
  end if;

  insert into public.notifications (user_id, tipo, titulo, corpo, link, origem_id)
  values (p_user_id, p_tipo, p_titulo, p_corpo, p_link, quem)
  returning id into novo;

  return novo;
end;
$$;

comment on function public.notificar is
  'Cria um aviso. Unica porta de escrita em notifications -- nao ha policy de '
  'insert. Devolve null sem escrever nada em dois casos: quando nao ha a quem '
  'avisar, e quando quem seria avisado e quem causou o aviso. Avisar ninguem '
  'nao pode derrubar a escrita que chamou (0062).';
