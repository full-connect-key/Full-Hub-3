\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

\set CAPACAMP '''c0500000-0000-0000-0000-000000000001'''

-- ===========================================================================
-- 0050 -- A CAPA DA CAMPANHA
--
-- Decisao do usuario: "quero que cada campanha tenha a possibilidade de ter
-- uma foto de capa do card, para ser identificavel direto pela imagem qual
-- campanha e".
--
-- Tres perguntas, e a terceira e a que ninguem faria de proposito:
--
--   1. A capa e OPCIONAL -- campanha nasce sem ela e continua valendo.
--   2. Quem troca e `is_staff()`, pela policy que ja existia. O cliente nao.
--   3. E o cliente PRECISA LER a coluna: a capa e o cartao dele. Uma trava
--      que escondesse a coluna de quem ela serve passaria por qualquer
--      cenario que so olhasse quem escreve.
--
-- O QUE ESTA BATERIA NAO ALCANCA, e vale dizer: o bug que abriu este trabalho
-- ("Nenhuma campanha aberta" com campanha criada) era do PostgREST, nao do
-- Postgres -- um `select` embutido citando coluna que nao existe. SQL cru nao
-- reproduz. Quem guarda essa regra agora e `ouFalha()` em
-- `lib/dados/consulta.ts`: a consulta que falha estoura, em vez de devolver
-- lista vazia.
-- ===========================================================================

select teste.limpar();
delete from public.comments;
delete from public.deliverables;
delete from public.campaigns;

insert into public.campaigns (id, client_id, nome, data_inicio, data_fim, criado_por, status)
values (:CAPACAMP, :VERDE, 'Wave da capa', current_date, current_date + 20, :DIEGO, 'ativa');


-- ---------------------------------------------------------------------------
-- 1. NASCE SEM CAPA, E ISSO E O DESENHO
--
-- "A possibilidade de ter" -- exigir uma imagem faria a abertura da campanha
-- parar enquanto alguem procura um arquivo.
-- ---------------------------------------------------------------------------
select teste.conferir('Campanha nasce sem capa',
  (select (capa_url is null)::text from public.campaigns where id = :CAPACAMP), 'true');


-- ---------------------------------------------------------------------------
-- 2. QUEM TROCA E `is_staff()`, PELA POLICY QUE JA EXISTIA
--
-- `campaigns_update` fecha em `is_staff()` desde a 0033, e a capa e coluna de
-- `campaigns`: a 0050 nao precisou de policy nova. O colaborador entra aqui de
-- proposito -- ele e quem monta o material, e travar a capa na gestao faria a
-- imagem depender de alguem que nao esta olhando a campanha.
-- ---------------------------------------------------------------------------
-- O `1` NO FIM DE CADA UM NAO E ENFEITE. Um `update` que o RLS barra nao da
-- erro: ele volta com zero linha, e `teste.cenario(..., 'ok')` sem contagem
-- daria por passado. E o mesmo motivo pelo qual toda escrita do produto
-- termina com `.select()` -- sem a contagem, a trava fechada passa por aqui e
-- o sintoma aparece na tela, dizendo "capa trocada" sem ter trocado nada.
select teste.cenario('O socio poe a capa', :ANA,
  format($fmt$update public.campaigns
    set capa_url = 'aaaaaaaa-0000-0000-0000-000000000001/capas/wave.png'
    where id = %L$fmt$, :CAPACAMP), 'ok', 1);

select teste.conferir('E ela ficou gravada',
  (select capa_url from public.campaigns where id = :CAPACAMP),
  'aaaaaaaa-0000-0000-0000-000000000001/capas/wave.png');

select teste.cenario('O colaborador tambem troca', :BRUNO,
  format($fmt$update public.campaigns
    set capa_url = 'aaaaaaaa-0000-0000-0000-000000000001/capas/outra.png'
    where id = %L$fmt$, :CAPACAMP), 'ok', 1);


-- ---------------------------------------------------------------------------
-- 3. O CLIENTE LE A CAPA -- E ESSE E O PONTO DELA
--
-- Este cenario existe porque o oposto passaria despercebido: uma trava que
-- fechasse a coluna para quem nao e da equipe deixaria todos os cenarios de
-- escrita verdes e o cartao do portal sem imagem nenhuma, que e exatamente o
-- estado que a 0050 veio desfazer.
-- ---------------------------------------------------------------------------
select teste.conferir_como('Joana le a capa da campanha dela', :JOANA,
  format($fmt$select capa_url from public.campaigns where id = %L$fmt$, :CAPACAMP),
  'aaaaaaaa-0000-0000-0000-000000000001/capas/outra.png');

select teste.cenario('Otto nao alcanca a campanha da outra empresa', :OTTO,
  format('select 1 from public.campaigns where id = %L', :CAPACAMP), 'recusa');


-- ---------------------------------------------------------------------------
-- 4. O CLIENTE NAO TROCA A CAPA
--
-- A capa e como a AGENCIA apresenta o trabalho, e nao uma preferencia de quem
-- recebe. Ele nunca teve UPDATE em `campaigns`, e continua sem -- o cenario
-- guarda isso contra a policy que alguem afrouxaria para deixar o cliente
-- "personalizar o portal dele".
-- ---------------------------------------------------------------------------
select teste.cenario('Joana nao troca a capa', :JOANA,
  format($fmt$update public.campaigns set capa_url = 'qualquer/coisa.png'
    where id = %L$fmt$, :CAPACAMP), 'recusa');

select teste.conferir('E a capa continua a que a equipe pos',
  (select capa_url from public.campaigns where id = :CAPACAMP),
  'aaaaaaaa-0000-0000-0000-000000000001/capas/outra.png');


-- ---------------------------------------------------------------------------
-- 5. TIRAR A CAPA E `null`, E A CAMPANHA CONTINUA DE PE
--
-- O cartao volta ao desenho de texto. Nada mais muda -- a capa nunca foi
-- requisito de nada, e um `not null` aqui quebraria toda campanha anterior a
-- esta migration.
-- ---------------------------------------------------------------------------
select teste.cenario('A gestao tira a capa', :DIEGO,
  format($fmt$update public.campaigns set capa_url = null where id = %L$fmt$, :CAPACAMP),
  'ok', 1);

select teste.conferir('A campanha continua existindo, sem capa',
  (select (capa_url is null)::text from public.campaigns where id = :CAPACAMP), 'true');


-- ===========================================================================
-- APAGAR A CAMPANHA -- SOCIO E DESENVOLVEDOR, E MAIS NINGUEM
--
-- Decisao do usuario: "preciso que seja possivel deletar uma campanha, apenas
-- para Socios e desenvolvedores".
--
-- **NAO HOUVE MIGRATION NOVA, e essa e a resposta certa.**
-- `campaigns_delete` e `is_gestor()` desde a 0033 -- exatamente desenvolvedor
-- e socio. Uma policy nova dizendo a mesma coisa seria o lugar onde as duas
-- verdades divergem. O que faltava era a tela.
--
-- Os cenarios entram mesmo assim, e nao sao redundantes: eles sao o que avisa
-- se alguem trocar `is_gestor()` por `is_staff()` ali no dia em que a rota
-- abrir para o colaborador -- que foi exatamente o que o Social Media fez com
-- o modulo dele.
-- ===========================================================================
\set APAGAR '''c0500000-0000-0000-0000-000000000002'''
\set ITEM   '''d0500000-0000-0000-0000-000000000001'''

insert into public.campaigns (id, client_id, nome, data_inicio, data_fim, criado_por, status)
values (:APAGAR, :VERDE, 'Wave que vai embora', current_date, current_date + 10, :DIEGO, 'ativa');

insert into public.deliverables (id, campaign_id, nome, ordem, responsavel_id)
values (:ITEM, :APAGAR, 'Peca', 0, :BRUNO);

-- O COLABORADOR NAO APAGA. Ele produz o material da campanha e chega ao
-- modulo por causa disso; apagar a campanha inteira nao e trabalho dele.
select teste.cenario('O colaborador nao apaga a campanha', :BRUNO,
  format('delete from public.campaigns where id = %L', :APAGAR), 'recusa');

select teste.conferir('E ela continua la',
  (select count(*)::text from public.campaigns where id = :APAGAR), '1');

-- O CLIENTE MUITO MENOS. Ele nem tem policy de delete em `campaigns`.
select teste.cenario('Joana nao apaga a campanha dela', :JOANA,
  format('delete from public.campaigns where id = %L', :APAGAR), 'recusa');

-- O DESENVOLVEDOR APAGA. O `1` de linhas e o que separa "apagou" de "o RLS
-- nao achou a linha": as duas voltam sem erro.
select teste.cenario('O desenvolvedor apaga', :DIEGO,
  format('delete from public.campaigns where id = %L', :APAGAR), 'ok', 1);

-- E A ARVORE VAI JUNTO, por chave estrangeira. E o que a tela conta na
-- confirmacao, e o que faz o dialogo exigir o nome digitado em vez de um
-- "tem certeza?".
select teste.conferir('Os entregaveis foram junto',
  (select count(*)::text from public.deliverables where campaign_id = :APAGAR), '0');
