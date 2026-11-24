import "server-only";

import { cache } from "react";

import { ouFalha } from "@/lib/dados/consulta";
import { segundaDaSemana, somarDias } from "@/lib/dominio/datas";
import { producaoDoPeriodo, type Producao } from "@/lib/dados/metricas";
import {
  classificacaoDoPedido,
  desfechoDoPedido,
  type ClassificacaoDoPedido,
  type DesfechoDoPedido,
} from "@/lib/dominio/solicitacoes";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O resumo da semana da agência.
 *
 * ---------------------------------------------------------------------------
 * ELE SE CHAMA "DA AGÊNCIA", E O NOME NÃO É DETALHE.
 *
 * Um dos nomes mortos que `check:cores` varre é o de um módulo apagado na
 * 0034 que juntava as mesmas duas palavras óbvias para esta tela. Aquele era
 * o registro PRIVADO de cada pessoa, que nem o sócio lia; este é o panorama
 * da agência para a gestão, montado do que já está no banco. São coisas
 * opostas, e a mesma palavra para as duas é como se confunde as duas de novo
 * daqui a três sprints.
 *
 * Esta explicação não pode escrever o nome que ela proíbe — a varredura pegou
 * a primeira versão deste comentário, que o escrevia. É a mesma armadilha da
 * 0016, da 0034 e da 0043: o texto que justifica a regra mora no cabeçalho da
 * migration e no CLAUDE.md, fora de `src/`.
 * ---------------------------------------------------------------------------
 *
 * **Ele é um MÓDULO e não uma tela**, e é o pedido do sprint: a mesma função
 * serve a página e serviria um envio automático de segunda-feira. O
 * agendamento não existe — é de outro sprint, como a limpeza de rascunhos e a
 * geração de recorrências —, e por isso a função não manda nada para lugar
 * nenhum: ela devolve o resumo montado.
 *
 * **Os números vêm de `producao_do_periodo()`, e não de uma conta nova.** É a
 * mesma função que as Métricas chamam, com a semana como recorte: duas contas
 * de "quantas etapas a agência concluiu" divergiriam, e a divergência
 * apareceria entre duas telas que a mesma pessoa abre no mesmo dia.
 *
 * ---------------------------------------------------------------------------
 * NENHUMA CONSULTA AQUI USA EMBUTIDO, e é a lição da campanha que não
 * aparecia: `clients(nome)` citava coluna que não existe, o PostgREST recusou
 * o `select` inteiro, e a tela disse "nenhuma campanha" para quem tinha
 * acabado de criar uma. Colunas planas mais um mapa de nomes não têm como
 * derrubar a consulta — e o que a RLS não devolver vira um nome ausente, não
 * uma lista vazia.
 * ---------------------------------------------------------------------------
 */

/** Quantos itens cada lista mostra. Um resumo de sessenta linhas não é resumo. */
const NO_MAXIMO = 8;

export type ItemDoResumo = {
  id: string;
  titulo: string;
  /** `Cliente · Demanda`, a mesma linhagem de Minhas Tasks. */
  contexto: string | null;
  pessoa: string | null;
  data: string | null;
  link: string;
};

export type EsperandoCliente = {
  id: string;
  titulo: string;
  cliente: string | null;
  desdeEmDias: number;
  link: string;
};

/**
 * O que um cliente pediu nesta semana (0124).
 *
 * **ELE É O PEDIDO E NÃO A DEMANDA**, e a distinção é a razão de o bloco
 * existir: a lista de cima conta o que a agência ENTREGOU, e esta conta o que
 * ENTROU — inclusive o pedido que ninguém aceitou ainda, que por definição não
 * está em `tasks` nenhuma e não aparece em lugar nenhum deste resumo.
 */
export type PedidoDoResumo = {
  id: string;
  titulo: string;
  cliente: string | null;
  /** O nome da vertente, quando o pedido tem uma. */
  vertente: string | null;
  /**
   * A classificação mais FINA que o pedido tem — o nome do tipo de trabalho,
   * a frente quando não há tipo, ou "Sem classificação".
   *
   * **A `frente` crua SAIU deste tipo**, e é a 0023: desde a 0148 ela é uma
   * função de `request_types.frente`, então a linha que desenhasse as duas
   * diria a mesma coisa em duas resoluções — e um campo que nenhuma tela lê é
   * o que alguém reaproveita três sprints depois achando que ele decide algo.
   */
  classificacao: ClassificacaoDoPedido;
  /**
   * O que aconteceu com ele, medido AGORA.
   *
   * **Ele só é desenhado quando não é `esperando`**, e a assimetria é a regra
   * da matriz do Day Off: numa semana de chegadas quase toda linha está
   * esperando, e a mesma palavra em oito de oito linhas é a largura do título
   * gasta para dizer o que não distingue nada. Pinta-se a exceção — e as
   * linhas sem marca são justamente as que a contagem chama de esperando.
   */
  desfecho: DesfechoDoPedido;
  link: string;
};

export type ResumoDaAgencia = {
  de: string;
  ate: string;
  proximaDe: string;
  proximaAte: string;
  numeros: Producao;
  entregues: ItemDoResumo[];
  atrasadas: ItemDoResumo[];
  esperandoCliente: EsperandoCliente[];
  proximaSemana: ItemDoResumo[];
  foraNaProxima: { nome: string; dias: number }[];
  /**
   * O QUE OS CLIENTES PEDIRAM NESTA SEMANA, pela classificação da 0124.
   *
   * ---------------------------------------------------------------------------
   * **É AQUI QUE A CLASSIFICAÇÃO VIRA RELATÓRIO**, que é a metade do item 7
   * que o pedido chama de *"usar essa classificação nos relatórios"*. Sem este
   * bloco, a frente seria uma coluna que a tela de abertura cobra e nenhum
   * número lê — a ponte construída e nunca atravessada pela vigésima vez.
   *
   * **E ela não entra em `producao_do_periodo()`**, que é a tentação: aquela
   * função conta DEMANDA, e a demanda sabe a frente dela pela estrutura (um
   * mês de social tem `social_do_mes`, uma campanha é apontada por
   * `campaigns.task_id`). Somar as duas respostas daria dois números para a
   * mesma pergunta — e o pedido que ninguém converteu não tem demanda para
   * contar, que é exatamente o que este bloco mostra e aquele não.
   * ---------------------------------------------------------------------------
   */
  pedidos: {
    /**
     * O DESFECHO de agora dos pedidos que chegaram no período.
     *
     * **É AQUI QUE O BLOCO DEIXA DE SER UMA CAIXA DE ENTRADA.** Ele contava
     * chegadas por frente e nunca olhava `status`: dizia *"12 pedidos nesta
     * semana"* e parava — e a pergunta da segunda-feira sobre a fila é se ela
     * andou, que é `aceitamos / recusamos / ainda parado`.
     *
     * **O retrato é de AGORA e não do fim da semana**, que é a decisão escrita
     * de "O que ficou para trás": o pedido que chegou na sexta e não foi
     * triado está esperando hoje, e a frase da tela diz isso.
     */
    desfecho: { esperando: number; viraramDemanda: number; recusados: number };
    /**
     * A contagem pela classificação mais FINA de cada pedido — o tipo de
     * trabalho quando há um, a frente quando não, e "Sem classificação" por
     * último.
     *
     * ------------------------------------------------------------------------
     * **ISTO SUBSTITUI `social` / `campanha` / `semClassificacao`**, e a
     * remoção é a 0023: a frente é a dimensão COARSE e, desde a 0148, uma
     * função de `request_types.frente` — três números que a contagem por tipo
     * já contém. Deixá-los ao lado seria dar duas respostas para a mesma
     * pergunta em duas resoluções, e a que ninguém relê é a de cima.
     *
     * **E É ELA QUE CONSERTA O "sem classificação" QUE MENTIA**: dos quatro
     * tipos ativos, DOIS têm `frente` nula por desenho (0148), então um
     * "Material impresso" classificado de ponta a ponta caía naquele balde.
     * Agora ele conta como o que é, e o balde guarda só o pedido sem tipo E
     * sem frente — o anterior à 0124 e o que ninguém classificou.
     *
     * **A ORDEM É POR CONTAGEM, e "Sem classificação" vai para o fim** mesmo
     * quando é o maior: um relatório agrupa para mostrar qual balde é o maior,
     * e aquele não é um balde de trabalho, é uma lacuna.
     * ------------------------------------------------------------------------
     */
    porClassificacao: {
      rotulo: string;
      quantos: number;
      classificado: boolean;
    }[];
    lista: PedidoDoResumo[];
    sobraram: number;
  };
  /** Quantos ficaram de fora de cada lista, para a tela dizer em vez de cortar calada. */
  sobraram: { entregues: number; atrasadas: number; proximaSemana: number };
};

/**
 * A segunda-feira da semana, e o dia a N dela. A implementação é UMA, em
 * `lib/dominio/datas.ts` — a reexportação é o que mantém de pé as chamadas
 * que já apontavam para cá.
 */
export { segundaDaSemana, somarDias } from "@/lib/dominio/datas";

/** A semana pedida na URL, quando é uma data de verdade. */
export function lerSemana(valor: unknown, hoje: string): string {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return segundaDaSemana(valor);
  }
  return segundaDaSemana(hoje);
}

const COLUNAS_DA_ETAPA = "id, titulo, prazo, concluida_em, responsavel_id, task_id";

type LinhaDeEtapa = {
  id: string;
  titulo: string;
  prazo: string | null;
  concluida_em: string | null;
  responsavel_id: string | null;
  task_id: string;
};

export async function resumoDaAgencia(semana: string, hoje: string): Promise<ResumoDaAgencia> {
  const de = segundaDaSemana(semana);
  const ate = somarDias(de, 6);
  const proximaDe = somarDias(de, 7);
  const proximaAte = somarDias(de, 13);

  const supabase = await criarClienteServidor();

  const [numeros, concluidas, vencidas, proximas, rodadas, presenca, pedidos] =
    await Promise.all([
    producaoDoPeriodo(de, ate),

    // ENTREGUE É `concluida_em` NA SEMANA, e não `updated_at`: aquele carimbo
    // muda com qualquer save, então corrigir o título de uma etapa concluída
    // em janeiro a traria para o resumo desta semana.
    supabase
      .from("subtasks")
      .select(COLUNAS_DA_ETAPA)
      .not("concluida_em", "is", null)
      .gte("concluida_em", de)
      .lt("concluida_em", somarDias(ate, 1))
      .order("concluida_em", { ascending: false })
      .then((r) => ouFalha("etapas concluídas na semana", r)),

    // ATRASADA É MEDIDA HOJE, e não dentro da semana: é o estado de agora,
    // como a situação do lançamento no Financeiro. Uma etapa que venceu em
    // agosto e continua aberta é problema desta semana, não de agosto.
    supabase
      .from("subtasks")
      .select(COLUNAS_DA_ETAPA)
      .neq("status", "concluida")
      .not("prazo", "is", null)
      .lt("prazo", hoje)
      .order("prazo", { ascending: true })
      .then((r) => ouFalha("etapas vencidas", r)),

    supabase
      .from("subtasks")
      .select(COLUNAS_DA_ETAPA)
      .neq("status", "concluida")
      .gte("prazo", proximaDe)
      .lte("prazo", proximaAte)
      .order("prazo", { ascending: true })
      .then((r) => ouFalha("etapas da próxima semana", r)),

    supabase
      .from("approval_rounds")
      .select("id, content_type, content_id, solicitado_em")
      .eq("escopo", "cliente")
      .eq("status", "pendente")
      .order("solicitado_em", { ascending: true })
      .then((r) => ouFalha("rodadas esperando o cliente", r)),

    supabase
      .from("team_presence")
      .select("user_id, data, status")
      .gte("data", proximaDe)
      .lte("data", proximaAte)
      .in("status", ["ferias", "licenca", "ausente"])
      .then((r) => ouFalha("quem está fora na próxima semana", r)),

    // ---------------------------------------------------------------------
    // O QUE ENTROU NA SEMANA (0124).
    //
    // **O recorte é `created_at` e não o status**, e é o ponto: o pedido que
    // ninguém triou ainda é justamente o que precisa aparecer na conversa de
    // segunda — ele não está em demanda nenhuma, então nenhuma outra lista
    // deste resumo o alcança.
    //
    // **E ela não usa embutido**, como nenhuma consulta deste arquivo: o
    // nome do cliente e o da vertente saem de dois mapas, logo abaixo. Um
    // `clients(nome)` errado derrubaria o `select` INTEIRO e o bloco diria
    // "nenhum pedido nesta semana" — que é a resposta mais plausível que ele
    // tem.
    // ---------------------------------------------------------------------
    supabase
      .from("client_requests")
      // O TIPO E O STATUS ENTRAM NO `select`, e são as duas colunas que o
      // bloco não lia: o tipo é a classificação fina (de que a frente é
      // função desde a 0148) e o status é o DESFECHO. As duas já estavam na
      // linha — o que faltava era pedi-las.
      .select(
        "id, titulo, client_id, vertente_id, frente, request_type_id, status, created_at",
      )
      .gte("created_at", de)
      .lt("created_at", somarDias(ate, 1))
      .order("created_at", { ascending: false })
      .then((r) => ouFalha("pedidos abertos na semana", r)),
  ]);

  const todasAsEtapas = [...concluidas, ...vencidas, ...proximas];
  const [
    demandas,
    pessoas,
    agrupadoras,
    contas,
    vertentesDosPedidos,
    tiposDosPedidos,
  ] = await Promise.all([
    demandasPublicadas(todasAsEtapas.map((l) => l.task_id)),
    nomesDePessoas([
      ...todasAsEtapas.map((l) => l.responsavel_id),
      ...presenca.map((l) => l.user_id),
    ]),
    quemTemFilha(todasAsEtapas.map((l) => l.id)),
    nomesDeConta(pedidos.map((p) => p.client_id)),
    nomesDeVertente(pedidos.map((p) => p.vertente_id)),
    nomesDeTipo(pedidos.map((p) => p.request_type_id)),
  ]);

  // RASCUNHO FICA DE FORA, e o filtro é a AUSÊNCIA da demanda no mapa: quem
  // não está publicado não entra em `demandasPublicadas`, e a etapa dele some
  // da lista. É o mesmo `publicada_em is not null` que a 0035 e a 0049 usam —
  // `rascunho` não é valor de enum, de propósito.
  //
  // E DESDE A 0123 A DEMANDA QUE NÃO CONTA SAI PELA MESMA PORTA: não há um
  // segundo filtro aqui embaixo, porque a ausência no mapa já é o mecanismo.
  // ---------------------------------------------------------------------
  // SÓ FOLHA ENTRA, E É O QUE FAZ O CONTADOR DO BLOCO BATER COM O CARTÃO.
  //
  // `producao_do_periodo()` conta só folhas — quem tem filha parou de ser
  // unidade de trabalho. Sem o mesmo filtro aqui, a tela mostrava "11
  // concluídas" no cartão e uma lista dizendo 7: dois números para o mesmo
  // fato, um do lado do outro. Foi a imagem do protótipo que mostrou.
  //
  // O filtro roda em duas consultas e não numa porque `subtask_eh_agrupadora`
  // é função do Postgres e o PostgREST não a chama num `where`. Perguntar
  // quais destes ids aparecem como `parent_id` de alguém é a mesma pergunta,
  // e cabe num `in`.
  // ---------------------------------------------------------------------
  const contaNoResumo = (linha: LinhaDeEtapa) =>
    demandas.has(linha.task_id) && !agrupadoras.has(linha.id);

  const paraItem = (linha: LinhaDeEtapa, data: string | null): ItemDoResumo => {
    const demanda = demandas.get(linha.task_id);
    return {
      id: linha.id,
      titulo: linha.titulo,
      // A LINHAGEM, como em Minhas Tasks. Uma etapa chamada "Revisão" sozinha
      // numa lista da agência inteira não diz de quem é nem de quê.
      contexto: [demanda?.cliente, demanda?.titulo].filter(Boolean).join(" · ") || null,
      pessoa: linha.responsavel_id ? (pessoas.get(linha.responsavel_id) ?? null) : null,
      data,
      link: `/painel/gestao-tasks/${linha.task_id}`,
    };
  };

  const entregues = concluidas.filter(contaNoResumo);
  const atrasadas = vencidas.filter(contaNoResumo);
  const daProxima = proximas.filter(contaNoResumo);

  // QUEM ESTÁ FORA VIRA UMA LINHA POR PESSOA, com a contagem de dias: a
  // consulta devolve um registro por dia, e cinco linhas "Marina" seguidas
  // são cinco vezes a mesma informação ocupando o bloco inteiro.
  const diasFora = new Map<string, number>();
  for (const linha of presenca) {
    diasFora.set(linha.user_id, (diasFora.get(linha.user_id) ?? 0) + 1);
  }

  // AS CONTAGENS SAEM DA LISTA INTEIRA, e nunca das oito linhas desenhadas:
  // é o contador das abas de Pedidos pela quinta vez — o recorte acontece na
  // tela, e o número vem do período todo.
  //
  // E A CLASSIFICAÇÃO DE CADA LINHA SAI DE UM LUGAR SÓ,
  // `classificacaoDoPedido()`: ela é o tipo quando há tipo, a frente quando
  // não há, e "Sem classificação" quando não há nenhum dos dois. Duas
  // respostas para *de que é este pedido* divergiriam, e o que divergiria é
  // a da contagem — o número que a lista embaixo existe para conferir.
  const classificados = pedidos.map((p) => ({
    ...p,
    classificacao: classificacaoDoPedido(
      p.request_type_id ? (tiposDosPedidos.get(p.request_type_id) ?? null) : null,
      p.frente,
    ),
    desfecho: desfechoDoPedido(p.status),
  }));

  const desfecho = {
    esperando: classificados.filter((p) => p.desfecho === "esperando").length,
    viraramDemanda: classificados.filter((p) => p.desfecho === "virou_demanda")
      .length,
    recusados: classificados.filter((p) => p.desfecho === "recusado").length,
  };

  // A ORDEM É POR CONTAGEM, E "Sem classificação" É SEMPRE A ÚLTIMA.
  //
  // Os outros baldes são tipos de trabalho e competem entre si pelo tamanho;
  // aquele não é um balde de trabalho, é uma LACUNA — e uma lacuna no meio da
  // frase se lê como mais uma categoria. No fim, ela se lê como o que é: o
  // resto que ninguém classificou.
  const contagem = new Map<string, { quantos: number; classificado: boolean }>();
  for (const p of classificados) {
    const antes = contagem.get(p.classificacao.rotulo);
    contagem.set(p.classificacao.rotulo, {
      quantos: (antes?.quantos ?? 0) + 1,
      classificado: p.classificacao.classificado,
    });
  }
  const porClassificacao = [...contagem.entries()]
    .map(([rotulo, c]) => ({ rotulo, ...c }))
    .sort((a, b) => {
      if (a.classificado !== b.classificado) return a.classificado ? -1 : 1;
      if (b.quantos !== a.quantos) return b.quantos - a.quantos;
      return a.rotulo.localeCompare(b.rotulo, "pt-BR");
    });

  return {
    de,
    ate,
    proximaDe,
    proximaAte,
    numeros,
    entregues: entregues.slice(0, NO_MAXIMO).map((l) => paraItem(l, l.concluida_em)),
    atrasadas: atrasadas.slice(0, NO_MAXIMO).map((l) => paraItem(l, l.prazo)),
    esperandoCliente: await montarEsperandoCliente(rodadas, hoje),
    proximaSemana: daProxima.slice(0, NO_MAXIMO).map((l) => paraItem(l, l.prazo)),
    foraNaProxima: [...diasFora.entries()]
      .map(([id, dias]) => ({ nome: pessoas.get(id) ?? "—", dias }))
      .sort((a, b) => b.dias - a.dias),
    pedidos: {
      desfecho,
      porClassificacao,
      lista: classificados.slice(0, NO_MAXIMO).map((p) => ({
        id: p.id,
        titulo: p.titulo,
        cliente: contas.get(p.client_id) ?? null,
        vertente: p.vertente_id
          ? (vertentesDosPedidos.get(p.vertente_id) ?? null)
          : null,
        classificacao: p.classificacao,
        desfecho: p.desfecho,
        link: `/painel/solicitacoes/${p.id}`,
      })),
      sobraram: Math.max(0, pedidos.length - NO_MAXIMO),
    },
    sobraram: {
      entregues: Math.max(0, entregues.length - NO_MAXIMO),
      atrasadas: Math.max(0, atrasadas.length - NO_MAXIMO),
      proximaSemana: Math.max(0, daProxima.length - NO_MAXIMO),
    },
  };
}

/**
 * As rodadas paradas com o cliente, com o nome do que está esperando.
 *
 * **O tipo decide a tabela**, como em `rodadasDo()`: a rodada aponta para
 * `(content_type, content_id)` desde a 0030, e cada tipo chega ao nome dele
 * por um caminho. Uma consulta só não existe — são tabelas diferentes.
 *
 * **O que a RLS não devolver simplesmente não entra na lista**, em vez de
 * aparecer como linha sem nome: "—, há 9 dias" não diz nada e ainda conta no
 * total.
 */
async function montarEsperandoCliente(
  rodadas: { id: string; content_type: string; content_id: string; solicitado_em: string }[],
  hoje: string,
): Promise<EsperandoCliente[]> {
  if (rodadas.length === 0) return [];
  const supabase = await criarClienteServidor();

  const idsDe = (tipo: string) =>
    rodadas.filter((r) => r.content_type === tipo).map((r) => r.content_id);

  const [etapas, posts, entregaveis, clientes] = await Promise.all([
    idsDe("subtask").length > 0
      ? supabase
          .from("subtasks")
          .select("id, titulo, task_id")
          .in("id", idsDe("subtask"))
          .then((r) => ouFalha("etapas esperando o cliente", r))
      : Promise.resolve([]),
    idsDe("post").length > 0
      ? supabase
          // `tema` E NÃO `titulo`: a coluna do post se chama assim desde a
          // 0032, e foi o typecheck que pegou. Um embutido com o nome errado
          // teria derrubado o `select` inteiro em silêncio.
          .from("posts")
          .select("id, tema, client_id")
          .in("id", idsDe("post"))
          .then((r) => ouFalha("posts esperando o cliente", r))
      : Promise.resolve([]),
    idsDe("deliverable").length > 0
      ? supabase
          .from("deliverables")
          .select("id, nome, campaign_id")
          .in("id", idsDe("deliverable"))
          .then((r) => ouFalha("entregáveis esperando o cliente", r))
      : Promise.resolve([]),
    nomesDeClientes(),
  ]);

  const demandas = await demandasPublicadas(etapas.map((e) => e.task_id));
  const campanhas = await clientesDasCampanhas(entregaveis.map((d) => d.campaign_id));

  const item = new Map<string, { titulo: string; cliente: string | null; link: string }>();
  for (const e of etapas) {
    if (!demandas.has(e.task_id)) continue;
    item.set(e.id, {
      titulo: e.titulo,
      cliente: demandas.get(e.task_id)?.cliente ?? null,
      link: `/painel/gestao-tasks/${e.task_id}`,
    });
  }
  for (const p of posts) {
    item.set(p.id, {
      titulo: p.tema,
      cliente: clientes.get(p.client_id) ?? null,
      link: `/painel/social-media?post=${p.id}`,
    });
  }
  for (const d of entregaveis) {
    item.set(d.id, {
      titulo: d.nome,
      cliente: campanhas.get(d.campaign_id) ?? null,
      link: `/painel/aprovacoes/campanhas/${d.campaign_id}`,
    });
  }

  const DIA = 86400000;
  const agora = new Date(`${hoje}T12:00:00Z`).getTime();

  return rodadas
    .filter((r) => item.has(r.content_id))
    .map((r) => {
      const achado = item.get(r.content_id)!;
      return {
        id: r.id,
        titulo: achado.titulo,
        cliente: achado.cliente,
        desdeEmDias: Math.max(0, Math.round((agora - new Date(r.solicitado_em).getTime()) / DIA)),
        link: achado.link,
      };
    })
    .sort((a, b) => b.desdeEmDias - a.desdeEmDias)
    .slice(0, NO_MAXIMO);
}

// ---------------------------------------------------------------------------
// OS MAPAS DE NOME
// ---------------------------------------------------------------------------

/**
 * Quais destes ids são AGRUPADORAS — isto é, têm pelo menos uma sub-etapa.
 *
 * É a mesma pergunta que `subtask_eh_agrupadora()` faz no Postgres, escrita
 * do jeito que o PostgREST consegue responder. Os dois lados existem de
 * propósito, como `situacaoDoLancamento()` no Financeiro: o banco decide o
 * que contar, a tela decide o que desenhar.
 */
async function quemTemFilha(ids: string[]): Promise<Set<string>> {
  const limpos = [...new Set(ids)];
  if (limpos.length === 0) return new Set();

  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "etapas agrupadoras do resumo",
    await supabase.from("subtasks").select("parent_id").in("parent_id", limpos),
  );
  return new Set((linhas ?? []).map((l) => l.parent_id).filter((id): id is string => Boolean(id)));
}

async function demandasPublicadas(
  ids: string[],
): Promise<Map<string, { titulo: string; cliente: string | null }>> {
  const limpos = [...new Set(ids)];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const [tasks, clientes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, titulo, client_id")
      .in("id", limpos)
      .not("publicada_em", "is", null)
      // A LINHA DA 0123, ao lado do filtro de rascunho porque as duas
      // respondem a mesma pergunta: isto é produção da agência? Ela é o par
      // do `and t.conta_no_resumo` de `producao_do_periodo()` — sem as duas,
      // o cartão contaria uma coisa e a lista embaixo mostraria outra, que é
      // o bug do "11 entregues" com sete na lista.
      .eq("conta_no_resumo", true)
      .then((r) => ouFalha("demandas do resumo", r)),
    nomesDeClientes(),
  ]);

  return new Map(
    (tasks ?? []).map((t) => [
      t.id,
      { titulo: t.titulo, cliente: t.client_id ? (clientes.get(t.client_id) ?? null) : null },
    ]),
  );
}

async function clientesDasCampanhas(ids: string[]): Promise<Map<string, string | null>> {
  const limpos = [...new Set(ids)];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const [campanhas, clientes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, client_id")
      .in("id", limpos)
      .then((r) => ouFalha("campanhas do resumo", r)),
    nomesDeClientes(),
  ]);

  return new Map((campanhas ?? []).map((c) => [c.id, clientes.get(c.client_id) ?? null]));
}

/**
 * `cache()` porque TRÊS caminhos deste arquivo pedem o mesmo mapa na mesma
 * renderização — as demandas, as campanhas e os posts. Sem ele são três idas
 * idênticas ao banco para montar uma tela só. O `cache` do React dedup dentro
 * de UMA renderização e não guarda nada entre requisições, que é o que
 * importa: o mapa depende do que o RLS devolve para quem está logado.
 */
const nomesDeClientes = cache(async (): Promise<Map<string, string>> => {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "nomes de clientes do resumo",
    await supabase.from("clients").select("id, nome_empresa"),
  );
  return new Map((linhas ?? []).map((c) => [c.id, c.nome_empresa]));
});

/**
 * O nome de cada conta, para o bloco dos pedidos (0124).
 *
 * **Separado de `clientesDasCampanhas` de propósito:** aquele parte de
 * `campaigns` para chegar ao cliente, e este já tem o `client_id` na mão. Um
 * parâmetro a mais naquele faria uma função responder duas perguntas.
 */
async function nomesDeConta(ids: string[]): Promise<Map<string, string>> {
  const limpos = [...new Set(ids.filter(Boolean))];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "nomes das contas dos pedidos",
    await supabase.from("clients").select("id, nome_empresa").in("id", limpos),
  );
  return new Map(linhas.map((c) => [c.id, c.nome_empresa]));
}

/**
 * O nome de cada vertente (0124, sobre a 0118).
 *
 * **A desativada vem junto**, pela razão escrita em `vertentesDasContas()`: o
 * relatório desenha o nome da vertente de um pedido que aponta para ela, e
 * sumir com a linha deixaria o pedido classificado sem nome na tela.
 */
async function nomesDeVertente(
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const limpos = [...new Set(ids.filter(Boolean))] as string[];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "nomes das vertentes dos pedidos",
    await supabase.from("client_vertentes").select("id, nome").in("id", limpos),
  );
  return new Map(linhas.map((v) => [v.id, v.nome]));
}

/**
 * O nome de cada tipo de trabalho pedido — a classificação FINA.
 *
 * **ELA É A COLUNA QUE O BLOCO NÃO LIA, e é ela que desfaz o "sem
 * classificação" que mentia:** desde a 0148 a frente é FUNÇÃO do tipo, e dois
 * dos quatro tipos ativos têm `frente` nula de propósito ("Material impresso"
 * e "Outro" não são social nem campanha) — então um pedido inteiramente
 * classificado caía no balde da lacuna. O tipo responde o que a frente não
 * tem como responder.
 *
 * **O DESATIVADO VEM JUNTO**, pela razão escrita em `nomesDeVertente()`: o
 * relatório desenha o nome do tipo de um pedido que aponta para ele, e sumir
 * com a linha deixaria o pedido classificado sem nome na tela.
 * `request_types_select` é `is_staff() or ativo` desde a 0068, então a leitura
 * da agência alcança os dois.
 */
async function nomesDeTipo(
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const limpos = [...new Set(ids.filter(Boolean))] as string[];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "nomes dos tipos de trabalho dos pedidos",
    await supabase.from("request_types").select("id, nome").in("id", limpos),
  );
  return new Map(linhas.map((t) => [t.id, t.nome]));
}

async function nomesDePessoas(ids: (string | null)[]): Promise<Map<string, string>> {
  const limpos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (limpos.length === 0) return new Map();
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "nomes do resumo",
    await supabase.from("profiles").select("id, nome").in("id", limpos),
  );
  return new Map((linhas ?? []).map((p) => [p.id, p.nome]));
}
