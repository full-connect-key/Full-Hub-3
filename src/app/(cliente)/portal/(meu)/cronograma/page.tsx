import type { Metadata } from "next";
import { Suspense } from "react";

import { CronogramaDoPortal } from "@/components/portal/telas/cronograma-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";

export const metadata: Metadata = { title: "Cronograma" };

/**
 * O cronograma da conta — o que acontece quando, nas três frentes.
 *
 * **Mês, frente e dia aberto moram na URL**, como em toda listagem do
 * produto: "olha o dia 15" precisa ser um link, e é isso que permite a tela
 * inteira ser renderizada no servidor.
 */
export default async function PaginaDoCronograma({
  searchParams,
}: PageProps<"/portal/cronograma">) {
  await exigirClienteNaTela();
  const params = await searchParams;

  // VALOR TORTO VIRA NULO, e a tela cai no mês corrente: ler o valor cru
  // daria uma grade em branco para quem colou `?mes=outubro`.
  const mes =
    typeof params.mes === "string" && /^\d{4}-\d{2}$/.test(params.mes)
      ? params.mes
      : null;
  const dia =
    typeof params.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.dia)
      ? params.dia
      : null;
  const frente = typeof params.frente === "string" ? params.frente : null;
  const empresa = typeof params.empresa === "string" ? params.empresa : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">
          Cronograma
        </h1>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <CronogramaDoPortal
          base="/portal"
          clienteId={empresa}
          mes={mes}
          frente={frente}
          diaAberto={dia}
        />
      </Suspense>
    </div>
  );
}
