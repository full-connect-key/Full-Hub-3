-- ---------------------------------------------------------------------------
-- 0141 - O INICIO RESPONDE SOBRE QUEM OLHA
--
-- Dois pedidos do usuario, os dois sobre a primeira tela, e os dois sao sobre
-- a MESMA coisa: um numero que nao decide nada para quem o le.
--
-- ---------------------------------------------------------------------------
-- 1. "CLIENTE PARADO" PASSA A SER DE ATENDIMENTO E SOCIO
--
-- Decisao do usuario: "restringir o bloco do Dashboard e a notificacao na
-- central aos perfis de Atendimento e Socio; os demais nao veem".
--
-- O DESENVOLVEDOR PERDE E O ATENDIMENTO GANHA, e nao e so uma troca de
-- predicado: `clientes_em_atencao` morava DEPOIS do `if not gestao then
-- return r`, entao ele alcancava dev e socio e nunca alcancou o colaborador
-- do Atendimento -- que e exatamente quem liga para a conta parada. O bloco
-- sobe de lugar e ganha o predicado dele.
--
-- `ve_clientes_parados()` E FUNCAO E NAO UM `if` INLINE, e a razao e a segunda
-- metade do pedido: "vale nos dois lugares". No dia em que a notificacao
-- existir, ela faz a MESMA pergunta -- e duas copias dela e onde as duas
-- verdades comecam a divergir, que e a licao da 0029 e da 0060.
--
-- E ELA NAO E `is_atendimento()`. Aquela e "Atendimento OU gestao" desde a
-- 0003, e gestao inclui o desenvolvedor -- que e precisamente quem este
-- pedido tira. O predicado e `funcao = 'Atendimento' or is_socio()`, e o
-- desenvolvedor que TAMBEM faz Atendimento continua vendo, porque quem decide
-- e a funcao na agencia e nao o perfil de acesso (0006).
--
-- ***E A NOTIFICACAO NAO EXISTE, o que e dito em vez de inventado:***
-- `notification_tipo` tem oito valores e nenhum deles e cliente parado --
-- nenhuma migration jamais criou esse aviso. Criar um e decisao propria e bem
-- maior que esta: ele e uma VARREDURA diaria (nao ha escrita que o dispare),
-- e varredura diaria neste produto depende do `pg_cron` da 0072 e de alguem
-- escolher a cadencia. O que esta migration faz e deixar o predicado pronto,
-- com nome, para o dia em que ela for escrita.
--
-- ---------------------------------------------------------------------------
-- 2. `etapas_abertas` SAI DO PULSO, porque ninguem mais o le
--
-- Decisao do usuario: "Etapas Abertas conta so as minhas e so as de hoje;
-- somente as previstas para o dia atual, sem etapas de outras pessoas nem de
-- datas futuras. O clique abre a relacao dessas etapas".
--
-- O NUMERO QUE ELE DESCREVE JA ERA CALCULADO E NINGUEM O DESENHAVA. Esta
-- funcao devolve `meu_dia.hoje` desde a 0049 com exatamente aquele recorte --
-- so as minhas, `prazo = hoje`, so folha, rascunho fora -- e a tela lia dali
-- apenas `semana`, para a frase do "e mais N". E a ponte construida e nunca
-- atravessada, e e por isso que a metade de TELA deste item nao tem SQL.
--
-- O que tem SQL e a outra ponta: com o cartao passando a mostrar o numero
-- pessoal, a contagem da agencia inteira ficou sem leitor. Ela sai, pela 0023
-- -- um `select count(*)` sobre `subtasks` com `subtask_eh_agrupadora` por
-- linha, pago em toda visita da gestao para alimentar uma chave que nenhuma
-- tela abre.
--
-- ***O que isso custa, e e dito em vez de escondido:*** a agencia perde o
-- numero de etapas abertas na primeira tela. Ele continua respondido pelo
-- board de Gestao de Tasks e pelo "o que ficou para tras" do Resumo da
-- Agencia, que e uma LISTA e nao um numero solto.
--
-- ---------------------------------------------------------------------------
-- A FUNCAO FOI COPIADA INTEIRA, e nao remendada: `create or replace` se
-- reescreve a partir do texto de agora e NAO AVISA quando o texto novo tem
-- menos coisa que o velho -- foi assim que a 0030 perdeu o bloco de carimbos
-- de `validar_transicao_de_subtarefa` e so apareceu na 0052. Os sete blocos
-- da 0049 estao abaixo, palavra por palavra, com as duas edicoes marcadas.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

-- ============================================================ PASSO 1 ======
-- Quem ve a conta parada.
--
-- `stable` e nao `immutable`: ela le `profiles` e `team_members`. E sem
-- `security definer`, como `is_atendimento()`: as duas tabelas sao legiveis
-- por quem pergunta -- `profiles` por `own` (0002) e `team_members` por
-- `is_staff()` (0002) -- e um definer aqui so acrescentaria uma porta.

create or replace function public.ve_clientes_parados()
returns boolean
language plpgsql
stable
set search_path = public
as $$
begin
  return public.is_socio() or exists (
    select 1
      from public.team_members tm
      join public.profiles p on p.id = tm.user_id
     where tm.user_id = (select auth.uid())
       and tm.funcao = 'Atendimento'
       and p.ativo
  );
end;
$$;

comment on function public.ve_clientes_parados is
  'Quem recebe a cobranca de conta parada: quem faz Atendimento, mais o socio. NAO e `is_atendimento()`, que inclui o desenvolvedor -- e ele e exatamente quem a 0141 tira. Decisao de TELA e nao trava: as etapas continuam legiveis por `is_staff()` no board.';

-- ============================================================ PASSO 2 ======
-- O resumo da tela inicial, com as duas edicoes.

create or replace function public.home_summary()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  eu         uuid := (select auth.uid());
  gestao     boolean := public.is_gestor();
  socio      boolean := public.is_socio();
  hoje       date := current_date;
  fim_semana date := current_date + 7;
  r          jsonb;
begin
  if eu is null then
    return '{}'::jsonb;
  end if;

  -- ------------------------------------------------------------- meu dia ---
  -- Os tres contadores de Minhas Tasks, pela MESMA regra: o prazo e o da
  -- etapa, nunca o periodo da Task. Dois lugares contando diferente e a
  -- pessoa clicando no numero e achando outra lista.
  select jsonb_build_object(
    'atrasadas', count(*) filter (where s.prazo < hoje),
    'hoje',      count(*) filter (where s.prazo = hoje),
    'semana',    count(*) filter (where s.prazo > hoje and s.prazo <= fim_semana)
  )
    into r
    from public.subtasks s
    join public.tasks t on t.id = s.task_id
   where s.responsavel_id = eu
     and s.status <> 'concluida'
     and t.publicada_em is not null
     and not public.subtask_eh_agrupadora(s.id);

  r := jsonb_build_object('meu_dia', coalesce(r, '{}'::jsonb));

  -- -------------------------------------------------------- precisa de mim --
  --
  -- TRES ITENS E NAO QUATRO. O sprint pede tambem "notas fiscais rejeitadas",
  -- e a tabela `invoices` nao existe: a 0013 registra no cabecalho que a
  -- agencia emitir NF ficou fora por decisao do usuario, e o modulo de Notas
  -- Fiscais e tela de espera ate hoje. O bloco entrega os tres que tem dado.
  r := r || jsonb_build_object('precisa_de_mim', jsonb_build_object(
    -- A fila de aprovacao interna e de quem DECIDE, e quem decide e
    -- `is_gestor()` desde a 0029. Para o colaborador este numero e zero, e nao
    -- e o `if` que o zera -- e a policy de `approval_rounds`.
    'aprovacoes', (
      select count(*) from public.approval_rounds ar
       where ar.escopo = 'interna' and ar.status = 'pendente' and gestao
    ),
    -- COMENTARIO DE CLIENTE SEM RESPOSTA: o ultimo comentario daquele material
    -- e dele. Se a agencia ja respondeu, o ultimo e da casa e o item sai da
    -- lista -- que e o que "sem resposta" quer dizer.
    'comentarios', (
      select count(*) from (
        select distinct on (c.content_type, c.content_id)
               c.content_type, c.content_id, p.role
          from public.comments c
          join public.profiles p on p.id = c.autor_id
         where c.interno = false
         order by c.content_type, c.content_id, c.created_at desc
      ) ultimo
       where ultimo.role = 'cliente' and gestao
    ),
    -- Pedidos de Full Days esperando decisao. So o socio responde (0011), e
    -- por isso o numero so e buscado para ele.
    'pedidos_rh', (
      select count(*) from public.hr_requests h
       where h.status = 'pendente' and h.origem = 'solicitacao' and socio
    )
  ));

  -- --------------------------------------------------------- fora hoje ------
  --
  -- QUEM ESTA FORA, e nao quem esta remoto: quem trabalha de outro lugar esta
  -- trabalhando. E a mesma distincao da regua de cobertura do Full Days, e a
  -- razao de as duas telas nao divergirem e nenhuma das duas repetir a lista
  -- de estados por conta propria.
  r := r || jsonb_build_object('fora_hoje', coalesce((
    select jsonb_agg(jsonb_build_object('nome', pr.nome, 'estado', tp.status)
                     order by pr.nome)
      from public.team_presence tp
      join public.profiles pr on pr.id = tp.user_id
     where tp.data = hoje
       and tp.status in ('ferias', 'licenca', 'ausente')
  ), '[]'::jsonb));

  -- ------------------------------------------- clientes que pedem atencao ---
  --
  -- PARADO HA MAIS DE 3 DIAS, e "parado" e a etapa em aberto cujo prazo ja
  -- passou desse tanto. O sprint fala em "itens parados": a etapa e o item que
  -- tem dono e data, e a Task nao tem nem um nem outro desde o Sprint 3B.
  -- QUEM VE ESTE BLOCO PASSOU A SER ATENDIMENTO OU SOCIO (0141), e nao mais
  -- `is_gestor()`. Decisao do usuario: "restringir o bloco do Dashboard aos
  -- perfis de Atendimento e Socio; os demais nao veem".
  --
  -- O DESENVOLVEDOR PERDE E O ATENDIMENTO GANHA, e e por isso que o bloco
  -- subiu de lugar: la embaixo ele estava depois do `if not gestao`, entao
  -- alcancava dev e socio e nunca o colaborador do Atendimento -- que e
  -- exatamente quem liga para o cliente parado.
  --
  -- E ISTO E DECISAO DE TELA, NAO TRAVA, e o cabecalho desta funcao ja diz por
  -- que: os `if` de perfil daqui existem "para nao GASTAR a consulta, nunca
  -- para esconder o resultado dela". O desenvolvedor continua podendo ler as
  -- mesmas etapas pelo board, como sempre pode -- `subtasks_select` e
  -- `is_staff()`. O que ele deixa de receber e a COBRANCA na primeira tela.
  if public.ve_clientes_parados() then
    r := r || jsonb_build_object('clientes_em_atencao', coalesce((
      select jsonb_agg(x order by x->>'cliente')
        from (
          select jsonb_build_object(
                   'cliente', cl.nome_empresa,
                   'cliente_id', cl.id,
                   'paradas', count(*),
                   'dias', max(hoje - s.prazo)
                 ) as x
            from public.subtasks s
            join public.tasks t on t.id = s.task_id
            join public.clients cl on cl.id = t.client_id
           where s.status <> 'concluida'
             and s.prazo < hoje - 3
             and t.publicada_em is not null
             and not public.subtask_eh_agrupadora(s.id)
           group by cl.id, cl.nome_empresa
        ) por_cliente
    ), '[]'::jsonb));
  end if;

  if not gestao then
    return r;
  end if;

  -- ------------------------------------------------------------- pulso ------
  r := r || jsonb_build_object('pulso', jsonb_build_object(
    'atrasadas', (
      select count(*) from public.subtasks s
        join public.tasks t on t.id = s.task_id
       where s.status <> 'concluida' and s.prazo < hoje
         and t.publicada_em is not null
         and not public.subtask_eh_agrupadora(s.id)
    ),
    -- CONCLUIDAS NA SEMANA sai do historico de status (0035), e nao de
    -- `updated_at`: aquele carimbo muda com qualquer save, entao corrigir o
    -- titulo de uma etapa concluida em janeiro a traria para a conta de hoje.
    'concluidas_semana', (
      select count(distinct h.subtask_id) from public.task_history h
       where h.acao = 'status_da_etapa' and h.para_valor = 'concluida'
         and h.created_at >= hoje - 7
    ),
    'posts_com_cliente', (
      select count(*) from public.posts p
       where p.enviado_em is not null and p.status = 'em_aprovacao'
    ),
    -- `'ativa'`, E NAO `'em_andamento'`: o enum e `planejamento / ativa /
    -- finalizada / cancelada` desde a 0033. Escrevi o outro valor na primeira
    -- versao e a bateria estourou -- mas o modo de falhar e que importa: fora
    -- de um cenario, a comparacao com um valor que o enum nao tem daria zero
    -- para sempre, e zero campanha ativa e um numero plausivel.
    'campanhas_ativas', (
      select count(*) from public.campaigns c where c.status = 'ativa'
    )
  ));


  return r;
end;
$$;

comment on function public.home_summary is
  'Os contadores da tela inicial numa chamada so. Sem parametro: o unico id que ela pode usar e o de quem esta logado. Sem `security definer`: quem decide o que cabe em cada resposta e o RLS. Desde a 0141 o pulso NAO devolve `etapas_abertas` (o cartao passou a mostrar as etapas de HOJE de quem olha, por `meu_dia.hoje`) e `clientes_em_atencao` e de `ve_clientes_parados()`.';

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONFERENCIA (cole depois e leia as tres linhas)
--
--   select public.ve_clientes_parados() as eu_vejo;
--
--   -- a chave morta saiu, e a pessoal continua la
--   select (public.home_summary() -> 'pulso') ? 'etapas_abertas' as deve_ser_falso,
--          (public.home_summary() -> 'meu_dia') ? 'hoje'         as deve_ser_verdadeiro;
-- ---------------------------------------------------------------------------
