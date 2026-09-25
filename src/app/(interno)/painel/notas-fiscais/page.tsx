import type { Metadata } from "next";

import { PlaceholderDeModulo } from "@/components/shared/placeholder-de-modulo";

export const metadata: Metadata = { title: "Notas Fiscais" };

/**
 * A nota fiscal DA PESSOA.
 *
 * Não confundir com o Financeiro da agência (/painel/financeiro, só sócio):
 * aqui cada um envia a sua nota e acompanha o próprio pagamento. São módulos
 * diferentes porque são assuntos diferentes, e no menu antigo os dois viviam
 * juntos em "Financeiro e NFs", o que fazia o colaborador achar que não tinha
 * onde mandar a nota dele.
 */
export default function Pagina() {
  return (
    <PlaceholderDeModulo
      href="/painel/notas-fiscais"
      frase="Em breve você poderá enviar sua nota fiscal do mês e acompanhar o pagamento por aqui."
    />
  );
}
