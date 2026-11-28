-- ===========================================================================
-- 0158 - SUGESTOES PARA O HUB
--
-- Decisao do usuario: "uma aba chamada sugestoes, la em cima do lado de
-- notificacoes, para as pessoas sugerirem mudancas ou coisas necessarias no
-- hub". Quem le: socios e desenvolvedores. O cliente nao sugere, por enquanto.
--
--   * escrever: toda a equipe, no proprio nome;
--   * ler: quem escreveu le a sua, e a gestao le todas;
--   * marcar como vista: a gestao.
--
-- SEM DELETE, e a ausencia e a regra: a sugestao e um registro do que a equipe
-- pediu, e quem a resolveu marca como vista.
-- ===========================================================================
create table if not exists public.sugestoes (
  id         uuid primary key default gen_random_uuid(),
  autor_id   uuid not null references public.profiles(id) on delete cascade,
  texto      text not null check (length(btrim(texto)) between 3 and 4000),
  vista_em   timestamptz,
  vista_por  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.sugestoes is
  'O que a equipe sugere para o Full Hub (0158). A gestao le e marca como vista.';

create index if not exists sugestoes_por_data on public.sugestoes (created_at desc);

alter table public.sugestoes enable row level security;

drop policy if exists sugestoes_insert on public.sugestoes;
create policy sugestoes_insert on public.sugestoes
  for insert to authenticated
  with check (public.is_staff() and autor_id = auth.uid());

drop policy if exists sugestoes_select on public.sugestoes;
create policy sugestoes_select on public.sugestoes
  for select to authenticated
  using (autor_id = auth.uid() or public.is_gestor());

drop policy if exists sugestoes_update on public.sugestoes;
create policy sugestoes_update on public.sugestoes
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- Policy nao limita coluna: a gestao marca como vista, e nao reescreve o que
-- a pessoa sugeriu nem troca o autor.
create or replace function public.sugestao_so_muda_a_vista()
returns trigger
language plpgsql
as $func$
begin
  if new.texto is distinct from old.texto
     or new.autor_id is distinct from old.autor_id
     or new.created_at is distinct from old.created_at then
    raise exception 'A sugestao nao se reescreve.'
      using hint = 'O que muda nela e so a marca de vista.';
  end if;
  return new;
end;
$func$;

drop trigger if exists sugestoes_so_muda_a_vista on public.sugestoes;
create trigger sugestoes_so_muda_a_vista
  before update on public.sugestoes
  for each row execute function public.sugestao_so_muda_a_vista();

notify pgrst, 'reload schema';
