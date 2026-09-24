import { cn } from "@/lib/utils";

/**
 * Uma barra de progresso.
 *
 * O NÚMERO ANDA JUNTO, e não é opcional: barra sozinha diz "mais ou menos
 * essa fração", e quem está no meio de uma trilha quer saber quantos faltam.
 * É por isso que o rótulo aceita texto ("4 de 9") em vez de só o percentual —
 * a contagem responde a pergunta melhor que a porcentagem.
 *
 * `role="progressbar"` com os três `aria-value*`: sem eles, um leitor de tela
 * anuncia uma div vazia. O texto do rótulo vai no `aria-valuetext` porque
 * "4 de 9 concluídos" informa mais que "44".
 */
export function BarraDeProgresso({
  valor,
  total,
  rotulo,
  className,
  tom = "marca",
  rotuloOculto = false,
}: {
  valor: number;
  total: number;
  /** O texto ao lado. Sem ele a barra vira enfeite. */
  rotulo: string;
  className?: string;
  /** `sucesso` quando está completa — o verde diz "acabou" sem precisar ler. */
  tom?: "marca" | "sucesso";
  /**
   * Esconde o texto, e SÓ o texto — o `aria-valuetext` continua lá.
   *
   * Serve para onde a contagem já está escrita ao lado, como no cabeçalho de
   * um grupo de entregáveis: "Enxoval (3 de 5 aprovados)" com "60% aprovado"
   * logo abaixo são duas formas do mesmo número empilhadas, e a segunda só
   * ocupa altura. Quem lê por leitor de tela continua recebendo a contagem,
   * que é o motivo de o rótulo ser obrigatório.
   */
  rotuloOculto?: boolean;
}) {
  // Total zero daria NaN, que o navegador renderiza como largura inválida.
  const percentual = total > 0 ? Math.round((valor / total) * 100) : 0;

  return (
    <div className={cn("space-y-1", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={valor}
        aria-valuetext={rotulo}
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            tom === "sucesso" ? "bg-success" : "bg-accent-strong",
          )}
          style={{ width: `${percentual}%` }}
        />
      </div>
      {rotuloOculto ? null : (
        <p className="text-text-muted text-xs tabular-nums">{rotulo}</p>
      )}
    </div>
  );
}
