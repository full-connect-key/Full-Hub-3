import Link from "next/link";

import { CartaoDeCampanha } from "@/components/portal/cartao-de-campanha";
import { EmptyState } from "@/components/shared/empty-state";
import {
  campanhasDoCliente,
  entregaveisDaCampanha,
} from "@/lib/dados/campanhas";
import {
  combinaComFiltro,
  emArvore,
  esperandoOCliente,
  FILTROS_DE_CAMPANHA,
  folhas,
  progresso,
  ROTULOS_DO_FILTRO,
  type FiltroDeCampanha,
} from "@/lib/dominio/campanhas";
import { cn } from "@/lib/utils";

/**
 * As campanhas do cliente.
 *
 * **A ordem é a do fim mais próximo**, e não a do começo: a pergunta de quem
 * abre a lista é "o que preciso decidir antes que acabe". Ordenar pelo início
 * põe no topo a campanha mais antiga, que costuma ser a que já foi resolvida.
 *
 * **O progresso conta só as FOLHAS da árvore.** Um grupo com quinze sub-itens
 * é uma linha na tela e quinze entregas no trabalho; contar o grupo também
 * faria "16 de 16" onde há quinze coisas, e a barra andaria sozinha quando o
 * último filho fosse aprovado.
 *
 * Um bloco para as duas entradas, como o resto do Portal: `base` é o prefixo
 * dos links e `clienteId` é obrigatório na visualização da equipe, que enxerga
 * todas as empresas pelo RLS.
 */
export async function CampanhasDoPortal({
  base,
  clienteId,
  filtro,
}: {
  base: string;
  clienteId: string | null;
  filtro: FiltroDeCampanha;
}) {
  const todas = await campanhasDoCliente(clienteId ?? undefined);
  const visiveis = todas.filter((c) => combinaComFiltro(c, filtro));

  // Uma consulta de entregáveis por campanha VISÍVEL, e não por campanha: o
  // recorte já cortou as outras, e buscar a árvore de uma campanha que não
  // vai aparecer é ida ao banco por nada.
  const arvores = await Promise.all(
    visiveis.map((c) => entregaveisDaCampanha(c.id)),
  );

  const ordenadas = visiveis
    .map((campanha, i) => {
      const itens = folhas(emArvore(arvores[i]));
      return {
        campanha,
        progresso: progresso(itens),
        esperando: esperandoOCliente(itens),
      };
    })
    .sort((a, b) => a.campanha.dataFim.localeCompare(b.campanha.dataFim));

  return (
    <div className="space-y-6">
      <nav aria-label="Filtrar campanhas" className="flex flex-wrap gap-2">
        {FILTROS_DE_CAMPANHA.map((opcao) => {
          const quantas = todas.filter((c) =>
            combinaComFiltro(c, opcao),
          ).length;
          const ativo = opcao === filtro;

          return (
            <Link
              key={opcao}
              href={opcao === "ativas" ? base : `${base}?filtro=${opcao}`}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                ativo
                  ? "border-accent-strong bg-accent text-accent-foreground font-medium"
                  : "hover:bg-accent",
              )}
            >
              {ROTULOS_DO_FILTRO[opcao]}
              <span className="text-text-muted tabular-nums">{quantas}</span>
            </Link>
          );
        })}
      </nav>

      {ordenadas.length === 0 ? (
        <EmptyState
          title="Nenhuma campanha por aqui"
          description={
            filtro === "ativas"
              ? "Quando a Full começar uma campanha para você, ela aparece nesta lista."
              : "Experimente outro filtro acima."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ordenadas.map(({ campanha, progresso: p, esperando }) => (
            <CartaoDeCampanha
              key={campanha.id}
              campanha={campanha}
              progresso={p}
              esperando={esperando}
              href={`${base}/${campanha.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
