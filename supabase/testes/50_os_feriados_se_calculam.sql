\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

-- ===========================================================================
-- 50 - OS FERIADOS SE CALCULAM, E O QUE A AGENCIA ESCREVE GANHA (migration 0151)
--
-- Decisao do usuario, item 3: *"no calendario, quero que voce puxe sozinho os
-- feriados, e que permita que eu salve feriados pontuais, no caso de algum
-- cliente tiver algum feriado especifico, ou emendas de feriado"*.
--
-- ---------------------------------------------------------------------------
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "o feriado que a agencia apagou
-- nao volta na proxima leitura". Ele mede as DUAS metades que fazem a geracao
-- ser idempotente de verdade: o PASSO 6, que marca como semeados os anos que
-- as migrations escreveram a mao, e a linha de `garantir_feriados_nacionais()`
-- que pula o ano ja marcado.
--
-- Tirando qualquer um dos dois, a primeira leitura de 2026 semeia o ano de
-- novo e o Carnaval apagado VOLTA -- sem erro em lugar nenhum, porque o
-- `on conflict` nao deixa duplicar nada. E o pior modo de falha deste modulo:
-- a agencia decide abrir na terca de Carnaval, apaga o dia, e ele reaparece
-- sozinho na proxima vez que alguem abre o calendario.
--
-- E O CENARIO QUE SEPARA O CERTO DO PLAUSIVEL e "o nome que a agencia escreveu
-- num dia nacional sobrevive a semeadura". A versao errada obvia e
-- `on conflict (data) do update set nome = excluded.nome`, e ela deixa a
-- CONTAGEM identica: 2033 fica com treze feriados das duas formas. So o NOME e
-- a ORIGEM separam as duas, e e por isso que este cenario le as duas colunas
-- em vez de contar linhas.
--
-- E O TERCEIRO, o que ninguem pensa em escrever: "a janela torta nao semeia
-- NADA". Medir so o retorno -- que e 0 -- passaria por uma versao que grampeia
-- o pedido para dentro da faixa valida e cai em anos que ja estao semeados;
-- `greatest(p_de, 2020)` foi a primeira versao da 0151 e gerava 65 linhas de
-- 2020 a 2024. O que o cenario acrescenta e olhar a TABELA: nenhum feriado
-- abaixo do piso nasceu, e nenhum ano abaixo dele entrou em `holiday_years`.
-- ===========================================================================

select teste.limpar();

-- Nada e montado aqui: os 78 feriados de 2025 a 2030 vem da 0011 e da 0038, e
-- os treze de 2031 nascem na CONFERENCIA da propria 0151 -- ela gera o
-- primeiro ano que nenhuma migration escreveu, para provar que a tabela deixou
-- de ter fim. Entao o estado de partida sao 91 linhas e sete anos semeados.


-- ---------------------------------------------------------------------------
-- O CALCULO, CONFERIDO CONTRA O QUE A MAO ESCREVEU
--
-- A 0038 rodou o algoritmo da Pascoa a mao para quatro anos, e a 0011 para
-- dois. `feriados_nacionais()` o rodou em plpgsql -- e os dois precisam dar o
-- MESMO resultado, senao o ano que o produto gera sozinho tem um Carnaval em
-- cima de um dia util qualquer.
--
-- O ARQUIVO 17 MEDE A TABELA; ESTE MEDE A FUNCAO. Sao perguntas diferentes:
-- la a pergunta e "o ano esta na tabela", aqui e "a conta que vai gerar os
-- anos futuros reproduz os que ja conferimos".
-- ---------------------------------------------------------------------------

select teste.conferir('Sao 13 feriados nacionais por ano',
  (select count(*)::text from public.feriados_nacionais(2026)), '13');

-- O CENARIO MAIS FORTE DA SECAO, e ele mede os seis anos de uma vez: TODA
-- linha que a mao escreveu e reproduzida pelo calculo, data e nome. Qualquer
-- erro de um dia em qualquer movel de qualquer ano aparece aqui.
select teste.conferir(
  'O calculo reproduz as 78 linhas de 2025 a 2030, data e nome',
  (select count(*)::text
     from generate_series(2025, 2030) ano,
          public.feriados_nacionais(ano::int) f
    where not exists (
      select 1 from public.holidays h
       where h.data = f.data and h.nome = f.nome
    )),
  '0');

-- 2028 E BISSEXTO e o Carnaval cai em 28 e 29 de fevereiro. Uma conta que
-- ignorasse o 29 jogaria a terca para 1 de marco -- e o arquivo 17 mede isso
-- na tabela, com a linha que a 0038 escreveu a mao.
select teste.conferir('O calculo tambem pega o 29 de fevereiro de 2028',
  (select count(*)::text from public.feriados_nacionais(2028) f
    where f.nome = 'Carnaval' and f.data in ('2028-02-28', '2028-02-29')),
  '2');

-- 2031 E O PRIMEIRO ANO QUE NENHUMA MIGRATION ESCREVEU, e e por isso que a
-- Pascoa dele esta escrita a mao aqui: 13 de abril de 2031. Sem um valor
-- esperado vindo de fora do produto, o cenario conferiria a funcao contra ela
-- mesma.
select teste.conferir('A Sexta-feira Santa de 2031 e 11 de abril',
  (select f.data::text from public.feriados_nacionais(2031) f
    where f.nome = 'Sexta-feira Santa'),
  '2031-04-11');

-- ELA NAO LE TABELA NENHUMA, e e isso que a deixa `immutable` e serve a
-- qualquer ano: 2045 nao tem uma linha em `holidays` e a funcao responde os
-- treze do mesmo jeito.
select teste.conferir('2045 nao tem feriado gravado',
  (select count(*)::text from public.holidays
    where data between '2045-01-01' and '2045-12-31'), '0');

select teste.conferir('E a funcao responde os 13 de 2045 assim mesmo',
  (select count(*)::text from public.feriados_nacionais(2045)), '13');


-- ---------------------------------------------------------------------------
-- O PASSO 6: OS ANOS QUE A MAO ESCREVEU ENTRAM COMO SEMEADOS
--
-- Sem ele a migration nao muda nada e faz estrago. E o cenario de baixo e o
-- que prova por que.
-- ---------------------------------------------------------------------------

select teste.conferir('2026 esta marcado como semeado, sem ninguem ter chamado a funcao',
  (exists (select 1 from public.holiday_years where ano = 2026))::text, 'true');

select teste.conferir('Sao sete anos semeados: 2025 a 2030 da mao, e 2031 da 0151',
  (select count(*)::text from public.holiday_years), '7');


-- ---------------------------------------------------------------------------
-- O FERIADO QUE A AGENCIA APAGOU NAO VOLTA -- o cenario que justifica o arquivo
--
-- Carnaval e Corpus Christi sao legalmente PONTO FACULTATIVO e entram na lista
-- assim mesmo, pela decisao escrita no `comment` da tabela desde a 0011: *"na
-- pratica a agencia nao abre"*. Sao eles tambem os primeiros candidatos a
-- serem apagados por uma agencia que abra -- e e para esse apagar durar que
-- `holiday_years` existe.
-- ---------------------------------------------------------------------------

-- A gestao apaga a terca de Carnaval de 2026. `holidays_write` e `is_gestor()`
-- desde a 0011, e ate a 0151 nenhuma tela jamais a exerceu.
select teste.cenario('A gestao apaga a terca de Carnaval de 2026',
  :ANA, $c$delete from public.holidays where data = '2026-02-16'$c$, 'passa');

-- A LEITURA DO ANO INTEIRO e o que dispara a geracao, e e aqui que a versao
-- sem `holiday_years` devolveria 13 de volta.
select teste.conferir_como(
  'A leitura de 2026 devolve 12, e nao semeia o dia de volta',
  :ANA,
  $c$select count(*)::text from public.feriados_do_periodo('2026-01-01', '2026-12-31')$c$,
  '12');

select teste.conferir('E 16 de fevereiro de 2026 continua fora da tabela',
  (select count(*)::text from public.holidays where data = '2026-02-16'), '0');

-- E ELE CONTINUA SENDO DIA UTIL, que e a consequencia que a agencia sente:
-- `dias_uteis()` desconta `holidays`, entao apagar o dia o devolve a conta de
-- prazo de todo modulo.
select teste.conferir('O dia apagado volta a contar como dia util',
  public.dias_uteis('2026-02-16', '2026-02-16')::text, '1');

-- RESTAURADO, porque a tabela de feriados e lida por `dias_uteis()` em todo
-- arquivo da bateria: deixar o Carnaval de 2026 apagado mudaria a conta de um
-- arquivo que ninguem escreveu ainda.
insert into public.holidays (data, nome, origem)
values ('2026-02-16', 'Carnaval', 'nacional')
on conflict (data) do nothing;


-- ---------------------------------------------------------------------------
-- O ANO QUE NINGUEM ESCREVEU NASCE NA LEITURA
--
-- E a metade "puxe sozinho" do pedido. A garantia acontece na LEITURA e nao
-- numa rotina de madrugada, porque a rotina teria de adivinhar quantos anos a
-- frente gerar -- e e justamente adivinhar errado que deixou a tabela
-- acabando em 2030.
-- ---------------------------------------------------------------------------

select teste.conferir('2032 nao tem feriado nenhum, e nao esta semeado',
  (select count(*)::text from public.holidays
    where data between '2032-01-01' and '2032-12-31')
  || '/' ||
  (select count(*)::text from public.holiday_years where ano = 2032),
  '0/0');

-- A LEITURA PEDE MARCO DE 2032 e recebe UMA linha -- a Sexta-feira Santa de 26
-- de marco. A Pascoa de 2032 e 28 de marco, entao o Carnaval cai em fevereiro
-- e o Corpus Christi em maio.
--
-- SAO DOIS FATOS NUM CENARIO, de proposito: a funcao semeia o ANO inteiro e
-- devolve so o PERIODO. Uma versao que devolvesse o ano todo passaria por
-- qualquer contagem do ano e falha aqui.
select teste.conferir_como(
  'A leitura de marco de 2032 devolve 1, e e a Sexta-feira Santa',
  :ANA,
  $c$select count(*)::text || '/' || max(data)::text
       from public.feriados_do_periodo('2032-03-01', '2032-03-31')$c$,
  '1/2032-03-26');

select teste.conferir('E o ano de 2032 nasceu inteiro, com os 13',
  (select count(*)::text from public.holidays
    where data between '2032-01-01' and '2032-12-31'), '13');

select teste.conferir('E 2032 entrou em holiday_years',
  (exists (select 1 from public.holiday_years where ano = 2032))::text, 'true');

-- A SEGUNDA PASSADA NAO SEMEIA NADA. E o retorno zero que diz isso: a funcao
-- devolve quantas linhas nasceram, e um ano ja marcado nao e visitado.
select teste.conferir('Semear 2032 de novo devolve 0',
  public.garantir_feriados_nacionais(2032, 2032)::text, '0');

-- UM PERIODO QUE ATRAVESSA O ANO SEMEIA OS DOIS, e nao so o do inicio. Sem
-- isso, a visao de semana de 28/12 a 03/01 abriria um janeiro sem feriado --
-- e um ano sem feriado na tabela nao aparece vazio, aparece NORMAL.
-- E A JANELA MEDE AS DUAS PONTAS, nao a contagem: de 28/12 a 03/01 o unico
-- feriado que cai dentro e 1 de janeiro -- ou seja, o do ano de BAIXO. Uma
-- versao que semeasse so o ano do INICIO devolveria zero aqui, e e por isso
-- que o cenario le a data e nao so o numero.
select teste.conferir_como(
  'O periodo de 28/12/2034 a 03/01/2035 devolve 1, e e o 1 de janeiro de 2035',
  :ANA,
  $c$select count(*)::text || '/' || max(data)::text
       from public.feriados_do_periodo('2034-12-28', '2035-01-03')$c$,
  '1/2035-01-01');

select teste.conferir('2034 e 2035 nasceram juntos',
  (select count(*)::text from public.holiday_years where ano in (2034, 2035)), '2');


-- ---------------------------------------------------------------------------
-- O NOME QUE A AGENCIA ESCREVEU SOBREVIVE -- o certo e o plausivel
--
-- `on conflict (data) do nothing` e o que protege o que a agencia ja escreveu
-- naquele dia com outro nome: **o que a agencia escreveu ganha**, que e a
-- frase da 0038.
-- ---------------------------------------------------------------------------

-- A gestao escreve o Natal de 2033 com o nome da casa, ANTES de 2033 ser
-- semeado. `origem` vai EXPLICITA -- o default e `'nacional'`, e uma linha da
-- agencia que herdasse o default seria tratada pela geracao como dela.
select teste.cenario('A gestao grava 25/12/2033 como recesso da casa',
  :ANA,
  $c$insert into public.holidays (data, nome, origem)
     values ('2033-12-25', 'Recesso de fim de ano', 'agencia')$c$,
  'passa');

-- DOZE E NAO TREZE: o Natal conflitou e nao foi contado.
select teste.conferir('Semear 2033 traz 12 linhas, nao 13',
  public.garantir_feriados_nacionais(2033, 2033)::text, '12');

-- ESTA E A CONTAGEM QUE PASSARIA DOS DOIS JEITOS, e e por isso que ela nao
-- esta sozinha: com `do update` o ano tambem fica com treze.
select teste.conferir('O ano de 2033 tem 13 feriados no total',
  (select count(*)::text from public.holidays
    where data between '2033-01-01' and '2033-12-31'), '13');

-- E ESTA E A QUE SEPARA: o nome e a origem continuam sendo os da agencia.
select teste.conferir('E 25/12/2033 continua sendo o recesso da casa',
  (select h.nome || '/' || h.origem from public.holidays h
    where h.data = '2033-12-25'),
  'Recesso de fim de ano/agencia');


-- ---------------------------------------------------------------------------
-- A JANELA TORTA NAO SEMEIA NADA -- o terceiro cenario
--
-- A faixa existe porque esta funcao e chamada de uma LEITURA DE TELA, e o ano
-- dela vem de uma data que pode ter sido colada na URL: sem limite, um
-- `?mes=1900-01` semearia dois seculos por causa de um endereco torto.
--
-- E ELA RECUSA EM VEZ DE GRAMPEAR. Truncar e *aceitar e fazer outra coisa*,
-- que a 0025 diz ser pior que recusar.
-- ---------------------------------------------------------------------------

select teste.conferir('Dois seculos de uma vez devolvem 0',
  public.garantir_feriados_nacionais(1900, 2100)::text, '0');

-- O QUE MEDIR SO O RETORNO NAO PEGARIA: a versao que grampeava devolvia 65 --
-- mas uma que grampeasse para dentro de anos JA semeados devolveria 0 do mesmo
-- jeito. Quem separa e a tabela.
select teste.conferir('E nenhum feriado abaixo do piso nasceu',
  (select count(*)::text from public.holidays where data < '2024-01-01'), '0');

select teste.conferir('E nenhum ano abaixo do piso entrou em holiday_years',
  (select count(*)::text from public.holiday_years where ano < 2024), '0');

-- OS QUATRO MOTIVOS DE RECUSA, cada um com o seu cenario: um `<` no lugar de
-- um `<=` nao aparece em nenhum dos outros.
select teste.conferir('Nulo devolve 0',
  coalesce(public.garantir_feriados_nacionais(null, 2030)::text, '(nulo)'), '0');

select teste.conferir('Janela invertida devolve 0',
  public.garantir_feriados_nacionais(2030, 2029)::text, '0');

select teste.conferir('Onze anos de uma vez devolvem 0',
  public.garantir_feriados_nacionais(2045, 2056)::text, '0');

select teste.conferir('E 2045 continua sem feriado nenhum',
  (select count(*)::text from public.holidays
    where data between '2045-01-01' and '2045-12-31'), '0');

-- AS DUAS PONTAS DA FAIXA SAO INCLUSIVAS, e sao os dois cenarios que um `<` no
-- lugar de um `<=` derruba.
select teste.conferir('2024 e o piso, e ele passa',
  public.garantir_feriados_nacionais(2024, 2024)::text, '13');

select teste.conferir('2023 esta abaixo do piso, e ele nao passa',
  public.garantir_feriados_nacionais(2023, 2023)::text, '0');

select teste.conferir('2060 e o teto, e ele passa',
  public.garantir_feriados_nacionais(2060, 2060)::text, '13');

select teste.conferir('2061 esta acima do teto, e ele nao passa',
  public.garantir_feriados_nacionais(2061, 2061)::text, '0');


-- ---------------------------------------------------------------------------
-- A ORDEM E POR DATA
--
-- `feriados_do_periodo()` ordena no SQL, e a tela desenha na ordem em que
-- recebe: a lista de feriados agrupa por ano e desenha cada um na ordem da
-- leitura. Sem o `order by`, 26/11 sairia acima de 02/10 dentro do mesmo ano.
-- ---------------------------------------------------------------------------

select teste.conferir_como(
  'A leitura de 2027 vem em ordem de data',
  :ANA,
  $c$select (array_agg(data) = array_agg(data order by data))::text
       from public.feriados_do_periodo('2027-01-01', '2027-12-31')$c$,
  'true');


-- ---------------------------------------------------------------------------
-- A ORIGEM E UMA DE DUAS, E NADA MAIS
--
-- Sem o check, um terceiro valor entraria calado -- e a geracao olha a origem
-- para decidir o que ela pode tocar: uma linha com origem desconhecida nao
-- seria nem protegida como da agencia nem regerada como nacional.
-- ---------------------------------------------------------------------------

select teste.recusa_com(
  'Uma terceira origem e recusada pelo check',
  :ANA,
  $c$insert into public.holidays (data, nome, origem)
     values ('2036-07-09', 'Revolucao Constitucionalista', 'municipal')$c$,
  'holidays_origem_conhecida');


-- ---------------------------------------------------------------------------
-- QUEM ESCREVE FERIADO
--
-- `holidays_write` e `is_gestor()` desde a 0011. A 0151 nao a mexeu -- o que
-- ela fez foi dar a ela a primeira tela que a exerce, e e por isso que estes
-- dois cenarios entram agora: ate aqui a policy nunca tinha sido medida.
-- ---------------------------------------------------------------------------

select teste.cenario('O desenvolvedor grava um feriado da casa',
  :DIEGO,
  $c$insert into public.holidays (data, nome, origem)
     values ('2036-11-20', 'Emenda de Zumbi', 'agencia')$c$,
  'passa');

select teste.cenario('O Design nao grava',
  :BRUNO,
  $c$insert into public.holidays (data, nome, origem)
     values ('2036-07-16', 'Aniversario da cidade', 'agencia')$c$,
  'recusa');

select teste.cenario('O Design nao apaga',
  :BRUNO,
  $c$delete from public.holidays where data = '2036-11-20'$c$,
  'recusa');

select teste.conferir('E o feriado do Design nao entrou',
  (select count(*)::text from public.holidays where data = '2036-07-16'), '0');

-- O CLIENTE LE OS FERIADOS, e isso e o desenho: `holidays_select` e
-- `to authenticated using (true)` desde a 0011, porque o Cronograma do portal
-- e a grade do mes de social mostram os mesmos dias. O que ele nao faz e
-- escrever.
select teste.conferir_como('O cliente le os feriados de 2027',
  :JOANA,
  $c$select count(*)::text from public.holidays
      where data between '2027-01-01' and '2027-12-31'$c$,
  '13');

select teste.cenario('E o cliente nao escreve',
  :JOANA,
  $c$insert into public.holidays (data, nome, origem)
     values ('2036-08-15', 'Feriado inventado', 'agencia')$c$,
  'recusa');


-- ---------------------------------------------------------------------------
-- `holiday_years` TEM SELECT E MAIS NADA
--
-- A unica porta de escrita e `garantir_feriados_nacionais()`, que e
-- `security definer` -- e a forma de `notifications`, onde quem escreve e
-- `notificar()`.
--
-- E O QUE ISSO PROTEGE E O OPOSTO DO QUE PARECE: marcar um ano a mao nao
-- acrescenta nada, faz o produto NUNCA semear aquele ano. Um `insert` de 2099
-- aqui deixaria 2099 silenciosamente sem feriado para sempre -- que e o modo
-- de falha da 0038, agora com uma causa que ninguem procuraria.
-- ---------------------------------------------------------------------------

select teste.conferir_como('A gestao le os anos semeados',
  :ANA,
  $c$select (count(*) > 0)::text from public.holiday_years$c$,
  'true');

select teste.recusa_com(
  'Nem o socio marca um ano a mao',
  :ANA,
  $c$insert into public.holiday_years (ano) values (2099)$c$,
  'row-level security');

-- UPDATE E DELETE SEM POLICY NAO ESTOURAM: eles nao acham linha nenhuma. A
-- afirmacao e "zero linhas" e nao "recusado", porque e isso que o Postgres
-- faz -- escrever `recusa` aqui seria um cenario que passa verde no dia em que
-- alguem CRIAR a policy.
do $bloco$
declare
  v_apagou int;
  v_mudou  int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);

  delete from public.holiday_years where ano = 2026;
  get diagnostics v_apagou = row_count;

  update public.holiday_years set gerado_em = now() where ano = 2026;
  get diagnostics v_mudou = row_count;

  reset role;

  perform teste.conferir('O socio nao apaga um ano semeado', v_apagou::text, '0');
  perform teste.conferir('Nem reescreve a data dele',        v_mudou::text,  '0');
end
$bloco$;

select teste.conferir('E 2026 continua semeado depois das duas tentativas',
  (exists (select 1 from public.holiday_years where ano = 2026))::text, 'true');


-- ---------------------------------------------------------------------------
-- OS PRIVILEGIOS DAS TRES FUNCOES
--
-- O fixture do Supabase deixa um `alter default privileges ... grant all on
-- functions to anon` ligado no schema `public`, entao toda funcao nova nasce
-- chamavel sem sessao: o `revoke` de cada uma e o que a fecha. A 0071 e a
-- razao de isto estar escrito -- uma funcao que APAGA nasceu assim e ficou
-- chamavel por `anon` durante quatro dezenas de migrations.
-- ---------------------------------------------------------------------------

select teste.tem_execute('authenticated calcula os feriados de um ano',
  'authenticated', 'public.feriados_nacionais(integer)', true);
select teste.tem_execute('anon NAO calcula',
  'anon', 'public.feriados_nacionais(integer)', false);

select teste.tem_execute('authenticated semeia -- e a leitura de tela que chama',
  'authenticated', 'public.garantir_feriados_nacionais(integer, integer)', true);
select teste.tem_execute('anon NAO semeia',
  'anon', 'public.garantir_feriados_nacionais(integer, integer)', false);
-- `service_role` entra na de semear e so nela: ela e a unica das tres que uma
-- rotina chamaria sem sessao.
select teste.tem_execute('service_role semeia',
  'service_role', 'public.garantir_feriados_nacionais(integer, integer)', true);

select teste.tem_execute('authenticated le o periodo -- e a porta de lib/dados',
  'authenticated', 'public.feriados_do_periodo(date, date)', true);
select teste.tem_execute('anon NAO le o periodo',
  'anon', 'public.feriados_do_periodo(date, date)', false);

-- O PSEUDO-PAPEL `public` NAO PASSA POR `teste.tem_execute`: ele nao e linha
-- de `pg_roles`, e `to_regrole('public')` devolve nulo. Quem responde e o ACL
-- da funcao, onde a concessao a PUBLIC aparece com `grantee = 0`.
select teste.conferir(
  'PUBLIC nao tem execute em nenhuma das tres',
  (select count(*)::text
     from pg_proc p, aclexplode(p.proacl) a
    where p.oid in (
            'public.feriados_nacionais(integer)'::regprocedure,
            'public.garantir_feriados_nacionais(integer, integer)'::regprocedure,
            'public.feriados_do_periodo(date, date)'::regprocedure)
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'),
  '0');


-- ---------------------------------------------------------------------------
-- O QUE ESTE ARQUIVO SEMEOU SAI DAQUI
--
-- `holidays` e lida por `dias_uteis()`, que e lida por `hr_requests`, pela
-- recorrencia e pela carga -- ou seja, por quase todo arquivo da bateria.
-- Deixar 2024, 2032, 2033, 2034, 2035 e 2060 semeados mudaria a conta de um
-- arquivo que ninguem escreveu ainda, e a falha dele apareceria como um numero
-- de dia util errado, tres arquivos adiante, sem nada apontando para ca.
--
-- Os seis anos do fixture e o 2031 da 0151 ficam: eles sao o estado de
-- partida, e o arquivo 17 mede dois deles.
-- ---------------------------------------------------------------------------

delete from public.holidays
 where data >= '2032-01-01'
    or data <  '2025-01-01';

delete from public.holiday_years
 where ano >= 2032 or ano < 2025;

delete from public.holidays where data in ('2036-11-20');

select teste.conferir('A tabela volta aos 91 feriados de 2025 a 2031',
  (select count(*)::text from public.holidays), '91');

select teste.conferir('E aos sete anos semeados',
  (select count(*)::text from public.holiday_years), '7');
