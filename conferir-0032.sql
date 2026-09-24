-- ===========================================================================
-- Diagnostico de 12 linhas
--
-- Cole SO ISTO no SQL Editor e rode. Ele cria uma funcao de brinquedo, com a
-- mesma forma da que deu erro, e a apaga em seguida -- nao toca em nenhuma
-- tabela do produto.
--
--   Se passar: o problema nao e a construcao, e sim o pedaco do arquivo que
--   chegou ao servidor. Rode as migrations uma a uma, pelos tres arquivos
--   aplicar-no-supabase-0030.sql, -0031.sql e -0032.sql.
--
--   Se falhar aqui: mande o erro. Ai e o ambiente, e da para tratar.
-- ===========================================================================
create or replace function public.conferir_select_into()
returns uuid
language plpgsql
as $corpo$
declare
  v_teste uuid;
begin
  select gen_random_uuid() into v_teste;
  return v_teste;
end;
$corpo$;

select public.conferir_select_into() as deu_certo;

drop function public.conferir_select_into();
