import { CalendarPlus } from "lucide-react";

import { CartaoDePost } from "@/components/portal/cartao-de-post";
import { enderecoDaArte } from "@/lib/dados/conteudo";
import type { PostDoPortal } from "@/lib/dominio/posts";

/**
 * AS PEÇAS DO MÊS QUE AINDA NÃO TÊM DIA MARCADO.
 *
 * ---------------------------------------------------------------------------
 * **ELA EXISTE PORQUE ELAS EXISTIAM E NÃO APARECIAM.** Desde a 0044 o mês de
 * social abre em branco — quem produz distribui os dias depois —, e desde a
 * 0076 o material pode ir ao cliente antes de ter dia nenhum. `postsDoMes`
 * recortava o mês pela data de publicação, então a RLS liberava a peça e a
 * consulta a escondia: o cliente lia um item esperando a decisão dele na tela
 * inicial e abria a área de Social vazia. Com o recorte pela demanda do mês
 * ela volta à lista, e precisa de um lugar na tela — este.
 *
 * O porquê inteiro mora no CLAUDE.md; aqui fica a consequência: **a data não
 * decide se o material existe para o cliente**, e `check:cores` cobra isso de
 * toda leitura nova.
 * ---------------------------------------------------------------------------
 *
 * **ELA FICA ACIMA DA GRADE, no calendário**, e não embaixo: o cliente entrou
 * aqui para decidir material, e uma peça esperando a decisão dele não pode
 * ficar depois de seis semanas de grade. Na LISTA ela vai para o fim, porque
 * ali a ordem é cronológica e o que não tem data não tem lugar na cronologia.
 *
 * **O TÍTULO DIZ QUANTAS SÃO**, pela razão do cabeçalho do `GrupoDobravel`:
 * a contagem é o que faz uma faixa recolhível ser segura, e aqui ela é o que
 * diz de relance se falta uma peça ou doze.
 *
 * *O que NÃO foi feito, e é dito em vez de escondido:* o pedido trazia a peça
 * "arrastável para o dia quando a data existir". **O cliente não escolhe a
 * data** — `posts_update` é `is_staff()` desde a 0032, e a data é de quem
 * produz desde a 0044. Um alvo de solta aqui prometeria uma mudança que o
 * banco recusa, que é a razão pela qual o arrasto saiu do Calendário Full na
 * 0077. Quem marca o dia é a agência, no Social Media.
 */
export function BandejaSemData({
  posts,
  artes,
  base,
}: {
  posts: PostDoPortal[];
  artes: Record<string, string>;
  base: string;
}) {
  if (posts.length === 0) return null;

  return (
    <section
      aria-labelledby="sem-data-definida"
      className="border-border bg-surface-card space-y-3 rounded-xl border p-4"
    >
      <div className="flex items-center gap-2">
        <CalendarPlus className="text-text-muted size-4 shrink-0" aria-hidden />
        <h2
          id="sem-data-definida"
          className="text-text-secondary text-xs font-semibold tracking-wide uppercase"
        >
          Sem data definida ({posts.length})
        </h2>
      </div>

      {/* A FRASE EXPLICA O ESTADO, e não pede nada: a peça está aqui porque o
          dia ainda vai ser combinado, e isso é normal — não é pendência da
          pessoa que está lendo. O que ela precisa fazer, quando precisa, está
          no cartão. */}
      <p className="text-text-muted text-sm">
        O dia destas peças ainda vai ser combinado. Você já pode abrir e decidir
        cada uma.
      </p>

      <div className="space-y-3">
        {posts.map((post) => (
          <CartaoDePost
            key={post.id}
            post={post}
            arte={enderecoDaArte(post.thumbnailUrl, artes)}
            base={base}
          />
        ))}
      </div>
    </section>
  );
}
