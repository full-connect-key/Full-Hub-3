-- ===========================================================================
-- ZERAR O FULL DAYS
--
-- Decisao do usuario: *"coloquei que iria tirar ferias so para testar a
-- funcionalidade, mas ficou marcando como se eu tivesse tirado ferias, pode
-- zerar o Full Days tbm?"*
--
-- Cola no SQL Editor do Supabase. NAO E MIGRATION, pelo mesmo motivo do
-- `zerar-tasks-social-campanhas.sql`: migration e schema e roda em todo
-- ambiente; esta apaga DADO, uma vez, no banco que alguem escolheu.
--
-- VER TAMBEM: `scripts/zerar-tasks-social-campanhas.sql`, que zera as
-- demandas, o social e as campanhas. Sao dois arquivos e nao um porque sao
-- duas decisoes -- um apagamento vale exatamente o que alguem pediu.
--
-- ---------------------------------------------------------------------------
-- O PASSO 1 NAO APAGA NADA, e e ele que decide.
--
-- Cole o PASSO 1 sozinho, leia os numeros, e so entao cole o PASSO 2. NAO TEM
-- VOLTA: o banco de producao do Supabase tem backup diario no plano pago; no
-- plano gratuito nao ha de onde restaurar.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- A ORDEM E A ARMADILHA DESTE ARQUIVO, e ela e o proprio relato.
--
-- `team_presence.hr_request_id` e `on delete SET NULL` (0011), e nao cascade.
-- Isso quer dizer que apagar so os PEDIDOS **deixa os dias pintados na
-- matriz** -- eles perdem o vinculo com o pedido e continuam la, em roxo,
-- dizendo que a pessoa esta de day off. E exatamente o sintoma: *"ficou
-- marcando como se eu tivesse tirado ferias"*.
--
-- E o `set null` esta CERTO onde ele existe: ele e o que faz um pedido
-- desfeito nao levar junto, em silencio, um dia que alguem tinha corrigido a
-- mao na matriz. Ele e errado so aqui, onde o que se quer e zerar os dois.
--
-- Entao a matriz sai PRIMEIRO, e a ordem e explicita em vez de depender da
-- cascata. `proteger_presenca_de_pedido` nao morde: ela e `before UPDATE`, e
-- recusa TROCAR o status de um dia que veio de pedido aprovado -- apagar a
-- linha nao passa por ela.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- O SALDO SE RESTAURA SOZINHO, e nao ha coluna para zerar.
--
-- `saldo_de_ferias()` e `descanso_do_ciclo()` contam o que esta em
-- `hr_requests` no ciclo corrente (0039, 0085) -- o saldo e DERIVADO, pela
-- mesma razao que atraso nao e coluna e bloqueio nao e status. Sem os pedidos,
-- todo mundo volta aos 15 dias do ciclo no instante seguinte, sem nenhum
-- `update` em `team_members`.
--
-- E e por isso que a contagem do PASSO 1 mostra o saldo ANTES e o PASSO 2B
-- mostra o saldo DEPOIS: e a unica forma de ver que a conta anda sozinha.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- ELE FOI RODADO, e a armadilha acima foi MEDIDA em vez de deduzida.
--
-- Contra um Postgres 16 do zero, com as 94 migrations e o `seed.sql`:
--
--   - rodando o arquivo inteiro, a matriz e os pedidos vao a zero, os 78
--     feriados continuam, e o saldo volta sozinho -- o Bruno e a Marina saem
--     de 11 e voltam para 15, sem nenhum `update` em `team_members`;
--   - rodando SO o `delete from hr_requests`, sem a matriz, sobram os 5 dias
--     pintados -- 4 deles ainda em day off, todos com o vinculo nulo. E o
--     relato reproduzido: o pedido some e a pessoa continua de ferias na tela.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- O QUE ESTE ARQUIVO NAO TOCA, e e decisao:
--
--   - OS FERIADOS (`holidays`). Sao o calendario nacional, nao dado de teste
--     -- e a falta deles nao aparece como falta: um ano sem feriado na tabela
--     aparece NORMAL, e um afastamento de tres dias em cima do Natal sai com
--     tres no lugar de dois. Ninguem desconfia olhando a tela.
--   - O CONTRATO DE CADA PESSOA: `data_admissao`, `dias_ferias_ano` e
--     `max_parcelas_ferias` em `team_members`. E deles que sai o ciclo de 12
--     meses contado da entrada, e zera-los daria a toda a equipe zero dia.
--   - OS EVENTOS do Calendario Full, inclusive os que marcam `bloqueia_ferias`.
--     Eles sao de outro modulo; o que eles bloqueiam e pedido NOVO, e nenhum
--     deles pinta a matriz.
--   - `audit_log`. A trilha do socio registra ESTA limpeza, e esta certo.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- PASSO 1 -- O QUE VAI SAIR. Cole SO ISTO primeiro, e leia os numeros.
-- ===========================================================================

select 'pedidos (hr_requests)'          as o_que, count(*) as quantos from public.hr_requests
union all select '  desses, de day off',          count(*) from public.hr_requests where tipo = 'ferias'
union all select '  desses, aguardando resposta', count(*) from public.hr_requests where status = 'pendente'
union all select '  desses, com "de acordo"',     count(*) from public.hr_requests where status = 'aprovada'
union all select '  desses, lancados a mao',      count(*) from public.hr_requests where origem <> 'solicitacao'
union all select 'dias pintados na matriz',       count(*) from public.team_presence
union all select '  desses, vindos de um pedido', count(*) from public.team_presence where hr_request_id is not null
union all select '  desses, pintados a mao',      count(*) from public.team_presence where hr_request_id is null
union all select 'avisos do sino do Full Days',   count(*) from public.notifications where link like '/painel/full-days%'
order by 1;

-- O SALDO DE CADA PESSOA AGORA, para comparar com o PASSO 2B. A funcao e
-- `security definer` com `is_staff()` na porta, entao a conta vai escrita aqui
-- -- e ela e a mesma de `descanso_usado_no_ciclo()`: o pedido pertence ao
-- ciclo em que COMECA, inteiro.
select p.nome,
       tm.dias_ferias_ano                                as tem_por_ciclo,
       coalesce(sum(h.dias_uteis), 0)                    as usou_neste_ciclo,
       tm.dias_ferias_ano - coalesce(sum(h.dias_uteis), 0) as saldo_antes
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id
  left join public.hr_requests h
    on h.user_id = tm.user_id
   and h.tipo = 'ferias'
   and h.status in ('pendente', 'aprovada')
   and h.data_inicio >= public.inicio_do_ciclo(tm.user_id)
 where tm.ativo
 group by p.nome, tm.dias_ferias_ano
 order by p.nome;


-- ===========================================================================
-- PASSO 2 -- A LIMPEZA. Cole isto depois de ler o PASSO 1.
--
-- O SQL Editor roda o arquivo colado como UMA transacao: ou os tres comandos
-- passam, ou nenhum passa.
-- ===========================================================================

-- 1. A MATRIZ PRIMEIRO. Sem esta linha os dias ficam pintados mesmo com o
--    pedido apagado, porque `hr_request_id` e `on delete set null`.
delete from public.team_presence;

-- 2. OS PEDIDOS, e com eles o saldo volta sozinho.
delete from public.hr_requests;

-- 3. OS AVISOS DO SINO do Full Days, e so deles. "Seu periodo foi aprovado"
--    apontando para um pedido que nao existe mais e um 404 por clique.
delete from public.notifications where link like '/painel/full-days%';


-- ===========================================================================
-- PASSO 2B -- A CONFERENCIA. As duas primeiras tem de dar 0, e o saldo tem de
-- voltar ao numero cheio de cada contrato.
-- ===========================================================================

select 'pedidos'                 as o_que, count(*) as sobraram from public.hr_requests
union all select 'dias na matriz',         count(*) from public.team_presence
union all select 'feriados (continuam)',   count(*) from public.holidays
order by 1;

select p.nome,
       tm.dias_ferias_ano                                as tem_por_ciclo,
       coalesce(sum(h.dias_uteis), 0)                    as usou_neste_ciclo,
       tm.dias_ferias_ano - coalesce(sum(h.dias_uteis), 0) as saldo_depois
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id
  left join public.hr_requests h
    on h.user_id = tm.user_id
   and h.tipo = 'ferias'
   and h.status in ('pendente', 'aprovada')
   and h.data_inicio >= public.inicio_do_ciclo(tm.user_id)
 where tm.ativo
 group by p.nome, tm.dias_ferias_ano
 order by p.nome;

-- ATENCAO ao `saldo_depois` de quem entrou ha menos de doze meses: ele vai
-- mostrar o numero cheio do contrato, e a TELA vai dizer zero. Nao e
-- divergencia -- e a 0074: os 15 dias sao conquistados no FIM do primeiro
-- ciclo, e `ciclos_de_descanso()` devolve zero ate o primeiro aniversario. A
-- consulta acima e a conta do ciclo corrente, nao a regra de quem ainda nao
-- tem ciclo nenhum.
