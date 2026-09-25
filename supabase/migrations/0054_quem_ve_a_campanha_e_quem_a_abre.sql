-- ---------------------------------------------------------------------------
-- 0054 - VER A CAMPANHA E ABRIR UMA CAMPANHA SAO DUAS DECISOES
--
-- Decisao do usuario, sobre o modulo de campanhas no painel:
--
--   "essa area deve ser visivel para os colaboradores, sem ser
--    desenvolvedores e socios, ja que quem vao upar e fazer os conteudos sao
--    os responsaveis e nao o atendimento."
--
-- A tela abriu para `EQUIPE` em `permissions.ts`, e e o mesmo argumento que
-- moveu o Social Media no Sprint 14: quem produz precisa chegar ao material
-- que e dele, e esconder o modulo seria esconder o trabalho dele.
--
-- ---------------------------------------------------------------------------
-- MAS ABRIR CAMPANHA CONTINUA SENDO DE QUEM ABRE DEMANDA
--
-- A frase dele separa as duas coisas na mesma linha: "quem vao upar e fazer
-- os conteudos sao os responsaveis E NAO O ATENDIMENTO" -- o Atendimento
-- continua sendo quem abre. E coerente com o resto do produto: uma campanha
-- nasce com uma demanda desde a 0051, e quem abre demanda e `is_atendimento()`
-- desde a 0006.
--
-- `campaigns_insert` era `is_staff()` desde a 0033, quando a tela so existia
-- para a gestao e a policy nunca era exercida por mais ninguem. Com o modulo
-- aberto, ela passaria a valer para o colaborador -- e a guarda de tela seria
-- a unica coisa entre ele e uma campanha aberta por engano.
--
-- **E o banco ja recusava pela metade, que e pior que recusar.**
-- `abrir_campanha()` insere a DEMANDA primeiro, e `tasks_insert` exige
-- `is_atendimento()`: o colaborador levava a recusa da demanda, com uma
-- mensagem sobre tasks, numa tela de campanha. Agora as duas policies dizem a
-- mesma coisa, e a recusa fala de campanha.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

drop policy if exists campaigns_insert on public.campaigns;

create policy campaigns_insert on public.campaigns
  for insert to authenticated
  with check (public.is_atendimento());


-- ---------------------------------------------------------------------------
-- O QUE NAO MUDA, E VALE DIZER
--
--   `campaigns_select`  -- `is_staff()`. O colaborador ve TODAS as campanhas
--                          da agencia, como ja ve todos os posts. Filtrar
--                          pelas dele exigiria uma nocao de "esta pessoa
--                          atende esta conta" que o produto nao tem -- e ela
--                          e a decisao em suspenso registrada no CLAUDE.md.
--
--   `campaigns_update`  -- `is_staff()`. Trocar a capa e ajustar o periodo e
--                          trabalho de quem esta com a campanha na mao.
--
--   `campaigns_delete`  -- `is_gestor()`. Apagar leva a arvore inteira, com o
--                          que o cliente ja aprovou (0050, decisao do
--                          usuario: "apenas Socios e desenvolvedores").
--
--   `deliverables_*` e `deliverable_versions_*` -- `is_staff()` desde a 0033.
--                          E o ponto inteiro desta mudanca: subir arquivo e
--                          gravar versao sempre foi de quem produz.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
