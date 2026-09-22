import { MenuDoCliente } from "@/components/portal/menu-do-cliente";
import { NavegacaoDoPortal } from "@/components/portal/navegacao-do-portal";
import { SinoDeNotificacoes } from "@/components/painel/sino-de-notificacoes";
import { Logo } from "@/components/shared/logo";

/**
 * A casca do Portal do Cliente.
 *
 * Mais leve e mais espaçada que o painel interno, de propósito: o cliente é
 * visitante, entra de vez em quando para ver e aprovar. O operador é a equipe,
 * e é ela que precisa de densidade.
 *
 * A mesma casca serve as duas entradas — o portal do próprio cliente e a
 * visualização administrativa em /portal/{slug} —, e é isso que faz a segunda
 * mostrar o que o cliente vê, e não uma aproximação. `base` muda o prefixo dos
 * links da navegação; `aviso` é a faixa de alerta da visualização
 * administrativa, e no portal do cliente não existe.
 */
export function CascaDoPortal({
  nome,
  email,
  nomeDaEmpresa,
  base = "/portal",
  hrefDosDados = "/portal/configuracoes",
  aviso,
  children,
}: {
  nome: string;
  email: string;
  nomeDaEmpresa: string | null;
  base?: string;
  /** Para onde vai "Meus dados" no menu do canto. */
  hrefDosDados?: string;
  aviso?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-page flex min-h-dvh flex-col">
      {aviso}

      <header className="bg-surface-card border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 lg:px-8">
          <Logo tamanho="sm" />

          {nomeDaEmpresa ? (
            <>
              <span aria-hidden className="text-text-muted">
                |
              </span>
              <span className="truncate text-sm font-medium">{nomeDaEmpresa}</span>
            </>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            <SinoDeNotificacoes count={0} />
            <MenuDoCliente nome={nome} email={email} hrefDosDados={hrefDosDados} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl px-4 lg:px-8">
          <NavegacaoDoPortal base={base} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-8 lg:py-12">
        {children}
      </main>

      <footer className="text-text-muted px-4 py-6 text-center text-xs lg:px-8">
        Full Hub — Full Connect Key
      </footer>
    </div>
  );
}
