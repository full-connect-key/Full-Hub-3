-- ===========================================================================
-- 0069 - COMODATOS: qual equipamento da agencia esta com qual pessoa
--
-- Modulo novo, e o segundo do zero em poucos sprints: nao havia ponte para
-- atravessar desta vez -- nem tabela, nem enum, nem coluna esperando alguem.
--
-- ---------------------------------------------------------------------------
-- O QUE O MODULO RESPONDE, e por que ele existe
--
-- A equipe e toda PJ e o equipamento e da agencia. Hoje isso vive na memoria
-- de quem entregou: o notebook foi para a Marina em marco, a camera esta com o
-- Bruno "desde uma gravacao". No dia em que alguem sai, a pergunta "o que
-- estava com essa pessoa?" nao tem onde ser feita -- e e a pergunta que custa
-- dinheiro.
--
-- Sao duas visoes da MESMA informacao, e e por isso que nao sao dois modulos:
-- o colaborador ve o que esta com ele; a gestao ve o inventario inteiro e quem
-- esta com o que.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- A DIVERGENCIA IMPORTANTE DO TEXTO DO SPRINT, e ela e de seguranca
--
-- O sprint escreve `assets_select` deixando o colaborador ler a linha inteira
-- do equipamento que esta com ele, e logo abaixo diz: "`valor_aquisicao` e
-- `nota_fiscal_url` so para is_gestor(); se a consulta do colaborador precisar
-- da tabela, use uma view sem essas colunas -- nao confie em esconder na tela".
--
-- **AS DUAS FRASES NAO CABEM JUNTAS.** Uma view NAO limita a tabela de baixo:
-- com a linha liberada pela policy, um `select valor_aquisicao from assets`
-- pelo PostgREST responde -- e o proprio critério de aceite do sprint diz "ele
-- nao ve valor_aquisicao nem a nota fiscal, NEM PELA API". E a mesma lei que o
-- produto ja escreveu tres vezes: **policy nao limita coluna** (0005 com
-- protect_client_columns, 0032 com comments_normaliza, 0042 com
-- posts_protege_colunas).
--
-- Entao a linha fica fora do alcance: `assets_select` e `is_gestor()` e mais
-- ninguem, e o colaborador recebe as colunas seguras por
-- `meus_comodatos()` -- `security definer`, devolvendo so o recorte. E a forma
-- de `usuarios_do_meu_cliente()` (0031) e de `meus_pedidos_de_nota()` (0066):
-- definer para devolver o agregado sem abrir a tabela.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- O QUE O BANCO GARANTE, E NAO A TELA
--
-- * UM EMPRESTIMO ATIVO POR EQUIPAMENTO e um INDICE UNICO PARCIAL, nunca a
--   consulta da tela. Duas abas clicando em "Emprestar" ao mesmo tempo passam
--   pelas duas consultas antes de qualquer uma gravar -- e a decisao da 0040.
-- * O STATUS DO EQUIPAMENTO e escrito por trigger a partir do emprestimo. Duas
--   maos escrevendo a mesma verdade divergem no primeiro caminho que esquecer
--   uma delas.
-- * O CODIGO DE PATRIMONIO sai de uma SEQUENCE. `max(codigo) + 1` passa em
--   todo teste sequencial e devolve o mesmo numero para duas pessoas
--   cadastrando ao mesmo tempo. O custo aceito e o buraco: uma transacao que
--   volta atras consome um numero. Codigo de patrimonio com buraco esta certo;
--   codigo repetido nao.
-- * O COLABORADOR NAO TEM POLICY DE UPDATE, e por isso nao ha coluna para
--   proteger por trigger: ele confirma recebimento por `confirmar_recebimento()`
--   e reporta problema por `reportar_problema_do_comodato()`. As duas escrevem
--   uma coisa cada.
-- * APAGAR EMPRESTIMO DEVOLVIDO E RECUSADO, inclusive para o socio -- o
--   historico E o valor do modulo. Emprestimo em aberto se apaga (foi lancado
--   por engano); devolvido, nao. E `assets` NAO TEM POLICY DE DELETE: o caminho
--   e dar baixa, que preserva a folha corrida do equipamento.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- `asset_events` E A LINHA DO TEMPO, e ela NAO e o `audit_log`
--
-- O sprint pede "a linha do tempo completa: cadastrado, emprestado a fulano,
-- devolvido, em manutencao, emprestado a beltrano". Emprestimo e devolucao dao
-- para derivar de `asset_loans`; **manutencao e baixa nao** -- sao mudancas de
-- status em `assets`, e sem registro elas desaparecem.
--
-- A tentacao e ler o `audit_log` da 0058, que ja grava update em tabela
-- auditada. Ela se desfaz numa linha: **aquela trilha e do SOCIO** -- ela copia
-- valor de `finance_entries` -- e este historico e lido pela GESTAO, na tela do
-- equipamento. Juntar os dois abriria a trilha do socio para o desenvolvedor,
-- que e a porta dos fundos do Financeiro. E a decisao que separou `audit_log`
-- de `task_history`, escrita de novo.
--
-- De quebra ela resolve o "reportar problema": o sprint manda avisar a gestao
-- por notificacao, e **o sino vira lido no primeiro clique** -- depois o relato
-- nao existe em tela nenhuma. Sendo evento, ele fica na folha corrida do
-- equipamento, que e onde alguem procura por ele.
-- ---------------------------------------------------------------------------
--
-- ATRASO E DERIVADO, nunca coluna: `data_prevista_devolucao < current_date and
-- data_devolucao is null`. Uma coluna precisaria de uma rotina noturna para
-- continuar verdadeira, e no dia em que ela nao rodasse o painel mentiria sem
-- avisar. E a regra do Financeiro (0013) e do bloqueio de subtarefa (0007).
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Os tres enums
--
-- `asset_tipo` e fechado porque ele decide o ICONE que a tela desenha quando o
-- equipamento nao tem foto -- um "Notebook" com N maiusculo faria o icone sumir
-- sem erro nenhum, que e a razao pela qual `posts.midia` e enum e
-- `posts.formato` e texto (0042).
--
-- `asset_estado` tem quatro degraus e nao cinco: ele e comparado na devolucao
-- ("voltou pior do que saiu"), e escala com meio-degrau e escala que duas
-- pessoas leem diferente.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if not exists (select 1 from pg_type where typname = 'asset_tipo') then
    create type public.asset_tipo as enum (
      'notebook', 'desktop', 'monitor', 'celular', 'tablet',
      'camera', 'lente', 'microfone', 'iluminacao', 'tripe',
      'headset', 'teclado', 'mouse', 'hd_externo', 'acessorio', 'outro'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'asset_status') then
    create type public.asset_status as enum (
      'disponivel', 'emprestado', 'manutencao', 'baixado'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'asset_estado') then
    create type public.asset_estado as enum ('novo', 'bom', 'regular', 'ruim');
  end if;

  if not exists (select 1 from pg_type where typname = 'asset_evento_tipo') then
    create type public.asset_evento_tipo as enum (
      'cadastrado', 'emprestado', 'aceito', 'devolvido',
      'manutencao', 'baixado', 'problema', 'voltou'
    );
  end if;
end;
$bloco$;

alter type public.notification_tipo add value if not exists 'comodato';


-- ---------------------------------------------------------------------------
-- PASSO 2 - O equipamento
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  tipo public.asset_tipo not null,
  nome text not null,
  marca text,
  modelo text,
  numero_serie text,
  status public.asset_status not null default 'disponivel',
  estado public.asset_estado not null default 'bom',
  data_aquisicao date,
  valor_aquisicao numeric(12,2),
  nota_fiscal_url text,
  foto_url text,
  observacoes text,
  motivo_baixa text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assets is
  'O catalogo de equipamento da agencia. SELECT so para is_gestor() (0069): a linha carrega valor de aquisicao e nota fiscal, e policy nao limita coluna. O colaborador le o recorte seguro por meus_comodatos().';
comment on column public.assets.valor_aquisicao is
  'Visivel so para a gestao, e a trava e a policy de SELECT da tabela -- nao uma view, que nao limita a tabela de baixo.';
comment on column public.assets.motivo_baixa is
  'Por que o equipamento saiu do inventario: perdido, vendido, sucateado. Exigido pelo check quando status = baixado -- baixa sem motivo manda quem le o historico adivinhar.';

do $bloco$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assets_baixa_com_motivo'
  ) then
    alter table public.assets add constraint assets_baixa_com_motivo
      check (status <> 'baixado' or coalesce(btrim(motivo_baixa), '') <> '');
  end if;
end;
$bloco$;

create index if not exists assets_status_idx on public.assets (status);
create index if not exists assets_tipo_idx on public.assets (tipo);


-- ---------------------------------------------------------------------------
-- PASSO 2b - O codigo de patrimonio: uma SEQUENCE, e nao max() + 1
--
-- O laco existe por causa do codigo digitado a mao: quem cadastrar `FCK-0050`
-- hoje faria a sequence colidir com ele daqui a quarenta cadastros, e a
-- colisao apareceria como um erro de unique numa tela que nao pediu codigo
-- nenhum. O teto de tentativas impede o laco infinito no dia em que alguem
-- ocupar uma faixa inteira a mao.
-- ---------------------------------------------------------------------------
create sequence if not exists public.assets_codigo_seq as bigint start 1;

create or replace function public.proximo_codigo_de_patrimonio()
returns text
language plpgsql
as $func$
declare
  tentativa int := 0;
  candidato text;
begin
  loop
    tentativa := tentativa + 1;
    candidato := 'FCK-' || lpad(nextval('public.assets_codigo_seq')::text, 4, '0');
    exit when not exists (select 1 from public.assets a where a.codigo = candidato);
    if tentativa > 5000 then
      raise exception 'Nao foi possivel gerar um codigo de patrimonio livre.'
        using hint = 'Informe o codigo a mao nesta tela.';
    end if;
  end loop;
  return candidato;
end;
$func$;

comment on function public.proximo_codigo_de_patrimonio is
  'O proximo FCK-0000 livre. Sequence e nao max(codigo)+1: duas pessoas cadastrando ao mesmo tempo passam pelas duas consultas antes de qualquer uma gravar (0040). Buraco na numeracao e aceito; numero repetido nao.';

create or replace function public.assets_gera_codigo()
returns trigger
language plpgsql
as $func$
begin
  if coalesce(btrim(new.codigo), '') = '' then
    new.codigo := public.proximo_codigo_de_patrimonio();
  end if;
  new.updated_at := now();
  return new;
end;
$func$;

drop trigger if exists assets_codigo on public.assets;
create trigger assets_codigo
  before insert or update on public.assets
  for each row execute function public.assets_gera_codigo();


-- ---------------------------------------------------------------------------
-- PASSO 3 - O emprestimo
--
-- `data_prevista_devolucao` NULA e "por tempo indeterminado", e e o caso comum:
-- o notebook de trabalho fica enquanto a pessoa estiver aqui. Inventar uma data
-- para todo emprestimo encheria o painel de atraso que ninguem combinou.
-- ---------------------------------------------------------------------------
create table if not exists public.asset_loans (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  data_entrega date not null default current_date,
  data_prevista_devolucao date,
  data_devolucao date,
  estado_entrega public.asset_estado not null default 'bom',
  estado_devolucao public.asset_estado,
  acessorios text,
  observacoes_entrega text,
  observacoes_devolucao text,
  termo_corpo text,
  aceito_em timestamptz,
  entregue_por uuid not null references public.profiles(id) on delete restrict,
  recebido_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.asset_loans is
  'Cada passagem de um equipamento pela mao de alguem. Emprestimo devolvido nunca se apaga (0069): o historico e o valor do modulo.';
comment on column public.asset_loans.data_prevista_devolucao is
  'Nula significa por tempo indeterminado. O atraso e DERIVADO dela com current_date, nunca gravado.';
comment on column public.asset_loans.aceito_em is
  'Quando a pessoa confirmou o recebimento no sistema. Escrita so por confirmar_recebimento() -- o colaborador nao tem policy de UPDATE nesta tabela.';

-- ---------------------------------------------------------------------------
-- O TERMO E UM SNAPSHOT, E NAO UM ARQUIVO GUARDADO -- e as duas metades da
-- frase sao decisoes separadas.
--
-- **SNAPSHOT** porque o modelo e editavel pelo socio, e um termo de comodato e
-- o que a agencia afirmou por escrito NAQUELE dia. Lendo o modelo corrente na
-- hora de imprimir, reescrever o texto hoje mudaria o termo de um emprestimo
-- de dois anos atras -- que e exatamente o que `tasks.workflow_snapshot` evita
-- desde a 0008: editar o workflow nao muda demanda nenhuma que ja esta
-- correndo.
--
-- **E NAO UM ARQUIVO** porque o proprio sprint descreve o documento como vivo:
-- *"o aceite fica registrado com data e hora, e aparece no termo quando ele e
-- baixado depois do aceite"*. Um PDF gravado no instante da entrega nunca
-- carregaria o aceite, e regrava-lo a cada mudanca seria manter duas verdades
-- sobre o mesmo documento. Entao o PDF nasce no download, a partir DESTE texto
-- congelado mais o estado de agora.
--
-- Por isso nao ha coluna de endereco de arquivo nem bucket de termos: seriam
-- uma coluna e um bucket que nenhuma linha escreve, e coluna que ninguem
-- preenche e o campo de anotacao que alguem reaproveita errado tres sprints
-- depois. As fotos, essas sao arquivo de verdade e tem bucket.
-- ---------------------------------------------------------------------------
comment on column public.asset_loans.termo_corpo is
  'O texto do termo como ele estava no dia da entrega. Copiado do modelo por trigger (0069) -- editar o modelo depois nao muda emprestimo nenhum, que e a decisao de workflow_snapshot. O PDF e montado deste texto no download, para o aceite aparecer quando ja existir.';

do $bloco$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'asset_loans_periodo'
  ) then
    alter table public.asset_loans add constraint asset_loans_periodo
      check (
        (data_prevista_devolucao is null or data_prevista_devolucao >= data_entrega)
        and (data_devolucao is null or data_devolucao >= data_entrega)
      );
  end if;

  -- O PAR INTEIRO, NOS DOIS SENTIDOS, como o check de tipo de aprovacao da
  -- 0007: estado de devolucao sem devolucao afirma que o equipamento voltou, e
  -- devolucao sem estado perde exatamente a informacao que a devolucao existe
  -- para registrar.
  if not exists (
    select 1 from pg_constraint where conname = 'asset_loans_devolucao_coerente'
  ) then
    alter table public.asset_loans add constraint asset_loans_devolucao_coerente
      check ((data_devolucao is null) = (estado_devolucao is null));
  end if;
end;
$bloco$;

create index if not exists asset_loans_pessoa_idx
  on public.asset_loans (user_id, data_devolucao);
create index if not exists asset_loans_equipamento_idx
  on public.asset_loans (asset_id, data_devolucao);

-- O INDICE E A TRAVA. Sem ele, "esse equipamento ja esta emprestado" seria uma
-- consulta da tela, e duas abas passariam pelas duas consultas antes de
-- qualquer uma gravar.
create unique index if not exists asset_loan_ativo_unico
  on public.asset_loans (asset_id) where data_devolucao is null;


-- ---------------------------------------------------------------------------
-- PASSO 4 - As fotos do estado
--
-- Elas sao o que resolve discussao na devolucao: "a tampa ja estava assim".
--
-- `momento` e um CHECK e nao um enum novo: sao dois valores mecanicos e fixos,
-- e um tipo a mais para isso seria um tipo que ninguem consulta.
-- ---------------------------------------------------------------------------
create table if not exists public.asset_photos (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.asset_loans(id) on delete cascade,
  momento text not null,
  url text not null,
  created_at timestamptz not null default now()
);

do $bloco$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'asset_photos_momento'
  ) then
    alter table public.asset_photos add constraint asset_photos_momento
      check (momento in ('entrega', 'devolucao'));
  end if;
end;
$bloco$;

create index if not exists asset_photos_loan_idx on public.asset_photos (loan_id, momento);


-- ---------------------------------------------------------------------------
-- PASSO 5 - A folha corrida do equipamento
-- ---------------------------------------------------------------------------
create table if not exists public.asset_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  loan_id uuid references public.asset_loans(id) on delete set null,
  tipo public.asset_evento_tipo not null,
  texto text,
  estado public.asset_estado,
  pessoa_id uuid references public.profiles(id) on delete set null,
  registrado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.asset_events is
  'A linha do tempo operacional do equipamento (0069). NAO e o audit_log da 0058: aquela trilha e do socio porque copia valor do Financeiro, e esta e lida pela gestao na tela do equipamento. Mesma separacao que task_history tem daquela trilha.';

create index if not exists asset_events_asset_idx
  on public.asset_events (asset_id, created_at desc);

-- `on delete set null` no loan e `cascade` no asset, e a assimetria e
-- proposital: apagar um emprestimo lancado por engano nao pode apagar o
-- registro de que ele existiu, mas um equipamento que sai do banco leva a
-- propria folha -- ela nao tem sentido sozinha.


-- ---------------------------------------------------------------------------
-- PASSO 6 - O status do equipamento e escrito pelo emprestimo
--
-- ELE NAO VOLTA DE `baixado` NEM DE `manutencao` POR ENGANO: emprestar um
-- equipamento em manutencao e uma decisao de quem empresta, e a tela so
-- oferece os `disponivel`. O que o trigger faz e o caminho normal.
-- ---------------------------------------------------------------------------
create or replace function public.asset_loans_move_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if tg_op = 'INSERT' then
    update public.assets
       set status = 'emprestado',
           estado = new.estado_entrega,
           updated_at = now()
     where id = new.asset_id;
    return new;
  end if;

  -- A DEVOLUCAO. Estado `ruim` manda para manutencao em vez de disponivel:
  -- devolver um equipamento quebrado para a prateleira e emprestar o problema
  -- para a proxima pessoa.
  if old.data_devolucao is null and new.data_devolucao is not null then
    update public.assets
       set status = case
                      when new.estado_devolucao = 'ruim' then 'manutencao'::public.asset_status
                      else 'disponivel'::public.asset_status
                    end,
           estado = coalesce(new.estado_devolucao, estado),
           updated_at = now()
     where id = new.asset_id;
  end if;

  return new;
end;
$func$;

drop trigger if exists asset_loans_status on public.asset_loans;
create trigger asset_loans_status
  after insert or update on public.asset_loans
  for each row execute function public.asset_loans_move_status();


-- ---------------------------------------------------------------------------
-- PASSO 7 - Os eventos e o sino, por trigger
--
-- E TRIGGER E NAO ACTION, pela razao da auditoria (0058): o emprestimo nasce
-- por mais de um caminho -- a tela, o seed, um update colado no SQL Editor --,
-- e o aviso escrito na camada de aplicacao cobre so o que passou pela tela.
-- ---------------------------------------------------------------------------
create or replace function public.asset_loans_registra()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_nome text;
  v_codigo text;
begin
  select a.nome, a.codigo into v_nome, v_codigo
    from public.assets a where a.id = new.asset_id;

  if tg_op = 'INSERT' then
    insert into public.asset_events (asset_id, loan_id, tipo, texto, estado, pessoa_id, registrado_por)
    values (new.asset_id, new.id, 'emprestado', new.acessorios, new.estado_entrega,
            new.user_id, new.entregue_por);

    -- O aviso pede a CONFIRMACAO, que e a acao que a pessoa tem aqui.
    perform public.notificar(
      new.user_id, 'comodato',
      'Confirme o recebimento de ' || coalesce(v_nome, 'um equipamento'),
      coalesce(v_codigo, '') || ' -- confira os acessorios e o termo antes de confirmar.',
      '/painel/comodatos'
    );
    return new;
  end if;

  if old.aceito_em is null and new.aceito_em is not null then
    insert into public.asset_events (asset_id, loan_id, tipo, pessoa_id, registrado_por)
    values (new.asset_id, new.id, 'aceito', new.user_id, new.user_id);
  end if;

  if old.data_devolucao is null and new.data_devolucao is not null then
    insert into public.asset_events (asset_id, loan_id, tipo, texto, estado, pessoa_id, registrado_por)
    values (new.asset_id, new.id, 'devolvido', new.observacoes_devolucao,
            new.estado_devolucao, new.user_id, new.recebido_por);
  end if;

  return new;
end;
$func$;

-- ---------------------------------------------------------------------------
-- O texto do termo congela na entrega
--
-- E TRIGGER E NAO ACTION pela razao de sempre: o emprestimo nasce por mais de
-- um caminho, e o que passar por fora da tela sairia sem termo -- um
-- emprestimo sem termo so aparece no dia em que alguem for imprimi-lo, que e
-- justamente o dia em que ele precisa existir.
-- ---------------------------------------------------------------------------
create or replace function public.asset_loans_congela_termo()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if new.termo_corpo is null then
    select t.corpo into new.termo_corpo
      from public.asset_term_template t
     limit 1;
  end if;
  return new;
end;
$func$;

drop trigger if exists asset_loans_termo on public.asset_loans;
create trigger asset_loans_termo
  before insert on public.asset_loans
  for each row execute function public.asset_loans_congela_termo();

drop trigger if exists asset_loans_registra on public.asset_loans;
create trigger asset_loans_registra
  after insert or update on public.asset_loans
  for each row execute function public.asset_loans_registra();


create or replace function public.assets_registra()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if tg_op = 'INSERT' then
    insert into public.asset_events (asset_id, tipo, estado, registrado_por)
    values (new.id, 'cadastrado', new.estado, new.criado_por);
    return new;
  end if;

  -- SO A MUDANCA DE STATUS vira linha, e nao toda escrita: corrigir o modelo de
  -- um equipamento nao e movimento dele. E a mesma razao pela qual a auditoria
  -- nao registra update que regrava o mesmo valor (0058).
  --
  -- E SO A MUDANCA QUE O EMPRESTIMO NAO CONTA. A primeira versao escrevia uma
  -- linha para todo status novo, e a bateria pegou na primeira rodada: emprestar
  -- virava DOIS eventos -- 'emprestado' por este trigger e 'emprestado' pelo de
  -- `asset_loans`, que e o que sabe para QUEM foi. A folha corrida contava o
  -- dobro dos movimentos, e o segundo era o pior dos dois, porque nao tem
  -- pessoa nem emprestimo.
  --
  -- Entao aqui ficam os tres que nao tem emprestimo por tras: a manutencao, a
  -- baixa, e a volta DA MANUTENCAO. `disponivel` vindo de uma devolucao nao
  -- entra -- aquilo ja e a linha 'devolvido', com o estado e com quem recebeu.
  if new.status is distinct from old.status then
    if new.status = 'baixado' then
      insert into public.asset_events (asset_id, tipo, texto, estado, registrado_por)
      values (new.id, 'baixado', new.motivo_baixa, new.estado, (select auth.uid()));

    elsif new.status = 'manutencao' then
      insert into public.asset_events (asset_id, tipo, texto, estado, registrado_por)
      values (new.id, 'manutencao', new.observacoes, new.estado, (select auth.uid()));

    elsif new.status = 'disponivel' and old.status = 'manutencao' then
      insert into public.asset_events (asset_id, tipo, texto, estado, registrado_por)
      values (new.id, 'voltou', new.observacoes, new.estado, (select auth.uid()));
    end if;
  end if;

  return new;
end;
$func$;

drop trigger if exists assets_registra on public.assets;
create trigger assets_registra
  after insert or update on public.assets
  for each row execute function public.assets_registra();


-- ---------------------------------------------------------------------------
-- PASSO 8 - RLS
--
-- `assets`: SO A GESTAO, pela razao do cabecalho. `asset_events` tambem: um
-- evento nomeia a pessoa que estava com o equipamento antes, e o historico do
-- colaborador sai dos emprestimos dele.
-- ---------------------------------------------------------------------------
alter table public.assets enable row level security;
alter table public.asset_loans enable row level security;
alter table public.asset_photos enable row level security;
alter table public.asset_events enable row level security;

drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets
  for select to authenticated
  using (public.is_gestor());

drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets
  for insert to authenticated
  with check (public.is_gestor());

drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- SEM POLICY DE DELETE, e a ausencia e a regra: o caminho e dar baixa. Apagar
-- o equipamento levaria a folha corrida dele e recusaria os emprestimos por
-- `on delete restrict` -- um erro de chave estrangeira no lugar de uma decisao.

drop policy if exists asset_loans_select on public.asset_loans;
create policy asset_loans_select on public.asset_loans
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_gestor());

drop policy if exists asset_loans_insert on public.asset_loans;
create policy asset_loans_insert on public.asset_loans
  for insert to authenticated
  with check (public.is_gestor());

drop policy if exists asset_loans_update on public.asset_loans;
create policy asset_loans_update on public.asset_loans
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- APAGAR SO O QUE AINDA NAO FOI DEVOLVIDO. O emprestimo em aberto lancado por
-- engano se apaga; o devolvido e historico, e nem o socio o reescreve -- a
-- mesma regra de rodada de aprovacao fechada.
drop policy if exists asset_loans_delete on public.asset_loans;
create policy asset_loans_delete on public.asset_loans
  for delete to authenticated
  using (public.is_gestor() and data_devolucao is null);

drop policy if exists asset_photos_select on public.asset_photos;
create policy asset_photos_select on public.asset_photos
  for select to authenticated
  using (
    public.is_gestor()
    or exists (
      select 1 from public.asset_loans l
       where l.id = asset_photos.loan_id
         and l.user_id = (select auth.uid())
    )
  );

drop policy if exists asset_photos_write on public.asset_photos;
create policy asset_photos_write on public.asset_photos
  for all to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

drop policy if exists asset_events_select on public.asset_events;
create policy asset_events_select on public.asset_events
  for select to authenticated
  using (public.is_gestor());

-- SEM INSERT, UPDATE NEM DELETE: a unica porta sao os triggers e as duas
-- funcoes definer. E a forma de `notifications` e de `audit_log` -- um registro
-- que a propria pessoa conserta nao registra nada.


-- ---------------------------------------------------------------------------
-- PASSO 9 - O recorte do colaborador
--
-- Devolve O QUE ESTA E O QUE ESTEVE, com `devolvido` separando os dois: sao a
-- mesma pergunta em dois tempos, e duas funcoes dariam dois lugares para o
-- recorte divergir.
--
-- E ela NAO devolve `valor_aquisicao` nem `nota_fiscal_url`. E a razao de ela
-- existir.
-- ---------------------------------------------------------------------------
create or replace function public.meus_comodatos()
returns table (
  loan_id uuid,
  asset_id uuid,
  codigo text,
  tipo public.asset_tipo,
  nome text,
  marca text,
  modelo text,
  numero_serie text,
  foto_url text,
  data_entrega date,
  data_prevista_devolucao date,
  data_devolucao date,
  estado_entrega public.asset_estado,
  estado_devolucao public.asset_estado,
  acessorios text,
  observacoes_entrega text,
  termo_corpo text,
  aceito_em timestamptz,
  devolvido boolean
)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  -- Devolve VAZIO e nao estoura, como `meus_pedidos_de_nota()`: ela alimenta
  -- uma tela, e um erro de servidor aqui derrubaria a pagina por causa de um
  -- bloco. Quem nao e da equipe nao chega nela.
  if not public.is_staff() then
    return;
  end if;

  return query
  select l.id, a.id, a.codigo, a.tipo, a.nome, a.marca, a.modelo, a.numero_serie,
         a.foto_url, l.data_entrega, l.data_prevista_devolucao, l.data_devolucao,
         l.estado_entrega, l.estado_devolucao, l.acessorios, l.observacoes_entrega,
         l.termo_corpo, l.aceito_em, (l.data_devolucao is not null) as devolvido
    from public.asset_loans l
    join public.assets a on a.id = l.asset_id
   where l.user_id = (select auth.uid())
   order by (l.data_devolucao is not null), l.data_entrega desc;
end;
$func$;

comment on function public.meus_comodatos is
  'Os equipamentos que estao e que estiveram comigo, sem valor de aquisicao e sem nota fiscal. Definer porque assets_select e is_gestor() -- e e por isso que ela existe.';


-- ---------------------------------------------------------------------------
-- PASSO 10 - As duas acoes do colaborador
--
-- Cada uma escreve UMA coisa. Sem policy de UPDATE para ele, nao ha coluna a
-- proteger por trigger -- a porta estreita dispensa o porteiro.
-- ---------------------------------------------------------------------------
create or replace function public.confirmar_recebimento(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_loan public.asset_loans;
  v_nome text;
  v_gestor uuid;
begin
  select * into v_loan from public.asset_loans where id = p_loan_id;

  if v_loan.id is null then
    raise exception 'Esse comodato nao existe.';
  end if;

  if v_loan.user_id <> (select auth.uid()) then
    raise exception 'Voce so confirma o recebimento do que esta com voce.';
  end if;

  if v_loan.data_devolucao is not null then
    raise exception 'Esse equipamento ja foi devolvido.'
      using hint = 'Confirmar recebimento vale enquanto ele esta com voce.';
  end if;

  if v_loan.aceito_em is not null then
    return;  -- Ja confirmado: o segundo clique nao e erro, e nao reescreve a data.
  end if;

  update public.asset_loans set aceito_em = now() where id = p_loan_id;

  select a.nome into v_nome from public.assets a where a.id = v_loan.asset_id;

  for v_gestor in
    select p.id from public.profiles p
     where p.role in ('desenvolvedor', 'socio') and p.ativo
  loop
    perform public.notificar(
      v_gestor, 'comodato',
      'Recebimento confirmado: ' || coalesce(v_nome, 'equipamento'),
      null,
      '/painel/comodatos'
    );
  end loop;
end;
$func$;

comment on function public.confirmar_recebimento is
  'A pessoa confirma que recebeu o equipamento. Escreve aceito_em e mais nada -- o colaborador nao tem policy de UPDATE em asset_loans. O segundo clique nao reescreve a data.';


create or replace function public.reportar_problema_do_comodato(
  p_loan_id uuid,
  p_texto   text
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_loan public.asset_loans;
  v_nome text;
  v_gestor uuid;
begin
  if coalesce(btrim(p_texto), '') = '' then
    raise exception 'Escreva o que aconteceu.'
      using hint = 'Um relato sem texto manda a gestao adivinhar.';
  end if;

  select * into v_loan from public.asset_loans where id = p_loan_id;

  if v_loan.id is null or v_loan.user_id <> (select auth.uid()) then
    raise exception 'Voce so reporta problema do que esta com voce.';
  end if;

  -- O RELATO VIRA EVENTO, e NAO muda o status: quem avalia e a gestao. Mandar o
  -- equipamento para manutencao no clique de quem o usa tiraria da tela dela a
  -- decisao que o sprint diz que e dela.
  insert into public.asset_events (asset_id, loan_id, tipo, texto, pessoa_id, registrado_por)
  values (v_loan.asset_id, v_loan.id, 'problema', btrim(p_texto),
          v_loan.user_id, v_loan.user_id);

  select a.nome into v_nome from public.assets a where a.id = v_loan.asset_id;

  for v_gestor in
    select p.id from public.profiles p
     where p.role in ('desenvolvedor', 'socio') and p.ativo
  loop
    perform public.notificar(
      v_gestor, 'comodato',
      'Problema reportado em ' || coalesce(v_nome, 'um equipamento'),
      btrim(p_texto),
      '/painel/comodatos'
    );
  end loop;
end;
$func$;

comment on function public.reportar_problema_do_comodato is
  'O relato de quem esta com o equipamento. Vira EVENTO e nao so notificacao -- o sino vira lido no primeiro clique e depois o relato nao existe em tela nenhuma. Nao muda status: quem avalia e a gestao.';


-- ---------------------------------------------------------------------------
-- PASSO 11 - O que a gestao precisa saber antes de desligar alguem
--
-- Definer porque `desligarColaborador` roda com a chave de servico, e esta
-- funcao tambem serve a ficha da pessoa, lida pela gestao.
-- ---------------------------------------------------------------------------
create or replace function public.comodatos_em_aberto_de(p_user_id uuid)
returns table (loan_id uuid, codigo text, nome text, data_entrega date)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  if not public.is_gestor() then
    return;
  end if;

  return query
  select l.id, a.codigo, a.nome, l.data_entrega
    from public.asset_loans l
    join public.assets a on a.id = l.asset_id
   where l.user_id = p_user_id
     and l.data_devolucao is null
   order by l.data_entrega;
end;
$func$;

comment on function public.comodatos_em_aberto_de is
  'O que ainda esta com uma pessoa. E o que o desligamento (Sprint 2) mostra antes de concluir: nao da para desligar alguem e esquecer o notebook.';


-- ---------------------------------------------------------------------------
-- PASSO 12 - O modelo do termo de comodato
--
-- UMA LINHA SO, e e de proposito: o termo e da agencia, nao do equipamento nem
-- da pessoa. Uma tabela com varias versoes ofereceria escolher o modelo na
-- hora de emprestar, que e uma decisao que ninguem pediu -- e o termo assinado
-- fica gravado no PDF do emprestimo, que e onde a versao daquele dia mora.
-- ---------------------------------------------------------------------------
create table if not exists public.asset_term_template (
  id uuid primary key default gen_random_uuid(),
  unica boolean not null default true,
  corpo text not null,
  atualizado_por uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint asset_term_template_linha_unica check (unica),
  constraint asset_term_template_uma_so unique (unica)
);

-- A CHAVE E UUID E A TRAVA E A COLUNA AO LADO, e a primeira versao fez o
-- contrario: `id boolean primary key default true` diz "uma linha so" em uma
-- linha, e quebrou na auditoria -- `registrar_auditoria()` grava o id do
-- registro numa coluna `uuid`, e a bateria devolveu *invalid input syntax for
-- type uuid: "true"*. A tabela auditada precisa parecer com as outras.
comment on table public.asset_term_template is
  'O texto do termo de comodato, editavel pelo socio. Uma linha so, garantida pelo par check + unique em `unica` -- e nao pela chave primaria, que precisa ser uuid para a trilha da 0058 conseguir registrar quem o reescreveu.';

alter table public.asset_term_template enable row level security;

drop policy if exists asset_term_select on public.asset_term_template;
create policy asset_term_select on public.asset_term_template
  for select to authenticated
  using (public.is_staff());

-- SO O SOCIO ESCREVE, e a razao e a mesma da fila de notas: este texto e o que
-- a agencia afirma por escrito para cada pessoa da equipe. Quem responde por
-- isso e quem responde pela empresa.
drop policy if exists asset_term_write on public.asset_term_template;
create policy asset_term_write on public.asset_term_template
  for all to authenticated
  using (public.is_socio())
  with check (public.is_socio());

insert into public.asset_term_template (unica, corpo)
values (true, 'TERMO DE COMODATO DE EQUIPAMENTO

Pelo presente instrumento, a FULL CONNECT KEY, doravante COMODANTE, entrega a
{{PESSOA}}, doravante COMODATARIA, o equipamento descrito abaixo, em regime de
comodato, para uso exclusivamente profissional nas atividades contratadas.

EQUIPAMENTO
{{EQUIPAMENTO}}
Patrimonio: {{PATRIMONIO}}
Numero de serie: {{SERIE}}
Acessorios entregues: {{ACESSORIOS}}
Estado na entrega: {{ESTADO}}
Data da entrega: {{DATA_ENTREGA}}

CONDICOES
1. O equipamento e de propriedade da COMODANTE e permanece sendo.
2. O uso e profissional, nas atividades contratadas.
3. A COMODATARIA se responsabiliza pela guarda e pela conservacao do
   equipamento enquanto ele estiver em seu poder, e comunica a COMODANTE
   qualquer defeito, dano, perda ou furto assim que tomar conhecimento.
4. A devolucao acontece quando solicitada pela COMODANTE ou ao termino da
   relacao contratual, no estado em que o equipamento foi recebido, ressalvado
   o desgaste natural do uso.

{{ACEITE}}')
on conflict (unica) do nothing;


-- ---------------------------------------------------------------------------
-- PASSO 13 - O bucket privado das fotos
--
-- UM SO, e nao dois: o termo nao vira arquivo (veja o comentario de
-- `termo_corpo`), entao um bucket de termos seria um bucket que nada escreve.
--
-- `comodatos-fotos` e da EQUIPE inteira na leitura e da gestao na escrita: a
-- foto do estado e a prova dos dois lados, e uma pessoa que nao consegue abrir
-- a foto da entrega dela nao tem como discordar dela.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  insert into storage.buckets (id, name, public)
  values ('comodatos-fotos', 'comodatos-fotos', false)
  on conflict (id) do nothing;

  drop policy if exists "comodatos: a equipe le as fotos" on storage.objects;
  drop policy if exists "comodatos: a gestao escreve as fotos" on storage.objects;
  drop policy if exists "comodatos: a gestao apaga as fotos" on storage.objects;

  execute $politica$
    create policy "comodatos: a equipe le as fotos" on storage.objects
      for select to authenticated
      using (bucket_id = 'comodatos-fotos' and public.is_staff())
  $politica$;

  execute $politica$
    create policy "comodatos: a gestao escreve as fotos" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'comodatos-fotos' and public.is_gestor())
  $politica$;

  execute $politica$
    create policy "comodatos: a gestao apaga as fotos" on storage.objects
      for delete to authenticated
      using (bucket_id = 'comodatos-fotos' and public.is_gestor())
  $politica$;
end;
$bloco$;


-- ---------------------------------------------------------------------------
-- PASSO 14 - A trilha de auditoria (0058)
--
-- `assets` e `asset_loans` entram com as QUATRO operacoes: o sprint pede
-- entrega, aceite, devolucao e baixa na trilha, e a linha de um equipamento
-- carrega VALOR DE AQUISICAO -- o que a deixa exatamente tao sensivel quanto a
-- coisa mais sensivel que tem dentro dela, que e a regra da 0058. Como so o
-- socio le a trilha, a regra desta migration nao tem porta dos fundos.
-- ---------------------------------------------------------------------------
do $bloco$
declare
  t text;
begin
  if not exists (
    select 1 from pg_proc p
     where p.proname = 'registrar_auditoria'
       and p.pronamespace = 'public'::regnamespace
  ) then
    return;
  end if;

  foreach t in array array['assets', 'asset_loans', 'asset_term_template'] loop
    execute format('drop trigger if exists %I on public.%I', 'auditoria_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I '
      || 'for each row execute function public.registrar_auditoria()',
      'auditoria_' || t, t
    );
  end loop;
end;
$bloco$;

notify pgrst, 'reload schema';
