-- ---------------------------------------------------------------------------
-- 0124 — A SOLICITACAO DIZ DE QUE FRENTE ELA E, E DE QUE VERTENTE
--
-- Decisao do usuario: *"na abertura de uma solicitacao, exigir a
-- classificacao como Social ou Campanha, vinculando a conta e a vertente, e
-- usar essa classificacao nos relatorios"*.
--
-- SAO TRES METADES, E DUAS JA EXISTIAM.
--
--   | o que o pedido pede | onde ja estava                                |
--   | ------------------- | --------------------------------------------- |
--   | a CONTA             | `client_requests.client_id`, `not null` (0068) |
--   | a CAMPANHA          | `client_requests.campaign_id` (0112)          |
--   | a FRENTE            | **nao existia** — e o que esta migration cria |
--   | a VERTENTE          | `client_vertentes` (0118), sem o vinculo      |
--
-- POR QUE A FRENTE NAO E DERIVADA, que e a primeira pergunta desta casa.
--
-- A tentacao e `campaign_id is not null ? 'campanha' : 'social'`, e ela cai em
-- uma frase: **campanha nula nao quer dizer social.** Um "Material impresso"
-- para a inauguracao de uma loja nao e nenhuma das duas, e um pedido de
-- campanha pode chegar antes de a campanha existir — e nesse caso a conta JA
-- sabe de que frente ele e, e o produto nao. A frente e uma DECLARACAO de quem
-- abre o pedido, nao uma conta sobre as colunas ao lado: e o contrario de
-- `atraso` no Financeiro e de `maoDoPost()` no Social, onde o que da para
-- calcular nao se guarda. Aqui nao da.
--
-- E ELA NAO E `request_type_id`, que e o outro candidato pronto. Aquele e o
-- ROTEIRO DE BRIEFING daquele trabalho — "Peca para redes", "Material
-- impresso", "Video", "Outro" (0068) —, e ele responde *o que e a peca*. A
-- frente responde *quem produz*: o mes de social (`abrir_mes_de_social`) ou
-- uma Wave (`abrir_campanha`). Uma peca para redes pode nascer das duas, e e
-- justamente isso que o relatorio precisa separar.
--
-- E ENUM E NAO TEXTO, pela razao da 0122 palavra por palavra: a frente e a
-- dimensao por onde o relatorio AGRUPA, e com texto livre "Social" e "social"
-- viram duas linhas do mesmo trabalho — o numero sai plausivel e errado, que e
-- o modo de falha desta casa. E a razao de `midia` ser enum na 0042: o que a
-- tela desenha por cima precisa ser um nome que o compilador confere.
--
-- E TRIGGER E NAO `not null`, QUE E A DECISAO DA 0015.
--
-- Ha pedido gravado antes desta regra. `not null` quebraria a migration em
-- qualquer ambiente com um deles, e preencher os antigos com um valor qualquer
-- seria pior: escolher "social" para um pedido que ninguem classificou e
-- inventar a resposta que o relatorio vai somar. E a frase da 0015 — *"not
-- null quebraria a migration em qualquer ambiente com task anterior a esta
-- regra, e migration que nao roda no proximo ambiente nao e migration"* — e e
-- tambem a decisao da 0118 sobre a vertente das demandas antigas: *"nao
-- modificar automaticamente as tasks antigas; permitir sua classificacao
-- posterior"*.
--
-- Entao a coluna aceita nulo, o TRIGGER exige na abertura, e o pedido antigo
-- fica em "Sem classificacao" — que e a verdade, aparece na fila, e e
-- classificavel depois.
--
-- A VERTENTE CONTINUA OPCIONAL, e isso e divergencia declarada do texto do
-- pedido. "Vinculando a conta e a vertente" ganhou o VINCULO: a coluna, a
-- chave estrangeira, a coerencia de conta, o campo na tela e o recorte no
-- relatorio. O que ela nao ganhou e obrigatoriedade, pela razao que a 0118
-- escreveu na mesma dimensao: *"'Sem vertente' fica como opcao, e nao e
-- indecisao: a reuniao mensal e o relatorio da conta nao pertencem a nenhuma
-- frente, e obrigar a escolha faria a pessoa classificar na primeira da lista
-- — que e pior que nao classificar, porque o relatorio passaria a conta-la
-- numa frente onde ela nao esta"*. E a maioria das contas nao tem vertente
-- nenhuma: ali o campo nao e desenhado, e uma trava cobraria uma lista vazia.
--
-- NAO NASCE COLUNA EM `tasks`, e a ausencia e decisao.
--
-- A conversao cria uma demanda (0068), e a tentacao e espelhar a frente nela
-- para `producao_do_periodo()` agrupar. Duas razoes contra: a demanda JA sabe
-- a frente dela pela estrutura — um mes de social tem `social_do_mes`, uma
-- campanha e apontada por `campaigns.task_id` —, e uma coluna ao lado seria a
-- segunda verdade sobre o mesmo fato, que divergiria na primeira demanda
-- convertida a mao que nao e nem uma nem outra. O que a conversao PROPAGA e a
-- VERTENTE, para `tasks.vertente_id`, que e a coluna que o board, a Biblioteca
-- e os relatorios ja leem desde a 0118 — e ela propaga na action, nao aqui,
-- porque `tasks_vertente_da_conta` e quem recusa a incoerencia e ela ja esta
-- de pe.
--
-- O INDICE E SO DA VERTENTE, e a ausencia do outro e medida. `frente` tem DOIS
-- valores: num indice, metade da tabela por entrada — o Postgres varre a
-- tabela de qualquer forma, e o recorte do relatorio e `created_at`, que a
-- 0068 ja indexou. `vertente_id` e alta cardinalidade e e por onde o
-- relatorio agrupa: esse se paga, e e parcial como `tasks_por_vertente`,
-- porque a maioria das contas nao tem vertente.
--
-- MEDIDO COM QUATRO MUTACOES, e os numeros estao na bateria:
--   tirar a exigencia da frente no insert derruba 3;
--   deixar esvaziar a frente de um pedido classificado derruba 1;
--   tirar a coerencia campanha -> frente derruba 2;
--   tirar a coerencia da vertente com a conta derruba 2 — a recusa e a dica.
-- ---------------------------------------------------------------------------

-- PASSO 1 — A frente -------------------------------------------------------
-- SAO DOIS VALORES E NAO TRES. "Nenhuma das duas" seria a terceira opcao
-- obvia, e ela desfaz o pedido: *exigir a classificacao* quer dizer que quem
-- abre escolhe um lado. O pedido que nao e nem um nem outro existe — e ele e
-- o pedido ANTIGO, que fica nulo, nao um valor que a tela oferece.
do $passo1$
begin
  if not exists (select 1 from pg_type where typname = 'solicitacao_frente') then
    create type public.solicitacao_frente as enum ('social', 'campanha');
  end if;
end;
$passo1$;

-- PASSO 2 — As duas colunas ------------------------------------------------
alter table public.client_requests
  add column if not exists frente public.solicitacao_frente;

comment on column public.client_requests.frente is
  'Social ou Campanha: quem produz este pedido (0124). Exigida na abertura '
  'pelo trigger `client_requests_classificacao`, e nula no pedido anterior a '
  'esta regra -- `not null` quebraria a migration, e inventar o valor seria '
  'inventar o numero que o relatorio soma.';

alter table public.client_requests
  add column if not exists vertente_id uuid
    references public.client_vertentes(id) on delete set null;

comment on column public.client_requests.vertente_id is
  'A vertente da conta a que este pedido pertence (0124, sobre a 0118). '
  'Opcional: a maioria das contas nao tem vertente, e "sem vertente" e um '
  'balde de verdade no relatorio. `on delete set null` porque o pedido '
  'sobrevive -- ele e o que o cliente escreveu.';

-- A VERTENTE E ALTA CARDINALIDADE E E POR ONDE O RELATORIO AGRUPA; a frente
-- tem dois valores e nao se paga. Parcial pela razao de `tasks_por_vertente`:
-- a maioria das linhas nao tem vertente nenhuma.
create index if not exists client_requests_por_vertente
  on public.client_requests (vertente_id) where vertente_id is not null;

-- PASSO 3 — A classificacao e exigida na abertura --------------------------
-- QUATRO REGRAS NUMA FUNCAO, e ela e separada da 0112 de proposito:
-- `pedido_campanha_da_mesma_conta()` funciona e nao se reescreve (a licao da
-- 0030 -- `create or replace` parte do texto de agora e nao avisa quando ele
-- tem menos coisa que o velho). Os dois gatilhos convivem, e a ordem e
-- alfabetica: "campanha" vem antes de "classificacao", entao a coerencia de
-- conta da 0112 recusa primeiro.
create or replace function public.client_requests_classificacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_dona uuid;
  v_nome text;
begin
  -- 1. A FRENTE E EXIGIDA NA ABERTURA, e so nela.
  if tg_op = 'INSERT' and new.frente is null then
    raise exception using
      errcode = 'not_null_violation',
      message = 'Diga se este pedido é de Social ou de Campanha.',
      hint    = 'A classificação decide quem produz, e é ela que o relatório '
                'da agência soma. Escolha uma das duas na abertura.';
  end if;

  -- 2. E ELA NAO SE ESVAZIA DEPOIS, que e a outra metade da 0015: lá a pasta
  -- de entrega e obrigatoria na demanda nova E nao se apaga na que ja tem.
  -- Sem esta linha, o `update` que limpa a frente faria o pedido sair da
  -- contagem do relatorio sem ninguem ter decidido isso.
  if tg_op = 'UPDATE' and old.frente is not null and new.frente is null then
    raise exception using
      errcode = 'not_null_violation',
      message = 'Este pedido já está classificado, e a classificação não se apaga.',
      hint    = 'Trocar de Social para Campanha (ou o contrário) continua valendo.';
  end if;

  -- 3. CAMPANHA ESCOLHIDA QUER DIZER FRENTE CAMPANHA.
  --
  -- A 0112 recusa a campanha de OUTRA empresa; o que nada impedia e a mesma
  -- linha dizer "social" com o uuid de uma campanha dentro — duas afirmacoes
  -- que se contradizem a uma coluna de distancia, e o relatorio somaria a
  -- primeira enquanto a aba Entregas da campanha mostraria a segunda.
  --
  -- O CONTRARIO NAO E TRAVA: frente `campanha` sem campanha nenhuma e o caso
  -- comum — o cliente pede, e a campanha nasce depois.
  if new.campaign_id is not null and new.frente is distinct from 'campanha' then
    raise exception using
      errcode = 'check_violation',
      message = 'Este pedido está numa campanha, então a frente é Campanha.',
      hint    = 'Para classificar como Social, tire a campanha — deixe em '
                '"Nenhuma, é um pedido solto".';
  end if;

  -- 4. A VERTENTE E DA CONTA DO PEDIDO, E DOS DOIS LADOS.
  --
  -- E `tasks_vertente_da_conta()` (0118) na tabela ao lado, com a mesma licao
  -- dentro: o gatilho dispara tambem quando o CLIENTE muda, senao trocar a
  -- empresa de um pedido classificado deixaria a linha apontando para a
  -- vertente de uma conta que nao e mais a dela — e o filtro de uma conta
  -- nao a acharia enquanto o da outra a traria. E um vazamento entre contas
  -- que nenhuma tela mostraria.
  if new.vertente_id is not null then
    select v.client_id, v.nome into v_dona, v_nome
      from public.client_vertentes v
     where v.id = new.vertente_id;

    if v_dona is null then
      raise exception using
        errcode = 'foreign_key_violation',
        message = 'Essa vertente não existe.',
        hint    = 'Escolha uma da lista da conta, ou deixe em branco.';
    end if;

    if new.client_id is null or new.client_id <> v_dona then
      raise exception using
        errcode = 'check_violation',
        message = format('A vertente "%s" é de outra conta.', v_nome),
        hint    = 'O pedido e a vertente precisam ser da mesma empresa.';
    end if;
  end if;

  return new;
end;
$fn$;

comment on function public.client_requests_classificacao() is
  'A frente e exigida na abertura e nao se esvazia; campanha escolhida obriga '
  'frente Campanha; a vertente e da conta do pedido (0124).';

drop trigger if exists client_requests_classificacao on public.client_requests;
create trigger client_requests_classificacao
  before insert or update of frente, vertente_id, campaign_id, client_id
    on public.client_requests
  for each row execute function public.client_requests_classificacao();

-- CONFERENCIA --------------------------------------------------------------
-- Espera-se UMA linha, com os cinco `true`.
select
  exists (select 1 from pg_type where typname = 'solicitacao_frente')   as enum_frente,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'client_requests'
             and column_name = 'frente')                                as col_frente,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'client_requests'
             and column_name = 'vertente_id')                           as col_vertente,
  exists (select 1 from pg_indexes
           where schemaname = 'public'
             and indexname = 'client_requests_por_vertente')            as indice,
  exists (select 1 from pg_trigger
           where tgname = 'client_requests_classificacao'
             and not tgisinternal)                                      as gatilho;
