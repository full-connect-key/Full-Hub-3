"use client";

import { PLATAFORMAS, ROTULO_DA_PLATAFORMA } from "@/lib/dominio/posts";
import type { PlataformaSocial } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * As redes de uma peça, em chips que se marcam e desmarcam (0082).
 *
 * ---------------------------------------------------------------------------
 * **Substitui o `<Select>` de rede, e a troca é mecânica antes de ser de
 * gosto:** um `<Select>` escolhe UM valor, e a decisão do usuário é poder
 * juntar duas — *"tudo que postamos no Instagram postamos no Facebook"*. Um
 * multi-select nativo (`<select multiple>`) existe e é pior: no celular ele
 * abre uma lista em que marcar o segundo item desmarca o primeiro em metade
 * dos navegadores, e é justamente o celular que o produto trata como caminho
 * principal.
 *
 * **É um componente compartilhado porque são TRÊS telas** — abrir o post
 * avulso, editar o post e abrir o mês. Três linhas de chips escritas por conta
 * própria acabariam com três ordens de rede e três jeitos de dizer que nenhuma
 * está marcada, e a que divergisse seria a de abrir o mês, que é a que decide
 * sessenta peças de uma vez.
 *
 * **A ordem é a de `PLATAFORMAS`, e nunca a ordem em que a pessoa clicou.**
 * É a mesma ordem que `abrir_mes_de_social()` usa para nomear a combinação, e
 * a mesma que o `array_agg` grava na coluna: duas pessoas marcando Facebook e
 * Instagram em ordens diferentes precisam gravar a mesma lista, senão o selo
 * do card sai invertido conforme quem abriu.
 *
 * **O rótulo traz a sigla E o nome.** A sigla sozinha é o que o card e o
 * calendário usam, onde o espaço é de uma célula; aqui há largura, e quem está
 * escolhendo a rede de um mês inteiro não deveria precisar lembrar que PT é
 * Pinterest.
 * ---------------------------------------------------------------------------
 */
export function SeletorDeRedes({
  valor,
  aoMudar,
  desabilitado,
  id,
  rotulo = "Redes",
}: {
  valor: PlataformaSocial[];
  aoMudar: (redes: PlataformaSocial[]) => void;
  desabilitado?: boolean;
  id?: string;
  /** Nomeia o grupo para quem usa leitor de tela. */
  rotulo?: string;
}) {
  function alternar(rede: PlataformaSocial) {
    // A LISTA SAI SEMPRE NA ORDEM DE `PLATAFORMAS`, e por isso ela é
    // reconstruída por filtro em vez de receber um `push`.
    const marcadas = new Set(valor);
    if (marcadas.has(rede)) marcadas.delete(rede);
    else marcadas.add(rede);
    aoMudar(PLATAFORMAS.filter((p) => marcadas.has(p)));
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={rotulo}
      className="flex flex-wrap items-center gap-1.5"
    >
      {PLATAFORMAS.map((rede) => {
        const marcada = valor.includes(rede);
        return (
          <button
            key={rede}
            type="button"
            disabled={desabilitado}
            onClick={() => alternar(rede)}
            aria-pressed={marcada}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors disabled:opacity-50",
              marcada
                ? "border-accent-strong bg-accent text-accent-foreground font-medium"
                : "hover:bg-accent",
            )}
          >
            {ROTULO_DA_PLATAFORMA[rede]}
          </button>
        );
      })}
    </div>
  );
}
