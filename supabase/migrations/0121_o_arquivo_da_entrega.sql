-- ---------------------------------------------------------------------------
-- 0121 - O ARQUIVO DA ENTREGA, E A RODADA QUE O CARREGA
--
-- Decisao do usuario, item 31: "cada task passa a ter uma area de arquivos
-- finais; vincular cada arquivo a task, a vertente, ao cliente e ao
-- responsavel; registrar data e hora automaticamente; novas versoes
-- preservando o historico; os arquivos acompanham a aprovacao; depois de
-- aprovado o material aparece automaticamente na Biblioteca do cliente, na
-- vertente certa; a exclusao de um arquivo nao pode comprometer o historico
-- de uma entrega ja aprovada".
--
-- ===========================================================================
-- A PONTE ESTAVA CONSTRUIDA DOS DOIS LADOS, E ERA A VIGESIMA
--
-- `subtask_entregas` existe desde a 0007 com `tipo in ('arquivo', 'link')`, a
-- convencao de caminho `entregas/<subtask_id>/<nome>`, a policy do Storage
-- que pergunta `subtask_visivel_ao_cliente()` e a coluna `created_at`. A
-- Biblioteca do cliente le essa tabela desde a 3L e `vertente_dos_materiais()`
-- (0119) ja devolve a vertente de cada etapa.
--
-- Quer dizer que SEIS dos sete pedidos do item 31 ja tinham resposta no banco.
-- O que nao existia era:
--
--   1. QUEM ESCREVESSE `tipo = 'arquivo'`. A tela de producao so anexa LINK
--      desde o Sprint 3B -- o valor esta no `check` da 0007 e nenhum caminho
--      do produto o produz. O conserto disso e de tela, nao de banco: e o
--      `EnviarArquivos` da 0120 apontado para `task-arquivos`.
--
--   2. QUEM ESCREVESSE `approval_round_id`. A coluna nasceu na 0007 com a
--      chave estrangeira e o `on delete set null`, e `anexarEntrega` nunca a
--      preencheu. Sem ela, "os arquivos acompanham a aprovacao" e uma frase
--      sem fato por tras: a fila mostra TODAS as entregas da etapa, inclusive
--      as que chegaram depois da rodada ter sido decidida.
--
--   3. A TRAVA DA EXCLUSAO. `subtask_entregas_delete` aceita quem enviou e a
--      gestao, sem olhar se aquele arquivo ja saiu da agencia.
--
-- E um furo da 0114 que esta no caminho deste item, descrito no PASSO 1.
--
-- ===========================================================================
-- A VERSAO E A RODADA, E NAO UMA COLUNA NOVA
--
-- "Novas versoes preservando o historico" tem duas leituras, e a que custa uma
-- coluna e a errada. A outra o produto ja escolheu duas vezes:
--
--   * em `deliverable_versions` (0033), "O NUMERO DA RODADA E A VERSAO DA
--     PECA" -- e por isso subir uma versao nova depois do aval deixa a nova
--     SEM aval, que e o que tem de acontecer;
--   * em `post_versions` (0032), rodada fechada nunca e reescrita: cada ciclo
--     de ajuste cria uma rodada nova, com numero maior.
--
-- Aqui e a mesma conta, e ela cai de graca depois do PASSO 2: a rodada 1 leva
-- os arquivos que existiam quando ela abriu; o cliente pede ajustes; os
-- arquivos novos ficam sem carimbo ate a rodada 2 abrir e leva-los. Ninguem
-- reescreve nada, e "qual era a versao que o cliente aprovou" passa a ter
-- resposta: os arquivos carimbados com a rodada aprovada.
--
-- UMA COLUNA `versao` AO LADO SERIA A SEGUNDA VERDADE sobre o mesmo fato, e a
-- que divergiria e justamente ela -- porque quem a escreveria e a tela, e a
-- rodada nasce por tres caminhos. E "atraso nao e coluna" pela enesima vez.
--
-- ===========================================================================
-- O QUE NAO MUDA, E E DECISAO
--
--   * NAO HA COLUNA DE VERTENTE, DE CLIENTE NEM DE TASK em `subtask_entregas`.
--     As quatro perguntas do pedido ja tem resposta pelo caminho que existe:
--     `subtask_id -> subtasks.task_id -> tasks.client_id, tasks.vertente_id`.
--     Espelhar qualquer uma delas criaria uma coluna que precisa ser reescrita
--     por todo caminho que troca a vertente da demanda -- e divergiria no
--     primeiro que esquecesse. E a decisao da 0118 ("a subtarefa herda sem
--     coluna") um nivel abaixo.
--
--   * `created_at` JA E O "registrar data e hora automaticamente" (0007), e
--     `enviado_por` ja e quem mandou. **Quem MANDOU e quem e RESPONSAVEL sao
--     dois fatos diferentes**, e e por isso que nao viram um so: o Atendimento
--     anexa o arquivo que o cliente mandou por e-mail numa etapa que e do
--     Design, e as duas linhas continuam verdadeiras.
--
-- ===========================================================================
-- PASSOS
--   1. A SEGUNDA PESSOA DA ETAPA ENTREGA (furo da 0114)
--   2. A rodada carimba os arquivos dela
--   3. Arquivo que ja saiu nao se apaga
--   4. Conferencia
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A SEGUNDA PESSOA DA ETAPA ENTREGA
--
-- A 0114 deu a etapa dois responsaveis e escreveu a regra de leitura: a coluna
-- `subtasks.responsavel_id` passou a ser a PRIMEIRA pessoa e quem manda e
-- `subtask_responsaveis`. Ela reescreveu `disponibilidade_bruta()` e o
-- "Minhas Tasks" para perguntarem a TABELA -- e NAO tocou nas policies.
--
-- O efeito, medido no banco de producao: `subtask_entregas_insert` pergunta
-- `s.responsavel_id = auth.uid()`, entao a SEGUNDA pessoa de uma etapa ve a
-- etapa na lista dela, conta na carga dela, e **nao consegue anexar o que
-- produziu**. E a 0059 outra vez com o diagnostico invertido: ali a guarda da
-- action estava mais apertada que o banco; aqui o banco esta mais apertado que
-- o produto diz que ele e.
--
-- A PERGUNTA VIRA FUNCAO, e nao um `exists` colado na policy, porque ela vai
-- ser feita nos dois lados: a policy decide, e `podeAnexarNaEtapa()` em
-- `lib/dominio/tasks.ts` escreve a frase antes do clique. E a decisao da
-- maquina de estados da subtarefa ao lado dos gatilhos da 0007.
--
-- E ELA E `security definer`: `subtask_responsaveis_select` e
-- `pode_editar_task(subtask_id)` (0114), entao um colaborador que NAO edita a
-- demanda nao le as proprias linhas de la -- e a policy perguntaria sobre uma
-- tabela que ela mesma nao enxerga, devolvendo falso para quem deveria passar.
--
-- *O que este passo NAO faz, e fica dito em vez de escondido:* `subtasks_update`
-- tem o MESMO furo -- a segunda pessoa nao muda o status da propria etapa, e o
-- botao que a tela oferece leva a recusa do banco. Ele nao entra aqui porque o
-- `with check` daquela policy faz um segundo trabalho: com `responsavel_id =
-- auth.uid()` avaliado na linha NOVA, ele e o que impede a pessoa de passar a
-- etapa para outra. Trocando-o pela tabela, a checagem passaria a ler o estado
-- ANTIGO (o gatilho que sincroniza roda depois) e a reatribuicao deixaria de
-- ser recusada -- um alargamento que ninguem pediu. Consertar aquilo e mover a
-- trava da reatribuicao para um gatilho, que e decisao propria.
-- ---------------------------------------------------------------------------

create or replace function public.faz_a_subtarefa(p_subtask_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
      from public.subtask_responsaveis r
     where r.subtask_id = p_subtask_id
       and r.user_id = (select auth.uid())
  );
end;
$$;

comment on function public.faz_a_subtarefa(uuid) is
  'Sou uma das pessoas que fazem esta etapa? Le subtask_responsaveis (0114), e nao a coluna responsavel_id, que e so a primeira delas.';

revoke all on function public.faz_a_subtarefa(uuid) from public;
revoke all on function public.faz_a_subtarefa(uuid) from anon;
grant execute on function public.faz_a_subtarefa(uuid) to authenticated;

drop policy if exists subtask_entregas_insert on public.subtask_entregas;

create policy subtask_entregas_insert on public.subtask_entregas
  for insert to authenticated
  with check (
    enviado_por = (select auth.uid())
    and (
      public.is_atendimento()
      or public.faz_a_subtarefa(subtask_id)
    )
  );


-- ---------------------------------------------------------------------------
-- PASSO 2 - A RODADA CARIMBA OS ARQUIVOS DELA
--
-- No instante em que uma rodada de etapa nasce, as entregas daquela etapa que
-- ainda nao viajaram em rodada nenhuma passam a ser as DELA. E isso, e mais
-- nada, que "os arquivos acompanham a aprovacao" quer dizer.
--
-- E GATILHO E NAO ACTION, pela razao da 0045 e da 0090: a rodada nasce por
-- mais de um caminho -- `pedirAvalInterno`, `enviarParaAprovacao`, o seed, um
-- PATCH montado a mao --, e um carimbo escrito na camada de aplicacao
-- registra o que passou pela tela e perde o resto. E a funcao que abre a
-- rodada ja foi reescrita tres vezes (0030, 0032, 0033), que e exatamente
-- onde um trecho fica para tras.
--
-- SO `content_type = 'subtask'`, e a guarda nao e zelo: `approval_rounds` e
-- generica desde a 0030, e sem ela uma rodada de POST tentaria carimbar
-- entregas de uma etapa cujo id e o do post -- que nao existe, entao o
-- `update` alcanca zero linhas e nao da erro. Um `if` que nunca e verdadeiro
-- num lugar que escreve e o que alguem reaproveita achando que ele decide
-- alguma coisa.
--
-- E ELE NAO DERRUBA A ABERTURA DA RODADA. O carimbo e consequencia, nao
-- condicao: uma etapa sem arquivo nenhum abre rodada do mesmo jeito -- e abre
-- mesmo, porque material entregue por fora (o link do Drive colado no
-- comentario, a pasta de entrega) e caso normal. E a linha de
-- `etapa_acompanha_o_entregavel` (0052) vista daqui.
-- ---------------------------------------------------------------------------

create or replace function public.carimbar_entregas_da_rodada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.content_type <> 'subtask' then
    return new;
  end if;

  update public.subtask_entregas
     set approval_round_id = new.id
   where subtask_id = new.content_id
     and approval_round_id is null;

  return new;
end;
$$;

comment on function public.carimbar_entregas_da_rodada() is
  'Quando uma rodada de etapa nasce, as entregas sem carimbo daquela etapa passam a ser as dela. E o que faz o numero da rodada ser a versao do material (0121).';

drop trigger if exists approval_rounds_carimba_entregas on public.approval_rounds;
create trigger approval_rounds_carimba_entregas
  after insert on public.approval_rounds
  for each row
  execute function public.carimbar_entregas_da_rodada();


-- ---------------------------------------------------------------------------
-- PASSO 3 - ARQUIVO QUE JA SAIU NAO SE APAGA
--
-- "A exclusao de um arquivo nao pode comprometer o historico de uma entrega ja
-- aprovada" e o pedido, e o PISO dele e a rodada APROVADA. A trava aqui e um
-- passo mais larga, e a generalizacao tem argumento:
--
--   **CARIMBADA QUER DIZER QUE SAIU.** Depois do PASSO 2, uma entrega com
--   `approval_round_id` preenchido e uma que viajou numa rodada -- pendente,
--   aprovada, recusada ou em ajustes. Nos quatro casos ela e o material sobre
--   o qual alguem decidiu ou esta decidindo AGORA, e o comentario da rodada
--   fala dela: "o logo ficou pixelado" sem o logo para olhar manda quem refaz
--   adivinhar. E a razao pela qual rodada fechada nunca e reescrita nem
--   apagada, um nivel abaixo.
--
--   **E A SEM CARIMBO E O CASO COMUM DO ERRO**: quem subiu o arquivo errado
--   ainda nao mandou para lugar nenhum, e apagar ali nao desfaz nada de
--   ninguem.
--
-- *O custo esta dito:* quem anexa o arquivo errado e so percebe depois de
-- pedir o aval nao consegue tira-lo -- ele acrescenta o certo, e a rodada
-- carrega os dois. E a mesma conta de "apagar nao e desfazer".
--
-- E TRIGGER E NAO POLICY, e a diferenca e a mensagem: uma policy mais estreita
-- devolveria ZERO LINHAS, que a action le como "o banco recusou" sem dizer por
-- que. A recusa aqui nomeia a rodada e diz o que fazer no lugar -- a decisao
-- da 0023.
-- ---------------------------------------------------------------------------

create or replace function public.entrega_carimbada_nao_se_apaga()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  numero int;
begin
  if old.approval_round_id is null then
    return old;
  end if;

  -- A ETAPA INDO EMBORA LEVA AS ENTREGAS DELA, e a trava nao morde ai.
  --
  -- `subtask_entregas.subtask_id` e `on delete cascade` desde a 0007, entao
  -- sem esta linha apagar uma ETAPA -- ou a DEMANDA inteira, que cascateia
  -- ate aqui -- levaria a recusa de um arquivo, com uma mensagem sobre uma
  -- rodada, na tela de quem clicou em "Excluir task". E a trava protegendo o
  -- historico de uma entrega que esta sendo apagada de proposito, junto com
  -- tudo o mais.
  --
  -- COMO SE SABE A DIFERENCA, e foi MEDIDO e nao suposto: num `delete` do
  -- filho a linha do pai ainda esta la; num cascade, o Postgres apaga o pai
  -- PRIMEIRO e so entao dispara a acao da chave estrangeira -- entao quando
  -- este `before delete` roda, a etapa ja nao existe. E a mesma mecanica que
  -- a 0080 pagou ao descobrir que num `after delete` o `subtask_id` ja esta
  -- nulo, vista do outro lado.
  if not exists (
    select 1 from public.subtasks s where s.id = old.subtask_id
  ) then
    return old;
  end if;

  select r.numero_rodada into numero
    from public.approval_rounds r
   where r.id = old.approval_round_id;

  raise exception
    'Este arquivo ja foi enviado na rodada % e nao se apaga.', coalesce(numero, 1)
    using hint =
      'Anexe o arquivo corrigido: a proxima rodada leva o que estiver sem carimbo, e o historico guarda as duas versoes.';
end;
$$;

comment on function public.entrega_carimbada_nao_se_apaga() is
  'Recusa apagar uma entrega que ja viajou numa rodada. A sem carimbo -- o arquivo errado que ainda nao saiu da agencia -- continua se apagando (0121).';

drop trigger if exists subtask_entregas_nao_apaga_enviada on public.subtask_entregas;
create trigger subtask_entregas_nao_apaga_enviada
  before delete on public.subtask_entregas
  for each row
  execute function public.entrega_carimbada_nao_se_apaga();


-- ---------------------------------------------------------------------------
-- PASSO 4 - CONFERENCIA
--
-- As tres primeiras tem de devolver ZERO; a quarta diz quantas entregas
-- passadas ficaram sem carimbo, e esse numero NAO precisa ser zero: ele conta
-- o que foi anexado antes desta migration existir, e a passada que o
-- corrigisse teria de escolher uma rodada para cada arquivo sem ter como
-- saber qual -- inventando o fato que a coluna existe para guardar. Elas
-- continuam apagaveis, que e a verdade: nunca viajaram em rodada nenhuma.
-- ---------------------------------------------------------------------------

select count(*) as faltou_a_funcao
  from (select 1) _
 where to_regprocedure('public.faz_a_subtarefa(uuid)') is null;

select count(*) as faltou_o_gatilho_do_carimbo
  from (select 1) _
 where not exists (
   select 1 from pg_trigger
    where tgname = 'approval_rounds_carimba_entregas' and not tgisinternal
 );

select count(*) as faltou_o_gatilho_da_exclusao
  from (select 1) _
 where not exists (
   select 1 from pg_trigger
    where tgname = 'subtask_entregas_nao_apaga_enviada' and not tgisinternal
 );

select count(*) as entregas_antigas_sem_carimbo
  from public.subtask_entregas
 where approval_round_id is null;
