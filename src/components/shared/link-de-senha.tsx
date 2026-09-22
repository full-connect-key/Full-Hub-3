"use client";

import { useState } from "react";
import { Check, Copy, MailWarning } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * O plano B de quando o e-mail de senha não sai.
 *
 * O Supabase só entrega e-mail de verdade depois que um SMTP próprio é
 * configurado; sem isso o remetente embutido atende poucos endereços e trava
 * por hora. A conta já foi criada de qualquer jeito — aqui a agência copia o
 * link e manda pela mão. Sem isso, a pessoa fica criada e sem porta de entrada.
 */
export function LinkDeSenha({ link, motivo }: { link: string; motivo?: string | null }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o link continua visível e
      // selecionável logo abaixo.
      setCopiado(false);
    }
  }

  return (
    <Alert variant="warning">
      <MailWarning />
      <AlertTitle>O e-mail não pôde ser enviado</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          A conta foi criada normalmente. Copie o link abaixo e mande para a pessoa — ele leva
          direto para a tela de definir a senha.
        </p>
        {motivo ? <p className="text-xs opacity-80">Motivo: {motivo}</p> : null}
        <code className="bg-background/60 block w-full overflow-x-auto rounded border p-2 text-xs">
          {link}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={copiar}>
          {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copiado ? "Copiado" : "Copiar link"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
