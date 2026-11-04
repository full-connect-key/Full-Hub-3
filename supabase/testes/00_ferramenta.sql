-- ===========================================================================
-- Bateria do Sprint 3B. Cada cenario roda como uma PESSOA de verdade
-- (set role authenticated + request.jwt.claim.sub), que e o que faz o RLS
-- valer. Rodando como postgres, tudo passaria -- superusuario ignora RLS.
-- ===========================================================================
create schema if not exists teste;
drop table if exists teste.resultado;
create table teste.resultado (
  n serial, descricao text, situacao text, detalhe text
);

create or replace function teste.cenario(
  p_descricao text,
  p_uid uuid,
  p_comando text,
  p_espera text,              -- 'ok' | 'recusa'
  p_linhas integer default null
) returns void
language plpgsql
as $$
declare
  linhas integer;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    execute p_comando;
    get diagnostics linhas = row_count;
    execute 'reset role';

    if p_espera = 'recusa' and linhas > 0 then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU', format('passou quando devia ser recusado (%s linhas)', linhas));
    elsif p_espera = 'recusa' then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', 'RLS nao achou a linha (0 linhas)');
    elsif p_linhas is not null and linhas <> p_linhas then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU', format('esperava %s linha(s), veio %s', p_linhas, linhas));
    else
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', format('%s linha(s)', linhas));
    end if;
  exception when others then
    execute 'reset role';
    if p_espera = 'recusa' then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', left(sqlerrm, 90));
    else
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU', left(sqlerrm, 120));
    end if;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- teste.como_a_rotina - o que roda de madrugada, e nao na tela de ninguem
--
-- `teste.cenario` sempre entra como `authenticated`, porque quase tudo neste
-- produto acontece com alguem logado. Duas funcoes nao: `gerar_recorrencias()`
-- e `limpar_rascunhos_abandonados()` sao chamadas pela rotina diaria com a
-- chave de servico, e desde a 0071 `authenticated` NAO tem `execute` nelas.
--
-- E a distincao importa: usar `teste.cenario` aqui testaria um caminho que o
-- produto nao tem -- e, pior, pediria de volta o `execute` que a 0071 tirou. A
-- bateria passaria a exigir o furo.
-- ---------------------------------------------------------------------------
create or replace function teste.como_a_rotina(
  p_descricao text,
  p_comando   text,
  p_espera    text default 'ok'      -- 'ok' | 'recusa'
) returns void
language plpgsql
as $$
declare
  linhas integer;
begin
  begin
    execute 'set local role service_role';
    execute p_comando;
    get diagnostics linhas = row_count;
    execute 'reset role';

    if p_espera = 'recusa' then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU', format('passou quando devia ser recusado (%s linhas)', linhas));
    else
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', format('%s linha(s)', linhas));
    end if;
  exception when others then
    execute 'reset role';
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao,
            case when p_espera = 'recusa' then 'passou' else 'FALHOU' end,
            left(sqlerrm, 120));
  end;
end;
$$;

-- Atalhos de leitura, para nao repetir o uuid no texto dos cenarios.
create or replace function teste.limpar() returns void language plpgsql as $$
begin
  delete from public.task_history;
  delete from public.task_comentarios;
  delete from public.subtask_entregas;
  delete from public.approval_rounds;
  delete from public.subtask_dependencies;
  delete from public.subtasks;
  -- O POST DE UM MES DE SOCIAL SAI ANTES DA DEMANDA, e esta linha e um achado
  -- da 0088. `tasks_apaga_o_social` (0086) RECUSA apagar um mes que tem post
  -- ja enviado ao cliente -- e essa trava nunca disparava aqui porque a ponte
  -- antiga era `posts.subtask_id`, que o `delete from subtasks` acima zerava
  -- primeiro: `posts_do_mes()` achava zero e a limpeza passava. Era o mesmo
  -- furo que a 0086 existiu para fechar, dentro da propria ferramenta de
  -- teste. Com `posts.social_task_id` a trava passou a valer, e quem limpa
  -- precisa tirar o material antes da casca -- que e a ordem de
  -- `apagar_mes_de_social()`.
  delete from public.posts where social_task_id is not null;
  delete from public.tasks;
end $$;

-- Comparacao direta, para o que nao e questao de permissao e sim de calculo:
-- o status que o trigger produziu, o saldo de ferias, a contagem de dias
-- uteis. Vive aqui, e nao no arquivo que a usou primeiro, para qualquer
-- bateria poder rodar sozinha.
create or replace function teste.conferir(p_descricao text, p_achado text, p_esperado text)
returns void language plpgsql as $$
begin
  insert into teste.resultado (descricao, situacao, detalhe)
  values (p_descricao,
          case when p_achado is not distinct from p_esperado then 'passou' else 'FALHOU' end,
          format('esperado %s, achado %s', p_esperado, p_achado));
end $$;

-- Recusa com a mensagem certa.
--
-- `teste.cenario(..., 'recusa')` da por passado QUALQUER excecao, o que basta
-- quando a pergunta e "o RLS achou a linha?". Nao basta quando a mesma escrita
-- pode ser recusada por dois motivos diferentes e a mensagem e que diz qual:
-- uma trava que recusa pelo motivo errado esta quebrada e passaria assim
-- mesmo. Aqui o texto da recusa faz parte do que se verifica.
create or replace function teste.recusa_com(
  p_descricao text,
  p_uid uuid,
  p_comando text,
  p_trecho text               -- precisa aparecer na mensagem de erro
) returns void
language plpgsql
as $$
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    execute p_comando;
    execute 'reset role';
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'FALHOU', 'passou quando devia ser recusado');
  exception when others then
    execute 'reset role';
    if position(lower(p_trecho) in lower(sqlerrm)) > 0 then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', left(sqlerrm, 90));
    else
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU',
              format('recusou por outro motivo: %s', left(sqlerrm, 100)));
    end if;
  end;
end;
$$;


-- Recusa com a DICA certa.
--
-- `recusa_com` le so a mensagem, e a mensagem diz o problema. Quem diz a
-- SAIDA e o `hint` do Postgres -- e e ele que a tela mostra, porque
-- `atualizarTask` concatena os dois. Uma trava cuja mensagem esta certa e
-- cuja dica sumiu deixa a pessoa com um "nao pode" sem caminho, e passaria
-- por `recusa_com` sem nenhum sinal.
create or replace function teste.recusa_com_dica(
  p_descricao text,
  p_uid uuid,
  p_comando text,
  p_trecho text               -- precisa aparecer no HINT do erro
) returns void
language plpgsql
as $$
declare
  dica text;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    execute p_comando;
    execute 'reset role';
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'FALHOU', 'passou quando devia ser recusado');
  exception when others then
    execute 'reset role';
    get stacked diagnostics dica = pg_exception_hint;
    if position(lower(p_trecho) in lower(coalesce(dica, ''))) > 0 then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', left(dica, 90));
    else
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU',
              format('recusou sem essa dica. dica: %s', left(coalesce(dica, '(vazia)'), 100)));
    end if;
  end;
end;
$$;


-- ---------------------------------------------------------------------------
-- O VALOR QUE UMA PESSOA VE
--
-- `teste.conferir` compara um valor avaliado como dono do banco, e por isso
-- nenhuma policy se aplica a ele: ele responde "o que esta gravado", que e a
-- pergunta certa para um trigger e a errada para um indicador.
--
-- Uma metrica e outra coisa: ela devolve NUMEROS DIFERENTES conforme quem
-- pergunta, e e justamente isso que precisa ser provado -- que o pulso da
-- agencia nao vem para o colaborador, que a fila de aprovacao e zero para quem
-- nao decide. Sem este auxiliar, o unico jeito seria contar linhas, e uma
-- metrica nao devolve linhas: devolve um `jsonb` com sete chaves.
--
-- E UMA METRICA ERRADA NAO ESTOURA -- ela mostra outro numero. E o tipo de
-- erro que so um valor esperado, escrito a mao, encontra.
-- ---------------------------------------------------------------------------
create or replace function teste.conferir_como(
  p_descricao text,
  p_uid       uuid,
  p_expressao text,     -- um `select` que devolve UM valor
  p_esperado  text
) returns void
language plpgsql
as $$
declare
  achado text;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    execute p_expressao into achado;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'FALHOU', sqlerrm);
    return;
  end;

  if achado is not distinct from p_esperado then
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'passou', null);
  else
    insert into teste.resultado (descricao, situacao, detalhe)
    values (p_descricao, 'FALHOU',
            format('esperado %s, achado %s',
                   coalesce(p_esperado, '(nulo)'), coalesce(achado, '(nulo)')));
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- UM DIA UTIL NO PASSADO
--
-- Dois cenarios do lancamento retroativo (17) registravam uma ausencia de UM
-- DIA em `current_date - 40` e `current_date - 48`, e ausencia conta em dias
-- UTEIS desde a 0024: no dia em que aquele deslocamento cai num sabado,
-- `lancar_periodo` recusa com "O periodo escolhido nao tem nenhum dia util" e
-- a bateria fica vermelha por um motivo que nao e do produto. Em dois de cada
-- sete dias, cada um.
--
-- **E a armadilha que este projeto ja nomeou duas vezes**: as datas de clique
-- do prototipo passaram a ser CALCULADAS pela mesma razao, e a 0085 datou os
-- cenarios de saldo em `current_date` porque data fixa mede uma coisa hoje e
-- outra no ano que vem. Um cenario que passa conforme o dia da semana nao
-- prova o que ele diz.
--
-- Ela anda PARA TRAS a partir do deslocamento pedido, dia a dia, ate achar um
-- que `dias_uteis()` conte -- entao ela pula sabado, domingo E feriado, pela
-- mesma funcao que a trava usa. Andar para tras e nao para frente mantem a
-- data no passado, que e a premissa do lancamento retroativo.
--
-- O teto de 10 passos e para ela nao virar laco infinito num banco sem
-- `holidays` povoada: dez dias corridos sempre contem um dia util.
-- ---------------------------------------------------------------------------
create or replace function teste.dia_util_ha(p_dias integer)
returns date
language plpgsql
stable
as $$
declare
  alvo date := current_date - p_dias;
  i    integer := 0;
begin
  while i < 10 loop
    if public.dias_uteis(alvo, alvo) = 1 then
      return alvo;
    end if;
    alvo := alvo - 1;
    i := i + 1;
  end loop;

  raise exception 'teste.dia_util_ha(%): nenhum dia util nos 10 dias anteriores', p_dias;
end;
$$;

-- ===========================================================================
-- QUEM APROVA PELA CONTA DESTE MATERIAL (migration 0128).
--
-- Desde a 0128 toda rodada de escopo `cliente` precisa de `aprovador_id`, e
-- ele tem de ser uma pessoa ATIVA com acesso ao portal da empresa daquele
-- material. A bateria monta estado por `insert` direto, em trinta e tantos
-- lugares, e cada um pertence a uma das duas empresas do fixture.
--
-- **ISTO NÃO É CONVENIÊNCIA DE FIXTURE OCUPANDO O LUGAR DO CENÁRIO**, que é a
-- armadilha que este projeto pagou duas vezes — o `update` de
-- `responsavel_atendimento_id` que garantia a única condição em que o bug da
-- 0062 não acontece, e o `update` do arquivo 19 que pulava a RLS. Aqui a trava
-- continua inteira: ela recusa o nulo e recusa a pessoa de outra conta, e os
-- cenários do arquivo 47 medem as duas recusas direto. O que esta função faz é
-- a MESMA conta que o modal de envio faz — achar a conta do material e pegar
-- quem aprova por ela.
--
-- Escrever o uuid à mão em trinta inserts seria trinta lugares para errar a
-- empresa, e o erro apareceria como a bateria abortando no meio.
--
-- **ELA RECEBE SÓ O id, e a ausência do tipo é deliberada:** o chamador é um
-- `insert` cujo `content_id` já está escrito ali, com as aspas certas — e
-- metade deles vive DENTRO de um `format()`, onde um literal `'subtask'`
-- injetado fecharia a string. Sem segundo argumento não há literal novo para
-- escapar. Os QUATRO espaços de id não se cruzam, então procurar nos quatro é
-- exato.
--
-- **E O QUARTO É A DEMANDA DO MÊS, por causa do LOTE.**
-- `enviar_mes_ao_cliente()` recebe a demanda e não uma peça, e o arquivo 43 a
-- chama catorze vezes — com a 0128 as catorze passaram a precisar de um
-- aprovador. Uma segunda função respondendo *"quem aprova pela empresa desta
-- coisa"* seriam dois lugares para divergir, e o que divergiria é o do lote,
-- que é o caminho que a equipe usa de verdade. Então é a MESMA função, com um
-- `coalesce` a mais.
-- ===========================================================================
create or replace function teste.aprovador_de(p_id uuid)
returns uuid
language plpgsql
stable
as $$
declare
  conta uuid := coalesce(
    public.cliente_da_rodada('subtask', p_id),
    public.cliente_da_rodada('post', p_id),
    public.cliente_da_rodada('deliverable', p_id),
    (select t.client_id from public.tasks t where t.id = p_id)
  );
  quem uuid;
begin
  if conta is null then
    raise exception 'teste.aprovador_de(%): nao achei em subtasks, posts, deliverables nem tasks', p_id;
  end if;

  select cu.user_id into quem
    from public.client_users cu
    join public.profiles p on p.id = cu.user_id
   where cu.client_id = conta and p.ativo
   order by p.nome
   limit 1;

  if quem is null then
    raise exception 'teste.aprovador_de(%): a empresa % nao tem ninguem com acesso ao portal', p_id, conta;
  end if;

  return quem;
end;
$$;
