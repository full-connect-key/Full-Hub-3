"use client";

import { createContext, useContext, useState } from "react";

import { FundoDaPorta } from "@/components/auth/fundo-da-porta";
import { SimboloDaMarca } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

/**
 * A casca das quatro telas de (auth): login, esqueci-senha, redefinir-senha e
 * trocar-senha.
 *
 * **Fundo preto com a molécula azul atravessando, e um cartão de vidro no
 * centro.** Decisão do usuário, escolhida depois de quatro rodadas de proposta:
 * *"quero que centralize as informações, deixe o fundo preto, com um degradê
 * azul passando, como se fosse uma molécula se dividindo e se juntando (…)
 * apenas o logo da agência, sem escrever Full Hub, uma letra mais
 * contemporânea, tecnológica"*.
 *
 * **SÓ O SÍMBOLO, e o nome do produto não aparece escrito em lugar nenhum
 * daqui.** É o pedido dele, e muda uma coisa registrada: até aqui a porta era a
 * única tela do produto com o wordmark de três linhas da agência, e a coluna
 * escura existia justamente para dar a ele a largura em que as três linhas se
 * leem. Sem a coluna, ele não cabe — e a assinatura em caixa alta espaçada
 * também saiu, porque "apenas o logo" é apenas o logo. **O wordmark deixou de
 * aparecer no produto**, e isso é consequência aceita, não esquecimento: quem
 * quiser devolvê-lo precisa de uma tela com largura para ele.
 *
 * **O símbolo é a versão AZUL do arquivo da agência** — disco azul, ponto
 * branco, triângulo cinza. Não é variação nossa: é a segunda versão que a Full
 * entregou, e é a que existe para fundo escuro. Sobre preto, a de disco escuro
 * desapareceria.
 *
 * **O vidro tem fundo escuro próprio, não é só translúcido**, e o número foi
 * medido: com a molécula passando atrás, o fundo efetivo do cartão vai de quase
 * preto até o composto do vidro sobre o ponto mais claro dela. Quem garante o
 * contraste é o cartão — ninguém mede uma cor que anda. A conta inteira está no
 * comentário de `--vidro-fundo`, no `globals.css`.
 *
 * **Em 390px o cartão encolhe o respiro e nada mais.** Não há coluna para
 * esconder nem painel para dobrar: é a vantagem de centralizar, e é a razão
 * pela qual esta casca não tem um único `hidden lg:block`.
 */

type Publico = "colaborador" | "cliente";

const ContextoDoPublico = createContext<{
  publico: Publico;
  escolher: (p: Publico) => void;
} | null>(null);

const FRASES: Record<Publico, string> = {
  colaborador: "Use o e-mail que a Full cadastrou para você.",
  cliente: "O que a Full está produzindo para você espera do outro lado.",
};

/**
 * O seletor Cliente / Colaborador.
 *
 * **Ele NÃO decide o login, e é decisão do usuário que exista assim mesmo.**
 * Quem decide para onde a pessoa vai é o perfil gravado em `profiles`:
 * `rotaInicialDoRole()` manda `cliente` para /portal e o resto para /painel,
 * qualquer que tenha sido o botão clicado. Fazer o seletor valer de verdade
 * criaria um jeito novo de falhar na porta ("opção errada") e contaria a quem
 * estivesse tentando se um e-mail é de cliente ou da equipe.
 *
 * **O que ele faz de verdade é trocar a FRASE embaixo do título** — e essa é a
 * única coisa visível que ele muda, desde que a legenda saiu por decisão do
 * usuário. Era ela que explicava em voz alta por que o botão não decide o
 * destino; sem ela e sem a frase trocando, o seletor não mexeria em nada na
 * tela, e um botão que não muda nada é um botão que a pessoa clica duas vezes
 * achando que travou.
 *
 * Mora aqui, ao lado da frase que ele muda, e não na tela de login: são as duas
 * metades da mesma decisão, e separadas divergiriam na primeira mudança de
 * texto.
 */
export function SeletorDePublico({ className }: { className?: string }) {
  const contexto = useContext(ContextoDoPublico);
  if (!contexto) return null;

  const { publico, escolher } = contexto;

  return (
    <div
      role="group"
      aria-label="Quem está entrando"
      className={cn(
        "bg-auth-pill border-vidro-borda flex gap-1 rounded-full border p-1",
        className,
      )}
    >
      {(
        [
          ["cliente", "Cliente"],
          ["colaborador", "Colaborador"],
        ] as const
      ).map(([valor, rotulo]) => (
        <button
          key={valor}
          type="button"
          onClick={() => escolher(valor)}
          aria-pressed={publico === valor}
          className={cn(
            "flex-1 rounded-full px-3 py-[10px] text-[13.5px] font-medium transition-colors",
            publico === valor
              ? "bg-brand-blue text-brand-foreground"
              : "text-auth-apoio hover:text-auth-texto",
          )}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

/**
 * A frase que o seletor troca. Fora do login ela não existe — as outras três
 * telas não têm seletor, e uma frase que nunca muda não precisa de contexto.
 */
export function FraseDoPublico() {
  const contexto = useContext(ContextoDoPublico);
  return (
    <p className="text-auth-apoio mt-[11px] text-sm leading-relaxed">
      {FRASES[contexto?.publico ?? "colaborador"]}
    </p>
  );
}

export function CascaDeAutenticacao({
  children,
}: {
  children: React.ReactNode;
}) {
  // Colaborador abre a tela porque é quem entra todo dia; o cliente entra uma
  // vez por semana. A escolha não é lembrada de propósito: guardá-la no
  // navegador faria a tela abrir com a frase do outro público num computador
  // compartilhado, que é justamente onde o cliente costuma entrar.
  const [publico, escolher] = useState<Publico>("colaborador");

  return (
    <ContextoDoPublico.Provider value={{ publico, escolher }}>
      <div className="bg-auth-fundo relative flex min-h-dvh items-center justify-center px-4 py-7">
        <FundoDaPorta />

        <main className="relative w-full max-w-[452px]">
          <div className="bg-vidro border-vidro-borda vidro-da-porta flex flex-col gap-[22px] rounded-[22px] border px-6 pt-[34px] pb-[30px] text-center backdrop-blur-[32px] backdrop-saturate-150 sm:gap-[26px] sm:rounded-[26px] sm:px-[42px] sm:pt-[46px] sm:pb-[38px]">
            <SimboloDaMarca
              sobreEscuro
              className="simbolo-da-porta mx-auto size-13 sm:size-[62px]"
            />
            {children}
          </div>
        </main>
      </div>
    </ContextoDoPublico.Provider>
  );
}
