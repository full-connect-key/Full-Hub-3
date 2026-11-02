"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, Send } from "lucide-react";

import { comentarNoConteudo } from "@/app/(cliente)/portal/_actions/conteudo";
import { useCardSelecionado } from "@/components/portal/card-selecionado";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { Conteudo } from "@/lib/aprovacoes/conteudo";
import type { ComentarioDoConteudo } from "@/lib/dados/conteudo";
import { tempoRelativo } from "@/lib/dominio/recomendacoes";
import { cn } from "@/lib/utils";
import { ANCORAS, ancora } from "@/lib/tour/ancoras";

/**
 * A conversa sobre o material — a mesma, para post e para entregável.
 *
 * **Cada material tem a thread dele**, e no caso da campanha isso quer dizer
 * cada SUB-ITEM: comentar na lâmina não escreve no precificador. É o que faz a
 * conversa sobre uma peça ficar com ela.
 *
 * **Um nível de resposta, e o banco garante isso** — `comments_um_nivel`
 * reescreve resposta de resposta como resposta da raiz. Aqui a tela só não
 * oferece o botão na resposta; é a mesma divisão de sempre: a tela evita o
 * caso, o banco é quem o impede.
 *
 * **Comentário interno não chega aqui**, e não é esta tela que filtra:
 * `comments_select_cliente` exige `interno = false`. Para a equipe, que lê os
 * dois, o marcador aparece — é a única diferença entre as duas visões.
 *
 * **O "agora" desce do servidor.** `tempoRelativo` recebe o instante em vez de
 * ler o relógio, senão o servidor renderiza "há 2 horas" e o navegador, noutro
 * fuso, recalcula outra coisa na hidratação.
 *
 * ---------------------------------------------------------------------------
 * **E NUMA COMPOSIÇÃO A CONVERSA TEM DOIS ESCOPOS: a peça e o CARD** (0126).
 *
 * Decisão do usuário: *"Comentários individuais por card do carrossel (…)
 * histórico individual, autor/data, respostas, indicadores, versões; não
 * misturar cards."* Um carrossel de cinco slides tinha UMA conversa, e o
 * pedido mais comum da casa — *"trocar o texto do terceiro"* — obrigava quem
 * produz a descobrir qual era o terceiro.
 *
 * **O ESCOPO É UM SELETOR COM AS DUAS CONTAGENS À VISTA**, e não uma lista só
 * com um selo por linha. *"Não misturar cards"* descarta a lista única; e
 * esconder a conversa da peça enquanto um card está em foco esconderia a
 * outra metade — então o que recolhe continua dizendo quantos tem dentro, que
 * é a regra da faixa de áreas de Minhas Tasks.
 *
 * **O CARD EM FOCO É O DO VISUALIZADOR, e não um segundo seletor.** Ele vem de
 * `useCardSelecionado()`: o cliente está olhando o terceiro quadro, e a
 * conversa que ele precisa ler é a do terceiro. Dois seletores diriam duas
 * coisas sobre qual card está em foco, e a que divergiria é esta — a que
 * decide onde o texto vai ser gravado.
 *
 * **E A VERSÃO SÓ APARECE QUANDO NÃO É A DE AGORA.** Ela é o que impede o
 * índice de mentir — remover um slide do meio faz os quadros andarem (0048) —,
 * e escrevê-la em toda linha de uma conversa que é toda da versão corrente é a
 * mesma informação repetida: pinta-se a exceção.
 *
 * **Sem composição não há seletor**, e a ausência é a mesma regra: com uma
 * arte só não há card a distinguir, e o controle seria dois botões em que um
 * dos escopos está sempre vazio.
 */
export function ThreadDeComentarios({
  conteudo,
  comentarios,
  agora,
  nomeDaEmpresa,
  somenteLeitura = false,
  composicao,
}: {
  /** O material a que a conversa pertence — post ou entregável. */
  conteudo: Conteudo;
  comentarios: ComentarioDoConteudo[];
  agora: string;
  nomeDaEmpresa: string;
  somenteLeitura?: boolean;
  /**
   * A composição desta peça, quando ela é um carrossel: quantos quadros e qual
   * é a versão de agora. Ausente = uma arte só, e aí não há card (0126).
   */
  composicao?: { quadros: number; versaoAtual: number };
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const foco = useCardSelecionado();
  const [escopo, setEscopo] = useState<"peca" | "card">("peca");

  // O SELETOR SÓ EXISTE COM COMPOSIÇÃO E COM FOCO. Sem um dos dois não há card
  // a distinguir, e o controle ofereceria um escopo sempre vazio.
  const porCard = Boolean(composicao && composicao.quadros > 1 && foco);
  const cardEmFoco = porCard ? (foco?.card ?? 0) : null;
  const escopoAtual = porCard ? escopo : "peca";

  const daPeca = comentarios.filter((c) => c.cardIndice === null);
  const doCard =
    cardEmFoco === null
      ? []
      : comentarios.filter((c) => c.cardIndice === cardEmFoco);

  const visiveis = escopoAtual === "card" ? doCard : daPeca;

  const raizes = visiveis.filter((c) => c.respostaA === null);
  const respostas = (id: string) =>
    visiveis.filter((c) => c.respostaA === id);

  // `chamarEMostrar` e não `chamarAcao`: a recusa precisa virar toast. Ver a
  // explicação em `decisoes-do-conteudo.tsx` — os dois componentes tinham o
  // mesmo silêncio, e um comentário que some sem dizer nada faz a pessoa
  // escrever de novo, e de novo.
  function enviar() {
    iniciar(async () => {
      const resultado = await chamarEMostrar(() =>
        comentarNoConteudo(
          conteudo,
          texto,
          respondendo,
          // O PAR INTEIRO OU NENHUM (0126). E mesmo que o escopo estivesse
          // errado, a resposta herda o card da raiz no trigger — a tela evita
          // o caso, o banco é quem o impede.
          escopoAtual === "card" && cardEmFoco !== null && composicao
            ? { indice: cardEmFoco, versao: composicao.versaoAtual }
            : null,
        ),
      );
      if (resultado.ok) {
        setTexto("");
        setRespondendo(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4" {...ancora(ANCORAS.portalComentarios)}>
      <h2 className="text-xl font-bold tracking-[-0.02em]">Comentários</h2>

      {porCard && cardEmFoco !== null ? (
        // AS DUAS CONTAGENS À VISTA, sempre — inclusive no zero. Aqui a linha
        // RESPONDE o que existe em cada escopo, e "nenhum" é resposta: é o
        // contrário do selo da fila de aprovações, que COBRA uma ação e por
        // isso some no zero.
        <div
          role="group"
          aria-label="Sobre o que é a conversa"
          className="bg-muted inline-flex rounded-lg p-0.5 text-xs"
        >
          {(
            [
              ["peca", "A peça inteira", daPeca.length],
              ["card", `Card ${cardEmFoco + 1}`, doCard.length],
            ] as const
          ).map(([chave, rotulo, quantos]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setEscopo(chave)}
              aria-pressed={escopoAtual === chave}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium",
                escopoAtual === chave
                  ? "bg-action-soft text-action-text"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {rotulo}{" "}
              <span className="tabular-nums">({quantos})</span>
            </button>
          ))}
        </div>
      ) : null}

      {raizes.length === 0 ? (
        <p className="text-text-muted text-sm">
          {escopoAtual === "card" && cardEmFoco !== null
            ? `Nenhum comentário no card ${cardEmFoco + 1}. Escreva aqui o que precisa mudar neste quadro.`
            : "Nenhum comentário ainda. Use este espaço para falar sobre este material."}
        </p>
      ) : (
        <ul className="space-y-4">
          {raizes.map((comentario) => (
            <li key={comentario.id} className="space-y-3">
              <Comentario
                comentario={comentario}
                agora={agora}
                nomeDaEmpresa={nomeDaEmpresa}
                versaoAtual={composicao?.versaoAtual}
                aoResponder={
                  somenteLeitura
                    ? undefined
                    : () => setRespondendo(comentario.id)
                }
              />

              {respostas(comentario.id).length > 0 ? (
                <ul className="space-y-3 border-l pl-4 sm:pl-6">
                  {respostas(comentario.id).map((resposta) => (
                    <li key={resposta.id}>
                      <Comentario
                        comentario={resposta}
                        agora={agora}
                        nomeDaEmpresa={nomeDaEmpresa}
                        versaoAtual={composicao?.versaoAtual}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {somenteLeitura ? null : (
        // NO CELULAR O CAMPO FICA PRESO AO RODAPÉ. Numa thread longa, um campo
        // no fim da lista obriga a rolar até o fim para responder — e a pessoa
        // perde de vista o comentário que estava lendo.
        <div className="bg-surface-card sticky bottom-0 -mx-4 space-y-2 border-t p-4 sm:static sm:mx-0 sm:rounded-xl sm:border sm:p-4">
          {respondendo ? (
            <p className="text-text-muted flex items-center gap-1.5 text-xs">
              <CornerDownRight aria-hidden className="size-3.5" />
              Respondendo
              <button
                type="button"
                onClick={() => setRespondendo(null)}
                className="text-accent-strong hover:underline"
              >
                cancelar
              </button>
            </p>
          ) : null}

          <Textarea
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            rows={3}
            placeholder={
              escopoAtual === "card" && cardEmFoco !== null
                ? `Escreva sobre o card ${cardEmFoco + 1}`
                : "Escreva um comentário"
            }
            aria-label={
              escopoAtual === "card" && cardEmFoco !== null
                ? `Novo comentário no card ${cardEmFoco + 1}`
                : "Novo comentário"
            }
          />

          <div className="flex justify-end">
            <Button
              onClick={enviar}
              disabled={enviando || texto.trim().length === 0}
            >
              <Send aria-hidden className="size-4" />
              Comentar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Comentario({
  comentario,
  agora,
  nomeDaEmpresa,
  aoResponder,
  versaoAtual,
}: {
  comentario: ComentarioDoConteudo;
  agora: string;
  nomeDaEmpresa: string;
  aoResponder?: () => void;
  /** A versão de agora, para a do comentário só aparecer quando divergir. */
  versaoAtual?: number;
}) {
  const quando = tempoRelativo(comentario.quando, agora);

  // A VERSÃO SÓ APARECE QUANDO NÃO É A DE AGORA, e é ela que impede o índice
  // de mentir: remover um slide do meio faz os quadros andarem (0048), então
  // um pedido do terceiro de cinco cairia no terceiro de quatro. Dizendo de
  // que composição ele falava, a linha volta a ser uma afirmação verdadeira.
  const versaoAntiga =
    comentario.cardVersao !== null &&
    versaoAtual !== undefined &&
    comentario.cardVersao !== versaoAtual
      ? comentario.cardVersao
      : null;

  return (
    <div className="flex gap-3">
      <UserAvatar name={comentario.autor} size="sm" className="shrink-0" />

      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{comentario.autor}</span>
          {/* A identificação é a ORGANIZAÇÃO, e não o cargo: o cliente não
              precisa saber quem é desenvolvedor e quem é social media. */}
          <span className="text-text-muted text-xs">
            {comentario.daAgencia ? "Full Connect Key" : nomeDaEmpresa}
          </span>
          {quando ? (
            <span className="text-text-muted text-xs">{quando}</span>
          ) : null}
          {versaoAntiga !== null ? (
            <span
              className="bg-neutral-soft text-neutral rounded px-1.5 py-0.5 text-[0.65rem] font-medium"
              title={`Este pedido era sobre a versão ${versaoAntiga}, que não é a que está na tela`}
            >
              pedido na v{versaoAntiga}
            </span>
          ) : null}
          {comentario.interno ? (
            <span className="bg-warning-soft text-warning rounded px-1.5 py-0.5 text-[0.65rem] font-medium">
              Interno
            </span>
          ) : null}
        </p>

        <p
          className={cn(
            "text-sm whitespace-pre-wrap",
            comentario.interno && "italic",
          )}
        >
          {comentario.texto}
        </p>

        {aoResponder ? (
          <button
            type="button"
            onClick={aoResponder}
            className="text-accent-strong text-xs hover:underline"
          >
            Responder
          </button>
        ) : null}
      </div>
    </div>
  );
}
