-- ---------------------------------------------------------------------------
-- 0137 - A CLASSIFICACAO DEIXA DE SER OBRIGATORIA NA ABERTURA
--
-- Decisao do usuario: *"a nova solicitacao dentro do portal do cliente nao
-- precisa ser social ou campanha necessariamente, o cliente deve poder
-- especificar o que ele quer sem colocar em alguma categoria, podendo
-- escrever caso ele queira"*.
--
-- ESTA E UMA REVERSAO DECLARADA DA 0124, e e por isso que ela e uma funcao e
-- nenhuma coluna. Aquela migration nasceu da frase *"exigir a classificacao
-- como Social ou Campanha"*, do mesmo usuario, e o argumento dela estava no
-- cabecalho em quantas palavras: *"'Nenhuma das duas' seria a terceira opcao
-- obvia, e ela desfaz o pedido: exigir a classificacao quer dizer que quem
-- abre escolhe um lado"*. Ele pediu o contrario, e a leitura do pedido novo e
-- literal: quem abre pode nao escolher lado nenhum.
--
-- O QUE A 0124 CONSTRUIU FICA INTEIRO, E E A MAIOR PARTE DELA. A coluna, o
-- enum, a chave da vertente, o indice, a coerencia campanha->frente, a
-- coerencia vertente->conta, o chip da fila, a acao de classificar e o bloco
-- do relatorio: nada disso sai. O que sai e UM dos quatro ramos do gatilho --
-- o que recusa o `insert` sem frente.
--
-- E A FRENTE CONTINUA SENDO UMA DECLARACAO E NAO UMA CONTA, que e a linha
-- central daquele cabecalho: `campaign_id is not null ? 'campanha' :
-- 'social'` continua errado, porque campanha nula nao quer dizer social.
-- O que muda e QUEM declara: antes era sempre o cliente, na abertura; agora e
-- o cliente OU o Atendimento, pela acao `classificarSolicitacao`, que existe
-- desde a 0124 justamente para o pedido anterior a regra. O nulo deixou de ser
-- so o pedido antigo e passou a ser um estado que a tela oferece.
--
-- O RAMO 2 FICA, e a assimetria e a decisao: "a frente nao se esvazia depois"
-- continua valendo. Nao ha tela que a esvazie, e manter a trava e o que
-- preserva a propriedade que o relatorio depende -- *o pedido classificado nao
-- se desclassifica calado*. Abrir sem classificar e uma coisa; apagar a
-- classificacao de um pedido que ja tem e outra.
--
-- O RAMO 3 FICA E CONTINUA QUERENDO DIZER O MESMO. `new.frente is distinct
-- from 'campanha'` recusa tambem a frente NULA com uma campanha dentro, e esse
-- e o lado certo: estar numa campanha E ser da frente Campanha, e a tela so
-- oferece o seletor de campanha nessa frente. Um pedido com o uuid de uma
-- campanha e a frente em branco seriam duas afirmacoes que se contradizem a
-- uma coluna de distancia.
--
-- A FUNCAO E COPIADA INTEIRA, que e a licao da 0030: `create or replace` se
-- reescreve a partir do texto de agora e NAO AVISA quando o texto novo tem
-- menos coisa que o velho -- foi assim que a 0030 perdeu o bloco de carimbos
-- de `validar_transicao_de_subtarefa` e so apareceu na 0052. Os ramos 2, 3 e 4
-- estao abaixo palavra por palavra.
--
-- O QUE ISTO CUSTA, E E DITO EM VEZ DE ESCONDIDO.
--
-- 1. A fila do Atendimento passa a receber pedido sem classificacao como caso
--    NORMAL, e o chip dele e ambar -- *"ai sim e excecao, e e a unica das tres
--    que pede uma acao"*. Com a maioria chegando em branco, a maioria das
--    linhas fica ambar, que e o contrario da regra desta casa (*pinta-se a
--    excecao*). Fica ambar assim mesmo, e por uma razao: classificar E uma
--    pendencia de verdade -- sem a frente, o relatorio nao soma o pedido e a
--    conversao nao sabe de que lado abrir o trabalho. A fila e exatamente a
--    tela onde pendencia se pinta.
--
-- 2. O bloco "O que os clientes pediram" do Resumo da Agencia (0124) tem a
--    linha "sem classificacao" desenhada *so quando existe*, com o comentario
--    dizendo que *"num banco classificado ele e zero para sempre"*. Essa
--    premissa deixou de valer: ela passa a ser uma linha comum. O codigo nao
--    muda -- `> 0` continua certo --, o comentario sim.
--
-- 3. O roteiro de briefing (0068) deixa de ser perguntado por padrao, porque o
--    TIPO deixou de vir pre-selecionado na tela. O argumento daquela migration
--    -- *"um campo de texto livre chamado 'descreva o que voce precisa'
--    devolve 'uma arte pro insta'"* -- continua certo para quem escolhe um
--    tipo, e e por isso que o roteiro continua existindo e continua aparecendo
--    no instante em que alguem escolhe. O que o produto deixa de fazer e
--    COBRAR aquelas respostas de quem nao escolheu nenhum.
--
-- MEDIDO: nenhuma mutacao de banco nova. O cenario da bateria que prova o ramo
-- 1 e o que esta migration vira do avesso -- *"tirar a exigencia da frente no
-- insert derruba 3"* (0124) passa a ser o contrario: o insert sem frente tem
-- de PASSAR, e devolver o ramo derruba o cenario novo.
-- ---------------------------------------------------------------------------

-- PASSO 1 — O gatilho, sem o ramo da exigencia --------------------------------
create or replace function public.client_requests_classificacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_dona uuid;
  v_nome text;
begin
  -- 1. A FRENTE NAO E MAIS EXIGIDA NA ABERTURA (0137).
  --
  -- O ramo que ficava aqui recusava o `insert` sem frente, com a frase *"Diga
  -- se este pedido e de Social ou de Campanha."*. Ele saiu por decisao do
  -- usuario, e o lugar dele fica nomeado de proposito: quem vier depois
  -- precisa saber que a ausencia e uma escolha, e nao um ramo que alguem
  -- esqueceu de escrever.

  -- 2. E ELA NAO SE ESVAZIA DEPOIS, que e a outra metade da 0015: lá a pasta
  -- de entrega e obrigatoria na demanda nova E nao se apaga na que ja tem.
  -- Sem esta linha, o `update` que limpa a frente faria o pedido sair da
  -- contagem do relatorio sem ninguem ter decidido isso.
  --
  -- ELA FICA DEPOIS DA 0137, e a assimetria e a decisao: abrir sem
  -- classificar e uma coisa, apagar a classificacao de um pedido que ja tem e
  -- outra -- e e a segunda que o relatorio nao tem como perceber.
  if tg_op = 'UPDATE' and old.frente is not null and new.frente is null then
    raise exception using
      errcode = 'not_null_violation',
      message = 'Este pedido já está classificado, e a classificação não se apaga.',
      hint    = 'Trocar de Social para Campanha (ou o contrário) continua valendo.';
  end if;

  -- 3. CAMPANHA ESCOLHIDA QUER DIZER FRENTE CAMPANHA.
  --
  -- A 0112 recusa a campanha de OUTRA empresa; o que nada impedia e a mesma
  -- linha dizer "social" com o uuid de uma campanha dentro — duas afirmacoes
  -- que se contradizem a uma coluna de distancia, e o relatorio somaria a
  -- primeira enquanto a aba Entregas da campanha mostraria a segunda.
  --
  -- O CONTRARIO NAO E TRAVA: frente `campanha` sem campanha nenhuma e o caso
  -- comum — o cliente pede, e a campanha nasce depois.
  --
  -- E `is distinct from` ALCANCA O NULO, que depois da 0137 e um estado que a
  -- tela oferece: um pedido com o uuid de uma campanha e a frente em branco
  -- continua recusado, porque estar numa campanha E ser da frente Campanha.
  if new.campaign_id is not null and new.frente is distinct from 'campanha' then
    raise exception using
      errcode = 'check_violation',
      message = 'Este pedido está numa campanha, então a frente é Campanha.',
      hint    = 'Para classificar como Social, tire a campanha — deixe em '
                '"Nenhuma, é um pedido solto".';
  end if;

  -- 4. A VERTENTE E DA CONTA DO PEDIDO, E DOS DOIS LADOS.
  --
  -- E `tasks_vertente_da_conta()` (0118) na tabela ao lado, com a mesma licao
  -- dentro: o gatilho dispara tambem quando o CLIENTE muda, senao trocar a
  -- empresa de um pedido classificado deixaria a linha apontando para a
  -- vertente de uma conta que nao e mais a dela — e o filtro de uma conta
  -- nao a acharia enquanto o da outra a traria. E um vazamento entre contas
  -- que nenhuma tela mostraria.
  if new.vertente_id is not null then
    select v.client_id, v.nome into v_dona, v_nome
      from public.client_vertentes v
     where v.id = new.vertente_id;

    if v_dona is null then
      raise exception using
        errcode = 'foreign_key_violation',
        message = 'Essa vertente não existe.',
        hint    = 'Escolha uma da lista da conta, ou deixe em branco.';
    end if;

    if new.client_id is null or new.client_id <> v_dona then
      raise exception using
        errcode = 'check_violation',
        message = format('A vertente "%s" é de outra conta.', v_nome),
        hint    = 'O pedido e a vertente precisam ser da mesma empresa.';
    end if;
  end if;

  return new;
end;
$fn$;

comment on function public.client_requests_classificacao() is
  'A frente nao se esvazia depois de escolhida; campanha escolhida obriga '
  'frente Campanha; a vertente e da conta do pedido (0124, sem a exigencia da '
  'abertura desde a 0137).';

-- O GATILHO E RECRIADO COM A MESMA ASSINATURA, e nao e redundancia: o
-- `create or replace function` troca o CORPO, e o `drop`+`create` do gatilho e
-- o que garante que ele continua disparando nas mesmas quatro colunas num
-- banco que nunca teve a 0124 aplicada por inteiro.
drop trigger if exists client_requests_classificacao on public.client_requests;
create trigger client_requests_classificacao
  before insert or update of frente, vertente_id, campaign_id, client_id
    on public.client_requests
  for each row execute function public.client_requests_classificacao();

-- PASSO 2 — A descricao do tipo deixa de ser desenhada -----------------------
-- Decisao do usuario, na mesma mensagem: *"tire o texto abaixo que de que tipo
-- de trabalho e, esses textinhos parecem indiretas nao sao legais"*.
--
-- A COLUNA FICA SEM LEITOR, e nao e apagada -- e a 0116 e nao a 0023. Aquela
-- apaga uma coluna que continua sendo PERGUNTADA e nao decide mais nada (*o
-- pior tipo de campo, porque quem responde acha que garantiu alguma coisa*);
-- esta nao e perguntada em tela nenhuma: ela e texto de seed, escrito pela
-- 0068, e apagar destruiria o que esta gravado por causa de um paragrafo que
-- saiu do desenho. Ela fica nomeada como morta, que e a forma da 0136.
comment on column public.request_types.descricao is
  'MORTA desde a 0137: nenhuma tela desenha este texto. Ele era a linha '
  'embaixo de cada cartao de tipo na abertura do pedido, e saiu por decisao do '
  'usuario -- as quatro frases liam como indireta. O texto fica gravado; '
  'devolve-lo e uma linha no formulario do portal.';

-- PASSO 2.5 — A unica ajuda que lia como indireta -----------------------------
-- ISTO NAO FOI NOMEADO PELO USUARIO, e e dito em vez de escondido.
--
-- Ele nomeou *"o texto abaixo que de que tipo de trabalho e"* -- as quatro
-- `descricao` do PASSO 2. A `ajuda` de cada CAMPO do roteiro fica, e a
-- diferenca esta escrita no formulario: *"Folder A5, banner de 2x1, cartao de
-- visita..."* e um EXEMPLO do que cabe no campo, e sem ele a pessoa nao sabe
-- em que forma responder.
--
-- UMA DELAS NAO E EXEMPLO. *"Em uma ou duas frases. O texto final e com a
-- gente."* tem duas sentencas, e a segunda nao diz o que cabe no campo: ela
-- diz o que a pessoa nao deve fazer. E a mesma coisa que ele nomeou, no mesmo
-- bloco da mesma tela, e ela sai -- a primeira sentenca, que e o exemplo,
-- fica.
--
-- O `replace` e CIRURGICO e idempotente: ele so alcanca a frase exata, so na
-- linha que a tem, e recolar o arquivo nao faz nada. Se alguem ja tiver
-- editado aquele roteiro, o `where` nao casa e o `update` nao toca em nada --
-- que e o certo, porque `campos_json` e conteudo da agencia e nao schema.
update public.request_types
   set campos_json = replace(
         campos_json::text,
         'Em uma ou duas frases. O texto final é com a gente.',
         'Em uma ou duas frases.')::jsonb
 where campos_json::text like '%O texto final é com a gente.%';

-- PASSO 3 — A coluna diz que a frente e opcional -----------------------------
-- ESTE E O MARCADOR do `onde-esta-o-banco.sql`, e e a ULTIMA coisa que o
-- arquivo faz: um marcador no PASSO 1 diria `ok` sobre um banco onde o gatilho
-- novo esta de pe e os dois comentarios nao foram colados -- que e um banco em
-- que a regra ja mudou, mas em que o proximo a abrir o schema le a frase
-- errada sobre a coluna mais sensivel desta migration.
comment on column public.client_requests.frente is
  'Social ou Campanha: quem produz este pedido (0124). OPCIONAL desde a 0137 '
  '-- a exigencia da abertura saiu por decisao do usuario, e o nulo deixou de '
  'ser so o pedido anterior a 0124 para ser um estado que a tela oferece. A '
  'fila desenha "Sem classificacao" e o Atendimento classifica. Escolhida, '
  'ela nao se esvazia: o ramo 2 do gatilho recusa.';

-- CONFERENCIA ----------------------------------------------------------------
-- Espera-se UMA linha, com os quatro `true`.
select
  not exists (select 1 from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname = 'client_requests_classificacao'
                and p.prosrc like '%de Social ou de Campanha%')     as sem_a_exigencia,
  exists (select 1 from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'client_requests_classificacao'
            and p.prosrc like '%a classificação não se apaga%')     as ramo_2_de_pe,
  exists (select 1 from pg_description d
           join pg_class c on c.oid = d.objoid
           join pg_attribute a on a.attrelid = c.oid and a.attnum = d.objsubid
          where c.relname = 'request_types' and a.attname = 'descricao'
            and d.description like '%MORTA desde a 0137%')          as descricao_morta,
  exists (select 1 from pg_description d
           join pg_class c on c.oid = d.objoid
           join pg_attribute a on a.attrelid = c.oid and a.attnum = d.objsubid
          where c.relname = 'client_requests' and a.attname = 'frente'
            and d.description like '%OPCIONAL desde a 0137%')       as frente_opcional;

notify pgrst, 'reload schema';
