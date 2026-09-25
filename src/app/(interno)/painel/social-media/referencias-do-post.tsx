"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { ReferenciaDoPost } from "@/lib/dados/social-media";

import { apagarReferencia, juntarReferencia } from "./acoes";

/**
 * As referências de apoio do card (0046).
 *
 * **O ENDEREÇO ENTRA NUM CAMPO DA TELA, nunca num `window.prompt`** — é a
 * mesma decisão do link de referência da Task: o prompt não dá para colar no
 * teclado do celular, não valida nada, some ao clicar fora, e em alguns
 * navegadores simplesmente não abre. O botão vira um botão que não faz nada.
 *
 * **Não existe editar**, e a ausência é a regra: mudar o endereço de uma
 * referência que alguém já abriu é trocar o destino embaixo de quem a leu. A
 * tabela nem tem policy de UPDATE. Apaga e põe outra.
 */
export function ReferenciasDoPost({
  postId,
  referencias,
  podeEscrever,
  ehGestao,
}: {
  postId: string;
  referencias: ReferenciaDoPost[];
  podeEscrever: boolean;
  ehGestao: boolean;
}) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [enviando, enviar] = useTransition();

  function juntar() {
    enviar(async () => {
      const r = await chamarAcao(() => juntarReferencia(postId, { url, titulo }));
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.mensagem);
      setUrl("");
      setTitulo("");
      setAbrindo(false);
      router.refresh();
    });
  }

  function apagar(id: string) {
    enviar(async () => {
      const r = await chamarAcao(() => apagarReferencia(id));
      if (r.ok) {
        toast.success(r.mensagem);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="space-y-2" aria-labelledby={`refs-${postId}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`refs-${postId}`} className="text-text-primary text-sm font-semibold">
          Referências
        </h3>
        {podeEscrever && !abrindo ? (
          <Button variant="ghost" size="sm" onClick={() => setAbrindo(true)}>
            <Plus aria-hidden className="size-3.5" />
            Juntar
          </Button>
        ) : null}
      </div>

      {referencias.length === 0 && !abrindo ? (
        <p className="text-text-muted text-xs">
          O moodboard, o post que foi bem, o link que o cliente mandou.
        </p>
      ) : null}

      {referencias.length > 0 ? (
        <ul className="space-y-1">
          {referencias.map((r) => (
            <li
              key={r.id}
              className="border-border bg-surface-card flex items-center gap-2 rounded-lg border px-2.5 py-2"
            >
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="text-accent-strong flex min-w-0 flex-1 items-center gap-1.5 text-xs hover:underline"
              >
                <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{r.titulo || r.url}</span>
              </a>
              {/* QUEM PÔS FICA À VISTA, e não só num `title`: numa lista de
                  seis links de quatro pessoas, "a Marina achou isto" é metade
                  do que a referência informa. */}
              {r.quem ? (
                <span className="text-text-muted shrink-0 text-xs">{r.quem}</span>
              ) : null}
              {r.minha || ehGestao ? (
                <button
                  type="button"
                  onClick={() => apagar(r.id)}
                  disabled={enviando}
                  aria-label={`Remover ${r.titulo || r.url}`}
                  className="text-text-muted hover:text-danger shrink-0 transition-colors"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {abrindo ? (
        <div className="border-border bg-surface-card space-y-2 rounded-lg border p-2.5">
          <div className="space-y-1">
            <Label htmlFor={`ref-url-${postId}`} className="text-xs">
              Endereço
            </Label>
            <Input
              id={`ref-url-${postId}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`ref-titulo-${postId}`} className="text-xs">
              Como chamar (opcional)
            </Label>
            <Input
              id={`ref-titulo-${postId}`}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Moodboard do cliente"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setAbrindo(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={juntar}
              disabled={enviando || !/^https?:\/\//i.test(url.trim())}
            >
              {enviando ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
              Juntar
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
