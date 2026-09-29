import { CascaDeAutenticacao } from "@/components/auth/casca-de-autenticacao";

/**
 * A porta não tem mais letra própria.
 *
 * Ela teve: Sora, carregada só aqui por `next/font`, porque era uma SEGUNDA
 * família e uma letra a mais no produto inteiro seria peso em toda visita para
 * uma tela que se vê uma vez por dia. Com a Google Sans valendo no `layout` da
 * raiz, essa conta deixou de existir — a porta usa a letra do trabalho, e este
 * arquivo voltou a ser o que ele é: a casca das quatro telas de `(auth)`.
 *
 * O que NÃO mudou é tudo o que faz a porta ser a porta: o preto nos dois
 * temas, a molécula, o cartão de vidro a 82% e o lema que alterna. Trocar a
 * letra não troca a composição.
 */
export default function LayoutAutenticacao({ children }: LayoutProps<"/">) {
  return <CascaDeAutenticacao>{children}</CascaDeAutenticacao>;
}
