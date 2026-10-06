-- ===========================================================================
-- 0089 - O FLUXO E A SEQUENCIA DE ACOES, E A DATA E DO MES
--
-- Decisao do usuario: *"Na criacao do fluxo, tem uma aba comeca quantos dias
-- antes do mes, e termina quantos dias antes do mes, nao faz sentido, por que
-- cada mes tem um prazo de fluxo diferente, mas sempre que for aberto o
-- social, o fluxo, deve ter a mesma sequencia de acoes"*.
--
-- E a frase dele tem as duas metades. O fluxo responde UMA pergunta -- o que
-- acontece, em que ordem, por quem -- e as duas pontas de cada elo nunca foram
-- resposta dela: elas sao do MES. "Vinte dias antes" nao e um combinado de
-- contrato, e um numero que a pessoa que abre novembro escolhe olhando o
-- calendario de novembro.
--
--
-- COMO ELAS CHEGARAM AQUI, porque o argumento que as pos era bom
--
-- A 0083 tirou o offset de `post_etapas` -- *"o Layout de um post saia tres
-- dias antes DAQUELE post ir ao ar"*, e o mes inteiro e feito em bloco --, e
-- as duas pontas viraram data literal no dialogo que abre o mes. Entao a 0084
-- acrescentou o inicio, e a 0087 tornou a corrente editavel. Foi ai que elas
-- subiram para o fluxo, com a razao escrita no cabecalho dela:
-- `ETAPAS_DA_CORRENTE` em TypeScript sabia sugerir os dias das cinco etapas
-- que ela mesma listava, e nao saberia sugerir nada para uma etapa que alguem
-- acrescentou -- *"dez campos de data vazios fariam quem abre o mes inventar
-- dez datas na hora"*.
--
-- AQUELE CUSTO E REAL E CONTINUA PAGO, e e por isso que esta migration nao
-- deixa os campos em branco. O que estava errado nao era sugerir: era GUARDAR
-- a sugestao no fluxo, como se ela fosse parte do combinado. Ela e derivavel
-- da propria sequencia -- N elos encostados dentro da janela que antecede o
-- dia 1 --, e derivada ela serve a um fluxo de tres elos e a um de dez sem
-- ninguem ter digitado numero nenhum. E "bloqueio nao e status" e "atraso do
-- Financeiro nao e coluna" aplicados a uma sugestao: o que da para calcular
-- nao se guarda, senao sao duas verdades e a guardada e a que envelhece.
--
-- Quem calcula e `periodosSugeridosDoFluxo()` em `lib/dominio/social-flows.ts`
-- -- e SO ela, no navegador. Nao ha par no Postgres de proposito: isto nao e
-- `situacaoDoLancamento()`, que decide o que contar nos dois lados. E uma
-- sugestao que aparece num campo editavel antes de alguem salvar; o banco nao
-- tem pergunta nenhuma a fazer sobre ela, e `abrir_mes_de_social` continua
-- recebendo as datas que a pessoa confirmou em `p_prazos`, conferindo a ordem
-- e o periodo invertido como desde a 0084.
--
--
-- APAGAR E NAO APOSENTAR, que e a decisao da 0023: duas regras de data para o
-- mesmo fato seriam o segundo lugar que diverge, e o que divergiria e o
-- guardado -- a tela passa a sugerir pela sequencia e ninguem mais olharia as
-- colunas. Coluna que nenhuma tela le e schema que alguem reaproveita errado
-- tres sprints depois, achando que ainda diz a verdade sobre o fluxo.
--
--
-- E A FORMA ANTIGA DE `p_etapas` E RECUSADA COM FRASE PROPRIA.
--
-- `p_etapas` e `jsonb`, entao uma chave a mais entra CALADA -- a assinatura
-- nao muda e o `select` simplesmente para de ler os dois campos. E o pior modo
-- de falha desta casa: quem mandar a forma da 0087 veria o fluxo gravar sem
-- erro nenhum, abriria o mes, e as datas que ele acha que combinou nao
-- estariam em lugar nenhum. E a decisao do objeto de quantidades da 0082 e da
-- data solta da 0084: a recusa precisa dizer qual e a forma nova.
--
--
-- ---------------------------------------------------------------------------
-- A SEGUNDA METADE: A ENTREGA PODE SER A ULTIMA PRODUCAO
--
-- Relato do usuario, na mesma tela: *"quando tento montar um fluxo, ele
-- aparece: Falta a etapa de entrega ao cliente (...) mas essa etapa ja esta
-- vinculada ao fato que o cliente, aprova a etapa de layout, que e a ultima de
-- producao"*.
--
-- O FLUXO DELE E REPRESENTAVEL, e sempre foi: Layout com `papel = 'entrega'`.
-- O papel e coluna desde a 0087 exatamente para o NOME do elo ser livre -- um
-- fluxo pode chamar a entrega de "Layout" e continuar sendo a entrega. O que
-- estava errado eram tres coisas em volta disso, e nenhuma e o modelo:
--
--   1. A RECUSA NAO DIZIA O QUE FAZER. "Falta a etapa de entrega ao cliente"
--      nomeia o que falta a quem acabou de marcar, na mesma tela, um
--      interruptor escrito "o cliente aprova esta etapa" -- as duas frases
--      falam do cliente, e a pessoa concluiu com razao que uma satisfazia a
--      outra. E a decisao da 0023: dizer QUAL e a diferenca entre uma recusa e
--      uma instrucao.
--
--   2. MARCAR O LAYOUT COMO ENTREGA PERDIA O DESIGN, e isto e do lado de ca
--      (`funcoesDoFluxo()`): ela pulava a entrega, com o argumento da 0087 de
--      que *"a entrega nao e trabalho de ninguem: e consequencia da rodada de
--      escopo cliente, e o dono dela e a gestao desde a 0007"*. Aquele
--      argumento descreve o 'Envio' da casa, que e um elo sem trabalho -- e
--      nao vale como regra: se a entrega e trabalho ou nao, quem diz e o
--      FLUXO, pela funcao que alguem escolheu nela. Desde a 0088 ela e uma
--      subtarefa de verdade, com responsavel, cronometro e carga, e uma
--      entrega sem dono nao aparece no "Minhas Tasks" de ninguem -- *"o pior
--      tipo de trabalho gerado automaticamente, o que ninguem sabe que
--      nasceu"* (0041).
--
--      De quebra isso conserta um aviso que MENTE em todo mes aberto desde a
--      0087: o 'Envio' da casa nasce sem responsavel com
--      `aviso_geracao = 'Esta etapa e do Gestao, e a conta nao tem ninguem
--      nessa funcao.'` -- e a conta nunca foi perguntada.
--
--   3. E O `campo` NAO APARECIA NELA, so na tela: o `check`
--      `social_flow_steps_campo_conhecido` sempre aceitou campo em qualquer
--      papel. Um fluxo cuja entrega e o "Conteudo" enche a legenda, e esconder
--      o seletor seria a tela recusando o que o banco aceita.
--
-- O QUE NAO MUDA, e e a trava inteira: a entrega continua sendo UMA, nem zero
-- nem duas, e continua sendo o portao final -- e a aprovacao dela que faz
-- `posts.status = 'aprovado'` (0088). O que ela deixa de ser e
-- obrigatoriamente um elo separado do trabalho.
--
--
-- MEDIDO COM QUATRO MUTACOES:
--
--   * devolver as duas colunas ...................... 1 cenario cai
--   * nao recusar a forma antiga de `p_etapas` ...... 2 cenarios caem
--   * tirar o ramo do portao de `salvar_...` ........ 2 cenarios caem
--   * tirar o ramo do portao do gatilho ............. 1 cenario cai
--
-- O PRIMEIRO E O UNICO QUE PRECISA DE EXPLICACAO: ele derruba UM cenario, e e o
-- que confere que as colunas sairam. Nenhum outro cai, porque devolver uma
-- coluna que ninguem le nao quebra nada -- que e exatamente a razao pela qual
-- ela nao podia ficar. Coluna que nenhuma tela le e schema que alguem
-- reaproveita errado tres sprints depois (0023).
--
-- E O ULTIMO DERRUBA UM E NAO DOIS, o que separa "a regra esta no banco" de "a
-- regra esta na funcao": a recusa mora nos DOIS lados -- a funcao escreve a
-- frase antes de gravar nada, o gatilho pega quem monta a chamada a mao -- e
-- um cenario mede cada um. E a licao da 0029 e da 0060, onde desfazer um lado
-- nao desfez nada.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - `etapas_do_fluxo()` devolve seis colunas, e nao oito
--
-- O `drop` E OBRIGATORIO E NAO ESTILO, e e a pegadinha que a propria 0087 ja
-- pagou com `etapas_padrao_do_social()`: `create or replace` nao troca o tipo
-- de linha de um `returns table`. Ele vem ANTES do `drop column`, porque a
-- funcao cita as duas colunas no corpo -- a dependencia da 0039 com
-- `ano_referencia` e da 0043 com `sugerida_por`, vista de novo.
-- ---------------------------------------------------------------------------

drop function if exists public.etapas_do_fluxo(uuid);

create or replace function public.etapas_do_fluxo(p_flow_id uuid)
returns table (
  ordem              integer,
  nome               text,
  funcao             public.team_funcao,
  papel              public.social_flow_papel,
  aprovacao_cliente  boolean,
  campo              text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- `security definer` PELA MESMA RAZAO DE `porta_do_cliente_no_post` (0076):
  -- ela e chamada de dentro de `posts_corrente_do_cliente`, que roda com o
  -- `auth.uid()` DO CLIENTE -- e o cliente nao tem policy em
  -- `social_flow_steps`. Sem o definer, o cliente aprovando um post levaria
  -- uma lista vazia e a corrente nao andaria.
  return query
    select s.ordem, s.nome, s.funcao, s.papel, s.aprovacao_cliente, s.campo
      from public.social_flow_steps s
     where s.flow_id = p_flow_id
     order by s.ordem;
end;
$$;

comment on function public.etapas_do_fluxo is
  'Os elos de um fluxo de social, em ordem: o que acontece, por quem, com que papel. As duas pontas de data sairam na 0089 -- elas sao do mes, nao do fluxo (0089).';


-- ---------------------------------------------------------------------------
-- PASSO 2 - As duas colunas saem
-- ---------------------------------------------------------------------------

alter table public.social_flow_steps drop column if exists comeca_dias_antes;
alter table public.social_flow_steps drop column if exists termina_dias_antes;


-- ---------------------------------------------------------------------------
-- PASSO 3 - `salvar_fluxo_de_social()` para de gravar as duas, e recusa a
--           forma antiga com frase propria
--
-- `create or replace` BASTA AQUI: o tipo de retorno (`uuid`) e a assinatura
-- (`p_nome`, `p_etapas`, `p_flow_id`, `p_descricao`, `p_ativo`) nao mudam.
-- Mexer na lista de parametros criaria uma SEGUNDA funcao ao lado, porque o
-- PostgREST resolve por nome mais nomes dos argumentos -- a pegadinha que a
-- 0061 registrou e que ja custou um *"Could not find the function"* ao
-- usuario.
-- ---------------------------------------------------------------------------

create or replace function public.salvar_fluxo_de_social(
  p_nome      text,
  p_etapas    jsonb,
  p_flow_id   uuid default null,
  p_descricao text default null,
  p_ativo     boolean default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  alvo     uuid := p_flow_id;
  etapa    jsonb;
  nomes    text[] := '{}';
  nome_et  text;
  entregas integer := 0;
  portao   text;
begin
  if nullif(btrim(coalesce(p_nome, '')), '') is null then
    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo precisa de um nome.',
      hint    = 'O nome é o que a lista mostra na hora de abrir o mês — "Padrão da casa", "Fluxo da Mundo Verde".';
  end if;

  if p_etapas is null or jsonb_typeof(p_etapas) <> 'array' then
    raise exception using
      errcode = 'check_violation',
      message = 'As etapas do fluxo vêm como uma lista, na ordem da corrente.',
      hint    = 'Cada etapa é {"nome": "Pauta", "funcao": "Social Media", "papel": "producao"}.';
  end if;

  -- FLUXO SEM ETAPA E RECUSADO AQUI, e nao pela trava do PASSO 2 da 0087 --
  -- ela deixa o fluxo vazio passar de proposito, porque esse e o estado entre
  -- o `delete` e o `insert` desta propria funcao.
  if jsonb_array_length(p_etapas) = 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Um fluxo sem etapa nenhuma não abre mês nenhum.',
      hint    = 'Monte a corrente: o trabalho que acontece antes de enviar, a entrega ao cliente, e o que vem depois da decisão dele.';
  end if;

  -- OS NOMES SAO CONFERIDOS ANTES DE GRAVAR, pela razao dos periodos em
  -- `abrir_mes_de_social`: a recusa do indice unico diria
  -- "social_flow_steps_flow_id_nome_key", que nao e portugues e nao diz qual
  -- nome repetiu. E o nome repetido nao e detalhe: `p_prazos` e um mapa POR
  -- NOME desde a 0059, e duas etapas homonimas receberiam o mesmo periodo.
  --
  -- O MESMO LACO RECUSA A FORMA DA 0087, e e aqui que ele pertence: `p_etapas`
  -- e `jsonb`, entao uma chave a mais entra CALADA -- quem mandar
  -- `comeca_dias_antes` gravaria o fluxo sem erro nenhum e descobriria no mes
  -- seguinte que as datas que ele acha que combinou nao estao em lugar nenhum.
  -- E a decisao do objeto de quantidades (0082) e da data solta (0084): a
  -- recusa diz qual e a forma nova, em vez de um erro sobre sintaxe.
  for etapa in select * from jsonb_array_elements(p_etapas)
  loop
    if etapa ? 'comeca_dias_antes' or etapa ? 'termina_dias_antes' then
      raise exception using
        errcode = 'check_violation',
        message = 'O fluxo não guarda mais os dias de cada etapa.',
        hint    = 'Ele é a sequência de ações; as datas são do mês, e quem abre o mês as escolhe — o diálogo já sugere as duas pontas de cada etapa a partir da ordem dela na corrente.';
    end if;

    nome_et := nullif(btrim(coalesce(etapa ->> 'nome', '')), '');

    if nome_et is null then
      raise exception using
        errcode = 'check_violation',
        message = 'Toda etapa do fluxo precisa de um nome.';
    end if;

    if nome_et = any(nomes) then
      raise exception using
        errcode = 'check_violation',
        message = format('O fluxo tem duas etapas chamadas "%s".', nome_et),
        hint    = 'O nome da etapa é a chave do período que cada mês escolhe, então ele é único dentro do fluxo.';
    end if;

    nomes := nomes || nome_et;

    if coalesce(etapa ->> 'papel', 'producao') = 'entrega' then
      entregas := entregas + 1;
    end if;

    -- O ULTIMO PORTAO DE CLIENTE, guardado para a frase da recusa de baixo.
    if coalesce(etapa ->> 'papel', 'producao') = 'producao'
       and coalesce((etapa ->> 'aprovacao_cliente')::boolean, false) then
      portao := nome_et;
    end if;
  end loop;

  -- AS DUAS RECUSAS DO PASSO 2 APARECEM AQUI TAMBEM, e nao e duplicacao de
  -- verdade: a trava do banco e a que vale, e esta escreve a frase antes de
  -- gravar nada -- a decisao da maquina de estados da subtarefa ao lado dos
  -- gatilhos da 0007. A diferenca pratica e que esta nomeia a linha do
  -- formulario, e a do gatilho pega quem monta a chamada a mao.
  --
  -- E A FRASE E A MESMA DOS DOIS LADOS, que e a licao da 0029 e da 0060: regra
  -- que mora em dois lugares com duas frases diferentes manda a pessoa a dois
  -- lugares diferentes.
  if entregas = 0 then
    if portao is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('Marcar "o cliente aprova" em %s não entrega o material: falta dizer qual etapa é a entrega.', portao),
        hint    = format('Se é em %s que o cliente dá a palavra final, mude "O que é" dela para "Entrega ao cliente" — o nome da etapa continua o mesmo, e ela segue sendo o trabalho de quem a faz. Se depois dela ainda há um passo em que a gestão confere e manda, é esse passo que é a entrega.', portao);
    end if;

    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo precisa de uma etapa de entrega ao cliente.',
      hint    = 'A entrega é o portão: é nela que o material sai da agência e a rodada do cliente nasce. Marque em "O que é" qual etapa da corrente é essa.';
  end if;

  if entregas > 1 then
    raise exception using
      errcode = 'check_violation',
      message = format('O fluxo tem %s etapas de entrega, e a entrega é uma só.', entregas),
      hint    = 'Se há um segundo aval no meio da corrente, marque aquela etapa como "o cliente aprova" em vez de criar outra entrega.';
  end if;

  -- `p_flow_id` COM FLUXO QUE NAO EXISTE CRIA COM AQUELE ID, e nao recusa: e
  -- o que deixa o seed e a bateria fixarem o id de um fluxo.
  if alvo is not null and exists (select 1 from public.social_flows f where f.id = alvo) then
    update public.social_flows
       set nome = btrim(p_nome),
           descricao = nullif(btrim(coalesce(p_descricao, '')), ''),
           ativo = coalesce(p_ativo, true),
           updated_at = now()
     where id = alvo
    returning id into alvo;

    -- SEM LINHA DE VOLTA E RECUSA DO RLS, e nao fluxo inexistente -- o `if` de
    -- cima ja separou os dois casos.
    if alvo is null then
      raise exception using
        errcode = 'check_violation',
        message = 'Montar e editar fluxo de social é do desenvolvedor ou do sócio.',
        hint    = 'Quem produz percorre a corrente; quem a desenha é quem responde pelo contrato.';
    end if;
  else
    insert into public.social_flows (id, nome, descricao, ativo, criado_por)
    values (coalesce(alvo, gen_random_uuid()),
            btrim(p_nome), nullif(btrim(coalesce(p_descricao, '')), ''),
            coalesce(p_ativo, true), (select auth.uid()))
    returning id into alvo;
  end if;

  delete from public.social_flow_steps where flow_id = alvo;

  -- OS ELOS ENTRAM NUM `INSERT` SO, e nao num laco -- o gatilho de coerencia
  -- do PASSO 2 da 0087 e POR INSTRUCAO: num laco, a primeira volta deixa o
  -- fluxo com um elo e nenhuma entrega, e a trava recusa ali, com a frase
  -- certa sobre um fluxo que ainda estava sendo montado.
  insert into public.social_flow_steps (
    flow_id, ordem, nome, funcao, papel, campo, aprovacao_cliente
  )
  select alvo,
         (t.pos * 10)::integer,
         btrim(t.e ->> 'nome'),
         (t.e ->> 'funcao')::public.team_funcao,
         coalesce(nullif(t.e ->> 'papel', ''), 'producao')::public.social_flow_papel,
         nullif(btrim(coalesce(t.e ->> 'campo', '')), ''),
         coalesce((t.e ->> 'aprovacao_cliente')::boolean, false)
    from jsonb_array_elements(p_etapas) with ordinality as t(e, pos);

  return alvo;
end;
$$;

comment on function public.salvar_fluxo_de_social is
  'Grava um fluxo de social com a corrente dele, numa transacao so. `p_etapas` e a lista na ordem: [{"nome","funcao","papel","campo","aprovacao_cliente"}]. As duas pontas de data sairam na 0089, e a forma antiga e recusada com frase propria.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - A recusa da entrega que falta passa a dizer O QUE FAZER
--
-- Ela e a unica mudanca de comportamento deste arquivo que o usuario vai
-- notar, e ela nao afrouxa nada: o fluxo sem entrega continua recusado. O que
-- muda e que a recusa separa os dois casos -- um fluxo em que ninguem disse
-- quem entrega, e um em que a pessoa marcou "o cliente aprova" no ultimo elo
-- de producao achando que isso entregava.
--
-- A SEGUNDA FRASE NOMEIA A ETAPA, e e a decisao da 0023 outra vez: "falta a
-- etapa de entrega" manda a pessoa conferir seis linhas; dizer *marque a
-- Layout* e uma instrucao.
-- ---------------------------------------------------------------------------

create or replace function public.conferir_fluxo_de_social(p_flow_id uuid)
returns void
language plpgsql
as $$
declare
  quantas   integer;
  entregas  integer;
  ord_entr  integer;
  fora      text;
  portao    text;
begin
  -- O FLUXO PODE TER ACABADO DE SAIR. `social_flow_steps.flow_id` e
  -- `on delete cascade`, e a acao da chave estrangeira apaga os elos DEPOIS de
  -- a linha do fluxo sumir -- sem esta guarda, apagar um fluxo inteiro cairia
  -- na recusa "este fluxo nao tem etapa de entrega", sobre um fluxo que nao
  -- existe mais.
  if not exists (select 1 from public.social_flows f where f.id = p_flow_id) then
    return;
  end if;

  select count(*) into quantas
    from public.social_flow_steps s where s.flow_id = p_flow_id;

  -- FLUXO VAZIO NAO E FLUXO TORTO, e sim fluxo que ainda nao foi montado: e o
  -- estado entre o `delete` e o `insert` de quem o esta reescrevendo.
  if quantas = 0 then
    return;
  end if;

  select count(*) filter (where s.papel = 'entrega'),
         min(s.ordem) filter (where s.papel = 'entrega')
    into entregas, ord_entr
    from public.social_flow_steps s where s.flow_id = p_flow_id;

  if entregas = 0 then
    -- O ULTIMO ELO DE PRODUCAO QUE O CLIENTE APROVA, se houver: e nele que a
    -- pessoa quase sempre esta pensando quando apaga o 'Envio'.
    select s.nome into portao
      from public.social_flow_steps s
     where s.flow_id = p_flow_id
       and s.papel = 'producao'
       and s.aprovacao_cliente
     order by s.ordem desc
     limit 1;

    if portao is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('Marcar "o cliente aprova" em %s não entrega o material: falta dizer qual etapa é a entrega.', portao),
        hint    = format('Se é em %s que o cliente dá a palavra final, mude "O que é" dela para "Entrega ao cliente" — o nome da etapa continua o mesmo, e ela segue sendo o trabalho de quem a faz. Se depois dela ainda há um passo em que a gestão confere e manda, é esse passo que é a entrega.', portao);
    end if;

    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo precisa de uma etapa de entrega ao cliente.',
      hint    = 'A entrega é o portão: é nela que o material sai da agência e a rodada do cliente nasce. Sem ela nenhum post deste fluxo chega a ele. Marque em "O que é" qual etapa da corrente é essa.';
  end if;

  -- DUAS ENTREGAS SAO DOIS PORTOES FINAIS, e `porta_do_cliente_no_post()`
  -- devolve o PRIMEIRO portao em aberto: a segunda ficaria para sempre
  -- esperando uma decisao que o produto nao tem como pedir duas vezes.
  if entregas > 1 then
    raise exception using
      errcode = 'check_violation',
      message = format('O fluxo tem %s etapas de entrega, e a entrega é uma só.', entregas),
      hint    = 'Enviar ao cliente é uma decisão por material. Se há um segundo aval no meio da corrente, marque aquela etapa como "o cliente aprova" em vez de criar outra entrega.';
  end if;

  -- A ORDEM E PRODUCAO, ENTREGA, POS-ENTREGA, e a recusa NOMEIA a etapa fora
  -- de lugar: "a ordem está errada" manda a pessoa conferir seis linhas.
  select string_agg(s.nome, ', ' order by s.ordem) into fora
    from public.social_flow_steps s
   where s.flow_id = p_flow_id
     and ((s.papel = 'producao'    and s.ordem > ord_entr)
       or (s.papel = 'pos_entrega' and s.ordem < ord_entr));

  if fora is not null then
    raise exception using
      errcode = 'check_violation',
      message = format('No fluxo, %s está do lado errado da entrega.', fora),
      hint    = 'A corrente é produção, entrega e depois o que vem da decisão do cliente. Trabalho que acontece antes de enviar é produção; o que acontece depois de ele aprovar é pós-entrega.';
  end if;
end;
$$;

comment on function public.conferir_fluxo_de_social is
  'A corrente de um fluxo e producao*, entrega, pos-entrega* (0087). A recusa nomeia o elo fora de lugar -- e, quando nao ha entrega mas ha um portao de cliente, diz que e aquele elo que precisa ser marcado como a entrega (0089).';


-- ---------------------------------------------------------------------------
-- CONFERENCIA, para colar no SQL Editor depois de aplicar
--
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'social_flow_steps'
--      and column_name in ('comeca_dias_antes', 'termina_dias_antes');
--   -- zero linhas: as duas sairam
--
--   select count(*) from information_schema.routines
--    where routine_schema = 'public' and routine_name = 'salvar_fluxo_de_social';
--   -- 1: nao nasceu uma segunda funcao ao lado
-- ---------------------------------------------------------------------------
