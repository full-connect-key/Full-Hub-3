-- ===========================================================================
-- 0134 - A ENTREGA DIZ QUAL E A CERTA
--
-- Decisao do usuario: *"quero que quando a pessoa vai fazer uma entrega, ela
-- possa comentar e subir um link, para especificar qual a entrega certa
-- daquela task, cada subtarefa deve poder subir um link diferente, e cada sub
-- etapa tambem"*.
--
-- ---------------------------------------------------------------------------
-- DUAS DAS TRES METADES JA EXISTIAM, e medir antes de escrever e o que separa
-- o que precisava de banco do que so precisava ser nomeado -- a licao da 0060,
-- da 0127 e da 0128:
--
--   | o que ele pede                  | onde ja estava                       |
--   | ------------------------------- | ------------------------------------ |
--   | subir um LINK na entrega        | `subtask_entregas.tipo = 'link'`,    |
--   |                                 | desde a 0007, e e o unico tipo que   |
--   |                                 | tinha tela ate a 0121                |
--   | um link por SUBTAREFA e por     | `subtask_entregas.subtask_id` -- e   |
--   | SUB-ETAPA                       | uma sub-etapa E uma subtarefa (0022, |
--   |                                 | `parent_id`), com o MESMO modal:     |
--   |                                 | `aoAbrir={() => setAberta(filha.id)}`|
--   | **COMENTAR a entrega**          | **nao existia**                      |
--
-- Entao o que nasce aqui e UMA coluna.
--
-- ---------------------------------------------------------------------------
-- E COLUNA, E NAO UMA THREAD
--
-- `comments` e polimorfica desde a 0032 e e a CONVERSA -- com autor, data,
-- resposta de um nivel, e o cliente do outro lado. Esta observacao e uma
-- PROPRIEDADE do arquivo: *"o PDF e o certo, o AI vai junto so para edicao"*.
-- Uma por entrega, escrita por quem a anexou, sem ninguem para responder.
--
-- Uma thread por arquivo seria a terceira conversa do produto sobre o mesmo
-- material -- a da demanda (`task_comentarios`), a do cliente (`comments`) e
-- esta -- e a que divergiria e justamente a nova.
--
-- ---------------------------------------------------------------------------
-- ELA E EDITAVEL, e e por isso que esta tabela ganha a PRIMEIRA policy de
-- UPDATE dela
--
-- `subtask_entregas` tem SELECT, INSERT e DELETE desde a 0007 e nunca teve
-- UPDATE: quem escreve `approval_round_id` e o gatilho da 0121, que e
-- `security definer` e passa por fora da RLS.
--
-- **E a edicao e o caso comum, nao a excecao**: quem sobe o PSD, o PDF e o JPG
-- so sabe dizer *"este e o certo"* depois de ver os tres. Uma observacao que
-- so da para escrever no instante do anexo seria um campo que a pessoa pula --
-- e aprende a pular.
--
-- **QUEM EDITA E QUEM APAGARIA**, que e a mesma pergunta: `enviado_por` ou a
-- gestao. A segunda metade e a mesma de `subtask_entregas_delete` desde a
-- 0007, pela mesma razao -- a gestao modera.
--
-- ---------------------------------------------------------------------------
-- E O TRIGGER E O QUE FAZ A POLICY SIGNIFICAR "SO A OBSERVACAO"
--
-- **Policy nao limita coluna** -- a regra desta casa, escrita em
-- `protect_client_columns` (0005), em `posts_protege_colunas` (0042) e em
-- `proteger_colunas_da_campanha` (0078). Com a policy de UPDATE aberta, um
-- PATCH no PostgREST trocaria o `url` de uma entrega JA CARIMBADA: o nome
-- continuaria o mesmo, o arquivo seria outro, e o comentario da rodada
-- falaria de um material que nao esta mais la. E a 0121 pelo avesso -- la ela
-- recusa APAGAR o arquivo que saiu, e trocar o conteudo dele e pior, porque
-- nao deixa buraco.
--
-- **`approval_round_id` FICA DE FORA DA LISTA, e a ausencia e deliberada**: e
-- a coluna do CARIMBO, escrita por `carimbar_entregas_da_rodada()` (0121) no
-- instante em que a rodada nasce. Barra-la aqui derrubaria a abertura de toda
-- rodada de etapa que tenha arquivo -- e o trigger dispara mesmo vindo de uma
-- funcao `security definer`, porque `security definer` passa por fora da RLS
-- e nao por fora dos gatilhos. *O que isso deixa alcancavel, e e dito em vez
-- de escondido:* quem montar o PATCH a mao carimba uma entrega sua com o id
-- de uma rodada. O que ele ganha e tornar o proprio arquivo impossivel de
-- apagar (0121) e marca-lo como enviado; o que ele nao alcanca e o arquivo de
-- outra pessoa, porque a policy de UPDATE pergunta `enviado_por` antes.
--
-- ---------------------------------------------------------------------------
-- O QUE A OBSERVACAO NAO E: a mensagem do envio
--
-- `approval_rounds.mensagem` (0128) e o que a agencia diz ao MANDAR a peca --
-- uma por rodada, escrita por quem envia, lida pelo cliente. Esta e sobre o
-- ARQUIVO -- uma por entrega, escrita por quem produziu, lida por quem vai
-- olhar. Reaproveitar uma para a outra faria o envio apagar a nota do arquivo,
-- que e a razao escrita da 0128 para `mensagem` nao ser `comentario`.
--
-- ***E ELA E INTERNA POR TELA, E NAO POR POLICY -- dito em vez de escondido:***
-- `subtask_entregas_select_cliente` entrega a LINHA ao cliente desde a 0007
-- (e e o que faz o arquivo aparecer na Biblioteca dele), e policy nao limita
-- coluna. Nenhuma tela do portal desenha a observacao, e
-- `portal-aprovacoes.ts` deixou de fazer `select("*")` no mesmo commit para
-- ela nem chegar ao servidor de la -- mas quem montar a consulta a mao le. E
-- a nota da 0132, palavra por palavra. **A tela diz isso embaixo do campo**,
-- porque um campo que a pessoa ACHA que e interno e nao e, e pior que um
-- campo visivel: tornar a observacao invisivel ao cliente de verdade pede
-- tabela propria com `is_staff()` -- a forma de `academy_anotacoes` --, e
-- isso e decisao propria, com migration propria.
--
-- ---------------------------------------------------------------------------
-- CONFERENCIA, no fim do arquivo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 - A COLUNA
-- ---------------------------------------------------------------------------

alter table public.subtask_entregas
  add column if not exists observacao text;

comment on column public.subtask_entregas.observacao is
  'O que e este arquivo, escrito por quem o anexou -- "o PDF e o certo, o AI vai junto so para edicao". E do ARQUIVO; o que a agencia diz ao MANDAR a peca e approval_rounds.mensagem (0128). Interna por tela: nenhuma tela do portal a desenha, e a linha e legivel pelo cliente desde a 0007.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A PRIMEIRA POLICY DE UPDATE DESTA TABELA
--
-- A mesma pergunta de `subtask_entregas_delete` (0007): quem anexou, ou a
-- gestao. O `with check` repete o `using` para ninguem passar a entrega para
-- o nome de outra pessoa num update que a policy de leitura ja deixou entrar.
-- ---------------------------------------------------------------------------

drop policy if exists subtask_entregas_update on public.subtask_entregas;

create policy subtask_entregas_update on public.subtask_entregas
  for update to authenticated
  using (enviado_por = (select auth.uid()) or public.is_gestor())
  with check (enviado_por = (select auth.uid()) or public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 3 - E SO A OBSERVACAO MUDA
-- ---------------------------------------------------------------------------

create or replace function public.entrega_so_muda_a_observacao()
returns trigger
language plpgsql
as $FN$
begin
  if new.subtask_id is distinct from old.subtask_id
     or new.tipo is distinct from old.tipo
     or new.url is distinct from old.url
     or new.nome is distinct from old.nome
     or new.enviado_por is distinct from old.enviado_por
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Uma entrega nao se reescreve: so a observacao dela muda.'
      using hint =
        'Para trocar o arquivo, anexe o novo e remova o antigo -- e o que ja saiu numa rodada nao se remove (0121).';
  end if;

  return new;
end;
$FN$;

comment on function public.entrega_so_muda_a_observacao() is
  'Policy nao limita coluna: a de UPDATE da 0134 existe para a observacao, e este gatilho e o que a impede de virar a porta para trocar o arquivo de uma entrega ja carimbada. approval_round_id fica de fora da lista porque e a coluna do carimbo (0121).';

drop trigger if exists subtask_entregas_so_a_observacao on public.subtask_entregas;
create trigger subtask_entregas_so_a_observacao
  before update on public.subtask_entregas
  for each row
  execute function public.entrega_so_muda_a_observacao();


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------

select
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subtask_entregas'
      and column_name = 'observacao')                      as coluna_deve_ser_1,
  (select count(*) from pg_policy
    where polrelid = 'public.subtask_entregas'::regclass
      and polname = 'subtask_entregas_update')             as policy_deve_ser_1,
  (select count(*) from pg_trigger
    where tgrelid = 'public.subtask_entregas'::regclass
      and tgname = 'subtask_entregas_so_a_observacao')     as gatilho_deve_ser_1;
