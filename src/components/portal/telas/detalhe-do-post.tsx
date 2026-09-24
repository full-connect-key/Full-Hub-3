import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { DecisoesDoPost } from "@/components/portal/decisoes-do-post";
import { HistoricoDeVersoes } from "@/components/portal/historico-de-versoes";
import { LegendaDoPost } from "@/components/portal/legenda-do-post";
import { SeloDaRede } from "@/components/portal/selo-da-rede";
import { ThreadDeComentarios } from "@/components/portal/thread-de-comentarios";
import { VisualizadorDeArte } from "@/components/portal/visualizador-de-arte";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  comentariosDoPost,
  enderecoDaArte,
  obterPost,
  postsDoMes,
  urlsDasArtes,
  versoesDoPost,
} from "@/lib/dados/posts";
import {
  mesDe,
  ROTULO_DA_PLATAFORMA,
  type PostDoPortal,
} from "@/lib/dominio/posts";

/**
 * O material, do jeito que se decide sobre ele.
 *
 * A ordem da tela é a ordem da decisão: a arte primeiro e grande, as
 * informações que a contextualizam, a legenda, e só então os botões. Pôr os
 * botões antes da arte convida a aprovar sem olhar — e o material que volta
 * "aprovado sem ninguém ter visto" é o que gera o retrabalho mais caro.
 *
 * Um bloco para as duas entradas, como o resto do Portal. `somenteLeitura`
 * desliga os botões na visualização da equipe; a recusa de verdade continua
 * sendo `decidir_rodada_do_cliente`, que recusa quem não é o cliente daquela
 * rodada.
 */
export async function DetalheDoPost({
  postId,
  base,
  clienteId,
  comoEquipe,
  nomeDaEmpresa,
  agora,
}: {
  postId: string;
  base: string;
  clienteId: string | null;
  comoEquipe: boolean;
  nomeDaEmpresa: string;
  agora: string;
}) {
  const post = await obterPost(postId, clienteId ?? undefined);

  // 404 E NÃO 403, e é deliberado: para quem não pode ver, o post não existe.
  // Um 403 confirmaria que existe um material com aquele id — que é
  // exatamente o que alguém varrendo uuids quer saber.
  if (!post) notFound();

  const [versoes, comentarios, vizinhos] = await Promise.all([
    versoesDoPost(post.id),
    comentariosDoPost(post.id),
    postsDoMes(mesDe(post.dataPublicacao), clienteId ?? undefined),
  ]);

  const artes = await urlsDasArtes([
    post.arteUrl,
    ...versoes.map((v) => v.arteUrl),
  ]);

  const arte = enderecoDaArte(post.arteUrl, artes);
  const { anterior, proximo } = vizinhosDe(post, vizinhos);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------- cabeçalho -- */}
      <div className="space-y-4">
        <Link
          href={`${base}/social-media?mes=${mesDe(post.dataPublicacao)}`}
          className="text-text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Voltar ao calendário
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SeloDaRede plataforma={post.plataforma} />
              <StatusBadge status={post.status} />
            </div>
            <h1 className="text-2xl font-semibold">{post.tema}</h1>
            <p className="text-text-muted text-sm tabular-nums">
              {format(parseISO(post.dataPublicacao), "d 'de' MMMM 'de' yyyy", {
                locale: ptBR,
              })}
              {post.horario ? ` · ${post.horario}` : ""}
            </p>
          </div>

          {/* NAVEGAÇÃO ENTRE POSTS DO MÊS: quem entra para aprovar raramente
              aprova um só. Voltar ao calendário a cada peça é o atrito que faz
              a pessoa deixar os outros para depois. */}
          <nav aria-label="Outros materiais do mês" className="flex gap-2">
            <VizinhoLink
              href={anterior ? `${base}/social-media/${anterior.id}` : null}
              rotulo="Material anterior"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </VizinhoLink>
            <VizinhoLink
              href={proximo ? `${base}/social-media/${proximo.id}` : null}
              rotulo="Próximo material"
            >
              <ChevronRight aria-hidden className="size-4" />
            </VizinhoLink>
          </nav>
        </div>
      </div>

      {/* ------------------------------------------------------------ arte -- */}
      <VisualizadorDeArte
        imagens={arte ? [arte] : []}
        alt={`Arte de ${post.tema}`}
      />

      {/* --------------------------------------------------- informações -- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Informações</h2>
        <dl className="bg-surface-card grid gap-x-8 gap-y-3 rounded-xl border p-4 sm:grid-cols-2">
          <Linha rotulo="Tema" valor={post.tema} />
          <Linha
            rotulo="Plataforma"
            valor={ROTULO_DA_PLATAFORMA[post.plataforma]}
          />
          <Linha rotulo="Formato" valor={post.formato ?? "—"} />
          <Linha rotulo="Horário" valor={post.horario ?? "A definir"} />
          <Linha rotulo="Versão" valor={String(post.versaoAtual)} />
          <Linha
            rotulo="Prazo para decidir"
            valor={
              post.prazoAprovacao
                ? format(parseISO(post.prazoAprovacao), "dd/MM/yyyy", {
                    locale: ptBR,
                  })
                : "Sem prazo definido"
            }
          />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Legenda</h2>
        <LegendaDoPost legenda={post.legenda} />
      </section>

      {/* ---------------------------------------------------------- ações -- */}
      <section className="space-y-4">
        <DecisoesDoPost post={post} somenteLeitura={comoEquipe} />
        <HistoricoDeVersoes
          versoes={versoes}
          artes={artes}
          versaoAtual={post.versaoAtual}
        />
      </section>

      <ThreadDeComentarios
        postId={post.id}
        comentarios={comentarios}
        agora={agora}
        nomeDaEmpresa={nomeDaEmpresa}
        somenteLeitura={comoEquipe}
      />
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <dt className="text-text-muted text-sm">{rotulo}</dt>
      <dd className="min-w-0 text-sm font-medium">{valor}</dd>
    </div>
  );
}

function VizinhoLink({
  href,
  rotulo,
  children,
}: {
  href: string | null;
  rotulo: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span
        aria-hidden
        className="text-text-muted inline-flex size-9 items-center justify-center rounded-md border opacity-40"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={rotulo}
      className="hover:bg-accent inline-flex size-9 items-center justify-center rounded-md border transition-colors"
    >
      {children}
    </Link>
  );
}

/**
 * O anterior e o próximo, na ordem do calendário.
 *
 * A ordem é a mesma da tela de onde a pessoa veio — data e depois horário —,
 * porque uma segunda ordem aqui faria "próximo" apontar para um post que não
 * era o de baixo na lista.
 */
function vizinhosDe(post: PostDoPortal, doMes: PostDoPortal[]) {
  const ordenados = [...doMes].sort((a, b) => {
    const porData = a.dataPublicacao.localeCompare(b.dataPublicacao);
    if (porData !== 0) return porData;
    return (a.horario ?? "99:99").localeCompare(b.horario ?? "99:99");
  });

  const indice = ordenados.findIndex((p) => p.id === post.id);
  return {
    anterior: indice > 0 ? ordenados[indice - 1] : null,
    proximo:
      indice >= 0 && indice < ordenados.length - 1
        ? ordenados[indice + 1]
        : null,
  };
}
