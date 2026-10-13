import type { EventoTipo, TipoNoCalendario } from "@/lib/supabase/database.types";

/**
 * O vocabulário do Calendário Full.
 *
 * **Sem diretiva nenhuma, e é obrigatório que seja assim:** a página é Server
 * Component e lê a visão e as camadas da URL; os quatro desenhos são cliente.
 * Valor exportado de arquivo `"use client"` chega ao servidor como referência
 * de cliente e estoura ao ser chamado — foi o que derrubou a Gestão de
 * Pessoas, e `npm run check:fronteira` existe por causa disso.
 */

// ---------------------------------------------------------------------------
// AS DUAS VISÕES
//
// ---------------------------------------------------------------------------
// ERAM QUATRO, e a Linha do Tempo e a Lista saíram por decisão do usuário:
// *"tirar visualização de 'Linha do tempo' e 'Lista'"*.
//
// **Saíram do TIPO, e não só da fileira de pílulas**, que é a decisão da 0023
// e a lição da camada que a 0088 deixou para trás: tirar o interruptor e
// deixar o valor no enum dá um `?visao=linha` que atravessa a tela inteira
// até cair num `ROTULOS_DE_VISAO[visao]` indefinido. Com a união de dois,
// quem mexer nisso leva erro de tipo, e `ehVisao()` manda o link antigo para
// o mês — que é o que um endereço salvo tem de fazer: abrir, e não quebrar.
//
// **O QUE SE PERDE ESTÁ DITO, porque é informação e não enfeite.** A Linha do
// Tempo era a única tela que respondia *"a equipe aguenta?"* — a cor da
// célula dela era OCUPAÇÃO, não camada, vinda de `carga_da_equipe()`. A
// pergunta continua tendo resposta em dois lugares, e os dois são onde ela é
// feita de verdade: a faixa de disponibilidade no painel da etapa (quem está
// distribuindo trabalho) e os alertas de carga do Feedback (quem olha o mês
// que passou). O que não existe mais é o retrato da equipe inteira num mês.
//
// A Lista era o CSV. O que fica no lugar é o **.ics** do cabeçalho, que
// responde a mesma pergunta — *"me manda isso"* — num formato que é um
// calendário de verdade, e não uma planilha de linhas de calendário.
//
// `nivelDaCarga()`, `COR_DO_NIVEL` e `ROTULOS_DE_NIVEL` continuam aqui, mais
// abaixo: a faixa de disponibilidade os usa, e é por eles que as duas telas
// de carga do produto têm os mesmos quatro degraus.
// ---------------------------------------------------------------------------

export const VISOES = ["mes", "semana"] as const;
export type VisaoDoCalendario = (typeof VISOES)[number];

export const ROTULOS_DE_VISAO: Record<VisaoDoCalendario, string> = {
  mes: "Mês",
  semana: "Semana",
};

export function ehVisao(valor: unknown): valor is VisaoDoCalendario {
  return typeof valor === "string" && (VISOES as readonly string[]).includes(valor);
}

// ---------------------------------------------------------------------------
// AS CAMADAS
//
// Uma camada é uma origem da view que dá para desligar. Elas são as MESMAS
// seis que a `calendar_events` produz, e é de propósito: uma camada que não
// casasse com um `tipo` seria um interruptor que não apaga nada.
//
// ---------------------------------------------------------------------------
// A DEMANDA E A ETAPA NÃO ESTÃO AQUI, e a ausência é decisão do usuário
// (0077): *"quero que elas fiquem apenas dentro do Minhas Tasks"*.
//
// Elas saíram da VIEW, e não só desta lista — tirar o interruptor e deixar a
// origem produzindo esconderia as linhas desta tela e as entregaria de graça
// ao próximo consumidor da view, que é a porta por onde elas voltam sem
// ninguém ter decidido isso.
//
// **O que a Linha do Tempo não perde é a CARGA.** A cor da célula é ocupação,
// e ela sai de `carga_da_equipe()` chamando `carga_do_dia()` (0035) — nenhuma
// das duas lê esta view: elas leem `subtasks` direto. Sai a barra da etapa e
// fica o peso dela, que é o que responde "a equipe aguenta?".
//
// ---------------------------------------------------------------------------
// E A SEXTA VOLTOU COM OUTRO RECORTE, que é a lista acima dizendo a verdade.
//
// A 0088 tirou a `etapa_de_post` da view, e ESTA LISTA FICOU COM ELA: um
// interruptor chamado "Etapas de post" que ligava e desligava zero linha.
// Nada quebrou, nada avisou, e foi a 0090 que mostrou — ela devolveu a
// origem com o nome `fase_de_social`, e o `in("tipo", camadas)` de
// `itensDoCalendario` passou a FILTRAR FORA exatamente as linhas que a
// migration acabara de criar. Quem abrisse o calendário com qualquer camada
// escolhida não veria fase nenhuma; sem camada na URL elas chegavam e caíam
// num `ROTULOS_DE_CAMADA[tipo]` indefinido, com o selo em branco e sem cor.
//
// **As duas não são a mesma coisa, e é por isso que o nome mudou.** A que
// saiu era uma linha por PEÇA por fase — com doze posts, sessenta linhas no
// mês de uma conta só. A que entrou é uma linha por FASE: cinco por mês, cada
// uma o trabalho de uma pessoa num dia, que é exatamente o que esta tela
// responde. Manter o nome antigo faria o interruptor nomear o que ele não
// liga mais.
// ---------------------------------------------------------------------------

export const CAMADAS: TipoNoCalendario[] = [
  "ausencia",
  "evento",
  "post",
  "fase_de_social",
  "campanha",
  "entregavel",
];

export const ROTULOS_DE_CAMADA: Record<TipoNoCalendario, string> = {
  ausencia: "Quem está fora",
  evento: "Eventos",
  post: "Posts",
  // O RÓTULO DIZ A ENTIDADE, porque o interruptor liga e desliga exatamente
  // estas linhas — e a entidade mudou na 0090: era "Etapas de post", uma
  // linha por peça, e virou a FASE do mês, uma linha por fase. Trocar a
  // origem e deixar o rótulo antigo é a tela nomeando o que ela não mostra
  // mais.
  fase_de_social: "Fases do social",
  campanha: "Campanhas",
  entregavel: "Materiais de campanha",
};

/**
 * A cor de cada camada, em PAR NOMEADO.
 *
 * Nunca opacidade: `bg-warning/10` sobre um fundo qualquer dá uma cor que
 * ninguém mediu, e no tema escuro dá outra. Os pares abaixo estão todos em
 * `check:cores`.
 */
export const COR_DA_CAMADA: Record<TipoNoCalendario, string> = {
  // `text-neutral` E NAO `text-text-muted`: o par
  // `--text-muted` sobre `--muted` dá 4,43:1 — passa raspando POR BAIXO do
  // mínimo de 4.5, e o axe reprovou nas três visões do mês. `--neutral` é o
  // primeiro-plano nomeado de `--neutral-soft`, que é o que `--muted` aponta,
  // e dá 6,3:1. O par nomeado existe justamente para isto não depender de
  // quem escolhe a classe.
  ausencia: "bg-muted text-neutral",
  evento: "bg-blue-soft text-blue-strong",
  post: "bg-success-soft text-success",
  // O MESMO PAR DO POST, e é escolha. A legenda AGRUPA quem divide a cor —
  // como a do Social Media já faz com as duas mãos que dividem o azul, e a do
  // portal com os sete status em cinco tons. A fase é o trabalho por trás das
  // peças, e a camada tem interruptor próprio: quem quiser separar as duas na
  // tela desliga uma. Inventar um sexto par aqui seria pintar de cor nova uma
  // coisa que pertence à mesma família.
  fase_de_social: "bg-success-soft text-success",
  campanha: "bg-warning-soft text-warning",
  entregavel: "bg-warning-soft text-warning",
};

// ---------------------------------------------------------------------------
// OS TIPOS DE EVENTO
// ---------------------------------------------------------------------------

export const TIPOS_DE_EVENTO: EventoTipo[] = [
  "convencao",
  "feira",
  "lancamento",
  "reuniao",
  "treinamento",
  "feriado_cliente",
  "outro",
];

export const ROTULOS_DE_TIPO_DE_EVENTO: Record<EventoTipo, string> = {
  convencao: "Convenção",
  feira: "Feira",
  lancamento: "Lançamento",
  reuniao: "Reunião",
  treinamento: "Treinamento",
  feriado_cliente: "Feriado do cliente",
  outro: "Outro",
};

/**
 * A cor por tipo de evento.
 *
 * **Sete tipos em quatro pares**, e é a mesma decisão das oito categorias das
 * Recomendações: sete cores distintas numa grade de mês viram confete, e o
 * que o selo precisa dizer é "isto é de ir / é do cliente / é interno". O
 * nome exato vai no `title` e no rótulo acessível — **a cor nunca é o único
 * sinal**.
 */
export const COR_DO_TIPO_DE_EVENTO: Record<EventoTipo, string> = {
  convencao: "bg-blue-soft text-blue-strong",
  feira: "bg-blue-soft text-blue-strong",
  lancamento: "bg-success-soft text-success",
  reuniao: "bg-muted text-text-secondary",
  treinamento: "bg-muted text-text-secondary",
  feriado_cliente: "bg-warning-soft text-warning",
  outro: "bg-muted text-text-secondary",
};

// ---------------------------------------------------------------------------
// O ITEM
// ---------------------------------------------------------------------------

export type ItemDoCalendario = {
  id: string;
  tipo: TipoNoCalendario;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  clientId: string | null;
  cliente: string | null;
  userId: string | null;
  pessoa: { id: string; nome: string; avatar_url: string | null } | null;
  /**
   * **Sempre nula desde a 0077**, e a coluna continua na view de propósito:
   * `create or replace view` não deixa TIRAR coluna — só acrescentar no fim —,
   * e um `drop`/`create` derrubaria junto os grants de um objeto que o
   * PostgREST publica. É a situação de `cancelada` no enum de status: o valor
   * fica, e nenhum caminho o produz. Quem a escrevia era a etapa, que saiu.
   */
  prioridade: string | null;
  status: string | null;
  link: string;
};

/**
 * OS DIAS QUE A GRADE DO MÊS PINTA para este item.
 *
 * ---------------------------------------------------------------------------
 * A CAMPANHA ENTRA PELO ENCERRAMENTO, e a view carrega o período inteiro.
 *
 * São as duas metades da mesma decisão. A view guarda a VERDADE — a Wave
 * começa dia 1 e acaba dia 30 —, porque a Linha do Tempo precisa da barra
 * longa. A grade do mês não: uma Wave de trinta dias pintaria trinta células
 * e empurraria para baixo tudo o que acontece em cada uma. Então na grade ela
 * aparece no dia em que ACABA, que é o dia em que ela exige alguma coisa de
 * alguém.
 *
 * Esta função é o único lugar onde essa escolha mora. Com ela espalhada, a
 * grade e a lista discordariam sobre em que dia a mesma campanha está.
 * ---------------------------------------------------------------------------
 */
export function diaNaGrade(item: ItemDoCalendario): { de: string; ate: string } {
  if (item.tipo === "campanha") return { de: item.dataFim, ate: item.dataFim };
  return { de: item.dataInicio, ate: item.dataFim };
}

/** O item ocupa este dia? Usa a regra da grade, não o período cru. */
export function ocupaODia(item: ItemDoCalendario, dia: string): boolean {
  const { de, ate } = diaNaGrade(item);
  return dia >= de && dia <= ate;
}

/** Mais de um dia: é faixa, e não item da lista do dia. */
export function ehFaixa(item: ItemDoCalendario): boolean {
  const { de, ate } = diaNaGrade(item);
  return ate > de;
}

// ---------------------------------------------------------------------------
// A CARGA
// ---------------------------------------------------------------------------

/**
 * Uma pessoa da equipe, como esta tela precisa dela.
 *
 * **Mora aqui e não em `lib/dados/`**, junto com todo tipo que a tela usa: os
 * dois desenhos são cliente, `lib/dados/` é `server-only`, e o gerador de
 * protótipo TROCA aquele módulo por um de exemplo. Com o tipo lá, a troca
 * levava a declaração junto e a compilação do protótipo quebrava — que foi
 * exatamente o que aconteceu.
 *
 * **`area` e `capacidadeMinutos` SAÍRAM com a Linha do Tempo**, que era quem
 * agrupava por área e dividia os minutos pela capacidade. Hoje a lista serve
 * ao filtro "Filtrar por responsável" e aos participantes do evento, e os
 * dois querem três campos. Um campo que nenhuma tela lê é o que alguém
 * reaproveita três sprints depois achando que ele quer dizer alguma coisa —
 * a decisão da 0023, aplicada a um tipo.
 */
export type PessoaDoCalendario = {
  id: string;
  nome: string;
  avatar_url: string | null;
};

export type EventoDetalhado = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: EventoTipo;
  clientId: string | null;
  cliente: string | null;
  dataInicio: string;
  dataFim: string;
  diaInteiro: boolean;
  horaInicio: string | null;
  horaFim: string | null;
  local: string | null;
  link: string | null;
  bloqueiaFerias: boolean;
  participantes: { id: string; nome: string; avatar_url: string | null }[];
};

// ---------------------------------------------------------------------------
// `CargaDeUmDia` SAIU COM A LINHA DO TEMPO, e com ele `cargaDaEquipe()` em
// `lib/dados/calendario.ts`: era aquela grade a única tela que lia a carga da
// equipe inteira. A função `carga_da_equipe()` continua no banco, sem leitor —
// e é por isso que ela não sai por migration: ela não é schema que alguém
// consulte por engano, é um `select` a mais ali dentro, e quem ela chama
// (`carga_do_dia()`, 0035) continua sendo a fonte única da conta para o
// Feedback e para `disponibilidade_bruta()`. Devolver a visão é devolver uma
// função em `lib/dados/`, que o git guarda.
//
// O que fica abaixo é a ESCALA, e ela tem leitor: a faixa de disponibilidade.
// ---------------------------------------------------------------------------

export type NivelDeCarga = "vazio" | "folgado" | "cheio" | "estourado";

/**
 * Onde a pessoa está em relação ao que ela tem de dia.
 *
 * **Acima de 100% é `estourado` e acende, mas 100% em ponto não.** Um dia
 * exatamente cheio é um dia planejado, não um problema — e um alerta que
 * acende no caso normal é um alerta que a pessoa aprende a ignorar, que é
 * exatamente o que a Matriz do Full Days evita ao não contar "remoto" como
 * fora.
 *
 * **Etapa sem estimativa conta TRÊS HORAS**, e não mais zero — decisão do
 * usuário na migration 0081. Zero era o pior dos dois mundos: a etapa
 * aparecia na contagem (a pessoa lia "3 etapas") e não somava minuto nenhum
 * (a barra dizia que o dia estava livre). A conta da casa é que três etapas
 * em branco enchem um dia de nove horas.
 *
 * O número mora no `coalesce` de `disponibilidade_bruta()` e em mais nenhum
 * lugar — nem aqui: esta função recebe os minutos que o banco já somou.
 */
/**
 * O PARÂMETRO É ESTREITO DE PROPÓSITO.
 *
 * Ela lê dois campos, e pede exatamente dois. Pedindo um tipo de linha
 * inteira, quem tem o número de outra consulta — a faixa de disponibilidade,
 * que traz o dia de UMA pessoa e não da equipe — precisaria inventar os
 * campos que falta para chamar, e o molde errado mente com mais convicção que
 * a ausência. Foi essa forma estreita que fez a escala sobreviver à saída da
 * Linha do Tempo sem uma linha de mudança.
 */
export function nivelDaCarga(
  carga: { minutos: number; etapas: number },
  capacidadeMinutos: number,
): NivelDeCarga {
  if (carga.etapas === 0) return "vazio";
  if (capacidadeMinutos <= 0) return "cheio";
  const fracao = carga.minutos / capacidadeMinutos;
  if (fracao > 1) return "estourado";
  if (fracao >= 0.8) return "cheio";
  return "folgado";
}

export const COR_DO_NIVEL: Record<NivelDeCarga, string> = {
  vazio: "bg-muted",
  folgado: "bg-success-soft",
  cheio: "bg-warning-soft",
  estourado: "bg-danger-soft",
};

export const ROTULOS_DE_NIVEL: Record<NivelDeCarga, string> = {
  vazio: "sem etapa no dia",
  folgado: "com folga",
  cheio: "quase cheio",
  estourado: "acima da capacidade",
};

// ---------------------------------------------------------------------------
// O .ics
// ---------------------------------------------------------------------------

/**
 * Escapa o que o iCalendar trata como controle.
 *
 * Sem isto, um evento chamado "Feira; São Paulo" quebra a linha em duas
 * propriedades e o arquivo inteiro deixa de importar — sem erro, o Google
 * simplesmente ignora o evento.
 */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const semTraco = (iso: string) => iso.replace(/-/g, "");

/** O dia seguinte, em ISO. `DTEND` do iCalendar é EXCLUSIVO em evento de dia inteiro. */
function diaSeguinte(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * O calendário em .ics, para assinar no Google Calendar.
 *
 * **`DTEND` é EXCLUSIVO em evento de dia inteiro**, e é o erro clássico deste
 * formato: uma feira de 12 a 14 precisa terminar em 15, senão ela aparece com
 * dois dias no Google e ninguém desconfia — o arquivo importa, a data some.
 *
 * As linhas são separadas por CRLF porque o RFC 5545 pede, e vários leitores
 * recusam o arquivo inteiro com LF sozinho.
 */
export function montarIcs(itens: ItemDoCalendario[], agoraISO: string): string {
  const carimbo = `${semTraco(agoraISO.slice(0, 10))}T000000Z`;

  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Full Connect Key//Full Hub//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const item of itens) {
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${item.tipo}-${item.id}@fullhub`,
      `DTSTAMP:${carimbo}`,
      `DTSTART;VALUE=DATE:${semTraco(item.dataInicio)}`,
      `DTEND;VALUE=DATE:${semTraco(diaSeguinte(item.dataFim))}`,
      `SUMMARY:${escapar(item.titulo)}`,
      `CATEGORIES:${escapar(ROTULOS_DE_CAMADA[item.tipo])}`,
    );
    if (item.cliente) linhas.push(`DESCRIPTION:${escapar(item.cliente)}`);
    linhas.push("END:VEVENT");
  }

  linhas.push("END:VCALENDAR");
  return linhas.join("\r\n");
}
