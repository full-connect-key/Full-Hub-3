import { GuardaDeInatividade } from "@/components/shared/guarda-de-inatividade";
import { exigirAreaDoCliente } from "@/lib/auth/portal-administrativo";

/**
 * Guarda da área do cliente.
 *
 * **Esta guarda chamava `exigirCliente()`, e isso era um bug de verdade.** Ela
 * envolve TUDO que está abaixo de /portal — inclusive /portal/{slug}, a
 * visualização administrativa, que existe para a gestão. Ou seja:
 * a tela existia, o layout dela tinha a guarda certa, e ninguém da agência
 * conseguia abri-la, porque o 403 acontecia aqui em cima, antes. Foi o que o
 * usuário encontrou ao tentar entrar no portal como sócio.
 *
 * Agora quem decide quem entra é `exigirAreaDoCliente()`: cliente e gestão
 * passam, colaborador recebe 403. A separação de verdade continua um nível
 * abaixo, onde ela pode ser específica — `(meu)/` para o cliente, `[slug]/`
 * para a gestão —, e é por isso que esta não pode ser a única.
 *
 * **O timeout de inatividade continua sendo só do cliente.** Ele acessa de
 * fora da agência, às vezes de um computador compartilhado; quem é da equipe
 * fica o dia inteiro no sistema e seria derrubado no meio do trabalho.
 */
export default async function LayoutDoCliente({ children }: LayoutProps<"/">) {
  const { comoEquipe } = await exigirAreaDoCliente();

  return (
    <>
      {comoEquipe ? null : <GuardaDeInatividade />}
      {children}
    </>
  );
}
