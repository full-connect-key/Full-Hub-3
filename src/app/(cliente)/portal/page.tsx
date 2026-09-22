import type { Metadata } from "next";
import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirCliente, primeiroNome } from "@/lib/auth/dal";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Portal" };

export default async function PaginaDoPortal() {
  const { profile } = await exigirCliente();

  // O RLS ja limita o resultado as empresas deste cliente: mesmo sem filtro
  // no codigo, o banco nao devolve as dos outros.
  const supabase = await criarClienteServidor();
  const { data: empresas } = await supabase
    .from("clients")
    .select("id, nome_empresa")
    .order("nome_empresa");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Olá, {primeiroNome(profile.nome)}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {empresas && empresas.length > 0
            ? `Acompanhamento de ${empresas.map((e) => e.nome_empresa).join(", ")}.`
            : "Portal do cliente da Full Connect Key."}
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="bg-muted text-muted-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
            <Construction aria-hidden className="size-5" />
          </div>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            Seu acesso já está ativo. As áreas de acompanhamento entram nos próximos sprints.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
