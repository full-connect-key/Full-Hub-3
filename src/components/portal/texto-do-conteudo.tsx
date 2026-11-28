"use client";

import { useState } from "react";
import { Check, Copy, Highlighter } from "lucide-react";

import { useCardSelecionado } from "@/components/portal/card-selecionado";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LIMITE = 320;

/**
 * O texto que acompanha a arte, inteiro, com botão de copiar.
 *
 * **O RÓTULO VEM DE FORA**, e não está escrito aqui: é a "legenda" no post e a
 * "descrição" no entregável de campanha. Com a palavra fixa, a tela do
 * entregável mostrava a seção "Descrição" e, logo abaixo, um botão dizendo
 * "Copiar legenda" — foi a imagem do protótipo que mostrou, depois de a tela
 * passar a servir os dois módulos.
 *
 * **Copiar é a razão de o texto estar aqui.** Quem aprova um post é quem
 * muitas vezes vai publicá-lo, e selecionar um parágrafo longo no celular sem
 * disparar o menu de seleção é uma luta. Um clique resolve.
 *
 * `navigator.clipboard` pode ser recusado (aba sem foco, permissão negada), e
 * por isso a recusa é tratada: dizer "copiado" sem ter copiado é pior que não
 * ter o botão.
 */
export function TextoDoConteudo({
  texto: legenda,
  rotulo,
}: {
  texto: string | null;
  /** Em minúscula: ele entra no meio de frases ("Copiar legenda"). */
  rotulo: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [copiou, setCopiou] = useState<boolean | null>(null);
  const foco = useCardSelecionado();
  const [selecao, setSelecao] = useState<string | null>(null);

  function lerSelecao() {
    const escolhido = window.getSelection()?.toString().trim() ?? "";
    setSelecao(escolhido.length >= 2 ? escolhido.slice(0, 500) : null);
  }

  if (!legenda) {
    return (
      <p className="text-text-muted text-sm">
        Este material ainda não tem {rotulo}.
      </p>
    );
  }

  const longa = legenda.length > LIMITE;
  const visivel = aberta || !longa ? legenda : `${legenda.slice(0, LIMITE)}…`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(legenda!);
      setCopiou(true);
    } catch {
      setCopiou(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* GRIFAR E COMENTAR (0164): selecionar um trecho faz aparecer o botão
          que o leva para a conversa, como citação do comentário. */}
      <p
        className="text-sm whitespace-pre-wrap"
        onMouseUp={lerSelecao}
        onTouchEnd={lerSelecao}
      >
        {visivel}
      </p>
      {foco && selecao ? (
        <Button
          size="sm"
          onClick={() => {
            foco.definirTrecho(selecao);
            setSelecao(null);
            document
              .getElementById("comentar-no-material")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          <Highlighter aria-hidden className="size-4" />
          Comentar este trecho
        </Button>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {longa ? (
          <button
            type="button"
            onClick={() => setAberta((a) => !a)}
            className="text-accent-strong text-sm hover:underline"
          >
            {aberta ? "Mostrar menos" : `Ler ${rotulo} inteira`}
          </button>
        ) : null}

        <Button variant="ghost" size="sm" onClick={copiar}>
          {copiou ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
          {copiou ? "Copiado" : `Copiar ${rotulo}`}
        </Button>

        {copiou === false ? (
          <span className={cn("text-danger text-xs")}>
            O navegador não deixou copiar — selecione o texto acima.
          </span>
        ) : null}
      </div>
    </div>
  );
}
