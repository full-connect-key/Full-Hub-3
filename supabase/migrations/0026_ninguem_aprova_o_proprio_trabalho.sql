-- ---------------------------------------------------------------------------
-- 0026 - Ninguem aprova o proprio trabalho (e nao so a propria ETAPA)
--
-- Reportado pelo usuario: "qualquer desenvolvedor pode aprovar qualquer task,
-- mesmo que a task seja dele mesmo". Conferido contra o Postgres, e verdade --
-- e o furo e maior do que parece.
--
-- A trava da 0007 (`bloquear_autoaprovacao`) sabia fazer UMA pergunta: "quem
-- esta decidindo e o `responsavel_id` desta subtarefa?". Isso cobre o caso
-- obvio e deixa passar tres caminhos que acontecem todo dia:
--
--   1. ETAPA SEM RESPONSAVEL. Ninguem e "o proprio", entao ninguem e barrado.
--
--   2. QUEM PEDIU A RODADA DECIDIA A RODADA. `validar_nova_rodada` deixa a
--      gestao abrir rodada de qualquer etapa -- "para destravar", diz o
--      comentario da 0007. O que ninguem notou e que quem destrava decidia em
--      seguida: abrir e aprovar viravam dois cliques da mesma pessoa.
--
--   3. ENTREGOU E DEPOIS TROCOU O RESPONSAVEL. Quem e gestao edita
--      `responsavel_id`. Fazer o trabalho, anexar a entrega, passar a etapa
--      para outro nome e aprovar era um caminho de quatro passos, todos
--      permitidos, que terminava na propria entrega aprovada.
--
-- O cenario que existia na bateria -- "Bruno NAO aprova a propria entrega" --
-- testava exatamente o unico caso que funcionava. Uma trava com um teste que
-- so cobre o caso que passa e uma trava que ninguem sabe que tem furo.
--
-- A REGRA NOVA: quem decide nao pode ser quem executa, nem quem pediu, nem
-- quem entregou. Sao tres perguntas porque sao tres registros diferentes de
-- "fui eu que fiz" -- e cada um sobrevive onde os outros dois se perdem.
--
-- A MENSAGEM DIZ QUAL DOS TRES. "Ninguem aprova a propria entrega" numa etapa
-- que esta no nome de outra pessoa parece engano do sistema; dizer "foi voce
-- quem mandou esta rodada para aprovacao" explica em uma linha.
--
-- O QUE ISTO NAO RESOLVE, e fica registrado: qualquer gestor continua podendo
-- aprovar a etapa de qualquer cliente. Nao existe no produto a nocao de "este
-- desenvolvedor atende esta conta", e inventa-la aqui seria decidir sozinho
-- uma regra de organizacao da agencia. Se for para existir, e decisao
-- explicita e migration propria.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

create or replace function public.bloquear_autoaprovacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  motivo text;
begin
  if new.decidido_por is null then
    return new;
  end if;

  -- 1. Quem executa a etapa.
  if exists (
       select 1 from public.subtasks s
        where s.id = new.subtask_id and s.responsavel_id = new.decidido_por
     ) then
    motivo := 'esta etapa está no seu nome';

  -- 2. Quem PEDIU a rodada. Era o furo maior: a gestao abre rodada de
  --    qualquer etapa para destravar, e quem destravava decidia em seguida.
  elsif new.solicitado_por = new.decidido_por then
    motivo := 'foi você quem mandou esta rodada para aprovação';

  -- 3. Quem ENTREGOU o material. E o unico dos tres que sobrevive a uma troca
  --    de responsavel depois da entrega -- que e justamente o caminho que os
  --    outros dois nao alcancam.
  elsif exists (
       select 1 from public.subtask_entregas e
        where e.subtask_id = new.subtask_id and e.enviado_por = new.decidido_por
     ) then
    motivo := 'o material desta etapa foi enviado por você';

  else
    return new;
  end if;

  raise exception using
    errcode = 'check_violation',
    message = format('Ninguém aprova o próprio trabalho: %s.', motivo),
    hint    = 'Outra pessoa da gestão precisa decidir esta rodada.';
end;
$$;

comment on function public.bloquear_autoaprovacao() is
  'Recusa a decisao de quem executou, pediu ou entregou a etapa. Tres perguntas, porque sao tres registros diferentes de "fui eu que fiz" (0026).';


-- ---------------------------------------------------------------------------
-- A mesma pergunta, para a TELA
--
-- `pode_aprovar_subtarefa()` continua como estava: ela responde pela
-- subtarefa, e e ela que a policy de UPDATE de `approval_rounds` usa. Esta
-- aqui responde pela RODADA, que e o que a fila precisa saber para desligar o
-- botao com o motivo em vez de deixar a pessoa clicar e levar a recusa.
--
-- A policy NAO passou a usar esta: se o RLS barrasse antes, o trigger nunca
-- rodaria e a pessoa receberia "nenhuma linha" no lugar da frase que explica.
-- A trava e o trigger; isto aqui e o aviso.
-- ---------------------------------------------------------------------------
create or replace function public.pode_decidir_rodada(p_round_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  r public.approval_rounds%rowtype;
  eu uuid := (select auth.uid());
begin
  select * into r from public.approval_rounds where id = p_round_id;
  if not found then
    return false;
  end if;

  if not public.is_gestor() then
    return false;
  end if;

  if r.solicitado_por = eu then
    return false;
  end if;

  if exists (select 1 from public.subtasks s
              where s.id = r.subtask_id and s.responsavel_id = eu) then
    return false;
  end if;

  if exists (select 1 from public.subtask_entregas e
              where e.subtask_id = r.subtask_id and e.enviado_por = eu) then
    return false;
  end if;

  return true;
end;
$$;

notify pgrst, 'reload schema';
