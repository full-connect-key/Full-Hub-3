"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";

import { EditorRico } from "@/components/shared/editor-rico";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";
import { EMOJI_DE_HUMOR, HUMORES, ROTULOS_DE_HUMOR, type Humor } from "@/lib/dominio/skills";
import { cn } from "@/lib/utils";

import { puxarEntregasDaSemana, salvarNotaDaSemana } from "./acoes";

/**
 * O texto livre da semana.
 *
 * Salva sozinho, como o perfil de skills e pela mesma razão: ninguém escreve
 * uma reflexão de uma vez só, e um botão "Salvar" é o jeito mais seguro de
 * perder o parágrafo que a pessoa estava terminando.
 *
 * "Como foi a semana" é opcional de propósito. Pergunta obrigatória produz
 * resposta automática, que não diz nada — é a mesma razão pela qual o registro
 * de tempo ao concluir uma task dá para pular.
 */
export function NotaDaSemana({
  semanaISO,
  fimISO,
  conteudoInicial,
  humorInicial,
  temEntregasParaPuxar,
  aoMudar,
}: {
  semanaISO: string;
  fimISO: string;
  conteudoInicial: JSONContent | null;
  humorInicial: Humor | null;
  temEntregasParaPuxar: boolean;
  aoMudar: () => void;
}) {
  const [humor, setHumor] = useState<Humor | null>(humorInicial);
  const [gravadoEm, setGravadoEm] = useState<string | null>(null);
  const [puxando, setPuxando] = useState(false);

  const conteudo = useRef<{ json: JSONContent | null; texto: string }>({
    json: conteudoInicial,
    texto: "",
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gravar = useCallback(
    (humorAtual: Humor | null) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const resultado = await chamarAcao(() =>
          salvarNotaDaSemana({
            semana: semanaISO,
            conteudo_rico: conteudo.current.json,
            conteudo_texto: conteudo.current.texto,
            humor: humorAtual,
          }),
        );
        if (!resultado.ok) toast.error(resultado.error);
        else {
          setGravadoEm(
            new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          );
        }
      }, 1200);
    },
    [semanaISO],
  );

  // A gravação pendente não pode morrer com a tela: trocar de semana logo
  // depois de escrever perderia o último parágrafo, que é sempre o que a
  // pessoa lembra de ter escrito.
  useEffect(() => {
    const atual = timer;
    return () => {
      if (atual.current) clearTimeout(atual.current);
    };
  }, []);

  function puxar() {
    setPuxando(true);
    void (async () => {
      const resultado = await chamarAcao(() => puxarEntregasDaSemana(semanaISO, fimISO));
      setPuxando(false);
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        aoMudar();
      }
    })();
  }

  return (
    <section className="bg-surface-card rounded-card space-y-3 border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-text-primary text-sm font-semibold">Como foi a semana</h2>

        <div className="ml-auto flex items-center gap-2">
          {gravadoEm ? (
            <span className="text-text-muted inline-flex items-center gap-1 text-xs">
              <Check aria-hidden className="size-3.5" />
              salvo às {gravadoEm}
            </span>
          ) : null}

          {temEntregasParaPuxar ? (
            <Button variant="outline" size="sm" disabled={puxando} onClick={puxar}>
              {puxando ? <Loader2 className="animate-spin" /> : <Sparkles aria-hidden />}
              Puxar minhas entregas
            </Button>
          ) : null}

          <Button asChild variant="outline" size="sm">
            <a href="/painel/resumo-semanal/exportar" download>
              <Download aria-hidden />
              Exportar
            </a>
          </Button>
        </div>
      </div>

      <EditorRico
        conteudo={conteudoInicial}
        placeholder="O que rendeu, o que travou, o que você aprendeu…"
        onChange={(dados) => {
          conteudo.current = { json: dados.json, texto: dados.texto };
          gravar(humor);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-muted text-xs">Como foi? (opcional)</span>
        {HUMORES.map((opcao) => {
          const escolhido = humor === opcao;
          return (
            <button
              key={opcao}
              type="button"
              aria-pressed={escolhido}
              onClick={() => {
                // Clicar no mesmo de novo desmarca: sem isso, quem clicou sem
                // querer não teria como voltar a "não respondi".
                const proximo = escolhido ? null : opcao;
                setHumor(proximo);
                gravar(proximo);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                escolhido
                  ? "border-accent-strong bg-accent text-accent-foreground font-medium"
                  : "text-text-secondary hover:bg-accent",
              )}
            >
              <span aria-hidden>{EMOJI_DE_HUMOR[opcao]}</span>
              {ROTULOS_DE_HUMOR[opcao]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
