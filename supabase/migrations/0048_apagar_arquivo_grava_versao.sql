-- ---------------------------------------------------------------------------
-- 0048 - APAGAR UM ARQUIVO E GRAVAR UMA VERSAO, NAO REESCREVER A ATUAL
--
-- Decisao do usuario: "quando eu subo uma midia do post, se eu subir uma
-- imagem, nao consigo deletar ela depois se ela tiver sido errada -- pode
-- liberar para poder apagar uma imagem e subir novamente, SEMPRE REGISTRANDO
-- NO HISTORICO."
--
-- ---------------------------------------------------------------------------
-- REMOVER E UMA VERSAO NOVA, e e a frase dele que decide o desenho
--
-- "Sempre registrando no historico" ja e a regra de `post_versions` desde a
-- 0032: cada subida grava uma versao, e as anteriores continuam la -- e por
-- isso o portal nao tem botao de reverter. Remover e a mesma operacao vista do
-- avesso, e por isso ela nao apaga linha nenhuma: grava uma versao NOVA com o
-- que restou, e a anterior continua mostrando o arquivo que saiu.
--
-- Editar a versao corrente no lugar seria a unica forma de a remocao sumir do
-- historico -- exatamente o que ele pediu que nao acontecesse.
--
-- E O ARQUIVO CONTINUA NO BUCKET. A versao anterior aponta para ele, e o
-- historico existe para ser aberto: apagar o objeto deixaria a v2 com uma
-- moldura cinza onde havia uma arte, e ninguem saberia se ela nunca existiu ou
-- se alguem a removeu. Limpeza de bucket, se um dia precisar, e rotina propria
-- que olha o que versao nenhuma cita.
--
-- ---------------------------------------------------------------------------
-- O QUE IMPEDIA, E E UMA LINHA
--
-- `sincronizar_post_com_a_versao` (0042) copia a capa da versao para o post com
-- `arte_url = coalesce(capa, arte_url)`. O `coalesce` e o desenho e continua
-- certo: **versao que nao mexeu num campo nao apaga o que estava la** -- quem
-- grava so a legenda nao pode zerar a arte.
--
-- Mas com ele, uma versao SEM arquivo nenhum tambem nao apaga: remover a unica
-- imagem gravava a versao e o post continuava com a capa velha. A remocao
-- entrava no historico e nao aparecia na tela -- o pior dos dois mundos.
--
-- E O SINAL E UMA COLUNA, e nao o array vazio -- que foi a minha primeira
-- tentativa, e a bateria a derrubou na hora.
--
-- `post_versions.arquivos` e `jsonb NOT NULL DEFAULT '[]'` desde a 0042. Entao
-- array vazio nao significa "esvaziou": significa "esta versao nao falou de
-- arquivo nenhum", que e o caso de TODA versao que so mexe na legenda. Com o
-- vazio como sinal, gravar um ajuste de texto apagava a arte do post.
--
-- A outra saida seria tirar o `not null` e o default, e fazer nulo ser "nao
-- mexeu". Ela funciona daqui para a frente e reinterpreta o passado: as
-- versoes ja gravadas tem `[]`, e todas passariam a dizer "esvaziei". Uma
-- coluna nova nao mente sobre o que ja esta no banco.
--
--   `removeu_arquivos = true` -> esta versao apagou o material do post
--
-- Roda mais de uma vez sem erro.
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

alter table public.post_versions
  add column if not exists removeu_arquivos boolean not null default false;

comment on column public.post_versions.removeu_arquivos is
  'Esta versao APAGOU o material do post (0048). E coluna e nao array vazio porque `arquivos` e `not null default []`, entao vazio quer dizer "nao falei de arquivo" -- o caso de toda versao que so mexe na legenda.';


-- A funcao e reescrita INTEIRA a partir da versao da 0042, que e a ultima.
create or replace function public.sincronizar_post_com_a_versao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  capa      text := new.arte_url;
  miniatura text := new.thumbnail_url;
  esvaziou  boolean := new.removeu_arquivos;
begin
  -- A CAPA SAI DO PRIMEIRO SLIDE quando a versao e de carrossel e nao trouxe
  -- `arte_url` explicita. Sem isto, subir cinco slides deixaria o card e o
  -- calendario sem imagem nenhuma -- e ninguem ligaria uma coisa a outra.
  --
  -- E VALE TAMBEM QUANDO SE REMOVE O PRIMEIRO: a versao nova chega com quatro
  -- slides e sem `arte_url`, entao a capa passa a ser o que era o segundo.
  if capa is null and jsonb_array_length(coalesce(new.arquivos, '[]'::jsonb)) > 0 then
    capa := new.arquivos->0->>'url';
    miniatura := coalesce(miniatura, new.arquivos->0->>'thumbnail_url');
  end if;

  update public.posts
     set versao_atual  = new.numero_versao,
         -- `case` E NAO `coalesce` SOZINHO (0048): o coalesce continua valendo
         -- para quem nao mexeu, e o ramo novo e o unico jeito de uma versao
         -- dizer "nao ha mais arte".
         arte_url      = case when esvaziou then null else coalesce(capa, arte_url) end,
         thumbnail_url = case when esvaziou then null else coalesce(miniatura, thumbnail_url) end,
         legenda       = coalesce(new.legenda, legenda),
         video_url     = coalesce(new.video_url, video_url),
         updated_at    = now()
   where id = new.post_id
     and new.numero_versao >= versao_atual;

  return new;
end;
$$;

comment on function public.sincronizar_post_com_a_versao is
  'Copia capa, legenda e link da versao para o post. A capa sai do primeiro slide; `removeu_arquivos` (0048) e o unico jeito de uma versao dizer "nao ha mais arte" -- o `coalesce` cuida de quem nao mexeu.';

notify pgrst, 'reload schema';
