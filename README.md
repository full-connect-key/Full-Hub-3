# Full Hub

Dashboard interno da agencia. Next.js (App Router) + Supabase, preparado para
rodar numa VPS da Hostinger.

Esta primeira entrega e a **fundacao**: conexao com o Supabase, login por
e-mail e senha, protecao de rotas e o layout do painel. Os modulos de conteudo
entram a cada sprint, sempre pelo mesmo caminho descrito em
[Adicionando um modulo](#adicionando-um-modulo).

---

## Sumario

1. [Como rodar na sua maquina](#como-rodar-na-sua-maquina)
2. [Configurando o Supabase](#configurando-o-supabase)
3. [Criando o primeiro usuario](#criando-o-primeiro-usuario)
4. [Conferindo a conexao](#conferindo-a-conexao)
5. [Como o projeto esta organizado](#como-o-projeto-esta-organizado)
6. [Adicionando um modulo](#adicionando-um-modulo)
7. [Gerando prototipos para validacao](#gerando-prototipos-para-validacao)
8. [Deploy na VPS da Hostinger](#deploy-na-vps-da-hostinger)
9. [Quando o dominio chegar](#quando-o-dominio-chegar)
10. [Seguranca: o que nunca fazer](#seguranca-o-que-nunca-fazer)

---

## Como rodar na sua maquina

Precisa de Node.js 22 ou mais novo (`node -v` para conferir).

```bash
npm install
cp .env.example .env.local   # preencha com os dados do seu Supabase
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

No painel do Supabase, abra **SQL Editor > New query**, cole o conteudo de
`supabase/migrations/0001_perfis.sql` **inteiro** e clique em **Run**.

> **Cole o arquivo todo, sem deixar texto selecionado.** O SQL Editor roda
> apenas a selecao quando existe uma. Rodar um pedaco do meio do arquivo da o
> erro `relation "public.perfis" does not exist`, porque a tabela e criada no
> comeco. Se aparecer esse erro, e so rodar o arquivo completo de novo: o
> script pode ser executado quantas vezes for preciso.

Deu certo quando a ultima linha do resultado mostra `tudo pronto` com a
contagem de perfis e de policies.

Essa migration cria a tabela `perfis`, liga ela ao sistema de login do Supabase
e configura o RLS. Detalhes em [`supabase/README.md`](./supabase/README.md).

### 4. Cadastrar as URLs de retorno

Em **Authentication > URL Configuration**, adicione em *Redirect URLs*:

```
http://localhost:3000/auth/callback
```

Quando o dominio existir, adicione tambem a versao de producao. Sem isso, os
links de "esqueci minha senha" voltam com erro.

---

## Criando o primeiro usuario

O dashboard **nao tem tela de cadastro aberta**, de proposito: e um painel
interno, e cadastro livre deixaria qualquer pessoa criar conta.

Para cada pessoa da equipe, no painel do Supabase:

**Authentication > Users > Add user > Create new user**

Preencha e-mail e senha e marque *Auto Confirm User*. O perfil em
`public.perfis` e criado sozinho por um trigger.

Para tornar alguem administrador, rode no SQL Editor:

```sql
update public.perfis set papel = 'admin' where email = 'pessoa@suaagencia.com.br';
```

> Se um dia quiser cadastro por convite dentro do proprio dashboard, o caminho
> e uma rota administrativa usando `criarClienteAdmin()` de
> `src/lib/supabase/admin.ts` — a estrutura ja esta pronta.

---

## Conferindo a conexao

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

## Como o projeto esta organizado

```
src/
  proxy.ts                     Roda antes de cada requisicao: renova a sessao
                               e barra rota privada sem login
  app/
    (auth)/                    Login, recuperar senha, nova senha
    (dashboard)/               Tudo que exige login (tem sidebar e topo)
    auth/callback/             Chegada dos links enviados por e-mail
    status/                    Diagnostico da conexao
    api/status/supabase/       Mesmo diagnostico em JSON
  components/                  Sidebar, barra superior e componentes de UI
  lib/
    env.ts                     Leitura das variaveis de ambiente
    navegacao.ts               Itens do menu lateral
    auth/
      dal.ts                   De onde sai "quem esta logado"
      acoes.ts                 Entrar, sair, recuperar senha
    supabase/
      client.ts                Cliente para o navegador
      server.ts                Cliente para o servidor
      admin.ts                 Cliente com a chave de servico (so servidor)
      proxy.ts                 Renovacao da sessao
      diagnostico.ts           Checagens da conexao
      database.types.ts        Tipos do banco
supabase/migrations/           SQL versionado do banco
scripts/
  verificar-supabase.mjs       Testa a conexao pelo terminal
  prototipo.mjs                Gera as imagens das telas
  prototipo/                   Dados e modulos de exemplo (nunca vao ao ar)
```

### As tres camadas de protecao

Nada depende de uma barreira so:

1. **`src/proxy.ts`** manda para o login quem nao tem sessao. E a primeira
   barreira, rapida, mas nao e a que garante seguranca.
2. **`exigirSessao()`** roda dentro de cada pagina privada. Se o filtro do
   proxy mudar por engano um dia, as paginas continuam protegidas.
3. **RLS no Postgres** decide o que cada usuario consegue ler e escrever. Esta
   e a protecao que realmente vale: ela funciona mesmo se alguem falar direto
   com a API do Supabase, sem passar pelo nosso site.

### Autenticacao: `getUser()`, nunca `getSession()`

No servidor, o codigo sempre usa `supabase.auth.getUser()`. Ele valida o token
com o Supabase. `getSession()` apenas le o cookie, que o navegador pode ter
adulterado — confiar nele no servidor seria uma falha de seguranca.

---

## Adicionando um modulo

O caminho e sempre o mesmo. Exemplo com um modulo de clientes:

### 1. Migration com RLS

Crie `supabase/migrations/0002_clientes.sql`:

```sql
create table public.clientes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  status     text not null default 'ativo' check (status in ('ativo', 'pausado', 'encerrado')),
  criado_em  timestamptz not null default now()
);

alter table public.clientes enable row level security;

-- Sem policy, ninguem le nada. Esta abre leitura para quem esta logado:
create policy "clientes: equipe le" on public.clientes
  for select to authenticated using (true);

-- E escrita so para admin:
create policy "clientes: admin escreve" on public.clientes
  for all to authenticated using (public.e_admin()) with check (public.e_admin());
```

Aplique no SQL Editor do Supabase.

> **Nunca pule o `enable row level security`.** Sem ele, a tabela fica legivel
> por qualquer pessoa com a chave anon — que vai no bundle do navegador.

### 2. Atualizar os tipos

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

### 3. Criar a pagina

`src/app/(dashboard)/clientes/page.tsx`:

```tsx
import { exigirSessao } from "@/lib/auth/dal";
import { criarClienteServidor } from "@/lib/supabase/server";

export default async function PaginaDeClientes() {
  await exigirSessao();

  const supabase = await criarClienteServidor();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("nome");

  return <pre>{JSON.stringify(clientes, null, 2)}</pre>;
}
```

### 4. Adicionar ao menu

Em `src/lib/navegacao.ts`:

```ts
import { Users } from "lucide-react";
// ...
{ rotulo: "Clientes", href: "/clientes", Icone: Users },
```

Pronto. Item ativo, versao mobile e protecao de rota ja funcionam sozinhos.

---

## Gerando prototipos para validacao

```bash
npm run prototipo
```

Gera uma imagem de cada tela em `prototipos/`, para aprovar o visual antes de
qualquer coisa ir para o ar. Nao precisa de Supabase, de login nem de deploy.

### Como funciona, e por que dessa forma

O projeto e copiado para `.prototipo/`. **So nessa copia**, quatro modulos sao
trocados por versoes de exemplo que ficam em `scripts/prototipo/`, usando
apelidos de caminho do TypeScript. Nenhum arquivo de `src/` e alterado, e a
copia e apagada no fim.

Esse cuidado tem um motivo: gerar as telas exige um modo que pula o login. Se
esse codigo morasse dentro de `src/`, uma variavel de ambiente errada em
producao poderia abrir o dashboard inteiro. Do jeito que esta, o codigo que
pula o login **nao existe** no app publicado.

Para conferir voce mesmo, depois de um `npm run build` comum:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/dashboard
```

Sem sessao, precisa responder `307` redirecionando para `/login` (ou `/status`,
quando o Supabase ainda nao esta configurado).

### A cada sprint

1. Acrescente os dados ficticios do modulo novo em
   `scripts/prototipo/dados-exemplo.ts`
2. Acrescente a tela na lista `TELAS`, no topo de `scripts/prototipo.mjs`

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
cp .env.example .env.local
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

## Quando o dominio chegar

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

## Seguranca: o que nunca fazer

- **Nao comite o `.env.local`.** O `.gitignore` ja bloqueia; nao force.
- **Nunca use a `service_role` no navegador.** Ela ignora todo o RLS: quem tem
  essa chave le e escreve qualquer coisa no banco. Ela so pode ser usada em
  codigo de servidor. `src/lib/supabase/admin.ts` importa `server-only`
  justamente para o build quebrar se alguem tentar usa-la no lugar errado.
- **Toda tabela nova precisa de `enable row level security` e policies.** Sem
  isso, a chave anon (que vai para o navegador) le a tabela inteira.
- **Se uma chave vazar**, va em Project Settings > API Keys e gere novas.
