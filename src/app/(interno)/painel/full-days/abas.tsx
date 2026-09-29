"use client";

import {
  BadgeCheck,
  CalendarRange,
  ChartColumn,
  Grid3x3,
  History,
} from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

export type Aba =
  | "matriz"
  | "relatorio"
  | "solicitar"
  | "aprovacoes"
  | "lancamentos";

/**
 * As CHAVES continuam `solicitar` e `aprovacoes` porque estão na URL, e link
 * antigo que quebra é pior que nome antigo em código. Os RÓTULOS mudaram: a
 * equipe é PJ, e uma aba chamada "Aprovações" contradiria, na mesma tela, o
 * "De acordo" / "Preciso remarcar" dos botões logo abaixo dela.
 */
const ROTULOS: Record<Aba, { rotulo: string; Icone: typeof Grid3x3 }> = {
  matriz: { rotulo: "Matriz da Equipe", Icone: Grid3x3 },
  relatorio: { rotulo: "Relatório Gerencial", Icone: ChartColumn },
  solicitar: { rotulo: "Propor período", Icone: CalendarRange },
  aprovacoes: { rotulo: "Pedidos da equipe", Icone: BadgeCheck },
  // "REGISTRAR PERÍODO", e não "Lançamentos". A chave na URL ficou
  // `lancamentos` porque é o nome do que o banco faz; o rótulo diz o que a
  // pessoa vai fazer ali. "Lançamento" é palavra do Financeiro neste produto,
  // e a mesma palavra em dois módulos para duas coisas diferentes é como se
  // aprende a ler errado as duas.
  lancamentos: { rotulo: "Registrar período", Icone: History },
};

/**
 * As seções, na URL.
 *
 * Link e não estado: o sócio precisa poder mandar "olha a fila" por mensagem,
 * e a notificação do sino aponta direto para `?aba=aprovacoes`. Com estado
 * interno, os dois links cairiam na seção padrão.
 *
 * Trocar de seção troca a página no servidor, e é por isso que cada uma
 * carrega só a própria consulta — a matriz do mês inteiro não é buscada por
 * quem abriu para combinar um dia fora.
 *
 * Com uma seção só, a barra some: para quem só propõe o próprio período, uma
 * "navegação" de um item é moldura sem função. Quem aplica a regra agora é a
 * `BarraDeContexto`, e o desenho em pílula que este arquivo defendia virou o
 * desenho de todos os módulos.
 */
export function AbasDoFullDays({
  atual,
  visiveis,
  acoes,
}: {
  atual: Aba;
  visiveis: Aba[];
  acoes?: React.ReactNode;
}) {
  const secoes: SecaoDoModulo<Aba>[] = visiveis.map((aba) => ({ chave: aba, ...ROTULOS[aba] }));

  return (
    <BarraDeContexto
      rotuloAcessivel="Seções do Full Days"
      titulo="Full Days"
      atual={atual}
      secoes={secoes}
      acoes={acoes}
      // A fila é da seção de pedidos; carregá-la para a matriz confundiria a
      // leitura da URL sem mudar nada na tela.
      limparAoSair={(destino) => (destino === "aprovacoes" ? [] : ["fila"])}
    />
  );
}
