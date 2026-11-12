# O que validar — entrega "A entrega diz o que ela é"

Lista em ordem, do que bloqueia tudo até o detalhe. Cada item diz **onde
clicar**, **o que você tem que ver** e **o que me dizer se estiver errado**.

> Esta lista é da entrega dos cinco pedidos de 12/11/2026 — o comentário na
> entrega, o comodato por pessoa, a nota fiscal de dezembro, os filtros das
> Solicitações e o dia cheio do calendário. Ela é descartável: quando você
> terminar, pode apagar o arquivo. A lista anterior ("A etapa por inteiro") foi
> substituída por esta.

---

## 0. O que só você pode fazer

**0.1 — Subir o código.** hPanel → Avançado → GIT → **Deploy**. Depois abra
`/painel` e confira o **rodapé**: ele tem que mostrar o commit novo. Enquanto
ele mostrar o commit de antes, nada abaixo existe no ar — o deploy da Hostinger
não acontece sozinho, e o site continua respondendo com o build da véspera.

**0.2 — Colar DUAS migrations, nesta ordem.** A conexão com o Supabase caiu no
meio desta entrega (ela respondeu *"You do not have permission"* nas últimas
tentativas), então as duas ficaram escritas e **não aplicadas**. SQL Editor →
cole o arquivo inteiro → Run:

1. `supabase/migrations/0133_o_portal_do_cliente_e_de_toda_a_equipe.sql`
2. `supabase/migrations/0134_a_observacao_da_entrega.sql`

**A 0132 você já aplicou** — foi ela que devolveu o erro `42710: policy
"profiles_select_equipe" already exists`, e esse erro *é* a prova de que ela
está no banco. Não cole de novo. (Ela ganhou o `drop policy if exists` que
faltava, então se um dia você recolar o pacote inteiro ela não para mais a
colagem no meio.)

**Se der erro em qualquer uma das duas**, me manda o texto do erro e **em qual
das duas** ele apareceu. E antes de desconfiar de qualquer coisa deste
documento, cole `scripts/onde-esta-o-banco.sql`: ele diz, linha por linha, em
que migration o banco está. A primeira linha que disser `FALTA` é por onde
continuar.

**0.3 — Sem a 0134, um item desta lista nem aparece.** O comentário na entrega
(item 1) depende dela: sem a coluna, a tela não desenha o campo, e você vai
procurar um botão que não existe. Os itens 2 a 5 funcionam sem migration
nenhuma.

---

## 1. O comentário na entrega

Era o seu pedido nº 1: *"quando a pessoa vai fazer uma entrega, ela possa
comentar e subir um link, para especificar qual a entrega certa daquela task,
cada subtarefa deve poder subir um link diferente, e cada sub etapa também"*.

**Duas das três partes já existiam, e vale saber qual:** subir um link já
funcionava, e a **sub-etapa** já anexava o link dela — ela abre o mesmo modal
da etapa. O que não existia era o **comentário**.

**Onde:** abra uma demanda → clique numa etapa → a seção **Entregas** do modal.

**O que ver, em três lugares:**

* **No modal da etapa** — o formulário de link ganhou um segundo campo
  (*"O que é este arquivo?"*), e cada entrega já anexada tem, embaixo dela, ou
  a frase que alguém escreveu ou o convite **"Dizer o que é este arquivo"**.
  Clicando em **editar**, o campo abre **com o texto que já estava lá dentro** —
  se ele abrir vazio, é bug e eu quero saber.
* **Em "Arquivos da entrega"**, na mesma página da demanda, mais abaixo: a
  mesma frase aparece embaixo de quem mandou e quando.
* **Na fila de Aprovações Internas** (Gestão de Tasks → aba Aprovações
  internas): a frase aparece embaixo do chip do anexo. **É aqui que ela mais
  serve** — quem decide não é quem produziu, e com quatro anexos na linha era
  um palpite pelo nome do arquivo.

**Faça também a sub-etapa**, que é a metade do pedido que eu quero que você
confirme: abra uma etapa que tenha sub-etapas (a linha recuada), clique numa
delas, e anexe um link com um comentário. Tem que funcionar igual.

**Teste de verdade:** anexe dois links na mesma etapa, escreva em um só, e veja
se o outro continua sem nada escrito. A nota é de cada arquivo, não da etapa.

**O que ela NÃO é, e eu preciso te dizer:** a nota **não é secreta do
cliente**. A linha da entrega é legível por ele desde o começo do produto — é
assim que o arquivo chega ao portal —, e a permissão do banco libera a linha
inteira, não coluna por coluna. **Nenhuma tela do portal desenha a nota**, e a
frase embaixo do campo diz isso com estas palavras: ela é *"para quem for olhar
aqui dentro"*, e o recado ao cliente vai no envio da aprovação. Se você quiser
que ela seja inalcançável por ele de verdade, isso é outra decisão e eu te digo
o que custa.

**De quebra, achei um defeito antigo arrumando isto.** O carimbo que diz
*"este arquivo saiu nesta rodada"* **não estava sendo gravado**: a escrita
existia no código e o banco a recusava em silêncio desde a entrega dos anexos.
Com a 0134 ela voltaria a funcionar sozinha, o que não era o que eu queria
ligar por acidente — então ela saiu, com a razão escrita no lugar dela. Isso
quer dizer que **o cadeadinho "enviado ao cliente" na lista de arquivos pode
estar faltando em entregas antigas**. Não é desta entrega, não quebra nada, e
eu consigo arrumar separado se você quiser.

---

## 2. Comodato: "Por pessoa" igual a "Por equipamento"

Era o seu pedido nº 2.

**Onde:** Comodatos → aba **Visão geral** → seletor **Por pessoa**.

**O que ver:** cada pessoa abre e os equipamentos dela aparecem com a **mesma
anatomia** da outra visão — foto (ou o ícone do tipo), nome, o
`código · tipo · nº de série`, a pílula de situação, desde quando está com ela,
o estado, e o menu de ações com **"Ver a folha"** dentro. Antes eram três
campos numa linha, sem foto, sem pílula e sem ações.

**Três coisas que mudaram junto:**

* **A busca** ficou em cima, e ela casa com código, nome, marca, modelo, série
  **e o nome da pessoa** — digitando um nome, todos os equipamentos dela vêm.
* **O atraso aparece na linha**, em âmbar (*"desde 12/03/25"* mais o aviso).
  O cartão do topo já contava *"Devolução atrasada: 2"* e não dizia **quais** —
  agora diz.
* **As colunas se alinham** de uma linha para a de baixo dentro da mesma
  pessoa, que é o que permite comparar.

**Confira em 375px** (o celular): a linha quebra, e o **nome do equipamento é o
último a encolher**.

---

## 3. A nota fiscal conta de dezembro de 2026

Era o seu pedido nº 3, primeira metade.

**Onde:** `/painel/notas-fiscais` (a sua tela), e Financeiro → aba **Notas
recebidas** (a do sócio).

**O que ver:** o seletor de mês do diálogo **Enviar nota** começa em
**dezembro de 2026** e não oferece nada antes. Hoje é novembro de 2026, então
**o botão está desligado** com a frase *"As notas fiscais passam a ser emitidas
por aqui a partir de dezembro de 2026."*

**Isso é o certo**, e é o que eu preciso que você confirme: a tela tem **duas
frases diferentes** para o botão desligado — *"ainda não começou"* (com a data)
e *"todos os meses em aberto já têm nota enviada"*. Se você vir a segunda em
novembro, é bug.

Em dezembro o botão liga sozinho, com um mês só na lista.

---

## 4. Solicitações: Status e Cliente

Era o seu pedido nº 4, segunda metade: *"troque situação por status e frente
por cliente para a filtragem"*.

**Onde:** Solicitações (a caixa de entrada do Atendimento).

**O que ver:**

* a primeira fileira de chips se chama **Status** (era "Situação");
* a segunda dimensão é **Cliente**, e ela é um **seletor** e não chips —
  porque o cliente cresce com a carteira, e vinte e oito chips seriam uma
  parede. Ele lista **só as contas que têm pedido na fila**.
* **a frente continua escrita em toda linha** (Social / Campanha / em âmbar
  quando falta). Ela deixou de ser um recorte, não deixou de aparecer.

**Os dois recortes ficam no link**, e não se apagam um ao outro: escolha um
status e um cliente, copie o endereço, abra noutra aba — tem que voltar igual.

**O que se perde, e é dito:** o balde **"Sem classificação"** era a única forma
de *achar* um pedido anterior à regra de classificação obrigatória. Ele
continua **visível** em toda linha, mas deixou de ser filtrável. Hoje não há
nenhum assim no banco; se um dia aparecerem vários, me diz e eu devolvo a
terceira dimensão.

---

## 5. O dia cheio do calendário

Era o seu pedido nº 5: *"quando tiver muitas tasks no mesmo dia, ele deixe uma
aba a ser aberta para mostrar todas"*.

**Onde:** Gestão de Tasks → visão **Calendário**.

**O que ver:** um dia com mais itens do que cabe mostra **"+ N mais"**, e
clicando ali abre um painel **embaixo da grade** com o dia **inteiro** — não só
os que sobraram, porque juntar de cabeça o que está na célula com o que está
embaixo é o trabalho que o painel existe para não dar.

**Três detalhes que decidem se está certo:**

* **cabem três no mês e seis na semana** — a célula da semana é mais alta;
* o painel **rola até aparecer**, porque a grade do mês tem seis semanas e ele
  nasce abaixo da dobra: sem isso o clique pareceria não fazer nada;
* **a linha da semana não cresce mais** por causa de um dia cheio. Antes um dia
  com oito entregas empurrava a linha inteira para quatrocentos pixels e as
  outras seis colunas ficavam vazias do mesmo tamanho.

**Trocar de mês, de visão ou de responsável fecha o painel** — se ele ficar
aberto mostrando um dia que não está mais na grade, é bug.

**E isto vale em Minhas Tasks também**, porque é o mesmo componente com outros
parâmetros.

---

## 6. As propostas de layout

Era o resto dos seus pedidos nº 3 e nº 4: *"me dê propostas de layout de novas
visualizações da parte de notas fiscais"* e *"me dê propostas de layout para
Solicitações"*.

**São três para cada módulo**, com a maquete desenhada nas cores do produto, o
que cada uma responde e **o que ela custa**. Está no link que eu te mandei no
chat — não é código, é para escolher.

**O que eu preciso de você:** uma de cada. Depois da escolha, a tela entra num
sprint com as imagens de 1600 e de 375, no claro e no escuro.

---

## 7. O que NÃO foi feito, para você saber

* **A bateria de testes do banco não rodou** nesta entrega — não há Docker nem
  Postgres neste ambiente. Os vinte e tantos cenários que provariam a permissão
  e a trava da 0134 estão descritos no cabeçalho dela e **não foram
  executados**. O que existe no lugar é o `select` de conferência no fim do
  arquivo, que roda junto com a colagem.
* **As imagens do protótipo não foram geradas** nesta entrega. As telas estão
  escritas e as verificações automáticas estão todas verdes, mas o comentário
  na entrega, o comodato por pessoa e o painel do dia cheio **não foram
  conferidos em imagem** — nem no claro, nem no escuro, nem em 375px. É por
  isso que os itens acima pedem que você olhe no celular.
* **Nada reescreveu as entregas antigas.** O cadeado "enviado ao cliente" que o
  item 1 menciona continua faltando onde ele já faltava.
