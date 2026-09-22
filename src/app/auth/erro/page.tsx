import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Link inválido" };

export default function PaginaDeErroDeAutenticacao() {
  return (
    <main className="from-muted/60 via-background to-muted/40 flex min-h-dvh items-center justify-center bg-gradient-to-br px-4 py-12">
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
