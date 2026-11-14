-- ---------------------------------------------------------------------------
-- 0140 - A ETAPA DO WORKFLOW ENTREGA N PECAS
--
-- Decisao do usuario, nas palavras dele:
--
--   "Preciso conseguir no Workflow, quando monto uma etapa, definir quantas
--    pecas vao precisar ser entregues, ja que por exemplo, em um mes, podem
--    ter 50 produtos e no outro 80 produtos"
--
-- A SEGUNDA METADE DA FRASE DECIDE O DESENHO, e sem ela a leitura obvia esta
-- errada. "Definir quantas pecas" soa como um numero gravado no modelo; "em um
-- mes 50 e no outro 80" diz o contrario -- um numero FIXO no modelo estaria
-- errado em metade dos meses, e corrigi-lo a cada mes mudaria o modelo para
-- toda conta que o usa, porque `regravarEtapas()` reescreve a cadeia inteira a
-- cada salvamento.
--
-- Entao a coluna e a SUGESTAO e quem aplica confirma -- a forma de
-- `periodosSugeridosDoFluxo()` e a decisao escrita da 0122: "o modelo e ponto
-- de partida, nao contrato".
--
-- ---------------------------------------------------------------------------
-- ISTO REVERTE UMA PREMISSA DECLARADA, e ela esta escrita em DOIS lugares
--
-- A 0108 escreveu, justificando por que `campaign_templates` nao foi
-- aposentada: "a Wave guarda `quantidade` -- 'Feed/Storys, 15' --, que e
-- quantas pecas iguais nascem, e `workflow_steps` nao tem coluna para isso nem
-- deve ter (a etapa de um workflow e UM trabalho)". E o seletor da nova
-- campanha repete a frase em comentario: "a quantidade de Feed/Storys que
-- `workflow_steps` nao tem coluna para expressar".
--
-- **A premissa era "a etapa e UM trabalho", e a 0108 ela mesma a desfez** ao
-- dar o segundo nivel ao modelo: desde ela uma etapa PODE agrupar, e uma etapa
-- que agrupa nao e um trabalho -- e a agrupadora da 0022, cujo relogio nao
-- corre e cujo status as filhas calculam. A quantidade nao cria um conceito
-- novo: ela diz quantas filhas iguais nascem, que e exatamente o que
-- `arvoreDaComposicao()` (0122) ja faz com `campaign_composicao`.
--
-- **E `campaign_templates` CONTINUA de pe.** A razao dela deixou de ser a
-- quantidade e passou a ser outra, que a 0108 tambem escreveu: a Wave guarda
-- o TIPO de cada peca (estatico, carrossel, video), e `workflow_steps` nao
-- guarda tipo de material nenhum -- e ela nao deve guardar, porque tipo de
-- material e propriedade da PECA (0122) e nao do passo de trabalho.
--
-- ---------------------------------------------------------------------------
-- QUANTIDADE 1 NAO VIRA GRUPO, que e a decisao da 0122 palavra por palavra
--
-- O default e 1, e com 1 nada muda: a etapa materializa como materializava.
-- Um grupo "Landing page" com um filho "Landing page 1" e um nivel de recuo
-- que nao diz nada -- e, pior, faz a etapa virar agrupadora, cujo relogio nao
-- corre e cujo status e calculado por uma filha so.
--
-- Com 2 ou mais a etapa vira AGRUPADORA e as pecas sao as filhas, nomeadas
-- "Nome 1" ... "Nome N". O nome e o que a pessoa escreveu, repetido com o
-- numero: nao ha singular a derivar, que e a armadilha do "Carrossei 1" que o
-- `SINGULAR_DO_TIPO` da 0122 existe para evitar.
--
-- ---------------------------------------------------------------------------
-- O QUE A MAE PERDE E O QUE ELA PASSA AS PECAS
--
-- E a 0022 um nivel acima, e ela ja respondeu isto: quem entrega e a folha.
-- Responsavel, prazo, prioridade e APROVACAO viajam para cada peca; a mae fica
-- com o nome.
--
-- **A aprovacao viaja, e NAO e recusada** -- e aqui a quantidade e diferente do
-- `parent_ordem`. A 0108 recusa aprovacao numa etapa com sub-etapas porque as
-- sub-etapas sao escritas a mao e cada uma diz a sua: a da mae seria ambigua.
-- Com a quantidade as filhas sao N copias da MESMA etapa, entao o que a etapa
-- diz E o que cada peca diz. "50 produtos, cada um com aval do cliente" e uma
-- frase util, e o produto a aceita.
--
-- **A dependencia NAO viaja, e e recusada nos dois sentidos**, porque
-- `recusar_dependencia_de_agrupadora` (0022) recusa a agrupadora que espera E a
-- agrupadora que e esperada. Espalhar a dependencia pelas 50 filhas seria uma
-- segunda regra que ninguem pediu, e `aplicarWorkflowNaTask` liga dependencia
-- so entre etapas de TOPO -- o vinculo sumiria em silencio, porque aquele
-- `insert` avisa em vez de derrubar (a decisao da 0052).
--
-- ---------------------------------------------------------------------------
-- O TETO E 200, E O NUMERO TEM RAZAO
--
-- `abrir_mes_de_social` RECUSA acima de 60 "porque o numero e digitado, e um
-- zero a mais e erro de digitacao", e aquele teto e de um mes de social. Aqui
-- 60 recusaria o caso que motivou o pedido: ele disse 80. 200 aceita os 80 com
-- folga e continua pegando o zero a mais (800).
--
-- **Nao ha teto para o TOTAL da demanda**, e a ausencia e dita: tres etapas de
-- 200 dao 600 subtarefas, e esse numero e decisao de quem monta o mes, nao do
-- produto. O teto que vale e o do erro de digitacao, e ele e por etapa.
--
-- ---------------------------------------------------------------------------
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A coluna
-- ---------------------------------------------------------------------------
alter table public.workflow_steps
  add column if not exists quantidade integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'workflow_steps_quantidade_valida'
       and conrelid = 'public.workflow_steps'::regclass
  ) then
    alter table public.workflow_steps
      add constraint workflow_steps_quantidade_valida
      check (quantidade between 1 and 200);
  end if;
end $$;

comment on column public.workflow_steps.quantidade is
  'Quantas pecas iguais esta etapa entrega. 1 (o default) e a etapa de sempre; 2 ou mais faz '
  'ela virar AGRUPADORA na hora de aplicar, com N filhas "Nome 1".."Nome N" -- a forma de '
  'arvoreDaComposicao() (0122). E SUGESTAO e nao contrato: quem aplica confirma o numero, '
  'porque "em um mes podem ter 50 produtos e no outro 80". Teto 200: aceita os 80 do pedido e '
  'continua pegando o zero a mais.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A conferencia do modelo ganha as quatro recusas da quantidade
--
-- A FUNCAO E COPIADA INTEIRA, que e a licao da 0030: `create or replace` se
-- reescreve a partir do texto de agora e NAO avisa quando o texto novo tem
-- menos coisa que o velho -- foi assim que a 0030 perdeu o bloco de carimbos
-- de `validar_transicao_de_subtarefa` e so apareceu na 0052. As cinco recusas
-- da 0108 estao abaixo, palavra por palavra.
-- ---------------------------------------------------------------------------
create or replace function public.conferir_etapas_do_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $corpo$
declare
  modelos uuid[];
  achado  record;
begin
  if tg_op = 'DELETE' then
    select array_agg(distinct template_id) into modelos from antigas;
  else
    select array_agg(distinct template_id) into modelos from novas;
  end if;

  if modelos is null then
    return null;
  end if;

  -- 1. A etapa nao e sub-etapa dela mesma. Vem primeiro porque e o caso mais
  --    degenerado: as outras travas leriam esta linha como "o pai existe".
  select e.nome into achado
    from public.workflow_steps e
   where e.template_id = any(modelos)
     and e.parent_ordem is not null
     and e.parent_ordem = e.ordem
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" não pode ser sub-etapa dela mesma.', achado.nome);
  end if;

  -- 2. O pai existe, e no mesmo modelo.
  select e.nome into achado
    from public.workflow_steps e
   where e.template_id = any(modelos)
     and e.parent_ordem is not null
     and not exists (
       select 1 from public.workflow_steps p
        where p.template_id = e.template_id
          and p.ordem = e.parent_ordem)
   limit 1;
  if found then
    raise exception using
      errcode = 'foreign_key_violation',
      message = format('A etapa de cima de "%s" não está neste workflow.', achado.nome),
      hint    = 'A sub-etapa mora dentro de uma etapa do mesmo workflow.';
  end if;

  -- 3. DOIS NIVEIS, NUNCA TRES.
  select e.nome as filho, p.nome as pai into achado
    from public.workflow_steps e
    join public.workflow_steps p
      on p.template_id = e.template_id and p.ordem = e.parent_ordem
   where e.template_id = any(modelos)
     and e.parent_ordem is not null
     and p.parent_ordem is not null
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('"%s" já é uma sub-etapa, e sub-etapa não recebe sub-etapa.', achado.pai),
      hint    = format('São dois níveis no workflow. Ponha "%s" direto na etapa de cima.', achado.filho);
  end if;

  -- 4. Etapa com sub-etapa nao exige aprovacao. A 0022 um nivel acima: quem
  --    entrega e a folha, e `subtasks_agrupadora` RECUSA a filha de uma etapa
  --    que pede aval -- a recusa chegaria na hora de aplicar.
  select p.nome into achado
    from public.workflow_steps p
   where p.template_id = any(modelos)
     and p.requer_aprovacao
     and exists (
       select 1 from public.workflow_steps f
        where f.template_id = p.template_id
          and f.parent_ordem = p.ordem)
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" tem sub-etapas e por isso não pode exigir aprovação.', achado.nome),
      hint    = 'Marque a aprovação nas sub-etapas, que são quem entrega.';
  end if;

  -- 5. Etapa com sub-etapa nao espera outra etapa, pela mesma razao: quem
  --    espera e a folha, e o banco recusa a mae que depende de alguem.
  select p.nome into achado
    from public.workflow_steps p
   where p.template_id = any(modelos)
     and p.depende_de_ordem is not null
     and exists (
       select 1 from public.workflow_steps f
        where f.template_id = p.template_id
          and f.parent_ordem = p.ordem)
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" tem sub-etapas e por isso não pode esperar outra etapa.', achado.nome),
      hint    = 'Marque a dependência nas sub-etapas, que são quem espera.';
  end if;

  -- 6. A QUANTIDADE E DE ETAPA DE TOPO (0140). Uma sub-etapa que entrega N
  --    pecas precisaria de um terceiro nivel para elas, e
  --    `subtasks_agrupadora` (0022) recusa a neta -- a recusa chegaria na hora
  --    de aplicar, falando de subtarefa, sobre um workflow montado semanas
  --    antes.
  select e.nome into achado
    from public.workflow_steps e
   where e.template_id = any(modelos)
     and e.quantidade > 1
     and e.parent_ordem is not null
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('A sub-etapa "%s" não pode entregar mais de uma peça.', achado.nome),
      hint    = 'A quantidade é da etapa de topo: as peças nascem como as sub-etapas dela.';
  end if;

  -- 7. A QUANTIDADE E AS SUB-ETAPAS SAO A MESMA COISA, e por isso nao convivem:
  --    as pecas NASCEM como sub-etapas, entao 50 pecas mais tres sub-etapas
  --    escritas a mao seriam 53 filhas com dois significados dentro do mesmo
  --    grupo.
  select p.nome into achado
    from public.workflow_steps p
   where p.template_id = any(modelos)
     and p.quantidade > 1
     and exists (
       select 1 from public.workflow_steps f
        where f.template_id = p.template_id
          and f.parent_ordem = p.ordem)
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" já tem sub-etapas, então ela não pode também entregar várias peças.', achado.nome),
      hint    = 'As peças nascem como as sub-etapas desta etapa: ou a quantidade, ou as sub-etapas escritas à mão.';
  end if;

  -- 8. ETAPA QUE ENTREGA N PECAS NAO ESPERA OUTRA, porque ela vira agrupadora
  --    e `recusar_dependencia_de_agrupadora` (0022) recusa a mae que espera.
  select e.nome into achado
    from public.workflow_steps e
   where e.template_id = any(modelos)
     and e.quantidade > 1
     and e.depende_de_ordem is not null
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" entrega várias peças e por isso não pode esperar outra etapa.', achado.nome),
      hint    = 'A espera é de cada peça. Tire a dependência, ou deixe a etapa entregando uma peça só.';
  end if;

  -- 9. E NEM E ESPERADA, que e o outro sentido da mesma recusa de 0022 -- e e
  --    o sentido que passa batido: sem esta trava o vinculo seria recusado na
  --    hora de aplicar, e aquele `insert` AVISA em vez de derrubar (0052),
  --    entao a dependencia sumiria com as etapas de pe.
  select e.nome as esperada, d.nome as esperando into achado
    from public.workflow_steps d
    join public.workflow_steps e
      on e.template_id = d.template_id and e.ordem = d.depende_de_ordem
   where d.template_id = any(modelos)
     and d.depende_de_ordem is not null
     and e.quantidade > 1
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('"%s" não pode esperar a etapa "%s": ela entrega várias peças.', achado.esperando, achado.esperada),
      hint    = 'A espera é de cada peça, e o produto não tem como dizer "espere todas". Tire a dependência.';
  end if;

  return null;
end;
$corpo$;

comment on function public.conferir_etapas_do_workflow() is
  'Confere a arvore de um workflow POR INSTRUCAO: pai existe no mesmo modelo, dois niveis e '
  'nunca tres, etapa com filho nao exige aprovacao nem espera outra etapa, e a quantidade (0140) '
  'e de etapa de topo, nao convive com sub-etapa escrita a mao e nao entra em dependencia nos '
  'dois sentidos -- todas elas sao recusas de subtasks_agrupadora (0022) subidas para o modelo, '
  'para a recusa chegar a quem montou o workflow e nao a quem o aplicou.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - A resolucao pela conta passa a carregar a quantidade
--
-- `drop function` ANTES, e nao `create or replace`: ele nao troca o tipo de
-- retorno de uma funcao `returns table`. E com o `drop` vao os grants, entao o
-- `grant` no fim e obrigatorio -- sem ele a funcao nasce com o `execute` que o
-- Postgres concede a `public` sozinho. A licao da 0097, repetida pela 0108 e
-- pela 0116.
--
-- E SEM ESTE PASSO A COLUNA NAO CHEGARIA A TELA NO CAMINHO QUE IMPORTA:
-- `etapasDoWorkflow()` le a RPC quando ha conta -- que e sempre, ao aplicar
-- numa demanda ou numa campanha -- e a leitura crua so em pre-visualizacao.
-- A quantidade existiria na tabela, apareceria no editor, e seria perdida na
-- hora de materializar: a ponte construida e nunca atravessada, pelo meio.
--
-- `database.types.ts` acompanha, porque `check:tipos` NAO confere a forma de
-- um `returns table` recriado: ele liga coluna e parametro.
-- ---------------------------------------------------------------------------
drop function if exists public.etapas_resolvidas_do_workflow(uuid, uuid);

create function public.etapas_resolvidas_do_workflow(
  p_template_id uuid,
  p_client_id   uuid
)
returns table (
  ordem              integer,
  nome               text,
  responsavel_id     uuid,
  funcao_padrao      public.team_funcao,
  funcao_sem_dono    public.team_funcao,
  prioridade         public.task_prioridade,
  prazo_offset_dias  integer,
  requer_aprovacao   boolean,
  tipo_aprovacao     public.tipo_aprovacao,
  depende_de_ordem   integer,
  parent_ordem       integer,
  quantidade         integer
)
language plpgsql
stable
set search_path = public
as $func$
begin
  return query
  select
    e.ordem,
    e.nome,
    -- A ORDEM E A DECISAO DA 0064, e ela nao muda aqui: pessoa escrita na
    -- etapa, depois quem exerce aquela funcao nesta conta, depois ninguem. E
    -- quem saiu da agencia nao vira responsavel, nem estando gravado na etapa.
    coalesce(
      case
        when e.responsavel_padrao_id is not null
         and not public.pessoa_desligada(e.responsavel_padrao_id)
        then e.responsavel_padrao_id
      end,
      case
        when e.funcao_padrao is not null then (
          select d.user_id
            from public.client_function_defaults d
           where d.client_id = p_client_id
             and d.funcao = e.funcao_padrao
             and not public.pessoa_desligada(d.user_id)
           limit 1
        )
      end
    ) as responsavel_id,
    e.funcao_padrao,
    -- A FUNCAO QUE FICOU SEM DONO, para a tela nomear o que faltou em vez de
    -- dizer "ha etapa sem responsavel" -- a decisao da 0023.
    case
      when e.funcao_padrao is not null
       and coalesce(
             case
               when e.responsavel_padrao_id is not null
                and not public.pessoa_desligada(e.responsavel_padrao_id)
               then e.responsavel_padrao_id
             end,
             case
               when e.funcao_padrao is not null then (
                 select d.user_id
                   from public.client_function_defaults d
                  where d.client_id = p_client_id
                    and d.funcao = e.funcao_padrao
                    and not public.pessoa_desligada(d.user_id)
                  limit 1
               )
             end
           ) is null
      then e.funcao_padrao
    end as funcao_sem_dono,
    e.prioridade,
    e.prazo_offset_dias,
    e.requer_aprovacao,
    e.tipo_aprovacao,
    e.depende_de_ordem,
    e.parent_ordem,
    e.quantidade
  from public.workflow_steps e
  where e.template_id = p_template_id
  order by e.ordem;
end;
$func$;

comment on function public.etapas_resolvidas_do_workflow(uuid, uuid) is
  'As etapas de um workflow com o responsavel resolvido pela conta (0064), o pai de cada uma por '
  'posicao (0108) e quantas pecas cada uma entrega (0140). A ordem da resolucao e pessoa da '
  'etapa -> pessoa da funcao na conta -> ninguem, e quem saiu da agencia nao vira responsavel.';

revoke all on function public.etapas_resolvidas_do_workflow(uuid, uuid) from public;
grant execute on function public.etapas_resolvidas_do_workflow(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- CONFERENCIA (cole depois de aplicar)
--
--   select count(*) from information_schema.columns
--    where table_name = 'workflow_steps' and column_name = 'quantidade';        -- 1
--   select count(*) from pg_constraint
--    where conname = 'workflow_steps_quantidade_valida';                        -- 1
--   select count(*) from pg_proc
--    where proname = 'etapas_resolvidas_do_workflow'
--      and prosrc like '%e.quantidade%';                                        -- 1
--   select count(*) from pg_proc
--    where proname = 'conferir_etapas_do_workflow'
--      and prosrc like '%entrega várias peças%';                                -- 1
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
