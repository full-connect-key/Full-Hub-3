-- ---------------------------------------------------------------------------
-- 0050 - A CAPA DA CAMPANHA
--
-- Decisao do usuario: "quero que cada campanha tenha a possibilidade de ter
-- uma foto de capa do card, para ser identificavel direto pela imagem qual
-- campanha e".
--
-- O cartao da campanha mostra nome, periodo e progresso -- tres linhas de
-- texto. Com quatro campanhas ativas do mesmo cliente, quatro cartoes iguais
-- se distinguem pela leitura, e quem abre o portal uma vez por semana le o
-- nome errado. A capa e o unico elemento que se reconhece de relance.
--
-- E OPCIONAL, e e o ponto da frase dele: "a possibilidade de ter". Campanha
-- sem capa continua valendo e o cartao cai no desenho de hoje -- exigir uma
-- imagem faria a abertura parar enquanto alguem procura um arquivo.
--
-- ---------------------------------------------------------------------------
-- E A CAPA VAI NO MESMO BUCKET DOS ENTREGAVEIS, `campanhas-arquivos`
--
-- Ela e material da campanha, e o bucket e privado pela mesma razao que o das
-- artes de post: capa de campanha que ainda nao foi ao ar e material da
-- agencia. Um bucket publico so para capas daria dois lugares com duas regras
-- para arquivos da mesma campanha.
--
-- ---------------------------------------------------------------------------
-- QUEM TROCA A CAPA E `is_staff()`, PELA POLICY QUE JA EXISTE
--
-- `campaigns_update` fecha em `is_staff()` desde a 0033, e a capa e coluna de
-- `campaigns`: nao precisa de policy nova. O cliente nao tem UPDATE ali, e
-- continua sem -- a capa e como a agencia apresenta o trabalho, e nao uma
-- preferencia de quem recebe.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

alter table public.campaigns
  add column if not exists capa_url text;

comment on column public.campaigns.capa_url is
  'Caminho da capa no bucket `campanhas-arquivos` (0050). OPCIONAL: campanha sem capa cai no cartao de texto. Quem troca e `is_staff()`, pela policy de update que ja existia.';

notify pgrst, 'reload schema';
