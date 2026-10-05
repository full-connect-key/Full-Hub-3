-- ===========================================================================
-- 0082 - O POST VAI PARA MAIS DE UMA REDE
--
-- Decisao do usuario: *"na hora de abrir social, permita juntar duas redes
-- sociais, ja que tudo que postamos no Instagram postamos no Facebook"*.
--
-- ---------------------------------------------------------------------------
-- A FRASE DELE DESCREVE UM POST, E NAO DOIS
--
-- "tudo que postamos no Instagram postamos no Facebook" nao e um post de
-- Instagram mais um post de Facebook: e a MESMA peca, com a mesma arte, a
-- mesma legenda e uma decisao so do cliente, indo para dois lugares. Por isso
-- a coluna vira lista -- e por isso abrir doze no Instagram junto com o
-- Facebook abre DOZE posts, nao vinte e quatro.
--
-- A leitura contraria -- abrir os dois lados de uma vez, pareados -- custaria
-- ao cliente aprovar duas vezes a mesma arte, e a agencia manter duas
-- correntes de cinco etapas para um trabalho que aconteceu uma vez. E a conta
-- da 0022: quem tem filha vira agrupadora porque senao tudo conta duas vezes.
--
-- ---------------------------------------------------------------------------
-- `plataforma` E APAGADA, E NAO APOSENTADA
--
-- Decisao da 0023, que apagou `tasks.exigencia_aprovacao` em vez de deixa-la
-- parada. Uma coluna singular ao lado da lista seria "a rede principal" --
-- dois lugares para o mesmo fato, reescritos por caminhos diferentes, e no
-- dia em que um deles falhasse o selo do card e o filtro da tela discordariam
-- sobre o mesmo post. O caso oposto, `cancelada` no enum de status, so ficou
-- porque `alter type ... drop value` nao existe no Postgres. Coluna sai.
--
-- O CUSTO ESTA DITO: e a coluna mais lida do modulo -- o selo do card, a
-- celula do calendario, a grade do feed, o filtro do portal, a busca global e
-- a bateria inteira do social passam por ela. Nenhuma dessas leituras fica
-- ambigua depois: `plataformas` responde a mesma pergunta com um `=` a mais.
--
-- ---------------------------------------------------------------------------
-- O ARRAY E `not null` COM `check` DE NAO-VAZIO, e as duas coisas importam
--
-- `not null` sozinho deixa passar `'{}'`, que e um post que nao vai a lugar
-- nenhum -- e o modo de falha e o da 0048, onde o array vazio foi usado como
-- sinal e apagou arte: vazio nunca quer dizer nada aqui, quer dizer que
-- alguem esqueceu. A tela entao desenharia um card sem rede, o filtro nunca o
-- acharia, e a grade do feed o deixaria de fora de todas as redes.
--
-- ---------------------------------------------------------------------------
-- E A REDE NAO SE REPETE DENTRO DA LISTA
--
-- `[instagram, instagram]` desenharia o selo duas vezes no mesmo card e faria
-- a contagem por rede do mes somar o mesmo post duas vezes.
--
-- E `check` e nao trigger porque nao ha nada a reescrever: e erro de quem
-- escreveu, nao estado a normalizar. Mas a pergunta nao cabe num `check`
-- escrito direto -- `cardinality(array(select distinct unnest(...)))` e uma
-- SUBCONSULTA, e o Postgres recusa subconsulta em check constraint com
-- *"cannot use subquery in check constraint"*. Dai `redes_sem_repeticao()`:
-- a mesma pergunta, num lugar so, do jeito que o banco aceita.
--
-- ---------------------------------------------------------------------------
-- `p_quantidades` TROCA DE FORMA, e a antiga nao fica
--
-- Era um OBJETO -- `{"instagram": 12, "linkedin": 4}` --, e um objeto nao tem
-- como expressar combinacao: a chave e uma rede so. Passa a ser uma LISTA de
-- linhas, `[{"redes": [...], "quantidade": N}]`, que e exatamente o que o
-- dialogo mostra.
--
-- Aceitar as duas formas seria um normalizador alimentando um parser, e o
-- objeto e justamente a forma que nao sabe dizer o que este sprint existe
-- para dizer. O tipo do parametro continua `jsonb`, entao a assinatura NAO
-- muda e nao nasce uma segunda funcao ao lado -- a pegadinha que a 0061
-- registrou e que ja custou um "Could not find the function" ao usuario.
--
-- ---------------------------------------------------------------------------
-- O TEMA DE UM POST DE UMA REDE SO NAO MUDA
--
-- Continua "Instagram 1 de 12 · Outubro/2026"; com duas vira "Instagram +
-- Facebook 1 de 12 · Outubro/2026". Nao e enfeite: os cenarios da bateria que
-- conferem o tema de um mes de uma rede so continuam valendo palavra por
-- palavra, e um deles falharia se eu trocasse o separador por capricho.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A coluna nova, preenchida a partir da antiga
--
-- Nasce com default `'{}'` para a tabela existente aceitar o `not null`, e o
-- default SAI logo depois: deixa-lo seria oferecer o vazio que o `check`
-- recusa -- um insert sem a coluna estouraria na trava em vez de no `not
-- null`, com a mensagem errada.
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists plataformas public.plataforma_social[]
    not null default '{}';

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'posts'
                and column_name = 'plataforma') then
    execute $q$
      update public.posts
         set plataformas = array[plataforma]
       where cardinality(plataformas) = 0
    $q$;
  end if;
end
$$;

alter table public.posts alter column plataformas drop default;

comment on column public.posts.plataformas is
  'As redes em que este post vai ao ar (0082). E uma lista porque a mesma '
  'peca costuma sair no Instagram e no Facebook: uma arte, uma legenda e uma '
  'decisao do cliente, em dois lugares.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - As duas travas
--
-- `immutable` e obrigatorio para a funcao poder entrar num check constraint,
-- e e verdade: a resposta depende so do argumento.
-- ---------------------------------------------------------------------------
create or replace function public.redes_sem_repeticao(p_redes public.plataforma_social[])
returns boolean
language plpgsql
immutable
as $$
declare
  distintas integer;
begin
  if p_redes is null then
    return true;
  end if;
  select count(distinct r) into distintas from unnest(p_redes) as t(r);
  return distintas = cardinality(p_redes);
end;
$$;

comment on function public.redes_sem_repeticao(public.plataforma_social[]) is
  'A lista de redes de um post nao repete nenhuma (0082). E funcao porque o '
  'Postgres recusa subconsulta dentro de check constraint.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_plataformas_nao_vazia') then
    alter table public.posts
      add constraint posts_plataformas_nao_vazia
      check (cardinality(plataformas) > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'posts_plataformas_sem_repeticao') then
    alter table public.posts
      add constraint posts_plataformas_sem_repeticao
      check (public.redes_sem_repeticao(plataformas));
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 3 - A coluna antiga sai
--
-- Depois do preenchimento e das travas, nunca antes: entre o `add` e o
-- `update` a tabela tem as duas, e e dali que o valor vem.
-- ---------------------------------------------------------------------------
alter table public.posts drop column if exists plataforma;


-- ---------------------------------------------------------------------------
-- PASSO 4 - Abrir o mes com linhas de combinacao
--
-- Reconstruida a partir da versao da 0061 -- a MAIS NOVA. `create or replace
-- function` reescreve a partir do que se digita, e o que nao for copiado se
-- perde: foi assim que a 0030 perdeu o bloco de carimbos da 0007 e nenhuma
-- subtarefa teve `concluida_em` por duas migrations, sem ninguem notar.
--
-- O que muda em relacao a 0061 e so a leitura de `p_quantidades` e o `insert`
-- do post. Tudo o mais -- a guarda do Atendimento, a conferencia dos offsets,
-- a corrente que nao vence de tras para a frente, o teto de 60, a demanda do
-- mes achada ou criada, a ordem que continua de onde parou, os responsaveis e
-- os prazos da corrente -- e a 0061 letra por letra.
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
  valor     integer;
  anterior  integer;
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

  -- A FORMA NOVA E UMA LISTA, e a recusa diz isso em vez de estourar dentro
  -- de um `jsonb_array_elements` com uma mensagem sobre tipo de jsonb. Quem
  -- cair aqui esta mandando o objeto da 0044.
  if p_quantidades is null or jsonb_typeof(p_quantidades) <> 'array' then
    raise exception using
      errcode = 'check_violation',
      message = 'As quantidades vêm como uma lista de combinações de redes.',
      hint    = 'Cada linha é {"redes": ["instagram","facebook"], "quantidade": 12}.';
  end if;

  -- OS OFFSETS SAO CONFERIDOS ANTES DE ABRIR POST NENHUM. A funcao e
  -- transacional, entao recusar no meio tambem desfaria tudo -- mas a
  -- mensagem sairia depois de sessenta inserts, e o custo de conferir cinco
  -- numeros primeiro e zero.
  for chave, valor in select key, value::integer from jsonb_each_text(p_prazos)
  loop
    if not exists (select 1 from public.etapas_padrao_do_social() e where e.nome = chave) then
      raise exception using
        errcode = 'check_violation',
        message = format('A corrente do social não tem etapa chamada "%s".', chave),
        hint    = 'As etapas são Pauta, Conteúdo, Layout, Envio e Programar.';
    end if;
    if valor < -60 or valor > 60 then
      raise exception using
        errcode = 'check_violation',
        message = format('O prazo da etapa "%s" está a %s dias da publicação.', chave, valor),
        hint    = 'O limite é 60 dias para cada lado. Fora disso é erro de digitação, não planejamento.';
    end if;
  end loop;

  -- A CORRENTE NAO PODE VENCER DE TRAS PARA A FRENTE.
  anterior := null;
  for etapa in select e.ordem, e.nome from public.etapas_padrao_do_social() e order by e.ordem
  loop
    valor := nullif(p_prazos ->> etapa.nome, '')::integer;
    if valor is not null then
      if anterior is not null and valor < anterior then
        raise exception using
          errcode = 'check_violation',
          message = format('"%s" venceria antes da etapa anterior da corrente.', etapa.nome),
          hint    = 'A ordem é Pauta, Conteúdo, Layout, Envio e Programar — os dias precisam andar na mesma direção.';
      end if;
      anterior := valor;
    end if;
  end loop;

  -- AS LINHAS SAO CONFERIDAS INTEIRAS ANTES DE ABRIR POST NENHUM, pela mesma
  -- razao dos offsets.
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
  -- Achar antes de criar tem o mesmo furo de toda busca-antes-de-escrever, e
  -- aqui ele esta fechado: quem garante a unicidade e o indice
  -- `tasks_social_do_mes_unico`, e nao este `select`. Duas abas clicando ao
  -- mesmo tempo passam pelas duas consultas, e a segunda leva a recusa do
  -- indice em vez de abrir a demanda gemea -- e a mesma decisao de
  -- `gerar_ocorrencia()` (0040), onde a idempotencia e o indice e nunca a
  -- consulta.
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
        -- A FRASE DIZ POR QUE, e nao so que falta: a 0015 exige a pasta de
        -- toda demanda, e quem abre o mes de social costuma nao saber que
        -- esta abrindo uma demanda.
        hint    = 'O mês de social é uma demanda só, com um post em cada etapa — e toda demanda precisa da pasta onde o material vai ficar. O botão "Criar no Drive" cria a do mês.';
    end if;

    etiqueta := format('Social · %s/%s de %s',
                       meses[extract(month from primeiro)::integer],
                       extract(year from primeiro)::integer,
                       empresa);

    -- NASCE PUBLICADA, e nao como rascunho: a tela de task abre um rascunho no
    -- clique (0028) porque a pessoa vai digitar o titulo ali dentro; aqui ela
    -- preencheu tudo antes, e rascunho e de quem o criou -- esconderia da
    -- equipe os doze posts que ela acabou de abrir. E a mesma decisao da 0051.
    insert into public.tasks (
      client_id, titulo, data_inicio, data_fim, link_entrega,
      social_do_mes, criado_por, publicada_em
    ) values (
      p_client_id, etiqueta, primeiro, ultimo, btrim(p_link_entrega),
      primeiro, (select auth.uid()), now()
    )
    returning id into demanda;
  end if;

  -- A ORDEM CONTINUA DE ONDE PAROU. Abrir o mes em duas vezes -- doze no
  -- Instagram hoje, quatro no LinkedIn amanha -- acrescenta a lista em vez de
  -- reiniciá-la em 1, que poria dois posts na mesma posicao.
  select coalesce(max(s.ordem), 0) into proxima
    from public.subtasks s where s.task_id = demanda;

  for linha in select * from jsonb_array_elements(p_quantidades)
  loop
    quantos := coalesce((linha ->> 'quantidade')::integer, 0);
    continue when quantos = 0;

    -- `distinct` NA LEITURA, e nao so o `check` na tabela: a linha vem de um
    -- dialogo em que a pessoa marca caixas, e uma rede marcada duas vezes por
    -- um clique repetido seria uma recusa de banco no meio de sessenta
    -- inserts, com uma mensagem sobre `cardinality`. A trava fica para quem
    -- monta a chamada a mao.
    select array_agg(distinct r::public.plataforma_social order by r::public.plataforma_social)
      into redes
      from jsonb_array_elements_text(linha -> 'redes') as t(r);

    -- O NOME DA COMBINACAO sai das redes, e por extenso: "Instagram +
    -- Facebook". A sigla e da tela, onde o espaco e de uma celula de
    -- calendario; aqui e o titulo da etapa da demanda, que alguem le numa
    -- lista de board.
    -- `order by r` E PELO ENUM, e nao por texto: alfabeticamente o Facebook
    -- vem antes do Instagram, e o tema sairia "Facebook + Instagram" para uma
    -- combinacao que o produto inteiro -- e a frase do usuario -- le na outra
    -- ordem. E a mesma ordem do `array_agg` acima, entao a coluna e o tema
    -- nunca discordam. A bateria mede o tema, e foi ela que pegou.
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

      -- A ETAPA DO POST NA DEMANDA DO MES.
      --
      -- SEM RESPONSAVEL E SEM PRAZO, e as duas ausencias sao a decisao: o
      -- trabalho do post sao as cinco etapas da corrente, que tem cinco donos
      -- e cinco dias. Ver o cabecalho da 0061.
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

      -- A REGRA DE DATA, gravada mesmo sem o post ter data ainda (0059).
      update public.post_etapas e
         set prazo_offset_dias = nullif(p_prazos ->> e.nome, '')::integer,
             updated_at = now()
       where e.post_id = novo
         and nullif(p_prazos ->> e.nome, '') is not null;

      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$fn$;

comment on function public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb, jsonb, text) is
  'Abre o mes de social de um cliente: UMA demanda do mes, um post por linha '
  'de combinacao e quantidade, uma etapa da demanda por post e a corrente de '
  'cinco dentro de cada um. `p_quantidades` e uma lista de '
  '{"redes": [...], "quantidade": N} -- doze no Instagram junto com o '
  'Facebook sao doze posts, nao vinte e quatro (0082).';
