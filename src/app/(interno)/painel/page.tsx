import type { Metadata } from "next";
import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirEquipe, primeiroNome } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Painel" };

export default async function PaginaDoPainel() {
  const { profile } = await exigirEquipe();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Olá, {primeiroNome(profile.nome)}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Painel interno da Full Connect Key.</p>
      </header>

      <Card>
        <CardHeader>
          <div className="bg-muted text-muted-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
            <Construction aria-hidden className="size-5" />
          </div>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            A base da plataforma está pronta: acesso, perfis e as tabelas centrais. Os módulos
            do painel entram nos próximos sprints.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
