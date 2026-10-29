import { PONTOS_DA_ESPIRAL, TRACOS_DA_ESPIRAL } from "./espiral";

/**
 * O fundo das telas de (auth): preto, com a espiral da marca girando devagar.
 *
 * **ELA SUBSTITUI A MOLÉCULA, e é decisão do usuário** — *"substituir a
 * animação das moléculas pela espiral da nova identidade, preservando a
 * sensação de movimento e conexão"*. A molécula era metaball: seis gotas que
 * fundiam e se partiam, com o efeito inteiro em duas linhas de filtro SVG. Ela
 * sai porque era uma forma inventada aqui; a espiral é o arquivo da agência.
 *
 * **O MOVIMENTO SÃO DUAS ANIMAÇÕES EMPILHADAS, como eram as da molécula, e os
 * tempos não batem de propósito:** a espiral dá uma volta em 120s e respira de
 * escala em 26s — o mesmo 26s do ciclo de dividir e juntar que ela substitui.
 * Sem a segunda, ela seria um carrossel de pontos; sem a primeira, um cartaz
 * pulsando.
 *
 * **E A "CONEXÃO" PASSOU A SER A PRÓPRIA FORMA, o que é consequência e não
 * perda.** A molécula afirmava conexão por um evento — duas gotas que viram
 * uma. Uma filotaxia não precisa do evento: cada ponto está em dois braços ao
 * mesmo tempo, e é girando que os braços aparecem. Quem olha vê o que a
 * fusão dizia, sem o filtro que ela custava.
 *
 * **Os tempos moram no `globals.css`**, em `.espiral` e `.espiral-respira`,
 * pela razão de sempre: Tailwind v4 não escreve `@keyframes` por utilitário, e
 * um compasso em `style` inline é um compasso sem dono.
 *
 * **SAÍRAM O HALO E O VÉU, e as duas ausências são medidas.** O halo existia
 * porque o corte do alpha do metaball deixava uma borda seca no preto — um
 * ponto não tem esse problema, ele é borda por natureza. E o véu era uma malha
 * de pontos parados, para o movimento ter contra o que se ler; aqui a
 * referência é interna, porque numa rotação o centro fica quieto e a borda
 * varre. Duas malhas de ponto na mesma tela seriam a mesma textura duas vezes.
 *
 * **A ESPIRAL APARECE INTEIRA, E A BORDA DELA FICA — isso inverteu duas
 * vezes, e as duas por imagem.** A primeira versão a ampliava a 1,5 para tirar
 * da tela a circunferência de pontos, que eu tratava como defeito: uma moeda
 * no meio do preto. O que saiu foi um campo de bolinhas grandes e quase
 * uniformes — **a 1,5 só a periferia cabe, e uma filotaxia não se reconhece
 * sem o degradê de densidade.** O excesso de escala tirava da tela exatamente
 * a parte que faz a forma ser a forma. (A conta também estava errada: eu tinha
 * usado a meia-diagonal em vez da meia-largura e exigido 712, quando a borda
 * sai da tela a partir de 1,053.)
 *
 * A 1,12 ainda era textura. **A 0,7 a espiral é um objeto:** o disco inteiro
 * cabe na tela com ar preto em volta, os pontos crescem do miolo para a borda,
 * e o cartão de vidro pousa no meio dele. A borda deixou de ser a moeda que eu
 * queria esconder e passou a ser o contorno da marca — que é como os cinco
 * arquivos da agência se apresentam. Escolhida entre quatro escalas, em
 * imagem: 1,12 não tem forma, 0,85 sangra em cima e embaixo e perde o objeto,
 * 0,55 fica menor que o cartão e é engolida por ele.
 *
 * *O que o cartão cobre, e é consequência aceita:* o miolo, onde os pontos são
 * menores. O degradê continua legível — ele cresce da borda do cartão para
 * fora —, e é a mesma troca que a molécula fazia de melhor, com a massa atrás
 * do vidro sendo difundida por ele.
 *
 * **A OPACIDADE É DE GRUPO, e ela não quebra a regra do par nomeado.** O que
 * aquela regra proíbe é opacidade sobre um fundo QUALQUER, porque o composto
 * muda de tela para tela e ninguém o mede. Aqui o fundo é `--auth-fundo`,
 * preto, um só e fixo: o composto é uma cor única e calculada, e ela está
 * medida em `--vidro-no-pior-caso`. A alternativa seria um segundo azul
 * literal, e aí sim estaria no arquivo uma cor de marca que a agência não
 * entregou. Em 100% os pontos grandes brilham mais que o formulário e puxam o
 * olho para fora dele — isto é fundo, não conteúdo.
 */
function Espiral() {
  return (
    <g className="fill-brand-blue stroke-brand-blue opacity-45">
      {PONTOS_DA_ESPIRAL.map(([x, y, r], i) =>
        i % 7 === 2 ? (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill="none"
            strokeWidth={TRACOS_DA_ESPIRAL[(i - 2) / 7]}
          />
        ) : (
          <circle key={i} cx={x} cy={y} r={r} stroke="none" />
        ),
      )}
    </g>
  );
}

export function FundoDaPorta() {
  return (
    <div
      aria-hidden
      className="bg-auth-fundo pointer-events-none fixed inset-0 overflow-hidden"
    >
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        className="size-full"
      >
        <g className="espiral">
          <g className="espiral-respira">
            <Espiral />
          </g>
        </g>
      </svg>
    </div>
  );
}
