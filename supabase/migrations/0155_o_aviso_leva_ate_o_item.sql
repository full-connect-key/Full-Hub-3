-- ===========================================================================
-- 0155 - O AVISO LEVA ATE O ITEM, E SAI QUANDO O ITEM SAI
--
-- Relato do usuario, em duas frases: "aparece um comentario de cliente sem
-- resposta, mas quando clico vai para o social media" e "tem varias partes que
-- aparecem que tem algo atrasado, ou que dependem de mim, e quando clico, nao
-- me leva a lugar nenhum".
--
-- MEDIDO CONTRA O POSTGRES DE PRODUCAO, e sao duas causas:
--
--   1. SETE AVISOS DO SINO APONTAM PARA O MODULO, e nao para o item. O aviso
--      diz "Fulano pediu ajustes em KV" e o clique cai em `/painel/aprovacoes`
--      -- a lista de todas as campanhas. O de post caia em
--      `/painel/gestao-tasks`, que nem e a tela de posts.
--
--   2. O ITEM APAGADO DEIXA O AVISO PARA TRAS. 46 avisos apontavam para cinco
--      demandas que nao existem mais (20 deles ainda nao lidos), e 90 diziam
--      "tem material esperando o aval da gestao" sobre meses de social que
--      foram zerados em outubro. `notifications` nao tem chave estrangeira
--      para o item -- o link e texto --, entao nenhum cascade os alcanca.
--
-- ---------------------------------------------------------------------------
-- AS FUNCOES SAO REMENDADAS A PARTIR DO CATALOGO, NUNCA DO ARQUIVO.
--
-- E a tecnica da 0123 e da 0146, pela razao escrita nas duas: o corpo que esta
-- no ar nao e o do arquivo da migration que o criou (ha CRLF de colagem e
-- remendos posteriores), e redigitar duzentas linhas de
-- `decidir_rodada_do_cliente` para trocar quatro literais e a 0030 esperando
-- acontecer. O bloco CONTA cada citacao e ESTOURA quando a contagem nao bate:
-- `replace()` que nao acha devolve o texto inteiro, calado, e o `execute`
-- recriaria a funcao identica.
--
-- **E ELE E RE-EXECUTAVEL:** o trecho novo nao contem o antigo como frase
-- inteira (o antigo termina em aspa + virgula/parentese), entao a segunda
-- colagem acha zero do antigo E acha o novo -- e passa sem fazer nada.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O remendador
--
-- `p_vezes` e quantas citacoes do trecho antigo a funcao TEM de ter. Zero do
-- antigo com o novo presente e "ja aplicado"; qualquer outra contagem e um
-- corpo que este arquivo nao conhece, e ai a resposta certa e parar.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.remendar(
  p_funcao text,
  p_de     text,
  p_para   text,
  p_vezes  integer
) returns void
language plpgsql
as $rem$
declare
  alvo   oid;
  corpo  text;
  achou  integer;
begin
  select p.oid into alvo
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname = p_funcao;

  if alvo is null then
    raise exception 'A funcao % nao existe neste banco.', p_funcao;
  end if;

  corpo := replace(pg_get_functiondef(alvo), E'\r\n', E'\n');
  achou := (length(corpo) - length(replace(corpo, p_de, ''))) / length(p_de);

  if achou = 0 and position(p_para in corpo) > 0 then
    return; -- ja aplicado
  end if;

  if achou <> p_vezes then
    raise exception
      'A funcao % tem % citacao(oes) de [%], e esta migration espera %.',
      p_funcao, achou, p_de, p_vezes
      using hint = 'O corpo no ar nao e o que a 0155 conhece. Leia a funcao e troque o link a mao.';
  end if;

  execute replace(corpo, p_de, p_para);
end;
$rem$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - Os sete links
-- ---------------------------------------------------------------------------

-- A decisao do cliente sobre uma PECA DE CAMPANHA: da lista de campanhas para
-- a campanha, com a peca aberta.
select pg_temp.remendar(
  'decidir_rodada_do_cliente',
  $a$p_comentario, '/painel/aprovacoes');$a$,
  $a$p_comentario, format('/painel/aprovacoes/campanhas/%s?peca=%s', d.campaign_id, entr));$a$,
  2
);

-- A decisao do cliente sobre um POST: caia em Gestao de Tasks, que nao e a
-- tela de posts -- e que quem produz nem alcanca.
select pg_temp.remendar(
  'decidir_rodada_do_cliente',
  $a$p_comentario, '/painel/gestao-tasks');$a$,
  $a$p_comentario, '/painel/social-media?post=' || post::text);$a$,
  2
);

-- O aval interno pedido para um post.
select pg_temp.remendar(
  'avisa_aprovador_da_conta',
  $a$select p.client_id, p.tema, '/painel/social-media'
$a$,
  $a$select p.client_id, p.tema, '/painel/social-media?post=' || p.id::text
$a$,
  1
);

-- O comentario do cliente num post.
select pg_temp.remendar(
  'avisar_comentario_do_cliente',
  $a$format('/painel/gestao-tasks')$a$,
  $a$('/painel/social-media?post=' || p.id::text)$a$,
  2
);

-- O pedido de ajuste na etapa de quem produz: de "Minhas Tasks" para a
-- demanda aberta em Minhas Tasks.
select pg_temp.remendar(
  'subtasks_avisa_ajuste',
  $a$    '/painel/minhas-tasks'
$a$,
  $a$    '/painel/minhas-tasks?task=' || new.task_id::text
$a$,
  1
);

-- O cliente pediu ajustes num post do mes.
select pg_temp.remendar(
  'posts_corrente_do_cliente',
  $a$        '/painel/social-media'
$a$,
  $a$        '/painel/social-media?post=' || new.id::text
$a$,
  1
);

-- O lote do mes foi respondido: do indice para o MES daquela conta.
select pg_temp.remendar(
  'social_lote_fecha_sozinho',
  $a$      '/painel/social-media'
$a$,
  $a$      coalesce((select format('/painel/social-media?aba=social&mes=%s&cliente=%s',
                              to_char(t.social_do_mes, 'YYYY-MM'), t.client_id)
                  from public.tasks t
                 where t.id = l.task_id
                   and t.social_do_mes is not null), '/painel/social-media')
$a$,
  1
);


-- ---------------------------------------------------------------------------
-- PASSO 3 - O aviso sai quando o item sai
--
-- E GATILHO E NAO ACTION, pela razao da 0045 e da 0098: uma demanda e apagada
-- pelo board, pelo "apagar o mes" do social, pelo "apagar campanha", por um
-- script de zerar colado no SQL Editor -- e um aviso limpo na camada de
-- aplicacao limparia o que passou pela tela e deixaria o resto.
--
-- A PERGUNTA E O UUID DENTRO DO LINK. Um uuid nao colide com outro por acaso,
-- entao `like '%' || id || '%'` nao alcanca o aviso de outro item.
--
-- `security definer` porque `notifications` nao tem policy de DELETE para
-- ninguem alem do dono do aviso, e quem apaga a demanda nao e o dono dos
-- avisos dela.
-- ---------------------------------------------------------------------------
create or replace function public.avisos_saem_com_o_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  delete from public.notifications n
   where n.link like '%' || old.id::text || '%';
  return old;
end;
$func$;

comment on function public.avisos_saem_com_o_item() is
  'Apaga os avisos do sino que apontam para um item que acabou de ser apagado (0155). O link e texto, sem chave estrangeira -- sem isto o aviso leva a um 404.';

revoke all on function public.avisos_saem_com_o_item() from public;
revoke all on function public.avisos_saem_com_o_item() from anon;
revoke all on function public.avisos_saem_com_o_item() from authenticated;

do $do$
declare
  tabela text;
begin
  foreach tabela in array array[
    'tasks', 'posts', 'campaigns', 'deliverables', 'client_requests', 'events'
  ] loop
    execute format(
      'drop trigger if exists %I on public.%I', tabela || '_leva_os_avisos', tabela);
    execute format(
      'create trigger %I after delete on public.%I
         for each row execute function public.avisos_saem_com_o_item()',
      tabela || '_leva_os_avisos', tabela);
  end loop;
end;
$do$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - A limpeza do que ja ficou para tras
--
-- DUAS FAMILIAS, e cada uma com a prova de que o aviso nao leva a nada:
--
--   a) o link carrega um uuid que nao existe em NENHUMA das tabelas para onde
--      um aviso aponta;
--   b) o aviso de "material esperando aval" com o link generico do social,
--      quando NAO HA rodada interna de post pendente -- ele cobra uma fila
--      que esta vazia. (Os novos nascem com `?post=`, pelo PASSO 2.)
--
-- Rodar de novo apaga zero.
-- ---------------------------------------------------------------------------
delete from public.notifications n
 where n.link ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
   and not exists (
     select 1
       from (
         select id from public.tasks
         union all select id from public.posts
         union all select id from public.campaigns
         union all select id from public.deliverables
         union all select id from public.client_requests
         union all select id from public.events
         union all select id from public.assets
         union all select id from public.subtasks
       ) vivos
      where vivos.id::text =
            substring(n.link from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
   );

delete from public.notifications n
 where n.link = '/painel/social-media'
   and n.titulo like 'Tem material esperando%'
   and not exists (
     select 1 from public.approval_rounds r
      where r.content_type = 'post'
        and r.escopo = 'interna'
        and r.status = 'pendente'
   );

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONFERENCIA, para a segunda colagem:
--
--   select count(*) from pg_trigger where tgname like '%_leva_os_avisos';  -- 6
--   select position('?post=' in prosrc) > 0
--     from pg_proc where proname = 'decidir_rodada_do_cliente';            -- t
-- ---------------------------------------------------------------------------
