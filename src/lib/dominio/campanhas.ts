import type {
  CampaignStatus,
  ContentStatus,
  EstruturaDeTemplate,
} from "@/lib/supabase/database.types";

/**
 * O vocabulário das campanhas, nos dois lados da fronteira.
 *
 * Módulo sem diretiva, como `lib/dominio/posts.ts`: o servidor usa para contar
 * e ordenar, o navegador usa para desenhar a árvore. Função pura que os dois
 * lados precisam não mora em `lib/dados/`, que é `server-only`.
 *
 * **O que está aqui tem irmã no Postgres, de propósito.** `statusDoGrupo()` e
 * `status_do_entregavel()` fazem a mesma conta; `ehGrupo()` e
 * `entregavel_eh_grupo()` respondem a mesma pergunta. É a mesma decisão de
 * `situacaoDoLancamento()` no Financeiro e da máquina de estados da etapa: um
 * lado decide o que desenhar, o outro decide o que vale.
 */

export const ROTULO_DA_CAMPANHA: Record<CampaignStatus, string> = {
  planejamento: "Em planejamento",
  ativa: "Ativa",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

/** Um entregável do jeito que o Portal lê. */
export type EntregavelDoPortal = {
  id: string;
  campanhaId: string;
  paiId: string | null;
  nome: string;
  descricao: string | null;
  ordem: number;
  /** O status GRAVADO. No grupo ele não vale — quem responde é `statusDoGrupo`. */
  status: ContentStatus;
  prazo: string | null;
  arteUrl: string | null;
  thumbnailUrl: string | null;
  arquivoNome: string | null;
  versaoAtual: number;
  enviadoEm: string | null;
  /** A rodada de cliente aberta agora. Null quando não há decisão pendente. */
  rodadaPendenteId: string | null;
  /** Quem decidiu a última rodada fechada, e quando. */
  decididoPor: string | null;
  decididoEm: string | null;
  /**
   * O que o cliente escreveu ao recusar ou pedir ajuste.
   *
   * **Ele aparece na LISTA, e não só no detalhe.** "Rejeitado" sozinho manda
   * a pessoa abrir o item para descobrir por quê — e quem olha a árvore está
   * justamente procurando o que falta resolver.
   */
  motivo: string | null;
  /** Quando a rodada aberta começou a esperar. */
  esperandoDesde: string | null;
};

export type CampanhaDoPortal = {
  id: string;
  clienteId: string;
  cliente: string;
  /** O endereço do portal daquele cliente. Null enquanto o slug não existir. */
  slug: string | null;
  nome: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string;
  status: CampaignStatus;
};

/** Um item de topo com os sub-itens dele. */
export type NoDaArvore = {
  item: EntregavelDoPortal;
  filhos: EntregavelDoPortal[];
};

/**
 * A árvore de dois níveis, na ordem em que a agência montou.
 *
 * **Sub-item órfão não some.** Se o pai não veio — porque não foi enviado ao
 * cliente e a policy o escondeu —, o filho sobe para o topo em vez de sumir
 * junto: ele FOI enviado, e a decisão dele está esperando. Descartá-lo por
 * causa do pai deixaria um material aprovável fora da tela, sem nada dizendo
 * que ele existe.
 */
export function emArvore(entregaveis: EntregavelDoPortal[]): NoDaArvore[] {
  const porId = new Map(entregaveis.map((e) => [e.id, e]));
  const filhosDe = new Map<string, EntregavelDoPortal[]>();

  for (const e of entregaveis) {
    if (!e.paiId || !porId.has(e.paiId)) continue;
    const lista = filhosDe.get(e.paiId);
    if (lista) lista.push(e);
    else filhosDe.set(e.paiId, [e]);
  }

  const topo = entregaveis.filter((e) => !e.paiId || !porId.has(e.paiId));

  return ordenar(topo).map((item) => ({
    item,
    filhos: ordenar(filhosDe.get(item.id) ?? []),
  }));
}

function ordenar(lista: EntregavelDoPortal[]): EntregavelDoPortal[] {
  return [...lista].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export function ehGrupo(no: NoDaArvore): boolean {
  return no.filhos.length > 0;
}

/**
 * O status que o grupo MOSTRA, calculado pelos filhos.
 *
 * A precedência é a de `status_do_entregavel()` no Postgres, na mesma ordem: o
 * estado que PEDE AÇÃO ganha do que não pede.
 *
 * **`rejeitado` num filho não faz o grupo ficar rejeitado.** Ninguém recusou o
 * grupo — recusaram uma peça dentro dele, e o que o grupo precisa dizer é "tem
 * coisa para refazer aqui". `ajustes` é exatamente isso, e é o tom de atenção;
 * `rejeitado` é o de erro, e pintaria de vermelho um grupo em que catorze de
 * quinze itens estão aprovados.
 */
export function statusDoGrupo(filhos: EntregavelDoPortal[]): ContentStatus {
  const tem = (...quais: ContentStatus[]) =>
    filhos.some((f) => quais.includes(f.status));

  if (tem("ajustes", "rejeitado")) return "ajustes";
  if (tem("em_aprovacao")) return "em_aprovacao";
  if (filhos.every((f) => f.status === "aprovado")) return "aprovado";
  if (tem("aguardando_informacoes")) return "aguardando_informacoes";
  if (tem("em_producao")) return "em_producao";
  return "stand_by";
}

/** O status a desenhar num nó, seja ele grupo ou folha. */
export function statusDoNo(no: NoDaArvore): ContentStatus {
  return ehGrupo(no) ? statusDoGrupo(no.filhos) : no.item.status;
}

/**
 * As FOLHAS da árvore — e é por elas que tudo se conta.
 *
 * Um grupo com quinze sub-itens é uma linha na tela e quinze entregas no
 * trabalho. Contar o grupo também faria "16 de 16" onde há quinze coisas, e a
 * barra de progresso andaria sozinha quando o último filho fosse aprovado.
 *
 * É a mesma regra que a Task já segue com as subtarefas e a etapa com as
 * sub-etapas: quem tem filha para de ser unidade de trabalho.
 */
export function folhas(arvore: NoDaArvore[]): EntregavelDoPortal[] {
  return arvore.flatMap((no) => (ehGrupo(no) ? no.filhos : [no.item]));
}

export type Progresso = {
  aprovados: number;
  total: number;
  /** 0 a 100, inteiro. Campanha sem folha nenhuma devolve 0. */
  percentual: number;
};

export function progresso(itens: EntregavelDoPortal[]): Progresso {
  const total = itens.length;
  const aprovados = itens.filter((i) => i.status === "aprovado").length;
  return {
    aprovados,
    total,
    percentual: total === 0 ? 0 : Math.round((aprovados / total) * 100),
  };
}

/** "3 de 15 aprovados", a linha do grupo. */
export function contagemDoGrupo(filhos: EntregavelDoPortal[]): string {
  const { aprovados, total } = progresso(filhos);
  return `${aprovados} de ${total} ${total === 1 ? "aprovado" : "aprovados"}`;
}

/**
 * O entregável está esperando uma decisão DESTE cliente?
 *
 * Duas condições, e as duas importam — é a mesma pergunta de `esperaDecisao`
 * em `lib/dominio/posts.ts`. Sem a segunda, o botão apareceria num item cuja
 * rodada alguém já fechou por outro caminho, e o clique cairia na recusa
 * "esta rodada já foi decidida".
 */
export function esperaDecisao(item: EntregavelDoPortal): boolean {
  return item.status === "em_aprovacao" && item.rodadaPendenteId !== null;
}

/** Quantos dias faltam para uma data, contados em texto ISO. */
export function diasAte(data: string, hoje: string): number {
  const um = Date.UTC(
    Number(data.slice(0, 4)),
    Number(data.slice(5, 7)) - 1,
    Number(data.slice(8, 10)),
  );
  const outro = Date.UTC(
    Number(hoje.slice(0, 4)),
    Number(hoje.slice(5, 7)) - 1,
    Number(hoje.slice(8, 10)),
  );
  return Math.round((um - outro) / 86_400_000);
}

/**
 * O aviso de que a campanha está acabando.
 *
 * **Sete dias, e só enquanto sobrar coisa não aprovada.** Uma campanha que
 * termina sexta com tudo aprovado não precisa de aviso nenhum — e um alerta
 * que aparece de qualquer jeito é o que faz a pessoa parar de ler os alertas.
 *
 * **Ele fala de "não aprovados", e não de "esperando você".** São contas
 * diferentes: o cartão da listagem destaca o que espera a decisão DELE, e o
 * material recusado espera a agência refazer. As duas frases diziam "esperando
 * você" e mostravam números diferentes na mesma campanha — 3 no cartão, 4 no
 * alerta. Foi a imagem em 375px que mostrou as duas lado a lado.
 *
 * Campanha já vencida também avisa: "terminou" com peça pendente é mais
 * urgente que "termina em 2 dias", não menos.
 */
export function alertaDePrazo(
  campanha: { dataFim: string; status: CampaignStatus },
  pendentes: number,
  hoje: string,
): string | null {
  if (pendentes === 0) return null;
  if (campanha.status === "finalizada" || campanha.status === "cancelada") {
    return null;
  }

  const dias = diasAte(campanha.dataFim, hoje);
  if (dias > 7) return null;

  const material =
    pendentes === 1
      ? "1 material ainda não aprovado"
      : `${pendentes} materiais ainda não aprovados`;

  if (dias < 0) return `Esta campanha terminou e há ${material}.`;
  if (dias === 0) return `Esta campanha termina hoje e há ${material}.`;
  return `Faltam ${dias} ${dias === 1 ? "dia" : "dias"} para o fim da campanha e há ${material}.`;
}

/**
 * Os entregáveis que um template gera, já achatados em (topo, filhos).
 *
 * `itens` vazio com `quantidade` vira "Feed/Story 1"… "Feed/Story 15": o
 * número muda a cada mês, e escrever quinze linhas iguais no template seria
 * fixar um valor que nunca é o mesmo. O nome do filho sai do singular do
 * grupo, com a barra no lugar — "Feed/Storys" produz "Feed/Story 3".
 *
 * **Um terceiro nível no JSON é IGNORADO**, e não recusado. O template é dado
 * que alguém digitou; recusar a campanha inteira por causa de um nó a mais
 * deixaria a pessoa sem saída na tela de criação, enquanto o banco continua
 * recusando o neto de verdade, que é onde a regra vale.
 */
export function entregaveisDoTemplate(
  estrutura: EstruturaDeTemplate,
): { nome: string; filhos: string[] }[] {
  return estrutura.map((no) => {
    if (no.itens && no.itens.length > 0) {
      return { nome: no.nome, filhos: no.itens.map((i) => i.nome) };
    }

    if (no.quantidade && no.quantidade > 0) {
      const base = singularDoGrupo(no.nome);
      return {
        nome: no.nome,
        filhos: Array.from(
          { length: no.quantidade },
          (_, i) => `${base} ${i + 1}`,
        ),
      };
    }

    return { nome: no.nome, filhos: [] };
  });
}

/** "Feed/Storys" → "Feed/Story"; "Vídeos TV" → "Vídeo TV". */
function singularDoGrupo(nome: string): string {
  return nome.replace(/(\p{L}+?)s\b/gu, "$1");
}

/**
 * A linha de informação que cada status pede — e ela MUDA por status.
 *
 * Um selo que diz só "Aguardando aprovação" não responde a pergunta que a
 * pessoa tem na frente da árvore, que é sempre alguma variação de "e daí?".
 * O que resolve é diferente em cada estado: aprovado quer dizer quem e quando;
 * esperando quer dizer há quanto tempo; recusado quer dizer por quê; em
 * produção quer dizer para quando.
 *
 * Devolve `null` quando não há o que acrescentar — e aí a tela mostra só o
 * selo, em vez de uma linha vazia ocupando altura.
 */
export function linhaDoEntregavel(
  item: EntregavelDoPortal,
  hoje: string,
): string | null {
  switch (item.status) {
    case "aprovado":
      if (!item.decididoEm) return null;
      return item.decididoPor
        ? `Aprovado por ${item.decididoPor} em ${porExtenso(item.decididoEm)}`
        : `Aprovado em ${porExtenso(item.decididoEm)}`;

    case "em_aprovacao": {
      if (!item.esperandoDesde) return "Aguardando sua decisão";
      const dias = -diasAte(item.esperandoDesde.slice(0, 10), hoje);
      if (dias <= 0) return "Aguardando sua decisão desde hoje";
      return `Aguardando sua decisão há ${dias} ${dias === 1 ? "dia" : "dias"}`;
    }

    case "ajustes":
    case "rejeitado":
      return item.motivo;

    case "em_producao":
      return item.prazo ? `Previsto para ${porExtenso(item.prazo)}` : null;

    default:
      return null;
  }
}

/** "2026-10-07" → "07/10/2026". Sem date-fns: é texto, e texto não tem fuso. */
function porExtenso(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Os três recortes da listagem. "Ativas" é o padrão. */
export type FiltroDeCampanha = "ativas" | "finalizadas" | "planejamento";

export const ROTULOS_DO_FILTRO: Record<FiltroDeCampanha, string> = {
  ativas: "Ativas",
  finalizadas: "Finalizadas",
  planejamento: "Em planejamento",
};

export const FILTROS_DE_CAMPANHA: FiltroDeCampanha[] = [
  "ativas",
  "finalizadas",
  "planejamento",
];

/**
 * **`cancelada` não aparece em recorte nenhum**, e é decisão.
 *
 * Uma campanha cancelada não é trabalho que o cliente possa acompanhar nem
 * decisão que ele possa tomar — é uma linha que a agência encerrou. Deixá-la
 * num dos três recortes faria o contador de "finalizadas" misturar o que
 * terminou com o que não aconteceu.
 */
export function combinaComFiltro(
  campanha: CampanhaDoPortal,
  filtro: FiltroDeCampanha,
): boolean {
  if (campanha.status === "cancelada") return false;
  if (filtro === "ativas") return campanha.status === "ativa";
  if (filtro === "finalizadas") return campanha.status === "finalizada";
  return campanha.status === "planejamento";
}

export function lerFiltroDeCampanha(valor: unknown): FiltroDeCampanha {
  return FILTROS_DE_CAMPANHA.includes(valor as FiltroDeCampanha)
    ? (valor as FiltroDeCampanha)
    : "ativas";
}

/** Quantos itens ainda dependem de uma decisão do cliente ou da agência. */
export function pendentes(itens: EntregavelDoPortal[]): number {
  return itens.filter(
    (i) =>
      i.status === "em_aprovacao" ||
      i.status === "ajustes" ||
      i.status === "rejeitado",
  ).length;
}

/** Quantos esperam a decisão DELE agora — é o que merece destaque na lista. */
export function esperandoOCliente(itens: EntregavelDoPortal[]): number {
  return itens.filter(esperaDecisao).length;
}

/** "01/10 a 11/10", como o cartão mostra. */
export function periodoCurto(inicio: string, fim: string): string {
  const curto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${curto(inicio)} a ${curto(fim)}`;
}

/** A duração do período, contada em dias de calendário e incluindo os dois. */
export function duracaoEmDias(inicio: string, fim: string): number {
  return diasAte(fim, inicio) + 1;
}
