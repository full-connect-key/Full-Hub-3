-- ===========================================================================
-- CADASTRAR "Operacoes | Criacao" NO FULL ACADEMY
--
-- Sprint 3L-B, secao 4. Cola no SQL Editor do Supabase DEPOIS de aplicar a
-- migration 0102.
--
-- ---------------------------------------------------------------------------
-- SAO DOIS PASSOS, E O DO MEIO E SEU: subir o arquivo.
--
--   1. rode o PASSO 1 abaixo              -- cria o item, os 23 capitulos e as
--                                            regras de obrigatoriedade
--   2. suba `arquivos/operacoes-criacao.html` no Storage, no bucket
--      `academy-arquivos`, no caminho EXATO:
--
--          ebooks/aca10001-0000-4000-8000-000000000001/v1/index.html
--
--   3. rode o PASSO 2                     -- grava a linha do arquivo
--
-- **O ID DO ITEM E LITERAL, e e o que torna isso possivel:** com um uuid
-- sorteado, o caminho do arquivo so existiria depois do insert -- e voce
-- teria de copiar o id da saida de um passo para o nome de uma pasta do
-- outro, a mao, uma vez. Fixo, o caminho esta escrito aqui e no PASSO 2, e os
-- dois nunca discordam.
--
-- **E O PASSO 2 SO GRAVA SE O ARQUIVO ESTIVER LA.** Sem essa conferencia, o
-- e-book apareceria publicado no acervo com um iframe em branco -- e quem
-- abrisse concluiria que a plataforma quebrou, nao que faltou um upload.
--
-- RODAR DE NOVO NAO DUPLICA NADA: todo insert tem `on conflict do nothing`, e
-- o do arquivo e por `(item_id, versao)`.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O ITEM, OS CAPITULOS E A OBRIGATORIEDADE
-- ---------------------------------------------------------------------------
begin;

-- O ITEM NASCE PUBLICADO, ao contrario de todo item criado pela tela.
--
-- A regra da 0096 -- *nao publicar item sem conteudo apenas para preencher o
-- acervo* -- continua inteira: este tem conteudo, e o conteudo esta pronto. O
-- que seria errado e o contrario: deixa-lo em rascunho obrigaria alguem a
-- lembrar de publicar depois, e um e-book obrigatorio que ninguem enxerga e
-- uma obrigatoriedade que nao cobra nada.
insert into public.academy_items
  (id, tipo, titulo, slug, resumo, descricao, categoria, tags,
   publicado, ordem, duracao_estimada_minutos, exige_confirmacao_leitura)
values (
  'aca10001-0000-4000-8000-000000000001',
  'ebook',
  'Operações | Criação',
  'operacoes-criacao',
  'Como a Criação da Full opera: do briefing que chega ao arquivo aberto que fica.',
  'Playbook completo da área de Criação em 23 capítulos — escopos e responsabilidades, fluxo de entrada e organização das demandas, desenvolvimento, autorrevisão, fechamento para gráfica, social, performance, audiovisual, uso de imagens e IA, controle de qualidade, apresentação e aprovação, alterações e organização do Drive. Traz a matriz de responsabilidades por função e os checklists de conferência usados no dia a dia.',
  'Produção',
  array['criação','processo','onboarding','qualidade','drive','gráfica','social','performance','audiovisual'],
  true,
  1,
  90,
  true
)
on conflict (id) do nothing;

-- OS 23 CAPITULOS, NA ORDEM DO DOCUMENTO.
--
-- A `chave` de cada um e o `id` dele DENTRO do HTML -- e o contrato entre a
-- pagina e o banco. Renomear um id la sem renomear aqui faz a leitura daquele
-- capitulo deixar de contar, em silencio: a tela ignora a chave que nao
-- conhece em vez de gravar uma linha solta.
insert into public.academy_ebook_capitulos (item_id, chave, titulo, ordem)
select 'aca10001-0000-4000-8000-000000000001', c.chave, c.titulo, c.ordem
from (values
  ('como-usar','Como usar este documento',1),
  ('escopos','Escopos e responsabilidades',2),
  ('papel','Papel da equipe de Criação',3),
  ('clientes','Clientes atendidos',4),
  ('integracao','Guia de integração das equipes',5),
  ('ferramentas','Ferramentas de apoio',6),
  ('entrada','Fluxo de entrada de demandas',7),
  ('organizacao','Organização do processo',8),
  ('inicio','Início do processo',9),
  ('desenvolvimento','Desenvolvimento criativo',10),
  ('autorrevisao','Autorrevisão da demanda',11),
  ('grafica','Fechamento de arquivos para gráfica',12),
  ('pesquisa','Pesquisa e referência visual',13),
  ('identidade','Identidade visual dos clientes',14),
  ('social','Criação para social media',15),
  ('performance','Criação para criativos de performance',16),
  ('audiovisual','Criação para audiovisual',17),
  ('imagens','Imagens, ilustrações e inteligência artificial',18),
  ('qualidade','Controle de qualidade',19),
  ('aprovacao','Apresentação e aprovação',20),
  ('alteracoes','Alterações e retrabalho',21),
  ('drive','Organização do Google Drive',22),
  ('arquivo-aberto','Arquivo aberto',23)
) as c(chave, titulo, ordem)
on conflict (item_id, chave) do nothing;

-- OBRIGATORIO PARA QUEM PRODUZ, E PARA O ATENDIMENTO COM PRAZO MAIOR.
--
-- A razao do Atendimento esta no sprint e vale repetir: metade dos atritos
-- descritos no documento nasce na fronteira entre Atendimento e Criacao --
-- briefing incompleto, prazo prometido sem consulta, alteracao que chega
-- solta. Quem abre a demanda precisa conhecer o processo que ela alimenta.
-- Trinta dias porque nao e a funcao dela.
--
-- O prazo conta da ADMISSAO, e quem nao tem data de admissao na ficha fica sem
-- prazo e com o item obrigatorio do mesmo jeito (0096).
insert into public.academy_obrigatorios (item_id, funcao, prazo_dias_apos_admissao)
select 'aca10001-0000-4000-8000-000000000001', f.funcao::public.team_funcao, f.prazo
from (values
  ('Design', 15),
  ('Audiovisual', 15),
  ('Social Media', 15),
  ('Redator', 15),
  ('Atendimento', 30)
) as f(funcao, prazo)
on conflict (item_id, funcao, role) do nothing;

-- A TRILHA, SE ELA EXISTIR. O vinculo nasce mesmo com a trilha em rascunho --
-- ele passa a valer quando ela for publicada. Sem trilha nenhuma, nada
-- acontece e o item continua alcancavel pelo acervo e pela busca.
insert into public.academy_trilha_itens (trilha_id, item_id, ordem)
select t.id, 'aca10001-0000-4000-8000-000000000001', 1
from public.academy_trilhas t
where t.nome ilike '%onboarding%produ%'
on conflict do nothing;

commit;

-- O QUE CONFERIR ANTES DE SUBIR O ARQUIVO:
select
  (select count(*) from public.academy_items
    where id = 'aca10001-0000-4000-8000-000000000001')            as item,
  (select count(*) from public.academy_ebook_capitulos
    where item_id = 'aca10001-0000-4000-8000-000000000001')       as capitulos_esperado_23,
  (select count(*) from public.academy_obrigatorios
    where item_id = 'aca10001-0000-4000-8000-000000000001')       as regras_esperado_5,
  (select count(*) from public.academy_trilha_itens
    where item_id = 'aca10001-0000-4000-8000-000000000001')       as na_trilha_0_ou_1;


-- ===========================================================================
-- >>> AGORA SUBA O ARQUIVO <<<
--
--   Storage -> academy-arquivos -> crie as pastas e suba
--   `arquivos/operacoes-criacao.html` como:
--
--      ebooks/aca10001-0000-4000-8000-000000000001/v1/index.html
--
--   O NOME DO ARQUIVO E `index.html` de proposito: o caminho e o que a linha
--   do PASSO 2 grava, e um nome com data ou versao dentro obrigaria a editar o
--   SQL conforme o arquivo. A versao ja esta na PASTA.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 2 - A LINHA DO ARQUIVO
--
-- Ela recusa se o objeto nao estiver no bucket, e e a unica trava deste
-- script: sem ela, o e-book ficaria publicado com um iframe em branco.
-- ---------------------------------------------------------------------------
do $bloco$
declare
  v_caminho text := 'ebooks/aca10001-0000-4000-8000-000000000001/v1/index.html';
  v_existe  boolean;
begin
  select exists (
    select 1 from storage.objects
     where bucket_id = 'academy-arquivos' and name = v_caminho
  ) into v_existe;

  if not v_existe then
    raise exception 'O arquivo ainda nao esta no bucket.'
      using hint = 'Suba arquivos/operacoes-criacao.html em academy-arquivos como ' || v_caminho
                || ' e rode este passo de novo.';
  end if;

  insert into public.academy_arquivos
    (item_id, url, nome, formato, versao, paginas, notas_mudanca)
  values (
    'aca10001-0000-4000-8000-000000000001',
    v_caminho,
    'operacoes-criacao.html',
    'html_interativo',
    1,
    109,
    'Primeira publicação. Convertido do documento Operações | Criação.'
  )
  on conflict (item_id, versao) do nothing;

  raise notice 'Pronto. O e-book abre em /painel/academy/operacoes-criacao.';
end;
$bloco$;


-- ===========================================================================
-- DIVIDA EDITORIAL, e ela NAO vira tabela de pendencia no banco.
--
-- O e-book traz dois avisos ao leitor, e os dois sao do documento de origem e
-- nao da conversao:
--
--   1. o texto cita uma ferramenta externa de gestao em varios pontos do fluxo
--      de entrada, de organizacao e de status. Quando o Full Hub estiver em
--      operacao, esses trechos viram a VERSAO 2, publicada com
--      `exige_releitura` -- que e exatamente o caso que a releitura existe
--      para cobrir;
--   2. o documento repetia o titulo "Controle de Qualidade" em dois capitulos,
--      e o segundo trata de apresentacao e aprovacao -- aqui ele esta como
--      "Apresentação e aprovação". O original pode ser corrigido na mesma
--      revisao.
--
-- Sao dois itens. Viram duas tasks no Full Hub quando voces decidirem revisar.
-- ===========================================================================
