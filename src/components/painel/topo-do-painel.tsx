"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A faixa do topo do painel: a busca, o sino e o avatar.
 *
 * ELA É TRANSPARENTE EM REPOUSO E GANHA CHÃO AO ROLAR, e as duas metades são
 * decisões diferentes.
 *
 * **O repouso é o desenho aprovado, e não muda.** A topbar deixou de ter fundo
 * e desfoque próprios quando a interface "Leve" entrou, com a razão escrita no
 * layout: *sobre a malha, uma faixa translúcida criava uma segunda borda
 * horizontal onde o desenho não tem nenhuma*. Aquele argumento é sobre o topo
 * da página, onde a malha está — e ele continua inteiro aqui.
 *
 * **O que ele não previu foi a ROLAGEM.** A faixa é `sticky top-0 z-30` e o
 * `main` é `z-10`: com ela transparente, o conteúdo sobe POR BAIXO dela e
 * continua visível nos 64px do topo — uma tira do calendário, da tabela ou da
 * lista atravessada pela busca e pelo avatar. Pior, a barra de seções logo
 * abaixo É opaca (`bg-surface-page sticky top-16`), então o que se lê é uma
 * tira de conteúdo presa ACIMA de uma barra sólida: lê como defeito, e foi
 * como o usuário a relatou — *"quando deslizo a tela, fica com essa faixa"*.
 *
 * **E a malha não paga nada por isso**, que é o que torna a troca barata: ela
 * é `absolute top-0 h-[190px]` dentro da coluna que rola, então no instante em
 * que o chão aparece ela já saiu da tela. Um fundo permanente cortaria a malha
 * com uma borda reta no topo — exatamente o que a decisão de lá recusou.
 *
 * O limiar é zero de propósito: a tira nasce no primeiro pixel de rolagem, e
 * um limiar maior deixaria o defeito existir numa faixa de rolagem estreita.
 */
export function TopoDoPainel({ children }: { children: React.ReactNode }) {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 0);
    // Lido uma vez na montagem: quem chega por um link com âncora, ou volta
    // para uma página que o navegador restaura rolada, já começa rolado.
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-2 px-3 sm:gap-3 lg:px-6",
        // Sem transição: um esmaecimento deixaria o conteúdo aparecer por
        // baixo durante a troca, que é justamente o que isto existe para
        // impedir.
        rolou && "bg-surface-page",
      )}
    >
      {children}
    </header>
  );
}
