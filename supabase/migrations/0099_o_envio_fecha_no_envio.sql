-- ===========================================================================
-- 0099 - A FASE DE ENVIO FECHA NO ENVIO, E NAO NA APROVACAO
--
-- Decisao do usuario, com print: *"Preciso que a etapa do fluxo de social,
-- chamada envio, seja considerado concluido no momento em que todos os posts
-- cheguem ao cliente, e nao seja necessario que se de ok, em post por post."*
--
-- O PRINT ERA A RECUSA DA 0093: *"A fase 'Envio' ainda tem 16 de 16 pecas por
-- marcar."* Num mes com a Pauta, o Conteudo e o Layout concluidos, as dezesseis
-- pecas enviadas, e o Envio parado em "Em andamento" -- sem nenhum caminho
-- para fechar.
--
-- O QUE ESTAVA ERRADO NAO ERA A TRAVA DA 0093, era o que a caixinha da entrega
-- SIGNIFICAVA. A 0088 escolheu fecha-la na APROVACAO daquela peca, e escreveu a
-- razao: *"marcar a mao afirmaria que a peca foi e voltou aprovada sem nada ter
-- saido da agencia"*. A frase esta certa sobre marcar a MAO e e um non sequitur
-- sobre o evento: o que ela protege e que ninguem afirme a decisao do cliente
-- por ele -- e o ENVIO nao e a decisao dele, e um ato da agencia, com hora,
-- autor e rodada gravados. A caixinha continua sendo consequencia e nao clique;
-- o que muda e DE QUE consequencia ela e.
--
-- E A CONSEQUENCIA DISSO ERA UMA FASE SEM SAIDA. A fase do mes e a soma das
-- caixinhas desde a 0093 -- com as dezesseis esperando a resposta do cliente, a
-- fase cujo trabalho (enviar) estava inteiro feito ficava em `em_andamento`
-- para sempre, e so saia dali quando a ultima resposta chegasse. Ela media o
-- trabalho do CLIENTE, numa tela que existe para mostrar o trabalho da agencia.
--
-- ---------------------------------------------------------------------------
-- E NINGUEM PROGRAMA O QUE O CLIENTE NAO APROVOU -- a trava continua inteira,
-- e isto e a unica coisa que esta migration precisava provar antes de existir.
--
-- Quem garante aquilo nunca foi a caixinha da entrega: e a TRAVA B de
-- `post_etapa_progresso_regras` (0088), que conta
-- `aprovacoes_do_cliente_no_post()` contra o numero de portoes anteriores
-- aquela fase -- e a entrega E um portao (`portoes_do_mes`). Entao a caixinha
-- do Programar daquela peca continua recusada com *"O cliente ainda nao aprovou
-- Envio neste post"* enquanto a rodada dela nao estiver `aprovada`, e a recusa
-- e por PECA, que e a metade "a aprovacao continua por post" da 0088.
--
-- A trava A -- a corrente, neste post -- e a que afrouxa, e de proposito: ela
-- passa a dizer "esta peca saiu", que e verdade. Com as duas no lugar, o
-- Programar de uma peca enviada e nao decidida leva a recusa da B, que e a que
-- diz de quem a bola esta. ERA ESSE O ARGUMENTO DA ORDEM ENTRE AS DUAS na
-- 0088, e ele fica de pe pelo outro lado: la a B vinha primeiro porque as duas
-- disparavam e a A dizia *"falta Envio"* sem dizer o que fazer; aqui a A nem
-- dispara.
--
-- ---------------------------------------------------------------------------
-- O QUE ESTA MIGRATION FAZ, e os quatro passos:
--
--   1. a caixinha da entrega fecha quando a rodada de escopo cliente daquela
--      peca NASCE, por gatilho em `approval_rounds`;
--   2. ela para de fechar na aprovacao, em `posts_corrente_do_cliente`;
--   3. a recusa de marcar a mao passa a dizer a verdade nova;
--   4. as pecas que JA estao com o cliente ganham a caixinha fechada -- sem
--      esta passada, o mes do print continua sem saida depois da migration.
--
-- O GATILHO MORA EM `approval_rounds`, e nao dentro de
-- `marcar_conteudo_como_enviado()` (0033) nem de `enviar_mes_ao_cliente()`
-- (0090). E a decisao da 0045 e da 0090 palavra por palavra: *"aquela funcao ja
-- foi reescrita inteira varias vezes, e cada reescrita e uma chance de o trecho
-- ficar para tras"* -- a de 0033 ja foi reescrita duas vezes (0032 -> 0033), e
-- o envio acontece por DOIS caminhos (o lote do mes e o post avulso). De quebra
-- ele pega todo caminho que abre a rodada, o seed e um PATCH montado a mao
-- inclusive.
--
-- QUAL PORTAO A RODADA ABRE E POSICIONAL, e a conta ja existe:
-- `porta_do_cliente_no_post()` devolve o (k+1)-esimo portao, onde k sao as
-- rodadas `aprovada` daquela peca. No `after insert` a rodada nova esta
-- `pendente` -- e pendente nao conta desde a 0023 --, entao ela devolve
-- exatamente o portao que esta rodada veio decidir. Um portao do MEIO (a conta
-- que valida a pauta) nao fecha caixinha nenhuma: aquela caixinha e de quem
-- escreveu a pauta, e marca-la no envio afirmaria que a pessoa terminou um
-- trabalho que a agencia acabou de mandar para fora.
--
-- O QUE NAO MUDA, e cada uma e uma decisao:
--
--   * A CAIXINHA NAO SE MARCA A MAO, e a trava fica. O que muda e a frase: a
--     anterior mandava esperar a aprovacao, e a aprovacao deixou de ser o
--     evento. Trocar o texto obriga a reescrever a funcao inteira, e e por isso
--     que esta migration tem o passo 3: `hint` aparece na TELA (a decisao da
--     0092), e um botao nomeado numa dica que nao faz mais o que ela diz e pior
--     que dica nenhuma.
--   * O PEDIDO DE AJUSTES CONTINUA DESMARCANDO. A peca voltou para a agencia:
--     ela nao esta mais com o cliente, e a fase reabre pelo gatilho da 0093,
--     que e o que tem de acontecer. O reenvio fecha a caixinha de novo, pelo
--     passo 1 -- um caminho so, nos dois sentidos.
--   * `posts.enviado_em` E `posts.status` CONTINUAM SAINDO DA 0033. Esta
--     migration nao escreve nenhum dos dois: ela acrescenta um gatilho ao lado,
--     nao uma segunda escrita do mesmo fato.
--
-- ---------------------------------------------------------------------------
-- O QUE FICA DITO EM VEZ DE ESCONDIDO:
--
--   * `o_que_falta_no_portao()` (0090) TIRA A ENTREGA da exigencia de caixinha
--     marcada, e a exclusao continua obrigatoria: exigi-la seria pedir que a
--     caixinha esteja fechada para o envio acontecer, e ela fecha NO envio --
--     uma recusa que ninguem tem como satisfazer. O comentario dentro daquela
--     funcao da a razao ANTIGA ("e consequencia da aprovacao daquela peca"), e
--     ele nao e reescrito aqui: a funcao tem sessenta linhas e reescreve-la por
--     um comentario e o risco de deriva que a 0052 pagou -- `create or replace`
--     nao avisa quando a versao nova tem menos coisa que a velha. A razao certa
--     mora aqui, que e onde se procura o que vale hoje.
--
--   * A TERCEIRA LINHA DO CARTAO DA CONTA PRECISOU DE CONSERTO, e nao e banco.
--     `oQueEstaAcontecendo()` dizia `${fase.titulo} · N com o cliente`, e a
--     fase da vez era o Envio justamente porque as caixinhas dele estavam
--     abertas. Com elas fechando no envio, a fase da vez passa a ser o
--     Programar -- e o cartao diria *"Programar · 18 com o cliente"*, que e a
--     tela afirmando que alguem agenda uma peca que o cliente nao aprovou. O
--     nome da fase sai daquela frase: o fato e a contagem.
--
--   * A PASSADA DO PASSO 4 CARIMBA `concluido_em` COM O INSTANTE DA MIGRATION,
--     e nao com a hora do envio. Quem escreve aquela coluna e o gatilho da
--     caixinha, fora de todo `if travas` de proposito (0088) -- preservar a
--     data do envio exigiria desligar o gatilho que protege a tabela, e uma
--     data certa nao vale uma trava desligada. `concluido_por` SOBREVIVE,
--     porque o gatilho faz `coalesce`: a passada informa quem enviou.
--
-- MEDIDO COM TRES MUTACOES:
--
--   * tirar o gatilho do passo 1 derruba **12** cenarios, nos arquivos 21, 39
--     e 43 -- entre eles o que diz que a fase fecha com o cliente ainda
--     decidindo, que e a frase do usuario;
--   * fazer o passo 1 fechar a caixinha de um portao do MEIO derruba **1**, e
--     o cenario que o pega e novo: ele acrescenta uma peca a um mes aberto
--     (0061) e manda a pauta dela ao cliente sem ninguem ter marcado nada. Os
--     outros nao pegam porque o produto nao alcanca esse estado pelo botao --
--     `o_que_falta_no_portao` (0090) exige a caixinha marcada num portao de
--     producao --, e e justamente por isso que a trava existe: ela guarda o
--     PATCH montado a mao e o seed;
--
--   * E A DO PASSO 2 NAO DERRUBA NENHUM, e o zero e o argumento e nao a
--     desculpa. Devolver o fechamento na aprovacao e idempotente: naquele
--     instante a caixinha JA esta fechada pelo envio, entao o `update` nao
--     acha linha. E o estado em que as duas versoes diferem -- uma aprovacao
--     chegando com a caixinha aberta -- nao e alcancavel: a mao nao a
--     desmarca (passo 3), o pedido de ajustes que a desmarca encerra a rodada,
--     e a rodada encerrada nao se redecide. Entao a segunda escrita e codigo
--     morto que escreve um fato -- exatamente o que a 0093 apagou em
--     `post_etapa_progresso_reabre` --, e o que a mede e a leitura do diff,
--     nao a bateria. Fica dito em vez de escondido, como o `where` da
--     capacidade na 0081.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A CAIXINHA DA ENTREGA FECHA QUANDO A PECA SAI
--
-- `after insert` e nao `before`: a rodada precisa existir para
-- `porta_do_cliente_no_post()` responder, e a escrita e em outra tabela.
--
-- O GUC E OBRIGATORIO, e nao zelo: a trava do passo 3 recusa marcar a caixinha
-- da entrega sempre que ha sessao -- e quem envia e gestao ou Atendimento, que
-- tem sessao. E a mesma saida de emergencia que `posts_corrente_do_cliente`
-- usa desde a 0045, desligada antes de a funcao devolver: `set local` so cai no
-- fim da transacao, e uma transacao que envia e depois mexe numa caixinha a mao
-- passaria pelas travas calada.
-- ---------------------------------------------------------------------------

create or replace function public.entrega_fecha_no_envio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  porta public.subtasks;
begin
  if new.content_type <> 'post' or new.escopo <> 'cliente' then
    return new;
  end if;

  -- POST AVULSO DEVOLVE NULO, e nao e furo: sem mes nao ha corrente, nem
  -- caixinha, nem fase. Ele volta a se comportar como um post anterior a 0045
  -- -- um envio, uma decisao --, que e o estado que as telas ja desenham.
  porta := public.porta_do_cliente_no_post(new.content_id);

  if porta.id is null or porta.social_papel <> 'entrega' then
    return new;
  end if;

  perform set_config('full_hub.corrente', 'on', true);

  update public.post_etapa_progresso
     set concluido     = true,
         -- QUEM FECHOU FOI QUEM ENVIOU, e nao o gatilho: o `coalesce` do
         -- carimbo (0088) respeita o valor informado, e `solicitado_por` e a
         -- pessoa que clicou em Enviar ao cliente. Sem esta linha a caixinha
         -- ficaria assinada por `auth.uid()`, que aqui e a mesma pessoa -- mas
         -- no envio em lote de uma rotina futura nao seria.
         concluido_por = coalesce(new.solicitado_por, (select auth.uid()))
   where post_id = new.content_id
     and subtask_id = porta.id
     and not concluido;

  perform set_config('full_hub.corrente', 'off', true);

  return new;
end;
$$;

comment on function public.entrega_fecha_no_envio() is
  'A caixinha da fase de entrega daquela peca fecha quando a rodada de escopo cliente dela nasce (0099): enviar e o ato da agencia, e e ele que a fase de Envio mede. A decisao do cliente continua sendo cobrada pela trava B da caixinha, peca por peca.';

drop trigger if exists approval_rounds_fecha_a_entrega on public.approval_rounds;
create trigger approval_rounds_fecha_a_entrega
  after insert on public.approval_rounds
  for each row execute function public.entrega_fecha_no_envio();


-- ---------------------------------------------------------------------------
-- PASSO 2 - E ELA PARA DE FECHAR NA APROVACAO
--
-- O corpo e o da 0088 com UMA edicao, marcada no lugar: o ramo que fechava a
-- caixinha da entrega sai, e o que fica e a devolucao do post para producao
-- quando o portao era do MEIO -- a linha que impede a mentira mais cara da
-- 0076, e que nao tem nada a ver com esta migration.
--
-- A 0088 e a versao MAIS NOVA desta funcao (a 0090 nao a toca), e e dela que
-- esta reescrita parte. E a licao da 0052: `create or replace` se reescreve a
-- partir da versao mais nova, e ele nao avisa quando a nova tem menos coisa
-- que a velha -- foi assim que o bloco de carimbos de `concluida_em` ficou
-- para tras por vinte e duas migrations.
-- ---------------------------------------------------------------------------

create or replace function public.posts_corrente_do_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mes    uuid;
  porta  public.subtasks;
  refaz  public.subtasks;
  motivo text;
begin
  -- REENTRANCIA: esta funcao escreve de volta em `posts` (o portao do meio
  -- devolve o post para producao), e um `after update` que atualiza a propria
  -- linha se dispara de novo. O GUC ja diz "quem escreve aqui e o produto",
  -- entao ele serve tambem de guarda -- e serve melhor que uma coluna
  -- sentinela, porque `set local` morre no fim da transacao.
  if coalesce(current_setting('full_hub.corrente', true), '') = 'on' then
    return new;
  end if;

  -- Post fora de um mes aberto nao tem corrente, e nunca teve: ele e a forma
  -- anterior a 0045 -- um envio, uma decisao -- e todas as telas ja a
  -- desenham.
  if new.social_task_id is null then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  mes := new.social_task_id;

  -- QUAL PORTAO ESTA DECIDINDO, e as DUAS metades sao posicoes diferentes da
  -- mesma lista. Foi a bateria que me obrigou a separa-las, e o sintoma era o
  -- mais caro possivel: `decidir_rodada_do_cliente` grava a rodada como
  -- `aprovada` ANTES de escrever o status do post, entao quando este gatilho
  -- roda a contagem de aprovacoes JA inclui a decisao que o disparou -- e
  -- `porta_do_cliente_no_post()` devolvia o portao SEGUINTE. A consequencia:
  -- o cliente aprovava a PAUTA, o ramo de baixo olhava o Envio, concluia que
  -- o portao era a entrega e NAO devolvia o post para producao. O post ficava
  -- `aprovado` -- verde no calendario dele, fechado na grade do feed, "pode
  -- programar" para a agencia -- com a arte ainda sem existir. E exatamente a
  -- mentira que a 0076 escreveu que estava impedindo.
  --
  --   * APROVOU  -> o portao decidido e o k-esimo, porque ele ja foi contado.
  --   * RECUSOU  -> a rodada recusada nao conta, entao o portao aberto
  --                 continua sendo o que ele acabou de recusar.
  if new.status = 'aprovado' then
    porta := public.portao_do_mes_na_posicao(
      mes, public.aprovacoes_do_cliente_no_post(new.id));
  else
    porta := public.porta_do_cliente_no_post(new.id);
  end if;

  if porta.id is null then
    return new;
  end if;

  perform set_config('full_hub.corrente', 'on', true);

  -- APROVOU
  if new.status = 'aprovado' then
    -- EDICAO DA 0099 - A CAIXINHA DA ENTREGA NAO FECHA MAIS AQUI.
    --
    -- Ela fecha quando a peca SAI, em `entrega_fecha_no_envio`: enviar e o ato
    -- da agencia, e e ele que a fase de Envio mede. Deixar o fechamento TAMBEM
    -- aqui seria idempotente e mentiroso -- duas funcoes escrevendo o mesmo
    -- fato sao duas verdades esperando divergir, e e a razao pela qual a 0093
    -- APAGOU `post_etapa_progresso_reabre` em vez de deixa-la ao lado da conta
    -- nova.
    --
    -- O que a aprovacao acrescenta continua morando na rodada, e quem a cobra
    -- e a trava B da caixinha: nenhuma fase depois da entrega anda NESTA peca
    -- sem a rodada dela aprovada.
    if porta.social_papel <> 'entrega' then
      -- O POST NAO ESTA APROVADO QUANDO O PORTAO ERA DO MEIO (0076): o cliente
      -- aprovou a PAUTA, e `decidir_rodada_do_cliente` acabou de escrever
      -- `status = 'aprovado'` no post -- que e o status que o calendario dele
      -- pinta de verde, que a grade do feed mostra como fechado e que a
      -- agencia le como "pode programar". Nada disso aconteceu: a arte nem
      -- existe. Entao ele volta para producao, que e onde ele esta de verdade.
      update public.posts set status = 'em_producao' where id = new.id;
    end if;
  end if;

  -- PEDIU AJUSTES, OU RECUSOU
  --
  -- Nao nasce etapa nenhuma, e e a simplificacao do 3J: com a etapa sendo do
  -- MES, criar uma "Ajustes" por pedido afirmaria que o mes inteiro voltou por
  -- causa de um post. O que volta e o post, na etapa de quem o fez.
  if new.status in ('ajustes', 'rejeitado') then
    refaz := public.etapa_que_refaz_o_post(porta.id);

    select r.comentario into motivo
      from public.approval_rounds r
     where r.content_type = 'post' and r.content_id = new.id
       and r.escopo = 'cliente'
       and r.status in ('ajustes_solicitados', 'rejeitada')
     order by r.numero_rodada desc, r.created_at desc
     limit 1;

    update public.post_etapa_progresso
       set concluido  = false,
           observacao = nullif(btrim(coalesce(motivo, '')), '')
     where post_id = new.id and subtask_id = refaz.id;

    -- E A CAIXINHA DA ENTREGA DESMARCA JUNTO, quando ela nao e a mesma: a
    -- peca nao foi entregue, foi devolvida. Sem esta linha a entrega ficaria
    -- "18 de 18" com um post em refacao dentro dela.
    if refaz.id is distinct from porta.id then
      update public.post_etapa_progresso
         set concluido = false
       where post_id = new.id and subtask_id = porta.id and concluido;
    end if;

    -- `notificar()` NAO ACEITA DESTINATARIO NULO -- `notifications.user_id` e
    -- `not null` --, e desde a 0062 ela devolve `null` em vez de estourar. O
    -- `if` fica de qualquer forma: sem ele a funcao e chamada uma vez por
    -- pedido para nao fazer nada.
    if refaz.responsavel_id is not null then
      perform public.notificar(
        refaz.responsavel_id, 'aprovacao',
        format('O cliente pediu ajustes em "%s"', new.tema),
        format('A etapa "%s" do mês voltou a ter este post em aberto.', refaz.titulo),
        '/painel/social-media'
      );
    end if;
  end if;

  -- DESLIGA ANTES DE DEVOLVER. `set local` so cai no fim da transacao, e uma
  -- transacao que aprova um post e depois mexe numa caixinha a mao passaria
  -- pelas travas calada -- a saida de emergencia virando porta destrancada.
  perform set_config('full_hub.corrente', 'off', true);

  return new;
end;
$$;

comment on function public.posts_corrente_do_cliente() is
  'Move a corrente do mes conforme o cliente decide cada post (0088, editada pela 0099): o portao do meio aprovado devolve o post para producao, e o pedido de ajustes desmarca a caixinha da etapa de quem fez o trabalho. A caixinha da entrega fecha no ENVIO, e quem a fecha e `entrega_fecha_no_envio`.';



-- ---------------------------------------------------------------------------
-- PASSO 3 - A RECUSA DE MARCAR A MAO PASSA A DIZER A VERDADE NOVA
--
-- O corpo e o da 0090 -- que e a versao mais nova, e nao a da 0088 -- com DUAS
-- edicoes, marcadas no lugar: a mensagem e a dica da trava da entrega, e o
-- argumento da ordem entre a trava B e a A. A trava B, a A, as duas excecoes
-- (sem sessao, e o GUC) e o mes andando junto da 0090 ficam letra por letra.
--
-- UMA MIGRATION PARA TROCAR TEXTO, e a 0092 escreveu por que isso vale a pena:
-- `comment on` ninguem que usa o sistema le, `hint` aparece na tela -- e
-- `atualizarTask` concatena o `hint` do Postgres na mensagem. A dica antiga
-- mandava esperar a aprovacao do cliente, e esperar deixou de fechar a
-- caixinha: quem a lesse ficaria esperando um evento que nao vem mais.
-- ---------------------------------------------------------------------------

create or replace function public.post_etapa_progresso_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  etapa        public.subtasks;
  pendente     text;
  portoes      integer;
  falta        text;
  -- EDICAO DA 0090
  paralelo     boolean;
  menor        integer;
  atrasadas    integer;
  travas boolean := (select auth.uid()) is not null
                    and coalesce(current_setting('full_hub.corrente', true), '') <> 'on';
begin
  select s.* into etapa from public.subtasks s where s.id = new.subtask_id;

  if etapa.id is null or etapa.social_papel is null then
    raise exception using
      errcode = 'check_violation',
      message = 'A caixinha de progresso é de uma etapa de mês de social.',
      hint    = 'Uma subtarefa comum não tem posts dentro dela: o progresso dela é o status.';
  end if;

  -- O POST E A ETAPA NAO TROCAM DE LUGAR. Policy nao limita coluna: sem esta
  -- parte, um PATCH no PostgREST moveria a marcacao de um post para outro --
  -- e o "12 de 18" continuaria dizendo doze.
  if tg_op = 'UPDATE'
     and (new.post_id is distinct from old.post_id
          or new.subtask_id is distinct from old.subtask_id) then
    raise exception using
      errcode = 'check_violation',
      message = 'A caixinha pertence a um post e a uma etapa, e nenhum dos dois muda.',
      hint    = 'Para mover trabalho entre etapas, mexa nas etapas do mês.';
  end if;

  -- `mudou` E O QUE SEPARA A ESCRITA DA CAIXINHA DO NASCIMENTO DELA, e a
  -- distincao nao e zelo: as linhas nascem em bloco, uma por post x etapa,
  -- desmarcadas -- e sem esta variavel a trava da entrega recusaria o proprio
  -- `insert` que cria as caixinhas dela, deixando toda etapa de entrega sem
  -- denominador. O "12 de 18" dela sairia "0 de 0".
  if not ((tg_op = 'INSERT' and new.concluido)
          or (tg_op = 'UPDATE' and new.concluido is distinct from old.concluido)) then
    new.updated_at := now();
    return new;
  end if;

  -- EDICAO DA 0099 - A CAIXINHA DA ENTREGA CONTINUA NAO SE MARCANDO A MAO, E
  -- O QUE MUDA E DE QUE EVENTO ELA E CONSEQUENCIA.
  --
  -- Ela era a regra da 0045 um nivel abaixo -- a etapa Envio era consequencia
  -- da rodada de escopo cliente -- e a 0088 a leu como consequencia da
  -- APROVACAO daquela peca. Desde a 0099 ela e consequencia do ENVIO: a rodada
  -- nascendo fecha a caixinha (`entrega_fecha_no_envio`), porque enviar e o
  -- ato da agencia e e ele que a fase de Envio mede.
  --
  -- A TRAVA FICA INTEIRA, e pela mesma razao de antes: marcar a mao afirmaria
  -- que a peca saiu sem nada ter saido, e DESMARCAR afirmaria o contrario de
  -- uma rodada que esta gravada. O que muda e a dica -- ela mandava esperar a
  -- aprovacao, e a aprovacao deixou de ser o evento. `hint` aparece na TELA
  -- (0092), e um botao nomeado numa dica que nao faz mais o que ela diz e pior
  -- que dica nenhuma: e por isso que uma troca de texto virou migration.
  if travas and etapa.social_papel = 'entrega' then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" fecha com o envio ao cliente, e não se marca à mão.', etapa.titulo),
      hint    = 'Use a ação Enviar ao cliente: a caixinha de cada peça fecha no instante em que ela sai.';
  end if;

  if travas and new.concluido then
    -- A ORDEM DAS DUAS E DELIBERADA, e a bateria me obrigou a escolher: no
    -- Programar as DUAS valiam -- a caixinha da entrega so fechava pela
    -- aprovacao do cliente, entao ela estava desmarcada e a trava da corrente
    -- tambem dispararia. Com a A primeiro, a pessoa lia *"falta Envio"*, que e
    -- verdade e nao diz o que fazer; com a B primeiro ela le *"o cliente ainda
    -- nao aprovou Envio"*, que e a mesma recusa dizendo de quem a bola esta.
    -- E a decisao da 0023: a recusa que nomeia e a diferenca entre um "nao
    -- pode" e uma instrucao.
    --
    -- EDICAO DA 0099 - A ORDEM FICA, E O ARGUMENTO MUDOU DE LADO. Com a
    -- caixinha da entrega fechando no ENVIO, numa peca enviada e nao decidida
    -- a A nem dispara: ela passa a dizer "esta peca saiu", que e verdade. A B
    -- continua sendo a unica a recusar, e continua tendo de vir primeiro pelo
    -- caso que sobrou -- a peca que NAO foi enviada, onde as duas disparam de
    -- novo e a A diz "falta Envio" sem dizer de quem a bola esta.

    -- TRAVA B - o cliente ja decidiu os portoes anteriores DESTE post.
    --
    -- Ela nao e coberta pela A, e e o ponto: a caixinha de um portao do MEIO
    -- marca que a PESSOA escreveu a pauta, nao que o cliente a aprovou. Sem
    -- esta, as doze pautas marcadas liberariam o conteudo das doze sem nenhuma
    -- ter sido validada -- que e o fluxo que a conta contratou para nao
    -- acontecer.
    --
    -- E ela cobre "ninguem programa o que o cliente nao aprovou" sem uma
    -- segunda regra: antes do Programar ha dois portoes num fluxo que valida a
    -- pauta (a Pauta e o Envio), entao ele precisa de duas aprovacoes.
    select count(*)::integer into portoes
      from public.portoes_do_mes(etapa.task_id) p
     where p.ordem < etapa.ordem;

    -- EDICAO DA 0090 - O MES ANDA JUNTO, E E O PADRAO
    --
    -- A frase do sprint: *"o portao so e vencido quando todos os posts forem
    -- aprovados nele. Enquanto 3 estiverem em ajustes na Pauta, o Layout nao
    -- comeca para nenhum"*. E o que o usuario descreveu com outras palavras:
    -- a peca e individual, mas faz parte de um conjunto.
    --
    -- Ela e uma trava A MAIS e nao uma troca: a de baixo continua perguntando
    -- por ESTA peca, e com o mes andando junto o minimo ja a cobre -- se toda
    -- peca passou dos portoes anteriores, esta passou. Com paralelismo ligado
    -- o minimo nao e perguntado e sobra a de baixo, que e o comportamento da
    -- 0088 inteiro.
    --
    -- `tasks.social_paralelo` e o SNAPSHOT (0090) e nao
    -- `social_flows.avanca_em_paralelo`: ler a configuracao da conta aqui
    -- faria a trava de um mes em producao mudar porque alguem marcou uma caixa
    -- na aba Fluxos.
    select coalesce(t.social_paralelo, false) into paralelo
      from public.tasks t where t.id = etapa.task_id;

    -- E ELA VALE SO EM ETAPA DE PRODUCAO, e foi o seed que me obrigou a
    -- escrever isso: a primeira versao perguntava em toda etapa, e o
    -- `Programar` -- que e `pos_entrega` -- passou a ser recusado enquanto
    -- QUALQUER peca do mes nao tivesse sido aprovada. Na pratica isso impede a
    -- social media de agendar as quinze pecas aprovadas por causa de tres em
    -- ajustes, que e o oposto do que o mes andando junto existe para proteger.
    --
    -- A frase do sprint e sobre PRODUCAO -- *"enquanto 3 estiverem em ajustes
    -- na Pauta, o Layout nao comeca para nenhum"* --, e `pos_entrega` vem
    -- DEPOIS da decisao de cada peca por definicao (0087): ali a trava de
    -- baixo, que e por peca, e a pergunta certa e a unica.
    if not coalesce(paralelo, false)
       and portoes > 0
       and etapa.social_papel = 'producao' then
      select min(public.aprovacoes_do_cliente_no_post(p.id)) into menor
        from public.posts_do_mes(etapa.task_id) p;

      if coalesce(menor, 0) < portoes then
        -- A FRASE DIZ QUANTAS FALTAM, e nao "o mes nao pode andar": quem le
        -- precisa saber se falta uma peca ou dezessete para decidir se espera
        -- ou se cobra o cliente. E a decisao da 0023 outra vez.
        select count(*)::integer into atrasadas
          from public.posts_do_mes(etapa.task_id) p
         where public.aprovacoes_do_cliente_no_post(p.id) < portoes;

        -- O `offset` MORA NUMA SUBCONSULTA, e nao no nivel do `string_agg`:
        -- um `order by` de instrucao sobre uma consulta agregada e recusado
        -- com *"column p.ordem must appear in the GROUP BY clause"*. E a forma
        -- que a trava B logo abaixo ja usava desde a 0088 -- foi o seed que me
        -- mostrou, aplicando a migration do zero.
        select string_agg(p.titulo, ', ' order by p.ordem) into falta
          from (select p.titulo, p.ordem
                  from public.portoes_do_mes(etapa.task_id) p
                 where p.ordem < etapa.ordem
                 order by p.ordem
                offset coalesce(menor, 0)) p;

        raise exception using
          errcode = 'check_violation',
          message = format('O mês anda junto, e %s %s ainda não %s por %s.',
                           atrasadas,
                           case when atrasadas = 1 then 'peça' else 'peças' end,
                           case when atrasadas = 1 then 'passou' else 'passaram' end,
                           falta),
          hint    = 'Esta conta espera o mês fechar cada portão antes de seguir. Para as peças aprovadas andarem sem esperar as demais, ligue "as peças aprovadas avançam" no fluxo da conta.';
      end if;
    end if;

    if public.aprovacoes_do_cliente_no_post(new.post_id) < portoes then
      -- A FRASE NOMEIA SO O QUE FALTA, e nao os portoes todos.
      --
      -- As aprovacoes desta peca fecham os portoes NA ORDEM -- e a conta que
      -- `porta_do_cliente_no_post()` faz --, entao os aprovados sao os `k`
      -- primeiros e o `offset` tira exatamente eles. Sem ele, num fluxo que
      -- valida a pauta a recusa do Programar dizia *"o cliente ainda nao
      -- aprovou Pauta, Envio"* numa peca cuja Pauta esta aprovada: uma frase
      -- que a pessoa confere, ve que esta errada, e passa a desconfiar do
      -- resto. E a decisao da 0023, que nomeia CADA etapa sem aprovacao --
      -- dizer quais e a diferenca entre uma recusa e uma instrucao, e dizer
      -- quais errado e pior que nao dizer.
      select string_agg(p.titulo, ', ' order by p.ordem) into falta
        from (select p.titulo, p.ordem
                from public.portoes_do_mes(etapa.task_id) p
               where p.ordem < etapa.ordem
               order by p.ordem
              offset public.aprovacoes_do_cliente_no_post(new.post_id)) p;

      raise exception using
        errcode = 'check_violation',
        message = format('O cliente ainda não aprovou %s neste post.', falta),
        hint    = 'Cada peça passa pelos portões dela: a etapa é do mês, a decisão é de cada post.';
    end if;

    -- TRAVA A - a corrente, neste post.
    select string_agg(s.titulo, ', ' order by s.ordem) into pendente
      from public.subtasks s
      left join public.post_etapa_progresso g
             on g.subtask_id = s.id and g.post_id = new.post_id
     where s.task_id = etapa.task_id
       and s.social_papel is not null
       and s.ordem < etapa.ordem
       and coalesce(g.concluido, false) = false;

    if pendente is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('Neste post falta %s antes desta etapa.', pendente),
        hint    = 'A corrente do mês é em ordem, post por post: cada etapa espera a anterior daquele post.';
    end if;
  end if;

  -- O CARIMBO NAO E TRAVA, e por isso fica fora dos `if travas`: ele vale para
  -- toda escrita, a do seed e a do cliente inclusive. Caixinha marcada sem
  -- data e sem autor e uma linha que nao serve para relatorio nenhum.
  if new.concluido and (tg_op = 'INSERT' or not old.concluido) then
    new.concluido_em  := now();
    new.concluido_por := coalesce(new.concluido_por, (select auth.uid()));
  elsif not new.concluido then
    new.concluido_em  := null;
    new.concluido_por := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists post_etapa_progresso_regras on public.post_etapa_progresso;
create trigger post_etapa_progresso_regras
  before insert or update on public.post_etapa_progresso
  for each row execute function public.post_etapa_progresso_regras();

comment on function public.post_etapa_progresso_regras() is
  'As travas da caixinha: a corrente post por post, os portoes que o cliente ja decidiu daquele post, a caixinha da entrega que nao se marca a mao -- e que desde a 0099 fecha no ENVIO --, e o mes andando junto da 0090, que e o padrao.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - AS PECAS QUE JA ESTAO COM O CLIENTE
--
-- SEM ESTA PASSADA A MIGRATION NAO CONSERTA O PRINT. O mes do usuario tem as
-- dezesseis pecas enviadas e esperando resposta: o gatilho do passo 1 fecha a
-- caixinha de quem for enviado DAQUI PARA A FRENTE, e aquelas dezesseis ja
-- sairam. Elas ficariam abertas para sempre -- a fase continuaria em "Em
-- andamento" com a recusa da 0093 no clique, que e exatamente o estado que
-- motivou o pedido.
--
-- O RECORTE E "O PORTAO ABERTO DESTA PECA E A ENTREGA, E HA UMA RODADA
-- PENDENTE NELA", e nao `posts.enviado_em is not null`. A coluna nao serve, e
-- a razao e uma pegadinha antiga: `marcar_conteudo_como_enviado` (0033)
-- carimba `enviado_em` em QUALQUER rodada de escopo cliente, a de um portao do
-- meio inclusive -- entao numa conta que valida a pauta ela esta preenchida em
-- peca cuja arte nem existe. Fechar a caixinha da entrega por ela afirmaria
-- que o mes foi entregue porque a pauta foi mandada.
--
--   * portao aberto = a entrega -> a decisao que falta e a da entrega;
--   * rodada `pendente` -> ela esta com o CLIENTE agora.
--
-- A peca que voltou com ajustes nao tem rodada pendente, e a caixinha dela fica
-- aberta -- que e a verdade: ela esta na agencia. A peca que ja aprovou a
-- entrega tem a caixinha fechada desde antes, pelo caminho que o passo 2
-- acabou de tirar.
--
-- AS TRAVAS NAO MORDEM AQUI, e nao por excecao: `travas` exige
-- `auth.uid() is not null`, e numa migration nao ha sessao. E a primeira das
-- duas excecoes da 0045, a mesma por onde o seed passa -- o GUC fica de fora
-- de proposito, porque ligar uma saida de emergencia que nao e necessaria e o
-- comeco de uma porta destrancada.
--
-- `concluido_em` SAI COM O INSTANTE DA MIGRATION, e nao com a hora do envio:
-- quem escreve aquela coluna e o gatilho da caixinha, fora de todo `if travas`
-- de proposito (0088). Preservar a data exigiria desligar o gatilho que
-- protege a tabela, e uma data certa nao vale uma trava desligada.
-- `concluido_por` sobrevive, porque o carimbo faz `coalesce`.
-- ---------------------------------------------------------------------------
do $$
declare
  mexidas integer := 0;
begin
  with alvo as (
    select g.post_id,
           g.subtask_id,
           (select r.solicitado_por
              from public.approval_rounds r
             where r.content_type = 'post'
               and r.content_id = g.post_id
               and r.escopo = 'cliente'
               and r.status = 'pendente'
             order by r.created_at desc
             limit 1) as quem
      from public.post_etapa_progresso g
      join public.subtasks s on s.id = g.subtask_id
     where not g.concluido
       and s.social_papel = 'entrega'
       -- O PORTAO ABERTO DESTA PECA E ESTA ETAPA. A conta e posicional e mora
       -- num lugar so desde a 0088: `porta_do_cliente_no_post()` devolve o
       -- (k+1)-esimo portao, e aqui ela responde "a decisao que falta nesta
       -- peca e a da entrega".
       and (public.porta_do_cliente_no_post(g.post_id)).id = s.id
       and exists (
         select 1 from public.approval_rounds r
          where r.content_type = 'post'
            and r.content_id = g.post_id
            and r.escopo = 'cliente'
            and r.status = 'pendente'
       )
  )
  update public.post_etapa_progresso g
     set concluido     = true,
         concluido_por = a.quem
    from alvo a
   where g.post_id = a.post_id
     and g.subtask_id = a.subtask_id;

  get diagnostics mexidas = row_count;

  raise notice '0099: % caixinha(s) de entrega fechada(s) -- pecas que ja estavam com o cliente.', mexidas;
end;
$$;


-- ---------------------------------------------------------------------------
-- CONFERENCIA, para colar depois de aplicar
--
-- A primeira diz que o gatilho existe; a segunda e a que importa, e ela
-- responde a pergunta do print: cada fase de entrega de cada mes aberto, com
-- quantas pecas ela tem marcadas de quantas, e o status dela. Uma linha dizendo
-- "16 de 16" com status `em_andamento` e a 0093 esperando a proxima escrita --
-- a passada do passo 4 dispara `fase_acompanha_as_caixinhas`, entao ela ja deve
-- sair `concluida`.
--
--   select tgname from pg_trigger
--    where tgname = 'approval_rounds_fecha_a_entrega';
--
--   select t.titulo as mes, s.titulo as fase, s.status,
--          count(g.*) filter (where g.concluido) as marcadas,
--          count(g.*)                            as pecas
--     from public.subtasks s
--     join public.tasks t on t.id = s.task_id
--     left join public.post_etapa_progresso g on g.subtask_id = s.id
--    where s.social_papel = 'entrega'
--    group by t.titulo, s.titulo, s.status
--    order by t.titulo;
-- ---------------------------------------------------------------------------
