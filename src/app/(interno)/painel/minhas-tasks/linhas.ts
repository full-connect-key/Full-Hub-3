import { ClipboardList, FolderKanban, Images, type LucideIcon } from "lucide-react";

import type { MinhaSubtarefa, MinhaTask } from "@/lib/dados/minhas-tasks";
import type { Pessoa } from "@/lib/dados/tasks";
import { quemMaisEstaNa } from "@/lib/dominio/tasks";
import { ROTULOS_DE_SUBTAREFA, STATUS_DE_SUBTAREFA } from "@/lib/tasks/state-machine";
import type { SubtaskStatus, TaskStatus } from "@/lib/supabase/database.types";

/**
 * O achatamento de Minhas Tasks: de tasks para ETAPAS.
 *
 * **Cada etapa minha é um item por si.** Se a demanda "Post de lançamento"
 * tem Conteúdo e Layout e as duas são minhas, a lista mostra duas linhas —
 * porque são dois trabalhos, com dois prazos, que eu faço em dois momentos.
 * Uma única linha "Post de lançamento" obrigava a abrir para descobrir o que
 * havia dentro, e o prazo que ela mostrava era o mais apertado dos dois: o
 * outro simplesmente não aparecia.
 *
 * A demanda não some — vira a LINHAGEM do item: `Cliente · Demanda`, e mais
 * `› Etapa de cima` quando a minha é uma sub-etapa. É o que responde "por que
 * estou fazendo isto?" sem gastar uma linha inteira da lista, e clicar abre o
 * painel com a demanda completa, onde se vê que Conteúdo e Layout são da
 * mesma mãe e o que as outras pessoas estão fazendo nela.
 *
 * A ORDEM É GLOBAL, e é o ponto de listar por etapa: o que vence amanhã fica
 * no topo mesmo que a demanda dele comece semana que vem. Agrupado por
 * demanda, uma etapa atrasada podia estar em qualquer lugar da rolagem.
 *
 * Função pura, sem acesso a banco, exatamente para que a página (servidor) e a
 * lista (navegador) enxerguem o mesmo conjunto sem uma segunda consulta.
 */

export type LinhaPessoal = {
  chave: string;
  taskId: string;
  /** A demanda a que a etapa pertence — o contexto, nunca o item. */
  demanda: {
    titulo: string;
    cliente: string | null;
    status: TaskStatus;
    /** Quantas etapas a demanda tem ao todo, e quantas delas são minhas. */
    total: number;
    minhas: number;
    /**
     * Quem mais está na demanda, uma vez cada.
     *
     * Vem de `task.outrasSubtarefas`, que `carregar()` já traz com a ficha de
     * cada responsável — nenhuma consulta nova. A linhagem responde "por que
     * estou fazendo isto?"; a pilha responde a pergunta seguinte, que é
     * "quem está com o resto?".
     */
    outros: Pessoa[];
    /**
     * O MÊS DE SOCIAL que esta demanda é, quando ela é um.
     *
     * `tasks.social_do_mes` é o que diz isso desde a 0061, e o par com o
     * cliente é o índice único de lá — então ele endereça UM mês de UMA
     * conta, que é exatamente o que o Social Media abre.
     *
     * **Vem da DEMANDA e não da etapa**, ao contrário de `subtarefa.campanha`:
     * a fase é do mês inteiro desde a 0088, e `social_papel` diz que a etapa é
     * uma fase mas não de qual mês. Nulo quando falta o cliente — sem ele não
     * há endereço, e um link quebrado é pior que link nenhum.
     */
    social: { clienteId: string; mes: string } | null;
  };
  subtarefa: MinhaSubtarefa;
};

/**
 * Prazo crescente deixa o atrasado no topo por construção: data menor vem
 * antes. Quem não tem prazo vai para o fim, e não para o começo — etapa sem
 * data não é etapa urgente, é etapa que ninguém marcou.
 */
function ordenar(a: LinhaPessoal, b: LinhaPessoal): number {
  const pa = a.subtarefa.prazo;
  const pb = b.subtarefa.prazo;
  if (pa !== pb) {
    if (!pa) return 1;
    if (!pb) return -1;
    return pa.localeCompare(pb);
  }
  const demandas = a.demanda.titulo.localeCompare(b.demanda.titulo, "pt-BR");
  if (demandas !== 0) return demandas;
  return a.subtarefa.ordem - b.subtarefa.ordem;
}

/** O prazo que manda na demanda: o da minha etapa em aberto mais próxima. */
export function meuPrazoNaTask(task: MinhaTask): string | null {
  const prazos = task.minhasSubtarefas
    .filter((s) => s.status !== "concluida" && s.prazo)
    .map((s) => s.prazo as string)
    .sort();
  return prazos[0] ?? null;
}

export function montarLinhas(tasks: MinhaTask[]): LinhaPessoal[] {
  return tasks
    .flatMap((task): LinhaPessoal[] =>
      task.minhasSubtarefas.map((sub) => ({
        chave: `etapa-${sub.id}`,
        taskId: task.id,
        demanda: {
          titulo: task.titulo,
          cliente: task.cliente?.nome_empresa ?? null,
          status: task.status,
          total: task.subtarefasTotal,
          minhas: task.minhasSubtarefas.length,
          outros: quemMaisEstaNa(task.outrasSubtarefas),
          social:
            task.social_do_mes && task.cliente
              ? { clienteId: task.cliente.id, mes: task.social_do_mes.slice(0, 7) }
              : null,
        },
        subtarefa: sub,
      })),
    )
    .sort(ordenar);
}

/**
 * ---------------------------------------------------------------------------
 * AS TRÊS ÁREAS DE MINHAS TASKS
 *
 * Decisão do usuário, e ela corrige uma leitura minha: *"Social Media e
 * Campanhas ainda não está dentro de Minhas Tasks"*.
 *
 * **Elas estavam, e é justamente esse o problema.** A peça de campanha é uma
 * subtarefa desde a 0051, então ela já aparecia — como mais uma linha no meio
 * das outras, com um selo pequeno. E a etapa de social tinha um bloco chamado
 * "Social", sem contagem, que some quando não há nenhuma. Estar na tela e ser
 * VISÍVEL na tela são duas coisas diferentes, e quem abre procurando a área
 * pelo nome não achava nem uma nem outra.
 *
 * O que muda: as três áreas passam a ter **nome, contagem e seção própria**.
 * O que NÃO muda: cada trabalho continua aparecendo UMA vez só. Um bloco
 * "Campanhas" ao lado da lista geral poria a mesma etapa duas vezes na mesma
 * tela — que é a conta que a 0061 recusou para a subtarefa do post. Por isso
 * é AGRUPAMENTO e não bloco novo: a linha sai da lista geral e entra na seção
 * da área dela.
 * ---------------------------------------------------------------------------
 */
export const AREAS = ["demandas", "campanhas", "social"] as const;
export type AreaDeTrabalho = (typeof AREAS)[number];

export const ROTULOS_DE_AREA: Record<AreaDeTrabalho, string> = {
  demandas: "Demandas",
  campanhas: "Campanhas",
  social: "Social Media",
};

/**
 * O MÓDULO DE CADA ÁREA, quando ele existe — e o de demandas NÃO existe.
 *
 * ---------------------------------------------------------------------------
 * **`demandas` É NULO, e isso é um conserto.** Ele apontava para
 * `/painel/gestao-tasks`, que é `GESTAO` em `lib/auth/permissions.ts` desde
 * sempre: o colaborador — a pessoa para quem Minhas Tasks existe — clicava e
 * levava **403**. A rota não tem como ser outra, porque não existe um módulo
 * "minhas demandas" ao lado desta tela: Minhas Tasks É ele.
 *
 * E não há o que perder: a novidade de uma demanda sempre vira LINHA nesta
 * mesma tela, porque ela tem responsável — é por isso que ela é novidade. As
 * outras duas podem não estar na lista ainda (o post que a gestão acabou de
 * liberar não tem prazo próprio, e a peça de campanha só vira linha depois de
 * alguém abrir a demanda), e é por isso que elas continuam levando ao módulo.
 * ---------------------------------------------------------------------------
 * **É `as const satisfies` E NÃO UM `Record` DECLARADO**, e isso não é
 * preciosismo de tipo: com `Record<AreaDeTrabalho, string | null>` a resposta
 * de `ROTA_DA_AREA.social` passaria a ser `string | null`, e todo leitor
 * ganharia um ramo "e se não houver rota" que **nenhum caminho produz** — a
 * faixa de novidades só conhece `social` e `campanhas`, as duas com endereço.
 * Um ramo que nada alcança é o que alguém reaproveita três sprints depois
 * achando que ele decide alguma coisa.
 *
 * O `satisfies` é a outra metade: ele mantém a cobertura do enum, então uma
 * quarta área obriga uma linha aqui em vez de sumir sem erro.
 * ---------------------------------------------------------------------------
 */
export const ROTA_DA_AREA = {
  demandas: null,
  campanhas: "/painel/aprovacoes",
  social: "/painel/social-media",
} as const satisfies Record<AreaDeTrabalho, string | null>;

/**
 * O ÍCONE DE CADA ÁREA, e ele mora aqui pela razão de `FUNCOES`.
 *
 * Eram TRÊS cópias deste mapa na mesma pasta — a faixa das áreas, o cabeçalho
 * de cada seção da Lista e a faixa de novidades —, e **duas já tinham
 * divergido**: o Social aparecia com o ícone de lista numa e com o de imagens
 * nas outras, na mesma tela, a poucos pixels de distância. A quarta cópia
 * seria a que esquecesse uma área nova.
 *
 * **E o ícone passou a carregar mais peso do que carregava.** Enquanto Social
 * Media e Campanhas eram itens da barra lateral, ele era só o eco do ícone de
 * lá — quem reconhecia a área reconhecia pelo menu. As duas entradas saíram
 * da barra por decisão do usuário, e agora este é o único lugar do produto em
 * que aquele desenho aparece ao lado daquele nome. Dois desenhos para a mesma
 * área deixaram de ser inconsistência de estilo e passaram a ser duas áreas.
 */
export const ICONE_DA_AREA: Record<AreaDeTrabalho, LucideIcon> = {
  demandas: ClipboardList,
  campanhas: FolderKanban,
  social: Images,
};

/**
 * De que área é esta etapa.
 *
 * **A pergunta é `subtarefa.campanha`, e não o caminho longo pela demanda.**
 * `deliverables.subtask_id` é a ponte que a 0033 criou e a 0051 passou a
 * escrever; indo por `task → campaign`, a etapa de uma campanha aberta sem
 * entregável responderia "campanha" — e ela não é peça de nada.
 *
 * -------------------------------------------------------------------------
 * **E A ETAPA DE SOCIAL PASSA POR AQUI DESDE A 0088**, que é a mudança.
 *
 * Até ela a corrente do social era de `post_etapas`, uma tabela própria com
 * um vocabulário próprio: a etapa de post não tinha rodada, nem dependência
 * cadastrada, nem cronômetro, então ela não cabia em `SubtarefaDetalhada` e
 * tinha BLOCO PRÓPRIO nesta tela — *"o molde errado mente com mais convicção
 * que a ausência"*.
 *
 * Com a etapa sendo do mês ela é uma subtarefa comum, com responsável, prazo,
 * estimativa, cronômetro e as travas da 0007. Então ela entra na lista de
 * sempre, e o que a área precisa dizer é só de onde ela vem — para o chip
 * contar e o cabeçalho da Lista nomear.
 *
 * **A pergunta é `social_papel`, nunca o título nem o caminho pela demanda.**
 * Pelo caminho longo (`task.social_do_mes`), uma etapa acrescentada à mão na
 * demanda do mês — *"Conferir os direitos de imagem"* — responderia "social"
 * sendo uma etapa de demanda comum; e pelo título, um fluxo que chame a fase
 * de outra coisa deixaria a área vazia sem erro em lugar nenhum.
 * -------------------------------------------------------------------------
 */
export function areaDaLinha(linha: LinhaPessoal): AreaDeTrabalho {
  if (linha.subtarefa.social_papel) return "social";
  return linha.subtarefa.campanha ? "campanhas" : "demandas";
}

export function ehArea(valor: string | undefined): valor is AreaDeTrabalho {
  return Boolean(valor) && (AREAS as readonly string[]).includes(valor as string);
}

/**
 * A PORTA DA ÁREA, a partir da ETAPA — e é ela que substitui os três chips.
 *
 * Decisão do usuário: *"tire os botoes do cabeçalho de demandas, campanhas e
 * social, quero que elas sejam acessadas por meio das tasks em si, quando a
 * pessoa é marcada em um task de algum desses tipos, ela tenha acesso a
 * página referente"*.
 *
 * ---------------------------------------------------------------------------
 * **OS CHIPS ERAM TRÊS LINKS PARA O MÓDULO, e a faixa estava LÁ EM CIMA.** Ela
 * respondia *"onde está o meu trabalho"* — com a contagem, inclusive no zero —,
 * e a pergunta que ela não respondia é a que se faz olhando uma linha:
 * **ESTA etapa, de que mês é? de que campanha?** Quem tinha a fase de Layout
 * de outubro da Mundo Verde clicava em "Social Media" e caía no ÍNDICE do
 * módulo, para procurar de novo a conta e o mês que a linha já sabia.
 *
 * **Agora o endereço é da LINHA**, e com ele a volta deixa de ser uma busca:
 * a fase leva ao mês dela, a peça leva à campanha dela.
 *
 * ---------------------------------------------------------------------------
 * **E `demandas` DEVOLVE NULO, que é um conserto e não uma omissão.** O chip
 * apontava para `/painel/gestao-tasks`, que é `GESTAO`: o colaborador — a
 * pessoa para quem Minhas Tasks existe — clicava e levava **403**. Não há
 * endereço melhor, porque não existe módulo "minhas demandas" ao lado desta
 * tela: **Minhas Tasks É ele**, e a demanda inteira já abre no painel lateral,
 * que é a decisão escrita desta tela desde o Sprint 10.
 *
 * ---------------------------------------------------------------------------
 * **O RÓTULO É O MÓDULO e não o nome do objeto**, e isto desfaz meia decisão
 * minha: a pílula da campanha dizia o NOME dela, com o argumento de que
 * *"'Campanha' repetia o cabeçalho cinco vezes sem informar nada"* — verdadeiro
 * enquanto havia a seção Campanhas, e vencido por `abrir_campanha()` (0051),
 * que dá à demanda o título `p_nome`, o nome da campanha. Ou seja: a linhagem
 * logo acima JÁ escreve aquele nome, e a pílula o dizia de novo a dois
 * centímetros. O que ela não dizia é PARA ONDE ela leva, que é o que mudou.
 * ---------------------------------------------------------------------------
 */
export function destinoDaEtapa(
  linha: LinhaPessoal,
): { href: string; rotulo: string; titulo: string } | null {
  const area = areaDaLinha(linha);

  if (area === "social") {
    // O MÊS E A CONTA, nunca o índice: `?aba=social` sem os dois abre a lista
    // de contas, que é de onde a pessoa teria de procurar o mês outra vez.
    const s = linha.demanda.social;
    if (!s) return null;
    return {
      href: `/painel/social-media?aba=social&mes=${s.mes}&cliente=${s.clienteId}`,
      rotulo: "Social Media",
      titulo: `Abrir ${linha.demanda.titulo} no Social Media`,
    };
  }

  if (area === "campanhas") {
    const c = linha.subtarefa.campanha;
    if (!c) return null;
    return {
      href: `/painel/aprovacoes/campanhas/${c.id}`,
      rotulo: "Campanhas",
      titulo: `Abrir a campanha ${c.nome}`,
    };
  }

  return null;
}

/**
 * ---------------------------------------------------------------------------
 * OS SEIS STATUS DA ETAPA, NA ORDEM EM QUE ELA ANDA
 *
 * Decisão do usuário: *"quero que em minhas tasks, a visualização em lista
 * seja apresentada por status"*. A Lista agrupava por ÁREA; passou a agrupar
 * por status, e o agrupamento por área saiu — dois níveis de cabeçalho sobre
 * oito linhas é moldura, não organização.
 *
 * **O STATUS É O DA ETAPA, E NÃO O DA DEMANDA**, e a razão é mecânica antes
 * de ser conceitual: cada linha da Lista JÁ CARREGA o `StatusBadge` da etapa.
 * Agrupando pelo status da demanda, um cabeçalho "Em andamento" apareceria em
 * cima de uma linha marcada "Concluída" — dois fatos sobre a mesma linha se
 * contradizendo a um centímetro de distância, que é o erro que o produto já
 * pegou no cartão de "11 entregues" com sete na lista embaixo.
 *
 * E é conceitual também: a Lista lista ETAPAS desde o Sprint 10, porque
 * "Conteúdo" e "Layout" da mesma demanda são dois trabalhos meus, com dois
 * prazos. Pelo status da mãe os dois caem no mesmo grupo mesmo com um
 * concluído e o outro sem começar — que é exatamente o que fez o board de
 * demandas sair desta tela.
 *
 * **E ESTA LISTA É A MESMA DO BOARD**, que fica no seletor de visão ao lado.
 * Ela nasceu lá dentro; duas cópias da mesma ordem divergiriam na primeira
 * vez que alguém mexesse numa — é a lição de `ICONE_DA_AREA`, que tinha três
 * cópias e duas já divergidas, e a de `COLUNAS_POR_STATUS` na Gestão de
 * Tasks. Trocar de visão e ver a mesma etapa em dois lugares diferentes da
 * ordem seria a tela desmentindo a si mesma.
 *
 * **São os SEIS da etapa e não os sete da Task**, pela razão que o board já
 * registrava: são enums diferentes no banco, e um de-para entre os dois é o
 * lugar onde as duas verdades começam a divergir.
 * ---------------------------------------------------------------------------
 */
export const STATUS_EM_ORDEM: { status: SubtaskStatus; titulo: string }[] = [
  { status: "nao_iniciada", titulo: ROTULOS_DE_SUBTAREFA.nao_iniciada },
  { status: "em_andamento", titulo: ROTULOS_DE_SUBTAREFA.em_andamento },
  {
    status: "aguardando_informacoes",
    titulo: ROTULOS_DE_SUBTAREFA.aguardando_informacoes,
  },
  {
    status: "enviada_aprovacao",
    titulo: ROTULOS_DE_SUBTAREFA.enviada_aprovacao,
  },
  { status: "em_ajustes", titulo: ROTULOS_DE_SUBTAREFA.em_ajustes },
  { status: "concluida", titulo: ROTULOS_DE_SUBTAREFA.concluida },
];

// A ORDEM PRECISA COBRIR O ENUM INTEIRO, como os grupos do seletor de status
// cobrem o dele. Um valor novo sem lugar aqui some das DUAS visões sem erro e
// sem aviso — a etapa simplesmente não aparece, e só se descobre no dia em que
// alguém for procurar por ela.
//
// A checagem mora aqui e não no board porque a lista mora aqui: deixada lá,
// ela pararia de rodar para quem abrisse a Lista sem nunca abrir o board.
const SEM_LUGAR = STATUS_DE_SUBTAREFA.filter(
  (status) => !STATUS_EM_ORDEM.some((linha) => linha.status === status),
);
if (SEM_LUGAR.length > 0) {
  throw new Error(
    `Status de subtarefa sem lugar em Minhas Tasks: ${SEM_LUGAR.join(", ")}. ` +
      "Toda etapa precisa cair em algum grupo, senão ela some da tela sem avisar.",
  );
}
