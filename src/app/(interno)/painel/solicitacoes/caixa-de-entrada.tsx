"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox, MessageSquare, Paperclip } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SeloDaSolicitacao } from "@/components/shared/selo-da-solicitacao";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  DIAS_ATE_DESTACAR,
  ROTULOS_PARA_A_EQUIPE,
  STATUS_DA_SOLICITACAO,
  diasEsperando,
  estaEsquecida,
} from "@/lib/dominio/solicitacoes";
import type { PedidoNaLista } from "@/lib/dados/solicitacoes";
import { cn } from "@/lib/utils";

/**
 * A fila do Atendimento.
 *
 * ---------------------------------------------------------------------------
 * **DO MAIS ANTIGO PARA O MAIS NOVO**, ao contrário de toda outra listagem do
 * produto. A pergunta desta tela não é "o que chegou?", é "quem está esperando
 * há mais tempo?" — e uma fila em que o pedido de ontem aparece acima do de
 * semana passada é a fila em que o de semana passada nunca é atendido. Quem
 * ordena é a consulta; aqui só se desenha.
 * ---------------------------------------------------------------------------
 *
 * **O destaque é a IDADE e não o status**, e por isso ele é uma borda e não
 * um selo a mais: o selo já diz em que pé está. O que a borda diz é outra
 * coisa — que este aqui está esperando demais.
 *
 * `--warning` e nunca `--danger`: um pedido de três dias não é um erro, é uma
 * cobrança. Vermelho numa fila que se abre todo dia treina o hábito de ignorar
 * vermelho — a mesma razão do alerta de 7 dias do portal.
 */
export function CaixaDeEntrada({
  pedidos,
  hojeISO,
  statusAtivo,
}: {
  pedidos: PedidoNaLista[];
  hojeISO: string;
  statusAtivo: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  function filtrar(status: string | null) {
    const proximos = new URLSearchParams(parametros.toString());
    if (status) proximos.set("status", status);
    else proximos.delete("status");
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  const esperando = pedidos.filter((p) => p.status === "nova" || p.status === "em_analise").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => filtrar(null)}
          aria-pressed={!statusAtivo}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            !statusAtivo ? "border-accent-strong bg-accent" : "hover:bg-accent",
          )}
        >
          Todos
        </button>
        {STATUS_DA_SOLICITACAO.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => filtrar(s)}
            aria-pressed={statusAtivo === s}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              statusAtivo === s ? "border-accent-strong bg-accent" : "hover:bg-accent",
            )}
          >
            {ROTULOS_PARA_A_EQUIPE[s]}
          </button>
        ))}

        {/* O CONTADOR CONTA SÓ O QUE ESPERA ALGUÉM, e nunca o total: um pedido
            já em produção não pede decisão nenhuma, e somá-lo faria o número
            cobrar uma ação que metade da fila não pede. */}
        {esperando > 0 ? (
          <span className="text-muted-foreground ms-auto text-sm">
            {esperando} esperando você
          </span>
        ) : null}
      </div>

      {pedidos.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhum pedido aqui"
          description="Quando um cliente abrir um pedido pelo Portal dele, ele aparece nesta fila — do que espera há mais tempo para o mais recente."
        />
      ) : (
        <div className="divide-y rounded-lg border">
          {pedidos.map((p) => {
            const dias = diasEsperando(p.created_at, hojeISO);
            const esquecido = estaEsquecida(p, hojeISO);

            return (
              <Link
                key={p.id}
                href={`/painel/solicitacoes/${p.id}`}
                className={cn(
                  "hover:bg-accent flex flex-wrap items-center gap-3 p-3 transition-colors",
                  esquecido && "border-warning border-s-2 bg-warning-soft/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.titulo}</p>
                  <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1 text-xs">
                    <span className="truncate">{p.empresa ?? "—"}</span>
                    {p.tipo ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">{p.tipo}</span>
                      </>
                    ) : null}
                    {p.demanda ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">Demanda: {p.demanda.titulo}</span>
                      </>
                    ) : null}
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

                {p.autor ? (
                  <UserAvatar name={p.autor.nome} src={p.autor.avatar_url} size="sm" />
                ) : null}

                {/* A IDADE POR EXTENSO, e não só a data: "há 4 dias" é o que
                    decide a ordem de quem atende; "23/09" pede a conta de
                    cabeça. A data exata fica no `title`. */}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    esquecido ? "text-warning font-medium" : "text-muted-foreground",
                  )}
                  title={format(parseISO(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                >
                  {dias === 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`}
                </span>

                <SeloDaSolicitacao status={p.status} lado="equipe" />
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Um pedido em aberto há {DIAS_ATE_DESTACAR} dias ou mais aparece em destaque.
      </p>
    </div>
  );
}
