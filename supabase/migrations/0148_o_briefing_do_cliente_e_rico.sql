-- =============================================================================
-- 0148 - O BRIEFING DO CLIENTE E RICO, E O TIPO CARREGA A FRENTE
-- =============================================================================
--
-- Cinco decisoes do usuario, na mesma mensagem, e as cinco sao sobre a MESMA
-- tela -- a abertura de pedido no portal:
--
--   11. "quero que quando o cliente pede algo, no portal do cliente, ele tenha
--       espaco para escrever o briefing igual o atendimento da agencia. com
--       tabelas, grifando. e no lugar de conte com suas palavras, esteja
--       escrito briefing msm"
--   12. "Nas solicitacoes do portal do cliente, pode tirar o onde isso entra.
--       quero que mude o que tipo de trabalho e, para permitir campanhas tbm"
--   13. "videos tbm sao pecas para rede"
--   14. "referencias devem vir so depois do briefing"
--   15. "toda caixa de texto deve ser igual o do briefing interno da agencia,
--       com aquelas funcionalidades"
--
-- -----------------------------------------------------------------------------
-- METADE DA ENTREGA E TELA, E IR MEDIR E O QUE SEPAROU O SQL DO RESTO.
--
-- O item 14 e ordem de secao, o 12 tira uma secao, e o 15 cai sozinho depois
-- do PASSO 6. O que precisa de banco sao DUAS colunas:
--
--   | o que ele pede                  | onde ja estava                        |
--   | ------------------------------- | ------------------------------------- |
--   | editor com tabela e grifo       | `EditorRico`, desde o Sprint 3        |
--   | o par jsonb + texto             | a forma de `tasks.briefing_rico`      |
--   | o roteiro de briefing           | `request_types.campos_json` (0068)    |
--   | **o briefing RICO do pedido**   | **nao existia**                       |
--   | **a frente que o tipo implica** | **nao existia**                       |
--
-- -----------------------------------------------------------------------------
-- `descricao` FICA, E E A METADE DE TEXTO DO PAR.
--
-- A tentacao e renomear: `descricao` passa a ser o texto do briefing, e o nome
-- deixa de dizer o que ela e. Renomear coluna em uso e migration arriscada sem
-- nada em troca -- a decisao de `prazo` e de `dias_uteis` --, e esta tem QUATRO
-- leitores: o `select` da lista, o detalhe dos dois lados e `briefingDoPedido`.
--
-- Entao o par e o de sempre, o mesmo de `tasks.briefing_rico`/`briefing_texto` e
-- de `subtasks.descricao_rica`/`descricao_texto`: o jsonb e o que o editor
-- desenha, `descricao` e o que a busca le e o que viaja para o briefing da
-- demanda. **As duas andam juntas, e o texto vazio vira NULO** -- um documento
-- do TipTap sem nada dentro ainda e um paragrafo vazio, e quem decide se ha
-- briefing e o TEXTO.
--
-- -----------------------------------------------------------------------------
-- A FRENTE PASSOU A SER DO TIPO, E ISSO E O ITEM 12 INTEIRO.
--
-- "Mude o que tipo de trabalho e, para permitir campanhas" tem duas leituras, e
-- a segunda metade da frase -- "pode tirar o onde isso entra" -- decide qual:
-- os TRES cartoes de frente da secao 3 (Social / Campanha / Nao sei dizer) e os
-- QUATRO cartoes de tipo da secao 2 perguntavam a mesma coisa duas vezes, em
-- duas secoes, com o cliente tendo de concordar consigo mesmo. Com a frente na
-- linha do TIPO, ha uma pergunta so e ela e a que ele reconhece.
--
-- **E ELA E COLUNA E NAO UM `case` NA TELA**, que e a decisao da 0087 palavra
-- por palavra: o papel de um elo de social e coluna de `social_flow_steps` para
-- o NOME do elo ser livre. Aqui e igual -- `request_types` e um catalogo que a
-- gestao edita na tela, sem deploy, e um de-para escrito no cliente deixaria o
-- tipo novo sem frente nenhuma, calado.
--
-- **E ELA ACEITA NULO, de proposito:** "Material impresso" e "Outro" nao sao
-- social nem campanha, e sao eles o "Nao sei dizer" que o cartao da 0137
-- oferecia. O pedido nasce sem frente, cai no chip "Sem classificacao" da fila
-- e a acao `classificarSolicitacao` (0124) existe desde entao para resolve-lo.
--
-- -----------------------------------------------------------------------------
-- A VERTENTE SAI DA TELA DO CLIENTE, E O CUSTO E DITO EM VEZ DE ESCONDIDO.
--
-- Ela continua sendo coluna de `client_requests` (0124) e continua viajando
-- para `tasks.vertente_id` na conversao. O que ela deixa de ser e uma PERGUNTA
-- ao cliente: medido, dos pedidos do banco NENHUM tem vertente preenchida, e
-- quem classifica por frente de negocio e o Atendimento, na demanda, onde
-- `tasks.vertente_id` existe desde a 0118. Uma pergunta que ninguem responde e
-- o pior tipo de campo (0023).
--
-- -----------------------------------------------------------------------------
-- O ROTEIRO PERDE A PERGUNTA QUE O BRIEFING JA FAZ (PASSO 6).
--
-- Tres dos quatro roteiros da 0068 tem um `texto_longo` OBRIGATORIO que e o
-- briefing com outro nome: "O que esta peca precisa dizer", "O que o video
-- precisa dizer", "O que voce precisa". Com um briefing rico acima deles, a
-- tela pede a mesma coisa duas vezes e cobra as duas.
--
-- **O `texto_longo` CONTINUA SUPORTADO no tipo**, e desenha um `<textarea>`; o
-- que sai e o conteudo de tres linhas de seed. O limite fica escrito: a
-- resposta de um roteiro e lida de volta como UMA linha `rotulo: valor` no
-- briefing da demanda, e `client_requests.respostas` e um mapa de strings --
-- enriquecer uma resposta de roteiro e alargar aquela coluna, e isso e decisao
-- propria. Com o PASSO 6, a unica caixa de texto que o formulario embarca e o
-- briefing rico, que e o item 15.
--
-- **E O `campos_json` E CONTEUDO DA AGENCIA E NAO SCHEMA**, que e a decisao da
-- 0137: os seis `update` sao cirurgicos -- alcancam a linha por NOME, mexem na
-- entrada por CHAVE, e cada um tem a guarda `@>` que o faz no-op na segunda
-- colagem. Um roteiro que a gestao editou conserva o que ela escreveu nas
-- outras chaves.
--
-- -----------------------------------------------------------------------------
-- O VIDEO E UMA PECA PARA REDE (item 13), E ISSO E UM CARTAO A MENOS.
--
-- "Video" era o terceiro dos quatro tipos. Ele sai do ar por `ativo = false` --
-- **desativar e nunca apagar**, que e a regra da etiqueta do Acervo
-- (`skills.ativa`) e a do fluxo de social: o pedido antigo que aponta para ele
-- conserva o tipo, e `request_types_select` e `is_staff() or ativo`, entao ele
-- deixa de ser oferecido ao cliente e continua legivel no detalhe de quem o
-- abriu. **Medido: ZERO pedidos apontam para ele** -- desativa-lo nao esconde
-- pedido de ninguem.
--
-- E onde o video passa a ser pedido e a pergunta `formato` de "Peca para
-- redes", que ja estava ali: ela ganha a opcao e a ajuda que dizem isso. A
-- `descricao` do tipo ficou sem leitor na 0137, entao ela nao e o lugar.
--
-- -----------------------------------------------------------------------------
-- E O TIPO "CAMPANHA" NASCE, porque sem ele o item 12 nao tem referente.
--
-- A frente `campanha` precisa de um cartao para ser escolhida, e as duas secoes
-- que a 0138 criou -- o periodo e a lista de materiais -- ja dependem dela.
-- O roteiro dele tem UMA pergunta factual: o briefing diz o que a campanha e, o
-- periodo diz quando, a composicao diz quantas pecas, e o que falta e para
-- QUEM.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PASSO 1 - o briefing rico do pedido.
-- -----------------------------------------------------------------------------
alter table public.client_requests
  add column if not exists briefing_rico jsonb;

comment on column public.client_requests.briefing_rico is
  'O briefing que o cliente escreveu, como documento do TipTap. E a metade RICA '
  'do par: `descricao` guarda o texto puro, que e o que a busca le e o que viaja '
  'para o briefing da demanda na conversao. As duas andam juntas, e o texto '
  'vazio deixa as duas nulas.';

-- -----------------------------------------------------------------------------
-- PASSO 2 - a frente que cada tipo implica.
-- -----------------------------------------------------------------------------
alter table public.request_types
  add column if not exists frente public.solicitacao_frente;

comment on column public.request_types.frente is
  'Que frente de producao este tipo de pedido implica, ou nulo quando ele nao e '
  'nem social nem campanha. E dela que `client_requests.frente` sai na abertura '
  'do pedido: a tela pergunta o TIPO, uma vez, e a frente vem junto. Nulo cai no '
  'chip "Sem classificacao" da fila, onde o Atendimento classifica.';

-- -----------------------------------------------------------------------------
-- PASSO 3 - a frente dos tipos que ja existem, por NOME.
--
-- Por nome e nao por id porque o seed da 0068 e idempotente por nome, e e o
-- nome que a gestao ve na tela. `frente is null` na guarda: um tipo que alguem
-- ja classificou a mao fica como esta.
-- -----------------------------------------------------------------------------
update public.request_types
   set frente = 'social'::public.solicitacao_frente
 where nome = 'Peça para redes'
   and frente is null;

-- -----------------------------------------------------------------------------
-- PASSO 4 - o tipo "Campanha" nasce.
--
-- `ordem = 15` para ele ficar logo depois de "Peça para redes": sao os dois
-- caminhos de producao da agencia, e os outros dois sao o que sobra.
-- -----------------------------------------------------------------------------
insert into public.request_types (nome, descricao, icone, ordem, frente, campos_json)
select * from (values
  (
    'Campanha',
    'Uma acao com varias pecas: lancamento, data comemorativa, promocao.',
    'Megaphone', 15, 'campanha'::public.solicitacao_frente,
    '[
      {"chave":"publico","rotulo":"Para quem","tipo":"texto","obrigatorio":false,
       "ajuda":"Quem a campanha precisa alcancar."}
    ]'::jsonb
  )
) as novo (nome, descricao, icone, ordem, frente, campos_json)
where not exists (select 1 from public.request_types t where t.nome = novo.nome);

-- -----------------------------------------------------------------------------
-- PASSO 5 - "Vídeo" sai do ar.
-- -----------------------------------------------------------------------------
update public.request_types
   set ativo = false
 where nome = 'Vídeo'
   and ativo;

-- -----------------------------------------------------------------------------
-- PASSO 6 - os roteiros perdem a pergunta que o briefing ja faz.
--
-- Os quatro `update` sao cirurgicos e idempotentes: a linha por NOME, a entrada
-- por CHAVE, e a guarda `@>` que faz a segunda colagem nao fazer nada.
-- -----------------------------------------------------------------------------

-- 6.1 "Peça para redes": sai o briefing repetido (`mensagem`) e sai a pergunta
--     de referencia, que depois do item 14 e a secao logo abaixo.
update public.request_types t
   set campos_json = coalesce((
         select jsonb_agg(c order by i)
           from jsonb_array_elements(t.campos_json) with ordinality as e(c, i)
          where c->>'chave' not in ('mensagem', 'referencias')
       ), '[]'::jsonb)
 where t.nome = 'Peça para redes'
   and (t.campos_json @> '[{"chave":"mensagem"}]'::jsonb
     or t.campos_json @> '[{"chave":"referencias"}]'::jsonb);

-- 6.2 "Material impresso": "Onde vai ser usada" e uma pergunta factual e curta,
--     entao ela deixa de ser caixa de texto e vira uma linha.
update public.request_types t
   set campos_json = (
         select jsonb_agg(
                  case when c->>'chave' = 'onde_usa'
                       then jsonb_set(c, '{tipo}', '"texto"'::jsonb)
                       else c end
                  order by i)
           from jsonb_array_elements(t.campos_json) with ordinality as e(c, i)
       )
 where t.nome = 'Material impresso'
   and t.campos_json @> '[{"chave":"onde_usa","tipo":"texto_longo"}]'::jsonb;

-- 6.3 "Outro": o roteiro dele era o briefing e nada mais, entao ele fica vazio
--     -- e a tela nao desenha a secao quando nao ha campo (`campos.length`).
update public.request_types t
   set campos_json = coalesce((
         select jsonb_agg(c order by i)
           from jsonb_array_elements(t.campos_json) with ordinality as e(c, i)
          where c->>'chave' <> 'mensagem'
       ), '[]'::jsonb)
 where t.nome = 'Outro'
   and t.campos_json @> '[{"chave":"mensagem"}]'::jsonb;

-- 6.4 "Vídeo": ele sai do ar no PASSO 5 e o roteiro dele e limpo do mesmo jeito,
--     porque o custo de deixar e o dia em que a gestao o reativar -- o briefing
--     voltaria a ser pedido duas vezes, e a razao do PASSO 6 nao tem como
--     valer para tres tipos e nao para o quarto. O que sobra nele e factual:
--     duracao, onde vai ao ar, e se ja existe material gravado.
update public.request_types t
   set campos_json = coalesce((
         select jsonb_agg(c order by i)
           from jsonb_array_elements(t.campos_json) with ordinality as e(c, i)
          where c->>'chave' <> 'mensagem'
       ), '[]'::jsonb)
 where t.nome = 'Vídeo'
   and t.campos_json @> '[{"chave":"mensagem"}]'::jsonb;

-- 6.5 "Peça para redes": e o `formato` passa a dizer que video entra aqui.
update public.request_types t
   set campos_json = (
         select jsonb_agg(
                  case when c->>'chave' = 'formato'
                       then c
                            || '{"opcoes":["Feed","Stories","Carrossel","Reels ou vídeo","Não sei ainda"]}'::jsonb
                            || '{"ajuda":"Vídeo entra aqui também — gravação, edição ou animação."}'::jsonb
                       else c end
                  order by i)
           from jsonb_array_elements(t.campos_json) with ordinality as e(c, i)
       )
 where t.nome = 'Peça para redes'
   and t.campos_json @> '[{"chave":"formato","opcoes":["Reels"]}]'::jsonb;

-- ---------------------------------------------------------------------------------
-- PASSO 7 - conferencia. Nao muda nada; e para ler depois de colar.
-- -----------------------------------------------------------------------------
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'client_requests'
             and column_name = 'briefing_rico')                  as briefing_rico,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'request_types'
             and column_name = 'frente')                         as tipo_tem_frente,
  (select count(*) from public.request_types
    where ativo and frente = 'social')                           as tipos_de_social,
  (select count(*) from public.request_types
    where ativo and frente = 'campanha')                         as tipos_de_campanha,
  (select count(*) from public.request_types where not ativo)    as tipos_fora_do_ar,
  -- ZERO e o resultado certo: depois do PASSO 6 a unica caixa de texto do
  -- formulario e o briefing rico, que e o item 15.
  (select count(*) from public.request_types
    where campos_json @> '[{"tipo":"texto_longo"}]'::jsonb)      as roteiros_com_caixa,
  (select count(*) from public.request_types
    where campos_json @> '[{"chave":"formato","opcoes":["Reels ou vídeo"]}]'::jsonb)
                                                                 as formato_com_video;
