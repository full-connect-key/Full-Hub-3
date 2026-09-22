import { Cabecalho } from "@/components/shared/cabecalho";
import { GuardaDeInatividade } from "@/components/shared/guarda-de-inatividade";
import { exigirCliente } from "@/lib/auth/dal";

/**
 * Portal do Cliente.
 *
 * Duas diferencas em relacao a area interna:
 *   - exigirCliente() devolve 403 para perfis internos que tentarem entrar;
 *   - a sessao cai sozinha depois de 30 minutos parada, porque o cliente
 *     acessa de fora da agencia, as vezes de um computador compartilhado.
 */
export default async function LayoutDoCliente({ children }: LayoutProps<"/">) {
  const { email, profile } = await exigirCliente();

  return (
    <div className="flex min-h-dvh flex-col">
      <GuardaDeInatividade />
      <Cabecalho nome={profile.nome} email={email} role={profile.role} area="Portal" />
      <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
