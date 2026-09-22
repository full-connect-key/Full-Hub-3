import { Cabecalho } from "@/components/shared/cabecalho";
import { exigirEquipe } from "@/lib/auth/dal";

/**
 * Area interna da agencia.
 *
 * exigirEquipe() roda no servidor, antes de qualquer HTML sair daqui: um
 * cliente que digitar /painel na barra de enderecos recebe HTTP 403 e nunca
 * ve o conteudo. Esconder o link no menu nao seria protecao nenhuma.
 */
export default async function LayoutInterno({ children }: LayoutProps<"/">) {
  const { email, profile } = await exigirEquipe();

  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho nome={profile.nome} email={email} role={profile.role} area="Painel" />
      <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
