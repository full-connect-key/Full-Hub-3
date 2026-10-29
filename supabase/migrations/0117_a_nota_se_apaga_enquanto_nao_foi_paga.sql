-- ===========================================================================
-- 0117 - A NOTA SE APAGA ENQUANTO NAO FOI PAGA
--
-- Decisao do usuario: *"permitir que o usuario que enviou uma NF possa
-- exclui-la; permitido apenas enquanto a NF nao estiver como 'Paga'; NFs
-- pagas nao podem ser excluidas pelo remetente"*.
--
-- `team_invoices_delete` nasceu na 0065 em `status = 'enviada'`, e o
-- argumento dela esta escrito ali: *"apagar e so enquanto ninguem olhou;
-- depois de conferida ela e registro de uma decisao, e registro de decisao
-- nao se apaga"*. Quem responde por esse registro e quem o emitiu, e ele
-- decidiu outra coisa.
--
-- ---------------------------------------------------------------------------
-- O CORTE EM `paga` NAO E UMA LINHA ARBITRARIA: E ONDE O DINHEIRO ENTRA.
--
-- `nota_paga_vira_despesa()` (0065) dispara na transicao para `paga` e grava
-- uma linha em `finance_entries`, com `team_invoices.finance_entry_id`
-- apontando para ela. A chave estrangeira mora do lado da NOTA, entao apagar
-- uma nota paga nao levaria a despesa junto -- ela ficaria no Financeiro sem
-- nota do outro lado, e o sócio veria um gasto que nao da mais para explicar.
-- E a mesma assimetria que o `scripts/zerar-notas-fiscais.sql` tem escrita no
-- cabecalho dele.
--
-- Entao a frase do usuario -- *"preservando informacoes essenciais e
-- controles financeiros"* -- e exatamente o que `<> 'paga'` garante: o unico
-- estado que escreve no Financeiro e o unico que continua recusado.
--
-- ---------------------------------------------------------------------------
-- O QUE ISTO CUSTA, E E CONSEQUENCIA ACEITA POR QUEM DECIDIU.
--
-- `recusada` passa a ser apagavel, e com ela sai o MOTIVO que o socio
-- escreveu. O indice unico de `team_invoices` e parcial
-- (`where status <> 'recusada'`) justamente para a recusada ficar ao lado da
-- nota nova, com o que foi pedido -- e a tela de quem envia ja esconde a
-- recusada assim que a substituta e ACEITA, entao ela nao polui nada.
--
-- Fica dito em vez de escondido: quem apagar uma recusada perde a frase que
-- explica por que ela voltou. A linha some de `team_invoices`, e o que resta
-- e a copia em `audit_log`, que so o socio le.
--
-- ---------------------------------------------------------------------------
-- A AUDITORIA JA ESTAVA PRONTA, e esta migration nao acrescenta uma linha a
-- ela. `auditoria_team_invoices` (0065) dispara em `after insert or update or
-- delete`, e `registrar_auditoria()` (0058) grava, no ramo de DELETE,
-- `to_jsonb(old)` INTEIRO -- numero, competencia, valor, caminho do arquivo e
-- quem emitiu. O pedido *"registrar historico de exclusao para fins de
-- auditoria"* ja era verdade antes de a exclusao ser possivel.
--
-- E ela continua sendo lida SO PELO SOCIO, que e a regra da 0058 e nao um
-- detalhe aqui: a linha carrega o VALOR. Um log legivel pela gestao seria a
-- porta dos fundos da regra que a 0065 escreveu.
--
-- ---------------------------------------------------------------------------
-- O QUE NAO MUDA:
--
--   * O SOCIO CONTINUA SEM APAGAR NOTA NENHUMA. A policy e de quem emitiu, e
--     so dela -- `auth.uid() = user_id`. Ele decide (aprova, recusa, paga) e
--     nao redige, que e a separacao da 0065.
--   * `team_invoices_update` fica como esta: quem muda status continua sendo
--     a propria pessoa ou o socio, e `nota_protege_colunas` continua exigindo
--     o socio para mexer em `status`.
--   * A NOTA NAO NASCE PAGA (`team_invoices_insert` so aceita `enviada`),
--     entao nao existe o caminho de criar uma nota ja no estado que recusa a
--     exclusao.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO UNICO - Quem apaga, e ate quando
-- ---------------------------------------------------------------------------
drop policy if exists team_invoices_delete on public.team_invoices;
create policy team_invoices_delete on public.team_invoices
  for delete to authenticated
  using ((select auth.uid()) = user_id and status <> 'paga');


-- ---------------------------------------------------------------------------
-- CONFERENCIA - cole junto e leia a resposta.
--
-- Espera-se UMA linha, com `ok = true`. `false` quer dizer que a policy
-- antiga continua de pe e a pessoa vai levar recusa ao clicar em apagar uma
-- nota aprovada ou recusada.
-- ---------------------------------------------------------------------------
select
  pl.policyname,
  pl.qual,
  pl.qual like '%paga%' as ok
  from pg_policies pl
 where pl.schemaname = 'public'
   and pl.tablename = 'team_invoices'
   and pl.policyname = 'team_invoices_delete';

notify pgrst, 'reload schema';
