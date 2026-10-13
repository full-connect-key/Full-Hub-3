"use client";

import { BadgeCheck, ChartColumn, Hourglass, Scale } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";
import { ABAS_DE_METRICA, ROTULOS_DE_ABA, type AbaDeMetrica } from "@/lib/dominio/metricas";

const ICONES: Record<AbaDeMetrica, typeof ChartColumn> = {
  producao: ChartColumn,
  tempo: Hourglass,
  equipe: Scale,
  qualidade: BadgeCheck,
};

/**
 * As seções, na URL — como em toda listagem do produto.
 *
 * "Olha a qualidade da entrega do trimestre" precisa ser um link, e com estado
 * interno ele cairia na seção padrão com o período padrão.
 *
 * **Trocar de seção NÃO reseta o período.** O recorte é a pergunta que a
 * pessoa está fazendo; a seção é por qual ângulo ela olha. Zerar para "últimos
 * 30 dias" a cada troca faria quem está comparando o trimestre refazer a
 * escolha cinco vezes.
 *
 * **NÃO HÁ `visiveis`, e a prop saiu junto com a quinta aba (0095).** Ela
 * existia por causa de uma só: a Rentabilidade era `is_socio()` enquanto as
 * outras quatro são `is_gestor()`. Com as quatro respondendo igual, filtrar
 * por perfil aqui seria uma segunda pergunta embaixo de uma primeira que já
 * barra todo mundo — a lição da 0060. Quem decide é `roles: GESTAO` da rota.
 */
export function AbasDeMetrica({ atual }: { atual: AbaDeMetrica }) {
  const secoes: SecaoDoModulo<AbaDeMetrica>[] = ABAS_DE_METRICA.map((aba) => ({
    chave: aba,
    rotulo: ROTULOS_DE_ABA[aba],
    Icone: ICONES[aba],
  }));

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
