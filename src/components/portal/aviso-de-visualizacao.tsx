import Link from "next/link";
import { Eye, LogOut } from "lucide-react";

/**
 * A faixa que não dá para não ver.
 *
 * Fica presa no topo, acima de tudo, e acompanha a rolagem. O motivo é
 * concreto: quem está aqui é da agência, olhando uma tela feita para o
 * cliente, e a semelhança é o objetivo. Sem uma marca permanente, bastam
 * alguns segundos de rolagem para alguém achar que está no portal como
 * cliente — e tentar aprovar em nome dele.
 *
 * O fundo é âmbar, não vermelho: nada de errado está acontecendo, é um modo de
 * trabalho legítimo. Vermelho é para erro.
 */
export function AvisoDeVisualizacao({
  nomeDaEmpresa,
}: {
  nomeDaEmpresa: string;
}) {
  return (
    <div className="bg-warning-soft text-warning sticky top-0 z-50 border-b border-current/20">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 lg:px-8">
        <Eye aria-hidden className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 text-sm">
          Você está visualizando o portal da <strong>{nomeDaEmpresa}</strong>{" "}
          como equipe Full Connect Key. Nenhuma ação em nome do cliente está
          disponível.
        </p>
        <Link
          href="/painel"
          className="hover:bg-warning hover:text-warning-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border border-current px-2.5 py-1 text-xs font-medium transition-colors"
        >
          <LogOut aria-hidden className="size-3.5" />
          Sair da visualização
        </Link>
      </div>
    </div>
  );
}
