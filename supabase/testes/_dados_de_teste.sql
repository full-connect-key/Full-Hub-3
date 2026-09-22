-- Dados no MODELO ANTIGO, para provar que a 0007 nao perde atribuicao.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@fck.com'),
  ('22222222-2222-2222-2222-222222222222', 'diego@fck.com'),
  ('33333333-3333-3333-3333-333333333333', 'carla@fck.com'),
  ('44444444-4444-4444-4444-444444444444', 'bruno@fck.com'),
  ('55555555-5555-5555-5555-555555555555', 'marina@fck.com'),
  ('66666666-6666-6666-6666-666666666666', 'rafael@fck.com'),
  ('77777777-7777-7777-7777-777777777777', 'cliente.verde@ex.com'),
  ('88888888-8888-8888-8888-888888888888', 'cliente.optica@ex.com')
on conflict do nothing;

insert into public.profiles (id, email, nome, role, ativo) values
  ('11111111-1111-1111-1111-111111111111','ana@fck.com','Ana Souza','socio',true),
  ('22222222-2222-2222-2222-222222222222','diego@fck.com','Diego Lima','desenvolvedor',true),
  ('33333333-3333-3333-3333-333333333333','carla@fck.com','Carla Reis','colaborador',true),
  ('44444444-4444-4444-4444-444444444444','bruno@fck.com','Bruno Alves','colaborador',true),
  ('55555555-5555-5555-5555-555555555555','marina@fck.com','Marina Costa','colaborador',true),
  ('66666666-6666-6666-6666-666666666666','rafael@fck.com','Rafael Dias','colaborador',true),
  ('77777777-7777-7777-7777-777777777777','cliente.verde@ex.com','Joana Verde','cliente',true),
  ('88888888-8888-8888-8888-888888888888','cliente.optica@ex.com','Otto Visao','cliente',true)
on conflict (id) do nothing;

-- O trigger handle_new_user ja criou o profile com o role padrao. Aqui o
-- teste diz quem e quem de verdade.
update public.profiles set role = 'socio',        nome = 'Ana Souza'    where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role = 'desenvolvedor',nome = 'Diego Lima'   where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set role = 'colaborador',  nome = 'Carla Reis'   where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'colaborador',  nome = 'Bruno Alves'  where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set role = 'colaborador',  nome = 'Marina Costa' where id = '55555555-5555-5555-5555-555555555555';
update public.profiles set role = 'colaborador',  nome = 'Rafael Dias'  where id = '66666666-6666-6666-6666-666666666666';
update public.profiles set role = 'cliente',      nome = 'Joana Verde'  where id = '77777777-7777-7777-7777-777777777777';
update public.profiles set role = 'cliente',      nome = 'Otto Visao'   where id = '88888888-8888-8888-8888-888888888888';

insert into public.team_members (user_id, cargo, area, funcao, ativo) values
  ('11111111-1111-1111-1111-111111111111','Sócia','Gestão','Gestao',true),
  ('22222222-2222-2222-2222-222222222222','Desenvolvedor','Tecnologia','Desenvolvimento',true),
  ('33333333-3333-3333-3333-333333333333','Atendimento','Atendimento','Atendimento',true),
  ('44444444-4444-4444-4444-444444444444','Designer','Criação','Design',true),
  ('55555555-5555-5555-5555-555555555555','Social Media','Criação','Social Media',true),
  ('66666666-6666-6666-6666-666666666666','Tráfego','Mídia','Trafego',true)
on conflict do nothing;

insert into public.clients (id, nome_empresa, nome_contato, email_contato, ativo) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Mundo Verde','Joana','joana@mv.com',true),
  ('aaaaaaaa-0000-0000-0000-000000000002','Óptica Visão','Otto','otto@ov.com',true)
on conflict (id) do nothing;

insert into public.client_users (client_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','77777777-7777-7777-7777-777777777777'),
  ('aaaaaaaa-0000-0000-0000-000000000002','88888888-8888-8888-8888-888888888888')
on conflict do nothing;

-- 5 tasks no modelo antigo.
insert into public.tasks (id, client_id, titulo, prioridade, status, prazo, responsavel_id, criado_por, estimativa_horas, tempo_real_horas) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Post de lançamento','alta','aberta','2026-10-05','55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333',2.5,null),
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Campanha de outubro','urgente','em_andamento','2026-10-20','44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333',8,3.25),
  ('bbbbbbbb-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002','Vitrine de verão','normal','aguardando_aprovacao','2026-09-30','44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333',4,4),
  ('bbbbbbbb-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000002','Relatório de agosto','baixa','concluida','2026-09-01','66666666-6666-6666-6666-666666666666','33333333-3333-3333-3333-333333333333',1.5,2),
  ('bbbbbbbb-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000001','Rebranding','normal','em_andamento','2026-11-30',null,'33333333-3333-3333-3333-333333333333',null,null)
on conflict (id) do nothing;

-- A task 5 JA tem subtarefas: ela nao pode ganhar uma "Execução" inventada.
insert into public.subtasks (task_id, titulo, prazo, responsavel_id, concluida, estimativa_horas, tempo_real_horas, ordem) values
  ('bbbbbbbb-0000-0000-0000-000000000005','Pesquisa de marca','2026-10-10','55555555-5555-5555-5555-555555555555',true,3,3.5,0),
  ('bbbbbbbb-0000-0000-0000-000000000005','Nova identidade','2026-11-10','44444444-4444-4444-4444-444444444444',false,10,null,1)
on conflict do nothing;
