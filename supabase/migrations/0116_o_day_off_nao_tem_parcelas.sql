-- ===========================================================================
-- 0116 - O DAY OFF NAO TEM PARCELAS
--
-- Decisao do usuario, palavra por palavra:
--
--   "esta dizendo '0 dias em 0 de 2 parcelas' mas nao vamos trabalhar nesse
--    esquema de parcelas, o periodo de 15 dias e corrido durante o periodo
--    de 1 ano. Entao tira essa legenda da porcentagem do saldo"
--
-- O que ele viu foi a LEGENDA da barra de uso; o que ela descrevia era uma
-- REGRA, e a regra mora nos dois lados.
--
-- ---------------------------------------------------------------------------
-- TIRAR SO A LEGENDA SERIA A 0029 OUTRA VEZ
--
-- `validar_solicitacao` recusa o terceiro pedido do ciclo desde a 0011, com
-- a frase *"o day off pode ser partido em ate 2 vezes por ciclo de 12 meses,
-- e voce ja usou as 2 deste ciclo"*. Apagando so a linha da tela, a primeira
-- pessoa a tirar tres periodos separados levaria essa recusa -- uma trava
-- citando um esquema que o usuario acabou de dizer que nao existe, vinda de
-- um `insert` que a tela nao sabe mais prever.
--
-- E a licao da 0029 e da 0060 pela enesima vez: desfazer um lado nao desfaz
-- nada. Os dois saem no mesmo commit.
--
-- ---------------------------------------------------------------------------
-- O QUE SAI, E O QUE FICA
--
--   sai    a trava do terceiro pedido, em `validar_solicitacao` (PASSO 1)
--   sai    `parcelas_concedidas()`, que devolvia um LIMITE (PASSO 3)
--   sai    o par de colunas de `descanso_do_ciclo()` (PASSO 2)
--   fica   `parcelas_no_ciclo()` e `parcelas_de_ferias()`
--   fica   `team_members.max_parcelas_ferias`
--
-- **A LINHA QUE SEPARA O QUE SAI DO QUE FICA E "limite" CONTRA "fato".**
-- `parcelas_concedidas()` responde *quantas vezes a pessoa PODE partir*, e
-- depois desta migration isso nao e mais uma pergunta do produto: uma funcao
-- que afirma um limite inexistente e o que alguem reaproveita tres sprints
-- depois achando que ele ainda vale. `parcelas_no_ciclo()` responde *quantos
-- periodos ela JA tirou neste ciclo*, que e um fato sobre o calendario dela
-- e continua verdadeiro -- e e ele que a bateria le.
--
-- **E A COLUNA FICA, ao contrario da decisao da 0023.** Aquela regra e sobre
-- CAMPO -- *"o pior tipo de campo, porque quem responde acha que garantiu
-- alguma coisa"* --, e nao ha campo: nenhuma tela do produto escreve
-- `max_parcelas_ferias`, e a unica que a lia e a que esta migration apaga.
-- O que sobra e uma coluna com default 2 que ninguem preenche e ninguem le,
-- que e `cancelada` em `task_status` visto de outro angulo. Apaga-la custaria
-- o `comment on column` de tres migrations antigas, o rotulo da trilha de
-- auditoria e o tipo -- por zero mudanca de comportamento.
--
-- ---------------------------------------------------------------------------
-- O PASSO 2 E `drop`/`create`, E ISSO DERRUBA OS GRANTS
--
-- `create or replace` nao troca a lista de colunas de um `returns table` --
-- "cannot change return type of existing function" --, e aqui duas colunas
-- saem. Entao e `drop function` primeiro, **e o `revoke`/`grant` da 0085 e
-- repetido inteiro**: sem ele a funcao renasce com o `execute` que o Postgres
-- concede a `public` sozinho, e `anon` passa a poder perguntar o saldo de
-- qualquer pessoa. E a licao da 0097 com `academy_vencidos()`, e a 0107
-- escreveu esse mesmo paragrafo para explicar por que ELA nao precisou do
-- drop.
--
-- ---------------------------------------------------------------------------
-- O QUE SE PERDE, E E CONSEQUENCIA ACEITA POR QUEM DECIDIU
--
-- Nada impede mais quinze pedidos de um dia cada no mesmo ciclo. O que
-- continua de pe e o unico numero que o usuario nomeou: os 15 dias corridos
-- por ciclo de 12 meses, contados de `inicio_do_ciclo()` (0039), restaurados
-- no aniversario e nao acumulados (0085). A sobreposicao com periodo proprio
-- tambem continua recusada, e e ela que pega a duplicata de digitacao.
--
-- Para devolver a regra: o `if` do fim do PASSO 1 esta escrito por extenso
-- no corpo da 0107, e `parcelas_concedidas()` no da 0085.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 - `validar_solicitacao` sem a trava do terceiro pedido
--
-- Copia INTEIRA da versao da 0107, menos a trava e as duas linhas que a
-- serviam. Copia e nao remendo pela razao da 0030: `create or replace` se
-- reescreve a partir do texto de agora e nao avisa quando o texto novo tem
-- menos coisa que o velho -- as travas de sobreposicao, de lancamento
-- retroativo, do primeiro ciclo e do saldo continuam aqui porque estao
-- escritas, nao porque o Postgres as preservou.
-- ---------------------------------------------------------------------------
create or replace function public.validar_solicitacao()
returns trigger
language plpgsql
as $$
declare
  contratado integer;
  usado      integer;
  sobrepoe   integer;
  admissao   date;
  chega_em   date;
  comeca     date;
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
    -- periodo aconteceu de verdade, e recusar o registro nao o desfaz. Depois
    -- da 0085 ele tem um efeito a mais, e e consequencia aceita: um
    -- lancamento de ciclo ANTERIOR nao mexe no saldo de hoje, porque a conta
    -- olha so o ciclo corrente. Ele continua na matriz e no relatorio, que e
    -- onde o historico vive.
    return new;
  end if;

  -- PEDIDO. O caminho de sempre, e as travas de sempre.
  if new.tipo <> 'ferias' then
    return new;
  end if;

  select coalesce(dias_ferias_ano, 15) into contratado
    from public.team_members where user_id = new.user_id;

  contratado := coalesce(contratado, 15);

  -- O PRIMEIRO CICLO NAO CONCEDE NADA (0074), e e por isso que o zero entra
  -- aqui e nao numa multiplicacao: depois da 0085 nao ha o que multiplicar.
  if public.ciclos_de_descanso(new.user_id) = 0 then
    contratado := 0;
  end if;

  comeca := public.inicio_do_ciclo(new.user_id);

  -- O USADO E O DO CICLO CORRENTE, que e a mudanca da 0085. O que a pessoa
  -- tirou no ciclo passado nao conta mais contra ela.
  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = new.user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and id is distinct from new.id
     and (comeca is null or data_inicio >= comeca);

  -- O PRIMEIRO CICLO TEM FRASE PROPRIA (0074). "Voce ja tem 0 comprometidos,
  -- entao sobram 0" e verdade e nao ensina nada: quem le nao sabe se e a
  -- regra, um cadastro errado ou um defeito. A data responde as tres.
  if contratado = 0 then
    chega_em := public.proximo_descanso_em(new.user_id);

    raise exception using
      errcode = 'check_violation',
      message = case when chega_em is null
        then 'O day off e conquistado a cada 12 meses de casa, e esta ficha nao tem data de entrada.'
        else format(
          'O day off e conquistado a cada 12 meses de casa. Os seus primeiros %s dias chegam em %s.',
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
  --
  -- E ELA DIZ "NESTE CICLO" (0085): sem isso, quem tirou dez no ciclo passado
  -- e cinco neste leria "voce ja tem cinco comprometidos" e procuraria os
  -- outros dez. A dica diz quando os dias voltam, que e a pergunta seguinte.
  if usado + new.dias_uteis > contratado then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Sao %s dias de day off por ciclo de 12 meses, contados corridos. Neste ciclo voce ja tem %s comprometidos, entao sobram %s.',
        contratado, usado, contratado - usado
      ),
      hint = case when public.proximo_descanso_em(new.user_id) is null
        then 'O day off nao acumula: a cada 12 meses os dias voltam ao numero do contrato.'
        else format(
          'O day off nao acumula: os %s dias voltam inteiros em %s.',
          contratado, to_char(public.proximo_descanso_em(new.user_id), 'DD/MM/YYYY')
        )
      end;
  end if;

  -- A TRAVA DE PARCELAS SAIU AQUI (0116). Decisao do usuario: *"nao vamos
  -- trabalhar nesse esquema de parcelas, o periodo de 15 dias e corrido
  -- durante o periodo de 1 ano"*. O que restringe continua sendo UM numero --
  -- os 15 dias do ciclo, logo acima --, e em quantas vezes a pessoa os usa
  -- deixou de ser pergunta do produto.

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PASSO 2 - `descanso_do_ciclo()` perde o par de colunas de parcela
--
-- Ela e a porta unica do saldo para a tela desde a 0085, e devolvia oito
-- colunas: as duas ultimas eram o limite e a contagem de parcelas. Com o
-- limite fora do produto, a primeira afirma o que nao existe e a segunda nao
-- tem leitor -- a legenda que o usuario mandou tirar era o unico.
--
-- `drop` antes do `create`, e o `revoke`/`grant` da 0085 repetido inteiro
-- logo abaixo: o paragrafo do cabecalho diz por que.
-- ---------------------------------------------------------------------------
drop function if exists public.descanso_do_ciclo(uuid);

create function public.descanso_do_ciclo(p_user_id uuid)
returns table (
  inicio_do_ciclo       date,
  proximo_em            date,
  ciclos                integer,
  dias_concedidos       integer,
  dias_usados           integer,
  saldo                 integer
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
      message = 'Saldo de day off e da equipe.';
  end if;

  select coalesce(dias_ferias_ano, 15) into por_ciclo
    from public.team_members where user_id = p_user_id;

  return query
  select
    public.inicio_do_ciclo(p_user_id),
    public.proximo_descanso_em(p_user_id),
    public.ciclos_de_descanso(p_user_id),
    -- CONCEDIDOS E O DO CICLO, e nao a soma da vida (0085).
    case when public.ciclos_de_descanso(p_user_id) = 0
      then 0 else coalesce(por_ciclo, 15) end,
    public.descanso_usado_no_ciclo(p_user_id),
    public.saldo_de_ferias(p_user_id);
end;
$$;

revoke all on function public.descanso_do_ciclo(uuid) from public;
grant execute on function public.descanso_do_ciclo(uuid) to authenticated;

comment on function public.descanso_do_ciclo(uuid) is
  'Os numeros do ciclo CORRENTE de day off de uma pessoa, numa ida so: '
  'quando o ciclo comecou, quando os dias voltam, quantos ciclos ela tem, '
  'quantos dias o contrato da, quantos ela ja comprometeu e quantos sobram. '
  'Perdeu o par de colunas de parcela na 0116 -- o day off nao e mais '
  'partido em numero de vezes.';

-- ---------------------------------------------------------------------------
-- PASSO 3 - `parcelas_concedidas()` sai
--
-- Ela devolvia `max_parcelas_ferias` do ciclo corrente, zero no primeiro
-- (0074). Nenhuma das duas respostas decide mais nada, e uma funcao que
-- afirma um limite inexistente e o que alguem reaproveita achando que ele
-- vale -- a decisao da 0023 aplicada a uma funcao.
--
-- `parcelas_no_ciclo()` e `parcelas_de_ferias()` FICAM, e a linha e a do
-- cabecalho: elas contam quantos periodos a pessoa tirou neste ciclo, que
-- continua sendo um fato sobre o calendario dela.
-- ---------------------------------------------------------------------------
drop function if exists public.parcelas_concedidas(uuid);

comment on function public.parcelas_no_ciclo(uuid) is
  'Quantos periodos de day off esta pessoa tirou no ciclo corrente. E um '
  'FATO e nao um limite: a trava do terceiro pedido saiu na 0116, e quem '
  'restringe e o numero de DIAS.';

comment on column public.team_members.max_parcelas_ferias is
  'SEM LEITOR desde a 0116, e e deliberado: o day off deixou de ser partido '
  'em numero de vezes -- "o periodo de 15 dias e corrido durante o periodo '
  'de 1 ano" --, e nenhuma tela do produto jamais escreveu esta coluna. Ela '
  'fica como `cancelada` ficou em `task_status`: o valor existe e nenhum '
  'caminho o produz. Quem restringe e `dias_ferias_ano`.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA (rode depois de aplicar)
--
--   -- devolve 6 colunas, e nenhuma delas diz "parcela":
--   select * from public.descanso_do_ciclo(auth.uid());
--
--   -- nao existe mais:
--   select to_regprocedure('public.parcelas_concedidas(uuid)') is null;
--
--   -- a frase saiu do corpo da trava:
--   select position('pode ser partido' in pg_get_functiondef(
--            'public.validar_solicitacao()'::regprocedure)) = 0;
-- ---------------------------------------------------------------------------
