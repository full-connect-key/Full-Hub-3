-- ===========================================================================
-- 0160 - AS DEMANDAS NO PORTAL
--
-- Pedido do usuario: "sempre que eu abra uma task, e selecione o cliente, ja
-- apareca um box pro cliente mostrando a task que esta aberta, atualizando as
-- etapas para ele, e que quando a entrega seja feita, o box fique em destaque".
--
-- E FUNCAO `security definer`, E NAO POLICY NOVA EM `tasks`/`subtasks`: abrir
-- as duas tabelas ao cliente entregaria briefing, responsavel, tempo e
-- comentario interno a toda consulta do portal. A funcao devolve SO o que o
-- box mostra -- o nome da demanda, o nome e o estado de cada etapa de primeiro
-- nivel, e se ha material esperando a decisao do cliente. Arquivo nenhum sai
-- daqui: o material continua atras das policies de envio.
--
-- Ficam de fora: rascunho, arquivada, cancelada, o mes de social e a demanda
-- de campanha (as duas tem secao propria no portal), e a concluida ha mais de
-- quatorze dias.
-- ===========================================================================

create or replace function public.demandas_do_portal(p_cliente uuid default null)
returns table (
  task_id     uuid,
  client_id   uuid,
  titulo      text,
  prazo       date,
  concluida   boolean,
  esperando   boolean,
  etapas      jsonb
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
  select
    t.id,
    t.client_id,
    t.titulo,
    t.data_fim::date,
    t.status = 'concluido',
    exists (
      select 1
        from public.approval_rounds r
        join public.subtasks s on s.id = r.content_id
       where r.content_type = 'subtask'
         and r.escopo = 'cliente'
         and r.status = 'pendente'
         and s.task_id = t.id
    ),
    coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'titulo', e.titulo,
                 'estado', case
                   when e.status = 'concluida' then 'concluida'
                   when e.status = 'nao_iniciada' then 'a_fazer'
                   else 'em_andamento'
                 end
               ) order by e.ordem, e.created_at)
        from public.subtasks e
       where e.task_id = t.id
         and e.parent_id is null
    ), '[]'::jsonb)
  from public.tasks t
  where t.publicada_em is not null
    and t.arquivada_em is null
    and t.social_do_mes is null
    and t.status <> 'cancelada'
    and (t.status <> 'concluido' or t.concluida_em > now() - interval '14 days')
    and not exists (select 1 from public.campaigns c where c.task_id = t.id)
    and case
          when p_cliente is not null then t.client_id = p_cliente
          when public.is_staff() then false
          else t.client_id in (select public.my_client_ids())
        end
  order by t.created_at desc
  limit 60;
end;
$func$;

comment on function public.demandas_do_portal(uuid) is
  'As demandas abertas de uma conta, como o portal as mostra (0160): nome, etapas de primeiro nivel e se ha material esperando o cliente. Nada de briefing, responsavel ou arquivo.';

revoke all on function public.demandas_do_portal(uuid) from public;
revoke all on function public.demandas_do_portal(uuid) from anon;
grant execute on function public.demandas_do_portal(uuid) to authenticated;

notify pgrst, 'reload schema';
