"use server";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { findMenuItem } from "@/lib/auth/permissions";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * REGISTRAR QUE ALGUÉM ABRIU UM MÓDULO (0142).
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"o Acesso Rápido deve ser baseado na frequência de uso
 * de cada pessoa, e não uma lista fixa"*. O peso decai com meia-vida de 30
 * dias dentro do próprio `update` — a conta inteira e o porquê de ela não ser
 * uma contagem de vida inteira nem uma janela que zera estão no cabeçalho da
 * migration.
 * ---------------------------------------------------------------------------
 *
 * **A TRAVA DE VERDADE É A NORMALIZAÇÃO, e ela mora AQUI e não no banco.**
 * `findMenuItem()` casa pelo prefixo mais longo, então o que vai para a tabela
 * é o `href` de um item do `MENU` — `/painel/gestao-tasks/<uuid>` vira
 * `/painel/gestao-tasks`, e o que não casa com rota nenhuma **não é gravado**.
 * Sem ela a tabela viraria um depósito de endereço digitado, e o cartão
 * ofereceria um atalho para uma rota que não existe.
 *
 * **E NÃO HÁ UMA SEGUNDA PERGUNTA DE PERFIL NA ESCRITA**, que é a 0060: quem
 * não alcança a rota leva 403 ao abri-la e nunca chega a registrar nada, e o
 * cartão filtra por `canAccess()` na LEITURA de qualquer forma — uma checagem
 * aqui só recusaria quem o produto já recusa. Pior: ela ficaria ao lado de uma
 * segunda lista de perfis para divergir da do `MENU`.
 *
 * **NÃO HÁ `revalidatePath`, e a ausência é a decisão.** Esta action é chamada
 * em TODA navegação do painel; revalidar `/painel` a cada uma remontaria a
 * tela Início de quem está em outro módulo, para mudar a ordem de um cartão
 * que ela não está olhando. A ordem nova aparece na próxima visita ao Início,
 * que é quando ela decide alguma coisa.
 *
 * **E A RECUSA NÃO VOLTA PARA A TELA.** Quem chama é o gravador do layout, que
 * descarta o resultado de propósito (a razão está escrita lá): registrar uma
 * visita não é o trabalho de ninguém, e um aviso de erro em cima de uma tela
 * que abriu normalmente seria a plataforma reclamando de uma anotação. O erro
 * vai para o log pelo `executarAcao`, que é onde ele é procurado.
 */
export async function registrarVisita(href: string): Promise<Resultado> {
  return executarAcao("registrarVisita", async () => {
    await exigirSessaoNaAcao();

    const item = findMenuItem(href);
    // ROTA DESCONHECIDA NÃO É ERRO, é uma rota que não é módulo: a tela de
    // detalhe de uma demanda casa com `/painel/gestao-tasks` pelo prefixo, e
    // o que não casa com nada (um 404, um endereço digitado) não tem o que
    // registrar. Devolver falha faria o log encher de recusa sobre nada.
    if (!item) return sucesso("Rota fora do menu.");

    const supabase = await criarClienteServidor();
    // É UMA RPC E NÃO UM `upsert` DAQUI, e a razão é a corrida da 0040: a
    // conta do decaimento lê o peso e a âncora da própria linha, então em dois
    // comandos duas abas passariam pela leitura antes de qualquer uma gravar.
    // `registrar_visita` faz tudo num `insert ... on conflict do update`.
    const { error } = await supabase.rpc("registrar_visita", { p_href: item.href });
    if (error) return falha(error.message);

    return sucesso("Visita registrada.");
  });
}
