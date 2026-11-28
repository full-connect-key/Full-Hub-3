import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { exigirEquipe } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { obterRelatorio } from "@/lib/dados/relatorios";

import { EditorDoRelatorio } from "./editor";

export const metadata: Metadata = { title: "Relatório" };

export default async function PaginaDoRelatorio({
  params,
}: PageProps<"/painel/relatorios/[id]">) {
  const { id } = await params;
  const [{ profile }, relatorio] = await Promise.all([
    exigirEquipe(),
    obterRelatorio(id),
  ]);
  if (!relatorio) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/painel/relatorios"
        className="text-text-muted inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Relatórios · {relatorio.cliente}
      </Link>
      <EditorDoRelatorio
        key={relatorio.id}
        relatorio={relatorio}
        podeApagar={ehGestor(profile.role)}
      />
    </div>
  );
}
