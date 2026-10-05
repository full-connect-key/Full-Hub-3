-- ===========================================================================
-- 0083 - A CORRENTE DO MES TEM UM DIA POR ETAPA, E NAO UM OFFSET POR POST
--
-- Decisao do usuario, corrigindo o modelo da 0059 com a descricao de como a
-- agencia realmente trabalha:
--
--   *"Se o social e de Novembro, em um dia X de Outubro, a Social Media vai
--   ter um dia para fazer a pauta do mes todo. A redatora vai ter um dia pra
--   fazer o conteudo, e o Designer vai ter um prazo X para fazer os layouts.
--   Preciso que ao montar o social, se defina quais dias ele vai ter para
--   fazer a Pauta, o Conteudo, Layout, e assim por diante (...) ele precisa
--   parar de ficar marcada para ser feita em X dias antes do post ser
--   publicado."*
--
-- ---------------------------------------------------------------------------
-- O QUE A 0059 ENTENDEU ERRADO, E NAO ERA DETALHE
--
-- Ela leu a corrente como uma cadeia de producao de CADA PECA: o Layout de um
-- post sai tres dias antes DAQUELE post ir ao ar. Com doze posts espalhados
-- pelo mes, isso punha o Design trabalhando doze vezes, em doze dias
-- diferentes -- cada layout colado na data de publicacao da sua peca.
--
-- Nao e assim que a agencia produz. **O mes inteiro e feito em bloco, antes de
-- o mes comecar:** um dia de pauta para os doze, um dia de conteudo para os
-- doze, um prazo de layout para os doze. Quem monta o mes nao esta dizendo
-- "quantos dias antes de cada post", esta dizendo "em que dia cada etapa deste
-- mes vence".
--
-- O argumento da 0059 para o offset -- *"data fixa num modelo reutilizavel
-- faria toda demanda nova nascer vencida"* -- vinha de
-- `workflow_steps.prazo_offset_dias` (0008), e la ele esta certo: um workflow
-- e um MODELO, aplicado a demandas que comecam em datas diferentes. Aqui nao
-- ha modelo: `abrir_mes_de_social()` abre UM mes, e o mes tem um calendario
-- proprio. A data e fixa porque o mes e fixo.
--
-- ---------------------------------------------------------------------------
-- `prazo_offset_dias` E APAGADA, com os DOIS triggers que a serviam
--
-- Decisao da 0023, de novo. Deixar a coluna parada manteria no banco uma regra
-- que nenhum caminho escreve e que a proxima pessoa leria como ativa -- e os
-- dois triggers dela sao piores que a coluna: `posts_recalcula_prazos` moveria
-- o dia da Pauta do mes inteiro porque alguem trocou a data de UM post, e
-- `post_etapas_solta_o_offset` apagaria uma regra que nao existe mais.
--
-- **E e esse o comportamento que o usuario pediu para tirar, em uma frase:**
-- *"ele precisa parar de ficar marcada para ser feita em X dias antes do post
-- ser publicado"*. Tirar so a tela deixaria o trigger movendo as datas por
-- baixo de quem as escolheu -- a lição da 0029, onde a regra morava nos dois
-- lados e desfazer um lado nao desfez nada.
--
-- **O que FICA e `post_etapas.prazo`**, que e o dia em si: ele ja e o que a
-- oitava origem da `calendar_events` le, o que Minhas Tasks mostra e o que o
-- card da corrente desenha. Nenhuma dessas leituras muda.
--
-- ---------------------------------------------------------------------------
-- `p_prazos` PASSA A SER DATA, e a forma antiga e recusada
--
-- Era `{"Pauta": -10, "Conteudo": -7}` e passa a ser
-- `{"Pauta": "2026-10-05", "Conteudo": "2026-10-12"}`. A chave continua sendo
-- o NOME da etapa e nao a funcao, pela razao da 0059: Pauta e Programar sao as
-- duas de Social Media, e uma chave por funcao daria as duas o mesmo dia.
--
-- O numero e recusado com frase propria em vez de estourar dentro de um
-- `::date` com uma mensagem sobre sintaxe de entrada -- e a decisao do objeto
-- de quantidades na 0082, pelo mesmo motivo: quem cair ali esta mandando a
-- forma antiga, e a recusa precisa dizer qual e a nova.
--
-- ---------------------------------------------------------------------------
-- A DATA E LIVRE, e nao precisa cair antes do mes
--
-- O caso que o usuario descreve e a corrente inteira em outubro para o social
-- de novembro, e a trava obvia seria "a etapa vence antes do dia 1 do mes".
-- Ela esta FORA de proposito: o Programar de um mes costuma acontecer dentro
-- dele, e um mes aberto com atraso -- que acontece -- teria a corrente inteira
-- recusada por uma regra de calendario. E a decisao de "funcao sem dono avisa,
-- nunca recusa" (0064): travar o que e so incomum deixa o trabalho parado.
--
-- O que CONTINUA travado e a corrente vencer de tras para a frente, agora
-- comparando datas em vez de offsets. O Layout com dia anterior ao Conteudo e
-- quase sempre um numero trocado, e o estrago e grande: a corrente ja recusa
-- comecar o Layout antes de o Conteudo fechar (0045), entao a pessoa veria no
-- calendario dela uma etapa vencendo num dia em que o banco ainda nao deixa
-- toca-la.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Os dois triggers do offset saem ANTES da coluna
--
-- Coluna citada em trigger nao sai enquanto o trigger estiver de pe -- e a
-- mesma pegadinha que a 0039 teve com `ano_referencia` e a 0043 com
-- `sugerida_por` numa policy.
-- ---------------------------------------------------------------------------
drop trigger if exists post_etapas_solta_o_offset on public.post_etapas;
drop trigger if exists posts_recalcula_prazos on public.posts;

drop function if exists public.post_etapas_solta_o_offset();
drop function if exists public.recalcular_prazos_do_post();

alter table public.post_etapas drop column if exists prazo_offset_dias;

comment on column public.post_etapas.prazo is
  'O dia em que esta etapa precisa estar pronta. Escolhido ao abrir o mes e '
  'igual para todos os posts dele: a Pauta do mes inteiro e feita num dia, o '
  'Conteudo noutro (0083). Nulo = sem dia marcado.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - Abrir o mes recebendo a DATA de cada etapa
--
-- Reconstruida a partir da versao da 0082 -- a MAIS NOVA. `create or replace
-- function` reescreve a partir do que se digita, e o que nao for copiado se
-- perde: foi assim que a 0030 perdeu o bloco de carimbos da 0007 e nenhuma
-- subtarefa teve `concluida_em` por duas migrations, sem ninguem notar.
--
-- O que muda em relacao a 0082: `p_prazos` vira data, a conferencia de limite
-- some (nao ha offset a limitar), a ordem da corrente compara datas, e o
-- `update` final grava `prazo` em vez de `prazo_offset_dias`. Todo o resto --
-- a guarda do Atendimento, as linhas de combinacao, o teto de 60, a demanda do
-- mes achada ou criada, a ordem que continua de onde parou, os responsaveis --
-- e a 0082 letra por letra.
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
  texto     text;
  dia       date;
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

  -- AS DATAS SAO CONFERIDAS ANTES DE ABRIR POST NENHUM. A funcao e
  -- transacional, entao recusar no meio tambem desfaria tudo -- mas a
  -- mensagem sairia depois de sessenta inserts, e o custo de conferir cinco
  -- datas primeiro e zero.
  for chave, texto in select key, value from jsonb_each_text(p_prazos)
  loop
    if not exists (select 1 from public.etapas_padrao_do_social() e where e.nome = chave) then
      raise exception using
        errcode = 'check_violation',
        message = format('A corrente do social não tem etapa chamada "%s".', chave),
        hint    = 'As etapas são Pauta, Conteúdo, Layout, Envio e Programar.';
    end if;

    if nullif(btrim(texto), '') is null then
      continue;
    end if;

    -- O NUMERO DA 0059 E RECUSADO COM FRASE PROPRIA. Quem cair aqui esta
    -- mandando o offset -- "-10" --, e a recusa precisa dizer que agora e dia.
    begin
      dia := texto::date;
    exception when others then
      raise exception using
        errcode = 'check_violation',
        message = format('O dia da etapa "%s" precisa ser uma data, no formato AAAA-MM-DD.', chave),
        hint    = 'A corrente do mês tem um dia de calendário por etapa — não mais um número de dias antes da publicação.';
    end;
  end loop;

  -- A CORRENTE NAO PODE VENCER DE TRAS PARA A FRENTE, agora em datas.
  anterior := null;
  for etapa in select e.ordem, e.nome from public.etapas_padrao_do_social() e order by e.ordem
  loop
    dia := nullif(btrim(coalesce(p_prazos ->> etapa.nome, '')), '')::date;
    if dia is not null then
      if anterior is not null and dia < anterior then
        raise exception using
          errcode = 'check_violation',
          message = format('"%s" venceria antes da etapa anterior da corrente.', etapa.nome),
          hint    = 'A ordem é Pauta, Conteúdo, Layout, Envio e Programar — os dias precisam andar na mesma direção.';
      end if;
      anterior := dia;
    end if;
  end loop;

  -- AS LINHAS SAO CONFERIDAS INTEIRAS ANTES DE ABRIR POST NENHUM, pela mesma
  -- razao das datas.
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

      -- O DIA DE CADA ETAPA, igual para todos os posts do mes (0083). E a
      -- frase do usuario em SQL: um dia de pauta para o mes todo, um dia de
      -- conteudo para o mes todo.
      update public.post_etapas e
         set prazo = nullif(btrim(p_prazos ->> e.nome), '')::date,
             updated_at = now()
       where e.post_id = novo
         and nullif(btrim(coalesce(p_prazos ->> e.nome, '')), '') is not null;

      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$fn$;

comment on function public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb, jsonb, text) is
  'Abre o mes de social de um cliente: UMA demanda do mes, um post por linha '
  'de combinacao (0082) e a corrente de cinco etapas dentro de cada um, com '
  'um DIA DE CALENDARIO por etapa valendo para o mes inteiro (0083). '
  '`p_prazos` e {"Pauta": "2026-10-05", ...}.';
