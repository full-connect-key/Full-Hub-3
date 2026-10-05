-- ===========================================================================
-- ATENCAO: ESTA MIGRATION AINDA NAO ESTA PRONTA. NAO APLIQUE.
--
-- Ela esta commitada em andamento para o trabalho nao se perder, e nao
-- porque esta terminada. O que falta:
--
--   - a bateria tem 5 cenarios vermelhos. Quatro sao a consequencia
--     aritmetica da distribuicao (120 -> 45, 120 -> 64, 300 -> 173,
--     ociosidade 3,0% -> 1,7%) e precisam da expectativa atualizada COM a
--     razao escrita ao lado; o quinto ("As quatro etapas sem estimativa
--     aparecem na contagem", esperado 4, achado 38) ainda esta sendo
--     investigado -- parece etapa vencida chegando ao dia de hoje por
--     `carga_do_dia()`, que deveria passar `p_daqui_pra_frente = false`;
--   - faltam os cenarios que PROVAM a distribuicao, que e o criterio de
--     aceite do sprint: "uma subtarefa de 8h com janela de 5 dias uteis
--     aparece como ~1h36 por dia, nao 8h no ultimo dia";
--   - falta a prova por mutacao.
--
-- E ela MUDA NUMERO QUE JA ESTA NA TELA: `carga_do_dia()` passou a dividir
-- a estimativa pela janela em vez de somar a estimativa inteira em cada dia
-- coberto. A Linha do Tempo do Calendario Full, o Inicio e os alertas de
-- carga do Feedback (0075) vao mostrar valores MENORES -- e o limiar de
-- sobrecarga do Feedback (110% em dois periodos seguidos) foi calibrado
-- contra os numeros inflados, entao ele vai disparar menos. Isso e o numero
-- ficando honesto, e e mudanca visivel: aplicar sem decidir isso e trocar o
-- significado de uma tela sem ninguem ter escolhido.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0081 - A DISPONIBILIDADE DE QUEM VAI RECEBER O TRABALHO
--
-- Sprint 3I. Ao delegar uma etapa, quem atribui ve o calendario da pessoa
-- escolhida: que dias estao livres, quais estao cheios, quais ela esta fora.
-- A decisao de prazo deixa de ser palpite.
--
-- ---------------------------------------------------------------------------
-- A CARGA E DISTRIBUIDA PELA JANELA, E E ISSO QUE A FUNCAO TRAZ DE NOVO
--
-- Contar a estimativa inteira no dia do prazo da um retrato falso: cinco
-- etapas de 4h vencendo na sexta mostram 20h na sexta e a semana vazia, e na
-- vida a pessoa trabalha nelas a semana toda.
--
--   janela  = do inicio possivel ate o prazo
--   fatia   = estimativa / dias uteis da janela
--
-- Uma etapa de 8h com janela de segunda a sexta ocupa 1h36 por dia.
--
-- O INICIO POSSIVEL e o maior entre hoje, o inicio da etapa (ou da demanda) e
-- o prazo da ultima dependencia em aberto -- antes dela a etapa nao comeca, e
-- o trigger da 0007 recusa. Para a dependencia usamos o PRAZO dela e nao a
-- janela dela: perseguir a cadeia inteira seria recursao por etapa, e o prazo
-- e a data que a propria dependencia promete.
--
-- ---------------------------------------------------------------------------
-- E `carga_do_dia()` PASSA A CHAMAR ESTA, EM VEZ DE CONTAR DE OUTRO JEITO
--
-- Ela existe desde a 0035 e conta a estimativa INTEIRA em cada dia coberto
-- pelo periodo da etapa. As duas respondem "quanto trabalho a Ana tem no dia
-- 12", e com as duas de pe a mesma pergunta teria duas respostas: o
-- calendario de delegar diria 1h36 e a Linha do Tempo pintaria o dia a partir
-- de 8h. E exatamente o que o comentario da 0035 existe para impedir -- *"uma
-- segunda conta daria dois numeros para a mesma pessoa no mesmo dia"* -- e o
-- sprint pede em quantas palavras: nao duplicar o calculo em outro lugar.
--
-- Entao `carga_do_dia()` continua com a MESMA assinatura e o mesmo retorno, e
-- vira um recorte de um dia desta funcao. Quem a chama nao muda: a Linha do
-- Tempo do Calendario Full, o bloco de carga da Home e os alertas do Feedback
-- seguem o mesmo caminho.
--
-- **E A UNICA COISA QUE AS SEPARA E O `p_daqui_pra_frente`**, que a bateria
-- encontrou. Projetando, a etapa VENCIDA cai no dia de hoje: ela continua
-- pendente e compete pelo tempo de hoje, que e a verdade para quem vai
-- delegar. Olhando para tras isso e falso -- na primeira rodada, a carga de
-- hoje passou a somar trinta e oito etapas em vez de quatro, porque toda
-- etapa vencida da agencia desaguava nela, e o retrato historico do Feedback
-- herdava isso. O calculo continua UM; o que muda e a pergunta, e ela e um
-- booleano e nao uma segunda funcao.
--
-- **OS NUMEROS MUDAM, e e o ponto da mudanca, nao um efeito colateral.** Eles
-- caem: a etapa de 8h que contava 8h em cada um dos cinco dias passa a contar
-- 1h36. A ocupacao que a Linha do Tempo pinta fica mais perto do que a pessoa
-- realmente tem pela frente, e os limiares de sobrecarga do Feedback (110% em
-- dois periodos seguidos) passam a medir isso. A bateria guarda os dois
-- cenarios que mostram a diferenca.
--
-- ---------------------------------------------------------------------------
-- QUATRO DIVERGENCIAS DO TEXTO DO SPRINT, E AS QUATRO SAO SOBRE O PRODUTO
--
-- 1. **`tasks.status = 'rascunho'` nao existe.** Rascunho e `publicada_em is
--    null` desde a 0028, e `rascunho` nunca foi valor do enum -- o SQL Editor
--    roda o arquivo colado numa transacao so, e um valor de enum nao pode ser
--    usado na mesma transacao em que nasce. E o quinto sprint seguido a
--    escrever isso; o filtro certo esta no `where` abaixo.
--
-- 2. **`subtask_status` nao tem `cancelada`.** Sao seis valores, e `cancelada`
--    e do enum da TASK -- onde o trigger `tasks_sem_cancelada` a recusa desde
--    a 0020. Entao o filtro e `status <> 'concluida'` e mais nada.
--
-- 3. **"tipo de tarefa" e o WORKFLOW**, nome que o produto trocou no Sprint 9
--    e que `check:cores` varre para nao voltar. E a ETAPA nao tem tipo
--    proprio: quem tem workflow e a demanda (`tasks.task_type_id`). A media
--    da estimativa sai dali, com a mediana da agencia como segundo degrau.
--
-- 4. **`capacidade_minutos_dia` nao tem default nulo**: a 0055 a criou
--    `not null default 480`. O `coalesce` abaixo cobre quem nao tem ficha de
--    equipe, que e outro caso.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A ESTIMATIVA DE QUEM NAO TEM ESTIMATIVA
--
-- Etapa sem `estimativa_minutos` nao pode sumir da conta: ela e trabalho, e
-- um calendario que a ignora mostra a pessoa mais livre do que ela esta. Mas
-- tambem nao pode entrar com um numero inventado sem aviso -- por isso a
-- funcao devolve um valor E a tela marca a etapa com `~`.
--
-- SAO TRES DEGRAUS, e a ordem importa: a mediana das etapas do mesmo
-- workflow nos ultimos 90 dias, a mediana da agencia no mesmo periodo, e 60
-- minutos. **Mediana e nao media**, porque uma etapa de 40h entre dez de 1h
-- puxa a media para 5h e a mediana continua em 1h -- e o que se quer e o
-- caso tipico, nao o excepcional.
--
-- O NUMERO 60 MORA SO AQUI. Um gemeo em TypeScript seria a segunda verdade
-- de sempre, e a tela nao precisa dele: ela le o que esta funcao devolveu.
-- ---------------------------------------------------------------------------
create or replace function public.estimativa_presumida(p_workflow uuid default null)
returns integer
language plpgsql
stable
set search_path = public
as $funcao$
declare
  resposta integer;
begin
  if p_workflow is not null then
    select percentile_cont(0.5) within group (order by s.estimativa_minutos)
      into resposta
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where t.task_type_id = p_workflow
       and s.estimativa_minutos is not null
       and s.created_at >= now() - interval '90 days';
    if resposta is not null and resposta > 0 then
      return resposta;
    end if;
  end if;

  select percentile_cont(0.5) within group (order by s.estimativa_minutos)
    into resposta
    from public.subtasks s
   where s.estimativa_minutos is not null
     and s.created_at >= now() - interval '90 days';

  return greatest(coalesce(resposta, 60), 1);
end
$funcao$;

comment on function public.estimativa_presumida(uuid) is
  'A estimativa de uma etapa que nao tem a propria (0081): mediana do workflow nos ultimos 90 dias, mediana da agencia, 60 minutos. Mediana e nao media -- uma etapa de 40h entre dez de 1h puxa a media e nao a mediana.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A CONTA: A DISPONIBILIDADE, DIA A DIA
--
-- `security definer` pela razao de `carga_do_dia()`: quem delega precisa ver
-- o calendario de QUEM VAI RECEBER, e `subtasks_select` nao devolve a etapa
-- de outra pessoa para um colaborador. O que sai daqui e agregado -- minutos
-- por dia e ate cinco titulos --, a forma de `usuarios_do_meu_cliente()`.
--
-- E ela e `is_staff()` na primeira linha: delegar e coisa de quem esta dentro
-- da agencia, e sem a guarda `security definer` entregaria a agenda da equipe
-- a quem tiver a chave anon.
-- ---------------------------------------------------------------------------
create or replace function public.disponibilidade_bruta(
  p_user_id            uuid,
  p_inicio             date,
  p_fim                date,
  p_modo               text    default 'distribuida',
  p_incluir_concluidas boolean default false,
  p_daqui_pra_frente   boolean default false
)
returns table (
  data                date,
  dia_util            boolean,
  capacidade_minutos  integer,
  indisponivel_motivo text,
  carga_minutos       integer,
  etapas_count        integer,
  etapas_sem_estimativa integer,
  entregas_count      integer,
  entregas_minutos    integer,
  ocupacao_pct        integer,
  evento              text,
  itens               jsonb
)
language plpgsql
security definer
set search_path = public
stable
as $funcao$
declare
  cap integer;
begin
  -- O TETO E DE 120 DIAS, pela razao do teto de 62 de `carga_da_equipe()`: a
  -- tela pede um mes por vez e nunca o ano, e sem o teto um parametro torto
  -- na URL viraria uma varredura de trezentos e sessenta e cinco dias.
  if p_fim - p_inicio > 120 then
    raise exception 'Período longo demais para a disponibilidade: % dias.', p_fim - p_inicio
      using hint = 'O calendário pede um mês por vez.';
  end if;

  select coalesce(tm.capacidade_minutos_dia, 480) into cap
    from public.team_members tm where tm.user_id = p_user_id;
  cap := coalesce(cap, 480);

  return query
  with dias as (
    select g::date as dia from generate_series(p_inicio, p_fim, interval '1 day') g
  ),
  -- AS ETAPAS EM ABERTO, com a janela ja resolvida.
  etapas as (
    select
      s.id,
      s.titulo,
      c.nome_empresa as cliente,
      s.prazo,
      (s.estimativa_minutos is null) as estimada,
      coalesce(s.estimativa_minutos, public.estimativa_presumida(t.task_type_id)) as minutos,
      greatest(
        -- O CHAO DA JANELA. Sem projetar, ela e o periodo que a etapa
        -- declara: `data_inicio` ate `prazo`, e so o prazo quando nao ha
        -- inicio -- que e o recorte que `carga_do_dia()` sempre teve.
        coalesce(s.data_inicio, t.data_inicio, s.prazo),
        -- HOJE, so olhando para a frente. Projetando, uma etapa vencida e
        -- trabalho de HOJE: ela continua pendente, e escondê-la e o jeito
        -- mais facil de sobrecarregar alguem sem perceber.
        case when p_daqui_pra_frente then current_date else '-infinity'::date end,
        -- A DEPENDENCIA EM ABERTO EMPURRA O COMECO, pela mesma razao:
        -- enquanto ela nao fecha a etapa nao sai de `nao_iniciada` (0007), e
        -- contar carga antes do prazo dela e prometer trabalho que o banco
        -- recusa. Olhando para tras isso nao se pergunta -- o que aconteceu
        -- aconteceu.
        case when p_daqui_pra_frente then coalesce((
          select max(dd.prazo)
            from public.subtask_dependencies dep
            join public.subtasks dd on dd.id = dep.depende_de_id
           where dep.subtask_id = s.id and dd.status <> 'concluida'
        ), '-infinity'::date) else '-infinity'::date end
      ) as comeca
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
      left join public.clients c on c.id = t.client_id
     where s.responsavel_id = p_user_id
       -- RASCUNHO FICA FORA DE TODO INDICADOR (0028), e e `publicada_em` e
       -- nao um status: `rascunho` nao e valor do enum.
       and t.publicada_em is not null
       and (p_incluir_concluidas or s.status <> 'concluida')
       and s.prazo is not null
       -- Agrupadora nao e unidade de trabalho: quem mede sao as filhas (0022).
       and not public.subtask_eh_agrupadora(s.id)
  ),
  -- A JANELA DE CADA ETAPA. A VENCIDA CAI EM HOJE: `comeca` ja e no minimo
  -- `current_date`, entao quando o prazo passou os dois se encontram e a
  -- etapa ocupa o dia de hoje inteiro -- que e a verdade, ela continua
  -- pendente. Esconde-la seria o jeito mais facil de sobrecarregar alguem
  -- sem perceber.
  janelas as (
    select e.*, greatest(e.prazo, e.comeca) as termina,
           public.dias_uteis(e.comeca, greatest(e.prazo, e.comeca)) as uteis
      from etapas e
  ),
  fatias as (
    select j.id, j.titulo, j.cliente, j.prazo, j.estimada, j.minutos, f.dia, f.fatia
      from janelas j
      cross join lateral (
        -- O caminho normal: uma fatia por dia util da janela.
        select g::date as dia, (j.minutos::numeric / j.uteis) as fatia
          from generate_series(j.comeca, j.termina, interval '1 day') g
         where j.uteis > 0
           and extract(isodow from g) < 6
           and not exists (select 1 from public.holidays h where h.data = g::date)
        union all
        -- JANELA SEM NENHUM DIA UTIL -- um prazo de sabado com comeco no
        -- mesmo sabado. Sem este ramo a etapa sumiria da conta por divisao
        -- por zero, que e o pior desfecho: ela existe e ninguem a ve.
        select j.termina, j.minutos::numeric where j.uteis = 0
      ) f
  ),
  -- O que vence em cada dia, independente do modo: e a outra pergunta.
  entregas as (
    select j.prazo as dia, count(*)::integer as qtd, sum(j.minutos)::integer as mins
      from janelas j
     group by j.prazo
  ),
  carga as (
    select f.dia,
           sum(f.fatia) as minutos,
           count(*)::integer as qtd,
           count(*) filter (where f.estimada)::integer as sem_estimativa,
           (
             select jsonb_agg(x)
               from (
                 select jsonb_build_object(
                          'id', f2.id, 'titulo', f2.titulo, 'cliente', f2.cliente,
                          'minutos', round(f2.fatia)::integer, 'estimada', f2.estimada,
                          'prazo', f2.prazo
                        ) as x
                   from fatias f2
                  where f2.dia = f.dia
                  order by f2.fatia desc
                  limit 5
               ) t
           ) as top
      from fatias f
     group by f.dia
  ),
  -- O EVENTO REDUZ A CAPACIDADE, e o de dia inteiro zera. Quem participa de
  -- uma convencao de tres dias nao tem oito horas livres nesses dias, e um
  -- calendario que diz que tem manda trabalho para quem nao esta na mesa.
  eventos as (
    select g::date as dia,
           min(ev.nome) as nome,
           bool_or(ev.dia_inteiro) as inteiro,
           coalesce(sum(
             case when ev.dia_inteiro then 0
                  else extract(epoch from (ev.hora_fim - ev.hora_inicio)) / 60
             end
           ), 0)::integer as minutos
      from public.events ev
      join public.event_participants ep on ep.event_id = ev.id and ep.user_id = p_user_id
      cross join generate_series(ev.data_inicio, ev.data_fim, interval '1 day') g
     where g::date between p_inicio and p_fim
     group by g::date
  )
  select
    d.dia,
    uteis.eh,
    capac.minutos,
    motivo.chave,
    round(coalesce(
      case when p_modo = 'entregas' then ent.mins::numeric else cg.minutos end, 0
    ))::integer,
    coalesce(cg.qtd, 0),
    coalesce(cg.sem_estimativa, 0),
    coalesce(ent.qtd, 0),
    coalesce(ent.mins, 0),
    -- SEM CAPACIDADE NAO HA PORCENTAGEM, e `null` e a resposta honesta: um
    -- dia de descanso com carga nao esta "a 300%", ele esta em conflito. Quem
    -- desenha isso le `indisponivel_motivo` primeiro.
    case when capac.minutos > 0
         then round(coalesce(
                case when p_modo = 'entregas' then ent.mins::numeric else cg.minutos end, 0
              ) * 100 / capac.minutos)::integer
    end,
    evt.nome,
    coalesce(cg.top, '[]'::jsonb)
  from dias d
  cross join lateral (
    select (extract(isodow from d.dia) < 6
            and not exists (select 1 from public.holidays h where h.data = d.dia)) as eh
  ) uteis
  left join eventos evt on evt.dia = d.dia
  cross join lateral (
    -- A PRECEDENCIA: o que a pessoa combinou vem antes do calendario. Quem
    -- esta de descanso num feriado le "descanso", que e o fato dela.
    select case
      when pres.status is not null then pres.status::text
      when extract(isodow from d.dia) >= 6 then 'fim_de_semana'
      when exists (select 1 from public.holidays h where h.data = d.dia) then 'feriado'
      when evt.inteiro then 'evento'
    end as chave
    from (
      select tp.status from public.team_presence tp
       where tp.user_id = p_user_id and tp.data = d.dia
         and tp.status in ('ferias', 'licenca', 'ausente', 'folga')
       limit 1
    ) pres
    right join (select 1) um on true
  ) motivo
  cross join lateral (
    select case
      when not uteis.eh then 0
      when motivo.chave is not null and motivo.chave <> 'evento' then 0
      when coalesce(evt.inteiro, false) then 0
      else greatest(cap - coalesce(evt.minutos, 0), 0)
    end as minutos
  ) capac
  left join carga cg on cg.dia = d.dia
  left join entregas ent on ent.dia = d.dia
  order by d.dia;
end
$funcao$;

comment on function public.disponibilidade_bruta(uuid, date, date, text, boolean, boolean) is
  'A CONTA de disponibilidade, sem porta (0081): capacidade, carga DISTRIBUIDA pela janela de cada etapa, o que vence no dia, o evento e ate cinco etapas. E a unica implementacao do calculo de carga do produto. Nao se chama direto -- `disponibilidade()` e a porta de quem delega, `carga_do_dia()` e o recorte de um dia.';

-- ELA NAO E CHAMAVEL DE FORA, e e o que separa a conta da porta: ela devolve
-- TITULO E CLIENTE das etapas de outra pessoa, e sem o `revoke` seria a
-- agenda da equipe inteira ao alcance de quem tiver a chave anon -- que vai
-- no bundle que o navegador baixa. Quem a chama sao as duas funcoes abaixo,
-- as duas `security definer`, cada uma com a propria pergunta na porta.
revoke all on function public.disponibilidade_bruta(uuid, date, date, text, boolean, boolean) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 2B - A PORTA DE QUEM DELEGA
--
-- `is_staff()` e nao `is_gestor()`: quem distribui trabalho numa demanda pode
-- ser o colaborador do Atendimento, que e quem abre a demanda desde a 0006.
-- Travar em gestao poria a pergunta "a Ana tem espaco na quinta?" fora do
-- alcance de quem a faz todo dia.
--
-- **E A GUARDA MORA AQUI E NAO NA CONTA**, e foi a bateria que mostrou por
-- que: a primeira versao a pos dentro da calculadora, e `carga_do_dia()`
-- parou de funcionar para TODOS os chamadores que nao tinham sessao de
-- equipe -- inclusive o proprio cenario de bateria, que roda como o dono da
-- tabela. A conta e uma; as portas sao duas, e cada uma pergunta o que a
-- tela dela precisa perguntar.
-- ---------------------------------------------------------------------------
create or replace function public.disponibilidade(
  p_user_id            uuid,
  p_inicio             date,
  p_fim                date,
  p_modo               text    default 'distribuida',
  p_incluir_concluidas boolean default false,
  p_daqui_pra_frente   boolean default false
)
returns table (
  data                date,
  dia_util            boolean,
  capacidade_minutos  integer,
  indisponivel_motivo text,
  carga_minutos       integer,
  etapas_count        integer,
  etapas_sem_estimativa integer,
  entregas_count      integer,
  entregas_minutos    integer,
  ocupacao_pct        integer,
  evento              text,
  itens               jsonb
)
language plpgsql
security definer
set search_path = public
stable
as $porta$
begin
  if not public.is_staff() then
    raise exception 'Só a equipe interna consulta a disponibilidade de alguém.'
      using errcode = 'insufficient_privilege';
  end if;

  -- A PORTA DE DELEGAR PROJETA, sempre. A pergunta dela e "a pessoa tem
  -- espaco daqui para a frente", e nessa pergunta a etapa vencida compete
  -- por hoje.
  return query
  select * from public.disponibilidade_bruta(
    p_user_id, p_inicio, p_fim, p_modo, p_incluir_concluidas, true
  );
end
$porta$;

comment on function public.disponibilidade(uuid, date, date, text, boolean, boolean) is
  'A disponibilidade de uma pessoa dia a dia, para quem vai delegar (0081). A conta e de `disponibilidade_bruta()`; o que esta funcao acrescenta e a porta: `is_staff()`, porque ela devolve titulo e cliente das etapas de outra pessoa.';

revoke all on function public.disponibilidade(uuid, date, date, text, boolean, boolean) from public, anon;
grant execute on function public.disponibilidade(uuid, date, date, text, boolean, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 3 - `carga_do_dia()` VIRA UM RECORTE DE UM DIA
--
-- Mesma assinatura, mesmo retorno, mesmos chamadores. O que muda e de onde o
-- numero sai -- e o cabecalho acima diz o que isso custa.
-- ---------------------------------------------------------------------------
create or replace function public.carga_do_dia(
  p_user_id uuid,
  p_data    date,
  p_incluir_concluidas boolean default false
)
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
  select
    d.carga_minutos,
    d.etapas_count,
    d.etapas_sem_estimativa,
    -- `ausente` continua querendo dizer "a pessoa nao esta disponivel neste
    -- dia", que e como a Linha do Tempo e o Feedback a leem. Feriado e fim de
    -- semana entram, como entravam: `carga_da_equipe()` ja pula o fim de
    -- semana antes de chamar.
    (d.indisponivel_motivo is not null and d.indisponivel_motivo <> 'evento')
    from public.disponibilidade_bruta(p_user_id, p_data, p_data, 'distribuida', p_incluir_concluidas, false) d;
end;
$$;

comment on function public.carga_do_dia(uuid, date, boolean) is
  'A carga de uma pessoa num dia (0035, redesenhada na 0081): hoje e um recorte de um dia de `disponibilidade()`, para o produto ter UMA conta de carga. A estimativa e distribuida pela janela da etapa, e nao contada inteira em cada dia coberto.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - OS INDICES
--
-- O caminho quente e `(responsavel_id, prazo)` filtrando por status, e o
-- indice da 0006 ja cobre os dois primeiros. O que falta e o lado das
-- dependencias: o `max(prazo)` do inicio possivel entra por `subtask_id`, e
-- sem indice ele varre a tabela uma vez por etapa.
-- ---------------------------------------------------------------------------
create index if not exists subtask_dependencies_subtask_idx
  on public.subtask_dependencies (subtask_id);

notify pgrst, 'reload schema';
