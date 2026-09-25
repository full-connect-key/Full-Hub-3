import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import {
  campanhasDoCliente,
  entregaveisDaCampanha,
} from "@/lib/dados/campanhas";
import {
  emArvore,
  folhas,
  periodoCurto,
  progresso,
  ROTULO_DA_CAMPANHA,
} from "@/lib/dominio/campanhas";

import { CapaDaCampanha } from "./capa-da-campanha";

export const metadata: Metadata = { title: "Aprovações & Conteúdo" };

/**
 * A entrada das campanhas pelo lado da agência, na versão mínima.
 *
 * **Isto NÃO é o gerenciador**, que é de outro momento: não dá para editar a
 * estrutura, subir arquivo nem enviar entregável por aqui. O que existe é a
 * lista do que foi aberto, a capa de cada uma e o caminho para abrir mais.
 *
 * A contagem é a MESMA do portal, pela mesma função: se a tela da agência
 * contasse por conta própria, as duas dariam números diferentes no dia em que
 * alguém mexesse numa delas.
 *
 * **ERA UMA LISTA DE LINHAS, e virou uma grade de cartões** por causa da
 * capa (0050): "identificável direto pela imagem qual campanha é" não cabe
 * numa linha de 56px de altura, e a imagem que coubesse ali seria pequena
 * demais para reconhecer.
 *
 * **O cartão inteiro não é um link**, e não é descuido: a capa carrega os
 * botões de trocar e tirar, e botão dentro de âncora é elemento interativo
 * dentro de elemento interativo — o clique vai para um dos dois conforme o
 * navegador, e o teclado tabula para um controle que não existe na árvore de
 * acessibilidade. Quem leva ao portal é o título.
 */
export default async function PaginaDeAprovacoes() {
  await exigirAcessoARota("/painel/aprovacoes");

  const campanhas = await campanhasDoCliente();
  const arvores = await Promise.all(
    campanhas.map((c) => entregaveisDaCampanha(c.id)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações & Conteúdo"
        actions={
          <Button asChild>
            <Link href="/painel/aprovacoes/campanhas/nova">
              <Plus aria-hidden className="size-4" />
              Nova campanha
            </Link>
          </Button>
        }
      />

      {campanhas.length === 0 ? (
        <EmptyState
          title="Nenhuma campanha aberta"
          description="Abra a primeira e a estrutura de entregáveis nasce junto, a partir de um modelo."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campanhas.map((campanha, i) => {
            const conta = progresso(folhas(emArvore(arvores[i])));
            // Campanha sem slug não vira link em vez de virar um link
            // quebrado: o cliente ainda não tem endereço de portal.
            const href = campanha.slug
              ? `/portal/${campanha.slug}/campanhas/${campanha.id}`
              : null;

            return (
              <li
                key={campanha.id}
                className="bg-surface-card flex flex-col gap-3 rounded-xl border p-4"
              >
                <CapaDaCampanha
                  campanhaId={campanha.id}
                  clienteId={campanha.clienteId}
                  nome={campanha.nome}
                  capaAssinada={campanha.capaAssinada}
                  temCapa={Boolean(campanha.capaUrl)}
                  podeTrocar
                />

                <div className="min-w-0 flex-1 space-y-1">
                  {href ? (
                    <Link
                      href={href}
                      className="hover:text-accent-strong font-medium transition-colors"
                    >
                      {campanha.nome}
                    </Link>
                  ) : (
                    <p className="font-medium">{campanha.nome}</p>
                  )}

                  <p className="text-text-muted text-sm tabular-nums">
                    {campanha.cliente}
                    <span aria-hidden> · </span>
                    {periodoCurto(campanha.dataInicio, campanha.dataFim)}
                    <span aria-hidden> · </span>
                    <span>{ROTULO_DA_CAMPANHA[campanha.status]}</span>
                  </p>
                </div>

                {/* `mt-auto` gruda a contagem no pé do cartão: sem ele, o
                    cartão cujo período quebra em duas linhas empurra a conta
                    para baixo e a grade fica com três números em três alturas
                    diferentes — que é justamente o que se compara. */}
                <p className="text-text-muted mt-auto text-sm tabular-nums">
                  {conta.aprovados} de {conta.total} aprovados
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
