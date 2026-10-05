-- ===========================================================================
-- 0084 - A ETAPA DO MES TEM PERIODO, E NAO SO O DIA EM QUE VENCE
--
-- Decisao do usuario, continuando a 0083: *"ao inves de quando cada etapa
-- vence, no Social do mes... quero que coloque data de inicio e final da task,
-- que deve se repetir em todos os posts. Entao se a pauta vai comecar no dia
-- X -- essa data vale para todos os posts, e se ela termina no dia Y, isso
-- vale para todos os posts."*
--
-- ---------------------------------------------------------------------------
-- E A 0027 OUTRA VEZ, UM NIVEL ABAIXO
--
-- A etapa de DEMANDA ganhou periodo na 0027, e o argumento esta escrito la:
-- *"duas etapas com o mesmo prazo podem ser uma de tres dias e uma de tres
-- horas -- sem o inicio, quem monta a agenda da semana tem metade da
-- informacao"*. A corrente do social estava no estado anterior a isso: um dia
-- so, o de vencer.
--
-- No mes de social a falta doi mais, e e por isso que ele pediu: a Pauta do
-- mes inteiro nao e um dia, e um BLOCO de trabalho -- "a social media vai ter
-- um dia para fazer a pauta do mes todo" descreve um dia porque era o que
-- cabia na tela; o que ela precisa reservar na agenda e de quando a quando.
-- Com so o fim, a carga daquela pessoa aparece inteira num dia e zero nos
-- outros.
--
-- ---------------------------------------------------------------------------
-- `prazo` CONTINUA SENDO O FIM, e nao vira `data_fim`
--
-- Decisao da 0027, palavra por palavra: *"ele e lido em consulta, trigger,
-- tela e relatorio, e renomear coluna em uso e migration arriscada sem nada em
-- troca"*. Aqui ele e lido pela sexta origem da `calendar_events`, pelo card
-- da corrente, por Minhas Tasks e pela trava da ordem da corrente. Quem diz a
-- verdade para quem abrir o schema e o `comment`.
--
-- ---------------------------------------------------------------------------
-- O CALENDARIO CONTINUA MOSTRANDO SO O FIM, e isso tambem e a 0027
--
-- *"Atraso continua sendo do `prazo`, e o calendario continua mostrando so
-- ele. Comecar tarde nao e atrasar; entregar tarde e. E uma barra por data
-- dobraria os itens do mes."* Vale igual: com doze posts, pintar inicio E fim
-- de cinco etapas poria cento e vinte linhas no mes de uma conta so. A view
-- NAO muda nesta migration, e a ausencia de mudanca e a decisao.
--
-- ---------------------------------------------------------------------------
-- OS DOIS SAO OPCIONAIS, e isso tambem vem da 0027
--
-- *"Quem abre a demanda costuma saber a data de entrega e ainda nao saber
-- quando cada etapa comeca. Exigir as duas faria a pessoa inventar uma."* O
-- diálogo sugere as duas pontas, e quem apagar uma abre o mes com a outra.
--
-- ---------------------------------------------------------------------------
-- `p_prazos` VIRA UM PAR POR ETAPA, e a forma da 0083 e recusada
--
-- Era `{"Pauta": "2026-10-05"}` e passa a ser
-- `{"Pauta": {"inicio": "2026-10-01", "fim": "2026-10-05"}}`. A chave continua
-- sendo o NOME da etapa, pela razao da 0059: Pauta e Programar sao as duas de
-- Social Media, e uma chave por funcao daria as duas o mesmo periodo.
--
-- A data solta e recusada com frase propria, como o numero da 0059 foi na
-- 0083 -- e nao aceita como "so o fim". Aceitar as duas formas seria um
-- normalizador alimentando um parser, e o custo de errar aqui e um mes inteiro
-- aberto com a corrente sem inicio nenhum, que ninguem percebe ate alguem
-- procurar a carga da redatora.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A ponta que faltava
--
-- As etapas que ja existem ficam com `data_inicio` nulo, e e o certo: a 0027
-- decidiu isso para a etapa de demanda e a razao e a mesma -- preencher com o
-- dia 1 do mes inventaria uma data que ninguem combinou, e ela apareceria na
-- tela como se fosse decisao de alguem.
-- ---------------------------------------------------------------------------
alter table public.post_etapas
  add column if not exists data_inicio date;

comment on column public.post_etapas.data_inicio is
  'Quando o trabalho desta etapa comeca. Escolhido ao abrir o mes e igual para '
  'todos os posts dele (0084): a Pauta do mes inteiro comeca num dia e fecha '
  'noutro. Nulo = sem dia de inicio marcado.';

comment on column public.post_etapas.prazo is
  'Quando esta etapa precisa estar pronta -- a ponta FINAL do periodo dela, e '
  'e ela que define atraso. Escolhida ao abrir o mes e igual para todos os '
  'posts dele (0083/0084). Continua se chamando `prazo` e nao `data_fim` pela '
  'razao da 0027: e lido em consulta, trigger, tela e relatorio.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - Periodo invertido nao e periodo
--
-- A forma do `subtasks_periodo` da 0027, letra por letra. Sem o check, "de
-- 20/10 a 05/10" entra calado e aparece na tela como um intervalo negativo que
-- ninguem sabe ler.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'post_etapas_periodo') then
    alter table public.post_etapas
      add constraint post_etapas_periodo
      check (data_inicio is null or prazo is null or data_inicio <= prazo);
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 3 - Abrir o mes recebendo as duas pontas
--
-- Reconstruida a partir da versao da 0083 -- a MAIS NOVA. `create or replace
-- function` reescreve a partir do que se digita, e o que nao for copiado se
-- perde: foi assim que a 0030 perdeu o bloco de carimbos da 0007 e nenhuma
-- subtarefa teve `concluida_em` por duas migrations, sem ninguem notar.
--
-- O que muda em relacao a 0083: `p_prazos` vira um par por etapa, a
-- conferencia passa a olhar as duas pontas, e o `update` final grava as duas.
-- Todo o resto -- a guarda do Atendimento, as linhas de combinacao (0082), o
-- teto de 60, a demanda do mes achada ou criada, a ordem que continua de onde
-- parou, os responsaveis -- e a 0083 letra por letra.
-- ---------------------------------------------------------------------------
create or replace function public.abrir_mes_de_social(
  p_client_id     uuid,
  p_mes           text,
  p_quantidades   jsonb,
  p_responsavel_id uuid default null,
  p_responsaveis  jsonb default '{}'::jsonb,
  p_prazos        jsonb default '{}'::jsonb,
  p_link_entrega  text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  linha     jsonb;
  redes     public.plataforma_social[];
  quantos   integer;
  i         integer;
  criados   integer := 0;
  total     integer := 0;
  primeiro  date;
  ultimo    date;
  empresa   text;
  novo      uuid;
  chave     text;
  par       jsonb;
  comeca    date;
  termina   date;
  anterior  date;
  etapa     record;
  demanda   uuid;
  proxima   integer;
  etiqueta  text;
  nome      text;
  nova_sub  uuid;
  meses     text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
begin
  -- O ATENDIMENTO ABRE O MES (0046): a mesma funcao que `tasks_insert` usa
  -- desde a 0006, e nao uma parecida.
  if not public.is_atendimento() then
    raise exception using
      errcode = 'check_violation',
      -- A FRASE E A DA 0046, PALAVRA POR PALAVRA, e a bateria pegou quando eu
      -- a reescrevi: dois cenarios conferem o texto da recusa, e uma trava que
      -- recusa com outra frase e uma trava que ninguem sabe mais se é a mesma.
      message = 'Abrir o mês de social é do Atendimento, do desenvolvedor ou do sócio.',
      hint    = 'Quem produz recebe os posts; quem os abre é quem responde pelo contrato.';
  end if;

  begin
    primeiro := to_date(p_mes || '-01', 'YYYY-MM-DD');
  exception when others then
    raise exception using
      errcode = 'check_violation',
      message = 'O mês precisa estar no formato AAAA-MM.';
  end;

  ultimo := (primeiro + interval '1 month' - interval '1 day')::date;

  select c.nome_empresa into empresa from public.clients c where c.id = p_client_id;
  if empresa is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Cliente não encontrado.';
  end if;

  -- A FORMA NOVA E UMA LISTA (0082), e a recusa diz isso em vez de estourar
  -- dentro de um `jsonb_array_elements` com uma mensagem sobre tipo de jsonb.
  if p_quantidades is null or jsonb_typeof(p_quantidades) <> 'array' then
    raise exception using
      errcode = 'check_violation',
      message = 'As quantidades vêm como uma lista de combinações de redes.',
      hint    = 'Cada linha é {"redes": ["instagram","facebook"], "quantidade": 12}.';
  end if;

  -- OS PERIODOS SAO CONFERIDOS ANTES DE ABRIR POST NENHUM. A funcao e
  -- transacional, entao recusar no meio tambem desfaria tudo -- mas a
  -- mensagem sairia depois de sessenta inserts, e o custo de conferir cinco
  -- periodos primeiro e zero.
  for chave, par in select key, value from jsonb_each(p_prazos)
  loop
    if not exists (select 1 from public.etapas_padrao_do_social() e where e.nome = chave) then
      raise exception using
        errcode = 'check_violation',
        message = format('A corrente do social não tem etapa chamada "%s".', chave),
        hint    = 'As etapas são Pauta, Conteúdo, Layout, Envio e Programar.';
    end if;

    -- A FORMA DA 0083 -- uma data solta -- E RECUSADA COM FRASE PROPRIA, e nao
    -- aceita como "so o fim": quem cair aqui esta mandando a forma antiga, e
    -- um mes aberto com a corrente sem inicio nenhum nao da erro em lugar
    -- nenhum -- some na carga de quem produz, que e onde ninguem procura.
    if jsonb_typeof(par) <> 'object' then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" precisa do período, e não de uma data só.', chave),
        hint    = 'Cada etapa é {"inicio": "AAAA-MM-DD", "fim": "AAAA-MM-DD"} — as duas pontas, e as duas valem para o mês inteiro.';
    end if;

    begin
      comeca  := nullif(btrim(coalesce(par ->> 'inicio', '')), '')::date;
      termina := nullif(btrim(coalesce(par ->> 'fim', '')), '')::date;
    exception when others then
      raise exception using
        errcode = 'check_violation',
        message = format('As datas da etapa "%s" precisam estar no formato AAAA-MM-DD.', chave);
    end;

    -- PERIODO INVERTIDO NAO E PERIODO, e a tela recusa antes do `check` da
    -- tabela para a mensagem nomear a ETAPA -- "post_etapas_periodo" nao diz
    -- qual das cinco.
    if comeca is not null and termina is not null and comeca > termina then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" terminaria antes de começar.', chave),
        hint    = 'O início vem antes do fim — confira se os dois campos não estão trocados.';
    end if;
  end loop;

  -- A CORRENTE NAO PODE VENCER DE TRAS PARA A FRENTE, e quem responde e o FIM
  -- de cada etapa: e ele que define atraso (0027), e e por ele que a corrente
  -- recusa comecar o Layout antes de o Conteudo fechar (0045). Comparar os
  -- inicios recusaria o normal -- o Layout comeca enquanto o Conteudo ainda
  -- corre, e isso e trabalho em paralelo, nao erro.
  anterior := null;
  for etapa in select e.ordem, e.nome from public.etapas_padrao_do_social() e order by e.ordem
  loop
    termina := nullif(btrim(coalesce(p_prazos -> etapa.nome ->> 'fim', '')), '')::date;
    if termina is not null then
      if anterior is not null and termina < anterior then
        raise exception using
          errcode = 'check_violation',
          message = format('"%s" venceria antes da etapa anterior da corrente.', etapa.nome),
          hint    = 'A ordem é Pauta, Conteúdo, Layout, Envio e Programar — os dias precisam andar na mesma direção.';
      end if;
      anterior := termina;
    end if;
  end loop;

  -- AS LINHAS SAO CONFERIDAS INTEIRAS ANTES DE ABRIR POST NENHUM, pela mesma
  -- razao dos periodos.
  for linha in select * from jsonb_array_elements(p_quantidades)
  loop
    quantos := coalesce((linha ->> 'quantidade')::integer, 0);

    if quantos < 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'Quantidade negativa não abre post nenhum.';
    end if;

    -- UMA LINHA SEM REDE NENHUMA E RECUSADA, e nao ignorada: ignora-la faria
    -- o dialogo prometer doze posts e a funcao devolver zero, sem dizer por
    -- que. So quando ela pede posts -- uma linha zerada e so uma linha que
    -- ninguem preencheu, e o teto de zero total ja responde por ela.
    if quantos > 0 and jsonb_array_length(coalesce(linha -> 'redes', '[]'::jsonb)) = 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'Escolha ao menos uma rede para cada linha.',
        hint    = 'Uma linha com quantidade e sem rede abriria posts que não vão a lugar nenhum.';
    end if;

    total := total + quantos;
  end loop;

  if total = 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Escolha quantos posts abrir.',
      hint    = 'Pelo menos uma rede precisa de um número maior que zero.';
  end if;

  if total > 60 then
    raise exception using
      errcode = 'check_violation',
      message = format('São %s posts de uma vez, e o limite é 60.', total),
      hint    = 'Se o número está certo, abra em duas vezes — assim um zero a mais não vira sessenta posts para apagar.';
  end if;

  -- ------------------------------------------------------------------------
  -- A DEMANDA DO MES: achada ou criada, nunca duplicada
  --
  -- Quem garante a unicidade e o indice `tasks_social_do_mes_unico`, e nao
  -- este `select`: duas abas clicando ao mesmo tempo passam pelas duas
  -- consultas, e a segunda leva a recusa do indice. E a decisao da 0040.
  -- ------------------------------------------------------------------------
  select t.id into demanda
    from public.tasks t
   where t.client_id = p_client_id
     and t.social_do_mes = primeiro;

  if demanda is null then
    if p_link_entrega is null or btrim(p_link_entrega) = '' then
      raise exception using
        errcode = 'check_violation',
        message = 'A demanda do mês precisa da pasta de entrega.',
        hint    = 'O mês de social é uma demanda só, com um post em cada etapa — e toda demanda precisa da pasta onde o material vai ficar. O botão "Criar no Drive" cria a do mês.';
    end if;

    etiqueta := format('Social · %s/%s de %s',
                       meses[extract(month from primeiro)::integer],
                       extract(year from primeiro)::integer,
                       empresa);

    -- NASCE PUBLICADA, e nao como rascunho: rascunho e de quem o criou, e
    -- esconderia da equipe os doze posts que ela acabou de abrir (0051).
    insert into public.tasks (
      client_id, titulo, data_inicio, data_fim, link_entrega,
      social_do_mes, criado_por, publicada_em
    ) values (
      p_client_id, etiqueta, primeiro, ultimo, btrim(p_link_entrega),
      primeiro, (select auth.uid()), now()
    )
    returning id into demanda;
  end if;

  -- A ORDEM CONTINUA DE ONDE PAROU. Abrir o mes em duas vezes acrescenta a
  -- lista em vez de reinicia-la em 1, que poria dois posts na mesma posicao.
  select coalesce(max(s.ordem), 0) into proxima
    from public.subtasks s where s.task_id = demanda;

  for linha in select * from jsonb_array_elements(p_quantidades)
  loop
    quantos := coalesce((linha ->> 'quantidade')::integer, 0);
    continue when quantos = 0;

    -- `distinct` NA LEITURA (0082): a linha vem de um dialogo em que a pessoa
    -- marca caixas, e a trava da tabela fica para quem monta a chamada a mao.
    select array_agg(distinct r::public.plataforma_social order by r::public.plataforma_social)
      into redes
      from jsonb_array_elements_text(linha -> 'redes') as t(r);

    -- O NOME DA COMBINACAO sai das redes, por extenso e na ORDEM DO ENUM
    -- (0082): alfabeticamente o Facebook viria antes do Instagram.
    select string_agg(initcap(r::text), ' + ' order by r)
      into nome
      from unnest(redes) as t(r);

    for i in 1..quantos loop
      insert into public.posts (
        client_id, tema, data_publicacao, plataformas, midia,
        criado_por, responsavel_id
      ) values (
        p_client_id,
        format('%s %s de %s · %s/%s', nome, i, quantos,
               meses[extract(month from primeiro)::integer],
               extract(year from primeiro)::integer),
        null,
        redes,
        'imagem',
        (select auth.uid()),
        p_responsavel_id
      )
      returning id into novo;

      -- A ETAPA DO POST NA DEMANDA DO MES. Sem responsavel e sem prazo: o
      -- trabalho do post sao as cinco etapas da corrente (0061).
      proxima := proxima + 10;
      insert into public.subtasks (task_id, titulo, ordem)
      values (demanda, (select p.tema from public.posts p where p.id = novo), proxima)
      returning id into nova_sub;

      update public.posts set subtask_id = nova_sub where id = novo;

      -- DISTRIBUIR A CORRENTE CONTINUA SENDO DA GESTAO, e por isso este
      -- `update` corre dentro de uma funcao `security definer` mesmo quando
      -- quem chamou e do Atendimento.
      update public.post_etapas e
         set responsavel_id = nullif(p_responsaveis ->> (e.funcao::text), '')::uuid,
             updated_at = now()
       where e.post_id = novo
         and nullif(p_responsaveis ->> (e.funcao::text), '') is not null;

      -- O PERIODO DE CADA ETAPA, igual para todos os posts do mes (0084). E a
      -- frase do usuario em SQL: se a Pauta comeca no dia X, essa data vale
      -- para todos os posts; se termina no dia Y, isso vale para todos.
      update public.post_etapas e
         set data_inicio = nullif(btrim(coalesce(p_prazos -> e.nome ->> 'inicio', '')), '')::date,
             prazo       = nullif(btrim(coalesce(p_prazos -> e.nome ->> 'fim', '')), '')::date,
             updated_at  = now()
       where e.post_id = novo
         and p_prazos ? e.nome;

      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$fn$;

comment on function public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb, jsonb, text) is
  'Abre o mes de social de um cliente: UMA demanda do mes, um post por linha '
  'de combinacao (0082) e a corrente de cinco etapas dentro de cada um, com um '
  'PERIODO por etapa valendo para o mes inteiro (0084). `p_prazos` e '
  '{"Pauta": {"inicio": "2026-10-01", "fim": "2026-10-05"}, ...}.';
