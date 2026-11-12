-- ===========================================================================
-- 0131 - TICAR O PRIMEIRO PASSO QUE A PESSOA JA SABE FAZER
--
-- Decisao do usuario: *"quero que o tutorial seja possivel ticar os itens,
-- caso a pessoa ja saiba como fazer, sem precisar fazer o tutorial
-- necessariamente"*.
--
-- ---------------------------------------------------------------------------
-- O QUE ESTAVA ERRADO NAO ERA A DERIVACAO: ERA ELA SER A UNICA PORTA
--
-- Os cinco itens de "Primeiros passos" sao DERIVADOS do estado real desde o
-- sprint 3M, e o pedido daquele sprint esta escrito em quantas palavras:
-- *"derivar evita o bug classico -- a pessoa faz a coisa por outro caminho e a
-- lista continua dizendo que falta"*. Aquilo continua inteiro e esta migration
-- nao desfaz uma linha disso.
--
-- O que ela desfaz e a consequencia: com a derivacao sendo o UNICO caminho, o
-- unico jeito de fechar um item e FAZER a coisa. Quem ja conhece a plataforma
-- -- e quem esta na agencia ha dois anos e nunca propos um periodo no Day Off
-- -- fica com o bloco aberto PARA SEMPRE, numa tela que ela abre todo dia. O
-- bloco so se esconde quando `pendentes = 0`, e o item que ela nao vai fazer
-- nunca chega la.
--
-- ---------------------------------------------------------------------------
-- E A CONTA PASSA A SER `derivado OR dispensado`, nunca uma substituicao
--
-- Esta e a linha que mais importa da migration, e ela e o que mantem a
-- derivacao de pe: **ticar so pode FECHAR um item, nunca reabrir o que o
-- estado ja fechou.** Quem ja subiu a foto tem o item fechado pelo FATO, e
-- destique nenhum faz a foto desaparecer -- entao a caixa so existe enquanto
-- o derivado esta pendente, e o item derivado-feito continua sendo o visto
-- riscado de sempre, sem controle nenhum.
--
-- E a assimetria de `status_manual` (0025) vista de outro angulo: la o manual
-- TRAVA o recalculo inteiro, porque dizer o status de uma demanda e uma
-- escolha que o calculo nao tem como adivinhar. Aqui nao ha o que travar --
-- os dois lados dizem "feito", e OR e a forma mais fraca e mais honesta: ela
-- nao tem como mentir sobre um fato.
--
-- ---------------------------------------------------------------------------
-- E TABELA, E NAO UM JSONB NA FICHA NEM UMA COLUNA POR ITEM
--
-- O jsonb e a tentacao, e a razao contra e a da 0070, palavra por palavra:
-- *num jsonb a tela inventa as chaves, ate a segunda escrever `tom_voz` onde
-- a primeira escreveu `tom_de_voz` -- sem erro de tipo, sem erro de banco, e
-- com o campo aparecendo vazio*. E `check:tipos` liga migration a COLUNA e
-- nao liga chave de jsonb a nada.
--
-- Uma coluna por item seria uma migration por item novo, e a lista de itens
-- mora no CODIGO justamente porque ela versiona com a tela.
--
-- E nao e `localStorage`: a lista e lida por um componente de SERVIDOR, e o
-- que o navegador guarda nao chega la, nao chega no celular da pessoa, e volta
-- vazio numa janela privada. A regra desta casa e a do `artifact`: estado que
-- precisa durar e ser lido de volta mora no banco.
--
-- ---------------------------------------------------------------------------
-- A LINHA E A DISPENSA: nao ha coluna `dispensado`
--
-- Uma `boolean` que vale `true` em toda linha e um campo que nao decide nada,
-- que e o pior tipo de campo (0023). A PRESENCA da linha e o fato, e desticar
-- e o `delete` dela.
--
-- E AQUI HA POLICY DE DELETE, ao contrario de `tour_progresso` -- e a
-- diferenca e o que cada linha significa. La ela registra que a pessoa passou
-- por um tour, e apagar apagaria esse registro; aqui ela e uma escolha de hoje
-- sobre uma lista de boas-vindas, e *"ela dispensou e depois desdispensou"*
-- nao e pergunta de ninguem. Um clique errado tem de poder ser desfeito.
--
-- ---------------------------------------------------------------------------
-- `chave` E `text` SEM CHECK, e e a forma de `tour_progresso.tour_id`
--
-- A lista dos cinco itens mora em `src/lib/dados/primeiros-passos.ts`, e um
-- `check` com os cinco valores obrigaria uma migration a cada item novo --
-- que e o argumento de `posts.formato` na 0032. E a chave torta aqui e
-- INOFENSIVA, ao contrario de `midia`: uma linha com uma chave que nenhum
-- item tem nunca e lida por tela nenhuma, e nao esconde nem inventa nada.
--
-- O `unique (user_id, chave)` e a trava que importa de verdade: ele faz o
-- upsert ser idempotente e impede a tabela crescer no clique repetido.
--
-- ---------------------------------------------------------------------------
-- E ELA FECHA EM `auth.uid()` NAS QUATRO, e a gestao nao le
--
-- Aqui a assimetria de `tour_progresso` -- onde a gestao LE o de todos --
-- nao se repete, e a razao e que ela nao perderia nada: o acompanhamento da
-- gestao mede o TOUR, por `tour_progresso`, e esta tabela nao e um fato sobre
-- o tour. Abrir o SELECT entregaria a lista do que cada pessoa dispensou numa
-- tela que nao existe e que ninguem pediu. E a regua de `academy_anotacoes`
-- (0096) e de `client_notification_prefs` (0031).
--
-- ---------------------------------------------------------------------------
-- E ELA NAO ENCOSTA EM `tour_progresso` NEM EM `academy_progresso`
--
-- Os dois sao o que esta migration tinha mais chance de corromper, e nenhum e
-- tocado:
--
--   * **o tour.** Ticar o item *"Fazer o tour do painel"* grava uma dispensa
--     como os outros quatro, e NAO escreve `pulado` em `tour_progresso`.
--     Aquele valor quer dizer *"abriu o tour e saiu"*, e um tique numa lista
--     de boas-vindas nao e isso -- escreve-lo daqui poria no acompanhamento da
--     gestao linhas de gente que nunca abriu o tour, e as perguntas dele
--     (*quem concluiu*, *em que passo as pessoas desistem*) passariam a contar
--     um clique que nao e sobre a interface do tour. Um mecanismo para os
--     cinco ganha de um caso especial para um, e o caso especial e o que
--     diverge.
--
--   * **o playbook obrigatorio.** Ticar *"Ler os playbooks obrigatorios"*
--     tira a linha da lista de boas-vindas e NAO marca nada como lido:
--     `academy_progresso` fica como estava, `academy_obrigatorios_de()`
--     continua respondendo que falta, e o acompanhamento da gestao continua
--     dizendo a verdade. A obrigacao mora onde sempre morou. *Isto e dito em
--     vez de escondido, porque e o item dos cinco em que ela mais pesa:* se a
--     agencia preferir que o playbook obrigatorio NAO seja dispensavel, e uma
--     linha em `lib/dados/primeiros-passos.ts` (`dispensavel: false`), e nao
--     uma mudanca aqui.
--
-- ---------------------------------------------------------------------------
-- NAO HA "DISPENSAR TUDO", e a ausencia e decisao
--
-- A lista tem cinco linhas, e um botao *"ja conheco a plataforma"* seria o
-- unico clique do produto que fecha uma lista que ninguem leu -- e o que a
-- pessoa dispensa item a item ela leu item a item. Cinco cliques fecham o
-- bloco de vez.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A tabela
--
-- `on delete cascade` em `user_id` pela razao da 0101: o desligamento deste
-- produto e `profiles.ativo = false`, que preserva a linha -- o cascade vale
-- para a exclusao de verdade, que quase nunca acontece. E aqui ele e o certo
-- sem ressalva nenhuma: a dispensa de uma pessoa apagada nao e registro de
-- nada (ao contrario de `approval_round_aprovadores`, onde a linha diz que um
-- material FOI mandado para alguem).
-- ---------------------------------------------------------------------------
create table if not exists public.primeiros_passos_dispensados (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  -- Qual item: 'tour', 'foto', 'playbooks', 'etapa', 'full-day'. A lista mora
  -- em `src/lib/dados/primeiros-passos.ts`, ao lado do que deriva cada um --
  -- a forma de `tour_progresso.tour_id`.
  chave         text not null,
  dispensado_em timestamptz not null default now(),
  -- UMA LINHA POR PESSOA POR ITEM: o upsert e idempotente e o clique repetido
  -- nao faz a tabela crescer.
  unique (user_id, chave)
);

comment on table public.primeiros_passos_dispensados is
  'Os itens de Primeiros passos que a pessoa marcou como "ja sei fazer" (0131). O item fecha com derivado OR dispensado: ticar so FECHA, nunca reabre o que o estado ja fechou. Nao e um fato sobre o tour nem sobre a leitura obrigatoria -- tour_progresso e academy_progresso continuam dizendo a verdade.';
comment on column public.primeiros_passos_dispensados.chave is
  'A chave do item, como ela esta escrita em src/lib/dados/primeiros-passos.ts. Sem check de proposito: a lista versiona com a tela, e uma chave que nenhum item tem nunca e lida.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - RLS
--
-- As quatro em `auth.uid()`, sem excecao para a gestao. `user_id` vai no
-- `with check` do INSERT para a linha nao poder nascer no nome de outra
-- pessoa, e o `using` do UPDATE serve tambem de check -- a regra de fallback
-- que a 0101 mediu --, mas o `with check` fica escrito de qualquer forma,
-- pela razao do par nomeado: `using` e `with check` respondem perguntas
-- diferentes, e deixar a segunda implicita faz quem vier depois ter de
-- lembrar da regra para saber se a trava existe.
--
-- O UPDATE existe porque o upsert da action passa por ele quando a linha ja
-- esta la: sem a policy, reticar um item ja dispensado seria recusado pela RLS
-- num clique que nao muda nada.
-- ---------------------------------------------------------------------------
alter table public.primeiros_passos_dispensados enable row level security;

drop policy if exists primeiros_passos_dispensados_select on public.primeiros_passos_dispensados;
create policy primeiros_passos_dispensados_select on public.primeiros_passos_dispensados
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists primeiros_passos_dispensados_insert on public.primeiros_passos_dispensados;
create policy primeiros_passos_dispensados_insert on public.primeiros_passos_dispensados
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists primeiros_passos_dispensados_update on public.primeiros_passos_dispensados;
create policy primeiros_passos_dispensados_update on public.primeiros_passos_dispensados
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists primeiros_passos_dispensados_delete on public.primeiros_passos_dispensados;
create policy primeiros_passos_dispensados_delete on public.primeiros_passos_dispensados
  for delete to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- CONFERENCIA - nao escreve nada
-- ---------------------------------------------------------------------------

select
  'tabela'       as o_que,
  count(*)::text as resposta
from information_schema.tables
where table_schema = 'public'
  and table_name   = 'primeiros_passos_dispensados'
union all
select
  'policies (esperado 4)',
  count(*)::text
from pg_policies
where schemaname = 'public'
  and tablename  = 'primeiros_passos_dispensados'
union all
select
  'rls ligada',
  case when bool_and(relrowsecurity) then 'sim' else 'NAO' end
from pg_class
where oid = 'public.primeiros_passos_dispensados'::regclass
union all
select
  'dispensas gravadas',
  count(*)::text
from public.primeiros_passos_dispensados;
