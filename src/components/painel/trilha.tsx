"use client";

import { usePathname } from "next/navigation";

import { findMenuItem } from "@/lib/auth/permissions";

/**
 * O NOME DO MÓDULO, e mais nada.
 *
 * Ela tinha duas linhas: "FULL HUB — DASHBOARD FULL" em caixa alta miúda e,
 * embaixo, a página atual. A de cima SAIU com a interface "Leve", e a razão é
 * que ela não respondia nada: o nome do produto já está no alto da barra
 * lateral, a três centímetros dali, e repeti-lo em toda tela gastava a linha
 * mais visível do painel com a informação que a pessoa menos precisa.
 *
 * O que sobra é o nome do módulo, no tamanho em que ele se lê como título da
 * tela. **Continua sem link:** quem navega é a barra, que está sempre visível,
 * e duas formas de ir ao mesmo lugar — uma delas em letra miúda — dividiriam
 * a atenção.
 *
 * **NÃO é um `<h1>`, e quase virou.** Toda tela do painel já tem o seu, no
 * `PageHeader`; um segundo aqui daria dois títulos de nível um por página, e
 * quem usa leitor de tela ouviria o nome do módulo duas vezes seguidas sem
 * saber qual dos dois é a página. É a mesma decisão do `<h1>` `sr-only` da
 * porta: um título por tela, e estável.
 *
 * *O que a proposta previa e ainda NÃO está aqui:* as visões do módulo
 * (Lista / Board / Calendário) ao lado do nome. Elas hoje moram dentro de cada
 * tela, e trazê-las para cá exige que todo módulo declare as suas — é mudança
 * de contrato, não de estilo, e fica dita em vez de meia-feita.
 */
export function Trilha() {
  const pathname = usePathname();
  const item = findMenuItem(pathname);
  const naInicial = pathname === "/painel";

  return (
    <p className="text-text-primary min-w-0 truncate text-[17px] font-semibold tracking-[-0.02em]">
      {naInicial ? "Início" : (item?.label ?? "Painel")}
    </p>
  );
}
