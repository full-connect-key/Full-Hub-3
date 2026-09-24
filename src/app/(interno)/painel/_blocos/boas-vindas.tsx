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
 * **Houve um botão de ação aqui, e ele saiu com o módulo que o recebia.** A
 * lição que fica é a razão de o cartão não ter um slot reservado: um canto
 * esperando uma ação que não vem é pior que um cartão sem ação nenhuma. Se um
 * dia houver o que oferecer na chegada, o botão volta junto com o destino.
 */
export function BoasVindas({
  primeiroNome,
  role,
  cargo,
}: {
  primeiroNome: string;
  role: UserRole;
  cargo: string | null;
}) {
  return (
    <section className="bg-surface-card rounded-card border p-6">
      <div className="min-w-0 space-y-2">
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
          Bem-vindo ao Full Hub da Full Connect Key. Acesse suas tarefas,
          acompanhe as campanhas ou gerencie seu perfil nos atalhos abaixo.
        </p>
      </div>
    </section>
  );
}
