-- ===========================================================================
-- 0100 - O MES DE SOCIAL QUE CHEGOU, PARA A TELA INICIAL DO PORTAL
--
-- Decisao do usuario, a outra metade do pedido das notificacoes da 0098: *"no
-- caso dos clientes, se eles receberam um mes de social, preciso que isso
-- apareca na pagina inicial do portal do cliente, com um botao para
-- direcionar para a aba de social, para ele realizar a aprovacao."*
--
-- A 0098 fez o SINO tocar quando a peca sai. O sino se apaga no primeiro
-- clique, e o que ele avisou nao existe em tela nenhuma depois disso -- e a
-- mesma razao pela qual o pedido de nota fiscal ganhou faixa em
-- `/painel/notas-fiscais` (0066) em vez de so um aviso. A tela inicial do
-- portal e onde o cliente entra; se o mes nao aparece la, ele precisa adivinhar
-- que existe uma area de Social com coisa dele esperando.
--
-- ---------------------------------------------------------------------------
-- A FUNCAO JA EXISTIA, E NINGUEM A CHAMAVA. `meses_de_social_do_portal()`
-- nasceu na 0091 para a navegacao do portal, que acabou sendo por FLECHA
-- (`NavegacaoDoMes`) e nao por lista -- e em nove sprints nenhuma linha de
-- `src/` a leu. E a ponte construida e nunca atravessada outra vez, e e por
-- isso que esta migration RESHAPEA em vez de criar uma funcao ao lado: uma
-- segunda que responde "os meses que esta empresa tem material" seria a
-- segunda verdade sobre o mesmo fato, e a que divergiria e justamente a sem
-- chamador.
--
-- O QUE ELA PASSA A DEVOLVER sao duas colunas, e cada uma tem uma razao:
--
--   * `task_id` -- a DEMANDA do mes. O bloco precisa dela para o link sair
--     exato, e o cliente nao enxerga `tasks` (`tasks_select_cliente` exige uma
--     rodada de escopo cliente numa subtarefa da demanda, e a demanda do mes
--     nao tem nenhuma). Sem ela a tela resolveria o mes com uma segunda RPC
--     por mes -- doze idas ao banco para desenhar um bloco.
--
--   * `esperando` -- quantas pecas daquele mes tem rodada de cliente PENDENTE.
--     E a conta que decide se o bloco aparece, e ela sai do SQL por uma razao
--     que nao e desempenho: a pergunta e sobre `approval_rounds`, que o
--     cliente le pela RLS dele -- contada no TypeScript ela dependeria de a
--     tela ter trazido todas as pecas de todos os meses, que nao e o que a
--     tela inicial carrega.
--
-- `pendente` E O UNICO ESTADO QUE CONTA, e e a regra da 0023: pedir aprovacao
-- nao e ter aprovacao, e o avesso vale igual -- rodada recusada nao esta
-- esperando ninguem do lado de fora, ela esta esperando a agencia refazer.
--
-- ---------------------------------------------------------------------------
-- O `drop` E OBRIGATORIO, e e a pegadinha que a 0088 pagou: `create or
-- replace` NAO troca o tipo de retorno de uma funcao `returns table` -- a
-- migration para com *"cannot change return type of existing function"*. E
-- junto com ele vao os grants, que e por isso que o `revoke`/`grant` da 0091 e
-- repetido aqui inteiro: sem isso a funcao nasceria com o `execute` de `public`
-- que o Postgres concede sozinho, e `anon` -- a chave que vai no bundle que o
-- navegador baixa -- leria os meses de qualquer empresa. E a licao da 0097 com
-- `academy_vencidos()`, onde o `revoke all ... from public` sozinho nao
-- alcancou o grant nominal que o Supabase deixa ligado.
--
-- ---------------------------------------------------------------------------
-- O QUE MUDA DE COMPORTAMENTO, e fica dito: ela passa a agrupar por DEMANDA e
-- nao so por competencia. Para quem responde por UMA empresa e exatamente o
-- mesmo resultado, porque `(client_id, social_do_mes)` e unico desde a 0061.
-- Para quem responde por DUAS, outubro deixa de vir numa linha somada e vem em
-- duas -- uma por conta. E a resposta certa para o bloco, que leva a pessoa
-- para a aba de Social de um mes especifico: somadas, as duas empresas dariam
-- um numero que nenhuma das duas telas mostra.
-- ===========================================================================

drop function if exists public.meses_de_social_do_portal(uuid);

create or replace function public.meses_de_social_do_portal(p_client_id uuid default null)
returns table (mes date, task_id uuid, pecas integer, esperando integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- A GUARDA E ESCRITA A MAO, e e a parte que a bateria mede. `security
  -- definer` nao passa pela RLS de `tasks` nem de `posts`, entao sem ela esta
  -- funcao responde sobre qualquer empresa para quem estiver logado -- e quem
  -- esta logado inclui o cliente. A equipe passa o `p_client_id`; o cliente e
  -- recortado por `my_client_ids()` e nao pode passar nenhum.
  if public.is_staff() and p_client_id is null then
    return;
  end if;

  return query
    select t.social_do_mes,
           t.id,
           count(p.id)::integer,
           count(p.id) filter (
             where exists (
               select 1 from public.approval_rounds r
                where r.content_type = 'post'
                  and r.content_id = p.id
                  and r.escopo = 'cliente'
                  and r.status = 'pendente'
             )
           )::integer
      from public.tasks t
      join public.posts p on p.social_task_id = t.id
     where t.social_do_mes is not null
       -- MES SEM PECA ENVIADA NAO EXISTE PARA O CLIENTE (0091), e e a linha da
       -- 0032 aplicada a navegacao: oferecer o mes que a agencia abriu e ainda
       -- nao mandou seria oferecer uma tela vazia com a cara de material que
       -- nao chegou.
       and p.enviado_em is not null
       and (
         case when public.is_staff()
              then t.client_id = p_client_id
              else t.client_id in (select public.my_client_ids())
         end
       )
     group by t.social_do_mes, t.id
     order by t.social_do_mes desc;
end;
$$;

comment on function public.meses_de_social_do_portal(uuid) is
  'Os meses de social que esta empresa tem material enviado, do mais novo para o mais antigo (0091, reshapeada pela 0100): a demanda de cada um, quantas pecas ela tem e quantas esperam a decisao do cliente. Mes sem peca enviada nao entra: ele nao existe para o cliente.';

revoke all on function public.meses_de_social_do_portal(uuid) from public;
revoke all on function public.meses_de_social_do_portal(uuid) from anon;
grant execute on function public.meses_de_social_do_portal(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- CONFERENCIA, para colar depois de aplicar
--
--   select * from public.meses_de_social_do_portal(
--            (select id from public.clients limit 1));
--
-- E a assinatura, que e o que a tela chama:
--
--   select pg_get_function_result(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'meses_de_social_do_portal';
-- ---------------------------------------------------------------------------
