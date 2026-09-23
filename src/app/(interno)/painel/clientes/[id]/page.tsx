import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehSocio } from "@/lib/auth/roles";
import { ultimosAcessos } from "@/lib/dados/acessos";
import { obterCliente, usuariosDoCliente, vinculosDoCliente } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";

import { DetalheDoCliente } from "./detalhe";

export const metadata: Metadata = { title: "Cliente" };

export default async function PaginaDoCliente({ params }: PageProps<"/painel/clientes/[id]">) {
  const sessao = await exigirAcessoARota("/painel/clientes");
  const { id } = await params;

  const cliente = await obterCliente(id);
  if (!cliente) notFound();

  const [usuarios, equipe, vinculos] = await Promise.all([
    usuariosDoCliente(id),
    listarEquipeAtiva(),
    vinculosDoCliente(id),
  ]);

  const acessos = await ultimosAcessos(usuarios.map((u) => u.id));
  const responsavel = cliente.responsavel_atendimento_id
    ? (equipe.find((p) => p.id === cliente.responsavel_atendimento_id)?.nome ?? null)
    : null;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/painel/clientes">
          <ArrowLeft aria-hidden />
          Clientes
        </Link>
      </Button>

      <PageHeader
        title={cliente.nome_empresa}
        actions={
          <Badge variant={cliente.ativo ? "success" : "secondary"}>
            {cliente.ativo ? "Ativo" : "Inativo"}
          </Badge>
        }
      />

      <DetalheDoCliente
        cliente={cliente}
        responsavel={responsavel}
        equipe={equipe}
        usuarios={usuarios.map((usuario) => ({
          ...usuario,
          ultimoAcesso: acessos[usuario.id] ?? null,
        }))}
        vinculos={vinculos}
        ehSocio={ehSocio(sessao.profile.role)}
      />
    </div>
  );
}
