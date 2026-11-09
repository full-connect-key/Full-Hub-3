import type { Resultado } from "@/lib/acoes/tipos";
import type { Conteudo } from "@/lib/aprovacoes/conteudo";
import { CLIENTES_EXEMPLO, PROFILE_CLIENTE } from "./dados-exemplo";

/**
 * QUEM PODE APROVAR, NO PROTÓTIPO.
 *
 * **ESTE É O PRIMEIRO STUB DE _ACTION_ DO GERADOR, e a exceção tem razão
 * escrita.** A regra é a que está no comentário da tela de encerrar o mês: *o
 * protótipo troca `lib/dados/`, nunca `_actions`* — e é por isso que o diálogo
 * com a contagem de "Apagar o mês" não tem imagem. Sem Supabase a ação recusa,
 * e a imagem sairia provando o caminho de falha no lugar do que se queria
 * conferir.
 *
 * **O QUE MUDOU É QUE AGORA UMA IMAGEM QUE JÁ EXISTE DEPENDE DELA.**
 * `envio-do-mes.tsx` passou a ler quem aprova na montagem (0128), e aquele
 * componente é desenhado dentro de `57f-social-encerrar-o-mes`. Sem o stub, a
 * seção do envio sairia com a linha de recusa — ou seja, a entrega NOVA
 * degradaria uma conferência VELHA. É o caso que o comentário de lá previu com
 * as palavras *"é decisão explícita quando valer"*.
 *
 * **E O MECANISMO JÁ EXISTIA:** `SUBSTITUICOES` é o mapa de `paths` do
 * tsconfig, e trocar uma action por aqui é a mesma linha que troca um módulo
 * de `lib/dados/`. O que não existe — e continua não existindo — é um stub por
 * action: este é um, pela razão acima, e não a abertura de uma série.
 *
 * **A EMPRESA SAI DO PRIMEIRO CLIENTE DO EXEMPLO**, e não de uma string
 * inventada: a frase da recusa e o rótulo do campo nomeiam a conta, e um nome
 * de fantasia faria a imagem conferir um texto que o produto não escreve.
 *
 * **E O TIPO VEM DE `lib/acoes/tipos`, NUNCA DE `lib/acoes/resultado`.** Este
 * é o preço de trocar uma action: no produto ela é uma fronteira `"use
 * server"`, e o navegador recebe só uma referência; trocada por um módulo
 * comum, ela passa a ser *compilada no bundle do cliente* — e `resultado.ts`
 * tem `import "server-only"`. A primeira versão importava `sucesso()` de lá e
 * a rodada parou com *"It should only be used from a Server Component"*,
 * arrastando o Social Media inteiro no rastro. `tipos.ts` existe exatamente
 * para isto, e o comentário dele já dizia: *"as telas precisam do tipo, e
 * `resultado.ts` tem `import \"server-only\"`"*. O literal `{ ok, mensagem,
 * dados }` é o que `sucesso()` devolve, palavra por palavra.
 */
export type AprovadorDaConta = { id: string; nome: string; email: string };

export type QuemPodeAprovar = {
  clienteId: string;
  empresa: string;
  aprovadores: AprovadorDaConta[];
};

export async function quemPodeAprovar(
  _conteudo: Conteudo,
): Promise<Resultado<QuemPodeAprovar>> {
  const conta = CLIENTES_EXEMPLO[0];
  return {
    ok: true,
    mensagem: "",
    dados: {
      clienteId: conta.id,
      empresa: conta.nome_empresa,
      // UMA PESSOA SÓ, e é o que faz a imagem mostrar o campo PREENCHIDO: a tela
      // pré-seleciona quando há exatamente uma (não há escolha a fazer), e com
      // duas ela abriria no placeholder. O estado que a conferência precisa ver
      // é o do nome na linha, porque é ele que diz quem vai receber.
      aprovadores: [
        {
          id: PROFILE_CLIENTE.id,
          nome: PROFILE_CLIENTE.nome,
          email: PROFILE_CLIENTE.email,
        },
      ],
    },
  };
}

/**
 * TROCAR QUEM APROVA e REENVIAR O AVISO, no prototipo (0129).
 *
 * **Elas nao existem para serem CLICADAS numa imagem, e sim para os dois
 * botoes aparecerem:** `HistoricoDeAprovacoes` as importa, e sem o stub a
 * compilacao do gerador quebra -- depois de dois minutos, que e a janela que o
 * `check:prototipo` existe para fechar. Nenhuma tela do prototipo clica nelas:
 * a troca abre um seletor que leria a lista da conta, e a imagem que importa e
 * a do historico em repouso, com a linha de quem espera e os dois botoes ao
 * lado dela.
 *
 * **E as duas devolvem `ok`**, nao a recusa: um `ok: false` aqui pintaria o
 * toast de erro na primeira rodada que alguem clicasse, provando o caminho de
 * falha no lugar do que se queria conferir.
 */
export async function trocarAprovadores(
  _roundId: string,
  aprovadorIds: string[],
): Promise<Resultado<number>> {
  return {
    ok: true,
    mensagem:
      aprovadorIds.length === 1
        ? "Uma pessoa esta nomeada para aprovar."
        : `${aprovadorIds.length} pessoas estao nomeadas para aprovar.`,
    dados: aprovadorIds.length,
  };
}

export async function reenviarAviso(
  _roundId: string,
): Promise<Resultado<number>> {
  return { ok: true, mensagem: "O aviso saiu de novo.", dados: 1 };
}
