-- ---------------------------------------------------------------------------
-- LIGAR AS ROTINAS DIARIAS (pg_cron)
--
-- Cole no SQL Editor do Supabase e rode. Antes disso, habilite a extensao:
-- painel do Supabase > Database > Extensions > procure `pg_cron` > ligue.
--
-- DUAS FUNCOES EXISTEM E FUNCIONAM DESDE 2026, E NINGUEM AS CHAMAVA:
-- `gerar_recorrencias()` (0040) e `limpar_rascunhos_abandonados()` (0028). O
-- preco da primeira era o modulo inteiro de recorrencias: a regra guarda a
-- cadencia, a previa mostra as cinco proximas, e a demanda so nascia se alguem
-- abrisse a regra e clicasse. O stories de toda segunda dependia de alguem
-- lembrar toda segunda.
--
-- POR QUE ISTO E SCRIPT E NAO MIGRATION: a extensao se habilita no painel,
-- entao um `create extension` numa migration falharia em qualquer ambiente onde
-- ela nao esteja disponivel -- e migration que nao roda no proximo ambiente nao
-- e migration. E o agendamento nao e schema: e uma escolha de operacao, como
-- decidir aplicar uma migration.
--
-- POR QUE `pg_cron` E NAO GITHUB ACTIONS (decisao do usuario): o agendamento
-- mora DENTRO do banco e a chamada nunca sai dele. Pelo Actions a chave de
-- servico -- que ignora todo o RLS -- teria que virar secret do repositorio, e
-- quem tem permissao de escrita nele pode ler o secret escrevendo um workflow.
-- Aqui nenhuma chave e criada.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- PASSO 1 - Os dois agendamentos
-- ---------------------------------------------------------------------------
--
-- O CRON DO pg_cron E UTC, e a agencia esta em UTC-3: 06:20 e 06:35 aqui sao
-- 03:20 e 03:35 em Sao Paulo -- a madrugada, quando ninguem esta com o board
-- aberto. Os minutos nao sao :00 de proposito, que e a mesma decisao do
-- `hojeNaAgencia()`: fuso escrito por extenso em vez de suposto.
--
-- GERAR PRIMEIRO. As duas rotinas nao se cruzam -- uma cria demanda publicada,
-- a outra apaga rascunho parado ha sete dias --, mas se a segunda falhar a
-- primeira ja aconteceu. Invertida, uma falha na limpeza atrasaria em um dia o
-- stories de segunda.
--
-- `cron.schedule` com o MESMO NOME reescreve o agendamento em vez de criar um
-- segundo, entao rodar isto duas vezes nao duplica nada -- a mesma propriedade
-- que as migrations deste projeto tem por convencao.
select cron.schedule('gerar-recorrencias', '20 6 * * *',
                     'select public.gerar_recorrencias()');

select cron.schedule('limpar-rascunhos',   '35 6 * * *',
                     'select public.limpar_rascunhos_abandonados()');

-- ---------------------------------------------------------------------------
-- PASSO 2 - Conferir
-- ---------------------------------------------------------------------------
--
-- O `pg_cron` roda como o dono do banco, entao os grants da 0071 nao o
-- atrapalham -- e o revoke dela, que e o que tira `limpar_rascunhos_abandonados`
-- do alcance de `anon`, continua valendo nos dois caminhos.
select jobname, schedule, command, active
  from cron.job
 where jobname in ('gerar-recorrencias', 'limpar-rascunhos')
 order by jobname;

-- E o que o produto pergunta, que e a mesma coisa vista pela tela: a faixa de
-- Recorrencias e o bloco de rascunho da Home leem isto para decidir se dizem
-- "a geracao e manual" ou "a demanda nasce de madrugada". Tem que devolver true.
select public.rotinas_agendadas();

-- ---------------------------------------------------------------------------
-- PASSO 3 - Depois da primeira madrugada
-- ---------------------------------------------------------------------------
--
-- `cron.job_run_details` guarda cada execucao com o retorno. E o unico lugar
-- onde se ve que a rotina rodou e nao fez nada por nao haver o que fazer --
-- que e o caso normal e e indistinguivel de nao ter rodado, se ninguem olhar.
select j.jobname, d.status, d.start_time, d.return_message
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
 where j.jobname in ('gerar-recorrencias', 'limpar-rascunhos')
 order by d.start_time desc
 limit 20;

-- ---------------------------------------------------------------------------
-- PARA DESLIGAR
-- ---------------------------------------------------------------------------
-- select cron.unschedule('gerar-recorrencias');
-- select cron.unschedule('limpar-rascunhos');
--
-- Desligando, `rotinas_agendadas()` volta a devolver false e as duas telas
-- voltam a dizer que a geracao e manual -- sozinhas, sem ninguem editar texto.
