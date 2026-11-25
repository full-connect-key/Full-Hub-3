"use client";

import { CalendarDays, Columns3, List, type LucideIcon } from "lucide-react";

import { ControleSegmentado } from "@/components/shared/controle-segmentado";
import { ANCORAS } from "@/lib/tour/ancoras";

export type Visao = "board" | "lista" | "calendario";

/**
 * AS TRÊS VISÕES, na ordem em que se lê a tela: o board é o panorama, a lista
 * é o detalhe, o calendário é o quando. Elas moram aqui e não em cada tela
 * pela razão de `STATUS_EM_ORDEM` e de `ICONE_DA_AREA`: duas cópias da mesma
 * ordem divergem na primeira vez que alguém mexe numa, e trocar de tela e ver
 * as mesmas três visões em outra sequência é a tela desmentindo a si mesma.
 */
export const VISOES: { chave: Visao; rotulo: string; Icone: LucideIcon }[] = [
  { chave: "board", rotulo: "Board", Icone: Columns3 },
  { chave: "lista", rotulo: "Lista", Icone: List },
  { chave: "calendario", rotulo: "Calendário", Icone: CalendarDays },
];

/**
 * O seletor de visualização — e ele NÃO é a barra de contexto.
 *
 * ---------------------------------------------------------------------------
 * **A distinção é o que impede duas barras iguais na mesma tela.** A
 * `BarraDeContexto` navega entre as SEÇÕES do módulo: cada uma carrega outra
 * consulta, outro conteúdo, e trocar de seção é trocar de página no servidor.
 * Isto aqui troca o DESENHO do mesmo conteúdo — as mesmas etapas em coluna, em
 * linha ou em dia. Em Gestão de Tasks os dois aparecem juntos, e com o mesmo
 * peso visual a pessoa leria "Demandas / Workflows" e "Board / Lista" como
 * duas metades da mesma escolha.
 *
 * Por isso ele é MENOR: pílula de `p-0.5` contra `p-1`, sem `rounded-xl`. A
 * hierarquia é a informação.
 * ---------------------------------------------------------------------------
 *
 * **Era o mesmo bloco escrito duas vezes**, em Gestão de Tasks e em Minhas
 * Tasks, e as duas telas mostram coisas diferentes com ele — lá um card por
 * demanda, aqui um card por etapa. O que se compartilha é o seletor, nunca o
 * que ele desenha: é a decisão do detalhe do material no Portal, onde a casca
 * é comum e a leitura é de cada um.
 *
 * **Botão e não link**, ao contrário da barra de contexto: quem muda a URL é o
 * `useFiltros` da tela, com `router.replace(..., { scroll: false })`. Com
 * `<Link>` cada troca de visão viraria uma entrada no histórico e a página
 * saltaria para o topo — e quem está no fim de uma lista de quarenta demandas
 * trocaria de visão para perder o lugar.
 */
export function SeletorDeVisao({
  atual,
  aoTrocar,
}: {
  atual: Visao;
  aoTrocar: (visao: Visao) => void;
}) {
  // -------------------------------------------------------------------------
  // A CASCA SAIU DAQUI e virou `ControleSegmentado`, porque a terceira cópia
  // dela nasceria no recorte do Acervo — e a segunda, nos Comodatos, já tinha
  // divergido em duas das oito classes. O que ficou aqui é a LISTA das três
  // visões e o argumento de por que ela mora num lugar só.
  //
  // O que o par nomeado resolveu continua escrito lá: `bg-muted/60` era a
  // regra da casa sendo quebrada em silêncio — opacidade sobre um fundo
  // qualquer dá uma cor que ninguém mediu, e no tema escuro dá outra.
  // -------------------------------------------------------------------------
  return (
    <ControleSegmentado
      opcoes={VISOES}
      atual={atual}
      aoTrocar={aoTrocar}
      rotuloAcessivel="Visualização"
      ancoraDoTour={ANCORAS.seletorDeVisao}
    />
  );
}
