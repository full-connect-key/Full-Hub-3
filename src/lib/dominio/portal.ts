import { FUSO_DA_AGENCIA, hojeNaAgencia } from "@/lib/dominio/datas";
import type {
  ContentStatus,
  StatusRodada,
  TipoDeConteudo,
} from "@/lib/supabase/database.types";

/**
 * O vocabulário do Portal do Cliente.
 *
 * **Nada de jargão interno aqui.** "Task", "subtarefa", "etapa", "workflow" e
 * "sprint" são palavras da agência. O cliente recebe MATERIAL para aprovar, e
 * ele pertence a uma DEMANDA. Este módulo é onde a tradução acontece — e por
 * ser um lugar só, `check:cores` consegue varrer o resto de `(cliente)/` atrás
 * das palavras que não podem aparecer.
 *
 * Função pura, sem banco: a página (servidor) e os filtros (navegador)
 * precisam enxergar o mesmo conjunto sem uma segunda consulta.
 */

export type TipoDeItem = TipoDeConteudo;

/**
 * O rótulo do item na língua do cliente.
 *
 * `subtask` vira "Entregável" porque é o que ele é do lado de lá: um material
 * que a agência produziu e mandou. Post e Campanha chegam com os módulos
 * deles, e os rótulos já estão aqui para a tela não precisar aprender duas
 * vezes.
 */
export const ROTULO_DO_TIPO: Record<TipoDeItem, string> = {
  subtask: "Entregável",
  post: "Post",
  deliverable: "Entregável de campanha",
};

export const TIPOS_DE_ITEM: TipoDeItem[] = ["subtask", "post", "deliverable"];

/** Como o item chega na tela do cliente. */
export type ItemDoPortal = {
  /** A rodada, quando existe uma esperando ou já decidida. */
  rodadaId: string | null;
  tipo: TipoDeItem;
  /** O id do conteúdo — a etapa, o post, o entregável. */
  conteudoId: string;
  titulo: string;
  /** A demanda a que ele pertence. Contexto, nunca o item. */
  demanda: string;
  /**
   * O id da demanda, quando o material vem de uma.
   *
   * Existe para uma pergunta só: **"o que já chegou por este pedido?"** — o
   * detalhe do pedido do cliente cruza `tasks.request_id` com esta coluna, e
   * sem ela o pedido concluído seria um beco, com um selo verde e nada para
   * abrir.
   *
   * **`null` no post e no material de campanha, e é decisão.** Os dois têm
   * demanda própria — o mês de social e a campanha —, e nenhuma das duas nasce
   * de um pedido: a conversão abre uma demanda nova, e `abrir_campanha()` e
   * `abrir_mes_de_social()` abrem as delas. Preencher os dois custaria duas
   * consultas a mais na leitura que serve a tela inicial, o contador e a
   * lista, para responder uma pergunta que nunca é feita.
   */
  demandaId: string | null;
  clienteId: string;
  cliente: string;
  status: ContentStatus;
  prazo: string | null;
  /** Quando foi enviado para decisão. */
  enviadoEm: string | null;
  miniatura: string | null;
  /**
   * Onde o material se decide, a partir do prefixo da área.
   *
   * **Relativo, e não absoluto**, porque o mesmo item é lido pelas duas
   * entradas: `/portal` para o cliente e `/portal/{slug}` para a equipe. Quem
   * cola o prefixo é a tela, que é quem sabe de onde está sendo olhada.
   *
   * `null` para o material que vem de uma demanda: ele se decide na própria
   * fila de aprovações, e um link para uma tela que não existe é pior que
   * nenhum link.
   */
  caminho: string | null;
};

/**
 * O status que o CLIENTE vê, a partir do que o banco guarda.
 *
 * O produto tem três vocabulários de status — `task_status`,
 * `subtask_status` e `content_status` — e não é descuido: são três perguntas
 * diferentes. "Em ajustes" para a equipe quer dizer que alguém está mexendo;
 * para o cliente quer dizer que o pedido dele foi ouvido. Esta função é a
 * ponte, e é a única.
 *
 * `rejeitado` e `stand_by` não saem daqui hoje: nenhum caminho do produto
 * produz esses dois ainda. Estão no enum porque os Sprints 12 e 13 os usam, e
 * inventar uma tradução agora seria mostrar ao cliente um estado que a agência
 * não tem como alcançar.
 */
export function statusParaOCliente(entrada: {
  rodada: StatusRodada | null;
  etapaConcluida: boolean;
  aguardandoInformacoes: boolean;
}): ContentStatus {
  if (entrada.rodada === "pendente") return "em_aprovacao";
  if (entrada.rodada === "ajustes_solicitados") return "ajustes";
  if (entrada.rodada === "aprovada") return "aprovado";
  // `rejeitada` entrou na 0032 e só nasce em post. Está aqui porque o tipo
  // passou a permiti-la, e um `default` silencioso mostraria "em produção"
  // para um material que o cliente recusou.
  if (entrada.rodada === "rejeitada") return "rejeitado";
  if (entrada.etapaConcluida) return "aprovado";
  if (entrada.aguardandoInformacoes) return "aguardando_informacoes";
  return "em_producao";
}

/**
 * AS QUATRO FASES DO MATERIAL — o que o filtro do Social oferece ao cliente.
 *
 * ---------------------------------------------------------------------------
 * **São QUATRO, e `content_status` tem SETE.** Decisão de desenho, escolhida
 * entre três propostas: a faixa de filtros do Social no portal era catorze
 * pílulas do mesmo peso em duas fileiras — sete redes e sete status — antes
 * do calendário, que é a peça que o cliente veio ver.
 *
 * **Três dos sete querem dizer a mesma coisa do lado de fora.** "Em produção",
 * "Aguardando informações" e "Stand by" descrevem onde o trabalho está DENTRO
 * da agência; para quem está do outro lado os três dizem *a Full está
 * trabalhando nisso*. Oferecer os três é pedir ao cliente que escolha entre
 * distinções que não são dele.
 *
 * **E a fase é DERIVADA, não uma coluna.** É a decisão de `faseDoPedido()` nas
 * abas de Pedidos, de `maoDoPost()` no Social Media e de "atraso não é coluna"
 * no Financeiro: um `fase` em `posts` precisaria ser reescrito por todo caminho
 * que mexe no status para continuar verdadeiro.
 *
 * **O selo de cada card continua dizendo o status exato.** A fase agrupa o
 * FILTRO, e não o que a linha mostra — quem abre um material em "Em produção"
 * continua lendo "Aguardando informações" se for o caso.
 * ---------------------------------------------------------------------------
 */
export type FaseDoMaterial =
  | "esperando"
  | "producao"
  | "ajustes"
  | "aprovados"
  | "recusados";

/**
 * De que fase é cada status.
 *
 * `Record` sobre a união inteira, e não um `switch` com `default`: um valor
 * novo em `content_status` quebra o tipo aqui em vez de cair calado numa fase
 * que ninguém escolheu.
 */
export const FASE_DO_STATUS: Record<ContentStatus, FaseDoMaterial> = {
  em_aprovacao: "esperando",
  em_producao: "producao",
  aguardando_informacoes: "producao",
  stand_by: "producao",
  ajustes: "ajustes",
  aprovado: "aprovados",
  rejeitado: "recusados",
};

/**
 * A ordem e o rótulo, num lugar só.
 *
 * **"Recusado" é a quinta e só aparece quando existe uma**, como a aba
 * Recusado dos Pedidos: ela não cabe em nenhuma das quatro — em "Aprovados"
 * afirmaria o contrário, e fora da faixa o material sumiria da tela de quem
 * precisa justamente dele.
 */
export const FASES_DO_MATERIAL: {
  fase: FaseDoMaterial;
  rotulo: string;
  /**
   * O rótulo na visualização administrativa, quando ele muda de dono.
   *
   * "Esperando você" dito a alguém da agência é falso — e a mesma tela já
   * troca a frase do contador ("a decisão do cliente"). Ele mora aqui e não
   * num `if` na faixa de filtros, porque a troca é do vocabulário e não do
   * desenho: é a decisão dos dois mapas de rótulo das Solicitações, onde o
   * mesmo valor quer dizer coisas diferentes dos dois lados.
   */
  rotuloParaEquipe?: string;
  /** Só desenha quando houver material nela. */
  soComItem?: boolean;
}[] = [
  {
    fase: "esperando",
    rotulo: "Esperando você",
    rotuloParaEquipe: "Esperando o cliente",
  },
  { fase: "producao", rotulo: "Em produção" },
  { fase: "ajustes", rotulo: "Em ajustes" },
  { fase: "aprovados", rotulo: "Aprovados" },
  { fase: "recusados", rotulo: "Recusados", soComItem: true },
];

/**
 * Quanto do caminho o material já andou, para a barra do bloco "Em andamento".
 *
 * ---------------------------------------------------------------------------
 * **É UMA APROXIMAÇÃO, e isso é dito aqui porque a barra não tem como dizer.**
 * Não existe "40% de uma arte pronta": o que o produto sabe é em que etapa do
 * ciclo com o cliente o material está, e a barra traduz isso em comprimento
 * para a tela responder de relance o que a lista responde por extenso.
 *
 * **Ela mora aqui e não na tela** pela razão de `STATUS_EM_ORDEM`: a mesma
 * barra aparece no bloco do Início e vai aparecer no detalhe da entrega, e
 * duas cópias divergiriam na primeira vez que alguém acrescentasse um status
 * — o produto já pagou isso com `ICONE_DA_AREA`, que teve três cópias e duas
 * já divergidas.
 *
 * **`rejeitado` é 0 e não 100**, embora ele seja um fim: a barra responde
 * "quanto falta para isto ficar pronto", e uma peça recusada vai ser refeita
 * do começo. Pintá-la cheia diria que acabou.
 * ---------------------------------------------------------------------------
 */
export const PROGRESSO_DO_STATUS: Record<ContentStatus, number> = {
  // Parou esperando alguma coisa — o trabalho mal começou.
  aguardando_informacoes: 10,
  stand_by: 10,
  em_producao: 40,
  // Voltou para a agência depois de uma primeira versão: andou mais que
  // "em produção", e menos que o que está com o cliente.
  ajustes: 65,
  em_aprovacao: 90,
  aprovado: 100,
  rejeitado: 0,
};

export function progressoDoMaterial(status: ContentStatus): number {
  return PROGRESSO_DO_STATUS[status];
}

export function faseDoMaterial(status: ContentStatus): FaseDoMaterial {
  return FASE_DO_STATUS[status];
}

export function ehFaseDoMaterial(valor: string): valor is FaseDoMaterial {
  return FASES_DO_MATERIAL.some((f) => f.fase === valor);
}

/** Os três recortes de prazo do filtro. */
export type FocoDePrazo = "urgente" | "semana" | "adiante";

export const ROTULOS_DE_PRAZO: Record<FocoDePrazo, string> = {
  urgente: "Urgente",
  semana: "Esta semana",
  adiante: "Próximas semanas",
};

/**
 * "Urgente" é hoje OU vencido, e os dois no vermelho.
 *
 * Item sem prazo não é urgente — é item que ninguém datou. Ele cai em
 * "próximas semanas", e não no topo: subir ao topo o que não tem data faria o
 * contador de urgentes contar coisa que não vence.
 */
export function focoDoPrazo(
  prazo: string | null,
  hoje: string,
  fimDaSemana: string,
): FocoDePrazo {
  if (!prazo) return "adiante";
  if (prazo <= hoje) return "urgente";
  if (prazo <= fimDaSemana) return "semana";
  return "adiante";
}

export function estaVencendo(prazo: string | null, hoje: string): boolean {
  return prazo !== null && prazo <= hoje;
}

export type FiltrosDoPortal = {
  tipo: TipoDeItem | null;
  status: ContentStatus | null;
  prazo: FocoDePrazo | null;
  busca: string;
};

export const SEM_FILTRO: FiltrosDoPortal = {
  tipo: null,
  status: null,
  prazo: null,
  busca: "",
};

export function temFiltro(f: FiltrosDoPortal): boolean {
  return (
    f.tipo !== null ||
    f.status !== null ||
    f.prazo !== null ||
    f.busca.trim() !== ""
  );
}

/**
 * O filtro, em um lugar só.
 *
 * A lista e o contador chamam a MESMA função — é isso que faz o número do
 * cartão bater com a quantidade de cartões embaixo dele. Duas contagens
 * escritas separado divergem no dia em que alguém acrescenta um filtro.
 */
export function combinaComFiltro(
  item: ItemDoPortal,
  filtros: FiltrosDoPortal,
  hoje: string,
  fimDaSemana: string,
): boolean {
  if (filtros.tipo && item.tipo !== filtros.tipo) return false;
  if (filtros.status && item.status !== filtros.status) return false;
  if (
    filtros.prazo &&
    focoDoPrazo(item.prazo, hoje, fimDaSemana) !== filtros.prazo
  )
    return false;

  const termo = filtros.busca.trim().toLowerCase();
  if (termo) {
    const alvo = `${item.titulo} ${item.demanda} ${item.cliente}`.toLowerCase();
    if (!alvo.includes(termo)) return false;
  }

  return true;
}

/**
 * Mais urgente primeiro.
 *
 * Prazo crescente deixa o vencido no topo por construção. Quem não tem prazo
 * vai para o fim, pela mesma razão de `focoDoPrazo`.
 */
export function ordenarPorUrgencia(a: ItemDoPortal, b: ItemDoPortal): number {
  if (a.prazo !== b.prazo) {
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return a.prazo.localeCompare(b.prazo);
  }
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}

/* ========================================================================== *
 *  O ANDAMENTO DO MATERIAL — onde ele está, e quando cada coisa aconteceu
 * ========================================================================== */

/**
 * Um passo da linha de andamento.
 *
 * `quando` é nulo quando o passo aconteceu e o produto **não tem a data** — e
 * isso é diferente de o passo não ter acontecido, que é `estado: "futuro"`. A
 * tela desenha os dois de jeitos diferentes de propósito.
 */
export type PassoDoAndamento = {
  rotulo: string;
  estado: "concluido" | "atual" | "futuro";
  /** O instante, quando existe uma coluna que o guarda. */
  quando: string | null;
};

/**
 * OS PASSOS DO MATERIAL, na língua do cliente.
 *
 * ---------------------------------------------------------------------------
 * **O sprint pede uma escada de cinco passos — Recebida, Em criação, Em
 * revisão, Para aprovar, Aprovada — cada um com o horário em que foi
 * atingido. Três daqueles cinco não existem deste lado da porta, e a diferença
 * não é de vocabulário: é de quem pode ler o quê.**
 *
 * "Em criação" e "Em revisão" são elos da corrente interna — `subtasks` com
 * `social_papel`, e as caixinhas de `post_etapa_progresso`. O cliente não tem
 * policy em nenhuma das duas, e não passa a ter: a corrente diz quem está com
 * o material na mão, qual fase travou e quem atrasou (0045). Mostrá-los
 * exigiria abrir a conversa interna da agência ou inventar uma função nova
 * para devolver o que a regra do módulo mantém fechado.
 *
 * **E o horário de cada passo não existe nem internamente.** Não há histórico
 * por status de um material: o que o produto guarda é o carimbo de quando ele
 * foi enviado, a data de cada versão, e quando cada rodada abriu e foi
 * decidida. Escrever "hoje 10:40" num passo sem coluna que o date seria
 * inventar um fato na tela que o cliente usa para decidir — o oposto do que
 * esta tela existe para fazer.
 *
 * **Então os passos são o CICLO DE DECISÃO** — que é o que o
 * cliente efetivamente percorre, e o único recorte em que cada passo tem uma
 * coluna por trás. O quarto só existe quando a bola está de volta com a
 * agência, e ele é o único sem data: produção é trabalho interno, e o cliente
 * sabe que ele está acontecendo, não quando cada parte dele aconteceu.
 * ---------------------------------------------------------------------------
 *
 * **Tudo o que o cliente vê foi enviado**, então o primeiro passo está sempre
 * cumprido: `posts_select_cliente` e `deliverables_select_cliente` exigem
 * `enviado_em`. Um material em produção que nunca saiu não chega a esta tela.
 *
 * **E a escada conta o ciclo CORRENTE, não todos eles.** Pedido um ajuste, o
 * segundo e o terceiro passo voltam a se datar pela rodada nova — os ciclos
 * anteriores ficam no histórico de versões, logo abaixo, que é onde eles
 * informam: lá cada versão tem número, data e o que mudou.
 */
export function andamentoDoMaterial(entrada: {
  status: ContentStatus;
  /** Quando o material chegou para o cliente — `enviado_em`. */
  recebidoEm: string | null;
  /** Quando a decisão desta rodada foi pedida — `solicitado_em`. */
  decisaoPedidaEm: string | null;
  /** Quando a última rodada fechada foi decidida. */
  decididoEm: string | null;
  /**
   * QUEM decidiu, quando o nome é conhecido.
   *
   * **Ele entra no rótulo do desfecho, e não numa linha à parte**, porque o
   * registro da decisão existia em DOIS lugares nesta tela: a escada e o
   * parágrafo *"Aprovado por Joana em 12/03 às 10:40"* que ficava embaixo dos
   * botões. Dois lugares dizendo o mesmo fato é o cartão de "11 entregues"
   * com sete na lista embaixo — e aqui o que sobreviveu é a escada, porque ela
   * já carrega o QUANDO.
   */
  decididoPor?: string | null;
}): PassoDoAndamento[] {
  const fase = FASE_DO_STATUS[entrada.status];
  const esperando = fase === "esperando";
  const decidido = fase === "aprovados" || fase === "ajustes" || fase === "recusados";
  // A BOLA ESTÁ COM A AGÊNCIA: o cliente pediu ajuste e a versão nova ainda
  // não voltou, ou o material reabriu por outro caminho.
  const naAgencia = fase === "producao" || fase === "ajustes";

  const passos: PassoDoAndamento[] = [];

  // "RECEBIDO" SÓ APARECE QUANDO ELE DIZ ALGO QUE O PASSO SEGUINTE NÃO DIZ.
  //
  // Na primeira rodada os dois são o MESMO evento, e isso é regra do produto e
  // não coincidência: enviar ao cliente É abrir a rodada dele (0032), então
  // `enviado_em` e `solicitado_em` nascem do mesmo `now()`, na mesma
  // transação. Desenhar os dois dava duas linhas com o mesmo horário — e dois
  // carimbos iguais, um embaixo do outro, leem como defeito mesmo sendo
  // verdade.
  //
  // A partir do segundo ciclo eles divergem, e aí cada um informa: "Recebido
  // 12/10" com "Enviado para a sua decisão ontem" é a frase que diz, sem
  // dizer, que esta peça já foi e voltou.
  //
  // A comparação é pelo MINUTO em UTC, que é a precisão que a tela mostra: o
  // fuso é um deslocamento fixo, então minutos iguais em UTC são minutos
  // iguais em São Paulo. Comparar o instante cru faria dois carimbos a um
  // microssegundo de distância voltarem a desenhar a linha repetida.
  const mesmoInstante =
    entrada.recebidoEm !== null &&
    entrada.decisaoPedidaEm !== null &&
    entrada.recebidoEm.slice(0, 16) === entrada.decisaoPedidaEm.slice(0, 16);

  if (entrada.recebidoEm && !mesmoInstante) {
    passos.push({
      rotulo: "Recebido",
      estado: "concluido",
      quando: entrada.recebidoEm,
    });
  }

  passos.push(
    {
      // "ENVIADO PARA A SUA DECISÃO" e não "Esperando": o rótulo é lido nos
      // dois tempos — como passo da vez, enquanto a peça espera, e como passo
      // cumprido, depois que ela foi decidida. "Esperando a sua decisão" com
      // um tique verde ao lado é a tela afirmando as duas coisas de uma vez.
      rotulo: "Enviado para a sua decisão",
      estado: esperando ? "atual" : decidido ? "concluido" : "futuro",
      quando: entrada.decisaoPedidaEm ?? entrada.recebidoEm,
    },
    {
      // O RÓTULO É O DESFECHO, e não a palavra "Decidido": quem abre a tela
      // depois de decidir quer ler o que ele decidiu, e "Decidido" manda a
      // pessoa procurar isso no selo de status lá em cima.
      rotulo: rotuloDoDesfecho(entrada.status, entrada.decididoPor ?? null),
      estado: decidido ? "concluido" : "futuro",
      quando: decidido ? entrada.decididoEm : null,
    },
  );

  if (naAgencia) {
    passos.push({
      rotulo: "Em produção na Full",
      estado: "atual",
      // SEM DATA, e é a ausência honesta: o que a agência faz aqui dentro não
      // tem carimbo que o cliente possa ler. A próxima data que ele vê é a da
      // versão nova, no histórico.
      quando: null,
    });
  }

  return passos;
}

/**
 * O nome do desfecho, na língua de quem decidiu.
 *
 * **"por você" quando não há nome, e nunca "por alguém".** Múltiplos usuários
 * da mesma empresa têm o mesmo acesso e os dois decidem — então quem lê pode
 * não ter sido quem decidiu. Com o nome, a frase diz qual dos dois foi; sem
 * ele, "por você" é verdade do lado de lá da porta: a decisão foi da empresa
 * de quem está lendo, e é o que o selo de status já afirma.
 *
 * **Na visualização administrativa o nome vem preenchido**, que é justamente
 * onde "por você" seria falso — quem está olhando é a agência.
 */
function rotuloDoDesfecho(
  status: ContentStatus,
  quem: string | null,
): string {
  const por = quem ? `por ${quem}` : "por você";
  if (status === "aprovado") return `Aprovado ${por}`;
  if (status === "ajustes") return `Ajustes pedidos ${por}`;
  if (status === "rejeitado") return `Recusado ${por}`;
  return "A sua decisão";
}

/**
 * "hoje 10:40", "ontem 15:05", "12/11 09:12", "12/11/2025".
 *
 * **O relógio é o DA AGÊNCIA, nunca o do processo**, pela razão inteira de
 * `lib/dominio/datas.ts`: o container roda em UTC, e `format(parseISO(iso))`
 * mostraria 12:40 para uma decisão tomada às 09:40 em São Paulo. Num passo que
 * diz a que horas alguém aprovou uma peça, três horas de erro é a tela
 * afirmando o que não aconteceu.
 *
 * **E o "agora" vem de fora**, como em `tempoRelativo()` das Recomendações: se
 * esta função lesse o relógio, o servidor escreveria "ontem" e o navegador
 * recalcularia "hoje" na hidratação.
 *
 * O dia sai em `dd/MM` e não em "12 nov" porque é o formato que o produto usa
 * em toda parte — `DateBadge`, a matriz do Day Off, o histórico de versões.
 * Duas convenções de data na mesma tela é a pessoa lendo duas vezes para
 * conferir que são a mesma coisa.
 */
export function quandoDoPasso(iso: string, agoraISO: string): string {
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_DA_AGENCIA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

  // `hojeNaAgencia` responde o DIA DA AGÊNCIA de um instante qualquer — o
  // "hoje" do nome é o caso do argumento padrão. Comparar os dois dias assim
  // é o que faz a virada de meia-noite acontecer em São Paulo e não em UTC.
  const dia = hojeNaAgencia(new Date(iso));
  const hojeDaAgencia = hojeNaAgencia(new Date(agoraISO));

  if (dia === hojeDaAgencia) return `hoje ${hora}`;

  // A conta é em UTC sobre duas datas SIMPLES, como `fimDaSemanaNaAgencia`:
  // não há instante envolvido, só dois dias do calendário.
  const diferenca = Math.round(
    (new Date(`${hojeDaAgencia}T00:00:00Z`).getTime() -
      new Date(`${dia}T00:00:00Z`).getTime()) /
      86400000,
  );
  if (diferenca === 1) return `ontem ${hora}`;

  const [ano, mes, diaDoMes] = dia.split("-");
  if (ano === hojeDaAgencia.slice(0, 4)) return `${diaDoMes}/${mes} ${hora}`;
  return `${diaDoMes}/${mes}/${ano}`;
}
