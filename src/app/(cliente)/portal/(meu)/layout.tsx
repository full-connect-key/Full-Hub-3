import { CascaDoPortal } from "@/components/portal/casca-do-portal";
import { exigirCliente } from "@/lib/auth/dal";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";

/**
 * O portal da pessoa cliente.
 *
 * `exigirCliente()` devolve 403 para quem é da equipe — inclusive sócio. Quem
 * é da agência e quer ver o portal de um cliente entra por /portal/{slug}, que
 * é outra rota, com outra guarda, e que deixa rastro.
 */
export default async function LayoutDoMeuPortal({ children }: LayoutProps<"/portal">) {
  const { email, profile } = await exigirCliente();
  const empresas = await obterMinhasEmpresas();
  const nomeDaEmpresa = empresas.map((empresa) => empresa.nome_empresa).join(", ");

  return (
    <CascaDoPortal nome={profile.nome} email={email} nomeDaEmpresa={nomeDaEmpresa || null}>
      {children}
    </CascaDoPortal>
  );
}
