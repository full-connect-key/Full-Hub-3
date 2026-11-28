-- ===========================================================================
-- 0164 - O COMENTARIO APONTA PARA A ARTE, OU PARA UM TRECHO DO TEXTO
--
-- Pedido do usuario: ao comentar, o cliente marca um ponto na arte entregue;
-- quando o material e texto, ele grifa o trecho e comenta.
--
--   marca_x, marca_y  a posicao do ponto, de 0 a 1 sobre a imagem (proporcao,
--                     e nao pixel: a imagem muda de tamanho em cada tela)
--   marca_card        em qual imagem da composicao o ponto esta
--   marca_ref         qual ARQUIVO, quando a entrega tem varios (demanda)
--   trecho            o texto grifado, copiado -- a legenda pode mudar depois,
--                     e o pedido continua dizendo sobre o que era
--
-- O gatilho da 0163 passa a travar tambem estas colunas na edicao.
-- ===========================================================================

alter table public.comments
  add column if not exists marca_x    numeric,
  add column if not exists marca_y    numeric,
  add column if not exists marca_card integer,
  add column if not exists marca_ref  text,
  add column if not exists trecho     text;

alter table public.comments drop constraint if exists comments_marca_coerente;
alter table public.comments add constraint comments_marca_coerente check (
  (marca_x is null and marca_y is null)
  or (marca_x between 0 and 1 and marca_y between 0 and 1)
);

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
  new.marca_x           := old.marca_x;
  new.marca_y           := old.marca_y;
  new.marca_card        := old.marca_card;
  new.marca_ref         := old.marca_ref;
  new.trecho            := old.trecho;

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

notify pgrst, 'reload schema';
