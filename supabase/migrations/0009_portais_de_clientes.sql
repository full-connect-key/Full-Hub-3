-- ===========================================================================
-- 0009 - Portais de Clientes
--
-- O que este arquivo acrescenta:
--
--   1. `clients.slug` -- o endereco legivel de cada empresa. A gestao abre
--      /portal/mundo-verde e ve o portal daquele cliente COMO EQUIPE: a sessao
--      continua sendo a da pessoa interna, com o auth.uid() dela. Nao existe
--      "entrar como cliente" em lugar nenhum deste projeto.
--
--   2. `client_portal_views` -- o registro de quem da equipe abriu o portal de
--      qual cliente e quando. E o que a auditoria do Sprint 16 vai ler.
--
--   3. Limpeza dos clientes de teste com nome gerado por maquina.
--
--   4. Um tipo de tarefa para cada fluxo orfao, para que a tela unificada de
--      tipos de tarefa nao esconda nenhum modelo ja cadastrado.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O slug
--
-- Gerado do nome da empresa: minusculas, sem acento, hifens no lugar do resto.
-- "Óptica Visão" -> "optica-visao".
--
-- `translate` em vez da extensao `unaccent`: a extensao precisa ser instalada
-- no projeto do Supabase, e uma migration que depende disso quebra num
-- ambiente novo. A tabela de acentos abaixo cobre o portugues, que e o que
-- esta base tem.
--
-- A TABELA TRADUZ MAIUSCULA E MINUSCULA, e vem ANTES do lower(). Em banco com
-- collation C -- que e o que um Postgres cru costuma ter --, lower() so mexe
-- em ASCII: "Optica Visao" com O acentuado sairia "ptica-visao", porque o
-- acento maiusculo passaria intacto pelo lower() e seria varrido pelo regex
-- em seguida. O erro so aparece em nome que comeca com acento, que e
-- exatamente o caso que ninguem testa.
-- ---------------------------------------------------------------------------

-- As palavras que o Portal ja usa como secao. Um cliente chamado "Campanhas"
-- pegaria o slug "campanhas", e /portal/campanhas deixaria de ser a secao para
-- virar o portal dele -- ou nem isso, porque no Next a rota estatica ganha da
-- dinamica, e o portal daquele cliente simplesmente nunca abriria. O slug
-- reservado ganha sufixo, como qualquer outro conflito.
create or replace function public.slug_reservado(texto text)
returns boolean
language plpgsql
immutable
as $$
begin
  return texto in (
    'aprovacoes', 'campanhas', 'social-media', 'configuracoes',
    'painel', 'portal', 'login', 'auth', 'api', 'status'
  );
end;
$$;

comment on function public.slug_reservado is
  'Palavras que ja sao rota do sistema e nao podem virar endereco de cliente.';

create or replace function public.gerar_slug(texto text)
returns text
language plpgsql
immutable
as $$
declare
  limpo text;
begin
  if texto is null then
    return null;
  end if;

  limpo := translate(
    trim(texto),
    'áàâãäéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
    'aaaaaeeeeiiiiooooouuuucnyyAAAAAEEEEIIIIOOOOOUUUUCNY'
  );

  limpo := lower(limpo);

  -- Tudo que nao e letra, numero ou hifen vira hifen; hifens repetidos viram
  -- um so; sobra nas pontas cai fora.
  limpo := regexp_replace(limpo, '[^a-z0-9]+', '-', 'g');
  limpo := regexp_replace(limpo, '-+', '-', 'g');
  limpo := trim(both '-' from limpo);

  if limpo = '' then
    return null;
  end if;

  return limpo;
end;
$$;

comment on function public.gerar_slug is
  'Nome legivel -> endereco: "Optica Visao" vira "optica-visao".';

alter table public.clients add column if not exists slug text;

-- O preenchimento vem antes do indice unico, senao a base existente o quebra.
-- Empresas com nomes que colapsam no mesmo slug ganham um sufixo numerico, em
-- ordem de cadastro: quem entrou primeiro fica com o endereco limpo.
do $$
declare
  linha record;
  candidato text;
  tentativa integer;
begin
  for linha in
    select id, nome_empresa
      from public.clients
     where slug is null
     order by created_at, id
  loop
    candidato := public.gerar_slug(linha.nome_empresa);
    if candidato is null then
      candidato := 'cliente';
    end if;

    tentativa := 1;
    while public.slug_reservado(candidato)
       or exists (select 1 from public.clients where slug = candidato) loop
      tentativa := tentativa + 1;
      candidato := public.gerar_slug(linha.nome_empresa) || '-' || tentativa;
    end loop;

    update public.clients set slug = candidato where id = linha.id;
  end loop;
end;
$$;

create unique index if not exists clients_slug_idx on public.clients (slug);

comment on column public.clients.slug is
  'Endereco do portal do cliente: /portal/<slug>. Unico.';

-- Cliente novo nasce com slug sem ninguem precisar lembrar. O gatilho so
-- preenche o que veio vazio -- um slug escolhido a mao continua valendo -- e
-- desempata sozinho quando dois nomes colapsam no mesmo endereco.
create or replace function public.preencher_slug_do_cliente()
returns trigger
language plpgsql
as $$
declare
  base text;
  candidato text;
  tentativa integer := 1;
begin
  -- Slug escolhido a mao continua valendo, mas nao escapa da reserva: quem
  -- digitar "campanhas" recebe um erro em vez de um endereco que nunca abre.
  if new.slug is not null and trim(new.slug) <> '' then
    new.slug := public.gerar_slug(new.slug);
    if public.slug_reservado(new.slug) then
      raise exception using
        errcode = 'check_violation',
        message = format('O endereco "%s" ja e uma secao do sistema. Escolha outro.', new.slug);
    end if;
    return new;
  end if;

  base := coalesce(public.gerar_slug(new.nome_empresa), 'cliente');
  candidato := base;

  while public.slug_reservado(candidato)
     or exists (
    select 1 from public.clients
     where slug = candidato
       and id is distinct from new.id
  ) loop
    tentativa := tentativa + 1;
    candidato := base || '-' || tentativa;
  end loop;

  new.slug := candidato;
  return new;
end;
$$;

drop trigger if exists clients_slug on public.clients;
create trigger clients_slug
  before insert or update of nome_empresa, slug on public.clients
  for each row execute function public.preencher_slug_do_cliente();


-- ---------------------------------------------------------------------------
-- PASSO 2 - O registro da visita
--
-- Cada abertura do portal de um cliente pela equipe vira uma linha. Nao e
-- controle de acesso -- quem e da gestao ja podia ler esses dados pelo painel
-- --, e sim memoria: no Sprint 16 a auditoria vai responder "quem andou vendo
-- o portal da Mundo Verde no mes passado".
--
-- `encerrado_em` fica nulo enquanto a aba esta aberta.
-- ---------------------------------------------------------------------------

create table if not exists public.client_portal_views (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  staff_user_id uuid not null references public.profiles (id) on delete cascade,
  iniciado_em   timestamptz not null default now(),
  encerrado_em  timestamptz
);

comment on table public.client_portal_views is
  'Quem da equipe abriu o portal de qual cliente. Insumo da auditoria do Sprint 16.';

create index if not exists client_portal_views_client_idx
  on public.client_portal_views (client_id, iniciado_em desc);
create index if not exists client_portal_views_staff_idx
  on public.client_portal_views (staff_user_id, iniciado_em desc);

alter table public.client_portal_views enable row level security;

drop policy if exists client_portal_views_select on public.client_portal_views;
drop policy if exists client_portal_views_insert on public.client_portal_views;
drop policy if exists client_portal_views_update on public.client_portal_views;

-- Leitura: gestao. O CLIENTE NAO LE. Nao porque a visita seja secreta, mas
-- porque essa tabela e instrumento interno, e o Portal nao tem tela para ela.
create policy client_portal_views_select on public.client_portal_views
  for select to authenticated
  using (public.is_gestor());

-- Escrita: so a propria pessoa, e so se ela for da gestao. Ninguem registra
-- visita em nome de outro -- um registro de auditoria que qualquer um pode
-- forjar nao registra nada.
create policy client_portal_views_insert on public.client_portal_views
  for insert to authenticated
  with check (public.is_gestor() and staff_user_id = (select auth.uid()));

-- Fechar a visita e o unico update, e so da linha da propria pessoa.
create policy client_portal_views_update on public.client_portal_views
  for update to authenticated
  using (public.is_gestor() and staff_user_id = (select auth.uid()))
  with check (public.is_gestor() and staff_user_id = (select auth.uid()));

-- Sem policy de DELETE: registro de auditoria nao se apaga pela aplicacao.


-- ---------------------------------------------------------------------------
-- PASSO 3 - Os clientes de teste com nome de maquina
--
-- "Empresa Audit 1787968499842", "Empresa Rebuilt ..." -- sobras de
-- verificacao automatica que ficaram na base. Nenhum codigo deste projeto
-- gera esses nomes.
--
-- Quem nao tem historico nenhum e apagado. Quem tem qualquer vinculo e
-- desativado, nunca apagado: a regra da casa e que nome citado em registro
-- antigo continua legivel.
-- ---------------------------------------------------------------------------

do $$
declare
  padrao text := '^Empresa (Audit|Rebuilt|Teste|Test)[ _-]*[0-9]{6,}$';
begin
  -- Sem vinculo: fora.
  delete from public.clients c
   where c.nome_empresa ~ padrao
     and not exists (select 1 from public.client_users  u where u.client_id = c.id)
     and not exists (select 1 from public.tasks         t where t.client_id = c.id)
     and not exists (select 1 from public.task_types    y where y.client_id = c.id)
     and not exists (
           select 1 from public.workflow_templates w where w.client_id = c.id
         );

  -- Com vinculo: sai de circulacao, mas o nome fica.
  update public.clients
     set ativo = false
   where nome_empresa ~ padrao
     and ativo;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - Nenhum fluxo orfao
--
-- A tela de Workflows passou a listar TIPOS DE TAREFA, com as etapas dentro.
-- Um workflow_template para o qual nenhum tipo aponta ficaria invisivel na
-- interface e continuaria inalcancavel na criacao de task -- que e o beco sem
-- saida que a versao anterior de "salvar as subtarefas como fluxo" criava.
--
-- Cada orfao ganha um tipo com o mesmo nome. Se ja existir um tipo com esse
-- nome e alcance, o orfao e deixado quieto: o indice unico e a autoridade.
-- ---------------------------------------------------------------------------

insert into public.task_types (nome, descricao, client_id, workflow_template_id, ativo)
select w.nome,
       w.descricao,
       w.client_id,
       w.id,
       w.ativo
  from public.workflow_templates w
 where not exists (
         select 1 from public.task_types t where t.workflow_template_id = w.id
       )
   and not exists (
         select 1 from public.task_types t
          where t.nome = w.nome
            and t.client_id is not distinct from w.client_id
       );
