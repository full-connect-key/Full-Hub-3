-- ---------------------------------------------------------------------------
-- 0093 - A CAIXINHA FECHA A FASE, E A FASE NAO SE FECHA POR FORA
--
-- Relato do usuario, com imagem: *"se eu considero completo uma tarefa, ela
-- deve ser considerada pronta, mas se voce reparar, a plataforma permita que
-- voce tique a tarefa, e ao mesmo tempo, clique no botao considerar
-- concluir"*.
--
-- Ele esta certo, e o que a imagem mostra e pior do que a frase diz. Na
-- corrente do mes, a fase "Pauta" aparecia com a caixinha daquela peca MARCADA
-- e com o selo escrito **"Nao iniciada"**, a trinta pixels de distancia. E o
-- cabecalho dizia **"0 de 5 fases do mes"** -- com uma peca da Pauta pronta.
-- Tres fatos sobre a mesma linha, dois deles errados.
--
-- ---------------------------------------------------------------------------
-- A CAUSA E UMA ASSIMETRIA DA 0088, e ela e facil de nao ver.
--
-- Aquela migration criou DOIS caminhos entre a caixinha e o status da fase, e
-- construiu so um: `post_etapa_progresso_reabre` devolve a fase para
-- `em_andamento` quando uma caixinha DESMARCA -- que e o pedido de ajustes do
-- cliente voltando o trabalho. O caminho contrario, o da caixinha que MARCA,
-- nao existia. Entao:
--
--   * marcar as dezoito caixinhas da Pauta nao fechava a Pauta;
--   * marcar a primeira nao a tirava de `nao_iniciada`;
--   * e o status dela continuava sendo escrito A MAO, pelo seletor que a fase
--     tem por ser uma subtarefa comum (0088).
--
-- O resultado e exatamente o que ele descreve: DUAS maneiras de dizer a mesma
-- coisa, nenhuma das duas falando com a outra. Quem marca as caixinhas ve a
-- fase parada; quem clica em "Concluir" fecha uma fase com dezoito pecas em
-- aberto.
--
-- ---------------------------------------------------------------------------
-- O STATUS DA FASE PASSA A SER DERIVADO, e e a regra que o produto ja aplica
-- um nivel acima.
--
-- *"Quem tem filha vira agrupadora"* (0022): no instante em que uma etapa
-- ganha a primeira sub-etapa, o status dela e calculado pelas filhas e o
-- escrito a mao e descartado. `recalcular_status_task()` (0007) faz o mesmo da
-- Task para as folhas. A fase do mes e o terceiro caso do mesmo desenho, e
-- estava sem a trava: as caixinhas sao as folhas dela.
--
-- A conta e a de `progresso_da_etapa()` (0088), que ja existe e ja e a fonte
-- do "12 de 18" na tela -- nao ha segunda conta nascendo aqui:
--
--   nenhuma marcada  -> nao_iniciada
--   algumas          -> em_andamento
--   todas            -> concluida
--
-- **MENOS `aguardando_informacoes` E `em_ajustes`, e a excecao e deliberada.**
-- Os dois dizem alguma coisa que as caixinhas nao sabem dizer -- "esta parado
-- esperando o cliente responder uma duvida", "o cliente pediu ajuste". A
-- contagem nao distingue "ninguem comecou" de "parou esperando", entao
-- sobrescrever esses dois apagaria informacao que alguem escreveu de
-- proposito. O que o trigger faz com eles e so o que a contagem sabe
-- afirmar: com TODAS marcadas, a fase fecha, venha ela de onde vier.
--
-- E A FASE SEM CAIXINHA NENHUMA NAO E TOCADA. Um mes recem-aberto tem as
-- fases e nenhum post; zero de zero e "todas marcadas" em qualquer conta
-- ingenua, e a fase nasceria concluida. E o `count(*) = 0` da campanha que se
-- finaliza sozinha (0051), aqui de novo.
--
-- ---------------------------------------------------------------------------
-- E A OUTRA METADE: A FASE NAO SE FECHA POR FORA.
--
-- Derivar sozinho nao resolve o relato, resolve metade dele -- o seletor de
-- status continuaria oferecendo "Concluida" numa fase com dezoito pecas em
-- aberto, e o clique passaria. Seria a decisao da 0025 invertida: ali o
-- usuario pediu que os sete status da Task fossem marcaveis a mao e
-- `status_manual` passou a travar o recalculo INTEIRO, porque *"aceitar e
-- desfazer calado e pior que recusar com explicacao"*. Aqui o inverso vale
-- pela mesma razao: aceitar `concluida` e o trigger reabrir no proximo
-- `insert` de peca seria a tela desmentindo a si mesma.
--
-- Entao `subtasks_fase_fecha_pelas_caixinhas` RECUSA, e a recusa **conta
-- quantas faltam** -- que e a decisao da 0023: *"esta demanda tem etapa sem
-- aprovacao" manda a pessoa abrir uma por uma; dizer quais e a diferenca
-- entre uma recusa e uma instrucao*. Aqui a lista seria de dezoito nomes de
-- peca, entao o que a frase diz e o NUMERO e onde marcar.
--
-- A dica manda para a tela certa, e e preciso dizer isso: as caixinhas moram
-- no painel do post, dentro do mes, e nao na linha da fase em Minhas Tasks --
-- que e justamente a tela onde o botao "Concluir" aparece.
--
-- ---------------------------------------------------------------------------
-- O QUE NAO MUDA, e vale escrever porque e o que sobra de pe:
--
--   * a caixinha da ENTREGA continua nao se marcando a mao (0088): ela e
--     consequencia da aprovacao daquela peca. Fechar a fase de entrega
--     continua sendo o cliente aprovando as dezoito, uma a uma;
--   * as duas travas de `post_etapa_progresso_regras` continuam inteiras -- o
--     portao anterior e a fase anterior;
--   * o pedido de ajustes continua reabrindo a fase, e agora pelo mesmo
--     caminho que a fecha, em vez de por um trigger so dele.
--
-- `post_etapa_progresso_reabre` E APAGADA, e nao deixada ao lado: ela e
-- metade da conta que a funcao nova faz inteira, e duas funcoes escrevendo o
-- mesmo status sao duas verdades esperando divergir. E a decisao da 0023 com
-- `tasks.exigencia_aprovacao`.
--
-- MEDIDO COM CINCO MUTACOES, no arquivo 21 da bateria:
--
--   * tirar a trava do PASSO 2 (fechar a fase a mao volta a passar) -> 2;
--   * a fase nao fechar sozinha com todas marcadas                  -> 5;
--   * a primeira caixinha nao tirar de `nao_iniciada`               -> 1;
--   * tirar a guarda da fase sem peca nenhuma                       -> 12;
--   * tirar a pergunta antes de escrever (`subtask_liberada`)       -> a
--     bateria ABORTA, e e o resultado mais forte dos cinco: o erro sobe pela
--     marcacao da caixinha, que e a acao de quem clicou.
--
-- E A TERCEIRA MUTACAO SO DERRUBA UM CENARIO PORQUE A PRIMEIRA VERSAO DELE
-- MEDIA NADA. Eu havia posto a afirmacao logo depois da primeira caixinha da
-- Pauta -- e a Pauta ja estava em `em_andamento` desde a secao 3 do arquivo,
-- onde alguem a comeca a mao. O cenario passava com o ramo ligado E
-- desligado. Quem mede e o Conteudo, que comeca de verdade em
-- `nao_iniciada`, depois de a Pauta fechar. E a licao do `select` antes do
-- `insert` na idempotencia da recorrencia: um teste que nao separa a resposta
-- certa da errada e um teste que afirma sem provar.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - O STATUS DA FASE SAI DAS CAIXINHAS
-- ---------------------------------------------------------------------------
create or replace function public.fase_acompanha_as_caixinhas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo    uuid := coalesce(new.subtask_id, old.subtask_id);
  feitos  integer;
  total   integer;
  atual   public.subtask_status;
  destino public.subtask_status;
begin
  if alvo is null then
    return null;
  end if;

  select p.feitos, p.total into feitos, total
    from public.progresso_da_etapa(alvo) p;

  -- FASE SEM PECA NENHUMA NAO E TOCADA. Zero de zero e "todas marcadas" em
  -- qualquer conta ingenua, e o mes recem-aberto nasceria com as cinco fases
  -- concluidas. E o `count(*) = 0` da campanha que se finaliza sozinha.
  if coalesce(total, 0) = 0 then
    return null;
  end if;

  select s.status into atual from public.subtasks s where s.id = alvo;
  if not found then
    return null;
  end if;

  if feitos = total then
    destino := 'concluida';
  elsif atual = 'concluida' then
    -- DE VOLTA AO TRABALHO, e nao para `nao_iniciada`: a fase foi feita e vai
    -- ser refeita em alguma peca. E a mesma linha de
    -- `etapa_acompanha_o_entregavel` (0052).
    destino := 'em_andamento';
  elsif feitos > 0 and atual = 'nao_iniciada' then
    destino := 'em_andamento';
  elsif feitos = 0 and atual = 'em_andamento' then
    -- E A VOLTA PARA `nao_iniciada` SO SAI DE `em_andamento`. Desmarcar a
    -- ultima caixinha de uma fase que esta em `em_ajustes` nao a devolve para
    -- "nao iniciada": o pedido do cliente continua de pe, e e ele o fato.
    destino := 'nao_iniciada';
  else
    return null;
  end if;

  if destino = atual then
    return null;
  end if;

  -- A MUDANCA E TENTADA, E NUNCA DERRUBA A MARCACAO DA CAIXINHA. E a linha de
  -- `etapa_acompanha_o_entregavel` (0052) letra por letra: *"o trigger esta do
  -- outro lado, sem ninguem por perto -- se a conclusao da etapa fosse
  -- recusada, o que a pessoa veria era a acao DELA falhando, com uma mensagem
  -- sobre uma coisa que ela nem sabe que existe"*.
  --
  -- A trava que recusa de verdade e a 2 de `validar_transicao_de_subtarefa`: a
  -- corrente do social e SERIAL, as fases dependem umas das outras, e sair de
  -- `nao_iniciada` com a anterior aberta e recusado. Foi a bateria que mostrou
  -- -- um cenario do arquivo 39 estourou com *"A subtarefa 'Conteudo' esta
  -- aguardando: Pauta"* vindo de dentro deste trigger, numa tela que estava
  -- marcando uma caixinha.
  --
  -- E A PERGUNTA VEM ANTES, em vez de um `exception when others` em volta: o
  -- bloco engoliria tambem o erro que ninguem previu, e um trigger que engole
  -- erro e um trigger em que nao se confia. E a forma da 0061.
  --
  -- Nesse caso a fase fica como esta, que e a verdade: a corrente nao chegou
  -- nela ainda.
  if atual = 'nao_iniciada' and not public.subtask_liberada(alvo) then
    return null;
  end if;

  update public.subtasks set status = destino where id = alvo;

  return null;
end;
$$;

comment on function public.fase_acompanha_as_caixinhas() is
  'O status da fase do mes de social sai das caixinhas dela (0093): nenhuma marcada e nao_iniciada, algumas e em_andamento, todas e concluida. `aguardando_informacoes` e `em_ajustes` so sao sobrescritos quando TODAS fecham -- os dois dizem algo que a contagem nao sabe dizer.';

drop trigger if exists post_etapa_progresso_reabre on public.post_etapa_progresso;
drop function if exists public.post_etapa_progresso_reabre();

drop trigger if exists post_etapa_progresso_move_a_fase on public.post_etapa_progresso;
create trigger post_etapa_progresso_move_a_fase
  after insert or update of concluido or delete on public.post_etapa_progresso
  for each row execute function public.fase_acompanha_as_caixinhas();


-- ---------------------------------------------------------------------------
-- PASSO 2 - E A FASE NAO SE FECHA POR FORA
--
-- `before update` e nao `after`: a recusa precisa impedir a escrita, nao
-- desfaze-la depois -- desfazer calado e o que a 0025 chama de pior que
-- recusar.
--
-- A trava olha SO a transicao para `concluida`, como
-- `tasks_entregue_exige_cada_etapa` (0023) olha so a transicao para
-- `entregue`. Corrigir o titulo de uma fase ja concluida, mexer no prazo dela
-- ou o proprio trigger do PASSO 1 fechando-a continuam passando: uma trava
-- que freasse tudo seria trocada por outro caminho na primeira semana.
-- ---------------------------------------------------------------------------
create or replace function public.subtasks_fase_fecha_pelas_caixinhas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  feitos integer;
  total  integer;
begin
  if new.social_papel is null then
    return new;
  end if;
  if new.status <> 'concluida' or old.status = 'concluida' then
    return new;
  end if;

  select p.feitos, p.total into feitos, total
    from public.progresso_da_etapa(new.id) p;

  if coalesce(total, 0) = 0 or feitos = total then
    return new;
  end if;

  raise exception using
    errcode = 'check_violation',
    message = format('A fase "%s" ainda tem %s de %s peças por marcar.',
                     new.titulo, total - feitos, total),
    hint    = 'Ela fecha sozinha quando a última peça for marcada, no painel de cada post dentro do mês.';
end;
$$;

comment on function public.subtasks_fase_fecha_pelas_caixinhas() is
  'A fase do mes de social nao se marca concluida a mao (0093): ela fecha quando a ultima caixinha fecha. A recusa conta quantas faltam e diz onde marca-las -- dizer so "nao pode" devolve a pessoa a tela sem o caminho.';

drop trigger if exists subtasks_fase_fecha_pelas_caixinhas on public.subtasks;
create trigger subtasks_fase_fecha_pelas_caixinhas
  before update of status on public.subtasks
  for each row execute function public.subtasks_fase_fecha_pelas_caixinhas();


-- ---------------------------------------------------------------------------
-- PASSO 3 - AS FASES QUE JA ESTAO ABERTAS
--
-- Sem esta passada, todo mes aberto antes da 0093 fica com o status que tem
-- hoje -- e ele esta errado nos dois sentidos: fase com caixinhas marcadas
-- parada em `nao_iniciada` (que e o print do usuario), e fase fechada a mao
-- com peca em aberto. A migration nao inventa nada: ela aplica a mesma conta
-- do PASSO 1.
--
-- `aguardando_informacoes` e `em_ajustes` ficam como estao, menos quando
-- todas as caixinhas fecharam -- a mesma regra do trigger, para a passada nao
-- ser uma quarta verdade.
-- ---------------------------------------------------------------------------
do $$
declare
  mexidas integer := 0;
begin
  with contagem as (
    select s.id,
           s.status,
           count(g.*) filter (where g.concluido) as feitos,
           count(g.*)                            as total
      from public.subtasks s
      join public.post_etapa_progresso g on g.subtask_id = s.id
     where s.social_papel is not null
     group by s.id, s.status
  ),
  alvo as (
    select c.id,
           case
             when c.feitos = c.total then 'concluida'::public.subtask_status
             when c.status = 'concluida' then 'em_andamento'::public.subtask_status
             when c.feitos > 0 and c.status = 'nao_iniciada' then 'em_andamento'::public.subtask_status
             when c.feitos = 0 and c.status = 'em_andamento' then 'nao_iniciada'::public.subtask_status
             else c.status
           end as novo,
           c.status as velho
      from contagem c
  )
  update public.subtasks s
     set status = a.novo
    from alvo a
   where s.id = a.id
     and a.novo is distinct from a.velho;

  get diagnostics mexidas = row_count;
  raise notice '0093: % fase(s) de social tiveram o status corrigido pelas caixinhas.', mexidas;
end;
$$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- COMO CONFERIR, depois de aplicar -- nenhuma linha deve voltar:
--
--   select s.id, s.titulo, s.status,
--          count(g.*) filter (where g.concluido) as feitos, count(g.*) as total
--     from public.subtasks s
--     join public.post_etapa_progresso g on g.subtask_id = s.id
--    where s.social_papel is not null
--    group by s.id, s.titulo, s.status
--   having (count(g.*) filter (where g.concluido) = count(g.*)) <> (s.status = 'concluida');
-- ---------------------------------------------------------------------------
