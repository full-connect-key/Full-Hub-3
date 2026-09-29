import { Sora } from "next/font/google";

import { CascaDeAutenticacao } from "@/components/auth/casca-de-autenticacao";

/**
 * A LETRA DA PORTA É OUTRA, e só vale aqui.
 *
 * Decisão do usuário: *"uma letra mais contemporânea, tecnológica"*. Sora é
 * geométrica e atual sem ser a escolha óbvia — e o painel continua em Geist,
 * que é a letra do trabalho.
 *
 * **`next/font` carrega por rota**, então quem está dentro do sistema nunca
 * baixa esta família: ela sai no HTML das quatro telas de (auth) e em mais
 * nenhum lugar. É o que torna a troca barata — uma letra a mais no produto
 * inteiro seria peso em toda visita, para uma tela que se vê uma vez por dia.
 *
 * O nome da variável é `--fonte-sora` e não `--font-sora`: `--font-porta` no
 * `@theme inline` do globals.css aponta para ela, e dois tokens com o mesmo
 * prefixo `--font-` seriam dois utilitários do Tailwind com o mesmo nome.
 */
const sora = Sora({
  subsets: ["latin"],
  variable: "--fonte-sora",
  display: "swap",
});

export default function LayoutAutenticacao({ children }: LayoutProps<"/">) {
  return (
    <div className={`${sora.variable} font-porta`}>
      <CascaDeAutenticacao>{children}</CascaDeAutenticacao>
    </div>
  );
}
