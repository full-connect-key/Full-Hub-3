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
  em_analise: "Estamos vendo o que você pediu — pode ser que a gente pergunte alguma coisa.",
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
export const TOM_DA_SOLICITACAO: Record<SolicitacaoStatus, "neutro" | "aviso" | "ok" | "erro"> = {
  nova: "aviso",
  em_analise: "neutro",
  em_andamento: "neutro",
  concluida: "ok",
  recusada: "erro",
};

/** Os que ainda pedem alguma coisa de alguém. */
export const EM_ABERTO: SolicitacaoStatus[] = ["nova", "em_analise"];

export function ehAberta(status: SolicitacaoStatus): boolean {
  return EM_ABERTO.includes(status);
}

export function ehStatusDeSolicitacao(valor: string | undefined): valor is SolicitacaoStatus {
  return Boolean(valor) && (STATUS_DA_SOLICITACAO as string[]).includes(valor as string);
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
  return ehAberta(pedido.status) && diasEsperando(pedido.created_at, hojeISO) >= DIAS_ATE_DESTACAR;
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
    .filter(([chave, valor]) => !conhecidas.has(chave) && String(valor ?? "").trim().length > 0)
    .map(([chave, valor]) => ({ rotulo: chave, valor: String(valor).trim(), orfa: true }));

  return [...doRoteiro, ...orfas];
}
