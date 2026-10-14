-- ===========================================================================
-- 0103 - O PEDIDO NOVO AVISA TODO O ATENDIMENTO, E NAO UMA PESSOA SO
--
-- Decisao do usuario: *"Preciso que sempre que uma solicitacao entre, todas as
-- pessoas do atendimento, sejam avisadas"*.
--
-- O SINO EXISTIA DESDE A 0068 E ALCANCAVA **UMA** PESSOA:
-- `client_requests_avisa_atendimento` lia `clients.responsavel_atendimento_id`
-- e passava aquele uuid para `notificar()`. Duas consequencias, e a segunda e
-- pior que a primeira:
--
--   * a conta COM atendente avisava so ele -- de ferias, num cliente, ou
--     simplesmente sem abrir o Full Hub naquela tarde, o pedido esperava;
--   * a conta SEM atendente nao avisava NINGUEM. `responsavel_atendimento_id`
--     e opcional desde o Sprint 2 e e nulo na maioria das contas; `notificar()`
--     devolve `null` quando nao ha a quem avisar (0062), entao o pedido entrava
--     na caixa de entrada e o sino nao tocava para pessoa alguma. E `on delete
--     set null` faz disso uma bomba com relogio: no dia em que o atendente sai
--     da agencia, os pedidos daquela conta passam a chegar em silencio.
--
-- O cabecalho da 0068 ja descrevia o segundo caso e o aceitava -- *"o que se
-- perde e o sino; o pedido esta na caixa de entrada, que e onde o Atendimento
-- olha"*. A frase supoe que alguem abre aquela fila por habito, e e a mesma
-- suposicao que a 0079 desfez para o aval interno: *"conta sem aprovador
-- configurado nao avisava ninguem, e isso se le exatamente como 'as
-- notificacoes nao funcionam'"*.
--
-- ---------------------------------------------------------------------------
-- QUEM E AVISADO, E POR QUE NAO E `is_atendimento()`
--
-- A pergunta parece a de `is_atendimento()` (0003) e nao e: aquela responde
-- sobre QUEM ESTA LOGADO, por `auth.uid()`, e o que este trigger precisa e uma
-- LISTA. `quem_atende()` e essa lista, num lugar so -- a mesma razao pela qual
-- `carga_do_dia()` e a fonte unica da conta de carga: duas consultas
-- respondendo "quem atende esta conta" divergiriam, e a que divergiria e a do
-- trigger, que ninguem le.
--
-- Ela devolve, nesta ordem de preferencia:
--
--   1. toda pessoa ATIVA com `funcao = 'Atendimento'`, mais o atendente da
--      conta quando houver um -- ele continua sendo avisado mesmo sendo da
--      gestao, que e o caso de quase toda conta pequena, e tira-lo agora seria
--      trocar um aviso a mais por um aviso a menos;
--   2. a GESTAO ATIVA inteira, e so quando a primeira lista sai vazia.
--
-- O FALLBACK E A 0079 PALAVRA POR PALAVRA, e o lado certo do erro: um aviso a
-- mais na caixa de quem decide, em vez de um pedido de cliente que nao toca
-- sino nenhum. Ele nao vale como regra -- avisar toda a gestao de TODO pedido
-- transformaria o sino em ruido, que e a lição do lote da 0098 --, vale como o
-- estado em que o cadastro ainda nao diz quem atende.
--
-- `profiles.ativo` E NAO `pessoa_desligada()`, porque a pergunta aqui ja
-- combina os dois lados que `is_atendimento()` combina: `tm.ativo` (a ficha) e
-- `p.ativo` (o acesso). Quem saiu da agencia nao recebe, que e a regra da 0041
-- e da 0064.
--
-- E QUEM CAUSOU O AVISO NAO RECEBE, e isso nao se repete aqui: e de
-- `notificar()` desde a 0062. A pessoa do Atendimento que registra por telefone
-- o pedido de um cliente (a 0068 deixa, e `criado_por` assina) nao toca o
-- proprio sino.
--
-- ---------------------------------------------------------------------------
-- E A MENSAGEM DA CONVERSA TINHA O MESMO FURO, no mesmo arquivo
--
-- `request_messages_avisa` (0068) decide quem e o outro lado: da agencia para o
-- cliente sao todas as pessoas da empresa, e do cliente para a agencia era
-- `responsavel_atendimento_id` -- a mesma uma pessoa, o mesmo silencio quando
-- ela e nula. O pedido do usuario fala do pedido ENTRANDO; a conversa dele e a
-- continuacao do mesmo pedido, e deixar uma metade consertada seria o produto
-- avisando a equipe inteira na abertura e ninguem na pergunta seguinte.
--
-- Os dois triggers passam pela MESMA funcao, que e o que impede isso de
-- divergir de novo.
--
-- ---------------------------------------------------------------------------
-- O QUE ESTA MIGRATION NAO FAZ, e e dito em vez de escondido
--
--   * **nao manda e-mail.** `lib/email/` cobre material enviado, comentario no
--     material e decisao do cliente (Sprint 16 / Parte B); pedido novo nao esta
--     lá, e por aqui nao entra -- o e-mail sai da camada de aplicacao e esta
--     regra mora no banco, que e a assimetria escrita no CLAUDE.md;
--   * **nao poe o pedido no "Precisa de mim" da Home.** O bloco tem a fila de
--     Full Days, a nota recusada e a fila do socio; o pedido do cliente nao. O
--     sino toca uma vez e se apaga no primeiro clique, entao essa continua
--     sendo a metade que falta -- e e uma linha em `home_summary()` mais uma em
--     `linhasDoPrecisaDeMim()`, nao uma migration.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A LISTA, NUM LUGAR SO
-- ---------------------------------------------------------------------------
create or replace function public.quem_atende(p_client_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = public
stable
as $func$
declare
  v_responsavel uuid;
begin
  select c.responsavel_atendimento_id
    into v_responsavel
    from public.clients c
   where c.id = p_client_id;

  return query
  with atendimento as (
    select p.id
      from public.profiles p
     where p.ativo
       and (
         exists (
           select 1
             from public.team_members tm
            where tm.user_id = p.id
              and tm.funcao = 'Atendimento'
              and tm.ativo
         )
         or p.id = v_responsavel
       )
  )
  select a.id from atendimento a
  union all
  -- SEM NINGUEM NO ATENDIMENTO, A GESTAO ATIVA. O `not exists` e o que faz
  -- disto um fallback e nao uma segunda lista somada a primeira.
  select p.id
    from public.profiles p
   where not exists (select 1 from atendimento)
     and p.ativo
     and p.role in ('desenvolvedor', 'socio');
end;
$func$;

comment on function public.quem_atende(uuid) is
  'Quem a agencia avisa quando um cliente mexe num pedido (0103): toda pessoa ativa com funcao Atendimento, mais o atendente da conta quando houver, e a gestao ativa inteira quando essa lista sai vazia. E uma LISTA, ao contrario de is_atendimento(), que responde sobre quem esta logado. Lugar unico de proposito: dois triggers a chamam.';

-- A conta crua nao e chamavel de fora: ela e `security definer` e lista ids de
-- gente, e quem a usa sao dois triggers que rodam como o dono. E a decisao da
-- 0071 -- o Postgres concede `execute` a `public` em toda funcao nova, e o
-- PostgREST publica o schema sozinho.
revoke all on function public.quem_atende(uuid) from public;


-- ---------------------------------------------------------------------------
-- PASSO 2 - O PEDIDO NOVO
-- ---------------------------------------------------------------------------
create or replace function public.client_requests_avisa_atendimento()
returns trigger language plpgsql security definer set search_path = public
as $func$
declare
  v_empresa text;
  v_pessoa  uuid;
begin
  select c.nome_empresa
    into v_empresa
    from public.clients c
   where c.id = new.client_id;

  for v_pessoa in select q from public.quem_atende(new.client_id) q
  loop
    perform public.notificar(
      v_pessoa,
      'solicitacao',
      'Pedido novo de ' || coalesce(v_empresa, 'um cliente'),
      new.titulo,
      '/painel/solicitacoes/' || new.id::text
    );
  end loop;

  return null;
end;
$func$;

comment on function public.client_requests_avisa_atendimento is
  'Avisa o Atendimento quando um pedido entra (0068, ampliada na 0103): era so o atendente da conta -- e ninguem quando ele era nulo --, e passou a ser a lista de quem_atende(). Nao avisa quem abriu o pedido nem quem saiu da agencia, e nunca derruba a escrita que chamou.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - A MENSAGEM DA CONVERSA, no ramo do cliente para a agencia
--
-- A funcao e reescrita INTEIRA, e o ramo da agencia para o cliente vem copiado
-- da 0068 sem uma virgula de diferenca. E a lição da 0030: `create or replace`
-- parte do texto que alguem escreve agora, e nao avisa quando o texto novo tem
-- menos coisa que o antigo -- foi assim que o bloco de carimbos de
-- `validar_transicao_de_subtarefa` ficou duas migrations para tras.
-- ---------------------------------------------------------------------------
create or replace function public.request_messages_avisa()
returns trigger language plpgsql security definer set search_path = public
as $func$
declare
  v_cliente  uuid;
  v_titulo   text;
  v_empresa  text;
  v_autor_e_equipe boolean;
  v_pessoa   uuid;
begin
  select r.client_id, r.titulo into v_cliente, v_titulo
    from public.client_requests r where r.id = new.request_id;

  select c.nome_empresa into v_empresa
    from public.clients c where c.id = v_cliente;

  select exists (
    select 1 from public.profiles p
     where p.id = new.autor_id and p.role <> 'cliente'
  ) into v_autor_e_equipe;

  if v_autor_e_equipe then
    for v_pessoa in
      select cu.user_id from public.client_users cu where cu.client_id = v_cliente
    loop
      perform public.notificar(
        v_pessoa, 'solicitacao',
        'Resposta no seu pedido',
        v_titulo,
        '/portal/solicitacoes/' || new.request_id::text
      );
    end loop;
  else
    for v_pessoa in select q from public.quem_atende(v_cliente) q
    loop
      perform public.notificar(
        v_pessoa, 'solicitacao',
        'Mensagem de ' || coalesce(v_empresa, 'um cliente'),
        v_titulo,
        '/painel/solicitacoes/' || new.request_id::text
      );
    end loop;
  end if;

  return null;
end;
$func$;

comment on function public.request_messages_avisa is
  'Avisa o outro lado de uma mensagem do pedido (0068, ampliada na 0103): da agencia para o cliente sao todas as pessoas da empresa; do cliente para a agencia era o atendente da conta e passou a ser a lista de quem_atende(). O texto da mensagem nao vai no aviso.';


-- ---------------------------------------------------------------------------
-- CONFERENCIA (nao escreve nada)
--
--   select p.nome, p.role from public.profiles p
--     join public.quem_atende('<id da conta>') q on q = p.id;
--
-- Numa conta com atendente, ele aparece na lista junto com o Atendimento. Numa
-- conta sem atendente e com gente no Atendimento, aparece o Atendimento. Numa
-- agencia que ainda nao cadastrou ninguem no Atendimento, aparece a gestao --
-- e e esse terceiro caso que antes desta migration devolvia zero avisos.
-- ---------------------------------------------------------------------------
