import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Images, ImageOff, Play } from "lucide-react";

import { SeloDaRede } from "@/components/portal/selo-da-rede";
import { ROTULO_DA_PLATAFORMA, type PostDoPortal } from "@/lib/dominio/posts";
import {
  corDoPontoDeStatus,
  rotuloDoStatus,
} from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

/**
 * O feed em blocos, como ele vai ficar na rede (decisão do usuário).
 *
 * *"Quero que o cliente tenha uma visualização do social, em blocos, desse
 * jeito, para ele visualizar como vai ficar futuramente no feed do instagram,
 * e que ao clicar, ele acesse as informações do post."*
 *
 * ---------------------------------------------------------------------------
 * **É UMA GRADE POR REDE, e não uma grade de tudo.**
 *
 * Um feed é de uma rede só: misturar Instagram e LinkedIn na mesma grade de
 * três colunas mostra uma composição que nunca vai existir em lugar nenhum —
 * e essa tela existe justamente para mostrar como vai ficar. Quando o mês tem
 * mais de uma rede e ninguém escolheu, a linha acima da grade diz isso e o
 * filtro que já existe (`?plataforma=`) é o caminho. **Nada é escolhido em
 * silêncio**: uma grade que mostra só o Instagram sem avisar esconde os outros
 * posts do mês de quem veio conferir o mês.
 * ---------------------------------------------------------------------------
 *
 * **Três colunas em toda largura**, e não quatro no desktop: é o número da
 * grade do Instagram, e a proporção entre as peças é o que o cliente está
 * conferindo. Quatro colunas mostrariam uma composição diferente da que vai
 * existir — o mesmo motivo pelo qual `CapaDoCartao` é o mesmo componente nos
 * dois lados.
 *
 * **Do mais novo para o mais antigo**, que é a ordem do feed: o que vai ao ar
 * por último aparece em cima, à esquerda. A grade do calendário é o contrário
 * — lá a pergunta é "o que acontece quando", e o tempo anda para a frente.
 *
 * **`aspect-square` e `object-cover`**: a rede corta em quadrado na grade, e
 * mostrar a arte inteira com barras em volta seria mostrar o que não vai
 * aparecer.
 *
 * **O status entra como PONTO no canto, e não como faixa.** A faixa colorida
 * do calendário cobre a miniatura, e aqui a miniatura é o conteúdo da tela.
 * O nome exato vai no `title` e no rótulo acessível, como no cartão.
 */
export function GradeDoFeed({
  posts,
  artes,
  base,
  redes,
}: {
  posts: PostDoPortal[];
  artes: Record<string, string>;
  base: string;
  /** As redes presentes no mês, para a linha de aviso. */
  redes: PostDoPortal["plataforma"][];
}) {
  // DO MAIS NOVO PARA O MAIS ANTIGO. `slice()` antes de ordenar porque o array
  // vem de cima e ordenar no lugar mudaria a ordem das outras visões.
  const emOrdem = posts
    .slice()
    .sort((a, b) => b.dataPublicacao.localeCompare(a.dataPublicacao));

  return (
    <div className="space-y-4">
      {redes.length > 1 ? (
        <p className="text-warning text-sm">
          Esta grade mistura {redes.length} redes —{" "}
          {redes.map((r) => ROTULO_DA_PLATAFORMA[r]).join(", ")}. Escolha uma no
          filtro acima para ver como o feed dela vai ficar.
        </p>
      ) : null}

      {/* SEM `gap` GRANDE: no Instagram as peças quase se encostam, e é a
          composição entre elas que se confere. Dois pixels é o que separa uma
          arte da outra sem elas virarem uma imagem só. */}
      <ul className="grid grid-cols-3 gap-0.5">
        {emOrdem.map((post) => {
          const arte = post.thumbnailUrl
            ? (artes[post.thumbnailUrl] ?? post.thumbnailUrl)
            : null;
          const estado = rotuloDoStatus(post.status);
          const quando = format(parseISO(post.dataPublicacao), "d 'de' MMMM", {
            locale: ptBR,
          });

          return (
            <li key={post.id}>
              <Link
                href={`${base}/social-media/${post.id}`}
                title={`${post.tema} — ${quando} · ${estado}`}
                className="group bg-neutral-soft focus-visible:ring-accent-strong relative block aspect-square overflow-hidden focus-visible:ring-2 focus-visible:outline-none"
              >
                {arte ? (
                  <Image
                    src={arte}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 33vw, 240px"
                    className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  // SEM ARTE NÃO É UM QUADRADO VAZIO: o tema entra no lugar.
                  // Numa grade, um buraco parece imagem que não carregou —
                  // e a pessoa recarrega a página esperando outra coisa.
                  // `text-text-secondary` E NAO `text-text-muted`: o
                  // `muted` sobre `--neutral-soft` dá 3,9:1, e o axe reprovou
                  // na primeira rodada do protótipo. O par nomeado é o que o
                  // produto usa; opacidade sobre um fundo qualquer dá uma cor
                  // que ninguém mediu.
                  <span className="text-text-secondary flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
                    <ImageOff aria-hidden className="size-5" />
                    <span className="line-clamp-2 text-xs">{post.tema}</span>
                  </span>
                )}

                {/* O CANTO DE CIMA diz o que a miniatura não mostra: que há
                    mais de uma arte, ou que é vídeo. É o que o Instagram faz,
                    e pelo mesmo motivo — a capa de um carrossel é idêntica à
                    de um post único. */}
                {post.midia === "carrossel" || post.midia === "video" ? (
                  <span className="text-text-on-dark absolute top-1.5 right-1.5 drop-shadow">
                    {post.midia === "video" ? (
                      <Play aria-hidden className="size-4 fill-current" />
                    ) : (
                      <Images aria-hidden className="size-4" />
                    )}
                  </span>
                ) : null}

                {/* O PONTO DE STATUS no canto de baixo, do mesmo mapa de cores
                    do calendário e do cartão — uma quarta escala de cor para o
                    mesmo estado seria uma quarta verdade. */}
                <span
                  className={cn(
                    // `ring-white` SEM OPACIDADE, e branco fixo nos dois
                    // temas: o anel existe para separar o ponto de uma imagem
                    // que vem de fora e pode ser de qualquer cor. Um anel que
                    // acompanha o tema some contra metade das artes, e
                    // opacidade sobre a foto dá uma cor que ninguém mediu —
                    // que é a razão do par nomeado em todo o resto.
                    "absolute bottom-1.5 left-1.5 size-2.5 rounded-full ring-2 ring-white",
                    corDoPontoDeStatus(post.status),
                  )}
                />

                <span className="sr-only">
                  {post.tema} — {quando}, {estado},{" "}
                  {ROTULO_DA_PLATAFORMA[post.plataforma]}
                </span>

                {/* A REDE só aparece quando há mais de uma na grade: com uma
                    só, o selo repetiria a mesma sigla em doze quadradinhos. */}
                {redes.length > 1 ? (
                  <SeloDaRede
                    plataforma={post.plataforma}
                    className="absolute top-1.5 left-1.5"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
