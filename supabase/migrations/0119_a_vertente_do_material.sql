-- ===========================================================================
-- 0119 - A VERTENTE DE CADA MATERIAL, para a Biblioteca do cliente
--
-- Decisao do usuario, item 29 da lista: *"navegacao por vertente dentro da
-- Biblioteca, gerada a partir das vertentes cadastradas na conta"*, com
-- *"opcao de visualizar todos os materiais"* e *"preservar o acesso por
-- cliente"*.
--
-- ---------------------------------------------------------------------------
-- A METADE QUE JA EXISTE, e e por isso que esta migration e uma funcao e nada
-- mais:
--
--   * `client_vertentes` ja e legivel pelo cliente -- o SELECT da 0118 e
--     `is_staff() or client_id in my_client_ids()`, escrito assim com a razao
--     registrada no cabecalho dela: *"o campo da demanda e de quem abre
--     demanda e a Biblioteca do portal e do cliente"*. Os CHIPS da navegacao
--     saem dali, por `vertentesDoCliente()`, sem uma linha nova.
--
--   * `tasks.vertente_id` ja existe, e a heranca ja e estrutural: `subtasks`
--     NAO tem a coluna de proposito, entao a vertente de uma etapa E a da
--     demanda dela.
--
-- O que falta e uma coisa so: dizer, para cada MATERIAL que o cliente enxerga,
-- de que vertente ele e.
--
-- ---------------------------------------------------------------------------
-- POR QUE ISSO NAO E UM `select` DA TELA: O CLIENTE NAO ENXERGA `tasks`
--
-- A vertente de uma peca de social mora na demanda do MES
-- (`posts.social_task_id` -> `tasks.vertente_id`), e a de uma peca de campanha
-- mora na demanda da campanha (`campaigns.task_id`). As duas pontes existem e
-- as duas sao inalcancaveis pelo cliente: `tasks_select_cliente` exige uma
-- rodada de escopo CLIENTE numa SUBTAREFA da demanda, e nenhuma das duas tem
-- -- as rodadas do mes sao dos posts, e as da campanha sao dos entregaveis.
--
-- **Esta casa ja pagou por isso duas vezes**, e as duas estao escritas: a
-- policy do lote na 0090 e o recorte do mes na 0091, cujo cabecalho diz a
-- frase inteira -- *"um `exists` em `tasks` dentro de uma consulta do cliente
-- sempre da falso"*. Um `select` em `tasks` aqui devolveria VAZIO para o
-- cliente, a Biblioteca abriria com todo material em "Sem vertente", e nada
-- na tela diria por que. E o modo de falha desta casa: plausivel e errado.
--
-- Entao e `security definer`, com a guarda escrita a mao -- a forma de
-- `o_que_o_cliente_decide()` (0076), `meus_comodatos()` (0069),
-- `meus_pedidos_de_nota()` (0066) e `pecas_programadas()` (0111).
--
-- ---------------------------------------------------------------------------
-- E ELA RECEBE OS IDS, nunca a empresa
--
-- Devolvendo tudo o que a empresa tem, ela entregaria ao cliente a LISTA de
-- ids de etapa, de post e de peca da conta -- inclusive das que ele nao pode
-- ver. A tela passa os ids que ela JA LEU, e portanto ids que passaram pela
-- RLS; a guarda la dentro nao confia nisso de qualquer forma e pergunta de
-- novo, por id. E a decisao de `pecas_programadas(p_ids)` palavra por palavra.
--
-- Sao TRES arrays porque sao tres espacos de id, e um array so pediria um
-- array paralelo de tipos -- duas listas que precisam ter o mesmo tamanho sao
-- duas verdades esperando divergir.
--
-- ---------------------------------------------------------------------------
-- A AUSENCIA E A RESPOSTA
--
-- Ela devolve so o material que TEM vertente -- nunca uma linha por material
-- com um nulo dentro. E o que faz a tela nao precisar de um `case` para
-- distinguir "sem vertente" de "a funcao nao respondeu", e e a decisao de
-- `pecas_programadas()`.
--
-- **E a desativada VOLTA**, ao contrario do seletor da demanda: o material
-- continua sendo daquela frente, e esconder a classificacao de uma vertente
-- aposentada faria o material dela aparecer em "Sem vertente" -- que e uma
-- afirmacao falsa. Quem decide o que OFERECER e a tela, por
-- `vertentesParaEscolher()`.
--
-- ---------------------------------------------------------------------------
-- O QUE NAO PRECISA DE CHECAGEM, e fica dito para ninguem acrescenta-la: que
-- a vertente seja da mesma conta do material. Quem garante isso e o gatilho
-- `tasks_vertente_da_conta` da 0118, nos dois sentidos -- e uma segunda
-- pergunta aqui seria uma segunda verdade sobre o mesmo fato.
-- ===========================================================================

create or replace function public.vertente_dos_materiais(
  p_subtasks     uuid[] default '{}',
  p_posts        uuid[] default '{}',
  p_entregaveis  uuid[] default '{}'
)
returns table (tipo text, conteudo_id uuid, vertente_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  -- ------------------------------------------------------------------
  -- A ETAPA DE DEMANDA. A guarda e `subtask_visivel_ao_cliente()`, que e a
  -- MESMA funcao de `subtasks_select_cliente` -- e nao uma copia da pergunta
  -- dela: duas versoes do "o cliente pode ver esta etapa" divergiriam no dia
  -- em que uma fosse ajustada.
  -- ------------------------------------------------------------------
  return query
    select 'subtask'::text, s.id, t.vertente_id
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where s.id = any(coalesce(p_subtasks, '{}'))
       and t.vertente_id is not null
       and (public.is_staff() or public.subtask_visivel_ao_cliente(s.id));

  -- ------------------------------------------------------------------
  -- A PECA DE SOCIAL, pela demanda do mes (0088). As duas condicoes do ramo
  -- do cliente repetem `posts_select_cliente`: tirando-as, a funcao responde
  -- sobre a peca de qualquer empresa para quem tiver o uuid -- e o furo passa
  -- despercebido num banco com um cliente so, que e a licao da
  -- `calendar_events`.
  -- ------------------------------------------------------------------
  return query
    select 'post'::text, p.id, t.vertente_id
      from public.posts p
      join public.tasks t on t.id = p.social_task_id
     where p.id = any(coalesce(p_posts, '{}'))
       and t.vertente_id is not null
       and (
         public.is_staff()
         or (
           p.client_id in (select public.my_client_ids())
           and p.enviado_em is not null
         )
       );

  -- ------------------------------------------------------------------
  -- A PECA DE CAMPANHA, pela demanda da campanha (0051). As duas condicoes
  -- repetem `deliverables_select_cliente` (0033).
  --
  -- `campaigns.task_id` e nulo nas campanhas abertas ANTES da 0051, e o `join`
  -- as deixa de fora sem erro nenhum: elas nao tem demanda, logo nao tem
  -- vertente. E o estado que `scripts/campanhas-sem-demanda.sql` conserta.
  -- ------------------------------------------------------------------
  return query
    select 'deliverable'::text, d.id, t.vertente_id
      from public.deliverables d
      join public.campaigns c on c.id = d.campaign_id
      join public.tasks t on t.id = c.task_id
     where d.id = any(coalesce(p_entregaveis, '{}'))
       and t.vertente_id is not null
       and (
         public.is_staff()
         or (
           c.client_id in (select public.my_client_ids())
           and d.enviado_em is not null
         )
       );
end;
$func$;

comment on function public.vertente_dos_materiais(uuid[], uuid[], uuid[]) is
  'De que vertente e cada material que o cliente pode ver -- a etapa pela demanda, o post pelo mes, a peca pela campanha. Definer porque o cliente NAO enxerga `tasks` (0091): um select dela numa consulta do cliente sempre volta vazio. Devolve so o que TEM vertente.';

-- O SUPABASE CONCEDE `execute` A `public` EM TODA FUNCAO NOVA, e o PostgREST
-- publica o schema `public` sozinho. E a licao da 0071: uma porta sem dono e
-- uma porta que alguem abre no dia em que a guarda mudar.
revoke all    on function public.vertente_dos_materiais(uuid[], uuid[], uuid[]) from public;
revoke all    on function public.vertente_dos_materiais(uuid[], uuid[], uuid[]) from anon;
grant execute on function public.vertente_dos_materiais(uuid[], uuid[], uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONFERENCIA, para a segunda colagem:
--
--   select p.proname, pg_get_function_identity_arguments(p.oid) as args
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname = 'vertente_dos_materiais';
--
--   -- e quem pode chamar:
--   select grantee, privilege_type
--     from information_schema.role_routine_grants
--    where routine_name = 'vertente_dos_materiais';
-- ---------------------------------------------------------------------------
