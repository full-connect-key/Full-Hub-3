/**
 * O relatório de desempenho do social, competência a competência (0150).
 *
 * Decisão do usuário, item 17: *"gostaria que no Social Media, aparecesse um
 * relatório preenchido com os dados do social, como visualização, curtidas e
 * afins, para o cliente ter essas informações o tempo todo (…), isso pode ser
 * preenchido pela social media, ou ser interligado com as redes sociais do
 * cliente para contabilizar automaticamente"*. E o item 18:
 * *"podemos passar essa parte de social, para uma aba a parte de relatórios,
 * para permitir que os dados sejam editados pela social. e de preferência que
 * os dados apareçam sempre quando forem positivos"*.
 *
 * ---------------------------------------------------------------------------
 * **A FRASE DELE OFERECE DOIS CAMINHOS E O ITEM 18 ESCOLHE UM**, duas
 * sentenças depois: *"para permitir que os dados sejam editados pela social"*.
 * Então o que existe é o relatório que a social media PREENCHE, e a
 * integração automática fica escrita como o que ela precisa e não tem — um
 * token OAuth da Graph API da Meta por conta, renovado a cada 60 dias, com a
 * página do Facebook ligada ao perfil profissional do Instagram. No dia em
 * que ele existir, o que ele escreve entra pela MESMA tabela, e é por isso
 * que `fonte` é coluna desde o primeiro dia.
 *
 * ---------------------------------------------------------------------------
 * **"QUE OS DADOS APAREÇAM SEMPRE QUANDO FOREM POSITIVOS" É SOBRE A
 * COMPARAÇÃO, nunca sobre o número.** A leitura literal — esconder o número
 * ruim — faria o relatório ser propaganda: o cliente abriria outubro, veria
 * seis métricas, abriria novembro e veria quatro, sem nada dizendo que as
 * outras duas caíram. **O número aparece sempre.** O que só aparece quando é
 * ganho é o **selo de variação** contra o mês anterior.
 *
 * ***E a queda não é escondida, o que é dito em vez de disfarçado:*** o mês
 * anterior continua publicado e alcançável — a tela navega de uma competência
 * à outra, que é o que ele pediu. O que o produto deixa de fazer é ANUNCIAR a
 * queda
 * com um selo vermelho ao lado do número; quem quer comparar abre o mês
 * anterior, que é onde a comparação é honesta porque ela traz os dois.
 * ---------------------------------------------------------------------------
 */

import type {
  Database,
  FonteDaMetrica,
  MetricaSocial,
  PlataformaSocial,
} from "@/lib/supabase/database.types";

import {
  competenciaDoMes,
  hojeNaAgencia,
  mesDaCompetencia,
  mesPorExtenso,
} from "./datas";
import { deslocarMes } from "./posts";

export type RelatorioDoSocial =
  Database["public"]["Tables"]["social_reports"]["Row"];
export type NumeroDoRelatorio =
  Database["public"]["Tables"]["social_report_metrics"]["Row"];

export type { FonteDaMetrica, MetricaSocial };

/**
 * O QUE SE MEDE, em ordem, com o rótulo que a tela escreve.
 *
 * **A ORDEM É A DO FUNIL e não a alfabética**: alcance e impressões dizem
 * quanta gente viu, visualizações e as quatro interações dizem quem reagiu,
 * cliques e visitas dizem quem foi atrás, e seguidores é o que sobrou disso
 * no fim do mês. É a mesma razão pela qual a corrente do social tem `ordem`
 * com folga em vez de nome: a sequência é informação.
 *
 * **E `estoque` É O CAMPO QUE DECIDE O DESENHO.** Nove das dez são FLUXO — o
 * alcance de outubro é o alcance de outubro —, e `seguidores` é o total
 * daquele instante: somá-lo com o de setembro dá um número que não existe, e
 * a variação dele não é "cresceu 12%", é "entraram 340". A tela lê este campo
 * para escolher a frase; o banco não o guarda, porque ele não varia por linha
 * e uma coluna seria a segunda verdade sobre a mesma métrica.
 */
export const METRICAS_DO_SOCIAL: {
  chave: MetricaSocial;
  rotulo: string;
  /** A frase embaixo do campo, na tela de quem digita. */
  ajuda: string;
  /** Total daquele instante (seguidores) em vez de soma do mês. */
  estoque: boolean;
}[] = [
  {
    chave: "alcance",
    rotulo: "Alcance",
    ajuda: "Quantas contas diferentes viram o conteúdo no mês.",
    estoque: false,
  },
  {
    chave: "impressoes",
    rotulo: "Impressões",
    ajuda: "Quantas vezes o conteúdo foi exibido, somando repetições.",
    estoque: false,
  },
  {
    chave: "visualizacoes",
    rotulo: "Visualizações",
    ajuda: "Reproduções de vídeo, Reels e stories.",
    estoque: false,
  },
  {
    chave: "curtidas",
    rotulo: "Curtidas",
    ajuda: "Somando todas as publicações do mês.",
    estoque: false,
  },
  {
    chave: "comentarios",
    rotulo: "Comentários",
    ajuda: "Somando todas as publicações do mês.",
    estoque: false,
  },
  {
    chave: "compartilhamentos",
    rotulo: "Compartilhamentos",
    ajuda: "Quantas vezes alguém enviou o conteúdo adiante.",
    estoque: false,
  },
  {
    chave: "salvamentos",
    rotulo: "Salvamentos",
    ajuda: "Quantas vezes o conteúdo foi salvo para depois.",
    estoque: false,
  },
  {
    chave: "cliques",
    rotulo: "Cliques no link",
    ajuda: "Cliques na bio, no link do story ou no botão.",
    estoque: false,
  },
  {
    chave: "visitas_perfil",
    rotulo: "Visitas ao perfil",
    ajuda: "Quantas vezes alguém abriu o perfil.",
    estoque: false,
  },
  {
    chave: "seguidores",
    rotulo: "Seguidores",
    ajuda: "O total no fim do mês — este é um saldo, não uma soma.",
    estoque: true,
  },
];

export const ROTULO_DA_METRICA = Object.fromEntries(
  METRICAS_DO_SOCIAL.map((m) => [m.chave, m.rotulo]),
) as Record<MetricaSocial, string>;

const ESTOQUE = new Set(
  METRICAS_DO_SOCIAL.filter((m) => m.estoque).map((m) => m.chave),
);

export function ehEstoque(metrica: MetricaSocial): boolean {
  return ESTOQUE.has(metrica);
}

/**
 * UMA CHECAGEM NO CARREGAMENTO DO MÓDULO, e ela é a mesma do seletor de
 * status: sem ela, um valor novo em `metrica_social` sumiria da tela sem erro
 * e sem aviso — o número existiria no banco e não apareceria em lugar nenhum.
 */
const TODAS: MetricaSocial[] = [
  "alcance",
  "impressoes",
  "visualizacoes",
  "curtidas",
  "comentarios",
  "compartilhamentos",
  "salvamentos",
  "cliques",
  "visitas_perfil",
  "seguidores",
];
for (const m of TODAS) {
  if (!ROTULO_DA_METRICA[m]) {
    throw new Error(
      `A métrica "${m}" existe no enum do banco e não está em METRICAS_DO_SOCIAL.`,
    );
  }
}

/** `2026-10-01` → `2026-10`, que é o `?mes=` do módulo de Social. */
export { competenciaDoMes, mesDaCompetencia, mesPorExtenso };

/**
 * O número formatado para a tela.
 *
 * **`pt-BR` com separador de milhar e nunca abreviado**: "12,4 mil" esconde a
 * diferença entre 12.400 e 12.449, e o relatório existe justamente para o
 * cliente ter o número. Quem compacta é o eixo de um gráfico, não a linha de
 * um relatório.
 */
export function numeroNaTela(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

export type VariacaoDaMetrica = {
  /** A diferença absoluta. Sempre positiva — só o ganho é desenhado. */
  diferenca: number;
  /** A diferença em pontos percentuais, quando o mês anterior não era zero. */
  percentual: number | null;
  /** A frase do selo: "+340 seguidores" ou "+18% no alcance". */
  frase: string;
};

/**
 * O GANHO CONTRA O MÊS ANTERIOR — e `null` em todo outro caso.
 *
 * ---------------------------------------------------------------------------
 * **É AQUI QUE O ITEM 18 MORA**, e são quatro casos que devolvem `null`, cada
 * um por uma razão própria:
 *
 *   não há mês anterior      — o primeiro relatório não compara com nada, e
 *                              um "+100%" contra o vazio é um número inventado
 *   o anterior não foi publicado — ele é rascunho; comparar com um número que
 *                              a social media ainda está digitando daria um
 *                              selo que muda sozinho
 *   caiu                     — o pedido em quantas palavras
 *   empatou                  — "+0%" é ruído: o selo existe para dizer que
 *                              subiu, e zero não diz isso
 *
 * **O PERCENTUAL SAI DE ZERO, e aí fica a diferença absoluta sozinha**:
 * dividir por zero daria `Infinity`, e "+∞%" na tela de um cliente é a conta
 * aparecendo crua. Numa métrica que estava em zero, o que informa é o número
 * que ela passou a ser.
 *
 * **E NO ESTOQUE A FRASE É O ABSOLUTO**, nunca a porcentagem: "+340
 * seguidores" é o que a agência diz em voz alta, e "+2% nos seguidores" sobre
 * uma base de dezessete mil é um número que não decide nada.
 * ---------------------------------------------------------------------------
 */
export function variacaoDaMetrica(
  metrica: MetricaSocial,
  atual: number,
  anterior: number | null,
): VariacaoDaMetrica | null {
  if (anterior === null) return null;
  const diferenca = atual - anterior;
  if (diferenca <= 0) return null;

  const percentual =
    anterior > 0 ? Math.round((diferenca / anterior) * 100) : null;

  if (ehEstoque(metrica) || percentual === null) {
    return {
      diferenca,
      percentual,
      frase: `+${numeroNaTela(diferenca)}`,
    };
  }
  return { diferenca, percentual, frase: `+${percentual}%` };
}

/** Uma linha do relatório: uma métrica, numa rede, com o mês anterior ao lado. */
export type LinhaDoRelatorio = {
  plataforma: PlataformaSocial;
  metrica: MetricaSocial;
  rotulo: string;
  valor: number;
  fonte: FonteDaMetrica;
  /** O mesmo par no mês anterior PUBLICADO, quando existe. */
  anterior: number | null;
  variacao: VariacaoDaMetrica | null;
};

/** A chave de um par (rede, métrica), que é o `unique` da tabela. */
export function chaveDoNumero(
  plataforma: PlataformaSocial,
  metrica: MetricaSocial,
): string {
  return `${plataforma}|${metrica}`;
}

/**
 * Junta os números de um mês com os do anterior, agrupados por REDE.
 *
 * **A REDE MANDA, e a ordem dentro dela é a do funil**: o relatório de uma
 * conta que posta em três redes são três blocos, e dentro de cada um a mesma
 * sequência — sem isso, a mesma métrica apareceria em posições diferentes de
 * um bloco para o outro, e comparar o Instagram com o Facebook passaria a
 * exigir procurar a linha.
 *
 * **E SÓ A REDE QUE TEM NÚMERO APARECE.** Dez linhas vazias por rede que a
 * conta não usa é a aba "Site" do cronograma outra vez: a pessoa procura o
 * que elas querem dizer, não acha, e passa a desconfiar do resto.
 */
export function montarRelatorio(
  numeros: NumeroDoRelatorio[],
  anteriores: NumeroDoRelatorio[] = [],
): { plataforma: PlataformaSocial; linhas: LinhaDoRelatorio[] }[] {
  const antes = new Map(
    anteriores.map((n) => [chaveDoNumero(n.plataforma, n.metrica), n.valor]),
  );
  const porRede = new Map<PlataformaSocial, Map<MetricaSocial, NumeroDoRelatorio>>();

  for (const n of numeros) {
    const rede = porRede.get(n.plataforma) ?? new Map();
    rede.set(n.metrica, n);
    porRede.set(n.plataforma, rede);
  }

  const blocos: { plataforma: PlataformaSocial; linhas: LinhaDoRelatorio[] }[] = [];
  for (const [plataforma, rede] of porRede) {
    const linhas: LinhaDoRelatorio[] = [];
    for (const m of METRICAS_DO_SOCIAL) {
      const n = rede.get(m.chave);
      if (!n) continue;
      const anterior = antes.get(chaveDoNumero(plataforma, m.chave)) ?? null;
      linhas.push({
        plataforma,
        metrica: m.chave,
        rotulo: m.rotulo,
        valor: n.valor,
        fonte: n.fonte,
        anterior,
        variacao: variacaoDaMetrica(m.chave, n.valor, anterior),
      });
    }
    if (linhas.length > 0) blocos.push({ plataforma, linhas });
  }
  return blocos;
}

/**
 * O relatório existe para o cliente?
 *
 * **A PERGUNTA É `publicado_em` E NÃO "tem número"**, e é a mesma que a policy
 * da 0150 faz: um relatório com nove números digitados e sem publicar é a
 * social media no meio do trabalho. A tela do portal não repete o filtro —
 * repetir seria o segundo lugar onde a regra pode divergir —, e esta função
 * existe para a tela de quem EDITA dizer em que pé o mês está.
 */
export function publicado(relatorio: RelatorioDoSocial | null): boolean {
  return Boolean(relatorio?.publicado_em);
}

export type EstadoDoRelatorio = "sem_relatorio" | "rascunho" | "publicado";

export function estadoDoRelatorio(
  relatorio: RelatorioDoSocial | null,
): EstadoDoRelatorio {
  if (!relatorio) return "sem_relatorio";
  return relatorio.publicado_em ? "publicado" : "rascunho";
}

/** O par nomeado de cada estado. Nunca opacidade. */
export const TOM_DO_ESTADO_DO_RELATORIO: Record<EstadoDoRelatorio, string> = {
  sem_relatorio: "bg-muted text-neutral",
  rascunho: "bg-warning-soft text-warning",
  publicado: "bg-success-soft text-success",
};

export const ROTULO_DO_ESTADO_DO_RELATORIO: Record<EstadoDoRelatorio, string> = {
  sem_relatorio: "Sem relatório",
  rascunho: "Rascunho",
  publicado: "Publicado",
};

/**
 * O mês anterior a um `?mes=` (`2026-10` → `2026-09`).
 *
 * **ELE CHAMA `deslocarMes` E NÃO REFAZ A CONTA**, que é a lição do array de
 * meses deste mesmo sprint: aquela função existe em `lib/dominio/posts.ts`
 * desde o Sprint 12, com seis chamadores, e ela já faz a aritmética sobre o
 * TEXTO — `new Date("2026-10")` é interpretado como UTC e, num fuso a oeste,
 * cai em setembro, então a comparação sairia contra o mês errado com o selo de
 * ganho afirmando o que não aconteceu.
 *
 * **O nome local fica** porque ele é a pergunta DESTE módulo — o item 18 é
 * sobre o mês anterior e não sobre deslocar meses —, e é a forma de
 * `rotuloDaCompetencia` no escopo: um valor, dois nomes.
 */
export function mesAnterior(mes: string): string {
  return deslocarMes(mes, -1);
}

/**
 * Os doze meses que o seletor do relatório oferece, do corrente para trás.
 *
 * ---------------------------------------------------------------------------
 * **DOZE E NÃO A LISTA DOS MESES QUE TÊM SOCIAL ABERTO**, e é a razão escrita
 * em `competenciasParaLancar` no escopo (0149) palavra por palavra: *a lista
 * do que existe não contém o mês que alguém está começando a preencher agora*.
 * Aqui ela é ainda mais apertada — o relatório é preenchido no FIM do mês, com
 * os números do Insights, e um seletor montado a partir de
 * `mesesDeSocialDaAgencia()` recusaria o mês de uma conta cujo social a
 * agência produz fora do Full Hub.
 *
 * **PARA TRÁS E NÃO PARA FRENTE, porque desempenho é um fato que já
 * aconteceu**: digitar o alcance do mês que vem é digitar o que ninguém viu
 * ainda.
 *
 * **E O MÊS É `YYYY-MM` e não a competência**, que é o vocabulário DESTE
 * módulo: `?mes=` do Social Media é o mês, e `competenciaDoMes()` é quem o
 * traduz para o dia 1 na hora de gravar. Devolver competência aqui obrigaria a
 * tela a converter de volta para montar o link.
 * ---------------------------------------------------------------------------
 */
export function mesesParaRelatar(agora: Date = new Date()): string[] {
  // O CORRENTE SAI DE `hojeNaAgencia()` e nunca de `toISOString()`: das 21h à
  // meia-noite do dia 30 o mês já virou em UTC, e o seletor abriria no mês que
  // vem — com todo campo em branco, no único dia em que alguém está fechando
  // os números do mês que acabou.
  const corrente = hojeNaAgencia(agora).slice(0, 7);
  return Array.from({ length: 12 }, (_, i) => deslocarMes(corrente, -i));
}
