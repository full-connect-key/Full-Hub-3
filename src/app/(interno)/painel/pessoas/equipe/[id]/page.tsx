import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor, ehSocio } from "@/lib/auth/roles";
import { listarEquipeAtiva, obterColaborador, vinculosDoColaborador } from "@/lib/dados/equipe";

import { DetalheDoColaborador } from "./detalhe";
import { Voltar } from "@/components/shared/voltar";

export const metadata: Metadata = { title: "Colaborador" };

export default async function PaginaDoColaborador({ params }: PageProps<"/painel/pessoas/equipe/[id]">) {
  const sessao = await exigirAcessoARota("/painel/pessoas");
  const { id } = await params;

  const pessoa = await obterColaborador(id);
  if (!pessoa || pessoa.role === "cliente") notFound();

  const [vinculos, equipe] = await Promise.all([
    vinculosDoColaborador(id),
    listarEquipeAtiva(),
  ]);

  return (
    <div className="space-y-6">
      <Voltar para="/painel/pessoas?aba=equipe" rotulo="Equipe" />

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
