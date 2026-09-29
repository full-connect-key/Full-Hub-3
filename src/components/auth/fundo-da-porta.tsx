/**
 * O fundo das telas de (auth): preto, com a molécula azul que se divide e se
 * junta enquanto atravessa a tela.
 *
 * **O efeito é metaball, e ele é o filtro daqui.** Duas linhas: desfoca os
 * círculos e depois AFIA o canal alpha. Duas gotas desfocadas que se aproximam
 * têm os halos somados, e o corte do alpha transforma essa soma numa borda só
 * — elas fundem. Afastando-se, a soma cai abaixo do corte e a borda se parte em
 * duas. Sem o afiamento seriam manchas se sobrepondo, que é o que PARECE
 * molécula e não é.
 *
 * **Os tempos e os caminhos moram no `globals.css`**, em `.molecula` e
 * `.atomo-1..6`. Aqui está só o desenho. Espalhados em `style` inline, os seis
 * átomos teriam seis fontes de verdade sobre o mesmo compasso.
 *
 * **É SVG à mão e a cor sai dos tokens**, pelo mesmo motivo dos gráficos e do
 * símbolo da marca: os cinco tons da molécula são `--molecula-1..5`, e os
 * intermediários saem de `color-mix` entre os dois azuis que já existem. Um
 * PNG aqui traria cinco cores literais para dentro da interface.
 *
 * **O grupo dos átomos aparece DUAS vezes.** A primeira é o halo — a mesma
 * molécula sem o corte do alpha, muito desfocada, que faz o azul sangrar no
 * preto em vez de terminar numa borda seca. A segunda é a molécula. Não é
 * `<use>`: a animação vive numa classe, e classe dentro do sub-árvore de um
 * `<use>` é terreno onde os navegadores divergem — duplicar seis círculos custa
 * menos que descobrir isso num só.
 */
/**
 * Cada átomo é um DEGRADÊ RADIAL, e não um tom chapado — a diferença aparece na
 * imagem e não na tela em movimento: chapado, o átomo se lê como um disco de
 * cor, e o que deveria parecer líquido parece adesivo. O centro mais claro e a
 * borda mais escura são o que dá volume à gota antes de ela fundir.
 *
 * O centro de cada degradê é deslocado do meio (35%/30%) pelo mesmo motivo que
 * um brilho especular não fica no centro de uma esfera.
 */
const ATOMOS = [
  { classe: "atomo-1", r: 118, tom: "porta-gota-1" },
  { classe: "atomo-2", r: 146, tom: "porta-gota-2" },
  { classe: "atomo-3", r: 132, tom: "porta-gota-3" },
  { classe: "atomo-4", r: 104, tom: "porta-gota-2" },
  { classe: "atomo-5", r: 90, tom: "porta-gota-4" },
  { classe: "atomo-6", r: 112, tom: "porta-gota-3" },
] as const;

/** Do tom mais claro para o mais escuro: são os cinco de `--molecula-1..5`. */
const GOTAS = [
  { id: "porta-gota-1", centro: "var(--molecula-1)", borda: "var(--molecula-2)" },
  { id: "porta-gota-2", centro: "var(--molecula-2)", borda: "var(--molecula-3)" },
  { id: "porta-gota-3", centro: "var(--molecula-3)", borda: "var(--molecula-4)" },
  { id: "porta-gota-4", centro: "var(--molecula-4)", borda: "var(--molecula-5)" },
] as const;

function Atomos() {
  return (
    <g transform="translate(500 500)">
      {ATOMOS.map(({ classe, r, tom }) => (
        <circle
          key={classe}
          className={`atomo ${classe}`}
          r={r}
          fill={`url(#${tom})`}
        />
      ))}
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
        <defs>
          {GOTAS.map(({ id, centro, borda }) => (
            <radialGradient key={id} id={id} cx="35%" cy="30%">
              <stop offset="0" stopColor={centro} />
              <stop offset="1" stopColor={borda} />
            </radialGradient>
          ))}

          {/* `color-interpolation-filters="sRGB"` não é detalhe: o padrão é
              linearRGB, e nele o corte do alpha sai com a borda mordida e os
              tons intermediários lavados. */}
          <filter
            id="molecula-gosma"
            x="-35%"
            y="-35%"
            width="170%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="26" result="borrado" />
            <feColorMatrix
              in="borrado"
              type="matrix"
              result="afiado"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 22 -9"
            />
            {/* O último desfoque, pequeno, tira a borda seca que o corte do
                alpha deixa. */}
            <feGaussianBlur in="afiado" stdDeviation="1.6" />
          </filter>
        </defs>

        <g className="molecula molecula-halo">
          <Atomos />
        </g>
        <g className="molecula" filter="url(#molecula-gosma)">
          <Atomos />
        </g>
      </svg>

      <div className="veu-da-porta absolute inset-0" />
    </div>
  );
}
