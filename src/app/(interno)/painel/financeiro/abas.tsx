"use client";

import { ChartColumn, FileSignature, LayoutDashboard, ListOrdered } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

import { ABAS, type Aba } from "./vocabulario";

const ROTULOS: Record<Aba, { rotulo: string; Icone: typeof ChartColumn }> = {
  "visao-geral": { rotulo: "Visão Geral", Icone: LayoutDashboard },
  lancamentos: { rotulo: "Lançamentos", Icone: ListOrdered },
  contratos: { rotulo: "Contratos", Icone: FileSignature },
  relatorios: { rotulo: "Relatórios", Icone: ChartColumn },
};

/** Os filtros de cada seção, e o que não significa nada nas outras. */
const DA_LISTA = ["tipo", "cliente", "categoria", "situacao"];
const DOS_RELATORIOS = ["de", "ate"];

/**
 * As seções do Financeiro, na URL.
 *
 * Trocar de seção troca a página no servidor, e é por isso que cada uma carrega
 * só a própria consulta: quem abriu para lançar uma despesa não paga pela
 * série de doze meses da visão geral.
 *
 * Os filtros da lista ficam para trás ao sair dela — `tipo=despesa` numa URL
 * de Contratos não significa nada e só atrapalharia quem lê o endereço.
 */
export function AbasDoFinanceiro({ atual, acoes }: { atual: Aba; acoes?: React.ReactNode }) {
  const secoes: SecaoDoModulo<Aba>[] = ABAS.map((aba) => ({ chave: aba, ...ROTULOS[aba] }));

  return (
    <BarraDeContexto
      rotuloAcessivel="Seções do Financeiro"
      titulo="Financeiro"
      atual={atual}
      secoes={secoes}
      acoes={acoes}
      limparAoSair={(destino) => [
        ...(destino === "lancamentos" ? [] : DA_LISTA),
        ...(destino === "relatorios" ? [] : DOS_RELATORIOS),
      ]}
    />
  );
}
