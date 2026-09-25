"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Heart, MessageCircle } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import {
  COR_DA_CATEGORIA,
  ICONE_DA_CATEGORIA,
  ROTULOS_DE_CATEGORIA,
  dominioDoLink,
  tempoRelativo,
} from "@/lib/dominio/recomendacoes";
import type { PostDoFeed } from "@/lib/dados/recomendacoes";
import { cn } from "@/lib/utils";

/**
 * Uma recomendação na grade.
 *
 * **Recomendação é conteúdo visual**, e a tela era uma lista de linhas de
 * texto. Um filme, um curso e uma ferramenta não se distinguem por tipografia
 * — quem varre o feed procura a capa, não o título.
 *
 * ---------------------------------------------------------------------------
 * O CARTÃO INTEIRO É CLICÁVEL, E O CORAÇÃO NÃO ABRE NADA
 *
 * São dois alvos com donos diferentes no mesmo retângulo, e é o que faz um
 * feed funcionar: curtir é o gesto de um segundo, e ter que abrir o detalhe
 * para dá-lo é o que mata a curtida. O coração para o clique antes que ele
 * chegue ao cartão (`stopPropagation`).
 *
 * **E não é um `<Link>` por fora com um `<button>` dentro.** Botão dentro de
 * âncora é elemento interativo dentro de elemento interativo: o clique vai
 * para um dos dois conforme o navegador, e o teclado tabula para um controle
 * que não existe na árvore de acessibilidade. O cartão é um `<article>` com o
 * TÍTULO sendo o link — e uma camada invisível sobre o cartão estendendo a
 * área desse link, que é o padrão que mantém um alvo grande sem inventar um
 * segundo elemento clicável.
 * ---------------------------------------------------------------------------
 */
export function Cartao({
  post,
  agoraISO,
  destaque = false,
  aoAbrir,
  aoCurtir,
  curtindo,
}: {
  post: PostDoFeed;
  agoraISO: string;
  /** Cartão dos Destaques: imagem maior e título em duas linhas de corpo. */
  destaque?: boolean;
  aoAbrir: () => void;
  aoCurtir: () => void;
  curtindo: boolean;
}) {
  const Icone = ICONE_DA_CATEGORIA[post.categoria];
  const dominio = dominioDoLink(post.url);
  // ACIMA DE UMA SEMANA `tempoRelativo` devolve null, e o cartao CAI NA DATA
  // SECA em vez de ficar sem nada. A primeira versao da grade escrevia
  // `quando ? ... : ""`, e o post de vinte dias aparecia so com o nome do
  // autor -- a imagem do prototipo mostrou "Ana" sozinha no rodape. O painel
  // lateral ja fazia o fallback; sem ele aqui, a grade dizia menos que o
  // detalhe sobre o mesmo post.
  const relativo = tempoRelativo(post.created_at, agoraISO);
  const quando =
    relativo ?? format(parseISO(post.created_at), "dd/MM/yyyy", { locale: ptBR });

  return (
    <article
      className={cn(
        "group bg-surface-card relative flex flex-col overflow-hidden rounded-xl border transition-colors",
        "hover:border-accent-strong focus-within:border-accent-strong",
      )}
    >
      {/* A CAPA, e ela nunca falta. Sem imagem, a cor da categoria com o
          ícone dela — uma moldura cinza dizendo "imagem quebrada" seria a
          tela culpando quem postou por não ter achado uma foto. */}
      <div
        className={cn(
          "relative w-full overflow-hidden",
          destaque ? "aspect-[16/10]" : "aspect-video",
        )}
      >
        {post.imagem_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imagem_url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "flex size-full items-center justify-center",
              COR_DA_CATEGORIA[post.categoria],
            )}
          >
            <Icone aria-hidden className={destaque ? "size-10" : "size-8"} />
          </div>
        )}

        {/* O CHIP SOBRE A IMAGEM, no canto de baixo: acima dela ele empurraria
            o título, e ao lado do título roubaria a largura de duas linhas de
            texto — que é o que o cartão tem. */}
        <span
          className={cn(
            "absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-xs font-medium",
            COR_DA_CATEGORIA[post.categoria],
          )}
        >
          {ROTULOS_DE_CATEGORIA[post.categoria]}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3
          className={cn(
            "font-medium",
            destaque ? "line-clamp-2 text-base" : "line-clamp-2 text-sm",
          )}
        >
          <button
            type="button"
            onClick={aoAbrir}
            // A CAMADA QUE ESTENDE O ALVO. `after:` cobre o cartão inteiro, e
            // o `z-0` a mantém ABAIXO do rodapé — senão ela engoliria o
            // coração, que é o único outro alvo daqui.
            className="text-left after:absolute after:inset-0 after:z-0 after:content-['']"
          >
            {post.titulo}
          </button>
        </h3>

        {post.descricao ? (
          <p className="text-text-muted line-clamp-3 text-sm">{post.descricao}</p>
        ) : null}

        {dominio ? (
          <p className="text-text-muted flex items-center gap-1.5 text-xs">
            {/* O FAVICON VEM DO SERVIÇO DO GOOGLE, e não de uma busca nossa no
                site: buscar `/favicon.ico` em cada domínio seria a mesma porta
                que `lib/link-preview.ts` fecha, e aqui quem busca é o
                navegador de quem está olhando, não o servidor da agência.
                Falhou, some — `onError` esconde. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${dominio}&sz=32`}
              alt=""
              width={14}
              height={14}
              className="size-3.5 shrink-0 rounded-[3px]"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="truncate">{dominio}</span>
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex min-w-0 items-center gap-2">
            {post.autor ? (
              <UserAvatar
                name={post.autor.nome}
                src={post.autor.avatar_url}
                size="sm"
              />
            ) : null}
            <span className="text-text-muted min-w-0 truncate text-xs">
              {post.autor?.nome.split(" ")[0] ?? "Alguém"} · {quando}
            </span>
          </div>

          {/* O RODAPÉ FICA ACIMA DA CAMADA (`z-10`), e é o que faz o coração
              receber o próprio clique. */}
          <div className="relative z-10 flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                aoCurtir();
              }}
              disabled={curtindo}
              aria-pressed={post.euCurti}
              aria-label={post.euCurti ? "Descurtir" : "Curtir"}
              className={cn(
                "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors",
                post.euCurti
                  ? "text-danger"
                  : "text-text-muted hover:text-danger",
              )}
            >
              <Heart
                aria-hidden
                className={cn("size-4", post.euCurti && "fill-current")}
              />
              {post.quantasCurtidas > 0 ? post.quantasCurtidas : null}
            </button>

            {/* O COMENTÁRIO É UM NÚMERO, não um botão: ele leva ao mesmo lugar
                que o cartão inteiro já leva, e dois alvos para o mesmo destino
                é o que faz alguém errar o coração. */}
            <span className="text-text-muted flex items-center gap-1 px-1.5 text-xs">
              <MessageCircle aria-hidden className="size-4" />
              {post.comentarios.length > 0 ? post.comentarios.length : null}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
