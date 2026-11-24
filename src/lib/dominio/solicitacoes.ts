import {
  ROTULO_DO_TIPO,
  SINGULAR_DO_TIPO,
  composicaoDoPedido,
} from "@/lib/dominio/campanhas";
import type {
  CampoDoRoteiro,
  ClientRequest,
  Json,
  SolicitacaoFrente,
  SolicitacaoStatus,
} from "@/lib/supabase/database.types";

/**
 * O vocabulário e as contas dos pedidos do cliente (0068).
 *
 * Função pura, sem banco: a caixa de entrada (servidor), o formulário do
 * portal (navegador) e os filtros precisam enxergar o mesmo conjunto sem uma
 * segunda consulta.
 */

/**
 * O bucket privado dos anexos (0068).
 *
 * **Ele mora AQUI e não em `lib/dados/solicitacoes.ts`**, e o motivo é
 * mecânico: aquele arquivo é `server-only`, e a tela do pedido — que é
 * `"use client"` — precisa do nome para subir o arquivo pelo navegador. Um
 * valor importado de lá por um componente de cliente quebra o BUILD apontando
 * para `supabase/server.ts`, três importações abaixo.
 *
 * É o espelho da regra que `check:fronteira` mede: ele varre o servidor
 * importando valor do cliente, e este é o caminho contrário — que o
 * `npm run build` pega, e só ele.
 */
export const BUCKET_DOS_PEDIDOS = "solicitacoes-arquivos";

export const STATUS_DA_SOLICITACAO: SolicitacaoStatus[] = [
  "nova",
  "em_analise",
  "em_andamento",
  "concluida",
  "recusada",
];

/**
 * **SÃO DOIS MAPAS DE RÓTULO, e não um.**
 *
 * É a decisão de `statusParaOCliente()` em `lib/dominio/portal.ts`, aplicada a
 * um enum novo: o mesmo valor quer dizer coisas diferentes dos dois lados.
 * `em_andamento` para a agência quer dizer "existe uma demanda publicada no
 * board"; para o cliente quer dizer "estão fazendo". `nova` para a agência é
 * "ninguém triou ainda" — uma cobrança; para o cliente é "chegou" — um
 * recibo.
 *
 * Um mapa só obrigaria a escolher entre dizer ao cliente que o pedido dele
 * está "novo" (o que soa a esquecido) e dizer à agência que está "enviado"
 * (o que não é uma pendência de ninguém).
 */
export const ROTULOS_PARA_A_EQUIPE: Record<SolicitacaoStatus, string> = {
  nova: "Novo",
  em_analise: "Em análise",
  em_andamento: "Virou demanda",
  concluida: "Concluído",
  recusada: "Recusado",
};

export const ROTULOS_PARA_O_CLIENTE: Record<SolicitacaoStatus, string> = {
  nova: "Enviado",
  em_analise: "Em análise",
  em_andamento: "Em produção",
  concluida: "Concluído",
  recusada: "Recusado",
};

/**
 * A frase que explica o estado, na língua de cada lado.
 *
 * Ela existe porque o rótulo sozinho não responde "e agora?". "Em análise"
 * dito ao cliente não diz se falta alguma coisa dele — e faltar alguma coisa
 * dele é justamente o caso em que a conversa existe.
 */
export const EXPLICACAO_PARA_O_CLIENTE: Record<SolicitacaoStatus, string> = {
  nova: "Recebemos. A gente responde por aqui.",
  em_analise:
    "Estamos vendo o que você pediu — pode ser que a gente pergunte alguma coisa.",
  em_andamento: "Já está sendo feito.",
  concluida: "Entregue.",
  recusada: "Não vamos seguir com este pedido. O motivo está abaixo.",
};

/**
 * O tom do selo.
 *
 * `recusada` é o único em tom de erro — pintar "novo" de vermelho na tela do
 * Atendimento treinaria o hábito de ignorar vermelho, que é a mesma razão
 * pela qual o alerta de 7 dias do portal é `--warning` e "Mudou" é o neutro na
 * trilha de auditoria.
 */
export const TOM_DA_SOLICITACAO: Record<
  SolicitacaoStatus,
  "neutro" | "aviso" | "ok" | "erro"
> = {
  nova: "aviso",
  em_analise: "neutro",
  em_andamento: "neutro",
  concluida: "ok",
  recusada: "erro",
};

// ---------------------------------------------------------------------------
// A FRENTE: Social ou Campanha (migration 0124)
//
// Decisão do usuário: *"na abertura de uma solicitação, exigir a classificação
// como Social ou Campanha, vinculando à conta e à vertente, e usar essa
// classificação nos relatórios"*.
//
// **ELA RESPONDE "QUEM PRODUZ", e é isso que a separa das duas classificações
// que já existiam.** `request_type_id` é o roteiro de briefing (0068) e
// responde *o que é a peça* — "Peça para redes", "Material impresso", "Vídeo";
// `campaign_id` (0112) responde *de qual campanha*, e é opcional porque a
// maioria dos pedidos é avulsa. A frente responde de que lado da agência o
// trabalho sai: o mês de social (`abrir_mes_de_social`) ou uma Wave
// (`abrir_campanha`). Uma peça para redes nasce das duas, e é exatamente essa
// a conta que o relatório precisa separar.
//
// **E ELA NÃO É DERIVADA**, que é a primeira pergunta deste produto. O atalho
// seria `campaign_id is not null ? "campanha" : "social"`, e ele cai numa
// frase: campanha nula não quer dizer social. Um material impresso avulso não
// é nenhuma das duas, e um pedido de campanha chega antes de a campanha
// existir — e aí quem abre JÁ sabe a frente, e o produto não. É o contrário de
// `faseDoPedido()` logo abaixo: ali o fato está nas colunas e guardá-lo seria
// a segunda verdade; aqui não há de onde calcular, e o que existe é a
// declaração de quem abre.
//
// **São DOIS valores no ENUM e TRÊS opções na tela**, e a diferença é a 0137.
//
// A 0124 nasceu de *"exigir a classificação como Social ou Campanha"* e
// escrevia aqui que a terceira opção *"desfaz o pedido"*. O usuário pediu o
// contrário: *"a nova solicitação não precisa ser social ou campanha
// necessariamente, o cliente deve poder especificar o que ele quer sem colocar
// em alguma categoria"*. **É uma reversão declarada**, e ela é de UM ramo: o
// que recusava o `insert` sem frente saiu do gatilho, e o resto da 0124 — a
// coluna, o enum, a coerência campanha→frente, a coerência vertente→conta, o
// chip da fila, a ação de classificar, o bloco do relatório — fica inteiro.
//
// **O NULO DEIXOU DE SER SÓ O PEDIDO ANTIGO.** Ele era isso até a 0137: uma
// linha anterior à regra, que a fila desenha como "Sem classificação". Depois
// dela ele é um estado que a tela OFERECE, e quem classifica passa a ser o
// cliente OU o Atendimento, pela ação que existe desde a 0124 justamente para
// o pedido anterior a ela.
//
// **E QUEM A OFERECE PASSOU A SER O TIPO DE TRABALHO (0148).** A 0137 a
// oferecia num cartão próprio — *"Não sei dizer"*, ao lado de Social e
// Campanha —, e o usuário pediu o contrário: *"Nas solicitações do portal do
// cliente, pode tirar o onde isso entra. quero que mude o que tipo de trabalho
// é, para permitir campanhas tbm"*. A frente virou coluna de
// `request_types`, então ela SAI da escolha do cliente e vem do cartão que ele
// já escolhia: "Peça para redes" é social, "Campanha" é campanha, e "Material
// impresso" e "Outro" são o terceiro cartão — eles têm `frente` nula, que é
// exatamente *"não sei dizer"* dito pelo nome do trabalho. **Duas perguntas
// para a mesma resposta eram uma pergunta a mais**, e a que o cliente sabia
// responder é a do trabalho.
//
// É por isso que `EXPLICACAO_DA_FRENTE` e `OPCAO_SEM_FRENTE` saíram deste
// arquivo: as duas eram da fileira de cartões que a 0148 desfez, e um
// `export` sem chamador é o que alguém reaproveita três sprints depois achando
// que a escolha ainda existe — a 0023. O que fica é `ROTULOS_DE_FRENTE`, que a
// fila e a ação de classificar leem, e `rotuloDaFrente()`, que nomeia o nulo.
//
// **E a frente continua sendo uma DECLARAÇÃO e não uma conta**, que é a linha
// central daquele cabeçalho: `campaign_id is not null ? "campanha" : "social"`
// continua errado, porque campanha nula não quer dizer social. O que mudou é
// quem declara, não se dá para calcular.
// ---------------------------------------------------------------------------

export const FRENTES_DA_SOLICITACAO = ["social", "campanha"] as const;

/**
 * **É TUPLA e não `SolicitacaoFrente[]`**, e a razão é a lição de
 * `TIPOS_DE_EVENTO` na 0109: `z.enum` pede `readonly [string, ...string[]]`, e
 * um array simples não serve — foi essa a razão de a lista do evento existir
 * copiada à mão na action, e de o oitavo tipo ser recusado no clique. O
 * `satisfies` é a trava: uma frente que não exista no enum do banco não
 * compila.
 */
const _conferir = FRENTES_DA_SOLICITACAO satisfies readonly SolicitacaoFrente[];
void _conferir;

/**
 * **UM MAPA SÓ, ao contrário dos rótulos de status.**
 *
 * Aqueles são dois porque o mesmo valor quer dizer coisas diferentes dos dois
 * lados — `nova` é cobrança aqui e recibo lá. A frente quer dizer a mesma
 * coisa para os dois: de que lado da agência este trabalho sai. E as duas
 * palavras são do vocabulário do cliente, não do nosso — o portal já escreve
 * "De que campanha é" desde a 0112.
 */
export const ROTULOS_DE_FRENTE: Record<SolicitacaoFrente, string> = {
  social: "Social",
  campanha: "Campanha",
};

export function ehFrenteDaSolicitacao(
  valor: string | undefined | null,
): valor is SolicitacaoFrente {
  return (
    Boolean(valor) &&
    (FRENTES_DA_SOLICITACAO as readonly string[]).includes(valor as string)
  );
}

/**
 * O rótulo da frente de um pedido, inclusive quando não há nenhuma.
 *
 * **O nulo tem nome, e não vira string vazia.** Ele é o pedido anterior à
 * 0124, e some da tela como um espaço em branco — que lê como defeito. Dizer
 * "Sem classificação" diz o que ele é, e é classificável depois.
 */
export function rotuloDaFrente(frente: SolicitacaoFrente | null): string {
  return frente ? ROTULOS_DE_FRENTE[frente] : "Sem classificação";
}

// ---------------------------------------------------------------------------
// O QUE O RELATÓRIO AGRUPA, e por que a frente sozinha não bastava
//
// Decisão do usuário: *"atualmente as solicitações estão sendo classificadas
// só como social ou campanha, faltam coisas para poder entrar no
// relatório"*.
//
// **MEDIDO ANTES DE ESCREVER, e a medição é a entrega inteira.** O pedido
// carrega OITO dimensões de classificação — a conta, a frente, o tipo de
// trabalho, a vertente, a campanha, o período, a composição e as respostas do
// roteiro — e o bloco "O que os clientes pediram" do Resumo da Agência lia
// UMA, a frente. É a lição da 0060, da 0127 e da 0128 pela enésima vez: o que
// faltava não era coluna, era o relatório pedir o que já estava ali.
//
// **E A FRENTE É A DIMENSÃO QUE MENTE, o que também foi medido:** dos quatro
// tipos ativos, DOIS têm `frente` nula **por desenho** — a 0148 escreve que
// *"ela é NULA em dois dos quatro… inventar uma frente para eles seria somar
// no relatório o palpite em vez da resposta"*. Então um "Material impresso",
// classificado de ponta a ponta, caía num balde que o relatório chamava de
// **"sem classificação"**. Ele confundia *"este tipo não tem frente"* com
// *"ninguém classificou"*, que é a queixa em quantas palavras.
// ---------------------------------------------------------------------------

/**
 * A classificação mais FINA que este pedido tem, e o rótulo dela.
 *
 * ---------------------------------------------------------------------------
 * **É UMA PÍLULA E NÃO DUAS**, e a razão é a 0148: desde ela a frente do
 * pedido aberto pelo portal é `request_types.frente` — ou seja, uma FUNÇÃO do
 * tipo. Desenhar "Peça para redes" e "Social" lado a lado é a mesma palavra
 * duas vezes a dois centímetros, em duas resoluções.
 *
 * **A FRENTE SOBREVIVE ONDE ELA INFORMA:** o pedido sem tipo e com frente é o
 * anterior à 0124 e o que o Atendimento classificou à mão por
 * `classificarSolicitacao` — ali ela é a única classificação que existe, e é
 * ela que sai.
 *
 * **E `classificado` é FALSO só quando não há nem um nem outro**, que é o
 * conserto: é esse pedido, e só ele, que a tela pinta como exceção.
 * ---------------------------------------------------------------------------
 */
export type ClassificacaoDoPedido = {
  /** O nome do tipo, ou a frente, ou "Sem classificação". */
  rotulo: string;
  /** Falso só sem tipo E sem frente — é aí que a tela pinta a exceção. */
  classificado: boolean;
};

export function classificacaoDoPedido(
  tipo: string | null,
  frente: SolicitacaoFrente | null,
): ClassificacaoDoPedido {
  if (tipo) return { rotulo: tipo, classificado: true };
  if (frente) return { rotulo: ROTULOS_DE_FRENTE[frente], classificado: true };
  return { rotulo: "Sem classificação", classificado: false };
}

/**
 * O DESFECHO de um pedido: o que aconteceu com ele.
 *
 * ---------------------------------------------------------------------------
 * **UM BLOCO QUE CONTA CHEGADAS E NÃO DESFECHOS É UMA CAIXA DE ENTRADA, não
 * um relatório.** O "O que os clientes pediram" recortava por `created_at` e
 * nunca olhava `status`: ele dizia *"12 pedidos nesta semana"* e parava — e a
 * pergunta da segunda-feira sobre a fila é se ela está andando, que é
 * `aceitamos / recusamos / ainda parado`.
 *
 * **SÃO TRÊS E NÃO CINCO, e cada fusão tem razão própria.** `nova` e
 * `em_analise` são as duas *esperando*: a diferença entre elas é se alguém da
 * agência já abriu a fila — informação NOSSA, e é o mesmo argumento pelo qual
 * as duas dividem a primeira fase do cliente. E `em_andamento` e `concluida`
 * são as duas *virou demanda*: **o que foi entregue já está contado no
 * primeiro bloco desta mesma página**, então um quarto balde aqui seria o
 * mesmo fato duas vezes na mesma tela.
 *
 * **É UM `Record` TOTAL e não uma função com `if`**, que é a decisão de
 * `DESFECHO_DA_RODADA` (0127): com um ramo final de guarda, um valor novo em
 * `solicitacao_status` cairia calado em *esperando* — um pedido recusado por
 * um estado novo apareceria como parado na fila, sem erro em lugar nenhum.
 * Total sobre o enum, **o compilador cobra o valor novo**.
 *
 * **E ELE É MEDIDO AGORA, nunca no fim da semana** — é a decisão escrita de
 * "O que ficou para trás": o pedido que chegou na sexta e está `nova` na
 * segunda está *esperando*, e a frase da tela diz que o retrato é de hoje.
 * ---------------------------------------------------------------------------
 */
export const DESFECHOS_DO_PEDIDO = [
  "esperando",
  "virou_demanda",
  "recusado",
] as const;

export type DesfechoDoPedido = (typeof DESFECHOS_DO_PEDIDO)[number];

export const DESFECHO_DO_STATUS: Record<SolicitacaoStatus, DesfechoDoPedido> = {
  nova: "esperando",
  em_analise: "esperando",
  em_andamento: "virou_demanda",
  concluida: "virou_demanda",
  recusada: "recusado",
};

export function desfechoDoPedido(status: SolicitacaoStatus): DesfechoDoPedido {
  return DESFECHO_DO_STATUS[status];
}

// ---------------------------------------------------------------------------
// AS FASES DO PEDIDO, na tela do cliente
//
// Decisão do usuário: *"na aba de pedidos, eles sejam separados em abas, Em
// análise, Em produção, Em ajustes, Entregue"*.
//
// **ELAS NÃO SÃO O ENUM, e nenhuma coluna nasceu por causa delas.** A fase é
// uma LEITURA do estado do pedido mais o da demanda que ele virou, e é a
// decisão de `maoDoPost()` no Social Media, de "bloqueio não é status" e de
// "atraso do Financeiro não é coluna": uma coluna `fase` precisaria ser
// reescrita por quatro caminhos para continuar verdadeira, e divergiria no
// primeiro pedido de ajustes.
//
// O de-para:
//
//   | Fase        | De onde sai                                            |
//   | ----------- | ------------------------------------------------------ |
//   | Em análise  | `nova` + `em_analise`                                  |
//   | Em produção | `em_andamento`, e a demanda NÃO está em ajustes        |
//   | Em ajustes  | `em_andamento`, e a demanda ESTÁ em ajustes            |
//   | Entregue    | `concluida`                                            |
//   | Recusado    | `recusada`                                             |
//
// **`nova` e `em_analise` dividem a primeira**, e é de propósito: a diferença
// entre elas é se alguém do Atendimento já abriu a fila — que é informação da
// AGÊNCIA, não do cliente. Para quem mandou, as duas querem dizer a mesma
// coisa: está sendo olhado. Uma aba só para "ninguém triou ainda" seria a
// cobrança interna aparecendo na tela de fora.
//
// **"EM AJUSTES" NÃO É VALOR DE `solicitacao_status`**, e a ausência é o
// ponto. Quem sabe que há ajuste em curso é a DEMANDA — `task_status` tem
// `em_ajustes` desde a 0007, e é para lá que ela volta quando o cliente pede
// alteração num material. Acrescentar um valor ao enum do pedido criaria uma
// segunda verdade sobre o mesmo fato, e ela divergiria no instante em que a
// demanda saísse de ajustes: o pedido ficaria parado dizendo "em ajustes" até
// alguém reescrevê-lo à mão. Derivada, ela volta sozinha.
//
// **E a demanda só é legível para o cliente quando algo dela foi enviado** —
// `tasks_select_cliente` exige uma rodada de escopo cliente. Longe de ser um
// furo, é o que faz a derivação valer exatamente onde ela importa: uma demanda
// vai para `em_ajustes` porque o cliente pediu alteração numa peça, e pedir
// alteração exige que a peça tenha saído. Quando a demanda não é legível, o
// pedido fica em "Em produção", que é a verdade do que ele sabe.
//
// **"Recusado" é uma QUINTA aba, e ela só aparece quando existe pedido nela.**
// O usuário nomeou quatro, e `recusada` não cabe em nenhuma: pôr o recusado em
// "Entregue" afirmaria que foi entregue, e deixá-lo fora o faria desaparecer da
// tela de quem o abriu — junto com o motivo, que é a única coisa que explica o
// que aconteceu. Quase nenhuma conta tem um, então quase todo mundo vê as
// quatro abas pedidas; quem tem, tem onde ler.
// ---------------------------------------------------------------------------

export const FASES_DO_PEDIDO = [
  "analise",
  "producao",
  "ajustes",
  "entregue",
  "recusado",
] as const;

export type FaseDoPedido = (typeof FASES_DO_PEDIDO)[number];

export const ROTULOS_DE_FASE: Record<FaseDoPedido, string> = {
  analise: "Em análise",
  producao: "Em produção",
  ajustes: "Em ajustes",
  entregue: "Entregue",
  recusado: "Recusado",
};

// `ehFaseDoPedido()` E `ehStatusDeSolicitacao()` SAÍRAM COM OS DOIS RECORTES,
// e é a 0023: as duas existiam para ler `?fase=` e `?status=` da URL, e com o
// quadro a coluna é o recorte — uma função de guarda sem chamador é o que
// alguém reaproveita três sprints depois achando que o parâmetro ainda filtra
// alguma coisa. `FASES_DO_PEDIDO` e `ROTULOS_DE_FASE` ficam, porque é delas
// que as colunas do quadro do cliente saem.

/**
 * Em que fase este pedido está, na leitura do cliente.
 *
 * `demandaEmAjustes` vem de fora — é o status da demanda que ele virou, e esta
 * função não vai ao banco por nada: ela é chamada por linha, e a tela que a
 * usa é a mesma que conta as abas.
 */
export function faseDoPedido(
  status: SolicitacaoStatus,
  demandaEmAjustes: boolean,
): FaseDoPedido {
  if (status === "recusada") return "recusado";
  if (status === "concluida") return "entregue";
  if (status === "em_andamento")
    return demandaEmAjustes ? "ajustes" : "producao";
  return "analise";
}

/**
 * A frase da linha, já sabendo a fase.
 *
 * **"Em ajustes" não tem frase em `EXPLICACAO_PARA_O_CLIENTE`**, e não pode
 * ter: aquele mapa é por STATUS, e o status de um pedido em ajuste continua
 * sendo `em_andamento` — quem sabe do ajuste é a demanda. Sem esta função a
 * linha dizia "Já está sendo feito" debaixo da aba "Em ajustes", que é a tela
 * se desmentindo a um centímetro de distância. Acrescentar a frase ao mapa de
 * status seria escrevê-la num lugar que não sabe se ela é verdade.
 */
export function explicacaoDoPedido(
  status: SolicitacaoStatus,
  fase: FaseDoPedido,
): string {
  if (fase === "ajustes") return "Voltou para ajuste — a gente está refazendo.";
  return EXPLICACAO_PARA_O_CLIENTE[status];
}

// ---------------------------------------------------------------------------
// O QUADRO: as colunas dos dois lados
//
// Decisão do usuário, em três pedidos da mesma mensagem: *"mude as
// solicitações, para uma visualização kan ban"*, *"faça uma proposta melhor de
// visualização das solicitações"* e *"e o cliente deve visualizar as
// solicitações dele, como kanban"*.
//
// **A COLUNA É O RECORTE, então os dois recortes de status saíram.** A fileira
// de chips do Atendimento e as abas por fase do cliente respondiam a mesma
// pergunta que a coluna responde agora — *em que pé está cada pedido* —, e
// mantê-las daria ao mesmo fato dois controles na mesma tela: escolher "Novo"
// num quadro que já tem a coluna "Novo" é esconder as outras quatro para
// olhar uma que estava à vista. O que fica de recorte é o CLIENTE, do lado da
// agência, que é outra dimensão.
//
// **E O QUADRO NÃO ARRASTA, pela razão escrita na fila de notas fiscais:** das
// transições possíveis entre as colunas, o banco recusa quase todas. Só
// `nova → em_analise` é uma troca pura de status; `em_andamento` e `concluida`
// são escritos pelo gatilho `tasks_espelha_no_pedido` quando a demanda é
// publicada e entregue, e `recusada` exige o motivo, que o check
// `client_requests_recusa_com_motivo` cobra no banco e que um gesto de seis
// pixels não tem como carregar. Um alvo de solta que recusa quase tudo é um
// gesto que não faz nada. A coluna é leitura, o botão é a ação — e ele mora no
// detalhe, que é onde o pedido se lê inteiro antes de ser decidido.
//
// **A CONTAGEM DE CADA COLUNA SAI DA LISTA INTEIRA DAQUELA COLUNA**, mesmo
// quando o teto corta o que é desenhado: é a regra do Resumo da Agência —
// *cortar calado faz a pessoa concluir que aquilo é tudo*.
// ---------------------------------------------------------------------------

/**
 * Quantos cards uma coluna encerrada desenha.
 *
 * **SÓ AS ENCERRADAS TÊM TETO, e a razão é que só elas crescem para sempre.**
 * "Novo" e "Em análise" encolhem conforme alguém atende; "Concluído" e
 * "Recusado" só aumentam, e numa conta de dois anos a coluna viraria a tela.
 * As abertas não têm teto de propósito: um pedido que o teto escondesse seria
 * justamente o que ninguém atendeu.
 */
export const TETO_DA_COLUNA_ENCERRADA = 8;

/**
 * Uma coluna do quadro.
 *
 * `encerrada` diz as duas consequências de a coluna só crescer, que são a
 * mesma decisão: ela desenha no máximo `TETO_DA_COLUNA_ENCERRADA` cards, e os
 * MAIS NOVOS primeiro — nas abertas a pergunta é quem espera há mais tempo, e
 * nas encerradas é o que foi fechado recentemente, que é também o que o teto
 * precisa deixar no topo.
 */
export type ColunaDoQuadro = {
  chave: string;
  titulo: string;
  vazio: string;
  encerrada?: true;
};

/**
 * As colunas da fila do Atendimento: os cinco status.
 *
 * **O TÍTULO SAI DE `ROTULOS_PARA_A_EQUIPE` e não é reescrito aqui.** Duas
 * palavras para o mesmo status seriam duas verdades, e a que divergiria é esta
 * — ninguém relê um cabeçalho de coluna ao trocar o rótulo de um selo.
 */
export const COLUNAS_DA_FILA_DE_PEDIDOS: ColunaDoQuadro[] = [
  {
    chave: "nova",
    titulo: ROTULOS_PARA_A_EQUIPE.nova,
    vazio: "Nada novo esperando.",
  },
  {
    chave: "em_analise",
    titulo: ROTULOS_PARA_A_EQUIPE.em_analise,
    vazio: "Nenhum pedido sendo olhado agora.",
  },
  {
    chave: "em_andamento",
    titulo: ROTULOS_PARA_A_EQUIPE.em_andamento,
    vazio: "Nenhum pedido virou demanda.",
  },
  {
    chave: "concluida",
    titulo: ROTULOS_PARA_A_EQUIPE.concluida,
    vazio: "Nada concluído por aqui.",
    encerrada: true,
  },
  {
    chave: "recusada",
    titulo: ROTULOS_PARA_A_EQUIPE.recusada,
    vazio: "Nenhum pedido recusado.",
    encerrada: true,
  },
];

/**
 * As colunas do quadro do cliente: as cinco fases.
 *
 * **"Recusado" continua sendo a quinta e continua só aparecendo quando existe
 * algum** — a regra que as abas já seguiam, e pela mesma razão: uma coluna
 * permanentemente vazia chamada "Recusado" é um lembrete diário de um problema
 * que não existe. Quem filtra é a tela.
 */
export const COLUNAS_DO_QUADRO_DO_CLIENTE: ColunaDoQuadro[] = [
  {
    chave: "analise",
    titulo: ROTULOS_DE_FASE.analise,
    vazio: "Nenhum pedido esperando a gente olhar.",
  },
  {
    chave: "producao",
    titulo: ROTULOS_DE_FASE.producao,
    vazio: "Nada em produção neste momento.",
  },
  {
    chave: "ajustes",
    titulo: ROTULOS_DE_FASE.ajustes,
    vazio: "Nenhum pedido voltou para ajuste. É a resposta boa.",
  },
  {
    chave: "entregue",
    titulo: ROTULOS_DE_FASE.entregue,
    vazio: "Nada concluído ainda.",
    encerrada: true,
  },
  {
    chave: "recusado",
    titulo: ROTULOS_DE_FASE.recusado,
    vazio: "Nenhum pedido recusado.",
    encerrada: true,
  },
];

/**
 * Duas checagens no carregamento do módulo: todo status e toda fase caem em
 * exatamente uma coluna.
 *
 * Sem elas, um valor novo em `solicitacao_status` sumiria do quadro sem erro e
 * sem aviso — o pedido existiria no banco, não apareceria em coluna nenhuma, e
 * só quem fosse procurar por ele descobriria. É a mesma checagem de
 * `COLUNAS_DA_FILA` nas notas fiscais, de `seletor-de-status.tsx` e de
 * `STATUS_EM_ORDEM`.
 */
const STATUS_FORA_DO_QUADRO = STATUS_DA_SOLICITACAO.filter(
  (s) => !COLUNAS_DA_FILA_DE_PEDIDOS.some((c) => c.chave === s),
);
if (STATUS_FORA_DO_QUADRO.length > 0) {
  throw new Error(
    `Status de solicitação fora de toda coluna da fila: ${STATUS_FORA_DO_QUADRO.join(", ")}`,
  );
}

const FASE_FORA_DO_QUADRO = FASES_DO_PEDIDO.filter(
  (f) => !COLUNAS_DO_QUADRO_DO_CLIENTE.some((c) => c.chave === f),
);
if (FASE_FORA_DO_QUADRO.length > 0) {
  throw new Error(
    `Fase de pedido fora de toda coluna do quadro: ${FASE_FORA_DO_QUADRO.join(", ")}`,
  );
}

/** Os que ainda pedem alguma coisa de alguém. */
export const EM_ABERTO: SolicitacaoStatus[] = ["nova", "em_analise"];

export function ehAberta(status: SolicitacaoStatus): boolean {
  return EM_ABERTO.includes(status);
}

/**
 * Há quantos dias este pedido está esperando.
 *
 * **`hojeISO` vem de fora**, como em todo o resto do produto: se a função
 * lesse o relógio, o servidor e o navegador em fusos diferentes dariam duas
 * idades para o mesmo pedido — e é a idade que decide o destaque na fila.
 */
export function diasEsperando(criadoEm: string, hojeISO: string): number {
  const de = new Date(criadoEm);
  const ate = new Date(hojeISO);
  const dia = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((ate.getTime() - de.getTime()) / dia));
}

/**
 * A partir de quantos dias um pedido em aberto fica em destaque na fila.
 *
 * **É uma constante e não um padrão por conta**, ao contrário do
 * `prazo_aprovacao_cliente_dias` da 0064 — e a diferença é de quem é o prazo:
 * aquele é o combinado de quanto o CLIENTE tem para decidir, que muda de
 * contrato para contrato; este é quanto a AGÊNCIA demora para responder, e
 * ela responde do mesmo jeito para todo mundo. Um prazo de resposta por conta
 * diria que existe cliente que pode esperar mais.
 */
export const DIAS_ATE_DESTACAR = 2;

export function estaEsquecida(
  pedido: Pick<ClientRequest, "status" | "created_at">,
  hojeISO: string,
): boolean {
  return (
    ehAberta(pedido.status) &&
    diasEsperando(pedido.created_at, hojeISO) >= DIAS_ATE_DESTACAR
  );
}

/**
 * O roteiro de um tipo, normalizado.
 *
 * **O `jsonb` vem do banco e pode ser qualquer coisa**, e um `.map()` num
 * objeto estoura a tela inteira. O `check` da 0068 garante que é um array,
 * mas ele não garante a forma de cada item — e uma pergunta sem `chave` é uma
 * resposta que não se grava em lugar nenhum. Descartar o campo torto é melhor
 * que desenhar um campo que não salva.
 */
export function camposDoRoteiro(bruto: unknown): CampoDoRoteiro[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.filter(
    (c): c is CampoDoRoteiro =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as CampoDoRoteiro).chave === "string" &&
      typeof (c as CampoDoRoteiro).rotulo === "string",
  );
}

/**
 * O briefing da demanda, montado a partir do pedido.
 *
 * **Ele repete o que o cliente escreveu, e não um resumo.** O Atendimento vai
 * editar isto na tela de detalhe; o que não pode acontecer é ele abrir a
 * demanda e ter que voltar ao pedido para copiar as respostas uma a uma — que
 * é exatamente o trabalho manual que este sprint elimina.
 *
 * **A data desejada entra no TEXTO e não em `data_fim`**, e é a regra do
 * sprint escrita em código: `data_desejada` é o que o cliente gostaria,
 * `tasks.data_fim` é o que a agência assume. Copiar uma na outra transformaria
 * um desejo em compromisso sem ninguém ter concordado.
 */
/**
 * `2026-12-03` vira `03/12/2026`, para o briefing ser lido por gente.
 *
 * **É um `split` e não `date-fns`**, de propósito: a coluna é `date`, e
 * `parseISO` a devolve à meia-noite LOCAL — num servidor em UTC, uma data que
 * o cliente escreveu como 3 de dezembro sai como 2 de dezembro para quem lê
 * em São Paulo. É "o hoje é o DA AGÊNCIA" visto de outro ângulo: aqui não há
 * fuso nenhum a resolver, há três números a trocar de ordem.
 *
 * Vazio devolve vazio, e quem chama decide o que escrever no lugar.
 */
function emDiaMes(iso: string | null | undefined): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

/**
 * O que o briefing da demanda diz sobre o pedido, pedaço por pedaço.
 *
 * **ELE É UM CONSTRUTOR DE PARTES E NÃO UMA STRING, e a razão é a 0148.** Com
 * o briefing do cliente passando a ter duas metades — o texto e o documento
 * rico —, a conversão escreve as duas em `tasks`: `briefing_texto` e
 * `briefing_rico`. Duas funções montando a mesma sequência de frases em volta
 * dele seriam duas verdades sobre o mesmo briefing, e a que divergiria é a
 * rica, porque ninguém a relê — o editor da demanda é a única tela que a
 * desenha, e ela só abre depois da conversão.
 *
 * Então a sequência mora aqui, uma vez, com um MARCADOR no lugar do briefing:
 * `briefingDoPedido()` o substitui pelo texto e `briefingRicoDoPedido()` pelos
 * nós do documento. As duas não têm como discordar da ordem.
 *
 * **O marcador só é emitido quando há TEXTO**, e isso é a regra do par: um
 * documento do TipTap sem nada dentro ainda é um parágrafo vazio, então quem
 * decide se há briefing é o texto — e um `briefing_rico` gravado sem
 * `descricao`, que só um PATCH alcança, não vira parte nenhuma.
 */
type ParteDoBriefing = { tipo: "linha"; texto: string } | { tipo: "briefing" };

type PedidoParaOBriefing = {
  descricao: string | null;
  respostas: Record<string, string>;
  data_desejada: string | null;
  empresa: string | null;
  frente: SolicitacaoFrente | null;
  campanha_inicio?: string | null;
  campanha_fim?: string | null;
  composicao?: unknown;
};

function partesDoBriefingDoPedido(
  pedido: PedidoParaOBriefing,
  campos: ReturnType<typeof camposDoRoteiro>,
): ParteDoBriefing[] {
  const partes: ParteDoBriefing[] = [];
  const escrever = (texto: string) => partes.push({ tipo: "linha", texto });

  escrever("Pedido aberto pelo cliente no Portal.");
  escrever("");

  // ---------------------------------------------------------------------
  // A CLASSIFICAÇÃO ENTRA NO TEXTO, E NÃO NUMA COLUNA DE `tasks` (0124).
  //
  // A tentação é espelhar a frente na demanda para `producao_do_periodo()`
  // agrupar por ela, e duas razões a desfazem: a demanda JÁ sabe a frente
  // dela pela ESTRUTURA — um mês de social tem `social_do_mes`, uma campanha
  // é apontada por `campaigns.task_id` —, e uma coluna ao lado seria a
  // segunda verdade sobre o mesmo fato, que divergiria na primeira demanda
  // convertida à mão que não é nem uma nem outra. É "atraso não é coluna"
  // pela enésima vez.
  //
  // O que ela faz aqui é dizer ao Atendimento qual caminho de produção o
  // cliente pediu — que é a decisão seguinte dele, na mesma tela: abrir o mês
  // de social ou a campanha.
  //
  // **A VERTENTE NÃO ENTRA NO TEXTO**, e é o contrário: ela virou COLUNA da
  // demanda, e a tela de task desenha o campo dela desde a 0118. Escrevê-la
  // aqui também seria a segunda verdade sobre o mesmo fato — e a do texto é a
  // que envelhece, porque ninguém reescreve o briefing no dia em que alguém
  // troca a vertente da demanda.
  // ---------------------------------------------------------------------
  if (pedido.frente) {
    escrever(`O cliente classificou como: ${ROTULOS_DE_FRENTE[pedido.frente]}.`);
    escrever("");
  }

  // O BRIEFING ENTRA COMO MARCADOR, e é aqui que as duas metades se encontram.
  if (pedido.descricao?.trim()) {
    partes.push({ tipo: "briefing" });
    escrever("");
  }

  for (const r of respostasParaLer(campos, pedido.respostas)) {
    escrever(`${r.rotulo}: ${r.valor}`);
  }

  // ---------------------------------------------------------------------
  // O PERÍODO E A COMPOSIÇÃO DA CAMPANHA ENTRAM NO TEXTO (0138).
  //
  // Eles só existem no pedido de frente Campanha, e este caminho é o do
  // Atendimento decidindo que aquilo é uma DEMANDA e não uma campanha — o que
  // acontece: "dez estáticos" às vezes é uma demanda com dez etapas. Aí o que
  // o cliente escreveu precisa chegar ao briefing, porque a tela de task não
  // tem campo para nenhum dos dois.
  //
  // **Quando ele decide abrir a CAMPANHA, estas linhas não são lidas**: lá os
  // dois vão para os campos do formulário de abertura, que é o caminho que
  // esta migration abriu. Duas rotas, a mesma informação, e nenhuma das duas
  // a perde.
  //
  // E O PERÍODO NÃO VAI PARA `tasks.data_inicio`/`data_fim`, pela regra do
  // parágrafo acima aplicada a duas datas em vez de uma: aquelas colunas são
  // DERIVADAS das etapas desde a 0028, e o próximo recálculo desfaria o que
  // fosse escrito ali.
  // ---------------------------------------------------------------------
  if (pedido.campanha_inicio || pedido.campanha_fim) {
    escrever("");
    escrever(
      `O cliente pediu a campanha de ${emDiaMes(pedido.campanha_inicio) || "(sem início)"} a ${emDiaMes(pedido.campanha_fim) || "(sem encerramento)"}.`,
    );
  }

  const materiais = composicaoDoPedido(pedido.composicao);
  if (materiais.length > 0) {
    escrever("");
    escrever("Os materiais que ele pediu:");
    for (const m of materiais) {
      const medida = [m.formato, m.dimensoes].filter(Boolean).join(" · ");
      // O SINGULAR QUANDO É UMA PEÇA SÓ: `SINGULAR_DO_TIPO` existe desde a
      // 0122 justamente porque o plural tirado por regra erra "Carrosséis" e
      // "Stories", e "1 Outros" no briefing que o Atendimento lê é o mesmo
      // erro de português que aquele mapa foi escrito para não cometer.
      const rotulo =
        m.quantidade === 1 ? SINGULAR_DO_TIPO[m.tipo] : ROTULO_DO_TIPO[m.tipo];
      escrever(`- ${m.quantidade} ${rotulo}${medida ? ` (${medida})` : ""}`);
    }
  }

  if (pedido.data_desejada) {
    escrever("");
    escrever(
      `O cliente gostaria para ${emDiaMes(pedido.data_desejada)}. É o desejo dele, não o prazo combinado — o prazo é o que a agência assumir aqui.`,
    );
  }

  return partes;
}

/** O briefing da demanda em texto puro — o que vai para `briefing_texto`. */
export function briefingDoPedido(
  pedido: PedidoParaOBriefing,
  campos: ReturnType<typeof camposDoRoteiro>,
): string {
  const briefing = pedido.descricao?.trim() ?? "";
  return partesDoBriefingDoPedido(pedido, campos)
    .map((p) => (p.tipo === "briefing" ? briefing : p.texto))
    .join("\n")
    .trim();
}

/**
 * O MESMO briefing como documento do TipTap — o que vai para `briefing_rico`.
 *
 * **Sem ele a conversão escrevia metade**, e isso era um defeito de verdade que
 * esta entrega encontrou: `converterEmDemanda` gravava `briefing_texto` e nunca
 * `briefing_rico`, e o detalhe da demanda **só desenha a coluna rica** — então
 * a demanda convertida abria com o editor VAZIO para quem edita e "Sem
 * briefing." para quem não edita. Medido: nenhuma demanda do banco veio de um
 * pedido, então ele nunca mordeu — o que torna o conserto barato agora.
 *
 * **Ele devolve NULO quando o pedido não tem documento rico**, e é o que mantém
 * o pedido anterior à 0148 funcionando como antes: a conversão grava só o texto,
 * e a tela cai na frase de sempre. Um documento montado só com as frases em
 * volta seria pior — ele afirmaria que há um briefing escrito onde não há.
 *
 * **E os nós do cliente entram INTEIROS**, tabela, grifo e cor dentro: o que
 * ele escreveu é o conteúdo, e reescrevê-lo em parágrafos de texto puro jogaria
 * fora exatamente o que o item 11 pediu.
 */
export function briefingRicoDoPedido(
  pedido: PedidoParaOBriefing & { briefing_rico?: unknown },
  campos: ReturnType<typeof camposDoRoteiro>,
): Json | null {
  const doc = pedido.briefing_rico as { content?: unknown } | null | undefined;
  const dentro = Array.isArray(doc?.content) ? doc.content : null;
  if (!dentro || dentro.length === 0) return null;

  const nos: unknown[] = [];
  for (const parte of partesDoBriefingDoPedido(pedido, campos)) {
    if (parte.tipo === "briefing") {
      nos.push(...dentro);
      continue;
    }
    // A LINHA VAZIA NÃO VIRA PARÁGRAFO: no texto ela é o que separa os blocos,
    // e num documento o parágrafo já tem o respiro dele — um vazio a cada duas
    // linhas dobraria o espaçamento do briefing inteiro.
    if (!parte.texto) continue;
    nos.push({
      type: "paragraph",
      content: [{ type: "text", text: parte.texto }],
    });
  }

  return { type: "doc", content: nos } as Json;
}

/** As respostas que faltam, pelo rótulo — para a frase dizer QUAIS. */
export function respostasQueFaltam(
  campos: CampoDoRoteiro[],
  respostas: Record<string, string>,
): string[] {
  return campos
    .filter((c) => c.obrigatorio && !String(respostas[c.chave] ?? "").trim())
    .map((c) => c.rotulo);
}

/**
 * As respostas emparelhadas com a pergunta, para a tela do painel.
 *
 * **A resposta órfã APARECE, e não some.** Quando o roteiro mudou depois que
 * o pedido foi feito, a pergunta daquela chave não existe mais — e o pedido
 * guarda a resposta, não a pergunta (a 0068 explica por que não copia o
 * roteiro). Esconder a linha faria sumir uma informação que o cliente
 * escreveu; mostrar a chave crua diz que ela existe e que a pergunta mudou.
 */
export function respostasParaLer(
  campos: CampoDoRoteiro[],
  respostas: Record<string, string>,
): { rotulo: string; valor: string; orfa: boolean }[] {
  const conhecidas = new Set(campos.map((c) => c.chave));

  const doRoteiro = campos
    .map((c) => ({
      rotulo: c.rotulo,
      valor: String(respostas[c.chave] ?? "").trim(),
      orfa: false,
    }))
    .filter((r) => r.valor.length > 0);

  const orfas = Object.entries(respostas)
    .filter(
      ([chave, valor]) =>
        !conhecidas.has(chave) && String(valor ?? "").trim().length > 0,
    )
    .map(([chave, valor]) => ({
      rotulo: chave,
      valor: String(valor).trim(),
      orfa: true,
    }));

  return [...doRoteiro, ...orfas];
}
