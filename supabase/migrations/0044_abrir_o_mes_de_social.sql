-- ---------------------------------------------------------------------------
-- 0044 - ABRIR O MES DE SOCIAL DE UMA VEZ
--
-- Decisao do usuario: "como temos mais de 10 clientes na agencia, e todos eles
-- tem social, queria poder abrir o social de um mes, sem definir datas, e
-- deixar que a social media e o conteudo definam as demais informacoes".
--
-- A 0042 desenhou a corrente para UM post: a gestao abre com cliente, data,
-- rede e midia, e libera. Com dez clientes e doze posts cada, isso e cento e
-- vinte aberturas por mes -- e a gestao inventando cento e vinte datas que
-- quem produz vai refazer.
--
-- Sao TRES mudancas, e a primeira e a que destrava as outras duas.
--
-- ---------------------------------------------------------------------------
-- 1. `data_publicacao` PASSA A ACEITAR NULO
--
-- Era `not null` desde a 0032, quando todo post nascia com dia marcado. "Sem
-- data ainda" e um estado de verdade do trabalho -- o mes abre em branco e a
-- Social Media distribui --, e um estado de verdade que a coluna nao consegue
-- representar vira uma data inventada.
--
-- O QUE ISSO CUSTA NA TELA: post sem data nao cabe no calendario. Ele vai para
-- uma faixa "sem data ainda" ao lado da grade -- sem ela, os doze posts que
-- acabaram de nascer existiriam e ninguem os veria.
--
-- ---------------------------------------------------------------------------
-- 2. A DATA PASSA A SER DE QUEM PRODUZ
--
-- Decisao do usuario, e a 0042 tinha travado o contrario: o trigger
-- `posts_protege_colunas` recusava o colaborador mudar `data_publicacao`, com
-- a razao "ela foi combinada com o cliente". Aquela razao estava certa para o
-- fluxo de entao e esta errada para este -- agora e justamente a Social Media
-- quem decide quando cada post vai ao ar.
--
-- O QUE SE PERDE, E FOI DITO A QUEM DECIDIU: um post JA ENVIADO ao cliente
-- pode ter a data trocada por quem produziu, e o cliente passa a ver outra
-- data sem ninguem ter avisado. Ate esta migration isso era impossivel. A
-- alternativa oferecida -- "definir sim, trocar nao", livre enquanto vazia e
-- da gestao depois -- foi recusada em favor da regra simples.
--
-- Cliente e responsavel CONTINUAM travados: a decisao foi sobre a data.
--
-- ---------------------------------------------------------------------------
-- 3. POST SEM DATA NAO VAI AO CLIENTE
--
-- Esta e trava nova, e nao contradiz a decisao acima: ela nao diz QUEM manda
-- na data, diz que ela precisa existir antes de o material sair da agencia.
-- Sem ela o cliente abre o portal, ve a arte e a legenda, e nao ve quando
-- aquilo vai ao ar -- decidindo sobre metade da informacao. E a mesma forma da
-- trava de video sem link, da 0042.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A data pode faltar
-- ---------------------------------------------------------------------------

alter table public.posts alter column data_publicacao drop not null;

comment on column public.posts.data_publicacao is
  'Quando o post vai ao ar. NULA enquanto ninguem definiu (0044): o mes abre em branco e quem produz distribui. Post sem data nao vai ao cliente -- ver validar_nova_rodada.';

-- O indice do calendario passa a ser parcial: post sem data nunca entra numa
-- consulta por intervalo, e mante-lo no indice e ocupar espaco com linha que
-- nenhuma busca alcanca.
drop index if exists posts_data_idx;
create index if not exists posts_data_idx
  on public.posts (data_publicacao, client_id)
  where data_publicacao is not null;

-- E um indice para a faixa "sem data ainda", que e a outra metade da tela.
create index if not exists posts_sem_data_idx
  on public.posts (client_id, created_at)
  where data_publicacao is null;


-- ---------------------------------------------------------------------------
-- PASSO 2 - A data sai da lista do que o colaborador nao troca
--
-- A funcao e reescrita INTEIRA a partir da versao da 0042, que e a ultima.
-- ---------------------------------------------------------------------------

create or replace function public.proteger_colunas_do_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_gestor() then
    return new;
  end if;

  -- Sem sessao quem escreve e o seed.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.client_id is distinct from old.client_id then
    raise exception using
      errcode = 'check_violation',
      message = 'Trocar o cliente de um post é da gestão.',
      hint    = 'Peça a quem abriu o post, ou abra um novo para o outro cliente.';
  end if;

  if new.responsavel_id is distinct from old.responsavel_id then
    raise exception using
      errcode = 'check_violation',
      message = 'Passar o post para outra pessoa é da gestão.',
      hint    = 'Se não é para ser seu, avise quem liberou.';
  end if;

  -- `data_publicacao` SAIU DESTA LISTA na 0044, e e decisao do usuario. Ver o
  -- cabecalho: quem produz decide quando o post vai ao ar, inclusive depois de
  -- ele ja ter ido ao cliente. Cliente e responsavel continuam aqui.

  -- `enviado_em` nao se escreve a mao NUNCA, nem pela gestao: ele e
  -- consequencia da rodada de escopo cliente, pelo trigger
  -- `approval_rounds_marca_post` da 0032.
  if new.enviado_em is distinct from old.enviado_em then
    raise exception using
      errcode = 'check_violation',
      message = 'O envio ao cliente não se marca à mão.',
      hint    = 'Ele acontece quando a gestão usa a ação Enviar ao cliente.';
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 3 - Post sem data nao vai ao cliente
--
-- A funcao e reescrita INTEIRA e a partir da versao da 0042, QUE E A ULTIMA.
-- Ela ja foi reescrita cinco vezes (0007, 0030, 0032, 0033, 0042), e montar o
-- corpo a partir de uma versao antiga desfaz em silencio o que veio depois --
-- na 0042 foi o que aconteceu: parti da 0032, que nao conhece `deliverable`, e
-- o sintoma apareceu tres arquivos adiante. Quem mexer nela de novo, parta da
-- maior.
--
-- E a trava entra no ramo do POST, nao no do entregavel. A 0033 poe o
-- entregavel primeiro, e na 0042 o bloco de video foi para o ramo errado --
-- o cenario passou dizendo "passou quando devia ser recusado".
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

      if new.solicitado_por = dono then
        raise exception using
          errcode = 'check_violation',
          message = 'Ninguém envia ao cliente a própria entrega.',
          hint    = 'Quem aprovou internamente é quem envia.';
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

      if new.solicitado_por = dono then
        raise exception using
          errcode = 'check_violation',
          message = 'Ninguém envia ao cliente a própria entrega.',
          hint    = 'Quem aprovou internamente é quem envia.';
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

    if new.solicitado_por = dono then
      raise exception using
        errcode = 'check_violation',
        message = 'Ninguém envia ao cliente a própria entrega.',
        hint    = 'Quem aprovou internamente é quem envia.';
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

-- Sem `create trigger` aqui: `approval_rounds_valida_nova` existe desde a 0030
-- e passa a executar este corpo. Um segundo gatilho com o mesmo corpo nao
-- dobra a trava -- ele quebra quem sabe desliga-la, e foi o que custou uma
-- rodada da bateria na 0042.


-- ---------------------------------------------------------------------------
-- PASSO 4 - Abrir o mes
--
-- E FUNCAO E NAO UM LACO DE `insert` NA ACTION, pela mesma razao que
-- `decidir_solicitacao` do Full Days mora no banco: dezesseis posts sao
-- dezesseis linhas de uma vez, e se a decima falhar pelo PostgREST as nove
-- primeiras ficam la -- um mes aberto pela metade, que ninguem sabe se abriu.
-- Aqui ou nascem todos ou nao nasce nenhum.
--
-- AS QUANTIDADES VEM POR REDE, e e assim que um contrato de social e escrito:
-- "doze no Instagram, quatro no LinkedIn". O jsonb e `{"instagram": 12,
-- "linkedin": 4}`.
-- ---------------------------------------------------------------------------

create or replace function public.abrir_mes_de_social(
  p_client_id      uuid,
  p_mes            text,          -- 'AAAA-MM'
  p_quantidades    jsonb,         -- {"instagram": 12, "linkedin": 4}
  p_responsavel_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rede      text;
  quantos   integer;
  i         integer;
  criados   integer := 0;
  total     integer := 0;
  primeiro  date;
  empresa   text;
  -- O MES POR EXTENSO SAI DAQUI, e nao de `to_char(..., 'TMMonth')`. O `TM`
  -- le o `lc_time` DO SERVIDOR, que nao e a mesma coisa em dois ambientes: no
  -- Postgres da bateria ele e `C` e o tema saiu "November/2026", em portugues
  -- em todo o resto da tela. E o `toLocaleDateString` do SQL -- a regra que o
  -- projeto ja tem para o TypeScript, pela mesma razao. Doze nomes escritos
  -- sao doze nomes iguais em qualquer ambiente.
  meses     text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'check_violation',
      message = 'Abrir o mês de social é do desenvolvedor ou do sócio.',
      hint    = 'Quem produz recebe os posts; quem os abre é quem responde pelo contrato.';
  end if;

  begin
    primeiro := to_date(p_mes || '-01', 'YYYY-MM-DD');
  exception when others then
    raise exception using
      errcode = 'check_violation',
      message = 'O mês precisa estar no formato AAAA-MM.';
  end;

  select c.nome_empresa into empresa from public.clients c where c.id = p_client_id;
  if empresa is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Cliente não encontrado.';
  end if;

  -- O TETO EXISTE E RECUSA, em vez de cortar como o limite de subtarefa por
  -- task faz na recorrencia. La o excesso vinha de uma regra de calendario e
  -- cortar era melhor que deixar o mes sem nada; aqui o numero e DIGITADO, e
  -- um zero a mais e erro de digitacao. Cento e vinte posts criados em
  -- silencio sao cento e vinte para apagar a mao.
  for rede, quantos in select key, value::integer from jsonb_each_text(p_quantidades)
  loop
    if quantos < 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'Quantidade negativa não abre post nenhum.';
    end if;
    total := total + quantos;
  end loop;

  if total = 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Escolha quantos posts abrir.',
      hint    = 'Pelo menos uma rede precisa de um número maior que zero.';
  end if;

  if total > 60 then
    raise exception using
      errcode = 'check_violation',
      message = format('São %s posts de uma vez, e o limite é 60.', total),
      hint    = 'Se o número está certo, abra em duas vezes — assim um zero a mais não vira sessenta posts para apagar.';
  end if;

  for rede, quantos in select key, value::integer from jsonb_each_text(p_quantidades)
  loop
    for i in 1..quantos loop
      -- O TEMA NASCE COM O MES E O NUMERO, e nao vazio: `tema` e `not null`
      -- desde a 0032, e mais que isso -- uma lista de doze linhas em branco
      -- nao se distingue, e quem produz nao sabe qual ja mexeu. "Instagram 3
      -- de 12" e um nome provisorio que a pessoa troca pelo de verdade.
      insert into public.posts (
        client_id, tema, data_publicacao, plataforma, midia,
        criado_por, responsavel_id
      ) values (
        p_client_id,
        format('%s %s de %s · %s/%s', initcap(rede), i, quantos,
               meses[extract(month from primeiro)::integer],
               extract(year from primeiro)::integer),
        null,
        rede::public.plataforma_social,
        'imagem',
        (select auth.uid()),
        p_responsavel_id
      );
      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$$;

comment on function public.abrir_mes_de_social is
  'Abre N posts vazios de um cliente para um mes, sem data. Transacional: ou nascem todos ou nenhum. Teto de 60 por chamada -- um zero a mais e erro de digitacao.';

notify pgrst, 'reload schema';
