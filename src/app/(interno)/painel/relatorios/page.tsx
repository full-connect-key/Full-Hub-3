import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SetaDoCartao } from "@/components/shared/leitura-do-relatorio";
import { exigirEquipe } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { listarRelatorios } from "@/lib/dados/relatorios";
import { periodoPorExtenso } from "@/lib/dominio/relatorios";
import { hojeNaAgencia } from "@/lib/dominio/datas";

import { NovoRelatorio } from "./novo-relatorio";

export const metadata: Metadata = { title: "Relatórios" };

/** O mês passado inteiro: é dele o relatório que se escreve neste. */
function mesPassado(hoje: string): { inicio: string; fim: string } {
  const [ano, mes] = hoje.split("-").map(Number);
  const a = mes === 1 ? ano - 1 : ano;
  const m = mes === 1 ? 12 : mes - 1;
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { inicio: `${a}-${mm}-01`, fim: `${a}-${mm}-${ultimo}` };
}

export default async function PaginaDeRelatorios() {
  await exigirEquipe();
  const [relatorios, clientes] = await Promise.all([
    listarRelatorios(),
    listarClientes(),
  ]);
  const periodo = mesPassado(hojeNaAgencia());

  return (
    <div className="space-y-6">
      <NovoRelatorio
        contas={clientes
          .filter((c) => c.ativo)
          .map((c) => ({ id: c.id, nome: c.nome_empresa }))}
        inicioSugerido={periodo.inicio}
        fimSugerido={periodo.fim}
      />

      {relatorios.length === 0 ? (
        <EmptyState
          title="Nenhum relatório ainda"
          description="Escolha a conta e o período acima para montar o primeiro."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-tour="relatorios-lista">
          {relatorios.map((r) => (
            <li key={r.id}>
              <Link
                href={`/painel/relatorios/${r.id}`}
                className="bg-card hover:bg-muted flex items-start gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-text-muted text-xs">{r.cliente}</p>
                  <p className="truncate font-bold">{r.titulo}</p>
                  <p className="text-text-muted text-sm">
                    {periodoPorExtenso(r.periodoInicio, r.periodoFim)}
                  </p>
                  <p className="mt-2 text-xs font-medium">
                    {r.publicadoEm ? "Publicado no portal" : "Rascunho"}
                  </p>
                </div>
                <SetaDoCartao />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
