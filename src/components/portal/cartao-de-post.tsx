import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImageOff } from "lucide-react";

import { SeloDaRede } from "@/components/portal/selo-da-rede";
import { StatusBadge } from "@/components/shared/status-badge";
import type { PostDoPortal } from "@/lib/dominio/posts";

/**
 * Um post, em linha.
 *
 * É o cartão da visão Lista e o da gaveta de um dia do calendário — o mesmo
 * componente, porque é a mesma informação: miniatura, rede, tema, horário e
 * status. Duas versões divergiriam no dia em que alguém acrescentasse o
 * formato só numa delas.
 */
export function CartaoDePost({
  post,
  arte,
  base,
}: {
  post: PostDoPortal;
  /** O endereço já assinado da miniatura, quando existe. */
  arte: string | null;
  base: string;
}) {
  return (
    <Link
      href={`${base}/social-media/${post.id}`}
      className="bg-surface-card hover:border-accent-strong flex items-center gap-4 rounded-xl border p-3 transition-colors sm:p-4"
    >
      <div className="bg-neutral-soft relative size-16 shrink-0 overflow-hidden rounded-lg border">
        {arte ? (
          <Image src={arte} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <span className="text-text-muted flex size-full items-center justify-center">
            <ImageOff aria-hidden className="size-5" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <SeloDaRede plataforma={post.plataforma} />
          <StatusBadge status={post.status} />
          {post.formato ? (
            <span className="text-text-muted text-xs">{post.formato}</span>
          ) : null}
        </div>

        <p className="leading-snug font-medium">{post.tema}</p>

        <p className="text-text-muted text-sm tabular-nums">
          {format(parseISO(post.dataPublicacao), "dd 'de' MMMM", {
            locale: ptBR,
          })}
          {post.horario ? ` · ${post.horario}` : ""}
        </p>
      </div>
    </Link>
  );
}
