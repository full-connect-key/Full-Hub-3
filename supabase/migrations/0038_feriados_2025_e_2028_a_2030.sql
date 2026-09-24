-- 0038 — Feriados nacionais de 2025 e de 2028 a 2030
--
-- O calendario do Full Days passou a ir de janeiro de 2025 a dezembro de
-- 2030, e a tabela `holidays` so tinha 2026 e 2027: a migration 0011 cobriu
-- os dois anos que o calendario de entao alcancava.
--
-- POR QUE ISSO E UM BUG E NAO UMA FALTA DE DADO. Um ano sem feriado na tabela
-- nao aparece vazio -- aparece NORMAL. O calendario desenha o dia 25 de
-- dezembro de 2029 como um dia util qualquer, `dias_uteis()` conta ele, e um
-- afastamento de tres dias em cima do Natal sai com tres dias uteis no lugar
-- de dois. Ninguem tem como desconfiar olhando a tela: um feriado que falta
-- nao deixa buraco nenhum.
--
-- As datas moveis saem da Pascoa, pelo algoritmo gregoriano: Carnaval e
-- Pascoa menos 48 e 47 dias, Sexta-feira Santa e menos 2, Corpus Christi e
-- mais 60. Pascoa em 20/04/2025, 16/04/2028, 01/04/2029 e 21/04/2030 -- em
-- 2030 ela cai no mesmo dia de Tiradentes, e as duas linhas continuam sendo
-- duas datas diferentes (19/04 e 21/04), sem conflito.
--
-- Os nomes vao sem acento, como os da 0011: eles sao dado de banco, e a
-- tabela ja esta escrita assim. Trocar a grafia de uns e nao de outros faria
-- a mesma lista ter duas convencoes.
--
-- `on conflict (data) do nothing` e o que deixa esta migration rodar de novo
-- sem erro, e tambem o que protege um feriado que a gestao tenha cadastrado a
-- mao na mesma data com outro nome: o que a agencia escreveu ganha.

insert into public.holidays (data, nome) values
  ('2025-01-01', 'Confraternizacao Universal'),
  ('2025-03-03', 'Carnaval'),
  ('2025-03-04', 'Carnaval'),
  ('2025-04-18', 'Sexta-feira Santa'),
  ('2025-04-21', 'Tiradentes'),
  ('2025-05-01', 'Dia do Trabalho'),
  ('2025-06-19', 'Corpus Christi'),
  ('2025-09-07', 'Independencia do Brasil'),
  ('2025-10-12', 'Nossa Senhora Aparecida'),
  ('2025-11-02', 'Finados'),
  ('2025-11-15', 'Proclamacao da Republica'),
  ('2025-11-20', 'Dia Nacional de Zumbi e da Consciencia Negra'),
  ('2025-12-25', 'Natal'),

  ('2028-01-01', 'Confraternizacao Universal'),
  ('2028-02-28', 'Carnaval'),
  ('2028-02-29', 'Carnaval'),
  ('2028-04-14', 'Sexta-feira Santa'),
  ('2028-04-21', 'Tiradentes'),
  ('2028-05-01', 'Dia do Trabalho'),
  ('2028-06-15', 'Corpus Christi'),
  ('2028-09-07', 'Independencia do Brasil'),
  ('2028-10-12', 'Nossa Senhora Aparecida'),
  ('2028-11-02', 'Finados'),
  ('2028-11-15', 'Proclamacao da Republica'),
  ('2028-11-20', 'Dia Nacional de Zumbi e da Consciencia Negra'),
  ('2028-12-25', 'Natal'),

  ('2029-01-01', 'Confraternizacao Universal'),
  ('2029-02-12', 'Carnaval'),
  ('2029-02-13', 'Carnaval'),
  ('2029-03-30', 'Sexta-feira Santa'),
  ('2029-04-21', 'Tiradentes'),
  ('2029-05-01', 'Dia do Trabalho'),
  ('2029-05-31', 'Corpus Christi'),
  ('2029-09-07', 'Independencia do Brasil'),
  ('2029-10-12', 'Nossa Senhora Aparecida'),
  ('2029-11-02', 'Finados'),
  ('2029-11-15', 'Proclamacao da Republica'),
  ('2029-11-20', 'Dia Nacional de Zumbi e da Consciencia Negra'),
  ('2029-12-25', 'Natal'),

  ('2030-01-01', 'Confraternizacao Universal'),
  ('2030-03-04', 'Carnaval'),
  ('2030-03-05', 'Carnaval'),
  ('2030-04-19', 'Sexta-feira Santa'),
  ('2030-04-21', 'Tiradentes'),
  ('2030-05-01', 'Dia do Trabalho'),
  ('2030-06-20', 'Corpus Christi'),
  ('2030-09-07', 'Independencia do Brasil'),
  ('2030-10-12', 'Nossa Senhora Aparecida'),
  ('2030-11-02', 'Finados'),
  ('2030-11-15', 'Proclamacao da Republica'),
  ('2030-11-20', 'Dia Nacional de Zumbi e da Consciencia Negra'),
  ('2030-12-25', 'Natal')
on conflict (data) do nothing;
