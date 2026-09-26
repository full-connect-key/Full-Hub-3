-- ---------------------------------------------------------------------------
-- 0060 - QUEM ENVIA AO CLIENTE A PROPRIA ENTREGA
--
-- Decisao do usuario, palavra por palavra: *"Nenhum colaborador envia ao
-- cliente a propria entrega, se a pessoa for Desenvolvedor, ou socio, ela
-- pode enviar."*
--
-- ---------------------------------------------------------------------------
-- E A REGRA JA ESTAVA INTEIRA NA LINHA DE CIMA. A trava que ele encontrou
-- fechava um furo que nao existe -- pela TERCEIRA vez neste produto.
--
-- Nos tres ramos de `validar_nova_rodada` o escopo `cliente` faz duas
-- perguntas, nesta ordem:
--
--   1. `if not public.is_gestor() then` ... 'Enviar para o cliente e do
--      Desenvolvedor.'
--   2. `if new.solicitado_por = dono then` ... 'Ninguem envia ao cliente a
--      propria entrega.'
--
-- A primeira ja recusa TODO colaborador -- sendo dono ou nao. Quer dizer que
-- a segunda so chega a rodar para quem e desenvolvedor ou socio, que sao
-- exatamente as duas pessoas que o usuario acaba de dizer que podem enviar.
-- Ela nunca mais tem a quem recusar: sai.
--
-- A regra pedida continua valendo por inteiro, e continua sendo de banco. O
-- que muda e que ela passa a ser dita uma vez so, pela pergunta que sempre
-- decidiu.
--
-- E A LICAO E A DA 0026, REPETIDA. Aquela migration ampliou uma trava de
-- autoaprovacao para tres perguntas e a 0029 a desfez inteira, com o motivo
-- escrito no cabecalho: *"a frase do usuario foi lida como relato de furo e
-- era descricao do que ele queria"*. Aqui aconteceu o mesmo com a outra
-- metade do par -- a 0007 decidiu que aprovar e enviar sao duas decisoes, o
-- usuario mudou uma na 0029 e mudou a outra agora.
--
-- O QUE NAO MUDA, e vale dizer porque e o que sobra de pe:
--
--   * enviar ao cliente continua sendo de `is_gestor()`. Colaborador nao
--     envia, produzido por ele ou por outra pessoa;
--   * o aval interno continua obrigatorio antes do envio;
--   * post sem data e video sem link continuam recusados (0044 e 0042);
--   * grupo de entregavel continua fora da aprovacao (0033).
--
-- E A TRAVA MORA NOS DOIS LADOS, como quase tudo aqui por desenho. Esta
-- migration e metade: a outra sao `podeEnviarAoCliente()` em
-- `lib/dominio/posts.ts` e os dois `if` que as actions fazem antes de chamar
-- o banco. **Foi exatamente isso que a 0029 aprendeu do jeito caro** -- a
-- bateria ficou verde com a action ainda recusando, e quem encontrou foi o
-- usuario clicando no botao. Por isso os dois lados sairam no mesmo commit, e
-- por isso `check:cores` passou a procurar a frase em `src/`.
--
-- REESCRITA A PARTIR DA VERSAO MAIS NOVA, que e a da 0044 -- nao da 0042, nem
-- da 0033. `create or replace function` nao avisa quando a nova tem menos
-- coisa que a velha, e foi assim que a 0030 perdeu o bloco de carimbos da
-- 0007 e nenhuma subtarefa teve `concluida_em` por duas migrations. O corpo
-- abaixo e o da 0044 com tres blocos a menos, e nada mais.
-- ---------------------------------------------------------------------------

create or replace function public.validar_nova_rodada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo  uuid := public.subtask_da_rodada(new.content_type, new.content_id);
  post  uuid := public.post_da_rodada(new.content_type, new.content_id);
  entr  uuid := public.entregavel_da_rodada(new.content_type, new.content_id);
  dono  uuid;
  exige boolean;
begin
  if alvo is null and post is null and entr is null then
    raise exception using
      errcode = 'check_violation',
      message = format('Rodada de aprovação de "%s" ainda não tem regra.', new.content_type),
      hint    = 'Os tipos com regra hoje são subtask, post e deliverable.';
  end if;

  -- ------------------------------------------------------------- entregavel
  if entr is not null then
    if not exists (select 1 from public.deliverables d where d.id = entr) then
      raise exception using
        errcode = 'check_violation',
        message = 'Entregável não encontrado.';
    end if;

    -- GRUPO NAO VAI PARA APROVACAO, e e a mesma regra da etapa agrupadora: o
    -- status dele e calculado pelos filhos, entao uma rodada dele prometeria
    -- uma decisao que o calculo desfaz no instante seguinte. Quem o cliente
    -- decide e o sub-item.
    if public.entregavel_eh_grupo(entr) then
      raise exception using
        errcode = 'check_violation',
        message = 'Este entregável agrupa outros: quem vai para aprovação são os itens de dentro.',
        hint    = 'O status do grupo é calculado pelos sub-itens.';
    end if;

    dono := (select d.responsavel_id from public.deliverables d where d.id = entr);

    if new.escopo = 'interna' then
      if new.solicitado_por is distinct from dono and not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Só quem produziu o entregável envia para aprovação.';
      end if;
    else
      if not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Enviar para o cliente é do Desenvolvedor.',
          hint    = 'Quem produz o material nunca o envia ao cliente.';
      end if;

      if not exists (
        select 1 from public.approval_rounds r
         where r.content_type = new.content_type
           and r.content_id = new.content_id
           and r.numero_rodada = new.numero_rodada
           and r.escopo = 'interna'
           and r.status = 'aprovada'
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Esta rodada ainda não passou pela aprovação interna.';
      end if;
    end if;

    return new;
  end if;

  -- ------------------------------------------------------------------- post
  if post is not null then
    -- QUEM PRODUZIU, e nao quem abriu (0042). Antes desta linha era
    -- `p.criado_por`, e com a corrente de maos isso passou a apontar para a
    -- gestao que escreveu o briefing -- virando as duas travas abaixo do
    -- avesso. Ver o cabecalho da 0042.
    dono := public.dono_do_post(post);

    if not exists (select 1 from public.posts p where p.id = post) then
      raise exception using
        errcode = 'check_violation',
        message = 'Post não encontrado.';
    end if;

    if new.escopo = 'interna' then
      if new.solicitado_por is distinct from dono and not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Só quem produziu o post envia para aprovação.';
      end if;
    else
      if not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Enviar para o cliente é do Desenvolvedor.',
          hint    = 'Quem produz o post nunca o envia ao cliente.';
      end if;

      -- POST SEM DATA NAO VAI AO CLIENTE (0044). Ela nasce nula desde esta
      -- migration -- o mes abre em branco e quem produz distribui --, e sem
      -- esta linha o cliente abriria o portal, veria a arte e a legenda, e
      -- decidiria sem saber quando aquilo vai ao ar. "Quando?" em branco ao
      -- lado de um botao de aprovar e a pior combinacao possivel.
      --
      -- Ela NAO contradiz a decisao de que a data e de quem produz (PASSO 2):
      -- nao diz quem manda na data, diz que ela existe antes de o material
      -- sair da agencia. E a mesma forma da trava de video sem link.
      if exists (
        select 1 from public.posts p
         where p.id = post and p.data_publicacao is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post ainda não tem data de publicação.',
          hint    = 'Escolha o dia antes de enviar: o cliente decide sobre o material e sobre quando ele vai ao ar.';
      end if;

      -- VIDEO SEM LINK NAO VAI (0042). O cliente abriria a tela para decidir
      -- sobre uma arte que nao existe -- e decidiria, porque o botao de
      -- aprovar estaria la. A recusa e aqui e nao na tela porque este e o
      -- unico ponto por onde o material sai da agencia.
      if exists (
        select 1 from public.posts p
         where p.id = post and p.midia = 'video'
           and nullif(trim(coalesce(p.video_url, '')), '') is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post é vídeo e ainda não tem o link.',
          hint    = 'Cole o endereço do Drive ou do YouTube antes de enviar.';
      end if;

      if not exists (
        select 1 from public.approval_rounds r
         where r.content_type = new.content_type
           and r.content_id = new.content_id
           and r.numero_rodada = new.numero_rodada
           and r.escopo = 'interna'
           and r.status = 'aprovada'
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Esta rodada ainda não passou pela aprovação interna.';
      end if;
    end if;

    return new;
  end if;

  -- ---------------------------------------------------------------- subtask
  dono  := (select s.responsavel_id   from public.subtasks s where s.id = alvo);
  exige := (select s.requer_aprovacao from public.subtasks s where s.id = alvo);

  if not coalesce(exige, false) then
    raise exception using
      errcode = 'check_violation',
      message = 'Essa subtarefa não exige aprovação.';
  end if;

  if new.escopo = 'interna' then
    if new.solicitado_por is distinct from dono and not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Só o responsável pela subtarefa envia para aprovação.';
    end if;
  else
    if not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Enviar para o cliente é do Desenvolvedor.',
        hint    = 'O responsável pela subtarefa nunca envia material ao cliente.';
    end if;

    if not exists (
      select 1 from public.approval_rounds r
       where r.content_type = new.content_type
         and r.content_id = new.content_id
         and r.numero_rodada = new.numero_rodada
         and r.escopo = 'interna'
         and r.status = 'aprovada'
    ) then
      raise exception using
        errcode = 'check_violation',
        message = 'Esta rodada ainda não passou pela aprovação interna.';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.validar_nova_rodada() is
  'Valida a rodada que nasce, nos tres tipos. Enviar ao cliente e de is_gestor(), e desde a 0060 a gestao envia inclusive o que produziu.';

-- O trigger continua o mesmo; recriado por garantia, porque a migration
-- precisa poder rodar mais de uma vez sem erro.
drop trigger if exists approval_rounds_valida_nova on public.approval_rounds;
create trigger approval_rounds_valida_nova
  before insert on public.approval_rounds
  for each row execute function public.validar_nova_rodada();
