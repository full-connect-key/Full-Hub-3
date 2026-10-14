-- ---------------------------------------------------------------------------
-- 0104 - O PROGRESSO DO ACADEMY SE MARCA
--
-- Relato do usuario: "quando tento marcar um documento do full academy como
-- lido, ele me responde: Nao foi possivel marcar: there is no unique or
-- exclusion constraint matching the ON CONFLICT specification".
--
-- NAO E UM CASO, SAO SEIS, E O MODULO INTEIRO DE LEITURA NUNCA FUNCIONOU.
-- `confirmarLeitura`, `confirmarLeituraDoEbook`, `marcarItem`, `marcarAula`,
-- `marcarCapitulo` e `salvarAnotacao` fazem `upsert` -- todas as seis morrem
-- com a mesma frase. Desde a 0096, no caso das cinco primeiras; desde a 0102,
-- no caso do capitulo. O que funcionava era o checklist do e-book, e ele
-- funcionava por acidente: `academy_ebook_checklists` tem `unique (user_id,
-- item_id, versao, chave)` escrito na TABELA.
--
-- A CAUSA E A FORMA DO INDICE, e nao o que a action escreve. `academy_progresso`
-- e `academy_anotacoes` resolveram a unicidade com indices unicos PARCIAIS --
-- `where aula_id is null`, `where capitulo_id is not null`. O Postgres aceita
-- inferir um indice parcial num `on conflict`, mas SO quando o pedido repete o
-- predicado dele:
--
--     on conflict (user_id, item_id) where aula_id is null and capitulo_id is null
--
-- e o `on_conflict` do PostgREST e uma lista de COLUNAS: ele monta
-- `on conflict (user_id, item_id)` e mais nada. Sem o `where` nao ha indice
-- que casa, e a recusa e a frase que o usuario leu. Medido contra um Postgres
-- 16: o mesmo insert passa com o `where` e estoura sem ele.
--
-- POR QUE O CONSERTO E DE SCHEMA E NAO UMA FUNCAO. A outra saida era uma RPC
-- em plpgsql com o `where` escrito dentro -- ela funciona, mantem a RLS (nao e
-- `security definer`) e e o que a casa faria se os indices parciais fossem
-- necessarios. Eles nao sao: `unique nulls not distinct` -- Postgres 15+ --
-- diz a MESMA coisa numa constraint de verdade, que o PostgREST sabe inferir.
-- Entre acrescentar uma camada e tirar tres indices, a casa tira: uma
-- constraint no lugar de tres indices e um lugar a menos onde a regra pode
-- divergir, e as seis actions voltam a funcionar trocando uma string.
--
-- O `nulls not distinct` NAO afrouxa nada, e e o `check` ao lado que garante
-- isso. `academy_progresso_um_alvo` (0102) recusa uma linha que aponte para
-- uma aula E um capitulo ao mesmo tempo, entao a chave de quatro colunas
-- enderaca exatamente os tres alvos que os tres indices parciais enderecavam:
-- (user, item, null, null) e o item inteiro, (user, item, aula, null) e a
-- aula, (user, item, null, capitulo) e o capitulo. Sem o `check` a chave de
-- quatro aceitaria um quarto alvo que nenhuma tela desenha -- por isso ele
-- fica, e nao e redundante.
--
-- E NAO HA PASSADA DE DEDUPLICACAO, de proposito. Os indices parciais ja
-- recusavam exatamente as linhas que a constraint nova recusa, e `capitulo_id`
-- nasceu na 0102 -- nao existe banco com duas linhas do mesmo alvo. Escrever
-- um `delete` aqui seria a passada que a 0102 recusou do texto do sprint: ela
-- apagaria zero linhas e daria a impressao de ter limpado alguma coisa.
--
-- O QUE FICA: `academy_progresso_capitulo_idx` continua -- ele e de busca, nao
-- de unicidade -- e `academy_progresso_user_idx` tambem.
--
-- CONFERENCIA: no fim do arquivo, e ela LE o catalogo em vez de afirmar.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - academy_progresso
--
-- A ordem e: tirar os tres parciais, pedir a constraint. Invertida, a
-- constraint nasce ao lado dos indices que ela substitui e o `drop` seguinte
-- deixaria o banco com as duas regras -- que e a segunda verdade que este
-- arquivo existe para nao criar.
-- ---------------------------------------------------------------------------
drop index if exists public.academy_progresso_item_unico;
drop index if exists public.academy_progresso_aula_unico;
drop index if exists public.academy_progresso_capitulo_unico;

do $bloco$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'academy_progresso_alvo_unico'
  ) then
    alter table public.academy_progresso
      add constraint academy_progresso_alvo_unico
      unique nulls not distinct (user_id, item_id, aula_id, capitulo_id);
  end if;
end;
$bloco$;

comment on constraint academy_progresso_alvo_unico on public.academy_progresso is
  'Um registro por pessoa por ALVO (0104). `nulls not distinct` porque o alvo e o item inteiro quando as duas colunas sao nulas -- com NULL distinto, duas linhas do mesmo item passariam. Ela substitui os tres indices PARCIAIS da 0096 e da 0102, que diziam a mesma coisa e que o `on_conflict` do PostgREST nao tem como inferir: ele manda a lista de colunas, e indice parcial exige o predicado no pedido.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - academy_anotacoes
--
-- O MESMO FURO, e ele doi diferente: salvar anotacao e o unico dos seis
-- caminhos em que a pessoa perde TEXTO que ela escreveu. O apagar nao passava
-- por aqui -- ele e `delete` com `.is("aula_id", null)` -- e e por isso que a
-- tela parecia funcionar pela metade.
--
-- Aqui nao ha `capitulo_id`: anotacao e do item ou de uma aula, e sao duas
-- colunas na chave.
-- ---------------------------------------------------------------------------
drop index if exists public.academy_anotacoes_item_unico;
drop index if exists public.academy_anotacoes_aula_unico;

do $bloco$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'academy_anotacoes_alvo_unico'
  ) then
    alter table public.academy_anotacoes
      add constraint academy_anotacoes_alvo_unico
      unique nulls not distinct (user_id, item_id, aula_id);
  end if;
end;
$bloco$;

comment on constraint academy_anotacoes_alvo_unico on public.academy_anotacoes is
  'Uma anotacao por pessoa por alvo (0104), substituindo os dois indices parciais da 0096 pela mesma razao de `academy_progresso_alvo_unico`: o `on_conflict` do PostgREST nao infere indice parcial.';


-- ---------------------------------------------------------------------------
-- CONFERENCIA (nao escreve nada)
--
-- Ela conta CONSTRAINT e conta INDICE PARCIAL, nos dois sentidos: so a
-- primeira metade passaria num banco que ganhou a constraint e ficou com os
-- indices antigos ao lado.
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_constraint
    where conname in ('academy_progresso_alvo_unico', 'academy_anotacoes_alvo_unico'))
    as constraints_novas,          -- esperado: 2
  (select count(*) from pg_constraint
    where conname = 'academy_progresso_um_alvo')
    as check_de_alvo_unico,        -- esperado: 1 (a 0102, e ela tem de ficar)
  (select count(*) from pg_index i
     join pg_class c on c.oid = i.indexrelid
    where c.relname in (
      'academy_progresso_item_unico', 'academy_progresso_aula_unico',
      'academy_progresso_capitulo_unico',
      'academy_anotacoes_item_unico', 'academy_anotacoes_aula_unico'))
    as parciais_que_sobraram;      -- esperado: 0
