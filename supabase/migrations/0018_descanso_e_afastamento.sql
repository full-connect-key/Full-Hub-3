-- ===========================================================================
-- 0018 — "descanso" e "afastamento"
--
-- Segunda rodada de vocabulario do Full Days. A 0016 trocou as palavras da
-- CLT por "recesso programado" e "indisponibilidade"; o usuario decidiu, em
-- cima disso, usar DESCANSO e AFASTAMENTO.
--
-- REGISTRO DA DECISAO, para nao ser refeita como se fosse descuido: foi
-- observado que "afastamento" e palavra corrente na CLT e na previdencia
-- (afastamento por doenca, afastamento previdenciario) e que, por isso, ela
-- e mais carregada que "indisponibilidade", nao menos. A decisao foi
-- mantida pelo usuario, que e quem responde pela exposicao.
--
-- Por que existe uma migration para isto: as mensagens destas tres funcoes
-- NASCEM no Postgres e chegam prontas na tela. Elas nao passam pelo mapa de
-- rotulos de `lib/dominio/full-days.ts`, entao trocar la nao as alcanca.
--
-- Este arquivo foi GERADO a partir do corpo da 0016, e nao escrito a mao. Na
-- 0016 a versao manuscrita renomeou um parametro (que `create or replace`
-- recusa) e inventou um nome de funcao que nao existia. Gerando, o corpo e
-- o mesmo e so as frases mudam.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================

create or replace function public.validar_solicitacao()
returns trigger
language plpgsql
as $$
declare
  ano        integer := extract(year from new.data_inicio);
  contratado integer;
  parcelas   integer;
  usado      integer;
  sobrepoe   integer;
begin
  if new.dias_uteis <= 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'O periodo escolhido nao tem nenhum dia util.';
  end if;

  -- Sobreposicao com pedido proprio: vale para os tres tipos. Duas linhas
  -- cobrindo o mesmo dia deixariam a matriz sem saber qual mostrar.
  select count(*) into sobrepoe
    from public.hr_requests r
   where r.user_id = new.user_id
     and r.id is distinct from new.id
     and r.status in ('pendente', 'aprovada')
     and r.data_inicio <= new.data_fim
     and r.data_fim    >= new.data_inicio;

  if sobrepoe > 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Voce ja tem um periodo combinado cobrindo parte dessas datas.';
  end if;

  if new.tipo <> 'ferias' then
    return new;
  end if;

  -- Um descanso atravessando o ano viraria duas contas de saldo diferentes
  -- para o mesmo pedido. Melhor combinar dois.
  if extract(year from new.data_fim) <> ano then
    raise exception using
      errcode = 'check_violation',
      message = 'Um descanso que atravessa o ano precisa ser combinado em dois, um em cada ano.';
  end if;

  select coalesce(dias_ferias_ano, 15), coalesce(max_parcelas_ferias, 2)
    into contratado, parcelas
    from public.team_members where user_id = new.user_id;

  contratado := coalesce(contratado, 15);
  parcelas   := coalesce(parcelas, 2);

  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = new.user_id
     and id is distinct from new.id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and extract(year from data_inicio) = ano;

  if usado + new.dias_uteis > contratado then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Sao %s dias de descanso por ano em contrato. Voce ja tem %s comprometidos em %s, entao sobram %s.',
        contratado, usado, ano, contratado - usado
      );
  end if;

  if (select count(*) from public.hr_requests
       where user_id = new.user_id
         and id is distinct from new.id
         and tipo = 'ferias'
         and status in ('pendente', 'aprovada')
         and extract(year from data_inicio) = ano) >= parcelas then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'O descanso pode ser partido em ate %s vezes por ano, e voce ja usou as %s.',
        parcelas, parcelas
      );
  end if;

  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- 2. O aviso do sino, na resposta
--
-- A decisao continua sendo so do socio -- o que muda e como ela e dita.
-- -------------------------------------------------------------------------

create or replace function public.decidir_solicitacao(
  p_request_id uuid,
  p_decisao    public.hr_status,
  p_motivo     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pedido     public.hr_requests%rowtype;
  quem       uuid := (select auth.uid());
  status_dia public.presenca_status;
  rotulo     text;
begin
  if not public.is_socio() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'So o socio responde aos periodos fora da equipe.';
  end if;

  if p_decisao not in ('aprovada', 'reprovada') then
    raise exception using
      errcode = 'check_violation',
      message = 'A resposta e "de acordo" ou "precisa remarcar".';
  end if;

  select * into pedido from public.hr_requests where id = p_request_id for update;

  if not found then
    raise exception 'Pedido nao encontrado.';
  end if;

  if pedido.status <> 'pendente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Este pedido ja foi respondido.';
  end if;

  update public.hr_requests
     set status            = p_decisao,
         motivo_reprovacao = case when p_decisao = 'reprovada' then p_motivo else null end,
         aprovado_por      = quem,
         decidido_em       = now()
   where id = p_request_id;

  if p_decisao = 'aprovada' then
    status_dia := case pedido.tipo
                    when 'ferias'   then 'ferias'
                    when 'licenca'  then 'licenca'
                    else 'ausente'
                  end::public.presenca_status;

    -- So os dias uteis viram linha. Pintar sabado e feriado na matriz faria a
    -- contagem visual discordar do numero de dias uteis combinado.
    insert into public.team_presence (user_id, data, status, hr_request_id, atualizado_por)
    select pedido.user_id, d.dia::date, status_dia, pedido.id, quem
      from generate_series(pedido.data_inicio, pedido.data_fim, interval '1 day') as d(dia)
     where extract(isodow from d.dia) < 6
       and not exists (select 1 from public.holidays h where h.data = d.dia::date)
    on conflict (user_id, data) do update
      set status         = excluded.status,
          hr_request_id  = excluded.hr_request_id,
          atualizado_por = excluded.atualizado_por;
  end if;

  rotulo := case pedido.tipo
              when 'ferias'  then 'Descanso'
              when 'licenca' then 'Afastamento'
              else 'Ausencia'
            end;

  perform public.notificar(
    pedido.user_id,
    'full_days',
    case when p_decisao = 'aprovada'
      then format('%s combinado', rotulo)
      else format('%s: precisa remarcar', rotulo)
    end,
    case when p_decisao = 'aprovada'
      then format('%s a %s, %s dia(s) util(eis).',
             to_char(pedido.data_inicio, 'DD/MM/YYYY'),
             to_char(pedido.data_fim, 'DD/MM/YYYY'),
             pedido.dias_uteis)
      else coalesce(nullif(btrim(p_motivo), ''), 'Sem motivo registrado.')
    end,
    '/painel/full-days'
  );
end;
$$;

-- -------------------------------------------------------------------------
-- 3. A recusa da matriz
-- -------------------------------------------------------------------------

create or replace function public.proteger_presenca_de_pedido()
returns trigger
language plpgsql
as $$
begin
  if old.hr_request_id is not null
     and new.hr_request_id is not distinct from old.hr_request_id
     and new.status is distinct from old.status then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Este dia veio de um periodo ja combinado. Desfaca o combinado para mudar.';
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- Os comentarios do schema
--
-- Ninguem que usa o sistema os le, mas eles saem em qualquer dump, export ou
-- pericia tecnica -- que e justamente onde o vocabulario antigo faria o
-- estrago que esta migration existe para evitar.
-- -------------------------------------------------------------------------

comment on column public.team_members.dias_ferias_ano is
  'Dias de descanso por ano previstos no contrato desta pessoa. Padrao da casa: 15, em ate 2 parcelas. O nome da coluna e anterior a troca de vocabulario (migration 0016).';

comment on column public.team_members.max_parcelas_ferias is
  'Em quantas vezes o descanso pode ser partido. Padrao da casa: 2.';

comment on table public.hr_requests is
  'Periodos fora combinados: descanso, afastamento e ausencia pontual. So o socio responde.';

comment on table public.team_presence is
  'Um dia de uma pessoa. Linha com hr_request_id veio de periodo combinado e nao se edita na mao.';
