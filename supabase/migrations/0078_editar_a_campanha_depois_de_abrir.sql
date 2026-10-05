-- ---------------------------------------------------------------------------
-- 0078 - Editar a campanha depois de abrir
--
-- Decisao do usuario: *"preciso poder editar as informacoes de uma campanha,
-- apos abrir ela. Mudar data, nome, dentre outras coisas"*.
--
-- A tela de producao (`/painel/aprovacoes/campanhas/{id}`) mostrava nome,
-- cliente, periodo e status como TEXTO desde que nasceu, e a unica coisa que
-- se trocava ali era a capa. Um nome digitado errado na abertura ficava para
-- sempre -- no board da agencia, no portal do cliente e no calendario.
--
-- ---------------------------------------------------------------------------
-- DUAS COISAS, E A PRIMEIRA E UMA TRAVA
--
--   1. `campaigns_protege_colunas` -- POLICY NAO LIMITA COLUNA, e e a mesma
--      razao de `posts_protege_colunas` (0042), de `protect_client_columns`
--      (0005) e de `comments_normaliza` (0032). `campaigns_update` e
--      `is_staff()` desde a 0033, e tem que continuar sendo: e por ela que o
--      colaborador que produz troca a CAPA (0050). Abrir a mesma policy para
--      o nome e o periodo entregaria a quem produz o combinado com o cliente.
--
--   2. `campaigns_espelha_na_demanda` -- o titulo da demanda acompanha o nome
--      da campanha, porque foi dele que ele saiu.
--
-- ---------------------------------------------------------------------------
-- QUEM EDITA E `is_atendimento()`, A MESMA PERGUNTA DE QUEM ABRE
--
-- `campaigns_insert` fechou em `is_atendimento()` na 0054, com a frase do
-- usuario separando as duas coisas na mesma linha: quem produz entra no
-- modulo, e quem ABRE campanha e quem abre demanda. Nome, periodo e status sao
-- o combinado com o cliente -- a mesma decisao da abertura, tomada de novo.
--
-- RECUSA EM VEZ DE REESCREVER, como o trigger do post: os campos aparecem na
-- tela, e um colaborador que tenta mudar a data precisa OUVIR que nao pode --
-- senao ele salva, ve a data antiga voltar e conclui que a tela esta quebrada.
--
-- ---------------------------------------------------------------------------
-- O CLIENTE NAO TROCA, NEM PELA GESTAO, e esta e a unica recusa que vale para
-- todo mundo.
--
-- `abrir_campanha()` (0051) cria a DEMANDA com o mesmo `client_id`, e a
-- visibilidade de cada entregavel no portal sai dai. Trocar a empresa da
-- campanha deixaria a demanda apontando para a antiga e as pecas ja enviadas
-- visiveis para quem nao as pediu -- um vazamento entre contas que nenhuma
-- tela mostraria. Campanha de outra empresa e campanha nova.
-- ---------------------------------------------------------------------------

create or replace function public.proteger_colunas_da_campanha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- O CLIENTE E A PRIMEIRA, E ELA NAO TEM EXCECAO -- nem para o socio, nem
  -- para o seed. Ela vem ANTES dos dois `return` de baixo de proposito.
  if new.client_id is distinct from old.client_id then
    raise exception using
      errcode = 'check_violation',
      message = 'A empresa de uma campanha não se troca.',
      hint    = 'A demanda e os materiais já enviados são da empresa de origem. Abra uma campanha nova para a outra.';
  end if;

  if public.is_atendimento() then
    return new;
  end if;

  -- Sem sessao quem escreve e o seed.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.nome is distinct from old.nome then
    raise exception using
      errcode = 'check_violation',
      message = 'Renomear a campanha é de quem a abriu.',
      hint    = 'O nome aparece no board da agência e no portal do cliente; peça ao Atendimento.';
  end if;

  if new.data_inicio is distinct from old.data_inicio
     or new.data_fim is distinct from old.data_fim then
    raise exception using
      errcode = 'check_violation',
      message = 'O período da campanha é de quem a abriu.',
      hint    = 'Ele foi combinado com o cliente; peça a troca ao Atendimento.';
  end if;

  if new.status is distinct from old.status then
    raise exception using
      errcode = 'check_violation',
      message = 'O estado da campanha é de quem a abriu.',
      hint    = 'Ativa, finalizada ou cancelada é decisão do Atendimento.';
  end if;

  return new;
end;
$$;

comment on function public.proteger_colunas_da_campanha is
  'Policy não limita coluna: `campaigns_update` é is_staff() porque quem produz troca a CAPA, e nome, período e estado são de is_atendimento(). A empresa não se troca para ninguém.';

drop trigger if exists campaigns_protege_colunas on public.campaigns;
create trigger campaigns_protege_colunas
  before update on public.campaigns
  for each row execute function public.proteger_colunas_da_campanha();


-- ---------------------------------------------------------------------------
-- O TITULO DA DEMANDA ACOMPANHA O NOME DA CAMPANHA
--
-- `abrir_campanha()` grava `tasks.titulo = p_nome` (0051). Sem este trigger,
-- renomear a campanha deixaria o board da agencia com o nome de fabrica para
-- sempre -- e e exatamente a situacao que a 0061 resolveu do lado do social,
-- onde o titulo da subtarefa acompanha o tema do post.
--
-- E O PERIODO NAO ACOMPANHA, e a assimetria e deliberada: `tasks.data_inicio`
-- e `data_fim` sao DERIVADOS das etapas desde a 0028 --
-- `recalcular_periodo_da_task()` os reescreve a cada escrita em `subtasks`.
-- Espelhar o periodo aqui seria gravar um valor que o proximo recalculo
-- desfaz, que e o pior dos dois mundos: a escolha passa e some depois, sem
-- ninguem ver. Sao dois fatos diferentes -- o periodo da campanha e o
-- combinado com o cliente, o da demanda e a soma do trabalho dentro dela.
--
-- E TRIGGER E NAO ACTION, pela razao da auditoria e da 0045: a action de
-- editar campanha vai ser reescrita, e cada reescrita e uma chance de o trecho
-- ficar para tras.
-- ---------------------------------------------------------------------------

create or replace function public.espelhar_nome_na_demanda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.task_id is not null and new.nome is distinct from old.nome then
    update public.tasks set titulo = new.nome where id = new.task_id;
  end if;
  return new;
end;
$$;

comment on function public.espelhar_nome_na_demanda is
  'O título da demanda acompanha o nome da campanha, que é de onde ele saiu (0051). O PERÍODO não acompanha: o da demanda é derivado das etapas desde a 0028.';

drop trigger if exists campaigns_espelha_na_demanda on public.campaigns;
create trigger campaigns_espelha_na_demanda
  after update of nome on public.campaigns
  for each row execute function public.espelhar_nome_na_demanda();
