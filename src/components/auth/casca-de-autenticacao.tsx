"use client";

import { createContext, useContext, useState } from "react";
import Image from "next/image";

import { SimboloDaMarca } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

/**
 * A casca das telas de autenticação: painel da marca à esquerda, formulário à
 * direita.
 *
 * **A coluna escura existe para o wordmark.** Ele é um lockup de três linhas
 * que se encaixam, com o próprio símbolo dentro: abaixo de uns 24px de altura
 * as linhas fecham e ele vira um borrão, e no eixo central ele disputava
 * espaço com o nome do produto. Aqui há largura para mostrá-lo no tamanho em
 * que se lê, e é a única tela do produto onde ele aparece.
 *
 * O painel é `--brand-navy` nos DOIS temas, como a barra lateral do painel, e
 * por isso o símbolo vai na versão azul (`sobreEscuro`) e o wordmark na versão
 * branca — sem troca por tema, porque o fundo não troca.
 *
 * Em 375px a coluna vira uma faixa curta no topo: o formulário é o que a
 * pessoa veio fazer, e metade de uma tela de celular gasta com marca é meia
 * tela a menos para digitar.
 */

type Publico = "colaborador" | "cliente";

const ContextoDoPublico = createContext<{
  publico: Publico;
  escolher: (p: Publico) => void;
} | null>(null);

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
 * **O que ele faz de verdade é trocar a frase do painel**, e é por isso que
 * não é enfeite: quem chega vê, antes de digitar, o que aquela porta abre para
 * ele. E a linha embaixo diz o resto em voz alta — sem ela, quem clicasse em
 * "Colaborador" e caísse no portal concluiria que o sistema errou.
 *
 * Mora aqui, ao lado do painel que ele muda, e não na tela de login: são as
 * duas metades da mesma decisão, e separadas divergiriam na primeira mudança
 * de texto.
 */
export function SeletorDePublico({ className }: { className?: string }) {
  const contexto = useContext(ContextoDoPublico);
  if (!contexto) return null;

  const { publico, escolher } = contexto;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="group"
        aria-label="Quem está entrando"
        className="bg-muted flex gap-1 rounded-xl p-1"
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
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              publico === valor
                ? "bg-brand-blue text-brand-foreground"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <p className="text-text-muted text-xs leading-relaxed">
        Os dois entram pelo mesmo formulário — o Full Hub reconhece você pelo
        e-mail e abre a área certa.
      </p>
    </div>
  );
}

const FRASES: Record<Publico, string> = {
  colaborador:
    "Suas tasks, os prazos da semana e o que está esperando aprovação, na mesma tela.",
  cliente:
    "O que a Full está produzindo para você, o que já foi aprovado e o que espera a sua decisão.",
};

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
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <aside className="bg-brand-navy flex shrink-0 flex-col justify-between gap-10 px-6 py-8 lg:w-[44%] lg:max-w-md lg:px-12 lg:py-14">
          <div className="space-y-6 lg:space-y-9">
            <SimboloDaMarca sobreEscuro className="size-12 lg:size-20" />

            <div className="space-y-3">
              <p className="text-text-on-dark text-2xl font-semibold tracking-tight lg:text-4xl">
                Full Hub
              </p>
              <p className="text-text-on-dark-muted max-w-sm text-sm leading-relaxed">
                {FRASES[publico]}
              </p>
            </div>
          </div>

          {/* 833 × 454 é a caixa do arquivo. A versão branca veio cortada 26px
              embaixo na primeira entrega — o "y" e o triângulo ficavam pela
              metade —, e foi trocada pela que tem a mesma proporção da
              colorida. Proporção conferida, não estimada. */}
          <Image
            src="/marca/full-connect-key-branco.png"
            alt="Full Connect Key"
            width={168}
            height={92}
            className="hidden h-auto w-[168px] lg:block"
            priority
          />
        </aside>

        <main className="flex flex-1 items-center justify-center px-6 py-10 lg:px-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
    </ContextoDoPublico.Provider>
  );
}
