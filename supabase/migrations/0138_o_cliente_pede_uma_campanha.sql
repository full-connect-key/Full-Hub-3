-- ===========================================================================
-- 0138 — O CLIENTE PEDE UMA CAMPANHA, COM PERÍODO E COMPOSIÇÃO
--
-- Decisão do usuário: *"pode deixar o cliente com a mesma visualização de
-- abrir campanha que o atendimento, para que ele envie para gente para
-- editarmos e abrirmos a task"*.
--
-- ---------------------------------------------------------------------------
-- O QUE NASCE É UM PEDIDO, E NUNCA UMA CAMPANHA, e a frase dele diz isso em
-- quantas palavras: *"para que ele envie para gente para editarmos e abrirmos
-- a task"*. Quem abre campanha é `is_atendimento()` desde a 0054, e o
-- argumento de lá fica inteiro — abrir trabalho é decisão da agência. O que o
-- cliente ganha é a FORMA do pedido: a tela dele passa a ter o período e a
-- composição, que são as duas coisas que a abertura de campanha pergunta e que
-- `client_requests` não tinha onde guardar.
--
-- METADE JÁ EXISTIA, e ir medir antes de escrever é o que fez a migration ser
-- três colunas:
--
--   | o que a abertura de campanha pede | onde já estava                     |
--   | --------------------------------- | ---------------------------------- |
--   | de quem é                         | `client_requests.client_id` (0068) |
--   | a frente da conta                 | `vertente_id` (0124)               |
--   | como se chama                     | `titulo` (0068)                    |
--   | o briefing                        | `descricao` + `respostas` (0068)   |
--   | **quando acontece**               | **não existia**                    |
--   | **quantos de cada tipo**          | **não existia**                    |
--
-- E TRÊS DAS CINCO SEÇÕES DA ABERTURA NÃO SÃO DO CLIENTE, e a ausência é a
-- decisão:
--
--   * o ESTADO (planejamento / ativa) é o da agência sobre o próprio trabalho;
--   * a PASTA DE ENTREGA é a pasta do Drive da agência — a 0015 a exige na
--     demanda, e o cliente não tem o Drive nem como saber o endereço;
--   * QUEM FAZ CADA PEÇA é a distribuição de trabalho, que é literalmente o
--     que ele manda a agência fazer. A árvore de entregáveis também não vem
--     dele: ela é DERIVADA da composição por `arvoreDaComposicao()`, então
--     pedir as duas seria pedir a mesma coisa duas vezes.
-- ---------------------------------------------------------------------------
--
-- A COMPOSIÇÃO É `jsonb` AQUI E TABELA NORMALIZADA LÁ, e a assimetria é o
-- critério de `post_versions.arquivos` aplicado duas vezes com respostas
-- diferentes:
--
--   * `campaign_composicao` (0122) é CONSULTADA item a item — é dela que sai o
--     `full outer join` de `composicao_da_campanha()`, que compara o plano com
--     as peças que existem. Normalizar ali se paga.
--   * `client_requests.composicao` é escrita de uma vez pelo cliente e lida
--     INTEIRA pelo Atendimento, para preencher o formulário. Ninguém agrega
--     por tipo de material entre pedidos — o relatório conta pedido por
--     FRENTE, não por material. Uma tabela aqui seria duas policies, um
--     espelho de apagamento e um `join` em cada leitura para servir um
--     `select * where request_id = ?`.
--
-- A FORMA DO `jsonb` É A DE `LinhaDaComposicao`, que é o que o formulário da
-- abertura já tem em mãos: `[{"tipo","quantidade","formato","dimensoes"}]`.
-- Uma forma própria aqui obrigaria um de-para entre a tela do cliente e a da
-- agência — e o de-para é onde a quantidade de um tipo se perde.
--
-- E O `check` DE ARRAY É A LIÇÃO DA 0068 com `campos_json`: um objeto gravado
-- ali não quebra nada na hora. Quebra na tela, que faz `.map()` no que veio e
-- desenha um formulário sem linha nenhuma — sem erro e sem log.
--
-- ---------------------------------------------------------------------------
-- A SEGUNDA METADE É O TRIGGER DO ESPELHO, e sem ela o pedido fica parado
-- para sempre.
--
-- `tasks_espelha_no_pedido` (0068) move o pedido para `em_andamento` na
-- transição `publicada_em: null -> não nulo`. A demanda de uma campanha nasce
-- PUBLICADA (0051), e o vínculo com o pedido é escrito DEPOIS de
-- `abrir_campanha()` devolver — porque a assinatura daquela função não muda
-- (0061, 0120, 0122, 0125). Quer dizer que a transição nunca acontece, e o
-- cliente continuaria lendo "Em análise" sobre uma campanha que já está
-- correndo.
--
-- Então o gatilho aprende o SEGUNDO jeito de uma demanda publicada passar a
-- ser de um pedido: `request_id` saindo de nulo. Ele continua sendo o único
-- lugar que move o pedido — a alternativa era a action escrever o status ela
-- mesma, e aí seriam duas verdades sobre quando um pedido virou trabalho.
-- ---------------------------------------------------------------------------
--
-- PASSOS:
--   1. as três colunas, com os dois `check`
--   2. `client_requests_classificacao()` INTEIRA, com o ramo 5
--   3. `tasks_espelha_no_pedido()` INTEIRA, com o ramo do `request_id`
--   4. o marcador e a conferencia
-- ===========================================================================


-- PASSO 1 — o período e a composição do pedido -------------------------------
alter table public.client_requests
  add column if not exists campanha_inicio date,
  add column if not exists campanha_fim    date,
  add column if not exists composicao      jsonb;

comment on column public.client_requests.campanha_inicio is
  'Quando o cliente quer que a campanha COMECE (0138). Opcional, e so a tela '
  'da frente Campanha a pergunta. Ela nao e `data_desejada`: aquela e a data '
  'em que ele gostaria de RECEBER um pedido solto, e uma campanha tem periodo '
  '-- duas respostas para a mesma pergunta na mesma coluna seriam duas '
  'verdades, e a que divergiria e a do pedido de campanha, que o briefing le.';

comment on column public.client_requests.campanha_fim is
  'Quando o cliente quer que a campanha ENCERRE (0138). Opcional. O `check` '
  'cobra a ordem quando as duas existem -- periodo invertido e quase sempre um '
  'numero trocado, e a recusa chega na tela de quem digitou.';

comment on column public.client_requests.composicao is
  'Quantos materiais de cada tipo o cliente pediu (0138), na forma de '
  '`LinhaDaComposicao`: [{"tipo","quantidade","formato","dimensoes"}]. E '
  '`jsonb` e nao tabela porque ela e escrita de uma vez e lida INTEIRA, para '
  'preencher a abertura de campanha -- ninguem agrega por tipo entre pedidos. '
  'Quem e consultada item a item e `campaign_composicao` (0122), que continua '
  'normalizada.';

-- OS DOIS `check` SAO IMMUTABLE, então eles podem ser `check` de verdade e não
-- precisam do trigger (a decisão da 0084): o período é uma comparação entre
-- duas colunas da linha, e `jsonb_typeof` é uma função pura.
--
-- E OS DOIS SE APLICAM SEM PASSADA DE CONVERSAO: as três colunas acabaram de
-- nascer, então toda linha anterior tem as três nulas e os dois `check`
-- passam por construção. Fosse diferente, a saída seria o trigger sozinho.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'client_requests_periodo_da_campanha'
  ) then
    alter table public.client_requests
      add constraint client_requests_periodo_da_campanha
      check (
        campanha_inicio is null
        or campanha_fim is null
        or campanha_fim >= campanha_inicio
      );
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'client_requests_composicao_e_lista'
  ) then
    alter table public.client_requests
      add constraint client_requests_composicao_e_lista
      check (composicao is null or jsonb_typeof(composicao) = 'array');
  end if;
end $$;


-- PASSO 2 — a composição e o período querem dizer frente Campanha ------------
--
-- A FUNÇÃO É COPIADA INTEIRA, que é a lição da 0030: `create or replace` se
-- reescreve a partir do texto de agora e NÃO AVISA quando o texto novo tem
-- menos coisa que o velho — foi assim que a 0030 perdeu o bloco de carimbos de
-- `validar_transicao_de_subtarefa` e só apareceu na 0052. Os quatro ramos
-- anteriores estão aqui palavra por palavra, o lugar nomeado do que a 0137
-- tirou incluído.
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
  -- 1. A FRENTE NAO E MAIS EXIGIDA NA ABERTURA (0137).
  --
  -- O ramo que ficava aqui recusava o `insert` sem frente, com a frase *"Diga
  -- se este pedido e de Social ou de Campanha."*. Ele saiu por decisao do
  -- usuario, e o lugar dele fica nomeado de proposito: quem vier depois
  -- precisa saber que a ausencia e uma escolha, e nao um ramo que alguem
  -- esqueceu de escrever.

  -- 2. E ELA NAO SE ESVAZIA DEPOIS, que e a outra metade da 0015: lá a pasta
  -- de entrega e obrigatoria na demanda nova E nao se apaga na que ja tem.
  -- Sem esta linha, o `update` que limpa a frente faria o pedido sair da
  -- contagem do relatorio sem ninguem ter decidido isso.
  --
  -- ELA FICA DEPOIS DA 0137, e a assimetria e a decisao: abrir sem
  -- classificar e uma coisa, apagar a classificacao de um pedido que ja tem e
  -- outra -- e e a segunda que o relatorio nao tem como perceber.
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
  --
  -- E `is distinct from` ALCANCA O NULO, que depois da 0137 e um estado que a
  -- tela oferece: um pedido com o uuid de uma campanha e a frente em branco
  -- continua recusado, porque estar numa campanha E ser da frente Campanha.
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

  -- 5. A COMPOSIÇÃO E O PERÍODO SÃO DE UMA CAMPANHA (0138).
  --
  -- É O RAMO 3 COM OUTRO FATO DENTRO: lá o uuid de uma campanha implica a
  -- frente Campanha; aqui implicam a mesma coisa o período e a lista de
  -- materiais, que é o que a abertura de campanha pergunta e que a tela do
  -- cliente só desenha na frente Campanha.
  --
  -- SEM ELA O RELATÓRIO MENTE SEM NINGUÉM PERCEBER: um pedido com dez
  -- estáticos dentro e a frente em "Social" manda o Atendimento abrir um mês
  -- de social com uma composição de campanha pendurada, e o bloco "O que os
  -- clientes pediram" soma aquele pedido na frente errada.
  --
  -- A LISTA VAZIA NÃO CONTA, e é o que mantém a trava estreita: `[]` quer
  -- dizer "a pessoa abriu a seção e não escreveu nada", que é o estado normal
  -- de quem desistiu — e recusá-lo seria recusar um pedido por causa de uma
  -- seção que ela nem preencheu.
  if (
       new.campanha_inicio is not null
    or new.campanha_fim is not null
    or (new.composicao is not null and jsonb_array_length(new.composicao) > 0)
     )
     and new.frente is distinct from 'campanha'
  then
    raise exception using
      errcode = 'check_violation',
      message = 'O período e a lista de materiais são de uma campanha.',
      hint    = 'Classifique o pedido como Campanha, ou limpe o período e a '
                'lista de materiais.';
  end if;

  return new;
end;
$fn$;

comment on function public.client_requests_classificacao() is
  'A frente nao se esvazia depois de escolhida; campanha escolhida obriga '
  'frente Campanha; a vertente e da conta do pedido; e o periodo e a '
  'composicao obrigam frente Campanha (0124, sem a exigencia da abertura '
  'desde a 0137, com o ramo da composicao desde a 0138).';

-- O GATILHO GANHOU TRÊS COLUNAS no `update of`, e sem elas o ramo 5 só
-- valeria no `insert`: um `update` que acrescentasse a composição a um pedido
-- de social passaria calado, que é exatamente o estado que o ramo existe para
-- não deixar nascer.
drop trigger if exists client_requests_classificacao on public.client_requests;
create trigger client_requests_classificacao
  before insert or update of
      frente, vertente_id, campaign_id, client_id,
      composicao, campanha_inicio, campanha_fim
    on public.client_requests
  for each row execute function public.client_requests_classificacao();


-- PASSO 3 — a demanda publicada que PASSA A SER de um pedido -----------------
--
-- A FUNÇÃO É COPIADA INTEIRA, pela razão do PASSO 2. Os dois ramos da 0068
-- estão aqui palavra por palavra, e o terceiro entra entre eles.
create or replace function public.tasks_espelha_no_pedido()
returns trigger language plpgsql security definer set search_path = public
as $func$
declare
  v_novo    public.solicitacao_status;
  v_titulo  text;
  v_cliente uuid;
  v_pessoa  uuid;
begin
  if new.request_id is null then
    return null;
  end if;

  if old.publicada_em is null and new.publicada_em is not null then
    v_novo := 'em_andamento';

  -- O PEDIDO QUE VIRA CAMPANHA PASSA POR AQUI, e não pelo ramo de cima (0138).
  --
  -- A demanda de uma campanha nasce PUBLICADA (0051), e o vínculo com o
  -- pedido é escrito numa segunda escrita, depois de `abrir_campanha()`
  -- devolver — porque a assinatura daquela função não muda (0061, 0120, 0122,
  -- 0125). Então a transição `publicada_em: null -> não nulo` nunca acontece
  -- nesse caminho, e sem este ramo o cliente leria "Em análise" sobre uma
  -- campanha que já está correndo.
  --
  -- A PERGUNTA É `publicada_em is not null` E NÃO A AUSÊNCIA DE PERGUNTA: um
  -- RASCUNHO que ganha `request_id` é o caminho de `converterEmDemanda`, onde
  -- o pedido tem de esperar a publicação — andar ali diria ao cliente
  -- "estamos fazendo" sobre uma demanda que ninguém da equipe enxerga ainda,
  -- que é a decisão escrita da 0068.
  elsif old.request_id is null
        and new.request_id is not null
        and new.publicada_em is not null then
    v_novo := 'em_andamento';

  elsif old.status is distinct from new.status and new.status = 'entregue' then
    v_novo := 'concluida';
  else
    return null;
  end if;

  -- PERGUNTAR ANTES, em vez de embrulhar num `exception when others` que
  -- engole tambem o erro que ninguem previu. E a forma da 0052.
  update public.client_requests
     set status = v_novo
   where id = new.request_id
     and status not in ('recusada', 'concluida')
  returning titulo, client_id into v_titulo, v_cliente;

  if v_titulo is null then
    return null;
  end if;

  for v_pessoa in
    select cu.user_id from public.client_users cu where cu.client_id = v_cliente
  loop
    perform public.notificar(
      v_pessoa, 'solicitacao',
      case when v_novo = 'em_andamento'
        then 'Seu pedido virou trabalho'
        else 'Seu pedido foi concluido' end,
      v_titulo,
      '/portal/solicitacoes/' || new.request_id::text
    );
  end loop;

  return null;
end;
$func$;

comment on function public.tasks_espelha_no_pedido() is
  'Move o pedido do cliente quando a demanda dele e publicada, quando uma '
  'demanda JA publicada passa a ser de um pedido (0138, o caminho da '
  'campanha), e quando ela e entregue. Nunca derruba a escrita da task.';

-- O GATILHO E RECRIADO com a mesma assinatura: `after update` sem lista de
-- colunas, porque o ramo novo observa `request_id` e os outros dois observam
-- `publicada_em` e `status`.
drop trigger if exists tasks_espelha_no_pedido on public.tasks;
create trigger tasks_espelha_no_pedido after update on public.tasks
  for each row execute function public.tasks_espelha_no_pedido();


-- O MARCADOR do `onde-esta-o-banco.sql` É O RAMO ACIMA, dentro do corpo de
-- `tasks_espelha_no_pedido` — a última coisa que este arquivo cria.
--
-- Um marcador na coluna `composicao` diria `ok` sobre um banco onde as três
-- colunas estão de pé e os dois gatilhos não foram recolados, que é o pior
-- lugar para a colagem morrer: ali o cliente consegue pedir a campanha e o
-- pedido dele fica parado em "Em análise" para sempre.
--
-- E ele é por PRESENÇA e não por ausência, que é a lição da linha da 0060:
-- marcador por ausência envelhece quando alguém ACRESCENTA, e acrescentar é o
-- que as migrations fazem.


-- CONFERENCIA ----------------------------------------------------------------
-- Espera-se UMA linha, com os cinco `true`.
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'client_requests'
             and column_name = 'composicao')                        as tem_composicao,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'client_requests'
             and column_name = 'campanha_inicio')                   as tem_periodo,
  exists (select 1 from pg_constraint
           where conname = 'client_requests_composicao_e_lista')     as composicao_e_lista,
  exists (select 1 from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'client_requests_classificacao'
            and p.prosrc like '%lista de materiais são de uma campanha%') as ramo_5_de_pe,
  exists (select 1 from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'tasks_espelha_no_pedido'
            and p.prosrc like '%old.request_id is null%')            as espelho_do_vinculo;

notify pgrst, 'reload schema';
