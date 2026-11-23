/**
 * Versao de prototipo de src/lib/dados/full-days.ts.
 *
 * O conjunto foi montado para as quatro abas mostrarem o que importa sem
 * ninguem precisar clicar em nada antes:
 *
 *   - a Marina (Criacao) de FERIAS APROVADAS, que pintam a matriz de roxo e
 *     bloqueiam aqueles dias no calendario do Rafael, da mesma area;
 *   - o Rafael com um pedido PENDENTE que se sobrepoe ao dela -- e o aviso
 *     "quem mais da area esta fora" na fila do socio;
 *   - a Ana com 14 meses sem ferias, para o alerta de risco trabalhista
 *     aparecer no relatorio;
 *   - um dia de remoto marcado a mao, que e o outro caminho da matriz.
 *
 * Tudo relativo a hoje: datas fixas envelhecem e, semanas depois, o prototipo
 * mostra "ferias" num passado que ninguem reconhece.
 */
import type {
  HrRequest,
  HrStatus,
  PresencaStatus,
} from "@/lib/supabase/database.types";
import type {
  LinhaDaMatriz,
  LinhaDoRelatorio,
  PessoaDoTime,
  SolicitacaoNaTela,
} from "../../src/lib/dados/full-days";

export type { LinhaDaMatriz, LinhaDoRelatorio, PessoaDoTime, SolicitacaoNaTela };

function emDias(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Um dia do MES CORRENTE, fixo.
 *
 * As ferias do exemplo precisam cair no mes que a matriz abre. Com "daqui a 14
 * dias", rodar o prototipo no dia 22 joga tudo para o mes seguinte e a matriz
 * nasce sem nenhuma ferias -- que e exatamente o que ela existe para mostrar.
 */
function nesteMes(dia: number): string {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${hoje.getFullYear()}-${mes}-${String(dia).padStart(2, "0")}`;
}

function mesesAtras(meses: number): string {
  const data = new Date();
  data.setMonth(data.getMonth() - meses);
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

const TIME: PessoaDoTime[] = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    nome: "Ana Souza",
    avatarUrl: null,
    area: "Direção",
    cargo: "Sócia-diretora",
    diasFeriasAno: 15,
  },
  {
    id: "a0000000-0000-0000-0000-000000000003",
    nome: "Carla Nunes",
    avatarUrl: null,
    area: "Atendimento",
    cargo: "Analista de contas",
    diasFeriasAno: 15,
  },
  {
    id: "a0000000-0000-0000-0000-000000000005",
    nome: "Bruno Lima",
    avatarUrl: null,
    area: "Criação",
    cargo: "Designer",
    diasFeriasAno: 15,
  },
  {
    id: "a0000000-0000-0000-0000-000000000006",
    nome: "Marina Costa",
    avatarUrl: null,
    area: "Criação",
    cargo: "Social media",
    diasFeriasAno: 15,
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    nome: "Diego Reis",
    avatarUrl: null,
    area: "Tecnologia",
    cargo: "Desenvolvedor",
    diasFeriasAno: 15,
  },
];

const MARINA = TIME[3];
const BRUNO = TIME[2];

const PEDIDOS: HrRequest[] = [
  {
    id: "fd1",
    user_id: MARINA.id,
    tipo: "ferias",
    data_inicio: nesteMes(8),
    data_fim: nesteMes(14),
    dias_uteis: 5,
    motivo: "Viagem em família",
    status: "aprovada",
    motivo_reprovacao: null,
    motivo_cancelamento: null,
    aprovado_por: TIME[0].id,
    decidido_em: new Date().toISOString(),
    origem: "solicitacao",
    lancado_por: null,
    lancado_em: null,
    created_at: new Date(Date.now() - 6 * 864e5).toISOString(),
  },
  {
    id: "fd2",
    user_id: BRUNO.id,
    tipo: "ferias",
    data_inicio: nesteMes(12),
    data_fim: nesteMes(18),
    dias_uteis: 5,
    motivo: "Casamento da irmã",
    status: "pendente",
    motivo_reprovacao: null,
    motivo_cancelamento: null,
    aprovado_por: null,
    decidido_em: null,
    origem: "solicitacao",
    lancado_por: null,
    lancado_em: null,
    created_at: new Date(Date.now() - 864e5).toISOString(),
  },
  // UM COMBINADO QUE AINDA NAO COMECOU (0106), e ele e a peca que faz o botao
  // de cancelar sair em imagem.
  //
  // O `fd1` acima comeca no dia 8 DESTE MES, e num dia 14 ele ja comecou --
  // `podeCancelar` responde false, e a fila "De acordo" sairia sem o botao
  // novo. Seria o ambiente de exemplo mostrando o produto no unico estado em
  // que a peca nova nao existe, que e a licao da Optica Visao sem atendente
  // (0062) e da pessoa desligada (0069).
  //
  // E ele nao SUBSTITUI o `fd1`, ele entra ao lado: os dois juntos sao o que
  // mede a trava -- um combinado em curso sem botao e um que ainda nao comecou
  // com botao, na mesma lista. Com um so, a imagem nao separa "o botao
  // aparece" de "o botao aparece sempre".
  //
  // A data e RELATIVA pela razao dos quatro blocos abaixo: uma data fixa deixa
  // de ser futuro sozinha, e a imagem conferida passaria a ser outra sem
  // ninguem tocar no arquivo.
  {
    id: "fd5",
    user_id: MARINA.id,
    tipo: "ferias",
    data_inicio: emDias(18),
    data_fim: emDias(22),
    dias_uteis: 5,
    motivo: "Emenda do feriado",
    status: "aprovada",
    motivo_reprovacao: null,
    motivo_cancelamento: null,
    aprovado_por: TIME[0].id,
    decidido_em: new Date(Date.now() - 2 * 864e5).toISOString(),
    origem: "solicitacao",
    lancado_por: null,
    lancado_em: null,
    created_at: new Date(Date.now() - 8 * 864e5).toISOString(),
  },
  // UM PERIODO COMBINADO E DEPOIS CANCELADO PELA SOCIA (0106), com o motivo.
  //
  // Sem ele a linha nova nao sai em imagem nenhuma: o estado "cancelada" ja
  // existia desde a 0011, mas so pelo pendente que o dono desfazia -- e aquele
  // nao carrega motivo. E a licao da Optica Visao sem atendente (0062) e da
  // pessoa desligada (0069): o ambiente de exemplo mostra o produto nos
  // estados em que ele dói.
  {
    id: "fd4",
    user_id: BRUNO.id,
    tipo: "ferias",
    data_inicio: emDias(25),
    data_fim: emDias(29),
    dias_uteis: 5,
    motivo: "Semana de day off",
    status: "cancelada",
    motivo_reprovacao: null,
    motivo_cancelamento: "A conta nova entra nesta semana.",
    aprovado_por: TIME[0].id,
    decidido_em: new Date(Date.now() - 3 * 864e5).toISOString(),
    origem: "solicitacao",
    lancado_por: null,
    lancado_em: null,
    created_at: new Date(Date.now() - 9 * 864e5).toISOString(),
  },
  {
    id: "fd3",
    user_id: TIME[1].id,
    tipo: "licenca",
    data_inicio: emDias(-40),
    data_fim: emDias(-36),
    dias_uteis: 3,
    motivo: "Consulta médica",
    status: "reprovada",
    motivo_reprovacao: "A semana já tinha duas pessoas do Atendimento fora.",
    motivo_cancelamento: null,
    aprovado_por: TIME[0].id,
    decidido_em: new Date(Date.now() - 38 * 864e5).toISOString(),
    origem: "solicitacao",
    lancado_por: null,
    lancado_em: null,
    created_at: new Date(Date.now() - 45 * 864e5).toISOString(),
  },
];

/** Todos os dias entre duas datas -- a forma do day off, que conta corrido. */
function diasCorridosEntre(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const cursor = new Date(`${inicio}T12:00:00`);
  const ate = new Date(`${fim}T12:00:00`);
  while (cursor <= ate) {
    const mes = String(cursor.getMonth() + 1).padStart(2, "0");
    const dia = String(cursor.getDate()).padStart(2, "0");
    dias.push(`${cursor.getFullYear()}-${mes}-${dia}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

/** Os dias uteis entre duas datas, pulando fim de semana. */
function diasUteisEntre(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const cursor = new Date(`${inicio}T12:00:00`);
  const ate = new Date(`${fim}T12:00:00`);
  while (cursor <= ate) {
    const semana = cursor.getDay();
    if (semana !== 0 && semana !== 6) {
      const mes = String(cursor.getMonth() + 1).padStart(2, "0");
      const dia = String(cursor.getDate()).padStart(2, "0");
      dias.push(`${cursor.getFullYear()}-${mes}-${dia}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export async function listarTime(): Promise<PessoaDoTime[]> {
  return TIME;
}

/**
 * UM FERIADO, E ELE CAI NO PRAZO DE "Criar KV" de proposito.
 *
 * O stub devolvia lista vazia, com a razao escrita: *"um feriado no meio dele
 * mudaria a contagem de dias uteis que a tela mostra sem acrescentar nada ao
 * que se quer validar"*. Aquilo valia enquanto o unico leitor era o Day Off;
 * deixou de valer quando o modal da etapa passou a avisar que a data escolhida
 * e feriado — com a lista vazia, **o aviso nao sairia em imagem nenhuma**, e a
 * rodada terminaria dizendo "Pronto" sobre a peca nova. E a licao da duplicata
 * do Cronograma: um ambiente de exemplo que mostra o produto no unico estado em
 * que a entrega e invisivel.
 *
 * E A DATA E CALCULADA e nao literal, que e a licao dos meses da nota fiscal:
 * `dia(1)` e o prazo de "Criar KV" em `tasks.ts`, e os dois andam juntos — uma
 * data fixa aqui deixaria de casar com a etapa na primeira virada de mes, e a
 * imagem sairia sem o aviso sem nada reclamar.
 *
 * SAO DOIS, UM POR TELA QUE AVISA, e nenhum a mais: o modal da etapa e a
 * abertura do mes de social sao os dois lugares onde o aviso foi ligado, e uma
 * tela com peca nova e sem imagem e uma tela que ninguem conferiu.
 *
 * O NOME E COPIADO DA TABELA, letra por letra (0011), e nao inventado: ele e
 * o mais longo dos 78, entao a imagem mostra a linha QUEBRANDO — que e o que
 * uma frase curta nao mostraria. E ele vai sem acento porque a tabela o grava
 * assim; o stub espelha o dado, nao o portugues que o dado deveria ter.
 *
 * E NENHUM DOS DOIS CAI NAS OUTRAS DATAS DO EXEMPLO, de proposito: o campo de
 * inicio da mesma etapa esta vazio, a entrega do mes de social nasce em branco
 * e a tela `56d` fecha o periodo noutro dia — e sao eles que mostram, na mesma
 * imagem, que a linha sabe FALTAR.
 */
const FERIADOS = [
  // 1. O PRAZO DE "Criar KV" (`dia(1)` em `tasks.ts`), que e a etapa que o
  //    modal de `46-subtarefa-painel` abre.
  { data: emDias(1), nome: "Dia Nacional de Zumbi e da Consciencia Negra" },
  // 2. O DIA QUE A TELA `56c-abrir-o-mes-periodo` CLICA na faixa.
  { data: diaDaFaixaDoSocial(2), nome: "Finados" },
];

/**
 * O DIA 2 DO MES QUE A FAIXA DE `abrir-o-mes` ABRE.
 *
 * Isto ESPELHA `DIAS_DA_FAIXA` de `scripts/prototipo.mjs`, e a duplicacao e
 * declarada: os dois rodam em runtimes diferentes — aquele monta o seletor do
 * clique, do lado de fora, e este responde a consulta, de dentro da copia
 * compilada —, e nao ha modulo que os dois importem. A conta e a de la, palavra
 * por palavra: a tela de abrir o mes nasce no mes que vem, e
 * `periodosSugeridosDoFluxo()` poe a data da Pauta em "o dia 1 do mes aberto
 * menos 32".
 *
 * **Se as duas divergirem, a imagem sai sem o aviso e nada reclama** — e a
 * licao dos meses da nota fiscal, que e tambem a razao de nenhuma das duas ser
 * uma data literal.
 */
function diaDaFaixaDoSocial(dia: number): string {
  const mesAberto = new Date();
  mesAberto.setDate(1);
  mesAberto.setMonth(mesAberto.getMonth() + 1);

  const naFaixa = new Date(mesAberto);
  naFaixa.setDate(naFaixa.getDate() - 32);

  const mes = String(naFaixa.getMonth() + 1).padStart(2, "0");
  return `${naFaixa.getFullYear()}-${mes}-${String(dia).padStart(2, "0")}`;
}

export async function feriadosEntre(inicio: string, fim: string): Promise<Set<string>> {
  // OS DOIS SAEM DA MESMA LISTA. Antes um devolvia vazio e o outro tambem; com
  // um feriado em cena, duas respostas para *"que dias sao feriado"*
  // divergiriam — e o que divergiria e a contagem de dias uteis do relatorio,
  // que diria um numero que o calendario ao lado contradiz.
  return new Set(
    FERIADOS.filter((f) => f.data >= inicio && f.data <= fim).map((f) => f.data),
  );
}

export async function feriadosComNome(
  inicio: string,
  fim: string,
): Promise<{ data: string; nome: string }[]> {
  return FERIADOS.filter((f) => f.data >= inicio && f.data <= fim);
}

export async function matrizDoPeriodo(
  inicio: string,
  fim: string,
): Promise<LinhaDaMatriz[]> {
  const feriasDaMarina = new Set(diasUteisEntre(PEDIDOS[0].data_inicio, PEDIDOS[0].data_fim));
  const remotoDaCarla = emDias(-1);

  return TIME.map((pessoa) => {
    const dias = new Map<
      string,
      { data: string; status: PresencaStatus; observacao: string | null; deSolicitacao: boolean }
    >();

    for (const data of diasUteisEntre(inicio, fim)) {
      if (pessoa.id === MARINA.id && feriasDaMarina.has(data)) {
        dias.set(data, { data, status: "ferias", observacao: null, deSolicitacao: true });
      } else if (pessoa.id === TIME[1].id && data === remotoDaCarla) {
        dias.set(data, { data, status: "remoto", observacao: null, deSolicitacao: false });
      }
    }

    // O saldo espelha a mesma regra da camada real: pendente conta como usado.
    // A Marina tem o day off combinado, e por isso aparece com menos dias.
    const usados = PEDIDOS.filter(
      (p) => p.user_id === pessoa.id && p.tipo === "ferias" && p.status !== "reprovada",
    ).reduce((total, p) => total + p.dias_uteis, 0);

    return { ...pessoa, dias, saldo: Math.max(0, pessoa.diasFeriasAno - usados) };
  });
}

export async function minhasSolicitacoes(usuarioId: string): Promise<HrRequest[]> {
  const meus = PEDIDOS.filter((p) => p.user_id === usuarioId);
  // Quem esta vendo o prototipo pode ser a socia, que nao tem pedido proprio.
  // Mostrar a lista vazia esconderia a tela que interessa validar.
  //
  // O FALLBACK PASSOU A REESCREVER O `user_id`, e deixou de ser cosmetico: o
  // calendario de Propor agora pinta de roxo os dias de um periodo DE QUEM
  // ESTA OLHANDO, e devolver os pedidos dos outros com o dono original faria
  // a tela afirmar que sao dela sem que o dado diga isso. Com a troca, a
  // ficcao fecha: na imagem eles sao mesmo dela.
  return meus.length > 0 ? meus : PEDIDOS.map((p) => ({ ...p, user_id: usuarioId }));
}

export async function filaDeAprovacoes(status: HrStatus): Promise<SolicitacaoNaTela[]> {
  const porPessoa = new Map(TIME.map((p) => [p.id, p]));

  return PEDIDOS.filter((p) => p.status === status).map((pedido) => {
    const pessoa = porPessoa.get(pedido.user_id) ?? null;

    const colegasFora = PEDIDOS.filter((outro) => {
      if (outro.id === pedido.id || outro.status !== "aprovada") return false;
      const colega = porPessoa.get(outro.user_id);
      if (!colega || !pessoa || colega.area !== pessoa.area) return false;
      return outro.data_inicio <= pedido.data_fim && outro.data_fim >= pedido.data_inicio;
    }).map((outro) => ({
      nome: porPessoa.get(outro.user_id)?.nome ?? "—",
      inicio: outro.data_inicio,
      fim: outro.data_fim,
    }));

    return { ...pedido, pessoa, colegasFora };
  });
}

export async function contarPorStatus(): Promise<Record<HrStatus, number>> {
  const contagem: Record<HrStatus, number> = {
    pendente: 0,
    aprovada: 0,
    reprovada: 0,
    cancelada: 0,
  };
  for (const pedido of PEDIDOS) contagem[pedido.status] += 1;
  return contagem;
}

export async function diasBloqueadosDaArea(
  usuarioId: string,
  inicio: string,
  fim: string,
): Promise<Map<string, string[]>> {
  void usuarioId;
  void inicio;
  void fim;

  // ---------------------------------------------------------------------
  // QUATRO BLOCOS, E CADA UM PROVA UMA COISA DO CARTAO "Quem esta fora".
  //
  // Ele era UM so -- as ferias da Marina deste mes --, e com um bloco a
  // imagem nao separa "lista blocos" de "lista min..max", nem mostra o que
  // acontece com um periodo que ja acabou. Foi exatamente isso que o usuario
  // relatou: *"quando eu registro um descanso, mesmo que antigo, ele fica
  // aparecendo aqui, mas essas pessoas ja voltaram"*.
  //
  //   1. O passado do Bruno NAO APARECE  -- o relato, virado do avesso.
  //   2. A Marina esta fora AGORA        -- o caso principal do cartao.
  //   3. E ela tem um SEGUNDO bloco      -- com min..max as duas viram uma
  //                                         faixa so, de hoje ate la.
  //   4. O Bruno tem um bloco de UTEIS   -- ele atravessa um fim de semana,
  //                                         e sem a ponte do vao ele sairia
  //                                         partido em dois ou tres.
  //
  // As datas sao RELATIVAS porque o recorte do cartao e `fim >= hoje`: uma
  // data fixa deixa de ser passado ou futuro sozinha, e a imagem conferida
  // passaria a ser outra sem ninguem tocar no arquivo.
  //
  // E NENHUM BLOCO PASSA DE `emDias(24)`, que e um CORREDOR combinado com o
  // gerador e nao um numero solto. `65b-full-days-selecao-atravessa-mes` e
  // `65c-full-days-375` clicam na virada entre o mes seguinte e o
  // subsequente -- que esta sempre a 31 dias ou mais de hoje --, e com um
  // bloco alem disso o clique e RECUSADO: a imagem sai com a frase "esta
  // fora neste dia, e e da sua area" na cara, com o nome de uma tela que ela
  // nao e. Isso ja aconteceu duas vezes, e as duas foram o mesmo erro visto
  // de angulos diferentes -- bloco relativo contra dia literal. O terceiro
  // bloco da Marina veio de `emDias(30..34)` para ca por isso.
  // ---------------------------------------------------------------------
  const bloqueados = new Map<string, string[]>();

  const por = (nome: string, de: string, ate: string, soUteis = false) => {
    for (const dia of soUteis ? diasUteisEntre(de, ate) : diasCorridosEntre(de, ate)) {
      bloqueados.set(dia, [...(bloqueados.get(dia) ?? []), nome]);
    }
  };

  por(BRUNO.nome, emDias(-40), emDias(-33));
  por(MARINA.nome, emDias(-2), emDias(5));
  por(MARINA.nome, emDias(20), emDias(24));
  por(BRUNO.nome, emDias(10), emDias(20), true);

  return bloqueados;
}

export async function relatorioDoPeriodo(
  inicio: string,
  fim: string,
  hojeISO: string,
): Promise<LinhaDoRelatorio[]> {
  void inicio;
  void fim;
  void hojeISO;
  return TIME.map((pessoa, indice) => {
    const tiradas = indice === 1 ? 10 : indice === 4 ? 5 : 0;
    const agendadas = pessoa.id === MARINA.id ? 5 : 0;
    const pendentes = pessoa.id === BRUNO.id ? 5 : 0;

    // A Ana esta ha 14 meses sem ferias: e o caso que o alerta de risco
    // trabalhista existe para mostrar.
    const ultimasFerias = indice === 0 ? mesesAtras(14) : indice === 1 ? mesesAtras(3) : null;
    const admissao = indice === 0 ? "2021-03-01" : "2024-02-05";
    const mesesSemFerias = indice === 0 ? 14 : indice === 1 ? 3 : 8;

    return {
      ...pessoa,
      tiradas,
      agendadas,
      pendentes,
      saldo: pessoa.diasFeriasAno - tiradas - agendadas - pendentes,
      ausencias: indice === 1 ? 2 : 0,
      licencas: 0,
      ultimasFerias,
      admissao,
      mesesSemFerias,
      vencendo: mesesSemFerias >= 12,
    };
  });
}

export async function foraHoje(hojeISO: string): Promise<
  { nome: string; area: string; status: PresencaStatus }[]
> {
  void hojeISO;
  return [];
}

export type { LancamentoNaTela } from "../../src/lib/dados/full-days";

/**
 * Dois registros lancados pela gestao, para a aba nascer com o que ela
 * existe para mostrar: um day off do ANO PASSADO (o caso real -- historico
 * anterior ao Full Hub) e uma ausencia pontual de um dia, combinada por fora.
 *
 * Nenhum deles e `solicitacao`: esta lista e justamente o que a fila de
 * pedidos NAO mostra, e um pedido aqui faria a aba parecer uma segunda fila.
 */
export async function lancamentosDaGestao(): Promise<
  import("../../src/lib/dados/full-days").LancamentoNaTela[]
> {
  const anoPassado = new Date().getFullYear() - 1;
  return [
    {
      id: "lanc1",
      user_id: MARINA.id,
      tipo: "ferias",
      data_inicio: `${anoPassado}-12-20`,
      data_fim: `${anoPassado}-12-29`,
      dias_uteis: 10,
      motivo: "Planilha de 2025, fechamento do ano.",
      status: "aprovada",
      motivo_reprovacao: null,
      motivo_cancelamento: null,
      aprovado_por: TIME[0].id,
      decidido_em: new Date(Date.now() - 30 * 864e5).toISOString(),
      origem: "lancamento_retroativo",
      lancado_por: TIME[0].id,
      lancado_em: new Date(Date.now() - 30 * 864e5).toISOString(),
      created_at: new Date(Date.now() - 30 * 864e5).toISOString(),
      pessoa: MARINA,
      lancadoPor: TIME[0].nome,
    },
    {
      id: "lanc2",
      user_id: BRUNO.id,
      tipo: "ausencia",
      data_inicio: emDias(-9),
      data_fim: emDias(-9),
      dias_uteis: 1,
      motivo: "Avisou por mensagem na hora, entrou depois.",
      status: "aprovada",
      motivo_reprovacao: null,
      motivo_cancelamento: null,
      aprovado_por: TIME[0].id,
      decidido_em: new Date(Date.now() - 8 * 864e5).toISOString(),
      origem: "lancamento_retroativo",
      lancado_por: TIME[0].id,
      lancado_em: new Date(Date.now() - 8 * 864e5).toISOString(),
      created_at: new Date(Date.now() - 8 * 864e5).toISOString(),
      pessoa: BRUNO,
      lancadoPor: TIME[0].nome,
    },
  ];
}

export type { DescansoDoCiclo } from "../../src/lib/dados/full-days";

/**
 * O saldo do ciclo de 12 meses, para o prototipo.
 *
 * A Ana (socia) esta ha mais de um ano na agencia, entao o exemplo mostra DOIS
 * ciclos COMPLETADOS -- e, depois da 0085, com 15 dias concedidos e duas
 * parcelas, nao 30 e quatro. **Os numeros antigos descreviam um estado que o
 * produto nao tem mais**, e um stub assim fotografa um produto que nao existe:
 * e o seed inserindo campanha sem demanda, na camada da imagem.
 *
 * `diasUsados` e cinco de proposito, e nao zero nem quinze: com zero a barra
 * de uso sai vazia e com quinze ela sai cheia -- os dois extremos escondem o
 * que ela serve para dizer. E com saldo parcial a faixa mostra a frase inteira
 * que a 0085 trouxe, a da data em que os dias voltam.
 *
 * `proximoEm` nao e decorativo: desde a 0145 ele e a data em que o bloco se
 * RESTAURA -- os 15 dias voltam inteiros, e o que sobrou ate la se perde
 * (0085). Era, na 0074, a data em que os primeiros dias chegavam, e aquele
 * estado deixou de existir. Esta funcao devolve dois ciclos de proposito: as
 * outras duas formas desta faixa (o saldo que nao respondeu e a ficha sem data
 * de entrada) tem imagem propria, por `env`, e um stub que so soubesse
 * desenhar uma delas fotografaria o produto pela metade.
 */
export async function descansoDoCiclo(
  _usuarioId: string,
): Promise<import("../../src/lib/dados/full-days").DescansoDoCiclo | null> {
  // O CICLO CORRENTE COMECOU HA QUATRO MESES, e nao ha exatamente um ano: com
  // um ano cheio o proximo aniversario cai HOJE, e a faixa dizia "os 15 dias
  // voltam inteiros em <a data de hoje>" -- uma frase que se le como defeito.
  // A imagem mostrou.
  const inicio = new Date();
  inicio.setMonth(inicio.getMonth() - 4);
  const proximo = new Date(inicio);
  proximo.setFullYear(proximo.getFullYear() + 1);

  // O SALDO QUE NAO RESPONDEU, por pedido da tela (`env` no gerador).
  // Colchetes de proposito, como em `dal.ts`: assim o valor vem do ambiente na
  // hora do pedido e o mesmo build serve para as duas imagens.
  //
  // E a unica das formas desta faixa que nasceu de um relato -- a tela dizia
  // "voce tem 15 de 15 dias disponiveis" para quem tinha day off aprovado,
  // porque o fallback preenchia um ciclo cheio. Sem a imagem, o estado que o
  // conserto criou ficaria sem foto, que e a licao de
  // `30b-minhas-tasks-vazia`: o ambiente de exemplo mostra o produto nos
  // estados em que ele doi.
  if (process.env["PROTOTIPO_SALDO_SEM_RESPOSTA"] === "1") {
    return null;
  }

  // A FICHA SEM DATA DE ENTRADA, e ela SUBSTITUI o primeiro ciclo (0145).
  //
  // O ramo que estava aqui devolvia `ciclos: 0` com zero concedidos, que era o
  // estado de todo mundo por doze meses -- e o produto nao tem mais esse
  // estado: os 15 dias valem desde a entrada. Deixa-lo de pe seria o stub
  // fotografando um produto que nao existe, que e o seed inserindo campanha
  // sem demanda na camada da imagem.
  //
  // O que ficou no lugar e o estado que a 0145 CRIOU e que imagem nenhuma
  // cobria: sem `data_admissao` a ficha nao tem como dizer quando os dias
  // voltam, entao `proximoEm` vem nulo -- a faixa perde a linha da data e
  // ganha o aviso para a gestao, com o envio de pe e o saldo cheio. E
  // alcancavel em producao, porque a coluna e opcional desde o Sprint 2.
  if (process.env["PROTOTIPO_SEM_DATA_DE_ENTRADA"] === "1") {
    return {
      inicioDoCiclo: null,
      proximoEm: null,
      ciclos: 0,
      diasConcedidos: 15,
      diasUsados: 0,
      saldo: 15,
    };
  }

  return {
    inicioDoCiclo: inicio.toISOString().slice(0, 10),
    proximoEm: proximo.toISOString().slice(0, 10),
    ciclos: 2,
    diasConcedidos: 15,
    diasUsados: 5,
    saldo: 10,
  };
}
