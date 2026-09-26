-- ---------------------------------------------------------------------------
-- 0063 - A CAPA E A FOTO DE PERFIL DE CADA CLIENTE, NO PORTAL
--
-- Decisao do usuario: *"Quero que no portal do cliente, eu possa adicionar uma
-- capa, e uma foto de perfil para cada cliente"*. Escolha de layout entre tres
-- propostas: capa larga com a foto sobreposta, no desenho de perfil de rede
-- social. Quem sobe as duas e a agencia.
--
-- ---------------------------------------------------------------------------
-- A METADE QUE JA EXISTIA: `clients.logo_url`, A QUINTA PONTE
--
-- Ela nasceu na **0031**, esta na lista de colunas que o cliente PODE escrever
-- desde entao, e **nenhuma linha da interface a desenha** -- nem no painel,
-- nem no portal. Em doze sprints ela foi um campo de anotacao.
--
-- E a mesma situacao de `clients.drive_folder_id` antes do Sprint 16, de
-- `deliverables.subtask_id` antes da 0051, de `deliverable_versions` antes da
-- tela de Campanhas e de `posts.subtask_id` antes da 0061. Por isso a coluna
-- nova aqui e UMA: a capa.
--
-- ---------------------------------------------------------------------------
-- A CAPA E DA AGENCIA, E O LOGO CONTINUA DO CLIENTE -- a assimetria e decisao
--
-- `capa_url` entra na lista de `protect_client_columns`, e `logo_url` NAO sai
-- de onde esta. As duas coisas de uma vez pareceriam incoerencia; sao duas
-- perguntas diferentes:
--
--   * o **logo** e a marca da empresa dele. A regra escrita desde a 0005 e que
--     contato, e-mail, telefone e logo sao dele -- e tirar isso agora seria
--     desfazer uma decisao registrada para resolver um problema que ninguem
--     tem, porque nao existe tela de onde ele escreveria;
--   * a **capa** e enquadramento: e como a Full apresenta o portal daquele
--     cliente, do mesmo jeito que a coluna escura do login e a capa da
--     campanha (0050). Deixa-la editavel poria a identidade da tela na mao de
--     quem a visita.
--
-- ---------------------------------------------------------------------------
-- AS DUAS NO MESMO BUCKET PRIVADO, com a pasta do cliente na frente
--
-- `campanhas-arquivos`, como a capa da campanha -- e pela mesma razao dita na
-- 0050: um bucket publico so para capas daria dois lugares com duas regras
-- para imagens do mesmo cliente. O caminho comeca com o id dele, senao a capa
-- aparece para a equipe e some no portal dele, que foi o cuidado da 0050.
--
-- **Nao ha policy nova**: `clients_update` ja e da gestao, e as duas sao
-- colunas de `clients`. O que decide quem sobe o arquivo sao as policies do
-- bucket, que a 0033 criou.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

alter table public.clients
  add column if not exists capa_url text;

comment on column public.clients.capa_url is
  'Caminho da capa do portal no bucket `campanhas-arquivos` (0063). OPCIONAL: '
  'sem ela o cabecalho do portal cai numa faixa da cor da marca. So a agencia '
  'escreve -- `protect_client_columns` devolve o valor antigo para o cliente.';

comment on column public.clients.logo_url is
  'A foto de perfil da empresa, mostrada no portal desde a 0063. Continua '
  'editavel pelo cliente, ao contrario da capa: o logo e a marca dele, a capa '
  'e como a Full apresenta o portal.';


-- ---------------------------------------------------------------------------
-- A CAPA ENTRA NA LISTA DE COLUNAS PROTEGIDAS
--
-- Reconstruida a partir da versao da 0031 -- a MAIS NOVA, a que acrescentou o
-- slug. `create or replace function` reescreve a partir do que se digita, e o
-- que nao for copiado se perde: foi assim que a 0030 perdeu o bloco de
-- carimbos da 0007 e nenhuma subtarefa teve `concluida_em` por duas
-- migrations. Aqui o que se perderia era a protecao do slug, e o sintoma seria
-- o cliente trocando o endereco do proprio portal por um PATCH.
-- ---------------------------------------------------------------------------
create or replace function public.protect_client_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null or public.is_staff() then
    return new;
  end if;

  new.nome_empresa               := old.nome_empresa;
  new.ativo                      := old.ativo;
  new.drive_folder_id            := old.drive_folder_id;
  new.segmento                   := old.segmento;
  new.responsavel_atendimento_id := old.responsavel_atendimento_id;
  new.observacoes                := old.observacoes;
  new.created_at                 := old.created_at;

  -- O que faltava ate a 0031. O slug e o endereco do portal: trocado pelo
  -- proprio cliente, o `/portal/{slug}` que a gestao usa deixa de abrir.
  new.slug                       := old.slug;

  -- A CAPA E DA AGENCIA (0063). O logo, nao: ver o cabecalho desta migration
  -- -- a assimetria e decisao, e nao a lista incompleta de novo.
  new.capa_url                   := old.capa_url;

  return new;
end;
$$;

drop trigger if exists clients_protect_columns on public.clients;
create trigger clients_protect_columns
  before update on public.clients
  for each row execute function public.protect_client_columns();

notify pgrst, 'reload schema';
