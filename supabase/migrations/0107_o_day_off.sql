-- ===========================================================================
-- 0107 - "Descanso" passa a se chamar DAY OFF
--
-- Decisao do usuario, palavra por palavra:
--
--   "dentro do Day Off mudar o nome o tipo de solicitacao 'Descanso' por
--    'Day off' tambem. vamos usar sempre essa nomenclatura para tudo que se
--    refere as 'ferias' (que tambem nao podemos falar) OU SEJA, os dias
--    tirados sao DAY OFF"
--
-- E A TERCEIRA RODADA DE VOCABULARIO DESTE MODULO, e as duas primeiras estao
-- no cabecalho da 0016 e no da 0018: "ferias" virou "recesso programado"
-- (0016) e "recesso programado" virou "descanso" (0018). A razao das duas era
-- exposicao juridica -- a equipe e toda PJ, e palavra da CLT num sistema da
-- propria contratante e prova documental. Esta e diferente: "descanso" nao e
-- palavra da CLT, e o que o usuario esta pedindo e que o produto chame a
-- coisa pelo nome do modulo, que e o nome que a agencia usa falando.
--
-- POR QUE ISTO E MIGRATION, E NAO UMA TROCA DE ROTULO NA TELA.
--
-- `ROTULOS_DE_TIPO` em `lib/dominio/full-days.ts` e a porta por onde passa
-- TODO rotulo de tela do modulo -- e e por isso que a 0016 e a 0018 couberam
-- num arquivo. As frases que NASCEM NO POSTGRES nao passam por ele: chegam
-- prontas, e `atualizarSolicitacao` as mostra como vieram. Sao seis frases
-- de recusa em `validar_solicitacao`, uma em `descanso_do_ciclo` e o titulo
-- do sino que `decidir_solicitacao` monta. Trocar so a tela deixaria a
-- pessoa lendo "Day off" no seletor e "O descanso nao acumula" na recusa do
-- clique seguinte, a dois centimetros de distancia.
--
-- SAO TRES CAMADAS DE NOME AGORA, e isso fica dito em vez de escondido:
--
--   enum/coluna   `ferias`, `dias_ferias_ano`, `saldo_de_ferias()`
--   funcao/tipo   `descanso_do_ciclo()`, `DescansoDoCiclo`, `DIAS_DE_DESCANSO_PADRAO`
--   tela          "Day off"
--
-- Tres e uma a mais do que seria confortavel, e a escolha e a mesma que a
-- 0016 fez e a 0018 repetiu: renomear valor de enum, coluna ou funcao em uso
-- e migration arriscada sem nada em troca, e ninguem que usa o sistema ve
-- esses nomes. O que muda e o que a pessoa LE.
--
-- E "DESCANSO" NAO ENTRA NA LISTA DE NOMES MORTOS DO `check:cores`, ao
-- contrario de "recesso" e "indisponibilidade". A lista daquela varredura
-- CRESCE de proposito -- nenhuma geracao de palavra pode voltar --, e a
-- diferenca aqui e que esta palavra NAO foi aposentada: ela continua sendo o
-- nome da camada do meio, em `descanso_do_ciclo()`, `ciclos_de_descanso()`,
-- `proximo_descanso_em()`, `descanso_usado_no_ciclo()`, `DescansoDoCiclo` e
-- `DIAS_DE_DESCANSO_PADRAO`, todos lidos de dentro de `src/`. Por-la na lista
-- exigiria `salvo` para metade do modulo, e uma excecao que cobre metade do
-- modulo e onde o furo seguinte se esconde. Quem protege a troca e o
-- `check:sprint9`, que le o TEXTO RENDERIZADO do prototipo: ali comentario e
-- identificador nao contam, e a medicao e de mao dupla -- "Day off" de pe e
-- "Descanso" fora.
--
-- O QUE NAO MUDA:
--
--   * `proteger_presenca_de_pedido` nao nomeia o tipo -- ela fala de "periodo
--     ja combinado", que serve aos tres. Nao e reescrita aqui.
--   * os rotulos de `licenca` e `ausencia` ficam como a 0018 os deixou:
--     Afastamento e Ausencia pontual.
--   * `feriado` fica, e a diferenca importa: feriado e data do calendario
--     nacional, um fato sobre o dia, e nao direito concedido a ninguem.
--   * as frases que nao nomeiam o tipo -- "O periodo escolhido nao tem nenhum
--     dia", "So o socio responde aos periodos fora da equipe" -- ficam
--     exatamente como estavam. Padronizar e fazer o nome ser um so, nao
--     trocar o nome de tudo (0092).
--
-- AS TRES FUNCOES SAO COPIADAS INTEIRAS, e nao remendadas: `create or replace
-- function` se reescreve a partir do texto que se escreve AGORA, e nao avisa
-- quando o texto novo tem menos coisa que o velho. Foi assim que a 0030
-- perdeu o bloco de carimbos de `validar_transicao_de_subtarefa` e o contador
-- de concluidas do mes passou a responder zero por cinco sprints -- um numero
-- plausivel, que e o pior jeito de um numero estar errado.
-- `validar_solicitacao` e `descanso_do_ciclo` vem da 0085;
-- `decidir_solicitacao` vem da 0024.
--
-- A bateria guarda as frases nos DOIS sentidos, em `05_full_days.sql`: as
-- antigas tem de estar ausentes do corpo das funcoes e as novas tem de estar
-- presentes. Sem a segunda metade, apagar a mensagem inteira passaria por uma
-- varredura que so procura o que saiu.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - As seis frases das recusas do pedido
--
-- Copia integral da versao da 0085, com a palavra trocada nas mensagens e nas
-- dicas. Nada mais muda: a conta do ciclo, o recorte pelo `data_inicio`, a
-- frase do primeiro ciclo e a ordem das travas ficam como estavam.
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

  if (select count(*) from public.hr_requests
       where user_id = new.user_id
         and tipo = 'ferias'
         and status in ('pendente', 'aprovada')
         and id is distinct from new.id
         and (comeca is null or data_inicio >= comeca)) >= parcelas then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'O day off pode ser partido em ate %s vezes por ciclo de 12 meses, e voce ja usou as %s deste ciclo.',
        coalesce((select max_parcelas_ferias from public.team_members where user_id = new.user_id), 2),
        parcelas
      );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PASSO 2 - A recusa da leitura do saldo
--
-- `create or replace` e nao `drop`/`create` como a 0085 fez: la a lista de
-- colunas do `returns table` mudava de significado e o Postgres recusa o
-- replace com "cannot change return type of existing function". Aqui a
-- assinatura e a lista sao as mesmas -- muda uma string --, entao o replace
-- passa e os grants da 0085 ficam de pe. Um `drop` aqui os derrubaria, e a
-- funcao renasceria com o `execute` que o Postgres concede a `public`
-- sozinho: e a licao da 0097 com `academy_vencidos()`.
-- ---------------------------------------------------------------------------
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
    public.saldo_de_ferias(p_user_id),
    public.parcelas_concedidas(p_user_id),
    public.parcelas_no_ciclo(p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- PASSO 3 - O titulo do sino
--
-- "Day off combinado" e "Day off: precisa remarcar". Ja mudou DUAS vezes
-- antes desta: "Ferias aprovada" virou "Recesso combinado" na 0016 e
-- "Descanso combinado" na 0018. O corpo da mensagem -- as duas datas e a contagem -- nao e tocado,
-- e nem a conta de `corrido`, que e a regra da 0024: day off conta dias
-- corridos, os outros dois contam dias uteis.
--
-- Copia integral da versao da 0024.
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
              when 'ferias'  then 'Day off'
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

-- ---------------------------------------------------------------------------
-- PASSO 4 - Os comentarios do schema que NOMEIAM o tipo
--
-- Ninguem que usa o sistema os le, mas eles saem em qualquer dump ou export,
-- e sao a unica coisa que diz a quem abre o schema o que a coluna quer dizer.
-- Os TRES abaixo nomeiam o tipo que a tela mostra -- um deles lista os tres
-- tipos, lado a lado --, e deixa-los dizendo "descanso" mandaria quem os
-- lesse procurar na interface uma palavra que ela nao tem mais.
--
-- OS OUTROS NAO SAO TOCADOS, e e decisao: os comentarios de
-- `descanso_usado_no_ciclo()`, `parcelas_no_ciclo()`, `saldo_de_ferias()`,
-- `ciclos_de_descanso()` e `team_members.data_admissao` descrevem A CONTA,
-- cujas funcoes continuam se chamando `descanso_*` -- eles estao na camada do
-- meio, e sao coerentes com o nome que carregam. Reescreve-los faria o
-- comentario falar de "day off" ao lado de uma funcao chamada "descanso", que
-- e pior que o nome antigo coerente.
-- ---------------------------------------------------------------------------

comment on table public.hr_requests is
  'Periodos fora combinados: day off, afastamento e ausencia pontual. So o socio responde. "Day off" e a terceira rodada de vocabulario (0107); os nomes de coluna e de funcao sao anteriores a ela.';

comment on column public.team_members.dias_ferias_ano is
  'Dias de DAY OFF concedidos A CADA CICLO DE 12 MESES contado da entrada da pessoa (padrao 15). Nao acumula: a cada ciclo os dias voltam a este numero (0085). O nome da coluna e anterior as trocas de vocabulario (0016, 0018 e 0107).';

comment on column public.team_members.max_parcelas_ferias is
  'Em quantas vezes o day off de cada ciclo de 12 meses pode ser partido (padrao 2). O nome da coluna e anterior as trocas de vocabulario.';


-- ---------------------------------------------------------------------------
-- A CONFERENCIA
--
-- Esperado: 0 | 6 | 1 | 1 -- nenhuma frase antiga de pe nas tres funcoes, as
-- seis frases novas, a recusa do saldo e o titulo do sino.
-- ---------------------------------------------------------------------------
--
-- select
--   (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname in ('validar_solicitacao', 'decidir_solicitacao', 'descanso_do_ciclo')
--       and (position('O descanso' in p.prosrc) > 0
--         or position('dias de descanso' in p.prosrc) > 0
--         or position('Saldo de descanso' in p.prosrc) > 0
--         or position('then ''Descanso''' in p.prosrc) > 0)) as frases_antigas,
--   (select count(*) from regexp_matches(
--      (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'validar_solicitacao'),
--      'day off', 'g')) as recusas_novas,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname = 'descanso_do_ciclo'
--       and position('Saldo de day off' in p.prosrc) > 0) as saldo,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname = 'decidir_solicitacao'
--       and position('then ''Day off''' in p.prosrc) > 0) as sino;

notify pgrst, 'reload schema';
