import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
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
 * **E ELA É DE `GESTAO`, com as três camadas de sempre.** `exigirAcessoARota`
 * responde pelo `MENU`, o `forbidden()` abaixo estreita, e a terceira é a que
 * vale: `/portal/{slug}` recusa o colaborador no servidor, e
 * `client_portal_views_select` fecha em `is_gestor()` desde a 0009. O
 * `forbidden()` existe porque `roles: GESTAO` já esconde o item — e esconder o
 * link nunca foi segurança neste produto.
 *
 * **MENOS DE DUAS SEÇÕES NÃO VIRA BARRA**, então o nome do módulo vem do
 * `PageHeader` — a regra que os Comodatos e as Notas Fiscais já aplicavam.
 */
export default async function PaginaDePortaisDeClientes() {
  const { profile } = await exigirAcessoARota(ROTA);
  if (!ehGestor(profile.role)) forbidden();

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
