-- ===========================================================================
-- 0111 - O CLIENTE SABE QUE A PECA FOI PROGRAMADA
--
-- Decisao do usuario: *"preciso que o cliente saiba, quando o post foi
-- programado ja no portal do cliente, pode adicionar esse aviso para os
-- clientes?"*.
--
-- ---------------------------------------------------------------------------
-- O FATO JA EXISTE, E SO A AGENCIA O ENXERGA.
--
-- Fechar a caixinha da ultima fase da corrente E programar o post -- o lugar
-- existe desde a 0045, e o selo "Programado" na lista interna sai dai. O que
-- o cliente tem hoje e `posts.status = 'aprovado'` e, quando alguem a
-- escreveu, a data de publicacao: duas situacoes OPOSTAS com a mesma cara --
-- a peca que ele aprovou e ninguem agendou, e a que ja esta na fila da rede.
--
-- E a queixa e a mesma que criou o selo do lado de ca, um nivel acima: *"a
-- lista mostrava a mesma linha para o post aprovado que ninguem agendou e
-- para o que ja esta na fila"*.
--
-- ---------------------------------------------------------------------------
-- NAO HA COLUNA NOVA, E NAO HA VALOR NOVO DE ENUM.
--
-- `programado` continua DERIVADO, que e a decisao escrita em
-- `lib/dados/social-media.ts`: uma coluna ao lado criaria duas verdades sobre
-- o mesmo fato, e elas divergiriam no primeiro pedido de ajustes do cliente --
-- que desmarca a caixinha e nao teria como desmarcar a coluna.
--
-- E um oitavo valor em `content_status` seria pior: aquele enum e o CICLO COM
-- O CLIENTE -- em producao, em aprovacao, ajustes, aprovado --, e programar e
-- trabalho da agencia DEPOIS da decisao dele. Pondo `programado` la, um post
-- agendado deixaria de ser `aprovado`, e todo lugar que conta aprovacao --
-- a barra do cartao da conta, a fase do material no portal, o filtro do mes --
-- passaria a contar menos do que existe.
--
-- ---------------------------------------------------------------------------
-- O CLIENTE NAO GANHA POLICY NA CORRENTE, e esta e a linha que mais importa.
--
-- A regra da 0045 continua inteira: a corrente e conversa interna -- quem esta
-- com o material na mao, qual etapa travou, quem atrasou --, e desde a 0088
-- ela mora em `subtasks` e `post_etapa_progresso`. Ele nao tem policy em
-- nenhuma das duas, e nao passa a ter.
--
-- O que ele recebe e o AGREGADO, por uma funcao `security definer` que
-- devolve um booleano por peca e mais nada: nem quem programou, nem quando,
-- nem que fase e. E a forma de `o_que_o_cliente_decide()` (0076), de
-- `usuarios_do_meu_cliente()` (0031), de `meus_pedidos_de_nota()` (0066) e de
-- `meus_comodatos()` (0069).
--
-- **E A GUARDA E ESCRITA A MAO, que e a parte que a bateria mede:** `security
-- definer` nao passa pela RLS de `posts`, entao as linhas que repetem
-- `posts_select_cliente` sao o que impede a funcao de responder sobre o post
-- de qualquer empresa para quem tiver o uuid -- e o furo passa despercebido
-- num banco com um cliente so, que e a licao da `calendar_events`.
--
-- ---------------------------------------------------------------------------
-- ELA RECEBE UMA LISTA, E NAO UM POST.
--
-- `o_que_o_cliente_decide()` e de um post porque quem a chama e a tela de
-- decisao, que e de um post. Aqui os dois chamadores sao o MES inteiro -- o
-- calendario, a lista e a grade do feed -- e o detalhe. Uma funcao por post
-- seria uma chamada por linha do calendario, e o mes cheio tem trinta: e a
-- mesma decisao de "as rodadas de todos os posts numa consulta so".
--
-- A lista que a tela passa e a dos ids que ela JA LEU, e portanto ids que
-- passaram pela RLS. A guarda la dentro nao confia nisso de qualquer forma --
-- ela pergunta de novo, por id.
--
-- ---------------------------------------------------------------------------
-- A PERGUNTA E PELO PAPEL `pos_entrega`, NUNCA PELO NOME "Programar" (0087).
--
-- A corrente e editavel por conta desde a 0087, e um fluxo que chame esse elo
-- de "Agendar na rede" deixaria o aviso apagado para sempre -- sem erro em
-- lugar nenhum, que e o modo de falha desta casa.
--
-- *E a consequencia disso fica dita em vez de escondida:* um fluxo SEM elo de
-- pos-entrega nunca tem peca programada, e o aviso simplesmente nao aparece
-- naquela conta. E o mesmo comportamento do selo do lado da agencia, e e o
-- certo: a agencia daquela conta nao marca em lugar nenhum que agendou.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Quais destas pecas ja foram programadas
--
-- Devolve so os ids das que foram -- nunca uma linha por peca com um booleano
-- `false` dentro. A ausencia e a resposta, e e o que faz a tela nao precisar
-- de um `case` para distinguir "nao programada" de "a funcao nao respondeu".
-- ---------------------------------------------------------------------------
create or replace function public.pecas_programadas(p_ids uuid[])
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return;
  end if;

  return query
    select p.id
      from public.posts p
      join public.subtasks s
        on s.task_id = p.social_task_id
       and s.social_papel = 'pos_entrega'
      join public.post_etapa_progresso g
        on g.post_id = p.id
       and g.subtask_id = s.id
     where p.id = any(p_ids)
       and g.concluido
       -- A MESMA PERGUNTA QUE `posso_ver_solicitacao` FAZ NA SUA TABELA, e a
       -- mesma que `o_que_o_cliente_decide()` escreve a mao: o definer nao a
       -- faz sozinho. Tirando estas duas condicoes, a funcao conta a peca de
       -- qualquer empresa para quem tiver o uuid.
       and (
         public.is_staff()
         or (
           p.client_id in (select public.my_client_ids())
           and p.enviado_em is not null
         )
       );
end;
$func$;

comment on function public.pecas_programadas(uuid[]) is
  'Quais destas pecas o cliente pode ver E ja foram programadas -- a caixinha da fase `pos_entrega` fechada (0088). Definer para devolver so o agregado: o cliente nao tem policy na corrente, e nao passa a ter.';

-- O SUPABASE CONCEDE `execute` A `public` EM TODA FUNCAO NOVA, e o PostgREST
-- publica o schema `public` sozinho. Sem o revoke, qualquer navegador com a
-- chave anon -- que vai no bundle -- chamaria esta funcao sem sessao nenhuma,
-- e a guarda de cima cairia no ramo do `my_client_ids()` vazio... que devolve
-- zero linhas. O revoke nao esta aqui porque o vazamento seria grande: esta
-- aqui porque uma porta sem dono e uma porta que alguem abre no dia em que a
-- guarda mudar. E a licao da 0071.
revoke all on function public.pecas_programadas(uuid[]) from public;
revoke all on function public.pecas_programadas(uuid[]) from anon;
grant execute on function public.pecas_programadas(uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONFERENCIA, para a segunda colagem:
--
--   select public.pecas_programadas(array[]::uuid[]);        -- zero linhas
--   select has_function_privilege('anon',
--     'public.pecas_programadas(uuid[])', 'execute');        -- f
-- ---------------------------------------------------------------------------
