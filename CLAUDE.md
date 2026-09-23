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
- "Minhas tasks" quer dizer "as tasks onde eu tenho subtarefa".
- O que a Task mostra de tempo é a **soma** das subtarefas.
- Atraso é da subtarefa. Uma demanda está atrasada quando alguma etapa em
  aberto passou da data.

### O status da Task é calculado

`recalcular_status_task()` roda por trigger a cada escrita em `subtasks` e em
`approval_rounds`. A precedência, na ordem:

`em_ajustes` → `em_aprovacao` → `concluido` → `aguardando_informacoes` →
`em_andamento` → `nao_iniciada`.

**`entregue` e `cancelada` são os únicos manuais.** "Entregue" diz que o
material saiu; não diz que foi aprovado, e a interface precisa manter essa
diferença no texto. O cálculo respeita o que foi marcado à mão até aparecer
rodada pendente, ajuste ou conclusão — qualquer um dos três reassume e zera
`status_manual`.

No board, arrastar só é aceito para esses status manuais. Qualquer outro
arrasto é recusado com o motivo por extenso, porque o recálculo desfaria a
mudança um milissegundo depois.

### A aprovação

Quem executa produz e envia. Quem valida internamente é a gestão. Quem envia ao
cliente é a gestão. Quem aprova ou pede ajustes lá fora é o cliente.

- **Subtarefa com `requer_aprovacao = true` nunca chega a `concluida` pela mão
  do responsável.** A única porta é uma rodada aprovada, e quem recusa é o
  trigger `subtasks_bloqueia_conclusao_sem_aprovacao` — não a tela.
- **Toda aprovação abre primeiro uma rodada interna**, mesmo quando o tipo é
  `cliente`. O tipo diz o destino final, não o caminho.
- **Ninguém aprova a própria entrega.** `pode_aprovar_subtarefa()` e o trigger
  `approval_rounds_sem_autoaprovacao` cobrem os dois lados.
- **Aprovar não envia.** Aprovar diz que o material está bom; enviar diz que é
  agora. São duas decisões, e juntá-las já mandou peça errada para cliente em
  muita agência.
- **Rodada fechada nunca é reescrita nem apagada.** Cada ciclo de ajuste cria
  uma rodada nova, com número maior, e as anteriores continuam no banco com o
  que foi pedido e decidido.
- Pedir ajustes **exige** comentário, na action e no banco.

#### A demanda inteira também tem uma exigência

A subtarefa diz "esta arte precisa de aval". A Task diz "esta campanha pode
sair sem o cliente ter visto?". São perguntas diferentes, e a segunda é
`tasks.exigencia_aprovacao`: `nenhuma`, `interna` ou `cliente`.

**São três valores e não quatro.** `cliente` já passa pela interna — é a mesma
regra de sempre, toda aprovação abre primeiro uma rodada interna. Um quarto
valor "dupla" teria exatamente o efeito do terceiro, e dois jeitos de dizer a
mesma coisa é como nascem duas verdades sobre a mesma demanda.

**É regra, não orientação:** `tasks_exige_aprovacao_para_entregue` (migration
0014) recusa marcar `entregue` enquanto não existir rodada **aprovada** do
escopo exigido em alguma subtarefa da task. Rodada pendente não conta — pedir
aprovação não é ter aprovação, e é essa confusão que a trava existe para
impedir.

A trava olha só a transição para `entregue`. Cancelar, corrigir o título de
uma task já entregue e o recálculo automático seguem passando: uma trava que
freasse tudo seria trocada por outro caminho na primeira semana.

**Exigir o que ninguém vai cumprir é beco sem saída, e a mensagem aponta a
saída.** Se a demanda exige aprovação do cliente e nenhuma subtarefa pede essa
aprovação, o encerramento trava para sempre. A recusa então tem texto próprio,
e o `hint` diz o caminho — marcar a etapa que precisa de aval, não aprovar mais
rápido. Por isso `atualizarTask` concatena o `hint` do Postgres na mensagem:
descartá-lo deixaria a pessoa com um "não pode" sem saída. O formulário ainda
avisa na criação, sem bloquear, porque montar as etapas depois é caminho
normal.

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

#### O formulário de abertura tem seis seções numeradas

`/painel/gestao-tasks` → "Nova task". Informações gerais, período e
prioridade, exigência de aprovação, workflow, subtarefas e entregas,
materiais e links. O número dá à conversa um jeito de apontar ("faltou a 5")
sem descrever onde o campo fica, e cada seção carrega uma linha de explicação
porque todas respondem a uma pergunta que a agência já errou.

**Não existe seletor de "Status Geral", e a ausência é deliberada.** O status
da Task é calculado por trigger; um status digitado na abertura seria desfeito
pelo recálculo um milissegundo depois, e a pessoa veria a própria escolha
sumir. Os dois manuais — `entregue` e `cancelada` — não fazem sentido numa
demanda que está nascendo.

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
> fora da fila pararia a agência num dia de folga. Para restringir, troque
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

### Tempo, sempre em minutos

`estimativa_minutos` e `tempo_real_minutos`, inteiros. A tela mostra "2h 30min"
e aceita `2h30`, `2,5h`, `150` e `90min` — a conversão é de
`lib/dominio/tempo.ts`. Hora decimal é uma conta que a pessoa faz de cabeça
antes de digitar, e arredondamento transformava "vinte minutos" em 0,33 e de
volta em 19,8.

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

Abaixo de `/portal` há duas entradas com donos diferentes, e por isso a guarda
não mora no layout de `/portal`: `(meu)/` é do cliente com `exigirCliente()`,
`[slug]/` é da gestão. Uma guarda única no nível de cima teria que aceitar as
duas, que é o mesmo que não guardar nenhuma.

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
  só, que tira férias.
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

### Full Days: férias, licença e ausência

**15 dias de férias por ano, em até duas parcelas.** Os dois números são
colunas de `team_members` (`dias_ferias_ano`, `max_parcelas_ferias`), não
constantes no código: contrato muda por pessoa, e mudar contrato não pode
exigir deploy.

- **Pendente conta como usado.** Sem isso a pessoa pediria 15 dias duas vezes
  enquanto o primeiro pedido espera decisão, e o sócio aprovaria os dois sem
  ver o problema.
- **Só o sócio decide.** O desenvolvedor é gestão para todo o resto do sistema
  e aqui não — está escrito na primeira linha de `decidir_solicitacao()`.
- **Aprovar é transacional, e por isso mora no banco.** Aprovar muda o status,
  pinta os dias úteis em `team_presence` e avisa o solicitante; três chamadas
  pelo PostgREST seriam três transações, e a segunda falhando deixaria um
  pedido "aprovada" sem nenhum dia pintado.
- **Dia que veio de pedido aprovado não se edita na matriz.** Um clique
  apagaria as férias de alguém e o pedido continuaria dizendo "aprovada" —
  duas verdades sobre o mesmo dia.
- Licença e ausência **não** descontam do saldo; entram na matriz e no
  relatório.
- Os dias úteis gravados saem de `public.dias_uteis()`, não da conta da tela.
  A tela conta para mostrar o número enquanto a pessoa seleciona; se o gravado
  viesse dali, bastaria alterar o corpo da requisição.
- A **área** é o agrupamento que importa: quem decide precisa saber quem mais
  do mesmo time está fora. É por isso que o calendário bloqueia dias de colegas
  da mesma área **com o nome de quem está fora** — "indisponível" sem nome é
  uma recusa que ninguém tem como contornar nem entender.

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
- **Criar usuário só em Server Action do servidor**, com a chave de serviço
  (`app/(interno)/painel/_actions/usuarios.ts`). Essa chave ignora todo o RLS
  e nunca pode chegar ao navegador: ela é lida em `lib/supabase/admin.ts`, que
  tem `import "server-only"` — e não em `lib/env.ts`, que o navegador carrega.
  O resto usa Server Actions com o cliente do próprio usuário, para o RLS
  continuar valendo.
- **Criar conta não depende de e-mail.** `createUser` primeiro, envio do link
  de senha depois. `inviteUserByEmail` faz o contrário: se o e-mail não sai
  — e sem SMTP próprio o Supabase entrega pouquíssimo —, a conta não é criada
  e o cadastro se perde. Quando o envio falha, a tela mostra o link para a
  equipe passar pela mão.
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
| `npm run prototipo` | Gera imagens das telas em `prototipos/` |
| `scripts/prototipo-clicavel/` | Gera a página única e clicável para validação (veja o README de lá) |

## Histórico de sprints

| Sprint | Entrega |
| --- | --- |
| Sprint 9 | A abertura da demanda: o formulário de Nova Task em seis seções numeradas, cada uma com a linha que diz a que pergunta ela responde; `tasks.exigencia_aprovacao` (nenhuma / interna / cliente — **três valores, não quatro**, porque `cliente` já passa pela interna) travada por `tasks_exige_aprovacao_para_entregue`, que recusa `entregue` sem rodada **aprovada** do escopo exigido e cujo `hint` aponta a saída quando nenhuma etapa cumpre a exigência; `tasks.link_entrega` com `check` de http/https, separado das referências de apoio; a estimativa de tempo da subtarefa ganhando input (existia no estado e ia para a action, sem campo nenhum na tela); link de referência por campo em vez de `window.prompt`; o select de Cliente voltando a mostrar o placeholder; e **nenhum seletor de "Status Geral"**, porque o status é calculado e a escolha seria desfeita no mesmo instante. A pasta de entrega virou **obrigatória** (`tasks_exige_pasta_de_entrega`, migration 0015 — trigger e não `not null`, para a migration rodar em ambiente com task antiga), e ela não se apaga, só se troca. E **"tipo de tarefa" virou Workflow** em toda a interface: o produto falava dois nomes para a mesma coisa, o menu dizia um e o formulário dizia outro. 26 cenários novos, 256 no total. |
| Sprint 8 | Financeiro: módulo da agência só para `socio` — `contracts`, `finance_categories` e `finance_entries` com RLS fechada em `is_socio()` nos quatro comandos, sem exceção para o desenvolvedor; competência, vencimento e pagamento como três datas distintas; atraso **derivado** da data em vez de gravado, com trigger recusando quem tentar gravá-lo; "gerar lançamentos do mês" travado por índice único parcial, que não duplica nem com duas abas; quatro abas em `/painel/financeiro` (Visão Geral com cartões previsto × realizado, série de 12 meses e alertas; Lançamentos com filtros na URL, CSV nos dois sentidos e "marcar pago"; Contratos com recorrência contada do mês de início; Relatórios com DRE por categoria e rentabilidade cruzando receita com o tempo das **subtarefas**); três gráficos em SVG com paleta medida contra daltonismo; e o Financeiro Pessoal de volta ao menu como módulo opcional e privado, com replicar recorrentes e apagar tudo em duas etapas. 44 cenários novos de RLS. |
| Sprint 7 | Desenvolvimento e Skills: catálogo compartilhado de 20 skills com sugestão da equipe esperando a gestão; `user_skills` que só a própria pessoa escreve, com o nível em quatro segmentos carregando a rubrica; `skill_avaliacoes` escrita pela gestão e lida por quem foi avaliado; `/painel/meu-desenvolvimento` salvando sozinho; aba Skills em Equipe com busca de quem sabe, matriz pessoa × skill, lacunas da agência pelo critério do **um** e o que cada um quer aprender; e o Resumo Semanal ganhando texto rico por semana, humor opcional, "puxar minhas entregas" datado na conclusão, busca no próprio histórico pela URL e exportação em texto puro — tudo privado, sem porta para a gestão. 38 cenários novos de RLS. |
| Sprint 6 | Full Days: tabela `notifications` com a escrita só por `notificar()`, e o sino da topbar deixando de ser casca; férias de 15 dias em até duas parcelas com as regras em trigger; `hr_requests`, `team_presence` e `holidays` com os feriados de 2026 e 2027 e `dias_uteis()`; decisão do sócio numa função transacional que pinta a matriz junto; quatro abas em `/painel/full-days` (Matriz da Equipe agrupada por área com CSV, Relatório Gerencial com alerta de férias vencendo, Solicitar com calendário de seleção e bloqueio por área nomeando quem está fora, e Aprovações só do sócio, com lote); e 46 cenários novos de RLS. |
| Sprint 3C | Tela inicial, menu definitivo e Portais de Clientes: identidade visual em tokens com `npm run check:cores` provando 26 pares de contraste e nenhum hex solto; menu em duas seções (Principal / Gestão com selo Admin) com Diário→Resumo Semanal e Minhas Skills→Meu Desenvolvimento redirecionando em 308; barra lateral escura com cartão da pessoa separando nome, cargo e perfil; tela inicial com boas-vindas, Acesso Rápido e a grade de Portais de Clientes; `/portal/{slug}` para a gestão ver o portal de um cliente em modo leitura, com faixa de aviso, registro em `client_portal_views` e a recusa valendo no banco; Resumo Semanal organizado por semana com registro privado; Notas Fiscais como módulo da pessoa; Financeiro Pessoal em aba dentro de Meu perfil. |
| Sprint 0 | Esqueleto: shadcn/ui com tema claro/escuro, login por e-mail e senha, recuperação de senha, os 4 perfis de acesso, tabelas `profiles` / `clients` / `client_users` / `team_members` com RLS, proteção de rota por perfil com HTTP 403, timeout de inatividade do portal, seed de desenvolvimento e homes vazias das duas áreas. |
| Correção do Sprint 2 | Gravação dos cadastros: criação de usuário virou Server Action com `createUser` + link de senha (não depende mais de SMTP) e rollback; policies de `clients`, `client_users` e `team_members` separadas por comando, com DELETE só de sócio; `profiles` passou a aceitar edição da gestão; usuário cliente ganhou UPDATE das próprias três colunas de contato, com trigger travando o resto; contrato `{ ok, error }` em todas as actions com erro real na tela e no log; exclusão de cliente bloqueada por qualquer vínculo; desligamento transferindo tasks em aberto de verdade; ativar/desativar colaborador pela gestão; seed com 6 colaboradores, 3 empresas e 3 acessos ao portal. |
| Sprint 3B | A subtarefa vira a unidade de trabalho: a Task perde responsável, prazo e tempo próprios e ganha período; migration preservando toda atribuição existente como subtarefa "Execução"; máquina de estados no banco (conclusão bloqueada sem aprovação, dependência travando o início, ninguém aprovando a si mesmo, ciclo recusado); status da Task calculado por trigger com `entregue` e `cancelada` como únicos manuais; fluxo de aprovação em rodadas que nunca se sobrescrevem, com aval interno sempre antes do envio ao cliente; tipos de tarefa e workflows com snapshot; tela `/painel/workflows`, fila `/painel/aprovacoes-internas` e aprovação do cliente no Portal; tempo em minutos com entrada flexível; e 61 cenários de RLS em `supabase/testes/`. |
| Sprint 4 | Minhas Tasks: visão pessoal em `/painel/minhas-tasks` para todo perfil interno, mostrando as tasks onde a pessoa é responsável **e** as subtarefas dela dentro de tasks alheias; três contadores clicáveis (atrasadas, para hoje, esta semana) que filtram e batem com as listas; widget "Meu dia" com conclusão em um clique; board, lista e calendário reaproveitados por parâmetro (clique abre painel lateral, card de task alheia não arrasta); calendário com barra colorida por situação, rótulo Entrega/Etapa, chip do cliente e legenda; detalhe em painel lateral sem trocar de página; criação de task restrita a `is_atendimento()` na interface e na policy; e registro de tempo ao concluir task ou subtarefa, com a estimativa sugerida e opção de pular. |
| Sprint 3 | Gestão de Tasks: tabelas `tasks` / `subtasks` / `task_referencias` / `task_comentarios` com RLS por `pode_editar_task()`, board com arrastar e soltar otimista, lista com edição inline e ações em massa, calendário mensal e semanal mostrando prazo de task e de subtarefa separados, editor rico TipTap no briefing, detalhe em duas colunas com comentários e referências em bucket privado, filtros na URL e atalhos N e /. |
| Sprint 2 | Cadastro base: módulos Clientes e Equipe completos, criação de usuários no servidor com chave de serviço, convite de acesso ao portal, enum `team_funcao` com `is_atendimento()`, desligamento em duas etapas com transferência, exclusão de cliente em duas etapas bloqueada por vínculos, e Meu perfil com avatar no Storage. |
| Sprint 1 | Estrutura do dashboard: `lib/auth/permissions.ts` como fonte única do menu e das permissões, menu lateral colapsável com seções e gaveta no celular, topbar com trilha, busca (casca), sino e menu do usuário, 15 rotas placeholder validando o perfil no servidor, cor de marca em variável CSS, 10 componentes compartilhados com vitrine em `/painel/dev/componentes`, e o casco do Portal do Cliente com navegação superior. Nenhuma tabela nova. |
