import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor, ehSocio } from "@/lib/auth/roles";
import { listarEquipeAtiva, obterColaborador, vinculosDoColaborador } from "@/lib/dados/equipe";
import { avaliacoesDaPessoa, skillsDaPessoa } from "@/lib/dados/skills";

import { DetalheDoColaborador } from "./detalhe";
import { SkillsDaPessoa } from "./skills-da-pessoa";

export const metadata: Metadata = { title: "Colaborador" };

export default async function PaginaDoColaborador({ params }: PageProps<"/painel/equipe/[id]">) {
  const sessao = await exigirAcessoARota("/painel/equipe");
  const { id } = await params;

  const pessoa = await obterColaborador(id);
  if (!pessoa || pessoa.role === "cliente") notFound();

  const [vinculos, equipe, skills, avaliacoes] = await Promise.all([
    vinculosDoColaborador(id),
    listarEquipeAtiva(),
    skillsDaPessoa(id),
    avaliacoesDaPessoa(id),
  ]);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/painel/equipe">
          <ArrowLeft aria-hidden />
          Equipe
        </Link>
      </Button>

      <div className="flex items-start gap-4">
        <UserAvatar name={pessoa.nome} src={pessoa.avatar_url} size="lg" />
        <PageHeader
          className="flex-1"
          title={pessoa.nome}
          actions={
            pessoa.ativo && pessoa.membro?.ativo !== false ? (
              <Badge variant="success">Ativo</Badge>
            ) : (
              <Badge variant="secondary">Desligado</Badge>
            )
          }
        />
      </div>

      <DetalheDoColaborador
        abaDeSkills={
          <SkillsDaPessoa
            pessoaId={pessoa.id}
            nome={pessoa.nome}
            skills={skills}
            avaliacoes={avaliacoes}
          />
        }
        pessoa={pessoa}
        ehSocio={ehSocio(sessao.profile.role)}
        ehGestor={ehGestor(sessao.profile.role)}
        ehVoceMesmo={sessao.usuarioId === pessoa.id}
        vinculos={vinculos}
        equipeDisponivel={equipe.filter((p) => p.id !== pessoa.id)}
      />
    </div>
  );
}
