import type { HrStatus, HrTipo, PresencaStatus } from "@/lib/supabase/database.types";

/**
 * O vocabulário do Full Days, e as contas que os dois lados fazem.
 *
 * Em `lib/dominio/` porque servidor e navegador precisam das mesmas respostas:
 * o calendário de seleção conta dias úteis enquanto a pessoa arrasta o mouse,
 * e a Server Action conta de novo antes de gravar. Se as duas contas saíssem
 * de lugares diferentes, a tela mostraria 5 e o banco gravaria 4.
 */

/**
 * O contrato padrão da casa: 15 dias por ano, em até duas parcelas.
 *
 * É só o PADRÃO — o número que vale é o de `team_members`, coluna por pessoa,
 * porque contrato muda por pessoa e mudar contrato não pode exigir deploy.
 * A constante existe para a tela e a camada de dados caírem no mesmo valor
 * quando a ficha ainda não tem um: dois "senão" com números diferentes foi
 * como a regra dos 15 dias quase não valeu.
 */
export const DIAS_DE_DESCANSO_PADRAO = 15;
export const PARCELAS_DE_DESCANSO_PADRAO = 2;

/**
 * Até onde o calendário vai, nas duas pontas.
 *
 * **BORDAS DE CALENDÁRIO, e não "tantos meses a partir de hoje".** Janeiro de
 * 2025 é o começo do histórico que a agência quer poder registrar para trás;
 * dezembro de 2030 é longe o bastante para ninguém esbarrar na ponta
 * combinando um período. Com um intervalo relativo a borda ANDAVA: em
 * setembro de 2026 a pessoa alcançava junho daquele ano, em outubro não
 * alcançava mais — o mesmo dia deixava de existir na tela de um mês para o
 * outro, sem nada avisando.
 *
 * **ELAS MORAM AQUI, e não no componente, porque QUEM PERGUNTA SÃO DOIS.** O
 * calendário monta os meses com elas; a página busca feriados e dias de
 * colega com elas. Se os dois números divergirem, a pessoa rola até 2025 e vê
 * um ano inteiro sem feriado e sem ninguém fora — e essa tela não parece
 * quebrada, parece um ano vazio.
 *
 * E não podiam morar no componente por uma razão de mecânica, não de gosto:
 * `calendario-rolavel.tsx` é `"use client"`, e valor exportado de arquivo
 * cliente não vale no servidor — a página o receberia como referência e a
 * conta estouraria pedindo a rota, não no build.
 */
export const PRIMEIRO_MES_DO_CALENDARIO = "2025-01";
export const ULTIMO_MES_DO_CALENDARIO = "2030-12";

/**
 * O VOCABULÁRIO, e por que ele é este.
 *
 * A equipe da Full Connect Key é toda PJ, e o produto não usa vocabulário de
 * direito trabalhista: num pedido de reconhecimento de vínculo, o sistema da
 * própria contratante falando a língua da CLT é o que se junta aos autos. A
 * regra inteira, com as palavras que saíram e por quê, está no CLAUDE.md e no
 * cabeçalho da migration 0016 — fora de `src/`, porque `npm run check:cores`
 * varre `src/` atrás delas e acusaria o texto que as proíbe.
 *
 * O produto fala de DISPONIBILIDADE, não de direito:
 *
 *   descanso         — o período longo previsto em contrato
 *   afastamento      — o período sem previsão de volta
 *   ausência pontual — um dia ou dois
 *
 * Estas palavras são a SEGUNDA rodada de vocabulário. A primeira, e por que
 * ela foi substituída, está no cabeçalho da migration 0018 — fora de `src/`,
 * pela mesma razão de sempre: `npm run check:cores` varre `src/` atrás das
 * palavras que saíram, e acusaria o texto que as proíbe.
 *
 * `feriado` fica, e a diferença importa: feriado é data do calendário
 * nacional, um fato sobre o dia. Não é direito concedido a ninguém.
 *
 * As chaves do enum no banco continuam como estão, por decisão do usuário:
 * renomear valor de enum em uso é migration arriscada, e ninguém que usa o
 * sistema vê esses nomes. É este mapa que a pessoa lê — e é por ele passar
 * TODO rótulo da tela que a troca cabe num lugar só.
 */
export const ROTULOS_DE_TIPO: Record<HrTipo, string> = {
  ferias: "Descanso",
  licenca: "Afastamento",
  ausencia: "Ausência pontual",
};

/**
 * O que aconteceu com o pedido.
 *
 * "Aprovada" e "reprovada" saíram pela mesma razão das outras palavras:
 * hierarquia de aprovação é um dos indícios de subordinação, e subordinação é
 * o coração do reconhecimento de vínculo. O que acontece aqui é um combinado
 * entre duas partes — quem presta serviço informa o período, a agência
 * confirma que consegue cobrir ou pede para remarcar.
 *
 * As chaves continuam `aprovada` / `reprovada` no banco, como o resto.
 */
export const ROTULOS_DE_STATUS: Record<HrStatus, string> = {
  pendente: "Aguardando retorno",
  aprovada: "De acordo",
  reprovada: "Remarcar",
  cancelada: "Cancelada",
};

export const ROTULOS_DE_PRESENCA: Record<PresencaStatus, string> = {
  presente: "Disponível",
  remoto: "Remoto",
  ferias: "Descanso",
  licenca: "Afastado",
  ausente: "Ausente",
  // "Folga" pressupõe jornada, e jornada pressupõe vínculo. O que este estado
  // diz de verdade é que ninguém contou com a pessoa naquele dia.
  folga: "Sem alocação",
  feriado: "Feriado",
};

/**
 * A cor de cada status na matriz.
 *
 * Cada uma é um token, nunca um hex — e `feriado` é listrado em vez de uma cor
 * sólida: são sete estados, e a sétima cor sólida já começaria a se confundir
 * com as outras seis. Padrão distingue melhor que matiz quando os quadrados
 * são pequenos.
 */
export const CORES_DE_PRESENCA: Record<PresencaStatus, string> = {
  presente: "bg-success",
  remoto: "bg-accent-strong",
  ferias: "bg-ferias",
  licenca: "bg-warning",
  ausente: "bg-danger",
  folga: "bg-neutral",
  feriado: "listrado",
};

/**
 * Os estados que significam FORA — a pessoa não está disponível naquele dia.
 *
 * **Remoto não entra, e é a distinção inteira.** Quem trabalha de outro lugar
 * está trabalhando: contá-lo como ausência acenderia alerta onde não há risco
 * nenhum, e quem vê um alerta falso duas vezes para de olhar para o alerta.
 *
 * **"Sem alocação" também não entra**, por um motivo mecânico além do
 * conceitual: é o estado padrão de sábado e domingo. Com ele na lista, todo
 * fim de semana apareceria como a área inteira fora.
 *
 * Feriado não entra pela mesma razão: ninguém está fora, o dia é que não
 * existe para o trabalho.
 */
export const PRESENCAS_DE_AUSENCIA: PresencaStatus[] = [
  "ferias",
  "licenca",
  "ausente",
];

export function estaFora(status: PresencaStatus): boolean {
  return PRESENCAS_DE_AUSENCIA.includes(status);
}

/**
 * Quantas pessoas de uma área estão fora em cada dia.
 *
 * É a régua que a matriz desenha embaixo do nome de cada área, e ela responde
 * à pergunta que a grade existe para responder: não "quem está fora", e sim
 * "a área aguenta?". Com quinze nomes na tela, dois da mesma área na mesma
 * semana só aparecem para quem for contar linha por linha.
 *
 * **O LIMIAR É O MESMO DO CALENDÁRIO DE PEDIDO, de propósito.** Lá, um dia em
 * que QUALQUER colega da área está fora já é recusado
 * (`bloqueiosNoIntervalo`). Aqui esse mesmo dia é o âmbar: "o calendário
 * recusaria um pedido neste dia". O vermelho é o que já passou disso — dois ou
 * mais fora ao mesmo tempo, que é o estado que a regra existe para evitar e
 * que só chega até aqui por lançamento retroativo ou por decisão do sócio.
 *
 * Duas telas com dois limiares diferentes seriam duas verdades sobre a mesma
 * equipe, e a pessoa descobriria isso levando um "não" num dia que a matriz
 * pintou de verde.
 */
export function coberturaDaArea(
  dias: string[],
  statusPorDia: (dia: string) => PresencaStatus[],
): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const dia of dias) {
    contagem.set(dia, statusPorDia(dia).filter(estaFora).length);
  }
  return contagem;
}

export const PRESENCAS_EDITAVEIS: PresencaStatus[] = [
  "presente",
  "remoto",
  "folga",
  "ausente",
];

/** O tipo de pedido vira o status do dia na matriz. */
export function presencaDoTipo(tipo: HrTipo): PresencaStatus {
  if (tipo === "ferias") return "ferias";
  if (tipo === "licenca") return "licenca";
  return "ausente";
}

/**
 * Dias úteis entre duas datas ISO, inclusive as pontas.
 *
 * Espelha `public.dias_uteis()` do Postgres. As duas existem de propósito: esta
 * escreve o número que a pessoa vê enquanto seleciona, aquela é a que o banco
 * grava. Os feriados chegam como lista porque a função é pura — quem busca é a
 * camada de dados.
 */
export function contarDiasUteis(
  inicioISO: string,
  fimISO: string,
  feriados: Set<string>,
): number {
  const inicio = lerData(inicioISO);
  const fim = lerData(fimISO);
  if (!inicio || !fim || fim < inicio) return 0;

  let total = 0;
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    if (ehDiaUtil(cursor, feriados)) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

/**
 * Quantos dias o pedido consome, por tipo.
 *
 * **O DESCANSO CONTA CORRIDO**: quinze dias são quinze dias de calendário —
 * sai numa segunda, volta na terceira segunda —, e não quinze dias úteis, que
 * na prática seriam três semanas inteiras.
 *
 * Os outros dois continuam em dias úteis, e não é inconsistência: eles não
 * descontam de saldo nenhum. O número deles diz quantos dias de TRABALHO a
 * pessoa ficou fora, e um sábado de ausência pontual não é um dia em que
 * alguém deixou de entregar.
 *
 * Espelha `public.dias_do_pedido()` do Postgres. As duas existem de propósito:
 * esta escreve o número que a pessoa vê enquanto seleciona, aquela é a que o
 * banco grava.
 */
export function contarDiasDoPedido(
  tipo: HrTipo,
  inicioISO: string,
  fimISO: string,
  feriados: Set<string>,
): number {
  if (tipo !== "ferias") return contarDiasUteis(inicioISO, fimISO, feriados);

  const inicio = lerData(inicioISO);
  const fim = lerData(fimISO);
  if (!inicio || !fim || fim < inicio) return 0;

  return diasEntre(inicioISO, fimISO).length;
}

/**
 * "4 dias corridos" ou "2 dias úteis", conforme o tipo.
 *
 * Existe porque a frase aparece na fila do sócio e na lista de pedidos da
 * própria pessoa, e as duas precisam dizer a mesma coisa. Escrever "dias
 * úteis" em cima de um número corrido é a tela desmentindo a conta — quem
 * pediu de sexta a segunda veria "4 dias úteis" e concluiria que o sistema
 * errou.
 */
export function rotuloDosDias(tipo: HrTipo, dias: number): string {
  const plural = dias === 1 ? "dia" : "dias";
  if (tipo === "ferias") return `${dias} ${plural} corrido${dias === 1 ? "" : "s"}`;
  return `${dias} ${plural} ${dias === 1 ? "útil" : "úteis"}`;
}

export function ehDiaUtil(data: Date, feriados: Set<string>): boolean {
  const semana = data.getDay();
  if (semana === 0 || semana === 6) return false;
  return !feriados.has(paraISO(data));
}

/** Todos os dias entre duas datas, inclusive. */
export function diasEntre(inicioISO: string, fimISO: string): string[] {
  const inicio = lerData(inicioISO);
  const fim = lerData(fimISO);
  if (!inicio || !fim || fim < inicio) return [];

  const dias: string[] = [];
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    dias.push(paraISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

/**
 * Data ISO -> Date local, sem fuso.
 *
 * `new Date("2026-03-02")` é interpretado como UTC e, a oeste de Greenwich,
 * vira 1º de março às 21h. Um dia inteiro de diferença num módulo de descanso é
 * a diferença entre o pedido certo e o errado.
 */
export function lerData(iso: string): Date | null {
  const partes = iso.split("-").map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  const [ano, mes, dia] = partes;
  const data = new Date(ano, mes - 1, dia);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function paraISO(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Ordena duas datas, para a seleção funcionar de trás para a frente também. */
export function ordenar(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

// ---------------------------------------------------------------------------
// O bloqueio por área
//
// Quem responde ao pedido precisa saber quem mais do mesmo time está fora:
// duas designers na mesma semana param a produção, dois nomes quaisquer não
// dizem nada. Por isso o calendário bloqueia os dias em que um colega da área
// já está fora.
//
// A PERGUNTA É SOBRE O INTERVALO, NUNCA SOBRE O DIA SOLTO. Antes a tela
// recusava dia a dia, e o resultado era que clicar no dia 8 não fazia nada,
// mas escolher de 5 a 20 — que passa por cima do 8 — era aceito. Duas
// respostas para a mesma situação, conforme o caminho do clique.
//
// Isto é guarda de TELA, e não vale como trava: quem chamar a API direto
// consegue gravar o pedido do mesmo jeito. O que impede a demanda de seguir é
// o sócio, que vê "quem mais da área está fora" na fila antes de responder.
// ---------------------------------------------------------------------------

export type BloqueioDeArea = { dia: string; nomes: string[] };

/** Os dias do intervalo em que alguém da área já está fora, na ordem. */
export function bloqueiosNoIntervalo(
  inicio: string,
  fim: string,
  bloqueados: Record<string, string[]>,
): BloqueioDeArea[] {
  const [de, ate] = ordenar(inicio, fim);
  const encontrados: BloqueioDeArea[] = [];
  for (const dia of diasEntre(de, ate)) {
    const nomes = bloqueados[dia];
    if (nomes && nomes.length > 0) encontrados.push({ dia, nomes });
  }
  return encontrados;
}

/**
 * A frase da recusa.
 *
 * NOMEIA QUEM ESTÁ FORA, sempre. "Indisponível" sem nome é uma recusa que a
 * pessoa não tem como contornar nem entender — com o nome, ela fala com o
 * colega e os dois se organizam, que é o resultado que interessa.
 *
 * E diz o DIA, porque num intervalo de duas semanas saber que "alguém está
 * fora" não ajuda a escolher outro período.
 */
export function motivoDoBloqueio(bloqueios: BloqueioDeArea[], area: string): string {
  if (bloqueios.length === 0) return "";

  const nomes = [...new Set(bloqueios.flatMap((b) => b.nomes))];
  const quem =
    nomes.length === 1
      ? `${nomes[0]} já está fora`
      : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)} já estão fora`;

  const dias = bloqueios.map((b) => formatarDiaMes(b.dia));
  const quando =
    dias.length === 1
      ? `em ${dias[0]}`
      : dias.length <= 3
        ? `em ${dias.slice(0, -1).join(", ")} e ${dias.at(-1)}`
        : `em ${dias.length} dias desse período, a partir de ${dias[0]}`;

  return `${quem} ${quando}. Você e ${nomes.length === 1 ? "essa pessoa" : "essas pessoas"} são do ${area} — escolha outro período ou combine com ${nomes.length === 1 ? "ela" : "elas"}.`;
}

// ---------------------------------------------------------------------------
// OS MEUS PERÍODOS JÁ COMBINADOS, NO CALENDÁRIO DE PROPOR
//
// Decisão do usuário: *"preciso que quando eu tenha proposto um período (…)
// apareça caso tenha sido aceito, o período na aba de propor período, para
// que eu não perca tempo preenchendo uma data que já não está disponível"*.
//
// **A REGRA JÁ EXISTIA NO BANCO, E SÓ NO BANCO.** `validar_solicitacao`
// recusa desde sempre um pedido que cubra um dia de outro pedido MEU em
// `pendente` ou `aprovada`, com a frase *"Você já tem um período combinado
// cobrindo parte dessas datas"*. O que faltava era a tela dizer isso ANTES:
// a pessoa escolhia dez dias, escrevia a observação, clicava em Enviar, e só
// então descobria. É a decisão da máquina de estados da subtarefa — o banco é
// o que vale, a função da tela escreve a frase antes de a pessoa clicar.
//
// **E NÃO HÁ CONSULTA NOVA.** `minhasSolicitacoes()` já devolve todos os meus
// pedidos, com status, e a tela de Propor já os recebe — é ela que desenha
// "Meus períodos" no rodapé. A ponte estava construída; o que faltava era
// atravessá-la para dentro do calendário.
//
// **OS DIAS SÃO TODOS, E NÃO SÓ OS ÚTEIS**, ao contrário da contagem do
// pedido: a trava do banco compara `data_inicio <= fim and data_fim >=
// inicio`, que é o período inteiro. Pintar só os úteis deixaria o sábado do
// meio clicável e recusado no envio — exatamente o que isto existe para
// evitar.
//
// **PENDENTE CONTA**, pela mesma razão: o banco recusa a sobreposição com um
// pedido que ainda espera resposta. Mostrar só os aprovados faria a tela
// liberar um dia que o envio recusa.
// ---------------------------------------------------------------------------

export type DiaCombinado = { tipo: HrTipo; status: HrStatus };

type PedidoParaOCalendario = {
  tipo: HrTipo;
  status: HrStatus;
  data_inicio: string;
  data_fim: string;
};

/** Dia ISO → o período meu que já o ocupa. */
export function diasJaCombinados(
  solicitacoes: PedidoParaOCalendario[],
): Record<string, DiaCombinado> {
  const mapa: Record<string, DiaCombinado> = {};
  for (const pedido of solicitacoes) {
    if (pedido.status !== "pendente" && pedido.status !== "aprovada") continue;
    for (const dia of diasEntre(pedido.data_inicio, pedido.data_fim)) {
      // O APROVADO GANHA DO PENDENTE quando os dois cobrem o mesmo dia. Não
      // deveria acontecer — a trava do banco impede —, e acontece em base
      // antiga ou escrita à mão. Entre as duas verdades, a que vale é a
      // combinada.
      if (mapa[dia]?.status === "aprovada") continue;
      mapa[dia] = { tipo: pedido.tipo, status: pedido.status };
    }
  }
  return mapa;
}

/**
 * O rótulo da célula: o TIPO, e só ele.
 *
 * **Ele já carregou o status — "Descanso · aguardando" — e a imagem mostrou
 * por quê não.** A célula tem cerca de 120px num calendário de 1600, e a
 * frase saía "Descanso · a…": o sufixo não cabia em lugar nenhum, e truncado
 * ele não distingue nada, só suja a linha.
 *
 * **E o que ele distinguia não se perde**, que é o que torna o corte barato:
 * o combinado e o que espera resposta pedem a mesma coisa de quem está
 * escolhendo datas — outro período —, e a diferença entre eles (esperar a
 * resposta ou cancelar o pedido) aparece onde ela decide algo: na frase da
 * recusa, que `motivoDoCombinado()` escreve inteira, e na lista "Meus
 * períodos", que carrega o selo de status de cada um.
 */
export function rotuloDoDiaCombinado(combinado: DiaCombinado): string {
  return ROTULOS_DE_TIPO[combinado.tipo];
}

/** Os dias do intervalo que já são de um período meu, na ordem. */
export function combinadosNoIntervalo(
  inicio: string,
  fim: string,
  combinados: Record<string, DiaCombinado>,
): { dia: string; combinado: DiaCombinado }[] {
  const [de, ate] = ordenar(inicio, fim);
  const encontrados: { dia: string; combinado: DiaCombinado }[] = [];
  for (const dia of diasEntre(de, ate)) {
    const combinado = combinados[dia];
    if (combinado) encontrados.push({ dia, combinado });
  }
  return encontrados;
}

/**
 * A frase da recusa por período meu.
 *
 * Ela NOMEIA O TIPO e o DIA, pela razão de `motivoDoBloqueio()`: "você já tem
 * um período aqui" num intervalo de duas semanas não ajuda a escolher outro.
 * E ela distingue o pendente do aprovado — num o caminho é esperar a
 * resposta, no outro é cancelar o pedido antigo, e as duas saídas estão na
 * lista "Meus períodos" logo abaixo.
 */
export function motivoDoCombinado(
  encontrados: { dia: string; combinado: DiaCombinado }[],
): string {
  if (encontrados.length === 0) return "";

  const dias = encontrados.map((e) => formatarDiaMes(e.dia));
  const quando =
    dias.length === 1
      ? `em ${dias[0]}`
      : dias.length <= 3
        ? `em ${dias.slice(0, -1).join(", ")} e ${dias.at(-1)}`
        : `em ${dias.length} dias desse período, a partir de ${dias[0]}`;

  // O TIPO É O DO PRIMEIRO DIA, e não uma lista: dois períodos meus diferentes
  // dentro do mesmo intervalo é caso raro, e nomear os dois daria uma frase
  // que ninguém lê até o fim. O que decide a saída é o STATUS, e esse a frase
  // carrega inteiro.
  const { tipo, status } = encontrados[0].combinado;
  const nome = ROTULOS_DE_TIPO[tipo];

  return status === "pendente"
    ? `Você já pediu ${nome} ${quando}, e esse pedido ainda espera resposta. Cancele-o em "Meus períodos" ou escolha outras datas.`
    : `Você já tem ${nome} combinado ${quando}. Dois períodos seus não podem cobrir o mesmo dia.`;
}

/** "08/09". Sem date-fns para esta função continuar pura e sem locale. */
function formatarDiaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

// ---------------------------------------------------------------------------
// QUEM ESTÁ FORA, EM BLOCOS — e não em min..max
//
// Relato do usuário, com imagem: *"quando eu registro um descanso, mesmo que
// antigo, ele fica aparecendo aqui, mas essas pessoas já voltaram para a
// agência"*. O cartão mostrava "Giovanna Marino · 24/10 a 03/10", que é uma
// faixa que anda para trás — e as duas coisas têm a mesma causa.
//
// **O CARTÃO LIA O MAPA DO CALENDÁRIO, QUE COBRE SEIS ANOS.** `bloqueados` é
// dia → nomes, e a página o pede de `PRIMEIRO_MES_DO_CALENDARIO` a
// `ULTIMO_MES_DO_CALENDARIO` — 2025 a 2030 — porque a grade precisa pintar de
// âmbar qualquer dia que alguém role até. Isso está certo para a GRADE e é o
// conjunto errado para o cartão: ele reduzia tudo a `min` e `max` por pessoa,
// então um descanso de 2025 e outro de 2026 viravam uma faixa só — e em
// `dd/MM`, sem o ano, ela sai invertida.
//
// Eram portanto dois erros empilhados, e o segundo escondia o primeiro: quem
// lia "24/10 a 03/10" via uma data estranha, não um período que já passou.
//
// **A SAÍDA É SEPARAR POR BLOCO CONTÍGUO**, e com ela o `dd/MM` volta a poder
// ser lido: cada bloco é um período de verdade. O comentário antigo do cartão
// dizia que isso não dava — *"guardar cada bloco exigiria a data de início e
// de fim de cada pedido alheio, informação que esta tela não tem"* —, e
// estava errado: dias consecutivos são um bloco, e o mapa já tem os dias.
//
// **O QUE SEPARA UM BLOCO DO SEGUINTE NÃO É QUALQUER VÃO.** Descanso pinta
// todos os dias (0024), mas afastamento e ausência pontual pintam só os
// ÚTEIS — então uma ausência de duas semanas chega aqui com os sábados e
// domingos faltando, e um corte ingênuo a quebraria em três blocos. O vão só
// corta quando tem pelo menos um dia de trabalho dentro, e quem sabe disso é
// `ehDiaUtil()`, a mesma função que conta os dias do pedido.
// ---------------------------------------------------------------------------

export type BlocoDeAusencia = {
  nome: string;
  /** O primeiro dia do bloco, em ISO — é por ele que a lista ordena. */
  inicio: string;
  fim: string;
};

/**
 * Os períodos de quem está fora, um por bloco, e só os que ainda não
 * terminaram.
 *
 * **O RECORTE É `fim >= hoje`, e não `inicio >= hoje`.** Quem está fora AGORA
 * é o caso principal do cartão — a frase dele é "quem está fora" —, e um
 * período que começou semana passada e termina sexta tem de aparecer. O que
 * sai é o que já acabou: ali a pessoa voltou, e o bloqueio não decide mais
 * nada para quem está escolhendo um período.
 *
 * *O que ele continua não sabendo, e fica dito:* dois pedidos emendados da
 * mesma pessoa — um que termina na sexta e outro que começa na segunda — se
 * leem como um bloco só, porque o vão entre eles não tem dia útil. Separá-los
 * exigiria a data de cada pedido alheio, que esta tela não tem e não deve
 * ter.
 */
export function blocosDeAusencia(
  bloqueados: Record<string, string[]>,
  hojeISO: string,
  feriados: Set<string>,
): BlocoDeAusencia[] {
  const porPessoa = new Map<string, string[]>();
  for (const [dia, nomes] of Object.entries(bloqueados)) {
    for (const nome of nomes) {
      const dias = porPessoa.get(nome);
      if (dias) dias.push(dia);
      else porPessoa.set(nome, [dia]);
    }
  }

  const blocos: BlocoDeAusencia[] = [];
  for (const [nome, dias] of porPessoa) {
    const ordenados = [...dias].sort();
    let inicio = ordenados[0];
    let anterior = ordenados[0];

    for (const dia of ordenados.slice(1)) {
      if (temDiaUtilEntre(anterior, dia, feriados)) {
        blocos.push({ nome, inicio, fim: anterior });
        inicio = dia;
      }
      anterior = dia;
    }
    blocos.push({ nome, inicio, fim: anterior });
  }

  return blocos
    .filter((bloco) => bloco.fim >= hojeISO)
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Há pelo menos um dia de trabalho estritamente entre os dois? */
function temDiaUtilEntre(depoisDe: string, antesDe: string, feriados: Set<string>): boolean {
  const cursor = lerData(depoisDe);
  const fim = lerData(antesDe);
  if (!cursor || !fim) return true;

  cursor.setDate(cursor.getDate() + 1);
  while (cursor < fim) {
    if (ehDiaUtil(cursor, feriados)) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

/**
 * "24/09 a 03/10", e com o ano quando ele não é o de hoje.
 *
 * O `dd/MM` cabe no selo e é o que a pessoa lê sem traduzir; o ano só entra
 * quando a ausência não é deste ano — senão ele ocupa seis caracteres em toda
 * linha para repetir o que já é óbvio. **E ele entra quando QUALQUER uma das
 * pontas é de outro ano**, não só a primeira: um descanso de 28/12 a 05/01
 * atravessa a virada, e mostrar o ano numa ponta só é pior que não mostrar em
 * nenhuma.
 */
export function faixaDoBloco(bloco: BlocoDeAusencia, hojeISO: string): string {
  const anoDeHoje = hojeISO.slice(0, 4);
  const outroAno =
    bloco.inicio.slice(0, 4) !== anoDeHoje || bloco.fim.slice(0, 4) !== anoDeHoje;

  const escrever = (iso: string) =>
    outroAno ? `${formatarDiaMes(iso)}/${iso.slice(2, 4)}` : formatarDiaMes(iso);

  return bloco.inicio === bloco.fim
    ? escrever(bloco.inicio)
    : `${escrever(bloco.inicio)} a ${escrever(bloco.fim)}`;
}
