-- ---------------------------------------------------------------------------
-- 0021 - O cronometro da subtarefa
--
-- Ate aqui, `tempo_real_minutos` so existia se alguem digitasse ao concluir.
-- Quem estava com pressa pulava, e o relatorio de rentabilidade -- que cruza
-- receita com o tempo das subtarefas -- ficava com buraco justamente nas
-- demandas mais corridas, que sao as que mais interessam medir.
--
-- Agora o relogio corre sozinho. Duas colunas novas:
--
--   `andando_desde`           quando a contagem em curso comecou (null = parada)
--   `tempo_medido_segundos`   o que ja foi contado nas passagens anteriores
--
-- O MEDIDO E O DECLARADO SAO COISAS DIFERENTES, e por isso sao colunas
-- diferentes. O medido e um fato sobre o relogio; `tempo_real_minutos`
-- continua sendo o que a PESSOA afirma. A tela abre o dialogo de conclusao
-- preenchido com o medido, para conferir ou corrigir -- nunca grava por cima
-- sem alguem olhar. Um cronometro que decide sozinho quanto custou uma entrega
-- e um cronometro que mede a noite em que alguem esqueceu a aba aberta.
--
-- O RELOGIO SO CORRE EM `em_andamento`. Pausa em `aguardando_informacoes`
-- (a pessoa esta esperando, nao trabalhando), para em `enviada_aprovacao` e
-- em `concluida`, e volta a correr quando a subtarefa volta para andamento
-- depois de um pedido de ajustes. Contar de ponta a ponta somaria as noites,
-- os fins de semana e os dias parados esperando o cliente.
--
-- EM SEGUNDOS, e nao em minutos como o resto da casa. A regra dos minutos
-- vale para o que a pessoa DIGITA e para o que a tela MOSTRA. Esta coluna e
-- escrita por maquina, e acumular minuto arredondado a cada passagem perderia
-- as sobras: dez idas e voltas de 40 segundos viram zero ou dez minutos,
-- conforme o arredondamento. Guardar segundo e arredondar uma vez, na leitura,
-- e a conta que nao mente.
--
-- QUEM ESCREVE E O TRIGGER, NUNCA O CLIENTE. Policy nao limita coluna, entao
-- sem isso qualquer pessoa montaria um update dizendo que a etapa dela levou
-- oito horas. O trigger reescreve as duas colunas a partir do que ja estava
-- gravado e do relogio do servidor, e descarta o que vier no pedido.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

alter table public.subtasks
  add column if not exists andando_desde timestamptz;

alter table public.subtasks
  add column if not exists tempo_medido_segundos integer not null default 0;

comment on column public.subtasks.andando_desde is
  'Inicio da contagem em curso. Null quando o relogio esta parado. So o trigger escreve.';

comment on column public.subtasks.tempo_medido_segundos is
  'Segundos ja contados em `em_andamento`, fora a contagem em curso. So o trigger escreve.';

-- As subtarefas que ja estavam em andamento quando esta migration rodou
-- comecam a contar daqui. Datar em `iniciada_em` seria adotar como medicao as
-- noites e os fins de semana entre aquele dia e hoje -- o numero apareceria
-- pronto na tela, grande, e ninguem teria como saber que e ficcao.
update public.subtasks
   set andando_desde = now()
 where status = 'em_andamento' and andando_desde is null;


-- ---------------------------------------------------------------------------
-- O trigger
--
-- BEFORE, porque ele corrige o proprio NEW: depois de gravado seria tarde
-- para recusar o que o cliente mandou nas duas colunas.
-- ---------------------------------------------------------------------------
create or replace function public.subtasks_cronometro()
returns trigger
language plpgsql
as $$
declare
  estava_andando boolean;
  vai_andar      boolean;
  base           integer;
  desde          timestamptz;
begin
  vai_andar := new.status = 'em_andamento';

  if tg_op = 'INSERT' then
    estava_andando := false;
    base           := 0;
    desde          := null;
  else
    estava_andando := old.status = 'em_andamento';
    base           := coalesce(old.tempo_medido_segundos, 0);
    desde          := old.andando_desde;
  end if;

  -- Saindo de `em_andamento`: fecha a passagem e soma o que ela durou.
  if estava_andando and not vai_andar then
    if desde is not null then
      base := base + greatest(0, floor(extract(epoch from (now() - desde)))::integer);
    end if;
    desde := null;

  -- Entrando em `em_andamento`: abre uma passagem nova.
  elsif vai_andar and not estava_andando then
    desde := now();

  -- Continua andando: a passagem em curso segue aberta. `coalesce` cobre a
  -- linha que ja estava em andamento antes desta migration existir.
  elsif vai_andar then
    desde := coalesce(desde, now());
  end if;

  -- O que veio no pedido nao conta. Estas duas colunas sao do relogio.
  new.tempo_medido_segundos := base;
  new.andando_desde         := desde;

  return new;
end;
$$;

drop trigger if exists subtasks_cronometro on public.subtasks;
create trigger subtasks_cronometro
  before insert or update on public.subtasks
  for each row execute function public.subtasks_cronometro();


-- ---------------------------------------------------------------------------
-- A leitura
--
-- O gemeo em TypeScript e `minutosMedidos()`, em `lib/dominio/tempo.ts`: a
-- tela precisa do numero correndo a cada segundo, e nao da para pedir ao
-- banco a cada segundo. Os dois existem de proposito, como
-- `situacao_do_lancamento()` e `situacaoDoLancamento()` no Financeiro.
-- ---------------------------------------------------------------------------
create or replace function public.tempo_medido_da_subtarefa(p_subtask_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  base  integer;
  desde timestamptz;
begin
  select coalesce(s.tempo_medido_segundos, 0), s.andando_desde
    into base, desde
    from public.subtasks s
   where s.id = p_subtask_id;

  if not found then
    return null;
  end if;

  if desde is not null then
    base := base + greatest(0, floor(extract(epoch from (now() - desde)))::integer);
  end if;

  return round(base / 60.0)::integer;
end;
$$;

comment on function public.tempo_medido_da_subtarefa(uuid) is
  'Minutos medidos pelo cronometro, incluindo a contagem em curso. E o MEDIDO, nao o declarado.';
