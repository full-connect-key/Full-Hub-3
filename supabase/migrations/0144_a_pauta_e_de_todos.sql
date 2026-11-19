-- ---------------------------------------------------------------------------
-- 0144 - A PAUTA E DE TODOS, E QUEM MEXE ASSUME
--
-- Decisao do usuario, itens 22 e 23. Verbatim, o que decide cada metade:
--
--   22. "Permitir que todos os colaboradores visualizem a pauta de todos os
--       integrantes da equipe. A visualizacao devera incluir tasks,
--       subtarefas, responsaveis, prazos, etapas e indicadores de sobrecarga.
--       Garantir que a visualizacao compartilhada nao conceda automaticamente
--       permissao de edicao."
--
--   23. "Caso o usuario nao seja Atendimento, Socio ou Desenvolvedor, ao
--       realizar uma alteracao em uma pauta da qual nao e responsavel, ele
--       devera se tornar responsavel pelo item alterado. (...) Perfis de
--       Atendimento, Socio e Desenvolvedor poderao realizar alteracoes sem
--       assumir automaticamente a responsabilidade. Registrar quem realizou
--       cada alteracao, com data e horario. Preservar as regras de aprovacao
--       e conclusao das tasks."
--
-- ===========================================================================
-- O ITEM 22 NAO PRECISA DE UMA LINHA DE BANCO, E ISSO FOI MEDIDO
--
-- Ir medir antes de escrever e o que separou o que precisava de SQL do que so
-- precisava de uma tela -- a licao da 0060, da 0127 e da 0128:
--
--   | o que ele pede                  | onde ja estava                      |
--   | ------------------------------- | ----------------------------------- |
--   | ler a etapa de qualquer pessoa  | `subtasks_select` e `is_staff()`    |
--   |                                 | desde a 0007                        |
--   | o nome e a foto do responsavel  | `profiles_select` com `is_staff()`  |
--   |                                 | desde a 0132                        |
--   | prazos e etapas                 | as mesmas colunas, na mesma policy  |
--   | indicador de sobrecarga         | `carga_da_equipe()` desde a 0055    |
--   | nao conceder edicao             | `subtasks_update` ja barrava        |
--   | **a TELA que mostra isso**      | **nao existia**                     |
--
-- O colaborador nao tinha UMA tela que respondesse "quem esta com o que":
-- `/painel/gestao-tasks` e GESTAO, `/painel/minhas-tasks` mostra so as dele,
-- e o Calendario Full e so de eventos desde a 0105 -- a Linha do Tempo, que
-- era a unica tela a responder "a equipe aguenta?", saiu por decisao dele e o
-- CLAUDE.md registrou a saida com a frase que esta entrega cumpre:
-- *"`carga_da_equipe()` fica no banco, SEM LEITOR (...) devolver a visao e
-- devolver uma funcao em `lib/dados/`, que o git guarda."*
--
-- Entao o item 22 e tela, e o unico SQL dele e o PASSO 1: a ACL daquela
-- funcao, que estava aberta e passou a ter leitor.
-- ===========================================================================
-- O QUE O ITEM 23 PEDE E UMA PORTA QUE HOJE ESTA FECHADA
--
-- `subtasks_update` e, desde a 0007:
--
--     is_gestor() or is_atendimento() or responsavel_id = auth.uid()
--
-- Quer dizer que o colaborador NAO consegue mexer na etapa de outra pessoa --
-- o que e exatamente o que o item 23 existe para permitir, com a consequencia
-- de a etapa trocar de dono. E de quebra, `responsavel_id` e a PRIMEIRA
-- pessoa desde a 0114: a SEGUNDA pessoa de uma etapa ve a etapa no "Minhas
-- Tasks" dela e **nao consegue mover o status**. E o pior tipo de trabalho da
-- 0041 um nivel abaixo -- ela sabe que e seu, e a porta esta fechada.
--
-- ===========================================================================
-- A TASK NAO TEM DONO A TRANSFERIR, e a divergencia e declarada
--
-- Ele escreve *"essa alteracao de responsabilidade deve ocorrer na task ou
-- subtarefa correspondente"*. Em `tasks` nao ha o que trocar: a coluna
-- `responsavel_id` foi APAGADA no Sprint 3B, e o CLAUDE.md e explicito --
-- *"`tasks` nao tem `responsavel_id`, `prazo`, `estimativa_horas` nem
-- `tempo_real_horas`. Nenhuma consulta pode ressuscitar essas colunas."*
--
-- A ETAPA e a unidade de trabalho e a unica coisa com responsavel, entao a
-- troca de maos acontece nela. E `tasks_update` NAO e alargada: ali moram o
-- cliente, a pasta de entrega, a vertente e o briefing -- a identidade da
-- demanda, que e de quem a abre (`pode_editar_task`, 0004), e nao pauta de
-- ninguem.
-- ===========================================================================
-- "PRESERVAR AS REGRAS DE APROVACAO" E UMA TRAVA, e nao uma frase
--
-- Com a porta alargada, um colaborador poderia desligar `requer_aprovacao` de
-- uma etapa alheia e concluir em seguida: `subtasks_bloqueia_conclusao_sem_
-- aprovacao` (0007) le aquela coluna NO INSTANTE da conclusao. Seria a
-- aprovacao do cliente contornada por um `update` de uma coluna booleana.
--
-- Entao o PASSO 5 recusa: a exigencia de aval e de quem ABRE a demanda, nunca
-- de quem executa a etapa. E a mesma separacao da 0046 e da 0068 -- abrir
-- trabalho e fazer trabalho sao duas decisoes.
--
-- ---------------------------------------------------------------------------
-- MEDIDO COM NOVE MUTACOES, sobre 2467 cenarios:
--
--   12  `subtasks_update` fechada na forma EXATA de antes da 0144
--   20  sem a GUARDA 3 (a gestao assumiria, e o nome escrito seria sobrescrito)
--    3  sem a recusa da corrente do social (o PASSO 5)
--    2  sem a GUARDA 4, lendo so a coluna (a segunda pessoa da 0114 promovida)
--    2  sem a GUARDA 5 (a fase do mes trocaria de dono por um update de prazo)
--    2  registrando tambem a mudanca de status (a linha da 0035 dita duas vezes)
--    1  sem a GUARDA 1 (o cliente que aprova assumiria a etapa)
--    1  sem o gatilho que acerta o vinculo (coluna e tabela discordariam)
--    1  com o `revoke` so no `anon` (o grant vem do PUBLIC)
--    0  sem a GUARDA 2 -- e o zero esta explicado abaixo
--
-- A PRIMEIRA RODADA DE MUTACAO DEU QUATRO ZEROS, E DOIS ERAM FALSOS. O laco
-- lia `FALHOU | N` da saida e caia em zero quando nao achava a linha -- que e
-- tambem o que acontece quando a bateria ABORTA. Fechar a policy aborta o
-- arquivo 02 na montagem, e tirar o gatilho do vinculo tambem: os dois
-- "zeros" eram 12 e 1. A remedicao pergunta pela linha `passou | N` antes de
-- contar falha nenhuma.
--
-- E A TERCEIRA MUTACAO ERRADA FOI RENOMEAR: um gatilho com outro nome
-- continua disparando, entao o bloco inteiro do `create` tem de sair. Vale
-- escrito porque a mutacao que nao muda nada e indistinguivel da guarda que
-- nao protege nada.
--
-- O ZERO DA GUARDA 5 ERA UM CENARIO QUE FALTAVA, e nao uma redundancia -- foi
-- esta medicao que o encontrou. A recusa do PASSO 5 pergunta
-- `new.responsavel_id is distinct from old`, e os dois gatilhos sao `before
-- update`: o Postgres os roda em ordem ALFABETICA, entao
-- `subtasks_o_que_e_de_quem_abre` pergunta ANTES de
-- `subtasks_quem_mexe_assume` trocar a coluna. No caminho do takeover ela
-- ainda nao trocou quando ele olha. Quer dizer que a GUARDA 5 e a UNICA coisa
-- entre um `update` de prazo e a fase do mes trocando de dono em silencio, e
-- nenhum cenario a exercia: o arquivo 49 ganhou a fase de social e os tres
-- cenarios dela, e a guarda passou a valer 2.
--
-- O ZERO DA GUARDA 2 E HONESTO, e ele foi medido em TRES pontos. Ela e a
-- GUARDA 1 sao backstop uma da outra para a escrita SEM SESSAO: tirando so a
-- 2, a 1 pega (sem `auth.uid()`, `is_staff()` e falsa); tirando so a 1, a 2
-- pega, e o 1 que ela derruba e o caso do CLIENTE, que tem sessao e que a 2
-- nao alcanca. Tirando AS DUAS, a bateria ABORTA no arquivo 02 -- a montagem
-- escreve em `subtasks` como dono da tabela, a funcao cai ate o
-- `new.responsavel_id := v_quem` com `v_quem` nulo, e a etapa perde o dono.
-- Ou seja: o caso existe e e alcancado; o que o zero diz e que ele tem duas
-- portas, e nao que ele nao tem nenhuma.
--
-- E O ZERO NAO E RAZAO PARA TIRAR A GUARDA 2, que seria a leitura da 0060:
-- ela e a declaracao de que `v_quem` nao e nulo dali para baixo, e e ela que
-- NOMEIA o caminho sem sessao -- a 1 o pega por consequencia de `is_staff()`,
-- nao por dizer o que esta acontecendo.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - `carga_da_equipe()` perde o EXECUTE do `anon`
--
-- MEDIDO no Postgres de producao: ela tem `execute` para `anon` desde a 0055,
-- e aquela migration nao escreveu `revoke` nenhum para ela.
--
-- NAO E FURO, e e inconsistencia -- a distincao e a mesma que a 0128 fez com
-- `definir_aprovadores_do_lote`. Ela NAO e `security definer`, entao as duas
-- tabelas que ela le (`profiles` e `team_members`) respondem pela RLS de quem
-- chamou: para `anon` o join devolve zero linhas, porque `team_members_select`
-- e `is_staff()` desde a 0002.
--
-- E ARRUMAR AGORA E O PONTO: a protecao dela e INTEIRAMENTE a RLS de duas
-- tabelas que outra migration pode alargar -- e uma delas JA FOI alargada, na
-- 0132. Uma funcao sem guarda propria, com `execute` para a chave anon, e uma
-- funcao cuja seguranca depende de ninguem mexer noutro lugar. Ela passou a
-- ter leitor nesta entrega, e e nesta que a ACL fica igual a das vizinhas.
--
-- E NAO ENTRA UM `is_staff()` NO CORPO, que e a 0060: a RLS das duas tabelas
-- ja devolve zero para o cliente e para o anon, e uma segunda pergunta embaixo
-- de uma primeira que ja barra todo mundo nao barra ninguem.
-- ---------------------------------------------------------------------------
revoke all on function public.carga_da_equipe(date, date) from public;
revoke all on function public.carga_da_equipe(date, date) from anon;
grant execute on function public.carga_da_equipe(date, date) to authenticated;

comment on function public.carga_da_equipe is
  'A carga de cada pessoa ativa em cada dia util do periodo. Percorre e CHAMA carga_do_dia() -- nao recalcula (0055). Sem execute para anon desde a 0144: ela nao e definer, e a protecao dela e a RLS de profiles e team_members.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A pauta de todos passa a ser editavel por toda a equipe
--
-- `is_staff()` e nada mais, nas duas pontas. O que ele pede -- "permitir que
-- os colaboradores realizem alteracoes em pautas compartilhadas" -- e esta
-- linha; o preco dela e o PASSO 4, que faz a etapa trocar de maos.
--
-- O QUE NAO MUDA, e cada um pela razao dele:
--
--   * `subtasks_insert` e `subtasks_delete` continuam `is_atendimento()`.
--     Criar e apagar etapa e montar a demanda, nao mexer na pauta -- e apagar
--     a etapa de alguem nao e uma alteracao que se assume, e trabalho que
--     desaparece.
--   * `subtasks_sem_rascunho_alheio` continua por cima, restritiva: o
--     rascunho e de quem o criou e de mais ninguem, nem do socio (0028).
--   * as travas de transicao da 0007 continuam todas de pe -- *policy diz de
--     quem e a linha, trigger diz que transicao e legitima*. Concluir sem
--     aprovacao, ir para "Enviada para aprovacao" sem rodada e estacionar em
--     "Em ajustes" sem ninguem ter pedido continuam recusados.
--   * `subtasks_protege_o_social` (0088) continua recusando as quatro colunas
--     da fase do mes.
-- ---------------------------------------------------------------------------
drop policy if exists subtasks_update on public.subtasks;

create policy subtasks_update on public.subtasks
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());


-- ---------------------------------------------------------------------------
-- PASSO 3 - "Esta etapa e desta pessoa?" mora num lugar so
--
-- A pergunta e feita tres vezes no PASSO 4 e e o par de `fazASubtarefa()` em
-- `lib/dominio/tasks.ts`: a COLUNA e a TABELA, porque `responsavel_id` e a
-- PRIMEIRA pessoa desde a 0114 e quem manda e `subtask_responsaveis`. Tres
-- copias do `or exists (...)` seriam tres lugares para esquecer a tabela --
-- que e exatamente o que `subtasks_update` fez entre a 0114 e hoje.
--
-- SEM `execute` PARA `authenticated`, e a ausencia e a regra: quem a chama
-- sao os dois gatilhos abaixo, que sao `security definer` e rodam com os
-- privilegios do dono. Nenhuma tela a consulta, e uma funcao `definer` que
-- responde sobre o vinculo de qualquer pessoa nao precisa de porta aberta
-- para quem nao a usa.
-- ---------------------------------------------------------------------------
create or replace function public.e_responsavel_pela_etapa(
  p_subtask_id uuid,
  p_user_id    uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $funcao$
begin
  if p_user_id is null then
    return false;
  end if;

  return exists (
    select 1 from public.subtask_responsaveis r
     where r.subtask_id = p_subtask_id and r.user_id = p_user_id
  ) or exists (
    select 1 from public.subtasks s
     where s.id = p_subtask_id and s.responsavel_id = p_user_id
  );
end
$funcao$;

comment on function public.e_responsavel_pela_etapa is
  'Esta etapa e desta pessoa? A coluna E a tabela de vinculo -- o par de fazASubtarefa() em lib/dominio/tasks.ts (0144).';

revoke all on function public.e_responsavel_pela_etapa(uuid, uuid) from public;
revoke all on function public.e_responsavel_pela_etapa(uuid, uuid) from anon;
revoke all on function public.e_responsavel_pela_etapa(uuid, uuid) from authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 4 - Quem mexe na pauta alheia assume a etapa
--
-- `before update of <as colunas da pauta>`, e a LISTA DE COLUNAS e a decisao
-- central deste passo.
--
-- O pedido fala de *"realizar uma alteracao em uma pauta"* -- um gesto
-- deliberado de quem abriu a tela: o nome, o status, as datas, a prioridade,
-- a estimativa, o briefing. NAO um efeito colateral de outro gatilho. Com o
-- gatilho na linha inteira, tres escritas que o produto faz por conta propria
-- trocariam o dono de uma etapa sem ninguem ter pedido:
--
--   * `ordem`, que `reordenarSubtarefas` escreve ao arrastar -- e arrastar
--     reordena irmas e nao e uma alteracao do trabalho (0063);
--   * `tempo_medido_segundos` e `andando_desde`, que o cronometro escreve
--     (0021) e que nem estao em `Insert`/`Update` do tipo;
--   * `concluida_em`, `iniciada_em` e `updated_at`, que sao carimbos.
--
-- SAO CINCO GUARDAS, e cada uma fecha um caso que a leitura ingenua erra:
--
--   1. NAO E `is_staff()` -> nada. Esta e a mais importante das cinco:
--      `etapa_acompanha_o_entregavel` (0052) escreve `subtasks.status` quando
--      o CLIENTE aprova a peca, e roda com o `auth.uid()` dele. Sem ela, o
--      cliente viraria responsavel por uma etapa da agencia.
--   2. SEM SESSAO -> nada. O seed, a rotina da madrugada e a chave de servico
--      escrevem sem `auth.uid()`, e `responsavel_id` nulo apagaria o dono.
--   3. E GESTAO OU ATENDIMENTO -> nao assume. E o pedido dele, em quantas
--      palavras.
--   4. JA E RESPONSAVEL -> nada. Pela TABELA e nao pela coluna (0114): a
--      segunda pessoa da etapa mexendo na propria etapa nao assume nada, ela
--      ja e dona. Lendo so a coluna, o PASSO 2 teria dado a ela a porta e
--      este passo a teria promovido a primeira pessoa no primeiro clique.
--   5. E FASE DO SOCIAL -> nada. Uma fase do mes tem dezoito pecas e um dono
--      escolhido na abertura; marcar UMA caixinha e fazer o trabalho de uma
--      peca, nao assumir a fase -- e quem escreve `subtasks.status` ali e
--      `atualizar_fase_pelas_caixinhas` (0093), com o `auth.uid()` de quem
--      marcou. O registro de quem fez aquela peca ja existe, e e o
--      `concluido_por` da propria caixinha (0088).
--
-- E QUEM ESCREVE `responsavel_id` NA MESMA ESCRITA MANDA, que e a ordem de
-- `coalesce(etapa, padrao)` da 0041: se a alteracao E a troca de responsavel,
-- a pessoa nomeou alguem de proposito, e sobrescrever seria *aceitar e
-- desfazer calado*, que a 0025 diz ser pior que recusar com explicacao.
-- *O custo esta dito:* quem mexer no prazo E reescrever o dono antigo na
-- mesma requisicao nao assume nada. O caminho da tela nao faz isso -- o
-- seletor de responsavel e um campo e o prazo e outro --, e a linha de
-- registro pega o caso de qualquer forma.
--
-- AS DUAS LINHAS DE REGISTRO, e a guarda de volume de uma delas:
--
--   * `assumiu_a_etapa` -- a etapa trocou de maos, e sai SEMPRE. Ela carrega
--     um fato que nenhuma outra linha do feed carrega: o dono antigo e o novo.
--   * `editou_a_etapa`  -- alguem mexeu na etapa de outra pessoa sem assumi-la,
--     e sai so quando o STATUS nao mudou: `subtasks_registra_status` (0035) ja
--     grava `status_da_etapa` com autor e hora em toda mudanca de status, de
--     qualquer pessoa, e o status e a alteracao mais comum da pauta -- uma
--     segunda linha ao lado dela diria o mesmo fato duas vezes no mesmo feed.
--
-- Nada e registrado quando a pessoa mexe na PROPRIA etapa: a pauta propria se
-- edita o dia inteiro, e e justamente o ruido que a 0035 recusa de proposito
-- -- *"salvar o titulo de uma etapa nao e um evento de fluxo"*.
--
-- Por que `task_history` e nao o `audit_log`, e o que as duas linhas NAO
-- dizem: o PASSO 6.
-- ---------------------------------------------------------------------------
create or replace function public.quem_mexe_na_pauta_assume()
returns trigger
language plpgsql
security definer
set search_path = public
as $funcao$
declare
  v_quem          uuid    := (select auth.uid());
  v_mexeu_status  boolean := new.status is distinct from old.status;
  v_ja_e_dono     boolean;
begin
  -- GUARDA 2: sem sessao nao ha a quem atribuir.
  if v_quem is null then
    return new;
  end if;

  -- GUARDA 1: so a equipe assume etapa. O cliente que aprova uma peca escreve
  -- aqui por gatilho, e nao esta assumindo trabalho nenhum.
  if not public.is_staff() then
    return new;
  end if;

  -- GUARDA 5: a fase do mes de social nao troca de dono por uma caixinha.
  if new.social_papel is not null then
    return new;
  end if;

  v_ja_e_dono := public.e_responsavel_pela_etapa(new.id, v_quem);

  -- GUARDA 4: quem ja e responsavel mexe na propria pauta, e nada e
  -- registrado -- a linha de status da 0035 ja responde pelo que importa.
  if v_ja_e_dono then
    return new;
  end if;

  -- GUARDA 3: gestao e Atendimento alteram SEM assumir. A alteracao em etapa
  -- alheia fica registrada, que e a outra metade do item 23.
  --
  -- QUEM ESCREVEU O NOME MANDOU: a troca explicita de responsavel na mesma
  -- escrita e respeitada, e o mesmo registro vale para ela.
  if public.is_gestor()
     or public.is_atendimento()
     or new.responsavel_id is distinct from old.responsavel_id then
    if not v_mexeu_status then
      insert into public.task_history
        (task_id, subtask_id, acao, de_valor, para_valor, autor_id)
      values
        (new.task_id, new.id, 'editou_a_etapa', null, new.titulo, v_quem);
    end if;
    return new;
  end if;

  new.responsavel_id := v_quem;

  insert into public.task_history
    (task_id, subtask_id, acao, de_valor, para_valor, autor_id)
  values
    (new.task_id, new.id, 'assumiu_a_etapa',
     old.responsavel_id::text, v_quem::text, v_quem);

  -- O VINCULO DA 0114 NAO ACOMPANHA SOZINHO, e quem mostrou foi a bateria:
  -- `subtasks_vincula_o_responsavel` e `after update OF responsavel_id`, e o
  -- `of` olha a LISTA DE COLUNAS DO COMANDO -- nao o que um gatilho BEFORE fez
  -- com elas. Num `update ... set prazo = ...` ele nao dispara, mesmo com a
  -- coluna trocada aqui dentro: a etapa ficaria sendo do Bruno pela coluna e da
  -- Marina pela tabela, e `fazASubtarefa()` -- que le as duas -- diria que as
  -- duas a fazem. Quem acerta isso e o gatilho logo abaixo.
  return new;
end
$funcao$;

comment on function public.quem_mexe_na_pauta_assume is
  'Quem nao e gestao nem Atendimento e mexe numa etapa que nao e dele passa a ser o responsavel dela, e a alteracao em etapa alheia vira linha no historico (0144, item 23).';

drop trigger if exists subtasks_quem_mexe_assume on public.subtasks;
create trigger subtasks_quem_mexe_assume
  before update of
    titulo, status, prioridade, data_inicio, prazo,
    estimativa_minutos, tempo_real_minutos,
    descricao_rica, descricao_texto, responsavel_id,
    requer_aprovacao, tipo_aprovacao, parent_id
  on public.subtasks
  for each row execute function public.quem_mexe_na_pauta_assume();

-- E O VINCULO DA 0114 ACERTA DEPOIS, PELA FUNCAO DELA
--
-- Nao ha uma segunda copia da sincronizacao aqui: o gatilho aponta para
-- `subtarefa_vincula_o_responsavel()` (0114), que e quem sabe o que fazer --
-- vincular quem entrou e TIRAR quem saiu, que e o que faz um seletor de uma
-- pessoa continuar significando o que sempre significou. Uma copia seria a
-- segunda verdade sobre quem faz a etapa.
--
-- O `when` e o que o torna preciso: ele dispara so quando a coluna REALMENTE
-- trocou. No caminho do takeover ela trocou aqui dentro, e o gatilho da 0114
-- nao viu; no caminho da troca explicita o da 0114 ja rodou, e este e uma
-- repeticao inofensiva, porque aquela funcao e idempotente (`on conflict do
-- nothing` mais um `delete` que nao acha nada).
--
-- E O `delete` DELA NAO VOLTA PARA CA: ele dispara
-- `subtask_responsaveis_acompanha` (0114), cujo `update` e
-- `where responsavel_id = old.user_id` -- e neste ponto a linha ja carrega o
-- dono NOVO, entao ele nao acha nada. Num gatilho BEFORE acharia, e o update
-- recursivo voltaria por este mesmo gatilho gravando um `editou_a_etapa` que
-- ninguem fez.
drop trigger if exists subtasks_vincula_quem_assumiu on public.subtasks;
create trigger subtasks_vincula_quem_assumiu
  after update of
    titulo, status, prioridade, data_inicio, prazo,
    estimativa_minutos, tempo_real_minutos,
    descricao_rica, descricao_texto, responsavel_id,
    requer_aprovacao, tipo_aprovacao, parent_id
  on public.subtasks
  for each row
  when (new.responsavel_id is distinct from old.responsavel_id)
  execute function public.subtarefa_vincula_o_responsavel();


-- ---------------------------------------------------------------------------
-- PASSO 5 - As DUAS coisas que o PASSO 2 nao abriu
--
-- `subtasks_update` nao limita COLUNA -- a frase que este produto repete
-- desde a 0005 --, entao o que a 0144 quer manter fechado se mantem por
-- trigger. Sao duas, e as duas foram ENCONTRADAS e nao supostas: a primeira
-- pela leitura do pedido, a segunda pela bateria.
--
-- 1. A EXIGENCIA DE AVAL. "Preservar as regras de aprovacao e conclusao das
--    tasks" virou trava e nao uma frase: com o PASSO 2, quem nao e gestao nem
--    Atendimento poderia desligar `requer_aprovacao` de uma etapa e concluir
--    em seguida -- `subtasks_bloqueia_conclusao_sem_aprovacao` (0007)
--    contornada por um booleano.
--
-- 2. O RESPONSAVEL DE UMA FASE DO MES DE SOCIAL, e esta a BATERIA achou.
--    Com o PASSO 2 solto, tres cenarios do arquivo 22 caem -- e o primeiro
--    deles e o que importa: *"E o Design nao distribui etapa que nao e dele"*,
--    que prova a separacao da 0046 (*o Atendimento abre o mes, a gestao
--    distribui a corrente*). Os outros dois caem EM CASCATA, e e a cascata que
--    mede o tamanho do furo: dando a si mesmo a fase `Pauta` de um mes,
--    `tenho_etapa_no_post()` (0047) passa a ser verdadeira para a pessoa, e
--    com ela vem a escrita no CARD de todas as pecas daquele mes -- a legenda,
--    a data de publicacao. E `minha_etapa_do_mes()` vem junto, que e a policy
--    de UPDATE de `post_etapa_progresso` (0088): as caixinhas de dezoito pecas
--    de uma conta que a pessoa nunca viu.
--
--    O comentario da 0047 descreve exatamente isso como o que ela existe para
--    impedir -- *"com dez clientes, `is_staff()` deixaria o designer de outra
--    conta trocar a data de um post que ele nunca viu"*. O item 22 pede a
--    pauta compartilhada, nao a redistribuicao de um mes de social.
--
--    *E a GUARDA 5 do PASSO 4 e a outra metade da mesma decisao:* a fase nao
--    troca de dono por uma caixinha marcada, e nao troca de dono por uma
--    edicao. Quem a distribui continua sendo quem abriu o mes.
--
-- E RECUSA E NAO REESCRITA, ao contrario do PASSO 4: os tres campos aparecem
-- na tela, e quem tenta precisa ouvir que nao pode. Reescrever calado seria
-- a pessoa salvar, ver o valor antigo voltar, e concluir que a tela quebrou
-- -- a razao escrita de `posts_protege_colunas` (0042).
--
-- CADA DICA DIZ O CAMINHO, que e a 0023: a exigencia se muda em Gestao de
-- Tasks, e a fase se redistribui no Social Media. E a segunda dica diz
-- tambem o que CONTINUA aberto, para a recusa nao ser lida como "a pauta
-- voltou a ser fechada".
--
-- E ELE RODA ANTES DO PASSO 4, por ordem alfabetica de gatilho
-- (`subtasks_o_que_e_de_quem_abre` < `subtasks_quem_mexe_assume`), que e a
-- ordem certa: recusar antes de atribuir. O takeover escreve
-- `new.responsavel_id` depois, e por isso nao e recusado por ele mesmo.
-- ---------------------------------------------------------------------------
create or replace function public.o_que_e_de_quem_abre_a_demanda()
returns trigger
language plpgsql
security definer
set search_path = public
as $funcao$
begin
  if (select auth.uid()) is null
     or public.is_gestor()
     or public.is_atendimento() then
    return new;
  end if;

  if new.requer_aprovacao is distinct from old.requer_aprovacao
     or new.tipo_aprovacao is distinct from old.tipo_aprovacao then
    raise exception
      'Quem decide se esta etapa precisa de aprovacao e quem abre a demanda.'
      using hint = 'A exigencia de aval se muda em Gestao de Tasks, com o Atendimento ou a gestao.';
  end if;

  if new.social_papel is not null
     and new.responsavel_id is distinct from old.responsavel_id then
    raise exception
      'Quem distribui a corrente de um mes de social e o Atendimento ou a gestao.'
      using hint = 'A fase do mes se redistribui no Social Media, com quem abriu o mes. A pauta de uma demanda comum, essa qualquer pessoa da equipe altera.';
  end if;

  return new;
end
$funcao$;

comment on function public.o_que_e_de_quem_abre_a_demanda is
  'Duas coisas que a 0144 NAO abriu com subtasks_update: a exigencia de aprovacao de uma etapa, e o responsavel de uma FASE do mes de social (0144).';

drop trigger if exists subtasks_aval_e_de_quem_abre on public.subtasks;
drop trigger if exists subtasks_o_que_e_de_quem_abre on public.subtasks;
create trigger subtasks_o_que_e_de_quem_abre
  before update of requer_aprovacao, tipo_aprovacao, responsavel_id
  on public.subtasks
  for each row execute function public.o_que_e_de_quem_abre_a_demanda();


-- ---------------------------------------------------------------------------
-- PASSO 6 - Onde o registro mora, e por que nao e o `audit_log`
--
-- "Registrar quem realizou cada alteracao, com data e horario" -- e o lugar
-- e `task_history`, que e o feed da aba Historico da demanda. O CLAUDE.md
-- escreve a razao do outro lado: *"quem abre o historico esta perguntando
-- QUEM MEXEU NISTO"*, e aquela aba ja desenha autor, rosto, frase e hora.
--
-- NAO E O `audit_log`: a 0058 poe `subtasks` na trilha so no APAGAMENTO, com
-- a razao escrita -- *"cada mexida numa etapa viraria uma linha, e uma tela
-- com trezentas linhas por dia e uma tela que ninguem abre"* --, e aquela
-- trilha e do SOCIO, enquanto a pauta e de toda a equipe.
--
-- SAO DUAS ACOES E NAO UMA, e a diferenca e o que aconteceu:
--   * `assumiu_a_etapa` -- a etapa trocou de maos;
--   * `editou_a_etapa`  -- alguem mexeu na etapa de outra pessoa sem
--     assumi-la: gestao, Atendimento, ou quem trocou o responsavel na mesma
--     escrita.
--
-- E A SEGUNDA NAO SAI QUANDO O STATUS MUDOU, que e a guarda de volume:
-- `subtasks_registra_status` (0035) JA grava `status_da_etapa` com autor e
-- hora em toda mudanca de status, de qualquer pessoa. Uma segunda linha ao
-- lado dela diria o mesmo fato duas vezes no mesmo feed -- e o status e a
-- alteracao mais comum da pauta. *A troca de maos e a excecao, e sai sempre:*
-- ela carrega um fato que a linha de status nao carrega, o dono antigo e o
-- novo.
--
-- E NADA QUANDO A PESSOA MEXE NA PROPRIA ETAPA: a pauta propria se edita o
-- dia inteiro, e e justamente o ruido que a 0035 recusa de proposito --
-- *"salvar o titulo de uma etapa nao e um evento de fluxo"*.
--
-- *O que isto NAO registra, e e dito em vez de escondido:* QUAL coluna mudou.
-- `de_valor` e `para_valor` guardam o dono antigo e o novo no caso da troca,
-- e o titulo da etapa no caso da edicao -- e nao um diff. Um diff por coluna
-- e o `audit_log`, com a tela de trezentas linhas que ele existe para nao
-- ter; o que o feed responde e quem mexeu, quando, e em que etapa.
-- ---------------------------------------------------------------------------
-- (os dois insert moram na funcao do PASSO 4 -- este passo e a razao deles)


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------
do $conferencia$
declare
  v_update_aberta boolean;
  v_assume        boolean;
  v_aval          boolean;
  v_anon          boolean;
begin
  select pg_get_expr(polqual, polrelid) = 'is_staff()'
    into v_update_aberta
    from pg_policy pol join pg_class c on c.oid = pol.polrelid
   where c.relname = 'subtasks' and pol.polname = 'subtasks_update';

  select exists (
    select 1 from pg_trigger
     where tgrelid = 'public.subtasks'::regclass
       and tgname = 'subtasks_quem_mexe_assume'
  ) into v_assume;

  select exists (
    select 1 from pg_trigger
     where tgrelid = 'public.subtasks'::regclass
       and tgname = 'subtasks_o_que_e_de_quem_abre'
  ) into v_aval;

  select has_function_privilege('anon', 'public.carga_da_equipe(date,date)', 'EXECUTE')
    into v_anon;

  raise notice '0144 | subtasks_update aberta a equipe: %', coalesce(v_update_aberta, false);
  raise notice '0144 | gatilho do takeover: %', v_assume;
  raise notice '0144 | gatilho da exigencia de aval: %', v_aval;
  raise notice '0144 | carga_da_equipe ainda alcancavel por anon: %', v_anon;
end
$conferencia$;
