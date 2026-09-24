-- ---------------------------------------------------------------------------
-- O que ha dentro do Resumo Semanal e do Financeiro Pessoal, antes de apagar
--
--   Cole no SQL Editor do Supabase e rode. NAO MUDA NADA.
--
-- A migration 0034 apaga `weekly_entries`, `weekly_notes` e
-- `personal_finance_entries`, e nao tem volta. As tres eram fechadas em
-- `user_id = auth.uid()` nas quatro operacoes -- nem o socio lia --, entao
-- ninguem sabe o que ha dentro delas sem consultar como dono do banco, que e
-- o que o SQL Editor faz.
--
-- COMO LER O RESULTADO:
--
--   - Os tres primeiros blocos CONTAM. Se os tres derem zero, nao ha o que
--     preservar: rode a 0034 e pronto.
--   - Os tres ultimos DESPEJAM o conteudo, com o nome e o e-mail de quem
--     escreveu. Se houver linha, copie e entregue a cada pessoa o que e dela
--     ANTES de rodar a 0034 -- o Resumo Semanal era a memoria que ela levava
--     para a conversa de desenvolvimento, e o Financeiro Pessoal e dinheiro
--     da casa dela.
--
-- E ISTO NAO E UMA EXPORTACAO AUTOMATICA, de proposito. Gravar o conteudo
-- destas tabelas em outro lugar do banco seria contornar a promessa que elas
-- carregavam: que so a propria pessoa lia. Quem decide o que fazer com o
-- texto e quem o escreveu -- este arquivo so poe na tela para que a decisao
-- seja possivel.
-- ---------------------------------------------------------------------------


-- --- 1. Ha alguma coisa? ---------------------------------------------------
select 'weekly_entries'           as tabela, count(*) as linhas,
       count(distinct user_id)    as pessoas
  from public.weekly_entries
union all
select 'weekly_notes', count(*), count(distinct user_id)
  from public.weekly_notes
union all
select 'personal_finance_entries', count(*), count(distinct user_id)
  from public.personal_finance_entries;


-- --- 2. As entregas da semana, por pessoa ----------------------------------
select pr.nome, pr.email, e.data, e.descricao, e.created_at
  from public.weekly_entries e
  join public.profiles pr on pr.id = e.user_id
 order by pr.nome, e.data;


-- --- 3. As notas da semana, por pessoa -------------------------------------
--
-- `conteudo_texto` e o texto puro; o JSON do TipTap (`conteudo`) fica de
-- fora porque nao se le. Quem quiser a formatacao troca a coluna aqui.
select pr.nome, pr.email, n.semana, n.humor, n.conteudo_texto, n.created_at
  from public.weekly_notes n
  join public.profiles pr on pr.id = n.user_id
 order by pr.nome, n.semana;


-- --- 4. Os lancamentos pessoais, por pessoa --------------------------------
select pr.nome, pr.email, f.data, f.tipo, f.descricao, f.categoria,
       f.valor, f.recorrente
  from public.personal_finance_entries f
  join public.profiles pr on pr.id = f.user_id
 order by pr.nome, f.data;
