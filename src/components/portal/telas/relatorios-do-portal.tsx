import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  LeituraDoRelatorio,
  SetaDoCartao,
} from "@/components/shared/leitura-do-relatorio";
import { listarRelatorios, obterRelatorio } from "@/lib/dados/relatorios";
import { periodoPorExtenso } from "@/lib/dominio/relatorios";

/**
 * OS RELATÓRIOS NO PORTAL. `clienteId` vem quando é a equipe olhando o portal
 * de uma conta; para o cliente, o RLS já entrega só os publicados dele.
 * **A equipe também só vê os publicados aqui** — o portal é o que o cliente vê.
 */
export async function ListaDeRelatoriosDoPortal({
  base,
  clienteId,
}: {
  base: string;
  clienteId?: string;
}) {
  const relatorios = (await listarRelatorios(clienteId)).filter(
    (r) => r.publicadoEm,
  );

  if (relatorios.length === 0)
    return (
      <EmptyState
        title="Nenhum relatório por enquanto"
        description="Assim que a agência publicar o relatório do período, ele aparece aqui."
      />
    );

  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-tour="portal-relatorios">
      {relatorios.map((r) => (
        <li key={r.id}>
          <Link
            href={`${base}/relatorios/${r.id}`}
            className="bg-card hover:bg-muted flex items-start gap-3 rounded-xl border p-5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{r.titulo}</p>
              <p className="text-text-muted text-sm">
                {periodoPorExtenso(r.periodoInicio, r.periodoFim)}
              </p>
            </div>
            <SetaDoCartao />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function RelatorioDoPortal({
  base,
  id,
  clienteId,
}: {
  base: string;
  id: string;
  clienteId?: string;
}) {
  const relatorio = await obterRelatorio(id);
  if (!relatorio || !relatorio.publicadoEm) notFound();
  if (clienteId && relatorio.clienteId !== clienteId) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`${base}/relatorios`}
        className="text-text-muted inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Todos os relatórios
      </Link>
      <LeituraDoRelatorio
        cliente={relatorio.cliente}
        titulo={relatorio.titulo}
        subtitulo={relatorio.subtitulo}
        periodoInicio={relatorio.periodoInicio}
        periodoFim={relatorio.periodoFim}
        blocos={relatorio.blocos}
        imagens={relatorio.imagens}
      />
    </div>
  );
}
