import { cn } from "@/lib/utils";

/**
 * O símbolo da Full Connect Key: disco, ponto e triângulo.
 *
 * **É o arquivo da agência, não um desenho parecido.** A geometria foi medida
 * no PNG original — disco de raio inteiro, ponto em (544,5 / 320,4) com raio
 * 88,6, triângulo de traço 19 com os vértices calculados a partir da caixa
 * externa e do recuo de esquadria. Os quatro arquivos que vieram estão em
 * `public/marca/`, e conferir é comparar.
 *
 * **É SVG à mão, e pelo mesmo motivo dos gráficos:** a cor precisa sair dos
 * tokens. Um PNG aqui traria três cores literais para dentro da interface e
 * congelaria a versão — a marca tem duas, e qual delas aparece depende do
 * fundo. Com SVG e variável, quem decide é o `globals.css`, que é onde essa
 * decisão já mora para o resto da tela.
 *
 * **Ele é da AGÊNCIA, e o lockup do produto é outro.** Quem desenha "Full
 * Hub" é `MarcaDoFullHub`, logo abaixo; este símbolo ficou com o único lugar
 * em que o usuário pediu *"apenas o logo da agência"*: a porta.
 *
 * `sobreEscuro` marca o `data-marca`, e o CSS troca as três cores de uma vez.
 * Não é uma terceira versão: é a mesma marca, na versão azul, onde o fundo é
 * escuro mesmo no tema claro — a porta, que é preta nos dois temas. (Era a
 * barra lateral também, até ela passar a seguir o tema.)
 */
export function SimboloDaMarca({
  sobreEscuro = false,
  className,
}: {
  sobreEscuro?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1080 1080"
      aria-hidden
      data-marca={sobreEscuro ? "azul" : undefined}
      className={cn("shrink-0", className)}
    >
      <circle cx="540" cy="540" r="540" className="fill-marca-disco" />
      <circle cx="544.5" cy="320.4" r="88.6" className="fill-marca-ponto" />
      <path
        d="M539 518.3 L731.8 860.5 L346.2 860.5 Z"
        fill="none"
        strokeWidth="19"
        strokeLinejoin="miter"
        className="stroke-marca-traco"
      />
    </svg>
  );
}

/**
 * O ícone do Full Hub: o ladrilho com o ponto e o triângulo.
 *
 * **É o arquivo da agência, não um desenho parecido.** A geometria foi medida
 * em `public/marca/full-hub-icone.png`: ladrilho de 632 com canto de raio
 * 95,6 — ajustado por mínimos quadrados sobre 86 pontos da borda, com resíduo
 * de 0,18px —, ponto em (316 / 180) com raio 48, e o triângulo como duas
 * voltas de um caminho `evenodd`, a de fora e o furo, porque é assim que o
 * arquivo desenha. O SVG foi rasterizado no Chromium e comparado pixel a
 * pixel com o PNG: a silhueta bate dentro de 1px, e o único pixel que diverge
 * é a ponta do furo do triângulo.
 *
 * **Ele é o quadrado, e o lockup é o retângulo.** Quem precisa de uma marca
 * que caiba num quadrado — a barra lateral recolhida — usa este; quem tem
 * largura usa `MarcaDoFullHub`. Não é uma segunda marca: é o mesmo arquivo da
 * agência nas duas formas que ela entregou.
 *
 * **O ponto é branco e o triângulo é preto literalmente**, e não por token:
 * eles vivem sobre o ladrilho, que tem fundo próprio. Um token de tema ali
 * trocaria a cor por causa de um fundo que não é o deles.
 */
export function IconeDoFullHub({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 632 632" aria-hidden className={cn("shrink-0", className)}>
      <rect width="632" height="632" rx="95.6" className="fill-marca-hub" />
      <circle cx="316" cy="180" r="48" className="fill-marca-hub-ponto" />
      <path
        fillRule="evenodd"
        className="fill-marca-hub-traco"
        d="M315.5 257.4 L443.6 500 L187.4 500 Z M315.5 294.4 L413.5 481 L217.5 481 Z"
      />
    </svg>
  );
}

/**
 * O lockup do Full Hub: "full hub" com o ponto e o triângulo.
 *
 * **ELE DESFAZ UMA DECISÃO QUE ESTAVA ESCRITA AQUI, e a razão é que a premissa
 * dela caiu.** O nome do produto era tipográfico de propósito, e o argumento
 * era este: *"não existe wordmark de Full Hub, e desenhar um seria pôr no ar
 * uma marca que a agência não fez"*. A agência fez. Com o arquivo na mão,
 * escrever "Full Hub" na letra do produto passou a ser o contrário do que
 * aquela frase protegia — é jogar fora a identidade que ela acabou de
 * desenhar.
 *
 * **É o arquivo vetorizado, e não uma letra parecida.** As duas cores do PNG
 * foram separadas em duas máscaras e cada uma virou um caminho `evenodd`,
 * seguindo a borda dos pixels e simplificada com desvio máximo de 0,45px. A
 * conferência é a do símbolo: rasterizado no Chromium e comparado pixel a
 * pixel com `public/marca/full-hub.png` — a silhueta bate dentro de 1px, e os
 * quatro pixels que divergem são pontas de canto.
 *
 * **O NEUTRO É `--text-primary`, e é o que faz o lockup servir aos dois
 * temas.** A agência entregou uma versão só, com as letras pretas, e preto
 * sobre a barra lateral escura não se lê. Apontar para o token do texto do
 * produto é a mesma decisão de `--acao-fundo`: ele inverte sozinho no escuro,
 * em vez de repetir dois hexadecimais — e é a convenção da própria agência,
 * que já entrega o wordmark dela numa versão branca.
 */
export function MarcaDoFullHub({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 538 363"
      role="img"
      aria-label="Full Hub"
      className={cn("shrink-0", className)}
    >
      <path
        fillRule="evenodd"
        className="fill-marca-hub"
        d="M23 110v-33h-23v-24h23v-16h1v-6h1v-4h1v-2h1v-3l2 -1v-2h1v-2h1v-1h1v-1l2 -1v-2h1v-1h2v-1h1v-1h1l1 -2h2v-1h2v-1h2v-1h2v-1h3v-1h3v-1h5v-1h17v1h5v1h4v1h2v26h-2v-1h-3v-1h-3v-1h-5v-1h-9v1h-3v1h-2v1h-2v1h-1v1h-1v1h-1v1h-1v1l-2 1v2h-1v4h-1v13h31v1h1v23h-32v157h-1v15h2v-2l2 -1v-2h1v-1h1v-1h1v-1h1v-1h1l1 -2h2l1 -2h2l1 -2h2v-1h2v-1h2v-1h3v-1h3v-1h4v-1h20v1h4v1h4v1h2v1h3l1 2h2v1h2v1h1l1 2h2v1h1v1h1v1l2 1v2h1v1l2 1v2h1v2h1v2h1v2h1v3h1v3h1v4h1v6h1v89h-27v-85h-1v-4h-1v-2h-1v-2h-1v-2h-1v-1l-2 -1v-2h-1v-1h-2v-1h-1l-1 -2h-2v-1h-2v-1h-3v-1h-17v1h-3v1h-2v1h-2l-1 2h-2v1h-1v1h-1v1h-1v1h-1v1l-2 1v2h-1v1l-2 1v2h-1v2h-1v2h-1v3h-1v3h-1v5h-1v74h-27zM464 229v-2h-1v-5h-1v-2h1v-5h1v-2h1v-2h1v-2h1v-1h1v-1h1v-1h1l1 -2h2v-1h2v-1h4v-1h8v1h3v1h2v1h2v1h1v1h1v1h1v1h1v1l2 1v2h1v2h1v5h1v5h-1v4h-1v2h-1v2l-2 1v2h-1l-1 2h-2l-1 2h-2v1h-3v1h-11v-1h-3v-1h-2v-1h-1l-1 -2h-2v-2h-1v-1l-2 -1v-2z"
      />
      <path
        fillRule="evenodd"
        className="fill-text-primary"
        d="M247 27v-25h27v178h-27zM343 263v1h-1v1l-2 1v2h-1v1l-2 1v2h-1v2h-1v2h-1v2h-1v4h-1v4h-1v18h1v5h1v3h1v2h1v3l2 1v2h1v2h1v1l2 1v2h1v1h1l1 2h2v1h1l1 2h2l1 2h2v1h3v1h2v1h4v1h14v-1h4v-1h3v-1h2v-1h2v-1h2l1 -2h2v-1h1v-1h1v-1h1v-1h1v-1h1v-1l2 -1v-2l2 -1v-2h1v-2h1v-2h1v-2h1v-3h1v-4h1v-21h-1v-4h-1v-3h-1v-3h-1v-2l-2 -1v-2h-1v-2h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1l-1 -2h-2l-1 -2h-2v-1h-2v-1h-3v-1h-3v-1h-7v-1h-4v1h-7v1h-3v1h-2v1h-2v1h-2v1h-2l-1 2h-2v1h-1zM332 104v136h-1v9h2v-2h1v-1l2 -1v-2h1v-1h1l1 -2h2v-1h1v-1h1l1 -2h2l1 -2h2v-1h2v-1h3v-1h2v-1h3v-1h5v-1h19v1h5v1h4v1h2v1h3v1h2v1h2v1h2v1h1v1h2l1 2h2v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1l2 1v2h1v1l2 1v2h1v2l2 1v2h1v2h1v2h1v3h1v3h1v3h1v4h1v6h1v22h-1v6h-1v4h-1v4h-1v3h-1v2h-1v2h-1v2h-1v2h-1v2h-1v2h-1v1h-1v2h-1v1l-2 1v2h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1l-1 2h-2v1h-1l-1 2h-2l-1 2h-2v1h-2v1h-2v1h-2v1h-3v1h-3v1h-4v1h-6v1h-14v-1h-5v-1h-4v-1h-3v-1h-2v-1h-2v-1h-2v-1h-2l-1 -2h-2v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1l-2 -1v-2h-2v17h-26v-357h27zM281 324v35h-25v-17h-2v1l-2 1v2h-1v1h-1v1h-1v1h-1v1h-1l-1 2h-2v1h-1l-1 2h-2v1h-2l-1 2h-3v1h-2v1h-3v1h-3v1h-5v1h-14v-1h-6v-1h-4v-1h-3v-1h-2v-1h-2v-1h-2v-1h-2l-1 -2h-2v-1h-1v-1h-1v-1l-2 -1v-2h-1v-1l-2 -1v-2l-2 -1v-2h-1v-2h-1v-2h-1v-3h-1v-3h-1v-4h-1v-6h-1v-89h27v83h1v5h1v3h1v2h1v2h1v1l2 1v2h1v1h2v1h1l1 2h2v1h3v1h3v1h14v-1h4v-1h2v-1h2v-1h2v-1h1v-1h1l1 -2h2v-1l2 -1v-2h1v-1l2 -1v-2h1v-2h1v-2h1v-3h1v-3h1v-4h1v-76h27zM203 53h13v128h-25v-18h-1v1h-1v1l-2 1v2h-1v1h-1v1h-1v1h-1l-1 2h-2v1h-1l-1 2h-2l-1 2h-2v1h-2v1h-2v1h-3v1h-3v1h-4v1h-21v-1h-4v-1h-4v-1h-2v-1h-2v-1h-2v-1h-2v-1h-1v-1h-2v-1h-1v-1h-1v-1h-1v-1h-1v-1l-2 -1v-2h-1v-1l-2 -1v-2h-1v-2h-1v-2h-1v-2h-1v-3h-1v-3h-1v-5h-1v-7h-1v-87h27v82h1v6h1v3h1v2h1v2l2 1v2h1v1h1v1h1l1 2h2l1 2h3v1h2v1h5v1h8v-1h5v-1h3v-1h2v-1h2v-1h2v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1l2 -1v-2l2 -1v-2h1v-2h1v-2h1v-3h1v-4h1v-77h1v-1zM530 358h-102v-2h1v-2h1v-2h1v-2l2 -1v-2h1v-2h1v-2h1v-2h1v-2h1v-2h1v-2l2 -1v-2h1v-2h1v-2h1v-2h1v-2h1v-2h1v-2l2 -1v-2h1v-2h1v-2h1v-2h1v-2h1v-2h1v-2h1v-2l2 -1v-2h1v-2h1v-2h1v-2h1v-2h1v-2h1v-2l2 -1v-2h1v-2h1v-2h1v-2h1v-2h1v-2h1v-2l2 -1v-2h1v-2h1v-2h1v-2h1v-2h1v-2h1v-2l2 -1v-2l2 1v2h1v2h1v2h1v2l2 1v2h1v2h1v2h1v2h1v2h1v2h1v2l2 1v2h1v2h1v2h1v2h1v2h1v2h1v2l2 1v2h1v2h1v2h1v2h1v2h1v2h1v2h1v2l2 1v2h1v2h1v2h1v2h1v2h1v2h1v2l2 1v2h1v2h1v2h1v2h1v2h1v2h1v2l2 1v2h1v2h1v2h1v2h1v2h1v2h1v2h1v2zM455 323v1h-1v2h-1v2h-1v2h-1v2h-1v2h-1v2l-2 1v2h-1v2h-1v2h-1v2h-1v2h-1v2h-1v1h83v-2l-2 -1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2l-2 -1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2l-2 -1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2l-2 -1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2l-2 -1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-2h-1v-1h-1v2l-2 1v2h-1v2h-1v2h-1v2h-1v2h-1v2h-1v2l-2 1v2h-1v2h-1v2h-1v2h-1v2h-1v2h-1v2l-2 1v2h-1v2h-1v2h-1v2h-1v2h-1v2h-1v2h-1v2z"
      />
    </svg>
  );
}

/**
 * O lockup do painel: a marca do Full Hub e a assinatura da agência.
 *
 * **O nome do produto DEIXOU DE SER TIPOGRÁFICO**, e o que mudou foi a
 * premissa e não o gosto: ele era texto porque não existia wordmark de Full
 * Hub. Existe, e o argumento de então — *"desenhar um seria pôr no ar uma
 * marca que a agência não fez"* — passou a dizer o contrário, porque escrever
 * o nome na letra do produto é jogar fora a marca que ela fez.
 *
 * **O símbolo da agência saiu daqui junto, e não é remoção da agência.** O
 * lockup novo já carrega o ponto e o triângulo no fim do nome: pôr o disco ao
 * lado repetiria o mesmo par de formas duas vezes em quarenta pixels. Quem
 * continua nomeando a agência é a assinatura em caixa alta, que se lê a 9px —
 * e `SimboloDaMarca` continua de pé, na porta, que é onde o usuário pediu
 * *"apenas o logo da agência"*.
 *
 * **A marca é alta e a assinatura é uma linha só, ao lado.** Empilhada, a
 * assinatura sai mais larga que a marca que ela assina — "FULL CONNECT KEY"
 * espaçado passa de cem pixels, e a marca a 32px de altura tem quarenta e
 * sete. Ao lado, a leitura é a que o lockup quer dizer: o produto, de quem
 * ele é.
 *
 * `assinatura="nenhuma"` é para onde o nome da agência já está escrito logo
 * abaixo.
 */
export function Logo({
  tamanho = "md",
  assinatura = "texto",
  className,
}: {
  tamanho?: "sm" | "md" | "lg";
  /** `nenhuma` é para onde o nome da agência já está escrito logo abaixo. */
  assinatura?: "texto" | "nenhuma";
  className?: string;
}) {
  const medidas = {
    sm: { marca: "h-8", assinatura: "text-[9px]" },
    md: { marca: "h-10", assinatura: "text-[10px]" },
    lg: { marca: "h-14", assinatura: "text-[11px]" },
  }[tamanho];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <MarcaDoFullHub className={cn("w-auto", medidas.marca)} />

      {assinatura === "texto" ? (
        <span
          className={cn(
            "text-text-muted font-medium tracking-widest uppercase",
            medidas.assinatura,
          )}
        >
          Full Connect Key
        </span>
      ) : null}
    </div>
  );
}
