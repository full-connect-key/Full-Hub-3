-- ---------------------------------------------------------------------------
-- 0056 - LIMITE DE TENTATIVAS (Sprint 16, Parte E)
--
-- O login, a recuperacao de senha e o campo de comentario eram as tres portas
-- que aceitavam repeticao sem limite nenhum. As duas primeiras ficam na
-- internet aberta, antes de qualquer sessao: quem tiver a lista de e-mails da
-- agencia -- que esta no rodape do site dela -- podia tentar senha a noite
-- inteira sem nada contando.
--
-- O Supabase tem um limite proprio no `signInWithPassword`, e ele continua de
-- pe. Mas ele e do PROJETO e nao da conta: generoso de proposito, porque a
-- mesma chave serve um app com mil usuarios e este, que tem nove. Contar aqui
-- e o que permite um numero que faz sentido para esta agencia.
--
-- ---------------------------------------------------------------------------
-- A JANELA E FIXA, E A CONTA E UM `INSERT ... ON CONFLICT` SO
--
-- E a mesma licao da idempotencia da recorrencia (0040): `select` e depois
-- `update` passa nos testes sequenciais e falha na vida real, porque duas
-- requisicoes ao mesmo tempo leem as duas antes de qualquer uma gravar --
-- e o limite de dez vira vinte. Aqui a conta inteira acontece dentro de um
-- comando, entao o Postgres serializa as duas pela chave primaria.
--
-- Janela FIXA e nao deslizante: a deslizante guarda um registro por tentativa
-- para saber quantas cabem na ultima hora, e isso e uma tabela que cresce com
-- o ataque. A fixa guarda UMA linha por chave. O custo e conhecido -- quem
-- gastou a cota no comeco da janela espera menos que quem gastou no fim --
-- e para bloquear repeticao automatica nao muda nada.
--
-- ---------------------------------------------------------------------------
-- QUEM PODE CHAMAR: SO A CHAVE DE SERVICO, E ISSO E A METADE DA PROTECAO
--
-- O Supabase concede EXECUTE de toda funcao nova para `anon` e para
-- `authenticated` por default privileges. Deixar como esta seria entregar a
-- arma junto com a trava: qualquer navegador com a chave anon -- que vai no
-- bundle, e e publica -- chamaria esta funcao com a chave de OUTRA pessoa ate
-- estourar a cota dela. O limite que protege o login viraria o jeito mais
-- facil de trancar alguem para fora.
--
-- Por isso o `revoke`, e por isso a funcao e `security invoker` (o padrao):
-- sao duas travas independentes. Mesmo que alguem devolva o grant, a RLS da
-- tabela -- ligada e SEM POLICY NENHUMA -- recusa a escrita, porque quem
-- chama nao e a chave de servico. A bateria guarda as duas.
--
-- A tabela sem policy e deliberada e nao esquecimento: "ligue RLS em toda
-- tabela nova" existe para nenhuma tabela ficar legivel pela chave anon, e
-- aqui a resposta certa e que ninguem le. A chave de servico ignora RLS por
-- desenho, e ela e a unica que entra.
--
-- ---------------------------------------------------------------------------
-- A LIMPEZA ACONTECE NA PROPRIA CHAMADA
--
-- Este produto ja tem duas rotinas que "nao rodam sozinhas" -- a limpeza de
-- rascunhos e a geracao de recorrencias --, e as duas estao registradas no
-- CLAUDE.md esperando um agendamento que e de outro sprint. Uma terceira
-- seria uma tabela que cresce para sempre porque o agendador nunca chegou.
--
-- Aqui da para evitar: a linha expirada e apagada na proxima chamada, com
-- indice, e o custo e uma varredura de faixa numa tabela pequena. Ela e
-- pequena porque so a chave de servico escreve nela -- a quantidade de linhas
-- e a quantidade de IPs e e-mails reais que bateram na porta, nao a
-- quantidade de chaves que alguem resolveu inventar.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  chave         text        primary key,
  janela_inicio timestamptz not null default now(),
  tentativas    integer     not null default 0
);

comment on table public.rate_limits is
  'Contador de tentativas por chave (0056). So a chave de servico escreve: '
  'RLS ligada sem policy nenhuma, e EXECUTE revogado de anon e authenticated.';

comment on column public.rate_limits.chave is
  'O que esta sendo contado -- `login:ip:1.2.3.4`, `login:email:...`, '
  '`comentario:<uuid>`. Quem monta a chave e o servidor, nunca o navegador.';

create index if not exists rate_limits_janela on public.rate_limits (janela_inicio);

alter table public.rate_limits enable row level security;

-- Sem policy: ninguem alcanca esta tabela pela API. A chave de servico passa
-- porque ignora RLS, e e a unica que chama.
revoke all on public.rate_limits from anon, authenticated;


-- ---------------------------------------------------------------------------
-- consumir_tentativa(chave, max, janela)
--
-- Gasta uma tentativa e diz se ela cabia. `permitido` falso quer dizer que
-- ESTA tentativa ja passou do teto -- quem chama recusa sem fazer o trabalho.
--
-- `espere_segundos` existe para a frase da tela. "Tente mais tarde" manda a
-- pessoa adivinhar e insistir; "aguarde 12 minutos" ela resolve com uma
-- xicara de cafe.
-- ---------------------------------------------------------------------------
create or replace function public.consumir_tentativa(
  p_chave   text,
  p_max     integer,
  p_janela  interval
)
returns table (permitido boolean, tentativas integer, espere_segundos integer)
language plpgsql
as $fn$
declare
  v_chave      text;
  v_tentativas integer;
  v_inicio     timestamptz;
begin
  if p_chave is null or btrim(p_chave) = '' then
    raise exception 'consumir_tentativa precisa de uma chave';
  end if;
  if p_max is null or p_max < 1 then
    raise exception 'consumir_tentativa precisa de um teto de pelo menos 1';
  end if;

  -- O TETO DE TAMANHO E PARA A CHAVE NAO VIRAR O DEPOSITO. Ela e montada no
  -- servidor, mas um e-mail digitado entra nela, e campo de texto sem limite
  -- e linha de tabela sem limite.
  v_chave := left(p_chave, 200);

  delete from public.rate_limits
   where janela_inicio < now() - greatest(p_janela, interval '1 hour');

  -- A CONTA INTEIRA NUM COMANDO SO. Ver o cabecalho: separada em duas, duas
  -- requisicoes simultaneas passam pelas duas leituras antes de qualquer uma
  -- gravar, e o teto de dez aceita vinte.
  insert into public.rate_limits as r (chave, janela_inicio, tentativas)
  values (v_chave, now(), 1)
  on conflict (chave) do update
     set tentativas = case
           when r.janela_inicio < now() - p_janela then 1
           else r.tentativas + 1
         end,
         janela_inicio = case
           when r.janela_inicio < now() - p_janela then now()
           else r.janela_inicio
         end
  returning r.tentativas, r.janela_inicio into v_tentativas, v_inicio;

  return query
  select
    v_tentativas <= p_max,
    v_tentativas,
    greatest(0, ceil(extract(epoch from (v_inicio + p_janela - now())))::integer);
end;
$fn$;


-- ---------------------------------------------------------------------------
-- perdoar_tentativas(chave)
--
-- O LOGIN QUE DA CERTO DEVOLVE A COTA, e e o que separa "contar tentativa" de
-- "contar erro". Sem isto, quem entra e sai cinco vezes num dia de trabalho
-- -- trocando de navegador, testando o portal de um cliente -- gastaria a
-- mesma cota de quem esta adivinhando senha, e levaria a recusa no meio do
-- expediente sem ter errado nada.
--
-- A recuperacao de senha NAO perdoa, e e de proposito: a resposta dela e
-- identica havendo conta ou nao, entao nao existe ali um "deu certo" em que
-- este lado possa confiar. O teto dela e o que impede usar o Full Hub para
-- encher a caixa de entrada de alguem.
-- ---------------------------------------------------------------------------
create or replace function public.perdoar_tentativas(p_chave text)
returns void
language plpgsql
as $fn$
begin
  delete from public.rate_limits where chave = left(p_chave, 200);
end;
$fn$;


-- A PARTE QUE NAO PODE FALTAR. Sem ela, o default privilege do Supabase
-- entrega estas duas funcoes para qualquer navegador com a chave anon.
revoke all on function public.consumir_tentativa(text, integer, interval)
  from public, anon, authenticated;
revoke all on function public.perdoar_tentativas(text)
  from public, anon, authenticated;

grant execute on function public.consumir_tentativa(text, integer, interval)
  to service_role;
grant execute on function public.perdoar_tentativas(text)
  to service_role;
grant all on public.rate_limits to service_role;
