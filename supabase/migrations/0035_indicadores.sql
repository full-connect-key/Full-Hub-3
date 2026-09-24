-- ---------------------------------------------------------------------------
-- 0035 - A camada de indicadores: carga, historico de status e as agregacoes
--
-- Sprint 15. A tela inicial vira a abertura do dia, e a agencia ganha metrica.
--
-- TRES COISAS QUE O SPRINT PRESSUPUNHA E QUE NAO EXISTIAM NESTE PROJETO. Elas
-- nascem aqui, e vale dizer o que cada uma e, porque quem ler o sprint vai
-- procura-las com outro nome:
--
--   1. `carga_do_dia(user_id, data)` -- o sprint diz "use o componente que ja
--      existe, nao recalcule". Ele nunca existiu. Nasce aqui, e e a UNICA
--      conta de carga do produto: a tela inicial, a metrica e o resumo
--      chamam esta funcao. Duas contas de carga dariam dois numeros para a
--      mesma pessoa no mesmo dia, e a tela de sobrecarga e exatamente onde
--      isso vira discussao.
--
--   2. `activity_log` -- o sprint pede "tempo medio por etapa, de
--      activity_log". Essa tabela nao existe; o que existe e `task_history`,
--      e ate agora ela so registrava DECISAO DE CLIENTE. Sem transicao de
--      status gravada, "quanto tempo a etapa ficou em cada status" nao tem
--      de onde sair. O PASSO 2 acrescenta o gatilho que grava.
--
--      CONSEQUENCIA QUE PRECISA ESTAR ESCRITA: o historico comeca AGORA. As
--      etapas que ja passaram por producao antes desta migration nao deixaram
--      rastro, e nenhuma conta inventa o que nao foi medido. As metricas de
--      tempo por status enchem com o uso.
--
--   3. `tasks.status = 'rascunho'` -- o sprint filtra os rascunhos assim. No
--      produto, rascunho e `publicada_em is null` (migration 0028), e
--      `rascunho` NAO e valor do enum de proposito. Todo filtro aqui usa
--      `publicada_em is not null`, que e a verdade do banco.
--
-- E UMA QUARTA QUE NAO DA PARA RESOLVER AQUI: o bloco "Precisa de mim" pede
-- "notas fiscais rejeitadas". A tabela `invoices` nao existe -- a 0013 diz no
-- cabecalho que ela ficou fora por decisao do usuario, e Notas Fiscais segue
-- sendo tela de espera. O bloco entrega os outros tres itens.
--
-- SO FOLHA CONTA, em tudo. Quem tem filha para de ser unidade de trabalho: a
-- agrupadora somaria o tempo das filhas de novo, e a rentabilidade cobraria em
-- dinheiro um trabalho que aconteceu uma vez.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A carga de uma pessoa num dia
--
-- Minutos COMPROMETIDOS: a estimativa das etapas em aberto cujo periodo cobre
-- o dia. Etapa sem estimativa entra como zero e aparece na contagem -- e
-- honesto: ela ocupa a pessoa, so ninguem disse quanto.
--
-- O PERIODO, e nao so o prazo. A etapa tem `data_inicio` e `prazo` desde a
-- 0027, e uma etapa de tres dias ocupa os tres. Contar so no prazo poria a
-- semana inteira de trabalho no ultimo dia.
--
-- Etapa sem `data_inicio` conta no prazo; etapa sem prazo nao conta em dia
-- nenhum -- nao da para alocar o que ninguem datou.
-- ---------------------------------------------------------------------------
create or replace function public.carga_do_dia(p_user_id uuid, p_data date)
returns table (
  minutos_comprometidos integer,
  etapas                integer,
  etapas_sem_estimativa integer,
  ausente               boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  with folhas as (
    select s.*
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where s.responsavel_id = p_user_id
       -- Rascunho fica fora de TODO indicador (0028).
       and t.publicada_em is not null
       and s.status not in ('concluida')
       and s.prazo is not null
       and p_data between coalesce(s.data_inicio, s.prazo) and s.prazo
       -- Agrupadora nao e unidade de trabalho: quem mede sao as filhas.
       and not public.subtask_eh_agrupadora(s.id)
  )
  select
    coalesce(sum(f.estimativa_minutos), 0)::integer,
    count(*)::integer,
    count(*) filter (where f.estimativa_minutos is null)::integer,
    exists (
      select 1 from public.team_presence tp
       where tp.user_id = p_user_id and tp.data = p_data
         and tp.status in ('ferias', 'licenca', 'ausente', 'folga', 'feriado')
    )
    from folhas f;
end;
$$;

comment on function public.carga_do_dia is
  'A carga de uma pessoa num dia: minutos comprometidos pelas etapas em aberto cujo periodo cobre o dia. Fonte UNICA de carga do produto (0035).';


-- ---------------------------------------------------------------------------
-- PASSO 2 - O historico de status da etapa
--
-- `task_history` ja existia e ja era lida pela aba Historico do detalhe da
-- Task; o que faltava era alguem gravar a TRANSICAO. Sem ela nao ha "tempo
-- medio por etapa" nem "tempo em aprovacao interna" -- as duas perguntas sao
-- sobre quanto tempo se passou ENTRE dois estados, e um estado atual sozinho
-- nao responde isso.
--
-- Grava so quando o status MUDA. Salvar o titulo de uma etapa nao e um evento
-- de fluxo, e uma linha por save encheria a tabela de ruido -- e a aba
-- Historico, que a mesma tabela alimenta, ficaria ilegivel.
--
-- `de_valor` e `para_valor` sao text porque a coluna e text desde a 0007: ela
-- guarda transicao de qualquer coisa, nao so de `subtask_status`.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_status_da_subtarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.task_history (task_id, subtask_id, acao, de_valor, para_valor, autor_id)
  values (new.task_id, new.id, 'status_da_etapa',
          old.status::text, new.status::text, (select auth.uid()));

  return new;
end;
$$;

drop trigger if exists subtasks_registra_status on public.subtasks;
create trigger subtasks_registra_status
  after update on public.subtasks
  for each row execute function public.registrar_status_da_subtarefa();


-- ---------------------------------------------------------------------------
-- PASSO 3 - Quanto tempo a etapa ficou em cada status
--
-- A conta e a diferenca entre uma transicao e a seguinte. A ULTIMA transicao
-- nao fecha -- a etapa ainda esta naquele status --, entao ela conta ate
-- agora, e nao e descartada: a etapa parada ha duas semanas em "aguardando
-- informacoes" e justamente o caso que a metrica existe para mostrar.
--
-- Devolve linha por (status, minutos), agregado em cima por quem chamar.
-- ---------------------------------------------------------------------------
create or replace function public.tempo_por_status(p_de date, p_ate date)
returns table (
  status        text,
  minutos       bigint,
  ocorrencias   bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Indicador da agência: apenas gestão.';
  end if;

  return query
  with eventos as (
    select h.subtask_id,
           h.para_valor as status,
           h.created_at,
           lead(h.created_at) over (partition by h.subtask_id order by h.created_at) as proximo
      from public.task_history h
      join public.subtasks s on s.id = h.subtask_id
      join public.tasks t on t.id = s.task_id
     where h.acao = 'status_da_etapa'
       and t.publicada_em is not null
       and h.created_at >= p_de
       and h.created_at < (p_ate + 1)
  )
  select e.status,
         sum(extract(epoch from (coalesce(e.proximo, now()) - e.created_at)) / 60)::bigint,
         count(*)::bigint
    from eventos e
   group by e.status;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - De que cliente e uma rodada
--
-- A rodada aponta para (content_type, content_id) desde a 0030, e cada tipo
-- chega ao cliente por um caminho: a etapa pela Task, o post direto, o
-- entregavel pela campanha. Um lugar so faz essa traducao -- e o mesmo
-- raciocinio de `rodadasDo()` em TypeScript.
-- ---------------------------------------------------------------------------
create or replace function public.cliente_da_rodada(p_tipo text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_tipo = 'subtask' then
    return (select t.client_id
              from public.subtasks s join public.tasks t on t.id = s.task_id
             where s.id = p_id);
  elsif p_tipo = 'post' then
    return (select p.client_id from public.posts p where p.id = p_id);
  elsif p_tipo = 'deliverable' then
    return (select c.client_id
              from public.deliverables d join public.campaigns c on c.id = d.campaign_id
             where d.id = p_id);
  end if;

  return null;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 5 - Tempo em aprovacao INTERNA, separado do tempo do cliente
--
-- Sao dois numeros e o sprint pede os dois separados, com razao: se o interno
-- for alto, o gargalo e da casa, e nenhuma cobranca ao cliente resolve.
--
-- Conta da abertura da rodada ate a decisao. Rodada ainda pendente conta ate
-- agora -- e ela que representa o represamento de hoje.
-- ---------------------------------------------------------------------------
create or replace function public.tempo_de_aprovacao(p_de date, p_ate date)
returns table (
  escopo         text,
  client_id      uuid,
  horas_media    numeric,
  rodadas        bigint,
  pendentes      bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Indicador da agência: apenas gestão.';
  end if;

  return query
  select r.escopo::text,
         public.cliente_da_rodada(r.content_type, r.content_id),
         round(avg(extract(epoch from (coalesce(r.decidido_em, now()) - r.solicitado_em)) / 3600)::numeric, 1),
         count(*)::bigint,
         count(*) filter (where r.status = 'pendente')::bigint
    from public.approval_rounds r
   where r.solicitado_em >= p_de
     and r.solicitado_em < (p_ate + 1)
   group by r.escopo, 2;
end;
$$;




-- ---------------------------------------------------------------------------
-- PASSO 6 - Producao do periodo
--
-- Criadas, concluidas, atrasadas e a taxa de entrega no prazo. Tudo por
-- SUBTAREFA: a Task nao tem responsavel nem prazo desde o Sprint 3B, e um
-- indicador de entrega montado sobre ela mediria o agrupador em vez do
-- trabalho.
--
-- "No prazo" compara a conclusao com o prazo. Etapa sem prazo fica fora da
-- taxa e aparece em `sem_prazo`: ela nao pode estar no prazo nem fora dele, e
-- somar como acerto inflaria a taxa justamente onde ninguem combinou data.
-- ---------------------------------------------------------------------------
create or replace function public.producao_do_periodo(
  p_de        date,
  p_ate       date,
  p_client_id uuid default null
)
returns table (
  criadas         bigint,
  concluidas      bigint,
  atrasadas       bigint,
  no_prazo        bigint,
  fora_do_prazo   bigint,
  sem_prazo       bigint,
  minutos_reais   bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Indicador da agência: apenas gestão.';
  end if;

  return query
  with folhas as (
    select s.*, t.client_id
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where t.publicada_em is not null
       and not public.subtask_eh_agrupadora(s.id)
       and (p_client_id is null or t.client_id = p_client_id)
  )
  select
    count(*) filter (where f.created_at::date between p_de and p_ate),
    count(*) filter (where f.concluida_em::date between p_de and p_ate),
    -- ATRASADA e "em aberto e passou da data", medido HOJE. Nao e um evento
    -- do periodo: e o estado de agora, como `situacao_do_lancamento()` no
    -- Financeiro. Guardar atraso como coluna criaria a rotina noturna que
    -- mente no dia em que nao roda.
    count(*) filter (where f.status <> 'concluida' and f.prazo < current_date),
    count(*) filter (where f.concluida_em::date between p_de and p_ate
                       and f.prazo is not null and f.concluida_em::date <= f.prazo),
    count(*) filter (where f.concluida_em::date between p_de and p_ate
                       and f.prazo is not null and f.concluida_em::date > f.prazo),
    count(*) filter (where f.concluida_em::date between p_de and p_ate
                       and f.prazo is null),
    coalesce(sum(f.tempo_real_minutos) filter (
      where f.concluida_em::date between p_de and p_ate), 0)::bigint
    from folhas f;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 7 - Estimativa contra tempo real
--
-- O desvio medio, por pessoa. E onde o planejamento erra -- e o sinal so
-- aparece quando os dois numeros existem, entao a funcao exige os dois.
--
-- Devolve o desvio em PONTOS PERCENTUAIS sobre a estimativa: "esta pessoa
-- leva 40% a mais do que estima" diz mais que "leva 32 minutos a mais", que
-- depende do tamanho da etapa.
-- ---------------------------------------------------------------------------
create or replace function public.desvio_de_estimativa(p_de date, p_ate date)
returns table (
  responsavel_id  uuid,
  etapas          bigint,
  minutos_estimados bigint,
  minutos_reais   bigint,
  desvio_percentual numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Indicador da agência: apenas gestão.';
  end if;

  return query
  select s.responsavel_id,
         count(*)::bigint,
         sum(s.estimativa_minutos)::bigint,
         sum(s.tempo_real_minutos)::bigint,
         round(((sum(s.tempo_real_minutos)::numeric / nullif(sum(s.estimativa_minutos), 0)) - 1) * 100, 1)
    from public.subtasks s
    join public.tasks t on t.id = s.task_id
   where t.publicada_em is not null
     and not public.subtask_eh_agrupadora(s.id)
     and s.concluida_em::date between p_de and p_ate
     and s.estimativa_minutos is not null
     and s.tempo_real_minutos is not null
     and s.responsavel_id is not null
   group by s.responsavel_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 8 - A qualidade da entrega, vista pelo cliente
--
-- Taxa de aprovacao na PRIMEIRA rodada e numero medio de rodadas ate o
-- aceite. Sao a mesma pergunta por dois angulos: quanto a entrega volta.
--
-- So conteudo que o cliente JA DECIDIU entra na media de rodadas -- contar o
-- que ainda esta em aprovacao baixaria a media com ciclos que nao
-- terminaram.
-- ---------------------------------------------------------------------------
create or replace function public.qualidade_da_entrega(p_de date, p_ate date)
returns table (
  client_id          uuid,
  conteudos          bigint,
  aprovados_de_prima bigint,
  rodadas_media      numeric,
  rejeitados         bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Indicador da agência: apenas gestão.';
  end if;

  return query
  with decididos as (
    select r.content_type, r.content_id,
           public.cliente_da_rodada(r.content_type, r.content_id) as cliente,
           max(r.numero_rodada) as rodadas,
           bool_or(r.status = 'aprovada' and r.numero_rodada = 1) as de_prima,
           bool_or(r.status = 'rejeitada') as recusado
      from public.approval_rounds r
     where r.escopo = 'cliente'
       and r.decidido_em::date between p_de and p_ate
     group by r.content_type, r.content_id
  )
  select d.cliente,
         count(*)::bigint,
         count(*) filter (where d.de_prima)::bigint,
         round(avg(d.rodadas), 1),
         count(*) filter (where d.recusado)::bigint
    from decididos d
   group by d.cliente;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 9 - Receita por hora trabalhada, por cliente
--
-- SO O SOCIO, e a trava e a primeira linha. E a mesma regra do modulo
-- Financeiro (0013): faturamento por cliente e margem sao a informacao mais
-- sensivel da casa, e "so leitura para o gestor" nao existe aqui -- nem
-- agregado em grafico, que e o pedido explicito do sprint.
--
-- A receita cruza com o tempo das SUBTAREFAS, nunca com `tasks`: a coluna
-- `tempo_real_horas` nao existe desde o Sprint 3B, e ressuscita-la daria
-- zero.
--
-- Cliente sem hora lancada volta com `horas` zero e `receita_por_hora` NULA,
-- nao zero: zero e uma afirmacao sobre a conta, e o que se quer dizer e que
-- ninguem mediu.
-- ---------------------------------------------------------------------------
create or replace function public.rentabilidade_do_periodo(p_de date, p_ate date)
returns table (
  client_id        uuid,
  receita          numeric,
  despesa          numeric,
  horas            numeric,
  receita_por_hora numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_socio() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'O financeiro da agência é do sócio.';
  end if;

  return query
  with dinheiro as (
    select fe.client_id,
           sum(fe.valor) filter (where fe.tipo = 'receita') as receita,
           sum(fe.valor) filter (where fe.tipo = 'despesa') as despesa
      from public.finance_entries fe
     where fe.competencia between date_trunc('month', p_de)::date and p_ate
     group by fe.client_id
  ),
  tempo as (
    select t.client_id,
           sum(s.tempo_real_minutos)::numeric / 60 as horas
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where t.publicada_em is not null
       and not public.subtask_eh_agrupadora(s.id)
       and s.concluida_em::date between p_de and p_ate
       and s.tempo_real_minutos is not null
     group by t.client_id
  )
  select coalesce(d.client_id, h.client_id),
         coalesce(d.receita, 0),
         coalesce(d.despesa, 0),
         coalesce(h.horas, 0),
         case when coalesce(h.horas, 0) > 0
              then round(coalesce(d.receita, 0) / h.horas, 2)
         end
    from dinheiro d
    full outer join tempo h on h.client_id = d.client_id;
end;
$$;
