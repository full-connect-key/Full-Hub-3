-- ===========================================================================
-- 0152 - A ETAPA DO WORKFLOW DISPARA EM DIAS DA SEMANA
--
-- Decisao do usuario: *"uma das tarefas da agencia sao os email marketings,
-- preciso que quando eu va montar o workflow, eu possa selecionar quais dias
-- os emails sao disparados, no caso sao 4 por semana, e sempre que eu for
-- abrir, as tasks ja tenham o nome como o dia que ela deve ser postada"*.
--
-- ---------------------------------------------------------------------------
-- A QUANTIDADE NAO MUDA DE SIGNIFICADO, E E ISSO QUE FAZ A MIGRATION SER UMA
-- COLUNA
--
-- `workflow_steps.quantidade` (0140) continua sendo QUANTAS PECAS a etapa
-- entrega. Os dias da semana mudam duas coisas sobre essas mesmas pecas: a
-- DATA de cada uma e o NOME dela. "Vinte e-mails nas segundas, tercas, quintas
-- e sextas" e `quantidade = 20` com `dias_da_semana = {1,2,4,5}`, e a expansao
-- anda o calendario a partir do inicio da janela pegando a proxima ocorrencia
-- de um dia marcado, vinte vezes.
--
-- **Entao nao nasce pergunta nova na hora de aplicar.** O `DialogoDePecas`
-- (0140) ja confirma a quantidade, e o modelo continua sendo sugestao e nao
-- contrato -- a decisao da 0122, que e o pedido da 0140 em quantas palavras.
--
-- DUAS FORMAS FORAM CONSIDERADAS E RECUSADAS:
--
--   * uma coluna `semanas` ao lado. Sao duas colunas novas, e
--     `semanas * cardinality(dias)` e DERIVAVEL -- o que da para calcular nao
--     se guarda, que e a regra desta casa desde `atraso` nao ser coluna.
--   * `quantidade` passar a querer dizer SEMANAS quando ha dia marcado. Dois
--     significados para a mesma coluna, lidos por `pecasDaEtapa()`, pelo
--     dialogo e pela expansao -- o lugar exato onde as duas verdades comecam a
--     divergir.
--
-- O que a tela faz pela conversao e dizer, embaixo do campo, quantas semanas
-- aquele numero cobre. A divisao e da tela e nao do banco.
--
-- ---------------------------------------------------------------------------
-- O VALOR E O DO POSTGRES E O DO NAVEGADOR AO MESMO TEMPO
--
-- 0 = domingo a 6 = sabado, que e `date_part('dow')` e
-- `Date.prototype.getUTCDay()`. Guardar outra convencao obrigaria um de-para
-- em cada ponta, e o de-para e onde elas divergem.
--
-- ---------------------------------------------------------------------------
-- SAO DUAS RECUSAS NOVAS E NAO TRES
--
-- A terceira -- dias da semana e sub-etapas escritas a mao nao convivem -- ja
-- esta coberta pela recusa 7 da 0140, porque a recusa 11 abaixo forca
-- `quantidade >= 2`. E as duas de dependencia (8 e 9) tambem valem de graca,
-- pelo mesmo caminho: uma etapa com dia marcado tem quantidade acima de 1.
--
-- ---------------------------------------------------------------------------
-- E SEM O PASSO 4 A COLUNA SERIA PERDIDA NA MATERIALIZACAO
--
-- `etapasDoWorkflow()` le `etapas_resolvidas_do_workflow` SEMPRE que ha conta
-- -- que e sempre, ao aplicar numa demanda ou numa campanha -- e a leitura crua
-- so em pre-visualizacao. Sem a coluna no `returns table`, os dias existiriam
-- na tabela, apareceriam no editor, e nao chegariam a subtarefa nenhuma: a
-- ponte construida e nunca atravessada, pelo meio. E a mesma frase que a 0140
-- escreveu para a quantidade.
--
-- `database.types.ts` acompanha a mao, porque `check:tipos` NAO confere a
-- forma de um `returns table` recriado: ele liga coluna e parametro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A pergunta do check, num lugar so
--
-- E funcao porque "nao repete nenhum" e uma subconsulta, e o Postgres recusa
-- subconsulta dentro de check constraint -- a forma de `redes_sem_repeticao()`
-- (0082), palavra por palavra.
-- ---------------------------------------------------------------------------
create or replace function public.dias_da_semana_validos(p_dias smallint[])
returns boolean
language plpgsql
immutable
as $$
declare
  distintos integer;
begin
  if p_dias is null then
    return true;
  end if;
  if not (p_dias <@ array[0,1,2,3,4,5,6]::smallint[]) then
    return false;
  end if;
  select count(distinct d) into distintos from unnest(p_dias) as t(d);
  return distintos = cardinality(p_dias);
end;
$$;

comment on function public.dias_da_semana_validos(smallint[]) is
  'Os dias da semana de uma etapa de workflow sao de 0 (domingo) a 6 (sabado) e nao repetem '
  'nenhum (0152). E funcao porque o Postgres recusa subconsulta dentro de check constraint.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A coluna
--
-- `not null default '{}'` e nao nulavel: a lista vazia e o caso comum -- toda
-- etapa que nao e email marketing --, e `cardinality` de um array vazio e 0,
-- entao a pergunta "tem dia marcado?" e uma so em todo lugar. Com nulo ela
-- seria `is not null and cardinality > 0` em cada leitura, e o segundo termo e
-- o que alguem esquece.
-- ---------------------------------------------------------------------------
alter table public.workflow_steps
  add column if not exists dias_da_semana smallint[] not null default '{}'::smallint[];

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workflow_steps_dias_da_semana_validos'
  ) then
    alter table public.workflow_steps
      add constraint workflow_steps_dias_da_semana_validos
      check (public.dias_da_semana_validos(dias_da_semana));
  end if;
end $$;

comment on column public.workflow_steps.dias_da_semana is
  'Em que dias da semana as pecas desta etapa saem -- 0 (domingo) a 6 (sabado), a convencao de '
  'date_part(''dow'') e de getUTCDay(). Vazio (o default) e a etapa de sempre, com as pecas '
  'numeradas "Nome 1".."Nome N". Com dia marcado, as MESMAS `quantidade` pecas ganham uma data '
  'cada, andando o calendario a partir do prazo da etapa (ou do inicio da demanda), e cada uma '
  'leva o nome do dia -- "Segunda, 01/12". A quantidade NAO muda de significado: ela continua '
  'sendo quantas pecas, e os dias so decidem onde elas caem.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - A conferencia do modelo ganha as duas recusas dos dias
--
-- A FUNCAO E COPIADA INTEIRA, que e a licao da 0030: `create or replace` se
-- reescreve a partir do texto de agora e NAO avisa quando o texto novo tem
-- menos coisa que o velho. As nove recusas da 0108 e da 0140 estao abaixo,
-- palavra por palavra -- COPIADAS DO ARQUIVO da 0140 e nao redigitadas, que e
-- a licao da 0128.
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

  -- 10. OS DIAS DA SEMANA SAO DE ETAPA DE TOPO (0152), pela razao da recusa 6:
  --     os disparos nascem como as sub-etapas desta etapa, e uma sub-etapa que
  --     os tivesse precisaria de um terceiro nivel para eles.
  select e.nome into achado
    from public.workflow_steps e
   where e.template_id = any(modelos)
     and cardinality(e.dias_da_semana) > 0
     and e.parent_ordem is not null
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('A sub-etapa "%s" não pode ter dias da semana.', achado.nome);
  end if;

  -- 11. DIA MARCADO PEDE MAIS DE UMA PECA, e e a recusa que impede um segundo
  --     significado para a coluna: com quantidade 1 a etapa NAO vira grupo
  --     (0140), entao os dias passariam a decidir o prazo DELA mesma -- um
  --     calendario escrito num campo que ja tem o `prazo_offset_dias` ao lado.
  select e.nome into achado
    from public.workflow_steps e
   where e.template_id = any(modelos)
     and cardinality(e.dias_da_semana) > 0
     and e.quantidade < 2
   limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" tem dias da semana marcados e entrega uma peça só.', achado.nome),
      hint    = 'Diga quantas peças ela entrega, ou desmarque os dias e use o prazo da etapa.';
  end if;

  return null;
end;
$corpo$;

comment on function public.conferir_etapas_do_workflow() is
  'Confere a arvore de um workflow POR INSTRUCAO: pai existe no mesmo modelo, dois niveis e '
  'nunca tres, etapa com filho nao exige aprovacao nem espera outra etapa, a quantidade (0140) '
  'e de etapa de topo, nao convive com sub-etapa escrita a mao e nao entra em dependencia nos '
  'dois sentidos, e os dias da semana (0152) sao de etapa de topo e pedem mais de uma peca -- '
  'todas elas sao recusas de subtasks_agrupadora (0022) subidas para o modelo, para a recusa '
  'chegar a quem montou o workflow e nao a quem o aplicou.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - A resolucao pela conta passa a carregar os dias
--
-- `drop function` ANTES, e nao `create or replace`: ele nao troca o tipo de
-- retorno de uma funcao `returns table`. E com o `drop` vao os grants, entao o
-- `revoke`/`grant` no fim vem repetido inteiro -- sem ele a funcao nasce com o
-- `execute` que o Postgres concede a `public` sozinho. A licao da 0097,
-- repetida pela 0108, pela 0116 e pela 0140.
--
-- E O `revoke ... from anon` NAO E REDUNDANTE COM O DE `public`, que e a licao
-- da 0142 e foi MEDIDO aqui: o Supabase deixa um `alter default privileges`
-- ligado no schema `public`, entao a funcao recem-criada nasce com `execute`
-- para `anon`, `authenticated` e `service_role` -- e `revoke all from public`
-- nao alcanca nenhum dos tres. Medida a ACL depois de aplicar, `anon=X`
-- continuava la.
--
-- NAO ERA FURO, ERA INCONSISTENCIA, e a distincao e a da 0128: esta funcao nao
-- e `security definer`, e `workflow_steps_select` e `to authenticated` -- ou
-- seja `anon` nao tem policy nenhuma naquela tabela e leria zero linha de
-- qualquer forma. O que o `revoke` faz e a ACL dizer o que o comentario diz, no
-- unico momento em que ela e escrita: um `drop`+`create` a reabriria de
-- qualquer forma.
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
  quantidade         integer,
  dias_da_semana     smallint[]
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
    e.quantidade,
    e.dias_da_semana
  from public.workflow_steps e
  where e.template_id = p_template_id
  order by e.ordem;
end;
$func$;

comment on function public.etapas_resolvidas_do_workflow(uuid, uuid) is
  'As etapas de um workflow com o responsavel resolvido pela conta (0064), o pai de cada uma por '
  'posicao (0108), quantas pecas cada uma entrega (0140) e em que dias da semana elas saem '
  '(0152). A ordem da resolucao e pessoa da etapa -> pessoa da funcao na conta -> ninguem, e '
  'quem saiu da agencia nao vira responsavel.';

revoke all on function public.etapas_resolvidas_do_workflow(uuid, uuid) from public;
revoke all on function public.etapas_resolvidas_do_workflow(uuid, uuid) from anon;
grant execute on function public.etapas_resolvidas_do_workflow(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- CONFERENCIA (cole depois de aplicar)
--
--   select count(*) from information_schema.columns
--    where table_name = 'workflow_steps' and column_name = 'dias_da_semana';    -- 1
--   select count(*) from pg_constraint
--    where conname = 'workflow_steps_dias_da_semana_validos';                   -- 1
--   select count(*) from pg_proc
--    where proname = 'etapas_resolvidas_do_workflow'
--      and prosrc like '%e.dias_da_semana%';                                    -- 1
--   select count(*) from pg_proc
--    where proname = 'conferir_etapas_do_workflow'
--      and prosrc like '%dias da semana marcados%';                             -- 1
--   -- as nove recusas da 0140 continuam de pe depois da copia:
--   select count(*) from pg_proc
--    where proname = 'conferir_etapas_do_workflow'
--      and prosrc like '%entrega várias peças%';                                -- 1
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
