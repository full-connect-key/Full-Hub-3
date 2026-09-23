import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { avaliacoesDaPessoa, listarCatalogo, skillsDaPessoa } from "@/lib/dados/skills";

import { MinhasSkills } from "./minhas-skills";
import { Avaliacoes } from "./avaliacoes";

export const metadata: Metadata = { title: "Meu Desenvolvimento" };

async function Conteudo({ usuarioId }: { usuarioId: string }) {
  const [minhas, catalogo, avaliacoes] = await Promise.all([
    skillsDaPessoa(usuarioId),
    listarCatalogo(),
    avaliacoesDaPessoa(usuarioId),
  ]);

  const categorias = [
    ...new Set(catalogo.map((s) => s.categoria?.trim()).filter(Boolean) as string[]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <div className="space-y-8">
      <MinhasSkills minhas={minhas} catalogo={catalogo} categorias={categorias} />
      <Avaliacoes avaliacoes={avaliacoes} />
    </div>
  );
}

/**
 * Meu Desenvolvimento — era "Minhas Skills" até o Sprint 3C.
 *
 * O NÍVEL É AUTOAVALIAÇÃO, e é por isso que só a própria pessoa escreve aqui,
 * inclusive quando ela é sócia. Se a gestão pudesse mexer, o número passaria a
 * dizer duas coisas ao mesmo tempo — "o que eu acho que sei" e "o que acham de
 * mim" — e deixaria de servir para as duas. A opinião da gestão aparece
 * embaixo, separada e assinada.
 */
export default async function PaginaDoMeuDesenvolvimento() {
  const sessao = await exigirAcessoARota("/painel/meu-desenvolvimento");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meu Desenvolvimento"
      />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo usuarioId={sessao.usuarioId} />
      </Suspense>
    </div>
  );
}
