-- =====================================================================
-- 0127 — A RECUSA EXIGE MOTIVO, e o banco é que cobra
-- =====================================================================
--
-- Decisão do usuário, item 13: "APROVAR verde, AJUSTAR amarelo, RECUSAR
-- vermelho; em todos os módulos; textos+ícones; registrar no histórico;
-- justificativa na recusa; sincronizar portal/dashboard."
--
-- As cinco metades do pedido não custam a mesma coisa, e QUATRO delas já
-- existiam. Ir medir antes de escrever é o que separou as que precisavam de
-- código das que só precisavam ser nomeadas:
--
--   | o que ele pede            | onde já estava                           |
--   | ------------------------- | ---------------------------------------- |
--   | as três cores             | **não existia** — é a entrega da tela    |
--   | textos e ícones           | **divergia** — quatro desenhos, seis telas |
--   | registrar no histórico    | `approval_rounds`, sem policy de DELETE  |
--   | sincronizar portal/painel | o mapa único, por construção             |
--   | justificativa na recusa   | **só metade** — e é esta migration       |
--
-- -------------------------------------------------------------- o achado --
--
-- O CLAUDE.md afirmava, desde a 0032, que *"os dois desfechos negativos
-- exigem motivo, na ação E no banco"*. A primeira metade é verdade; a segunda
-- vale para UM dos dois.
--
-- Medido contra este banco, e não lido:
--
--   * `approval_rounds` tem **um** check, e ele é o de `content_type`;
--   * dos **onze** triggers da tabela, só `proteger_rodada_fechada` cobra
--     comentário — e o ramo dele pergunta `status = 'ajustes_solicitados'`
--     e mais nada;
--   * nenhum outro trigger pergunta por `comentario` como exigência.
--
-- Então `status = 'rejeitada'` com `comentario` nulo **passa pelo banco**. Quem
-- exigia era `decidir_rodada_do_cliente` (o caminho do Portal) e os `if` das
-- Server Actions — ou seja, exatamente os caminhos que passam pela tela, que
-- são os que ninguém duvidava. **O caminho que a trava existe para cobrir é o
-- outro**: o PATCH montado à mão, o `update` colado no SQL Editor, o seed.
--
-- É a 0029 e a 0060 vistas do avesso. Lá a regra morava nos dois lados e
-- desfazer um não desfez nada; aqui eu escrevi que ela morava nos dois lados e
-- ela morava em um. O custo de afirmar aqui uma propriedade que não foi
-- conferida é que ela passa a ser lida como verdade por quem vier depois — é a
-- mesma falha da frase sobre a pilha de avatares não custar consulta, e da
-- frase sobre o aviso da rodada interna alcançar o entregável.
--
-- ------------------------------------------- por que o CHECK e o TRIGGER --
--
-- **São os dois, e o argumento está escrito na 0084:** *"Período invertido é
-- recusado nomeando a ETAPA, e não pelo `check` da tabela [...] O `check`
-- fica, e é ele que segura quem monta o `update` à mão — a diferença de sempre
-- entre 'a tela não faz' e 'o banco não aceita'."*
--
--   * o **check** é o piso, e ele pega o que o trigger NÃO tem como pegar: o
--     `insert` que já nasce `rejeitada`. `proteger_rodada_fechada` é
--     `before update` e o ramo dele olha a TRANSIÇÃO — uma rodada inserida
--     direto no desfecho negativo nunca passa por ele;
--   * o **trigger** é quem escreve a frase que a pessoa lê. A recusa de um
--     check chega como *"violates check constraint
--     approval_rounds_desfecho_negativo_com_motivo"*, e `atualizarTask`
--     concatena o `hint` do Postgres na mensagem da tela: uma trava com a
--     frase em inglês e o nome da constraint dentro é uma trava que não
--     ensina nada.
--
-- **E o check cabe porque foi medido:** `approval_rounds` tem hoje 31 rodadas
-- `aprovada` (todas sem comentário, que é o certo — aprovar não se explica) e
-- 5 `pendente`. **Nenhuma linha está num desfecho negativo**, então ele se
-- aplica sem passada de conversão. Fosse diferente, a saída seria o trigger
-- sozinho, que é a decisão da 0015: `not null` quebraria a migration em
-- qualquer ambiente com linha anterior à regra, e preencher as antigas com um
-- valor qualquer seria inventar o motivo que alguém não escreveu.
--
-- **Os três `rejeitada` do seed e da bateria carregam motivo**, conferido
-- antes: o post do concorrente, a peça do logo pequeno e a recusa interna da
-- campanha. O cenário da 0032 que prova a recusa do ajuste sem motivo
-- continua falhando pelo mesmo lugar.
--
-- **APROVAR CONTINUA SEM EXIGIR NADA**, e a assimetria é a regra do produto
-- desde a 0007: aprovar é a decisão que não precisa de explicação; recusar e
-- pedir ajuste sem dizer por quê mandam a equipe adivinhar, e a próxima versão
-- volta igual.
--
-- Re-executável.
-- =====================================================================


-- --------------------------------------------------------------------- 1 --
-- O PISO: o desfecho negativo sem motivo não entra, por nenhum caminho.
--
-- Um `check` e não um trigger novo porque **não há nada a reescrever** — é o
-- critério da 0082 — e porque ele é a única forma que alcança o `insert`.
-- Ele cobre OS DOIS desfechos negativos: `ajustes_solicitados` já era cobrido
-- na transição, e aqui ele passa a ser cobrido também na criação.

alter table public.approval_rounds
  drop constraint if exists approval_rounds_desfecho_negativo_com_motivo;

alter table public.approval_rounds
  add constraint approval_rounds_desfecho_negativo_com_motivo
  check (
    status not in ('ajustes_solicitados', 'rejeitada')
    or (comentario is not null and btrim(comentario) <> '')
  );


-- --------------------------------------------------------------------- 2 --
-- A FRASE QUE A PESSOA LÊ.
--
-- A função é COPIADA INTEIRA e não remendada, que é a lição da 0030:
-- `create or replace function` se reescreve a partir do texto que se escreve
-- agora, e **não avisa quando o texto novo tem menos coisa que o velho** —
-- foi assim que a 0030 perdeu o bloco de carimbos de
-- `validar_transicao_de_subtarefa` e só apareceu na 0052. Os dois ramos que
-- já estavam aqui — a rodada decidida que não muda de resultado, e o carimbo
-- de `decidido_em` — estão os dois abaixo, palavra por palavra.
--
-- `create or replace` é seguro: mesma assinatura, mesmo retorno, e o trigger
-- `approval_rounds_protege_fechada` continua apontando para ela. Um
-- `drop`+`create` abriria a janela em que a tela no ar chama uma função que
-- não existe — o que a 0120 pagou.

create or replace function public.proteger_rodada_fechada()
returns trigger
language plpgsql
as $fn$
begin
  if old.status <> 'pendente' and new.status <> old.status then
    raise exception using
      errcode = 'check_violation',
      message = 'Rodada de aprovação já decidida não muda de resultado.',
      hint    = 'Cada ciclo de correção cria uma rodada nova, com número maior.';
  end if;

  if new.status <> 'pendente' and old.status = 'pendente' then
    new.decidido_em := coalesce(new.decidido_em, now());
  end if;

  if new.status = 'ajustes_solicitados'
     and (new.comentario is null or btrim(new.comentario) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'Pedir ajustes exige um comentário dizendo o que ajustar.',
      hint    = 'Sem ele, quem produziu não sabe o que refazer e a próxima versão volta igual.';
  end if;

  -- O RAMO NOVO, e a frase não é a de cima com outra palavra: pedir ajustes e
  -- recusar querem dizer coisas opostas — *mude isto e volte* contra *não vai
  -- ao ar desta forma*. Quem lê a recusa precisa saber o que aconteceu com o
  -- material, e a dica oferece a outra saída, que é quase sempre a que a
  -- pessoa queria: é a decisão da 0023, dizer QUAL é a diferença entre uma
  -- recusa e uma instrução.
  if new.status = 'rejeitada'
     and (new.comentario is null or btrim(new.comentario) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'Recusar exige o motivo escrito.',
      hint    = 'Recusar diz que o material não vai ao ar desta forma. Se o caminho é refazer, o desfecho é "Solicitar ajustes".';
  end if;

  return new;
end;
$fn$;


-- --------------------------------------------------------------------- 3 --
-- Conferência. Roda depois de colar, e o resultado tem de ser três `sim`.

select
  exists (
    select 1 from pg_constraint
     where conrelid = 'public.approval_rounds'::regclass
       and conname = 'approval_rounds_desfecho_negativo_com_motivo'
  ) as o_check_existe,
  position('new.status = ''rejeitada''' in pg_get_functiondef('public.proteger_rodada_fechada'::regproc)) > 0
    as o_trigger_cobra_a_recusa,
  position('decidido_em := coalesce' in pg_get_functiondef('public.proteger_rodada_fechada'::regproc)) > 0
    as o_carimbo_continua_de_pe;
