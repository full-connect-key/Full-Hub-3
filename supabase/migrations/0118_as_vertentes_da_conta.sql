-- ===========================================================================
-- 0118 - AS VERTENTES DA CONTA
--
-- Decisao do usuario: *"permitir o cadastro de diferentes vertentes, areas ou
-- unidades de negocio dentro de uma mesma conta (…) todas as vertentes devem
-- permanecer vinculadas a conta principal, sem a necessidade de criar clientes
-- separados"*. E a orientacao geral: *"as vertentes devem se tornar parte da
-- estrutura permanente dos clientes no banco de dados, e nao apenas um filtro
-- visual"*.
--
-- O exemplo dele e a Mundo Verde com Institucional, Lojas Proprias, Marca
-- Propria, Nutricionistas e Franqueados, e E-commerce.
--
-- ---------------------------------------------------------------------------
-- E UMA TABELA, E NAO UM `text[]` EM `clients`.
--
-- O criterio e o que este produto ja escreveu duas vezes: jsonb e array sao
-- para o que se escreve de uma vez e se le inteiro, nunca consultado item a
-- item (`post_versions.arquivos`, 0042). Uma vertente e consultada item a
-- item -- a task aponta para UMA, o filtro do board escolhe UMA, o relatorio
-- agrupa por UMA --, e um array obrigaria a guardar o NOME dentro da task.
--
-- E guardar o nome e o que quebra o proprio pedido: *"qualquer alteracao de
-- nome da vertente devera ser refletida em todas as areas relacionadas, sem
-- perder o historico"*. Com uma linha e uma chave estrangeira isso acontece
-- SOZINHO, porque o nome mora num lugar so. Com o nome copiado em cada task,
-- renomear seria um `update` em toda task da conta -- e a que ficasse para
-- tras viraria uma sexta vertente que ninguem cadastrou.
--
-- ---------------------------------------------------------------------------
-- A SUBTAREFA NAO GANHA COLUNA, e isso e o pedido lido ao pe da letra:
-- *"fazer com que todas as subtarefas herdem a vertente da task principal"*.
--
-- HERDAR E LER, nao copiar. Uma coluna em `subtasks` seria uma segunda
-- verdade sobre o mesmo fato, e ela divergiria no instante em que alguem
-- trocasse a vertente da demanda: as etapas ficariam na antiga, sem erro em
-- lugar nenhum. E a regra de "atraso nao e coluna" e de "bloqueio nao e
-- status" pela enesima vez -- o que da para calcular nao se guarda.
--
-- ---------------------------------------------------------------------------
-- NAO EXISTE APAGAR VERTENTE, e a ausencia e a regra.
--
-- O pedido lista *"adicionar, editar, reorganizar e desativar"* -- quatro
-- verbos, e apagar nao esta entre eles. E a forma da etiqueta do Acervo
-- (`skills.ativa`) e do fluxo de social desativado: o que nao serve mais sai
-- do seletor e continua existindo para as linhas que apontam para ele.
--
-- Aqui ela e mais que convencao: uma vertente apagada deixaria as tasks dela
-- apontando para nada, e o relatorio por vertente -- que e o item 32 deste
-- mesmo pedido -- perderia o recorte do que ja foi entregue. Por isso a
-- tabela nasce SEM policy de DELETE, e nem o socio apaga.
--
-- ---------------------------------------------------------------------------
-- A TRAVA QUE IMPORTA E A DA CONTA.
--
-- `tasks.vertente_id` tem chave estrangeira para `client_vertentes`, e uma
-- chave estrangeira nao sabe dizer que a vertente tem de ser DAQUELE cliente.
-- Sem o gatilho, uma demanda da Optica Visao aceita a vertente "Lojas
-- Proprias" da Mundo Verde -- e o estrago nao aparece como erro: aparece como
-- o relatorio de uma conta contando a entrega de outra, e como o nome de uma
-- vertente alheia no filtro do board.
--
-- O gatilho olha os DOIS lados, e a segunda metade e a que quase ficou de
-- fora: trocar o CLIENTE de uma demanda que ja tem vertente deixaria a
-- vertente antiga de pe, apontando para a conta errada, sem ninguem ter
-- tocado na coluna dela.
--
-- ---------------------------------------------------------------------------
-- O QUE ESTA MIGRATION NAO FAZ, E A RAZAO E MECANICA.
--
-- O pedido diz: *"quando o cliente possuir vertentes cadastradas, exigir a
-- selecao de uma delas antes de salvar a task"*. A trava natural seria
-- `tasks_publicar_exige_minimo` (0028), ao lado do titulo, do cliente e da
-- pasta -- e ela NAO entra aqui, de proposito.
--
-- Tres caminhos deste produto inserem task JA PUBLICADA sem passar por tela
-- nenhuma: `abrir_campanha()` (0051), `abrir_mes_de_social()` (0061) e
-- `gerar_ocorrencia()` (0040), que e a rotina das tres da manha. Com a
-- exigencia ligada e nenhum dos tres sabendo passar a vertente, toda conta com
-- vertente cadastrada pararia de gerar -- *em silencio, num historico que
-- ninguem abre*, que e a frase que o cabecalho da 0113 ja escreveu sobre
-- exatamente este modo de falha.
--
-- Entao a exigencia vem na migration seguinte, JUNTO com o parametro nos tres
-- caminhos. As duas pontas no mesmo commit e a regra desta casa, e aqui ela
-- custa uma migration a mais em vez de uma rotina quebrada.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A tabela
--
-- `ordem` E INTEIRA E COM FOLGA DE DEZ, como a corrente do social (0045):
-- inserir uma vertente ENTRE duas sem renumerar as outras e o caso comum de
-- "reorganizar", e com passo 1 cada arrastada reescreveria a lista inteira.
--
-- `unique (client_id, nome)` porque duas vertentes com o mesmo nome na mesma
-- conta sao duas linhas que o seletor da task desenha identicas: quem escolhe
-- nao tem como saber qual pegou, e o relatorio sai partido em duas.
-- ---------------------------------------------------------------------------
create table if not exists public.client_vertentes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  nome       text not null,
  ordem      integer not null default 0,
  ativa      boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists client_vertentes_nome_unico
  on public.client_vertentes (client_id, nome);

create index if not exists client_vertentes_por_conta
  on public.client_vertentes (client_id, ordem);

comment on table public.client_vertentes is
  'As vertentes, areas ou unidades de negocio de uma conta (0118). Nao se apagam: desativam-se.';
comment on column public.client_vertentes.ordem is
  'Passo de dez, para inserir no meio sem renumerar o resto.';
comment on column public.client_vertentes.ativa is
  'Falsa sai do seletor e CONTINUA valendo para as tasks que ja apontam para ela.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - Quem le e quem escreve
--
-- LER E DE `is_staff()` MAIS A PROPRIA EMPRESA. O cliente precisa delas para
-- a Biblioteca por vertente, que e o item 29 do mesmo pedido -- e ele le so
-- as da conta dele, pelo `my_client_ids()` de sempre.
--
-- ESCREVER E DE `is_gestor()`, que e a frase do usuario palavra por palavra:
-- *"somente Socios e Desenvolvedores poderao gerenciar o cadastro das
-- vertentes"*. A ficha do cliente ja e `GESTAO` na rota desde o Sprint 3C,
-- entao quem chega la ja passou -- mas rota nao e trava, e quem montar o
-- `insert` a mao bate aqui.
--
-- E NAO HA POLICY DE DELETE. A razao esta no cabecalho.
-- ---------------------------------------------------------------------------
alter table public.client_vertentes enable row level security;

drop policy if exists client_vertentes_select on public.client_vertentes;
create policy client_vertentes_select on public.client_vertentes
  for select to authenticated
  using (public.is_staff() or client_id in (select public.my_client_ids()));

drop policy if exists client_vertentes_insert on public.client_vertentes;
create policy client_vertentes_insert on public.client_vertentes
  for insert to authenticated
  with check (public.is_gestor());

drop policy if exists client_vertentes_update on public.client_vertentes;
create policy client_vertentes_update on public.client_vertentes
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 3 - A coluna da task
--
-- `on delete set null` e rede de seguranca e nao caminho: nao ha DELETE nesta
-- tabela. Ele existe para o dia em que alguem apagar uma linha pelo painel do
-- Supabase -- aí a demanda fica sem vertente, que e um estado que a tela
-- desenha, em vez de a transacao inteira ser recusada.
--
-- NULA E PERMITIDA, e e o pedido: *"nao modificar automaticamente as tasks
-- antigas; permitir sua classificacao posterior"*. Nenhum `update` de
-- conversao roda aqui -- toda demanda que ja existe continua sem vertente ate
-- alguem escolher uma.
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists vertente_id uuid
    references public.client_vertentes(id) on delete set null;

create index if not exists tasks_por_vertente
  on public.tasks (vertente_id) where vertente_id is not null;

comment on column public.tasks.vertente_id is
  'A vertente da conta (0118). Nula na demanda antiga e na conta que nao tem vertente. A subtarefa HERDA lendo esta coluna -- ela nao tem a dela.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - A vertente e da conta da demanda, e dos dois lados
-- ---------------------------------------------------------------------------
create or replace function public.tasks_vertente_da_conta()
returns trigger language plpgsql security definer set search_path = public
as $fn$
declare
  v_dona uuid;
  v_nome text;
begin
  if new.vertente_id is null then
    return new;
  end if;

  select v.client_id, v.nome into v_dona, v_nome
    from public.client_vertentes v
   where v.id = new.vertente_id;

  if v_dona is null then
    raise exception using
      errcode = 'foreign_key_violation',
      message = 'Esta vertente não existe.',
      hint    = 'Escolha uma da lista da conta, ou deixe em branco.';
  end if;

  if new.client_id is null or new.client_id <> v_dona then
    raise exception using
      errcode = 'check_violation',
      message = format('A vertente "%s" é de outra conta.', v_nome),
      hint    = 'Trocar o cliente da demanda limpa a vertente: escolha a da conta nova.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists tasks_vertente_da_conta on public.tasks;
create trigger tasks_vertente_da_conta
  before insert or update of client_id, vertente_id on public.tasks
  for each row execute function public.tasks_vertente_da_conta();

comment on function public.tasks_vertente_da_conta() is
  'A vertente da demanda tem de ser da conta dela (0118). Olha os dois lados: trocar o CLIENTE de uma demanda que ja tem vertente tambem e recusado.';


-- ---------------------------------------------------------------------------
-- CONFERENCIA - cole junto e leia a resposta.
--
-- Espera-se UMA linha com os quatro `true`.
-- ---------------------------------------------------------------------------
select
  to_regclass('public.client_vertentes') is not null                as tabela,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'tasks'
             and column_name = 'vertente_id')                       as coluna,
  exists (select 1 from pg_proc p
           where p.proname = 'tasks_vertente_da_conta'
             and p.pronamespace = 'public'::regnamespace)           as gatilho,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'client_vertentes') = 3
                                                                    as tres_policies;

notify pgrst, 'reload schema';
