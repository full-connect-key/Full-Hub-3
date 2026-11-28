-- ===========================================================================
-- 0163 - O COMENTARIO SE EDITA E GANHA REACAO
--
-- Pedido do usuario: no portal, editar, apagar e reagir a um comentario.
--
--   - APAGAR ja existia na policy (`comments_delete`: o autor ou a gestao) e
--     nao tinha tela. A regra confirmada pelo usuario e essa mesma.
--   - EDITAR e so do autor, e so o TEXTO: o gatilho devolve todo o resto ao
--     valor antigo, porque policy nao limita coluna.
--   - REAGIR e uma tabela propria. Quem ve o comentario ve as reacoes dele --
--     a subconsulta da policy passa pelas policies de `comments`.
-- ===========================================================================

alter table public.comments
  add column if not exists editado_em timestamptz;

drop policy if exists comments_update_do_autor on public.comments;
create policy comments_update_do_autor on public.comments
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create or replace function public.comments_so_muda_o_texto()
returns trigger
language plpgsql
as $func$
begin
  new.id                := old.id;
  new.content_type      := old.content_type;
  new.content_id        := old.content_id;
  new.approval_round_id := old.approval_round_id;
  new.autor_id          := old.autor_id;
  new.resposta_a        := old.resposta_a;
  new.interno           := old.interno;
  new.created_at        := old.created_at;
  new.card_indice       := old.card_indice;
  new.card_versao       := old.card_versao;

  if btrim(coalesce(new.texto, '')) = '' then
    raise exception 'O comentario nao pode ficar vazio.';
  end if;
  if new.texto is distinct from old.texto then
    new.editado_em := now();
  else
    new.editado_em := old.editado_em;
  end if;
  return new;
end;
$func$;

drop trigger if exists comments_so_muda_o_texto on public.comments;
create trigger comments_so_muda_o_texto
  before update on public.comments
  for each row execute function public.comments_so_muda_o_texto();

create table if not exists public.comment_reactions (
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null check (emoji in ('👍', '❤️', '👏', '✅', '👀')),
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

alter table public.comment_reactions enable row level security;

drop policy if exists comment_reactions_select on public.comment_reactions;
create policy comment_reactions_select on public.comment_reactions
  for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));

drop policy if exists comment_reactions_insert on public.comment_reactions;
create policy comment_reactions_insert on public.comment_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.comments c where c.id = comment_id)
  );

drop policy if exists comment_reactions_delete on public.comment_reactions;
create policy comment_reactions_delete on public.comment_reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
