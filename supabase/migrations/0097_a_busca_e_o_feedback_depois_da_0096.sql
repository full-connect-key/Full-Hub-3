-- ===========================================================================
-- 0097 - O QUE A 0096 DERRUBOU SEM AVISAR: A BUSCA E O FEEDBACK
--
-- A 0096 apagou `academy_tracks`, `academy_materials` e `academy_progress` --
-- e deixou DUAS funcoes vivas lendo elas. Nenhuma das duas esta no modulo
-- Academy, e e por isso que elas passaram batidas.
--
--   busca_global()      a busca da topbar, em TODA tela do Painel
--   feedback_metricas() os numeros do Feedback de desenvolvimento
--
-- **`DROP TABLE` NAO AVISA QUEM LIA A TABELA.** O corpo de uma funcao e texto
-- para o Postgres ate a hora de rodar, e a hora de rodar e o clique de
-- alguem. E a licao que a 0095 ja tinha pagado uma vez, com
-- `nota_paga_vira_despesa()` escrevendo numa coluna que aquela migration
-- acabara de apagar -- e ali quem encontrou foi a bateria, antes de aplicar.
-- Aqui a 0096 foi aplicada primeiro, entao as duas estavam quebradas EM
-- PRODUCAO: a busca inteira estourava, nao um grupo a menos.
--
-- **E O ESTRAGO NAO E PROPORCIONAL AO RAMO.** `busca_global()` tem nove
-- `union all`, e o da Academy era um deles -- mas um `union all` que cita
-- relacao inexistente derruba a CONSULTA, nao a parte dela. Quem digitasse
-- qualquer coisa na paleta levava erro. Vale escrever porque a intuicao diz o
-- contrario: "e so a Academy que nao aparece".
--
--
-- O QUE MUDA ALEM DE TROCAR O NOME DA TABELA
--
-- 1. **O ramo da busca passou a ser `academy` e nao `trilha`.** O modelo novo
--    nao tem trilha como unidade do acervo -- tem playbook, e-book e curso, e
--    a trilha e a prateleira. Um identificador nomeando uma coisa que o
--    modelo nao tem mais manda quem vier depois procurar por ela. O rotulo na
--    tela ja era "Full Academy" e nao muda.
--
-- 2. **A chave `trilhas` do feedback virou `itens`.** Mesma razao, e aqui ela
--    pesa mais: aquele `jsonb` e lido pelo PROMPT da IA, onde a palavra
--    errada vira texto errado sobre a pessoa.
--
-- 3. **As etiquetas estudadas saem de `academy_items.tags`.** A 0096 apagou
--    `academy_materials`, e com ela o `skill_id` que ligava o material ao
--    catalogo: a etiqueta foi com o material. `skills` continua existindo e
--    agora **nao tem leitor nenhum** -- o que e decisao de quem usa o
--    produto, nao de uma migration sobre outro assunto.
--
-- 4. **A conta de "o que ela estudou" passou a ser por ITEM.** No modelo
--    velho todo material morava numa trilha, entao "trilhas tocadas" era a
--    mesma coisa; no novo a trilha e opcional e quase nada esta numa. Lendo
--    `academy_trilhas` o numero passaria a ignorar a maior parte do acervo e
--    devolveria menos sem nada dizendo por que.
--
--
-- O QUE ESTA MIGRATION NAO CONSERTA, e e dito em vez de escondido
--
-- `/painel/academy` continua quebrado, e nao e por falta desta migration: as
-- telas daquele modulo leem `lib/dados/academy.ts`, que fala com o modelo
-- velho. Elas sao reescritas nas Partes 3 e 4 do Sprint 3L. O mesmo vale para
-- `academy_reordenar()`, que a 0096 deixou de pe apontando para uma tabela
-- que nao existe -- ela sai junto com a tela que a chama, pela regra da 0023.
--
-- **Medido com tres mutacoes**, contra um Postgres 16 com a bateria inteira
-- (2050 cenarios):
--
--   devolver o ramo antigo da busca .......... 28 cenarios caem
--   devolver as duas CTEs antigas do feedback  11 cenarios caem
--   devolver o `revoke ... from public` cru ...  2 cenarios caem
--
-- **Os 28 sao o numero que vale ler**, e eu tinha escrito seis aqui antes de
-- medir: o ramo da Academy e um de nove, e o que cai e a consulta INTEIRA --
-- nenhum dos 28 e sobre Academy. E a diferenca entre estimar e medir, no
-- arquivo que existe para dizer o tamanho do estrago.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A BUSCA DA TOPBAR
-- ---------------------------------------------------------------------------
create or replace function public.busca_global(
  p_termo text,
  p_limite integer default 6
)
returns table (
  tipo text,
  id uuid,
  titulo text,
  contexto text,
  caminho text,
  selo text,
  posicao integer,
  total bigint
)
language plpgsql
stable
as $func$
declare
  v_termo text := public.sem_acento(p_termo);
  v_limite integer := greatest(1, least(coalesce(p_limite, 6), 20));
begin
  -- Termo curto devolve VAZIO e nao estoura: quem esta digitando passa pelo
  -- primeiro caractere sempre, e um erro ali seria um erro por tecla.
  if length(v_termo) < 2 then
    return;
  end if;

  return query

  -- DEMANDA. O rascunho ENTRA, e e decisao: a regra escrita diz que ele nao
  -- entra em lista, board, calendario, Minhas Tasks, contador, relatorio,
  -- notificacao nem portal -- e todos aqueles respondem "qual e o trabalho da
  -- agencia", onde um pensamento pela metade nao cabe. A busca responde outra
  -- pergunta: "onde esta a coisa que eu tenho em mente", e um rascunho e
  -- exatamente a coisa que ninguem acha. A RLS dele e RESTRITIVA desde a 0028,
  -- entao o que volta aqui e o meu e de mais ninguem -- nem do socio. O selo
  -- diz que ele ainda nao existe para a equipe.
  (
    select 'demanda'::text,
           t.id,
           t.titulo,
           c.nome_empresa,
           '/painel/gestao-tasks/' || t.id::text,
           case when t.publicada_em is null then 'Rascunho' end,
           strpos(public.sem_acento(t.titulo), v_termo)::integer,
           count(*) over ()
      from public.tasks t
      left join public.clients c on c.id = t.client_id
     where strpos(public.sem_acento(t.titulo), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- ETAPA, com a LINHAGEM que Minhas Tasks ja usa: `Cliente · Demanda`. O nome
  -- que a pessoa lembra costuma ser o da etapa ("Layout do carrossel"), e nao
  -- o da demanda -- e sem o contexto duas etapas homonimas de dois clientes
  -- sao a mesma linha duas vezes.
  (
    select 'etapa'::text,
           s.id,
           s.titulo,
           coalesce(c.nome_empresa || ' · ', '') || t.titulo,
           '/painel/gestao-tasks/' || t.id::text,
           case when t.publicada_em is null then 'Rascunho' end,
           strpos(public.sem_acento(s.titulo), v_termo)::integer,
           count(*) over ()
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
      left join public.clients c on c.id = t.client_id
     where strpos(public.sem_acento(s.titulo), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- CLIENTE, pelo nome da empresa OU pelo contato: "Joana" e um jeito legitimo
  -- de procurar a Mundo Verde, e e como a pessoa do Atendimento pensa. A
  -- posicao sai do campo que casou primeiro.
  (
    select 'cliente'::text,
           c.id,
           c.nome_empresa,
           c.nome_contato,
           '/painel/pessoas/clientes/' || c.id::text,
           case when not c.ativo then 'Desativado' end,
           least(
             coalesce(nullif(strpos(public.sem_acento(c.nome_empresa), v_termo), 0), 999),
             coalesce(nullif(strpos(public.sem_acento(c.nome_contato), v_termo), 0), 999)
           )::integer,
           count(*) over ()
      from public.clients c
     where strpos(public.sem_acento(c.nome_empresa), v_termo) > 0
        or strpos(public.sem_acento(c.nome_contato), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- PESSOA. `role <> 'cliente'` porque no Painel procurar uma pessoa quer
  -- dizer procurar um colega -- a pessoa do lado do cliente aparece na ficha
  -- da empresa dela, pelo ramo de cima.
  --
  -- E QUEM SAIU DA AGENCIA ENTRA, com o selo: achar quem fez uma coisa ano
  -- passado e uma das razoes de existir uma busca. O nome continua nos
  -- registros justamente para isso.
  (
    select 'pessoa'::text,
           p.id,
           p.nome,
           coalesce(tm.cargo, p.email),
           '/painel/pessoas/equipe/' || p.id::text,
           case when not p.ativo then 'Desligada' end,
           least(
             coalesce(nullif(strpos(public.sem_acento(p.nome), v_termo), 0), 999),
             coalesce(nullif(strpos(public.sem_acento(p.email), v_termo), 0), 999)
           )::integer,
           count(*) over ()
      from public.profiles p
      left join public.team_members tm on tm.user_id = p.id
     where p.role <> 'cliente'
       and (strpos(public.sem_acento(p.nome), v_termo) > 0
         or strpos(public.sem_acento(p.email), v_termo) > 0)
     order by 7, 3
     limit v_limite
  )

  union all

  -- CAMPANHA
  (
    select 'campanha'::text,
           k.id,
           k.nome,
           c.nome_empresa,
           '/painel/aprovacoes/campanhas/' || k.id::text,
           null::text,
           strpos(public.sem_acento(k.nome), v_termo)::integer,
           count(*) over ()
      from public.campaigns k
      left join public.clients c on c.id = k.client_id
     where strpos(public.sem_acento(k.nome), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- POST, pelo tema. O caminho abre o editor por `?post=`, que e a tela onde o
  -- card se preenche.
  (
    select 'post'::text,
           o.id,
           o.tema,
           coalesce(c.nome_empresa, '—')
             || coalesce(' · ' || to_char(o.data_publicacao, 'DD/MM/YYYY'), ''),
           '/painel/social-media?post=' || o.id::text,
           null::text,
           strpos(public.sem_acento(o.tema), v_termo)::integer,
           count(*) over ()
      from public.posts o
      left join public.clients c on c.id = o.client_id
     where strpos(public.sem_acento(o.tema), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- EQUIPAMENTO. Aqui o CODIGO e o NUMERO DE SERIE entram junto com o nome, e
  -- sao a razao pela qual este ramo existe: ninguem procura "Notebook" numa
  -- lista de dez notebooks -- procura "FCK-0002", que e o que esta na etiqueta.
  (
    select 'equipamento'::text,
           a.id,
           a.nome,
           a.codigo
             || coalesce(' · ' || nullif(trim(coalesce(a.marca, '') || ' ' || coalesce(a.modelo, '')), ''), ''),
           '/painel/comodatos/' || a.id::text,
           case when a.status = 'baixado' then 'Baixado' end,
           least(
             coalesce(nullif(strpos(public.sem_acento(a.nome), v_termo), 0), 999),
             coalesce(nullif(strpos(public.sem_acento(a.codigo), v_termo), 0), 999),
             coalesce(nullif(strpos(public.sem_acento(a.numero_serie), v_termo), 0), 999)
           )::integer,
           count(*) over ()
      from public.assets a
     where strpos(public.sem_acento(a.nome), v_termo) > 0
        or strpos(public.sem_acento(a.codigo), v_termo) > 0
        or strpos(public.sem_acento(a.numero_serie), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- PEDIDO DO CLIENTE
  (
    select 'pedido'::text,
           r.id,
           r.titulo,
           c.nome_empresa,
           '/painel/solicitacoes/' || r.id::text,
           null::text,
           strpos(public.sem_acento(r.titulo), v_termo)::integer,
           count(*) over ()
      from public.client_requests r
      left join public.clients c on c.id = r.client_id
     where strpos(public.sem_acento(r.titulo), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- O ACERVO DO FULL ACADEMY. Ate a 0096 este ramo lia `academy_tracks`, que
  -- a 0097 encontrou morta aqui dentro -- o `drop table` nao avisa quem lia a
  -- tabela, e o corpo de uma funcao e texto para o Postgres ate a hora de
  -- rodar. A hora de rodar e o clique de alguem na busca da topbar, e a busca
  -- INTEIRA estourava: nao e um ramo a menos, e a paleta sem nenhum resultado.
  --
  -- O NOME, NUNCA O CORPO. O playbook tem o texto inteiro gravado e indexado
  -- (`academy_versoes_busca_idx`), e casar nele devolveria o item cujo corpo
  -- menciona "grafica" de passagem -- com o titulo na tela sem conter o que
  -- foi digitado. Quem busca dentro do texto e a busca do MODULO, onde a
  -- linha tem onde mostrar o trecho que casou. E a regra da 0073.
  --
  -- A trilha (`academy_trilhas`) fica de fora, e e decisao: ela e a prateleira
  -- -- o que a pessoa lembra e o nome do playbook, nao o do onboarding que o
  -- carrega. Se um dia precisar entrar, e um `union all` a mais, como este.
  (
    select 'academy'::text,
           k.id,
           k.titulo,
           k.categoria,
           '/painel/academy/' || k.slug,
           case when not k.publicado then 'Rascunho' end,
           strpos(public.sem_acento(k.titulo), v_termo)::integer,
           count(*) over ()
      from public.academy_items k
     where strpos(public.sem_acento(k.titulo), v_termo) > 0
     order by 7, 3
     limit v_limite
  );

end;
$func$;

comment on function public.busca_global(text, integer) is
  'A busca da topbar do Painel. NAO e security definer de proposito: a RLS das nove tabelas e quem decide o que cada perfil acha. Desde a 0097 o ramo da Academy le academy_items e se chama academy -- a 0096 apagou academy_tracks e a consulta INTEIRA estourava.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - OS NUMEROS DO FEEDBACK
--
-- A funcao inteira e reescrita porque `create or replace` exige o corpo
-- inteiro -- o que muda sao as duas CTEs do estudo e a chave que as consome.
-- ---------------------------------------------------------------------------
create or replace function public.feedback_metricas(
  p_user_id uuid,
  p_de      date,
  p_ate     date
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  dias       integer := (p_ate - p_de) + 1;
  ant_de     date;
  ant_ate    date;
  resultado  jsonb;
  -- Palavras que aparecem em todo pedido de ajuste e nao dizem nada sobre o
  -- que foi pedido. Sem a lista, as cinco primeiras seriam "para", "esta",
  -- "favor", "isso" e "pode".
  parada     text[] := array[
    'para', 'esta', 'este', 'essa', 'esse', 'isso', 'aqui', 'favor', 'pode',
    'poderia', 'precisa', 'precisamos', 'fazer', 'ficou', 'ficar', 'mais',
    'menos', 'muito', 'pouco', 'como', 'quando', 'onde', 'porque', 'entao',
    'mesmo', 'ainda', 'tudo', 'nada', 'algum', 'alguma', 'outro', 'outra',
    'obrigado', 'obrigada', 'certo', 'errado', 'acho', 'penso', 'gostaria',
    'seria', 'estava', 'estao', 'sobre', 'apenas', 'tambem', 'depois',
    'antes', 'agora', 'gente', 'coisa', 'parte', 'deixa', 'deixar', 'vamos'
  ];
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'As métricas do feedback são calculadas pela gestão.';
  end if;

  ant_ate := p_de - 1;
  ant_de  := ant_ate - (dias - 1);

  with folhas as (
    -- Rascunho fica fora de TODO calculo (0028), e agrupadora nao e unidade
    -- de trabalho (0022).
    select s.id, s.titulo, s.prazo, s.concluida_em, s.status,
           s.estimativa_minutos, s.tempo_real_minutos,
           t.client_id, t.task_type_id
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where s.responsavel_id = p_user_id
       and t.publicada_em is not null
       and not public.subtask_eh_agrupadora(s.id)
  ),
  no_periodo as (
    select * from folhas where concluida_em::date between p_de and p_ate
  ),
  no_anterior as (
    select * from folhas where concluida_em::date between ant_de and ant_ate
  ),
  conteudos_dela as (
    select 'subtask'::text as tipo, f.id as cid, f.client_id from folhas f
    union all
    select 'post', p.id, p.client_id
      from public.posts p where p.responsavel_id = p_user_id
    union all
    select 'deliverable', d.id, c.client_id
      from public.deliverables d
      join public.campaigns c on c.id = d.campaign_id
     where d.responsavel_id = p_user_id
  ),
  rodadas_dela as (
    select r.*, cd.cid as conteudo, cd.client_id
      from public.approval_rounds r
      join conteudos_dela cd
        on cd.tipo = r.content_type and cd.cid = r.content_id
  ),
  decididos as (
    select rd.content_type, rd.content_id, rd.client_id,
           max(rd.numero_rodada)                                           as rodadas,
           bool_or(rd.status = 'aprovada' and rd.numero_rodada = 1)         as de_prima
      from rodadas_dela rd
     where rd.escopo = 'cliente'
       and rd.decidido_em::date between p_de and p_ate
     group by rd.content_type, rd.content_id, rd.client_id
  ),
  palavras as (
    select lower(public.sem_acento(w)) as palavra, count(*)::integer as vezes
      from rodadas_dela rd
      cross join lateral regexp_split_to_table(
        coalesce(rd.comentario, ''), '[^[:alnum:]áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]+'
      ) as w
     where rd.status in ('ajustes_solicitados', 'rejeitada')
       and rd.decidido_em::date between p_de and p_ate
       and length(w) >= 4
       and not (lower(public.sem_acento(w)) = any (parada))
     group by 1
     having count(*) > 1
     order by count(*) desc, 1
     limit 8
  ),
  -- O QUE ELA ESTUDOU, e desde a 0096 a unidade e o ITEM do acervo e nao a
  -- trilha. O modelo velho punha todo material dentro de uma trilha, entao
  -- "trilhas tocadas" era a mesma coisa que "o que ela estudou"; no novo a
  -- trilha e uma prateleira opcional, e quase nada esta numa. Lendo
  -- `academy_trilhas` esta conta passaria a ignorar a maior parte do acervo --
  -- e devolveria menos sem nada dizendo por que, que e o pior jeito de um
  -- numero estar errado.
  --
  -- A contagem e de PEDACOS CONCLUIDOS: um playbook ou e-book vale um, um
  -- curso vale as aulas que ela fechou. Sem o recorte por tipo, o curso somaria
  -- a linha do item junto com as das aulas e diria seis onde ha cinco.
  estudo as (
    select i.id as item_id, i.titulo,
           count(*) filter (
             where p.concluido
               and (i.tipo <> 'curso' or p.aula_id is not null)
           )::integer                as concluidos,
           min(p.created_at)::date   as comecou_em
      from public.academy_progresso p
      join public.academy_items i on i.id = p.item_id
     where p.user_id = p_user_id
       and (p.concluido_em::date between p_de and p_ate
            or p.created_at::date between p_de and p_ate)
     group by i.id, i.titulo
    having count(*) filter (
             where p.concluido
               and (i.tipo <> 'curso' or p.aula_id is not null)
           ) > 0
  ),
  -- AS ETIQUETAS SAIRAM DE `skills` E PASSARAM A SER AS TAGS DO ITEM. A 0096
  -- apagou `academy_materials`, e com ela o `skill_id` que ligava o material
  -- ao catalogo -- a etiqueta foi com o material. `academy_items.tags` e o
  -- vocabulario que ficou no lugar, e e ele que a tela mostra.
  etiquetas as (
    select distinct t.tag as nome
      from public.academy_progresso p
      join public.academy_items i on i.id = p.item_id
      cross join lateral unnest(i.tags) as t(tag)
     where p.user_id = p_user_id
       and p.concluido
       and p.aula_id is null
       and p.concluido_em::date between p_de and p_ate
  ),
  -- WORKFLOW NOVO e aquele em que ela NUNCA tinha concluido nada antes do
  -- periodo. E o sinal mais concreto de "peguei um tipo de trabalho novo", e
  -- a alternativa -- contar o que ela pegou no periodo -- marcaria de novo
  -- todo trabalho que ela faz desde sempre.
  workflows_novos as (
    select distinct coalesce(tt.nome, 'Sem workflow') as nome
      from no_periodo np
      left join public.task_types tt on tt.id = np.task_type_id
     where not exists (
       select 1 from folhas f
        where coalesce(f.task_type_id::text, '-') = coalesce(np.task_type_id::text, '-')
          and f.concluida_em::date < p_de
     )
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object(
      'inicio', p_de, 'fim', p_ate, 'dias', dias
    ),

    'entrega', (
      select jsonb_build_object(
        'concluidas',   count(*),
        'com_prazo',    count(*) filter (where prazo is not null),
        'no_prazo',     count(*) filter (where prazo is not null and concluida_em::date <= prazo),
        'fora_do_prazo',count(*) filter (where prazo is not null and concluida_em::date > prazo),
        'sem_prazo',    count(*) filter (where prazo is null),
        -- NULA e nao zero quando nao ha etapa com prazo: zero e uma
        -- afirmacao sobre a conta, e o que se quer dizer e que nao houve o
        -- que medir. A decisao de `receita_por_hora` na 0035.
        'taxa_no_prazo', case when count(*) filter (where prazo is not null) > 0
          then round(
            count(*) filter (where prazo is not null and concluida_em::date <= prazo)::numeric
            / count(*) filter (where prazo is not null) * 100, 1)
        end,
        'dias_de_atraso_media', round(avg(concluida_em::date - prazo) filter (
          where prazo is not null and concluida_em::date > prazo), 1),
        'minutos_reais', coalesce(sum(tempo_real_minutos), 0)
      ) from no_periodo
    ),

    -- ATRASADAS e medido HOJE, e nao e evento do periodo: e o estado de
    -- agora, como `situacao_do_lancamento()` no Financeiro. Uma coluna
    -- precisaria de rotina noturna para continuar verdadeira.
    'em_aberto_atrasadas', (
      select count(*) from folhas
       where status <> 'concluida' and prazo is not null and prazo < current_date
    ),

    'por_workflow', coalesce((
      select jsonb_agg(x order by x->>'nome') from (
        select jsonb_build_object(
          'nome', coalesce(tt.nome, 'Sem workflow'),
          'concluidas', count(*)
        ) as x
          from no_periodo np
          left join public.task_types tt on tt.id = np.task_type_id
         group by coalesce(tt.nome, 'Sem workflow')
      ) s
    ), '[]'::jsonb),

    'por_cliente', coalesce((
      select jsonb_agg(x order by x->>'nome') from (
        select jsonb_build_object(
          'nome', coalesce(c.nome_empresa, 'Sem cliente'),
          'concluidas', count(*)
        ) as x
          from no_periodo np
          left join public.clients c on c.id = np.client_id
         group by coalesce(c.nome_empresa, 'Sem cliente')
      ) s
    ), '[]'::jsonb),

    -- A UNICA COMPARACAO PERMITIDA: ela com ela mesma, no periodo anterior de
    -- mesmo comprimento.
    'periodo_anterior', (
      select jsonb_build_object(
        'inicio', ant_de, 'fim', ant_ate,
        'concluidas', count(*),
        'com_prazo',  count(*) filter (where prazo is not null),
        'no_prazo',   count(*) filter (where prazo is not null and concluida_em::date <= prazo),
        'taxa_no_prazo', case when count(*) filter (where prazo is not null) > 0
          then round(
            count(*) filter (where prazo is not null and concluida_em::date <= prazo)::numeric
            / count(*) filter (where prazo is not null) * 100, 1)
        end,
        'minutos_reais', coalesce(sum(tempo_real_minutos), 0)
      ) from no_anterior
    ),

    'calibracao', (
      select jsonb_build_object(
        'etapas_medidas',    count(*),
        'minutos_estimados', coalesce(sum(estimativa_minutos), 0),
        'minutos_reais',     coalesce(sum(tempo_real_minutos), 0),
        'desvio_percentual', case when sum(estimativa_minutos) > 0
          then round(((sum(tempo_real_minutos)::numeric
                       / sum(estimativa_minutos)) - 1) * 100, 1)
        end,
        -- A TENDENCIA e a palavra, e nao o sinal do numero: "subestima" e o
        -- que a pessoa le e reconhece. A faixa de 10% no meio existe porque
        -- um desvio de 3% nao e uma tendencia, e chama-lo de uma treinaria a
        -- pessoa a desconfiar do resto.
        'tendencia', case
          when sum(estimativa_minutos) is null or sum(estimativa_minutos) = 0 then null
          when sum(tempo_real_minutos)::numeric / sum(estimativa_minutos) > 1.10 then 'subestima'
          when sum(tempo_real_minutos)::numeric / sum(estimativa_minutos) < 0.90 then 'superestima'
          else 'equilibrada'
        end
      ) from no_periodo
       where estimativa_minutos is not null and tempo_real_minutos is not null
    ),

    'calibracao_por_workflow', coalesce((
      select jsonb_agg(x order by (x->>'desvio_percentual')::numeric desc) from (
        select jsonb_build_object(
          'nome', coalesce(tt.nome, 'Sem workflow'),
          'etapas', count(*),
          'desvio_percentual', round(((sum(np.tempo_real_minutos)::numeric
            / nullif(sum(np.estimativa_minutos), 0)) - 1) * 100, 1)
        ) as x
          from no_periodo np
          left join public.task_types tt on tt.id = np.task_type_id
         where np.estimativa_minutos is not null and np.tempo_real_minutos is not null
         group by coalesce(tt.nome, 'Sem workflow')
        having sum(np.estimativa_minutos) > 0
      ) s
    ), '[]'::jsonb),

    'qualidade', (
      select jsonb_build_object(
        'conteudos_decididos', count(*),
        'aprovados_de_prima',  count(*) filter (where de_prima),
        'taxa_de_prima', case when count(*) > 0
          then round(count(*) filter (where de_prima)::numeric / count(*) * 100, 1)
        end,
        'rodadas_media', round(avg(rodadas), 1)
      ) from decididos
    ),

    'palavras_nos_pedidos_de_ajuste', coalesce((
      select jsonb_agg(jsonb_build_object('palavra', palavra, 'vezes', vezes))
        from palavras
    ), '[]'::jsonb),

    -- DESENVOLVIMENTO. A 0043 apagou `user_skills`, entao aqui nao ha
    -- "interesse declarado": ha o que a pessoa ESTUDOU, que e um fato do
    -- periodo.
    --
    -- A CHAVE SE CHAMA `itens` E NAO `trilhas`, e o nome foi trocado junto com
    -- a conta. Um identificador nomeando uma coisa que o modelo nao tem mais
    -- manda quem vier depois procurar por ela -- e aqui ele estaria num
    -- `jsonb` que o prompt da IA le, onde a palavra errada vira texto errado
    -- sobre a pessoa. E a decisao de `pessoasDaLinhaDoTempo`.
    'desenvolvimento', jsonb_build_object(
      'itens', coalesce((
        select jsonb_agg(jsonb_build_object(
          'titulo', titulo,
          'concluidos', concluidos
        ) order by titulo) from estudo
      ), '[]'::jsonb),
      'etiquetas_estudadas', coalesce((
        select jsonb_agg(nome order by nome) from etiquetas
      ), '[]'::jsonb),
      'workflows_novos', coalesce((
        select jsonb_agg(nome order by nome) from workflows_novos
      ), '[]'::jsonb)
    )
  ) into resultado;

  return resultado;
end;
$$;

comment on function public.feedback_metricas(uuid, date, date) is
  'Os numeros de UMA pessoa, no periodo dela e no anterior dela. Nunca compara com colega, nunca devolve duas pessoas. Desde a 0097 o bloco de desenvolvimento le academy_items/academy_progresso, e a chave e `itens` -- a 0096 apagou as tres tabelas antigas e a funcao estourava inteira.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - `academy_vencidos()` ESTAVA AO ALCANCE DA CHAVE ANON
--
-- A 0096 escreveu `revoke all on function ... from public` e achou que isso
-- bastava. Nao basta, e a 0071 ja tinha registrado por que: o Supabase deixa
-- um `alter default privileges` ligado no schema `public` que CONCEDE execute
-- a `anon` e a `authenticated` em toda funcao nova, e `revoke ... from public`
-- nao alcanca um grant feito a um papel nomeado.
--
-- O resultado medido, num Postgres com a bateria inteira:
--
--   academy_vencidos | {postgres=X, anon=X, authenticated=X, service_role=X}
--
-- **E ELA E `security definer`**, entao a RLS nao a segura por dentro: ela
-- devolve o NOME de todas as pessoas ativas da agencia com o que cada uma
-- deve e desde quando. Com `anon` ali, isso e a lista de quem trabalha na Full
-- ao alcance de quem tiver a chave publica -- que vai no bundle que o
-- navegador baixa. Com `authenticated`, e o acompanhamento da gestao entrando
-- pela porta dos fundos, numa funcao que nao pergunta nada.
--
-- A rotina continua chamando, como `limpar_rascunhos_abandonados()` desde a
-- 0071: quem a executa e a chave de servico, e nenhuma tela do produto a
-- chama. A tela da gestao le `academy_acompanhamento()`, que e `invoker` e
-- pergunta `is_gestor()` na primeira linha.
--
-- **A bateria mede o PRIVILEGIO e nao a mensagem de recusa**, que e a
-- distincao da 0071: uma funcao pode recusar por dentro e continuar
-- executavel, e ai o que se mediu foi o corpo dela, nao a porta. Foram estes
-- dois cenarios que encontraram isto -- eles falharam com "passou quando devia
-- ser recusado (5 linhas)", escritos contra a regra e nao contra o schema.
-- ---------------------------------------------------------------------------
revoke all on function public.academy_vencidos() from public, anon, authenticated;
grant execute on function public.academy_vencidos() to service_role;
