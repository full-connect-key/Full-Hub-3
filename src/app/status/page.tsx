import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { diagnosticarSupabase, type Situacao } from "@/lib/supabase/diagnostico";

export const metadata: Metadata = { title: "Status da conexão" };

// Diagnostico so faz sentido ao vivo: nunca servir uma versao em cache.
export const dynamic = "force-dynamic";

const aparencia: Record<Situacao, { Icone: typeof CheckCircle2; cor: string; rotulo: string }> = {
  ok: { Icone: CheckCircle2, cor: "text-positivo", rotulo: "Tudo certo" },
  alerta: { Icone: AlertTriangle, cor: "text-atencao", rotulo: "Atenção" },
  falha: { Icone: XCircle, cor: "text-negativo", rotulo: "Com falha" },
};

export default async function PaginaDeStatus() {
  const diagnostico = await diagnosticarSupabase();
  const geral = aparencia[diagnostico.situacaoGeral];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Status da conexão</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Verificação ao vivo da ligação entre o dashboard e o Supabase.
        </p>
      </header>

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <geral.Icone aria-hidden className={`size-6 ${geral.cor}`} />
            <div>
              <p className="text-sm font-semibold">{geral.rotulo}</p>
              <p className="text-xs text-texto-tenue">
                {diagnostico.host ? `Projeto: ${diagnostico.host}` : "Projeto ainda não configurado"}
              </p>
            </div>
          </div>
          <Link
            href="/status"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-borda px-3 text-sm text-texto-suave transition-colors hover:bg-superficie-suave hover:text-texto"
          >
            <RefreshCw aria-hidden className="size-4" />
            Verificar de novo
          </Link>
        </div>
      </Card>

      <ul className="space-y-3">
        {diagnostico.checagens.map((checagem) => {
          const { Icone, cor } = aparencia[checagem.situacao];
          return (
            <li key={checagem.nome}>
              <Card>
                <div className="flex items-start gap-3">
                  <Icone aria-hidden className={`mt-0.5 size-5 shrink-0 ${cor}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-texto">{checagem.nome}</p>
                    <p className="mt-0.5 text-sm text-texto-suave">{checagem.detalhe}</p>
                    {checagem.comoResolver ? (
                      <p className="mt-2 rounded-lg bg-superficie-suave px-3 py-2 text-xs text-texto-suave">
                        <strong className="font-medium text-texto">Como resolver: </strong>
                        {checagem.comoResolver}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <footer className="mt-6 flex items-center justify-between gap-4 text-xs text-texto-tenue">
        <span>
          Verificado em{" "}
          {new Date(diagnostico.verificadoEm).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}
        </span>
        <Link href="/dashboard" className="text-brand hover:underline">
          Ir para o dashboard
        </Link>
      </footer>
    </main>
  );
}
