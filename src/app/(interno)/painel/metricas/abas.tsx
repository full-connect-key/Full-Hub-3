"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BadgeCheck, ChartColumn, CircleDollarSign, Hourglass, Scale } from "lucide-react";

import { ABAS_DE_METRICA, ROTULOS_DE_ABA, type AbaDeMetrica } from "@/lib/dominio/metricas";
import { cn } from "@/lib/utils";

const ICONES: Record<AbaDeMetrica, typeof ChartColumn> = {
  producao: ChartColumn,
  tempo: Hourglass,
  equipe: Scale,
  qualidade: BadgeCheck,
  rentabilidade: CircleDollarSign,
};

/**
 * As abas, na URL — como em toda listagem do produto.
 *
 * "Olha a rentabilidade do trimestre" precisa ser um link, e com estado
 * interno ele cairia na aba padrão com o período padrão.
 *
 * **Trocar de aba NÃO reseta o período.** O recorte é a pergunta que a pessoa
 * está fazendo; a aba é por qual ângulo ela olha. Zerar para "últimos 30
 * dias" a cada troca faria quem está comparando o trimestre refazer a escolha
 * cinco vezes.
 */
export function AbasDeMetrica({ atual, visiveis }: { atual: AbaDeMetrica; visiveis: AbaDeMetrica[] }) {
  const pathname = usePathname();
  const parametros = useSearchParams();

  if (visiveis.length <= 1) return null;

  function href(aba: AbaDeMetrica) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("aba", aba);
    // O filtro de cliente é só da Produção: a 0035 não recebe cliente nas
    // outras quatro, e levá-lo junto deixaria na URL um parâmetro que a tela
    // ignora — o tipo de coisa que faz alguém mandar um link achando que
    // mandou o recorte.
    if (aba !== "producao") destino.delete("cliente");
    return `${pathname}?${destino.toString()}`;
  }

  return (
    <nav aria-label="Seções das Métricas" className="-mx-1 overflow-x-auto px-1">
    {/* O SCROLL É DO `nav`, E O `min-w-max` É DO `ul`. Os dois na mesma
        tag não fazem nada: um elemento com `min-w-max` tem exatamente a
        largura do conteúdo, então nunca overflowa a si mesmo — quem
        transborda é o PAI. Em 375px a barra de abas empurrava a página
        inteira para os lados: cabeçalho, conteúdo e rodapé saíam da tela, e
        a página ganhava rolagem horizontal. Foi a imagem de 375px que
        mostrou; em qualquer largura de desktop as abas cabem e o erro não
        aparece. */}
      <ul className="bg-muted inline-flex min-w-max gap-1 rounded-xl p-1">
        {ABAS_DE_METRICA.filter((aba) => visiveis.includes(aba)).map((aba) => {
          const Icone = ICONES[aba];
          const ativo = aba === atual;
          return (
            <li key={aba}>
              <Link
                href={href(aba)}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
                  ativo
                    ? "bg-surface-card text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                <Icone aria-hidden className="size-4" />
                {ROTULOS_DE_ABA[aba]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
