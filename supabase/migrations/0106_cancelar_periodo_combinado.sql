-- ===========================================================================
-- 0106 - CANCELAR UM PERIODO DE DESCANSO JA COMBINADO
--
-- Decisao do usuario: *"preciso da opcao de cancelar um periodo de descanso
-- depois que ja foi aprovado pelo socio"*.
--
-- ---------------------------------------------------------------------------
-- A 0011 ESCREVEU ESTE CAMINHO, e vale citar o comentario dela inteiro:
--
--   "So pendente, e so o dono -- cancelar ferias ja aprovadas e conversa com
--    o socio, nao um botao. QUANDO UM DIA ISSO FOR PERMITIDO, O CAMINHO SERA
--    ESTE MESMO, COM A LIMPEZA DE team_presence JUNTO."
--
-- E o dia. A funcao e a mesma, e a limpeza esta aqui.
--
-- **E `cancelada` NAO E VALOR NOVO:** ela esta em `hr_status` desde a 0011, e
-- so a de pedido PENDENTE a produzia. O que muda e quem chega ate ela.
--
-- ---------------------------------------------------------------------------
-- AS TRES PERGUNTAS, E O QUE CADA UMA RECUSA
--
--   1. QUEM: o DONO ou o SOCIO.
--
--      O dono porque devolver os proprios dias nao tira nada de ninguem --
--      ele libera a agenda, nunca a ocupa --, e porque travar isso faria a
--      pessoa pedir ao socio uma coisa que so ela sabe. O socio porque foi
--      ELE quem combinou: desfazer a decisao dele e dele. **E `is_socio()` e
--      nao `is_gestor()`**, que e a regra do modulo inteiro desde a 0011 --
--      o Day Off e o unico lugar em que o desenvolvedor nao e gestao.
--
--   2. O PERIODO NAO PODE TER COMECADO (`data_inicio >= current_date`).
--
--      Um periodo em curso tem dias VIVIDOS, e cancela-lo despintaria a
--      matriz sobre um passado que aconteceu -- a mesma razao pela qual
--      `carga_do_dia()` nao projeta no retrato historico do Feedback. Um que
--      comeca HOJE ainda e decisao de hoje, e por isso o corte e `>=` e nao
--      `>`.
--
--      **E E ESTA CONDICAO QUE TORNA A LIMPEZA SEGURA POR CONSTRUCAO:** com
--      o periodo inteiro no futuro, nenhuma linha de `team_presence` que sai
--      daqui e de um dia que ja passou. Sem ela, a limpeza precisaria de um
--      recorte por data -- e aí "cancelar" passaria a querer dizer duas
--      coisas diferentes conforme o dia.
--
--      *O que NAO e coberto, e fica dito em vez de escondido:* voltar antes
--      do fim de um descanso em curso. Isso e ENCURTAR o periodo, nao
--      cancela-lo, e e outra decisao -- com outra conta de saldo e outro
--      recorte de limpeza.
--
--   3. SO `pendente` E `aprovada`. Reprovada e cancelada ja estao encerradas,
--      e a recusa diz o que fazer no lugar: propor de novo.
--
-- ---------------------------------------------------------------------------
-- O MOTIVO E OBRIGATORIO QUANDO QUEM CANCELA NAO E O DONO
--
-- Desfazer o combinado de alguem sem dizer por que manda a pessoa adivinhar,
-- e ela vai descobrir pela matriz. E a regra de `team_invoices` ("recusar
-- exige motivo") e a de "pedir ajustes exige comentario": a recusa sem
-- motivo volta igual.
--
-- **Quando o DONO cancela o proprio, nao se exige nada:** ele nao precisa se
-- explicar para si mesmo, e um campo obrigatorio ali seria cerimonia que vira
-- habito -- a lição do nome digitado que saiu do produto na 0094.
--
-- ---------------------------------------------------------------------------
-- UMA COLUNA SO, E QUEM/QUANDO NAO VIRAM COLUNA
--
-- `hr_requests` esta na trilha de auditoria desde a 0058, com as quatro
-- operacoes: quem cancelou e quando ja ficam gravados la, e uma segunda copia
-- seria a segunda verdade sobre o mesmo fato. O que a trilha NAO resolve e a
-- pessoa LER o motivo na tela dela -- a trilha e so do socio.
--
-- E ele NAO reaproveita `motivo_reprovacao`: aquela coluna quer dizer "por
-- que o socio reprovou o pedido", e um mesmo campo com dois significados e
-- exatamente o que este produto recusa desde que `rejeitada` nasceu ao lado
-- de `ajustes_solicitados` (0032).
--
-- ---------------------------------------------------------------------------
-- A POLICY NAO PRECISA MUDAR, e e por isso que a funcao e `security definer`.
--
-- `hr_requests_update` e `user_id = auth.uid() and status = 'pendente'` desde
-- a 0011, nos dois lados. Abri-la para o aprovado daria ao dono o direito de
-- reescrever QUALQUER coluna de um pedido ja decidido -- as datas, os dias, o
-- tipo --, que e muito mais que cancelar. Quem decide aqui e a funcao, com as
-- tres perguntas acima escritas dentro dela.
--
-- O SALDO E A SOBREPOSICAO VOLTAM SOZINHOS, sem uma linha de mudanca:
-- `descanso_usado_no_ciclo()` (0085) conta `status in ('pendente','aprovada')`
-- e `validar_solicitacao` recusa sobreposicao com os mesmos dois. Cancelado
-- sai dos dois conjuntos, entao os dias voltam e o periodo volta a poder ser
-- pedido. E "atraso nao e coluna" pagando dividendo pela enesima vez.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O motivo
-- ---------------------------------------------------------------------------
alter table public.hr_requests
  add column if not exists motivo_cancelamento text;

comment on column public.hr_requests.motivo_cancelamento is
  'Por que o período combinado foi cancelado (0106). Obrigatório quando quem '
  'cancela não é o dono: desfazer o combinado de alguém sem dizer por quê '
  'manda a pessoa adivinhar. Quem cancelou e quando moram na trilha de '
  'auditoria (0058), que já cobre esta tabela.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - `cancelar_solicitacao`, com o periodo aprovado
--
-- `drop function` ANTES do `create`: a assinatura ganhou um parametro, e
-- `create or replace` com outra lista de argumentos cria uma SEGUNDA funcao
-- ao lado -- a pegadinha que a 0075 registrou em `carga_do_dia()`. Com as
-- duas de pe, a chamada de um argumento fica ambigua e o PostgREST resolve
-- por nome de argumento: a tela chamaria a velha, que recusa o aprovado, e o
-- diff diria que a mudanca funcionou.
-- ---------------------------------------------------------------------------
drop function if exists public.cancelar_solicitacao(uuid);

create or replace function public.cancelar_solicitacao(
  p_request_id uuid,
  p_motivo     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pedido public.hr_requests%rowtype;
  quem   uuid := (select auth.uid());
  dono   boolean;
  -- `v_motivo` E NAO `motivo`: `hr_requests` TEM uma coluna chamada `motivo`
  -- (a observacao de quem propoe, desde a 0011), e uma variavel com o mesmo
  -- nome deixa o `update` ambiguo -- o Postgres recusa com "column reference
  -- motivo is ambiguous". Foi a bateria que mostrou, e derrubou dezesseis
  -- cenarios de uma vez: os treze novos e os TRES da 0011, que passavam pela
  -- mesma funcao.
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  select * into pedido from public.hr_requests where id = p_request_id for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  dono := pedido.user_id = quem;

  -- 1. QUEM
  if not dono and not public.is_socio() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Este período não é seu, e só o sócio cancela o de outra pessoa.';
  end if;

  -- 3. SO PENDENTE E APROVADA (a ordem aqui e de leitura: o estado antes da
  --    data, porque um pedido ja encerrado nao tem data a conferir)
  if pedido.status not in ('pendente', 'aprovada') then
    raise exception using
      errcode = 'check_violation',
      message = 'Este período já está encerrado.',
      hint    = 'Para combinar os mesmos dias de novo, proponha um período novo.';
  end if;

  -- 2. O PERIODO NAO PODE TER COMECADO
  --
  -- So vale para o APROVADO: um pedido pendente nao pintou dia nenhum, entao
  -- nao ha passado a desfazer -- e recusar o cancelamento de um pendente que
  -- venceu deixaria a pessoa com um pedido preso na fila para sempre.
  if pedido.status = 'aprovada' and pedido.data_inicio < current_date then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Este período começou em %s, e um período em curso não se cancela.',
        to_char(pedido.data_inicio, 'DD/MM/YYYY')),
      hint    = 'Os dias que já passaram aconteceram. Fale com o sócio sobre os que faltam.';
  end if;

  -- O MOTIVO, de quem nao e o dono
  if not dono and v_motivo is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Diga por que o período está sendo cancelado.',
      hint    = 'Quem combinou aqueles dias precisa saber o que mudou.';
  end if;

  -- A LIMPEZA DE `team_presence`, que e a metade que a 0011 prometeu.
  --
  -- `proteger_presenca_de_pedido` e `before UPDATE` e nao morde o delete --
  -- ela existe para impedir que alguem REESCREVA na matriz um dia que veio de
  -- um pedido, e a saida que a mensagem dela aponta ("desfaça a solicitação")
  -- e exatamente esta funcao.
  --
  -- E ela apaga as linhas do pedido INTEIRO, sem recorte de data, porque a
  -- condicao 2 ja garantiu que nenhuma delas e de um dia que passou.
  delete from public.team_presence where hr_request_id = p_request_id;

  update public.hr_requests
     set status = 'cancelada',
         motivo_cancelamento = v_motivo
   where id = p_request_id;

  -- O SINO, e ele vai para o outro lado em cada caso.
  --
  -- `notificar()` nunca avisa quem causou o aviso (0011) e devolve null sem
  -- derrubar a escrita quando nao ha a quem avisar (0062), entao as duas
  -- chamadas sao seguras sem `if` nenhum em volta.
  if dono then
    -- O dono desfez: quem precisa saber e quem combinou. TODO socio ativo, que
    -- e a forma de `solicitar_notas_do_mes()` -- avisar so um deixaria a
    -- agenda desatualizada na cabeca do outro.
    perform public.notificar(
      p.id,
      'full_days'::public.notification_tipo,
      'Um período combinado foi cancelado',
      format('%s cancelou o período de %s a %s.',
             coalesce((select nome from public.profiles where id = pedido.user_id), 'Alguém'),
             to_char(pedido.data_inicio, 'DD/MM'),
             to_char(pedido.data_fim, 'DD/MM')),
      '/painel/full-days?aba=aprovacoes')
      from public.profiles p
     where p.role = 'socio' and p.ativo;
  else
    perform public.notificar(
      pedido.user_id,
      'full_days'::public.notification_tipo,
      'O seu período foi cancelado',
      format('O período de %s a %s foi cancelado: %s',
             to_char(pedido.data_inicio, 'DD/MM'),
             to_char(pedido.data_fim, 'DD/MM'),
             v_motivo),
      '/painel/full-days?aba=solicitar');
  end if;
end;
$$;

comment on function public.cancelar_solicitacao(uuid, text) is
  'Cancela um período do Day Off (0011, reescrita pela 0106). Pendente: só o '
  'dono. Combinado: o dono ou o sócio, e só enquanto ele não começou — um '
  'período em curso tem dias vividos. Quem não é o dono diz o motivo. Apaga '
  'os dias de team_presence junto, que é o que a 0011 deixou escrito como o '
  'caminho. O saldo volta sozinho: descanso_usado_no_ciclo() conta pendente e '
  'aprovada, e cancelada não é nenhum dos dois.';


-- ---------------------------------------------------------------------------
-- CONFERENCIA -- nao escreve nada
--
-- Esperado: 1 | 1 | 1
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'hr_requests'
      and column_name = 'motivo_cancelamento')                 as coluna_do_motivo,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cancelar_solicitacao'
      and pg_get_function_identity_arguments(p.oid) = 'uuid, text') as funcao_com_motivo,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cancelar_solicitacao'
      and p.prosrc like '%delete from public.team_presence%')  as limpa_a_matriz;
