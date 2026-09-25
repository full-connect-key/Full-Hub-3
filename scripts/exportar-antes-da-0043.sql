-- ---------------------------------------------------------------------------
-- O QUE A 0043 VAI APAGAR, NA TELA
--
-- Cole no SQL Editor do Supabase e rode ANTES da migration 0043. Nao muda
-- nada -- so mostra.
--
-- POR QUE ISTO NAO E O DA 0034. La as tres tabelas fechavam em
-- `user_id = auth.uid()` nas quatro operacoes, e ninguem -- nem o socio --
-- sabia o que havia dentro sem consultar o banco como dono. O script era
-- CONDICAO para apagar.
--
-- Aqui as duas tabelas sempre foram legiveis por `is_gestor()`: a matriz da
-- agencia lia `user_skills` inteira, e a observacao a propria pessoa lia. Este
-- script e CONVENIENCIA -- poe numa tela so o que a gestao ja alcancava por
-- `/painel/equipe`, para quem quiser guardar antes.
--
-- O que sai do produto:
--   - `user_skills`      -- a autoavaliacao de cada pessoa
--   - `skill_avaliacoes` -- a observacao que a gestao escrevia sobre alguem
--
-- O que FICA: a tabela `skills`, agora como vocabulario de etiquetas do Full
-- Academy. Ela nao aparece aqui porque nao vai a lugar nenhum.
-- ---------------------------------------------------------------------------

-- 1. O nivel que cada pessoa se atribuiu, e o que ela quer desenvolver.
select
  p.nome                                   as pessoa,
  p.email,
  s.nome                                   as skill,
  s.categoria,
  us.nivel,
  case when us.quer_desenvolver then 'sim' else '' end as quer_desenvolver,
  us.updated_at                            as atualizado_em
from public.user_skills us
join public.profiles p on p.id = us.user_id
join public.skills   s on s.id = us.skill_id
order by p.nome, s.categoria nulls last, s.nome;


-- 2. As observacoes da gestao, com quem escreveu e sobre quem.
select
  alvo.nome   as sobre,
  alvo.email  as sobre_email,
  autor.nome  as escrito_por,
  sa.texto,
  sa.created_at as quando
from public.skill_avaliacoes sa
join public.profiles alvo  on alvo.id  = sa.user_id
left join public.profiles autor on autor.id = sa.autor_id
order by alvo.nome, sa.created_at;


-- 3. O tamanho do que sai, para conferir que o de cima trouxe tudo.
select 'user_skills'      as tabela, count(*) as linhas from public.user_skills
union all
select 'skill_avaliacoes', count(*) from public.skill_avaliacoes;
