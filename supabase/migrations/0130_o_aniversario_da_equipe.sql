-- ===========================================================================
-- 0130 - O ANIVERSARIO DA EQUIPE NO CALENDARIO FULL
--
-- Decisao do usuario, em duas frases: *"inclua no calendario Full um topico
-- pra colocarmos os aniversarios dos colaboradores"* e, logo em seguida,
-- *"mas isso deve ser resgatado das informacoes pessoais do perfil de cada
-- um, entao tem que incluir esse campo na gestao da equipe tambem"*.
--
-- A SEGUNDA FRASE MUDA O DESENHO INTEIRO, e para melhor. A primeira leitura
-- era um valor novo em `evento_tipo` -- a forma exata da 0109 --, e alguem
-- lancaria quinze eventos todo janeiro. Derivado da ficha, o aniversario
-- aparece sozinho todo ano e nunca fica desatualizado: e a regra desta casa,
-- *o que da para calcular nao se guarda*, a mesma de `atraso` nao ser coluna
-- e de `maoDoPost()` nao ser gravada.
--
-- ---------------------------------------------------------------------------
-- A COLUNA MORA EM `team_members` E NAO EM `profiles`, E ISSO FOI MEDIDO
--
-- `profiles` tem DUAS policies de SELECT, e so duas: `profiles_select_own`
-- (`auth.uid() = id`) e `profiles_select_gestor` (`is_gestor()`). Um
-- colaborador le EXATAMENTE UM perfil -- o dele. Com a data de nascimento
-- ali, o calendario de aniversarios nasceria mostrando, para quem nao e
-- gestao, o proprio aniversario e os da gestao, e mais nada.
--
-- `team_members_select` e `is_staff()` desde a 0002: toda a equipe le a ficha
-- de toda a equipe. E onde a coluna precisa estar para a tela existir para
-- quem ela e. Ela entra ao lado de `data_admissao`, que e a outra data de
-- ficha e nasceu na mesma tabela pelo mesmo motivo.
--
-- ---------------------------------------------------------------------------
-- O CHECK E SO O PISO, E A RAZAO E A IMUTABILIDADE
--
-- "Nao pode ser no futuro" e a trava obvia e o Postgres NAO a aceita num
-- check: `current_date` nao e immutable, e *"functions in check constraint
-- expression must be marked IMMUTABLE"* derruba a migration. Ela teria de ser
-- trigger.
--
-- E nao e, de proposito: o calendario usa DIA E MES e descarta o ano, entao
-- um ano digitado errado nao corrompe nada do que esta tela mostra -- corrompe
-- o que a ficha exibe, que e onde ele foi digitado. Quem recusa o futuro e o
-- zod do formulario, que escreve a frase antes do clique. O piso de 1900,
-- esse e immutable e pega o `0199-05-12` de dedo torto.
--
-- ---------------------------------------------------------------------------
-- A VIEW `calendar_events` NAO E TOCADA, e esta e a linha que mais importa
--
-- A tentacao e uma segunda origem ali, que daria o `.ics` de graca. Ela nao
-- funciona e nao deve funcionar:
--
--   1. a view e `security_invoker = true` desde a 0055, repetida SEIS vezes.
--      Um `join` em `profiles` dentro dela roda com a RLS de quem perguntou,
--      e para um colaborador o join derruba toda linha que nao e a dele:
--      o calendario voltaria um aniversario -- o proprio. A falha e calada,
--      que e o modo de falha desta casa;
--   2. abrir `profiles` para `is_staff()` consertaria isso e abriria a tabela
--      de perfis da agencia inteira, para as vinte telas que a leem. O
--      CLAUDE.md ja escreve essa recusa: *"se a regra tiver que mudar, muda
--      na policy -- num lugar"*. Um calendario de aniversario nao e motivo
--      para mexer na postura de privacidade do produto;
--   3. e a 0105 e decisao do usuario: *"ele deve ser apenas para eventos que
--      serao lancados nele"*. Uma origem na view a entrega de graca ao
--      proximo consumidor dela.
--
-- Entao a origem e uma FUNCAO, `security definer`, com `is_staff()` escrito a
-- mao na porta e devolvendo so o agregado: nome, e o dia projetado. E a forma
-- de `usuarios_do_meu_cliente()` (0031), de `meus_comodatos()` (0069), de
-- `o_que_o_cliente_decide()` (0076) e de `pecas_programadas()` (0111).
--
-- ---------------------------------------------------------------------------
-- O ANO NAO SAI DA FUNCAO, E A AUSENCIA E A DECISAO
--
-- A funcao devolve o DIA projetado no ano que esta na tela, nunca a data de
-- nascimento. Quer dizer que a idade de cada pessoa fica dentro da ficha, que
-- e `is_staff()` como sempre foi, e nao viaja para uma tela que a agencia
-- inteira abre toda segunda. O calendario diz que e o aniversario da Ana; ele
-- nao diz quantos anos ela faz.
--
-- ---------------------------------------------------------------------------
-- 29 DE FEVEREIRO
--
-- `make_date(2027, 2, 29)` estoura. Quem nasceu em 29/02 aparece em 28/02 nos
-- anos que nao sao bissextos, que e a pratica civil brasileira -- e e o
-- `least()` da projecao que faz isso, comparando o dia do nascimento com o
-- ultimo dia daquele mes naquele ano.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A coluna na ficha
-- ---------------------------------------------------------------------------

alter table public.team_members
  add column if not exists data_nascimento date;

alter table public.team_members
  drop constraint if exists team_members_nascimento_plausivel;

alter table public.team_members
  add constraint team_members_nascimento_plausivel
  check (data_nascimento is null or data_nascimento >= date '1900-01-01');

comment on column public.team_members.data_nascimento is
  'Data de nascimento, opcional. Quem a le e o Calendario Full, por '
  'aniversarios_do_periodo(), que devolve SO o dia e o mes projetados no ano '
  'da tela -- o ano de nascimento nao sai da ficha. Mora aqui e nao em '
  'profiles porque team_members_select e is_staff() e profiles_select e '
  'own-or-gestor: la o calendario nasceria vazio para quem nao e gestao.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A origem: uma funcao, nunca um join na view
-- ---------------------------------------------------------------------------

create or replace function public.aniversarios_do_periodo(
  p_inicio date,
  p_fim    date
)
returns table (
  user_id uuid,
  nome    text,
  dia     date
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  -- A GUARDA ESCRITA A MAO, e ela e a parte que a bateria mede.
  --
  -- `security definer` nao passa pela RLS de `team_members` nem pela de
  -- `profiles`: sem esta linha a funcao devolveria o nome e a data de toda a
  -- equipe para quem tiver a chave anon. Devolver vazio e nao estourar porque
  -- o cliente nao tem este calendario -- para ele a resposta certa e a mesma
  -- que a view ja da: nenhuma linha.
  if not public.is_staff() then
    return;
  end if;

  -- Sem janela, sem resposta. Um periodo invertido devolve vazio em vez de
  -- gerar uma serie ao contrario.
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    return;
  end if;

  return query
  select
    tm.user_id,
    p.nome,
    d.dia
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id
  cross join lateral (
    select make_date(
             anos.ano,
             extract(month from tm.data_nascimento)::int,
             -- 29/02 NUM ANO QUE NAO E BISSEXTO cai em 28/02: o dia do
             -- nascimento, limitado ao ultimo dia daquele mes naquele ano.
             least(
               extract(day from tm.data_nascimento)::int,
               extract(day from (
                 make_date(anos.ano, extract(month from tm.data_nascimento)::int, 1)
                 + interval '1 month - 1 day'
               ))::int
             )
           ) as dia
    -- A JANELA PODE ATRAVESSAR O ANO: a visao de semana mostra 28/12 a 03/01,
    -- e sem os dois anos na serie os aniversarios de janeiro sumiriam de uma
    -- semana que os contem. E a licao da uniao do mes com a selecao na faixa
    -- de disponibilidade (0081).
    from generate_series(
           extract(year from p_inicio)::int,
           extract(year from p_fim)::int
         ) as anos(ano)
  ) d
  where tm.data_nascimento is not null
    -- QUEM SAIU DA AGENCIA NAO APARECE. `tm.ativo` e o fato da ficha -- "e da
    -- equipe hoje" --, e e a mesma pergunta que o desligamento escreve.
    and tm.ativo
    and d.dia between p_inicio and p_fim;
end;
$fn$;

comment on function public.aniversarios_do_periodo(date, date) is
  'Os aniversarios da equipe ativa dentro de uma janela, derivados de '
  'team_members.data_nascimento. security definer com is_staff() na porta, '
  'porque o nome mora em profiles, que um colaborador so le para si mesmo. '
  'Devolve o dia projetado no ano da janela -- nunca o ano de nascimento.';

-- A FUNCAO NAO E CHAMAVEL DE FORA. O Postgres concede execute a `public` em
-- toda funcao nova, e o PostgREST publica o schema `public` sozinho: sem o
-- revoke, a lista de nomes e datas da equipe sairia para quem tiver a chave
-- anon. E a licao da 0071, onde `limpar_rascunhos_abandonados()` passou
-- sprints assim.
revoke all on function public.aniversarios_do_periodo(date, date) from public;
revoke all on function public.aniversarios_do_periodo(date, date) from anon;
grant execute on function public.aniversarios_do_periodo(date, date) to authenticated;


-- ---------------------------------------------------------------------------
-- CONFERENCIA - nao escreve nada
-- ---------------------------------------------------------------------------

select
  'coluna'        as o_que,
  count(*)::text  as resposta
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'team_members'
  and column_name  = 'data_nascimento'
union all
select
  'quem ja tem a data preenchida',
  count(*)::text
from public.team_members
where data_nascimento is not null
union all
select
  'aniversarios nos proximos 365 dias',
  count(*)::text
from public.aniversarios_do_periodo(current_date, current_date + 365);
