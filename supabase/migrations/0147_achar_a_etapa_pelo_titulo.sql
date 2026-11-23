-- ---------------------------------------------------------------------------
-- 0147 - ACHAR A ETAPA PELO TITULO, PARA DESCOBRIR DE QUEM ELA E
--
-- Decisao do usuario: *"preciso que a pauta que apareca seja toda a pauta da
-- pessoa, desde sempre. e poder pesquisar por titulo, para achar a task caso
-- nao lembre quem fez"*.
--
-- ---------------------------------------------------------------------------
-- A PRIMEIRA METADE JA ERA VERDADE, e ir medir antes de escrever e o que fez
-- esta migration ser uma funcao so -- a licao da 0060, da 0127 e da 0144:
--
--   * `carregar()` em `lib/dados/minhas-tasks.ts` traz TODA demanda publicada
--     em que a pessoa tem uma folha, sem janela de data e sem filtro de
--     status;
--   * a secao da equipe chama `minhasTasks(pessoa.id, null, prazos)` -- o
--     `null` e o foco, entao nem "para hoje" nem "desta semana" recortam;
--   * e `MinhaLista` agrupa pelos SEIS status e so esconde grupo VAZIO.
--
-- A pauta ja era desde sempre. O que ela nao dizia e QUE era: ela mora embaixo
-- de uma grade da SEMANA CORRENTE, e quem clica num nome ali tem motivo para
-- ler a lista de baixo como a semana daquele nome. Isso se resolve com uma
-- frase na tela, nao com SQL.
--
-- O QUE NAO EXISTIA E A BUSCA, e a razao dela esta na segunda metade da frase:
-- *"caso nao lembre quem fez"*. Quer dizer que ela NAO pode ser dentro da
-- pessoa escolhida -- uma busca que exige escolher o nome primeiro nao responde
-- nada a quem nao sabe o nome. Ela varre a pauta da EQUIPE, e a resposta de
-- cada linha e a PESSOA.
-- ---------------------------------------------------------------------------
--
-- ELA NAO E `security definer`, E ISSO E A LINHA QUE MAIS IMPORTA AQUI.
-- `subtasks_select` e `is_staff()` desde a 0007 e `profiles_select` passou a
-- ser `is_staff() and role <> 'cliente'` na 0132 -- a RLS JA permite a toda a
-- equipe ler a etapa de qualquer pessoa e o nome de qualquer colega. E a 0144
-- em uma frase: *"o item 22 ja era do banco"*.
--
-- Entao a funcao e `plpgsql` comum, e a policy vale DENTRO dela -- a forma de
-- `busca_global()` (0073), e e ela que impede esta busca de virar a porta dos
-- fundos de `subtasks`. Um `security definer` aqui nao destravaria nada e
-- entregaria a pauta da agencia a quem tiver a chave anon.
--
-- E ELA EXISTE POR UMA RAZAO MECANICA E NAO DE PERMISSAO: `sem_acento()`
-- (0073). Quem procura "video" tem de achar "Video" e "Vi'deo", e o PostgREST
-- nao sabe por uma funcao do lado esquerdo de um filtro -- `ilike` nao dobra
-- acento e `lower()` depende do locale, que e o furo que o `grep -i` do
-- `check:cores` ja pagou uma vez.
--
-- ---------------------------------------------------------------------------
-- AS SEIS DECISOES DA CONSULTA
-- ---------------------------------------------------------------------------
--
-- 1. OS DOIS TITULOS, o da etapa e o da DEMANDA. O nome que a pessoa lembra e
--    as vezes o da etapa ("Layout do carrossel") e as vezes o da demanda
--    ("Campanha de verao") -- procurar so num deixaria metade das lembrancas
--    de fora. `busca_global()` ja faz as duas, em grupos separados; aqui elas
--    sao a MESMA pergunta, porque o que se quer e a etapa.
--
-- 2. `strpos` E NAO `like`, pela razao escrita na 0073: `like` trata `%` como
--    curinga, e `strpos` devolve ONDE casou, que e a ordenacao -- posicao 1 e
--    casamento no comeco do nome.
--
-- 3. SO AS FOLHAS, por `subtask_eh_agrupadora()` -- a funcao unica da 0022 e
--    nao um `not exists` copiado. Uma agrupadora e o trabalho de ninguem desde
--    que ganhou a primeira filha: devolve-la seria responder "quem fez" com
--    uma linha que nao tem dono por desenho.
--
-- 4. RASCUNHO FORA, inclusive o meu (0028): ele nao existe para a equipe, e a
--    pessoa que a busca procura nao tem como estar nele.
--
-- 5. AS PESSOAS SAEM DA TABELA DA 0114, nunca da coluna.
--    `subtasks.responsavel_id` e a PRIMEIRA pessoa; quem diz que a etapa e de
--    alguem e `subtask_responsaveis`. Lendo a coluna, a segunda pessoa de uma
--    etapa ficaria invisivel exatamente na tela que existe para perguntar quem
--    faz -- e essa e a unica resposta que esta busca da.
--
-- 6. E A ETAPA SEM DONO APARECE, dizendo isso. "Ninguem" e uma resposta
--    legitima para *quem fez* -- e a mais importante das duas, porque etapa sem
--    responsavel nao esta no "Minhas Tasks" de ninguem: o pior tipo de
--    trabalho, o que existe e ninguem sabe que e seu. Esconde-la faria a busca
--    ficar calada justamente no caso caro. E o `left join` que faz isso.
--
-- ---------------------------------------------------------------------------
-- UMA LINHA POR (ETAPA, PESSOA), e a juncao e na TELA
-- ---------------------------------------------------------------------------
--
-- Uma etapa com duas pessoas devolve duas linhas. Juntar as pessoas aqui
-- pediria um `jsonb` no `returns table` -- e `check:tipos` liga coluna e
-- parametro e NAO confere a forma de um `returns table`, entao um campo
-- composto aqui seria um molde que nenhuma verificacao olha. A lista tem no
-- maximo `v_limite` linhas, ja esta toda em maos de quem desenha, e agrupar la
-- e a decisao do marcador do carrossel: *a conta e na TELA e nao no banco*.
--
-- O `total` CONTA ETAPAS E NAO LINHAS, e e por isso que ele e calculado antes
-- do corte: com o `count(*)` depois do `left join`, "40 de 57" contaria
-- vinculos, e o numero que a tela escreve falaria de uma coisa que a pessoa nao
-- ve. E o corte e por ETAPA tambem -- cortando linhas, a ultima etapa da lista
-- sairia com uma das duas pessoas dela, que e pior que sair fora.
--
-- E O CORTE DIZ QUANTOS SOBRARAM, que e a regra do Resumo da Agencia: *cortar
-- calado faz a pessoa concluir que aquilo e tudo*.
--
-- O PISO DE DUAS LETRAS e o da paleta (0073): com uma letra a varredura
-- devolve quase a tabela, e o que chega na tela nao e resposta.
--
-- Rodado contra o Postgres de producao antes de ser escrito aqui.
--
-- MEDIDO COM SEIS MUTACOES, sobre 2486 cenarios: devolver a agrupadora derruba
-- 2, devolver o rascunho derruba 2, virar `security definer` derruba 2 -- e o
-- primeiro deles e a CLIENTE achando quatro linhas da pauta da agencia --,
-- trocar `sem_acento()` por `lower()` derruba 3, baixar o piso para uma letra
-- derruba 1, e fazer o `total` contar LINHA em vez de etapa derruba 1.
-- ---------------------------------------------------------------------------

create or replace function public.pauta_por_titulo(
  p_termo text,
  p_limite integer default 40
)
returns table (
  subtask_id uuid,
  task_id uuid,
  etapa text,
  demanda text,
  cliente text,
  status public.subtask_status,
  prazo date,
  pessoa_id uuid,
  pessoa text,
  avatar_url text,
  total integer
)
language plpgsql
stable
set search_path = public
as $fn$
declare
  v_termo text := public.sem_acento(btrim(coalesce(p_termo, '')));
  v_limite integer := least(greatest(coalesce(p_limite, 40), 1), 100);
begin
  -- MENOS DE DUAS LETRAS NAO E BUSCA, e devolver vazio e melhor que devolver
  -- tudo: a tela diz "digite ao menos 2 letras" em vez de desenhar a agencia.
  if length(v_termo) < 2 then
    return;
  end if;

  return query
  with achadas as (
    select s.id,
           s.task_id,
           s.titulo as etapa,
           s.status,
           s.prazo,
           t.titulo as demanda,
           c.nome_empresa as cliente,
           -- ONDE CASOU, pelo melhor dos dois titulos: digitar "camp" poe a
           -- demanda "Campanha de verao" acima de "Ajustar a campanha".
           least(
             coalesce(nullif(strpos(public.sem_acento(s.titulo), v_termo), 0), 999),
             coalesce(nullif(strpos(public.sem_acento(t.titulo), v_termo), 0), 999)
           ) as posicao,
           count(*) over () as quantas
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
      left join public.clients c on c.id = t.client_id
     where t.publicada_em is not null
       and not public.subtask_eh_agrupadora(s.id)
       and (strpos(public.sem_acento(s.titulo), v_termo) > 0
         or strpos(public.sem_acento(t.titulo), v_termo) > 0)
  ),
  cortadas as (
    -- O CTE E ALIASADO E TODA REFERENCIA E QUALIFICADA, e isso nao e estilo: o
    -- `returns table` desta funcao declara `prazo`, `etapa` e `status` como
    -- VARIAVEIS plpgsql, que sombreiam as colunas de mesmo nome -- um `order by
    -- prazo` solto aqui estoura com *"column reference prazo is ambiguous"*,
    -- em tempo de execucao e nao na criacao, porque plpgsql nao valida o corpo
    -- na criacao (0128). Medido: a primeira versao recusou a primeira chamada.
    select *
      from achadas a
     order by a.posicao, coalesce(a.prazo, '9999-12-31'::date), a.etapa
     limit v_limite
  )
  select a.id,
         a.task_id,
         a.etapa,
         a.demanda,
         a.cliente,
         a.status,
         a.prazo,
         p.id,
         p.nome,
         p.avatar_url,
         a.quantas::integer
    from cortadas a
    left join public.subtask_responsaveis sr on sr.subtask_id = a.id
    left join public.profiles p on p.id = sr.user_id
   order by a.posicao, coalesce(a.prazo, '9999-12-31'::date), a.etapa, p.nome;
end;
$fn$;

comment on function public.pauta_por_titulo(text, integer) is
  'Acha a etapa pelo titulo dela ou da demanda e diz DE QUEM ela e -- a busca '
  'da pauta da equipe (0147). Uma linha por (etapa, pessoa), com a etapa sem '
  'dono vindo com a pessoa nula. NAO e security definer de proposito: '
  'subtasks_select e profiles_select ja respondem para is_staff(), e a policy '
  'valer dentro dela e o que impede a busca de ser a porta dos fundos de '
  'subtasks. O total conta ETAPAS e e calculado antes do corte.';

-- A ACL ESCRITA A MAO, pela licao da 0097 e da 0071: o Postgres concede
-- `execute` a `public` em toda funcao nova, e o PostgREST publica o schema
-- `public` sozinho. Sem o `revoke`, quem tiver a chave anon chama a funcao --
-- e aqui ela nao vazaria nada, porque a RLS vale dentro dela, mas uma ACL
-- aberta ao lado de uma fechada e a inconsistencia que a 0144 corrigiu em
-- `carga_da_equipe()`.
revoke all on function public.pauta_por_titulo(text, integer) from public;
revoke all on function public.pauta_por_titulo(text, integer) from anon;
grant execute on function public.pauta_por_titulo(text, integer) to authenticated;
grant execute on function public.pauta_por_titulo(text, integer) to service_role;


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------
-- select count(*) as deve_ser_1
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname = 'pauta_por_titulo'
--    and p.prosecdef = false;
--
-- select * from public.pauta_por_titulo('a', 5);   -- zero linhas: piso de 2
-- select * from public.pauta_por_titulo('video', 5);
