"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, MessageSquarePlus, Paperclip } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SeloDaSolicitacao } from "@/components/shared/selo-da-solicitacao";
import { Button } from "@/components/ui/button";
import type { PedidoNaLista } from "@/lib/dados/solicitacoes";
import { EXPLICACAO_PARA_O_CLIENTE } from "@/lib/dominio/solicitacoes";

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
}: {
  pedidos: PedidoNaLista[];
  /** `/portal` para o cliente, `/portal/{slug}` para a visualização da equipe. */
  base: string;
  podeAbrir: boolean;
  somenteLeitura?: boolean;
}) {
  return (
    <div className="space-y-4">
      {podeAbrir && !somenteLeitura ? (
        <div className="flex justify-end">
          <Button asChild>
            <Link href={`${base}/solicitacoes/novo`}>
              <MessageSquarePlus aria-hidden />
              Pedir alguma coisa
            </Link>
          </Button>
        </div>
      ) : null}

      {/* A CONTA DESLIGADA DIZ A QUEM FALAR, em vez de só esconder o botão.
          Um botão que some ensina que a coisa não existe; uma frase ensina
          onde ela está. É a decisão do "Enviar ao cliente" desligado com a
          razão escrita, no Social Media. */}
      {!podeAbrir && !somenteLeitura ? (
        <p className="bg-neutral-soft text-text-secondary rounded-lg p-3 text-sm">
          Os pedidos por aqui estão desligados nesta conta. Fale com o seu atendimento na Full — o
          que você já pediu continua abaixo.
        </p>
      ) : null}

      {pedidos.length === 0 ? (
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
        <ul className="divide-y rounded-lg border">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link
                href={`${base}/solicitacoes/${p.id}`}
                className="hover:bg-accent flex flex-wrap items-center gap-3 p-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.titulo}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {EXPLICACAO_PARA_O_CLIENTE[p.status]}
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
                  {format(parseISO(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>

                <SeloDaSolicitacao status={p.status} lado="cliente" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
