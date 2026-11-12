-- 0133 — O PORTAL DE UM CLIENTE PASSA A SER LEGÍVEL POR TODA A EQUIPE
--
-- Decisão do usuário: "preciso que passe a aba Portal dos Clientes, para a aba
-- Principal, com acesso de todos, e edição limitada a atendimento, e Sócios".
--
-- A PRIMEIRA METADE É DE TELA E NÃO DE BANCO, e isso é o que torna esta
-- migration pequena. `clients_select` é `is_staff() or my_client_ids()` desde a
-- 0002 — a grade de `/painel/portais` SEMPRE soube responder para a equipe
-- inteira —, e dentro do portal quem recorta cada linha são as policies de
-- `tasks`, `posts`, `deliverables`, `approval_rounds` e `comments`, todas de
-- `is_staff()` para a equipe desde que nasceram. Quem recusava o colaborador
-- era `exigirVisualizacaoDoPortal()` em TypeScript, e ela saiu no mesmo commit
-- que o item do menu: um item apontando para uma rota que devolve 403 é o chip
-- de "Demandas" de Minhas Tasks pela segunda vez.
--
-- O QUE PRECISA DE BANCO É UMA LINHA, E ELA É SOBRE O RASTRO.
-- `client_portal_views_insert` era `is_gestor() and staff_user_id = auth.uid()`
-- desde a 0009. Deixada assim, a visita do colaborador voltaria **sem erro e
-- sem linha** — a escrita é `.select()`ada e o erro vai para o log do servidor
-- (`exigirVisualizacaoDoPortal`), mas a tela abriria do mesmo jeito e o bloco
-- "quem abriu o portal deste cliente" da ficha passaria a mentir POR OMISSÃO.
-- Uma trilha mais curta que a verdade é pior que trilha nenhuma: ela é
-- consultada exatamente na conversa em que o cliente pergunta "vocês viram o
-- que eu comentei?".
--
-- E QUEM **LÊ** O RASTRO CONTINUA SENDO `is_gestor()`, que é a assimetria
-- inteira desta migration. Escrever a própria visita é registrar o que eu fiz;
-- ler a lista é saber quem andou vendo o portal de quem — informação sobre as
-- outras pessoas, e essa metade é de gestão, como a trilha de auditoria da
-- 0058. O bloco da ficha do cliente mora em `/painel/pessoas`, que é `GESTAO`,
-- então nenhuma tela do colaborador pergunta por ela.
--
-- `staff_user_id = auth.uid()` FICA, e é ele que impede forjar a visita de
-- outra pessoa — a mesma forma de `client_access_log_insert` e a razão pela
-- qual `notifications` não tem policy de INSERT nenhuma.
--
-- E NÃO HÁ POLICY DE UPDATE NOVA NEM DE DELETE, que é a regra desta tabela
-- desde a 0009: um registro que a própria pessoa pode consertar não registra
-- nada. A de UPDATE que existe continua em `is_gestor()` e sem chamador —
-- nenhuma tela do produto a exerce.
--
-- "EDIÇÃO LIMITADA A ATENDIMENTO E SÓCIOS" NÃO TEM REFERENTE NESTE MÓDULO, e é
-- dito em vez de inventado: dentro de `/portal/{slug}` ninguém edita nada hoje
-- — `comoEquipe` desliga as três decisões e a conversa, e
-- `decidir_rodada_do_cliente` recusa no banco quem não é o cliente daquela
-- rodada. A única escrita da visualização é esta linha de rastro. Criar uma
-- trava para uma ação que não existe seria a 0060 de novo. Quando a tela
-- ganhar uma ação, ela nasce `is_atendimento()` — e aí é migration própria.
--
-- Conferência no fim do arquivo.

-- ---------------------------------------------------------------------------
-- PASSO 1 — a visita do colaborador passa a ser gravada
-- ---------------------------------------------------------------------------

drop policy if exists client_portal_views_insert on public.client_portal_views;

create policy client_portal_views_insert on public.client_portal_views
  for insert
  with check (
    is_staff() and staff_user_id = (select auth.uid())
  );

comment on table public.client_portal_views is
  'Quem da agência abriu o portal de qual cliente e quando. Toda a equipe '
  'grava a própria visita (0133); quem LÊ a lista é is_gestor(), porque ela é '
  'sobre as outras pessoas. Sem policy de DELETE, de propósito.';

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — cole e leia
-- ---------------------------------------------------------------------------
--
-- Esperado: insert = "is_staff() AND (staff_user_id = ...)", select =
-- "is_gestor()".
--
-- select cmd, coalesce(qual, with_check) as regra
--   from pg_policies
--  where schemaname = 'public'
--    and tablename = 'client_portal_views'
--  order by cmd;
