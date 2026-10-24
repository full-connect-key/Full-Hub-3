import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, TriangleAlert } from "lucide-react";

import { ArvoreDeEntregaveis } from "@/components/portal/arvore-de-entregaveis";
import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import { Button } from "@/components/ui/button";
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
  esperandoOCliente,
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

  const esperando = esperandoOCliente(itens);
  /**
   * "EM ANDAMENTO" É O QUE NÃO ESTÁ NEM PRONTO NEM NA MÃO DELE.
   *
   * Ela é derivada por subtração e não por uma lista de status, e é de
   * propósito: `content_status` tem sete valores, três deles — "em produção",
   * "aguardando informações" e "stand by" — que do lado de fora dizem a mesma
   * coisa (*a Full está trabalhando nisso*), e um quarto que pode nascer
   * amanhã cairia fora de toda conta sem ninguém notar. Subtraindo, todo valor
   * novo entra aqui, que é a resposta certa para o cliente.
   */
  const emAndamento = conta.total - conta.aprovados - esperando;

  const alerta = alertaDePrazo(campanha, pendentes(itens), hoje);
  const restantes = diasAte(campanha.dataFim, hoje);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={base}
            className="text-text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Voltar às campanhas
          </Link>

          {/* ---------------------------------------------------------------
              "+ NOVA SOLICITAÇÃO NESTA CAMPANHA" (0112).

              Ele é um LINK e não um botão com estado, porque o painel mora na
              URL: `?novo=1&campanha={id}` é um endereço que abre o pedido já
              dentro desta campanha — e é justamente por isso que o estado do
              painel não mora em estado de componente.

              **E ele só aparece em `/portal`, nunca na visualização
              administrativa.** `base` começa com `/portal/{slug}` quando quem
              olha é a equipe, e ali o painel não é montado: abrir um pedido em
              nome do cliente seria a agência escrevendo como se fosse ele —
              o caminho é a fila do painel, onde o pedido nasce assinado.
              --------------------------------------------------------------- */}
          {base === "/portal/campanhas" ? (
            // `asChild` E NÃO CLASSES À MÃO: o par de hover da pílula preta é
            // medido (19,43:1) e mora no `Button`. Reescrevê-lo aqui seria a
            // segunda definição do mesmo botão, e a que divergisse é esta.
            <Button asChild>
              <Link
                href={`/portal/solicitacoes?novo=1&campanha=${campanha.id}`}
              >
                <Plus aria-hidden />
                Nova solicitação nesta campanha
              </Link>
            </Button>
          ) : null}
        </div>

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
          <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">{campanha.nome}</h1>
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

      {/* ---------------------------------------------------------------------
          OS QUATRO NÚMEROS, E A BARRA CONTINUA EMBAIXO DELES.

          Eles ENTRAM NO LUGAR da linha que contava — "9 de 12 materiais
          aprovados · 75%" era o rótulo da barra, e é exatamente o que os
          ladrilhos dizem agora com dois fatos a mais: quantos estão na mão da
          agência e quantos estão na dele. É a decisão do Início do portal: o
          ladrilho substitui o texto que repetia, nunca se soma a ele.

          **A BARRA FICA porque ela não é um número, é uma FORMA.** Ela
          responde "quanto falta" de relance, antes de alguém ler quatro
          algarismos — e o percentual mora nela, e não no ladrilho de
          "Aprovados", para o mesmo fato não aparecer duas vezes a dois
          centímetros de distância.

          **"ESPERANDO VOCÊ" É O ÚNICO EM ÂMBAR, e o único que é link.** Os
          outros três respondem onde o trabalho está; este diz que alguém está
          esperando — e `--warning` e nunca `--danger`, porque material
          esperando decisão é o estado normal de uma campanha, não um erro.
          --------------------------------------------------------------------- */}
      {conta.total > 0 ? (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CartaoDeNumero rotulo="Materiais" valor={conta.total} />
            <CartaoDeNumero rotulo="Em produção" valor={emAndamento} />
            <CartaoDeNumero
              rotulo="Esperando você"
              valor={esperando}
              tom={esperando > 0 ? "atencao" : "neutro"}
              href={esperando > 0 ? "#materiais" : undefined}
            />
            <CartaoDeNumero
              rotulo="Aprovados"
              valor={conta.aprovados}
              tom={conta.aprovados === conta.total ? "bom" : "neutro"}
            />
          </div>

          <div className="bg-surface-card rounded-card shadow-cartao space-y-3 border p-4">
            <BarraDeProgresso
              nome="Materiais aprovados"
              valor={conta.aprovados}
              total={conta.total}
              tom={conta.aprovados === conta.total ? "sucesso" : "marca"}
              rotulo={`${conta.percentual}% aprovado`}
            />
            {/* A LINHA DOS DIAS SOME QUANDO HÁ ALERTA, e foi a imagem que
                mostrou: `alertaDePrazo()` começa com *"Faltam 6 dias para o
                fim da campanha"* e acrescenta quantos materiais faltam — ele
                CONTÉM esta frase. Os dois a sessenta pixels de distância são
                o mesmo fato duas vezes, e o de cima é o que diz menos. */}
            {alerta ? null : (
              <p className="text-text-muted text-sm tabular-nums">
                {textoDosDias(restantes)}
              </p>
            )}
          </div>
        </section>
      ) : (
        // SEM MATERIAL ENVIADO não há quatro números para mostrar: quatro
        // zeros numa fileira leem como campanha que deu errado, e o que está
        // acontecendo é que ela está sendo montada. A frase diz isso, e os
        // dias restantes continuam, porque eles existem desde o planejamento.
        <section className="bg-surface-card rounded-card shadow-cartao space-y-3 border p-4">
          <p className="text-text-muted text-sm">
            Os materiais desta campanha ainda estão em produção.
          </p>
          <p className="text-text-muted text-sm tabular-nums">
            {textoDosDias(restantes)}
          </p>
        </section>
      )}

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

      <section id="materiais" className="scroll-mt-20 space-y-4">
        <h2 className="text-xl font-bold tracking-[-0.02em]">Materiais</h2>

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
