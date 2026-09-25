-- ---------------------------------------------------------------------------
-- 0053 - A ENTREGA TEM VARIOS ARQUIVOS, E NEM TODOS SAO IMAGEM
--
-- Decisao do usuario, sobre por onde a equipe sobe o material da campanha:
--
--   "na campanha, eu posso subir a arte, fazer justificativas, inclusive,
--    algumas artes, eu devo poder upar mais de uma versao. E ate mesmo
--    arquivos -- ja que algumas entregas sao em PDF, PSD ou AI."
--
-- ---------------------------------------------------------------------------
-- O QUE JA EXISTIA, E E QUASE TUDO
--
-- `deliverable_versions` nasceu na 0033 com `numero_versao`, `arte_url`,
-- `thumbnail_url`, `arquivo_nome`, `notas_mudanca` e `criado_por`, com o
-- trigger que numera e o que sincroniza a capa. O bucket privado
-- `campanhas-arquivos` tambem, com as quatro policies. **Mais de uma versao
-- ja funcionava, e a justificativa ja tinha coluna** -- o que nunca existiu
-- foi a TELA. E a mesma situacao em que o Social Media estava ate a 0042: o
-- Portal pronto, o lado de ca inexistente.
--
-- Por isso esta migration e pequena, e nao ha area nova: o lugar onde a
-- equipe sobe o material da campanha e a propria campanha, no painel.
--
-- ---------------------------------------------------------------------------
-- O QUE FALTAVA: VARIOS ARQUIVOS NA MESMA VERSAO
--
-- Uma entrega de campanha raramente e um arquivo. "Lamina A5" e o PDF de
-- impressao, o AI aberto e o JPG de conferencia -- tres arquivos, uma
-- entrega, uma decisao do cliente. Com uma coluna so, subir o segundo
-- apagava o primeiro, ou virava uma versao nova por arquivo: um historico em
-- que "v4" nao quer dizer quarta rodada de ajuste, quer dizer quarto arquivo.
--
-- `arquivos jsonb` e a MESMA FORMA de `post_versions.arquivos` (0042), e e de
-- proposito: duas listas de arquivo com dois formatos no mesmo produto seriam
-- dois jeitos de ler a mesma coisa. Cada item e `{url, nome}`.
--
-- E jsonb e nao tabela pelo criterio que ja separou o template de campanha do
-- workflow de task: a versao e escrita de uma vez e lida inteira, nunca
-- consultada arquivo a arquivo. Normalizar criaria uma tabela para servir um
-- `select * where id = ?`.
--
-- ---------------------------------------------------------------------------
-- A CAPA CONTINUA SENDO `arte_url`, E AGORA ELA PODE NAO EXISTIR
--
-- No post, a capa e o primeiro slide e sempre e imagem. Aqui o primeiro
-- arquivo pode ser um PSD -- que o navegador nao desenha. Entao a capa passa
-- a ser **a primeira imagem da lista**, e quando nao ha nenhuma ela fica
-- nula: o cartao mostra o nome do arquivo e o icone do tipo, em vez de uma
-- moldura quebrada.
--
-- Isso e o que `imagem_do_arquivo()` responde, e ela mora no banco e nao na
-- tela porque quem escolhe a capa e o trigger -- a tela so desenha o que
-- achou. Duas respostas para "qual e a capa" divergiriam no dia em que
-- alguem acrescentasse uma extensao.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

alter table public.deliverable_versions
  add column if not exists arquivos jsonb not null default '[]'::jsonb;

comment on column public.deliverable_versions.arquivos is
  'Os arquivos desta versao, ordenados: [{url, nome}] (0053). Mesma forma de `post_versions.arquivos`. A capa e a primeira IMAGEM da lista -- PDF, PSD e AI entram como arquivo e nao viram capa.';


-- ---------------------------------------------------------------------------
-- QUAL ARQUIVO O NAVEGADOR DESENHA
--
-- Pela extensao, e nao pelo mime: o que chega aqui e um caminho do Storage,
-- nao um upload. E a lista e curta de proposito -- svg fica de fora, porque
-- svg de terceiro dentro de `<img>` ja e vetor de script em muita aplicacao,
-- e o material de campanha vem de fora da agencia com frequencia.
-- ---------------------------------------------------------------------------
create or replace function public.imagem_do_arquivo(p_caminho text)
returns boolean
language plpgsql
immutable
as $funcao$
begin
  if p_caminho is null then
    return false;
  end if;
  return lower(p_caminho) ~ '\.(png|jpe?g|gif|webp|avif)$';
end
$funcao$;


-- ---------------------------------------------------------------------------
-- A SINCRONIZACAO, REESCRITA A PARTIR DA VERSAO MAIS NOVA
--
-- A 0033 e a unica que escreveu esta funcao, e e dela que esta parte. O que
-- muda: a capa passa a poder sair de `arquivos`, e `arquivo_nome` passa a
-- contar quantos sao quando ha mais de um -- senao o cartao mostra o nome do
-- primeiro e some com os outros dois, que e a mesma mentira que a lista de
-- slides do carrossel ja tinha contado uma vez.
-- ---------------------------------------------------------------------------
create or replace function public.sincronizar_entregavel_com_a_versao()
returns trigger
language plpgsql
security definer
set search_path = public
as $funcao$
declare
  quantos  integer := jsonb_array_length(coalesce(new.arquivos, '[]'::jsonb));
  capa     text;
  -- `rotulo` e nao `nome`: `deliverables` TEM uma coluna `nome`, e o Postgres
  -- recusa o update inteiro com "column reference is ambiguous" -- um erro
  -- que fala da coluna e nao da variavel, tres linhas depois de onde ela foi
  -- declarada.
  rotulo   text;
begin
  -- A PRIMEIRA IMAGEM DA LISTA, e nao o primeiro arquivo: um PSD como capa
  -- daria uma moldura quebrada no cartao e na miniatura do portal.
  select a->>'url' into capa
    from jsonb_array_elements(coalesce(new.arquivos, '[]'::jsonb)) a
   where public.imagem_do_arquivo(a->>'url')
   limit 1;

  if quantos = 1 then
    select a->>'nome' into rotulo
      from jsonb_array_elements(new.arquivos) a limit 1;
  elsif quantos > 1 then
    rotulo := format('%s arquivos', quantos);
  end if;

  update public.deliverables
     set versao_atual  = new.numero_versao,
         arte_url      = coalesce(capa, new.arte_url, arte_url),
         thumbnail_url = coalesce(capa, new.thumbnail_url, thumbnail_url),
         arquivo_nome  = coalesce(rotulo, new.arquivo_nome, arquivo_nome)
   where id = new.deliverable_id
     and new.numero_versao >= versao_atual;

  return new;
end
$funcao$;

notify pgrst, 'reload schema';
