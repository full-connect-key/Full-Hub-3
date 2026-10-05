import type {
  CampoDoRoteiro,
  ClientRequest,
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

export function ehFaseDoPedido(
  valor: string | undefined,
): valor is FaseDoPedido {
  return (
    Boolean(valor) &&
    (FASES_DO_PEDIDO as readonly string[]).includes(valor as string)
  );
}

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

/** Os que ainda pedem alguma coisa de alguém. */
export const EM_ABERTO: SolicitacaoStatus[] = ["nova", "em_analise"];

export function ehAberta(status: SolicitacaoStatus): boolean {
  return EM_ABERTO.includes(status);
}

export function ehStatusDeSolicitacao(
  valor: string | undefined,
): valor is SolicitacaoStatus {
  return (
    Boolean(valor) &&
    (STATUS_DA_SOLICITACAO as string[]).includes(valor as string)
  );
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
