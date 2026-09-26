import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor, ehSocio } from "@/lib/auth/roles";
import { ultimosAcessos, visitasAoPortal } from "@/lib/dados/acessos";
import {
  identidadeDoPortal,
  obterCliente,
  usuariosDoCliente,
  vinculosDoCliente,
} from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";

import { DetalheDoCliente } from "./detalhe";
import { IdentidadeDoPortal } from "./identidade-do-portal";
import { VisitasAoPortal } from "./visitas-ao-portal";

export const metadata: Metadata = { title: "Cliente" };

export default async function PaginaDoCliente({ params }: PageProps<"/painel/pessoas/clientes/[id]">) {
  const sessao = await exigirAcessoARota("/painel/pessoas");
  const { id } = await params;

  const cliente = await obterCliente(id);
  if (!cliente) notFound();

  const [usuarios, equipe, vinculos, identidade] = await Promise.all([
    usuariosDoCliente(id),
    listarEquipeAtiva(),
    vinculosDoCliente(id),
    identidadeDoPortal(id),
  ]);

  const acessos = await ultimosAcessos(usuarios.map((u) => u.id));
  // A CONSULTA SÓ ACONTECE PARA A GESTÃO. Chamá-la sempre e esconder o bloco
  // depois gastaria duas idas ao banco para desenhar nada — e a lista voltaria
  // vazia pelo RLS de qualquer forma.
  const ehDaGestao = ehGestor(sessao.profile.role);
  const visitas = ehDaGestao ? await visitasAoPortal(id) : [];
  const responsavel = cliente.responsavel_atendimento_id
    ? (equipe.find((p) => p.id === cliente.responsavel_atendimento_id)?.nome ?? null)
    : null;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/painel/pessoas?aba=clientes">
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

      {/* A IDENTIDADE DO PORTAL FICA NO TOPO, antes dos campos: ela é o que o
          cliente vê, e os campos são o que a agência anota. Entre as
          observações e a zona de perigo ela pareceria mais um campo. */}
      <IdentidadeDoPortal
        clienteId={cliente.id}
        nome={cliente.nome_empresa}
        capaAssinada={identidade?.capaAssinada ?? null}
        fotoAssinada={identidade?.fotoAssinada ?? null}
        temCapa={!!cliente.capa_url}
        temFoto={!!cliente.logo_url}
      />

      {ehDaGestao ? <VisitasAoPortal visitas={visitas} /> : null}

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
