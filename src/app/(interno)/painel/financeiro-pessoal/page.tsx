import type { Metadata } from "next";
import { Suspense } from "react";
import { format } from "date-fns";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import {
  lancamentosDoMes,
  recorrentesParaReplicar,
  saidasPorCategoria,
  saldoDosUltimosMeses,
  temAlgumLancamento,
} from "@/lib/dados/financeiro-pessoal";
import { competenciaDaChave } from "@/lib/dominio/financeiro";

import { FinanceiroPessoal } from "./tela";

export const metadata: Metadata = { title: "Financeiro Pessoal" };

/**
 * O Financeiro Pessoal.
 *
 * PRIVADO DE VERDADE, e no extremo oposto do módulo Financeiro: lá só o sócio
 * entra, aqui nem ele. `personal_finance_entries` fecha em `auth.uid()` nas
 * quatro operações, não existe policy de leitura para gestão, e nenhuma
 * consulta do painel cruza esta tabela com nada.
 *
 * MÓDULO OPCIONAL, e o produto inteiro trata assim: peso visual reduzido no
 * menu, fora da tela inicial, sem notificação e sem selo de pendência. Nada
 * aqui cobra o uso de ninguém.
 */
export default async function PaginaDoFinanceiroPessoal({
  searchParams,
}: PageProps<"/painel/financeiro-pessoal">) {
  await exigirAcessoARota("/painel/financeiro-pessoal");
  const parametros = await searchParams;

  const hojeISO = format(new Date(), "yyyy-MM-dd");
  const mes = typeof parametros.mes === "string" ? parametros.mes : undefined;
  const competencia = competenciaDaChave(mes, hojeISO);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro Pessoal"
        description="Suas entradas e saídas do mês. É seu e só seu — nem a gestão enxerga, e dá para apagar tudo quando quiser."
      />

      <Suspense key={competencia} fallback={<LoadingSkeleton variant="table" rows={5} />}>
        <Conteudo competencia={competencia} hojeISO={hojeISO} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ competencia, hojeISO }: { competencia: string; hojeISO: string }) {
  const [lancamentos, meses, porCategoria, jaUsou, recorrentes] = await Promise.all([
    lancamentosDoMes(competencia),
    saldoDosUltimosMeses(competencia),
    saidasPorCategoria(competencia),
    temAlgumLancamento(),
    recorrentesParaReplicar(competencia),
  ]);

  return (
    <FinanceiroPessoal
      lancamentos={lancamentos}
      meses={meses}
      porCategoria={porCategoria}
      competencia={competencia}
      hojeISO={hojeISO}
      // "Primeira visita" é "ainda não lançou nada", e não um cookie: quem
      // limpa o navegador não precisa reler o aviso, e quem abre de outro
      // computador antes de lançar qualquer coisa merece lê-lo.
      primeiraVisita={!jaUsou}
      quantosRecorrentes={recorrentes.length}
    />
  );
}
