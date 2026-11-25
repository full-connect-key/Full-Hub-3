-- ===========================================================================
-- 51 - A ETAPA DO WORKFLOW DISPARA EM DIAS DA SEMANA (migration 0152)
--
-- Decisao do usuario: *"uma das tarefas da agencia sao os email marketings,
-- preciso que quando eu va montar o workflow, eu possa selecionar quais dias
-- os emails sao disparados, no caso sao 4 por semana, e sempre que eu for
-- abrir, as tasks ja tenham o nome como o dia que ela deve ser postada"*.
--
-- ---------------------------------------------------------------------------
-- O ARQUIVO COBRE A 0140 TAMBEM, E E POR ISSO QUE ELE EXISTE INTEIRO
--
-- O cabecalho da 0140 declarou que a bateria nao tinha sido rodada -- nao
-- havia Postgres local naquele dia --, entao as QUATRO recusas da quantidade
-- (6 a 9) nunca tiveram cenario. Elas entram aqui, e nao por zelo: o cabecalho
-- da 0152 afirma, em voz alta, que a recusa 11 (dia marcado pede mais de uma
-- peca) e o que faz a recusa 7 da 0140 cobrir "dias da semana e sub-etapas
-- escritas a mao nao convivem". **Essa frase e uma afirmacao sobre a recusa 7,
-- e medir a 11 sem medir a 7 e afirmar sem provar.**
--
-- E ha o outro lado: `conferir_etapas_do_workflow()` foi COPIADA INTEIRA pela
-- 0152, que e a licao da 0030 -- `create or replace` nao avisa quando o texto
-- novo tem menos coisa que o velho. Os cenarios das nove recusas anteriores
-- sao o que impede a copia de perder uma delas em silencio.
--
-- ---------------------------------------------------------------------------
-- A ORDEM ENTRE AS RECUSAS 10 E 11 TEM CENARIO PROPRIO
--
-- Uma sub-etapa com dia marcado cai nas DUAS: ela e sub-etapa (10) e entrega
-- uma peca so (11), porque a recusa 6 ja impede a sub-etapa de entregar mais
-- de uma. A 10 vem antes, e e a certa -- "nao pode ter dias da semana" nomeia
-- a estrutura; "entrega uma peca so" mandaria aumentar um numero que a recusa
-- 6 nao deixa aumentar. Sem este cenario a ordem poderia inverter e as duas
-- versoes passariam por um teste que so conta recusas.
-- ===========================================================================

\set ANA    '''11111111-1111-1111-1111-111111111111'''
\set DIEGO  '''22222222-2222-2222-2222-222222222222'''
\set BRUNO  '''44444444-4444-4444-4444-444444444444'''

\set VERDE  '''aaaaaaaa-0000-0000-0000-000000000001'''

\set WMAIL  '''e1520000-0000-4000-8000-000000000001'''
\set WRUIM  '''e1520000-0000-4000-8000-000000000002'''

select teste.limpar();


-- ---------------------------------------------------------------------------
-- 1. O WORKFLOW DE E-MAIL MARKETING E ACEITO
--
-- A cadeia inteira num `insert` so, que e como `regravarEtapas()` grava e o que
-- o gatilho por INSTRUCAO espera: com `for each row` a sub-etapa entraria antes
-- de o pai existir para a linha dela.
--
-- Vinte pecas em quatro dias e `quantidade = 20` com `dias_da_semana =
-- {1,2,4,5}` -- a quantidade NAO muda de significado, e e isso que faz esta
-- migration ser uma coluna em vez de duas.
-- ---------------------------------------------------------------------------
insert into public.workflow_templates (id, nome)
values (:WMAIL, 'E-mail marketing')
on conflict (id) do nothing;

insert into public.workflow_steps
  (template_id, nome, ordem, parent_ordem, funcao_padrao, prazo_offset_dias,
   quantidade, dias_da_semana)
values
  (:WMAIL, 'Pauta do mes',        10, null, 'Atendimento', 2,  1, '{}'),
  (:WMAIL, 'Escrever os e-mails', 20, null, 'Redator',     5, 20, '{1,2,4,5}'),
  (:WMAIL, 'Relatorio de envio',  30, null, 'Trafego',     35, 1, '{}');

select teste.conferir('O workflow de e-mail marketing e aceito',
  (select count(*)::text from public.workflow_steps where template_id = :WMAIL),
  '3');

select teste.conferir('A etapa do meio guarda os quatro dias',
  (select cardinality(dias_da_semana)::text from public.workflow_steps
    where template_id = :WMAIL and ordem = 20),
  '4');

select teste.conferir('E a quantidade continua sendo quantas PECAS',
  (select quantidade::text from public.workflow_steps
    where template_id = :WMAIL and ordem = 20),
  '20');

-- A LISTA VAZIA E O CASO COMUM, e e por isso que a coluna e `not null default
-- '{}'`: com nulo, a pergunta "tem dia marcado?" seria `is not null and
-- cardinality > 0` em cada leitura, e o segundo termo e o que alguem esquece.
select teste.conferir('A etapa de sempre nasce com a lista vazia e nao com nulo',
  (select coalesce(cardinality(dias_da_semana)::text, 'nulo')
     from public.workflow_steps where template_id = :WMAIL and ordem = 10),
  '0');


-- ---------------------------------------------------------------------------
-- 2. A RESOLUCAO PELA CONTA CARREGA OS DIAS
--
-- Este e o cenario do PASSO 4, e ele e o que impede a ponte construida e nunca
-- atravessada: `etapasDoWorkflow()` le esta funcao SEMPRE que ha conta -- que e
-- sempre, ao aplicar numa demanda ou numa campanha --, e a leitura crua so em
-- pre-visualizacao. Sem a coluna no `returns table` os dias existiriam na
-- tabela, apareceriam no editor, e nao chegariam a subtarefa nenhuma.
--
-- E o `drop function` antes do `create` e obrigatorio -- `create or replace`
-- nao troca o tipo de retorno de uma funcao `returns table` --, entao os grants
-- vao com ele: o cenario de baixo e o que confere que o `grant` voltou.
-- ---------------------------------------------------------------------------
select teste.conferir_como('A resolucao pela conta devolve os dias de disparo', :ANA,
  format($fmt$
    select array_to_string(dias_da_semana, ',')
      from public.etapas_resolvidas_do_workflow(%L, %L)
     where ordem = 20
  $fmt$, :WMAIL, :VERDE),
  '1,2,4,5');

select teste.conferir_como('E a etapa sem dias volta com a lista vazia', :ANA,
  format($fmt$
    select cardinality(dias_da_semana)::text
      from public.etapas_resolvidas_do_workflow(%L, %L)
     where ordem = 10
  $fmt$, :WMAIL, :VERDE),
  '0');

-- O COLABORADOR TAMBEM LE, e e o desenho: `workflow_steps_select` e
-- `is_staff()` desde a 0007, e quem aplica um workflow numa demanda pode ser o
-- colaborador do Atendimento.
--
-- ESTE CENARIO NAO MEDE O `grant` DO PASSO 4, e a correcao vem de uma medicao:
-- tirando aquele `grant`, ele passa do mesmo jeito. O fixture replica o
-- `alter default privileges in schema public grant all on functions to anon,
-- authenticated, service_role` que o Supabase deixa ligado, entao a funcao
-- recem-criada nasce executavel por `authenticated` sem grant nenhum. **O que
-- o `grant` explicito compra e independencia daquela configuracao** -- no dia
-- em que alguem a apertar, a funcao continua chamavel. Quem mede o par
-- `revoke`/`grant` e o cenario de `anon` logo abaixo.
select teste.conferir_como('E quem nao e gestao chama a funcao do mesmo jeito', :BRUNO,
  format($fmt$
    select array_to_string(dias_da_semana, ',')
      from public.etapas_resolvidas_do_workflow(%L, %L)
     where ordem = 20
  $fmt$, :WMAIL, :VERDE),
  '1,2,4,5');

-- E `anon` NAO CHAMA, que e o que mede o `revoke` do PASSO 4 (0152). A funcao
-- nao e `security definer` e `workflow_steps_select` e `to authenticated`, ou
-- seja `anon` leria zero linha de qualquer forma -- entao isto e a ACL dizendo
-- o que o comentario da migration diz, e nao uma trava que faltava. Sem o
-- `revoke ... from anon`, o `alter default privileges` do fixture deixa a
-- funcao executavel pela chave publica e este cenario passa a PASSAR o comando.
--
-- `teste.recusa_como_anon` e definida no arquivo 27, que roda antes deste.
select teste.recusa_como_anon('E a chave publica nao chama a resolucao',
  format('select * from public.etapas_resolvidas_do_workflow(%L, %L)', :WMAIL, :VERDE),
  'permission denied');


-- ---------------------------------------------------------------------------
-- 3. O CHECK: O DIA EXISTE, E NAO REPETE
--
-- A recusa chega com o NOME DA CONSTRAINT, em ingles, e isso e deliberado: nao
-- ha trigger ao lado dela, porque nao ha frase a escrever -- um dia 7 ou um dia
-- repetido nao e uma escolha que a pessoa fez na tela, e um PATCH montado a
-- mao. O chip oferece sete dias e marca cada um uma vez.
--
-- **A trava e funcao e nao expressao inline** porque "nao repete nenhum" e uma
-- subconsulta, e o Postgres recusa subconsulta dentro de check constraint -- a
-- forma de `redes_sem_repeticao()` (0082).
-- ---------------------------------------------------------------------------
select teste.recusa_com('O dia 7 nao existe', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem, quantidade, dias_da_semana)
    values (%L, 'Dia que nao existe', 90, 5, '{1,7}')
  $fmt$, :WMAIL),
  'workflow_steps_dias_da_semana_validos');

select teste.recusa_com('Nem o dia -1', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem, quantidade, dias_da_semana)
    values (%L, 'Dia negativo', 91, 5, '{-1,2}')
  $fmt$, :WMAIL),
  'workflow_steps_dias_da_semana_validos');

select teste.recusa_com('E o mesmo dia nao entra duas vezes', :ANA,
  format($fmt$
    insert into public.workflow_steps (template_id, nome, ordem, quantidade, dias_da_semana)
    values (%L, 'Segunda em dobro', 92, 5, '{1,1}')
  $fmt$, :WMAIL),
  'workflow_steps_dias_da_semana_validos');

-- OS SETE JUNTOS PASSAM, e a ausencia de teto e decisao: uma campanha que
-- dispara todo dia da semana e sete dias marcados, nao um caso de borda.
insert into public.workflow_steps
  (template_id, nome, ordem, quantidade, dias_da_semana)
values (:WMAIL, 'Todo dia', 40, 14, '{0,1,2,3,4,5,6}');

select teste.conferir('Os sete dias da semana juntos sao aceitos',
  (select cardinality(dias_da_semana)::text from public.workflow_steps
    where template_id = :WMAIL and ordem = 40),
  '7');

-- A ORDEM EM QUE OS DIAS FORAM MARCADOS NAO E NORMALIZADA, e isso fica dito:
-- `{5,1}` e gravado como `{5,1}`. Quem ordena e a tela, por `rotuloDosDias()`,
-- e a expansao pergunta `= any(dias)` -- nenhuma das duas depende da ordem do
-- array. Normalizar no banco seria uma segunda verdade sobre a mesma lista.
insert into public.workflow_steps
  (template_id, nome, ordem, quantidade, dias_da_semana)
values (:WMAIL, 'Fora de ordem', 50, 4, '{5,1}');

select teste.conferir('A ordem do array e a do clique, e o banco nao a reescreve',
  (select array_to_string(dias_da_semana, ',') from public.workflow_steps
    where template_id = :WMAIL and ordem = 50),
  '5,1');

delete from public.workflow_steps where template_id = :WMAIL and ordem in (40, 50);


-- ---------------------------------------------------------------------------
-- 4. RECUSA 10 - OS DIAS SAO DE ETAPA DE TOPO
--
-- Pela razao da recusa 6: os disparos NASCEM como as sub-etapas desta etapa, e
-- uma sub-etapa que os tivesse precisaria de um terceiro nivel para eles --
-- `subtasks_agrupadora` (0022) recusa a neta, e a recusa chegaria na hora de
-- aplicar, falando de subtarefa, sobre um workflow montado semanas antes.
--
-- A SUB-ETAPA ENTRA COM `quantidade` 1 de proposito: com 2 a recusa 6 dispara
-- antes e este cenario mediria ELA. E o que ele prova e a ORDEM -- a sub-etapa
-- com dia marcado cai na 10 e nao na 11, embora caiba nas duas.
-- ---------------------------------------------------------------------------
insert into public.workflow_templates (id, nome)
values (:WRUIM, 'Workflow para as recusas')
on conflict (id) do nothing;

insert into public.workflow_steps
  (template_id, nome, ordem, parent_ordem, funcao_padrao, prazo_offset_dias)
values
  (:WRUIM, 'Arte',        10, null, 'Design', 5),
  (:WRUIM, 'Adaptacoes',  11,   10, 'Design', 6);

select teste.recusa_com('A sub-etapa nao pode ter dias da semana', :ANA,
  format($fmt$
    update public.workflow_steps set dias_da_semana = '{1,4}'
     where template_id = %L and ordem = 11
  $fmt$, :WRUIM),
  'não pode ter dias da semana');

-- E ELA RECUSA PELA 10 E NAO PELA 11, que e o cenario da ordem: a frase da 11
-- mandaria aumentar um numero que a recusa 6 nao deixa aumentar.
select teste.recusa_com('E recusa nomeando a estrutura, nunca a quantidade', :ANA,
  format($fmt$
    update public.workflow_steps set dias_da_semana = '{1,4}'
     where template_id = %L and ordem = 11
  $fmt$, :WRUIM),
  'A sub-etapa "Adaptacoes"');


-- ---------------------------------------------------------------------------
-- 5. RECUSA 11 - DIA MARCADO PEDE MAIS DE UMA PECA
--
-- E a recusa que impede um segundo significado para a coluna: com quantidade 1
-- a etapa NAO vira grupo (0140), entao os dias passariam a decidir o prazo
-- DELA mesma -- um calendario escrito num campo que ja tem o
-- `prazo_offset_dias` ao lado.
--
-- A DICA TEM CENARIO PROPRIO porque ela e a unica coisa que diz a SAIDA, e sao
-- duas: dizer quantas pecas, ou desmarcar os dias. `recusa_com` le so a
-- mensagem, e uma trava com a dica apagada passaria por ela sem sinal.
--
-- A ETAPA DESTA SECAO E UMA TERCEIRA e nao a "Arte" da secao acima, e a razao
-- e a propria recusa 7: "Arte" tem sub-etapa, entao subir a quantidade DELA e
-- recusado por outro motivo -- e um cenario recusado pelo motivo errado esta
-- quebrado e passaria por um teste que so conta recusas.
-- ---------------------------------------------------------------------------
insert into public.workflow_steps
  (template_id, nome, ordem, funcao_padrao, prazo_offset_dias)
values (:WRUIM, 'Teaser', 15, 'Redator', 4);

select teste.recusa_com('A etapa de uma peca so nao tem dias da semana', :ANA,
  format($fmt$
    update public.workflow_steps set dias_da_semana = '{1,4}'
     where template_id = %L and ordem = 15
  $fmt$, :WRUIM),
  'entrega uma peça só');

select teste.recusa_com_dica('E a recusa diz as duas saidas', :ANA,
  format($fmt$
    update public.workflow_steps set dias_da_semana = '{1,4}'
     where template_id = %L and ordem = 15
  $fmt$, :WRUIM),
  'desmarque os dias');

-- A VOLTA PASSA: dizer quantas pecas e a primeira das duas saidas, e ela e o
-- caminho que a tela oferece. Num `update` so, que e como `regravarEtapas()`
-- grava -- separados, o primeiro cairia na propria recusa.
update public.workflow_steps
   set quantidade = 8, dias_da_semana = '{1,4}'
 where template_id = :WRUIM and ordem = 15;

select teste.conferir('Com oito pecas os dois dias passam',
  (select cardinality(dias_da_semana)::text from public.workflow_steps
    where template_id = :WRUIM and ordem = 15),
  '2');

-- E DESMARCAR OS DIAS E A OUTRA, que e o caminho de quem volta a uma peca so:
-- com os dias de pe, baixar a quantidade e recusado -- e e exatamente por isso
-- que a tela limpa os dias no payload do Salvar, e nao no chip.
select teste.recusa_com('Baixar para uma peca com os dias marcados e recusado', :ANA,
  format($fmt$
    update public.workflow_steps set quantidade = 1
     where template_id = %L and ordem = 15
  $fmt$, :WRUIM),
  'entrega uma peça só');

update public.workflow_steps
   set quantidade = 1, dias_da_semana = '{}'
 where template_id = :WRUIM and ordem = 15;

select teste.conferir('Desmarcando os dias, a etapa volta a entregar uma peca',
  (select quantidade::text || '/' || cardinality(dias_da_semana)::text
     from public.workflow_steps where template_id = :WRUIM and ordem = 15),
  '1/0');


-- ---------------------------------------------------------------------------
-- 6. AS QUATRO RECUSAS DA QUANTIDADE CONTINUAM DE PE DEPOIS DA COPIA
--
-- A 0152 copiou `conferir_etapas_do_workflow()` INTEIRA, e `create or replace`
-- nao avisa quando o texto novo tem menos coisa que o velho -- foi assim que a
-- 0030 perdeu o bloco de carimbos de `validar_transicao_de_subtarefa` e so
-- apareceu na 0052. Estes quatro cenarios sao o que impede a proxima copia de
-- perder uma recusa em silencio, e eles nunca existiram: o cabecalho da 0140
-- declarou que a bateria nao tinha sido rodada.
-- ---------------------------------------------------------------------------
select teste.recusa_com('6. A sub-etapa nao entrega mais de uma peca', :ANA,
  format($fmt$
    update public.workflow_steps set quantidade = 4
     where template_id = %L and ordem = 11
  $fmt$, :WRUIM),
  'não pode entregar mais de uma peça');

-- 7. A QUANTIDADE E AS SUB-ETAPAS SAO A MESMA COISA, e e esta recusa que o
--    cabecalho da 0152 usa para dizer que "dias da semana e sub-etapas escritas
--    a mao nao convivem" ja esta coberto: a recusa 11 forca `quantidade >= 2`,
--    e com ela a 7 pega.
select teste.recusa_com('7. A etapa com sub-etapa nao entrega varias pecas', :ANA,
  format($fmt$
    update public.workflow_steps set quantidade = 4
     where template_id = %L and ordem = 10
  $fmt$, :WRUIM),
  'já tem sub-etapas');

-- E E ISSO QUE FECHA A FRASE DA 0152: marcar dias numa etapa que tem sub-etapa
-- escrita a mao e recusado pelo caminho da quantidade, sem uma recusa 12.
select teste.recusa_com('E por ela, dias numa etapa com sub-etapa tambem e recusado', :ANA,
  format($fmt$
    update public.workflow_steps set quantidade = 4, dias_da_semana = '{1,4}'
     where template_id = %L and ordem = 10
  $fmt$, :WRUIM),
  'já tem sub-etapas');

delete from public.workflow_steps where template_id = :WRUIM and ordem = 11;

select teste.recusa_com('8. A etapa que entrega N pecas nao espera outra', :ANA,
  format($fmt$
    insert into public.workflow_steps
      (template_id, nome, ordem, quantidade, depende_de_ordem, dias_da_semana)
    values (%L, 'Disparos que esperam', 20, 8, 10, '{1,4}')
  $fmt$, :WRUIM),
  'não pode esperar outra etapa');

insert into public.workflow_steps
  (template_id, nome, ordem, quantidade, dias_da_semana)
values (:WRUIM, 'Disparos', 20, 8, '{1,4}');

select teste.recusa_com('9. E nem e esperada', :ANA,
  format($fmt$
    insert into public.workflow_steps
      (template_id, nome, ordem, depende_de_ordem)
    values (%L, 'Relatorio', 30, 20)
  $fmt$, :WRUIM),
  'ela entrega várias peças');


-- ---------------------------------------------------------------------------
-- 7. QUEM MONTA O WORKFLOW E A GESTAO
--
-- A policy nao mudou na 0152, e o cenario existe porque ela e a unica coisa
-- entre o editor e a tabela: `workflow_steps_write` e `is_gestor()` desde a
-- 0007, e um dia marcado por quem nao monta workflow seria um calendario de
-- disparo escrito por quem nao responde por ele.
-- ---------------------------------------------------------------------------
select teste.cenario('O colaborador nao marca dia de disparo', :BRUNO,
  format($fmt$
    update public.workflow_steps set dias_da_semana = '{2,3}'
     where template_id = %L and ordem = 20
  $fmt$, :WRUIM),
  'recusa');

select teste.conferir('E os dias continuam os que a gestao marcou',
  (select array_to_string(dias_da_semana, ',') from public.workflow_steps
    where template_id = :WRUIM and ordem = 20),
  '1,4');
