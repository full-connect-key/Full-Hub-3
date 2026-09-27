-- ===========================================================================
-- 0066 - SOLICITAR AS NOTAS FISCAIS DO MES
--
-- Decisao do usuario: um botao no Financeiro que manda o pedido para toda a
-- equipe interna de uma vez, em vez de o socio escrever a mesma mensagem para
-- oito pessoas em oito conversas.
--
-- ---------------------------------------------------------------------------
-- O PEDIDO NAO VAI PARA QUEM JA MANDOU, e essa e a decisao que faz o botao
-- poder ser apertado de novo.
--
-- No dia 5 o socio pede a todos; no dia 10 faltam tres. Sem esta linha, a
-- segunda cobranca chega tambem para quem ja enviou -- e um aviso que cobra o
-- que a pessoa ja fez e o aviso que ela aprende a ignorar. Com ela, "cobrar de
-- novo" e uma acao segura, e a tela pode dizer quantos faltam antes do clique.
--
-- "JA MANDOU" E TER NOTA VIVA DO MES: enviada, aprovada ou paga. A recusada
-- NAO conta, e e de proposito -- quem teve a nota recusada precisa mandar
-- outra, entao ela e exatamente quem a cobranca procura.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- O PRAZO E O MESMO DIA DO PEDIDO (decisao do usuario), E ELE NAO E COLUNA.
--
-- O prazo de um pedido e a data em que ele saiu -- `created_at::date`, e mais
-- nada. Guardar um `prazo date` ao lado criaria duas verdades sobre o mesmo
-- fato, e elas divergiriam na primeira correcao de fuso: e a mesma razao pela
-- qual atraso no Financeiro nao e coluna e bloqueio de subtarefa nao e status.
--
-- **E ELE AVISA, NUNCA RECUSA.** A tentacao e travar o `insert` de
-- `team_invoices` depois do dia do pedido, e ela se desfaz numa frase: uma
-- nota recusada por atraso e uma nota que a agencia NAO recebe -- o oposto do
-- que pedir a nota existe para conseguir. Quem perdeu o dia manda no dia
-- seguinte, e o atraso fica visivel nos dois lados: na tela da pessoa, que le
-- a data do pedido, e na fila do socio, que conta quantos passaram do dia.
-- E a mesma decisao de "funcao sem dono avisa, nunca recusa" (0064) e do
-- limite por task da recorrencia, que corta em vez de recusar.
--
-- **E COBRAR DE NOVO MOVE O PRAZO, e isso e dito em voz alta.** O prazo que
-- vale e o do pedido MAIS RECENTE, porque foi ele que chegou a pessoa: cobrar
-- no dia 10 e dizer "hoje" de novo, e continuar medindo pelo dia 5 marcaria de
-- atrasado quem esta dentro do prazo que acabou de receber. O custo: a
-- contagem de atrasados do socio CAI quando ele cobra de novo. Os pedidos
-- anteriores ficam todos no banco, com data, e e neles que mora o historico.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - O registro do pedido
--
-- SEM ELE O BOTAO NAO TEM MEMORIA, e duas coisas somem: a tela nao tem como
-- dizer "voce ja pediu em 03/10", e o socio nao tem como saber se pediu. Um
-- botao que nao deixa rastro do que disparou para oito pessoas e um botao que
-- se aperta duas vezes por duvida.
--
-- MAIS DE UM PEDIDO POR MES E O DESENHO, e nao um furo: a cobranca do dia 10 e
-- um fato diferente do pedido do dia 5, com outro destinatario e outra
-- contagem. Um `unique (competencia)` transformaria a segunda cobranca em
-- reescrita da primeira -- a mesma razao pela qual rodada de aprovacao fechada
-- nunca e reescrita.
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_requests (
  id            uuid primary key default gen_random_uuid(),
  competencia   date not null,
  solicitado_por uuid not null references public.profiles (id) on delete cascade,
  -- Quantas pessoas o pedido alcancou. Guardado no INSTANTE do envio e nao
  -- recalculado depois: daqui a uma semana a resposta seria outra, porque
  -- gente mandou nota nesse meio-tempo -- e o registro diz o que aconteceu, e
  -- nao o que acontece agora. E a mesma razao do `workflow_snapshot`.
  quantas_pessoas integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists invoice_requests_competencia_idx
  on public.invoice_requests (competencia desc, created_at desc);

comment on table public.invoice_requests is
  'Cada vez que o socio pediu as notas fiscais de um mes (0066). Mais de uma linha por mes e o desenho: a cobranca de reforco e um fato proprio.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A competencia no dia 1, como em toda data de mes do produto
-- ---------------------------------------------------------------------------
create or replace function public.pedido_competencia_no_dia_1()
returns trigger
language plpgsql
set search_path = public
as $func$
begin
  new.competencia := date_trunc('month', new.competencia)::date;
  return new;
end;
$func$;

drop trigger if exists invoice_requests_competencia on public.invoice_requests;
create trigger invoice_requests_competencia
  before insert or update on public.invoice_requests
  for each row execute function public.pedido_competencia_no_dia_1();


-- ---------------------------------------------------------------------------
-- PASSO 3 - RLS
--
-- SO O SOCIO, nos dois comandos. Saber quantas notas a agencia esta esperando
-- e quando a cobranca saiu e informacao da mesma familia da fila de notas: ela
-- diz de quantas pessoas a agencia deve dinheiro este mes.
--
-- Sem UPDATE e sem DELETE: o pedido e o registro de uma coisa que aconteceu, e
-- oito pessoas receberam o aviso. Apagar a linha nao desfaz os avisos -- e a
-- mesma forma de `client_portal_views` e do `audit_log`.
-- ---------------------------------------------------------------------------
alter table public.invoice_requests enable row level security;

drop policy if exists invoice_requests_select on public.invoice_requests;
create policy invoice_requests_select on public.invoice_requests
  for select to authenticated
  using (public.is_socio());

drop policy if exists invoice_requests_insert on public.invoice_requests;
create policy invoice_requests_insert on public.invoice_requests
  for insert to authenticated
  with check (public.is_socio() and solicitado_por = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- PASSO 4 - Quem ainda nao mandou a nota do mes
--
-- Uma funcao separada porque a TELA precisa da mesma resposta ANTES do clique:
-- o dialogo diz quantas pessoas vao receber, e o botao nao pode prometer um
-- numero que a funcao de envio calcula de outro jeito. E a mesma decisao de
-- `podeEnviarAoCliente()` no Social, que existe para escrever a frase que o
-- banco vai confirmar.
-- ---------------------------------------------------------------------------
create or replace function public.quem_deve_nota(p_competencia date)
returns table (user_id uuid, nome text)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  if not public.is_socio() then
    raise exception 'Pedir as notas fiscais do mes e do socio.';
  end if;

  return query
  select p.id, p.nome
    from public.profiles p
   where p.role <> 'cliente'
     and p.ativo
     -- QUEM PEDE NAO SE COBRA. `notificar()` ja descartaria o aviso, mas sem
     -- esta linha a CONTAGEM da tela incluiria o socio -- e ele leria "8
     -- pessoas" num pedido que alcanca 7.
     and p.id <> (select auth.uid())
     and not exists (
       select 1 from public.team_invoices i
        where i.user_id = p.id
          and i.competencia = date_trunc('month', p_competencia)::date
          and i.status <> 'recusada'
     )
   order by p.nome;
end;
$func$;

comment on function public.quem_deve_nota is
  'Quem da equipe ainda nao tem nota viva no mes (0066). `security definer` porque le team_invoices de todo mundo; a primeira linha exige o socio.';


-- ---------------------------------------------------------------------------
-- PASSO 5 - O pedido
--
-- TRANSACIONAL, e por isso mora no banco: o registro e os N avisos sao uma
-- coisa so. Pelo PostgREST seriam N+1 transacoes, e a terceira falhando
-- deixaria metade da equipe cobrada e o registro dizendo que todos foram.
-- E a mesma razao de `decidir_solicitacao()` no Full Days.
-- ---------------------------------------------------------------------------
create or replace function public.solicitar_notas_do_mes(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_mes     date := date_trunc('month', p_competencia)::date;
  v_pessoa  record;
  v_quantas integer := 0;
  v_texto   text;
begin
  if not public.is_socio() then
    raise exception 'Pedir as notas fiscais do mes e do socio.';
  end if;

  -- NAO SE PEDE NOTA DE MES QUE NAO ACABOU DE COMECAR... nem do futuro. Um
  -- pedido da nota de dezembro em outubro chega como engano, e a pessoa
  -- responde perguntando em vez de mandar.
  if v_mes > date_trunc('month', current_date)::date then
    raise exception 'Nao da para pedir a nota de um mes que ainda nao comecou.'
      using hint = 'Escolha o mes de servico que ja passou ou o mes corrente.';
  end if;

  v_texto := to_char(v_mes, 'MM/YYYY');

  -- O CORPO LEVA A DATA, E NAO A PALAVRA "HOJE".
  --
  -- O aviso do sino e escrito uma vez e lido quando a pessoa abrir -- as vezes
  -- tres dias depois. "Envie hoje" gravado no dia 5 e uma frase que passa a
  -- mentir sozinha no dia 6, e ela mente exatamente para quem esta atrasado,
  -- que e quem mais precisa ler a verdade. Com a data escrita, o aviso
  -- continua certo em qualquer dia -- a mesma razao pela qual o "agora" do
  -- feed de Recomendacoes desce do servidor em vez de o navegador ler o
  -- relogio.
  for v_pessoa in select * from public.quem_deve_nota(v_mes) loop
    perform public.notificar(
      v_pessoa.user_id,
      'sistema',
      'Envie a sua nota fiscal de ' || v_texto,
      'O prazo é o mesmo dia do pedido: ' || to_char(current_date, 'DD/MM/YYYY')
        || '. Anexe a sua em Notas Fiscais.',
      '/painel/notas-fiscais'
    );
    v_quantas := v_quantas + 1;
  end loop;

  -- O REGISTRO NASCE MESMO COM ZERO PESSOAS, e e informacao: "pedi no dia 10 e
  -- nao faltava ninguem" e uma resposta. Nao gravar faria a tela dizer que o
  -- ultimo pedido foi o do dia 5, que e falso.
  insert into public.invoice_requests (competencia, solicitado_por, quantas_pessoas)
  values (v_mes, (select auth.uid()), v_quantas);

  return v_quantas;
end;
$func$;

comment on function public.solicitar_notas_do_mes is
  'Avisa quem ainda nao mandou a nota do mes e grava o pedido (0066). Transacional: o registro e os avisos sao uma coisa so. Devolve quantas pessoas foram alcancadas.';


-- ---------------------------------------------------------------------------
-- PASSO 6 - O pedido que ME cobra
--
-- SEM ESTA FUNCAO O PRAZO NAO EXISTE DO LADO DE QUEM DEVE A NOTA, e o aviso do
-- sino seria a unica pista -- um aviso que a pessoa marca como lido e nunca
-- mais encontra. A tela de Notas Fiscais precisa poder dizer, em qualquer
-- visita: "o Financeiro pediu a de dezembro em 05/10, e o prazo era o mesmo
-- dia".
--
-- E `security definer` PORQUE A POLICY DE `invoice_requests` E DO SOCIO, e
-- continua sendo. Abrir o SELECT para `is_staff()` resolveria a leitura e
-- entregaria de lambuja o `quantas_pessoas` de cada pedido -- quantos colegas
-- estao devendo, numa tela pessoal onde isso nao decide nada. A funcao devolve
-- o recorte que e da pessoa: os meses em que ela foi cobrada e ainda nao
-- mandou, com a data do ultimo pedido. E a mesma forma de
-- `usuarios_do_meu_cliente()`, que e definer para devolver so o agregado.
--
-- O SKEW DE FUSO FALHA PARA O LADO GENEROSO, e e de proposito registrar:
-- `created_at::date` le a data no fuso da sessao, entao um pedido disparado a
-- noite pode ser lido como do dia seguinte. O erro possivel e dar um dia a
-- mais a quem foi cobrado -- nunca marcar de atrasado quem esta em dia.
-- ---------------------------------------------------------------------------
create or replace function public.meus_pedidos_de_nota()
returns table (competencia date, pedido_em date)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  -- Devolve VAZIO em vez de estourar, ao contrario de `quem_deve_nota`: aquela
  -- responde a um clique, e um clique recusado precisa dizer por que. Esta
  -- alimenta um bloco de tela, e quem nao e da equipe nao chega nele -- um
  -- erro de servidor aqui derrubaria a pagina inteira por causa de um bloco.
  if not public.is_staff() then
    return;
  end if;

  return query
  select r.competencia, max(r.created_at)::date as pedido_em
    from public.invoice_requests r
   where not exists (
     select 1 from public.team_invoices i
      where i.user_id = (select auth.uid())
        and i.competencia = r.competencia
        and i.status <> 'recusada'
   )
   group by r.competencia
   order by r.competencia desc;
end;
$func$;

comment on function public.meus_pedidos_de_nota is
  'Os meses em que a equipe me cobrou a nota e eu ainda nao mandei, com a data do ultimo pedido -- que e o prazo (0066). Definer porque a policy de invoice_requests e do socio.';


-- ---------------------------------------------------------------------------
-- PASSO 7 - A trilha de auditoria (0058)
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if exists (
    select 1 from pg_proc p
     where p.proname = 'registrar_auditoria'
       and p.pronamespace = 'public'::regnamespace
  ) then
    drop trigger if exists auditoria_invoice_requests on public.invoice_requests;
    create trigger auditoria_invoice_requests
      after insert or update or delete on public.invoice_requests
      for each row execute function public.registrar_auditoria();
  end if;
end;
$bloco$;

notify pgrst, 'reload schema';
