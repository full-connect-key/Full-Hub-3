-- ===========================================================================
-- ENVIAR UM POST AO CLIENTE SEM A TELA INTERNA
--
-- ISTO E UM PALIATIVO, e vale dizer com todas as letras: a tela que faz isto
-- e o Sprint 14, e o proprio spec do Sprint 12 pediu para ela nao existir
-- ainda. Enquanto ela nao chega, o caminho e este.
--
-- APAGUE ESTE ARQUIVO no dia em que a tela existir. Script que escreve dado de
-- produto a mao nao envelhece bem: ele nao passa pelas validacoes da action,
-- nao aparece em nenhuma bateria, e no dia em que uma coluna mudar ele vai
-- gravar linha torta sem ninguem notar. Ele existe porque a alternativa hoje e
-- nao conseguir mandar post nenhum.
--
-- Sao TRES partes, e a primeira nao e SQL.
--
-- ---------------------------------------------------------------------------
-- PARTE 1 - A IMAGEM, no Storage (Dashboard -> Storage -> posts-artes)
--
-- O caminho do arquivo TEM QUE COMECAR pelo id da empresa:
--
--     {client_id}/{qualquer-coisa}.png
--
-- Exemplo: c0000000-0000-0000-0000-00000000000a/promocao-outubro.png
--
-- Nao e capricho: a policy "posts-artes: cliente le" pergunta
-- `(storage.foldername(name))[1]` -- ou seja, a PRIMEIRA PASTA do caminho --
-- e compara com as empresas de quem esta pedindo. Um arquivo solto na raiz do
-- bucket a equipe ve e o cliente nao, e a arte aparece quebrada na tela dele.
--
-- O bucket e privado de proposito: arte de post nao publicado e material da
-- agencia. O portal assina uma URL de uma hora na hora de mostrar.
--
-- ---------------------------------------------------------------------------
-- PARTE 2 e 3 - O post e as duas rodadas, aqui embaixo.
--
-- Preencha o bloco de VALORES e rode o arquivo inteiro. Ele avisa no fim o
-- que criou.
-- ===========================================================================
do $$
declare
  -- ----------------------------------------------------------- VALORES ----
  -- Troque estes seis. Os ids saem de Dashboard -> Table Editor.
  v_cliente_slug  text := 'mundo-verde';       -- a empresa, pelo endereco do portal
  v_produtor_mail text := 'social@exemplo.com';-- quem PRODUZIU o post
  v_gestor_mail   text := 'dev@exemplo.com';   -- quem ENVIA (desenvolvedor ou socio)

  v_tema     text := 'Promoção de outubro';
  v_legenda  text := 'Corre que acaba! Toda a linha com 20% até domingo.';
  v_data     date := current_date + 7;
  v_horario  time := '12:00';
  v_rede     public.plataforma_social := 'instagram';   -- instagram, facebook,
                                                        -- linkedin, tiktok,
                                                        -- youtube, twitter,
                                                        -- pinterest
  v_formato  text := 'feed';                   -- feed, story, reels, carrossel
  v_arquivo  text := 'promocao-outubro.png';   -- o nome que voce subiu na PARTE 1
  -- ------------------------------------------------------------------------

  cliente  uuid;
  produtor uuid;
  gestor   uuid;
  novo     uuid;
begin
  select id into cliente  from public.clients  where slug = v_cliente_slug;
  select id into produtor from public.profiles where email = v_produtor_mail;
  select id into gestor   from public.profiles where email = v_gestor_mail;

  if cliente is null then raise exception 'Empresa % nao encontrada.', v_cliente_slug; end if;
  if produtor is null then raise exception 'Pessoa % nao encontrada.', v_produtor_mail; end if;
  if gestor  is null then raise exception 'Pessoa % nao encontrada.', v_gestor_mail; end if;

  -- QUEM PRODUZ E QUEM ENVIA SAO PESSOAS DIFERENTES, e o banco cobra isso:
  -- `validar_nova_rodada` recusa "Ninguem envia ao cliente a propria entrega".
  -- Aprovar o proprio trabalho a gestao pode (migration 0029); enviar, nao.
  if produtor = gestor then
    raise exception 'Quem produz nao envia. Use duas pessoas diferentes.';
  end if;

  -- PARTE 2: o post. Nasce em `em_producao` -- invisivel para o cliente.
  insert into public.posts (client_id, tema, legenda, data_publicacao, horario,
                            plataforma, formato, arte_url, thumbnail_url, criado_por)
  values (cliente, v_tema, v_legenda, v_data, v_horario, v_rede, v_formato,
          cliente || '/' || v_arquivo, cliente || '/' || v_arquivo, produtor)
  returning id into novo;

  -- E a versao 1, que e o que faz o historico existir desde o comeco.
  insert into public.post_versions (post_id, arte_url, thumbnail_url, legenda,
                                    notas_mudanca, criado_por)
  values (novo, cliente || '/' || v_arquivo, cliente || '/' || v_arquivo,
          v_legenda, 'Primeira arte', produtor);

  -- PARTE 3: as duas rodadas.
  --
  -- `set_config` porque os triggers perguntam QUEM ESTA PEDINDO, e no SQL
  -- Editor `auth.uid()` e nulo -- sem isto o envio e recusado, corretamente.
  -- E o mesmo caminho que o PostgREST usa; nao fura nenhuma regra.
  perform set_config('request.jwt.claim.sub', produtor::text, true);
  insert into public.approval_rounds (content_type, content_id, numero_rodada,
                                      escopo, solicitado_por)
  values ('post', novo, 1, 'interna', produtor);

  perform set_config('request.jwt.claim.sub', gestor::text, true);
  update public.approval_rounds
     set status = 'aprovada', decidido_por = gestor, decidido_em = now()
   where content_type = 'post' and content_id = novo and escopo = 'interna';

  -- ESTE insert E O ENVIO. `posts.enviado_em` e consequencia dele, por
  -- trigger -- nao existe um "marcar como enviado" separado.
  insert into public.approval_rounds (content_type, content_id, numero_rodada,
                                      escopo, solicitado_por)
  values ('post', novo, 1, 'cliente', gestor);

  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Post % criado e enviado. Status: %. O cliente ja ve em /portal/social-media.',
    novo, (select status from public.posts where id = novo);
end
$$;
