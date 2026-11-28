-- ===========================================================================
-- 0157 - OS MODELOS DE CAMPANHA SAEM, E FICA SO O WORKFLOW
--
-- Decisao do usuario: "nao esta aparecendo mais aba para montar modelo de
-- campanha, entao nao consigo deletar elas, entao pode excluir os modelos de
-- campanha e deixe so o workflow".
--
-- A TABELA FICA, e so as linhas saem: `campaigns.template_id` e chave
-- estrangeira para ca, e apagar a tabela levaria a coluna de toda campanha.
-- O modelo que alguma campanha ainda cita NAO e apagado -- ele e a procedencia
-- daquela arvore. (Medido em producao: 3 modelos, nenhum citado.)
--
-- A tela de nova campanha deixou de le-los no mesmo commit.
-- ===========================================================================
delete from public.campaign_templates t
 where not exists (select 1 from public.campaigns c where c.template_id = t.id);
