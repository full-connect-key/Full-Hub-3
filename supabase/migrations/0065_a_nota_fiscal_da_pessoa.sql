-- ===========================================================================
-- 0065 - A NOTA FISCAL DA PESSOA
--
-- O modulo estava no menu desde o Sprint 3C e a tela dizia "esta area ainda
-- nao esta pronta". Nao havia ponte para atravessar desta vez: nem tabela, nem
-- tipo, nem coluna guardada esperando alguem. E modulo do zero.
--
-- O QUE ELE E: a equipe da Full Connect Key e toda PJ, entao todo mes cada
-- pessoa emite a nota dela e manda para a agencia pagar. Isto e essa ida e
-- volta -- e NAO o Financeiro da casa, que e outro modulo, na Gestao, e so o
-- socio alcanca.
--
-- ---------------------------------------------------------------------------
-- AS TRES DECISOES DO USUARIO, e o que cada uma custou
--
-- 1. QUEM CONFERE E PAGA E O SOCIO, e mais ninguem. E a mesma regra do
--    Financeiro (0013), e pela mesma razao: a fila de notas e a folha de
--    pagamento da agencia lida de outro angulo -- quem a abre ve quanto cada
--    colega ganha. O desenvolvedor e gestao para todo o resto do sistema e
--    aqui nao. O custo aceito e o mesmo do Financeiro: num dia em que o socio
--    estiver fora, ninguem aprova nota.
--
-- 2. NOTA PAGA VIRA DESPESA NO FINANCEIRO, automaticamente. Sem isso o mesmo
--    dinheiro seria lancado duas vezes a mao, e a rentabilidade por cliente
--    ignoraria o maior custo da casa. O lancamento nasce do CLIQUE de quem
--    pagou, nunca de uma rotina -- que e a decisao da 0013 sobre gerar
--    lancamentos do mes: "receita que aparece sem ninguem ter mandado e
--    receita que o socio confere uma por uma antes de confiar no relatorio".
--
-- 3. O VALOR E DIGITADO A CADA MES por quem envia. PJ com valor variavel por
--    hora, projeto ou bonus e o caso normal, e um valor fixo na ficha poria o
--    contrato de cada pessoa numa tabela que a gestao inteira ja le.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - O vocabulario
--
-- QUATRO ESTADOS, e `aprovada` e `paga` sao dois de proposito. E a mesma
-- distincao que o produto faz desde a 0007 entre aprovar e enviar: aprovar diz
-- que a nota esta certa, pagar diz que o dinheiro saiu. Juntar os dois faria a
-- tela da pessoa dizer "paga" no dia em que o socio so conferiu.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'nf_status') then
    create type public.nf_status as enum ('enviada', 'aprovada', 'paga', 'recusada');
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - A tabela
-- ---------------------------------------------------------------------------
create table if not exists public.team_invoices (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  competencia       date not null,
  valor             numeric(12,2) not null,
  numero            text,
  arquivo_url       text not null,
  observacoes       text,
  status            public.nf_status not null default 'enviada',
  motivo_recusa     text,
  decidido_por      uuid references public.profiles (id) on delete set null,
  decidido_em       timestamptz,
  pagamento         date,
  -- A PONTE COM O FINANCEIRO, e ela existe para os dois lados nao divergirem:
  -- com ela, marcar paga duas vezes nao lanca duas despesas, e quem abrir o
  -- lancamento sabe de qual nota ele veio. `set null` porque apagar o
  -- lancamento no Financeiro nao desfaz o pagamento que aconteceu.
  finance_entry_id  uuid references public.finance_entries (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint team_invoices_valor_positivo check (valor > 0),
  -- Um valor de nota fiscal de pessoa nao chega perto disto. O teto existe
  -- para o erro de digitacao -- um zero a mais -- nao virar uma despesa de
  -- sete digitos no relatorio do socio.
  constraint team_invoices_valor_plausivel check (valor <= 1000000),
  -- Recusar sem dizer por que manda a pessoa adivinhar, e a proxima nota volta
  -- igual. E a mesma regra de `pedir ajustes` desde a 0007.
  constraint team_invoices_recusa_com_motivo check (
    status <> 'recusada' or (motivo_recusa is not null and btrim(motivo_recusa) <> '')
  ),
  -- Paga sem data de pagamento e um fato sem quando. A data e o que o
  -- Financeiro usa como `pagamento` do lancamento.
  constraint team_invoices_paga_com_data check (status <> 'paga' or pagamento is not null)
);

-- UMA NOTA VIVA POR MES, E AS RECUSADAS ACUMULAM. O indice e PARCIAL, e e essa
-- a diferenca: a pessoa nao manda duas notas de outubro ao mesmo tempo, mas a
-- que foi recusada FICA no banco com o motivo escrito, e uma nova e enviada ao
-- lado. Reescrever a recusada apagaria o registro do que foi pedido -- a mesma
-- razao pela qual rodada de aprovacao fechada nunca e reescrita.
create unique index if not exists team_invoices_uma_viva_por_mes
  on public.team_invoices (user_id, competencia)
  where status <> 'recusada';

create index if not exists team_invoices_competencia_idx
  on public.team_invoices (competencia desc);
create index if not exists team_invoices_a_conferir_idx
  on public.team_invoices (status)
  where status in ('enviada', 'aprovada');

comment on table public.team_invoices is
  'A nota fiscal que cada pessoa da equipe manda para a agencia pagar (0065). Nao confundir com finance_entries, que e o Financeiro da casa: aqui a linha e de uma pessoa e ela le a propria; la e da agencia e so o socio le.';
comment on column public.team_invoices.competencia is
  'O mes A QUE a nota se refere, sempre no dia 1 (trigger). Nao e a data de emissao: quem emite a nota de setembro no dia 3 de outubro continua falando de setembro.';
comment on column public.team_invoices.finance_entry_id is
  'O lancamento de despesa que esta nota gerou ao ser paga. Nulo ate o pagamento.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - A competencia no dia 1
--
-- A MESMA DECISAO DA 0013, e pelo mesmo motivo: guardar `2026-09-17` faria
-- "setembro" depender de qual dia foi digitado, e duas notas do mesmo mes com
-- dias diferentes escapariam do indice unico logo acima -- que e o que impede
-- a pessoa de mandar a nota de setembro duas vezes.
-- ---------------------------------------------------------------------------
create or replace function public.nota_competencia_no_dia_1()
returns trigger
language plpgsql
set search_path = public
as $func$
begin
  new.competencia := date_trunc('month', new.competencia)::date;
  new.updated_at := now();
  return new;
end;
$func$;

drop trigger if exists team_invoices_competencia on public.team_invoices;
create trigger team_invoices_competencia
  before insert or update on public.team_invoices
  for each row execute function public.nota_competencia_no_dia_1();


-- ---------------------------------------------------------------------------
-- PASSO 4 - As transicoes possiveis
--
-- enviada  -> aprovada | recusada
-- aprovada -> paga     | recusada   (o socio ainda pode achar um problema
--                                    depois de conferir, e antes de pagar)
-- paga     -> nada. Reescrever uma nota paga apagaria o fato de o dinheiro ter
--             saido, e o lancamento no Financeiro continuaria la.
-- recusada -> nada. A pessoa manda OUTRA; esta fica no historico com o motivo.
-- ---------------------------------------------------------------------------
create or replace function public.validar_transicao_da_nota()
returns trigger
language plpgsql
set search_path = public
as $func$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'paga' then
    raise exception 'Esta nota ja foi paga, e nota paga nao muda de estado.'
      using hint = 'O pagamento ja aconteceu e virou lancamento no Financeiro. Se houve erro, o acerto e um lancamento novo la.';
  end if;

  if old.status = 'recusada' then
    raise exception 'Esta nota foi recusada, e a recusa fica no historico.'
      using hint = 'A pessoa envia uma nota nova para o mesmo mes; esta continua aqui com o motivo escrito.';
  end if;

  if old.status = 'enviada' and new.status not in ('aprovada', 'recusada') then
    raise exception 'Uma nota enviada so pode ser aprovada ou recusada.';
  end if;

  if old.status = 'aprovada' and new.status not in ('paga', 'recusada') then
    raise exception 'Uma nota aprovada so pode ser paga ou recusada.';
  end if;

  return new;
end;
$func$;

drop trigger if exists team_invoices_transicao on public.team_invoices;
create trigger team_invoices_transicao
  before update on public.team_invoices
  for each row execute function public.validar_transicao_da_nota();


-- ---------------------------------------------------------------------------
-- PASSO 5 - O que cada lado mexe DEPOIS de entrar
--
-- POLICY NAO LIMITA COLUNA, e aqui isso decide duas coisas que nao podem
-- depender da tela: que o socio nao reescreve o valor que a pessoa declarou, e
-- que a pessoa nao carimba a propria nota como paga.
--
-- E ELE RECUSA EM VEZ DE REESCREVER, como `posts_protege_colunas` e ao
-- contrario de `comments_normaliza`: la o campo nem aparece na tela de quem
-- escreve, e devolver o valor certo em silencio e correto; aqui os campos
-- estao a vista, e quem tenta mexer precisa ouvir que nao pode -- senao salva,
-- ve o valor antigo voltar e conclui que a tela esta quebrada.
-- ---------------------------------------------------------------------------
create or replace function public.nota_protege_colunas()
returns trigger
language plpgsql
set search_path = public
as $func$
begin
  -- Sem sessao e o seed e a chave de servico, que montam estado de exemplo.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.competencia is distinct from old.competencia then
    raise exception 'De quem e a nota e a que mes ela se refere nao mudam.'
      using hint = 'Se o mes estiver errado, apague a nota enquanto ela esta enviada e mande outra.';
  end if;

  if public.is_socio() then
    -- O SOCIO DECIDE, E NAO REDIGE. Corrigir o valor por fora transformaria a
    -- conferencia em reescrita: a pessoa veria a propria nota com outro numero
    -- e nada dizendo quem trocou.
    if new.valor is distinct from old.valor
       or new.numero is distinct from old.numero
       or new.arquivo_url is distinct from old.arquivo_url then
      raise exception 'O valor, o numero e o arquivo sao de quem emitiu a nota.'
        using hint = 'Se estiverem errados, recuse com o motivo -- a pessoa manda outra.';
    end if;
    return new;
  end if;

  -- Daqui para baixo, quem escreve nao e o socio.
  if new.status is distinct from old.status
     or new.motivo_recusa is distinct from old.motivo_recusa
     or new.decidido_por is distinct from old.decidido_por
     or new.decidido_em is distinct from old.decidido_em
     or new.pagamento is distinct from old.pagamento
     or new.finance_entry_id is distinct from old.finance_entry_id then
    raise exception 'Conferir e pagar e do socio.'
      using hint = 'Voce edita a sua nota enquanto ela esta enviada; depois disso ela espera a conferencia.';
  end if;

  if old.status <> 'enviada' then
    raise exception 'Esta nota ja foi conferida e nao se edita mais.'
      using hint = 'Se ela foi recusada, mande uma nota nova para o mesmo mes.';
  end if;

  return new;
end;
$func$;

drop trigger if exists team_invoices_protege on public.team_invoices;
create trigger team_invoices_protege
  before update on public.team_invoices
  for each row execute function public.nota_protege_colunas();


-- ---------------------------------------------------------------------------
-- PASSO 6 - O carimbo da decisao
--
-- Quem decidiu e quando sai do BANCO, nunca do pedido -- policy nao limita
-- coluna, e sem isto um PATCH montado a mao assinaria a aprovacao com o nome
-- de outra pessoa. E a mesma razao de `comments_normaliza` e do autor da
-- referencia do post.
-- ---------------------------------------------------------------------------
create or replace function public.nota_carimba_decisao()
returns trigger
language plpgsql
set search_path = public
as $func$
begin
  if new.status is distinct from old.status and (select auth.uid()) is not null then
    new.decidido_por := (select auth.uid());
    new.decidido_em := now();
  end if;
  return new;
end;
$func$;

drop trigger if exists team_invoices_carimba on public.team_invoices;
create trigger team_invoices_carimba
  before update on public.team_invoices
  for each row execute function public.nota_carimba_decisao();


-- ---------------------------------------------------------------------------
-- PASSO 7 - A NOTA PAGA VIRA DESPESA NO FINANCEIRO (decisao do usuario)
--
-- Sem isto o mesmo dinheiro e lancado duas vezes a mao, e a rentabilidade por
-- cliente ignora o maior custo da casa -- o que faz o relatorio de margem
-- mentir para cima, que e a pior direcao.
--
-- E `security definer`, e a razao e mecanica: `finance_entries` fecha em
-- `is_socio()` nos quatro comandos, e o trigger precisa escrever la mesmo
-- quando o caminho passar pela chave de servico. Quem decide QUEM pode chegar
-- aqui nao e esta funcao -- e a policy de UPDATE da nota mais o
-- `nota_protege_colunas`, que ja exigem o socio para mexer em `status`.
--
-- A PONTE IMPEDE O LANCAMENTO EM DOBRO: com `finance_entry_id` preenchido, uma
-- segunda passagem por `paga` nao escreve nada. Hoje a transicao
-- `paga -> paga` nem existe, mas a guarda fica -- e o dia em que alguem criar
-- um caminho de reabertura, ela ja esta de pe.
-- ---------------------------------------------------------------------------
create or replace function public.nota_paga_vira_despesa()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_nome     text;
  v_entrada  uuid;
begin
  if new.status <> 'paga' or old.status = 'paga' then
    return new;
  end if;

  if new.finance_entry_id is not null then
    return new;
  end if;

  select nome into v_nome from public.profiles where id = new.user_id;

  insert into public.finance_entries
    (tipo, descricao, valor, competencia, vencimento, pagamento, status,
     fornecedor, observacoes, criado_por)
  values (
    'despesa',
    'Nota fiscal de ' || coalesce(v_nome, 'colaborador'),
    new.valor,
    new.competencia,
    new.pagamento,
    new.pagamento,
    'pago',
    coalesce(v_nome, 'Equipe'),
    case when new.numero is null then null else 'NF ' || new.numero end,
    -- SEM SESSAO O AUTOR E O PROPRIO DONO DA NOTA, e nao um nulo: `criado_por`
    -- e `not null` la, e derrubar o pagamento por causa do registro de autoria
    -- seria a 0062 de novo -- o aviso que leva junto a escrita que o chamou.
    coalesce((select auth.uid()), new.user_id)
  )
  returning id into v_entrada;

  new.finance_entry_id := v_entrada;
  return new;
end;
$func$;

drop trigger if exists team_invoices_vira_despesa on public.team_invoices;
create trigger team_invoices_vira_despesa
  before update on public.team_invoices
  for each row execute function public.nota_paga_vira_despesa();

comment on function public.nota_paga_vira_despesa is
  'Lanca a despesa no Financeiro quando a nota e marcada como paga (0065). `security definer` porque finance_entries fecha em is_socio(); quem decide o acesso e a policy da nota, nao esta funcao.';


-- ---------------------------------------------------------------------------
-- PASSO 8 - O sino
--
-- Os dois sentidos, porque os dois lados esperam: a pessoa nao sabe quando a
-- nota dela foi conferida, e o socio nao sabe quando chegou nota nova. Sem
-- isto o modulo vira uma tela que alguem lembra de abrir -- e o que espera do
-- outro lado e o pagamento de alguem.
--
-- `notificar()` faz as recusas que importam e elas nao se repetem aqui: quem
-- causou o aviso nao recebe, e avisar ninguem devolve null sem derrubar a
-- escrita que chamou (0062).
-- ---------------------------------------------------------------------------
create or replace function public.nota_avisa()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_socio uuid;
  v_mes   text;
begin
  v_mes := to_char(new.competencia, 'MM/YYYY');

  if tg_op = 'INSERT' then
    -- TODO SOCIO ATIVO, e nao "o socio": a agencia pode ter mais de um, e
    -- escolher um deles deixaria a nota esperando quem estiver de ferias.
    for v_socio in
      select id from public.profiles where role = 'socio' and ativo
    loop
      perform public.notificar(
        v_socio, 'sistema',
        'Nota fiscal de ' || v_mes || ' para conferir',
        'Uma nota entrou na fila de notas fiscais.',
        '/painel/notas-fiscais?aba=conferir'
      );
    end loop;
    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.notificar(
      new.user_id, 'sistema',
      case new.status
        when 'aprovada' then 'Sua nota de ' || v_mes || ' foi aprovada'
        when 'paga'     then 'Sua nota de ' || v_mes || ' foi paga'
        when 'recusada' then 'Sua nota de ' || v_mes || ' precisa ser reenviada'
        else 'Sua nota de ' || v_mes || ' mudou de situacao'
      end,
      new.motivo_recusa,
      '/painel/notas-fiscais'
    );
  end if;

  return new;
end;
$func$;

drop trigger if exists team_invoices_avisa on public.team_invoices;
create trigger team_invoices_avisa
  after insert or update on public.team_invoices
  for each row execute function public.nota_avisa();


-- ---------------------------------------------------------------------------
-- PASSO 9 - RLS
--
-- A PROPRIA PESSOA E O SOCIO, e mais ninguem. Um colaborador nao ve a nota do
-- colega, e o desenvolvedor tambem nao -- ver esta tabela e ver quanto cada
-- pessoa da agencia ganha.
-- ---------------------------------------------------------------------------
alter table public.team_invoices enable row level security;

drop policy if exists team_invoices_select on public.team_invoices;
create policy team_invoices_select on public.team_invoices
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_socio());

-- INSERT SO ACEITA `enviada`, e isto e trava e nao formalidade: sem ela alguem
-- montaria a requisicao a mao com `status = 'paga'` e a nota nasceria paga,
-- pulando a conferencia inteira. Com ela, todo caminho ate o pagamento passa
-- pelo UPDATE, que so o socio faz.
--
-- E `is_staff()` junto com o dono: cliente nao emite nota para a agencia.
drop policy if exists team_invoices_insert on public.team_invoices;
create policy team_invoices_insert on public.team_invoices
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_staff()
    and status = 'enviada'
  );

-- A MESMA POLICY PARA OS DOIS LADOS, e quem separa e o trigger: policy nao
-- limita coluna, entao "a pessoa edita a nota dela, o socio decide" nao cabe
-- aqui -- cabe em `nota_protege_colunas`.
drop policy if exists team_invoices_update on public.team_invoices;
create policy team_invoices_update on public.team_invoices
  for update to authenticated
  using ((select auth.uid()) = user_id or public.is_socio())
  with check ((select auth.uid()) = user_id or public.is_socio());

-- APAGAR E SO ENQUANTO NINGUEM OLHOU. Mandou a nota errada, apaga e manda
-- outra; depois de conferida ela e registro de uma decisao, e registro de
-- decisao nao se apaga -- nem pelo socio. A recusada tambem fica: ela e o
-- historico que o indice parcial existe para preservar.
drop policy if exists team_invoices_delete on public.team_invoices;
create policy team_invoices_delete on public.team_invoices
  for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'enviada');


-- ---------------------------------------------------------------------------
-- PASSO 10 - O bucket
--
-- PRIVADO, e com a pasta da PESSOA na frente do caminho -- a policy compara
-- `(storage.foldername(name))[1]` com quem esta pedindo. E a mesma forma do
-- bucket de campanhas, com um recorte mais estreito: la a pasta e do cliente e
-- quem le e a equipe; aqui a pasta e da pessoa e quem le e ela e o socio.
--
-- Uma nota fiscal traz CNPJ, endereco e valor. Bucket publico aqui seria o
-- documento fiscal de cada pessoa da agencia num endereco que basta adivinhar.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('notas-fiscais', 'notas-fiscais', false)
  on conflict (id) do nothing;

  drop policy if exists "notas: a pessoa le a dela" on storage.objects;
  drop policy if exists "notas: a pessoa escreve na pasta dela" on storage.objects;
  drop policy if exists "notas: a pessoa apaga a dela" on storage.objects;

  execute $politica$
    create policy "notas: a pessoa le a dela" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'notas-fiscais'
        and (
          (storage.foldername(name))[1] = (select auth.uid())::text
          or public.is_socio()
        )
      )
  $politica$;

  execute $politica$
    create policy "notas: a pessoa escreve na pasta dela" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'notas-fiscais'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and public.is_staff()
      )
  $politica$;

  execute $politica$
    create policy "notas: a pessoa apaga a dela" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'notas-fiscais'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
  $politica$;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 11 - A trilha de auditoria (0058)
--
-- Dinheiro, e a trilha guarda "acesso, gente, dinheiro e decisao". Aprovar e
-- pagar a nota de alguem e as duas ultimas ao mesmo tempo.
--
-- E SO O SOCIO LE A TRILHA, o que aqui nao e detalhe: `audit_log` copia o
-- trecho que mudou, entao a linha de uma nota carrega o VALOR. Um log legivel
-- pela gestao seria a porta dos fundos da regra que esta migration acabou de
-- escrever -- o desenvolvedor nao le a tabela e leria o valor no `depois`.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if exists (
    select 1 from pg_proc p
     where p.proname = 'registrar_auditoria'
       and p.pronamespace = 'public'::regnamespace
  ) then
    drop trigger if exists auditoria_team_invoices on public.team_invoices;
    create trigger auditoria_team_invoices
      after insert or update or delete on public.team_invoices
      for each row execute function public.registrar_auditoria();
  end if;
end;
$bloco$;

notify pgrst, 'reload schema';
