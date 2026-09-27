-- ---------------------------------------------------------------------------
-- 0071 - As rotinas ganham quem as chame (e quem NAO pode chama-las)
-- ---------------------------------------------------------------------------
--
-- DUAS FUNCOES EXISTEM E FUNCIONAM DESDE 2026, E NINGUEM AS CHAMAVA:
-- `gerar_recorrencias()` (0040) e `limpar_rascunhos_abandonados()` (0028). O
-- comentario de cada uma dizia, em tantas palavras, que o agendamento era de
-- outro sprint -- e aquele sprint perdeu a VPS antes de acontecer.
--
-- O preco da primeira e o modulo inteiro de recorrencias: a regra guarda a
-- cadencia, a previa mostra as cinco proximas, o historico tem coluna para
-- cada execucao, e a demanda so nasce quando alguem abre a regra e clica em
-- "Gerar agora". O stories de toda segunda depende de alguem lembrar toda
-- segunda, que e exatamente o que a recorrencia existe para nao exigir.
--
-- O agendamento nao precisa de maquina: ele e uma chamada HTTP ao PostgREST, e
-- quem a faz e `.github/workflows/rotinas.yml`. Esta migration e a outra
-- metade -- sem ela a chamada e RECUSADA, e por dois motivos diferentes.
--
-- ---------------------------------------------------------------------------
-- PASSO 1 - `gerar_recorrencias()` sai de `authenticated`
-- ---------------------------------------------------------------------------
--
-- NENHUMA TELA A CHAMA. O botao "Gerar agora" de uma regra chama
-- `gerar_ocorrencia(regra, periodo)`, que e outra funcao, de UMA regra, e essa
-- continua onde estava. Esta aqui percorre todas as regras ativas da agencia --
-- `security definer` mais `execute` para `authenticated` numa funcao assim e um
-- botao que nao existe na tela e existe na API.
--
-- O GRANT PARA `service_role` E EXPLICITO E NAO ERA NECESSARIO, e vale dizer
-- por que ele esta aqui de qualquer forma. A primeira versao deste comentario
-- afirmava que o cron levaria "permission denied": a 0040 fecha em
-- `authenticated`, e `service_role` nao e membro de `authenticated` no Supabase
-- -- sao papeis irmaos, e o `authenticator` troca para um dos tres.
--
-- ESTAVA ERRADO, E FOI O TESTE DE MUTACAO QUE MOSTROU: tirando este grant, o
-- cenario da bateria continuou passando. O motivo e que o `revoke all from
-- public` da 0040 nao alcanca `service_role` -- ele tem `execute` por um
-- caminho proprio, o `alter default privileges ... grant all on functions to
-- anon, authenticated, service_role` que o Supabase deixa ligado no schema
-- `public`. O grant fica porque privilegio herdado de default privileges e
-- privilegio que some quando alguem os aperta, e aí a rotina para de madrugada;
-- escrito, ele nao depende de uma configuracao de projeto para valer.
--
-- (O cenario ficou na bateria pelo mesmo motivo -- ele mede que a rotina
-- CONSEGUE rodar, que e a metade sem a qual a outra seria um revoke em tudo.)

revoke all on function public.gerar_recorrencias() from public;
revoke all on function public.gerar_recorrencias() from anon;
revoke all on function public.gerar_recorrencias() from authenticated;
grant execute on function public.gerar_recorrencias() to service_role;

-- ---------------------------------------------------------------------------
-- PASSO 2 - `limpar_rascunhos_abandonados()`: ELA ESTAVA ABERTA PARA `anon`
-- ---------------------------------------------------------------------------
--
-- E o passo que nao era sobre agendamento nenhum. A 0028 criou a funcao
-- `security definer` -- ela APAGA de `tasks` -- e nao escreveu revoke: o
-- Postgres concede `execute` a `public` por padrao em toda funcao nova, e o
-- PostgREST publica o schema `public` sozinho. Somando as duas:
--
--   POST /rest/v1/rpc/limpar_rascunhos_abandonados
--   apikey: <a chave anon, que vai no bundle que o navegador baixa>
--
-- apagava todo rascunho da agencia sem sessao nenhuma, rodando com os
-- direitos do dono da funcao. Nao e escalonamento de privilegio de um
-- colaborador: e de QUALQUER PESSOA, porque a chave anon e publica por
-- desenho. O aviso do sexto dia na Home continuaria certo sobre a regra e o
-- rascunho teria sumido no terceiro.
--
-- E o furo tinha a cara de "nada acontece": um rascunho e de quem o criou e
-- de mais ninguem (0028), entao a pessoa abriria a tela, nao acharia o que
-- escreveu, e concluiria que errou o caminho.

revoke all on function public.limpar_rascunhos_abandonados() from public;
revoke all on function public.limpar_rascunhos_abandonados() from anon;
revoke all on function public.limpar_rascunhos_abandonados() from authenticated;
grant execute on function public.limpar_rascunhos_abandonados() to service_role;

-- O comentario da 0028 dizia "NAO roda sozinha: o agendamento e do Sprint 16",
-- e passou a ser falso nesta migration. Reescreve-lo aqui e de graca -- esta
-- migration MUDA COMPORTAMENTO, ao contrario da que existiria so para trocar
-- um texto.
comment on function public.limpar_rascunhos_abandonados() is
  'Apaga rascunhos sem alteracao ha mais de 7 dias. Chamada pela rotina diaria (.github/workflows/rotinas.yml) ou a mao, como service_role -- nunca por anon nem por authenticated.';

comment on function public.gerar_recorrencias() is
  'Gera o que cada regra ativa deve ter gerado ate hoje. Chamada pela rotina diaria como service_role. O botao "Gerar agora" de UMA regra e gerar_ocorrencia().';

-- ---------------------------------------------------------------------------
-- PASSO 3 - A ALTERNATIVA MAIS SEGURA, e por que ela nao esta ligada aqui
-- ---------------------------------------------------------------------------
--
-- O agendamento por GitHub Actions custa uma coisa, e ela precisa estar
-- escrita: a chave de servico passa a morar num secret do repositorio, e a
-- chave de servico IGNORA TODO O RLS. Quem tem permissao de escrita no
-- repositorio pode ler o secret escrevendo um workflow -- e um push a mais.
--
-- `pg_cron` nao tem esse custo: o agendamento mora DENTRO do banco, a chamada
-- nunca sai dele, e nenhuma chave e criada para isso. Ele nao esta ligado por
-- esta migration por uma razao de forma: a extensao se habilita no painel do
-- Supabase (Database > Extensions), entao um `create extension` aqui falharia
-- em qualquer ambiente onde ela nao esteja disponivel -- e migration que nao
-- roda no proximo ambiente nao e migration.
--
-- Quem quiser trocar o Actions por ele cola isto no SQL Editor, APAGA o
-- `schedule:` do workflow, e apaga os dois secrets:
--
--   -- 03:20 em Sao Paulo = 06:20 UTC. O cron do pg_cron e UTC.
--   select cron.schedule('gerar-recorrencias', '20 6 * * *',
--                        'select public.gerar_recorrencias()');
--   select cron.schedule('limpar-rascunhos',   '35 6 * * *',
--                        'select public.limpar_rascunhos_abandonados()');
--
-- (O comando vai entre apostrofos e nao entre marcadores de bloco do Postgres:
-- o `check:migrations` recusa o marcador dentro de comentario, e ele estava
-- certo -- foi ele que pegou a primeira versao deste trecho. Quem separa os
-- comandos antes de manda-los le aquilo como abertura de string, e o erro sai
-- tres telas abaixo, dentro da proxima funcao.)
--
-- O `pg_cron` roda como o dono do banco, entao os grants deste arquivo nao o
-- atrapalham -- e o revoke do PASSO 2, que e o que fecha o furo, vale nos dois
-- caminhos.
