import type {
  AlertaDeCarga,
  ConfigDoFeedback,
  LinhaDaFila,
  Pessoa,
  RelatorioDeFeedback,
  RespostaDoFeedback,
} from "@/lib/dominio/feedback";
import type { FeedbackPeriodicidade } from "@/lib/supabase/database.types";

/**
 * O FEEDBACK DE DESENVOLVIMENTO, no protótipo.
 *
 * ---------------------------------------------------------------------------
 * **AS MÉTRICAS DE EXEMPLO SÃO COERENTES ENTRE SI**, e isso não é zelo: a tela
 * de revisão existe para conferir se o texto bate com os números, e um stub com
 * números aleatórios produziria uma imagem em que a conferência FALHA — quem
 * olhasse a imagem concluiria que a tela está errada.
 *
 * Então 14 concluídas, 12 com prazo, 10 dentro dele (83,3%), e o texto abaixo
 * cita exatamente esses números. É a mesma exigência que o produto faz do
 * modelo de verdade.
 * ---------------------------------------------------------------------------
 *
 * **E O RASCUNHO DA OUTRA PESSOA NÃO ENTRA AQUI**, porque o protótipo troca a
 * camada de dados por exemplos e não testa RLS — uma imagem mostrando que a
 * pessoa não vê o rascunho provaria apenas que este arquivo não o devolveu.
 * Quem prova isso é `supabase/testes/38_feedback_de_desenvolvimento.sql`, contra
 * um Postgres de verdade.
 */

// OS TIPOS NAO SAO REEXPORTADOS AQUI, e a ausencia e a correcao de um bug meu.
//
// Este caminho E o stub durante a rodada do prototipo, entao um
// `export type { X } from "@/lib/dados/feedback"` aqui dentro e uma definicao
// CIRCULAR -- "Circular definition of import alias". O `typecheck` nao ve,
// porque ele checa contra o modulo de verdade; quem pegou foi a compilacao do
// prototipo, dois minutos depois.
//
// A saida nao foi reexportar de outro lugar: foi dar UM DONO aos tipos.
// `lib/dominio/feedback.ts` nao e remapeado, `src/` os pega de la, e
// `lib/dados/feedback.ts` nao os reexporta -- porque se reexportasse, o
// `check:prototipo` voltaria a cobra-los daqui.

/**
 * O PERIODO DO EXEMPLO E O MES ANTERIOR FECHADO, contado de hoje -- e nao uma
 * data literal.
 *
 * A imagem mostrou por que: com "abril de 2027" fixo no stub, o seletor da tela
 * (que oferece os doze periodos fechados a partir de hoje) dizia um mes e o
 * painel de numeros dizia outro, lado a lado. Quem olhasse a imagem leria isso
 * como um bug da tela -- e o protótipo existe justamente para essa leitura. E a
 * mesma razao da data de entrada relativa no seed.
 */
const HOJE = new Date();
const dois = (n: number) => String(n).padStart(2, "0");
const INICIO_DATE = new Date(
  Date.UTC(HOJE.getUTCFullYear(), HOJE.getUTCMonth() - 1, 1),
);
const FIM_DATE = new Date(Date.UTC(HOJE.getUTCFullYear(), HOJE.getUTCMonth(), 0));
const ANTERIOR_FIM = new Date(
  Date.UTC(INICIO_DATE.getUTCFullYear(), INICIO_DATE.getUTCMonth(), 0),
);
const DIAS = Math.round(
  (FIM_DATE.getTime() - INICIO_DATE.getTime()) / 86400000 + 1,
);
const ANTERIOR_INICIO = new Date(
  ANTERIOR_FIM.getTime() - (DIAS - 1) * 86400000,
);
const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;

const PERIODO_INICIO = iso(INICIO_DATE);
const PERIODO_FIM = iso(FIM_DATE);
/** Dois dias depois do fim do período: é quando a revisão aconteceria. */
const DEPOIS_DO_FIM = new Date(
  FIM_DATE.getTime() + 2 * 86400000,
).toISOString();

const CARLA: Pessoa = {
  id: "33333333-3333-3333-3333-333333333333",
  nome: "Carla Nunes",
  avatar_url: null,
};

const ANA: Pessoa = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Souza",
  avatar_url: null,
};

const BRUNO: Pessoa = {
  id: "44444444-4444-4444-4444-444444444444",
  nome: "Bruno Lima",
  avatar_url: null,
};

const METRICAS = {
  periodo: { inicio: PERIODO_INICIO, fim: PERIODO_FIM, dias: DIAS },
  entrega: {
    concluidas: 14,
    com_prazo: 12,
    no_prazo: 10,
    fora_do_prazo: 2,
    sem_prazo: 2,
    taxa_no_prazo: 83.3,
    dias_de_atraso_media: 2.5,
    minutos_reais: 2400,
  },
  em_aberto_atrasadas: 1,
  por_workflow: [
    { nome: "Post de feed", concluidas: 8 },
    { nome: "Campanha", concluidas: 6 },
  ],
  por_cliente: [
    { nome: "Mundo Verde", concluidas: 9 },
    { nome: "Óptica Visão", concluidas: 5 },
  ],
  periodo_anterior: {
    inicio: iso(ANTERIOR_INICIO),
    fim: iso(ANTERIOR_FIM),
    concluidas: 9,
    com_prazo: 8,
    no_prazo: 5,
    taxa_no_prazo: 62.5,
    minutos_reais: 1800,
  },
  calibracao: {
    etapas_medidas: 12,
    minutos_estimados: 1800,
    minutos_reais: 2400,
    desvio_percentual: 33.3,
    tendencia: "subestima",
  },
  calibracao_por_workflow: [
    { nome: "Campanha", etapas: 6, desvio_percentual: 48.0 },
    { nome: "Post de feed", etapas: 6, desvio_percentual: 12.0 },
  ],
  qualidade: {
    conteudos_decididos: 7,
    aprovados_de_prima: 5,
    taxa_de_prima: 71.4,
    rodadas_media: 1.4,
  },
  palavras_nos_pedidos_de_ajuste: [
    { palavra: "logo", vezes: 3 },
    { palavra: "rodape", vezes: 2 },
  ],
  desenvolvimento: {
    trilhas: [{ titulo: "Redação para redes", materiais_concluidos: 3 }],
    etiquetas_estudadas: ["Copywriting"],
    workflows_novos: ["Campanha"],
  },
};

const CONTEXTO = {
  ausencia: {
    dias_fora: 3,
    dias_uteis_no_periodo: 21,
    proporcao_fora: 14.3,
    por_tipo: [{ tipo: "ausente", dias: 3 }],
  },
  carga: {
    minutos_comprometidos: 8400,
    capacidade_minutos_dia: 480,
    dias_uteis: 21,
    etapas_datadas: 12,
    etapas_sem_estimativa: 0,
    proporcao_da_capacidade: 83.3,
  },
  espera_por_aprovacao: {
    horas_interna: 12,
    horas_cliente: 40,
    rodadas_ainda_pendentes: 1,
  },
  clientes_com_retrabalho: [],
  ressalvas: [],
};

const TEXTO = `No período você fechou 14 etapas, 12 delas com prazo combinado, e 10 saíram dentro da data. Foram 2400 minutos de trabalho registrado, com 3 dias fora no período.

Comparando com o seu período anterior, a entrega subiu de 9 para 14 etapas e a taxa dentro do prazo passou de 62.5 para 83.3. As duas que saíram fora venceram em média 2.5 dias depois da data.

Duas coisas com espaço para crescer. A primeira é a estimativa: nas 12 etapas em que havia estimativa e tempo medido, a soma estimada foi de 1800 minutos contra 2400 de tempo real, um desvio de 33.3 para cima — e em Campanha ele chega a 48.0. Vale reservar uma folga ao datar as etapas desse tipo. A segunda é o retorno do cliente: das 7 peças decididas, 5 passaram de primeira, e as outras somaram 40 horas de espera do lado dele.

Como você concluiu 3 materiais da trilha Redação para redes neste período, o caminho natural é fechá-la antes de pegar a próxima.`;

const ENVIADO: RelatorioDeFeedback = {
  id: "f0000000-0000-0000-0000-000000000001",
  user_id: CARLA.id,
  periodo_inicio: PERIODO_INICIO,
  periodo_fim: PERIODO_FIM,
  periodicidade: "mensal",
  metricas_json: METRICAS,
  contexto_json: CONTEXTO,
  texto_gerado: TEXTO,
  texto_final: TEXTO,
  modelo_usado: "claude-opus-5-5",
  prompt_versao: "3h.1",
  alertas_json: [],
  status: "enviado",
  revisado_por: ANA.id,
  revisado_em: DEPOIS_DO_FIM,
  enviado_em: DEPOIS_DO_FIM,
  created_at: DEPOIS_DO_FIM,
  updated_at: DEPOIS_DO_FIM,
  pessoa: CARLA,
  revisor: ANA,
};

/**
 * O RASCUNHO COM ALERTA, e ele é a imagem que mais importa da tela de revisão:
 * a faixa de achados da verificação automática só existe quando há um, e uma
 * rodada em que todo relatório sai limpo fotografaria a tela sem ela.
 *
 * O texto carrega uma comparação com a equipe de propósito — é exatamente o que
 * a verificação pega, e o alerta abaixo diz isso com as palavras do produto.
 */
const COM_ALERTA: RelatorioDeFeedback = {
  ...ENVIADO,
  id: "f0000000-0000-0000-0000-000000000002",
  user_id: BRUNO.id,
  texto_gerado: TEXTO.replace(
    "No período você fechou 14 etapas",
    "No período você fechou 14 etapas, acima da média da equipe",
  ),
  texto_final: TEXTO.replace(
    "No período você fechou 14 etapas",
    "No período você fechou 14 etapas, acima da média da equipe",
  ),
  alertas_json: [
    {
      tipo: "comparacao",
      frase:
        'O texto compara esta pessoa com outras ("média da equipe"). A única comparação permitida é com o período anterior dela.',
    },
  ],
  status: "rascunho",
  revisado_por: null,
  revisado_em: null,
  enviado_em: null,
  pessoa: BRUNO,
  revisor: null,
};

const RESPOSTAS: RespostaDoFeedback[] = [
  {
    id: "f0000000-0000-0000-0000-0000000000a1",
    report_id: ENVIADO.id,
    autor_id: CARLA.id,
    texto:
      "Nesse mês eu peguei duas campanhas que não estavam combinadas, e é isso que explica a conta de tempo. Podemos conversar sobre a distribuição?",
    created_at: DEPOIS_DO_FIM,
    autor: CARLA,
  },
  {
    id: "f0000000-0000-0000-0000-0000000000a2",
    report_id: ENVIADO.id,
    autor_id: ANA.id,
    texto: "Faz sentido. Vamos rever a distribuição na reunião de segunda.",
    created_at: DEPOIS_DO_FIM,
    autor: ANA,
  },
];

const ALERTAS: AlertaDeCarga[] = [
  {
    id: "f0000000-0000-0000-0000-0000000000b1",
    user_id: BRUNO.id,
    periodo_inicio: PERIODO_INICIO,
    periodo_fim: PERIODO_FIM,
    tipo: "sobrecarga",
    detalhes: { proporcao: 148, proporcao_periodo_anterior: 121 },
    resolvido: false,
    created_at: DEPOIS_DO_FIM,
    pessoa: BRUNO,
  },
];

export async function filaDoPeriodo(
  _de: string,
  _ate: string,
  _periodicidade: FeedbackPeriodicidade,
): Promise<{ fila: LinhaDaFila[]; relatorios: RelatorioDeFeedback[] }> {
  return {
    fila: [
      {
        userId: BRUNO.id,
        nome: BRUNO.nome,
        concluidas: 11,
        jaTem: true,
        statusAtual: "rascunho",
        relatorioId: COM_ALERTA.id,
      },
      {
        userId: CARLA.id,
        nome: CARLA.nome,
        concluidas: 14,
        jaTem: true,
        statusAtual: "enviado",
        relatorioId: ENVIADO.id,
      },
      // QUEM AINDA NÃO TEM RELATÓRIO, para o botão "Gerar" aparecer em alguma
      // linha: sem ela a imagem mostra a fila inteira já resolvida, que é o
      // estado do fim do mês e não o do dia em que alguém abre a tela.
      {
        userId: "55555555-5555-5555-5555-555555555555",
        nome: "Marina Costa",
        concluidas: 9,
        jaTem: false,
        statusAtual: null,
        relatorioId: null,
      },
      // E QUEM NÃO TEM DADO SUFICIENTE, que é o caso que a tela precisa
      // explicar em vez de esconder.
      {
        userId: "66666666-6666-6666-6666-666666666666",
        nome: "Rafael Dias",
        concluidas: 2,
        jaTem: false,
        statusAtual: null,
        relatorioId: null,
      },
    ],
    relatorios: [COM_ALERTA, ENVIADO],
  };
}

export async function relatorioComConversa(id: string): Promise<{
  relatorio: RelatorioDeFeedback;
  respostas: RespostaDoFeedback[];
} | null> {
  if (id === COM_ALERTA.id) return { relatorio: COM_ALERTA, respostas: [] };
  return { relatorio: ENVIADO, respostas: RESPOSTAS };
}

export async function meusFeedbacks(): Promise<RelatorioDeFeedback[]> {
  return [ENVIADO];
}

export async function feedbackNovoParaMim(): Promise<{
  id: string;
  periodoInicio: string;
} | null> {
  return { id: ENVIADO.id, periodoInicio: ENVIADO.periodo_inicio };
}

export async function alertasDeCarga(
  _de: string,
  _incluirResolvidos?: boolean,
): Promise<AlertaDeCarga[]> {
  return ALERTAS;
}

export async function alertasAbertos(): Promise<AlertaDeCarga[]> {
  return ALERTAS;
}

export async function configDoFeedback(): Promise<ConfigDoFeedback | null> {
  return {
    id: "f0000000-0000-0000-0000-0000000000c1",
    unica: true,
    periodicidade: "mensal",
    revisor_id: ANA.id,
    exige_revisao: true,
    minimo_subtarefas: 5,
    atualizado_por: ANA.id,
    updated_at: DEPOIS_DO_FIM,
    revisor: ANA,
  };
}

export async function minhaEscolhaDeFeedback(): Promise<{
  recebe: boolean;
  explicadoEm: string | null;
}> {
  return { recebe: true, explicadoEm: DEPOIS_DO_FIM };
}

export async function metricasEContexto(): Promise<{
  metricas: unknown;
  contexto: unknown;
}> {
  return { metricas: METRICAS, contexto: CONTEXTO };
}

export async function gestoresAtivos(): Promise<Pessoa[]> {
  return [ANA, { id: "22222222-2222-2222-2222-222222222222", nome: "Diego Reis", avatar_url: null }];
}
