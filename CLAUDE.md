@AGENTS.md

# Full Hub / Full Flow

Plataforma interna da agência **Full Connect Key**.

## O produto

Uma única aplicação, um único banco de dados, duas áreas:

| Área | Quem usa | Rota |
| --- | --- | --- |
| **Painel Interno** | equipe da agência | `/painel` |
| **Portal do Cliente** | clientes da agência | `/portal` |

As duas leem e escrevem nas mesmas tabelas. O que separa uma da outra não é o
banco: é o perfil de acesso da pessoa, aplicado pelo Row Level Security do
Postgres e reforçado no servidor a cada página.

**O Full Hub é o sistema único da agência.** Não existe integração com Trello,
ClickUp ou qualquer ferramenta externa de gestão. Nunca cite essas ferramentas
na interface, em texto de ajuda ou em nome de campo.

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| Estilo | Tailwind CSS v4 + shadcn/ui (tema neutro, claro e escuro) |
| Backend | Supabase: Auth, Postgres com RLS, Storage, Realtime |
| Formulários | react-hook-form + zod |
| Datas | date-fns com locale pt-BR |
| Ícones | lucide-react |

> **Sobre a versão do Next:** o sprint pedia Next.js 15; o projeto está no 16,
> que é a versão estável atual. A diferença que aparece no código: o arquivo
> `middleware.ts` passou a se chamar `proxy.ts`, com a mesma função. É por isso
> que a renovação de sessão vive em `src/proxy.ts` e não em `middleware.ts`.

## Os quatro perfis de acesso

O tipo `user_role` no banco, e `src/lib/auth/roles.ts` no código.

| Perfil | Área | O que alcança |
| --- | --- | --- |
| `cliente` | Portal | Apenas as empresas às quais está vinculado em `client_users`. Não enxerga nada da equipe. |
| `colaborador` | Painel | Acesso operacional: lê clientes e a equipe, edita o próprio perfil. |
| `desenvolvedor` | Painel | Tudo do colaborador mais gestão: cadastra clientes, vínculos e dados de equipe. |
| `socio` | Painel | Acesso total. **É o único que altera o perfil de acesso de outra pessoa.** |

Funções SQL que traduzem isso, reutilizadas por todo o RLS:

| Função | Verdadeira para |
| --- | --- |
| `auth_role()` | devolve o perfil de quem está logado (null se inativo) |
| `is_staff()` | colaborador, desenvolvedor, socio |
| `is_gestor()` | desenvolvedor, socio |
| `is_socio()` | socio |
| `my_client_ids()` | ids das empresas do cliente logado |
| `is_atendimento()` | quem está no Atendimento, mais a gestão — **é quem cria task** |

### Regra da função Atendimento

`team_members.funcao` é o enum `team_funcao`: Atendimento, Social Media,
Redator, Design, Audiovisual, Trafego, Desenvolvimento, Gestao, Outro.

**Quem tem `funcao = 'Atendimento'` pode criar tasks mesmo sendo
`colaborador`.** Perfil de acesso e função na agência são coisas diferentes:
o perfil diz o que a pessoa alcança na plataforma, a função diz o que ela faz
no dia a dia.

A regra mora na função SQL `is_atendimento()` — verdadeira para quem está no
Atendimento **ou** para gestão. Nenhum módulo deve repetir essa consulta: a
tela pergunta ao banco com `souDoAtendimento()`, que chama a mesma função por
RPC. Assim o botão "Nova task" e a policy `tasks_insert` nunca divergem.

Quem não é do Atendimento **recebe** demanda, não abre: cria subtarefa dentro
de uma task que é dele, comenta e atualiza o próprio andamento.

## A Task e a subtarefa

**A Task é o agrupador da demanda. A SUBTAREFA é a unidade de trabalho.** Quem
tem responsável, prazo, tempo e regra de aprovação é ela — a Task tem período
(início → fim), prioridade e um status que ninguém digita.

É assim porque é assim que a agência trabalha: uma campanha envolve conceito,
KV, adaptações e subida de mídia, cada uma com uma pessoa e uma data. Um
responsável único por task não tinha como representar isso.

Consequências que valem para todo módulo novo:

- `tasks` **não tem** `responsavel_id`, `prazo`, `estimativa_horas` nem
  `tempo_real_horas`. Nenhuma consulta pode ressuscitar essas colunas.
- O que a Task mostra de tempo é a **soma** das subtarefas.
- Atraso é da subtarefa. Uma demanda está atrasada quando alguma etapa em
  aberto passou da data.

#### São TRÊS níveis: demanda → etapa → sub-etapa

`subtasks.parent_id` (migration 0022). Uma campanha tem "Arte", e dentro dela
conceito, KV e adaptações — cada uma com uma pessoa e uma data. Sem o terceiro
nível havia duas saídas ruins: ou "Arte" era uma etapa só, com um responsável
para tudo, ou as três viravam etapas soltas no mesmo nível e ninguém mais via
que são a mesma frente.

**São três e nunca quatro.** O neto é recusado pelo trigger
`subtasks_agrupadora`, pela mesma razão que a thread das Recomendações tem um
nível só: árvore de quatro níveis é árvore que ninguém acompanha, e o recuo na
tela deixa de significar alguma coisa.

**QUEM TEM FILHA VIRA AGRUPADORA**, e é esta regra que organiza todo o resto.
É a mesma que o produto já aplicava à Task, um nível abaixo: no instante em
que uma etapa ganha a primeira sub-etapa, ela para de ser unidade de trabalho.

- o relógio dela não corre — quem mede são as sub-etapas;
- o status dela é **calculado** pelas filhas, e escrito à mão é descartado;
- ela não exige aprovação, não entra em dependência, não abre rodada;
- e a soma da Task — tempo, contagem de etapas, "x de y concluídas" — passa a
  contar **só as folhas**.

Sem isso tudo contaria duas vezes, e a rentabilidade cobraria em dinheiro um
trabalho que aconteceu uma vez só.

**O que estava gravado na mãe não é apagado**, e é escolha: responsável,
prazo, estimativa e tempo continuam lá, param de contar enquanto ela tiver
filha, e voltam se a última sair. Apagar seria destruir dado por causa de um
clique que a pessoa pode desfazer em seguida — e quem adiciona a primeira
sub-etapa geralmente está desdobrando a etapa que já tinha dono e data.

**A mãe nunca fica em `enviada_aprovacao` nem em `em_ajustes`.** Esses dois
afirmam que existe uma rodada dela, e a fila de aprovações vai procurá-la. Com
filha em aprovação ela fica em `em_andamento`, que é verdade: o trabalho está
acontecendo dentro dela.

Em TypeScript o par é `folhas()`, `agrupadoras()` e `emArvore()` em
`lib/dominio/tasks.ts`; no Postgres, `subtask_eh_agrupadora()`. Como
`situacaoDoLancamento()` no Financeiro: os dois lados fazem a mesma pergunta,
um para decidir o que desenhar e outro para decidir o que contar.

#### "Minhas Tasks" lista ETAPAS, não demandas

Se "Conteúdo" e "Layout" da mesma demanda são minhas, aparecem **dois itens** —
são dois trabalhos, com dois prazos, que eu faço em dois momentos. Uma linha
só obrigava a abrir para descobrir o que havia dentro, e o prazo que ela
mostrava era o mais apertado dos dois: o outro não aparecia.

A demanda não some — vira a **linhagem** embaixo do título
(`Cliente · Demanda › Etapa de cima`), e clicar abre o painel com ela inteira,
onde se vê que as duas são da mesma mãe e o que as outras pessoas estão
fazendo nela. A ordem é **global**: o que vence amanhã fica no topo mesmo que
a demanda dele comece semana que vem.

**E vale nas TRÊS visões, não só na Lista.** O board era o da Gestão de Tasks
reaproveitado: um card por demanda com um selo dizendo "5 subtarefas suas".
Cinco trabalhos, cinco prazos e cinco andamentos num card só, numa coluna
escolhida pelo status da *demanda* — quem tinha as cinco etapas espalhadas
entre "em andamento", "em ajustes" e "concluída" via um card que não estava
certo para nenhuma das cinco. Agora é `minhas-tasks/board-de-etapas.tsx`, um
card por etapa.

**As colunas são os SEIS status da etapa**, não os sete da Task: são enums
diferentes no banco, e um de-para entre os dois seria o lugar onde as duas
verdades começam a divergir. O rótulo de `nao_iniciada` volta a ser **"Não
iniciada"** e não "Iniciar" — na Task ele é "Iniciar" porque o cabeçalho da
coluna é a única coisa escrita ali; aqui cada card carrega o botão de ação, e
o primeiro deles se chama exatamente "Iniciar".

**E aqui o card ARRASTA**, ao contrário do board de demandas que estava nesta
mesma tela. É a mesma razão invertida: o status da Task é calculado pelas
subtarefas, então mover aquele card prometia uma mudança que o recálculo
desfazia em seguida; o status da etapa é escrito por quem a faz, e mover o
card é a própria ação. Transição impossível é recusada pelo banco, o card
volta sozinho, e a mensagem diz o caminho — a mesma decisão do seletor de
status.

O board não dá para reaproveitar da Gestão de Tasks: lá a pergunta é "onde
está cada demanda da agência?" e a entidade é a Task. Aqui a pergunta é "o que
eu faço agora?", e a resposta não é uma demanda. O calendário, esse continua
sendo o mesmo componente com outros parâmetros.

### O status da Task é calculado até alguém pegar o volante

`recalcular_status_task()` roda por trigger a cada escrita em `subtasks` e em
`approval_rounds`, olhando **só as folhas**. A precedência, na ordem:

`em_ajustes` → `em_aprovacao` → `concluido` → `aguardando_informacoes` →
`em_andamento` → `nao_iniciada`.

**Os SETE se marcam à mão** (migration 0025). Até ela, só `entregue` e
`aguardando_informacoes` eram manuais, e a tela recusava os outros cinco com
"os outros vêm das subtarefas — mova as etapas e a Task acompanha". Decisão do
usuário: todos são marcáveis.

**Tirar a frase não bastaria, e é por isso que a mudança é de banco.** Liberar
os sete só na tela daria o pior dos dois mundos: o clique passaria e a escolha
sumiria na próxima mexida numa etapa. Recusar com explicação é ruim; aceitar e
desfazer calado é pior. Então `status_manual` passou a travar o recálculo
**inteiro** — não mais só dois casos, e sem ninguém reassumir.

**E o volante se devolve.** "Deixar o Full Hub calcular", no rodapé do
seletor, limpa `status_manual`; o trigger `tasks_volta_a_calcular` percebe a
transição e recalcula **na hora**. Sem ele a Task ficaria parada no último
valor até alguém mexer numa etapa, e quem clicou concluiria que o botão não
faz nada.

O que continua de pé é a trava do banco: marcar `entregue` segue exigindo que
toda etapa que pede aval tenha a rodada aprovada dela. Poder escolher o status
não é poder afirmar que o cliente aprovou.

No board, arrastar é aceito para os sete.

**São sete status, e `cancelada` não é um deles.** Ela era o terceiro manual e
saiu na migration 0020: uma demanda que não vai mais acontecer se apaga, em
Gestão de Tasks. Parada em `cancelada` ela ficava para sempre no board de quem
não quer vê-la, e o board ganhava uma coluna que só acumula.

A trava é o trigger `tasks_sem_cancelada`, e é trigger porque `alter type ...
drop value` não existe no Postgres: o valor continua no enum, e sem o trigger
uma escrita montada à mão passaria calada. A recusa diz o que fazer no lugar —
apagar, ou deixar o status que as etapas calcularem —, e a bateria confere
a **dica** e não só a mensagem, com `teste.recusa_com_dica`: é o `hint` que
`atualizarTask` mostra na tela, e uma trava com a dica apagada passaria por
uma checagem que só lê a mensagem.

O rótulo de `nao_iniciada` é **"Iniciar"**: no board ele é a coluna de onde a
demanda sai, e "Não iniciada" descrevia um estado onde a pessoa procura uma
ação.

### A aprovação

Quem executa produz e envia. Quem valida internamente é a gestão. Quem envia ao
cliente é a gestão. Quem aprova ou pede ajustes lá fora é o cliente.

- **Subtarefa com `requer_aprovacao = true` nunca chega a `concluida` pela mão
  do responsável.** A única porta é uma rodada aprovada, e quem recusa é o
  trigger `subtasks_bloqueia_conclusao_sem_aprovacao` — não a tela.
- **Toda aprovação abre primeiro uma rodada interna**, mesmo quando o tipo é
  `cliente`. O tipo diz o destino final, não o caminho.
- **A gestão aprova, inclusive o próprio trabalho** (migration 0029, decisão
  do usuário). Quem decide uma rodada interna é `is_gestor()`, e mais nenhuma
  pergunta: a etapa pode estar no nome de quem decide, a rodada pode ter sido
  aberta por ela, o material pode ter sido anexado por ela.

  **Houve uma trava, e ela durou três migrations.** A 0007 recusava quem era
  `responsavel_id` da etapa; a 0026 ampliou para três perguntas — executou,
  pediu, ou entregou. A 0029 tirou as três. O motivo está no cabeçalho dela:
  a frase do usuário *"qualquer desenvolvedor pode aprovar qualquer task,
  mesmo que a task seja dele mesmo"* foi lida como relato de furo e era
  descrição do que ele queria. A 0026 fechou um furo que não existia.

  **O que se perde, e é consequência aceita por quem decidiu:** a rodada
  deixa de ser checagem independente e passa a ser **registro** — quem
  decidiu, quando, com que comentário. Numa equipe em que o desenvolvedor é
  quem executa e quem valida, exigir outra pessoa parava o trabalho.

  **Colaborador continua sem decidir nada, nem a própria etapa.** Quem barra é
  a policy de UPDATE de `approval_rounds`, por `pode_aprovar_subtarefa()` —
  que depois da 0029 é `is_gestor()` e nada mais. A bateria guarda os três
  estados em que a trava antiga aparecia (etapa sem dono, rodada aberta pela
  própria pessoa, entrega anexada antes da troca de responsável), virados do
  avesso: se alguém reintroduzir qualquer uma das perguntas, um deles falha e
  diz qual.

  **A trava estava em DOIS lugares, e desfazer um só não desfez nada.** Além
  do trigger, `acoes-de-aprovacao.ts` tinha um `if` que recusava antes de
  chamar o banco. A bateria roda contra o Postgres e ficou verde com a action
  ainda recusando — quem encontrou foi o usuário, clicando em Aprovar. Por
  isso a varredura de `check:cores` passou a procurar as frases da trava em
  `src/`: o que faltava não era um cenário de SQL a mais, era alguém
  perguntando se a regra ainda existe do lado de fora do banco. Vale para
  toda regra que mora nos dois lados — e são várias, por desenho.
- **O que continua aberto, e é decisão em suspenso:** qualquer gestor aprova a
  etapa de qualquer cliente. Não existe no produto a noção de "este
  desenvolvedor atende esta conta". Se for para existir, é decisão explícita e
  migration própria — não um `if` a mais na tela.
- **Aprovar não envia.** Aprovar diz que o material está bom; enviar diz que é
  agora. São duas decisões, e juntá-las já mandou peça errada para cliente em
  muita agência. **Continuam duas**, e é o que sobra de pé depois da 0060.

  **Quem envia ao cliente é `is_gestor()`, e mais nenhuma pergunta** (migration
  0060, decisão do usuário). Até ela havia uma segunda, logo abaixo: quem tinha
  produzido não enviava, nem sendo da gestão.

  **A segunda nunca teve a quem recusar, e é o ponto.** A primeira já barra
  todo colaborador — dono do material ou não —, então a de baixo só alcançava
  desenvolvedor e sócio, que são exatamente as duas pessoas que o usuário
  liberou. A regra que ele pediu, *nenhum colaborador envia o que produziu*,
  continua inteira e sempre esteve: quem a garante é a pergunta de cima.

  **É a 0026 de novo, com a outra metade do par.** Lá eu li a frase dele como
  relato de furo e fechei um furo que não existia; a 0029 desfez. A 0007
  decidiu que aprovar e enviar eram duas travas, o usuário desfez a de aprovar
  na 0029 e a de enviar agora. **E os dois lados saíram no mesmo commit** — a
  lição cara da 0029, onde a bateria ficou verde com a action ainda recusando
  e quem encontrou foi ele, clicando no botão. Por isso a frase entrou na
  varredura de `check:cores`, ao lado das duas da 0029; ela pegou, na primeira
  rodada, o meu próprio comentário explicando a remoção.

  Os dois cenários que provavam a trava ficaram na bateria, **virados do
  avesso**: se alguém a reintroduzir, um deles falha e diz qual. Medidos com
  duas mutações, uma por ramo.
- **Rodada fechada nunca é reescrita nem apagada.** Cada ciclo de ajuste cria
  uma rodada nova, com número maior, e as anteriores continuam no banco com o
  que foi pedido e decidido.
- Pedir ajustes **exige** comentário, na action e no banco.

#### A exigência de aprovação é de CADA ETAPA, e só dela

Cada subtarefa diz se precisa de aval (`requer_aprovacao`) e de qual
(`tipo_aprovacao`: `interna` ou `cliente`). **A demanda inteira não tem mais
uma exigência própria**, e a ausência é decisão do usuário — a migration 0023
apagou `tasks.exigencia_aprovacao`, que a 0014 tinha criado.

**O que estava errado, e foi ele quem apontou:** a trava antiga aceitava UMA
rodada aprovada, do escopo exigido, em QUALQUER subtarefa. Uma campanha com
conceito, layout, revisão e mídia passava com o conceito aprovado e o resto
nunca visto — e saía como "entregue", com o carimbo do sistema dizendo que a
aprovação exigida aconteceu. Uma trava que dá por cumprido o que foi cumprido
em um lugar só é pior que nenhuma: ela produz confiança sem a checagem.

**É regra, não orientação:** `tasks_entregue_exige_cada_etapa` (migration
0023) recusa marcar `entregue` enquanto alguma etapa que pede aval não tiver a
rodada **aprovada** dela própria, do escopo que ela pediu. Rodada pendente não
conta — pedir aprovação não é ter aprovação. A mensagem conta quantas faltam e
**nomeia cada uma**: "esta demanda tem etapa sem aprovação" manda a pessoa
abrir uma por uma; dizer quais é a diferença entre uma recusa e uma instrução.
Por isso `atualizarTask` concatena o `hint` do Postgres na mensagem.

A trava olha só a transição para `entregue`. Corrigir o título de uma task já
entregue, marcar que ela está esperando informação e o recálculo automático
seguem passando: uma trava que freasse tudo seria trocada por outro caminho na
primeira semana.

**A coluna foi apagada, e não aposentada como `cancelada`.** Aquele caso era
um valor de enum, que o Postgres não deixa remover; aqui era coluna, e coluna
some. Deixá-la parada manteria na tela de abertura uma pergunta que não decide
mais nada — o pior tipo de campo, porque quem responde acha que garantiu
alguma coisa.

**Exigir aval sem dizer qual não exige nada**, e a porta já estava fechada
desde a 0007: o check `subtasks_tipo_aprovacao_coerente` cobra o par inteiro
nos dois sentidos. `subtask_tem_aval()` devolve true quando o tipo é nulo — não
há escopo para procurar —, então uma etapa assim diria "exijo aprovação" e
passaria por todas as travas. A 0023 não criou trava nova para isso: criar uma
segunda dizendo a mesma coisa é criar uma segunda verdade esperando divergir.
O que faltava era o cenário que prova a regra, e ele entrou.

`tasks.link_entrega` é o endereço do material final — um só, separado das
referências de apoio. O que alguém procura semanas depois é a pasta pronta, e
achá-la no meio de oito links de apoio é o mesmo que não tê-la. Um `check` no
banco exige `http://` ou `https://`: sem ele, "ver com a Ana" digitado ali vira
um link quebrado na tela de quem for buscar.

**A pasta de entrega é obrigatória, e a pasta de quem já tem não se apaga.**
`tasks_exige_pasta_de_entrega` (migration 0015) recusa demanda nova sem ela e
recusa esvaziar a de uma task existente — trocar por outro endereço continua
valendo, porque pasta muda de lugar. Sem a trava o campo vira aquele que
ninguém preenche: quem abre a demanda está com pressa, quem procura o material
está semanas depois, e as duas pessoas raramente são a mesma.

É trigger e não `not null` porque `not null` quebraria a migration em qualquer
ambiente com task anterior a esta regra, e migration que não roda no próximo
ambiente não é migration. Preencher as antigas com um valor qualquer para poder
marcar `not null` seria pior: inventaria um endereço, e alguém clicaria nele.

#### O detalhe da Task: título, propriedades em grade, conteúdo

Título → grade de propriedades → abas (Trabalho / Histórico) → briefing,
subtarefas, referências, comentários, e as ações da demanda no fim.

**As propriedades ficam numa GRADE no topo, não numa coluna à direita.** A
coluna estreita cobrava dos dois lados: os campos espremidos num terço da
largura (o link de entrega cortado, as duas datas sem caber) e o briefing e as
subtarefas — que são o conteúdo — abrindo mão de um terço da tela para eles.

**Título e propriedades ficam FORA das abas.** Eles descrevem a demanda
inteira; trocar para o Histórico e perder de vista o nome, o cliente e o prazo
é perder o contexto do que se está lendo. Só o conteúdo troca.

**Excluir e "salvar como workflow" não são propriedades**, são ações sobre a
demanda: no meio dos campos pareciam mais dois campos. Vão para o fim da
página, que é onde se procura o que encerra alguma coisa. No painel lateral de
Minhas Tasks elas não aparecem — excluir de dentro de um painel que abriu por
cima de uma lista deixa a pessoa olhando para uma lista que ainda mostra o que
sumiu.

#### O seletor de status, nos dois níveis

`components/shared/seletor-de-status.tsx`: popover com **busca**, agrupado
(Não iniciado / Em andamento / Encerrado) e um ponto colorido por status.

**Nada aparece desligado.** Na Task porque os sete são marcáveis desde a 0025;
na etapa porque quem recusa passou a ser o banco, e a recusa dele diz o
caminho — *"A rodada é criada pela ação Enviar para aprovação"* — onde um item
cinza não dizia nada. As travas da etapa continuam todas de pé: concluir sem
aprovação, ir para "Enviada para aprovação" sem rodada, estacionar em "Em
ajustes" sem ninguém ter pedido. Mudou só onde a pessoa descobre.

O grupo dá a leitura de relance — onde a demanda está, não qual das sete
palavras é. A busca aceita Enter no primeiro resultado, que é o caminho de
quem já sabe o que quer.

**No detalhe da Task, o selo de status de cada etapa É o seletor**: quem
executa muda o próprio andamento onde já estava olhando. Na agrupadora
continua selo, e é honesto — o status dela é calculado pelas filhas e o banco
descarta o que vier escrito.

Uma checagem no carregamento do módulo estoura se algum status ficar fora de
todo grupo. Sem ela, um valor novo no enum sumiria do seletor sem erro e sem
aviso, e só apareceria no dia em que alguém fosse procurar por ele.

#### Formulário longo vai em seções numeradas

`components/shared/secao-do-formulario.tsx`. Nasceu no Nova Task e virou
compartilhado quando o pedido do Full Days passou a usá-lo — duas telas
desenhando o mesmo cabeçalho por conta própria acabariam com dois tamanhos de
círculo e dois pesos de título.

#### "+ Nova task" ABRE A TELA DE DETALHE, e não um formulário

A demanda nasce como **rascunho** no instante do clique (`publicada_em is
null`, migration 0028) e a pessoa cai na tela completa, com o cursor no
título. **Não existe um componente de criação separado do de edição** — é uma
tela só, e é isso que faz as duas nunca divergirem.

**Por que criar a linha antes de a pessoa digitar:** subtarefa, referência e
comentário precisam de um `task_id` para serem gravados. Sem a linha no
banco, a tela de criação teria que guardar tudo em memória e reimplementar
cada comportamento — e a divergência apareceria na primeira semana.

**O rascunho é de quem o criou, e de mais ninguém.** Nem o sócio: um rascunho
é um pensamento pela metade, não um documento da agência. A trava é RLS
**restritiva**, uma por tabela — e é restritiva porque permissiva é OR:
acrescentar uma policy que esconde ao lado de uma que mostra tudo não esconde
nada. Foi assim que a primeira versão deixou outra pessoa *apagar* a
referência de um rascunho que não conseguia enxergar: `task_referencias_write`
é `for all`, e um DELETE passa por ela, não pela de SELECT.

Rascunho não entra em lista, board, calendário, Minhas Tasks, contador,
relatório, notificação nem portal — e o filtro existe nos dois lugares: a RLS
esconde o dos outros, a consulta esconde o meu.

**Tudo salva sozinho**, campo a campo, com 600 ms de pausa no que é texto. O
botão **Criar task** não salva nada: ele muda uma coisa só, a demanda passa a
existir para a equipe. É aí, e só aí, que os responsáveis das etapas são
notificados — avisar a cada etapa rascunhada transformaria o sino em ruído.

**Publicar exige título, cliente e pasta de entrega**, os três numa trava só
(`tasks_publicar_exige_minimo`). Subtarefa **não** entra: publicar sem etapa
avisa e deixa seguir, porque uma demanda pode nascer antes de alguém saber
como ela se divide.

**Rascunho sem alteração há 7 dias É PARA SER apagado**, com aviso na Home no
sexto dia — e **não é**, porque a limpeza não roda sozinha e o agendamento que
ia ligá-la saiu do produto junto com a VPS. `limpar_rascunhos_abandonados()`
existe e funciona; chamá-la é ato de alguém. O aviso do sexto dia continua
certo sobre a regra e errado sobre o prazo, e é assim de propósito: ele é o
único lugar onde a pessoa vê que aquele rascunho está esquecido.

**`rascunho` não é valor de enum, e a escolha é deliberada.** O pedido trazia
`alter type task_status add value 'rascunho'`. Três razões contra: o SQL
Editor do Supabase roda o arquivo colado como uma transação só, e um valor de
enum não pode ser *usado* na mesma transação em que nasce — a migration
falharia na hora de aplicar; `rascunho` é estado do ciclo de vida e não do
trabalho, então entraria no seletor dos sete status e viraria coluna no
board; e `publicada_em` responde duas perguntas de uma vez. O **default é
publicada**: esquecer o campo cria uma demanda visível, e o erro contrário —
uma task que some para a equipe inteira — ninguém descobre.

#### O formulário de abertura tinha cinco seções numeradas

**Ele não existe mais**, e o histórico fica registrado porque a ideia pode
voltar: eram seis seções numeradas até a 0023, cinco depois que a exigência de
aprovação virou de cada etapa, e zero depois da 0028 — o diálogo inteiro deu
lugar à tela de detalhe. As seções numeradas continuam vivas no Full Days
(`components/shared/secao-do-formulario.tsx`), que é de onde o padrão saiu.

**No rascunho o status não se escolhe**, e a ausência é deliberada: ele ainda
não faz parte do trabalho de ninguém, e oferecer os sete seria oferecer uma
escolha sobre uma demanda que não existe para a equipe. Ela começa em
"Iniciar" no instante em que for criada.

Link de referência entra num campo da tela, **nunca num `window.prompt`**: o
prompt não dá para colar no teclado do celular, não valida nada, some ao
clicar fora, e em alguns navegadores simplesmente não abre — o botão vira um
botão que não faz nada.

O botão que cada pessoa vê sai de `lib/tasks/state-machine.ts`, e é o mesmo
componente (`components/shared/acoes-da-subtarefa.tsx`) no detalhe da Task, em
Minhas Tasks e na fila de aprovações. Três telas respondendo a mesma pergunta
por conta própria acabariam oferecendo "Concluir" onde o banco recusa.

> **Decisão em aberto, e onde revertê-la:** aprovar e enviar ao cliente está em
> `is_gestor()` — desenvolvedor **e** sócio. A regra-mestra fala só do
> Desenvolvedor; o sócio entrou porque tem acesso total ao painel e travá-lo
> fora da fila pararia a agência num dia em que ele estivesse fora. Para
> restringir, troque
> `is_gestor()` por `auth_role() = 'desenvolvedor'` em
> `pode_aprovar_subtarefa()` (migration 0007) e `exigirGestorNaAcao` por uma
> checagem de role em `gestao-tasks/acoes-de-aprovacao.ts`. São os dois pontos.

### O Calendário Full

`/painel/calendario` — migration 0055. Até ele o produto tinha DOIS
calendários parciais: o de Gestão de Tasks (prazo de demanda e de etapa, post
e campanha) e o do Full Days (quem está fora). Nenhum dos dois respondia a
pergunta que a agência faz toda segunda: **"o que acontece nesta semana, e
quem está disponível para fazer?"**

**Tudo sai de UMA view, `calendar_events`**, que junta OITO origens num
formato só: demanda, etapa, ausência, evento, post, **etapa de post**,
campanha e entregável. A oitava entrou na 0059, e entrou exatamente como este
parágrafo dizia que entraria: um `union all` a mais. Nenhuma tabela de evento
agregado: uma tabela que copia prazo de etapa, data de post e período de
campanha precisa ser reescrita por sete caminhos para continuar verdadeira, e
no dia em que um deles falhar o calendário mente sem avisar. É a mesma razão
pela qual bloqueio de subtarefa não é status e atraso do Financeiro não é
coluna.

**`security_invoker = true` é a linha mais importante da migration.** Uma
view comum no Postgres roda com os direitos de QUEM A CRIOU — o superusuário
da migration —, e sem essa cláusula a `calendar_events` lê as sete tabelas
inteiras para qualquer pessoa autenticada, furando a RLS de todas de uma vez
num objeto que o PostgREST publica sozinho. **E o furo passa despercebido num
banco com um cliente só:** ele vê seis campanhas, que é o total, e "seis de
seis" tem a mesma cara com a RLS ligada e desligada. Por isso a bateria cria
material de DUAS empresas — tirando a cláusula, seis cenários falham e dizem
o que vazaria.

**O rascunho é filtrado nos dois lugares**, como manda a regra: a RLS
restritiva esconde o dos outros, e `publicada_em is not null` na view esconde
o meu. E **`rascunho` e `cancelada` não existem como status** — o sprint
filtrava por eles, e `rascunho` nem é valor do enum: o Postgres recusaria a
criação da view, com um erro falando de enum e não de rascunho.

#### As quatro visões, e o que cada uma responde

| Visão | A pergunta |
| --- | --- |
| Mês | o que acontece quando |
| Semana | a mesma coisa, com espaço para o texto caber |
| Linha do tempo | **a equipe aguenta?** |
| Lista | me manda isso (CSV) |

**A campanha entra pelo ENCERRAMENTO na grade do mês e como BARRA na Linha do
Tempo**, e a view carrega o período inteiro. São as duas metades da mesma
decisão: a view guarda a verdade, e `diaNaGrade()` em
`lib/dominio/calendario.ts` é o único lugar onde a escolha de desenho mora.
Com ela espalhada, a grade e a lista discordariam sobre em que dia a mesma
campanha está.

**O que atravessa dias vira faixa no topo da semana**, e não item da lista de
cada dia: uma feira de três dias listada dia a dia são três linhas que a
pessoa junta de cabeça, competindo com os prazos daquele dia. E **sempre seis
semanas**, senão a grade muda de altura ao trocar de mês e a página pula.

**Na Linha do Tempo a coluna de nomes é fixa**, e ela quase não foi: o
invólucro tinha `overflow-hidden` para arredondar as pontas, e `overflow:
hidden` cria um novo scrollport — o `sticky` passa a se medir por ele e a
coluna sai da tela junto com os dias. Foi a imagem que mostrou, com "Carla
Nunes" lida como "nes".

**A cor da célula ali é OCUPAÇÃO, não camada**, e por isso a visão tem
legenda própria. `carga_da_equipe()` percorre e CHAMA `carga_do_dia()`, que é
a fonte única desde a 0035 — uma chamada por célula seriam trezentas idas ao
banco para desenhar uma tela, e uma segunda conta daria dois números para a
mesma pessoa no mesmo dia. A capacidade é `team_members.capacidade_minutos_dia`,
por pessoa: meio período existe, e mudar contrato não pode exigir deploy.

**A ausência chega com a chave do enum no título**, e a tela não pode
mostrá-la crua: a view escreve `h.tipo::text`, que é `ferias` — a camada em
inglês que ficou como estava quando a 0016 trocou o vocabulário. Desenhar
isso poria na tela a palavra que o produto tirou de propósito, e
`check:cores` não pegaria, porque ele procura as formas ACENTUADAS. A
tradução passa por `ROTULOS_DE_TIPO`, o mesmo mapa do Full Days.

#### Eventos

`events` e `event_participants`: convenção, feira, lançamento, reunião,
treinamento, feriado de cliente. **Quem abre é `is_atendimento()`**, a mesma
função que `tasks_insert` usa desde a 0006 e que `campaigns_insert` passou a
usar na 0054 — quem abre a demanda de hoje é quem sabe que a feira é semana
que vem.

**Sem participante, o evento é da agência inteira** — e não de ninguém. Ler
"sem participantes" como "ninguém" é o erro natural, e deixaria a convenção
sem bloquear nada; a bateria guarda os dois sentidos.

**A lista de participantes é de quem organiza, não de quem participa:** sem
essa trava, quem não quer ir se tira da convenção apagando a própria linha, e
o evento passa a valer só para os que sobraram.

**`bloqueia_ferias` entra pela mesma porta do bloqueio por área no Full
Days**, devolvendo a mesma forma — dia e nome. Duas listas de bloqueio com
dois formatos dariam duas frases de recusa diferentes na mesma tela.

**O cliente não alcança evento nenhum**, nem o da própria empresa: o Portal
mostra material enviado, não a agenda interna da agência.

#### O que cada perfil vê, e o arrasto

**O colaborador abre em "só minha pauta"; a gestão, na agência inteira.** O
padrão vem do perfil, mas **o valor vai para a URL nos dois sentidos** — sem
isso, o mesmo link mostraria coisas diferentes para o sócio e para o redator,
que é a pior forma de um link mentir.

**"Só minha pauta" inclui o que é da agência.** Ele responde "o que eu
preciso saber hoje", e a convenção da semana que vem é parte disso mesmo não
tendo o meu nome.

**Arrastar uma etapa muda o prazo dela, com desfazer.** Só a etapa arrasta: o
período da demanda é derivado e se recalcula sozinho, a campanha tem período
combinado, e a ausência é decisão do sócio — oferecer o arrasto neles
prometeria uma mudança que o banco desfaz ou recusa. **É arrasto nativo e não
dnd-kit, com o custo dito:** ele não responde a toque, e no celular a data se
muda abrindo a etapa.

**As camadas são links, e não caixas com estado no `localStorage`.** Com as
duas fontes, a tela abriria com a camada que o link diz e trocaria sozinha um
instante depois para a que o navegador lembrava.

### Dependências

Uma subtarefa pode depender de outras da mesma Task. Enquanto a dependência não
estiver `concluida`, ela não sai de `nao_iniciada` — o trigger recusa, e a tela
mostra o cadeado com o que está faltando. Ciclo (A → B → A) é recusado na
criação, com mensagem explicando por quê.

Bloqueio **não é status**: é derivado das dependências. Guardar como status
criaria dois lugares para a mesma verdade.

### Workflows

**Chama-se WORKFLOW, e só isso.** Um workflow — "Post de feed", "Campanha" —
CARREGA a cadeia fixa de etapas que toda demanda daquele tipo de trabalho
percorre. No banco são duas tabelas (`task_types` guarda o nome e o alcance,
`workflow_templates` + `workflow_steps` guardam as etapas) porque em tese dois
modelos poderiam compartilhar uma cadeia, mas isso é detalhe de armazenamento:
**a tela nunca mostra a divisão, e as duas são gravadas juntas pela mesma
ação.**

O produto falou dois nomes para a mesma coisa até o Sprint 9: o menu e a rota
diziam Workflows, o formulário de abertura e a tela de gestão diziam "tipo de
tarefa". Quem usava tinha que descobrir sozinho que era a mesma coisa.
`npm run check:cores` varre `src/` atrás do nome antigo para ele não voltar —
os nomes de tabela ficam como estão, porque são a camada em inglês.

Eram duas abas até o Sprint 3C, e ninguém entendia por quê — com razão. Dava
para criar o modelo sem a cadeia (a task nascia vazia) ou a cadeia sem o modelo
(ninguém conseguia escolher, porque o formulário de nova task lista modelos).

- O prazo da etapa é `prazo_offset_dias`, contado do início da Task. Data fixa
  num modelo reutilizável faria toda demanda nova nascer vencida.
- A etapa guarda a **função** ("Design"), não só a pessoa: modelo amarrado a um
  nome envelhece na primeira troca de equipe.
- **Snapshot:** ao aplicar, as subtarefas são materializadas e uma cópia do
  fluxo vai para `tasks.workflow_snapshot`. Editar o workflow depois não muda
  nenhuma Task existente.
- Criar Task sem workflow e montar as etapas à mão é caminho de primeira
  classe, não plano B.
- "Salvar as subtarefas desta task como workflow" grava o **modelo** junto com
  a cadeia. Gravar só a cadeia deixava o resultado inalcançável.

### Demandas recorrentes

`task_recurrences` guarda a regra, `recurrence_runs` guarda cada execução —
migration 0040. É o que faz o stories de toda segunda e o relatório de todo
dia 5 nascerem sozinhos, em vez de alguém abrir a mesma demanda doze vezes
por ano.

**A aba mora em `/painel/workflows`, ao lado dos workflows**, e a proximidade
é o argumento: um workflow é a cadeia de etapas que a demanda percorre; uma
recorrência é a regra que abre essa demanda na data — e no modo "task por
ocorrência" ela escolhe um workflow como modelo. Em rotas separadas, a pessoa
montaria a cadeia num lugar e procuraria onde ligá-la noutro.

**Quem configura é `is_atendimento()`**, a mesma pergunta que `tasks_insert`
faz desde a 0006: uma recorrência é uma demanda que ainda não aconteceu, e se
o Atendimento abre a de hoje, configura a de todo mês.

#### São DOIS modos, e a diferença é o que vira uma task

| Modo | O que nasce | Para quê |
| --- | --- | --- |
| `mensal_agrupada` | uma task por mês, com uma etapa por dia | trabalho diário |
| `task_por_ocorrencia` | uma task inteira a cada repetição | quando cada repetição tem etapas próprias |

O primeiro existe porque sem ele o board da agência teria vinte e duas linhas
do mesmo trabalho por mês, por cliente — e o andamento de "stories de
outubro" não caberia em nenhuma delas.

#### A idempotência é o ÍNDICE ÚNICO, nunca uma consulta

`recurrence_runs (recurrence_id, chave_ocorrencia)` é único, e
`gerar_ocorrencia()` **insere a execução primeiro**, com `on conflict do
nothing returning id`. Sem linha de volta, outra execução chegou antes e esta
desiste sem tocar em nada.

Um `select` antes do `insert` teria passado nos mesmos cenários e falhado na
vida real: duas abas clicando em "Gerar agora" ao mesmo tempo passam pelas
duas consultas antes de qualquer uma gravar. **A bateria mede o índice, e não
só o resultado** — chamadas sequenciais passam pelas duas implementações, e um
teste que não separa a certa da errada é um teste que afirma sem provar.

**Pausar não apaga o futuro**, e é por isso que a recusa de regra pausada
(0041) vem **antes** do insert da execução. Gravá-la como `pulada` consumiria
a chave, e ao retomar a regra aquele período apareceria como já gerado.

#### Nunca retroativo, e a geração não roda sozinha

`proximo_periodo_da_recorrencia()` conta do período corrente para a frente —
criar ou reativar uma regra não faz nascer o que não aconteceu. E
`gerar_recorrencias()` é chamada por alguém: o agendamento é de outro sprint,
como a limpeza de rascunhos.

**O `exception` fica DENTRO do laço.** Uma regra que falha não pode levar
junto as outras dezenove daquela madrugada — o erro vira linha no histórico
dela, e a próxima regra continua.

#### O responsável padrão é FALLBACK, nunca substituição

`modelo->>'responsavel_padrao'` (migration 0041, decisão do usuário) preenche
a etapa que não tem dono — `coalesce(etapa, padrão)`, nessa ordem. Quem
escreveu o nome na etapa mandou.

Ele existe por causa de dois caminhos em que ninguém preenche etapa por etapa:
a regra que parte de um workflow, cujos passos podem não ter responsável
padrão, e a regra montada às pressas. Nos dois, a rotina criava a demanda com
as etapas órfãs — e **etapa sem dono não aparece no "Minhas Tasks" de
ninguém**: ela existe no board da agência e mais nada. É o pior tipo de
trabalho gerado automaticamente, o que ninguém sabe que nasceu.

A ordem invertida transformaria o campo numa arma: preencher a regra apagaria
a distribuição que alguém montou etapa por etapa. **A bateria guarda o
cenário que impede a inversão** — ele é o único que falha se o `coalesce`
trocar de lado.

E **mora no banco e não na tela**: a tela poderia copiar o padrão para cada
etapa ao salvar, e o resultado pareceria o mesmo. Mas aí o modelo gravaria o
nome repetido, e trocar de responsável exigiria mexer numa etapa por vez —
quando o que a pessoa quer dizer é "a partir de agora, é a Marina".

#### A prévia das cinco próximas é a razão do formulário ter este formato

Uma recorrência é a **única coisa no produto que cria trabalho sozinha**, de
madrugada, sem ninguém olhando — e quem a configura não tem outro jeito de
conferir o que escolheu antes de salvar. Sem a prévia, o primeiro retorno de
uma regra torta chega no dia em que alguém abre o board e vê doze demandas com
o mesmo título.

Ela recalcula **a cada tecla**, no navegador, e é por isso que
`proximasOcorrencias()` existe em TypeScript ao lado de
`datas_da_recorrencia()` no Postgres — como `situacaoDoLancamento()` no
Financeiro. Uma chamada por tecla não é pré-visualização, é latência.

**Em 375px a prévia vem ANTES dos botões**, e por isso as ações são o terceiro
filho da grade em vez do fim da coluna do formulário: empilhadas, o "Criar
recorrência" ficava acima dela e dava para salvar sem nunca ver as cinco
próximas. Foi a imagem de 375px que mostrou — no 1440 as duas colunas
escondiam o problema.

**E o editor não salva sozinho**, ao contrário da tela de task. Lá o rascunho
é de quem o criou e não existe para mais ninguém; aqui cada salvamento parcial
mexe no que a rotina vai gerar na madrugada seguinte, e uma das configurações
intermediárias pode ser a que ela encontra.

#### "Transformar em recorrente" abre o editor, e não grava nada

É obrigatório que seja assim: **uma task não sabe a cadência dela.** Ela tem
um período, não uma frequência, e "toda segunda" ou "todo dia 5" é exatamente
a informação que não está lá. Uma ação que salvasse direto teria que
inventá-la, e a regra passaria a gerar no ritmo que o sistema chutou.

`modeloDeUmaTask()` copia **só as folhas** — a agrupadora é o agrupador de
quem tem filha, e copiá-la criaria no modelo uma etapa que nasce sem trabalho
e conta duas vezes no tempo. A dependência não viaja: ela aponta para uuid e o
modelo grava posição, numa tela em que a pessoa ainda vai mexer na ordem.

#### O que a regra NÃO faz, e é decisão

- **Não propaga edição de volta.** Editar a task gerada não muda a regra, e
  editar a regra não muda o que já saiu.
- **Não reatribui responsável por causa de recesso.** `aviso_do_responsavel()`
  escreve no histórico que a pessoa está fora; quem decide a troca é o
  Atendimento.
- **Não apaga o que já gerou.** `recurrence_id` é `on delete set null`: as
  demandas são trabalho de verdade, com comentário, tempo lançado e aprovação.
  Apagar a regra apaga o que ainda não aconteceu.
- **Não gera pausada, nem pelo botão** (0041). "Gerar agora" some da regra
  pausada e o banco recusa junto — oferecê-lo ao lado de *"nada mais é gerado
  até você retomar"* é a tela desmentindo a si mesma.

**A pessoa desligada não vira responsável, e a geração não trava por isso.** A
regra sobrevive à saída de quem estava nela: as demandas continuam nascendo, e
sem dono, que é visível. Travar deixaria o cliente sem entrega por causa de um
desligamento.

**O limite por task corta e não recusa.** Um período com mais ocorrências que
o limite gera as primeiras e diz no histórico que cortou — recusar a
ocorrência inteira deixaria o mês sem nada, que é pior que um mês incompleto
e anotado.

### A etapa tem período, e não só prazo

`subtasks.data_inicio` + `subtasks.prazo` (migration 0027). Duas etapas com o
mesmo prazo podem ser uma de três dias e uma de três horas — sem o início,
quem monta a agenda da semana tem metade da informação.

**O fim continua se chamando `prazo`**, e não virou `data_fim` por simetria
com `tasks`: ele é lido em consulta, trigger, tela e relatório, e renomear
coluna em uso é migration arriscada sem nada em troca. Período invertido é
recusado pelo check `subtasks_periodo`.

**Os dois são opcionais**, e é caso normal: quem abre a demanda costuma saber
a data de entrega e ainda não saber quando cada etapa começa. Exigir as duas
faria a pessoa inventar uma.

**Atraso continua sendo do `prazo`**, e o calendário continua mostrando só
ele. Começar tarde não é atrasar; entregar tarde é. E uma barra por data
dobraria os itens do mês — o início aparece no detalhe da etapa, que é onde
alguém pergunta "quando isso começa?".

### Tempo, sempre em minutos

`estimativa_minutos` e `tempo_real_minutos`, inteiros. A tela mostra "2h 30min"
e aceita `2h30`, `2,5h`, `150` e `90min` — a conversão é de
`lib/dominio/tempo.ts`. Hora decimal é uma conta que a pessoa faz de cabeça
antes de digitar, e arredondamento transformava "vinte minutos" em 0,33 e de
volta em 19,8.

#### O cronômetro mede; a pessoa declara

**São dois números e duas colunas, e juntá-los estraga os dois.**
`tempo_medido_segundos` + `andando_desde` (migration 0021) são o relógio;
`tempo_real_minutos` é o que a pessoa afirma ao concluir. O diálogo abre
**pré-preenchido com o medido** para conferir ou corrigir — o medido nunca é
gravado sozinho, porque um relógio não sabe a diferença entre oito horas de
trabalho e a noite em que alguém esqueceu a etapa em andamento.

**O relógio só corre em `em_andamento`.** Pausa em "Aguardando informações" —
esperar não é trabalhar —, para em "Enviada para aprovação" e em "Concluída", e
volta a correr quando a etapa volta depois de um pedido de ajustes. Contar de
ponta a ponta somaria as noites, os fins de semana e os dias parados esperando
o cliente.

**Quem escreve as duas colunas é o trigger `subtasks_cronometro`, nunca o
cliente.** Policy não limita coluna: sem ele, um PATCH no PostgREST diria que a
etapa levou oito horas. O trigger reescreve as duas a partir do que já estava
gravado e do relógio do servidor, e descarta o que vier no pedido — e por isso
as duas ficam **fora** de `Insert` e de `Update` em `database.types.ts`, para
tentar gravá-las ser erro de tipo antes de ser recusa do banco.

**Em segundos, e não em minutos como o resto da casa.** A regra dos minutos
vale para o que a pessoa digita e para o que a tela mostra. Esta coluna é
escrita por máquina, e arredondar cada passagem para o minuto perderia as
sobras: dez idas e voltas de 40 segundos viram zero ou dez minutos conforme o
arredondamento.

`tempo_medido_da_subtarefa()` no Postgres e `minutosMedidos()` em
`lib/dominio/tempo.ts` são o mesmo cálculo nos dois lados, como
`situacaoDoLancamento()` no Financeiro: a tela precisa do número andando a cada
segundo, e não dá para perguntar ao banco a cada segundo.

**O relógio fica à vista** (`components/shared/cronometro.tsx`), no detalhe da
Task e em Minhas Tasks. Um cronômetro que ninguém vê é um número que aparece
pronto no diálogo de conclusão, sem a pessoa ter como saber de onde veio — e
sem reparar que esqueceu a etapa aberta. O primeiro valor sai do relógio do
**servidor** e o navegador continua dali; acima de
`HORAS_ATE_DESCONFIAR` (8h) o diálogo avisa antes de alguém confirmar por
reflexo.

### Identidade visual

#### A marca é o arquivo da agência, não um desenho parecido

O símbolo — disco, ponto e triângulo — vive em `components/shared/logo.tsx`
como **SVG à mão**, e a geometria foi *medida* no PNG original: disco de raio
inteiro, ponto em (544,5 / 320,4) com raio 88,6, triângulo de traço 19 com os
vértices calculados a partir da caixa externa e do recuo de esquadria. A
conferência não é de olho: o SVG foi rasterizado no Chromium e comparado pixel
a pixel com o arquivo entregue — as três formas batem dentro de 1px, e o que
diverge é serrilhado de borda. Os quatro arquivos que a agência mandou ficam
em `public/marca/`, e é lá que se confere.

**É SVG e não PNG pelo mesmo motivo dos gráficos:** a cor precisa sair dos
tokens. Um PNG traria três cores literais para dentro da interface e
congelaria a versão — e a marca tem **duas**, disco escuro com ponto azul e
triângulo branco, e disco azul com ponto branco e triângulo cinza. Qual delas
aparece é decisão de fundo, e decisão de fundo mora no `globals.css`:
`--marca-disco`, `--marca-ponto` e `--marca-traco` trocam juntas no tema
escuro, onde o disco #15242C sobre #1F2227 daria 1,1:1 e sumiria. A barra
lateral é escura nos **dois** temas e não acompanha a página, então ela marca
`data-marca="azul"` e as mesmas três variáveis trocam — um seletor, não uma
terceira versão do símbolo.

**"Full Hub" continua tipográfico, e é de propósito:** o símbolo é da Full
Connect Key, "Full Hub" é o nome do produto. Não existe wordmark de Full Hub,
e desenhar um seria pôr no ar uma marca que a agência não fez.

**O wordmark "full connect key" aparece uma vez, no painel escuro da tela de
login.** Ele é um lockup fechado — três linhas que se encaixam, com o próprio
símbolo dentro —, não uma linha de assinatura: embaixo de "Full Hub" ele
repetia o disco que estava logo acima e disputava o mesmo espaço, e abaixo de
uns 24px de altura as linhas fecham e ele vira um borrão. Nos lockups pequenos
a assinatura é "FULL CONNECT KEY" em caixa alta espaçada, que se lê a 9px. A
coluna escura do login existe justamente para dar a ele a largura em que as
três linhas se leem.

**A versão branca veio cortada na primeira entrega**, e foi o usuário quem
viu: 833 × 428 contra 833 × 454 da colorida — 26px a menos embaixo, o "y" e o
triângulo pela metade. O arquivo certo tem a mesma proporção da colorida, e é
assim que se confere um: pela caixa do conteúdo, não de olho.

**No painel escuro usa-se só a branca**, sem troca por tema: o fundo é
`--brand-navy` nos dois temas, como a barra lateral. Onde as duas versões
convivessem seriam duas imagens e não um filtro CSS — clarear a colorida por
`filter` daria cinza lavado no lugar do branco e apagaria o azul junto.

**`src/app/icon.svg` é o TERCEIRO arquivo com cor literal**, e a exceção está
registrada em `check:cores` — que passou a varrer `.svg` dentro de `src/` por
causa dele. O navegador serve o ícone da aba sozinho, sem a folha de estilo do
app, então não existe `var(--marca-disco)` para ele ler; a troca por tema vive
num `prefers-color-scheme` dentro do próprio arquivo. Deixá-lo fora da
varredura faria a regra dizer que só há dois lugares com cor literal, e o
terceiro ficaria invisível.

#### A tela de login: painel da marca, formulário, e dois botões que não decidem

`components/auth/casca-de-autenticacao.tsx` envolve as quatro telas de
`(auth)` — login, esqueci-senha, redefinir-senha e trocar-senha. Coluna escura
à esquerda com o símbolo, o nome do produto e o wordmark; formulário à
direita, sem cartão, porque o painel já é o enquadramento. Em 375px a coluna
vira uma faixa curta no topo: metade de uma tela de celular gasta com marca é
meia tela a menos para digitar.

**O seletor "Cliente / Colaborador" NÃO decide o login, e é decisão do
usuário que exista assim mesmo.** Quem decide para onde a pessoa vai é o
perfil gravado em `profiles` — `rotaInicialDoRole()` manda `cliente` para
`/portal` e o resto para `/painel`, qualquer que tenha sido o botão clicado.
Fazer o seletor valer de verdade criaria um jeito novo de falhar na porta
("opção errada") e contaria a quem estivesse tentando se um e-mail é de
cliente ou da equipe.

**O que ele faz de verdade é trocar a frase do painel**, e é isso que o separa
de um enfeite: quem chega vê, antes de digitar, o que aquela porta abre para
ele. E a linha embaixo dos botões diz o resto em voz alta — *"os dois entram
pelo mesmo formulário: o Full Hub reconhece você pelo e-mail"*. Sem ela, quem
clicasse em "Colaborador" e caísse no portal concluiria que o sistema errou, e
a agência responderia a essa pergunta toda semana.

O seletor mora ao lado do painel que ele muda, num arquivo só, e a tela de
login o posiciona por um contexto: são as duas metades da mesma decisão, e
separadas divergiriam na primeira mudança de texto. A escolha **não** é
lembrada no navegador — o cliente costuma entrar de computador compartilhado,
e a tela abriria com a frase do outro público.

Duas cores da Full Connect Key, e só: o cinza `--brand-gray` e o azul claro
`--brand-blue`. Todo o resto é derivado ou neutro, e **`src/app/globals.css` é
o único arquivo com cor literal** — os nomes do shadcn (`--primary`, `--muted`,
`--border`) apontam para os tokens da marca, e é isso que faz a interface
inteira mudar sem tocar em componente.

**A regra que não se quebra:** texto branco sobre `--brand-blue` dá 1.7:1. Em
uma frase — *azul claro pede texto escuro; texto branco pede azul escuro.*

- botão primário = fundo `--brand-blue` + texto `--text-primary`;
- link e ícone em fundo claro = `--accent-strong`, que é "o azul legível no
  tema de agora": azul escuro no claro, azul da marca no escuro;
- item ativo na barra lateral escura = `--brand-blue`, que é onde essa cor
  funciona como texto;
- fundo cheio de cor + texto branco = `--blue-strong`.

Selo de estado usa o **par nomeado** (`bg-warning-soft text-warning`), nunca
`bg-warning/10`: opacidade sobre um fundo qualquer dá uma cor que ninguém
mediu, e no tema escuro dá outra.

Prioridade **Normal é cinza**. Era azul, e azul numa tela cujo destaque é azul
fazia a prioridade mais comum competir com Alta e Urgente.

**A busca de nome morto não passa pelo `grep -i`, e a razão é um furo que ela
teve desde que a lista ganhou palavra com acento.** `grep -i` faz case-fold
pelo **locale**: com `LC_CTYPE=POSIX` — o padrão de muito container — ele
dobra só ASCII, então "VOCÊ" nunca casava com "você" e metade da lista
passava em branco. O sintoma foi o pior possível: a varredura dizia "ok, não
aparece em lugar nenhum" numa máquina e **falhava no CI para o mesmo
commit**. Hoje quem compara é `toLowerCase()` do JavaScript, que dobra acento
pelo Unicode em qualquer sistema; o `grep` só acha os arquivos. Uma checagem
cujo trabalho inteiro é afirmar que um nome não existe não pode depender de
variável de ambiente para saber ler.

`npm run check:cores` é a prova: mede 34 pares texto/fundo nos dois temas
(mínimo 4.5:1 normal, 3:1 grande e elemento de interface), acusa hex fora do
arquivo de tokens, confere se toda classe de cor existe no `@theme inline` —
no Tailwind v4 um utilitário desconhecido não dá erro, só não gera CSS, e a
tela fica sem a cor sem ninguém notar — e varre o projeto atrás de nome que
saiu do produto, porque "esse nome não existe mais" é um critério que precisa
ser verificado toda vez, não uma vez.

### O Portal do Cliente

A segunda área. O cliente entra, vê o que a Full enviou, e decide.

**Ele vê apenas o que foi enviado explicitamente.** Rascunho não, conversa
interna não, outro cliente não. As três camadas de sempre valem, e a que conta
é a terceira: `tasks_select_cliente`, `subtasks_select_cliente` e
`approval_rounds_select_cliente` recusam no banco. A consulta de
`lib/dados/portal.ts` não repete o filtro por empresa para o próprio cliente —
repetir seria criar um segundo lugar onde a regra pode divergir. O parâmetro
`clienteId` existe só para a visualização administrativa, onde quem pergunta é
da equipe e enxerga todos.

**Múltiplos usuários por empresa têm o MESMO acesso.** Não há hierarquia do
lado do cliente: os dois aprovam, os dois comentam. Quem entra e quem sai é
decisão da agência, e por isso a aba "Quem tem acesso" não tem botão nenhum —
só a frase que diz a quem pedir.

#### A rodada de aprovação não é mais só da subtarefa

`approval_rounds` aponta para `(content_type, content_id)` — migration 0030.
Post e entregável de campanha passam pela mesma decisão que a etapa já passa,
e a alternativa era um segundo fluxo de aprovação ao lado deste. É a
duplicação que o produto já desfez uma vez.

**`subtask` é o único tipo que existe hoje, e o banco RECUSA os outros dois.**
Não por esquecimento: `validar_nova_rodada` e `decidir_rodada_do_cliente`
param em `subtask_da_rodada()`, e as policies exigem `content_type =
'subtask'`. Um tipo que nenhuma trava sabe conferir não pode nascer visível ao
cliente — e `pode_aprovar_subtarefa()` ignora o parâmetro desde a 0029, então
sem esse filtro uma rodada de post seria decidida por qualquer gestor sem
checagem nenhuma de a quem ela pertence.

**O cascade foi reposto por trigger.** `subtask_id` tinha `on delete cascade`;
`content_id` não pode ter chave estrangeira, porque aponta para tabelas
diferentes conforme o tipo. Sem `subtasks_limpa_rodadas`, apagar uma etapa
deixaria rodadas órfãs e a fila tentaria mostrar a etapa que não existe mais.

Em TypeScript o par mora em `lib/aprovacoes/conteudo.ts`, e o motor inteiro
passa por `rodadasDo()` — um lugar só nomeia as colunas.

#### Social Media: o calendário e a decisão do post

`posts`, `post_versions` e `comments` — migration 0032. O post nasce na
produção, ganha versões, é enviado ao cliente e ele decide.

**O cliente só enxerga post ENVIADO, e isso mora na policy.**
`posts_select_cliente` exige `enviado_em is not null`, e é essa linha que
impede um post em produção de aparecer — no calendário, em `/portal/social-media/{id}`
com o id na mão, e na API do Supabase chamada direto. A consulta de
`lib/dados/posts.ts` não repete o filtro: o segundo lugar é sempre o que
esquece.

**Enviar ao cliente É abrir a rodada de escopo cliente.** `posts.enviado_em` é
consequência dela, pelo trigger `approval_rounds_marca_post`, e não um segundo
comando. Separados, daria para ter rodada de cliente num post que ele não
enxerga — a fila mostraria uma decisão impossível — e post carimbado sem
rodada nenhuma, com o cliente vendo material sem ter onde decidir.

**São TRÊS decisões, e a terceira é nova.** `status_rodada` ganhou
`rejeitada`: "solicitar ajustes" diz *mude isto e volte*, "rejeitar" diz
*não*. Reaproveitar `ajustes_solicitados` para os dois faria a rodada afirmar
uma coisa e o post outra sobre o mesmo fato. Os dois desfechos negativos
exigem motivo, na ação e no banco — "rejeitado" sem uma linha dizendo por quê
manda a equipe adivinhar, e a próxima versão sai igual.

**`rejeitada` NÃO vale para etapa de demanda.** O fluxo dela tem dois
desfechos desde a 0007 e não existe `subtask_status` que signifique recusada;
inventar um criaria um estado que nenhuma tela sabe desenhar. A recusa diz o
que fazer no lugar.

**`comments.interno` é forçado por trigger, e o autor também.** Policy não
limita coluna: sem `comments_normaliza`, um PATCH montado à mão esconderia o
próprio comentário do cliente ou o assinaria com o nome de outra pessoa. O
trigger reescreve em vez de recusar — o campo nem aparece na tela dele — e só
quando há sessão: sem `auth.uid()` quem escreve é o seed, e apagar o autor que
ele informou foi o primeiro bug deste módulo.

A thread tem **um nível**, como a das Recomendações, e o banco corrige a
resposta de resposta em vez de recusá-la.

**A rede aparece como SIGLA de duas letras, não como logo.** O lucide-react
tirou os ícones de marca; um ícone genérico não distingue Instagram de
Facebook, que é o que o selo precisa dizer; e desenhar os logos traria marca
registrada e a cor literal de cada uma para um projeto em que
`src/app/globals.css` é o único arquivo com cor literal. O nome por extenso
viaja no `title` e num `sr-only`.

**O status nunca é só a cor.** Os sete estados cabem em cinco tons medidos —
"em produção" e "aguardando aprovação" dividem o azul, "aguardando
informações" e "stand by" dividem o cinza. A legenda do calendário AGRUPA os
que dividem a cor, em vez de mostrar sete linhas e cinco cores, e o nome exato
vai no `title` e no rótulo acessível de cada card.

**O calendário é de servidor inteiro.** Mês, visão (calendário ou lista), dia
aberto e filtros moram na URL, como em toda listagem do produto — "olha o dia
15" precisa ser um link. Em 375px a grade vira lista por dia, por CSS e não
por medir a janela: sete colunas em 375px dão 50px por dia, e 50px não cabem
miniatura, rede e tema.

**No detalhe, a ordem da tela é a ordem da decisão:** arte grande, informações,
legenda, e só então os botões. Botão antes da arte convida a aprovar sem
olhar. O visualizador dá zoom de verdade (roda, pinça e botões) porque quem
aprova precisa ler o rodapé pequeno e ver se o logo ficou pixelado — é o
pedido de ajuste mais comum. "Solicitar ajustes" fica à vista e não dentro de
"Comentar": é a ação mais frequente, e escondida ela vira um comentário que
ninguém trata como pedido.

**O histórico de versões não tem botão de reverter, em lugar nenhum do
portal.** Reverter muda o que vai ao ar, e quem responde por isso é a agência.
A trava não é a ausência do botão: o cliente não tem policy de escrita em
`post_versions`, e a bateria prova isso com o comando cru.

**O post entra no calendário da agência** (`itensDoCalendario`), com a data de
PUBLICAÇÃO — lá a pergunta é "o que vai ao ar quando". Ele abre a visualização
do portal daquele cliente, que é a tela que existe hoje; a de produção é de
outro sprint.

#### O lado da agência: a corrente de mão em mão

`/painel/social-media` — migration 0042. Até ela o Portal estava pronto e o
lado de cá não existia: para um post chegar ao cliente, alguém colava SQL no
Supabase por um script que o próprio cabeçalho mandava apagar no dia em que a
tela existisse. Ela existe, e ele foi apagado.

**São TRÊS mãos, e é decisão do usuário:** *"essa aba de social media tem que
ser criada por um desenvolvedor ou sócio, liberada para o colaborador que for
fazer o conteúdo e os layouts, e quando finalizada enviada para o cliente"*.

| Mão | Quem | O que faz |
| --- | --- | --- |
| Briefing | gestão | abre o post: cliente, data, rede, mídia |
| Produção | o colaborador liberado | arte, slides, legenda |
| Revisão | gestão | o aval interno |
| Cliente | ele | aprova, pede ajustes ou rejeita |

A mão é **derivada, nunca gravada** — `maoDoPost()` em `lib/dominio/posts.ts`,
pela mesma razão que bloqueio de subtarefa não é status e atraso do Financeiro
não é coluna: ela depende do responsável, do carimbo de envio e da rodada, e
uma coluna precisaria ser reescrita por três caminhos para continuar
verdadeira.

**O módulo é de `is_staff()` e não da gestão**, ao contrário de quase tudo na
seção Gestão do menu: quem produz precisa chegar ao post que foi liberado para
ele. O que ele não pode é a RLS que recusa — esconder o módulo dele seria
esconder o trabalho dele.

##### O SPRINT QUASE VIROU DO AVESSO A TRAVA QUE PROTEGE O CLIENTE

`validar_nova_rodada` recusa desde a 0032 que o dono do post o envie ao
cliente, e perguntava quem é o dono olhando **`posts.criado_por`**. Com a
gestão abrindo o briefing, `criado_por` passa a ser ela — e as duas travas
ficariam invertidas:

- *"Só quem produziu o post envia para aprovação"* passaria a olhar a gestão, e
  o colaborador que fez não conseguiria pedir o aval interno;
- *"Ninguém envia ao cliente a própria entrega"* compararia com a gestão, e o
  responsável que produziu **poderia** mandar a própria entrega.

Por isso a 0042 traz `dono_do_post()`, que é
`coalesce(responsavel_id, criado_por)`. O `coalesce` é o que mantém de pé o
post aberto antes dela, em que quem criou foi quem produziu. **A bateria guarda
o cenário virado do avesso**: se alguém devolver `criado_por` ali, "Quem
produziu pede o aval interno" falha e diz qual.

##### A MÍDIA não é o `formato`, e a pergunta eram duas

*"Por onde a pessoa seleciona se é vídeo, carrossel, post estático ou
stories?"* — e a lista mistura duas perguntas:

- **`midia`** (`imagem` / `carrossel` / `video`) é **o que a tela desenha**;
- **`formato`** (Feed, Stories, Reels, Shorts) é **onde vai ao ar**.

Stories não é irmão de carrossel: um story é imagem **ou** vídeo, e cinco
stories em sequência são um carrossel de stories.

`formato` **continua texto, e a 0032 estava certa** — o comentário dela diz que
esses nomes "mudam a cada temporada de produto das plataformas, e um enum
obrigaria uma migration a cada nome novo". Reels e Shorts são dessa safra. No
editor ele é um `input` com `datalist` por rede: sugestão, nunca lista fechada.

`midia` **é enum**, e precisa ser: é ele que decide qual editor aparece, e um
`"Carrossel"` com C maiúsculo faria a faixa de slides sumir sem erro nenhum.
**Escolhe-se na abertura**, porque trocar no meio significa trocar a tela
debaixo de quem está trabalhando — e a tela recusa a troca enquanto houver mais
de um slide, senão ficariam arquivos no bucket sem tela que os mostre.

**A conversão do que já estava gravado não é opcional.** Havia post com
`formato = 'carrossel'` e `formato = 'video'`, escritos quando não havia onde
dizer o que a tela desenha. Sem o `update` da 0042 eles nasceriam
`midia = 'imagem'` — o default —, e um carrossel de cinco slides abriria no
editor de arte única, com quatro arquivos invisíveis. Foi o seed que mostrou.

##### O carrossel, e por que `arte_url` continua sendo a capa

Os slides são `post_versions.arquivos`, um `jsonb` ordenado. É `jsonb` e não
tabela pelo mesmo critério que separa o template de campanha do workflow de
task: a versão é escrita de uma vez e lida inteira, nunca consultada slide a
slide. Normalizar criaria uma tabela para servir um `select * where id = ?`.

**`posts.arte_url` continua sendo a CAPA** — o primeiro slide, escrito pelo
trigger `post_versions_sincroniza`. É isso que faz o calendário, o card da
lista e a miniatura do portal **não saberem que carrossel existe**. Sem essa
linha, subir cinco slides deixaria o card sem imagem nenhuma, e ninguém ligaria
uma coisa à outra.

##### Vídeo é por LINK, e o custo foi dito a quem decidiu

`posts.video_url` guarda o endereço no Drive ou no YouTube — decisão do
usuário. O visualizador do portal desenha `<img>`, com zoom de roda e pinça; um
`.mp4` ali apareceria quebrado, e player, poster e limite de tamanho no bucket
são entrega própria.

**O que se perde:** o cliente sai do portal para assistir, e decide longe do
botão de aprovar — que é exatamente o que o Sprint 12 evitou ao pôr a arte
grande antes dos botões. A tela avisa que o link abre fora.

**E o banco recusa enviar vídeo sem o link.** Sem a trava, o cliente abriria a
tela para decidir sobre uma arte que não existe — e decidiria, porque o botão
de aprovar estaria lá.

##### O que o colaborador NÃO troca

Cliente, responsável e data de publicação. **Policy não limita coluna**, então
quem segura é o trigger `posts_protege_colunas` — a mesma razão de
`protect_client_columns` e de `comments_normaliza`.

**E ele RECUSA em vez de reescrever**, ao contrário do `comments_normaliza`:
lá o campo nem aparece na tela do cliente, e devolver o valor certo em silêncio
é correto; aqui os três campos aparecem, e um colaborador que tenta mudar a
data precisa ouvir que não pode — senão ele salva, vê a data antiga voltar e
conclui que a tela está quebrada.

##### As duas visões, o editor único e o botão desligado

**Lista + editor e calendário + painel, na mesma rota por `?visao=`** (decisão
do usuário, entre três propostas). A fila por colunas ficou de fora: arrastar
valeria em quatro colunas e não na quinta, porque enviar ao cliente não se
desfaz — uma exceção que a pessoa aprende errando.

**O editor é UM componente nas duas**, e `compacto` é a única diferença. Duas
telas parecidas divergiriam na primeira mudança, e a divergência apareceria no
lugar mais caro: o botão que manda material para fora da agência.

**A lista agrupa por QUEM ESTÁ SEGURANDO** — Comigo / Esperando alguém / Fora
das minhas mãos —, e não por status. É o que faz a mesma tela servir aos três
perfis internos: o colaborador abre e a primeira seção é a dele. Agrupar por
status daria cinco caixas em que ele procuraria o próprio nome.

**"Enviar ao cliente" aparece DESLIGADO com a razão escrita**, em vez de sumir.
Um botão que some ensina que não existe; um desligado que diz *"falta o aval
interno"* ou *"ninguém envia ao cliente a própria entrega"* ensina a regra — e
a regra é do banco. `podeEnviarAoCliente()` em `lib/dominio/posts.ts` responde
a mesma pergunta que `validar_nova_rodada` faz, e existe só para escrever a
frase.

**A legenda do calendário agrupa as duas mãos que dividem o azul**, como a do
portal já fazia com os sete status. A primeira versão dava `--accent-strong` à
Revisão achando que era outro azul: no tema claro ele **é** `--blue-strong` —
o token existe justamente para dizer "o azul legível no tema de agora". Duas
entradas de legenda com a mesma cor são piores que uma, porque a pessoa procura
a diferença, não acha, e passa a desconfiar do resto. **E a cor nunca é o único
sinal:** cada card carrega o passo exato no `title` e no rótulo acessível.

**Liberar avisa quem recebeu, e o aviso é do banco** — `posts_avisa_responsavel`
chama `notificar()`, que nunca avisa quem causou o aviso. A gestão que libera um
post para si mesma não recebe nada, e está certo.

**Trocar de post remonta o editor por `key`, nunca por efeito.** Ressincronizar
estado dentro de um `useEffect` dispara renderização em cascata — e, pior,
sobrescreveria o que a pessoa acabou de digitar no instante em que o servidor
revalidasse a página.

#### A corrente de etapas do post, e o card que cada uma preenche

Migrations 0044, 0045 e 0046, todas por decisão do usuário. É o que transforma
o post de uma linha no calendário no trabalho de quatro pessoas.

**O mês abre em branco, sem datas** (0044). Com mais de dez clientes, todos com
social, abrir cento e vinte posts um a um é a gestão inventando cento e vinte
datas que quem produz vai refazer. `abrir_mes_de_social(cliente, mês,
quantidades, responsáveis)` cria N posts de uma vez, **transacional** — ou
nascem todos ou nenhum. As quantidades vêm **por rede** (`{"instagram": 12,
"linkedin": 4}`), que é como um contrato de social é escrito.

- **`data_publicacao` aceita nulo**, e é o que destrava o resto: "sem data
  ainda" é um estado de verdade do trabalho, e um estado que a coluna não
  representa vira data inventada. Post sem data não entra no calendário — vai
  para a faixa **"Sem data ainda"** abaixo da grade, que é onde alguém o busca
  justamente para marcar o dia.
- **A data é de quem produz.** A 0042 travava o contrário ("ela foi combinada
  com o cliente"), certo para aquele fluxo e errado para este. *O que se perde,
  e foi dito a quem decidiu:* um post já enviado pode ter a data trocada, e o
  cliente vê outra data sem ninguém avisar.
- **Mas post sem data não vai ao cliente.** Não contradiz o de cima — não diz
  quem manda na data, diz que ela existe antes de o material sair da agência.
  Senão ele abre o portal, vê a arte e decide sem saber quando aquilo vai ao
  ar. Quem recusa é `validar_nova_rodada`, mesma forma da trava de vídeo sem
  link.
- **O teto de 60 RECUSA em vez de cortar**, ao contrário do limite da
  recorrência: lá o excesso vem de uma regra de calendário; aqui o número é
  digitado, e um zero a mais é erro de digitação.
- O mês por extenso sai de um **array** e não de `to_char(..., 'TMMonth')`: o
  `TM` lê o `lc_time` do servidor, e no Postgres da bateria ele é `C` — o tema
  saiu "November/2026" numa tela em português. É o `toLocaleDateString` do SQL.

**E cada post carrega uma CORRENTE DE ETAPAS** (0045): Pauta (Social Media) →
Conteúdo (Redator) → Layout (Design) → Envio → **Ajustes**, se o cliente pedir
→ Programar (Social Media). Até aqui o post tinha uma mão por vez — a gestão
abria, um colaborador produzia, a gestão enviava. Isso descreve quem pode
escrever, não quem faz o quê: pauta, texto e arte são três ofícios, e
"produzir" tratava os três como um.

**Não é um `workflow_template`, e a recusa tem dois motivos mecânicos.**
Workflow materializa subtarefa, e subtarefa mora dentro de uma task:
`tasks_exige_pasta_de_entrega` cobraria cento e vinte pastas por mês que
ninguém preenche, e o board da agência ganharia cento e vinte linhas mensais —
o que o modo `mensal_agrupada` da recorrência existe para evitar. A cadeia mora
em `etapas_padrao_do_social()`; se um dia precisar ser editável por cliente,
vira tabela de modelo, e é decisão explícita.

**"Diretor de Arte" é a função `Design` do enum**, e a escolha é deliberada:
acrescentar o nome ao lado criaria dois nomes para o mesmo ofício, e a mesma
pessoa cadastrada como um não apareceria na busca pelo outro.

**O status é `subtask_status` e não um enum novo**, ao contrário dos três
vocabulários que o produto mantém separados: esta tabela responde à *mesma*
pergunta que a etapa de demanda — "em que pé está este trabalho, que é meu?" —,
e as duas aparecem lado a lado em Minhas Tasks. Um enum com quatro dos seis
valores obrigaria um de-para ali.

- **A ordem tem folga** (10, 20, 30, 40, 50) porque a etapa de Ajustes nasce
  *entre* Envio e Programar; sequencial, ela obrigaria a renumerar as seguintes
  por causa de um pedido do cliente.
- **Cada pedido cria a sua**, numerada — dois pedidos são dois motivos, e
  reaproveitar a linha apagaria o primeiro, pela mesma razão que rodada fechada
  nunca é reescrita. Quem fez o Layout herda o ajuste.
- **Post RECUSADO não ganha etapa nenhuma.** Rejeitar diz *não*, pedir ajustes
  diz *mude isto e volte* — criar a etapa nos dois casos afirmaria que um post
  recusado é para refazer.
- **A etapa Envio não se marca à mão, nem pela gestão**: é consequência da
  rodada de escopo cliente, como `posts.enviado_em` desde a 0032.
- **E uma etapa `em_ajustes` não bloqueia o que vem depois dela.** Sem essa
  linha a corrente travava exatamente onde o cliente mexeu: o Envio vai para
  `em_ajustes`, a etapa de Ajustes nasce logo depois, e começá-la era recusado
  com "vem depois de Envio" — que nunca ficaria concluída enquanto o ajuste não
  fosse feito. Uma etapa em ajustes já devolveu o trabalho; quem espera é ela.
  **Foi a imagem do protótipo que mostrou**, e o Programar continua travado do
  jeito certo: ninguém programa o que o cliente não aprovou.

**A trava mais nova quase quebrou a ação mais antiga do portal.**
`posts_corrente_do_cliente` move a etapa Envio e roda com o `auth.uid()` **do
cliente** — `security definer` não troca quem está logado —, então ele cairia em
"o Envio não se marca à mão" clicando no único botão que tem. A saída é um GUC
de escopo local, desligado antes de a função devolver: a saída de emergência não
pode virar porta destrancada. A mesma saída cobre o seed, que monta posts no
meio do fluxo.

**E o gatilho reativo mora em `posts`, não dentro de `decidir_rodada_do_cliente`**
— aquela função já foi reescrita inteira várias vezes, e cada reescrita é uma
chance de o trecho ficar para trás. De quebra, o gatilho pega todo caminho que
põe o post em ajustes, não só o botão do portal.

#### A data de cada etapa, escolhida ao abrir o mês

Migration 0059, decisão do usuário: *"quando eu abra um mês de social, eu
possa escolher em qual dia cada etapa da task vai ser realizada, para que já
entre no calendário da pessoa responsável"*.

**O que faltava não era a coluna.** `post_etapas.prazo` existe desde a 0045 e
nunca era preenchida por ninguém. Faltavam três coisas: de onde a data vem, o
que acontece quando o post muda de dia, e o **oitavo `union all`** da
`calendar_events` — sem ele a etapa podia ter dia marcado e não aparecia no
calendário de pessoa nenhuma. A data existia na tabela e não existia na tela,
que é o pior dos dois estados.

**É OFFSET e não data fixa.** "Layout três dias antes de ir ao ar" vale para os
doze posts do mês; data fixa obrigaria a digitar doze vezes e nasceria errada
no dia em que a publicação mudasse de dia. É a mesma razão de
`workflow_steps.prazo_offset_dias` desde a 0008.

A diferença é que `post_etapas` é **instância** e não modelo, então ela guarda
as duas: `prazo_offset_dias` (a regra) e `prazo` (o dia). A regra existe para o
dia se recalcular sozinho quando o post andar.

**O post abre sem data, e isso não quebra nada — é a parte que encaixa.** A
0044 decidiu que o mês abre em branco. Com o offset gravado e a publicação
ainda nula, `prazo` fica nulo também; no instante em que alguém escreve o dia
do post, as cinco etapas caem no calendário das cinco pessoas de uma vez. A
regra fica guardada esperando o dia.

**E o volante se pega, como no status da Task.** Datar uma etapa à mão **limpa
o offset dela** — dali em diante o post pode andar que ela fica onde alguém a
pôs. É a decisão da 0025: aceitar o clique e deixar o recálculo desfazer em
seguida é o pior dos dois mundos, porque a escolha some sem ninguém ver. *O
que não existe é o caminho de volta* ("deixar o Full Hub calcular"): a etapa é
uma linha num card, não uma tela com rodapé — quem quiser a regra de volta
abre o mês de novo. A assimetria com a 0025 é consciente.

**O trigger que limpa o offset precisa de duas condições, e não de uma:** só
quando o `prazo` mudou **e** o offset não. Sem a segunda, mexer no status de
uma etapa apagaria a regra de data de passagem — e o sintoma seria uma etapa
que para de andar com o post sem ninguém ter tocado na data.

**E o recálculo usa o GUC de escopo local**, a mesma saída de
`posts_corrente_do_cliente` (0045): sem ele, o próprio recálculo dispararia o
trigger e apagaria a regra que acabou de aplicar, na primeira vez que alguém
trocasse a data do post.

**A chave dos prazos é o NOME da etapa, e não a função** — ao contrário de
`p_responsaveis`. Pauta e Programar são as **duas** de Social Media, e uma
chave por função daria às duas o mesmo dia: a pauta venceria junto com a
programação, que é o fim da corrente.

**A corrente não pode vencer de trás para a frente**, e o banco recusa nomeando
a etapa. O Layout com prazo antes do Conteúdo é quase sempre um número
trocado, e o estrago é grande: a corrente já recusa começar o Layout antes de o
Conteúdo fechar (0045), então a pessoa veria no calendário dela uma etapa
vencendo num dia em que o banco ainda não deixa tocá-la.

**O diálogo abre com os cinco números preenchidos** (−10, −7, −4, −3, 0), e é
sugestão e não contrato — como o modelo de campanha. Cinco campos vazios
fariam quem abre o mês inventar cinco números, e inventar data é o que a 0044
evita. Ao lado de cada campo vai a frase: `-3` não é português, e "3 dias
antes" é o que se confere.

**A guarda da action estava mais apertada que o banco, e isso foi consertado
junto.** A 0046 abriu `abrir_mes_de_social()` para `is_atendimento()` — "o
Atendimento abre o mês" —, e `abrirMesDeSocial` continuou em
`exigirGestorNaAcao`. O banco aceitava e a tela recusava antes: a pessoa do
Atendimento lia "seu perfil não permite esta ação" numa ação que o produto diz
que é dela. É a lição da 0029 virada — quando a regra mora nos dois lados,
mudar um não muda nada, e aqui o lado que ficou para trás era o de cima.

**A oitava origem da `calendar_events`** é `etapa_de_post`, e ela é camada
própria: `post` é o dia em que a peça vai ao ar, `etapa_de_post` é o dia em que
o trabalho de alguém precisa estar pronto, e as duas datas raramente são a
mesma. O `client_id` vem do **post** — a etapa não tem cliente, e sem o join o
filtro por cliente deixaria estas linhas passar sempre, o que parece "sem
filtro" e é pauta de uma conta aparecendo na tela de quem filtrou por outra.

**`create or replace view` NÃO herda `security_invoker`**, e a cláusula foi
repetida na 0059 por isso. Sem ela a view voltaria a rodar com os direitos de
quem a criou e leria as oito tabelas inteiras para qualquer pessoa autenticada
— e o furo passa despercebido num banco com um cliente só. A bateria mede.

#### O card: quem pega a etapa é quem preenche

Migration 0046. **Cada elo da corrente tem um campo do card**, e dois deles não
existiam:

| Etapa | Preenche |
| --- | --- |
| Pauta | `posts.pauta` — **nasce aqui** |
| Conteúdo | `posts.legenda` |
| Layout | a versão, com a arte |
| Envio | a ação Enviar ao cliente |
| Programar | data e horário |

Sem `pauta`, quem pegava a primeira etapa abria a tela e não tinha onde
escrever nada — a etapa existia e o trabalho dela não cabia em lugar nenhum.
Escrever a pauta na legenda seria pior: **a legenda vai ao cliente e ao ar, a
pauta é conversa interna**, e a tela diz isso em uma frase embaixo do campo.

**As referências são TABELA** (`post_referencias`), como `task_referencias`, e
não um campo de texto com links colados: são várias, cada uma tem quem a pôs e
quando, e se apagam uma a uma. Um `text` com links separados por linha vira o
campo em que ninguém apaga nada com medo de apagar o resto. `tipo` fica de fora
— aqui é sempre link, porque a arte tem lugar próprio e um arquivo solto no
meio das referências seria uma segunda porta para o material final.

- O endereço entra **num campo da tela, nunca num `window.prompt`** — mesma
  decisão do link de referência da Task.
- **Apagar é de quem pôs, ou da gestão**, como nas Recomendações: a gestão
  modera apagando.
- **Não existe editar, e a tabela não tem policy de UPDATE.** Mudar o endereço
  de uma referência que alguém já abriu é trocar o destino embaixo de quem a
  leu. Apaga e põe outra.
- Quem assina é o trigger: policy não limita coluna.

**O ATENDIMENTO ABRE O MÊS**, e não só a gestão — decisão do usuário. É
`is_atendimento()`, a **mesma** função que `tasks_insert` usa desde a 0006, e
não uma parecida: uma segunda função dizendo quase isso seria o lugar onde as
duas verdades começam a divergir. **O que não muda: distribuir a corrente
continua sendo da gestão.** Abrir trabalho e distribuir trabalho são duas
decisões.

**"Social Media" é UMA linha do menu, e fica na Principal.** Ela passou por
Gestão e por duas entradas ao mesmo tempo no mesmo dia; o histórico fica
registrado porque a ideia pode voltar. O que decidiu: a tela já muda sozinha por
perfil, e quem recusa é a RLS e os triggers — uma segunda entrada não
acrescentava trava nenhuma, só um segundo caminho para o mesmo lugar com o
mesmo nome. E é na Principal porque a divisão do menu é sobre a **pessoa**:
Gestão carrega o selo Admin e significa "o que eu faço sobre os outros", e o
redator escrevendo a legenda dele não está fazendo nada sobre ninguém.

#### Quem tem etapa na corrente escreve no card

Migration 0047, e é um furo que a 0046 deixou — encontrado pelo usuário
tentando trocar a data de um post do mês que acabara de abrir.

`posts_update` fechava em `is_gestor() or responsavel_id = auth.uid()` desde a
0042, quando o post tinha uma mão só. A 0045 partiu a produção em cinco etapas
com cinco donos e a 0046 escreveu que "quem pega a etapa preenche o card" — **em
português, não em SQL**. A redatora é dona da etapa Conteúdo e não é
`posts.responsavel_id`: ela não escrevia legenda, nem pauta, nem data. E como
`post_referencias` já era `is_staff()`, metade do card aceitava escrita e a
outra metade voltava sem erro e sem linha.

**E a data estava travada em dois lugares.** A 0044 tirou a trava do trigger,
mas a policy barrava antes — desfazer a de cima não adianta enquanto a de baixo
segura, que é a mesma lição da 0029.

A porta é `tenho_etapa_no_post()` e **não `is_staff()` solto**: com dez
clientes, `is_staff()` deixaria o designer de outra conta trocar a data de um
post que ele nunca viu. Cliente e responsável continuam da gestão — a policy diz
quem entra, o trigger diz o que se mexe depois de entrar. Em TypeScript,
`podeProduzir()` faz a mesma pergunta, senão a tela desligaria os campos para
quem o banco passou a aceitar.

**E o campo de data não existia na tela.** A 0044 abriu o mês em branco e a data
só aparecia no cabeçalho, como texto. Doze posts sem data e nenhum lugar onde
escrevê-la é o mês inteiro parado.

#### Apagar um arquivo grava uma versão

Migration 0048, decisão do usuário: poder apagar uma imagem errada e subir
outra, **"sempre registrando no histórico"**.

Remover **grava uma versão nova** com o que restou, e não reescreve a atual —
é a regra do módulo desde a 0032 vista do avesso. Editar a versão corrente
seria a única forma de a remoção sumir do histórico, que é exatamente o que ele
pediu que não acontecesse. **O arquivo continua no bucket**: a versão anterior
aponta para ele, e apagar o objeto deixaria a v1 com uma moldura cinza onde
havia uma arte.

**O sinal é uma coluna (`removeu_arquivos`), e não o array vazio** — que foi a
primeira tentativa, derrubada pela bateria na mesma rodada. `arquivos` é
`not null default '[]'` desde a 0042, então vazio quer dizer "esta versão não
falou de arquivo": o caso de toda versão que só mexe na legenda. Com o vazio
como sinal, gravar um ajuste de texto apagava a arte. A outra saída — tirar o
`not null` e fazer nulo ser "não mexi" — funcionaria daqui para a frente e
reinterpretaria o passado, porque toda versão já gravada passaria a dizer
"esvaziei".

Removendo o slide 3 de 5, a versão nova tem quatro arquivos e o sinal **não**
vai: a capa sai do primeiro deles, pela mesma linha que já escolhia o primeiro
slide desde a 0042. Remover o primeiro promove o segundo a capa.

#### O carrossel anda, nos dois lados

Decisão do usuário: *"atualmente ele não permite ir de uma imagem para outra,
quero que as imagens apareçam em sequência, como um carrossel mesmo"*.

**No editor**, a tira de miniaturas de 48px virou `carrossel-do-editor.tsx`: a
imagem corrente no quadro inteiro, setas, contador sempre visível, a tira
embaixo como régua de onde se está, e teclado. E cada slide se apaga do próprio
quadro. A arte única passa pelo mesmo componente com uma imagem só — dois
desenhos para a mesma coisa divergiriam no dia em que o botão de remover
mudasse.

**No portal o visualizador já sabia andar** desde o Sprint 12; quem mandava só
a capa era quem o chamava. `ModeloDoConteudo.arte` virou `artes`, e o post
passa os slides da versão corrente. A capa entra uma vez só: ela É o primeiro
slide, e mandá-la à frente da lista mostraria a mesma imagem duas vezes — o
cliente contaria seis onde há cinco.

#### As etapas de social aparecem em Minhas Tasks

Decisão do usuário. O redator não é do social — se a etapa dele vivesse só na
tela de Social Media, ele teria duas caixas de entrada e olharia uma. Clicar
leva ao post, que é onde o card se preenche.

**É bloco próprio e não itens misturados à lista de etapas de demanda**, e a
razão é o que cada uma carrega: a etapa de demanda é uma `SubtarefaDetalhada` —
rodada, cronômetro, dependência cadastrada, a máquina de estados que decide
qual botão aparece. Uma etapa de post não tem nada disso, e fabricar os campos
para ela caber no mesmo molde faria a tela oferecer "Enviar para aprovação" onde
o banco responde outra coisa. **O molde errado mente com mais convicção que a
ausência.**

*O que se perde, e é consequência aceita:* a ordem não é global entre os dois
tipos. O que se ganha é uma tela só para "o que eu faço hoje".

E a lista traz **só as que já podem começar**: uma etapa de Layout cujo
Conteúdo ninguém escreveu ainda não é trabalho meu hoje — ela apareceria no topo
da lista de quem não tem o que fazer com ela, e o banco recusaria o clique.

#### Campanhas: a Wave, a árvore e a decisão de cada peça

`campaign_templates`, `campaigns`, `deliverables` e `deliverable_versions` —
migration 0033, que é o **terceiro ato da 0030**: com `deliverable`, os três
tipos do enum passam a ter dono e a frase "tipo sem regra é tipo recusado"
deixa de ter exemplo. Ela fica de pé assim mesmo — é a regra para o quarto.

O post é uma peça solta com uma data; a campanha é um conjunto com começo, fim
e **estrutura**: entregáveis de topo, alguns deles grupos com sub-itens, cada
um decidido por conta própria.

**São DOIS níveis, e nunca três.** O neto é recusado pelo trigger
`deliverables_dois_niveis`, pela mesma razão da sub-etapa e da thread das
Recomendações: árvore que passa de dois níveis na tela do cliente é árvore que
ninguém acompanha, e o recuo deixa de significar alguma coisa.

**O status do grupo é DERIVADO, e não existe coluna para ele.** É a mesma
regra que a Task já segue com as subtarefas e a etapa com as sub-etapas: quem
tem filho para de ser unidade de trabalho. `status_do_entregavel()` no
Postgres e `statusDoGrupo()` em `lib/dominio/campanhas.ts` fazem a mesma conta
nos dois lados. O status escrito à mão num grupo é **descartado** em vez de
recusado — quem edita um grupo quase sempre está mexendo no nome, na ordem ou
no prazo, e recusar o update inteiro por causa de um campo que a tela nem
mostra travaria o trabalho para proteger um valor que ninguém lê.

**`rejeitado` num filho NÃO faz o grupo ficar rejeitado**, e é escolha:
ninguém recusou o grupo — recusaram uma peça dentro dele, e o que ele precisa
dizer é "tem coisa para refazer aqui". `ajustes` é exatamente isso, e é o tom
de atenção; `rejeitado` é o de erro, e pintaria de vermelho um grupo em que
catorze de quinze itens estão aprovados.

**Toda conta olha só as FOLHAS.** Um grupo com quinze sub-itens é uma linha na
tela e quinze entregas no trabalho; contar o grupo também faria "16 de 16"
onde há quinze coisas, e a barra andaria sozinha quando o último filho fosse
aprovado.

**O cliente só enxerga entregável ENVIADO, e a linha mora na policy.**
`deliverables_select_cliente` exige `enviado_em is not null` — item em
produção não existe para ele, nem na árvore, nem pela URL direta, nem pela API
com o id na mão. A consulta de `lib/dados/campanhas.ts` não repete o filtro.
**A campanha, essa ele vê desde o planejamento:** ela tem nome, período e
progresso, e é isso que responde "o que a Full está fazendo para mim este
mês". Esconder até o primeiro envio faria a lista de campanhas ativas contar
menos do que existe — e ele já sabe que ela existe, foi ele quem pediu.

**Sub-item órfão sobe para o topo em vez de sumir.** Se o pai não veio porque
não foi enviado, o filho que FOI enviado continua aparecendo: descartá-lo por
causa do pai deixaria um material aprovável fora da tela, sem nada dizendo que
ele existe.

**O TEMPLATE é uma árvore em `jsonb`, e não um par de tabelas** como o
workflow de task. A diferença é o que se faz com cada um: o workflow guarda
função, prazo relativo e responsável por etapa, coisas que se consultam; o
template de campanha guarda uma lista de nomes que alguém edita inteira antes
de salvar. Normalizar seria criar duas tabelas para servir um `select * where
id = ?`. `itens` vazio com `quantidade` é o caso do Feed/Storys — quantos são
se decide na criação, porque muda a cada mês.

**O modelo é ponto de partida, não contrato.** Escolhê-lo expande a árvore na
tela de abertura, e daí em diante o Atendimento acrescenta, remove e
datilografa prazos — e o que viaja para a action é a **árvore**, não o id do
modelo. A primeira versão mandava o id e reexpandia no servidor, o que
desfaria cada ajuste no clique de salvar: a pessoa veria uma árvore e gravaria
outra. Os filhos casam com os pais **por posição**, não por nome: "Feed/story
site" aparece duas vezes na Wave, uma no Enxoval e outra no Deskfy.

**A linha de cada item MUDA por status**, e é o que faz a árvore responder
"e daí?": aprovado diz quem e quando, esperando diz há quantos dias, recusado
diz o motivo — na lista, não só no detalhe —, em produção diz para quando. O
grupo abre por padrão quando tem pendência, e só então: abrir tudo vira uma
lista de quarenta linhas com o que importa no meio, abrir nada esconde o que a
pessoa veio ver.

**O alerta de 7 dias fala de "não aprovados", e não de "esperando você".** São
contas diferentes — o cartão da listagem destaca o que espera a decisão DELE,
e o material recusado espera a agência refazer. As duas frases diziam
"esperando você" e mostravam números diferentes na mesma campanha; foi a
imagem em 375px que mostrou as duas lado a lado. E ele é `--warning`, nunca
`--danger`: vermelho num portal que a pessoa abre uma vez por semana treina o
hábito de ignorar vermelho.

**A tela de detalhe do material é UMA SÓ**, em
`components/portal/telas/detalhe-do-conteudo.tsx`. Post e entregável leem
tabelas diferentes e montam o mesmo `ModeloDoConteudo`; o que é compartilhado
é a casca, não a leitura — compartilhar a consulta levaria a um `if tipo ===`
no meio de cada `select`, que é a duplicação de volta com outro nome. Duas
telas divergiriam na primeira mudança, e a divergência apareceria no lugar
mais caro: o botão de aprovar.

O texto que acompanha a arte é a **legenda** no post e a **descrição** no
entregável, e o rótulo viaja no modelo — com a palavra fixa no componente, a
tela do entregável mostrava a seção "Descrição" e, logo abaixo, um botão
dizendo "Copiar legenda".

**No calendário da agência a campanha entra pelo ENCERRAMENTO**, não como
faixa do período: uma Wave de trinta dias pintaria trinta células e empurraria
para baixo tudo o que acontece em cada uma. É a mesma decisão que o calendário
já toma com o período da etapa. O entregável entra pelo prazo dele; sem prazo
fica de fora.

**O cliente não edita estrutura, prazo nem arquivo**, e não existe botão de
reverter versão em lugar nenhum do portal — ele não tem policy de escrita em
`deliverable_versions`, e a trava é essa, não a ausência do botão.

#### A campanha nasce com a DEMANDA, e cada peça é uma etapa dela

Migration 0051, decisão do usuário: *"cada material da campanha é basicamente
uma subtarefa de uma tarefa mãe"*. Abrir a campanha cria a demanda junto, com
uma etapa por entregável — grupo vira etapa agrupadora, sub-item vira
sub-etapa, os mesmos três níveis que a demanda já tinha.

**A ponte já existia e ninguém a atravessava.** `deliverables.subtask_id` e
`deliverables.responsavel_id` nasceram na 0033; a coluna nova é uma só,
`campaigns.task_id`. Daria para chegar à demanda pelo caminho longo
(`deliverable → subtask → task`), e a campanha aberta sem entregável nenhum
ficaria sem nenhum — justamente o caso de quem abre primeiro e monta a lista
depois.

**Tudo numa função só, porque é uma transação só.** `abrir_campanha()` faz
cinco escritas encadeadas; pelo PostgREST seriam cinco transações, e a
terceira falhando deixaria uma campanha ligada a uma demanda com metade das
etapas, sem nada na tela dizendo o que faltou. **Não é `security definer`:**
`campaigns_insert` e `tasks_insert` continuam decidindo quem pode.

**A demanda nasce publicada**, e não como rascunho: a tela de task abre um
rascunho no clique (0028) porque a pessoa vai digitar o título ali dentro;
aqui ela preencheu tudo antes, e rascunho é de quem o criou — esconderia da
equipe as etapas que ela acabou de distribuir.

**As campanhas abertas ANTES dela ficaram para trás**, e a ausência não
aparece como erro: a campanha abre, a árvore aparece, e o que falta é o botão
"Abrir a demanda" e o trabalho no board da agência. Quem liga é
`scripts/campanhas-sem-demanda.sql`, e ele é **script e não migration** porque
uma migration teria que inventar a pasta de entrega — a 0015 recusa demanda
sem ela justamente para ninguém preencher as antigas com um valor qualquer.
Então a pasta vem de quem sabe qual é: o PASSO 1 lista as campanhas e já
escreve as linhas do PASSO 2 prontas para colar, e o PASSO 2 **recusa** a
campanha cuja pasta ficou com o texto de exemplo em vez de gravá-lo.

**E o seed reproduzia esse estado em todo ambiente de desenvolvimento.** Ele
inseria a campanha direto em `campaigns`, sem demanda — o pior tipo de dado de
exemplo, o que mostra o produto como ele não é mais, sem nada avisando. Ele
não chama `abrir_campanha()` porque monta cada peça com estado próprio (rodada
aprovada, recusada com motivo, pendente, em produção), que aquela função não
recebe; o que ele faz é a outra metade dela.

**O briefing e a pasta de entrega são da DEMANDA**, não colunas novas em
`campaigns`. Uma segunda caixa de texto com o mesmo papel em outra tabela
seria o lugar onde as duas versões do briefing divergem. E a pasta é
obrigatória porque `tasks_exige_pasta_de_entrega` recusa demanda nova sem ela
desde a 0015.

#### A campanha se finaliza sozinha, e se reabre sozinha

Decisão do usuário: *"uma campanha só é finalizada quando todas as suas etapas
são entregues e finalizadas"* — e a frase vale nos **dois** sentidos. Uma
campanha com peça em produção não está finalizada, então o trigger também
devolve para `ativa`.

**Só as FOLHAS contam**, como toda conta deste módulo. `planejamento` e
`cancelada` não são tocados — promover a finalizada uma campanha que nem
começou seria afirmar que acabou o que não começou. E campanha **sem**
entregável nunca finaliza: `count(*) = 0` e `count(*) filter (where aprovado)
= 0` são iguais, e sem a guarda toda campanha recém-aberta nasceria na aba que
o cliente só abre para ver o que já acabou.

#### Quem aprova a peça conclui a etapa

Migration 0052, decisão do usuário: *"o responsável entrega, e o cliente
conclui, quando aprova"*. Sem isto a etapa ficava aberta para sempre, e quem a
fez tinha que voltar ao Minhas Tasks para marcar concluída uma peça que o
cliente já tinha aprovado — duas mãos para o mesmo fato, e a segunda é a que
ninguém lembra de dar. Pedir ajustes devolve a etapa para `em_andamento`.

**O trigger NUNCA derruba a aprovação do cliente**, e é a parte que importa.
Ele está do outro lado, sem ninguém por perto: se a conclusão da etapa fosse
recusada, o que ele veria era a aprovação *dele* falhando, com uma mensagem
sobre uma etapa que ele nem sabe que existe. A conclusão é **tentada**, e só
acontece quando as travas da etapa já deixam — não é agrupadora, não exige
aval próprio sem ter um, não está presa por dependência. Nos três casos a
etapa fica aberta, que é a verdade.

**O tempo real fica vazio nessas etapas**, e foi dito a quem decidiu: o
cliente não sabe quanto a peça levou, então não há quem perguntar. O
cronômetro continua medindo; o que falta é alguém afirmar que o número é o
certo.

#### A capa do cartão

Migration 0050, decisão do usuário: *"para ser identificável direto pela
imagem qual campanha é"*. Coluna opcional, no mesmo bucket privado dos
entregáveis, com a pasta do cliente na frente do caminho — senão a capa
aparece para a equipe e some no portal dele. `CapaDoCartao` é o mesmo
componente nas quatro telas: a capa existe para a campanha ser reconhecida de
relance, e duas proporções fariam a mesma campanha parecer outra em cada uma.
Tirar a capa é `null` e não apagar o arquivo.

#### Onde a equipe sobe o material: a própria campanha

`/painel/aprovacoes/campanhas/[id]` — e **não é área nova, nem precisava
ser.** `deliverable_versions` nasceu na 0033 com número de versão, arquivo,
justificativa e autor; o bucket privado e as quatro policies também. Mais de
uma versão já funcionava e a justificativa já tinha coluna — o que nunca
existiu foi a tela. É a mesma situação em que o Social Media estava até a
0042.

Um módulo separado de arquivos criaria um segundo lugar para procurar a mesma
arte — e o entregável, que é quem o cliente decide, continuaria apontando para
o primeiro.

- **A peça abre NO LUGAR**, e um item por vez: quem produz sobe arte de quatro
  peças seguidas, e três abertos empilham três históricos até a árvore sair do
  campo de visão.
- **A justificativa fica ACIMA do botão de subir.** Escrita depois, ela seria
  de uma versão já gravada — o histórico diria que a v3 mudou o que mudou na
  v4.
- **Não existe reverter, nem do lado de cá.** O caminho é subir de novo, o que
  grava uma versão a mais em vez de apagar duas.
- **A ligação com a Task vai nos dois sentidos:** a campanha tem "Abrir a
  demanda", a demanda tem "Ver campanha". `campanhaDaTask()` pergunta pela
  demanda e não pela etapa — pelo caminho longo, a demanda sem etapa ficaria
  sem campanha.

#### Vários arquivos na mesma versão, e nem todos são imagem

Migration 0053, decisão do usuário: *"algumas entregas são em PDF, PSD ou
AI"*. "Lâmina A5" é o PDF de impressão, o AI aberto e o JPG de conferência —
três arquivos, uma entrega, uma decisão do cliente. Com uma coluna só, subir o
segundo apagava o primeiro, ou virava uma versão por arquivo: um histórico em
que "v4" não quer dizer quarta rodada de ajuste, quer dizer quarto arquivo.

`arquivos jsonb` é a **mesma forma** de `post_versions.arquivos`, e é de
propósito: duas listas de arquivo com dois formatos no mesmo produto seriam
dois jeitos de ler a mesma coisa.

**A capa é a primeira IMAGEM da lista**, não o primeiro arquivo: o designer
sobe o aberto, o fechado e a prévia nessa ordem, e um PSD como capa daria
moldura quebrada no cartão e na miniatura do portal. `imagem_do_arquivo()` no
Postgres e `EH_IMAGEM` em `lib/dados/campanhas.ts` fazem a mesma pergunta nos
dois lados — lá para escolher a capa, aqui para separar o que vai para o
visualizador do que vai para a lista de download. `svg` fica de fora nos dois:
SVG de terceiro dentro de `<img>` é vetor de script, e material de campanha
vem de fora com frequência.

#### O módulo chama-se Campanhas, e é de quem produz

Decisão do usuário: *"essa área deve ser visível para os colaboradores (…) já
que quem vão upar e fazer os conteúdos são os responsáveis e não o
atendimento"*. `roles` passou de `GESTAO` para `EQUIPE`, e é palavra por
palavra o argumento que moveu o Social Media: esconder o módulo de quem produz
é esconder o trabalho dele.

**E foi para a seção Principal**, porque a divisão do menu é sobre a PESSOA:
Gestão carrega o selo Admin e quer dizer "o que eu faço sobre os outros", e o
designer subindo o PDF da lâmina dele não está fazendo nada sobre ninguém.

**O nome mudou junto.** Ele ficava ao lado de "Aprovações Internas" na mesma
seção, e as duas telas não são a mesma coisa — uma é a fila de validação da
gestão, a outra é onde o material é produzido. Dois rótulos parecidos para
telas diferentes é como se aprende a procurar na errada. A rota continua
`/painel/aprovacoes`.

**Mas abrir campanha continua sendo de quem abre demanda**, e a frase do
usuário separa as duas coisas na mesma linha. `campaigns_insert` era
`is_staff()` desde a 0033, quando a tela só existia para a gestão e a policy
nunca era exercida por mais ninguém; a 0054 fechou em `is_atendimento()` — a
**mesma** função que `tasks_insert` usa desde a 0006, e não uma parecida.

**E o banco já recusava pela metade, que é pior que recusar:**
`abrir_campanha()` insere a demanda primeiro, e `tasks_insert` já exigia
`is_atendimento()` — o colaborador levava a recusa da *demanda*, com uma
mensagem sobre tasks, numa tela de campanha.

**Apagar campanha é de sócio e desenvolvedor** (`campaigns_delete`, que é
`is_gestor()` desde a 0033 — a 0050 não criou policy nenhuma, só a tela). O
diálogo exige o nome digitado e **conta o que vai junto**: "13 materiais, 9 já
aprovados pelo cliente, com as versões, os comentários e o registro de cada
aprovação". "Apagar esta campanha?" não informa nada; a contagem é a única
coisa que faz alguém parar.

#### Três vocabulários de status, e não é descuido

`task_status`, `subtask_status` e `content_status` respondem a perguntas
diferentes. "Em ajustes" para a equipe quer dizer que alguém está mexendo;
para o cliente, que o pedido dele foi ouvido. A ponte é `statusParaOCliente()`
em `lib/dominio/portal.ts`, e é a única.

`rejeitado` e `stand_by` estão no enum e **nenhum caminho do produto os
produz** hoje. Ficam porque os módulos de post e de campanha os usam; inventar
uma tradução agora seria mostrar ao cliente um estado que a agência não tem
como alcançar.

#### Nada de jargão interno do lado de lá

"task", "subtarefa", "etapa", "workflow" e "sprint" são palavras da agência. O
cliente recebe **material**, e ele pertence a uma **demanda**. `check:cores`
varre `src/app/(cliente)/` e `src/components/portal/` atrás das formas
portuguesas — `subtask` sem acento continua valendo, porque é valor de enum,
a camada em inglês.

A varredura pegou duas frases que o cliente lia ("o conteúdo entra em um dos
próximos sprints") e um campo chamado `task` na tela de aprovações. Critério
que diz "não existe" é o tipo que volta sem ninguém perceber.

#### O que o cliente edita, e o que ele não edita

Contato, e-mail, telefone e logo. **Nome da empresa e slug, nunca.** A policy
`clients_update_proprio` deixa a linha inteira passar de propósito; quem separa
é o trigger `protect_client_columns`.

**E ele não protegia o slug.** A coluna nasceu na 0009, depois da função da
0005, e ninguém a acrescentou à lista — o cliente trocava o endereço do
próprio portal por um PATCH, e o `/portal/{slug}` que a gestão usa deixava de
abrir. A 0031 fechou, e o cenário confere nos dois sentidos: a escrita passa
(é o desenho) e o valor não muda.

#### Preferências e registro

`client_notification_prefs` fecha em `user_id = auth.uid()` nas quatro
operações — nem o sócio lê. Uma linha por
**pessoa** e não por empresa: quem responde por duas contas não quer receber
em dobro. Quem nunca mexeu não tem linha e recebe o padrão; criar a linha na
leitura seria escrever por causa de um olhar.

`client_access_log` não tem policy de UPDATE nem de DELETE, como
`client_portal_views`. A aba "Quem tem acesso" precisa da DATA do último login
sem precisar da lista — e a policy esconde o rastro alheio de propósito —,
então quem responde é `usuarios_do_meu_cliente()`, `security definer`,
devolvendo só o agregado.

**O registro de acesso é a única escrita do produto que pode falhar calada.**
Se a auditoria cair, o cliente não pode ficar sem o portal por causa disso. O
erro vai para o log do servidor.

### Portais de Clientes

A gestão abre `/portal/{slug}` e vê a tela que aquele cliente vê. **Não é login
como cliente:** a sessão continua sendo a da pessoa da agência, com o
`auth.uid()` dela, nenhum token é trocado. A gestão já podia ler esses dados
pelo painel — o que a rota acrescenta é o arranjo, ver a informação na tela em
que o cliente a vê.

Três coisas garantem que seja só leitura, e **só a terceira é trava**: a faixa
de aviso presa no topo, os botões de decisão desligados, e
`decidir_rodada_do_cliente` no Postgres, que recusa quem não é o cliente
daquela rodada. Montar a chamada à mão não adianta.

Cada abertura vira linha em `client_portal_views`, e **nada lê essa tabela
ainda**: a trilha de auditoria existe desde a 0058 e responde por outras treze
tabelas, não por esta. O rastro está gravado e a tela que o mostra é decisão
própria. A RLS só aceita a linha em nome de quem está logado, e não existe
policy de DELETE.

**A gestão entra pelo `/portal` também, e vê a escolha.** Sócio e
desenvolvedor abriam `/portal` e levavam 403 — e digitar `/portal` é
exatamente o que quem é da agência faz. Decisão do usuário: liberar. Mas
liberar não é deixar entrar no portal do cliente: a equipe não tem empresa
(não há linha em `client_users` para ninguém da agência, e `my_client_ids()`
devolve vazio), então a tela do cliente sairia zerada — pior que a recusa.
`/portal` para a gestão é a **escolha de qual portal abrir**, com uma casca
simples e sem a navegação do cliente, e o destino continua sendo
`/portal/{slug}`: com a faixa, sem decisão nenhuma, com rastro. As telas de
dentro de `(meu)` não recusam a gestão — mandam para `/portal`, porque quem
digitou `/portal/configuracoes` estava procurando o portal de algum cliente.

**Isso desfez um 403 que ninguém tinha notado**, e ele vinha do Sprint 0: o
layout de `(cliente)` chamava `exigirCliente()` e envolve TUDO abaixo de
`/portal` — inclusive `[slug]/`. A visualização administrativa existia desde o
Sprint 3C, com a guarda certa no layout dela, e a recusa acontecia um nível
acima, antes. Foi o que o usuário encontrou ao tentar abrir o portal como
sócio.

Abaixo de `/portal` há duas entradas com donos diferentes, e por isso a guarda
de verdade não mora no layout de `/portal`: `(meu)/` é do cliente,
`[slug]/` é da gestão. O que o nível de cima faz é estreitar —
`exigirAreaDoCliente()` deixa passar cliente e gestão e recusa colaborador —,
e **não** decidir: uma guarda única lá em cima teria que aceitar as duas, que é
o mesmo que não guardar nenhuma.

**E as duas telas são o MESMO componente, com outro parâmetro.** Início e
Materiais vêm de `components/portal/telas/`, e o que muda é `clienteId`
(obrigatório para a equipe, que enxerga todos os clientes pelo RLS),
`comoEquipe` (desliga o registro de acesso e troca as frases: "Você aprovou"
vira "O cliente aprovou") e `base` (o prefixo dos links). Uma segunda tela
parecida divergiria na primeira mudança, e a visualização existe justamente
para conferir o que ele enxerga.

**Configurações é a única exceção, e é por causa de uma regra.** As
preferências de aviso são de cada pessoa — `client_notification_prefs` fecha em
`auth.uid()` nas quatro operações —, então nem a gestão as lê. A tela diz isso
em uma frase, em vez de mostrar campos vazios; e "Quem tem acesso" é montado
por `usuariosDoPortal()`, com as policies de `is_staff()`, porque
`usuarios_do_meu_cliente()` fecha em `my_client_ids()` e devolveria nada.

O slug sai do nome da empresa e **não pode ser uma palavra que já é rota**
(`campanhas`, `aprovacoes`, `painel`…): no Next a rota estática ganha da
dinâmica, então o portal daquele cliente é que nunca abriria.

### Gestão de Pessoas: Equipe e Clientes numa aba só

`/painel/pessoas`, com a aba na URL. Eram dois itens de menu e viraram um, por
decisão do usuário, escolhida entre três propostas de layout. As duas listas
são as mesmas de antes.

**Não foram fundidas numa tabela só**, e essa era a proposta B: "Mundo Verde" é
uma empresa e "Joana Prado" é gente. Na mesma tabela, a linha passa a
significar duas coisas e as colunas Cargo e Área ficam vazias em metade delas.
Elas continuam separadas no banco porque são coisas separadas; o que mudou é
que a tela reflete isso com duas abas em vez de dois módulos.

**A proposta C — por conta, com quem da agência atende cada cliente — ficou de
fora porque essa relação não existe no produto.** É a decisão em suspenso
registrada acima ("qualquer gestor aprova a etapa de qualquer cliente"): se for
para existir, é migration própria.

As fichas moram em `/painel/pessoas/clientes/[id]` e `.../equipe/[id]`, e não
têm entrada própria no `MENU` — `findMenuItem` casa por prefixo. Os caminhos
antigos viram 308 em `ROTAS_RENOMEADAS`, e **as fichas vêm primeiro na lista**:
o Next casa na ordem, e `/painel/clientes/:id` precisa ser testado antes de
`/painel/clientes`, senão a ficha cai na lista e o id se perde no caminho.

### Dois módulos que saíram: Resumo Semanal e Financeiro Pessoal

Apagados na migration 0034, por decisão do usuário: tela, rota, dados e
tabelas. **O módulo pessoal que FICA é o de Notas Fiscais** — a nota que o
colaborador manda para a agência pagar. O Financeiro da casa
(`contracts`, `finance_categories`, `finance_entries`) também fica: é outro
módulo, na Gestão, e só o sócio alcança.

**Eles eram os dois extremos do sigilo do produto**, e é por isso que a
remoção merece registro em vez de silêncio. `weekly_entries`, `weekly_notes` e
`personal_finance_entries` fechavam em `user_id = auth.uid()` nas quatro
operações — nem o sócio lia. Consequência prática: **ninguém sabia o que havia
dentro delas sem consultar o banco como dono**, e foi por isso que a 0034 veio
com `scripts/exportar-antes-da-0034.sql`, que põe o conteúdo na tela para ser
entregue a quem escreveu. O script não exporta para lugar nenhum de propósito:
gravar aquele texto em outra tabela seria contornar a promessa que ele
carregava.

**Apagar, e não aposentar.** É a mesma decisão da 0023, que apagou
`tasks.exigencia_aprovacao` em vez de deixá-la parada. Tabela que nenhuma tela
lê é schema que alguém reaproveita errado três sprints depois, achando que
ainda significa alguma coisa.

O que sobrou de propósito: o enum `pf_tipo`, órfão e inofensivo — `alter type
... drop value` não existe no Postgres, e é a mesma situação de `cancelada` em
`task_status` desde a 0020.

**E os dois nomes entraram na varredura de `check:cores`.** A lista de nomes
mortos **cresce**, como a do vocabulário do Full Days: um módulo apagado volta
sozinho de um jeito específico — alguém copia uma tela antiga, um atalho fica
no menu, um texto de ajuda cita a "letra de cada semana" — e aí o link existe
e a rota devolve 404. A varredura cobre `src/`, e a explicação mora aqui e no
cabeçalho da 0034, fora de `src/`, senão ela acusaria o próprio texto que a
justifica.

Junto saiu a bandeira `discreto` do `MenuItem`: ela existia para o Financeiro
Pessoal ter ícone menor e cor mais apagada, e sem ele virou um campo que
nenhuma linha do `MENU` liga. Se um dia houver outro módulo opcional, ela
volta com ele.

### O terceiro módulo que saiu: Meu Desenvolvimento

Apagado na migration 0043, por decisão do usuário: tela, rota, a aba Skills em
Equipe, a vitrine da Academy e duas tabelas — `user_skills`, a autoavaliação de
cada pessoa, e `skill_avaliacoes`, a observação que a gestão escrevia sobre
alguém.

**O CATÁLOGO FICA, e é a escolha explícita.** `skills` continua, agora com um
papel só: o vocabulário de etiquetas do Full Academy, por
`academy_materials.skill_id`. Apagá-lo junto levaria a etiqueta de cada
material — e a Academy perderia a única coisa que organiza o que ela guarda.

**Por que isto não é a 0034.** Lá as três tabelas fechavam em
`user_id = auth.uid()` nas quatro operações, e **ninguém** — nem o sócio —
sabia o que havia dentro sem consultar o banco como dono: o script de
exportação era *condição* para apagar. Aqui as duas sempre foram legíveis por
`is_gestor()`, porque a matriz da agência lia `user_skills` inteira e a
observação a própria pessoa lia. `scripts/exportar-antes-da-0043.sql` existe
como **conveniência**, não como condição.

**E a sugestão de skill saiu junto**, que é a parte que passa batida. O
catálogo tinha dois caminhos de entrada: a gestão cria, e qualquer pessoa da
equipe **sugere** — a sugestão nascia com `ativa = false` e `sugerida_por`
preenchido, e a fila de aprovação ficava na tela que saiu. Sem ela,
`sugerida_por` vira coluna que nenhum caminho preenche e nenhuma tela lê, e a
policy oferece uma porta que só quem monta requisição à mão encontra. As duas
somem: quem decide o vocabulário de etiqueta da Academy é quem cuida da
Academy.

`ativa` **fica**: é como a gestão tira do ar uma etiqueta que a agência não usa
mais sem apagar a que já está em material antigo — e apagar continua recusado
para todo mundo, inclusive o sócio.

**A vitrine "sugeridas para você" da Academy saiu com a origem do sinal.** Ela
lia o que a pessoa marcava como "quero desenvolver", e sem isso não há o que
sugerir: manter a seção lendo outra coisa seria inventar uma preferência que
ninguém declarou, e uma sugestão inventada gasta a credibilidade da seção
inteira.

**A lista de nomes mortos do `check:cores` cresceu de novo**, e agora tem três
gerações — o Financeiro Pessoal (Sprint 8), o Resumo Semanal (0034) e este.
**Ela cresce em vez de ser substituída**, pela mesma razão do vocabulário do
Full Days: nenhuma geração pode voltar, não só a última.

`skills` e `skill_id` **não entram na lista**, e a distinção é o ponto: o que
saiu foi a autoavaliação, não a etiqueta.

**A varredura pegou três coisas de verdade nesta remoção**, e as três teriam
passado no `npm run build`: duas consultas órfãs a `user_skills` em
`lib/dados/academy.ts`, que falhariam no banco depois da migration; os tipos
das duas tabelas ainda declarados; e os meus próprios comentários explicando a
remoção **citando os nomes que ela proíbe**. O último é a mesma armadilha da
0016 e da 0034: a explicação não pode carregar o que ela proíbe — ela mora no
cabeçalho da migration e aqui, fora de `src/`.

**A ordem da migration também não é estilo.** `skills_insert` citava
`sugerida_por` no `with check`, e o `drop column` estourou com *"cannot drop
column because other objects depend on it"* — a policy vem primeiro. É a mesma
pegadinha que a 0039 teve com `ano_referencia`, onde a dependência vinha do
`update of <colunas>` de um trigger: coluna citada em policy ou em trigger não
sai enquanto quem a cita estiver de pé.

**E as abas de Equipe sumiram junto com a segunda.** Uma barra de navegação com
um item é moldura sem função — a mesma razão pela qual as abas do Full Days
somem para quem só propõe o próprio período. O módulo voltou a se chamar
**Equipe**.

### O Financeiro da agência é só do sócio

`contracts`, `finance_categories` e `finance_entries` fecham em `is_socio()`
nos quatro comandos. **Não existe "só leitura para o gestor", e a omissão é
deliberada:** o desenvolvedor é gestão para todo o resto do sistema — cadastra
cliente, aprova entrega, distribui trabalho — e aqui não. Faturamento por
cliente, margem e inadimplência são a informação mais sensível da casa; quem
pode lê-la é quem responde por ela.

**Ele é o extremo do sigilo que sobrou.** Houve o outro — dois módulos onde
nem o sócio entrava —, e eles saíram do produto na 0034. Aqui é o inverso: só
ele entra. O que continua valendo é a razão de a policy ser por comando e não
por tabela: quem mexer numa delas vê as outras três na mesma tela.

**A aba de Notas Fiscais que o sprint pedia não existe.** A agência emitir NF
para cliente ficou fora do Full Hub por decisão do usuário; o módulo de nota
fiscal que existe é o **da pessoa** (`/painel/notas-fiscais`), a nota que o
colaborador manda para a agência pagar.

#### Três datas, e elas não são a mesma coisa

`competencia` é o mês **a que** o valor se refere, `vencimento` é quando
deveria entrar ou sair, `pagamento` é quando entrou ou saiu. Um campo só
obrigaria a escolher entre "quanto a agência produziu em setembro" e "quanto
entrou no caixa em setembro", que são as duas perguntas que o sócio faz.

A competência é gravada sempre no dia 1, por trigger: guardar `2026-09-17`
faria "setembro" depender de qual dia foi digitado.

#### Atraso é derivado, nunca gravado

`atrasado` está no enum, e **nenhuma linha o carrega**: um trigger reescreve
para `previsto` quem tentar gravá-lo à mão. A situação sai de
`situacao_do_lancamento()` no Postgres e de `situacaoDoLancamento()` em
`lib/dominio/financeiro.ts` — as duas existem de propósito, como a máquina de
estados da subtarefa.

É a mesma razão pela qual bloqueio de subtarefa não é status: atraso depende da
data de hoje. Uma coluna precisaria de uma rotina noturna para continuar
verdadeira, e no dia em que ela não rodasse o relatório mentiria sem avisar
ninguém. Por isso `atrasado` também não é opção no formulário.

#### Gerar lançamentos do mês não duplica

A trava é o índice único `(contract_id, competencia)`, parcial, **não** a
consulta da action: duas abas abertas clicando ao mesmo tempo passariam pelas
duas consultas antes de qualquer uma gravar. E não roda sozinho ao virar o mês
— receita que aparece sem ninguém ter mandado é receita que o sócio confere uma
por uma antes de confiar no relatório.

A recorrência conta a partir do mês de início, não do calendário: um contrato
anual assinado em março cobra em março. Dia 31 em fevereiro vira o último dia
do mês, senão um contrato que vence "no fim" pularia para março.

#### A rentabilidade cruza receita com o tempo das SUBTAREFAS

O sprint pedia `tasks.tempo_real_horas`, que **não existe desde o Sprint 3B**.
Quem tem tempo é a subtarefa (`tempo_real_minutos`), e ressuscitar a coluna
antiga contrariaria a regra de que nenhuma consulta pode trazê-la de volta — o
número sairia zerado de qualquer jeito.

Cliente sem hora lançada aparece com "sem hora registrada", nunca com zero:
zero é uma afirmação sobre a conta, e o que se quer dizer é que ninguém mediu.

#### Cor de gráfico não é cor de estado

`--serie-1`, `--serie-2` e `--serie-neg` são tokens próprios, e os valores
foram **medidos, não escolhidos**. Receita em verde e despesa em vermelho é o
encode óbvio e reprova: o par dá ΔE 4,2 em deuteranopia — as duas linhas ficam
idênticas para quem tem daltonismo vermelho-verde, que é o mais comum. O par
azul/roxo dá 9,4; o eixo azul/laranja do saldo dá 20,5.

No tema escuro os valores **não** são os claros invertidos: são passos próprios
medidos contra o fundo escuro, porque clarear os do tema claro estoura a faixa
de luminosidade e as marcas perdem croma — viram cinza.

Os gráficos são SVG à mão, sem biblioteca: a cor tem que sair dos tokens (toda
lib traz a própria paleta, e `check:cores` recusa hex solto), e assim o tema
escuro funciona sozinho.

### Full Days: recesso, indisponibilidade e ausência

#### O vocabulário não é de direito trabalhista, e isso é regra

**A equipe da Full Connect Key é toda PJ.** Palavra da CLT num sistema da
própria contratante — férias, licença, folga, abono — não é impropriedade de
linguagem: é prova documental. Num pedido de reconhecimento
de vínculo, o que se junta aos autos é exatamente isto — o sistema da empresa
concedendo férias e registrando folga.

O produto fala de **disponibilidade**, não de direito:

| Era | É | Por quê |
| --- | --- | --- |
| Férias | **Descanso** | o período longo previsto em contrato |
| Licença | **Afastamento** | o período sem previsão de volta |
| Ausência | **Ausência pontual** | um dia ou dois |
| Folga | **Sem alocação** | "folga" pressupõe jornada, e jornada pressupõe vínculo |
| Aprovar / Reprovar | **De acordo / Preciso remarcar** | hierarquia de aprovação é indício de subordinação |

**Duas rodadas, e a segunda foi decisão explícita.** A migration 0016 trocou
por "recesso programado" e "indisponibilidade"; a **0018** trocou de novo, para
as palavras da tabela. Ficou registrado no cabeçalho da 0018, e vale repetir
aqui para não ser desfeito como se fosse descuido: **foi observado que
"afastamento" é palavra corrente na CLT e na previdência** — afastamento por
doença, afastamento previdenciário — e que por isso ela é mais carregada que
"indisponibilidade", não menos. A decisão foi mantida por quem responde pela
exposição. Quem for mexer nisso de novo, mexa sabendo disso.

**"Feriado" fica**, e a diferença importa: feriado é data do calendário
nacional, um fato sobre o dia. Não é direito concedido a ninguém.

Onde a regra é aplicada, e onde ela **não** é:

- `ROTULOS_DE_TIPO`, `ROTULOS_DE_STATUS` e `ROTULOS_DE_PRESENCA` em
  `lib/dominio/full-days.ts` são o mapa por onde passa todo rótulo de tela.
  É por existir esse lugar único que a troca coube num arquivo.
- As mensagens que **nascem no Postgres** não passam por esse mapa: chegam
  prontas. A migration 0016 reescreve as frases de `validar_solicitacao`,
  `decidir_solicitacao` e `proteger_presenca_de_pedido`, e
  `05_full_days.sql` varre o corpo dessas funções atrás das frases antigas
  **e** confere que as novas estão lá — apagar a mensagem inteira passaria
  por uma varredura que só procurasse o que saiu.
- **Nome de coluna, valor de enum e nome de função continuam como estavam**
  (`hr_tipo` com `ferias`/`licenca`, `dias_ferias_ano`, `saldo_de_ferias()`,
  o token `--ferias`). As constantes em TypeScript, essas sim, acompanharam:
  `DIAS_DE_DESCANSO_PADRAO` e `PARCELAS_DE_DESCANSO_PADRAO` — identificador em
  português é a camada que a convenção manda traduzir. Decisão explícita: renomear valor de enum em uso é
  migration arriscada, e ninguém que usa o sistema vê esses nomes. A
  consequência aceita é que quem ler o schema vê o vocabulário antigo.
- `npm run check:cores` varre `src/` atrás de "férias" e "licença"
  **acentuados** — as formas sem acento são justamente as chaves de enum que
  ficaram — **e também atrás de "recesso" e "indisponibilidade"**, que foram o
  vocabulário entre a 0016 e a 0018. A lista **cresce** em vez de ser
  substituída: nenhuma geração de palavra pode voltar, não só a última, senão
  alguém copiando uma tela antiga ressuscita a penúltima sem ninguém notar. E varre sem exceção de arquivo: a explicação da regra mora aqui e
  no cabeçalho da 0016, fora de `src/`, senão a varredura acusaria o texto
  que a proíbe.

**O alerta do relatório mudou de natureza, não só de palavra.** Ele dizia em
tela que "passados 12 meses sem descanso a empresa passa a dever em dobro" —
o art. 137 da CLT escrito dentro do produto. Agora aponta quem está há mais de
um ano sem parar, como risco de entrega e de esgotamento. O fato é o mesmo; a
afirmação, não.

> **O que trocar palavra não resolve:** saldo anual de dias, pedido que um
> superior responde e controle de presença diária continuam sendo o desenho da
> CLT. O vocabulário reduz o risco; a estrutura é o que uma perícia olha. Se um
> dia a agência quiser ir além, é decisão explícita — não um ajuste de texto.


**15 dias de descanso a CADA CICLO DE 12 MESES, em até duas parcelas por
ciclo.** Os dois números são colunas de `team_members` (`dias_ferias_ano`,
`max_parcelas_ferias` — nomes anteriores à troca de vocabulário), não
constantes no código: contrato muda por pessoa, e mudar contrato não pode
exigir deploy.

**O ciclo é contado da ENTRADA da pessoa, não do calendário** (migration 0039,
decisão do usuário). O saldo deixou de zerar em 1º de janeiro e virou um
número corrido: cada ciclo **soma** 15 dias e 2 parcelas, e o que sobrou de um
ciclo continua no seguinte. Quem entrou há três anos e nunca parou tem 60 dias
— quatro ciclos, porque o primeiro começa na entrada e os outros três nos
aniversários.

- `ciclos_de_descanso()` conta os ciclos, `inicio_do_ciclo()` diz quando o
  atual começou, e `saldo_de_ferias()` **perdeu o parâmetro de ano**. A âncora
  é `data_admissao`; sem ela, `created_at` da ficha — uma ficha incompleta não
  pode deixar a pessoa com zero dias.
- **Os 15 chegam no COMEÇO do ciclo**, e é o `+ 1` em `ciclos_de_descanso()`.
  A outra leitura possível — conceder só quando o ciclo se completa — é a
  regra do período aquisitivo da CLT, e deixaria quem entrou ontem doze meses
  sem descansar. Para inverter, é aquela linha, e a bateria tem o cenário que
  avisa.
- **`tasks.ano_referencia` foi apagada**, e ela tinha nascido na 0037 para
  keyar o saldo por ano. Sem conta anual não há atribuição a fazer — os dias
  contam, e o ciclo em que caem não muda nada. Apagar e não aposentar, como a
  0023 fez com `tasks.exigencia_aprovacao`.
- **A trava do descanso atravessando o ano saiu junto.** Ela existia porque
  28/12 a 03/01 viravam duas contas de saldo para o mesmo pedido. Agora são
  cinco dias. O cenário que provava a recusa ficou na bateria, virado do
  avesso.
- **A tela não soma mais o saldo sozinha.** Ela pergunta a
  `descanso_do_ciclo()`, que é a mesma conta que a trava do `insert` usa — o
  ciclo depende da data de entrada, que a lista de pedidos nem carrega. Duas
  contas com entradas diferentes divergiriam no pior lugar: a tela prometendo
  dias que o banco recusa.

> **O que isto custa, e foi dito a quem decidiu:** ciclo de 12 meses contado
> da entrada da pessoa é, **estruturalmente**, o desenho do período aquisitivo
> da CLT — mais parecido com ele que o ano civil, não menos. A nota do fim
> desta seção já dizia que o vocabulário reduz o risco e a estrutura é o que
> uma perícia olha. A decisão foi seguir assim mesmo. Quem for mexer nisso de
> novo, mexa sabendo disso.

**E eles contam CORRIDO** (migration 0024, decisão do usuário). Quinze dias
são quinze dias de calendário — sai numa segunda, volta na terceira segunda —,
e não quinze dias úteis, que na prática seriam três semanas inteiras.

**Os outros dois tipos continuam em dias úteis, e não é inconsistência:** eles
não descontam de saldo nenhum. O número deles diz quantos dias de TRABALHO a
pessoa ficou fora, e um sábado de ausência pontual não é um dia em que alguém
deixou de entregar.

Quem responde por qual conta é `dias_do_pedido(tipo, início, fim)` no Postgres
e `contarDiasDoPedido()` em `lib/dominio/full-days.ts`. E `rotuloDosDias()`
escreve "4 dias corridos" ou "2 dias úteis" onde a frase aparece — as duas
telas diziam "dias úteis" fixo, e um descanso de sexta a segunda apareceria
como "4 dias úteis", que é a tela desmentindo a própria conta.

A coluna continua se chamando `dias_uteis`, como `dias_ferias_ano` e
`saldo_de_ferias()` continuaram depois da 0016: renomear coluna em uso é
migration arriscada e ninguém que usa o sistema vê esse nome. Quem diz a
verdade para quem abrir o schema é o comentário da coluna.

- **Pendente conta como usado.** Sem isso a pessoa proporia 15 dias duas
  vezes enquanto o primeiro espera retorno, e o sócio concordaria com os dois
  sem ver o problema.
- **Só o sócio responde.** O desenvolvedor é gestão para todo o resto do
  sistema e aqui não — está escrito na primeira linha de
  `decidir_solicitacao()`.
- **A resposta é transacional, e por isso mora no banco.** Ela muda o status,
  pinta os dias em `team_presence` e avisa quem propôs; três chamadas pelo
  PostgREST seriam três transações, e a segunda falhando deixaria um pedido já
  combinado sem nenhum dia pintado.
- **O descanso pinta TODOS os dias do período**, fim de semana e feriado
  inclusive; os outros dois, só os úteis. Antes só os úteis viravam linha,
  para a contagem visual bater com o número combinado — e agora é o contrário:
  o número é corrido, então pular o sábado do meio é que faria a matriz
  mostrar menos dias do que o pedido diz. De quebra a faixa fica inteira, que
  é como um descanso se parece.
- **Dia que veio de período combinado não se edita na matriz.** Um clique
  apagaria o recesso de alguém e o pedido continuaria dizendo "de acordo" —
  duas verdades sobre o mesmo dia.
- Indisponibilidade e ausência pontual **não** descontam do saldo; entram na
  matriz e no relatório.
- O número gravado sai de `public.dias_do_pedido()`, não da conta da tela. A
  tela conta para mostrar o número enquanto a pessoa seleciona; se o gravado
  viesse dali, bastaria alterar o corpo da requisição.
- A **área** é o agrupamento que importa: quem responde precisa saber quem mais
  do mesmo time está fora. É por isso que o calendário bloqueia dias de colegas
  da mesma área **com o nome de quem está fora** — "indisponível" sem nome é
  uma recusa que ninguém tem como contornar nem entender.

#### A Matriz da Equipe: só a exceção é pintada, e a área tem régua

Escolha de layout entre três propostas, e é a B.

**A grade pinta SÓ A EXCEÇÃO.** Até aqui todo dia recebia a cor do seu estado,
"Disponível" inclusive — e como quase todo dia de quase todo mundo é
disponível, o resultado era uma parede verde com alguns furos: a pessoa
procurava o furo, quando o desenho devia fazê-la achar a informação. Agora o
dia normal não tem cor nenhuma e o que salta é quem está fora. Fim de semana e
feriado ficam num cinza claro, não em branco: sem a distinção, um descanso de
sexta a segunda parece ter um buraco no meio.

**Cada ÁREA carrega uma régua de cobertura**: uma célula por dia com quantas
pessoas dela estão fora naquele dia. Âmbar em 1, vermelho em 2 ou mais, ponto
quando não há ninguém. É a resposta de "a área aguenta?" sem contar linha por
linha — com quinze nomes na tela, dois da mesma área na mesma semana só
aparecem para quem for contar.

**O limiar é o MESMO do calendário de pedido, e isso não é coincidência.** Lá,
um dia em que qualquer colega da área está fora já é recusado
(`bloqueiosNoIntervalo`); aqui esse mesmo dia é o âmbar. O vermelho é o que já
passou disso — dois ou mais fora ao mesmo tempo, estado que só chega até aqui
por lançamento retroativo ou por decisão do sócio. Duas telas com dois limiares
seriam duas verdades sobre a mesma equipe, e a pessoa descobriria isso levando
um "não" num dia que a matriz pintou de verde. A conta é `coberturaDaArea()`
em `lib/dominio/full-days.ts`, um lugar só.

**Remoto não conta como fora**, e é a distinção inteira: quem trabalha de
outro lugar está trabalhando. Contá-lo acenderia alerta onde não há risco, e
quem vê um alerta falso duas vezes para de olhar para o alerta. "Sem alocação"
também fica de fora, por um motivo mecânico além do conceitual — é o estado
padrão de sábado e domingo, e com ele na conta todo fim de semana apareceria
como a área inteira fora.

**A legenda perdeu o "Disponível"** junto com a cor dele. Item de legenda para
uma cor que não aparece é pior que um item a menos: a pessoa procura o verde,
não acha, e passa a desconfiar do resto da legenda. E a amostra de "sem
alocação" acompanhou o tom claro que a grade passou a usar.

**A tela de pedido é uma faixa de saldo, um painel de configuração e o
calendário** — e não mais as três seções numeradas que ela teve até aqui. A
escolha é de layout entre três propostas, e é a A. Ela deixou de ser
formulário e virou ferramenta: quem entra ali não está preenchendo campos na
ordem, está escolhendo dias num calendário e olhando o que isso faz com o
saldo.

- **O saldo ABRE a tela, numa faixa de `--blue-soft` com a frase inteira**
  ("Você tem 5 de 15 dias disponíveis") e a barra de uso ao lado. Ele era um
  cartão no painel lateral, e era preciso varrer o olho até a coluna da
  direita para achar a primeira coisa que quem entra ali quer saber. Quem pede
  afastamento ou ausência pontual não vê saldo nenhum — não desconta.
- **A configuração fica à ESQUERDA e o calendário à direita**, invertendo as
  colunas. O calendário é a peça grande e é onde a mão trabalha; o painel é o
  resumo do que ela fez. Em 375px a ordem de leitura vira a de cima para
  baixo, e o painel é o primeiro — no celular o calendário rola dentro de si
  mesmo, e um resumo embaixo dele fica longe do polegar.
- **O tipo de pedido é um `radiogroup` de três cartões**, cada um dizendo
  embaixo do nome se desconta e quanto (`desconta (15d)` / `não desconta`). Um
  `<select>` escondia exatamente a informação que faz a pessoa escolher entre
  os três, e ela é diferente por tipo.
- **As abas viraram pílulas.** A barra sublinhada funciona quando as abas
  ficam grudadas no conteúdo delas; aqui elas ficam acima da faixa de saldo,
  que já tem fundo próprio, e duas linhas horizontais seguidas — a borda da
  aba e a borda da faixa — liam como duas divisões sem nada no meio.
- **"Quem responde: Sócio" fica no cabeçalho**, em `PageHeader actions`. É a
  resposta de "para quem estou mandando isto", e ela não pode estar no fim da
  página, depois de a pessoa já ter escolhido tudo.

**A célula do calendário é ALTA e tem duas linhas**, e a de baixo carrega o
nome de quem está fora ("Marina", ou "Marina +2"). Antes isso vivia só no
`title`, e tooltip não existe para quem usa toque nem para quem varre a tela
com o olho: a pessoa via um quadrado âmbar, não sabia de quem era, e clicava
para descobrir. A lista inteira continua no `title` e no rótulo acessível —
truncar dois nomes no meio não identifica nenhum dos dois.

**O calendário vai de JANEIRO DE 2025 A DEZEMBRO DE 2030, e abre no dia de
hoje.** As duas bordas são fixas — `PRIMEIRO_MES_DO_CALENDARIO` e
`ULTIMO_MES_DO_CALENDARIO`, em `lib/dominio/full-days.ts` —, e a janela de
meses montados é contada a partir do mês corrente, que é onde a rolagem
começa. Quem entra não rola setenta e dois meses para achar esta semana.

**Era relativo, e a borda ANDAVA.** Com "três meses para trás e doze para
frente", em setembro de 2026 a pessoa alcançava junho daquele ano e em outubro
não alcançava mais: o mesmo dia deixava de existir na tela de um mês para o
outro, sem nada avisando. Uma data fixa não anda.

**As constantes moram no módulo de domínio e não no componente, porque quem
pergunta são DOIS.** O calendário monta os meses com elas; a página busca
feriados e dias de colega com elas. Divergindo os dois números, a pessoa rola
até 2025 e vê um ano inteiro sem feriado e sem ninguém fora — e essa tela não
parece quebrada, parece um ano vazio. E não podiam morar no componente por
mecânica, não por gosto: `calendario-rolavel.tsx` é `"use client"`, e valor
exportado de arquivo cliente não vale no servidor.

**A âncora é grampeada dentro do intervalo, e o botão "Hoje" some com ela.**
Passado dezembro de 2030, abrir "no mês corrente" seria abrir num mês que o
calendário não oferece. Ele abre na borda, e o botão desaparece: não há para
onde ir, e um botão que não faz nada é pior que um botão a menos.

**A tabela de feriados foi atrás do calendário** (migration 0038): a 0011
cobria 2026 e 2027, que eram os anos que o calendário de então alcançava. Um
ano sem feriado na tabela não aparece vazio — aparece **normal**: o Natal de
2029 vira um dia útil qualquer e um afastamento de três dias em cima dele sai
com três no lugar de dois. Ninguém desconfia olhando a tela.

**Quantos meses cabem na linha é pergunta de largura, não de breakpoint:**
`repeat(auto-fill, minmax(min(420px, 100%), 1fr))`. A coluna do calendário
muda de tamanho com o painel ao lado, e um `lg:` fixo dava 60px por célula,
onde "Marina" virava "Ma…" — que não identifica ninguém e ainda ocupa a linha.
O `min(420px, 100%)` é a parte que não dá para tirar: `minmax(420px, 1fr)`
cria uma faixa que **nunca** encolhe abaixo de 420, então num celular de 375 o
mês fica mais largo que a tela — sábado e domingo saem para fora da borda e os
dias 10, 17, 24 e 31 aparecem cortados pela metade. Um calendário sem fim de
semana, sem nada avisando. Foi assim que ele saiu na primeira imagem de 375px,
e é por isso que a conferência dessa tela é a imagem e não o build.

**O bloqueio por área pergunta sobre o INTERVALO, nunca sobre o dia solto.**
A tela olhava dia a dia, e o resultado eram duas respostas para a mesma
situação: clicar no dia 8 não fazia nada, mas escolher de 5 a 20 — que passa
por cima do 8 — era aceito, com um aviso dizendo "dá para propor assim mesmo".
Decisão do usuário: bloquear de verdade. `bloqueiosNoIntervalo()` responde
pelo período inteiro, e os dois caminhos de seleção passam por ela.

**E a recusa nomeia quem está fora e em que dia.** Um clique que não faz nada
e não explica manda a pessoa clicar de novo, mais forte, e desistir —
`motivoDoBloqueio()` escreve a frase. Arrastando, a recusa é silenciosa: a
seleção não passa do bloqueio, porque um toast por movimento do mouse
empilharia dez avisos iguais antes de a pessoa soltar o botão.

#### Registrar período que já aconteceu — da gestão, e só dela

A aba **Registrar período** (`?aba=lancamentos`) é onde a gestão grava o
histórico: o descanso que a pessoa tirou antes de o Full Hub existir, o dia
combinado por mensagem. Nasce `aprovada`, com `origem =
'lancamento_retroativo'`, pinta a matriz na mesma transação e **desconta o
saldo do ano** — que é o ponto inteiro: sem isto, quem tirou dez dias em
janeiro aparece com os quinze disponíveis em outubro.

**É `is_gestor()`, e não `is_socio()` como a fila.** Responder a um pedido é
decidir sobre o trabalho de alguém, e essa decisão o produto reserva ao sócio;
registrar o que já aconteceu é lançar histórico, e travá-lo numa pessoa só
para a agência no dia em que ela estiver fora. **O colaborador não alcança**:
`QUEM_VE` em `page.tsx` esconde a aba e devolve 403 para quem digitar a URL,
`lancar_periodo()` confere `is_gestor()` na primeira linha, e a policy de
INSERT de `hr_requests` exige `is_gestor()` para qualquer `origem` que não
seja `solicitacao`. São as três camadas de sempre, e a terceira é a que vale.

**Ele não passa pela fila, e a ausência é o desenho.** O período já ocorreu —
perguntar "de acordo?" sobre a semana passada é teatro: não há decisão a
tomar, há um fato a registrar.

**O calendário desta aba recusa o FUTURO**, espelhando a de propor, onde o
passado é que é recusado para descanso e afastamento. O motivo não é simetria:
para um período que ainda não aconteceu a decisão AINDA EXISTE — cobrir a
ausência, remarcar — e ela é do sócio, na fila. **É guarda de tela:**
`lancar_periodo()` não olha data, e quem chamar a função direto grava um
período futuro do mesmo jeito. Se precisar ser trava, é um `if` dentro da
função.

**Corrigir e apagar só alcançam o que foi lançado.** `corrigir_lancamento()` e
`apagar_lancamento()` recusam `origem = 'solicitacao'`: reescrever por fora um
período que a pessoa propôs e o sócio respondeu apagaria a decisão dele sem
deixar marca. E a lista desta aba filtra `origem <> 'solicitacao'` — misturar
as duas faria a gestão procurar, entre trinta linhas, as três que ela pode
corrigir, porque o banco nega as outras e a tela ofereceria um botão que não
funciona.

**A pessoa não troca na correção**, e a função nem aceita o parâmetro: mudar o
dono seria apagar os dias de um e pintar os de outro numa ação chamada
"corrigir". Trocou de pessoa, apaga e lança de novo.

**Apagar e não desativar**, ao contrário de pessoa e de cliente: aqui não há
histórico a preservar. Um registro errado é um fato que não aconteceu, e
deixá-lo marcado como cancelado é deixar um dia pintado na matriz de alguém
que trabalhou naquele dia.

**Importar planilha ficou de fora, e é decisão do usuário.** O histórico que a
agência tem cabe em algumas dezenas de linhas, e uma importação sem
pré-visualização grava trinta registros errados de uma vez. Se vier, vem com a
tela de conferência junto.

**A aba se chama "Registrar período", e a chave na URL é `lancamentos`.** A
chave é o nome do que o banco faz; o rótulo diz o que a pessoa vai fazer.
"Lançamento" é palavra do Financeiro neste produto, e a mesma palavra em dois
módulos para duas coisas diferentes é como se aprende a ler errado as duas.

**Isto é guarda de tela, e não vale como trava.** Quem chamar a API direto
grava o pedido do mesmo jeito — não existe regra de área no banco. O que
impede a demanda de seguir é o sócio, que vê "quem mais da área está fora" na
fila antes de responder. Se um dia isso precisar ser trava, é trigger em
`validar_solicitacao`, não mais `if` na tela.

### Full Academy: organizar conteúdo, não avaliar gente

`academy_tracks` (a trilha) e `academy_materials` (o que tem dentro), com
`academy_progress` guardando o que cada pessoa já viu.

**Não existe quiz, certificado, nota nem gamificação, e a ausência é o
desenho.** O objetivo é organizar o que a agência já sabe, não medir quem
aprendeu; no dia em que a Academy der nota, ninguém mais marca "não vi" e o
acompanhamento deixa de dizer a verdade.

**`scripts/verificar-9.mjs` varre o TEXTO RENDERIZADO, e não o código-fonte.**
Uma busca no fonte acusaria `DateBadge` por conter "badge" e o comentário que
explica a regra por citar o que ela proíbe — a mesma armadilha que a lista de
nomes mortos já pagou três vezes. O que importa é o que a pessoa lê, então o
gerador de protótipo grava o HTML de cada tela ao lado da imagem e a checagem
lê dali. **Sem os dumps ela FALHA**, nunca passa em branco: uma checagem que
não encontra o que conferir e termina verde afirma sobre telas que ninguém
olhou.

**E as checagens de perfil são de MÃO DUPLA.** A aba de gestão tem que estar
na tela do sócio **e** faltar na do colaborador — só a segunda metade passaria
numa tela que parou de mostrar a aba para todo mundo. **O que ela não prova:**
os dumps saem do protótipo, que troca `lib/dados/` por dados de exemplo, então
isto não testa RLS. Quem testa é `supabase/testes/09_academy_e_recomendacoes.sql`,
contra um Postgres de verdade. Uma é propriedade de tela, a outra é do banco.

- **Trilha nasce em rascunho.** Enquanto `publicada = false`, ela não volta do
  banco para quem não é gestão — a policy `academy_tracks_select` fecha em
  `is_staff() and (publicada or is_gestor())`. A tela **não** repete esse
  filtro: dois lugares decidindo a mesma coisa é como nascem duas verdades.
- **O progresso é da pessoa, e a anotação também.** `academy_progress` escreve
  só em `user_id = auth.uid()`. A gestão lê a conclusão — e só ela: o
  acompanhamento passa por `academy_progresso_da_equipe`, uma view
  `security_invoker` que **não tem a coluna `anotacoes`**. Policy não limita
  coluna, então a separação é a view. A tela diz isso em voz alta nos dois
  lados ("Só você lê isto" no material, "não aparece aqui" no
  acompanhamento), porque é a promessa que faz a pessoa escrever de verdade.
- **Vídeo do YouTube e do Vimeo abre incorporado; o resto abre em aba nova**,
  e a tela avisa antes do clique. `iframe` em site de terceiro quebra login,
  cookie e o botão de voltar — quem decide é `modoDeAbrir()`, em
  `lib/dominio/academy.ts`.
- **Reordenar material é uma chamada só** (`academy_reordenar`), e ela **não**
  é `security definer`: a RPC existe para gravar a ordem inteira numa
  transação, não para furar a RLS. Quem não pode editar a trilha continua não
  podendo, e a bateria tem cenário provando isso.
- A trilha aparece em "Recomendadas para você" quando toca uma skill que a
  pessoa marcou como `quer_desenvolver` — é o que liga a Academy ao Sprint 7.
  A vitrine sai da tela quando há filtro ativo: "Concluídas" e ainda ver uma
  vitrine de não iniciadas seria a tela contradizendo o próprio filtro.

### Recomendações: o módulo mais leve, e o desenho respeita isso

`recommendations`, `recommendation_likes` e `recommendation_comments`. Alguém
posta o que valeu o tempo dela — um filme, um curso, uma ferramenta —, os
outros curtem e comentam.

**Não há fila, não há aprovação, não há gestor no caminho.** Qualquer
`is_staff()` publica; a única trava é título vazio, que não é recomendação.
Um módulo de indicação com aprovação prévia morre na segunda semana.

- **Editar é só do autor. Apagar, do autor ou da gestão.** A policy de UPDATE
  fecha no autor mesmo para o sócio: a gestão **modera apagando**, nunca
  reescrevendo o que outra pessoa disse.
- **Remover post alheio exige motivo, e o autor recebe o aviso.** O campo mora
  dentro do diálogo. A primeira versão deixava um input aberto em cada cartão,
  e três caixas de "Motivo da remoção" empilhadas viravam a coisa mais alta de
  um feed cuja graça é ser leve — foi a imagem do protótipo que mostrou.
- **A thread tem um nível só.** `rec_comments_um_nivel` recusa resposta de
  resposta no banco: conversa aninhada em três níveis é conversa que ninguém
  acompanha, e o feed não é um fórum.
- **Tag é normalizada nos dois lados** — `normalizarTag()` na tela e o trigger
  `recomendacoes_normalizar_tags` no banco, como a máquina de estados da
  subtarefa. Sem a da tela, o chip apareceria "Figma" e a nuvem mostraria
  "figma": a mesma tag parecendo duas.
- **O "agora" desce do servidor.** `tempoRelativo()` recebe o instante em vez
  de ler o relógio, senão o servidor renderiza "há 2 horas" e o navegador,
  noutro fuso, recalcula outra coisa na hidratação. Acima de uma semana a
  função devolve `null` e a tela mostra a data seca: "há 34 dias" informa
  menos que "31/08".
- Categoria, tag, busca e ordem moram **na URL**, como em toda listagem: "olha
  o que indicaram de ferramenta" precisa ser um link.
- São oito categorias e **quatro** pares de cor. Categorias próximas
  compartilham par de propósito — oito cores distintas num feed viram confete,
  e o que o selo precisa dizer é "isto é de assistir / de ler / de usar /
  outro". Par nomeado sempre, nunca opacidade.

**Nem a Academy nem as Recomendações abrem para o Portal do Cliente.** As duas
rotas moram em `(interno)`, nenhuma entrada do `MENU` aceita `cliente`, e a
RLS recusa o perfil nas seis tabelas — é o terceiro que vale.

### A tela inicial, as Métricas e o Resumo da Agência

O Sprint 15 é o que faz o Full Hub responder sobre si mesmo. A camada de
indicadores já existia — migrations 0035 e 0049 — e nenhuma tela a lia.

#### A Home tem NOVE blocos, e a ordem é a do dia da pessoa

Quem sou eu → o que eu entrego hoje → o que está parado me esperando → quem
não está aqui → para onde eu vou. E só então, para a gestão, o panorama:
Pulso, clientes parados, portais. **Quem abre esta tela abre para trabalhar**,
e o painel de indicadores no topo faria a gestão rolar todo dia por cima dele
para achar as próprias entregas.

**"Meu dia" é o MESMO componente de Minhas Tasks**, alimentado pela mesma
função. São duas idas ao banco e não uma — `home_summary()` traz os
contadores, `meuDia()` traz a lista com máquina de estados, cronômetro e
dependência em aberto —, e era isso ou desenhar aqui uma segunda lista
parecida, que divergiria no lugar mais caro: o botão que muda o status de uma
etapa. O que a Home acrescenta é a linha "e mais N esta semana", porque aqui
não há contador nenhum acima e sem ela a pessoa leria "dia limpo" sem saber
que quarta tem cinco entregas.

**Os blocos de exceção somem quando não têm nada a dizer** — rascunho a
expirar, o que precisa de mim, quem está fora, cliente parado. Uma caixa fixa
dizendo "nada aqui" ocupa todo dia, na primeira tela de todo mundo, o lugar de
uma informação que interessa em alguns dias. **O Pulso é a exceção**: zero
atrasada é a resposta boa, e um bloco que some nos dias bons ensina que ele só
aparece quando há problema.

**"Precisa de mim" tem TRÊS itens e não quatro.** O quarto que o sprint pede é
a nota fiscal recusada, e a tabela não existe — a agência emitir NF ficou fora
do produto por decisão do usuário. A ausência fica escrita no arquivo, porque
um bloco que entrega três de quatro sem dizer qual falta parece um bloco
completo.

**O estado de quem está fora passa pelo mapa de rótulos, sempre.** O banco
devolve o valor de enum, que ficou com o nome anterior à 0016 de propósito;
desenhá-lo cru poria o vocabulário que a 0016 e a 0018 tiraram do produto na
primeira tela que a agência abre todo dia — e a varredura de `check:cores`
**não pegaria**, porque o texto não está em `src/`: vem do banco.

#### `/painel/metricas`: cinco abas, e o período é uma CHAVE

`?aba=` com Produção, Onde o tempo vai, Estimativa × real, Qualidade da
entrega e Rentabilidade. O recorte é `?periodo=` — `30d`, `90d`, `mes`,
`trimestre`, `ano`, `livre` —, e só o livre grava as duas datas.

**Gravar as datas de um recorte pronto seria um link que envelhece calado.**
"Últimos 30 dias" salvo como `de=2026-08-26` é um endereço que, mandado na
segunda e aberto na sexta, mostra um recorte que já não é o de ninguém. Com a
chave, o link continua querendo dizer o que a pessoa quis dizer. Período
livre invertido é **trocado**, não recusado: os dois campos vêm da URL, e uma
tela em branco manda a pessoa descobrir sozinha qual dos dois está errado.

**O padrão são os últimos 30 dias e não "este mês":** no dia 2, "este mês"
calcula a taxa de entrega sobre três etapas e mostra um número que parece
medição e é ruído.

**`QUEM_VE` espelha a primeira linha de cada função da 0035** — quatro exigem
`is_gestor()`, a rentabilidade exige `is_socio()`. O desenvolvedor é gestão
para o resto do sistema e aqui não: faturamento por cliente é a informação
mais sensível da casa, e "só leitura para o gestor" não existe neste produto,
nem agregado. Esconder a aba não é a proteção: `?aba=rentabilidade` leva 403,
e a RPC chamada direto leva a recusa do Postgres.

**`ouFalha()` em todas, e aqui ele faz mais que de costume.** A recusa dessas
funções chega como ERRO e não como lista vazia; sem ele, quem não pode veria
um painel dizendo que a agência não produziu nada. **Painel zerado não parece
recusa, parece agência parada.**

**Nenhuma conta é refeita na tela.** A taxa de entrega no prazo usa o mesmo
denominador do `select` da 0035: etapa sem prazo fica FORA, porque não está no
prazo nem fora dele — somá-la como acerto faria o número subir quanto mais
desorganizada a agência ficasse. Ela volta **nula e não zero** quando não há o
que medir.

**O desvio de estimativa ordena pelo MÓDULO.** Quem entrega em metade do tempo
estimado erra o planejamento tanto quanto quem leva o dobro, e a segunda conta
é a que enche a agenda de todo mundo — ordenar pelo número com sinal esconderia
o subestimador no fim da lista.

#### `/painel/resumo-agencia`: a conversa de segunda-feira

O que saiu, o que ficou para trás, o que espera o cliente, o que vence na
próxima semana e quem não vai estar. A semana mora na URL (`?semana=`), sempre
normalizada para a segunda-feira.

**Ele é MÓDULO antes de ser tela** (`lib/reports/weekly.ts`): a mesma função
serviria um envio automático de segunda. O agendamento é de outro sprint, como
a limpeza de rascunhos e a geração de recorrências, então ela devolve o resumo
montado e não manda nada para lugar nenhum.

**O nome não é detalhe.** Um dos nomes mortos que `check:cores` varre junta as
duas palavras óbvias para esta tela — era um módulo apagado na 0034, o
registro **privado** de cada pessoa, que nem o sócio lia. Este é o panorama da
agência para a gestão. São coisas opostas, e a mesma palavra para as duas é
como se confunde as duas de novo daqui a três sprints.

**Os números saem de `producao_do_periodo()`**, a mesma função das Métricas,
com a semana como recorte. E **as listas contam só folha**, pelo mesmo motivo
que ela: a primeira versão mostrava "11 entregues" no cartão e sete na lista
logo abaixo — dois números para o mesmo fato, um do lado do outro. Foi a
imagem do protótipo que mostrou. `quemTemFilha()` é `subtask_eh_agrupadora()`
escrita do jeito que o PostgREST responde, porque ele não chama função do
Postgres num `where`.

**"O que ficou para trás" é medido HOJE**, e a frase diz isso: é o estado de
agora, como a situação do lançamento no Financeiro. Sem ela, quem abre a
semana passada acharia que aquelas etapas venceram naquela semana.

**Etapa sem dono aparece dizendo "sem responsável"**, e não como espaço em
branco: ela não está no "Minhas Tasks" de ninguém, que é o pior tipo de
trabalho — o que existe e ninguém sabe que é seu.

**A lista corta em oito e DIZ quantos sobraram.** Um resumo de sessenta linhas
não é resumo, e cortar calado faz a pessoa concluir que aquilo é tudo.

**Não há exportação aqui**, e a ausência é escolha: este resumo é para ler e
decidir. Quem precisa da planilha tem as Métricas, com o período livre e o CSV
de cada ângulo. Dois caminhos para o mesmo arquivo seriam dois formatos do
mesmo dado.

#### O CSV deixou de ter seis donos

`lib/dominio/csv.ts`. `montarCSV` e `lerCSV` moravam dentro de
`lib/dominio/financeiro.ts` desde o Sprint 8, e a Academy já importava dali
para exportar o acompanhamento de uma trilha — **importar do Financeiro é o
tipo de dependência que ninguém escolhe, só herda.**

As cópias já divergiam: o BOM que faz o Excel entender que o arquivo é UTF-8
estava em quatro das cinco telas, e o CSV da que faltava abria com
"Ã“ptica VisÃ£o". E `baixar` estava exportado de um arquivo `"use client"`,
onde só não tinha estourado porque nenhum Server Component o importava ainda.

#### `CartaoDeNumero`, e por que ele não é o cartão do Financeiro

`components/shared/cartao-de-numero.tsx`, com quatro tons. Aquele
(`financeiro/visao-geral.tsx`) formata dinheiro dentro de si e tem a barra de
proporção contra o previsto: generalizá-lo daria um componente com seis props
em que quatro são nulas em cada uso. **O tom é o par nomeado, nunca
opacidade** — inclusive a borda, que fica a do tema.

#### O bug que só a imagem de 375px pega, e ele era de dois sprints

`min-w-max` e `overflow-x-auto` na mesma tag não fazem nada: um elemento com
`min-w-max` tem exatamente a largura do conteúdo, então **nunca transborda a
si mesmo** — quem transborda é o pai. A barra de abas empurrava a página
inteira para os lados, e cabeçalho, conteúdo e rodapé saíam da tela. O scroll
passou para o `nav`. **O Full Days tinha a mesma linha desde o Sprint 6**, e
foi corrigido junto.

O outro foi em "Meu dia": com `min-w-0`, o título era o único a ceder largura,
e a linha cabia em qualquer tela encolhendo o nome da etapa até "Re…" para o
selo do cliente, o prazo e o Concluir continuarem lado a lado. Com um piso, o
resto quebra para a linha de baixo — que é o que o `flex-wrap` do pai está ali
para fazer.

#### O seed concluía etapa sem carimbo, e o número saía plausível

Duas etapas nasciam `concluida` por INSERT. **Trigger de UPDATE não roda num
INSERT**, então `concluida_em` e `iniciada_em` ficavam nulos — e toda conta que
pergunta "o que foi entregue" respondia ZERO num banco recém-semeado: as
Métricas, o Pulso da Home e o Resumo da Agência. É exatamente o bug que a 0052
encontrou no produto, e pelo mesmo motivo: **uma tela lê a coluna, o que ela
devolve é um número, e zero é uma resposta plausível.**

Agora elas nascem `nao_iniciada` e sobem por dois UPDATEs. São dois e não um
porque `iniciada_em` vem da entrada em `em_andamento` — e de quebra o gatilho
da 0035 grava as transições em `task_history`, sem as quais "onde o tempo da
etapa fica" nasce vazia.

### O sino

`notifications` **não tem policy de INSERT.** A única porta é a função
`notificar()` no Postgres: se qualquer usuário pudesse inserir, daria para
forjar um aviso no nome de outra pessoa, e um sino em que não se confia é pior
que nenhum sino. Um trigger também impede reescrever o título do próprio aviso
— policy não limita coluna.

A função nunca notifica quem causou o aviso. O sino é para o que os **outros**
fizeram.

Abrir a lista não marca tudo como lido: quem abre está conferindo, e muitas
vezes fecha para resolver depois.

### O e-mail que sai do Full Hub

`lib/email/`, e ele é o **segundo** caminho de aviso do produto — o primeiro é
o sino. Os dois respondem à mesma pergunta e falham de jeitos opostos, e é
essa diferença que decide o que vai em cada um.

**O SINO NUNCA PERDE UM AVISO; O E-MAIL PERDE TUDO O QUE NÃO PASSAR POR UMA
ACTION.** `notificar()` é função do Postgres, chamada de dentro de trigger:
ela vê o `update` colado no SQL Editor, o PATCH montado à mão, a escrita de
outro trigger. O Resend é HTTP, e o Postgres não fala HTTP — então o e-mail
sai da camada de aplicação, e só do que passa por ela. É a mesma assimetria
que a trilha de auditoria resolveu para o outro lado, e aqui não há escolha:
a alternativa seria um `pg_net` chamando uma API externa de dentro de uma
transação, o que põe a latência do Resend dentro do `commit` de quem clicou.

**A trava de sandbox é POSITIVA, e é a linha que mais importa do módulo.**
`destinoDoEnvio()` em `lib/email/config.ts` só deixa um endereço de verdade
passar quando `EMAIL_AO_VIVO` vale exatamente `"true"`. Não é `NODE_ENV`, e o
motivo é concreto: **`NODE_ENV` é `production` em todo build** — num
`npm start` local, numa cópia de homologação, no gerador de protótipo. Quem
copia o `.env` de produção para reproduzir um bug, que é exatamente o que se
faz para reproduzir um bug, mandaria e-mail para cliente de verdade sem ter
decidido isso em lugar nenhum. A pergunta certa não é "é produção?", é
**"alguém digitou que pode sair?"**.

**E desviar é melhor que engolir.** Fora de produção a mensagem vai inteira
para `EMAIL_DESVIO` — `delivered@resend.dev` por padrão, o sumidouro do
próprio Resend — com o destinatário pretendido no assunto. Não enviar nada
faria o assunto quebrado e o link errado aparecerem primeiro para o cliente.

**`npm run check:email` é a prova, e ela mede os DOIS sentidos.** Só a metade
"desviou" passaria numa função que desvia sempre — que não é a trava certa, é
uma trava quebrada em que **ninguém** recebe em produção e ninguém descobre,
porque e-mail que não chega não avisa. É a mesma família de
`check:preview`: uma trava que, quando some, faz o programa fazer MAIS coisas
não derruba build, não derruba tipo e não derruba teste de tela. A primeira
notícia seria um cliente respondendo um e-mail de teste, e e-mail enviado não
volta.

**Nenhuma cor no HTML da mensagem**, e é decisão registrada em
`lib/email/mensagens.ts`: `var()` não existe do lado de lá, o tema escuro do
Gmail reescreve a cor por conta própria, e um hex ali seria a quarta exceção
de `check:cores` — que cresceria uma por mensagem.

#### Quem recebe o quê

| Evento | Quem recebe | Governado por |
| --- | --- | --- |
| a agência enviou material | as pessoas da empresa | `novo_conteudo` |
| alguém comentou no material | as outras pessoas da empresa, e quem o produziu | `novo_comentario` |
| o cliente decidiu | quem enviou e quem produziu | nada — do lado de cá não há preferência |

**A preferência é lida com a chave de serviço, e é a única porta.**
`client_notification_prefs` fecha em `user_id = auth.uid()` nas quatro
operações desde a 0031 — nem o sócio lê, e isso continua de pé. Só que quem
precisa dela é justamente quem não é a pessoa, num instante em que não há
sessão nenhuma (o envio acontece dentro de `after()`). Com o cliente do
usuário a consulta volta vazia, e **vazia quer dizer "ninguém quer receber"**
— o mesmo modo de falha de sempre. O limite é o recorte:
`lib/email/destinatarios.ts` lê a preferência, devolve endereços, e não
mostra a linha em tela nenhuma.

**Quem nunca mexeu recebe o padrão**, porque a 0031 decidiu que a linha nasce
quando a pessoa mexe. E **quem causou o aviso não recebe**, que é a mesma
regra de `notificar()`.

**Duas escolhas da tela ainda não produzem e-mail, e a tela diz isso NELAS.**
`frequencia = 'diario'` e `lembrete_pendencias` dependem de uma varredura
diária, que é a parte que saiu do sprint com a VPS. A caixa continua ligável —
a escolha vale no dia em que a rotina existir —, mas escolher "uma vez por
dia" e não receber nada é, para quem escolheu, idêntico a ter escolhido
"nunca". A frase fica em `--warning`, junto de cada opção e não num aviso no
topo, porque **uma** das três caixas e **uma** das três frequências funcionam
normalmente.

**`novo_comentario` tem um produtor só, e é o portal.** A agência não tem hoje
de onde comentar um material do lado de lá — os comentários da demanda são
outra tabela e não chegam ao cliente. Então o evento nasce em
`comentarNoConteudo`, e o aviso vai para os dois lados: as outras pessoas da
empresa e quem está com o material na mão aqui. Sem a segunda metade, uma
dúvida escrita na sexta esperaria alguém abrir a tela para ser lida.

**O texto do comentário NÃO vai no e-mail.** Ele viajaria por uma caixa de
entrada, que é um lugar fora do portal — e o portal é onde o produto decide o
que cada empresa enxerga. O que sai é que há conversa nova, e onde ela está.

**E a empresa sai do CONTEÚDO, nunca de quem escreveu.** O atalho seria
perguntar em `client_users` de quem comentou, uma consulta a menos; o furo
aparece com quem responde por duas contas, e é o pior tipo: o título do
material da empresa A no assunto de um e-mail para a empresa B.

**Uma requisição por destinatário, e não um `to` com a lista.** Três endereços
no mesmo envio mostram a cada cliente quem mais recebeu.

**Sem `RESEND_API_KEY` nada quebra, e é isso que precisa estar escrito**: o
sino continua, o material continua no portal, e o que se perde é o aviso de
que ele está lá. `/status` diz as duas coisas separadamente — se a chave
existe, e se o envio está desviado —, porque "Resend configurado" é uma
resposta incompleta: com o desvio ligado o Resend responde 200 e ninguém
recebe.

### A pasta de entrega nasce no Drive

`lib/drive/`, e **não traz migration nenhuma** — que é a primeira coisa a
dizer sobre esta parte.

**A COLUNA JÁ EXISTIA, E NINGUÉM A ATRAVESSAVA.** `clients.drive_folder_id`
nasceu na **0002**, aparece no formulário e na ficha do cliente desde o Sprint
2, é protegida contra escrita do cliente desde a 0005 e foi relembrada por
nome na 0031, quando o slug entrou na mesma lista. Em vinte e tantos sprints
nenhuma linha de código a **leu**: ela era um campo de anotação. É a mesma
situação de `deliverables.subtask_id` antes da 0051 e de
`deliverable_versions` antes da tela de Campanhas — a ponte estava construída
e faltava alguém atravessar.

**Conta de serviço num Drive Compartilhado**, e as duas metades importam. A
conta de serviço não é uma pessoa: não recebe e-mail, não sai da agência e
**não tem cota de armazenamento** — o Google não dá "Meu Drive" a ela. Num
Drive Compartilhado o dono do espaço é a unidade, então a pasta nasce lá
dentro já visível para todo mundo que tem acesso, sem nenhuma chamada de
compartilhamento. O caminho contrário funcionaria e tem um custo que só
aparece depois: a pasta ficaria pendurada na conta de uma pessoa, e some com
ela no dia em que sair.

**O escopo é `drive.file`, e não `drive`.** `drive.file` dá acesso só ao que
esta aplicação criou — ela não enxerga nem toca em nada que já estava lá. O
escopo largo funcionaria igual e entregaria, junto, a chave de tudo o que a
agência guarda. *A consequência aceita:* uma pasta criada à mão não é achada
pela busca; para um cliente que já tem pasta, alguém cola o id dela na ficha —
no campo que existe desde a 0002 — e o Full Hub passa a criar as demandas lá
dentro.

**Nada apaga, move ou renomeia.** As duas coisas que o módulo sabe fazer são
procurar e criar. Uma integração que pode apagar precisa de uma pergunta antes
de cada chamada, e o que ela apagaria é o material entregue de um cliente.

**São dois níveis, Cliente › Demanda.** A tentação é o ano no meio, e ela é
forte — mas quem procura material procura pelo nome da demanda, e um nível a
mais é um clique a mais em toda visita para organizar o que ninguém navega. É
a mesma conta da árvore de entregáveis.

#### É um BOTÃO, e não acontece sozinho

Três razões, e as três são mecânicas:

- **rascunho criaria pasta.** A 0028 abre uma demanda no clique de "+ Nova
  task", e criar a pasta ali encheria o Drive de demanda que ninguém publicou;
- **a pasta já pode existir.** Quem abre demanda de cliente antigo tem o
  endereço na mão, e a 0015 diz em quantas palavras que pasta muda de lugar —
  o campo continua editável de propósito;
- **o título ainda está sendo digitado.** A tela salva sozinha campo a campo;
  a pasta nasceria com o título pela metade, e o Drive não desfaz isso.

**O botão some quando já há pasta.** Um "Criar no Drive" ao lado de um
endereço preenchido convida a criar a segunda pasta da mesma demanda — e o
Drive aceita duas irmãs homônimas sem reclamar, o que espalha o material entre
as duas. Com a integração desligada ele também não aparece: um botão que
responde "não configurado" ensina a não clicar nele.

**E não é `after()`, ao contrário do e-mail.** Aqui a pessoa está esperando o
resultado — o endereço é o que ela veio buscar. O e-mail é aviso; isto é o
trabalho.

**Procurar antes de criar**, sempre, e o custo está dito: não é atômico. Dois
cliques ao mesmo tempo passam pelas duas buscas antes de qualquer uma criar —
é o furo que a recorrência resolveu com índice único e que aqui não tem como
resolver, porque quem guardaria a unicidade é o Drive e ele não oferece uma. O
estrago é uma pasta vazia a mais; o caminho oposto espalharia o material.

#### O nome digitado não pode alcançar a consulta

`files.list` recebe um `q` que é uma **linguagem de consulta**:
`name = 'Mundo Verde' and '<id>' in parents`. O nome da empresa e o título da
demanda vêm de campos que alguém digita, e vão para dentro daquelas aspas.

**O caso benigno já basta para doer, e é comum:** um cliente chamado
`Bar do Zé's` quebra a consulta, o Drive responde 400 e ninguém liga uma coisa
à outra. O maligno é o mesmo mecanismo com intenção — um nome montado para
fechar a aspa faz a busca procurar outra coisa, e o produto grava o id do
primeiro resultado como se fosse a pasta daquele cliente.

São **duas travas independentes**: `nomeDePasta()` tira a aspa antes de o nome
virar pasta, e `escaparParaBusca()` escapa o que sobrar. A primeira sozinha não
bastaria — o id da pasta-mãe também vai para o `q` e não passa por ela.
`npm run check:drive` mede as duas, e mede a ordem: contrabarra antes de aspa,
porque invertido o escape da aspa seria escapado de novo e a aspa voltaria a
fechar a string.

**A barra também vira hífen**, e não é frescura: `/` é legal num nome de pasta
do Drive, e faz "Feed/story site" — que já existe como nome de entregável na
Wave — se ler como dois níveis que não existem.

**Sem credencial nada quebra.** O campo continua aceitando endereço colado à
mão, que é como o produto funcionou até aqui; o que some é o botão. `/status`
diz o que falta.

### A trilha de auditoria

`/painel/auditoria`, só do sócio. `audit_log` mais o trigger
`registrar_auditoria()` (migration 0058), com os rótulos em
`lib/dominio/auditoria.ts`.

**O sprint pede `activity_log`, e ela não existe.** Três cabeçalhos de
migration já registram isso — a 0035, a 0037 e a 0040. O que existe é
`task_history`, e ela responde a outra pergunta: em que pé esteve cada etapa e
quando.

**A auditoria não entra nela**, e a razão é a mesma que manteve Equipe e
Clientes em duas tabelas: na mesma tabela a linha passa a significar duas
coisas e metade das colunas fica vazia em cada metade das linhas. Pior aqui,
porque `task_history` é **lida por conta** — `producao_do_periodo()` e "onde o
tempo da etapa vai". Uma linha de "o sócio mudou o perfil da Joana" no meio
dela ou entra no número de produção da agência, ou obriga toda consulta
existente a ganhar um filtro — e a que esquecer o filtro mente sem avisar.

**Quem escreve é o trigger, nunca a action.** Uma auditoria escrita pela
camada de aplicação registra o que passou pela tela e ignora o resto: um PATCH
montado à mão no PostgREST, um `update` colado no SQL Editor, um trigger
interno. Ou seja, registra exatamente os casos em que ninguém duvidava e perde
os que motivam a auditoria. E seria um segundo lugar para lembrar: a action
nova que esquecesse de registrar não pareceria quebrada.

**Ela FALHA a escrita, e é o contrário do limite de tentativas.** A 0056
libera a tentativa quando o contador quebra, porque um limitador quebrado que
recusa tranca a agência inteira para fora do próprio sistema. Aqui é o
inverso: se não dá para registrar, não se faz. Uma auditoria que aceita a
escrita e perde o registro **produz a confiança sem a checagem** — o mesmo
erro da trava de aprovação que a 0023 desfez.

**SÓ O SÓCIO LÊ, e isso não é escolha de tela.** A trilha copia o trecho que
mudou de `finance_entries` e de `contracts`, que fecham em `is_socio()` desde
a 0013. Um log legível pela gestão seria a porta dos fundos daquela regra: o
desenvolvedor não lê a tabela e leria o valor no `depois`. **Um log é tão
sensível quanto a coisa mais sensível que tem dentro dele.**

**Sem policy de INSERT, de UPDATE nem de DELETE**, e as três ausências são a
regra: a única porta é o trigger, e nem o sócio reescreve nem apaga uma linha.
É a mesma forma de `client_access_log` e de `client_portal_views`, e a mesma
razão de `notifications` não ter insert — um registro que a própria pessoa
pode consertar não registra nada.

**O que ela guarda:** acesso, gente, dinheiro e decisão — oito tabelas com as
quatro operações. **E só o apagamento** de demanda, etapa, campanha, post e
material: cada mexida numa etapa viraria uma linha, e uma tela com trezentas
linhas por dia é uma tela que ninguém abre. O que não dá para reconstruir
depois é o apagamento — uma demanda que sai leva comentário, tempo e aprovação
com ela.

**E ela NÃO guarda o que o produto já registra de forma imutável.**
`approval_rounds` fica de fora: rodada fechada nunca é reescrita nem apagada,
e já carrega quem decidiu, quando e com que comentário. Uma cópia disso seria
uma segunda verdade sobre o mesmo fato. A bateria guarda o cenário, para o dia
em que alguém acrescentar a tabela achando que faltava.

**Só as colunas que mudaram**, e não a linha inteira duas vezes: dois objetos
de vinte campos para dizer que um mudou é uma tela em que ninguém acha a
diferença. `updated_at` fica fora do diff, senão todo `update` geraria uma
linha dizendo que mudou o `updated_at`. E **update que regrava o mesmo valor
não vira linha** — a tela de task salva sozinha campo a campo, e sem isso
clicar fora de um campo sem digitar geraria um registro por clique.

**Nulo vira "(vazio)" e pessoa ausente vira "sistema".** O seed, uma rotina e
a chave de serviço escrevem sem sessão; inventar um nome seria pior, e deixar
em branco parece defeito da tela.

**"Apagou" é o único selo em tom de erro.** Pintar os três de vermelho
treinaria o hábito de ignorar vermelho — a mesma razão pela qual o alerta de 7
dias do portal é `--warning`. E "Mudou" é o neutro, como Prioridade Normal é
cinza: é o mais comum, e dar cor a ele faria o corriqueiro competir com o que
importa.

**O `check:sprint9` ganhou a checagem de mão dupla desta tela**: "Auditoria"
tem que aparecer no painel do sócio **e** faltar no do desenvolvedor. Só a
primeira metade passaria numa tela que parou de mostrar o item para todo
mundo; só a segunda passaria numa tela que nunca existiu.

### A tela se atualiza quando outra pessoa mexe

`components/shared/atualizacao-ao-vivo.tsx` no layout do Painel,
`lib/acoes/ao-vivo.ts` no servidor, e a policy da migration 0057 decidindo
quem ouve. O nome do canal mora em `lib/dominio/ao-vivo.ts`, que é módulo sem
diretiva nenhuma — os dois lados precisam dele, e é o caso que a convenção
cobre.

**O QUE VIAJA É O SINAL, NUNCA A LINHA, e essa é a decisão inteira.** O
caminho óbvio do Supabase é `postgres_changes`: a tabela entra na publicação
`supabase_realtime` e o servidor empurra **a linha inteira** para cada
navegador inscrito. Aqui o Painel e o Portal do Cliente leem as mesmas
tabelas, então isso poria a correção de um filtro do outro lado de um serviço
que a bateria não alcança — e o modo de falha é o mesmo do `security_invoker`
da view `calendar_events`: **num banco com um cliente só, vazar tudo e mostrar
o certo têm exatamente a mesma cara.** Nenhuma tabela entra em publicação
nenhuma, e a bateria tem o cenário que conta quantas entraram, para o dia em
que alguém acrescentar a linha.

O que vai no fio é `{ motivo: "task" }` — uma palavra. Quem recebe **não lê a
mensagem**: chama `router.refresh()`, e a tela é remontada no servidor, onde o
RLS vale como em qualquer visita. O sinal diz "olhe de novo"; quem decide o
que a pessoa vê continua sendo o Postgres. *O que se perde, e é consequência
aceita:* não há atualização otimista nem diff — a tela recarrega inteira do
servidor. Para nove pessoas num board é troca boa; para um cursor
compartilhado não seria.

**É por isso que ele pode morar no layout.** `router.refresh()` preserva o
estado dos componentes de cliente — o que está digitado, o diálogo aberto, a
aba escolhida. Sem essa propriedade, o texto de um comentário sumiria porque
outra pessoa mudou uma etapa do outro lado da agência.

**Quem envia é o servidor, com a chave de serviço, por `httpSend()`** — um
POST, sem websocket pendurado por processo. E enviar daqui em vez do navegador
de quem clicou tem duas consequências: o aviso sai mesmo quando a ação veio de
um lugar sem tela, e **nenhum navegador consegue forjar um aviso**. A 0057 não
tem policy de INSERT, e a ausência é a regra: com ela, qualquer pessoa com a
chave anon mandaria "mudou" em laço e poria a tela de todo mundo recarregando
sem parar.

**O aviso pega carona na revalidação**, e não em cada action. As duas
respondem à mesma pergunta — "isto mudou, quem estiver olhando precisa ver de
novo" —, e a única diferença é de quem é a tela: a revalidação é da minha, o
aviso é da dos outros. Espalhá-lo por vinte actions seria garantir que a
vigésima primeira esqueça.

**O cliente não ouve o canal da equipe**, e quem garante é `is_staff()` na
policy — nunca o nome do canal, que é uma palavra e viaja no bundle. O aviso
não carrega dado, mas carrega **ritmo**: quantas mexidas por hora, em que
horário, em que dia não teve nenhuma. Ele contratou o resultado. O caminho
inverso existe e é só um: quando o cliente decide uma aprovação, a agência é
avisada — é do lado de cá que alguém está com a fila aberta esperando.

**UM SINAL VISÍVEL QUANDO NÃO ESTÁ LIGADO.** Uma inscrição que cai não avisa
ninguém: a tela para de se atualizar, e "não mudou nada" é indistinguível de
"parou de chegar" — o mesmo modo de falha da leitura que devolve lista vazia.
Por isso o ponto aparece **também quando funciona**: um indicador que só nasce
quando quebra ensina que a ausência dele é boa notícia, e aí o dia em que o
componente sumir de um layout por engano passa por "está tudo bem".

**São quatro estados e não três**, e a diferença entre os dois primeiros é o
que evita uma mentira: `desligado` é "este ambiente não tem Supabase" — o
gerador de protótipo, que troca a camada de dados por exemplos —, e aí não se
desenha nada, porque um aviso de conexão numa tela de dados de exemplo afirma
coisa errada sobre outra coisa. `caiu` é "as credenciais existem e a inscrição
não ficou de pé", e esse precisa aparecer.

**A pausa junta os avisos** (1,2 s): concluir uma etapa mexe em subtarefa, em
task e em rodada, e cada uma anuncia a sua — sem juntar, um clique de uma
pessoa viraria três recarregamentos na tela das outras oito. E **aba escondida
não recarrega**: fica marcado e sai quando a pessoa volta, senão dez abas
paradas num board seriam dez idas ao banco para desenhar o que ninguém está
olhando.

**O estado inicial sai do inicializador do `useState`, não de um efeito.**
`setSituacao` no corpo do efeito dispara renderização em cascata — a mesma
armadilha do editor de post, que virou `key` no Sprint 14 — e o `lint` do
projeto reprova.

> **O que NÃO foi verificado aqui, e é a primeira coisa deste sprint que não
> dá para conferir nesta máquina:** a bateria roda contra um Postgres de
> verdade e testa a **policy** do canal (quem ouve, quem não ouve, quem não
> publica), com `realtime.messages` simulado em `_fixture_supabase.sql` — mas
> não existe servidor de Realtime aqui. Que a mensagem realmente chegue
> depende do Realtime estar ligado no projeto e da 0057 aplicada. **É para
> isso que o indicador serve:** abra o Painel em duas janelas, mova um card
> numa e veja a outra acompanhar. Se aparecer "Sem atualização ao vivo", a
> resposta quase sempre é a 0057 — canal privado sem policy é
> `CHANNEL_ERROR`.

### A parte G saiu do Sprint 16, e a B e a C voltaram

**Só a G saiu**, e a razão é a única que a decisão do usuário deu: *"não temos
mais o VPS"*. Ela é a que realmente perdeu a máquina — não existe mais onde
pendurar um cron.

**A B e a C voltaram na mesma conversa**, e o registro da ida e da volta fica
porque foi o argumento que as trouxe: **elas nunca precisaram da VPS.** As
duas são chamada de API e rodam de dentro do próprio Next, em Server Action,
onde a credencial já é `server-only`. Quem ler isto daqui a três sprints não
vai concluir que elas saíram por impossibilidade técnica, nem que voltaram por
capricho.

**O que a ausência da G deixa de pé**, até alguém decidir outra coisa:

- `limpar_rascunhos_abandonados()` (0028) **não** roda sozinha. O rascunho de
  7 dias não é apagado por ninguém; o bloco da Home passou a dizer que o
  rascunho está parado, e não que ele some amanhã.
- `gerar_recorrencias()` (0040) **não** roda sozinha. O stories de toda
  segunda nasce quando alguém abre a regra e clica em "Gerar agora", e a tela
  de Recorrências diz isso numa faixa fixa.
- **`frequencia = 'diario'` das preferências do portal não sai**, e é o mesmo
  buraco visto do lado do e-mail. Está escrito na tela, pela mesma razão: a
  pessoa escolheu uma coisa e receberia outra — ou nada, calada.
- **`lembrete_pendencias` também não**, e pelo mesmo motivo: um lembrete é uma
  varredura diária, não uma consequência de alguém ter clicado.

**Duas das frases erradas moram em migration aplicada, e por isso ficam
erradas.** Os comentários da 0028 e da 0031 são `comment on function` e
`comment on table` — texto gravado no banco, que só sai por migration nova.
Uma migration cujo único efeito é reescrever comentário é uma migration que
alguém aplica por engano achando que muda alguma coisa, e o custo de errar
nisso é maior que o de um comentário datado. **O tempo verbal certo mora
aqui**, que é onde se procura o que vale hoje — a mesma razão pela qual a
explicação de um nome morto mora fora de `src/`.

### Timeout de sessão

Só o perfil `cliente` cai por inatividade: aviso aos 28 minutos, saída aos 30.
Ele acessa de fora da agência, às vezes de um computador compartilhado. Os
perfis internos ficam o dia todo no sistema e não têm esse timeout.

## Convenções

**Banco**

- Todo SQL vive em `supabase/migrations/`, numerado e versionado. Nada de
  alterar schema direto pelo painel do Supabase: o que não está em migration
  não existe para o próximo ambiente.
- **RLS é obrigatório em toda tabela nova.** `alter table ... enable row level
  security` mais as policies, na mesma migration que cria a tabela. Sem isso a
  tabela fica legível por qualquer pessoa com a chave anon — e essa chave vai
  no bundle que o navegador baixa.
- Policies chamam `is_staff()`, `is_gestor()`, `is_socio()` e `my_client_ids()`
  em vez de repetir a consulta.
- Funções SQL em `plpgsql`, não `language sql`: o Postgres valida o corpo de
  uma função `sql` na hora de criá-la, o que quebra a migration se a tabela
  citada ainda não existir.
- `uuid` como chave primária, `created_at timestamptz not null default now()`.
- Migrations precisam poder rodar mais de uma vez sem erro.
- **`create or replace function` se reescreve a partir da versão MAIS NOVA, e
  ele não avisa quando a nova tem menos coisa que a velha.** A 0007 criou
  `validar_transicao_de_subtarefa()` com quatro travas **e** um bloco de
  carimbos de data; a 0030 a reescreveu para trocar `r.subtask_id` pelo par
  `(content_type, content_id)`, partindo do texto das quatro travas — e o
  bloco ficou para trás. Desde então nenhuma subtarefa tinha `concluida_em`
  nem `iniciada_em`, e **não apareceu como bug porque uma tela só lê a coluna
  e o que ela devolve é um número**: o contador de concluídas do mês vinha
  respondendo zero, que é uma resposta plausível. A 0052 devolveu o bloco.

**Código**

- Toda a interface em **português do Brasil**, com acento.
- Idioma dos identificadores, por camada:
  - **inglês** — nomes de tabela e coluna (`profiles`, `created_at`), a API dos
    componentes de `components/ui/` e `components/shared/` (`DataTable`,
    `PageHeader`, props `title`/`columns`) e `lib/auth/permissions.ts`
    (`canAccess`, `getMenuForRole`), porque são camadas genéricas;
  - **português** — todo o resto: rotas, componentes de domínio, funções,
    variáveis.
- Datas sempre com `date-fns` e locale `ptBR`. Nada de `toLocaleDateString`
  espalhado.
- Formulários com react-hook-form + zod. O mesmo esquema zod valida no
  navegador e de novo na server action — validação de navegador não protege
  nada.
- No servidor, sempre `supabase.auth.getUser()`, nunca `getSession()`:
  `getSession` só lê o cookie, que o navegador pode ter adulterado.
- Proteção de rota no servidor, não no menu. Esconder o link não é segurança.
- **Nenhuma escrita pode falhar em silêncio.** Toda Server Action devolve
  `{ ok: true, mensagem }` ou `{ ok: false, error }` com a mensagem real do
  Supabase, envolvida por `executarAcao()` de `lib/acoes/resultado.ts`, que
  loga o erro completo no console do servidor. Na tela, `chamarAcao()` de
  `lib/acoes/cliente.ts` embrulha a chamada para nem a queda do servidor
  passar batida. Action **nunca** chama `forbidden()`: dentro de uma action o
  403 vira promise rejeitada e some — use as guardas de `lib/acoes/guardas.ts`.
- **Escrita que o RLS pode barrar termina com `.select()`.** Sem isso, um
  `update` bloqueado volta sem erro e sem linha, e a tela diz "salvo" à toa.
  Se não voltou linha, é recusa — e a mensagem precisa dizer isso.
- **E a LEITURA que falha calada é pior que a escrita.** A escrita sem
  `.select()` ao menos diz "salvo" numa tela em que a pessoa desconfia; a
  leitura devolve lista vazia, que é **indistinguível da verdade**. Foi assim
  que uma campanha recém-criada não aparecia em lugar nenhum: o `select`
  citava um embutido com nome de coluna errado, o PostgREST recusou a consulta
  inteira, e `const { data } = await consulta` jogou o erro fora — a tela
  dizia "Nenhuma campanha aberta" para quem tinha acabado de abrir uma.
  `ouFalha()` de `lib/dados/consulta.ts` estoura em vez de devolver vazio, com
  o nome do lugar no log. `lib/dados/` ainda tem dezenas de
  `const { data } = await`, e a migração é por etapas — registrada lá.
- **Recusa de validação nunca mostra o texto do zod.** Toda action passa por
  `recusaDeValidacao()` de `lib/acoes/validacao.ts`, e `npm run check:mensagens`
  garante que continue assim. O motivo: a mensagem que escrevemos fica
  pendurada numa refinação (`.min(2, "Informe o título…")`), e refinação só
  roda **depois** de o valor já ser uma string. Campo faltando não chega lá —
  e campo em branco é o erro que as pessoas cometem, não valor de tipo errado.
  O que aparecia era *"Invalid input: expected string, received undefined"*:
  inglês, sem dizer qual campo, na tela de quem usa o sistema.

  O helper nomeia o campo pelo rótulo da tela (`link_entrega` → "pasta de
  entrega"), lista **todos** os que faltam de uma vez — um por envio faz a
  pessoa preencher, mandar, descobrir o próximo e repetir —, e manda o erro
  inteiro para o log do servidor. O mapa de rótulos mora ao lado do esquema
  que ele descreve, não num arquivo central: campo novo e rótulo novo na mesma
  tela do editor.
- **Criar usuário só em Server Action do servidor**, com a chave de serviço
  (`app/(interno)/painel/_actions/usuarios.ts`). Essa chave ignora todo o RLS
  e nunca pode chegar ao navegador: ela é lida em `lib/supabase/admin.ts`, que
  tem `import "server-only"` — e não em `lib/env.ts`, que o navegador carrega.
  O resto usa Server Actions com o cliente do próprio usuário, para o RLS
  continuar valendo.
- **Criar conta não depende de e-mail.** A conta nasce com uma **senha
  provisória**, mostrada UMA VEZ na tela de quem cadastrou, e com
  `deve_trocar_senha = true`. Nada é enviado por e-mail na criação: sem SMTP
  próprio o Supabase entrega pouquíssimo, e um cadastro que depende de um
  e-mail sair é um cadastro que trava.
- **A senha provisória é sorteada POR PESSOA. Nunca uma "senha padrão".** Uma
  string fixa para todo mundo seria chave-mestra: quem a soubesse entraria em
  qualquer conta recém-criada até a pessoa fazer o primeiro acesso, e numa
  conta que ninguém usasse ela valeria para sempre. `gerarSenhaProvisoria()`
  usa `randomInt` do `node:crypto` — `Math.random()` é previsível a partir de
  algumas saídas, e o que está em jogo é acesso a uma conta. O formato é feito
  para ser **ditado por telefone**: três blocos com hífen, sem `0/O`, `1/l/I`
  nem `5/S`, e um bloco de dígitos para passar em qualquer regra de "precisa
  ter número".
- **`deve_trocar_senha` só cai pela chave de serviço**, e só dentro da action
  que acabou de trocar a senha de verdade. O trigger `protect_profile_role`
  (migration 0019) devolve o valor antigo para qualquer escrita de alguém
  logado — **nem o sócio baixa a bandeira de outra pessoa**, porque isso
  devolveria acesso com a provisória, que ele também conhece. Sem essa trava,
  um PATCH no PostgREST marcaria a senha como trocada sem ter trocado nada.
- **A trava mora em `exigirSessao()`, não no login.** Login não é a única
  porta: quem já tivesse cookie válido entraria direto numa rota interna sem
  passar pela tela de login. Em `exigirSessao` passam as duas áreas e todas as
  rotas. A única função que não trava é `exigirSessaoParaTrocarSenha()`, usada
  por uma tela só — a de `/trocar-senha`, que senão se redirecionaria para si
  mesma.
- **O limite de tentativas é do banco, e é chamado pela chave de serviço.**
  `rate_limits` mais `consumir_tentativa()` e `perdoar_tentativas()`
  (migration 0056), com `lib/acoes/limite.ts` de um lado só. Um contador em
  memória do processo parece a solução óbvia e tem dois furos que não aparecem
  em teste nenhum: ele **zera a cada deploy** — e deploy é `pm2 reload`, que é
  o que alguém faz quando o site está sob carga — e não existe para o segundo
  processo no dia em que houver dois. Limite que some sozinho é limite que
  ninguém percebe ter sumido.

  **Quem chama é a chave de serviço, e isso é metade da proteção.** O login
  acontece antes de existir sessão, então não há cliente do usuário para usar
  — e a alternativa seria abrir a função para `anon`, o que entregaria a arma
  junto com a trava: qualquer navegador com a chave anon (que é pública, vai
  no bundle) chamaria `consumir_tentativa` com a chave de **outra pessoa** até
  estourar a cota dela. O limite que protege o login viraria o jeito mais
  fácil de trancar alguém para fora. Por isso o `revoke` explícito — o
  Supabase concede `execute` de toda função nova para `anon` e
  `authenticated` sozinho —, e por isso `rate_limits` tem RLS ligada **sem
  policy nenhuma**: são duas travas independentes, e a bateria mede as duas
  pelo privilégio, não só pela mensagem de recusa.

  **São duas contas no login, por IP e por e-mail**, e nenhuma resolve
  sozinha: por IP barra a máquina que varre a lista de e-mails da agência, por
  e-mail barra quem troca de endereço a cada tentativa. **O teto por e-mail é
  o mais folgado de propósito:** o e-mail de quem trabalha aqui está no site
  da agência, então um teto apertado daria a qualquer pessoa o poder de
  trancar o sócio para fora gastando a cota dele. E **a mensagem não diz qual
  dos dois estourou** — "esse e-mail atingiu o limite" seria confirmar que o
  e-mail existe, na única tela do produto que se recusa a confirmar isso.

  **O login que dá certo devolve a cota do e-mail**, e é o que separa contar
  tentativa de contar erro. A do IP não volta: um endereço pode ter mais de
  uma pessoa atrás. A recuperação de senha **não perdoa nada** — a resposta
  dela é idêntica havendo conta ou não, então não existe ali um "deu certo" em
  que confiar.

  **`x-real-ip` primeiro, e `x-forwarded-for` só pela ÚLTIMA entrada.** É a
  linha que separa o limite de um enfeite. Quem está na frente do Node escreve
  `x-real-ip` com o endereço do soquete — o único que o cliente não escolhe —,
  e **acrescenta** o mesmo endereço ao fim do `x-forwarded-for` que o cliente
  mandou. Quer dizer que o COMEÇO daquela lista é texto de quem está do outro
  lado. O trecho que aparece em todo lugar,
  `x-forwarded-for.split(",")[0]`, lê justamente essa parte: um cabeçalho
  diferente a cada requisição dá uma chave nova a cada requisição, e o
  contador nunca chega a dois. A trava continuaria lá, verde, contando nada.
  Sem nenhum dos dois cabeçalhos o limite por IP **não é aplicado** — um proxy
  mal configurado tem que degradar para "conta só por e-mail", nunca para
  "tranca a agência inteira junto".

  **O primeiro caminho vale em qualquer hospedagem; o segundo é que depende
  dela.** `x-real-ip` é o que todo proxy reverso na frente de um Node escreve,
  e é por onde esta função sai em quase toda requisição. A regra da "última
  entrada" é a que assume um proxy só, acrescentando no fim: com um CDN na
  frente (ou uma hospedagem que empilhe as próprias camadas depois do
  cliente), a última passa a ser o endereço dele e o valor certo é o cabeçalho
  que ele assina. `enderecoDeQuemChama()` é o único lugar a mexer, e o
  comentário dela diz isso em vez de nomear um servidor — **a VPS que o nomeava
  não existe mais**, e regra escrita em cima de uma máquina que saiu é regra
  que ninguém sabe se ainda vale.

  **Ele falha para o lado ABERTO, e com barulho.** Se o Postgres não responder
  ou a chave de serviço faltar, a tentativa passa. O lado ruim está dito: o
  limite pode ficar semanas desligado. O outro lado é pior — um limitador
  quebrado que recusa tranca a agência inteira para fora do próprio sistema,
  inclusive quem iria consertar, e ele quebra justamente quando o banco já
  está com problema. O que sobra é não deixar calado: o erro vai inteiro para
  o log, a falta da chave é avisada **uma** vez (repetir a cada tentativa
  esconderia o aviso dentro do próprio ruído), e `/status` passou a dizer que
  o limite fica desligado sem ela — a lista do que para de funcionar sem a
  chave de serviço cresceu, e um alerta certo e incompleto é o que ninguém
  descobre sozinho, porque limite desligado não muda nada na tela.

  **O comentário também tem cota, e ela não finge ser segurança:** quem
  comenta já entrou. É guarda de enxurrada — o clique repetido, a aba que
  reenvia, o laço esquecido —, e as três telas que comentam passam pela mesma
  `exigirCotaDeComentario()`, senão seriam três tetos diferentes no dia em que
  alguém mexesse num.
- **Criação em vários passos tem rollback.** Se a ficha falha depois da conta
  criada, a conta é apagada. Cadastro pela metade é pior que nenhum: o e-mail
  fica ocupado e ninguém entende por quê.
- **Pessoa e cliente nunca são apagados quando têm histórico.** Desligar é
  `ativo = false` mais revogação do acesso; o nome continua nos registros
  antigos, porque é isso que preserva a autoria do que foi feito.
- `DateBadge` é para prazo **a vencer**. Data que só registra quando algo
  aconteceu (admissão, cadastro, último acesso) — ou prazo de item já
  concluído — se formata com date-fns, senão o passado aparece em vermelho
  como se fosse atraso.
- **O que é "meu" são as minhas subtarefas.** A Task aparece uma vez só, como
  cabeçalho, com as etapas dos outros em cinza ao lado — ver que a arte não
  saiu é o que explica por que o agendamento está parado. Os contadores usam o
  prazo das minhas subtarefas, e é por isso que batem com a lista: os dois
  passam por `situacaoDoPrazo()` e `combinaComFoco()`, em `lib/dominio/tasks.ts`.
- **Hoje e fim da semana são calculados no servidor e passados adiante.** Se
  cada tela lesse o relógio, o navegador em outro fuso classificaria um prazo
  de forma diferente do contador.
- **Concluir pergunta o tempo real, e dá para pular.** Pergunta obrigatória
  vira número inventado, que é pior que campo vazio — entra no relatório como
  se fosse medição. O componente é `DialogoDeTempo`, e o valor sai em minutos.
- **Regra de transição mora na máquina de estados, não no componente.**
  `lib/tasks/state-machine.ts` diz o que pode e qual botão aparece; os triggers
  da 0007 dizem a mesma coisa para quem chamar a API direto. As duas existem de
  propósito: a primeira escreve a mensagem que a pessoa lê, a segunda é a que
  vale.
- **Função não atravessa a fronteira servidor/cliente.** Uma função pura que
  os dois lados usam vai para `lib/dominio/`; `lib/dados/` é `server-only` e o
  que sai de lá são dados, nunca funções.
- **Valor exportado de arquivo `"use client"` não vale no servidor.** Um
  `export const LISTA = [...]` num Client Component chega ao Server Component
  como referência de cliente, e `LISTA.includes(...)` estoura com *"is not a
  function"*. É o espelho do `export const` em arquivo `"use server"`, e **o
  `npm run build` não pega nenhum dos dois** — só aparece pedindo a página.
  Valor que os dois lados usam vai para um módulo sem diretiva nenhuma
  (`financeiro/vocabulario.ts` é o exemplo). Tipo pode ficar no arquivo
  cliente: tipo é apagado na compilação.

  **E isso derrubou a Gestão de Pessoas.** `ehAba` morava em `pessoas/abas.tsx`,
  que é `"use client"`, e o `page.tsx` a chamava para ler a aba da URL — a
  página inteira devolvia 500, nas duas abas, com *"Attempted to call ehAba()
  from the server but ehAba is on the client"*. Quem encontrou foi o usuário,
  clicando no menu. Agora o valor mora em `pessoas/vocabulario.ts`.

  **Duas travas nasceram daí, e as duas faltavam.** `npm run check:fronteira`
  varre `src/` atrás de valor de arquivo cliente importado por arquivo de
  servidor — **componente não conta**, que é o padrão certo e o projeto faz em
  toda página; o que quebra é o servidor CHAMAR uma função ou LER uma
  constante, e a distinção é a convenção de nome. E o gerador de protótipo
  passou a gravar o **log do servidor** e a reprovar a rodada quando uma tela
  responde 500: até aqui ele mandava o erro para `/dev/null`, a imagem da
  página de erro saía como se fosse a tela, e a rodada terminava dizendo
  "Pronto" — com noventa imagens, ninguém abre a que quebrou.
- **`<title>` dentro de `<svg>` quebra a hidratação.** O React 19 trata
  `<title>` como o título do documento e o iça para o `<head>`, o que faz o
  HTML do servidor divergir do que o navegador monta. O rótulo acessível de um
  gráfico vai num `<span className="sr-only">` ao lado, apontado por
  `aria-labelledby`.
- Filtro e visualização de tela de listagem moram na URL, não em estado: o
  link precisa ser compartilhável e sobreviver à troca de visualização.
- Permissão e menu saem de `src/lib/auth/permissions.ts`, e só de lá. Nunca
  escreva `if (role === "socio")` numa tela: acrescentar um módulo é
  acrescentar uma linha em `MENU`.
- Componente novo que vários módulos vão usar vai para `components/shared/` e
  ganha uma seção em `/painel/dev/componentes`.
- Feedback de ação com `toast` (sonner), nunca `alert()`.
- Carregamento com `LoadingSkeleton`, nunca tela branca.

**Deploy**

- **A VPS NÃO EXISTE MAIS, e é decisão do usuário.** O que ficou inerte de uma
  vez: o job `publicar` do `deploy.yml`, o `scripts/deploy.sh` inteiro (com o
  `--reverter`, o `NEXT_DIST_DIR` e o `NEXT_PUBLIC_COMMIT` explícito), os
  quatro segredos da VPS e o `docs/tutorial-hostinger.md`. Os parágrafos que
  falam de **publicar** — a branch, a troca de pasta, o `npm ci` antes do
  build, a conferência de HTTP no fim, o rodapé com o commit — passaram a
  descrever como era. O que **continua valendo palavra por palavra** é a parte
  que é sobre migration e sobre verificação: a `verificar.yml`, o
  `check:migrations`, o `onde-esta-o-banco.sql`, o `$$` em comentário e o
  `digest` que muda a cada build não dependiam de máquina nenhuma.

  **Os arquivos ficam, e não é indecisão.** Um deploy apagado não volta de
  graça no dia em que houver outra máquina, e o que está escrito neles é a
  explicação de por que cada passo está naquela ordem — que é justamente a
  parte que não se reconstrói lendo o script de outra pessoa. O que se corrige
  é o tempo verbal, aqui, porque é aqui que se procura o que vale.

  **E a Action não fica vermelha por isso**, que é o primeiro medo de quem lê
  isto. O `publicar` começa perguntando se os quatro segredos existem; sem
  eles escreve no resumo do passo e **termina em 0**. A `verificar.yml`
  continua rodando em cada push, que é a metade que nunca dependeu de máquina
  nenhuma — e é a metade que protege o código.

  **O que NÃO dá para dizer daqui é onde o site roda agora**, e uma coisa do
  produto depende disso: a detecção de IP do limite de tentativas, logo acima.
  O caminho principal (`x-real-ip`) está certo em qualquer hospedagem; a volta
  é que foi escrita para um nginx. **Sem saber o que ficou no lugar, o rodapé
  do painel também não responde mais "já subiu?"** — sem o `deploy.sh`
  passando o commit, ele diz "versão local".

- **O deploy saía da `main`, e só dela.** `deploy.yml` dispara em `push:
  branches: [main]`, e `scripts/deploy.sh` puxa de `main` por padrão. Trabalho
  em branch não vai ao ar: quando a verificação fecha, a `main` avança e o
  deploy acontece sozinho.

  **A `main` não existia até aqui, e foi assim que o Full Hub ficou semanas
  sem receber nada.** O repositório tinha uma branch só, de trabalho; a Action
  nunca disparou, e o que estava no ar vinha de alguém chamando o
  `scripts/deploy.sh` na VPS à mão — um script que puxa de uma branch
  inexistente. O sintoma foi um bug consertado que continuava acontecendo, com
  um número de erro diferente a cada tentativa: **o `digest` do Next carrega o
  hash do chunk e muda a cada build**, então o mesmo erro sai com número novo
  depois de reconstruir. É o rodapé do painel que responde "já subiu?", e é
  para isso que ele existe.

- **O deploy constrói numa pasta separada e só troca no fim.** `NEXT_DIST_DIR`
  aponta o build para `.next-novo`; o `.next` que está servindo só é
  substituído quando o build termina bem, e a troca é um `mv` — milissegundos.
  Sem isso, `npm run build` na VPS reescreve o diretório de que o processo em
  produção está lendo: quem estiver com o painel aberto leva 404 durante o
  minuto e meio de build, e um build que falha no meio deixa o site quebrado
  até alguém perceber.
- **O deploy NÃO aplica migration, e não é esquecimento.** Schema não se
  aplica sozinho junto com um push: uma migration que falha no meio deixa o
  banco num estado que o próximo deploy não conserta, e ninguém estava
  olhando. As migrations continuam indo à mão, na ordem, por quem decidiu
  aplicá-las — o script avisa no fim quando o deploy trouxe alguma.

  **E tem um segundo bug, que parece outra coisa inteira.** Um `$$` escrito
  dentro de um comentário `--` de migration não é nada para o Postgres —
  comentário é comentário. Mas quem SEPARA os comandos antes de mandá-los (o
  SQL Editor do Supabase, um cliente gráfico, um script de deploy) lê aquilo
  como abertura de string, e a partir dali a contagem sai de sincronia: o
  `as $$` da próxima função vira o fechamento daquela string, e o corpo dela
  passa a ser lido como SQL solto. Os erros que saem falam de outra coisa,
  três telas abaixo — *relation "avo" does not exist* para um `select ... into
  avo`, *syntax error at or near "return"* para um `return old;`. Custou três
  tentativas de aplicar a 0032 até alguém olhar a linha 25. `npm run
  check:migrations` procura o marcador em comentário e confere a paridade de
  cada tag, e roda no CI: é critério que precisa ser conferido toda vez.

  **A consequência disso aparece como bug, e é sempre o mesmo bug:** o código
  sobe, a coluna não existe ainda, e a tela devolve *"Could not find the 'x'
  column of 'y' in the schema cache"*. Não é cache errado — é a migration que
  não rodou. `scripts/migrations-pendentes.sh 0019 0020` junta as que faltam
  num arquivo para colar no SQL Editor de uma vez, na ordem, com um
  `notify pgrst, 'reload schema'` no fim para o caso de o Supabase não avisar
  a API sozinho. **Toda entrega que traz SQL novo precisa dizer quais
  migrations ficaram pendentes** — quem lê a mensagem de erro não tem como
  saber que a resposta é um `alter table` que nunca rodou.

  **E o segundo sintoma é este, que aconteceu com o Calendário Full:** o
  código sobe, a migration não roda, e a tela devolve **erro de servidor na
  abertura** em vez da mensagem sobre a coluna. É o que `ouFalha()` faz de
  propósito — a view `calendar_events` não existe, o PostgREST recusa, e a
  leitura estoura em vez de desenhar um calendário vazio. Uma tela em branco
  seria pior; mas o número que o Next mostra não ajuda ninguém, **porque o
  `digest` carrega o hash do chunk e muda a cada build** — dois números
  diferentes podem ser o mesmo erro. Quem responde é o log do servidor, onde
  `ouFalha()` escreve `[consulta:itens do calendário]` com o erro inteiro.

  **E o script que deveria ter respondido isso em dez segundos respondia
  "ok".** `onde-esta-o-banco.sql` é escrito à mão, uma linha por migration, e
  a lista tinha parado na 0054: a 0055 não tinha linha, então todas as trinta
  e duas que ele conhecia diziam ok e o banco parado na 0054 lia como banco em
  dia — mandando quem procurava a causa procurá-la no código. **Um script cujo
  trabalho inteiro é dizer qual migration falta não pode ficar para trás da
  pasta em silêncio.** Agora quem confere a lista contra
  `supabase/migrations/` é o `npm run check:migrations`, no CI, e ele achou a
  segunda falta na primeira rodada: a 0026. Para ela a linha honesta é
  **nenhuma linha** — a 0029 desfez o que ela fez, e não sobra objeto nem
  trecho de corpo que diga se ela passou —, então a ausência é **declarada no
  próprio script** (`-- SEM LINHA: 0026 - …`) com o motivo junto. Quem
  acrescentar a 0056 escreve a linha dela ou escreve por que ela não dá para
  conferir; as duas são decisão, esquecer não é.
- **O que verifica antes do deploy é o mesmo arquivo que roda no dia a dia.**
  `deploy.yml` chama `verificar.yml` por `workflow_call` em vez de repetir os
  passos. Uma cópia da checagem envelhece em silêncio, e a que protege a
  produção é justamente a que não pode.
- **A ordem importa mais do que parece:** o deploy faz `npm ci` na VPS antes
  de construir, e é nesse instante que o `node_modules` do processo **no ar**
  é reescrito. Um commit quebrado que chegasse até lá poderia derrubar o
  painel antes mesmo de o build falhar. Por isso a verificação vem antes.
- **A Action confere se o painel responde depois de publicar.** Deploy que
  termina verde e deixa o site fora do ar é o pior resultado possível, porque
  ninguém vai olhar.
- `scripts/deploy.sh --reverter` volta para o build anterior sem esperar um
  commit de correção.
- **O rodapé do painel diz de qual commit saiu o que está na tela**, e o valor
  é **congelado no build**, nunca consultado em tempo de execução. O que está
  servindo é uma pasta `.next` já compilada; se alguém puxasse código sem
  reconstruir, ler o git do servidor devolveria um commit que não é o que está
  rodando — e um rótulo de versão que mente é pior que nenhum, porque é
  consultado justamente por quem está em dúvida se a mudança subiu.
  `next.config.ts` lê o git no build e embute em `NEXT_PUBLIC_COMMIT`; o
  `deploy.sh` passa o valor **explícito**, porque o git recusa ler repositório
  de outro dono ("dubious ownership") e aí a leitura falharia calada. Sem
  nenhum dos dois, o rodapé diz "versão local" — quem vê isso sabe na hora que
  não está olhando uma versão publicada.
- **O commit fica só no painel, não no Portal do Cliente.** Para a equipe é a
  resposta de "já subiu?"; para o cliente seria uma sigla sem significado no
  rodapé da tela dele.

**Três camadas de proteção, e elas são independentes**

1. `src/proxy.ts` manda quem não tem sessão para o login.
2. `exigirEquipe()` / `exigirCliente()` no layout de cada área devolvem HTTP
   403 para quem está na área errada.
3. O RLS do Postgres decide o que cada um lê e escreve. Esta é a que vale de
   verdade: funciona mesmo que alguém chame a API do Supabase direto.

## Estrutura

```
src/
  proxy.ts                    Renova a sessão e barra quem não está logado
  app/
    (auth)/                   login, esqueci-senha, redefinir-senha
    (interno)/painel/         Painel Interno — exige equipe
    (cliente)/portal/         Portal do Cliente — exige cliente
    auth/callback/            Chegada dos links enviados por e-mail
    forbidden.tsx             Tela do HTTP 403
    status/                   Diagnóstico da conexão com o Supabase
    api/status/supabase/      O mesmo diagnóstico em JSON
  components/ui/              shadcn/ui
  components/shared/          Componentes do produto
  hooks/
  lib/auth/                   roles, DAL, actions, esquemas zod
  lib/tasks/                  máquina de estados da subtarefa e da Task
  lib/acoes/                  contrato das Server Actions, guardas e contas
  lib/reports/                o resumo da semana da agência, montado para a tela e para o envio que ainda não existe
  lib/email/                  o e-mail que sai: a trava de sandbox, os destinatários, as mensagens
  lib/drive/                  a pasta de entrega no Google Drive: conta de serviço, achar ou criar
  lib/supabase/               clients, proxy, tipos, diagnóstico
supabase/migrations/          SQL versionado
supabase/testes/              bateria de RLS e de fluxo, rodando como gente
supabase/seed.sql             9 usuários de teste, 3 empresas (uma desativada)
scripts/                      Verificação de conexão e geradores de protótipo
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe em desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` / `npm run typecheck` | Padrões e tipos. O `typecheck` roda `next typegen` **antes** do `tsc`: `PageProps` e `LayoutProps` são tipos que o Next GERA em `.next/types`, e sem eles o `tsc` acusa *"Cannot find name 'PageProps'"* em toda página. Na máquina de quem já construiu uma vez ele passa — o `.next` está lá —, e no CI, que começa do zero, falha |
| `npm run check:supabase` | Testa a conexão com o Supabase pelo terminal |
| `npm run check:cores` | Contraste dos pares texto/fundo, cor literal fora dos tokens, classe de cor inexistente e nome que saiu do produto |
| `npm run check:mensagens` | Confere que nenhuma action devolve a mensagem crua do zod, e que o nome da action no log bate com o `executarAcao` em volta |
| `npm run check:migrations` | Confere que nenhuma migration cita `$$` dentro de comentário, que todo marcador de dollar quoting abre e fecha, **e que a lista do `onde-esta-o-banco.sql` não ficou para trás da pasta** — migration sem linha lá é banco desatualizado lendo como banco em dia |
| `npm run check:drive` | Prova que o nome digitado — a empresa, o título da demanda — não alcança a linguagem de consulta do Drive. Duas travas independentes, e a ordem do escape |
| `npm run check:fronteira` | Confere que nenhum arquivo de servidor importa **valor** de arquivo `"use client"` — componente pode, função e constante não. É o erro que passa no build, no lint e no tipo, e só aparece quando alguém pede a página |
| `npm run prototipo` | Gera imagens das telas em `prototipos/`, grava o **HTML renderizado** de cada uma em `prototipos/html/` e, na rodada completa, roda o `check:sprint9` em cima dele |
| `npm run check:sprint9` | Os critérios do Sprint 9 que dizem o que a tela NÃO mostra: o vocabulário que o Full Academy não tem e o que cada perfil alcança. Lê os dumps do protótipo; **sem eles, FALHA** em vez de passar em branco |
| `supabase/testes/rodar.sh` | Roda a bateria inteira contra um Postgres 16 de verdade, do zero |
| `scripts/migrations-pendentes.sh 0019 0020` | Junta as migrations que faltam num arquivo só, para colar no SQL Editor do Supabase |
| `scripts/exportar-antes-da-0043.sql` | Cola no SQL Editor e mostra a autoavaliação e as observações que a 0043 vai apagar. **Conveniência, não condição** — ao contrário do da 0034, estas tabelas a gestão já lia |
| `scripts/exportar-antes-da-0034.sql` | Cola no SQL Editor e mostra o que havia no Resumo Semanal e no Financeiro Pessoal, para entregar a quem escreveu antes de a 0034 apagar. Não muda nada |
| `supabase/migrations/0055_o_calendario_full.sql` | **Pendente de aplicação.** Traz `events`, `event_participants`, a view `calendar_events`, `capacidade_minutos_dia` em `team_members` e as funções `carga_da_equipe()` e `eventos_que_bloqueiam()`. Sem ela, `/painel/calendario` **devolve erro de servidor na abertura** — e devolve só ela: nenhuma outra tela lê esses objetos. `scripts/migrations-pendentes.sh 0055` monta a colagem |
| `supabase/migrations/0056_limite_de_tentativas.sql` | **Pendente de aplicação.** Traz `rate_limits` e as funções `consumir_tentativa()` e `perdoar_tentativas()`. Sem ela o login, a recuperação de senha e o comentário voltam a aceitar repetição sem contar — e **sem erro na tela**, porque o limitador falha para o lado aberto |
| `supabase/migrations/0057_atualizacao_ao_vivo.sql` | **Pendente de aplicação.** A policy que decide quem ouve o canal da equipe. Sem ela o canal é privado e não autorizado: o Painel mostra **"Sem atualização ao vivo"** e nada se atualiza sozinho — visível, não silencioso |
| `supabase/migrations/0058_trilha_de_auditoria.sql` | **Pendente de aplicação.** Traz `audit_log` e o trigger `registrar_auditoria()` em 13 tabelas. Sem ela, `/painel/auditoria` devolve erro de tabela inexistente — e nada é registrado |
| `supabase/migrations/0059_a_data_de_cada_etapa_do_social.sql` | **Pendente de aplicação.** Traz `post_etapas.prazo_offset_dias`, o recálculo quando o post muda de dia e a OITAVA origem da `calendar_events`. Sem ela, abrir o mês continua criando etapas sem data e elas não entram no calendário de ninguém |
| `supabase/migrations/0060_a_gestao_envia_o_que_produziu.sql` | **Pendente de aplicação.** Tira de `validar_nova_rodada` a trava que recusava quem produziu enviar ao cliente — ela só alcançava desenvolvedor e sócio, que são quem o usuário liberou. Sem ela aplicada, a gestão continua levando a recusa num envio que o produto diz que é dela |
| `scripts/campanhas-sem-demanda.sql` | Cola no SQL Editor: as campanhas abertas ANTES da 0051 ficaram com `task_id` nulo e sem etapa nenhuma. O PASSO 1 lista e já escreve as linhas do PASSO 2 prontas; o PASSO 2 grava. **Não é migration porque teria que inventar a pasta de entrega** — e a 0015 diz que inventar endereço é pior que não ter |
| `scripts/onde-esta-o-banco.sql` | Cola no SQL Editor e diz em que migration este banco está: uma linha por migration, e a primeira que disser FALTA é por onde continuar. É o curto, e é o que se roda antes de aplicar. **Quem confere que a lista acompanha a pasta é o `check:migrations`**, no CI |
| `scripts/conferir-migrations.sql` | O longo: item por item, para quando alguma coisa já parece errada. **305 linhas não sobrevivem a uma colagem de navegador** — foi o que aconteceu, e é por isso que existe o curto acima. **Ele vai da 0019 à 0040 e o cabeçalho diz isso**: sem a frase, um banco parado na 0054 leria tudo "ok" |
| `scripts/deploy.sh` | **Fora de uso — a VPS não existe mais.** Publicava na VPS, rodando **nela**, chamado pelo GitHub Actions por SSH |
| `scripts/prototipo-clicavel/` | Gera a página única e clicável para validação (veja o README de lá) |

## Histórico de sprints

| Sprint | Entrega |
| --- | --- |
| Sprint 15 | **A agência passou a responder sobre si mesma.** A camada de indicadores existia desde a 0035 e o resumo da Home desde a 0049, e nenhuma tela as lia. A Home ganhou os **nove blocos**, na ordem do dia da pessoa — quem sou eu, o que eu entrego hoje, o que está parado me esperando, quem não está aqui, para onde eu vou, e só então o panorama da gestão: quem abre esta tela abre para trabalhar. "Meu dia" é o **mesmo componente de Minhas Tasks**, que já estava separado desde o Sprint 4 esperando exatamente isto. `/painel/metricas` traz cinco abas com o **período como CHAVE e não como as duas datas** — "últimos 30 dias" salvo como `de=2026-08-26` é um link que envelhece calado —, e `QUEM_VE` espelha a primeira linha de cada função da 0035: quatro de `is_gestor()`, a rentabilidade de `is_socio()`. `ouFalha()` em todas, e aqui ele vale mais que de costume: a recusa dessas funções chega como erro, e sem ele o painel mostraria zeros — **painel zerado não parece recusa, parece agência parada**. `/painel/resumo-agencia` é a conversa de segunda-feira, e é **módulo antes de ser tela** (`lib/reports/weekly.ts`), porque a mesma função serviria o envio automático que ainda não existe. De quebra, o **CSV deixou de ter seis donos**: `montarCSV` morava dentro do Financeiro e a Academy importava dali, e as cópias já divergiam — o BOM que o Excel precisa estava em quatro das cinco telas. **Quatro erros meus, e nenhum o `npm run build` pegaria:** o cartão dizia "11 entregues" e o bloco logo abaixo contava 7, porque `producao_do_periodo()` conta só folha e as listas contavam agrupadora junto (foi a imagem que pôs os dois números lado a lado); em 375px a barra de abas empurrava a página inteira para os lados, e o **Full Days tinha a mesma linha desde o Sprint 6**; o título da etapa em "Meu dia" encolhia até "Re…" no celular; e o meu próprio comentário explicando por que o estado passa pelo mapa de rótulos **citava a palavra que a 0016 proibiu** — sétima vez na mesma armadilha. E o seed concluía duas etapas por INSERT, onde o trigger de UPDATE não roda: `concluida_em` nulo fazia toda conta de entrega responder **zero, que é plausível**. |
| Sprint 10 | **O Calendário Full**: migration 0055, com `events`, `event_participants` e a view `calendar_events` juntando sete origens num formato só. **A linha mais importante é `security_invoker = true`** — sem ela a view roda com os direitos de quem a criou e lê as sete tabelas inteiras para qualquer pessoa autenticada, num objeto que o PostgREST publica sozinho. E o furo **passa despercebido num banco com um cliente só**: ele vê seis campanhas, que é o total, e "seis de seis" tem a mesma cara com a RLS ligada e desligada; por isso a bateria cria material de duas empresas, e tirando a cláusula seis cenários falham e dizem o que vazaria. **Quatro divergências do texto do sprint**, e a primeira é grave: ele filtra rascunho por `status in ('rascunho','cancelada')` e **nenhum dos dois existe** — `rascunho` nem é valor do enum, e o Postgres recusaria a criação da view com um erro falando de enum; `carga_do_dia()` já existia desde a 0035 e nada aqui recalcula; `capacidade_minutos_dia` não existia e nasce por pessoa; e "não incluir posts e campanhas ainda" está vencido, porque os dois módulos existem. Quatro visões, e a Linha do Tempo é a que responde "a equipe aguenta?" — com a coluna de nomes fixa, que quase não foi: o `overflow-hidden` do invólucro cria um scrollport e quebra o `sticky`, e a imagem mostrou "Carla Nunes" lida como "nes". **A ausência chegava com a chave do enum no título** e ia crua para a tela — a palavra que a 0016 tirou de propósito, e que `check:cores` não pegaria porque ele procura as formas acentuadas. **1000 cenários**, 24 novos, com mutação no `security_invoker`. |
| Campanhas ponta a ponta | **A campanha virou trabalho de verdade**, em seis migrations e uma sequência de decisões do usuário. **0050 — a capa:** "para ser identificável direto pela imagem qual campanha é". **0051 — a campanha nasce com a DEMANDA**, uma etapa por entregável: a ponte (`deliverables.subtask_id` e `responsavel_id`) existia desde a 0033 e ninguém a atravessava, então a coluna nova é uma só. Tudo numa transação, porque a terceira de cinco escritas falhando deixaria uma campanha ligada a uma demanda com metade das etapas. **E ela se finaliza sozinha, nos dois sentidos** — "só é finalizada quando todas as suas etapas são entregues", e uma peça nova a reabre. **0052 — quem aprova a peça conclui a etapa:** "o responsável entrega, e o cliente conclui". O trigger **nunca derruba a aprovação do cliente**: ele está do outro lado sem ninguém por perto, e o que veria seria a aprovação dele falhando por causa de uma etapa que nem sabe que existe. **0053 — vários arquivos na mesma versão**, porque uma entrega é o PDF, o AI e o JPG; a capa passou a ser a primeira IMAGEM, não o primeiro arquivo. **0054 — o módulo virou "Campanhas", foi para a Principal e abriu para `EQUIPE`**: quem produz precisa chegar ao material dele. Abrir campanha continua sendo de quem abre demanda, e `campaigns_insert` fechou em `is_atendimento()` — a mesma função de `tasks_insert`, não uma parecida. **E a tela onde a equipe sobe o material não é área nova:** `deliverable_versions` já tinha versão, arquivo e justificativa desde a 0033 — faltava a tela, como no Social Media até a 0042. **O bug que abriu tudo isso:** `COLUNAS_DA_CAMPANHA` citava `clients(nome)` e a coluna é `nome_empresa`; o PostgREST recusa o `select` inteiro, o erro era descartado, e a tela dizia "Nenhuma campanha aberta" para quem tinha acabado de criar uma — **uma leitura que falha calada é pior que uma escrita, porque lista vazia é indistinguível da verdade**. Daí `ouFalha()`. **E de quebra, um bug de duas migrations atrás:** a 0030 reescreveu `validar_transicao_de_subtarefa()` a partir das quatro travas e perdeu o bloco de carimbos — desde então nenhuma subtarefa tinha `concluida_em`, e o contador de concluídas do mês respondia zero, que é plausível. **968 cenários**, com mutação em cinco travas. |
| Depois do 14 | **O terceiro módulo saiu do produto**, por decisão do usuário: o Meu Desenvolvimento. Tela, rota, a aba Skills em Equipe, a vitrine da Academy e duas tabelas -- `user_skills` e `skill_avaliacoes` -- apagadas na migration 0043. **O catálogo `skills` FICA**, e foi a escolha explícita: ele continua com um papel só, o vocabulário de etiquetas do Full Academy, e apagá-lo junto levaria a etiqueta de cada material. **Isto não é a 0034**: lá as tabelas fechavam em `auth.uid()` e o script de exportação era condição para apagar; aqui as duas sempre foram legíveis por `is_gestor()`, e o `exportar-antes-da-0043.sql` é conveniência. **A sugestão de skill saiu junto**, que é a parte que passa batida: a fila que decidia as sugestões morava na tela que saiu, então `sugerida_por` virou coluna que nada preenche e a policy oferecia um caminho inexistente. As abas de Equipe sumiram com a segunda -- uma navegação de um item é moldura sem função --, e o módulo voltou a se chamar **Equipe**. **A varredura de nomes mortos pegou três coisas que o `npm run build` não pegaria**: duas consultas órfãs a `user_skills` que eu tinha deixado em `lib/dados/academy.ts` e que falhariam no banco depois da migration, os tipos das duas tabelas ainda declarados, e os meus próprios comentários explicando a remoção citando os nomes que ela proíbe -- a mesma armadilha da 0016 e da 0034. E a ordem da migration custou uma rodada: `skills_insert` citava `sugerida_por`, e coluna citada em policy não sai enquanto a policy estiver de pé, exatamente como a 0039 já tinha aprendido com um trigger. **770 cenários** (os 27 do módulo viraram 10, virados do avesso: se as tabelas renascerem, o primeiro falha e diz qual). |
| Sprint 14 | **O Social Media ganhou o lado da agência.** Migration 0042. O Portal estava pronto desde o Sprint 12 e o lado de cá não existia: para um post chegar ao cliente, alguém colava SQL no Supabase por um script que o próprio cabeçalho mandava apagar no dia em que a tela existisse -- e ele foi apagado neste commit. **São três mãos**, por decisão do usuário: a gestão abre o briefing, o colaborador liberado produz, a gestão revisa e envia. `posts_insert` passou de `is_staff()` a `is_gestor()`, entrou `responsavel_id`, e a mão é **derivada e nunca gravada**, como bloqueio de subtarefa e atraso do Financeiro. **E o sprint quase virou do avesso a trava que protege o cliente**: `validar_nova_rodada` perguntava quem produziu olhando `criado_por`, que agora é a gestão -- o colaborador não conseguiria pedir o aval interno, e o responsável que produziu poderia mandar a própria entrega. Entrou `dono_do_post()`, e a bateria guarda o cenário virado do avesso. **A pergunta "por onde se escolhe vídeo, carrossel, estático ou stories" eram duas perguntas**: `midia` é o que a tela desenha e virou enum (decide qual editor aparece); `formato` é onde vai ao ar e continua texto, porque Reels e Shorts são de uma safra e a próxima vem aí -- a 0032 já tinha decidido isso e estava certa. Carrossel são `post_versions.arquivos` em jsonb, e **`posts.arte_url` continua sendo a capa**, o que faz o calendário, o card e a miniatura do portal não saberem que carrossel existe. **Vídeo é por link** (decisão do usuário, com o custo dito: o cliente decide longe do botão de aprovar), e o banco recusa enviar vídeo sem o link. Na tela, **duas visões na mesma rota** -- lista + editor e calendário + painel, escolhidas entre três propostas -- com **um editor só** nas duas, a lista agrupada por **quem está segurando** e não por status, e o **"Enviar ao cliente" desligado com a razão escrita** em vez de sumir. **32 cenários novos, 785 no total**, com mutação em três travas. **Seis erros meus**, e vale a lista porque quatro são de família: montei `validar_nova_rodada` a partir da 0032 quando a 0033 já a tinha reescrito (apaguei o `deliverable`, e o sintoma saiu três arquivos adiante); pus o bloco do vídeo no ramo do entregável em vez do post; criei um **segundo** trigger para a mesma função, quebrando o teste que sabia desligá-la; ressincronizei estado do editor num `useEffect` em vez de `key`; dei à Revisão um azul que no tema claro **é** o mesmo da Produção, deixando duas entradas de legenda com uma cor só; e os posts antigos precisavam de conversão de `formato` para `midia`, sem a qual um carrossel abriria no editor de arte única -- quem mostrou foi o seed. |
| Sprint 3D | **Demandas recorrentes.** Migrations 0040 e 0041: `task_recurrences` com a regra e `recurrence_runs` com cada execução, em **dois modos** -- uma task por mês com uma etapa por dia (trabalho diário, senão o board teria vinte e duas linhas do mesmo trabalho) ou uma task inteira a cada repetição (quando cada uma tem etapas próprias). **A idempotência é o índice único e não uma consulta**: a execução é inserida primeiro, com `on conflict do nothing returning id`, e sem linha de volta a chamada desiste -- duas abas clicando em "Gerar agora" passariam pelas duas consultas antes de qualquer uma gravar. **Nunca retroativo**, e a geração **não roda sozinha**: o agendamento é de outro sprint. O `exception` fica dentro do laço, senão uma regra quebrada levaria junto as outras dezenove da madrugada. Na tela, a aba mora em `/painel/workflows` ao lado dos workflows, e **a prévia das cinco próximas é a razão do formulário ter este formato** -- uma recorrência é a única coisa no produto que cria trabalho sozinha, de madrugada, e sem a prévia o primeiro retorno de uma regra torta chega quando alguém vê doze demandas iguais no board; ela recalcula a cada tecla, o que é por que `proximasOcorrencias()` existe ao lado de `datas_da_recorrencia()`. Três pontos de entrada: "Nova recorrente" em Gestão de Tasks, o selo **Recorrente** na task gerada (um link para a regra) e **"Transformar em recorrente"** no fim do detalhe -- que **abre o editor pré-preenchido e não grava nada**, porque uma task não sabe a cadência dela: ela tem um período, não uma frequência. A 0041 veio por decisão do usuário e acrescentou o **responsável padrão da regra**, `coalesce(etapa, padrão)` nessa ordem: o buraco eram os dois caminhos em que ninguém preenche etapa por etapa, e etapa sem dono não aparece no "Minhas Tasks" de ninguém. **77 cenários novos, 753 no total**, e três erros meus que a verificação pegou: o rótulo "semana de" numa regra mensal (o seed mostrou), uma checagem de `pessoa_desligada()` duplicada que o teste de mutação provou ser uma segunda verdade, e **"Gerar agora" gerando numa regra pausada** -- a imagem do protótipo mostrou o botão ao lado da frase que diz que nada mais é gerado. De quebra, dois erros de layout que só a imagem pega: o `SelectTrigger` nasce `w-fit` e o de Cliente saiu como um botão sem rótulo, e em 375px o "Criar recorrência" ficava acima da prévia. |
| Depois do 13 | **Dois módulos saíram do produto**, por decisão do usuário: o Resumo Semanal e o Financeiro Pessoal. Tela, rota, dados e tabelas — `weekly_entries`, `weekly_notes` e `personal_finance_entries` apagadas na migration 0034. O módulo pessoal que **fica** é o de Notas Fiscais; o Financeiro da casa também fica, que é outro módulo e só do sócio. **A migration apaga dado de pessoa e não tem volta**, e as três tabelas fechavam em `auth.uid()` — ninguém sabia o que havia dentro sem consultar o banco como dono. Por isso ela vem com `scripts/exportar-antes-da-0034.sql`, que põe o conteúdo na tela para ser entregue a quem escreveu, e não exporta para lugar nenhum de propósito: gravar aquele texto em outra tabela contornaria a promessa que ele carregava. Apagar e não aposentar, como a 0023 fez com `tasks.exigencia_aprovacao`. Os dois nomes entraram na varredura de `check:cores` — a lista **cresce**, como a do vocabulário do Full Days —, e ela pegou sete lugares que ainda os citavam, **um deles texto de tela**: as configurações do portal diziam "é a mesma regra do Resumo Semanal" para a gestão ler. Junto saiu a bandeira `discreto` do `MenuItem`, que sem o único módulo que a ligava virou campo que não decide nada. **597 cenários, todos passando** (31 saíram com os módulos). |
| Sprint 13 | **Campanhas: a Wave, a árvore e a decisão de cada peça.** Migration 0033, o terceiro ato da 0030 — com `deliverable`, os três tipos do enum passam a ter dono. `campaign_templates`, `campaigns`, `deliverables` e `deliverable_versions`, com a árvore em **dois níveis e nunca três** e o **status do grupo derivado**, sem coluna: `status_do_entregavel()` e `statusDoGrupo()` fazem a mesma conta nos dois lados, e o valor escrito à mão num grupo é descartado em vez de recusado. `rejeitado` num filho deixa o grupo em `ajustes`, não em `rejeitado` — ninguém recusou o grupo, e vermelho num grupo com catorze de quinze aprovados afirma outra coisa. Toda conta olha **só as folhas**. O cliente enxerga a **campanha desde o planejamento** e o **entregável só depois de enviado**, e essa assimetria mora nas duas policies, não na consulta. O template é uma **árvore em `jsonb`** e não um par de tabelas, porque é uma lista de nomes que alguém edita inteira antes de salvar; na abertura ele é **ponto de partida, não contrato** — a árvore editada é o que viaja para a action, e os filhos casam com os pais **por posição**, porque "Feed/story site" aparece duas vezes na Wave. A linha de cada item **muda por status** (quem aprovou, há quantos dias espera, o motivo da recusa, o prazo), e o grupo abre sozinho quando tem pendência. O alerta de 7 dias fala de "não aprovados" e não de "esperando você" — são contas diferentes, e as duas frases mostravam números diferentes na mesma campanha até a imagem em 375px pô-las lado a lado. **A tela de detalhe do material é uma só**: post e entregável montam o mesmo `ModeloDoConteudo`, e o que é compartilhado é a casca, não a leitura. Campanhas e entregáveis entram nas pendências do Portal, no bloco "Campanhas ativas" e no calendário da agência — a campanha pelo **encerramento**, não como faixa de trinta células. De quebra, três erros meus que a verificação pegou: o seed carimbando `enviado_em` em item que ninguém enviou (o cliente via doze "Em produção"), o título encolhido a "Feed/…" em 375px porque o selo não cede largura, e o "Copiar legenda" que sobrou na seção "Descrição". E um furo no `check:mensagens`: ele lia linha a linha, então uma chamada quebrada em várias linhas não era contada — nem falha, nem aviso. Agora varre por posição, e achou duas que vinham sendo puladas. |
| Sprint 12 | **Social Media: o calendário e a decisão do post.** Migration 0032, que é o segundo ato da 0030 — ela generalizou a rodada e deixou `post` recusado de propósito, com a frase "quem acrescentar o tipo acrescenta a regra na mesma migration"; é o que este sprint faz, e `deliverable` continua recusado. `posts`, `post_versions` e `comments`, com o cliente enxergando só o que tem `enviado_em` preenchido — e essa linha mora na policy, não na consulta, que é o que faz um post em produção não existir para ele nem pelo id na mão. **Enviar É abrir a rodada de escopo cliente**: o carimbo é consequência dela, por trigger, porque separados dariam rodada num post invisível e post carimbado sem onde decidir. `status_rodada` ganhou **`rejeitada`** — rejeitar não é pedir ajuste, e reaproveitar o mesmo valor faria a rodada dizer uma coisa e o post outra; os dois desfechos negativos exigem motivo, na ação e no banco; e `rejeitada` **não** vale para etapa de demanda, que tem dois desfechos desde a 0007. `comments.interno` e o autor são forçados por trigger, porque policy não limita coluna. O calendário é de **servidor inteiro** — mês, visão, dia e filtros na URL —, vira lista por dia em 375px, e a rede aparece como **sigla de duas letras**: o lucide tirou os ícones de marca, ícone genérico não distingue uma rede da outra, e os logos trariam marca registrada e cor literal. A legenda **agrupa os status que dividem a mesma cor** em vez de mostrar sete linhas e cinco cores, e o nome exato vai no `title` e no rótulo acessível. No detalhe, a ordem é a da decisão: arte com zoom de verdade, informações, legenda, e só então os botões; "solicitar ajustes" fica à vista, que é a ação mais comum. O histórico de versões **não tem reverter**, e a trava é a policy. Posts entram nas pendências da tela inicial do Portal e no calendário da agência. **66 cenários novos, 574 no total**, e dois erros meus que eles pegaram: o trigger de autor apagando o que o seed informou, e um cenário que passava pelo motivo errado. De quebra, o **seed estava quebrado desde o Sprint 11** — ainda escrevia em `approval_rounds.subtask_id`, coluna que a 0030 apagou. |
| Sprint 10 | **Os três níveis, e três regras que o usuário mandou mudar.** `subtasks.parent_id` (migration 0022) dá o terceiro nível — demanda → etapa → sub-etapa, **três e nunca quatro**, com o neto recusado por trigger. A decisão que organiza o resto é **quem tem filha vira agrupadora**: a mesma regra que a Task já seguia, um nível abaixo. A mãe para de medir tempo, tem o status calculado pelas filhas, não exige aval, não entra em dependência, não abre rodada — e some de toda soma, que passa a contar **só as folhas**. Sem isso tudo contaria duas vezes, e a rentabilidade cobraria em dinheiro um trabalho que aconteceu uma vez. O que estava gravado na mãe **não** é apagado: para de contar enquanto ela tiver filha e volta se a última sair. A **exigência de aprovação saiu da Task** (0023), e o motivo foi ele quem apontou: a trava da 0014 aceitava UMA rodada aprovada em QUALQUER subtarefa, então uma campanha passava com o conceito aprovado e o resto nunca visto — produzindo confiança sem a checagem. Agora `entregue` só passa quando TODA etapa que pede aval tem a rodada aprovada dela, e a mensagem conta quantas faltam e nomeia cada uma. A coluna foi apagada: um campo que não decide mais nada é o pior tipo de campo. O formulário de abertura voltou a ter **cinco seções**. Os **sete status se marcam à mão** (0025): tirar a frase de recusa não bastaria, porque o recálculo desfaria a escolha na próxima mexida numa etapa — então `status_manual` passou a travar o cálculo inteiro, e o volante se devolve por "deixar o Full Hub calcular", com `tasks_volta_a_calcular` recalculando na hora. O seletor virou popover com **busca, grupos e ponto colorido**, sem nada desligado, e o mesmo componente serve a etapa — onde quem recusa passou a ser o banco, cuja recusa diz o caminho. **Minhas Tasks lista ETAPAS**: "Conteúdo" e "Layout" da mesma demanda são dois itens, com a demanda virando linhagem e a ordem global. E no Full Days o **descanso conta corrido** (0024) — quinze dias de calendário, não quinze úteis —, com os outros dois tipos seguindo em dias úteis porque não descontam saldo; a matriz passou a pintar o período inteiro, fim de semana inclusive. A etapa ganhou **período** (0027): `data_inicio` ao lado de `prazo`, os dois opcionais, com o fim guardando o nome antigo porque renomear coluna em uso é migration arriscada sem nada em troca. E **"+ Nova task" passou a abrir a tela de detalhe** (0028): a demanda nasce como rascunho no clique, tudo salva sozinho, e o botão Criar task muda uma coisa só — a demanda passa a existir para a equipe. O rascunho é de quem o criou e de mais ninguém, por RLS **restritiva**, uma por tabela: a primeira versão usou permissiva, e permissiva é OR — dava para *apagar* a referência de um rascunho que não se conseguia enxergar. E a **trava de autoaprovação saiu** (0029), desfazendo a 0026: eu tinha lido "qualquer desenvolvedor pode aprovar qualquer task, mesmo que a task seja dele mesmo" como relato de furo, e era a descrição do que ele queria — a 0026 fechou um furo que não existia. Agora quem decide rodada interna é `is_gestor()`, e mais nenhuma pergunta; os três cenários que provavam a trava ficaram, virados do avesso, para o dia em que alguém reintroduzir uma das perguntas. **145 cenários novos, 464 no total**, e quatro deles nasceram de erro meu que a bateria pegou: uma expectativa de saldo errada, um cenário de tempo medido que passava sem separar a resposta certa da errada, um `check` que eu ia criar e que já existia desde a 0007, e a policy permissiva da 0028. |
| Sprint 9 | A abertura da demanda: o formulário de Nova Task em seis seções numeradas, cada uma com a linha que diz a que pergunta ela responde; `tasks.exigencia_aprovacao` (nenhuma / interna / cliente — **três valores, não quatro**, porque `cliente` já passa pela interna) travada por `tasks_exige_aprovacao_para_entregue`, que recusa `entregue` sem rodada **aprovada** do escopo exigido e cujo `hint` aponta a saída quando nenhuma etapa cumpre a exigência; `tasks.link_entrega` com `check` de http/https, separado das referências de apoio; a estimativa de tempo da subtarefa ganhando input (existia no estado e ia para a action, sem campo nenhum na tela); link de referência por campo em vez de `window.prompt`; o select de Cliente voltando a mostrar o placeholder; e **nenhum seletor de "Status Geral"**, porque o status é calculado e a escolha seria desfeita no mesmo instante. A pasta de entrega virou **obrigatória** (`tasks_exige_pasta_de_entrega`, migration 0015 — trigger e não `not null`, para a migration rodar em ambiente com task antiga), e ela não se apaga, só se troca. E **"tipo de tarefa" virou Workflow** em toda a interface: o produto falava dois nomes para a mesma coisa, o menu dizia um e o formulário dizia outro. E o **vocabulário do Full Days saiu do direito trabalhista** — a equipe é toda PJ, e palavra da CLT num sistema da própria contratante é prova documental: recesso programado, indisponibilidade, ausência pontual, "sem alocação", e "de acordo" / "preciso remarcar" no lugar de aprovar e reprovar. O alerta do relatório deixou de afirmar que a empresa passa a dever em dobro (art. 137 da CLT escrito dentro do produto) e passou a apontar quem está há mais de um ano sem parar. A migration 0016 reescreve as frases que nascem no Postgres, `check:cores` varre `src/` atrás das formas acentuadas, e a bateria confere o corpo das funções nos dois sentidos — as antigas fora, as novas dentro. 34 cenários novos, 264 no total. E o **Full Academy** e as **Recomendações** (migration 0017): trilhas que nascem em rascunho e só a gestão enxerga enquanto não forem publicadas; progresso e anotação que só a própria pessoa escreve, com o acompanhamento da gestão lendo uma **view sem a coluna de anotação** — policy não limita coluna, então a separação é a view; vídeo do YouTube e do Vimeo incorporado e o resto em aba nova, avisando antes; reordenar material numa RPC transacional que **não** é `security definer`; e um feed de indicações sem fila e sem aprovação, com curtida, thread de um nível só travada por trigger, tag normalizada nos dois lados, filtros na URL e remoção pela gestão exigindo motivo que vai por notificação ao autor — o campo dentro do diálogo, porque um input aberto em cada cartão virava a coisa mais alta de um feed que precisa ser leve. **Sem quiz, certificado, nota ou gamificação**, e `verificar-9.mjs` varre a tela atrás dessas palavras toda vez, nos dois perfis: metade dos critérios é sobre o que a equipe **não** alcança, e rodando só como sócio eles passariam sem nunca ter sido testados. 55 cenários novos, 319 no total. |
| Sprint 8 | Financeiro: módulo da agência só para `socio` — `contracts`, `finance_categories` e `finance_entries` com RLS fechada em `is_socio()` nos quatro comandos, sem exceção para o desenvolvedor; competência, vencimento e pagamento como três datas distintas; atraso **derivado** da data em vez de gravado, com trigger recusando quem tentar gravá-lo; "gerar lançamentos do mês" travado por índice único parcial, que não duplica nem com duas abas; quatro abas em `/painel/financeiro` (Visão Geral com cartões previsto × realizado, série de 12 meses e alertas; Lançamentos com filtros na URL, CSV nos dois sentidos e "marcar pago"; Contratos com recorrência contada do mês de início; Relatórios com DRE por categoria e rentabilidade cruzando receita com o tempo das **subtarefas**); três gráficos em SVG com paleta medida contra daltonismo; e o Financeiro Pessoal de volta ao menu como módulo opcional e privado, com replicar recorrentes e apagar tudo em duas etapas. 44 cenários novos de RLS. |
| Sprint 7 | Desenvolvimento e Skills: catálogo compartilhado de 20 skills com sugestão da equipe esperando a gestão; `user_skills` que só a própria pessoa escreve, com o nível em quatro segmentos carregando a rubrica; `skill_avaliacoes` escrita pela gestão e lida por quem foi avaliado; `/painel/meu-desenvolvimento` salvando sozinho; aba Skills em Equipe com busca de quem sabe, matriz pessoa × skill, lacunas da agência pelo critério do **um** e o que cada um quer aprender; e o Resumo Semanal ganhando texto rico por semana, humor opcional, "puxar minhas entregas" datado na conclusão, busca no próprio histórico pela URL e exportação em texto puro — tudo privado, sem porta para a gestão. 38 cenários novos de RLS. |
| Sprint 6 | Full Days: tabela `notifications` com a escrita só por `notificar()`, e o sino da topbar deixando de ser casca; recesso de 15 dias em até duas parcelas com as regras em trigger (o módulo nasceu falando a língua da CLT; o vocabulário saiu no Sprint 9); `hr_requests`, `team_presence` e `holidays` com os feriados de 2026 e 2027 e `dias_uteis()`; decisão do sócio numa função transacional que pinta a matriz junto; quatro abas em `/painel/full-days` (Matriz da Equipe agrupada por área com CSV, Relatório Gerencial com alerta de quem está há muito tempo sem parar, Solicitar com calendário de seleção e bloqueio por área nomeando quem está fora, e Aprovações só do sócio, com lote); e 46 cenários novos de RLS. |
| Sprint 3C | Tela inicial, menu definitivo e Portais de Clientes: identidade visual em tokens com `npm run check:cores` provando 26 pares de contraste e nenhum hex solto; menu em duas seções (Principal / Gestão com selo Admin) com Diário→Resumo Semanal e Minhas Skills→Meu Desenvolvimento redirecionando em 308; barra lateral escura com cartão da pessoa separando nome, cargo e perfil; tela inicial com boas-vindas, Acesso Rápido e a grade de Portais de Clientes; `/portal/{slug}` para a gestão ver o portal de um cliente em modo leitura, com faixa de aviso, registro em `client_portal_views` e a recusa valendo no banco; Resumo Semanal organizado por semana com registro privado; Notas Fiscais como módulo da pessoa; Financeiro Pessoal em aba dentro de Meu perfil. |
| Sprint 0 | Esqueleto: shadcn/ui com tema claro/escuro, login por e-mail e senha, recuperação de senha, os 4 perfis de acesso, tabelas `profiles` / `clients` / `client_users` / `team_members` com RLS, proteção de rota por perfil com HTTP 403, timeout de inatividade do portal, seed de desenvolvimento e homes vazias das duas áreas. |
| Correção do Sprint 2 | Gravação dos cadastros: criação de usuário virou Server Action com `createUser` + link de senha (não depende mais de SMTP) e rollback; policies de `clients`, `client_users` e `team_members` separadas por comando, com DELETE só de sócio; `profiles` passou a aceitar edição da gestão; usuário cliente ganhou UPDATE das próprias três colunas de contato, com trigger travando o resto; contrato `{ ok, error }` em todas as actions com erro real na tela e no log; exclusão de cliente bloqueada por qualquer vínculo; desligamento transferindo tasks em aberto de verdade; ativar/desativar colaborador pela gestão; seed com 6 colaboradores, 3 empresas e 3 acessos ao portal. |
| Sprint 3B | A subtarefa vira a unidade de trabalho: a Task perde responsável, prazo e tempo próprios e ganha período; migration preservando toda atribuição existente como subtarefa "Execução"; máquina de estados no banco (conclusão bloqueada sem aprovação, dependência travando o início, ninguém aprovando a si mesmo, ciclo recusado); status da Task calculado por trigger com `entregue` e `cancelada` como únicos manuais; fluxo de aprovação em rodadas que nunca se sobrescrevem, com aval interno sempre antes do envio ao cliente; tipos de tarefa e workflows com snapshot; tela `/painel/workflows`, fila `/painel/aprovacoes-internas` e aprovação do cliente no Portal; tempo em minutos com entrada flexível; e 61 cenários de RLS em `supabase/testes/`. |
| Sprint 4 | Minhas Tasks: visão pessoal em `/painel/minhas-tasks` para todo perfil interno, mostrando as tasks onde a pessoa é responsável **e** as subtarefas dela dentro de tasks alheias; três contadores clicáveis (atrasadas, para hoje, esta semana) que filtram e batem com as listas; widget "Meu dia" com conclusão em um clique; board, lista e calendário reaproveitados por parâmetro (clique abre painel lateral, card de task alheia não arrasta); calendário com barra colorida por situação, rótulo Entrega/Etapa, chip do cliente e legenda; detalhe em painel lateral sem trocar de página; criação de task restrita a `is_atendimento()` na interface e na policy; e registro de tempo ao concluir task ou subtarefa, com a estimativa sugerida e opção de pular. |
| Sprint 3 | Gestão de Tasks: tabelas `tasks` / `subtasks` / `task_referencias` / `task_comentarios` com RLS por `pode_editar_task()`, board com arrastar e soltar otimista, lista com edição inline e ações em massa, calendário mensal e semanal mostrando prazo de task e de subtarefa separados, editor rico TipTap no briefing, detalhe em duas colunas com comentários e referências em bucket privado, filtros na URL e atalhos N e /. |
| Sprint 2 | Cadastro base: módulos Clientes e Equipe completos, criação de usuários no servidor com chave de serviço, convite de acesso ao portal, enum `team_funcao` com `is_atendimento()`, desligamento em duas etapas com transferência, exclusão de cliente em duas etapas bloqueada por vínculos, e Meu perfil com avatar no Storage. |
| Sprint 1 | Estrutura do dashboard: `lib/auth/permissions.ts` como fonte única do menu e das permissões, menu lateral colapsável com seções e gaveta no celular, topbar com trilha, busca (casca), sino e menu do usuário, 15 rotas placeholder validando o perfil no servidor, cor de marca em variável CSS, 10 componentes compartilhados com vitrine em `/painel/dev/componentes`, e o casco do Portal do Cliente com navegação superior. Nenhuma tabela nova. |
