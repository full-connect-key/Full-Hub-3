"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CornerDownRight, Lock, PartyPopper } from "lucide-react";

import Link from "next/link";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import type { ItemDoDia } from "@/lib/dados/minhas-tasks";
import { cn } from "@/lib/utils";

/**
 * Meu dia.
 *
 * A primeira coisa que a pessoa lê ao abrir a tela, e a resposta para "o que
 * eu entrego hoje?". Só o que vence hoje e o que já passou do prazo — nada de
 * "esta semana" aqui, senão a lista cresce e deixa de ser uma decisão rápida.
 *
 * São subtarefas, sempre: é a unidade de trabalho, e é o que a pessoa
 * efetivamente entrega. O botão de cada linha vem da máquina de estados — o
 * que exige aprovação mostra "Enviar para aprovação", não "Concluir".
 *
 * Fica num componente separado de propósito, e a Home do Sprint 15 mostra o
 * MESMO bloco, alimentado pela mesma função `meuDia()`. Duas listas parecidas
 * divergiriam no pior lugar: o botão que muda o status de uma etapa.
 *
 * **`estaSemana` só existe na Home**, e é o que a diferencia sem duplicá-la.
 * Aqui a lista é curta de propósito — "esta semana" faria dela uma agenda em
 * vez de uma decisão —, e em Minhas Tasks o número já está nos contadores
 * logo acima. Na Home não há contador nenhum, e sem esta linha a pessoa leria
 * "dia limpo" sem saber que quarta-feira tem cinco entregas.
 */
export function MeuDia({
  itens,
  primeiroNome,
  usuarioId,
  souGestor,
  estaSemana,
}: {
  itens: ItemDoDia[];
  primeiroNome: string;
  usuarioId: string;
  souGestor: boolean;
  /** Quantas vencem ainda nesta semana. Só a Home passa. */
  estaSemana?: number;
}) {
  const atrasadas = itens.filter((item) => item.atrasada).length;

  return (
    <section className="rounded-xl border">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Meu dia</h2>
        {atrasadas > 0 ? (
          <Badge variant="destructive">
            {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
          </Badge>
        ) : null}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {itens.length} entrega{itens.length === 1 ? "" : "s"}
        </span>
      </header>

      {itens.length === 0 ? (
        <div className="p-2">
          <EmptyState
            icon={PartyPopper}
            title={`Dia limpo, ${primeiroNome}`}
            description="Nada vence hoje e nada está atrasado no seu nome. Bom momento para adiantar o que vem pela frente."
          />
        </div>
      ) : (
        <ul className="divide-y">
          {itens.map((item) => (
            <li key={item.chave} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  item.atrasada ? "bg-destructive" : "bg-warning",
                )}
              />

              {/* `min-w-48` E NÃO SÓ `min-w-0`: com `min-w-0` o título é o
                  único que cede largura, e a linha inteira cabe em qualquer
                  tela — encolhendo o nome da etapa até "Re…" para o selo do
                  cliente, o prazo e o botão continuarem lado a lado. Em 390px
                  era o que sobrava do item, e quem abre a Home no celular via
                  duas linhas ilegíveis com um Concluir do lado.

                  Com um piso, o título para de ceder e o resto quebra para a
                  linha de baixo, que é o que `flex-wrap` no pai está ali para
                  fazer. Foi a imagem de 390px que mostrou; no 1600 as duas
                  entregas cabiam inteiras. */}
              <div className="min-w-48 flex-1">
                <p className="text-muted-foreground truncate text-xs">{item.tituloDaMae}</p>
                <p className="flex items-center gap-1.5 truncate text-sm">
                  <CornerDownRight aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
                  {item.titulo}
                  {item.requerAprovacao ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground inline-flex">
                          <Lock className="size-3.5" aria-label="Exige aprovação" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Exige aprovação {ROTULO_DA_APROVACAO[item.tipoAprovacao ?? "interna"]}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </p>
              </div>

              {item.cliente ? (
                <Badge variant="outline" className="max-w-40 truncate">
                  {item.cliente}
                </Badge>
              ) : null}

              <span
                className={cn(
                  "text-xs tabular-nums",
                  item.atrasada ? "text-destructive font-medium" : "text-muted-foreground",
                )}
              >
                {item.atrasada && item.prazo
                  ? `venceu ${format(parseISO(item.prazo), "dd/MM/yy", { locale: ptBR })}`
                  : "hoje"}
              </span>

              <AcoesDaSubtarefa
                subtarefa={{
                  id: item.id,
                  task_id: item.taskId,
                  titulo: item.titulo,
                  status: item.status,
                  responsavel_id: usuarioId,
                  requer_aprovacao: item.requerAprovacao,
                  tipo_aprovacao: item.tipoAprovacao,
                  estimativa_minutos: item.estimativaMinutos,
                  tempo_medido_segundos: item.tempoMedidoSegundos,
                  andando_desde: item.andandoDesde,
                  dependenciasAbertas: item.dependenciasAbertas,
                  rodadaPendente: false,
                  avalInterno: false,
                  avalFinal: false,
                  enviadaAoCliente: false,
                }}
                usuarioId={usuarioId}
                souGestor={souGestor}
              />
            </li>
          ))}
        </ul>
      )}

      {estaSemana ? (
        <footer className="border-t px-4 py-2">
          <Link
            href="/painel/minhas-tasks?foco=semana"
            className="text-accent-strong text-xs hover:underline"
          >
            e mais {estaSemana} {estaSemana === 1 ? "etapa vence" : "etapas vencem"} até o fim da
            semana
          </Link>
        </footer>
      ) : null}
    </section>
  );
}
