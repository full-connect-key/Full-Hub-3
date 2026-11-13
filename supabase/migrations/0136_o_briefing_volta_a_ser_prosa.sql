-- ---------------------------------------------------------------------------
-- 0136 - O BRIEFING DA CAMPANHA VOLTA A SER UMA CAIXA DE TEXTO
--
-- Decisao do usuario: *"Briefing deve ser apenas uma caixa de texto, sem todos
-- os questionamentos que aparecem atualmente quando vou abrir uma campanha"*.
--
-- ISTO E UMA REVERSAO DECLARADA DA 0125, e so da metade de TELA dela. Aquela
-- migration criou sete campos nomeados -- objetivo, publico, mensagem,
-- produtos, tom de voz, canais, restricoes -- com o argumento do roteiro de
-- briefing das Solicitacoes (0068): *"um campo de texto livre chamado
-- 'descreva o que voce precisa' devolve 'uma arte pro insta'"*. O argumento
-- continua certo para quem PEDE um trabalho de fora, e quem abre uma campanha
-- aqui dentro e o Atendimento, que ja sabe o que escrever -- e para ele os
-- sete campos sao sete caixas para encher antes de conseguir criar a campanha.
--
-- E ELA RESTAURA A 0051, palavra por palavra: *"o briefing e a pasta de
-- entrega sao da DEMANDA, nao colunas novas em `campaigns`. Uma segunda caixa
-- de texto com o mesmo papel em outra tabela seria o lugar onde as duas
-- versoes do briefing divergem."* A 0125 criou esse segundo lugar, e o preco
-- dele estava a vista: o painel da campanha desenhava os sete campos e **nao
-- desenhava a prosa** -- quem escrevia as "Observacoes" na abertura so as
-- encontrava abrindo a demanda, noutra tela. Com uma caixa so, o briefing da
-- campanha e o briefing da demanda, e nao ha duas versoes.
--
-- ---------------------------------------------------------------------------
-- AS SETE COLUNAS FICAM, SEM LEITOR E SEM ESCRITOR -- e isso NAO contradiz a
-- 0023.
--
-- Aquela regra e sobre um campo que continua sendo PERGUNTADO e nao decide
-- mais nada: *"o pior tipo de campo, porque quem responde acha que garantiu
-- alguma coisa"*. Depois desta migration nenhuma tela pergunta nenhuma das
-- sete. Quem governa e a 0116 (`max_parcelas_ferias`): *"ela nao e perguntada
-- em lugar nenhum: e um numero de contrato que ja esta gravado, e apaga-la
-- destruiria o que cada ficha trazia"*. O `comment on column` abaixo e o que
-- impede alguem de le-las como vivas tres sprints adiante.
--
-- E APAGA-LAS DESTRUIRIA CONTEUDO QUE A CONVERSAO NAO ALCANCA: `task_id` e
-- nulo nas campanhas anteriores a 0051 (e `scripts/campanhas-sem-demanda.sql`
-- existe porque elas existem), e para essas nao ha demanda que receba a prosa.
-- ---------------------------------------------------------------------------
-- A CONVERSAO E A METADE QUE IMPORTA, e e a licao da 0087: *"sem a conversao,
-- toda conta que combinou aprovar a pauta perderia o portao no instante em que
-- a migration fosse aplicada"*. Aqui o que se perderia e o combinado com o
-- cliente de toda campanha em producao -- sete campos que ninguem mais
-- desenha. O PASSO 1 move o que esta escrito para o briefing em prosa da
-- DEMANDA, que e onde o briefing passa a morar.
--
-- ELA E IDEMPOTENTE PELA MARCA, e nao por uma coluna de controle: o bloco
-- comeca por uma linha fixa, e a conversao pula a demanda que ja a tem. Uma
-- migration deste projeto precisa poder rodar duas vezes sem erro, e sem a
-- marca a segunda colagem escreveria o briefing duas vezes dentro do mesmo
-- documento.
--
-- E ELA ANEXA, NUNCA SOBRESCREVE. A prosa que ja estava la foi escrita por
-- alguem; o bloco entra embaixo dela, com a marca dizendo de onde veio.
-- ---------------------------------------------------------------------------
-- `formato` e `dimensoes` de `campaign_composicao` NAO SAO TOCADAS, e a
-- ausencia e decisao: elas nao sao pergunta de briefing, sao a especificacao
-- do plano por tipo -- "dez estaticos em 1080x1350" --, e e a tabela da
-- composicao que as desenha desde a 0125. O que muda e so ONDE elas se
-- editam: saem do editor do briefing (que deixou de ser um formulario) e vao
-- para a secao da composicao, que e onde elas sao lidas. O argumento da 0125
-- para te-las no briefing -- *"tirar o formato do editor obrigaria a pessoa a
-- salvar e ir procurar outro lugar para a medida"* -- morre junto com o
-- formulario que ele descrevia.
-- ---------------------------------------------------------------------------
-- NAO HA `drop column`, NAO HA COLUNA NOVA E NAO HA FUNCAO NOVA. O que esta
-- migration faz e mover conteudo e carimbar as sete colunas como mortas; a
-- mudanca de verdade e de tela.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- PASSO 1 - A conversao: o briefing estruturado vira prosa na demanda.
-- ===========================================================================
do $$
declare
  c record;
  linhas text[];
  bloco text;
  paragrafos jsonb;
  doc jsonb;
  convertidas integer := 0;
  sem_demanda integer := 0;
  marca constant text := 'Briefing da campanha';
begin
  for c in
    select
      ca.id,
      ca.nome,
      ca.task_id,
      ca.objetivo,
      ca.publico,
      ca.mensagem,
      ca.produtos,
      ca.tom_de_voz,
      ca.canais,
      ca.restricoes
    from public.campaigns ca
    where coalesce(btrim(ca.objetivo), '') <> ''
       or coalesce(btrim(ca.publico), '') <> ''
       or coalesce(btrim(ca.mensagem), '') <> ''
       or coalesce(btrim(ca.produtos), '') <> ''
       or coalesce(btrim(ca.tom_de_voz), '') <> ''
       or coalesce(btrim(ca.restricoes), '') <> ''
       or coalesce(array_length(ca.canais, 1), 0) > 0
  loop
    -- SEM DEMANDA NAO HA ONDE POR, e a campanha fica com as colunas. Sao as
    -- anteriores a 0051; `scripts/campanhas-sem-demanda.sql` e quem as liga a
    -- uma demanda, pedindo a pasta de entrega a quem sabe qual e.
    if c.task_id is null then
      sem_demanda := sem_demanda + 1;
      continue;
    end if;

    -- JA CONVERTIDA: a marca esta na prosa. Pular aqui e o que faz a segunda
    -- colagem nao escrever o bloco duas vezes.
    if exists (
      select 1
      from public.tasks t
      where t.id = c.task_id
        and coalesce(t.briefing_texto, '') like '%' || marca || '%'
    ) then
      continue;
    end if;

    linhas := array[marca];

    if coalesce(btrim(c.objetivo), '') <> '' then
      linhas := linhas || ('Objetivo: ' || btrim(c.objetivo));
    end if;
    if coalesce(btrim(c.publico), '') <> '' then
      linhas := linhas || ('Publico: ' || btrim(c.publico));
    end if;
    if coalesce(btrim(c.mensagem), '') <> '' then
      linhas := linhas || ('Mensagem central: ' || btrim(c.mensagem));
    end if;
    if coalesce(btrim(c.produtos), '') <> '' then
      linhas := linhas || ('Produtos ou servicos: ' || btrim(c.produtos));
    end if;
    if coalesce(btrim(c.tom_de_voz), '') <> '' then
      linhas := linhas || ('Tom de voz: ' || btrim(c.tom_de_voz));
    end if;
    if coalesce(array_length(c.canais, 1), 0) > 0 then
      linhas := linhas || ('Canais: ' || array_to_string(c.canais, ', '));
    end if;
    if coalesce(btrim(c.restricoes), '') <> '' then
      linhas := linhas || ('Restricoes: ' || btrim(c.restricoes));
    end if;

    bloco := array_to_string(linhas, E'\n');

    -- UM PARAGRAFO POR LINHA, na forma que o TipTap le. Um `content: []` vazio
    -- quebra o schema do editor, entao a linha vazia nao existe aqui: o bloco
    -- e montado sem nenhuma.
    select jsonb_agg(
             jsonb_build_object(
               'type', 'paragraph',
               'content', jsonb_build_array(
                 jsonb_build_object('type', 'text', 'text', l)
               )
             )
           )
      into paragrafos
      from unnest(linhas) as l;

    -- O DOCUMENTO ANTIGO FICA, e o bloco entra embaixo. Quando nao ha
    -- documento -- ou quando o que esta la nao e um `doc` com `content` --, a
    -- conversao comeca de um doc vazio em vez de estourar: ela nao pode
    -- derrubar a migration por causa de uma linha torta.
    select case
             when t.briefing_rico is null then '[]'::jsonb
             when jsonb_typeof(t.briefing_rico -> 'content') = 'array'
               then t.briefing_rico -> 'content'
             else '[]'::jsonb
           end
      into doc
      from public.tasks t
     where t.id = c.task_id;

    if doc is null then
      continue;
    end if;

    update public.tasks t
       set briefing_texto =
             case
               when coalesce(btrim(t.briefing_texto), '') = '' then bloco
               else btrim(t.briefing_texto) || E'\n\n' || bloco
             end,
           briefing_rico = jsonb_build_object(
             'type', 'doc',
             'content', doc || paragrafos
           )
     where t.id = c.task_id;

    convertidas := convertidas + 1;
  end loop;

  raise notice '0136: % briefing(s) movido(s) para a prosa da demanda; % campanha(s) sem demanda ficaram com as colunas.',
    convertidas, sem_demanda;
end;
$$;

-- ===========================================================================
-- PASSO 2 - As sete colunas ficam, carimbadas como mortas.
-- ===========================================================================
comment on column public.campaigns.objetivo is
  'MORTA desde a 0136: nenhuma tela escreve nem le. O briefing da campanha voltou a ser a prosa da demanda (tasks.briefing_rico). O conteudo foi movido para la onde havia demanda; ela fica, em vez de ser apagada, porque a campanha anterior a 0051 nao tem demanda que o receba.';
comment on column public.campaigns.publico is
  'MORTA desde a 0136 - veja o comentario de campaigns.objetivo.';
comment on column public.campaigns.mensagem is
  'MORTA desde a 0136 - veja o comentario de campaigns.objetivo.';
comment on column public.campaigns.produtos is
  'MORTA desde a 0136 - veja o comentario de campaigns.objetivo.';
comment on column public.campaigns.tom_de_voz is
  'MORTA desde a 0136 - veja o comentario de campaigns.objetivo.';
comment on column public.campaigns.canais is
  'MORTA desde a 0136 - veja o comentario de campaigns.objetivo.';
comment on column public.campaigns.restricoes is
  'MORTA desde a 0136 - veja o comentario de campaigns.objetivo.';

-- ===========================================================================
-- PASSO 3 - Confira.
-- ===========================================================================
-- Deve devolver zero linhas: toda campanha COM demanda e com briefing escrito
-- ja tem a marca na prosa dela. O que sobrar aqui e campanha sem demanda.
select
  ca.id,
  ca.nome,
  ca.task_id is null as sem_demanda
from public.campaigns ca
left join public.tasks t on t.id = ca.task_id
where (
        coalesce(btrim(ca.objetivo), '') <> ''
     or coalesce(btrim(ca.publico), '') <> ''
     or coalesce(btrim(ca.mensagem), '') <> ''
     or coalesce(btrim(ca.produtos), '') <> ''
     or coalesce(btrim(ca.tom_de_voz), '') <> ''
     or coalesce(btrim(ca.restricoes), '') <> ''
     or coalesce(array_length(ca.canais, 1), 0) > 0
      )
  and coalesce(t.briefing_texto, '') not like '%Briefing da campanha%';
