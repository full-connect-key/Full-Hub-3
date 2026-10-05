\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

-- ===========================================================================
-- Ajustes 04 -- Lancamento retroativo (migration 0037) e os feriados que o
-- calendario passou a alcancar (migration 0038)
--
-- Ana e socia, Diego desenvolvedor, Carla e Bruno e Marina colaboradores,
-- Joana e cliente.
--
-- A PERGUNTA DESTE ARQUIVO e uma so, e ela e diferente da do 05: la se
-- verifica quem PEDE e quem RESPONDE. Aqui se verifica quem REGISTRA o que ja
-- aconteceu -- um caminho que nao passa por fila nenhuma, nasce aprovado e
-- escreve no saldo de OUTRA pessoa. E o unico lugar do produto onde isso
-- acontece, e por isso ele e o que mais precisa da bateria: a tela esconde a
-- aba de quem nao e gestao, e esconder nao e proteger.
-- ===========================================================================

delete from public.team_presence;
delete from public.hr_requests;
delete from public.notifications;

-- AS DATAS SAEM DE `current_date`, E A ADMISSAO TAMBEM -- e isto nao e estilo,
-- e a 0085. O saldo passou a olhar SO o ciclo de 12 meses corrente, e o ciclo
-- e contado da entrada da pessoa (0039): um periodo escrito em 2025 nao tem
-- como estar no ciclo corrente de hoje, qualquer que seja a admissao, porque o
-- ciclo corrente sempre termina no futuro. Com datas fixas, os cenarios de
-- saldo deste arquivo mediriam uma coisa hoje e outra no ano que vem.
--
-- Ancorado assim, a conta fica sabida: Bruno tem tres ciclos completos e o
-- quarto comecou 60 dias atras, entao o ciclo corrente dele e
-- [current_date - 60, current_date + 305]. Marina tem dois, e o dela virou 20
-- dias atras -- que e o que permite o cenario do descanso atravessando a
-- virada, logo abaixo.
--
-- As recusas puras (permissao, origem, policy) nao dependem de ciclo nenhum, e
-- por isso elas usam datas de qualquer canto do passado -- precisam so ser
-- depois da entrada e antes de hoje.
update public.team_members
   set data_admissao = current_date - interval '3 years' - interval '60 days'
 where user_id = :BRUNO;

update public.team_members
   set data_admissao = current_date - interval '2 years' - interval '20 days'
 where user_id = :MARINA;


-- --- Quem registra ---------------------------------------------------------

select teste.recusa_com('Colaborador nao registra periodo de outra pessoa', :CARLA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date - 50, current_date - 46) $fmt$, :BRUNO),
  'da gestao');

-- O CASO QUE MAIS IMPORTA, e o unico que a tela nao consegue esconder de
-- ninguem: a pessoa registrando o PROPRIO passado. Um registro que nasce
-- aprovado, sem ninguem respondendo, em nome de quem o criou, e o saldo dela
-- virando campo editavel.
select teste.recusa_com('Colaborador nao registra nem o proprio passado', :BRUNO,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date - 50, current_date - 46) $fmt$, :BRUNO),
  'da gestao');

select teste.recusa_com('Cliente nao registra periodo de ninguem', :JOANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date - 50, current_date - 46) $fmt$, :BRUNO),
  'da gestao');

select teste.cenario('A SOCIA registra o periodo do Bruno', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date - 50, current_date - 46, 'Planilha antiga') $fmt$,
    :BRUNO), 'ok');

-- E `is_gestor()`, NAO `is_socio()` como a fila de pedidos. Responder a um
-- pedido e decidir sobre o trabalho de alguem, e isso o produto reserva ao
-- socio; registrar o que ja aconteceu e lancar historico, e travar isso numa
-- pessoa so para a agencia no dia em que ela estiver fora.
select teste.cenario('O DESENVOLVEDOR tambem registra -- aqui ele e gestao', :DIEGO,
  format($fmt$ select public.lancar_periodo(%L, 'ausencia', current_date - 40, current_date - 40, 'Avisou por mensagem') $fmt$,
    :MARINA), 'ok');


-- --- O que o registro carrega ----------------------------------------------

select teste.conferir('O registro nasce aprovado, sem ninguem responder',
  (select status::text from public.hr_requests
    where user_id = :BRUNO and data_inicio = current_date - 50), 'aprovada');

select teste.conferir('A origem diz que foi lancamento, e nao pedido',
  (select origem::text from public.hr_requests
    where user_id = :BRUNO and data_inicio = current_date - 50), 'lancamento_retroativo');

select teste.conferir('Quem lancou fica gravado na linha',
  (select lancado_por::text from public.hr_requests
    where user_id = :BRUNO and data_inicio = current_date - 50),
  '11111111-1111-1111-1111-111111111111');

-- O NUMERO SAI DE `dias_do_pedido()`, NUNCA DO PARAMETRO. Se viesse de quem
-- chamou, bastaria mandar 1 num periodo de quinze dias para o saldo nao mexer.
-- De -50 a -46 sao cinco dias CORRIDOS -- descanso conta corrido.
select teste.conferir('O descanso conta corrido, e o numero vem do banco',
  (select dias_uteis::text from public.hr_requests
    where user_id = :BRUNO and data_inicio = current_date - 50), '5');

select teste.conferir('O registro pinta os cinco dias na matriz',
  (select count(*)::text from public.team_presence p
     join public.hr_requests r on r.id = p.hr_request_id
    where r.user_id = :BRUNO and r.data_inicio = current_date - 50), '5');

-- E O PONTO INTEIRO DO MODULO: sem descontar, quem tirou cinco dias dentro
-- deste ciclo apareceria com o saldo cheio.
select teste.conferir('O saldo do Bruno caiu cinco dias', public.saldo_de_ferias(:BRUNO)::text, '10');

select teste.conferir('Tres ciclos completos, e eles nao somam dias',
  public.ciclos_de_descanso(:BRUNO)::text, '3');

-- E ELE E O DO CICLO, NAO O DA VIDA (0085). Com a soma da 0039, Bruno -- que
-- tem tres ciclos completos -- teria 45 menos 5. Estes cenarios sao os que
-- acusam quem devolver o `por_ciclo * ciclos`.
--
-- `descanso_do_ciclo()` E A FUNCAO QUE A TELA LE, e ela nao tinha cenario
-- nenhum antes da 0085 -- o que e um buraco, porque e ela que escreve a frase
-- do saldo e a barra de uso. Vai por `conferir_como` e nao por `conferir`:
-- ela e `security definer` com `is_staff()` na porta, e avaliada como dono do
-- banco -- sem sessao -- ela recusa a si mesma.
select teste.conferir_como('O concedido e de um ciclo, nao a soma dos tres', :BRUNO,
  format($fmt$ select dias_concedidos::text from public.descanso_do_ciclo(%L) $fmt$, :BRUNO), '15');

select teste.conferir_como('E o usado que a tela mostra e o do ciclo', :BRUNO,
  format($fmt$ select dias_usados::text from public.descanso_do_ciclo(%L) $fmt$, :BRUNO), '5');

-- A PORTA DELA CONTINUA SENDO `is_staff()`, e o `drop`/`create` da 0085 e
-- exatamente o lugar onde uma guarda se perde: a funcao foi reescrita inteira.
select teste.recusa_com('Cliente nao le o saldo de descanso de ninguem', :JOANA,
  format($fmt$ select * from public.descanso_do_ciclo(%L) $fmt$, :BRUNO),
  'da equipe');

-- O QUE MUDOU COM A 0039, e o cenario existe para marcar isso: nao ha "saldo
-- de 2026" separado. O ciclo e contado da entrada da pessoa, e nao do
-- calendario.
select teste.conferir('E nao existe mais um saldo por ano ao lado deste',
  (select count(*)::text from pg_proc
    where proname = 'saldo_de_ferias' and pronargs = 2), '0');


-- --- O descanso NAO ACUMULA, e e isto que a 0085 trocou --------------------

-- O LANCAMENTO DE CICLO ANTERIOR NAO MEXE NO SALDO DE HOJE. Ele continua na
-- matriz, no relatorio e na folha da pessoa -- o que ele nao faz e cobrar dias
-- de um bloco que ja se restaurou. Era o contrario ate a 0085: o saldo corria,
-- e um descanso de tres anos atras continuava descontando para sempre.
--
-- *Este e o cenario virado do avesso*: ele existia para provar que o
-- lancamento descontava "no ciclo seguinte tambem", e hoje prova que nao.
-- Devolvendo a soma, ou tirando o recorte `data_inicio >= comeca` de
-- `descanso_usado_no_ciclo()`, ele cai e diz qual.
select teste.cenario('Um descanso do ciclo passado, lancado agora', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date - 150, current_date - 146, 'Planilha do ciclo passado') $fmt$,
    :BRUNO), 'ok');

select teste.conferir('Ele fica gravado, com os cinco dias dele',
  (select dias_uteis::text from public.hr_requests
    where user_id = :BRUNO and data_inicio = current_date - 150), '5');

select teste.conferir('E o saldo de hoje NAO se move: o ciclo ja se restaurou',
  public.saldo_de_ferias(:BRUNO)::text, '10');

select teste.conferir('O usado do ciclo conta so o que comecou dentro dele',
  public.descanso_usado_no_ciclo(:BRUNO)::text, '5');

-- E A PARCELA TAMBEM SE RESTAURA. Com as parcelas somando, Bruno teria seis --
-- tres ciclos de duas -- e poderia partir quinze dias em seis vezes, o que a
-- propria frase da recusa ja negava ao dizer "por ciclo de 12 meses".
select teste.conferir('Duas parcelas por ciclo, e nao seis em tres ciclos',
  public.parcelas_concedidas(:BRUNO)::text, '2');

select teste.conferir('E a usada tambem e a do ciclo: uma, nao duas',
  public.parcelas_no_ciclo(:BRUNO)::text, '1');


-- --- A virada do CICLO: o pedido pertence a onde ele comeca ----------------

-- A COLUNA `ano_referencia` FOI APAGADA pela 0039, e nao aposentada -- mesma
-- decisao da 0023 com `tasks.exigencia_aprovacao`. Este cenario e o que
-- acusaria alguem ressuscitando-a achando que ainda significa alguma coisa.
select teste.conferir('A coluna ano_referencia nao existe mais',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'hr_requests'
      and column_name = 'ano_referencia'), '0');

-- ERA A VIRADA DO ANO, E AGORA E A DO CICLO -- a pergunta sobreviveu a troca
-- de ancora. O ciclo de Marina virou 20 dias atras, e este descanso comeca 23
-- dias atras e termina 19: ele atravessa o aniversario dela.
--
-- O RECORTE E `data_inicio`, ENTAO ELE CONTA UMA VEZ SO, no ciclo de onde
-- saiu. Contando dia a dia, os dias -20 e -19 cairiam no ciclo novo tambem --
-- duas contas de saldo para o mesmo pedido, que e exatamente o que a 0039
-- desfez ao tirar a trava do descanso atravessando o ano.
select teste.cenario('Descanso atravessando a virada do ciclo dela', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date - 23, current_date - 19, 'Virada') $fmt$,
    :MARINA), 'ok');

select teste.conferir('Os cinco dias dela ficaram no ciclo de onde sairam',
  public.saldo_de_ferias(:MARINA)::text, '15');

-- E AQUI OS DOIS JEITOS DE CONTAR SE SEPARAM, que e o que faz o cenario de
-- cima medir alguma coisa. Com o recorte pelo `data_inicio`, o saldo dela
-- perde so estes tres dias: 12. Com o recorte pelo `data_fim` -- que e a
-- implementacao errada mais provavel, porque parece a mesma coisa -- o
-- descanso da virada e contado INTEIRO nos dois ciclos, e o numero sai 7 aqui
-- e 10 no cenario de cima. Medido: trocando a coluna, os dois caem.
select teste.cenario('E um descanso de tres dias, todo dentro do ciclo novo', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date - 15, current_date - 13, 'Dentro do ciclo') $fmt$,
    :MARINA), 'ok');

select teste.conferir('So os tres descontam -- a virada nao trouxe os outros dois',
  public.saldo_de_ferias(:MARINA)::text, '12');


-- --- O que o lancamento recusa ---------------------------------------------

-- A TRAVA QUE A TELA ESPELHA. O calendario da aba recusa de hoje em diante, e
-- a frase dele diz "ja terminou" e nao "ja comecou" por causa desta linha: o
-- banco olha `data_fim >= current_date`. Com a tela recusando so o futuro, um
-- periodo terminando hoje passava pelo clique e morria no botao.
select teste.recusa_com('Periodo que termina hoje ainda nao terminou', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ausencia', current_date - 2, current_date) $fmt$, :BRUNO),
  'ja terminou');

select teste.recusa_com('Periodo que ainda vai acontecer nao se registra', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date + 10, current_date + 14) $fmt$, :BRUNO),
  'ja terminou');

select teste.recusa_com_dica('E a recusa manda para a aba certa', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date + 10, current_date + 14) $fmt$, :BRUNO),
  'Solicitar');

-- Registrar descanso de antes de a pessoa entrar na equipe nao e um caso
-- limite -- e um erro de digitacao no ano, que e o erro mais provavel de quem
-- esta copiando uma planilha antiga.
--
-- AQUI A DATA E FIXA DE PROPOSITO: a recusa nomeia a admissao por extenso, e o
-- cenario confere a frase. Ela nao passa por conta de ciclo nenhuma.
update public.team_members set data_admissao = '2025-06-01' where user_id = :CARLA;

select teste.recusa_com('Periodo anterior a entrada da pessoa e recusado', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', '2025-02-03', '2025-02-07') $fmt$, :CARLA),
  'antes da entrada');

-- E a mensagem NOMEIA as duas datas: "e anterior a admissao" manda a pessoa
-- procurar qual e a admissao em outra tela.
select teste.recusa_com('E a recusa diz as duas datas', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', '2025-02-03', '2025-02-07') $fmt$, :CARLA),
  '01/06/2025');

update public.team_members
   set data_admissao = current_date - interval '14 months' where user_id = :CARLA;

-- `lancar_periodo` NAO e a porta do pedido normal. Sem esta recusa, ela seria
-- um jeito de a gestao criar pedido ja aprovado sem passar pela fila.
select teste.recusa_com('A funcao de lancar nao cria pedido normal', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ferias', current_date - 300, current_date - 296, null, 'solicitacao') $fmt$,
    :BRUNO), 'aba Solicitar');

-- SOBREPOSICAO: a mensagem muda de pessoa. No pedido ela diz "Voce ja tem";
-- no lancamento quem le e a gestao, e o periodo e de outra pessoa.
select teste.recusa_com('Lancar em cima de periodo ja combinado e recusado', :ANA,
  format($fmt$ select public.lancar_periodo(%L, 'ausencia', current_date - 48, current_date - 48) $fmt$, :BRUNO),
  'Esta pessoa ja tem');


-- --- A policy, para quem monta o INSERT a mao ------------------------------

-- A TRAVA NAO E A FUNCAO, E A POLICY. Quem chamar o PostgREST direto nao passa
-- por `lancar_periodo()` nenhuma: monta o insert e manda. Este e o cenario que
-- prova que a segunda camada existe.
select teste.cenario('Colaborador nao grava origem de lancamento no insert cru', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, status, origem)
    values (%L, 'ferias', current_date - 400, current_date - 396, 5, 'aprovada', 'lancamento_retroativo')
  $fmt$, :BRUNO), 'recusa');

-- DATAS DIFERENTES DO CENARIO ACIMA, e nao por variedade. Com as mesmas, se
-- a policy fosse afrouxada o primeiro insert passaria, e este esbarraria na
-- SOBREPOSICAO -- recusado pelo motivo errado, e contado como aprovado. Foi o
-- que apareceu ao mutar a policy de proposito para ver se a bateria mordia:
-- ela mordeu num cenario e passou no outro.
select teste.cenario('Nem com origem de importacao', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, status, origem)
    values (%L, 'ferias', current_date - 380, current_date - 376, 5, 'aprovada', 'importacao')
  $fmt$, :BRUNO), 'recusa');

-- A POLICY E UMA SO COM DOIS RAMOS, e este cenario e o que acusaria se alguem
-- a partisse em duas permissivas: com duas, a de pedido casaria sozinha e o
-- colaborador gravaria qualquer origem. Aqui ele grava o caminho legitimo, e
-- os dois acima continuam recusados -- sao os tres juntos que provam a regra.
select teste.cenario('E o pedido normal dele continua passando', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, motivo)
    values (%L, 'ausencia', current_date + 30, current_date + 30, 1, 'Consulta')
  $fmt$, :BRUNO), 'ok', 1);


-- --- Corrigir --------------------------------------------------------------

select teste.recusa_com('Colaborador nao corrige lancamento', :BRUNO,
  format($fmt$
    select public.corrigir_lancamento(
      (select id from public.hr_requests where user_id = %L and data_inicio = current_date - 50),
      current_date - 50, current_date - 47)
  $fmt$, :BRUNO), 'da gestao');

select teste.cenario('A gestao encurta o periodo de cinco para quatro dias', :DIEGO,
  format($fmt$
    select public.corrigir_lancamento(
      (select id from public.hr_requests where user_id = %L and data_inicio = current_date - 50),
      current_date - 50, current_date - 47, 'Planilha conferida')
  $fmt$, :BRUNO), 'ok');

select teste.conferir('O numero foi RECALCULADO, nao aceito do parametro',
  (select dias_uteis::text from public.hr_requests
    where user_id = :BRUNO and data_inicio = current_date - 50), '4');

-- SEM O REPINTAR, o ultimo dia continuaria pintado na matriz e o saldo diria
-- quatro: duas verdades sobre o mesmo dia, e ninguem saberia qual olhar.
select teste.conferir('E a matriz perdeu o quinto dia junto',
  (select count(*)::text from public.team_presence p
     join public.hr_requests r on r.id = p.hr_request_id
    where r.user_id = :BRUNO and r.data_inicio = current_date - 50), '4');

select teste.conferir('O saldo acompanhou a correcao',
  public.saldo_de_ferias(:BRUNO)::text, '11');


-- PEDIDO DECIDIDO NAO SE REESCREVE. Corrigir por fora um periodo que a pessoa
-- propos e o socio respondeu apagaria a decisao dele sem deixar marca.
select teste.cenario('Um pedido do Bruno, para os dois cenarios seguintes', :BRUNO,
  format($fmt$
    insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, motivo)
    values (%L, 'ferias', current_date + 60, current_date + 64, 5, 'Pedido de verdade')
  $fmt$, :BRUNO), 'ok', 1);

select teste.recusa_com('Corrigir nao alcanca pedido, nem para a socia', :ANA,
  format($fmt$
    select public.corrigir_lancamento(
      (select id from public.hr_requests where user_id = %L and motivo = 'Pedido de verdade'),
      current_date + 60, current_date + 62)
  $fmt$, :BRUNO), 'nao se reescreve');


-- --- Apagar ----------------------------------------------------------------

select teste.recusa_com('Colaborador nao apaga lancamento', :BRUNO,
  format($fmt$
    select public.apagar_lancamento(
      (select id from public.hr_requests where user_id = %L and data_inicio = current_date - 50))
  $fmt$, :BRUNO), 'da gestao');

select teste.recusa_com('Apagar nao alcanca pedido -- pedido se cancela', :ANA,
  format($fmt$
    select public.apagar_lancamento(
      (select id from public.hr_requests where user_id = %L and motivo = 'Pedido de verdade'))
  $fmt$, :BRUNO), 'historico de RH');

select teste.cenario('A gestao apaga o lancamento', :ANA,
  format($fmt$
    select public.apagar_lancamento(
      (select id from public.hr_requests where user_id = %L and data_inicio = current_date - 50))
  $fmt$, :BRUNO), 'ok');

-- `team_presence.hr_request_id` NAO tem cascade. Sem o delete dentro da
-- funcao, os dias ficariam pintados apontando para um registro que nao existe
-- mais, e a matriz mostraria descanso de alguem que o sistema ja esqueceu.
select teste.conferir('E os dias saem da matriz junto',
  (select count(*)::text from public.team_presence
    where user_id = :BRUNO and data between current_date - 50 and current_date - 46), '0');

-- "Inteiro" MENOS OS CINCO DO PEDIDO DE VERDADE, que continua pendente logo
-- acima. Pendente conta como usado -- sem isso a pessoa proporia o mesmo
-- periodo duas vezes enquanto o primeiro espera retorno.
--
-- E O DO CICLO PASSADO CONTINUA FORA DA CONTA, que e a 0085: apagar o
-- lancamento deste ciclo devolve os dias dele, e nao os de tres ciclos atras.
select teste.conferir('O saldo do Bruno voltou, menos o pedido que segue de pe',
  public.saldo_de_ferias(:BRUNO)::text, '10');

-- O DELETE CRU tambem e barrado, e por outra policy: a de delete exige gestao
-- E origem de lancamento. Sem o segundo pedaco, a gestao apagaria pedido
-- decidido pelo PostgREST, contornando a funcao que acabou de recusar.
select teste.cenario('Nem a socia apaga pedido pelo delete cru', :ANA,
  format($fmt$
    delete from public.hr_requests where user_id = %L and motivo = 'Pedido de verdade'
  $fmt$, :BRUNO), 'recusa');


-- --- O bloqueio por area nao olha o passado --------------------------------

-- Com o historico lancado, sem o filtro de data a agencia inteira ficaria
-- bloqueada para tras: cada descanso ja registrado viraria um dia que ninguem
-- da mesma area pode escolher, para sempre.
select teste.conferir('Dia ja passado e lancado nao bloqueia o calendario de ninguem',
  (select count(*)::text from public.dias_bloqueados_da_area(:CARLA, current_date - 60, current_date - 1)
    where dia = current_date - 21), '0');


-- A ADMISSAO VOLTA PARA A DA FIXTURE, como no 05: os arquivos seguintes
-- esperam a equipe inteira com catorze meses de casa, e deixar Bruno com tres
-- anos aqui seria um cenario de outro arquivo medindo um ciclo que este mexeu.
update public.team_members
   set data_admissao = current_date - interval '14 months'
 where user_id in (:BRUNO, :MARINA, :CARLA);


-- --- Os feriados que o calendario passou a alcancar (0038) ------------------

-- A 0011 cobria 2026 e 2027, que eram os anos que o calendario de entao
-- alcancava. ANO SEM FERIADO NA TABELA NAO APARECE VAZIO, APARECE NORMAL: o
-- Natal vira um dia util qualquer e a contagem sai maior, sem nada avisando.
select teste.conferir('2025 tem os 13 feriados nacionais',
  (select count(*)::text from public.holidays
    where data between '2025-01-01' and '2025-12-31'), '13');

select teste.conferir('2030 tambem, e e a ultima ponta do calendario',
  (select count(*)::text from public.holidays
    where data between '2030-01-01' and '2030-12-31'), '13');

-- As moveis saem da Pascoa, e errar o algoritmo daria um Carnaval em cima de
-- um dia util qualquer -- que e justamente o erro que ninguem confere.
select teste.conferir('O Carnaval de 2025 caiu em 3 e 4 de marco',
  (select count(*)::text from public.holidays
    where nome = 'Carnaval' and data in ('2025-03-03', '2025-03-04')), '2');

select teste.conferir('Corpus Christi de 2029 caiu em 31 de maio',
  (select nome from public.holidays where data = '2029-05-31'), 'Corpus Christi');

select teste.conferir('O Natal de 2029 nao e dia util',
  public.dias_uteis('2029-12-25', '2029-12-25')::text, '0');

-- 2028 e bissexto e o Carnaval cai em 28 e 29 de fevereiro. Uma conta de
-- Pascoa que ignorasse o 29 jogaria a terca para 1 de marco.
select teste.conferir('O Carnaval de 2028 pega o 29 de fevereiro',
  (select nome from public.holidays where data = '2028-02-29'), 'Carnaval');
