import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { templatesDeCampanha } from "@/lib/dados/campanhas";
import { listarClientes } from "@/lib/dados/clientes";

import { FormularioDeCampanha } from "./formulario";

export const metadata: Metadata = { title: "Nova campanha" };

/**
 * A abertura de campanha, na versão mínima.
 *
 * A gestão completa — editar campanha existente, enviar entregável, subir
 * arquivo — é de outro momento. O que existe aqui é o suficiente para uma
 * campanha nascer com a árvore certa e chegar ao Portal.
 *
 * A guarda é de SERVIDOR, e não do menu: esconder o link não é segurança. E
 * ela é a primeira barreira, não a única — `campaigns_insert` exige
 * `is_staff()` no banco, e é essa que vale para quem chamar a API direto.
 */
export default async function PaginaDeNovaCampanha() {
  await exigirAcessoARota("/painel/aprovacoes");

  const [clientes, templates] = await Promise.all([
    listarClientes(),
    templatesDeCampanha(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Nova campanha" />
        <p className="text-text-muted mt-1">
          Escolha o cliente, o período e de que modelo a lista de entregáveis
          parte. Dá para ajustar a lista antes de salvar.
        </p>
      </div>

      <FormularioDeCampanha
        clientes={clientes
          .filter((c) => c.ativo)
          .map((c) => ({ id: c.id, nome: c.nome_empresa }))}
        templates={templates}
      />
    </div>
  );
}
