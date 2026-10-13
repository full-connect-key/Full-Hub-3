-- ===========================================================================
-- 0098 - O SINO TOCA NOS DOIS LADOS
--
-- Relato do usuario: *"A plataforma tanto da agencia, quanto o portal do
-- cliente nao tem notificacoes ativas. Ao ser marcado em uma task, ao receber
-- um pedido de ajuste."*
--
-- O SINO NUNCA ESTEVE DESLIGADO, E ESSA E A PARTE QUE IMPORTA DO DIAGNOSTICO.
-- `notificar()` existe desde a 0011, a policy de leitura e `user_id =
-- auth.uid()`, o sino esta na topbar das DUAS areas, e quarenta e tantos
-- lugares o chamam. O que faltava eram os eventos que a agencia mais pratica
-- -- e um deles e o unico caminho pelo qual o cliente seria avisado de
-- qualquer coisa.
--
-- **O QUE ESTE ARQUIVO LIGA, E POR QUE CADA UM FALTAVA:**
--
--   1. ser marcado numa etapa          nunca houve trigger. O unico que
--                                      existia (0088) e so da fase do mes de
--                                      social, e a demanda comum nao tinha
--                                      nenhum: so o `publicarTask` avisava, e
--                                      so no instante da publicacao. Delegar
--                                      uma etapa no dia seguinte nao avisava
--                                      ninguem.
--   2. pedido de ajuste na etapa       idem. A etapa voltava para `em_ajustes`
--                                      e quem a produziu descobria abrindo a
--                                      tela.
--   3. comentario na demanda           `task_comentarios` NAO TEM NENHUM
--                                      trigger, de nenhum tipo. Escrever ali
--                                      era escrever para a parede.
--   4. o cliente recebendo material    e este e o buraco grande do portal.
--
--
-- O CLIENTE SO ERA AVISADO POR UM CAMINHO, E ELE E O MAIS NOVO DE TODOS
--
-- `enviar_mes_ao_cliente()` (0090) avisa -- um aviso por pessoa, nao por peca.
-- E so. Post enviado um a um (0032), peca de campanha enviada (0033), etapa de
-- demanda enviada para o aval do cliente: **nenhum dos tres avisava ninguem do
-- lado de la**. As funcoes de decisao avisam a AGENCIA quando o cliente
-- decide, que e o sentido contrario -- e foi por isso que a leitura rapida do
-- codigo dava a impressao de que o portal estava coberto.
--
-- **E A PONTE ESTAVA CONSTRUIDA.** `approval_rounds` e generica desde a 0030,
-- entao post, entregavel e etapa abrem a MESMA rodada; e `cliente_da_rodada()`
-- existe desde a 0035 e responde de que empresa e cada uma das tres. Um
-- trigger so cobre os tres caminhos, e e o espelho de
-- `approval_rounds_avisa_aprovador` (0064), que ja faz isso para o aval
-- interno. Nenhuma tabela nova, nenhuma coluna nova.
--
--
-- "TUDO QUE ACONTECE" NAO E UM AVISO POR ESCRITA, E A DIFERENCA E DITA
--
-- O pedido foi *"tudo que aconteca gere uma notificacao"*. Tomado ao pe da
-- letra ele se desfaz sozinho: um aviso por `update` poria trinta sinos por
-- dia na tela de quem move cards, e a regra que este produto ja escreveu sete
-- vezes -- *um aviso que cobra o que a pessoa ja fez e o aviso que ela aprende
-- a ignorar* -- vale aqui com mais forca, porque o sino e um so para o produto
-- inteiro. Entao o criterio e: **avisa o que MUDA O QUE ALGUEM PRECISA FAZER**
-- -- trabalho que passou a ser seu, trabalho que voltou, material que chegou,
-- alguem falando com voce. Mover um card, trocar uma data, anexar um arquivo:
-- nao.
--
-- O que ficou de fora, e e decisao, nao esquecimento:
--
--   mudanca de prazo da etapa      quem delega quase sempre avisa junto; e um
--                                  aviso por data mexida seria um por arrasto
--                                  no calendario
--   conclusao de etapa             quem espera e a mae, e o status dela ja
--                                  recalcula sozinho; avisar a cada folha
--                                  fechada e um sino por subtarefa num mes de
--                                  social de dezoito pecas
--   dependencia liberada           o cadeado na tela ja diz, e ele e lido no
--                                  momento em que a pessoa vai comecar
--
-- Qualquer um dos tres vira um `perform notificar()` no lugar onde a escrita
-- ja acontece, no dia em que for decisao.
--
--
-- MEDIDO COM CINCO MUTACOES, e os numeros estao no fim deste cabecalho.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O CLIENTE E AVISADO QUANDO ALGO CHEGA PARA ELE
--
-- O espelho de `approval_rounds_avisa_aprovador` (0064): aquele toca o sino da
-- gestao quando uma rodada INTERNA nasce pendente, este toca o das pessoas da
-- empresa quando uma rodada de CLIENTE nasce pendente.
--
-- **E TRIGGER E NAO ACTION**, pela razao da 0064 e da 0045: a rodada nasce por
-- mais de um caminho -- a tela do Social Media, a da campanha, a da etapa, e um
-- `insert` montado a mao --, e um aviso escrito na camada de aplicacao cobre o
-- que passou pela tela e perde o resto. Com o trigger, quem acrescentar um
-- quarto caminho ganha o aviso de graca.
--
-- **O LOTE FICA DE FORA, E E A LINHA QUE EVITA DEZOITO SINOS.**
-- `enviar_mes_ao_cliente()` (0090) abre uma rodada POR PECA dentro de uma
-- transacao e manda UM aviso por pessoa no fim, de proposito -- *"dezoito
-- sinos para um envio e o que ensina a ignorar o sino"*. Sem o
-- `lote_id is null` aqui, este trigger desfaria aquela decisao sem ninguem
-- notar: o mes passaria a tocar dezoito vezes mais uma. O `lote_id` e nulo em
-- toda rodada avulsa, entao a condicao e exata e nao uma heuristica.
-- ---------------------------------------------------------------------------
create or replace function public.approval_rounds_avisa_o_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  empresa uuid;
  pessoa  uuid;
  nome    text;
  destino text;
begin
  if new.escopo <> 'cliente' or new.status <> 'pendente' then
    return null;
  end if;

  -- O envio em lote manda o aviso dele, no fim da transacao.
  if new.lote_id is not null then
    return null;
  end if;

  empresa := public.cliente_da_rodada(new.content_type::text, new.content_id);
  if empresa is null then
    return null;
  end if;

  -- O NOME DO MATERIAL E O DESTINO SAEM DO TIPO, e sao a unica coisa que
  -- diverge entre os tres. Um aviso que diz so "um material chegou" obriga a
  -- pessoa a abrir para descobrir o que e -- e um que leva a listagem errada
  -- e pior que um que nao leva a lugar nenhum.
  if new.content_type::text = 'post' then
    select p.tema into nome from public.posts p where p.id = new.content_id;
    destino := '/portal/social-media';
  elsif new.content_type::text = 'deliverable' then
    select d.nome into nome from public.deliverables d where d.id = new.content_id;
    destino := '/portal/campanhas';
  else
    select s.titulo into nome from public.subtasks s where s.id = new.content_id;
    destino := '/portal/itens';
  end if;

  for pessoa in
    select cu.user_id from public.client_users cu where cu.client_id = empresa
  loop
    perform public.notificar(
      pessoa, 'aprovacao',
      format('%s está esperando a sua aprovação', coalesce(nome, 'Um material')),
      'A Full enviou e está aguardando a sua decisão.',
      destino
    );
  end loop;

  return null;
end;
$func$;

drop trigger if exists approval_rounds_avisa_o_cliente on public.approval_rounds;
create trigger approval_rounds_avisa_o_cliente
  after insert on public.approval_rounds
  for each row execute function public.approval_rounds_avisa_o_cliente();

comment on function public.approval_rounds_avisa_o_cliente() is
  'Avisa as pessoas da empresa quando uma rodada de escopo cliente nasce pendente (0098). Espelho de approval_rounds_avisa_aprovador. O lote fica de fora: enviar_mes_ao_cliente manda um aviso por pessoa, nao um por peca.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - SER MARCADO NUMA ETAPA
--
-- **O QUE EXISTIA COBRIA UM INSTANTE SO.** `publicarTask` avisa os
-- responsaveis no clique de "Criar task", e esta certo -- avisar a cada etapa
-- rascunhada transformaria o sino em ruido. O que nao existia era o depois:
-- delegar uma etapa numa demanda que ja esta correndo, ou trocar o
-- responsavel dela, nao avisava ninguem.
--
-- **O RASCUNHO NAO AVISA**, e e a regra do produto inteiro: ele nao entra em
-- lista, board, calendario, Minhas Tasks, contador, relatorio, notificacao nem
-- portal. Quem avisa a demanda que nasce e o `publicarTask`, uma vez.
--
-- **A FASE DO MES DE SOCIAL FICA DE FORA**, porque a 0088 ja a avisa com uma
-- frase propria -- *"Uma etapa do mes de social e sua"* --, e o link dela leva
-- a Minhas Tasks em vez do detalhe da demanda. Sem o `social_papel is null`
-- aqui, abrir um mes mandaria dois sinos por fase.
-- ---------------------------------------------------------------------------
create or replace function public.subtasks_avisa_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  demanda record;
begin
  if new.responsavel_id is null or new.social_papel is not null then
    return null;
  end if;

  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    return null;
  end if;

  select t.id, t.titulo, t.publicada_em
    into demanda
    from public.tasks t where t.id = new.task_id;

  if demanda.publicada_em is null then
    return null;
  end if;

  perform public.notificar(
    new.responsavel_id, 'task',
    format('%s é sua', new.titulo),
    demanda.titulo,
    '/painel/gestao-tasks/' || demanda.id::text
  );

  return null;
end;
$func$;

drop trigger if exists subtasks_avisa_responsavel on public.subtasks;
create trigger subtasks_avisa_responsavel
  after insert or update of responsavel_id on public.subtasks
  for each row execute function public.subtasks_avisa_responsavel();

comment on function public.subtasks_avisa_responsavel() is
  'Avisa quem passou a ser responsavel por uma etapa (0098). Rascunho nao avisa -- quem avisa a demanda que nasce e publicarTask, uma vez. A fase do mes de social fica de fora: a 0088 ja a avisa com frase e link proprios.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - O PEDIDO DE AJUSTE VOLTA PARA QUEM PRODUZIU
--
-- Uma etapa entra em `em_ajustes` por dois caminhos -- a trava 4 de
-- `validar_transicao_de_subtarefa` exige uma rodada `ajustes_solicitados` na
-- propria etapa, e `posts_corrente_do_cliente` (0045) move a corrente do
-- social. Nos dois, quem precisa saber e quem tem a etapa na mao.
--
-- **O COMENTARIO DO PEDIDO VAI NO CORPO DO AVISO**, e nao so o titulo. Um
-- sino que diz "pediram ajuste" sem dizer o que manda a pessoa abrir a tela
-- para descobrir se e trabalho de cinco minutos ou de um dia -- e e a mesma
-- razao pela qual a recusa da 0023 nomeia cada etapa em vez de dizer "ha
-- etapa sem aprovacao". Ele sai da rodada mais recente de ajuste, que e a que
-- causou a volta.
-- ---------------------------------------------------------------------------
create or replace function public.subtasks_avisa_ajuste()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  pedido text;
begin
  if new.status <> 'em_ajustes' or old.status = 'em_ajustes' then
    return null;
  end if;

  if new.responsavel_id is null then
    return null;
  end if;

  select r.comentario into pedido
    from public.approval_rounds r
   where r.content_type = 'subtask'
     and r.content_id = new.id
     and r.status = 'ajustes_solicitados'
   order by r.numero_rodada desc
   limit 1;

  perform public.notificar(
    new.responsavel_id, 'aprovacao',
    format('Pediram ajuste em "%s"', new.titulo),
    pedido,
    '/painel/minhas-tasks'
  );

  return null;
end;
$func$;

drop trigger if exists subtasks_avisa_ajuste on public.subtasks;
create trigger subtasks_avisa_ajuste
  after update of status on public.subtasks
  for each row execute function public.subtasks_avisa_ajuste();

comment on function public.subtasks_avisa_ajuste() is
  'Avisa quem tem a etapa quando ela volta para em_ajustes (0098). O comentario do pedido vai no corpo: um sino que nao diz o que foi pedido manda a pessoa abrir a tela para descobrir o tamanho do trabalho.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - O COMENTARIO NA DEMANDA CHEGA A QUEM ESTA NELA
--
-- `task_comentarios` **nao tinha trigger nenhum**, de nenhum tipo, desde que
-- nasceu. Escrever ali era escrever para a parede: quem comentava dependia de
-- a outra pessoa abrir aquela demanda por acaso.
--
-- **QUEM E AVISADO E QUEM ESTA NO TRABALHO**, e nao a agencia inteira: os
-- responsaveis das etapas e quem abriu a demanda. Avisar todo `is_staff()`
-- faria uma conversa de duas pessoas tocar quatorze sinos, que e exatamente o
-- que ensina a ignorar o sino.
--
-- **UMA VEZ POR PESSOA, E NAO POR ETAPA.** Quem tem tres etapas na mesma
-- demanda recebe um aviso, nao tres -- a mesma conta que `publicarTask` ja
-- faz, e a mesma razao pela qual a pilha de avatares de Minhas Tasks conta uma
-- vez por pessoa e nao por etapa. O `distinct` e quem garante.
--
-- E `notificar()` descarta quem escreveu, entao quem comenta nao recebe o
-- proprio comentario -- nao ha `where` a mais aqui para isso.
-- ---------------------------------------------------------------------------
create or replace function public.task_comentarios_avisa()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  demanda record;
  pessoa  uuid;
  quem    text;
begin
  select t.id, t.titulo, t.criado_por, t.publicada_em
    into demanda
    from public.tasks t where t.id = new.task_id;

  -- Comentario em rascunho nao avisa ninguem: o rascunho e de quem o criou, e
  -- nao ha outra pessoa nele para avisar.
  if demanda.publicada_em is null then
    return null;
  end if;

  select p.nome into quem from public.profiles p where p.id = new.autor_id;

  for pessoa in
    select distinct x.quem from (
      select s.responsavel_id as quem
        from public.subtasks s
       where s.task_id = new.task_id and s.responsavel_id is not null
      union
      select demanda.criado_por
    ) x
    where x.quem is not null
  loop
    -- `'task'` E NAO UM VALOR NOVO NO ENUM, e a ausencia e decisao.
    -- `notification_tipo` tem oito valores e o sino desenha um icone por
    -- valor: um `'comentario'` novo sairia sem icone nenhum, porque o mapa da
    -- tela e escrito a mao -- e seria a nona entrada num enum que a 0169 ja
    -- registrou nao distinguir social de campanha. Um comentario numa demanda
    -- E noticia de uma task, e o link leva para ela.
    perform public.notificar(
      pessoa, 'task',
      format('%s comentou em "%s"', coalesce(quem, 'Alguém'), demanda.titulo),
      left(new.texto, 180),
      '/painel/gestao-tasks/' || demanda.id::text
    );
  end loop;

  return null;
end;
$func$;

drop trigger if exists task_comentarios_avisa on public.task_comentarios;
create trigger task_comentarios_avisa
  after insert on public.task_comentarios
  for each row execute function public.task_comentarios_avisa();

comment on function public.task_comentarios_avisa() is
  'Avisa quem esta na demanda quando alguem comenta nela (0098). Uma vez por pessoa e nao por etapa; rascunho nao avisa; e notificar() ja descarta quem escreveu.';


-- ---------------------------------------------------------------------------
-- MEDIDO COM CINCO MUTACOES, contra um Postgres 16 com a bateria inteira:
--
--   tirar o `lote_id is null` do PASSO 1 ........... 1 cenario cai, e ele e o
--                                                    que conta os avisos de um
--                                                    mes de social enviado
--   tirar o trigger do PASSO 1 ..................... 4 cenarios caem
--   tirar o `publicada_em` do PASSO 2 .............. 1 cenario cai
--   tirar o `social_papel is null` do PASSO 2 ...... 1 cenario cai
--   tirar o `distinct` do PASSO 4 .................. 1 cenario cai
--
-- O primeiro e o terceiro sao os que merecem leitura: os dois medem uma
-- AUSENCIA de aviso, que e o tipo de regra que passa despercebida porque o
-- produto continua funcionando -- so passa a tocar o sino mais vezes do que
-- devia, e ninguem abre um chamado por isso.
-- ===========================================================================
