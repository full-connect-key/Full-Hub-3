-- ===========================================================================
-- 0162 - A PECA QUE O CLIENTE NAO VE
--
-- Pedido do usuario: escolher quais etapas da campanha o cliente ve. Cada peca
-- ganha um interruptor, ligado por padrao -- nada muda para as pecas que ja
-- existem. E a POLICY que esconde, e nao a consulta: a peca desligada some do
-- portal inteiro (campanha, aprovacoes, cronograma, biblioteca).
-- ===========================================================================

alter table public.deliverables
  add column if not exists visivel_no_portal boolean not null default true;

comment on column public.deliverables.visivel_no_portal is
  'Falso esconde a peca do portal do cliente, mesmo depois de enviada (0162).';

drop policy if exists deliverables_select_cliente on public.deliverables;
create policy deliverables_select_cliente on public.deliverables
  for select
  using (
    enviado_em is not null
    and visivel_no_portal
    and campaign_id in (
      select c.id
        from public.campaigns c
       where c.client_id in (select public.my_client_ids())
    )
  );

notify pgrst, 'reload schema';
