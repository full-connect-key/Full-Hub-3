-- ============================================================================
-- 0113 — A RECORRENCIA SERVE VARIAS CONTAS, E A PASTA VEM DA CONTA
--
-- Decisao do usuario, numa frase: *"na hora de criar uma recorrencia de job,
-- tire o campo de pasta de entrega, deixar tambem que escolha mais de um
-- cliente que contempla aquela tarefa"*.
--
-- AS DUAS METADES SAO A MESMA MUDANCA, e e por isso que elas saem no mesmo
-- arquivo: com N contas na regra, UMA pasta digitada no modelo esta errada
-- para N-1 delas. Tirar o campo sem dar outra origem a pasta seria pior que
-- deixa-lo: `tasks_exige_pasta_de_entrega` (0015) recusa demanda nova sem
-- pasta, entao a rotina das tres da manha passaria a falhar TODA NOITE, em
-- silencio, num historico que ninguem abre -- que e exatamente o modo de
-- falha que o cabecalho da 0040 ja descrevia.
--
-- A ORIGEM NOVA JA EXISTIA: `client_flow_defaults.pasta_entrega_url` (0064),
-- que o proprio comentario daquela migration descreve como *"a pasta que
-- viaja para o campo link_entrega de toda demanda daquele cliente"*. E a
-- decima sexta ponte construida e nunca atravessada por esta rotina.
--
-- ----------------------------------------------------------------------------
-- A CHAVE DA OCORRENCIA PASSA A LEVAR A CONTA, e essa e a linha que faz o
-- resto caber. `recurrence_runs (recurrence_id, chave_ocorrencia)` e unico
-- desde a 0040, e ele E a idempotencia -- nao a consulta que vem antes.
--
-- Com N contas haveria duas formas:
--
--   (A) uma execucao por ocorrencia, com N tasks. `recurrence_runs.task_id` e
--       UMA coluna, entao ela viraria array, e a conta acrescentada depois
--       nunca receberia aquela ocorrencia -- a chave ja estaria consumida,
--       sem nada na tela dizendo por que.
--
--   (B) a chave vira `<periodo>|<client_id>`. Uma execucao por conta por
--       ocorrencia, `task_id` continua sendo uma, e o historico passa a ler
--       "esta conta, esta ocorrencia". A conta acrescentada depois nao tem
--       chave nenhuma, entao ela comeca a gerar da proxima ocorrencia para a
--       frente -- que e a regra de "nunca retroativo" (0040) acontecendo
--       sozinha, em vez de precisar de um `if`.
--
-- E (B), e ela cobra uma passada: as execucoes que ja existem tem a chave
-- antiga, e sem reescreve-las a rotina da madrugada seguinte acharia que
-- nenhuma ocorrencia passada aconteceu e geraria TODAS de novo. O `update` do
-- PASSO 2 e, de longe, a linha mais importante deste arquivo.
-- ----------------------------------------------------------------------------
--
-- `task_recurrences.client_id` FICA, e nao e indecisao: ela deixa de ser "a
-- conta da regra" e passa a ser a PRIMEIRA delas -- o que `nova_task` precisa
-- quando a regra nasce, e o que mantem de pe as oito citacoes de `r.client_id`
-- que a 0040 e a 0041 escreveram. Quem manda e a tabela de vinculo, e a regra
-- de leitura e uma so: `contas_da_recorrencia()`.
--
-- Isto NAO e a decisao da 0023 sendo desfeita. La a coluna apagada nao
-- decidia mais nada; aqui ela continua decidindo uma coisa -- e a conta que
-- o `on delete cascade` usa para a regra morrer junto com a empresa.
-- ============================================================================

-- MEDIDO COM SETE MUTACOES, sobre 2295 cenarios:
--
--   a chave volta a nao levar a conta ................... derruba  9
--   a pasta deixa de vir da conta ....................... derruba  8
--   a ultima conta pode ser tirada ...................... derruba  5
--   `run_id` nulo derruba a ocorrencia inteira .......... derruba  2
--   o leitor da chave volta a exigir igualdade .......... derruba  1
--   o relogio anda mesmo sem nada gerado ................ derruba  1
--   o gatilho morde o proprio cascade ................... ABORTA a bateria
--
-- A PENULTIMA PRECISA DE EXPLICACAO, porque 1 parece pouco: aquele unico
-- cenario foi o que encontrou o bug mais caro desta migration -- o relogio da
-- regra travado para sempre num mes que ja aconteceu. Ele existia desde a
-- 0040 e comparava as duas pontas (`proxima_geracao_em <=
-- proximo_periodo_da_recorrencia(id)`); sem ele, o sintoma seria uma regra
-- parada em producao, descoberta por alguem perguntando por que a demanda do
-- mes nao nasceu.
--
-- E A ULTIMA NAO E UM NUMERO, e fica dita assim: tirar a guarda do cascade
-- faz `delete from task_recurrences` ser RECUSADO, entao o arquivo de
-- cenarios morre no meio e nao ha contagem para reportar. A medicao e o
-- aborto.
--
-- ----------------------------------------------------------------------------
-- PASSO 1 — a tabela de vinculo
-- ----------------------------------------------------------------------------

create table if not exists public.task_recurrence_clients (
  recurrence_id uuid not null references public.task_recurrences (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (recurrence_id, client_id)
);

comment on table public.task_recurrence_clients is
  'As contas que uma regra de recorrencia atende. A chave primaria composta e o que impede a mesma conta duas vezes na mesma regra -- sem ela, "gerar para o Mundo Verde" aconteceria duas vezes por ocorrencia.';

create index if not exists task_recurrence_clients_conta_idx
  on public.task_recurrence_clients (client_id);

alter table public.task_recurrence_clients enable row level security;

-- A LEITURA E DE `is_staff()` e a ESCRITA e de `is_atendimento()`, que e a
-- mesma separacao da propria `task_recurrences` desde a 0040: quem abre a
-- demanda de hoje configura a de todo mes, e quem apenas executa continua
-- vendo de que contas o trabalho dele nasce.
drop policy if exists task_recurrence_clients_select on public.task_recurrence_clients;
create policy task_recurrence_clients_select on public.task_recurrence_clients
  for select using (public.is_staff());

drop policy if exists task_recurrence_clients_write on public.task_recurrence_clients;
create policy task_recurrence_clients_write on public.task_recurrence_clients
  for all using (public.is_atendimento()) with check (public.is_atendimento());

-- ----------------------------------------------------------------------------
-- PASSO 2 — a conversao, e ela e a metade que importa
-- ----------------------------------------------------------------------------

-- Toda regra que ja existe ganha a linha dela. Sem isto,
-- `contas_da_recorrencia()` devolve vazio e a rotina para de gerar para a
-- agencia inteira na madrugada seguinte -- sem erro em lugar nenhum, que e a
-- pior forma de uma migration falhar.
insert into public.task_recurrence_clients (recurrence_id, client_id)
select id, client_id from public.task_recurrences
on conflict do nothing;

-- E AS EXECUCOES QUE JA ACONTECERAM GANHAM A CONTA NA CHAVE.
--
-- Sem este `update`, a chave gravada ('2027-03') nunca mais casa com a que a
-- funcao passa a procurar ('2027-03|<uuid>'), e a rotina da madrugada
-- seguinte geraria DE NOVO toda ocorrencia que ja aconteceu -- meses de
-- demanda nascendo em duplicata, com o indice unico dizendo que esta tudo bem
-- porque a chave e de fato nova.
--
-- O `where` com `position` e o que torna a migration re-executavel: colar o
-- arquivo duas vezes nao acrescenta a conta duas vezes.
update public.recurrence_runs rr
   set chave_ocorrencia = rr.chave_ocorrencia || '|' || r.client_id::text
  from public.task_recurrences r
 where r.id = rr.recurrence_id
   and position('|' in rr.chave_ocorrencia) = 0;

comment on column public.recurrence_runs.chave_ocorrencia is
  'O periodo mais a conta, separados por "|" (0113). A conta entra na chave porque a regra atende varias: uma execucao por conta por ocorrencia e o que faz o indice unico continuar sendo a idempotencia, e o que faz a conta acrescentada depois comecar da proxima ocorrencia -- nunca retroativo, sem precisar de um if.';

-- ----------------------------------------------------------------------------
-- PASSO 3 — as contas de uma regra, num lugar so
-- ----------------------------------------------------------------------------

-- A REGRA GANHA A LINHA DELA NO INSTANTE EM QUE NASCE.
--
-- Sem este gatilho, `contas_da_recorrencia()` precisaria de um `union` com
-- `task_recurrences.client_id` para nao devolver vazio numa regra criada
-- depois desta migration — e a primeira versao tinha esse `union`. **A
-- bateria mostrou que ele e tudo-ou-nada:** ele so entrava quando a tabela de
-- vinculo estava VAZIA para aquela regra, entao vincular a segunda conta
-- EXPULSAVA a primeira. A regra passava a atender uma conta, e a que saia era
-- justamente a que o usuario tinha escolhido primeiro.
--
-- Com o gatilho, a tabela de vinculo e a unica verdade, e
-- `contas_da_recorrencia()` nao precisa de ramo nenhum.
create or replace function public.recorrencia_vincula_a_primeira_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.task_recurrence_clients (recurrence_id, client_id)
  values (new.id, new.client_id)
  on conflict do nothing;
  return new;
end;
$fn$;

drop trigger if exists task_recurrences_vincula_a_conta on public.task_recurrences;
create trigger task_recurrences_vincula_a_conta
  after insert on public.task_recurrences
  for each row execute function public.recorrencia_vincula_a_primeira_conta();

-- E `client_id` ACOMPANHA O VINCULO, em vez de envelhecer apontando para uma
-- conta que a regra nao atende mais.
--
-- Ela nao e decoracao: e por ela que o `on delete cascade` apaga a regra
-- quando a empresa e apagada. Deixada parada, tirar a conta A da regra
-- deixaria a regra morrendo junto com a A — uma empresa que ela nao atende.
--
-- **E A ULTIMA CONTA NAO SE TIRA.** Uma regra sem conta nenhuma nao gera
-- nada, e nao avisa: ela continua na lista, ativa, parecendo que funciona.
-- Recusar e dizer o que fazer no lugar — e o que a tela faz antes, desligando
-- o botao de salvar.
create or replace function public.recorrencia_acompanha_a_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  sobra uuid;
begin
  -- A REGRA ESTA INDO EMBORA? Entao nao ha o que proteger.
  --
  -- `task_recurrence_clients.recurrence_id` e `on delete cascade`, entao
  -- apagar a regra apaga os vinculos — e este gatilho dispara em cada um.
  -- Sem esta linha ele recusaria o apagamento da propria regra, dizendo que
  -- ela precisa de pelo menos uma conta. **Foi a bateria que pegou**, no
  -- `delete from public.task_recurrences` que limpa o arquivo entre as
  -- secoes: a mensagem falava de contas num comando que nao falava de conta
  -- nenhuma.
  --
  -- A guarda e esta, e nao um `before delete` na regra apagando os vinculos a
  -- mao: o cascade ja faz isso, e um segundo caminho para o mesmo apagamento
  -- e o lugar onde as duas verdades divergem.
  if not exists (
    select 1 from public.task_recurrences where id = old.recurrence_id
  ) then
    return old;
  end if;

  select c.client_id into sobra
    from public.task_recurrence_clients c
   where c.recurrence_id = old.recurrence_id
   order by c.created_at, c.client_id
   limit 1;

  if sobra is null then
    raise exception 'Uma recorrencia precisa de pelo menos uma conta.'
      using hint = 'Apague a regra, ou escolha outra conta antes de tirar esta.';
  end if;

  update public.task_recurrences
     set client_id = sobra
   where id = old.recurrence_id
     and client_id = old.client_id;

  return old;
end;
$fn$;

drop trigger if exists task_recurrence_clients_acompanha on public.task_recurrence_clients;
create trigger task_recurrence_clients_acompanha
  after delete on public.task_recurrence_clients
  for each row execute function public.recorrencia_acompanha_a_conta();

create or replace function public.contas_da_recorrencia(p_recurrence_id uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  -- UMA ORIGEM SO. O gatilho acima garante que toda regra tem ao menos a
  -- linha da conta com que ela nasceu, e a passada do PASSO 2 cobre as que ja
  -- existiam — entao nao ha o que recuperar de `task_recurrences.client_id`,
  -- e um `union` com ela seria a segunda resposta para a mesma pergunta.
  return query
    select c.client_id
      from public.task_recurrence_clients c
     where c.recurrence_id = p_recurrence_id
     order by c.created_at, c.client_id;
end;
$fn$;

revoke all on function public.contas_da_recorrencia(uuid) from public;
grant execute on function public.contas_da_recorrencia(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- PASSO 4 — a pasta de entrega de uma conta
-- ----------------------------------------------------------------------------

create or replace function public.pasta_de_entrega_da_conta(p_client_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  pasta text;
begin
  select nullif(btrim(f.pasta_entrega_url), '')
    into pasta
    from public.client_flow_defaults f
   where f.client_id = p_client_id;

  return pasta;
end;
$fn$;

comment on function public.pasta_de_entrega_da_conta(uuid) is
  'A pasta padrao da conta (0064), lida de um lugar so. Nula quando a conta nao tem -- e quem decide o que fazer com o nulo e quem pergunta: a rotina grava erro NAQUELA conta e segue, a tela recusa salvar e diz qual conta configurar.';

revoke all on function public.pasta_de_entrega_da_conta(uuid) from public;
grant execute on function public.pasta_de_entrega_da_conta(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- PASSO 5 — a geracao, agora por conta
--
-- ELA E COPIADA INTEIRA da 0041, e nao remendada: `create or replace
-- function` se reescreve a partir do texto que se escreve AGORA, e nao avisa
-- quando o texto novo tem menos coisa que o velho. Foi assim que a 0030
-- perdeu o bloco de carimbos de `validar_transicao_de_subtarefa` -- e ninguem
-- notou por quatro migrations, porque o que a tela lia era um numero, e zero
-- e uma resposta plausivel. Tudo o que a 0040 e a 0041 escreveram continua
-- aqui porque esta aqui, nao porque o Postgres o preservou.
--
-- O QUE MUDOU, e so isto:
--   * um laco por CONTA em volta do corpo inteiro;
--   * a chave da execucao leva a conta;
--   * a pasta vem de `pasta_de_entrega_da_conta()`, com o modelo de fallback;
--   * `return null` dentro do laco virou `continue` -- uma conta que falha
--     nao leva junto as outras, que e o `exception` dentro do laco da 0040
--     um nivel abaixo;
--   * a funcao devolve a PRIMEIRA task gerada. Ela devolvia a unica, e o
--     "Gerar agora" da tela usa isso para levar a pessoa ate a demanda. Com N
--     contas nao existe "a" demanda -- e devolver nulo faria o botao parecer
--     que nao fez nada.
-- ----------------------------------------------------------------------------

create or replace function public.gerar_ocorrencia(
  p_recurrence_id uuid,
  p_periodo       date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r            public.task_recurrences%rowtype;
  cliente      public.clients%rowtype;
  chave        text;
  run_id       uuid;
  nova_task    uuid;
  titulo       text;
  datas        date[];
  d            date;
  item         jsonb;
  modelo_sub   jsonb;
  nova_sub     uuid;
  ordem_i      integer := 0;
  quantas      integer := 0;
  responsavel  uuid;
  aviso        text;
  avisos       text[] := '{}';
  ids_por_ordem uuid[] := '{}';
  dep_ordem    integer;
  fim_periodo  date;
  pasta        text;
  conta        uuid;
  primeira     uuid;
  periodo_chave text;
  padrao       uuid;
begin
  select * into r from public.task_recurrences where id = p_recurrence_id for update;
  if not found then
    raise exception 'Recorrencia nao encontrada.';
  end if;


  -- O RESPONSAVEL PADRAO DA REGRA. Ele nao substitui o da etapa -- so entra
  -- onde nao ha ninguem. Ver o cabecalho desta migration.
  --
  -- SEM `pessoa_desligada()` AQUI, e nao por esquecimento: os dois blocos
  -- abaixo ja conferem isso no responsavel RESOLVIDO, e o padrao passa por
  -- eles como qualquer outro. Eu tinha escrito a checagem nas duas pontas; o
  -- teste de mutacao mostrou que apagar esta nao quebrava cenario nenhum --
  -- era uma segunda verdade dizendo o que a primeira ja dizia.
  padrao := nullif(r.modelo->>'responsavel_padrao', '')::uuid;

  chave := case when r.modo = 'mensal_agrupada'
                then to_char(p_periodo, 'YYYY-MM')
                else to_char(p_periodo, 'YYYY-MM-DD') end;

  -- REGRA PAUSADA NAO GERA, NEM PELO BOTAO (0041).
  --
  -- A rotina da madrugada ja filtrava por `ativo`, mas `gerar_ocorrencia()`
  -- nao -- e "Gerar agora" a chama direto. O resultado era a tela dizendo
  -- "Nada mais e gerado ate voce retomar" e o botao ao lado gerando.
  --
  -- E AQUI, ANTES DO INSERT EM `recurrence_runs`, e a ordem e o ponto: gravar
  -- a execucao como 'pulada' consumiria a chave de idempotencia, e a
  -- ocorrencia sumiria para sempre -- ao retomar a regra, o periodo recusado
  -- apareceria como ja gerado. Pausar nao pode apagar o futuro.
  if not r.ativo then
    return null;
  end if;

  -- A TRAVA. `on conflict do nothing` sem linha de volta = outra execucao
  -- chegou primeiro, e esta desiste sem tocar em nada.

  -- O PERIODO E DE TODAS AS CONTAS; a CHAVE e de cada uma.
  periodo_chave := chave;

  -- -------------------------------------------------------------------
  -- UMA PASSADA POR CONTA (0113).
  --
  -- O laco e por CONTA e nao por ocorrencia, e e o que faz o indice unico
  -- de `recurrence_runs` continuar sendo a idempotencia: cada conta tem a
  -- chave dela, entao a conta acrescentada a regra amanha nao tem chave
  -- nenhuma do passado e comeca a gerar da proxima ocorrencia -- nunca
  -- retroativo (0040), sem precisar de um `if` dizendo isso.
  --
  -- `avisos` e zerado a cada volta porque ele vira o historico DAQUELA
  -- execucao: sem isso, o aviso da primeira conta apareceria no historico
  -- da segunda, falando de uma pessoa que nao tem etapa nenhuma la.
  -- -------------------------------------------------------------------
  for conta in select * from public.contas_da_recorrencia(r.id) loop
    avisos := '{}';
    ordem_i := 0;
    quantas := 0;
    ids_por_ordem := '{}';
    nova_task := null;

    select * into cliente from public.clients where id = conta;

    insert into public.recurrence_runs (recurrence_id, chave_ocorrencia, status)
    values (r.id, periodo_chave || '|' || conta::text, 'gerada')
    on conflict (recurrence_id, chave_ocorrencia) do nothing
    returning id into run_id;

    if run_id is null then
      continue;
    end if;

    -- As datas do periodo.
    if r.modo = 'mensal_agrupada' then
      fim_periodo := (date_trunc('month', p_periodo) + interval '1 month - 1 day')::date;
      select array_agg(x order by x) into datas
        from public.datas_da_recorrencia(r.id, date_trunc('month', p_periodo)::date, fim_periodo) x;
    else
      fim_periodo := p_periodo;
      datas := array[p_periodo];
    end if;

    if datas is null or cardinality(datas) = 0 then
      update public.recurrence_runs
         set status = 'pulada',
             detalhes = jsonb_build_object('motivo', 'Nenhuma data no periodo.')
       where id = run_id;
      continue;
    end if;

    -- O LIMITE CORTA, E NAO RECUSA: um mes com mais de 60 ocorrencias gera as 60
    -- primeiras e diz no historico que cortou. Recusar a ocorrencia inteira
    -- deixaria o mes sem nada, que e pior que um mes incompleto e anotado.
    if cardinality(datas) > public.limite_subtarefas_por_task() then
      avisos := avisos || format('O periodo tinha %s datas e o limite por task e %s: as demais nao foram criadas.',
                                 cardinality(datas), public.limite_subtarefas_por_task());
      datas := datas[1:public.limite_subtarefas_por_task()];
    end if;

    titulo := public.resolver_variaveis(
      coalesce(r.modelo->>'titulo', r.nome),
      cliente.nome_empresa, coalesce(cliente.slug, ''), datas[1], 1);

    -- A PASTA DE ENTREGA E OBRIGATORIA desde a 0015, e o trigger recusa a task
    -- sem ela. Uma regra sem pasta no modelo faria toda geracao morrer com uma
    -- mensagem sobre `link_entrega` que ninguem ligaria a recorrencia -- entao a
    -- recusa acontece aqui, com o nome da regra dentro.
    -- A PASTA VEM DA CONTA (0113), e o modelo e so o fallback.
    --
    -- Com N contas na regra, uma pasta digitada no modelo esta errada para N-1
    -- delas -- entao a origem e `client_flow_defaults.pasta_entrega_url`
    -- daquela conta (0064). O `coalesce` mantem de pe a regra anterior a esta
    -- migration, que tem a pasta no modelo e nenhuma conta configurada.
    --
    -- E A RECUSA E DESTA CONTA, nao da ocorrencia: `continue` e nao `return`.
    -- E o `exception` dentro do laco da 0040 um nivel abaixo -- uma conta sem
    -- pasta nao pode levar junto as outras quatro daquela madrugada.
    pasta := coalesce(
      public.pasta_de_entrega_da_conta(conta),
      nullif(trim(coalesce(r.modelo->>'pasta_entrega', '')), ''));
    if pasta is null then
      update public.recurrence_runs
         set status = 'erro',
             detalhes = jsonb_build_object(
               'motivo', format('A conta "%s" nao tem pasta de entrega configurada, e toda demanda precisa de uma.', cliente.nome_empresa))
       where id = run_id;
      continue;
    end if;

    insert into public.tasks (
      client_id, titulo, briefing_rico, prioridade, link_entrega,
      data_inicio, data_fim, criado_por, recurrence_id, task_type_id,
      publicada_em
    ) values (
      conta, titulo,
      r.modelo->'briefing_rico',
      coalesce((r.modelo->>'prioridade')::public.task_prioridade, 'normal'),
      pasta,
      datas[1], datas[cardinality(datas)],
      r.criado_por, r.id, r.task_type_id,
      case when r.gerar_como_rascunho then null else now() end
    )
    returning id into nova_task;

    primeira := coalesce(primeira, nova_task);

    -- ---- as subtarefas ----

    if r.modo = 'mensal_agrupada' then
      modelo_sub := coalesce(r.modelo->'subtarefa_diaria', '{}'::jsonb);

      foreach d in array datas loop
        ordem_i := ordem_i + 1;
        responsavel := coalesce(nullif(modelo_sub->>'responsavel_id', '')::uuid, padrao);
        aviso := public.aviso_do_responsavel(responsavel, d);
        if aviso is not null then avisos := avisos || aviso; end if;
        if public.pessoa_desligada(responsavel) then responsavel := null; end if;

        insert into public.subtasks (
          task_id, titulo, responsavel_id, prazo, prioridade,
          estimativa_minutos, requer_aprovacao, tipo_aprovacao, ordem, aviso_geracao
        ) values (
          nova_task,
          public.resolver_variaveis(coalesce(modelo_sub->>'titulo', 'Entrega {DATA}'),
                                    cliente.nome_empresa, coalesce(cliente.slug, ''), d, ordem_i),
          responsavel, d,
          coalesce((modelo_sub->>'prioridade')::public.task_prioridade, 'normal'),
          nullif(modelo_sub->>'estimativa_minutos', '')::integer,
          coalesce((modelo_sub->>'requer_aprovacao')::boolean, false),
          nullif(modelo_sub->>'tipo_aprovacao', '')::public.tipo_aprovacao,
          ordem_i, aviso
        );
        quantas := quantas + 1;
      end loop;

    else
      for item in select * from jsonb_array_elements(coalesce(r.modelo->'subtarefas', '[]'::jsonb))
      loop
        exit when ordem_i >= public.limite_subtarefas_por_task();
        ordem_i := ordem_i + 1;
        d := p_periodo + coalesce((item->>'prazo_offset_dias')::integer, 0);
        responsavel := coalesce(nullif(item->>'responsavel_id', '')::uuid, padrao);
        aviso := public.aviso_do_responsavel(responsavel, d);
        if aviso is not null then avisos := avisos || aviso; end if;
        if public.pessoa_desligada(responsavel) then responsavel := null; end if;

        insert into public.subtasks (
          task_id, titulo, responsavel_id, prazo, prioridade,
          estimativa_minutos, requer_aprovacao, tipo_aprovacao, ordem, aviso_geracao
        ) values (
          nova_task,
          public.resolver_variaveis(coalesce(item->>'titulo', 'Etapa'),
                                    cliente.nome_empresa, coalesce(cliente.slug, ''), d, ordem_i),
          responsavel, d,
          coalesce((item->>'prioridade')::public.task_prioridade, 'normal'),
          nullif(item->>'estimativa_minutos', '')::integer,
          coalesce((item->>'requer_aprovacao')::boolean, false),
          nullif(item->>'tipo_aprovacao', '')::public.tipo_aprovacao,
          ordem_i, aviso
        )
        returning id into nova_sub;

        ids_por_ordem := ids_por_ordem || nova_sub;
        quantas := quantas + 1;
      end loop;

      -- AS DEPENDENCIAS SAO RECRIADAS DEPOIS, num segundo passe: `depende_de_ordem`
      -- pode apontar para uma etapa que ainda nao existia na hora de inserir a
      -- que depende dela. Num passe so, uma dependencia para tras funcionaria e
      -- uma para a frente sumiria -- calada.
      ordem_i := 0;
      for item in select * from jsonb_array_elements(coalesce(r.modelo->'subtarefas', '[]'::jsonb))
      loop
        ordem_i := ordem_i + 1;
        exit when ordem_i > cardinality(ids_por_ordem);
        dep_ordem := nullif(item->>'depende_de_ordem', '')::integer;
        if dep_ordem is not null
           and dep_ordem between 1 and cardinality(ids_por_ordem)
           and dep_ordem <> ordem_i
        then
          insert into public.subtask_dependencies (subtask_id, depende_de_id)
          values (ids_por_ordem[ordem_i], ids_por_ordem[dep_ordem])
          on conflict do nothing;
        end if;
      end loop;
    end if;

    -- ---- referencias ----
    for item in select * from jsonb_array_elements(coalesce(r.modelo->'referencias', '[]'::jsonb))
    loop
      continue when nullif(item->>'url', '') is null;
      insert into public.task_referencias (task_id, tipo, url, titulo, adicionado_por)
      values (nova_task, coalesce(item->>'tipo', 'link'), item->>'url',
              item->>'titulo', r.criado_por);
    end loop;

    -- ---- registro e aviso ----
    insert into public.task_history (task_id, acao, autor_id, detalhes)
    values (nova_task, 'gerada_por_recorrencia', r.criado_por,
            jsonb_build_object('recurrence_id', r.id, 'regra', r.nome,
                               'chave', chave, 'subtarefas', quantas));

    update public.recurrence_runs
       set task_id = nova_task,
           detalhes = jsonb_build_object('subtarefas', quantas, 'titulo', titulo,
                                         'avisos', to_jsonb(avisos))
     where id = run_id;

    -- RASCUNHO NAO NOTIFICA NINGUEM. Ele e invisivel para os outros -- avisar
    -- sobre uma task que a pessoa nao consegue abrir e o pior tipo de aviso.
    if not r.gerar_como_rascunho then
      -- UMA NOTIFICACAO POR PESSOA, com a contagem -- nunca uma por etapa. No
      -- modo mensal agrupada uma pessoa costuma ficar com as vinte e duas
      -- etapas do mes: vinte e dois avisos identicos transformariam o sino em
      -- ruido, que e justamente o que a 0028 evitou ao nao notificar rascunho.
      perform public.notificar(
        x.responsavel_id, 'task',
        format('Nova demanda recorrente: %s', titulo),
        format('Regra "%s": %s etapa(s) para voce.', r.nome, x.quantas),
        format('/painel/gestao-tasks/%s', nova_task))
      from (
        select s.responsavel_id, count(*) as quantas
          from public.subtasks s
         where s.task_id = nova_task and s.responsavel_id is not null
         group by s.responsavel_id
      ) x;
    end if;

    -- O AVISO VAI PARA O ATENDIMENTO, e nao para quem estiver de recesso: quem
    -- decide o que fazer com uma etapa sem dono e uma pessoa, e a pessoa e a
    -- que distribui trabalho. "Nao reatribua sozinho" e o pedido em voz alta.
    if cardinality(avisos) > 0 then
      perform public.notificar(
        p.id, 'task',
        format('Recorrente "%s" gerada com aviso', r.nome),
        array_to_string(avisos, ' '),
        format('/painel/gestao-tasks/%s', nova_task))
      from public.profiles p
      where p.ativo
        and (p.role in ('desenvolvedor', 'socio')
             or exists (select 1 from public.team_members t
                         where t.user_id = p.id and t.funcao = 'Atendimento' and t.ativo));
    end if;

  end loop;

  -- --------------------------------------------------------------------------
  -- O RELOGIO DA REGRA E POR OCORRENCIA, NUNCA POR CONTA.
  --
  -- As duas linhas abaixo estavam DENTRO do laco na primeira versao desta
  -- migration, e a bateria pegou: `recalcular_proxima_geracao()` deixava de
  -- rodar sempre que a ultima conta caia num `continue` -- a regra ficava com
  -- `proxima_geracao_em` parada no passado, e a rotina da madrugada a
  -- escolheria de novo toda noite, para sempre, sem gerar nada.
  --
  -- `ultima_geracao_em` e `proxima_geracao_em` sao da REGRA, e uma regra tem
  -- uma cadencia so: cinco contas nao fazem o mes correr cinco vezes.
  --
  -- A GUARDA `primeira is not null` E O QUE PRESERVA O COMPORTAMENTO ANTIGO.
  -- Com uma conta, a funcao da 0041 devolvia cedo — sem tocar no relogio —
  -- quando a regra estava pausada, quando outra execucao chegara antes ou
  -- quando faltava a pasta. Aqui, nenhuma conta tendo gerado, nada avanca,
  -- que e exatamente aquilo.
  -- --------------------------------------------------------------------------
  if primeira is not null then
    update public.task_recurrences
       set ultima_geracao_em = now(), updated_at = now()
     where id = r.id;

    perform public.recalcular_proxima_geracao(r.id);
  end if;

  return primeira;
end;
$$;

-- ----------------------------------------------------------------------------
-- PASSO 6 — quem LE a chave, e a parte que quase passou batida
--
-- `proximo_periodo_da_recorrencia()` decide qual ocorrencia ainda falta, e ela
-- faz isso perguntando se existe execucao com aquela chave. Mudar o formato da
-- chave sem mexer nela deixa a funcao sem achar NADA -- e o efeito nao e a
-- regra gerar em dobro (o indice unico recusa), e a regra ficar com
-- `proxima_geracao_em` apontando para um mes que ja aconteceu, para sempre: a
-- rotina a escolhe toda madrugada, nao gera nada, e nada na tela diz por que.
--
-- A BATERIA PEGOU, e so porque um cenario comparava as duas pontas:
-- `proxima_geracao_em <= proximo_periodo_da_recorrencia(id)`. Sem ele, o
-- sintoma seria uma regra parada em producao, descoberta por alguem
-- perguntando por que a demanda do mes nao nasceu.
--
-- A PERGUNTA PASSA A SER O PREFIXO, e isso define o que "periodo gerado"
-- significa com N contas: **basta UMA execucao**. E o que mantem de pe
-- "nunca retroativo" (0040) -- a conta acrescentada amanha nao faz o mes
-- passado voltar a ser devido -- e e o que mantem o relogio andando.
--
-- `split_part(...,'|',1)` e nao `like chave || '|%'` porque a chave antiga da
-- rotina de ERRO (`erro-2027-03-14T...`) nao tem `|`: com `split_part` ela
-- devolve a si mesma e nunca casa com um periodo, e com `like` tambem nao --
-- mas `split_part` diz em uma linha o que a chave E, e e isso que quem vier
-- depois precisa ler.
--
-- ELA E COPIADA INTEIRA da 0040, pela razao de sempre: `create or replace`
-- parte do texto que se escreve agora.
-- ----------------------------------------------------------------------------

create or replace function public.proximo_periodo_da_recorrencia(p_recurrence_id uuid)
returns date
language plpgsql
stable
as $$
declare
  r     public.task_recurrences%rowtype;
  chave text;
  mes   date;
  d     date;
begin
  select * into r from public.task_recurrences where id = p_recurrence_id;
  if not found then return null; end if;

  if r.modo = 'mensal_agrupada' then
    mes := greatest(date_trunc('month', current_date)::date,
                    date_trunc('month', r.data_inicio)::date);
    -- Ate 24 meses a frente: uma regra cujo proximo mes livre esta alem disso
    -- e uma regra que ja gerou dois anos, e o passo seguinte e outra regra.
    for i in 0..24 loop
      chave := to_char(mes, 'YYYY-MM');
      -- O PREFIXO, E NAO A CHAVE INTEIRA (0113). Ver o cabecalho do PASSO 6.
      if not exists (select 1 from public.recurrence_runs
                      where recurrence_id = r.id
                        and split_part(chave_ocorrencia, '|', 1) = chave)
         and (r.data_fim is null or mes <= date_trunc('month', r.data_fim)::date)
         and exists (select 1 from public.datas_da_recorrencia(
                       r.id, mes, (mes + interval '1 month - 1 day')::date))
      then
        return mes;
      end if;
      mes := (mes + interval '1 month')::date;
    end loop;
    return null;
  end if;

  -- task_por_ocorrencia: a proxima data ainda nao gerada, daqui para a frente.
  for d in
    select * from public.datas_da_recorrencia(
      r.id, current_date, (current_date + interval '18 months')::date)
  loop
    if not exists (select 1 from public.recurrence_runs
                    where recurrence_id = r.id
                      and split_part(chave_ocorrencia, '|', 1) = to_char(d, 'YYYY-MM-DD'))
    then
      return d;
    end if;
  end loop;
  return null;
end;
$$;
