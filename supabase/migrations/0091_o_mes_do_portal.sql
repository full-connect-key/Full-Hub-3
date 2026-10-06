-- ===========================================================================
-- 0091 - O MES DE SOCIAL VISTO DO PORTAL
--
-- Sprint 3K, Parte 2. Uma funcao, e ela existe por uma razao de RLS que so
-- aparece quando se tenta escrever a tela.
--
-- ---------------------------------------------------------------------------
-- O PROBLEMA
--
-- `postsDoMes` filtrava por `data_publicacao` dentro do mes, e e esse filtro
-- que escondia do cliente a peca enviada num portao do meio -- o bug 1 da
-- 0090. A correcao obvia e trocar o recorte: em vez da data, a DEMANDA do mes.
--
-- So que o cliente NAO ENXERGA `tasks`. `tasks_select_cliente` exige uma
-- rodada de escopo cliente numa subtarefa da demanda, e a demanda do MES nao
-- tem nenhuma -- as rodadas sao dos posts. Entao
-- `social_task_id in (select id from tasks where social_do_mes = ...)` volta
-- vazio para ele, e a tela ficaria igualzinha ao bug que ela esta
-- consertando.
--
-- E a mesma pegadinha que a policy do lote pagou na 0090, encontrada pela
-- bateria: um `exists` em `tasks` dentro de uma consulta do cliente sempre da
-- falso.
--
-- ---------------------------------------------------------------------------
-- POR QUE NAO UMA COLUNA EM `posts`
--
-- `posts.social_mes date` resolveria sem funcao nenhuma, e e exatamente a
-- segunda fonte de verdade que este produto recusa em toda parte: o mes do
-- post JA e `tasks.social_do_mes` pela ponte `social_task_id`, e duas colunas
-- dizendo de que mes a peca e divergiriam no dia em que alguem movesse um post
-- de mes. E a decisao de "atraso nao e coluna" e de `maoDoPost()`.
--
-- ---------------------------------------------------------------------------
-- MEDIDO COM DUAS MUTACOES, no arquivo 43 da bateria:
--
--   `clientescopo`  tirar o `my_client_ids()` do ramo do cliente derruba 2
--                   cenarios -- e os dois sao o furo que `security definer`
--                   abre quando a guarda e esquecida: o cliente da outra
--                   empresa passa a ler o mes desta, inclusive passando o
--                   `p_client_id` dela.
--   `mesvazio`      tirar o `enviado_em is not null` derruba 1 -- o mes que a
--                   agencia abriu e nao mandou passa a existir na navegacao
--                   do cliente, que e uma tela vazia com a cara de material
--                   que nao chegou.
--
-- O que NAO da para medir aqui, e fica dito: a assimetria do `p_client_id`
-- para a EQUIPE depende de `is_staff()`, e `teste.conferir` avalia como dono
-- do banco, sem sessao -- os quatro cenarios da equipe vao por
-- `conferir_como`, que e a mesma razao de `descanso_do_ciclo()` na 0085.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- QUAL E A DEMANDA DESTE MES, PARA QUEM ESTA OLHANDO
--
-- `security definer` para passar por cima da RLS de `tasks`, com a pergunta de
-- quem pode escrita no corpo -- a forma de `usuarios_do_meu_cliente()` (0031),
-- de `meus_comodatos()` (0069) e de `o_que_o_cliente_decide()` (0076).
--
-- O QUE ELA DEVOLVE E UM UUID, e e o recorte: nenhum titulo, nenhum link de
-- entrega, nenhum briefing. Ela responde "qual demanda", e quem decide o que
-- se le dela continua sendo a RLS de cada tabela.
--
-- `p_client_id` E PARA A VISUALIZACAO ADMINISTRATIVA, e e a mesma assimetria
-- de `itensDoPortal()`: para o cliente ele e ignorado -- `my_client_ids()`
-- decide --, e para a equipe ele e obrigatorio, porque ela enxerga todas as
-- empresas e precisa dizer de qual esta falando.
-- ---------------------------------------------------------------------------
create or replace function public.mes_de_social_do_portal(
  p_mes       text,
  p_client_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  primeiro date;
  alvo     uuid;
begin
  begin
    primeiro := to_date(p_mes || '-01', 'YYYY-MM-DD');
  exception when others then
    return null;
  end;

  -- A EQUIPE DIZ DE QUAL EMPRESA, e o cliente nao escolhe. Sem a segunda
  -- metade, um cliente passando `p_client_id` de outra empresa leria o mes
  -- dela -- que e o furo que `security definer` abre quando a guarda e
  -- esquecida.
  if public.is_staff() then
    if p_client_id is null then
      return null;
    end if;

    select t.id into alvo
      from public.tasks t
     where t.client_id = p_client_id
       and t.social_do_mes = primeiro;
  else
    select t.id into alvo
      from public.tasks t
     where t.social_do_mes = primeiro
       and t.client_id in (select public.my_client_ids());
  end if;

  return alvo;
end;
$$;

comment on function public.mes_de_social_do_portal(text, uuid) is
  'A demanda do mes de social de uma empresa (0091). `security definer` porque o cliente nao enxerga `tasks` -- e sem ela o recorte do portal continuaria sendo `data_publicacao`, que e o bug 1 da 0090. Devolve so o uuid.';

revoke all on function public.mes_de_social_do_portal(text, uuid) from public;
revoke all on function public.mes_de_social_do_portal(text, uuid) from anon;
grant execute on function public.mes_de_social_do_portal(text, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- E OS MESES QUE ELE TEM, para a navegacao do portal nao oferecer mes vazio
--
-- Ela devolve so os meses em que ha peca ENVIADA: um mes que a agencia abriu e
-- ainda nao mandou nada nao existe para o cliente, pela regra da 0032 --
-- `enviado_em is not null` e a linha que segura o modulo inteiro.
-- ---------------------------------------------------------------------------
create or replace function public.meses_de_social_do_portal(p_client_id uuid default null)
returns table (mes date, pecas integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_staff() and p_client_id is null then
    return;
  end if;

  return query
    select t.social_do_mes, count(p.id)::integer
      from public.tasks t
      join public.posts p on p.social_task_id = t.id
     where t.social_do_mes is not null
       and p.enviado_em is not null
       and (
         case when public.is_staff()
              then t.client_id = p_client_id
              else t.client_id in (select public.my_client_ids())
         end
       )
     group by t.social_do_mes
     order by t.social_do_mes desc;
end;
$$;

comment on function public.meses_de_social_do_portal(uuid) is
  'Os meses de social que esta empresa tem material enviado, do mais novo para o mais antigo (0091). Mes sem peca enviada nao entra: ele nao existe para o cliente.';

revoke all on function public.meses_de_social_do_portal(uuid) from public;
revoke all on function public.meses_de_social_do_portal(uuid) from anon;
grant execute on function public.meses_de_social_do_portal(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------
-- select public.mes_de_social_do_portal('2026-10',
--          (select id from public.clients limit 1));
-- select * from public.meses_de_social_do_portal(
--          (select id from public.clients limit 1));
