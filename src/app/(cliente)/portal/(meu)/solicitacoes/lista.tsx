"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquarePlus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { QuadroDePedidos } from "@/components/shared/quadro-de-pedidos";
import { Button } from "@/components/ui/button";
import type { PedidoNaLista } from "@/lib/dados/solicitacoes";
import {
  COLUNAS_DO_QUADRO_DO_CLIENTE,
  TETO_DA_COLUNA_ENCERRADA,
  explicacaoDoPedido,
  faseDoPedido,
  type FaseDoPedido,
} from "@/lib/dominio/solicitacoes";

/**
 * O card de um pedido, na tela do cliente.
 *
 * ---------------------------------------------------------------------------
 * **O QUE ELE RESPONDE É OUTRA COISA que o card da agência**, e é por isso que
 * eles são dois: lá a pergunta é de quem é o pedido e há quanto tempo ele
 * espera; aqui a empresa é a dele, e o que ele quer saber é o que pediu, para
 * quando, e o que está acontecendo agora.
 *
 * **O SELO DE STATUS SAIU, e a coluna é que o diz.** Ele era a última célula da
 * linha da tabela, e num quadro ele seria a mesma palavra duas vezes a dois
 * centímetros do cabeçalho da coluna — é a decisão do selo dentro do grupo na
 * Lista de Minhas Tasks, e a do card do board, que não repete a coluna.
 *
 * **A FRASE FICA, e ela é o que o selo não dizia.** "Em análise" não responde
 * se falta alguma coisa dele — e faltar alguma coisa dele é justamente o caso
 * em que a conversa existe. Ela vem de `explicacaoDoPedido()`, que sabe da
 * fase: o status de um pedido em ajuste continua sendo `em_andamento`, e a
 * frase do mapa de status diria "já está sendo feito" debaixo da coluna "Em
 * ajustes".
 * ---------------------------------------------------------------------------
 */
function CardDoPedido({
  pedido,
  fase,
  base,
}: {
  pedido: PedidoNaLista;
  fase: FaseDoPedido;
  base: string;
}) {
  const p = pedido;

  // A LINHA DE METADADOS É UMA, separada por ponto, e não as quatro colunas da
  // tabela que saiu: numa coluna de quadro não há largura para colunas, e o
  // que elas diziam — tipo, campanha, anexos, conversa — cabe numa frase.
  const extras = [
    p.tipo,
    p.campanha,
    p.quantosAnexos > 0
      ? `${p.quantosAnexos} anexo${p.quantosAnexos > 1 ? "s" : ""}`
      : null,
    p.quantasMensagens > 0
      ? `${p.quantasMensagens} mensage${p.quantasMensagens > 1 ? "ns" : "m"}`
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={`${base}/solicitacoes/${p.id}`}
      className="bg-surface-card rounded-card shadow-cartao hover:border-accent-strong block min-w-0 border p-3 transition-colors"
    >
      {/* DUAS LINHAS DE TÍTULO E NÃO UMA TRUNCADA: numa coluna estreita o
          título é a única coisa que identifica o pedido, e cortado no meio ele
          não identifica nenhum. */}
      <p className="line-clamp-2 text-sm font-semibold">{p.titulo}</p>

      <p className="text-text-muted mt-1 truncate text-xs">
        {format(parseISO(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
        {p.autor?.nome ? ` · ${p.autor.nome}` : ""}
      </p>

      {extras.length > 0 ? (
        <p className="text-text-muted truncate text-xs">
          {extras.join(" · ")}
        </p>
      ) : null}

      {/* "PRAZO DESEJADO" E NÃO "PRAZO", e a palavra inteira importa:
          `data_desejada` é o que o cliente gostaria, e `tasks.data_fim` é o que
          a agência assume. Escrito só "prazo" ele seria lido como combinado —
          que é exatamente o que o campo do formulário explica por extenso
          embaixo dele para não ser. E ele só existe quando há: um travessão em
          nove de dez cards gasta uma linha para dizer que não há o que dizer. */}
      {p.data_desejada ? (
        <p className="text-text-muted mt-1 text-xs tabular-nums">
          Prazo desejado:{" "}
          {format(parseISO(p.data_desejada), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      ) : null}

      <p className="text-text-secondary mt-2 text-xs">
        {explicacaoDoPedido(p.status, fase)}
      </p>
    </Link>
  );
}

/**
 * Os pedidos da empresa, em QUADRO.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"e o cliente deve visualizar as solicitações dele, como
 * kanban"*.
 *
 * **ERAM ABAS POR FASE, e o quadro é a mesma separação com as cinco à vista.**
 * As abas respondiam a pergunta certa e cobravam um clique por resposta: para
 * saber se alguma coisa voltou para ajuste era preciso escolher a aba e perder
 * de vista o resto. Com as colunas, as cinco fases e a contagem de cada uma
 * estão na tela ao mesmo tempo — e o `?fase=` saiu, porque a coluna é ele.
 *
 * **A ORDEM É DO MAIS NOVO PARA O MAIS ANTIGO**, ao contrário da fila do lado
 * de cá: a pergunta dele é "o que eu mandei?", e a resposta começa pelo último.
 * Quem ordena é a consulta.
 * ---------------------------------------------------------------------------
 */
export function ListaDePedidos({
  pedidos,
  base,
  podeAbrir,
  somenteLeitura = false,
}: {
  pedidos: PedidoNaLista[];
  /** `/portal` para o cliente, `/portal/{slug}` para a visualização da equipe. */
  base: string;
  podeAbrir: boolean;
  somenteLeitura?: boolean;
}) {
  // O PAR `{p, f}` E NÃO SÓ O PEDIDO: a frase do card depende da fase, e
  // recalculá-la lá dentro seria a segunda conta do mesmo fato.
  const comFase = pedidos.map((p) => ({
    p,
    f: faseDoPedido(p.status, p.demandaEmAjustes),
  }));

  /**
   * **"RECUSADO" SÓ APARECE QUANDO TEM ALGUM**, que é a regra que as abas já
   * seguiam: uma coluna permanentemente vazia com esse nome é um lembrete
   * diário de um problema que não existe. Quase nenhuma conta tem um — e a que
   * tem precisa de onde ler o motivo, que é a única coisa que explica o que
   * aconteceu.
   */
  const colunas = COLUNAS_DO_QUADRO_DO_CLIENTE.filter(
    (c) => c.chave !== "recusado" || comFase.some((x) => x.f === "recusado"),
  );

  return (
    <div className="space-y-4">
      {/* O BOTÃO FICA SOZINHO NA LINHA, agora que as abas saíram, e à
          ESQUERDA: ele era empurrado para a direita por uma fileira de abas que
          dividia a linha com ele, e sem ela um botão solto na borda direita de
          uma tela de 1400px fica longe de tudo o que ele cria. */}
      {podeAbrir && !somenteLeitura ? (
        <Button asChild>
          {/* `?novo=1` E NÃO UMA ROTA: o formulário é painel lateral, e o
              estado dele mora na URL como todo filtro de listagem — é o que faz
              "abre o pedido já nesta campanha" poder ser um link. */}
          <Link href={`${base}/solicitacoes?novo=1`} scroll={false}>
            <MessageSquarePlus aria-hidden />
            Nova solicitação
          </Link>
        </Button>
      ) : null}

      {/* A CONTA DESLIGADA DIZ A QUEM FALAR, em vez de só esconder o botão.
          Um botão que some ensina que a coisa não existe; uma frase ensina
          onde ela está. É a decisão do "Enviar ao cliente" desligado com a
          razão escrita, no Social Media. */}
      {!podeAbrir && !somenteLeitura ? (
        <p className="bg-neutral-soft text-text-secondary rounded-lg p-3 text-sm">
          Os pedidos por aqui estão desligados nesta conta. Fale com o seu
          atendimento na Full — o que você já pediu continua abaixo.
        </p>
      ) : null}

      {pedidos.length === 0 ? (
        /* O QUADRO NÃO É DESENHADO NO VAZIO, ao contrário do que ele faz com
           uma coluna sozinha: quatro colunas tracejadas dizendo "nada" cada
           uma são quatro vezes a mesma frase onde uma basta. */
        <EmptyState
          icon={MessageSquarePlus}
          title="Nada pedido ainda"
          description={
            podeAbrir && !somenteLeitura
              ? "Quando você precisar de alguma coisa, peça por aqui: fica registrado, com data, e a gente responde no mesmo lugar."
              : "Nenhum pedido foi aberto nesta conta."
          }
        />
      ) : (
        <QuadroDePedidos
          colunas={colunas}
          itens={comFase}
          colunaDe={(x) => x.f}
          idDe={(x) => x.p.id}
          teto={TETO_DA_COLUNA_ENCERRADA}
          card={(x) => (
            <CardDoPedido pedido={x.p} fase={x.f} base={base} />
          )}
        />
      )}
    </div>
  );
}
