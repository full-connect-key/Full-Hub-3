"use server";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { TourStatus } from "@/lib/supabase/database.types";

/**
 * UMA AÇÃO SÓ GRAVA O TOUR, e isso é escolha.
 *
 * ---------------------------------------------------------------------------
 * Começar, avançar um passo e encerrar parecem três coisas e são a MESMA
 * escrita: a linha de `(user_id, tour_id)` é única desde a 0101, e o que muda
 * entre os três é o status e o número do passo. Três actions com três
 * `upsert` quase idênticos divergiriam na primeira vez que alguém mexesse numa
 * — e a que divergiria é a de encerrar, que é a que roda uma vez por pessoa
 * por tour.
 *
 * **E O PROVEDOR É O ÚNICO ESCRITOR DURANTE UMA PASSADA**, o que é o que
 * permite as duas listas viajarem INTEIRAS a cada gravação em vez de um
 * `array_append` no banco. Elas descrevem a passada CORRENTE — `iniciado_em`
 * volta a `now()` na transição para `em_andamento`, então refazer o tour
 * recomeça o par e as listas recomeçam com ele. Um append acumularia as
 * passadas antigas, e o alarme de tour quebrado passaria a contar o mesmo
 * seletor três vezes porque a pessoa refez o tour três vezes.
 * ---------------------------------------------------------------------------
 *
 * **AS DUAS DATAS NÃO VIAJAM, e tentar mandá-las é erro de tipo:** quem as
 * escreve é o trigger `tour_progresso_carimba`, que descarta o que vier no
 * pedido — e `iniciado_em` e `finalizado_em` ficam fora de `Insert` e de
 * `Update` em `database.types.ts` por isso.
 */

export type EstadoDoTour = {
  tourId: string;
  versao: number;
  status: TourStatus;
  passoAtual: number;
  /** Os passos que a PESSOA escolheu pular. */
  pulados: string[];
  /** Os passos cujo elemento não apareceu em 2s. É o alarme de tour quebrado. */
  semAncora: string[];
};

export async function salvarOTour(estado: EstadoDoTour): Promise<Resultado> {
  return executarAcao("salvarOTour", async () => {
    const sessao = await exigirSessaoNaAcao();
    const supabase = await criarClienteServidor();

    const { error } = await supabase.from("tour_progresso").upsert(
      {
        // `user_id` VEM DA SESSÃO e nunca do navegador, e isto não é zelo: o
        // `with check` da policy recusaria o de outra pessoa, mas a recusa
        // chegaria como erro de RLS numa tela que está só anotando um passo.
        // A trava é a policy; aqui é a pergunta certa.
        user_id: sessao.usuarioId,
        tour_id: estado.tourId,
        versao: estado.versao,
        status: estado.status,
        passo_atual: estado.passoAtual,
        passos_pulados: estado.pulados,
        passos_sem_ancora: estado.semAncora,
      },
      { onConflict: "user_id,tour_id" },
    );

    if (error) return falha(error.message);

    // NENHUM `revalidatePath`, e a ausência é decisão. O tour é uma camada por
    // cima da página — nada do que ele grava muda o que a página mostra, e
    // revalidar o layout a cada passo faria o painel inteiro ser remontado no
    // servidor sete vezes seguidas por causa de um tutorial. O que depende
    // disto é o diálogo de boas-vindas, que só é lido na próxima visita.
    return sucesso("Pronto.");
  });
}
