-- ---------------------------------------------------------------------------
-- 0076 - O CLIENTE APROVA A CORRENTE DO SOCIAL ETAPA POR ETAPA
--
-- Decisao do usuario: "preciso poder escolher, se as etapas vao ser aprovadas
-- pelo cliente, uma por uma. Algumas contas aprovam pauta, antes de entrar em
-- producao."
--
-- Ate aqui a corrente do post (0045) tinha UM portao para o cliente, e ele era
-- o penultimo: Pauta -> Conteudo -> Layout -> ENVIO -> Programar. A conta que
-- aprova a pauta antes de o redator escrever nao tinha onde dizer isso, e o
-- que a agencia fazia era mandar a pauta por fora -- WhatsApp, e-mail --, o
-- que e exatamente o que este produto existe para acabar.
--
-- ---------------------------------------------------------------------------
-- A ESCOLHA E DA CONTA, E NAO DO MES NEM DO POST
--
-- "Algumas contas aprovam pauta" e a frase inteira: nao e uma decisao que se
-- toma por post, nem ao abrir cada mes. E combinado do contrato, e o lugar
-- dele e a aba "Configuracoes do fluxo" da ficha do cliente, que existe desde
-- a 0064 justamente para isto.
--
-- Entao NAO ha parametro novo em `abrir_mes_de_social()`, e o dialogo de abrir
-- o mes nao muda. As etapas nascem marcadas porque `montar_etapas_do_post` le
-- a lista da conta -- e ele roda por trigger `after insert` em `posts` desde a
-- 0045, o que faz o post nascido pelo seed, pelo dialogo ou por um `insert` a
-- mao carregar os portoes do mesmo jeito.
--
-- A gestao ainda troca o portao de UM post pela tela, porque `post_etapas`
-- e editavel por `is_gestor()`. O que nao existe e a lista sendo redigitada
-- todo mes.
--
-- ---------------------------------------------------------------------------
-- E A PAUTA PASSA A CHEGAR AO CLIENTE -- nas contas que a aprovam, e so nelas
--
-- Isto inverte uma frase escrita do produto, e a inversao e o pedido: ate aqui
-- "a legenda vai ao cliente e ao ar, a pauta e conversa interna" (0046), e a
-- tela diz isso embaixo do campo. Numa conta que aprova a pauta, ela deixa de
-- ser conversa interna -- e a tela precisa dizer ISSO, em vez de continuar
-- prometendo um sigilo que a conta abriu mao.
--
-- Fica escrito aqui porque quem ler a 0046 daqui a tres sprints vai encontrar
-- a frase antiga, e ela continua certa para as contas que nao marcaram nada.
--
-- ---------------------------------------------------------------------------
-- O QUE NAO MUDA, E E O QUE TORNA ISTO BARATO
--
--   * NAO ha `content_type` novo. A rodada continua sendo do POST, e qual
--     etapa ela decide e DERIVADO -- `porta_do_cliente_no_post()`. A corrente
--     e serial por construcao, entao ha no maximo um portao aberto por vez, e
--     uma coluna `etapa_id` em `approval_rounds` seria uma segunda verdade
--     sobre um fato que a ordem ja responde. E a mesma decisao de a mao do
--     post ser derivada (0042), do bloqueio da subtarefa nao ser status (0007)
--     e do atraso do Financeiro nao ser coluna (0013).
--
--   * NAO ha rota nova no portal, nem lista nova de pendencias. O cliente
--     decide na tela do post, que e onde ele ja decide -- o que muda e o que
--     ela mostra quando o portao e do meio.
--
--   * NAO ha policy nova. `posts_select_cliente` ja abre o post quando
--     `enviado_em` esta preenchido, e `enviado_em` e consequencia da rodada de
--     escopo cliente desde a 0032 -- entao o primeiro portao ja torna o post
--     legivel para ele, que e exatamente o que precisa acontecer para ele ler
--     a pauta.
--
-- ---------------------------------------------------------------------------
-- O QUE ISTO CUSTA, e e consequencia aceita
--
--   * `posts.enviado_em` passa a querer dizer "algo deste post ja foi ao
--     cliente", e nao mais "a arte foi". O nome ficou: renomear coluna em uso
--     e migration arriscada sem nada em troca, e a diferenca nao aparece em
--     tela nenhuma -- o que a tela mostra e a corrente.
--
--   * O post entra no calendario e na grade do feed do cliente a partir do
--     primeiro portao, sem arte. A grade ja desenha esse estado desde o
--     Sprint 12 (sem arte, o tema entra no lugar), justamente porque um
--     buraco numa grade parece imagem que nao carregou.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A etapa diz se passa pelo cliente
--
-- `default false` e o lado seguro do erro: esquecer a coluna deixa a corrente
-- como ela e hoje, com um portao so. O contrario -- todo post nascendo com
-- cinco portoes -- poria o cliente decidindo cinco vezes sobre uma peca, e
-- ninguem descobre isso pelo build.
-- ---------------------------------------------------------------------------

alter table public.post_etapas
  add column if not exists aprovacao_cliente boolean not null default false;

comment on column public.post_etapas.aprovacao_cliente is
  'Esta etapa passa pelo cliente antes de a proxima comecar. Nasce da lista da conta (client_flow_defaults.social_aprovacoes) e a gestao troca por post. O Envio nao precisa dela: ele E o portao do cliente desde a 0045.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A lista da conta
--
-- E `text[]` E NAO `jsonb`, ao contrario de `p_prazos` (0059), que tambem e
-- por nome de etapa. A diferenca e o que cada um guarda: prazo e um NUMERO por
-- chave, e um mapa e a forma certa; aqui a pergunta e de pertencimento -- "o
-- cliente aprova esta etapa?" --, e um mapa com valores `false` guarda o que
-- ele nao quer dizer. `= any(...)` responde num operador.
--
-- E NAO HA `check` COM OS NOMES DENTRO, de proposito: a cadeia mora em
-- `etapas_padrao_do_social()`, e um `check` com as cinco palavras copiadas
-- seria a sexta copia delas -- quebrando a migration do dia em que a cadeia
-- mudar. Nome que nao existe na cadeia simplesmente nao marca etapa nenhuma,
-- que e o comportamento certo e nao precisa ser recusado.
-- ---------------------------------------------------------------------------

alter table public.client_flow_defaults
  add column if not exists social_aprovacoes text[] not null default '{}';

comment on column public.client_flow_defaults.social_aprovacoes is
  'Os nomes das etapas da corrente do social que ESTA conta aprova, alem do Envio. Vazio e o padrao: so o Envio passa pelo cliente.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Quais etapas dao para escolher
--
-- O Envio e o Programar ficam de fora, e por razoes diferentes:
--
--   * O ENVIO JA E O PORTAO. Oferece-lo numa lista de "o cliente aprova?"
--     daria a entender que da para desliga-lo -- e nao da: enviar ao cliente
--     E abrir a rodada dele (0032).
--
--   * O PROGRAMAR VEM DEPOIS DA DECISAO. Um portao ali esperaria o cliente
--     aprovar que o post foi agendado, que e uma pergunta que ninguem faz.
--
-- A tela le esta funcao em vez de repetir os nomes, pela razao de
-- `etapas_padrao_do_social()` existir: dois lugares com a cadeia escrita e o
-- lugar onde as duas comecam a divergir.
-- ---------------------------------------------------------------------------

create or replace function public.etapas_que_o_cliente_pode_aprovar()
returns table (ordem integer, nome text, funcao public.team_funcao)
language plpgsql
stable
as $$
begin
  return query
    select e.ordem, e.nome, e.funcao
      from public.etapas_padrao_do_social() e
     where e.nome not in ('Envio', 'Programar')
     order by e.ordem;
end;
$$;

comment on function public.etapas_que_o_cliente_pode_aprovar is
  'Os elos da corrente do social que podem virar portao do cliente. O Envio ja e um; o Programar vem depois da decisao.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - Qual etapa esta esperando o cliente
--
-- E A PERGUNTA QUE SUBSTITUI A PALAVRA 'Envio' escrita a mao em tres lugares
-- de `posts_corrente_do_cliente`. A resposta e o primeiro portao ainda nao
-- concluido, em ordem -- e ela e unica porque a corrente e serial: uma etapa
-- so comeca quando a anterior fecha (0045), entao nao ha dois portoes abertos
-- ao mesmo tempo.
--
-- E por isso que `approval_rounds` NAO ganhou uma coluna apontando para a
-- etapa: ela guardaria uma segunda resposta para uma pergunta que a ordem ja
-- responde, e as duas divergiriam no dia em que alguem apagasse uma etapa.
-- E a decisao de "bloqueio nao e status" vista de outro angulo.
-- ---------------------------------------------------------------------------

create or replace function public.porta_do_cliente_no_post(p_post_id uuid)
returns public.post_etapas
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e public.post_etapas;
begin
  select pe.* into e
    from public.post_etapas pe
   where pe.post_id = p_post_id
     and (pe.aprovacao_cliente or pe.nome = 'Envio')
     and pe.status <> 'concluida'
   order by pe.ordem
   limit 1;

  return e;
end;
$$;

comment on function public.porta_do_cliente_no_post is
  'A etapa da corrente que a proxima decisao do cliente fecha. Derivada da ordem, nunca gravada -- ver o cabecalho da 0076.';


-- ---------------------------------------------------------------------------
-- PASSO 5 - As etapas nascem com o portao da conta
--
-- A funcao e reescrita INTEIRA a partir da versao da 0045, que e a ultima.
-- `create or replace` se reescreve a partir da versao mais nova e nao avisa
-- quando a nova tem menos coisa que a velha -- foi assim que a 0030 perdeu os
-- carimbos de data da 0007, e ninguem viu por dois sprints.
-- ---------------------------------------------------------------------------

create or replace function public.montar_etapas_do_post(
  p_post_id       uuid,
  p_responsaveis  jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  e        record;
  quantas  integer := 0;
  portoes  text[];
begin
  -- A LISTA VEM DA CONTA DO POST, e nao de um parametro. Um parametro
  -- obrigaria todo caminho que cria post -- o dialogo, o seed, o script -- a
  -- lembrar de passa-lo, e o que esquecesse criaria um mes inteiro sem os
  -- portoes que o cliente combinou. E a razao de a corrente inteira nascer
  -- por trigger desde a 0045.
  select coalesce(d.social_aprovacoes, '{}')
    into portoes
    from public.posts p
    join public.client_flow_defaults d on d.client_id = p.client_id
   where p.id = p_post_id;

  for e in select * from public.etapas_padrao_do_social() loop
    insert into public.post_etapas (post_id, ordem, nome, funcao, responsavel_id, aprovacao_cliente)
    values (
      p_post_id, e.ordem, e.nome, e.funcao,
      nullif(p_responsaveis ->> (e.funcao::text), '')::uuid,
      -- O ENVIO E O PROGRAMAR NUNCA RECEBEM A MARCA, mesmo que o nome deles
      -- apareca na lista: o primeiro ja e o portao e o segundo vem depois da
      -- decisao. A guarda e aqui e nao num `check` pela razao do PASSO 2.
      e.nome = any(coalesce(portoes, '{}'))
        and e.nome not in ('Envio', 'Programar')
    )
    on conflict (post_id, ordem) do nothing;

    if found then
      quantas := quantas + 1;
    end if;
  end loop;

  return quantas;
end;
$$;

comment on function public.montar_etapas_do_post is
  'Monta a corrente de um post, com os portoes de cliente que a conta dele combinou (0076).';


-- ---------------------------------------------------------------------------
-- PASSO 6 - O portao se fecha pela decisao do cliente, e nao pela mao
--
-- A funcao e reescrita INTEIRA a partir da versao da 0045.
-- ---------------------------------------------------------------------------

create or replace function public.post_etapas_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pendente text;
  -- AS TRAVAS VALEM PARA GENTE, e as duas excecoes estao aqui em cima juntas
  -- de proposito: escritas por duas razoes diferentes, em dois `if` separados,
  -- divergiriam -- e foi o que aconteceu na primeira versao desta funcao, em
  -- que a trava do Envio isentava o seed e a da ordem nao.
  --
  --   * SEM SESSAO QUEM ESCREVE E O SEED, como em `proteger_colunas_do_post`
  --     (0042) e em `comments_normaliza` (0032). O seed monta um post no meio
  --     do fluxo -- ja enviado, ja com ajuste pedido --, e uma corrente que so
  --     aceita ser percorrida em ordem obrigaria cinco `update` em sequencia
  --     para descrever um estado.
  --
  --   * E O GUC diz que quem escreve e o proprio produto. Sem ele a trava mais
  --     nova da 0045 quebraria a acao mais antiga do portal:
  --     `posts_corrente_do_cliente` move a etapa Envio e roda com o
  --     `auth.uid()` DO CLIENTE (`security definer` nao troca quem esta
  --     logado), entao o cliente aprovando um post cairia em "o Envio nao se
  --     marca a mao" -- recusando a unica coisa que ele faz la.
  --
  -- O `set local` do GUC morre no fim da transacao e nao atravessa a
  -- requisicao do PostgREST, entao ninguem consegue liga-lo por fora.
  travas boolean := (select auth.uid()) is not null
                    and coalesce(current_setting('full_hub.corrente', true), '') <> 'on';
begin
  -- O QUE O RESPONSAVEL TROCA E O STATUS, e mais nada. Policy nao limita
  -- coluna: sem esta parte, um PATCH no PostgREST passaria a etapa do redator
  -- para outra pessoa, ou trocaria "Layout" por outro nome.
  if travas and not public.is_gestor() then
    if new.nome is distinct from old.nome
       or new.funcao is distinct from old.funcao
       or new.ordem is distinct from old.ordem
       or new.responsavel_id is distinct from old.responsavel_id
       or new.prazo is distinct from old.prazo
       -- A COLUNA DE 0076 ENTRA NA MESMA LISTA. Quem produz a etapa nao
       -- decide se ela passa pelo cliente: isso e combinado com a conta, e
       -- mora em `client_flow_defaults`.
       or new.aprovacao_cliente is distinct from old.aprovacao_cliente then
      raise exception using
        errcode = 'check_violation',
        message = 'Numa etapa que é sua você move o andamento, e o resto é da gestão.',
        hint    = 'Nome, função, ordem, responsável e prazo mudam com quem abriu o post.';
    end if;
  end if;

  if new.status is not distinct from old.status then
    new.updated_at := now();
    return new;
  end if;

  -- ENVIO NAO SE MARCA A MAO, nem pela gestao -- ele e consequencia da rodada
  -- de escopo cliente, como `posts.enviado_em` e desde a 0032. Marcar a etapa
  -- afirmaria que o post foi ao cliente sem nada ter saido da agencia.
  if travas and old.nome = 'Envio' then
    raise exception using
      errcode = 'check_violation',
      message = 'A etapa Envio acompanha a decisão do cliente, e não se marca à mão.',
      hint    = 'Use a ação Enviar ao cliente; quando ele responder, a etapa anda sozinha.';
  end if;

  -- E A ETAPA QUE PASSA PELO CLIENTE SE FECHA DO MESMO JEITO (0076) -- pela
  -- decisao dele, e nao pela mao de quem a fez.
  --
  -- A DIFERENCA PARA O ENVIO E QUE AQUI HA TRABALHO A FAZER: quem escreve a
  -- pauta precisa mover a etapa para "Em andamento" e voltar nela. Entao a
  -- recusa e so dos DOIS status que afirmam uma decisao que nao aconteceu --
  -- `concluida`, que diria que o cliente aprovou, e `enviada_aprovacao`, que
  -- diria que a rodada existe. O Envio recusa qualquer mudanca porque nele
  -- nao ha nada a fazer alem de esperar.
  --
  -- E a mesma forma de `subtasks_bloqueia_conclusao_sem_aprovacao` (0007): a
  -- unica porta para `concluida` e uma rodada aprovada, e quem recusa e o
  -- banco, nunca a tela.
  if travas and old.aprovacao_cliente and old.nome <> 'Envio'
     and new.status in ('concluida', 'enviada_aprovacao') then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa %s passa pelo cliente, e quem a fecha é a decisão dele.', old.nome),
      hint    = 'Use a ação Enviar ao cliente; quando ele aprovar, a etapa anda sozinha.';
  end if;

  -- A CORRENTE E UMA CORRENTE: cada etapa espera a anterior. E a mesma regra da
  -- dependencia de subtarefa (0007) e pela mesma razao -- o redator escrevendo
  -- antes de a pauta existir escreve sobre o que achou. A diferenca e que aqui
  -- a dependencia nao se cadastra: ela E a ordem.
  --
  -- A RECUSA NOMEIA O QUE FALTA, e todas. "Etapa bloqueada" manda a pessoa
  -- procurar; dizer quais ja diz a quem perguntar.
  --
  -- E UMA ETAPA `em_ajustes` NAO BLOQUEIA O QUE VEM DEPOIS DELA. Sem esta
  -- linha a corrente trava exatamente onde o cliente mexeu: ele pede ajustes,
  -- o Envio vai para `em_ajustes`, a etapa de Ajustes nasce logo depois dele
  -- -- e comecar essa etapa e recusado com "vem depois de Envio", que nunca
  -- vai ficar concluida enquanto o ajuste nao for feito. Um abraco.
  --
  -- A leitura e a que a palavra ja diz: uma etapa em ajustes JA DEVOLVEU o
  -- trabalho. Ela nao esta esperando a anterior; esta esperando alguem DEPOIS
  -- dela consertar. E o Programar continua travado do jeito certo -- enquanto
  -- o Ajustes nao fecha ele e o bloqueio, e quando o post volta ao cliente o
  -- Envio fica `enviada_aprovacao`, que bloqueia de novo. So a aprovacao do
  -- cliente o libera, que e a regra que importa: ninguem programa o que o
  -- cliente nao aprovou.
  if travas and old.status = 'nao_iniciada' and new.status <> 'nao_iniciada' then
    select string_agg(e.nome, ', ' order by e.ordem) into pendente
      from public.post_etapas e
     where e.post_id = new.post_id
       and e.ordem < new.ordem
       and e.status not in ('concluida', 'em_ajustes');

    if pendente is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('Esta etapa vem depois de %s.', pendente),
        hint    = 'A corrente do post é em ordem: cada etapa começa quando a anterior é concluída.';
    end if;
  end if;

  -- O CARIMBO NAO E TRAVA, e por isso fica fora dos `if travas`: ele vale para
  -- toda escrita, a do seed inclusive. Uma etapa concluida sem data de
  -- conclusao e uma linha que nao serve para relatorio nenhum.
  if new.status = 'concluida' and old.status <> 'concluida' then
    new.concluida_em := now();
  elsif new.status <> 'concluida' then
    new.concluida_em := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


comment on function public.post_etapas_regras is
  'As travas da etapa do post. Desde a 0076 o portao do cliente se fecha pela decisao dele, como o Envio ja fazia.';


-- ---------------------------------------------------------------------------
-- PASSO 7 - A corrente acompanha o portao, e nao a palavra "Envio"
--
-- A funcao e reescrita INTEIRA a partir da versao da 0045.
-- ---------------------------------------------------------------------------

create or replace function public.posts_corrente_do_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quantos     integer;
  proxima     integer;
  dono_layout uuid;
  porta       public.post_etapas;
  quem_refaz  uuid;
  funcao_ref  public.team_funcao;
  rotulo      text;
begin
  -- REENTRANCIA: desde a 0076 esta funcao escreve de volta em `posts` (o
  -- portao do meio devolve o post para producao), e um `after update` que
  -- atualiza a propria linha se dispara de novo. O GUC ja diz "quem escreve
  -- aqui e o produto", entao ele serve tambem de guarda -- e serve melhor que
  -- uma coluna sentinela, porque `set local` morre no fim da transacao.
  if coalesce(current_setting('full_hub.corrente', true), '') = 'on' then
    return new;
  end if;

  -- Post que ainda nao tem corrente (anterior a 0045) nao ganha uma agora: ela
  -- nasceria pela metade, com o trabalho ja feito marcado como nao iniciado.
  if not exists (select 1 from public.post_etapas e where e.post_id = new.id) then
    return new;
  end if;

  -- QUAL ETAPA ESTA ESPERANDO O CLIENTE. Ate a 0076 a resposta era a palavra
  -- 'Envio', escrita em tres lugares desta funcao. Com os portoes do meio ela
  -- passou a ser uma pergunta -- e uma pergunta so, num lugar so.
  porta := public.porta_do_cliente_no_post(new.id);

  if porta.id is null then
    return new;
  end if;

  -- Ver a explicacao em `post_etapas_regras`: daqui para baixo quem escreve e
  -- o produto, e as travas da etapa nao se aplicam.
  perform set_config('full_hub.corrente', 'on', true);

  -- FOI AO CLIENTE -> o Envio esta em curso.
  if new.enviado_em is not null and old.enviado_em is null then
    update public.post_etapas
       set status = 'enviada_aprovacao', updated_at = now()
     where id = porta.id;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- APROVOU -> o Envio fecha, e o Programar e a proxima mao.
  if new.status = 'aprovado' then
    update public.post_etapas
       set status = 'concluida', concluida_em = now(), updated_at = now()
     where id = porta.id and status <> 'concluida';

    -- O POST NAO ESTA APROVADO QUANDO O PORTAO ERA DO MEIO, e esta e a linha
    -- que impede a mentira mais cara da 0076: o cliente aprovou a PAUTA, e
    -- `decidir_rodada_do_cliente` acabou de escrever `status = 'aprovado'` no
    -- post -- que e o status que o calendario dele pinta de verde, que a
    -- grade do feed mostra como fechado e que a agencia le como "pode
    -- programar". Nada disso aconteceu: a arte nem existe.
    --
    -- Entao o post volta para producao, que e onde ele esta de verdade. A
    -- rodada fica gravada com a decisao dela, intacta -- o que se corrige e o
    -- status do POST, que nunca foi sobre a pauta.
    -- O GUC ja esta ligado logo acima, entao esta escrita nao esbarra nas
    -- travas da etapa -- e e ele tambem que impede a reentrancia, na guarda
    -- do topo desta funcao.
    if porta.nome <> 'Envio' then
      update public.posts
         set status = 'em_producao'
       where id = new.id;
    end if;
  end if;

  -- PEDIU AJUSTES -> nasce a etapa de Ajustes, entre o Envio e o Programar.
  --
  -- UMA POR RODADA, numerada. A segunda volta do cliente nao reabre a
  -- primeira: elas sao dois pedidos diferentes, com dois motivos diferentes, e
  -- reaproveitar a linha apagaria o primeiro -- a mesma razao pela qual rodada
  -- fechada nunca e reescrita (0007).
  if new.status = 'ajustes' then
    -- O AJUSTE NASCE LOGO DEPOIS DO PORTAO QUE O CLIENTE RECUSOU, e nao no
    -- vao fixo entre 40 e 50. Com os portoes do meio (0076) o vao certo e o
    -- do portao: um ajuste da Pauta entre 10 e 20, um ajuste do Envio entre
    -- 40 e 50. E por isso que a folga de dez existe desde a 0045 -- ela
    -- passou a valer em todos os elos, e nao so num.
    rotulo := case when porta.nome = 'Envio' then 'Ajustes'
                   else format('Ajustes da %s', porta.nome) end;

    select count(*) into quantos
      from public.post_etapas e
     where e.post_id = new.id and e.nome like rotulo || '%';

    select coalesce(max(e.ordem), porta.ordem) + 1 into proxima
      from public.post_etapas e
     where e.post_id = new.id
       and e.ordem > porta.ordem and e.ordem < porta.ordem + 10;

    -- QUEM FEZ O TRABALHO FAZ O AJUSTE. Etapa sem dono nao aparece no "Minhas
    -- Tasks" de ninguem, e um pedido do cliente e a ultima coisa do produto
    -- que pode ficar sem dono.
    --
    -- No Envio isso quer dizer o Layout -- a regra da 0045, que continua
    -- inteira: a etapa Envio e da Gestao, e quem refaz a arte e quem a fez.
    -- Num portao do meio quem refaz e o dono do PROPRIO portao: quem escreveu
    -- a pauta reescreve a pauta. Ler "Layout" nos dois casos poria o designer
    -- para reescrever texto.
    if porta.nome = 'Envio' then
      select e.responsavel_id into dono_layout
        from public.post_etapas e
       where e.post_id = new.id and e.nome = 'Layout';
      quem_refaz := dono_layout;
      funcao_ref := 'Design'::public.team_funcao;
    else
      quem_refaz := porta.responsavel_id;
      funcao_ref := porta.funcao;
    end if;

    if quantos < 9 then
      insert into public.post_etapas (post_id, ordem, nome, funcao, responsavel_id)
      values (new.id, proxima,
              case when quantos = 0 then rotulo
                   else format('%s %s', rotulo, quantos + 1) end,
              funcao_ref,
              quem_refaz);

      -- `notificar()` NAO ACEITA DESTINATARIO NULO -- `notifications.user_id` e
      -- `not null`. Sem este `if`, um post cuja etapa de Layout ainda nao tem
      -- dono derrubava a decisao do cliente inteira: ele clicava em "solicitar
      -- ajustes" no portal e levava um erro de banco. Nem o pedido, nem o
      -- comentario, nem a rodada -- e a culpa apareceria na tela dele.
      if quem_refaz is not null then
        perform public.notificar(
          quem_refaz, 'aprovacao',
          format('O cliente pediu ajustes em "%s"', new.tema),
          'Uma etapa de Ajustes entrou na corrente do post.',
          '/painel/social-media'
        );
      end if;
    end if;

    update public.post_etapas
       set status = 'em_ajustes', updated_at = now()
     where id = porta.id;
  end if;

  -- DESLIGA ANTES DE DEVOLVER. `set local` so cai no fim da transacao, e uma
  -- transacao que aprova um post e depois mexe numa etapa a mao passaria pelas
  -- travas caladas -- a saida de emergencia virando porta destrancada.
  perform set_config('full_hub.corrente', 'off', true);

  return new;
end;
$$;

drop trigger if exists posts_corrente_do_cliente on public.posts;
create trigger posts_corrente_do_cliente
  after update on public.posts
  for each row execute function public.posts_corrente_do_cliente();

comment on function public.posts_corrente_do_cliente is
  'Move a corrente conforme o cliente decide. Desde a 0076 a etapa alvo e derivada por porta_do_cliente_no_post(), e nao a palavra Envio escrita a mao.';


-- ---------------------------------------------------------------------------
-- PASSO 8 - As duas travas da ARTE valem so no portao do Envio
--
-- A funcao e reescrita INTEIRA a partir da versao da 0060, que e a ultima.
-- ---------------------------------------------------------------------------

create or replace function public.validar_nova_rodada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo  uuid := public.subtask_da_rodada(new.content_type, new.content_id);
  post  uuid := public.post_da_rodada(new.content_type, new.content_id);
  entr  uuid := public.entregavel_da_rodada(new.content_type, new.content_id);
  dono  uuid;
  exige boolean;
  porta public.post_etapas;
begin
  if alvo is null and post is null and entr is null then
    raise exception using
      errcode = 'check_violation',
      message = format('Rodada de aprovação de "%s" ainda não tem regra.', new.content_type),
      hint    = 'Os tipos com regra hoje são subtask, post e deliverable.';
  end if;

  -- ------------------------------------------------------------- entregavel
  if entr is not null then
    if not exists (select 1 from public.deliverables d where d.id = entr) then
      raise exception using
        errcode = 'check_violation',
        message = 'Entregável não encontrado.';
    end if;

    -- GRUPO NAO VAI PARA APROVACAO, e e a mesma regra da etapa agrupadora: o
    -- status dele e calculado pelos filhos, entao uma rodada dele prometeria
    -- uma decisao que o calculo desfaz no instante seguinte. Quem o cliente
    -- decide e o sub-item.
    if public.entregavel_eh_grupo(entr) then
      raise exception using
        errcode = 'check_violation',
        message = 'Este entregável agrupa outros: quem vai para aprovação são os itens de dentro.',
        hint    = 'O status do grupo é calculado pelos sub-itens.';
    end if;

    dono := (select d.responsavel_id from public.deliverables d where d.id = entr);

    if new.escopo = 'interna' then
      if new.solicitado_por is distinct from dono and not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Só quem produziu o entregável envia para aprovação.';
      end if;
    else
      if not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Enviar para o cliente é do Desenvolvedor.',
          hint    = 'Quem produz o material nunca o envia ao cliente.';
      end if;

      if not exists (
        select 1 from public.approval_rounds r
         where r.content_type = new.content_type
           and r.content_id = new.content_id
           and r.numero_rodada = new.numero_rodada
           and r.escopo = 'interna'
           and r.status = 'aprovada'
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Esta rodada ainda não passou pela aprovação interna.';
      end if;
    end if;

    return new;
  end if;

  -- ------------------------------------------------------------------- post
  if post is not null then
    -- QUEM PRODUZIU, e nao quem abriu (0042). Antes desta linha era
    -- `p.criado_por`, e com a corrente de maos isso passou a apontar para a
    -- gestao que escreveu o briefing -- virando as duas travas abaixo do
    -- avesso. Ver o cabecalho da 0042.
    dono := public.dono_do_post(post);

    if not exists (select 1 from public.posts p where p.id = post) then
      raise exception using
        errcode = 'check_violation',
        message = 'Post não encontrado.';
    end if;

    if new.escopo = 'interna' then
      if new.solicitado_por is distinct from dono and not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Só quem produziu o post envia para aprovação.';
      end if;
    else
      if not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Enviar para o cliente é do Desenvolvedor.',
          hint    = 'Quem produz o post nunca o envia ao cliente.';
      end if;

      -- QUAL PORTAO ESTA SAINDO (0076). As duas travas abaixo sao sobre a
      -- ARTE indo ao cliente, e num portao do meio nao ha arte ainda: quem
      -- sai e a pauta ou a legenda. Exigi-las ali travaria o portao para
      -- sempre -- o mes abre sem data (0044) e a pauta e a PRIMEIRA etapa,
      -- entao "escolha o dia antes de enviar" seria uma recusa que a corrente
      -- nao tem como satisfazer.
      porta := public.porta_do_cliente_no_post(post);

      -- POST SEM DATA NAO VAI AO CLIENTE (0044). Ela nasce nula desde esta
      -- migration -- o mes abre em branco e quem produz distribui --, e sem
      -- esta linha o cliente abriria o portal, veria a arte e a legenda, e
      -- decidiria sem saber quando aquilo vai ao ar. "Quando?" em branco ao
      -- lado de um botao de aprovar e a pior combinacao possivel.
      --
      -- Ela NAO contradiz a decisao de que a data e de quem produz (PASSO 2):
      -- nao diz quem manda na data, diz que ela existe antes de o material
      -- sair da agencia. E a mesma forma da trava de video sem link.
      if coalesce(porta.nome, 'Envio') = 'Envio' and exists (
        select 1 from public.posts p
         where p.id = post and p.data_publicacao is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post ainda não tem data de publicação.',
          hint    = 'Escolha o dia antes de enviar: o cliente decide sobre o material e sobre quando ele vai ao ar.';
      end if;

      -- VIDEO SEM LINK NAO VAI (0042). O cliente abriria a tela para decidir
      -- sobre uma arte que nao existe -- e decidiria, porque o botao de
      -- aprovar estaria la. A recusa e aqui e nao na tela porque este e o
      -- unico ponto por onde o material sai da agencia.
      if coalesce(porta.nome, 'Envio') = 'Envio' and exists (
        select 1 from public.posts p
         where p.id = post and p.midia = 'video'
           and nullif(trim(coalesce(p.video_url, '')), '') is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post é vídeo e ainda não tem o link.',
          hint    = 'Cole o endereço do Drive ou do YouTube antes de enviar.';
      end if;

      if not exists (
        select 1 from public.approval_rounds r
         where r.content_type = new.content_type
           and r.content_id = new.content_id
           and r.numero_rodada = new.numero_rodada
           and r.escopo = 'interna'
           and r.status = 'aprovada'
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Esta rodada ainda não passou pela aprovação interna.';
      end if;
    end if;

    return new;
  end if;

  -- ---------------------------------------------------------------- subtask
  dono  := (select s.responsavel_id   from public.subtasks s where s.id = alvo);
  exige := (select s.requer_aprovacao from public.subtasks s where s.id = alvo);

  if not coalesce(exige, false) then
    raise exception using
      errcode = 'check_violation',
      message = 'Essa subtarefa não exige aprovação.';
  end if;

  if new.escopo = 'interna' then
    if new.solicitado_por is distinct from dono and not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Só o responsável pela subtarefa envia para aprovação.';
    end if;
  else
    if not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Enviar para o cliente é do Desenvolvedor.',
        hint    = 'O responsável pela subtarefa nunca envia material ao cliente.';
    end if;

    if not exists (
      select 1 from public.approval_rounds r
       where r.content_type = new.content_type
         and r.content_id = new.content_id
         and r.numero_rodada = new.numero_rodada
         and r.escopo = 'interna'
         and r.status = 'aprovada'
    ) then
      raise exception using
        errcode = 'check_violation',
        message = 'Esta rodada ainda não passou pela aprovação interna.';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.validar_nova_rodada() is
  'Valida a rodada que nasce, nos tres tipos. Desde a 0076 as travas de data e de link de video valem so quando o portao que sai e o Envio -- num portao do meio nao ha arte, ha pauta.';


-- ---------------------------------------------------------------------------
-- PASSO 9 - O QUE O CLIENTE ESTA DECIDINDO, do lado dele
--
-- SEM ESTA FUNCAO O PORTAO DO MEIO ABRE UMA TELA VAZIA. A tela de decisao do
-- portal foi desenhada para arte grande, propriedades, texto e so entao os
-- botoes -- e num portao do meio a arte NAO EXISTE ainda: o que saiu da
-- agencia foi a pauta. O cliente veria uma moldura cinza e dois botoes, e
-- decidiria sobre nada.
--
-- E O CLIENTE CONTINUA SEM POLICY EM `post_etapas`, que e a linha da 0045 e
-- fica de pe: a corrente e conversa interna -- quem esta com o material na
-- mao, qual etapa esta travada, quem atrasou. O que ele precisa saber e outra
-- coisa: O QUE esta esperando ele, e o texto daquilo. Abrir a tabela para ele
-- entregaria as duas de lambuja, e policy nao limita coluna.
--
-- Por isso a forma e `security definer` devolvendo so o agregado -- a de
-- `usuarios_do_meu_cliente()` (0031), de `meus_pedidos_de_nota()` (0066) e de
-- `meus_comodatos()` (0069).
--
-- E A GUARDA E ESCRITA A MAO, porque `security definer` NAO passa pela RLS de
-- `posts`: ela repete `posts_select_cliente` -- a empresa e o carimbo de envio
-- -- mais o `is_staff()` da visualizacao administrativa. Sem ela a funcao
-- responderia sobre o post de qualquer empresa para quem tivesse o uuid, que
-- e o furo que este produto fecha em nove lugares.
--
-- A PAUTA PASSA A SER LEGIVEL PELO CLIENTE NAS CONTAS QUE A APROVAM, e a
-- inversao esta declarada no cabecalho desta migration: a 0046 escreveu que a
-- pauta e conversa interna, e era verdade enquanto ninguem de fora a decidia.
-- Quem liga o interruptor esta dizendo que naquela conta ela nao e -- e o
-- recorte e exatamente esse: SO a etapa marcada, SO enquanto ela e o portao
-- aberto, SO na conta que a ligou.
-- ---------------------------------------------------------------------------

create or replace function public.o_que_o_cliente_decide(p_post_id uuid)
returns table (etapa text, texto text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.posts;
  e public.post_etapas;
begin
  select * into p from public.posts where id = p_post_id;
  if p.id is null then
    return;
  end if;

  -- A MESMA PERGUNTA QUE `posts_select_cliente` FAZ, escrita a mao porque o
  -- definer nao a faz sozinho.
  if not (
    public.is_staff()
    or (p.client_id in (select public.my_client_ids()) and p.enviado_em is not null)
  ) then
    return;
  end if;

  e := public.porta_do_cliente_no_post(p_post_id);

  -- Sem portao, ou no Envio, NAO HA NADA A DIZER: o Envio manda o material
  -- pronto, e a tela dele ja e a de sempre. Devolver "Envio" aqui faria a tela
  -- anunciar uma etapa em todo post enviado desde a 0032.
  if e.id is null or e.nome = 'Envio' then
    return;
  end if;

  return query
    select e.nome,
           -- CADA PORTAO DEVOLVE O TEXTO QUE ELE PRODUZ, e e o mesmo de-para do
           -- card (0046): a Pauta enche `posts.pauta`, o Conteudo enche
           -- `posts.legenda`, o Layout enche a versao -- e a versao ja viaja
           -- pela arte, entao ali o texto e nulo e a tela cai na legenda.
           case e.nome
             when 'Pauta'    then p.pauta
             when 'Conteúdo' then p.legenda
             else null
           end;
end;
$$;

comment on function public.o_que_o_cliente_decide is
  'O portao aberto de um post e o texto dele, para a tela do portal. Definer para devolver so o agregado: o cliente nao tem policy em post_etapas (0045), e nem passa a ter (0076).';

notify pgrst, 'reload schema';
