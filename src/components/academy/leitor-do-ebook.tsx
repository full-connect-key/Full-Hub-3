"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { chamarAcao } from "@/lib/acoes/cliente";
import {
  lerMensagemDaPagina,
  veioDoQuadro,
  type EstadoParaAPagina,
} from "@/lib/dominio/ebook-interativo";
import type { EbookInterativo } from "@/lib/dados/academy";

import {
  confirmarLeituraDoEbook,
  marcarCapitulo,
  salvarChecklist,
} from "@/app/(interno)/painel/academy/acoes";

/**
 * O E-BOOK INTERATIVO DENTRO DO FULL HUB.
 *
 * ---------------------------------------------------------------------------
 * **O `sandbox` NÃO TEM `allow-same-origin`, E ESSA É A LINHA QUE MAIS IMPORTA
 * DESTE ARQUIVO.** Sem ela a página roda em origem OPACA: não alcança a sessão
 * do Full Hub, não lê cookie, não escreve no `localStorage` do app. É o que
 * permite hospedar no painel um arquivo HTML com script próprio — que alguém
 * subiu, e que amanhã pode ser outro — sem lhe dar as chaves da casa.
 *
 * Acrescentá-lo "para facilitar o acesso ao estado" desfaz o isolamento
 * inteiro, e é por isso que o estado vem por MENSAGEM.
 *
 * **E a identidade de quem manda vem do `source`, nunca do `origin`.** Com o
 * sandbox a origem chega como a string `"null"` — comparar com ela aceitaria
 * qualquer outro quadro sandboxado da aba.
 * ---------------------------------------------------------------------------
 *
 * **O ESTADO VAI UMA VEZ SÓ POR CARREGAMENTO, e isso não é otimização: é o
 * que impede um laço.** A página recarrega a si mesma ao receber o estado —
 * é como ela reaplica o que foi lido antes de a pessoa tocar em nada —, e o
 * recarregamento manda outro `fullhub:pronto`. Respondendo de novo, ela
 * recarregaria de novo, para sempre. O `jaMandei` vive num `ref` que atravessa
 * o recarregamento do quadro porque o elemento não é remontado.
 *
 * **E ele não vai quando não há nada para restaurar**, pela mesma razão vista
 * do outro lado: mandar um estado vazio custaria um recarregamento que não
 * muda nada na tela, logo na abertura, onde ele aparece como a página piscando.
 */
export function LeitorDoEbook({
  itemId,
  endereco,
  titulo,
  dados,
  onProgresso,
}: {
  itemId: string;
  endereco: string;
  titulo: string;
  dados: EbookInterativo;
  onProgresso?: (lidos: string[]) => void;
}) {
  const quadro = useRef<HTMLIFrameElement>(null);
  const jaMandei = useRef(false);
  const pendentes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [lidos, setLidos] = useState<string[]>(dados.lidos);

  // A LISTA DE LIDOS VIVE AQUI e sobe pela prop, em vez de a tela recarregar a
  // cada caixinha: `router.refresh()` por clique remontaria a página inteira
  // — e o iframe junto, perdendo a posição de leitura de quem está no capítulo
  // dezoito. A barra do cabeçalho anda sozinha, e o banco é a verdade na
  // próxima abertura.
  useEffect(() => {
    onProgresso?.(lidos);
  }, [lidos, onProgresso]);

  /**
   * O DEBOUNCE É POR CHAVE, e não um só para tudo.
   *
   * Um temporizador único faria a segunda caixinha marcada em meio segundo
   * cancelar a gravação da primeira — e a primeira nunca chegaria ao banco.
   * Por chave, cada bloco espera o próprio silêncio: clicar em cinco caixas do
   * mesmo bloco grava uma vez, e em dois blocos diferentes grava duas.
   */
  const comPausa = useCallback((chave: string, fazer: () => void) => {
    const antes = pendentes.current.get(chave);
    if (antes) clearTimeout(antes);
    pendentes.current.set(
      chave,
      setTimeout(() => {
        pendentes.current.delete(chave);
        fazer();
      }, 500),
    );
  }, []);

  useEffect(() => {
    const atual = pendentes.current;
    return () => {
      // SAIR DA TELA NÃO PODE ENGOLIR A ÚLTIMA MARCAÇÃO. Quem fecha a aba logo
      // depois de marcar perderia os 500 ms de espera, e a caixa voltaria
      // desmarcada na sessão seguinte — que é pior que não ter salvado, porque
      // a pessoa viu a marcação acontecer.
      for (const [, t] of atual) clearTimeout(t);
      atual.clear();
    };
  }, []);

  useEffect(() => {
    function aoReceber(evento: MessageEvent) {
      if (!veioDoQuadro(evento.source, quadro.current?.contentWindow ?? null)) return;

      const mensagem = lerMensagemDaPagina(evento.data);
      if (!mensagem) return;

      switch (mensagem.tipo) {
        case "fullhub:pronto": {
          if (jaMandei.current) return;
          const temEstado = dados.lidos.length > 0 || Object.keys(dados.checks).length > 0;
          if (!temEstado) {
            jaMandei.current = true;
            return;
          }
          const recado: EstadoParaAPagina = {
            tipo: "fullhub:estado",
            lidos: dados.lidos,
            checks: dados.checks,
          };
          jaMandei.current = true;
          // `"*"` É OBRIGATÓRIO AQUI, e não é descuido: a origem do quadro é
          // opaca, então nenhuma origem concreta casaria e a mensagem não
          // sairia. O que a torna segura é o conteúdo — ela carrega o que a
          // própria pessoa já leu, e mais nada.
          quadro.current?.contentWindow?.postMessage(recado, "*");
          return;
        }

        case "fullhub:capitulo": {
          const chave = mensagem.chave;
          setLidos((antes) =>
            mensagem.lido
              ? antes.includes(chave)
                ? antes
                : [...antes, chave]
              : antes.filter((c) => c !== chave),
          );
          comPausa(`cap:${chave}`, () => {
            void chamarAcao(() =>
              marcarCapitulo({ item_id: itemId, chave, lido: mensagem.lido }),
            ).then((r) => {
              if (!r.ok) console.error("[ebook] capítulo:", r.error);
            });
          });
          return;
        }

        case "fullhub:checklist": {
          const { chave, marcados } = mensagem;
          comPausa(`ck:${chave}`, () => {
            void chamarAcao(() =>
              salvarChecklist({
                item_id: itemId,
                versao: dados.versao,
                chave,
                marcados,
              }),
            ).then((r) => {
              if (!r.ok) console.error("[ebook] checklist:", r.error);
            });
          });
          return;
        }

        case "fullhub:concluido": {
          // A PÁGINA PEDE, E O BOTÃO CONTINUA EXISTINDO. Ela avisa quando a
          // pessoa marcou o último capítulo, e isso grava a conclusão — mas
          // "Li e estou ciente" fica no cabeçalho de qualquer jeito, porque
          // quem já conhece o processo não vai marcar vinte e três caixas para
          // dizer que está ciente.
          comPausa("fim", () => {
            void chamarAcao(() => confirmarLeituraDoEbook(itemId)).then((r) => {
              if (!r.ok) console.error("[ebook] conclusão:", r.error);
            });
          });
          return;
        }
      }
    }

    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, [itemId, dados, comPausa]);

  return (
    <iframe
      ref={quadro}
      src={endereco}
      title={titulo}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      /*
        A ALTURA É A JANELA MENOS O CABEÇALHO, e não uma altura fixa: o e-book
        tem índice lateral, busca e rolagem próprios, e um quadro curto poria
        uma barra de rolagem dentro de outra. Em telas pequenas o cabeçalho
        ocupa mais, e por isso o desconto cresce.
      */
      className="rounded-card h-[calc(100vh-16rem)] w-full border bg-white lg:h-[calc(100vh-13rem)]"
    />
  );
}
