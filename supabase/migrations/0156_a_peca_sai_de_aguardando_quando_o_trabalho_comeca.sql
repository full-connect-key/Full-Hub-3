-- ===========================================================================
-- 0156 - A PECA SAI DE "AGUARDANDO INFORMACOES" QUANDO O TRABALHO COMECA
--
-- Relato do usuario: "quando vou fazer upload de uma peca de campanha, todas
-- aparecem como aguardando informacoes".
--
-- A CAUSA: `deliverables.status` nasce `aguardando_informacoes` (default da
-- 0033) e NADA o move ate o envio. A unica porta era `moverEntregavel`, uma
-- action que nenhuma tela chama. Entao a peca com a arte ja subida, e com a
-- etapa dela em andamento, continuava dizendo que a agencia espera informacao.
--
-- O status passa a ACOMPANHAR O FATO, por gatilho (a razao da 0045: a etapa e
-- a versao sao escritas por mais de um caminho):
--   * uma versao gravada na peca  -> `em_producao`
--   * a etapa da peca comecou     -> `em_producao`
-- So sai de `aguardando_informacoes`: `stand_by`, `em_aprovacao`, `ajustes`,
-- `aprovado` e `rejeitado` dizem outra coisa e ficam como estao.
--
-- `security definer`: quem move a etapa ou sobe a versao e da equipe, e a
-- escrita no status da peca nao deve depender de uma segunda policy.
-- ===========================================================================

create or replace function public.peca_entra_em_producao()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if tg_table_name = 'deliverable_versions' then
    update public.deliverables d
       set status = 'em_producao'
     where d.id = new.deliverable_id
       and d.status = 'aguardando_informacoes';
  else
    update public.deliverables d
       set status = 'em_producao'
     where d.subtask_id = new.id
       and d.status = 'aguardando_informacoes';
  end if;
  return new;
end;
$func$;

comment on function public.peca_entra_em_producao() is
  'A peca de campanha sai de aguardando_informacoes quando ganha versao ou quando a etapa dela comeca (0156).';

revoke all on function public.peca_entra_em_producao() from public;
revoke all on function public.peca_entra_em_producao() from anon;
revoke all on function public.peca_entra_em_producao() from authenticated;

drop trigger if exists deliverable_versions_poe_em_producao on public.deliverable_versions;
create trigger deliverable_versions_poe_em_producao
  after insert on public.deliverable_versions
  for each row execute function public.peca_entra_em_producao();

drop trigger if exists subtasks_poe_a_peca_em_producao on public.subtasks;
create trigger subtasks_poe_a_peca_em_producao
  after update of status on public.subtasks
  for each row
  when (new.status = 'em_andamento' and old.status is distinct from new.status)
  execute function public.peca_entra_em_producao();

-- As pecas que ja estao nesse estado: tem versao, ou a etapa ja andou.
update public.deliverables d
   set status = 'em_producao'
 where d.status = 'aguardando_informacoes'
   and (
     exists (select 1 from public.deliverable_versions v where v.deliverable_id = d.id)
     or exists (select 1 from public.subtasks s
                 where s.id = d.subtask_id and s.status <> 'nao_iniciada')
   );

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- E A PECA NASCE `em_producao`.
--
-- Mesmo com os gatilhos acima, a peca em que ninguem tocou ainda dizia
-- "aguardando informacoes" -- e era a tela inteira de uma campanha nova
-- afirmando que a agencia espera algo do cliente. Nenhuma tela escreve aquele
-- status numa peca (a unica action que o fazia nao tem chamador), entao toda
-- linha nele veio do default: converter nao desfaz escolha de ninguem.
-- ---------------------------------------------------------------------------
alter table public.deliverables alter column status set default 'em_producao';

update public.deliverables
   set status = 'em_producao'
 where status = 'aguardando_informacoes';

notify pgrst, 'reload schema';
