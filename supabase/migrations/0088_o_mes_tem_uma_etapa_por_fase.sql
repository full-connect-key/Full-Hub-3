-- ===========================================================================
-- A PRODUCAO VIRA MENSAL, E A APROVACAO CONTINUA POR POST
--
-- Decisao do usuario, em duas frases. A primeira e o Sprint 3J, que ele mandou
-- com o cabecalho dizendo o que ele desfaz:
--
--   "Esta versao substitui a anterior do mesmo arquivo. O modelo mudou: a
--    subtarefa passa a ser a etapa do mes, nao o post."
--
-- A segunda e a resposta dele a pergunta que faltava, e e ela que decide o
-- desenho inteiro desta migration:
--
--   "A producao vira mensal, a aprovacao continua por post."
--
-- O MES DE SOCIAL ERA UMA DEMANDA COM DOZE SUBTAREFAS -- uma por post (0061),
-- cada uma com uma corrente de cinco etapas dentro dela (0045). Sao sessenta
-- linhas de trabalho para um mes de doze posts, e a conta que elas descrevem
-- nao e a que acontece: O REDATOR ESCREVE AS DOZE LEGENDAS DE UMA VEZ, num
-- dia, e nao uma legenda por demanda. A frase do usuario na 0084 ja dizia isso
-- -- *"a Social Media vai ter um dia para fazer a pauta do mes todo"* -- e a
-- 0084 a atendeu dando a MESMA data as doze correntes, que e a conta dobrada
-- descrita com outras palavras: doze etapas "Pauta" vencendo no mesmo dia, no
-- nome da mesma pessoa.
--
-- A frase dela ficou registrada no fim daquele cabecalho, como a pergunta
-- seguinte natural:
--
--   "com doze posts, a Pauta existe doze vezes no mesmo dia, e em Minhas
--    Tasks a social media ve doze linhas 'Pauta' vencendo juntas. A frase dele
--    descreve UM trabalho, nao doze. Colapsar a corrente para uma por MES em
--    vez de uma por post e mudanca de modelo bem maior que a data, e nao foi
--    pedida; fica registrada aqui porque e a pergunta seguinte natural."
--
-- Foi pedida. E esta migration.
--
--
-- O QUE VIRA O QUE
-- ----------------
--
--   antes                                   depois
--   -----                                   ------
--   uma subtarefa por POST                  uma subtarefa por ETAPA do mes
--   `post_etapas` (post x etapa)            `post_etapa_progresso` (post x etapa)
--   a corrente e a ordem de `post_etapas`   a corrente e `subtask_dependencies`
--   o portao sai da etapa do post           o portao sai da etapa do MES + das
--                                           rodadas aprovadas DAQUELE post
--
-- A conta: um mes de doze posts com cinco etapas tinha 12 subtarefas e 60
-- linhas de `post_etapas`. Passa a ter 5 subtarefas e 60 linhas de progresso
-- -- e as 5 sao trabalho de gente, com dono, prazo e estimativa, enquanto as
-- 60 sao caixinhas de conferencia.
--
--
-- E O QUE ISSO DESTRAVA DE GRACA, que e a razao de o sprint existir
-- ----------------------------------------------------------------
--
-- A corrente do social nunca entrou na CARGA. `disponibilidade_bruta()` (0081)
-- le `subtasks` direto -- nunca `post_etapas` --, entao o dia em que a
-- redatora escreve doze legendas aparecia VAZIO na Linha do Tempo e na faixa
-- de disponibilidade: o produto media o trabalho de demanda e de campanha e
-- era cego para o do social, que e metade do que a agencia faz.
--
-- Nao havia o que consertar naquelas funcoes: a etapa de post nao era
-- subtarefa, e ensina-las a somar uma segunda tabela daria duas contas para a
-- mesma pessoa no mesmo dia -- o que o comentario da 0035 existe para impedir.
-- Com a etapa virando subtarefa, as tres telas que leem carga passam a
-- enxerga-la sem uma linha de mudanca em nenhuma delas.
--
-- E a frase do usuario que fechou o 3J diz onde a corrente vive:
--
--   "a corrente do social vive so em minhas tasks e na carga"
--
-- Entao a SEXTA ORIGEM do Calendario Full sai (`etapa_de_post`, 0059). Ela e a
-- decisao da 0077 aplicada ao que faltava: a demanda e a etapa sairam da view
-- *"porque elas vivem em Minhas Tasks"*, e a etapa de post e uma etapa. Ela
-- sai da VIEW e nao so da lista de camadas, pela razao da 0077: uma camada e
-- um interruptor, e tirar o interruptor deixando a origem produzindo esconde
-- as linhas desta tela e as entrega de graca ao proximo consumidor da view.
--
--
-- QUATRO DIVERGENCIAS, e as quatro sao decisoes
-- --------------------------------------------
--
-- 1. *"Etapa que exige aprovacao mostra Enviar para aprovacao, nunca
--    Concluir -- a regra do sprint-3b vale aqui como em qualquer subtarefa."*
--
--    NAO VALE, e a frase do usuario e a razao: a aprovacao continua por POST.
--    `subtasks_bloqueia_conclusao_sem_aprovacao` (0007) exige uma rodada
--    aprovada DAQUELA subtarefa, e a etapa "Pauta" de um mes de doze posts tem
--    doze rodadas -- uma por post, em `approval_rounds` com
--    `content_type = 'post'`. Marcar a etapa `requer_aprovacao` a deixaria
--    inconcluivel para sempre, porque a rodada que a trava procura nao existe
--    e nao vai existir.
--
--    Entao a etapa do mes e subtarefa COMUM, e o portao do cliente continua
--    sendo por post -- derivado, como era na 0076. O que a etapa carrega e o
--    PAPEL dela na corrente, em tres colunas novas de `subtasks`.
--
-- 2. *"No Calendario Full, o mes gera cinco pontos (as etapas), nao dezoito."*
--
--    Gera ZERO, e e a 0077: o usuario tirou a etapa do calendario depois de o
--    3J ser escrito. Os cinco pontos existem -- em Minhas Tasks, que e onde ele
--    os quis, e na Linha do Tempo como PESO e nao como barra, que e a decisao
--    da 0077 palavra por palavra ("sai a BARRA da etapa e fica o PESO dela").
--
-- 3. *"a exclusao fica registrada em activity_log"*
--
--    Aquela tabela nao existe, e tres cabecalhos de migration ja registram
--    isso (0035, 0037, 0040). Quem registra e `audit_log` (0058), e o
--    apagamento de demanda, etapa e post ja esta nela.
--
-- 4. A QUARTA NAO E DO SPRINT, E DESFAZ UMA REGRA DA 0046 -- e esta nao e
--    escolha de desenho, e consequencia do modelo.
--
--    *"nao vao poder abrir um novo social, ou definir responsaveis. So quem
--    faz isso e desenvolvedor"* era decisao do usuario, e `post_etapas` tinha
--    policy propria para servi-la: `is_gestor()` no insert, e
--    `is_gestor() or responsavel_id` no update. A etapa do mes e uma
--    SUBTAREFA, e `subtasks_update` e `is_gestor() or is_atendimento() or
--    responsavel_id` desde a 0007.
--
--    Entao O ATENDIMENTO PASSA A DISTRIBUIR A ETAPA DO SOCIAL, do mesmo jeito
--    que ja distribui a etapa de qualquer demanda e a peca de qualquer
--    campanha (0051). Manter a regra estreita custaria um gatilho em
--    `subtasks` so para o social -- reintroduzindo a divergencia que o 3J
--    desfaz: a etapa do social com uma permissao que nenhuma outra tem.
--
--    O QUE CONTINUA ESTREITO SAO AS TRES COLUNAS DO PASSO 2, e ai o gatilho
--    existe (`subtasks_protege_o_social`): dizer que a etapa E a entrega ao
--    cliente nao e distribuir trabalho, e sem ele o dono da etapa faria dela o
--    portao do post.
--
--
-- E A ETAPA DE AJUSTES DEIXA DE EXISTIR, que e a simplificacao maior
-- -----------------------------------------------------------------
--
-- A 0045 criava uma etapa "Ajustes" dentro da corrente do post quando o
-- cliente pedia alteracao, e a 0076 a fazia nascer logo depois do portao
-- recusado, com o dono resolvido por posicao. Nada disso sobrevive, e nao
-- precisa: com a etapa sendo mensal, criar uma "Ajustes" por pedido afirmaria
-- que o MES inteiro voltou por causa de um post.
--
-- O que acontece no lugar e o que o pedido significa: A CAIXINHA DAQUELE POST
-- DESMARCA. "12 de 18" volta a "11 de 18", a etapa volta para `em_andamento`,
-- e o pedido do cliente fica em `post_etapa_progresso.observacao` -- a coluna
-- que o proprio sprint pediu, e que e o lugar certo porque o pedido e sobre
-- UM post dentro de um trabalho que e do mes.
--
-- Com isso saem tambem as duas pecas que existiam so para servi-la: o `rotulo`
-- numerado ("Ajustes da Pauta 2") e a busca do ultimo elo de producao antes da
-- entrega -- esta ultima SOBREVIVE, porque e ela que decide de quem o post
-- volta quando o cliente recusa a ARTE: nao e de quem enviou, e de quem a fez.
--
--
-- AS DUAS TRAVAS DA CAIXINHA, e elas sao a corrente um nivel abaixo
-- ----------------------------------------------------------------
--
-- A corrente mensal e `subtask_dependencies`: o Layout nao COMECA antes de o
-- Conteudo fechar, e quem recusa e `validar_transicao_de_subtarefa` desde a
-- 0007. Mas isso e sobre a etapa, e a pergunta do dia a dia e sobre o post:
-- posso marcar o Layout DESTE post?
--
--   A. TODA ETAPA ANTERIOR DO MES PRECISA ESTAR MARCADA PARA ESTE POST.
--      E a regra da 0045 -- *"o redator escrevendo antes de a pauta existir
--      escreve sobre o que achou"* -- por post em vez de por etapa.
--
--   B. TODO PORTAO ANTERIOR PRECISA TER A APROVACAO DO CLIENTE PARA ESTE POST.
--      E a conta: `rodadas aprovadas do post >= numero de portoes antes desta
--      etapa`. Ela e uniforme e cobre o caso que o usuario descreveu --
--      *"algumas contas validam pauta e conteudo, antes de ir para Producao de
--      Layout"* -- e cobre tambem "ninguem programa o que o cliente nao
--      aprovou", que era a trava da etapa Programar na 0045: antes do Programar
--      ha dois portoes (a Pauta e o Envio), entao ele precisa de duas
--      aprovacoes.
--
-- A trava A sozinha nao basta, e vale escrito: a caixinha do portao marca que
-- a PESSOA escreveu a pauta, nao que o cliente a aprovou. Sem a B, quem
-- escreveu as doze pautas marcaria as doze e o redator seguiria sobre pauta
-- nenhuma ter sido validada -- que e exatamente o fluxo que a conta dele
-- contratou para nao acontecer.
--
-- E A CAIXINHA DA ENTREGA NAO SE MARCA A MAO, nem pela gestao. E a regra da
-- 0045 um nivel abaixo, letra por letra: a etapa Envio era consequencia da
-- rodada de escopo cliente, e a caixinha dela passa a ser consequencia da
-- APROVACAO do cliente daquele post. Marcar a mao afirmaria que o post foi e
-- voltou aprovado sem nada ter saido da agencia.
--
--
-- `posts.subtask_id` E APAGADA, e com ela quatro funcoes
-- -----------------------------------------------------
--
-- Ela nasceu na 0032 como a ponte generica post -> subtarefa, e desde a 0061 o
-- que ela guarda e a linha do post no board. Sem essa linha nao ha o que
-- guardar, e o que o produto precisa saber e outra coisa: de que MES este post
-- e. E `posts.social_task_id`, uma coluna, apontando para a demanda.
--
-- Apagar e nao aposentar, que e a decisao da 0023: coluna parada e coluna que
-- alguem reaproveita errado tres sprints depois achando que ainda significa
-- alguma coisa. Saem com ela `subtarefa_de_post()`,
-- `recalcular_status_da_subtarefa_do_post()`, o espelho de titulo e de
-- apagamento de `posts_mirror`, e o ramo do cronometro que a citava.
--
-- E `post_etapas` SAI INTEIRA -- tabela, policies, os dois gatilhos e
-- `montar_etapas_do_post()`. O sprint pedia isso num passo separado; fazer em
-- dois deixaria o banco com DUAS correntes ao mesmo tempo, uma viva e uma
-- morta, com gatilhos ativos disparando a cada escrita em `posts`. Dois
-- modelos do mesmo trabalho e o que esta migration existe para desfazer.
--
--
-- A CONVERSAO, e o que ela sabe e nao sabe
-- ----------------------------------------
--
-- Para cada mes de social ja aberto:
--   1. cria as etapas do mes a partir do FLUXO daquele mes (`tasks.social_flow_id`,
--      0087), com responsavel e periodo tirados das correntes antigas -- a moda
--      de cada etapa, que e o que a 0084 gravava igual em todos os posts;
--   2. cria `post_etapa_progresso` para cada post x etapa, marcando o que a
--      corrente antiga dizia concluido;
--   3. apaga as subtarefas antigas de post, preservando os posts;
--   4. escreve `posts.social_task_id`;
--   5. deixa `recalcular_periodo_da_task()` e `recalcular_status_task()` refazerem
--      o periodo e o status da demanda, que e o que o sprint chama de "recalcule".
--
-- O QUE ELA NAO SABE, e fica dito em vez de escondido: a corrente antiga podia
-- ter responsaveis DIFERENTES por post na mesma etapa -- nada nunca impediu
-- isso, e `abrir_mes_de_social` so os deixava iguais porque escrevia o mesmo
-- `p_responsaveis` em todos. Onde divergirem, a etapa do mes fica com a MODA e
-- a divergencia e anotada em `subtasks.aviso_geracao`, que e a coluna que a
-- 0040 criou para exatamente este tipo de recado. Perder o aviso seria perder
-- a unica pista de que alguem precisa olhar aquele mes.
--
-- E a etapa "Ajustes" das correntes antigas NAO viaja: ela nao tem par no
-- modelo novo, e o pedido que a criou esta na rodada, que fica. O que se perde
-- e a linha de trabalho dela; o que fica e o motivo.
--
--
-- MEDIDO COM MUTACAO, e os numeros estao conferidos:
--
--   1. tirar a trava A da caixinha (a corrente post por post)
--                                               -> 2 cenarios caem
--   2. tirar a trava B (os portoes que o cliente ja decidiu daquele post)
--                                               -> 6 cenarios caem
--   3. deixar a caixinha da entrega ser marcada a mao
--                                               -> 3 cenarios caem
--   4. fazer o ramo do `aprovado` ler o portao ABERTO em vez do que acabou
--      de fechar (a pegadinha do indice, descrita acima)
--                                               -> 7 cenarios caem
--   5. nao desmarcar a caixinha no pedido de ajustes (so gravar a observacao)
--                                               -> 5 cenarios caem
--   6. fazer o ajuste da ENTREGA voltar para a etapa do portao em vez do
--      ultimo elo de producao antes dela        -> 9 cenarios caem
--   7. tirar o gatilho que protege as tres colunas de social em `subtasks`
--                                               -> 3 cenarios caem
--   8. tirar o `offset` da frase da trava B (nomear os portoes TODOS em vez
--      dos que faltam)                          -> 1 cenario cai
--
-- A 8 E DE UMA RODADA DEPOIS, e quem a achou foi a IMAGEM do prototipo e nao
-- a bateria -- a frase saia *"o cliente ainda nao aprovou Pauta, Envio neste
-- post"* numa peca cuja Pauta estava aprovada. A versao errada nao estoura:
-- ela devolve uma recusa plausivel, que a pessoa confere, ve que esta errada,
-- e passa a desconfiar do resto. O cenario mora no arquivo 39 e nao no 21
-- porque o fluxo do 21 tem UM portao, e com um a lista do jeito errado e a do
-- jeito certo dao a mesma frase. E a decisao da 0023, que nomeia CADA etapa
-- sem aprovacao: dizer quais errado e pior que nao dizer.
--
-- A 4 E A QUE VALE LER, e ela nao estava na lista que eu escrevi antes de
-- rodar a bateria: eu nao sabia que ela existia. A conta do portao tem uma
-- pegadinha de indice -- a rodada ja esta `aprovada` quando o gatilho roda --,
-- e a mutacao que a reintroduz derruba sete cenarios em dois arquivos, entre
-- eles *"o POST voltou para producao"*, que e o que o arquivo 39 existe para
-- medir. Uma trava que a bateria me obrigou a escrever.
--
-- A CONVERSAO DO PASSO 16 NAO DA PARA MEDIR AQUI, e vale dito em vez de
-- escondido: ela depende de um banco com `post_etapas` preenchida ANTES desta
-- migration, e a tabela nao existe mais no banco em que a bateria roda -- o
-- `rodar.sh` aplica as migrations em ordem, e a 0088 e a ultima. O que os
-- arquivos 21, 30 e 31 medem e que o modelo antigo SAIU; quem confere a
-- conversao de verdade confere no banco de producao, antes e depois, e e por
-- isso que ela escreve o `raise notice` com as contagens e a migration termina
-- com o `select` de conferencia.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - DE QUE MES E ESTE POST
--
-- A pergunta que `posts.subtask_id -> subtasks.task_id` respondia, agora em
-- uma coluna. `on delete cascade` e nao `set null`, e a diferenca e o furo que
-- a 0086 existiu para fechar: com `set null`, apagar a demanda deixava os
-- posts ORFAOS -- continuavam no Social Media, continuavam no portal do
-- cliente, e nao tinham mais mes nenhum.
--
-- Ele NAO substitui o gatilho `tasks_apaga_o_social` (0086), e vale dito por
-- que: aquele e `before delete` e RECUSA quando algum post ja foi ao cliente,
-- entao o cascade nunca chega a rodar nesse caso -- a recusa aborta a
-- instrucao inteira. O cascade e o cinto depois do suspensorio: no dia em que
-- alguem apagar a demanda por um caminho que o gatilho nao cubra, os posts vao
-- junto em vez de ficarem pendurados.
-- ---------------------------------------------------------------------------

alter table public.posts
  add column if not exists social_task_id uuid references public.tasks (id) on delete cascade;

comment on column public.posts.social_task_id is
  'A demanda do mes de social deste post (0088). Substitui a ponte `posts.subtask_id -> subtasks.task_id` da 0061: a subtarefa passou a ser a ETAPA do mes, e nao o post. Nulo = post avulso, fora de um mes aberto.';

create index if not exists posts_social_task_idx
  on public.posts (social_task_id)
  where social_task_id is not null;


-- ---------------------------------------------------------------------------
-- PASSO 2 - O PAPEL DA ETAPA, EM `subtasks`
--
-- Tres colunas, e sao as mesmas tres que `post_etapas` carregava desde a 0087:
-- o papel na corrente, se o cliente decide, e qual campo do card ela enche.
--
-- SAO COLUNAS DE `subtasks` E NAO UMA TABELA AO LADO, e a escolha e deliberada
-- -- esta e a primeira vez que um modulo encosta nessa tabela, que e a mais
-- lida do produto. Uma tabela 1-1 (`subtask_id` chave, tres colunas) e as
-- MESMAS tres colunas noutro lugar, cobrando um join em cada leitura da
-- corrente, duas policies, e um espelho para o apagamento -- que e o preco que
-- a 0080 pagou com `deliverables`. Nulo em subtarefa que nao e de social
-- custa um bit por linha.
--
-- E SAO UM SNAPSHOT, nao uma chave estrangeira para `social_flow_steps`. A
-- razao e mecanica antes de ser de principio: `salvar_fluxo_de_social()`
-- (0087) APAGA os elos e os reinsere a cada edicao, entao toda chave
-- apontaria para uma linha que nao existe mais na primeira vez que alguem
-- mexesse no fluxo -- e o mes em curso ficaria sem portao nenhum, sem erro em
-- lugar nenhum. Copiar e a decisao de `tasks.workflow_snapshot`: editar o
-- fluxo depois nao muda nenhum mes que ja esta correndo.
--
-- O QUE NAO VIRA COLUNA E A FUNCAO (`team_funcao`), e ela existia em
-- `post_etapas`. Quem a lia era a etapa de Ajustes, para herdar a funcao de
-- quem refaz -- e a etapa de Ajustes deixou de existir. O que sobrava era
-- desenho: "1. Pauta -- Social Media", e o que uma subtarefa mostra em todo o
-- resto do produto e a PESSOA. Quando a conta nao tem ninguem na funcao, o
-- recado vai para `aviso_geracao` (0040), que e a coluna escrita exatamente
-- para isso -- e ela NOMEIA a funcao que faltou, que e a regra da 0064.
-- ---------------------------------------------------------------------------

alter table public.subtasks
  add column if not exists social_papel public.social_flow_papel,
  add column if not exists social_campo text,
  add column if not exists social_portao boolean not null default false;

comment on column public.subtasks.social_papel is
  'Preenchido = esta subtarefa e uma ETAPA de um mes de social (0088), e o valor e o papel dela na corrente. Snapshot do elo do fluxo (0087), nunca uma chave: o editor de fluxo apaga e reinsere os elos.';
comment on column public.subtasks.social_campo is
  'Qual campo do card do post esta etapa enche: `pauta`, `legenda`, ou nulo quando o trabalho dela viaja pela arte (0046, 0087).';
comment on column public.subtasks.social_portao is
  'Esta etapa do mes passa pelo cliente, post por post (0076). Em `papel = entrega` ela e falsa porque a entrega JA e o portao -- ver o `check`.';

-- As DUAS travas sao as da 0087, vindas junto com as colunas: um `check` que
-- vale num lado e nao no outro e o lugar onde as duas verdades divergem.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subtasks_social_coerente'
  ) then
    alter table public.subtasks
      add constraint subtasks_social_coerente check (
        -- Fora do social as tres sao vazias. Sem esta metade, uma subtarefa de
        -- demanda com `social_campo` preenchido entraria em `etapas_do_mes()`
        -- de um mes qualquer e abriria um portao que ninguem configurou.
        (social_papel is not null or (social_campo is null and social_portao = false))
        and
        -- O PORTAO SO EXISTE EM ELO DE PRODUCAO, que e
        -- `social_flow_steps_portao_coerente` (0087) deste lado: a entrega E o
        -- portao, e marcar as duas coisas na mesma etapa faria
        -- `portoes_do_mes()` conta-la uma vez e o cliente decidi-la duas.
        (social_portao = false or social_papel = 'producao')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'subtasks_social_campo_conhecido'
  ) then
    alter table public.subtasks
      add constraint subtasks_social_campo_conhecido check (
        social_campo is null or social_campo in ('pauta', 'legenda')
      );
  end if;
end;
$$;

create index if not exists subtasks_social_idx
  on public.subtasks (task_id, ordem)
  where social_papel is not null;


-- ---------------------------------------------------------------------------
-- PASSO 3 - A CAIXINHA: POST x ETAPA
--
-- *"A subtarefa mostra 12/18 no cabecalho e na lista."* E a tabela do sprint,
-- com as colunas dele.
--
-- `observacao` E A COLUNA QUE A ETAPA DE AJUSTES SUBSTITUIU, e e por isso que
-- ela entra agora: o pedido do cliente sobre UM post de um trabalho que e do
-- mes nao cabe na etapa (ela e de dezoito) nem na rodada (que a tela de
-- producao nao le). Cabe aqui, na linha daquele post naquela etapa, que e
-- exatamente o lugar onde quem vai refazer esta olhando.
--
-- O CLIENTE NAO TEM POLICY NENHUMA AQUI, e a ausencia e a trava -- a mesma de
-- `post_etapas` desde a 0045: a corrente e conversa interna. Ele decide sobre
-- o material, nao acompanha quem da casa esta com ele na mao. O que ele precisa
-- saber sai de `o_que_o_cliente_decide()`, `security definer`, devolvendo so o
-- agregado.
-- ---------------------------------------------------------------------------

create table if not exists public.post_etapa_progresso (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts (id) on delete cascade,
  subtask_id    uuid not null references public.subtasks (id) on delete cascade,
  concluido     boolean not null default false,
  concluido_em  timestamptz,
  concluido_por uuid references public.profiles (id) on delete set null,
  observacao    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (post_id, subtask_id)
);

comment on table public.post_etapa_progresso is
  'A caixinha de um post numa etapa do mes de social (0088): o "12 de 18" do cabecalho da etapa. Substitui `post_etapas`, que era a corrente inteira repetida em cada post.';

create index if not exists post_etapa_progresso_etapa_idx
  on public.post_etapa_progresso (subtask_id, concluido);
create index if not exists post_etapa_progresso_post_idx
  on public.post_etapa_progresso (post_id);

alter table public.post_etapa_progresso enable row level security;

-- QUEM E DONO DESTA ETAPA DO MES. `security definer` pela razao de
-- `tenho_etapa_no_post()` (0047): ela e chamada de DENTRO de uma policy, e uma
-- subconsulta em `subtasks` ali passaria pela RLS daquela tabela -- o que
-- funciona para quem e staff e falha calado para quem nao e, devolvendo
-- "nao e minha" em vez de "nao posso ler".
create or replace function public.minha_etapa_do_mes(p_subtask_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_subtask_id is null then
    return false;
  end if;
  return exists (
    select 1 from public.subtasks s
     where s.id = p_subtask_id
       and s.social_papel is not null
       and s.responsavel_id = (select auth.uid())
  );
end;
$$;

comment on function public.minha_etapa_do_mes(uuid) is
  'Esta etapa de mes de social e minha? E a porta de escrita da caixinha (0088) -- quem marca o Layout de um post e quem esta com a etapa Layout do mes.';

drop policy if exists post_etapa_progresso_select on public.post_etapa_progresso;
create policy post_etapa_progresso_select on public.post_etapa_progresso
  for select to authenticated using (public.is_staff());

drop policy if exists post_etapa_progresso_insert on public.post_etapa_progresso;
-- AS LINHAS NASCEM POR GATILHO, e esta policy e para o caminho de quem monta a
-- chamada a mao -- e para o dia em que a tela precisar criar uma. `is_gestor()`
-- e nao `is_staff()` pela razao de sempre: quem produz marca a caixinha, quem
-- decide quais caixinhas existem e quem abre o mes.
create policy post_etapa_progresso_insert on public.post_etapa_progresso
  for insert to authenticated with check (public.is_gestor());

drop policy if exists post_etapa_progresso_update on public.post_etapa_progresso;
create policy post_etapa_progresso_update on public.post_etapa_progresso
  for update to authenticated
  using (public.is_gestor() or public.minha_etapa_do_mes(subtask_id))
  with check (public.is_gestor() or public.minha_etapa_do_mes(subtask_id));

-- SEM POLICY DE DELETE, e a ausencia e a regra: a caixinha sai com o post ou
-- com a etapa, pelo cascade das duas chaves. Apaga-la a mao deixaria a etapa
-- com "11 de 17" num mes de dezoito posts -- um denominador que mente.


-- ---------------------------------------------------------------------------
-- PASSO 4 - AS PERGUNTAS DO MES, CADA UMA NUM LUGAR SO
--
-- E a decisao de `posts_do_mes()` na 0086, escrita no cabecalho dela: a
-- ligacao aparecia em quatro lugares, e *"escrita quatro vezes, a quarta e a
-- que esquece o join"*. Aqui sao cinco perguntas, e cada uma tem uma funcao.
-- ---------------------------------------------------------------------------

-- `posts_do_mes()` E REESCRITA NA PONTE NOVA, e e a unica linha dela que muda.
-- Ela continua NAO sendo `security definer`, pela razao da 0086: quem chama ja
-- passou pela policy de `posts`, e abrir aqui entregaria a lista de posts de
-- qualquer mes a quem tiver o uuid da demanda.
create or replace function public.posts_do_mes(p_task_id uuid)
returns setof public.posts
language sql
stable
set search_path = public
as $$
  select p.* from public.posts p where p.social_task_id = p_task_id;
$$;

comment on function public.posts_do_mes(uuid) is
  'Os posts de um mes de social, por `posts.social_task_id` (0088). Era a ponte `posts.subtask_id -> subtasks.task_id` (0061), que saiu com a subtarefa por post.';

-- AS ETAPAS DO MES, em ordem. `setof subtasks` e nao uma lista de colunas: a
-- etapa E uma subtarefa, com tudo o que uma subtarefa tem, e devolver um
-- recorte obrigaria a acrescentar coluna aqui a cada tela nova.
create or replace function public.etapas_do_mes(p_task_id uuid)
returns setof public.subtasks
language sql
stable
set search_path = public
as $$
  select s.* from public.subtasks s
   where s.task_id = p_task_id
     and s.social_papel is not null
   order by s.ordem;
$$;

comment on function public.etapas_do_mes(uuid) is
  'As etapas de um mes de social, em ordem (0088). `social_papel` preenchido e o que distingue uma etapa de mes de uma subtarefa comum.';

-- OS PORTOES, em ordem. A entrega E um portao e por isso entra aqui sem a
-- marca: `social_portao` so existe em elo de producao (o `check` do PASSO 2),
-- e a entrega e o portao por definicao desde a 0032.
create or replace function public.portoes_do_mes(p_task_id uuid)
returns setof public.subtasks
language sql
stable
set search_path = public
as $$
  select s.* from public.subtasks s
   where s.task_id = p_task_id
     and s.social_papel is not null
     and (s.social_portao or s.social_papel = 'entrega')
   order by s.ordem;
$$;

comment on function public.portoes_do_mes(uuid) is
  'As etapas do mes que passam pelo cliente, em ordem (0088). A lista ordenada delas, mais a contagem de rodadas aprovadas de um post, e o que `porta_do_cliente_no_post()` usa para responder por aquele post.';

-- QUANTAS RODADAS DE CLIENTE ESTE POST JA TEVE APROVADAS. E a metade "por
-- post" da frase do usuario, e e ela que faz a etapa ser do mes e a decisao
-- continuar sendo de cada peca.
create or replace function public.aprovacoes_do_cliente_no_post(p_post_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.approval_rounds r
   where r.content_type = 'post'
     and r.content_id = p_post_id
     and r.escopo = 'cliente'
     and r.status = 'aprovada';
$$;

comment on function public.aprovacoes_do_cliente_no_post(uuid) is
  'Quantos portoes deste post o cliente ja aprovou (0088). Rodada pendente, recusada ou rejeitada nao conta: pedir aprovacao nao e ter aprovacao, que e a regra da 0023.';

-- O PROGRESSO DE UMA ETAPA: o "12 de 18" do cabecalho.
create or replace function public.progresso_da_etapa(p_subtask_id uuid)
returns table (feitos integer, total integer)
language sql
stable
set search_path = public
as $$
  select count(*) filter (where g.concluido)::integer,
         count(*)::integer
    from public.post_etapa_progresso g
   where g.subtask_id = p_subtask_id;
$$;

comment on function public.progresso_da_etapa(uuid) is
  'O "12 de 18" de uma etapa de mes de social (0088). Sai da mesma tabela que a lista de caixinhas desenha: duas contas dariam um cabecalho prometendo doze e uma lista mostrando onze.';


-- ---------------------------------------------------------------------------
-- PASSO 5 - QUAL DECISAO DO CLIENTE VEM A SEGUIR, NESTE POST
--
-- A funcao mais importante desta migration, e a mesma pergunta da 0076 com a
-- resposta saindo de outro lugar. Ate aqui ela lia a corrente DAQUELE post:
-- *"o primeiro portao ainda nao concluido"*. Agora a corrente e do MES, e a
-- resposta e a conta que a frase do usuario descreve:
--
--   portao aberto = o (k+1)-esimo portao do mes,
--                   onde k = rodadas de cliente APROVADAS deste post.
--
-- Pendente, recusada e rejeitada nao contam, e e a regra da 0023 outra vez:
-- pedir aprovacao nao e ter aprovacao. Entao o cliente que pediu ajustes na
-- pauta continua com a pauta como portao aberto -- refaz e manda de novo --,
-- e nao avanca para o portao seguinte.
--
-- POST AVULSO DEVOLVE NULO, e isso nao e um furo: sem mes nao ha corrente, e
-- os chamadores fazem `coalesce(porta.papel, 'entrega')` desde a 0087. Ele
-- volta a se comportar como um post anterior a 0045 -- um envio, uma decisao
-- do cliente --, que e o estado que todas as telas ja desenham.
--
-- `returns public.subtasks` pela razao de `etapas_do_mes()`: o portao E uma
-- etapa, e os chamadores leem `porta.titulo`, `porta.ordem`,
-- `porta.social_papel`, `porta.social_campo` e `porta.responsavel_id`.
-- ---------------------------------------------------------------------------

-- O PORTAO NUMERO N DO MES. Um lugar so faz a conta posicional, e e por uma
-- razao que a bateria encontrou: `porta_do_cliente_no_post()` quer o portao
-- ABERTO (o k+1) e o gatilho da decisao quer o que ACABOU DE FECHAR (o k) --
-- a rodada ja esta `aprovada` quando ele roda, entao as duas perguntas sao
-- posicoes diferentes da mesma lista. Escritas em dois lugares, a segunda e a
-- que erra o indice em um.
create or replace function public.portao_do_mes_na_posicao(p_task_id uuid, p_posicao integer)
returns public.subtasks
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e public.subtasks;
begin
  if p_task_id is null or p_posicao is null or p_posicao < 1 then
    return e;
  end if;

  select g.* into e
    from (
      select s.*, row_number() over (order by s.ordem) as posicao
        from public.portoes_do_mes(p_task_id) s
    ) g
   where g.posicao = p_posicao;

  return e;
end;
$$;

comment on function public.portao_do_mes_na_posicao(uuid, integer) is
  'O N-esimo portao de um mes de social (0088). Um lugar so faz a conta posicional: o portao aberto e o k+1 e o que acabou de fechar e o k, e dois lugares errariam o indice em um.';

-- O `drop` E OBRIGATORIO, e nao e zelo: `create or replace function` NAO
-- consegue trocar o tipo de retorno de uma funcao que existe -- ela devolvia
-- `public.post_etapas` desde a 0076, e devolver `public.subtasks` e outro
-- tipo. Sem ele a migration para com *"cannot change return type of existing
-- function"*, que e a pegadinha irma da assinatura da 0061.
drop function if exists public.porta_do_cliente_no_post(uuid);

create or replace function public.porta_do_cliente_no_post(p_post_id uuid)
returns public.subtasks
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mes uuid;
  e   public.subtasks;
begin
  select p.social_task_id into mes from public.posts p where p.id = p_post_id;
  if mes is null then
    return e;
  end if;

  return public.portao_do_mes_na_posicao(
    mes, public.aprovacoes_do_cliente_no_post(p_post_id) + 1);
end;
$$;

comment on function public.porta_do_cliente_no_post is
  'O portao do mes que a proxima decisao do cliente deste post fecha (0088): o (k+1)-esimo, onde k sao as rodadas de cliente ja aprovadas DELE. A etapa e do mes, a decisao e da peca.';

-- DE QUEM O POST VOLTA QUANDO O CLIENTE RECUSA
--
-- A regra da 0045 sobrevive inteira, e e a unica parte da etapa de Ajustes que
-- fica: quem refaz a ARTE e quem a fez, e nao quem a enviou. Num portao do
-- MEIO quem refaz e o dono do proprio portao -- quem escreveu a pauta
-- reescreve a pauta. Ler "o ultimo elo de producao" nos dois casos poria o
-- designer para reescrever texto.
--
-- E a pergunta e POSICIONAL e nao pelo nome (0087): num fluxo que chame aquela
-- etapa de "Producao de Layout", `nome = 'Layout'` devolveria ninguem.
create or replace function public.etapa_que_refaz_o_post(p_porta_id uuid)
returns public.subtasks
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  porta public.subtasks;
  alvo  public.subtasks;
begin
  select s.* into porta from public.subtasks s where s.id = p_porta_id;
  if porta.id is null then
    return alvo;
  end if;

  if porta.social_papel <> 'entrega' then
    return porta;
  end if;

  select s.* into alvo
    from public.subtasks s
   where s.task_id = porta.task_id
     and s.social_papel = 'producao'
     and s.ordem < porta.ordem
   order by s.ordem desc
   limit 1;

  -- Sem elo de producao antes da entrega -- um fluxo de uma etapa so -- quem
  -- recebe o pedido e a propria entrega. Devolver nulo faria o aviso nao sair
  -- e a caixinha de ninguem desmarcar.
  return coalesce(alvo, porta);
end;
$$;

comment on function public.etapa_que_refaz_o_post(uuid) is
  'A etapa do mes que recebe o post de volta quando o cliente recusa um portao (0088): o proprio portao, ou -- quando ele e a entrega -- o ultimo elo de producao antes dele, porque quem refaz a arte e quem a fez (0045).';


-- ---------------------------------------------------------------------------
-- PASSO 6 - AS TRAVAS DA CAIXINHA
--
-- A corrente mensal e `subtask_dependencies`, e quem a recusa e
-- `validar_transicao_de_subtarefa` desde a 0007. Estas travas sao a mesma
-- corrente um nivel abaixo, no post: a etapa Layout pode estar em andamento e
-- o post 7 ainda nao ter conteudo.
--
-- AS DUAS EXCECOES SAO AS DA 0045, nos mesmos termos e no mesmo lugar:
--
--   * SEM SESSAO QUEM ESCREVE E O SEED, que monta um mes no meio do caminho --
--     posts enviados, posts com ajuste pedido -- e uma corrente que so aceita
--     ser percorrida em ordem obrigaria cinco escritas em sequencia por post
--     para descrever um estado.
--
--   * E O GUC diz que quem escreve e o proprio produto:
--     `posts_corrente_do_cliente` desmarca a caixinha rodando com o
--     `auth.uid()` DO CLIENTE (`security definer` nao troca quem esta logado),
--     entao sem ele o cliente pedindo ajustes cairia na trava da entrega --
--     recusando a unica coisa que ele faz la.
-- ---------------------------------------------------------------------------

create or replace function public.post_etapa_progresso_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  etapa        public.subtasks;
  pendente     text;
  portoes      integer;
  falta        text;
  travas boolean := (select auth.uid()) is not null
                    and coalesce(current_setting('full_hub.corrente', true), '') <> 'on';
begin
  select s.* into etapa from public.subtasks s where s.id = new.subtask_id;

  if etapa.id is null or etapa.social_papel is null then
    raise exception using
      errcode = 'check_violation',
      message = 'A caixinha de progresso é de uma etapa de mês de social.',
      hint    = 'Uma subtarefa comum não tem posts dentro dela: o progresso dela é o status.';
  end if;

  -- O POST E A ETAPA NAO TROCAM DE LUGAR. Policy nao limita coluna: sem esta
  -- parte, um PATCH no PostgREST moveria a marcacao de um post para outro --
  -- e o "12 de 18" continuaria dizendo doze.
  if tg_op = 'UPDATE'
     and (new.post_id is distinct from old.post_id
          or new.subtask_id is distinct from old.subtask_id) then
    raise exception using
      errcode = 'check_violation',
      message = 'A caixinha pertence a um post e a uma etapa, e nenhum dos dois muda.',
      hint    = 'Para mover trabalho entre etapas, mexa nas etapas do mês.';
  end if;

  -- `mudou` E O QUE SEPARA A ESCRITA DA CAIXINHA DO NASCIMENTO DELA, e a
  -- distincao nao e zelo: as linhas nascem em bloco, uma por post x etapa,
  -- desmarcadas -- e sem esta variavel a trava da entrega recusaria o proprio
  -- `insert` que cria as caixinhas dela, deixando toda etapa de entrega sem
  -- denominador. O "12 de 18" dela sairia "0 de 0".
  if not ((tg_op = 'INSERT' and new.concluido)
          or (tg_op = 'UPDATE' and new.concluido is distinct from old.concluido)) then
    new.updated_at := now();
    return new;
  end if;

  -- A CAIXINHA DA ENTREGA NAO SE MARCA A MAO, nem pela gestao. E a regra da
  -- 0045 um nivel abaixo: a etapa Envio era consequencia da rodada de escopo
  -- cliente, e a caixinha dela e consequencia da APROVACAO daquele post.
  -- Marcar a mao afirmaria que a peca foi e voltou aprovada sem nada ter
  -- saido da agencia -- e DESMARCAR a mao afirmaria o contrario de uma
  -- aprovacao que esta gravada na rodada.
  if travas and etapa.social_papel = 'entrega' then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" acompanha a decisão do cliente, e não se marca à mão.', etapa.titulo),
      hint    = 'Use a ação Enviar ao cliente; quando ele aprovar, a caixinha deste post fecha sozinha.';
  end if;

  if travas and new.concluido then
    -- A ORDEM DAS DUAS E DELIBERADA, e a bateria me obrigou a escolher: no
    -- Programar as DUAS valem -- a caixinha da entrega so fecha pela aprovacao
    -- do cliente, entao ela esta desmarcada e a trava da corrente tambem
    -- dispararia. Com a A primeiro, a pessoa lia *"falta Envio"*, que e
    -- verdade e nao diz o que fazer; com a B primeiro ela le *"o cliente ainda
    -- nao aprovou Envio"*, que e a mesma recusa dizendo de quem a bola esta.
    -- E a decisao da 0023: a recusa que nomeia e a diferenca entre um "nao
    -- pode" e uma instrucao.

    -- TRAVA B - o cliente ja decidiu os portoes anteriores DESTE post.
    --
    -- Ela nao e coberta pela A, e e o ponto: a caixinha de um portao do MEIO
    -- marca que a PESSOA escreveu a pauta, nao que o cliente a aprovou. Sem
    -- esta, as doze pautas marcadas liberariam o conteudo das doze sem nenhuma
    -- ter sido validada -- que e o fluxo que a conta contratou para nao
    -- acontecer.
    --
    -- E ela cobre "ninguem programa o que o cliente nao aprovou" sem uma
    -- segunda regra: antes do Programar ha dois portoes num fluxo que valida a
    -- pauta (a Pauta e o Envio), entao ele precisa de duas aprovacoes.
    select count(*)::integer into portoes
      from public.portoes_do_mes(etapa.task_id) p
     where p.ordem < etapa.ordem;

    if public.aprovacoes_do_cliente_no_post(new.post_id) < portoes then
      -- A FRASE NOMEIA SO O QUE FALTA, e nao os portoes todos.
      --
      -- As aprovacoes desta peca fecham os portoes NA ORDEM -- e a conta que
      -- `porta_do_cliente_no_post()` faz --, entao os aprovados sao os `k`
      -- primeiros e o `offset` tira exatamente eles. Sem ele, num fluxo que
      -- valida a pauta a recusa do Programar dizia *"o cliente ainda nao
      -- aprovou Pauta, Envio"* numa peca cuja Pauta esta aprovada: uma frase
      -- que a pessoa confere, ve que esta errada, e passa a desconfiar do
      -- resto. E a decisao da 0023, que nomeia CADA etapa sem aprovacao --
      -- dizer quais e a diferenca entre uma recusa e uma instrucao, e dizer
      -- quais errado e pior que nao dizer.
      select string_agg(p.titulo, ', ' order by p.ordem) into falta
        from (select p.titulo, p.ordem
                from public.portoes_do_mes(etapa.task_id) p
               where p.ordem < etapa.ordem
               order by p.ordem
              offset public.aprovacoes_do_cliente_no_post(new.post_id)) p;

      raise exception using
        errcode = 'check_violation',
        message = format('O cliente ainda não aprovou %s neste post.', falta),
        hint    = 'Cada peça passa pelos portões dela: a etapa é do mês, a decisão é de cada post.';
    end if;

    -- TRAVA A - a corrente, neste post.
    select string_agg(s.titulo, ', ' order by s.ordem) into pendente
      from public.subtasks s
      left join public.post_etapa_progresso g
             on g.subtask_id = s.id and g.post_id = new.post_id
     where s.task_id = etapa.task_id
       and s.social_papel is not null
       and s.ordem < etapa.ordem
       and coalesce(g.concluido, false) = false;

    if pendente is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('Neste post falta %s antes desta etapa.', pendente),
        hint    = 'A corrente do mês é em ordem, post por post: cada etapa espera a anterior daquele post.';
    end if;
  end if;

  -- O CARIMBO NAO E TRAVA, e por isso fica fora dos `if travas`: ele vale para
  -- toda escrita, a do seed e a do cliente inclusive. Caixinha marcada sem
  -- data e sem autor e uma linha que nao serve para relatorio nenhum.
  if new.concluido and (tg_op = 'INSERT' or not old.concluido) then
    new.concluido_em  := now();
    new.concluido_por := coalesce(new.concluido_por, (select auth.uid()));
  elsif not new.concluido then
    new.concluido_em  := null;
    new.concluido_por := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists post_etapa_progresso_regras on public.post_etapa_progresso;
create trigger post_etapa_progresso_regras
  before insert or update on public.post_etapa_progresso
  for each row execute function public.post_etapa_progresso_regras();

comment on function public.post_etapa_progresso_regras() is
  'As travas da caixinha (0088): a corrente post por post, os portoes que o cliente ja decidiu daquele post, e a caixinha da entrega que nao se marca a mao.';


-- A ETAPA REABRE QUANDO UMA CAIXINHA DESMARCA, e e o que faz o pedido de
-- ajustes do cliente voltar o trabalho para quem o fez: a etapa estava
-- concluida, um post voltou, e ela nao esta mais concluida.
--
-- `after` e nao `before`: a linha precisa estar gravada para o `progresso_da_etapa`
-- do cabecalho bater com o que a etapa diz. E `concluida -> em_andamento`
-- passa pelas quatro travas da 0007 -- nenhuma delas olha a saida de
-- `concluida`.
create or replace function public.post_etapa_progresso_reabre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.concluido then
    return null;
  end if;

  update public.subtasks
     set status = 'em_andamento'
   where id = new.subtask_id
     and status = 'concluida';

  return null;
end;
$$;

drop trigger if exists post_etapa_progresso_reabre on public.post_etapa_progresso;
create trigger post_etapa_progresso_reabre
  after update on public.post_etapa_progresso
  for each row
  when (old.concluido and not new.concluido)
  execute function public.post_etapa_progresso_reabre();

comment on function public.post_etapa_progresso_reabre() is
  'Uma caixinha que desmarca reabre a etapa do mes (0088): ela estava concluida, um post voltou, e ela nao esta mais. E o que substitui a etapa de Ajustes da 0045.';


-- ---------------------------------------------------------------------------
-- PASSO 7 - O QUE QUEM PRODUZ NAO TROCA NA ETAPA DO MES
--
-- POLICY NAO LIMITA COLUNA, e aqui isso tem um alvo especifico.
-- `subtasks_update` e `is_gestor() or is_atendimento() or responsavel_id =
-- auth.uid()` desde a 0007 -- o dono da etapa escreve nela, que e o certo e e
-- como ele move o andamento. So que as tres colunas do PASSO 2 nao sao
-- andamento: elas dizem que a etapa E a entrega ao cliente, e que ela e o
-- PORTAO.
--
-- Sem este gatilho, um PATCH no PostgREST faria o redator marcar
-- `social_papel = 'entrega'` na etapa dele -- e `portoes_do_mes()` passaria a
-- devolver a etapa DELE como o lugar por onde o material sai da agencia, com
-- `porta_do_cliente_no_post()` atras. E a mesma trava que `post_etapas_regras`
-- tinha na 0087, vinda junto com as colunas: uma regra que vale num lado e nao
-- no outro e o lugar onde as duas verdades divergem.
--
-- E ELE E ESTREITO DE PROPOSITO -- so as tres colunas. As outras continuam
-- governadas pela policy: a 0088 abriu a distribuicao da etapa do social para
-- quem distribui etapa (a divergencia esta escrita no cabecalho), e um gatilho
-- mais largo aqui a fecharia de volta por um caminho que ninguem leria.
--
-- AS DUAS EXCECOES SAO AS DE SEMPRE: sem sessao quem escreve e o seed e a
-- conversao, e o GUC diz que quem escreve e o proprio produto.
-- ---------------------------------------------------------------------------

create or replace function public.subtasks_protege_o_social()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null
     or coalesce(current_setting('full_hub.corrente', true), '') = 'on'
     or public.is_gestor() then
    return new;
  end if;

  if new.social_papel  is distinct from old.social_papel
     or new.social_campo  is distinct from old.social_campo
     or new.social_portao is distinct from old.social_portao then
    raise exception using
      errcode = 'check_violation',
      message = 'O papel de uma etapa do mês de social é da gestão.',
      hint    = 'Quem decide se uma etapa passa pelo cliente é o fluxo, em Social Media → Fluxos.';
  end if;

  return new;
end;
$$;

drop trigger if exists subtasks_protege_o_social on public.subtasks;
create trigger subtasks_protege_o_social
  before update of social_papel, social_campo, social_portao on public.subtasks
  for each row execute function public.subtasks_protege_o_social();

comment on function public.subtasks_protege_o_social() is
  'As tres colunas de social de uma etapa do mes sao da gestao (0088). Policy nao limita coluna: sem este gatilho o dono da etapa diria que ela E a entrega ao cliente, e o portao do post passaria a ser a dele.';


-- ---------------------------------------------------------------------------
-- PASSO 8 - AS CAIXINHAS NASCEM SOZINHAS, pelos DOIS lados
--
-- *"As linhas sao criadas junto com o plano: um registro por post x etapa."*
-- O sprint diz isso da montagem, e a montagem e um dos dois caminhos: um post
-- pode entrar num mes que ja existe (abrir o mesmo mes em duas vezes
-- acrescenta posts a demanda que ja esta la, desde a 0061), e uma etapa pode
-- entrar num mes que ja tem posts.
--
-- SAO DOIS GATILHOS E NAO UMA LINHA DENTRO DE `abrir_mes_de_social`, pela
-- razao da auditoria (0058): escrito na funcao, o segundo caminho nasce sem
-- caixinha nenhuma -- a etapa mostraria "0 de 0" num mes de dezoito posts, e
-- ninguem ligaria uma coisa a outra.
-- ---------------------------------------------------------------------------

create or replace function public.posts_entra_no_mes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.social_task_id is null then
    return null;
  end if;

  insert into public.post_etapa_progresso (post_id, subtask_id)
  select new.id, s.id from public.etapas_do_mes(new.social_task_id) s
  on conflict (post_id, subtask_id) do nothing;

  return null;
end;
$$;

drop trigger if exists posts_entra_no_mes on public.posts;
create trigger posts_entra_no_mes
  after insert or update of social_task_id on public.posts
  for each row execute function public.posts_entra_no_mes();

comment on function public.posts_entra_no_mes() is
  'Post que entra num mes de social ganha a caixinha de cada etapa dele (0088).';

create or replace function public.subtasks_etapa_entra_no_mes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.social_papel is null then
    return null;
  end if;

  insert into public.post_etapa_progresso (post_id, subtask_id)
  select p.id, new.id from public.posts p where p.social_task_id = new.task_id
  on conflict (post_id, subtask_id) do nothing;

  return null;
end;
$$;

drop trigger if exists subtasks_etapa_entra_no_mes on public.subtasks;
create trigger subtasks_etapa_entra_no_mes
  after insert on public.subtasks
  for each row execute function public.subtasks_etapa_entra_no_mes();

comment on function public.subtasks_etapa_entra_no_mes() is
  'Etapa que entra num mes de social ganha a caixinha de cada post que ja esta la (0088).';


-- ---------------------------------------------------------------------------
-- PASSO 9 - O QUE A DECISAO DO CLIENTE MOVE AGORA
--
-- A funcao e reescrita INTEIRA a partir da versao da 0087, que e a ultima.
-- `create or replace` se reescreve a partir do que se digita e NAO AVISA
-- quando a nova tem menos coisa que a velha -- foi assim que a 0030 perdeu os
-- carimbos da 0007, e ninguem viu por dois sprints.
--
-- O QUE SAI: os tres `update public.post_etapas` e a criacao da etapa de
-- Ajustes, com o rotulo numerado e a busca do dono. O QUE FICA: a devolucao do
-- post para `em_producao` quando o portao era do meio (0076, a linha que
-- impede a mentira mais cara daquela migration), e a regra de quem refaz a
-- arte -- agora em `etapa_que_refaz_o_post()`.
--
-- O QUE ENTRA: a caixinha. Aprovou a entrega -> ela fecha. Pediu ajustes ou
-- recusou -> ela desmarca, o pedido vai para `observacao` e a etapa reabre
-- pelo gatilho do PASSO 6.
-- ---------------------------------------------------------------------------

create or replace function public.posts_corrente_do_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mes    uuid;
  porta  public.subtasks;
  refaz  public.subtasks;
  motivo text;
begin
  -- REENTRANCIA: esta funcao escreve de volta em `posts` (o portao do meio
  -- devolve o post para producao), e um `after update` que atualiza a propria
  -- linha se dispara de novo. O GUC ja diz "quem escreve aqui e o produto",
  -- entao ele serve tambem de guarda -- e serve melhor que uma coluna
  -- sentinela, porque `set local` morre no fim da transacao.
  if coalesce(current_setting('full_hub.corrente', true), '') = 'on' then
    return new;
  end if;

  -- Post fora de um mes aberto nao tem corrente, e nunca teve: ele e a forma
  -- anterior a 0045 -- um envio, uma decisao -- e todas as telas ja a
  -- desenham.
  if new.social_task_id is null then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  mes := new.social_task_id;

  -- QUAL PORTAO ESTA DECIDINDO, e as DUAS metades sao posicoes diferentes da
  -- mesma lista. Foi a bateria que me obrigou a separa-las, e o sintoma era o
  -- mais caro possivel: `decidir_rodada_do_cliente` grava a rodada como
  -- `aprovada` ANTES de escrever o status do post, entao quando este gatilho
  -- roda a contagem de aprovacoes JA inclui a decisao que o disparou -- e
  -- `porta_do_cliente_no_post()` devolvia o portao SEGUINTE. A consequencia:
  -- o cliente aprovava a PAUTA, o ramo de baixo olhava o Envio, concluia que
  -- o portao era a entrega e NAO devolvia o post para producao. O post ficava
  -- `aprovado` -- verde no calendario dele, fechado na grade do feed, "pode
  -- programar" para a agencia -- com a arte ainda sem existir. E exatamente a
  -- mentira que a 0076 escreveu que estava impedindo.
  --
  --   * APROVOU  -> o portao decidido e o k-esimo, porque ele ja foi contado.
  --   * RECUSOU  -> a rodada recusada nao conta, entao o portao aberto
  --                 continua sendo o que ele acabou de recusar.
  if new.status = 'aprovado' then
    porta := public.portao_do_mes_na_posicao(
      mes, public.aprovacoes_do_cliente_no_post(new.id));
  else
    porta := public.porta_do_cliente_no_post(new.id);
  end if;

  if porta.id is null then
    return new;
  end if;

  perform set_config('full_hub.corrente', 'on', true);

  -- APROVOU
  if new.status = 'aprovado' then
    -- A CAIXINHA DA ENTREGA FECHA PELA APROVACAO, e e o unico caminho dela
    -- (a trava do PASSO 6 recusa a mao). Num portao do MEIO nao ha o que
    -- fechar: a caixinha daquela etapa ja foi marcada por quem fez o
    -- trabalho, e o que a aprovacao acrescenta mora na rodada.
    if porta.social_papel = 'entrega' then
      update public.post_etapa_progresso
         set concluido = true
       where post_id = new.id and subtask_id = porta.id and not concluido;
    else
      -- O POST NAO ESTA APROVADO QUANDO O PORTAO ERA DO MEIO (0076): o cliente
      -- aprovou a PAUTA, e `decidir_rodada_do_cliente` acabou de escrever
      -- `status = 'aprovado'` no post -- que e o status que o calendario dele
      -- pinta de verde, que a grade do feed mostra como fechado e que a
      -- agencia le como "pode programar". Nada disso aconteceu: a arte nem
      -- existe. Entao ele volta para producao, que e onde ele esta de verdade.
      update public.posts set status = 'em_producao' where id = new.id;
    end if;
  end if;

  -- PEDIU AJUSTES, OU RECUSOU
  --
  -- Nao nasce etapa nenhuma, e e a simplificacao do 3J: com a etapa sendo do
  -- MES, criar uma "Ajustes" por pedido afirmaria que o mes inteiro voltou por
  -- causa de um post. O que volta e o post, na etapa de quem o fez.
  if new.status in ('ajustes', 'rejeitado') then
    refaz := public.etapa_que_refaz_o_post(porta.id);

    select r.comentario into motivo
      from public.approval_rounds r
     where r.content_type = 'post' and r.content_id = new.id
       and r.escopo = 'cliente'
       and r.status in ('ajustes_solicitados', 'rejeitada')
     order by r.numero_rodada desc, r.created_at desc
     limit 1;

    update public.post_etapa_progresso
       set concluido  = false,
           observacao = nullif(btrim(coalesce(motivo, '')), '')
     where post_id = new.id and subtask_id = refaz.id;

    -- E A CAIXINHA DA ENTREGA DESMARCA JUNTO, quando ela nao e a mesma: a
    -- peca nao foi entregue, foi devolvida. Sem esta linha a entrega ficaria
    -- "18 de 18" com um post em refacao dentro dela.
    if refaz.id is distinct from porta.id then
      update public.post_etapa_progresso
         set concluido = false
       where post_id = new.id and subtask_id = porta.id and concluido;
    end if;

    -- `notificar()` NAO ACEITA DESTINATARIO NULO -- `notifications.user_id` e
    -- `not null` --, e desde a 0062 ela devolve `null` em vez de estourar. O
    -- `if` fica de qualquer forma: sem ele a funcao e chamada uma vez por
    -- pedido para nao fazer nada.
    if refaz.responsavel_id is not null then
      perform public.notificar(
        refaz.responsavel_id, 'aprovacao',
        format('O cliente pediu ajustes em "%s"', new.tema),
        format('A etapa "%s" do mês voltou a ter este post em aberto.', refaz.titulo),
        '/painel/social-media'
      );
    end if;
  end if;

  -- DESLIGA ANTES DE DEVOLVER. `set local` so cai no fim da transacao, e uma
  -- transacao que aprova um post e depois mexe numa caixinha a mao passaria
  -- pelas travas calada -- a saida de emergencia virando porta destrancada.
  perform set_config('full_hub.corrente', 'off', true);

  return new;
end;
$$;

comment on function public.posts_corrente_do_cliente() is
  'Move a corrente do mes conforme o cliente decide cada post (0088): a caixinha da entrega fecha na aprovacao, e o pedido de ajustes desmarca a caixinha da etapa de quem fez o trabalho.';


-- ---------------------------------------------------------------------------
-- PASSO 10 - O QUE O CLIENTE LE NO PORTAO
--
-- Reescrita a partir da versao da 0087. O de-para continua saindo da coluna
-- `campo` e nunca do nome -- a razao esta na 0087: era `case e.nome when
-- 'Pauta'`, e renomear a etapa fazia a tela do portal abrir o portao com a
-- caixa de texto VAZIA, o cliente decidindo sobre nada. O que muda e de onde
-- a coluna vem: da etapa do MES (`subtasks.social_campo`) em vez da etapa
-- daquele post.
-- ---------------------------------------------------------------------------

create or replace function public.o_que_o_cliente_decide(p_post_id uuid)
returns table (etapa text, texto text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.posts;
  e public.subtasks;
begin
  select * into p from public.posts where id = p_post_id;
  if p.id is null then
    return;
  end if;

  -- A MESMA PERGUNTA QUE `posts_select_cliente` FAZ, escrita a mao porque o
  -- definer nao a faz sozinho. Tirando estas quatro linhas, a funcao responde
  -- sobre o post de qualquer empresa para quem tiver o uuid -- e o furo passa
  -- despercebido num banco com um cliente so.
  if not (
    public.is_staff()
    or (p.client_id in (select public.my_client_ids()) and p.enviado_em is not null)
  ) then
    return;
  end if;

  e := public.porta_do_cliente_no_post(p_post_id);

  -- Sem portao, ou na ENTREGA, NAO HA NADA A DIZER: a entrega manda o material
  -- pronto, e a tela dela ja e a de sempre. Devolve-la aqui faria a tela
  -- anunciar uma etapa em todo post enviado desde a 0032.
  if e.id is null or e.social_papel = 'entrega' then
    return;
  end if;

  return query
    select e.titulo,
           case e.social_campo
             when 'pauta'   then p.pauta
             when 'legenda' then p.legenda
             else null
           end;
end;
$$;

comment on function public.o_que_o_cliente_decide(uuid) is
  'O portao aberto de um post e o texto dele, para a tela do portal. Desde a 0088 os dois saem da etapa do MES -- `social_papel` e `social_campo` --, nunca do nome.';


-- ---------------------------------------------------------------------------
-- PASSO 11 - A PORTA DE ESCRITA DO CARD
--
-- *"Quem pega a etapa preenche o card"* e a 0046, e `tenho_etapa_no_post()` e
-- a 0047 -- essa frase em SQL. A pergunta nao muda; o lugar onde a etapa mora
-- muda.
--
-- E ELA NAO PODE SER `is_staff()` SOLTO, que e a razao escrita na 0047: com
-- dez clientes, `is_staff()` deixaria o designer de outra conta trocar a data
-- de um post que ele nunca viu.
-- ---------------------------------------------------------------------------

create or replace function public.tenho_etapa_no_post(p_post_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
      from public.posts p
      join public.subtasks s on s.task_id = p.social_task_id
     where p.id = p_post_id
       and s.social_papel is not null
       and s.responsavel_id = (select auth.uid())
  );
end;
$$;

comment on function public.tenho_etapa_no_post is
  'Quem esta com alguma etapa do MES deste post (0088). E a porta de escrita do card desde a 0047 -- a 0046 disse que quem pega a etapa preenche o card, e esta e a frase em SQL.';


-- ---------------------------------------------------------------------------
-- PASSO 12 - AS TRAVAS DE QUEM ABRE RODADA
--
-- Reescrita INTEIRA a partir da versao da 0087, e as DUAS linhas que mudam sao
-- o tipo de `porta` e a coluna do papel. As travas em si ficam exatamente como
-- estavam: post sem data nao vai ao cliente, video sem link nao vai, e as duas
-- perguntam pelo PAPEL e nao pelo nome.
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
  porta public.subtasks;
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

      -- QUAL PORTAO ESTA SAINDO (0076). As duas travas abaixo sao sobre a
      -- ARTE indo ao cliente, e num portao do meio nao ha arte ainda: quem
      -- sai e a pauta ou a legenda. Exigi-las ali travaria o portao para
      -- sempre -- o mes abre sem data (0044) e a pauta e a PRIMEIRA etapa,
      -- entao "escolha o dia antes de enviar" seria uma recusa que a corrente
      -- nao tem como satisfazer.
      porta := public.porta_do_cliente_no_post(post);

      -- POST SEM DATA NAO VAI AO CLIENTE (0044). Ela nasce nula desde esta
      -- migration -- o mes abre em branco e quem produz distribui --, e sem
      -- esta linha o cliente abriria o portal, veria a arte e a legenda, e
      -- decidiria sem saber quando aquilo vai ao ar. "Quando?" em branco ao
      -- lado de um botao de aprovar e a pior combinacao possivel.
      --
      -- Ela NAO contradiz a decisao de que a data e de quem produz (PASSO 2):
      -- nao diz quem manda na data, diz que ela existe antes de o material
      -- sair da agencia. E a mesma forma da trava de video sem link.
      --
      -- E A PERGUNTA E PELO PAPEL E NAO PELO NOME (0087): num fluxo que chame
      -- a entrega de outra coisa, `nome = 'Envio'` seria falso e as DUAS
      -- travas abaixo deixariam de valer -- o cliente receberia a arte sem
      -- data de publicacao e o video sem link, pelo unico caminho que existe
      -- para que isso nao aconteca.
      if coalesce(porta.social_papel, 'entrega') = 'entrega' and exists (
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
      if coalesce(porta.social_papel, 'entrega') = 'entrega' and exists (
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
  'As travas de quem abre rodada. Desde a 0088 o portao do post e uma etapa do MES (`subtasks.social_papel`), e as duas travas da arte -- post sem data e video sem link -- continuam perguntando pelo papel.';


-- ---------------------------------------------------------------------------
-- PASSO 13 - QUAL FLUXO ESTE POST PERCORRE, na ponte nova
--
-- A ordem continua MES -> CONTA -> CASA, e a bateria mede: a conta aponta para
-- um fluxo, o mes para outro, e quem responde e o do mes. O que muda e a
-- primeira linha -- a ponte era `posts.subtask_id -> subtasks.task_id`.
-- ---------------------------------------------------------------------------

create or replace function public.fluxo_do_post(p_post_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  achado uuid;
  conta  uuid;
begin
  select t.social_flow_id, t.client_id into achado, conta
    from public.posts p
    join public.tasks t on t.id = p.social_task_id
   where p.id = p_post_id;

  if achado is not null then
    return achado;
  end if;

  if conta is null then
    select p.client_id into conta from public.posts p where p.id = p_post_id;
  end if;

  return public.fluxo_do_mes(conta);
end;
$$;

comment on function public.fluxo_do_post(uuid) is
  'Qual fluxo de social este post percorre: o do MES dele, o da conta, ou o da casa -- nessa ordem (0087). Desde a 0088 o mes vem por `posts.social_task_id`.';


-- ---------------------------------------------------------------------------
-- PASSO 14 - ABRIR O MES PASSA A CRIAR AS ETAPAS, E NAO AS CORRENTES
--
-- A funcao e reescrita INTEIRA a partir da versao da 0087, que e a ultima. A
-- ASSINATURA NAO MUDA -- oito argumentos, os mesmos nomes --, entao nao ha
-- `drop` aqui: a pegadinha que a 0061 registrou e que custou um *"Could not
-- find the function"* ao usuario e sobre acrescentar parametro, e nenhum
-- parametro novo entra.
--
-- A ORDEM DOS PASSOS DENTRO DELA E O QUE IMPORTA, e ela inverteu: as ETAPAS
-- nascem antes dos POSTS. O gatilho `posts_entra_no_mes` (PASSO 8) le as
-- etapas do mes no instante em que o post entra, entao criar os posts primeiro
-- daria dezoito posts sem caixinha nenhuma -- cada etapa mostrando "0 de 0"
-- num mes cheio.
--
-- E O GUC `full_hub.fluxo_do_mes` SAIU. Ele existia porque
-- `montar_etapas_do_post` rodava no `after insert` do post, num instante em
-- que o post ainda nao sabia de que mes era -- a explicacao inteira esta na
-- 0087. Com as etapas nascendo antes e `social_task_id` indo no proprio
-- `insert`, o gatilho le a ponte direto e nao ha nada a dizer por fora.
--
-- `p_responsaveis` E `p_prazos` VALEM NA PRIMEIRA CHAMADA, e o mes aberto em
-- duas vezes so acrescenta posts. Antes era diferente por acidente: cada post
-- novo ganhava uma corrente nova, e os dois mapas eram aplicados a ela. Agora
-- as etapas existem, com dono e periodo que alguem pode ter ajustado --
-- reescreve-los na segunda chamada desfaria a distribuicao por causa de um
-- "abrir mais tres posts". E a ordem de `coalesce(etapa, padrao)` da 0041.
-- ---------------------------------------------------------------------------

create or replace function public.abrir_mes_de_social(
  p_client_id     uuid,
  p_mes           text,
  p_quantidades   jsonb,
  p_responsavel_id uuid default null,
  p_responsaveis  jsonb default '{}'::jsonb,
  p_prazos        jsonb default '{}'::jsonb,
  p_link_entrega  text default null,
  p_flow_id       uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  linha     jsonb;
  redes     public.plataforma_social[];
  quantos   integer;
  i         integer;
  criados   integer := 0;
  total     integer := 0;
  primeiro  date;
  ultimo    date;
  empresa   text;
  novo      uuid;
  chave     text;
  par       jsonb;
  comeca    date;
  termina   date;
  anterior  date;
  etapa     record;
  demanda   uuid;
  etiqueta  text;
  nome      text;
  fluxo     uuid;
  nomes     text;
  quem      uuid;
  nova_sub  uuid;
  elo_antes uuid;
  meses     text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
begin
  -- O ATENDIMENTO ABRE O MES (0046): a mesma funcao que `tasks_insert` usa
  -- desde a 0006, e nao uma parecida.
  if not public.is_atendimento() then
    raise exception using
      errcode = 'check_violation',
      -- A FRASE E A DA 0046, PALAVRA POR PALAVRA, e a bateria pegou quando eu
      -- a reescrevi: dois cenarios conferem o texto da recusa, e uma trava que
      -- recusa com outra frase e uma trava que ninguem sabe mais se é a mesma.
      message = 'Abrir o mês de social é do Atendimento, do desenvolvedor ou do sócio.',
      hint    = 'Quem produz recebe os posts; quem os abre é quem responde pelo contrato.';
  end if;

  begin
    primeiro := to_date(p_mes || '-01', 'YYYY-MM-DD');
  exception when others then
    raise exception using
      errcode = 'check_violation',
      message = 'O mês precisa estar no formato AAAA-MM.';
  end;

  ultimo := (primeiro + interval '1 month' - interval '1 day')::date;

  select c.nome_empresa into empresa from public.clients c where c.id = p_client_id;
  if empresa is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Cliente não encontrado.';
  end if;

  -- QUAL FLUXO ESTE MES PERCORRE (0087). A ORDEM E MES EXISTENTE -> ESCOLHA DO
  -- DIALOGO -> PADRAO DA CONTA -> CASA. O mes que JA existe vem primeiro, e ele
  -- e a razao de `tasks.social_flow_id` existir: sem esta leitura a segunda
  -- chamada poderia usar outro fluxo, e o mes ficaria com duas correntes
  -- dentro.
  select t.social_flow_id into fluxo
    from public.tasks t
   where t.client_id = p_client_id
     and t.social_do_mes = primeiro
     and t.social_flow_id is not null;

  if fluxo is null then
    fluxo := public.fluxo_do_mes(p_client_id, p_flow_id);
  end if;

  if fluxo is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Não há fluxo de social ativo para abrir o mês.',
      hint    = 'Monte um fluxo em Social Media, na aba Fluxos: ele é a corrente de etapas que os posts do mês percorrem.';
  end if;

  select string_agg(e.nome, ', ' order by e.ordem) into nomes
    from public.etapas_do_fluxo(fluxo) e;

  -- FLUXO VAZIO E RECUSADO AQUI, e nao pela trava da 0087, que o deixa passar
  -- de proposito -- um fluxo sem etapa e o estado de quem esta montando. O que
  -- ele nao pode e abrir um mes: os posts nasceriam sem corrente e nunca
  -- chegariam ao cliente.
  if nomes is null then
    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo escolhido não tem etapa nenhuma.',
      hint    = 'Monte a corrente dele antes de abrir o mês — sem etapas, os posts nascem sem trabalho e sem caminho até o cliente.';
  end if;

  -- A FORMA NOVA E UMA LISTA (0082), e a recusa diz isso em vez de estourar
  -- dentro de um `jsonb_array_elements` com uma mensagem sobre tipo de jsonb.
  if p_quantidades is null or jsonb_typeof(p_quantidades) <> 'array' then
    raise exception using
      errcode = 'check_violation',
      message = 'As quantidades vêm como uma lista de combinações de redes.',
      hint    = 'Cada linha é {"redes": ["instagram","facebook"], "quantidade": 12}.';
  end if;

  -- OS PERIODOS SAO CONFERIDOS ANTES DE ABRIR POST NENHUM. A funcao e
  -- transacional, entao recusar no meio tambem desfaria tudo -- mas a mensagem
  -- sairia depois de sessenta inserts, e o custo de conferir cinco periodos
  -- primeiro e zero.
  for chave, par in select key, value from jsonb_each(p_prazos)
  loop
    -- A DICA NOMEIA AS ETAPAS DO FLUXO ESCOLHIDO, e nao as cinco da casa
    -- escritas a mao (0087): com a cadeia editavel, uma lista fixa aqui
    -- mandaria a pessoa procurar "Pauta" num fluxo que nao tem nenhuma.
    if not exists (select 1 from public.etapas_do_fluxo(fluxo) e where e.nome = chave) then
      raise exception using
        errcode = 'check_violation',
        message = format('O fluxo deste mês não tem etapa chamada "%s".', chave),
        hint    = format('As etapas dele são %s.', nomes);
    end if;

    -- A FORMA DA 0083 -- uma data solta -- E RECUSADA COM FRASE PROPRIA, e nao
    -- aceita como "so o fim": quem cair aqui esta mandando a forma antiga, e um
    -- mes aberto com a corrente sem inicio nenhum nao da erro em lugar nenhum
    -- -- some na carga de quem produz, que e onde ninguem procura.
    if jsonb_typeof(par) <> 'object' then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" precisa do período, e não de uma data só.', chave),
        hint    = 'Cada etapa é {"inicio": "AAAA-MM-DD", "fim": "AAAA-MM-DD"} — as duas pontas, e as duas valem para o mês inteiro.';
    end if;

    begin
      comeca  := nullif(btrim(coalesce(par ->> 'inicio', '')), '')::date;
      termina := nullif(btrim(coalesce(par ->> 'fim', '')), '')::date;
    exception when others then
      raise exception using
        errcode = 'check_violation',
        message = format('As datas da etapa "%s" precisam estar no formato AAAA-MM-DD.', chave);
    end;

    -- PERIODO INVERTIDO NAO E PERIODO, e a funcao recusa antes do `check` de
    -- `subtasks_periodo` para a mensagem nomear a ETAPA -- aquele check nao diz
    -- qual das cinco esta trocada.
    if comeca is not null and termina is not null and comeca > termina then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" terminaria antes de começar.', chave),
        hint    = 'O início vem antes do fim — confira se os dois campos não estão trocados.';
    end if;
  end loop;

  -- A CORRENTE NAO PODE VENCER DE TRAS PARA A FRENTE, e quem responde e o FIM
  -- de cada etapa: e ele que define atraso (0027), e e por ele que a corrente
  -- recusa comecar o Layout antes de o Conteudo fechar. Comparar os inicios
  -- recusaria o normal -- o Layout comeca enquanto o Conteudo ainda corre, e
  -- isso e trabalho em paralelo, nao erro.
  anterior := null;
  for etapa in select e.ordem, e.nome from public.etapas_do_fluxo(fluxo) e order by e.ordem
  loop
    termina := nullif(btrim(coalesce(p_prazos -> etapa.nome ->> 'fim', '')), '')::date;
    if termina is not null then
      if anterior is not null and termina < anterior then
        raise exception using
          errcode = 'check_violation',
          message = format('"%s" venceria antes da etapa anterior da corrente.', etapa.nome),
          hint    = format('A ordem deste fluxo é %s — os dias precisam andar na mesma direção.', nomes);
      end if;
      anterior := termina;
    end if;
  end loop;

  -- AS LINHAS SAO CONFERIDAS INTEIRAS ANTES DE ABRIR POST NENHUM, pela mesma
  -- razao dos periodos.
  for linha in select * from jsonb_array_elements(p_quantidades)
  loop
    quantos := coalesce((linha ->> 'quantidade')::integer, 0);

    if quantos < 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'Quantidade negativa não abre post nenhum.';
    end if;

    -- UMA LINHA SEM REDE NENHUMA E RECUSADA, e nao ignorada: ignora-la faria o
    -- dialogo prometer doze posts e a funcao devolver zero, sem dizer por que.
    if quantos > 0 and jsonb_array_length(coalesce(linha -> 'redes', '[]'::jsonb)) = 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'Escolha ao menos uma rede para cada linha.',
        hint    = 'Uma linha com quantidade e sem rede abriria posts que não vão a lugar nenhum.';
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

  -- ------------------------------------------------------------------------
  -- A DEMANDA DO MES: achada ou criada, nunca duplicada
  --
  -- Quem garante a unicidade e o indice `tasks_social_do_mes_unico`, e nao
  -- este `select`: duas abas clicando ao mesmo tempo passam pelas duas
  -- consultas, e a segunda leva a recusa do indice. E a decisao da 0040.
  -- ------------------------------------------------------------------------
  select t.id into demanda
    from public.tasks t
   where t.client_id = p_client_id
     and t.social_do_mes = primeiro;

  if demanda is null then
    if p_link_entrega is null or btrim(p_link_entrega) = '' then
      raise exception using
        errcode = 'check_violation',
        message = 'A demanda do mês precisa da pasta de entrega.',
        hint    = 'O mês de social é uma demanda só, com uma etapa por fase do fluxo — e toda demanda precisa da pasta onde o material vai ficar. O botão "Criar no Drive" cria a do mês.';
    end if;

    etiqueta := format('Social · %s/%s de %s',
                       meses[extract(month from primeiro)::integer],
                       extract(year from primeiro)::integer,
                       empresa);

    -- NASCE PUBLICADA, e nao como rascunho: rascunho e de quem o criou, e
    -- esconderia da equipe as etapas que ela acabou de distribuir (0051).
    insert into public.tasks (
      client_id, titulo, data_inicio, data_fim, link_entrega,
      social_do_mes, social_flow_id, criado_por, publicada_em
    ) values (
      p_client_id, etiqueta, primeiro, ultimo, btrim(p_link_entrega),
      primeiro, fluxo, (select auth.uid()), now()
    )
    returning id into demanda;
  end if;

  -- ------------------------------------------------------------------------
  -- AS ETAPAS DO MES, UMA POR ELO DO FLUXO
  --
  -- Elas nascem UMA VEZ, na primeira chamada. A segunda acrescenta posts, e as
  -- etapas que ja estao la ficam como estao -- com o dono e o periodo que
  -- alguem pode ter ajustado.
  -- ------------------------------------------------------------------------
  if not exists (select 1 from public.etapas_do_mes(demanda)) then
    elo_antes := null;

    for etapa in select * from public.etapas_do_fluxo(fluxo) order by ordem
    loop
      quem := nullif(p_responsaveis ->> (etapa.funcao::text), '')::uuid;

      insert into public.subtasks (
        task_id, titulo, ordem, responsavel_id,
        data_inicio, prazo,
        social_papel, social_campo, social_portao,
        -- FUNCAO SEM DONO AVISA, NUNCA RECUSA (0064), e a frase NOMEIA a
        -- funcao que faltou -- "ha etapa sem responsavel" manda abrir uma por
        -- uma. Travar a abertura do mes por causa de um cadastro deixaria o
        -- cliente sem entrega.
        aviso_geracao
      ) values (
        demanda, etapa.nome, etapa.ordem, quem,
        nullif(btrim(coalesce(p_prazos -> etapa.nome ->> 'inicio', '')), '')::date,
        nullif(btrim(coalesce(p_prazos -> etapa.nome ->> 'fim', '')), '')::date,
        etapa.papel, etapa.campo, etapa.aprovacao_cliente,
        case when quem is null
             then format('Esta etapa é do %s, e a conta não tem ninguém nessa função.', etapa.funcao)
             else null end
      )
      returning id into nova_sub;

      -- A CORRENTE E DEPENDENCIA DE VERDADE, e nao mais a ordem de uma tabela
      -- propria: `validar_transicao_de_subtarefa` (0007) recusa sair de
      -- `nao_iniciada` com dependencia em aberto, e a tela mostra o cadeado
      -- com o que esta faltando. Era isso que `post_etapas_regras` reimplementava.
      if elo_antes is not null then
        insert into public.subtask_dependencies (subtask_id, depende_de_id)
        values (nova_sub, elo_antes)
        on conflict (subtask_id, depende_de_id) do nothing;
      end if;

      elo_antes := nova_sub;
    end loop;
  end if;

  -- ------------------------------------------------------------------------
  -- OS POSTS. A caixinha de cada um nasce pelo gatilho `posts_entra_no_mes`.
  -- ------------------------------------------------------------------------
  for linha in select * from jsonb_array_elements(p_quantidades)
  loop
    quantos := coalesce((linha ->> 'quantidade')::integer, 0);
    continue when quantos = 0;

    -- `distinct` NA LEITURA (0082): a linha vem de um dialogo em que a pessoa
    -- marca caixas, e a trava da tabela fica para quem monta a chamada a mao.
    select array_agg(distinct r::public.plataforma_social order by r::public.plataforma_social)
      into redes
      from jsonb_array_elements_text(linha -> 'redes') as t(r);

    -- O NOME DA COMBINACAO sai das redes, por extenso e na ORDEM DO ENUM
    -- (0082): alfabeticamente o Facebook viria antes do Instagram.
    select string_agg(initcap(r::text), ' + ' order by r)
      into nome
      from unnest(redes) as t(r);

    for i in 1..quantos loop
      insert into public.posts (
        client_id, tema, data_publicacao, plataformas, midia,
        criado_por, responsavel_id, social_task_id
      ) values (
        p_client_id,
        format('%s %s de %s · %s/%s', nome, i, quantos,
               meses[extract(month from primeiro)::integer],
               extract(year from primeiro)::integer),
        null,
        redes,
        'imagem',
        (select auth.uid()),
        p_responsavel_id,
        demanda
      )
      returning id into novo;

      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$fn$;

comment on function public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb, jsonb, text, uuid) is
  'Abre o mes de social de um cliente (0088): UMA demanda, UMA etapa por elo do '
  'fluxo escolhido -- encadeadas por dependencia --, e um post por linha de '
  'combinacao (0082), com a caixinha de cada post em cada etapa. `p_prazos` e '
  '{"Pauta": {"inicio": "2026-10-01", "fim": "2026-10-05"}, ...}, por nome de '
  'etapa do fluxo, e vale para o mes inteiro (0084).';


-- ---------------------------------------------------------------------------
-- PASSO 15 - QUEM GANHA UMA ETAPA DO MES RECEBE O AVISO
--
-- A 0045 tinha `post_etapas_avisa`, e ele sai com a tabela. O aviso NAO pode
-- sair com ele: a demanda do mes nasce publicada (0051), e quem publica uma
-- task comum avisa os responsaveis pela action -- a abertura do mes nao passa
-- por aquela action, entao sem este gatilho o redator descobre que a etapa e
-- dele abrindo o Minhas Tasks por acaso.
--
-- E e GATILHO e nao action, pela razao da auditoria (0058): a etapa ganha dono
-- por tres caminhos -- a abertura do mes, a distribuicao da gestao, e a troca
-- de responsavel quando alguem sai -- e o aviso escrito na camada de aplicacao
-- cobre o que passou pela tela.
--
-- As tres recusas de `notificar()` nao se repetem aqui: quem causou o aviso nao
-- recebe, quem saiu nao recebe, e avisar ninguem devolve `null` sem derrubar a
-- escrita (0062).
-- ---------------------------------------------------------------------------

create or replace function public.subtasks_avisa_dono_da_etapa_do_mes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mes text;
begin
  if new.social_papel is null or new.responsavel_id is null then
    return null;
  end if;

  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    return null;
  end if;

  select t.titulo into mes from public.tasks t where t.id = new.task_id;

  perform public.notificar(
    new.responsavel_id, 'task',
    format('%s · %s', coalesce(mes, 'Social'), new.titulo),
    'Uma etapa do mês de social é sua.',
    '/painel/minhas-tasks'
  );

  return null;
end;
$$;

drop trigger if exists subtasks_avisa_dono_da_etapa_do_mes on public.subtasks;
create trigger subtasks_avisa_dono_da_etapa_do_mes
  after insert or update of responsavel_id on public.subtasks
  for each row execute function public.subtasks_avisa_dono_da_etapa_do_mes();

comment on function public.subtasks_avisa_dono_da_etapa_do_mes() is
  'Avisa quem ganhou uma etapa de mes de social (0088). Substitui `post_etapas_avisa` da 0045, que saiu com a tabela.';


-- ---------------------------------------------------------------------------
-- PASSO 16 - A CONVERSAO DOS MESES QUE JA ESTAO ABERTOS
--
-- *"Rode isso em migration, e relate quantos planos e posts foram migrados."*
--
-- A ORDEM AQUI E O QUE FAZ A CONVERSAO FUNCIONAR, e cada passo depende do
-- anterior:
--
--   1. as ETAPAS nascem primeiro, do fluxo daquele mes;
--   2. `posts.social_task_id` e escrito pela ponte VELHA
--      (`posts.subtask_id -> subtasks.task_id`) -- e o gatilho
--      `posts_entra_no_mes` cria as caixinhas no mesmo instante, desmarcadas;
--   3. as caixinhas sao marcadas a partir do que a corrente antiga dizia;
--   4. as subtarefas antigas de post saem, e os posts ficam.
--
-- Inverter 2 e 1 daria dezoito posts sem caixinha nenhuma; inverter 4 e 2
-- apagaria a ponte velha antes de ela ser lida, e os posts ficariam sem mes --
-- que e o furo que a 0086 existiu para fechar, aqui em forma de conversao.
--
-- O RESPONSAVEL E O PERIODO DE CADA ETAPA SAEM DA MODA das correntes antigas,
-- e a 0084 os gravava iguais em todos os posts -- entao a moda e o valor. Onde
-- divergirem, a divergencia e ANOTADA em `aviso_geracao` em vez de escolhida
-- em silencio: perder o aviso seria perder a unica pista de que alguem precisa
-- olhar aquele mes.
--
-- A ETAPA "Ajustes" DAS CORRENTES ANTIGAS NAO VIAJA, e e dito em vez de
-- escondido: ela nao tem par no modelo novo -- um pedido do cliente sobre um
-- post nao e uma etapa do mes. O que fica e o MOTIVO, que mora na rodada, e
-- que `posts_corrente_do_cliente` passa a copiar para `observacao`.
--
-- `auth.uid()` E NULO AQUI, entao as travas da caixinha nao se aplicam -- e a
-- mesma isencao do seed (0045), e e ela que permite marcar o meio da corrente
-- sem percorre-la.
-- ---------------------------------------------------------------------------

do $$
declare
  t         record;
  e         record;
  fluxo     uuid;
  nova_sub  uuid;
  elo_antes uuid;
  quem      uuid;
  quantos_d integer;
  ini       date;
  fim       date;
  divergiu  boolean;
  meses     integer := 0;
  posts     integer := 0;
begin
  -- Se a tabela antiga nao existe, esta migration ja rodou neste banco.
  if to_regclass('public.post_etapas') is null then
    raise notice 'Conversao do 3J: `post_etapas` nao existe, nada a converter.';
    return;
  end if;

  for t in
    select tk.id, tk.client_id, tk.social_flow_id
      from public.tasks tk
     where tk.social_do_mes is not null
     order by tk.social_do_mes
  loop
    -- Mes que ja tem etapa de fase foi convertido numa passada anterior.
    if exists (
      select 1 from public.subtasks s
       where s.task_id = t.id and s.social_papel is not null
    ) then
      continue;
    end if;

    fluxo := coalesce(t.social_flow_id, public.fluxo_do_mes(t.client_id));
    if fluxo is null then
      raise notice 'Conversao do 3J: o mes % ficou sem fluxo e nao foi convertido.', t.id;
      continue;
    end if;

    -- 1. AS ETAPAS, do fluxo daquele mes.
    elo_antes := null;

    for e in select * from public.etapas_do_fluxo(fluxo) order by ordem
    loop
      select mode() within group (order by pe.responsavel_id),
             mode() within group (order by pe.data_inicio),
             mode() within group (order by pe.prazo),
             count(distinct pe.responsavel_id) > 1
        into quem, ini, fim, divergiu
        from public.post_etapas pe
        join public.posts p on p.id = pe.post_id
        join public.subtasks s on s.id = p.subtask_id
       where s.task_id = t.id
         and pe.nome = e.nome;

      insert into public.subtasks (
        task_id, titulo, ordem, responsavel_id, data_inicio, prazo,
        social_papel, social_campo, social_portao, aviso_geracao
      ) values (
        t.id, e.nome, e.ordem, quem, ini, fim,
        e.papel, e.campo, e.aprovacao_cliente,
        case
          when coalesce(divergiu, false)
            then 'Antes do mês virar etapas, esta fase tinha responsáveis diferentes em posts diferentes. Ficou com o mais comum — confira.'
          when quem is null
            then format('Esta etapa é do %s, e a conta não tem ninguém nessa função.', e.funcao)
          else null
        end
      )
      returning id into nova_sub;

      if elo_antes is not null then
        insert into public.subtask_dependencies (subtask_id, depende_de_id)
        values (nova_sub, elo_antes)
        on conflict (subtask_id, depende_de_id) do nothing;
      end if;

      elo_antes := nova_sub;
    end loop;

    -- 2. A PONTE NOVA, lida pela VELHA. O gatilho cria as caixinhas aqui.
    update public.posts p
       set social_task_id = t.id
     where p.social_task_id is null
       and p.subtask_id in (select s.id from public.subtasks s where s.task_id = t.id);

    select count(*) into quantos_d from public.posts p where p.social_task_id = t.id;
    posts := posts + quantos_d;

    -- 3. O QUE A CORRENTE ANTIGA DIZIA CONCLUIDO.
    update public.post_etapa_progresso g
       set concluido = true, concluido_em = pe.concluida_em
      from public.post_etapas pe
      join public.subtasks nova on nova.task_id = t.id and nova.titulo = pe.nome
                               and nova.social_papel is not null
     where g.post_id = pe.post_id
       and g.subtask_id = nova.id
       and pe.status = 'concluida'
       and not g.concluido;

    -- 4. AS SUBTAREFAS ANTIGAS DE POST SAEM, E OS POSTS FICAM.
    --
    -- `posts.subtask_id` e `on delete set null`, entao apagar a subtarefa
    -- desliga a ponte velha sem tocar no post -- que e exatamente o que o
    -- sprint pede ("apague as subtarefas antigas de post, mantendo os
    -- registros em posts intactos").
    delete from public.subtasks s
     where s.task_id = t.id
       and s.social_papel is null
       and exists (select 1 from public.posts p where p.subtask_id = s.id);

    meses := meses + 1;
  end loop;

  raise notice 'Conversao do 3J: % mes(es) de social convertidos, % post(s) ligados a demanda.', meses, posts;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 17 - O QUE O DIALOGO DE APAGAR CONTA
--
-- `o_que_vai_com_o_mes()` contava `post_etapas`, e o que existe no lugar sao
-- DUAS coisas diferentes: as etapas do mes (cinco) e as marcacoes de progresso
-- (uma por post x etapa). O sprint pede as duas na frase do dialogo --
-- *"1 task e 5 subtarefas · 23 marcacoes de progresso"* --, e juntar as duas
-- num numero so daria "noventa etapas" num mes de cinco.
--
-- O `drop` E OBRIGATORIO: `create or replace` nao troca o tipo de retorno de
-- uma funcao `returns table`, e acrescentar uma coluna troca.
-- ---------------------------------------------------------------------------

drop function if exists public.o_que_vai_com_o_mes(uuid);

create or replace function public.o_que_vai_com_o_mes(p_task_id uuid)
returns table (
  posts          integer,
  enviados       integer,
  aprovados      integer,
  versoes        integer,
  etapas         integer,
  marcacoes      integer,
  comentarios    integer
)
language plpgsql
security invoker
stable
set search_path = public
as $$
begin
  return query
  with p as (select * from public.posts_do_mes(p_task_id))
  select
    (select count(*) from p)::integer,
    (select count(*) from p where p.enviado_em is not null)::integer,
    (select count(*) from p where p.status = 'aprovado')::integer,
    (select count(*) from public.post_versions v where v.post_id in (select id from p))::integer,
    (select count(*) from public.subtasks s
      where s.task_id = p_task_id and s.social_papel is not null)::integer,
    (select count(*) from public.post_etapa_progresso g
      where g.post_id in (select id from p))::integer,
    -- `comments` e POLIMORFICA desde a 0030: ela aponta por
    -- `(content_type, content_id)` e nao tem chave estrangeira, porque o alvo
    -- muda conforme o tipo. Quem a limpa ao apagar um post e o trigger
    -- `posts_limpa_conteudo` (0032), e por isso a contagem tem que perguntar
    -- do mesmo jeito que ele apaga.
    (select count(*) from public.comments c
      where c.content_type = 'post' and c.content_id in (select id from p))::integer;
end;
$$;

comment on function public.o_que_vai_com_o_mes(uuid) is
  'O que sai junto ao apagar um mes de social (0086), para o dialogo contar antes em vez de perguntar "tem certeza?". Desde a 0088 conta as ETAPAS do mes e as MARCACOES separadas: juntas dariam "noventa etapas" num mes de cinco.';

revoke all on function public.o_que_vai_com_o_mes(uuid) from public, anon;
grant execute on function public.o_que_vai_com_o_mes(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 18 - O RELOGIO VOLTA A CORRER NA ETAPA DO SOCIAL
--
-- Reconstruida a partir da versao da 0061 -- a MAIS NOVA --, e a unica
-- diferenca e o `or` do bloco do fim. `create or replace function` reescreve a
-- partir do que se digita e o que nao for copiado se perde: foi assim que a
-- 0030 perdeu o bloco de carimbos da 0007 e nenhuma subtarefa teve
-- `concluida_em` por duas migrations, sem ninguem notar.
--
-- E ISTO E METADE DO QUE O 3J ENTREGA: com a etapa do mes sendo subtarefa de
-- verdade, o cronometro dela corre, o tempo real dela se declara ao concluir, e
-- `disponibilidade_bruta()` (0081) passa a ver o dia em que a redatora escreve
-- doze legendas -- que era um dia VAZIO na Linha do Tempo e na faixa de
-- disponibilidade, porque aquela funcao le `subtasks` e nunca leu `post_etapas`.
-- ---------------------------------------------------------------------------
create or replace function public.subtasks_cronometro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  estava_andando boolean;
  vai_andar      boolean;
  base           integer;
  desde          timestamptz;
begin
  vai_andar := new.status = 'em_andamento';

  if tg_op = 'INSERT' then
    estava_andando := false;
    base           := 0;
    desde          := null;
  else
    estava_andando := old.status = 'em_andamento';
    base           := coalesce(old.tempo_medido_segundos, 0);
    desde          := old.andando_desde;
  end if;

  if estava_andando and not vai_andar then
    if desde is not null then
      base := base + greatest(0, floor(extract(epoch from (now() - desde)))::integer);
    end if;
    desde := null;
  elsif vai_andar and not estava_andando then
    desde := now();
  elsif vai_andar then
    desde := coalesce(desde, now());
  end if;

  -- A agrupadora nao tem relogio proprio. Fecha a passagem que estiver aberta
  -- -- a etapa que ganhou a primeira sub-etapa no meio do trabalho nao perde o
  -- que ja tinha medido, so para de contar daqui.
  --
  -- E A METADE DA 0061 SAIU COM A SUBTAREFA DE POST (0088). Ela existia porque
  -- a linha do post entrava em `em_andamento` pelo mirror da corrente e ficava
  -- andando o mes inteiro -- "720h" numa etapa em que ninguem trabalhou. Nao
  -- ha mais linha de post: a etapa do mes e trabalho de gente, e o relogio
  -- dela corre como o de qualquer subtarefa, que e o ponto do 3J.
  if tg_op = 'UPDATE' and public.subtask_eh_agrupadora(new.id) then
    if desde is not null then
      base := base + greatest(0, floor(extract(epoch from (now() - desde)))::integer);
      desde := null;
    end if;
  end if;

  new.tempo_medido_segundos := base;
  new.andando_desde         := desde;

  return new;
end;
$$;

drop trigger if exists subtasks_cronometro on public.subtasks;
create trigger subtasks_cronometro
  before insert or update on public.subtasks
  for each row execute function public.subtasks_cronometro();

comment on function public.subtasks_cronometro() is
  'O relogio da subtarefa (0021). A agrupadora nao tem relogio proprio; a subtarefa de POST tinha a mesma isencao ate a 0088, e saiu com ela.';


-- ---------------------------------------------------------------------------
-- PASSO 19 - O CALENDARIO FULL PERDE A SEXTA ORIGEM
--
-- A frase do usuario que fechou o 3J: *"a corrente do social vive so em minhas
-- tasks e na carga"*. E a decisao da 0077 aplicada ao que faltava -- ela tirou
-- a demanda e a etapa *"porque elas vivem em Minhas Tasks"*, e a etapa de post
-- e uma etapa.
--
-- ELA SAI DA VIEW E NAO SO DA LISTA DE CAMADAS, que e a linha que a 0077
-- escreveu e que impede a volta: uma camada e um interruptor, e tirar o
-- interruptor deixando a origem produzindo esconde as linhas desta tela e as
-- entrega de graca ao proximo consumidor da view -- a exportacao, um
-- relatorio, uma tela nova. E ela tinha de sair de qualquer forma: a tabela de
-- origem esta sendo apagada no passo seguinte, e a view e uma dependencia de
-- verdade dela.
--
-- `security_invoker = true` E REPETIDO, e esta e a QUARTA vez: `create or
-- replace view` NAO o herda. Sem a clausula a view volta a rodar com os
-- direitos de quem a criou -- o superusuario da migration -- e le as tabelas
-- de origem inteiras para qualquer pessoa autenticada, num objeto que o
-- PostgREST publica sozinho. E o furo passa despercebido num banco com um
-- cliente so: ele ve seis campanhas, que e o total.
--
-- O QUE A LINHA DO TEMPO NAO PERDE E A CARGA, e e o que faz a remocao caber --
-- a frase e da 0077 e vale mais aqui que la: a cor da celula sai de
-- `carga_da_equipe()` chamando `carga_do_dia()`, que leem `subtasks` direto. E
-- com a etapa do mes virando subtarefa, o peso do social PASSA A EXISTIR nela
-- -- a camada que sai nunca o carregou.
-- ---------------------------------------------------------------------------
create or replace view public.calendar_events
with (security_invoker = true) as

  -- 1. QUEM ESTA FORA, e so o que foi combinado.
  --
  -- Pedido pendente NAO entra: ele ainda pode ser remarcado, e pintar o
  -- calendario da agencia com um periodo que o socio nem respondeu faria a
  -- equipe planejar em cima de uma ausencia que talvez nao aconteca.
  --
  -- ELA PASSOU A SER A PRIMEIRA, e por isso carrega os nomes das colunas.
  select
    h.id                                   as id,
    'ausencia'::text                       as tipo,
    h.tipo::text                           as titulo,
    h.data_inicio                          as data_inicio,
    h.data_fim                             as data_fim,
    null::uuid                             as client_id,
    h.user_id                              as user_id,
    null::text                             as prioridade,
    h.status::text                         as status,
    '/painel/full-days'                    as link
  from public.hr_requests h
  where h.status = 'aprovada'

  union all

  -- 2. O QUE ACONTECE.
  select
    e.id,
    'evento',
    e.nome,
    e.data_inicio,
    e.data_fim,
    e.client_id,
    null::uuid,
    null::text,
    e.tipo::text,
    '/painel/calendario?evento=' || e.id
  from public.events e

  union all

  -- 3. O POST, no dia em que vai ao ar.
  --
  -- Post sem data nao entra -- e estado de verdade do trabalho desde a 0044,
  -- e ele vive na faixa "Sem data ainda" da tela de Social Media. Inventar um
  -- dia aqui para ele aparecer seria o calendario afirmando uma data que
  -- ninguem escolheu.
  select
    p.id,
    'post',
    p.tema,
    p.data_publicacao,
    p.data_publicacao,
    p.client_id,
    p.responsavel_id,
    null::text,
    p.status::text,
    '/painel/social-media?post=' || p.id
  from public.posts p
  where p.data_publicacao is not null

  union all

  -- 4. A CAMPANHA, com o periodo inteiro.
  --
  -- A VIEW CARREGA A VERDADE; quem decide como desenhar e a tela. Na grade do
  -- mes a campanha aparece no ENCERRAMENTO, porque uma Wave de trinta dias
  -- pintaria trinta celulas e empurraria para baixo tudo o que acontece em
  -- cada uma. Na Linha do Tempo ela e a barra longa. Os dois desenhos saem da
  -- mesma linha, e e `diaNaGrade()` em `lib/dominio/calendario.ts` que
  -- escolhe -- um lugar so.
  select
    c.id,
    'campanha',
    c.nome,
    c.data_inicio,
    c.data_fim,
    c.client_id,
    null::uuid,
    null::text,
    c.status::text,
    '/painel/aprovacoes/campanhas/' || c.id
  from public.campaigns c

  union all

  -- 5. A PECA DA CAMPANHA, no prazo dela.
  --
  -- So as FOLHAS: o grupo e uma linha na tela e quinze entregas no trabalho, e
  -- conta-lo tambem faria "16 de 16" onde ha quinze coisas.
  --
  -- ELA FICA, e a peca de campanha E uma subtarefa desde a 0051 -- o que
  -- parece contradizer a remocao das etapas e nao contradiz: o que sai e a
  -- camada que lista TODA etapa de TODA demanda da agencia, que e a pauta
  -- pessoal de cada um. O entregavel e a PECA que o cliente vai decidir, com
  -- data combinada na campanha, e e por isso que ele tem camada propria desde
  -- a 0055 em vez de vir pela de etapa.
  select
    d.id,
    'entregavel',
    d.nome,
    d.prazo,
    d.prazo,
    c.client_id,
    d.responsavel_id,
    null::text,
    d.status::text,
    '/painel/aprovacoes/campanhas/' || d.campaign_id || '?item=' || d.id
  from public.deliverables d
  join public.campaigns c on c.id = d.campaign_id
  where d.prazo is not null
    and not exists (
      select 1 from public.deliverables f where f.parent_id = d.id
    );

comment on view public.calendar_events is
  'As CINCO origens do Calendário Full num formato só: ausência, evento, post, '
  'campanha e entregável. A demanda e a etapa saíram na 0077 e a etapa de post '
  'na 0088, pela mesma decisão do usuário: elas vivem em Minhas Tasks e na '
  'carga. security_invoker = true: a RLS de cada tabela de origem continua valendo.';


-- ---------------------------------------------------------------------------
-- PASSO 20 - A BUSCA GLOBAL PARA DE EXCLUIR A ETAPA DO SOCIAL
--
-- `busca_global()` (0073) filtrava `and not public.subtarefa_de_post(s.id)` no
-- ramo de etapa, e a razao esta escrita la: *"ela carrega o tema do post como
-- titulo, e o post tem ramo proprio -- sem essa linha, buscar o tema devolveria
-- duas linhas para o mesmo trabalho"*.
--
-- O FILTRO SAI PORQUE O QUE ELE EXCLUIA NAO EXISTE MAIS, e nao porque a regra
-- mudou: a etapa do mes se chama "Pauta", nao o tema do post, entao ela nao
-- duplica nada -- ela e um trabalho de verdade, com dono e prazo, e a pessoa
-- que a procura pelo nome tem o mesmo direito de achar que tem numa demanda
-- comum.
--
-- E ELE TINHA DE SAIR DE QUALQUER FORMA: `subtarefa_de_post()` esta sendo
-- apagada no passo seguinte, e o corpo de uma funcao `plpgsql` nao e
-- dependencia -- a busca continuaria compilando e estouraria na primeira
-- tecla, com um erro sobre funcao inexistente na topbar de todo mundo.
--
-- `continua NAO sendo security definer`, que e a linha mais importante da
-- 0073: a RLS das nove tabelas e quem decide o que cada perfil acha.
-- ---------------------------------------------------------------------------

create or replace function public.busca_global(
  p_termo text,
  p_limite integer default 6
)
returns table (
  tipo text,
  id uuid,
  titulo text,
  contexto text,
  caminho text,
  selo text,
  posicao integer,
  total bigint
)
language plpgsql
stable
as $func$
declare
  v_termo text := public.sem_acento(p_termo);
  v_limite integer := greatest(1, least(coalesce(p_limite, 6), 20));
begin
  -- Termo curto devolve VAZIO e nao estoura: quem esta digitando passa pelo
  -- primeiro caractere sempre, e um erro ali seria um erro por tecla.
  if length(v_termo) < 2 then
    return;
  end if;

  return query

  -- DEMANDA. O rascunho ENTRA, e e decisao: a regra escrita diz que ele nao
  -- entra em lista, board, calendario, Minhas Tasks, contador, relatorio,
  -- notificacao nem portal -- e todos aqueles respondem "qual e o trabalho da
  -- agencia", onde um pensamento pela metade nao cabe. A busca responde outra
  -- pergunta: "onde esta a coisa que eu tenho em mente", e um rascunho e
  -- exatamente a coisa que ninguem acha. A RLS dele e RESTRITIVA desde a 0028,
  -- entao o que volta aqui e o meu e de mais ninguem -- nem do socio. O selo
  -- diz que ele ainda nao existe para a equipe.
  (
    select 'demanda'::text,
           t.id,
           t.titulo,
           c.nome_empresa,
           '/painel/gestao-tasks/' || t.id::text,
           case when t.publicada_em is null then 'Rascunho' end,
           strpos(public.sem_acento(t.titulo), v_termo)::integer,
           count(*) over ()
      from public.tasks t
      left join public.clients c on c.id = t.client_id
     where strpos(public.sem_acento(t.titulo), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- ETAPA, com a LINHAGEM que Minhas Tasks ja usa: `Cliente · Demanda`. O nome
  -- que a pessoa lembra costuma ser o da etapa ("Layout do carrossel"), e nao
  -- o da demanda -- e sem o contexto duas etapas homonimas de dois clientes
  -- sao a mesma linha duas vezes.
  (
    select 'etapa'::text,
           s.id,
           s.titulo,
           coalesce(c.nome_empresa || ' · ', '') || t.titulo,
           '/painel/gestao-tasks/' || t.id::text,
           case when t.publicada_em is null then 'Rascunho' end,
           strpos(public.sem_acento(s.titulo), v_termo)::integer,
           count(*) over ()
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
      left join public.clients c on c.id = t.client_id
     where strpos(public.sem_acento(s.titulo), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- CLIENTE, pelo nome da empresa OU pelo contato: "Joana" e um jeito legitimo
  -- de procurar a Mundo Verde, e e como a pessoa do Atendimento pensa. A
  -- posicao sai do campo que casou primeiro.
  (
    select 'cliente'::text,
           c.id,
           c.nome_empresa,
           c.nome_contato,
           '/painel/pessoas/clientes/' || c.id::text,
           case when not c.ativo then 'Desativado' end,
           least(
             coalesce(nullif(strpos(public.sem_acento(c.nome_empresa), v_termo), 0), 999),
             coalesce(nullif(strpos(public.sem_acento(c.nome_contato), v_termo), 0), 999)
           )::integer,
           count(*) over ()
      from public.clients c
     where strpos(public.sem_acento(c.nome_empresa), v_termo) > 0
        or strpos(public.sem_acento(c.nome_contato), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- PESSOA. `role <> 'cliente'` porque no Painel procurar uma pessoa quer
  -- dizer procurar um colega -- a pessoa do lado do cliente aparece na ficha
  -- da empresa dela, pelo ramo de cima.
  --
  -- E QUEM SAIU DA AGENCIA ENTRA, com o selo: achar quem fez uma coisa ano
  -- passado e uma das razoes de existir uma busca. O nome continua nos
  -- registros justamente para isso.
  (
    select 'pessoa'::text,
           p.id,
           p.nome,
           coalesce(tm.cargo, p.email),
           '/painel/pessoas/equipe/' || p.id::text,
           case when not p.ativo then 'Desligada' end,
           least(
             coalesce(nullif(strpos(public.sem_acento(p.nome), v_termo), 0), 999),
             coalesce(nullif(strpos(public.sem_acento(p.email), v_termo), 0), 999)
           )::integer,
           count(*) over ()
      from public.profiles p
      left join public.team_members tm on tm.user_id = p.id
     where p.role <> 'cliente'
       and (strpos(public.sem_acento(p.nome), v_termo) > 0
         or strpos(public.sem_acento(p.email), v_termo) > 0)
     order by 7, 3
     limit v_limite
  )

  union all

  -- CAMPANHA
  (
    select 'campanha'::text,
           k.id,
           k.nome,
           c.nome_empresa,
           '/painel/aprovacoes/campanhas/' || k.id::text,
           null::text,
           strpos(public.sem_acento(k.nome), v_termo)::integer,
           count(*) over ()
      from public.campaigns k
      left join public.clients c on c.id = k.client_id
     where strpos(public.sem_acento(k.nome), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- POST, pelo tema. O caminho abre o editor por `?post=`, que e a tela onde o
  -- card se preenche.
  (
    select 'post'::text,
           o.id,
           o.tema,
           coalesce(c.nome_empresa, '—')
             || coalesce(' · ' || to_char(o.data_publicacao, 'DD/MM/YYYY'), ''),
           '/painel/social-media?post=' || o.id::text,
           null::text,
           strpos(public.sem_acento(o.tema), v_termo)::integer,
           count(*) over ()
      from public.posts o
      left join public.clients c on c.id = o.client_id
     where strpos(public.sem_acento(o.tema), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- EQUIPAMENTO. Aqui o CODIGO e o NUMERO DE SERIE entram junto com o nome, e
  -- sao a razao pela qual este ramo existe: ninguem procura "Notebook" numa
  -- lista de dez notebooks -- procura "FCK-0002", que e o que esta na etiqueta.
  (
    select 'equipamento'::text,
           a.id,
           a.nome,
           a.codigo
             || coalesce(' · ' || nullif(trim(coalesce(a.marca, '') || ' ' || coalesce(a.modelo, '')), ''), ''),
           '/painel/comodatos/' || a.id::text,
           case when a.status = 'baixado' then 'Baixado' end,
           least(
             coalesce(nullif(strpos(public.sem_acento(a.nome), v_termo), 0), 999),
             coalesce(nullif(strpos(public.sem_acento(a.codigo), v_termo), 0), 999),
             coalesce(nullif(strpos(public.sem_acento(a.numero_serie), v_termo), 0), 999)
           )::integer,
           count(*) over ()
      from public.assets a
     where strpos(public.sem_acento(a.nome), v_termo) > 0
        or strpos(public.sem_acento(a.codigo), v_termo) > 0
        or strpos(public.sem_acento(a.numero_serie), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- PEDIDO DO CLIENTE
  (
    select 'pedido'::text,
           r.id,
           r.titulo,
           c.nome_empresa,
           '/painel/solicitacoes/' || r.id::text,
           null::text,
           strpos(public.sem_acento(r.titulo), v_termo)::integer,
           count(*) over ()
      from public.client_requests r
      left join public.clients c on c.id = r.client_id
     where strpos(public.sem_acento(r.titulo), v_termo) > 0
     order by 7, 3
     limit v_limite
  )

  union all

  -- TRILHA DA ACADEMY. A nao publicada so volta para a gestao, e quem decide
  -- isso e `academy_tracks_select` -- nao um filtro repetido aqui.
  (
    select 'trilha'::text,
           k.id,
           k.titulo,
           k.area,
           '/painel/academy/' || k.id::text,
           case when not k.publicada then 'Rascunho' end,
           strpos(public.sem_acento(k.titulo), v_termo)::integer,
           count(*) over ()
      from public.academy_tracks k
     where strpos(public.sem_acento(k.titulo), v_termo) > 0
     order by 7, 3
     limit v_limite
  );
end;
$func$;

comment on function public.busca_global(text, integer) is
  'A busca da topbar do Painel. NAO e security definer de proposito: a RLS das nove tabelas e quem decide o que cada perfil acha. Desde a 0088 a etapa do mes de social entra no ramo de etapa como qualquer outra -- o filtro da 0073 excluia a subtarefa por POST, que saiu com o modelo antigo.';


-- ---------------------------------------------------------------------------
-- PASSO 21 - O MODELO ANTIGO SAI INTEIRO
--
-- Apagar e nao aposentar, que e a decisao da 0023. Deixar `post_etapas` parada
-- com os gatilhos de pe seria pior que uma tabela morta: eles disparam a cada
-- escrita em `posts`, e o banco ficaria com DUAS correntes do mesmo trabalho
-- -- uma viva e uma fantasma --, que e exatamente o que esta migration existe
-- para desfazer.
--
-- A ORDEM IMPORTA, e e a pegadinha que a 0043 e a 0039 registraram: objeto
-- citado por outro nao sai enquanto quem o cita estiver de pe. Os gatilhos
-- primeiro, as funcoes depois, a tabela por ultimo -- e a view ja foi
-- reescrita no passo acima, porque ela e a unica dependencia DE VERDADE da
-- tabela (o corpo de uma funcao `plpgsql` nao e dependencia, e e por isso que
-- as quatro funcoes reescritas acima nao travaram nada).
-- ---------------------------------------------------------------------------

-- O gatilho que montava a corrente de cada post.
drop trigger if exists posts_monta_corrente on public.posts;
drop function if exists public.montar_etapas_do_post(uuid, jsonb);

-- O espelho da linha do post no board (0061).
drop trigger if exists posts_sincroniza_a_subtarefa on public.posts;
drop trigger if exists posts_apaga_a_subtarefa on public.posts;
drop function if exists public.posts_sincroniza_a_subtarefa();
drop function if exists public.recalcular_status_da_subtarefa_do_post(uuid);
drop function if exists public.subtarefa_de_post(uuid);

-- Os gatilhos da tabela saem com ela, e os `drop trigger` ficam de proposito:
-- numa segunda passada a tabela nao existe, e `drop trigger if exists ... on
-- public.post_etapas` para com "relation does not exist" em vez de nao fazer
-- nada. E por isso que eles vem dentro da guarda.
do $$
begin
  if to_regclass('public.post_etapas') is not null then
    drop trigger if exists post_etapas_regras on public.post_etapas;
    drop trigger if exists post_etapas_avisa on public.post_etapas;
    drop trigger if exists post_etapas_toca_a_subtarefa on public.post_etapas;
  end if;
end;
$$;

drop function if exists public.post_etapas_regras();
drop function if exists public.post_etapas_toca_a_subtarefa();
drop function if exists public.avisar_dono_da_etapa();

drop table if exists public.post_etapas;

-- E A PONTE VELHA. Ela nasceu na 0032 como a ligacao generica post ->
-- subtarefa, e o que ela guardava desde a 0061 era a linha do post no board.
-- Sem essa linha nao ha o que guardar, e a pergunta que o produto faz e outra:
-- de que MES este post e.
drop index if exists public.posts_subtask_idx;
alter table public.posts drop column if exists subtask_id;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------

select
  (select count(*) from public.subtasks where social_papel is not null) as etapas_de_mes,
  (select count(*) from public.post_etapa_progresso)                   as caixinhas,
  (select count(*) from public.post_etapa_progresso where concluido)   as caixinhas_feitas,
  (select count(*) from public.posts where social_task_id is not null) as posts_em_mes,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'posts'
      and column_name = 'subtask_id')                                  as ponte_antiga,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'post_etapas')      as tabela_antiga;
