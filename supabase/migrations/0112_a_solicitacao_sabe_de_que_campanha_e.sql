-- ---------------------------------------------------------------------------
-- 0112 — A SOLICITACAO SABE DE QUE CAMPANHA ELA E
--
-- Decisao do pacote do portal: a tabela de solicitacoes passa a ter a coluna
-- CAMPANHA, e o painel de abrir uma passa a oferecer "entre as campanhas
-- ativas e planejadas do cliente, mais 'Sem campanha'" -- ja preenchida
-- quando o painel abre de dentro de uma campanha.
--
-- POR QUE ISTO E UMA COLUNA, E NAO UMA PERGUNTA NO BRIEFING.
--
-- `client_requests.respostas` e um jsonb com o roteiro daquele tipo de
-- trabalho (0068), e a tentacao e por a campanha ali: nao custaria migration
-- nenhuma. O criterio que separa os dois ja esta escrito neste projeto, em
-- `post_versions.arquivos`: **jsonb e para o que se escreve de uma vez e se le
-- inteiro, nunca consultado item a item.** A campanha e consultada item a
-- item -- a coluna CAMPANHA da tabela, o filtro do Cronograma, a aba Entregas
-- do detalhe da campanha e o botao "+ Nova solicitacao nesta campanha"
-- perguntam por ela. E dentro do jsonb ela seria texto livre, sem chave
-- estrangeira: a campanha apagada deixaria o nome velho gravado para sempre.
--
-- E ELA E `on delete set null`, nao `cascade`. Apagar uma campanha nao pode
-- levar junto o PEDIDO do cliente: ele e o que ele escreveu, com a conversa e
-- os anexos, e sobrevive a campanha de que ele nasceu -- e a mesma decisao de
-- `recurrence_id` ser `set null` nas demandas que a regra ja gerou.
--
-- A TRAVA QUE IMPORTA E A DO PASSO 2, e ela nao e sobre vazamento.
-- `campaigns_select_cliente` ja impede o cliente de LER a campanha de outra
-- empresa; o que nada impedia e ele ESCREVER o uuid de uma delas aqui, num
-- insert montado a mao. Nao vazaria nada -- ele continua sem conseguir ler --,
-- mas penduraria o pedido dele numa campanha que nao e da conta dele, e a aba
-- Entregas daquela campanha passaria a listar um pedido estranho para quem a
-- abrisse do outro lado.
--
-- E TRIGGER E NAO `check` pela razao da 0082: a pergunta e uma subconsulta, e
-- o Postgres recusa subconsulta em check constraint ("cannot use subquery in
-- check constraint"). Ela virou funcao la; aqui o trigger ainda ganha o
-- direito de NOMEAR o que esta errado, que e a decisao da 0023.
--
-- O RAMO DA CAMPANHA INEXISTENTE NAO RECUSA NADA QUE A CHAVE ESTRANGEIRA JA
-- NAO RECUSASSE, e isso foi medido: tirando-o, o insert continua sendo negado
-- -- pela FK, com "violates foreign key constraint
-- client_requests_campaign_id_fkey" na cara de quem clicou. Ele existe para a
-- recusa ser uma FRASE e nao o erro cru do Postgres, que e a decisao da 0023.
-- O cenario mede exatamente isso: sem o ramo ele nao passa a aceitar, ele
-- falha dizendo "recusou por outro motivo".
--
-- MEDIDO COM DUAS MUTACOES, sobre 2267 cenarios: tirar o ramo da campanha de
-- outra empresa derruba 2 -- a recusa e a dica --, e tirar o da inexistente
-- derruba 1, pelo motivo acima.
--
-- O QUE ELA NAO FAZ, e fica dito: converter a solicitacao em demanda NAO
-- propaga a campanha. `campaigns.task_id` aponta da campanha para a demanda, e
-- nao o contrario -- nao ha onde escrever. Ligar os dois e decisao propria, e
-- passa por `abrir_campanha()`.
-- ---------------------------------------------------------------------------

-- PASSO 1 ------------------------------------------------------------------
alter table public.client_requests
  add column if not exists campaign_id uuid
    references public.campaigns (id) on delete set null;

comment on column public.client_requests.campaign_id is
  'A campanha a que este pedido pertence, quando ele nasce de uma. Opcional: '
  'a maioria dos pedidos e avulsa. `on delete set null` porque o pedido '
  'sobrevive a campanha -- ele e o que o cliente escreveu.';

-- Quem filtra por campanha e a aba Entregas do detalhe e o Cronograma, sempre
-- dentro de uma conta: o indice e o par, e nao a coluna sozinha.
create index if not exists client_requests_campanha_idx
  on public.client_requests (client_id, campaign_id)
  where campaign_id is not null;

-- PASSO 2 ------------------------------------------------------------------
-- A campanha tem de ser da MESMA empresa do pedido.
create or replace function public.pedido_campanha_da_mesma_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  dona uuid;
begin
  if new.campaign_id is null then
    return new;
  end if;

  -- `security definer` de proposito: a pergunta e sobre a campanha, e quem
  -- escreve o pedido pode nao ter como le-la. Sem isto a trava ficaria cega
  -- exatamente no caso que ela existe para pegar -- a campanha de outra
  -- empresa, que o cliente nao enxerga.
  select c.client_id into dona
    from public.campaigns c
   where c.id = new.campaign_id;

  if dona is null then
    raise exception 'Essa campanha não existe.'
      using hint = 'Escolha uma da lista, ou deixe em "Sem campanha".';
  end if;

  if dona <> new.client_id then
    raise exception 'Essa campanha é de outra empresa.'
      using hint = 'O pedido e a campanha precisam ser da mesma conta. '
                   'Escolha uma campanha desta empresa, ou deixe em '
                   '"Sem campanha".';
  end if;

  return new;
end;
$func$;

drop trigger if exists client_requests_campanha_coerente on public.client_requests;
create trigger client_requests_campanha_coerente
  before insert or update of campaign_id, client_id on public.client_requests
  for each row execute function public.pedido_campanha_da_mesma_conta();

-- CONFERENCIA --------------------------------------------------------------
-- Deve devolver uma linha, com a coluna e o trigger de pe.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'client_requests'
      and column_name = 'campaign_id')                 as tem_coluna,
  (select count(*) from pg_trigger
    where tgname = 'client_requests_campanha_coerente'
      and not tgisinternal)                            as tem_trigger;
