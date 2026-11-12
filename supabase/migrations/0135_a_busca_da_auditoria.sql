-- ---------------------------------------------------------------------------
-- 0135 - A BUSCA DA AUDITORIA, e o diff que sai da tabela
--
-- Decisao do usuario, em duas frases: *"adicionar aba de pesquisa na
-- auditoria"* e *"pode tirar da auditoria a parte de o que mudou"*.
--
-- AS DUAS SAO A MESMA MUDANCA, e e por isso que elas saem juntas. A coluna "O
-- que mudou" era a unica coisa da linha com conteudo -- "Mudou . Cliente" nao
-- diz qual cliente --, e ela dizia isso do jeito mais caro possivel: cinco
-- linhas de `campo: a -> b` mais "e mais 12 campos", numa celula de tabela, em
-- oitenta linhas. Tirando so a coluna, a trilha pararia de responder a
-- pergunta que ela existe para responder.
--
-- ENTAO O QUE ENTRA NO LUGAR E A BUSCA, e ela procura DENTRO do que mudou: o
-- nome de quem mexeu e o conteudo de `antes`/`depois`. A linha encontrada
-- mostra o CAMPO QUE CASOU, uma linha so -- e so quando ha termo. **O diff sai
-- da tabela em todo estado**; o que aparece na busca nao e a coluna de volta,
-- e a razao de aquela linha estar no resultado.
--
-- *A BUSCA PRECISA SER DO BANCO, e e isso que obriga esta migration.* A tela
-- traz as 80 mais recentes do recorte (0058); filtrar aquelas 80 no navegador
-- seria uma busca que responde "nao achei" sobre uma trilha onde a linha
-- existe -- plausivel e errado, que e o modo de falha que esta casa recusa em
-- toda parte. E o predicado nao cabe no PostgREST: nao ha como escrever
-- `antes::text ilike ...` num filtro, e o nome de quem mexeu mora em
-- `profiles`.
--
-- ELA NAO E `security definer`, E ISSO E A LINHA MAIS IMPORTANTE DO ARQUIVO.
-- `audit_log_select` fecha em `is_socio()` desde a 0058, e **um log e tao
-- sensivel quanto a coisa mais sensivel que tem dentro dele** -- ele copia o
-- trecho que mudou de `finance_entries` e de `team_invoices`. Uma funcao
-- `invoker` roda com o `current_user` de quem chamou, entao a policy vale
-- DENTRO dela: e a forma de `busca_global()` (0073), e e por ela que esta
-- funcao nao vira a porta dos fundos da trilha do socio. O `left join
-- profiles` tambem passa pela policy daquela tabela (0132).
--
-- ***O QUE ELA NAO ACHA, e e dito em vez de escondido:*** `registrar_auditoria()`
-- grava SO AS COLUNAS QUE MUDARAM (0058), entao num UPDATE o nome da empresa
-- so esta na linha se foi ELE que mudou -- buscar "Mundo Verde" nao acha a
-- mudanca de telefone dela. No INSERT e no DELETE o jsonb e a linha inteira, e
-- aqueles dois sao justamente os que a tela existe para responder: *"quem
-- apagou"* esta no subtitulo dela. Resolver o UPDATE exigiria ler a tabela de
-- origem por linha -- um `case` por tabela com SQL dinamico, que seria uma
-- segunda lista das tabelas auditadas ao lado da da 0058, e a que divergiria
-- seria esta.
--
-- ---------------------------------------------------------------------------
-- PASSO UNICO - A leitura da trilha, com o recorte e a busca
--
-- UMA FUNCAO PARA OS DOIS CAMINHOS, e nao uma consulta para quando nao ha
-- termo: o recorte (tabela, quem, de, ate) estaria escrito duas vezes, e a que
-- divergiria e a que roda menos.
--
-- `p_limite + 1` CONTINUA DO LADO DE FORA, na tela, como ja estava: e como se
-- sabe que ha proxima pagina sem pedir um `count` exato -- numa tabela que so
-- cresce, um total e uma varredura inteira para escrever um numero que ninguem
-- le.
--
-- O `left join lateral` FAZ AS DUAS COISAS DE UMA VEZ: ele decide se a linha
-- casou e devolve o campo que casou, para a tela desenhar. Duas passadas pelo
-- mesmo jsonb -- uma para filtrar e outra para mostrar -- seriam duas verdades
-- sobre qual campo foi, e a que divergiria e a que aparece.
--
-- A UNIAO DE `depois` E `antes` E ORDENADA, e nao um `||`: o operador de jsonb
-- deixa o lado direito ganhar, entao um merge perderia o valor ANTIGO de um
-- campo que mudou -- quem busca o nome que a empresa tinha nao acharia a linha
-- que o trocou. Na uniao os dois valores sao procurados, e o `order by` faz o
-- de DEPOIS ser o que aparece.
--
-- `sem_acento()` DOS DOIS LADOS (0073), pela razao escrita la: `lower()` nao
-- dobra acento em locale C, e uma busca que acha "Optica" numa maquina e nao
-- noutra depende de variavel de ambiente para saber ler.
--
-- `strpos` E NAO `like '%x%'`, tambem como na busca global: quem digita "100%"
-- buscaria qualquer coisa, porque o `%` do termo viraria curinga.
-- ---------------------------------------------------------------------------
create or replace function public.trilha_de_auditoria(
  p_tabela text default null,
  p_quem uuid default null,
  p_de timestamptz default null,
  p_ate timestamptz default null,
  p_busca text default null,
  p_limite integer default 80
)
returns table (
  id uuid,
  tabela text,
  registro_id uuid,
  operacao text,
  quando timestamptz,
  quem uuid,
  quem_nome text,
  campo_encontrado text,
  valor_encontrado text
)
language plpgsql
stable
as $func$
declare
  termo text := nullif(btrim(coalesce(p_busca, '')), '');
begin
  return query
  select
    a.id,
    a.tabela,
    a.registro_id,
    a.operacao,
    a.quando,
    a.quem,
    p.nome,
    m.campo,
    m.valor
  from public.audit_log a
  left join public.profiles p on p.id = a.quem
  left join lateral (
    select e.key as campo, e.value as valor
    from (
      select 1 as ord, k.key, k.value
        from jsonb_each_text(coalesce(a.depois, '{}'::jsonb)) k
      union all
      select 2 as ord, k.key, k.value
        from jsonb_each_text(coalesce(a.antes, '{}'::jsonb)) k
    ) e
    where termo is not null
      and strpos(public.sem_acento(e.value), public.sem_acento(termo)) > 0
    order by e.ord
    limit 1
  ) m on true
  where (p_tabela is null or a.tabela = p_tabela)
    and (p_quem is null or a.quem = p_quem)
    and (p_de is null or a.quando >= p_de)
    and (p_ate is null or a.quando < p_ate)
    and (
      termo is null
      or m.campo is not null
      or strpos(public.sem_acento(coalesce(p.nome, '')), public.sem_acento(termo)) > 0
    )
  order by a.quando desc
  limit greatest(coalesce(p_limite, 80), 1);
end;
$func$;

comment on function public.trilha_de_auditoria(text, uuid, timestamptz, timestamptz, text, integer) is
  'A trilha de auditoria com recorte e busca (0135). NAO e security definer: '
  'audit_log_select fecha em is_socio() e a policy vale dentro dela, que e a '
  'forma de busca_global(). A busca procura o nome de quem mexeu e o conteudo '
  'de antes/depois, e devolve o campo que casou -- a tela deixou de desenhar o '
  'diff, e o campo encontrado e a razao de a linha estar no resultado.';

-- A PORTA E `authenticated`, e quem recusa continua sendo a policy. O Postgres
-- concede `execute` a `public` em toda funcao nova, e `public` inclui `anon` --
-- a chave que vai no bundle que o navegador baixa. Sem o `revoke` a funcao
-- seria chamavel sem sessao; com ele e com a policy, uma chamada de quem nao e
-- socio volta vazia.
revoke all on function
  public.trilha_de_auditoria(text, uuid, timestamptz, timestamptz, text, integer)
  from public;
grant execute on function
  public.trilha_de_auditoria(text, uuid, timestamptz, timestamptz, text, integer)
  to authenticated;


-- ---------------------------------------------------------------------------
-- Confira
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_proc
    where proname = 'trilha_de_auditoria'
      and pronamespace = 'public'::regnamespace) as tem_a_leitura,
  (select prosecdef from pg_proc
    where proname = 'trilha_de_auditoria'
      and pronamespace = 'public'::regnamespace) as eh_definer_tem_de_ser_false,
  (select count(*) from public.trilha_de_auditoria(null, null, null, null, null, 10))
    as sem_termo_traz_as_recentes,
  (select count(*) from public.trilha_de_auditoria(
     null, null, null, null, 'zzz_nao_existe_zzz', 10))
    as termo_que_nao_casa_traz_zero;
