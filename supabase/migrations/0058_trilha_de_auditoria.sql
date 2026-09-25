-- ---------------------------------------------------------------------------
-- 0058 - A TRILHA DE AUDITORIA (Sprint 16, Parte D)
--
-- ---------------------------------------------------------------------------
-- O SPRINT PEDE `activity_log`, E ELA NAO EXISTE
--
-- Tres cabecalhos de migration ja registram isso -- a 0035, a 0037 e a 0040.
-- O que existe e `task_history`, e ela responde a outra pergunta: em que pe
-- esteve cada ETAPA, e quando. E ela alimenta `producao_do_periodo()` e o
-- "onde o tempo da etapa vai" das Metricas.
--
-- POR ISSO A AUDITORIA NAO ENTRA NELA, e a razao e a mesma que manteve Equipe
-- e Clientes em duas tabelas em vez de uma: na mesma tabela a linha passa a
-- significar duas coisas, e metade das colunas fica vazia em cada metade das
-- linhas. Pior aqui, porque `task_history` e lida por conta: uma linha de
-- "o socio mudou o perfil da Joana" no meio dela ou entra no numero de
-- producao da agencia, ou obriga toda consulta existente a ganhar um filtro
-- -- e a que esquecer o filtro passa a mentir sem avisar.
--
-- ---------------------------------------------------------------------------
-- QUEM ESCREVE E O TRIGGER, NUNCA A ACTION
--
-- Uma auditoria escrita pela camada de aplicacao registra o que passou pela
-- tela e ignora o resto: um PATCH montado a mao no PostgREST, um `update`
-- colado no SQL Editor, um trigger interno. Ou seja, ela registra exatamente
-- os casos em que ninguem duvidava, e perde os que motivam a auditoria.
--
-- E o mais importante: seria um SEGUNDO lugar para lembrar. Toda action nova
-- que mexesse numa tabela auditada teria que se lembrar de registrar, e a que
-- esquecesse nao pareceria quebrada.
--
-- ---------------------------------------------------------------------------
-- ELA FALHA A ESCRITA, E E O CONTRARIO DO LIMITE DE TENTATIVAS
--
-- A 0056 libera a tentativa quando o contador quebra, porque um limitador
-- quebrado que recusa tranca a agencia inteira para fora do proprio sistema.
-- Aqui e o inverso, e de proposito: se nao da para registrar, nao se faz. Uma
-- auditoria que aceita a escrita e perde o registro e pior que nenhuma --
-- ela produz a confianca sem a checagem, que e o mesmo erro que a trava de
-- aprovacao da 0014 cometia.
--
-- ---------------------------------------------------------------------------
-- O QUE ELA GUARDA, E O QUE ELA NAO GUARDA
--
-- Acesso, gente, dinheiro e decisao. Nao o trabalho do dia: cada mexida numa
-- etapa viraria uma linha, e uma tela com trezentas linhas por dia e uma tela
-- que ninguem abre -- o mesmo argumento pelo qual o resumo da semana corta em
-- oito e diz quantos sobraram.
--
-- E NAO GUARDA O QUE O PRODUTO JA REGISTRA DE FORMA IMUTAVEL.
-- `approval_rounds` fica de fora: rodada fechada nunca e reescrita nem
-- apagada, e ela ja carrega quem decidiu, quando e com que comentario. Uma
-- copia disso na auditoria seria uma segunda verdade sobre o mesmo fato,
-- esperando divergir.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  tabela      text        not null,
  registro_id uuid,
  operacao    text        not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  -- Pode ser nulo: o seed, a chave de servico e uma rotina agendada escrevem
  -- sem sessao. A tela mostra "sistema" -- inventar um nome seria pior.
  quem        uuid        references auth.users (id) on delete set null,
  quando      timestamptz not null default now(),
  -- SO AS COLUNAS QUE MUDARAM, e nao a linha inteira duas vezes. Duas copias
  -- de vinte colunas para dizer que uma mudou e uma tela em que ninguem acha
  -- a diferenca -- e um banco que cresce por causa de campos que ninguem leu.
  antes       jsonb,
  depois      jsonb
);

comment on table public.audit_log is
  'Quem mexeu em acesso, gente, dinheiro e decisao (0058). Escrita SO por '
  'trigger; sem policy de insert, de update nem de delete. Leitura so de '
  'is_socio(), porque ela copia trecho das tabelas mais sensiveis da casa.';

comment on column public.audit_log.antes is
  'So as colunas que mudaram, com o valor anterior. Nulo num INSERT.';

create index if not exists audit_log_quando  on public.audit_log (quando desc);
create index if not exists audit_log_tabela  on public.audit_log (tabela, quando desc);
create index if not exists audit_log_quem    on public.audit_log (quem, quando desc);
create index if not exists audit_log_registro on public.audit_log (registro_id);

alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- SO O SOCIO LE, E ISSO NAO E ESCOLHA DE TELA
--
-- A auditoria copia trecho de `finance_entries` e de `contracts`, que fecham
-- em `is_socio()` nos quatro comandos desde a 0013 -- "faturamento por
-- cliente e a informacao mais sensivel da casa, e quem pode le-la e quem
-- responde por ela". Um log legivel pela gestao seria a porta dos fundos
-- daquela regra: o desenvolvedor nao le a tabela e leria o valor no `depois`.
--
-- UM LOG E TAO SENSIVEL QUANTO A COISA MAIS SENSIVEL QUE TEM DENTRO DELE.
-- ---------------------------------------------------------------------------
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.is_socio());

-- SEM POLICY DE INSERT, DE UPDATE NEM DE DELETE, e as tres ausencias sao a
-- regra: a unica porta e o trigger (que e `security definer`), e nem o socio
-- reescreve nem apaga uma linha. E a mesma forma de `client_access_log` e de
-- `client_portal_views`, e a mesma razao de `notifications` nao ter insert --
-- um registro que a propria pessoa pode consertar nao registra nada.
revoke insert, update, delete on public.audit_log from anon, authenticated;


-- ---------------------------------------------------------------------------
-- O trigger, um para todas as tabelas
--
-- `security definer` porque `audit_log` nao tem policy de insert: quem escreve
-- e a funcao, em nome do dono dela, e nao a pessoa que disparou a escrita.
--
-- `updated_at` FICA DE FORA DO DIFF. Ela muda em toda escrita, e sem esta
-- linha um `update` que nao mudou nada geraria uma linha de auditoria dizendo
-- que mudou o `updated_at` -- ruido puro, e em volume.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_antes  jsonb := '{}'::jsonb;
  v_depois jsonb := '{}'::jsonb;
  v_velho  jsonb;
  v_novo   jsonb;
  v_chave  text;
  v_id     uuid;
  IGNORADAS constant text[] := array['updated_at'];
begin
  if tg_op = 'INSERT' then
    v_novo := to_jsonb(new);
    v_depois := v_novo - IGNORADAS;
  elsif tg_op = 'DELETE' then
    v_velho := to_jsonb(old);
    v_antes := v_velho - IGNORADAS;
  else
    v_velho := to_jsonb(old);
    v_novo  := to_jsonb(new);

    -- A UNIAO DAS CHAVES, e nao as do `old`. Uma coluna criada por migration
    -- aparece so no `new`, e percorrer so o lado velho perderia justamente a
    -- primeira escrita de um campo novo.
    for v_chave in
      select k from jsonb_object_keys(v_velho || v_novo) k
       where k <> all (IGNORADAS)
    loop
      if (v_velho -> v_chave) is distinct from (v_novo -> v_chave) then
        v_antes  := v_antes  || jsonb_build_object(v_chave, v_velho -> v_chave);
        v_depois := v_depois || jsonb_build_object(v_chave, v_novo  -> v_chave);
      end if;
    end loop;

    -- NADA MUDOU, NADA SE REGISTRA. Um `update` que grava os mesmos valores
    -- acontece toda hora -- a tela que salva sozinha campo a campo faz isso
    -- sempre que a pessoa clica fora sem ter digitado nada.
    if v_antes = '{}'::jsonb then
      return new;
    end if;
  end if;

  v_id := coalesce(
    (case when tg_op = 'DELETE' then v_velho else v_novo end) ->> 'id',
    null
  )::uuid;

  insert into public.audit_log (tabela, registro_id, operacao, quem, antes, depois)
  values (
    tg_table_name,
    v_id,
    tg_op,
    auth.uid(),
    nullif(v_antes,  '{}'::jsonb),
    nullif(v_depois, '{}'::jsonb)
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$fn$;

revoke all on function public.registrar_auditoria() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Onde ele fica pendurado
--
-- A LISTA E UM LACO, e nao vinte blocos copiados: acrescentar uma tabela e
-- acrescentar um nome. Vinte blocos iguais e onde o vigesimo primeiro sai
-- diferente do resto sem ninguem notar.
-- ---------------------------------------------------------------------------
do $migracao$
declare
  t text;
  -- ACESSO, GENTE E DINHEIRO: as quatro operacoes.
  TUDO constant text[] := array[
    'profiles',            -- inclui a troca de PERFIL DE ACESSO, que e o evento mais importante do produto
    'clients',
    'client_users',        -- quem entra e quem sai do portal de cada cliente
    'team_members',
    'contracts',
    'finance_entries',
    'finance_categories',
    'hr_requests'          -- inclui o lancamento retroativo, que reescreve historico
  ];
  -- O TRABALHO DO DIA: so o DELETE.
  --
  -- Cada mexida numa etapa viraria uma linha, e a tela viraria um extrato que
  -- ninguem abre. O que nao da para desfazer nem reconstruir e o apagamento:
  -- uma demanda que sai leva comentario, tempo e aprovacao com ela, e depois
  -- nao ha onde perguntar quem a tirou. O status, esse `task_history` guarda.
  SO_DELETE constant text[] := array[
    'tasks',
    'subtasks',
    'campaigns',
    'posts',
    'deliverables'
  ];
begin
  foreach t in array TUDO loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists %I on public.%I', 'auditar_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I '
      'for each row execute function public.registrar_auditoria()',
      'auditar_' || t, t);
  end loop;

  foreach t in array SO_DELETE loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists %I on public.%I', 'auditar_' || t, t);
    execute format(
      'create trigger %I after delete on public.%I '
      'for each row execute function public.registrar_auditoria()',
      'auditar_' || t, t);
  end loop;
end
$migracao$;
