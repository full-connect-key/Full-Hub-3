-- 0132 — A EQUIPE ENXERGA A EQUIPE
--
-- Relato do usuario: *"quando eu preencho um responsavel, com a visualizacao de
-- socio, ela desaparece na visualizacao de colaborador"*.
--
-- ---------------------------------------------------------------------------
-- ELE ESTA CERTO, E A CAUSA FOI MEDIDA CONTRA ESTE BANCO. `profiles` tinha
-- DUAS policies de SELECT e so duas -- `own` e `is_gestor()` --, entao um
-- colaborador lia EXATAMENTE UM perfil, o dele. A sonda, rodada como gente de
-- verdade:
--
--     quem          perfis que enxerga   acha o responsavel da etapa
--     colaborador            1                      0
--     socio                 15                      1
--
-- Todo leitor de pessoa neste produto e um embed `profiles(id, nome,
-- avatar_url)` -- sao 46 em 21 arquivos de `lib/dados/` --, e um embed cuja
-- linha a RLS recusa volta NULO. Nao da erro, nao aparece no log: o nome some
-- e a foto some, e quem olha conclui que a etapa nao tem dono.
--
-- **E O ESTRAGO E MAIOR QUE O RELATO.** A pilha de avatares de Minhas Tasks, a
-- coluna Equipe da Lista, o avatar do board, o rosto no calendario e o
-- historico de aprovacoes sao todos o mesmo embed. Para quem nao e gestao --
-- que e a maior parte da agencia -- o produto inteiro mostrava uma equipe de
-- uma pessoa so.
--
-- ---------------------------------------------------------------------------
-- A RECUSA DA 0130 ERA SOBRE OUTRA COISA, e vale dizer por que esta migration
-- nao a desfaz. Aquela queria o aniversario de todo mundo e decidiu NAO abrir
-- `profiles`, com a frase *"um calendario de aniversario nao e motivo para
-- mexer na postura de privacidade do produto"* -- e a saida foi guardar a data
-- em `team_members`, que e `is_staff()` desde a 0002. O argumento continua
-- inteiro: o que nao precisa da tabela nao a abre.
--
-- O que mudou e o motivo. Nao e um calendario: e a pergunta *de quem e este
-- trabalho*, que e a pergunta central das telas que a equipe abre todo dia. E
-- a propria 0130 escreveu onde a mudanca deveria morar quando ela viesse:
-- *"se a regra tiver que mudar, muda na policy -- num lugar, para as vinte
-- telas que leem `profiles`"*. E aqui.
--
-- ---------------------------------------------------------------------------
-- E ELA E ESTREITADA EM LINHA, `role <> 'cliente'`. A equipe passa a enxergar
-- a EQUIPE, e nao a lista de contatos das contas: um colaborador nao tem por
-- que enumerar quem tem acesso ao portal de cada cliente, e quem precisa
-- daquela lista ja tem porta propria -- `usuarios_do_meu_cliente()` (0031) e
-- `aprovadores_da_conta()` (0128), as duas `security definer` com a pergunta
-- escrita a mao.
--
-- Entao a frase que o CLAUDE.md escreveu sobre o historico de aprovacoes
-- continua valendo onde ela vale: *"o nome que nao voltou fica de fora da
-- lista, e a ausencia e honesta"*. O que sai da ausencia sao os colegas; o
-- contato do cliente continua fora para quem nao e gestao.
--
-- ---------------------------------------------------------------------------
-- O QUE ISTO EXPOE, E E DITO EM VEZ DE ESCONDIDO: a policy libera a LINHA, e
-- **policy nao limita coluna** -- a frase que este produto repete desde a 0005.
-- Entao quem montar a consulta a mao le tambem `email`, `role`, `ativo` e
-- `deve_trocar_senha` dos colegas. Nenhuma TELA mostra nada disso: dos 46
-- leitores, 45 pedem `id, nome, avatar_url` ou menos, e o unico `select("*")`
-- de `lib/dados/` e a ficha da pessoa, que e de gestao.
--
-- **REVOGAR A COLUNA FOI TENTADO E RECUSADO, com o motivo medido:**
-- `revoke select (email) on profiles from authenticated` alcanca tambem o
-- `select("*")` de `lib/auth/dal.ts`, que le o PROPRIO perfil em toda visita a
-- toda pagina do produto. Quebrar aquela linha e quebrar o login de todo
-- mundo, e um `grant` por coluna nao sabe dizer "a sua propria linha" --
-- gestor e colaborador sao o mesmo papel do Postgres (`authenticated`). O
-- caminho estreito existe e e outro: uma funcao `security definer` por leitor,
-- como a casa ja faz em seis lugares. Ele custa reescrever o caminho da
-- sessao, e isso e decisao propria e nao efeito colateral de um conserto de
-- tela.
-- ---------------------------------------------------------------------------

create policy profiles_select_equipe on public.profiles
  for select
  using (is_staff() and role <> 'cliente');

comment on policy profiles_select_equipe on public.profiles is
  'A equipe enxerga a equipe (0132). Sem ela, todo embed profiles(...) volta nulo para quem nao e gestao, e o responsavel de cada etapa some da tela. Estreitada em linha: contato de cliente continua fora.';

-- Conferencia (roda como gente de verdade, e desfaz tudo no fim).
do $$
declare colab uuid; antes int; depois int;
begin
  select id into colab from public.profiles where role = 'colaborador' and ativo limit 1;
  if colab is null then
    raise notice '0132: nenhum colaborador ativo para conferir.';
    return;
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', colab, 'role', 'authenticated')::text, true);
  select count(*) into depois from public.profiles;
  perform set_config('role', 'postgres', true);

  select count(*) into antes from public.profiles where role <> 'cliente';
  raise notice '0132: o colaborador enxerga % de % perfis da equipe (era 1).', depois, antes;
end $$;
