import { GuardaDeInatividade } from "@/components/shared/guarda-de-inatividade";
import { exigirCliente } from "@/lib/auth/dal";

/**
 * Guarda da área do cliente.
 *
 * Perfis internos que tentarem abrir /portal recebem 403. E a sessão cai
 * sozinha depois de 30 minutos parada: o cliente acessa de fora da agência, às
 * vezes de um computador compartilhado.
 */
export default async function LayoutDoCliente({ children }: LayoutProps<"/">) {
  await exigirCliente();

  return (
    <>
      <GuardaDeInatividade />
      {children}
    </>
  );
}
