-- ===========================================================================
-- A REGRA DO DESCANSO VALE NESTE BANCO?
--
-- Combinado com o usuario, palavra por palavra:
--
--   "A pessoa ao completar um ano de agencia, tem direito a 15 dias de
--    descanso, o periodo subsequente a completar um ano. Quando ela completa
--    dois anos de agencia, automaticamente, a contagem de dias retorna ou
--    permanece em 15 dias (...). Se eu entrei na agencia a um ano atras, e
--    tiro 10 dias, quando completar 2 anos essa contagem volta a 15, nenhum
--    dia a mais ou a menos. Se eu nao tiver tirado nenhum dia de descanso, a
--    contagem permanece em 15 dias."
--
-- Cola no SQL Editor. **ELE NAO ESCREVE NADA** -- nem uma linha, nem numa
-- transacao que se desfaz depois. Sao quatro `select`, e por isso da para
-- rodar no meio de uma apresentacao sem pensar duas vezes.
--
-- VER TAMBEM: `scripts/zerar-full-days.sql`, que zera os periodos e a matriz.
--
-- ---------------------------------------------------------------------------
-- POR QUE ELE LE O CODIGO DA FUNCAO, e nao o saldo de alguem.
--
-- O saldo de uma pessoa de verdade nao distingue as duas versoes da regra:
-- quem tem um ciclo so e nunca tirou nada mostra 15 na versao certa E na
-- errada. A diferenca entre "restaura" e "acumula" so aparece em quem tem
-- DOIS ciclos, e pode nao haver ninguem assim na agencia hoje -- e e
-- exatamente a lição do `security_invoker` da `calendar_events`: num banco com
-- um cliente so, vazar tudo e mostrar o certo tem a mesma cara.
--
-- Entao o PASSO 1 pergunta ao Postgres qual VERSAO de cada funcao esta
-- instalada, por `pg_get_functiondef`. Isso responde sempre, com zero pessoa
-- cadastrada, e nao depende de quem ja completou dois anos.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- PASSO 1 -- QUAL VERSAO DA REGRA ESTA INSTALADA
--
-- As cinco linhas tem de dar VALE. Qualquer "NAO VALE" diz, na ultima coluna,
-- a migration que falta aplicar.
--
-- ---------------------------------------------------------------------------
-- NENHUMA DAS QUATRO PROCURA TEXTO NO CORPO DA FUNCAO, e a primeira versao
-- deste arquivo procurava -- e deu NAO VALE num banco com TUDO aplicado.
--
-- O motivo e a armadilha que este projeto ja pagou sete vezes: o comentario da
-- 0085 EXPLICA a mudanca citando a expressao antiga (`por_ciclo * ciclos`), e
-- `pg_get_functiondef` devolve o corpo com os comentarios dentro. A explicacao
-- nao pode carregar o que ela proibe.
--
-- Entao tres perguntam se uma funcao EXISTE e duas medem o que o banco
-- RESPONDE. Comentario nenhum falsifica nenhuma das duas.
-- ---------------------------------------------------------------------------

select * from (
  -- 1. `descanso_usado_no_ciclo()` NASCEU na 0085, junto com a regra de
  --    restaurar. Antes dela a conta do usado era inline dentro de
  --    `saldo_de_ferias()`, sem funcao propria -- entao a existencia dela E a
  --    migration, sem ambiguidade.
  select 1 as n,
         'Os 15 dias RESTAURAM, nao acumulam'                        as a_regra,
         case when to_regprocedure('public.descanso_usado_no_ciclo(uuid)') is not null
                then 'VALE'
              else 'NAO VALE -- o saldo soma um bloco por ciclo' end  as neste_banco,
         case when to_regprocedure('public.descanso_usado_no_ciclo(uuid)') is not null
                then ''
              else 'aplicar supabase/migrations/0085_o_descanso_nao_acumula.sql' end as o_que_falta
  union all
  -- 2. MEDIDO, e com um uuid que nao e de ninguem: sem ficha, a 0074 devolve
  --    ZERO ciclo ("quem chegou ainda nao conquistou") e a 0039 devolvia UM.
  --    Nao cria linha nenhuma e nao depende de haver gente cadastrada.
  select 2,
         'Os 15 chegam ao COMPLETAR 12 meses, nao ao entrar',
         case when public.ciclos_de_descanso('00000000-0000-0000-0000-000000000000') = 0
                then 'VALE'
              else 'NAO VALE -- quem entrou hoje ja recebe 15' end,
         case when public.ciclos_de_descanso('00000000-0000-0000-0000-000000000000') = 0
                then ''
              else 'aplicar supabase/migrations/0074_o_descanso_se_conquista.sql' end
  union all
  -- 3. A 0039 APAGOU a versao de dois argumentos, que era a do ano civil. Se
  --    ela ainda existe, o ciclo por entrada nao entrou -- e se as duas
  --    existissem, uma chamada ficaria ambigua, que e a pegadinha da 0061.
  select 3,
         'O ciclo conta da ENTRADA da pessoa, nao do ano civil',
         case when to_regprocedure('public.saldo_de_ferias(uuid,integer)') is null
                then 'VALE'
              else 'NAO VALE -- o ciclo ainda zera em 1o de janeiro' end,
         case when to_regprocedure('public.saldo_de_ferias(uuid,integer)') is null
                then ''
              else 'aplicar supabase/migrations/0039_o_ciclo_conta_da_entrada.sql' end
  union all
  -- 4. MEDIDO: de uma segunda a uma segunda tres semanas depois sao 15 dias
  --    corridos e 11 uteis. O numero separa as duas versoes sozinho.
  select 4,
         'Os 15 dias contam CORRIDOS; os outros dois tipos, uteis',
         case when public.dias_do_pedido('ferias', date '2026-11-02', date '2026-11-16') = 15
                then 'VALE'
              else 'NAO VALE -- o descanso ainda conta em dias uteis' end,
         case when public.dias_do_pedido('ferias', date '2026-11-02', date '2026-11-16') = 15
                then ''
              else 'aplicar supabase/migrations/0024_o_descanso_conta_corrido.sql' end
  union all
  -- 5. A FUNCAO QUE A TELA CHAMA, e ela e a quinta porque custou um relato:
  --    a faixa do Day Off dizia *"voce tem 15 de 15 dias disponiveis"* para
  --    quem tinha day off aprovado. A conta estava certa nas quatro linhas
  --    acima -- quem nao respondia era `descanso_do_ciclo()`, que a 0085
  --    recria no PASSO 6 depois de um `drop function if exists`. Uma colagem
  --    que morre entre o PASSO 1 e o 6 deixa o banco sem ela, e as quatro
  --    perguntas de cima continuam dando VALE.
  --
  --    A tela lia o nulo como "nao ha saldo" e preenchia um ciclo cheio. Os
  --    dois lados foram consertados; esta linha e o terceiro, porque quem for
  --    procurar a causa de novo comeca por aqui.
  select 5,
         'A tela tem como PERGUNTAR o saldo',
         case when to_regprocedure('public.descanso_do_ciclo(uuid)') is not null
                then 'VALE'
              else 'NAO VALE -- a faixa do Day Off nao recebe numero nenhum' end,
         case when to_regprocedure('public.descanso_do_ciclo(uuid)') is not null
                then ''
              else 'recolar supabase/migrations/0085_o_descanso_nao_acumula.sql do PASSO 6 em diante' end
) t order by n;


-- ===========================================================================
-- PASSO 2 -- O CICLO DE CADA PESSOA, hoje
--
-- `concedidos` e sempre o numero do contrato (15), nunca a soma da vida.
-- `restaura_em` e o dia em que ele volta inteiro e o que sobrou se perde.
-- ===========================================================================

select p.nome,
       tm.data_admissao                      as entrou_em,
       public.ciclos_de_descanso(p.id)       as aniversarios,
       case when public.ciclos_de_descanso(p.id) = 0
            then 0 else coalesce(tm.dias_ferias_ano, 15) end as concedidos,
       -- A CONTA VAI INLINE, e nao por `descanso_usado_no_ciclo()`: ela e uma
       -- das funcoes que o PASSO 1 diagnostica, e um diagnostico nao pode
       -- depender da coisa que ele esta diagnosticando -- num banco pre-0085
       -- o arquivo estourava aqui em vez de dizer o que estava errado.
       (select coalesce(sum(h.dias_uteis), 0)
          from public.hr_requests h
         where h.user_id = p.id and h.tipo = 'ferias'
           and h.status in ('pendente', 'aprovada')
           and h.data_inicio >= public.inicio_do_ciclo(p.id)) as usados_neste_ciclo,
       public.saldo_de_ferias(p.id)          as saldo,
       public.inicio_do_ciclo(p.id)          as ciclo_comecou,
       -- INLINE pela mesma razao do `usados_neste_ciclo` acima:
       -- `proximo_descanso_em()` nasceu na 0074, e num banco anterior a ela o
       -- arquivo estourava aqui em vez de dizer que a 0074 falta. E o que a
       -- funcao faz, letra por letra: o inicio do ciclo mais um ano.
       (public.inicio_do_ciclo(p.id) + interval '1 year')::date as restaura_em
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id
 where tm.ativo
 order by public.ciclos_de_descanso(p.id), p.nome;

-- COMO LER A LINHA DE QUEM TEM MENOS DE UM ANO: `aniversarios` = 0,
-- `concedidos` = 0 e `saldo` = 0, e `restaura_em` e a data em que os primeiros
-- 15 chegam. A tela mostra essa data por extenso em vez de um zero, porque
-- "voce tem 0 de 0 dias" e verdade e nao ensina nada.


-- ===========================================================================
-- PASSO 3 -- O QUE AINDA DESCONTA DO SALDO
--
-- Pedido PENDENTE ja desconta: sem isso daria para propor 15 dias duas vezes
-- enquanto o primeiro espera resposta, e o socio aprovaria os dois sem ver o
-- problema. Se esta lista vier vazia depois de zerar o Full Days, o saldo de
-- todo mundo esta no numero cheio do contrato.
-- ===========================================================================

select p.nome,
       h.data_inicio,
       h.data_fim,
       h.dias_uteis       as dias,
       h.status,
       h.origem,
       case when h.data_inicio >= public.inicio_do_ciclo(h.user_id)
            then 'desconta do ciclo corrente'
            else 'ficou no ciclo anterior, nao desconta mais' end as efeito
  from public.hr_requests h
  join public.profiles p on p.id = h.user_id
 where h.tipo = 'ferias'
   and h.status in ('pendente', 'aprovada')
 order by p.nome, h.data_inicio;


-- ===========================================================================
-- PASSO 4 -- O CONTRATO DE CADA PESSOA
--
-- 15 dias e 2 parcelas sao o PADRAO, nao uma constante no codigo: eles moram
-- em `team_members`, por pessoa, para mudar contrato nao exigir deploy. Quem
-- estiver fora de 15/2 aqui esta assim porque alguem escolheu.
--
-- E `entrou_em` nulo e o unico cadastro que quebra a regra: sem data de
-- entrada nao ha ciclo, e a pessoa fica com zero ate alguem preencher. A tela
-- diz isso em vez de mostrar zero calado.
-- ===========================================================================

select p.nome,
       tm.data_admissao          as entrou_em,
       tm.dias_ferias_ano        as dias_por_ciclo,
       tm.max_parcelas_ferias    as parcelas_por_ciclo,
       case when tm.data_admissao is null
            then 'SEM DATA DE ENTRADA -- preencher na ficha, senao o saldo fica em zero'
            when coalesce(tm.dias_ferias_ano, 15) <> 15
              or coalesce(tm.max_parcelas_ferias, 2) <> 2
            then 'fora do padrao da casa (15 dias, 2 parcelas)'
            else 'ok' end        as atencao
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id
 where tm.ativo
 order by (tm.data_admissao is null) desc, p.nome;
