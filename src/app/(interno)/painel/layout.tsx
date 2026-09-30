import { BuscaGlobal } from "@/components/painel/busca-global";
import { MenuDoUsuario } from "@/components/painel/menu-do-usuario";
import { MenuGaveta } from "@/components/painel/menu-gaveta";
import { MenuLateral } from "@/components/painel/menu-lateral";
import { SinoDeNotificacoes } from "@/components/painel/sino-de-notificacoes";
import { Trilha } from "@/components/painel/trilha";
import { AtualizacaoAoVivo } from "@/components/shared/atualizacao-ao-vivo";
import { exigirEquipe } from "@/lib/auth/dal";
import { obterMinhaFicha } from "@/lib/dados/equipe";
import { minhasNotificacoes } from "@/lib/dados/notificacoes";
import { quandoFoiPublicado, rotuloDaVersao } from "@/lib/versao";

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

// Fora do componente: o valor e fixo desde o build, entao calcular a cada
// render seria trabalho repetido para sempre dar a mesma string.
const publicadoEm = quandoFoiPublicado();
const tituloDaVersao = publicadoEm
  ? `Versão no ar desde ${publicadoEm}`
  : "Build local, fora de um clone do repositório";

export default async function LayoutDoPainel({ children }: LayoutProps<"/painel">) {
  const { email, profile } = await exigirEquipe();
  const [ficha, avisos] = await Promise.all([obterMinhaFicha(), minhasNotificacoes()]);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_MENU }} />

      <div className="bg-surface-page flex min-h-dvh">
        <MenuLateral
          role={profile.role}
          nome={profile.nome}
          cargo={ficha?.cargo ?? null}
          avatarUrl={profile.avatar_url}
        />

        <div className="relative flex min-w-0 flex-1 flex-col">
          {/*
            A MALHA DE COR DO TOPO, da interface "Leve".

            Ela fica ATRÁS de tudo (`z-0`), não recebe clique, e termina em
            220px — a altura da topbar mais o cabeçalho da página. Cobre a
            busca e o título, que são texto grande, e acaba antes de qualquer
            rótulo pequeno. **O alfa dela foi medido e o teto é do LINK**: a
            conta inteira está no `globals.css`, em `--malha-no-pior-caso`.

            E é `absolute` dentro da coluna de conteúdo, não do `body`: a barra
            lateral tem fundo próprio, e uma malha que passasse por baixo dela
            apareceria nas bordas no tema claro.
          */}
          <div aria-hidden className="malha-do-painel pointer-events-none absolute inset-x-0 top-0 z-0 h-[190px]" />

          <header className="bg-surface-page/75 sticky top-0 z-30 flex h-16 items-center gap-2 px-3 backdrop-blur-xl sm:gap-3 lg:px-6">
            <MenuGaveta role={profile.role} />
            <Trilha />

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              {/*
                NO LAYOUT, e não em cada tela.

                O que o aviso faz é `router.refresh()`, que remonta os Server
                Components da rota atual e preserva o estado do cliente. Como
                não há nada específico de tela nisso, uma cópia por tela seria
                vinte lugares para esquecer um — e a tela esquecida não
                pareceria quebrada, só não se atualizaria.

                Só o Painel. O Portal do Cliente não ouve este canal, e a
                policy da 0057 é o que garante.
              */}
              <AtualizacaoAoVivo className="mr-1" />
              <BuscaGlobal />
              <SinoDeNotificacoes notificacoes={avisos.lista} naoLidas={avisos.naoLidas} />
              <MenuDoUsuario
                nome={profile.nome}
                email={email}
                role={profile.role}
                hrefDoPerfil="/painel/perfil"
              />
            </div>
          </header>

          <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </main>

          <footer className="text-text-muted relative z-10 px-4 py-6 text-center text-xs lg:px-8">
            Full Hub — Full Connect Key
            {/* De qual commit saiu o que você está vendo.
                Fica só no painel, e não no Portal do Cliente: para a equipe
                é a resposta de "já subiu?"; para o cliente seria uma sigla
                sem significado no rodapé da tela dele. */}
            <span aria-hidden className="mx-1.5 opacity-50">
              ·
            </span>
            <span title={tituloDaVersao} className="font-mono">
              {rotuloDaVersao()}
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}
