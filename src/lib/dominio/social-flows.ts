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
 * não sabia sugerir nada para uma etapa que alguém acrescentou, então as duas
 * pontas passaram a viajar com o FLUXO. O que sobrou aqui é o que não é dado:
 * os rótulos, a conta de data, e o molde do fluxo novo.
 */

/** Um elo, do jeito que `etapas_do_fluxo()` o devolve e a tela o edita. */
export type EtapaDoFluxo = {
  ordem: number;
  nome: string;
  funcao: TeamFuncao;
  papel: SocialFlowPapel;
  aprovacao_cliente: boolean;
  campo: string | null;
  comeca_dias_antes: number | null;
  termina_dias_antes: number | null;
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
  entrega:
    "É aqui que o material sai da agência e o cliente decide. Uma por fluxo, e ela não se marca à mão.",
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
    campo: "pauta",
    comeca_dias_antes: 31,
    termina_dias_antes: 27,
  },
  {
    nome: "Conteúdo",
    funcao: "Redator",
    papel: "producao",
    aprovacao_cliente: false,
    campo: "legenda",
    comeca_dias_antes: 26,
    termina_dias_antes: 20,
  },
  {
    nome: "Layout",
    funcao: "Design",
    papel: "producao",
    aprovacao_cliente: false,
    campo: null,
    comeca_dias_antes: 19,
    termina_dias_antes: 12,
  },
  {
    nome: "Envio",
    funcao: "Gestao",
    papel: "entrega",
    aprovacao_cliente: false,
    campo: null,
    comeca_dias_antes: 11,
    termina_dias_antes: 7,
  },
  {
    nome: "Programar",
    funcao: "Social Media",
    papel: "pos_entrega",
    aprovacao_cliente: false,
    campo: null,
    comeca_dias_antes: 6,
    termina_dias_antes: 2,
  },
];

/**
 * O dia sugerido de uma etapa, a partir do mês que está sendo aberto (0083).
 *
 * **Sem `Date` do navegador para a conta do calendário**: `new Date("2027-11")`
 * é interpretado como UTC e `getDate()` devolve o dia no fuso de quem está
 * olhando — a mesma armadilha que `hojeNaAgencia()` existe para fechar. A conta
 * é feita em UTC de ponta a ponta e o resultado sai como texto `AAAA-MM-DD`,
 * que é o que o `<input type="date">` e o Postgres falam.
 *
 * Esta função era `diaSugeridoDaEtapa` em `lib/dominio/posts.ts`; ela mudou de
 * casa porque os dias passaram a sair do fluxo, e não de uma lista fixa.
 */
export function diaSugeridoDaEtapa(mes: string, diasAntesDoMes: number | null): string {
  if (diasAntesDoMes === null || !Number.isFinite(diasAntesDoMes)) return "";
  const [ano, m] = mes.split("-").map(Number);
  if (!Number.isFinite(ano) || !Number.isFinite(m)) return "";
  const d = new Date(Date.UTC(ano, m - 1, 1));
  d.setUTCDate(d.getUTCDate() - diasAntesDoMes);
  return d.toISOString().slice(0, 10);
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
    return "Falta a etapa de entrega ao cliente: é nela que o material sai da agência.";
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
 * **A ENTREGA FICA DE FORA**, e não é descuido: `p_responsaveis` distribui o
 * trabalho de quem produz, e a entrega não é trabalho de ninguém — ela é
 * consequência da rodada de escopo cliente (0032), e o dono dela é a gestão
 * desde a 0007. Oferecer um campo para ela seria pedir uma escolha que o
 * produto ignora.
 */
export function funcoesDoFluxo(
  etapas: EtapaDoFluxo[],
): { funcao: TeamFuncao; etapas: string }[] {
  const porFuncao = new Map<TeamFuncao, string[]>();
  for (const e of etapas) {
    if (e.papel === "entrega") continue;
    const lista = porFuncao.get(e.funcao) ?? [];
    lista.push(e.nome);
    porFuncao.set(e.funcao, lista);
  }
  return [...porFuncao].map(([funcao, nomes]) => ({
    funcao,
    etapas: nomes.join(" e "),
  }));
}
