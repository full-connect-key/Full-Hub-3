-- ===========================================================================
-- 0159 - O RELATORIO EM BLOCOS
--
-- Decisao do usuario: o relatorio do social deixa de ser uma grade de metricas
-- por mes (0150) e passa a ser o que a agencia ja entrega em apresentacao --
-- destaques em numero grande, os posts que mais renderam, textos de leitura,
-- referencias, e SEMPRE um grafico de crescimento contra o mes anterior.
--
-- `blocos` e jsonb, e nao uma tabela por tipo de bloco: o relatorio e lido e
-- gravado INTEIRO, a ordem dos blocos e a ordem do array, e um tipo novo de
-- bloco nao pede migration. A forma de cada bloco mora em
-- `src/lib/dominio/relatorios.ts`.
--
-- O CLIENTE SO LE O PUBLICADO, e isso mora na policy, nao na consulta.
-- ===========================================================================

create table if not exists public.relatorios (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  titulo          text not null check (length(btrim(titulo)) > 0),
  subtitulo       text,
  periodo_inicio  date not null,
  periodo_fim     date not null,
  blocos          jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(blocos) = 'array'),
  publicado_em    timestamptz,
  criado_por      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (periodo_fim >= periodo_inicio)
);

create index if not exists relatorios_da_conta
  on public.relatorios (client_id, periodo_inicio desc);

alter table public.relatorios enable row level security;

drop policy if exists relatorios_equipe_le on public.relatorios;
create policy relatorios_equipe_le on public.relatorios
  for select to authenticated
  using (public.is_staff());

drop policy if exists relatorios_cliente_le_o_publicado on public.relatorios;
create policy relatorios_cliente_le_o_publicado on public.relatorios
  for select to authenticated
  using (publicado_em is not null and client_id in (select public.my_client_ids()));

drop policy if exists relatorios_equipe_cria on public.relatorios;
create policy relatorios_equipe_cria on public.relatorios
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists relatorios_equipe_edita on public.relatorios;
create policy relatorios_equipe_edita on public.relatorios
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists relatorios_gestao_apaga on public.relatorios;
create policy relatorios_gestao_apaga on public.relatorios
  for delete to authenticated
  using (public.is_gestor());

create or replace function public.relatorios_marca_a_edicao()
returns trigger
language plpgsql
as $func$
begin
  new.updated_at := now();
  return new;
end;
$func$;

drop trigger if exists relatorios_marca_a_edicao on public.relatorios;
create trigger relatorios_marca_a_edicao
  before update on public.relatorios
  for each row execute function public.relatorios_marca_a_edicao();

notify pgrst, 'reload schema';
