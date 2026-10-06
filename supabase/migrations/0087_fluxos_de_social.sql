-- ===========================================================================
-- 0087 - FLUXOS DE SOCIAL: a corrente deixa de ser fixa
--
-- Decisao do usuario: *"algumas contas possuem um fluxo de aprovacao
-- diferentes, por exemplo. Algumas contas validam pauta e conteudo, antes de
-- ir para Producao de Layout. E apos o layout feito, ele tambem vai para
-- aprovacao do cliente. Preciso poder montar fluxos de Social diferentes,
-- para serem aplicados em determinados socials, de meses de determinadas
-- contas, entendeu?"*
--
-- O CABECALHO DA 0045 PREVIU ESTA MIGRATION, em quantas palavras: *"a cadeia
-- mora em `etapas_padrao_do_social()`; se um dia precisar ser editavel por
-- cliente, vira tabela de modelo, e e decisao explicita"*. E esta.
--
--
-- O QUE A 0076 JA FAZIA, E O QUE FALTAVA
--
-- A 0076 ja punha o cliente aprovando etapa por etapa -- `aprovacao_cliente`
-- em `post_etapas`, a lista em `client_flow_defaults.social_aprovacoes`, o
-- portao derivado da ordem. Tres coisas ela nao fazia:
--
--   1. A LISTA ERA DA CONTA, e nao um fluxo com nome. Nao havia o que
--      reaproveitar: duas contas com o mesmo combinado eram duas listas
--      escritas duas vezes.
--   2. AS ETAPAS ERAM FIXAS -- Pauta, Conteudo, Layout, Envio, Programar, as
--      cinco que o usuario ditou na 0045. Nao dava para acrescentar uma
--      revisao, renomear "Layout" para "Producao de Layout" nem tirar a etapa
--      que uma conta nao usa.
--   3. E O COMBINADO ERA DA CONTA PARA SEMPRE, nao do MES. A frase do usuario
--      e *"aplicados em determinados socials, de meses de determinadas
--      contas"*: o mes escolhe.
--
--
-- DUAS TABELAS E NAO UM `jsonb`, pelo criterio que o produto ja escreveu para
-- `post_versions.arquivos`: jsonb e para o que se escreve de uma vez e se le
-- inteiro, nunca consultado item a item. A etapa de um fluxo e consultada item
-- a item -- `montar_etapas_do_post` percorre uma por uma, a validacao de
-- `p_prazos` pergunta se existe etapa com aquele nome, e a tela do editor
-- mostra uma linha por etapa. E a mesma forma de `workflow_templates` +
-- `workflow_steps` (0007), que e a cadeia da demanda e e o par analogo um
-- modulo ao lado.
--
--
-- O PAPEL E COLUNA, E NAO O NOME DA ETAPA -- e esta e a decisao que faz o
-- resto caber.
--
-- Com a cadeia fixa, 'Envio' podia ser uma palavra: ela aparecia escrita em
-- SEIS comparacoes -- "o Envio nao se marca a mao" (0045), "o portao e o Envio
-- ou quem tem a marca" (0076), "o Envio e o Programar nunca recebem a marca"
-- (0076), "o post volta para producao quando o portao nao e o Envio" (0076), o
-- rotulo do ajuste, e quem refaz. Com a cadeia editavel isso vira o furo
-- classico desta casa: um fluxo que chama a etapa de "Entrega" em vez de
-- "Envio" ficaria SEM PORTAO DO CLIENTE NENHUM, sem erro em lugar nenhum --
-- o mes abriria, os posts nasceriam, e ninguem conseguiria mandar nada para
-- fora da agencia. "Duas verdades" na forma mais cara.
--
-- Entao o papel e um enum de tres valores, e as duas razoes que a 0076
-- escreveu para excluir o Envio e o Programar da lista de portoes passam a ser
-- dados em vez de duas palavras:
--
--   * `producao`    - o trabalho de alguem. PODE virar portao do cliente.
--   * `entrega`     - E o portao, por natureza: enviar ao cliente E abrir a
--                     rodada dele (0032). Uma por fluxo, nem zero nem duas.
--   * `pos_entrega` - vem DEPOIS da decisao. Por o cliente para aprova-la
--                     seria pedir o aval de um trabalho que so existe porque
--                     ele ja aprovou.
--
--
-- `social_aprovacoes` E APAGADA, e nao aposentada ao lado da nova -- a decisao
-- da 0023, que apagou `tasks.exigencia_aprovacao` em vez de deixa-la parada.
-- Duas listas dizendo quais etapas vao ao cliente seriam duas verdades, e no
-- dia em que uma divergisse o portal mostraria um portao que a corrente nao
-- tem. A migration converte: cada conta com lista nao vazia ganha um fluxo
-- proprio, com as mesmas marcas, e passa a apontar para ele. O comportamento
-- de hoje continua igual depois de aplicar.
--
--
-- O MES GUARDA O `social_flow_id`, E NAO UM SNAPSHOT EM `jsonb`.
--
-- `tasks.workflow_snapshot` (0008) existe porque o workflow carrega o que a
-- subtarefa nao guarda -- funcao padrao, offset de prazo. Aqui a
-- materializacao JA E o snapshot: `post_etapas` tem nome, funcao, papel e a
-- marca do cliente copiados no instante em que o post nasceu, e editar o fluxo
-- depois nao encosta neles. O que a coluna responde e outra pergunta: *abrir o
-- mesmo mes em duas vezes acrescenta posts a demanda que ja existe* (0061), e
-- sem ela a segunda chamada poderia usar outro fluxo -- um mes com duas
-- correntes diferentes dentro.
--
--
-- O QUE SAI DE PE, e e o ponto: nenhuma trava do cliente afrouxa. O portao
-- continua derivado da ordem (0076), a rodada continua sendo a unica porta
-- para `concluida`, o Envio continua sem se marcar a mao, e o cliente continua
-- sem policy nenhuma em `post_etapas` nem em `social_flow_steps`.
--
--
-- MEDIDO COM MUTACAO, no arquivo 42:
--
--   1. trocar `papel = 'entrega'` por `nome = 'Envio'` em
--      `porta_do_cliente_no_post`      -> 5 cenarios caem
--   2. aceitar fluxo sem etapa de entrega (tirar a trava do PASSO 2)
--                                      -> 3 cenarios caem
--   3. aceitar duas etapas de entrega  -> 2 cenarios caem
--   4. deixar `aprovacao_cliente` em qualquer papel (`check (true)`)
--                                      -> 5 cenarios caem
--   5. fazer `fluxo_do_post()` ler a conta antes do mes
--                                      -> 1 cenario cai
--   6. tirar `tasks.social_flow_id` da leitura de `abrir_mes_de_social`
--                                      -> 1 cenario cai
--
-- E A CONVERSAO DO PASSO 5 NAO DA PARA MEDIR AQUI, e vale dito em vez de
-- escondido: ela depende de uma conta com `social_aprovacoes` preenchida ANTES
-- desta migration, e a coluna nao existe mais no banco em que a bateria roda.
-- O que o arquivo 42 mede e que a coluna SAIU; quem prova que o produto
-- continua tendo portao do meio e o arquivo 39, que monta um fluxo e o aponta.
-- Quem for conferir a conversao de verdade confere no banco de producao, antes
-- e depois -- e e por isso que a migration escreve o `select` de conferencia
-- no fim.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 0 - O papel de cada elo
--
-- `create type` nao tem `if not exists`, e a migration precisa poder rodar
-- mais de uma vez -- e a forma que todo enum deste projeto usa.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'social_flow_papel') then
    create type public.social_flow_papel as enum ('producao', 'entrega', 'pos_entrega');
  end if;
end;
$$;

comment on type public.social_flow_papel is
  'O papel de um elo da corrente do social: producao (o trabalho de alguem, que pode virar portao do cliente), entrega (E o portao -- enviar ao cliente E abrir a rodada) e pos_entrega (vem depois da decisao). Ver o cabecalho da 0087.';


-- ---------------------------------------------------------------------------
-- PASSO 1 - O fluxo e os elos dele
--
-- `nome` e UNICO, e e de proposito: a tela do editor lista fluxos por nome, e
-- dois "Padrao da casa" na mesma lista e uma escolha que ninguem consegue
-- fazer. Fluxo que nao serve mais se desativa (`ativo = false`), como a
-- etiqueta da Academy: apagar levaria junto o nome que os meses ja abertos
-- apontam.
-- ---------------------------------------------------------------------------

create table if not exists public.social_flows (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  descricao  text,
  ativo      boolean not null default true,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.social_flows is
  'Um fluxo de social: a corrente de etapas que os posts de um mes percorrem, com os portoes do cliente dentro dela. Aplicado por MES de cada conta (0087).';

create table if not exists public.social_flow_steps (
  id                 uuid primary key default gen_random_uuid(),
  flow_id            uuid not null references public.social_flows (id) on delete cascade,
  -- COM ESPACO ENTRE OS NUMEROS, como `post_etapas.ordem` (0045): a etapa de
  -- Ajustes nasce ENTRE duas, e com ordem sequencial um pedido do cliente
  -- obrigaria a renumerar as seguintes.
  ordem              integer not null,
  nome               text not null,
  funcao             public.team_funcao not null,
  papel              public.social_flow_papel not null default 'producao',
  aprovacao_cliente  boolean not null default false,
  -- AS DUAS PONTAS SUGERIDAS, contadas do dia 1 do mes que esta sendo aberto
  -- (0083 e 0084). Elas viajam com o FLUXO e nao com a tela, e a razao e a
  -- cadeia editavel: `ETAPAS_DA_CORRENTE` em TypeScript sabia sugerir os dias
  -- das cinco etapas que ela mesma listava, e nao sabe sugerir nada para uma
  -- etapa que alguem acrescentou. Dez campos de data vazios fariam quem abre o
  -- mes inventar dez datas na hora.
  comeca_dias_antes  integer,
  termina_dias_antes integer,
  -- QUAL CAMPO DO CARD ESTE ELO ENCHE (0046): a Pauta enche `posts.pauta`, o
  -- Conteudo enche `posts.legenda`, o Layout enche a versao -- e a versao
  -- viaja pela arte, entao ali nao ha campo de texto.
  --
  -- ELE E COLUNA E NAO O NOME DA ETAPA, pela razao do `papel`: o de-para da
  -- 0046 era `case e.nome when 'Pauta' then p.pauta ...`, e com a cadeia
  -- editavel renomear "Pauta" para "Pauta do mes" faria a tela do portal
  -- abrir o portao com o texto VAZIO -- o cliente lendo uma caixa em branco e
  -- decidindo sobre ela.
  campo              text,
  created_at         timestamptz not null default now(),
  unique (flow_id, ordem),
  -- O NOME E UNICO DENTRO DO FLUXO, e isto nao e zelo: `p_prazos` de
  -- `abrir_mes_de_social` e um mapa POR NOME DE ETAPA desde a 0059, e duas
  -- etapas homonimas receberiam as duas o mesmo periodo -- com a trava da
  -- ordem recusando o mes em seguida, por uma razao que a mensagem nao teria
  -- como explicar.
  unique (flow_id, nome),
  constraint social_flow_steps_ordem_positiva check (ordem > 0),
  -- O PORTAO SO CABE NUM ELO DE PRODUCAO, e as duas metades sao as duas razoes
  -- que a 0076 escreveu. A entrega JA e o portao: a marca nela seria ligar o
  -- que esta ligado. O pos_entrega vem depois da decisao: a marca nele pediria
  -- ao cliente o aval de um trabalho que so existe porque ele ja aprovou.
  constraint social_flow_steps_portao_coerente
    check (not (aprovacao_cliente and papel <> 'producao')),
  -- SAO OS DOIS CAMPOS DE TEXTO QUE O CARD TEM, e um terceiro nome aqui seria
  -- uma etapa prometendo encher uma coluna que nao existe.
  constraint social_flow_steps_campo_conhecido
    check (campo is null or campo in ('pauta', 'legenda'))
);

comment on table public.social_flow_steps is
  'Os elos de um fluxo de social, em ordem. O papel diz qual deles E a entrega ao cliente -- nunca o nome, ver o cabecalho da 0087.';

comment on column public.social_flow_steps.aprovacao_cliente is
  'Esta etapa passa pelo cliente antes de a proxima comecar. So vale em elo de producao: a entrega ja E o portao e o pos_entrega vem depois da decisao.';

create index if not exists social_flow_steps_flow_idx
  on public.social_flow_steps (flow_id, ordem);

alter table public.social_flows      enable row level security;
alter table public.social_flow_steps enable row level security;

-- O CLIENTE NAO TEM POLICY NENHUMA AQUI, e a ausencia e a trava -- a mesma
-- linha de `post_etapas` (0045). O fluxo e conversa interna: quem produz o
-- que, em que ordem, com que prazo. O que o cliente precisa saber e qual
-- material esta esperando ele, e quem responde isso e
-- `o_que_o_cliente_decide()` (0076).
--
-- A EQUIPE INTEIRA LE, pela razao que moveu o modulo de Social para `EQUIPE`
-- na 0054: quem produz precisa saber em que pe da corrente esta o trabalho
-- dele. Quem ESCREVE e a gestao, como em `workflow_templates`.
drop policy if exists social_flows_select on public.social_flows;
create policy social_flows_select on public.social_flows
  for select to authenticated using (public.is_staff());

drop policy if exists social_flows_write on public.social_flows;
create policy social_flows_write on public.social_flows
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

drop policy if exists social_flow_steps_select on public.social_flow_steps;
create policy social_flow_steps_select on public.social_flow_steps
  for select to authenticated using (public.is_staff());

drop policy if exists social_flow_steps_write on public.social_flow_steps;
create policy social_flow_steps_write on public.social_flow_steps
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 2 - A TRAVA DA CORRENTE: producao* entrega pos_entrega*
--
-- O `check` do PASSO 1 e por LINHA, e a pergunta que importa e sobre o
-- conjunto: *um fluxo com etapa e sem entrega e um mes cujos posts nunca
-- chegam ao cliente* -- o mes abre, os doze posts nascem, a corrente anda, e
-- "Enviar ao cliente" fica desligado para sempre sem nada na tela dizendo por
-- que. E o modo de falha mais caro que esta migration cria, entao ele e trava
-- de banco e nao validacao de action.
--
-- E O GATILHO E POR INSTRUCAO E NAO POR LINHA, com transition table, porque a
-- pergunta e sobre o conjunto: um gatilho `for each row` recusaria a PRIMEIRA
-- etapa de um fluxo novo -- naquele instante o fluxo tem uma linha e nenhuma
-- entrega. Por instrucao, o `delete` que esvazia o fluxo nao tem o que
-- conferir e o `insert` que o remonta ve a corrente inteira. E a mesma forma
-- de "as duas sao gravadas juntas pela mesma acao" (0007), com a diferenca de
-- que aqui o banco confere o resultado.
--
-- POR QUE NAO `deferrable initially deferred`, que e a forma mais obvia: uma
-- constraint diferida dispara no COMMIT da transacao de cima, e nao no fim de
-- um bloco `begin ... exception` -- que e exatamente onde `teste.recusa_com`
-- espera a recusa. A trava existiria e a bateria nao teria como medi-la, que
-- e o mesmo que nao ter trava.
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
  -- estado entre o `delete` e o `insert` de quem o esta reescrevendo. Quem
  -- recusa usar um fluxo vazio e `abrir_mes_de_social`, com a frase que diz o
  -- que falta -- recusar aqui travaria a edicao para proteger o uso.
  if quantas = 0 then
    return;
  end if;

  select count(*) filter (where s.papel = 'entrega'),
         min(s.ordem) filter (where s.papel = 'entrega')
    into entregas, ord_entr
    from public.social_flow_steps s where s.flow_id = p_flow_id;

  if entregas = 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo precisa de uma etapa de entrega ao cliente.',
      hint    = 'A entrega é o portão: é nela que o material sai da agência e a rodada do cliente nasce. Sem ela nenhum post deste fluxo chega a ele.';
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
  -- de lugar: "a ordem está errada" manda a pessoa conferir seis linhas; dizer
  -- qual e a diferenca entre uma recusa e uma instrucao -- a decisao da 0023.
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
  'Recusa um fluxo de social incoerente: sem entrega, com duas, ou com elo do lado errado dela. Chamada pelos gatilhos de `social_flow_steps` -- ver o PASSO 2 da 0087.';


create or replace function public.social_flow_steps_mudou()
returns trigger
language plpgsql
as $$
declare
  f uuid;
begin
  for f in select distinct n.flow_id from novas n loop
    perform public.conferir_fluxo_de_social(f);
  end loop;
  return null;
end;
$$;

create or replace function public.social_flow_steps_saiu()
returns trigger
language plpgsql
as $$
declare
  f uuid;
begin
  for f in select distinct a.flow_id from antigas a loop
    perform public.conferir_fluxo_de_social(f);
  end loop;
  return null;
end;
$$;

drop trigger if exists social_flow_steps_confere_insert on public.social_flow_steps;
create trigger social_flow_steps_confere_insert
  after insert on public.social_flow_steps
  referencing new table as novas
  for each statement execute function public.social_flow_steps_mudou();

-- SAO DOIS GATILHOS NO UPDATE, e nao um, porque um gatilho tem uma funcao: o
-- de cima confere o fluxo de DESTINO e o de baixo o de ORIGEM. Mover um elo de
-- um fluxo para outro deixa os dois para conferir, e so o `new` nao ve o que
-- ficou para tras.
drop trigger if exists social_flow_steps_confere_update_novas on public.social_flow_steps;
create trigger social_flow_steps_confere_update_novas
  after update on public.social_flow_steps
  referencing new table as novas
  for each statement execute function public.social_flow_steps_mudou();

drop trigger if exists social_flow_steps_confere_update_antigas on public.social_flow_steps;
create trigger social_flow_steps_confere_update_antigas
  after update on public.social_flow_steps
  referencing old table as antigas
  for each statement execute function public.social_flow_steps_saiu();

drop trigger if exists social_flow_steps_confere_delete on public.social_flow_steps;
create trigger social_flow_steps_confere_delete
  after delete on public.social_flow_steps
  referencing old table as antigas
  for each statement execute function public.social_flow_steps_saiu();


-- ---------------------------------------------------------------------------
-- PASSO 3 - O fluxo padrao da casa
--
-- Sao as cinco etapas que o usuario ditou na 0045, com os periodos sugeridos
-- que a 0084 pos em `ETAPAS_DA_CORRENTE`. Ele nasce na migration pela razao
-- dos workflows da 0008: um catalogo vazio no primeiro dia faz o modulo
-- estrear sem funcionar -- quem abre o mes encontra um seletor sem opcao e
-- conclui que a area nao esta pronta.
--
-- O ID E LITERAL, e e o que torna a migration re-executavel: `on conflict do
-- nothing` num id fixo nao reescreve o fluxo que alguem ja editou. Rodar duas
-- vezes nao devolve "Layout" a quem renomeou para "Producao de Layout".
-- ---------------------------------------------------------------------------

insert into public.social_flows (id, nome, descricao)
values ('f1000000-0000-4000-8000-000000000001',
        'Padrão da casa',
        'A corrente que a agência percorre desde sempre: pauta, conteúdo, layout, envio ao cliente e programação. Só o envio passa por ele.')
on conflict (id) do nothing;

-- As cinco etapas, so se o fluxo da casa ainda estiver vazio. Sem este `if`,
-- um `on conflict (flow_id, ordem) do nothing` recriaria a etapa que alguem
-- apagou de proposito -- e a migration voltaria a por na corrente da agencia
-- um elo que ela tirou.
do $$
begin
  if not exists (select 1 from public.social_flow_steps s
                  where s.flow_id = 'f1000000-0000-4000-8000-000000000001') then
    insert into public.social_flow_steps
      (flow_id, ordem, nome, funcao, papel, campo,
       comeca_dias_antes, termina_dias_antes)
    values
      ('f1000000-0000-4000-8000-000000000001', 10, 'Pauta',     'Social Media', 'producao',    'pauta',   31, 27),
      ('f1000000-0000-4000-8000-000000000001', 20, 'Conteúdo',  'Redator',      'producao',    'legenda', 26, 20),
      ('f1000000-0000-4000-8000-000000000001', 30, 'Layout',    'Design',       'producao',    null,      19, 12),
      -- O ENVIO E DA GESTAO porque enviar ao cliente e dela desde a 0007, e
      -- essa regra nao mudou aqui.
      ('f1000000-0000-4000-8000-000000000001', 40, 'Envio',     'Gestao',       'entrega',     null,      11,  7),
      ('f1000000-0000-4000-8000-000000000001', 50, 'Programar', 'Social Media', 'pos_entrega', null,       6,  2);
  end if;
end;
$$;


create or replace function public.fluxo_padrao_da_casa()
returns uuid
language plpgsql
stable
as $$
declare
  f uuid;
begin
  select s.id into f
    from public.social_flows s
   where s.id = 'f1000000-0000-4000-8000-000000000001' and s.ativo;

  -- O FLUXO DA CASA PODE TER SIDO DESATIVADO OU APAGADO, e nao existe trava
  -- impedindo -- uma agencia que montou os fluxos dela nao precisa carregar o
  -- padrao que veio de fabrica. A volta e o fluxo ATIVO mais antigo, que e a
  -- resposta menos surpreendente: o primeiro que alguem montou. Nao havendo
  -- nenhum, quem recusa e `abrir_mes_de_social`, com a frase que diz o que
  -- falta -- devolver nulo aqui e dizer a verdade.
  if f is null then
    select s.id into f
      from public.social_flows s
     where s.ativo
     order by s.created_at, s.id
     limit 1;
  end if;

  return f;
end;
$$;

comment on function public.fluxo_padrao_da_casa is
  'O fluxo de social usado quando a conta e o mes nao escolheram nenhum. Nulo quando nao ha fluxo ativo no banco.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - Onde o fluxo e escolhido: a conta e o MES
--
-- A conta tem um padrao, e o mes manda. E a mesma ordem de
-- `coalesce(etapa, padrao)` da 0041 e de
-- `etapas_resolvidas_do_workflow()` (0064): quem escreveu no lugar mais
-- especifico mandou. A inversao transformaria o campo da conta numa arma --
-- trocar o padrao da conta reescreveria o fluxo dos meses que ja estao
-- correndo.
--
-- E `on delete set null` NOS DOIS, e nao `cascade`: apagar um fluxo nao pode
-- apagar o mes de social de dez clientes. O mes fica apontando para ninguem, e
-- a corrente dele continua inteira -- ela esta materializada em `post_etapas`
-- desde que o post nasceu.
-- ---------------------------------------------------------------------------

alter table public.client_flow_defaults
  add column if not exists social_flow_id uuid
    references public.social_flows (id) on delete set null;

comment on column public.client_flow_defaults.social_flow_id is
  'O fluxo de social que os meses desta conta usam por padrao. Nulo vale o padrao da casa; o mes pode escolher outro (0087).';

alter table public.tasks
  add column if not exists social_flow_id uuid
    references public.social_flows (id) on delete set null;

comment on column public.tasks.social_flow_id is
  'O fluxo que o mes de social desta demanda usa. Preenchido so em demanda de mes (`social_do_mes`), e e ele que faz abrir o mesmo mes em duas vezes usar a MESMA corrente (0087).';

-- O PAPEL VIAJA PARA A ETAPA MATERIALIZADA, pela razao do cabecalho: o produto
-- perguntava `nome = 'Envio'` em seis lugares, e com a cadeia editavel um
-- fluxo que chame a entrega de outra coisa ficaria sem portao nenhum. E a
-- mesma forma de `aprovacao_cliente`, que a 0076 copiou da conta para a etapa.
alter table public.post_etapas
  add column if not exists papel public.social_flow_papel not null default 'producao';

comment on column public.post_etapas.papel is
  'O papel deste elo: producao, entrega (E o portao do cliente) ou pos_entrega. Copiado do fluxo quando o post nasceu -- nunca deduzido do nome, ver o cabecalho da 0087.';

alter table public.post_etapas
  add column if not exists campo text;

comment on column public.post_etapas.campo is
  'Qual campo do card este elo enche: pauta, legenda ou nenhum. Copiado do fluxo quando o post nasceu -- nunca deduzido do nome, ver o cabecalho da 0087.';

-- AS CORRENTES QUE JA EXISTEM GANHAM O PAPEL, pelos nomes que eram a unica
-- resposta ate aqui. Sem esta passada, todo post anterior a 0087 ficaria com
-- os cinco elos em `producao` -- e `porta_do_cliente_no_post()`, que passa a
-- perguntar pelo papel, nao acharia portao nenhum: o produto inteiro pararia
-- de conseguir enviar material ao cliente, nos posts que ja estao no ar.
update public.post_etapas set papel = 'entrega'
 where nome = 'Envio' and papel <> 'entrega';

update public.post_etapas set papel = 'pos_entrega'
 where nome = 'Programar' and papel <> 'pos_entrega';

update public.post_etapas set campo = 'pauta'
 where nome = 'Pauta' and campo is null;

update public.post_etapas set campo = 'legenda'
 where nome = 'Conteúdo' and campo is null;


-- ---------------------------------------------------------------------------
-- PASSO 5 - `social_aprovacoes` VIRA FLUXO, e a coluna e apagada
--
-- A decisao da 0023: a coluna sai, nao fica parada ao lado da nova. Duas
-- listas dizendo quais etapas vao ao cliente seriam duas verdades, e a que
-- divergisse e justamente a antiga -- a aba Configuracoes do fluxo passa a
-- escrever no fluxo, e ninguem mais olharia a coluna.
--
-- A CONVERSAO E A METADE QUE IMPORTA. Sem ela toda conta que combinou aprovar
-- a pauta perderia o portao no instante em que esta migration fosse aplicada:
-- o mes seguinte abriria com os posts indo direto ao Envio, e a frase do
-- contrato -- "esta conta valida a pauta" -- deixaria de valer sem ninguem ter
-- decidido isso. Cada conta com lista nao vazia ganha um fluxo PROPRIO, com as
-- mesmas marcas, e passa a apontar para ele.
--
-- UM FLUXO POR CONTA e nao um por conjunto distinto de marcas: o nome e o que
-- a tela do editor lista, e "Padrao da casa + Pauta" nao diz a ninguem de quem
-- e aquele combinado. Duas contas com o mesmo fluxo convergem na mao de quem
-- as administra, que e quem sabe se o combinado e o mesmo.
-- ---------------------------------------------------------------------------

do $$
declare
  conta    record;
  novo     uuid;
  etiqueta text;
begin
  -- A coluna pode nao existir, num banco que ja aplicou esta migration antes.
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public'
                    and table_name = 'client_flow_defaults'
                    and column_name = 'social_aprovacoes') then
    return;
  end if;

  for conta in
    execute $q$
      select d.client_id, d.social_aprovacoes as marcas, c.nome_empresa
        from public.client_flow_defaults d
        join public.clients c on c.id = d.client_id
       where coalesce(array_length(d.social_aprovacoes, 1), 0) > 0
         and d.social_flow_id is null
    $q$
  loop
    -- `novo` E ZERADO A CADA VOLTA: com `on conflict do nothing`, o
    -- `returning into` nao escreve nada quando o insert nao acontece -- e a
    -- variavel ficaria com o id da volta anterior, apontando a conta de hoje
    -- para o fluxo de outra empresa.
    novo := null;
    etiqueta := format('Fluxo de %s', conta.nome_empresa);

    -- DUAS EMPRESAS HOMONIMAS dariam dois fluxos com o mesmo nome, e `nome` e
    -- unico. O sufixo e o pedaco do id da conta, que e feio e verdadeiro --
    -- melhor que a segunda conta ficar sem fluxo e sem portao.
    if exists (select 1 from public.social_flows f where f.nome = etiqueta) then
      etiqueta := format('Fluxo de %s (%s)', conta.nome_empresa,
                         left(conta.client_id::text, 8));
    end if;

    insert into public.social_flows (nome, descricao)
    values (etiqueta,
            format('Veio da configuração desta conta: além do envio, o cliente aprova %s.',
                   array_to_string(conta.marcas, ', ')))
    on conflict (nome) do nothing
    returning id into novo;

    if novo is null then
      continue;
    end if;

    -- A CORRENTE E A DA CASA, com as marcas da conta. O `and s.papel =
    -- 'producao'` nao e redundante com o `check` da tabela: a lista antiga
    -- aceitava 'Envio' e 'Programar' escritos a mao -- a 0076 so os filtrava
    -- na hora de montar a etapa --, entao ha banco com os dois dentro dela.
    insert into public.social_flow_steps
      (flow_id, ordem, nome, funcao, papel, campo, aprovacao_cliente,
       comeca_dias_antes, termina_dias_antes)
    select novo, s.ordem, s.nome, s.funcao, s.papel, s.campo,
           s.papel = 'producao' and s.nome = any(conta.marcas),
           s.comeca_dias_antes, s.termina_dias_antes
      from public.social_flow_steps s
     where s.flow_id = 'f1000000-0000-4000-8000-000000000001'
     order by s.ordem;

    update public.client_flow_defaults
       set social_flow_id = novo, updated_at = now()
     where client_id = conta.client_id;
  end loop;
end;
$$;

alter table public.client_flow_defaults drop column if exists social_aprovacoes;

-- `etapas_que_o_cliente_pode_aprovar()` SAI JUNTO, e pela mesma razao: ela
-- respondia "quais das cinco dao para marcar", e a resposta virou uma coluna
-- -- `papel = 'producao'`, que o `check` da tabela ja cobra. Uma funcao
-- dizendo a mesma coisa seria a segunda verdade que a coluna acabou de
-- desfazer.
drop function if exists public.etapas_que_o_cliente_pode_aprovar();


-- ---------------------------------------------------------------------------
-- PASSO 6 - As duas perguntas: quais etapas o fluxo tem, e qual fluxo e o deste post
--
-- `etapas_padrao_do_social()` SAI, e nao vira apelido de `etapas_do_fluxo()`.
-- Duas funcoes respondendo "qual e a corrente" sao o lugar onde as duas
-- verdades comecam a divergir, e a segunda seria a que alguem chama sem
-- perceber que ela ignora o fluxo da conta -- montando um mes com a corrente
-- da casa numa conta que combinou outra. E a decisao da 0023 aplicada a uma
-- funcao: ela e apagada, e os tres chamadores sao reescritos aqui.
--
-- O `drop` E OBRIGATORIO E NAO ESTILO: `create or replace` nao troca o tipo de
-- linha de um `returns table`, e `etapas_do_fluxo` devolve seis colunas onde a
-- antiga devolvia tres.
-- ---------------------------------------------------------------------------

drop function if exists public.etapas_padrao_do_social();

create or replace function public.etapas_do_fluxo(p_flow_id uuid)
returns table (
  ordem              integer,
  nome               text,
  funcao             public.team_funcao,
  papel              public.social_flow_papel,
  aprovacao_cliente  boolean,
  campo              text,
  comeca_dias_antes  integer,
  termina_dias_antes integer
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
  -- `social_flow_steps`, que e a trava do PASSO 1. Sem o definer, o cliente
  -- aprovando um post levaria uma lista vazia e a corrente nao andaria.
  -- O que sai daqui e a corrente, nunca material de conta nenhuma.
  return query
    select s.ordem, s.nome, s.funcao, s.papel, s.aprovacao_cliente, s.campo,
           s.comeca_dias_antes, s.termina_dias_antes
      from public.social_flow_steps s
     where s.flow_id = p_flow_id
     order by s.ordem;
end;
$$;

comment on function public.etapas_do_fluxo is
  'Os elos de um fluxo de social, em ordem. Substitui `etapas_padrao_do_social()` da 0045, que respondia pela unica corrente que existia (0087).';


create or replace function public.fluxo_do_post(p_post_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f uuid;
begin
  -- A ORDEM E MES -> CONTA -> CASA, e ela nao e arbitraria: e a mesma de
  -- `coalesce(etapa, padrao)` (0041) e de `etapas_resolvidas_do_workflow()`
  -- (0064) -- quem escreveu no lugar mais especifico mandou. Lendo a conta
  -- primeiro, trocar o padrao dela reescreveria a corrente dos meses que estao
  -- correndo, e a frase do usuario e o contrario: *"aplicados em determinados
  -- socials, de meses de determinadas contas"*.
  select t.social_flow_id into f
    from public.posts p
    join public.subtasks s on s.id = p.subtask_id
    join public.tasks t    on t.id = s.task_id
   where p.id = p_post_id
     and t.social_flow_id is not null;

  if f is not null then
    return f;
  end if;

  -- POST AVULSO NAO TEM MES A CONSULTAR, e cai na conta -- a verdade do que
  -- ele e: um post que ninguem abriu dentro de um mes (0061).
  select d.social_flow_id into f
    from public.posts p
    join public.client_flow_defaults d on d.client_id = p.client_id
   where p.id = p_post_id
     and d.social_flow_id is not null;

  return coalesce(f, public.fluxo_padrao_da_casa());
end;
$$;

comment on function public.fluxo_do_post is
  'O fluxo de social que vale para um post: o do mes dele, senao o da conta, senao o da casa (0087).';


create or replace function public.fluxo_do_mes(
  p_client_id uuid,
  p_flow_id   uuid default null
)
returns uuid
language plpgsql
stable
as $$
declare
  f uuid;
begin
  if p_flow_id is not null then
    return p_flow_id;
  end if;

  select d.social_flow_id into f
    from public.client_flow_defaults d
   where d.client_id = p_client_id;

  return coalesce(f, public.fluxo_padrao_da_casa());
end;
$$;

comment on function public.fluxo_do_mes is
  'O fluxo que um mes de social vai usar: o escolhido no dialogo, senao o padrao da conta, senao o da casa (0087).';


-- ---------------------------------------------------------------------------
-- PASSO 7 - As SEIS perguntas que eram a palavra 'Envio'
--
-- Daqui para baixo nenhuma funcao do produto compara nome de etapa. As seis
-- comparacoes que existiam -- listadas no cabecalho -- viraram `papel`, e as
-- duas do de-para do card viraram `campo`.
--
-- AS QUATRO FUNCOES SAO REESCRITAS INTEIRAS a partir da versao da 0076, que e
-- a ultima de cada uma. `create or replace` se reescreve a partir da versao
-- mais nova e NAO AVISA quando a nova tem menos coisa que a velha -- foi assim
-- que a 0030 perdeu os carimbos de data da 0007, e ninguem viu por dois
-- sprints.
-- ---------------------------------------------------------------------------

create or replace function public.porta_do_cliente_no_post(p_post_id uuid)
returns public.post_etapas
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e public.post_etapas;
begin
  -- `pe.papel = 'entrega'` ONDE ERA `pe.nome = 'Envio'` (0087). E a linha mais
  -- importante desta migration do lado da leitura: ela e a pergunta "qual
  -- decisao do cliente vem a seguir", e `porta_do_cliente_no_post()` e
  -- consultada por `posts_corrente_do_cliente`, por `validar_nova_rodada` e
  -- pela tela do portal. Com o nome, um fluxo que chame a entrega de "Entrega"
  -- devolveria nulo nas tres -- e o produto pararia de conseguir mandar
  -- material para fora da agencia, sem erro em lugar nenhum.
  select pe.* into e
    from public.post_etapas pe
   where pe.post_id = p_post_id
     and (pe.aprovacao_cliente or pe.papel = 'entrega')
     and pe.status <> 'concluida'
   order by pe.ordem
   limit 1;

  return e;
end;
$$;

comment on function public.porta_do_cliente_no_post is
  'A etapa da corrente que a proxima decisao do cliente fecha. Derivada da ordem (0076) e reconhecida pelo PAPEL (0087), nunca pelo nome.';


create or replace function public.montar_etapas_do_post(
  p_post_id       uuid,
  p_responsaveis  jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  e        record;
  quantas  integer := 0;
  fluxo    uuid;
begin
  -- QUAL FLUXO. O GUC vem primeiro, e ele existe por uma razao de ORDEM:
  -- `abrir_mes_de_social` insere o post ANTES de criar a subtarefa do mes e de
  -- gravar `posts.subtask_id` -- a corrente nasce pelo gatilho `after insert`
  -- (0045), num instante em que o post ainda nao sabe de que mes e. Sem o GUC,
  -- `fluxo_do_post()` cairia no padrao da CONTA e o mes abriria com a corrente
  -- errada: o fluxo escolhido no dialogo nao valeria para nada.
  --
  -- Reordenar a funcao para criar a subtarefa primeiro resolveria tambem, e
  -- por um preco maior: o titulo da subtarefa e o tema do post (0061), que so
  -- existe depois do insert.
  --
  -- E o GUC e `set local`: morre no fim da transacao e nao atravessa a
  -- requisicao do PostgREST, entao ninguem o liga por fora. E a forma de
  -- `full_hub.corrente` (0045).
  fluxo := nullif(coalesce(current_setting('full_hub.fluxo_do_mes', true), ''), '')::uuid;

  if fluxo is null then
    fluxo := public.fluxo_do_post(p_post_id);
  end if;

  if fluxo is null then
    -- SEM FLUXO NAO HA CORRENTE, e o post nasce sem ela -- que e o estado dos
    -- posts anteriores a 0045 e que todas as telas ja desenham. Recusar o
    -- insert seria derrubar a criacao do post por causa de um catalogo vazio.
    return 0;
  end if;

  for e in select * from public.etapas_do_fluxo(fluxo) loop
    insert into public.post_etapas (
      post_id, ordem, nome, funcao, responsavel_id,
      papel, campo, aprovacao_cliente
    )
    values (
      p_post_id, e.ordem, e.nome, e.funcao,
      nullif(p_responsaveis ->> (e.funcao::text), '')::uuid,
      e.papel, e.campo,
      -- A MARCA VEM DO ELO DO FLUXO, e nao mais da lista da conta (0076): o
      -- `check` de `social_flow_steps` ja garante que ela so existe em elo de
      -- producao, entao o filtro que a 0076 fazia aqui -- "o Envio e o
      -- Programar nunca recebem a marca" -- virou trava de tabela.
      e.aprovacao_cliente
    )
    on conflict (post_id, ordem) do nothing;

    if found then
      quantas := quantas + 1;
    end if;
  end loop;

  return quantas;
end;
$$;

comment on function public.montar_etapas_do_post is
  'Monta a corrente de um post a partir do fluxo que vale para ele: o do mes, o da conta ou o da casa (0087).';

create or replace function public.post_etapas_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pendente text;
  -- AS TRAVAS VALEM PARA GENTE, e as duas excecoes estao aqui em cima juntas
  -- de proposito: escritas por duas razoes diferentes, em dois `if` separados,
  -- divergiriam -- e foi o que aconteceu na primeira versao desta funcao, em
  -- que a trava do Envio isentava o seed e a da ordem nao.
  --
  --   * SEM SESSAO QUEM ESCREVE E O SEED, como em `proteger_colunas_do_post`
  --     (0042) e em `comments_normaliza` (0032). O seed monta um post no meio
  --     do fluxo -- ja enviado, ja com ajuste pedido --, e uma corrente que so
  --     aceita ser percorrida em ordem obrigaria cinco `update` em sequencia
  --     para descrever um estado.
  --
  --   * E O GUC diz que quem escreve e o proprio produto. Sem ele a trava mais
  --     nova da 0045 quebraria a acao mais antiga do portal:
  --     `posts_corrente_do_cliente` move a etapa Envio e roda com o
  --     `auth.uid()` DO CLIENTE (`security definer` nao troca quem esta
  --     logado), entao o cliente aprovando um post cairia em "o Envio nao se
  --     marca a mao" -- recusando a unica coisa que ele faz la.
  --
  -- O `set local` do GUC morre no fim da transacao e nao atravessa a
  -- requisicao do PostgREST, entao ninguem consegue liga-lo por fora.
  travas boolean := (select auth.uid()) is not null
                    and coalesce(current_setting('full_hub.corrente', true), '') <> 'on';
begin
  -- O QUE O RESPONSAVEL TROCA E O STATUS, e mais nada. Policy nao limita
  -- coluna: sem esta parte, um PATCH no PostgREST passaria a etapa do redator
  -- para outra pessoa, ou trocaria "Layout" por outro nome.
  if travas and not public.is_gestor() then
    if new.nome is distinct from old.nome
       or new.funcao is distinct from old.funcao
       or new.ordem is distinct from old.ordem
       or new.responsavel_id is distinct from old.responsavel_id
       or new.prazo is distinct from old.prazo
       -- A COLUNA DE 0076 ENTRA NA MESMA LISTA. Quem produz a etapa nao
       -- decide se ela passa pelo cliente: isso e combinado com a conta, e
       -- mora em `client_flow_defaults`.
       or new.aprovacao_cliente is distinct from old.aprovacao_cliente
       -- E AS DUAS DA 0087 TAMBEM, e o papel e a mais importante da lista:
       -- com ele, quem produz a etapa diria que ela E a entrega ao cliente --
       -- e o portao do post passaria a ser a etapa dele.
       or new.papel is distinct from old.papel
       or new.campo is distinct from old.campo then
      raise exception using
        errcode = 'check_violation',
        message = 'Numa etapa que é sua você move o andamento, e o resto é da gestão.',
        hint    = 'Nome, função, ordem, responsável e prazo mudam com quem abriu o post.';
    end if;
  end if;

  if new.status is not distinct from old.status then
    new.updated_at := now();
    return new;
  end if;

  -- ENVIO NAO SE MARCA A MAO, nem pela gestao -- ele e consequencia da rodada
  -- de escopo cliente, como `posts.enviado_em` e desde a 0032. Marcar a etapa
  -- afirmaria que o post foi ao cliente sem nada ter saido da agencia.
  if travas and old.papel = 'entrega' then
    raise exception using
      errcode = 'check_violation',
      message = 'A etapa Envio acompanha a decisão do cliente, e não se marca à mão.',
      hint    = 'Use a ação Enviar ao cliente; quando ele responder, a etapa anda sozinha.';
  end if;

  -- E A ETAPA QUE PASSA PELO CLIENTE SE FECHA DO MESMO JEITO (0076) -- pela
  -- decisao dele, e nao pela mao de quem a fez.
  --
  -- A DIFERENCA PARA O ENVIO E QUE AQUI HA TRABALHO A FAZER: quem escreve a
  -- pauta precisa mover a etapa para "Em andamento" e voltar nela. Entao a
  -- recusa e so dos DOIS status que afirmam uma decisao que nao aconteceu --
  -- `concluida`, que diria que o cliente aprovou, e `enviada_aprovacao`, que
  -- diria que a rodada existe. O Envio recusa qualquer mudanca porque nele
  -- nao ha nada a fazer alem de esperar.
  --
  -- E a mesma forma de `subtasks_bloqueia_conclusao_sem_aprovacao` (0007): a
  -- unica porta para `concluida` e uma rodada aprovada, e quem recusa e o
  -- banco, nunca a tela.
  if travas and old.aprovacao_cliente and old.papel <> 'entrega'
     and new.status in ('concluida', 'enviada_aprovacao') then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa %s passa pelo cliente, e quem a fecha é a decisão dele.', old.nome),
      hint    = 'Use a ação Enviar ao cliente; quando ele aprovar, a etapa anda sozinha.';
  end if;

  -- A CORRENTE E UMA CORRENTE: cada etapa espera a anterior. E a mesma regra da
  -- dependencia de subtarefa (0007) e pela mesma razao -- o redator escrevendo
  -- antes de a pauta existir escreve sobre o que achou. A diferenca e que aqui
  -- a dependencia nao se cadastra: ela E a ordem.
  --
  -- A RECUSA NOMEIA O QUE FALTA, e todas. "Etapa bloqueada" manda a pessoa
  -- procurar; dizer quais ja diz a quem perguntar.
  --
  -- E UMA ETAPA `em_ajustes` NAO BLOQUEIA O QUE VEM DEPOIS DELA. Sem esta
  -- linha a corrente trava exatamente onde o cliente mexeu: ele pede ajustes,
  -- o Envio vai para `em_ajustes`, a etapa de Ajustes nasce logo depois dele
  -- -- e comecar essa etapa e recusado com "vem depois de Envio", que nunca
  -- vai ficar concluida enquanto o ajuste nao for feito. Um abraco.
  --
  -- A leitura e a que a palavra ja diz: uma etapa em ajustes JA DEVOLVEU o
  -- trabalho. Ela nao esta esperando a anterior; esta esperando alguem DEPOIS
  -- dela consertar. E o Programar continua travado do jeito certo -- enquanto
  -- o Ajustes nao fecha ele e o bloqueio, e quando o post volta ao cliente o
  -- Envio fica `enviada_aprovacao`, que bloqueia de novo. So a aprovacao do
  -- cliente o libera, que e a regra que importa: ninguem programa o que o
  -- cliente nao aprovou.
  if travas and old.status = 'nao_iniciada' and new.status <> 'nao_iniciada' then
    select string_agg(e.nome, ', ' order by e.ordem) into pendente
      from public.post_etapas e
     where e.post_id = new.post_id
       and e.ordem < new.ordem
       and e.status not in ('concluida', 'em_ajustes');

    if pendente is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('Esta etapa vem depois de %s.', pendente),
        hint    = 'A corrente do post é em ordem: cada etapa começa quando a anterior é concluída.';
    end if;
  end if;

  -- O CARIMBO NAO E TRAVA, e por isso fica fora dos `if travas`: ele vale para
  -- toda escrita, a do seed inclusive. Uma etapa concluida sem data de
  -- conclusao e uma linha que nao serve para relatorio nenhum.
  if new.status = 'concluida' and old.status <> 'concluida' then
    new.concluida_em := now();
  elsif new.status <> 'concluida' then
    new.concluida_em := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

comment on function public.post_etapas_regras() is
  'As travas da etapa do post. Desde a 0087 a entrega e reconhecida pelo PAPEL e nao pelo nome -- ver o cabecalho dela.';

create or replace function public.posts_corrente_do_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quantos     integer;
  proxima     integer;
  dono_layout uuid;
  porta       public.post_etapas;
  quem_refaz  uuid;
  funcao_ref  public.team_funcao;
  rotulo      text;
begin
  -- REENTRANCIA: desde a 0076 esta funcao escreve de volta em `posts` (o
  -- portao do meio devolve o post para producao), e um `after update` que
  -- atualiza a propria linha se dispara de novo. O GUC ja diz "quem escreve
  -- aqui e o produto", entao ele serve tambem de guarda -- e serve melhor que
  -- uma coluna sentinela, porque `set local` morre no fim da transacao.
  if coalesce(current_setting('full_hub.corrente', true), '') = 'on' then
    return new;
  end if;

  -- Post que ainda nao tem corrente (anterior a 0045) nao ganha uma agora: ela
  -- nasceria pela metade, com o trabalho ja feito marcado como nao iniciado.
  if not exists (select 1 from public.post_etapas e where e.post_id = new.id) then
    return new;
  end if;

  -- QUAL ETAPA ESTA ESPERANDO O CLIENTE. Ate a 0076 a resposta era a palavra
  -- 'Envio', escrita em tres lugares desta funcao. Com os portoes do meio ela
  -- passou a ser uma pergunta -- e uma pergunta so, num lugar so.
  porta := public.porta_do_cliente_no_post(new.id);

  if porta.id is null then
    return new;
  end if;

  -- Ver a explicacao em `post_etapas_regras`: daqui para baixo quem escreve e
  -- o produto, e as travas da etapa nao se aplicam.
  perform set_config('full_hub.corrente', 'on', true);

  -- FOI AO CLIENTE -> o Envio esta em curso.
  if new.enviado_em is not null and old.enviado_em is null then
    update public.post_etapas
       set status = 'enviada_aprovacao', updated_at = now()
     where id = porta.id;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- APROVOU -> o Envio fecha, e o Programar e a proxima mao.
  if new.status = 'aprovado' then
    update public.post_etapas
       set status = 'concluida', concluida_em = now(), updated_at = now()
     where id = porta.id and status <> 'concluida';

    -- O POST NAO ESTA APROVADO QUANDO O PORTAO ERA DO MEIO, e esta e a linha
    -- que impede a mentira mais cara da 0076: o cliente aprovou a PAUTA, e
    -- `decidir_rodada_do_cliente` acabou de escrever `status = 'aprovado'` no
    -- post -- que e o status que o calendario dele pinta de verde, que a
    -- grade do feed mostra como fechado e que a agencia le como "pode
    -- programar". Nada disso aconteceu: a arte nem existe.
    --
    -- Entao o post volta para producao, que e onde ele esta de verdade. A
    -- rodada fica gravada com a decisao dela, intacta -- o que se corrige e o
    -- status do POST, que nunca foi sobre a pauta.
    -- O GUC ja esta ligado logo acima, entao esta escrita nao esbarra nas
    -- travas da etapa -- e e ele tambem que impede a reentrancia, na guarda
    -- do topo desta funcao.
    if porta.papel <> 'entrega' then
      update public.posts
         set status = 'em_producao'
       where id = new.id;
    end if;
  end if;

  -- PEDIU AJUSTES -> nasce a etapa de Ajustes, entre o Envio e o Programar.
  --
  -- UMA POR RODADA, numerada. A segunda volta do cliente nao reabre a
  -- primeira: elas sao dois pedidos diferentes, com dois motivos diferentes, e
  -- reaproveitar a linha apagaria o primeiro -- a mesma razao pela qual rodada
  -- fechada nunca e reescrita (0007).
  if new.status = 'ajustes' then
    -- O AJUSTE NASCE LOGO DEPOIS DO PORTAO QUE O CLIENTE RECUSOU, e nao no
    -- vao fixo entre 40 e 50. Com os portoes do meio (0076) o vao certo e o
    -- do portao: um ajuste da Pauta entre 10 e 20, um ajuste do Envio entre
    -- 40 e 50. E por isso que a folga de dez existe desde a 0045 -- ela
    -- passou a valer em todos os elos, e nao so num.
    rotulo := case when porta.papel = 'entrega' then 'Ajustes'
                   else format('Ajustes da %s', porta.nome) end;

    select count(*) into quantos
      from public.post_etapas e
     where e.post_id = new.id and e.nome like rotulo || '%';

    select coalesce(max(e.ordem), porta.ordem) + 1 into proxima
      from public.post_etapas e
     where e.post_id = new.id
       and e.ordem > porta.ordem and e.ordem < porta.ordem + 10;

    -- QUEM FEZ O TRABALHO FAZ O AJUSTE. Etapa sem dono nao aparece no "Minhas
    -- Tasks" de ninguem, e um pedido do cliente e a ultima coisa do produto
    -- que pode ficar sem dono.
    --
    -- No Envio isso quer dizer o Layout -- a regra da 0045, que continua
    -- inteira: a etapa Envio e da Gestao, e quem refaz a arte e quem a fez.
    -- Num portao do meio quem refaz e o dono do PROPRIO portao: quem escreveu
    -- a pauta reescreve a pauta. Ler "Layout" nos dois casos poria o designer
    -- para reescrever texto.
    --
    -- E "QUEM FEZ A ARTE" DEIXOU DE SER A PALAVRA 'Layout' (0087). Com a
    -- cadeia editavel, um fluxo que chame aquela etapa de "Producao de
    -- Layout" devolveria o ajuste para NINGUEM -- a etapa nasceria orfa, e
    -- etapa sem dono nao aparece no "Minhas Tasks" de ninguem, que e o pior
    -- destino de um pedido do cliente. A pergunta certa e posicional, e e a
    -- que a regra da 0045 ja queria dizer: o ULTIMO elo de producao antes da
    -- entrega, que e quem entregou o material.
    if porta.papel = 'entrega' then
      select e.responsavel_id, e.funcao into dono_layout, funcao_ref
        from public.post_etapas e
       where e.post_id = new.id
         and e.papel = 'producao'
         and e.ordem < porta.ordem
       order by e.ordem desc
       limit 1;
      quem_refaz := dono_layout;
      funcao_ref := coalesce(funcao_ref, 'Design'::public.team_funcao);
    else
      quem_refaz := porta.responsavel_id;
      funcao_ref := porta.funcao;
    end if;

    if quantos < 9 then
      insert into public.post_etapas (post_id, ordem, nome, funcao, responsavel_id)
      values (new.id, proxima,
              case when quantos = 0 then rotulo
                   else format('%s %s', rotulo, quantos + 1) end,
              funcao_ref,
              quem_refaz);

      -- `notificar()` NAO ACEITA DESTINATARIO NULO -- `notifications.user_id` e
      -- `not null`. Sem este `if`, um post cuja etapa de Layout ainda nao tem
      -- dono derrubava a decisao do cliente inteira: ele clicava em "solicitar
      -- ajustes" no portal e levava um erro de banco. Nem o pedido, nem o
      -- comentario, nem a rodada -- e a culpa apareceria na tela dele.
      if quem_refaz is not null then
        perform public.notificar(
          quem_refaz, 'aprovacao',
          format('O cliente pediu ajustes em "%s"', new.tema),
          'Uma etapa de Ajustes entrou na corrente do post.',
          '/painel/social-media'
        );
      end if;
    end if;

    update public.post_etapas
       set status = 'em_ajustes', updated_at = now()
     where id = porta.id;
  end if;

  -- DESLIGA ANTES DE DEVOLVER. `set local` so cai no fim da transacao, e uma
  -- transacao que aprova um post e depois mexe numa etapa a mao passaria pelas
  -- travas caladas -- a saida de emergencia virando porta destrancada.
  perform set_config('full_hub.corrente', 'off', true);

  return new;
end;
$$;

comment on function public.posts_corrente_do_cliente() is
  'Move a corrente conforme o cliente decide. Desde a 0087 a entrega e reconhecida pelo PAPEL, e quem refaz o material e o ultimo elo de producao antes dela.';

create or replace function public.validar_nova_rodada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo  uuid := public.subtask_da_rodada(new.content_type, new.content_id);
  post  uuid := public.post_da_rodada(new.content_type, new.content_id);
  entr  uuid := public.entregavel_da_rodada(new.content_type, new.content_id);
  dono  uuid;
  exige boolean;
  porta public.post_etapas;
begin
  if alvo is null and post is null and entr is null then
    raise exception using
      errcode = 'check_violation',
      message = format('Rodada de aprovação de "%s" ainda não tem regra.', new.content_type),
      hint    = 'Os tipos com regra hoje são subtask, post e deliverable.';
  end if;

  -- ------------------------------------------------------------- entregavel
  if entr is not null then
    if not exists (select 1 from public.deliverables d where d.id = entr) then
      raise exception using
        errcode = 'check_violation',
        message = 'Entregável não encontrado.';
    end if;

    -- GRUPO NAO VAI PARA APROVACAO, e e a mesma regra da etapa agrupadora: o
    -- status dele e calculado pelos filhos, entao uma rodada dele prometeria
    -- uma decisao que o calculo desfaz no instante seguinte. Quem o cliente
    -- decide e o sub-item.
    if public.entregavel_eh_grupo(entr) then
      raise exception using
        errcode = 'check_violation',
        message = 'Este entregável agrupa outros: quem vai para aprovação são os itens de dentro.',
        hint    = 'O status do grupo é calculado pelos sub-itens.';
    end if;

    dono := (select d.responsavel_id from public.deliverables d where d.id = entr);

    if new.escopo = 'interna' then
      if new.solicitado_por is distinct from dono and not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Só quem produziu o entregável envia para aprovação.';
      end if;
    else
      if not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Enviar para o cliente é do Desenvolvedor.',
          hint    = 'Quem produz o material nunca o envia ao cliente.';
      end if;

      if not exists (
        select 1 from public.approval_rounds r
         where r.content_type = new.content_type
           and r.content_id = new.content_id
           and r.numero_rodada = new.numero_rodada
           and r.escopo = 'interna'
           and r.status = 'aprovada'
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Esta rodada ainda não passou pela aprovação interna.';
      end if;
    end if;

    return new;
  end if;

  -- ------------------------------------------------------------------- post
  if post is not null then
    -- QUEM PRODUZIU, e nao quem abriu (0042). Antes desta linha era
    -- `p.criado_por`, e com a corrente de maos isso passou a apontar para a
    -- gestao que escreveu o briefing -- virando as duas travas abaixo do
    -- avesso. Ver o cabecalho da 0042.
    dono := public.dono_do_post(post);

    if not exists (select 1 from public.posts p where p.id = post) then
      raise exception using
        errcode = 'check_violation',
        message = 'Post não encontrado.';
    end if;

    if new.escopo = 'interna' then
      if new.solicitado_por is distinct from dono and not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Só quem produziu o post envia para aprovação.';
      end if;
    else
      if not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Enviar para o cliente é do Desenvolvedor.',
          hint    = 'Quem produz o post nunca o envia ao cliente.';
      end if;

      -- QUAL PORTAO ESTA SAINDO (0076). As duas travas abaixo sao sobre a
      -- ARTE indo ao cliente, e num portao do meio nao ha arte ainda: quem
      -- sai e a pauta ou a legenda. Exigi-las ali travaria o portao para
      -- sempre -- o mes abre sem data (0044) e a pauta e a PRIMEIRA etapa,
      -- entao "escolha o dia antes de enviar" seria uma recusa que a corrente
      -- nao tem como satisfazer.
      porta := public.porta_do_cliente_no_post(post);

      -- POST SEM DATA NAO VAI AO CLIENTE (0044). Ela nasce nula desde esta
      -- migration -- o mes abre em branco e quem produz distribui --, e sem
      -- esta linha o cliente abriria o portal, veria a arte e a legenda, e
      -- decidiria sem saber quando aquilo vai ao ar. "Quando?" em branco ao
      -- lado de um botao de aprovar e a pior combinacao possivel.
      --
      -- Ela NAO contradiz a decisao de que a data e de quem produz (PASSO 2):
      -- nao diz quem manda na data, diz que ela existe antes de o material
      -- sair da agencia. E a mesma forma da trava de video sem link.
      --
      -- E A PERGUNTA E PELO PAPEL E NAO PELO NOME (0087): num fluxo que chame
      -- a entrega de outra coisa, `nome = 'Envio'` seria falso e as DUAS
      -- travas abaixo deixariam de valer -- o cliente receberia a arte sem
      -- data de publicacao e o video sem link, pelo unico caminho que existe
      -- para que isso nao aconteca.
      if coalesce(porta.papel, 'entrega') = 'entrega' and exists (
        select 1 from public.posts p
         where p.id = post and p.data_publicacao is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post ainda não tem data de publicação.',
          hint    = 'Escolha o dia antes de enviar: o cliente decide sobre o material e sobre quando ele vai ao ar.';
      end if;

      -- VIDEO SEM LINK NAO VAI (0042). O cliente abriria a tela para decidir
      -- sobre uma arte que nao existe -- e decidiria, porque o botao de
      -- aprovar estaria la. A recusa e aqui e nao na tela porque este e o
      -- unico ponto por onde o material sai da agencia.
      if coalesce(porta.papel, 'entrega') = 'entrega' and exists (
        select 1 from public.posts p
         where p.id = post and p.midia = 'video'
           and nullif(trim(coalesce(p.video_url, '')), '') is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post é vídeo e ainda não tem o link.',
          hint    = 'Cole o endereço do Drive ou do YouTube antes de enviar.';
      end if;

      if not exists (
        select 1 from public.approval_rounds r
         where r.content_type = new.content_type
           and r.content_id = new.content_id
           and r.numero_rodada = new.numero_rodada
           and r.escopo = 'interna'
           and r.status = 'aprovada'
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Esta rodada ainda não passou pela aprovação interna.';
      end if;
    end if;

    return new;
  end if;

  -- ---------------------------------------------------------------- subtask
  dono  := (select s.responsavel_id   from public.subtasks s where s.id = alvo);
  exige := (select s.requer_aprovacao from public.subtasks s where s.id = alvo);

  if not coalesce(exige, false) then
    raise exception using
      errcode = 'check_violation',
      message = 'Essa subtarefa não exige aprovação.';
  end if;

  if new.escopo = 'interna' then
    if new.solicitado_por is distinct from dono and not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Só o responsável pela subtarefa envia para aprovação.';
    end if;
  else
    if not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Enviar para o cliente é do Desenvolvedor.',
        hint    = 'O responsável pela subtarefa nunca envia material ao cliente.';
    end if;

    if not exists (
      select 1 from public.approval_rounds r
       where r.content_type = new.content_type
         and r.content_id = new.content_id
         and r.numero_rodada = new.numero_rodada
         and r.escopo = 'interna'
         and r.status = 'aprovada'
    ) then
      raise exception using
        errcode = 'check_violation',
        message = 'Esta rodada ainda não passou pela aprovação interna.';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.validar_nova_rodada() is
  'As travas de quem abre rodada. Desde a 0087 as duas travas da arte -- post sem data e video sem link -- perguntam pelo PAPEL da etapa, e nao pelo nome Envio.';

create or replace function public.o_que_o_cliente_decide(p_post_id uuid)
returns table (etapa text, texto text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.posts;
  e public.post_etapas;
begin
  select * into p from public.posts where id = p_post_id;
  if p.id is null then
    return;
  end if;

  -- A MESMA PERGUNTA QUE `posts_select_cliente` FAZ, escrita a mao porque o
  -- definer nao a faz sozinho.
  if not (
    public.is_staff()
    or (p.client_id in (select public.my_client_ids()) and p.enviado_em is not null)
  ) then
    return;
  end if;

  e := public.porta_do_cliente_no_post(p_post_id);

  -- Sem portao, ou na ENTREGA, NAO HA NADA A DIZER: a entrega manda o
  -- material pronto, e a tela dela ja e a de sempre. Devolve-la aqui faria a
  -- tela anunciar uma etapa em todo post enviado desde a 0032.
  if e.id is null or e.papel = 'entrega' then
    return;
  end if;

  return query
    select e.nome,
           -- CADA PORTAO DEVOLVE O TEXTO QUE ELE PRODUZ, e e o mesmo de-para do
           -- card (0046): a Pauta enche `posts.pauta`, o Conteudo enche
           -- `posts.legenda`, o Layout enche a versao -- e a versao ja viaja
           -- pela arte, entao ali o texto e nulo e a tela cai na legenda.
           --
           -- E O DE-PARA SAI DA COLUNA `campo` E NAO DO NOME (0087): era
           -- `case e.nome when 'Pauta'`, e renomear a etapa fazia a tela do
           -- portal abrir o portao com a caixa de texto VAZIA -- o cliente
           -- decidindo sobre nada.
           case e.campo
             when 'pauta'   then p.pauta
             when 'legenda' then p.legenda
             else null
           end;
end;
$$;

comment on function public.o_que_o_cliente_decide(uuid) is
  'O portao aberto de um post e o texto dele, para a tela do portal. Desde a 0087 o portao e o texto saem do PAPEL e do CAMPO da etapa, nunca do nome.';


-- ---------------------------------------------------------------------------
-- PASSO 8 - Montar e editar um fluxo
--
-- UMA FUNCAO SO, porque e uma transacao so: o fluxo e os elos dele sao
-- gravados juntos, como `task_types` + `workflow_templates` + `workflow_steps`
-- desde a 0008 -- *"a tela nunca mostra a divisao, e as duas sao gravadas
-- juntas pela mesma acao"*. Pelo PostgREST seriam N+1 idas, e a terceira
-- falhando deixaria um fluxo com metade da corrente, que e exatamente o estado
-- que a trava do PASSO 2 recusa.
--
-- E ELA NAO E `security definer`, de proposito: `social_flows_write` e
-- `social_flow_steps_write` sao `is_gestor()`, e e a policy que decide quem
-- pode -- nao esta funcao. Um definer aqui entregaria a edicao do fluxo ao
-- colaborador, que e quem a corrente manda trabalhar.
--
-- OS ELOS SAO APAGADOS E REESCRITOS, e nao casados um a um: a pessoa reordena,
-- renomeia e remove na tela, e casar por id obrigaria a tela a mandar o id de
-- cada linha -- e a linha que ela esquecesse de mandar viraria uma etapa
-- duplicada. E a mesma forma de `aplicar_workflow` na 0008.
-- ---------------------------------------------------------------------------

create or replace function public.salvar_fluxo_de_social(
  p_nome      text,
  p_etapas    jsonb,
  p_flow_id   uuid default null,
  p_descricao text default null,
  p_ativo     boolean default true
)
returns uuid
language plpgsql
as $$
declare
  alvo     uuid := p_flow_id;
  etapa    jsonb;
  nomes    text[] := '{}';
  nome_et  text;
  entregas integer := 0;
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

  -- FLUXO SEM ETAPA E RECUSADO AQUI, e nao pela trava do PASSO 2 -- ela deixa
  -- o fluxo vazio passar de proposito, porque esse e o estado entre o `delete`
  -- e o `insert` desta propria funcao. Quem salva um fluxo vazio esta salvando
  -- um fluxo que nenhum mes consegue usar.
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
  for etapa in select * from jsonb_array_elements(p_etapas)
  loop
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
  end loop;

  -- AS DUAS RECUSAS DO PASSO 2 APARECEM AQUI TAMBEM, e nao e duplicacao de
  -- verdade: a trava do banco e a que vale, e esta escreve a frase antes de
  -- gravar nada -- a decisao da maquina de estados da subtarefa ao lado dos
  -- gatilhos da 0007. A diferenca pratica e que esta nomeia a linha do
  -- formulario, e a do gatilho pega quem monta a chamada a mao.
  if entregas = 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo precisa de uma etapa de entrega ao cliente.',
      hint    = 'A entrega é o portão: é nela que o material sai da agência e a rodada do cliente nasce.';
  end if;

  if entregas > 1 then
    raise exception using
      errcode = 'check_violation',
      message = format('O fluxo tem %s etapas de entrega, e a entrega é uma só.', entregas),
      hint    = 'Se há um segundo aval no meio da corrente, marque aquela etapa como "o cliente aprova" em vez de criar outra entrega.';
  end if;

  -- `p_flow_id` COM FLUXO QUE NAO EXISTE CRIA COM AQUELE ID, e nao recusa: e
  -- o que deixa o seed e a bateria fixarem o id de um fluxo -- a mesma forma
  -- do fluxo da casa, que nasce na migration com id literal. Sem isso, cada
  -- rodada do seed criaria um fluxo novo e as fixtures nao teriam como
  -- aponta-lo.
  if alvo is not null and exists (
    select 1 from public.social_flows f where f.id = alvo
  ) then
    update public.social_flows
       set nome = btrim(p_nome),
           descricao = nullif(btrim(coalesce(p_descricao, '')), ''),
           ativo = coalesce(p_ativo, true),
           updated_at = now()
     where id = alvo
    returning id into alvo;

    -- SEM LINHA DE VOLTA E RECUSA DO RLS, e nao fluxo inexistente -- o `if` de
    -- cima ja separou os dois casos. E a regra de "escrita que o RLS pode
    -- barrar termina com `.select()`" vista do lado do banco: sem este `if`, o
    -- colaborador apagaria os elos de um fluxo que ele nao consegue atualizar.
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

  -- OS ELOS ENTRAM NUM `INSERT` SO, e nao num laco de `insert` -- e esta linha
  -- e a que a bateria me obrigou a escrever. O gatilho do PASSO 2 e POR
  -- INSTRUCAO: num laco, a primeira volta deixa o fluxo com um elo e nenhuma
  -- entrega, e a trava recusa ali -- com a frase certa, sobre um fluxo que
  -- ainda estava sendo montado.
  --
  -- E ISSO E A REGRA, e nao um contorno: um fluxo e gravado de uma vez, pela
  -- acao que o grava. Quem montar os elos a mao, um `insert` por linha, leva a
  -- recusa -- e ela diz exatamente o que falta. E a forma mecanica de "as duas
  -- sao gravadas juntas pela mesma acao" (0007).
  --
  -- A ORDEM SAI DA POSICAO NA LISTA, COM ESPACO DE DEZ, pela razao de
  -- `post_etapas.ordem` (0045): a etapa de Ajustes nasce ENTRE duas, e sem a
  -- folga um pedido do cliente obrigaria a renumerar as seguintes. Quem
  -- numera e `with ordinality`, que preserva a ordem da lista -- `jsonb` nao
  -- garante ordem de linha num `select` sem ele.
  insert into public.social_flow_steps (
    flow_id, ordem, nome, funcao, papel, campo, aprovacao_cliente,
    comeca_dias_antes, termina_dias_antes
  )
  select alvo,
         (t.pos * 10)::integer,
         btrim(t.e ->> 'nome'),
         (t.e ->> 'funcao')::public.team_funcao,
         coalesce(nullif(t.e ->> 'papel', ''), 'producao')::public.social_flow_papel,
         nullif(btrim(coalesce(t.e ->> 'campo', '')), ''),
         coalesce((t.e ->> 'aprovacao_cliente')::boolean, false),
         (t.e ->> 'comeca_dias_antes')::integer,
         (t.e ->> 'termina_dias_antes')::integer
    from jsonb_array_elements(p_etapas) with ordinality as t(e, pos);

  return alvo;
end;
$$;

comment on function public.salvar_fluxo_de_social is
  'Grava um fluxo de social com a corrente dele, numa transacao so. `p_etapas` e a lista na ordem: [{"nome","funcao","papel","campo","aprovacao_cliente","comeca_dias_antes","termina_dias_antes"}].';


-- ---------------------------------------------------------------------------
-- PASSO 9 - Abrir o mes passa a escolher o fluxo
--
-- A funcao e reescrita INTEIRA a partir da versao da 0084, que e a ultima.
--
-- O `drop` DA ASSINATURA DE SETE E OBRIGATORIO, e e a pegadinha que a 0061
-- registrou e que ja custou um *"Could not find the function"* ao usuario:
-- `p_flow_id` e um parametro NOVO, entao `create or replace` com oito nao
-- reescreve a de sete -- ele cria uma SEGUNDA funcao ao lado. O PostgREST
-- resolve por nome mais nomes dos argumentos, e a chamada antiga continuaria
-- caindo na funcao antiga, que ignora o fluxo: o dialogo escolheria o fluxo e
-- o mes abriria com a corrente da conta, sem erro em lugar nenhum.
-- ---------------------------------------------------------------------------

drop function if exists public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb, jsonb, text);

create or replace function public.abrir_mes_de_social(
  p_client_id     uuid,
  p_mes           text,
  p_quantidades   jsonb,
  p_responsavel_id uuid default null,
  p_responsaveis  jsonb default '{}'::jsonb,
  p_prazos        jsonb default '{}'::jsonb,
  p_link_entrega  text default null,
  p_flow_id       uuid default null
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
  fluxo     uuid;
  nomes     text;
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

  -- ------------------------------------------------------------------------
  -- QUAL FLUXO ESTE MES PERCORRE (0087)
  --
  -- A ORDEM E MES EXISTENTE -> ESCOLHA DO DIALOGO -> PADRAO DA CONTA -> CASA.
  -- O mes que JA existe vem primeiro, e ele e a razao de `tasks.social_flow_id`
  -- existir: abrir o mesmo mes em duas vezes acrescenta posts a demanda que ja
  -- esta la (0061), e sem esta leitura a segunda chamada poderia usar outro
  -- fluxo -- um mes com duas correntes diferentes dentro, metade dos posts
  -- indo ao cliente por um caminho e metade por outro.
  -- ------------------------------------------------------------------------
  select t.social_flow_id into fluxo
    from public.tasks t
   where t.client_id = p_client_id
     and t.social_do_mes = to_date(p_mes || '-01', 'YYYY-MM-DD')
     and t.social_flow_id is not null;

  if fluxo is null then
    fluxo := public.fluxo_do_mes(p_client_id, p_flow_id);
  end if;

  if fluxo is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Não há fluxo de social ativo para abrir o mês.',
      hint    = 'Monte um fluxo em Social Media, na aba Fluxos: ele é a corrente de etapas que os posts do mês percorrem.';
  end if;

  select string_agg(e.nome, ', ' order by e.ordem) into nomes
    from public.etapas_do_fluxo(fluxo) e;

  -- FLUXO VAZIO E RECUSADO AQUI, e nao pela trava do PASSO 2, que o deixa
  -- passar de proposito -- um fluxo sem etapa e o estado de quem esta
  -- montando. O que ele nao pode e abrir um mes: os posts nasceriam sem
  -- corrente e nunca chegariam ao cliente.
  if nomes is null then
    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo escolhido não tem etapa nenhuma.',
      hint    = 'Monte a corrente dele antes de abrir o mês — sem etapas, os posts nascem sem trabalho e sem caminho até o cliente.';
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
    -- A DICA NOMEIA AS ETAPAS DO FLUXO ESCOLHIDO, e nao as cinco da casa
    -- escritas a mao (0087): com a cadeia editavel, uma lista fixa aqui
    -- mandaria a pessoa procurar "Pauta" num fluxo que nao tem nenhuma.
    if not exists (select 1 from public.etapas_do_fluxo(fluxo) e where e.nome = chave) then
      raise exception using
        errcode = 'check_violation',
        message = format('O fluxo deste mês não tem etapa chamada "%s".', chave),
        hint    = format('As etapas dele são %s.', nomes);
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
  for etapa in select e.ordem, e.nome from public.etapas_do_fluxo(fluxo) e order by e.ordem
  loop
    termina := nullif(btrim(coalesce(p_prazos -> etapa.nome ->> 'fim', '')), '')::date;
    if termina is not null then
      if anterior is not null and termina < anterior then
        raise exception using
          errcode = 'check_violation',
          message = format('"%s" venceria antes da etapa anterior da corrente.', etapa.nome),
          hint    = format('A ordem deste fluxo é %s — os dias precisam andar na mesma direção.', nomes);
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
      social_do_mes, social_flow_id, criado_por, publicada_em
    ) values (
      p_client_id, etiqueta, primeiro, ultimo, btrim(p_link_entrega),
      primeiro, fluxo, (select auth.uid()), now()
    )
    returning id into demanda;
  end if;

  -- O GUC DIZ AO GATILHO QUAL FLUXO USAR, e ele existe por uma razao de ORDEM:
  -- o post e inserido antes de a subtarefa do mes existir, entao
  -- `montar_etapas_do_post` -- que roda no `after insert` desde a 0045 -- nao
  -- tem como chegar a `tasks.social_flow_id` pela ponte `posts.subtask_id`. Sem
  -- ele o mes abriria com a corrente da CONTA, e o fluxo escolhido no dialogo
  -- nao valeria para nada. A explicacao inteira esta em `montar_etapas_do_post`.
  perform set_config('full_hub.fluxo_do_mes', fluxo::text, true);

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

  -- DESLIGA ANTES DE DEVOLVER, como `full_hub.corrente` faz desde a 0045:
  -- `set local` so cai no fim da transacao, e uma transacao que abre o mes e
  -- depois cria um post avulso daria a ele a corrente do mes -- a saida de
  -- emergencia virando porta destrancada.
  perform set_config('full_hub.fluxo_do_mes', '', true);

  return criados;
end;
$fn$;

comment on function public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb, jsonb, text, uuid) is
  'Abre o mes de social de um cliente: UMA demanda do mes, um post por linha de '
  'combinacao (0082) e a corrente do FLUXO escolhido dentro de cada um (0087), '
  'com um PERIODO por etapa valendo para o mes inteiro (0084). `p_prazos` e '
  '{"Pauta": {"inicio": "2026-10-01", "fim": "2026-10-05"}, ...}, por nome de '
  'etapa do fluxo.';


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------

select
  (select count(*) from public.social_flows)                            as fluxos,
  (select count(*) from public.social_flow_steps)                       as elos,
  (select count(*) from public.social_flow_steps where papel = 'entrega') as entregas,
  (select count(*) from public.post_etapas where papel = 'entrega')     as entregas_materializadas,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'client_flow_defaults'
      and column_name = 'social_aprovacoes')                            as coluna_antiga;
