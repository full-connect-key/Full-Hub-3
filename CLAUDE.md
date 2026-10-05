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

**Tudo sai de UMA view, `calendar_events`**, que junta SEIS origens num
formato só: ausência, evento, post, **etapa de post**, campanha e entregável.
Nenhuma tabela de evento agregado: uma tabela que copia data de post e período
de campanha precisa ser reescrita por vários caminhos para continuar
verdadeira, e no dia em que um deles falhar o calendário mente sem avisar. É a
mesma razão pela qual bloqueio de subtarefa não é status e atraso do Financeiro
não é coluna.

**Eram OITO, e a demanda e a etapa saíram na 0077** — decisão do usuário:
*"quero que elas fiquem apenas dentro do Minhas Tasks"*. A oitava origem
(etapa de post) entrou na 0059 exatamente como este parágrafo dizia que
entraria, com um `union all` a mais; as duas primeiras saíram do mesmo jeito,
tirando dois.

**Saíram da VIEW, e não só da lista de camadas**, e a diferença é o que
impede que voltem: uma camada é um interruptor, e tirar o interruptor
deixando a origem produzindo esconde as linhas desta tela e as entrega de
graça ao próximo consumidor da view — a exportação, um relatório, uma tela
nova. É a decisão da 0023, que apagou `tasks.exigencia_aprovacao` em vez de
deixá-la parada.

**O que a Linha do Tempo NÃO perde é a carga**, e é o que faz a remoção
caber. A cor de cada célula é ocupação, e ela sai de `carga_da_equipe()`
chamando `carga_do_dia()` (0035) — nenhuma das duas lê a view: elas leem
`subtasks` direto. Sai a BARRA da etapa e fica o PESO dela, que é o que
responde "a equipe aguenta?".

**E o arrasto saiu junto.** Ele valia para uma camada só — a etapa, porque o
prazo dela é escrito por quem a faz; nos outros ele prometia uma mudança que o
banco desfaz ou recusa. Sem aquela camada não sobra nada nesta grade que se
mova arrastando, e um alvo de solta que recusa tudo é um gesto que não faz
nada. Quem arrasta agora é o board de etapas de Minhas Tasks.

**A coluna `prioridade` continua na view, e nenhuma origem a escreve.**
`create or replace view` não deixa TIRAR coluna — só acrescentar no fim —, e
um `drop`/`create` derrubaria junto os grants de um objeto que o PostgREST
publica. É `cancelada` no enum de status visto de outro ângulo: o valor fica,
e nenhum caminho o produz.

**`security_invoker = true` é a linha mais importante da migration.** Uma
view comum no Postgres roda com os direitos de QUEM A CRIOU — o superusuário
da migration —, e sem essa cláusula a `calendar_events` lê as tabelas de
origem inteiras para qualquer pessoa autenticada, furando a RLS de todas de uma vez
num objeto que o PostgREST publica sozinho. **E o furo passa despercebido num
banco com um cliente só:** ele vê seis campanhas, que é o total, e "seis de
seis" tem a mesma cara com a RLS ligada e desligada. Por isso a bateria cria
material de DUAS empresas — tirando a cláusula, seis cenários falham e dizem
o que vazaria.

**O filtro de rascunho saiu com as duas origens que o usavam**, e o registro
fica porque a regra continua valendo em toda parte: a RLS restritiva esconde o
rascunho dos outros e a consulta esconde o meu. Na view ele era
`publicada_em is not null`, e com a demanda e a etapa fora não há mais o que
filtrar. E **`rascunho` e `cancelada` não existem como status** — o sprint da
0055 filtrava por eles, e `rascunho` nem é valor do enum: o Postgres recusaria
a criação da view, com um erro falando de enum e não de rascunho.

**Os cenários que mediam os dois filtros ficaram, virados do avesso.** A
bateria da 0055 provava que o rascunho não vazava e que só a folha entrava; as
fixtures continuam todas de pé — demanda publicada, rascunho, mãe e filha com
prazo — e hoje o que se confere é que nenhuma atravessa a view, nem para o
sócio. Devolvendo um dos dois `union all`, um deles falha e diz qual. **E um
deles mede o TEXTO da view** e não a contagem: num banco sem demanda nenhuma,
todos os outros passariam com as origens de pé.

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

**A aba mora em Gestão de Tasks, ao lado dos workflows**, e a proximidade
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

**O wordmark "full connect key" NÃO APARECE MAIS NO PRODUTO**, e a ausência é
consequência de uma decisão e não esquecimento. Ele é um lockup fechado — três
linhas que se encaixam, com o próprio símbolo dentro —, não uma linha de
assinatura: embaixo de "Full Hub" ele repetia o disco que estava logo acima e
disputava o mesmo espaço, e abaixo de uns 24px de altura as linhas fecham e ele
vira um borrão. Ele tinha um lugar só, o painel escuro da tela de login, que
existia justamente para dar a ele a largura em que as três linhas se leem.

**A porta virou preta e centralizada, e a coluna escura saiu junto** (a decisão
está em "A porta", logo abaixo). Sem ela não há onde ele caiba, e a instrução
do usuário — *"apenas o logo da agência"* — tirou também a assinatura em caixa
alta que poderia ocupar o lugar. Os quatro arquivos continuam em
`public/marca/`, e devolvê-lo exige uma tela com largura para ele.

Nos lockups pequenos do painel a assinatura continua sendo "FULL CONNECT KEY"
em caixa alta espaçada, que se lê a 9px — isso não mudou.

**A versão branca veio cortada na primeira entrega**, e foi o usuário quem
viu: 833 × 428 contra 833 × 454 da colorida — 26px a menos embaixo, o "y" e o
triângulo pela metade. O arquivo certo tem a mesma proporção da colorida, e é
assim que se confere um: pela caixa do conteúdo, não de olho. Fica registrado
porque o arquivo continua na pasta, e quem o usar de novo herda o problema se
pegar o errado.

**`src/app/icon.svg` é o TERCEIRO arquivo com cor literal**, e a exceção está
registrada em `check:cores` — que passou a varrer `.svg` dentro de `src/` por
causa dele. O navegador serve o ícone da aba sozinho, sem a folha de estilo do
app, então não existe `var(--marca-disco)` para ele ler; a troca por tema vive
num `prefers-color-scheme` dentro do próprio arquivo. Deixá-lo fora da
varredura faria a regra dizer que só há dois lugares com cor literal, e o
terceiro ficaria invisível.

#### A porta: preto, a molécula, e o cartão de vidro no centro

`components/auth/casca-de-autenticacao.tsx` envolve as quatro telas de
`(auth)` — login, esqueci-senha, redefinir-senha e trocar-senha. Fundo preto
com uma molécula azul atravessando, e um cartão de vidro centralizado com o
símbolo da agência no alto.

**É a quinta rodada de uma proposta, e o caminho fica registrado porque cada
volta custou.** As quatro primeiras partiam de uma referência que o usuário
mandou — vidro sobre degradê, em três disposições — e ele recusou todas: *"não
gostei de nenhuma"*. O que estava errado era a **composição**, e a instrução
que fechou é dele, palavra por palavra: *"quero que centralize as informações,
deixe o fundo preto, com um degradê azul passando, como se fosse uma molécula
se dividindo e se juntando. Além disso, quero que deixe apenas o logo da
agência, sem escrever Full Hub, quero uma letra mais contemporânea,
tecnológica."*

**A MOLÉCULA É METABALL, e o efeito inteiro são duas linhas de filtro SVG**
(`components/auth/fundo-da-porta.tsx`): desfoca os seis círculos e depois
**afia o canal alpha**. Duas gotas desfocadas que se aproximam têm os halos
somados, e o corte do alpha transforma essa soma numa borda só — elas fundem.
Afastando-se, a soma cai abaixo do corte e a borda se parte em duas. Sem o
afiamento seriam manchas se sobrepondo, que é o que **parece** molécula e não é.

São **duas animações empilhadas**, e os tempos não batem de propósito: cada
átomo converge para o centro e volta às bordas em 26s — é o dividir e juntar —,
e o conjunto atravessa a tela em 64s — é o degradê passando pelo fundo. Sem a
segunda, a molécula ficaria respirando parada no meio da tela.

**Os dois atrasos são NEGATIVOS, e isso saiu da imagem.** Em 0% os átomos estão
no ponto mais afastado e o conjunto está no canto: o primeiro quadro da porta
— o que a pessoa vê ao chegar, e o único que um print captura — era seis discos
separados empilhados num canto, e a molécula só se reconhecia como molécula
treze segundos depois. Com `-6.5s` nos átomos e `-10s` no conjunto, a tela em
repouso já mostra o que o movimento faz. **Cada átomo é um degradê radial e não
um tom chapado**, pela mesma razão: chapado, a gota se lê como adesivo.

**Os tempos moram no `globals.css` e o desenho no componente.** Tailwind v4 não
escreve `@keyframes` por utilitário, e espalhá-los em `style` inline daria aos
seis átomos seis fontes de verdade sobre o mesmo compasso.

**O VIDRO É 82% OPACO, E O NÚMERO FOI MEDIDO.** A proposta usava 58%, que é mais
bonito e reprova: com a molécula passando atrás, o fundo efetivo do cartão vai
de quase preto até o composto do vidro sobre o ponto mais claro dela, e nesse
pior caso `--auth-apoio` dava **2,71:1** — o subtítulo, o link e o placeholder
ilegíveis por um instante a cada volta, num tempo que ninguém consegue
reproduzir de propósito. É a regra do selo de estado vista de outro ângulo:
**ninguém mede uma cor que anda.** Quem garante o contraste é o cartão, e ele
precisa ser escuro o bastante para o texto passar qualquer que seja a luz atrás.

75% já passaria, em 4,74:1, e 82% é escolha e não mínimo: a folga é de dois
centésimos e meio, e o pior caso medido é ele mesmo uma aproximação, porque o
halo é uma segunda camada de luz por cima da primeira. O que se lê como vidro é
o `backdrop-filter`, não a transparência.

**`--vidro-no-pior-caso` é um token que NADA pinta.** Ele é o composto
calculado (`0,82 × #060C10 + 0,18 × #BCE4F9`) e existe para o `check:cores` ter
contra o que medir: contra `--auth-fundo`, que é preto, os três textos passariam
por larga margem afirmando algo que a tela não garante. **Medido com mutação:**
devolvendo o token ao composto de 58%, três cenários caem e dizem quais.

**SÓ O SÍMBOLO, e "Full Hub" não aparece escrito em lugar nenhum da porta.** É o
pedido do usuário. O símbolo é a versão **azul** do arquivo da agência — disco
azul, ponto branco, triângulo cinza —, que é a que existe para fundo escuro: a
de disco escuro desapareceria no preto.

**A porta NÃO TEM MAIS LETRA PRÓPRIA, e a história fica porque o argumento
mudou de lado.** Ela teve: Sora, carregada só em `(auth)` por `next/font`, com
a conta escrita — uma letra a mais no produto inteiro seria peso em toda
visita, para uma tela que se vê uma vez por dia, e carregá-la por rota era o
que tornava a troca barata. **Decisão do usuário: a família do produto passou a
ser a Google Sans**, no `layout.tsx` da raiz, e com isso não há segunda letra —
a porta usa a letra do trabalho, e a conta que justificava a exceção deixou de
existir.

O token `--font-porta` foi **apagado** do `globals.css` em vez de repontado:
dois tokens para a mesma família são duas verdades esperando divergir, e o dia
em que alguém trocasse um deles a porta sairia com outra letra sem ninguém ter
pedido. É a decisão da 0023 com a coluna apagada, aplicada a um token.

**A escolha da Google Sans foi CONFERIDA, não lembrada** — e a primeira
resposta ia ser que não dava. Ela sai pelo Google Fonts, e o CSS dela não traz
a nota `googlerestricted` que o Product Sans traz; ela está no catálogo do
`next/font`, com eixo variável `wght` de **400 a 700**, e o produto não usa
nada acima de 700, então a faixa cobre a escala inteira. **`Google Sans Text`
ficou de fora**, e a ausência é decisão: é ela a face desenhada para tamanho
pequeno, é assim que o Google usa o par, e ela **não está** no catálogo do
`next/font` — entraria por `next/font/local`, com binário versionado no
repositório. Se um dia o texto de 11px cobrar, é essa a porta.

**O título do login ALTERNA entre a saudação e o lema da agência** — "Sejam
bem-vindos!" e "Entender, Conectar e Vender, essa é a **chave**!" —, com as
palavras subindo do desfoque, uma depois da outra. "chave" sai em azul porque é
a palavra que liga o lema ao nome da agência: Connect **Key**.

- **O `<h1>` continua sendo "Entrar", e é `sr-only`.** Quem usa leitor de tela
  ouve o nome da tela, não uma saudação que troca sozinha a cada cinco segundos,
  e a página fica com um título estável. Sem isso, a mesma tela teria dois
  títulos diferentes conforme o segundo em que alguém chegasse nela.
- **A animação é CSS puro**, sem estado e sem `setInterval`: a porta é a tela
  que alguém abre quando nada mais funciona, e uma frase que depende de hidratar
  é uma frase que pode não aparecer. A segunda frase usa `animation-delay`
  negativo, que é como duas animações iguais ficam em contrafase sem um relógio
  compartilhado.
- **As duas moram na MESMA célula de grade**, então a altura do bloco é sempre a
  da maior e o cartão não muda de tamanho a cada troca. E `align-items: center`
  centraliza a de uma linha nesse espaço — sem ele, "Sejam bem-vindos!" começava
  no topo da célula e parecia mais alto que o lema, com um vão embaixo.
- **Só o login alterna.** As outras três respondem a um pedido — "Recuperar
  senha", "Criar nova senha", "Olá, Joana" —, e pôr o lema piscando por cima
  delas trocaria a informação de que a pessoa precisa por uma frase de marca, no
  momento em que ela está tentando resolver um problema. `TituloDaPorta` mora no
  mesmo arquivo do lema para as duas escalas de texto não divergirem.
- **A alternância não acontece com `prefers-reduced-motion`**: a segunda frase
  sai da tela e a primeira fica inteira e parada. Texto que troca sozinho é
  justamente o que essa preferência pede para não acontecer. A molécula para no
  estado **separado**, que é o quadro em que se reconhece que são gotas.

**`CampoDaPorta` existe para as quatro telas não divergirem.** Cada uma montava
os campos por conta própria; com o desenho novo isso passaria a significar
quatro versões do mesmo campo de vidro, e a que divergisse seria a de
trocar-senha — a tela que ninguém abre depois do primeiro acesso. Ele é o
`Input` do shadcn com as cores trocadas, e não um `<input>` cru: o que vem de
graça dali é o anel de foco, o `aria-invalid` pintando a borda e o estado
desabilitado.

**O selo de erro e o de aviso continuam com fundo claro sobre o vidro escuro**,
e é consequência aceita: eles são o par nomeado do produto, desenhado para
superfície clara, e sobre o vidro viram um bloco luminoso. Numa tela em que a
mensagem é "sua sessão caiu" ou "e-mail ou senha incorretos", ser impossível de
não ver é o lado certo do erro. A imagem `03-login-sessao-expirada` existe para
conferir isso.

**Em 375px o cartão encolhe o respiro e nada mais.** Não há coluna para esconder
nem painel para dobrar — é a vantagem de centralizar, e é a razão pela qual esta
casca não tem um único `hidden lg:block`. A imagem de 390px continua sendo a que
decide.

**A porta é preta nos DOIS temas**, como a barra lateral: os tokens dela vivem
só no `:root`, sem par no `.dark`. A imagem `02-login-escuro` existe para provar
isso — duas imagens iguais ali são o resultado certo.

**O seletor "Cliente / Colaborador" NÃO decide o login, e é decisão do
usuário que exista assim mesmo.** Quem decide para onde a pessoa vai é o
perfil gravado em `profiles` — `rotaInicialDoRole()` manda `cliente` para
`/portal` e o resto para `/painel`, qualquer que tenha sido o botão clicado.
Fazer o seletor valer de verdade criaria um jeito novo de falhar na porta
("opção errada") e contaria a quem estivesse tentando se um e-mail é de
cliente ou da equipe.

**A LEGENDA SAIU, por decisão do usuário, e com ela foi a única frase que
explicava isso em voz alta** — *"os dois entram pelo mesmo formulário: o Full
Hub reconhece você pelo e-mail"*. Sem ela, quem clica em "Colaborador" e cai no
portal pode concluir que o sistema errou. O que sobrou de visível é o
**subtítulo**, que continua trocando com o seletor: sem ele o clique não mudaria
nada na tela, e um botão que não muda nada é um botão que a pessoa clica duas
vezes achando que travou.

O seletor mora ao lado da frase que ele muda, num arquivo só, e a tela de
login o posiciona por um contexto: são as duas metades da mesma decisão, e
separadas divergiriam na primeira mudança de texto. A escolha **não** é
lembrada no navegador — o cliente costuma entrar de computador compartilhado,
e a tela abriria com a frase do outro público.

#### A interface "Leve", e o que ela trocou

Decisão do usuário, a partir de uma referência que ele mandou e de quatro
rodadas de proposta antes dela. O que a referência tinha e as outras não: **ela
é leve sem ser vazia**. O mapeamento não é de cor, é de elemento — o cartão
"reunião agora" dela é o **cronômetro da etapa em andamento**, que até aqui
vivia dentro do detalhe da etapa e é justamente o número que alguém esquece
correndo a noite inteira; o agrupamento por data com selo vermelho é o **prazo
com "Atrasada"**.

**A TROCA É DE TOKEN, e é isso que a torna possível.** As 63 telas mudaram sem
uma linha de componente, porque `globals.css` é o único arquivo com cor
literal — a mesma propriedade que a identidade original comprou lá atrás.

**A escala de texto escureceu inteira**, e a razão foi ele olhando a tela: *"a
fonte cinza não dá leitura"*, duas vezes. A primeira resposta levou os tons ao
mínimo da WCAG e ele repetiu a queixa. Estava certo, e a lição cabe numa
linha: **4,5:1 é o piso legal, não o ponto em que um rótulo de 11px fica
confortável de ler** — e metade da interface é rótulo de 11px. Medido contra os
sete fundos em que cada token pode cair, não só contra o cartão branco. De
quebra, `--text-secondary` deixou de ser igual a `--brand-gray`: o cinza da
marca é uma cor da agência, este é um token de legibilidade, e os dois
coincidirem era acaso — acaso que travava o segundo.

**Escurecer o chão quebrou dois pares que ninguém tocou**, e quem cobrou foi o
`check:cores`: o link sobre a página caiu para 4,40:1 e a borda do campo para
2,92:1. É o modo de falha que a varredura existe para pegar — ninguém mexeu no
azul nem na borda, e os dois pararam de servir porque o fundo andou.

**A barra lateral passou a SEGUIR O TEMA**, e era escura nos dois. No claro ela
é branca com um fio à direita e a pílula azul no item ativo; no escuro continua
escura, porque lá tudo é. O argumento contra o trilho preto é o da proposta:
ele brigaria com a malha de cor do topo — duas coisas pesadas na mesma dobra.
Os tokens `--text-on-dark*` deixaram de servir ali (num fundo branco seriam
texto branco sobre branco), o símbolo perdeu o `sobreEscuro` porque os
`--marca-*` já trocam por tema sozinhos, e as seis linhas do `check:cores` que
mediam a barra foram reescritas — deixá-las medindo o par antigo faria a
varredura reprovar o que a tela não usa e calar sobre o que ela passou a usar.

**E o axe achou o que a lista não tinha.** O selo "Admin" e o perfil da pessoa
usavam `--brand-blue`, o azul CLARO, que se lê sobre a barra escura — e a barra
ficou branca. É a regra da casa virada do avesso, *azul claro pede texto
escuro*, reaparecendo no dia em que o fundo mudou. O selo ainda usava
`bg-brand-blue/15`, opacidade que o produto proíbe em cor de estado desde
sempre e que passava despercebida sobre o escuro. Os dois entraram na lista.

**A letra é a Google Sans, no produto inteiro**, e a porta deixou de ter letra
própria — a decisão e o que ela custou estão em "A porta", acima.

**E O CRONÔMETRO SUBIU PARA A PRIMEIRA DOBRA.** É a peça que a referência
resolveu de graça: o cartão "reunião agora" dela é o que está acontecendo neste
instante, no alto da tela, antes de qualquer lista — e aqui o que está
acontecendo é o relógio de uma etapa, que é justamente o número que alguém
esquece correndo a noite inteira. Ele vivia dentro do detalhe da etapa e nas
linhas de Minhas Tasks; quem abre a Home de manhã e não passa por nenhuma das
duas telas descobria no diálogo de conclusão, com um número grande que ela não
sabe de onde veio.

**Ele NÃO sai de `meuDia()`**, e essa é a decisão que faz o cartão servir para
alguma coisa. Aquela lista é o que vence hoje e o que já passou do prazo, e o
relógio esquecido aberto quase nunca está numa etapa que vence hoje — está na
que alguém começou às cinco da tarde de sexta, com prazo na quarta seguinte.
Derivar dali mostraria o cartão nos casos em que ele não é necessário e o
esconderia no único em que ele é. `etapaEmAndamento()` é consulta própria, com
as regras de sempre: só folha, rascunho fora, e **a que está andando há mais
tempo**, porque é a esquecida — as outras viram contagem, senão o aviso vira
uma segunda lista.

**É o MESMO `Cronometro` do resto do produto, com `destaque`**, que muda a
escala e mais nada. Dois componentes divergiriam no número que a pessoa usa
para declarar quanto tempo levou. **E não há botão de ação**, embora
`AcoesDaSubtarefa` exista: ele decide o botão pela máquina de estados, e para
isso precisa da rodada, do aval e da dependência, que esta consulta não traz —
fabricar os campos faria o cartão oferecer "Concluir" onde o banco recusa, e o
molde errado mente com mais convicção que a ausência. **Nem botão de parar:** o
relógio segue o status da etapa (0021) e não se para à mão. O que há é um link,
e ele vai para **Minhas Tasks e não para a demanda** — `/painel/gestao-tasks/{id}`
é `GESTAO`, e quem mais esquece o relógio aberto é quem executa.

**E A PILHA DE AVATARES NÃO CUSTOU CONSULTA NENHUMA**, ao contrário do que eu
tinha escrito aqui — a frase dizia que ela era "consulta nova, não estilo", e
estava errada. `carregar()` em `lib/dados/minhas-tasks.ts` traz as etapas dos
outros com `profiles(id, nome, avatar_url)` desde o Sprint 4: são elas o
contexto em cinza do painel lateral. **A ponte estava construída e ninguém a
atravessava até a linha**, que é onde a pergunta é feita — *a arte não saiu,
quem está com ela?*

Ela vem **logo depois da linhagem**, e não no aglomerado da direita: a linhagem
responde "por que estou fazendo isto?" e a pilha responde a pergunta seguinte;
na direita ela leria como "quem está nesta etapa", que é uma pessoa só e é quem
está olhando. É **uma vez por pessoa e não por etapa** — a mesma pessoa com três
etapas na demanda é um círculo, e três iguais lado a lado leriam como três
pessoas. Quem responde é `quemMaisEstaNa()` em `lib/dominio/tasks.ts`, pelo id
e nunca pelo nome, que dois homônimos compartilham. Etapa sem dono não entra:
um círculo genérico afirmaria que existe alguém.

**E a sobreposição encolheu de seis pixels para quatro**, o que parece detalhe
e não é: sem foto o círculo carrega DUAS letras, e seis pixels num círculo de
vinte e quatro comiam a segunda — "MC" saía "M(". No board ela passava porque
lá os avatares são de quem já subiu a sua; na linha de Minhas Tasks quase
ninguém tem foto. Foi a imagem que mostrou.

**E A FOTO ERA ACHATADA, não cortada**, em toda a plataforma — relato do
usuário. `AvatarImage` tinha `aspect-square size-full` e **nenhum
`object-fit`**, e o padrão do CSS é `fill`, que ESTICA a imagem até preencher a
caixa; a caixa ali é quadrada por definição, então toda foto que não é quadrada
saía deformada: a vertical some pelos lados, a horizontal achata o rosto. O
conserto é `object-cover object-center`, e **ele vale para o produto inteiro
numa linha** — barra lateral, listas, comentários, pilha, fila de aprovações,
ficha da pessoa —, porque todo avatar do produto passa por `UserAvatar` ou pelo
cartão da pessoa, e os dois usam este componente. É a propriedade que o
`globals.css` tem com a cor, vista na camada de componente.

O `center` é explícito e não herdado, pela razão do par nomeado: ele é o padrão
do CSS, e escrevê-lo impede que alguém o troque sem perceber que está
escolhendo onde o retrato é cortado.

**Nenhuma varredura pegaria isto**, e vale dizer por quê: `check:cores` mede
contraste e classe de cor, o `axe` mede árvore de acessibilidade, e uma imagem
esticada não é nenhum dos dois — ela passa em todos e só aparece para quem
conhece o rosto. Foi o usuário olhando a própria equipe.

**O exemplo do protótipo ganhou duas etapas de outras pessoas** na demanda da
Ana, pela mesma razão pela qual UMA etapa de exemplo é peça de campanha: sem
ninguém mais na demanda, a imagem não prova que a pilha existe — prova só que
ela sabe sumir. Duas e não uma, senão o "+N" nunca aparece e ninguém vê que
elas se sobrepõem.

#### A COMPOSIÇÃO chegou depois dos tokens, e a distância entre as duas custou

**O redesenho entrou no produto pela metade, e ficou assim por semanas.** Os
tokens saíram (`26e2b68`, `f40b96a`) e a malha saiu (`22ef603`); a
**composição** que o artifact aprovado desenhava — as duas colunas, os cartões
soltos, a coluna da direita, o cabeçalho grande — nunca saiu dele. Quem
olhava a tela via a linguagem nova e o desenho antigo, e a queixa que chegou
foi a certa: *"o visual da plataforma ainda não está igual ao que foi aprovado
por aqui"*.

Fica escrito porque o modo de falha se repete: **aplicar a paleta de uma
proposta é barato e parece pronto.** A composição é o que custa, e é o que a
pessoa reconhece.

**A TOPBAR NÃO CARREGA MAIS O NOME DO MÓDULO.** Ela é a busca flutuante à
esquerda, o sino e o avatar à direita, e mais nada — sem fundo próprio e sem
fio, porque sobre a malha uma faixa translúcida criava uma segunda borda
horizontal onde o desenho não tem nenhuma.

**O nome não sumiu, DESCEU.** Ele era um `<p>` (`trilha.tsx`, apagado), e o
`<h1>` já morava em `BarraDeContexto`, `sr-only`. Agora esse mesmo título
aparece na escala grande do desenho no cabeçalho da página — nas sete telas
que tiraram o `PageHeader` no Sprint 9, e pelo próprio `PageHeader` no resto.
A decisão daquele sprint continua inteira ("o nome do módulo aparece uma vez
só"); o que mudou foi ONDE essa vez acontece. E ele fica **fora** da faixa
grudada: a barra de seções continua `sticky`, e um título dentro dela grudaria
junto, gastando altura em toda rolagem.

**A ESCALA DO TÍTULO É 34px, contra os 20px de antes**, e o argumento é sobre
onde mora a hierarquia. Com os cinzas escurecidos até 11,51:1 e 7,67:1, a
diferença entre título e rótulo **deixou de ser feita por clareza** — que é o
sinal que depende de a pessoa enxergar bem — e passou a ser feita por peso e
tamanho. Com o título em 20px e o rótulo em 11px, os dois quase escuros, a
tela vira um bloco só.

`titleSecundario` é a segunda metade em tom fraco ("Bom dia, **Ana**"), e é
prop e não `ReactNode` dentro de `title` porque o `<h1>` precisa do texto
inteiro para o leitor de tela: quebrado em dois nós, o nome da página vira
"Bom dia," e a pessoa fica sem saber onde está.

**MINHAS TASKS GANHOU A COLUNA DA DIREITA, de 306px**, e o artifact diz o que
ela carrega e por quê: o cronômetro, os contadores e quem está fora — *"as
três coisas que hoje moram na Home e que ninguém vê estando em Minhas
Tasks"*. São os **mesmos componentes e as mesmas consultas** da Home, nunca
cópias: duas versões do cronômetro divergiriam no número que a pessoa usa
para declarar quanto tempo a etapa levou.

A largura é fixa de propósito — a coluna carrega dois ladrilhos lado a lado, e
em `1fr` eles encolheriam junto com a lista; o número de 26px é o conteúdo do
ladrilho, não enfeite que pode espremer. Abaixo de 1150px vira uma coluna só,
com a direita **depois**: no celular o que a pessoa veio fazer é a lista.

**A contagem da semana virou SUBTÍTULO**, e é a única diferença desta tela
para o artifact. Ele mostra dois ladrilhos e escreve "7 etapas suas nesta
semana" na linha de baixo; o produto tinha os três como contador clicável, e
perder o terceiro seria perder um filtro que existe na URL desde o Sprint 4.
Ele virou botão dentro do subtítulo: continua filtrando, e não ocupa um
ladrilho onde três não cabem sem apertar.

**CADA ETAPA É UM CARTÃO SOLTO**, com 9px entre eles, e não uma faixa dentro
de um contêiner com fios. O argumento é o da régua de cobertura do Full Days:
a lista é o trabalho de uma pessoa e cada linha é uma decisão separada. Num
contêiner único o que se lê primeiro é a CAIXA; soltas, o que se lê primeiro é
cada etapa.

**O SINO E O AVATAR VIRAM DISCOS TRANSLÚCIDOS.** `.disco-da-topbar` é classe e
não variante do `Button` porque o que a define é o VIDRO — `backdrop-filter`
mais uma borda quase invisível —, e isso é superfície e não papel. A borda é
6% do texto e não um token de borda: ela não separa dois blocos, desenha o
limite do disco sobre um fundo que muda de cor conforme a malha passa; um
`--border` chapado viraria anel cinza no ponto claro e sumiria no escuro.

#### A Lista separa por status SEMPRE, e isto desfaz uma decisão minha

Relato do usuário: *"as tasks não estão separadas em lista pelo status que se
encontram"*. Ele estava certo, e a causa era `porStatus.length > 1` em
`minha-lista.tsx`: com todas as etapas no mesmo status o cabeçalho sumia e a
Lista virava uma lista corrida.

O argumento de então era que **uma seção única com título em cima é moldura
sem função** — a mesma razão pela qual as abas de Equipe sumiram quando sobrou
uma, e pela qual o agrupamento por área já fazia isso. **Ele não vale aqui, e
a diferença é o que a moldura AFIRMA:** uma aba solta não diz nada que a tela
já não diga; um cabeçalho de status diz em que pé está tudo o que está embaixo
dele, e isso é informação mesmo sendo a única.

**Pior, o estado em que ela sumia é o mais comum do dia a dia:** a pessoa com
as quatro etapas dela em andamento abria a Lista, via uma lista corrida sem
nada dizendo que aquele *era* o recorte, e concluía com razão que a tela não
separa por status.

A Gestão de Tasks não tinha esse caso — ela mostra o cabeçalho de todo grupo e
abre com "status" selecionado. O que sobra da decisão antiga é a parte que
continua de pé: **grupo vazio não vira cabeçalho**, porque aí sim não há o que
dizer.


#### O Início ganhou a composição, e passou a dizer o que ele É

Terceira tela do redesenho, depois de Minhas Tasks — mesmo cabeçalho grande,
mesmas duas colunas, mesma coluna de 306px, mesmos cartões soltos. O que ela
resolve não é de desenho, é de **conteúdo**: com a coluna da direita agora
existindo em Minhas Tasks — cronômetro, quem está fora, os contadores —, as
duas telas corriam o risco de virar a mesma.

**A diferença mora na esquerda, e ela é uma frase:** Minhas Tasks responde *o
que eu faço agora* e lista ETAPAS; o Início responde *o que está me
esperando*, e a resposta quase nunca é uma etapa — é um aval, um comentário
sem resposta, uma nota que voltou. Por isso **"Precisa de mim" subiu para o
topo da coluna**: ele deixou de ser o quarto bloco entre nove e passou a ser o
conteúdo da tela.

**E cada linha dele virou CARTÃO SOLTO com ladrilho de ícone.** É o argumento
da lista de Minhas Tasks contra o contêiner com fios, aplicado de novo: num
bloco único o que se lê primeiro é a CAIXA, e aqui cada linha é uma decisão
separada, em um módulo diferente. **A cor do ladrilho é a do MÓDULO, nunca
urgência** — as seis linhas dividiam o mesmo selo `--warning`, o que dizia que
um aval interno de hoje cobra com a mesma pressa que a nota fiscal do mês que
vem. Par nomeado sempre, e os seis pares já são medidos pelo `check:cores`.

**NÃO HÁ LADRILHO DE NÚMERO AQUI**, ao contrário de Minhas Tasks, e a ausência
é decisão. Lá eles respondem "para hoje" e "atrasadas", duas perguntas que a
lista ao lado não responde. Aqui o número seria "5 esperando você" — e a lista
logo abaixo **É** esse cinco, item por item: seria o cartão de "11 entregues"
com sete na lista embaixo, que o Resumo da Agência já pagou uma vez. O número
mora no subtítulo, onde serve de link para `#precisa-de-mim`, **e sai da mesma
função que desenha as linhas** (`linhasDoPrecisaDeMim()`): duas somas para o
mesmo fato é exatamente o bug que ele evita.

**A saudação perdeu o emoji e os dois selos de perfil**, e `BoasVindas` saiu do
produto. O cartão da pessoa no pé da barra lateral já diz o perfil de acesso e
o cargo, na tela inteira e não só nesta; repetir na primeira dobra gastava a
linha que o subtítulo usa para dizer o que mudou desde ontem.

**E a saudação passou a morar em `lib/dominio/datas.ts`.** Ela nascera dentro
de `minhas-tasks/page.tsx` lendo `new Date().getHours()`; com duas telas
saudando, duas cópias divergiriam — e a que estava lá **já estava errada pelo
mesmo motivo do contador de atrasadas**: o container roda em UTC, e às 12h30
de lá são 9h30 em São Paulo. A versão antiga desejava boa tarde a quem tinha
acabado de chegar, na primeira linha da primeira tela.

**A coluna da direita é a MESMA de Minhas Tasks**, componente por componente e
consulta por consulta — e repetir o componente não é repetir a verdade: é uma
consulta só, e quem abre o Início de manhã sem passar pela outra tela vê o
relógio esquecido aberto do mesmo jeito. *O que se perde, e é escolha:* as
duas telas passam a se parecer na metade direita. O ganho é que nenhuma das
duas tem um canto morto.

**Dois blocos mudaram de forma para caber nos 306px**, e os dois por medida e
não por gosto: o Acesso Rápido era `sm:grid-cols-3`, o que ali dava noventa e
poucos pixels por atalho — "Notas Fisc…" acima de "Envio e paga…" —, e virou
lista vertical; e "Quem está fora hoje" era uma linha que quebrava, e virou uma
pessoa por linha com o estado à direita.

**O que NÃO mudou é o feedback.** A proposta desenhava "Ver os números" como
link, com o painel de métricas fechado — e a regra da 0075 diz o contrário em
quantas palavras: *os números crus viajam com o texto, e a tela mostra os dois
juntos, nunca atrás de um botão*. Texto sem número é opinião de máquina. A
regra escrita ganha da maquete.

**O Pulso continua aparecendo com zero**, que é a exceção declarada entre os
blocos desta tela: zero atrasada é a resposta boa, e um bloco que some nos dias
bons ensina que ele só aparece quando há problema.

#### A barra de contexto, e as sete cópias que ela desfez

**ERAM SETE `abas.tsx`, EM TRÊS DESENHOS DIFERENTES**, mais dois seletores de
visão num quarto tamanho: Gestão de Tasks, Gestão de Pessoas, Financeiro, Notas
Fiscais, Métricas, Comodatos e Full Days, cada um escrevendo o próprio `<Link>`
e o próprio `new URLSearchParams`. Três em pílula, quatro sublinhados. Quem
trocava de módulo trocava de vocabulário visual sem que nada tivesse mudado de
natureza — e o comentário do de Pessoas já dizia, quando eram dois, *"no dia em
que uma terceira tela precisar disto, vira `components/shared/`"*.

**O QUE A `BarraDeContexto` CENTRALIZA É O DESENHO E O MECANISMO, NUNCA A
LISTA.** Cada módulo continua dizendo quais são as seções dele, quais o perfil
de quem está olhando alcança, e o que contar no selo — as três são conhecimento
do módulo, e uma lista central teria que carregar o `QUEM_VE` das Métricas, o
"só o sócio" das Notas e a contagem da fila de aval. O que some é a oitava
cópia do link.

**Ela GRUDA embaixo da topbar** — `top-16`, o fundo da página com desfoque,
como o cabeçalho: rolando uma lista de quarenta demandas, saber em que seção se
está continua valendo. E é **alinhada ao conteúdo**, não sangra para fora dele:
a primeira versão usava `-mx-4 lg:-mx-8`, que é a decisão que a capa do cliente
já pagou — `main` é `mx-auto max-w-6xl`, então a faixa sai mais larga que os
cartões e ainda longe da borda da janela.

**MENOS DE DUAS SEÇÕES NÃO VIRA BARRA**, regra que os Comodatos e as Notas já
aplicavam e que agora vale para todos. E o **375px** entrou junto: o scroll é
do `nav` e o `min-w-max` é do `ul` — os dois na mesma tag não fazem nada, e foi
assim que a barra empurrou a página inteira para os lados no Full Days desde o
Sprint 6. Centralizada, essa linha deixa de poder voltar em uma das sete.

**E O NOME DO MÓDULO PASSOU A APARECER UMA VEZ SÓ.** Em sete telas o
`PageHeader` dizia exatamente o que a topbar já diz três centímetros acima —
"Gestão de Tasks" embaixo de "Gestão de Tasks". Ele saiu, e as **ações subiram
para a barra**: "Novo cliente", "Pedir as notas do mês", "Modelo do termo",
"Quem responde: Sócio". Onde o título diz outra coisa — "Bom dia, Ana" em
Minhas Tasks, o nome da empresa numa ficha — o `PageHeader` ficou.

**O `<h1>` NÃO SUMIU COM ELE, e isso é a parte que não se vê.** Quem usa leitor
de tela navega por cabeçalho, e uma tela sem `h1` é uma tela sem nome. A barra
carrega o título da página, **`sr-only`** — a decisão do `<h1>` da porta, pela
mesma razão: um título por tela, e estável.

**O SELETOR DE VISÃO NÃO É A BARRA DE CONTEXTO**, e a distinção é o que impede
duas barras iguais na mesma tela. A barra navega entre SEÇÕES: cada uma carrega
outra consulta, outro conteúdo, e trocar é trocar de página no servidor. O
seletor troca o DESENHO do mesmo conteúdo — as mesmas etapas em coluna, em
linha ou em dia. Em Gestão de Tasks os dois aparecem juntos, e com o mesmo peso
a pessoa leria "Demandas / Workflows" e "Board / Lista" como duas metades da
mesma escolha; por isso ele é menor. Ele também virou um componente só
(`components/shared/seletor-de-visao.tsx`), com a ordem das três visões num
lugar só — a decisão de `STATUS_EM_ORDEM` e de `ICONE_DA_AREA`.

**Ele continua sendo BOTÃO e não link**, ao contrário da barra: quem muda a URL
é o `useFiltros` da tela, com `router.replace(..., { scroll: false })`. Com
`<Link>` cada troca de visão viraria uma entrada no histórico e a página
saltaria para o topo — e quem está no fim de uma lista de quarenta demandas
trocaria de visão para perder o lugar.

*O que NÃO foi feito, e é dito em vez de escondido:* a barra não entrou DENTRO
dos 64px do cabeçalho. Em 375px aquela linha já carrega a gaveta, o nome do
módulo, o ponto do ao vivo, a busca, o sino e o avatar; quatro seções a mais
não cabem. Ela é a faixa logo abaixo, grudada nele — e rolando a página as duas
se leem como uma só.

**São TRÊS cores, e a terceira é o azul de AÇÃO.** Eram duas da Full Connect
Key — o cinza `--brand-gray` e o azul claro `--brand-blue` —, e o royal
`--action` entrou por decisão do usuário ao comparar a plataforma no ar com o
artifact aprovado. **O royal é a cor de ação — botão, pílula do item ativo,
link e ícone — e o ciano fica reservado ao símbolo e aos acentos de marca.**

Todo o resto continua derivado ou neutro, e **`src/app/globals.css` segue
sendo o único arquivo com cor literal** — os nomes do shadcn (`--primary`,
`--muted`, `--border`) apontam para os tokens, e é isso que faz a interface
inteira mudar sem tocar em componente. Foi essa propriedade que permitiu as
quatro camadas do redesenho.

**A terceira cor existe por contraste, não por gosto.** `--brand-blue` dá
1,18:1 sobre a malha cheia e 1,73:1 sobre o cartão: ele nunca foi cor de
texto, e é por isso que `--accent-strong` existe desde o Sprint 3C como "o
azul que dá para ler". O royal serve aos DOIS papéis com a mesma matiz —
preenchimento e texto —, que o par ciano nunca conseguiu.

**A regra que não se quebra continua valendo, e agora é sobre o royal
também:** *azul claro pede texto escuro; texto branco pede azul escuro.* São
dois tons e não um pela razão do par nomeado — `--action` é fundo com branco
por cima, `--action-text` é texto sobre fundo claro, e trocá-los põe branco
sobre azul claro.

- **botão primário = a pílula PRETA** (`--acao-fundo`, que aponta para
  `--text-primary`), com o hover indo para o royal. A regra antiga era "fundo
  `--brand-blue` + texto `--text-primary`", e ela existia porque branco sobre
  o ciano dá 1,7:1 — sai junto com o botão ciano. O par que entra é o mais
  folgado da casa: **19,43:1**. E ele **inverte sozinho no escuro**, porque
  aponta para `--text-primary` em vez de repetir dois hexadecimais: um botão
  preto sobre página escura não se lê como botão, se lê como buraco;
- **ação principal de uma coluna = a pílula com DEGRADÊ** (`.pilula-de-acao`
  mais `destaque` no `BotaoDeNovaTask`). É classe e não utilitário porque
  `bg-*` do Tailwind gera `background-color`, e o que ela pinta é
  `background-image`;
- link e ícone em fundo claro = `--accent-strong`, que agora aponta para
  `--action-text`: **4,72:1 sobre a malha cheia**, 6,91 sobre o cartão;
- item ativo na barra lateral = `--action-soft` com `--action-text`, 5,88:1;
- fundo cheio de cor + texto branco = `--blue-strong`, para o que é da marca.

**O DEGRADÊ DO BOTÃO NÃO É O DA PROPOSTA, e a diferença foi medida.** O da
proposta reprova nos TRÊS pontos com o texto branco que ela mesma põe em cima:
`#5B9BFF` dá 2,77:1, `#2F6BFF` dá 4,50:1 (no fio) e o ciano `#22C6F0` dá
**2,02:1** — o rótulo "Nova task" ficaria ilegível na ponta. É a conta que
reprovou o vidro a 58% na porta, e a saída é a mesma: escurecer até o pior
ponto passar. A ponta que escurece é a ciano, que é justamente a que ninguém
lê como cor da marca, e o azul→teal do desenho continua inteiro: 4,83 / 5,94 /
6,57.

`--action-grad-1/2/3` são tokens que **nada pinta**, a forma de
`--malha-no-pior-caso` e de `--vidro-no-pior-caso`: o `check:cores` mede par de
token, e um degradê é `background-image`. Sem eles a varredura diria que está
tudo certo sobre um botão que ninguém conferiu — que é exatamente o furo que a
proposta tinha.

**E A MALHA SUBIU PARA O ALFA APROVADO (0,75), porque o link escureceu.** Ela
estava em 0,36, e o teto era do link: no alfa da proposta o composto da mancha
mais forte é `#B9D9F8`, onde o `--accent-strong` antigo (`#0A6B99`) dava
4,01:1. Não era gosto nem discrição — era contraste, e a proposta não esbarrou
nisso porque **não tem nenhum link azul na faixa de cima**; o produto tem
("ver quais", "Ver a área", "Marcar como vistas"), e o conteúdo rola por baixo
da malha. Com o royal de texto ela dá 4,72:1 e a malha pôde ficar como foi
desenhada.

**O escuro não é o claro invertido.** A proposta não tem tema escuro e diz isso
no fecho dela; são passos próprios medidos contra os fundos do escuro, como as
cores de série do Financeiro — `#9CBEFF` no texto, `#1E2A45` na pílula.
`check:cores` passou de 34 para **37 pares**.

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

**E há uma TERCEIRA visão, o Feed** — decisão do usuário: *"quero que o
cliente tenha uma visualização do social, em blocos, desse jeito, para ele
visualizar como vai ficar futuramente no feed do instagram, e que ao clicar,
ele acesse as informações do post"*. Grade de três colunas, quadrada, do mais
novo para o mais antigo, com dois pixels entre as peças — os números do
Instagram, porque é a composição entre as artes que ele está conferindo.
Quatro colunas mostrariam um arranjo que não vai existir.

**É uma grade por REDE, e nunca escolhida em silêncio.** Um feed é de uma rede
só: misturar Instagram e LinkedIn na mesma grade mostra uma composição que não
existe em lugar nenhum. Quando o mês tem mais de uma e ninguém filtrou, a linha
acima da grade diz quais são e manda para o filtro que já existe — escolher uma
sozinho esconderia os outros posts do mês de quem veio conferir o mês.

O status entra como PONTO no canto e não como faixa: a faixa do calendário
cobre a miniatura, e aqui a miniatura é o conteúdo da tela. O canto de cima diz
o que a miniatura não mostra — carrossel ou vídeo —, pelo mesmo motivo que a
rede faz: a capa de um carrossel é idêntica à de um post único. Sem arte, o
tema entra no lugar: numa grade, um buraco parece imagem que não carregou.

**O calendário é de servidor inteiro.** Mês, visão (calendário ou lista), dia
aberto e filtros moram na URL, como em toda listagem do produto — "olha o dia
15" precisa ser um link. Em 375px a grade vira lista por dia, por CSS e não
por medir a janela: sete colunas em 375px dão 50px por dia, e 50px não cabem
miniatura, rede e tema.

**No detalhe, a ordem da tela é a ordem da decisão:** arte grande, informações,
legenda, e só então os botões. Botão antes da arte convida a aprovar sem
olhar.

**E A LEGENDA FICA AO LADO DA ARTE, não abaixo dela** — decisão do usuário:
*"quero que na visualização do cliente, a legenda apareça ao lado da imagem,
para deixar o mais próximo do instagram possível"*. É o arranjo em que a peça
vai ser encontrada quando for ao ar, e é ele que permite ler a legenda **sem
tirar a arte do campo de visão** — que é a conferência que a pessoa veio
fazer: o texto casa com o que está desenhado?

A coluna é **fixa em 340px e não `1fr`**, pela razão da coluna de 306px do
painel: em `1fr` ela encolheria junto com a arte, e o que importa nela é caber
uma linha de legenda sem quebrar a cada três palavras. Abaixo de `lg` volta a
empilhar — num celular não há "ao lado", e é assim que o próprio Instagram se
comporta.

**É uma bandeira do MODELO e não o padrão da casca** (`textoAoLado`), porque a
razão dela é do POST: um post é uma arte quadrada com uma legenda ao lado. O
entregável de campanha é um PDF de impressão ou um AI aberto, e a descrição
dele é uma instrução de produção — espremê-la numa coluna de 340px ao lado de
uma lâmina A5 deitada tira largura da peça para dar a um texto que não se lê em
paralelo com ela. **E ela é derivada da ARTE, não uma constante:** desde a 0076
o post pode chegar sem arte nenhuma, e uma coluna de 340px ao lado de nada
seria texto estreito de graça. O visualizador dá zoom de verdade (roda, pinça e botões) porque quem
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

**"Programado" é um SELO, e o que faltava não era onde marcar.** Decisão do
usuário: *"quero que o social media possa marcar em algum lugar dentro da parte
interna de social, se o post já foi programado ou não"*. O lugar existe desde a
0045 — concluir a etapa Programar é exatamente isso —, e o que faltava era ela
ser um fato visível: a corrente mora no painel do post aberto, e a lista
mostrava a mesma linha para o post aprovado que ninguém agendou e para o que já
está na fila da rede. Duas situações opostas com a mesma cara, na tela em que o
Social Media confere o mês.

Ele é **derivado**, como a mão do post: uma coluna `programado` ao lado da etapa
criaria duas verdades sobre o mesmo fato, e elas divergiriam no primeiro pedido
de ajustes do cliente — que reabre a corrente e não teria como reabrir a coluna.
A consulta traz a etapa Programar de todos os posts do mês numa ida só, como já
faz com as rodadas.

**E o par "A programar" não existe**, de propósito: um selo cinza em trinta
linhas de um mês recém-aberto é trinta selos que não informam nada. A ausência
é a resposta para o resto — a mesma decisão da matriz do Full Days, que pinta só
a exceção. No calendário ele vira ícone: a célula de um dia com três posts não
tem onze pixels para a palavra, e o nome inteiro está no `title`.

**Liberar avisa quem recebeu, e o aviso é do banco** — `posts_avisa_responsavel`
chama `notificar()`, que nunca avisa quem causou o aviso. A gestão que libera um
post para si mesma não recebe nada, e está certo.

**Trocar de post remonta o editor por `key`, nunca por efeito.** Ressincronizar
estado dentro de um `useEffect` dispara renderização em cascata — e, pior,
sobrescreveria o que a pessoa acabou de digitar no instante em que o servidor
revalidasse a página.

##### O post entra na FILA DE APROVAÇÕES INTERNAS, e antes disso não saía de lugar nenhum

Decisão do usuário, e o que ela destravou é maior do que parece: **o aval
interno do post não tinha como ser dado.**

`pedirAvalInterno()` abre a rodada de escopo interna desde a 0042 — e nada no
produto conseguia decidi-la. A consulta da fila filtrava `content_type =
'subtask'`, `aprovarInterna()` parava em `aindaNaoTratado`, e a tela de Social
Media não tinha botão de aprovar. O post ficava em "Revisão" para sempre; e
como `podeEnviarAoCliente()` exige o aval, **ele nunca chegava ao cliente**.

**O banco nunca foi o problema.** `approval_rounds_decide` aceita post desde a
**0033**, por `pode_aprovar_post()` — que é `is_gestor()`. O próprio
`pedirAvalInterno` já revalidava a rota da fila — que era `/painel/aprovacoes-internas`
naquele dia e hoje é uma aba de Gestão de Tasks —,
esperando o post aparecer lá. A ponte estava construída e ninguém a
atravessava: é a **terceira** do produto, junto com `deliverables.subtask_id`
antes da 0051 e `clients.drive_folder_id` antes da integração com o Drive. Por
isso a mudança não tem migration.

**E a bateria não pegou porque ela mesma pulava o RLS.** O arquivo do Social
deixava o post com aval por um `update` solto, rodando como dono da tabela —
conveniência de fixture ocupando o lugar do cenário. Ele deixava o estado
certo para os testes seguintes e não afirmava nada sobre quem consegue dar
aquele aval. Agora são dois cenários: a gestão decide, o colaborador não.

**Duas funções separadas, e não um `if` no meio de uma.** `etapasNaFila()` e
`postsNaFila()` leem tabelas diferentes, com nomes diferentes para a mesma
coisa — `titulo` na etapa, `tema` no post — e levam a telas diferentes.
Juntas, cada `select` ganharia um `if tipo ===` no meio, que é a duplicação de
volta com outro nome. É a mesma decisão do detalhe do material no portal: o
que se compartilha é a casca, não a leitura.

**A ordenação é feita depois de juntar**, e não dentro de cada uma. Ordenar
separado e concatenar daria uma fila em que todo post vem atrás de toda etapa
— inclusive o post parado há uma semana atrás da etapa de hoje. A fila justa é
a que não deixa nada esquecido no fim, e ela é uma só.

**O selo diz qual é qual**, porque os botões são iguais e o que acontece
depois não: a etapa que só pede aval interno **conclui** ao ser aprovada; o
post nunca conclui, ele passa para "prontas para enviar". Sem o selo, a mesma
linha significaria duas coisas.

**A arte vem assinada na linha**, para a gestão olhar antes de decidir. É a
mesma razão pela qual o Sprint 12 pôs a arte antes dos botões no portal: um
"Aprovar" numa linha sem nada para abrir convida ao mesmo erro do lado de cá.

**Pedir ajustes no post NÃO mexe em `posts.status`**, e é a parte que pede
cuidado. Marcar `ajustes` parece o espelho do `em_ajustes` da etapa, e
dispararia `posts_corrente_do_cliente` (0045): uma etapa **"Ajustes"** nasceria
na corrente e sairia uma notificação dizendo *"o cliente pediu ajustes"* — o
cliente não pediu nada, nem viu o post. A rodada recusada já devolve o post
para produção sozinha: `avalInterno` volta a ser falso e `maoDoPost()` responde
"produção" de novo.

**Quem produziu recebe o aviso, e aqui ele é explícito.** A etapa de demanda
tem `task_comentarios` e o histórico da task; o post não tem nada equivalente
do lado interno — o comentário fica na rodada, que a tela dele não mostra. Sem
o sino, um pedido de ajustes escrito na sexta espera a pessoa abrir o Social
por acaso.

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

**A oitava origem da `calendar_events`** era `etapa_de_post` — hoje é a sexta,
depois de a 0077 tirar a demanda e a etapa —, e ela é camada
própria: `post` é o dia em que a peça vai ao ar, `etapa_de_post` é o dia em que
o trabalho de alguém precisa estar pronto, e as duas datas raramente são a
mesma. O `client_id` vem do **post** — a etapa não tem cliente, e sem o join o
filtro por cliente deixaria estas linhas passar sempre, o que parece "sem
filtro" e é pauta de uma conta aparecendo na tela de quem filtrou por outra.

**`create or replace view` NÃO herda `security_invoker`**, e a cláusula foi
repetida na 0059 por isso — e na 0077 de novo, que é a terceira. Sem ela a view
voltaria a rodar com os direitos de quem a criou e leria as tabelas de origem
inteiras para qualquer pessoa autenticada — e o furo passa despercebido num
banco com um cliente só. A bateria mede.

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

**"Social Media" NÃO É MAIS UMA LINHA DO MENU**, e o caminho até aqui fica
registrado inteiro porque cada passo dele foi uma decisão. Ela passou por
Gestão, por duas entradas ao mesmo tempo no mesmo dia, virou **uma** linha na
Principal — a tela já muda sozinha por perfil, e quem recusa é a RLS e os
triggers, então a segunda entrada não acrescentava trava nenhuma, só um
segundo caminho para o mesmo lugar com o mesmo nome —, e então **saiu da
barra**. A Principal era o lugar certo pela razão que continua de pé: a
divisão do menu é sobre a **pessoa**, Gestão carrega o selo Admin e significa
"o que eu faço sobre os outros", e o redator escrevendo a legenda dele não
está fazendo nada sobre ninguém.

Quem a tirou foi o usuário: *"quero que social media e campanhas saiam da aba
lateral, elas devem ficar dentro de minhas tasks para diminuir a quantidade de
itens na aba lateral"*. O que está escrito sobre as duas remoções — por que a
entrada sai e a rota fica, e o que passou a ser a porta — está em **"As duas
entradas saem da barra"**, logo abaixo da seção de Minhas Tasks.

#### O mês de social é UMA demanda, e cada post é uma etapa dela

Migration 0061, decisão do usuário: *"atualmente quando abro o mês de social,
ele abre tasks individuais, quero que mude o fluxo para Uma task do Social do
mês em questão, e uma subtarefa, para cada um dos posts"*.

**A ponte já existia, e é a quarta.** `posts.subtask_id` nasceu na 0032, com o
comentário dizendo em quantas palavras o que ela é para — *"quando existe, é o
que faz a Gestão de Tasks e o Portal contarem a mesma história"* — e em cinco
migrations de social nenhuma linha a escreveu. Por isso a coluna nova é uma só,
`tasks.social_do_mes`.

**É o modo `mensal_agrupada` da recorrência outra vez.** A 0040 já tinha a
conta escrita: sem ele o board teria vinte e duas linhas do mesmo trabalho por
mês, por cliente. Agora ele tem doze linhas dentro de uma, e o andamento de
"Social de Outubro" cabe em algum lugar — o status da Task é calculado pelas
folhas desde a 0007, então a demanda do mês anda sozinha conforme os posts
andam.

**A SUBTAREFA DO POST É AGRUPADORA EM TUDO, MENOS NO `parent_id`.** Ela é o
post no board, e nada mais:

- **não tem responsável.** O trabalho de um post tem CINCO donos, e as cinco
  etapas da corrente já aparecem em Minhas Tasks em bloco próprio. Escrever um
  dos cinco aqui poria o mesmo trabalho duas vezes na mesma lista, numa linha
  cujo dono seria um dos cinco escolhido a esmo;
- **não tem prazo.** O dia do post já aparece duas vezes no calendário — a
  sexta origem (o post) e a oitava (a etapa da corrente, 0059). Uma terceira
  linha no mesmo dia é a conta que o produto já recusou duas vezes, e o resumo
  da semana ganharia cinquenta linhas dizendo "sem responsável";
- **o relógio não corre nela**, que é a linha da 0022 para a agrupadora;
- **o status é calculado pela corrente**, nunca escrito à mão.

O que ela NÃO herda é a contagem: ela **conta como folha** na soma da Task,
porque ela é o post — e o progresso do mês é quantos posts andaram. A pergunta
mora num lugar só, `subtarefa_de_post()`, como `subtask_eh_agrupadora()`.

**O mirror não tem de-para, e é por isso que ele pode existir.**
`post_etapas.status` é `subtask_status` desde a 0045, exatamente porque
responde à mesma pergunta — então o mirror copia valor para valor. **Menos em
dois casos:** a mãe nunca fica em `enviada_aprovacao` nem em `em_ajustes`,
porque os dois afirmam uma rodada dela própria e a fila de aprovações iria
procurá-la. Com a corrente em aprovação, ela fica em `em_andamento`, que é
verdade.

E o mirror **não precisa de saída de emergência**, ao contrário da 0045 e da
0059: ele escreve pelo caminho normal e as três travas de
`validar_transicao_de_subtarefa` deixam passar — a subtarefa não exige
aprovação, não tem dependência, e os dois status que pedem rodada são
justamente os dois que ele não escreve. É a forma da 0052: perguntar antes, em
vez de embrulhar num `exception when others` que engole também o erro que
ninguém previu.

**A pasta de entrega é obrigatória, e não há exceção a abrir.**
`tasks_exige_pasta_de_entrega` (0015) recusa demanda nova sem ela, e uma trava
com exceção para o módulo que abre sessenta demandas por mês é uma trava
desligada. `abrir_mes_de_social()` recebe `p_link_entrega`, o diálogo pede a
pasta, e o botão "Criar no Drive" do Sprint 16 cria a do mês. Ela é pedida **só
quando a demanda nasce**: abrir o mesmo mês em duas vezes acrescenta etapas à
que já existe.

**O nome da pasta NÃO é o título da demanda.** No board convivem os meses de
dez clientes, então a demanda diz de quem é — `Social · Outubro/2027 de Mundo
Verde`. A pasta nasce dentro da pasta do cliente, onde o nome da empresa já é o
nível de cima: `nomeDaPastaDoMes()` devolve `Social · Outubro de 2027`, sem a
barra que `nomeDePasta()` trocaria por hífen.

**A idempotência é o ÍNDICE ÚNICO**, `(client_id, social_do_mes)`, e não o
`select` que a função faz antes — duas abas clicando ao mesmo tempo passam
pelas duas consultas antes de qualquer uma gravar. É a decisão da 0040.

**Apagar o post apaga a linha dele**, por trigger: deste lado não existe chave
estrangeira, e sem ele a demanda continuaria contando um post que não existe
mais — "11 de 12" nunca fecharia. E **o título da etapa acompanha o tema**,
senão o board mostraria o nome de fábrica para sempre.

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

#### O carrossel é a COMPOSIÇÃO INTEIRA, nos dois lados

**São duas decisões do usuário, e a segunda desfez metade da primeira.** A
primeira: *"atualmente ele não permite ir de uma imagem para outra, quero que
as imagens apareçam em sequência, como um carrossel mesmo"* — e eu a resolvi
com uma imagem grande de cada vez, setas, contador e a tira embaixo como régua.
A segunda: *"deixe no layout de carrossel, um slide ao lado do outro, para o
cliente ver a composição total dele. Se for mais de 3 slides, tudo bem ser
exibido arrastando para o lado, mas sempre mostrar todas as artes ao mesmo
tempo."*

**Uma por vez era o erro, e ele tem nome: carrossel não é uma pilha de imagens,
é uma composição.** Um bom carrossel de feed é desenhado como uma peça só que o
dedo atravessa — a arte vaza de um slide para o outro, e a frase começa no três
e termina no quatro. Mostrando um de cada vez, quem aprova decide sobre um
quinto do material cinco vezes, e o emendado — que é o que mais sai errado —
não aparece em nenhuma das cinco. O registro da ida e da volta fica porque a
primeira ideia é a que volta sozinha: "ele não anda" pede setas, e setas são
exatamente o que a segunda decisão tirou.

**Não há setas, contador de posição nem navegação por teclado**, e a ausência é
consequência e não esquecimento: não há por onde andar. Está tudo na tela, e o
que passa de três rola para o lado.

**Os slides ficam ENCOSTADOS, sem vão.** Um `gap` quebraria exatamente o que a
faixa existe para mostrar — onde a arte de um continua na do outro. A fronteira
se lê pelo número em cada slide, não por um espaço. E **três cabem na largura**:
com quatro ou cinco espremidos, cada um fica pequeno demais para julgar o
rodapé, que é o pedido de ajuste mais comum. Em 375px cabe um e meio, e o meio é
o que diz que há mais.

**É o MESMO componente nos dois lados** — `components/shared/faixa-da-composicao.tsx`,
no editor por `carrossel-do-editor.tsx` e no portal pelo visualizador. Duas
telas com dois desenhos divergiriam, e a divergência apareceria no lugar mais
caro: o que a agência olha antes de mandar contra o que o cliente vê depois.

**O que muda entre os dois é a AÇÃO, e é por isso que só o editor tem
escolhido.** Clicar num slide lá não navega — marca com um anel sobre qual deles
o botão de remover age. No portal não há ação nenhuma, então não há escolha nem
anel: um destaque que não decide nada é um convite a clicar sem resposta.

**No portal o visualizador já sabia mostrar mais de uma** desde o Sprint 12;
quem mandava só a capa era quem o chamava. `ModeloDoConteudo.arte` virou
`artes`, e o post passa os slides da versão corrente. A capa entra uma vez só:
ela É o primeiro slide, e mandá-la à frente da lista mostraria a mesma imagem
duas vezes — o cliente contaria seis onde há cinco.

**E a tela do protótipo perdeu o clique junto com as setas.** Ela clicava em
`button[aria-label="Próximo slide"]`, que não existe mais; hoje ela sai em
repouso, que é exatamente o que se confere numa faixa que mostra tudo de uma
vez. Foi o aviso da rodada completa que encontrou — e ele esperou, porque
aquela rodada leva quinze minutos e não está no CI.

#### O cliente aprova a corrente ETAPA POR ETAPA, e é padrão da conta

Migration 0076, decisão do usuário: *"preciso poder escolher, se as etapas vão
ser aprovadas pelo cliente, uma por uma. Algumas contas aprovam pauta, antes de
entrar em produção"*.

**A escolha é da CONTA, e "algumas contas aprovam pauta" é a frase inteira.**
Não é decisão que se toma por post, nem ao abrir cada mês: é combinado de
contrato, e o lugar dele é a aba **Configurações do fluxo** da ficha do cliente,
que existe desde a 0064 justamente para isto. Uma pergunta na abertura de cada
mês obrigaria a repetir a mesma resposta doze vezes por ano, por cliente — e a
décima terceira sairia diferente.

**E ela mora na mesma linha do prazo de resposta**, `client_flow_defaults`, com
o mesmo botão Salvar: um segundo botão para a mesma linha seriam duas escritas
concorrentes na mesma tela.

`social_aprovacoes` é `text[]` e não `jsonb` — a pergunta é de pertinência
("a Pauta está nesta lista?"), não um número por chave, que é o critério de
`post_versions.arquivos`. **E o `check` com os nomes não existe no banco de
propósito:** ele seria a sexta cópia da corrente. Quem recusa "Revisão do sócio"
digitado à mão é o `z.enum` da action, montado a partir de
`ETAPAS_QUE_O_CLIENTE_PODE_APROVAR` — que é `etapas_que_o_cliente_pode_aprovar()`
do outro lado, como `situacaoDoLancamento()` no Financeiro.

**O Envio e o Programar ficam de fora da lista, e por razões diferentes.** O
Envio **já é** o portão de toda conta desde a 0032 — oferecê-lo seria oferecer
ligar o que está ligado. O Programar vem DEPOIS da decisão: pôr o cliente para
aprovar a programação seria pedir a ele o aval de um trabalho que só existe
porque ele já aprovou.

##### Não há `content_type` novo, e é a decisão que fez o resto caber

`approval_rounds` não ganhou coluna nenhuma. **Qual etapa uma rodada de cliente
decide é DERIVADO da ordem**, porque a corrente é serial: uma etapa só começa
quando a anterior fecha (0045), então não há dois portões abertos ao mesmo
tempo. `porta_do_cliente_no_post()` devolve o primeiro portão ainda não
concluído, e `portaoDoCliente()` faz a mesma pergunta na tela.

Guardar a etapa na rodada seria uma segunda resposta para uma pergunta que a
ordem já responde, e as duas divergiriam no dia em que alguém apagasse uma
etapa. É "bloqueio não é status" e "atraso do Financeiro não é coluna" de novo —
e o que ela poupou foi um tipo novo no enum, uma rota nova no portal e um jogo
de policies.

##### A linha que o sprint quase quebrou de forma cara

`decidir_rodada_do_cliente` escreve `posts.status = 'aprovado'` a cada decisão
positiva, desde a 0032. Com um portão no meio da corrente isso passaria a
afirmar que a **peça inteira** está fechada — verde no calendário do cliente,
fechada na grade do feed, "pode programar" para a agência — quando o que ele
aprovou foi um parágrafo de texto e a arte nem existe.

Por isso `posts_corrente_do_cliente` **devolve o post para `em_producao`** quando
o portão decidido não é o Envio. A rodada fica gravada como aprovada, que é a
verdade, e a corrente anda. **É o cenário que justifica o arquivo de bateria
inteiro**, e o único que cai quando se tira essa linha.

O recálculo precisa de uma saída de reentrância — o GUC de escopo local da 0045
—, senão o `update` do próprio trigger o dispararia de novo.

##### Num portão do meio não há arte, e as travas mudam de forma

- **A trava de data não vale.** "Post sem data não vai ao cliente" (0044) é
  sobre a ARTE: ele decidiria sobre a peça sem saber quando ela vai ao ar. A
  Pauta é a **primeira** etapa da corrente, e o mês abre em branco (0044) — exigir
  a data ali seria uma recusa que a corrente não tem como satisfazer, e o portão
  ficaria fechado para sempre. O mesmo vale para o link do vídeo.
- **O botão diz O QUE está saindo.** `rotuloDoEnvio()` — "Enviar a Pauta ao
  cliente". Numa conta que aprova a pauta a gestão clica nesse botão duas vezes
  na vida de um post, e as duas mandam coisas diferentes: um rótulo igual nas
  duas é a tela pedindo uma decisão sem dizer sobre o quê.
- **A etapa-portão continua se marcando à mão**, ao contrário do Envio. Recusar
  `em_andamento` deixaria quem escreve a pauta sem como dizer que começou. O que
  o banco recusa é o FIM dela pela mão de alguém — `concluida` e
  `enviada_aprovacao`, os dois que afirmam uma decisão que não aconteceu.
- **O ajuste nasce DEPOIS do portão recusado**, e não no vão fixo entre Envio e
  Programar, e quem refaz é o dono do próprio portão: quem escreveu a pauta
  reescreve a pauta. Ler "Layout" ali poria o designer para reescrever texto.

##### A PAUTA PASSA A SER LEGÍVEL PELO CLIENTE, e a inversão é declarada

A 0046 escreveu que a pauta é conversa interna, e era verdade **enquanto
ninguém de fora a decidia**. Quem liga o interruptor está dizendo que naquela
conta ela não é — e o recorte é exatamente esse: só a etapa marcada, só enquanto
ela é o portão aberto, só na conta que a ligou. A aba diz isso em voz alta antes
de alguém salvar.

**E o cliente CONTINUA sem policy em `post_etapas`**, que é a linha da 0045 e
fica de pé: a corrente é conversa interna — quem está com o material na mão,
qual etapa travou, quem atrasou. O que ele precisa é outra coisa, e quem
devolve é `o_que_o_cliente_decide()`, `security definer` entregando só o
agregado: a forma de `usuarios_do_meu_cliente()` (0031), de
`meus_pedidos_de_nota()` (0066) e de `meus_comodatos()` (0069).

**A guarda dela é escrita à mão, e é a parte que a bateria mede**: `security
definer` não passa pela RLS de `posts`, então as quatro linhas que repetem
`posts_select_cliente` são o que impede a função de responder sobre o post de
qualquer empresa para quem tiver o uuid. Tirando-as, três cenários caem e dizem
o que vazaria — e o furo passaria despercebido num banco com um cliente só, que
é a lição da `calendar_events`.

##### A tela do portal, sem arte

**A moldura de arte SOME quando há o aviso e não há arte.** Ela diz *"este
material ainda não tem arte anexada"*, que é verdade e lê como defeito — e
ocupa a primeira dobra inteira para informar que não há nada ali. Sem o aviso a
moldura fica: aí a ausência de arte É uma falta, e escondê-la esconderia a
falta.

O que entra no lugar é o texto daquele portão — a pauta, a legenda — com o
cabeçalho levando o nome dele: "Legenda" em cima de uma pauta seria a tela
dizendo a coisa errada sobre o que a pessoa está lendo.

**E a frase do aviso não carrega vocabulário interno.** Ela nomeia a coisa —
"na Pauta deste material" —, nunca o passo do fluxo: o cliente recebe material,
e essa é a regra deste lado do produto. **`check:cores` não pegaria isto**,
porque a frase nasce em `lib/dominio/` e a varredura procura o jargão em
`src/app/(cliente)/` e `src/components/portal/` — é o caso da ausência que chega
com a chave do enum no Calendário Full. Quem mexer nela mexe sem rede, e a
decisão está escrita ao lado da função.

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

#### "Chegou para você": o sinal de novidade em Minhas Tasks

Decisão do usuário: *"quero que passe Social Media e Campanhas para dentro de
Minhas Tasks, com um sinal de notificação, sempre que o colaborador for
responsável por algo novo nessas áreas"*.

**AS DUAS ÁREAS JÁ ESTAVAM LÁ — E ESSE ERA O PROBLEMA.** As etapas da corrente
do Social têm bloco próprio nesta tela desde o Sprint 14. E a peça de campanha
é uma SUBTAREFA desde a 0051 — abrir a campanha cria a demanda com uma etapa
por entregável, no nome de quem vai produzi-la —, então ela já aparecia na
lista de etapas, com prazo, cronômetro e o botão certo.

**Eu li isso como "já está pronto", e o usuário respondeu que não:** *"Social
Media e Campanhas ainda não está dentro de Minhas Tasks"*. Ele estava certo, e
a distinção é a lição: **estar na tela e ser visível na tela são duas coisas
diferentes.** A peça de campanha era uma linha igual às outras com um selo
pequeno escrito "Campanha"; o Social era um bloco chamado "Social", sem
contagem, que some quando não há nenhuma. Quem abre procurando a área pelo
nome não achava nem uma nem outra — e quem não tinha trabalho ali naquele dia
concluía que a área não existe aqui.

#### As três áreas passaram a ter nome, contagem e seção

**É AGRUPAMENTO, e não bloco novo.** Um bloco "Campanhas" ao lado da lista
geral poria o mesmo trabalho duas vezes na mesma tela — a conta que a 0061
recusou para a subtarefa do post. A linha SAI da lista geral e entra na seção
dela: cada trabalho continua aparecendo uma vez só. `areaDaLinha()` em
`minhas-tasks/linhas.ts` responde de que área é cada etapa, e a pergunta é
`subtarefa.campanha` — não o caminho longo pela demanda, senão a etapa de uma
campanha aberta sem entregável responderia "campanha".

**A Lista chegou a AGRUPAR POR ÁREA, e hoje agrupa por status** — a decisão
está em "A Lista agrupa por status", logo abaixo. O que sobrou da área na
Lista é o selo da campanha em cada linha, que diz mais que um cabeçalho: ele
nomeia QUAL campanha. `areaDaLinha()` continua respondendo pela faixa de chips
e pelo Social, que é bloco à parte.

**A faixa de áreas mostra o ZERO, ao contrário do selo da fila de aprovações.**
As duas regras não brigam: lá o selo COBRA uma ação, e um zero cobraria nada;
aqui a linha RESPONDE onde o meu trabalho está, e "nenhum" é resposta — é
justamente o caso em que a pessoa procurava a área e não a encontrava. Cada
chip é um link para a área inteira e **não um filtro**: ele leva ao MÓDULO —
onde a pessoa vê o mês de social inteiro, a campanha com a árvore —, e isso é
outra coisa que estreitar esta lista. Um filtro seria um parâmetro de URL a
mais para manter em dia, oferecendo um recorte que a faixa já não promete.

#### A Lista agrupa por STATUS

Decisão do usuário: *"quero que em minhas tasks, a visualização em lista seja
apresentada por status"*. Ela agrupava por área; passou a agrupar pelos status,
e o agrupamento por área saiu junto — dois níveis de cabeçalho sobre oito
linhas é moldura, não organização.

**O STATUS É O DA ETAPA, e não o da demanda**, e a razão é mecânica antes de
ser conceitual: **cada linha já carrega o selo de status dela**. Agrupando pelo
status da demanda, um cabeçalho "Em andamento" apareceria em cima de uma linha
marcada "Concluída" — dois fatos sobre a mesma linha se contradizendo a um
centímetro de distância, que é o erro do cartão de "11 entregues" com sete na
lista logo abaixo. E é conceitual também: a Lista lista ETAPAS desde o Sprint
10, porque "Conteúdo" e "Layout" da mesma demanda são dois trabalhos meus;
pelo status da mãe os dois caem no mesmo grupo mesmo com um concluído e o
outro sem começar, que é exatamente o que tirou o board de demandas desta
tela.

**E o selo de status SOME dentro do grupo**, porque o cabeçalho já o disse — é
a decisão do selo da campanha, e é o que o board já fazia: o card não carrega
selo, a coluna carrega. **Ele volta quando não há cabeçalho**, que é o caso de
quem tem tudo no mesmo status: sem o selo e sem o título, o status sumiria da
tela inteira.

**A ordem é a mesma do board**, e a lista dos seis mora em `STATUS_EM_ORDEM`,
em `minhas-tasks/linhas.ts`. Ela nasceu dentro do board e saiu de lá: as duas
visões são o mesmo seletor, e duas cópias da mesma ordem divergiriam na
primeira vez que alguém mexesse numa — trocar de visão e ver a mesma etapa em
outro ponto da sequência é a tela desmentindo a si mesma. É a lição de
`ICONE_DA_AREA`, que tinha três cópias e duas já divergidas. **A checagem de
que a ordem cobre o enum inteiro foi junto**, pela mesma razão: deixada no
board, ela pararia de rodar para quem abrisse só a Lista.

**Dentro do grupo a ordem continua global** — o que vence amanhã no topo —,
porque `montarLinhas()` já entrega ordenado e separar não reordena. **E grupo
vazio some**, como na lista da Gestão de Tasks: quem não tem etapa em ajustes
não precisa ler todo dia que não tem.

#### E o grupo DOBRA, nas duas listas

Decisão do usuário: *"pode colocar os itens, na visualização de lista,
separados por status? Tipo, um botão de Iniciar, que ao clicar, aparecem todas
as minhas tasks para iniciar"*. `components/shared/grupo-dobravel.tsx`, na
Lista de Minhas Tasks e na de Gestão de Tasks — **as duas, porque duas telas
que agrupam igual e se comportam diferente é a divergência esperando
acontecer.**

**TODOS NASCEM ABERTOS, e o botão dobra.** O contrário — abrir a tela com seis
botões e nenhuma linha — troca a lista por um índice e cobra um clique antes
de mostrar qualquer trabalho. *A consequência é que o primeiro clique esconde
em vez de mostrar*, e isso é dito em vez de escondido: quem quiser o grupo
encerrado fechado por padrão é uma linha, e é decisão de quem usa.

**A CONTAGEM FICA NO CABEÇALHO SEMPRE**, e é ela que faz dobrar ser seguro: o
grupo fechado continua dizendo quantos tem dentro. É a diferença entre
recolher e esconder — a mesma razão pela qual a faixa de áreas mostra o zero.

**O QUE ESTÁ FECHADO MORA NA URL**, como todo filtro de listagem, e não em
estado nem no `localStorage`. Em estado, dobrar um grupo e trocar de visão
desmonta a lista e devolve tudo aberto — que é exatamente o que a convenção
quer dizer com *"o link precisa sobreviver à troca de visualização"*. No
`localStorage`, a tela abriria com o que a URL diz e trocaria sozinha um
instante depois para o que o navegador lembrava, que é a decisão das camadas
do Calendário Full. *O custo:* cada dobra é uma navegação, a mesma que os
contadores desta tela já fazem.

**A chave é o VALOR do status, nunca o rótulo** — "Iniciar" pode virar outra
palavra amanhã, `nao_iniciada` não, e é a chave que fica no link. E ela é
escapada antes de entrar na lista separada por vírgula, porque na Gestão de
Tasks dá para agrupar por cliente: "Mundo Verde, Matriz" partiria a lista em
dois grupos que não existem.

**É `<button aria-expanded>` e não `<details>`:** com o `open` vindo da URL, o
toggle nativo e o React brigam — o navegador abre, o React fecha, e o grupo
pisca. E o conteúdo **sai da árvore** quando fechado, em vez de sumir por CSS:
`hidden` deixaria os botões de ação de cada etapa alcançáveis pelo Tab dentro
de um grupo que a pessoa fechou.

**Sem cabeçalho não há o que dobrar**, que é o caso de quem tem tudo no mesmo
status: a lista é a tela, e um botão que esconde tudo o que existe não é
organização, é um interruptor de luz.

**O Social fica FORA do seletor de visão, e é mecânico.** O board desenha
colunas dos status da etapa de demanda e o calendário desenha prazos de
demanda; nenhum dos dois sabe desenhar uma etapa de post. Posto dentro da
Lista, ele sumiria em duas das três visões, e quem trabalha no board perderia
a área inteira sem nada dizendo por quê. Ele vem DEPOIS do conteúdo da visão,
na mesma ordem dos chips — Demandas, Campanhas, Social Media —, então na Lista
ele fecha a tela depois dos grupos de status e no board ele fica embaixo das
colunas, que é onde uma lista cabe.

**E o selo da peça diz QUAL campanha**, não a palavra "Campanha". Enquanto
havia uma seção Campanhas, a palavra repetia o cabeçalho cinco vezes sem
informar nada; hoje não há a seção, e o nome continua sendo a resposta melhor
— de qual peça é esta etapa, que é a pergunta de quem tem três campanhas
correndo. Ele é também o link para onde o arquivo sobe.

**O que faltava eram duas coisas, e nenhuma é uma lista nova.**

**1. O caminho de volta para a campanha.** A etapa dizia "Lâmina A5" e clicar
abria a DEMANDA — e o PDF sobe em `/painel/aprovacoes/campanhas/{id}`. Quem
produz caía numa tela sem lugar para o arquivo. Agora a linha carrega um selo
com o NOME da campanha, que é um link para lá — a palavra "Campanha" era o
que ele dizia na primeira versão, e dentro da seção Campanhas ela repetia o
cabeçalho sem informar nada. A pergunta é por `deliverables.subtask_id`,
a ponte que a 0033 criou e a 0051 passou a escrever: pelo caminho longo
(`task → campaign`) a etapa de uma campanha sem entregável responderia "sim", e
ela não é peça de nada.

**2. O SINAL, e ele é o SINO visto de outro ângulo.** "Algo novo é meu nessas
áreas" já é fato gravado — `posts_avisa_responsavel` toca o sino quando a
gestão libera um post, a corrente avisa quem ganhou uma etapa, a decisão do
cliente avisa quem produziu a peça. O que faltava era isso aparecer na tela em
que a pessoa trabalha, e não só num sino que se abre por hábito e some no
primeiro clique.

**Marcar como vistas É marcar como lidas**, a mesma escrita. Um `visto_em`
próprio daria dois números sobre o mesmo fato, e ninguém saberia qual
acreditar; assim a faixa e o contador do sino apagam juntos.

**A área sai do `link`, e não do `tipo`.** `notification_tipo` tem oito valores
e nenhum diz "social" nem "campanha" — `task` e `aprovacao` cobrem os dois e
mais quatro módulos. E há uma pegadinha que vale escrita:
**`/painel/aprovacoes-internas` COMEÇA com `/painel/aprovacoes`**, então um
`startsWith` ingênuo contaria como Campanhas todo aviso da fila de aval
interno. O número ficaria plausível e errado, que é o pior jeito de um número
estar errado.

**E `notifications.origem_id` não serve, porque ninguém a escreve.** A coluna
existe desde a 0011 e `notificar()` não tem parâmetro para ela — **é a sétima
ponte construída e nunca atravessada**, junto com `clients.drive_folder_id`,
`posts.subtask_id`, `deliverables.subtask_id`, `deliverable_versions`,
`clients.logo_url` e `workflow_steps.funcao_padrao`. Com ela preenchida, o
sinal seria por ITEM ("este post é novo") em vez de por área; é o próximo
passo barato, e custa um parâmetro em `notificar()` mais os pontos de chamada
que quiserem usá-lo.

**A faixa devolve lista vazia quando a consulta falha**, ao contrário do
`ouFalha()` das consultas que SÃO a tela: Minhas Tasks funciona inteira sem
ela, e derrubar a lista de hoje por causa de um aviso seria trocar uma falha
parcial por uma total.

**E o nome da campanha vem numa segunda consulta, não num embutido.** O
PostgREST recusa o `select` INTEIRO quando não acha a relação pelo nome escrito
— e foi assim que uma campanha recém-criada não aparecia em lugar nenhum. Duas
idas ao banco custam menos que essa classe de bug.

#### As duas entradas saem da barra lateral

Decisão do usuário: *"quero que social media e campanhas saiam da aba lateral,
elas devem ficar dentro de minhas tasks para diminuir a quantidade de itens na
aba lateral"*. A barra tinha dezoito linhas para o sócio; ficou com dezesseis.

**E SÓ FOI POSSÍVEL PORQUE A FAIXA DAS TRÊS ÁREAS EXISTE.** Tirar um item de
menu de um módulo que não aparece em mais lugar nenhum não é enxugar a barra,
é esconder o módulo — e esconder o módulo de quem produz é esconder o trabalho
dele, que é o argumento que trouxe as duas telas para `EQUIPE` na 0054 e no
Sprint 14. A ordem das duas mudanças é a explicação: primeiro as áreas ganharam
nome, contagem e seção própria em Minhas Tasks, depois a entrada saiu.

**A ENTRADA SAI, A ROTA FICA**, e quem faz isso é `hiddenFromMenu` em
`lib/auth/permissions.ts` — a bandeira que "Meu Perfil" já usava —, nunca a
linha apagada. `getMenuForRole()` a filtra da barra; `canAccess()` e
`findMenuItem()` continuam respondendo pelo `MENU`. Sem a entrada,
`/painel/social-media` viraria rota desconhecida: `exigirAcessoARota`
devolveria 403 para quem chegasse pela faixa, e a trilha e o `<title>` da aba
sairiam em branco. **O item sai do menu, não do alcance de quem o abria** —
nenhuma policy mudou, nenhum perfil perdeu nada.

**O que garante que a remoção não virou desaparecimento é uma checagem de
MÃO DUPLA**, e ela é a primeira do produto a ler **só a barra lateral**:
`check:sprint9` recorta o `<nav aria-label="Módulos do painel">` do dump e
confere que os dois nomes NÃO estão lá, em três perfis — e, do outro lado, que
a tela de Minhas Tasks nomeia as três áreas. Sem a segunda metade, a checagem
passaria no dia em que a faixa quebrasse: os dois módulos não estariam na barra
nem em lugar nenhum, e o produto os teria perdido em silêncio.

**E o recorte não é zelo, é o que faz a checagem medir.** As outras seções do
`check:sprint9` leem a página inteira, porque a pergunta delas é o que a pessoa
lê. Aqui a pergunta é o que a barra **lista**, e a página inteira não sabe
responder: "Campanhas ativas" é um cartão do Pulso na tela inicial do sócio,
então uma busca no texto todo diria que a entrada continua no menu quando ela
não está. Medido com três mutações: trocar o recorte pela página inteira
derruba três cenários, devolver a entrada ao `MENU` derruba os mesmos três, e
fazer a faixa parar de nomear uma área derruba o quarto.

**E o ÍCONE DE CADA ÁREA passou a morar num lugar só**, que é consequência
direta disto. Eram três cópias do mapa na mesma pasta — a faixa dos chips, o
cabeçalho de cada seção da Lista e a faixa de novidades —, e **duas já tinham
divergido**: o Social aparecia com o ícone de lista numa e com o de imagens nas
outras, na mesma tela, a poucos pixels de distância. Enquanto as duas eram
itens da barra o ícone era só o eco do ícone de lá; agora este é o **único**
lugar do produto em que aquele desenho aparece ao lado daquele nome, e dois
desenhos para a mesma área deixaram de ser inconsistência de estilo e passaram
a ser duas áreas. É a decisão de `FUNCOES` na 0064: a quarta cópia seria a que
esquecesse uma área nova.

*O que se perde, e é consequência aceita:* quem procurava o módulo na barra
por hábito passa por Minhas Tasks. O ganho é que ele o encontra ao lado da
contagem do que é dele lá dentro — que é a pergunta que levava a pessoa a
clicar no item.

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
mês". **E a aba "Ativas" inclui `planejamento`** — ela abria só com
`status = 'ativa'`, e como o default da coluna é `planejamento` (0033) uma
campanha nascida por qualquer caminho que não passe pelo formulário existia, o
cliente podia abri-la pela listagem, e o bloco da tela inicial a escondia. Foi
o que o usuário encontrou. "Em planejamento" continua existindo como recorte
mais estreito, e não como o outro lado de "ativas": duas abas que se sobrepõem
são melhores que uma aba padrão que esconde. Esconder até o primeiro envio faria a lista de campanhas ativas contar
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

#### A arte da campanha passa pela ANÁLISE INTERNA antes do cliente

Decisão do usuário: *"quando o colaborador sobe uma arte, dentro de uma
campanha, apareça um botão de enviar para análise ao invés de enviar para o
cliente, que quando clicado, notifica os desenvolvedores e sócios, que devem
avaliar a arte e enviar para o cliente, ou solicitar alteração"*.

**NÃO HÁ MIGRATION, E É O PONTO.** `validar_nova_rodada` recusa a rodada de
escopo `cliente` num entregável enquanto não houver a INTERNA do mesmo número
aprovada — está no banco desde a **0033**, na mesma forma do post;
`approval_rounds_decide` já aceita `deliverable` por
`pode_aprovar_entregavel()`; e `approval_rounds_avisa_aprovador` (0064) já toca
o sino quando uma rodada interna nasce pendente. **É a décima primeira ponte
construída e nunca atravessada**, junto com `deliverables.subtask_id` antes da
0051 e o aval interno do post antes de ele entrar na fila.

**E o botão que existia estava quebrado, de um jeito que ninguém tinha
visto.** `enviarEntregavelAoCliente` numerava a rodada como `max + 1` — e o
trigger compara o número da de cliente com o da interna. Um número sempre maior
não casa com nenhuma, então **o envio ao cliente de uma peça de campanha nunca
passou**: quem clicava levava *"esta rodada ainda não passou pela aprovação
interna"*, sobre uma aprovação que não tinha por onde acontecer.

**O NÚMERO DA RODADA É A VERSÃO DA PEÇA.** Casando os dois, as duas rodadas da
mesma versão se encontram — e subir uma versão nova depois do aval deixa a nova
SEM aval, que é o que tem de acontecer: o que a gestão aprovou não é mais o que
iria ao cliente. É a conta do `avalInterno` do Social Media, com a mesma linha
(`numero_rodada >= versao_atual`) em `analiseDosEntregaveis()` e na fila. **A
bateria guarda o cenário que impede a arte não olhada de sair**: subir a v2
depois do aval da v1 e o banco recusar o envio.

**A peça entra na fila de aprovações internas**, como o post entrou — e por
`entregaveisNaFila()`, uma TERCEIRA função e não um `if` no meio das outras
duas: as três leem tabelas diferentes, com nomes diferentes para a mesma coisa
(`titulo`, `tema`, `nome`) e levam a telas diferentes. A ordenação continua
sendo feita depois de juntar, senão toda peça viria atrás de todo post. **A
arte vem assinada na linha**, do bucket `campanhas-arquivos` — a gestão precisa
OLHAR antes de decidir, e um "Aprovar" numa linha sem nada para abrir convida ao
erro que o Portal evita pondo a arte antes dos botões.

**Pedir ajustes NÃO mexe em `deliverables.status`**, e é a lição do post letra
por letra: marcar `ajustes` ali faria a peça aparecer ao CLIENTE num estado que
ele não causou, de um material que ainda não existe para ele. A rodada recusada
já devolve a peça para a produção sozinha — o aval volta a ser falso e o botão
de enviar desliga. **Quem produziu recebe o aviso**, porque a peça não tem
conversa interna: o comentário fica na rodada, que a tela de produção não
mostra.

**O "Enviar ao cliente" SOME para quem produz, e fica desligado para a
gestão.** São as duas metades da mesma regra: para quem nunca vai poder usá-lo,
um botão permanentemente desligado é ruído, e a razão escrita seria dita a quem
não decide isso; para quem decide, o botão desligado com a frase é o que ensina
o passo que falta — a decisão do "Enviar ao cliente" do Social Media. E a frase
é **uma só**: com a análise pendente, a pílula azul já responde, e a âmbar ao
lado dela repetiria a mesma coisa a um centímetro de distância.

##### E O PEDIDO DE AJUSTE DEVOLVE A PEÇA — o que a 0079 consertou

Relato do usuário, sobre o que acabou de ser descrito: *"quando o atendimento
devolve uma peça da campanha para ajuste, ela não está voltando. Preciso que
corrija isso, para a peça voltar para a pessoa, com a solicitação de ajuste
feita. E que as notificações comecem a funcionar"*. Ele estava certo nos dois
pontos, e as duas causas são minhas.

**A PRIMEIRA: EU COPIEI A REGRA DO POST SEM CONFERIR SE O MOTIVO DELA VALIA.**
Está escrito, duas seções acima, por que o post não mexe em `posts.status` ao
pedir ajuste: `posts_corrente_do_cliente` (0045) dispara nesse status e diz que
o cliente pediu, o que é mentira. Eu escrevi a mesma linha para a peça de
campanha, e **não existe trigger nenhum em `deliverables.status` falando do
cliente** — o motivo não existia aqui. O que sobrou foi uma decisão sem
consequência: a rodada virava `ajustes_solicitados`, a peça ficava onde estava,
a etapa ficava onde estava, e a tela não dizia nada. Pior, o botão "Enviar para
análise" aparecia ligado e o banco recusava o clique, porque a mesma versão não
abre duas internas. **A peça não voltava e não dava para mandar de novo.**

**A volta é `em_producao` e nunca `ajustes`**, e aqui o vocabulário importa:
`ajustes` é a palavra do CLIENTE neste enum — é o que
`decidir_rodada_do_cliente` escreve. Numa peça que ele não enxerga
(`deliverables_select_cliente` exige `enviado_em`) seria gravar que ele decidiu
o que não viu; numa que ele já aprovou, seria desfazer a aprovação dele por
causa de uma rodada interna da versão seguinte. **Por isso `aprovado` é
preservado:** a recusa interna da v2 diz que a v2 não sai, não que a v1 deixou
de valer. É a frase que `etapa_acompanha_o_entregavel` já escrevia um nível
abaixo — *"a peça foi feita uma vez e vai ser refeita"*.

**A ETAPA É O QUE A DEVOLVE DE VERDADE.** A peça é uma subtarefa desde a 0051,
então mover a etapa para `em_andamento` é o que a põe de volta no "Minhas
Tasks" de quem a produziu — que é onde ele a procura. `em_ajustes` não cabe, e
é mecânico: a trava 4 de `validar_transicao_de_subtarefa` cobra uma rodada
`ajustes_solicitados` na própria SUBTAREFA, e esta rodada é do entregável.

**E o pedido vira COMENTÁRIO na demanda.** Ele morava só em
`approval_rounds.comentario`, e nenhuma tela do produto lê rodada de
entregável. Na demanda ele cai onde a etapa de demanda já grava o dela desde a
0007. A peça de campanha tem `task_comentarios` justamente por ser uma
subtarefa — ao contrário do post, que não tem nada equivalente do lado interno
e por isso depende só do sino.

**Tudo isso é TRIGGER e não action** (`approval_rounds_devolve_o_entregavel`),
pela razão da 0045: a action que decide a rodada já foi reescrita e vai ser de
novo, e cada reescrita é uma chance de o trecho ficar para trás. De quebra ele
pega todo caminho, inclusive um PATCH montado à mão.

**A SEGUNDA CAUSA: o aviso da rodada interna nunca alcançou a peça.** Eu
escrevi aqui que `approval_rounds_avisa_aprovador` (0064) *"já toca o sino
quando uma rodada interna nasce pendente"*. Não tocava:
`avisa_aprovador_da_conta()` tem um `else return new` depois de `subtask` e
`post`, e `deliverable` caía nele. Era uma afirmação minha sobre código que eu
não tinha lido — a mesma falha da frase sobre a pilha de avatares não custar
consulta, e vale repetir por quê: **o custo de escrever aqui uma propriedade
que não foi conferida é que ela passa a ser lida como verdade por quem vier
depois.**

**E havia uma segunda metade, que valia para os TRÊS tipos.** O único avisado
era `client_flow_defaults.aprovador_interno_id`, que é opcional e está nulo na
maioria das contas — a aba Configurações do fluxo nasceu na 0064 e quase
ninguém a preencheu. **Conta sem aprovador configurado não avisava ninguém**, e
isso se lê exatamente como "as notificações não funcionam". Agora a volta é a
**gestão ativa inteira**, que é a forma de `solicitar_notas_do_mes()` e o pedido
literal do usuário. *O custo está dito:* numa agência sem aprovador
configurado, toda rodada interna toca o sino de todo gestor — melhor que tocar
o de ninguém, e quem quiser estreitar nomeia o aprovador da conta.

**De quebra, o `rpc("notificar")` do post deixou de ser descartado.** Ele
devolve `{ error }`, e com o retorno jogado fora uma recusa não aparecia nem na
tela nem no log — contra a regra de nenhuma escrita falhar em silêncio, no
único lugar onde o sintoma é "não chegou nada".

#### A campanha é a TASK MÃE, e as subtarefas são os itens dela

Migration 0080, decisão do usuário: *"quero que a campanha apareça como uma
task. A campanha é a task mãe, e as subtarefas são os itens da campanha."*

**A frase já era verdade, e só no instante da abertura.** `abrir_campanha()`
(0051) cria a demanda e, para cada nó, uma etapa e um entregável apontando para
ela — e dali em diante os dois lados andavam separados:

- **não existia caminho nenhum para acrescentar um item a uma campanha
  aberta.** A árvore era congelada no clique de "Criar campanha", e o jeito de
  acrescentar uma peça era abrir outra campanha;
- acrescentar uma ETAPA na demanda — que é o caminho que existe, e o que a
  tela de produção MANDA fazer, com a frase *"Acrescente na demanda — cada
  etapa vira uma peça aqui"* — **não criava peça nenhuma**. Aquela frase era
  uma promessa que o produto não cumpria;
- renomear a etapa deixava a peça com o nome antigo para sempre, e trocar o
  responsável dela deixava a peça no nome de quem saiu do trabalho.

**Há UM lugar onde uma peça nasce, e é a etapa da demanda.** Por isso
`abrir_campanha()` parou de inserir entregável: com o espelho de pé ela criava
a etapa (o espelho criava a peça) e inseria a peça de novo — dois itens por
nó. A saída não é um `if` no espelho para ele se calar durante a abertura; é
tirar a segunda escrita. É a decisão de `arte_url` ser a capa escrita pelo
trigger e a de `tasks.data_inicio` ser derivada das etapas: o que é
consequência não se escreve duas vezes.

**O espelho copia quatro colunas, e nenhuma delas é status.** Nome, prazo,
responsável e ordem, mais o nível — `subtasks_agrupadora` (0022) recusa o neto
da etapa e `deliverables_dois_niveis` (0033) recusa o neto da peça, então os
três níveis da demanda batem com os dois da campanha sem de-para. O status
fica de fora porque `content_status` é o ciclo com o cliente e
`subtask_status` é o trabalho da pessoa — a decisão dos três vocabulários. Quem
liga os dois onde eles se encontram de verdade já existe:
`etapa_acompanha_o_entregavel` (0052) e `entregavel_volta_da_analise` (0079).

**Ele não vai no sentido contrário**, e é o que impede o laço: criar entregável
não cria etapa. Se um dia houver uma tela de "acrescentar peça" direto na
campanha, ela chama a demanda.

**E ele não apaga a peça que tem material.** Apagar a etapa apaga a peça vazia
— que é o que a pessoa quis dizer — e preserva a que tem versão gravada ou
carimbo de envio: ali o `on delete set null` de `subtask_id` deixa a peça sem
etapa, que é o estado das campanhas anteriores à 0051 e que a tela já desenha.
Levar junto a arte que o cliente aprovou por causa de um clique numa lista de
etapas é perda de material, e apagar não é desfazer.

**São DOIS triggers na mesma função, e foi a bateria que mostrou por quê.**
`after` para nascer e mudar (num `before insert` a etapa ainda não existe e a
peça estouraria na chave estrangeira), e **`before` para apagar**: `subtask_id`
é `on delete set null`, a ação da chave estrangeira também roda como trigger
AFTER, e num `after delete` a coluna já pode estar nula — o `where
d.subtask_id = old.id` não acha a peça que acabou de ser desligada, e ela fica
órfã em vez de sair, sem erro nenhum. O cenário "a peça vazia foi com ela"
achou 1 onde esperava 0; o resultado era plausível, que é o modo de falha desta
casa.

**A migration faz uma passada nas campanhas que já estão abertas**, pelos pais
e depois pelos filhos em dois comandos — num comando só a ordem das linhas não
é garantida e metade dos filhos sairia no nível de topo. As anteriores à 0051
continuam com `task_id` nulo, e a resposta para elas continua sendo
`scripts/campanhas-sem-demanda.sql`, que pede a pasta de entrega a quem sabe
qual é.

#### A campanha se edita depois de aberta

Migration 0078, decisão do usuário: *"preciso poder editar as informações de
uma campanha, após abrir ela. Mudar data, nome, dentre outras coisas"*. A tela
de produção mostrava nome, cliente, período e estado como TEXTO desde que
nasceu, e a única coisa que se trocava ali era a capa — um nome digitado errado
na abertura ficava para sempre, no board, no portal e no calendário.

**A trava não podia morar na policy.** `campaigns_update` é `is_staff()` desde
a 0033, e tem que continuar sendo: é por ela que quem produz troca a CAPA
(0050). Abrir a mesma policy para o nome e o período entregaria a quem produz o
combinado com o cliente. Então é `campaigns_protege_colunas`, pela razão de
sempre — **policy não limita coluna** —, na forma de `posts_protege_colunas`
(0042) e de `protect_client_columns` (0005). Dois cenários da bateria são a
mesma pessoa, na mesma tabela, com a mesma policy: a capa passa e o nome não.

**Quem edita é `is_atendimento()`, a mesma pergunta de quem abre** (0054): nome,
período e estado são o combinado com o cliente — a decisão da abertura, tomada
de novo. E ele **recusa em vez de reescrever**, como o trigger do post: os
campos aparecem na tela, e quem tenta mudar a data precisa ouvir que não pode,
senão salva, vê a data antiga voltar e conclui que a tela está quebrada.

**A EMPRESA NÃO SE TROCA PARA NINGUÉM, nem para o sócio**, e é a única recusa
sem exceção. `abrir_campanha()` (0051) cria a demanda com o mesmo `client_id`,
e a visibilidade de cada peça no portal sai dali: trocar a empresa deixaria a
demanda apontando para a antiga e as peças já enviadas visíveis para quem não
as pediu — um vazamento entre contas que nenhuma tela mostraria. Campanha de
outra empresa é campanha nova. O campo nem existe no formulário: o que não
existe não volta no dia em que alguém copiar a tela.

**O título da demanda acompanha o nome; o período NÃO**, e a assimetria é
deliberada. `tasks.data_inicio` e `data_fim` são DERIVADOS das etapas desde a
0028 — `recalcular_periodo_da_task()` os reescreve a cada escrita em
`subtasks`. Espelhar o período seria gravar um valor que o próximo recálculo
desfaz, que é o pior dos dois mundos: a escolha passa e some depois, sem
ninguém ver. São dois fatos diferentes — o período da campanha é o combinado
com o cliente, o da demanda é a soma do trabalho dentro dela. **A bateria
guarda o cenário que impede a simetria**: quem acrescentar `data_fim` ao
espelho o derruba.

**E é diálogo, não edição no lugar**, ao contrário da tela de task: lá o
rascunho é de quem o criou e não existe para mais ninguém; aqui cada
salvamento parcial muda o que o cliente lê no portal dele. É a decisão do
editor de recorrência.

**O estado pode voltar sozinho, e a tela diz isso** — mas só quando vale.
`campanha_finaliza_sozinha` (0051) marca `finalizada` quando toda folha está
aprovada e devolve para `ativa` quando uma peça volta à produção; o aviso só
aparece com tudo aprovado, porque um aviso permanente é um aviso que ninguém lê.

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
designer subindo o PDF da lâmina dele não está fazendo nada sobre ninguém. **E
depois saiu da barra junto com o Social Media**, pela decisão registrada em
"As duas entradas saem da barra": a Principal era o lugar certo para ela, e o
argumento continua valendo para onde ela foi — Minhas Tasks é a tela do
trabalho do dia da pessoa, que é exatamente o que a peça de campanha é.

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

#### A capa e a foto de perfil de cada cliente

Migration 0063, decisão do usuário, escolhida entre três propostas de layout:
**capa larga com a foto sobreposta**, no desenho de perfil de rede social.

**A metade que já existia é `clients.logo_url`, e ela é a quinta ponte.**
Nasceu na 0031, está na lista de colunas que o cliente pode escrever desde
então, e **nenhuma linha da interface a desenhava** — nem no painel, nem no
portal. Em doze sprints ela foi um campo de anotação, como
`clients.drive_folder_id` até o Sprint 16 e `posts.subtask_id` até a 0061. Por
isso a coluna nova é uma só: a capa.

**A capa é da agência; o logo continua do cliente.** As duas ao mesmo tempo
pareceriam incoerência, e são duas perguntas: o logo é a marca da empresa dele,
e a regra escrita desde a 0005 é que contato, e-mail, telefone e logo são dele;
a capa é enquadramento — é como a Full apresenta aquele portal, como a coluna
escura do login e a capa da campanha. `capa_url` entra em
`protect_client_columns` e `logo_url` não sai de onde está. Quem sobe as duas é
a agência, na ficha do cliente.

**A peça grande só no Início; a foto pequena em toda tela.** A proposta que
punha a capa atrás do cabeçalho de todas as telas custava o inverso: numa faixa
de 88px a imagem se lê como textura e não como imagem. Aqui ela tem 200px para
ser uma imagem de verdade, e as outras telas ficam com a foto de 28px ao lado
do nome — identidade constante sem repetir a peça grande em cada visita. Em
375px a capa cai para 120px, que é a única concessão: metade da primeira dobra
de um celular gasta com marca é meia tela a menos para o que a pessoa veio ver.

**Ela é ALINHADA AO CONTEÚDO, e não sangra para fora dele.** A primeira versão
usava `-mx-4 lg:-mx-8` para escapar do respiro da página, e a imagem do
protótipo mostrou por que não funciona: `main` é `mx-auto max-w-5xl`, então
tirar o padding deixa a faixa 32px mais larga que os cartões e ainda longe da
borda da janela — nem alinhada nem de ponta a ponta, que é a única das três que
parece erro.

**A saudação mora dentro da identidade.** Ela estava num bloco acima, e o
resultado era "Olá, Ana" em cima, a capa embaixo, e o nome da empresa duas
vezes na mesma dobra — no cabeçalho e no bloco. Juntas, as duas linhas dizem de
uma vez de quem é o portal e quem está lendo.

**O nome nunca vai EM CIMA da imagem.** Texto sobre foto é contraste que
ninguém mediu: a capa vem de fora e pode ser clara, escura, ou as duas coisas
na mesma imagem. É a mesma razão pela qual o produto usa par nomeado em vez de
opacidade.

Sem capa, a faixa cai para `--brand-navy` — o mesmo fundo da barra lateral e do
painel do login, escuro nos dois temas. Sem foto, o ícone genérico. **Tirar
não apaga o arquivo**, como na capa da campanha: apagar não é desfazer.

#### O que o cliente edita, e o que ele não edita

Contato, e-mail, telefone e logo. **Nome da empresa e slug, nunca.** A policy
`clients_update_proprio` deixa a linha inteira passar de propósito; quem separa
é o trigger `protect_client_columns`.

**E ele não protegia o slug.** A coluna nasceu na 0009, depois da função da
0005, e ninguém a acrescentou à lista — o cliente trocava o endereço do
próprio portal por um PATCH, e o `/portal/{slug}` que a gestão usa deixava de
abrir. A 0031 fechou, e o cenário confere nos dois sentidos: a escrita passa
(é o desenho) e o valor não muda.

#### Os padrões da conta: quem faz o quê nesta empresa

`client_flow_defaults` e `client_function_defaults` — migration 0064, decisão
do usuário. Eles vivem na aba **Configurações do fluxo** da ficha do cliente,
que até aqui era um espaço reservado.

**O problema é uma frase:** abrir uma demanda para a Mundo Verde e escolher à
mão, toda vez, a mesma social media e o mesmo redator. O workflow já sabia que
a etapa é de Design desde a 0008 — `workflow_steps.funcao_padrao` —, e não
havia onde dizer QUEM é o Design daquela conta. **É a sexta ponte do produto:**
a coluna existia, a tela a mostrava, e nada a lia.

**A ORDEM É pessoa da etapa → pessoa da função na conta → ninguém**, nessa
ordem, e ela mora em `etapas_resolvidas_do_workflow()`. Quem escreveu o nome na
etapa mandou — a inversão transformaria o campo numa arma, que é a lição da
0041 com o responsável padrão da recorrência. A bateria guarda o cenário que
impede a inversão: ele é o único que falha se o `case` trocar de lado.

**E quem saiu da agência não vira responsável**, nem estando escrito na etapa.
`pessoa_desligada()` é a mesma pergunta que a recorrência faz desde a 0041: uma
etapa no nome de quem não está mais aqui não aparece no "Minhas Tasks" de
ninguém, e é pior que uma etapa sem dono, porque parece resolvida.

**Função sem dono AVISA, nunca recusa.** A etapa nasce sem responsável — que é
visível — e a frase **nomeia a função que faltou**, como a recusa da 0023
nomeia cada etapa sem aprovação: "há etapa sem responsável" manda abrir uma por
uma; dizer qual é a diferença entre um aviso e uma instrução. Travar a abertura
da demanda por causa de um cadastro deixaria o cliente sem entrega.

**O aprovador interno padrão não é anotação: ele é chamado.** O trigger
`approval_rounds_avisa_aprovador` toca o sino dele quando uma rodada interna
nasce pendente. Sem isso a fila interna continuaria sendo uma tela que alguém
lembra de abrir, com o prazo do cliente correndo nesse tempo. **É trigger e não
action** pela razão da auditoria: a rodada nasce por três caminhos, e o aviso
escrito na camada de aplicação cobre o que passou pela tela. As três recusas
que importam são de `notificar()` e não se repetem aqui — quem causou o aviso
não recebe, quem saiu não recebe, e avisar ninguém devolve `null` sem derrubar
a escrita, que é exatamente a linha da 0062.

**O prazo de resposta é de CADA CONTA**, e é ele que acende o selo "passou do
prazo desta conta" na fila de aprovações. Uma constante no código faria um
cliente que combinou dois dias e outro que combinou dez acenderem o alerta no
mesmo dia. Quem nunca configurou vale três — o `default` da coluna e
`PRAZO_DE_APROVACAO_PADRAO` existem os dois de propósito: um decide o que fica
gravado, o outro decide o que a tela conta para a conta que ainda não tem
linha, que é a maioria no dia em que a aba nasce.

**A pasta padrão PREENCHE, nunca sobrescreve.** Escolher o cliente numa demanda
sem pasta traz a da conta; numa que já tem, não encosta — trocar o endereço da
entrega embaixo de quem acabou de colá-lo é o oposto do que a 0015 protege. E
mora na action, não na tela: a tela salva campo a campo, e um preenchimento
feito no navegador dependeria de os padrões terem carregado antes.

**Três coisas NÃO viraram coluna nova, e é o que evita duas verdades:**

| O que | Onde mora | Por quê |
| --- | --- | --- |
| o atendimento da conta | `clients.responsavel_atendimento_id` | é quem o Portal avisa desde a 0062; uma segunda coluna divergiria calada |
| as particularidades | `clients.observacoes` | existe desde o Sprint 2 — o que faltava era ela aparecer no detalhe da demanda, que é onde decide algo |
| as etapas do fluxo | `workflow_steps` | o editor continua na aba Workflows de Gestão de Tasks, e a ficha leva para lá |

**Não existe estado "só leitura" nesta aba, porque ele não teria a quem
recusar.** A primeira versão tinha a faixa e os campos desligados — e a ficha
do cliente mora em `/painel/pessoas`, que é `GESTAO` desde o Sprint 3C, e
gestão passa em `is_atendimento()`. É a 0060 no mesmo dia: uma segunda pergunta
embaixo de uma primeira que já barra todo mundo não barra ninguém. *O que fica
em aberto, e é dito em vez de escondido:* o banco aceita o colaborador do
Atendimento escrevendo estes padrões, e nenhuma tela o leva até lá.

**E `FUNCOES` virou uma lista só.** As nove funções viviam copiadas em quatro
arquivos — duas como tupla `as const` para o zod, duas como `TeamFuncao[]` para
a tela —, e a quinta cópia seria a que esquecesse uma função nova: o enum do
banco ganharia o valor, uma tela ofereceria, e a action ao lado recusaria com
uma mensagem sobre escolher a função. Hoje é uma tupla em `lib/dominio/equipe.ts`
com `satisfies readonly TeamFuncao[]`, que serve aos dois lados.

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

#### As solicitações do cliente

`request_types`, `client_requests`, `request_attachments` e `request_messages`
— migration 0068. O cliente pede um trabalho pelo Portal, com anexo e um
roteiro de briefing; o Atendimento lê, conversa e converte em demanda num
clique.

**O Portal era de mão única**, e é isso que este módulo desfaz. Desde o Sprint
12 a agência envia e o cliente aprova, pede ajustes ou recusa — nada do que ele
escreve ali ABRE trabalho. O comentário de um material vive dentro daquele
material; um pedido novo chega por WhatsApp, some no fim do dia e vira "você
chegou a ver o que eu mandei?". A demanda só nascia quando alguém do
Atendimento a digitava.

**A CONVERSÃO NUNCA É AUTOMÁTICA, e é a primeira regra.** Um pedido não é uma
demanda: chega sem prazo combinado, sem responsável, sem prioridade e às vezes
sem ser um trabalho — e são essas quatro coisas que o Atendimento decide. Uma
rotina que criasse a task sozinha poria no board da agência trabalho que
ninguém aceitou, e o board é o lugar onde a equipe confia que tudo tem dono.
**Não existe trigger que crie task a partir de pedido.**

**E O STATUS SÓ ANDA QUANDO A DEMANDA É PUBLICADA.** Converter abre um
**rascunho** (0028) com título, cliente, briefing e a pasta padrão da conta
preenchidos, e leva para a tela de detalhe — que é onde se escolhe o workflow,
se distribui as etapas e se assume o prazo. Andar na criação do rascunho diria
ao cliente "estamos fazendo" sobre uma demanda que ninguém da equipe enxerga
ainda, e que pode ser abandonada.

Quem move é `tasks_espelha_no_pedido`, em duas transições e só duas: publicar
→ `em_andamento`, e `entregue` → `concluida`. **A segunda evita a fila que
acumula** — sem ela todo pedido já entregue ficaria para sempre na caixa de
entrada, e uma fila que só cresce é uma fila que ninguém abre. **O trigger mora
em `tasks` e não dentro de `publicarTask`**, pela razão da 0045: aquela action
já foi reescrita e vai ser de novo, e cada reescrita é uma chance de o trecho
ficar para trás. E ele **nunca derruba a escrita da task**, que é a lição da
0052: uma falha aqui apareceria para quem clicou em "Criar task" como a
publicação dela sendo recusada, com uma mensagem sobre um pedido do cliente.

**O PRAZO DESEJADO NÃO É COMPROMISSO**, e a coluna diz isso no nome.
`data_desejada` é o que o cliente gostaria; `tasks.data_fim` é o que a agência
assume. A conversão não copia um no outro — ela escreve a data no BRIEFING,
com a frase que diz o que ela é. E a tela do portal repete isso embaixo do
campo, porque quem digita a data precisa saber o que ela significa antes de
digitar, não quando a peça não chegar no dia.

**E o cliente não escolhe prioridade, responsável nem prazo real.** As três
colunas **não existem** nesta tabela, o que é mais forte que não mostrá-las na
tela: o campo que não existe não volta no dia em que alguém copiar o
formulário.

**`solicitacao_status` é um QUARTO vocabulário**, ao lado de `task_status`,
`subtask_status` e `content_status`, e pela mesma razão que mantém os três
separados: esta tabela responde a outra pergunta — "em que pé está o meu
PEDIDO?". Sem `cancelada`, que é a lição da 0020, e sem `lida`: "alguém abriu"
não é estado do trabalho, e um selo que muda porque uma tela foi aberta ensina
o cliente a contar visualização.

**São DOIS mapas de rótulo, e não um.** O mesmo valor quer dizer coisas
diferentes dos dois lados: `em_andamento` é "virou demanda" na fila do
Atendimento e "em produção" no portal; `nova` é "ninguém triou" — uma cobrança
— e "enviado" — um recibo. Um mapa só obrigaria a escolher entre dizer ao
cliente que o pedido dele está "novo" e dizer à agência que está "enviado".
`SeloDaSolicitacao` recebe de que lado está sendo desenhado, e é o que permite
um componente para as duas telas.

#### As abas do Portal são FASES, e não o enum

Decisão do usuário: *"na aba de pedidos, eles sejam separados em abas, Em
análise, Em produção, Em ajustes, Entregue"*.

**Nenhuma coluna nasceu, e nenhum valor entrou no enum.** A fase é uma leitura
do estado do pedido mais o da demanda que ele virou — `faseDoPedido()` em
`lib/dominio/solicitacoes.ts` —, e é a decisão de `maoDoPost()` no Social
Media, de "bloqueio não é status" e de "atraso do Financeiro não é coluna": uma
coluna `fase` precisaria ser reescrita por quatro caminhos para continuar
verdadeira.

| Fase | De onde sai |
| --- | --- |
| Em análise | `nova` + `em_analise` |
| Em produção | `em_andamento`, e a demanda NÃO está em ajustes |
| Em ajustes | `em_andamento`, e a demanda ESTÁ em ajustes |
| Entregue | `concluida` |
| Recusado | `recusada` |

**`nova` e `em_analise` dividem a primeira**, e é de propósito: a diferença
entre elas é se alguém do Atendimento já abriu a fila — informação da AGÊNCIA,
não do cliente. Para quem mandou, as duas querem dizer que está sendo olhado.

**"EM AJUSTES" NÃO É VALOR DE `solicitacao_status`**, e a ausência é o ponto.
Quem sabe que há ajuste em curso é a DEMANDA: `task_status` tem `em_ajustes`
desde a 0007, e é para lá que ela volta quando o cliente pede alteração. Um
valor novo no enum do pedido seria uma segunda verdade sobre o mesmo fato, e
divergiria no instante em que a demanda saísse de ajustes — o pedido ficaria
parado até alguém reescrevê-lo à mão. Derivada, ela volta sozinha.

**E a demanda só é legível para o cliente quando algo dela foi enviado** —
`tasks_select_cliente` exige uma rodada de escopo cliente. Longe de ser um
furo, é o que faz a derivação valer onde ela importa: uma demanda vai para
`em_ajustes` porque o cliente pediu alteração numa peça, e pedir alteração
exige que a peça tenha saído. Fora disso o pedido fica em "Em produção", que é
a verdade do que ele sabe.

**"Recusado" é uma QUINTA aba, e só aparece quando existe pedido nela.** Ele
nomeou quatro, e `recusada` não cabe em nenhuma: em "Entregue" afirmaria que
foi entregue, e fora das abas o pedido sumiria da tela de quem o abriu — junto
com o motivo, que é a única coisa que explica o que aconteceu.

**"Todos" é a primeira, e é o padrão.** Abrindo em "Em análise", uma conta
cujos três pedidos estão em produção cairia numa tela vazia tendo três pedidos.

**A contagem sai da mesma lista que desenha as linhas**, e por isso o recorte
acontece na tela e não na consulta: com o `select` já filtrado, o número das
outras abas não existiria. É o contador de Minhas Tasks pela terceira vez.

**O selo some dentro da aba e volta em "Todos"** — a decisão da Lista de Minhas
Tasks: o cabeçalho já o disse. Aqui ela vale duas vezes, porque na aba "Em
análise" o selo de um pedido `nova` diz "Enviado", e duas palavras diferentes
para a mesma linha a um centímetro de distância é a tela se desmentindo. **E a
frase da linha passa por `explicacaoDoPedido()`**, senão "Já está sendo feito"
apareceria debaixo da aba "Em ajustes": `EXPLICACAO_PARA_O_CLIENTE` é por
STATUS, e o status de um pedido em ajuste continua sendo `em_andamento`.

**A aba mora na URL**, como todo filtro de listagem, e valor torto cai em
"Todos".

#### O roteiro de briefing

`request_types.campos_json` é um array em `jsonb` com as perguntas daquele tipo
de trabalho — onde vai ao ar, que medida, quanto tempo. Ele existe porque um
campo de texto livre chamado "descreva o que você precisa" devolve "uma arte
pro insta", e a primeira mensagem da conversa é sempre a mesma pergunta.

**É `jsonb` e não um par de tabelas**, pelo critério do template de campanha:
é uma lista que alguém edita inteira antes de salvar, e normalizar criaria duas
tabelas para servir um `select * where id = ?`.

**E o roteiro NÃO é copiado para o pedido**, ao contrário do
`workflow_snapshot` da task. Lá a cópia existe porque editar o workflow não
pode mudar demanda nenhuma que já está correndo, e a demanda vive meses; o
pedido vira demanda em dias, e o que importa dele — a resposta — está na
própria linha. Se o roteiro mudar embaixo de um pedido antigo, o que se perde é
o texto da pergunta: **a resposta órfã aparece com a chave crua e um aviso**,
em vez de sumir. Esconder a linha faria sumir uma informação que o cliente
escreveu.

**Um `check` garante que `campos_json` é uma LISTA**, e ele existe porque um
objeto gravado ali não quebra nada na hora: quebra na tela do cliente, que faz
`.map()` no que veio e mostra um formulário sem campo nenhum — sem erro e sem
log. `camposDoRoteiro()` descarta ainda o campo sem `chave`, que seria uma
pergunta cuja resposta não se grava em lugar nenhum.

**Quem edita o roteiro é a GESTÃO, e não `is_atendimento()` como quem tria.**
O roteiro vale para todas as contas: abrir uma demanda é trabalho do dia, mudar
a pergunta que todo cliente vai responder é configuração do produto. É a mesma
separação de "o Atendimento abre o mês, a gestão distribui a corrente" (0046).

**Os quatro tipos iniciais nascem na migration**, como os workflows da 0008: um
catálogo vazio no primeiro dia faz o módulo estrear sem funcionar — o cliente
abre "Novo pedido", encontra um seletor sem opção e conclui que a área não está
pronta.

#### A fila, a conversa e os anexos

**A caixa de entrada ordena DO MAIS ANTIGO PARA O MAIS NOVO**, ao contrário de
toda outra listagem do produto, e a 0068 cria o índice para isso. A pergunta
desta tela não é "o que chegou?", é "quem está esperando há mais tempo?" — e
uma fila em que o pedido de ontem aparece acima do de semana passada é a fila
em que o de semana passada nunca é atendido. Os encerrados vão para o fim e não
para fora: o Atendimento precisa achar o que já respondeu quando o cliente
pergunta de novo.

**O destaque é a IDADE e não o status**, e por isso é uma borda e não um selo a
mais — o selo já diz em que pé está. `--warning` e nunca `--danger`: um pedido
de três dias é uma cobrança, não um erro.

**NÃO EXISTE `interno` NAS MENSAGENS, e a ausência é a regra do módulo.** Em
`comments` (0032) existe, porque aquela thread fica no material e a equipe
precisa de um canto para falar sobre ele. Aqui a conversa É o pedido sendo
esclarecido: tudo o que se escreve é para o cliente ler, e a tela diz isso em
uma frase. Quem precisa falar da agência para dentro fala em
`task_comentarios`, na demanda — que é outra tabela, em outra tela, e que o
cliente não alcança. Uma coluna `interno` aqui seria o pior dos dois mundos: um
campo que a tela do cliente não mostra e a do painel mostra por engano no dia
em que alguém reaproveitar o componente da outra thread.

**A ação da conversa é UMA, para os dois lados**, e mora do lado do cliente:
mesma tabela, mesma validação, mesma cota. Duas cópias dariam dois limites de
tamanho para a mesma conversa, e a que divergisse seria a do lado que ninguém
testa.

**Mensagem não se edita nem se apaga, nem pelo sócio.** É o oposto do feed de
Recomendações, onde o autor edita: lá a frase é uma opinião dele; aqui ela é o
combinado entre duas empresas sobre o que vai ser feito. Reescrever "pode ser
azul" depois da peça pronta é reescrever o pedido — a razão pela qual rodada de
aprovação fechada nunca é reescrita. **E o cliente não edita o pedido depois de
mandar**, pela mesma razão: o caminho é a conversa.

**O teto de dez anexos RECUSA em vez de cortar**, ao contrário do limite por
task da recorrência: lá o excesso vem de uma regra de calendário, e cortar
deixa o mês incompleto e anotado; aqui cada arquivo foi escolhido e enviado por
uma pessoa, e descartar o décimo primeiro calado faria o cliente achar que
mandou o que não chegou. A contagem é do banco e não da tela: dez abas somando
um arquivo cada passam por dez contagens antes de qualquer uma gravar.

**Os anexos são COPIADOS para a demanda, não movidos** — eles continuam no
pedido, que é a tela do cliente. A referência aponta para o caminho no bucket
dos pedidos, e não para um segundo arquivo: duplicar em dois buckets criaria
duas cópias que divergem no dia em que o cliente apagar a dele.

**`aceita_solicitacoes` fecha a porta no BANCO**, no `with check` da policy de
INSERT, e não só escondendo o botão. O default é `true`: o contrário faria o
módulo nascer invisível para todo cliente e a agência concluir que ele não
funciona. Na conta desligada a tela **diz a quem falar** em vez de só sumir — a
decisão do "Enviar ao cliente" desligado com a razão escrita.

**A equipe também abre pedido**, e não é furo: o Atendimento que recebe por
telefone registra ali, e a conversa passa a ter um lugar. Quem escreveu fica em
`criado_por`, então o cliente vê de quem partiu. O que a **visualização
administrativa** (`/portal/{slug}/solicitacoes`) não faz é abrir pedido em nome
dele: seria a agência escrevendo como se fosse o cliente, e o caminho é a fila
do painel, onde o pedido nasce assinado.

**O aviso de pedido novo vai para `clients.responsavel_atendimento_id`** (0062)
e não para uma coluna nova em `client_flow_defaults` — a decisão da 0064. Conta
sem atendente não derruba o pedido: `notificar()` devolve `null` quando não há
a quem avisar. O que se perde é o sino; o pedido está na caixa de entrada, que
é onde o Atendimento olha.

**O menu leva a entrada para a PRINCIPAL e a abre para `EQUIPE`**, porque
`is_atendimento()` é verdadeira para colaborador do Atendimento — e é ele quem
vive nesta fila. Uma entrada de `GESTAO` esconderia o módulo exatamente de quem
o usa. *O que fica em aberto, e é dito em vez de escondido:* um colaborador
fora do Atendimento vê a lista de todos os clientes; ele já vê as demandas
deles no board, mas se um dia isso precisar ser fechado é uma policy de SELECT
mais estreita, não um `roles` mais curto.

**E o build pegou o que `check:fronteira` não pega.** O nome do bucket estava
em `lib/dados/solicitacoes.ts`, que é `server-only`, e a tela do pedido — que é
`"use client"` — precisa dele para subir o arquivo. `check:fronteira` varre o
caminho contrário (servidor importando valor do cliente), então quem reprovou
foi o `npm run build`, com um erro sobre `next/headers` no Pages Router. O
valor mora em `lib/dominio/solicitacoes.ts`, como `PRAZO_DE_APROVACAO_PADRAO`.

#### O pedido concluído devolve o material, e o vazio diz o que fazer

**O pedido virava um beco.** `tasks_espelha_no_pedido` move o pedido para
`concluida` quando a demanda vai a `entregue`, o sino toca *"seu pedido foi
concluído"* — e a tela do cliente mostrava um selo verde, a palavra "Entregue."
e nada para abrir. O trabalho existia, o material existia, e o pedido que o
originou não apontava para nenhum dos dois.

**A ponte já estava construída:** `tasks.request_id` nasceu na 0068. O que
faltava era o outro lado da travessia — de que demanda é cada material —, e
ele custou **um campo num tipo**, `ItemDoPortal.demandaId`. Nenhuma migration,
nenhuma consulta nova.

**E é FILTRO em cima da mesma leitura, não uma leitura nova.**
`materiaisDaDemanda()` chama `itensDoPortal()` e filtra. É o que garante a
frase que mais importa aqui: **nada que a empresa não pudesse ver passou a
aparecer** — quem decide continua sendo `approval_rounds_select_cliente` e
`subtasks_select_cliente`, e o que muda é o recorte. Uma segunda consulta
nomeando as mesmas colunas seria o lugar onde as duas divergem, e a que
divergisse é a do pedido, que a equipe quase não abre.

**`tasks.link_entrega` NÃO entra, e a recusa é mecânica antes de ser de
princípio.** Ela é a pasta do Drive da agência, criada por `lib/drive/` num
Drive Compartilhado da unidade: **ninguém a compartilha com o cliente**, e o
módulo não sabe fazê-lo — ele só procura e cria. O link levaria à tela de
permissão negada do Google, que é pior que link nenhum, porque promete o
material e entrega uma porta fechada. E o endereço pode ter sido colado à mão,
apontando para qualquer coisa: o produto não tem como afirmar que aquilo é
material pronto para o cliente.

**`demandaId` fica nulo no post e no material de campanha**, e é decisão: os
dois têm demanda própria — o mês de social e a campanha —, e nenhuma delas
nasce de um pedido, porque a conversão abre uma demanda nova e
`abrir_campanha()` e `abrir_mes_de_social()` abrem as suas. Preenchê-los
custaria duas consultas a mais na leitura que serve a tela inicial, o contador
e a lista, para responder uma pergunta que nunca é feita.

**O VAZIO É A METADE QUE IMPORTA.** Concluído sem nenhum material é caso real e
não defeito: uma demanda sem nada que peça o aval do cliente fecha sem nunca
ter mostrado peça nenhuma — `tasks_entregue_exige_cada_etapa` (0023) só cobra
as que pedem. Aí a seção diz isso e manda para a conversa, em vez de não
dizer nada. Uma caixa "nada aqui" nos outros estados seria o contrário: espaço
gasto todo dia para informar em alguns, que é a regra dos blocos de exceção da
Home.

**A demanda só é legível para o cliente quando algo dela foi enviado** —
`tasks_select_cliente` exige uma rodada de escopo cliente. Então a tela desenha
o vazio a partir do **estado do pedido**, nunca da ausência da demanda: pela
segunda, um concluído sem material não mostraria nem a frase.

**Duas coisas a imagem mostrou, e nenhuma o build pegaria.** A seção nasceu
entre o selo e o "Enviado em ... por Joana", partindo em duas a linha que diz
de quem é o pedido e quando ele chegou — ela desceu para depois do bloco
inteiro, e o material continua sendo a primeira coisa depois dele. E o link
era *"Ver por inteiro e decidir em Materiais"* numa lista em que as duas peças
já estavam **aprovadas**: um botão prometendo uma decisão que não existe.

**E o axe pegou a terceira**, que é uma regra nova para este produto:
`link-in-text-block`. O link nasceu no meio de uma frase, e ali a cor é a única
coisa que o separa do texto em volta. Todo link do produto é `hover:underline`
e nenhum outro foi acusado — porque nenhum outro mora dentro de um parágrafo.
Ele virou linha própria, que é o formato que o resto já usa.

**De quebra, a promessa do prazo desejado sai quando o pedido fecha.** *"A data
que a Full vai assumir chega por aqui, na conversa"* é verdade enquanto há o
que combinar; num pedido concluído ela promete uma conversa que não vai
acontecer, e num recusado, uma data para o que não vai ser feito. É a razão
pela qual o aviso do sino leva a data e nunca a palavra "hoje".

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

Cada abertura vira linha em `client_portal_views`, e **agora ela é lida**: na
ficha do cliente, num bloco que diz quem da agência abriu o portal dele e
quando. Ela era gravada desde a 0009 e nenhuma tela a consultava — um rastro
que ninguém lê não é auditoria, é um `insert` que custa uma ida ao banco por
visita e não responde pergunta nenhuma. A pergunta que ele responde aparece na
conversa em que o cliente diz "vocês viram o que eu comentei?".

**Ela NÃO entra em `/painel/auditoria`**, e a 0058 já dizia por quê: aquela
trilha é do sócio, e esta é operacional — `client_portal_views_select` fecha em
`is_gestor()` desde a 0009. Juntar as duas obrigaria a abrir a trilha do sócio
para o desenvolvedor, que é a porta dos fundos do Financeiro.

**E o bloco só é desenhado para a gestão**, porque quem não é recebe lista
vazia pelo RLS — e "ninguém abriu o portal deste cliente" dito a um colaborador
é uma afirmação falsa com toda a confiança. A trava continua sendo a policy;
não desenhar é só não mentir. O bloco também some quando não houve visita
nenhuma, como os blocos de exceção da Home.

A RLS só aceita a linha em nome de quem está logado, e não existe policy de
DELETE.

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

### Gestão de Tasks: as demandas, os workflows, as recorrentes e a fila

`/painel/gestao-tasks`, com a aba na URL. **Eram TRÊS itens de menu e viraram
um**, por decisão do usuário: Gestão de Tasks, Workflows e Aprovações Internas.

**Os três respondiam à mesma pergunta em três endereços: o trabalho da
agência.** A demanda é o trabalho; o workflow é a cadeia de etapas que ela
percorre; a recorrência é a regra que a abre na data; a fila é onde ela espera
o aval antes de sair. E as três telas são da mesma pessoa — quem monta a
cadeia é quem distribui a demanda, que é quem aprova. É a decisão da Gestão de
Pessoas aplicada de novo: a tela reflete que são o mesmo assunto, e o banco
continua com as tabelas separadas porque elas são coisas separadas.

**A HIERARQUIA FOI ACHATADA, e não aninhada.** Recorrências era sub-aba de
Workflows; com o nível de cima nascendo, ela viraria aba dentro de aba — duas
barras empilhadas, e a de baixo trocando de conteúdo conforme a de cima. A
proximidade que justificava o par continua inteira, e é o argumento do Sprint
3D palavra por palavra: elas são vizinhas na mesma barra, e a recorrência no
modo "task por ocorrência" escolhe um workflow que está a um clique.

**Não existe `QUEM_VE` aqui**, ao contrário das Notas Fiscais: as três rotas
eram `GESTAO` e continuam sendo, então uma checagem por aba num conjunto em
que todas respondem igual é uma segunda pergunta embaixo de uma primeira que
já barra todo mundo — a lição da 0060.

**O QUE A FUSÃO DEVOLVE EM TROCA DO ITEM QUE SUMIU é o selo de contagem.**
Antes a pessoa via "Aprovações Internas" na barra lateral todo dia e clicava
para descobrir se havia algo esperando; agora o número está na aba, na tela
que ela já abre. Ele conta **`esperando`** e nunca o total — "prontas para o
cliente" já passaram pelo aval e esperam um envio, não uma decisão, e somar as
duas faria o selo cobrar uma ação que metade da fila não pede. E **o par
"nenhuma" não existe**: um selo com zero é a mesma linha com um número a mais,
e a ausência é a resposta — a decisão da matriz do Full Days, que pinta só a
exceção.

**Os contadores desceram do cabeçalho para dentro da aba de Demandas.** "5
abertas · 2 atrasadas" descreve as DEMANDAS, e lido no topo da aba de Workflows
seria um número sobre outra coisa.

**Cada aba carrega os filtros dela, e trocar de aba não leva os da anterior.**
`situacao`, `modo` e `regra` são da lista de recorrências; `status`,
`prioridade` e `atrasadas` são do board. Levar tudo junto deixaria na URL
parâmetros que não mudam nada — e pior, um `?status=entregue` sobrevivendo até
a volta para Demandas, onde ele filtra de verdade.

**AS DUAS ROTAS ANTIGAS VIRAM 308, e o redirect não é gentileza com quem tem
link salvo.** As notificações do sino gravam o endereço DENTRO da linha, e
`notificar()` é chamada de dentro de trigger desde a 0008 com
`/painel/aprovacoes-internas` escrito no corpo da função — são linhas que já
estão no banco de produção. Sem os redirects, todo sino antigo levaria a 404.
Reescrever o corpo daquelas funções seria uma migration cujo único efeito é
trocar um texto que o redirect já resolve, e migration que não muda
comportamento é migration que alguém aplica por engano achando que muda: a
mesma decisão dos comentários datados da 0028 e da 0031.

**E `revalidatePath` NÃO leva a aba.** Ele casa por CAMINHO, e uma string com
`?aba=` não bate com rota nenhuma — a chamada passa sem erro e não revalida
nada. Quem mexesse num workflow veria a tela antiga até recarregar à mão, sem
log e sem recusa para investigar. As quatro abas são a mesma rota, então
revalidar o caminho revalida as quatro de uma vez, que é o certo: mudar um
workflow muda a contagem de etapas que a aba de Demandas mostra.

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

### A nota fiscal da pessoa

`team_invoices` — migration 0065. A equipe é toda PJ, então todo mês cada
pessoa emite a nota dela e manda para a agência pagar. **Não confundir com o
Financeiro da casa**: aquele é da agência, na Gestão; este é de cada um, na
Principal. No menu antigo os dois viviam juntos em "Financeiro e NFs", e o
resultado era o colaborador achando que não tinha onde mandar a nota.

**O módulo estava no menu desde o Sprint 3C e a tela dizia "esta área ainda
não está pronta".** Não havia ponte para atravessar desta vez — nem tabela, nem
tipo, nem coluna esperando alguém. É o primeiro módulo do zero em muitos
sprints, e por isso a migration é grande.

#### As três decisões, e o que cada uma custou

**SÓ O SÓCIO CONFERE E PAGA**, e mais ninguém. É a regra do Financeiro pela
mesma razão: a fila de notas é a folha de pagamento da agência vista de outro
ângulo — quem a abre lê quanto cada colega ganha. O desenvolvedor é gestão para
todo o resto do sistema e aqui não. *O custo aceito é o mesmo:* num dia em que
o sócio estiver fora, ninguém aprova nota.

**A NOTA PAGA VIRA DESPESA NO FINANCEIRO**, automaticamente. Sem isso o mesmo
dinheiro é lançado duas vezes à mão, e a rentabilidade por cliente ignora o
maior custo da casa — o que faz a margem mentir **para cima**, que é a pior
direção. O lançamento nasce do CLIQUE de quem pagou, nunca de uma rotina: é a
decisão da 0013 sobre gerar lançamentos do mês.

`nota_paga_vira_despesa()` é `security definer` porque `finance_entries` fecha
em `is_socio()` nos quatro comandos. Quem decide o acesso não é ela — é a
policy da nota mais o `nota_protege_colunas`, que já exigem o sócio para mexer
em `status`. E `finance_entry_id` é a ponte nos dois sentidos: ela impede o
lançamento em dobro e diz, de dentro do Financeiro, de qual nota aquilo veio.

**O VALOR É DIGITADO A CADA MÊS.** PJ com valor variável por hora, projeto ou
bônus é o caso normal, e um valor fixo na ficha poria o contrato de cada pessoa
numa tabela que a gestão inteira já lê.

#### O que o banco garante, e não a tela

- **A nota não NASCE paga.** `team_invoices_insert` só aceita `enviada`, então
  todo caminho até o pagamento passa pelo UPDATE — que só o sócio faz. Sem essa
  linha, uma requisição montada à mão pularia a conferência inteira.
- **O sócio decide e não redige.** Ele não reescreve valor, número nem arquivo:
  corrigir por fora transformaria a conferência em reescrita, e a pessoa veria
  a própria nota com outro número sem nada dizendo quem trocou. Se está errado,
  recusa com o motivo.
- **Recusar exige motivo**, na action e no `check`. Recusa sem motivo manda a
  pessoa adivinhar, e a próxima nota volta igual.
- **Pagar exige a data**, e ela é DIGITADA e não `now()`: o sócio marca no dia
  em que lembra, e a transferência saiu no dia em que saiu. É a mesma razão das
  três datas do Financeiro.
- **Nota paga e nota recusada não mudam mais de estado**, e nem se apagam —
  nem pelo sócio. Apagar é só da própria pessoa e só enquanto ninguém conferiu.

**UMA NOTA VIVA POR MÊS, E AS RECUSADAS ACUMULAM.** O índice único é
**parcial** (`where status <> 'recusada'`), e é essa a diferença: a pessoa não
manda duas notas de outubro ao mesmo tempo, mas a recusada FICA no banco com o
motivo, e uma nova nasce ao lado. Reescrever a recusada apagaria o que foi
pedido — a mesma razão pela qual rodada de aprovação fechada nunca é reescrita.

#### A tela, e o que ela diz

Duas abas na URL: **Minhas notas** para todo mundo, **A conferir** só para o
sócio — `?aba=conferir` digitado leva 403, e a policy devolve lista vazia de
qualquer forma. A guarda existe além do RLS por uma razão específica: sem ela,
quem não é sócio abriria a fila e leria *"Nenhuma nota esperando"*, uma
afirmação falsa com toda a confiança.

**A recusada ABRE a lista, com o motivo por extenso** — ela é a única linha que
pede ação, e o motivo é o que decide o que a pessoa faz em seguida. Num
`title`, ele não existe para quem usa toque.

**A fila do sócio tem três listas, e a divisão é por quem espera o quê**: "A
conferir" espera uma leitura, "Aprovadas" esperam uma transferência — com o
**total a pagar no cabeçalho**, que é a pergunta que se faz antes de abrir o
banco —, e "Encerradas" não esperam nada.

**E o sino toca nos dois sentidos**: todo sócio ativo é avisado quando chega
nota, e quem emitiu é avisado quando ela é decidida. Sem isso o módulo vira uma
tela que alguém lembra de abrir, e o que espera do outro lado é o pagamento de
alguém.

#### O quarto item da Home, que esperou a tabela existir

O bloco "Precisa de mim" dizia, no próprio comentário, que tinha **três itens e
não quatro** porque o sprint pedia as notas recusadas e a tabela não existia.
Agora existe, e entraram **dois**: a minha nota que voltou, e a fila do sócio.
Eles nunca aparecem juntos para a mesma pessoa — são os dois lados do mesmo
módulo, e quem separa é o RLS.

`minhasNotasRecusadas()` desconta o mês que já tem nota nova: uma recusada
reenviada não é pendência, e um aviso que não sai depois de resolvido é o que
ensina a ignorar o aviso.

#### "Pedir as notas do mês": o botão do Financeiro

Migration 0066, decisão do usuário: *"quero adicionar um botão no financeiro,
de solicitar notas fiscais, quando a pessoa do financeiro aperta esse botão,
ela automaticamente envia um pedido a todos os colaboradores internos da
agência, para que enviem a nota fiscal do mês de serviço"*.

**O PEDIDO NÃO VAI PARA QUEM JÁ MANDOU, e é a decisão que faz o botão poder ser
apertado de novo.** No dia 5 o sócio pede a todos; no dia 10 faltam três. Sem
essa linha a segunda cobrança chega também para quem já enviou — e um aviso que
cobra o que a pessoa já fez é o aviso que ela aprende a ignorar. "Já mandou" é
ter nota **viva** no mês: enviada, aprovada ou paga. A recusada **não** conta,
de propósito — quem teve a nota recusada precisa mandar outra, então ela é
exatamente quem a cobrança procura.

**Tudo numa função só, porque é uma transação só.** `solicitar_notas_do_mes()`
grava o registro e toca os N sinos juntos; pelo PostgREST seriam N+1 idas, e a
terceira falhando deixaria metade da equipe cobrada e o registro dizendo que
todos foram. E o sino é o banco e não a action: `notificar()` nunca avisa quem
causou o aviso, nunca avisa quem saiu, e devolve `null` sem derrubar a escrita
quando não há ninguém — a lição da 0062. Escrever o aviso na camada de
aplicação perderia as três de uma vez.

**O registro existe porque um botão sem memória se aperta duas vezes.** Oito
avisos saíram e nada na tela diz isso; o diálogo lê o último pedido e escreve
*"você já pediu em 03/10, para 8 pessoas"*. **Mais de uma linha por mês é o
desenho**, e não um furo: a cobrança do dia 10 é um fato diferente do pedido do
dia 5, com outro destinatário e outra contagem — um `unique (competencia)`
transformaria a segunda em reescrita da primeira, que é o que rodada de
aprovação fechada nunca sofre. E o registro **nasce mesmo com zero pessoas**:
"pedi no dia 10 e não faltava ninguém" é uma resposta.

**O diálogo diz QUEM vai receber, pelo nome, antes do clique.** Um botão que
dispara oito avisos e só depois conta quantos foram é um botão que se aperta
com medo — e o medo tem razão, porque o aviso não se desfaz. A lista de nomes é
o que faz a pessoa reconhecer, antes de mandar, que a Marina está ali porque a
nota dela foi recusada. É a decisão do diálogo de apagar campanha, que **conta**
o que vai junto em vez de perguntar "tem certeza?".

**E a contagem vem da MESMA função que o envio usa.** `quem_deve_nota()`
responde aos dois lados, pela razão de `podeEnviarAoCliente()` no Social: a tela
existe para escrever a frase que o banco vai confirmar. Duas contas dariam um
diálogo prometendo cinco e um envio alcançando quatro.

##### O prazo é o mesmo dia do pedido, e ele AVISA em vez de RECUSAR

Decisão do usuário: *"a nota precisa ser enviada no mesmo dia de solicitação"*.

**Não é coluna.** O prazo de um pedido é a data em que ele saiu —
`created_at::date`, e mais nada. Um `prazo date` ao lado criaria duas verdades
sobre o mesmo fato, e é a mesma razão pela qual atraso no Financeiro não é
coluna e bloqueio de subtarefa não é status.

**E a tentação de travar o `insert` depois do dia se desfaz numa frase:** uma
nota recusada por atraso é uma nota que a agência **não recebe** — o oposto do
que pedir a nota existe para conseguir. Quem perdeu o dia manda no dia seguinte.
É a decisão de "função sem dono avisa, nunca recusa" (0064) e do limite por task
da recorrência, que corta em vez de recusar.

**Cobrar de novo MOVE o prazo, e isso é dito em voz alta.** O que vale é o
pedido mais recente, porque foi ele que chegou à pessoa: cobrar no dia 10 é
dizer "hoje" de novo, e continuar medindo pelo dia 5 marcaria de atrasado quem
está dentro do prazo que acabou de receber. *O custo:* a contagem de atrasados
cai quando o sócio cobra de novo. Os pedidos anteriores ficam todos no banco,
com data, e é neles que mora o histórico.

**O corpo do aviso leva a DATA, nunca a palavra "hoje".** O sino é escrito uma
vez e lido quando a pessoa abrir — às vezes três dias depois. "Envie hoje"
gravado no dia 5 passa a mentir no dia 6, e mente exatamente para quem está
atrasado, que é quem mais precisa ler a verdade. É a razão pela qual o "agora"
do feed de Recomendações desce do servidor.

##### O prazo do lado de quem deve a nota

**O sino não basta**: o aviso vira lido no primeiro clique, e depois o pedido
não existe em tela nenhuma. A faixa mora em `/painel/notas-fiscais`, acima da
lista, e some sozinha quando a nota chega — como os blocos de exceção da Home. O
tom é `--warning` mesmo atrasado, nunca `--danger`: vermelho numa tela que se
abre uma vez por mês treina o hábito de ignorar vermelho, e o atraso aqui é uma
nota que ainda entra.

Quem devolve esse recorte é `meus_pedidos_de_nota()`, `security definer`, **e
não um `select` em `invoice_requests`**: a policy daquela tabela é do sócio e
continua sendo. Abrir o SELECT para `is_staff()` resolveria a leitura e
entregaria de lambuja o `quantas_pessoas` de cada pedido — quantos colegas estão
devendo, numa tela pessoal onde isso não decide nada. É a forma de
`usuarios_do_meu_cliente()`, definer para devolver só o agregado.

*O skew de fuso falha para o lado generoso, e fica registrado:* `created_at::date`
lê a data no fuso da sessão, então um pedido disparado à noite pode ser lido
como do dia seguinte. O erro possível é dar um dia a mais a quem foi cobrado —
nunca marcar de atrasado quem está em dia.

**E entra no "Precisa de mim" da Home**, que é onde mora "o que está parado me
esperando".

##### Dois achados da bateria, e os dois são sobre medir

**O cenário do prazo não media nada**, e a mutação mostrou: os dois pedidos
saíam na mesma rodada, com o mesmo `now()`, então `min` e `max` davam a mesma
data e trocar um pelo outro passava verde. O primeiro pedido recua três dias, e
aí a mutação falha. É a lição do `select` antes do `insert` na idempotência da
recorrência: um teste que não separa a resposta certa da errada é um teste que
afirma sem provar.

**E a seção não usa o calendário de 2027 do resto do arquivo.**
`solicitar_notas_do_mes()` recusa mês que não começou, e é a primeira trava
daquele arquivo a comparar com `current_date` — as sete seções de cima datam
tudo em 2027 sem problema porque para elas a competência é só uma etiqueta de
mês. Aqui o mês de serviço é um mês que já passou, e passado não volta a ser
futuro.

#### O bucket é privado, e a pasta é da pessoa

Uma nota fiscal traz CNPJ, endereço e valor. A policy compara
`(storage.foldername(name))[1]` com quem está pedindo — a mesma forma do bucket
de campanhas, com o recorte mais estreito: lá a pasta é do cliente e quem lê é
a equipe; aqui a pasta é da pessoa e quem lê é ela e o sócio.

**E a trilha de auditoria pega a tabela**, o que aqui não é detalhe: `audit_log`
copia o trecho que mudou, então a linha de uma nota carrega o VALOR. Como só o
sócio lê a trilha, a regra desta migration não tem porta dos fundos.

### Comodatos: qual equipamento está com quem

`assets`, `asset_loans`, `asset_photos`, `asset_events` e `asset_term_template`
— migration 0069. A equipe é toda PJ e o equipamento é da agência: o notebook
que a Carla usa, a câmera que saiu para uma gravação, a lente que ficou com
quem não trabalha mais aqui.

**É o segundo módulo do zero em poucos sprints, e não havia ponte para
atravessar desta vez** — nem tabela, nem coluna esperando alguém, como foi o
caso das Notas Fiscais. Por isso a migration é grande.

**São DUAS visões da mesma informação, e é por isso que não são dois módulos:**
o colaborador vê o que está com ele, a gestão vê o inventário inteiro e quem
está com o quê. Uma rota, `/painel/comodatos`, com a aba na URL — e para quem
não é gestão a barra de abas some, porque uma navegação de um item é moldura
sem função, a mesma razão pela qual as abas de Equipe sumiram quando sobrou
uma.

**Ele fica na PRINCIPAL e abre para `EQUIPE`**, porque a divisão do menu é
sobre a pessoa: Gestão carrega o selo Admin e quer dizer "o que eu faço sobre
os outros", e quem confere o próprio notebook não está fazendo nada sobre
ninguém. É a decisão que moveu o Social Media e as Campanhas.

#### A divergência do texto do sprint é de segurança, e ela não cabia junto

O sprint escreve `assets_select` deixando o colaborador ler a linha do
equipamento que está com ele, e na linha seguinte diz que `valor_aquisicao` e
`nota_fiscal_url` são só da gestão — *"se a consulta do colaborador precisar da
tabela, use uma view sem essas colunas"*.

**As duas frases não cabem juntas.** Uma view não limita a tabela de baixo: com
a policy permitindo a linha, o colaborador lê as duas colunas pelo PostgREST
com um `select=valor_aquisicao` — a view protege quem passa por ela, e ninguém
é obrigado a passar. É a mesma regra que o produto já escreveu de outro jeito:
**policy não limita coluna**, e foi por isso que `comments.interno`,
`posts_protege_colunas` e `protect_client_columns` viraram trigger.

Então a linha fica **fora do alcance**: `assets_select` é `is_gestor()` e mais
nada, e o colaborador chega ao que é dele por `meus_comodatos()`, `security
definer`, que devolve o recorte sem as duas colunas. É a forma de
`usuarios_do_meu_cliente()` e de `meus_pedidos_de_nota()` — definer para
devolver só o agregado que aquela pessoa pode ver.

#### O que o banco garante, e não a tela

- **Um equipamento não está com duas pessoas.** O índice único é parcial —
  `asset_loans (asset_id) where data_devolucao is null` —, e **é ele a trava,
  não a consulta**: duas abas emprestando a mesma câmera passam pelas duas
  consultas antes de qualquer uma gravar. É a decisão da 0040.
- **O status do equipamento é escrito pelo EMPRÉSTIMO**, por
  `asset_loans_move_status`: entregar põe `emprestado`, devolver devolve para
  `disponivel` — ou para `manutencao`, quando o estado de devolução é `ruim`.
  **E ele não volta de `baixado` por engano:** um equipamento dado baixa não
  reaparece disponível porque alguém corrigiu uma data.
- **Atraso é DERIVADO, nunca coluna.** `data_prevista_devolucao < hoje` é uma
  pergunta que depende do dia de hoje, e uma coluna precisaria de uma rotina
  noturna para continuar verdadeira — no dia em que ela não rodasse, o painel
  mentiria sem avisar. É a mesma razão pela qual bloqueio de subtarefa não é
  status e atraso no Financeiro não é coluna.
- **O colaborador não edita, não empresta e não devolve.** Ele não tem policy
  de UPDATE em `asset_loans`; as duas coisas que ele faz —
  `confirmar_recebimento()` e `reportar_problema_do_comodato()` — são funções
  que escrevem **uma** coisa cada. Sem policy de UPDATE não há coluna a
  proteger por trigger.
- **Sem policy de DELETE em `assets`, e a ausência é a regra:** o caminho é dar
  baixa, com motivo. Apagar o equipamento levaria junto a folha dele, que é o
  valor do módulo — a mesma decisão de não apagar pessoa nem cliente com
  histórico. Emprestimo **devolvido** também não se apaga; o lançado por engano
  e ainda em aberto, sim.

#### A folha corrida do equipamento é tabela própria, e não o `audit_log`

`asset_events` guarda cadastrado, emprestado, devolvido, em manutenção, voltou
e baixado, com data, estado e quem registrou.

**A tentação é ler o `audit_log` da 0058**, que já grava `update` em
`assets` — e ela se desfaz em duas linhas: aquela trilha é **só do sócio**
desde a 0058, porque copia o trecho que mudou de `finance_entries`, e esta
folha é do colaborador e do desenvolvedor; e o que ela grava é o diff de
colunas, não o fato — reconstruir "emprestado à Carla" a partir de
`status: disponivel → emprestado` é reconstruir do lado errado.

**De quebra ela resolve o "reportar problema".** O sprint manda avisar a gestão
por notificação; um aviso é uma linha do sino, e o sino se apaga no primeiro
clique. Aqui o problema relatado vira evento na folha do equipamento, onde
quem for consertar procura.

**E ela é escrita por TRIGGER, nunca pela action** — pela razão da auditoria: o
empréstimo nasce por mais de um caminho, e um registro escrito na camada de
aplicação registra o que passou pela tela e perde o resto.

**A folha é ROTA e não diálogo** (`/painel/comodatos/{id}`), pela razão que põe
filtro na URL em toda listagem do produto: "olha a folha do FCK-0002" precisa
ser um link, e a pergunta que ela responde — *a lente sumiu, quem foi o último
a ficar com ela?* — é a que se faz numa conversa, com alguém do outro lado. E
ela é **da gestão**: o colaborador vê o que está e o que esteve com ele; a
folha mostra por quantas mãos a peça passou, que é informação sobre as outras
pessoas.

#### O termo é um SNAPSHOT, e não um arquivo guardado

`asset_loans.termo_corpo` copia o texto do modelo no instante da entrega, pelo
trigger `asset_loans_congela_termo`.

**SNAPSHOT** porque o modelo é editável pelo sócio, e um termo de comodato é o
que a pessoa aceitou naquele dia: mudar o texto não pode mudar o que ela
assinou. É a mesma decisão de `tasks.workflow_snapshot`.

**E NÃO UM ARQUIVO** porque o próprio sprint descreve o documento como vivo —
*"o aceite aparece no termo quando ele é baixado depois do aceite"*. Um PDF
gravado na entrega não tem como ganhar uma linha depois; teria que ser
regravado, e aí não é mais o que foi entregue. O PDF é montado **na hora do
download**, a partir do corpo congelado mais o aceite de agora. Por isso não há
coluna de endereço de arquivo nem bucket de termos: seriam um arquivo
desatualizado e um bucket que nada escreve.

**O modelo é UMA LINHA SÓ**, e é de propósito: o termo é da agência, não do
equipamento nem da pessoa. Um modelo por tipo de equipamento seria a segunda
pergunta que ninguém fez. **A chave é uuid e a trava é a coluna ao lado**
(`unica boolean` com `check` e `unique`) — a primeira versão usou `id boolean
primary key`, que é engenhoso e quebra `registrar_auditoria()`, que grava o id
da linha num `uuid`: *"invalid input syntax for type uuid: true"*.

**Só o sócio escreve o modelo**, pela razão da fila de notas: este texto é o
que a agência afirma sobre a propriedade do equipamento, e mexer nele é
decisão de quem responde por ela. Ler, a equipe inteira lê — é o que cada um
recebe junto com o equipamento.

**As variáveis são conferidas na tela ao lado, e o que não tiver valor sai como
"—"**, nunca com a chave crua: um termo impresso dizendo `{{SERIE}}` é um termo
que ninguém assina.

#### O aceite, e o que ele é

O empréstimo sem `aceito_em` aparece em destaque no cartão da pessoa, com o
termo e a lista de acessórios à mão — **é o que ela está aceitando**, e um
botão de confirmar acima de uma tela que não mostra o que foi entregue é um
botão que confirma o quê.

Confirmar grava a data, escreve o evento na folha e avisa quem entregou.
`notificar()` faz o resto: não avisa quem causou o aviso, não avisa quem saiu,
e devolve `null` sem derrubar a escrita quando não há a quem avisar — a lição
da 0062.

#### O alerta que custa dinheiro

O painel da gestão tem cinco cartões e **um alerta acima de tudo**, o único em
`--danger` da tela: equipamento em aberto com pessoa que saiu da agência.
Devolução atrasada é cobrança; equipamento com quem foi embora é prejuízo, e
por isso os dois não dividem a mesma cor.

**A pergunta é `profiles.ativo`**, que é o que o desligamento apaga — e é por
isso que **o seed traz alguém desligada**. Sem ela o cartão nasce em zero e o
alerta nunca aparece em desenvolvimento: o produto se mostraria no único estado
em que o caso mais caro do módulo não existe. É a lição da Óptica Visão sem
responsável de atendimento (0062), aplicada antes de o bug acontecer em vez de
depois.

#### Desligar alguém passa por aqui

No fluxo de desligamento (`/painel/pessoas/equipe/[id]`), a lista de vínculos
ganhou os equipamentos em aberto, e eles **não entram no total**: o total conta
o que é transferido, e equipamento não se transfere com um clique. O que há é
uma faixa em `--warning` com o link para Comodatos e uma caixa obrigatória —
*"sei do equipamento e vou cobrar"* — que solta o botão de continuar.

**Ela AVISA em vez de recusar**, e a escolha é a mesma de "função sem dono
avisa, nunca recusa" (0064): travar o desligamento por causa de uma lente
deixaria a agência sem conseguir desligar quem já foi embora. O que ela impede
é desligar **sem ver** — que é o caso de verdade.

Quem responde é `comodatos_em_aberto_de()`, `security definer`, porque
`desligarColaborador` roda com a chave de serviço.

#### A ficha técnica do equipamento

Migration 0070, decisão do usuário: *"quando vou cadastrar um equipamento,
quero poder preencher: Memória RAM, Processador, Placa de Vídeo e
Armazenamento"*.

**São QUATRO COLUNAS, e não um `especificacoes jsonb`.** A tentação do jsonb é
real — assim a câmera ganharia "megapixels" sem migration —, e ela se desfaz em
três pontos: são quatro campos **nomeados que o usuário pediu pelo nome**, e num
jsonb a tela inventa as chaves, até a segunda escrever `placa_video` onde a
primeira escreveu `placa_de_video` — sem erro de tipo, sem erro de banco, e com
o campo aparecendo vazio; o critério que separa jsonb de coluna neste produto
já está escrito, e é o de `post_versions.arquivos` — **jsonb é para o que se
escreve de uma vez e se lê inteiro, nunca consultado item a item**, e "quem está
com um notebook de 8GB?" é exatamente uma consulta item a item; e é a razão de
`midia` ter virado enum na 0042, porque o que a tela desenha por cima precisa
ser um nome que o compilador confere.

**E são `text`, não número.** O que se digita é "16 GB", "512 GB SSD", "1 TB
NVMe", "RTX 3060 6GB". Uma coluna numérica escolheria a unidade no schema e
perderia o "NVMe" e o "SSD", que é metade do que decide se a máquina serve. É a
decisão do tempo ao contrário: lá é `integer` em minutos porque há conta em
cima; aqui não há conta nenhuma.

**A TELA ESCONDE, O BANCO NÃO RECUSA.** Não existe `check` por tipo: ele
recusaria a mesa digitalizadora com processador próprio, e a recusa chegaria
como erro de banco numa tela de cadastro. Quem decide se o campo faz sentido é
quem está olhando o equipamento — e a bateria guarda o cenário que prova que o
banco aceita, para o dia em que alguém quiser "arrumar" isso com um check.

Na tela quem responde é `temFichaTecnica()`, e **são DUAS perguntas**: o tipo é
de computador, **ou** já há algo preenchido. Sem a segunda, trocar o tipo de um
notebook para "Outro" esconderia os quatro campos — e o próximo salvamento os
gravaria vazios, porque o formulário manda o que ele mostra. É a regra que
`ItemDoInventario` já carregava escrita por causa de `observacoes`: um
formulário que abre com o campo vazio apaga o que não mostrou.

**A ficha é uma SEÇÃO com título, e não mais quatro campos na grade.** Na grade
eles ficariam ao lado de "Número de série" e "Valor de aquisição", que são de
todo equipamento, e o cadastro de um tripé pareceria ter metade dos campos em
branco por descuido. Com o título, a ausência num tripé se lê como "não se
aplica".

**Na folha ela mostra só o que tem valor**, e fica ACIMA da linha do tempo: a
folha responde "por onde esta peça passou", a ficha responde "o que é esta
peça", e quem abre a página de um notebook para decidir se ele serve está
fazendo a segunda pergunta. "Placa de vídeo —" numa máquina de vídeo integrado
ocupa uma coluna para dizer que não há o que dizer; no formulário é o contrário,
porque lá o campo vazio é onde se escreve.

**E ela entra no CSV do inventário**, com as quatro colunas vazias na maior
parte das linhas de propósito: é uma planilha de inventário, e "quais máquinas
precisam de upgrade" é a pergunta que faz alguém anotar a RAM.

**A ficha fica do lado de dentro da trava de `assets`**, sem nenhuma linha
nova: `assets_select` é `is_gestor()` desde a 0069, e a coluna nasce na mesma
linha. O cenário da bateria existe para o dia em que alguém abrir a policy
achando que "especificação de máquina não é sigilo" — e levar o valor de compra
junto.

#### O que ficou de fora, e é decisão

- **Não há bucket de termos**, pelo motivo acima — o termo não vira arquivo.
  O bucket é um só, `comodatos-fotos`, privado como todos, com a pasta do
  comodato na frente do caminho.
- **As fotos são o que resolve discussão na devolução** — "a tampa já estava
  assim" —, e por isso o momento (`entrega` / `devolucao`) é coluna e não um
  prefixo no nome do arquivo.
- **A exportação em CSV sai do inventário e dos comodatos em aberto**, pelo
  `montarCSV` de `lib/dominio/csv.ts` — que deixou de ter seis donos no Sprint
  15 justamente para não ganhar um sétimo aqui.

### Feedback de desenvolvimento: um retrato do próprio trabalho

`feedback_reports`, `feedback_replies`, `workload_alerts` e `feedback_config` —
migration 0075. Cada pessoa da equipe recebe, periodicamente, o que entregou, o
que mudou em relação a ela mesma, onde há espaço para crescer e o que estudar
a seguir. O texto é escrito por IA; **todo número é calculado pelo banco.**

**ISTO NÃO É AVALIAÇÃO DE DESEMPENHO, e a frase mora em três lugares.** Não é
nota, não é ranking, não é insumo para decisão sobre promoção, aumento ou
desligamento — e se um dia for, a regra muda inteira e passa pelo jurídico
antes: a LGPD dá à pessoa o direito de pedir revisão de decisão automatizada
que a afete (Art. 20), e o módulo foi desenhado justamente para não produzir
uma. Ela está no cabeçalho da 0075 (que um refactor de tela não alcança), em
`lib/dominio/feedback.ts` (que quem mexe na tela lê) e **na própria tela de
quem gera** — porque é lá que a regra precisa ser lida. É a decisão do
vocabulário do Full Days na 0016 e na 0018: exposição jurídica se registra, não
se esconde.

#### As três regras, e a consequência de schema de cada uma

**1. Comparação só consigo mesma, ao longo do tempo.** Nunca com colegas, nunca
com média da equipe, nunca em ranking. Por isso `feedback_metricas()` recebe
UMA pessoa e devolve o período dela e o anterior dela — e **não existe função
neste módulo que devolva duas pessoas lado a lado**. A única média da agência
que aparece é a de CLIENTE (`clientes_com_retrabalho`), que é sobre a conta e
não sobre gente: quem atende uma conta que pede o dobro de rodadas não está
entregando pior.

**O período anterior tem o MESMO comprimento** e termina no dia antes do
início. Comparar um mês com um trimestre daria uma queda de volume que é só
aritmética — e o texto diria que a pessoa entregou menos.

**2. Os números crus viajam com o texto.** `metricas_json` e `contexto_json`
ficam na mesma linha, e a tela mostra os dois juntos, nunca atrás de um botão.
Texto sem número é opinião de máquina, e a pessoa não teria como conferir se a
IA leu certo. `PainelDeMetricas` é **um** componente para a gestão e para ela —
duas telas parecidas divergiriam no lugar mais caro: o que a agência olha antes
de enviar contra o que a pessoa vê depois.

**3. Revisão humana antes do envio, por padrão.** `feedback_config.exige_revisao`
nasce `true`, e o interruptor que o desliga carrega a consequência escrita ao
lado. **UM RASCUNHO VAZADO É PIOR QUE NENHUM FEEDBACK**: a policy da pessoa
exige `status = 'enviado'`, com o filtro explícito, e os cenários da bateria
guardam os CINCO status que não são esse — uma policy escrita como
`status <> 'rascunho'` passaria por um cenário só e deixaria `gerando`,
`revisado` e `descartado` vazarem.

#### A forma de cada conta é a da 0035, linha por linha

Metade das métricas já existia, e este módulo **não as reescreve onde elas têm
dono**: `carga_do_dia()`, `subtask_eh_agrupadora()`, `cliente_da_rodada()` e
`dias_uteis()` são chamadas. O que não dá para reaproveitar são
`producao_do_periodo()`, `desvio_de_estimativa()` e `qualidade_da_entrega()`:
as três são da AGÊNCIA e travam em `is_gestor()` na primeira linha, e a
pergunta daqui é de uma pessoa. **O que se copia delas é a FORMA** — taxa no
prazo com o mesmo denominador, etapa sem prazo fora da conta, desvio em pontos
percentuais sobre a estimativa, folha e nunca agrupadora —, porque duas contas
com formas diferentes fariam a tela de Métricas e o feedback discordarem sobre
a mesma pessoa no mesmo mês.

**`carga_do_dia()` GANHOU UM TERCEIRO ARGUMENTO, e não uma irmã.** Ela conta as
etapas EM ABERTO cujo período cobre o dia, e está certa — a pergunta dela é a
do calendário e da Home. Num período que já passou toda etapa está concluída,
então ela devolvia zero, e o contexto lia 0% da capacidade e emitia a ressalva
de ociosidade para quem entregou o mês inteiro: **um texto dizendo à pessoa que
a entrega baixa dela foi distribuição de trabalho, num mês em que ela entregou
tudo.** Foi a bateria que achou. Duas funções de carga dariam dois números para
a mesma pessoa no mesmo dia, que é o que o comentário da 0035 existe para
impedir; o parâmetro tem default `false`, então nenhum chamador existente mudou.
O `drop` antes é obrigatório: `create or replace` com outra lista de argumentos
cria uma SEGUNDA função, e a chamada de dois argumentos fica ambígua.

**E a proporção da capacidade se declara INCERTA em vez de devolver um número
baixo.** Num período em que ninguém preencheu estimativa, ela voltava 0% e
acusava ociosidade de quem entregou — é a regra de `receita_por_hora` na 0035:
zero é uma afirmação sobre a conta, e o que se quer dizer é que ninguém mediu.
Nula, o prompt não fala de carga, que é melhor que falar errado.

#### O contexto é a metade que evita o dano

Ausência, carga contra capacidade, tempo parado esperando aprovação (interna e
do cliente, separados), e cliente que pede mais rodadas que a média. Os números
de entrega, sozinhos, cobram de quem recebeu 140% da capacidade e de quem
esteve fora metade do mês.

**`ressalvas` são frases prontas, em português**, e é de propósito: a
alternativa seria mandar os números e confiar que o modelo os interprete na
direção certa. Elas só nascem quando o fato existe — uma lista de ressalvas em
toda geração viraria um parágrafo de desculpas em todo feedback.

#### O prompt pede; a verificação confere

**O prompt não é uma trava. Ele é um pedido muito bem escrito.** Quem confere é
`verificarOTexto()` em `lib/dominio/feedback.ts`, e as duas existem de
propósito — a decisão da máquina de estados da subtarefa ao lado dos triggers
da 0007: uma escreve a instrução, a outra é a que vale.

Quatro famílias que dá para conferir por máquina (comparação com terceiros,
julgamento de caráter, elogio vazio, nota ou conceito), mais **todo número
citado tem que existir nos dados** e o tamanho do texto. **A quinta — "no
máximo dois pontos de melhoria" — NÃO está, de propósito:** não existe jeito
honesto de contá-los num texto corrido sem cabeçalho de seção, e uma checagem
que acerta às vezes treina quem revisa a ignorar os alertas todos. Essa fica
para quem lê, que é o papel da revisão humana.

**NADA DESCARTA EM SILÊNCIO.** Todo achado vira frase em `alertas_json` e
aparece em destaque na tela de quem revisa. Um descarte silencioso gastaria uma
chamada de IA e não deixaria nada para investigar.

**`npm run check:feedback` é a prova**, e ela existe pela razão do `check:email`
e do `check:preview`: uma trava que, quando some, faz o programa fazer MAIS
coisas não derruba build, não derruba tipo, não derruba a bateria de SQL e não
aparece em imagem de protótipo. Tirando uma família de termos, tudo continua
verde — e a primeira notícia é alguém lendo, sobre si mesma, que entregou menos
que a equipe. Ela mede **os dois sentidos**: o primeiro caso é um texto limpo,
que tem de sair com zero achados, senão uma função que acusa sempre passaria em
todos os outros. E ela achou um bug na primeira rodada — a parte inteira do
número era `\d{1,3}`, o que parece certo porque o milhar vem com ponto, e com
o teto de três dígitos `2400` não casava com nada: a checagem mais valiosa da
lista ficava cega justamente para os números de minuto.

#### A geração é da gestão, por botão — e o porquê fica registrado

O sprint manda isto para uma Edge Function chamada pela rotina agendada. **Não
há Edge Functions neste projeto**, e o Postgres não fala HTTP: as rotinas do
`pg_cron` chamam RPC do PostgREST, e nenhuma delas alcança a API da Anthropic.
A chamada mora no Next, na forma de `lib/email/`, e o que falta para a geração
periódica é **a URL do app** — a mesma pendência que deixa o rodapé do painel
dizendo "versão local" desde que a VPS saiu. No dia em que houver o endereço,
isto vira uma linha em `scripts/rodar-rotinas.sh`.

**A linha nasce em `gerando` ANTES da chamada**, e é isso que faz o índice
único `(user_id, periodo_inicio, periodicidade)` ser a trava: duas abas
clicando ao mesmo tempo passariam pelas duas consultas antes de qualquer uma
gravar (0040), e aqui o custo de errar é uma chamada de IA paga duas vezes pelo
mesmo texto. Quando a chave falta ou a API recusa, a linha **volta para
`rascunho`** em vez de ficar presa em `gerando` — um relatório parado nesse
estado é um que ninguém consegue abrir nem apagar sem entender por quê.

**As três travas do sprint, e uma delas não recusa.** Menos etapas que o mínimo
vira `dados_insuficientes` COM linha — ela diz que o período foi olhado e não
tinha o que dizer, e sem ela "não gerou" e "não olhou" ficariam iguais. Quem
optou por não receber é pulado, sem linha nenhuma. **Ausência acima de 40% do
período NÃO impede**, e é decisão entre as duas saídas que o sprint oferece: o
contexto já carrega a ressalva e o prompt já manda mencionar a ausência ao
falar de volume. Recusar deixaria quem tirou descanso sem retorno nenhum sobre
o mês, que é o oposto do que o módulo existe para fazer.

**`modelo_usado` e `prompt_versao` são por relatório**, e não configuração
global: o modelo troca, o prompt é reescrito, e o relatório de março precisa
continuar dizendo quem o escreveu. **Suba `PROMPT_VERSAO` sempre que mexer no
texto do sistema** — uma versão que não acompanha é pior que versão nenhuma.

**`texto_gerado` e `texto_final` são DUAS colunas**, e juntá-las destruiria a
única coisa que permite auditar a revisão: o que a IA escreveu. A edição é o
normal, não a exceção.

#### O que a tela da pessoa faz, e onde ela fica

**Na tela Início, e não numa aba de outro módulo** — decisão do usuário. O
sprint a punha dentro do módulo que saiu do produto na 0043, por decisão dele
também. O ganho não é de rota: um retrato do próprio trabalho num módulo que
ninguém abre por hábito é um retrato que ninguém lê.

A ordem é **texto → assinatura → números**: o texto é o que ela veio ler, e
conferir vem depois de ler — a decisão do detalhe do material no Portal, onde a
arte vem antes dos botões. A linha honesta não é letra miúda: sem ela a pessoa
leria um texto sobre si mesma sem saber que uma máquina o escreveu, e
descobriria depois.

**Responder não é opcional: feedback sem direito de resposta é comunicado.** A
resposta notifica quem revisou e fica no histórico — e **não se edita nem se
apaga, nem pelo sócio**, porque ela é o registro de que a pessoa discordou.
Reescrevê-la apagaria a discordância, pela razão de a rodada de aprovação
fechada nunca ser reescrita.

**E a escolha de não receber passa por uma função do banco**, não por um
`update` em `team_members`. Aquela tabela é `is_gestor()` no UPDATE desde o
Sprint 2, então `recebe_feedback_ia` nasceu inalcançável por quem ela é para —
a pessoa marcava "não quero receber", o update passava sem erro e sem linha, e
ela continuava na fila. Foi a bateria que achou. Abrir uma policy ali daria
junto a capacidade diária, o saldo de descanso e a função dela: policy não
limita coluna. São duas funções que escrevem UMA coluna da própria linha, a
forma de `confirmar_recebimento()` na 0069 — e cada uma só alcança a linha de
quem chama, senão `security definer` seria a porta que desliga o feedback do
colega.

#### Os alertas de carga são da gestão, e a pessoa não os vê

É provavelmente o retorno mais valioso do módulo: **quando alguém entrega
menos, quase sempre o sistema sabe por quê — e a resposta costuma estar na
distribuição de trabalho, não na pessoa.** Um alerta de sobrecarga na tela dela
viraria cobrança por uma decisão que não foi dela; o que é dela chega pelo
feedback, relativizado.

`sobrecarga` exige DOIS períodos seguidos acima de 110%, e a segunda condição é
o que separa um alerta de um ruído: um mês apertado é normal numa agência, dois
seguidos é uma decisão de distribuição que ninguém revisou. `ociosidade` não
exige dois — entrega baixa por falta de trabalho atribuído é um problema no
primeiro mês. Eles são escritos por SQL e não pela IA, e por função e não por
trigger: não há escrita que os dispare, eles nascem de uma pergunta sobre um
período. `--warning` e nunca `--danger`, porque nenhum dos quatro é um erro.

**A frase vem junto do nome do tipo**: "Carga baixa" ao lado do nome de alguém
lê como cobrança, e o alerta existe para dizer o contrário.

#### A transparência vem antes

`/painel/feedback/sobre` é de toda a equipe, e tem entrada própria em
`permissions.ts` — sem ela, `findMenuItem` casaria a rota com `/painel/feedback`,
que é `GESTAO`, e devolveria 403 a quem o módulo existe para servir. O mesmo
vale para `/painel/feedback/configuracoes`, que é do sócio: sem a entrada, o
desenvolvedor abriria a configuração.

**A primeira coisa que ela diz é o que o feedback NÃO é**, e não o que ele é:
quem abre aquela página está com essa dúvida, e deixar a resposta para o quarto
parágrafo é deixar a pessoa ler os três primeiros desconfiando. **E a lista do
que NÃO é usado é tão importante quanto a do que é** — sem ela, "dados do
sistema" é uma frase que a pessoa preenche com o pior que ela imagina. Um módulo
assim só funciona se as pessoas confiarem nele, e confiança se ganha explicando
antes, não depois.

#### O que a trilha da 0058 NÃO pega

`feedback_reports` fica fora do `audit_log`, e a ausência é decisão: a trilha
copia o trecho que mudou, e aqui o trecho É o texto do feedback — ela viraria
uma segunda cópia de cada rascunho descartado, numa tabela que a própria pessoa
não alcança. Quem revisou, quando, e quando enviou já moram na própria linha. É
a razão pela qual `approval_rounds` também ficou de fora.

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
colaborador manda para a agência pagar — e desde a 0065 ele é tela de verdade,
com a despesa caindo aqui quando o sócio marca a nota como paga.

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
ciclo continua no seguinte. Quem entrou há três anos e nunca parou tem 45 dias
— três ciclos completados, e o quarto está correndo.

- `ciclos_de_descanso()` conta os ciclos, `inicio_do_ciclo()` diz quando o
  atual começou, e `saldo_de_ferias()` **perdeu o parâmetro de ano**. A âncora
  é `data_admissao`; sem ela, `created_at` da ficha.
- **OS 15 SÃO CONQUISTADOS NO FIM DO CICLO, e não na abertura dele** (migration
  0074, decisão do usuário: *"entrou hj, nn tem dias disponíveis - fez 12
  meses, ganha 15 dias, fez 24 meses, ganha mais 15 dias"*). Quem entrou hoje
  tem **zero** — zero dias, zero parcelas —, e o primeiro bloco entra no
  primeiro aniversário.

  **A 0039 tinha escolhido o contrário, e registrou a escolha.** O comentário
  dela dizia que havia duas leituras de "a cada 12 meses soma 15", que ela
  ficava com a da abertura, que **para inverter era o `+ 1` de
  `ciclos_de_descanso()`** e que a bateria tinha o cenário que avisaria. Ele
  avisou: era *"Quem entrou hoje já está no ciclo 1"*, e hoje ele é o mesmo
  cenário virado do avesso. Devolvendo o `+ 1`, **32 cenários caem** — a regra
  está medida no módulo inteiro, não só na sentinela.

- **A recusa do primeiro ciclo diz a DATA, e não os três números.** *"Você já
  tem 0 comprometidos, então sobram 0"* é verdade e não ensina nada: quem lê
  não sabe se é a regra, um cadastro errado ou um defeito. `proximo_descanso_em()`
  nasceu para a frase poder dizer *"os seus primeiros 15 dias chegam em
  28/05/2027"*, e é a decisão da recusa da 0023 nomear cada etapa em vez de
  dizer "há etapa sem aprovação". A dica manda para onde não depende de saldo:
  ausência pontual e afastamento.
- **E a tela do primeiro ciclo troca de forma, não de número.** O título vira a
  data, a barra de uso **some** — a zero ela pede para ser lida como "você já
  usou tudo", que é o contrário do que está acontecendo —, "Saldo depois" sai
  do resumo, e o envio desliga com **um** aviso só. Sem o `!primeiroCiclo` nos
  dois derivados, quem entrou este ano veria três recusas empilhadas para um
  motivo só, que é a tela parecendo quebrada.
- **Sem ficha, zero ciclos** — e até a 0074 era um, com o argumento de que "uma
  ficha incompleta não pode deixar a pessoa com zero dias". Ele valia enquanto
  o primeiro ciclo já vinha concedido; agora zero é o estado normal de quem
  chegou, e dar um ciclo a quem não tem ficha daria a ela mais do que quem tem.
- **O lançamento retroativo continua passando**, inclusive no primeiro ano: a
  gestão registra o descanso combinado por fora, o saldo fica negativo, e isso
  é a verdade. `validar_solicitacao` devolve antes da conta de saldo quando a
  origem não é `solicitacao`.
- **`inicio_do_ciclo()` parou de repetir a conta.** Ela calculava os
  aniversários por conta própria com o mesmo `age()`; sem o `+ 1` os dois
  números passaram a ser o mesmo, e duas cópias da mesma conta é onde as duas
  verdades começam a divergir.
- **E o seed ganhou alguém no primeiro ciclo**, com data relativa e não
  literal: depois da 0074 "pessoa sem nenhum dia" é o estado de todo mundo por
  doze meses, e com todas as fichas passadas de um ano o ambiente de
  desenvolvimento mostraria o produto no único estado em que essa tela não
  existe. É a lição da Óptica Visão (0062) e da pessoa desligada (0069). A data
  é relativa porque uma fixa deixa de ser o primeiro ciclo sozinha, daqui a
  alguns meses, sem ninguém tocar no arquivo.
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

> **O que isto custa, e foi dito a quem decidiu, duas vezes:** ciclo de 12
> meses contado da entrada da pessoa é, **estruturalmente**, o desenho do
> período aquisitivo da CLT — mais parecido com ele que o ano civil, não
> menos. E a 0074 aproxima mais um passo, porque conceder só quando o ciclo se
> completa **é** o período aquisitivo. A nota do fim desta seção já dizia que o
> vocabulário reduz o risco e a estrutura é o que uma perícia olha. As duas
> decisões foram tomadas assim mesmo, por quem responde pela exposição. Quem
> for mexer nisso de novo, mexa sabendo disso — e a inversão continua sendo uma
> linha só.

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

- **O saldo ABRE a tela, numa faixa em `--action-soft` com a frase inteira**
  ("Você tem 5 de 15 dias disponíveis") e a barra de uso ao lado. Ele era um
  cartão no painel lateral, e era preciso varrer o olho até a coluna da
  direita para achar a primeira coisa que quem entra ali quer saber. Quem pede
  afastamento ou ausência pontual não vê saldo nenhum — não desconta. (Ele era
  `--blue-soft`, o ciano, e passou ao royal quando a ação do produto passou: o
  ciano ficou reservado ao símbolo e aos acentos de marca.)
- **O CALENDÁRIO FICA À ESQUERDA e a configuração na coluna de 306px** — e
  isto desfaz uma decisão minha. A versão anterior punha o painel à esquerda
  com o argumento de que *"o tipo de pedido muda o que o calendário
  significa"* — descanso conta corrido, os outros contam útil —, e queria que
  a regra fosse lida antes das datas. O que ela não notou é que isso deixava o
  Full Days sendo o **inverso** das outras telas do produto: em Minhas Tasks e
  no Início a peça grande é a da esquerda e o resumo é a coluna estreita da
  direita, e aqui a peça grande é justamente o calendário. **E a regra não
  depende mais da posição para ser lida**, que é o que torna a inversão
  barata: o tipo é o primeiro bloco da coluna, os três cartões dizem por
  extenso se descontam, e a faixa de saldo acima das duas colunas já respondeu
  a pergunta antes de qualquer clique.
- **Empilhadas, a configuração vem PRIMEIRO** (`order-first lg:order-none`), e
  as duas metades da decisão são diferentes: em duas colunas o olho começa na
  esquerda; empilhadas não há esquerda, há em cima — e em cima tem que estar o
  que decide o que o calendário significa, mais o resumo do que já foi
  escolhido. Com o calendário em cima ele rola dentro de si mesmo e o resumo
  fica longe do polegar, que é a decisão da prévia da recorrência.
- **O tipo de pedido é um `radiogroup` de três cartões EMPILHADOS**, cada um
  dizendo embaixo do nome se desconta e quanto (`desconta (15d)` / `não
  desconta`). Um `<select>` escondia exatamente a informação que faz a pessoa
  escolher entre os três, e ela é diferente por tipo — e três cartões lado a
  lado na coluna de 306px dariam noventa pixels cada, truncando justamente
  essa linha e deixando só a palavra do tipo, que é a parte que não explica
  nada.
- **A pílula com degradê só aparece quando o botão está DE PÉ.** Desabilitada,
  o `opacity-50` a deixava num azul claro que se lê como "ação principal em
  repouso", e não como "não dá"; quando não dá, ela volta a ser um botão cinza
  chapado — a forma que o produto inteiro usa para dizer isso.
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

#### O resto do módulo na interface aprovada

Quarta tela do redesenho, depois dos tokens, de Minhas Tasks e do Início — e a
primeira em que ele encosta num módulo de cinco seções. O que mudou, fora as
duas colunas de "Propor período" que já estão acima:

**A MATRIZ CONTINUA EM UMA COLUNA, e é decisão.** Ela é larga por natureza —
trinta e uma colunas de dia mais os totais —, e uma coluna de 306px ao lado
tiraria dela exatamente o que ela precisa. O que muda é que a barra de
controle (mês, legenda, CSV) virou cartão: solta na página, ela lia como
coisas que sobraram acima da grade.

**E a grade continua `overflow-x-auto`, NUNCA `overflow-hidden`.** Arredondar
as pontas com `hidden` é a tentação óbvia e cria um novo scrollport: a coluna
de nomes, que é `sticky left-0`, passa a se medir por ele e sai da tela junto
com os dias. Foi o que a Linha do Tempo do Calendário Full pagou, com "Carla
Nunes" lida como "nes". `auto` arredonda igual e é o scrollport de verdade.

**A régua de cobertura NÃO mudou, e a proposta errou sobre ela.** Eu escrevi
que ela "vira linha da área" — ela já era: desde o Sprint 6 a linha de
cabeçalho de cada área carrega o número de quem está fora em cada dia, pela
mesma `coberturaDaArea()` e com o mesmo limiar do calendário de pedido. Fica
escrito porque o erro é o da maquete contra o produto, e a maquete é o que
alguém lê depois.

**Na fila de pedidos, os dois botões DESCERAM para o pé do cartão.** Eles
ficavam numa coluna à direita, na altura do NOME — ou seja, ao lado do aviso
de quem da mesma área já está fora, e não abaixo dele. A informação que decide
um "preciso remarcar" é exatamente esse aviso, e um botão que divide a linha
com ele pode ser clicado sem que ele tenha sido lido. (Aqui também corrijo a
proposta: ela dizia que o aviso "vivia fora do cartão", e ele estava dentro
desde o Sprint 6 — o que estava errado era a altura dele, não o lugar.)

**O Relatório trocou o `Indicador` local pelo `CartaoDeNumero` compartilhado.**
Era a terceira forma do mesmo cartão no produto, e já tinha divergido: o
rótulo dela é `--text-muted` fixo, que é justamente o par que a varredura de
acessibilidade reprovou sobre fundo tingido. Com o componente, o tom decide a
cor do rótulo junto — e "Esperando decisão" ganhou o tom de atenção e virou
link para a fila, porque o número era um beco: a pessoa lia "3" e voltava ao
menu para chegar na tela que resolve os três.

**E o alerta de quem está há mais de um ano sem parar passou a `--warning`.**
Ele era `--danger`, e a troca é a regra do produto aplicada onde ela faltava:
vermelho é erro, e uma pessoa há um ano sem descanso não é um erro — é um
risco de entrega e de esgotamento que alguém precisa combinar. Numa tela que
se abre uma vez por semana, vermelho permanente treina o hábito de ignorar
vermelho, que é a razão pela qual o alerta de 7 dias do portal e os quatro
sinais de carga do Feedback também são âmbar.

**"Registrar período" recebeu a MESMA inversão de "Propor"**, e é por isso que
ela vale lá: as duas telas são a mesma composição com o calendário recusando o
lado oposto do tempo — lá o passado, aqui o futuro. Se uma tivesse a coluna
estreita à esquerda e a outra à direita, trocar de aba reorganizaria a tela
debaixo de quem está no meio de um registro.

**O cartão "Quem já está fora" é a única peça nova, e não custa consulta.**
`bloqueados` é o mapa dia → nomes que o calendário já recebe para pintar de
âmbar; o cartão é o mesmo dado lido por PESSOA, com o intervalo dela. Ele
existe porque em 390px a célula tem cerca de 45px: "Marina" vira "Ma…", e
truncar não identifica ninguém — o dia fica só em âmbar e o nome mora ali. No
desktop ele continua servindo, porque quem vai propor uma semana lê a lista
antes de clicar em vez de descobrir a recusa no arrasto. *O que ele não sabe,
e é dito:* dois períodos separados da mesma pessoa no mesmo mês se leem como
um só — guardar cada bloco exigiria a data de início e de fim de cada pedido
alheio, informação que esta tela não tem e não deve ter.

**O vocabulário não mudou em nenhuma das cinco.** Descanso, afastamento,
ausência pontual, sem alocação, "de acordo" e "preciso remarcar" — a decisão
da 0016 e da 0018 continua inteira, e uma mudança de layout não é lugar de
desfazê-la.

#### As três áreas de trabalho: Gestão de Tasks, Social Media e Campanhas

Quinta camada do redesenho, depois dos tokens, de Minhas Tasks, do Início e do
Full Days — e a primeira em que ele encosta nas telas onde a agência produz.
O que mudou em cada uma, e o que **não** mudou.

**A COLUNA ESTREITA MUDA DE LADO CONFORME O QUE ELA É**, e esta é a regra que
faltava escrever. Em Minhas Tasks, no Início e no Full Days os 306px ficam à
**direita**, porque ali eles são um RESUMO — o cronômetro, os contadores, quem
está fora: coisas que acompanham o que a pessoa veio fazer. No Social Media a
coluna estreita fica à **esquerda**, porque ali ela é o ÍNDICE, e o índice é
por onde se entra. Invertido, o mês abriria com um editor vazio ocupando a
esquerda e a lista de posts no canto — a tela pedindo uma escolha com a escolha
fora do caminho do olho.

##### Gestão de Tasks: os números viram uma linha, e a coluna perde a caixa

**Os três contadores eram três ladrilhos com número grande** em cima do board,
gastando noventa pixels da primeira dobra da tela mais cheia do painel — e o
board é a peça. Viraram uma linha de texto: *"5 abertas · 2 atrasadas · ver
quais · 1 concluída no mês"*. É a decisão do Início aplicada de novo — a lista
logo abaixo É esses números, então eles não viram cartão.

**E a linha ficou DENTRO da aba, e não no subtítulo do cabeçalho**, que era
onde a proposta a punha. O cabeçalho é das quatro seções, e os números nascem
da mesma chamada que a lista: subi-los pediria uma segunda consulta para
desenhar três números quarenta pixels acima — e dois lugares contando a mesma
coisa é exatamente o bug que este contador já teve duas vezes, as duas
encontradas pelo usuário.

**A COLUNA DO BOARD PERDEU A CAIXA.** Ela era um retângulo cinza com fio, e o
que se lia primeiro era o retângulo; sem ele, o que se lê primeiro é cada
demanda, que é a unidade sobre a qual alguém decide. O que fica é o cabeçalho
com o nome e a contagem — e um realce de fundo **só durante o arrasto**: sem o
chão permanente, o alvo precisava de outro jeito de se anunciar, e ele só
existe quando há um card no ar.

**A faixa de prioridade do card foi de 1px para 4px** pela mesma razão. Ela era
um fio contra o fundo cinza da coluna; com o cartão solto sobre a página, o fio
sumia. Em 4px ela é a mesma borda à esquerda que a linha atrasada de Minhas
Tasks usa.

**O PAR DE DATAS VIROU UM CHIP "Prazo"**, e com ele a barra de filtros cabe numa
linha só. Eram dois rótulos e dois `<input type="date">` de 144px cada — 320
pixels e uma faixa inteira da primeira dobra para um recorte que quase ninguém
usa, acima da peça que todo mundo veio ver. *O que se perde, e é dito:* as datas
deixam de estar à vista e pedem um clique. O que impede isso de virar um filtro
invisível é o **rótulo** — com valor, o chip para de dizer "Prazo" e passa a
dizer "12/03 → 20/03", aceso. É a regra da faixa de áreas de Minhas Tasks: quem
recolhe continua dizendo o que tem dentro, senão não é recolher, é esconder.

**E ele é local, não uma prop nova da `FilterBar`.** Aquela barra é de sete
telas, e um par de datas embutido nela seria um campo que seis não usam — a
razão pela qual o "Prazo" entra por `children`, que é a porta que ela já tem. O
popover tem "Limpar o prazo" próprio, porque o "Limpar filtros" da barra derruba
os quatro selects junto e quem abriu o popover veio mexer numa coisa só.

##### Social Media: a lista solta e a corrente com ladrilho

**Cada post é um cartão solto**, e não uma faixa dentro de uma caixa com fios —
o argumento da lista de Minhas Tasks: num contêiner único o que se lê primeiro é
a CAIXA, e aqui cada linha é um trabalho separado, com dono e data próprios. O
cabeçalho de cada grupo (Comigo / Esperando alguém / Fora das minhas mãos) virou
o mesmo rótulo em caixa alta do board.

**A CORRENTE VIROU CARTÕES COM LADRILHO DE ÍCONE**, que é o desenho do "Precisa
de mim" da Home aplicado onde ele cabe melhor: cada elo é o trabalho de uma
pessoa diferente. O círculo de 24px virou ladrilho quadrado de 32px, e o azul
dele passou a ser o par nomeado `bg-action-soft text-action-text` — o royal de
ação, como o resto do produto desde a troca de cor.

**A razão do "Enviar ao cliente" desligado virou uma PÍLULA ÂMBAR.** Ela é a
única coisa na tela que explica por que o botão mais importante do módulo está
desligado, e em cinza, ao lado de um botão cinza desabilitado, lia como legenda
do botão em vez de resposta. `--warning` e nunca `--danger`: falta um passo, não
há erro nenhum.

**E ela mostrou uma consulta que ninguém desenhava.** `faltaParaEnviar(post)`
era calculada no editor e a única linha que a citava era um
`? null : null` — código que sempre rende nada. Quem nomeia o que falta é
`envio.porque`, montado pela mesma função um nível acima; a variável local saiu.

##### Campanhas: o grupo vira rótulo, e o progresso sobe para o cabeçalho

**A IDENTIDADE DA CAMPANHA VIROU UMA LINHA.** A capa ocupava a largura inteira
com 160px de altura e empurrava a barra de progresso — que é o número que a
pessoa veio ver — para baixo da dobra num notebook. Agora é capa à esquerda,
cliente/período/status e progresso na coluna ao lado, na mesma altura.

**A capa é `quadrada` aqui e `larga` no cartão da grade, e as duas continuam
sendo o MESMO componente** — o que muda é a proporção que cada tela pede, não o
desenho. Numa faixa 16/6 de 150px de largura a imagem teria 56px de altura, que
não reconhece campanha nenhuma.

**E A LINHA NÃO EMPILHA NO CELULAR, ao contrário de quase tudo neste produto.**
A primeira versão empilhava, e a imagem de 390px mostrou o preço: a capa
quadrada ocupa a largura inteira, fica com uns 330px de altura, e a barra de
progresso volta para baixo da dobra — o mesmo problema de antes, só que pior,
porque agora a imagem é maior. A capa encolhe para 96px e a linha continua sendo
uma linha: uma composição só, uma proporção só, em toda largura.

**O GRUPO DE ENTREGÁVEIS VIROU UM RÓTULO, e a PEÇA virou o cartão.** Antes o
grupo era uma caixa grande com as peças dentro, e o que se lia primeiro era a
caixa — mas **ninguém decide sobre um grupo**: ele não recebe arquivo, não tem
versão e o status dele é derivado dos filhos desde a 0033. O que ganha borda e
sombra é a unidade sobre a qual alguém age.

**O RECUO FICOU, e a proposta tinha tirado ele.** O rótulo diz onde o grupo
COMEÇA e não diz onde ele TERMINA, e a imagem mostrou o preço: o "Tabloide", que
é uma peça de topo, caía logo abaixo do sexto Feed/Story com o mesmo espaço
entre eles, e lia como o sétimo item de um grupo cujo rótulo diz seis. O que
voltou é um **fio à esquerda**, e não a caixa: sem topo, sem fundo, sem cor de
fundo e sem sombra, ele fecha o grupo dos dois lados sem devolver o retângulo
que se lia antes das peças.

##### O que NÃO mudou, e é decisão

- **O board continua arrastando, e o cartão continua sem selo de status** — a
  coluna carrega o status, o card não repete. A decisão é do Sprint 10.
- **A lista de Social Media continua agrupando por QUEM ESTÁ SEGURANDO**, e não
  por status: é o que faz a mesma tela servir aos três perfis internos.
- **O seletor de visão continua menor que a barra de contexto**, em Gestão de
  Tasks. Com o mesmo peso a pessoa leria "Demandas / Workflows" e "Board /
  Lista" como duas metades da mesma escolha.
- **Nenhuma consulta mudou, e nenhuma migration entrou.** As três áreas são
  layout — a mesma propriedade que fez as 63 telas mudarem por token.


#### O Portal do Cliente na identidade "Leve"

Sexta camada do redesenho, depois dos tokens, de Minhas Tasks, do Início, do
Full Days e das três áreas de trabalho — e a última que faltava, porque o
Portal é a área que a equipe nunca abre. **Ele estava dois desenhos atrás:**
abas sublinhadas, títulos em 24px semibold, cartões de raio pequeno sem
sombra. Quem atravessava do painel para o portal do cliente trocava de
vocabulário visual sem nada ter mudado de natureza.

**A NAVEGAÇÃO VIROU A PÍLULA DA `BarraDeContexto`.** As duas navegam entre
SEÇÕES — cada uma com outra consulta, outro conteúdo, e trocar é trocar de
página no servidor —, e eram dois desenhos para a mesma coisa: é o argumento
das sete cópias de `abas.tsx` atravessando a fronteira entre as duas áreas.

**O componente continua sendo OUTRO, e é de propósito.** A `BarraDeContexto`
carrega o `<h1>` `sr-only`, o selo de contagem e as ações do módulo, e decide a
seção por `?aba=`; aqui cada seção é uma ROTA, o título mora no cabeçalho de
cada tela, e o cliente não tem ação de módulo nenhuma. Reaproveitá-la seria
carregar quatro parâmetros que este lado não usa para herdar oito classes. **O
que se compartilha é o desenho; o mecanismo é diferente porque a coisa é
diferente.**

**OS TRÊS LADRILHOS DE NÚMERO DA TELA INICIAL VIRARAM UMA LINHA.** Eles
ocupavam a primeira dobra com "2" num tamanho enorme — e a lista logo abaixo
**É** esses dois materiais, item por item. É o cartão de "11 entregues" com
sete na lista embaixo, que o Resumo da Agência já pagou uma vez, e a mesma
decisão que o Início do painel tomou ao recusar o ladrilho de "5 esperando
você". Hoje é *"**2** materiais esperando decisão · 1 em produção · 3 aprovados
no mês"*, no subtítulo.

**Cada material é um cartão SOLTO**, com 9px entre eles, e não uma faixa dentro
de um contêiner com fios: cada linha é uma decisão separada, e num contêiner
único o que se lê primeiro é a CAIXA. **"Atividade recente" continua sendo o
contêiner com `divide-y`**, e a exceção é a regra vista do outro lado — ela é
um registro do que já aconteceu, não um conjunto de decisões: ali a caixa é o
que se lê, e está certo.

**O calendário, o visualizador de arte e o histórico de versões ficaram como
estavam.** Os três são moldura para conteúdo, não cartão — dar sombra e raio a
eles seria transformar o quadro em objeto e a arte em recheio.

##### E depois a CASCA inteira virou a do painel

Relato do usuário, olhando o resultado da camada acima: *"quero que o portal do
cliente tenha o layout mais parecido com o restante da plataforma"*. Ele estava
certo, e a distância que sobrava não era de cor — a paleta já era a mesma. Era
de MOLDURA, e ela cabe numa tabela:

| | Painel | Portal, até aqui |
| --- | --- | --- |
| A malha de cor no topo | 190px atrás de tudo | não existia |
| A topbar | 64px, sem fundo e sem fio | dentro de uma faixa branca com borda |
| O sino e o avatar | discos de vidro | botões chapados |
| A largura | `max-w-6xl` | `max-w-5xl` |

As quatro passaram para cá, e **foi escolha entre três propostas**. A malha é a
mesma `.malha-do-painel`, em 170px — a altura da topbar mais a barra de seções,
como lá ela cobre a topbar mais o título grande. O par de tokens sobre ela já
era medido pelo `check:cores` desde a interface Leve, então nenhuma linha nova
foi precisa: quem escreve na malha aqui são os mesmos `--text-primary` e
`--text-secondary` das pílulas.

**A MALHA MORA NO INVÓLUCRO DE DENTRO, e não no de fora.** É a mesma razão pela
qual no painel ela vive na coluna de conteúdo e não no `body`: lá a barra
lateral tem fundo próprio e a malha apareceria nas bordas dela; aqui a faixa da
visualização administrativa é `sticky top-0`, e uma malha no invólucro de fora
gastaria os primeiros 60px dela atrás de um fundo âmbar.

**A topbar é ALINHADA AO CONTEÚDO, e a do painel não é.** Lá ela vai de ponta a
ponta da coluna, porque a barra lateral já encosta o conteúdo à esquerda; aqui,
sem barra lateral, o logo ficaria na borda de uma janela de 1440 e os cartões
começariam 144px adentro. É a decisão da capa do cliente e a da barra de
contexto, pela terceira vez.

**A barra de seções NÃO GRUDA**, e é a única coisa desta casca que não copia a
`BarraDeContexto`. Duas razões, e as duas são daqui: as listas do portal são
curtas — dois materiais esperando, três campanhas —, e não as quarenta demandas
que fizeram a barra do painel grudar; e a faixa da visualização administrativa
já é `sticky top-0`, então duas coisas presas no mesmo lugar seriam uma
cobrindo a outra.

**A grade de campanhas ganhou a terceira coluna**, e é consequência da largura e
não gosto: em `max-w-6xl` com duas colunas cada cartão fica com 560px para uma
faixa de imagem 16/6, e três campanhas deixavam a terceira sozinha numa linha.

**A casca simples da gestão** — a bifurcação de `/portal`, que não é o portal de
ninguém — recebeu a mesma pele. Sem isso ela seria o terceiro desenho da mesma
plataforma: o painel de onde a pessoa veio, o portal para onde ela vai, e uma
tela com cara de nenhum dos dois. O que ela continua não tendo é a navegação do
cliente, pela razão de sempre: a equipe não tem empresa, e todas as seções
voltariam vazias.

##### O QUE NÃO VEIO, e é a decisão que a proposta existiu para tomar

**A barra lateral.** Ela é o item que mais aproximaria as duas áreas, e era a
proposta B; a C punha ainda a coluna de 306px. As duas ficaram de fora, e os
motivos são estes:

- **No celular ela cobra um toque.** No painel a barra vira gaveta porque são
  dezesseis itens e não há como mostrá-los; aqui são cinco, e eles cabem na
  tela. Trocar de seção passaria de um toque para dois, num portal que se abre
  quase sempre pelo celular — que é a razão pela qual esta navegação nasceu em
  cima, e ela não mudou.
- **Ela carrega o cartão da pessoa no pé**, que diz o perfil de acesso e o
  cargo. Vocabulário da agência, na tela de quem é cliente.
- **E a coluna de 306px não tem o que carregar.** No painel ela é um RESUMO —
  o cronômetro, os contadores, quem está fora —, e nada disso existe do lado do
  cliente. O único morador possível hoje é "Atividade recente", que ganharia a
  primeira dobra em vez de ficar no pé da página; um bloco só não sustenta uma
  coluna, e inventar o segundo seria inventar informação.

Se um dia a barra lateral entrar, o que decide é o celular, e a conta está
escrita aqui.

##### A árvore da campanha desfaz o cartão dentro do cartão

O grupo de entregáveis era uma caixa grande com as peças dentro, e as peças
eram cartão — cartão dentro de cartão, onde o que se lê primeiro é a CAIXA.
**A árvore de produção da agência já tinha tomado a decisão contrária** na
camada anterior: o grupo vira rótulo com um fio à esquerda, e quem ganha borda
e sombra é a PEÇA, que é a unidade sobre a qual alguém age. Ninguém decide
sobre um grupo: ele não recebe arquivo, não tem versão, e o status dele é
derivado dos filhos desde a 0033.

Duas telas que desenham a mesma árvore de dois jeitos é a divergência esperando
acontecer — e a divergência apareceria no lugar mais caro, que é o que a
agência olha antes de mandar contra o que o cliente vê depois.

**O que muda entre as duas é que esta DOBRA**, e por isso o rótulo continua
sendo `<button aria-expanded>` em vez do `<h3>` de lá. A contagem fica no
cabeçalho sempre, que é a regra do `GrupoDobravel`: grupo fechado precisa
continuar dizendo quantos tem dentro, senão não é recolher, é esconder.

**E o FIO fecha o grupo dos dois lados.** O rótulo diz onde ele COMEÇA e não diz
onde ele TERMINA: sem o fio, "Tabloide" — que é uma peça de topo — cai logo
abaixo do sexto Feed/Story e lê como o sétimo item de um grupo cujo rótulo diz
seis. É o mesmo achado que a árvore da agência teve, na mesma imagem.

##### A capa da campanha: o lugar de pôr uma, e o lugar de reservar espaço

Relato do usuário: *"dentro do portal do cliente, as campanhas, continuam sem o
espaço para colocar a capa"*. Ele estava certo, e a causa não era a que a frase
sugere — **o portal desenha a capa nos quatro lugares desde a 0050.** Faltavam
duas outras coisas.

**1. NÃO HAVIA ONDE PÔR UMA.** `CapaDaCampanha`, que é o uploader, morava só no
cartão da listagem do painel — e a tela onde a equipe efetivamente trabalha
numa campanha é `/painel/aprovacoes/campanhas/{id}`, onde a capa era desenhada
e não se trocava. Quem abria a campanha para subir o PDF da lâmina não
encontrava o botão, porque ele estava noutra tela, num cartão. Agora o uploader
é a própria peça da linha de identidade, com `proporcao="quadrada"` para caber
naquela fileira.

**2. E NÃO HAVIA ESPAÇO RESERVADO.** `CapaDoCartao` tinha duas respostas para
"não há imagem" — a faixa some, ou vira moldura pontilhada —, e **a grade do
portal usava a primeira**. Com uns cartões carregando capa e outros não, a
grade ficava com alturas desiguais e um vão no fim da linha. Foi a imagem do
protótipo que mostrou, e nenhum build pegaria.

Então são **TRÊS respostas**, e a terceira desfaz metade do que estava escrito
ali. A regra antiga dizia que espaço reservado numa grade é "uma lista de
buracos" — e ela supunha que quase nenhuma campanha teria capa, o que era
verdade **enquanto o único lugar de pôr uma era o cartão da listagem**. Um
buraco é um retângulo cinza vazio; `--brand-navy` é um fundo ESCOLHIDO, o mesmo
que a identidade do cliente usa desde a 0063, e ele dá ritmo à grade em vez de
tirá-lo.

| Sem capa | Onde | Por quê |
| --- | --- | --- |
| `nada` | detalhe da campanha | um item só, sem linha para desalinhar |
| `moldura` | onde quem pode trocar está olhando | é ela que diz onde clicar |
| `fundo` | a GRADE | alturas iguais; o vão é a única das três que parece defeito |

##### A seção que aparecia vazia, e o que ela mostrou

A aba Configurações desenhava "Dados da empresa" com título, subtítulo e NADA
embaixo. A causa é a de sempre: a página lia `clients` direto, com
`const { data } = await supabase...`, e **uma leitura assim falha calada.** Em
produção funcionava; o ponto é que o modo de falha era invisível dos dois lados
— e foi a imagem que mostrou, porque no protótipo não há Supabase e a consulta
volta vazia. Uma seção vazia lê como tela quebrada.

A leitura virou `contatosDasMinhasEmpresas()` em `lib/dados/clientes.ts`, com
`ouFalha()`. Ela **não** substitui `obterMinhasEmpresas()`: aquela responde "de
que empresas eu sou", esta traz as três colunas que só aquela tela edita.

**E ela é a última das leituras cruas do Portal.** A migração para `ouFalha()`
tinha começado justamente por esta área — *"primeiro o que o cliente lê"* —, e
esta ficou para trás por estar numa `page.tsx` e não em `lib/dados/`. É onde a
varredura não olha.

##### O que NÃO mudou, e é decisão

- **Nenhuma consulta de material mudou, e nenhuma migration entrou.** O que o
  cliente enxerga continua sendo decidido por `tasks_select_cliente`,
  `posts_select_cliente` e `deliverables_select_cliente` — a camada que vale.
- **O vocabulário continua sem jargão interno**, e `check:cores` continua
  varrendo `src/app/(cliente)/` e `src/components/portal/` atrás das formas
  portuguesas de "task", "subtarefa", "etapa", "workflow" e "sprint".
- **O portal SEGUE O TEMA**, ao contrário da porta: os tokens dele não têm par
  próprio no `:root`, e a imagem `15b-portal-escuro` existe para provar que o
  escuro não é o claro invertido à mão.
- **O rodapé continua sem o commit.** Para a equipe ele é a resposta de "já
  subiu?"; para o cliente seria uma sigla sem significado.


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

#### A capa do filme vem do link, e fica AQUI

Migration 0067, decisão do usuário: *"queria uma maneira de conectar alguma
plataforma de filmes na aba de recomendações, então quando a pessoa recomenda
um filme, a capa do filme aparece. Pode ser puxando do link mesmo"*.

**Não há plataforma de filmes, e não precisa haver.** O `og:image` é a metatag
que Netflix, IMDb, YouTube, Letterboxd e qualquer loja de livro já servem para
o WhatsApp desenhar a prévia — então o mesmo caminho cobre filme, série, curso
e ferramenta, que são quatro das oito categorias do feed. Uma chave de API do
TMDB resolveria **uma** categoria e traria uma credencial a mais para guardar.

**E NÃO HÁ COLUNA NOVA: é a nona ponte construída e nunca atravessada.**
`recommendations.imagem_url` existe desde a 0017, o formulário a preenche desde
o Sprint 9, `buscarPreviaDoLink` lê o `og:image` desde então, e o cartão a
desenha. O que faltava era ela **aparecer** — e o que a escondia é o CSP: ele
fecha `img-src` em `'self' data: blob:` mais o Google e o Supabase, então uma
capa hospedada em qualquer outro lugar era recusada pelo navegador e o cartão
saía com a moldura quebrada. **Nenhum build diz isso, e o protótipo não pega:**
as imagens de exemplo dele apontam para `/exemplos/`, caminho local. É o mesmo
modo de falha do `remotePatterns` do `next/image` e da classe de cor que o
Tailwind não conhece.

**A capa é BAIXADA para o bucket privado, e não apontada lá fora.** Três razões,
e as três são mecânicas:

1. **O CSP.** Abrir `img-src` para `https:` resolveria numa palavra e pagaria o
   custo que o comentário do próprio CSP já calculou para UMA origem — o
   favicon do Google faz cada navegador da equipe contar ao Google o que a
   agência anda indicando. Com `https:` inteiro seria uma origem nova por
   recomendação.
2. **Capa apontada lá fora SOME.** O poster muda de endereço, o site sai do ar,
   e o feed de três anos atrás fica cheio de moldura quebrada.
3. Um `<img>` para fora vaza o `Referer` de quem está olhando.

O bucket é privado como todos os outros, a equipe inteira lê (`is_staff()`), e
a pasta é de quem indicou — a mesma forma do bucket de notas. **Poster de filme
é público na internet, e "público lá" não é razão para abrir um bucket aqui:** a
lista do que a agência indica internamente é dela.

**A BUSCA É A MESMA, e a trava também.** `lib/link-preview.ts` era a única parte
do produto que fazia o servidor abrir um endereço escolhido por alguém; agora
são duas — ler o `<head>` e baixar a capa que ele apontou —, e as duas passam
pelo mesmo `abrir()`, que segue redirecionamento à mão conferindo cada salto.
**Uma segunda cópia daquele laço seria exatamente onde a conferência do salto
ficaria de fora**, porque ela é a linha que parece redundante: o endereço já foi
conferido uma vez antes de entrar no laço.

**E a segunda é a mais exposta, não a menos.** O endereço que ela busca foi
escolhido pelo SITE, não pela pessoa: uma página inofensiva pode servir
`og:image` apontando para `169.254.169.254` e o servidor buscaria aquilo sem
ninguém ter digitado nada. Por isso `npm run check:preview` passou a rodar os
doze endereços internos **pelos dois caminhos** — medir só o primeiro passaria
no dia em que o segundo deixasse de chamar o guarda. Medido com duas mutações:
tirar a faixa `169.254` derruba dois cenários, tirar o `conferir()` de dentro do
`abrir()` derruba vinte e dois.

**O download acontece na PRÉVIA, e não na publicação**, e é por causa do mesmo
CSP: devolver o endereço externo para o formulário daria uma prévia com a
moldura quebrada — que é pior que prévia nenhuma, porque afirma que a capa não
veio quando ela veio. Baixando ali, o que a pessoa confere antes de publicar é
exatamente o arquivo que vai para o cartão. *O custo, dito em vez de escondido:*
quem cola um link e desiste deixa um arquivo que nenhuma recomendação aponta. É
a forma da 0048 — *"o arquivo continua no bucket"* — e do rascunho de task que
ninguém apaga, porque **a limpeza não roda sozinha neste produto**. A pasta é do
autor, então o que sobra é dele.

**`capa` é campo novo no feed, e `imagem_url` não é reescrito.** A coluna guarda
o caminho no bucket; o que o `<img>` precisa é a URL assinada, que vale uma hora
e não serve para gravar. Sobrescrever a coluna faria a tela e a ação discordarem
sobre o que ela significa. A assinatura é em bloco, uma ida para o feed inteiro,
e `assinarArquivos` já deixa passar o que começa com `http` — que é o endereço
colado à mão antes da 0067, e que continua valendo com o CSP decidindo se
aparece.

**Não existe policy de UPDATE no bucket**, e a ausência é a regra: trocar o
arquivo por baixo de um endereço já gravado é trocar a imagem sem deixar rastro.
E "Usar sem imagem" **não apaga o arquivo** — apagar não é desfazer; ele só deixa
de apontar para lá.

**Nada disso trava o post.** Um site sem `og:image`, fora do ar, ou recusado pelo
guarda devolve os textos com a capa nula, e o cartão tem esse estado desenhado —
a cor da categoria com o ícone dela. O motivo vai para o log do servidor, porque
uma capa que some sem registro é a varredura do dia em que todas pararem de
chegar.

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

**E a MESMA linha estava na lista de etapas do detalhe da Task**, encontrada
depois, na imagem do painel lateral: "Revisar o texto do manual" saía como
"Rev", porque o selo de prioridade, o prazo, o seletor de status, o cronômetro
e o botão de ação são todos `shrink-0` e o título era o único que podia
encolher. Mesmo conserto, e mais um detalhe que o de cima não tinha: o
`truncate` morava num `<span>` dentro do botão, e num elemento inline as três
propriedades não recortam nada — o título era cortado **sem reticências**, que
é a diferença entre "está truncado" e "está quebrado".

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

**E ela não avisa NINGUÉM quando não há ninguém** (migration 0062). Até ali
`notificar()` ia direto ao `insert`, e `notifications.user_id` é `not null`:
passar uma coluna nulável — `clients.responsavel_atendimento_id`,
`posts.criado_por`, `subtasks.responsavel_id` — estourava a restrição e
**levava junto a escrita que chamou**.

**Isso quebrou as quatro ações do cliente no Portal, e quem encontrou foi o
usuário.** Numa empresa sem responsável de atendimento preenchido — estado
normal, porque o campo é opcional desde o Sprint 2 —, `decidir_rodada_do_cliente`
e o trigger `comments_avisa_a_equipe` morriam os dois no mesmo `insert`:
aprovar, recusar, pedir ajustes e comentar voltavam recusados. E `on delete set
null` transforma isso em bomba com relógio: no dia em que a pessoa do
atendimento sai da agência, todo cliente dela para de conseguir aprovar
qualquer coisa, sem nada mudando na tela.

**O conserto é na função, e não nos 23 lugares que a chamam.** Pôr um
`if ... is not null` em cada chamada seria criar 23 lugares para lembrar, e a
24ª esqueceria — a mesma razão pela qual a auditoria é trigger e não action.
E o retorno certo é `null`, não exceção: "não há ninguém para avisar" não é
falha de nada, é a resposta — como já era o caso de quem seria avisado ser
quem causou o aviso.

**A bateria não pegou porque a montagem escondia.**
`15_posts_e_comentarios.sql` abria com
`update public.clients set responsavel_atendimento_id = :MARINA`, uma linha de
fixture que garantia — sem querer — a única condição em que o bug não acontece.
Mil e tantos cenários verdes com o produto quebrado. É a mesma armadilha do
Sprint 16 em `19_social_media_interno.sql`: **conveniência de fixture ocupando
o lugar do cenário**. A montagem ficou, e ao lado dela entraram os cenários da
empresa que não tem atendente. **E o seed também mudou**: a Óptica Visão passou
a nascer sem responsável de atendimento, porque um ambiente de desenvolvimento
em que toda empresa tem um mostra o produto no único estado em que o bug não
aparece.

**E a tela engolia a recusa, que é a outra metade.**
`components/portal/decisoes-do-conteudo.tsx` e `thread-de-comentarios.tsx`
chamavam `chamarAcao()` e nunca mostravam o resultado: o clique não fazia nada
e não dizia nada. Eram **os dois únicos componentes do produto** com esse
silêncio, e os dois no Portal do Cliente — a área que a equipe nunca abre. A
regra "nenhuma escrita pode falhar em silêncio" estava quebrada exatamente no
lugar mais caro, e é por isso que o erro do banco levou meses para virar
relato. Os dois passaram a usar `chamarEMostrar()`.

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

### A acessibilidade, e o que só a rodada COMPLETA do protótipo mostra

O `npm run prototipo` roda o **axe-core** em cada tela viva, depois do clique —
e só `serious` e `critical` entram na lista, porque com os avisos leves junto
ninguém lê nenhum. A rodada filtrada (`PROTOTIPO_SO=…`) varre as telas que se
pediu; a **completa** varre as cento e cinquenta, e é ela que mostra o tamanho
de verdade: sete famílias de achado, uma delas em 98 nós.

**Nada disso era regressão de um sprint.** Era dívida do produto inteiro, e a
razão de ela ter durado tanto é mecânica: a rodada completa leva quinze minutos
e **não está no CI**, então quem trabalha numa tela roda a filtrada e vê as
famílias da tela dela. É a mesma família do `check:prototipo` — uma verificação
que só funciona no modo que ninguém usa é uma verificação que ninguém faz.

**E o terminal cortava em três exemplos por regra**, dizendo "e mais 32 trechos
diferentes". Isso é a decisão certa para ser lido e a errada para ser
consertado: quem vai atrás da causa precisa dos 32. Agora a lista inteira, com
o `failureSummary` do axe em cada nó — no contraste ele traz as duas cores e a
razão medida —, vai para `prototipos/acessibilidade.json`. A imagem responde
"está errado"; o arquivo responde "onde".

#### `<label for>` NÃO nomeia um `<button>`

É a regra que explica 27 dos nós, e ela se esquece porque parece resolvida: o
`SelectTrigger` do shadcn é um `<button role="combobox">` com um `<Label
htmlFor>` do lado, e um `<label>` só nomeia campo de formulário — nunca um
botão. Então **todo Select com o valor vazio não tem nome nenhum**, e quando
tem valor o nome passa a ser o valor, que também está errado: um combobox se
nomeia pelo que ele escolhe, não pelo que está escolhido.

Por isso os **52** `SelectTrigger` do produto ganharam `aria-label`, e não só os
três que o axe acusou: os outros passavam por acaso, porque naquele instante
havia um valor selecionado. Conserto por nó aqui seria voltar na próxima rodada
com dados diferentes.

#### O `<input type="file">` escondido continua existindo

Sete deles moram atrás de um `Button` que os aciona por `ref`, com
`className="sr-only"`. **Visualmente escondido não é ausente da árvore de
acessibilidade** — `sr-only` é justamente o contrário —, então cada um era um
campo de arquivo anunciado como "editar" e mais nada.

#### O dnd-kit devolve `role="button"`, e isso cria botão dentro de botão

`attributes` traz `role` e `tabIndex`. Espalhá-los num `<div>` em volta de um
`<button>` de verdade dá duas paradas de Tab para o mesmo cartão, o leitor de
tela anunciando "botão" duas vezes, e a de fora não fazendo nada no Enter.

**No board de demandas o conserto não muda nada na tela:** os ouvintes passaram
para o próprio `<button>`/`<a>` clicável, sem o `role` e sem o `tabIndex` — os
dois já nascem focáveis e com o papel certo. O `aria-roledescription` e o
`aria-describedby` das instruções de teclado ficam.

**No board de etapas o cartão não embrulha um clicável, ele CARREGA os botões de
ação**, então lá saem só o `role` e o `tabIndex`. *O que se perde, e é
consequência aceita:* o arrasto por teclado. E não se perde nada — o caminho de
teclado para mudar o andamento é exatamente o botão "Iniciar" dentro do cartão,
que é o que esse board existe para oferecer.

#### O contraste tinha DUAS causas, e as duas são a mesma regra do produto

A primeira era **uma linha**: `--muted-foreground` apontava para
`--text-muted`. Ele é o apelido do shadcn para todo texto discreto — selo
secundário, cabeçalho de tabela, placeholder, botão não selecionado de controle
segmentado — e em boa parte desses lugares o fundo é `--muted`, que é o mesmo
`--neutral-soft`. O par dava **4,43:1**, abaixo do mínimo de 4,5. Apontando para
`--neutral` dá 6,35:1 no claro e 6,86:1 no escuro.

**A medição entrou no `check:cores` ANTES da correção**, e falhou: sem isso a
troca seria uma afirmação sobre um número que ninguém mediu. E ela vale para
todo componente do shadcn de uma vez — classe por classe seriam 131 telas, e a
132ª ficaria para trás.

A segunda era **`opacity-` em texto**, e é a regra que o produto já tinha
escrita para fundo: *opacidade sobre um fundo qualquer dá uma cor que ninguém
mediu, e no tema escuro dá outra.* Ela valia para o selo de estado e não estava
sendo aplicada ao texto — `opacity-80` no "· hoje" do `DateBadge` aparecia em
quase toda tela do produto. O calendário do Sprint 10 já tinha pagado esse
preço uma vez, e o comentário dele estava lá dizendo isso.

E havia uma **terceira**, que só a segunda rodada mostrou: **`--text-muted` só
era seguro sobre o cartão e a página.** Sobre os cinco fundos `*-soft` ele dava
4,03 a 4,49:1 — e a própria lista do `check:cores` dizia isso, doze linhas
abaixo, recomendando `--text-secondary` ali. A recomendação valia para **um**
componente (`CartaoDeNumero`) e o token tem **330 usos**: a varredura achou 53
nós, em selo de mão do post, cabeçalho de tabela das Métricas, lista do cartão
de atenção do Resumo da Agência e dia da semana da matriz.

**Corrigir os 53 seria a quarta vez que a regra mora no lugar de chamada**, e a
54ª ficaria para trás. Então o token foi escurecido — #626870 no claro, #9299A2
no escuro — e **as cinco medições entraram na lista**: elas conferem o token
contra todo fundo em que ele pode cair, e não contra os dois em que ele já
passava. O pior par passou de 4,03 para 4,60:1.

Os valores do escuro **não são os do claro invertidos**, e é a mesma decisão
das cores de série do Financeiro: são passos próprios medidos contra os fundos
do tema escuro, onde o pior par era outro (`--neutral-soft`, a 4,17:1).

> **Decisão em suspenso, com os números:** a paleta de cor do editor rico é o
> único lugar do produto em que a cor **não pode** sair de um token — ela é
> gravada DENTRO do documento do TipTap, e é por isso que
> `components/shared/editor-rico.tsx` é exceção registrada no `check:cores`. A
> consequência é que a regra de contraste não tem como valer ali, e medindo:
> no tema claro, o pior caso de cada cor sobre os cinco fundos é 4,31 (vermelho),
> 3,18 (laranja), 3,36 (verde), 4,61 (azul) e 5,09 (roxo) — **três das cinco
> reprovam**; no tema escuro **as cinco reprovam**, de 2,30 a 3,68, porque um
> tom escuro o bastante para o fundo claro é claro demais para o escuro.
> **Não existe hex que resolva os dois**, e escurecer a paleta nem corrige o
> texto já gravado, que carrega o valor antigo. As saídas são escolher o tema
> claro e piorar o escuro, ou tirar o controle de cor do editor e ficar com
> negrito, itálico e realce. As duas são decisão de quem usa o editor, então
> ficou como está — e o achado continua aparecendo no relatório, nomeado, em
> vez de ser silenciado por uma exceção.
>
> **Por isso a rodada completa termina em 1, com três nós.** São as sete
> famílias reduzidas a esta, e o vermelho que sobra não é ruído: ele é esta
> decisão esperando resposta. Silenciá-la por exceção deixaria a lista verde e
> a decisão esquecida — e a lista verde é a que ninguém confere.

**Onde a opacidade servia para dizer "inativo", ela era o segundo sinal e não o
primeiro:** o workflow arquivado já tem o selo "Arquivado", o contrato inativo
já tem "Inativo", e o item concluído do calendário já tem `line-through`. A
opacidade não acrescentava informação — só levava o texto ao redor abaixo do
mínimo.

#### O que NÃO foi feito, e é decisão de quem lê isto

**Não há teste E2E nem teste de carga.** Os dois estavam na mesma parte do
sprint e ficam de fora: E2E pede um Postgres com Auth de verdade — a bateria
roda contra o Postgres mas fala SQL, não navega —, e carga pede uma máquina
onde medir, que é a mesma que saiu com a VPS. O que existe no lugar é
específico: o protótipo prova propriedade de tela em cento e cinquenta telas e
seis perfis, e `supabase/testes/` prova regra de banco com gente de verdade.
Nenhum dos dois cobre "o fluxo inteiro num navegador", e essa lacuna fica
escrita aqui em vez de ser contada como coberta.

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

**E a G voltou depois, pelo mesmo argumento que trouxe as outras duas.** O que
ela precisava não era da VPS: era de um relógio. A seção abaixo é o que ela
entregou, e os dois buracos que ela não fecha.

#### A rotina diária, e por que ela não precisava da máquina

`.github/workflows/rotinas.yml`, chamando `scripts/rodar-rotinas.sh`.

**DUAS FUNÇÕES EXISTIAM E NINGUÉM AS CHAMAVA**, e uma delas fazia o módulo de
recorrências ser decorativo: a regra guarda a cadência, a prévia mostra as cinco
próximas, `recurrence_runs` tem coluna para cada execução — e a demanda só nascia
se alguém abrisse a regra e clicasse. O stories de toda segunda dependia de
alguém lembrar toda segunda, que é exatamente o que a recorrência existe para
não exigir.

**QUEM AGENDA É O `pg_cron`, e é decisão do usuário.** 06:20 e 06:35 UTC, que
são 03:20 e 03:35 em São Paulo. Quem liga é `scripts/agendar-rotinas.sql`,
colado no SQL Editor uma vez — e é **script e não migration** por duas razões: a
extensão se habilita no painel do Supabase, então um `create extension` numa
migration falharia em qualquer ambiente onde ela não esteja disponível; e
agendamento não é schema, é escolha de operação, como decidir aplicar uma
migration.

**O caminho por GitHub Actions foi escrito primeiro e recusado**, e o registro
da ida e da volta fica porque foi o custo que decidiu: pelo Actions a chave de
serviço — que ignora todo o RLS — teria que virar secret do repositório, e quem
tem permissão de escrita nele pode ler o secret escrevendo um workflow. Com o
`pg_cron` a chamada nunca sai do banco e nenhuma chave é criada.

**O `rotinas.yml` FICOU, sem o relógio.** Ele responde "ela rodou?" no dia em
que alguém desconfiar, sem esperar a madrugada, e é o caminho de quem quer gerar
as recorrências do dia agora — por **Actions → Rotinas → Run workflow**. Dois
`schedule:` para a mesma rotina dariam duas execuções por noite, com metade dos
logs em dois lugares; e a idempotência da 0040 tornaria isso inofensivo e
invisível, que é a pior combinação.

**O script é um só, e a Action o chama em vez de repetir os `curl`.** É a decisão
do `verificar.yml` ser chamado pelo deploy: uma cópia da rotina envelhece em
silêncio, e a que roda de madrugada é justamente a que ninguém olha.

**A rotina não pode falhar calada**, que é a regra do produto num lugar sem tela
— aqui não há ninguém para ler um toast. O código HTTP é conferido, o corpo da
resposta vai para o log, e o erro sai como `::error::`, que o GitHub mostra na
cara do commit. **E o HTTP 200 também é lido**: o `exception` de
`gerar_recorrencias()` fica DENTRO do laço, de propósito, então uma regra que
falha devolve 200 com o estrago no corpo — sem essa leitura o Actions ficaria
verde numa madrugada em que nada nasceu.

#### E AS DUAS TELAS PERGUNTAM SE ELE ESTÁ LIGADO, em vez de afirmar

Migration 0072. Duas faixas do produto falam disso: a da aba Recorrências e o
bloco de rascunho parado da Home. As duas eram **verdade escrita à mão** — e com
um chamador existindo, ficariam dependendo de alguém lembrar de trocar o texto no
dia em que o agendamento fosse ligado, e de trocar de volta no dia em que fosse
desligado.

**É a armadilha que este arquivo pagou na tabela de migrations pendentes**: prosa
mantida à mão, lida justamente por quem está em dúvida, que ficou errada no dia
em que cinco foram aplicadas e ninguém editou o texto. E aqui um dos dois erros é
caríssimo: *"a demanda nasce de madrugada"* faz a pessoa parar de clicar em
"Gerar agora", e o cliente descobre no dia da entrega. O outro faz alguém clicar
sem precisar, e o índice único da 0040 recusa a geração repetida.

**Com o `pg_cron` a pergunta tem resposta no banco, e é isso que destrava a
mudança:** `cron.job` é uma tabela. `rotinas_agendadas()` a lê pelo recorte de um
booleano, e `rotinasAgendadas()` em `lib/dados/rotinas.ts` é quem as duas telas
chamam. **Pelo Actions isso não existiria** — um secret de repositório é
invisível para o Postgres, e a tela continuaria adivinhando.

- **Ela NÃO pode estourar onde `pg_cron` não existe**, e esse requisito decide a
  forma dela. São três ambientes sem o schema `cron`: a bateria (um Postgres 16
  pelado), qualquer cópia nova do banco, e o próprio projeto antes de alguém
  ligar a extensão. Nos três a resposta certa é `false`, não um erro que derruba a
  lista de Recorrências e a Home. Por isso `to_regclass` antes de tocar na tabela,
  e por isso a consulta é montada com `execute`: uma referência direta a
  `cron.job` no corpo faria o Postgres validar o objeto na criação da função, e a
  migration falharia de cara. É a razão de toda função deste projeto ser
  `plpgsql` e não `language sql`, vista de outro ângulo. **A bateria mede com
  mutação:** tirando a guarda, o cenário cai com *"relation cron.job does not
  exist"*.
- **`security definer`**, porque `cron.job` lista TODO agendamento do projeto com
  o comando dentro, e não se abre para `authenticated`. O que sai daqui é um
  booleano sobre dois nomes — a forma de `usuarios_do_meu_cliente()` e de
  `meus_comodatos()`.
- **`active` importa, e os DOIS têm que estar.** Um agendamento pausado existe na
  tabela e não roda; e com uma rotina só ligada, uma das duas faixas mentiria.
  Quem ligar apenas uma vê as duas dizendo que a geração é manual, que é o lado
  seguro do erro.
- **A leitura falha para "não está agendado"**, e não usa `ouFalha()`: aqui a
  consulta decide só qual de duas frases verdadeiras aparece, e derrubar a Home
  por causa dela seria trocar uma imprecisão por uma falha total — a decisão da
  faixa de novidades de Minhas Tasks. O erro vai para o log, porque sem ele
  ninguém saberia por que a tela insiste em dizer "manual" num banco onde o
  `pg_cron` está ligado.
- **O tom acompanha a frase**: `--warning` quando a geração depende de alguém
  lembrar, neutro quando ela acontece sozinha. Um aviso âmbar permanente sobre
  algo que funciona é o que ensina a ignorar âmbar.
- **E nenhuma das duas cita a mecânica** — agendamento, extensão e rotina são
  vocabulário de desenvolvimento, e nenhum texto visível ao usuário carrega isso.
  O bloco da Home diz "é apagado durante a noite" ou "o Full Hub não apaga
  sozinho"; a faixa diz "a demanda nasce de madrugada" ou "a geração é manual por
  enquanto".

#### E ao dar um chamador à limpeza, apareceu quem mais podia chamá-la

Migration 0071. `limpar_rascunhos_abandonados()` nasceu na 0028 como `security
definer` — ela APAGA de `tasks` — e **sem revoke**. O Postgres concede `execute`
a `public` por padrão em toda função nova, e o PostgREST publica o schema
`public` sozinho. Somando as duas, um POST em
`/rest/v1/rpc/limpar_rascunhos_abandonados` com a chave anon — que vai no bundle
que o navegador baixa — apagava todo rascunho da agência **sem sessão nenhuma**.

Não é escalonamento de privilégio de um colaborador: é de qualquer pessoa. E o
furo tinha a cara de "nada aconteceu": um rascunho é de quem o criou e de mais
ninguém, então a pessoa abriria a tela, não acharia o que escreveu, e concluiria
que errou o caminho.

`gerar_recorrencias()` saiu de `authenticated` no mesmo arquivo, porque nenhuma
tela a chama — o botão "Gerar agora" de uma regra é `gerar_ocorrencia()`, que é
outra função, de uma regra só, e essa continua onde estava.

**A bateria mede o privilégio e não a mensagem de recusa**, e a distinção é a do
limite de tentativas: uma função pode recusar por dentro e continuar executável,
e aí o que se mediu foi o corpo dela, não a porta. `teste.como_a_rotina()` entrou
no ferramental porque `teste.cenario` sempre entra como `authenticated` — usá-lo
aqui testaria um caminho que o produto não tem e, pior, **pediria de volta o
`execute` que a 0071 tirou**.

**E o teste de mutação me corrigiu no meio do caminho.** A primeira versão da
0071 afirmava que o cron levaria "permission denied" em `gerar_recorrencias()`,
porque a 0040 fecha em `authenticated` e `service_role` não é membro dele. Tirei
o grant para ver o cenário cair, e ele passou: `service_role` já tinha `execute`
pelo `alter default privileges` que o Supabase deixa ligado no schema `public`, e
o `revoke all from public` da 0040 não o alcança. O grant ficou de qualquer
forma — privilégio herdado de default privileges é privilégio que some quando
alguém os aperta, e aí a rotina para de madrugada —, e o cabeçalho da migration
conta a ida e a volta em vez de mostrar só a conclusão.

**O que a rotina ainda NÃO cobre**, e é o mesmo buraco visto do lado do e-mail:

- **`frequencia = 'diario'` das preferências do portal não sai.** Está escrito na
  tela, pela mesma razão: a pessoa escolheu uma coisa e receberia outra — ou
  nada, calada.
- **`lembrete_pendencias` também não**, e pelo mesmo motivo: um lembrete é uma
  varredura diária, não uma consequência de alguém ter clicado.

Os dois dependem de uma coisa que a rotina não tem: **a URL do app.** As duas
funções do banco são RPC no PostgREST, e o digest é uma varredura que monta
e-mail — ela vive no Next, e ninguém sabe onde o site roda desde a VPS. É a
mesma pendência que deixa o rodapé do painel dizendo "versão local".

**Duas das frases erradas moram em migration aplicada, e por isso ficam
erradas.** Os comentários da 0028 e da 0031 são `comment on function` e
`comment on table` — texto gravado no banco, que só sai por migration nova.
Uma migration cujo único efeito é reescrever comentário é uma migration que
alguém aplica por engano achando que muda alguma coisa, e o custo de errar
nisso é maior que o de um comentário datado. **O tempo verbal certo mora
aqui**, que é onde se procura o que vale hoje — a mesma razão pela qual a
explicação de um nome morto mora fora de `src/`.

### A busca da topbar deixou de ser uma casca

`busca_global()` na migration 0073, `lib/dominio/busca.ts` com o vocabulário,
`lib/dados/busca.ts` com a leitura e `components/painel/busca-global.tsx` com a
paleta.

**Ela foi uma CASCA desde o Sprint 1**, e a escolha estava certa para aquele
dia: trinta linhas de componente, um botão com cara de campo, e um toast
dizendo que a busca não estava pronta. Um campo que aceita texto e não faz
nada é pior que um botão honesto — a pessoa conclui que o sistema quebrou.

#### A LINHA MAIS IMPORTANTE É A QUE NÃO ESTÁ NA MIGRATION

**`busca_global()` não é `security definer`.** Uma função `plpgsql` comum roda
com o `current_user` de quem a chamou, então a policy das NOVE tabelas vale
dentro dela — e é por isso que nem a consulta nem a paleta repetem filtro de
permissão nenhum. Repetir criaria o segundo lugar onde a regra pode divergir, e
seria o pior segundo lugar do produto: uma chamada só que lê `clients`,
`assets` e `client_requests` de uma vez.

**E o modo de falha é o do `security_invoker` da `calendar_events`: num banco
com um cliente só, vazar tudo e mostrar o certo têm a mesma cara.** Por isso a
bateria busca com material das DUAS empresas e pergunta a quatro pessoas de
três perfis — trocando uma palavra na 0073, **sete cenários caem** e dizem o
que vazaria.

#### O acento é `translate`, e não a extensão `unaccent`

Digitar "midia" tem que achar "mídia", e são dois problemas empilhados. O
segundo é o que morde: **`lower()` não dobra acento, e o que ele faz depende do
locale do banco.** Foi medido — no Postgres da bateria, que é locale C,
`lower('GRÁFICA')` devolve `grÁfica`, uma forma que nunca casa com nada; em
produção, com locale UTF-8, o mesmo `lower()` funciona. A versão ingênua
passaria numa máquina e falharia na outra, conforme a cópia do banco.

**É o `grep -i` do `check:cores` de novo**, que dizia "ok" numa máquina e
falhava no CI para o mesmo commit. A saída é a mesma: não depender de variável
de ambiente para saber ler.

`sem_acento()` dobra pelo `translate`, **com as duas caixas no mapa** para o
acento sair antes do `lower()`. Não é `unaccent` por três razões: extensão se
habilita no painel do Supabase e um `create extension` falha em qualquer
ambiente sem ela — a lição do `pg_cron` na 0072 —; `unaccent()` é `stable` e
não entra em índice sem um invólucro; e **o conjunto de acentos do português é
fechado**, ao contrário da lista de nomes mortos.

#### `strpos` e não `like`, e o que isso resolve de graça

Com `like '%termo%'`, quem busca "100%" busca qualquer coisa — o `%` vira
curinga. `strpos` não tem curinga e **devolve ONDE casou**, que é a ordenação:
posição 1 é casamento no começo do nome, e digitar "mun" põe "Mundo Verde"
acima de "Comunicado da Mundo".

Recência foi considerada e cai por um motivo mecânico: os grupos têm seis
linhas, e em seis linhas o sinal útil é "o nome começa com o que eu digitei",
não "foi mexido ontem".

*O custo, dito em vez de escondido:* nenhum dos dois usa índice sem `pg_trgm`,
então isto varre as nove tabelas. Numa agência com algumas centenas de demandas
é barato; no dia em que não for, a saída é um índice de expressão sobre
`sem_acento(titulo)` — que é por que ela é `immutable`.

#### O limite é POR TIPO, e o corte diz quantos sobraram

Um limite global de dez com trinta demandas casando mostraria **zero
clientes** — e quem digita "Mundo" quase sempre quer a empresa. A paleta agrupa
por tipo, e cada grupo precisa poder responder.

E o `total` de cada ramo é `count(*) over ()`, que roda **antes** do `limit`:
é a única forma de ele contar o que foi cortado. É a regra do Resumo da
Agência — cortar calado faz a pessoa concluir que aquilo é tudo.

#### O que ela busca, e o que ela não busca

**O NOME, nunca o corpo.** Briefing, legenda, pauta e descrição ficam de fora:
casar no corpo devolve a demanda cujo briefing menciona "gráfica" por acaso, e
quem lê a linha não tem como ver POR QUE ela casou — o título na tela não
contém o que foi digitado. A exceção são os campos que alguém DIGITA para achar
uma coisa: o contato da empresa, o código de patrimônio e o número de série.

São nove entidades, e cada uma entrou porque **tem uma tela de detalhe para
onde levar**. Ficaram de fora as Recomendações (sem rota de detalhe, e o feed
já tem busca na URL), os eventos (a tela deles é o calendário), o workflow e a
recorrência (são configuração, e quem mexe nelas já está na aba), o lançamento
financeiro (é um número, não um nome) e o **entregável** — a peça de campanha É
uma subtarefa desde a 0051 e já entra pelo ramo de etapa, com a linhagem; somar
as duas poria o mesmo trabalho duas vezes, que é a conta que a 0061 recusou.

**E a subtarefa de post fica fora do ramo de etapa**, pela mesma razão: ela
carrega o tema do post como título, e o post tem ramo próprio. Sem essa linha,
buscar o tema devolveria duas linhas para o mesmo trabalho, levando a duas
telas — e a certa é a do post, que é onde o card se preenche.

#### O rascunho ENTRA, e é decisão

A regra escrita diz que rascunho não entra em lista, board, calendário, Minhas
Tasks, contador, relatório, notificação nem portal — e **todos aqueles
respondem "qual é o trabalho da agência"**, onde um pensamento pela metade não
cabe. A busca responde outra pergunta: *"onde está a coisa que eu tenho em
mente"*, e um rascunho é exatamente a coisa que ninguém acha.

A trava é a RLS **restritiva** da 0028 e não um filtro na consulta: o que volta
é o meu e de mais ninguém — nem do sócio. O selo diz que ele ainda não existe
para a equipe. Para reverter, é uma linha no ramo de demanda.

#### O grupo "Equipe" só responde para a gestão, e não é escolha da busca

`profiles_select` é `own or is_gestor()` desde o Sprint 2: **um colaborador lê
exatamente UM perfil, o dele.** Então buscar o nome de um colega devolve nada
para quem não é gestão, e a busca herda isso sem uma linha a respeito.

**O cenário da bateria existe para o dia em que alguém achar que a busca está
quebrada e "consertar" com `security definer`:** isso não consertaria a busca,
abriria a tabela de perfis da agência inteira. Se a regra tiver que mudar, muda
na policy — num lugar, para as vinte telas que leem `profiles`.

#### A paleta, e por que nada dela mora na URL

⌘K / Ctrl+K abre de qualquer tela. **E não `/`**, que já é a busca de demandas
dentro da Gestão de Tasks — o atalho de lá começa com
`if (metaKey || ctrlKey || altKey) return`, então os dois não colidem **por
construção e não por sorte**.

**Nada mora na URL**, ao contrário de todo filtro de listagem. A convenção
existe porque "olha o dia 15" precisa ser um link; a paleta não é uma
visualização de dados, é um CAMINHO até uma tela — e o link que interessa é o
do destino. Pior: com o termo na URL, voltar da tela escolhida reabriria a
paleta em cima dela.

**A recusa aparece, e nunca vira lista vazia.** Aqui "não achei" é a resposta
normal, então uma falha silenciosa seria indistinguível da verdade — a pessoa
concluiria que a demanda não existe. O erro mora dentro da paleta e não num
toast, senão um clique por tecla empilharia avisos.

**O ícone das três áreas vem de `ICONE_DA_AREA`**, e não é zelo: demanda,
campanha e Social Media já têm um desenho ao lado do nome delas em Minhas
Tasks, e aquele mapa nasceu de três cópias das quais duas já tinham divergido.
Uma quarta aqui poria o Social com um ícone na paleta e outro na lista, a dois
cliques de distância.

**A resposta é guardada com o TERMO que a produziu**, e esse par faz três
trabalhos: é a guarda de corrida (digitando rápido, a resposta de "mun" pode
chegar depois da de "mundo verde"), é o estado "buscando" derivado em vez de
armazenado, e é o que impede "nada com esse nome" de aparecer no intervalo
entre a tecla e a resposta. De quebra é o que permite o efeito não chamar
`setState` no corpo dele, que o `lint` do projeto reprova.

#### Quatro coisas que só a imagem pegou

- **`role="listbox"` sem `role="option"` dentro é ARIA inválido**
  (`aria-required-children`, crítico no axe), e os dois estados vazios caíam
  nisso. O papel passou a existir só quando há opção; o `id` fica, porque o
  `aria-controls` do campo aponta para ele.
- **O realce não se lia.** `font-medium` contra `font-semibold` é um degrau de
  500 para 600 — invisível a 14px. O título virou `font-normal`, e 400 contra
  600 salta.
- **O stub do protótipo casava no contexto de TODOS os tipos**, e a função de
  verdade só tem segundo campo em cliente, pessoa e equipamento. A imagem saía
  com cinco linhas sem realce nenhum, que a busca de verdade não devolve — uma
  paleta que confere o stub e não o produto.
- **E o stub não aplicava o limite por grupo**, então a imagem mostrava oito
  demandas onde o produto corta em seis — sem o "e mais 2" embaixo, que é
  justamente a linha que nenhuma outra tela do produto desenha.

#### `digitar` no gerador de protótipo

A paleta é a primeira tela do produto em que o clique não basta: ela abre
vazia, dizendo "digite ao menos 2 letras", e uma imagem dela sem texto
fotografa o estado que menos interessa. `digitar: { onde, texto }` preenche o
campo depois dos cliques, e espera mais que o debounce de 300 ms — senão a
imagem sai com o rodinha de carregando, que passaria como se fosse a tela
pronta.

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
- **O seed RECUSA rodar num banco que já tem gente**, e a guarda é do arquivo
  e não do cabeçalho. O aviso "não rode a PARTE 1 num projeto hospedado"
  existe desde o Sprint 0, vinte linhas acima do bloco — e o jeito de
  trabalhar deste projeto é **colar no SQL Editor**: é assim que toda
  migration é aplicada, assim que o `campanhas-sem-demanda.sql` roda, assim
  que o `agendar-rotinas.sql` ligou o pg_cron. Um comentário não recusa nada,
  e o que aquele bloco grava é caro: dez contas com a **mesma senha**, escrita
  em texto ao lado — o único lugar do produto que quebra a regra de
  `gerarSenhaProvisoria()`, e que pode quebrar, porque o banco onde ele roda é
  descartável.

  **E ela não pede opt-in, que é o que a faz não atrapalhar ninguém.** `npx
  supabase db reset` roda o arquivo com `auth.users` vazia e passa sozinha;
  rodar de novo no mesmo banco local também passa, porque as únicas linhas lá
  são as dele. Um `set` obrigatório no topo viraria a linha que todo mundo
  copia junto sem ler — a saída de emergência virando porta destrancada, que é
  a decisão da 0045. O que ela recusa é o caso que importa: um banco com **uma
  pessoa de verdade** dentro.
- **E "rodar de novo não duplica nada" é uma afirmação que precisa ser
  medida.** O cabeçalho do seed diz isso desde o Sprint 0, e tinha deixado de
  ser verdade: dos quatro pedidos do Sprint 3E, um ficou sem `on conflict` —
  a segunda passada estourava em `client_requests_pkey`. Quem encontrou foi o
  teste da guarda acima, rodando o arquivo duas vezes no mesmo banco. **Um
  cabeçalho não confere o que promete**, e este é o tipo de promessa que só se
  quebra para quem roda o seed duas vezes — o que ninguém faz até o dia em que
  precisa.

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
  o nome do lugar no log. **A MIGRAÇÃO ACABOU**, e foi feita por etapas, na
  ordem que importa: **primeiro o que o cliente lê** — o Portal é a área em que
  a equipe nunca entra, e uma lista vazia lá pode durar meses sem ninguém
  desconfiar. `portal.ts` tinha catorze leituras cruas apesar de a documentação
  dizer que ele já havia saído: só a listagem de campanhas tinha sido
  convertida, e é o tipo de coisa que uma frase em prosa afirma e nenhuma
  varredura confere.

  **O que sobrou de `const { data } = await` não é leitura de tabela:** é
  `auth.admin`, é `storage.createSignedUrls`, e são as RPC que tratam o erro na
  mão de propósito — `home_summary` (a Home não cai por causa do resumo),
  `is_atendimento` (falha para o lado fechado), e a faixa de pedidos de nota,
  que devolve vazio porque Notas Fiscais funciona inteira sem ela.

  **Três coisas a conversão ensinou, e valem para a próxima:**

  - **`ouFalha(... .maybeSingle())` COLAPSA PARA `never`.** A resposta dele é
    uma união de duas formas, o genérico resolve a união para `never`, e o erro
    não sai na linha da consulta — sai no `...linha` de um `return` setenta
    linhas abaixo. O caminho é `.limit(1)` e pegar o primeiro; foram seis
    lugares.
  - **`Promise.resolve({ data: [] })` dentro de um `Promise.all` faz o mesmo**,
    pelo mesmo motivo. O ramo vazio sai de dentro do `Promise.all`.
  - **O `?? []` sai junto.** Ele afirma que a leitura pode devolver nulo, e
    depois de `ouFalha` ela não pode — é a razão pela qual `atrasado` não é
    coluna: não se guarda uma segunda resposta para uma pergunta que já tem
    uma.

  **E `ouFalha` vem ANTES do `if (!data)`**, nas consultas de um item só. As
  duas respostas são diferentes: sem linha é a RLS dizendo "isto não é seu", e
  a tela responde 404 — que é o certo; erro é o `select` recusado inteiro, e
  juntá-los fazia "post não encontrado" aparecer para um post que existe.
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
- **E o "hoje" é o DA AGÊNCIA, não o do processo** — `hojeNaAgencia()` em
  `lib/dominio/datas.ts`, e é o único lugar que responde isso.

  **Eram QUINZE definições, em dois sabores que não concordavam entre si:**
  `new Date().toISOString().slice(0, 10)` devolve UTC e
  `format(new Date(), "yyyy-MM-dd")` devolve o fuso do processo. Os dois
  estavam em uso, às vezes na mesma pergunta — o board da Gestão de Tasks
  decidia atraso por um e o contador de Minhas Tasks pelo outro.

  **O sintoma é um número que mente por três horas todo dia**, e foi assim que
  ele apareceu: *"está aparecendo que tenho uma task atrasada em Minhas Tasks,
  mesmo sem eu conseguir ver essa task atrasada"*. A agência está em UTC−3;
  num servidor em UTC, das 21h à meia-noite "hoje" já é amanhã, e toda etapa
  que vence HOJE passa a ler `prazo < hoje`. O contador cobra uma etapa que a
  pessoa abre, olha, e com razão não reconhece como atrasada — e de manhã o
  número some sozinho, que é o pior jeito de um bug se apresentar: ele não é
  reprodutível no horário em que alguém vai procurá-lo.

  **Calcular no servidor não bastava**, e é o que faltava na regra acima: sem
  dizer em que fuso, o servidor responde pelo lugar onde a hospedagem estiver.
  **Não é variável de ambiente** — mais uma é mais um jeito de a hospedagem
  seguinte nascer errada sem nada na tela dizendo.

  `check:cores` varre as duas formas em `src/` e salva um arquivo só,
  `lib/dominio/datas.ts`, porque a explicação da regra precisa citar o que ela
  proíbe — é a exceção de `icon.svg` na lista de cores. Medido com duas
  mutações: devolver qualquer uma das formas a uma tela derruba a varredura, e
  devolvê-la ao arquivo salvo não derruba.

- **O CONTADOR PRECISA LEVAR ATÉ A LINHA, e a linha precisa ser achada.** O
  mesmo relato mostrou as outras duas metades: o contador de Minhas Tasks
  sempre foi clicável e nunca parecia — quem lia "1 atrasada" varria a lista
  em vez de clicar no número que já filtra. A Gestão de Tasks resolveu isso
  com **"ver quais"** ao lado do número, e aqui a palavra faltava. E a linha
  atrasada era marcada com `bg-destructive/5`: cinco por cento de uma cor
  sobre o fundo do cartão não distingue nada de nada. Virou par nomeado com
  borda à esquerda — opacidade em cor de estado é a regra que o produto já
  tinha escrita para o selo, e que esta linha vinha quebrando.
- **Concluir pergunta o tempo real, e dá para pular.** Pergunta obrigatória
  vira número inventado, que é pior que campo vazio — entra no relatório como
  se fosse medição. O componente é `DialogoDeTempo`, e o valor sai em minutos.
- **Regra de transição mora na máquina de estados, não no componente.**
  `lib/tasks/state-machine.ts` diz o que pode e qual botão aparece; os triggers
  da 0007 dizem a mesma coisa para quem chamar a API direto. As duas existem de
  propósito: a primeira escreve a mensagem que a pessoa lê, a segunda é a que
  vale.
- **O `database.types.ts` é escrito à MÃO, e o cabeçalho dele diz que não
  deveria ser.** A geração (`npx supabase gen types typescript --linked`) pede
  credencial do projeto, que não existe nesta máquina, então desde o Sprint 0 o
  arquivo é digitado: sessenta tabelas e algumas centenas de colunas.

  **Uma coluna fora de lugar ali não quebra nada no caminho.** Ela atravessa o
  `tsc`, o `lint` e o `build`, porque o tipo é a fonte da verdade PARA O
  TypeScript e o TypeScript não conhece o Postgres. Quem paga é a tela: *"Could
  not find the 'x' column of 'y' in the schema cache"*, ou — pior — um `select`
  que o PostgREST recusa INTEIRO, e aí a leitura volta vazia e a tela afirma
  "nenhum resultado" com toda a confiança. É o mesmo modo de falha que trouxe
  `ouFalha()`.

  `npm run check:tipos` é a prova, e ela achou duas derivas na primeira rodada:
  `skills.sugerida_por` estava no `Row`, no `Insert` e no `Update` quatro
  migrations depois de a 0043 apagar a coluna, e `post_etapas.prazo_offset_dias`
  não estava em lugar nenhum desde que a 0059 a criou — a regra de data existia
  na tabela e **não existia no produto**, então nenhuma tela tinha como mostrar
  por que uma etapa para de andar com o post.

  **Ela também pegou um bug meu, e o achado é a lição:** a primeira versão lia
  só a primeira cláusula de cada `alter table`, e a 0070 acrescenta quatro
  colunas de uma vez — as três que faltaram apareceram como "declarada no `Row` e
  ausente do banco", que é o achado mais grave da lista. Eu ia atrás de um furo
  de produção e o furo era do leitor. Quem varre SQL com expressão regular corta
  a instrução até o `;` e lê as cláusulas uma a uma; e tira os comentários
  primeiro, senão as explicações que CITAM o comando que discutem — "a 0023
  apagou `tasks.exigencia_aprovacao`" — apagam coluna que está de pé.

  **Os VALORES de cada enum ficam de fora de propósito:** valor órfão é normal
  aqui, porque `alter type ... drop value` não existe no Postgres — `cancelada`
  em `task_status` e o `pf_tipo` inteiro continuam lá, e o TypeScript deve mesmo
  ignorá-los. O tipo inteiro, esse sai: a 0023 fez `drop type` em
  `exigencia_aprovacao`, e é a diferença entre os dois casos.

  **E A CORRENTE TEM TRÊS ELOS, NÃO DOIS.** As duas checagens de cima ligam a
  migration ao tipo. Faltava a que liga o tipo à CHAMADA, e quem mostrou foi o
  usuário, clicando em "Registrar período" no Full Days: *"Could not find the
  function public.lancar_periodo(p_ano_referencia, …) in the schema cache"*. A
  0039 tinha tirado `p_ano_referencia` das três funções que o recebiam — porque
  o saldo deixou de ser por ano civil e virou corrido por ciclo de doze meses —,
  o `database.types.ts` estava **certo**, e quem ficou para trás foi
  `full-days/acoes.ts`, mandando o parâmetro em duas chamadas.

  **O TypeScript não pega, e o motivo é a assinatura do `rpc`:**

  ```ts
  rpc<FnName, Args extends Schema["Functions"][FnName]["Args"] = never>(
    fn: FnName, args?: Args, …)
  ```

  `args?: Args` é **sítio de inferência** — o TypeScript lê o tipo do literal
  que foi passado e só confere que ele satisfaz a restrição, e um objeto com
  uma chave A MAIS satisfaz. A checagem de propriedade excedente não vale
  quando o alvo é um parâmetro de tipo nu. Então `typecheck`, `lint` e `build`
  passam os três — e o PostgREST, que resolve função por **nome mais nomes dos
  argumentos**, responde que não existe função nenhuma com aquela assinatura.
  É o mesmo modo de falha das duas checagens de cima, um andar abaixo: compila,
  o editor autocompleta, e a recusa é de quem clicou.

  **A terceira seção mede isso, e a mutação prova**: devolvendo
  `p_ano_referencia` à chamada, o `check:tipos` cai e o `typecheck` continua
  verde. As outras duas mutações — inventar um argumento no tipo, esquecer um
  parâmetro que o banco tem — derrubam as duas seções novas de cima.

  **E um parâmetro pode legitimamente ficar fora do tipo**, com motivo escrito,
  como a tabela alcançada só por RPC: `lancar_periodo.p_origem` é o único, e o
  default dele é `lancamento_retroativo` — oferecê-lo poria `solicitacao` ao
  alcance de um autocompletar, e a função recusa esse valor na segunda linha,
  porque pedido normal passa pela aba Solicitar. A isenção é por
  `funcao.parametro` e não por função: tirando `p_data_fim` do tipo de
  `lancar_periodo`, a checagem cai do mesmo jeito.
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
- **O gerador de protótipo troca 28 módulos por stubs, e o `typecheck` não os
  vê.** Ele checa `src/` contra os módulos de verdade; a troca é um
  `compilerOptions.paths` aplicado só dentro de `.prototipo/`. Um stub sem um
  export que a tela importa passa no tipo, no lint e no build, e quebra na
  compilação do protótipo — quinze minutos depois, no fim de uma rodada. É a
  mesma família do valor exportado de arquivo cliente: erro que atravessa toda
  a verificação e só aparece quando alguém pede a tela. `check:prototipo`
  fecha a janela em menos de um segundo, e está no CI **porque o protótipo não
  está**.
- **`<title>` dentro de `<svg>` quebra a hidratação.** O React 19 trata
  `<title>` como o título do documento e o iça para o `<head>`, o que faz o
  HTML do servidor divergir do que o navegador monta. O rótulo acessível de um
  gráfico vai num `<span className="sr-only">` ao lado, apontado por
  `aria-labelledby`.
- **NENHUM TEXTO VISÍVEL AO USUÁRIO CITA NÚMERO DE SPRINT, nome de arquivo do
  roteiro ou vocabulário de desenvolvimento.** Espaço reservado se explica em
  português comum ou não existe.

  A regra nasceu de uma varredura com quatro achados, e três deles apontavam
  para coisas que **não existem mais**: a ficha do cliente dizia "Configurado
  no Sprint 5" (descartado) e "Preenchido no Sprint 14" (outra numeração), a
  busca da topbar respondia *"entra em um sprint futuro"*, e as Métricas
  explicavam uma conta "desde o Sprint 3B". Nenhum dos quatro quebrava build,
  tipo ou lint — e o número de sprint envelhece junto com o roteiro, então um
  texto desses passa de incompreensível a **errado** sem ninguém tocar nele.

  **Quem confere é o `check:sprint9`, e não o `check:cores`**, porque este lê
  código-fonte e "sprint" aparece em trinta e cinco comentários que EXPLICAM
  decisões — inclusive o que explica esta regra. É a armadilha que a lista de
  nomes mortos já pagou três vezes. O `check:sprint9` lê o **texto
  renderizado** dos dumps do protótipo: comentário não conta, atributo de tag
  não conta, só o que sai na tela. E ele varre **todos** os dumps, não só os do
  módulo que o nomeou — um espaço reservado esquecido mora justamente na tela
  que ninguém lembra de olhar.

  `TODO` e companhia entram numa lista separada, **sensível à caixa**: "todo" é
  palavra comum em português — "todo mundo", "todo dia" —, e buscá-la ignorando
  maiúscula faria toda tela do produto falhar.

  **O que a varredura NÃO alcança é a tela que o protótipo não captura.** Ela
  não pegou os dois textos da ficha do cliente, porque as abas "Configurações
  do fluxo" e "Atividade" não tinham imagem — quem as achou foi a busca no
  fonte, à mão. Toda aba com texto próprio precisa de um dump, senão a regra
  vale só para as telas que alguém já lembrou de fotografar.

- **Espaço reservado é obrigado a dizer o que vai existir.** `frase` em
  `PlaceholderDeModulo` **não é opcional**, e a razão está no próprio arquivo
  desde que ele nasceu: o texto padrão descrevia o estado da obra ("a navegação
  e as permissões já estão funcionando"), que interessa a quem a constrói e a
  mais ninguém. Sendo opcional, a próxima rota herdava o texto errado de graça;
  sendo obrigatória, é uma frase que alguém escreve — e quem não tem o que
  escrever descobre que a rota não devia existir.

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

  **E o que ficou no lugar da VPS é uma hospedagem da Hostinger com o Git do
  hPanel**, que clona a branch e constrói lá dentro. Isso é fato medido, e não
  suposição: a tela de login nova apareceu no ar sem ninguém ter subido
  arquivo compilado nenhum, e ela é TypeScript — alguém rodou `npm run build`
  naquele servidor. O rodapé do painel **responde "já subiu?" normalmente**,
  então, e foi ele quem provou tudo isto.

  **O DEPLOY NÃO ACONTECE SOZINHO, e o custo disso já foi pago uma vez.** O
  Git do hPanel puxa quando alguém manda — e a interface "Leve" inteira passou
  um dia no ar sem estar no ar: o `/login` respondia 200 o tempo todo,
  servindo o build da véspera. **Foi o rodapé que respondeu**, dizendo
  `a3ea860` num dia em que a `main` estava oito commits à frente. É
  exatamente para isso que ele existe, e é por isso que ele não é enfeite.

  O job `publicar-hostinger` do `deploy.yml` liga isso, e **passa pela
  verificação de propósito**: o auto-deploy cru do hPanel dispara no push de
  qualquer coisa, inclusive do commit que não compila. Ele espera o segredo
  `HOSTINGER_DEPLOY_WEBHOOK` — sem ele escreve no resumo e termina em 0, como
  o job da VPS. **A URL do webhook é a credencial inteira**: quem a tiver
  dispara deploy, então ela é segredo e vai por `env`, nunca interpolada na
  linha de comando.

  **E a conferência automática NÃO prova o que importa.** O passo "O site
  continua de pé?" confere que o site responde, não que ele responde com este
  commit — que é precisamente o buraco pelo qual o build da véspera passou. A
  resposta certa está no rodapé, e o rodapé exige login, então **nenhuma
  Action alcança**. Fechar isso exigiria pôr o commit numa superfície pública,
  e a decisão de `/status` ter duas profundidades diz que isso não se faz sem
  alguém escolher. Enquanto ninguém escolher, o veredito final é humano: abrir
  o `/painel` e ler o rodapé. Está escrito assim no próprio arquivo, em vez de
  a Action verde dar a entender que conferiu.

  **E A DETECÇÃO DE IP DO LIMITE DE TENTATIVAS ESTÁ ERRADA AQUI**, o que
  deixou de ser suposição: os cabeçalhos da resposta desta hospedagem trazem
  `server: hcdn` e um `x-hcdn-request-id` com o nó de borda no fim
  (`…-mum-edge10`). **Tem uma CDN na frente.**

  A volta de `enderecoDeQuemChama()` lê a ÚLTIMA entrada do
  `x-forwarded-for`, e essa regra assume **um proxy só, acrescentando no
  fim** — é o que um nginx faz, e era um nginx quando ela foi escrita. Com
  uma CDN na frente, a última entrada passa a ser a máquina da CDN, e não
  quem chamou: **o limite por IP conta a internet inteira como um endereço
  só**. O efeito é o pior dos dois: uma pessoa errando a senha três vezes
  gasta a cota de todo mundo, e um ataque distribuído some dentro dela.

  O caminho principal (`x-real-ip`) continua certo, e é por ele que quase
  toda requisição sai — então isto não está quebrado hoje, está frágil. O
  conserto é o cabeçalho que a CDN assina, e `enderecoDeQuemChama()` é o
  único lugar a mexer. Medir antes de mexer: o que a Hostinger escreve em
  `x-real-ip` e em `x-forwarded-for` se lê numa requisição só.

  **E O CADASTRO PÚBLICO DO SUPABASE PRECISA FICAR DESLIGADO**, que é uma
  configuração e não código — então nenhuma varredura deste repositório a
  alcança. A migration 0002 previu o risco no primeiro mês e a frase dela
  continua exata: `raw_user_meta_data` é escrito por quem se cadastra, o
  `coalesce` de `handle_new_user()` cai nele quando não há
  `raw_app_meta_data`, e `profiles.ativo` nasce `true` — então cadastro
  aberto é qualquer pessoa escolhendo o próprio perfil de acesso. Desligar
  não custa nada ao produto: quem cria conta é a Server Action com a chave
  de serviço, que não passa por essa configuração.

  **Quem avisa é o `/status`**, na versão pública, e foi ele quem avisou —
  em 29/09/2026 a chave estava ligada no projeto. É a única checagem do
  produto cujo alvo mora fora do repositório, e por isso ela é para ser
  LIDA, não presumida.

- **O BUILD É O DO WEBPACK, e o Turbopack morria no `globals.css`.** O Next 16
  constrói com Turbopack por padrão; `"build": "next build --webpack"` volta ao
  empacotador anterior, e é o que está no `package.json`.

  **O que o servidor relatou:** *"o processo Node do carregador PostCSS do
  Turbopack foi encerrado inesperadamente com status 0 ao interpretar
  globals.css"*. Veio com a conclusão de que o CSS estava inválido, ou o
  PostCSS incompatível, e com a sugestão de voltar para o `next@16.2.0`.

  **As três estão erradas, e a prova é de trinta segundos:** o mesmo commit,
  com o mesmo `globals.css`, constrói com Turbopack nesta máquina —
  `✓ Compiled successfully`, código de saída 0. Não há sintaxe a corrigir nem
  configuração a trocar, e um downgrade de framework para contornar o que um
  sinalizador resolve é pagar caro por uma solução pior.

  **A assinatura diz o que foi:** um processo que "falha" saindo com status
  **0** não travou por erro, foi **morto antes de entregar**. É limite de
  recurso, e não de sintaxe — o Turbopack abre um subprocesso Node para o
  PostCSS, e é ele que a hospedagem compartilhada derruba.

  **E a linha do tempo fecha sem folga.** O último deploy que passou foi o
  `a3ea860`; o primeiro commit depois dele é o `cd8349b`, que é o primeiro dos
  quatro que mexeram no `globals.css` — o arquivo foi de 696 para 803 linhas.
  Medido: Turbopack 1963 MB de pico, webpack 1752 MB. O build estava na borda,
  e 107 linhas de CSS o empurraram para fora.

  **O custo do `--webpack` está dito:** cinco vezes mais lento (18s → 90s), e o
  CI sai de 23s para perto de dois minutos. O que vai para o ar, esse encolhe —
  18 MB contra 242 MB, porque os 523 MB restantes são cache de build, que não é
  servido.

  **O gerador de protótipo NÃO acompanha**, e é consequência e não descuido:
  `scripts/prototipo.mjs` chama `npx next build` direto, não o script do
  `package.json`. As rodadas dele seguem rápidas, e ele compila com outro
  empacotador que o da produção — diferença pequena hoje, e escrita aqui para
  não ser descoberta como surpresa no dia em que ela importar.

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

### O `/status` é público, e conta duas coisas diferentes

Ele **precisa** ser público: `src/proxy.ts` manda todo mundo para lá quando não
há credenciais do Supabase, e travá-lo atrás de um login trava o diagnóstico no
único momento em que ele importa — nesse estado ninguém consegue entrar para
ver por quê.

O que não precisava ser público era o resto. Ele contava, a quem digitasse a
URL: o host do projeto Supabase, se o cadastro estava desligado, se a chave de
serviço existia, se o Resend estava configurado e se o envio estava ao vivo, e
**quais variáveis do Google faltavam, pelo nome**. Juntas, essas linhas são o
mapa de infraestrutura da agência — e nenhuma delas ajuda quem está do lado de
fora a entender por que a porta não abre.

**Então são duas profundidades.** Sem sessão de equipe sai o veredito e as duas
checagens da porta — variáveis e alcance —, que respondem *"é o sistema ou sou
eu"*. Com ela sai tudo. `/api/status/supabase` segue a mesma regra, senão ela
seria a porta dos fundos da tela.

**E a versão rasa não CALCULA o resto**, em vez de escondê-lo na tela: as
outras checagens não viajam pela rede nem existem no HTML. Esconder deixaria o
texto no bundle — é a mesma distinção entre não mostrar o botão e o banco
recusar.

**A ausência é dita.** Quem é da equipe e abriu sem estar logado lê uma linha
explicando que há mais para ver — senão conclui que as checagens sumiram do
produto e vai procurar o que não quebrou.

`obterSessao()` e não `exigirSessao()`: aquela redireciona, e redirecionar daqui
devolveria a pessoa para a tela de login que talvez seja justamente a que não
funciona.

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
    status/                   Diagnóstico da conexão com o Supabase (público em duas profundidades)
    api/status/supabase/      O mesmo diagnóstico em JSON, com a mesma regra
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
supabase/seed.sql             10 usuários de teste (uma pessoa desligada, com
                              equipamento em aberto), 3 empresas (uma desativada)
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
| `npm run check:tipos` | Confere que o `database.types.ts` acompanha as migrations, nos **dois sentidos**: coluna que o banco tem e o `Row` não — o `select("*")` a traz e o TypeScript não a conhece, então o campo fica invisível no produto sem nada quebrar (foi o caso de `clients.logo_url`, doze sprints como campo de anotação) — e coluna no `Row` que o banco não tem, que é a pior das duas porque **compila e o editor a autocompleta**: a recusa chega na tela de quem usa o sistema. Ele lê as migrations como quem as aplicaria (`create table`, as cláusulas de `alter table`, `drop column`, `rename`, `drop table`, `drop type`) e não consulta banco nenhum. Tabela alcançada só por RPC precisa de **motivo escrito** na lista de isentas, como o `-- SEM LINHA: 0026` do `onde-esta-o-banco.sql`. **E ele confere a mesma corrente um andar abaixo, em PARÂMETRO DE FUNÇÃO**: argumento que o tipo declara e a função não tem, parâmetro que a função tem e o tipo não oferece, e — a ponta que faltava — chave que uma chamada `.rpc()` manda e o tipo não declara. Esta última **não é erro de tipo**, e é por isso que ela precisa de checagem própria |
| `npm run check:drive` | Prova que o nome digitado — a empresa, o título da demanda — não alcança a linguagem de consulta do Drive. Duas travas independentes, e a ordem do escape |
| `npm run check:preview` | Prova que o servidor recusa buscar rede interna — os doze endereços, do `169.254.169.254` da nuvem ao `gopher://` do Redis, **pelos dois caminhos que buscam**: a prévia do link, com o endereço que a pessoa colou, e a capa da recomendação, com o que o site apontou. Ele confere o MOTIVO e não só a recusa: "o site não respondeu" é recusa da rede, e numa máquina onde o endereço responde ela vira um preview |
| `npm run check:feedback` | Prova que a verificação do texto do feedback continua pegando o que não pode chegar a uma pessoa: comparação com terceiros, julgamento de caráter, elogio vazio, nota, número que não está nos dados. **Mede os dois sentidos** — o primeiro caso é um texto limpo, que tem de sair com zero achados, senão uma função que acusa SEMPRE passaria em todos os outros. É a família do `check:email` e do `check:preview`: uma trava que, quando some, faz o programa fazer MAIS coisas não derruba build, nem tipo, nem a bateria de SQL |
| `npm run check:fronteira` | Confere que nenhum arquivo de servidor importa **valor** de arquivo `"use client"` — componente pode, função e constante não. É o erro que passa no build, no lint e no tipo, e só aparece quando alguém pede a página |
| `npm run check:prototipo` | Duas coisas, e as duas existem porque o protótipo não está no CI. **Que os stubs de `scripts/prototipo/` exportem tudo o que `src/` importa deles:** o `typecheck` não vê os stubs — ele checa contra os módulos de verdade, e a troca só acontece na cópia temporária, então um export que falta atravessa build, lint e tipo e só quebra depois de dois minutos compilando. **E que o TEXTO de cada seletor de clique ainda exista** em `src/` ou nos exemplos: a tela que muda de palavra deixa o seletor morto, e a imagem sai assim mesmo, com o nome de uma tela que ela não é. A busca cobre os exemplos de propósito — metade dos seletores aponta para dado semeado. **Ela ATRAVESSA LINHA desde a busca global, e não atravessava:** a expressão exigia o `nome:` e o `clicar:` na MESMA linha, então toda entrada escrita em mais de uma — que é como as longas são escritas — ficava fora da conferência. Ela dizia "31 textos, todos no produto" sem nunca ter olhado para treze deles; hoje são 44. Ela **não** prova que o seletor casa naquela rota, nem vê ambiguidade: isso é da rodada |
| `npm run prototipo` | Gera imagens das telas em `prototipos/`, grava o **HTML renderizado** de cada uma em `prototipos/html/` e, na rodada completa, roda o `check:sprint9` em cima dele. Roda o **axe-core** em cada tela viva depois do clique; o terminal mostra três exemplos por regra e a lista inteira, com o motivo de cada nó, vai para `prototipos/acessibilidade.json` — o corte serve para ser lido, o arquivo para ser consertado. **A rodada completa que termina em zero APAGA o arquivo**, e a filtrada não: deixado para trás, ele continuaria no disco com os achados da semana passada e cara de atual — a armadilha da tabela de migrations pendentes —, mas numa rodada de três telas "zero" quer dizer zero nelas, e apagar o relatório inteiro por causa de um recorte trocaria um arquivo velho por nenhum. Ele lista à parte a tela que respondeu 500, a que saiu **sem o clique** (o seletor não casou) e a que saiu **com um aviso de erro na cara** — esta última é a que o "sem o clique" nunca pega, porque o clique deu certo e foi a ação que falhou |
| `npm run check:sprint9` | O que a tela NÃO mostra: o vocabulário que o Full Academy não tem, **o vocabulário de desenvolvimento que nenhuma tela pode ter** (número de sprint, "em construção", `TODO`) e o que cada perfil alcança. Lê o texto RENDERIZADO dos dumps do protótipo — comentário não conta —; **sem eles, FALHA** em vez de passar em branco. **E o que a BARRA LATERAL lista**, esse recortado do `<nav>` e não da página inteira: "Campanhas ativas" é um cartão do Pulso, e a página toda diria que a entrada continua no menu |
| `scripts/agendar-rotinas.sql` | **Liga as rotinas diárias**, por `pg_cron`. Cola no SQL Editor uma vez, depois de habilitar a extensão em Database → Extensions. É **script e não migration** por duas razões: a extensão se habilita no painel, então um `create extension` falharia em qualquer ambiente sem ela; e agendamento não é schema, é escolha de operação. Traz também o `select` que confere e o `cron.job_run_details` que mostra cada execução — o único lugar onde se vê que a rotina rodou e não fez nada por não haver o que fazer, que é o caso normal e é indistinguível de não ter rodado. E o `unschedule` para desligar: aí `rotinas_agendadas()` volta a devolver false e as duas telas voltam a dizer que a geração é manual, sozinhas |
| `scripts/rodar-rotinas.sh` | As rotinas diárias: gerar as demandas recorrentes que venceram e apagar rascunho parado há mais de 7 dias. **É o mesmo arquivo que a Action chama de madrugada**, e não uma cópia — a decisão do `verificar.yml` ser chamado pelo deploy. Pede `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente; a chave entra pela **entrada padrão** do curl e nunca pela linha de comando, porque `ps` de um processo lê argumento de outro e o log do Actions ecoa o comando que falhou |
| `supabase/testes/rodar.sh` | Roda a bateria inteira contra um Postgres 16 de verdade, do zero |
| `scripts/migrations-pendentes.sh 0019 0020` | Junta as migrations que faltam num arquivo só, para colar no SQL Editor do Supabase |
| `scripts/exportar-antes-da-0043.sql` | Cola no SQL Editor e mostra a autoavaliação e as observações que a 0043 vai apagar. **Conveniência, não condição** — ao contrário do da 0034, estas tabelas a gestão já lia |
| `scripts/exportar-antes-da-0034.sql` | Cola no SQL Editor e mostra o que havia no Resumo Semanal e no Financeiro Pessoal, para entregar a quem escreveu antes de a 0034 apagar. Não muda nada |
| `scripts/campanhas-sem-demanda.sql` | Cola no SQL Editor: as campanhas abertas ANTES da 0051 ficaram com `task_id` nulo e sem etapa nenhuma. O PASSO 1 lista e já escreve as linhas do PASSO 2 prontas; o PASSO 2 grava. **Não é migration porque teria que inventar a pasta de entrega** — e a 0015 diz que inventar endereço é pior que não ter |
| `scripts/onde-esta-o-banco.sql` | Cola no SQL Editor e diz em que migration este banco está: uma linha por migration, e a primeira que disser FALTA é por onde continuar. É o curto, e é o que se roda antes de aplicar. **Quem confere que a lista acompanha a pasta é o `check:migrations`**, no CI. **E é a única resposta para "o que falta aplicar" — esta tabela não responde mais.** Ela já listou dezesseis migrations como pendentes, uma linha cada, com o que traziam e o que quebrava sem elas, e ficou **errada no dia em que cinco foram aplicadas e ninguém editou a prosa** — que é justamente o dia em que alguém a consulta. Pendência escrita à mão num arquivo de decisões é a armadilha do comentário datado da 0028: ela responde com confiança sobre um estado que não é mais o dela. O script pergunta ao banco; o que cada migration traz continua no cabeçalho dela, onde não envelhece |
| `scripts/conferir-migrations.sql` | O longo: item por item, para quando alguma coisa já parece errada. **305 linhas não sobrevivem a uma colagem de navegador** — foi o que aconteceu, e é por isso que existe o curto acima. **Ele vai da 0019 à 0040 e o cabeçalho diz isso**: sem a frase, um banco parado na 0054 leria tudo "ok" |
| `scripts/deploy.sh` | **Fora de uso — a VPS não existe mais.** Publicava na VPS, rodando **nela**, chamado pelo GitHub Actions por SSH |
| `scripts/prototipo-clicavel/` | Gera a página única e clicável para validação (veja o README de lá) |

## Histórico de sprints

| Sprint | Entrega |
| --- | --- |
| A porta | **A tela de login ganhou identidade nova**, em cinco rodadas de proposta — e as quatro primeiras foram recusadas com *"não gostei de nenhuma"*. O que estava errado era a **composição**, não o fundo, e a instrução que fechou é do usuário: *"centralize as informações, deixe o fundo preto, com um degradê azul passando, como se fosse uma molécula se dividindo e se juntando (…) apenas o logo da agência, sem escrever Full Hub, uma letra mais contemporânea, tecnológica"*. **A molécula é metaball**, e o efeito inteiro são duas linhas de filtro SVG: desfoca os seis círculos e **afia o canal alpha** — duas gotas desfocadas que se aproximam têm os halos somados, e o corte transforma a soma numa borda só. Sem o afiamento seriam manchas se sobrepondo, que é o que *parece* molécula e não é. Duas animações empilhadas em tempos que não batem: os átomos fundem e se partem em 26s, o conjunto atravessa em 64s. **O vidro é 82% opaco, e o número foi MEDIDO:** a proposta usava 58%, e com a molécula passando atrás o pior caso — o vidro sobre o ponto mais claro dela — dava `--auth-apoio` em **2,71:1**, o subtítulo e o link ilegíveis por um instante a cada volta, num tempo que ninguém reproduz de propósito. É a regra do selo de estado de outro ângulo: **ninguém mede uma cor que anda**. `--vidro-no-pior-caso` é um token que nada pinta, e existe só para o `check:cores` ter contra o que medir — contra o preto os três textos passariam por larga margem afirmando algo que a tela não garante; medido com mutação, três cenários caem. **A letra era Sora, carregada só em `(auth)`** — e deixou de ser: a Google Sans passou a valer no produto inteiro, por decisão do usuário, e a porta não tem mais letra própria. O título do login **alterna** entre a saudação e o lema da agência com as palavras subindo do desfoque, em CSS puro — a porta é a tela que alguém abre quando nada mais funciona, e uma frase que depende de hidratar pode não aparecer. **O `<h1>` continua "Entrar" e é `sr-only`:** sem isso a mesma tela teria dois títulos diferentes conforme o segundo em que alguém chegasse nela. **Dois achados foram da imagem e não do build:** os átomos saíram chapados (na proposta cada um era degradê radial), e o quadro em repouso era o de máxima separação — seis discos num canto —, consertado com atraso negativo nas duas animações. De quebra, **o wordmark de três linhas saiu do produto** junto com a coluna escura que existia para dar largura a ele, e isso fica escrito em vez de virar ausência silenciosa. |
| Sprint 3H | **Feedback de desenvolvimento assistido por IA.** Migration 0075: quatro tabelas, sete funções, e a exposição jurídica registrada no cabeçalho — **isto não é avaliação de desempenho**, e se um dia for, a regra muda inteira e passa pelo jurídico antes (LGPD, Art. 20). As três regras do módulo têm consequência de schema: comparação só consigo mesma (nenhuma função devolve duas pessoas lado a lado), os números crus na mesma linha do texto, e revisão humana por padrão. **Um rascunho vazado é pior que nenhum feedback**, e os cenários guardam os CINCO status que não são `enviado`. Quatro divergências do texto do sprint, todas sobre o produto como ele está: rascunho é `publicada_em is null` e não um valor de enum (quarto sprint a errar nisso); a tabela de autoavaliação foi apagada na 0043, então "o que ela quer desenvolver" virou "o que ela estudou"; não há Edge Functions aqui, e a geração periódica continua pendente da URL do app; e metade das métricas já existia — o que se copia da 0035 é a FORMA de cada conta, para a tela de Métricas e o feedback não discordarem sobre a mesma pessoa. **Três achados da bateria, e os três eram bugs**: `carga_do_dia()` devolvia zero num período fechado e o texto dizia a quem entregou o mês inteiro que a entrega baixa dela foi distribuição de trabalho; a proporção da capacidade acusava ociosidade num mês em que ninguém estimou; e `recebe_feedback_ia` nasceu inalcançável por quem ela é para. **83 cenários novos, 1494 no total**, medidos com quatro mutações. O `check:feedback` achou um bug meu na primeira rodada — o teto de três dígitos deixava a checagem de número cega para `2400` —, e o `check:cores` pegou os meus próprios comentários citando os dois nomes mortos que a varredura proíbe, pela sétima vez. |
| Sprint 3F | **Comodatos: qual equipamento está com quem.** Migration 0069, e o **segundo módulo do zero em poucos sprints** — não havia ponte para atravessar desta vez, nem tabela nem coluna esperando alguém. `assets`, `asset_loans`, `asset_photos`, `asset_events` e `asset_term_template`, com duas visões da mesma informação numa rota só: o colaborador vê o que está com ele, a gestão vê o inventário inteiro. **A divergência do texto do sprint é de segurança**, e as duas frases dele não cabiam juntas: ele manda deixar o colaborador ler a linha do equipamento e, na linha seguinte, esconder `valor_aquisicao` numa view — mas **uma view não limita a tabela de baixo**, e com a policy permitindo a linha o valor sai por um `select=valor_aquisicao` no PostgREST. É a regra que o produto já escreveu três vezes de outro jeito: policy não limita coluna. Então a linha ficou **fora do alcance** e o recorte vem de `meus_comodatos()`, `security definer` — a forma de `usuarios_do_meu_cliente()`. **O índice único parcial é a trava** contra dois empréstimos do mesmo item, e não a consulta (0040); **o status é escrito pelo empréstimo**, por trigger; **atraso é derivado**, nunca coluna. **O termo é SNAPSHOT e não arquivo:** o corpo congela na entrega, porque o modelo é editável e um termo é o que a pessoa aceitou naquele dia — e o PDF é montado no download, porque o próprio sprint descreve o documento como vivo (o aceite aparece nele depois de acontecer), e um PDF gravado na entrega não tem como ganhar uma linha. Por isso não há bucket de termos. **A folha do equipamento é tabela própria e não o `audit_log`**: aquela trilha é só do sócio desde a 0058, e o que ela grava é diff de coluna, não fato. No desligamento, o equipamento em aberto **avisa com caixa obrigatória em vez de recusar** — travar deixaria a agência sem conseguir desligar quem já foi embora; o que ela impede é desligar sem ver. **61 cenários novos, 1355 no total**, e quatro bugs reais na primeira rodada: um `case` devolvendo texto para coluna de enum, emprestar criando DOIS eventos `emprestado` (o trigger de status e o do empréstimo), e `asset_term_template` com `id boolean primary key` — engenhoso, e quebra `registrar_auditoria()`, que grava o id num `uuid`. **E um cenário que passava pelo motivo errado:** a mutação que tirava a checagem de dono de `confirmar_recebimento()` não era pega, porque o teste procurava o empréstimo por um `select` que a RLS da outra pessoa não resolve — ele media a policy de SELECT, não a pergunta de propriedade. Com o id literal, a mutação cai. **E o seed passou a ter alguém desligada**, com uma lente em aberto: sem ela o alerta mais caro do módulo nunca aparece em desenvolvimento — a lição da 0062 aplicada antes do bug em vez de depois. |
| Sprint 15 | **A agência passou a responder sobre si mesma.** A camada de indicadores existia desde a 0035 e o resumo da Home desde a 0049, e nenhuma tela as lia. A Home ganhou os **nove blocos**, na ordem do dia da pessoa — quem sou eu, o que eu entrego hoje, o que está parado me esperando, quem não está aqui, para onde eu vou, e só então o panorama da gestão: quem abre esta tela abre para trabalhar. "Meu dia" é o **mesmo componente de Minhas Tasks**, que já estava separado desde o Sprint 4 esperando exatamente isto. `/painel/metricas` traz cinco abas com o **período como CHAVE e não como as duas datas** — "últimos 30 dias" salvo como `de=2026-08-26` é um link que envelhece calado —, e `QUEM_VE` espelha a primeira linha de cada função da 0035: quatro de `is_gestor()`, a rentabilidade de `is_socio()`. `ouFalha()` em todas, e aqui ele vale mais que de costume: a recusa dessas funções chega como erro, e sem ele o painel mostraria zeros — **painel zerado não parece recusa, parece agência parada**. `/painel/resumo-agencia` é a conversa de segunda-feira, e é **módulo antes de ser tela** (`lib/reports/weekly.ts`), porque a mesma função serviria o envio automático que ainda não existe. De quebra, o **CSV deixou de ter seis donos**: `montarCSV` morava dentro do Financeiro e a Academy importava dali, e as cópias já divergiam — o BOM que o Excel precisa estava em quatro das cinco telas. **Quatro erros meus, e nenhum o `npm run build` pegaria:** o cartão dizia "11 entregues" e o bloco logo abaixo contava 7, porque `producao_do_periodo()` conta só folha e as listas contavam agrupadora junto (foi a imagem que pôs os dois números lado a lado); em 375px a barra de abas empurrava a página inteira para os lados, e o **Full Days tinha a mesma linha desde o Sprint 6**; o título da etapa em "Meu dia" encolhia até "Re…" no celular; e o meu próprio comentário explicando por que o estado passa pelo mapa de rótulos **citava a palavra que a 0016 proibiu** — sétima vez na mesma armadilha. E o seed concluía duas etapas por INSERT, onde o trigger de UPDATE não roda: `concluida_em` nulo fazia toda conta de entrega responder **zero, que é plausível**. |
| Sprint 10 | **O Calendário Full**: migration 0055, com `events`, `event_participants` e a view `calendar_events` juntando sete origens num formato só. **A linha mais importante é `security_invoker = true`** — sem ela a view roda com os direitos de quem a criou e lê as sete tabelas inteiras para qualquer pessoa autenticada, num objeto que o PostgREST publica sozinho. E o furo **passa despercebido num banco com um cliente só**: ele vê seis campanhas, que é o total, e "seis de seis" tem a mesma cara com a RLS ligada e desligada; por isso a bateria cria material de duas empresas, e tirando a cláusula seis cenários falham e dizem o que vazaria. **Quatro divergências do texto do sprint**, e a primeira é grave: ele filtra rascunho por `status in ('rascunho','cancelada')` e **nenhum dos dois existe** — `rascunho` nem é valor do enum, e o Postgres recusaria a criação da view com um erro falando de enum; `carga_do_dia()` já existia desde a 0035 e nada aqui recalcula; `capacidade_minutos_dia` não existia e nasce por pessoa; e "não incluir posts e campanhas ainda" está vencido, porque os dois módulos existem. Quatro visões, e a Linha do Tempo é a que responde "a equipe aguenta?" — com a coluna de nomes fixa, que quase não foi: o `overflow-hidden` do invólucro cria um scrollport e quebra o `sticky`, e a imagem mostrou "Carla Nunes" lida como "nes". **A ausência chegava com a chave do enum no título** e ia crua para a tela — a palavra que a 0016 tirou de propósito, e que `check:cores` não pegaria porque ele procura as formas acentuadas. **1000 cenários**, 24 novos, com mutação no `security_invoker`. |
| Campanhas ponta a ponta | **A campanha virou trabalho de verdade**, em seis migrations e uma sequência de decisões do usuário. **0050 — a capa:** "para ser identificável direto pela imagem qual campanha é". **0051 — a campanha nasce com a DEMANDA**, uma etapa por entregável: a ponte (`deliverables.subtask_id` e `responsavel_id`) existia desde a 0033 e ninguém a atravessava, então a coluna nova é uma só. Tudo numa transação, porque a terceira de cinco escritas falhando deixaria uma campanha ligada a uma demanda com metade das etapas. **E ela se finaliza sozinha, nos dois sentidos** — "só é finalizada quando todas as suas etapas são entregues", e uma peça nova a reabre. **0052 — quem aprova a peça conclui a etapa:** "o responsável entrega, e o cliente conclui". O trigger **nunca derruba a aprovação do cliente**: ele está do outro lado sem ninguém por perto, e o que veria seria a aprovação dele falhando por causa de uma etapa que nem sabe que existe. **0053 — vários arquivos na mesma versão**, porque uma entrega é o PDF, o AI e o JPG; a capa passou a ser a primeira IMAGEM, não o primeiro arquivo. **0054 — o módulo virou "Campanhas", foi para a Principal e abriu para `EQUIPE`**: quem produz precisa chegar ao material dele. Abrir campanha continua sendo de quem abre demanda, e `campaigns_insert` fechou em `is_atendimento()` — a mesma função de `tasks_insert`, não uma parecida. **E a tela onde a equipe sobe o material não é área nova:** `deliverable_versions` já tinha versão, arquivo e justificativa desde a 0033 — faltava a tela, como no Social Media até a 0042. **O bug que abriu tudo isso:** `COLUNAS_DA_CAMPANHA` citava `clients(nome)` e a coluna é `nome_empresa`; o PostgREST recusa o `select` inteiro, o erro era descartado, e a tela dizia "Nenhuma campanha aberta" para quem tinha acabado de criar uma — **uma leitura que falha calada é pior que uma escrita, porque lista vazia é indistinguível da verdade**. Daí `ouFalha()`. **E de quebra, um bug de duas migrations atrás:** a 0030 reescreveu `validar_transicao_de_subtarefa()` a partir das quatro travas e perdeu o bloco de carimbos — desde então nenhuma subtarefa tinha `concluida_em`, e o contador de concluídas do mês respondia zero, que é plausível. **968 cenários**, com mutação em cinco travas. |
| Depois do 14 | **O terceiro módulo saiu do produto**, por decisão do usuário: o Meu Desenvolvimento. Tela, rota, a aba Skills em Equipe, a vitrine da Academy e duas tabelas -- `user_skills` e `skill_avaliacoes` -- apagadas na migration 0043. **O catálogo `skills` FICA**, e foi a escolha explícita: ele continua com um papel só, o vocabulário de etiquetas do Full Academy, e apagá-lo junto levaria a etiqueta de cada material. **Isto não é a 0034**: lá as tabelas fechavam em `auth.uid()` e o script de exportação era condição para apagar; aqui as duas sempre foram legíveis por `is_gestor()`, e o `exportar-antes-da-0043.sql` é conveniência. **A sugestão de skill saiu junto**, que é a parte que passa batida: a fila que decidia as sugestões morava na tela que saiu, então `sugerida_por` virou coluna que nada preenche e a policy oferecia um caminho inexistente. As abas de Equipe sumiram com a segunda -- uma navegação de um item é moldura sem função --, e o módulo voltou a se chamar **Equipe**. **A varredura de nomes mortos pegou três coisas que o `npm run build` não pegaria**: duas consultas órfãs a `user_skills` que eu tinha deixado em `lib/dados/academy.ts` e que falhariam no banco depois da migration, os tipos das duas tabelas ainda declarados, e os meus próprios comentários explicando a remoção citando os nomes que ela proíbe -- a mesma armadilha da 0016 e da 0034. E a ordem da migration custou uma rodada: `skills_insert` citava `sugerida_por`, e coluna citada em policy não sai enquanto a policy estiver de pé, exatamente como a 0039 já tinha aprendido com um trigger. **770 cenários** (os 27 do módulo viraram 10, virados do avesso: se as tabelas renascerem, o primeiro falha e diz qual). |
| Sprint 14 | **O Social Media ganhou o lado da agência.** Migration 0042. O Portal estava pronto desde o Sprint 12 e o lado de cá não existia: para um post chegar ao cliente, alguém colava SQL no Supabase por um script que o próprio cabeçalho mandava apagar no dia em que a tela existisse -- e ele foi apagado neste commit. **São três mãos**, por decisão do usuário: a gestão abre o briefing, o colaborador liberado produz, a gestão revisa e envia. `posts_insert` passou de `is_staff()` a `is_gestor()`, entrou `responsavel_id`, e a mão é **derivada e nunca gravada**, como bloqueio de subtarefa e atraso do Financeiro. **E o sprint quase virou do avesso a trava que protege o cliente**: `validar_nova_rodada` perguntava quem produziu olhando `criado_por`, que agora é a gestão -- o colaborador não conseguiria pedir o aval interno, e o responsável que produziu poderia mandar a própria entrega. Entrou `dono_do_post()`, e a bateria guarda o cenário virado do avesso. **A pergunta "por onde se escolhe vídeo, carrossel, estático ou stories" eram duas perguntas**: `midia` é o que a tela desenha e virou enum (decide qual editor aparece); `formato` é onde vai ao ar e continua texto, porque Reels e Shorts são de uma safra e a próxima vem aí -- a 0032 já tinha decidido isso e estava certa. Carrossel são `post_versions.arquivos` em jsonb, e **`posts.arte_url` continua sendo a capa**, o que faz o calendário, o card e a miniatura do portal não saberem que carrossel existe. **Vídeo é por link** (decisão do usuário, com o custo dito: o cliente decide longe do botão de aprovar), e o banco recusa enviar vídeo sem o link. Na tela, **duas visões na mesma rota** -- lista + editor e calendário + painel, escolhidas entre três propostas -- com **um editor só** nas duas, a lista agrupada por **quem está segurando** e não por status, e o **"Enviar ao cliente" desligado com a razão escrita** em vez de sumir. **32 cenários novos, 785 no total**, com mutação em três travas. **Seis erros meus**, e vale a lista porque quatro são de família: montei `validar_nova_rodada` a partir da 0032 quando a 0033 já a tinha reescrito (apaguei o `deliverable`, e o sintoma saiu três arquivos adiante); pus o bloco do vídeo no ramo do entregável em vez do post; criei um **segundo** trigger para a mesma função, quebrando o teste que sabia desligá-la; ressincronizei estado do editor num `useEffect` em vez de `key`; dei à Revisão um azul que no tema claro **é** o mesmo da Produção, deixando duas entradas de legenda com uma cor só; e os posts antigos precisavam de conversão de `formato` para `midia`, sem a qual um carrossel abriria no editor de arte única -- quem mostrou foi o seed. |
| Sprint 3D | **Demandas recorrentes.** Migrations 0040 e 0041: `task_recurrences` com a regra e `recurrence_runs` com cada execução, em **dois modos** -- uma task por mês com uma etapa por dia (trabalho diário, senão o board teria vinte e duas linhas do mesmo trabalho) ou uma task inteira a cada repetição (quando cada uma tem etapas próprias). **A idempotência é o índice único e não uma consulta**: a execução é inserida primeiro, com `on conflict do nothing returning id`, e sem linha de volta a chamada desiste -- duas abas clicando em "Gerar agora" passariam pelas duas consultas antes de qualquer uma gravar. **Nunca retroativo**, e a geração **não roda sozinha**: o agendamento é de outro sprint. O `exception` fica dentro do laço, senão uma regra quebrada levaria junto as outras dezenove da madrugada. Na tela, a aba mora ao lado dos workflows, e **a prévia das cinco próximas é a razão do formulário ter este formato** -- uma recorrência é a única coisa no produto que cria trabalho sozinha, de madrugada, e sem a prévia o primeiro retorno de uma regra torta chega quando alguém vê doze demandas iguais no board; ela recalcula a cada tecla, o que é por que `proximasOcorrencias()` existe ao lado de `datas_da_recorrencia()`. Três pontos de entrada: "Nova recorrente" em Gestão de Tasks, o selo **Recorrente** na task gerada (um link para a regra) e **"Transformar em recorrente"** no fim do detalhe -- que **abre o editor pré-preenchido e não grava nada**, porque uma task não sabe a cadência dela: ela tem um período, não uma frequência. A 0041 veio por decisão do usuário e acrescentou o **responsável padrão da regra**, `coalesce(etapa, padrão)` nessa ordem: o buraco eram os dois caminhos em que ninguém preenche etapa por etapa, e etapa sem dono não aparece no "Minhas Tasks" de ninguém. **77 cenários novos, 753 no total**, e três erros meus que a verificação pegou: o rótulo "semana de" numa regra mensal (o seed mostrou), uma checagem de `pessoa_desligada()` duplicada que o teste de mutação provou ser uma segunda verdade, e **"Gerar agora" gerando numa regra pausada** -- a imagem do protótipo mostrou o botão ao lado da frase que diz que nada mais é gerado. De quebra, dois erros de layout que só a imagem pega: o `SelectTrigger` nasce `w-fit` e o de Cliente saiu como um botão sem rótulo, e em 375px o "Criar recorrência" ficava acima da prévia. |
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
| Sprint 3B | A subtarefa vira a unidade de trabalho: a Task perde responsável, prazo e tempo próprios e ganha período; migration preservando toda atribuição existente como subtarefa "Execução"; máquina de estados no banco (conclusão bloqueada sem aprovação, dependência travando o início, ninguém aprovando a si mesmo, ciclo recusado); status da Task calculado por trigger com `entregue` e `cancelada` como únicos manuais; fluxo de aprovação em rodadas que nunca se sobrescrevem, com aval interno sempre antes do envio ao cliente; tipos de tarefa e workflows com snapshot; tela de workflows, fila de aprovações internas e aprovação do cliente no Portal; tempo em minutos com entrada flexível; e 61 cenários de RLS em `supabase/testes/`. |
| Sprint 4 | Minhas Tasks: visão pessoal em `/painel/minhas-tasks` para todo perfil interno, mostrando as tasks onde a pessoa é responsável **e** as subtarefas dela dentro de tasks alheias; três contadores clicáveis (atrasadas, para hoje, esta semana) que filtram e batem com as listas; widget "Meu dia" com conclusão em um clique; board, lista e calendário reaproveitados por parâmetro (clique abre painel lateral, card de task alheia não arrasta); calendário com barra colorida por situação, rótulo Entrega/Etapa, chip do cliente e legenda; detalhe em painel lateral sem trocar de página; criação de task restrita a `is_atendimento()` na interface e na policy; e registro de tempo ao concluir task ou subtarefa, com a estimativa sugerida e opção de pular. |
| Sprint 3 | Gestão de Tasks: tabelas `tasks` / `subtasks` / `task_referencias` / `task_comentarios` com RLS por `pode_editar_task()`, board com arrastar e soltar otimista, lista com edição inline e ações em massa, calendário mensal e semanal mostrando prazo de task e de subtarefa separados, editor rico TipTap no briefing, detalhe em duas colunas com comentários e referências em bucket privado, filtros na URL e atalhos N e /. |
| Sprint 2 | Cadastro base: módulos Clientes e Equipe completos, criação de usuários no servidor com chave de serviço, convite de acesso ao portal, enum `team_funcao` com `is_atendimento()`, desligamento em duas etapas com transferência, exclusão de cliente em duas etapas bloqueada por vínculos, e Meu perfil com avatar no Storage. |
| Sprint 1 | Estrutura do dashboard: `lib/auth/permissions.ts` como fonte única do menu e das permissões, menu lateral colapsável com seções e gaveta no celular, topbar com trilha, busca (casca), sino e menu do usuário, 15 rotas placeholder validando o perfil no servidor, cor de marca em variável CSS, 10 componentes compartilhados com vitrine em `/painel/dev/componentes`, e o casco do Portal do Cliente com navegação superior. Nenhuma tabela nova. |
