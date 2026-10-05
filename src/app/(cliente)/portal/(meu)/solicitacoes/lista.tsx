"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, MessageSquarePlus, Paperclip } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SeloDaSolicitacao } from "@/components/shared/selo-da-solicitacao";
import { Button } from "@/components/ui/button";
import type { PedidoNaLista } from "@/lib/dados/solicitacoes";
import {
  FASES_DO_PEDIDO,
  ROTULOS_DE_FASE,
  explicacaoDoPedido,
  faseDoPedido,
  type FaseDoPedido,
} from "@/lib/dominio/solicitacoes";
import { cn } from "@/lib/utils";

/**
 * O VAZIO DE CADA ABA DIZ OUTRA COISA.
 *
 * "Nada pedido ainda" numa conta com oito pedidos em produção seria a tela
 * afirmando que nada existe — é a decisão do vazio filtrado da grade de
 * campanhas. Cada frase responde a pergunta daquela aba.
 */
const VAZIO_DA_FASE: Record<FaseDoPedido, string> = {
  analise:
    "Nenhum pedido esperando a gente olhar. As outras abas continuam acima.",
  producao: "Nada em produção neste momento.",
  ajustes: "Nenhum pedido voltou para ajuste. É a resposta boa.",
  entregue: "Nada concluído por aqui ainda.",
  recusado: "Nenhum pedido recusado.",
};

/**
 * Os pedidos da empresa, na tela do cliente.
 *
 * **Do mais novo para o mais antigo**, ao contrário da fila do lado de cá: a
 * pergunta dele é "o que eu mandei?", e a resposta começa pelo último.
 *
 * **O selo vem com a frase**, e não sozinho. "Em análise" não diz se falta
 * alguma coisa dele — e faltar alguma coisa dele é justamente o caso em que a
 * conversa existe.
 */
export function ListaDePedidos({
  pedidos,
  base,
  podeAbrir,
  somenteLeitura = false,
  fase = null,
}: {
  pedidos: PedidoNaLista[];
  /** `/portal` para o cliente, `/portal/{slug}` para a visualização da equipe. */
  base: string;
  podeAbrir: boolean;
  somenteLeitura?: boolean;
  /** A aba escolhida, já validada pela página. `null` é "Todos". */
  fase?: FaseDoPedido | null;
}) {
  // ---------------------------------------------------------------------------
  // AS ABAS POR FASE — decisão do usuário.
  //
  // A CONTAGEM SAI DA MESMA LISTA QUE DESENHA AS LINHAS, e é por isso que o
  // recorte acontece aqui em vez de na consulta: com o `select` já filtrado, o
  // número das outras abas não existiria. É o contador de Minhas Tasks e a
  // coluna de clientes das campanhas, pela terceira vez.
  //
  // **"RECUSADO" SÓ APARECE QUANDO TEM ALGUM.** O usuário nomeou quatro abas, e
  // `recusada` não cabe em nenhuma das quatro: em "Entregue" ela afirmaria que
  // foi entregue, e fora das abas o pedido desapareceria da tela de quem o
  // abriu — junto com o motivo, que é a única coisa que explica o que
  // aconteceu. Quase nenhuma conta tem um.
  //
  // **"TODOS" É A PRIMEIRA, E É O PADRÃO**, e a razão é o que a pessoa vê ao
  // chegar: abrindo em "Em análise", uma conta cujos três pedidos estão em
  // produção cairia numa tela vazia tendo três pedidos. A separação que ele
  // pediu continua inteira — é um clique, com a contagem à vista.
  // ---------------------------------------------------------------------------
  const comFase = pedidos.map((p) => ({
    p,
    f: faseDoPedido(p.status, p.demandaEmAjustes),
  }));
  const quantas = (f: FaseDoPedido) => comFase.filter((x) => x.f === f).length;

  const abas = FASES_DO_PEDIDO.filter(
    (f) => f !== "recusado" || quantas(f) > 0,
  );
  // O PAR `{p, f}` E NÃO SÓ O PEDIDO: a frase da linha depende da fase, e
  // recalculá-la no `map` de baixo seria a segunda conta do mesmo fato.
  const visiveis = fase ? comFase.filter((x) => x.f === fase) : comFase;

  const classe = (ativa: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
      ativa
        ? "bg-surface-card text-text-primary shadow-cartao font-semibold"
        : "text-text-secondary hover:text-text-primary",
    );

  return (
    <div className="space-y-4">
      {/* O SCROLL É DO `nav` E O `min-w-max` É DO `ul`: as duas coisas na mesma
          tag não fazem nada — um elemento com `min-w-max` tem exatamente a
          largura do conteúdo e nunca transborda a si mesmo, quem transborda é
          o pai. Foi assim que uma barra de abas do painel empurrou a página
          inteira para os lados por vários meses. */}
      {/* O BOTÃO DIVIDE A LINHA COM AS ABAS, e não fica numa faixa só dele:
          solto, ele gastava uma linha inteira entre o título e a primeira
          decisão da tela — e em 375px, onde a altura é tudo, uma linha é um
          cartão a menos à vista. É o lugar que a barra de contexto do painel
          dá às ações do módulo. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {pedidos.length > 0 ? (
          <nav
            aria-label="Pedidos por fase"
            className="-mx-1 min-w-0 overflow-x-auto px-1"
          >
            <ul className="bg-muted inline-flex min-w-max gap-1 rounded-xl p-1">
              <li>
                <Link
                  href={`${base}/solicitacoes`}
                  className={classe(fase === null)}
                >
                  Todos
                  <span className="text-text-muted tabular-nums">
                    {pedidos.length}
                  </span>
                </Link>
              </li>
              {abas.map((f) => (
                <li key={f}>
                  <Link
                    href={`${base}/solicitacoes?fase=${f}`}
                    className={classe(fase === f)}
                    aria-current={fase === f ? "page" : undefined}
                  >
                    {ROTULOS_DE_FASE[f]}
                    <span className="text-text-muted tabular-nums">
                      {quantas(f)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <span />
        )}

        {podeAbrir && !somenteLeitura ? (
          <Button asChild className="ml-auto">
            <Link href={`${base}/solicitacoes/novo`}>
              <MessageSquarePlus aria-hidden />
              Pedir alguma coisa
            </Link>
          </Button>
        ) : null}
      </div>

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

      {visiveis.length === 0 ? (
        <EmptyState
          icon={MessageSquarePlus}
          title={
            fase ? `Nada em "${ROTULOS_DE_FASE[fase]}"` : "Nada pedido ainda"
          }
          description={
            fase
              ? VAZIO_DA_FASE[fase]
              : podeAbrir && !somenteLeitura
                ? "Quando você precisar de alguma coisa, peça por aqui: fica registrado, com data, e a gente responde no mesmo lugar."
                : "Nenhum pedido foi aberto nesta conta."
          }
        />
      ) : (
        <ul className="space-y-[9px]">
          {visiveis.map(({ p, f }) => (
            <li key={p.id}>
              <Link
                href={`${base}/solicitacoes/${p.id}`}
                className="bg-surface-card rounded-card shadow-cartao hover:border-accent-strong flex flex-wrap items-center gap-3 border p-3 transition-colors sm:p-4"
              >
                {/* `basis-56` É O PISO, e sem ele o título é o ÚNICO a
                    ceder largura: o selo, a data e os contadores são todos
                    `shrink-0`, e em 375px "Arte para o Dia das Mães" saía
                    "Arte para o Dia da…" com a linha inteira cabendo. Com o
                    piso, o resto quebra para a linha de baixo — que é o que o
                    `flex-wrap` do pai está aqui para fazer. */}
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium">{p.titulo}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {explicacaoDoPedido(p.status, f)}
                  </p>
                </div>

                {p.quantosAnexos > 0 ? (
                  <span
                    className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                    title={`${p.quantosAnexos} arquivo(s)`}
                  >
                    <Paperclip aria-hidden className="size-3.5" />
                    {p.quantosAnexos}
                  </span>
                ) : null}

                {p.quantasMensagens > 0 ? (
                  <span
                    className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                    title={`${p.quantasMensagens} mensagem(ns)`}
                  >
                    <MessageSquare aria-hidden className="size-3.5" />
                    {p.quantasMensagens}
                  </span>
                ) : null}

                <span className="text-muted-foreground text-xs tabular-nums">
                  {format(parseISO(p.created_at), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </span>

                {/* O SELO SOME DENTRO DA ABA, porque o cabeçalho já o disse —
                    é a decisão da Lista de Minhas Tasks, e ele volta em
                    "Todos", que é onde não há cabeçalho nenhum. Pior que
                    repetir: na aba "Em análise" o selo de um pedido `nova` diz
                    "Enviado", e duas palavras diferentes para a mesma linha a
                    um centímetro de distância é a tela se desmentindo. A frase
                    de baixo continua dizendo o que falta. */}
                {fase === null ? (
                  <SeloDaSolicitacao status={p.status} lado="cliente" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
