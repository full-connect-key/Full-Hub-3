import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";

import { FormularioDeCliente } from "./formulario-de-cliente";
import { ListaDeClientes } from "./lista";

export const metadata: Metadata = { title: "Clientes" };

export default async function PaginaDeClientes() {
  await exigirAcessoARota("/painel/clientes");

  const [clientes, equipe] = await Promise.all([listarClientes(), listarEquipeAtiva()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="As empresas atendidas, quem responde por cada uma e quem tem acesso ao portal."
        actions={
          <FormularioDeCliente
            equipe={equipe}
            trigger={
              <Button>
                <Plus aria-hidden />
                Novo cliente
              </Button>
            }
          />
        }
      />
      <ListaDeClientes clientes={clientes} equipe={equipe} />
    </div>
  );
}
