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
}: {
  valor: number;
  total: number;
  /** O texto ao lado. Sem ele a barra vira enfeite. */
  rotulo: string;
  className?: string;
  /** `sucesso` quando está completa — o verde diz "acabou" sem precisar ler. */
  tom?: "marca" | "sucesso";
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
      <p className="text-text-muted text-xs tabular-nums">{rotulo}</p>
    </div>
  );
}
