-- ===========================================================================
-- Bateria do Sprint 3B. Cada cenario roda como uma PESSOA de verdade
-- (set role authenticated + request.jwt.claim.sub), que e o que faz o RLS
-- valer. Rodando como postgres, tudo passaria -- superusuario ignora RLS.
-- ===========================================================================
create schema if not exists teste;
drop table if exists teste.resultado;
create table teste.resultado (
  n serial, descricao text, situacao text, detalhe text
);

create or replace function teste.cenario(
  p_descricao text,
  p_uid uuid,
  p_comando text,
  p_espera text,              -- 'ok' | 'recusa'
  p_linhas integer default null
) returns void
language plpgsql
as $$
declare
  linhas integer;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    execute p_comando;
    get diagnostics linhas = row_count;
    execute 'reset role';

    if p_espera = 'recusa' and linhas > 0 then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU', format('passou quando devia ser recusado (%s linhas)', linhas));
    elsif p_espera = 'recusa' then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', 'RLS nao achou a linha (0 linhas)');
    elsif p_linhas is not null and linhas <> p_linhas then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU', format('esperava %s linha(s), veio %s', p_linhas, linhas));
    else
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', format('%s linha(s)', linhas));
    end if;
  exception when others then
    execute 'reset role';
    if p_espera = 'recusa' then
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'passou', left(sqlerrm, 90));
    else
      insert into teste.resultado (descricao, situacao, detalhe)
      values (p_descricao, 'FALHOU', left(sqlerrm, 120));
    end if;
  end;
end;
$$;

-- Atalhos de leitura, para nao repetir o uuid no texto dos cenarios.
create or replace function teste.limpar() returns void language plpgsql as $$
begin
  delete from public.task_history;
  delete from public.task_comentarios;
  delete from public.subtask_entregas;
  delete from public.approval_rounds;
  delete from public.subtask_dependencies;
  delete from public.subtasks;
  delete from public.tasks;
end $$;

-- Comparacao direta, para o que nao e questao de permissao e sim de calculo:
-- o status que o trigger produziu, o saldo de ferias, a contagem de dias
-- uteis. Vive aqui, e nao no arquivo que a usou primeiro, para qualquer
-- bateria poder rodar sozinha.
create or replace function teste.conferir(p_descricao text, p_achado text, p_esperado text)
returns void language plpgsql as $$
begin
  insert into teste.resultado (descricao, situacao, detalhe)
  values (p_descricao,
          case when p_achado is not distinct from p_esperado then 'passou' else 'FALHOU' end,
          format('esperado %s, achado %s', p_esperado, p_achado));
end $$;
