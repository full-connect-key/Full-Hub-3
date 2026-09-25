-- ---------------------------------------------------------------------------
-- 0043 - O MODULO MEU DESENVOLVIMENTO SAI DO PRODUTO
--
-- Decisao do usuario. Tela, rota, aba em Equipe, dados e duas tabelas:
-- `user_skills` (a autoavaliacao de cada pessoa) e `skill_avaliacoes` (a
-- observacao que a gestao escrevia sobre alguem).
--
-- O CATALOGO FICA, E ESSA FOI A ESCOLHA EXPLICITA. `skills` continua, agora
-- com um papel so: o vocabulario de etiquetas do Full Academy, por
-- `academy_materials.skill_id`. Apagar o catalogo junto levaria a etiqueta de
-- cada material -- e a Academy perderia a unica coisa que organiza o que ela
-- guarda.
--
-- POR QUE ISTO NAO E A 0034. La as tres tabelas fechavam em
-- `user_id = auth.uid()` nas quatro operacoes, e NINGUEM sabia o que havia
-- dentro delas sem consultar o banco como dono -- dai o script de exportacao
-- que punha o conteudo na tela antes de apagar. Aqui as duas tabelas eram
-- legiveis por `is_gestor()`: a matriz da agencia e o "quem sabe fazer X?"
-- liam `user_skills` inteira, e a observacao a propria pessoa lia. O socio
-- pode ler o que vai sumir pela tela que ainda esta no ar, ou por
-- `scripts/exportar-antes-da-0043.sql`. A promessa que a 0034 carregava nao
-- existe aqui, e por isso o script e conveniencia e nao condicao.
--
-- APAGAR, E NAO APOSENTAR -- como a 0023 com `tasks.exigencia_aprovacao` e a
-- 0034 com as tres tabelas. Tabela que nenhuma tela le e schema que alguem
-- reaproveita errado tres sprints depois, achando que ainda significa alguma
-- coisa.
--
-- E A SUGESTAO DE SKILL SAI JUNTO, que e a parte que passa batida. O catalogo
-- tinha dois caminhos de entrada: a gestao cria, e qualquer pessoa da equipe
-- SUGERE -- a sugestao nascia com `ativa = false` e `sugerida_por`
-- preenchido, e a fila de aprovacao ficava em Meu Desenvolvimento. Sem aquela
-- tela, `sugerida_por` vira coluna que nenhum caminho preenche e nenhuma
-- tela le, e a policy de insert oferece um caminho que nao existe. As duas
-- somem: quem decide o vocabulario de etiqueta da Academy e quem cuida da
-- Academy.
--
-- `ativa` FICA: e como a gestao tira do ar uma etiqueta que a agencia nao usa
-- mais sem apagar a que ja esta em material antigo.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - As duas tabelas
--
-- `drop table ... cascade` leva junto as policies, os indices e os triggers
-- delas. O `if exists` e o que faz a migration rodar duas vezes.
-- ---------------------------------------------------------------------------

drop table if exists public.skill_avaliacoes cascade;
drop table if exists public.user_skills cascade;

-- A funcao de `updated_at` da tabela que saiu. Ela nao e compartilhada --
-- cada tabela tem a sua -- entao fica orfa se nao sair aqui.
drop function if exists public.tocar_skill_avaliacoes() cascade;
drop function if exists public.tocar_user_skills() cascade;


-- ---------------------------------------------------------------------------
-- PASSO 2 - O catalogo perde a sugestao
-- ---------------------------------------------------------------------------

-- A POLICY VEM PRIMEIRO, E A ORDEM NAO E ESTILO.
--
-- `skills_insert` cita `sugerida_por` na clausula `with check`, e isso cria
-- uma dependencia: o `drop column` estoura com "cannot drop column
-- sugerida_por because other objects depend on it". A bateria pegou.
--
-- E a mesma pegadinha da 0039, que precisou recriar `hr_requests_validar`
-- antes de apagar `ano_referencia` -- la a dependencia vinha do `update of
-- <colunas>` do trigger. Coluna citada em policy ou em trigger nao sai
-- enquanto quem a cita estiver de pe.
--
-- SO A GESTAO CRIA. O outro caminho -- a equipe sugerindo, com a sugestao
-- nascendo `ativa = false` -- tinha a fila de aprovacao em Meu
-- Desenvolvimento. Sem aquela tela, a policy oferece um caminho que nao
-- existe: uma porta que so quem monta requisicao a mao encontra.
drop policy if exists skills_insert on public.skills;

create policy skills_insert on public.skills
  for insert to authenticated
  with check (public.is_gestor());

alter table public.skills drop column if exists sugerida_por;

comment on table public.skills is
  'Vocabulario de etiquetas do Full Academy (0043). Era o catalogo de habilidades da equipe ate Meu Desenvolvimento sair do produto; o que sobrou e a etiqueta de academy_materials.skill_id.';

notify pgrst, 'reload schema';
