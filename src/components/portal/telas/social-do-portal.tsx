import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarX } from "lucide-react";

import { CalendarioDePosts } from "@/components/portal/calendario-de-posts";
import { CartaoDePost } from "@/components/portal/cartao-de-post";
import { FiltrosDePosts } from "@/components/portal/filtros-de-post";
import { NavegacaoDoMes } from "@/components/portal/navegacao-do-mes";
import { EmptyState } from "@/components/shared/empty-state";
import {
  STATUS_DE_CONTEUDO,
  rotuloDoStatus,
} from "@/components/shared/status-badge";
import { postsDoMes, urlsDasArtes } from "@/lib/dados/posts";
import { prazosDoPortal } from "@/lib/dados/portal";
import {
  combinaComFiltroDePost,
  esperaDecisao,
  mesDe,
  PLATAFORMAS,
  porDia,
  type FiltrosDePost,
} from "@/lib/dominio/posts";
import { corDoPontoDeStatus } from "@/components/shared/status-badge";
import type {
  ContentStatus,
  PlataformaSocial,
} from "@/lib/supabase/database.types";

/**
 * O calendário de social, num bloco só.
 *
 * Serve as duas entradas, como as outras telas do Portal: o portal do
 * cliente (`/portal/social-media`) e a visualização da equipe
 * (`/portal/{slug}/social-media`). O que muda é o parâmetro — `clienteId`,
 * obrigatório para quem é da equipe porque o RLS a deixa ver todas as
 * empresas — e o prefixo dos links.
 */

/** Lê os filtros da URL, recusando o que não existe no enum. */
export function lerFiltrosDePost(
  params: Record<string, string | string[] | undefined>,
): FiltrosDePost {
  const texto = (chave: string) =>
    typeof params[chave] === "string" ? params[chave] : "";

  const plataforma = texto("plataforma");
  const status = texto("status");

  return {
    plataforma: (PLATAFORMAS as string[]).includes(plataforma)
      ? (plataforma as PlataformaSocial)
      : null,
    status: (STATUS_DE_CONTEUDO as string[]).includes(status)
      ? (status as ContentStatus)
      : null,
  };
}

export async function SocialDoPortal({
  base,
  clienteId,
  comoEquipe,
  mes,
  visao,
  dia,
  filtros,
}: {
  base: string;
  clienteId: string | null;
  comoEquipe: boolean;
  mes: string;
  visao: "calendario" | "lista";
  dia: string | null;
  filtros: FiltrosDePost;
}) {
  const { hoje } = prazosDoPortal();
  const todos = await postsDoMes(mes, clienteId ?? undefined);
  const posts = todos.filter((post) => combinaComFiltroDePost(post, filtros));

  const artes = await urlsDasArtes(posts.map((p) => p.thumbnailUrl));
  const aguardando = posts.filter(esperaDecisao).length;
  const doDia = dia ? (porDia(posts).get(dia) ?? []) : [];

  return (
    <div className="space-y-6">
      <NavegacaoDoMes
        mes={mes}
        mesDeHoje={mesDe(hoje)}
        visao={visao}
        base={base}
      />

      {/* O CONTADOR É A PRIMEIRA COISA, e é o único número da tela: o
          calendário responde "o que vai ao ar quando", e este responde "o que
          depende de mim". */}
      <p className="text-base">
        {aguardando === 0 ? (
          <span className="text-text-muted">
            {comoEquipe
              ? "Nenhum material deste mês aguarda a decisão do cliente."
              : "Nenhum material deste mês aguarda a sua aprovação."}
          </span>
        ) : (
          <>
            <strong className="tabular-nums">{aguardando}</strong>{" "}
            {aguardando === 1 ? "post aguarda" : "posts aguardam"}{" "}
            {comoEquipe ? "a decisão do cliente" : "a sua aprovação"} neste mês.
          </>
        )}
      </p>

      <FiltrosDePosts filtros={filtros} encontrados={posts.length} />

      {posts.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="Nenhum material neste mês"
          description={
            todos.length > 0
              ? "Nenhum material com esses filtros. Limpe os filtros para ver o resto."
              : comoEquipe
                ? "Este cliente ainda não recebeu material deste mês."
                : "Quando a Full enviar algo para este mês, ele aparece aqui."
          }
        />
      ) : visao === "lista" ? (
        <div className="space-y-3">
          {posts.map((post) => (
            <CartaoDePost
              key={post.id}
              post={post}
              arte={
                post.thumbnailUrl
                  ? (artes[post.thumbnailUrl] ?? post.thumbnailUrl)
                  : null
              }
              base={base}
            />
          ))}
        </div>
      ) : (
        <>
          <CalendarioDePosts
            mes={mes}
            posts={posts}
            artes={artes}
            base={base}
            hoje={hoje}
            diaAberto={dia}
          />

          {/* A LISTA DO DIA fica abaixo da grade, e não num diálogo: num
              diálogo ela cobriria o calendário, que é o contexto de quem
              acabou de clicar num dia. */}
          {dia ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold first-letter:uppercase">
                {format(parseISO(dia), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h2>

              {doDia.length === 0 ? (
                <p className="text-text-muted text-sm">
                  Nada publicado neste dia.
                </p>
              ) : (
                <div className="space-y-3">
                  {doDia.map((post) => (
                    <CartaoDePost
                      key={post.id}
                      post={post}
                      arte={
                        post.thumbnailUrl
                          ? (artes[post.thumbnailUrl] ?? post.thumbnailUrl)
                          : null
                      }
                      base={base}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <Legenda />
        </>
      )}
    </div>
  );
}

/**
 * A legenda fica FIXA abaixo do calendário, e não num tooltip.
 *
 * A faixa colorida da miniatura é o que se lê de longe, e uma cor sem legenda
 * é uma cor que cada pessoa interpreta do seu jeito — no celular não há para
 * onde apontar o mouse.
 *
 * **E ela AGRUPA os status que dividem a mesma cor, em vez de fingir que são
 * sete cores.** Os sete estados cabem em cinco tons medidos: "em produção" e
 * "aguardando aprovação" são o mesmo azul, "aguardando informações" e "stand
 * by" o mesmo cinza. Uma legenda com sete linhas e cinco cores manda a pessoa
 * comparar dois azuis idênticos e concluir que errou a leitura. O nome exato
 * de cada post está no cartão dele — no `title` e no rótulo acessível.
 */
function Legenda() {
  // Agrupa pelo que a tela realmente mostra: a classe de cor. A ordem dentro
  // de cada grupo é a de `STATUS_DE_CONTEUDO`, que é a ordem do fluxo.
  const grupos = new Map<string, ContentStatus[]>();
  for (const status of STATUS_DE_CONTEUDO) {
    const cor = corDoPontoDeStatus(status);
    const lista = grupos.get(cor);
    if (lista) lista.push(status);
    else grupos.set(cor, [status]);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
      {[...grupos.entries()].map(([cor, status]) => (
        <span
          key={cor}
          className="text-text-muted flex items-center gap-1.5 text-xs"
        >
          <span aria-hidden className={`size-2 rounded-full ${cor}`} />
          {status.map(rotuloDoStatus).join(" · ")}
        </span>
      ))}
    </div>
  );
}
