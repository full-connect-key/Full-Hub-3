# Full Hub

Plataforma interna da agência **Full Connect Key**. Uma única aplicação, um
único banco, duas áreas:

| Área | Quem usa | Rota |
| --- | --- | --- |
| **Painel Interno** | equipe da agência | `/painel` |
| **Portal do Cliente** | clientes da agência | `/portal` |

Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui, sobre Supabase.
Preparado para rodar numa VPS da Hostinger.

As regras do produto e as convenções de código estão em
[`CLAUDE.md`](./CLAUDE.md).

---

## Sumário

1. [Como rodar na sua máquina](#como-rodar-na-sua-maquina)
2. [Configurando o Supabase](#configurando-o-supabase)
3. [Criando usuários](#criando-usuarios)
4. [Conferindo a conexão](#conferindo-a-conexao)
5. [Como o projeto está organizado](#como-o-projeto-esta-organizado)
6. [Adicionando um módulo](#adicionando-um-modulo)
7. [Gerando protótipos para validação](#gerando-prototipos-para-validacao)
8. [Deploy na VPS da Hostinger](#deploy-na-vps-da-hostinger)
9. [Quando o domínio chegar](#quando-o-dominio-chegar)
10. [Segurança: o que nunca fazer](#seguranca-o-que-nunca-fazer)

---

## Como rodar na sua máquina

Precisa de Node.js 22 ou mais novo (`node -v` para conferir).

```bash
npm install
cp .env.local.example .env.local   # preencha com os dados do seu Supabase
npm run dev
```

Abra http://localhost:3000.

Sem as credenciais preenchidas o site ainda sobe, mas te leva direto para
`/status`, que lista o que esta faltando. Isso e proposital: da para trabalhar
no layout antes de ter o Supabase pronto.

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe em modo desenvolvimento, com recarga automatica |
| `npm run build` | Gera a versao de producao |
| `npm run start` | Roda a versao de producao (usado na VPS) |
| `npm run lint` | Verifica os padroes de codigo |
| `npm run typecheck` | Confere os tipos sem gerar build |
| `npm run check:supabase` | Testa a conexao com o Supabase pelo terminal |
| `npm run prototipo` | Gera imagens das telas em `prototipos/`, sem precisar de Supabase |

---

## Configurando o Supabase

### 1. Criar o projeto

Em [supabase.com](https://supabase.com), crie um projeto. Escolha a regiao
**South America (Sao Paulo)** — o banco fica mais perto dos usuarios e o painel
responde bem mais rapido do que numa regiao dos EUA.

Guarde a senha do banco de dados num gerenciador de senhas. Ela nao e a mesma
coisa que as chaves de API e o Supabase nao mostra ela de novo.

### 2. Copiar as credenciais

No painel do projeto:

| Onde | O que copiar | Para qual variavel |
| --- | --- | --- |
| Project Settings > Data API | Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Project Settings > API Keys | chave `anon` / `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Project Settings > API Keys | chave `service_role` | `SUPABASE_SERVICE_ROLE_KEY` (opcional) |

Cole no `.env.local`. As duas primeiras sao publicas por natureza e vao para o
navegador — quem protege os dados e o RLS do banco, nao o sigilo dessas chaves.
A terceira e segredo de verdade: leia [Seguranca](#seguranca-o-que-nunca-fazer).

### 3. Criar as tabelas

No painel do Supabase, abra **SQL Editor > New query**, cole o conteúdo de
`supabase/migrations/0002_estrutura_base.sql` **inteiro** e clique em **Run**.
(Se o projeto for novo, rode a `0001_perfis.sql` antes — mas ela não é
obrigatória: a 0002 cria tudo do zero e migra o que existir da 0001.)

> **Cole o arquivo todo, sem deixar texto selecionado.** O SQL Editor roda
> apenas a seleção quando existe uma. Rodar um pedaço do meio do arquivo dá o
> erro `relation "public.profiles" does not exist`, porque as tabelas são
> criadas no começo. As migrations podem ser executadas quantas vezes for
> preciso.

Deu certo quando a última linha do resultado mostra `tudo pronto` com as
contagens de profiles, clients, policies e tabelas com RLS (4).

A migration cria o tipo `user_role`, as tabelas `profiles`, `clients`,
`client_users` e `team_members`, as funções de segurança reutilizadas por todo
o RLS, e as políticas de cada tabela. Detalhes em
[`supabase/README.md`](./supabase/README.md).

### 4. Cadastrar as URLs de retorno

Em **Authentication > URL Configuration**, adicione em *Redirect URLs*:

```
http://localhost:3000/auth/callback
```

Quando o dominio existir, adicione tambem a versao de producao. Sem isso, os
links de "esqueci minha senha" voltam com erro.

---

## Criando usuários

A plataforma **não tem tela de cadastro aberta**, de propósito: é um sistema
interno, e cadastro livre deixaria qualquer pessoa criar conta — e, pior,
escolher o próprio perfil de acesso. Mantenha o cadastro desligado em
**Authentication > Providers**.

Para cada pessoa, no painel do Supabase:

**Authentication > Users > Add user > Create new user**

Preencha e-mail e senha, marque *Auto Confirm User* e, em **User Metadata**,
coloque:

```json
{ "nome": "Ana Souza", "role": "socio" }
```

Os valores possíveis de `role` são `cliente`, `colaborador`, `desenvolvedor` e
`socio`. Sem metadata, a pessoa nasce como `colaborador`. O registro em
`public.profiles` é criado sozinho por um trigger.

Para mudar o perfil de alguém depois:

```sql
update public.profiles set role = 'desenvolvedor'
where email = 'pessoa@fullconnectkey.com.br';
```

Isso funciona no SQL Editor porque ali não existe sessão de usuário. Dentro da
plataforma, **só quem é `socio` altera o perfil de outra pessoa** — e ninguém
altera o próprio.

### Vincular um cliente a uma empresa

Um usuário `cliente` só enxerga as empresas às quais está vinculado:

```sql
insert into public.client_users (client_id, user_id)
values (
  (select id from public.clients where nome_empresa = 'Mundo Verde'),
  (select id from public.profiles where email = 'contato@mundoverde.com.br')
);
```

### Usuários de teste

`supabase/seed.sql` cria seis pessoas na equipe, três usuários de cliente, três
empresas e os vínculos. **Senha de todos: `FullHub@2026`.**

| E-mail | Perfil | Função na agência | Cai em |
| --- | --- | --- | --- |
| socia@fullconnectkey.com.br | socio | Gestão | `/painel` |
| dev@fullconnectkey.com.br | desenvolvedor | Desenvolvimento | `/painel` |
| colab@fullconnectkey.com.br | colaborador | Atendimento | `/painel` |
| design@fullconnectkey.com.br | colaborador | Design | `/painel` |
| social@fullconnectkey.com.br | colaborador | Social Media | `/painel` |
| trafego@fullconnectkey.com.br | colaborador | Tráfego | `/painel` |
| contato@mundoverde.com.br | cliente | — | `/portal` |
| marketing@mundoverde.com.br | cliente | — | `/portal` |
| contato@opticavisao.com.br | cliente | — | `/portal` |

As empresas são **Mundo Verde** (dois acessos ao portal), **Óptica Visão** (um
acesso) e **Academia Corpo Livre**, que nasce desativada e sem ninguém
vinculado — é o caso de teste de "some das listas sem perder nada" e o único
cliente que a exclusão definitiva permite apagar.

O seed roda sozinho no ambiente local (`npx supabase db reset`). No projeto
hospedado, crie as pessoas pelo painel e rode só a PARTE 2 do arquivo, que cria
empresas e vínculos. O próprio arquivo explica isso no topo.

---

## Conferindo a conexão

Tres formas, da mais rapida para a mais completa:

```bash
npm run check:supabase
```

Roda no terminal, sem precisar subir o site. Funciona tambem na VPS, antes do
primeiro deploy. Sai com codigo de erro se algo essencial falhar, entao pode
ser usado em automacao.

**Pagina `/status`** — mesma verificacao no navegador, com instrucao do que
fazer em cada item com problema.

**`GET /api/status/supabase`** — a mesma coisa em JSON. Responde HTTP 200
quando esta tudo certo e 503 quando falhou, entao serve como health check de
monitoramento:

```bash
curl -s http://localhost:3000/api/status/supabase
```

As quatro checagens sao: variaveis de ambiente preenchidas, servidor do
Supabase respondendo, tabela `perfis` existindo, e chave de servico presente
(esta ultima e opcional e nunca reprova).

> `/status` e `/api/status/supabase` ficam acessiveis sem login, para que voce
> consiga diagnosticar o sistema justamente quando o login nao funciona.
> Elas nunca mostram chaves — so o resultado de cada checagem e o endereco do
> projeto, que ja e publico. Se preferir fechar depois que tudo estabilizar,
> remova `"/status"` e `"/api/status"` da lista `ROTAS_PUBLICAS` em
> `src/proxy.ts`.

---

## Como o projeto está organizado

```
src/
  proxy.ts                     Roda antes de cada requisição: renova a sessão
                               e manda quem não está logado para o login
  app/
    (auth)/                    login, esqueci-senha, redefinir-senha
    (interno)/painel/          Painel Interno — exige perfil de equipe
    (cliente)/portal/          Portal do Cliente — exige perfil cliente
    auth/callback/             Chegada dos links enviados por e-mail
    forbidden.tsx              Tela do HTTP 403
    status/                    Diagnóstico da conexão
    api/status/supabase/       O mesmo diagnóstico em JSON
  components/ui/               shadcn/ui
  components/shared/           Componentes reaproveitados por todo módulo
  components/painel/           Menu lateral, trilha, topbar do painel
  components/portal/           Navegação e menu do Portal do Cliente
  hooks/                       Timeout de inatividade
  lib/
    auth/roles.ts              Os 4 perfis, espelhando as funções SQL
    auth/dal.ts                De onde sai "quem está logado"
    auth/acoes.ts              Entrar, sair, recuperar senha
    auth/esquemas.ts           Validação zod dos formulários
    acoes/resultado.ts         Contrato { ok, error } de toda Server Action
    acoes/guardas.ts           Recusa de perfil sem 403 silencioso
    acoes/contas.ts            Criação de conta no Auth e link de senha
    acoes/cliente.ts           O lado da tela: chamar e mostrar o erro
    dados/                     Consultas de clientes, equipe e acessos
    dominio/equipe.ts          Funções, áreas e quem concede cada perfil
    supabase/admin.ts          Chave de serviço (server-only)
    supabase/                  Clients, proxy, tipos, diagnóstico
  app/(interno)/painel/_actions/  Criação de usuários (chave de serviço)
supabase/migrations/           SQL versionado do banco
supabase/seed.sql              9 usuários de teste, 3 empresas (uma desativada)
scripts/
  verificar-supabase.mjs       Testa a conexão pelo terminal
  prototipo.mjs                Gera as imagens das telas
  prototipo/                   Dados e módulos de exemplo (nunca vão ao ar)
```

### As três camadas de proteção

Nada depende de uma barreira só:

1. **`src/proxy.ts`** manda para o login quem não tem sessão. É rápido, mas não
   é o que garante segurança.
2. **`exigirEquipe()` / `exigirCliente()`** rodam no servidor, no layout de
   cada área, e devolvem **HTTP 403** para quem está na área errada. Esconder o
   link no menu não seria proteção nenhuma.
3. **RLS no Postgres** decide o que cada pessoa lê e escreve. Esta é a que vale
   de verdade: funciona mesmo que alguém chame a API do Supabase direto, sem
   passar pelo nosso site.

### Autenticação: `getUser()`, nunca `getSession()`

No servidor, o código sempre usa `supabase.auth.getUser()`, que valida o token
com o Supabase. `getSession()` apenas lê o cookie, que o navegador pode ter
adulterado — confiar nele no servidor seria uma falha de segurança.

### Timeout de inatividade

Só o perfil `cliente` cai por inatividade: aviso aos 28 minutos, saída aos 30.
Ele acessa de fora da agência, às vezes de um computador compartilhado. A
equipe fica o dia todo no sistema e não tem esse timeout.

---

## Adicionando um módulo

O caminho é sempre o mesmo. Exemplo com um módulo de tasks:

### 1. Migration com RLS

Crie `supabase/migrations/0003_tasks.sql`:

```sql
create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  titulo     text not null,
  status     text not null default 'aberta'
             check (status in ('aberta', 'em_andamento', 'concluida')),
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- A equipe lê tudo; o cliente lê apenas as das empresas dele.
create policy tasks_select on public.tasks
  for select to authenticated
  using (public.is_staff() or client_id in (select public.my_client_ids()));

-- Escrita para gestores.
create policy tasks_write on public.tasks
  for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());
```

Aplique no SQL Editor do Supabase.

> **Nunca pule o `enable row level security`.** Sem ele, a tabela fica legível
> por qualquer pessoa com a chave anon — que vai no bundle do navegador.

Reaproveite `is_staff()`, `is_gestor()`, `is_socio()` e `my_client_ids()` em
vez de repetir a consulta em cada policy.

### 2. Atualizar os tipos

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

### 3. Criar a página

`src/app/(interno)/painel/tasks/page.tsx`:

```tsx
import { exigirEquipe } from "@/lib/auth/dal";
import { criarClienteServidor } from "@/lib/supabase/server";

export default async function PaginaDeTasks() {
  await exigirEquipe();

  const supabase = await criarClienteServidor();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  return <pre>{JSON.stringify(tasks, null, 2)}</pre>;
}
```

A mesma página no Portal ficaria em `src/app/(cliente)/portal/tasks/`, com
`exigirCliente()` — e sem filtro por empresa no código, porque o RLS já limita
o resultado.

### 4. Acrescentar ao protótipo

Dados fictícios em `scripts/prototipo/dados-exemplo.ts` e a tela nova na lista
`TELAS` de `scripts/prototipo.mjs`.

---

## Gerando protótipos para validação

```bash
npm run prototipo
```

Gera uma imagem de cada tela em `prototipos/` — login, painel, portal, acesso
negado, em tema claro e escuro, desktop e celular — para aprovar o visual antes
de qualquer coisa ir para o ar. Não precisa de Supabase, de login nem de deploy.

### Como funciona, e por que dessa forma

O projeto é copiado para `.prototipo/`. **Só nessa cópia**, os módulos de
sessão e de diagnóstico são trocados por versões de exemplo que ficam em
`scripts/prototipo/`, usando apelidos de caminho do TypeScript, e o `proxy.ts`
é substituído por um que deixa tudo passar. Nenhum arquivo de `src/` é
alterado, e a cópia é apagada no fim.

Esse cuidado tem um motivo: gerar as telas exige um modo que pula o login. Se
esse código morasse dentro de `src/`, uma variável de ambiente errada em
produção poderia abrir a plataforma inteira. Do jeito que está, o código que
pula o login **não existe** no app publicado.

Para conferir voce mesmo, depois de um `npm run build` comum:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/dashboard
```

Sem sessão, precisa responder `307` redirecionando para `/login` (ou `/status`,
quando o Supabase ainda não está configurado).

### A cada sprint

1. Acrescente os dados fictícios do módulo novo em
   `scripts/prototipo/dados-exemplo.ts`
2. Acrescente a tela na lista `TELAS`, no topo de `scripts/prototipo.mjs`
3. Telas que só existem para o protótipo (como a de 403) viram rotas em
   `scripts/prototipo/extras/`

Se um dos modulos reais ganhar uma funcao nova, o build do prototipo falha
avisando qual falta -- e so acrescentar na versao de exemplo correspondente.

### Na primeira vez

O gerador usa o Chromium do Playwright. Se ele reclamar que nao achou o
navegador:

```bash
npx playwright install chromium
```

> As imagens sao um retrato do visual, nao um teste do sistema. Elas mostram
> layout, texto e espacamento -- nao mostram se a consulta ao banco traz os
> dados certos. Isso so aparece usando o dashboard de verdade.

---

## Deploy na VPS da Hostinger

Testado no fluxo padrao de uma VPS Ubuntu da Hostinger. Voce so precisa de
acesso SSH — o painel da Hostinger mostra o IP e a senha de root.

### 1. Preparar a maquina

```bash
ssh root@SEU_IP_DA_VPS

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git nginx

# PM2, que mantem o dashboard rodando
npm install -g pm2
```

### 2. Baixar o projeto

```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/full-connect-key/Full-Hub-3.git full-hub
cd full-hub
npm ci
```

### 3. Configurar as variaveis

```bash
cp .env.local.example .env.local
nano .env.local
```

Preencha com as credenciais do Supabase. Em `NEXT_PUBLIC_SITE_URL` coloque o
endereco real; enquanto nao houver dominio, use `http://SEU_IP_DA_VPS`.

Confira antes de continuar:

```bash
npm run check:supabase
```

### 4. Build e start

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # faz o dashboard voltar sozinho depois de um reboot
```

O site ja responde em `http://SEU_IP_DA_VPS:3000`.

### 5. Nginx na frente

Deixar o Node exposto direto na porta 3000 nao e uma boa: sem Nginx nao da
para usar HTTPS nem esconder a porta.

Crie `/etc/nginx/sites-available/full-hub`:

```nginx
server {
    listen 80;
    server_name SEU_IP_OU_DOMINIO;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ative e recarregue:

```bash
ln -s /etc/nginx/sites-available/full-hub /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 6. Atualizar depois de uma mudanca

```bash
cd /var/www/full-hub
git pull
npm ci
npm run build
pm2 restart full-hub
```

### Comandos uteis do PM2

```bash
pm2 status            # esta rodando?
pm2 logs full-hub     # ver os logs ao vivo
pm2 restart full-hub  # reiniciar
```

---

## Quando o domínio chegar

Voce consegue desenvolver e ate colocar no ar sem dominio nenhum — o item 4
acima ja deixa o painel acessivel pelo IP. Quando o dominio existir:

1. **DNS**: aponte um registro `A` para o IP da VPS. Um subdominio como
   `dashboard.suaagencia.com.br` e o mais comum, para nao ocupar o site
   principal da agencia.

2. **Nginx**: troque `server_name SEU_IP_OU_DOMINIO;` pelo dominio e recarregue
   com `systemctl reload nginx`.

3. **HTTPS** (gratuito, leva um minuto):

   ```bash
   apt-get install -y certbot python3-certbot-nginx
   certbot --nginx -d dashboard.suaagencia.com.br
   ```

   O certbot ajusta o Nginx e renova o certificado sozinho.

4. **Variavel do site**: no `.env.local` da VPS, mude
   `NEXT_PUBLIC_SITE_URL` para `https://dashboard.suaagencia.com.br`,
   depois `npm run build && pm2 restart full-hub`. Sem isso os links de
   redefinir senha continuam apontando para o endereco antigo.

5. **Supabase**: em Authentication > URL Configuration, adicione
   `https://dashboard.suaagencia.com.br/auth/callback` nas *Redirect URLs* e
   coloque o dominio em *Site URL*.

---

## Segurança: o que nunca fazer

- **Não comite o `.env.local`.** O `.gitignore` ja bloqueia; nao force.
- **Nunca use a `service_role` no navegador.** Ela ignora todo o RLS: quem tem
  essa chave le e escreve qualquer coisa no banco. Ela so pode ser usada em
  codigo de servidor. `src/lib/supabase/admin.ts` importa `server-only`
  justamente para o build quebrar se alguem tentar usa-la no lugar errado.
- **Toda tabela nova precisa de `enable row level security` e policies.** Sem
  isso, a chave anon (que vai para o navegador) le a tabela inteira.
- **Se uma chave vazar**, va em Project Settings > API Keys e gere novas.
