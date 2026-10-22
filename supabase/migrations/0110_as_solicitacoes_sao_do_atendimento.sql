-- ===========================================================================
-- 0110 - AS SOLICITACOES SAO DO ATENDIMENTO
--
-- Decisao do usuario: *"As solicitacoes devem ser visualizadas apenas pelo
-- atendimento, por desenvolvedores, ou socios"*.
--
-- Essa lista e, letra por letra, `is_atendimento()`: quem tem
-- `funcao = 'Atendimento'` MAIS a gestao. Nao e uma funcao nova nem uma
-- parecida -- e a MESMA que `tasks_insert` usa desde a 0006 e que
-- `client_requests_update` (0068) ja usa para triar. Duas perguntas
-- diferentes para o mesmo modulo seriam o lugar onde as duas verdades
-- comecam a divergir.
--
-- ---------------------------------------------------------------------------
-- A 0068 PREVIU ESTA MIGRATION, e a frase dela esta em `permissions.ts`:
--
--   "um colaborador fora do Atendimento ve a lista dos pedidos de todos os
--    clientes. Ele ja ve as demandas deles no board, entao nao ha nada aqui
--    que o board nao mostre -- MAS SE UM DIA ISSO PRECISAR SER FECHADO, E UMA
--    POLICY DE SELECT MAIS ESTREITA, NAO UM `roles` MAIS CURTO."
--
-- E o dia, e o caminho e esse mesmo. **Um `roles` mais curto nao resolveria e
-- nao e so por principio:** o colaborador do Atendimento tem o perfil
-- `colaborador`, igual ao do Design -- `roles` nao sabe distinguir os dois,
-- porque perfil de acesso e funcao na agencia sao coisas diferentes (e a
-- regra da funcao Atendimento, escrita desde a 0006). Fechar por `roles`
-- esconderia o modulo exatamente de quem o usa.
--
-- ---------------------------------------------------------------------------
-- O QUE A LISTA TEM QUE O BOARD NAO TEM, e e por isso que a frase de 0068
-- deixou de valer:
--
--   * o pedido RECUSADO, com o motivo escrito por quem recusou;
--   * a CONVERSA inteira entre a agencia e a empresa -- `request_messages`
--     nao tem coluna `interno` (0068), entao tudo ali e combinado entre duas
--     empresas sobre o que vai ser feito;
--   * os ANEXOS que o cliente mandou;
--   * e o que ele pediu e a agencia nunca aceitou -- que por definicao nao
--     esta no board.
--
-- ---------------------------------------------------------------------------
-- O QUE NAO MUDA, e a lista importa porque ela e o que prova que isto e um
-- recorte de LEITURA e nada mais:
--
--   * O CLIENTE continua lendo os pedidos da empresa dele, pelo mesmo
--     `my_client_ids()`. Ele e o outro lado da conversa.
--   * QUEM TRIA continua sendo `is_atendimento()` (`client_requests_update`),
--     e QUEM APAGA continua sendo `is_gestor()` -- as duas desde a 0068, e as
--     duas passam pela porta nova, entao ninguem perdeu uma acao que tinha.
--   * `tasks_espelha_no_pedido` e `client_requests_avisa_decisao` sao
--     `security definer` e nao passam por policy nenhuma: o pedido continua
--     andando quando a demanda e publicada, mesmo que quem publicou nao
--     alcance mais a fila.
--   * O SINO continua chegando a quem a 0103 escolheu -- `quem_atende()`, que
--     e o Atendimento mais o responsavel da conta, com a gestao como
--     fallback. Ele nunca foi `is_staff()`.
--
-- ---------------------------------------------------------------------------
-- A BUSCA GLOBAL ACOMPANHA SEM UMA LINHA, e isso e consequencia de uma
-- decisao da 0073: `busca_global()` NAO e `security definer`, justamente para
-- a policy das nove tabelas valer dentro dela. Estreitando a policy, o
-- colaborador fora do Atendimento para de achar pedido na paleta -- e nao ha
-- um segundo lugar para lembrar. A bateria guarda o cenario que prova isso,
-- porque e a classe de furo que este produto ja pagou duas vezes (a 0029 e a
-- 0060, as duas em que a regra morava em dois lados).
--
-- ---------------------------------------------------------------------------
-- `request_types_select` FICA COMO ESTA (`is_staff() or ativo`), e a ausencia
-- e decisao. Aquela tabela nao e uma solicitacao: e o CATALOGO de roteiros de
-- briefing, igual para todas as contas, sem dado de cliente nenhum dentro.
-- Estreita-la mudaria uma coisa so -- o colaborador fora do Atendimento
-- passaria a ler apenas os tipos ativos, como o cliente ja le --, e ele nao
-- tem tela que leia essa tabela. Mexer nela seria churn sem nada em troca,
-- e deixar a razao escrita vale mais que uma linha de SQL que nao decide
-- nada.
--
-- ---------------------------------------------------------------------------
-- A ORDEM DOS PASSOS E AO CONTRARIO DA 0068, E DE PROPOSITO.
--
-- La o bucket era o PASSO 10. Aqui ele e o PASSO 1, porque o marcador do
-- `onde-esta-o-banco.sql` NAO TEM COMO MEDIR UMA POLICY DE STORAGE: o tipo
-- `policy` fecha em `schemaname = 'public'`, e o unico que alcanca outro
-- schema -- `policy_fora` -- confere EXISTENCIA, que nao distingue nada aqui,
-- porque a 0068 ja criou policies com nome naquela tabela. Deixando o bucket
-- por ultimo, o marcador apontaria para o penultimo passo e diria ok num
-- banco onde a colagem morreu antes do fim -- e marcador que nao mede e
-- marcador que mente, que e a armadilha que aquele arquivo ja pagou com a
-- 0055 e com as cinco linhas quebradas do pacote da 3K.
--
-- O marcador aponta para `client_requests_select`, que e a ULTIMA coisa que
-- este arquivo muda, e ele mede o CORPO da policy: ela existe desde a 0068
-- com `is_staff()` dentro, entao perguntar "a policy existe?" responderia ok
-- num banco que nunca viu esta migration.
--
-- *E o `if to_regclass('storage.objects') is null` do PASSO 1 nao e sobre a
-- bateria:* o fixture dela cria aquela tabela, e os dois cenarios do bucket
-- rodam de verdade. Ele e sobre um banco servido sem o Storage, e e a mesma
-- guarda que a 0068 escreveu.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O bucket dos anexos
--
-- Tres policies, e as duas de leitura/escrita trocam `is_staff()` por
-- `is_atendimento()`. A de apagar ja era `is_gestor()` do lado da agencia, e
-- gestao passa na porta nova -- ela fica como esta.
--
-- A PASTA CONTINUA SENDO DA EMPRESA, e e ela que separa um cliente do outro:
-- a policy de storage nao enxerga a tabela do pedido sem um join que
-- `storage.foldername()` nao faz. Isto aqui estreita o lado da AGENCIA, e nao
-- toca no recorte por empresa.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  -- AS DUAS COM O NOME ANTIGO SAEM, e nao ficam ao lado das novas. Policy
  -- permissiva e OR: uma que diz `is_staff()` ao lado de uma que diz
  -- `is_atendimento()` nao estreita nada -- e a licao que a RLS do rascunho
  -- pagou na 0028, onde a primeira versao deixou outra pessoa APAGAR a
  -- referencia de um rascunho que ela nao conseguia enxergar.
  --
  -- O NOME MUDOU JUNTO, e e o que torna o drop conferivel: duas policies com
  -- o mesmo nome e corpos diferentes nao convivem, mas uma sobra com o nome
  -- antigo convive -- e o `select` de conferencia no fim deste arquivo
  -- procura exatamente por ela.
  execute 'drop policy if exists "solicitacoes: a empresa e a equipe leem" on storage.objects';
  execute 'drop policy if exists "solicitacoes: a empresa e a equipe escrevem" on storage.objects';
  execute 'drop policy if exists "solicitacoes: a empresa e o atendimento leem" on storage.objects';
  execute 'drop policy if exists "solicitacoes: a empresa e o atendimento escrevem" on storage.objects';

  execute $politica$
    create policy "solicitacoes: a empresa e o atendimento leem" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'solicitacoes-arquivos'
        and (
          public.is_atendimento()
          or (storage.foldername(name))[1]::uuid in (select public.my_client_ids())
        )
      )
  $politica$;

  execute $politica$
    create policy "solicitacoes: a empresa e o atendimento escrevem" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'solicitacoes-arquivos'
        and (
          public.is_atendimento()
          or (storage.foldername(name))[1]::uuid in (select public.my_client_ids())
        )
      )
  $politica$;
end;
$bloco$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - Quem ve um pedido
--
-- `posso_ver_solicitacao()` e a porta de `request_attachments` e de
-- `request_messages`, nas quatro policies que as duas tem. Trocando aqui, os
-- anexos e a conversa acompanham sem uma linha -- que e exatamente por que a
-- 0068 criou esta funcao em vez de repetir a pergunta quatro vezes.
--
-- Ela e `security definer` porque le `client_requests` por dentro: sem isso a
-- policy de anexo dependeria da policy do pedido, e um `select` recursivo em
-- RLS nao e uma coisa que se queira depurar.
-- ---------------------------------------------------------------------------
create or replace function public.posso_ver_solicitacao(p_pedido uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $func$
begin
  return exists (
    select 1 from public.client_requests r
     where r.id = p_pedido
       and (public.is_atendimento() or r.client_id in (select public.my_client_ids()))
  );
end;
$func$;

comment on function public.posso_ver_solicitacao(uuid) is
  'O pedido e meu? Para a empresa, `my_client_ids()`. Do lado da agencia e `is_atendimento()` desde a 0110 -- era `is_staff()`.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - O pedido
--
-- E A ULTIMA LINHA QUE ESTE ARQUIVO MUDA, de proposito: e ela que o
-- `onde-esta-o-banco.sql` mede.
-- ---------------------------------------------------------------------------
drop policy if exists client_requests_select on public.client_requests;
create policy client_requests_select on public.client_requests
  for select to authenticated
  using (public.is_atendimento() or client_id in (select public.my_client_ids()));

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONFERENCIA, para a segunda colagem:
--
--   select policyname, qual from pg_policies
--    where tablename = 'client_requests' and policyname = 'client_requests_select';
--   -- qual tem que citar is_atendimento, e nao is_staff
--
--   select policyname from pg_policies
--    where tablename = 'objects' and policyname like 'solicitacoes:%';
--   -- tres linhas, e nenhuma com "a equipe"
-- ---------------------------------------------------------------------------
