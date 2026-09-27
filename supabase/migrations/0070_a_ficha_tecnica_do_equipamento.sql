-- ===========================================================================
-- 0070 - A FICHA TECNICA DO EQUIPAMENTO
--
-- Decisao do usuario: *"quando vou cadastrar um equipamento, quero poder
-- preencher: Memoria RAM, Processador, Placa de Video e Armazenamento"*, no
-- Comodatos.
--
-- ---------------------------------------------------------------------------
-- QUATRO COLUNAS, E NAO UM `jsonb` DE ESPECIFICACOES
--
-- A tentacao e um `especificacoes jsonb`, porque assim uma camera ganharia
-- "megapixels" sem migration. Ela se desfaz em tres pontos:
--
--   * **sao QUATRO campos nomeados que o usuario pediu pelo nome.** Num jsonb
--     a tela teria que inventar as chaves, e a quinta tela que ler aquilo
--     escreveria `placa_video` onde a primeira escreveu `placa_de_video` --
--     sem erro de tipo, sem erro de banco, e com o campo aparecendo vazio;
--   * o criterio que separa `jsonb` de coluna neste produto ja esta escrito, e
--     e o de `post_versions.arquivos` e do template de campanha: **jsonb e para
--     o que se escreve de uma vez e se le inteiro, nunca consultado item a
--     item**. "Quem esta com um notebook de 8GB?" e exatamente uma consulta
--     item a item, e e a pergunta que vem depois desta;
--   * e `midia` virou enum na 0042 pela mesma familia de razao: o que a tela
--     desenha por cima precisa ser um nome que o compilador confere.
--
-- ---------------------------------------------------------------------------
-- E SAO `text`, E NAO NUMERO
--
-- O que se digita e "16 GB", "512 GB SSD", "1 TB NVMe", "Intel i7-1165G7",
-- "RTX 3060 6GB". Uma coluna numerica obrigaria a escolher a unidade no
-- schema, e perderia o "NVMe" e o "SSD" -- que e metade do que a pessoa quer
-- saber antes de pedir a maquina emprestada. E o produto ja tomou essa decisao
-- ao contrario, onde ela cabia: tempo e `integer` em MINUTOS porque a conta e
-- feita em cima dele. Aqui nao ha conta nenhuma.
--
-- ---------------------------------------------------------------------------
-- E NAO HA TRAVA POR TIPO, DE PROPOSITO
--
-- Um `check` exigindo que so `notebook` e `desktop` tenham estes campos
-- recusaria a mesa digitalizadora com processador proprio, o celular com RAM, o
-- gravador com armazenamento -- e a recusa chegaria como erro de banco numa
-- tela de cadastro. Quem decide se o campo faz sentido e quem esta olhando o
-- equipamento. **Quem esconde e a TELA**, que mostra a secao para computador e
-- para todo equipamento que ja tenha qualquer um dos quatro preenchido: sem a
-- segunda metade, trocar o tipo de um notebook para "outro" apagaria a ficha
-- no proximo salvamento, que e a regra que `ItemDoInventario` ja carrega
-- escrita ("um formulario que abre com o campo vazio apaga o que nao
-- mostrou").
-- ===========================================================================

alter table public.assets
  add column if not exists memoria_ram      text,
  add column if not exists processador      text,
  add column if not exists placa_de_video   text,
  add column if not exists armazenamento    text;

comment on column public.assets.memoria_ram is
  'Como a pessoa escreve: "16 GB". Texto e nao numero -- nao ha conta em cima disto, e a unidade faz parte do que se le (0070).';
comment on column public.assets.processador is
  'O modelo por extenso: "Intel i7-1165G7", "Apple M3 Pro" (0070).';
comment on column public.assets.placa_de_video is
  'A GPU, quando ha uma que valha dizer: "RTX 3060 6GB". Vazia na maquina de video integrado (0070).';
comment on column public.assets.armazenamento is
  'O disco, com o tipo: "512 GB SSD", "1 TB NVMe" -- o tipo e metade do que decide se a maquina serve (0070).';

-- A FICHA VAI PARA A TRILHA DE AUDITORIA junto com o resto da linha, sem
-- nenhuma linha nova aqui: `registrar_auditoria()` (0058) copia o trecho que
-- MUDOU, seja qual for a coluna, e `assets` ja esta na lista das treze desde a
-- 0069. Uma chamada a mais aqui seria um segundo lugar para lembrar.
