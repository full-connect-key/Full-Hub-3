-- ---------------------------------------------------------------------------
-- 0023 - A exigencia de aprovacao sai da Task e passa a ser de cada etapa
--
-- A 0014 criou `tasks.exigencia_aprovacao` para dizer, na abertura, o que a
-- DEMANDA inteira precisa antes de ser dada por entregue. A regra parecia um
-- nivel acima da aprovacao da subtarefa. Era um buraco.
--
-- O QUE ESTAVA ERRADO, e foi observado pelo usuario: a trava aceitava UMA
-- rodada aprovada, do escopo exigido, em QUALQUER subtarefa da task. Uma
-- campanha com conceito, layout, revisao e subida de midia passava com o
-- conceito aprovado e o resto nunca visto -- e saia para o cliente como
-- "entregue", com o carimbo do sistema dizendo que a aprovacao exigida
-- aconteceu. Uma trava que da por cumprido o que foi cumprido em um lugar so
-- e pior que nenhuma: ela produz confianca sem a checagem.
--
-- O QUE PASSA A VALER: a exigencia mora onde o trabalho mora. Cada subtarefa
-- diz se precisa de aval (`requer_aprovacao`) e de qual (`tipo_aprovacao`), e
-- a demanda so e marcada `entregue` quando TODAS as etapas que pediram aval
-- tiverem a rodada aprovada delas. Nao ha mais um jeito de responder pela
-- campanha inteira sem responder por cada peca.
--
-- E MAIS ESTRITO, e de proposito. A regra antiga podia ser cumprida por uma
-- aprovacao; a nova exige todas. Nenhuma demanda que passava antes passa
-- agora por engano -- as que travarem estao mostrando etapa sem aval, que e
-- exatamente o que se quer ver.
--
-- A COLUNA E APAGADA, e nao aposentada como `cancelada` foi. Aquele caso era
-- um valor de enum, que o Postgres nao deixa remover; aqui e coluna, e coluna
-- some. Deixa-la parada seria manter na tela de abertura uma pergunta que nao
-- decide mais nada -- que e o pior tipo de campo, porque quem responde acha
-- que garantiu alguma coisa.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

drop trigger if exists tasks_exige_aprovacao_para_entregue on public.tasks;
drop function if exists public.tasks_exige_aprovacao_para_entregue();

alter table public.tasks drop column if exists exigencia_aprovacao;

drop type if exists public.exigencia_aprovacao;


-- ---------------------------------------------------------------------------
-- Exigir aprovacao sem dizer qual JA era recusado, desde a 0007
--
-- `subtask_tem_aval()` devolve true quando `tipo_aprovacao` e nulo -- nao ha
-- escopo para procurar --, entao uma etapa com `requer_aprovacao = true` e
-- tipo nulo diria "exijo aprovacao" e passaria por todas as travas. A porta
-- ja esta fechada pelo check `subtasks_tipo_aprovacao_coerente` da 0007, que
-- exige o par inteiro nos dois sentidos.
--
-- Nao ha `check` novo aqui de proposito: uma segunda trava dizendo a mesma
-- coisa e uma segunda verdade esperando divergir. O que faltava era o cenario
-- que prova a regra do ponto de vista de quem exige aval -- e ele entrou na
-- bateria, em `08_exigencia_de_aprovacao`.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- A trava do encerramento, agora etapa por etapa
--
-- Continua olhando SO a transicao para `entregue`, como a da 0014: corrigir o
-- titulo de uma task ja entregue, apagar e o recalculo automatico seguem
-- passando. Uma trava que freasse tudo seria trocada por outro caminho na
-- primeira semana.
--
-- A mensagem NOMEIA as etapas que faltam. "Esta demanda tem etapa sem
-- aprovacao" manda a pessoa abrir uma por uma; dizer quais e a diferenca
-- entre uma recusa e uma instrucao.
-- ---------------------------------------------------------------------------
create or replace function public.tasks_entregue_exige_cada_etapa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  faltando text;
  quantas  integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status <> 'entregue' then
    return new;
  end if;

  select count(*), string_agg(format('"%s"', s.titulo), ', ' order by s.ordem, s.titulo)
    into quantas, faltando
    from public.subtasks s
   where s.task_id = new.id
     and s.requer_aprovacao
     and not public.subtask_tem_aval(s.id);

  if quantas = 0 then
    return new;
  end if;

  raise exception using
    errcode = 'check_violation',
    message = format('%s ainda não tem aprovação: %s.',
                     case when quantas = 1 then 'Uma etapa desta demanda'
                          else format('%s etapas desta demanda', quantas) end,
                     faltando),
    hint    = '"Entregue" diz que o material saiu. Cada etapa que pede aval precisa da rodada aprovada dela — uma aprovação em outra etapa não responde por esta.';
end
$$;

drop trigger if exists tasks_entregue_exige_cada_etapa on public.tasks;
create trigger tasks_entregue_exige_cada_etapa
  before update on public.tasks
  for each row
  execute function public.tasks_entregue_exige_cada_etapa();

comment on function public.tasks_entregue_exige_cada_etapa() is
  'Recusa "entregue" enquanto alguma etapa que exige aprovação não tiver a rodada aprovada dela. Substitui tasks_exige_aprovacao_para_entregue, que aceitava uma aprovação em nome da demanda inteira.';

notify pgrst, 'reload schema';
