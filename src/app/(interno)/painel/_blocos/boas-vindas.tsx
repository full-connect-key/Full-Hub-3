import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/supabase/database.types";

/**
 * A primeira coisa que aparece ao entrar.
 *
 * As duas pastilhas em cima separam o que todo mundo confunde: o PERFIL DE
 * ACESSO diz o que a pessoa alcança na plataforma, o CARGO diz o que ela faz
 * na agência. Uma pessoa pode ser "Social Media" de cargo e "Desenvolvedor" de
 * perfil — e é exatamente por isso que os dois aparecem lado a lado, separados
 * por um ponto, em vez de um só campo chamado "função".
 *
 * O botão de entrega fica aqui, e não no Resumo Semanal, porque registrar o
 * que se entregou é coisa que se lembra ao chegar — não ao ir procurar a tela
 * do registro.
 */
export function BoasVindas({
  primeiroNome,
  role,
  cargo,
  acaoDeEntrega,
}: {
  primeiroNome: string;
  role: UserRole;
  cargo: string | null;
  acaoDeEntrega: React.ReactNode;
}) {
  return (
    <section className="bg-surface-card rounded-card flex flex-wrap items-start gap-4 border p-6">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="bg-accent text-accent-foreground rounded px-2 py-0.5 text-xs font-medium">
            {ROTULOS_DE_ROLE[role]}
          </span>
          {cargo ? (
            <>
              <span aria-hidden className="text-text-muted text-xs">
                ·
              </span>
              <span className="bg-accent text-accent-foreground rounded px-2 py-0.5 text-xs font-medium">
                {cargo}
              </span>
            </>
          ) : null}
        </p>

        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">
          Olá, {primeiroNome} <span aria-hidden>👋</span>
        </h1>

        <p className="text-text-secondary text-sm">
          Bem-vindo ao Full Hub da Full Connect Key. Acesse suas tarefas, consulte o resumo semanal
          ou gerencie seu perfil nos atalhos abaixo.
        </p>
      </div>

      <div className="shrink-0">{acaoDeEntrega}</div>
    </section>
  );
}

/** O botão, separado, porque abre um diálogo e precisa ser componente cliente. */
export function BotaoDeEntrega({ href }: { href: string }) {
  return (
    <Button asChild>
      <a href={href}>
        <Plus aria-hidden />
        Adicionar Entrega
      </a>
    </Button>
  );
}
