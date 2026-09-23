-- ===========================================================================
-- 10 — a bandeira do primeiro acesso
--
-- `profiles.deve_trocar_senha` diz que a conta ainda esta com a senha
-- provisoria -- aquela que alguem da agencia ditou ou colou num chat. Enquanto
-- ela estiver de pe, o sistema inteiro manda a pessoa para /trocar-senha.
--
-- A trava que importa nao e a da tela: e o trigger. Sem ele bastaria um PATCH
-- no PostgREST para marcar a senha como trocada sem ter trocado nada, e a
-- pessoa seguiria com a provisoria, que outra pessoa conhece.
-- ===========================================================================

\set ANA    '''11111111-1111-1111-1111-111111111111'''
\set CARLA  '''33333333-3333-3333-3333-333333333333'''

-- Ponto de partida: a Carla com a bandeira levantada, como quem acabou de ser
-- cadastrada.
update public.profiles set deve_trocar_senha = true
 where id = '33333333-3333-3333-3333-333333333333';

-- ---------------------------------------------------------------------------
-- A propria pessoa nao baixa a bandeira
-- ---------------------------------------------------------------------------
select teste.cenario('A Carla tenta marcar a propria senha como trocada', :CARLA,
  $$update public.profiles set deve_trocar_senha = false
     where id = '33333333-3333-3333-3333-333333333333'$$,
  'ok');

-- O update NAO da erro: o trigger devolve o valor antigo em silencio, como
-- faz com `role`. Quem confere e a leitura depois.
select teste.conferir('...e a bandeira continua de pe',
  (select deve_trocar_senha::text from public.profiles
    where id = '33333333-3333-3333-3333-333333333333'),
  'true');

-- ---------------------------------------------------------------------------
-- Nem o socio
--
-- Parece exagero e nao e: baixar a bandeira de outra pessoa devolveria acesso
-- com a senha provisoria, que o socio tambem conhece -- foi ele que cadastrou.
-- Quem precisa de senha nova pede "Esqueci minha senha".
-- ---------------------------------------------------------------------------
select teste.cenario('A socia tenta baixar a bandeira da Carla', :ANA,
  $$update public.profiles set deve_trocar_senha = false
     where id = '33333333-3333-3333-3333-333333333333'$$,
  'ok');

select teste.conferir('...e a bandeira da Carla continua de pe',
  (select deve_trocar_senha::text from public.profiles
    where id = '33333333-3333-3333-3333-333333333333'),
  'true');

-- ---------------------------------------------------------------------------
-- A chave de servico baixa
--
-- E a unica porta, e ela so e usada pela Server Action que ACABOU de trocar a
-- senha de verdade. Sem sessao, `auth.uid()` e nulo e o trigger deixa passar.
-- ---------------------------------------------------------------------------
reset role;
update public.profiles set deve_trocar_senha = false
 where id = '33333333-3333-3333-3333-333333333333';

select teste.conferir('A chave de servico baixa a bandeira',
  (select deve_trocar_senha::text from public.profiles
    where id = '33333333-3333-3333-3333-333333333333'),
  'false');

-- ---------------------------------------------------------------------------
-- E a protecao de `role` continua valendo
--
-- O trigger cresceu para cuidar de duas colunas. Este cenario existe para a
-- segunda nao ter custado a primeira.
-- ---------------------------------------------------------------------------
select teste.cenario('A Carla tenta se promover a socia', :CARLA,
  $$update public.profiles set role = 'socio'
     where id = '33333333-3333-3333-3333-333333333333'$$,
  'ok');

select teste.conferir('...e continua colaboradora',
  (select role::text from public.profiles
    where id = '33333333-3333-3333-3333-333333333333'),
  'colaborador');

-- E a conta nova nasce com a bandeira levantada. O default da coluna e
-- `false` de proposito -- quem ja existia antes da 0019 nao foi obrigado a
-- trocar nada --, entao quem marca e a criacao da conta.
select teste.conferir('Quem ja existia antes da 0019 nao foi obrigado a trocar',
  (select deve_trocar_senha::text from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'false');
