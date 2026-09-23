-- ---------------------------------------------------------------------------
-- 0030 - A rodada de aprovacao deixa de ser so da subtarefa
--
-- Sprint 11. O Portal do Cliente vai receber POST e ENTREGAVEL de campanha
-- (Sprints 12 e 13), e os dois passam pela mesma decisao que a subtarefa ja
-- passa: alguem envia, a gestao valida, a gestao manda ao cliente, o cliente
-- aprova ou pede ajuste.
--
-- A alternativa era um segundo fluxo de aprovacao ao lado deste. E exatamente
-- a duplicacao que o produto ja desfez uma vez, quando a Task e a subtarefa
-- tinham cada uma a sua regra: duas implementacoes da mesma pergunta divergem
-- na primeira semana, e a que diverge em silencio e a que decide se o material
-- foi ao cliente.
--
-- ENTAO A RODADA PASSA A APONTAR PARA (content_type, content_id), e nao mais
-- para `subtask_id`. Hoje todo mundo e 'subtask'; 'post' e 'deliverable'
-- entram com as tabelas deles.
--
-- O QUE SE PERDE COM A COLUNA, e nao estava no pedido: `subtask_id` tinha
-- `references subtasks(id) on delete cascade`. Apagar uma etapa apagava as
-- rodadas dela junto. `content_id` nao pode ter chave estrangeira -- ela
-- aponta para tabelas diferentes conforme o tipo --, entao a limpeza vira
-- trigger (`subtasks_limpa_rodadas`, no fim deste arquivo). Sem ele, apagar
-- uma demanda deixaria rodadas orfas, e a fila de aprovacoes tentaria mostrar
-- a etapa que nao existe mais.
--
-- E AS POLICIES FALHAM FECHADO. Enquanto 'post' e 'deliverable' nao tiverem
-- regra propria, elas recusam esses tipos em vez de deixar passar: um tipo
-- novo que ninguem sabe julgar nao pode nascer visivel ao cliente. Quem
-- acrescentar o tipo acrescenta a regra na mesma migration.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - O enum do fluxo de conteudo
--
-- Os sete estados por que passa um post ou um entregavel. Nenhuma tabela usa
-- ainda -- elas chegam nos Sprints 12 e 13 --, e ele entra agora porque o
-- `StatusBadge` ja precisa saber traduzir os sete, e porque valor de enum nao
-- pode ser *usado* na mesma transacao em que nasce: criar o enum e a tabela
-- juntos quebraria a migration que a criasse.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'content_status') then
    create type public.content_status as enum (
      'aguardando_informacoes', 'em_producao', 'em_aprovacao',
      'ajustes', 'aprovado', 'rejeitado', 'stand_by'
    );
  end if;
end
$$;

comment on type public.content_status is
  'Os sete estados de um conteudo do cliente (post, entregavel). Distinto de task_status e de subtask_status: tres fluxos, tres vocabularios (0030).';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A troca da coluna
--
-- O `if` inteiro existe para a migration rodar duas vezes: na segunda,
-- `subtask_id` ja nao existe e nao ha nada a converter.
-- ---------------------------------------------------------------------------
alter table public.approval_rounds
  add column if not exists content_type text not null default 'subtask';

alter table public.approval_rounds
  add column if not exists content_id uuid;

-- AS POLICIES SAEM ANTES DA COLUNA, e foi o Postgres quem cobrou: ele recusa
-- `drop column` enquanto alguma policy cita a coluna, e lista quais. Uma
-- delas eu nao tinha no mapa -- `tasks_select_cliente`, em OUTRA tabela, que
-- chega em approval_rounds por um `exists`. Todas voltam no PASSO 6.
drop policy if exists tasks_select_cliente               on public.tasks;
drop policy if exists approval_rounds_select_cliente     on public.approval_rounds;
drop policy if exists approval_rounds_decide             on public.approval_rounds;
drop policy if exists approval_rounds_sem_rascunho_alheio on public.approval_rounds;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public'
                and table_name = 'approval_rounds'
                and column_name = 'subtask_id') then
    update public.approval_rounds set content_id = subtask_id where content_id is null;
    alter table public.approval_rounds alter column content_id set not null;
    -- Leva junto a chave unica e o indice que citavam a coluna.
    alter table public.approval_rounds drop column subtask_id;
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'approval_rounds_content_type_valido') then
    alter table public.approval_rounds
      add constraint approval_rounds_content_type_valido
      check (content_type in ('subtask', 'post', 'deliverable'));
  end if;
end
$$;

-- A mesma unicidade de antes, um nivel acima: um conteudo nao tem duas
-- rodadas com o mesmo numero e o mesmo escopo.
create unique index if not exists approval_rounds_conteudo_rodada_key
  on public.approval_rounds (content_type, content_id, numero_rodada, escopo);

create index if not exists approval_rounds_conteudo_idx
  on public.approval_rounds (content_type, content_id, numero_rodada);

comment on column public.approval_rounds.content_type is
  'subtask | post | deliverable. Sem chave estrangeira: a coluna aponta para tabelas diferentes conforme o tipo (0030).';
comment on column public.approval_rounds.content_id is
  'O id do conteudo, na tabela que content_type nomeia. A limpeza ao apagar o conteudo e por trigger, nao por cascade.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - A pergunta que todo mundo faz
--
-- "Esta rodada e de qual subtarefa?" tem UMA resposta em UM lugar. Escrita a
-- mao em cada consulta, bastava uma esquecer o `content_type = 'subtask'` para
-- uma rodada de post entrar no calculo do status de uma task.
-- ---------------------------------------------------------------------------
create or replace function public.subtask_da_rodada(p_content_type text, p_content_id uuid)
returns uuid
language plpgsql
immutable
as $$
begin
  return case when p_content_type = 'subtask' then p_content_id end;
end;
$$;

comment on function public.subtask_da_rodada(text, uuid) is
  'O id da subtarefa quando a rodada e de subtarefa, e null nos outros tipos (0030).';


-- ---------------------------------------------------------------------------
-- PASSO 4 - Tudo que perguntava por `subtask_id` volta a perguntar direito
--
-- Nenhuma destas funcoes muda de comportamento para a subtarefa. O que muda e
-- que cada uma passou a DIZER que fala de subtarefa -- e e por isso que a
-- rodada de um post nao vai entrar no calculo do status de uma demanda por
-- acidente.
-- ---------------------------------------------------------------------------

-- O cliente enxerga a etapa quando ela e de uma empresa dele E ja teve alguma
-- rodada enviada a ele.
create or replace function public.subtask_visivel_ao_cliente(p_subtask_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where s.id = p_subtask_id
       and t.client_id in (select public.my_client_ids())
       and exists (
         select 1 from public.approval_rounds r
          where r.content_type = 'subtask'
            and r.content_id = s.id
            and r.escopo = 'cliente'
       )
  );
end;
$$;

-- A ULTIMA rodada do escopo exigido esta aprovada?
--
-- E a ultima, e nao "alguma": uma etapa que foi aprovada, voltou para ajuste e
-- abriu rodada nova nao esta aprovada -- ela esta em revisao com um carimbo
-- velho no historico.
create or replace function public.subtask_tem_aval(p_subtask_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  tipo   public.tipo_aprovacao;
  ultima integer;
begin
  select s.tipo_aprovacao into tipo
    from public.subtasks s where s.id = p_subtask_id;

  -- Sem tipo nao ha escopo para procurar. O check
  -- `subtasks_tipo_aprovacao_coerente` (0007) e quem impede uma etapa de
  -- exigir aval sem dizer qual.
  if tipo is null then
    return true;
  end if;

  select max(numero_rodada) into ultima
    from public.approval_rounds
   where content_type = 'subtask' and content_id = p_subtask_id;

  if ultima is null then
    return false;
  end if;

  return exists (
    select 1 from public.approval_rounds r
     where r.content_type = 'subtask'
       and r.content_id = p_subtask_id
       and r.numero_rodada = ultima
       and r.escopo = tipo::text::public.escopo_rodada
       and r.status = 'aprovada'
  );
end;
$$;

create or replace function public.validar_transicao_de_subtarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  return new;
end;
$$;

-- Nova rodada: quem pode abrir, e em que ordem.
create or replace function public.validar_nova_rodada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo  uuid := public.subtask_da_rodada(new.content_type, new.content_id);
  dono  uuid;
  exige boolean;
begin
  -- TIPO SEM REGRA E TIPO RECUSADO, e e de proposito. 'post' e 'deliverable'
  -- entram no enum agora porque a coluna precisa do check, mas quem julga
  -- cada um sao os Sprints 12 e 13. Deixar passar seria abrir rodada de um
  -- conteudo que nenhuma trava sabe conferir.
  if alvo is null then
    raise exception using
      errcode = 'check_violation',
      message = format('Rodada de aprovação de "%s" ainda não tem regra.', new.content_type),
      hint    = 'Só conteúdo do tipo subtask passa por aqui hoje.';
  end if;

  select s.responsavel_id, s.requer_aprovacao into dono, exige
    from public.subtasks s where s.id = alvo;

  if not coalesce(exige, false) then
    raise exception using
      errcode = 'check_violation',
      message = 'Essa subtarefa não exige aprovação.';
  end if;

  if new.escopo = 'interna' then
    -- quem produziu pede a validacao; a gestao tambem pode, para destravar
    if new.solicitado_por is distinct from dono and not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Só o responsável pela subtarefa envia para aprovação.';
    end if;
  else
    -- escopo cliente: ato deliberado da gestao, e so depois do aval interno
    if not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Enviar para o cliente é do Desenvolvedor.',
        hint    = 'O responsável pela subtarefa nunca envia material ao cliente.';
    end if;

    -- A 0029 liberou APROVAR o proprio trabalho. ENVIAR ao cliente continua
    -- travado: sao duas decisoes, e o usuario mudou uma.
    if new.solicitado_por = dono then
      raise exception using
        errcode = 'check_violation',
        message = 'Ninguém envia ao cliente a própria entrega.',
        hint    = 'Quem aprovou internamente é quem envia.';
    end if;

    if not exists (
      select 1 from public.approval_rounds r
       where r.content_type = new.content_type
         and r.content_id = new.content_id
         and r.numero_rodada = new.numero_rodada
         and r.escopo = 'interna'
         and r.status = 'aprovada'
    ) then
      raise exception using
        errcode = 'check_violation',
        message = 'Esta rodada ainda não passou pela aprovação interna.';
    end if;
  end if;

  return new;
end;
$$;

-- A etapa que agrupa sub-etapas nao vai para aprovacao: quem entrega e a filha.
create or replace function public.recusar_rodada_de_agrupadora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid := public.subtask_da_rodada(new.content_type, new.content_id);
  nome text;
begin
  if alvo is not null and public.subtask_eh_agrupadora(alvo) then
    select titulo into nome from public.subtasks where id = alvo;
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" agrupa sub-etapas e não é ela que vai para aprovação.', nome),
      hint    = 'Quem entrega é a sub-etapa. Envie a sub-etapa para aprovação.';
  end if;

  return new;
end;
$$;


-- O status da Task conta so as FOLHAS, e so as rodadas de SUBTAREFA.
--
-- A segunda metade e nova, e e o caso que a generalizacao cria: sem o filtro
-- por tipo, uma rodada de post pendente entraria neste `count` pelo id e
-- arrastaria a demanda para "em aprovacao" sem nenhuma etapa em aprovacao.
create or replace function public.recalcular_status_task(p_task_id uuid)
returns public.task_status
language plpgsql
security definer
set search_path = public
as $$
declare
  total             integer;
  concluidas        integer;
  em_ajustes        integer;
  aguardando        integer;
  andando           integer;
  rodadas_pendentes integer;
  atual             public.task_status;
  manual            boolean;
  novo              public.task_status;
begin
  select t.status, t.status_manual into atual, manual
    from public.tasks t where t.id = p_task_id;

  if not found then
    return null;
  end if;

  -- MARCADO A MAO E MARCADO A MAO (0025).
  if manual then
    return atual;
  end if;

  select
    count(*),
    count(*) filter (where s.status = 'concluida'),
    count(*) filter (where s.status = 'em_ajustes'),
    count(*) filter (where s.status = 'aguardando_informacoes'),
    count(*) filter (where s.status in ('em_andamento', 'enviada_aprovacao'))
  into total, concluidas, em_ajustes, aguardando, andando
  from public.subtasks s
   where s.task_id = p_task_id
     and not exists (select 1 from public.subtasks f where f.parent_id = s.id);

  select count(*) into rodadas_pendentes
    from public.approval_rounds r
    join public.subtasks s on s.id = r.content_id
   where r.content_type = 'subtask'
     and s.task_id = p_task_id
     and r.status = 'pendente';

  if em_ajustes > 0 then
    novo := 'em_ajustes';
  elsif rodadas_pendentes > 0 then
    novo := 'em_aprovacao';
  elsif total > 0 and concluidas = total then
    novo := 'concluido';
  elsif aguardando > 0 and andando = 0 then
    novo := 'aguardando_informacoes';
  elsif andando > 0 or concluidas > 0 then
    novo := 'em_andamento';
  else
    novo := 'nao_iniciada';
  end if;

  if novo is distinct from atual then
    update public.tasks
       set status = novo,
           status_manual = false,
           concluida_em = case when novo = 'concluido' then coalesce(concluida_em, now()) end
     where id = p_task_id;
  end if;

  return novo;
end;
$$;

-- Quem avisa a Task de que uma rodada mexeu.
--
-- Este eu NAO tinha no mapa: o corpo dele nao cita `approval_rounds`, ele so
-- le `new.subtask_id` -- e e o gatilho `approval_rounds_recalcula_task` que o
-- liga a tabela. Grep por "approval_rounds" nao acha; quem achou foi a
-- bateria, no primeiro `delete`. E a razao de a bateria rodar contra um
-- Postgres de verdade e nao contra a leitura do arquivo.
create or replace function public.tocar_status_da_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  sub  uuid;
begin
  if tg_table_name = 'subtasks' then
    alvo := coalesce(new.task_id, old.task_id);
  else
    -- Rodada de post ou de entregavel nao tem task: `subtask_da_rodada`
    -- devolve null e o recalculo nao acontece, que e o certo.
    sub := public.subtask_da_rodada(
             coalesce(new.content_type, old.content_type),
             coalesce(new.content_id, old.content_id));
    select s.task_id into alvo from public.subtasks s where s.id = sub;
  end if;

  if alvo is not null then
    perform public.recalcular_status_task(alvo);
  end if;

  return coalesce(new, old);
end;
$$;


-- A decisao do cliente, inteira, numa transacao so.
create or replace function public.decidir_rodada_do_cliente(
  p_round_id   uuid,
  p_decisao    public.status_rodada,
  p_comentario text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r          public.approval_rounds%rowtype;
  alvo       uuid;
  id_da_task uuid;
  quem       uuid := (select auth.uid());
begin
  select * into r from public.approval_rounds where id = p_round_id;

  if not found then
    raise exception 'Rodada não encontrada.';
  end if;

  if r.escopo <> 'cliente' then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Esta rodada não é uma aprovação de cliente.';
  end if;

  if r.status <> 'pendente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Esta rodada já foi decidida.';
  end if;

  alvo := public.subtask_da_rodada(r.content_type, r.content_id);

  -- Mesma razao de `validar_nova_rodada`: tipo sem regra nao passa. Quando
  -- post e entregavel chegarem, cada um traz o seu ramo aqui.
  if alvo is null then
    raise exception using
      errcode = 'insufficient_privilege',
      message = format('Aprovação de "%s" ainda não é decidida por aqui.', r.content_type);
  end if;

  if not public.subtask_visivel_ao_cliente(alvo) then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Sem acesso a esta aprovação.';
  end if;

  if p_decisao = 'ajustes_solicitados' and (p_comentario is null or btrim(p_comentario) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'Diga o que precisa ser ajustado.';
  end if;

  update public.approval_rounds
     set status = p_decisao,
         decidido_por = quem,
         decidido_em = now(),
         comentario = p_comentario
   where id = p_round_id;

  update public.subtasks
     set status = (case when p_decisao = 'aprovada' then 'concluida' else 'em_ajustes' end)::public.subtask_status
   where id = alvo;

  select task_id into id_da_task from public.subtasks where id = alvo;

  insert into public.task_history (task_id, subtask_id, approval_round_id, acao, para_valor, autor_id)
  values (id_da_task, alvo, p_round_id,
          case when p_decisao = 'aprovada' then 'cliente_aprovou' else 'cliente_pediu_ajustes' end,
          p_decisao::text, quem);

  if p_comentario is not null and btrim(p_comentario) <> '' then
    insert into public.task_comentarios (task_id, subtask_id, approval_round_id, autor_id, texto, interno)
    values (id_da_task, alvo, p_round_id, quem, p_comentario, false);
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 5 - O cascade que a chave estrangeira fazia
--
-- `content_id` nao tem `references`, entao apagar a etapa nao apaga mais as
-- rodadas dela. Este trigger faz o que o `on delete cascade` fazia -- e so
-- para o tipo 'subtask', porque e o unico que existe.
-- ---------------------------------------------------------------------------
create or replace function public.limpar_rodadas_da_subtarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.approval_rounds
   where content_type = 'subtask' and content_id = old.id;
  return old;
end;
$$;

drop trigger if exists subtasks_limpa_rodadas on public.subtasks;
create trigger subtasks_limpa_rodadas
  after delete on public.subtasks
  for each row execute function public.limpar_rodadas_da_subtarefa();


-- ---------------------------------------------------------------------------
-- PASSO 6 - As policies
--
-- As duas que citavam `subtask_id` passam a exigir o tipo em voz alta. E o
-- ponto em que a generalizacao poderia virar um furo: `pode_aprovar_subtarefa`
-- depois da 0029 e `is_gestor()` e ignora o parametro, entao uma rodada de
-- tipo desconhecido seria decidida por qualquer gestor sem nenhuma checagem de
-- a quem ela pertence. `content_type = 'subtask'` e o que fecha essa porta ate
-- os Sprints 12 e 13 abrirem a certa.
-- ---------------------------------------------------------------------------
-- A demanda aparece para o cliente quando alguma etapa dela ja foi enviada a
-- ele. Ela vive em `tasks` e chega aqui por um `exists` -- e por isso que o
-- `drop column` a listou como dependente.
drop policy if exists tasks_select_cliente on public.tasks;
create policy tasks_select_cliente on public.tasks
  for select to authenticated
  using (
    client_id in (select public.my_client_ids())
    and exists (
      select 1
        from public.subtasks s
        join public.approval_rounds r
          on r.content_type = 'subtask' and r.content_id = s.id and r.escopo = 'cliente'
       where s.task_id = tasks.id
    )
  );

drop policy if exists approval_rounds_select_cliente on public.approval_rounds;
create policy approval_rounds_select_cliente on public.approval_rounds
  for select to authenticated
  using (
    escopo = 'cliente'
    and content_type = 'subtask'
    and public.subtask_visivel_ao_cliente(content_id)
  );

drop policy if exists approval_rounds_decide on public.approval_rounds;
create policy approval_rounds_decide on public.approval_rounds
  for update to authenticated
  using (content_type = 'subtask' and public.pode_aprovar_subtarefa(content_id))
  with check (content_type = 'subtask' and public.pode_aprovar_subtarefa(content_id));

-- A restritiva do rascunho (0028), reescrita pelo mesmo motivo.
drop policy if exists approval_rounds_sem_rascunho_alheio on public.approval_rounds;
create policy approval_rounds_sem_rascunho_alheio on public.approval_rounds
  as restrictive for all to authenticated
  using (
    content_type <> 'subtask'
    or not exists (select 1 from public.subtasks s
                    where s.id = content_id and public.rascunho_alheio(s.task_id))
  )
  with check (
    content_type <> 'subtask'
    or not exists (select 1 from public.subtasks s
                    where s.id = content_id and public.rascunho_alheio(s.task_id))
  );

notify pgrst, 'reload schema';
