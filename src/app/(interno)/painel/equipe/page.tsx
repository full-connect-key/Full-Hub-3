import type { Metadata } from "next";
import { UserPlus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarEquipe } from "@/lib/dados/equipe";

import { FormularioDeColaborador } from "./formulario-de-colaborador";
import { ListaDaEquipe } from "./lista";

export const metadata: Metadata = { title: "Equipe e Skills" };

export default async function PaginaDaEquipe() {
  const sessao = await exigirAcessoARota("/painel/equipe");
  const equipe = await listarEquipe();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe e Skills"
        description="Quem é da casa, o que cada um faz e o que alcança na plataforma."
        actions={
          <FormularioDeColaborador
            roleDeQuemCria={sessao.profile.role}
            trigger={
              <Button>
                <UserPlus aria-hidden />
                Adicionar colaborador
              </Button>
            }
          />
        }
      />
      <ListaDaEquipe equipe={equipe} />
    </div>
  );
}
