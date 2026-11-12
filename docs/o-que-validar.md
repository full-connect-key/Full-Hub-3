# O que validar — entrega "A etapa editável"

Lista em ordem, do que bloqueia tudo até o detalhe. Cada item diz **onde
clicar**, **o que você tem que ver** e **o que me dizer se estiver errado**.

> Esta lista é da entrega de 12/11/2026 (seis pedidos numa mensagem). Ela é
> descartável: quando você terminar, pode apagar o arquivo.

---

## 0. O que só você pode fazer

**0.1 — Subir o código.** hPanel → Avançado → GIT → **Deploy**. Depois abra
`/painel` e confira o **rodapé**: ele tem que mostrar o commit novo. Enquanto
ele mostrar o commit de antes, nada abaixo existe no ar — o deploy da Hostinger
não acontece sozinho, e o site continua respondendo com o build da véspera.

**0.2 — Migration: nada a fazer.** Conferi no banco: a tabela da 0131
(`primeiros_passos_dispensados`) **já está aplicada**, com as quatro policies.
Era o item que ficou em aberto nas duas últimas entregas; está fechado.
**Esta entrega não traz migration nenhuma.**

---

## 1. As sete cores de status

**Onde:** `/painel/gestao-tasks` → aba **Demandas** → visão **Lista**.

**O que ver:** sete caixas de cabeçalho, uma por status, cada uma com cor
própria:

| Status | Cor |
| --- | --- |
| Não iniciada | cinza |
| Em andamento | azul |
| Aguardando informações | **laranja** |
| Aguardando aprovação | **marrom** |
| Em ajuste | **vermelho** |
| Entregue | **verde claro (lima)** |
| Concluído | verde escuro |

**Depois troque para o tema escuro** (o seletor no menu do seu avatar) e olhe de
novo: as sete continuam distinguíveis.

**Me diga se:** alguma cor não é a que você imaginou — principalmente o
**marrom** (ele é um tom quente, não terroso-escuro) e o **lima** (ele é
amarelado ao lado do verde do concluído, de propósito, para "entregue" não se
confundir com "concluído").

---

## 2. O mesmo status no Portal do Cliente

**Onde:** `/portal/mundo-verde` → **Social Media** → calendário do mês.

**O que ver:** a legenda abaixo do calendário passou de **cinco** para **sete**
entradas. É consequência declarada: o mapa de cor é um só para a agência e para
o cliente.

**Me diga se:** sete cores na grade do cliente ficaram demais. O ganho é que
"Aguardando informações" (a Full travada esperando resposta dele) e "Aguardando
aprovação" (esperando a decisão dele) deixaram de estar escondidas dentro do
cinza e do azul. Se você preferir, dá para voltar o portal aos cinco tons sem
mexer no painel — mas aí passam a ser dois mapas, e eles podem divergir.

---

## 3. O briefing: caixa, tabela e cores

**Onde:** `/painel/gestao-tasks` → abra qualquer demanda → campo **Briefing**.

**O que ver na barra de ferramentas**, à direita dos botões de lista: quatro
ícones novos — **paleta** (cor do texto), **marca-texto** (realce), **quadrado**
(caixa) e **grade** (tabela).

**Teste, nesta ordem:**

1. Selecione uma frase → **paleta** → escolha uma cor. Cada item do menu diz o
   nome ao lado da amostra.
2. Selecione outra frase → **marca-texto** → escolha um pastel. O pastel é
   FUNDO, não cor de letra — foi de propósito: pastel como letra não se lê.
3. Ponha o cursor num parágrafo → **quadrado** → **Aviso**. Ele vira uma caixa
   com fundo âmbar. Clicando em "Aviso" de novo, a caixa se desfaz.
4. **Grade** → *Inserir tabela 3×3*. Com o cursor dentro dela, o mesmo menu
   passa a oferecer acrescentar/apagar linha e coluna e apagar a tabela.
   As colunas se arrastam pela borda.
5. **Troque para o tema escuro.** A cor do texto e o fundo da caixa acompanham.

**Me diga se:** faltou alguma cor ou algum tipo de caixa. São 9 cores de letra,
7 realces e 4 caixas — o limite é proposital (vinte tons num mesmo briefing
deixam de destacar qualquer coisa), mas é ajustável.

### 3.1 — Um briefing ANTIGO, no escuro

**O que ver:** um briefing escrito ANTES desta entrega, com cor aplicada, no
tema escuro: a cor dele **não clareia** e pode ficar difícil de ler.

**Isso é consequência declarada e não bug.** O texto antigo guarda o valor exato
da cor dentro do documento; o novo guarda o NOME, que troca com o tema.
Reescrever os documentos antigos no instante em que alguém os abre seria mexer
no texto da pessoa sem ela pedir. **O conserto de um documento antigo é
reaplicar a cor pelo menu** — aí ele passa a acompanhar o tema.

**Me diga se:** isso incomoda o bastante para valer uma varredura que converta
os briefings antigos de uma vez. É decisão sua.

---

## 4. O responsável se escolhe na linha

**Onde:** a mesma tela, seção **Subtarefas**.

**O que ver:** na coluna do responsável, o avatar (ou "sem responsável") agora
tem uma **setinha** ao lado. Clique nela — a lista da equipe abre ali mesmo, sem
abrir o modal.

**Teste:** troque o responsável de uma etapa. O salvamento é o próprio clique —
não há botão nesta linha.

**Repare também:** quem não pode distribuir trabalho **não vê a setinha** (vê só
o avatar). E uma etapa no nome de alguém que saiu da agência diz *"fora da
equipe"*, não *"sem responsável"* — são coisas diferentes.

**Me diga se:** a setinha está discreta demais ou chamativa demais. Ela foi
calibrada para onze linhas não virarem onze setas.

---

## 5. Arrastar para reordenar

**Onde:** a mesma lista de subtarefas.

**O que ver:** uma **alça** (⠿) no começo de cada linha. Arraste uma etapa para
cima ou para baixo — a ordem muda na hora.

**Teste os dois níveis:** arraste uma etapa de topo, e depois arraste uma
sub-etapa dentro de "Adaptar formatos".

**O que NÃO acontece, de propósito:** arrastar uma etapa para DENTRO de outra.
A ordem muda; a hierarquia não. Mudar a mãe de uma etapa por um gesto de seis
pixels é a diferença entre uma etapa que conta tempo e uma agrupadora que não
conta.

**Me diga se:** você esperava que arrastar para dentro aninhasse. Dá para fazer,
e aí vira decisão explícita.

---

## 6. O botão de salvar na etapa

**Onde:** a mesma lista → clique no **nome** de uma etapa para abrir o modal.

**O que ver:** no fim do bloco de propriedades há agora uma barra com
**Salvar** — desligada enquanto você não mexer em nada.

**Teste:**

1. Mude a **prioridade**. A barra acende, gruda no pé da caixa e passa a dizer
   *"1 alteração por salvar."* em âmbar, com **Descartar** ao lado.
2. Mude também a **data** (clicando num dia do calendário de disponibilidade) e
   a **estimativa**. O contador sobe.
3. **Descartar** devolve tudo. **Salvar** grava os três de uma vez.

**São cinco campos no rascunho:** responsável, prioridade, início, prazo e
estimativa. O **nome** continua salvando sozinho, e as listas de dentro
(pessoas a mais, dependências, entregas) continuam cada uma com o botão delas —
ali o botão não é "salvar", é "acrescentar" e "tirar".

**O que custa, e é escolha:** fechar o modal com alteração pendente **descarta
sem perguntar**. Não pus a pergunta "tem certeza?" porque a barra grudada já
mostra, na tela, o que não foi salvo.

**Me diga se:** você quer a pergunta ao fechar.

---

## 7. Se alguma coisa der errado

Me mande **o print** e, se aparecer, **a frase da mensagem de erro** — ela é
escrita para dizer o caminho, não só "deu erro". Se for uma tela que não
carrega, o número que o Next mostra não ajuda: ele muda a cada build. O que
ajuda é o print e o que você clicou antes.
