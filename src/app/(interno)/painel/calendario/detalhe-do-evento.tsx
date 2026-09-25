"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarOff, ExternalLink, MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  COR_DO_TIPO_DE_EVENTO,
  ROTULOS_DE_TIPO_DE_EVENTO,
  type EventoDetalhado,
} from "@/lib/dominio/calendario";

import { cn } from "@/lib/utils";

import { excluirEvento } from "./acoes";

/**
 * O detalhe de um evento, em painel lateral.
 *
 * **Editar e excluir só aparecem para quem pode**, e não desligados com a
 * razão escrita — ao contrário do "Enviar ao cliente" do Social Media. A
 * diferença é o que o botão ensinaria: lá a regra é do fluxo e vale a pena
 * aprender ("falta o aval interno"); aqui é de perfil, e um botão desligado
 * dizendo "você não é do Atendimento" não ensina nada que a pessoa possa
 * mudar.
 */
export function DetalheDoEvento({
  evento,
  podeEscrever,
  aoFechar,
  aoEditar,
}: {
  evento: EventoDetalhado;
  podeEscrever: boolean;
  aoFechar: () => void;
  aoEditar: () => void;
}) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  const periodo =
    evento.dataInicio === evento.dataFim
      ? format(parseISO(evento.dataInicio), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : `${format(parseISO(evento.dataInicio), "dd/MM")} a ${format(parseISO(evento.dataFim), "dd/MM/yyyy")}`;

  const horario =
    !evento.diaInteiro && evento.horaInicio
      ? ` · ${evento.horaInicio.slice(0, 5)}${evento.horaFim ? ` às ${evento.horaFim.slice(0, 5)}` : ""}`
      : "";

  return (
    <Sheet open onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{evento.nome}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium",
                COR_DO_TIPO_DE_EVENTO[evento.tipo],
              )}
            >
              {ROTULOS_DE_TIPO_DE_EVENTO[evento.tipo]}
            </span>
            {evento.cliente ? (
              <span className="text-text-muted text-xs">{evento.cliente}</span>
            ) : (
              <span className="text-text-muted text-xs">Da agência</span>
            )}
          </div>

          <p className="text-sm">
            {periodo}
            {horario}
          </p>

          {evento.local ? (
            <p className="text-text-secondary flex items-center gap-1.5 text-sm">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {evento.local}
            </p>
          ) : null}

          {evento.link ? (
            <a
              href={evento.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-strong flex items-center gap-1.5 text-sm hover:underline"
            >
              <ExternalLink aria-hidden className="size-4 shrink-0" />
              Abrir o link
            </a>
          ) : null}

          {evento.descricao ? (
            <p className="text-text-secondary text-sm whitespace-pre-wrap">{evento.descricao}</p>
          ) : null}

          {evento.bloqueiaFerias ? (
            <p className="bg-warning-soft text-warning flex items-start gap-2 rounded-md px-3 py-2 text-xs">
              <CalendarOff aria-hidden className="mt-0.5 size-4 shrink-0" />
              Estes dias ficam bloqueados no Full Days
              {evento.participantes.length > 0 ? " para quem vai." : " para toda a equipe."}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <h3 className="text-text-muted text-xs font-medium tracking-wide uppercase">
              Quem vai
            </h3>
            {evento.participantes.length === 0 ? (
              <p className="text-text-secondary text-sm">
                Toda a agência — ninguém foi marcado em particular.
              </p>
            ) : (
              <ul className="space-y-1">
                {evento.participantes.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <UserAvatar name={p.nome} src={p.avatar_url} size="sm" />
                    {p.nome}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {podeEscrever ? (
            <div className="flex gap-2 border-t pt-4">
              <Button variant="outline" onClick={aoEditar} disabled={executando}>
                <Pencil aria-hidden className="size-4" />
                Editar
              </Button>
              <ConfirmDialog
                title="Excluir este evento?"
                description={`"${evento.nome}" sai do calendário de todo mundo. Se ele bloqueava dias no Full Days, eles voltam a ficar livres.`}
                confirmLabel="Excluir"
                onConfirm={() =>
                  iniciar(async () => {
                    const r = await chamarAcao(() => excluirEvento(evento.id));
                    if (r.ok) {
                      toast.success(r.mensagem);
                      aoFechar();
                      router.refresh();
                    } else {
                      toast.error(r.error);
                    }
                  })
                }
                trigger={
                  <Button variant="outline" disabled={executando}>
                    Excluir
                  </Button>
                }
              />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
