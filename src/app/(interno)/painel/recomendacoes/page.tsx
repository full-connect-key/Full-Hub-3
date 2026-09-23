import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { emAltaNoMes, listarFeed, tagsDoFeed } from "@/lib/dados/recomendacoes";
import { lerCategoria, lerOrdem, nuvemDeTags } from "@/lib/dominio/recomendacoes";

import { Feed } from "./feed";

export const metadata: Metadata = { title: "Recomendações" };

/**
 * O feed de recomendações.
 *
 * É o módulo mais leve do sistema, e o desenho respeita isso: não há
 * aprovação, não há categoria obrigatória além de uma escolha, não há fila.
 * Alguém posta, os outros curtem e comentam.
 *
 * Os filtros moram na URL como em toda listagem: "olha o que indicaram de
 * ferramenta" precisa ser um link.
 */
export default async function PaginaDeRecomendacoes({
  searchParams,
}: PageProps<"/painel/recomendacoes">) {
  const sessao = await exigirAcessoARota("/painel/recomendacoes");
  const parametros = await searchParams;

  const categoria = lerCategoria(parametros.categoria);
  const ordem = lerOrdem(parametros.ordem);
  const tag = typeof parametros.tag === "string" ? parametros.tag : null;
  const busca = typeof parametros.busca === "string" ? parametros.busca.trim() : null;

  // O AGORA VEM DAQUI e desce pronto. Se cada cartão lesse o relógio, o
  // servidor renderizaria "há 2 horas" e o navegador, noutro fuso,
  // recalcularia outra coisa na hidratação.
  const agoraISO = new Date().toISOString();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recomendações"
        description="O que a equipe anda indicando: filme, curso, ferramenta, referência. Poste o que valeu o seu tempo."
      />

      <Suspense
        key={`${categoria ?? ""}-${ordem}-${tag ?? ""}-${busca ?? ""}`}
        fallback={<LoadingSkeleton variant="card" rows={4} />}
      >
        <Conteudo
          usuarioId={sessao.usuarioId}
          gestor={ehGestor(sessao.profile.role)}
          agoraISO={agoraISO}
          filtros={{ categoria, tag, busca, ordem }}
        />
      </Suspense>
    </div>
  );
}

async function Conteudo({
  usuarioId,
  gestor,
  agoraISO,
  filtros,
}: {
  usuarioId: string;
  gestor: boolean;
  agoraISO: string;
  filtros: Parameters<typeof listarFeed>[1];
}) {
  const [posts, alta, todasAsTags] = await Promise.all([
    listarFeed(usuarioId, filtros),
    emAltaNoMes(agoraISO),
    tagsDoFeed(),
  ]);

  return (
    <Feed
      posts={posts}
      emAlta={alta}
      // A nuvem conta em `lib/dominio/`, que é onde os dois lados leem a mesma
      // conta — a camada de dados só traz a coluna.
      nuvem={nuvemDeTags(todasAsTags)}
      usuarioId={usuarioId}
      gestor={gestor}
      agoraISO={agoraISO}
      filtros={filtros}
    />
  );
}
