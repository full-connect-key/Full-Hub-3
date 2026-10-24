"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CampanhaParaEscolher } from "@/lib/dados/campanhas";
import type { RequestType } from "@/lib/supabase/database.types";

import { FormularioDePedido } from "./formulario";

/**
 * Abrir uma solicitação virou um PAINEL LATERAL, e não mais uma tela.
 *
 * ---------------------------------------------------------------------------
 * **A PROMESSA É A RAZÃO:** *"o cliente abre um pedido em segundos e ele cai
 * direto na operação do time"*. Numa rota própria, pedir alguma coisa custava
 * sair da lista, preencher, e voltar — e quem abria o portal para outra coisa
 * perdia o lugar. No painel a lista continua atrás, e fechar devolve a pessoa
 * exatamente onde ela estava.
 *
 * **O ESTADO MORA NA URL**, `?novo=1`, como todo filtro de listagem deste
 * produto. Em estado de componente, "abre o painel de pedido já na campanha
 * X" não teria como ser um link — e é justamente o que o botão *"Nova
 * solicitação nesta campanha"* precisa ser. De quebra, o endereço antigo
 * `/solicitacoes/novo` continua valendo: ele redireciona para cá, e quem o
 * tinha no favorito cai no painel aberto em vez de num 404.
 *
 * **E ELE NÃO É `Dialog`**, que seria o reflexo: um diálogo centralizado de
 * 540px cobre a lista inteira e vira a mesma tela cheia que esta mudança está
 * desfazendo. O `Sheet` entra pela direita e deixa a lista à vista, que é o
 * que faz a pessoa saber que não foi para lugar nenhum.
 * ---------------------------------------------------------------------------
 *
 * **O FORMULÁRIO É O MESMO COMPONENTE, nunca uma cópia.** Ele tem 440 linhas,
 * com o roteiro de briefing que muda por tipo de trabalho, os anexos que sobem
 * depois de o pedido nascer e a frase do que falta. Uma segunda versão dele
 * dentro do painel divergiria na primeira mudança — e o lado que ficaria para
 * trás é este, que é o único que o cliente usa.
 */
export function PainelDeNovaSolicitacao({
  empresas,
  tipos,
  campanhas,
  base = "/portal",
}: {
  empresas: { id: string; nome_empresa: string }[];
  tipos: RequestType[];
  campanhas: CampanhaParaEscolher[];
  base?: string;
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const aberto = parametros.get("novo") === "1";

  /**
   * `?campanha=` É O QUE O BOTÃO DA CAMPANHA ESCREVE, e é por isso que o
   * estado do painel mora na URL: *"abre o pedido já nesta campanha"* precisa
   * ser um link, e em estado de componente não teria como ser.
   *
   * Valor torto não é recusado aqui — ele chega ao formulário, que só o aceita
   * se estiver na lista das campanhas abertas daquela empresa. É a convenção
   * de `ehVisao()`: o endereço estranho abre a tela, e não quebra.
   */
  const campanhaInicial = parametros.get("campanha") ?? undefined;

  function fechar() {
    const outros = new URLSearchParams(parametros);
    outros.delete("novo");
    // A CAMPANHA SAI COM O PAINEL. Ela é o estado DELE, não um filtro da
    // lista: deixá-la no endereço faria o próximo "+ Nova solicitação" abrir
    // já dentro de uma campanha que ninguém escolheu agora.
    outros.delete("campanha");
    const consulta = outros.toString();
    // `scroll: false` porque fechar o painel não é trocar de página: sem ele a
    // lista volta para o topo, e quem estava no fim de quarenta pedidos perde
    // o lugar — a mesma decisão do seletor de visão.
    router.replace(
      `${base}/solicitacoes${consulta ? `?${consulta}` : ""}`,
      { scroll: false },
    );
  }

  return (
    <Sheet open={aberto} onOpenChange={(v) => (v ? null : fechar())}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[540px]"
      >
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="text-xl">Nova solicitação</SheetTitle>
          <SheetDescription>
            Conte o que você precisa. O time recebe assim que você enviar.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-8">
          <FormularioDePedido
            key={campanhaInicial ?? "solto"}
            empresas={empresas}
            tipos={tipos}
            campanhas={campanhas}
            campanhaInicial={campanhaInicial}
            aoConcluir={() => {
              fechar();
              // A LISTA ATRÁS JÁ ESTÁ EM ORDEM DO MAIS NOVO PARA O MAIS
              // ANTIGO, então o pedido que acabou de nascer aparece no topo
              // assim que o servidor responder.
              router.refresh();
              toast.success("Solicitação enviada", {
                description: "Já está com o time.",
              });
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
