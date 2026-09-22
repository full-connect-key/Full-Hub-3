import { MenuDoCliente } from "@/components/portal/menu-do-cliente";
import { NavegacaoDoPortal } from "@/components/portal/navegacao-do-portal";
import { SinoDeNotificacoes } from "@/components/painel/sino-de-notificacoes";
import { Logo } from "@/components/shared/logo";
import { exigirCliente } from "@/lib/auth/dal";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";

/**
 * Casca do Portal do Cliente.
 *
 * Mais leve e mais espaçado que o painel interno, de propósito: o cliente é
 * visitante, entra de vez em quando para ver e aprovar. O operador é a equipe,
 * e é ela que precisa de densidade.
 */
export default async function LayoutDoPortal({ children }: LayoutProps<"/portal">) {
  const { email, profile } = await exigirCliente();
  const empresas = await obterMinhasEmpresas();
  const nomeDaEmpresa = empresas.map((empresa) => empresa.nome_empresa).join(", ");

  return (
    <div className="bg-muted/30 flex min-h-dvh flex-col">
      <header className="bg-background border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 lg:px-8">
          <Logo tamanho="sm" />

          {nomeDaEmpresa ? (
            <>
              <span aria-hidden className="text-muted-foreground/50">
                |
              </span>
              <span className="truncate text-sm font-medium">{nomeDaEmpresa}</span>
            </>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            <SinoDeNotificacoes count={0} />
            <MenuDoCliente nome={profile.nome} email={email} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl px-4 lg:px-8">
          <NavegacaoDoPortal />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-8 lg:py-12">{children}</main>
    </div>
  );
}
