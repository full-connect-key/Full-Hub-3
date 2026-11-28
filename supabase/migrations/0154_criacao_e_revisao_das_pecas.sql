-- ---------------------------------------------------------------------------
-- 0154 — QUANDO A PECA ENTROU EM CRIACAO, E QUANDO ELA ENTROU EM REVISAO
--
-- Decisao do usuario, com tres imagens de referencia ao lado: *"na imagem tem
-- etapas, entao o feed deve aparecer pro cliente, apartir do momento, que o
-- conteudo comecar a ser feito"*. A escada do portal tem hoje o CICLO DE
-- DECISAO -- Recebido, Enviado para a sua decisao, o desfecho -- e a
-- referencia pede dois passos antes dele: *Em criacao* e *Em revisao*.
--
-- ESTE ARQUIVO AFIRMAVA, EM TRES LUGARES, QUE ISSO NAO EXISTE. A frase era
-- *"o horario de cada passo nao existe nem internamente"*, e ela esta no
-- CLAUDE.md duas vezes e no corpo de `andamentoDoMaterial()` -- que e o lugar
-- a que o componente delega por escrito (*"e la que mora a regra, porque a
-- pergunta e de dominio e nao de desenho"*). MEDIDO: ela e FALSA para a
-- corrente do social. `post_etapa_progresso` tem `concluido_em` e
-- `concluido_por` por (peca, fase) desde a 0088. E a 0127 e a 0129 pela
-- terceira vez -- *o custo de afirmar ali uma propriedade que nao foi
-- conferida e que ela passa a ser lida como verdade por quem vier depois*.
--
-- O CLIENTE NAO TEM POLICY NA CORRENTE, E NAO PASSA A TER. Medido:
-- `post_etapa_progresso` tem `_select = is_staff()` e nenhuma policy de
-- cliente; `subtasks_select_cliente` passa por `subtask_visivel_ao_cliente()`,
-- que exige uma rodada de escopo cliente NAQUELA subtarefa -- e as rodadas de
-- um mes moram nos POSTS, entao ela e estruturalmente falsa para toda fase.
-- Esta funcao e `security definer` devolvendo so o AGREGADO, na forma de
-- `pecas_programadas()` (0111), de `o_que_o_cliente_decide()` (0076) e de
-- `usuarios_do_meu_cliente()` (0031).
--
-- E A GUARDA E ESCRITA A MAO porque `security definer` nao passa pela RLS:
-- as duas condicoes abaixo sao `posts_select_cliente` (0032) copiada. Tirando
-- as duas, a funcao responde sobre a peca de qualquer empresa para quem tiver
-- o uuid.
--
-- ELA DEVOLVE DOIS INSTANTES E MAIS NADA -- nem o nome da fase, nem quem
-- fechou a caixinha, nem a observacao. O nome de uma fase e vocabulario
-- INTERNO do fluxo ("Pauta", "Conteudo", "Layout"), editavel por conta desde a
-- 0087; a referencia pede as duas palavras genericas que o cliente entende.
-- Mandar o nome seria entregar a corrente pela porta que existe para nao
-- entregar a corrente.
--
-- E A PERGUNTA E PELO PAPEL, NUNCA PELO NOME DA FASE (0087): com a corrente
-- editavel por conta, `s.titulo = 'Layout'` deixaria um fluxo renomeado em
-- branco para sempre, sem erro em lugar nenhum.
--
-- A AUSENCIA E A RESPOSTA, como em `pecas_programadas()`: a peca sem nenhum
-- dos dois instantes nao volta em linha nenhuma, em vez de voltar com dois
-- nulos dentro. Quem desenha a escada so empurra o passo quando ha carimbo --
-- `PassoDoAndamento` distingue de proposito *"aconteceu e o produto nao
-- guarda a hora"* de *"nao aconteceu"*.
--
-- ***O QUE ISTO NAO MUDA HOJE, e e dito em vez de escondido:*** medido contra
-- este banco, a corrente mensal tem ZERO linhas -- 3 posts, 0 fases
-- (`subtasks` com `social_papel`), 0 caixinhas, 0 meses abertos. Os tres posts
-- sao avulsos. Quer dizer que os dois passos novos nao aparecem em caso
-- nenhum ainda: eles passam a existir no dia em que alguem abrir um mes por
-- `abrir_mes_de_social`. A funcao esta aqui porque a tela que a le nasce
-- junto, e nao porque o numero de hoje a justifica.
-- ---------------------------------------------------------------------------

create or replace function public.criacao_e_revisao_das_pecas(p_ids uuid[])
returns table (post_id uuid, producao_em timestamptz, revisao_em timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return;
  end if;

  return query
    select p.id,
           c.quando as producao_em,
           r.quando as revisao_em
      from public.posts p
      -- EM CRIACAO e o PRIMEIRO carimbo de qualquer fase de producao: o
      -- instante em que o trabalho desta peca comecou a ficar pronto. `min` e
      -- nao `max` porque o passo diz quando ela ENTROU em criacao.
      left join lateral (
        select min(g.concluido_em) as quando
          from public.subtasks s
          join public.post_etapa_progresso g
            on g.post_id = p.id
           and g.subtask_id = s.id
         where s.task_id = p.social_task_id
           and s.social_papel = 'producao'
           and g.concluido
           and g.concluido_em is not null
      ) c on true
      -- EM REVISAO e a rodada INTERNA mais recente: `solicitado_em` e o
      -- instante em que a agencia pediu o aval dela. A mais recente, e nao a
      -- primeira, porque uma peca que voltou do cliente passa pela revisao de
      -- novo -- e a escada conta o ciclo CORRENTE.
      left join lateral (
        select max(a.solicitado_em) as quando
          from public.approval_rounds a
         where a.content_type = 'post'
           and a.content_id = p.id
           and a.escopo = 'interna'
      ) r on true
     where p.id = any(p_ids)
       and (c.quando is not null or r.quando is not null)
       and (
         public.is_staff()
         or (
           p.client_id in (select public.my_client_ids())
           and p.enviado_em is not null
         )
       );
end;
$func$;

comment on function public.criacao_e_revisao_das_pecas(uuid[]) is
  'Quando cada peca entrou em criacao (o primeiro carimbo de uma fase `producao`) e em revisao (a rodada interna mais recente). Definer devolvendo so os dois instantes: o cliente nao tem policy na corrente, e nao passa a ter. Pela PAPEL e nunca pelo nome da fase (0087).';

-- O SUPABASE CONCEDE `execute` A `public` EM TODA FUNCAO NOVA, e o PostgREST
-- publica o schema `public` sozinho -- a licao da 0071 e da 0097.
revoke all on function public.criacao_e_revisao_das_pecas(uuid[]) from public;
revoke all on function public.criacao_e_revisao_das_pecas(uuid[]) from anon;
grant execute on function public.criacao_e_revisao_das_pecas(uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONFERENCIA, para a segunda colagem:
--
--   select * from public.criacao_e_revisao_das_pecas(array[]::uuid[]);  -- zero
--   select has_function_privilege('anon',
--     'public.criacao_e_revisao_das_pecas(uuid[])', 'execute');         -- f
-- ---------------------------------------------------------------------------
