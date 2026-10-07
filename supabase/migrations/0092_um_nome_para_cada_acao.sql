-- ---------------------------------------------------------------------------
-- 0092 - UM NOME PARA CADA ACAO DO FLUXO DE APROVACAO
--
-- Sprint 3K, parte 5. O produto chamava a MESMA acao de tres nomes diferentes
-- conforme a tela:
--
--   * na etapa de demanda, "Enviar para aprovacao";
--   * no post do social, "Marcar como pronto";
--   * na peca de campanha, "Enviar para analise".
--
-- As tres abrem exatamente a mesma coisa -- uma rodada de escopo `interna` em
-- `approval_rounds` --, decidida pela mesma `pode_aprovar_subtarefa()`, na
-- mesma fila. Quem passa pelos tres modulos tem que descobrir sozinho que sao
-- a mesma coisa; e, pior, quem le a recusa de um modulo procura na tela um
-- botao que ela nomeia e que ali se chama outra coisa. E a decisao do Sprint 9
-- com "tipo de tarefa" x "Workflow", aplicada ao fluxo de aprovacao.
--
-- O nome que fica e PEDIR AVAL INTERNO, e os seis termos padronizados estao
-- no CLAUDE.md. A varredura de `check:cores` passou a procurar as formas que
-- sairam, porque "esse nome nao existe mais" e um critario que precisa ser
-- verificado toda vez.
--
-- ---------------------------------------------------------------------------
-- E A MIGRATION EXISTE PORQUE DUAS DICAS NOMEIAM O BOTAO.
--
-- Trocar o rotulo so em `src/` deixaria `validar_transicao_de_subtarefa`
-- mandando a pessoa usar *"Enviar para aprovacao"* numa tela em que esse botao
-- nao existe mais -- e `atualizarTask` concatena o `hint` do Postgres na
-- mensagem, entao a frase chega inteira a quem clicou. Uma recusa que nomeia
-- um botao inexistente manda a pessoa procurar o que nao esta la, que e a
-- diferenca que a 0023 escreveu entre uma recusa e uma instrucao.
--
-- E DIFERENTE do caso dos comentarios datados da 0028 e da 0031, que ficaram
-- errados de proposito: `comment on` e metadado que ninguem que usa o sistema
-- le, e uma migration que so reescreve comentario e uma migration que alguem
-- aplica por engano achando que muda alguma coisa. `hint` aparece na tela.
--
-- REESCRITA A PARTIR DA VERSAO MAIS NOVA, que e a da 0052 -- nao da 0030, nem
-- da 0007. `create or replace function` nao avisa quando a nova tem menos
-- coisa que a velha, e foi exatamente assim que a 0030 perdeu o bloco de
-- carimbos da 0007 e nenhuma subtarefa teve `concluida_em` por duas
-- migrations. O corpo abaixo e o da 0052 com DUAS STRINGS trocadas, e nada
-- mais -- as quatro travas, a ordem delas e os carimbos estao letra por
-- letra.
--
-- A TERCEIRA DICA NAO MUDA, e vale dizer por que: *"em_ajustes vem de
-- 'Solicitar ajustes', interno ou do cliente"* nomeia um botao que continua
-- se chamando assim nas tres telas. Padronizar e fazer o nome ser um so, nao
-- trocar o nome de tudo.
--
-- Medido com mutacao: devolvendo qualquer uma das duas dicas, um cenario de
-- `supabase/testes/02_tasks_e_subtarefas.sql` falha e diz qual -- eles medem
-- a DICA por `teste.recusa_com_dica`, que e o texto que a tela mostra, e nao
-- so a mensagem. Uma trava com a dica apagada passaria por uma checagem que
-- so le a mensagem, que e a licao do `tasks_sem_cancelada` na 0020.
-- ---------------------------------------------------------------------------

create or replace function public.validar_transicao_de_subtarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $validar$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- 1. Subtarefa que exige aprovacao nunca e concluida pelo proprio caminho.
  if new.status = 'concluida' and new.requer_aprovacao and not public.subtask_tem_aval(new.id) then
    raise exception using
      errcode = 'check_violation',
      message = format('A subtarefa "%s" exige aprovação %s e não pode ser concluída direto.',
                       new.titulo, new.tipo_aprovacao),
      hint    = 'Use "Pedir aval interno". A conclusão vem do resultado da aprovação.';
  end if;

  -- 2. So sai de nao_iniciada quem nao esta esperando dependencia.
  if old.status = 'nao_iniciada' and new.status <> 'nao_iniciada'
     and not public.subtask_liberada(new.id) then
    raise exception using
      errcode = 'check_violation',
      message = format('A subtarefa "%s" está aguardando: %s.',
                       new.titulo, public.subtask_pendencias(new.id));
  end if;

  -- 3. `enviada_aprovacao` sem rodada pendente e status mentindo.
  if new.status = 'enviada_aprovacao' and not exists (
       select 1 from public.approval_rounds r
        where r.content_type = 'subtask' and r.content_id = new.id and r.status = 'pendente'
     ) then
    raise exception using
      errcode = 'check_violation',
      message = format('A subtarefa "%s" não tem rodada de aprovação pendente.', new.titulo),
      hint    = 'A rodada é criada pela ação "Pedir aval interno".';
  end if;

  -- 4. `em_ajustes` e resultado de alguem ter PEDIDO ajuste.
  if new.status = 'em_ajustes' and not exists (
       select 1 from public.approval_rounds r
        where r.content_type = 'subtask' and r.content_id = new.id
          and r.status = 'ajustes_solicitados'
     ) then
    raise exception using
      errcode = 'check_violation',
      message = format('Nenhuma rodada pediu ajustes na subtarefa "%s".', new.titulo),
      hint    = 'em_ajustes vem de "Solicitar ajustes", interno ou do cliente.';
  end if;

  -- OS CARIMBOS, de volta. `coalesce` no de conclusao: quando a action
  -- informar a data -- e nenhuma informa hoje --, e a dela que vale.
  if new.status = 'em_andamento' and new.iniciada_em is null then
    new.iniciada_em := now();
  end if;
  if new.status = 'concluida' then
    new.concluida_em := coalesce(new.concluida_em, now());
  else
    new.concluida_em := null;
  end if;

  return new;
end;
$validar$;

comment on function public.validar_transicao_de_subtarefa() is
  'As quatro travas da transicao de status da subtarefa (0007), mais os carimbos de inicio e de conclusao (devolvidos na 0052). Desde a 0092 as duas dicas nomeiam "Pedir aval interno", que e o nome unico da acao nos tres modulos.';

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- COMO CONFERIR, depois de aplicar:
--
--   select pg_get_functiondef('public.validar_transicao_de_subtarefa()'::regprocedure)
--     like '%Pedir aval interno%' as dicas_novas;
-- ---------------------------------------------------------------------------
