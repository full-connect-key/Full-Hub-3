import { BarraLateralDoPortal } from "@/components/portal/barra-lateral-do-portal";
import { GavetaDoPortal } from "@/components/portal/gaveta-do-portal";
import { MenuDoCliente } from "@/components/portal/menu-do-cliente";
import { SeletorDeEmpresa } from "@/components/portal/seletor-de-empresa";
import { SinoDeNotificacoes } from "@/components/painel/sino-de-notificacoes";
import { Logo } from "@/components/shared/logo";

/**
 * A casca do Portal do Cliente.
 *
 * ---------------------------------------------------------------------------
 * **ELA GANHOU A BARRA LATERAL, e isso desfaz uma escolha que estava escrita
 * aqui.** A versão anterior tinha recusado a barra entre três propostas e
 * ficado com a casca do painel sem ela — topbar, faixa de seções em pílula,
 * conteúdo em `max-w-6xl`. A proposta aprovada pede a barra fixa de 244px, e as
 * três razões da recusa estão respondidas no cabeçalho de
 * `barra-lateral-do-portal.tsx`: a gaveta cobre o celular, o cartão do pé não
 * carrega vocabulário da agência, e a coluna de 306px nunca era esta.
 *
 * **O QUE A FAIXA DE SEÇÕES DEIXA PARA TRÁS, e é dito em vez de escondido:**
 * no celular, trocar de seção passou de um toque para dois. Era a objeção
 * principal, e ela continua verdadeira — o que mudou é que a proposta a aceita
 * de propósito, em troca de as sete seções caberem numa lista legível em vez
 * de numa faixa que rola para o lado.
 * ---------------------------------------------------------------------------
 *
 * **A MALHA E A TOPBAR CONTINUAM SENDO AS DO PAINEL**, pela decisão que
 * continua de pé: *"quero que o portal do cliente tenha o layout mais parecido
 * com o restante da plataforma"*. E a malha mora na COLUNA DE CONTEÚDO e não
 * no invólucro de fora, pela mesma razão de lá — a barra lateral tem fundo
 * próprio, e a malha apareceria nas bordas dela.
 *
 * **A TOPBAR DEIXOU DE CARREGAR O LOGO NO DESKTOP**, porque a barra lateral já
 * o carrega três centímetros à esquerda. No celular, onde a barra é gaveta,
 * ele volta ao lado do botão que a abre: sem isso o portal abriria sem nada
 * dizendo de quem ele é.
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
  empresas = [],
  empresaSelecionada = null,
  ajuda,
  base = "/portal",
  hrefDosDados = "/portal/configuracoes",
  aviso,
  fotoDaEmpresa = null,
  aprovacoesPendentes = 0,
  children,
}: {
  nome: string;
  email: string;
  nomeDaEmpresa: string | null;
  /** Quando há mais de uma, o cabeçalho ganha o seletor no lugar do nome. */
  empresas?: { id: string; nome_empresa: string }[];
  empresaSelecionada?: string | null;
  base?: string;
  /** Para onde vai "Meus dados" no menu do canto. */
  hrefDosDados?: string;
  aviso?: React.ReactNode;
  /**
   * O `?` da topbar, quando a área tem tour.
   *
   * Ele vem de FORA e não é montado aqui porque esta casca serve a DOIS donos
   * com tours diferentes: `/portal` do cliente e `/portal/{slug}`, que é a
   * visualização administrativa — e lá quem está olhando é da equipe, que já
   * tem o tour do painel. Montá-lo aqui daria à equipe um "fazer o tour do
   * portal" sobre uma tela que ela abriu para conferir o que o cliente vê.
   */
  ajuda?: React.ReactNode;
  /**
   * A foto de perfil da empresa, assinada (0063).
   *
   * **Ela aparece no cabeçalho de TODA tela, e a peça grande só no Início.**
   * A identidade precisa ser constante — o cliente entra no portal dele e
   * não num painel genérico —, mas repetir a capa de 200px em cada visita
   * gastaria a primeira dobra de toda tela com a mesma imagem. Aqui são
   * 28px ao lado do nome que já estava lá.
   */
  fotoDaEmpresa?: string | null;
  /** Quantas esperam a decisão do cliente, para o selo de Aprovações. */
  aprovacoesPendentes?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-page flex min-h-dvh flex-col">
      {aviso}

      <div className="flex min-h-0 flex-1">
        <BarraLateralDoPortal
          base={base}
          nome={nome}
          nomeDaEmpresa={nomeDaEmpresa}
          aprovacoesPendentes={aprovacoesPendentes}
        />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            aria-hidden
            className="malha-do-painel pointer-events-none absolute inset-x-0 top-0 z-0 h-[170px]"
          />

          <header className="relative z-10 flex h-16 shrink-0 items-center gap-2 px-4 lg:px-8">
            <GavetaDoPortal
              base={base}
              nome={nome}
              nomeDaEmpresa={nomeDaEmpresa}
              aprovacoesPendentes={aprovacoesPendentes}
            />

            {/* O LOGO SÓ NO CELULAR: no desktop a barra lateral já o tem. */}
            <Logo tamanho="sm" assinatura="nenhuma" className="lg:hidden" />

            {/* Com uma empresa só, o nome é um fato e ele já está no pé da
                barra lateral — aqui ele seria a terceira vez na mesma tela.
                Com mais de uma, ele vira ESCOLHA, e escolha pede um controle:
                é a única coisa que a barra lateral não sabe fazer. */}
            {empresas.length > 1 ? (
              <SeletorDeEmpresa
                empresas={empresas}
                selecionada={empresaSelecionada}
              />
            ) : fotoDaEmpresa ? (
              /* A foto fica, mesmo com o nome na barra: ela é a identidade
                 constante, e no celular a barra está fechada. `alt=""` porque
                 o nome da empresa já está escrito na gaveta e no cabeçalho da
                 página — um leitor de tela que o anuncia aqui lê três vezes a
                 mesma coisa. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotoDaEmpresa}
                alt=""
                className="size-7 shrink-0 rounded-full object-cover"
              />
            ) : null}

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <SinoDeNotificacoes />
              {ajuda}
              <MenuDoCliente
                nome={nome}
                email={email}
                hrefDosDados={hrefDosDados}
              />
            </div>
          </header>

          {/* O PADDING É O DA PROPOSTA — 28px por 36px —, e o `max-w-6xl`
              continua: com a barra de 244px, a coluna de conteúdo numa janela
              de 1440 já fica em 1196, então o limite quase nunca morde. Ele
              existe para a janela de 2560, onde uma grade de três colunas sem
              teto dá cartões de 800px. */}
          <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-7 lg:px-9">
            {children}
          </main>

          <footer className="text-text-muted relative z-10 px-4 py-6 text-center text-xs lg:px-9">
            Full Hub — Full Connect Key
          </footer>
        </div>
      </div>
    </div>
  );
}
