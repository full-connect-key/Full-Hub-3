import { MenuDoCliente } from "@/components/portal/menu-do-cliente";
import { SeletorDeEmpresa } from "@/components/portal/seletor-de-empresa";
import { NavegacaoDoPortal } from "@/components/portal/navegacao-do-portal";
import { SinoDeNotificacoes } from "@/components/painel/sino-de-notificacoes";
import { Logo } from "@/components/shared/logo";

/**
 * A casca do Portal do Cliente.
 *
 * ---------------------------------------------------------------------------
 * **ELA É A CASCA DO PAINEL, e não mais uma casca própria** (decisão do
 * usuário: *"quero que o portal do cliente tenha o layout mais parecido com o
 * restante da plataforma"*). A malha de cor no topo, a topbar sem faixa e sem
 * fio, os discos de vidro e a largura de `max-w-6xl` são os mesmos de lá — a
 * paleta já era a mesma desde a camada anterior, e o que ainda fazia o portal
 * parecer outro produto era a MOLDURA.
 *
 * **O que NÃO veio junto é a barra lateral**, e a ausência é escolha entre
 * três propostas. Ela é o item que mais aproximaria as duas áreas e o único
 * que cobra: no painel ela vira gaveta no celular porque são dezesseis itens;
 * aqui são cinco, e eles cabem na tela — trocar de seção passaria de um toque
 * para dois, num portal que se abre quase sempre pelo celular. E ela carrega o
 * cartão da pessoa no pé, que diz perfil de acesso e cargo: vocabulário da
 * agência, não do cliente.
 * ---------------------------------------------------------------------------
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
  base = "/portal",
  hrefDosDados = "/portal/configuracoes",
  aviso,
  fotoDaEmpresa = null,
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
   * A foto de perfil da empresa, assinada (0063).
   *
   * **Ela aparece no cabeçalho de TODA tela, e a peça grande só no Início.**
   * A identidade precisa ser constante — o cliente entra no portal dele e
   * não num painel genérico —, mas repetir a capa de 200px em cada visita
   * gastaria a primeira dobra de toda tela com a mesma imagem. Aqui são
   * 28px ao lado do nome que já estava lá.
   */
  fotoDaEmpresa?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-page flex min-h-dvh flex-col">
      {aviso}

      {/* A MALHA FICA DENTRO DESTE INVÓLUCRO, e não do `body`, pela mesma razão
          que no painel ela mora na coluna de conteúdo: lá a barra lateral tem
          fundo próprio, e aqui a faixa da visualização administrativa é
          `sticky top-0` e ocuparia os primeiros pixels dela. */}
      <div className="relative flex flex-1 flex-col">
        <div
          aria-hidden
          className="malha-do-painel pointer-events-none absolute inset-x-0 top-0 z-0 h-[170px]"
        />

        {/* A TOPBAR PERDEU A FAIXA BRANCA E O FIO, como a do painel: sobre a
            malha, uma faixa translúcida criava uma segunda borda horizontal
            onde o desenho não tem nenhuma.

            **E ela é ALINHADA AO CONTEÚDO**, ao contrário da do painel, que
            vai de ponta a ponta. Lá a barra lateral já encosta o conteúdo à
            esquerda; aqui, sem ela, o logo ficaria na borda de uma janela de
            1440 e os cartões começariam 144px adentro — a mesma decisão da
            capa do cliente e da barra de contexto. */}
        <header className="relative z-10 flex h-16 items-center px-4 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
            <Logo tamanho="sm" />

            {/* Com uma empresa só, o nome é um fato e fica como texto. Com
                mais de uma, ele vira escolha — e escolha pede um controle. */}
            {empresas.length > 1 ? (
              <>
                <span aria-hidden className="text-text-muted">
                  |
                </span>
                <SeletorDeEmpresa
                  empresas={empresas}
                  selecionada={empresaSelecionada}
                />
              </>
            ) : nomeDaEmpresa ? (
              <>
                <span aria-hidden className="text-text-muted">
                  |
                </span>
                {/* A foto ANTES do nome, e `alt=""`: ela não acrescenta
                    informação nenhuma ao texto que vem logo ao lado, e um
                    leitor de tela que anuncia "Mundo Verde, Mundo Verde" lê
                    duas vezes a mesma coisa. */}
                {fotoDaEmpresa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotoDaEmpresa}
                    alt=""
                    className="size-7 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <span className="truncate text-sm font-medium">
                  {nomeDaEmpresa}
                </span>
              </>
            ) : null}

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <SinoDeNotificacoes />
              <MenuDoCliente
                nome={nome}
                email={email}
                hrefDosDados={hrefDosDados}
              />
            </div>
          </div>
        </header>

        {/* A BARRA DE SEÇÕES NÃO GRUDA, e é a única coisa que esta casca não
            copia da `BarraDeContexto`. Duas razões: as listas daqui são curtas
            — dois materiais esperando, três campanhas —, e não quarenta
            demandas; e a faixa da visualização administrativa já é
            `sticky top-0`, então duas coisas grudadas no mesmo lugar seriam
            uma cobrindo a outra. */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 lg:px-8">
          <NavegacaoDoPortal base={base} />
        </div>

        <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>

        <footer className="text-text-muted relative z-10 px-4 py-6 text-center text-xs lg:px-8">
          Full Hub — Full Connect Key
        </footer>
      </div>
    </div>
  );
}
