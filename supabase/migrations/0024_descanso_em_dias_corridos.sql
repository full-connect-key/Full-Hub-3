-- ---------------------------------------------------------------------------
-- 0024 - O descanso conta em dias corridos
--
-- Decisao do usuario: o periodo de descanso conta CORRIDO. Quinze dias sao
-- quinze dias de calendario -- sai numa segunda, volta na terceira segunda --,
-- e nao quinze dias uteis, que na pratica seriam tres semanas inteiras.
--
-- Os OUTROS DOIS TIPOS continuam em dias uteis, e nao e inconsistencia: eles
-- nao descontam de saldo nenhum. O numero deles serve para a matriz e para o
-- relatorio dizerem quantos dias de TRABALHO a pessoa ficou fora, e um sabado
-- de ausencia pontual nao e um dia em que alguem deixou de entregar.
--
-- A COLUNA CONTINUA SE CHAMANDO `dias_uteis`, como `dias_ferias_ano` e
-- `saldo_de_ferias()` continuaram depois da troca de vocabulario da 0016. O
-- motivo e o mesmo: renomear coluna em uso e migration arriscada, e ninguem
-- que usa o sistema ve esse nome. O comentario da coluna e quem diz a
-- verdade para quem abrir o schema.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

comment on column public.hr_requests.dias_uteis is
  'Dias que o pedido consome. CORRIDOS quando o tipo e descanso (`ferias`); dias uteis nos outros dois, que nao descontam saldo. O nome ficou de antes da 0024.';


-- ---------------------------------------------------------------------------
-- Quantos dias o pedido vale, por tipo
--
-- Uma funcao so, para a conta nao existir em tres lugares -- a validacao, a
-- pintura da matriz e a action. `stable` e nao `immutable` pela mesma razao de
-- `dias_uteis()`: o resultado depende da tabela de feriados, que muda.
-- ---------------------------------------------------------------------------
create or replace function public.dias_do_pedido(
  p_tipo   public.hr_tipo,
  p_inicio date,
  p_fim    date
)
returns integer
language plpgsql
stable
as $$
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    return 0;
  end if;

  if p_tipo = 'ferias' then
    return (p_fim - p_inicio) + 1;
  end if;

  return public.dias_uteis(p_inicio, p_fim);
end;
$$;

comment on function public.dias_do_pedido(public.hr_tipo, date, date) is
  'Dias que o pedido consome: corridos no descanso, uteis nos outros. E a conta que a tela mostra e que o banco grava.';


-- ---------------------------------------------------------------------------
-- A validacao, com a recusa falando a lingua do tipo
--
-- "O periodo escolhido nao tem nenhum dia util" ficou errado para o descanso:
-- um fim de semana tem dois dias corridos, e a recusa diria uma coisa que o
-- proprio calculo desmente.
-- ---------------------------------------------------------------------------
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
      message = case when new.tipo = 'ferias'
                  then 'O periodo escolhido nao tem nenhum dia.'
                  else 'O periodo escolhido nao tem nenhum dia util.'
                end;
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
        'Sao %s dias de descanso por ano em contrato, contados corridos. Voce ja tem %s comprometidos em %s, entao sobram %s.',
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


-- ---------------------------------------------------------------------------
-- A resposta do socio, pintando o que o tipo pede
--
-- O DESCANSO PINTA TODOS OS DIAS DO PERIODO, inclusive fim de semana e
-- feriado. Antes so os uteis viravam linha, para a contagem visual bater com
-- o numero combinado -- e agora e o contrario: o numero e corrido, entao
-- pular o sabado do meio e que faria a matriz mostrar menos dias do que o
-- pedido diz. De quebra a faixa na matriz fica inteira, que e como um
-- descanso se parece.
--
-- Indisponibilidade e ausencia pontual continuam so nos dias uteis, porque o
-- numero delas continua sendo de dias uteis.
-- ---------------------------------------------------------------------------
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
  corrido    boolean;
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

  corrido := pedido.tipo = 'ferias';

  if p_decisao = 'aprovada' then
    status_dia := case pedido.tipo
                    when 'ferias'   then 'ferias'
                    when 'licenca'  then 'licenca'
                    else 'ausente'
                  end::public.presenca_status;

    insert into public.team_presence (user_id, data, status, hr_request_id, atualizado_por)
    select pedido.user_id, d.dia::date, status_dia, pedido.id, quem
      from generate_series(pedido.data_inicio, pedido.data_fim, interval '1 day') as d(dia)
     where corrido
        or (extract(isodow from d.dia) < 6
            and not exists (select 1 from public.holidays h where h.data = d.dia::date))
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
      then format('%s a %s, %s %s.',
             to_char(pedido.data_inicio, 'DD/MM/YYYY'),
             to_char(pedido.data_fim, 'DD/MM/YYYY'),
             pedido.dias_uteis,
             case when corrido then 'dia(s) corrido(s)' else 'dia(s) util(eis)' end)
      else coalesce(nullif(btrim(p_motivo), ''), 'Sem motivo registrado.')
    end,
    '/painel/full-days'
  );
end;
$$;

notify pgrst, 'reload schema';
