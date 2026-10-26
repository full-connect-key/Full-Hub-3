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
// NÃO EXISTEM MAIS CAMADAS, E A AUSÊNCIA É A ENTREGA DA 0105
//
// Uma camada era uma origem da view que dava para desligar, e elas eram as
// MESMAS seis que a `calendar_events` produzia. Com uma origem só não há o que
// desligar: um interruptor que apaga a tela inteira não é filtro, é um
// interruptor de luz — a mesma razão pela qual menos de duas seções não vira
// barra de contexto.
//
// Saíram com elas `CAMADAS`, `ROTULOS_DE_CAMADA` e `COR_DA_CAMADA`, e a
// remoção é a decisão da 0023: uma lista que nenhuma tela lê é o que alguém
// reaproveita errado três sprints depois.
//
// ---------------------------------------------------------------------------
// O QUE ENTROU NO LUGAR É A COR DO TIPO DE EVENTO, logo abaixo.
//
// Com uma camada só, a cor do chip deixou de distinguir coisa alguma — o mês
// inteiro saía num tom único — e o rótulo do `title` passou a dizer "Eventos:"
// em cima de todo item, que é a tela nomeando onde a pessoa já está. O que
// sobra como distinção é o que o evento É, e ele já viaja na view (a coluna
// `status` carrega `events.tipo`) e já tem mapa de cor e de rótulo.
//
// **NENHUM PAR DE COR NOVO**, e é o que torna a troca barata: os quatro de
// `COR_DO_TIPO_DE_EVENTO` já existiam. Os dois azuis trocaram de par — eles
// usavam `--blue-strong` sobre `--blue-soft`, que dá 2,35:1 no ESCURO, e isso
// passava despercebido porque viviam em duas telas que a imagem do protótipo
// não captura no escuro. Hoje usam `--accent-foreground` sobre `--accent`,
// que é o par medido em `check:cores` desde o selo Admin da barra.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// OS TIPOS DE EVENTO
// ---------------------------------------------------------------------------

// "EVENTOS FULLERS" VEM PRIMEIRO, e a ordem daqui é a do seletor do
// formulário — nada no produto ordena pelo enum, e é por isso que a 0109
// appendou o valor em vez de usar `add value ... before`. O que é da própria
// agência abre a lista porque é o que mais se lança nesta tela: a convenção
// da casa, o treinamento, a reunião de planejamento.
//
// EM TUPLA E NÃO EM ARRAY, e isso é a lição de `FUNCOES` pagando o mesmo
// preço de novo. Ela era `EventoTipo[]`, que **não serve para `z.enum`** —
// ele pede `readonly [string, ...string[]]` —, então `acoes.ts` tinha a
// lista escrita à mão ao lado. A 0109 acrescentou o oitavo valor ao enum do
// banco e a esta lista, o chip apareceu no seletor, e a action recusou o
// clique com *"Confira o campo: tipo."*: a tela oferecendo um tipo que a
// validação não conhece. **Nada quebrou no caminho** — o `tsc` não liga as
// duas listas, `check:tipos` liga migration a tipo e não lista a lista, e
// o banco nem chegou a ser chamado.
//
// O `as const` é o que faz esta lista servir aos DOIS lados, e o
// `satisfies` é a trava: um tipo que não exista em `evento_tipo` não
// compila aqui, em vez de virar recusa do Postgres na tela de quem salvou.
export const TIPOS_DE_EVENTO = [
  "evento_fullers",
  "convencao",
  "feira",
  "lancamento",
  "reuniao",
  "treinamento",
  "feriado_cliente",
  "outro",
] as const satisfies readonly EventoTipo[];

export const ROTULOS_DE_TIPO_DE_EVENTO: Record<EventoTipo, string> = {
  evento_fullers: "Eventos Fullers",
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
 * **Oito tipos em cinco pares** desde a 0109 — eram sete em quatro —, e é a
 * mesma decisão das oito categorias das Recomendações: oito cores distintas
 * numa grade de mês viram confete, e o que o selo precisa dizer é "isto é
 * nosso / é de ir / é do cliente / é interno". O nome exato vai no `title` e
 * no rótulo acessível — **a cor nunca é o único sinal**.
 */
export const COR_DO_TIPO_DE_EVENTO: Record<EventoTipo, string> = {
  // O AZUL É DOS EVENTOS DA CASA, e isso é a 0109 — decisão do usuário. Ele
  // era de convenção e feira desde a 0105, e com a categoria nova existindo
  // a pergunta mudou: numa grade de mês em que quase tudo é da agência, a cor
  // mais forte é a que diz "isto é nosso".
  //
  // `bg-accent text-accent-foreground` E NAO `bg-blue-soft text-blue-strong`,
  // e a troca é da 0105: aquele par dá 5,24:1 no claro e **2,35:1 no escuro**,
  // porque lá os dois tokens são escuros. É o mesmo achado que o selo "Admin"
  // da barra lateral já tinha pagado, e ele reaparece aqui porque a cor do
  // evento passou a desenhar o chip do mês — a peça mais repetida da tela.
  // `--accent` é "o azul legível no tema de agora", e o par está medido.
  evento_fullers: "bg-accent text-accent-foreground",
  // O ROXO, que a 0109 trouxe para a paleta sob um nome que não é o da matriz
  // do Day Off — a razão está no `globals.css`, ao lado do valor. Medido em
  // `check:cores`: 5,92:1 no claro e 6,05:1 no escuro.
  //
  // **CONVENÇÃO E FEIRA CONTINUAM DIVIDINDO O PAR**, e é a decisão original
  // desta lista: oito tipos em cinco cores, porque oito tons distintos numa
  // grade de mês viram confete. A legenda agrupa quem divide.
  convencao: "bg-roxo-soft text-roxo",
  feira: "bg-roxo-soft text-roxo",
  lancamento: "bg-success-soft text-success",
  reuniao: "bg-muted text-text-secondary",
  treinamento: "bg-muted text-text-secondary",
  feriado_cliente: "bg-warning-soft text-warning",
  outro: "bg-muted text-text-secondary",
};

/**
 * O tipo do evento que a view devolve, já conferido.
 *
 * A `calendar_events` escreve `events.tipo::text` na coluna `status`, então o
 * que chega à tela é uma STRING — e `COR_DO_TIPO_DE_EVENTO[status]` num valor
 * que não existe no enum devolve `undefined`, que no Tailwind é um chip sem
 * cor nenhuma: sem erro, sem log, e só aparece para quem conhece a peça.
 *
 * O `outro` é o fallback porque ele é o "não sei dizer" do próprio enum.
 */
export function tipoDoEvento(item: ItemDoCalendario): EventoTipo {
  return (TIPOS_DE_EVENTO as readonly string[]).includes(item.status ?? "")
    ? (item.status as EventoTipo)
    : "outro";
}

/** A cor do chip. Par nomeado, nunca opacidade. */
export function corDoEvento(item: ItemDoCalendario): string {
  return COR_DO_TIPO_DE_EVENTO[tipoDoEvento(item)];
}

/** O que a pessoa lê: "Feira", "Convenção". Nunca a chave do enum. */
export function rotuloDoEvento(item: ItemDoCalendario): string {
  return ROTULOS_DE_TIPO_DE_EVENTO[tipoDoEvento(item)];
}

// ---------------------------------------------------------------------------
// O ITEM
// ---------------------------------------------------------------------------

export type ItemDoCalendario = {
  id: string;
  /**
   * Um valor só desde a 0105, e ele fica: a view o escreve, o `.ics` o usa no
   * `UID`, e tirá-lo daqui seria churn no mapeamento do Row sem nada em troca.
   */
  tipo: TipoNoCalendario;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  clientId: string | null;
  cliente: string | null;
  /**
   * O TIPO DO EVENTO, como `events.tipo::text`.
   *
   * A view chama a coluna de `status` porque ela já se chamava assim quando
   * oito origens escreviam oito coisas diferentes nela. Quem a lê passa por
   * `tipoDoEvento()`, que confere o valor contra o enum — um `status` que não
   * esteja lá daria um chip sem cor, calado.
   */
  status: string | null;
  link: string;
};

// ---------------------------------------------------------------------------
// `userId`, `pessoa` E `prioridade` SAÍRAM NA 0105.
//
// As duas colunas continuam na view — `create or replace view` não deixa tirar
// coluna, e a razão está em `database.types.ts` —, e aqui elas não ficam: o
// tipo de domínio não é o Row, e quem escrevia `user_id` eram a ausência, o
// post, a fase do mês e a peça de campanha. O evento tem PARTICIPANTES, que
// são vários por linha: um responsável aqui teria que escolher um deles.
//
// `pessoa` ia junto com `userId`, e com ela saiu uma ida ao banco: a consulta
// buscava os `profiles` de todos os responsáveis do mês para desenhar o avatar
// de quem estava fora e a segunda linha do chip. As duas peças eram da
// ausência.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// `diaNaGrade()` SAIU COM A CAMPANHA (0105), e o registro fica porque a
// decisão pode voltar.
//
// Ela era o único lugar onde morava a escolha de QUAL dia a grade do mês
// pinta, e existia por causa de UMA origem: a campanha. A view carregava o
// período inteiro — a Wave começa dia 1 e acaba dia 30, e é dela que o `.ics`
// monta o evento de trinta dias que a pessoa assina no Google —, e a grade a
// desenhava no dia em que ela ACABA, porque trinta células empurrariam para
// baixo tudo o que acontece em cada uma.
//
// Com a campanha fora da view não há mais duas respostas para a mesma
// pergunta: o evento ocupa os dias dele, do início ao fim. A função seria um
// `if` que nunca é verdadeiro — e um ramo morto num lugar que decide desenho é
// o que alguém reaproveita achando que ele ainda escolhe alguma coisa.
//
// **O argumento FICA de pé**, e é o que importa guardar: no dia em que uma
// origem de período longo voltar a esta view, é aqui que a escolha mora, e não
// espalhada entre a grade e o arquivo — senão as duas discordam sobre a mesma
// linha.
// ---------------------------------------------------------------------------

/** O item ocupa este dia? */
export function ocupaODia(item: ItemDoCalendario, dia: string): boolean {
  return dia >= item.dataInicio && dia <= item.dataFim;
}

/** Mais de um dia: é faixa no topo da semana, e não item da lista do dia. */
export function ehFaixa(item: ItemDoCalendario): boolean {
  return item.dataFim > item.dataInicio;
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
      // O TIPO DO EVENTO, e não mais o nome da camada: com uma origem só,
      // `CATEGORIES:Eventos` em toda linha é uma categoria que não categoriza.
      // "Feira", "Convenção" e "Feriado do cliente" é o que o Google mostra.
      `CATEGORIES:${escapar(rotuloDoEvento(item))}`,
    );
    if (item.cliente) linhas.push(`DESCRIPTION:${escapar(item.cliente)}`);
    linhas.push("END:VEVENT");
  }

  linhas.push("END:VCALENDAR");
  return linhas.join("\r\n");
}
