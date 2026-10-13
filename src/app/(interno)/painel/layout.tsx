import { BuscaGlobal } from "@/components/painel/busca-global";
import { MenuDoUsuario } from "@/components/painel/menu-do-usuario";
import { MenuGaveta } from "@/components/painel/menu-gaveta";
import { MenuLateral } from "@/components/painel/menu-lateral";
import { SinoDeNotificacoes } from "@/components/painel/sino-de-notificacoes";
import { AtualizacaoAoVivo } from "@/components/shared/atualizacao-ao-vivo";
import { BoasVindas } from "@/components/tour/boas-vindas";
import { ConviteDeMicroTour } from "@/components/tour/convite-de-micro-tour";
import { MenuDeAjuda } from "@/components/tour/menu-de-ajuda";
import { ProvedorDoTour } from "@/components/tour/provedor-do-tour";
import { ANCORAS, ancora } from "@/lib/tour/ancoras";
import { exigirEquipe } from "@/lib/auth/dal";
import { obterMinhaFicha } from "@/lib/dados/equipe";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { minhasNotificacoes } from "@/lib/dados/notificacoes";
import { meusTours } from "@/lib/dados/tour";
import { hojeNaAgencia } from "@/lib/dominio/datas";
import { convidaARever, devoConvidar, tourComecado } from "@/lib/tour/convite";
import { TOUR_DO_PAINEL, tourDoPainel } from "@/lib/tour/passos";
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

export default async function LayoutDoPainel({
  children,
}: LayoutProps<"/painel">) {
  const { email, profile } = await exigirEquipe();
  // AS DUAS LEITURAS DO TOUR CUSTAM UMA IDA CADA, e o custo está dito: elas
  // acontecem em toda navegação do painel, porque o menu de ajuda precisa dos
  // passos para saber o que oferecer. São uma RPC que devolve um booleano e um
  // `select` de no máximo uma dúzia de linhas pela própria pessoa — e a
  // alternativa, carregá-las sob demanda, exigiria um segundo caminho de
  // leitura para responder a mesma pergunta.
  const [ficha, avisos, tours, ehAtendimento] = await Promise.all([
    obterMinhaFicha(),
    minhasNotificacoes(),
    meusTours(),
    souDoAtendimento(),
  ]);

  // O TOUR É MONTADO NO SERVIDOR e desce como dado: `tourDoPainel()` é um
  // módulo compartilhado, então chamá-lo aqui e no cliente daria o mesmo
  // resultado — e descendo pronto, o navegador não precisa saber o perfil nem
  // perguntar ao banco quem é do Atendimento.
  const tour = tourDoPainel({ role: profile.role, ehAtendimento });
  // `hojeNaAgencia()` E NÃO `new Date()`: o container roda em UTC, e às 21h de
  // São Paulo "hoje" já é amanhã lá — o lembrete do dia seguinte apareceria um
  // dia antes para quem abre o painel à noite.
  const convite = devoConvidar(TOUR_DO_PAINEL, tours, hojeNaAgencia());
  const primeiroNome = profile.nome.trim().split(/\s+/)[0] ?? profile.nome;

  return (
    /*
      O PROVEDOR ENVOLVE O LAYOUT INTEIRO, e não cada tela: o tour navega entre
      rotas, e um provedor por página perderia o passo no meio da travessia —
      remontar o provedor é zerar o estado dele. É a mesma razão pela qual
      `AtualizacaoAoVivo` mora aqui: o que ele faz não é específico de tela.
    */
    <ProvedorDoTour>
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
          <div
            aria-hidden
            className="malha-do-painel pointer-events-none absolute inset-x-0 top-0 z-0 h-[190px]"
          />

          {/*
            A TOPBAR NÃO CARREGA MAIS O NOME DO MÓDULO, e a busca passou para a
            esquerda. É o desenho aprovado: uma faixa que tem a busca, o sino e
            o avatar, e mais nada.

            O nome não sumiu — DESCEU. Ele é o título grande da página agora,
            escrito por `BarraDeContexto` nas sete telas que tiraram o
            `PageHeader` no Sprint 9 e pelo próprio `PageHeader` no resto. A
            decisão daquele sprint continua valendo palavra por palavra ("o
            nome do módulo aparece uma vez só"); o que mudou foi ONDE essa vez
            acontece.

            E ela deixou de ter fundo e desfoque próprios: sobre a malha, uma
            faixa translúcida criava uma segunda borda horizontal onde o
            desenho não tem nenhuma. O que gruda no topo agora é a barra de
            seções, que é a que precisa.
          */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 px-3 sm:gap-3 lg:px-6">
            <MenuGaveta role={profile.role} />
            <BuscaGlobal />

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
              {/* O `?` FICA AO LADO DO SINO, que é onde o sprint o pede — e
                  antes dele, porque a ordem da topbar é da ajuda para o
                  pessoal: ajuda, avisos, você. */}
              <MenuDeAjuda
                tour={tour}
                rotuloDoTour="o tour do painel"
                comecado={tourComecado(TOUR_DO_PAINEL, tours)}
                convidaARever={convidaARever(TOUR_DO_PAINEL, tours)}
                hrefDosPlaybooks="/painel/academy"
              />
              <SinoDeNotificacoes
                notificacoes={avisos.lista}
                naoLidas={avisos.naoLidas}
              />
              <MenuDoUsuario
                nome={profile.nome}
                email={email}
                role={profile.role}
                hrefDoPerfil="/painel/perfil"
              />
            </div>
          </header>

          {/* A TERCEIRA ÂNCORA GENÉRICA dos micro-tours: a área de conteúdo
              do módulo. Ela é o passo "é aqui que o trabalho acontece" de
              qualquer um deles, sem um atributo por tela. */}
          <main
            className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8"
            {...ancora(ANCORAS.conteudoDoModulo)}
          >
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

      <BoasVindas
        convite={convite}
        primeiroNome={primeiroNome}
        tour={tour}
      />

      {/* O CONVITE DO MÓDULO descobre a tela pela ROTA, então ele mora aqui e
          não em nove páginas — a décima, a que alguém criar depois, nasceria
          sem micro-tour sem nada dizendo. */}
      <ConviteDeMicroTour tours={tours} />
    </ProvedorDoTour>
  );
}
