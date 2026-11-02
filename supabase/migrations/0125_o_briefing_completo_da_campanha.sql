-- ===========================================================================
-- 0125 — O BRIEFING DA CAMPANHA É ESTRUTURADO, e não uma caixa de texto
--
-- Decisao do usuario, item 8 da lista dele: um briefing completo de campanha
-- com nome, objetivo, publico e periodo; mensagem, produtos, tom e canais;
-- tipos, quantidades, formatos e dimensoes; anexos, links e observacoes; e
-- restricoes. "Persistir com anexos" e "reutilizavel".
--
-- ---------------------------------------------------------------------------
-- METADE JA EXISTIA, e e isso que torna esta migration pequena.
--
--   nome e periodo       -> `campaigns.nome`, `data_inicio`, `data_fim` (0033)
--   tipos e quantidades  -> `campaign_composicao` (0122)
--   anexos e links       -> `task_referencias` DA DEMANDA (0004), com
--                           `tipo = 'link' | 'arquivo'` e o bucket
--                           `task-arquivos` que a tela de referencias da task
--                           ja usa
--   observacoes          -> `tasks.briefing_rico` + `briefing_texto`, que e
--                           onde o briefing de TODA demanda deste produto mora
--
-- O QUE NASCE AQUI SAO NOVE COLUNAS: sete narrativas em `campaigns` e duas
-- em `campaign_composicao`.
--
-- ---------------------------------------------------------------------------
-- NAO HA TABELA DE ANEXO NOVA, e a ausencia e a decisao da 0051, palavra por
-- palavra: *"o briefing e a pasta de entrega sao da DEMANDA, nao colunas
-- novas em `campaigns`. Uma segunda caixa de texto com o mesmo papel em outra
-- tabela seria o lugar onde as duas versoes do briefing divergem."*
--
-- `task_referencias` ja tem `tipo`, `url`, `titulo`, `arquivo_nome`, quem
-- adicionou e quando; ja se apagam uma a uma; e a policy ja decide quem
-- escreve. Uma `campaign_anexos` ao lado seria a segunda verdade sobre o
-- mesmo material -- e a que divergiria e a nova, porque a tela da demanda
-- continuaria escrevendo na antiga.
--
-- *O custo esta dito:* os anexos so podem ser subidos DEPOIS que a campanha
-- existe, porque antes nao ha `task_id` a que prende-los. E a razao escrita
-- da 0028 vista de outro angulo -- *"subtarefa, referencia e comentario
-- precisam de um `task_id` para serem gravados"* --, e o caminho e o que o
-- produto ja tem: a campanha e a demanda se apontam nos dois sentidos desde
-- a 0051.
--
-- ---------------------------------------------------------------------------
-- SAO COLUNAS E NAO UM `briefing jsonb`, pelo critério que o produto ja
-- escreveu duas vezes.
--
-- O de `post_versions.arquivos`: *jsonb e para o que se escreve de uma vez e
-- se le inteiro, nunca consultado item a item.* Estes campos sao consultados
-- item a item -- "quais campanhas falaram com este publico" e um relatorio, e
-- `publico` e a coluna por onde ele agrupa.
--
-- E o de `assets` na 0070: *num jsonb a tela inventa as chaves, ate a segunda
-- escrever `tom_voz` onde a primeira escreveu `tom_de_voz` -- sem erro de
-- tipo, sem erro de banco, e com o campo aparecendo vazio.* `check:tipos`
-- liga migration a coluna e **nao** liga chave de jsonb a nada.
--
-- ---------------------------------------------------------------------------
-- E ELAS NAO VAO PARA O BRIEFING EM TEXTO, que e a licao da 0124.
--
-- Lá a FRENTE vai para o briefing e a VERTENTE nao, com a razao escrita:
-- *"ela virou coluna, e escreve-la tambem seria a segunda verdade -- a do
-- texto e a que envelhece, porque ninguem reescreve o briefing no dia em que
-- alguem troca a vertente da demanda."* Vale igual para as sete: o que virou
-- coluna nao se escreve tambem em prosa.
--
-- **Quem le o briefing estruturado le na CAMPANHA**, e o caminho existe desde
-- a 0051: a demanda tem "Ver campanha" e a campanha tem "Abrir a demanda", e
-- a etapa de cada peca carrega o selo com o nome da campanha, que e link.
--
-- ---------------------------------------------------------------------------
-- NADA E `not null`, e e a decisao da 0015: ha campanha gravada antes desta
-- regra, e `not null` quebraria a migration em qualquer ambiente que tenha
-- uma. Preenche-las com um valor qualquer seria pior -- inventaria um publico
-- e um objetivo que ninguem combinou, e o relatorio os somaria.
--
-- ---------------------------------------------------------------------------
-- `canais` E TEXTO LIVRE E NAO ENUM, pela razao que a 0032 escreveu para
-- `posts.formato`: *"esses nomes mudam a cada temporada de produto das
-- plataformas, e um enum obrigaria uma migration a cada nome novo."* Feira,
-- out-of-home, e-mail e a rede da estacao entram sem migration.
--
-- *E isso custa a agregacao, que fica dito:* com texto livre "Instagram" e
-- "instagram" sao duas linhas do mesmo canal -- e e exatamente a razao pela
-- qual a 0122 e a 0124 fizeram `tipo` e `frente` serem enum. **A diferenca e
-- que ninguem conta por canal:** ele e informacao para quem produz, nao
-- dimensao de relatorio. No dia em que um relatorio por canal for pedido, o
-- enum e o de-para vem juntos, como decisao propria.
--
-- E **nao ha trava de repeticao nem de vazio**, ao contrario de
-- `posts.plataformas` (0082). Lá a repeticao fazia a contagem por rede somar
-- o mesmo post duas vezes; aqui um canal repetido desenha o mesmo chip duas
-- vezes num briefing lido por uma pessoa. Quem normaliza e
-- `canaisNormalizados()` em `lib/dominio/campanhas.ts`, um lugar so para os
-- dois chamadores -- e uma segunda pergunta no banco embaixo de uma primeira
-- que nenhuma conta usa e a 0060 de novo.
--
-- ---------------------------------------------------------------------------
-- `formato` E `dimensoes` SAO DA COMPOSICAO, e a chave dela nao muda.
--
-- "Dez estaticos em 1080x1350" e uma linha, nao dez: o formato e a medida sao
-- do TIPO, e e por isso que eles moram ao lado da quantidade. A chave
-- continua `(campaign_id, tipo)` pela razao que a 0122 escreveu --
-- *"duas linhas de 'estatico' seriam dois planos para o mesmo material"*.
--
-- *O que ela nao representa, e e consequencia aceita:* dez estaticos em duas
-- medidas diferentes. O campo e texto, entao "1080x1350 (feed) e 1080x1920
-- (story)" cabe escrito; o que nao cabe e a agencia querer CONTAR por medida,
-- e ai sao duas linhas e a chave muda.
--
-- ---------------------------------------------------------------------------
-- A ASSINATURA DE `abrir_campanha()` NAO MUDA, pela terceira vez.
--
-- `create or replace` nao troca a lista de argumentos -- ele cria uma SEGUNDA
-- funcao ao lado e a chamada antiga vira ambigua (a licao da 0061, que custou
-- um "Could not find the function" ao usuario), e um `drop`+`create` abriria
-- a janela que a 0120 pagou. As sete colunas sao escritas DEPOIS que a RPC
-- devolve, que e a forma da vertente na 0122, e as duas da composicao
-- tambem -- `abrir_campanha()` conta o plano das folhas, e o formato nao sai
-- de folha nenhuma.
--
-- **E a segunda escrita nao pode derrubar a campanha que acabou de nascer**:
-- a demanda, as etapas e as pecas ja estao gravadas, entao uma recusa aqui
-- nao desfaz nada e o que ela pode fazer e avisar. E a decisao de
-- `etapa_acompanha_o_entregavel` (0052).
--
-- ---------------------------------------------------------------------------
-- O MARCADOR do `onde-esta-o-banco.sql` aponta para o CORPO do trigger, e nao
-- para uma coluna: as nove nascem nos dois primeiros passos, e um marcador
-- numa delas diria `ok` sobre uma colagem que morreu no PASSO 3 -- que e o
-- pior lugar para morrer, porque as colunas de pe sem a protecao sao
-- justamente o briefing ao alcance de quem produz.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 — as sete colunas narrativas
-- ---------------------------------------------------------------------------
alter table public.campaigns
  add column if not exists objetivo   text,
  add column if not exists publico    text,
  add column if not exists mensagem   text,
  add column if not exists produtos   text,
  add column if not exists tom_de_voz text,
  add column if not exists canais     text[],
  add column if not exists restricoes text;

comment on column public.campaigns.objetivo is
  'O que esta campanha existe para conseguir (0125). Narrativa, nao enum: um objetivo de campanha nao cabe numa lista fechada.';

comment on column public.campaigns.publico is
  'Com quem ela fala (0125). E a coluna por onde um relatorio por publico agruparia, e e por isso que ela e coluna e nao chave de jsonb.';

comment on column public.campaigns.mensagem is
  'A mensagem central -- o que a peca precisa dizer (0125).';

comment on column public.campaigns.produtos is
  'Produtos ou servicos que entram na campanha (0125). Texto e nao vinculo a um catalogo: nao existe catalogo de produto neste produto, e inventar um seria um cadastro que ninguem mantem.';

comment on column public.campaigns.tom_de_voz is
  'Como ela fala (0125). Texto livre com sugestao na tela, pela razao de `posts.formato`: esses nomes sao da marca de cada conta, e um enum obrigaria uma migration por conta nova.';

comment on column public.campaigns.canais is
  'Onde a campanha vai ao ar (0125). TEXTO LIVRE e nao enum: feira, out-of-home, e-mail e a rede da estacao entram sem migration, e ninguem conta por canal -- ele e informacao para quem produz. Quem normaliza (apara, tira vazio, tira repetido) e `canaisNormalizados()` em `lib/dominio/campanhas.ts`.';

comment on column public.campaigns.restricoes is
  'O que NAO pode (0125): palavra proibida, claim que o juridico barra, cor que a marca nao usa. Ela e a unica das sete que recusa trabalho, e e a que mais dói quando ninguem le.';


-- ---------------------------------------------------------------------------
-- PASSO 2 — o formato e a medida de cada tipo
-- ---------------------------------------------------------------------------
alter table public.campaign_composicao
  add column if not exists formato   text,
  add column if not exists dimensoes text;

comment on column public.campaign_composicao.formato is
  'Em que formato aquele tipo sai (0125) -- "feed", "story", "reels", "A5 impresso". Texto pela razao de `posts.formato` (0032): o vocabulario muda a cada temporada de produto das plataformas.';

comment on column public.campaign_composicao.dimensoes is
  'A medida combinada (0125) -- "1080x1350", "A4", "9:16". Texto e nao dois inteiros: metade do que a agencia combina e proporcao ou nome de papel, e dois inteiros obrigariam a escolher a unidade no schema.';


-- ---------------------------------------------------------------------------
-- PASSO 3 — o briefing e de quem abre a campanha
--
-- A FUNCAO E COPIADA INTEIRA, e nao remendada: `create or replace function`
-- se reescreve a partir do texto que se escreve AGORA e **nao avisa quando o
-- texto novo tem menos coisa que o velho** -- e a licao da 0030, que perdeu
-- um bloco de carimbos inteiro assim e so apareceu na 0052. As quatro
-- recusas da 0078 estao todas abaixo, palavra por palavra.
--
-- POR QUE O BRIEFING ENTRA AQUI: ele e o combinado com o cliente, igual ao
-- nome, ao periodo e ao estado -- e `campaigns_update` e `is_staff()` desde a
-- 0033 **e tem que continuar sendo**, porque e por ela que o colaborador que
-- produz troca a CAPA (0050). Abrir a policy entregaria o combinado a quem
-- produz; a trava de coluna e trigger, pela razao de sempre:
-- **POLICY NAO LIMITA COLUNA.**
--
-- E ele RECUSA em vez de reescrever, como a 0078 ja fazia: os campos
-- aparecem na tela, e quem tenta mudar o objetivo precisa OUVIR que nao pode
-- -- senao salva, ve o texto antigo voltar e conclui que a tela quebrou.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_colunas_da_campanha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- O CLIENTE E A PRIMEIRA, E ELA NAO TEM EXCECAO -- nem para o socio, nem
  -- para o seed. Ela vem ANTES dos dois `return` de baixo de proposito.
  if new.client_id is distinct from old.client_id then
    raise exception using
      errcode = 'check_violation',
      message = 'A empresa de uma campanha não se troca.',
      hint    = 'A demanda e os materiais já enviados são da empresa de origem. Abra uma campanha nova para a outra.';
  end if;

  if public.is_atendimento() then
    return new;
  end if;

  -- Sem sessao quem escreve e o seed.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.nome is distinct from old.nome then
    raise exception using
      errcode = 'check_violation',
      message = 'Renomear a campanha é de quem a abriu.',
      hint    = 'O nome aparece no board da agência e no portal do cliente; peça ao Atendimento.';
  end if;

  if new.data_inicio is distinct from old.data_inicio
     or new.data_fim is distinct from old.data_fim then
    raise exception using
      errcode = 'check_violation',
      message = 'O período da campanha é de quem a abriu.',
      hint    = 'Ele foi combinado com o cliente; peça a troca ao Atendimento.';
  end if;

  if new.status is distinct from old.status then
    raise exception using
      errcode = 'check_violation',
      message = 'O estado da campanha é de quem a abriu.',
      hint    = 'Ativa, finalizada ou cancelada é decisão do Atendimento.';
  end if;

  -- O BRIEFING E O COMBINADO COM O CLIENTE (0125), como as tres de cima. A
  -- recusa e UMA para os sete campos e nao uma por campo: quem produz nao
  -- edita nenhum deles, e sete frases quase iguais no banco seriam sete
  -- lugares para divergir -- e a dica nomeia onde pedir, que e o que decide
  -- o que a pessoa faz em seguida.
  if new.objetivo   is distinct from old.objetivo
     or new.publico    is distinct from old.publico
     or new.mensagem   is distinct from old.mensagem
     or new.produtos   is distinct from old.produtos
     or new.tom_de_voz is distinct from old.tom_de_voz
     or new.canais     is distinct from old.canais
     or new.restricoes is distinct from old.restricoes then
    raise exception using
      errcode = 'check_violation',
      message = 'O briefing da campanha é de quem a abriu.',
      hint    = 'Objetivo, público, mensagem, produtos, tom, canais e restrições foram combinados com o cliente; peça a troca ao Atendimento. As observações e os anexos ficam na demanda, e esses você edita.';
  end if;

  return new;
end;
$$;

comment on function public.proteger_colunas_da_campanha is
  'Policy não limita coluna: `campaigns_update` é is_staff() porque quem produz troca a CAPA, e nome, período, estado e o BRIEFING (0125) são de is_atendimento(). A empresa não se troca para ninguém.';


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'campaigns'
      and column_name in ('objetivo','publico','mensagem','produtos',
                          'tom_de_voz','canais','restricoes'))        as sete_colunas,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'campaign_composicao'
      and column_name in ('formato','dimensoes'))                     as duas_da_composicao,
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'campaigns'
      and column_name = 'canais')                                     as canais_e_array,
  (select position('O briefing da campanha é de quem a abriu'
    in pg_get_functiondef(p.oid)) > 0
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'proteger_colunas_da_campanha') as trigger_protege_o_briefing,
  (select position('A empresa de uma campanha não se troca'
    in pg_get_functiondef(p.oid)) > 0
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'proteger_colunas_da_campanha') as e_a_empresa_continua_de_pe;
