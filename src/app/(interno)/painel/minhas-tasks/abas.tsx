"use client";

import { ListChecks, Users } from "lucide-react";

import { BarraDeContexto } from "@/components/shared/barra-de-contexto";

import type { Secao } from "./vocabulario";

/**
 * A BARRA DAS DUAS SEÇÕES, e ela é um componente de CLIENTE pela mesma razão
 * que as outras nove barras do produto são.
 *
 * ---------------------------------------------------------------------------
 * **E ESTE ARQUIVO EXISTE POR UM BUG QUE SÓ O PROTÓTIPO PEGOU.** A primeira
 * versão montava a barra dentro da `page.tsx`, que é de SERVIDOR, e passava
 * duas coisas que não atravessam a fronteira: o `Icone` de cada seção, que é
 * um objeto `forwardRef` do lucide, e o `limparAoSair`, que é uma FUNÇÃO.
 * A tela respondia 500 nas duas seções, com *"Functions cannot be passed
 * directly to Client Components"* — e o `tsc`, o `lint` e o `npm run build`
 * passaram os três, porque nenhum deles pede a página.
 *
 * É a mesma família do valor exportado de arquivo cliente que derrubou a
 * Gestão de Pessoas, vista do outro lado: ali o servidor CHAMAVA uma função do
 * cliente, aqui ele MANDA uma para ele. E é por isso que as sete barras
 * antigas nunca bateram nisto — cada módulo tem o `abas.tsx` dele, e a lista
 * de seções nasce já do lado de cá.
 * ---------------------------------------------------------------------------
 *
 * **O SELETOR DE VISÃO FICA DENTRO DE "O meu dia"**, menor que esta barra e no
 * tamanho que ele já tinha: com o mesmo peso, a pessoa leria "O meu dia / Da
 * equipe" e "Board / Lista" como duas metades da mesma escolha — é a decisão
 * escrita da Gestão de Tasks, onde os dois também aparecem juntos.
 */
export function AbasDeMinhasTasks({ ativa }: { ativa: Secao }) {
  return (
    <BarraDeContexto<Secao>
      rotuloAcessivel="Seções de Minhas Tasks"
      atual={ativa}
      secoes={[
        { chave: "minhas", rotulo: "O meu dia", Icone: ListChecks },
        { chave: "equipe", rotulo: "Da equipe", Icone: Users },
      ]}
      /* O QUE NÃO FAZ SENTIDO DO OUTRO LADO SAI DA URL. `visao` e `foco`
         recortam a MINHA lista, e `pessoa` escolhe alguém da equipe —
         atravessando, eles ficariam na barra de endereço afirmando um recorte
         que a seção de destino não aplica, e voltariam a valer no clique de
         volta sem ninguém ter pedido. */
      limparAoSair={(destino) =>
        destino === "equipe" ? ["visao", "foco"] : ["pessoa"]
      }
    />
  );
}
