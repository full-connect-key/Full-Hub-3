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
  // OS DESTAQUES SAEM DE UMA SEGUNDA LEITURA, sem filtro nenhum: eles
  // respondem "o que a equipe achou bom este mês", e uma fatia da lista
  // filtrada responderia "o que a equipe achou bom entre as ferramentas que
  // você está olhando agora" — que é outra pergunta.
  //
  // São duas idas ao banco para uma tela, e é aceito: o feed de uma agência
  // de dez pessoas não tem volume que justifique uma view materializada. Com
  // a tabela grande, o caminho é uma coluna `quantas_curtidas` por trigger — e
  // aí a conta muda de lugar, não de dono.
  const [posts, alta, tudo, todasAsTags] = await Promise.all([
    listarFeed(usuarioId, filtros),
    emAltaNoMes(agoraISO, 3),
    listarFeed(usuarioId, {
      categoria: null,
      tag: null,
      busca: null,
      ordem: "curtidas",
    }),
    tagsDoFeed(),
  ]);

  // O CARTÃO DOS DESTAQUES É O MESMO DA GRADE, então eles precisam ser posts
  // inteiros. `emAltaNoMes` decide QUAIS (ela é quem sabe a janela de 30 dias
  // e a contagem); esta linha só vai buscar o resto de cada um.
  const destaques = alta
    .map(({ id }) => tudo.find((p) => p.id === id))
    .filter((p): p is (typeof tudo)[number] => Boolean(p));

  return (
    <Feed
      posts={posts}
      destaques={destaques}
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
