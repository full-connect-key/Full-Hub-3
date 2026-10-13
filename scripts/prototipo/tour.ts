/**
 * Versao de prototipo de src/lib/dados/tour.ts.
 *
 * ---------------------------------------------------------------------------
 * **O PADRAO E "JA FEZ", e sem isso o prototipo inteiro sai errado.** A leitura
 * de verdade devolve lista vazia quando a pessoa nunca comecou -- e lista vazia
 * faz o dialogo de boas-vindas abrir. Com um stub generico, as cento e
 * cinquenta telas sairiam com um dialogo centrado por cima: nenhuma delas
 * mostraria o que ela existe para mostrar, e as quatro do tour sairiam iguais
 * entre si.
 *
 * Quem decide e a FUNCAO que o gerador passa por ambiente -- a mesma forma de
 * `souDoAtendimento()` em `minhas-tasks.ts`, e nao `USUARIO_EXEMPLO.id`, que e
 * fixo: a pessoa logada vem de `NOMES[chaveDoUsuario()]` no stub de `dal.ts`, e
 * quem lesse o id do exemplo responderia o mesmo para todas as personas. (**Foi
 * a imagem que mostrou:** a primeira versao lia o id, e o dialogo nao saiu em
 * tela nenhuma -- as tres do tour sairam iguais as outras cento e cinquenta.)
 *
 *   * `Design`      -> Pedro Antunes, que nunca comecou: o dialogo abre;
 *   * `Audiovisual` -> Luiza Prado, que concluiu o tour: sem dialogo, e o
 *     bloco de Primeiros passos e o convite de micro-tour aparecem;
 *   * todo o resto concluiu tudo -> nada do tour na tela.
 * ---------------------------------------------------------------------------
 */
type TourStatus = "em_andamento" | "concluido" | "pulado";

export type LinhaDoAcompanhamentoDeTour = {
  userId: string;
  pessoa: string;
  role: "socio" | "desenvolvedor" | "colaborador" | "cliente";
  tourId: string | null;
  status: TourStatus | null;
  passoAtual: number | null;
  pulados: string[];
  semAncora: string[];
};

type ProgressoDeTour = {
  tourId: string;
  versao: number;
  status: TourStatus;
  passoAtual: number;
  finalizadoEm: string | null;
};

/** A mesma leitura do stub de `dal.ts`: o gerador passa a funcao por ambiente. */
function persona(): string {
  return process.env["PROTOTIPO_FUNCAO"] ?? "";
}

const FEITO = (tourId: string): ProgressoDeTour => ({
  tourId,
  versao: 1,
  status: "concluido",
  passoAtual: 0,
  finalizadoEm: "2027-01-10T12:00:00Z",
});

export async function meusTours(): Promise<ProgressoDeTour[]> {
  // QUEM ACABOU DE ENTRAR nao tem linha nenhuma -- nem do tour grande, nem de
  // micro-tour. E o estado do primeiro minuto.
  if (persona() === "Design") return [];

  // QUEM ESTA SE AMBIENTANDO ja fez o tour grande e nenhum micro-tour: e o
  // estado em que o convite do canto aparece num modulo.
  if (persona() === "Audiovisual") return [FEITO("painel")];

  return [
    FEITO("painel"),
    FEITO("portal"),
    FEITO("modulo:gestao-tasks"),
    FEITO("modulo:minhas-tasks"),
    FEITO("modulo:calendario"),
    FEITO("modulo:full-days"),
    FEITO("modulo:academy"),
    FEITO("modulo:comodatos"),
    FEITO("modulo:notas-fiscais"),
    FEITO("modulo:social-media"),
    FEITO("modulo:campanhas"),
    FEITO("modulo:financeiro"),
  ];
}

/**
 * O ACOMPANHAMENTO DA GESTAO, com os quatro estados que a tela existe para
 * mostrar -- e o quinto que ela existe para ALARMAR.
 *
 * **O passo sem ancora e o dado mais importante daqui**: ele e o alarme de tour
 * quebrado, e sem uma linha com ele a faixa em ambar nao sai em imagem nenhuma
 * -- que e justamente a peca que nenhuma outra tela do produto desenha.
 */
export async function acompanhamentoDosTours(): Promise<
  LinhaDoAcompanhamentoDeTour[]
> {
  return [
    {
      userId: "a0000000-0000-0000-0000-000000000001",
      pessoa: "Ana Souza",
      role: "socio" as const,
      tourId: "painel",
      status: "concluido" as const,
      passoAtual: 10,
      pulados: [],
      semAncora: [],
    },
    {
      userId: "a0000000-0000-0000-0000-000000000002",
      pessoa: "Diego Reis",
      role: "desenvolvedor" as const,
      tourId: "painel",
      status: "em_andamento" as const,
      passoAtual: 3,
      pulados: ["etapa"],
      // O MESMO PASSO EM DUAS PESSOAS, de proposito: o alarme agrega, e com uma
      // linha so ele diria "1 vez" -- o numero que decide se alguem vai
      // consertar o seletor.
      semAncora: ["workflows"],
    },
    {
      userId: "a0000000-0000-0000-0000-000000000003",
      pessoa: "Carla Nunes",
      role: "colaborador" as const,
      tourId: "painel",
      status: "em_andamento" as const,
      passoAtual: 3,
      pulados: [],
      semAncora: ["workflows"],
    },
    {
      userId: "a0000000-0000-0000-0000-000000000005",
      pessoa: "Marina Costa",
      role: "colaborador" as const,
      tourId: "painel",
      status: "pulado" as const,
      passoAtual: 0,
      pulados: [],
      semAncora: [],
    },
    // QUEM NUNCA COMECOU, com `tourId` nulo. E a linha que o `left join` da
    // 0101 existe para produzir, e a pessoa que a tela procura.
    {
      userId: "a0000000-0000-0000-0000-0000000000fe",
      pessoa: "Pedro Antunes",
      role: "colaborador" as const,
      tourId: null,
      status: null,
      passoAtual: null,
      pulados: [],
      semAncora: [],
    },
    // E O CLIENTE, porque o tour do portal e o unico que quebraria sem ninguem
    // notar -- a equipe nunca abre aquela area.
    {
      userId: "c0000000-0000-0000-0000-000000000001",
      pessoa: "Joana Prado",
      role: "cliente" as const,
      tourId: "portal",
      status: "concluido" as const,
      passoAtual: 4,
      pulados: ["material"],
      semAncora: [],
    },
  ];
}
