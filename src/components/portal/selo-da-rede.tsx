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

/**
 * As redes de um post, uma sigla ao lado da outra (0082).
 *
 * ---------------------------------------------------------------------------
 * **Um componente a mais, e não um `plataformas` dentro de `SeloDaRede`.** O
 * selo responde "que rede é esta?" e é usado também fora de post — na linha de
 * um filtro, por exemplo. Aqui a pergunta é outra, "em que redes este post
 * sai?", e a resposta pode ser duas siglas. Juntar as duas num componente só
 * daria um `plataforma?` e um `plataformas?` opcionais, onde passar os dois é
 * um estado que nada recusa.
 *
 * **O vão é de 2px e nunca `gap-1`.** As duas siglas são o MESMO fato — esta
 * peça sai nos dois lugares —, e com o vão normal elas se leem como dois selos
 * de coisas diferentes, do jeito que a rede e o status se leem no cartão.
 *
 * **E o nome por extenso de cada uma viaja no `title` de cada selo**, que é
 * onde ele já morava: duas siglas coladas não viram uma palavra nova.
 * ---------------------------------------------------------------------------
 */
export function SelosDasRedes({
  plataformas,
  className,
  classeDoSelo,
}: {
  plataformas: PlataformaSocial[];
  className?: string;
  /** Repassada a CADA selo — é o tamanho que a célula do calendário aperta. */
  classeDoSelo?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {plataformas.map((p) => (
        <SeloDaRede key={p} plataforma={p} className={classeDoSelo} />
      ))}
    </span>
  );
}
