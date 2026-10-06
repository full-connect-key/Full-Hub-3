-- ---------------------------------------------------------------------------
-- EM QUE MIGRATION ESTE BANCO ESTA
--
-- Cole no SQL Editor do Supabase e rode. Nao muda nada -- so olha.
--
-- Uma linha por migration, com a coisa que ela cria. A primeira que disser
-- FALTA e por onde continuar.
--
-- ESTE E O CURTO, DE PROPOSITO. O `conferir-migrations.sql` confere item por
-- item (54 linhas de resultado) e serve para quando alguma coisa parece
-- errada; este responde a pergunta que se faz antes de aplicar, e cabe numa
-- colagem sem risco de vir cortado pela metade -- que foi o que aconteceu com
-- o outro.
--
-- ANTES DE APLICAR A 0034: ela apaga o Resumo Semanal e o Financeiro Pessoal,
-- que eram privados de cada pessoa. Rode `scripts/exportar-antes-da-0034.sql`
-- primeiro e entregue o conteudo a quem escreveu. Nao tem volta.
--
-- ANTES DA 0043: ela apaga a autoavaliacao e as observacoes de skill.
-- `scripts/exportar-antes-da-0043.sql` e CONVENIENCIA e nao condicao -- ao
-- contrario do da 0034, estas tabelas a gestao ja lia.
-- ---------------------------------------------------------------------------
select
  migration,
  case when ok then 'ok' else 'FALTA' end as situacao,
  item
from (
  select v.migration, v.item,
    case v.tipo
      when 'tabela' then exists (
        select 1 from information_schema.tables t
         where t.table_schema = 'public' and t.table_name = v.nome)
      when 'sem_tabela' then not exists (
        select 1 from information_schema.tables t
         where t.table_schema = 'public' and t.table_name = v.nome)
      when 'coluna' then exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = split_part(v.nome, '.', 1)
           and c.column_name = split_part(v.nome, '.', 2))
      when 'sem_coluna' then not exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = split_part(v.nome, '.', 1)
           and c.column_name = split_part(v.nome, '.', 2))
      when 'funcao' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = v.nome)
      when 'trigger' then exists (
        select 1 from pg_trigger g where g.tgname = v.nome)
      -- GRANT QUE FOI TIRADO, e nao objeto que nasceu: a 0071 nao cria nada --
      -- ela REVOGA `execute`. Sem este tipo a unica pergunta possivel seria
      -- "a funcao existe?", e ela existe desde a 0028. `papel|assinatura`.
      --
      -- `has_function_privilege` respeita heranca de papel, que e exatamente a
      -- pergunta: `service_role` nao e membro de `authenticated` no Supabase,
      -- e foi por isso que o grant da 0040 nao alcancava o cron.
      --
      -- O `to_regrole` e a guarda: num Postgres sem os papeis do Supabase a
      -- funcao ESTOURA, e um erro aqui derrubaria a consulta inteira -- as
      -- trinta e duas linhas de um script cujo trabalho e responder uma.
      when 'sem_execute' then
        to_regrole(split_part(v.nome, '|', 1)) is null
        or not has_function_privilege(
             split_part(v.nome, '|', 1), split_part(v.nome, '|', 2), 'execute')
      when 'feriado' then exists (
        select 1 from public.holidays h where h.data = v.nome::date)
      -- Corpo de funcao, e nao ausencia de objeto: a 0029 nao cria nada, ela
      -- TIRA a pergunta de dentro de `pode_aprovar_subtarefa()`. Procurar um
      -- objeto que sumiu diria "ok" tambem para um banco que nunca teve a
      -- 0026 -- o trecho no corpo distingue os tres estados.
      -- O ESPELHO DO `sem_no_corpo`: a migration que ACRESCENTA um trecho a
      -- uma funcao que ja existia. Sem ele, a unica pergunta possivel seria
      -- "a funcao existe?" -- e ela existe desde muito antes.
      when 'no_corpo' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = split_part(v.nome, '|', 1)
           and p.prosrc like '%' || split_part(v.nome, '|', 2) || '%')
      -- POLICY QUE MUDOU DE REGRA, e nao policy que nasceu: a `campaigns_insert`
      -- existe desde a 0033 com outra pergunta dentro. O que se confere e o
      -- CORPO dela -- `tabela|policy|trecho`.
      when 'policy' then exists (
        select 1 from pg_policies pl
         where pl.schemaname = 'public'
           and pl.tablename = split_part(v.nome, '|', 1)
           and pl.policyname = split_part(v.nome, '|', 2)
           and coalesce(pl.with_check, pl.qual) like '%' || split_part(v.nome, '|', 3) || '%')
      -- POLICY FORA DO SCHEMA `public`. A 0057 escreve em
      -- `realtime.messages`, que e do Supabase -- o `policy` acima fecha em
      -- `schemaname = 'public'` e responderia FALTA para sempre.
      -- `schema|tabela|policy`.
      when 'policy_fora' then exists (
        select 1 from pg_policies pl
         where pl.schemaname = split_part(v.nome, '|', 1)
           and pl.tablename  = split_part(v.nome, '|', 2)
           and pl.policyname = split_part(v.nome, '|', 3))
      when 'sem_no_corpo' then not exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = split_part(v.nome, '|', 1)
           and p.prosrc like '%' || split_part(v.nome, '|', 2) || '%')
      -- TRECHO QUE SAIU DO CORPO DE UMA VIEW. A 0077 nao cria objeto nenhum --
      -- ela REESCREVE a `calendar_events` com duas origens a menos. Perguntar
      -- "a view existe?" responderia ok desde a 0055; o que distingue os dois
      -- estados e o texto dela nao citar mais a tabela que saiu.
      -- `view|trecho`.
      when 'sem_na_view' then not exists (
        select 1 from pg_views w
         where w.schemaname = 'public'
           and w.viewname = split_part(v.nome, '|', 1)
           and w.definition like '%' || split_part(v.nome, '|', 2) || '%')
    end as ok
  from (values
    -- SEM LINHA: 0026 - ela nao deixa rastro. A 0026 reescreveu
    -- `pode_aprovar_subtarefa()` para fazer tres perguntas, e a 0029
    -- reescreveu de novo tirando as tres. Num banco em dia nao sobra objeto
    -- nem trecho de corpo que diga se a 0026 passou por aqui, e a linha da
    -- 0029 logo abaixo ja cobre o estado final. Inventar uma checagem que
    -- responde "ok" sempre seria pior que a ausencia: ela afirmaria sem
    -- conferir. Quem estiver parado na 0025 le a 0027 dizendo FALTA e aplica
    -- da 0026 em diante, que e a ordem certa de qualquer jeito.
    ('0022', 'subtasks.parent_id',              'coluna',       'subtasks.parent_id'),
    ('0023', 'exigencia_aprovacao apagada',     'sem_coluna',   'tasks.exigencia_aprovacao'),
    ('0024', 'dias_do_pedido()',                'funcao',       'dias_do_pedido'),
    ('0025', 'tasks_volta_a_calcular',          'trigger',      'tasks_volta_a_calcular'),
    ('0027', 'subtasks.data_inicio',            'coluna',       'subtasks.data_inicio'),
    ('0028', 'tasks.publicada_em',              'coluna',       'tasks.publicada_em'),
    ('0029', 'trava de autoaprovacao fora',     'sem_no_corpo', 'pode_aprovar_subtarefa|responsavel_id'),
    ('0030', 'approval_rounds.content_id',      'coluna',       'approval_rounds.content_id'),
    ('0031', 'client_access_log',               'tabela',       'client_access_log'),
    ('0032', 'posts',                           'tabela',       'posts'),
    ('0033', 'campaigns',                       'tabela',       'campaigns'),
    ('0034', 'weekly_entries APAGADA',          'sem_tabela',   'weekly_entries'),
    ('0035', 'carga_do_dia()',                  'funcao',       'carga_do_dia'),
    ('0036', 'demandas_do_workflow()',          'funcao',       'demandas_do_workflow'),
    ('0037', 'hr_requests.origem',              'coluna',       'hr_requests.origem'),
    ('0038', 'Natal de 2030 na tabela',         'feriado',      '2030-12-25'),
    ('0039', 'ciclos_de_descanso()',            'funcao',       'ciclos_de_descanso'),
    ('0040', 'task_recurrences',                'tabela',       'task_recurrences'),
    ('0041', 'responsavel padrao da regra',     'no_corpo',     'gerar_ocorrencia|responsavel_padrao'),
    ('0042', 'posts.midia',                     'coluna',       'posts.midia'),
    ('0043', 'user_skills APAGADA',             'sem_tabela',   'user_skills'),
    ('0044', 'abrir_mes_de_social()',           'funcao',       'abrir_mes_de_social'),
    ('0045', 'post_etapas',                     'tabela',       'post_etapas'),
    ('0046', 'post_referencias',                'tabela',       'post_referencias'),
    ('0047', 'tenho_etapa_no_post()',           'funcao',       'tenho_etapa_no_post'),
    ('0048', 'post_versions.removeu_arquivos',  'coluna',       'post_versions.removeu_arquivos'),
    ('0049', 'home_summary()',                  'funcao',       'home_summary'),
    ('0050', 'campaigns.capa_url',              'coluna',       'campaigns.capa_url'),
    ('0051', 'abrir_campanha()',                'funcao',       'abrir_campanha'),
    -- A 0052 e a unica das seis que nao cria objeto: ela devolve o bloco de
    -- carimbos que a 0030 perdeu. Procurar uma funcao diria "ok" para um banco
    -- que nunca a aplicou -- o trecho no corpo e o que distingue.
    ('0052', 'carimbos de data de volta',       'no_corpo',     'validar_transicao_de_subtarefa|concluida_em'),
    ('0053', 'deliverable_versions.arquivos',   'coluna',       'deliverable_versions.arquivos'),
    ('0054', 'campaigns_insert e atendimento',  'policy',       'campaigns|campaigns_insert|is_atendimento'),
    -- A 0055 e a que faltava nesta lista, e a falta apareceu do pior jeito:
    -- o /painel/calendario devolvia erro de servidor e ESTE script respondia
    -- "ok" em todas as linhas, porque a ultima que ele conhecia era a 0054.
    -- Um script cujo trabalho inteiro e dizer qual migration falta nao pode
    -- ficar para tras da pasta em silencio: quem o rodasse concluiria que o
    -- banco estava em dia e iria procurar o problema no codigo.
    -- Hoje quem confere a lista e o `npm run check:migrations`, no CI.
    ('0055', 'view calendar_events',            'tabela',       'calendar_events'),
    ('0056', 'rate_limits',                     'tabela',       'rate_limits'),
    ('0057', 'equipe_ouve_o_canal',            'policy_fora',  'realtime|messages|equipe_ouve_o_canal'),
    ('0058', 'audit_log',                       'tabela',       'audit_log'),
    ('0059', 'post_etapas.prazo_offset_dias',   'coluna',       'post_etapas.prazo_offset_dias'),
    -- A 0060 TIRA UMA TRAVA, entao a checagem e pela AUSENCIA -- a mesma
    -- forma da 0029, que tambem desfez uma. Um banco parado na 0059 ainda tem
    -- a frase no corpo de `validar_nova_rodada` e diz FALTA; depois de
    -- aplicada, nao tem.
    ('0060', 'trava de enviar o proprio fora',  'sem_no_corpo', 'validar_nova_rodada|a própria entrega'),
    ('0061', 'tasks.social_do_mes',             'coluna',       'tasks.social_do_mes'),
    -- A 0062 ACRESCENTA UMA GUARDA dentro de uma funcao que ja existia desde a
    -- 0011, entao nao ha objeto novo a procurar: a checagem e pelo TRECHO no
    -- corpo. Um banco parado na 0061 tem a funcao e nao tem a linha -- e a
    -- consequencia de nao ter e o cliente sem conseguir aprovar nada nas
    -- empresas sem responsavel de atendimento.
    ('0062', 'notificar sem ninguem a avisar',  'no_corpo',     'notificar|p_user_id is null'),
    ('0063', 'clients.capa_url',                'coluna',       'clients.capa_url'),
    -- A 0064 CRIA DUAS TABELAS, e a que se confere e a das FUNCOES: a outra
    -- (`client_flow_defaults`) guarda tres colunas, e um banco pode ter a
    -- primeira sem a segunda se alguem aplicar o arquivo pela metade. A de
    -- funcoes e a que faz o workflow global servir todos os clientes, entao e
    -- ela que responde "o resolvedor esta de pe?".
    ('0064', 'client_function_defaults',        'tabela',       'client_function_defaults'),
    ('0065', 'team_invoices',                 'tabela',       'team_invoices'),
    ('0066', 'invoice_requests',              'tabela',       'invoice_requests'),
    -- A 0067 NAO CRIA TABELA, COLUNA NEM FUNCAO: ela cria um bucket e tres
    -- policies em `storage.objects`, que e schema do Supabase. `policy_fora`
    -- existe desde a 0057 exatamente para este caso -- o `policy` normal fecha
    -- em `schemaname = 'public'` e responderia FALTA para sempre.
    ('0067', 'bucket das capas do feed',      'policy_fora',  'storage|objects|capas: a equipe le'),
    -- A 0068 cria quatro tabelas; a que responde por ela e a do PEDIDO, e
    -- nao `request_types`: aquela tem `create table if not exists` e sobrevive
    -- a uma aplicacao pela metade, enquanto `client_requests` e a que as
    -- outras tres referenciam -- sem ela, nada do modulo esta de pe.
    ('0068', 'client_requests',               'tabela',       'client_requests'),
    -- A 0069 cria quatro tabelas, e quem responde por ela e `asset_loans`, nao
    -- `assets`: o catalogo sozinho e um cadastro sem uso, e o emprestimo e o
    -- que faz o modulo existir. Toda funcao e todo trigger da migration passam
    -- por ele.
    ('0069', 'asset_loans',                   'tabela',       'asset_loans'),
    -- A 0070 acrescenta quatro colunas a `assets`, e a que responde por ela e
    -- `placa_de_video`: as outras tres tem nome que alguem pode ter criado a
    -- mao num banco antigo, e esta e a unica que so existe por causa desta
    -- migration.
    ('0070', 'assets.placa_de_video',        'coluna',       'assets.placa_de_video'),
    -- A 0071 NAO CRIA NADA. O que ela faz e tirar de `anon` o `execute` de uma
    -- funcao `security definer` que APAGA rascunho -- o furo que a 0028 deixou
    -- aberto sem querer. E essa a linha que se confere, e nao o grant do cron:
    -- sem o grant a rotina falha com barulho, no log do Actions; sem o revoke
    -- nada falha nunca, e e por isso que ele durou.
    ('0071', 'anon sem execute em limpar_rascunhos_abandonados', 'sem_execute',
             'anon|public.limpar_rascunhos_abandonados()'),
    -- A 0072 cria UMA funcao, e e ela que as duas faixas do produto consultam
    -- para dizer se a geracao roda de madrugada. `funcao` e nao `sem_execute`:
    -- aqui o que nasce e o objeto, e a 0071 ja cobre o lado do revoke.
    ('0072', 'rotinas_agendadas()',        'funcao',       'rotinas_agendadas'),
    -- A 0073 cria DUAS funcoes, e a linha aponta para `busca_global` e nao para
    -- `sem_acento`: a segunda e o ajudante da primeira, e um banco que tem uma
    -- sem a outra nao existe -- as duas nascem no mesmo arquivo. Apontar para a
    -- que a tela chama e o que faz a resposta ser util: sem ela, a topbar
    -- devolve "Could not find the function".
    ('0073', 'busca_global()',             'funcao',       'busca_global'),
    -- A 0074 reescreve tres funcoes que ja existiam e cria UMA, e a linha
    -- aponta para a nova. As reescritas nao servem: `ciclos_de_descanso` existe
    -- desde a 0039 com o `+ 1` dentro, entao um banco parado la responderia
    -- "ok" com a regra antiga valendo -- que e exatamente o modo de falha que o
    -- cabecalho deste arquivo descreve. `proximo_descanso_em` so a 0074 cria.
    ('0074', 'proximo_descanso_em()',      'funcao',       'proximo_descanso_em'),
    -- A 0075 cria quatro tabelas e cinco funcoes, e a linha aponta para a
    -- tabela do relatorio: ela e a unica coisa do modulo que nao existe de
    -- forma nenhuma antes dele. `feedback_metricas` serviria igual; a tabela e
    -- mais barata de conferir e e o que a tela le.
    ('0075', 'feedback_reports',           'tabela',       'feedback_reports'),
    -- A 0076 acrescenta DUAS colunas e cria UMA funcao, e a linha aponta para
    -- a funcao: as duas colunas tem `default`, entao um banco parado antes
    -- dela responde as consultas antigas sem erro nenhum -- e a corrente
    -- continuaria com um portao so, calada. `porta_do_cliente_no_post` e o que
    -- `posts_corrente_do_cliente` passou a chamar: sem ela a decisao do
    -- cliente estoura com "function does not exist", que e o sintoma que se
    -- vai investigar.
    ('0076', 'porta_do_cliente_no_post()', 'funcao',       'porta_do_cliente_no_post'),
    -- A 0077 nao cria nada: ela tira DUAS origens da `calendar_events`. A
    -- linha procura `subtasks` no texto da view -- a tabela que so a origem da
    -- etapa lia, e que depois da 0077 nao aparece em nenhuma das seis. Apontar
    -- para a view seria responder ok desde a 0055.
    ('0077', 'demanda e etapa fora do calendario', 'sem_na_view',
             'calendar_events|subtasks'),
    -- A 0078 cria DOIS triggers em `campaigns`, e a linha aponta para o que
    -- protege as colunas: sem ele a tela de editar campanha existe e qualquer
    -- colaborador troca o periodo combinado com o cliente -- que e o pior dos
    -- dois estados, porque a tela passa a oferecer o que o banco aceita.
    ('0078', 'campaigns_protege_colunas',  'trigger',      'campaigns_protege_colunas'),
    -- A 0079 cria DOIS objetos, e a linha aponta para o trigger e nao para a
    -- funcao `avisa_aprovador_da_conta()`, que existe desde a 0064 e
    -- responderia ok num banco parado la.
    ('0079', 'approval_rounds_devolve_o_entregavel', 'trigger',
             'approval_rounds_devolve_o_entregavel'),
    -- A 0080 aponta para o espelho, e nao para `campanha_da_task()`: sem o
    -- trigger a etapa acrescentada na demanda nao vira peca, que e o estado
    -- em que a campanha perde item em silencio.
    ('0080', 'subtasks_espelha_no_entregavel', 'trigger',
             'subtasks_espelha_no_entregavel'),
    -- A 0081 reescreve `carga_do_dia()` e cria `disponibilidade()`. A linha
    -- aponta para a NOVA: `carga_do_dia` existe desde a 0035 e responderia ok
    -- num banco parado la, com a conta antiga.
    ('0081', 'disponibilidade()', 'funcao', 'disponibilidade'),
    -- A 0082 aponta para a coluna NOVA e nao para a ausencia da antiga:
    -- `sem_coluna posts.plataforma` responderia ok num banco que nunca teve a
    -- tabela, e a pergunta aqui e se a lista de redes ja existe.
    ('0082', 'posts.plataformas',          'coluna',       'posts.plataformas'),
    -- A 0083 aponta para a AUSENCIA do offset, porque e isso que ela faz: a
    -- coluna `prazo` existe desde a 0045 e responderia ok num banco parado la,
    -- com a corrente ainda andando atras da data de cada post.
    ('0083', 'post_etapas sem prazo_offset_dias', 'sem_coluna',
             'post_etapas.prazo_offset_dias'),
    ('0084', 'post_etapas.data_inicio',  'coluna',       'post_etapas.data_inicio'),
    -- A 0085 reescreve `saldo_de_ferias()` e cria `descanso_usado_no_ciclo()`.
    -- A linha aponta para a NOVA: o saldo existe desde a 0011 e responderia ok
    -- num banco parado la, com a conta acumulativa.
    ('0085', 'descanso_usado_no_ciclo()', 'funcao', 'descanso_usado_no_ciclo'),
    -- A 0086 liga o mes de social a demanda dele nos dois sentidos. A linha
    -- aponta para a funcao que apaga os dois juntos: `arquivada_em` tambem
    -- serviria, mas uma coluna nao prova que o TRIGGER esta de pe, e e ele a
    -- trava.
    ('0086', 'apagar_mes_de_social()', 'funcao', 'apagar_mes_de_social'),
    -- A 0087 torna a corrente do social editavel. A linha aponta para a
    -- TABELA dos elos e nao para `social_flows`: o fluxo sem corrente nao
    -- abre mes nenhum, e e `social_flow_steps` que o PASSO 7 le em
    -- `montar_etapas_do_post`.
    ('0087', 'social_flow_steps',        'tabela',       'social_flow_steps'),
    -- A 0088 colapsa a corrente do social: uma etapa por MES em vez de uma
    -- corrente por post. A linha aponta para `post_etapa_progresso` e nao
    -- para `subtasks.social_papel`: a coluna nasce facil e a tabela e o que
    -- prova que o modelo novo esta de pe -- um banco com a coluna e sem a
    -- tabela nao tem onde guardar o "12 de 18".
    ('0088', 'post_etapa_progresso',     'tabela',       'post_etapa_progresso'),
    -- A 0089 tira as duas pontas de data do FLUXO: ele e a sequencia de acoes,
    -- e a data e do mes. A linha e `sem_coluna` porque esta migration nao cria
    -- objeto nenhum -- ela APAGA, e reescreve tres funcoes. A coluna que sumiu
    -- e a pergunta certa: `etapas_do_fluxo()` existe desde a 0087 e responderia
    -- ok num banco parado la.
    ('0089', 'social_flow_steps.comeca_dias_antes saiu', 'sem_coluna',
             'social_flow_steps.comeca_dias_antes')
  ) as v(migration, item, tipo, nome)
) x
order by migration;
