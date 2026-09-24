-- ---------------------------------------------------------------------------
-- 0034 - O Resumo Semanal e o Financeiro Pessoal saem do produto
--
-- Decisao do usuario: os dois modulos foram apagados. O modulo pessoal que
-- FICA e o de Notas Fiscais -- a nota que o colaborador manda para a agencia
-- pagar. O financeiro da CASA (`contracts`, `finance_categories`,
-- `finance_entries`) tambem fica: ele e outro modulo, na Gestao, e so o socio
-- alcanca.
--
-- ESTA MIGRATION APAGA DADO DE PESSOA, E NAO TEM VOLTA.
--
-- As tres tabelas eram fechadas em `user_id = auth.uid()` nas quatro
-- operacoes: nem o socio lia. Isso quer dizer que ninguem sabe o que ha
-- dentro delas sem consultar o banco como dono -- e quer dizer tambem que,
-- se alguem da equipe escreveu ali, o texto some aqui.
--
-- ANTES DE RODAR ISTO, rode `scripts/exportar-antes-da-0034.sql` no SQL
-- Editor. Ele nao muda nada: devolve o conteudo das tres tabelas em uma
-- consulta por tabela, para ser copiado e entregue a quem escreveu. Se o
-- retorno vier vazio nos tres, nao ha o que preservar e esta migration e so
-- limpeza de schema.
--
-- POR QUE APAGAR EM VEZ DE APOSENTAR. E a mesma decisao da 0023, que apagou
-- `tasks.exigencia_aprovacao` em vez de deixa-la parada: tabela que nenhuma
-- tela le e schema que alguem vai reaproveitar errado tres sprints depois,
-- achando que ainda significa alguma coisa. O que sobrevive ao modulo e o
-- registro de por que ele existiu, e esse mora no CLAUDE.md.
--
-- O QUE NAO E APAGADO, e de proposito:
--
--   `pf_tipo`      -- o enum ('entrada', 'saida') fica. `alter type ... drop`
--                     nao existe no Postgres para valor, e `drop type` num
--                     tipo que talvez outra coisa passe a usar e ganho
--                     nenhum. Ele fica orfao e inofensivo, como `cancelada`
--                     em `task_status` desde a 0020.
--   `subtasks`     -- `weekly_entries.subtask_id` apontava para la, e e a
--                     ponta solta que se corta: apagar a tabela que APONTA
--                     nao toca na apontada.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - As tabelas
--
-- `cascade` leva junto policies, triggers, indices e a chave estrangeira que
-- `weekly_entries` tinha para `subtasks`. Nenhuma outra tabela aponta para
-- estas tres, entao o cascade nao alcanca nada de fora do modulo -- o PASSO 3
-- confere isso.
-- ---------------------------------------------------------------------------
drop table if exists public.weekly_entries cascade;
drop table if exists public.weekly_notes cascade;
drop table if exists public.personal_finance_entries cascade;


-- ---------------------------------------------------------------------------
-- PASSO 2 - As funcoes que so serviam a elas
--
-- Os triggers ja morreram com as tabelas; o que sobra sao os corpos. Funcao
-- de trigger sem tabela nao da erro nenhum -- ela simplesmente nunca roda, e
-- e por isso que ela fica para tras quando ninguem olha.
--
-- `tocar_user_skills` e `tocar_skill_avaliacoes` NAO entram: nasceram na
-- mesma migration 0012, mas servem `user_skills` e `skill_avaliacoes`, que
-- continuam de pe.
-- ---------------------------------------------------------------------------
drop function if exists public.tocar_weekly_entries() cascade;
drop function if exists public.tocar_weekly_notes() cascade;
drop function if exists public.recusar_semana_futura() cascade;
drop function if exists public.recusar_entrega_futura() cascade;


-- ---------------------------------------------------------------------------
-- PASSO 3 - A prova de que nao sobrou nada
--
-- Uma migration que "apaga" e que silenciosamente nao apagou e pior que uma
-- que falha: o schema fica dizendo uma coisa e o codigo outra. Aqui ela
-- ESTOURA se qualquer uma das tres tabelas continuar de pe -- o que so
-- aconteceria se algo fora deste arquivo as tivesse recriado.
-- ---------------------------------------------------------------------------
do $$
declare
  sobrou text;
begin
  select string_agg(t.nome, ', ')
    into sobrou
    from (values ('weekly_entries'), ('weekly_notes'), ('personal_finance_entries')) as t(nome)
   where to_regclass('public.' || t.nome) is not null;

  if sobrou is not null then
    raise exception 'A 0034 nao apagou: %', sobrou;
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - O PostgREST precisa esquecer as tabelas
--
-- Sem isto o cache de schema continua anunciando as tres, e uma chamada a
-- `/rest/v1/weekly_entries` responde com um erro de tabela que sumiu em vez
-- de um 404 limpo. O Supabase costuma recarregar sozinho; este notify e para
-- quando ele nao recarrega.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
