-- ---------------------------------------------------------------------------
-- 0045 - A CORRENTE DE ETAPAS DO POST
--
-- Decisao do usuario: "preciso que o Workflow do social automaticamente seja:
-- Pauta com um social media - Conteudo com um redator - Layout com Diretor de
-- Arte - Envio (aqui o social e enviado para o cliente validar) e caso ele
-- faca ajustes, que se monte uma etapa chamada Ajustes com Diretor de Arte, e
-- Programar com Social Media".
--
-- Ate aqui o post tinha UMA mao por vez -- a gestao abria, um colaborador
-- produzia, a gestao enviava (0042). Isso descreve quem pode escrever, nao
-- quem faz o que: pauta, texto e arte sao tres pessoas com tres oficios, e
-- "produzir" as tratava como uma so.
--
-- ---------------------------------------------------------------------------
-- POR QUE NAO E UM `workflow_template`, sendo que o produto ja tem workflows
--
-- Porque workflow materializa SUBTAREFA, e subtarefa mora dentro de uma
-- `task`. Transformar cada post numa task esbarra em duas coisas que ja estao
-- de pe: `tasks_exige_pasta_de_entrega` (0015) cobra pasta de entrega em toda
-- demanda -- e sao cento e vinte pastas por mes que ninguem vai preencher --,
-- e o board da agencia ganharia cento e vinte linhas mensais, que e
-- exatamente o que o modo `mensal_agrupada` da recorrencia (0040) existe para
-- evitar.
--
-- Entao a corrente e do POST, e a cadeia mora em `etapas_padrao_do_social()`.
-- Se um dia ela precisar ser editavel por cliente, vira tabela de modelo --
-- decisao explicita, e nao um `if` a mais na tela.
--
-- ---------------------------------------------------------------------------
-- "DIRETOR DE ARTE" E A FUNCAO `Design` DO ENUM, e a escolha e deliberada.
--
-- `team_funcao` (0003) tem `Design`, e acrescentar `Diretor de Arte` ao lado
-- dele criaria dois nomes para o mesmo oficio: a mesma pessoa cadastrada como
-- um nao apareceria na busca pelo outro, e a matriz da equipe partiria o time
-- em dois. O nome que o usuario usou e o da PESSOA; o que a etapa precisa
-- dizer e a funcao, e "Layout / Design" diz.
--
-- ---------------------------------------------------------------------------
-- O QUE E AUTOMATICO, E O QUE NAO E
--
-- Automatico: as cinco etapas nascem com o post, o Envio acompanha a rodada do
-- cliente, e a etapa de Ajustes nasce quando o cliente pede ajustes.
--
-- NAO automatico: post RECUSADO nao ganha etapa de Ajustes. Rejeitar diz
-- *nao*, e pedir ajustes diz *mude isto e volte* -- a distincao e da 0032, e
-- criar a etapa nos dois casos afirmaria que um post recusado e para refazer,
-- que e justamente o que recusar nao diz. Quem decide o que fazer com ele e a
-- gestao.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A tabela
--
-- `status` e `subtask_status` E NAO UM ENUM NOVO, ao contrario do que o
-- produto fez com `task_status`, `subtask_status` e `content_status` -- que
-- sao tres porque respondem a perguntas diferentes. Esta aqui responde a MESMA
-- pergunta que a etapa de demanda: "em que pe esta este trabalho, que e meu?".
-- Os seis valores cabem, inclusive os dois que pareceriam sobrar: `Envio` fica
-- em `enviada_aprovacao` enquanto o cliente decide, e volta a `em_ajustes`
-- quando ele pede mudanca. Um enum novo com quatro dos seis valores obrigaria
-- um de-para na tela de Minhas Tasks, que e onde os dois vao aparecer lado a
-- lado.
-- ---------------------------------------------------------------------------

create table if not exists public.post_etapas (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.posts (id) on delete cascade,
  -- COM ESPACO ENTRE OS NUMEROS (10, 20, 30, 40, 50) de proposito: a etapa de
  -- Ajustes nasce DEPOIS, entre Envio e Programar, e com ordem sequencial ela
  -- obrigaria a renumerar as seguintes -- um update em cascata por causa de um
  -- pedido de ajuste do cliente.
  ordem          integer not null,
  nome           text not null,
  funcao         public.team_funcao not null,
  responsavel_id uuid references public.profiles (id) on delete set null,
  status         public.subtask_status not null default 'nao_iniciada',
  prazo          date,
  concluida_em   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (post_id, ordem)
);

comment on table public.post_etapas is
  'A corrente de trabalho de um post: Pauta, Conteudo, Layout, Envio, Programar -- e Ajustes, que nasce quando o cliente pede. A tabela e do POST e nao de `subtasks` porque post nao e task (ver o cabecalho da 0045).';

create index if not exists post_etapas_post_idx on public.post_etapas (post_id, ordem);
create index if not exists post_etapas_minhas_idx
  on public.post_etapas (responsavel_id, status)
  where responsavel_id is not null;

alter table public.post_etapas enable row level security;

drop policy if exists post_etapas_select on public.post_etapas;
-- O CLIENTE NAO TEM POLICY NENHUMA AQUI, e a ausencia e a trava. A corrente e
-- conversa interna: ele decide sobre o material, nao acompanha quem da casa
-- esta com ele na mao.
create policy post_etapas_select on public.post_etapas
  for select to authenticated using (public.is_staff());

drop policy if exists post_etapas_insert on public.post_etapas;
create policy post_etapas_insert on public.post_etapas
  for insert to authenticated with check (public.is_gestor());

drop policy if exists post_etapas_update on public.post_etapas;
create policy post_etapas_update on public.post_etapas
  for update to authenticated
  using (public.is_gestor() or responsavel_id = (select auth.uid()))
  with check (public.is_gestor() or responsavel_id = (select auth.uid()));

drop policy if exists post_etapas_delete on public.post_etapas;
create policy post_etapas_delete on public.post_etapas
  for delete to authenticated using (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 2 - A cadeia
--
-- Os nomes sao os que o usuario ditou. A funcao e a do enum -- ver o cabecalho
-- sobre "Diretor de Arte".
-- ---------------------------------------------------------------------------

create or replace function public.etapas_padrao_do_social()
returns table (ordem integer, nome text, funcao public.team_funcao)
language plpgsql
immutable
as $$
begin
  return query values
    (10, 'Pauta',    'Social Media'::public.team_funcao),
    (20, 'Conteúdo', 'Redator'::public.team_funcao),
    (30, 'Layout',   'Design'::public.team_funcao),
    -- ENVIO E ETAPA, e nao so o botao que ja existe. Sem ela a corrente teria
    -- um buraco entre "a arte ficou pronta" e "o cliente respondeu", que e
    -- justamente onde um post fica parado -- e ninguem saberia de quem estava
    -- esperando. O dono dela e a gestao porque enviar ao cliente e dela desde
    -- a 0007, e essa regra nao mudou aqui.
    (40, 'Envio',    'Gestao'::public.team_funcao),
    (50, 'Programar','Social Media'::public.team_funcao);
end;
$$;

comment on function public.etapas_padrao_do_social is
  'A cadeia fixa de um post. "Ajustes" NAO esta aqui: ela nao e uma etapa que todo post percorre, e sim a resposta a um pedido do cliente -- ver `posts_corrente_do_cliente`.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - As etapas nascem com o post
--
-- `p_responsaveis` e {"Social Media": uuid, "Redator": uuid, "Design": uuid} --
-- UMA PESSOA POR FUNCAO e nao uma por etapa, decisao do usuario. E como a
-- agencia trabalha: as mesmas pessoas fazem social todo mes, e a Pauta e o
-- Programar do mesmo post sao da mesma social media.
--
-- E o mapa e FALLBACK e nao substituicao, a mesma ordem do responsavel padrao
-- da recorrencia (0041): quem ja tem nome na etapa manda. Aqui isso so importa
-- na hora de remontar a corrente de um post que ja tem uma.
-- ---------------------------------------------------------------------------

create or replace function public.montar_etapas_do_post(
  p_post_id       uuid,
  p_responsaveis  jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  e       record;
  quantas integer := 0;
begin
  for e in select * from public.etapas_padrao_do_social() loop
    insert into public.post_etapas (post_id, ordem, nome, funcao, responsavel_id)
    values (
      p_post_id, e.ordem, e.nome, e.funcao,
      nullif(p_responsaveis ->> (e.funcao::text), '')::uuid
    )
    on conflict (post_id, ordem) do nothing;

    if found then
      quantas := quantas + 1;
    end if;
  end loop;

  return quantas;
end;
$$;

-- O GATILHO E `after insert` NO POST, e nao um passo da action. A corrente e
-- do produto e nao da tela: post criado pelo seed, pelo `abrir_mes_de_social`,
-- pelo script de paliativo ou por um `insert` a mao nasce com ela do mesmo
-- jeito. Uma tela que monta a corrente e uma tela que esquece de monta-la.
create or replace function public.posts_monta_corrente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.montar_etapas_do_post(new.id, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists posts_monta_corrente on public.posts;
create trigger posts_monta_corrente
  after insert on public.posts
  for each row execute function public.posts_monta_corrente();


-- ---------------------------------------------------------------------------
-- PASSO 4 - A corrente e uma corrente: cada etapa espera a anterior
--
-- E a mesma regra da dependencia de subtarefa (0007), e pela mesma razao: o
-- redator escrevendo antes de a pauta existir escreve sobre o que achou. A
-- diferenca e que aqui a dependencia nao se cadastra -- ela E a ordem.
--
-- A RECUSA NOMEIA O QUE FALTA. "Etapa bloqueada" manda a pessoa procurar; "a
-- Pauta ainda nao foi concluida" ja diz a quem perguntar.
-- ---------------------------------------------------------------------------

create or replace function public.post_etapas_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pendente text;
  -- AS TRAVAS VALEM PARA GENTE, e as duas excecoes estao aqui em cima juntas
  -- de proposito: escritas por duas razoes diferentes, em dois `if` separados,
  -- divergiriam -- e foi o que aconteceu na primeira versao desta funcao, em
  -- que a trava do Envio isentava o seed e a da ordem nao.
  --
  --   * SEM SESSAO QUEM ESCREVE E O SEED, como em `proteger_colunas_do_post`
  --     (0042) e em `comments_normaliza` (0032). O seed monta um post no meio
  --     do fluxo -- ja enviado, ja com ajuste pedido --, e uma corrente que so
  --     aceita ser percorrida em ordem obrigaria cinco `update` em sequencia
  --     para descrever um estado.
  --
  --   * E O GUC diz que quem escreve e o proprio produto. Sem ele a trava mais
  --     nova da 0045 quebraria a acao mais antiga do portal:
  --     `posts_corrente_do_cliente` move a etapa Envio e roda com o
  --     `auth.uid()` DO CLIENTE (`security definer` nao troca quem esta
  --     logado), entao o cliente aprovando um post cairia em "o Envio nao se
  --     marca a mao" -- recusando a unica coisa que ele faz la.
  --
  -- O `set local` do GUC morre no fim da transacao e nao atravessa a
  -- requisicao do PostgREST, entao ninguem consegue liga-lo por fora.
  travas boolean := (select auth.uid()) is not null
                    and coalesce(current_setting('full_hub.corrente', true), '') <> 'on';
begin
  -- O QUE O RESPONSAVEL TROCA E O STATUS, e mais nada. Policy nao limita
  -- coluna: sem esta parte, um PATCH no PostgREST passaria a etapa do redator
  -- para outra pessoa, ou trocaria "Layout" por outro nome.
  if travas and not public.is_gestor() then
    if new.nome is distinct from old.nome
       or new.funcao is distinct from old.funcao
       or new.ordem is distinct from old.ordem
       or new.responsavel_id is distinct from old.responsavel_id
       or new.prazo is distinct from old.prazo then
      raise exception using
        errcode = 'check_violation',
        message = 'Numa etapa que é sua você move o andamento, e o resto é da gestão.',
        hint    = 'Nome, função, ordem, responsável e prazo mudam com quem abriu o post.';
    end if;
  end if;

  if new.status is not distinct from old.status then
    new.updated_at := now();
    return new;
  end if;

  -- ENVIO NAO SE MARCA A MAO, nem pela gestao -- ele e consequencia da rodada
  -- de escopo cliente, como `posts.enviado_em` e desde a 0032. Marcar a etapa
  -- afirmaria que o post foi ao cliente sem nada ter saido da agencia.
  if travas and old.nome = 'Envio' then
    raise exception using
      errcode = 'check_violation',
      message = 'A etapa Envio acompanha a decisão do cliente, e não se marca à mão.',
      hint    = 'Use a ação Enviar ao cliente; quando ele responder, a etapa anda sozinha.';
  end if;

  -- A CORRENTE E UMA CORRENTE: cada etapa espera a anterior. E a mesma regra da
  -- dependencia de subtarefa (0007) e pela mesma razao -- o redator escrevendo
  -- antes de a pauta existir escreve sobre o que achou. A diferenca e que aqui
  -- a dependencia nao se cadastra: ela E a ordem.
  --
  -- A RECUSA NOMEIA O QUE FALTA, e todas. "Etapa bloqueada" manda a pessoa
  -- procurar; dizer quais ja diz a quem perguntar.
  --
  -- E UMA ETAPA `em_ajustes` NAO BLOQUEIA O QUE VEM DEPOIS DELA. Sem esta
  -- linha a corrente trava exatamente onde o cliente mexeu: ele pede ajustes,
  -- o Envio vai para `em_ajustes`, a etapa de Ajustes nasce logo depois dele
  -- -- e comecar essa etapa e recusado com "vem depois de Envio", que nunca
  -- vai ficar concluida enquanto o ajuste nao for feito. Um abraco.
  --
  -- A leitura e a que a palavra ja diz: uma etapa em ajustes JA DEVOLVEU o
  -- trabalho. Ela nao esta esperando a anterior; esta esperando alguem DEPOIS
  -- dela consertar. E o Programar continua travado do jeito certo -- enquanto
  -- o Ajustes nao fecha ele e o bloqueio, e quando o post volta ao cliente o
  -- Envio fica `enviada_aprovacao`, que bloqueia de novo. So a aprovacao do
  -- cliente o libera, que e a regra que importa: ninguem programa o que o
  -- cliente nao aprovou.
  if travas and old.status = 'nao_iniciada' and new.status <> 'nao_iniciada' then
    select string_agg(e.nome, ', ' order by e.ordem) into pendente
      from public.post_etapas e
     where e.post_id = new.post_id
       and e.ordem < new.ordem
       and e.status not in ('concluida', 'em_ajustes');

    if pendente is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('Esta etapa vem depois de %s.', pendente),
        hint    = 'A corrente do post é em ordem: cada etapa começa quando a anterior é concluída.';
    end if;
  end if;

  -- O CARIMBO NAO E TRAVA, e por isso fica fora dos `if travas`: ele vale para
  -- toda escrita, a do seed inclusive. Uma etapa concluida sem data de
  -- conclusao e uma linha que nao serve para relatorio nenhum.
  if new.status = 'concluida' and old.status <> 'concluida' then
    new.concluida_em := now();
  elsif new.status <> 'concluida' then
    new.concluida_em := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists post_etapas_regras on public.post_etapas;
create trigger post_etapas_regras
  before update on public.post_etapas
  for each row execute function public.post_etapas_regras();


-- ---------------------------------------------------------------------------
-- PASSO 5 - O Envio, os Ajustes e o Programar acompanham o cliente
--
-- E GATILHO EM `posts` E NAO UM TRECHO DENTRO DE `decidir_rodada_do_cliente`,
-- por duas razoes. A primeira e que aquela funcao ja foi reescrita inteira
-- varias vezes, e cada reescrita e uma chance de o trecho ficar para tras --
-- foi o que aconteceu com `validar_nova_rodada` na 0042. A segunda e melhor: o
-- gatilho pega TODO caminho que poe o post em ajustes, inclusive a gestao
-- marcando a mao, e nao so o botao do portal.
-- ---------------------------------------------------------------------------

create or replace function public.posts_corrente_do_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quantos     integer;
  proxima     integer;
  dono_layout uuid;
begin
  -- Post que ainda nao tem corrente (anterior a 0045) nao ganha uma agora: ela
  -- nasceria pela metade, com o trabalho ja feito marcado como nao iniciado.
  if not exists (select 1 from public.post_etapas e where e.post_id = new.id) then
    return new;
  end if;

  -- Ver a explicacao em `post_etapas_regras`: daqui para baixo quem escreve e
  -- o produto, e as travas da etapa nao se aplicam.
  perform set_config('full_hub.corrente', 'on', true);

  -- FOI AO CLIENTE -> o Envio esta em curso.
  if new.enviado_em is not null and old.enviado_em is null then
    update public.post_etapas
       set status = 'enviada_aprovacao', updated_at = now()
     where post_id = new.id and nome = 'Envio';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- APROVOU -> o Envio fecha, e o Programar e a proxima mao.
  if new.status = 'aprovado' then
    update public.post_etapas
       set status = 'concluida', concluida_em = now(), updated_at = now()
     where post_id = new.id and nome = 'Envio' and status <> 'concluida';
  end if;

  -- PEDIU AJUSTES -> nasce a etapa de Ajustes, entre o Envio e o Programar.
  --
  -- UMA POR RODADA, numerada. A segunda volta do cliente nao reabre a
  -- primeira: elas sao dois pedidos diferentes, com dois motivos diferentes, e
  -- reaproveitar a linha apagaria o primeiro -- a mesma razao pela qual rodada
  -- fechada nunca e reescrita (0007).
  if new.status = 'ajustes' then
    select count(*) into quantos
      from public.post_etapas e
     where e.post_id = new.id and e.nome like 'Ajustes%';

    select coalesce(max(e.ordem), 40) + 1 into proxima
      from public.post_etapas e
     where e.post_id = new.id and e.ordem > 40 and e.ordem < 50;

    -- QUEM FEZ O LAYOUT FAZ O AJUSTE. Etapa sem dono nao aparece no "Minhas
    -- Tasks" de ninguem, e um pedido do cliente e a ultima coisa do produto
    -- que pode ficar sem dono.
    select e.responsavel_id into dono_layout
      from public.post_etapas e
     where e.post_id = new.id and e.nome = 'Layout';

    if quantos < 9 then
      insert into public.post_etapas (post_id, ordem, nome, funcao, responsavel_id)
      values (new.id, proxima,
              case when quantos = 0 then 'Ajustes'
                   else format('Ajustes %s', quantos + 1) end,
              'Design'::public.team_funcao,
              dono_layout);

      -- `notificar()` NAO ACEITA DESTINATARIO NULO -- `notifications.user_id` e
      -- `not null`. Sem este `if`, um post cuja etapa de Layout ainda nao tem
      -- dono derrubava a decisao do cliente inteira: ele clicava em "solicitar
      -- ajustes" no portal e levava um erro de banco. Nem o pedido, nem o
      -- comentario, nem a rodada -- e a culpa apareceria na tela dele.
      if dono_layout is not null then
        perform public.notificar(
          dono_layout, 'aprovacao',
          format('O cliente pediu ajustes em "%s"', new.tema),
          'Uma etapa de Ajustes entrou na corrente do post.',
          '/painel/social-media'
        );
      end if;
    end if;

    update public.post_etapas
       set status = 'em_ajustes', updated_at = now()
     where post_id = new.id and nome = 'Envio';
  end if;

  -- DESLIGA ANTES DE DEVOLVER. `set local` so cai no fim da transacao, e uma
  -- transacao que aprova um post e depois mexe numa etapa a mao passaria pelas
  -- travas caladas -- a saida de emergencia virando porta destrancada.
  perform set_config('full_hub.corrente', 'off', true);

  return new;
end;
$$;

drop trigger if exists posts_corrente_do_cliente on public.posts;
create trigger posts_corrente_do_cliente
  after update on public.posts
  for each row execute function public.posts_corrente_do_cliente();


-- ---------------------------------------------------------------------------
-- PASSO 6 - Abrir o mes ja distribui a corrente
--
-- A funcao e reescrita INTEIRA a partir da versao da 0044, que e a ultima.
-- ---------------------------------------------------------------------------

-- E `drop` ANTES DO `create`, e nao so `create or replace`. Acrescentar um
-- parametro -- mesmo com default -- nao SUBSTITUI a funcao: cria uma
-- SOBRECARGA ao lado da antiga, e as duas passam a existir. A chamada de
-- quatro argumentos fica ambigua ("function name is not unique") e o proprio
-- `comment on function` abaixo nao sabe de qual das duas falar. A antiga
-- continuaria atendendo a action antiga, montando posts sem distribuir a
-- corrente -- calada.
drop function if exists public.abrir_mes_de_social(uuid, text, jsonb, uuid);

create or replace function public.abrir_mes_de_social(
  p_client_id      uuid,
  p_mes            text,
  p_quantidades    jsonb,
  p_responsavel_id uuid default null,
  p_responsaveis   jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rede      text;
  quantos   integer;
  i         integer;
  novo      uuid;
  criados   integer := 0;
  total     integer := 0;
  primeiro  date;
  empresa   text;
  meses     text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'check_violation',
      message = 'Abrir o mês de social é do desenvolvedor ou do sócio.',
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

      -- A CORRENTE JA NASCEU pelo gatilho `posts_monta_corrente`, sem
      -- responsavel. Aqui ela recebe os nomes, e por isso e `update` e nao um
      -- segundo `insert`: duas montagens da mesma corrente dariam dez etapas.
      update public.post_etapas e
         set responsavel_id = nullif(p_responsaveis ->> (e.funcao::text), '')::uuid,
             updated_at = now()
       where e.post_id = novo
         and nullif(p_responsaveis ->> (e.funcao::text), '') is not null;

      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$$;

comment on function public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb) is
  'Abre N posts vazios de um cliente para um mes, sem data, cada um ja com a corrente de etapas. Transacional: ou nascem todos ou nenhum. Teto de 60 por chamada -- um zero a mais e erro de digitacao.';


-- ---------------------------------------------------------------------------
-- PASSO 7 - Quem recebeu uma etapa fica sabendo
--
-- `notificar()` nunca avisa quem causou o aviso, entao a gestao que se poe
-- numa etapa nao recebe nada -- e a mesma regra do sino desde a 0011.
-- ---------------------------------------------------------------------------

create or replace function public.avisar_dono_da_etapa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.posts%rowtype;
begin
  if new.responsavel_id is null
     or (tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id) then
    return new;
  end if;

  p := (select ps from public.posts ps where ps.id = new.post_id);

  perform public.notificar(
    new.responsavel_id, 'task',
    format('%s · %s', p.tema, new.nome),
    'Uma etapa do social é sua.',
    '/painel/social-media'
  );

  return new;
end;
$$;

drop trigger if exists post_etapas_avisa on public.post_etapas;
create trigger post_etapas_avisa
  after insert or update of responsavel_id on public.post_etapas
  for each row execute function public.avisar_dono_da_etapa();


-- ---------------------------------------------------------------------------
-- PASSO 8 - Os posts que ja existem ganham a corrente
--
-- SEM ADIVINHAR O ANDAMENTO: todas as etapas nascem em `nao_iniciada`, mesmo
-- num post ja enviado. Marcar "Layout concluido" porque existe arte seria o
-- sistema afirmando um fato que ninguem registrou -- e a pessoa que abrir o
-- post veria uma corrente que ela nao percorreu.
-- ---------------------------------------------------------------------------

do $$
declare p record;
begin
  for p in select id from public.posts loop
    perform public.montar_etapas_do_post(p.id, '{}'::jsonb);
  end loop;
end $$;

notify pgrst, 'reload schema';
