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
 * `sobreEscuro` marca o `data-marca`, e o CSS troca as três cores de uma vez.
 * Não é uma terceira versão: é a mesma marca, na versão azul, onde o fundo é
 * escuro mesmo no tema claro — a barra lateral.
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
 * Marca do Full Hub: o símbolo da agência, o nome do produto e a assinatura.
 *
 * **O símbolo é da Full Connect Key; "Full Hub" é o nome do produto.** São
 * duas coisas, e por isso o nome continua tipográfico: não existe wordmark de
 * Full Hub, e inventar um seria pôr no ar uma marca que a agência não
 * desenhou.
 *
 * **A assinatura é texto, e o wordmark da agência NÃO entra aqui.** Ele é um
 * lockup fechado de três linhas que se encaixam, com o próprio símbolo
 * dentro: sob "Full Hub" ele repetia o disco e disputava o mesmo espaço, e
 * abaixo de uns 24px de altura as linhas fecham e viram um borrão. O arquivo
 * de verdade aparece uma vez, no pé da tela de login, que é onde há altura
 * para ele. Aqui a assinatura é caixa alta espaçada, que se lê a 9px.
 *
 * `sobreEscuro` é para a barra lateral, que tem fundo próprio e não acompanha
 * o tema claro/escuro da página. Sem ele, o nome sairia escuro sobre escuro.
 */
export function Logo({
  tamanho = "md",
  sobreEscuro = false,
  assinatura = "texto",
  className,
}: {
  tamanho?: "sm" | "md" | "lg";
  sobreEscuro?: boolean;
  /** `nenhuma` é para onde o nome da agência já está escrito logo abaixo. */
  assinatura?: "texto" | "nenhuma";
  className?: string;
}) {
  const medidas = {
    sm: { caixa: "size-8", texto: "text-sm", assinatura: "text-[9px]" },
    md: { caixa: "size-10", texto: "text-lg", assinatura: "text-[10px]" },
    lg: { caixa: "size-14", texto: "text-2xl", assinatura: "text-[11px]" },
  }[tamanho];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <SimboloDaMarca sobreEscuro={sobreEscuro} className={medidas.caixa} />

      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className={cn(
            "font-semibold tracking-tight",
            medidas.texto,
            sobreEscuro && "text-text-on-dark",
          )}
        >
          Full Hub
        </span>

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
      </span>
    </div>
  );
}
