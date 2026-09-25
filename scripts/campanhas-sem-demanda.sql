-- ---------------------------------------------------------------------------
-- A DEMANDA DAS CAMPANHAS ABERTAS ANTES DA 0051
--
-- A 0051 fez a campanha nascer com a demanda: uma etapa por entregavel, grupo
-- virando etapa agrupadora, sub-item virando sub-etapa. As campanhas abertas
-- ANTES dela ficaram com `task_id` nulo e sem etapa nenhuma -- e a ausencia
-- nao aparece como erro: a campanha abre, a arvore aparece, e o que falta e
-- o botao "Abrir a demanda" e o trabalho no board da agencia.
--
-- ---------------------------------------------------------------------------
-- POR QUE ISTO E SCRIPT E NAO MIGRATION
--
-- Uma migration teria que INVENTAR a pasta de entrega. `tasks_exige_pasta_de_
-- entrega` (0015) recusa demanda nova sem ela, e e trigger justamente para
-- nao obrigar ninguem a preencher as antigas com um valor qualquer -- o
-- cabecalho da 0015 diz, com todas as letras, que inventar um endereco e pior
-- que nao ter: alguem vai clicar nele.
--
-- Entao a pasta vem de quem sabe qual e. O PASSO 1 lista as campanhas e JA
-- ESCREVE as linhas do PASSO 2 prontas para colar -- so falta o endereco.
--
-- E ele nao roda no deploy pelo mesmo motivo de toda migration deste projeto:
-- schema e dado nao se aplicam sozinhos junto com um push.
--
-- ---------------------------------------------------------------------------
-- O QUE ELE NAO FAZ
--
--   - nao mexe em campanha que JA tem demanda. `task_id is not null` fica de
--     fora do PASSO 1, e o PASSO 2 confere de novo antes de gravar: rodar
--     duas vezes nao cria duas demandas;
--   - nao inventa responsavel. O entregavel que tem `responsavel_id` passa o
--     dele para a etapa; o que nao tem nasce sem dono, que e visivel e
--     honesto -- etapa sem dono nao aparece no "Minhas Tasks" de ninguem, e o
--     Resumo da Agencia escreve "sem responsavel" ao lado dela;
--   - nao muda status de nada. A campanha finalizada continua finalizada, e
--     o trigger da 0051 recalcula sozinho na primeira escrita.
--
-- A DEMANDA NASCE COM O `criado_por` DA CAMPANHA, e nao com o de quem cola
-- isto no SQL Editor: a demanda e daquela campanha, e assinar com o nome de
-- quem rodou o script poria no historico uma autoria que nao aconteceu.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- PASSO 1 -- CONFERIR, e pegar as linhas prontas
--
-- Rode isto sozinho. Ele nao grava nada.
-- ===========================================================================

select
  c.nome                                             as campanha,
  cl.nome_empresa                                    as cliente,
  c.status,
  c.data_inicio,
  c.data_fim,
  count(d.id) filter (where d.parent_id is null)     as itens_de_topo,
  count(d.id) filter (where d.parent_id is not null) as sub_itens,
  -- A LINHA PRONTA PARA O PASSO 2. Copiar, colar la em cima e trocar so o
  -- endereco -- digitar uuid a mao, com trinta e seis caracteres, e como se
  -- erra um caractere e passa meia hora procurando.
  format('    (%L, %L),', c.id, 'https://drive.google.com/drive/folders/TROQUE-AQUI')
                                                     as cole_no_passo_2
  from public.campaigns c
  join public.clients cl on cl.id = c.client_id
  left join public.deliverables d on d.campaign_id = c.id
 where c.task_id is null
 group by c.id, c.nome, cl.nome_empresa, c.status, c.data_inicio, c.data_fim
 order by c.data_inicio;


-- ===========================================================================
-- PASSO 2 -- GRAVAR
--
-- Troque os enderecos na lista `pastas` e rode o bloco inteiro. Ele avisa, no
-- fim, uma linha por campanha -- e RECUSA a campanha cuja pasta ficou com o
-- "TROQUE-AQUI", em vez de gravar o texto de exemplo como se fosse endereco.
-- ===========================================================================

do $script$
declare
  -- ------------------------------------------------------------------ AQUI
  pastas constant jsonb := jsonb_build_object(
    -- '00000000-0000-0000-0000-000000000000', 'https://drive.google.com/...'
  );
  -- ------------------------------------------------------------------------

  campanha     record;
  peca         record;
  sub          record;
  a_task       uuid;
  a_etapa      uuid;
  -- UMA VARIAVEL PROPRIA PARA A FILHA. Reaproveitar `a_etapa` obrigava a
  -- reler a mae do banco a cada volta para o proximo `parent_id` estar
  -- certo -- uma consulta a mais e um jeito a mais de errar, para economizar
  -- uma linha de `declare`.
  a_sub_etapa  uuid;
  a_pasta      text;
  quantas      integer := 0;
  pulou        integer := 0;
begin
  for campanha in
    select c.id, c.nome, c.client_id, c.data_inicio, c.data_fim, c.descricao, c.criado_por
      from public.campaigns c
     -- A CONFERENCIA SE REPETE AQUI, e nao e desconfianca do PASSO 1: entre
     -- um e outro alguem pode ter aberto a demanda pela tela. Rodar duas
     -- vezes nao pode criar duas demandas para a mesma campanha.
     where c.task_id is null
       and pastas ? c.id::text
     order by c.data_inicio
  loop
    a_pasta := btrim(pastas->>campanha.id::text);

    if a_pasta is null or a_pasta = '' or a_pasta like '%TROQUE-AQUI%' then
      raise notice 'PULADA  %  -- a pasta de entrega ainda e o exemplo', campanha.nome;
      pulou := pulou + 1;
      continue;
    end if;

    -- A DEMANDA PRIMEIRO, como em `abrir_campanha()`: ela carrega as travas
    -- mais duras, e uma recusa aqui para tudo antes de a campanha ser tocada.
    insert into public.tasks (
      client_id, titulo, briefing_texto, data_inicio, data_fim,
      link_entrega, criado_por
    )
    values (
      campanha.client_id,
      campanha.nome,
      campanha.descricao,
      campanha.data_inicio,
      campanha.data_fim,
      a_pasta,
      campanha.criado_por
    )
    returning id into a_task;

    update public.campaigns set task_id = a_task where id = campanha.id;

    for peca in
      select d.id, d.nome, d.prazo, d.responsavel_id, d.ordem
        from public.deliverables d
       where d.campaign_id = campanha.id and d.parent_id is null
       order by d.ordem
    loop
      insert into public.subtasks (task_id, titulo, prazo, responsavel_id, ordem)
      values (a_task, peca.nome, peca.prazo, peca.responsavel_id, peca.ordem)
      returning id into a_etapa;

      update public.deliverables set subtask_id = a_etapa where id = peca.id;

      for sub in
        select d.id, d.nome, d.prazo, d.responsavel_id, d.ordem
          from public.deliverables d
         where d.parent_id = peca.id
         order by d.ordem
      loop
        -- A SUB-ETAPA FAZ DA MAE UMA AGRUPADORA, exatamente como na 0051: o
        -- relogio dela para, o status passa a ser calculado pelas filhas e a
        -- soma da demanda conta so as folhas. E o que o grupo de entregaveis
        -- ja era do lado da campanha.
        insert into public.subtasks (task_id, parent_id, titulo, prazo, responsavel_id, ordem)
        values (a_task, a_etapa, sub.nome, sub.prazo, sub.responsavel_id, sub.ordem)
        returning id into a_sub_etapa;

        update public.deliverables set subtask_id = a_sub_etapa where id = sub.id;
      end loop;
    end loop;

    quantas := quantas + 1;
    raise notice 'OK      %  -- demanda %', campanha.nome, a_task;
  end loop;

  raise notice '---';
  raise notice '% campanha(s) ganharam demanda, % pulada(s).', quantas, pulou;

  if quantas = 0 and pulou = 0 then
    raise notice 'Nenhuma campanha na lista `pastas` estava sem demanda.';
    raise notice 'Rode o PASSO 1 de novo: ou ja esta tudo ligado, ou os ids nao batem.';
  end if;
end
$script$;
