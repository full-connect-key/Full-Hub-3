-- ===========================================================================
-- 0102 - O E-BOOK INTERATIVO, E O PROGRESSO QUE MORA NO BANCO
--
-- Sprint 3L-B, decisao do usuario. A 0096 previu o e-book como um PDF num
-- visualizador, e o primeiro e-book da Full nao e um PDF: e uma pagina
-- interativa, com busca no texto inteiro, checklists marcaveis, matriz de
-- responsabilidades filtravel e progresso por capitulo.
--
-- O QUE ESTA MIGRATION EXISTE PARA RESOLVER NAO E HOSPEDAR O HTML -- isso o
-- bucket da 0096 ja faz. E o PROGRESSO: a pagina guarda o estado dela no
-- `localStorage`, e `localStorage` morre quando a pessoa troca de maquina,
-- limpa o navegador ou abre pelo celular. Pior, ele e invisivel para a
-- gestao: um e-book obrigatorio cuja leitura nao e registrada em lugar nenhum
-- e um e-book que ninguem tem como acompanhar.
--
-- ---------------------------------------------------------------------------
-- DOIS DESVIOS DO TEXTO DO SPRINT, E O PRIMEIRO QUEBRARIA A ENTREGA
--
-- 1. O sprint manda derrubar `academy_progresso_user_id_item_id_aula_id_key`
--    com a razao escrita -- *"em Postgres, NULLs sao distintos, entao
--    (user, item, null) podia repetir"* -- e trocar por um
--    `unique nulls not distinct`.
--
--    **AQUELA CONSTRAINT NAO EXISTE NESTE BANCO, e o furo que ela descreve
--    tambem nao.** A 0096 viu a mesma pegadinha e a resolveu com DOIS INDICES
--    PARCIAIS; o cabecalho dela diz isso em quantas palavras. Entao nao ha o
--    que derrubar e nao ha duplicata para deduplicar -- o `delete` de
--    deduplicacao que o sprint pede apagaria zero linhas.
--
--    **E seguir o sprint ao pe da letra quebraria a marcacao de capitulo.**
--    `academy_progresso_item_unico` e `(user_id, item_id) where aula_id is
--    null`, e a linha de um CAPITULO tambem tem `aula_id` nulo: ela cairia
--    dentro daquele indice e colidiria com a linha do item inteiro. O
--    primeiro capitulo marcado levaria recusa de chave duplicada. O conserto
--    certo e outro: o indice do item ganha `and capitulo_id is null`, e nasce
--    um terceiro indice parcial para o capitulo. E o `check` de alvo unico
--    fica, porque ele diz o que os indices nao dizem.
--
-- 2. O sprint descreve a trava de leitura como sendo do PLAYBOOK e manda
--    criar `academy_items.exige_confirmacao_leitura` para o e-book tambem.
--    Isso esta certo e e exatamente o que entra aqui -- a observacao e que a
--    coluna passa a valer para os TRES formatos, e nao so para o e-book: com
--    ela o botao depende do ITEM e nao do tipo, que e o que o proprio sprint
--    pede em uma linha.
-- ---------------------------------------------------------------------------
--
-- O QUE NAO ENTRA, e esta dito em vez de escondido:
--
-- - **nenhuma coluna `atual` em `academy_arquivos`.** A versao vigente e a de
--   maior `versao`, como a versao corrente do playbook e o maior
--   `numero_versao` desde a 0096. Uma bandeira ao lado seria a segunda
--   verdade sobre o mesmo fato, e ela divergiria na primeira publicacao
--   concorrente;
-- - **nenhuma tabela de pendencia editorial.** O e-book cita uma ferramenta
--   externa de gestao em varios pontos do fluxo, e o documento repete um
--   titulo de capitulo. Sao duas correcoes, e elas viram a versao 2 com
--   `exige_releitura` -- que e exatamente o caso que a releitura existe para
--   cobrir. Duas tasks, nao uma tabela.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- MEDIDO COM QUATRO MUTACOES, e a primeira e a que vale ler:
--
--   - devolver `academy_progresso_item_unico` a forma da 0096 -- que e o que
--     o sprint deixaria de pe -- derruba **5 cenarios**, e o primeiro deles
--     traz a recusa exata: *duplicate key value violates unique constraint
--     "academy_progresso_item_unico"* no PRIMEIRO capitulo marcado. Nao e um
--     numero errado, e a funcionalidade recusada;
--   - perguntar `concluido` antes da releitura em `academy_estado_do_item`
--     derruba **1**, e e o cenario da ordem: quem confirmou a v1 tem a linha
--     concluida, entao a resposta sai 'concluido' e a v2 com a marca nao
--     cobra ninguem;
--   - tirar `versao` da chave unica dos checklists derruba **2**;
--   - abrir a leitura dos checklists para `is_gestor()` derruba **2**, e os
--     dois medem pela API e nao pela tela.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - O FORMATO DO ARQUIVO
--
-- E enum e nao texto, pela razao de `posts.midia` na 0042: e ele que decide
-- qual tela aparece por cima -- visualizador de PDF ou iframe --, e um
-- `'HTML_interativo'` com caixa trocada faria a tela cair no ramo errado sem
-- erro nenhum. `formato` tem default `pdf` porque todo arquivo anterior a
-- esta migration e um.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if not exists (select 1 from pg_type where typname = 'academy_ebook_formato') then
    create type public.academy_ebook_formato as enum ('pdf', 'html_interativo');
  end if;
end;
$bloco$;

alter table public.academy_arquivos
  add column if not exists formato       public.academy_ebook_formato not null default 'pdf',
  add column if not exists versao        integer not null default 1,
  add column if not exists notas_mudanca text,
  add column if not exists exige_releitura boolean not null default false,
  add column if not exists publicado_em  timestamptz not null default now();

-- A NUMERACAO DAS LINHAS QUE JA EXISTEM VEM ANTES DO INDICE, e sem ela a
-- migration falha em qualquer banco onde alguem ja trocou o arquivo de um
-- e-book: o default e 1 para todas, e `unique (item_id, versao)` recusa a
-- segunda. A ordem e `created_at`, que e a mesma que `abrirItem()` usa para
-- escolher o arquivo vigente -- entao o de maior versao passa a ser o mesmo
-- que a tela ja mostrava.
do $bloco$
declare
  v_quantas integer;
begin
  with numeradas as (
    select id,
           row_number() over (partition by item_id order by created_at, id) as n
      from public.academy_arquivos
  )
  update public.academy_arquivos a
     set versao = numeradas.n
    from numeradas
   where numeradas.id = a.id
     and a.versao is distinct from numeradas.n;

  get diagnostics v_quantas = row_count;
  raise notice '0102: % arquivo(s) renumerado(s).', v_quantas;
end;
$bloco$;

create unique index if not exists academy_arquivo_versao_unica
  on public.academy_arquivos (item_id, versao);

comment on column public.academy_arquivos.versao is
  'A versao do e-book. A vigente e a MAIOR -- nao existe coluna `atual`, pela razao de `academy_playbook_versoes.numero_versao` (0096): uma bandeira ao lado seria a segunda verdade sobre o mesmo fato.';
comment on column public.academy_arquivos.exige_releitura is
  'Devolve a pendencia a quem ja tinha confirmado uma versao anterior. Desmarcado para correcao de texto: senao toda virgula trocada vira um aviso, e na terceira ninguem mais le nenhum.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A CONFIRMACAO DE LEITURA PASSA A SER DO ITEM
--
-- A 0096 amarrou o "Li e estou ciente" ao PLAYBOOK, e um e-book de processo
-- precisa da mesma confirmacao. Com esta coluna a pergunta deixa de ser "que
-- formato e este?" e passa a ser "este item cobra ciencia?", que e a pergunta
-- certa -- um e-book de inspiracao nao cobra, e um playbook de referencia
-- rapida pode nao cobrar.
--
-- O DEFAULT E `false` PORQUE ELE E O ESTADO DE QUASE TODO ITEM, e porque o
-- contrario faria todo item do acervo nascer cobrando uma confirmacao que
-- ninguem pediu -- a regra de `publicada_em` nascer publicada na 0028 vista do
-- outro lado: o default e o erro que ninguem paga.
-- ---------------------------------------------------------------------------
alter table public.academy_items
  add column if not exists exige_confirmacao_leitura boolean not null default false;

comment on column public.academy_items.exige_confirmacao_leitura is
  'Se este item cobra "Li e estou ciente" (0102). E do ITEM e nao do tipo: com ela o botao vale para playbook, e-book e curso sem um de-para por formato.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - OS CAPITULOS
--
-- `chave` E O CONTRATO ENTRE O HTML E O BANCO, e e a parte fragil desta
-- entrega: a pagina manda `'grafica'` e o banco resolve para o capitulo. Se um
-- dia o HTML renomear um id, a leitura daquele capitulo deixa de contar.
--
-- A SAIDA NAO E RECUSAR, e sim IGNORAR EM SILENCIO -- e o host que descarta,
-- antes de gravar. Uma chave desconhecida gravada solta seria uma linha de
-- progresso apontando para nada, que inflaria a contagem de "X de 23" sem
-- ninguem conseguir dizer qual capitulo ela e; e uma recusa barulhenta
-- quebraria a leitura inteira por causa de um id trocado. O que fica e a
-- contagem honesta: aquele capitulo volta a aparecer como nao lido, que e a
-- verdade do ponto de vista do banco.
--
-- A TABELA E DO ITEM E NAO DO ARQUIVO, de proposito: o capitulo e do e-book,
-- nao da versao dele. Uma v2 que reescreve o texto do capitulo 12 continua
-- tendo o capitulo 12, e amarrar o progresso a versao faria toda publicacao
-- zerar a leitura de todo mundo -- que e o oposto de `exige_releitura`, que
-- existe justamente para a gestao ESCOLHER quando zerar.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_ebook_capitulos (
  id       uuid primary key default gen_random_uuid(),
  item_id  uuid not null references public.academy_items (id) on delete cascade,
  chave    text not null,
  titulo   text not null,
  ordem    integer not null default 0,
  unique (item_id, chave)
);

comment on table public.academy_ebook_capitulos is
  'Os capitulos de um e-book interativo (0102). `chave` e o id do capitulo DENTRO do HTML -- o contrato entre a pagina e o banco. Chave desconhecida e ignorada pelo host, nunca gravada solta.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - O PROGRESSO POR CAPITULO
--
-- Veja o desvio 1 do cabecalho: o conserto aqui NAO e o que o sprint escreve.
-- A linha de um capitulo tem `aula_id` nulo, entao ela cai dentro de
-- `academy_progresso_item_unico` da 0096 e colide com a linha do item
-- inteiro. O indice do item ganha a segunda condicao, e o capitulo ganha o
-- proprio.
--
-- O `check` DE ALVO UNICO FICA, e ele nao e redundante com os indices: eles
-- impedem a REPETICAO de um alvo, e ele impede uma linha que aponta para uma
-- aula E um capitulo ao mesmo tempo -- um estado que nenhum indice recusa e
-- que nenhuma tela sabe desenhar.
-- ---------------------------------------------------------------------------
alter table public.academy_progresso
  add column if not exists capitulo_id uuid
    references public.academy_ebook_capitulos (id) on delete cascade;

drop index if exists public.academy_progresso_item_unico;
create unique index if not exists academy_progresso_item_unico
  on public.academy_progresso (user_id, item_id)
  where aula_id is null and capitulo_id is null;

create unique index if not exists academy_progresso_capitulo_unico
  on public.academy_progresso (user_id, item_id, capitulo_id)
  where capitulo_id is not null;

do $bloco$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'academy_progresso_um_alvo'
  ) then
    alter table public.academy_progresso
      add constraint academy_progresso_um_alvo
      check (num_nonnulls(aula_id, capitulo_id) <= 1);
  end if;
end;
$bloco$;

create index if not exists academy_progresso_capitulo_idx
  on public.academy_progresso (user_id, item_id) where capitulo_id is not null;

comment on column public.academy_progresso.capitulo_id is
  'O capitulo lido de um e-book interativo (0102). Com ele e `aula_id` nulos, a linha e do ITEM inteiro -- e por isso `academy_progresso_item_unico` precisou da segunda condicao.';


-- ---------------------------------------------------------------------------
-- PASSO 5 - OS CHECKLISTS
--
-- `versao` FAZ PARTE DA CHAVE, e esta e a decisao que mais importa deste
-- passo. A chave de um item de checklist no HTML e POSICIONAL
-- (`capitulo-bloco-item`), entao editar o e-book move posicoes. Guardando o
-- estado por versao, uma versao nova comeca com os checklists limpos.
--
-- **E limpo e melhor que errado, que e o ponto:** com o estado atravessando
-- versoes, alguem abriria a v2 e veria marcada uma caixa que agora quer dizer
-- outra coisa -- daria por conferido o que nao conferiu. E a razao pela qual
-- rodada fechada nunca e reescrita, aplicada a uma marcacao.
--
-- E O ARRAY E DE CHAVES, nao uma linha por item marcado: o bloco e escrito de
-- uma vez e lido inteiro, nunca consultado item a item. E o criterio de
-- `post_versions.arquivos` -- e aqui ele tambem e o que faz o `upsert` do
-- host ser uma escrita so por bloco, com debounce.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_ebook_checklists (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  item_id        uuid not null references public.academy_items (id) on delete cascade,
  versao         integer not null,
  chave          text not null,
  itens_marcados text[] not null default '{}',
  updated_at     timestamptz not null default now(),
  unique (user_id, item_id, versao, chave)
);

comment on table public.academy_ebook_checklists is
  'O estado dos checklists de um e-book interativo, por PESSOA e por VERSAO (0102). A versao entra na chave porque a chave do item e posicional: uma versao nova comeca limpa, e limpo e melhor que errado. Ninguem le a de ninguem, nem o socio -- e instrumento de trabalho, nao de controle.';

create or replace function public.academy_checklist_carimbar()
returns trigger
language plpgsql
set search_path = public
as $func$
begin
  new.updated_at := now();
  return new;
end;
$func$;

drop trigger if exists academy_checklist_carimbar on public.academy_ebook_checklists;
create trigger academy_checklist_carimbar
  before insert or update on public.academy_ebook_checklists
  for each row execute function public.academy_checklist_carimbar();


-- ---------------------------------------------------------------------------
-- PASSO 6 - A VERSAO DE RELEITURA DO E-BOOK, E O ESTADO DELE
--
-- O par de `academy_versao_de_releitura()` da 0096, do lado do arquivo. Ela
-- devolve a MAIOR versao marcada com `exige_releitura` -- e nao a mais nova:
-- quem confirmou a v3 nao e cobrado pela v2 que exigia releitura, porque a v3
-- veio depois dela.
-- ---------------------------------------------------------------------------
create or replace function public.academy_versao_de_releitura_do_arquivo(p_item uuid)
returns integer
language plpgsql
stable
set search_path = public
as $func$
declare
  v_versao integer;
begin
  select max(versao) into v_versao
    from public.academy_arquivos
   where item_id = p_item and exige_releitura;
  return v_versao;
end;
$func$;

/**
 * O ESTADO DE UM ITEM, agora com o e-book interativo dentro.
 *
 * A 0096 respondia, para o e-book, uma coisa so: concluido ou nao iniciado --
 * porque a conclusao era um clique no fim e nao havia nada entre os dois. Com
 * capitulos ha: quem leu catorze de vinte e tres esta EM ANDAMENTO, e dizer
 * "nao iniciado" para essa pessoa e a tela afirmando que ela nao comecou.
 *
 * E A RELEITURA PASSA A VALER PARA ELE, pela mesma comparacao do playbook:
 * `versao_confirmada` menor que a maior versao que exige releitura. Sem isto,
 * publicar a v2 com a marca nao devolveria o item a pendente para ninguem --
 * e a marca seria uma caixa que nao faz nada.
 *
 * **O E-BOOK SEM CAPITULO NENHUM NAO MUDA DE COMPORTAMENTO**, e e o caso do
 * e-book em PDF: sem capitulos cadastrados a conta cai no ramo antigo. E o
 * `count(*) = 0` do curso recem-aberto, aplicado aqui para o formato que nao
 * tem capitulo nenhum para contar.
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
     where user_id = p_user and item_id = p_item
       and aula_id is null and capitulo_id is null;

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

  -- E-BOOK.
  select concluido, versao_confirmada into v_feito, v_confirmada
    from public.academy_progresso
   where user_id = p_user and item_id = p_item
     and aula_id is null and capitulo_id is null;

  -- A RELEITURA VEM ANTES DA CONCLUSAO, e a ordem e a resposta: quem confirmou
  -- a v1 TEM a linha concluida, entao perguntar `concluido` primeiro devolveria
  -- 'concluido' e a v2 com a marca nao cobraria ninguem.
  if v_confirmada is not null then
    v_releitura := public.academy_versao_de_releitura_do_arquivo(p_item);
    if v_releitura is not null and v_confirmada < v_releitura then
      return 'releitura';
    end if;
  end if;

  if coalesce(v_feito, false) then return 'concluido'; end if;

  -- Com capitulos cadastrados, quem leu algum esta em andamento. Sem nenhum
  -- -- o e-book em PDF --, a conta cai no ramo antigo e nada muda.
  select count(*) into v_total
    from public.academy_ebook_capitulos where item_id = p_item;

  if coalesce(v_total, 0) > 0 then
    select count(*) into v_vistas
      from public.academy_progresso
     where user_id = p_user and item_id = p_item
       and capitulo_id is not null and concluido;
    if coalesce(v_vistas, 0) > 0 then return 'em_andamento'; end if;
  end if;

  return 'nao_iniciado';
end;
$func$;


-- ---------------------------------------------------------------------------
-- PASSO 7 - RLS
--
-- OS CAPITULOS SEGUEM O ITEM, pelas mesmas duas funcoes da 0096: quem enxerga
-- o item enxerga os capitulos dele, quem edita o item edita os capitulos.
-- Repetir `publicado or is_gestor()` aqui seria a segunda verdade sobre quem
-- ve o que, e ela divergiria no dia em que a primeira mudasse.
--
-- OS CHECKLISTS FECHAM EM `auth.uid()` NAS QUATRO OPERACOES, e **a gestao nao
-- le**. E a regua de `academy_anotacoes` palavra por palavra: checklist e
-- instrumento de trabalho, nao instrumento de controle -- o que a gestao
-- acompanha e a CONCLUSAO, que mora em `academy_progresso` e que ela le. Sem
-- essa separacao, a caixa "conferi o sangramento" vira uma coisa que alguem
-- marca para constar.
--
-- E e tabela PROPRIA e nao coluna de `academy_progresso` pela razao daquela:
-- **policy nao limita coluna**, e a gestao precisa ler o progresso para a aba
-- Acompanhamento existir.
-- ---------------------------------------------------------------------------
alter table public.academy_ebook_capitulos  enable row level security;
alter table public.academy_ebook_checklists enable row level security;

drop policy if exists academy_capitulos_select on public.academy_ebook_capitulos;
create policy academy_capitulos_select on public.academy_ebook_capitulos
  for select to authenticated using (public.academy_posso_ver(item_id));

drop policy if exists academy_capitulos_write on public.academy_ebook_capitulos;
create policy academy_capitulos_write on public.academy_ebook_capitulos
  for all to authenticated
  using (public.academy_posso_editar(item_id))
  with check (public.academy_posso_editar(item_id));

drop policy if exists academy_checklists_select on public.academy_ebook_checklists;
create policy academy_checklists_select on public.academy_ebook_checklists
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists academy_checklists_insert on public.academy_ebook_checklists;
create policy academy_checklists_insert on public.academy_ebook_checklists
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists academy_checklists_update on public.academy_ebook_checklists;
create policy academy_checklists_update on public.academy_ebook_checklists
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists academy_checklists_delete on public.academy_ebook_checklists;
create policy academy_checklists_delete on public.academy_ebook_checklists
  for delete to authenticated using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- CONFERENCIA (nao escreve nada)
-- ---------------------------------------------------------------------------
do $bloco$
declare
  v_indices integer;
begin
  select count(*) into v_indices
    from pg_indexes
   where schemaname = 'public'
     and indexname in ('academy_progresso_item_unico',
                       'academy_progresso_capitulo_unico',
                       'academy_arquivo_versao_unica');

  raise notice '0102: % de 3 indices no lugar.', v_indices;
  raise notice '0102: o e-book interativo esta pronto para receber o arquivo.';
end;
$bloco$;
