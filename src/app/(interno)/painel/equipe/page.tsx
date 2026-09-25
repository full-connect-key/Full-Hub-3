import type { Metadata } from "next";
import { UserPlus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarEquipe } from "@/lib/dados/equipe";

import { FormularioDeColaborador } from "./formulario-de-colaborador";
import { ListaDaEquipe } from "./lista";

/**
 * A tela é UMA LISTA, e não mais duas abas.
 *
 * A segunda era Skills, e o módulo saiu do produto na 0043 (decisão do
 * usuário). As abas saíram junto: uma barra de navegação com um item é moldura
 * sem função — a mesma razão pela qual as abas do Full Days somem para quem só
 * propõe o próprio período.
 */
export const metadata: Metadata = { title: "Equipe" };

export default async function PaginaDaEquipe() {
  const sessao = await exigirAcessoARota("/painel/equipe");
  // Traz também quem está desligado: a lista filtra por padrão para "ativos",
  // mas gestão precisa alcançar a ficha de quem saiu para reativar o acesso.
  const equipe = await listarEquipe(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe"
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
