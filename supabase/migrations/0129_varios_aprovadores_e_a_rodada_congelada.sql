-- =============================================================================
-- 0129 — VÁRIOS APROVADORES, A SUBSTITUIÇÃO DEPOIS DO ENVIO, E A RODADA FECHADA
--        QUE PASSA A CONGELAR
-- =============================================================================
--
-- Decisão do usuário, item 15: *"vários responsáveis e substituição após o
-- envio"* — mais de uma pessoa nomeada para aprovar, e trocar quem recebe sem
-- recriar a rodada nem a task.
--
-- E, medido no caminho, a trava do item 17: **a rodada fechada não congelava.**
--
-- -----------------------------------------------------------------------------
-- O QUE A 0128 DEIXOU E O QUE FALTA
--
--   | o pedido                       | onde já estava                        |
--   | ------------------------------ | ------------------------------------- |
--   | quem recebe, nomeado no envio  | `approval_rounds.aprovador_id` (0128) |
--   | a lista de quem pode aprovar   | `aprovadores_da_conta()` (0128)       |
--   | a trava da abertura            | `validar_nova_rodada` (0128)          |
--   | o aviso de quem foi nomeado    | `approval_rounds_avisa_o_cliente`     |
--   | **mais de uma pessoa**         | **não existia**                       |
--   | **trocar depois do envio**     | **não existia**                       |
--   | **reenviar o aviso**           | **não existia**                       |
--
-- -----------------------------------------------------------------------------
-- A MEDIÇÃO QUE DECIDE A FORMA: UM VÍNCULO DE PORTAL NO BANCO INTEIRO.
--
-- `select count(*) from client_users` devolve **1**, e `aprovadores_da_conta()`
-- devolve no máximo UMA pessoa em qualquer conta deste banco — zero nas outras
-- 27, que é a medição que a 0128 já tinha feito.
--
-- **E isso não é razão para não construir, é razão para dizer o que a tela
-- mostra hoje.** O modelo precisa aceitar N porque *"o diretor de marketing e
-- o sócio assinam juntos"* é o caso normal no dia em que a agência der acesso a
-- duas pessoas — e o que a trava exige continua satisfazível com uma escolha
-- só. O que esta migration NÃO faz é inventar a segunda pessoa: o seletor
-- oferece quem existe.
--
-- -----------------------------------------------------------------------------
-- A FORMA É A DA 0114, E A RECUSA DA ÚLTIMA É A DA 0113.
--
-- `aprovador_id` CONTINUA, e é a PRIMEIRA pessoa: ela é lida pelo índice
-- parcial da 0128, pelo gatilho do aviso, por `validar_nova_rodada`, por
-- `enviar_mes_ao_cliente`, por `lib/dados/tasks.ts` e pelo painel da etapa —
-- e um array no lugar dela mexeria nos seis. É a decisão da 0114 palavra por
-- palavra: *a coluna passa a ser a primeira pessoa, e a tabela é quem manda*.
--
-- **Mas a última pessoa NÃO pode sair, e aqui a 0114 não serve.** Lá *"etapa
-- sem responsável"* é um estado que o produto desenha — o board diz isso. Aqui
-- *"rodada de cliente sem aprovador"* é um estado que a 0128 RECUSA na
-- abertura: deixá-lo alcançável por um `delete` seria a trava oferecendo pela
-- porta de trás o que ela fechou pela frente. Então é a 0113: a tabela recusa
-- tirar a última, como `task_recurrence_clients` recusa tirar a última conta.
--
-- -----------------------------------------------------------------------------
-- E A TABELA NÃO TEM POLICY DE ESCRITA NENHUMA.
--
-- Quem escreve é o gatilho (que é `security definer`) e as duas funções deste
-- arquivo. É a forma de `notifications`, que não tem policy de INSERT desde a
-- 0011 — *"se qualquer usuário pudesse inserir, daria para forjar"* —, e de
-- `rate_limits` (0056), que tem RLS ligada e policy nenhuma. Uma policy de
-- escrita aqui seria uma segunda porta para a mesma lista, e a que divergiria
-- é a policy, porque ninguém a relê ao mexer na função.
--
-- **O SELECT é `is_staff()` e o cliente não entra**, que é o que a 0128 já
-- havia decidido sem dizer: ele recebe o aviso, e quem foi nomeado é cobrança
-- da agência — não há hierarquia do lado dele, então saber quem a agência
-- nomeou não decide nada para ele.
--
-- -----------------------------------------------------------------------------
-- O AVISO DO INSERT CONTINUA SENDO DE `aprovador_id`, e a razão é de ORDEM.
--
-- Os gatilhos `after insert` de uma tabela disparam em ordem de NOME, e
-- `approval_rounds_avisa_o_cliente` vem antes de
-- `approval_rounds_vincula_aprovador`: no instante do aviso a tabela de
-- vínculo ainda está vazia. Então o aviso da ABERTURA fica como a 0128 o
-- escreveu — uma pessoa, a primeira —, e quem avisa as outras é a função que
-- as ACRESCENTA. Com isso o gatilho da 0128 não precisa ser reescrito, o que
-- é uma cópia INTEIRA a menos (0030).
--
-- -----------------------------------------------------------------------------
-- A SUBSTITUIÇÃO É FUNÇÃO E NÃO POLICY, e isto foi medido.
--
-- `approval_rounds` tem **uma** policy de UPDATE: `approval_rounds_decide`, e
-- ela é `pode_aprovar_subtarefa / _post / _entregavel` — que depois da 0029 é
-- `is_gestor()` e nada mais. Ou seja, a policy que governaria a troca é a que
-- responde *"quem DECIDE"*.
--
-- E quem ENVIA não é a mesma lista: `enviar_mes_ao_cliente` é
-- `is_gestor() or is_atendimento()` desde a 0090. **O colaborador do
-- Atendimento que mandou o mês não conseguiria corrigir quem recebe** — é a
-- 0059 pelo avesso, onde a guarda estava mais apertada que o banco.
--
-- Alargar `approval_rounds_decide` para o Atendimento resolveria a troca e
-- daria de lambuja o poder de DECIDIR uma rodada interna, que é exatamente o
-- que a 0029 manteve fechado (*"Colaborador continua sem decidir nada"*). São
-- duas perguntas diferentes, então a troca é `security definer` com a pergunta
-- escrita à mão — a forma de `cancelar_solicitacao` (0106) e de
-- `decidir_rodada_do_cliente` (0032).
--
-- -----------------------------------------------------------------------------
-- A RODADA FECHADA NÃO CONGELAVA, E ISTO É UM FURO MEDIDO.
--
-- O CLAUDE.md afirma, em três lugares, que *"rodada fechada nunca é reescrita
-- nem apagada"* — e que `approval_rounds` fica fora do `audit_log`
-- **justamente por isso**, por já ser o registro imutável. Medido contra este
-- Postgres, como o sócio, numa transação revertida, sobre uma rodada
-- `aprovada`:
--
--   | o que se tentou        | o que aconteceu              |
--   | ---------------------- | ---------------------------- |
--   | reescrever `comentario`| **1 linha reescrita**        |
--   | `numero_rodada := 99`  | **passou**                   |
--   | trocar `decidido_por`  | **passou**                   |
--   | `escopo` interna→cliente| **passou**                  |
--   | `decidido_em := null`  | **passou**                   |
--
-- A metade do DELETE é verdade (não há policy de DELETE). **A metade da
-- reescrita era falsa:** `proteger_rodada_fechada` conferia o `status` e mais
-- nada, e todas as outras colunas de uma rodada fechada eram graváveis por
-- qualquer `is_gestor()` pela única policy de UPDATE.
--
-- É a 0127 repetida: *"eu escrevi que a regra morava nos dois lados e ela
-- morava em um"*. E aqui o preço é maior, porque o argumento de a tabela ficar
-- fora da trilha de auditoria é a imutabilidade — que o furo desmentia.
--
-- **E ELA ENTRA NESTE ARQUIVO e não no seguinte**, porque as duas pontas são a
-- mesma pergunta vista dos dois lados: *o que de uma rodada ainda muda, e para
-- quem*. Congelar sem a substituição trancaria o que o item 15 pede; abrir a
-- substituição sem congelar deixaria trocar quem recebeu uma peça que o cliente
-- já aprovou. Saem no mesmo commit.
--
-- -----------------------------------------------------------------------------
-- O QUE CONGELA, E O QUE NÃO
--
--   * **sempre** — a IDENTIDADE da rodada: `content_type`, `content_id`,
--     `numero_rodada`, `escopo`, `solicitado_por`, `solicitado_em`, `lote_id`.
--     Nenhum caminho do produto escreve nelas depois do insert: os quatro
--     `update` de `src/` e os cinco do SQL escrevem `status`, `decidido_por`,
--     `decidido_em` e `comentario`, sempre juntos e sempre sobre uma rodada
--     `pendente` — conferido um por um antes de escrever esta trava.
--   * **fechada** — tudo o mais: `comentario`, `decidido_por`, `decidido_em`,
--     `aprovador_id`, `mensagem`.
--   * **pendente** — `aprovador_id` e `mensagem` continuam graváveis, que é o
--     item 15; e a transição da decisão escreve os três campos dela, porque
--     ali `old.status` É `pendente`.
--
-- **A ORDEM DOS RAMOS FOI ESCOLHIDA.** O ramo do `status` que já existe vem
-- PRIMEIRO, e a frase dele continua sendo a que aparece quando alguém tenta
-- decidir duas vezes — *"já decidida não muda de resultado"*, com a dica que
-- diz que cada ciclo cria uma rodada nova. Pondo o congelamento na frente, o
-- duplo clique passaria a levar uma mensagem sobre reescrita.
--
-- -----------------------------------------------------------------------------
-- MEDIDO CONTRA ESTE POSTGRES, TREZE CASOS NUMA TRANSAÇÃO REVERTIDA
--
-- Como o sócio, sobre a rodada `aprovada` e a `pendente` que o banco tem, com
-- duas pessoas ganhando acesso ao portal da Mundo Verde dentro da transação:
--
--    1. reescrever o `comentario` da FECHADA → *"já decidida não se reescreve"*
--    2. `numero_rodada := 99` na PENDENTE → *"a identidade … não se reescreve"*
--    3. nomear duas pessoas → lista com 2, e `aprovador_id` é a PRIMEIRA
--    4. nomear quem não aprova pela conta → *"não aprova pela Mundo Verde"*
--    5. lista vazia → *"escolha pelo menos uma pessoa"*
--   6a. `delete` como `authenticated` → **2 vínculos restantes**: a tabela não
--       tem policy de escrita, e o comando não apaga nada
--   6b. tirar a primeira de duas, como dono da tabela → passa, e
--       `aprovador_id` reaponta para a segunda
--   6c. tirar a ÚLTIMA, como dono da tabela → *"não fica sem ninguém nomeado"*
--    7. reenviar o aviso → **2 avisos**, um por pessoa nomeada
--    8. reenviar numa rodada FECHADA → recusado
--    9. substituir duas por uma → lista com 1, e a coluna aponta para ela
--   10. apagar a RODADA (o caminho de `subtasks_limpa_rodadas`) → ela sai e os
--       vínculos vão com ela, **sem o `raise` da última abortar o cascade**
--   11. a DECISÃO de uma rodada pendente — os quatro campos juntos, que é o que
--       os quatro `update` de `src/` escrevem → **passa**
--   12. reescrever a mesma linha depois de decidida → recusado
--   13. decidir DUAS VEZES → *"já decidida não muda de resultado"*, que é a
--       frase antiga: a ordem dos ramos do PASSO 8 está certa
--
-- ***E a bateria não foi rodada***: não há Docker nem Postgres local neste
-- ambiente. O que existe no lugar da execução é a medição acima.
--
-- -----------------------------------------------------------------------------
-- PASSOS
--   1. a tabela de vínculo
--   2. a conversão das rodadas que já têm aprovador
--   3. os dois lados se mantêm em dia, e a última não sai
--   4. `aprovadores_da_rodada()` — a leitura
--   5. `definir_aprovadores_da_rodada()` — a escrita e a troca
--   6. `definir_aprovadores_do_lote()` — o mês inteiro
--   7. `reenviar_aviso_da_rodada()`
--   8. `proteger_rodada_fechada` — a função copiada INTEIRA
--   9. conferência
-- =============================================================================


-- =============================================================================
-- PASSO 1 — A TABELA DE VÍNCULO
-- =============================================================================

create table if not exists public.approval_round_aprovadores (
  round_id   uuid not null references public.approval_rounds (id) on delete cascade,
  user_id    uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

-- A CHAVE ESTRANGEIRA DE `user_id` É SEM AÇÃO, como `aprovador_id` na 0128 e
-- como `solicitado_por` na 0007: apagar o perfil não pode apagar o registro de
-- que aquela pessoa recebeu o material. Ninguém com histórico é apagado neste
-- produto — o caminho é desativar —, então a ação quase nunca dispara; quando
-- disparar, o certo é recusar. (É diferente da 0114, onde ela é
-- `on delete cascade`: lá a linha diz quem FAZ a etapa hoje, e aqui ela diz
-- quem RECEBEU um envio que já aconteceu.)

comment on table public.approval_round_aprovadores is
  'Quem a agência nomeou para aprovar esta rodada (0129). '
  '`approval_rounds.aprovador_id` é a PRIMEIRA pessoa, mantida em dia por '
  'gatilho; esta tabela é quem manda. A chave composta impede a mesma pessoa '
  'duas vezes — sem ela o aviso sairia em dobro. Não é tranca: quem DECIDE '
  'continua sendo qualquer pessoa da empresa (0128).';

create index if not exists approval_round_aprovadores_pessoa_idx
  on public.approval_round_aprovadores (user_id);

alter table public.approval_round_aprovadores enable row level security;

-- SÓ LEITURA, E SÓ DA EQUIPE. As escritas são do gatilho e das funções deste
-- arquivo, que são `security definer` — a forma de `notifications` (0011) e de
-- `rate_limits` (0056).
drop policy if exists approval_round_aprovadores_select on public.approval_round_aprovadores;
create policy approval_round_aprovadores_select on public.approval_round_aprovadores
  for select using (public.is_staff());


-- =============================================================================
-- PASSO 2 — A CONVERSÃO
--
-- Toda rodada que já tem aprovador ganha a linha dela. Sem isto,
-- `aprovadores_da_rodada()` devolveria lista VAZIA para as rodadas abertas
-- antes desta migration — e a tela diria "ninguém nomeado" sobre um envio que
-- nomeou alguém, que é a classe de erro plausível que a 0114 escreveu.
-- =============================================================================

insert into public.approval_round_aprovadores (round_id, user_id)
select id, aprovador_id
  from public.approval_rounds
 where aprovador_id is not null
on conflict do nothing;


-- =============================================================================
-- PASSO 3 — OS DOIS LADOS SE MANTÊM EM DIA
-- =============================================================================

-- A RODADA QUE NASCE COM APROVADOR GANHA A LINHA. Sem este gatilho, a rodada
-- criada por qualquer caminho que não conheça a tabela — o `insert` colado no
-- SQL Editor, o seed, um PATCH montado à mão — nasceria com `aprovador_id`
-- preenchido e lista VAZIA.
--
-- **E TROCAR A COLUNA TIRA O ANTIGO**, que é o que faz a troca de uma pessoa
-- continuar significando troca. Sem isto, substituir pela tela ACRESCENTARIA
-- uma, e quem saiu continuaria contando como nomeado. É a 0114 letra por letra.
create or replace function public.rodada_vincula_o_aprovador()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.aprovador_id is not null then
    insert into public.approval_round_aprovadores (round_id, user_id)
    values (new.id, new.aprovador_id)
    on conflict do nothing;
  end if;

  if tg_op = 'UPDATE'
     and old.aprovador_id is not null
     and old.aprovador_id is distinct from new.aprovador_id then
    delete from public.approval_round_aprovadores
     where round_id = new.id and user_id = old.aprovador_id;
  end if;

  return new;
end;
$fn$;

drop trigger if exists approval_rounds_vincula_aprovador on public.approval_rounds;
create trigger approval_rounds_vincula_aprovador
  after insert or update of aprovador_id on public.approval_rounds
  for each row execute function public.rodada_vincula_o_aprovador();


-- QUEM É NOMEADO TEM DE APROVAR POR ESTA CONTA, e a pergunta é a MESMA que
-- `validar_nova_rodada` faz na abertura: `aprovadores_da_conta()`. Duas
-- consultas com o mesmo `where` seriam o lugar onde a trava do insert e a da
-- tabela começam a divergir, e a que divergiria é esta, porque ninguém a relê.
--
-- **E ela não exige `pendente`**, de propósito: o PASSO 2 acabou de vincular
-- rodadas FECHADAS, e o seed abre rodada já aprovada. Quem exige rodada aberta
-- é a função do PASSO 5, que é por onde uma pessoa escreve.
create or replace function public.aprovador_pertence_a_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r       public.approval_rounds;
  conta   uuid;
  empresa text;
begin
  select * into r from public.approval_rounds where id = new.round_id;

  if r.id is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Rodada de aprovação não encontrada.';
  end if;

  if r.escopo <> 'cliente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Só a rodada do cliente tem aprovador nomeado.',
      hint    = 'A rodada interna é decidida pela gestão, e quem decide não é nomeado no envio.';
  end if;

  conta := public.cliente_da_rodada(r.content_type, r.content_id);

  if conta is null or not exists (
    select 1 from public.aprovadores_da_conta(conta) a where a.user_id = new.user_id
  ) then
    select c.nome_empresa into empresa from public.clients c where c.id = conta;
    raise exception using
      errcode = 'check_violation',
      message = format('Quem você escolheu não aprova pela %s.', coalesce(empresa, 'empresa')),
      hint    = 'O aprovador tem de ser uma pessoa ativa com acesso ao portal desta conta.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists approval_round_aprovadores_pertence on public.approval_round_aprovadores;
create trigger approval_round_aprovadores_pertence
  before insert on public.approval_round_aprovadores
  for each row execute function public.aprovador_pertence_a_conta();


-- `aprovador_id` ACOMPANHA A TABELA, e A ÚLTIMA NÃO SAI.
--
-- As duas metades vivem na mesma função porque são a mesma escrita vista de
-- dois momentos: antes de apagar, confere-se que sobra alguém; depois,
-- reaponta-se a coluna para quem sobrou. Com a recusa de pé, `aprovador_id`
-- de uma rodada de cliente nunca volta a ser nulo — que é a diferença desta
-- tabela para a da 0114.
--
-- **A GUARDA DO CASCADE AQUI É TRAVA, E NÃO ECONOMIA.** Na 0114 ela existe
-- para o `update` não rodar uma vez por linha num apagamento; aqui, sem ela, o
-- `raise` da última pessoa ABORTARIA o apagamento da rodada — e rodada é
-- apagada por caminho de produto (`subtasks_limpa_rodadas`, 0030, quando a
-- etapa sai). É o que a 0113 pagou com a bateria morrendo no meio de um
-- `delete`.
create or replace function public.rodada_acompanha_os_aprovadores()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r     public.approval_rounds;
  resta uuid;
begin
  select * into r from public.approval_rounds where id = old.round_id;

  -- A RODADA ESTÁ INDO EMBORA? Então não há o que recusar nem o que acertar.
  if r.id is null then
    return old;
  end if;

  if tg_op = 'DELETE' and tg_when = 'BEFORE' then
    if r.escopo = 'cliente' and not exists (
      select 1 from public.approval_round_aprovadores a
       where a.round_id = old.round_id and a.user_id <> old.user_id
    ) then
      raise exception using
        errcode = 'check_violation',
        message = 'Uma rodada enviada ao cliente não fica sem ninguém nomeado.',
        hint    = 'Troque o aprovador em vez de tirá-lo: o envio registra quem recebeu, e sem nome ninguém é avisado.';
    end if;
    return old;
  end if;

  select a.user_id into resta
    from public.approval_round_aprovadores a
   where a.round_id = old.round_id
   order by a.created_at, a.user_id
   limit 1;

  update public.approval_rounds
     set aprovador_id = resta
   where id = old.round_id
     and aprovador_id = old.user_id
     and resta is not null;

  return old;
end;
$fn$;

drop trigger if exists approval_round_aprovadores_nao_fica_vazia on public.approval_round_aprovadores;
create trigger approval_round_aprovadores_nao_fica_vazia
  before delete on public.approval_round_aprovadores
  for each row execute function public.rodada_acompanha_os_aprovadores();

drop trigger if exists approval_round_aprovadores_acompanha on public.approval_round_aprovadores;
create trigger approval_round_aprovadores_acompanha
  after delete on public.approval_round_aprovadores
  for each row execute function public.rodada_acompanha_os_aprovadores();


-- =============================================================================
-- PASSO 4 — A LEITURA
--
-- `security definer` pela razão da 0128: `profiles_select` é
-- `own or is_gestor()`, e o colaborador do Atendimento envia o mês desde a
-- 0090 — sem ela a tela dele leria a lista vazia e afirmaria que ninguém foi
-- nomeado. A guarda é `is_staff()` escrita à mão, como em
-- `aprovadores_da_conta()`: ela devolve NOME E E-MAIL, e sem a guarda quem
-- tivesse a chave anon leria os contatos do portal passando o uuid da rodada.
-- =============================================================================

create or replace function public.aprovadores_da_rodada(p_round_id uuid)
returns table (user_id uuid, nome text, email text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.is_staff() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Só a equipe lê quem foi nomeado para aprovar.';
  end if;

  return query
    select p.id, p.nome, p.email
      from public.approval_round_aprovadores a
      join public.profiles p on p.id = a.user_id
     where a.round_id = p_round_id
     order by a.created_at, p.nome;
end;
$fn$;

revoke all on function public.aprovadores_da_rodada(uuid) from public;
revoke all on function public.aprovadores_da_rodada(uuid) from anon;
grant execute on function public.aprovadores_da_rodada(uuid) to authenticated;

comment on function public.aprovadores_da_rodada(uuid) is
  'Quem a agência nomeou para aprovar esta rodada, na ordem em que foram '
  'nomeados (0129). A primeira é `approval_rounds.aprovador_id`.';


-- =============================================================================
-- PASSO 5 — A ESCRITA E A TROCA
--
-- UMA FUNÇÃO PARA OS DOIS MOMENTOS: acrescentar no envio e substituir depois.
-- Duas funções seriam duas respostas para *"quem pode ser nomeado nesta
-- rodada"*, e a que divergiria é a da troca, que é a menos percorrida.
--
-- **QUEM PODE É `is_gestor() or is_atendimento()`**, que é a MESMA pergunta de
-- `enviar_mes_ao_cliente` (0090): quem pôde enviar tem de poder corrigir quem
-- recebe. A policy da tabela responde outra coisa — ver o cabeçalho.
--
-- **SÓ RODADA ABERTA.** Trocar quem recebeu uma peça que o cliente já decidiu
-- é reescrever o registro do envio, e é o que o PASSO 8 passa a recusar no
-- banco: aqui a recusa chega com a frase que diz o que fazer.
--
-- **A LISTA NÃO FICA VAZIA**, pela trava da 0128: rodada de cliente sem
-- aprovador não é avisada a ninguém.
--
-- **E ELA AVISA QUEM ENTROU, e mais ninguém.** Quem já estava não recebe de
-- novo — seria a mesma cobrança duas vezes, e o reenvio tem função própria
-- (PASSO 7). Quem SAIU não recebe nada: não existe aviso de "você foi
-- retirado", e inventá-lo seria um sino que não leva a lugar nenhum.
-- =============================================================================

create or replace function public.definir_aprovadores_da_rodada(
  p_round_id     uuid,
  p_aprovadores  uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r        public.approval_rounds;
  lista    uuid[];
  nome     text;
  destino  text;
  pessoa   uuid;
  novos    uuid[] := '{}';
  quantos  integer;
begin
  if not (public.is_gestor() or public.is_atendimento()) then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Nomear quem aprova é da gestão ou do Atendimento.';
  end if;

  select * into r from public.approval_rounds where id = p_round_id;
  if r.id is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Rodada de aprovação não encontrada.';
  end if;

  if r.escopo <> 'cliente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Só a rodada do cliente tem aprovador nomeado.',
      hint    = 'Quem decide a rodada interna é a gestão, e não uma pessoa nomeada no envio.';
  end if;

  if r.status <> 'pendente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Esta rodada já foi decidida: quem recebeu continua registrado.',
      hint    = 'Para mandar o material a outra pessoa, envie uma rodada nova — a anterior fica no histórico com quem a recebeu.';
  end if;

  -- A ORDEM DO CHAMADOR É A ORDEM DA LISTA, e por isso o dedupe NÃO é
  -- `array_agg(distinct ...)`: `distinct` força uma ordenação pelo uuid, e com
  -- ela `aprovador_id` passaria a ser a pessoa de uuid menor em vez da
  -- primeira escolhida — a coluna deixaria de significar "a primeira".
  select array_agg(x order by ord) into lista
    from (select x, min(ord) as ord
            from unnest(coalesce(p_aprovadores, '{}'::uuid[])) with ordinality as t(x, ord)
           where x is not null
           group by x) s;

  if lista is null or array_length(lista, 1) is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Escolha pelo menos uma pessoa para aprovar.',
      hint    = 'O envio registra quem recebeu, e o aviso vai para essas pessoas. Qualquer pessoa da empresa continua podendo responder.';
  end if;

  -- QUEM ENTROU, antes de escrever: é esta lista que recebe o aviso no fim, e
  -- calculá-la depois do `insert` devolveria todo mundo.
  --
  -- A PERTINÊNCIA À CONTA NÃO É CONFERIDA AQUI, e a ausência é decisão: quem a
  -- confere é o gatilho do PASSO 3, com a MESMA pergunta que
  -- `validar_nova_rodada` faz na abertura. Repeti-la seria a segunda verdade
  -- sobre quem aprova pela conta, e a que divergiria é esta.
  select array_agg(x) into novos
    from unnest(lista) as x
   where not exists (
     select 1 from public.approval_round_aprovadores a
      where a.round_id = p_round_id and a.user_id = x
   );

  -- A COLUNA PRIMEIRO, E A LIMPEZA DEPOIS. `aprovador_id` aponta para a
  -- primeira da lista nova antes de qualquer `delete`, senão a recusa da
  -- última pessoa (PASSO 3) dispararia ao tirar quem está sozinho na rodada.
  insert into public.approval_round_aprovadores (round_id, user_id)
  select p_round_id, x from unnest(lista) as x
  on conflict do nothing;

  update public.approval_rounds
     set aprovador_id = lista[1]
   where id = p_round_id;

  delete from public.approval_round_aprovadores a
   where a.round_id = p_round_id
     and not (a.user_id = any (lista));

  -- O AVISO DE QUEM ENTROU. O nome do material e o destino saem do tipo, como
  -- no gatilho da 0128 — um aviso que diz só "um material chegou" obriga a
  -- pessoa a abrir para descobrir o que é.
  --
  -- **E ELE CALA DENTRO DO LOTE (PASSO 6)**, que é a razão de o GUC existir: um
  -- mês de dezoito peças daria dezoito sinos para o mesmo fato, e o aviso do
  -- lote é um só desde a 0090. Lá o laço desliga isto e avisa uma vez no fim.
  if novos is not null and array_length(novos, 1) is not null
     and coalesce(current_setting('full_hub.aviso_do_lote', true), 'off') <> 'on' then
    if r.content_type = 'post' then
      select p.tema into nome from public.posts p where p.id = r.content_id;
      destino := '/portal/social-media';
    elsif r.content_type = 'deliverable' then
      select d.nome into nome from public.deliverables d where d.id = r.content_id;
      destino := '/portal/campanhas';
    else
      select s.titulo into nome from public.subtasks s where s.id = r.content_id;
      destino := '/portal/itens';
    end if;

    foreach pessoa in array novos loop
      perform public.notificar(
        pessoa, 'aprovacao',
        format('%s está esperando a sua aprovação', coalesce(nome, 'Um material')),
        coalesce(
          nullif(btrim(coalesce(r.mensagem, '')), ''),
          'A Full enviou e está aguardando a sua decisão.'
        ),
        destino
      );
    end loop;
  end if;

  select count(*)::integer into quantos
    from public.approval_round_aprovadores where round_id = p_round_id;

  return quantos;
end;
$fn$;

revoke all on function public.definir_aprovadores_da_rodada(uuid, uuid[]) from public;
revoke all on function public.definir_aprovadores_da_rodada(uuid, uuid[]) from anon;
grant execute on function public.definir_aprovadores_da_rodada(uuid, uuid[]) to authenticated;

comment on function public.definir_aprovadores_da_rodada(uuid, uuid[]) is
  'Nomeia quem aprova esta rodada — no envio e na substituição (0129). Só '
  'rodada de cliente ainda pendente; a lista não fica vazia; avisa quem '
  'entrou. Da gestão ou do Atendimento, que é a mesma pergunta de quem envia.';


-- =============================================================================
-- PASSO 6 — O MÊS INTEIRO
--
-- O lote da 0090 abre UMA rodada por peça, e `enviar_mes_ao_cliente` recebe um
-- aprovador só — a assinatura dela não muda, pela razão da 0061: `create or
-- replace` não troca a lista de argumentos, e um `drop`+`create` abre a janela
-- em que a tela no ar chama uma função que não existe, que a 0120 pagou.
--
-- Então o mês nomeia os outros DEPOIS, por aqui. **É um laço sobre a função do
-- PASSO 5 e não uma segunda implementação**, que é a forma de `quem_atende()`:
-- a regra mora num lugar, e dezoito peças não podem ter dezoito respostas para
-- quem pode aprovar.
--
-- **E ele não avisa dezoito vezes por pessoa.** O aviso do lote é um só desde a
-- 0090 — *"um mês de dezoito peças daria dezoito sinos para o mesmo fato"* —,
-- então o laço desliga o aviso da função do PASSO 5 por um GUC de escopo local,
-- e o lote avisa no fim, uma vez por pessoa que entrou. A saída de emergência
-- é desligada antes de a função devolver, que é a regra da 0045.
-- =============================================================================

create or replace function public.definir_aprovadores_do_lote(
  p_lote_id      uuid,
  p_aprovadores  uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rodada   uuid;
  pessoa   uuid;
  novos    uuid[] := '{}';
  quantas  integer := 0;
  mes      text;
begin
  if not (public.is_gestor() or public.is_atendimento()) then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Nomear quem aprova é da gestão ou do Atendimento.';
  end if;

  if not exists (select 1 from public.social_lotes l where l.id = p_lote_id) then
    raise exception using
      errcode = 'check_violation',
      message = 'Esse envio do mês não existe.';
  end if;

  -- QUEM ENTROU EM ALGUMA DAS RODADAS, antes de escrever.
  select array_agg(distinct x) into novos
    from unnest(coalesce(p_aprovadores, '{}'::uuid[])) as x
   where x is not null
     and exists (
       select 1 from public.approval_rounds r
        where r.lote_id = p_lote_id
          and not exists (
            select 1 from public.approval_round_aprovadores a
             where a.round_id = r.id and a.user_id = x
          )
     );

  perform set_config('full_hub.aviso_do_lote', 'on', true);

  for rodada in
    select r.id from public.approval_rounds r
     where r.lote_id = p_lote_id and r.status = 'pendente'
     order by r.created_at
  loop
    perform public.definir_aprovadores_da_rodada(rodada, p_aprovadores);
    quantas := quantas + 1;
  end loop;

  perform set_config('full_hub.aviso_do_lote', 'off', true);

  if novos is not null and array_length(novos, 1) is not null and quantas > 0 then
    select to_char(t.social_do_mes, 'MM/YYYY') into mes
      from public.social_lotes l
      join public.tasks t on t.id = l.task_id
     where l.id = p_lote_id;

    foreach pessoa in array novos loop
      perform public.notificar(
        pessoa, 'aprovacao',
        format('%s materiais de %s estão esperando a sua aprovação', quantas, coalesce(mes, 'social')),
        'A Full enviou o mês e está aguardando a sua decisão.',
        '/portal/social-media'
      );
    end loop;
  end if;

  return quantas;
end;
$fn$;

revoke all on function public.definir_aprovadores_do_lote(uuid, uuid[]) from public;
revoke all on function public.definir_aprovadores_do_lote(uuid, uuid[]) from anon;
grant execute on function public.definir_aprovadores_do_lote(uuid, uuid[]) to authenticated;

comment on function public.definir_aprovadores_do_lote(uuid, uuid[]) is
  'Nomeia quem aprova o mês inteiro (0129): laço sobre '
  '`definir_aprovadores_da_rodada` para cada peça pendente do lote, com UM '
  'aviso por pessoa no fim — o aviso do lote é um só desde a 0090.';


-- =============================================================================
-- PASSO 7 — REENVIAR O AVISO, SEM RECRIAR NADA
--
-- *"Reenviar sem recriar a task"* é o pedido, e a razão de ele ser uma função e
-- não "enviar de novo" é a numeração: abrir outra rodada afirmaria que existe
-- uma VERSÃO nova do material, e o número da rodada é a versão da peça desde a
-- 0033. O material é o mesmo, o envio é o mesmo — o que se repete é o toque no
-- sino.
--
-- **E ele não mexe em `solicitado_em`**, que é quando o material saiu: é esse
-- instante que a escada de andamento do portal data, e reescrevê-lo faria a
-- peça parecer recém-enviada depois de uma semana parada. Quem lembra é a
-- pessoa; o que o produto registra é o envio.
-- =============================================================================

create or replace function public.reenviar_aviso_da_rodada(p_round_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r       public.approval_rounds;
  nome    text;
  destino text;
  pessoa  record;
  quantos integer := 0;
begin
  if not (public.is_gestor() or public.is_atendimento()) then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Reenviar o aviso é da gestão ou do Atendimento.';
  end if;

  select * into r from public.approval_rounds where id = p_round_id;
  if r.id is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Rodada de aprovação não encontrada.';
  end if;

  if r.escopo <> 'cliente' or r.status <> 'pendente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Só há o que reenviar numa rodada de cliente ainda esperando decisão.',
      hint    = 'A rodada já decidida fica no histórico com quem a recebeu e o que foi respondido.';
  end if;

  if r.content_type = 'post' then
    select p.tema into nome from public.posts p where p.id = r.content_id;
    destino := '/portal/social-media';
  elsif r.content_type = 'deliverable' then
    select d.nome into nome from public.deliverables d where d.id = r.content_id;
    destino := '/portal/campanhas';
  else
    select s.titulo into nome from public.subtasks s where s.id = r.content_id;
    destino := '/portal/itens';
  end if;

  for pessoa in
    select a.user_id from public.approval_round_aprovadores a where a.round_id = p_round_id
  loop
    if public.notificar(
      pessoa.user_id, 'aprovacao',
      format('%s continua esperando a sua aprovação', coalesce(nome, 'Um material')),
      coalesce(
        nullif(btrim(coalesce(r.mensagem, '')), ''),
        'A Full enviou e está aguardando a sua decisão.'
      ),
      destino
    ) is not null then
      quantos := quantos + 1;
    end if;
  end loop;

  return quantos;
end;
$fn$;

revoke all on function public.reenviar_aviso_da_rodada(uuid) from public;
revoke all on function public.reenviar_aviso_da_rodada(uuid) from anon;
grant execute on function public.reenviar_aviso_da_rodada(uuid) to authenticated;

comment on function public.reenviar_aviso_da_rodada(uuid) is
  'Toca o sino de novo para quem já foi nomeado (0129), sem abrir rodada nova '
  'nem mexer em `solicitado_em`: o material é o mesmo e o número da rodada é a '
  'versão da peça. Devolve quantos avisos saíram.';


-- =============================================================================
-- PASSO 8 — A RODADA FECHADA CONGELA
--
-- A FUNÇÃO É COPIADA INTEIRA, e não remendada: `create or replace function` se
-- reescreve a partir do texto que se escreve AGORA e **não avisa quando o texto
-- novo tem menos coisa que o velho** — a lição da 0030, que perdeu um bloco de
-- carimbos assim e só apareceu na 0052. Os quatro ramos que já existem — a
-- recusa de mudar o resultado, o carimbo de `decidido_em`, e as duas exigências
-- de motivo da 0127 — estão todos aqui, palavra por palavra.
--
-- O que a 0129 acrescenta são DOIS ramos, marcados abaixo.
-- =============================================================================

create or replace function public.proteger_rodada_fechada()
returns trigger
language plpgsql
as $fn$
begin
  if old.status <> 'pendente' and new.status <> old.status then
    raise exception using
      errcode = 'check_violation',
      message = 'Rodada de aprovação já decidida não muda de resultado.',
      hint    = 'Cada ciclo de correção cria uma rodada nova, com número maior.';
  end if;

  -- ===================================================== A IDENTIDADE (0129)
  -- SEMPRE, pendente ou fechada. Nenhum caminho do produto escreve nestas
  -- colunas depois do insert: os quatro `update` de `src/` e os cinco do SQL
  -- escrevem `status`, `decidido_por`, `decidido_em` e `comentario`, sempre
  -- juntos e sempre sobre uma rodada `pendente`.
  --
  -- `escopo` entra aqui e não só no ramo de baixo porque trocá-lo move a
  -- decisão de interna para cliente, e `aprovacoes_do_cliente_no_post()`
  -- (0088) CONTA rodada de cliente aprovada: a conta do portão mudaria por um
  -- `update` que nada registra. `numero_rodada` é a versão da peça desde a
  -- 0033, e `content_id` é de que material a decisão foi.
  if new.content_type is distinct from old.content_type
     or new.content_id is distinct from old.content_id
     or new.numero_rodada is distinct from old.numero_rodada
     or new.escopo is distinct from old.escopo
     or new.solicitado_por is distinct from old.solicitado_por
     or new.solicitado_em is distinct from old.solicitado_em
     or new.lote_id is distinct from old.lote_id then
    raise exception using
      errcode = 'check_violation',
      message = 'A identidade de uma rodada de aprovação não se reescreve.',
      hint    = 'De que material é, que número tem, quem pediu e quando são o registro do envio. Para outro material ou outra versão, abra uma rodada nova.';
  end if;

  -- ====================================================== A FECHADA (0129)
  -- O FURO QUE ESTA MIGRATION EXISTE PARA FECHAR. Medido: como o sócio, numa
  -- rodada `aprovada`, o `comentario` era reescrito, `decidido_por` trocava de
  -- pessoa e `decidido_em` voltava a nulo — e o CLAUDE.md afirmava em três
  -- lugares que rodada fechada nunca é reescrita, com a tabela ficando FORA do
  -- `audit_log` justamente por ser o registro imutável.
  --
  -- `aprovador_id` e `mensagem` ficam de fora na rodada PENDENTE, que é o item
  -- 15: quem recebe se troca enquanto a decisão não aconteceu.
  if old.status <> 'pendente' and (
       new.comentario   is distinct from old.comentario
    or new.decidido_por is distinct from old.decidido_por
    or new.decidido_em  is distinct from old.decidido_em
    or new.aprovador_id is distinct from old.aprovador_id
    or new.mensagem     is distinct from old.mensagem
  ) then
    raise exception using
      errcode = 'check_violation',
      message = 'Rodada de aprovação já decidida não se reescreve.',
      hint    = 'Quem decidiu, quando, com que comentário e quem recebeu são o registro daquela decisão. O ciclo seguinte é uma rodada nova, com número maior.';
  end if;
  -- ===========================================================================

  if new.status <> 'pendente' and old.status = 'pendente' then
    new.decidido_em := coalesce(new.decidido_em, now());
  end if;

  if new.status = 'ajustes_solicitados'
     and (new.comentario is null or btrim(new.comentario) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'Pedir ajustes exige um comentário dizendo o que ajustar.',
      hint    = 'Sem ele, quem produziu não sabe o que refazer e a próxima versão volta igual.';
  end if;

  if new.status = 'rejeitada'
     and (new.comentario is null or btrim(new.comentario) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'Recusar exige o motivo escrito.',
      hint    = 'Recusar diz que o material não vai ao ar desta forma. Se o caminho é refazer, o desfecho é "Solicitar ajustes".';
  end if;

  return new;
end;
$fn$;


-- =============================================================================
-- PASSO 9 — CONFERÊNCIA
-- =============================================================================

do $$
declare
  n_tabela   integer;
  n_gatilhos integer;
  n_funcoes  integer;
  n_congela  integer;
  n_convert  integer;
begin
  select count(*)::integer into n_tabela
    from information_schema.tables
   where table_schema = 'public' and table_name = 'approval_round_aprovadores';

  select count(*)::integer into n_gatilhos
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal
     and t.tgname in (
       'approval_rounds_vincula_aprovador',
       'approval_round_aprovadores_pertence',
       'approval_round_aprovadores_nao_fica_vazia',
       'approval_round_aprovadores_acompanha'
     );

  select count(*)::integer into n_funcoes
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'aprovadores_da_rodada',
       'definir_aprovadores_da_rodada',
       'definir_aprovadores_do_lote',
       'reenviar_aviso_da_rodada'
     );

  -- OS DOIS RAMOS NOVOS, pelo TEXTO da função: sem isto a conferência diria ok
  -- sobre uma colagem que recriou `proteger_rodada_fechada` sem eles — que é
  -- exatamente o estado em que esta migration encontrou o banco.
  --
  -- E CADA TRECHO PROCURADO É ÚNICO DO RAMO DELE. "não se reescreve" aparece
  -- nos DOIS, então ele não distingue qual sobreviveu; a condição é código, que
  -- é o que uma reescrita da função leva embora junto.
  select (
    case when position('A identidade de uma rodada' in pg_get_functiondef('public.proteger_rodada_fechada'::regproc)) > 0 then 1 else 0 end
  + case when position('new.aprovador_id is distinct from old.aprovador_id' in pg_get_functiondef('public.proteger_rodada_fechada'::regproc)) > 0 then 1 else 0 end
  )::integer into n_congela;

  select count(*)::integer into n_convert
    from public.approval_rounds r
   where r.aprovador_id is not null
     and not exists (
       select 1 from public.approval_round_aprovadores a
        where a.round_id = r.id and a.user_id = r.aprovador_id
     );

  raise notice '0129: tabela=% (1) gatilhos=% (4) funcoes=% (4) ramos_de_congelamento=% (2) rodadas_sem_vinculo=% (0)',
    n_tabela, n_gatilhos, n_funcoes, n_congela, n_convert;

  if n_tabela <> 1 or n_gatilhos <> 4 or n_funcoes <> 4 or n_congela <> 2 or n_convert <> 0 then
    raise exception '0129 incompleta — confira o aviso acima.';
  end if;
end $$;
