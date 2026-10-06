-- ===========================================================================
-- 0085 - O DESCANSO NAO ACUMULA: OS 15 DIAS SE RESTAURAM A CADA ANIVERSARIO
--
-- Decisao do usuario, mudando a regra da agencia:
--
--   *"A pessoa vai ter 15 dias de descanso, nao acumulativo. A cada 1 ano, se
--   restaura os 15 dias completos, nao se soma. Entao se ela tiver 15 dias de
--   descanso, tirou 5, e venceu um ano de agencia, ela recebe mais 5 dias e
--   volta a ter 15."*
--
-- ---------------------------------------------------------------------------
-- DESFAZ METADE DA 0039, E SO METADE
--
-- A 0039 fez duas coisas: tirou o saldo do ano civil e o pos em ciclos de 12
-- meses contados da ENTRADA da pessoa; e fez o saldo CORRER -- cada ciclo
-- somava 15, e o que sobrava de um continuava no seguinte.
--
-- **A primeira fica inteira.** O ciclo continua sendo da entrada, e e por isso
-- que esta migration e curta: `inicio_do_ciclo()`, `ciclos_de_descanso()` e
-- `proximo_descanso_em()` nao mudam uma linha. O que muda e so a CONTA.
--
-- **A segunda sai.** O saldo passa a ser 15 menos o que foi tirado DENTRO do
-- ciclo corrente, e o que sobrou do anterior se perde no aniversario.
--
-- **E a 0074 tambem fica inteira**, que e a parte que a frase dele nao toca:
-- quem entrou hoje tem ZERO ate o primeiro aniversario. Ele falou em
-- *restaurar*, e restaurar e o que acontece com quem ja tem -- a concessao do
-- primeiro bloco e outra decisao, tomada na 0074 com a frase dele:
-- *"entrou hj, nn tem dias disponiveis - fez 12 meses, ganha 15 dias"*.
--
-- ---------------------------------------------------------------------------
-- O RECORTE E O `data_inicio` DO PEDIDO, e isso evita uma conta dobrada
--
-- Um descanso de 28/10 a 03/11, numa pessoa cujo aniversario e 01/11,
-- atravessa a virada do ciclo. Contar dia a dia o poria em DUAS contas de
-- saldo -- e isso e exatamente o que a 0039 desfez ao tirar a trava do
-- descanso atravessando o ano, com o argumento escrito: *"28/12 a 03/01
-- viravam duas contas de saldo para o mesmo pedido. Agora sao cinco dias."*
--
-- Entao o pedido pertence ao ciclo em que ele COMECA, inteiro. Os dias sao
-- consumidos quando o descanso comeca, que e tambem como a pessoa pensa nele.
--
-- ---------------------------------------------------------------------------
-- O QUE SE PERDE, E E O PONTO DA REGRA
--
-- Quem nao tirou nada num ciclo chega ao aniversario e continua com 15, nao
-- com 30. Isso e a decisao, nao um efeito colateral -- e e dito aqui porque a
-- 0039 tinha escrito o contrario em voz alta, e quem ler as duas precisa saber
-- qual vale.
--
-- **O saldo negativo tambem zera**, e isso e consequencia aceita: o
-- lancamento retroativo pode deixar alguem em -3 num ciclo, e no aniversario
-- ela volta a 15. Cobrar a divida no ciclo seguinte seria acumular o negativo
-- numa regra que acabou de deixar de acumular o positivo -- duas direcoes para
-- a mesma conta.
--
-- ---------------------------------------------------------------------------
-- AS PARCELAS ACOMPANHAM, pela mesma razao
--
-- `max_parcelas_ferias` e "quantas vezes o descanso pode ser partido", e a
-- frase da recusa sempre disse *"por ciclo de 12 meses"*. Com o saldo
-- restaurando e as parcelas acumulando, alguem com tres ciclos poderia partir
-- 15 dias em seis -- o que a propria frase ja negava.
--
-- ---------------------------------------------------------------------------
-- > O QUE ISTO CUSTA, e foi dito a quem decidiu nas duas vezes anteriores:
-- > ciclo de 12 meses contado da entrada, com o bloco concedido ao completa-lo
-- > e PERDIDO se nao usado, e -- estruturalmente -- o desenho do periodo
-- > aquisitivo mais o periodo concessivo da CLT, que e o mais proximo que o
-- > produto chegou dele. A nota do fim da secao do Full Days ja dizia que o
-- > vocabulario reduz o risco e a estrutura e o que uma pericia olha. A
-- > decisao foi tomada assim mesmo, por quem responde pela exposicao. Quem for
-- > mexer nisso de novo, mexa sabendo disso.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O que foi tirado DENTRO do ciclo corrente
--
-- Uma funcao, e nao a mesma consulta copiada nos quatro lugares que precisam
-- dela: o recorte do ciclo e a regra inteira desta migration, e quatro copias
-- sao quatro lugares onde ela pode divergir. E a decisao de `carga_do_dia()`
-- ser a fonte unica desde a 0035.
-- ---------------------------------------------------------------------------
create or replace function public.descanso_usado_no_ciclo(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  comeca date;
  usado  integer;
begin
  comeca := public.inicio_do_ciclo(p_user_id);

  -- SEM FICHA NAO HA CICLO, e o usado e zero: a pessoa tambem nao tem dias
  -- concedidos, entao o saldo sai zero dos dois lados -- que e o certo, e e o
  -- que a recusa da 0074 explica com a frase da data de entrada.
  if comeca is null then
    return 0;
  end if;

  -- `data_inicio >= comeca` E O RECORTE INTEIRO. Ver o cabecalho: o pedido
  -- pertence ao ciclo em que COMECA, e um descanso que atravessa o
  -- aniversario conta uma vez so, no ciclo de onde saiu.
  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = p_user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and data_inicio >= comeca;

  return usado;
end;
$$;

comment on function public.descanso_usado_no_ciclo(uuid) is
  'Quantos dias de descanso a pessoa comprometeu no ciclo de 12 meses corrente '
  '(0085). O pedido pertence ao ciclo em que COMECA -- um descanso que '
  'atravessa o aniversario conta uma vez so.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - Quantas parcelas no ciclo corrente
-- ---------------------------------------------------------------------------
create or replace function public.parcelas_no_ciclo(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  comeca  date;
  quantas integer;
begin
  comeca := public.inicio_do_ciclo(p_user_id);

  if comeca is null then
    return 0;
  end if;

  select count(*) into quantas
    from public.hr_requests
   where user_id = p_user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and data_inicio >= comeca;

  return coalesce(quantas, 0);
end;
$$;

comment on function public.parcelas_no_ciclo(uuid) is
  'Quantas vezes a pessoa partiu o descanso no ciclo corrente (0085). O limite '
  'se restaura com o saldo: "ate N vezes POR CICLO" era o que a recusa ja '
  'dizia antes de a conta acompanhar.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - O saldo para de somar os ciclos
--
-- Reconstruida a partir da versao da 0039 -- a MAIS NOVA desta funcao. A
-- 0074 nao a tocou: ela mexeu em `ciclos_de_descanso()`, e o saldo mudou de
-- valor sem mudar de corpo.
-- ---------------------------------------------------------------------------
create or replace function public.saldo_de_ferias(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  por_ciclo integer;
begin
  select coalesce(dias_ferias_ano, 15) into por_ciclo
    from public.team_members where user_id = p_user_id;

  if por_ciclo is null then
    por_ciclo := 15;
  end if;

  -- O PRIMEIRO CICLO CONTINUA EM ZERO (0074): quem ainda nao completou 12
  -- meses nao tem bloco nenhum para restaurar.
  if public.ciclos_de_descanso(p_user_id) = 0 then
    return 0 - public.descanso_usado_no_ciclo(p_user_id);
  end if;

  -- E AQUI ESTA A MUDANCA INTEIRA: `por_ciclo`, e nao `por_ciclo * ciclos`.
  -- Os dias nao somam de um ciclo para o outro -- eles se RESTAURAM, e o que
  -- sobrou do anterior se perde no aniversario.
  return por_ciclo - public.descanso_usado_no_ciclo(p_user_id);
end;
$$;

comment on function public.saldo_de_ferias(uuid) is
  'Quantos dias de descanso sobram no ciclo de 12 meses CORRENTE. Nao acumula: '
  'a cada aniversario da entrada os dias se restauram ao numero do contrato, e '
  'o que sobrou do ciclo anterior se perde (0085).';


-- ---------------------------------------------------------------------------
-- PASSO 4 - As parcelas tambem param de somar
-- ---------------------------------------------------------------------------
create or replace function public.parcelas_concedidas(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  por_ciclo integer;
begin
  select coalesce(max_parcelas_ferias, 2) into por_ciclo
    from public.team_members where user_id = p_user_id;

  if por_ciclo is null then
    por_ciclo := 2;
  end if;

  if public.ciclos_de_descanso(p_user_id) = 0 then
    return 0;
  end if;

  return por_ciclo;
end;
$$;

comment on function public.parcelas_concedidas(uuid) is
  'Quantas parcelas o ciclo CORRENTE concede -- nao acumula, pela mesma razao '
  'do saldo (0085). Zero no primeiro ciclo (0074).';

-- `parcelas_de_ferias()` PASSA A SER O DO CICLO, e o nome fica: ele e citado
-- na tela e na trava, e renomear funcao em uso e o mesmo risco de renomear
-- coluna em uso (0027) sem nada em troca. O corpo delega, em vez de repetir a
-- consulta -- duas copias do recorte sao duas verdades esperando divergir.
create or replace function public.parcelas_de_ferias(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
begin
  return public.parcelas_no_ciclo(p_user_id);
end;
$$;

comment on function public.parcelas_de_ferias(uuid) is
  'Quantas parcelas a pessoa ja usou NO CICLO CORRENTE (0085). Era na vida ate '
  'a 0039; o nome ficou porque ele e citado na tela e na trava.';


-- ---------------------------------------------------------------------------
-- PASSO 5 - A trava do pedido conta pelo ciclo, e a frase diz a regra nova
--
-- Reconstruida a partir da versao da 0074 -- a MAIS NOVA. `create or replace
-- function` reescreve a partir do que se digita, e o que nao for copiado se
-- perde: foi assim que a 0030 perdeu o bloco de carimbos da 0007.
--
-- O que muda: `contratado` deixa de multiplicar pelos ciclos, `usado` passa
-- pelo recorte do ciclo, e as duas frases de recusa param de dizer
-- "conquistados a cada 12 meses" -- que descrevia a soma. Todo o resto -- a
-- sobreposicao, o caminho do lancamento retroativo, a recusa do primeiro ciclo
-- com a data -- e a 0074 letra por letra.
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

  parcelas := public.parcelas_concedidas(new.user_id);
  comeca   := public.inicio_do_ciclo(new.user_id);

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
  --
  -- E ELA DIZ "NESTE CICLO" (0085): sem isso, quem tirou dez no ciclo passado
  -- e cinco neste leria "voce ja tem cinco comprometidos" e procuraria os
  -- outros dez. A dica diz quando os dias voltam, que e a pergunta seguinte.
  if usado + new.dias_uteis > contratado then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Sao %s dias de descanso por ciclo de 12 meses, contados corridos. Neste ciclo voce ja tem %s comprometidos, entao sobram %s.',
        contratado, usado, contratado - usado
      ),
      hint = case when public.proximo_descanso_em(new.user_id) is null
        then 'O descanso nao acumula: a cada 12 meses os dias voltam ao numero do contrato.'
        else format(
          'O descanso nao acumula: os %s dias voltam inteiros em %s.',
          contratado, to_char(public.proximo_descanso_em(new.user_id), 'DD/MM/YYYY')
        )
      end;
  end if;

  if (select count(*) from public.hr_requests
       where user_id = new.user_id
         and tipo = 'ferias'
         and status in ('pendente', 'aprovada')
         and id is distinct from new.id
         and (comeca is null or data_inicio >= comeca)) >= parcelas then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'O descanso pode ser partido em ate %s vezes por ciclo de 12 meses, e voce ja usou as %s deste ciclo.',
        coalesce((select max_parcelas_ferias from public.team_members where user_id = new.user_id), 2),
        parcelas
      );
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 6 - A tela do saldo passa a dizer o do ciclo
--
-- `drop` e nao `replace`: mudar a lista de colunas de uma funcao `returns
-- table` e mudar o tipo de retorno, e o Postgres recusa o replace com
-- "cannot change return type of existing function". A lista NAO muda aqui --
-- mas `dias_concedidos` e `dias_usados` passam a querer dizer outra coisa, e
-- por isso o corpo inteiro vem junto.
--
-- E O `drop` TEM QUE ESTAR AQUI, nao so no comentario: a primeira versao
-- desta migration escreveu a explicacao e esqueceu a linha, e o banco recusou
-- com exatamente o erro que ela descreve. A lista de colunas e identica a da
-- 0074, entao quem levou a recusa tinha a versao da 0039 -- de sete colunas,
-- sem `proximo_em` -- e a 0074 nao estava aplicada ali.
-- ---------------------------------------------------------------------------
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
    -- CONCEDIDOS E O DO CICLO, e nao a soma da vida (0085).
    case when public.ciclos_de_descanso(p_user_id) = 0
      then 0 else coalesce(por_ciclo, 15) end,
    public.descanso_usado_no_ciclo(p_user_id),
    public.saldo_de_ferias(p_user_id),
    public.parcelas_concedidas(p_user_id),
    public.parcelas_no_ciclo(p_user_id);
end;
$$;

revoke all on function public.descanso_do_ciclo(uuid) from public;
grant execute on function public.descanso_do_ciclo(uuid) to authenticated;

notify pgrst, 'reload schema';
