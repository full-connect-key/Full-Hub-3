-- ---------------------------------------------------------------------------
-- 0059 - A DATA DE CADA ETAPA DO SOCIAL
--
-- Decisao do usuario: *"quando eu abra um mes de social, eu possa escolher em
-- qual dia cada etapa da task vai ser realizada, para que ja entre no
-- calendario da pessoa responsavel"*.
--
-- O QUE FALTAVA, e nao era a coluna: `post_etapas.prazo` existe desde a 0045 e
-- nunca era preenchida por ninguem. Faltavam tres coisas -- de onde a data
-- vem, o que acontece quando o post muda de dia, e o oitavo `union all` da
-- `calendar_events`, sem o qual a etapa nao aparece no calendario de pessoa
-- nenhuma por mais preenchida que esteja.
--
-- ---------------------------------------------------------------------------
-- E OFFSET, E NAO DATA FIXA
--
-- "Layout tres dias antes de ir ao ar" vale para os doze posts do mes; data
-- fixa obrigaria a digitar doze vezes e nasceria errada no dia em que a
-- publicacao mudasse de dia. E a mesma razao de `workflow_steps` guardar
-- `prazo_offset_dias` em vez de data desde a 0008: data fixa num modelo
-- reutilizavel faz toda demanda nova nascer vencida.
--
-- A diferenca e que `post_etapas` e INSTANCIA e nao modelo, entao ela guarda
-- as duas: o offset (a regra) e o `prazo` (o dia). A regra existe para o dia
-- se recalcular sozinho quando o post andar.
--
-- ---------------------------------------------------------------------------
-- E O VOLANTE SE PEGA, como no status da Task
--
-- Editar o `prazo` de uma etapa a mao LIMPA o offset dela. A partir dali o
-- post pode andar que aquela etapa fica onde alguem a pos.
--
-- E a mesma decisao da 0025: liberar a escrita e deixar o recalculo desfazer
-- em seguida e o pior dos dois mundos -- o clique passa e a escolha some na
-- proxima vez que outra coisa mexer. Recusar com explicacao e ruim; aceitar e
-- desfazer calado e pior.
--
-- O que NAO existe aqui e o caminho de volta ("deixar o Full Hub calcular"):
-- a etapa e uma linha num card, nao uma tela com rodape. Quem quiser a regra
-- de volta abre o mes de novo -- e isso fica escrito porque e assimetria
-- consciente com a 0025, nao esquecimento.
--
-- ---------------------------------------------------------------------------
-- O POST ABRE SEM DATA, E ISSO NAO QUEBRA NADA -- e a parte bonita
--
-- A 0044 decidiu que o mes abre em branco: `data_publicacao` nasce nula, e
-- "sem data ainda" e um estado de verdade do trabalho. Com o offset gravado e
-- a data ausente, `prazo` fica nulo tambem -- e no instante em que alguem
-- escreve o dia da publicacao, as cinco etapas caem no calendario das cinco
-- pessoas de uma vez. A regra fica guardada esperando o dia.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

alter table public.post_etapas
  add column if not exists prazo_offset_dias integer;

comment on column public.post_etapas.prazo_offset_dias is
  'Dias em relacao a `posts.data_publicacao` (negativo = antes). E a REGRA; '
  '`prazo` e o dia que ela produz. Editar `prazo` a mao limpa este campo '
  '-- quem pegou o volante fica com ele (0059).';

comment on column public.post_etapas.prazo is
  'O dia em que esta etapa precisa estar pronta. Sai de `prazo_offset_dias` '
  'enquanto ele existir, e vira manual quando alguem o edita (0059).';

create index if not exists post_etapas_prazo_idx
  on public.post_etapas (prazo)
  where prazo is not null;


-- ---------------------------------------------------------------------------
-- O GUC que separa "o sistema recalculou" de "alguem editou"
--
-- E a mesma saida de `posts_corrente_do_cliente` (0045): escopo LOCAL, ligado
-- e desligado dentro da propria funcao. Sem ele o recalculo dispararia o
-- trigger que limpa o offset e apagaria a regra que ele acabou de aplicar --
-- na primeira vez que alguem trocasse a data do post.
--
-- A saida de emergencia nao pode virar porta destrancada: quem chama o
-- `set_config` e so a funcao abaixo, e ela o desliga antes de devolver.
-- ---------------------------------------------------------------------------
create or replace function public.post_etapas_solta_o_offset()
returns trigger
language plpgsql
as $fn$
begin
  if coalesce(current_setting('full_hub.recalculando_prazo', true), '') = 'on' then
    return new;
  end if;

  -- SO QUANDO O `prazo` MUDOU E O OFFSET NAO. Um update que mexe no status ou
  -- no responsavel nao pode apagar a regra de data de passagem.
  if new.prazo is distinct from old.prazo
     and new.prazo_offset_dias is not distinct from old.prazo_offset_dias then
    new.prazo_offset_dias := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists post_etapas_solta_o_offset on public.post_etapas;
create trigger post_etapas_solta_o_offset
  before update of prazo on public.post_etapas
  for each row execute function public.post_etapas_solta_o_offset();


-- ---------------------------------------------------------------------------
-- O post andou: as etapas que ainda seguem a regra andam junto
--
-- SO AS QUE AINDA TEM OFFSET. A que alguem datou a mao fica onde esta, que e
-- o ponto do volante.
--
-- E quando a data do post e APAGADA, o prazo das etapas com regra volta a
-- nulo: uma etapa com dia no calendario de alguem, para um post que nao tem
-- mais dia, e trabalho marcado para uma data que nao quer dizer nada.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_prazos_do_post()
returns trigger
language plpgsql
as $fn$
begin
  if new.data_publicacao is not distinct from old.data_publicacao then
    return new;
  end if;

  perform set_config('full_hub.recalculando_prazo', 'on', true);

  update public.post_etapas e
     set prazo = case
           when new.data_publicacao is null then null
           else new.data_publicacao + e.prazo_offset_dias
         end,
         updated_at = now()
   where e.post_id = new.id
     and e.prazo_offset_dias is not null;

  perform set_config('full_hub.recalculando_prazo', 'off', true);

  return new;
end;
$fn$;

drop trigger if exists posts_recalcula_prazos on public.posts;
create trigger posts_recalcula_prazos
  after update of data_publicacao on public.posts
  for each row execute function public.recalcular_prazos_do_post();


-- ---------------------------------------------------------------------------
-- `abrir_mes_de_social()` passa a receber os offsets
--
-- A CHAVE E O NOME DA ETAPA, e nao a funcao -- ao contrario de
-- `p_responsaveis`. Pauta e Programar sao as DUAS de Social Media, e uma
-- chave por funcao daria a elas o mesmo dia: a pauta venceria junto com a
-- programacao, que e o fim da corrente.
--
-- Ela e opcional: sem `p_prazos`, o mes abre como abria antes -- sem data
-- nenhuma nas etapas. Quem nao quiser datar nada continua sem datar.
-- ---------------------------------------------------------------------------
create or replace function public.abrir_mes_de_social(
  p_client_id      uuid,
  p_mes            text,
  p_quantidades    jsonb,
  p_responsavel_id uuid default null,
  p_responsaveis   jsonb default '{}'::jsonb,
  p_prazos         jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rede      text;
  quantos   integer;
  i         integer;
  criados   integer := 0;
  total     integer := 0;
  primeiro  date;
  empresa   text;
  novo      uuid;
  chave     text;
  valor     integer;
  anterior  integer;
  etapa     record;
  meses     text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
begin
  -- O ATENDIMENTO ABRE O MES (0046): a mesma funcao que `tasks_insert` usa
  -- desde a 0006, e nao uma parecida.
  if not public.is_atendimento() then
    raise exception using
      errcode = 'check_violation',
      -- A FRASE E A DA 0046, PALAVRA POR PALAVRA, e a bateria pegou quando eu
      -- a reescrevi: dois cenarios conferem o texto da recusa, e uma trava que
      -- recusa com outra frase e uma trava que ninguem sabe mais se é a mesma.
      -- `create or replace function` reescreve a partir do que se digita, e o
      -- que nao for copiado se perde -- foi assim que a 0030 perdeu o bloco de
      -- carimbos da 0007.
      message = 'Abrir o mês de social é do Atendimento, do desenvolvedor ou do sócio.',
      hint    = 'Quem produz recebe os posts; quem os abre é quem responde pelo contrato.';
  end if;

  begin
    primeiro := to_date(p_mes || '-01', 'YYYY-MM-DD');
  exception when others then
    raise exception using
      errcode = 'check_violation',
      message = 'O mês precisa estar no formato AAAA-MM.';
  end;

  select c.nome_empresa into empresa from public.clients c where c.id = p_client_id;
  if empresa is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Cliente não encontrado.';
  end if;

  -- OS OFFSETS SAO CONFERIDOS ANTES DE ABRIR POST NENHUM. A funcao e
  -- transacional, entao recusar no meio tambem desfaria tudo -- mas a
  -- mensagem sairia depois de sessenta inserts, e o custo de conferir cinco
  -- numeros primeiro e zero.
  for chave, valor in select key, value::integer from jsonb_each_text(p_prazos)
  loop
    if not exists (select 1 from public.etapas_padrao_do_social() e where e.nome = chave) then
      raise exception using
        errcode = 'check_violation',
        message = format('A corrente do social não tem etapa chamada "%s".', chave),
        hint    = 'As etapas são Pauta, Conteúdo, Layout, Envio e Programar.';
    end if;
    if valor < -60 or valor > 60 then
      raise exception using
        errcode = 'check_violation',
        message = format('O prazo da etapa "%s" está a %s dias da publicação.', chave, valor),
        hint    = 'O limite é 60 dias para cada lado. Fora disso é erro de digitação, não planejamento.';
    end if;
  end loop;

  -- A CORRENTE NAO PODE VENCER DE TRAS PARA A FRENTE.
  --
  -- O Layout com prazo ANTES do Conteúdo é quase sempre um número trocado, e
  -- o estrago é grande: a corrente já recusa começar o Layout antes de o
  -- Conteúdo fechar (0045), então a pessoa veria no calendário dela uma etapa
  -- vencendo num dia em que o banco ainda não deixa tocá-la.
  anterior := null;
  for etapa in select e.ordem, e.nome from public.etapas_padrao_do_social() e order by e.ordem
  loop
    valor := nullif(p_prazos ->> etapa.nome, '')::integer;
    if valor is not null then
      if anterior is not null and valor < anterior then
        raise exception using
          errcode = 'check_violation',
          message = format('"%s" venceria antes da etapa anterior da corrente.', etapa.nome),
          hint    = 'A ordem é Pauta, Conteúdo, Layout, Envio e Programar — os dias precisam andar na mesma direção.';
      end if;
      anterior := valor;
    end if;
  end loop;

  for rede, quantos in select key, value::integer from jsonb_each_text(p_quantidades)
  loop
    if quantos < 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'Quantidade negativa não abre post nenhum.';
    end if;
    total := total + quantos;
  end loop;

  if total = 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Escolha quantos posts abrir.',
      hint    = 'Pelo menos uma rede precisa de um número maior que zero.';
  end if;

  if total > 60 then
    raise exception using
      errcode = 'check_violation',
      message = format('São %s posts de uma vez, e o limite é 60.', total),
      hint    = 'Se o número está certo, abra em duas vezes — assim um zero a mais não vira sessenta posts para apagar.';
  end if;

  for rede, quantos in select key, value::integer from jsonb_each_text(p_quantidades)
  loop
    for i in 1..quantos loop
      insert into public.posts (
        client_id, tema, data_publicacao, plataforma, midia,
        criado_por, responsavel_id
      ) values (
        p_client_id,
        format('%s %s de %s · %s/%s', initcap(rede), i, quantos,
               meses[extract(month from primeiro)::integer],
               extract(year from primeiro)::integer),
        null,
        rede::public.plataforma_social,
        'imagem',
        (select auth.uid()),
        p_responsavel_id
      )
      returning id into novo;

      -- DISTRIBUIR A CORRENTE CONTINUA SENDO DA GESTAO, e por isso este
      -- `update` corre dentro de uma funcao `security definer` mesmo quando
      -- quem chamou e do Atendimento: abrir trabalho e distribuir trabalho sao
      -- duas decisoes, e quem abre o mes esta fazendo as duas de uma vez, de
      -- propósito -- e so nesta chamada.
      update public.post_etapas e
         set responsavel_id = nullif(p_responsaveis ->> (e.funcao::text), '')::uuid,
             updated_at = now()
       where e.post_id = novo
         and nullif(p_responsaveis ->> (e.funcao::text), '') is not null;

      -- A REGRA DE DATA, gravada mesmo sem o post ter data ainda. `prazo`
      -- fica nulo agora e nasce sozinho no instante em que alguem escrever o
      -- dia da publicacao -- pelo trigger `posts_recalcula_prazos`.
      update public.post_etapas e
         set prazo_offset_dias = nullif(p_prazos ->> e.nome, '')::integer,
             updated_at = now()
       where e.post_id = novo
         and nullif(p_prazos ->> e.nome, '') is not null;

      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$fn$;

-- A ASSINATURA GANHOU UM PARAMETRO, e o Postgres trata isso como uma funcao
-- NOVA: a de cinco argumentos continua existindo, e o PostgREST escolheria
-- uma das duas conforme o corpo do pedido. Duas versoes da mesma funcao e o
-- lugar onde as duas verdades comecam a divergir.
drop function if exists public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb);


-- ---------------------------------------------------------------------------
-- A VIEW GANHA A OITAVA ORIGEM
--
-- `create or replace view` e nao `drop`/`create`: o drop derrubaria junto
-- qualquer grant, e a view e publicada pelo PostgREST. A ordem e os tipos das
-- colunas nao mudam -- so entra um `union all` no fim.
--
-- **`security_invoker = true` VAI JUNTO NO `replace`, e essa e a linha que
-- nao pode cair.** `create or replace view` sem a clausula NAO herda a do
-- objeto que ele substitui: a view voltaria a rodar com os direitos de quem a
-- criou e leria as oito tabelas inteiras para qualquer pessoa autenticada. E
-- o furo passa despercebido num banco com um cliente so -- ele ve seis
-- campanhas, que e o total, e "seis de seis" tem a mesma cara com a RLS
-- ligada e desligada. A bateria da 0055 mede isso com material de duas
-- empresas, e continua medindo.
-- ---------------------------------------------------------------------------

create or replace view public.calendar_events
with (security_invoker = true) as

  -- 1. A DEMANDA, pelo periodo dela.
  --
  -- O periodo e derivado das etapas desde a 0028, entao a barra da Task e a
  -- soma do que ha dentro -- ela nao precisa ser mantida, ela ja e o resumo.
  select
    t.id                                   as id,
    'task'::text                           as tipo,
    t.titulo                               as titulo,
    t.data_inicio                          as data_inicio,
    coalesce(t.data_fim, t.data_inicio)    as data_fim,
    t.client_id                            as client_id,
    null::uuid                             as user_id,
    t.prioridade::text                     as prioridade,
    t.status::text                         as status,
    '/painel/gestao-tasks/' || t.id        as link
  from public.tasks t
  where t.publicada_em is not null
    and t.data_inicio is not null

  union all

  -- 2. A ETAPA, no prazo dela e com o responsavel dela.
  --
  -- SO AS FOLHAS. A agrupadora deixa de ser unidade de trabalho no instante em
  -- que ganha a primeira filha (0022), e o prazo que sobrou nela e o de quando
  -- ela ainda era folha: mostrar os dois poria a mesma entrega duas vezes no
  -- mesmo mes, uma delas numa data que ninguem mais usa.
  --
  -- E NO PRAZO, nao no periodo, ainda que a etapa tenha `data_inicio` desde a
  -- 0027. E decisao registrada do produto: comecar tarde nao e atrasar, e uma
  -- barra por data dobraria os itens do mes. O inicio aparece no detalhe.
  select
    s.id,
    'subtarefa',
    s.titulo,
    s.prazo,
    s.prazo,
    t.client_id,
    s.responsavel_id,
    s.prioridade::text,
    s.status::text,
    '/painel/gestao-tasks/' || t.id || '?sub=' || s.id
  from public.subtasks s
  join public.tasks t on t.id = s.task_id
  where s.prazo is not null
    and t.publicada_em is not null
    and not exists (
      select 1 from public.subtasks f where f.parent_id = s.id
    )

  union all

  -- 3. QUEM ESTA FORA, e so o que foi combinado.
  --
  -- Pedido pendente NAO entra: ele ainda pode ser remarcado, e pintar o
  -- calendario da agencia com um periodo que o socio nem respondeu faria a
  -- equipe planejar em cima de uma ausencia que talvez nao aconteca.
  select
    h.id,
    'ausencia',
    h.tipo::text,
    h.data_inicio,
    h.data_fim,
    null::uuid,
    h.user_id,
    null::text,
    h.status::text,
    '/painel/full-days'
  from public.hr_requests h
  where h.status = 'aprovada'

  union all

  -- 4. O QUE ACONTECE.
  select
    e.id,
    'evento',
    e.nome,
    e.data_inicio,
    e.data_fim,
    e.client_id,
    null::uuid,
    null::text,
    e.tipo::text,
    '/painel/calendario?evento=' || e.id
  from public.events e

  union all

  -- 5. O POST, no dia em que vai ao ar.
  --
  -- Post sem data nao entra -- e estado de verdade do trabalho desde a 0044,
  -- e ele vive na faixa "Sem data ainda" da tela de Social Media. Inventar um
  -- dia aqui para ele aparecer seria o calendario afirmando uma data que
  -- ninguem escolheu.
  select
    p.id,
    'post',
    p.tema,
    p.data_publicacao,
    p.data_publicacao,
    p.client_id,
    p.responsavel_id,
    null::text,
    p.status::text,
    '/painel/social-media?post=' || p.id
  from public.posts p
  where p.data_publicacao is not null

  union all

  -- 6. A CAMPANHA, com o periodo inteiro.
  --
  -- A VIEW CARREGA A VERDADE; quem decide como desenhar e a tela. Na grade do
  -- mes a campanha aparece no ENCERRAMENTO, porque uma Wave de trinta dias
  -- pintaria trinta celulas e empurraria para baixo tudo o que acontece em
  -- cada uma -- decisao ja registrada do produto. Na Linha do Tempo ela e a
  -- barra longa que o sprint pede. Os dois desenhos saem da mesma linha, e e
  -- `diaNaGrade()` em `lib/dominio/calendario.ts` que escolhe -- um lugar so.
  select
    c.id,
    'campanha',
    c.nome,
    c.data_inicio,
    c.data_fim,
    c.client_id,
    null::uuid,
    null::text,
    c.status::text,
    '/painel/aprovacoes/campanhas/' || c.id
  from public.campaigns c

  union all

  -- 7. A PECA DA CAMPANHA, no prazo dela.
  --
  -- So as FOLHAS, pela mesma razao da etapa: o grupo e uma linha na tela e
  -- quinze entregas no trabalho, e conta-lo tambem faria "16 de 16" onde ha
  -- quinze coisas.
  select
    d.id,
    'entregavel',
    d.nome,
    d.prazo,
    d.prazo,
    c.client_id,
    d.responsavel_id,
    null::text,
    d.status::text,
    '/painel/aprovacoes/campanhas/' || d.campaign_id || '?item=' || d.id
  from public.deliverables d
  join public.campaigns c on c.id = d.campaign_id
  where d.prazo is not null
    and not exists (
      select 1 from public.deliverables f where f.parent_id = d.id
    )

  union all

  -- 8. A ETAPA DO POST (0059), que e a oitava origem.
  --
  -- O cabecalho da 0055 diz que acrescentar origem e acrescentar um
  -- `union all`, e e literalmente isto. Sem esta parte, a etapa do redator
  -- podia ter dia marcado e nao aparecia no calendario de ninguem -- a data
  -- existia na tabela e nao existia na tela, que e o pior dos dois estados.
  --
  -- `security_invoker = true` continua sendo a linha mais importante da view,
  -- e ela vale aqui tambem: quem le `post_etapas` por baixo passa pela RLS
  -- dela, e o cliente nao alcanca a corrente de producao da agencia.
  --
  -- O `client_id` vem do POST, e nao da etapa: a etapa nao tem cliente, e sem
  -- o join o filtro de cliente do calendario deixaria estas linhas passar
  -- sempre -- o que parece "sem filtro" e e vazamento de pauta entre contas
  -- na tela de quem filtrou por uma.
  select
    e.id,
    'etapa_de_post',
    e.nome || ' · ' || p.tema,
    e.prazo,
    e.prazo,
    p.client_id,
    e.responsavel_id,
    null::text,
    e.status::text,
    '/painel/social-media?post=' || p.id
  from public.post_etapas e
  join public.posts p on p.id = e.post_id
  where e.prazo is not null;

comment on view public.calendar_events is
  'As OITO origens do Calendário Full num formato só: demanda, etapa, '
  'ausência, evento, post, campanha, entregável e etapa de post (0059). '
  'security_invoker = true: a RLS de cada tabela de origem continua valendo.';
