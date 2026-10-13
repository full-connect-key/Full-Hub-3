-- ===========================================================================
-- 0096 - FULL ACADEMY: PLAYBOOKS, E-BOOKS E CURSOS
--
-- O Full Academy deixa de ser uma lista de links e vira o acervo de formacao
-- da agencia, com tres formatos:
--
--   playbook  o jeito Full de fazer as coisas -- consultado o tempo todo,
--             VERSIONADO, com confirmacao de leitura
--   ebook     material que a agencia produz -- lido de ponta a ponta
--   curso     formacao estruturada -- modulos e aulas, com progresso
--
-- Tudo interno, para a equipe. SEM PROVA E SEM CERTIFICADO: progresso e
-- conclusao bastam para um time de catorze pessoas, e no dia em que a Academy
-- der nota ninguem mais marca "nao vi" -- o acompanhamento deixa de dizer a
-- verdade. E a regra que o modulo tem desde a 0017, e ela nao muda.
--
--
-- O MODELO ANTIGO E CONVERTIDO, NAO APAGADO AO LADO
--
-- A 0017 tinha `academy_tracks` (trilha) com `academy_materials` dentro e
-- `academy_progress` por material. A conversao e exata e nao inventa nada:
-- uma trilha com materiais em ordem E um curso com um modulo so. Cada trilha
-- antiga vira um `academy_items` de tipo `curso`, os materiais dela viram
-- aulas de um modulo chamado "Conteudo", e o progresso viaja por aula.
--
-- As tres tabelas antigas saem no fim, e nao ficam ao lado das novas: tabela
-- que nenhuma tela le e schema que alguem reaproveita errado tres sprints
-- depois. E a decisao da 0023.
--
-- **E O DE-PARA DOS TIPOS DE MATERIAL CUSTOU UMA APLICACAO RECUSADA.** A
-- primeira versao desta migration convertia `academy_materials.tipo` com
-- `::text::academy_aula_tipo`, e o comentario que eu escrevi ao lado afirmava
-- que os dois enums compartilhavam quatro valores. Eles compartilham DOIS. A
-- recusa chegou a quem aplicou, no SQL Editor:
--
--   invalid input value for enum academy_aula_tipo: "aula_interna"
--
-- Duas licoes, e nenhuma e sobre enum:
--
-- **1. O CAST DE ENUM PARA ENUM POR TEXTO NAO COMPARA AS DUAS LISTAS.** Ele
-- falha na primeira LINHA sem par -- entao num acervo onde todo material
-- fosse video ou pdf ele teria passado, e a bomba ficaria para o primeiro
-- artigo que alguem cadastrasse. O que entrou no lugar e um `case` com os
-- seis valores escritos, no PASSO 14.
--
-- **2. A EXPLICACAO NAO PODE CARREGAR O ERRO QUE ELA DEVERIA PEGAR.** O
-- comentario estava ali justamente para dizer por que o cast era seguro, e
-- era ele que estava errado -- um leitor que conferisse a frase em vez dos
-- dois `create type` concluiria que esta tudo bem. E a armadilha desta casa
-- pela oitava vez, de um angulo novo: a explicacao afirmando a propriedade
-- que ninguem mediu.
--
-- E A GUARDA VEM ANTES DO LACO, nomeando o valor. Sem ela a recusa seria
-- *null value in column "tipo" violates not-null constraint* com o despejo da
-- linha -- que e verdade e nao diz qual valor nao tem par. **Medido com duas
-- mutacoes, contra um Postgres 16 com o modelo velho povoado com um material
-- de cada um dos seis tipos:** devolvendo o cast, a migration e recusada em
-- `artigo` (o primeiro sem par daquele acervo); acrescentando um valor novo a
-- `material_tipo` e tirando a guarda, ela e recusada pelo `not null` em vez de
-- nomear o valor.
--
--
-- AS ANOTACOES SAO TABELA PROPRIA, E ISSO DIVERGE DO TEXTO DO SPRINT
--
-- O sprint pede `academy_progresso.anotacoes` e, na linha seguinte, que elas
-- sejam ilegiveis "nem pelo gestor" -- com o criterio de aceite mandando
-- TESTAR VIA API. As duas coisas nao cabem na mesma tabela, e a razao e a
-- regra que esta casa ja escreveu quatro vezes: **policy nao limita coluna**.
-- Com `is_gestor()` podendo ler a linha para a aba Acompanhamento existir, um
-- `select=anotacoes` no PostgREST devolve a anotacao de qualquer pessoa.
--
-- A 0017 tentou resolver isso com uma VIEW sem a coluna, e o proprio
-- comentario dela admite o furo: *"quem chamar a tabela direto como gestor le
-- tudo"*. Uma view nao limita a tabela de baixo -- a mesma frase que a 0069
-- escreveu sobre `assets.valor_aquisicao`, e pelo mesmo motivo a resposta e a
-- mesma: a linha fica FORA DO ALCANCE.
--
-- Entao `academy_anotacoes` e tabela separada, com `user_id = auth.uid()` nas
-- quatro operacoes. Ninguem le a de ninguem, nem o socio, e a bateria mede com
-- o comando cru. E uma nota que a gestao pudesse ler nao seria escrita -- que
-- e o ponto inteiro de ela existir.
--
--
-- A OBRIGATORIEDADE E DERIVADA, NUNCA UMA LISTA GRAVADA POR PESSOA
--
-- `academy_obrigatorios` guarda a REGRA (este item e obrigatorio para Design,
-- em 30 dias apos a admissao), e quem responde "o que falta para a Marina" e
-- uma funcao que cruza a regra com a ficha dela. Uma tabela pessoa x item
-- precisaria ser reescrita por cinco caminhos para continuar verdadeira --
-- alguem muda de funcao, alguem entra, a regra muda, o item e despublicado,
-- o prazo e alterado -- e no dia em que um deles falhasse a tela cobraria
-- leitura de quem nao deve.
--
-- E a decisao de "bloqueio nao e status", de "atraso nao e coluna" e de
-- `maoDoPost()`. O criterio de aceite *"cadastrar alguem novo monta a lista
-- de obrigatorios da funcao dela"* passa a ser verdade SEM TRIGGER NENHUM: a
-- lista existe no instante em que a ficha existe, porque ela e a pergunta.
--
--
-- O VERSIONAMENTO DO PLAYBOOK E A PECA QUE FAZ O MODULO SERVIR
--
-- Toda publicacao cria uma versao nova, com notas de mudanca. Ao publicar,
-- quem edita escolhe entre mudanca LEVE (correcao de texto, exemplo novo) e
-- mudanca que EXIGE RELEITURA (o processo mudou).
--
-- Marcando `exige_releitura`, todo mundo que havia confirmado a versao
-- anterior volta a ter aquele playbook como pendente -- e a pendencia tambem
-- e DERIVADA: `academy_progresso.versao_confirmada` guarda qual versao a
-- pessoa leu, e quem compara com a versao corrente e a leitura. Zerar a
-- confirmacao seria apagar o fato de ela ter lido a versao 2, e o aviso
-- precisa justamente dizer *"voce confirmou a versao 2, a 3 mudou isto"*.
--
-- **Uma versao LEVE nao mexe em pendencia nenhuma**, e e por isso que a
-- comparacao nao e `versao_confirmada < numero_versao` e sim
-- `versao_confirmada < ultima_versao_que_exige_releitura`. Sem essa distincao
-- corrigir uma virgula cobraria releitura de catorze pessoas, e na terceira
-- vez ninguem mais clicaria em "Li e estou ciente".
--
--
-- A BUSCA ACHA NO MEIO DO TEXTO, e por isso o playbook vive no sistema
--
-- `conteudo_texto` e o texto puro da versao, gravado ao lado do rico. Um
-- indice GIN sobre titulo + resumo + tags + esse texto e o que faz "playbook
-- que ninguem acha nao existe" deixar de ser verdade -- e e tambem a razao de
-- o playbook NAO ser um PDF solto no Drive: PDF nao se linka por secao, nao
-- se busca de dentro do produto e nao se versiona.
--
-- `portuguese` e a configuracao: com `simple`, "aprovacoes" nao casaria com
-- "aprovacao", que e metade das buscas que alguem faz aqui.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Os enums
-- ---------------------------------------------------------------------------
do $migracao$
begin
  if not exists (select 1 from pg_type where typname = 'academy_tipo') then
    create type public.academy_tipo as enum ('playbook', 'ebook', 'curso');
  end if;
  if not exists (select 1 from pg_type where typname = 'academy_aula_tipo') then
    create type public.academy_aula_tipo as enum
      ('video', 'texto', 'pdf', 'link', 'exercicio');
  end if;
end
$migracao$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - O item do acervo
--
-- UMA TABELA PARA OS TRES FORMATOS, e nao tres. O que eles tem em comum e
-- quase tudo -- titulo, resumo, categoria, capa, tags, autor, publicacao,
-- duracao --, e o que muda e ONDE o conteudo mora: versao, arquivo ou
-- modulo/aula. Tres tabelas obrigariam a aba de acervo a fazer tres consultas
-- e a uniao delas na tela, com a ordenacao e a busca escritas tres vezes.
--
-- `slug` e unico e e o que faz o link sobreviver a uma troca de titulo.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_items (
  id          uuid primary key default gen_random_uuid(),
  tipo        public.academy_tipo not null,
  titulo      text not null,
  slug        text not null unique,
  -- Uma linha, e e ela que aparece no cartao. Separada da descricao porque o
  -- cartao tem uma linha e a tela de dentro tem a pagina inteira.
  resumo      text,
  descricao   text,
  -- Texto livre e nao enum, pela razao que a 0017 ja escreveu sobre `area`:
  -- a categoria aqui e organizacao de conteudo ("Producao", "Cultura"), nao a
  -- area do contrato de ninguem.
  categoria   text,
  capa_url    text,
  tags        text[] not null default '{}',
  autor_id    uuid references public.profiles (id) on delete set null,
  publicado   boolean not null default false,
  ordem       integer not null default 0,
  duracao_estimada_minutos integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.academy_items is
  'O acervo do Full Academy (0096): playbook, e-book e curso numa tabela so. O que muda entre os tres e onde o conteudo mora -- academy_playbook_versoes, academy_arquivos ou academy_modulos/aulas.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - PLAYBOOK: o conteudo no sistema, versionado
--
-- `numero_versao` e unico por item, e a versao corrente e o maior numero. Uma
-- coluna `corrente boolean` seria a segunda verdade sobre o mesmo fato, e
-- divergiria na primeira publicacao concorrente.
--
-- VERSAO FECHADA NUNCA E REESCRITA NEM APAGADA -- a regra de
-- `approval_rounds` desde a 0007. Quem confirmou a versao 2 precisa continuar
-- podendo ler a 2 para entender o que mudou na 3, e as notas de cada uma sao
-- o historico que a tela mostra.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_playbook_versoes (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.academy_items (id) on delete cascade,
  numero_versao   integer not null,
  conteudo_rico   jsonb not null,
  -- O TEXTO PURO E PARA A BUSCA, e ele e gravado junto e nao derivado por
  -- trigger: extrair texto de um documento do TipTap em plpgsql seria um
  -- parser de jsonb escrito a mao, e ele divergiria do que o editor considera
  -- texto na primeira extensao nova. Quem sabe ler o documento e o editor.
  conteudo_texto  text not null,
  notas_mudanca   text,
  exige_releitura boolean not null default false,
  publicado_por   uuid references public.profiles (id) on delete set null,
  publicado_em    timestamptz not null default now(),
  unique (item_id, numero_versao)
);


-- ---------------------------------------------------------------------------
-- PASSO 4 - E-BOOK: o arquivo
-- ---------------------------------------------------------------------------
create table if not exists public.academy_arquivos (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.academy_items (id) on delete cascade,
  url           text not null,
  nome          text not null,
  tamanho_bytes bigint,
  paginas       integer,
  created_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- PASSO 5 - CURSO: modulos e aulas
-- ---------------------------------------------------------------------------
create table if not exists public.academy_modulos (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.academy_items (id) on delete cascade,
  titulo    text not null,
  descricao text,
  ordem     integer not null default 0
);

create table if not exists public.academy_aulas (
  id              uuid primary key default gen_random_uuid(),
  modulo_id       uuid not null references public.academy_modulos (id) on delete cascade,
  titulo          text not null,
  tipo            public.academy_aula_tipo not null,
  url             text,
  conteudo_rico   jsonb,
  arquivo_url     text,
  duracao_minutos integer,
  ordem           integer not null default 0
);


-- ---------------------------------------------------------------------------
-- PASSO 6 - PROGRESSO, e ele serve aos tres formatos
--
-- `aula_id` nulo quer dizer "o item todo": e assim que o playbook e o e-book
-- registram conclusao, e e assim que o curso guarda a linha de resumo ao lado
-- das linhas por aula.
--
-- O UNIQUE COM COLUNA NULAVEL NAO FUNCIONA, e e a pegadinha deste passo: no
-- Postgres dois nulos sao distintos, entao `unique (user_id, item_id,
-- aula_id)` deixaria a MESMA pessoa ter dez linhas de "o item todo". Sao dois
-- indices parciais, um para cada caso.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_progresso (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  item_id           uuid not null references public.academy_items (id) on delete cascade,
  aula_id           uuid references public.academy_aulas (id) on delete cascade,
  concluido         boolean not null default false,
  concluido_em      timestamptz,
  -- PLAYBOOK: qual versao a pessoa leu. Nao e zerado quando o processo muda --
  -- a pendencia e derivada da comparacao, e apagar isto apagaria o fato de ela
  -- ter lido a versao anterior, que e o que o aviso precisa dizer.
  versao_confirmada integer,
  created_at        timestamptz not null default now()
);

create unique index if not exists academy_progresso_item_unico
  on public.academy_progresso (user_id, item_id) where aula_id is null;
create unique index if not exists academy_progresso_aula_unico
  on public.academy_progresso (user_id, item_id, aula_id) where aula_id is not null;

-- `concluido_em` e carimbado pelo banco, nao pela tela: a data de conclusao e
-- o unico dado do progresso que alguem poderia querer forjar, e o relogio do
-- navegador nao e prova de nada. Veio da 0017 e continua valendo.
create or replace function public.academy_progresso_carimbar()
returns trigger
language plpgsql
as $func$
begin
  if new.concluido and (tg_op = 'INSERT' or not old.concluido) then
    new.concluido_em := now();
  elsif not new.concluido then
    new.concluido_em := null;
  end if;
  return new;
end;
$func$;

drop trigger if exists academy_progresso_carimbar on public.academy_progresso;
create trigger academy_progresso_carimbar
  before insert or update on public.academy_progresso
  for each row execute function public.academy_progresso_carimbar();


-- ---------------------------------------------------------------------------
-- PASSO 7 - AS ANOTACOES, EM TABELA PROPRIA
--
-- A razao inteira esta no cabecalho: policy nao limita coluna, e o criterio de
-- aceite manda testar via API. Fora da linha de progresso, a gestao pode ler
-- `academy_progresso` a vontade -- que e o que a aba Acompanhamento precisa --
-- sem nenhuma chance de alcancar o que a pessoa escreveu.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_anotacoes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_id    uuid not null references public.academy_items (id) on delete cascade,
  aula_id    uuid references public.academy_aulas (id) on delete cascade,
  texto      text not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_anotacoes_item_unico
  on public.academy_anotacoes (user_id, item_id) where aula_id is null;
create unique index if not exists academy_anotacoes_aula_unico
  on public.academy_anotacoes (user_id, item_id, aula_id) where aula_id is not null;

comment on table public.academy_anotacoes is
  'A anotacao privada de cada pessoa (0096). Tabela PROPRIA e nao coluna de academy_progresso: policy nao limita coluna, e a gestao precisa ler o progresso para a aba Acompanhamento existir. Ninguem le a de ninguem, nem o socio.';


-- ---------------------------------------------------------------------------
-- PASSO 8 - A OBRIGATORIEDADE, por funcao ou perfil
--
-- `funcao` nulo vale para todas; `role` nulo vale para todos. As duas nulas e
-- "obrigatorio para a agencia inteira", que e o caso de "Primeiros 30 dias na
-- Full".
--
-- `prazo_dias_apos_admissao` nulo e "sem prazo": o item e obrigatorio e nao
-- vence. Sem o nulo, todo obrigatorio precisaria de um numero inventado -- e
-- prazo inventado e prazo que vence e ninguem entende por que.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_obrigatorios (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.academy_items (id) on delete cascade,
  funcao     public.team_funcao,
  role       public.user_role,
  prazo_dias_apos_admissao integer,
  created_at timestamptz not null default now()
);

-- A MESMA REGRA DUAS VEZES E RUIDO: ela nao muda nada e faz a contagem de
-- "quantas pessoas passam a ter isto pendente" somar a mesma pessoa duas
-- vezes. `nulls not distinct` porque as duas colunas sao nulaveis de proposito
-- e e justamente o par (null, null) que mais se repetiria.
create unique index if not exists academy_obrigatorios_regra_unica
  on public.academy_obrigatorios (item_id, funcao, role) nulls not distinct;


-- ---------------------------------------------------------------------------
-- PASSO 9 - TRILHAS: uma sequencia de itens
--
-- Tipicamente o onboarding de uma funcao. A trilha NAO e um quarto tipo de
-- item: ela nao tem conteudo proprio, tem ordem -- e um item pode estar em
-- duas trilhas sem ser copiado.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_trilhas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  funcao      public.team_funcao,
  obrigatoria boolean not null default false,
  capa_url    text,
  ordem       integer not null default 0,
  publicada   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.academy_trilha_itens (
  id         uuid primary key default gen_random_uuid(),
  trilha_id  uuid not null references public.academy_trilhas (id) on delete cascade,
  item_id    uuid not null references public.academy_items (id) on delete cascade,
  ordem      integer not null default 0,
  unique (trilha_id, item_id)
);


-- ---------------------------------------------------------------------------
-- PASSO 10 - A BUSCA
--
-- Indice GIN sobre o item e sobre o texto da versao de playbook. Sao dois
-- indices e nao um: eles vivem em tabelas diferentes, e juntar seria uma
-- materialized view que precisa ser refrescada por todo caminho que publica.
--
-- `coalesce` em tudo: `to_tsvector` de nulo e nulo, e uma linha sem resumo
-- sairia do indice inteiro -- sumindo da busca por causa de um campo
-- opcional.
-- ---------------------------------------------------------------------------
-- O TEXTO BUSCAVEL DE UM ITEM, numa funcao `immutable`.
--
-- Ela existe por uma recusa do Postgres, e nao por organizacao:
-- `array_to_string()` e STABLE e nao immutable -- a saida de um elemento pode
-- depender de configuracao --, e indice de expressao so aceita immutable. A
-- primeira versao punha a concatenacao direto no `create index` e levou
-- *"functions in index expression must be marked IMMUTABLE"*.
--
-- Marcar a funcao como immutable e seguro aqui porque as quatro entradas sao
-- `text` e `text[]`: nao ha conversao dependente de locale, de fuso nem de
-- `search_path` no meio. O laco sobre as tags faz a mesma coisa que o
-- `array_to_string`, e sem a dependencia que o torna stable.
create or replace function public.academy_texto_do_item(
  p_titulo text, p_resumo text, p_descricao text, p_tags text[]
) returns text
language sql
immutable
as $func$
  select coalesce(p_titulo, '') || ' ' ||
         coalesce(p_resumo, '') || ' ' ||
         coalesce(p_descricao, '') || ' ' ||
         coalesce((select string_agg(t, ' ') from unnest(p_tags) as t), '');
$func$;

create index if not exists academy_items_busca_idx
  on public.academy_items
  using gin (to_tsvector('portuguese',
    public.academy_texto_do_item(titulo, resumo, descricao, tags)));

create index if not exists academy_versoes_busca_idx
  on public.academy_playbook_versoes
  using gin (to_tsvector('portuguese', coalesce(conteudo_texto, '')));

create index if not exists academy_items_acervo_idx
  on public.academy_items (tipo, publicado, categoria);
create index if not exists academy_modulos_item_idx
  on public.academy_modulos (item_id, ordem);
create index if not exists academy_aulas_modulo_idx
  on public.academy_aulas (modulo_id, ordem);
create index if not exists academy_progresso_user_idx
  on public.academy_progresso (user_id, item_id);
create index if not exists academy_obrigatorios_item_idx
  on public.academy_obrigatorios (item_id);
create index if not exists academy_trilha_itens_idx
  on public.academy_trilha_itens (trilha_id, ordem);


-- ---------------------------------------------------------------------------
-- PASSO 11 - AS PERGUNTAS DERIVADAS
--
-- NENHUMA DELAS E `security definer`, e isso e decisao. Elas leem
-- `academy_items`, `academy_progresso`, `profiles` e `team_members`, e a RLS
-- dessas quatro ja responde exatamente a pergunta certa: a pessoa alcanca a
-- propria linha, a gestao alcanca todas. Com `definer` elas passariam a
-- responder sobre qualquer um para quem tiver a chave anon -- e a de cima
-- devolve o nome e o prazo de todo mundo.
--
-- E a decisao de `busca_global()` (0073), pela mesma razao: repetir o filtro
-- de permissao aqui criaria o segundo lugar onde a regra pode divergir.
-- ---------------------------------------------------------------------------

-- A versao corrente e o MAIOR numero. Uma coluna `corrente boolean` seria a
-- segunda verdade sobre o mesmo fato.
create or replace function public.academy_versao_corrente(p_item uuid)
returns integer
language plpgsql
stable
set search_path = public
as $func$
declare
  v integer;
begin
  select max(numero_versao) into v
    from public.academy_playbook_versoes where item_id = p_item;
  return v;
end;
$func$;

-- A ULTIMA VERSAO QUE EXIGIU RELEITURA, e nao a corrente.
--
-- E a linha que separa "corrigi uma virgula" de "o processo mudou". Comparando
-- com a corrente, toda correcao de texto cobraria releitura de catorze
-- pessoas -- e na terceira vez ninguem mais clicaria em "Li e estou ciente".
create or replace function public.academy_versao_de_releitura(p_item uuid)
returns integer
language plpgsql
stable
set search_path = public
as $func$
declare
  v integer;
begin
  select max(numero_versao) into v
    from public.academy_playbook_versoes
   where item_id = p_item and exige_releitura;
  return v;
end;
$func$;

/**
 * O estado de UMA pessoa em UM item. O lugar unico da pergunta.
 *
 * Devolve: 'concluido' | 'releitura' | 'em_andamento' | 'nao_iniciado'.
 *
 * O PLAYBOOK NAO USA `concluido`, E USA `versao_confirmada`. Sao fatos
 * diferentes: "eu li" sem numero nao sobrevive a uma versao nova, e e
 * justamente a versao nova que o modulo existe para levar as pessoas. A
 * conclusao de um playbook e sempre a confirmacao de uma versao.
 */
create or replace function public.academy_estado_do_item(p_user uuid, p_item uuid)
returns text
language plpgsql
stable
set search_path = public
as $func$
declare
  v_tipo       public.academy_tipo;
  v_confirmada integer;
  v_releitura  integer;
  v_feito      boolean;
  v_total      integer;
  v_vistas     integer;
begin
  select tipo into v_tipo from public.academy_items where id = p_item;
  if v_tipo is null then
    return 'nao_iniciado';
  end if;

  if v_tipo = 'playbook' then
    select versao_confirmada into v_confirmada
      from public.academy_progresso
     where user_id = p_user and item_id = p_item and aula_id is null;

    if v_confirmada is null then
      return 'nao_iniciado';
    end if;

    v_releitura := public.academy_versao_de_releitura(p_item);
    -- Sem nenhuma versao de releitura, confirmar qualquer uma basta: as
    -- publicacoes posteriores foram todas leves, e elas nao cobram nada.
    if v_releitura is not null and v_confirmada < v_releitura then
      return 'releitura';
    end if;
    return 'concluido';
  end if;

  if v_tipo = 'curso' then
    select count(*) into v_total
      from public.academy_aulas a
      join public.academy_modulos m on m.id = a.modulo_id
     where m.item_id = p_item;

    -- CURSO SEM AULA NAO NASCE CONCLUIDO. Zero de zero e "todas vistas" em
    -- qualquer conta ingenua, e um curso recem-aberto apareceria como feito --
    -- e o `count(*) = 0` da campanha que se finaliza sozinha (0051) outra vez.
    if coalesce(v_total, 0) = 0 then
      return 'nao_iniciado';
    end if;

    select count(*) into v_vistas
      from public.academy_progresso p
      join public.academy_aulas a on a.id = p.aula_id
      join public.academy_modulos m on m.id = a.modulo_id
     where p.user_id = p_user and m.item_id = p_item and p.concluido;

    if coalesce(v_vistas, 0) = 0 then return 'nao_iniciado'; end if;
    if v_vistas >= v_total then return 'concluido'; end if;
    return 'em_andamento';
  end if;

  -- E-book: a conclusao e manual, no fim.
  select concluido into v_feito
    from public.academy_progresso
   where user_id = p_user and item_id = p_item and aula_id is null;
  return case when coalesce(v_feito, false) then 'concluido' else 'nao_iniciado' end;
end;
$func$;

/**
 * O QUE E OBRIGATORIO PARA UMA PESSOA, derivado da regra mais a ficha dela.
 *
 * Nao existe tabela pessoa x item, e e a decisao do cabecalho: ela precisaria
 * ser reescrita por cinco caminhos para continuar verdadeira. Aqui a lista
 * existe no instante em que a ficha existe -- entao "cadastrar alguem novo
 * monta a lista de obrigatorios da funcao dela" nao precisa de trigger
 * nenhum: a lista E a pergunta.
 *
 * `prazo` nulo quer dizer "sem prazo", e e caso normal. `vencido` so e true
 * quando ha prazo, ele passou, e o item nao esta concluido -- um item
 * concluido depois do prazo nao fica vermelho para sempre.
 */
create or replace function public.academy_obrigatorios_de(p_user uuid)
returns table (
  item_id    uuid,
  titulo     text,
  tipo       public.academy_tipo,
  slug       text,
  categoria  text,
  estado     text,
  prazo      date,
  vencido    boolean
)
language plpgsql
stable
set search_path = public
as $func$
declare
  v_funcao    public.team_funcao;
  v_role      public.user_role;
  v_admissao  date;
begin
  select t.funcao, t.data_admissao into v_funcao, v_admissao
    from public.team_members t where t.user_id = p_user;
  select p.role into v_role from public.profiles p where p.id = p_user;

  -- `distinct on (i.id)` E A LINHA QUE FAZ A DEDUPLICACAO, e nao o `order by`
  -- sozinho: sem ele, um playbook obrigatorio para Design E para a agencia
  -- inteira casa com duas regras e aparece duas vezes na tela de quem e
  -- Design. O `order by` decide QUAL das duas sobrevive -- a de prazo mais
  -- apertado, que e a que a pessoa precisa saber.
  return query
  select distinct on (i.id)
         i.id,
         i.titulo,
         i.tipo,
         i.slug,
         i.categoria,
         public.academy_estado_do_item(p_user, i.id) as estado,
         -- SEM DATA DE ADMISSAO NAO HA PRAZO, e o item continua obrigatorio.
         -- Contar de `created_at` da ficha seria inventar uma data de entrada,
         -- e o prazo que ela produz venceria sem ninguem entender por que.
         case when o.prazo_dias_apos_admissao is null or v_admissao is null
              then null
              else v_admissao + o.prazo_dias_apos_admissao
         end as prazo,
         case when o.prazo_dias_apos_admissao is null or v_admissao is null
              then false
              else (v_admissao + o.prazo_dias_apos_admissao) < current_date
                   and public.academy_estado_do_item(p_user, i.id) <> 'concluido'
         end as vencido
    from public.academy_obrigatorios o
    join public.academy_items i on i.id = o.item_id
   where i.publicado
     and (o.funcao is null or o.funcao = v_funcao)
     and (o.role   is null or o.role   = v_role)
   -- UMA LINHA POR ITEM, e nao por regra: um playbook obrigatorio para Design
   -- E para a agencia inteira apareceria duas vezes na tela de quem e Design.
   -- Entre dois prazos vale o MAIS APERTADO, que e o que a pessoa precisa
   -- saber.
   order by i.id, prazo nulls last;
end;
$func$;

comment on function public.academy_obrigatorios_de is
  'O que e obrigatorio para uma pessoa (0096), derivado da regra mais a funcao, o perfil e a data de admissao dela. Nao e security definer de proposito: a RLS das tabelas que ela le ja responde quem alcanca quem.';


/**
 * O ACOMPANHAMENTO DA GESTAO: pessoa x item obrigatorio.
 *
 * E a aba que a gestao mais usa, e ela e o motivo de o modulo existir: trilha
 * obrigatoria sem quem confira e recado, nao trilha.
 *
 * `is_gestor()` na primeira linha, e nao `security definer`: o que ela
 * devolve e nome, item e estado de toda a equipe -- a recusa precisa ser do
 * banco, nao da tela. Ela chega como ERRO do PostgREST e nao como lista
 * vazia, que e a diferenca entre "voce nao pode" e "ninguem deve nada".
 */
create or replace function public.academy_acompanhamento()
returns table (
  user_id   uuid,
  pessoa    text,
  funcao    public.team_funcao,
  item_id   uuid,
  item      text,
  tipo      public.academy_tipo,
  estado    text,
  prazo     date,
  vencido   boolean
)
language plpgsql
stable
security invoker
set search_path = public
as $func$
begin
  if not public.is_gestor() then
    raise exception 'Apenas a gestao acompanha a formacao da equipe.';
  end if;

  return query
  select p.id, p.nome, t.funcao, o.item_id, o.titulo, o.tipo,
         o.estado, o.prazo, o.vencido
    from public.profiles p
    left join public.team_members t on t.user_id = p.id
    cross join lateral public.academy_obrigatorios_de(p.id) o
   -- SO QUEM ESTA NA AGENCIA. Quem saiu nao deve leitura nenhuma, e deixa-lo
   -- na tabela encheria a aba de pendencias que ninguem vai resolver -- a
   -- mesma razao pela qual `notificar()` nao avisa quem foi desligado.
   where p.ativo and p.role <> 'cliente'
   order by p.nome, o.prazo nulls last, o.titulo;
end;
$func$;

/**
 * QUEM ESTA COM OBRIGATORIO VENCIDO. A rotina diaria le daqui.
 *
 * Ela e `security definer` -- ao contrario das de cima -- porque quem a chama
 * e o `pg_cron`, que roda como `service_role` e nao e `is_gestor()`. O
 * `revoke` logo abaixo e o que impede que ela vire a porta que devolve a lista
 * de pendencias da equipe para quem tiver a chave anon: e a decisao da 0071,
 * que fechou `limpar_rascunhos_abandonados()` depois de ela ficar aberta a
 * `public` por default.
 */
create or replace function public.academy_vencidos()
returns table (user_id uuid, pessoa text, item_id uuid, item text, prazo date)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  return query
  select p.id, p.nome, o.item_id, o.titulo, o.prazo
    from public.profiles p
   cross join lateral public.academy_obrigatorios_de(p.id) o
   where p.ativo and p.role <> 'cliente' and o.vencido
   order by o.prazo, p.nome;
end;
$func$;

revoke all on function public.academy_vencidos() from public;
grant execute on function public.academy_vencidos() to service_role;


-- ---------------------------------------------------------------------------
-- PASSO 12 - RLS
--
-- A regra do modulo desde a 0017 e ela nao muda: leitura por `is_staff()`, e
-- so de item PUBLICADO -- rascunho so para o autor e para a gestao. Escrita de
-- conteudo pela gestao e pelo autor do item.
--
-- ITEM NAO PUBLICADO NAO EXISTE PARA QUEM NAO E AUTOR NEM GESTAO, e isso e
-- RLS e nao filtro de consulta. Um `.eq("publicado", true)` esquecido numa
-- tela nova vazaria o rascunho; aqui o banco recusa a linha. E o criterio de
-- aceite diz "nem pela URL".
--
-- CLIENTE NAO ALCANCA NADA DISTO. Nenhuma policy aqui menciona
-- `my_client_ids()`, e e assim de proposito: o Academy e conversa interna.
-- ---------------------------------------------------------------------------

alter table public.academy_items             enable row level security;
alter table public.academy_playbook_versoes  enable row level security;
alter table public.academy_arquivos          enable row level security;
alter table public.academy_modulos           enable row level security;
alter table public.academy_aulas             enable row level security;
alter table public.academy_progresso         enable row level security;
alter table public.academy_anotacoes         enable row level security;
alter table public.academy_obrigatorios      enable row level security;
alter table public.academy_trilhas           enable row level security;
alter table public.academy_trilha_itens      enable row level security;

-- Quem pode mexer no conteudo de um item: a gestao, ou quem o escreveu.
create or replace function public.academy_posso_editar(p_item uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $func$
begin
  if public.is_gestor() then return true; end if;
  return exists (
    select 1 from public.academy_items i
     where i.id = p_item and i.autor_id = (select auth.uid())
  );
end;
$func$;

-- Visibilidade de um item, usada por tudo o que pendura nele.
create or replace function public.academy_posso_ver(p_item uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $func$
begin
  if not public.is_staff() then return false; end if;
  return exists (
    select 1 from public.academy_items i
     where i.id = p_item
       and (i.publicado or public.is_gestor() or i.autor_id = (select auth.uid()))
  );
end;
$func$;

-- --- Itens -----------------------------------------------------------------
drop policy if exists academy_items_select on public.academy_items;
create policy academy_items_select on public.academy_items
  for select to authenticated
  using (
    public.is_staff()
    and (publicado or public.is_gestor() or autor_id = (select auth.uid()))
  );

-- QUEM CRIA E A GESTAO, e o autor nasce sendo quem criou. Sem o
-- `autor_id = auth.uid()` no `with check`, daria para nascer um item assinado
-- por outra pessoa -- e e o autor que ganha o direito de editar logo abaixo.
drop policy if exists academy_items_insert on public.academy_items;
create policy academy_items_insert on public.academy_items
  for insert to authenticated
  with check (public.is_gestor() and autor_id = (select auth.uid()));

drop policy if exists academy_items_update on public.academy_items;
create policy academy_items_update on public.academy_items
  for update to authenticated
  using (public.academy_posso_editar(id))
  with check (public.academy_posso_editar(id));

-- APAGAR E SO DA GESTAO, e nao do autor: um item do acervo e documentacao da
-- agencia, nao um post de alguem. Quem escreveu edita; quem responde pelo
-- acervo retira.
drop policy if exists academy_items_delete on public.academy_items;
create policy academy_items_delete on public.academy_items
  for delete to authenticated using (public.is_gestor());

-- --- Versoes de playbook ---------------------------------------------------
drop policy if exists academy_versoes_select on public.academy_playbook_versoes;
create policy academy_versoes_select on public.academy_playbook_versoes
  for select to authenticated using (public.academy_posso_ver(item_id));

drop policy if exists academy_versoes_insert on public.academy_playbook_versoes;
create policy academy_versoes_insert on public.academy_playbook_versoes
  for insert to authenticated with check (public.academy_posso_editar(item_id));

-- SEM POLICY DE UPDATE NEM DE DELETE, e a ausencia e a regra: versao fechada
-- nunca e reescrita nem apagada, como a rodada de aprovacao desde a 0007.
-- Quem confirmou a versao 2 precisa continuar podendo ler a 2 para entender o
-- que mudou na 3 -- e o historico com as notas de cada uma e o que a tela
-- mostra. Corrigir e publicar outra.

-- --- Arquivos (e-book) -----------------------------------------------------
drop policy if exists academy_arquivos_select on public.academy_arquivos;
create policy academy_arquivos_select on public.academy_arquivos
  for select to authenticated using (public.academy_posso_ver(item_id));

drop policy if exists academy_arquivos_write on public.academy_arquivos;
create policy academy_arquivos_write on public.academy_arquivos
  for all to authenticated
  using (public.academy_posso_editar(item_id))
  with check (public.academy_posso_editar(item_id));

-- --- Modulos e aulas -------------------------------------------------------
drop policy if exists academy_modulos_select on public.academy_modulos;
create policy academy_modulos_select on public.academy_modulos
  for select to authenticated using (public.academy_posso_ver(item_id));

drop policy if exists academy_modulos_write on public.academy_modulos;
create policy academy_modulos_write on public.academy_modulos
  for all to authenticated
  using (public.academy_posso_editar(item_id))
  with check (public.academy_posso_editar(item_id));

-- A AULA SEGUE O MODULO, que segue o item: sem o `exists` aqui, a lista de
-- aulas entregaria o conteudo de um rascunho a quem nao pode ver o curso.
drop policy if exists academy_aulas_select on public.academy_aulas;
create policy academy_aulas_select on public.academy_aulas
  for select to authenticated
  using (exists (
    select 1 from public.academy_modulos m
     where m.id = modulo_id and public.academy_posso_ver(m.item_id)
  ));

drop policy if exists academy_aulas_write on public.academy_aulas;
create policy academy_aulas_write on public.academy_aulas
  for all to authenticated
  using (exists (
    select 1 from public.academy_modulos m
     where m.id = modulo_id and public.academy_posso_editar(m.item_id)
  ))
  with check (exists (
    select 1 from public.academy_modulos m
     where m.id = modulo_id and public.academy_posso_editar(m.item_id)
  ));

-- --- Progresso -------------------------------------------------------------
--
-- A LEITURA E DIFERENTE DA ESCRITA, e a assimetria e deliberada: a pessoa
-- escreve o proprio progresso e so o proprio, e a gestao PRECISA ler o de
-- todos para a aba Acompanhamento existir.
--
-- E aqui isso nao vaza nada, porque a anotacao mora noutra tabela. Era o furo
-- da 0017, que tentava separar por view.
drop policy if exists academy_progresso_select on public.academy_progresso;
create policy academy_progresso_select on public.academy_progresso
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_gestor());

drop policy if exists academy_progresso_write on public.academy_progresso;
create policy academy_progresso_write on public.academy_progresso
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_staff());

-- --- Anotacoes -------------------------------------------------------------
--
-- AS QUATRO OPERACOES FECHAM EM `auth.uid()`. Nem o socio le. E a promessa que
-- faz a pessoa escrever "nao entendi a parte do briefing" -- e uma anotacao
-- que a gestao pudesse ler nao seria escrita.
drop policy if exists academy_anotacoes_all on public.academy_anotacoes;
create policy academy_anotacoes_all on public.academy_anotacoes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_staff());

-- --- Obrigatoriedade e trilhas ---------------------------------------------
--
-- A EQUIPE INTEIRA LE A REGRA, e so a gestao escreve: a pessoa precisa saber
-- POR QUE aquilo e obrigatorio para ela, e esconder a regra deixaria a tela
-- dizendo "voce deve isto" sem dizer de onde vem.
drop policy if exists academy_obrigatorios_select on public.academy_obrigatorios;
create policy academy_obrigatorios_select on public.academy_obrigatorios
  for select to authenticated using (public.is_staff());

drop policy if exists academy_obrigatorios_write on public.academy_obrigatorios;
create policy academy_obrigatorios_write on public.academy_obrigatorios
  for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

drop policy if exists academy_trilhas_select on public.academy_trilhas;
create policy academy_trilhas_select on public.academy_trilhas
  for select to authenticated
  using (public.is_staff() and (publicada or public.is_gestor()));

drop policy if exists academy_trilhas_write on public.academy_trilhas;
create policy academy_trilhas_write on public.academy_trilhas
  for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

drop policy if exists academy_trilha_itens_select on public.academy_trilha_itens;
create policy academy_trilha_itens_select on public.academy_trilha_itens
  for select to authenticated
  using (exists (
    select 1 from public.academy_trilhas t
     where t.id = trilha_id
       and public.is_staff() and (t.publicada or public.is_gestor())
  ));

drop policy if exists academy_trilha_itens_write on public.academy_trilha_itens;
create policy academy_trilha_itens_write on public.academy_trilha_itens
  for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 13 - Os dois buckets privados
--
-- `academy-arquivos` (o PDF do e-book, o material de apoio da aula) e
-- `academy-capas` (a imagem do cartao). PRIVADOS como todos os deste produto,
-- com URL assinada: o acervo de formacao e documentacao interna, e um bucket
-- publico poria o playbook de processo da agencia num endereco que qualquer
-- pessoa abre.
--
-- SAO DOIS E NAO UM porque a capa aparece em TODO cartao do acervo e o arquivo
-- aparece quando alguem abre o item. Num bucket so, a listagem do acervo
-- assinaria uma URL por item para imagens que pesam megabytes ao lado de
-- capas que pesam quilobytes -- e a assinatura em bloco e o que faz a grade
-- carregar numa ida.
--
-- A LEITURA E DA EQUIPE INTEIRA e a escrita e de quem edita o item. O
-- `is_staff()` da leitura e mais largo que a RLS do item de proposito: o
-- Storage nao sabe de que item um arquivo e, e amarrar o caminho ao id do item
-- numa policy de bucket seria repetir `academy_posso_ver()` numa linguagem que
-- nao a enxerga. Quem esconde o rascunho e a tabela -- sem a linha, ninguem
-- descobre o endereco para assinar.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  insert into storage.buckets (id, name, public)
  values ('academy-arquivos', 'academy-arquivos', false),
         ('academy-capas',    'academy-capas',    false)
  on conflict (id) do nothing;

  drop policy if exists "academy: a equipe le os arquivos" on storage.objects;
  drop policy if exists "academy: a gestao escreve os arquivos" on storage.objects;
  drop policy if exists "academy: a gestao apaga os arquivos" on storage.objects;

  execute $politica$
    create policy "academy: a equipe le os arquivos" on storage.objects
      for select to authenticated
      using (bucket_id in ('academy-arquivos', 'academy-capas') and public.is_staff())
  $politica$;

  execute $politica$
    create policy "academy: a gestao escreve os arquivos" on storage.objects
      for insert to authenticated
      with check (bucket_id in ('academy-arquivos', 'academy-capas') and public.is_gestor())
  $politica$;

  execute $politica$
    create policy "academy: a gestao apaga os arquivos" on storage.objects
      for delete to authenticated
      using (bucket_id in ('academy-arquivos', 'academy-capas') and public.is_gestor())
  $politica$;
end;
$bloco$;


-- ---------------------------------------------------------------------------
-- PASSO 14 - A CONVERSAO DO MODELO ANTIGO
--
-- A 0017 guardava trilha -> material -> progresso. A conversao e exata e nao
-- inventa nada: **uma trilha com materiais em ordem E um curso com um modulo
-- so**. O que ela perde e `academy_materials.skill_id`, e isso esta dito logo
-- abaixo.
--
-- Ela roda ANTES do `drop`, obviamente -- e e idempotente pelo `id`, que
-- viaja: o curso nasce com o id da trilha, entao rodar duas vezes nao cria
-- nada de novo.
--
-- **A BATERIA NAO CONSEGUE MEDIR ESTA CONVERSAO, e fica dito em vez de
-- escondido.** O cenario depende de `academy_tracks` COM LINHAS antes da 0096,
-- e o `rodar.sh` carrega os dados de teste depois da 0006 -- onze migrations
-- antes de a tabela antiga sequer existir. E a mesma impossibilidade que a
-- 0087 registrou para `social_aprovacoes`.
--
-- Entao ela foi conferida A MAO, contra um Postgres parado na 0095 com o
-- modelo antigo preenchido, e o resultado esta aqui para quem repetir:
--
--   trilha "Onboarding da casa" (obrigatoria, publicada, area Cultura)
--     -> item `curso`, mesma categoria, mesmo estado de publicacao
--   2 materiais (video 12min, pdf 30min)
--     -> 2 aulas no modulo "Conteudo", na mesma ordem e com a duracao
--   1 progresso concluido da Carla
--     -> 1 linha em academy_progresso, com `concluido_em` carimbado
--   1 anotacao privada
--     -> 1 linha em academy_anotacoes, fora do alcance da gestao
--   `obrigatoria = true`
--     -> 1 regra em academy_obrigatorios, sem funcao (vale para todos)
--   academy_estado_do_item(carla, curso) = 'em_andamento'  (1 de 2 aulas)
-- ---------------------------------------------------------------------------
do $migracao$
declare
  v_trilha        record;
  v_modulo        uuid;
  v_quantas       integer := 0;
  v_desconhecidos text;
begin
  if to_regclass('public.academy_tracks') is null then
    raise notice '0096: nao ha modelo antigo para converter.';
    return;
  end if;

  -- O DE-PARA DOS TIPOS NAO E UM CAST, E ESTA MIGRATION JA ERROU ISSO.
  --
  -- A primeira versao fazia `m.tipo::text::academy_aula_tipo` com um
  -- comentario ao lado afirmando que os dois enums compartilhavam quatro
  -- valores. Eles compartilham DOIS -- `video` e `pdf`:
  --
  --   material_tipo (0017)  video  artigo  pdf  curso_externo  template  aula_interna
  --   academy_aula_tipo     video  texto   pdf  link           exercicio
  --
  -- O resultado foi a recusa que quem aplicou leu na tela:
  -- *invalid input value for enum academy_aula_tipo: "aula_interna"*. **O
  -- cast de enum para enum por texto nao avisa que a lista do outro lado e
  -- outra** -- ele falha na primeira LINHA que carrega um valor sem par, e
  -- num banco onde todo material fosse video ou pdf ele teria passado,
  -- deixando a bomba para o primeiro artigo que alguem cadastrasse.
  --
  -- A GUARDA VEM ANTES DO LACO, e nao um `else` dentro do `case`: a coluna
  -- `tipo` e `not null`, entao um valor sem par daria *null value in column
  -- tipo violates not-null constraint* -- que e verdade e nao diz qual
  -- material, nem qual valor. Aqui a recusa nomeia o que falta e para antes
  -- de converter metade do acervo.
  select string_agg(distinct m.tipo::text, ', ' order by m.tipo::text)
    into v_desconhecidos
    from public.academy_materials m
   where m.tipo::text not in
         ('video', 'artigo', 'pdf', 'curso_externo', 'template', 'aula_interna');

  if v_desconhecidos is not null then
    raise exception '0096: material com tipo sem de-para: %', v_desconhecidos
      using hint = 'Acrescente o valor ao case do PASSO 14 antes de aplicar.';
  end if;

  for v_trilha in select * from public.academy_tracks loop
    -- O SLUG SAI DO ID e nao do titulo: dois titulos iguais existem, e um
    -- slug derivado do texto estouraria no unique no meio da conversao -- com
    -- metade do acervo migrado e nada dizendo qual metade.
    insert into public.academy_items
      (id, tipo, titulo, slug, descricao, categoria, capa_url, autor_id,
       publicado, ordem, created_at)
    values (v_trilha.id, 'curso', v_trilha.titulo,
            'curso-' || replace(v_trilha.id::text, '-', ''),
            v_trilha.descricao, v_trilha.area, v_trilha.capa_url,
            v_trilha.criado_por, v_trilha.publicada, v_trilha.ordem,
            v_trilha.created_at)
    on conflict (id) do nothing;

    if not found then
      continue;
    end if;
    v_quantas := v_quantas + 1;

    insert into public.academy_modulos (item_id, titulo, ordem)
    values (v_trilha.id, 'Conteúdo', 0)
    returning id into v_modulo;

    insert into public.academy_aulas
      (id, modulo_id, titulo, tipo, url, arquivo_url, duracao_minutos, ordem)
    select m.id, v_modulo, m.titulo,
           -- `artigo` e texto; `curso_externo` e `template` abrem FORA, que e
           -- o que `link` quer dizer. E `aula_interna` depende do que ela tem:
           -- com endereco ela e um link, sem endereco ela e o texto que
           -- alguem escreveu aqui dentro. `exercicio` nao recebe ninguem --
           -- ele e valor novo deste sprint, e inventar um dono para ele seria
           -- afirmar que um material antigo era exercicio.
           case m.tipo::text
             when 'video'         then 'video'
             when 'pdf'           then 'pdf'
             when 'artigo'        then 'texto'
             when 'curso_externo' then 'link'
             when 'template'      then 'link'
             when 'aula_interna'  then
               case when coalesce(btrim(m.url), '') <> '' then 'link' else 'texto' end
           end::public.academy_aula_tipo,
           m.url, m.arquivo_url, m.duracao_minutos, m.ordem
      from public.academy_materials m
     where m.track_id = v_trilha.id;

    -- A TRILHA OBRIGATORIA VIRA REGRA, e nao uma coluna no item: o novo modelo
    -- nao tem `obrigatoria` em `academy_items`, porque obrigatoriedade e por
    -- FUNCAO desde este sprint. Sem funcao, a regra vale para todo mundo --
    -- que e exatamente o que `obrigatoria = true` queria dizer na 0017.
    if v_trilha.obrigatoria then
      insert into public.academy_obrigatorios (item_id) values (v_trilha.id)
      on conflict do nothing;
    end if;
  end loop;

  -- O progresso viaja por AULA, porque la ele era por material.
  insert into public.academy_progresso
    (user_id, item_id, aula_id, concluido, concluido_em, created_at)
  select g.user_id, mo.item_id, g.material_id, g.concluido, g.concluido_em,
         g.created_at
    from public.academy_progress g
    join public.academy_aulas a  on a.id = g.material_id
    join public.academy_modulos mo on mo.id = a.modulo_id
  on conflict do nothing;

  -- E A ANOTACAO VAI PARA A TABELA NOVA, que e o ponto deste sprint: ela
  -- deixa de ser uma coluna que a gestao alcanca por `select=anotacoes`.
  insert into public.academy_anotacoes (user_id, item_id, aula_id, texto)
  select g.user_id, mo.item_id, g.material_id, g.anotacoes
    from public.academy_progress g
    join public.academy_aulas a  on a.id = g.material_id
    join public.academy_modulos mo on mo.id = a.modulo_id
   where g.anotacoes is not null and btrim(g.anotacoes) <> ''
  on conflict do nothing;

  raise notice '0096: % trilha(s) convertida(s) em curso.', v_quantas;
end
$migracao$;

-- O QUE A CONVERSAO PERDE, e e dito em vez de escondido:
-- `academy_materials.skill_id`, a etiqueta que ligava um material ao catalogo
-- de `skills`. O novo acervo organiza por `categoria` e `tags`, que e o que o
-- sprint pede, e nao ha para onde levar a chave estrangeira.
--
-- **`skills` FICA, e nao e esta migration que decide o contrario.** A 0043 a
-- preservou por escolha explicita do usuario -- *"o catalogo fica"* --, com a
-- razao sendo justamente `academy_materials.skill_id`. Com aquela tabela fora,
-- `skills` passa a ser um catalogo que nada le e nada escreve, e pela regra da
-- 0023 isso se apaga; mas apagar um catalogo que o usuario mandou guardar nao
-- e decisao de uma migration de outro assunto. Fica registrado aqui para ser
-- decidido, e nao para ser esquecido.

drop table if exists public.academy_progress  cascade;
drop table if exists public.academy_materials cascade;
drop table if exists public.academy_tracks    cascade;
drop function if exists public.academy_progress_carimbar() cascade;
drop view if exists public.academy_progresso_da_equipe cascade;

-- **`material_tipo` FICA, e a razao que estava escrita aqui era falsa.** Ela
-- dizia que `academy_aula_tipo` tem "os mesmos quatro valores mais
-- `exercicio`", e e dela que nasceu o cast que falhou em `aula_interna`. Os
-- dois enums compartilham DOIS valores; o de-para esta no PASSO 14.
--
-- A razao de verdade e de FORA do banco: `database.types.ts` declara
-- `MaterialTipo`, e `lib/dominio/academy.ts` e a tela antiga do modulo ainda
-- o importam -- elas sao reescritas nas partes seguintes deste sprint.
-- `drop type` aqui faria `check:tipos` reprovar por um tipo que `src/` ainda
-- usa, e a varredura estaria certa. Ele sai junto com aquelas telas, pela
-- regra da 0023; ate la fica orfao, como `pf_tipo` ficou na 0034.


-- ---------------------------------------------------------------------------
-- PASSO 15 - O ACERVO INICIAL, COMO RASCUNHO
--
-- Dezoito playbooks com titulo, resumo e categoria preenchidos, e o CORPO
-- VAZIO -- prontos para a equipe escrever.
--
-- **UM ACERVO VAZIO NAO CONVIDA NINGUEM A CONTRIBUIR**, e um acervo com a
-- estrutura pronta convida. E a mesma razao pela qual a 0008 cria os workflows
-- iniciais e a 0068 cria os quatro tipos de pedido: um catalogo vazio no
-- primeiro dia faz o modulo estrear sem funcionar.
--
-- E ELES NASCEM NAO PUBLICADOS, que e a outra metade da decisao. O sprint diz
-- em quantas palavras: *"nao publicar item sem conteudo apenas para preencher
-- o acervo"*. Publicado, cada um seria um playbook em branco na tela de quem
-- foi buscar como se abre uma demanda -- e a segunda vez que isso acontece a
-- pessoa para de abrir o Academy.
--
-- Como rascunho eles aparecem SO para a gestao, na aba de acervo, com o selo
-- de rascunho: e uma lista de "o que falta escrever", que e exatamente o que
-- eles sao.
--
-- SEM AUTOR, e `autor_id` e nulavel de proposito: inventar um dono poria o
-- nome de alguem num texto que ela nao escreveu. Quem escrever o primeiro
-- paragrafo assina.
-- ---------------------------------------------------------------------------
insert into public.academy_items (tipo, titulo, slug, resumo, categoria, publicado, ordem)
values
  -- Producao
  ('playbook', 'Como abrir uma demanda: briefing, prazos e responsáveis',
   'como-abrir-uma-demanda',
   'O caminho da demanda do pedido até a distribuição das etapas.', 'Produção', false, 10),
  ('playbook', 'Como escrever um briefing que não volta',
   'briefing-que-nao-volta',
   'O que precisa estar escrito antes de alguém começar a produzir.', 'Produção', false, 20),
  ('playbook', 'Padrão de nomenclatura das demandas',
   'nomenclatura-das-demandas',
   'Como nomear para achar depois — e para o board se ler de relance.', 'Produção', false, 30),
  ('playbook', 'Como montar o mês de social media',
   'montar-o-mes-de-social',
   'Da grade de peças à corrente de fases, com as datas do mês.', 'Produção', false, 40),
  ('playbook', 'O fluxo de aprovação: aval interno e envio ao cliente',
   'fluxo-de-aprovacao',
   'Quem valida por dentro, quem envia para fora, e por que são duas decisões.', 'Produção', false, 50),
  ('playbook', 'Como responder a um pedido de ajustes',
   'responder-a-um-pedido-de-ajustes',
   'O que fazer quando o material volta, e o que não fazer.', 'Produção', false, 60),
  ('playbook', 'Estimativa de tempo: como estimar sem chutar',
   'estimativa-de-tempo',
   'Como chegar a um número que a agenda da semana aguenta.', 'Produção', false, 70),

  -- Atendimento
  ('playbook', 'Como receber e qualificar uma solicitação do cliente',
   'qualificar-uma-solicitacao',
   'Da mensagem solta ao pedido com briefing, prazo e responsável.', 'Atendimento', false, 110),
  ('playbook', 'Como conduzir uma reunião de alinhamento',
   'reuniao-de-alinhamento',
   'O que levar, o que anotar e o que sai dali combinado.', 'Atendimento', false, 120),
  ('playbook', 'O que fazer quando o cliente some',
   'quando-o-cliente-some',
   'A régua de contato, o que registrar e quando escalar.', 'Atendimento', false, 130),
  ('playbook', 'Como dar uma má notícia de prazo',
   'ma-noticia-de-prazo',
   'Como avisar cedo, com a alternativa pronta.', 'Atendimento', false, 140),

  -- Cultura e rotina
  ('playbook', 'Primeiros 30 dias na Full',
   'primeiros-30-dias',
   'Por onde começar, quem procurar e o que ler na primeira semana.', 'Cultura e rotina', false, 210),
  ('playbook', 'Como pedir descanso e ausências',
   'pedir-descanso-e-ausencias',
   'Como funciona o Full Days: o que descontar, com quanto tempo, e quem responde.', 'Cultura e rotina', false, 220),
  ('playbook', 'Equipamento da agência: comodato e responsabilidade',
   'equipamento-e-comodato',
   'O que você recebe, o que assina e o que acontece na devolução.', 'Cultura e rotina', false, 230),
  ('playbook', 'Como enviar sua nota fiscal',
   'como-enviar-sua-nota-fiscal',
   'Quando emitir, o que conferir e por onde mandar.', 'Cultura e rotina', false, 240),
  ('playbook', 'Organização do Drive: onde cada coisa mora',
   'organizacao-do-drive',
   'A árvore de pastas da agência e a regra de onde salvar.', 'Cultura e rotina', false, 250),

  -- Marca
  ('playbook', 'Identidade da Full Connect Key: cores, logo e aplicação',
   'identidade-da-full-connect-key',
   'O símbolo, as duas versões, e onde cada uma se usa.', 'Marca', false, 310),
  ('playbook', 'Tom de voz da Full',
   'tom-de-voz-da-full',
   'Como a agência escreve — para o cliente e para o público dele.', 'Marca', false, 320)
on conflict (slug) do nothing;

-- AS TRES TRILHAS, tambem em rascunho e pela mesma razao: uma trilha de
-- onboarding publicada com playbooks em branco manda a pessoa nova ler
-- dezoito paginas vazias no primeiro dia.
--
-- "Boas-vindas a Full" nasce `obrigatoria`, e as de funcao NAO: a primeira
-- vale para todo mundo, e as outras duas sao o caminho sugerido de quem entra
-- naquela area. Quem decide o que e obrigatorio de verdade e
-- `academy_obrigatorios`, item por item -- a trilha agrupa, ela nao cobra.
insert into public.academy_trilhas (nome, descricao, funcao, obrigatoria, publicada, ordem)
values
  ('Boas-vindas à Full',
   'O que toda pessoa que entra precisa ler na primeira semana.',
   null, true, false, 10),
  ('Onboarding de Atendimento',
   'O caminho de quem vai receber pedido, alinhar com o cliente e abrir demanda.',
   'Atendimento', false, false, 20),
  ('Onboarding de Produção',
   'O caminho de quem vai produzir: briefing, estimativa, aprovação e ajustes.',
   'Design', false, false, 30)
on conflict do nothing;

-- A SEQUENCIA DA TRILHA DE BOAS-VINDAS, montada a partir dos slugs. Uma
-- trilha com nome e sem itens e um titulo que nao leva a lugar nenhum -- e o
-- sprint pede que o acervo chegue montado, nao so nomeado.
insert into public.academy_trilha_itens (trilha_id, item_id, ordem)
select t.id, i.id, x.ordem
  from public.academy_trilhas t
  join (values
    ('primeiros-30-dias',               10),
    ('identidade-da-full-connect-key',  20),
    ('tom-de-voz-da-full',              30),
    ('pedir-descanso-e-ausencias',      40),
    ('como-enviar-sua-nota-fiscal',     50),
    ('equipamento-e-comodato',          60),
    ('organizacao-do-drive',            70)
  ) as x(slug, ordem) on true
  join public.academy_items i on i.slug = x.slug
 where t.nome = 'Boas-vindas à Full'
on conflict (trilha_id, item_id) do nothing;

insert into public.academy_trilha_itens (trilha_id, item_id, ordem)
select t.id, i.id, x.ordem
  from public.academy_trilhas t
  join (values
    ('qualificar-uma-solicitacao', 10),
    ('reuniao-de-alinhamento',     20),
    ('como-abrir-uma-demanda',     30),
    ('briefing-que-nao-volta',     40),
    ('ma-noticia-de-prazo',        50),
    ('quando-o-cliente-some',      60)
  ) as x(slug, ordem) on true
  join public.academy_items i on i.slug = x.slug
 where t.nome = 'Onboarding de Atendimento'
on conflict (trilha_id, item_id) do nothing;

insert into public.academy_trilha_itens (trilha_id, item_id, ordem)
select t.id, i.id, x.ordem
  from public.academy_trilhas t
  join (values
    ('briefing-que-nao-volta',           10),
    ('estimativa-de-tempo',              20),
    ('montar-o-mes-de-social',           30),
    ('fluxo-de-aprovacao',               40),
    ('responder-a-um-pedido-de-ajustes', 50),
    ('nomenclatura-das-demandas',        60)
  ) as x(slug, ordem) on true
  join public.academy_items i on i.slug = x.slug
 where t.nome = 'Onboarding de Produção'
on conflict (trilha_id, item_id) do nothing;

-- OS TRES OBRIGATORIOS DA CASA, com prazo contado da admissao.
--
-- Nenhum deles cita funcao: eles valem para a agencia inteira, e e isso que
-- `funcao is null` quer dizer. Os trinta dias nao sao numero bonito -- e o
-- prazo que "Primeiros 30 dias na Full" ja nomeia, e os outros dois sao o que
-- a pessoa precisa saber para a primeira nota fiscal e o primeiro descanso
-- dela nao darem errado.
--
-- Eles so passam a cobrar alguem quando o item for PUBLICADO:
-- `academy_obrigatorios_de()` filtra por `i.publicado`. Entao a regra ja fica
-- de pe e nao cobra leitura de pagina em branco.
insert into public.academy_obrigatorios (item_id, prazo_dias_apos_admissao)
select i.id, x.dias
  from (values
    ('primeiros-30-dias',           30),
    ('pedir-descanso-e-ausencias',  30),
    ('como-enviar-sua-nota-fiscal', 30)
  ) as x(slug, dias)
  join public.academy_items i on i.slug = x.slug
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- CONFERENCIA - cole o bloco abaixo depois de aplicar
-- ---------------------------------------------------------------------------
-- select tipo, count(*) filter (where publicado) as publicados,
--        count(*) filter (where not publicado) as rascunhos
--   from public.academy_items group by tipo order by tipo;
--
-- select nome, publicada,
--        (select count(*) from public.academy_trilha_itens ti where ti.trilha_id = t.id) as itens
--   from public.academy_trilhas t order by ordem;
--
-- select to_regclass('public.academy_tracks') as modelo_antigo_ainda_existe;
