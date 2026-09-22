# Bateria do banco

O que estes arquivos respondem: **as regras valem quando alguém chama o
Supabase direto, sem passar pela tela?**

Cada cenário roda como uma pessoa de verdade — `set role authenticated` mais
`request.jwt.claim.sub` — porque é isso que liga o Row Level Security. Rodando
como `postgres` tudo passaria: superusuário ignora RLS, e um teste assim daria
uma aprovação falsa.

## Como rodar

Precisa de um PostgreSQL 16 vazio e do trecho que simula o que o Supabase já
traz pronto (schema `auth`, `auth.uid()`, os papéis `anon` /`authenticated` /
`service_role`, `storage.objects`). Com um banco `fullhub` criado:

```bash
psql -d fullhub -f supabase/testes/_fixture_supabase.sql
for f in supabase/migrations/0001*.sql ... ; do psql -d fullhub -f "$f"; done
psql -d fullhub -f supabase/testes/_dados_de_teste.sql   # base no modelo ANTIGO
psql -d fullhub -f supabase/migrations/0007*.sql          # a migração, sobre ela
psql -d fullhub -f supabase/testes/00_ferramenta.sql
psql -d fullhub -f supabase/testes/01_permissoes_e_fluxo.sql
psql -d fullhub -f supabase/testes/02_status_da_task.sql
psql -d fullhub -c "select * from teste.resultado where situacao = 'FALHOU'"
```

A última linha é o resultado: se voltar vazia, passou.

## O que "recusa" significa aqui

Um `update` barrado pelo RLS **não levanta erro** — ele simplesmente não
encontra a linha e devolve zero. Por isso o cenário aceita as duas formas de
recusa, exceção ou zero linhas. E é pela mesma razão que toda escrita do
projeto termina com `.select()`: sem isso, a tela diria "salvo" para uma
gravação que o banco recusou.

## Cobertura

`01_permissoes_e_fluxo.sql` — quem cria task e subtarefa, dependência
bloqueando e ciclo recusado, o fluxo inteiro de aprovação (interna, ajustes,
segunda rodada, envio ao cliente, decisão do cliente), ninguém aprovando a
própria entrega, e o isolamento por cliente: a Mundo Verde não aparece para a
Óptica Visão em task, subtarefa, rodada, entrega nem histórico.

`02_status_da_task.sql` — a precedência do cálculo do status da Task, o
`entregue` marcado à mão e o momento em que o cálculo retoma o controle, a
regra da última subtarefa, e `cancelada` resistindo ao recálculo.
