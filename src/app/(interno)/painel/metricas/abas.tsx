"use client";

import { BadgeCheck, ChartColumn, CircleDollarSign, Hourglass, Scale } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";
import { ABAS_DE_METRICA, ROTULOS_DE_ABA, type AbaDeMetrica } from "@/lib/dominio/metricas";

const ICONES: Record<AbaDeMetrica, typeof ChartColumn> = {
  producao: ChartColumn,
  tempo: Hourglass,
  equipe: Scale,
  qualidade: BadgeCheck,
  rentabilidade: CircleDollarSign,
};

/**
 * As seções, na URL — como em toda listagem do produto.
 *
 * "Olha a rentabilidade do trimestre" precisa ser um link, e com estado
 * interno ele cairia na seção padrão com o período padrão.
 *
 * **Trocar de seção NÃO reseta o período.** O recorte é a pergunta que a
 * pessoa está fazendo; a seção é por qual ângulo ela olha. Zerar para "últimos
 * 30 dias" a cada troca faria quem está comparando o trimestre refazer a
 * escolha cinco vezes.
 *
 * **`visiveis` espelha a primeira linha de cada função da 0035**, e é o módulo
 * que decide: quatro exigem `is_gestor()` e a rentabilidade exige
 * `is_socio()`. Esconder a seção não é a proteção — `?aba=rentabilidade`
 * digitado leva 403 e a RPC chamada direto leva a recusa do Postgres.
 */
export function AbasDeMetrica({
  atual,
  visiveis,
}: {
  atual: AbaDeMetrica;
  visiveis: AbaDeMetrica[];
}) {
  const secoes: SecaoDoModulo<AbaDeMetrica>[] = ABAS_DE_METRICA.filter((aba) =>
    visiveis.includes(aba),
  ).map((aba) => ({ chave: aba, rotulo: ROTULOS_DE_ABA[aba], Icone: ICONES[aba] }));

  return (
    <BarraDeContexto
      rotuloAcessivel="Seções das Métricas"
      titulo="Métricas"
      atual={atual}
      secoes={secoes}
      // O filtro de cliente é só da Produção: a 0035 não recebe cliente nas
      // outras quatro, e levá-lo junto deixaria na URL um parâmetro que a tela
      // ignora — o tipo de coisa que faz alguém mandar um link achando que
      // mandou o recorte.
      limparAoSair={(destino) => (destino === "producao" ? [] : ["cliente"])}
    />
  );
}
