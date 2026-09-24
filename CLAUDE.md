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
  muita agência. **E a segunda continua travada:** `validar_nova_rodada`
  recusa *"Ninguém envia ao cliente a própria entrega"*, desde a 0007. A 0029
  mexeu em quem aprova, não em quem envia — são duas decisões, e o usuário
  mudou uma.
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

**Rascunho sem alteração há 7 dias é apagado**, com aviso na Home no sexto
dia. A limpeza **não roda sozinha** — o agendamento é do Sprint 16; até lá,
chamar `limpar_rascunhos_abandonados()` é ato de alguém.

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
operações — nem o sócio lê, pela mesma razão do Resumo Semanal. Uma linha por
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

Cada abertura vira linha em `client_portal_views` — insumo da auditoria do
Sprint 16. A RLS só aceita a linha em nome de quem está logado, e não existe
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

### O Resumo Semanal é privado

`weekly_entries` e `weekly_notes` fecham em `user_id = auth.uid()` nas quatro
operações. **Nem o sócio lê o registro de outra pessoa**, e não existe
relatório, painel nem exportação da gestão que alcance esse texto — a única
exportação é a da própria pessoa, em `/painel/resumo-semanal/exportar`, que
não aceita parâmetro de usuário justamente para ninguém tentar.

É a memória de quem trabalhou, e é ela que a pessoa leva para a conversa de
desenvolvimento. Se um dia a agência quiser que a gestão leia, que seja decisão
explícita com policy nova e aviso na tela — não um descuido.

A semana é de **segunda a domingo**, escrito à mão em toda chamada do date-fns
(`lib/dominio/semanas.ts`): o locale pt-BR começa no domingo, que é a convenção
de calendário de parede, e aqui a unidade é a semana de trabalho. A semana sai
da data por cálculo e **nunca é gravada** nas entregas: coluna de semana ao
lado da data é um jeito de as duas discordarem. Em `weekly_notes` a semana *é*
a chave, e por isso um `check` exige que ela seja uma segunda-feira — duas
telas com ideias diferentes de onde a semana começa criariam dois registros
para a mesma semana, e o `unique` não pegaria.

Duas coisas por semana, e elas são diferentes: a **entrega** é uma linha do que
saiu, e a **nota** é o texto livre de como foi. O editor salva sozinho, com
1,2 s de espera depois da última tecla — ninguém escreve uma reflexão de uma
vez só, e um botão "Salvar" é o jeito mais seguro de perder o parágrafo que a
pessoa estava terminando. "Como foi a semana" é opcional de propósito:
pergunta obrigatória produz resposta automática, que não diz nada.

A nota é gravada **nos dois formatos** — o JSON do TipTap, que a tela reabre, e
o texto puro, que a busca varre. Guardar só o JSON obrigaria a busca a
vasculhar nomes de nó; guardar só o texto perderia a formatação.

- **Registro do que não aconteceu não é registro, é ficção.** Semana futura e
  entrega com data futura são recusadas por trigger, não pela tela.
- **"Puxar minhas entregas" data cada linha no dia da conclusão da etapa**, e
  nunca em hoje nem no fim da semana. A primeira versão datava tudo no domingo
  da semana aberta, que ainda não chegou: o trigger recusava o lote inteiro, e
  o botão nunca funcionava dentro da semana em curso — que é quando a pessoa o
  usa. Os dois cenários que travam isso estão em `06_skills_e_desenvolvimento`.
- **Puxar não roda sozinho ao abrir a tela.** O registro é a leitura que a
  pessoa faz do próprio trabalho; lista preenchida por máquina deixa de ser
  dela. E puxar duas vezes não duplica: o filtro é por `subtask_id`.
- A busca varre as **duas** coisas, entrega e nota, porque quem procura
  "campanha de outubro" não lembra em qual das duas escreveu. O termo mora na
  URL, e enquanto ela está ativa a semana sai da tela em vez de dividir espaço
  com os resultados.
- A exportação é **texto puro**, não PDF: o que a pessoa faz com isso é colar
  num documento, mandar num chat ou guardar. Texto serve para os três e não
  depende de nada instalado.

### Skills: a pessoa diz o nível, a gestão comenta

`skills` é o catálogo compartilhado — é ele que faz "quem sabe fazer X?" ter
resposta, o que uma lista de texto livre por pessoa nunca teria.

**`user_skills` só a própria pessoa escreve. Nem o sócio.** Autoavaliação que
outro pode editar não é autoavaliação, e a tela deixa isso explícito: "o nível
é seu: ninguém da gestão escreve por você — e é isso que permite dizer
'iniciante' sem receio". O que a gestão escreve é `skill_avaliacoes`, uma
observação separada que **a pessoa avaliada lê** — nota sobre alguém que a
pessoa não pode ler é fofoca com carimbo do sistema.

- **O nível vem com a rubrica.** `DESCRICAO_DO_NIVEL` viaja no rótulo
  acessível e no `title` de cada segmento: sem régua, o "avançado" de uma
  pessoa é o "intermediário" de outra e a matriz deixa de comparar.
- Quatro segmentos e não um `<select>`: o nível é uma escala, e escala se lê de
  relance quando tem forma. Numa lista de vinte skills, vinte caixas fechadas
  não deixam ninguém ver o próprio perfil.
- **`ativa = false` tem dois significados**, e `sugerida_por` distingue:
  arquivada pela gestão (nulo) ou sugerida por alguém da equipe esperando
  decisão (preenchido). Sem essa coluna, aprovar uma sugestão e reativar uma
  skill velha seriam a mesma ação.
- **Lacuna é onde o trabalho acontece e depende de pouca gente**, não onde o
  número é zero: skill que ninguém tem em nível nenhum é uma linha do catálogo
  que a agência não usa. O caso que mais passa batido é o **um** — uma pessoa
  só, que entra em recesso.
- "O que as pessoas querem desenvolver" sai de `quer_desenvolver`, marcado por
  elas mesmas. É o insumo do Full Academy, e o jeito mais barato de saber o que
  vale ensinar.

### O Financeiro da agência é só do sócio

`contracts`, `finance_categories` e `finance_entries` fecham em `is_socio()`
nos quatro comandos. **Não existe "só leitura para o gestor", e a omissão é
deliberada:** o desenvolvedor é gestão para todo o resto do sistema — cadastra
cliente, aprova entrega, distribui trabalho — e aqui não. Faturamento por
cliente, margem e inadimplência são a informação mais sensível da casa; quem
pode lê-la é quem responde por ela.

Com o Resumo Semanal e o Financeiro Pessoal, são os dois extremos do sigilo no
produto — lá nem o sócio entra, aqui só ele. Os dois ficam lado a lado na
migration 0013 de propósito: quem mexer numa dessas policies vê a outra na
mesma tela.

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

### O Financeiro Pessoal é opcional, e o produto trata assim

`personal_finance_entries` fecha em `user_id = auth.uid()` nas quatro
operações. **Nem o sócio lê**, não existe relatório agregado, e nenhuma
consulta do painel cruza esta tabela com nada — a mesma regra do Resumo
Semanal, pela mesma razão: basta um relatório da gestão citando um número daqui
para a confiança acabar de vez.

- **Fica no fim da seção Principal, com peso visual reduzido** (ícone menor,
  `--text-on-dark-muted`). Foi aba de Meu Perfil do Sprint 3C ao 8 e voltou ao
  menu quando o módulo passou a existir — duas portas para a mesma tela
  confundem quem procura.
- **Fora da tela inicial, sem notificação e sem selo de pendência.** Quem não
  quiser usar nunca é lembrado de que ele existe.
- **"Apagar todos os meus dados", em duas etapas.** Um módulo do qual não se
  consegue sair não é opcional — e é por isso que existe policy de DELETE.
- `on delete cascade` no usuário: aqui o histórico **não** é para preservar. Se
  a pessoa sai da agência, o controle de gastos dela vai junto — o oposto do
  que vale para autoria de task.
- A adição é uma linha só, sempre visível: diálogo para cada gasto de padaria
  mataria o hábito na primeira semana.

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


**15 dias de descanso por ano, em até duas parcelas.** Os dois números são
colunas de `team_members` (`dias_ferias_ano`, `max_parcelas_ferias` — nomes
anteriores à troca de vocabulário), não constantes no código: contrato muda
por pessoa, e mudar contrato não pode exigir deploy.

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

**A tela de pedido é três seções numeradas**, como a de Nova Task: escolher as
datas (com o tipo de pedido no cabeçalho da seção, porque ele muda o que o
resto significa), o período selecionado, e a observação. O **saldo abre a
tela** em vez de ficar no painel lateral: é a primeira coisa que quem entra
ali quer saber, e era preciso varrer o olho até a coluna da direita para
achar. Quem pede afastamento ou ausência pontual não vê saldo nenhum — não
desconta.

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
acompanhamento deixa de dizer a verdade. `verificar-9.mjs` varre a tela atrás
dessas palavras toda vez, porque critério que diz "não existe" é o tipo que
volta sem ninguém perceber.

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
| `npm run lint` / `npm run typecheck` | Padrões e tipos |
| `npm run check:supabase` | Testa a conexão com o Supabase pelo terminal |
| `npm run check:cores` | Contraste dos pares texto/fundo, cor literal fora dos tokens, classe de cor inexistente e nome que saiu do produto |
| `npm run check:mensagens` | Confere que nenhuma action devolve a mensagem crua do zod, e que o nome da action no log bate com o `executarAcao` em volta |
| `npm run check:migrations` | Confere que nenhuma migration cita `$$` dentro de comentário e que todo marcador de dollar quoting abre e fecha |
| `npm run prototipo` | Gera imagens das telas em `prototipos/` |
| `supabase/testes/rodar.sh` | Roda a bateria inteira contra um Postgres 16 de verdade, do zero |
| `scripts/migrations-pendentes.sh 0019 0020` | Junta as migrations que faltam num arquivo só, para colar no SQL Editor do Supabase |
| `scripts/conferir-migrations.sql` | Cola no SQL Editor e diz, migration por migration, o que já entrou e o que falta. Não muda nada |
| `scripts/deploy.sh` | Publica na VPS. Roda **na** VPS; o GitHub Actions o chama por SSH |
| `scripts/prototipo-clicavel/` | Gera a página única e clicável para validação (veja o README de lá) |

## Histórico de sprints

| Sprint | Entrega |
| --- | --- |
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
