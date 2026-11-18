-- =============================================================================
-- 0142 - O ACESSO RAPIDO APRENDE O QUE CADA PESSOA USA
-- =============================================================================
--
-- Decisao do usuario: *"registrar o uso numa tabela nova, por pessoa e por
-- rota, com RLS fechada no dono da linha. O Acesso Rapido ordena por
-- frequencia e so oferece o que o perfil alcanca."*
--
-- O bloco tinha TRES atalhos escritos a mao -- Minhas Tasks, Notas Fiscais e
-- Meu Perfil -- e eles descrevem o dia de quem os escreveu, nao o de quem os
-- le. Quem vive no Social Media abre o Social Media todo dia e tem, no cartao
-- chamado "Acesso rapido", tres caminhos que nao sao os dele.
--
-- -----------------------------------------------------------------------------
-- E UMA LINHA POR ROTA, NUNCA UMA LINHA POR VISITA
--
-- Um log de cada abertura de pagina cresce em milhares de linhas por semana
-- para responder uma pergunta que e uma CONTA. A linha aqui e o agregado: a
-- pessoa, a rota, o peso e quando ele foi mexido pela ultima vez.
--
-- -----------------------------------------------------------------------------
-- E O NUMERO E UM PESO E NAO UMA CONTAGEM, que e a diferenca entre as duas
-- leituras do pedido
--
-- Uma contagem de vida inteira responde *quanto eu ja usei*, e nunca esquece:
-- quem passou um ano na Gestao de Tasks e trocou de funcao continua com ela em
-- primeiro para sempre. O pedido diz FREQUENCIA, que e *com que frequencia eu
-- uso HOJE*.
--
-- Entao o peso decai no proprio `update`, com meia-vida de 30 dias:
--
--     peso = peso * 0.5 ^ (dias desde a ultima / 30) + 1
--
-- MEDIDO contra o Postgres, em transacao revertida, com 60 visitas de cada
-- padrao: quem abre todo dia chega a **32,84** (e sobe para perto de 44 no
-- limite); quem abre uma vez por semana estaciona em **6,70**. E o terceiro
-- caso e o que a decisao existe para resolver: a rota aberta todo dia por dois
-- meses e largada ha 120 dias cai de 32,84 para **3,05** -- abaixo da semanal.
-- Uma contagem de vida inteira a deixaria em primeiro para sempre.
--
-- **E ele esquece sem degrau**, que e a razao de nao ser uma
-- janela que zera: uma janela faria o bloco inteiro se reembaralhar no dia da
-- virada, e um "acesso rapido" que troca de ordem debaixo de quem o usa e pior
-- que uma lista fixa -- o cartao existe justamente para o caminho estar sempre
-- no mesmo lugar.
--
-- A coluna se chama `peso` e nao `visitas` de proposito: ninguem le 43,8 como
-- "quarenta e tres aberturas" e vai procurar o numero que falta.
--
-- -----------------------------------------------------------------------------
-- E O F5 NAO CONTA
--
-- Recarregar a mesma tela cinco vezes em um minuto e uma visita, nao cinco.
-- Dentro de 10 minutos a funcao nao faz NADA -- nem reancora `visto_em`:
-- reancorar sem contar apagaria o decaimento acumulado desde a ultima visita
-- de verdade, e o proximo acesso decairia de menos. A ancora e sempre a ultima
-- visita CONTADA.
--
-- -----------------------------------------------------------------------------
-- NEM O SOCIO LE, e isto e a regua de `client_notification_prefs` e de
-- `academy_anotacoes`
--
-- As TRES policies fecham em `auth.uid()`. Saber quais rotas um colega abre
-- mais e vigilancia, nao gestao -- e o que esta tabela guarda nao decide nada
-- sobre o trabalho de ninguem: ela decide tres atalhos num cartao.
--
-- **E nao ha policy de DELETE**, pela razao de sempre: nao ha o que apagar. A
-- lista e derivada, e a rota que a pessoa deixa de abrir cai sozinha conforme
-- as outras crescem -- que e exatamente o que o decaimento faz.
--
-- -----------------------------------------------------------------------------
-- E A FUNCAO NAO E `security definer`
--
-- Ela escreve a PROPRIA linha de quem chama, entao a RLS vale dentro dela --
-- e a forma de `busca_global()` (0073). Ela existe por uma razao de
-- mecanica e nao de permissao: o `upsert` do PostgREST nao sabe escrever
-- `peso = peso * ... + 1`, e um `select` seguido de `update` e a corrida que a
-- 0040 descreve -- duas abas passam pelas duas consultas antes de qualquer uma
-- gravar. `insert ... on conflict do update` e UMA instrucao.
--
-- -----------------------------------------------------------------------------
-- O QUE A TRAVA DE VERDADE E A NORMALIZACAO, e ela mora na ACTION
--
-- Quem decide o que pode ser gravado e `findMenuItem()`: a action so manda o
-- `href` de um item do `MENU`, entao `/painel/gestao-tasks/<uuid>` vira
-- `/painel/gestao-tasks` e o que nao casa com rota nenhuma nao e gravado. Sem
-- isso a tabela viraria um deposito de endereco digitado.
--
-- **E nao ha uma segunda pergunta de perfil na escrita**, que e a 0060: quem
-- nao alcanca a rota leva 403 ao abri-la e nunca chega a registrar nada, e o
-- bloco filtra por `canAccess()` na LEITURA de qualquer forma -- entao uma
-- checagem aqui so recusaria quem o produto ja recusa.
--
-- -----------------------------------------------------------------------------
-- MEDIDO COM CINCO MUTACOES, sobre 2410 cenarios
--
--   sem decaimento (contagem de vida inteira) ... derruba 3
--   sem respiro (o F5 conta) ................... derruba 3
--   o respiro reancora `visto_em` .............. derruba 1
--   a RLS do SELECT aberta para `is_staff()` ... derruba 2
--   o `execute` de volta para `anon` ........... a migration RECUSA aplicar
--
-- **A quinta nao derruba cenario nenhum, e isso e o resultado certo:** o
-- PASSO 3 estoura com *"anon ainda executa registrar_visita"* antes de a
-- bateria chegar a rodar. Uma trava de privilegio que so aparecesse num
-- cenario seria uma trava que depende de alguem ter escrito o cenario; aqui
-- quem a confere e o proprio arquivo, em toda colagem.
--
-- **E a terceira derruba UM, que e o que separa as duas metades do respiro.**
-- O cenario que a pega e o unico que le a ANCORA e nao so o peso: com o
-- `visto_em` andando a cada F5, o peso fica parado e o decaimento passa a ser
-- contado do ultimo F5 em vez da ultima visita CONTADA -- quem recarrega a
-- tela a tarde inteira zera o esquecimento daquele dia sem somar nada.
--
-- Marcador para o `onde-esta-o-banco.sql`: a funcao `registrar_visita`, que e
-- a ultima coisa que este arquivo cria.
-- =============================================================================

-- PASSO 1 -- a tabela -------------------------------------------------------

create table if not exists public.route_visits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  href text not null,
  -- O PESO, com meia-vida de 30 dias. Nao e uma contagem; ver o cabecalho.
  peso numeric not null default 0,
  -- A ANCORA DO DECAIMENTO, e nao um enfeite: e dela que sai o expoente.
  visto_em timestamptz not null default now(),
  primary key (user_id, href)
);

comment on table public.route_visits is
  '0142 - uma linha por pessoa e por rota do MENU, com o peso de uso decaindo '
  'com meia-vida de 30 dias. Le e escreve so o dono da linha; nem o socio '
  'alcanca. Quem a escreve e registrar_visita().';

comment on column public.route_visits.peso is
  'Peso com meia-vida de 30 dias, NAO uma contagem de visitas: '
  'peso = peso * 0.5 ^ (dias desde visto_em / 30) + 1.';

-- O `on delete cascade` e a declaracao de que esta linha nao sobrevive a
-- pessoa: ela diz o que ELA usa, e nao e registro de nada que aconteceu. Na
-- pratica nunca dispara -- ninguem com historico e apagado neste produto.

alter table public.route_visits enable row level security;

drop policy if exists route_visits_select on public.route_visits;
create policy route_visits_select on public.route_visits
  for select using (user_id = (select auth.uid()));

drop policy if exists route_visits_insert on public.route_visits;
create policy route_visits_insert on public.route_visits
  for insert with check (user_id = (select auth.uid()));

drop policy if exists route_visits_update on public.route_visits;
create policy route_visits_update on public.route_visits
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- SEM POLICY DE DELETE, de proposito. Ver o cabecalho.

-- O INDICE E A PROPRIA ORDEM DA LEITURA: a consulta do bloco e
-- `where user_id = eu order by peso desc`, e a chave primaria sozinha nao
-- ordena por peso.
create index if not exists route_visits_por_peso
  on public.route_visits (user_id, peso desc);

-- PASSO 2 -- quem escreve ---------------------------------------------------

create or replace function public.registrar_visita(p_href text)
returns void
language plpgsql
set search_path = public
as $$
declare
  eu uuid := (select auth.uid());
  -- A MEIA-VIDA, em dias. Um numero so, e e dele que saem os numeros do
  -- cabecalho: quem abre todo dia chega a 32,84 em dois meses, e o limite
  -- da serie e 43,8 -- `1 / (1 - 0.5 ^ (1/30))`.
  meia_vida constant numeric := 30;
  -- O INTERVALO EM QUE O F5 NAO CONTA.
  respiro constant interval := interval '10 minutes';
begin
  if eu is null or p_href is null or btrim(p_href) = '' then
    return;
  end if;

  -- UMA INSTRUCAO SO, pela razao escrita no cabecalho: `select` seguido de
  -- `update` e a corrida da 0040.
  insert into public.route_visits as rv (user_id, href, peso, visto_em)
  values (eu, p_href, 1, now())
  on conflict (user_id, href) do update
     set peso = case
           -- Dentro do respiro NADA muda -- nem o peso, nem a ancora.
           when now() - rv.visto_em < respiro then rv.peso
           else rv.peso
                * power(
                    0.5,
                    extract(epoch from (now() - rv.visto_em)) / (meia_vida * 86400)
                  )
                + 1
         end,
         visto_em = case
           when now() - rv.visto_em < respiro then rv.visto_em
           else now()
         end;
end;
$$;

comment on function public.registrar_visita(text) is
  '0142 - soma uma visita a rota de quem chama, com decaimento de meia-vida '
  'de 30 dias e um respiro de 10 minutos. NAO e security definer: escreve a '
  'propria linha, e a RLS vale dentro dela.';

-- A ACL: ela e chamada por quem esta logado, e por mais ninguem.
--
-- **O `revoke from anon` NAO e redundante com o de `public`**, e isto foi
-- MEDIDO: com os dois primeiros sozinhos, `anon` continuava executando a
-- funcao. E a licao da 0071 -- o Supabase deixa um `alter default privileges`
-- ligado no schema `public`, e `revoke all from public` nao alcanca um grant
-- que veio por ele.
--
-- Na pratica a chave anon nao tem `sub`, entao `auth.uid()` volta nulo e a
-- funcao devolve na primeira linha; e mesmo que tivesse, a RLS recusaria a
-- escrita. Sao tres travas, e esta e a de fora.
revoke all on function public.registrar_visita(text) from public;
revoke all on function public.registrar_visita(text) from anon;
grant execute on function public.registrar_visita(text) to authenticated;

-- PASSO 3 -- conferencia ----------------------------------------------------

do $$
declare
  n_policies integer;
begin
  select count(*) into n_policies
    from pg_policies
   where schemaname = 'public' and tablename = 'route_visits';

  raise notice '0142: route_visits com % policies (esperado 3, sem DELETE).', n_policies;

  if n_policies <> 3 then
    raise exception '0142: esperava 3 policies em route_visits, achei %.', n_policies;
  end if;

  if to_regprocedure('public.registrar_visita(text)') is null then
    raise exception '0142: registrar_visita(text) nao foi criada.';
  end if;

  if has_function_privilege('anon', 'public.registrar_visita(text)', 'execute') then
    raise exception '0142: anon ainda executa registrar_visita.';
  end if;

  raise notice '0142: ok.';
end;
$$;
