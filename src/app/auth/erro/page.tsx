import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Link inválido" };

export default function PaginaDeErroDeAutenticacao() {
  return (
    // O DEGRADÊ SAIU, e ele não pintava nada: `body` é `bg-background`, e
    // 60% de `--muted` sobre a página dá quase exatamente a página — um
    // degradê invisível feito de opacidade sobre um fundo conhecido. O que
    // separa o cartão do chão é o cartão ser branco.
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-base">Não deu para validar o link</CardTitle>
          <CardDescription>Links de e-mail do Supabase valem uma vez só.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>O link expirou ou já foi usado.</AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/esqueci-senha">Pedir novo link</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/login">Voltar ao login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
