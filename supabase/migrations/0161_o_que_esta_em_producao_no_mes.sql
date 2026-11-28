-- ===========================================================================
-- 0161 - O QUE ESTA EM PRODUCAO NO MES, PARA O CLIENTE
--
-- Pedido do usuario: o cliente ve a peca desde que a producao comeca. A
-- policy `posts_select_cliente` so entrega o que foi ENVIADO, e continua
-- assim: arte, legenda e link ficam atras do envio. Esta funcao devolve so o
-- TEMA, a data e o formato do que a agencia esta produzindo -- o bastante
-- para a faixa "em producao" da tela do mes, sem material nenhum.
-- ===========================================================================

create or replace function public.posts_em_producao_do_portal(
  p_mes     date,
  p_cliente uuid default null
)
returns table (
  post_id          uuid,
  client_id        uuid,
  tema             text,
  data_publicacao  date,
  formato          text
)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  if not public.is_staff() and p_cliente is not null
     and p_cliente not in (select public.my_client_ids()) then
    return;
  end if;

  return query
  select p.id, p.client_id, p.tema, p.data_publicacao, p.formato
    from public.posts p
   where p.enviado_em is null
     and p.status in ('aguardando_informacoes', 'em_producao')
     and p.data_publicacao >= date_trunc('month', p_mes)::date
     and p.data_publicacao <  (date_trunc('month', p_mes) + interval '1 month')::date
     and case
           when p_cliente is not null then p.client_id = p_cliente
           when public.is_staff() then false
           else p.client_id in (select public.my_client_ids())
         end
   order by p.data_publicacao, p.created_at
   limit 100;
end;
$func$;

comment on function public.posts_em_producao_do_portal(date, uuid) is
  'Os conteudos do mes que ainda nao foram enviados ao cliente (0161): so tema, data e formato. A arte continua atras do envio.';

revoke all on function public.posts_em_producao_do_portal(date, uuid) from public;
revoke all on function public.posts_em_producao_do_portal(date, uuid) from anon;
grant execute on function public.posts_em_producao_do_portal(date, uuid) to authenticated;

notify pgrst, 'reload schema';
