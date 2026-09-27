-- ---------------------------------------------------------------------------
-- 0067 - A CAPA DA RECOMENDACAO, guardada AQUI e nao no site de origem
--
-- Decisao do usuario: "queria uma maneira de conectar alguma plataforma de
-- filmes na aba de recomendacoes, entao quando a pessoa recomenda um filme, a
-- capa do filme aparece. Pode ser puxando do link mesmo".
--
-- ---------------------------------------------------------------------------
-- NAO HA COLUNA NOVA, E ESSA E A PRIMEIRA COISA A DIZER.
--
-- `recommendations.imagem_url` existe desde a 0017, aparece no formulario e o
-- cartao do feed ja a desenha. O que nunca existiu foi de onde ela viesse sem
-- alguem colar um endereco a mao -- e, pior, o que ela guarda NAO APARECE:
-- o CSP do Sprint 16 fecha `img-src` em `'self' data: blob:` mais o Google e o
-- Supabase, entao uma capa hospedada em qualquer outro lugar e recusada pelo
-- navegador e o cartao sai com a moldura quebrada. Nenhum build diz isso.
--
-- Entao o campo existia, a tela o desenhava, e ele so funcionava para um
-- endereco do proprio Supabase. E a OITAVA ponte construida e nunca
-- atravessada do produto.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- A CAPA E BAIXADA E GUARDADA, e nao apontada la fora. Tres razoes, e as tres
-- sao mecanicas:
--
--   1. O CSP. Abrir `img-src` para `https:` resolveria e entregaria junto o
--      preco que o comentario do proprio CSP ja calculou para UMA origem: o
--      navegador de cada pessoa pediria a imagem ao servidor do outro site, e
--      aquele site ficaria sabendo o que a agencia anda indicando. Com um host
--      so isso ja foi anotado como custo; com `https:` inteiro seria um host
--      novo por recomendacao.
--   2. Capa apontada la fora SOME. O poster muda de endereco, o site sai do ar,
--      e o feed de tres anos atras fica cheio de moldura quebrada.
--   3. Um `<img>` que aponta para fora vaza o `Referer` de quem esta olhando.
--
-- O bucket e PRIVADO, como todos os outros do produto, e a tela assina cada
-- endereco na hora -- a mesma forma de `assinarNotas` e das artes de campanha.
-- Poster de filme e publico na internet, mas "publico la" nao e razao para
-- abrir um bucket aqui: quem le e `is_staff()`, e a lista do que a agencia
-- indica internamente e dela.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if not exists (select 1 from pg_class where relname = 'buckets' and relnamespace = 'storage'::regnamespace) then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('recomendacoes-capas', 'recomendacoes-capas', false)
  on conflict (id) do nothing;

  drop policy if exists "capas: a equipe le" on storage.objects;
  drop policy if exists "capas: quem indica escreve na pasta dela" on storage.objects;
  drop policy if exists "capas: quem indica apaga a dela" on storage.objects;

  -- A EQUIPE INTEIRA LE, e nao so quem postou: o feed e de todo mundo, e uma
  -- capa que so o autor enxerga seria uma moldura quebrada para os outros
  -- oito. E o cliente nao alcanca -- `is_staff()` -- porque as Recomendacoes
  -- nao abrem para o Portal, o que a RLS das tres tabelas ja garante.
  execute $politica$
    create policy "capas: a equipe le" on storage.objects
      for select to authenticated
      using (bucket_id = 'recomendacoes-capas' and public.is_staff())
  $politica$;

  -- A PASTA E DE QUEM INDICA, como no bucket de notas: sem o recorte,
  -- `is_staff()` sozinho deixaria qualquer pessoa da equipe sobrescrever a
  -- capa da recomendacao de outra -- e a troca passaria calada, porque o
  -- endereco gravado continua o mesmo.
  execute $politica$
    create policy "capas: quem indica escreve na pasta dela" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'recomendacoes-capas'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and public.is_staff()
      )
  $politica$;

  -- APAGAR E DE QUEM POS, ou da gestao -- a mesma regra das referencias do
  -- post e do proprio feed: a gestao MODERA APAGANDO, nunca reescrevendo.
  execute $politica$
    create policy "capas: quem indica apaga a dela" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'recomendacoes-capas'
        and (
          (storage.foldername(name))[1] = (select auth.uid())::text
          or public.is_gestor()
        )
      )
  $politica$;
end;
$bloco$;

-- NAO HA POLICY DE UPDATE, e a ausencia e a regra: trocar o arquivo por baixo
-- de um endereco ja gravado e trocar a imagem sem deixar rastro. O caminho e
-- gravar outro arquivo e apontar a recomendacao para ele -- a mesma decisao de
-- `post_referencias`, que nao tem UPDATE porque mudar o endereco de uma
-- referencia que alguem ja abriu e trocar o destino embaixo de quem a leu.

comment on column public.recommendations.imagem_url is
  'A capa: o caminho no bucket privado recomendacoes-capas, descoberto do link pelo og:image (0067). Endereco absoluto ainda vale, e e o que havia antes -- mas o CSP so deixa aparecer o que vem do proprio Supabase.';

notify pgrst, 'reload schema';
