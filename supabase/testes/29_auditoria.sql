-- ===========================================================================
-- 29 - A TRILHA DE AUDITORIA (migration 0058)
--
-- Uma auditoria tem dois jeitos de nao servir para nada, e os dois passam
-- despercebidos:
--
--   1. NAO REGISTRAR o que deveria. A tela abre, mostra vinte linhas, e
--      ninguem desconfia da que falta.
--   2. REGISTRAR PARA QUEM NAO DEVERIA. Ela copia trecho de `finance_entries`
--      e de `contracts`, que fecham em `is_socio()` -- um log legivel pela
--      gestao seria a porta dos fundos daquela regra.
--
-- Os cenarios deste arquivo sao os dois, e o segundo e o que importa mais.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- O QUE ELA REGISTRA
-- ---------------------------------------------------------------------------

-- O ESTADO DE PARTIDA E ESCRITO AQUI, e nao herdado. O arquivo 27 aprendeu
-- isto do jeito ruim: os cenarios afirmam "o valor anterior era Carla Reis", e
-- isso so e verdade na primeira rodada. Sem estas duas linhas o arquivo passa
-- na bateria (que monta o banco do nada) e reprova quando alguem o roda
-- sozinho para conferir uma mudanca -- que e exatamente quando ele precisa
-- responder.
update public.profiles set nome = 'Carla Reis'
 where id = '33333333-3333-3333-3333-333333333333';

delete from public.audit_log;

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.profiles set nome = 'Carla Reis Auditada'
   where id = '33333333-3333-3333-3333-333333333333';
  reset role;
end $$;

select teste.conferir(
  'trocar o nome de alguem vira uma linha de auditoria',
  (select count(*)::text from public.audit_log
    where tabela = 'profiles'
      and registro_id = '33333333-3333-3333-3333-333333333333'),
  '1');

select teste.conferir(
  'a linha diz QUEM mexeu',
  (select quem::text from public.audit_log where tabela = 'profiles' limit 1),
  '11111111-1111-1111-1111-111111111111');

-- SO A COLUNA QUE MUDOU. Duas copias da linha inteira para dizer que uma
-- coluna mudou e uma tela em que ninguem acha a diferenca.
select teste.conferir(
  'guarda so a coluna que mudou, e nao a linha inteira',
  (select (select string_agg(k, ',' order by k) from jsonb_object_keys(depois) k)
     from public.audit_log where tabela = 'profiles' limit 1),
  'nome');

select teste.conferir(
  'guarda o valor anterior',
  (select antes ->> 'nome' from public.audit_log where tabela = 'profiles' limit 1),
  'Carla Reis');


-- UPDATE QUE NAO MUDA NADA NAO REGISTRA NADA. A tela de task salva sozinha
-- campo a campo; sem esta regra, clicar fora de um campo sem digitar geraria
-- uma linha de auditoria por clique.
do $$
begin
  delete from public.audit_log;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  update public.profiles set nome = nome
   where id = '33333333-3333-3333-3333-333333333333';
  reset role;
end $$;

select teste.conferir(
  'update que regrava o mesmo valor nao vira linha',
  (select count(*)::text from public.audit_log),
  '0');


-- ---------------------------------------------------------------------------
-- QUEM LE
--
-- Este bloco e a metade que importa. `finance_entries` fecha em `is_socio()`
-- nos quatro comandos desde a 0013 -- o desenvolvedor e gestao para todo o
-- resto do sistema e ali nao. Se ele lesse a auditoria, leria o valor no
-- `depois` sem nunca tocar na tabela.
-- ---------------------------------------------------------------------------

-- E AQUI O ESTADO DE PARTIDA TAMBEM E ESCRITO, pelo mesmo motivo -- mas este
-- custou mais caro para aparecer. Na primeira versao o arquivo inseria a
-- categoria sem limpar antes, e na segunda rodada ele ESTOURAVA na chave
-- unica: `finance_categories_nome_tipo_key`.
--
-- O que isso escondeu e a parte que importa. A bateria de verdade usa
-- `ON_ERROR_STOP=1` e reprova a rodada, entao lá o erro apareceria. Mas o
-- arnês que eu estava usando para testar as MUTACOES rodava o arquivo com a
-- saida descartada e contava as linhas de `teste.resultado` -- e um arquivo
-- que morre no quinto cenario deixa cinco linhas, todas "passou". Ele
-- respondeu "nenhuma falha" para tres mutacoes seguidas que deveriam ter
-- derrubado cenarios.
--
-- E o modo de falha de sempre, virado contra a propria verificacao: uma
-- checagem que so sabe dizer "ok" nao verifica nada -- nem quando a checagem
-- e a minha.
delete from public.finance_entries where descricao = 'Contrato secreto';
delete from public.finance_categories
 where nome = 'Categoria da auditoria' and tipo = 'receita';
delete from public.tasks where titulo = 'Demanda que vai sumir';

do $$
declare v_cat uuid;
begin
  delete from public.audit_log;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  insert into public.finance_categories (nome, tipo)
  values ('Categoria da auditoria', 'receita')
  returning id into v_cat;
  insert into public.finance_entries
    (tipo, category_id, descricao, valor, competencia, vencimento, criado_por)
  values ('receita', v_cat, 'Contrato secreto', 987654.32, '2026-09-01', '2026-09-10',
          '11111111-1111-1111-1111-111111111111');
  reset role;
end $$;

select teste.conferir(
  'o lancamento financeiro entrou na auditoria',
  (select count(*)::text from public.audit_log where tabela = 'finance_entries'),
  '1');

select teste.conferir_como(
  'o SOCIO le a auditoria',
  '11111111-1111-1111-1111-111111111111',
  'select (count(*) > 0)::text from public.audit_log',
  'true');

-- OS TRES QUE NAO PODEM LER.
select teste.conferir_como(
  'o DESENVOLVEDOR nao le a auditoria (leria o valor sem tocar na tabela)',
  '22222222-2222-2222-2222-222222222222',
  'select count(*)::text from public.audit_log',
  '0');

select teste.conferir_como(
  'o colaborador nao le a auditoria',
  '33333333-3333-3333-3333-333333333333',
  'select count(*)::text from public.audit_log',
  '0');

select teste.conferir_como(
  'o cliente nao le a auditoria',
  '77777777-7777-7777-7777-777777777777',
  'select count(*)::text from public.audit_log',
  '0');


-- ---------------------------------------------------------------------------
-- NINGUEM REESCREVE, NINGUEM APAGA -- NEM O SOCIO
--
-- Um registro que a propria pessoa pode consertar nao registra nada. E a
-- mesma forma de `client_access_log` e de `client_portal_views`.
-- ---------------------------------------------------------------------------

select teste.recusa_com(
  'nem o socio APAGA uma linha da auditoria',
  '11111111-1111-1111-1111-111111111111',
  $$delete from public.audit_log$$,
  'permission denied');

select teste.recusa_com(
  'nem o socio REESCREVE uma linha da auditoria',
  '11111111-1111-1111-1111-111111111111',
  $$update public.audit_log set quem = null$$,
  'permission denied');

select teste.recusa_com(
  'ninguem INSERE na auditoria a mao (so o trigger escreve)',
  '11111111-1111-1111-1111-111111111111',
  $$insert into public.audit_log (tabela, operacao) values ('profiles', 'UPDATE')$$,
  'permission denied');


-- ---------------------------------------------------------------------------
-- O APAGAMENTO, que e o que nao da para reconstruir depois
-- ---------------------------------------------------------------------------

do $$
declare v_task uuid;
begin
  delete from public.audit_log;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     '11111111-1111-1111-1111-111111111111', true);
  insert into public.tasks (titulo, client_id, link_entrega, criado_por)
  values ('Demanda que vai sumir',
          (select id from public.clients limit 1),
          'https://drive.google.com/pasta',
          '11111111-1111-1111-1111-111111111111')
  returning id into v_task;
  delete from public.tasks where id = v_task;
  reset role;
end $$;

select teste.conferir(
  'apagar uma demanda vira linha de auditoria',
  (select count(*)::text from public.audit_log
    where tabela = 'tasks' and operacao = 'DELETE'),
  '1');

-- E O INSERT DELA NAO VIRA. A demanda do dia a dia nao entra: cada mexida
-- numa etapa seria uma linha, e uma tela com trezentas linhas por dia e uma
-- tela que ninguem abre. O que nao da para reconstruir e o apagamento.
select teste.conferir(
  'criar uma demanda NAO vira linha (so o apagamento entra)',
  (select count(*)::text from public.audit_log
    where tabela = 'tasks' and operacao = 'INSERT'),
  '0');


-- ---------------------------------------------------------------------------
-- O QUE FICA DE FORA DE PROPOSITO
--
-- `approval_rounds` nao e auditada: rodada fechada nunca e reescrita nem
-- apagada, e ela ja carrega quem decidiu, quando e com que comentario. Uma
-- copia disso aqui seria uma segunda verdade sobre o mesmo fato.
--
-- O cenario existe para o dia em que alguem acrescentar a tabela a lista
-- achando que faltava -- ele falha e manda ler o cabecalho da 0058.
-- ---------------------------------------------------------------------------

select teste.conferir(
  'approval_rounds fica FORA da auditoria (o produto ja registra a decisao)',
  (select count(*)::text from pg_trigger
    where tgrelid = 'public.approval_rounds'::regclass
      and tgname like 'auditar%'),
  '0');

-- OITO TABELAS COM AS QUATRO OPERACOES, MAIS CINCO SO NO DELETE = 13.
-- O numero esta escrito porque acrescentar uma tabela a lista e uma decisao:
-- este cenario falha, e quem o consertar tem que olhar a lista e dizer por
-- que ela cresceu. Uma tabela que entra sem ninguem notar enche a tela de
-- ruido, e a tela cheia de ruido e a que ninguem abre.
select teste.conferir(
  'a auditoria esta em 13 tabelas: 8 completas e 5 so no apagamento',
  (select count(distinct tgrelid)::text from pg_trigger
    where tgname like 'auditar_%' and not tgisinternal),
  '13');
