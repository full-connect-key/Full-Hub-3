import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ListChecks } from "lucide-react";

import { CapaDoCartao } from "@/components/shared/capa-do-cartao";
import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import {
  entregaveisDaCampanha,
  obterCampanha,
  urlsDosArquivos,
  versoesDoEntregavel,
} from "@/lib/dados/campanhas";
import { enderecoDaArte } from "@/lib/dados/conteudo";
import {
  emArvore,
  folhas,
  periodoCurto,
  progresso,
  ROTULO_DA_CAMPANHA,
} from "@/lib/dominio/campanhas";

import { ArvoreDeProducao } from "./arvore-de-producao";

export const metadata: Metadata = { title: "Campanha" };

/**
 * A CAMPANHA PELO LADO DE CÁ — onde a equipe sobe o material.
 *
 * **Não é área nova, e não precisava ser.** `deliverable_versions` nasceu na
 * 0033 com número de versão, arquivo, justificativa e autor, com o trigger
 * que numera e o que sincroniza a capa; o bucket privado e as quatro policies
 * também. Mais de uma versão já funcionava e a justificativa já tinha coluna
 * — o que nunca existiu foi a tela. É exatamente a situação em que o Social
 * Media estava até a 0042: o Portal pronto, o lado de cá inexistente.
 *
 * Então o lugar onde a equipe sobe o material da campanha é a própria
 * campanha. Um módulo separado de arquivos criaria um segundo lugar para
 * procurar a mesma arte — e o entregável, que é quem o cliente decide,
 * continuaria apontando para o primeiro.
 *
 * **As duas portas ficam no topo**, e elas respondem a perguntas diferentes:
 * "como isto está chegando para o cliente" abre o portal daquela empresa, e
 * "quem está com o quê" abre a demanda. A segunda só aparece quando a
 * campanha tem demanda — as anteriores à 0051 não têm.
 */
export default async function PaginaDaCampanha({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAcessoARota("/painel/aprovacoes");
  const { id } = await params;

  const campanha = await obterCampanha(id);
  if (!campanha) notFound();

  const entregaveis = await entregaveisDaCampanha(campanha.id);
  const arvore = emArvore(entregaveis);
  const itens = folhas(arvore);
  const conta = progresso(itens);

  // UMA ASSINATURA PARA A TELA INTEIRA, e não uma por item: o bucket é
  // privado, a URL vale uma hora, e quinze itens seriam quinze idas à rede
  // em série para desenhar uma lista.
  const miniaturas = await urlsDosArquivos(itens.map((i) => i.thumbnailUrl));

  const versoes = Object.fromEntries(
    await Promise.all(
      itens.map(
        async (item) => [item.id, await versoesDoEntregavel(item.id)] as const,
      ),
    ),
  );

  const arquivosDasVersoes = await urlsDosArquivos(
    Object.values(versoes).flatMap((lista) =>
      lista.flatMap((v) => [v.arteUrl, ...v.arquivos]),
    ),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/painel/aprovacoes"
        className="text-text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Voltar às campanhas
      </Link>

      <PageHeader
        title={campanha.nome}
        actions={
          <div className="flex flex-wrap gap-2">
            {campanha.taskId ? (
              <Button variant="outline" asChild>
                <Link href={`/painel/gestao-tasks/${campanha.taskId}`}>
                  <ListChecks aria-hidden className="size-4" />
                  Abrir a demanda
                </Link>
              </Button>
            ) : null}
            {campanha.slug ? (
              <Button variant="outline" asChild>
                <Link href={`/portal/${campanha.slug}/campanhas/${campanha.id}`}>
                  <ExternalLink aria-hidden className="size-4" />
                  Ver como o cliente vê
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <section className="bg-surface-card space-y-3 rounded-xl border p-4">
        <CapaDoCartao
          url={campanha.capaAssinada}
          alt={campanha.nome}
          className="max-h-40"
        />
        <p className="text-text-muted text-sm tabular-nums">
          {campanha.cliente}
          <span aria-hidden> · </span>
          {periodoCurto(campanha.dataInicio, campanha.dataFim)}
          <span aria-hidden> · </span>
          <span>{ROTULO_DA_CAMPANHA[campanha.status]}</span>
        </p>

        {conta.total > 0 ? (
          <BarraDeProgresso
            valor={conta.aprovados}
            total={conta.total}
            tom={conta.aprovados === conta.total ? "sucesso" : "marca"}
            rotulo={`${conta.aprovados} de ${conta.total} aprovados pelo cliente`}
          />
        ) : (
          <p className="text-text-muted text-sm">
            Esta campanha ainda não tem entregável. Acrescente na demanda — cada
            etapa vira uma peça aqui.
          </p>
        )}
      </section>

      <ArvoreDeProducao
        clienteId={campanha.clienteId}
        arvore={arvore}
        miniaturas={Object.fromEntries(
          itens.map((i) => [
            i.id,
            enderecoDaArte(i.thumbnailUrl, miniaturas) ?? "",
          ]),
        )}
        versoes={versoes}
        assinadas={arquivosDasVersoes}
      />
    </div>
  );
}
