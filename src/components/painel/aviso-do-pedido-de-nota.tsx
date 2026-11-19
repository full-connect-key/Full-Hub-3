"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, X } from "lucide-react";

import { dispensarPedidoDeNota } from "@/app/(interno)/painel/notas-fiscais/acoes";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";
import { fraseDoPrazo, mesPorExtenso } from "@/lib/dominio/notas-fiscais";
import type { PedidoDeNota } from "@/lib/dominio/notas-fiscais";

const ROTA_DAS_NOTAS = "/painel/notas-fiscais";

/**
 * "O Financeiro pediu a sua nota fiscal" — o aviso que atravessa o painel
 * (0143).
 *
 * ---------------------------------------------------------------------------
 * **ELE MORA NO LAYOUT, e é isso que o pedido quer dizer.** Decisão do
 * usuário, item 12: *"o aviso deve aparecer em formato de pop-up global,
 * independentemente da aba ou página em que o usuário esteja (…) em toda a
 * área interna do sistema"*. É a razão de `AtualizacaoAoVivo`, do convite de
 * micro-tour e do gravador de visitas estarem no mesmo lugar: o que não é
 * específico de tela não se escreve por tela, e a vigésima primeira tela
 * nasceria sem o aviso sem nada quebrar.
 *
 * **E ELE NÃO BLOQUEIA.** Um diálogo modal pararia o trabalho de quem está no
 * meio de uma entrega por causa de uma nota que a pessoa pode mandar hoje à
 * noite — e a regra escrita do módulo desde a 0066 é que o prazo **avisa,
 * nunca recusa**. O que ele faz é ficar à vista até alguém fechá-lo, que é o
 * que "pop-up" quer dizer aqui.
 * ---------------------------------------------------------------------------
 *
 * **EM TEMPO REAL SEM NADA NOVO NO FIO.** O aviso chega porque
 * `solicitarNotasDoMes` anuncia no `CANAL_DA_EQUIPE`, `AtualizacaoAoVivo`
 * chama `router.refresh()`, e o layout — que é Server Component — relê os
 * pedidos em aberto. **O que viaja continua sendo o SINAL e nunca a linha**,
 * que é a decisão escrita daquele canal: quem decide o que cada pessoa vê é o
 * Postgres, numa renderização de servidor como qualquer outra.
 *
 * **ELE NÃO APARECE NA TELA PARA ONDE ELE MANDA.** Em `/painel/notas-fiscais`
 * a faixa diz a mesma coisa, em caráter permanente, a poucos centímetros — os
 * dois juntos seriam o mesmo fato duas vezes, que é o cartão de "11 entregues"
 * com sete na lista embaixo.
 */
export function AvisoDoPedidoDeNota({
  pedidos,
  hojeISO,
}: {
  pedidos: PedidoDeNota[];
  hojeISO: string;
}) {
  const caminho = usePathname();

  /**
   * O QUE FOI FECHADO NESTA SESSÃO.
   *
   * A escrita é a que vale, e o `revalidatePath` a traz de volta — mas o
   * layout do App Router não é remontado ao navegar entre as telas dele, e
   * entre o clique e a revalidação o aviso continuaria na tela. Sem este
   * estado, fechar pareceria não ter funcionado.
   */
  const [fechados, setFechados] = useState<string[]>([]);

  const abertos = pedidos.filter((pedido) => !fechados.includes(pedido.pedidoId));

  if (abertos.length === 0) return null;
  if (caminho?.startsWith(ROTA_DAS_NOTAS)) return null;

  /**
   * IR PARA NOTAS FISCAIS TAMBÉM DISPENSA, e é a leitura literal do pedido:
   * *"dispense o pop-up após visualizar a solicitação"*. Quem clica em
   * "Enviar a nota" está indo ver — e, chegando lá, a faixa da tela diz a
   * mesma coisa. Sem esta linha o aviso voltaria na primeira navegação para
   * fora, cobrando o que a pessoa acabou de atender.
   */
  function dispensar() {
    setFechados((antes) => [...antes, ...abertos.map((p) => p.pedidoId)]);
    for (const pedido of abertos) {
      // SEM `chamarEMostrar`: um toast verde por aviso fechado seria uma
      // segunda interrupção logo depois da que a pessoa acabou de encerrar.
      // A falha vai para o log pelo `executarAcao`, e o preço de uma dispensa
      // perdida é o aviso voltar na próxima navegação.
      void chamarAcao(() => dispensarPedidoDeNota(pedido.pedidoId));
    }
  }

  return (
    /*
      FIXO NO ALTO À DIREITA, abaixo da topbar.

      O canto de BAIXO à direita já é do convite de micro-tour (`bottom-6`), e
      dois cartões empilhados ali se cobririam no dia em que alguém abrisse um
      módulo pela primeira vez com a nota do mês em aberto. No alto ele também
      lê como o que é: um recado da casa, logo abaixo do sino.

      **E À DIREITA, NUNCA CENTRADO — foi a imagem que mandou.** Centrado ele
      caía exatamente em cima do `<h1>` da página: em Minhas Tasks a imagem
      saiu com *"Bom dia, C…"* por baixo do aviso. Um pop-up global cobre
      alguma coisa por definição; o que ele não pode cobrir é o nome da tela,
      que é a primeira coisa que diz onde a pessoa está. À direita ele fica
      acima da coluna de 306px, que começa mais abaixo.

      `z-40` fica ACIMA da topbar grudada (`z-30`) e ABAIXO do véu de um
      diálogo (`z-50`): no primeiro acesso, o convite do tour é modal e este
      espera atrás dele, que é a ordem certa.
    */
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-20 z-40 sm:inset-x-auto sm:right-6 sm:w-[24rem]"
    >
      <div className="bg-warning-soft text-warning shadow-cartao rounded-card flex items-start gap-3 p-4">
        <Receipt aria-hidden className="mt-0.5 size-5 shrink-0" />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            {abertos.map((pedido) => (
              <p key={pedido.pedidoId} className="text-sm">
                O Financeiro pediu a sua nota de{" "}
                <strong>{mesPorExtenso(pedido.competencia)}</strong>.{" "}
                {fraseDoPrazo(pedido, hojeISO)}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" onClick={dispensar}>
              <Link href={ROTA_DAS_NOTAS}>Enviar a nota</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={dispensar}>
              Agora não
            </Button>
          </div>

          {/* O REGISTRO FICA NA CENTRAL, e a frase diz isso — é a outra metade
              do pedido: *"mantendo o registro na central de notificações"*.
              Dispensar aqui não escreve `lida_em`, então o sino continua
              contando o aviso até a pessoa abri-lo de verdade.

              E ELA MORA DENTRO DO CARTÃO, o que só a imagem pegou: fora dele
              ela saía sem chão nenhum, por cima do conteúdo da página — lia
              como texto solto no meio da tela, e não como a letra miúda de um
              aviso. */}
          <p className="text-xs">
            O pedido continua no sino, e na tela de Notas Fiscais.
          </p>
        </div>

        {/* O X FAZ O MESMO QUE "Agora não", e é de propósito: um fechar que
            não grava faria o aviso voltar na navegação seguinte, e quem
            fechou duas vezes concluiria que o botão não funciona. É a decisão
            do convite de micro-tour, palavra por palavra.

            E O HOVER É O PAR NOMEADO: opacidade sobre um fundo qualquer dá uma
            cor que ninguém mediu, e no tema escuro dá outra. A varredura pegou
            a minha primeira versão — é a regra mais repetida do CLAUDE.md, e
            eu a quebrei escrevendo o aviso que ela protege. O par é o do
            `AvisoDeVisualizacao` do portal, que já está medido. */}
        <button
          type="button"
          onClick={dispensar}
          aria-label="Dispensar o aviso"
          className="hover:bg-warning hover:text-warning-foreground -m-1 shrink-0 rounded p-1 transition-colors"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

    </div>
  );
}
