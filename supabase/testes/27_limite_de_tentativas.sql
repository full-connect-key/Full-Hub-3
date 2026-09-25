-- ===========================================================================
-- 27 - O LIMITE DE TENTATIVAS (migration 0056)
--
-- O que esta bateria guarda, em uma frase: a trava do login nao pode ser
-- alcancavel por quem ela existe para barrar.
--
-- O Supabase concede EXECUTE de toda funcao nova para `anon` e para
-- `authenticated` por default privileges. Se alguem devolver esse grant -- ou
-- criar a proxima funcao sem o `revoke` --, qualquer navegador com a chave
-- anon (que e publica, vai no bundle) chama `consumir_tentativa` com a chave
-- de OUTRA pessoa ate estourar a cota dela. O limite que protege o login vira
-- o jeito mais facil de trancar alguem para fora.
--
-- Os dois primeiros cenarios sao esse. Eles nao testam funcionalidade nenhuma:
-- testam que uma porta continua fechada.
-- ===========================================================================

-- Rodar como a chave de servico, que e quem chama estas funcoes de verdade.
-- `service_role` tem `bypassrls` no fixture, como no Supabase.
create or replace function teste.conferir_como_servico(
  p_descricao text,
  p_expressao text,
  p_esperado  text
) returns void
language plpgsql
as $$
declare
  achado text;
begin
  begin
    execute 'set local role service_role';
    execute p_expressao into achado;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'FALHOU', left(sqlerrm, 120));
    return;
  end;

  insert into teste.resultado (descricao, situacao, detalhe)
  values (p_descricao,
          case when achado is not distinct from p_esperado then 'passou' else 'FALHOU' end,
          format('esperado %s, achado %s',
                 coalesce(p_esperado, '(nulo)'), coalesce(achado, '(nulo)')));
end;
$$;

-- Recusa rodando como `anon` -- a chave publica, sem sessao. O login acontece
-- antes de existir usuario, entao este e o papel de quem esta na tela.
create or replace function teste.recusa_como_anon(
  p_descricao text,
  p_comando   text,
  p_trecho    text
) returns void
language plpgsql
as $$
begin
  begin
    execute 'set local role anon';
    execute p_comando;
    execute 'reset role';
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'FALHOU', 'passou quando devia ser recusado');
  exception when others then
    execute 'reset role';
    if position(lower(p_trecho) in lower(sqlerrm)) > 0 then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', left(sqlerrm, 90));
    else
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU',
              format('recusou por outro motivo: %s', left(sqlerrm, 100)));
    end if;
  end;
end;
$$;


-- O ESTADO LIMPO NO COMECO, e nao e zelo: os cenarios de contagem afirmam
-- "a terceira e a ultima que cabe", e isso so e verdade a partir do zero. Sem
-- esta linha o arquivo passa na bateria (que monta o banco do nada) e falha
-- quando alguem o roda sozinho para conferir uma mudanca -- que e exatamente
-- quando ele precisa responder.
delete from public.rate_limits where chave like 't:%';

-- ---------------------------------------------------------------------------
-- A PORTA FECHADA
-- ---------------------------------------------------------------------------

select teste.recusa_como_anon(
  'anon NAO chama consumir_tentativa (seria trancar os outros para fora)',
  $$select public.consumir_tentativa('login:email:socio@fullconnectkey.com.br', 10, interval '15 minutes')$$,
  'permission denied');

select teste.recusa_com(
  'colaborador logado tambem NAO chama consumir_tentativa',
  '22222222-2222-2222-2222-222222222222',
  $$select public.consumir_tentativa('login:email:alguem@exemplo.com', 10, interval '15 minutes')$$,
  'permission denied');

select teste.recusa_com(
  'ninguem logado zera a cota de outra pessoa por perdoar_tentativas',
  '22222222-2222-2222-2222-222222222222',
  $$select public.perdoar_tentativas('login:email:socio@fullconnectkey.com.br')$$,
  'permission denied');

-- A TABELA E A SEGUNDA TRAVA, e ela vale sozinha. Se alguem devolver o grant
-- das funcoes, a RLS sem policy nenhuma continua recusando a escrita para
-- quem nao e a chave de servico.
select teste.recusa_com(
  'a tabela rate_limits nao e alcancavel por quem esta logado',
  '22222222-2222-2222-2222-222222222222',
  $$select 1 from public.rate_limits limit 1$$,
  'permission denied');

select teste.recusa_como_anon(
  'a tabela rate_limits nao e alcancavel pela chave anon',
  $$select 1 from public.rate_limits limit 1$$,
  'permission denied');

-- ---------------------------------------------------------------------------
-- O PRIVILEGIO EM SI, e este cenario existe porque os de cima nao bastam.
--
-- As duas travas sao independentes de proposito, e e isso que faz os cenarios
-- acima continuarem passando se alguem devolver o grant das funcoes: a RLS da
-- tabela recusa em seguida, e a mensagem continua sendo "permission denied".
-- Bom para quem usa o sistema, ruim para um teste -- ele afirmaria que a
-- porta esta fechada sem distinguir qual das duas fechou.
--
-- Entao estes olham o privilegio direto. Devolver o `grant` derruba
-- exatamente estes dois, e a descricao diz o que voltou.
-- ---------------------------------------------------------------------------

select teste.conferir(
  'anon NAO tem execute em consumir_tentativa',
  has_function_privilege('anon',
    'public.consumir_tentativa(text,integer,interval)', 'execute')::text,
  'false');

select teste.conferir(
  'authenticated NAO tem execute em consumir_tentativa',
  has_function_privilege('authenticated',
    'public.consumir_tentativa(text,integer,interval)', 'execute')::text,
  'false');

select teste.conferir(
  'anon NAO tem execute em perdoar_tentativas',
  has_function_privilege('anon', 'public.perdoar_tentativas(text)', 'execute')::text,
  'false');

select teste.conferir(
  'a chave de servico TEM execute (senao o limite nao conta nada)',
  has_function_privilege('service_role',
    'public.consumir_tentativa(text,integer,interval)', 'execute')::text,
  'true');

select teste.conferir(
  'rate_limits tem RLS ligada',
  (select relrowsecurity::text from pg_class
    where oid = 'public.rate_limits'::regclass),
  'true');

select teste.conferir(
  'rate_limits nao tem policy nenhuma, e e assim que ninguem a le',
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'rate_limits'),
  '0');


-- ---------------------------------------------------------------------------
-- A CONTA
-- ---------------------------------------------------------------------------

select teste.conferir_como_servico(
  'a primeira tentativa passa',
  $$select permitido::text from public.consumir_tentativa('t:conta', 3, interval '15 minutes')$$,
  'true');

select teste.conferir_como_servico(
  'a segunda tambem',
  $$select permitido::text from public.consumir_tentativa('t:conta', 3, interval '15 minutes')$$,
  'true');

select teste.conferir_como_servico(
  'a terceira e a ultima que cabe',
  $$select permitido::text from public.consumir_tentativa('t:conta', 3, interval '15 minutes')$$,
  'true');

select teste.conferir_como_servico(
  'a quarta e recusada',
  $$select permitido::text from public.consumir_tentativa('t:conta', 3, interval '15 minutes')$$,
  'false');

-- CADA CHAVE CONTA SOZINHA. Sem isto o limite seria global e a primeira
-- pessoa a errar a senha trancaria a agencia inteira.
select teste.conferir_como_servico(
  'outra chave comeca do zero',
  $$select tentativas::text from public.consumir_tentativa('t:outra', 3, interval '15 minutes')$$,
  '1');

select teste.conferir_como_servico(
  'espere_segundos cabe na janela e e positivo',
  $$select (espere_segundos between 1 and 900)::text
      from public.consumir_tentativa('t:conta', 3, interval '15 minutes')$$,
  'true');


-- ---------------------------------------------------------------------------
-- O PERDAO, que e o que separa "contar tentativa" de "contar erro"
-- ---------------------------------------------------------------------------

select teste.conferir_como_servico(
  'perdoar devolve a cota inteira',
  $$select (select tentativas::text
              from (select public.perdoar_tentativas('t:conta')) _,
                   lateral public.consumir_tentativa('t:conta', 3, interval '15 minutes'))$$,
  '1');


-- ---------------------------------------------------------------------------
-- A JANELA VIRA, e o contador recomeca
--
-- Sem este cenario, um contador que NUNCA zera passaria em todos os de cima --
-- e o efeito seria uma pessoa trancada para sempre depois de dez erros num
-- dia qualquer.
-- ---------------------------------------------------------------------------

do $$
begin
  set local role service_role;
  perform public.consumir_tentativa('t:janela', 1, interval '15 minutes');
  perform public.consumir_tentativa('t:janela', 1, interval '15 minutes');
  -- Envelhece a janela a mao: e o mesmo que esperar quinze minutos.
  update public.rate_limits set janela_inicio = now() - interval '20 minutes'
   where chave = 't:janela';
  reset role;
end $$;

select teste.conferir_como_servico(
  'janela vencida recomeca em 1',
  $$select tentativas::text from public.consumir_tentativa('t:janela', 1, interval '15 minutes')$$,
  '1');

-- E A LINHA VELHA E APAGADA NA PROPRIA CHAMADA. Este produto ja tem duas
-- rotinas esperando um agendador que nao chegou; uma terceira seria uma
-- tabela que cresce para sempre.
do $$
begin
  set local role service_role;
  insert into public.rate_limits (chave, janela_inicio, tentativas)
  values ('t:antiga', now() - interval '3 days', 9)
  on conflict (chave) do update set janela_inicio = excluded.janela_inicio;
  perform public.consumir_tentativa('t:limpeza', 5, interval '15 minutes');
  reset role;
end $$;

select teste.conferir_como_servico(
  'a chamada apaga a linha vencida ha dias',
  $$select count(*)::text from public.rate_limits where chave = 't:antiga'$$,
  '0');


-- ---------------------------------------------------------------------------
-- OS ARGUMENTOS RUINS
-- ---------------------------------------------------------------------------

do $$
declare msg text;
begin
  begin
    set local role service_role;
    perform public.consumir_tentativa('   ', 10, interval '15 minutes');
    reset role;
    msg := '(nao recusou)';
  exception when others then
    reset role;
    msg := sqlerrm;
  end;
  insert into teste.resultado (descricao, situacao, detalhe)
  values ('chave em branco e recusada',
          case when msg like '%precisa de uma chave%' then 'passou' else 'FALHOU' end,
          left(msg, 90));
end $$;

do $$
declare msg text;
begin
  begin
    set local role service_role;
    perform public.consumir_tentativa('t:teto', 0, interval '15 minutes');
    reset role;
    msg := '(nao recusou)';
  exception when others then
    reset role;
    msg := sqlerrm;
  end;
  insert into teste.resultado (descricao, situacao, detalhe)
  values ('teto zero e recusado (seria bloquear a primeira tentativa de todos)',
          case when msg like '%teto de pelo menos 1%' then 'passou' else 'FALHOU' end,
          left(msg, 90));
end $$;


-- ---------------------------------------------------------------------------
-- A CONTA ACONTECE NUM COMANDO SO, e este cenario mede isso e nao o resultado
--
-- E a mesma licao da idempotencia da recorrencia (0040): um `select` seguido
-- de um `update` passa em TODOS os cenarios de cima, porque eles sao
-- sequenciais -- e falha na vida real, onde duas requisicoes chegam juntas,
-- leem as duas antes de qualquer uma gravar, e o teto de dez aceita vinte.
--
-- Um teste que nao separa a implementacao certa da errada e um teste que
-- afirma sem provar. Por isso este olha o CORPO da funcao.
-- ---------------------------------------------------------------------------

-- SAO DUAS PERGUNTAS, e a primeira versao deste cenario fazia so meia.
--
-- Ela procurava `on conflict` no corpo. Mas a implementacao errada TAMBEM usa
-- `on conflict` -- no ramo que cria a linha -- e passava inteira: o cenario
-- dizia "ok" para exatamente aquilo que existe para reprovar. Foi uma mutacao
-- proposital que mostrou, e nao a leitura.
--
-- As duas juntas fecham: o `+ 1` tem que estar DENTRO do `on conflict` (e nao
-- num `update` depois), e a funcao NAO pode ler a tabela antes de contar. Uma
-- implementacao que le primeiro derruba a segunda; uma que conta depois
-- derruba a primeira.

select teste.conferir(
  'o incremento mora DENTRO do on conflict',
  (select (prosrc ~* 'on conflict[^;]*tentativas\s*\+\s*1')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'consumir_tentativa'),
  'true');

select teste.conferir(
  'a funcao nao LE rate_limits antes de contar (era o furo da versao antiga)',
  (select (prosrc ~* 'select[^;]*from\s+public\.rate_limits')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'consumir_tentativa'),
  'false');
