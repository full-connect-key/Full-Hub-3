-- ---------------------------------------------------------------------------
-- 0029 - A gestao aprova, inclusive o proprio trabalho
--
-- DECISAO DO USUARIO, e ela desfaz a 0026: "nao estou conseguindo aprovar
-- minha propria task, quero mudar a regra, se uma task precisar de aprovacao,
-- qualquer pessoa com acesso de desenvolvedor, consegue aprovar".
--
-- COMO O ERRO ACONTECEU, e fica registrado para nao se repetir: a frase
-- anterior dele -- "qualquer desenvolvedor pode aprovar qualquer task, mesmo
-- que a task seja dele mesmo" -- foi lida como relato de furo, e a 0026
-- fechou o furo com tres perguntas. Era o contrario: era a descricao do que
-- ele queria que o sistema fizesse. Nao existia furo; existia uma trava que
-- ele nao pediu, vinda da 0007.
--
-- O QUE SE PERDE, e e consequencia aceita por quem decidiu: a rodada deixa de
-- ser uma checagem independente. Quem produz e quem aprova podem ser a mesma
-- pessoa, e o registro da rodada passa a dizer "esta pessoa deu OK no proprio
-- trabalho" em vez de "outra pessoa conferiu". A rodada continua valendo como
-- REGISTRO -- quem decidiu, quando, com que comentario -- e e isso que ela e
-- a partir de agora.
--
-- A AGENCIA E PEQUENA, e essa e a razao pratica: numa equipe em que o
-- desenvolvedor e quem executa e quem valida, uma trava de separacao para o
-- trabalho num dia em que so ele esta disponivel.
--
-- O QUE CONTINUA DE PE, e nao e esquecimento:
--
--   * so `is_gestor()` decide. Colaborador nao aprova nada, nem a propria
--     etapa -- a policy de UPDATE de `approval_rounds` e quem barra;
--   * rodada fechada nao muda de resultado (`proteger_rodada_fechada`);
--   * pedir ajustes continua exigindo comentario;
--   * a rodada do CLIENTE continua sendo decidida pelo cliente, por
--     `decidir_rodada_do_cliente` -- ninguem da agencia decide por ele;
--   * `validar_nova_rodada` continua recusando "Ninguem envia ao cliente a
--     propria entrega". Aprovar e enviar sao duas decisoes, e o usuario mudou
--     uma. Mexer na outra de tabela seria decidir por ele.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

-- A trava some inteira: trigger primeiro, funcao depois.
--
-- E DROP, e nao um corpo que devolve `new` calado. Uma funcao chamada
-- `bloquear_autoaprovacao` que nao bloqueia nada e uma mentira esperando
-- alguem ler o nome e concluir que a separacao existe.
drop trigger if exists approval_rounds_sem_autoaprovacao on public.approval_rounds;
drop function if exists public.bloquear_autoaprovacao();

-- `pode_decidir_rodada()` nasceu na 0026 so para a tela desligar o botao com
-- o motivo. Sem os tres motivos ela vira um segundo nome para `is_gestor()`,
-- e dois nomes para a mesma pergunta e como nascem duas respostas.
drop function if exists public.pode_decidir_rodada(uuid);

-- Quem decide uma rodada interna: a gestao, e so isso.
--
-- E esta funcao que a policy de UPDATE de `approval_rounds` usa (0007). O
-- `not exists` que excluia o responsavel saiu -- era a trava da 0007, a
-- mesma que a 0026 ampliou.
--
-- NOTA DE DECISAO, herdada da 0007 e ainda de pe: `is_gestor()` inclui o
-- socio. Para restringir so ao desenvolvedor, troque por
-- `auth_role() = 'desenvolvedor'` aqui e em `exigirGestorNaAcao`.
create or replace function public.pode_aprovar_subtarefa(p_subtask_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  -- O parametro fica sem uso, e de proposito: a assinatura e o que a policy
  -- da 0007 chama, e trocar assinatura de funcao usada em policy obriga a
  -- recriar a policy junto. Alem disso e aqui que entraria uma regra por
  -- etapa ("este desenvolvedor atende esta conta"), que segue em aberto.
  return public.is_gestor();
end;
$$;

comment on function public.pode_aprovar_subtarefa(uuid) is
  'Decide rodada interna quem e gestao -- inclusive o proprio responsavel (0029, decisao do usuario). A separacao entre quem faz e quem aprova saiu na 0029.';

notify pgrst, 'reload schema';
