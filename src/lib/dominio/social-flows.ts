import type { SocialFlowPapel, TeamFuncao } from "@/lib/supabase/database.types";

/**
 * Os fluxos de social: a corrente de etapas que os posts de um mês percorrem
 * (migration 0087).
 *
 * Decisão do usuário: *"algumas contas possuem um fluxo de aprovação
 * diferentes, por exemplo. Algumas contas validam pauta e conteúdo, antes de ir
 * para Produção de Layout. E após o layout feito, ele também vai para aprovação
 * do cliente. Preciso poder montar fluxos de Social diferentes, para serem
 * aplicados em determinados socials, de meses de determinadas contas"*.
 *
 * **ESTE ARQUIVO É O LADO DE CÁ DE `etapas_do_fluxo()`**, e os dois existem de
 * propósito, como `situacaoDoLancamento()` no Financeiro: o banco decide o que
 * uma corrente pode ser, estas funções decidem o que a tela desenha e sugere.
 *
 * **E ELE SUBSTITUIU `ETAPAS_DA_CORRENTE`**, que era a corrente escrita em
 * TypeScript — cinco etapas, com os dias sugeridos de cada uma. Aquela lista
 * não sabia sugerir nada para uma etapa que alguém acrescentou.
 *
 * **AS DUAS PONTAS CHEGARAM A VIAJAR COM O FLUXO, e saíram na 0089** — decisão
 * do usuário: *"tem uma aba começa quantos dias antes do mês, e termina quantos
 * dias antes do mês, não faz sentido, porque cada mês tem um prazo de fluxo
 * diferente, mas sempre que for aberto o social, o fluxo deve ter a mesma
 * sequência de ações"*. O fluxo responde o que acontece, em que ordem, por
 * quem; a data é do mês. O que ficou aqui é a SUGESTÃO, derivada da própria
 * sequência — e derivada ela serve a um fluxo de três elos e a um de dez sem
 * ninguém ter digitado número nenhum.
 */

/** Um elo, do jeito que `etapas_do_fluxo()` o devolve e a tela o edita. */
export type EtapaDoFluxo = {
  ordem: number;
  nome: string;
  funcao: TeamFuncao;
  papel: SocialFlowPapel;
  aprovacao_cliente: boolean;
  /**
   * SE ESTE ELO PASSA PELO AVAL INTERNO ANTES DE IR AO CLIENTE (0090).
   *
   * **Ela é INDEPENDENTE de `aprovacao_cliente`**, e as duas juntas são quatro
   * combinações legítimas: o elo que passa pelos dois, o que passa só pelo aval
   * interno (o normal), o que vai direto ao cliente sem revisão, e o que não
   * passa por ninguém. Nenhum `check` as amarra, de propósito.
   *
   * **Ela nasce `true`**, que é a decisão do default `publicada` da 0028:
   * esquecer o campo mantém o que já acontecia, e o erro contrário — uma conta
   * que para de exigir revisão sem ninguém ter decidido — não aparece em tela
   * nenhuma.
   */
  aprovacao_interna: boolean;
  campo: string | null;
};

export type FluxoDeSocial = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  etapas: EtapaDoFluxo[];
};

/**
 * O que cada papel quer dizer, em português.
 *
 * **O rótulo da entrega NÃO é "Envio"**, e a diferença importa: 'Envio' é o
 * NOME que o fluxo da casa deu àquele elo, e o papel é o que ele faz. Um fluxo
 * pode chamá-lo de "Entrega ao cliente" e continuar sendo a entrega — é
 * justamente por isso que o papel virou coluna.
 */
export const ROTULOS_DE_PAPEL: Record<SocialFlowPapel, string> = {
  producao: "Produção",
  entrega: "Entrega ao cliente",
  pos_entrega: "Depois da decisão",
};

/** A frase que explica o papel na tela do editor, embaixo do seletor. */
export const EXPLICACAO_DO_PAPEL: Record<SocialFlowPapel, string> = {
  producao:
    "Trabalho de alguém da equipe. Pode esperar o aval do cliente antes de a etapa seguinte começar.",
  // A ENTREGA É O ÚLTIMO AVAL, E PODE SER O PRÓPRIO TRABALHO — e a frase diz as
  // duas coisas porque a confusão delas é o que travava a tela: quem marca "o
  // cliente aprova" no último elo de produção está dizendo que ele é a entrega,
  // e o produto respondia que faltava uma. Marcar o papel é o que ele queria.
  entrega:
    "O último aval: aprovando esta etapa, o cliente fecha a peça e o que vem depois pode andar. Uma por fluxo — e ela pode ser o próprio trabalho, quando é nele que ele dá a palavra final.",
  pos_entrega:
    "Acontece depois de o cliente aprovar — a programação, por exemplo. Não espera aval dele.",
};

export const PAPEIS_DO_FLUXO: SocialFlowPapel[] = ["producao", "entrega", "pos_entrega"];

/**
 * Os dois campos do card que uma etapa pode encher (0046, virado coluna na
 * 0087).
 *
 * **São dois e não uma lista aberta**: o card tem `posts.pauta` e
 * `posts.legenda`, e um terceiro nome aqui seria uma etapa prometendo encher
 * uma coluna que não existe — o `check` do banco recusa.
 */
export const CAMPOS_DA_ETAPA = [
  { valor: "pauta", rotulo: "A pauta do post" },
  { valor: "legenda", rotulo: "A legenda do post" },
] as const;

export function rotuloDoCampo(campo: string | null): string {
  return CAMPOS_DA_ETAPA.find((c) => c.valor === campo)?.rotulo ?? "Nenhum";
}

/**
 * O MOLDE DE UM FLUXO NOVO: a corrente da casa.
 *
 * Ele existe porque um editor que abre em branco pede seis decisões antes de
 * qualquer coisa aparecer na tela — e a resposta certa para quase toda conta é
 * a corrente de sempre com um portão a mais. É "modelo é ponto de partida, não
 * contrato" (0033): daqui em diante a pessoa acrescenta, remove e renomeia.
 *
 * **Ele NÃO é a fonte da verdade da corrente da casa**, e a distinção é o que
 * a 0087 existe para fazer: aquela mora em `social_flow_steps`, no banco, e
 * pode ter sido editada. Esta lista é o esqueleto de um fluxo que ainda não
 * existe.
 */
export const MOLDE_DO_FLUXO: Omit<EtapaDoFluxo, "ordem">[] = [
  {
    nome: "Pauta",
    funcao: "Social Media",
    papel: "producao",
    aprovacao_cliente: false,
    aprovacao_interna: true,
    campo: "pauta",
  },
  {
    nome: "Conteúdo",
    funcao: "Redator",
    papel: "producao",
    aprovacao_cliente: false,
    aprovacao_interna: true,
    campo: "legenda",
  },
  {
    nome: "Layout",
    funcao: "Design",
    papel: "producao",
    aprovacao_cliente: false,
    aprovacao_interna: true,
    campo: null,
  },
  {
    nome: "Envio",
    funcao: "Gestao",
    papel: "entrega",
    aprovacao_cliente: false,
    aprovacao_interna: true,
    campo: null,
  },
  {
    nome: "Programar",
    funcao: "Social Media",
    papel: "pos_entrega",
    aprovacao_cliente: false,
    aprovacao_interna: true,
    campo: null,
  },
];

/**
 * A JANELA DA CORRENTE: ela fecha dois dias antes do dia 1, e tem trinta dias.
 *
 * Os dois números são da casa e não de um cálculo: a corrente do social é
 * feita no mês ANTERIOR ao que ela produz (0083), e o mês abre com o material
 * pronto. A folga de dois dias existe porque programar no dia 31 para o dia 1
 * não é prazo, é véspera.
 */
const FOLGA_ANTES_DO_MES = 2;
const DIAS_DA_CORRENTE = 30;

/**
 * O dia sugerido de uma etapa, a partir do mês que está sendo aberto (0083).
 *
 * **Sem `Date` do navegador para a conta do calendário**: `new Date("2027-11")`
 * é interpretado como UTC e `getDate()` devolve o dia no fuso de quem está
 * olhando — a mesma armadilha que `hojeNaAgencia()` existe para fechar. A conta
 * é feita em UTC de ponta a ponta e o resultado sai como texto `AAAA-MM-DD`,
 * que é o que o `<input type="date">` e o Postgres falam.
 *
 * **Ela é privada desde a 0089**, e a mudança é consequência: antes a tela
 * tinha um número por elo para converter, e agora ela tem uma sequência — quem
 * pergunta é `periodosSugeridosDoFluxo()`, e mais ninguém.
 */
function diaSugeridoDaEtapa(mes: string, diasAntesDoMes: number): string {
  if (!Number.isFinite(diasAntesDoMes)) return "";
  const [ano, m] = mes.split("-").map(Number);
  if (!Number.isFinite(ano) || !Number.isFinite(m)) return "";
  const d = new Date(Date.UTC(ano, m - 1, 1));
  d.setUTCDate(d.getUTCDate() - diasAntesDoMes);
  return d.toISOString().slice(0, 10);
}

/** As duas pontas de uma etapa da corrente, em texto de `<input type="date">`. */
export type PeriodoSugerido = { inicio: string; fim: string };

/**
 * OS PERÍODOS SUGERIDOS DE UMA CORRENTE, DERIVADOS DA PRÓPRIA SEQUÊNCIA.
 *
 * Migration 0089, decisão do usuário. Até ela cada elo guardava "começa N dias
 * antes" e "termina M dias antes" em `social_flow_steps`, e os dois eram a
 * resposta de uma pergunta que o fluxo não faz: um fluxo é o que acontece e em
 * que ordem, e "vinte dias antes" é um número que quem abre novembro escolhe
 * olhando o calendário de novembro.
 *
 * **O QUE A COLUNA PAGAVA CONTINUA PAGO, e é por isso que a sugestão ficou.**
 * O argumento da 0087 era real: `ETAPAS_DA_CORRENTE` sabia sugerir os dias das
 * cinco etapas que ela mesma listava e não saberia sugerir nada para uma etapa
 * acrescentada, e dez campos de data vazios fariam quem abre o mês inventar dez
 * datas na hora. O que estava errado não era sugerir, era GUARDAR a sugestão no
 * fluxo como se ela fosse parte do combinado — e ela é derivável: N elos
 * encostados dentro da janela que antecede o dia 1.
 *
 * **OS BLOCOS SE ENCOSTAM SEM SE SOBREPOR**, que é a decisão da 0084: a Pauta
 * fecha no dia em que o Conteúdo começa a correr. Quem quiser paralelismo
 * arrasta o início — os campos são editáveis, e é lá que a escolha mora.
 *
 * **E ELA SE ADAPTA À CONTAGEM DE ELOS, que é o ponto.** Cinco elos recebem seis
 * dias cada; três recebem dez; dez recebem três. Com mais elos que dias a janela
 * ESTICA em vez de dar blocos de meio dia — o piso de um dia por elo é o que
 * mantém `data_inicio <= prazo`, que o `check` de `subtasks` cobra, e os prazos
 * andando na mesma direção, que `abrir_mes_de_social` cobra.
 *
 * **Não há par no Postgres, e a ausência é decisão.** Isto não é
 * `situacaoDoLancamento()`, que decide o que contar nos dois lados: é uma
 * sugestão que aparece num campo editável antes de alguém salvar, e o banco
 * continua recebendo em `p_prazos` as datas que a pessoa confirmou.
 */
export function periodosSugeridosDoFluxo(
  mes: string,
  etapas: { nome: string }[],
): Record<string, PeriodoSugerido> {
  const total = etapas.length;
  if (total === 0) return {};
  const dias = Math.max(DIAS_DA_CORRENTE, total);
  const fatia = dias / total;
  const antesDoMes = (passos: number) =>
    FOLGA_ANTES_DO_MES + dias - Math.round(passos * fatia);

  return Object.fromEntries(
    etapas.map((e, i) => [
      e.nome,
      {
        inicio: diaSugeridoDaEtapa(mes, antesDoMes(i)),
        fim: diaSugeridoDaEtapa(mes, antesDoMes(i + 1)),
      },
    ]),
  );
}

/**
 * O que a 0087 chama de corrente coerente: produção*, entrega, pós-entrega*.
 *
 * **E ela é o lado de cá de `conferir_fluxo_de_social()`**, pela razão da
 * máquina de estados da subtarefa ao lado dos gatilhos da 0007: o banco é o que
 * vale, esta função desliga o botão Salvar e escreve a frase ANTES de a pessoa
 * clicar. Sem ela o editor ofereceria gravar uma corrente que o banco recusa, e
 * a recusa chegaria como um erro depois de seis campos preenchidos.
 *
 * Devolve `null` quando está tudo certo — a forma de `faltaParaEnviar()` no
 * Social Media.
 */
export function oQueFaltaNoFluxo(etapas: Omit<EtapaDoFluxo, "ordem">[]): string | null {
  if (etapas.length === 0) {
    return "Monte a corrente: o que acontece antes de enviar, a entrega ao cliente, e o que vem depois da decisão dele.";
  }

  const semNome = etapas.find((e) => !e.nome.trim());
  if (semNome) return "Toda etapa precisa de um nome.";

  const nomes = etapas.map((e) => e.nome.trim());
  const repetido = nomes.find((n, i) => nomes.indexOf(n) !== i);
  // O NOME REPETIDO NÃO É DETALHE: `p_prazos` é um mapa POR NOME desde a 0059,
  // e duas etapas homônimas receberiam o mesmo período.
  if (repetido) return `Há duas etapas chamadas "${repetido}".`;

  const entregas = etapas.filter((e) => e.papel === "entrega");
  if (entregas.length === 0) {
    // O ÚLTIMO ELO DE PRODUÇÃO QUE O CLIENTE APROVA, se houver: é nele que a
    // pessoa quase sempre está pensando quando tira o 'Envio' da corrente —
    // relato do usuário, *"essa etapa já está vinculada ao fato que o cliente
    // aprova a etapa de layout, que é a última de produção"*. A frase genérica
    // nomeava o que falta a quem acabou de marcar, na mesma tela, um
    // interruptor escrito "o cliente aprova esta etapa": as duas falam do
    // cliente, e a pessoa concluiu com razão que uma satisfazia a outra. Dizer
    // QUAL etapa marcar é a diferença entre uma recusa e uma instrução (0023).
    const portao = [...etapas]
      .reverse()
      .find((e) => e.papel === "producao" && e.aprovacao_cliente);

    if (portao) {
      return `Marcar "o cliente aprova" em ${portao.nome} não entrega o material. Se é nela que ele dá a palavra final, mude "O que é" dela para "Entrega ao cliente" — o nome continua o mesmo, e ela segue sendo o trabalho de quem a faz. Se depois dela ainda há um passo em que a gestão confere e manda, é esse passo que é a entrega.`;
    }

    return 'Falta dizer qual etapa é a entrega ao cliente: é nela que o material sai da agência e ele decide. Marque isso em "O que é".';
  }
  if (entregas.length > 1) {
    return `Há ${entregas.length} etapas de entrega, e a entrega é uma só.`;
  }

  const posicaoDaEntrega = etapas.findIndex((e) => e.papel === "entrega");
  const fora = etapas.filter(
    (e, i) =>
      (e.papel === "producao" && i > posicaoDaEntrega) ||
      (e.papel === "pos_entrega" && i < posicaoDaEntrega),
  );
  if (fora.length > 0) {
    return `${fora.map((e) => e.nome).join(", ")} está do lado errado da entrega.`;
  }

  return null;
}

/**
 * As funções que o fluxo pede, com as etapas que cada uma leva.
 *
 * **ISTO ERA DUAS CONSTANTES** — `FUNCOES_DA_CORRENTE` (`["Social Media",
 * "Redator", "Design"]`) e `ETAPAS_DA_FUNCAO` (`{"Design": "Layout e os
 * Ajustes que o cliente pedir"}`) —, escritas à mão em `lib/dominio/posts.ts`
 * porque a corrente era uma só. Com fluxos editáveis elas mentiriam no
 * primeiro fluxo que não usasse as três: o diálogo pediria um Redator a uma
 * conta cujo fluxo não tem etapa de texto, e não pediria ninguém para a etapa
 * que alguém acrescentou.
 *
 * **A ENTREGA FICOU DE FORA ATÉ A 0089, e entrou.** O argumento da 0087 era
 * que *"a entrega não é trabalho de ninguém: é consequência da rodada de escopo
 * cliente (0032), e o dono dela é a gestão desde a 0007"* — e isso descreve o
 * 'Envio' da casa, que é um elo sem trabalho. **Não vale como regra:** se a
 * entrega é trabalho ou não, quem diz é o FLUXO, pela função que alguém
 * escolheu nela — e o relato do usuário é exatamente o caso em que ela é, o
 * Layout que o cliente aprova.
 *
 * Desde a 0088 ela é uma subtarefa de verdade, com responsável, cronômetro e
 * carga, e **entrega sem dono não aparece no "Minhas Tasks" de ninguém** — o
 * pior tipo de trabalho gerado automaticamente, o que ninguém sabe que nasceu
 * (0041). De quebra isso conserta um aviso que mentia em todo mês aberto desde
 * a 0087: o 'Envio' da casa nascia com *"a conta não tem ninguém nessa
 * função"*, e a conta nunca tinha sido perguntada.
 *
 * **A regra agora é uma frase sem exceção: pergunta-se por toda função que o
 * fluxo nomeia.** É o que este arquivo prefere a um `if` com motivo.
 */
export function funcoesDoFluxo(
  etapas: EtapaDoFluxo[],
): { funcao: TeamFuncao; etapas: string }[] {
  const porFuncao = new Map<TeamFuncao, string[]>();
  for (const e of etapas) {
    const lista = porFuncao.get(e.funcao) ?? [];
    lista.push(e.nome);
    porFuncao.set(e.funcao, lista);
  }
  return [...porFuncao].map(([funcao, nomes]) => ({
    funcao,
    etapas: nomes.join(" e "),
  }));
}
