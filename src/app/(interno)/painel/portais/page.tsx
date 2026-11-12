import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarPortaisDeClientes } from "@/lib/dados/portais-de-clientes";

import { PortaisDeClientes } from "./grade";

export const metadata: Metadata = { title: "Portais de Clientes" };

const ROTA = "/painel/portais";

/**
 * A lista de clientes, com o portal de cada um a um clique.
 *
 * ---------------------------------------------------------------------------
 * **ELA ERA UMA SEÇÃO DA TELA INÍCIO**, e saiu de lá por decisão do usuário:
 * *"tire a lista de clientes da aba inicial e crie uma aba na lateral com a
 * lista dos clientes"*.
 *
 * **A ENTRADA NO MENU É O QUE FAZ ISSO SER UMA MUDANÇA DE LUGAR E NÃO UM
 * SUMIÇO**, e é a lição das duas entradas que saíram da barra no Sprint 3J:
 * Social Media e Campanhas só puderam sair porque a faixa das três áreas de
 * Minhas Tasks passou a nomeá-las — *tirar um item de menu de um módulo que
 * não aparece em mais lugar nenhum não é enxugar a barra, é esconder o
 * módulo*. Aqui o movimento é o contrário: a grade está PERDENDO a casa que
 * tinha, então ela precisa ganhar uma. Sem a linha no `MENU`, o portal de um
 * cliente passaria a ser alcançável só digitando `/portal/{slug}` na barra de
 * endereço.
 *
 * ***O que isso custa, e é dito em vez de escondido:*** a barra lateral volta
 * a crescer um item, na direção oposta à do Sprint 3J (*"para diminuir a
 * quantidade de itens na aba lateral"*). É o preço de a grade continuar
 * existindo em algum lugar, e quem decidiu sabe disso.
 * ---------------------------------------------------------------------------
 *
 * **O RÓTULO NÃO É "CLIENTES", e a escolha importa.** "Clientes" já é o nome
 * de uma aba — a de Gestão de Pessoas, que leva ao CADASTRO: ficha, contato,
 * vínculos de acesso, zona de perigo. Esta tela responde outra coisa — *o que
 * este cliente está vendo?* — e abre o portal dele em aba nova. Dois itens com
 * o mesmo nome levando a telas diferentes é como se aprende a procurar na
 * errada, que é o argumento que renomeou "Aprovações & Conteúdo" para
 * "Campanhas" e que desfez as duas entradas do Social Media.
 *
 * **E ELA É DA EQUIPE INTEIRA, por decisão do usuário** — *"preciso que passe
 * a aba Portal dos Clientes, para a aba Principal, com acesso de todos"*. O
 * parágrafo que estava escrito aqui dizia que ela era de `GESTAO` porque
 * `/portal/{slug}` recusava o colaborador no servidor, e as duas pontas saíram
 * no mesmo commit: um item de menu apontando para uma rota que devolve 403 é o
 * chip de "Demandas" de Minhas Tasks pela segunda vez.
 *
 * **E NÃO HÁ `forbidden()` AQUI**, porque não há a quem recusar: `roles:
 * EQUIPE` e `exigirAcessoARota` respondem a mesma pergunta, e uma segunda
 * pergunta embaixo de uma primeira que já barra todo mundo não barra ninguém —
 * a 0060. Quem recorta de verdade é a RLS: `clients_select` é `is_staff()`
 * desde a 0002, então a grade sempre soube responder para a equipe inteira, e
 * `client_portal_views_select` continua em `is_gestor()` — quem andou vendo o
 * portal de quem é informação sobre as outras pessoas, e essa metade é de
 * gestão.
 *
 * **O que a tela NÃO deixa fazer continua valendo para todo mundo**: dentro de
 * `/portal/{slug}` ninguém decide, ninguém comenta e ninguém escreve em nome
 * do cliente — `comoEquipe` desliga as três decisões e a conversa, e
 * `decidir_rodada_do_cliente` recusa no banco quem não é o cliente daquela
 * rodada. A visita é leitura, e é por isso que ela pode ser de todos.
 *
 * **MENOS DE DUAS SEÇÕES NÃO VIRA BARRA**, então o nome do módulo vem do
 * `PageHeader` — a regra que os Comodatos e as Notas Fiscais já aplicavam.
 */
export default async function PaginaDePortaisDeClientes() {
  await exigirAcessoARota(ROTA);

  const clientes = await listarPortaisDeClientes();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portais de Clientes"
        subtitulo={
          clientes.length === 1
            ? "1 cliente ativo"
            : `${clientes.length} clientes ativos`
        }
      />

      {/* A FRASE VEM ANTES DA GRADE, e não depois dela. Ela diz o que o clique
          faz — e o que ele NÃO faz. Abrir o portal de um cliente parece login
          como cliente, e não é: a sessão continua sendo a da pessoa da agência,
          nada é "impersonado", e a visita deixa rastro em `client_portal_views`
          (0009), que a ficha do cliente lê. Lida depois dos cartões, ela
          explicaria o que a pessoa já fez. */}
      <p className="text-text-secondary max-w-prose text-sm">
        Abrir um portal mostra a tela que aquele cliente vê, em modo leitura e
        em uma aba nova. Você continua conectado como você — a visita fica
        registrada na ficha dele.
      </p>

      <PortaisDeClientes clientes={clientes} />
    </div>
  );
}
