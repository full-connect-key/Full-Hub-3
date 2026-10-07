import { faseDoMaterial, type FaseDoMaterial } from "@/lib/dominio/portal";

import type {
  ContentStatus,
  PlataformaSocial,
  PostMidia,
  SocialFlowPapel,
  SubtaskStatus,
} from "@/lib/supabase/database.types";

/**
 * O vocabulário dos posts, nos dois lados da fronteira.
 *
 * Módulo sem diretiva: o servidor usa para filtrar e contar, o navegador usa
 * para desenhar. É a mesma regra de `lib/dominio/portal.ts` — função pura que
 * os dois lados precisam não mora em `lib/dados/`, que é `server-only`.
 */

export const PLATAFORMAS: PlataformaSocial[] = [
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "twitter",
  "pinterest",
];

export const ROTULO_DA_PLATAFORMA: Record<PlataformaSocial, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
  pinterest: "Pinterest",
};

/**
 * A rede aparece como SIGLA, e não como logo.
 *
 * O lucide-react tirou os ícones de marca da biblioteca, e as três saídas
 * restantes eram piores:
 *
 *   - um ícone genérico por rede (câmera, vídeo, maleta) não distingue
 *     Instagram de Facebook, que é justamente o que o selo precisa dizer;
 *   - desenhar os logos à mão traz marca registrada para dentro do
 *     repositório, e com ela a cor literal de cada uma — num projeto em que
 *     `globals.css` é o único arquivo com cor literal;
 *   - escrever o nome inteiro não cabe numa célula de calendário com sete
 *     colunas.
 *
 * Duas letras cabem, se leem de relance e não afirmam nada sobre marca
 * nenhuma. O nome por extenso viaja no rótulo acessível e no `title`.
 */
export const SIGLA_DA_PLATAFORMA: Record<PlataformaSocial, string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "IN",
  tiktok: "TT",
  youtube: "YT",
  twitter: "X",
  pinterest: "PT",
};

/** Um post do jeito que o Portal lê. */
export type PostDoPortal = {
  id: string;
  clienteId: string;
  tema: string;
  legenda: string | null;
  /**
   * O DIA EM QUE A PEÇA VAI AO AR, **ou nulo**.
   *
   * O tipo dizia `string`, e a coluna aceita nulo desde a 0044 — o mês de
   * social abre em branco e quem produz distribui os dias depois. A mentira
   * era barata e custou caro: foi ela que deixou toda a tela do portal
   * assumir que um post sempre tem data, e é por isso que o filtro
   * `data_publicacao` dentro do mês passou meses escondendo do cliente a peça
   * enviada num portão do meio (o bug 1 da 0090) sem ninguém desconfiar.
   *
   * Com `| null` o TypeScript cobra o caso em cada tela, que é o que faz a
   * bandeja "Sem data definida" existir em vez de ser lembrada.
   */
  dataPublicacao: string | null;
  /**
   * A DEMANDA DO MÊS a que esta peça pertence (`posts.social_task_id`, 0088).
   *
   * É por ela que o mês recorta a lista desde o Sprint 3K, e não mais pela
   * data: a peça enviada num portão do meio não tem data nenhuma, e um
   * recorte por data a escondia da área de Social do cliente.
   *
   * Nula no post AVULSO — fora de um mês aberto, que é a forma anterior à
   * 0045. Esse continua entrando pela data, que é a única coisa que ele tem.
   */
  mesId: string | null;
  horario: string | null;
  /**
   * AS REDES em que esta peça sai (0082). Lista e não valor único: a mesma
   * arte costuma ir ao Instagram e ao Facebook, e são um post só — uma
   * decisão do cliente, uma corrente de cinco etapas, uma linha no board.
   */
  plataformas: PlataformaSocial[];
  formato: string | null;
  /**
   * O QUE A TELA DESENHA — imagem, carrossel ou vídeo (0042).
   *
   * Ele entrou no modelo do portal com a grade do feed: numa miniatura
   * quadrada, a capa de um carrossel é idêntica à de um post único, e o canto
   * de cima é a única coisa que distingue os dois. `formato` não serve para
   * isso — ele diz ONDE vai ao ar (Feed, Stories, Reels), e é texto livre
   * justamente porque esses nomes mudam de temporada.
   */
  midia: PostMidia;
  status: ContentStatus;
  arteUrl: string | null;
  thumbnailUrl: string | null;
  versaoAtual: number;
  prazoAprovacao: string | null;
  /** A rodada de cliente aberta agora. Null quando não há decisão pendente. */
  rodadaPendenteId: string | null;
  /** Quem decidiu a última rodada fechada, e quando. */
  decididoPor: string | null;
  decididoEm: string | null;
  /**
   * A etapa da corrente que está esperando o cliente, quando não é o Envio
   * (migration 0076). Nula no caminho de sempre.
   *
   * **Ela vem de `o_que_o_cliente_decide()` e não de um `select` nas etapas
   * do mês**, porque o cliente não tem policy em `subtasks` nem em
   * `post_etapa_progresso` — e não passa a ter: a corrente é conversa
   * interna, com quem está com o material na mão, qual fase travou e quem
   * atrasou. O que a função devolve é o agregado de que a tela precisa, e
   * nada mais.
   */
  portaoDoCliente: string | null;
  /** O texto daquele portão — a pauta, ou a legenda. */
  textoDoPortao: string | null;
};

/**
 * A frase que diz ao cliente o que ele está decidindo (0076).
 *
 * ---------------------------------------------------------------------------
 * **ELA NOMEIA A COISA, e a palavra que descreve o PASSO fica de fora.** O
 * cliente recebe material; "etapa" é palavra da agência, e a regra do produto
 * diz isso desde o Sprint 12 — nenhum jargão interno atravessa para o lado
 * dele. Aqui a coisa se chama Pauta ou Conteúdo, que são nomes do trabalho
 * dele e não do nosso fluxo.
 *
 * **E a varredura NÃO pegaria isto, que é o motivo de a decisão estar
 * escrita.** `check:cores` procura o vocabulário interno em
 * `src/app/(cliente)/` e `src/components/portal/`, e esta frase nasce em
 * `lib/dominio/` — o mesmo caso da ausência que chega com a chave do enum no
 * Calendário Full: o texto vem de fora do caminho varrido e a regra continua
 * valendo. Quem mexer nesta linha mexe sem rede.
 *
 * **Ela nomeia QUAL**, como a recusa da 0023 nomeia cada etapa sem aprovação:
 * "a Full pediu seu aval" manda a pessoa procurar o que mudou. E diz o que vem
 * depois, porque é isso que tira a impressão de que falta algo na tela: quem
 * abre um post sem arte nenhuma precisa saber que a arte ainda vai existir, e
 * que este aval é o que a destrava.
 * ---------------------------------------------------------------------------
 */
export function fraseDoPortao(nome: string): string {
  return `A Full está pedindo seu aval na ${nome} deste material. O resto segue depois que você aprovar.`;
}

/**
 * O filtro do Social no portal: uma rede e uma FASE.
 *
 * **Era `status`, e são sete; virou `fase`, e são quatro** — o porquê está em
 * `FASES_DO_MATERIAL`, em `lib/dominio/portal.ts`. A chave na URL mudou junto:
 * `?status=em_producao` deixa de filtrar, e isso é dito em vez de escondido —
 * um valor que não existe mais cai em "sem filtro", que é o comportamento de
 * toda listagem deste produto para valor torto.
 */
export type FiltrosDePost = {
  plataforma: PlataformaSocial | null;
  fase: FaseDoMaterial | null;
};

export function combinaComFiltroDePost(
  post: PostDoPortal,
  filtros: FiltrosDePost,
): boolean {
  // `includes` E NAO IGUALDADE: filtrar por Facebook tem que trazer a peça
  // que sai no Instagram E no Facebook — ela sai no Facebook.
  if (filtros.plataforma && !post.plataformas.includes(filtros.plataforma))
    return false;
  if (filtros.fase && faseDoMaterial(post.status) !== filtros.fase)
    return false;
  return true;
}

/**
 * Os posts de um mês, indexados pelo dia.
 *
 * A chave é a data em ISO, e não um `Date`: a grade é montada no servidor e
 * lida no navegador, e dois fusos com o mesmo `Date` respondem dias
 * diferentes. Em texto, "2026-10-15" é "2026-10-15" em qualquer lugar.
 */
export function porDia(posts: PostDoPortal[]): Map<string, PostDoPortal[]> {
  const mapa = new Map<string, PostDoPortal[]>();

  for (const post of posts) {
    // POST SEM DATA NAO ENTRA NO MAPA DE DIAS, e nao vira a chave `"null"`:
    // ele existe, o cliente precisa decidi-lo, e o lugar dele e a bandeja
    // "Sem data definida" -- que e `semData()` logo abaixo. Agrupa-lo num dia
    // inventado era a unica saida que o tipo antigo permitia, e e por isso que
    // ele dizia `string`.
    const dia = post.dataPublicacao;
    if (!dia) continue;

    const lista = mapa.get(dia);
    if (lista) lista.push(post);
    else mapa.set(dia, [post]);
  }

  // Dentro do dia, a ordem é a do horário — é a ordem em que eles vão ao ar.
  // Post sem horário fica por último: ele ainda não tem hora marcada, e pôr
  // um "sem horário" antes de um das 8h diria uma coisa que não é verdade.
  for (const lista of mapa.values()) {
    lista.sort((a, b) =>
      (a.horario ?? "99:99").localeCompare(b.horario ?? "99:99"),
    );
  }

  return mapa;
}

/**
 * AS PEÇAS SEM DIA MARCADO, do mês que está na tela.
 *
 * **Elas existem, e é esse o ponto do Sprint 3K.** Desde a 0044 o mês de
 * social abre em branco e quem produz distribui os dias depois; e desde a 0076
 * uma peça pode ir ao cliente num portão do MEIO — a pauta, a legenda —, onde
 * a data ainda não existe e exigi-la seria uma recusa que a corrente não tem
 * como satisfazer.
 *
 * Até aqui elas não apareciam em lugar nenhum da área de Social dele: a
 * consulta filtrava por `data_publicacao` dentro do mês, a RLS liberava e a
 * tela escondia. O cliente via um item em "esperando você" na tela inicial e
 * uma área de Social vazia — que é a tela em que ele vai olhar.
 *
 * A ORDEM É A DO TEMA, e não a de criação: sem data não há cronologia, e o
 * nome de fábrica delas ("Instagram 3 de 12 · Outubro/2026") já é sequencial.
 */
export function semData(posts: PostDoPortal[]): PostDoPortal[] {
  return posts
    .filter((p) => !p.dataPublicacao)
    .sort((a, b) => a.tema.localeCompare(b.tema, "pt-BR"));
}

/**
 * O post está esperando uma decisão DESTE cliente?
 *
 * Duas condições, e as duas importam: o status diz que ele está em aprovação,
 * e existe uma rodada aberta para decidir. Sem a segunda, o botão apareceria
 * num post cuja rodada alguém já fechou por outro caminho, e o clique cairia
 * na recusa "esta rodada já foi decidida".
 */
export function esperaDecisao(post: PostDoPortal): boolean {
  return post.status === "em_aprovacao" && post.rodadaPendenteId !== null;
}

/** O mês de uma data ISO, em `AAAA-MM`. */
export function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * O mês vizinho, contado em texto.
 *
 * Sem `Date` de propósito: `new Date("2026-01-31")` mais um mês em JavaScript
 * devolve 2 ou 3 de março conforme o ano, e o seletor precisa só do rótulo do
 * mês. Aritmética de 12 em 12 não tem esse problema.
 */
export function deslocarMes(mes: string, meses: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + meses;
  const anoNovo = Math.floor(total / 12);
  const mesNovo = (total % 12) + 1;
  return `${String(anoNovo).padStart(4, "0")}-${String(mesNovo).padStart(2, "0")}`;
}

/**
 * Os dias da grade do mês, de segunda a domingo.
 *
 * Segunda a domingo como no resto da casa (`lib/dominio/semanas.ts`): o locale
 * pt-BR começa no domingo, que é a convenção do calendário de parede, e aqui
 * a unidade é a semana de trabalho da agência.
 *
 * Devolve datas ISO, incluindo as do mês vizinho que completam a primeira e a
 * última semana — a grade precisa delas para não quebrar a coluna.
 */
export function gradeDoMes(mes: string): string[] {
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1));
  const ultimo = new Date(Date.UTC(ano, m, 0));

  // getUTCDay(): 0 = domingo. Com a semana comecando na segunda, o domingo
  // fica a 6 dias do inicio, e nao a zero.
  const recuo = (primeiro.getUTCDay() + 6) % 7;
  const avanco = (7 - ((ultimo.getUTCDay() + 6) % 7) - 1) % 7;

  const dias: string[] = [];
  const cursor = new Date(primeiro);
  cursor.setUTCDate(cursor.getUTCDate() - recuo);

  const fim = new Date(ultimo);
  fim.setUTCDate(fim.getUTCDate() + avanco);

  while (cursor <= fim) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dias;
}

/* ===========================================================================
 * A CORRENTE DE MÃO EM MÃO (migration 0042)
 *
 * A gestão abre o briefing, libera para quem produz, revisa e envia. Este
 * bloco é o que os dois lados leem para saber em que mão o post está e qual é
 * o próximo passo — como `lib/tasks/state-machine.ts` faz com a subtarefa.
 *
 * **O BANCO É QUEM RECUSA, e isto aqui é quem escreve a frase.** As duas
 * existem de propósito, e é a mesma dupla do resto do produto: `validar_nova_
 * rodada` diz não a quem chamar a API direto; estas funções fazem o botão
 * aparecer desligado com a razão escrita, em vez de sumir.
 * ======================================================================== */


export const MIDIAS: PostMidia[] = ["imagem", "carrossel", "video"];

export const ROTULO_DA_MIDIA: Record<PostMidia, string> = {
  imagem: "Imagem única",
  carrossel: "Carrossel",
  video: "Vídeo",
};

/**
 * O que cada mídia muda na tela.
 *
 * Fica ao lado da escolha, e não num texto de ajuda: a mídia decide qual
 * editor aparece, e quem escolhe errado só descobre depois de subir o arquivo.
 */
export const EXPLICACAO_DA_MIDIA: Record<PostMidia, string> = {
  imagem: "Uma arte só.",
  carrossel: "Várias artes em ordem — a primeira é a capa.",
  video: "Por link do Drive ou do YouTube; o cliente assiste fora do portal.",
};

/**
 * Os formatos sugeridos por rede.
 *
 * **É sugestão e não trava**, e a diferença importa: `formato` é texto
 * justamente porque nome comercial de plataforma muda a cada temporada (a
 * 0032 decidiu assim, e o Reels e o Shorts são dessa safra). Uma lista fechada
 * aqui obrigaria um deploy no dia em que a Meta inventar o próximo nome — o
 * campo aceita o que a pessoa digitar.
 */
export const FORMATOS_SUGERIDOS: Record<string, string[]> = {
  instagram: ["Feed", "Stories", "Reels", "Carrossel"],
  facebook: ["Feed", "Stories", "Reels"],
  linkedin: ["Feed", "Artigo", "Documento"],
  tiktok: ["Vídeo", "Stories"],
  youtube: ["Vídeo", "Shorts"],
  twitter: ["Post", "Thread"],
  pinterest: ["Pin", "Idea Pin"],
};

/** Em que mão o post está. */
export type MaoDoPost =
  | "briefing"
  | "producao"
  | "revisao"
  | "com_cliente"
  | "encerrado";

export const ROTULO_DA_MAO: Record<MaoDoPost, string> = {
  briefing: "Briefing",
  producao: "Produção",
  revisao: "Revisão",
  com_cliente: "Cliente",
  encerrado: "Encerrado",
};

export type EstadoDoPost = {
  responsavelId: string | null;
  enviadoEm: string | null;
  status: string;
  midia: PostMidia;
  videoUrl: string | null;
  arteUrl: string | null;
  /** Há rodada interna aprovada nesta versão? */
  avalInterno: boolean;
};

/**
 * Onde o post está na corrente.
 *
 * **Derivado, nunca gravado** — é a mesma razão pela qual bloqueio de
 * subtarefa não é status e atraso do Financeiro não é coluna: a mão depende do
 * responsável, do carimbo de envio e da rodada, e uma coluna precisaria ser
 * reescrita por três caminhos diferentes para continuar verdadeira.
 */
export function maoDoPost(post: EstadoDoPost): MaoDoPost {
  if (post.status === "aprovado" || post.status === "rejeitado") return "encerrado";
  if (post.enviadoEm) return "com_cliente";
  if (post.avalInterno) return "revisao";
  if (post.responsavelId) return "producao";
  return "briefing";
}

/**
 * O que falta para o post poder ir ao cliente.
 *
 * Devolve a lista vazia quando dá. **A tela mostra a frase no lugar de esconder
 * o botão:** um botão que some ensina que não existe; um botão desligado que
 * diz por quê ensina a regra — e a regra aqui é de banco, não de tela.
 */
export function faltaParaEnviar(
  post: EstadoDoPost,
  /**
   * O portão que está saindo. Sem ele a resposta é a de sempre — a entrega —,
   * que é o comportamento de um post avulso: sem mês não há corrente, e ele
   * volta a ser um post anterior à 0045 (um envio, uma decisão).
   */
  portao?: EtapaDoMes | null,
): string[] {
  const faltam: string[] = [];
  // PELO PAPEL, E NUNCA PELO NOME (0087). Com `nome === "Envio"` um fluxo que
  // chame a entrega de outra coisa cairia sempre no ramo do meio, e as duas
  // travas da arte deixariam de valer — o cliente receberia a peça sem data
  // de publicação e o vídeo sem link, pelo único caminho que existe para que
  // isso não aconteça.
  const doMeio = Boolean(portao && portao.papel !== "entrega");

  // NUM PORTÃO DO MEIO A ARTE NÃO É O QUE SAI, e é por isso que a pergunta
  // mudou de forma na 0076: quem vai ao cliente é a pauta ou a legenda, e a
  // arte nem existe ainda. Exigi-la ali travaria o portão para sempre — a
  // Pauta é a PRIMEIRA etapa da corrente.
  //
  // `validar_nova_rodada` faz a mesma distinção no banco, e as duas saíram no
  // mesmo commit: a lição da 0029 é que desfazer um lado só não desfaz nada.
  if (!doMeio) {
    if (post.midia === "video") {
      if (!post.videoUrl?.trim()) faltam.push("o link do vídeo");
    } else if (!post.arteUrl) {
      faltam.push("a arte");
    }
  }

  if (!post.avalInterno) faltam.push("o aval interno");
  if (post.enviadoEm && !doMeio) faltam.push("nada — ele já está com o cliente");

  return faltam;
}

/**
 * O rótulo do botão que manda o portão ao cliente.
 *
 * **Ele diz O QUE está saindo**, e não só "Enviar ao cliente": numa conta que
 * aprova a pauta, a gestão clica nesse botão duas vezes na vida de um post, e
 * as duas mandam coisas diferentes. Um rótulo igual nas duas é a tela pedindo
 * uma decisão sem dizer sobre o quê.
 */
export function rotuloDoEnvio(portao: EtapaDoMes | null): string {
  if (!portao || portao.papel === "entrega") return "Enviar ao cliente";
  return `Enviar a ${portao.titulo} ao cliente`;
}

/**
 * Quem está lendo pode enviar este post ao cliente?
 *
 * **É UMA PERGUNTA SÓ desde a 0060: ser gestão.** Eram duas — gestão E não
 * ter produzido —, e a segunda saiu por decisão do usuário, que está citada
 * no cabeçalho daquela migration. Aqui ela não se repete porque
 * `check:cores` varre `src/` atrás da frase que saiu: a explicação de um
 * nome morto não pode carregar o nome, e foi a varredura que pegou esta
 * mesma linha na primeira rodada.
 *
 * A regra pedida continua inteira, e sempre esteve: a pergunta que ficou já
 * recusa todo colaborador, dono do material ou não. A que saiu só alcançava
 * desenvolvedor e sócio, que são exatamente quem ele acabou de liberar.
 *
 * `validar_nova_rodada` recusa no banco; aqui a resposta serve para desligar
 * o botão com a frase certa — e as duas saíram no mesmo commit, que é a lição
 * cara da 0029: a bateria ficou verde com a action ainda recusando, e quem
 * encontrou foi o usuário clicando no botão.
 */
export function podeEnviarAoCliente(
  post: EstadoDoPost,
  quemLe: { id: string; ehGestor: boolean },
  /** O portão que está saindo — ver `faltaParaEnviar`. */
  portao?: EtapaDoMes | null,
): { pode: boolean; porque: string | null } {
  if (!quemLe.ehGestor) {
    return { pode: false, porque: "Enviar ao cliente é do desenvolvedor ou do sócio." };
  }
  const faltam = faltaParaEnviar(post, portao);
  if (faltam.length > 0) return { pode: false, porque: `Falta ${faltam.join(" e ")}.` };
  return { pode: true, porque: null };
}

/** Quem edita a arte e a legenda: a gestão, ou quem recebeu o post. */
export function podeProduzir(
  post: EstadoDoPost,
  quemLe: { id: string; ehGestor: boolean },
  /** A corrente, quando a tela a tem. Ver abaixo por que ela entra aqui. */
  etapas: { responsavelId: string | null }[] = [],
): boolean {
  // QUEM TEM ETAPA NA CORRENTE ESCREVE NO CARD (0047), e é a mesma pergunta
  // que `tenho_etapa_no_post()` faz no Postgres — a que vale.
  //
  // Sem este ramo, a redatora dona da etapa Conteúdo abriria o post com todos
  // os campos DESLIGADOS, embora o banco aceite a escrita dela. É o espelho do
  // erro que a 0047 conserta: lá a regra estava escrita em português e não em
  // SQL; aqui estaria em SQL e não na tela.
  return (
    quemLe.ehGestor ||
    post.responsavelId === quemLe.id ||
    etapas.some((e) => e.responsavelId === quemLe.id)
  );
}

/* ==========================================================================
 * A CORRENTE É DO MÊS, E A CAIXINHA É DO POST (migration 0088)
 *
 * Decisão do usuário: *"a produção vira mensal, a aprovação continua por
 * post"*. A etapa do mês é uma SUBTAREFA — com dono, prazo, estimativa e
 * relógio —, e o que cada post tem dentro dela é uma caixinha: o "12 de 18"
 * do cabeçalho.
 *
 * O que mora aqui são as perguntas que a tela faz e o banco também faz — como
 * `situacaoDoLancamento()` no Financeiro. A tela precisa saber de quem é a vez
 * para desenhar, e não dá para perguntar ao banco a cada linha de uma lista de
 * doze posts.
 * ========================================================================== */

/** A etapa do mês como a tela a recebe, com o nome de quem está com ela. */
export type EtapaDoMes = {
  id: string;
  ordem: number;
  titulo: string;
  responsavelId: string | null;
  responsavel: string | null;
  status: SubtaskStatus;
  dataInicio: string | null;
  prazo: string | null;
  estimativaMinutos: number | null;
  /**
   * O PAPEL desta etapa na corrente, copiado do elo do fluxo no instante em
   * que o mês abriu (0087/0088).
   *
   * Ele é a coluna que tirou a palavra 'Envio' das comparações do produto: com
   * a cadeia editável, `titulo === "Envio"` deixaria um fluxo que chame a
   * entrega de "Entrega ao cliente" SEM PORTÃO NENHUM, sem erro em lugar
   * nenhum.
   */
  papel: SocialFlowPapel;
  /** Qual campo do card esta etapa enche: `pauta`, `legenda` ou nenhum. */
  campo: string | null;
  /** Esta etapa passa pelo cliente, post por post (0076). */
  portao: boolean;
  /**
   * O recado da geração — função sem dono na conta, responsável desligado
   * (0040/0064). A frase NOMEIA a função que faltou: "há etapa sem
   * responsável" manda abrir uma por uma.
   */
  avisoGeracao: string | null;
  /** O "12 de 18" do cabeçalho. */
  feitos: number;
  total: number;
};

/** A caixinha de um post numa etapa do mês. */
export type CaixinhaDoPost = {
  postId: string;
  etapaId: string;
  concluido: boolean;
  /** O pedido do cliente sobre este post, nesta etapa. */
  observacao: string | null;
};

/**
 * Os portões do mês, em ordem.
 *
 * A entrega entra sem a marca: ela É o portão do cliente desde a 0032, e
 * marcá-la seria dizer duas vezes a mesma coisa — o `check`
 * `subtasks_social_coerente` recusa a marca fora de um elo de produção.
 */
export function portoesDoMes(etapas: EtapaDoMes[]): EtapaDoMes[] {
  return [...etapas]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((e) => e.portao || e.papel === "entrega");
}

/**
 * O portão que a PRÓXIMA decisão do cliente deste post fecha.
 *
 * **Derivado, nunca gravado** — é `porta_do_cliente_no_post()` do Postgres
 * escrita deste lado, como `situacaoDoLancamento()` no Financeiro. A conta é
 * a (k+1)-ésima posição da lista de portões, onde k são as rodadas de cliente
 * já APROVADAS daquele post: pendente, recusada e rejeitada não contam, que é
 * a regra da 0023 — pedir aprovação não é ter aprovação.
 *
 * Devolve nulo num post sem mês, e os chamadores caem no ramo da entrega: sem
 * corrente ele volta a se comportar como um post anterior à 0045.
 */
export function portaoDoPost(
  etapas: EtapaDoMes[],
  aprovacoesDoCliente: number,
): EtapaDoMes | null {
  return portoesDoMes(etapas)[aprovacoesDoCliente] ?? null;
}

/**
 * De quem o post volta quando o cliente recusa um portão.
 *
 * A regra da 0045 sobrevive inteira, e é a única parte da etapa de Ajustes que
 * ficou: **quem refaz a arte é quem a fez, e não quem a enviou.** Num portão
 * do MEIO quem refaz é o dono do próprio portão — quem escreveu a pauta
 * reescreve a pauta; ler "o último elo de produção" nos dois casos poria o
 * designer para reescrever texto.
 *
 * E a pergunta é POSICIONAL e nunca pelo nome (0087): num fluxo que chame
 * aquela etapa de "Produção de Layout", `titulo === "Layout"` devolveria
 * ninguém — e a caixinha de ninguém desmarcaria.
 */
export function etapaQueRefazOPost(
  etapas: EtapaDoMes[],
  portao: EtapaDoMes | null,
): EtapaDoMes | null {
  if (!portao) return null;
  if (portao.papel !== "entrega") return portao;
  return (
    [...etapas]
      .filter((e) => e.papel === "producao" && e.ordem < portao.ordem)
      .sort((a, b) => b.ordem - a.ordem)[0] ?? portao
  );
}

/**
 * A ETAPA DA VEZ DESTE POST: a primeira cuja caixinha ainda não fechou.
 *
 * **É por post e não por mês, e a distinção é o sprint inteiro.** A etapa do
 * mês anda quando as dezoito peças andam; uma peça individual pode estar duas
 * fases atrás das irmãs — e é dela que a lista e o card do calendário falam,
 * porque a pergunta ali é *"em que pé está esta arte?"*.
 *
 * Nulo quando todas fecharam, e os chamadores não desenham nada: um "pronto"
 * em cada linha de um mês terminado é a mesma palavra trinta vezes.
 */
export function etapaDaVezDoPost(
  etapas: EtapaDoMes[],
  caixinhas: CaixinhaDoPost[],
  postId: string,
): EtapaDoMes | null {
  const feito = new Map(
    caixinhas
      .filter((c) => c.postId === postId)
      .map((c) => [c.etapaId, c.concluido]),
  );
  return (
    [...etapas].sort((a, b) => a.ordem - b.ordem).find((e) => !feito.get(e.id)) ??
    null
  );
}

/** Quantas fases fecharam, de quantas. O "3 de 5" do cabeçalho do mês. */
export function andamentoDoMes(etapas: EtapaDoMes[]): {
  concluidas: number;
  total: number;
} {
  return {
    concluidas: etapas.filter((e) => e.status === "concluida").length,
    total: etapas.length,
  };
}

/**
 * A CAIXINHA DA ENTREGA NÃO SE MARCA À MÃO, nem pela gestão.
 *
 * É a regra da 0045 um nível abaixo, letra por letra: a etapa Envio era
 * consequência da rodada de escopo cliente, e a caixinha dela é consequência
 * da APROVAÇÃO daquele post. Marcar à mão afirmaria que a peça foi e voltou
 * aprovada sem nada ter saído da agência — e desmarcar afirmaria o contrário
 * de uma aprovação que está gravada na rodada.
 *
 * A tela mostra o selo em vez da caixa, e a razão escrita: uma caixa
 * desligada não diz nada.
 */
export function caixinhaSeMarcaAMao(etapa: EtapaDoMes): boolean {
  return etapa.papel !== "entrega";
}

/**
 * Posso marcar ESTE post nesta etapa?
 *
 * São as duas travas de `post_etapa_progresso_regras`, e as duas existem de
 * propósito nos dois lados: esta escreve a frase que a pessoa lê antes de
 * clicar, aquela é a que vale. Duas telas perguntando por conta própria
 * acabariam oferecendo a caixa onde o banco recusa.
 *
 * **A ORDEM É A DO BANCO: o portão primeiro.** Na última etapa as duas valem —
 * a caixinha da entrega só fecha pela aprovação, então ela está desmarcada e a
 * corrente também reclamaria. Com a corrente primeiro a pessoa lia *"falta
 * Envio"*, que é verdade e não diz o que fazer.
 */
export function bloqueioDaCaixinha(
  etapa: EtapaDoMes,
  etapas: EtapaDoMes[],
  caixinhas: CaixinhaDoPost[],
  postId: string,
  aprovacoesDoCliente: number,
): string | null {
  const feito = new Map(
    caixinhas.filter((c) => c.postId === postId).map((c) => [c.etapaId, c.concluido]),
  );

  const portoesAntes = portoesDoMes(etapas).filter((p) => p.ordem < etapa.ordem);
  if (aprovacoesDoCliente < portoesAntes.length) {
    // A FRASE NOMEIA SÓ O QUE FALTA, e é o `offset` da trava B do banco.
    //
    // As aprovações desta peça fecham os portões NA ORDEM — é a conta de
    // `portaoDoPost()` —, então os aprovados são os `k` primeiros e o `slice`
    // tira exatamente eles. Sem ele, num fluxo que valida a pauta a linha dizia
    // *"o cliente ainda não aprovou Pauta, Envio"* numa peça cuja Pauta está
    // aprovada: uma frase que a pessoa confere, vê que está errada, e passa a
    // desconfiar do resto. Foi a imagem do protótipo que mostrou.
    const nomes = portoesAntes
      .slice(aprovacoesDoCliente)
      .map((p) => p.titulo)
      .join(", ");
    return `O cliente ainda não aprovou ${nomes} neste post.`;
  }

  const antes = [...etapas]
    .filter((e) => e.ordem < etapa.ordem && !feito.get(e.id))
    .sort((a, b) => a.ordem - b.ordem)
    .map((e) => e.titulo);

  if (antes.length === 0) return null;
  return `Neste post falta ${antes.join(", ")} antes desta etapa.`;
}

/**
 * ---------------------------------------------------------------------------
 * A CORRENTE SAIU DAQUI, e virou dado (migration 0087)
 *
 * Quatro coisas moravam neste arquivo e não moram mais:
 *
 * - `ETAPAS_DA_CORRENTE` — as cinco etapas, com as duas pontas sugeridas de
 *   cada uma (0083/0084). Hoje são `social_flow_steps`, e as pontas viajam com
 *   o fluxo: aquela lista não sabia sugerir nada para uma etapa que alguém
 *   acrescentou.
 * - `ETAPAS_QUE_O_CLIENTE_PODE_APROVAR` — quais elos podiam virar portão
 *   (0076). A resposta virou a coluna `papel`, que o `check` de
 *   `social_flow_steps` cobra.
 * - `FUNCOES_DA_CORRENTE` e `ETAPAS_DA_FUNCAO` — as três funções e o que cada
 *   uma leva. Hoje é `funcoesDoFluxo()`, derivada da corrente escolhida: com a
 *   lista fixa, o diálogo pediria um Redator a uma conta cujo fluxo não tem
 *   etapa de texto.
 * - `diaSugeridoDaEtapa` — a conta de data, que mudou de casa junto com as
 *   pontas.
 *
 * As quatro foram APAGADAS e não aposentadas ao lado das novas, que é a
 * decisão da 0023: uma lista que nenhuma tela lê é o que alguém reaproveita
 * errado três sprints depois, achando que ela ainda diz a verdade sobre a
 * corrente. O que ficou aqui é o que não é dado do fluxo — `ETAPA_DE_ENVIO`,
 * `maoDoPost()`, `podeEnviarAoCliente()`.
 *
 * O lado de cá do fluxo é `lib/dominio/social-flows.ts`.
 * ---------------------------------------------------------------------------
 */

/**
 * "terça, 5 de outubro" — o dia de uma etapa, escrito ao lado do campo.
 *
 * **O DIA DA SEMANA É O PONTO, e não enfeite.** Quem monta o mês está marcando
 * um dia de trabalho de uma pessoa, e marcar a pauta do mês num sábado é o erro
 * que o número cru esconde: `2027-10-09` não diz nada, "sábado, 9 de outubro"
 * diz tudo. É a mesma razão pela qual `rotuloDoOffset` existia na 0059 — `-3`
 * não é português —, aplicada ao que o campo passou a aceitar.
 *
 * Em UTC pela razão de `diaSugeridoDaEtapa`: `new Date("2027-10-05")` lido no
 * fuso local vira 4 de outubro às 21h em São Paulo, e o rótulo diria "segunda".
 */
export function rotuloDoDiaDaEtapa(dia: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return "sem dia marcado";
  const d = new Date(`${dia}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "sem dia marcado";
  const semana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${semana[d.getUTCDay()]}, ${d.getUTCDate()} de ${meses[d.getUTCMonth()]}`;
}

/**
 * O nome da pasta do mês no Drive — "Social · Junho de 2027".
 *
 * **Ele NÃO é o título da demanda, e a diferença é onde cada um aparece.** No
 * board da agência convivem os meses de dez clientes, então a demanda precisa
 * dizer de quem é — `Social · Junho/2027 de Mundo Verde`, montado pela
 * `abrir_mes_de_social()`. A pasta nasce DENTRO da pasta do cliente, onde o
 * nome da empresa já é o nível de cima: repeti-lo daria
 * "Mundo Verde › Social · Junho/2027 de Mundo Verde".
 *
 * E sem a barra, que `nomeDePasta()` trocaria por hífen: `/` é legal num nome
 * de pasta do Drive e faz "Junho/2027" se ler como dois níveis que não
 * existem — a mesma razão pela qual "Feed/story site" da Wave vira
 * "Feed-story site".
 */
export function nomeDaPastaDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const nome = nomes[m - 1];
  if (!nome || !Number.isFinite(ano)) return "Social";
  return `Social · ${nome} de ${ano}`;
}

/**
 * O rótulo de "quando" — e o que pôr quando ninguém definiu ainda.
 *
 * "Sem data" e não "—", e não a data de criação: o traço é o que a tela mostra
 * quando não sabe, e aqui ela sabe. O post está esperando alguém escolher o
 * dia, e a frase é a instrução.
 *
 * A formatação não vem daqui: quem chama passa a data já formatada, porque o
 * formato muda por tela (dia e mês no cabeçalho, dd/MM na lista) e este módulo
 * é o que os dois lados da fronteira carregam.
 */
export const SEM_DATA = "Sem data";

export function rotuloDaData(formatada: string | null): string {
  return formatada ?? SEM_DATA;
}

/**
 * ---------------------------------------------------------------------------
 * O AGRUPAMENTO EM TRÊS NÍVEIS SAIU, e a razão é que o que ele agrupava
 * deixou de existir (migration 0088)
 *
 * `agruparSocialPorConta()` e os três tipos dela moravam aqui, e atendiam um
 * relato do usuário: *"Quando abro um mês de social, ele ainda não está
 * ficando separado pelo Social de mês específico, de uma conta específica"*.
 * Com uma corrente por POST, um mês de dezoito posts dava dezoito etapas
 * "Layout" seguidas no Minhas Tasks de quem desenha — todas com o mesmo nome,
 * com a conta repetida dezoito vezes na linhagem.
 *
 * **O MODELO RESOLVEU ISSO, e não o agrupamento.** A etapa passou a ser do
 * MÊS: há UMA "Layout" por mês por conta, e ela é uma subtarefa comum — então
 * ela entra na LISTA PRINCIPAL de Minhas Tasks, com a linhagem que toda etapa
 * tem (`Mundo Verde · Social · Junho/2027 › Layout`). É a Parte 4 do sprint em
 * uma frase: *"com a estrutura certa, isso sai de graça"*.
 *
 * O bloco "Social" separado saiu junto, pela mesma razão: ele existia porque
 * uma etapa de post não era `SubtarefaDetalhada` — não tinha rodada,
 * cronômetro nem dependência, e fabricar os campos faria a tela oferecer
 * "Pedir aval interno" onde o banco responde outra coisa. A etapa do mês
 * TEM os três, então ela cabe no molde — e o molde certo é o que não mente.
 *
 * **O que fica é o ÍCONE e o CHIP da área**, em `minhas-tasks/linhas.ts`:
 * `areaDaLinha()` passou a responder "social" pela coluna `social_papel`, e a
 * faixa das três áreas continua nomeando Social Media com a contagem do que é
 * meu lá. Era isso que a pessoa procurava quando abria a tela pelo nome da
 * área, e é a decisão que trouxe os dois módulos para dentro desta tela.
 * ---------------------------------------------------------------------------
 */

/**
 * ---------------------------------------------------------------------------
 * A NAVEGAÇÃO CONTA → ANO → MÊS
 *
 * **O MÓDULO TINHA UMA PORTA SÓ, e ela era um recorte de UM mês.** `?mes=` e
 * `?cliente=` existem desde o Sprint 14, e nada na tela dizia quais meses
 * existem: quem queria o social de outubro da Mundo Verde trocava os dois à
 * mão. Com dez contas e doze meses são cento e vinte combinações alcançáveis
 * só digitando a URL.
 *
 * **A ORDEM DOS TRÊS NÍVEIS É A DA PERGUNTA**, e não a do banco. Quem abre
 * esta tela está pensando numa CONTA — "o que a gente tem da Mundo Verde?" —, e
 * só então em quando. Pelo ano primeiro, a tela abriria com dez contas
 * misturadas dentro de 2026, que é o board da agência de novo e não a
 * navegação que faltava.
 *
 * **O ANO É NÍVEL E NÃO UM FILTRO**, pela razão do agrupamento por conta na
 * lista: com dois anos de social de dez contas, uma lista corrida de meses
 * ordenada por data põe outubro de 2026 da Óptica entre novembro e setembro da
 * Mundo Verde. E ele dobra junto com a conta, porque a pergunta quase sempre é
 * sobre o ano corrente — os anteriores ficam recolhidos dizendo quantos meses
 * têm dentro, que é a regra do `GrupoDobravel`.
 * ---------------------------------------------------------------------------
 */

/** Um mês na navegação. Só o que o índice desenha; a leitura traz o resto. */
export type MesNaArvore = {
  taskId: string;
  mes: string;
  pecas: number;
  aprovadas: number;
  esperandoCliente: number;
  arquivadaEm: string | null;
  concluido: boolean;
  /** A fase da vez e quem a tem. `null` num mês concluído ou sem corrente. */
  fase: { titulo: string; responsavel: string | null } | null;
};

export type AnoDeSocial = { ano: string; meses: MesNaArvore[] };
export type ContaDeSocial = {
  clienteId: string;
  cliente: string;
  anos: AnoDeSocial[];
  /** Quantos meses a conta tem no recorte, somando os anos. */
  meses: number;
  /** Quantas peças desta conta estão esperando o cliente agora. */
  esperandoCliente: number;
};

/**
 * Agrupa os meses em Conta → Ano → Mês.
 *
 * **A ORDEM DAS CONTAS É QUEM ESPERA PRIMEIRO**, e depois o alfabeto: é a
 * decisão da lista do Social Media, que põe as contas com coisa minha no topo
 * — aqui o que cobra uma ação é peça esperando o cliente, porque o prazo dele
 * está correndo. Quem não tem nada esperando vem em ordem de nome, que é como
 * se procura uma conta pelo nome.
 *
 * **E DENTRO DO ANO A ORDEM É DO MÊS MAIS NOVO PARA O MAIS VELHO**, como toda
 * listagem do produto: o mês que está sendo produzido é o que vem depois do
 * corrente, e ele fica no topo em vez de no fim de doze linhas.
 */
export function porContaEAno(
  meses: {
    taskId: string;
    clienteId: string;
    cliente: string;
    mes: string;
    pecas: number;
    aprovadas: number;
    esperandoCliente: number;
    arquivadaEm: string | null;
    status: string;
    fase: { titulo: string; responsavel: string | null } | null;
  }[],
): ContaDeSocial[] {
  const contas = new Map<string, ContaDeSocial>();

  for (const m of meses) {
    const conta =
      contas.get(m.clienteId) ??
      ({
        clienteId: m.clienteId,
        cliente: m.cliente,
        anos: [],
        meses: 0,
        esperandoCliente: 0,
      } satisfies ContaDeSocial);
    contas.set(m.clienteId, conta);

    const ano = m.mes.slice(0, 4);
    let bloco = conta.anos.find((a) => a.ano === ano);
    if (!bloco) {
      bloco = { ano, meses: [] };
      conta.anos.push(bloco);
    }

    bloco.meses.push({
      taskId: m.taskId,
      mes: m.mes,
      pecas: m.pecas,
      aprovadas: m.aprovadas,
      esperandoCliente: m.esperandoCliente,
      arquivadaEm: m.arquivadaEm,
      concluido: m.status === "concluido",
      fase: m.fase,
    });
    conta.meses += 1;
    conta.esperandoCliente += m.esperandoCliente;
  }

  const lista = [...contas.values()];
  for (const conta of lista) {
    conta.anos.sort((a, b) => b.ano.localeCompare(a.ano));
    for (const ano of conta.anos) {
      ano.meses.sort((a, b) => b.mes.localeCompare(a.mes));
    }
  }

  return lista.sort(
    (a, b) =>
      (b.esperandoCliente > 0 ? 1 : 0) - (a.esperandoCliente > 0 ? 1 : 0) ||
      a.cliente.localeCompare(b.cliente, "pt-BR"),
  );
}
