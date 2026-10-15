-- ---------------------------------------------------------------------------
-- 0108 - A ETAPA DO WORKFLOW TEM SUB-ETAPA, E O WORKFLOW SE APLICA NA CAMPANHA
--
-- Decisao do usuario, nas palavras dele:
--
--   "quando crio um workflow, ele nao esta permitindo que eu aplique ela na
--    campanha. E tambem preciso poder colocar uma subtarefa, na etapa do
--    workflow, para ele ja aparecer montado completo"
--
-- Sao dois pedidos e UMA mudanca, e a frase que os junta e a segunda:
-- "montado completo". O que a campanha precisa de um modelo e exatamente uma
-- arvore de dois niveis -- grupo e sub-item --, que e o que
-- `deliverables_dois_niveis` (0033) aceita; o workflow so sabia cadeia reta.
-- Dando o segundo nivel ao workflow, ele passa a poder descrever a estrutura
-- de uma campanha, e e por isso que a tela de abrir campanha pode oferece-lo
-- ao lado dos modelos de campanha.
--
-- ---------------------------------------------------------------------------
-- O QUE ESTAVA ERRADO NA TELA DA CAMPANHA, e e a metade que nao e de banco
--
-- "Partir de um modelo" le `campaign_templates`, que e OUTRA tabela -- uma
-- arvore em `jsonb`, com as tres que a 0033 semeou (a Wave, o mes de social e
-- a vazia) -- e **nenhuma tela do produto cria uma**: so existe o leitor,
-- `templatesDeCampanha()`. Quem monta uma cadeia de etapas no Full Hub monta
-- um WORKFLOW, em Gestao de Tasks, e aquele seletor nunca o listou. O usuario
-- fez a unica coisa que o produto oferece e ela nao chegava onde ele precisava.
--
-- **AS DUAS TABELAS FICAM, e `campaign_templates` NAO e aposentada**, o que e
-- o contrario da decisao da 0023. A razao e que elas nao dizem a mesma coisa:
-- a Wave guarda `quantidade` -- "Feed/Storys, 15" --, que e quantas pecas
-- iguais nascem, e `workflow_steps` nao tem coluna para isso nem deve ter (a
-- etapa de um workflow e UM trabalho). Apagar a Wave para unificar o seletor
-- destruiria a estrutura mais usada da casa para arrumar uma lista. O que
-- muda e o seletor passar a oferecer as DUAS origens, agrupadas e nomeadas.
--
-- ---------------------------------------------------------------------------
-- `parent_ordem` E POSICAO, NUNCA UUID, e isso nao e preferencia
--
-- `regravarEtapas()` APAGA e REINSERE a cadeia inteira a cada salvamento --
-- "elas nao tem vida propria fora do modelo", esta escrito la. Um `parent_id`
-- uuid nao sobrevive a isso: o pai de hoje tem outro id amanha, e o filho
-- ficaria apontando para uma linha que nao existe mais.
--
-- E o produto ja tomou esta decisao duas vezes: `depende_de_ordem` e posicao
-- desde a 0007, e `modeloDeUmaTask()` a escreve por extenso -- "a dependencia
-- nao viaja: ela aponta para uuid e o modelo grava posicao". `ordem` e unico
-- por modelo (`unique (template_id, ordem)`), entao a posicao endereca uma
-- etapa e uma so.
--
-- ---------------------------------------------------------------------------
-- SAO DOIS NIVEIS NO MODELO, E A RAZAO E MECANICA
--
-- Nao e a razao de estilo das outras arvores da casa ("arvore de quatro
-- niveis e arvore que ninguem acompanha"): e que o workflow MATERIALIZA
-- subtarefa, e a subtarefa tem TRES niveis desde a 0022 -- demanda, etapa,
-- sub-etapa. A etapa do workflow nasce como etapa; o filho dela nasce como
-- sub-etapa; um neto no modelo nao teria onde nascer, porque
-- `subtasks_agrupadora` recusa o neto da etapa com "sub-etapa nao recebe
-- sub-etapa". Um terceiro nivel aqui seria um modelo que o banco recusa
-- aplicar -- e a recusa chegaria na tela de quem clicou em aplicar, falando de
-- subtarefa, sobre um workflow que ele montou semanas antes.
--
-- ---------------------------------------------------------------------------
-- AS DUAS TRAVAS QUE SALVAM A APLICACAO, e elas sao a 0022 um nivel acima
--
-- `subtasks_agrupadora` RECUSA -- nao descarta, recusa -- a filha de uma etapa
-- que exige aprovacao, e a filha de uma etapa que espera outra:
--
--   "A etapa X exige aprovacao e por isso nao pode virar agrupadora."
--   "A etapa X espera outra etapa e por isso nao pode virar agrupadora."
--
-- Um workflow com uma etapa que pede aval E tem filhos e um workflow que o
-- banco recusa materializar. Sem trava no MODELO, isso e descoberto no dia em
-- que alguem aplica -- com a demanda ja criada, as etapas antigas ja apagadas
-- (`aplicarWorkflowNaTask` apaga antes de inserir) e a mensagem falando de uma
-- regra de subtarefa. Entao a recusa sobe para ca, onde o erro foi cometido, e
-- ela NOMEIA a etapa e diz onde marcar -- a decisao da 0023.
--
-- **E as duas regras de 0022 que NAO sobem sao as que nao recusam:** o relogio
-- que nao corre na mae, o status calculado pelas filhas e a soma que conta so
-- as folhas acontecem sozinhos depois de materializado, porque a etapa do mes
-- e uma subtarefa comum. Nao ha nada a conferir no modelo.
--
-- ---------------------------------------------------------------------------
-- A TRAVA E POR INSTRUCAO, e o que isso compra foi MEDIDO
--
-- A pergunta e sobre o CONJUNTO -- "este filho tem pai?" --, e
-- `regravarEtapas()` grava a cadeia inteira num `insert` so. E a forma de
-- `conferir_fluxo_de_social()` (0087), que responde uma pergunta do mesmo
-- tipo.
--
-- **E A PRIMEIRA RAZAO QUE EU ESCREVI AQUI ESTAVA ERRADA, e fica registrada
-- porque ela e a tentadora:** eu havia escrito que um gatilho `for each row`
-- "nao veria o pai que entra na mesma instrucao e recusaria todo filho de todo
-- workflow". Isso vale para um gatilho BEFORE, e nao para este -- no Postgres
-- os gatilhos AFTER por linha sao enfileirados e disparam no FIM da instrucao,
-- quando todas as linhas dela ja estao visiveis. **A mutacao provou: trocando
-- as tres por `for each row`, ZERO cenarios caem.**
--
-- O que a forma por instrucao compra, entao, nao e correcao: e CUSTO -- a
-- conferencia roda uma vez por `insert` em vez de uma vez por etapa, e uma
-- cadeia de vinte etapas faria as cinco consultas vinte vezes -- e ser a mesma
-- forma da 0087 para a mesma classe de pergunta. O zero e o que prova que esta
-- frase e honesta, como o `where` da capacidade na 0081.
--
-- **E AQUI UM LACO FUNCIONA, ao contrario da 0087, desde que o pai venha
-- primeiro.** La a trava e "existe exatamente UMA entrega", e a primeira etapa
-- de um modelo novo nao a satisfaz sozinha -- entao a consequencia era "um
-- fluxo e gravado de uma vez". As travas daqui sao todas da forma "SE existe
-- filho, entao...", e um `insert` de pai seguido de um `insert` de filho passa
-- pelas duas instrucoes. O que o laco nao pode e inverter a ordem: o filho
-- sozinho leva a recusa de que o pai nao esta no modelo. A bateria guarda os
-- dois sentidos.
--
-- `deferrable initially deferred` seria a forma obvia e foi recusada pela
-- mesma razao da 0087: constraint diferida dispara no COMMIT da transacao de
-- cima, e nao no fim do bloco onde `teste.recusa_com` espera a recusa -- a
-- trava existiria e a bateria nao teria como medi-la.
--
-- **E ela confere o DELETE tambem**, pelo template das linhas que sairam:
-- apagar um pai a mao deixaria os filhos apontando para uma posicao vazia.
-- Quando `regravarEtapas()` apaga o modelo inteiro nao sobra linha nenhuma, e
-- um modelo sem etapa e valido -- entao a conferencia passa sozinha.
--
-- ---------------------------------------------------------------------------
-- MEDIDO COM SETE MUTACOES, sobre 2245 cenarios
--
--   tirar a trava do pai de si mesmo ........................  1 cenario
--   tirar a trava do pai inexistente ........................  3 cenarios
--   tirar a trava dos dois niveis ...........................  2 cenarios
--   tirar a trava da aprovacao na etapa com filho ...........  1 cenario
--   tirar a trava da dependencia na etapa com filho .........  1 cenario
--   trocar as tres por `for each row` .......................  0 cenarios
--   tirar `parent_ordem` da resolucao pela conta ............  2 cenarios
--
-- A do pai inexistente derruba TRES porque ela e a mesma pergunta em tres
-- caminhos: o filho orfao, o laco em ordem invertida e o `delete` parcial que
-- apaga so a etapa de cima.
--
-- E O ZERO E O QUE PROVA A FRASE SOBRE O `for each statement`, acima: ele nao
-- esta la por correcao.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A coluna
-- ---------------------------------------------------------------------------
alter table public.workflow_steps
  add column if not exists parent_ordem integer;

comment on column public.workflow_steps.parent_ordem is
  'A POSICAO (ordem) da etapa de cima no mesmo modelo, ou null quando a etapa e de topo. '
  'E posicao e nao uuid porque regravarEtapas() apaga e reinsere a cadeia a cada salvamento -- '
  'a mesma decisao de depende_de_ordem (0007). Dois niveis e nunca tres: o neto nao tem onde '
  'nascer, porque subtasks_agrupadora (0022) recusa sub-etapa de sub-etapa.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A conferencia do modelo
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

  return null;
end;
$corpo$;

comment on function public.conferir_etapas_do_workflow() is
  'Confere a arvore de um workflow POR INSTRUCAO: pai existe no mesmo modelo, dois niveis e '
  'nunca tres, e etapa com filho nao exige aprovacao nem espera outra etapa -- as duas ultimas '
  'sao as recusas de subtasks_agrupadora (0022) subidas para o modelo, para a recusa chegar a '
  'quem montou o workflow e nao a quem o aplicou.';

drop trigger if exists workflow_steps_confere_insert on public.workflow_steps;
create trigger workflow_steps_confere_insert
  after insert on public.workflow_steps
  referencing new table as novas
  for each statement execute function public.conferir_etapas_do_workflow();

drop trigger if exists workflow_steps_confere_update on public.workflow_steps;
create trigger workflow_steps_confere_update
  after update on public.workflow_steps
  referencing new table as novas
  for each statement execute function public.conferir_etapas_do_workflow();

drop trigger if exists workflow_steps_confere_delete on public.workflow_steps;
create trigger workflow_steps_confere_delete
  after delete on public.workflow_steps
  referencing old table as antigas
  for each statement execute function public.conferir_etapas_do_workflow();


-- ---------------------------------------------------------------------------
-- PASSO 3 - A resolucao pela conta passa a carregar o pai
--
-- `drop function` ANTES, e nao `create or replace`: ele nao troca o tipo de
-- retorno de uma funcao `returns table`, e estoura com "cannot change return
-- type of existing function". E a pegadinha que a 0088 pagou -- e com o
-- `drop` vao os grants, entao o `grant` no fim e obrigatorio: sem ele a funcao
-- nasce com o `execute` que o Postgres concede a `public` sozinho.
--
-- E `database.types.ts` acompanha, porque `check:tipos` NAO confere a forma de
-- um `returns table` recriado: ele liga coluna e parametro. Quem le a coluna
-- que falta e a tela, em producao.
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
  parent_ordem       integer
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
    e.parent_ordem
  from public.workflow_steps e
  where e.template_id = p_template_id
  order by e.ordem;
end;
$func$;

comment on function public.etapas_resolvidas_do_workflow(uuid, uuid) is
  'As etapas de um workflow com o responsavel resolvido pela conta (0064), mais o pai de cada '
  'uma por posicao (0108). A ordem da resolucao e pessoa da etapa -> pessoa da funcao na conta '
  '-> ninguem, e quem saiu da agencia nao vira responsavel.';

revoke all on function public.etapas_resolvidas_do_workflow(uuid, uuid) from public;
grant execute on function public.etapas_resolvidas_do_workflow(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- CONFERENCIA (cole depois de aplicar)
--
--   select count(*) from information_schema.columns
--    where table_name = 'workflow_steps' and column_name = 'parent_ordem';      -- 1
--   select count(*) from pg_trigger
--    where tgname like 'workflow_steps_confere%';                               -- 3
--   select count(*) from information_schema.routines
--    where routine_name = 'conferir_etapas_do_workflow';                        -- 1
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
