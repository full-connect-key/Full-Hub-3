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
 *
 * ---------------------------------------------------------------------------
 * **A FRASE DIZ "DECISÃO" E NÃO "AÇÃO" DESDE A 0139, e foi a imagem que
 * mandou:** a faixa afirmava que *nenhuma ação* está disponível, e na mesma
 * tela, quinze centímetros abaixo, a gestão passou a criar pasta, subir
 * arquivo, renomear e apagar no acervo de marca — a tela dizendo duas coisas
 * que se contradizem a poucos centímetros.
 *
 * **O que a faixa existe para garantir continua inteiro, e é mais estreito que
 * "ação":** ninguém APROVA, pede ajustes ou recusa em nome de quem contratou —
 * `decidir_rodada_do_cliente` recusa no banco quem não é o cliente daquela
 * rodada, e é essa a promessa. Montar o acervo é trabalho da agência sobre o
 * material da agência, e não uma decisão tomada no lugar dele.
 * ---------------------------------------------------------------------------
 */
export function AvisoDeVisualizacao({
  nomeDaEmpresa,
}: {
  nomeDaEmpresa: string;
}) {
  return (
    <div className="bg-warning-soft text-warning sticky top-0 z-50 border-b border-current/20">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 lg:px-8">
        <Eye aria-hidden className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 text-sm">
          Você está visualizando o portal da <strong>{nomeDaEmpresa}</strong>{" "}
          como equipe Full Connect Key. Nenhuma decisão em nome do cliente está
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
