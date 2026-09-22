-- ===========================================================================
-- 0010 - Resumo Semanal
--
-- O registro do que cada pessoa entregou, organizado por SEMANA.
--
-- Era "Diario" e nao funcionava como diario: ninguem abre o sistema todo dia
-- para escrever uma linha. Por semana, o habito cabe -- na sexta, ou na
-- segunda olhando para tras -- e o texto sai mais util, porque uma semana tem
-- forma e um dia solto nao tem.
--
-- O REGISTRO E DA PESSOA. Nao e relatorio para a chefia ler: e a memoria de
-- quem trabalhou, e o Sprint 7 vai usa-la na conversa de desenvolvimento
-- individual. Por isso a RLS e fechada na propria pessoa -- nem a socia le o
-- de outro. Se um dia a agencia quiser que a gestao leia, isso vira uma
-- decisao explicita, com uma policy nova e um aviso na tela; nao pode
-- acontecer por descuido.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================

create table if not exists public.weekly_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- A data do que foi entregue. A SEMANA sai daqui por calculo, e nao e uma
  -- coluna: semana gravada junto com a data e um jeito de as duas
  -- discordarem, e a primeira correcao de data deixaria a entrada na semana
  -- errada para sempre.
  data        date not null default current_date,
  descricao   text not null,
  -- Opcionais, os dois. A entrega pode nao ser de nenhum cliente (uma
  -- reuniao interna, um estudo) e pode nao ter subtarefa correspondente --
  -- muito do que se faz num dia nao vira task.
  client_id   uuid references public.clients (id) on delete set null,
  subtask_id  uuid references public.subtasks (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.weekly_entries is
  'O que cada pessoa entregou, por semana. Privado: so o dono le e escreve.';
comment on column public.weekly_entries.data is
  'A data da entrega. A semana e calculada daqui, nunca gravada.';

create index if not exists weekly_entries_pessoa_idx
  on public.weekly_entries (user_id, data desc);

-- `updated_at` na mao, e nao por gatilho generico: e uma tabela so, e um
-- gatilho a menos e uma peca a menos para entender depois.
create or replace function public.tocar_weekly_entries()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists weekly_entries_tocar on public.weekly_entries;
create trigger weekly_entries_tocar
  before update on public.weekly_entries
  for each row execute function public.tocar_weekly_entries();

alter table public.weekly_entries enable row level security;

drop policy if exists weekly_entries_select on public.weekly_entries;
drop policy if exists weekly_entries_insert on public.weekly_entries;
drop policy if exists weekly_entries_update on public.weekly_entries;
drop policy if exists weekly_entries_delete on public.weekly_entries;

-- Quatro policies, todas com a mesma condicao: e seu.
create policy weekly_entries_select on public.weekly_entries
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy weekly_entries_insert on public.weekly_entries
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_staff());

create policy weekly_entries_update on public.weekly_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy weekly_entries_delete on public.weekly_entries
  for delete to authenticated
  using (user_id = (select auth.uid()));
