import { ROTULO_DA_PLATAFORMA, SIGLA_DA_PLATAFORMA } from "@/lib/dominio/posts";
import type { PlataformaSocial } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * A rede, em duas letras.
 *
 * Por que sigla e não logo está escrito em `lib/dominio/posts.ts`, junto do
 * mapa: o lucide tirou os ícones de marca, ícone genérico não distingue uma
 * rede da outra, e desenhar os logos traria marca registrada e cor literal
 * para dentro do repositório.
 *
 * O nome por extenso viaja no `title` e num `sr-only`: quem lê com leitor de
 * tela ouve "Instagram", e não "I G".
 */
export function SeloDaRede({
  plataforma,
  className,
}: {
  plataforma: PlataformaSocial;
  className?: string;
}) {
  const nome = ROTULO_DA_PLATAFORMA[plataforma];

  return (
    <span
      title={nome}
      className={cn(
        "bg-neutral-soft text-neutral inline-flex h-5 min-w-8 items-center justify-center rounded px-1 text-[0.65rem] font-semibold tracking-wide",
        className,
      )}
    >
      <span aria-hidden>{SIGLA_DA_PLATAFORMA[plataforma]}</span>
      <span className="sr-only">{nome}</span>
    </span>
  );
}
