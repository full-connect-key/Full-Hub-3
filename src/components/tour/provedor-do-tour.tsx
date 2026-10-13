"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { chamarAcao, chamarEMostrar } from "@/lib/acoes/cliente";
import { salvarOTour } from "@/lib/tour/acoes";
import { seletorDaAncora } from "@/lib/tour/ancoras";
import type { PassoDoTour, Tour } from "@/lib/tour/passos";

/**
 * O TOUR INTERATIVO: o destaque, o balão, o teclado e a persistência.
 *
 * ---------------------------------------------------------------------------
 * **NÃO HÁ BIBLIOTECA, E A DECISÃO FOI MEDIDA E NÃO LEMBRADA.** O sprint
 * sugere o driver.js e diz que *"o resto deste sprint vale para as duas"*
 * opções — então a escolha é da casa. O que a medição mostrou:
 *
 *   * `driver.css` são 3938 bytes com **doze cores literais** e **zero**
 *     `var(--`. Ele não tem por onde ler os tokens, então ou ele entra como a
 *     4ª exceção do `check:cores` — num arquivo de `node_modules`, que ninguém
 *     revisa —, ou a interface do tour é a única peça do produto que não troca
 *     com o tema. (**E o `check:cores` pegou esta própria explicação na
 *     primeira rodada**, porque ela listava os quatro valores: é a armadilha
 *     deste projeto pela oitava vez — a explicação não pode carregar o que ela
 *     proíbe.)
 *   * E o que ele resolve, ele resolve bem: o recorte em SVG, a posição do
 *     balão, o teclado, o `overlayColor`. O que ele **não** tem é justamente o
 *     que o sprint pede: `DriveStep.element` é síncrono, então não há passo
 *     interativo, não há navegação entre rotas, não há a espera de dois
 *     segundos com pulo em silêncio, e não há persistência.
 *
 * Sobrando metade do pedido para escrever à mão, a metade que ele traz custa
 * 21KB de script e uma folha de estilo fora dos tokens. O recorte aqui é uma
 * linha de CSS — `box-shadow: 0 0 0 9999px` num elemento do tamanho do alvo.
 * ---------------------------------------------------------------------------
 *
 * **A TELA NUNCA É BLOQUEADA, e isso é mecânico antes de ser de desenho.** O
 * véu é `pointer-events-none`: ele escurece e não intercepta nada, então todo
 * clique da página continua chegando onde chegava — que é o que o passo
 * INTERATIVO precisa para existir, e é a leitura literal de *"nunca bloquear
 * a tela inteira"*. Só o balão recebe ponteiro, para os botões dele
 * funcionarem. E `Esc` sai de qualquer passo.
 */

type Contexto = {
  /** Começa (ou refaz) um tour. Recomeça do passo zero. */
  comecar: (tour: Tour) => void;
  /** Para a faixa de ajuda saber se já há um tour correndo. */
  andando: boolean;
};

const TourContext = createContext<Contexto | null>(null);

export function useTour(): Contexto {
  const ctx = useContext(TourContext);
  if (!ctx) {
    // ESTOURA EM VEZ DE DEVOLVER UM NADA: um `comecar` que não faz nada é um
    // botão "Fazer o tour" que não faz nada, e ninguém liga o clique morto ao
    // provedor que ficou de fora do layout.
    throw new Error("useTour() fora do <ProvedorDoTour>.");
  }
  return ctx;
}

/** Quanto o tour espera o elemento aparecer antes de pular em silêncio. */
const ESPERA_MAXIMA_MS = 2000;
const INTERVALO_DE_BUSCA_MS = 80;

type Retangulo = { top: number; left: number; width: number; height: number };

type Andando = {
  tour: Tour;
  indice: number;
  pulados: string[];
  semAncora: string[];
};

export function ProvedorDoTour({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const caminho = usePathname();

  const [andando, setAndando] = useState<Andando | null>(null);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);

  const passo: PassoDoTour | null = andando
    ? (andando.tour.passos[andando.indice] ?? null)
    : null;

  // ------------------------------------------------------------------
  // A GRAVAÇÃO
  //
  // Ela acontece a cada passo, porque é `passo_atual` que responde a
  // pergunta do acompanhamento — *em qual passo as pessoas desistem*. E ela
  // **não mostra toast por passo**: sete avisos verdes para um tutorial é
  // ruído, e o motivo de uma falha vai para o console, que é onde se procura.
  //
  // **O FIM É A EXCEÇÃO, e por isso ele mostra.** É aquela gravação que
  // decide se o diálogo de boas-vindas volta amanhã — falhando em silêncio,
  // a pessoa concluiria o tour e o veria de novo no dia seguinte sem nada
  // explicando por quê.
  // ------------------------------------------------------------------
  const gravar = useCallback(
    async (
      estado: Andando,
      status: "em_andamento" | "concluido" | "pulado",
      mostrar = false,
    ) => {
      const entrada = {
        tourId: estado.tour.id,
        versao: estado.tour.versao,
        status,
        passoAtual: estado.indice,
        pulados: estado.pulados,
        semAncora: estado.semAncora,
      };

      if (mostrar) {
        await chamarEMostrar(() => salvarOTour(entrada));
        return;
      }

      const r = await chamarAcao(() => salvarOTour(entrada));
      if (!r.ok) console.error("[tour] não deu para gravar o passo:", r.error);
    },
    [],
  );

  const encerrar = useCallback(
    (estado: Andando, status: "concluido" | "pulado") => {
      setAndando(null);
      setAlvo(null);
      void gravar(estado, status, true);
    },
    [gravar],
  );

  const avancar = useCallback(
    (de: Andando, extra?: { pulado?: string; semAncora?: string }) => {
      const pulados = extra?.pulado ? [...de.pulados, extra.pulado] : de.pulados;
      const semAncora = extra?.semAncora
        ? [...de.semAncora, extra.semAncora]
        : de.semAncora;

      const proximo = de.indice + 1;
      if (proximo >= de.tour.passos.length) {
        encerrar({ ...de, indice: de.indice, pulados, semAncora }, "concluido");
        return;
      }

      const estado: Andando = { ...de, indice: proximo, pulados, semAncora };
      setAndando(estado);
      setAlvo(null);
      void gravar(estado, "em_andamento");
    },
    [encerrar, gravar],
  );

  const comecar = useCallback(
    (tour: Tour) => {
      const estado: Andando = { tour, indice: 0, pulados: [], semAncora: [] };
      setAndando(estado);
      setAlvo(null);
      void gravar(estado, "em_andamento");
    },
    [gravar],
  );

  // ------------------------------------------------------------------
  // ACHAR O ELEMENTO — e desistir em silêncio depois de dois segundos
  //
  // **A ESPERA EXISTE PORQUE A TELA CHEGA DEPOIS DO PASSO.** Um passo com
  // rota navega, e o React monta a página seguinte em dois ou três quadros;
  // sem a espera, o tour procuraria o elemento antes de ele existir e pularia
  // todo passo que troca de tela.
  //
  // **E A DESISTÊNCIA É SILENCIOSA, nunca um erro na tela.** O tour nunca
  // trava, nunca mostra erro, nunca aponta para o vazio — e quando ele
  // desiste de um passo que NÃO é `opcional`, isso vira linha em
  // `passos_sem_ancora`: o alarme de tour quebrado, que diz a quem cuida do
  // produto que um seletor envelheceu junto com a tela.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!andando || !passo) return;

    // A ROTA PRIMEIRO. Enquanto o caminho não for o do passo, este efeito
    // roda de novo a cada navegação e não procura nada — procurar aqui
    // acharia o elemento da tela ANTERIOR quando os dois nomes coincidem.
    if (passo.rota && caminho !== passo.rota) {
      router.push(passo.rota);
      return;
    }

    let vivo = true;
    const comecouEm = Date.now();

    const procurar = () => {
      if (!vivo) return;

      // O PRIMEIRO VISÍVEL, e não o primeiro da árvore: o menu é a barra
      // lateral no desktop e a gaveta no celular, e os dois carregam
      // `data-tour="menu"`. O que está escondido tem retângulo de zero.
      const candidatos = document.querySelectorAll<HTMLElement>(
        seletorDaAncora(passo.ancora),
      );
      const achado = [...candidatos].find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      if (achado) {
        achado.scrollIntoView({ block: "center", behavior: "auto" });
        const r = achado.getBoundingClientRect();
        setAlvo({ top: r.top, left: r.left, width: r.width, height: r.height });
        return;
      }

      if (Date.now() - comecouEm >= ESPERA_MAXIMA_MS) {
        // `opcional` NÃO ENTRA NO ALARME: "a pessoa ainda não tem etapa
        // nenhuma" é um estado de verdade do produto, e contá-lo como defeito
        // encheria o alarme de tour quebrado com quem acabou de entrar.
        avancar(andando, passo.opcional ? undefined : { semAncora: passo.id });
        return;
      }

      setTimeout(procurar, INTERVALO_DE_BUSCA_MS);
    };

    procurar();
    return () => {
      vivo = false;
    };
    // `alvo` fica FORA das dependências de propósito: ele é o resultado deste
    // efeito, e incluí-lo reiniciaria a busca a cada medição.
  }, [andando, passo, caminho, router, avancar]);

  // O retângulo acompanha a página: rolar ou redimensionar move o alvo, e um
  // recorte parado sobre a tela rolada destaca o lugar errado.
  useEffect(() => {
    if (!andando || !passo) return;

    const medir = () => {
      const candidatos = document.querySelectorAll<HTMLElement>(
        seletorDaAncora(passo.ancora),
      );
      const achado = [...candidatos].find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (!achado) return;
      const r = achado.getBoundingClientRect();
      setAlvo({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [andando, passo]);

  // ------------------------------------------------------------------
  // O PASSO INTERATIVO: a pessoa clica no elemento DE VERDADE
  //
  // O ouvinte é de CAPTURA e no `document`, e não um `onClick` no alvo: o
  // elemento é da página — um `<Link>` do menu, o botão de nova task — e o
  // tour não o embrulha. Capturar deixa o clique seguir seu caminho (navegar,
  // abrir a gaveta) e o tour só anota que ele aconteceu.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!andando || !passo || passo.tipo !== "interativo") return;

    const aoClicar = (evento: MouseEvent) => {
      const onde = evento.target as HTMLElement | null;
      if (!onde?.closest?.(seletorDaAncora(passo.ancora))) return;
      // Um quadro de folga: o clique ainda vai navegar, e avançar antes disso
      // faria o passo seguinte procurar o elemento na tela que está saindo.
      setTimeout(() => avancar(andando), 0);
    };

    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, [andando, passo, avancar]);

  // ------------------------------------------------------------------
  // O TECLADO: → avança, ← volta, Esc sai
  //
  // **E `Esc` GRAVA `em_andamento`, não `pulado`.** Sair no meio não é
  // desistir do tour: a pessoa volta pelo menu de ajuda e retoma de onde
  // parou, e é `passo_atual` que diz onde. `pulado` é o que o "Pular por
  // agora" do diálogo de boas-vindas escreve — ali ela está dizendo que não
  // quer o tour, que é outra coisa.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!andando) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        setAndando(null);
        setAlvo(null);
        void gravar(andando, "em_andamento", true);
        return;
      }
      if (evento.key === "ArrowRight") {
        evento.preventDefault();
        avancar(andando);
        return;
      }
      if (evento.key === "ArrowLeft" && andando.indice > 0) {
        evento.preventDefault();
        const estado = { ...andando, indice: andando.indice - 1 };
        setAndando(estado);
        setAlvo(null);
        void gravar(estado, "em_andamento");
      }
    };

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [andando, avancar, gravar]);

  const valor = useMemo<Contexto>(
    () => ({ comecar, andando: andando !== null }),
    [comecar, andando],
  );

  return (
    <TourContext.Provider value={valor}>
      {children}
      {andando && passo && alvo && (
        <Destaque
          passo={passo}
          alvo={alvo}
          indice={andando.indice}
          total={andando.tour.passos.length}
          aoVoltar={
            andando.indice > 0
              ? () => {
                  const estado = { ...andando, indice: andando.indice - 1 };
                  setAndando(estado);
                  setAlvo(null);
                  void gravar(estado, "em_andamento");
                }
              : null
          }
          aoAvancar={() => avancar(andando)}
          aoPular={() => avancar(andando, { pulado: passo.id })}
          aoSair={() => {
            setAndando(null);
            setAlvo(null);
            void gravar(andando, "em_andamento", true);
          }}
        />
      )}
    </TourContext.Provider>
  );
}

const RESPIRO = 10;

/** Quanto o balão ocupa, para escolher o lado antes de ele existir. */
const ALTURA_DO_BALAO = 190;

function Destaque({
  passo,
  alvo,
  indice,
  total,
  aoVoltar,
  aoAvancar,
  aoPular,
  aoSair,
}: {
  passo: PassoDoTour;
  alvo: Retangulo;
  indice: number;
  total: number;
  aoVoltar: (() => void) | null;
  aoAvancar: () => void;
  aoPular: () => void;
  aoSair: () => void;
}) {
  const balao = useRef<HTMLDivElement>(null);

  // O FOCO VAI PARA O BALÃO A CADA PASSO, que é o que faz o teclado e o leitor
  // de tela acompanharem o tour em vez de ficarem no botão de onde ele
  // começou. `tabIndex={-1}` deixa o elemento focável por código sem entrar na
  // ordem do Tab.
  useEffect(() => {
    balao.current?.focus();
  }, [indice]);

  const alturaDaJanela = typeof window === "undefined" ? 0 : window.innerHeight;
  const larguraDaJanela = typeof window === "undefined" ? 0 : window.innerWidth;

  const cabeEmbaixo =
    alvo.top + alvo.height + RESPIRO + ALTURA_DO_BALAO <= alturaDaJanela;

  const topo = cabeEmbaixo
    ? alvo.top + alvo.height + RESPIRO
    : Math.max(RESPIRO, alvo.top - RESPIRO - ALTURA_DO_BALAO);

  // Em 375px o balão tem a largura da tela menos o respiro dos dois lados, e o
  // `clamp` é o que o mantém inteiro quando o alvo está na borda — um balão
  // cortado pela direita esconde justamente os botões.
  const largura = Math.min(360, larguraDaJanela - 2 * RESPIRO);
  const esquerda = Math.max(
    RESPIRO,
    Math.min(larguraDaJanela - largura - RESPIRO, alvo.left),
  );

  return (
    <>
      {/*
        O VÉU É O PRÓPRIO RECORTE: um elemento do tamanho do alvo com uma
        sombra de 9999px, que escurece tudo o que está em volta e deixa o alvo
        em claro. Dois elementos (um véu e um buraco) exigiriam quatro
        retângulos para fazer o mesmo contorno.

        `pointer-events-none` é a linha que importa: o clique da página
        continua chegando onde chegava, que é o que o passo interativo precisa
        — e é a leitura literal de "nunca bloquear a tela inteira".
      */}
      <div
        aria-hidden
        className="tour-recorte pointer-events-none fixed z-[70]"
        style={{
          top: alvo.top - 4,
          left: alvo.left - 4,
          width: alvo.width + 8,
          height: alvo.height + 8,
        }}
      />

      <div
        ref={balao}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="tour-titulo"
        aria-describedby="tour-texto"
        className="bg-card rounded-card shadow-cartao border-border fixed z-[71] border p-4 outline-none"
        style={{ top: topo, left: esquerda, width: largura }}
      >
        <p className="text-text-muted text-[11px] font-medium tracking-wide uppercase">
          Passo {indice + 1} de {total}
        </p>
        <h2 id="tour-titulo" className="text-text-primary mt-1 font-semibold">
          {passo.titulo}
        </h2>
        <p id="tour-texto" className="text-text-secondary mt-1 text-sm">
          {passo.texto}
        </p>

        {passo.tipo === "interativo" && (
          <p className="text-action-text mt-2 text-sm font-medium">
            Clique aqui para continuar.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {aoVoltar && (
            <Button type="button" variant="ghost" size="sm" onClick={aoVoltar}>
              Voltar
            </Button>
          )}

          {/*
            NO PASSO INTERATIVO NÃO HÁ "Próximo", E HÁ SEMPRE "Pular este
            passo" — é o pedido do sprint em quantas palavras. Um "Próximo" ali
            desfaria o passo: ele existe para a pessoa clicar no elemento de
            verdade, e um botão que avança sem isso é o caminho que todo mundo
            usa.
          */}
          {passo.tipo === "interativo" ? (
            <Button type="button" variant="outline" size="sm" onClick={aoPular}>
              Pular este passo
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={aoAvancar}>
              {indice + 1 === total ? "Terminar" : "Próximo"}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={aoSair}
          >
            Sair
          </Button>
        </div>
      </div>
    </>
  );
}
