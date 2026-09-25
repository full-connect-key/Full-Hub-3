-- ---------------------------------------------------------------------------
-- 0049 - O RESUMO DA TELA INICIAL, NUMA CONSULTA SO
--
-- Sprint 15. A 0035 trouxe a camada de indicadores (carga, historico de
-- status, producao, desvio, qualidade, rentabilidade). Falta o que a tela
-- inicial pede, e o sprint escreve a exigencia em uma frase: "a tela Inicio
-- nao pode fazer dezenas de consultas: agregue o possivel numa funcao
-- `home_summary(user_id)`. Meta: primeiro conteudo em menos de 1 segundo."
--
-- ---------------------------------------------------------------------------
-- ELA NAO RECEBE O `user_id`, E A OMISSAO E DELIBERADA
--
-- O unico id que esta funcao pode usar e o de quem esta logado. Receber um
-- parametro criaria uma funcao que PROMETE responder sobre outra pessoa e nao
-- responde -- ou, pior, uma que responde: "o que e meu hoje" de outra pessoa e
-- a agenda dela, e ninguem pediu isso.
--
-- E ela NAO e `security definer`. Cada bloco le tabelas que a pessoa ja
-- alcanca pelo RLS, e e o RLS que decide o que cabe em cada resposta -- o
-- colaborador nao ve os pedidos de RH da equipe porque a policy nao deixa, e
-- nao porque um `if` aqui dentro escondeu. Os `if` de perfil que existem aqui
-- sao para nao GASTAR a consulta, nunca para esconder o resultado dela.
--
-- ---------------------------------------------------------------------------
-- O QUE VOLTA E `jsonb`, E NAO UMA TABELA DE COLUNAS
--
-- Sao sete blocos com formatos diferentes -- numeros, listas curtas, nomes. Em
-- colunas, viraria uma linha com trinta campos em que vinte sao nulos conforme
-- o perfil. Em `jsonb`, cada bloco e uma chave, e o bloco que nao e daquela
-- pessoa simplesmente nao esta la.
--
-- ---------------------------------------------------------------------------
-- RASCUNHO FICA FORA DE TUDO, e o filtro e `publicada_em is not null`.
--
-- O sprint diz `tasks.status = 'rascunho'`. Esse valor nao existe no enum, de
-- proposito (0028): rascunho e estado do ciclo de vida, nao do trabalho, e
-- `publicada_em` responde duas perguntas de uma vez. A 0035 ja usa este mesmo
-- filtro, e a frase fica repetida nas duas migrations porque quem ler uma so
-- vai procurar o valor de enum.
--
-- E SO FOLHA CONTA. Quem tem filha para de ser unidade de trabalho.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

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

  if not gestao then
    return r;
  end if;

  -- ------------------------------------------------------------- pulso ------
  r := r || jsonb_build_object('pulso', jsonb_build_object(
    'etapas_abertas', (
      select count(*) from public.subtasks s
        join public.tasks t on t.id = s.task_id
       where s.status <> 'concluida'
         and t.publicada_em is not null
         and not public.subtask_eh_agrupadora(s.id)
    ),
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

  -- ------------------------------------------- clientes que pedem atencao ---
  --
  -- PARADO HA MAIS DE 3 DIAS, e "parado" e a etapa em aberto cujo prazo ja
  -- passou desse tanto. O sprint fala em "itens parados": a etapa e o item que
  -- tem dono e data, e a Task nao tem nem um nem outro desde o Sprint 3B.
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

  return r;
end;
$$;

comment on function public.home_summary is
  'Os contadores da tela inicial numa chamada so. Sem parametro: o unico id que ela pode usar e o de quem esta logado. Sem `security definer`: quem decide o que cabe em cada resposta e o RLS.';

notify pgrst, 'reload schema';
