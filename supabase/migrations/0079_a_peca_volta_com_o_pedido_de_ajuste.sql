-- ---------------------------------------------------------------------------
-- 0079 - A PECA DA CAMPANHA VOLTA PARA QUEM A PRODUZIU, E O SINO TOCA
--
-- Relato do usuario, sobre a analise interna que entrou no commit anterior:
--
--   "Quando o atendimento devolve uma peca da campanha para ajuste, ela nao
--    esta voltando. Preciso que corrija isso, para a peca voltar para a
--    pessoa, com a solicitacao de ajuste feita. E que as notificacoes comecem
--    a funcionar."
--
-- Ele esta certo nos dois pontos, e as duas causas sao minhas.
--
-- ---------------------------------------------------------------------------
-- CAUSA 1 - EU COPIEI A REGRA DO POST SEM CONFERIR SE O MOTIVO DELA VALIA
--
-- `decidirRodadaDePost` nao mexe em `posts.status` de proposito, e o motivo
-- esta escrito la: marcar `ajustes` dispararia `posts_corrente_do_cliente`
-- (0045), que cria uma etapa "Ajustes" na corrente e manda um aviso dizendo
-- *"o cliente pediu ajustes"* -- e o cliente nao pediu nada, nem viu o post.
--
-- Escrevi a mesma linha para a peca de campanha, e o motivo nao existe aqui:
-- NAO HA trigger nenhum em `deliverables.status` que fale do cliente. O que
-- sobrou foi uma decisao sem nada acontecendo: a rodada ficava
-- `ajustes_solicitados`, a peca ficava exatamente onde estava, a etapa dela
-- continuava onde estava, e quem produziu nao via diferenca nenhuma na tela.
--
-- Pior: `pedirAnaliseDoEntregavel` recusa abrir uma segunda rodada interna no
-- mesmo `numero_rodada`, e o numero e a `versao_atual`. Entao a peca ficava
-- TRAVADA -- o botao "Enviar para analise" aparecia habilitado e devolvia
-- *"esta versao ja foi para analise"*. Nao e so que ela nao voltava: nao
-- havia como mandar de novo.
--
-- ---------------------------------------------------------------------------
-- E A VOLTA E `em_producao`, NUNCA `ajustes`
--
-- `ajustes` e a palavra do CLIENTE neste enum -- e o que `decidir_rodada_do_cliente`
-- escreve quando ele pede alteracao. Numa peca que ele nem enxerga
-- (`deliverables_select_cliente` exige `enviado_em`), escreve-la seria gravar
-- que ele decidiu algo que nao viu; numa peca que ele JA aprovou, seria
-- desfazer a aprovacao dele por causa de uma rodada interna da versao
-- seguinte. Por isso o `aprovado` e preservado: o que a recusa interna da v2
-- diz e "a v2 nao sai", nao "a v1 deixou de valer".
--
-- `em_producao` e o unico dos sete que diz a verdade dos dois lados: a peca
-- esta sendo refeita. E a mesma escolha que `etapa_acompanha_o_entregavel`
-- (0052) ja fazia um nivel abaixo, com a frase escrita no corpo dela -- *"a
-- peca foi feita uma vez e vai ser refeita, e `em_andamento` e o unico dos
-- seis que diz isso"*.
--
-- ---------------------------------------------------------------------------
-- CAUSA 2 - O AVISO DA RODADA INTERNA NUNCA ALCANCOU A PECA DE CAMPANHA
--
-- Eu escrevi, no CLAUDE.md do commit anterior, que
-- `approval_rounds_avisa_aprovador` (0064) "ja toca o sino quando uma rodada
-- interna nasce pendente". Nao toca: `avisa_aprovador_da_conta()` tem um
-- `else return new` depois de `subtask` e `post`, e `deliverable` cai nele.
-- Era uma afirmacao minha sobre codigo que eu nao tinha lido.
--
-- E havia uma segunda metade, que valia para os TRES tipos: o unico avisado e
-- `client_flow_defaults.aprovador_interno_id`, que e opcional e esta nulo na
-- maioria das contas -- a aba Configuracoes do fluxo nasceu na 0064 e quase
-- ninguem a preencheu. Conta sem aprovador configurado nao avisava NINGUEM, e
-- isso se le exatamente como "as notificacoes nao funcionam".
--
-- Entao a volta e a GESTAO ATIVA INTEIRA, e o pedido do usuario e literal:
-- *"notifica os desenvolvedores e socios, que devem avaliar a arte"*. E a
-- forma de `solicitar_notas_do_mes()` (0066), que toca o sino de todo socio
-- ativo. **O custo esta dito:** numa agencia sem aprovador configurado, toda
-- rodada interna toca o sino de todo gestor. E melhor que tocar o de ninguem,
-- e quem quiser estreitar nomeia o aprovador da conta -- a tela para isso
-- existe. O fallback vale para os tres tipos porque a funcao e uma: uma
-- segunda dizendo quase isso seria o lugar onde as duas verdades divergem.
--
-- ---------------------------------------------------------------------------
-- DE QUEBRA, A ROTA DO AVISO DEIXA DE SER A ANTIGA
--
-- A 0064 escrevia `/painel/aprovacoes-internas`, que e 308 desde que as tres
-- telas viraram uma aba de Gestao de Tasks -- e a regra escrita e que uma
-- migration cujo unico efeito e trocar esse texto e migration que alguem
-- aplica por engano achando que muda alguma coisa. Nao e o caso aqui: o corpo
-- desta funcao esta sendo reescrito de qualquer forma, e a rota nova LEVA A
-- ABA (`?aba=aprovacoes-internas`), que o redirect tambem leva mas com um
-- salto a mais. As linhas que ja estao no banco continuam com o endereco
-- antigo, e continuam funcionando pelo redirect -- que e exatamente por que
-- ele existe.
--
-- ---------------------------------------------------------------------------
-- E O AVISO DA DECISAO PASSA PARA O BANCO
--
-- Ele estava em `decidirRodadaDeEntregavel`, em TypeScript, com o resultado do
-- `rpc("notificar")` DESCARTADO -- entao uma recusa nao aparecia em lugar
-- nenhum, contra a regra da casa de nenhuma escrita falhar em silencio. E e a
-- razao da 0045: a action que decide a rodada ja foi reescrita e vai ser de
-- novo, e cada reescrita e uma chance de o trecho ficar para tras. No trigger
-- ele pega todo caminho -- inclusive um PATCH montado a mao.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - O AVISO DA RODADA INTERNA ALCANCA OS TRES TIPOS, E A GESTAO
-- ---------------------------------------------------------------------------
create or replace function public.avisa_aprovador_da_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_cliente   uuid;
  v_aprovador uuid;
  v_nome      text;
  v_rota      text;
  v_gestor    record;
begin
  -- So rodada INTERNA e so pendente. A de escopo cliente e decidida por ele,
  -- no portal, e o aprovador da conta nao tem nada a fazer com ela.
  if new.escopo <> 'interna' or new.status <> 'pendente' then
    return new;
  end if;

  if new.content_type = 'subtask' then
    select t.client_id, s.titulo, '/painel/gestao-tasks?aba=aprovacoes-internas'
      into v_cliente, v_nome, v_rota
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where s.id = new.content_id;

  elsif new.content_type = 'post' then
    select p.client_id, p.tema, '/painel/social-media'
      into v_cliente, v_nome, v_rota
      from public.posts p
     where p.id = new.content_id;

  -- A PECA DE CAMPANHA, e a falta dela era um `else return new`. O
  -- `client_id` vem da CAMPANHA: `deliverables` nao tem empresa, e sem o join
  -- a peca cairia no `v_cliente is null` tres linhas abaixo -- o que, de
  -- fora, e identico a "a notificacao nao funciona".
  elsif new.content_type = 'deliverable' then
    select c.client_id, d.nome, '/painel/gestao-tasks?aba=aprovacoes-internas'
      into v_cliente, v_nome, v_rota
      from public.deliverables d
      join public.campaigns c on c.id = d.campaign_id
     where d.id = new.content_id;

  else
    return new;
  end if;

  if v_cliente is null then
    return new;
  end if;

  select aprovador_interno_id
    into v_aprovador
    from public.client_flow_defaults
   where client_id = v_cliente;

  -- PESSOA DESLIGADA NAO E AVISADA, e e a mesma pergunta que o resolvedor de
  -- etapas faz: um aviso para quem saiu da agencia e um aviso que ninguem le,
  -- e o sino do lado de ca fica dizendo que alguem foi chamado.
  if v_aprovador is not null and not public.pessoa_desligada(v_aprovador) then
    perform public.notificar(
      v_aprovador,
      'aprovacao',
      'Tem material esperando seu aval',
      coalesce(v_nome, 'Um material') || ' entrou na fila de aprovacoes internas.',
      v_rota
    );
    return new;
  end if;

  -- SEM APROVADOR CONFIGURADO, A GESTAO ATIVA INTEIRA. E o lado certo do erro:
  -- um aviso a mais na caixa de quem decide, em vez de uma fila que espera
  -- alguem abrir por habito. `notificar()` ja descarta quem causou o aviso,
  -- entao o gestor que pede o proprio aval nao recebe nada.
  for v_gestor in
    select p.id
      from public.profiles p
     where p.ativo
       and p.role in ('desenvolvedor', 'socio')
  loop
    perform public.notificar(
      v_gestor.id,
      'aprovacao',
      'Tem material esperando o aval da gestao',
      coalesce(v_nome, 'Um material') || ' entrou na fila de aprovacoes internas,'
        || ' e esta conta nao tem aprovador configurado.',
      v_rota
    );
  end loop;

  return new;
end
$func$;

comment on function public.avisa_aprovador_da_conta is
  'Avisa quem decide uma rodada interna recem-nascida (0064, ampliada na 0079): o aprovador da conta quando ha um, e a gestao ativa inteira quando nao ha. Vale para os tres content_type -- `deliverable` caia num `else return new` ate a 0079. Nao avisa quem causou o aviso nem quem saiu da agencia, e nunca derruba a escrita que chamou.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A DECISAO INTERNA DEVOLVE A PECA, COM O PEDIDO ESCRITO
--
-- Quatro coisas, e todas na mesma transacao da decisao:
--
--   1. a peca volta para `em_producao` (menos quando o cliente ja a aprovou);
--   2. a ETAPA dela volta para `em_andamento` -- e e isso que faz a peca
--      aparecer no "Minhas Tasks" de quem a produziu, porque a peca E uma
--      subtarefa desde a 0051;
--   3. o pedido de ajuste vira COMENTARIO na demanda, que e onde a etapa de
--      demanda ja grava o dela desde a 0007 -- a peca de campanha tem
--      `task_comentarios` justamente por ser uma subtarefa, ao contrario do
--      post, e deixar o texto so na rodada o esconderia (nenhuma tela mostra
--      rodada de entregavel);
--   4. quem produziu recebe o sino.
--
-- `security definer` porque ele escreve `subtasks` e `task_comentarios` em
-- nome de quem decidiu -- e quem decide e a gestao, que pode nao ser dona de
-- nada ali. O recorte e estreito: ele so toca a etapa e a demanda DESTA peca.
-- ---------------------------------------------------------------------------
create or replace function public.entregavel_volta_da_analise()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  peca     public.deliverables%rowtype;
  etapa    public.subtasks%rowtype;
  quem     uuid := (select auth.uid());
  texto    text;
begin
  if new.content_type <> 'deliverable' or new.escopo <> 'interna' then
    return new;
  end if;
  if old.status <> 'pendente' or new.status = 'pendente' then
    return new;
  end if;

  select * into peca from public.deliverables d where d.id = new.content_id;
  if not found then
    return new;
  end if;

  -- ------------------------------------------------------------------ status
  -- O `aprovado` E PRESERVADO, e e a linha que impede esta migration de
  -- desfazer uma aprovacao de cliente: a recusa interna da v2 diz que a v2
  -- nao sai, nao que a v1 deixou de valer. E a rodada aprovada da v1 continua
  -- no banco dizendo quem aprovou e quando.
  --
  -- E `aprovada` NAO mexe no status: aval interno nao e aprovacao do cliente,
  -- e escrever `em_aprovacao` aqui poria a peca num estado que o portal le
  -- sem ela ter saido da agencia. Quem carimba isso e
  -- `marcar_conteudo_como_enviado`, na rodada de cliente.
  if new.status in ('ajustes_solicitados', 'rejeitada')
     and peca.status <> 'aprovado' and peca.status <> 'em_producao' then
    update public.deliverables set status = 'em_producao' where id = peca.id;
  end if;

  -- ------------------------------------------------------------------- etapa
  if peca.subtask_id is not null and new.status in ('ajustes_solicitados', 'rejeitada') then
    select * into etapa from public.subtasks s where s.id = peca.subtask_id;

    -- AS PERGUNTAS ANTES DE ESCREVER, e nao um `exception when others` em
    -- volta -- a forma da 0052 e da 0061. Tres delas:
    --
    --   agrupadora nao se escreve (0022): o status dela e das filhas;
    --   `concluida` fica como esta: a peca passou pelo cliente, e e a rodada
    --     de cliente que a desfaz, nao esta;
    --   `subtask_liberada` porque a trava 2 de `validar_transicao_de_subtarefa`
    --     recusa sair de `nao_iniciada` com dependencia em aberto -- e uma
    --     excecao aqui derrubaria a DECISAO da gestao, que e o oposto do que
    --     se quer: o pedido de ajuste e o fato, a etapa e a consequencia.
    --
    -- `em_ajustes` NAO cabe, e e mecanico: a trava 4 exige uma rodada
    -- `ajustes_solicitados` na propria SUBTAREFA, e esta rodada e do
    -- entregavel. `em_andamento` e a verdade -- a peca voltou para a mesa.
    if found
       and etapa.status not in ('em_andamento', 'concluida')
       and not public.subtask_eh_agrupadora(etapa.id)
       and public.subtask_liberada(etapa.id) then
      update public.subtasks set status = 'em_andamento' where id = etapa.id;
    end if;
  end if;

  -- -------------------------------------------------------------- comentario
  -- O PEDIDO DE AJUSTE PRECISA SER LIDO, e a rodada nao e lida por tela
  -- nenhuma. Na demanda ele cai onde quem produz ja procura: a thread da
  -- etapa. `autor_id` e `not null`, entao sem sessao (o seed, uma rotina) o
  -- comentario nao nasce -- e esta certo: nao ha autor para assinar.
  if new.status in ('ajustes_solicitados', 'rejeitada')
     and quem is not null
     and peca.subtask_id is not null
     and coalesce(btrim(new.comentario), '') <> '' then
    insert into public.task_comentarios (task_id, subtask_id, approval_round_id, autor_id, texto, interno)
    select s.task_id, s.id, new.id, quem,
           format('Ajustes pedidos na análise interna de "%s" (v%s): %s',
                  peca.nome, new.numero_rodada, btrim(new.comentario)),
           true
      from public.subtasks s
     where s.id = peca.subtask_id;
  end if;

  -- ----------------------------------------------------------------- o sino
  texto := case
    when new.status = 'aprovada'
      then format('Aval interno aprovado: "%s"', peca.nome)
    when new.status = 'rejeitada'
      then format('Material recusado na análise: "%s"', peca.nome)
    else format('Ajustes pedidos em "%s"', peca.nome)
  end;

  if peca.responsavel_id is not null and not public.pessoa_desligada(peca.responsavel_id) then
    perform public.notificar(
      peca.responsavel_id,
      'aprovacao',
      texto,
      nullif(btrim(coalesce(new.comentario, '')), ''),
      format('/painel/aprovacoes/campanhas/%s', peca.campaign_id)
    );
  end if;

  return new;
end
$func$;

drop trigger if exists approval_rounds_devolve_o_entregavel on public.approval_rounds;
create trigger approval_rounds_devolve_o_entregavel
  after update of status on public.approval_rounds
  for each row execute function public.entregavel_volta_da_analise();

comment on function public.entregavel_volta_da_analise is
  'A decisao da rodada interna de uma peca de campanha devolve a peca (0079): status para `em_producao` -- nunca `ajustes`, que e a palavra do cliente --, a etapa da 0051 para `em_andamento`, o pedido de ajuste como comentario na demanda, e o sino de quem produziu. E trigger e nao action pela razao da 0045: a action que decide a rodada ja foi reescrita e vai ser de novo.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - A SEGUNDA RODADA DA MESMA VERSAO
--
-- `pedirAnaliseDoEntregavel` recusava quando JA EXISTIA rodada interna no
-- `numero_rodada` corrente, e o numero e a `versao_atual`. Depois de um
-- pedido de ajuste isso trava a peca: o unico jeito de pedir de novo e subir
-- uma versao nova.
--
-- E e assim que fica, de PROPOSITO -- e a tela passou a dizer isso em vez de
-- recusar depois do clique. O conteudo inteiro de uma peca de campanha E o
-- arquivo: "ajustei" quer dizer "subi outro". Permitir uma segunda rodada no
-- mesmo numero deixaria a gestao avaliando duas vezes o mesmo arquivo, e --
-- pior -- a rodada de cliente casa por NUMERO: com duas internas na v2, uma
-- aprovada e uma recusada, `validar_nova_rodada` acharia a aprovada e
-- deixaria sair a arte que a gestao recusou.
--
-- Nao ha indice unico impedindo as duas, e nao se cria um aqui: a etapa de
-- demanda numera rodada por ciclo de ajuste desde a 0007, e um `unique` em
-- `(content_type, content_id, escopo, numero_rodada)` recusaria o fluxo dela.
-- Quem decide o numero e quem abre a rodada, por tipo.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
