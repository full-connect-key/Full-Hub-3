import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehSocio } from "@/lib/auth/roles";
import { modeloDoTermo } from "@/lib/dados/comodatos";

import { EditorDoTermo } from "./editor";

export const metadata: Metadata = { title: "Modelo do termo de comodato" };

/**
 * O texto que a agência afirma por escrito para cada pessoa da equipe.
 *
 * **Só o sócio**, e a razão é a da fila de notas fiscais: quem responde por um
 * documento que a empresa assina é quem responde pela empresa. O
 * desenvolvedor é gestão para o resto do módulo — cadastra, empresta, devolve
 * — e aqui não. `asset_term_write` fecha em `is_socio()`, e esta guarda existe
 * além dela para o desenvolvedor não abrir a tela, editar e descobrir na
 * recusa que ela não era dele.
 */
export default async function Pagina() {
  const sessao = await exigirAcessoARota("/painel/comodatos");
  if (!ehSocio(sessao.profile.role)) forbidden();

  const corpo = await modeloDoTermo();

  return (
    <div className="space-y-6">
      <PageHeader title="Modelo do termo de comodato" />
      <p className="text-text-secondary max-w-2xl text-sm">
        Este é o texto que sai no termo de cada entrega. Mexer nele vale para as próximas: cada
        comodato guarda o texto do dia em que foi entregue.
      </p>
      <EditorDoTermo corpo={corpo} />
    </div>
  );
}
