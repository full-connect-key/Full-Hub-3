-- ===========================================================================
-- 0008 - Tipos de tarefa e workflows iniciais
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole ESTE ARQUIVO INTEIRO > Run.
--   Pela CLI:  npx supabase db push
--
-- Pode ser executado mais de uma vez sem problema.
--
-- O QUE E ISTO
--   Workflow e o fluxo fixo de subtarefas de um tipo de trabalho. Todo "Post
--   de feed" nasce com as mesmas etapas; toda "Landing page" nasce com as
--   dela. O tipo de tarefa e o atalho que a pessoa escolhe ao abrir a demanda
--   -- ela nao precisa saber que existe um objeto chamado workflow.
--
--   Estes sete vem prontos, globais (client_id nulo), para a agencia ter de
--   onde partir. Sao pontos de partida: editar, duplicar para um cliente e
--   criar outros e o trabalho normal da tela /painel/workflows.
--
--   As etapas saem com FUNCAO padrao e nenhum responsavel fixo -- a agencia
--   preenche a pessoa na hora de aplicar, ou define o padrao depois. Modelo
--   que nasce amarrado a um nome envelhece na primeira troca de equipe.
-- ===========================================================================

do $$
declare
  modelo uuid;

begin
  -- ---------------------------------------------------------------------
  -- Um procedimento local nao existe em plpgsql, entao cada bloco abaixo
  -- repete as tres linhas: acha ou cria o template, limpa as etapas de
  -- fabrica, recria as etapas, e amarra o tipo de tarefa.
  -- ---------------------------------------------------------------------

  -- 1. Post de feed ------------------------------------------------------
  select id into modelo from public.workflow_templates
   where nome = 'Post de feed' and client_id is null;
  if modelo is null then
    insert into public.workflow_templates (nome, descricao)
    values ('Post de feed', 'Pauta, conteúdo, arte e agendamento de um post de feed.')
    returning id into modelo;
  end if;
  delete from public.workflow_steps where template_id = modelo;
  insert into public.workflow_steps
    (template_id, nome, ordem, funcao_padrao, prioridade, prazo_offset_dias, requer_aprovacao, tipo_aprovacao, depende_de_ordem) values
    (modelo, 'Pauta',       1, 'Social Media', 'normal', 1, true,  'interna', null),
    (modelo, 'Conteúdo',    2, 'Redator',      'normal', 3, false, null,      1),
    (modelo, 'Arte',        3, 'Design',       'normal', 5, true,  'cliente', 2),
    (modelo, 'Agendamento', 4, 'Social Media', 'normal', 7, false, null,      3);

  insert into public.task_types (nome, descricao, workflow_template_id)
  values ('Post de feed', 'Publicação única no feed.', modelo)
  on conflict do nothing;
  update public.task_types set workflow_template_id = modelo
   where nome = 'Post de feed' and client_id is null;

  -- 2. Story -------------------------------------------------------------
  select id into modelo from public.workflow_templates
   where nome = 'Story' and client_id is null;
  if modelo is null then
    insert into public.workflow_templates (nome, descricao)
    values ('Story', 'Sequência de stories: roteiro, arte e publicação.')
    returning id into modelo;
  end if;
  delete from public.workflow_steps where template_id = modelo;
  insert into public.workflow_steps
    (template_id, nome, ordem, funcao_padrao, prioridade, prazo_offset_dias, requer_aprovacao, tipo_aprovacao, depende_de_ordem) values
    (modelo, 'Roteiro',    1, 'Social Media', 'normal', 1, false, null,      null),
    (modelo, 'Arte',       2, 'Design',       'normal', 2, true,  'interna', 1),
    (modelo, 'Publicação', 3, 'Social Media', 'normal', 3, false, null,      2);

  insert into public.task_types (nome, descricao, workflow_template_id)
  values ('Story', 'Sequência de stories.', modelo) on conflict do nothing;
  update public.task_types set workflow_template_id = modelo
   where nome = 'Story' and client_id is null;

  -- 3. Reels -------------------------------------------------------------
  select id into modelo from public.workflow_templates
   where nome = 'Reels' and client_id is null;
  if modelo is null then
    insert into public.workflow_templates (nome, descricao)
    values ('Reels', 'Do roteiro à publicação de um vídeo curto.')
    returning id into modelo;
  end if;
  delete from public.workflow_steps where template_id = modelo;
  insert into public.workflow_steps
    (template_id, nome, ordem, funcao_padrao, prioridade, prazo_offset_dias, requer_aprovacao, tipo_aprovacao, depende_de_ordem) values
    (modelo, 'Roteiro',    1, 'Redator',      'normal',  2, true,  'interna', null),
    (modelo, 'Gravação',   2, 'Audiovisual',  'normal',  5, false, null,      1),
    (modelo, 'Edição',     3, 'Audiovisual',  'normal',  8, true,  'cliente', 2),
    (modelo, 'Legenda',    4, 'Redator',      'normal',  9, false, null,      3),
    (modelo, 'Publicação', 5, 'Social Media', 'normal', 10, false, null,      4);

  insert into public.task_types (nome, descricao, workflow_template_id)
  values ('Reels', 'Vídeo curto para redes sociais.', modelo) on conflict do nothing;
  update public.task_types set workflow_template_id = modelo
   where nome = 'Reels' and client_id is null;

  -- 4. Campanha ----------------------------------------------------------
  select id into modelo from public.workflow_templates
   where nome = 'Campanha' and client_id is null;
  if modelo is null then
    insert into public.workflow_templates (nome, descricao)
    values ('Campanha', 'Conceito, peça-chave, adaptações e veiculação.')
    returning id into modelo;
  end if;
  delete from public.workflow_steps where template_id = modelo;
  insert into public.workflow_steps
    (template_id, nome, ordem, funcao_padrao, prioridade, prazo_offset_dias, requer_aprovacao, tipo_aprovacao, depende_de_ordem) values
    (modelo, 'Briefing com o cliente', 1, 'Atendimento', 'alta',   2, false, null,      null),
    (modelo, 'Conceito',               2, 'Design',      'alta',   5, true,  'interna', 1),
    (modelo, 'Peça-chave',             3, 'Design',      'alta',  10, true,  'cliente', 2),
    (modelo, 'Adaptações',             4, 'Design',      'normal',15, false, null,      3),
    (modelo, 'Subida de mídia',        5, 'Trafego',     'normal',18, false, null,      4);

  insert into public.task_types (nome, descricao, workflow_template_id)
  values ('Campanha', 'Campanha completa, do conceito à veiculação.', modelo) on conflict do nothing;
  update public.task_types set workflow_template_id = modelo
   where nome = 'Campanha' and client_id is null;

  -- 5. Landing page ------------------------------------------------------
  select id into modelo from public.workflow_templates
   where nome = 'Landing page' and client_id is null;
  if modelo is null then
    insert into public.workflow_templates (nome, descricao)
    values ('Landing page', 'Texto, layout, desenvolvimento e publicação.')
    returning id into modelo;
  end if;
  delete from public.workflow_steps where template_id = modelo;
  insert into public.workflow_steps
    (template_id, nome, ordem, funcao_padrao, prioridade, prazo_offset_dias, requer_aprovacao, tipo_aprovacao, depende_de_ordem) values
    (modelo, 'Texto',            1, 'Redator',        'normal',  3, true,  'interna', null),
    (modelo, 'Layout',           2, 'Design',         'normal',  7, true,  'cliente', 1),
    (modelo, 'Desenvolvimento',  3, 'Desenvolvimento','normal', 14, true,  'interna', 2),
    (modelo, 'Publicação',       4, 'Desenvolvimento','normal', 16, false, null,      3);

  insert into public.task_types (nome, descricao, workflow_template_id)
  values ('Landing page', 'Página de destino de campanha.', modelo) on conflict do nothing;
  update public.task_types set workflow_template_id = modelo
   where nome = 'Landing page' and client_id is null;

  -- 6. Vídeo -------------------------------------------------------------
  select id into modelo from public.workflow_templates
   where nome = 'Vídeo' and client_id is null;
  if modelo is null then
    insert into public.workflow_templates (nome, descricao)
    values ('Vídeo', 'Vídeo institucional: roteiro, captação, edição e entrega.')
    returning id into modelo;
  end if;
  delete from public.workflow_steps where template_id = modelo;
  insert into public.workflow_steps
    (template_id, nome, ordem, funcao_padrao, prioridade, prazo_offset_dias, requer_aprovacao, tipo_aprovacao, depende_de_ordem) values
    (modelo, 'Roteiro',       1, 'Redator',     'normal',  3, true,  'cliente',  null),
    (modelo, 'Pré-produção',  2, 'Audiovisual', 'normal',  7, false, null,       1),
    (modelo, 'Captação',      3, 'Audiovisual', 'normal', 12, false, null,       2),
    (modelo, 'Edição',        4, 'Audiovisual', 'normal', 20, true,  'cliente',  3),
    (modelo, 'Entrega final', 5, 'Audiovisual', 'normal', 24, false, null,       4);

  insert into public.task_types (nome, descricao, workflow_template_id)
  values ('Vídeo', 'Vídeo institucional ou publicitário.', modelo) on conflict do nothing;
  update public.task_types set workflow_template_id = modelo
   where nome = 'Vídeo' and client_id is null;

  -- 7. Material impresso -------------------------------------------------
  select id into modelo from public.workflow_templates
   where nome = 'Material impresso' and client_id is null;
  if modelo is null then
    insert into public.workflow_templates (nome, descricao)
    values ('Material impresso', 'Do conteúdo ao arquivo fechado para a gráfica.')
    returning id into modelo;
  end if;
  delete from public.workflow_steps where template_id = modelo;
  insert into public.workflow_steps
    (template_id, nome, ordem, funcao_padrao, prioridade, prazo_offset_dias, requer_aprovacao, tipo_aprovacao, depende_de_ordem) values
    (modelo, 'Conteúdo',            1, 'Redator', 'normal',  3, false, null,      null),
    (modelo, 'Diagramação',         2, 'Design',  'normal',  7, true,  'cliente', 1),
    (modelo, 'Fechamento de arquivo',3,'Design',  'normal', 10, true,  'interna', 2),
    (modelo, 'Envio à gráfica',     4, 'Atendimento', 'normal', 11, false, null,  3);

  insert into public.task_types (nome, descricao, workflow_template_id)
  values ('Material impresso', 'Flyer, folder, cartaz ou catálogo.', modelo) on conflict do nothing;
  update public.task_types set workflow_template_id = modelo
   where nome = 'Material impresso' and client_id is null;
end
$$;


-- ---------------------------------------------------------------------------
-- Conferencia
-- ---------------------------------------------------------------------------
do $$
declare
  tipos integer;
  sem_fluxo text;
begin
  select count(*) into tipos from public.task_types where client_id is null;
  if tipos < 7 then
    raise exception 'Esperava 7 tipos globais, encontrei %.', tipos;
  end if;

  select string_agg(nome, ', ') into sem_fluxo
    from public.task_types
   where client_id is null and workflow_template_id is null;
  if sem_fluxo is not null then
    raise exception 'Tipo sem workflow: %', sem_fluxo;
  end if;
end
$$;

select
  'tudo pronto' as situacao,
  (select count(*) from public.task_types where client_id is null)     as tipos_globais,
  (select count(*) from public.workflow_templates where client_id is null) as workflows,
  (select count(*) from public.workflow_steps)                         as etapas;
