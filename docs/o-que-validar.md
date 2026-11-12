# O que validar — entrega "A etapa por inteiro"

Lista em ordem, do que bloqueia tudo até o detalhe. Cada item diz **onde
clicar**, **o que você tem que ver** e **o que me dizer se estiver errado**.

> Esta lista é da entrega dos cinco pedidos de 12/11/2026. Ela é descartável:
> quando você terminar, pode apagar o arquivo. A lista anterior ("A etapa
> editável") foi substituída por esta.

---

## 0. O que só você pode fazer

**0.1 — Subir o código.** hPanel → Avançado → GIT → **Deploy**. Depois abra
`/painel` e confira o **rodapé**: ele tem que mostrar o commit novo. Enquanto
ele mostrar o commit de antes, nada abaixo existe no ar — o deploy da Hostinger
não acontece sozinho, e o site continua respondendo com o build da véspera.

**0.2 — Migration: nada a fazer.** A **0132** (a que conserta o responsável que
sumia) **já foi aplicada por mim**, no banco de produção, e conferida. Não há
nada para colar no SQL Editor.

---

## 1. O responsável que sumia no colaborador

Era o seu pedido nº 5, e era um furo de verdade — de permissão de banco, não de
tela.

**Onde:** abra qualquer demanda com responsável preenchido, primeiro como
**sócio**, depois entrando com uma conta de **colaborador**.

**O que ver:** o mesmo nome e a mesma foto nos dois. Antes, quem não era gestão
lia **um perfil só — o dele**, então o responsável de cada etapa, a pilha de
avatares da demanda e o autor de cada comentário voltavam vazios.

**Confira também, como colaborador:**

* a lista de etapas: cada uma com a foto de quem a faz;
* a **sub-etapa** (a linha recuada): a foto aparece nela também;
* **⌘K / Ctrl+K** → digite o nome de um colega: o grupo **Equipe** agora
  responde (antes devolvia nada para quem não é gestão).

**O que continua escondido, de propósito:** o contato de **cliente**. A regra
nova abre a equipe para a equipe e deixa o cliente de fora.

**Me diga se:** alguma tela ainda mostrar "sem responsável" numa etapa que tem
dono.

---

## 2. O status da demanda andar sozinho

Era o seu pedido nº 2, e a resposta tem uma parte que vai te surpreender.

**O que o Full Hub já fazia:** o status da demanda é calculado pelas etapas. A
primeira pessoa que põe a etapa dela em andamento move a demanda para "Em
andamento" na Gestão de Tasks, e as outras continuam em "Iniciar" cada uma na
sua. Isso funciona desde sempre.

**O que estava desligando isso:** quando alguém **arrasta um card no board**, o
Full Hub entende que a pessoa escolheu o status à mão — e **para de calcular
aquela demanda para sempre**. A tela respondia só "Salvo.", e nada dizia que o
cálculo tinha sido desligado.

**E conferi no seu banco: a sua única demanda publicada está exatamente assim.**
"Divulgação Sorteio de Aniversário" está marcada **Em andamento** à mão, com as
**três etapas ainda em "Não iniciada"**. Era isso que você estava vendo.

**Onde:** `/painel/gestao-tasks` → **Demandas**.

**O que ver agora:**

1. no card dessa demanda (e na linha dela na visão Lista) aparece uma marca
   discreta: **✋ à mão**;
2. passando o mouse, ela explica: *"este status foi marcado à mão, então o Full
   Hub parou de calculá-lo"*;
3. **clicando nela**, o cálculo volta — a demanda cai para "Iniciar", porque
   nenhuma das três etapas começou;
4. peça para alguém pôr uma etapa em andamento: a demanda sobe sozinha para "Em
   andamento", e as outras duas etapas continuam em "Não iniciada".

**E arrastando um card agora**, a mensagem diz o que aconteceu: *"Status marcado
à mão — o Full Hub deixa de calculá-lo pelas etapas."*

**Não mexi nas suas demandas.** Soltar o cálculo de todas de uma vez apagaria,
em silêncio, a escolha de quem marcou de propósito. A marca mostra quais estão
paradas; o clique é seu.

**Me diga se:** depois de clicar em "à mão", a demanda não acompanhar as etapas.

---

## 3. Briefing dentro da sub-etapa

Era o seu pedido nº 3.

**Onde:** abra uma demanda → clique numa **sub-etapa** (a linha recuada dentro
de outra etapa) → o modal abre.

**O que ver:** uma seção **Briefing**, logo abaixo das propriedades, com o mesmo
editor de texto da demanda — negrito, lista, caixa, tabela, cor.

**Como ele salva:** no **mesmo botão Salvar** do modal. Escreva alguma coisa e a
barra do pé passa a contar a alteração junto com as outras; o Salvar grava tudo
de uma vez.

**Por que não tem botão próprio:** com dois botões, a barra do pé diria "2
alterações por salvar" e gravaria só as cinco propriedades — uma alteração
pendente que o aviso não conhece é pior que aviso nenhum.

**Me diga se:** o texto sumir ao fechar e reabrir o modal depois de salvar.

---

## 4. As fotos de todo mundo na demanda

Era o seu pedido nº 4, e ele tinha duas metades.

**A primeira já estava certa e invisível:** as sub-etapas já entravam na coluna
**Equipe** da demanda, e a foto já era desenhada na linha delas — as duas
sumiam pelo furo do item 1. Conferido no item 1.

**A segunda era um buraco real:** quando uma etapa tem **duas pessoas** (o campo
"quem mais faz" dentro do modal), só a primeira aparecia.

**Onde:** abra o modal de uma etapa → acrescente uma segunda pessoa → feche.

**O que ver:** a foto dela encostada no seletor de responsável, na linha da
etapa, e o nome dela na coluna **Equipe** da demanda.

**Aviso honesto:** hoje o seu banco não tem nenhuma etapa com duas pessoas, então
esse item só aparece depois que você criar uma.

---

## 5. As cores de status na plataforma toda

Era o seu pedido nº 1.

**O que mudou:** o selo de status — aquele que aparece em vinte e uma telas —
passou a ser a **pílula cheia com ícone**, igual ao cabeçalho de grupo da Lista.
Antes ele era pálido no selo e cheio no cabeçalho, as duas na mesma página.

**Onde conferir, em ordem de importância:**

1. `/painel/gestao-tasks` → **Lista**: o cabeçalho do grupo e o selo da coluna
   Status agora são a mesma cor;
2. `/painel/gestao-tasks` → **Board**: o selo dentro do painel lateral da
   demanda;
3. `/painel/minhas-tasks`: lista e board;
4. **o portal do cliente** (`/portal/{cliente}`): o cartão de cada material.

**O que ver:** "Não iniciada" e "Cancelada"/"Stand by" continuam **pálidos** de
propósito — eles são a maioria das linhas, e uma tabela em que tudo grita não
diz nada. Os outros sete são cheios, cada um com o ícone dele.

**Me diga se:** alguma tela ficou pesada demais com a pílula cheia, ou se achar
que o portal do cliente deveria ter ficado pálido.

---

## 6. O que NÃO foi feito, para você saber

* **Nada foi reescrito no seu banco.** A demanda parada à mão continua parada
  até você clicar.
* **Não há como desligar o "à mão" em massa**, de propósito.
* O **chip do cronograma do portal** continua pálido: lá a cor é o fundo do
  *título do material*, não do nome do status — cheia, ela poria texto branco
  sobre cor saturada numa grade de trinta peças.
