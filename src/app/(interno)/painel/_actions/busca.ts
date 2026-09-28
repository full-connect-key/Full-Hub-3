"use server";

import { z } from "zod";

import { buscarNaPlataforma } from "@/lib/dados/busca";
import { exigirEquipeNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { MINIMO_PARA_BUSCAR, type GrupoDaBusca } from "@/lib/dominio/busca";

/**
 * A busca da topbar, pedida a cada pausa de digitação.
 *
 * **É UMA ACTION QUE LÊ, e o precedente é `buscarPreviaDoLink`.** A paleta é
 * `"use client"` e precisa de um resultado por termo, sem navegar: um Server
 * Component com o termo na URL recarregaria a página por tecla, e `lib/dados/`
 * é `server-only` e não atravessa a fronteira. Então o caminho é o contrato de
 * action que o produto já tem — `executarAcao` loga o erro inteiro no servidor,
 * e `chamarAcao` do outro lado não deixa nem a queda do servidor passar batida.
 *
 * **A GUARDA É `exigirEquipeNaAcao()` e não uma checagem de rota.** A busca não
 * é de nenhum módulo: ela atravessa nove, e cada um deles já tem a policy dele.
 * Uma guarda por rota aqui seria a segunda pergunta embaixo de uma primeira que
 * já barra quem não é da equipe — a lição da 0060 —, e ela recusaria uma busca
 * que o banco responde certo.
 *
 * **O cliente não alcança**, e é o que `exigirEquipeNaAcao` garante: o Portal
 * tem as telas dele, e uma busca que varre `assets` e `client_requests` não é
 * uma delas. A RLS recusaria de qualquer forma — esta é a camada de cima.
 */
export async function buscarNoPainel(
  termo: unknown,
): Promise<Resultado<{ grupos: GrupoDaBusca[]; termo: string }>> {
  return executarAcao("buscarNoPainel", async () => {
    await exigirEquipeNaAcao();

    // TERMO CURTO OU INVÁLIDO DEVOLVE VAZIO, e não recusa: quem está digitando
    // passa pelo primeiro caractere sempre, e uma recusa ali seria um toast por
    // tecla. `recusaDeValidacao` existe para o campo que a pessoa terminou de
    // preencher; aqui o campo está sendo preenchido.
    const validado = z.string().safeParse(termo);
    const limpo = validado.success ? validado.data.trim() : "";
    if (limpo.length < MINIMO_PARA_BUSCAR) {
      return sucesso("", { grupos: [], termo: limpo });
    }

    // O TERMO VOLTA JUNTO, e não é redundância: as respostas chegam fora de
    // ordem quando alguém digita rápido, e sem ele a paleta desenharia o
    // resultado de "mun" depois de a pessoa já ter escrito "mundo verde".
    return sucesso("", { grupos: await buscarNaPlataforma(limpo), termo: limpo });
  });
}
