-- ===========================================================================
-- 36 - AS ROTINAS TEM QUEM AS CHAME, E QUEM NAO PODE CHAMA-LAS (migration 0071)
--
-- Duas funcoes existiam sem quem as chamasse. Ao dar a elas um chamador -- a
-- rotina diaria, como `service_role` --, apareceu que uma das duas estava
-- aberta para QUALQUER PESSOA: a 0028 criou
-- `limpar_rascunhos_abandonados()` como `security definer`, ela APAGA de
-- `tasks`, e nao escreveu revoke. O Postgres concede `execute` a `public` por
-- padrao, e o PostgREST publica o schema `public` sozinho.
--
-- ESTES CENARIOS MEDEM PRIVILEGIO, E NAO MENSAGEM DE RECUSA, e a distincao e a
-- mesma do `27_limite_de_tentativas.sql`: uma funcao pode recusar por dentro
-- (um `if not is_gestor() then raise`) e continuar executavel -- e aí o que se
-- mediu foi o corpo dela, nao a porta. Aqui a pergunta e se o papel tem
-- `execute`, que e a unica que o PostgREST faz antes de chamar.
--
-- O FURO TINHA A CARA DE "NADA ACONTECEU": um rascunho e de quem o criou e de
-- mais ninguem (0028), entao a pessoa abriria a tela, nao acharia o que
-- escreveu, e concluiria que errou o caminho.
-- ===========================================================================

-- Como `teste.conferir`, mas a pergunta e um privilegio e nao uma linha.
create or replace function teste.tem_execute(
  p_descricao text,
  p_papel     text,
  p_funcao    text,       -- assinatura: 'public.f()'
  p_esperado  boolean
) returns void
language plpgsql
as $$
declare
  tem boolean;
begin
  -- O papel pode nao existir num Postgres sem o fixture do Supabase, e aí
  -- `has_function_privilege` ESTOURA. Um erro aqui seria contado como falha do
  -- produto quando o que falta e o dublê.
  if to_regrole(p_papel) is null then
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'FALHOU', format('o papel %s nao existe neste banco', p_papel));
    return;
  end if;

  select has_function_privilege(p_papel, p_funcao, 'execute') into tem;

  insert into teste.resultado (descricao, situacao, detalhe)
  values (p_descricao,
          case when tem = p_esperado then 'passou' else 'FALHOU' end,
          format('%s %s execute em %s', p_papel,
                 case when tem then 'TEM' else 'nao tem' end, p_funcao));
end;
$$;

-- ---------------------------------------------------------------------------
-- O furo que a 0028 deixou aberto
-- ---------------------------------------------------------------------------
--
-- A chave anon vai no bundle que o navegador baixa: ela e publica por desenho.
-- Com `execute` aqui, um POST em /rest/v1/rpc/limpar_rascunhos_abandonados
-- apagava todo rascunho da agencia SEM SESSAO NENHUMA.
select teste.tem_execute(
  'anon nao apaga os rascunhos da agencia',
  'anon', 'public.limpar_rascunhos_abandonados()', false);

-- E nem o colaborador logado: a limpeza nao e ato de ninguem na tela -- nao
-- existe botao para ela em lugar nenhum do produto.
select teste.tem_execute(
  'colaborador logado nao apaga os rascunhos da agencia',
  'authenticated', 'public.limpar_rascunhos_abandonados()', false);

-- ---------------------------------------------------------------------------
-- E a rotina, que e quem precisa
-- ---------------------------------------------------------------------------
--
-- ESTES DOIS NAO SAO A METADE QUE FALTAVA, e a distincao e do teste de
-- mutacao. Eu escrevi a 0071 acreditando que o cron levaria "permission denied"
-- -- a 0040 fecha em `authenticated`, e `service_role` nao e membro dele. Tirei
-- o grant para ver o cenario cair, e ele PASSOU: `service_role` ja tinha
-- `execute` pelo `alter default privileges` que o Supabase deixa ligado no
-- schema `public`, e o `revoke all from public` da 0040 nao o alcanca.
--
-- Os dois ficam porque medem a outra metade: que a rotina CONSEGUE rodar. Sem
-- eles, um revoke largo demais nos dois de cima passaria verde -- e a rotina
-- falharia calada, toda madrugada, num log que ninguem abre.
select teste.tem_execute(
  'a rotina gera as recorrencias do dia',
  'service_role', 'public.gerar_recorrencias()', true);

select teste.tem_execute(
  'a rotina apaga os rascunhos abandonados',
  'service_role', 'public.limpar_rascunhos_abandonados()', true);

-- E `gerar_recorrencias()` sai de `authenticated` junto, porque nenhuma tela a
-- chama: o botao "Gerar agora" de uma regra chama `gerar_ocorrencia()`, que e
-- outra funcao, de UMA regra, e essa continua onde estava. `security definer`
-- mais `execute` para `authenticated` numa funcao que gera trabalho para a
-- agencia inteira e um botao que nao existe na tela e existe na API.
select teste.tem_execute(
  'o colaborador nao dispara a geracao da agencia inteira',
  'authenticated', 'public.gerar_recorrencias()', false);

-- O ESPELHO, e sem ele os seis de cima passariam num banco onde alguem tivesse
-- revogado `execute` de tudo: `gerar_ocorrencia()` E do botao da tela, e
-- continua alcancavel por quem esta logado. Se um revoke largo passar por aqui,
-- este cenario cai e diz qual.
select teste.tem_execute(
  '"Gerar agora" de UMA regra continua sendo do botao da tela',
  'authenticated', 'public.gerar_ocorrencia(uuid, date)', true);

-- ===========================================================================
-- A TELA PERGUNTA SE A ROTINA RODA (migration 0072)
--
-- As duas faixas do produto -- a de Recorrencias e o bloco de rascunho da Home
-- -- diziam "a geracao e manual" em texto escrito a mao. Com um chamador
-- existindo e o agendamento sendo decisao de operacao, aquele texto passaria a
-- depender de alguem lembrar de troca-lo nos dois sentidos: e a armadilha da
-- tabela de migrations pendentes do CLAUDE.md, num lugar onde um dos dois erros
-- e caríssimo.
--
-- O CENARIO QUE MAIS IMPORTA AQUI E O DA EXTENSAO AUSENTE, e ele e o normal
-- deste arquivo: a bateria roda num Postgres 16 pelado, sem `pg_cron`. Se a
-- funcao estourar em vez de devolver false, a lista de Recorrencias e a Home
-- caem inteiras em todo ambiente onde ninguem habilitou a extensao -- que sao
-- todos, no primeiro dia.
-- ===========================================================================

create or replace function teste.responde(
  p_descricao text,
  p_papel     text,
  p_comando   text,
  p_esperado  text
) returns void
language plpgsql
as $$
declare
  achado text;
begin
  begin
    execute format('set local role %I', p_papel);
    execute p_comando into achado;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'FALHOU', left(sqlerrm, 120));
    return;
  end;

  insert into teste.resultado (descricao, situacao, detalhe)
  values (p_descricao,
          case when coalesce(achado, '(nulo)') = p_esperado then 'passou' else 'FALHOU' end,
          format('esperado %s, achado %s', p_esperado, coalesce(achado, '(nulo)')));
end;
$$;

-- Sem `pg_cron` a resposta e "nao esta agendado", e NAO um erro. O `to_regclass`
-- mais o `execute` dinamico sao o que garante isso: uma referencia direta a
-- `cron.job` no corpo faria o Postgres validar o objeto na criacao da funcao, e
-- a propria migration falharia de cara neste banco.
select teste.responde(
  'sem a extensao, a rotina nao esta agendada -- e isso e resposta, nao erro',
  'authenticated', 'select public.rotinas_agendadas()::text', 'false');

-- E a tela que pergunta e do painel, entao quem esta logado precisa alcancar.
-- Sem este grant as duas faixas cairiam no `console.error` e mostrariam para
-- sempre a frase de "geracao manual", num banco onde ela e falsa.
select teste.tem_execute(
  'a tela do painel consegue perguntar',
  'authenticated', 'public.rotinas_agendadas()', true);

-- O CLIENTE NAO PERGUNTA. Ela nao carrega dado de ninguem, mas tambem nao
-- decide nada no Portal -- e o que nao e da area dele fica fora do alcance por
-- desenho, nao por nao haver o que vazar.
select teste.tem_execute(
  'o cliente nao alcanca a configuracao do painel',
  'anon', 'public.rotinas_agendadas()', false);

select teste.limpar();
