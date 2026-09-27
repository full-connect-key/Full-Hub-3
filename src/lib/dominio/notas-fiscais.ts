import type { NfStatus } from "@/lib/supabase/database.types";

/**
 * O vocabulário da nota fiscal da pessoa (0065).
 *
 * Módulo sem diretiva nenhuma: a tela do sócio é de servidor e o formulário de
 * envio é de cliente, e os dois precisam dos mesmos rótulos. É o caso que a
 * convenção cobre — `lib/dados/` é `server-only` e o que sai de lá são dados.
 */

export const ROTULOS_DE_NF: Record<NfStatus, string> = {
  enviada: "Enviada",
  aprovada: "Aprovada",
  paga: "Paga",
  recusada: "Recusada",
};

/**
 * O tom de cada estado, em PAR NOMEADO e nunca opacidade.
 *
 * **"Recusada" é o único em tom de erro**, e é a mesma decisão do selo
 * "Apagou" na trilha de auditoria: pintar mais de um de vermelho treina o
 * hábito de ignorar vermelho. "Enviada" é o neutro porque é o mais comum — dar
 * cor a ele faria o corriqueiro competir com o que precisa de atenção.
 */
export const CORES_DE_NF: Record<NfStatus, string> = {
  enviada: "bg-neutral-soft text-text-secondary",
  aprovada: "bg-blue-soft text-accent-strong",
  paga: "bg-success-soft text-success",
  recusada: "bg-danger-soft text-danger",
};

/** O que cada estado quer dizer, para o `title` e o rótulo acessível. */
export const EXPLICACAO_DE_NF: Record<NfStatus, string> = {
  enviada: "Esperando a conferência do sócio.",
  aprovada: "Conferida. O pagamento ainda não saiu.",
  paga: "O pagamento saiu, e virou despesa no Financeiro da agência.",
  recusada: "Precisa ser reenviada. O motivo está escrito na nota.",
};

/**
 * A competência em "Setembro de 2027".
 *
 * Recebe o `date` do Postgres (`2027-09-01`) e NÃO usa `new Date(iso)`: isso
 * interpreta a string como UTC e, em qualquer fuso a oeste, devolve o mês
 * anterior — "agosto" numa nota de setembro. O texto é montado do texto.
 */
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function mesPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${MESES[Number(mes) - 1] ?? mes} de ${ano}`;
}

/** "2027-09" → o primeiro dia, que é como a competência é gravada. */
export function competenciaDoMes(mes: string): string {
  return `${mes}-01`;
}

/**
 * Os doze meses que o seletor oferece, do atual para trás.
 *
 * **Para trás e nunca para a frente**, e a regra é a mesma do lançamento
 * retroativo do Full Days vista do avesso: ninguém emite nota de um mês que
 * não aconteceu. Doze porque uma nota esquecida há mais de um ano é conversa
 * com a contabilidade, não um campo numa tela.
 */
export function mesesParaEmitir(hoje: string): { valor: string; rotulo: string }[] {
  const [ano, mes] = hoje.split("-").map(Number);
  const lista: { valor: string; rotulo: string }[] = [];

  for (let i = 0; i < 12; i++) {
    const total = ano * 12 + (mes - 1) - i;
    const a = Math.floor(total / 12);
    const m = (total % 12) + 1;
    const valor = `${a}-${String(m).padStart(2, "0")}`;
    lista.push({ valor, rotulo: mesPorExtenso(`${valor}-01`) });
  }

  return lista;
}

/** "R$ 4.250,00". O CSV e a tela leem o mesmo número do mesmo jeito. */
export function emReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * "4.250,00" → 4250. Devolve nulo quando não dá para ler.
 *
 * ---------------------------------------------------------------------------
 * **ACEITA AS DUAS PONTUAÇÕES, e é por isso que existe em vez de um
 * `Number(texto)`.**
 *
 * Quem digita valor em português escreve `4.250,00`; quem copia do sistema de
 * emissão cola `4250.00`. `Number()` lê o primeiro como `NaN` e o segundo
 * certo — então metade das pessoas veria "confira o valor" tendo digitado
 * exatamente o que se digita no Brasil.
 *
 * A regra é a da ÚLTIMA pontuação: o que vem depois dela são os centavos, e
 * todo o resto é separador de milhar. Assim `1.234,56`, `1,234.56`, `1234,56`
 * e `1234.56` chegam ao mesmo número, e `4.250` — sem centavos — vale quatro
 * mil duzentos e cinquenta, não quatro e vinte e cinco.
 *
 * É a mesma decisão de `interpretarTempo()` em `lib/dominio/tempo.ts`: a
 * conversão mora num lugar só, e a pessoa digita como ela escreve.
 * ---------------------------------------------------------------------------
 */
export function interpretarValor(texto: string): number | null {
  const limpo = texto.replace(/[R$\s\u00a0]/gi, "").trim();
  if (!limpo) return null;

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  const corte = Math.max(ultimaVirgula, ultimoPonto);

  let normalizado: string;
  if (corte === -1) {
    normalizado = limpo;
  } else {
    const decimais = limpo.slice(corte + 1);
    // TRÊS DÍGITOS DEPOIS DA PONTUAÇÃO SÃO MILHAR, e não centavos: `4.250` é
    // quatro mil duzentos e cinquenta em português, e ler como 4,250 tiraria
    // três zeros do valor de uma nota sem ninguém notar.
    if (/^\d{3}$/.test(decimais)) {
      normalizado = limpo.replace(/[.,]/g, "");
    } else {
      normalizado = limpo.slice(0, corte).replace(/[.,]/g, "") + "." + decimais;
    }
  }

  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * O PRAZO DE UM PEDIDO É O DIA EM QUE ELE SAIU (decisão do usuário).
 *
 * ---------------------------------------------------------------------------
 * **Ele AVISA e nunca RECUSA, e a razão cabe numa frase**: uma nota recusada
 * por atraso é uma nota que a agência NÃO recebe — o oposto do que pedir a
 * nota existe para conseguir. Quem perdeu o dia manda no dia seguinte, e o
 * atraso fica visível dos dois lados: aqui, na tela de quem deve, e na fila do
 * sócio.
 *
 * É a mesma decisão de "função sem dono avisa, nunca recusa" (0064) e do
 * limite por task da recorrência, que corta em vez de recusar.
 * ---------------------------------------------------------------------------
 *
 * **E a comparação é com o `hoje` que desce do servidor**, como em todo prazo
 * do produto: se cada tela lesse o próprio relógio, o navegador em outro fuso
 * classificaria como atrasado um pedido que o contador ainda dá em dia.
 */
export type PedidoDeNota = {
  /** O mês de serviço, no primeiro dia — como a competência é gravada. */
  competencia: string;
  /** O dia em que o pedido saiu, que É o prazo. */
  pedidoEm: string;
};

export function prazoVencido(pedido: PedidoDeNota, hojeISO: string): boolean {
  return pedido.pedidoEm < hojeISO;
}

/**
 * A frase do prazo, e ela muda de tempo verbal.
 *
 * "O prazo é hoje" e "o prazo era 05/10" dizem coisas diferentes para quem
 * abre a tela, e a segunda é a que precisa aparecer para quem passou do dia —
 * uma frase só, no presente, faria a tela de quem está atrasado parecer a de
 * quem está em dia.
 */
export function fraseDoPrazo(pedido: PedidoDeNota, hojeISO: string): string {
  const dia = diaEMes(pedido.pedidoEm);
  if (pedido.pedidoEm === hojeISO) return "O prazo é hoje.";
  if (pedido.pedidoEm > hojeISO) return `O prazo é ${dia}.`;
  return `O prazo era ${dia}, o mesmo dia do pedido.`;
}

/** "2026-10-05" → "05/10". Montado do texto, nunca por `new Date(iso)`. */
export function diaEMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}
