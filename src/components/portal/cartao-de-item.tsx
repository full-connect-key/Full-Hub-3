"use client";

import Image from "next/image";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileImage, Megaphone, Paperclip } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  estaVencendo,
  ROTULO_DO_TIPO,
  type ItemDoPortal,
  type TipoDeItem,
} from "@/lib/dominio/portal";
import { cn } from "@/lib/utils";

/**
 * Um material, do jeito que o cliente lê.
 *
 * **Cartão grande e espaçado, e não linha de tabela.** O cliente entra de vez
 * em quando, quase sempre pelo celular, e o que ele precisa é decidir — não
 * varrer uma lista densa. Densidade é para quem opera, e quem opera é a
 * equipe.
 */

const ICONE: Record<TipoDeItem, typeof Paperclip> = {
  subtask: Paperclip,
  post: FileImage,
  deliverable: Megaphone,
};

export function CartaoDeItem({
  item,
  hoje,
  aoAbrir,
}: {
  item: ItemDoPortal;
  hoje: string;
  aoAbrir?: (item: ItemDoPortal) => void;
}) {
  const Icone = ICONE[item.tipo];
  const vencido = estaVencendo(item.prazo, hoje);

  const conteudo = (
    <article
      className={cn(
        "bg-surface-card flex gap-4 rounded-xl border p-4 text-left transition-colors sm:p-5",
        aoAbrir && "hover:border-accent-strong",
      )}
    >
      {/* A miniatura é opcional e some no celular: 96px de imagem valem menos
          que 96px de título quando a tela tem 375. */}
      {item.miniatura ? (
        <div className="relative hidden size-20 shrink-0 overflow-hidden rounded-lg border sm:block">
          <Image
            src={item.miniatura}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-muted inline-flex items-center gap-1.5 text-xs">
            <Icone aria-hidden className="size-3.5" />
            {ROTULO_DO_TIPO[item.tipo]}
          </span>
          <StatusBadge status={item.status} />
        </div>

        <p className="text-base leading-snug font-medium">{item.titulo}</p>

        {/* A demanda é contexto, e fica embaixo — o item é o que se decide. */}
        <p className="text-text-muted truncate text-sm">{item.demanda}</p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {item.prazo ? (
            <Badge
              variant="outline"
              className={cn(
                "tabular-nums",
                // Vencido ou vencendo hoje, no vermelho. É o único uso de cor
                // forte no cartão, e é de propósito: se tudo chamar atenção,
                // nada chama.
                // Par nomeado, nunca opacidade: `border-danger/40` sobre um
                // fundo qualquer dá uma cor que ninguém mediu, e no tema
                // escuro dá outra.
                vencido && "bg-danger-soft text-danger border-transparent",
              )}
            >
              {vencido ? "Vence hoje · " : "Prazo · "}
              {format(parseISO(item.prazo), "dd 'de' MMMM", { locale: ptBR })}
            </Badge>
          ) : (
            <span className="text-text-muted text-xs">Sem prazo definido</span>
          )}
        </div>
      </div>
    </article>
  );

  if (!aoAbrir) return conteudo;

  return (
    <button
      type="button"
      onClick={() => aoAbrir(item)}
      className="block w-full"
    >
      {conteudo}
    </button>
  );
}
