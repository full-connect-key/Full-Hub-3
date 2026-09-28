-- ===========================================================================
-- 0073 - A BUSCA GLOBAL
--
-- O campo de busca existe na topbar do Painel desde o Sprint 1, e ate aqui era
-- uma CASCA: um botao com cara de campo que abria um toast dizendo que a busca
-- ainda nao estava pronta. Trinta linhas de componente, nenhuma consulta.
--
-- ---------------------------------------------------------------------------
-- A LINHA MAIS IMPORTANTE DESTE ARQUIVO E A QUE NAO ESTA AQUI:
-- `busca_global()` NAO E `security definer`.
--
-- Uma funcao plpgsql comum roda com o `current_user` de quem a chamou, entao
-- toda policy das nove tabelas vale dentro dela, exatamente como valeria numa
-- consulta da tela. E isso nao e economia de codigo: uma busca que repetisse o
-- filtro de permissao criaria o segundo lugar onde a regra pode divergir -- e
-- seria o pior segundo lugar do produto, porque ela le NOVE tabelas de uma
-- vez, incluindo `clients`, `assets` e `client_requests`.
--
-- E o modo de falha seria o do `security_invoker` da view `calendar_events`:
-- **num banco com um cliente so, vazar tudo e mostrar o certo tem a mesma
-- cara.** Por isso a bateria busca com material de DUAS empresas e de gente
-- com tres perfis diferentes -- trocando esta funcao para `security definer`,
-- os cenarios caem e dizem o que vazaria.
--
-- `security definer` nao e a unica forma de furar isso, e a outra e mais
-- discreta: `set search_path` combinado com definer. Aqui nao ha nem um nem
-- outro, de proposito.
-- ---------------------------------------------------------------------------
--
-- O QUE ELA BUSCA E O NOME, NUNCA O CORPO. Briefing, legenda, pauta e
-- descricao ficam de fora: casar no corpo devolve a demanda cujo briefing
-- menciona "grafica" por acaso, e quem le a linha nao tem como ver POR QUE ela
-- casou -- e o titulo na tela nao contem o que foi digitado. A excecao sao os
-- campos que alguem DIGITA para achar uma coisa: o contato da empresa, o
-- codigo de patrimonio e o numero de serie do equipamento.
--
-- NOVE ENTIDADES, e cada uma entrou porque tem uma TELA DE DETALHE para onde
-- levar. O que ficou fora, e por que:
--
--   * `recommendations` -- nao tem rota de detalhe, e o feed ja tem busca na
--     URL. A linha cairia numa lista que nao rola ate ela.
--   * `deliverables` -- a peca de campanha E uma subtarefa desde a 0051, e ela
--     ja entra pelo ramo de etapa, com a linhagem. Somar as duas poria o mesmo
--     trabalho duas vezes na mesma lista, que e a conta que a 0061 recusou.
--   * `events` -- sem rota de detalhe; a tela dele e o calendario.
--   * `task_types` e `task_recurrences` -- sao configuracao, e quem mexe nelas
--     ja esta na aba. Nenhuma tem pagina propria.
--   * `finance_entries` -- um lancamento e um numero, nao um nome. E a trilha
--     de quem o le e mais estreita que tudo aqui.
--
-- E A SUBTAREFA DE POST FICA FORA DO RAMO DE ETAPA (0061): ela carrega o tema
-- do post como titulo, e o post tem ramo proprio. Sem essa linha, buscar o
-- tema devolveria DUAS linhas para o mesmo trabalho, levando a duas telas
-- diferentes -- e a certa e a do post, que e onde o card se preenche.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O acento, e por que ele nao vem de extensao
--
-- "grafica" tem que achar "grafica" e "Grafica" e a forma acentuada, nas duas
-- direcoes. Sao dois problemas empilhados, e o segundo e o que morde:
--
--   1. CAIXA. `lower()` resolve o ASCII.
--   2. ACENTO. `lower()` NAO resolve, e pior: ele depende do locale do banco.
--      Neste projeto isso ja custou uma ida -- a varredura de nome morto do
--      `check:cores` usava `grep -i`, que dobra caixa pelo LC_CTYPE, e com
--      `LC_CTYPE=POSIX` ela dizia "ok" numa maquina e falhava no CI para o
--      mesmo commit. Aqui e o mesmo bug em SQL, e ele foi MEDIDO: no Postgres
--      da bateria, que e locale C, `lower('GRAFICA')` com A acentuado devolve
--      a string com o acento em MAIUSCULA -- uma forma que nunca casa com
--      nada. Em producao, com locale UTF-8, o mesmo `lower()` funciona. Ou
--      seja: a versao ingenua passaria na maquina de quem escreve e falharia
--      na bateria, ou o contrario, conforme o locale de cada copia do banco.
--
-- A SAIDA E `translate`, COM AS DUAS CAIXAS NO MAPA, e nao a extensao
-- `unaccent`. Tres razoes:
--
--   * extensao se habilita no painel do Supabase, e um `create extension` numa
--     migration falha em qualquer ambiente onde ela nao esteja disponivel --
--     e a bateria e um Postgres pelado. E a licao do `pg_cron` na 0072, onde o
--     agendamento virou script justamente por isso;
--   * `unaccent()` e `stable` e nao `immutable`, entao ela nao entra em indice
--     sem um involucro -- e o involucro seria esta funcao de qualquer forma;
--   * o conjunto de acentos do portugues e FECHADO. Ele nao cresce, ao
--     contrario da lista de nomes mortos do `check:cores`.
--
-- As duas caixas estao no mapa de proposito: assim ela dobra o acento ANTES do
-- `lower()` e o resultado nao depende de locale nenhum.
--
-- `immutable` para ela poder entrar num indice de expressao no dia em que a
-- agencia tiver demanda suficiente para isso doer. Hoje nao tem, e a busca
-- varre -- o que esta dito no PASSO 2.
-- ---------------------------------------------------------------------------
create or replace function public.sem_acento(p_texto text)
returns text
language plpgsql
immutable
as $func$
begin
  return lower(
    translate(
      coalesce(p_texto, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
    )
  );
end;
$func$;

comment on function public.sem_acento(text) is
  'Dobra caixa e acento do portugues sem depender de extensao nem de locale. '
  'O mapa carrega as duas caixas de proposito: o acento sai antes do lower(), '
  'que em locale C nao dobra caractere acentuado.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A busca
--
-- `strpos` E NAO `like '%termo%'`, e a escolha resolve duas coisas de uma vez:
--
--   * `like` trata `%` e `_` como curinga, entao quem busca "100%" busca
--     qualquer coisa. Escapar daria uma terceira funcao para lembrar;
--   * `strpos` devolve ONDE casou, que e a ordenacao. Posicao 1 e casamento no
--     comeco do nome -- digitar "mun" poe "Mundo Verde" acima de "Comunicado
--     da Mundo", que e o que a pessoa espera.
--
-- Nenhum dos dois usa indice sem `pg_trgm`, entao isto VARRE as nove tabelas.
-- Dito em vez de escondido: numa agencia com algumas centenas de demandas isso
-- e barato, e o dia em que nao for, a saida e um indice de expressao sobre
-- `sem_acento(titulo)` -- que e por que ela e `immutable`.
--
-- O LIMITE E POR TIPO, E NAO GLOBAL. Um limite global de dez com trinta
-- demandas casando mostraria ZERO clientes -- e quem digita "Mundo" quase
-- sempre quer a empresa. A paleta agrupa por tipo, e cada grupo precisa poder
-- responder.
--
-- E CADA GRUPO DIZ QUANTOS SOBRARAM, pelo `total`: e a regra do Resumo da
-- Agencia -- cortar calado faz a pessoa concluir que aquilo e tudo. O `count`
-- e janela e roda ANTES do limite, que e o unico jeito de ele contar o que foi
-- cortado.
--
-- DOIS CARACTERES NO MINIMO. Com um, tudo casa, e a lista deixa de responder
-- qualquer coisa.
--
-- A ORDEM DENTRO DO GRUPO E posicao e depois nome, e nao recencia. Recencia
-- foi considerada e cai por um motivo mecanico: os grupos tem seis linhas, e
-- em seis linhas o sinal util e "o nome comeca com o que eu digitei", nao "foi
-- mexido ontem". Ordenar por data poria a demanda de ontem acima da que tem o
-- nome exato que a pessoa escreveu.
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
       and not public.subtarefa_de_post(s.id)
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
  'A busca da topbar do Painel. NAO e security definer de proposito: a RLS das '
  'nove tabelas e quem decide o que cada perfil acha, e repetir o filtro aqui '
  'criaria o segundo lugar onde a regra pode divergir.';

-- O `execute` fica com `authenticated`, e nao com `anon`. A funcao respeita a
-- RLS, entao `anon` nao leria nada -- mas o Supabase concede `execute` de toda
-- funcao nova para `anon` e `authenticated` sozinho, e a 0071 e a razao de
-- isto estar escrito: `limpar_rascunhos_abandonados()` nasceu sem revoke e
-- ficou chamavel sem sessao nenhuma por quatro dezenas de migrations.
revoke all on function public.busca_global(text, integer) from public;
revoke all on function public.busca_global(text, integer) from anon;
grant execute on function public.busca_global(text, integer) to authenticated;
grant execute on function public.busca_global(text, integer) to service_role;
