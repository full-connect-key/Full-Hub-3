import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { diagnosticarSupabase, type Situacao } from "@/lib/supabase/diagnostico";

export const metadata: Metadata = { title: "Status da conexão" };

// Diagnostico so faz sentido ao vivo: nunca servir uma versao em cache.
export const dynamic = "force-dynamic";

const aparencia: Record<Situacao, { Icone: typeof CheckCircle2; cor: string; rotulo: string }> = {
  ok: { Icone: CheckCircle2, cor: "text-success", rotulo: "Tudo certo" },
  alerta: { Icone: AlertTriangle, cor: "text-warning", rotulo: "Atenção" },
  falha: { Icone: XCircle, cor: "text-destructive", rotulo: "Com falha" },
};

export default async function PaginaDeStatus() {
  const diagnostico = await diagnosticarSupabase();
  const geral = aparencia[diagnostico.situacaoGeral];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Status da conexão</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Verificação ao vivo da ligação entre a plataforma e o Supabase.
        </p>
      </header>

      <Card className="mb-4">
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <geral.Icone aria-hidden className={`size-6 ${geral.cor}`} />
            <div>
              <p className="text-sm font-semibold">{geral.rotulo}</p>
              <p className="text-muted-foreground text-xs">
                {diagnostico.host ? `Projeto: ${diagnostico.host}` : "Projeto ainda não configurado"}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/status">
              <RefreshCw aria-hidden />
              Verificar de novo
            </Link>
          </Button>
        </CardContent>
      </Card>

      <ul className="space-y-3">
        {diagnostico.checagens.map((checagem) => {
          const { Icone, cor } = aparencia[checagem.situacao];
          return (
            <li key={checagem.nome}>
              <Card>
                <CardContent className="flex items-start gap-3">
                  <Icone aria-hidden className={`mt-0.5 size-5 shrink-0 ${cor}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{checagem.nome}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm">{checagem.detalhe}</p>
                    {checagem.comoResolver ? (
                      <p className="bg-muted text-muted-foreground mt-2 rounded-lg px-3 py-2 text-xs">
                        <strong className="text-foreground font-medium">Como resolver: </strong>
                        {checagem.comoResolver}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <footer className="text-muted-foreground mt-6 flex items-center justify-between gap-4 text-xs">
        <span>
          Verificado em{" "}
          {new Date(diagnostico.verificadoEm).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}
        </span>
        <Link href="/" className="underline-offset-4 hover:underline">
          Ir para a plataforma
        </Link>
      </footer>
    </main>
  );
}
