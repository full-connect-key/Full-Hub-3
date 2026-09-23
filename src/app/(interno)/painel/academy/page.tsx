import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { listarTrilhas } from "@/lib/dados/academy";

import { GradeDeTrilhas } from "./grade";
import { GestaoDaAcademy } from "./gestao";

export const metadata: Metadata = { title: "Full Academy" };

/**
 * A Full Academy.
 *
 * Todo perfil interno entra; o que muda é o que cada um faz. A equipe consome
 * e marca o próprio progresso; a gestão monta as trilhas e acompanha quem fez
 * as obrigatórias.
 *
 * A DIFERENÇA NÃO É "ESCONDER O BOTÃO": trilha em rascunho não volta do banco
 * para quem não é gestão, e a policy de escrita recusa quem não pode montar.
 * O que a tela faz é não oferecer o que seria recusado.
 */
export default async function PaginaDaAcademy({
  searchParams,
}: PageProps<"/painel/academy">) {
  const sessao = await exigirAcessoARota("/painel/academy");
  const parametros = await searchParams;

  const gestor = ehGestor(sessao.profile.role);
  const aba = parametros.aba === "gestao" && gestor ? "gestao" : "trilhas";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Full Academy"
        description="As trilhas de formação da agência. Marque o que já viu — o progresso é seu, e a anotação de cada material também."
      />

      {gestor ? <AbasDaAcademy atual={aba} /> : null}

      <Suspense key={aba} fallback={<LoadingSkeleton variant="card" rows={6} />}>
        {aba === "gestao" ? (
          <GestaoDaAcademy />
        ) : (
          <Conteudo usuarioId={sessao.usuarioId} />
        )}
      </Suspense>
    </div>
  );
}

async function Conteudo({ usuarioId }: { usuarioId: string }) {
  const trilhas = await listarTrilhas(usuarioId);

  // As áreas saem das trilhas que existem, e não de uma lista fixa: área aqui
  // é organização de conteúdo, e um enum obrigaria uma migration para criar
  // uma trilha de "Processos da casa".
  const areas = [
    ...new Set(trilhas.map((t) => t.area).filter((a): a is string => !!a)),
  ].sort();

  return <GradeDeTrilhas trilhas={trilhas} areas={areas} />;
}

function AbasDaAcademy({ atual }: { atual: "trilhas" | "gestao" }) {
  return (
    <nav aria-label="Seções da Academy" className="flex gap-1 border-b">
      <Aba href="/painel/academy" rotulo="Trilhas" ativa={atual === "trilhas"} />
      <Aba
        href="/painel/academy?aba=gestao"
        rotulo="Gestão e acompanhamento"
        ativa={atual === "gestao"}
      />
    </nav>
  );
}

function Aba({ href, rotulo, ativa }: { href: string; rotulo: string; ativa: boolean }) {
  return (
    <a
      href={href}
      aria-current={ativa ? "page" : undefined}
      className={
        ativa
          ? "border-accent-strong text-accent-strong -mb-px border-b-2 px-3 py-2 text-sm font-medium"
          : "text-text-secondary hover:text-text-primary -mb-px border-b-2 border-transparent px-3 py-2 text-sm"
      }
    >
      {rotulo}
    </a>
  );
}
