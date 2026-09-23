-- =========================================================================
-- 0015 — A pasta de entrega passa a ser obrigatória
--
-- Toda demanda nova precisa dizer onde o material final vai ficar. Sem isso,
-- o campo vira aquele que ninguém preenche: quem abre a demanda está com
-- pressa, quem procura o material está semanas depois, e as duas pessoas
-- raramente são a mesma.
--
-- POR QUE UM TRIGGER E NÃO `not null`
--
--   `alter table ... alter column link_entrega set not null` quebraria em
--   qualquer ambiente que já tenha task sem link -- e o Full Hub já rodou em
--   desenvolvimento antes desta regra existir. Migration que não roda no
--   próximo ambiente não é migration, é um pedido de intervenção manual.
--
--   Preencher as antigas com um valor qualquer para poder marcar `not null`
--   seria pior: inventaria um endereço que não existe, e alguém clicaria
--   nele.
--
--   O trigger diz exatamente o que se quer dizer: demanda NOVA precisa da
--   pasta, e a pasta de quem já tem não se apaga. As antigas ficam como
--   estão, sem mentir.
-- =========================================================================

create or replace function public.tasks_exige_pasta_de_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.link_entrega is null or btrim(new.link_entrega) = '' then
      raise exception using
        errcode = 'check_violation',
        message = 'Toda demanda precisa da pasta de entrega: onde o material final vai ficar.',
        hint    = 'Cole o endereço da pasta no Figma, no Drive ou onde o material for ficar. Começa com http:// ou https://.';
    end if;
    return new;
  end if;

  -- No UPDATE: quem já tem não perde. Apagar o endereço de uma demanda em
  -- andamento deixa o material sem paradeiro conhecido, e é o tipo de perda
  -- que ninguém percebe na hora -- só quando vai procurar.
  --
  -- Trocar por outro endereço continua valendo: pasta muda de lugar.
  if old.link_entrega is not null
     and (new.link_entrega is null or btrim(new.link_entrega) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'A pasta de entrega não se apaga.',
      hint    = 'Dá para trocar por outro endereço, mas não para deixar a demanda sem paradeiro do material.';
  end if;

  return new;
end
$$;

drop trigger if exists tasks_exige_pasta_de_entrega on public.tasks;
create trigger tasks_exige_pasta_de_entrega
  before insert or update on public.tasks
  for each row
  execute function public.tasks_exige_pasta_de_entrega();

comment on function public.tasks_exige_pasta_de_entrega() is
  'Demanda nova precisa da pasta de entrega, e a pasta de quem já tem não se apaga. Trigger em vez de not null porque as tasks anteriores a esta regra continuam válidas sem link.';
