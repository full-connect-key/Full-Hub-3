"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Lightbulb } from "lucide-react";
import { toast } from "sonner";

import {
  enviarSugestao,
  marcarSugestaoComoVista,
} from "@/app/(interno)/painel/_actions/sugestoes";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { SugestaoNaTela } from "@/lib/dados/sugestoes";

/**
 * SUGESTÕES PARA O HUB, ao lado do sino (0158).
 *
 * Decisão do usuário: *"uma aba chamada sugestões, lá em cima do lado de
 * notificações, para as pessoas sugerirem mudanças ou coisas necessárias"*.
 *
 * **Todo mundo da equipe escreve; só a gestão lê a lista** — `paraLer` vem
 * nulo para quem não é gestão, e aí o popover é só o campo. O número no botão
 * conta as que a gestão ainda não marcou como vistas, e some no zero.
 */
export function Sugestoes({ paraLer }: { paraLer: SugestaoNaTela[] | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [executando, iniciar] = useTransition();

  const novas = paraLer?.filter((s) => !s.vista).length ?? 0;

  function enviar() {
    iniciar(async () => {
      const r = await chamarAcao(() => enviarSugestao(texto));
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.mensagem);
      setTexto("");
      router.refresh();
    });
  }

  function marcar(id: string) {
    iniciar(async () => {
      const r = await chamarAcao(() => marcarSugestaoComoVista(id));
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="disco-da-topbar relative rounded-full"
          aria-label={novas > 0 ? `Sugestões: ${novas} por ver` : "Sugestões"}
        >
          <Lightbulb aria-hidden />
          {novas > 0 ? (
            <span className="bg-action text-action-foreground absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
              {novas > 99 ? "99+" : novas}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" aria-label="Sugestões" className="w-80 p-0 sm:w-96">
        <div className="space-y-2 border-b p-3">
          <p className="text-sm font-medium">Sugestões para o Full Hub</p>
          <Textarea
            aria-label="Sua sugestão"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="O que poderia mudar ou o que está faltando?"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-text-muted text-xs">Quem lê são os sócios e os desenvolvedores.</p>
            <Button size="sm" disabled={executando || texto.trim().length < 3} onClick={enviar}>
              Enviar
            </Button>
          </div>
        </div>

        {paraLer ? (
          paraLer.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Nenhuma sugestão ainda.
            </p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {paraLer.map((s) => (
                <li key={s.id} className="space-y-1 px-3 py-2.5">
                  <p className="text-text-primary text-sm break-words whitespace-pre-wrap">
                    {s.texto}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-text-muted text-xs">
                      {s.autor} · {format(parseISO(s.criadaEm), "dd/MM/yy", { locale: ptBR })}
                    </p>
                    {s.vista ? (
                      <span className="text-text-muted inline-flex items-center gap-1 text-xs">
                        <Check aria-hidden className="size-3" />
                        Vista
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        disabled={executando}
                        onClick={() => marcar(s.id)}
                      >
                        Marcar como vista
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
