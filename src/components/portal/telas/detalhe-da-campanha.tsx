import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";

import { ArvoreDeEntregaveis } from "@/components/portal/arvore-de-entregaveis";
import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { CapaDoCartao } from "@/components/shared/capa-do-cartao";
import { EmptyState } from "@/components/shared/empty-state";
import {
  entregaveisDaCampanha,
  obterCampanha,
  urlsDosArquivos,
} from "@/lib/dados/campanhas";
import {
  alertaDePrazo,
  diasAte,
  duracaoEmDias,
  emArvore,
  folhas,
  pendentes,
  periodoCurto,
  progresso,
  ROTULO_DA_CAMPANHA,
} from "@/lib/dominio/campanhas";

/**
 * A campanha inteira: onde ela está, e o que ainda depende do cliente.
 *
 * **O cabeçalho responde antes da árvore.** Quem abre quer saber quanto falta
 * e quanto tempo resta — a lista de quarenta materiais é o detalhe. Por isso
 * a contagem, a barra e os dias restantes vêm primeiro, e o alerta logo
 * depois, quando há alerta.
 *
 * **Tudo conta só as FOLHAS.** Um grupo com quinze sub-itens é uma linha aqui
 * e quinze entregas no trabalho.
 */
export async function DetalheDaCampanha({
  campanhaId,
  base,
  clienteId,
  hoje,
}: {
  campanhaId: string;
  base: string;
  clienteId: string | null;
  hoje: string;
}) {
  const campanha = await obterCampanha(campanhaId, clienteId ?? undefined);

  // 404 E NÃO 403, como no post: para quem não pode ver, a campanha não
  // existe. Um 403 confirmaria que existe uma campanha com aquele id.
  if (!campanha) notFound();

  const entregaveis = await entregaveisDaCampanha(campanha.id);
  const arvore = emArvore(entregaveis);
  const itens = folhas(arvore);
  const conta = progresso(itens);

  const miniaturas = await urlsDosArquivos(itens.map((i) => i.thumbnailUrl));

  const alerta = alertaDePrazo(campanha, pendentes(itens), hoje);
  const restantes = diasAte(campanha.dataFim, hoje);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href={base}
          className="text-text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Voltar às campanhas
        </Link>

        {/* A MESMA CAPA DO CARTÃO (0050). Quem clicou no cartão clicou na
            imagem: chegar a uma tela sem ela é perder a confirmação de que
            abriu a campanha certa.

            **Aqui ela é mais BAIXA, e não é capricho.** Em 1280px a mesma
            faixa 16/6 dá 310px de altura, e o título, o período e a barra de
            progresso caem abaixo da dobra — numa tela cuja primeira pergunta
            é "quanto falta". No cartão ela é o que identifica; aqui é só a
            confirmação de que se chegou na campanha certa. */}
        <CapaDoCartao
          url={campanha.capaAssinada}
          alt={campanha.nome}
          className="max-h-48"
        />

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{campanha.nome}</h1>
          <p className="text-text-muted text-sm tabular-nums">
            {periodoCurto(campanha.dataInicio, campanha.dataFim)}
            <span aria-hidden> · </span>
            {duracaoEmDias(campanha.dataInicio, campanha.dataFim)} dias
            <span aria-hidden> · </span>
            <span>{ROTULO_DA_CAMPANHA[campanha.status]}</span>
          </p>
          {campanha.descricao ? (
            <p className="text-sm">{campanha.descricao}</p>
          ) : null}
        </div>
      </div>

      <section className="bg-surface-card space-y-3 rounded-xl border p-4">
        {conta.total > 0 ? (
          <BarraDeProgresso
            nome="Materiais aprovados"
            valor={conta.aprovados}
            total={conta.total}
            tom={conta.aprovados === conta.total ? "sucesso" : "marca"}
            rotulo={`${conta.aprovados} de ${conta.total} ${
              conta.total === 1 ? "material aprovado" : "materiais aprovados"
            } · ${conta.percentual}%`}
          />
        ) : (
          <p className="text-text-muted text-sm">
            Os materiais desta campanha ainda estão em produção.
          </p>
        )}

        <p className="text-text-muted text-sm tabular-nums">
          {textoDosDias(restantes)}
        </p>
      </section>

      {/* O ALERTA É `--warning`, NUNCA `--danger`. Ele avisa que o tempo está
          acabando com material na mão do cliente — é um lembrete, não um erro,
          e vermelho num portal que a pessoa abre uma vez por semana treina
          exatamente o hábito de ignorar vermelho. */}
      {alerta ? (
        <p
          role="status"
          className="bg-warning-soft text-warning flex items-start gap-2 rounded-xl p-4 text-sm"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {alerta}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Materiais</h2>

        {arvore.length === 0 ? (
          <EmptyState
            title="Nada enviado ainda"
            description="Assim que a Full enviar o primeiro material desta campanha, ele aparece aqui para você decidir."
          />
        ) : (
          <ArvoreDeEntregaveis
            arvore={arvore}
            base={`${base}/${campanha.id}`}
            hoje={hoje}
            miniaturas={miniaturas}
          />
        )}
      </section>
    </div>
  );
}

/**
 * Os dias restantes, e o que dizer quando não há mais.
 *
 * Um número negativo em "faltam -3 dias" é o tipo de frase que faz a pessoa
 * parar de confiar no resto da tela.
 */
function textoDosDias(dias: number): string {
  if (dias < 0) {
    const passados = -dias;
    return `A campanha terminou há ${passados} ${passados === 1 ? "dia" : "dias"}.`;
  }
  if (dias === 0) return "A campanha termina hoje.";
  return `Faltam ${dias} ${dias === 1 ? "dia" : "dias"} para o fim da campanha.`;
}
