import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { obterTrilha, skillsParaVincular } from "@/lib/dados/academy";

import { DetalheDaTrilha } from "./detalhe";

export const metadata: Metadata = { title: "Trilha" };

/**
 * O detalhe de uma trilha.
 *
 * `notFound()` quando a consulta volta vazia, e isso cobre DOIS casos de
 * propósito: a trilha não existe, ou a RLS recusou porque ela é rascunho e
 * quem pediu não é gestão. Dizer "existe, mas você não pode ver" entregaria
 * que a trilha existe — que é justamente o que o rascunho não pode contar.
 */
export default async function PaginaDaTrilha({ params }: PageProps<"/painel/academy/[id]">) {
  const sessao = await exigirAcessoARota("/painel/academy");
  const { id } = await params;

  const trilha = await obterTrilha(id, sessao.usuarioId);
  if (!trilha) notFound();

  const gestor = ehGestor(sessao.profile.role);
  const skills = gestor ? await skillsParaVincular() : [];

  return (
    <div className="space-y-6">
      <Link
        href="/painel/academy"
        className="text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Todas as trilhas
      </Link>

      <DetalheDaTrilha trilha={trilha} podeEditar={gestor} skills={skills} />
    </div>
  );
}
