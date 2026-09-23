-- ===========================================================================
-- 0019 — senha provisoria e troca no primeiro acesso
--
-- Ate aqui a conta nascia SEM senha, e a porta era um link de recuperacao.
-- Funciona, mas depende de o link chegar: sem SMTP proprio o Supabase entrega
-- pouquissimo, e a tela acabava mostrando o link para alguem copiar e mandar
-- pela mao.
--
-- Agora a conta nasce COM uma senha provisoria, e a pessoa e obrigada a
-- troca-la no primeiro acesso.
--
-- A SENHA E DIFERENTE PARA CADA PESSOA, e isso nao e detalhe. Uma "senha
-- padrao" fixa -- a mesma string para todo mundo -- seria uma chave-mestra:
-- quem a soubesse entraria em qualquer conta recem-criada ate a pessoa logar,
-- e numa conta que ninguem usasse ela valeria para sempre. Sorteada por
-- pessoa, ela so serve para aquela conta e so ate o primeiro acesso.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================

alter table public.profiles
  add column if not exists deve_trocar_senha boolean not null default false;

comment on column public.profiles.deve_trocar_senha is
  'A conta nasceu com senha provisoria e ainda nao foi trocada. Enquanto for true, toda area do sistema manda a pessoa para /trocar-senha.';

-- ---------------------------------------------------------------------------
-- Quem pode baixar a bandeira
--
-- Ninguem, pela mao. `deve_trocar_senha` entra na mesma protecao de `role`:
-- a policy `profiles_update_self` deixa a pessoa editar a propria linha, entao
-- sem esta trava bastaria um PATCH no PostgREST para marcar a senha como
-- trocada sem ter trocado nada -- e a pessoa seguiria com a provisoria, que
-- alguem mais conhece.
--
-- A unica porta e a Server Action que troca a senha de verdade: ela chama
-- `updateUser({password})` e so depois limpa a bandeira com a chave de
-- servico, onde `auth.uid()` e nulo e o `return new` logo abaixo deixa passar.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo = nao veio de usuario logado: SQL Editor, chave de
  -- servico ou o proprio trigger de cadastro.
  if (select auth.uid()) is null then
    return new;
  end if;

  if public.is_socio() then
    -- O socio muda role, mas nem ele baixa a bandeira de outra pessoa sem a
    -- senha ter sido trocada: isso devolveria acesso com a provisoria.
    new.deve_trocar_senha := old.deve_trocar_senha;
    return new;
  end if;

  new.role := old.role;
  new.deve_trocar_senha := old.deve_trocar_senha;

  return new;
end;
$$;

comment on function public.protect_profile_role is
  'Policy nao limita coluna. Este trigger limita: role so o socio muda, e deve_trocar_senha so a chave de servico -- pela Server Action que trocou a senha de verdade.';
