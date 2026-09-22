import Link from "next/link";
import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obterSessao } from "@/lib/auth/dal";
import { rotaInicialDoRole } from "@/lib/auth/roles";

/**
 * Tela do HTTP 403, mostrada quando alguem abre uma area que nao e do seu
 * perfil. O Next renderiza este arquivo sempre que forbidden() e chamado, e a
 * resposta sai com status 403 de verdade -- nao e so uma tela bonita.
 */
export default async function AcessoNegado() {
  const sessao = await obterSessao();
  const voltarPara = sessao ? rotaInicialDoRole(sessao.profile.role) : "/login";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="bg-destructive/10 text-destructive mb-2 flex size-10 items-center justify-center rounded-lg">
            <ShieldX aria-hidden className="size-5" />
          </div>
          <CardTitle>Esta área não é do seu perfil</CardTitle>
          <CardDescription>
            Seu acesso é válido, mas não alcança esta parte da plataforma. Se você precisa
            entrar aqui, fale com a equipe interna.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={voltarPara}>Voltar para a minha área</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
