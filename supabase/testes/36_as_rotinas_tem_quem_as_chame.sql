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

select teste.limpar();
