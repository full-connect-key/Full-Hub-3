-- ---------------------------------------------------------------------------
-- 0047 - QUEM TEM ETAPA NA CORRENTE EDITA O CARD
--
-- Decisao do usuario, e e um furo que a 0046 deixou: "quando eu abro o mes
-- inteiro de uma vez, nao consigo redefinir a data do post -- a data do post e
-- funcao da social media e da redatora".
--
-- ---------------------------------------------------------------------------
-- O QUE ESTAVA ERRADO, E SAO DUAS COISAS
--
-- 1. `posts_update` fecha em `is_gestor() or responsavel_id = auth.uid()`
--    desde a 0042, quando o post tinha UMA mao por vez e `responsavel_id` era
--    quem produzia. A 0045 partiu a producao em cinco etapas com cinco donos,
--    e a 0046 disse que "os proprios responsaveis pelas etapas vao preenchendo
--    o card" -- mas a policy nao acompanhou.
--
--    Consequencia: a redatora e dona da etapa Conteudo e NAO e
--    `posts.responsavel_id`. Ela nao conseguia escrever a legenda, nem a
--    pauta, nem a data. `post_referencias` ja era `is_staff()`, entao juntar
--    uma referencia funcionava -- o que torna o buraco ainda mais confuso de
--    diagnosticar pela tela: metade do card aceitava escrita e a outra metade
--    voltava sem erro e sem linha.
--
--    A 0046 escreveu a regra em portugues e esqueceu de escreve-la em SQL.
--
-- 2. A DATA ja estava liberada desde a 0044 -- o trigger
--    `proteger_colunas_do_post` parou de recusa-la --, mas a policy barrava
--    antes, para quem nao fosse dono do post. Duas travas em camadas
--    diferentes, e desfazer a de cima nao adianta enquanto a de baixo segura.
--    E a mesma licao da 0029: a trava estava em dois lugares.
--
-- ---------------------------------------------------------------------------
-- E "QUALQUER PESSOA" AQUI E `is_staff()`, NAO LITERALMENTE QUALQUER UMA
--
-- O pedido foi "qualquer pessoa poder alterar a data do post". A leitura e a
-- da equipe: o cliente continua sem policy de escrita em `posts`, e isso nao
-- muda -- a data e quando o material vai ao ar, e quem responde por isso e a
-- agencia.
--
-- Dentro da equipe, a porta e TER ETAPA NA CORRENTE e nao `is_staff()` solto.
-- A diferenca aparece com dez clientes: `is_staff()` deixaria o designer de
-- outra conta trocar a data de um post que ele nunca viu, sem querer, com dois
-- cliques errados no calendario da agencia. Quem tem etapa e quem esta
-- trabalhando naquele post -- e no fluxo que o usuario descreveu, a social
-- media e a redatora tem.
--
-- E CLIENTE E RESPONSAVEL CONTINUAM DA GESTAO. A policy diz quem entra; o
-- trigger diz o que se pode mexer depois de entrar, e ele nao mudou.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A pergunta
--
-- `security definer` porque ela le `post_etapas`, e a policy de leitura de la
-- e `is_staff()` -- que e verdade para todo mundo que chega aqui, mas depender
-- disso faria a policy de `posts` mudar de resposta se a de `post_etapas`
-- mudasse um dia. `stable` porque ela nao escreve nada e o planejador pode
-- reaproveitar o resultado dentro da mesma consulta.
-- ---------------------------------------------------------------------------

create or replace function public.tenho_etapa_no_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.post_etapas e
     where e.post_id = p_post_id
       and e.responsavel_id = (select auth.uid())
  );
end;
$$;

comment on function public.tenho_etapa_no_post is
  'Quem esta com alguma etapa da corrente deste post. E a porta de escrita do card desde a 0047 -- a 0046 disse que quem pega a etapa preenche o card, e esta e a frase em SQL.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A policy
--
-- `responsavel_id` CONTINUA NA LISTA, e nao e redundante: post aberto antes da
-- 0045 nao tem corrente, e post avulso pode ter dono sem ninguem ter
-- distribuido as etapas. Tirar aquele ramo tiraria a escrita de quem a tinha.
-- ---------------------------------------------------------------------------

drop policy if exists posts_update on public.posts;

create policy posts_update on public.posts
  for update to authenticated
  using (
    public.is_gestor()
    or responsavel_id = (select auth.uid())
    or public.tenho_etapa_no_post(id)
  )
  with check (
    public.is_gestor()
    or responsavel_id = (select auth.uid())
    or public.tenho_etapa_no_post(id)
  );

notify pgrst, 'reload schema';
