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
// AS QUATRO VISÕES
// ---------------------------------------------------------------------------

export const VISOES = ["mes", "semana", "linha", "lista"] as const;
export type VisaoDoCalendario = (typeof VISOES)[number];

export const ROTULOS_DE_VISAO: Record<VisaoDoCalendario, string> = {
  mes: "Mês",
  semana: "Semana",
  linha: "Linha do tempo",
  lista: "Lista",
};

export function ehVisao(valor: unknown): valor is VisaoDoCalendario {
  return typeof valor === "string" && (VISOES as readonly string[]).includes(valor);
}

// ---------------------------------------------------------------------------
// AS CAMADAS
//
// Uma camada é uma origem da view que dá para desligar. Elas são as MESMAS
// sete que a `calendar_events` produz, e é de propósito: uma camada que não
// casasse com um `tipo` seria um interruptor que não apaga nada.
// ---------------------------------------------------------------------------

export const CAMADAS: TipoNoCalendario[] = [
  "subtarefa",
  "task",
  "ausencia",
  "evento",
  "post",
  "etapa_de_post",
  "campanha",
  "entregavel",
];

export const ROTULOS_DE_CAMADA: Record<TipoNoCalendario, string> = {
  subtarefa: "Etapas",
  task: "Demandas",
  ausencia: "Quem está fora",
  evento: "Eventos",
  post: "Posts",
  // "Etapas de post" e não "Produção do social": o rótulo tem que dizer a
  // ENTIDADE, porque o interruptor liga e desliga exatamente estas linhas.
  etapa_de_post: "Etapas de post",
  campanha: "Campanhas",
  entregavel: "Materiais de campanha",
};

/**
 * A cor de cada camada, em PAR NOMEADO.
 *
 * Nunca opacidade: `bg-warning/10` sobre um fundo qualquer dá uma cor que
 * ninguém mediu, e no tema escuro dá outra. Os pares abaixo estão todos em
 * `check:cores`.
 *
 * **A etapa é a exceção e não tem cor fixa**: ela é pintada pela PRIORIDADE,
 * que é a informação que decide o que fazer primeiro. Dar-lhe uma cor de
 * camada apagaria justamente isso.
 */
export const COR_DA_CAMADA: Record<TipoNoCalendario, string> = {
  subtarefa: "bg-muted text-text-secondary",
  task: "bg-blue-soft text-blue-strong",
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
  // portal com os sete status em cinco tons. A etapa é o trabalho por trás da
  // peça, e a camada tem interruptor próprio: quem quiser separar as duas na
  // tela desliga uma. Inventar um sexto par aqui seria pintar de cor nova uma
  // coisa que pertence à mesma família.
  etapa_de_post: "bg-success-soft text-success",
  campanha: "bg-warning-soft text-warning",
  entregavel: "bg-warning-soft text-warning",
};

/**
 * A cor da barra de uma ETAPA, pela prioridade.
 *
 * É a exceção do mapa acima, e está escrita lá: dar cor de camada à etapa
 * apagaria a informação que decide o que fazer primeiro. Só o FUNDO, sem
 * texto — a barra é uma faixa de 8px e não carrega palavra nenhuma; o nome
 * vai no `title` e no rótulo acessível.
 */
export const COR_DA_PRIORIDADE: Record<string, string> = {
  urgente: "bg-danger",
  alta: "bg-warning",
  normal: "bg-neutral",
  baixa: "bg-neutral-soft",
};

export function corDaEtapa(prioridade: string | null): string {
  return COR_DA_PRIORIDADE[prioridade ?? "normal"] ?? COR_DA_PRIORIDADE.normal;
}

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
 * Uma pessoa na Linha do Tempo.
 *
 * **Mora aqui e não em `lib/dados/`**, junto com todo tipo que a tela usa: os
 * quatro desenhos são cliente, `lib/dados/` é `server-only`, e o gerador de
 * protótipo TROCA aquele módulo por um de exemplo. Com o tipo lá, a troca
 * levava a declaração junto e a compilação do protótipo quebrava — que foi
 * exatamente o que aconteceu.
 */
export type PessoaDaLinha = {
  id: string;
  nome: string;
  avatar_url: string | null;
  area: string | null;
  capacidadeMinutos: number;
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

export type CargaDeUmDia = {
  userId: string;
  dia: string;
  minutos: number;
  etapas: number;
  semEstimativa: number;
  ausente: boolean;
};

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
 * **Etapa sem estimativa conta como zero minuto e aparece na contagem**, e é
 * honesto: ela ocupa a pessoa, só ninguém disse quanto. A tela diz "3 etapas,
 * 1 sem estimativa" em vez de fingir um número.
 */
export function nivelDaCarga(carga: CargaDeUmDia, capacidadeMinutos: number): NivelDeCarga {
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
