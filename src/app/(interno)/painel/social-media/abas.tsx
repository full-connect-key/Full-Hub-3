"use client";

import { Images, Workflow } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

export type AbaDoSocial = "posts" | "fluxos";

/**
 * As duas seções de Social Media (migration 0087).
 *
 * ---------------------------------------------------------------------------
 * **ESTE ARQUIVO É CLIENTE, E A RAZÃO É MECÂNICA.** `SecaoDoModulo` carrega um
 * `Icone` — um componente do lucide —, e componente não atravessa a fronteira
 * dentro de um objeto: montar a lista num Server Component e passá-la ao
 * `BarraDeContexto` derruba a página com *"Functions cannot be passed directly
 * to Client Components"*. É a família do valor exportado de arquivo `"use
 * client"`, vista do outro lado.
 *
 * E ele é o oitavo `abas.tsx` do produto depois de a `BarraDeContexto` ter
 * desfeito sete — o que ela centralizou é o DESENHO e o MECANISMO, nunca a
 * lista: *"cada módulo continua dizendo quais são as seções dele, quais o
 * perfil de quem está olhando alcança, e o que contar no selo"*.
 *
 * **QUEM NÃO É GESTÃO NÃO GANHA A BARRA.** Menos de duas seções não vira barra
 * — a regra que os Comodatos e as Notas Fiscais já aplicavam: uma navegação de
 * um item é moldura sem função. Quem decide isso é a página, que desenha o
 * `PageHeader` no lugar.
 * ---------------------------------------------------------------------------
 */
const SECOES: SecaoDoModulo<AbaDoSocial>[] = [
  { chave: "posts", rotulo: "Posts", Icone: Images },
  { chave: "fluxos", rotulo: "Fluxos", Icone: Workflow },
];

export function AbasDoSocial({ atual }: { atual: AbaDoSocial }) {
  return (
    <BarraDeContexto
      rotuloAcessivel="Seções de Social Media"
      titulo="Social Media"
      atual={atual}
      secoes={SECOES}
      // OS FILTROS DOS POSTS NÃO ATRAVESSAM PARA FLUXOS, e não é zelo: um
      // `?cliente=` sobrevivendo até a volta filtraria a lista de posts por uma
      // conta que a pessoa escolheu antes de ir montar um fluxo. É a decisão
      // das quatro abas de Gestão de Tasks.
      limparAoSair={(destino) =>
        destino === "fluxos" ? ["visao", "mes", "cliente", "foco", "post"] : []
      }
    />
  );
}
