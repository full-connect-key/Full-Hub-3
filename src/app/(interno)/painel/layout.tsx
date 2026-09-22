import { BuscaGlobal } from "@/components/painel/busca-global";
import { MenuDoUsuario } from "@/components/painel/menu-do-usuario";
import { MenuGaveta } from "@/components/painel/menu-gaveta";
import { MenuLateral } from "@/components/painel/menu-lateral";
import { SinoDeNotificacoes } from "@/components/painel/sino-de-notificacoes";
import { Trilha } from "@/components/painel/trilha";
import { exigirEquipe } from "@/lib/auth/dal";

/**
 * Lê a preferência do menu antes de qualquer pintura.
 *
 * Roda durante a análise do HTML, antes de o React assumir. Sem isso, quem
 * deixou o menu recolhido veria ele aberto por um instante a cada
 * carregamento — e o servidor e o navegador discordariam na hidratação.
 */
const SCRIPT_DO_MENU = `
(function () {
  try {
    var escolha = localStorage.getItem("full-hub:menu");
    document.documentElement.dataset.menu = escolha === "recolhido" ? "recolhido" : "expandido";
  } catch (e) {
    document.documentElement.dataset.menu = "expandido";
  }
})();
`;

export default async function LayoutDoPainel({ children }: LayoutProps<"/painel">) {
  const { email, profile } = await exigirEquipe();

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_MENU }} />

      <div className="flex min-h-dvh">
        <MenuLateral role={profile.role} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:gap-3 lg:px-6">
            <MenuGaveta role={profile.role} />
            <Trilha />

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <BuscaGlobal />
              <SinoDeNotificacoes count={0} />
              <MenuDoUsuario
                nome={profile.nome}
                email={email}
                role={profile.role}
                hrefDoPerfil="/painel/meu-perfil"
              />
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
