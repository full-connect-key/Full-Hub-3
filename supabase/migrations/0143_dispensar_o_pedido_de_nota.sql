-- ===========================================================================
-- 0143 - O PEDIDO DE NOTA VIRA UM AVISO GLOBAL, E CADA UM DISPENSA O SEU
--
-- Decisao do usuario, item 12: "sempre que o envio de uma Nota Fiscal for
-- solicitado, todos os usuarios devem receber um aviso; o aviso deve aparecer
-- em formato de pop-up global, independentemente da aba ou pagina em que o
-- usuario esteja; a notificacao deve funcionar em toda a area interna;
-- implementar em tempo real, sem necessidade de atualizar a pagina; permitir
-- que cada usuario dispense o pop-up apos visualizar a solicitacao, mantendo
-- o registro na central de notificacoes".
--
-- ---------------------------------------------------------------------------
-- TRES DAS CINCO METADES JA EXISTIAM, e ir medir antes de escrever e o que
-- separou o que precisava de banco do que so precisava de tela -- a licao da
-- 0060, da 0127 e da 0128.
--
--   o aviso para toda a equipe  -> `solicitar_notas_do_mes()` chama
--                                  `notificar()` para cada pessoa, desde a 0066
--   o registro na central       -> `notifications`, com `lida_em` e sem DELETE
--   em tempo real               -> `CANAL_DA_EQUIPE`, desde o Sprint 16
--   o POP-UP                    -> nao existia
--   DISPENSAR por pessoa        -> nao existia
--
-- ---------------------------------------------------------------------------
-- "TODOS OS USUARIOS" CONTINUA SENDO QUEM A COBRANCA ALCANCA, e a diferenca e
-- dita em vez de escondida.
--
-- `quem_deve_nota()` exclui tres: o cliente, quem saiu da agencia, e QUEM JA
-- MANDOU A NOTA DO MES. A terceira e decisao escrita da 0066, com o argumento
-- inteiro: "um aviso que cobra o que a pessoa ja fez e o aviso que ela aprende
-- a ignorar". Um pop-up global cobrando a nota de quem a enviou ontem seria
-- aquela frase elevada ao quadrado -- ele para a tela em vez de so somar uma
-- linha no sino.
--
-- Entao o pop-up alcanca exatamente quem o pedido alcanca. Uma segunda regra
-- de destinatario, so para ele, seria duas verdades sobre quem foi cobrado --
-- e a que divergiria seria a nova, porque ninguem a re-le ao mexer na funcao.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- DISPENSAR NAO E "MARCAR COMO LIDA", E A SEPARACAO E O PEDIDO DELE.
--
-- A tentacao e usar `notifications.lida_em` como a dispensa: nao nasce tabela,
-- e "mantendo o registro na central" sai de graca. Ela se desfaz em duas
-- linhas:
--
--   1. a frase dele separa as duas coisas -- "dispense o pop-up MANTENDO o
--      registro na central". Com `lida_em`, dispensar o pop-up apaga o aviso
--      do contador do sino, que e exatamente o registro que ele pediu para
--      ficar;
--   2. e o pior: `lida_em` nao sabe quando o pedido deixou de valer. Quem
--      manda a nota resolve a cobranca, e `meus_pedidos_de_nota()` ja para de
--      devolver aquele mes no mesmo instante -- a notificacao, nao: ela
--      continuaria por ler, e o pop-up continuaria na tela de quem ja mandou.
--      A frase da 0066 de novo.
--
-- A dispensa e, entao, uma linha propria -- e ela e do PEDIDO e nao do MES.
-- Cobrar de novo e um fato diferente desde a 0066 ("a cobranca do dia 10 e um
-- fato proprio"), entao a segunda cobranca precisa trazer o pop-up de volta
-- para quem dispensou a primeira e continua devendo. Keyada na competencia,
-- ela nao voltaria -- e cobrar de novo deixaria de fazer o que ele existe
-- para fazer.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- O SINO NAO GANHA TIPO NOVO, e a ausencia e a decisao.
--
-- O caminho obvio era um `nota_fiscal` em `notification_tipo`: hoje o aviso da
-- 0066 nasce `'sistema'`, que e o balde do que nao tem tipo proprio. Medido:
-- `sino-de-notificacoes.tsx` tem 193 linhas e NAO LE `tipo` em lugar nenhum --
-- nenhuma tela do produto le. O valor novo nao mudaria um pixel, e seria o que
-- alguem reaproveita tres sprints depois achando que ele decide alguma coisa,
-- que e a 0023.
--
-- E ele cobraria caro pelo nada: o enum so pode ser usado depois do commit da
-- transacao em que nasce (0028, 0109), entao mexer no tipo obrigaria a copiar
-- `solicitar_notas_do_mes` INTEIRA -- cento e quarenta linhas -- so para trocar
-- uma palavra dentro dela, com o risco da 0030 junto.
--
-- O REGISTRO NA CENTRAL, que e o que o usuario pediu, ja existe e nao e
-- tocado aqui: a 0066 grava a linha do sino com o titulo, o prazo por extenso
-- e o link para `/painel/notas-fiscais`. O que esta migration cria e a
-- DISPENSA do pop-up, que e outra coisa -- e e por ela ser outra coisa que o
-- sino continua marcado como nao lido depois de alguem fechar o aviso.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A dispensa, uma linha por pessoa por pedido
--
-- SEM POLICY DE UPDATE E SEM DELETE, e as duas ausencias sao a regra: nao
-- existe "quero o pop-up de volta", e reescrever a data de uma dispensa nao
-- responde pergunta de ninguem. A unica escrita e o `insert` da propria
-- pessoa, e o `with check` e o que impede dispensar no nome de outra.
--
-- `on delete cascade` NOS DOIS LADOS, ao contrario de
-- `approval_round_aprovadores` (0129): la a linha diz quem RECEBEU um envio
-- que aconteceu, e apagar a pessoa apagaria o registro. Aqui ela diz que
-- alguem fechou um aviso na tela -- nao e historico de nada, e quem sai da
-- agencia leva as dispensas dela.
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_request_dismissals (
  request_id    uuid        not null references public.invoice_requests (id) on delete cascade,
  user_id       uuid        not null references public.profiles (id) on delete cascade,
  dispensado_em timestamptz not null default now(),
  primary key (request_id, user_id)
);

comment on table public.invoice_request_dismissals is
  'Quem ja fechou o pop-up de qual pedido de nota (0143). E do PEDIDO e nao do mes: cobrar de novo traz o aviso de volta.';

alter table public.invoice_request_dismissals enable row level security;

drop policy if exists invoice_request_dismissals_select on public.invoice_request_dismissals;
create policy invoice_request_dismissals_select on public.invoice_request_dismissals
  for select to authenticated
  using (user_id = (select auth.uid()));

-- E `is_staff()` NAO E UMA SEGUNDA PERGUNTA EMBAIXO DE UMA PRIMEIRA QUE JA
-- BARRA TODO MUNDO, que e a recusa da 0060: `user_id = auth.uid()` barra quem
-- dispensa no nome de outra pessoa e **deixa o cliente passar**, porque ele
-- tambem e dono do proprio uuid. Medido na bateria: sem esta linha, Joana
-- insere uma dispensa para um pedido de nota que nunca foi dela -- inofensivo,
-- porque `meus_pedidos_de_nota()` e `is_staff()` e devolve zero para ela, e
-- uma tabela que aceita linha de quem nao tem nada a ver com ela e lixo que
-- entra pela chave anon.
--
-- E ela fica so no INSERT: o SELECT ja devolve zero para quem nao escreveu
-- nada, e ali a pergunta seria a redundante de verdade.
drop policy if exists invoice_request_dismissals_insert on public.invoice_request_dismissals;
create policy invoice_request_dismissals_insert on public.invoice_request_dismissals
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_staff());


-- ---------------------------------------------------------------------------
-- PASSO 2 - `meus_pedidos_de_nota()` passa a dizer QUAL pedido, e se ja foi
-- dispensado
--
-- `drop` ANTES do `create`, porque `create or replace` nao troca o tipo de
-- retorno de uma funcao `returns table` -- a pegadinha que a 0088 pagou. E o
-- `revoke`/`grant` vem inteiro atras, senao ela renasce com o `execute` que o
-- Postgres concede a `public` sozinho: a licao da 0097.
--
-- SAO DUAS COLUNAS NOVAS E UMA FUNCAO SO, e nao uma segunda leitura ao lado:
-- a faixa da tela de Notas Fiscais e o pop-up respondem a MESMA pergunta --
-- "este pedido ainda me cobra" --, e duas consultas divergiriam no dia em que
-- alguem mexesse numa. O que as separa e o que cada uma faz com `dispensado`:
-- a faixa IGNORA, porque ela e o registro permanente na tela onde a nota se
-- manda; o pop-up FILTRA, porque ele e o que a pessoa fechou.
--
-- `distinct on` NO LUGAR DO `group by`, e e o que permite devolver o id: a
-- resposta e a linha do pedido mais RECENTE de cada competencia, e um
-- `max(created_at)` agrupado devolve a data sem dizer de qual linha ela veio.
-- O `pedido_em` continua sendo a mesma data, pela mesma ordenacao.
-- ---------------------------------------------------------------------------
drop function if exists public.meus_pedidos_de_nota();

create function public.meus_pedidos_de_nota()
returns table (
  pedido_id   uuid,
  competencia date,
  pedido_em   date,
  dispensado  boolean
)
language plpgsql
stable
security definer
set search_path = public
as $func$
declare
  eu uuid := (select auth.uid());
begin
  -- Devolve VAZIO em vez de estourar, como desde a 0066: esta funcao alimenta
  -- um bloco de tela, e quem nao e da equipe nao chega nele -- um erro de
  -- servidor aqui derrubaria a pagina inteira por causa de um bloco.
  if not public.is_staff() then
    return;
  end if;

  return query
  select r.id,
         r.competencia,
         r.created_at::date,
         exists (
           select 1 from public.invoice_request_dismissals d
            where d.request_id = r.id
              and d.user_id = eu
         )
    from (
      select distinct on (ir.competencia) ir.id, ir.competencia, ir.created_at
        from public.invoice_requests ir
       order by ir.competencia desc, ir.created_at desc
    ) r
   where not exists (
     select 1 from public.team_invoices i
      where i.user_id = eu
        and i.competencia = r.competencia
        and i.status <> 'recusada'
   )
   order by r.competencia desc;
end;
$func$;

comment on function public.meus_pedidos_de_nota is
  'Os meses em que a equipe me cobrou a nota e eu ainda nao mandei, com o id do pedido mais recente, a data (que E o prazo) e se eu ja dispensei o aviso (0143).';

revoke all on function public.meus_pedidos_de_nota() from public;
revoke all on function public.meus_pedidos_de_nota() from anon;
grant execute on function public.meus_pedidos_de_nota() to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 3 - Conferencia
--
-- O MARCADOR DO `onde-esta-o-banco.sql` APONTA PARA O CORPO DA FUNCAO, que e a
-- ultima coisa que este arquivo cria -- e ele procura o NOME DA TABELA la
-- dentro, nunca a palavra `dispensado`: aquela mora no `returns table`, que e
-- `proargnames`, e `no_corpo` compara `prosrc`. A primeira versao da linha
-- dizia FALTA num banco com a migration inteira aplicada, e e a 0134 pela
-- segunda vez. Um marcador na TABELA diria `ok` sobre um banco onde a
-- funcao continua com a forma da 0066, e aquele e o estado em que o pop-up
-- nunca aparece: a tela pediria `dispensado` e receberia `undefined`.
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'public' and tablename = 'invoice_request_dismissals';
  if n <> 2 then
    raise exception '0143: invoice_request_dismissals deveria ter 2 policies, tem %.', n;
  end if;

  select count(*) into n
    from pg_proc p
    join lateral unnest(p.proargnames) nome on true
   where p.proname = 'meus_pedidos_de_nota'
     and p.pronamespace = 'public'::regnamespace
     and nome in ('pedido_id', 'dispensado');
  if n <> 2 then
    raise exception '0143: meus_pedidos_de_nota ainda esta na forma da 0066.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
