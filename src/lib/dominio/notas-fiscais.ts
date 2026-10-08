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

/** "2027-09-01" → "2027-09". O inverso de `competenciaDoMes`. */
export function mesDaCompetencia(competencia: string): string {
  return competencia.slice(0, 7);
}

/**
 * UMA RECUSADA CUJO MÊS JÁ TEM NOTA VIVA NÃO É PENDÊNCIA.
 *
 * ---------------------------------------------------------------------------
 * **A mesma pergunta estava respondida em DOIS lugares, e o lado errado era o
 * da tela.** `minhasNotasRecusadas()` descontava o mês reenviado desde a 0065 —
 * é o que faz o aviso sair da Home —, e `minhas-notas.tsx` filtrava só por
 * `status === "recusada"`: quem corrigia a nota e mandava outra continuava
 * lendo *"Uma nota precisa ser reenviada"* para sempre, na tela onde ela
 * acabara de mandar. Foi o usuário quem encontrou.
 *
 * Pior: o conjunto dos meses vivos já era calculado três linhas abaixo, para
 * decidir o que o seletor oferece. As duas metades estavam na mesma função e
 * não se encontravam.
 *
 * Então a regra vira UMA função que os dois lados chamam, como
 * `situacaoDoLancamento()` no Financeiro e `faseDoPedido()` nas Solicitações.
 * Um aviso que não sai depois de resolvido é o que ensina a ignorar o aviso.
 * ---------------------------------------------------------------------------
 *
 * Recebe as duas metades em vez de derivá-las da lista inteira porque os dois
 * chamadores têm formas diferentes: a tela tem o histórico todo em memória, e
 * a Home pergunta ao banco por duas consultas estreitas — a das recusadas e a
 * dos meses vivos.
 */
export function recusadasPendentes<T extends { competencia: string }>(
  recusadas: T[],
  mesesComNotaViva: Iterable<string>,
): T[] {
  const vivos = new Set(mesesComNotaViva);
  return recusadas.filter((nota) => !vivos.has(mesDaCompetencia(nota.competencia)));
}

/**
 * As QUATRO colunas da fila do sócio.
 *
 * ---------------------------------------------------------------------------
 * **Eram TRÊS LISTAS empilhadas, e a do meio juntava dois fatos opostos.**
 * "Encerradas" tinha a paga e a recusada na mesma caixa — o pagamento que saiu
 * e a nota que a pessoa precisa mandar de novo —, e a recusada não tinha onde
 * ser procurada. Decisão do usuário: *"separar por status: recusado,
 * aguardando pagamento, pago (tipo kanban)"*.
 *
 * **Ele nomeou três, e são quatro.** "A conferir" ficou porque é o trabalho da
 * tela: é a coluna de onde tudo sai, e tirá-la deixaria a fila sem a fila. Os
 * três que ele nomeou são exatamente os que não davam para ver separados.
 *
 * **A ORDEM É POR QUEM ESTÁ ESPERANDO O QUÊ**, que é o argumento das três
 * listas antigas mantido inteiro: as duas primeiras são trabalho do sócio — uma
 * leitura e uma transferência —, a terceira espera a PESSOA mandar outra, e a
 * quarta não espera ninguém. Pela ordem do ciclo a recusada cairia no fim, ao
 * lado da paga, que é de onde ela acabou de sair.
 * ---------------------------------------------------------------------------
 *
 * **O card NÃO ARRASTA, e aqui a ausência é mecânica antes de ser de desenho.**
 * Recusar exige o motivo (o check `team_invoices_recusa_com_motivo`) e pagar
 * exige a data digitada, que o arrasto não tem como carregar; e paga e recusada
 * não mudam mais de estado, nem pelo sócio. Das transições possíveis entre as
 * quatro colunas, o banco recusa quase todas — e um alvo de solta que recusa
 * tudo é um gesto que não faz nada. É a decisão do board de demandas e da Linha
 * do Tempo: a coluna é leitura, o botão é a ação.
 */
export const COLUNAS_DA_FILA = [
  {
    status: "enviada",
    titulo: "A conferir",
    vazio: "Nenhuma nota esperando.",
  },
  {
    status: "aprovada",
    titulo: "Aguardando pagamento",
    vazio: "Nada a transferir.",
  },
  {
    status: "recusada",
    titulo: "Recusadas",
    vazio: "Nenhuma recusada.",
  },
  {
    status: "paga",
    titulo: "Pagas",
    vazio: "Nada pago neste recorte.",
  },
] as const satisfies readonly { status: NfStatus; titulo: string; vazio: string }[];

/**
 * Uma checagem no carregamento do módulo: toda nota cai em exatamente uma
 * coluna.
 *
 * Sem ela, um valor novo em `nf_status` sumiria da fila sem erro e sem aviso —
 * a nota existiria no banco, não apareceria em coluna nenhuma, e só alguém
 * procurando por ela descobriria. É a mesma checagem de
 * `seletor-de-status.tsx` e de `STATUS_EM_ORDEM`.
 */
const FALTA_NA_FILA = (Object.keys(ROTULOS_DE_NF) as NfStatus[]).filter(
  (status) => !COLUNAS_DA_FILA.some((coluna) => (coluna.status as string) === status),
);
if (FALTA_NA_FILA.length > 0) {
  throw new Error(
    `Estado de nota fiscal fora de toda coluna da fila: ${FALTA_NA_FILA.join(", ")}`,
  );
}

/** As notas de cada estado, para a fila desenhar e para a aba contar. */
export function porColunaDaFila<T extends { status: NfStatus }>(
  notas: T[],
): Record<NfStatus, T[]> {
  const mapa = { enviada: [], aprovada: [], recusada: [], paga: [] } as Record<NfStatus, T[]>;
  for (const nota of notas) mapa[nota.status].push(nota);
  return mapa;
}
