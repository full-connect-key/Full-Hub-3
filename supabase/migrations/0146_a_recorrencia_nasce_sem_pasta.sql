-- =========================================================================
-- 0146 — A RECORRENCIA DEIXA DE EXIGIR A PASTA DE ENTREGA
--
-- Decisao do usuario: "quando tento abrir uma recorrencia, nao consigo pois
-- pede a pasta de entrega da conta, tire essa regra".
--
-- A RECUSA ESTAVA NUMA TELA QUE NAO TEM ONDE SATISFAZE-LA, e e isso que a
-- torna errada e nao so inconveniente. A pasta era um campo DO MODELO ate a
-- 0113; aquela migration o tirou com a razao escrita -- "com N contas na
-- regra, uma pasta digitada esta errada para N-1 delas" -- e pos a origem em
-- `client_flow_defaults.pasta_entrega_url`, que mora na ficha de cada conta,
-- em Gestao de Pessoas > Clientes. Entao desde a 0113 a tela de recorrencia
-- recusa salvar por causa de um campo que ela nao tem.
--
-- E a 0076 pela segunda vez: uma recusa que a pessoa nao tem como cumprir sem
-- sair da tela e um portao fechado, e o custo dela e o oposto do que a trava
-- existe para comprar -- a recorrencia inteira deixa de ser aberta.
--
-- O QUE A TRAVA PROTEGIA CONTINUA PROTEGIDO ONDE O ARGUMENTO VALE. A 0015
-- escreveu: "sem a trava o campo vira aquele que ninguem preenche -- quem
-- abre a demanda esta com pressa, quem procura o material esta semanas
-- depois". Aquilo e sobre uma PESSOA abrindo uma demanda, e continua inteiro:
-- `tasks_publicar_exige_minimo` segue cobrando titulo, cliente e pasta de
-- quem publica pela tela. O que muda e a rotina das tres da manha, onde nao
-- ha ninguem para preencher e onde a recusa significa o cliente sem entrega.
--
-- SAO AS DUAS PONTAS NO MESMO COMMIT, que e a licao da 0029 e da 0060:
-- tirando so a validacao da tela, a regra salvaria e a geracao morreria toda
-- madrugada em silencio, num historico que ninguem abre -- exatamente o modo
-- de falha que o cabecalho da 0040 ja descrevia. Tirando so a daqui, a tela
-- continuaria recusando o clique.
--
-- E A SAIDA DE EMERGENCIA NAO VIRA PORTA DESTRANCADA (0045): o GUC
-- `full_hub.sem_pasta` e de escopo LOCAL, ligado na linha anterior ao insert
-- da demanda e desligado na seguinte. Ele nao e um interruptor de produto --
-- e um unico insert, de uma funcao so.
--
-- O AVISO FICA, e ele ja tinha para onde ir: `avisos` vira
-- `recurrence_runs.detalhes` e toca o sino do Atendimento e da gestao desde a
-- 0041. "Funcao sem dono avisa, nunca recusa" (0064) com outro sujeito.
-- =========================================================================


-- -------------------------------------------------------------------------
-- PASSO 1 — a cobranca da pasta aprende a saida de emergencia
--
-- A funcao e COPIADA INTEIRA da 0028 (a licao da 0030: `create or replace`
-- se reescreve a partir do texto de agora e nao avisa quando o texto novo tem
-- MENOS coisa que o velho -- foi assim que a 0030 perdeu o bloco de carimbos
-- de `validar_transicao_de_subtarefa` e so apareceu na 0052). Conferido
-- contra `pg_get_functiondef` do banco antes de escrever: os tres ramos
-- abaixo sao os tres de la, palavra por palavra.
--
-- SO O RAMO DA PASTA LE O GUC. Titulo e cliente continuam sendo cobrados em
-- todo caminho, a rotina inclusive: uma demanda sem titulo nao e achavel por
-- ninguem, e uma sem cliente nao aparece para a conta -- os dois sao coisas
-- que `gerar_ocorrencia()` TEM em maos, e nenhum deles depende de alguem ter
-- preenchido uma ficha.
-- -------------------------------------------------------------------------
create or replace function public.tasks_publicar_exige_minimo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.publicada_em is null then
    return new;
  end if;

  -- No update, so a TRANSICAO para publicada e cobrada. Corrigir o titulo de
  -- uma demanda ja publicada nao passa por aqui de novo.
  if tg_op = 'UPDATE' and old.publicada_em is not null then
    return new;
  end if;

  if new.titulo is null or btrim(new.titulo) = '' then
    raise exception using
      errcode = 'check_violation',
      message = 'A demanda precisa de um título para existir para a equipe.',
      hint    = 'O rascunho continua salvo — é só dar um nome a ele.';
  end if;

  if new.client_id is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Escolha o cliente antes de criar a demanda.',
      hint    = 'O rascunho continua salvo. Sem cliente, ela não aparece para ninguém da conta.';
  end if;

  -- A SAIDA DE EMERGENCIA DA ROTINA (0146).
  --
  -- Ela e LOCAL e vale por um insert: `gerar_ocorrencia()` a liga na linha
  -- anterior ao insert da demanda e a desliga na seguinte. Quem publica pela
  -- tela nunca a liga, entao a cobranca continua inteira la -- que e o
  -- argumento da 0015 de pe onde ele vale.
  if coalesce(current_setting('full_hub.sem_pasta', true), 'off') <> 'on'
     and (new.link_entrega is null or btrim(new.link_entrega) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'Toda demanda precisa da pasta de entrega: onde o material final vai ficar.',
      hint    = 'Cole o endereço da pasta no Figma, no Drive ou onde o material for ficar. Começa com http:// ou https://.';
  end if;

  return new;
end
$$;

comment on function public.tasks_publicar_exige_minimo() is
  'Publicar exige titulo, cliente e pasta de entrega. A pasta e dispensada quando full_hub.sem_pasta esta ligado -- escopo local, so a rotina da recorrencia o liga (0146).';


-- -------------------------------------------------------------------------
-- PASSO 2 — `gerar_ocorrencia()` avisa no lugar de recusar
--
-- ELA E REMENDADA A PARTIR DO CATALOGO, e nao redigitada, que e a licao da
-- 0030 pelos DOIS lados: o arquivo da 0113 nao e a versao que esta no ar --
-- a 0123 ja lhe acrescentou `conta_no_resumo` pelo mesmo mecanismo. Colar o
-- corpo do arquivo aqui desfaria aquela migration em silencio, e e a 0128 em
-- quantas palavras: "a regra e aplicar a partir do ARQUIVO, nunca de
-- memoria" -- aqui o arquivo que vale e o catalogo.
--
-- E O BLOCO CONTA AS CITACOES E ESTOURA COM A DICA, em vez de nao fazer
-- nada: `replace()` que nao acha devolve o texto inteiro, calado, e o
-- `execute` recriaria a funcao IDENTICA -- a recusa continuaria de pe e nada
-- na tela diria por que. E a primeira versao da 0123, que procurava um texto
-- que a funcao deployada nao tinha.
-- -------------------------------------------------------------------------
do $do$
declare
  def       text;
  recusa    text;
  insere    text;
  retorna   text;
begin
  -- `pg_get_functiondef` E NAO `prosrc`, e a diferenca e o cabecalho: ele
  -- devolve o `create or replace` inteiro, com a assinatura, o `language`, o
  -- `security definer` e o `set search_path` que a funcao TEM -- em vez de eu
  -- redigitar essas quatro linhas de memoria, que e exatamente o erro da 0128.
  select replace(pg_get_functiondef(oid), chr(13) || chr(10), chr(10))
    into def
    from pg_proc
   where oid = 'public.gerar_ocorrencia(uuid,date)'::regprocedure;

  if def is null then
    raise exception 'A funcao gerar_ocorrencia(uuid,date) nao existe neste banco.'
      using hint = 'Cole a 0040, a 0041 e a 0113 antes desta.';
  end if;

  recusa :=
    '    if pasta is null then' || chr(10) ||
    '      update public.recurrence_runs' || chr(10) ||
    '         set status = ''erro'',' || chr(10) ||
    '             detalhes = jsonb_build_object(' || chr(10) ||
    '               ''motivo'', format(''A conta "%s" nao tem pasta de entrega configurada, e toda demanda precisa de uma.'', cliente.nome_empresa))' || chr(10) ||
    '       where id = run_id;' || chr(10) ||
    '      continue;' || chr(10) ||
    '    end if;';

  insere :=
    '    insert into public.tasks (' || chr(10) ||
    '      client_id, titulo, briefing_rico, prioridade, link_entrega,';

  retorna :=
    '    returning id into nova_task;' || chr(10) ||
    chr(10) ||
    '    primeira := coalesce(primeira, nova_task);';

  -- JA APLICADA? NADA A TROCAR -- e isto e a convencao da casa escrita em
  -- `CLAUDE.md`: "migrations precisam poder rodar mais de uma vez sem erro".
  --
  -- O BLOCO PROCURA A RECUSA VELHA, QUE A TROCA DE BAIXO APAGA: na segunda
  -- colagem ele nao a acha, e o `raise` de "forma inesperada" dispararia sobre
  -- um banco que esta EM DIA -- mandando quem o leu aplicar a mao duas trocas
  -- que ja estao lá. Uma recusa que mente sobre o estado do banco custa o mesmo
  -- que uma que nao dispara: nas duas o script responde com confianca sobre um
  -- estado que nao e o do banco.
  --
  -- O GUC E A MARCA, e nao o aviso: `full_hub.sem_pasta` nasce nesta migration
  -- e nada mais o escreve dentro desta funcao, enquanto a frase do aviso e
  -- texto que uma reescrita posterior pode reformular.
  if position('full_hub.sem_pasta' in def) > 0 then
    raise notice 'A 0146 ja esta aplicada: gerar_ocorrencia() avisa no lugar de recusar. Nada a trocar.';
    return;
  end if;

  -- AS TRES CITACOES SAO CONTADAS ANTES DE QUALQUER TROCA, e o bloco estoura
  -- com a dica: `replace()` que nao acha devolve o texto inteiro, CALADO, e o
  -- `execute` recriaria a funcao identica -- a recusa continuaria de pe e nada
  -- na tela diria por que. E a primeira versao da 0123, que procurava um texto
  -- que a funcao deployada nao tinha.
  if position(recusa in def) = 0
     or position(insere in def) = 0
     or position(retorna in def) = 0 then
    raise exception 'O corpo de gerar_ocorrencia() nao tem a forma esperada (recusa=%, insert=%, returning=%).',
      position(recusa in def), position(insere in def), position(retorna in def)
      using hint = 'Alguma migration posterior reescreveu a funcao. Aplique as duas trocas a mao: a recusa da pasta vira aviso em `avisos`, e o insert da demanda e cercado pelo GUC full_hub.sem_pasta.';
  end if;

  -- (1) A RECUSA VIRA AVISO.
  --
  -- `avisos` e zerado no topo do laco de contas e vira
  -- `recurrence_runs.detalhes` no fim dele, tocando o sino do Atendimento e da
  -- gestao desde a 0041 -- a pessoa que distribui trabalho descobre a pasta
  -- faltando pelo caminho que ela ja usa, e nao por uma demanda que nunca
  -- nasceu.
  def := replace(def, recusa,
    '    -- A CONTA SEM PASTA AVISA, NUNCA RECUSA (0146). Ver o cabecalho.' || chr(10) ||
    '    if pasta is null then' || chr(10) ||
    '      avisos := avisos || format(''A conta "%s" ainda nao tem pasta de entrega na ficha: a demanda nasceu sem uma, e quem for produzir precisa preencher.'', cliente.nome_empresa);' || chr(10) ||
    '    end if;');

  -- (2) O INSERT DA DEMANDA FICA CERCADO PELO GUC, ligado so quando a pasta e
  -- nula e DESLIGADO na linha seguinte: a saida de emergencia vale por um
  -- insert, nunca pela transacao (0045).
  def := replace(def, insere,
    '    perform set_config(''full_hub.sem_pasta'',' || chr(10) ||
    '                       case when pasta is null then ''on'' else ''off'' end, true);' || chr(10) ||
    chr(10) ||
    insere);

  def := replace(def, retorna,
    '    returning id into nova_task;' || chr(10) ||
    chr(10) ||
    '    perform set_config(''full_hub.sem_pasta'', ''off'', true);' || chr(10) ||
    chr(10) ||
    '    primeira := coalesce(primeira, nova_task);');

  execute def;
end
$do$;

comment on function public.gerar_ocorrencia(uuid, date) is
  'Gera a ocorrencia de uma regra, uma demanda por conta. A conta sem pasta de entrega na ficha AVISA no historico e gera a demanda sem pasta (0146).';


-- -------------------------------------------------------------------------
-- PASSO 3 — a conferencia
-- -------------------------------------------------------------------------
select
  (position('full_hub.sem_pasta' in pg_get_functiondef('public.tasks_publicar_exige_minimo()'::regprocedure)) > 0)
    as trava_le_o_guc,
  (position('avisos := avisos || format(''A conta' in pg_get_functiondef('public.gerar_ocorrencia(uuid,date)'::regprocedure)) > 0)
    as rotina_avisa,
  (position('nao tem pasta de entrega configurada' in pg_get_functiondef('public.gerar_ocorrencia(uuid,date)'::regprocedure)) = 0)
    as rotina_nao_recusa_mais,
  (position('conta_no_resumo' in pg_get_functiondef('public.gerar_ocorrencia(uuid,date)'::regprocedure)) > 0)
    as patch_da_0123_de_pe;
