"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * A senha provisória de quem acabou de ser cadastrado.
 *
 * **Aparece uma vez só.** Ela não é guardada em lugar nenhum além do hash do
 * Auth — o que esta tela mostra é o único momento em que o texto existe. Por
 * isso o aviso fala em voz alta, e o botão de copiar vem antes da explicação:
 * quem cadastrou está com pressa e vai copiar primeiro.
 *
 * Substituiu o `LinkDeSenha`, que mostrava um link de recuperação quando o
 * e-mail não saía. O link dependia de o e-mail sair para ser o caminho normal,
 * e sem SMTP próprio ele quase nunca saía — o plano B era o caminho de sempre.
 */
export function SenhaDoPrimeiroAcesso({ senha }: { senha: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência: a senha continua visível e
      // selecionável logo abaixo.
      setCopiado(false);
    }
  }

  return (
    <Alert variant="warning">
      <KeyRound />
      <AlertTitle>Senha provisória — anote agora</AlertTitle>
      <AlertDescription className="space-y-2">
        <div className="flex w-full flex-wrap items-center gap-2">
          <code className="bg-background/60 flex-1 rounded border px-3 py-2 font-mono text-sm tracking-wider">
            {senha}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copiar}>
            {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copiado ? "Copiada" : "Copiar"}
          </Button>
        </div>
        <p>
          Passe para a pessoa. No primeiro acesso, o sistema pede que ela escolha a senha dela — e
          esta deixa de valer.
        </p>
        <p className="text-xs opacity-80">
          Ela aparece só desta vez. Se esta tela fechar antes de você copiar, use “Esqueci minha
          senha” na tela de login.
        </p>
      </AlertDescription>
    </Alert>
  );
}
