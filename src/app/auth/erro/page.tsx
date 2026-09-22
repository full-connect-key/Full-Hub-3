import type { Metadata } from "next";
import Link from "next/link";

import { Aviso } from "@/components/ui/aviso";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Link inválido" };

export default function PaginaDeErroDeAutenticacao() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <div className="space-y-4">
            <h1 className="text-sm font-semibold text-texto">Não deu para validar o link</h1>
            <Aviso tipo="erro">
              O link expirou ou já foi usado. Links de e-mail do Supabase valem uma vez só.
            </Aviso>
            <p className="text-sm text-texto-suave">
              Peça um link novo na tela de recuperação de senha.
            </p>
            <div className="flex gap-2 text-sm">
              <Link href="/recuperar-senha" className="text-brand hover:underline">
                Pedir novo link
              </Link>
              <span className="text-texto-tenue">-</span>
              <Link href="/login" className="text-brand hover:underline">
                Voltar ao login
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
