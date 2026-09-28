-- ---------------------------------------------------------------------------
-- 0074 - OS 15 DIAS CHEGAM NO FIM DO CICLO, E NAO NO COMECO
--
-- Decisao do usuario: *"entrou hj, nn tem dias disponiveis - fez 12 meses,
-- ganha 15 dias, fez 24 meses, ganha mais 15 dias"*.
--
-- E A LEITURA QUE A 0039 REGISTROU E NAO ADOTOU. O comentario dela diz, com
-- todas as letras, que havia duas leituras possiveis de "a cada 12 meses soma
-- 15", que ela escolheu a de conceder na ABERTURA do ciclo, e que **para
-- inverter e aquela linha** -- o `+ 1` de `ciclos_de_descanso()`. E diz mais:
-- que a bateria tinha o cenario que avisaria. Ele avisou; e o que este arquivo
-- responde.
--
-- O QUE MUDA, EM UMA CONTA:
--
--   entrou hoje ....  0 ciclos ....  0 dias .... 0 parcelas
--   11 meses .......  0 ciclos ....  0 dias .... 0 parcelas
--   12 meses .......  1 ciclo ..... 15 dias .... 2 parcelas
--   24 meses .......  2 ciclos .... 30 dias .... 4 parcelas
--   36 meses .......  3 ciclos .... 45 dias .... 6 parcelas
--
-- Antes eram 1/1/2/3/4 ciclos nas mesmas linhas. O saldo corrido continua
-- inteiro: o que sobrou de um ciclo continua valendo no seguinte, e e por isso
-- que `saldo_de_ferias()` nao ganha filtro nenhum aqui.
--
-- E O QUE ISSO CUSTA, QUE FICA ESCRITO PORQUE NAO PODE SUMIR: conceder so
-- quando o ciclo se completa e, ESTRUTURALMENTE, o periodo aquisitivo da CLT.
-- A 0039 ja tinha registrado que o ciclo contado da entrada e mais parecido
-- com ele que o ano civil; esta migration aproxima mais um passo. O
-- vocabulario do modulo reduz a exposicao, a estrutura e o que uma pericia
-- olha, e quem responde por isso decidiu assim mesmo. Quem for mexer nisso de
-- novo, mexa sabendo disso -- e a inversao continua sendo uma linha so.
--
-- A TRAVA NAO PODE SO RECUSAR: ELA PRECISA DIZER QUANDO. Quem entrou ha tres
-- meses e pede descanso levaria "voce ja tem 0 comprometidos, entao sobram 0",
-- que e verdade e nao ensina nada -- a pessoa fica sem saber se e bug, se e
-- cadastro errado ou se e a regra. `proximo_descanso_em()` nasce para a frase
-- poder dizer a data, que e a mesma decisao da recusa da 0023 nomear cada
-- etapa em vez de dizer "ha etapa sem aprovacao".
--
-- O LANCAMENTO RETROATIVO CONTINUA PASSANDO, e nao e descuido: a gestao
-- registra o que ja aconteceu, inclusive o descanso que alguem tirou no
-- primeiro ano por acordo. `validar_solicitacao` ja devolve antes da conta de
-- saldo quando `origem <> 'solicitacao'`, e essa linha fica.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - Os ciclos passam a ser os COMPLETADOS
-- ---------------------------------------------------------------------------

create or replace function public.ciclos_de_descanso(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  ancora date;
begin
  select coalesce(data_admissao, created_at::date) into ancora
    from public.team_members where user_id = p_user_id;

  -- SEM FICHA E ZERO, e nao um. A 0039 devolvia 1 aqui com o argumento de que
  -- "uma ficha incompleta nao pode deixar a pessoa com zero dias" -- que valia
  -- enquanto o primeiro ciclo ja vinha concedido. Agora zero dias e o estado
  -- normal de quem chegou, entao devolver 1 daria a quem nao tem ficha um
  -- ciclo que nem quem tem ficha teria.
  if ancora is null then
    return 0;
  end if;

  -- Entrada com data futura: o relogio nem comecou.
  if ancora > current_date then
    return 0;
  end if;

  -- `age()` E NAO UMA DIVISAO DE DIAS, pela razao que a 0039 escreveu: dividir
  -- a diferenca por 365 erra em todo ano bissexto e em toda ancora de 29 de
  -- fevereiro. Aqui o numero passa a ser exatamente "quantos aniversarios da
  -- entrada ja passaram" -- e e por isso que `inicio_do_ciclo()` pode chamar
  -- esta funcao em vez de repetir a conta, o que ela fazia ate agora.
  return extract(year from age(current_date, ancora))::integer;
end;
$$;

comment on function public.ciclos_de_descanso(uuid) is
  'Quantos ciclos de 12 meses a pessoa JA COMPLETOU desde a entrada. Zero no primeiro ano (0074).';


-- ---------------------------------------------------------------------------
-- PASSO 2 - `inicio_do_ciclo()` deixa de repetir a conta
-- ---------------------------------------------------------------------------

-- Ela calculava os aniversarios por conta propria, com o mesmo `age()`. Com o
-- `+ 1` fora, os dois numeros passaram a ser o MESMO numero -- e duas copias
-- da mesma conta e o lugar onde as duas verdades comecam a divergir.
create or replace function public.inicio_do_ciclo(p_user_id uuid)
returns date
language plpgsql
stable
as $$
declare
  ancora date;
begin
  select coalesce(data_admissao, created_at::date) into ancora
    from public.team_members where user_id = p_user_id;

  if ancora is null then
    return null;
  end if;

  return (ancora + make_interval(years => public.ciclos_de_descanso(p_user_id)))::date;
end;
$$;

comment on function public.inicio_do_ciclo(uuid) is
  'O dia em que o ciclo de 12 meses corrente comecou: o ultimo aniversario da entrada.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Quando chegam os proximos dias
-- ---------------------------------------------------------------------------

-- E O QUE A RECUSA PRECISA DIZER, e tambem o que a tela de quem esta no
-- primeiro ano precisa mostrar no lugar de "0 de 0 dias disponiveis".
--
-- Ela e derivada e nao coluna, pela razao de sempre neste produto: depende do
-- dia de hoje, e uma coluna precisaria de uma rotina noturna para continuar
-- verdadeira -- no dia em que ela nao rodasse, a tela prometeria uma data que
-- ja passou.
create or replace function public.proximo_descanso_em(p_user_id uuid)
returns date
language plpgsql
stable
as $$
declare
  inicio date;
begin
  inicio := public.inicio_do_ciclo(p_user_id);

  if inicio is null then
    return null;
  end if;

  return (inicio + make_interval(years => 1))::date;
end;
$$;

comment on function public.proximo_descanso_em(uuid) is
  'O dia em que o proximo bloco de dias e conquistado: o proximo aniversario da entrada (0074).';


-- ---------------------------------------------------------------------------
-- PASSO 4 - O saldo da tela carrega a data junto
-- ---------------------------------------------------------------------------

-- `drop` e nao `replace`: mudar a lista de colunas de uma funcao `returns
-- table` e mudar o tipo de retorno, e o Postgres recusa o replace com
-- "cannot change return type of existing function".
drop function if exists public.descanso_do_ciclo(uuid);

create or replace function public.descanso_do_ciclo(p_user_id uuid)
returns table (
  inicio_do_ciclo       date,
  proximo_em            date,
  ciclos                integer,
  dias_concedidos       integer,
  dias_usados           integer,
  saldo                 integer,
  parcelas_concedidas   integer,
  parcelas_usadas       integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  por_ciclo integer;
begin
  -- `security definer` e `is_staff()` na porta: a tela de uma pessoa mostra o
  -- saldo dela, e a fila do socio mostra o de quem propos. Sem definer, a
  -- funcao dependeria de `team_members` ser legivel por quem pergunta.
  if not public.is_staff() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Saldo de descanso e da equipe.';
  end if;

  select coalesce(dias_ferias_ano, 15) into por_ciclo
    from public.team_members where user_id = p_user_id;

  return query
  select
    public.inicio_do_ciclo(p_user_id),
    public.proximo_descanso_em(p_user_id),
    public.ciclos_de_descanso(p_user_id),
    coalesce(por_ciclo, 15) * public.ciclos_de_descanso(p_user_id),
    (coalesce(por_ciclo, 15) * public.ciclos_de_descanso(p_user_id))
      - public.saldo_de_ferias(p_user_id),
    public.saldo_de_ferias(p_user_id),
    public.parcelas_concedidas(p_user_id),
    public.parcelas_de_ferias(p_user_id);
end;
$$;

revoke all on function public.descanso_do_ciclo(uuid) from public;
grant execute on function public.descanso_do_ciclo(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 5 - A recusa do primeiro ciclo diz a DATA
-- ---------------------------------------------------------------------------

create or replace function public.validar_solicitacao()
returns trigger
language plpgsql
as $$
declare
  contratado integer;
  parcelas   integer;
  usado      integer;
  sobrepoe   integer;
  admissao   date;
  chega_em   date;
begin
  if new.dias_uteis <= 0 then
    raise exception using
      errcode = 'check_violation',
      message = case when new.tipo = 'ferias'
                  then 'O periodo escolhido nao tem nenhum dia.'
                  else 'O periodo escolhido nao tem nenhum dia util.'
                end;
  end if;

  -- Sobreposicao com registro proprio: vale para os tres tipos e para os dois
  -- caminhos. Duas linhas cobrindo o mesmo dia deixariam a matriz sem saber
  -- qual mostrar -- e num lancamento e quase sempre duplicata de digitacao.
  select count(*) into sobrepoe
    from public.hr_requests r
   where r.user_id = new.user_id
     and r.id is distinct from new.id
     and r.status in ('pendente', 'aprovada')
     and r.data_inicio <= new.data_fim
     and r.data_fim    >= new.data_inicio;

  -- A FRASE MUDA COM O CAMINHO, e nao e capricho: no pedido quem le e a
  -- propria pessoa, no lancamento e a gestao olhando a ficha de outra.
  if sobrepoe > 0 then
    raise exception using
      errcode = 'check_violation',
      message = case when new.origem = 'solicitacao'
                  then 'Voce ja tem um periodo combinado cobrindo parte dessas datas.'
                  else 'Esta pessoa ja tem um periodo combinado cobrindo parte dessas datas.'
                end;
  end if;

  -- ---- daqui para baixo, o que muda entre pedir e lancar ----

  if new.origem <> 'solicitacao' then
    -- LANCAMENTO. Registra o que ja aconteceu, entao a lista de travas e curta.

    if new.data_fim >= current_date then
      raise exception using
        errcode = 'check_violation',
        message = 'Lancamento retroativo e para periodo que ja terminou.',
        hint    = 'Para um periodo que ainda vai acontecer, use a aba Solicitar.';
    end if;

    select data_admissao into admissao
      from public.team_members where user_id = new.user_id;

    if admissao is not null and new.data_inicio < admissao then
      raise exception using
        errcode = 'check_violation',
        message = format(
          'O periodo comeca em %s, antes da entrada da pessoa na equipe (%s).',
          to_char(new.data_inicio, 'DD/MM/YYYY'), to_char(admissao, 'DD/MM/YYYY')
        );
    end if;

    -- Saldo negativo NAO trava o lancamento, e continua sendo escolha: o
    -- periodo aconteceu de verdade, e recusar o registro nao o desfaz. Quem
    -- lanca ve o saldo resultante na tela antes de confirmar. Depois da 0074
    -- isso passou a cobrir tambem o descanso tirado no primeiro ano por
    -- acordo -- que e historico, e historico se registra.
    return new;
  end if;

  -- PEDIDO. O caminho de sempre, e as travas de sempre.
  if new.tipo <> 'ferias' then
    return new;
  end if;

  select coalesce(dias_ferias_ano, 15) into contratado
    from public.team_members where user_id = new.user_id;

  contratado := coalesce(contratado, 15) * public.ciclos_de_descanso(new.user_id);
  parcelas   := public.parcelas_concedidas(new.user_id);

  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = new.user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and id is distinct from new.id;

  -- O PRIMEIRO CICLO TEM FRASE PROPRIA, e e a mudanca de tela desta migration.
  -- "Voce ja tem 0 comprometidos, entao sobram 0" e verdade e nao ensina nada:
  -- quem le nao sabe se e a regra, um cadastro errado ou um defeito. A data
  -- responde as tres de uma vez.
  if contratado = 0 then
    chega_em := public.proximo_descanso_em(new.user_id);

    raise exception using
      errcode = 'check_violation',
      message = case when chega_em is null
        then 'O descanso e conquistado a cada 12 meses de casa, e esta ficha nao tem data de entrada.'
        else format(
          'O descanso e conquistado a cada 12 meses de casa. Os seus primeiros %s dias chegam em %s.',
          coalesce((select dias_ferias_ano from public.team_members where user_id = new.user_id), 15),
          to_char(chega_em, 'DD/MM/YYYY')
        )
      end,
      hint = case when chega_em is null
        then 'Peca a gestao para preencher a data de entrada na ficha.'
        else 'Ausencia pontual e afastamento nao dependem de saldo.'
      end;
  end if;

  -- A FRASE DIZ A CONTA INTEIRA, como a da 0024 dizia: quantos o contrato da,
  -- quantos ja estao comprometidos e quantos sobram. Quem leva um "nao" sem os
  -- tres numeros vai conferir por fora e achar que o sistema errou.
  if usado + new.dias_uteis > contratado then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Sao %s dias de descanso conquistados a cada 12 meses, contados corridos. Voce ja tem %s comprometidos, entao sobram %s.',
        coalesce((select dias_ferias_ano from public.team_members where user_id = new.user_id), 15),
        usado, contratado - usado
      );
  end if;

  if (select count(*) from public.hr_requests
       where user_id = new.user_id
         and tipo = 'ferias'
         and status in ('pendente', 'aprovada')
         and id is distinct from new.id) >= parcelas then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'O descanso pode ser partido em ate %s vezes por ciclo de 12 meses, e voce ja usou as %s que tem.',
        coalesce((select max_parcelas_ferias from public.team_members where user_id = new.user_id), 2),
        parcelas
      );
  end if;

  return new;
end;
$$;
