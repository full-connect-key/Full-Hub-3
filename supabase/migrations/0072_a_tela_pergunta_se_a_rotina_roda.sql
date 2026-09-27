-- ---------------------------------------------------------------------------
-- 0072 - A tela PERGUNTA se a rotina roda, em vez de afirmar
-- ---------------------------------------------------------------------------
--
-- DUAS FAIXAS DO PRODUTO DIZEM QUE A GERACAO E MANUAL: a de Recorrencias
-- ("nada nasce de madrugada: quem gera e o Gerar agora de cada regra") e o
-- bloco de rascunho da Home, que desde a 0028 diz que o rascunho esta parado em
-- vez de dizer que ele some amanha.
--
-- As duas eram VERDADE escrita a mao, e a 0071 as deixou na pior situacao
-- possivel: existe um chamador para as rotinas, mas se ele esta ligado ou nao e
-- decisao de operacao -- ninguem edita codigo para agendar. Entao a frase da
-- tela passaria a depender de alguem lembrar de trocar um texto no dia em que
-- o agendamento fosse ligado, e de trocar de volta no dia em que fosse
-- desligado.
--
-- **E ISSO E EXATAMENTE A ARMADILHA QUE O PRODUTO JA PAGOU**, na tabela de
-- migrations pendentes do CLAUDE.md: uma lista escrita em prosa, lida por quem
-- esta em duvida, que ficou errada no dia em que cinco foram aplicadas e
-- ninguem editou o texto. Uma frase de tela mantida a mao envelhece do mesmo
-- jeito -- e pior, porque a frase errada aqui tem uma direcao caríssima: "a
-- demanda nasce de madrugada" faz a pessoa parar de clicar em "Gerar agora", e
-- o cliente descobre no dia da entrega.
--
-- COM O `pg_cron` A PERGUNTA TEM RESPOSTA NO BANCO, e e isso que esta migration
-- destrava. `cron.job` e uma tabela: o agendamento deixa de ser suposicao e
-- passa a ser fato consultavel. Pelo GitHub Actions isso nao existiria -- um
-- secret de repositorio e invisivel para o Postgres, e a tela continuaria
-- adivinhando.
--
-- ---------------------------------------------------------------------------
-- PASSO 1 - `rotinas_agendadas()`
-- ---------------------------------------------------------------------------
--
-- ELA NAO PODE ESTOURAR ONDE `pg_cron` NAO EXISTE, e esse e o requisito que
-- decide a forma dela. A extensao se habilita no painel do Supabase, entao ha
-- tres ambientes em que o schema `cron` nao existe: a bateria (um Postgres 16
-- pelado), qualquer copia nova do banco, e o proprio projeto antes de alguem
-- ligar a extensao. Nos tres a resposta certa e `false` -- "nao esta agendado"
-- --, e nao um erro que derruba a tela de Recorrencias inteira.
--
-- Por isso `to_regclass` antes de tocar na tabela, e por isso a consulta e
-- montada com `execute`: uma referencia direta a `cron.job` no corpo faria o
-- Postgres validar o objeto na criacao da funcao, e a migration falharia de
-- cara num banco sem a extensao. E a razao pela qual toda funcao deste projeto
-- e `plpgsql` e nao `language sql`, vista de outro angulo.
--
-- SECURITY DEFINER porque `cron.job` e do dono do banco e nao se abre para
-- `authenticated` -- ela lista TODO agendamento do projeto, com o comando
-- dentro. O recorte e o que sai daqui: um booleano sobre dois nomes. E a forma
-- de `usuarios_do_meu_cliente()` e de `meus_comodatos()` -- definer para
-- devolver so o agregado.

create or replace function public.rotinas_agendadas()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  quantos integer;
begin
  -- Sem a extensao nao ha agendamento, e isso e uma resposta e nao uma falha.
  if to_regclass('cron.job') is null then
    return false;
  end if;

  -- `active` importa: `cron.schedule` cria ligado, mas um agendamento pausado
  -- existe na tabela e nao roda -- e a tela que olhasse so a existencia diria
  -- que a demanda nasce sozinha numa noite em que nada nasce.
  execute $q$
    select count(*) from cron.job
     where jobname in ('gerar-recorrencias', 'limpar-rascunhos')
       and active
  $q$ into quantos;

  -- OS DOIS, e nao "pelo menos um". As duas faixas do produto fazem a mesma
  -- pergunta, e com um agendamento so uma delas mentiria. Quem ligar apenas uma
  -- rotina ve as duas telas dizendo que a geracao e manual, que e o lado seguro
  -- do erro -- a mesma direcao que a 0071 escolheu.
  return quantos = 2;
end;
$$;

comment on function public.rotinas_agendadas() is
  'true quando as duas rotinas diarias estao agendadas e ativas no pg_cron. Lida pela faixa de Recorrencias e pelo bloco de rascunho da Home, para dizerem a verdade sem ninguem editar texto. Devolve false onde a extensao nao existe.';

-- A equipe inteira le: as duas telas que a chamam sao do painel, e o que ela
-- devolve e um booleano sobre a configuracao do produto -- nao sobre ninguem.
revoke all on function public.rotinas_agendadas() from public;
revoke all on function public.rotinas_agendadas() from anon;
grant execute on function public.rotinas_agendadas() to authenticated;
grant execute on function public.rotinas_agendadas() to service_role;
