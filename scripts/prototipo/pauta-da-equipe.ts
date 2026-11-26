import { hojeNaAgencia, segundaDaSemana, somarDias } from "@/lib/dominio/datas";

// OS TIPOS VÊM PELO CAMINHO RELATIVO, nunca pelo alias: dentro da cópia do
// gerador `@/lib/dados/pauta-da-equipe` aponta para ESTE arquivo, e importar
// dali é a definição circular que o `tsc` recusa — é a forma do stub de
// `minhas-tasks.ts`, pela mesma razão.
import type {
  BuscaNaPauta,
  CargaDaEquipe,
  DiaDaCarga,
  EtapaAchada,
  PessoaNaPauta,
} from "../../src/lib/dados/pauta-da-equipe";

import { EQUIPE_EXEMPLO } from "./dados-exemplo";

export type {
  BuscaNaPauta,
  CargaDaEquipe,
  DiaDaCarga,
  EtapaAchada,
  PessoaNaPauta,
};

const MINIMO_PARA_BUSCAR = 2;

/**
 * A carga da equipe nesta semana, para o protótipo (0144, item 22).
 *
 * ---------------------------------------------------------------------------
 * **A SEMANA É CALCULADA E NUNCA LITERAL**, que é a lição dos meses da nota
 * fiscal: uma semana escrita à mão para de ser a semana corrente sozinha, e a
 * imagem sai igual sem nada reclamar — a grade apareceria inteira em cinza,
 * com a coluna de hoje marcada em lugar nenhum.
 *
 * **E O PADRÃO NÃO É ALEATÓRIO**, pela razão do stub da faixa de
 * disponibilidade: ele é escolhido para a imagem mostrar os quatro degraus da
 * escala AO MESMO TEMPO, mais o dia de ausência, que é forma e não cor. Uma
 * grade só com folga provaria apenas que a célula sabe existir — é a lição da
 * duplicata do Cronograma, e é por isso que o Bruno passa da capacidade numa
 * terça e a Marina está fora numa quinta.
 *
 * **O OFFSET SAI DO ÍNDICE DA PESSOA**, e não do dia do mês: assim a grade é
 * a mesma em toda rodada — duas imagens da mesma tela em dias diferentes têm
 * de sair iguais, senão a conferência por imagem deixa de distinguir uma
 * mudança de uma virada de calendário.
 * ---------------------------------------------------------------------------
 */
export async function cargaDaEquipeNaSemana(): Promise<CargaDaEquipe | null> {
  const hoje = hojeNaAgencia();
  const segunda = segundaDaSemana(hoje);
  const dias = [0, 1, 2, 3, 4].map((n) => somarDias(segunda, n));

  const ativos = EQUIPE_EXEMPLO.filter((pessoa) => pessoa.ativo);

  const pessoas: PessoaNaPauta[] = ativos.map((pessoa, indice) => ({
    id: pessoa.id,
    nome: pessoa.nome,
    avatar_url: pessoa.avatar_url,
    // 540 PARA TODO MUNDO, que é o padrão da casa desde a 0081. O conjunto
    // de exemplo não tem meio período, e inventar um aqui faria a imagem
    // pintar de vermelho uma carga que está dentro do contrato de alguém.
    capacidadeMinutos: 540,
    dias: dias.map((dia, coluna) => {
      const minutos = MINUTOS[(indice * 3 + coluna) % MINUTOS.length];
      // A AUSÊNCIA É UMA CÉLULA SÓ, e ela é da Marina numa quinta: com
      // ninguém fora, a borda tracejada — que é o sinal de FORMA, o único que
      // sobrevive ao daltonismo — não sairia em imagem nenhuma.
      const ausente = indice === 4 && coluna === 3;
      return {
        dia,
        minutos: ausente ? 0 : minutos,
        etapas: ausente || minutos === 0 ? 0 : Math.ceil(minutos / 180),
        ausente,
      } satisfies DiaDaCarga;
    }),
  }));

  return { dias, hoje: dias.includes(hoje) ? hoje : null, pessoas };
}

/**
 * OS CINCO DEGRAUS QUE A GRADE PRECISA DESENHAR, na ordem em que o offset os
 * distribui: o dia vazio, o de folga, o quase cheio, o cheio e o que PASSA da
 * capacidade de 540 — que é a célula que responde a pergunta da tela.
 */
const MINUTOS = [0, 120, 300, 480, 660, 180, 540];


/**
 * A BUSCA POR TÍTULO, para o protótipo (0147, item 1).
 *
 * ---------------------------------------------------------------------------
 * ELA ACHA DE VERDADE, e não devolve lista fixa: o termo é comparado contra os
 * títulos do exemplo, sem acento e sem caixa, como `sem_acento()` faz no banco.
 * Com uma lista fixa a imagem sairia mostrando resultados que não casam com o
 * que está escrito no campo — o ambiente de exemplo mostrando o produto num
 * estado que ele não tem, que é a lição da duplicata do Cronograma.
 *
 * **E O CONJUNTO TEM OS TRÊS CASOS QUE A TELA DISTINGUE:** uma etapa de UMA
 * pessoa, uma de DUAS — que é o que prova que a linha agrupa em vez de repetir
 * a etapa — e uma SEM responsável, que é a resposta mais cara de *quem fez*.
 * Com as três iguais a imagem provaria que a lista desenha, e não que ela
 * distingue.
 * ---------------------------------------------------------------------------
 */
export async function acharEtapaPeloTitulo(
  termo: string,
  limite = 40,
): Promise<BuscaNaPauta> {
  const limpo = termo.trim();
  if (limpo.length < MINIMO_PARA_BUSCAR) {
    return { termo: limpo, achadas: [], total: 0 };
  }

  const alvo = semAcento(limpo);
  const casam = ETAPAS_ACHAVEIS.filter(
    (e) =>
      semAcento(e.etapa).includes(alvo) || semAcento(e.demanda).includes(alvo),
  );

  return {
    termo: limpo,
    achadas: casam.slice(0, limite),
    total: casam.length,
  };
}

/** O `sem_acento()` da 0073 em TypeScript — o mesmo conjunto fechado. */
function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const ETAPAS_ACHAVEIS: EtapaAchada[] = [
  {
    subtaskId: "b1000000-0000-4000-8000-000000000001",
    taskId: "a1000000-0000-4000-8000-000000000001",
    etapa: "Vídeo institucional — roteiro",
    demanda: "Campanha de verão",
    cliente: "Mundo Verde",
    status: "em_andamento",
    prazo: null,
    pessoas: [
      {
        id: EQUIPE_EXEMPLO[1].id,
        nome: EQUIPE_EXEMPLO[1].nome,
        avatar_url: null,
      },
    ],
  },
  {
    subtaskId: "b1000000-0000-4000-8000-000000000002",
    taskId: "a1000000-0000-4000-8000-000000000002",
    etapa: "Vídeo para o feed — edição",
    demanda: "Social de outubro",
    cliente: "Óptica Visão",
    status: "enviada_aprovacao",
    prazo: null,
    // DUAS PESSOAS NA MESMA ETAPA: é o que prova que a linha AGRUPA, e não
    // repete a etapa uma vez por vínculo — a decisão de a juncão ser na tela.
    pessoas: [
      {
        id: EQUIPE_EXEMPLO[2].id,
        nome: EQUIPE_EXEMPLO[2].nome,
        avatar_url: null,
      },
      {
        id: EQUIPE_EXEMPLO[3].id,
        nome: EQUIPE_EXEMPLO[3].nome,
        avatar_url: null,
      },
    ],
  },
  {
    subtaskId: "b1000000-0000-4000-8000-000000000003",
    taskId: "a1000000-0000-4000-8000-000000000003",
    etapa: "Vídeo do depoimento — captação",
    demanda: "Lançamento da linha nova",
    cliente: "Mundo Verde",
    status: "nao_iniciada",
    prazo: null,
    // SEM RESPONSÁVEL, e ela é a linha que importa: etapa sem dono não está no
    // "Minhas Tasks" de ninguém, e é justamente ela que uma busca precisa
    // achar.
    pessoas: [],
  },
];
