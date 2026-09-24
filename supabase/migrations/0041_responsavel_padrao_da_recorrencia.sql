-- ---------------------------------------------------------------------------
-- 0041 - O RESPONSAVEL PADRAO DA REGRA RECORRENTE
--
-- Decisao do usuario: "adicione na recorrencia para ele gerar um responsavel
-- ja na hora de montar a recorrencia".
--
-- O QUE FALTAVA. O modelo ja guardava um responsavel POR ETAPA, e a tela ja
-- oferecia o campo. O buraco aparecia nos dois caminhos em que ninguem
-- preenche etapa por etapa:
--
--   1. a regra que parte de um WORKFLOW -- as etapas vem do fluxo, e o
--      `responsavel_padrao` de um passo de workflow pode ser nulo;
--   2. a regra montada as pressas, com tres etapas e nenhum nome.
--
-- Nos dois, a rotina da madrugada criava a demanda com as etapas orfas. Uma
-- task sem dono nao aparece no "Minhas Tasks" de ninguem: ela existe no board
-- da agencia e mais nada, e quem devia faze-la nao e avisado. E o pior tipo
-- de trabalho gerado automaticamente -- o que ninguem sabe que nasceu.
--
-- E FALLBACK, NAO SUBSTITUICAO. `coalesce(etapa, padrao)`: quem escreveu o
-- nome na etapa mandou, e o padrao so entra onde nao ha ninguem. O contrario
-- -- o padrao sobrescrevendo -- transformaria o campo numa arma: preencher a
-- regra apagaria a distribuicao que alguem montou etapa por etapa.
--
-- POR QUE NO BANCO E NAO SO NA TELA. A tela poderia copiar o padrao para cada
-- etapa no instante de salvar, e o resultado pareceria o mesmo. Mas ai o
-- modelo gravaria o nome repetido em cada etapa, e trocar de responsavel
-- depois exigiria reabrir a regra e mexer numa por uma -- quando o que a
-- pessoa quer dizer e "a partir de agora, e a Marina". O padrao mora num
-- lugar so, e e lido a cada geracao.
--
-- NAO E COLUNA NOVA: `task_recurrences.modelo` e jsonb, e o padrao e parte do
-- modelo da demanda como o titulo e a pasta. Uma coluna obrigaria migration a
-- cada campo novo de modelo, que e exatamente o que o jsonb evita aqui.
--
-- A PESSOA DESLIGADA NAO VIRA PADRAO, pela mesma razao que nao vira
-- responsavel de etapa -- e pela MESMA LINHA: o padrao entra no `responsavel`
-- e passa pelo `pessoa_desligada()` que ja estava la. A regra
-- sobrevive a saida de quem estava nela -- as demandas continuam nascendo, e
-- sem dono, que e visivel. Travar a geracao deixaria o cliente sem entrega
-- por causa de um desligamento.
--
-- DE QUEBRA, UMA TRAVA QUE FALTAVA. A imagem do prototipo mostrou "Gerar
-- agora" numa regra pausada, e `proximo_periodo_da_recorrencia()` nao olha
-- `ativo`: o botao teria gerado a demanda, ao lado da frase que diz que nada
-- mais e gerado. A recusa entra em `gerar_ocorrencia()` -- a rotina da
-- madrugada ja filtrava, o caminho manual nao.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

create or replace function public.gerar_ocorrencia(
  p_recurrence_id uuid,
  p_periodo       date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r            public.task_recurrences%rowtype;
  cliente      public.clients%rowtype;
  chave        text;
  run_id       uuid;
  nova_task    uuid;
  titulo       text;
  datas        date[];
  d            date;
  item         jsonb;
  modelo_sub   jsonb;
  nova_sub     uuid;
  ordem_i      integer := 0;
  quantas      integer := 0;
  responsavel  uuid;
  aviso        text;
  avisos       text[] := '{}';
  ids_por_ordem uuid[] := '{}';
  dep_ordem    integer;
  fim_periodo  date;
  pasta        text;
  padrao       uuid;
begin
  select * into r from public.task_recurrences where id = p_recurrence_id for update;
  if not found then
    raise exception 'Recorrencia nao encontrada.';
  end if;

  select * into cliente from public.clients where id = r.client_id;

  -- O RESPONSAVEL PADRAO DA REGRA. Ele nao substitui o da etapa -- so entra
  -- onde nao ha ninguem. Ver o cabecalho desta migration.
  --
  -- SEM `pessoa_desligada()` AQUI, e nao por esquecimento: os dois blocos
  -- abaixo ja conferem isso no responsavel RESOLVIDO, e o padrao passa por
  -- eles como qualquer outro. Eu tinha escrito a checagem nas duas pontas; o
  -- teste de mutacao mostrou que apagar esta nao quebrava cenario nenhum --
  -- era uma segunda verdade dizendo o que a primeira ja dizia.
  padrao := nullif(r.modelo->>'responsavel_padrao', '')::uuid;

  chave := case when r.modo = 'mensal_agrupada'
                then to_char(p_periodo, 'YYYY-MM')
                else to_char(p_periodo, 'YYYY-MM-DD') end;

  -- REGRA PAUSADA NAO GERA, NEM PELO BOTAO (0041).
  --
  -- A rotina da madrugada ja filtrava por `ativo`, mas `gerar_ocorrencia()`
  -- nao -- e "Gerar agora" a chama direto. O resultado era a tela dizendo
  -- "Nada mais e gerado ate voce retomar" e o botao ao lado gerando.
  --
  -- E AQUI, ANTES DO INSERT EM `recurrence_runs`, e a ordem e o ponto: gravar
  -- a execucao como 'pulada' consumiria a chave de idempotencia, e a
  -- ocorrencia sumiria para sempre -- ao retomar a regra, o periodo recusado
  -- apareceria como ja gerado. Pausar nao pode apagar o futuro.
  if not r.ativo then
    return null;
  end if;

  -- A TRAVA. `on conflict do nothing` sem linha de volta = outra execucao
  -- chegou primeiro, e esta desiste sem tocar em nada.
  insert into public.recurrence_runs (recurrence_id, chave_ocorrencia, status)
  values (r.id, chave, 'gerada')
  on conflict (recurrence_id, chave_ocorrencia) do nothing
  returning id into run_id;

  if run_id is null then
    return null;
  end if;

  -- As datas do periodo.
  if r.modo = 'mensal_agrupada' then
    fim_periodo := (date_trunc('month', p_periodo) + interval '1 month - 1 day')::date;
    select array_agg(x order by x) into datas
      from public.datas_da_recorrencia(r.id, date_trunc('month', p_periodo)::date, fim_periodo) x;
  else
    fim_periodo := p_periodo;
    datas := array[p_periodo];
  end if;

  if datas is null or cardinality(datas) = 0 then
    update public.recurrence_runs
       set status = 'pulada',
           detalhes = jsonb_build_object('motivo', 'Nenhuma data no periodo.')
     where id = run_id;
    return null;
  end if;

  -- O LIMITE CORTA, E NAO RECUSA: um mes com mais de 60 ocorrencias gera as 60
  -- primeiras e diz no historico que cortou. Recusar a ocorrencia inteira
  -- deixaria o mes sem nada, que e pior que um mes incompleto e anotado.
  if cardinality(datas) > public.limite_subtarefas_por_task() then
    avisos := avisos || format('O periodo tinha %s datas e o limite por task e %s: as demais nao foram criadas.',
                               cardinality(datas), public.limite_subtarefas_por_task());
    datas := datas[1:public.limite_subtarefas_por_task()];
  end if;

  titulo := public.resolver_variaveis(
    coalesce(r.modelo->>'titulo', r.nome),
    cliente.nome_empresa, coalesce(cliente.slug, ''), datas[1], 1);

  -- A PASTA DE ENTREGA E OBRIGATORIA desde a 0015, e o trigger recusa a task
  -- sem ela. Uma regra sem pasta no modelo faria toda geracao morrer com uma
  -- mensagem sobre `link_entrega` que ninguem ligaria a recorrencia -- entao a
  -- recusa acontece aqui, com o nome da regra dentro.
  pasta := nullif(trim(coalesce(r.modelo->>'pasta_entrega', '')), '');
  if pasta is null then
    update public.recurrence_runs
       set status = 'erro',
           detalhes = jsonb_build_object(
             'motivo', format('A regra "%s" nao tem pasta de entrega no modelo, e toda demanda precisa de uma.', r.nome))
     where id = run_id;
    return null;
  end if;

  insert into public.tasks (
    client_id, titulo, briefing_rico, prioridade, link_entrega,
    data_inicio, data_fim, criado_por, recurrence_id, task_type_id,
    publicada_em
  ) values (
    r.client_id, titulo,
    r.modelo->'briefing_rico',
    coalesce((r.modelo->>'prioridade')::public.task_prioridade, 'normal'),
    pasta,
    datas[1], datas[cardinality(datas)],
    r.criado_por, r.id, r.task_type_id,
    case when r.gerar_como_rascunho then null else now() end
  )
  returning id into nova_task;

  -- ---- as subtarefas ----

  if r.modo = 'mensal_agrupada' then
    modelo_sub := coalesce(r.modelo->'subtarefa_diaria', '{}'::jsonb);

    foreach d in array datas loop
      ordem_i := ordem_i + 1;
      responsavel := coalesce(nullif(modelo_sub->>'responsavel_id', '')::uuid, padrao);
      aviso := public.aviso_do_responsavel(responsavel, d);
      if aviso is not null then avisos := avisos || aviso; end if;
      if public.pessoa_desligada(responsavel) then responsavel := null; end if;

      insert into public.subtasks (
        task_id, titulo, responsavel_id, prazo, prioridade,
        estimativa_minutos, requer_aprovacao, tipo_aprovacao, ordem, aviso_geracao
      ) values (
        nova_task,
        public.resolver_variaveis(coalesce(modelo_sub->>'titulo', 'Entrega {DATA}'),
                                  cliente.nome_empresa, coalesce(cliente.slug, ''), d, ordem_i),
        responsavel, d,
        coalesce((modelo_sub->>'prioridade')::public.task_prioridade, 'normal'),
        nullif(modelo_sub->>'estimativa_minutos', '')::integer,
        coalesce((modelo_sub->>'requer_aprovacao')::boolean, false),
        nullif(modelo_sub->>'tipo_aprovacao', '')::public.tipo_aprovacao,
        ordem_i, aviso
      );
      quantas := quantas + 1;
    end loop;

  else
    for item in select * from jsonb_array_elements(coalesce(r.modelo->'subtarefas', '[]'::jsonb))
    loop
      exit when ordem_i >= public.limite_subtarefas_por_task();
      ordem_i := ordem_i + 1;
      d := p_periodo + coalesce((item->>'prazo_offset_dias')::integer, 0);
      responsavel := coalesce(nullif(item->>'responsavel_id', '')::uuid, padrao);
      aviso := public.aviso_do_responsavel(responsavel, d);
      if aviso is not null then avisos := avisos || aviso; end if;
      if public.pessoa_desligada(responsavel) then responsavel := null; end if;

      insert into public.subtasks (
        task_id, titulo, responsavel_id, prazo, prioridade,
        estimativa_minutos, requer_aprovacao, tipo_aprovacao, ordem, aviso_geracao
      ) values (
        nova_task,
        public.resolver_variaveis(coalesce(item->>'titulo', 'Etapa'),
                                  cliente.nome_empresa, coalesce(cliente.slug, ''), d, ordem_i),
        responsavel, d,
        coalesce((item->>'prioridade')::public.task_prioridade, 'normal'),
        nullif(item->>'estimativa_minutos', '')::integer,
        coalesce((item->>'requer_aprovacao')::boolean, false),
        nullif(item->>'tipo_aprovacao', '')::public.tipo_aprovacao,
        ordem_i, aviso
      )
      returning id into nova_sub;

      ids_por_ordem := ids_por_ordem || nova_sub;
      quantas := quantas + 1;
    end loop;

    -- AS DEPENDENCIAS SAO RECRIADAS DEPOIS, num segundo passe: `depende_de_ordem`
    -- pode apontar para uma etapa que ainda nao existia na hora de inserir a
    -- que depende dela. Num passe so, uma dependencia para tras funcionaria e
    -- uma para a frente sumiria -- calada.
    ordem_i := 0;
    for item in select * from jsonb_array_elements(coalesce(r.modelo->'subtarefas', '[]'::jsonb))
    loop
      ordem_i := ordem_i + 1;
      exit when ordem_i > cardinality(ids_por_ordem);
      dep_ordem := nullif(item->>'depende_de_ordem', '')::integer;
      if dep_ordem is not null
         and dep_ordem between 1 and cardinality(ids_por_ordem)
         and dep_ordem <> ordem_i
      then
        insert into public.subtask_dependencies (subtask_id, depende_de_id)
        values (ids_por_ordem[ordem_i], ids_por_ordem[dep_ordem])
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- ---- referencias ----
  for item in select * from jsonb_array_elements(coalesce(r.modelo->'referencias', '[]'::jsonb))
  loop
    continue when nullif(item->>'url', '') is null;
    insert into public.task_referencias (task_id, tipo, url, titulo, adicionado_por)
    values (nova_task, coalesce(item->>'tipo', 'link'), item->>'url',
            item->>'titulo', r.criado_por);
  end loop;

  -- ---- registro e aviso ----
  insert into public.task_history (task_id, acao, autor_id, detalhes)
  values (nova_task, 'gerada_por_recorrencia', r.criado_por,
          jsonb_build_object('recurrence_id', r.id, 'regra', r.nome,
                             'chave', chave, 'subtarefas', quantas));

  update public.recurrence_runs
     set task_id = nova_task,
         detalhes = jsonb_build_object('subtarefas', quantas, 'titulo', titulo,
                                       'avisos', to_jsonb(avisos))
   where id = run_id;

  -- RASCUNHO NAO NOTIFICA NINGUEM. Ele e invisivel para os outros -- avisar
  -- sobre uma task que a pessoa nao consegue abrir e o pior tipo de aviso.
  if not r.gerar_como_rascunho then
    -- UMA NOTIFICACAO POR PESSOA, com a contagem -- nunca uma por etapa. No
    -- modo mensal agrupada uma pessoa costuma ficar com as vinte e duas
    -- etapas do mes: vinte e dois avisos identicos transformariam o sino em
    -- ruido, que e justamente o que a 0028 evitou ao nao notificar rascunho.
    perform public.notificar(
      x.responsavel_id, 'task',
      format('Nova demanda recorrente: %s', titulo),
      format('Regra "%s": %s etapa(s) para voce.', r.nome, x.quantas),
      format('/painel/gestao-tasks/%s', nova_task))
    from (
      select s.responsavel_id, count(*) as quantas
        from public.subtasks s
       where s.task_id = nova_task and s.responsavel_id is not null
       group by s.responsavel_id
    ) x;
  end if;

  -- O AVISO VAI PARA O ATENDIMENTO, e nao para quem estiver de recesso: quem
  -- decide o que fazer com uma etapa sem dono e uma pessoa, e a pessoa e a
  -- que distribui trabalho. "Nao reatribua sozinho" e o pedido em voz alta.
  if cardinality(avisos) > 0 then
    perform public.notificar(
      p.id, 'task',
      format('Recorrente "%s" gerada com aviso', r.nome),
      array_to_string(avisos, ' '),
      format('/painel/gestao-tasks/%s', nova_task))
    from public.profiles p
    where p.ativo
      and (p.role in ('desenvolvedor', 'socio')
           or exists (select 1 from public.team_members t
                       where t.user_id = p.id and t.funcao = 'Atendimento' and t.ativo));
  end if;

  update public.task_recurrences
     set ultima_geracao_em = now(), updated_at = now()
   where id = r.id;

  perform public.recalcular_proxima_geracao(r.id);

  return nova_task;
end;
$$;
comment on function public.gerar_ocorrencia(uuid, date) is
  'Cria a ocorrencia de um periodo. Idempotente pelo indice unico de recurrence_runs. Desde a 0041, `modelo->>responsavel_padrao` preenche a etapa que nao tem dono -- fallback, nunca substituicao.';

notify pgrst, 'reload schema';
