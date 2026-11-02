-- ===========================================================================
-- 0126 - O COMENTARIO E DE UM CARD, E NAO SO DA PECA
--
-- Decisao do usuario, item 12 da lista dele: *"Comentarios individuais por
-- card do carrossel"*, com a hierarquia *"Campanha -> Peca -> Card"* e
-- *"historico individual, autor/data, respostas, indicadores, versoes; nao
-- misturar cards"*.
--
-- O CARD E UM SLIDE DO CARROSSEL, e o titulo do pedido diz isso: "card do
-- carrossel". Nao e o filho de um entregavel (aquilo e a arvore de dois
-- niveis da 0033) e nao e a caixinha de `post_etapa_progresso` (aquilo e uma
-- peca numa fase do mes). E um quadro da composicao -- o terceiro de cinco.
--
-- O QUE EXISTIA E O QUE FALTAVA
--
-- `comments` ja e polimorfica desde a 0032: `(content_type, content_id)` com
-- `content_type in ('post','deliverable')`, a thread de UM nivel por trigger,
-- `interno` e o autor forcados por trigger, o aviso para a equipe por trigger,
-- e as quatro policies. A tela de detalhe do material no portal e UMA SO para
-- post e entregavel, e ela ja desenha a thread. **Nada disso muda.**
--
-- O que faltava e uma coisa so: a thread nao sabe de QUAL quadro o cliente
-- esta falando. Um carrossel de cinco slides tem UMA conversa, e o pedido
-- mais comum da casa -- *"trocar o texto do terceiro"* -- obriga quem produz
-- a descobrir qual e o terceiro.
--
--
-- A ANCORA E A POSICAO, E NAO A URL -- E ISSO FOI MEDIDO
--
-- A URL do slide parece a ancora obvia: ela e estavel, sobrevive a reordem, e
-- ja esta no jsonb. Ela nao serve, e a medicao e esta:
--
--   `gravarVersao` recebe a lista `arquivos` INTEIRA, e o editor manda
--   `subidos` -- os arquivos que acabaram de subir. Entao a v2 de um
--   carrossel consertado tem CINCO CAMINHOS NOVOS no bucket.
--
-- Com a URL como ancora, a thread inteira se perde a cada versao nova --
-- exatamente no instante em que quem produz esta lendo o pedido para
-- atender. E o pior tipo de perda: silenciosa, e no unico momento em que
-- aquele texto decide alguma coisa.
--
-- Entao a ancora e o INDICE: o comentario e do terceiro quadro, e a thread do
-- terceiro quadro continua ali quando a v2 chega. E o que quem produz precisa
-- ler enquanto conserta.
--
--
-- E `card_versao` E O QUE IMPEDE O INDICE DE MENTIR
--
-- Remover um slide do meio grava uma versao nova com o que restou (0048),
-- entao os quadros ANDAM: o pedido que era do terceiro de cinco passa a cair
-- no terceiro de quatro, que era o quarto. Sem a versao, aquele texto se le
-- como sendo da composicao de hoje -- plausivel e errado, que e o modo de
-- falha desta casa.
--
-- Com ela, o comentario diz de que composicao ele falava, e o historico de
-- versoes -- que a tela ja desenha -- e onde se olha aquela. Uma afirmacao
-- verdadeira em vez de uma aproximacao.
--
--
-- NULO E A PECA, e e isso que mantem de pe tudo o que ja foi escrito. A
-- conversa entre as duas empresas e um registro, e uma migration nao a
-- reinterpreta: todo comentario que existe hoje continua sendo da peca, e
-- continua aparecendo onde aparecia.
--
--
-- O PAR E COERENTE NOS DOIS SENTIDOS, que e a forma de
-- `subtasks_tipo_aprovacao_coerente` (0007): os dois nulos, ou os dois
-- preenchidos. Um indice sem versao e o indice mentindo de novo; uma versao
-- sem indice e um campo que nao decide nada.
--
--
-- E O ENTREGAVEL NAO GANHA CARD, de proposito. `deliverable_versions.arquivos`
-- tem a mesma forma (0053) e quer dizer outra coisa: *"'Lamina A5' e o PDF de
-- impressao, o AI aberto e o JPG de conferencia -- tres arquivos, uma
-- entrega, uma decisao do cliente"*. Sao FORMATOS da mesma peca, nao quadros
-- de uma composicao. A generalizacao obvia -- "todo material com mais de um
-- arquivo tem cards" -- poria a thread do PDF separada da thread do AI, que
-- e a mesma peca dita duas vezes.
--
-- A coluna fica em `comments` porque ela e UMA tabela para os dois tipos; quem
-- separa e a TELA, pela pergunta que ela ja faz para desenhar a faixa da
-- composicao. Uma segunda tabela de comentario de card seria a quarta tabela
-- de comentario do produto, e a quarta e a que divergiria.
--
--
-- NAO HA TRIGGER PROTEGENDO AS DUAS COLUNAS, e a ausencia e medida: um
-- `card_indice = 7` forjado num carrossel de cinco poe o comentario de quem o
-- forjou numa thread que ninguem abre. Nao ha o que proteger.
--
-- A unica incoerencia que importa de verdade E protegida, e e a RESPOSTA: sem
-- o trigger abaixo, um `resposta_a` apontando para um comentario do card 3
-- chega com `card_indice` nulo e cai na thread da PECA -- respondendo uma
-- pergunta numa thread que nao mostra a pergunta. O trigger de um nivel
-- passou a herdar o card da raiz, pela mesma razao pela qual ele ja reescreve
-- `resposta_a`.
--
-- E NAO HA CHECK LIGANDO O INDICE AO NUMERO DE SLIDES. Ele precisaria de uma
-- subconsulta, que o Postgres recusa em check constraint (`cannot use
-- subquery in check constraint`, a pegadinha da 0082), e como trigger ele
-- recusaria um comentario porque um slide saiu entre a leitura da tela e a
-- escrita -- uma recusa que a tela nao sabe explicar.
--
--
-- Aplicada em: 2026-11-02
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - As duas colunas
-- ---------------------------------------------------------------------------
alter table public.comments
  add column if not exists card_indice integer,
  add column if not exists card_versao integer;

comment on column public.comments.card_indice is
  'De qual quadro da composicao e o comentario, contado de zero. Nulo = da peca inteira (0126).';
comment on column public.comments.card_versao is
  'O numero da versao que estava na tela quando o comentario foi escrito. Sem ele o indice passa a mentir no dia em que um slide sai (0126).';


-- ---------------------------------------------------------------------------
-- PASSO 2 - O par e coerente nos dois sentidos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comments_card_coerente') then
    alter table public.comments
      add constraint comments_card_coerente
      check (
        (card_indice is null and card_versao is null)
        or (card_indice is not null and card_versao is not null)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'comments_card_indice_valido') then
    alter table public.comments
      add constraint comments_card_indice_valido
      check (card_indice is null or card_indice >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'comments_card_versao_valida') then
    alter table public.comments
      add constraint comments_card_versao_valida
      check (card_versao is null or card_versao >= 1);
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 3 - O indice da leitura por card
--
-- A tela le a thread de UM quadro, e ela faz isso a cada clique na faixa. O
-- indice de 0032 e `(content_type, content_id, created_at)`, que serve a
-- thread da peca; este acrescenta o quadro no meio.
-- ---------------------------------------------------------------------------
create index if not exists comments_card_idx
  on public.comments (content_type, content_id, card_indice, created_at);


-- ---------------------------------------------------------------------------
-- PASSO 4 - A RESPOSTA HERDA O CARD DA RAIZ
--
-- A funcao foi COPIADA INTEIRA e nao remendada, que e a licao da 0030:
-- `create or replace function` se reescreve a partir do texto que se escreve
-- agora, e nao avisa quando o texto novo tem menos coisa que o velho. O que
-- muda sao as quatro linhas marcadas no fim.
--
-- POR QUE A HERANCA, em uma frase: a thread tem um nivel so, entao toda
-- resposta pertence a thread da raiz -- e a raiz tem um card. Sem isso, quem
-- responde a um pedido do card 3 escreve na thread da peca, onde a pergunta
-- nao esta.
-- ---------------------------------------------------------------------------
create or replace function public.comentario_de_um_nivel()
returns trigger
language plpgsql
security definer
set search_path = public
as $corpo$
declare
  v_raiz        uuid;
  v_card_pai    integer;
  v_versao_pai  integer;
begin
  if new.resposta_a is null then
    return new;
  end if;

  -- ATRIBUICAO, E NAO `select ... into`. NESTE ARQUIVO INTEIRO.
  --
  -- A razao esta escrita por extenso na 0032, e ela continua valendo: o SQL
  -- Editor do Supabase recusou aquele arquivo com `relation "avo" does not
  -- exist`, onde "avo" era a variavel do `into`. `select x into y` e a unica
  -- construcao do plpgsql em que uma variavel ocupa a posicao onde um parser
  -- espera uma relacao -- tirada ela, nao ha essa leitura possivel.
  v_raiz := (
    select c.resposta_a from public.comments c where c.id = new.resposta_a
  );

  if v_raiz is not null then
    new.resposta_a := v_raiz;
  end if;

  -- O CARD DA RAIZ GANHA DO CARD QUE VEIO NO PEDIDO (0126).
  --
  -- Lido DEPOIS da reescrita acima, para a pergunta ser sobre a raiz de
  -- verdade e nao sobre o comentario do meio que acabou de ser achatado.
  v_card_pai := (
    select c.card_indice from public.comments c where c.id = new.resposta_a
  );
  v_versao_pai := (
    select c.card_versao from public.comments c where c.id = new.resposta_a
  );

  new.card_indice := v_card_pai;
  new.card_versao := v_versao_pai;

  return new;
end;
$corpo$;

-- `create or replace trigger` e nao `drop`+`create`, e a escolha e desta
-- migration: o gatilho ja existe desde a 0032, apontando para esta mesma
-- funcao -- `create or replace function` sozinho ja troca o corpo que ele
-- executa, e estas tres linhas sao defensivas, para o banco em que alguem
-- apagou o gatilho a mao. Na forma `drop`+`create` elas abririam uma janela
-- em que a tabela fica sem o trigger de um nivel no meio da colagem.
create or replace trigger comments_um_nivel
  before insert on public.comments
  for each row execute function public.comentario_de_um_nivel();


-- ---------------------------------------------------------------------------
-- CONFERENCIA - cole junto e leia a saida
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'comments'
      and column_name in ('card_indice', 'card_versao'))        as colunas_de_2,
  (select count(*) from pg_constraint
    where conname in ('comments_card_coerente',
                      'comments_card_indice_valido',
                      'comments_card_versao_valida'))           as checks_de_3,
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'comments_card_idx') as indice_de_1,
  (select count(*) from pg_proc
    where proname = 'comentario_de_um_nivel'
      and prosrc like '%new.card_indice := v_card_pai%')         as heranca_de_1;
