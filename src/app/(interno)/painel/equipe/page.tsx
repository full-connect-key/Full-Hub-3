import type { Metadata } from "next";
import { UserPlus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarEquipe } from "@/lib/dados/equipe";

import { FormularioDeColaborador } from "./formulario-de-colaborador";
import { ListaDaEquipe } from "./lista";

export const metadata: Metadata = { title: "Equipe & Skills" };

export default async function PaginaDaEquipe() {
  const sessao = await exigirAcessoARota("/painel/equipe");
  // Traz também quem está desligado: a lista filtra por padrão para "ativos",
  // mas gestão precisa alcançar a ficha de quem saiu para reativar o acesso.
  const equipe = await listarEquipe(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe & Skills"
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
