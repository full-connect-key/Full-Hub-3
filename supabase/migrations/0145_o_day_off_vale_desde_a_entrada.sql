/**
 * O DAY OFF VALE DESDE A ENTRADA, e a palavra "ciclo" sai da tela.
 *
 * Decisao do usuario, em duas frases: *"no day off ta escrito sobre ciclo,
 * pode tirar isso?"* e *"a pessoa pode tirar os 15 dias a partir do momento
 * que ela entra na agencia. mas quando completa 1 ano, a contagem de dias
 * volta para 15 dias"*.
 *
 * ---------------------------------------------------------------------------
 * AS DUAS SAO A MESMA ENTREGA, e e por isso que elas saem juntas: com os 15
 * dias valendo desde a entrada, o estado "primeiro ciclo" deixa de existir --
 * e eram as frases DELE que mais falavam de ciclo na tela ("O day off e
 * conquistado a cada 12 meses de casa", "Os seus primeiros 15 dias chegam
 * em..."). Tirar a palavra sem mudar a regra deixaria a tela muda sobre uma
 * recusa que continuaria acontecendo; mudar a regra sem tirar a palavra
 * deixaria o jargao numa tela que nao precisa mais dele.
 * ---------------------------------------------------------------------------
 *
 * ISTO E UMA REVERSAO DECLARADA DA 0074, E SO DELA. Aquela migration decidiu
 * que o bloco e CONQUISTADO no fim do ciclo -- *"entrou hj, nn tem dias
 * disponiveis - fez 12 meses, ganha 15 dias"*, decisao do mesmo usuario --, e
 * registrou em voz alta que a 0039 tinha escolhido o contrario. O pedido de
 * agora e a terceira volta da mesma pergunta, e fica como reversao e nao como
 * troca silenciosa.
 *
 * A 0085 FICA INTEIRA, e e ela que a segunda frase confirma: os dias NAO
 * acumulam -- *"quando completa 1 ano, a contagem de dias volta para 15"*. Com
 * a 0074 fora e a 0085 de pe, a regra passa a ser uma frase que a pessoa
 * guarda de cabeca: **15 dias desde o primeiro dia, e todo aniversario eles
 * voltam a 15.**
 *
 * ---------------------------------------------------------------------------
 * E NAO SE DEVOLVE O `+ 1` DE `ciclos_de_descanso()`, que e o caminho obvio e
 * esta errado.
 *
 * A 0074 escreveu que *"para inverter era o `+ 1`"*, e aquilo valia no mundo
 * dela. Deixou de valer na MESMA migration: foi ela que fez `inicio_do_ciclo()`
 * chamar esta funcao em vez de repetir a conta --
 * `ancora + ciclos_de_descanso() anos`.
 *
 * Com o `+ 1` de volta, quem entrou ha tres meses teria `ciclos = 1`, e dai
 * `inicio_do_ciclo()` = entrada + 1 ano, **no futuro**. E
 * `descanso_usado_no_ciclo()` filtra `data_inicio >= inicio_do_ciclo`: o day
 * off que a pessoa tirou no mes passado deixaria de contar, o saldo diria 15
 * com cinco ja comprometidos, e ela tiraria vinte. Um numero plausivel e
 * errado, que e o modo de falha desta casa.
 *
 * ENTAO `ciclos_de_descanso()` NAO MUDA UMA LINHA. Ela continua querendo dizer
 * "quantos aniversarios da entrada ja passaram", que e o que `inicio_do_ciclo()`
 * precisa e o que ela sempre disse. O que muda e o SALDO parar de perguntar a
 * ela -- dois ramos, nos dois lugares que os tinham.
 * ---------------------------------------------------------------------------
 *
 * E `inicio_do_ciclo()` E `proximo_descanso_em()` JA RESPONDEM CERTO, sem
 * nenhuma mudanca, e isso foi medido antes de escrever: para quem entrou ha
 * tres meses, `ciclos = 0`, entao o inicio e a DATA DE ENTRADA e o proximo e
 * entrada + 1 ano. Ou seja, o recorte do saldo ja comeca no dia em que a
 * pessoa chegou, e a data em que os dias voltam ja e a que a tela mostra.
 *
 * O QUE A TELA PASSA A DIZER esta em `solicitar.tsx`, e o resumo e: some o
 * estado `primeiroCiclo` inteiro -- com ele somem a frase dos "primeiros
 * dias", o aviso proprio e a barra de uso que nao aparecia --, e as tres
 * frases que diziam "neste ciclo" passam a dizer o numero e a DATA em que ele
 * volta, que e a pergunta seguinte de quem leu o saldo.
 *
 * OS NOMES DO BANCO FICAM COMO ESTAO -- `descanso_do_ciclo()`,
 * `inicio_do_ciclo()`, `descanso_usado_no_ciclo()`, `ciclos_de_descanso()`.
 * E a decisao de `dias_uteis` e de `saldo_de_ferias()` depois da 0016, e a da
 * 0107 com as tres camadas de nome: renomear o que esta em uso e mexer em
 * muito lugar sem nada em troca, e ninguem que usa o sistema ve esses nomes.
 * O pedido e sobre a TELA.
 *
 * AS TRES FUNCOES SAO COPIADAS INTEIRAS, nunca remendadas -- a licao da 0030:
 * `create or replace` se reescreve a partir do texto de agora e nao avisa
 * quando o texto novo tem menos coisa que o velho. Foi assim que a 0030 perdeu
 * o bloco de carimbos de `validar_transicao_de_subtarefa`, e so apareceu na
 * 0052.
 *
 * `por_ciclo` VIRA `por_ano` nas duas funcoes de saldo, e nao e cosmetico: a
 * variavel e local, nao esta em uso em lugar nenhum, e o conceito que ela
 * carrega mudou de nome junto com a regra. De quebra ela da o marcador do
 * `onde-esta-o-banco.sql` por PRESENCA -- nenhuma versao anterior tem a
 * palavra, entao um banco sem este passo responde FALTA em vez de `ok`.
 *
 * SAO TRES PASSOS INDEPENDENTES e cada um tem a linha dele no
 * `onde-esta-o-banco.sql`, pela regra que a 0138 escreveu: o marcador do fim
 * responde se a colagem chegou ao FIM e e cego para a que SALTA um passo. E
 * aqui cada um quebra de um jeito proprio -- sem o 1 a faixa diz "0 de 15",
 * sem o 2 ela diz "0 de 0", e sem o 3 o pedido e RECUSADO com a frase da 0074.
 */

-- ---------------------------------------------------------------------------
-- PASSO 1 -- o saldo para de perguntar quantos aniversarios ja passaram.
-- ---------------------------------------------------------------------------

create or replace function public.saldo_de_ferias(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  por_ano integer;
begin
  select coalesce(dias_ferias_ano, 15) into por_ano
    from public.team_members where user_id = p_user_id;

  if por_ano is null then
    por_ano := 15;
  end if;

  -- O RAMO DO PRIMEIRO ANO SAIU (0145). Ele devolvia
  -- `0 - descanso_usado_no_ciclo()` enquanto a pessoa nao tivesse completado
  -- doze meses, que era a 0074. Hoje os dias valem desde a entrada, entao nao
  -- ha estado em que o bloco ainda nao foi concedido -- e, sem o ramo, a conta
  -- inteira desta funcao e uma linha.
  --
  -- E CONTINUA SENDO `por_ano` E NAO `por_ano * ciclos` (0085): os dias nao
  -- somam de um ano para o outro, eles se RESTAURAM, e o que sobrou do
  -- anterior se perde no aniversario.
  return por_ano - public.descanso_usado_no_ciclo(p_user_id);
end;
$$;

comment on function public.saldo_de_ferias(uuid) is
  'Quantos dias de day off sobram no periodo de 12 meses corrente. Valem desde a entrada (0145) e nao acumulam: a cada aniversario voltam ao numero do contrato (0085).';

-- ---------------------------------------------------------------------------
-- PASSO 2 -- os dias CONCEDIDOS deixam de ser zero no primeiro ano.
-- ---------------------------------------------------------------------------

create or replace function public.descanso_do_ciclo(p_user_id uuid)
returns table (
  inicio_do_ciclo  date,
  proximo_em       date,
  ciclos           integer,
  dias_concedidos  integer,
  dias_usados      integer,
  saldo            integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  por_ano integer;
begin
  -- `security definer` e `is_staff()` na porta: a tela de uma pessoa mostra o
  -- saldo dela, e a fila do socio mostra o de quem propos. Sem definer, a
  -- funcao dependeria de `team_members` ser legivel por quem pergunta.
  if not public.is_staff() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Saldo de day off e da equipe.';
  end if;

  select coalesce(dias_ferias_ano, 15) into por_ano
    from public.team_members where user_id = p_user_id;

  return query
  select
    public.inicio_do_ciclo(p_user_id),
    public.proximo_descanso_em(p_user_id),
    public.ciclos_de_descanso(p_user_id),
    -- CONCEDIDOS E O NUMERO DO CONTRATO, sempre (0145). Ele era
    -- `case when ciclos = 0 then 0` pela 0074, e era esse zero que fazia a
    -- faixa da tela dizer "0 de 0" para quem acabou de entrar.
    --
    -- `ciclos` CONTINUA SAINDO, e nao vira zero morto: quem o le e a tela,
    -- para saber se esta no primeiro periodo -- o que hoje muda uma frase e
    -- nao um direito.
    coalesce(por_ano, 15),
    public.descanso_usado_no_ciclo(p_user_id),
    public.saldo_de_ferias(p_user_id);
end;
$$;

revoke all on function public.descanso_do_ciclo(uuid) from public, anon;
grant execute on function public.descanso_do_ciclo(uuid) to authenticated;

comment on function public.descanso_do_ciclo(uuid) is
  'O retrato do periodo de 12 meses corrente de uma pessoa: quando ele comecou, quando os dias voltam, quantos aniversarios ja passaram, quantos dias o contrato da, quantos ja foram usados e quantos sobram.';

-- ---------------------------------------------------------------------------
-- PASSO 3 -- a recusa do primeiro ano sai, e a do saldo perde o jargao.
--
-- A FUNCAO VEM INTEIRA, que e a licao da 0030. Ela tem seis travas e tres
-- caminhos (o pedido, o lancamento retroativo e os tipos que nao descontam),
-- e as que nao mudam estao aqui palavra por palavra.
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
  volta_em   date;
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
    -- lancamento de um periodo ANTERIOR nao mexe no saldo de hoje, porque a
    -- conta olha so os doze meses correntes. Ele continua na matriz e no
    -- relatorio, que e onde o historico vive.
    return new;
  end if;

  -- PEDIDO. O caminho de sempre, e as travas de sempre.
  if new.tipo <> 'ferias' then
    return new;
  end if;

  select coalesce(dias_ferias_ano, 15) into contratado
    from public.team_members where user_id = new.user_id;

  contratado := coalesce(contratado, 15);

  -- O ZERO DO PRIMEIRO ANO SAIU (0145). Aqui havia
  -- `if ciclos_de_descanso(...) = 0 then contratado := 0`, que era a 0074: a
  -- pessoa recem-chegada entrava nesta funcao com zero dias concedidos e caia
  -- na recusa logo abaixo. Hoje o contrato vale desde a entrada, entao o unico
  -- numero que restringe e o dele.

  comeca := public.inicio_do_ciclo(new.user_id);

  -- O USADO E O DOS DOZE MESES CORRENTES, que e a 0085. O que a pessoa tirou
  -- no periodo passado nao conta mais contra ela.
  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = new.user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and id is distinct from new.id
     and (comeca is null or data_inicio >= comeca);

  -- A RECUSA PROPRIA DO PRIMEIRO ANO SAIU JUNTO (0145). Ela dizia *"O day off
  -- e conquistado a cada 12 meses de casa. Os seus primeiros 15 dias chegam
  -- em DD/MM/AAAA"*, e era a frase mais visivel da 0074 -- a unica que
  -- explicava por que alguem que acabou de entrar nao conseguia pedir nada.
  -- Sem a regra ela nao tem o que explicar, e deixa-la aqui seria uma recusa
  -- que nenhum estado alcanca.
  --
  -- A FICHA SEM DATA DE ENTRADA DEIXOU DE SER UM CASO A PARTE, e isso e
  -- consequencia e nao esquecimento: `inicio_do_ciclo()` devolve nulo,
  -- `comeca` fica nulo, o `where` acima deixa de recortar e o saldo passa a
  -- contar a vida inteira da pessoa contra os 15 do contrato. E o lado seguro
  -- do erro -- ela pede, e no maximo leva a recusa de saldo com os tres
  -- numeros -- em vez de ficar trancada ate alguem preencher a ficha.

  -- A FRASE DIZ A CONTA INTEIRA, como a da 0024 dizia: quantos o contrato da,
  -- quantos ja estao comprometidos e quantos sobram. Quem leva um "nao" sem os
  -- tres numeros vai conferir por fora e achar que o sistema errou.
  --
  -- E ELA NAO DIZ MAIS "POR CICLO DE 12 MESES" NEM "NESTE CICLO" (0145).
  -- Ciclo e palavra de dentro: quem le a recusa precisa de dois fatos, quantos
  -- dias ela tem e quando eles voltam -- e o segundo e a DICA, logo abaixo,
  -- com a data. Era a dica que ja carregava a informacao util; a mensagem
  -- gastava o jargao para dizer o que ela repete.
  if usado + new.dias_uteis > contratado then
    volta_em := public.proximo_descanso_em(new.user_id);

    raise exception using
      errcode = 'check_violation',
      message = format(
        'Sao %s dias de day off, contados corridos. Voce ja tem %s comprometidos, entao sobram %s.',
        contratado, usado, contratado - usado
      ),
      hint = case when volta_em is null
        then 'O day off nao acumula: a cada 12 meses os dias voltam ao numero do contrato.'
        else format(
          'O day off nao acumula: os %s dias voltam inteiros em %s.',
          contratado, to_char(volta_em, 'DD/MM/YYYY')
        )
      end;
  end if;

  -- A TRAVA DE PARCELAS SAIU AQUI (0116). Decisao do usuario: *"nao vamos
  -- trabalhar nesse esquema de parcelas, o periodo de 15 dias e corrido
  -- durante o periodo de 1 ano"*. O que restringe continua sendo UM numero --
  -- os 15 dias do contrato, logo acima --, e em quantas vezes a pessoa os usa
  -- deixou de ser pergunta do produto.

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- CONFERENCIA -- roda junto e nao muda nada.
--
-- As tres perguntas que esta migration existe para virar: o saldo de quem
-- acabou de entrar, os dias concedidos dela, e a ausencia das duas frases de
-- jargao no corpo da trava.
-- ---------------------------------------------------------------------------

do $conf$
declare
  n_saldo   int;
  n_conced  int;
  n_jargao  int;
begin
  select count(*) into n_saldo
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'saldo_de_ferias'
     and pg_get_functiondef(p.oid) like '%por_ano%';

  select count(*) into n_conced
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'descanso_do_ciclo'
     and pg_get_functiondef(p.oid) like '%por_ano%';

  select count(*) into n_jargao
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'validar_solicitacao'
     and pg_get_functiondef(p.oid) like '%por ciclo de 12 meses%';

  raise notice 'saldo_de_ferias ja vale desde a entrada: %', case when n_saldo = 1 then 'sim' else 'NAO' end;
  raise notice 'descanso_do_ciclo concede desde a entrada: %', case when n_conced = 1 then 'sim' else 'NAO' end;
  raise notice 'a recusa ainda diz "por ciclo de 12 meses": %', case when n_jargao = 0 then 'nao' else 'SIM -- o PASSO 3 nao entrou' end;
end
$conf$;
