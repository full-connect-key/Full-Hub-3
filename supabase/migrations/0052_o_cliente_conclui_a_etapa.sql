-- ---------------------------------------------------------------------------
-- 0052 - QUEM APROVA A PECA CONCLUI A ETAPA
--
-- Decisao do usuario, respondendo a pergunta que a 0051 deixou em aberto:
--
--   "A etapa se conclui sozinha. Nesse caso, o responsavel entrega, e o
--    cliente conclui, quando aprova -- basicamente um libera pra aprovacao,
--    e o outro devolve o OK, e considera aquela etapa feita totalmente."
--
-- E o fecho do fio que a 0051 comecou: la a campanha passou a nascer com uma
-- demanda, e cada entregavel virou uma etapa. Faltava o outro lado -- a etapa
-- ficava aberta para sempre, e quem a fez tinha que voltar ao Minhas Tasks
-- para marcar concluida uma peca que o cliente ja tinha aprovado. Duas maos
-- para o mesmo fato, e a segunda e a que ninguem lembra de dar.
--
-- ---------------------------------------------------------------------------
-- E VALE NOS DOIS SENTIDOS, como a finalizacao da campanha
--
-- Pedir ajustes depois de aprovar tira o `aprovado` do entregavel, e a etapa
-- volta para `em_andamento`. Deixa-la concluida seria a demanda afirmando que
-- o trabalho acabou enquanto a peca esta sendo refeita -- e a Task inteira
-- contaria uma etapa a mais como pronta.
--
-- ---------------------------------------------------------------------------
-- O QUE O TRIGGER NAO FAZ, E E A PARTE QUE IMPORTA
--
-- **Ele nunca derruba a aprovacao do cliente.** O cliente esta do outro lado,
-- sem ninguem por perto para consertar nada: se a conclusao da etapa fosse
-- recusada por um trigger de `subtasks`, o que ele veria era a aprovacao dele
-- falhando -- e a peca continuaria esperando por ele. Por isso a conclusao e
-- TENTADA, e so acontece quando as travas da etapa ja deixam:
--
--   1. A etapa existe e nao e agrupadora. Quem tem filha para de ser unidade
--      de trabalho desde a 0022, e o status dela e calculado pelas filhas --
--      escrever nela seria escrever num valor descartado.
--   2. Ela nao exige aval proprio sem ter um. `requer_aprovacao = true` numa
--      etapa de campanha e alguem dizendo "isto precisa de validacao interna
--      antes de fechar", e a aprovacao do cliente no entregavel nao e essa
--      validacao. A etapa fica aberta, que e a verdade: a peca foi aprovada,
--      a etapa nao foi validada.
--   3. Nenhuma dependencia a segura. `subtask_liberada()` ja responde isso, e
--      sem a pergunta aqui uma etapa dependente derrubaria a aprovacao com
--      uma mensagem sobre outra etapa.
--
-- Nos tres casos a etapa continua aberta e visivel em Minhas Tasks. Isso NAO
-- e falhar em silencio: o estado que fica na tela e o estado verdadeiro, e a
-- pessoa ve a etapa dela esperando.
--
-- ---------------------------------------------------------------------------
-- E O TEMPO REAL FICA VAZIO, e foi dito a quem decidiu
--
-- Concluir pela tela abre o `DialogoDeTempo`, pre-preenchido com o medido.
-- Concluindo por aqui nao ha quem perguntar -- o cliente nao sabe quanto a
-- peca levou. `tempo_real_minutos` fica nulo nessas etapas, e a rentabilidade
-- do Financeiro conta so o que foi declarado: cliente sem hora lancada
-- aparece com "sem hora registrada", nunca com zero.
--
-- O cronometro, esse continua medindo: `tempo_medido_segundos` e escrito pelo
-- trigger `subtasks_cronometro`, que para o relogio ao sair de
-- `em_andamento`. O numero existe; o que falta e a pessoa afirmar que ele e o
-- certo.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- E ANTES DISSO: A 0030 PERDEU OS CARIMBOS DE DATA DA ETAPA
--
-- Encontrado escrevendo o cenario acima, e o achado nao e desta decisao -- e
-- mais velho e mais largo que ela.
--
-- A 0007 criou `validar_transicao_de_subtarefa()` com quatro travas E um
-- bloco de carimbos no fim: `iniciada_em` no primeiro `em_andamento`,
-- `concluida_em` ao concluir, e `concluida_em := null` ao sair de concluida.
-- O comentario dela dizia "para o historico nao depender de a action
-- lembrar".
--
-- A 0030 reescreveu a funcao inteira para trocar `r.subtask_id` pelo par
-- `(content_type, content_id)` -- e reescreveu a partir do texto das quatro
-- travas, sem o bloco do fim. **E exatamente a armadilha do
-- `create or replace`**: ele nao avisa que a versao nova tem menos coisa que
-- a velha. Desde entao NENHUMA subtarefa do produto tem `concluida_em`, e
-- nenhuma tem `iniciada_em`.
--
-- **E nao apareceu como bug porque so uma tela le a coluna**, e o que ela
-- devolve e um numero: `lib/dados/tasks.ts` filtra
-- `.gte("concluida_em", <primeiro do mes>)` para o contador de concluidas.
-- Ele vinha respondendo zero desde a 0030 -- e zero e uma resposta plausivel
-- num contador. Nenhuma tela quebra, nenhum erro aparece, e o numero esta
-- errado.
--
-- Ninguem mais escreve essas colunas: em `database.types.ts` as duas ficam
-- fora de `Insert` e de `Update`, com o comentario dizendo "quem carimba e o
-- trigger". A promessa continuou escrita depois de o trigger ter parado de
-- cumpri-la.
--
-- Aqui a funcao e reconstruida a partir da versao MAIS NOVA -- a da 0030,
-- com o par `(content_type, content_id)` -- e o bloco de carimbos volta. A
-- bateria ganhou o cenario que faltava: ele pergunta pela data, nao so pelo
-- status.
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
      hint    = 'Use "Enviar para aprovação". A conclusão vem do resultado da aprovação.';
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
      hint    = 'A rodada é criada pela ação "Enviar para aprovação".';
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


create or replace function public.etapa_acompanha_o_entregavel()
returns trigger
language plpgsql
as $funcao$
declare
  etapa   public.subtasks%rowtype;
  tem_aval boolean;
begin
  if new.subtask_id is null then
    return new;
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;

  select * into etapa from public.subtasks s where s.id = new.subtask_id;
  if not found then
    return new;
  end if;

  -- AGRUPADORA NAO SE ESCREVE. O status dela e calculado pelas filhas desde a
  -- 0022, e o banco descarta o que vier escrito -- este `if` existe para a
  -- intencao ficar na migration e nao num descarte silencioso tres tabelas
  -- adiante.
  if exists (select 1 from public.subtasks f where f.parent_id = etapa.id) then
    return new;
  end if;

  if new.status = 'aprovado' and etapa.status <> 'concluida' then
    tem_aval := (not etapa.requer_aprovacao) or public.subtask_tem_aval(etapa.id);

    -- AS DUAS PERGUNTAS ANTES DE ESCREVER, e nao um `exception when others`
    -- em volta: engolir a excecao esconderia tambem o erro que ninguem
    -- previu, e um trigger que engole erro e um trigger em que nao se confia.
    if tem_aval and public.subtask_liberada(etapa.id) then
      update public.subtasks set status = 'concluida' where id = etapa.id;
    end if;

  elsif old.status = 'aprovado' and new.status <> 'aprovado'
        and etapa.status = 'concluida' then
    -- DE VOLTA AO TRABALHO. Nao para `nao_iniciada`: a peca foi feita uma vez
    -- e vai ser refeita, e `em_andamento` e o unico dos seis que diz isso.
    update public.subtasks set status = 'em_andamento' where id = etapa.id;
  end if;

  return new;
end
$funcao$;

comment on function public.etapa_acompanha_o_entregavel() is
  'A aprovacao do cliente conclui a etapa da campanha, e o pedido de ajustes a reabre (0052). Nunca derruba a aprovacao: quando as travas da etapa nao deixam, ela fica aberta -- que e a verdade.';

drop trigger if exists deliverables_conclui_a_etapa on public.deliverables;
create trigger deliverables_conclui_a_etapa
  after update of status on public.deliverables
  for each row execute function public.etapa_acompanha_o_entregavel();

notify pgrst, 'reload schema';
