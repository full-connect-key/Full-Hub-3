"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { NotificacaoNaTela } from "@/lib/dados/notificacoes";
import { cn } from "@/lib/utils";

import {
  marcarComoLida,
  marcarTodasComoLidas,
} from "@/app/(interno)/painel/_actions/notificacoes";

/**
 * O sino.
 *
 * O contador só aparece quando há algo: um "0" permanente em cima do sino vira
 * ruído e ensina a pessoa a ignorar justamente o lugar onde as notificações
 * vão aparecer.
 *
 * Abrir a lista NÃO marca tudo como lido. Quem abre está conferindo se chegou
 * algo, e muitas vezes fecha para resolver depois — zerar o contador nessa hora
 * apaga a lembrança. Clicar num aviso marca aquele; "marcar todas" existe para
 * quem quer limpar de propósito.
 *
 * `naoLidas` vem de uma contagem própria no servidor, não do tamanho da lista:
 * a lista traz as 20 mais recentes, e contar dentro dela diria "20" para quem
 * tem cinquenta por ler.
 */
export function SinoDeNotificacoes({
  notificacoes = [],
  naoLidas = 0,
}: {
  notificacoes?: NotificacaoNaTela[];
  naoLidas?: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [executando, iniciar] = useTransition();

  function lerTodas() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => marcarTodasComoLidas());
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  function abrirAviso(notificacao: NotificacaoNaTela) {
    setAberto(false);
    if (notificacao.lida_em) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() => marcarComoLida(notificacao.id));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            naoLidas > 0 ? `Notificações: ${naoLidas} por ler` : "Notificações"
          }
        >
          <Bell aria-hidden />
          {naoLidas > 0 ? (
            <span className="bg-destructive text-destructive-foreground absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      {/* Mesmo motivo do seletor de status: o popover e um role="dialog". */}
      <PopoverContent align="end" aria-label="Notificações" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notificações</p>
          {naoLidas > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={executando}
              onClick={lerTodas}
              className="h-7 text-xs"
            >
              <CheckCheck aria-hidden className="size-3.5" />
              Marcar todas
            </Button>
          ) : null}
        </div>

        {notificacoes.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-sm">
            Nada por aqui. Quando alguém precisar de você, aparece neste sino.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {notificacoes.map((notificacao) => {
              const conteudo = (
                <>
                  <div className="flex items-start gap-2">
                    {notificacao.lida_em ? (
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0" />
                    ) : (
                      <span
                        aria-hidden
                        className="bg-accent-strong mt-1.5 size-1.5 shrink-0 rounded-full"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm",
                          notificacao.lida_em ? "text-muted-foreground" : "font-medium",
                        )}
                      >
                        {notificacao.titulo}
                      </p>
                      {notificacao.corpo ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {notificacao.corpo}
                        </p>
                      ) : null}
                      <p className="text-text-muted mt-1 text-[11px]">
                        {notificacao.origem ? `${notificacao.origem.nome} · ` : ""}
                        {formatDistanceToNow(parseISO(notificacao.created_at), {
                          locale: ptBR,
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </>
              );

              return (
                <li key={notificacao.id} className="border-b last:border-b-0">
                  {notificacao.link ? (
                    <Link
                      href={notificacao.link}
                      onClick={() => abrirAviso(notificacao)}
                      className="hover:bg-accent block px-3 py-2.5 transition-colors"
                    >
                      {conteudo}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => abrirAviso(notificacao)}
                      className="hover:bg-accent block w-full px-3 py-2.5 text-left transition-colors"
                    >
                      {conteudo}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
