# Subir o Full Hub na Hostinger, do zero

Este é o passo a passo linear, para quem está fazendo pela primeira vez. Do
momento em que a VPS existe até a agência usando o painel com HTTPS e deploy
automático.

O README tem a mesma matéria organizada como **referência** — bom para
consultar depois. Aqui é **roteiro**: siga na ordem, sem pular.

Cada etapa termina com **Como saber que deu certo**. Se o que aparecer no seu
terminal não bater com o que está escrito ali, pare e resolva antes de seguir —
um erro arrastado três etapas fica dez vezes mais difícil de achar.

**Tempo:** uma hora e meia na primeira vez, se nada der errado. Reserve uma
tarde.

---

## Índice

- [Antes de começar](#antes-de-começar)
- [Parte 1 — O banco (Supabase)](#parte-1--o-banco-supabase)
- [Parte 2 — A máquina](#parte-2--a-máquina)
- [Parte 3 — O projeto na VPS](#parte-3--o-projeto-na-vps)
- [Parte 4 — Primeiro build e o PM2](#parte-4--primeiro-build-e-o-pm2)
- [Parte 5 — Nginx na frente](#parte-5--nginx-na-frente)
- [Parte 6 — Domínio e HTTPS](#parte-6--domínio-e-https)
- [Parte 7 — A primeira pessoa](#parte-7--a-primeira-pessoa)
- [Parte 8 — Self deploy](#parte-8--self-deploy)
- [Quando der errado](#quando-der-errado)
- [O dia a dia, depois de tudo pronto](#o-dia-a-dia-depois-de-tudo-pronto)

---

## Antes de começar

Cinco coisas. As três primeiras são obrigatórias antes da Parte 1; as duas
últimas dá para resolver no meio do caminho.

| O quê | Onde | Observação |
| --- | --- | --- |
| **VPS com Ubuntu 24.04 LTS** | painel da Hostinger | limpo, sem painel — veja abaixo |
| **Acesso SSH** | painel da Hostinger | o IP e a senha de root estão lá |
| **Projeto no Supabase** | supabase.com | o plano gratuito serve para começar |
| Domínio ou subdomínio | onde você registrou | dá para subir sem, pelo IP |
| Acesso de admin no repositório | GitHub | só para a Parte 8 |

### Qual sistema operacional escolher

Na Hostinger, ao criar a VPS, você escolhe entre três famílias: **sistema
operacional puro**, **sistema com painel** (CyberPanel, Plesk, cPanel,
CloudPanel) e **template de aplicação** (Docker, Node.js, WordPress, n8n).

**Escolha o puro: `Ubuntu 24.04 LTS`.**

É o que este tutorial pressupõe, e é onde os números da próxima seção foram
medidos — Ubuntu 24.04.4 com Node 22.22.

| Por quê | |
| --- | --- |
| LTS | suporte até 2029; você não vai reinstalar servidor no meio de um sprint |
| `apt` | todos os comandos daqui são `apt-get`; em AlmaLinux ou Rocky nenhum funciona sem tradução |
| Node 22 | o `setup_22.x` da NodeSource suporta 24.04 direto, e o projeto pede 22 (está no `.nvmrc`) |

**O que NÃO escolher, e por quê importa:**

- **Qualquer opção com painel** (CyberPanel, Plesk, cPanel, CloudPanel). Eles
  instalam o próprio Nginx ou Apache, o próprio firewall e o próprio
  gerenciador de processos. A Parte 5 deste tutorial escreve um arquivo de
  Nginx à mão — e você passaria a ter duas coisas disputando a porta 80, com
  o painel reescrevendo a sua configuração quando bem entender. Painel é ótimo
  para hospedar site de cliente; aqui ele só atrapalha.
- **O template "Node.js"**. Parece o certo pelo nome, mas vem com uma versão
  de Node que você não escolheu e com uma estrutura de pastas própria. Instalar
  o Node você mesmo leva uma linha (Parte 2.2) e você fica sabendo o que tem
  na máquina.
- **Ubuntu 22.04**. Funciona, mas é LTS mais antigo sem nenhuma vantagem aqui.
- **AlmaLinux, Rocky, CentOS, Fedora**. Funcionam, mas você teria que traduzir
  `apt-get` para `dnf`, e os nomes dos pacotes mudam. Não há ganho que pague
  isso.

Se por algum motivo você já tem **Debian 12**, pode seguir o tutorial como
está: os comandos são os mesmos.

### Sobre a memória, antes de você contratar

O build do Full Hub **usa cerca de 850 MB de pico e leva ~85 segundos**. Isso
foi medido, não estimado. Somando o painel que já vai estar rodando (~250 MB),
o pico passa de 1 GB.

| Plano | Serve? |
| --- | --- |
| 1 GB de RAM | **Não.** O Linux mata o build no meio, e a mensagem é só `Killed` |
| 2 GB | Sim, **com arquivo de swap** (Parte 2) |
| 4 GB ou mais | Sim, sem ajuste nenhum |

Se você já contratou a de 1 GB, dá para fazer o build em outra máquina e
mandar pronto — mas isso complica todo o resto. Subir o plano é mais barato
que o tempo que isso custa.

---

## Parte 1 — O banco (Supabase)

Comece pelo banco: sem ele, o painel sobe e não faz nada, e você não saberia
dizer se o problema é o servidor ou o banco.

### 1.1 Criar o projeto

Em [supabase.com](https://supabase.com) → **New project**.

- **Region:** `South America (São Paulo)` — o banco fica perto de quem usa
- **Database Password:** gere uma forte e guarde no gerenciador de senhas da
  agência. Ela não é a senha de ninguém logar no painel; é a do banco.

Espere terminar de provisionar (uns dois minutos).

### 1.2 Rodar as migrations

**Project Settings** não; vá em **SQL Editor → New query**.

Abra `supabase/migrations/` no repositório e rode **um arquivo por vez, na
ordem numérica**, do `0001` ao `0017`. Para cada um: cole o conteúdo inteiro,
clique em **Run**, confirme que deu certo, passe para o próximo.

> **Cole o arquivo todo, e não deixe nada selecionado.** O SQL Editor roda
> apenas o trecho selecionado. Rodar metade cria metade das tabelas, e o erro
> que aparece é sobre uma função que não existe — não sobre o pedaço que
> faltou.

As migrations podem ser rodadas mais de uma vez sem erro, então se você perder
a conta, recomeçar do início é seguro.

**Como saber que deu certo.** No SQL Editor:

```sql
select count(*) as tabelas
from information_schema.tables
where table_schema = 'public';
```

Tem que voltar **mais de 30**. E:

```sql
select to_regclass('public.academy_tracks') as academy,
       to_regclass('public.recommendations') as recomendacoes;
```

Nenhum dos dois pode ser `null` — se for, a `0017` não passou.

### 1.3 Desligar o cadastro aberto

**Authentication → Providers → Email**, e deixe **Enable Sign Ups**
desmarcado.

Isto não é opcional. O Full Hub é interno e não tem tela de cadastro; com sign
up ligado, qualquer pessoa com o endereço do painel cria conta no seu banco.

### 1.4 Guardar as três credenciais

**Project Settings → API Keys** e **→ Data API**. Copie para um bloco de notas:

| Credencial | Onde | Vai virar |
| --- | --- | --- |
| Project URL | Data API | `NEXT_PUBLIC_SUPABASE_URL` |
| chave `anon` / `public` | API Keys | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| chave `service_role` | API Keys | `SUPABASE_SERVICE_ROLE_KEY` |

> A `service_role` **ignora todo o RLS**. Quem tem essa chave lê e escreve
> qualquer coisa no banco, inclusive o Financeiro e o Resumo Semanal de todo
> mundo. Ela só vai existir no `.env.local` da VPS. Nunca a cole em chat, em
> ticket, ou num arquivo que vá para o repositório.

---

## Parte 2 — A máquina

### 2.1 Entrar

```bash
ssh root@SEU_IP_DA_VPS
```

Na primeira vez ele pergunta se você confia na máquina — responda `yes`.

### 2.2 Atualizar e instalar

```bash
apt-get update && apt-get upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git nginx
npm install -g pm2
```

**Como saber que deu certo:**

```bash
node --version    # v22.x.x
nginx -v          # nginx version: ...
pm2 --version
```

A versão do Node precisa ser **22**. Se vier 18 ou 20, o `setup_22.x` não
rodou — repita a linha do `curl`.

### 2.3 O arquivo de swap (só se a VPS tem 2 GB)

Confira o que você tem:

```bash
free -h
```

Se a linha `Mem:` mostrar menos de 4 GB, faça o swap **agora**, antes do
primeiro build:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

A última linha é o que faz o swap voltar depois de um reboot. Sem ela, a
próxima vez que a máquina reiniciar o deploy volta a morrer, e ninguém vai
lembrar por quê.

**Como saber que deu certo:** `free -h` agora mostra uma linha `Swap:` com
2 GB.

### 2.4 O firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

**Libere o OpenSSH antes de ligar o firewall.** Na ordem inversa, você se
tranca para fora da própria máquina e precisa do console de emergência da
Hostinger para voltar.

Repare que a porta **3000 não é liberada**, e é de propósito: quem fala com a
internet é o Nginx, e o Node só atende em `127.0.0.1`.

---

## Parte 3 — O projeto na VPS

### 3.1 Um usuário só para isso

Não rode o painel como `root`. Se um dia alguém achar um furo na aplicação, a
diferença entre "leu uns arquivos" e "é dono da máquina" é esta etapa.

```bash
adduser --disabled-password --gecos "" deploy
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
chown -R deploy:deploy /home/deploy/.ssh
```

### 3.2 Baixar

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/full-connect-key/Full-Hub-3.git full-hub
chown -R deploy:deploy /var/www/full-hub
```

Daqui para frente, **trabalhe como `deploy`**:

```bash
su - deploy
cd /var/www/full-hub
npm ci
```

O `npm ci` leva uns dois minutos.

**Como saber que deu certo:** `ls node_modules | wc -l` devolve algumas
centenas.

### 3.3 As variáveis

```bash
cp .env.local.example .env.local
nano .env.local
```

Preencha com as três credenciais da Parte 1.4. Em `NEXT_PUBLIC_SITE_URL`,
enquanto não houver domínio, use `http://SEU_IP_DA_VPS`.

Salve com `Ctrl+O`, `Enter`, `Ctrl+X`.

```bash
chmod 600 .env.local
```

O `chmod` fecha o arquivo para outros usuários da máquina. É a `service_role`
que está ali dentro.

**Como saber que deu certo:**

```bash
npm run check:supabase
```

Ele conversa com o Supabase de verdade e diz o que encontrou. Se reclamar,
**resolva antes de seguir** — daqui para frente todo problema vai parecer
problema de servidor.

---

## Parte 4 — Primeiro build e o PM2

```bash
npm run build
```

Uns 90 segundos. Se terminar com `Killed` e mais nada, foi memória — volte à
2.3.

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
```

E, **como `root`** (saia com `exit`), para o painel voltar sozinho depois de um
reboot:

```bash
env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
```

Esse comando imprime outra linha para você copiar e colar. Faça isso.

**Como saber que deu certo:**

```bash
pm2 status                      # status "online"
curl -I http://127.0.0.1:3000/login
```

O `curl` tem que responder `HTTP/1.1 200 OK`. Se responder, o painel está de
pé — falta só o mundo alcançar.

---

## Parte 5 — Nginx na frente

Como `root`:

```bash
nano /etc/nginx/sites-available/full-hub
```

Cole, trocando `SEU_IP_OU_DOMINIO`:

```nginx
server {
    listen 80;
    server_name SEU_IP_OU_DOMINIO;

    # O upload de avatar e de material da Academy passa por aqui.
    # O padrao do Nginx e 1 MB, e o sintoma de estourar e um 413 que a
    # tela mostra como "erro ao enviar" sem dizer o tamanho.
    client_max_body_size 25M;

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

Ative:

```bash
ln -s /etc/nginx/sites-available/full-hub /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

O `rm` tira a página "Welcome to nginx" do caminho. Sem isso ela pode ganhar
de você e o painel não aparece.

**Como saber que deu certo:** abra `http://SEU_IP_DA_VPS` no navegador. Tem
que cair na tela de login do Full Hub.

---

## Parte 6 — Domínio e HTTPS

Dá para usar o painel pelo IP, mas não faça isso por muito tempo: sem HTTPS, a
senha de cada pessoa trafega em texto puro.

### 6.1 DNS

Onde o domínio está registrado, crie um registro **A**:

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | `dashboard` | o IP da VPS |

Um subdomínio (`dashboard.suaagencia.com.br`) é o mais comum — assim o site
principal da agência continua onde está.

A propagação leva de minutos a algumas horas. Para conferir:

```bash
dig +short dashboard.suaagencia.com.br
```

Só siga quando isso devolver o IP da sua VPS.

### 6.2 Nginx

```bash
nano /etc/nginx/sites-available/full-hub
```

Troque `server_name SEU_IP_OU_DOMINIO;` pelo domínio, e:

```bash
nginx -t && systemctl reload nginx
```

### 6.3 Certificado

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d dashboard.suaagencia.com.br
```

Ele pergunta um e-mail (para avisar se o certificado for expirar), pede aceite
dos termos e oferece redirecionar HTTP para HTTPS — **aceite**. O certbot
ajusta o Nginx e renova sozinho a cada 90 dias.

### 6.4 Avisar a aplicação e o Supabase

Duas pontas, e esquecer qualquer uma quebra o link de redefinir senha.

**Na VPS**, como `deploy`:

```bash
cd /var/www/full-hub
nano .env.local
# NEXT_PUBLIC_SITE_URL="https://dashboard.suaagencia.com.br"
npm run build
pm2 restart full-hub
```

O `build` de novo não é exagero: `NEXT_PUBLIC_*` é embutido no código que vai
para o navegador, então só reiniciar não muda nada.

**No Supabase**, em **Authentication → URL Configuration**:

- **Site URL:** `https://dashboard.suaagencia.com.br`
- **Redirect URLs:** acrescente
  `https://dashboard.suaagencia.com.br/auth/callback`

**Como saber que deu certo:** abra o domínio com `https://`. Cadeado fechado,
tela de login.

---

## Parte 7 — A primeira pessoa

Não existe tela de cadastro, de propósito: cadastro aberto deixaria qualquer
um criar conta e — pior — escolher o próprio perfil de acesso. Então a
**primeira** conta nasce pelo painel do Supabase. Da segunda em diante, use a
própria plataforma (**Equipe → Adicionar colaborador**), que cria a conta e
manda um link para a pessoa escolher a senha dela.

### 7.1 Criar a conta

No painel do Supabase: **Authentication → Users → Add user → Create new
user**.

| Campo | O que pôr |
| --- | --- |
| **Email** | o e-mail da pessoa |
| **Password** | uma senha temporária, mínimo 6 caracteres |
| **Auto Confirm User** | **marque** |

> **Marcar "Auto Confirm User" não é opcional.** Sem isso o Supabase deixa a
> conta pendente de confirmação por e-mail — e sem SMTP próprio esse e-mail
> quase nunca chega. A conta existiria e o login recusaria, sem dizer por quê.

Ainda na mesma tela, em **User Metadata**, cole:

```json
{ "nome": "Nome Sobrenome", "role": "socio" }
```

**A primeira pessoa tem que ser `socio`.** É o único perfil que altera o
acesso de outra pessoa — sem um `socio`, ninguém consegue promover ninguém, e
você teria que voltar ao SQL Editor para consertar.

Os valores aceitos são `cliente`, `colaborador`, `desenvolvedor` e `socio`.
Qualquer outra coisa — ou metadata vazia — vira `colaborador` em silêncio.

> **"Enable Sign Ups" desmarcado (item 1.3) não atrapalha aqui.** Aquilo
> desliga o cadastro público; criar usuário pelo painel é operação
> administrativa e continua funcionando.

### 7.2 Conferir que o perfil nasceu junto

**Esta etapa não é zelo.** Um trigger (`handle_new_user`) cria a linha em
`public.profiles` quando a conta aparece em `auth.users` — e desde a migration
0005 ele **engole o próprio erro de propósito**, para que uma falha ali não
derrube o cadastro inteiro. O efeito colateral é que, quando ele falha, você
não fica sabendo: a conta existe no Auth, o perfil não, e o login recusa sem
explicar.

No **SQL Editor**:

```sql
select p.email, p.nome, p.role, p.ativo
from public.profiles p
where p.email = 'pessoa@fullconnectkey.com.br';
```

**Como saber que deu certo:** volta uma linha, com `role = socio` e
`ativo = true`.

**Se não voltar nada**, crie a linha à mão — a conta no Auth já existe e não
precisa ser refeita:

```sql
insert into public.profiles (id, email, nome, role, ativo)
select u.id, u.email, 'Nome Sobrenome', 'socio', true
from auth.users u
where u.email = 'pessoa@fullconnectkey.com.br'
on conflict (id) do update
  set role = excluded.role, ativo = true;
```

**Se voltar com `role = colaborador`** quando você queria `socio`, a metadata
não foi lida. Corrija direto:

```sql
update public.profiles set role = 'socio'
where email = 'pessoa@fullconnectkey.com.br';
```

Isso funciona no SQL Editor porque ali não existe sessão de usuário e a RLS
não se aplica. Dentro da plataforma, só quem é `socio` muda o perfil de outra
pessoa — e ninguém muda o próprio.

### 7.3 Entrar

Abra `https://seu-dominio/login` e use o e-mail e a senha temporária.

**Como saber que deu certo:** você cai em `/painel`, e o menu lateral mostra
a seção **Gestão** com o selo **Admin**. Se a seção não aparecer, o perfil não
é `socio` — volte à 7.2.

Troque a senha em **Meu Perfil**. Senha temporária que você digitou e mandou
para alguém não deve continuar valendo.

### 7.4 O resto da equipe

Daqui em diante **não repita este processo**. Use **Equipe → Adicionar
colaborador** na própria plataforma: ela cria a conta, cria a ficha e devolve
um link para a pessoa definir a própria senha — que aparece na tela quando o
e-mail não é entregue, e sem SMTP próprio conte com isso.

Assim ninguém precisa saber a senha de ninguém, nem você.

> **Não rode o `supabase/seed.sql`** no projeto de produção. Ele cria nove
> contas de teste com uma senha conhecida, e elas ficariam lá.

---

## Parte 8 — Self deploy

Até aqui, publicar uma mudança é entrar por SSH e rodar comandos. A partir
daqui, é dar push.

**A Hostinger não tem botão de auto-deploy para Node.** O Git do hPanel atende
site estático e PHP; para uma aplicação Next numa VPS, quem publica é o GitHub
Actions entrando por SSH. Os dois workflows já estão no repositório —
falta ligar as pontas.

### 8.1 O ramo de produção

O deploy dispara em push na **`main`**. Se o repositório ainda não tem esse
ramo, crie: em **Settings → General → Default branch**, renomeie o ramo atual
para `main`, ou crie `main` a partir do que está pronto.

Publicar a partir de um ramo de trabalho seria errado de qualquer jeito: ele
recebe commit no meio de uma mudança, e não é disso que a agência quer o painel
servindo.

Se preferir outro nome, são **dois lugares** e os dois precisam concordar:
`branches:` em `.github/workflows/deploy.yml` e `FULL_HUB_BRANCH` em
`scripts/deploy.sh`.

### 8.2 O PM2 sob o usuário certo

Se você seguiu a Parte 4, o PM2 já está como `deploy` e não há o que fazer.

Se em algum momento você rodou `pm2 start` como `root`, derrube agora:

```bash
# como root
pm2 delete full-hub && pm2 save
```

Dois PM2 disputando a porta 3000 dão um sintoma difícil: o painel responde a
versão velha de vez em quando, e todo deploy parece ter funcionado.

### 8.3 A chave que o GitHub vai usar

**Na sua máquina**, não na VPS — a chave privada nunca deve tocar o servidor:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/full-hub-deploy -C "deploy full-hub" -N ""
ssh-copy-id -i ~/.ssh/full-hub-deploy.pub deploy@SEU_IP_DA_VPS
```

Teste antes de seguir:

```bash
ssh -i ~/.ssh/full-hub-deploy deploy@SEU_IP_DA_VPS 'echo funcionou'
```

Pegue a chave do host:

```bash
ssh-keyscan -t ed25519 SEU_IP_DA_VPS
```

### 8.4 Os segredos no GitHub

**Settings → Secrets and variables → Actions**:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `VPS_HOST` | o IP da VPS |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | o conteúdo de `~/.ssh/full-hub-deploy` — a **privada**, inteira, com as linhas `BEGIN` e `END` |
| Secret | `VPS_HOST_KEY` | a linha que o `ssh-keyscan` devolveu |
| Variable | `VPS_PORT` | só se o SSH não estiver na 22 |
| Variable | `URL_DE_PRODUCAO` | `https://dashboard.suaagencia.com.br` |

Enquanto faltar qualquer um dos quatro segredos, a Action **termina verde** e
escreve no resumo o que falta. Isso é de propósito: X vermelho que significa
"você não configurou isso ainda" ensina todo mundo a ignorar X vermelho.

### 8.5 Testar

**Actions → Deploy → Run workflow.**

Ele roda padrões, tipos, cores, build e os **319 cenários da bateria** contra
um Postgres de verdade; só se tudo passar, entra na VPS e publica; e no fim
confere se o painel respondeu.

**Como saber que deu certo:** a Action fica verde e o último passo diz `No ar.`

E, para conferir da tela: o **rodapé do painel mostra o commit** que gerou o
que você está vendo. Se ele bate com o último commit da `main`, a atualização
subiu. Passe o mouse em cima para ver a data e a hora da publicação.

Se o rodapé disser **"versão local"**, o build saiu de fora de um clone do
repositório — nesse caso o que está no ar não é rastreável, e vale rodar o
deploy de novo.

### 8.6 Aprovação antes de publicar (opcional)

**Settings → Environments → producao → Required reviewers.** O deploy fica
esperando alguém apertar o botão. Vale a pena se mais de uma pessoa começar a
dar push na `main`.

---

## Quando der errado

### O build morre com `Killed`

Memória. Confirme:

```bash
dmesg | grep -i "killed process"
```

Volte à 2.3 e faça o swap.

### `502 Bad Gateway`

O Nginx está de pé e o Node não.

```bash
pm2 status
pm2 logs full-hub --lines 50
```

### O painel abre mas nada carrega, ou dá erro de Supabase

```bash
cd /var/www/full-hub && npm run check:supabase
```

Quase sempre é `.env.local` incompleto — ou preenchido e sem reiniciar. O Next
só lê esse arquivo quando sobe.

### O link de redefinir senha leva para `localhost`

`NEXT_PUBLIC_SITE_URL` ficou com o valor antigo. Volte à 6.4 — e lembre que
precisa de `npm run build`, não só `pm2 restart`.

### A Action passa mas o site não responde

```bash
ssh deploy@SEU_IP_DA_VPS
/var/www/full-hub/scripts/deploy.sh --reverter
```

Volta para o build anterior na hora. Depois investigue com calma.

### `git status` na VPS nunca aparece limpo

Esperado, e não há nada para consertar. O Next reescreve o `tsconfig.json` a
cada build, acrescentando o caminho de tipos da pasta em que construiu. O
próximo deploy começa com `reset --hard` e passa por cima.

---

## O dia a dia, depois de tudo pronto

**Publicar uma mudança:** push na `main`. Só isso.

**Quando o deploy trouxer migration nova:** aplique à mão no SQL Editor, na
ordem. O deploy **não** mexe no banco, e não é esquecimento — migration que se
aplica sozinha junto com um push pode falhar no meio e deixar o banco num
estado que o próximo deploy não conserta, sem ninguém olhando. O próprio script
avisa no fim quando isso acontece.

**Ver o que está acontecendo:**

```bash
pm2 status
pm2 logs full-hub
pm2 monit
```

**Voltar uma versão:** `scripts/deploy.sh --reverter`.

**Se uma chave vazar:** Supabase → **Project Settings → API Keys** → gere
novas, atualize o `.env.local` da VPS, `npm run build`, `pm2 restart full-hub`.
