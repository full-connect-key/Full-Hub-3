-- =============================================================================
-- 0151 - OS FERIADOS SE CALCULAM, e o que a agencia escreve fica
-- =============================================================================
--
-- Decisao do usuario, item 3: *"no calendario, quero que voce puxe sozinho os
-- feriados, e que permita que eu salve feriados pontuais, no caso de algum
-- cliente tiver algum feriado especifico, ou emendas de feriado"*.
--
-- -----------------------------------------------------------------------------
-- O QUE FOI MEDIDO ANTES DE ESCREVER, e e o que decide esta migration:
--
--   `holidays` tem 78 linhas, de 01/01/2025 a 25/12/2030 -- treze por ano, os
--   seis anos com a MESMA lista. Nenhuma delas e da agencia: as 78 sao os
--   feriados nacionais, escritos a mao na 0011 (2026 e 2027) e na 0038 (2025 e
--   2028 a 2030). E **nenhuma tela do produto escreve naquela tabela**: a
--   policy `holidays_write` e `is_gestor()` desde a 0011 e nunca foi exercida
--   -- a ponte construida e nunca atravessada pela vigesima vez. O unico
--   caminho de cadastrar um feriado e colar SQL.
--
--   E a tabela ACABA em 25/12/2030, que e exatamente onde o calendario rolavel
--   do Day Off acaba (`ULTIMO_MES_DO_CALENDARIO`). O `AvisoDeFeriado` pergunta
--   de `ano - 1` a `ano + 3`: em 2028 ele passa a pedir 2031, e a 0038 ja
--   escreveu o que acontece -- *"um ano sem feriado na tabela nao aparece
--   vazio, aparece NORMAL"*. O bug nao e de hoje; ele tem data.
-- -----------------------------------------------------------------------------
--
-- "PUXE SOZINHO" E CALCULAR, NUNCA BUSCAR, e as tres saidas foram pesadas:
--
--   (a) uma API de feriados. O Postgres nao fala HTTP -- e a frase desta casa
--       desde as rotinas da 0072 --, entao ela entraria pelo Next, numa rotina
--       que depende da URL do app: a pendencia que o produto carrega desde que
--       a VPS saiu. E ela acrescenta um host que a hospedagem precisa alcancar
--       e que pode sair do ar.
--   (b) mais uma migration com `insert` ate 2040. E o que a 0038 fez, e ela
--       so empurra a data do bug.
--   (c) CALCULAR. Os feriados nacionais sao TODOS derivaveis: nove fixos, e os
--       quatro moveis saem da Pascoa pelo algoritmo gregoriano -- que a
--       propria 0038 ja usou a mao, para quatro anos.
--
-- E (c) e a regra desta casa e nao uma preferencia: **o que da para calcular
-- nao se guarda**. E `atraso` nao ser coluna, `maoDoPost()` nao ser gravada e
-- a fase do pedido ser derivada, pela enesima vez. De quebra ela responde
-- melhor a palavra "sozinho" que uma API: buscar depende de alguem estar no
-- ar; calcular nao depende de nada.
--
-- MEDIDO ANTES DE ESCREVER, contra as 78 linhas: o algoritmo devolve
-- 20/04/2025, 05/04/2026, 28/03/2027, 16/04/2028, 01/04/2029 e 21/04/2030 --
-- as seis Pascoas que a 0011 e a 0038 escreveram a mao.
--
-- -----------------------------------------------------------------------------
-- A TABELA CONTINUA SENDO A VERDADE, e e isso que faz a troca ser barata.
--
-- `holidays` e citada por nome em DEZ migrations ja aplicadas -- `dias_uteis()`
-- (0011), `disponibilidade_bruta()` (0081), `datas_da_recorrencia()` (0040) e
-- os `not exists` do Day Off -- e em tres modulos de `lib/dados/`. Uma VIEW no
-- lugar dela, ou uma funcao que devolva o calculado sem gravar, obrigaria a
-- reescrever as dez.
--
-- Entao a funcao POVOA a tabela: ninguem mais escreve uma migration por ano, e
-- cada um daqueles dez `not exists` continua certo sem uma linha de mudanca.
-- O que a tabela passa a guardar e a soma das duas coisas -- o nacional, que
-- nasce sozinho, e a EXCECAO, que e o que a agencia escreve: o feriado
-- municipal, a emenda, o dia em que a casa fecha e o calendario nacional nao
-- sabe.
--
-- `origem` E TEXT COM CHECK E NAO ENUM, e a razao e mecanica: o SQL Editor
-- roda a colagem como UMA transacao, e o Postgres recusa USAR um valor de enum
-- na mesma transacao em que ele nasce -- e a razao escrita na 0028 para
-- `rascunho` nao ter virado valor de enum, e na 0109 para o arquivo nao
-- conferir o que cria. Um enum aqui obrigaria a segunda colagem para um valor
-- que nao decide QUAL TELA aparece (que e o criterio de `midia` na 0042):
-- ele decide se a geracao toca a linha, e so.
--
-- E `holiday_years` EXISTE PARA APAGAR SER DESFAZER. Sem ela, a agencia que
-- trabalha no Carnaval apaga os dois dias e a geracao seguinte os devolve --
-- *aceitar e desfazer calado e pior que recusar com explicacao* (0025). Com
-- ela, um ano e semeado UMA vez: o que foi apagado depois fica apagado. Ela e
-- uma tabela de uma coluna util, e e isso que ela compra.
--
-- -----------------------------------------------------------------------------
-- O QUE ESTA MIGRATION NAO CRIA, e e metade do pedido:
--
--   **o feriado DE UM CLIENTE ja existe**, e e `events` com
--   `tipo = 'feriado_cliente'` -- com `client_id`, com cor no Calendario Full
--   e com `bloqueia_ferias` desde a 0055. Medido: ha DOIS lancados no banco.
--
--   E ele nao e `holidays`, que e a pergunta que separa os dois: *o feriado de
--   um cliente faz a AGENCIA nao trabalhar?* Nao. Se a conta nao abre no
--   aniversario da cidade dela, a agencia trabalha -- ela so nao entrega
--   NAQUELA conta, e ninguem de la responde. Entao ele nao e dia nao-util: nao
--   entra em `dias_uteis()`, nao desconta day off e nao muda a carga de
--   ninguem. O que ele muda e o AVISO, e essa e a metade que a tela liga.
-- -----------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - De onde veio cada feriado
-- ---------------------------------------------------------------------------

alter table public.holidays
  add column if not exists origem text not null default 'nacional';

do $bloco$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.holidays'::regclass
       and conname  = 'holidays_origem_conhecida'
  ) then
    alter table public.holidays
      add constraint holidays_origem_conhecida
      check (origem in ('nacional', 'agencia'));
  end if;
end
$bloco$;

comment on column public.holidays.origem is
  'nacional = nasceu de feriados_nacionais(); agencia = alguem escreveu. A geracao so toca o nacional -- o que a agencia escreveu nunca e reescrito nem apagado por ela.';

-- As 78 linhas de 2025 a 2030 sao os feriados nacionais da 0011 e da 0038, e
-- o default ja as deixa em 'nacional'. O update existe para o banco que tenha
-- recebido a coluna antes desta migration.
update public.holidays set origem = 'nacional' where origem is null;


-- ---------------------------------------------------------------------------
-- PASSO 2 - Que anos ja foram semeados
-- ---------------------------------------------------------------------------

create table if not exists public.holiday_years (
  ano        int primary key,
  gerado_em  timestamptz not null default now()
);

comment on table public.holiday_years is
  'Um ano por linha, marcado quando garantir_feriados_nacionais() o semeia. E ele que faz apagar ser desfazer: sem esta marca, o feriado que a agencia apagou voltaria na proxima geracao.';

alter table public.holiday_years enable row level security;

drop policy if exists holiday_years_select on public.holiday_years;
drop policy if exists holiday_years_write  on public.holiday_years;

-- Ler e de quem ja le `holidays`: a tela de feriados mostra quais anos o
-- produto ja gerou. Escrever nao tem policy nenhuma -- quem escreve e a
-- funcao, que e `security definer`. E a forma de `notifications`, onde a unica
-- porta e `notificar()`.
create policy holiday_years_select on public.holiday_years
  for select to authenticated using (true);


-- ---------------------------------------------------------------------------
-- PASSO 3 - O calculo, que nao toca em tabela nenhuma
-- ---------------------------------------------------------------------------

create or replace function public.feriados_nacionais(p_ano int)
returns table (data date, nome text)
language plpgsql
immutable
as $$
declare
  a int; b int; c int; d int; e int; f int; g int;
  h int; i int; k int; l int; m int;
  mes int; dia int;
  pascoa date;
begin
  -- O algoritmo gregoriano (Meeus/Butcher) -- o mesmo que a 0038 rodou a mao
  -- para quatro anos. Medido contra as 78 linhas que ja estavam na tabela: as
  -- seis Pascoas batem.
  a := p_ano % 19;
  b := p_ano / 100;
  c := p_ano % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31;
  dia := ((h + l - 7 * m + 114) % 31) + 1;
  pascoa := make_date(p_ano, mes, dia);

  return query
  -- Os NOVE fixos. 20/11 e nacional desde a Lei 14.759/2023, e e por isso que
  -- ele esta na lista com os outros oito em vez de ser excecao.
  select make_date(p_ano,  1,  1), 'Confraternizacao Universal'::text
  union all select make_date(p_ano,  4, 21), 'Tiradentes'
  union all select make_date(p_ano,  5,  1), 'Dia do Trabalho'
  union all select make_date(p_ano,  9,  7), 'Independencia do Brasil'
  union all select make_date(p_ano, 10, 12), 'Nossa Senhora Aparecida'
  union all select make_date(p_ano, 11,  2), 'Finados'
  union all select make_date(p_ano, 11, 15), 'Proclamacao da Republica'
  union all select make_date(p_ano, 11, 20), 'Dia Nacional de Zumbi e da Consciencia Negra'
  union all select make_date(p_ano, 12, 25), 'Natal'
  -- Os QUATRO moveis, todos a partir da Pascoa.
  --
  -- Carnaval e Corpus Christi sao legalmente PONTO FACULTATIVO e entram assim
  -- mesmo, que e a decisao escrita no `comment` da tabela desde a 0011: *"na
  -- pratica a agencia nao abre"*. Sao eles tambem os primeiros candidatos a
  -- serem apagados por uma agencia que abra -- e e para esse apagar durar que
  -- `holiday_years` existe.
  union all select pascoa - 48, 'Carnaval'
  union all select pascoa - 47, 'Carnaval'
  union all select pascoa -  2, 'Sexta-feira Santa'
  union all select pascoa + 60, 'Corpus Christi';
end;
$$;

comment on function public.feriados_nacionais(int) is
  'Os 13 feriados nacionais de um ano, calculados. Nao le nem escreve tabela nenhuma: e por isso que ela e immutable e serve a qualquer ano.';

revoke all on function public.feriados_nacionais(int) from public, anon;
grant execute on function public.feriados_nacionais(int) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 4 - Semear os anos que faltam
-- ---------------------------------------------------------------------------

create or replace function public.garantir_feriados_nacionais(
  p_de   int,
  p_ate  int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ano    int;
  v_novos  int := 0;
  v_conta  int;
begin
  -- A FAIXA EXISTE PORQUE ESTA FUNCAO E CHAMADA DE UMA LEITURA DE TELA, e o
  -- ano dela vem de uma data que pode ter sido colada na URL: sem limite, um
  -- `?mes=1900-01` semearia dois seculos -- 2600 linhas -- por causa de um
  -- endereco torto. E o teto de 62 dias de `disponibilidade()` (0081) um nivel
  -- acima.
  --
  -- E ELA RECUSA EM VEZ DE GRAMPEAR, que foi a primeira versao e estava
  -- errada: `greatest(p_de, 2020)` leva o pedido absurdo para DENTRO da faixa
  -- valida e semeia onze anos que ninguem pediu -- medido, 1900 a 2100 gerava
  -- 65 linhas de 2020 a 2024. Truncar e *aceitar e fazer outra coisa*, que a
  -- 0025 diz ser pior que recusar.
  --
  -- Recusando, a tela que pediu um ano torto simplesmente nao recebe feriado
  -- nenhum daquele ano -- que e a verdade: ninguem escreveu feriado de 1900.
  -- `feriados_do_periodo()` continua devolvendo o que a tabela TEM, entao a
  -- leitura nao quebra.
  if p_de is null or p_ate is null
     or p_de < 2024 or p_ate > 2060
     or p_ate < p_de
     or p_ate - p_de > 10
  then
    return 0;
  end if;

  for v_ano in p_de .. p_ate loop
    -- O ano semeado nao e semeado de novo, e e esta linha que faz o feriado
    -- apagado continuar apagado.
    if not exists (select 1 from public.holiday_years y where y.ano = v_ano) then
      insert into public.holidays (data, nome, origem)
      select f.data, f.nome, 'nacional'
        from public.feriados_nacionais(v_ano) f
      -- `on conflict (data) do nothing` e o que protege o que a agencia ja
      -- escreveu naquele dia com outro nome: **o que a agencia escreveu
      -- ganha**, que e a frase da 0038.
      on conflict (data) do nothing;

      get diagnostics v_conta = row_count;
      v_novos := v_novos + v_conta;

      insert into public.holiday_years (ano) values (v_ano)
      on conflict (ano) do nothing;
    end if;
  end loop;

  return v_novos;
end;
$$;

comment on function public.garantir_feriados_nacionais(int, int) is
  'Semeia os feriados nacionais dos anos que ainda nao foram semeados e devolve quantas linhas nasceram. Idempotente: um ano so e semeado uma vez, e o que a agencia apagou depois fica apagado.';

revoke all on function public.garantir_feriados_nacionais(int, int) from public, anon;
grant execute on function public.garantir_feriados_nacionais(int, int) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- PASSO 5 - A leitura que garante antes de devolver
-- ---------------------------------------------------------------------------

create or replace function public.feriados_do_periodo(
  p_inicio date,
  p_fim    date
)
returns table (data date, nome text, origem text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A GARANTIA ACONTECE NA LEITURA, e nao numa rotina de madrugada: a rotina
  -- teria de adivinhar quantos anos a frente gerar, e e justamente adivinhar
  -- errado que deixou a tabela acabando em 2030. Aqui nasce o ano que alguem
  -- esta OLHANDO -- o calendario rolavel pede 2025 a 2030, o aviso de feriado
  -- pede `ano - 1` a `ano + 3`, e os dois recebem o que pediram.
  --
  -- Ela custa um `select` numa tabela de uma dezena de linhas, e um `insert`
  -- uma vez por ano por banco.
  perform public.garantir_feriados_nacionais(
    extract(year from p_inicio)::int,
    extract(year from p_fim)::int
  );

  return query
  select h.data, h.nome, h.origem
    from public.holidays h
   where h.data >= p_inicio
     and h.data <= p_fim
   order by h.data;
end;
$$;

comment on function public.feriados_do_periodo(date, date) is
  'Os feriados de um periodo, garantindo antes que os anos dele ja tenham sido semeados. E a porta que lib/dados/ usa.';

revoke all on function public.feriados_do_periodo(date, date) from public, anon;
grant execute on function public.feriados_do_periodo(date, date) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 6 - Os anos que ja estao na tabela entram como semeados
-- ---------------------------------------------------------------------------
--
-- SEM ESTE PASSO A MIGRATION NAO MUDA NADA E FAZ ESTRAGO: a primeira leitura
-- semearia 2025 a 2030 de novo. O `on conflict` nao deixaria duplicar, mas um
-- feriado que a agencia tivesse apagado a mao voltaria -- que e exatamente o
-- que `holiday_years` existe para impedir.

insert into public.holiday_years (ano, gerado_em)
select distinct extract(year from h.data)::int, now()
  from public.holidays h
on conflict (ano) do nothing;


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------

do $bloco$
declare
  v_anos        int;
  v_sem_origem  int;
  v_pascoa_2031 date;
  v_novos       int;
begin
  select count(*) into v_anos from public.holiday_years;
  select count(*) into v_sem_origem
    from public.holidays where origem not in ('nacional', 'agencia');

  -- 2031 e o primeiro ano que nenhuma migration escreveu a mao: ele e a prova
  -- de que a tabela deixou de ter fim.
  select f.data + 2 into v_pascoa_2031
    from public.feriados_nacionais(2031) f
   where f.nome = 'Sexta-feira Santa';

  select public.garantir_feriados_nacionais(2031, 2031) into v_novos;

  raise notice 'Anos semeados: %. Linhas com origem desconhecida: %.',
    v_anos, v_sem_origem;
  raise notice 'Pascoa de 2031 calculada: % (o esperado e 13/04/2031). 2031 nasceu com % feriado(s).',
    v_pascoa_2031, v_novos;

  if v_sem_origem > 0 then
    raise exception 'Ha % feriado(s) com origem fora da lista.', v_sem_origem;
  end if;
end
$bloco$;
