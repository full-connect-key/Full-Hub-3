import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";

import { DemonstracaoDeComponentes } from "./demonstracao";

export const metadata: Metadata = { title: "Componentes" };

/**
 * Vitrine dos componentes compartilhados.
 *
 * Existe para três coisas: conferir claro e escuro de uma vez só, servir de
 * referência de uso na hora de montar um módulo novo, e deixar óbvio quando
 * alguém muda um componente e quebra outro.
 *
 * Só gestão abre (veja permissions.ts): é página de desenvolvimento.
 */
export default async function PaginaDeComponentes() {
  await exigirAcessoARota("/painel/dev/componentes");

  return (
    <div className="space-y-10">
      <PageHeader
        title="Componentes compartilhados"
        description="Os blocos que todos os módulos reaproveitam. Alterar um destes muda o projeto inteiro."
      />
      <DemonstracaoDeComponentes />
    </div>
  );
}
