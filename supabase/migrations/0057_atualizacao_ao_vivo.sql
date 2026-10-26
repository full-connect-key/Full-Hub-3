-- ---------------------------------------------------------------------------
-- 0057 - QUEM OUVE O CANAL DA EQUIPE (Sprint 16, Parte A)
--
-- A tela do Painel passou a se atualizar sozinha quando outra pessoa mexe na
-- mesma coisa. O aviso viaja por um canal de BROADCAST do Realtime, e esta
-- migration e a unica coisa que decide quem pode ouvi-lo.
--
-- ---------------------------------------------------------------------------
-- O QUE VIAJA E O SINAL, NUNCA A LINHA -- e e por isso que esta migration e
-- curta em vez de perigosa.
--
-- O caminho obvio do Supabase para "a tela se atualiza" e `postgres_changes`:
-- a tabela entra na publicacao `supabase_realtime` e o servidor empurra a
-- LINHA INTEIRA para cada navegador inscrito. Neste produto o Painel e o
-- Portal do Cliente leem as mesmas tabelas, entao isso poria a corretude de um
-- filtro do outro lado de um servico que a bateria daqui nao alcanca.
--
-- E o modo de falha seria o mesmo do `security_invoker` da view
-- `calendar_events`: num banco com um cliente so, vazar tudo e mostrar o certo
-- tem exatamente a mesma cara. Nenhuma tabela entra em publicacao nenhuma.
--
-- O que vai no fio e `{ "motivo": "task" }`. Quem recebe nao le a mensagem:
-- pede a tela de novo ao servidor, onde o RLS vale como em qualquer visita.
--
-- ---------------------------------------------------------------------------
-- QUEM ESCREVE E A CHAVE DE SERVICO, E SO ELA
--
-- Nao existe policy de INSERT para `authenticated` aqui, e a ausencia e a
-- regra: se o navegador pudesse publicar no canal, qualquer pessoa da equipe
-- -- ou qualquer cliente que descobrisse o nome -- mandaria "mudou" em laco e
-- poria a tela de todo mundo recarregando sem parar. O aviso sai de
-- `lib/acoes/ao-vivo.ts`, por HTTP, com a chave de servico, que ignora RLS.
--
-- ---------------------------------------------------------------------------
-- O CLIENTE NAO OUVE O CANAL DA EQUIPE
--
-- `is_staff()`, a mesma funcao de todo o resto. O aviso nao carrega dado
-- nenhum, mas carrega RITMO: um cliente inscrito veria a agencia trabalhando
-- em tempo real -- quantas mexidas por hora, em que horario, em que dia da
-- semana nao teve nenhuma. Ele contratou o resultado.
--
-- E o nome do canal nao e segredo: e uma palavra, e ela viaja no bundle. A
-- trava e a policy, nunca o nome -- a mesma razao pela qual esconder o item do
-- menu nao e seguranca.
--
-- Roda mais de uma vez sem erro.
--
-- ESTA E A UNICA MIGRATION DO PRODUTO QUE ESCREVE FORA DE `public`, e foi
-- isso que ela cobrou: o que vale para toda tabela nossa -- ligar a RLS na
-- mesma migration que cria a tabela -- nao vale aqui, porque a tabela nao e
-- nossa. A razao esta escrita no bloco abaixo, onde a linha saiu.
-- ---------------------------------------------------------------------------

do $migracao$
begin
  -- O schema `realtime` vem pronto no Supabase. Se ele nao estiver ai, a
  -- recusa diz o que fazer em vez de deixar a migration "passar" e a tela
  -- nunca se atualizar -- que e o pior dos dois, porque nada avisa.
  if to_regclass('realtime.messages') is null then
    raise exception
      'A tabela realtime.messages nao existe neste banco.'
      using hint =
        'Ligue o Realtime no projeto (Supabase > Project Settings > Realtime) '
        'e rode esta migration de novo. Sem ela, o canal privado da equipe nao '
        'tem onde ser autorizado e o Painel para de se atualizar sozinho.';
  end if;

  -- NAO HA `alter table ... enable row level security` AQUI, e a ausencia e
  -- o conserto. A primeira versao tinha, e ela NUNCA RODOU em projeto
  -- nenhum: `realtime.messages` pertence a `supabase_realtime_admin`, e o
  -- `postgres` do SQL Editor nao e dono nem membro dele --
  --
  --     ERROR: 42501: must be owner of table messages
  --
  -- -- entao a migration morria na primeira instrucao e as duas de baixo
  -- nunca aconteciam. A tela ficava em "Sem atualizacao ao vivo" para
  -- sempre, e o indicador existe justamente para isso aparecer.
  --
  -- E ELA ERA DESNECESSARIA: o Supabase ja entrega essa tabela com RLS
  -- LIGADA. Medido no banco antes de tirar a linha -- `relrowsecurity` e
  -- `true`, e zero policies. A instrucao nao mudava nada e recusava tudo.
  --
  -- `create policy` PASSA, e e a assimetria que faz esta migration caber:
  -- o Postgres cobra `owner` nos dois comandos, e o Supabase abre o caminho
  -- da policy para o `postgres` -- que e o que a documentacao de Realtime
  -- Authorization manda fazer. Medido: a policy foi criada por aqui.
  drop policy if exists equipe_ouve_o_canal on realtime.messages;

  -- `for select`: no Realtime, ler `realtime.messages` E receber a mensagem.
  -- Nao ha policy de insert de proposito -- veja o cabecalho.
  create policy equipe_ouve_o_canal on realtime.messages
    for select to authenticated
    using (
      realtime.topic() = 'equipe'
      and extension = 'broadcast'
      and public.is_staff()
    );
end
$migracao$;

comment on policy equipe_ouve_o_canal on realtime.messages is
  'Quem e da equipe ouve o canal "equipe" (0057). O cliente nao: o aviso nao '
  'carrega dado, carrega ritmo de trabalho. Escrever no canal e so da chave de '
  'servico, e a ausencia de policy de insert e o que garante isso.';
