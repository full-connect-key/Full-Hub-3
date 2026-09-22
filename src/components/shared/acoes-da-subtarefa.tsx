"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DialogoDeTempo } from "@/components/shared/dialogo-de-tempo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import { acoesDaSubtarefa, DESTINO_DA_ACAO, type IdDeAcao } from "@/lib/tasks/state-machine";
import type { SubtaskStatus, TipoAprovacao } from "@/lib/supabase/database.types";

import {
  aprovarInterna,
  enviarParaAprovacao,
  enviarParaCliente,
  solicitarAjustesInterna,
} from "@/app/(interno)/painel/gestao-tasks/acoes-de-aprovacao";
import { moverSubtarefa } from "@/app/(interno)/painel/gestao-tasks/acoes-de-itens";

/**
 * O botão certo, para a pessoa certa, na hora certa.
 *
 * Quem decide o que aparece é `acoesDaSubtarefa`, em `lib/tasks/state-machine`
 * — a mesma máquina que o servidor consulta. Este componente só desenha o
 * resultado e cuida dos diálogos que cada ação precisa: o tempo real ao
 * concluir, o motivo ao pedir ajustes, a confirmação ao enviar para o cliente.
 *
 * Por que um componente só, usado no detalhe, em Minhas Tasks e na fila de
 * aprovações: são três telas que precisam responder a mesma pergunta. Se cada
 * uma respondesse por conta, mais cedo ou mais tarde uma delas ofereceria
 * "Concluir" numa subtarefa que exige aprovação — e o banco recusaria, com a
 * pessoa sem entender por quê.
 */

export type SubtarefaParaAcao = {
  id: string;
  task_id: string;
  titulo: string;
  status: SubtaskStatus;
  responsavel_id: string | null;
  requer_aprovacao: boolean;
  tipo_aprovacao: TipoAprovacao | null;
  estimativa_minutos: number | null;
  dependenciasAbertas: string[];
  rodadaPendente: boolean;
  avalInterno: boolean;
  avalFinal: boolean;
  enviadaAoCliente: boolean;
};

export function AcoesDaSubtarefa({
  subtarefa,
  usuarioId,
  souGestor,
  rodadaPendenteId,
  tamanho = "sm",
  aoMudar,
}: {
  subtarefa: SubtarefaParaAcao;
  usuarioId: string;
  souGestor: boolean;
  /** A rodada que espera decisão, para aprovar ou pedir ajustes. */
  rodadaPendenteId?: string | null;
  tamanho?: "sm" | "default";
  aoMudar?: () => void;
}) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  const [pedindoTempo, setPedindoTempo] = useState(false);
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState<null | "enviar_aprovacao" | "enviar_cliente">(null);

  const acoes = acoesDaSubtarefa({
    status: subtarefa.status,
    requerAprovacao: subtarefa.requer_aprovacao,
    tipoAprovacao: subtarefa.tipo_aprovacao,
    souOResponsavel: subtarefa.responsavel_id === usuarioId,
    souGestor,
    dependenciasAbertas: subtarefa.dependenciasAbertas,
    rodadaPendente: subtarefa.rodadaPendente,
    avalInterno: subtarefa.avalInterno,
    avalFinal: subtarefa.avalFinal,
    enviadaAoCliente: subtarefa.enviadaAoCliente,
  });

  if (acoes.length === 0) return null;

  const principal = acoes.find((a) => a.principal) ?? acoes[0];
  const secundarias = acoes.filter((a) => a !== principal);

  function terminar(resultado: { ok: boolean; mensagem?: string; error?: string }) {
    if (!resultado.ok) {
      toast.error(resultado.error ?? "Não foi possível.");
      return false;
    }
    toast.success(resultado.mensagem ?? "Pronto.");
    aoMudar?.();
    router.refresh();
    return true;
  }

  function mover(destino: SubtaskStatus, minutos?: number | null) {
    iniciar(async () => {
      terminar(await chamarAcao(() => moverSubtarefa(subtarefa.id, subtarefa.task_id, destino, minutos)));
    });
  }

  function executar(id: IdDeAcao) {
    switch (id) {
      case "concluir":
        setPedindoTempo(true);
        return;
      case "enviar_aprovacao":
        setConfirmando("enviar_aprovacao");
        return;
      case "enviar_cliente":
        setConfirmando("enviar_cliente");
        return;
      case "solicitar_ajustes":
        setMotivo("");
        setPedindoMotivo(true);
        return;
      case "aprovar":
        if (!rodadaPendenteId) {
          toast.error("Esta rodada não está mais esperando decisão. Atualize a tela.");
          return;
        }
        iniciar(async () => {
          terminar(await chamarAcao(() => aprovarInterna(rodadaPendenteId)));
        });
        return;
      default: {
        const destino = DESTINO_DA_ACAO[id];
        if (destino) mover(destino);
      }
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <BotaoComMotivo
          rotulo={principal.rotulo}
          desabilitado={principal.desabilitada || executando}
          motivo={principal.motivo}
          carregando={executando}
          tamanho={tamanho}
          aoClicar={() => executar(principal.id)}
        />

        {secundarias.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Mais ações">
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {secundarias.map((acao) => (
                <DropdownMenuItem
                  key={acao.id}
                  disabled={acao.desabilitada || executando}
                  onSelect={() => executar(acao.id)}
                >
                  {acao.rotulo}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <DialogoDeTempo
        aberto={pedindoTempo}
        aoFechar={() => setPedindoTempo(false)}
        titulo={`Concluir "${subtarefa.titulo}"`}
        sugestao={subtarefa.estimativa_minutos}
        origemDaSugestao={
          subtarefa.estimativa_minutos !== null ? "Sugerido pela estimativa da subtarefa." : undefined
        }
        aoConcluir={async (minutos) => {
          const resultado = await chamarAcao(() =>
            moverSubtarefa(subtarefa.id, subtarefa.task_id, "concluida", minutos),
          );
          return terminar(resultado);
        }}
      />

      {/* Pedir ajustes sem dizer o que ajustar não ajuda ninguém — e o banco
          recusa a rodada sem comentário, então o campo é obrigatório aqui. */}
      <Dialog open={pedindoMotivo} onOpenChange={(aberto) => !aberto && setPedindoMotivo(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que precisa ser ajustado?</DialogTitle>
            <DialogDescription>
              O texto vai para quem produziu, junto com a rodada. É o que ele vai ler para saber o
              que refazer.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={4}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Trocar a cor do fundo para o azul da marca."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPedindoMotivo(false)}>
              Cancelar
            </Button>
            <Button
              disabled={motivo.trim().length === 0 || executando}
              onClick={() => {
                if (!rodadaPendenteId) return;
                iniciar(async () => {
                  const ok = terminar(
                    await chamarAcao(() => solicitarAjustesInterna(rodadaPendenteId, motivo)),
                  );
                  if (ok) setPedindoMotivo(false);
                });
              }}
            >
              {executando ? <Loader2 className="animate-spin" /> : null}
              Solicitar ajustes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmando !== null} onOpenChange={(aberto) => !aberto && setConfirmando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmando === "enviar_cliente" ? "Enviar para o cliente" : "Enviar para aprovação"}
            </DialogTitle>
            <DialogDescription>
              {confirmando === "enviar_cliente"
                ? "A entrega aparece no Portal do Cliente e ele passa a poder aprovar ou pedir ajustes. Registra quem enviou e quando."
                : "Abre uma rodada de aprovação interna. Enquanto ela estiver aberta, a subtarefa fica esperando a decisão."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            {confirmando === "enviar_aprovacao" ? (
              <Button
                variant="ghost"
                disabled={executando}
                onClick={() =>
                  iniciar(async () => {
                    const ok = terminar(
                      await chamarAcao(() => enviarParaAprovacao(subtarefa.id, { semArquivo: true })),
                    );
                    if (ok) setConfirmando(null);
                  })
                }
              >
                Esta etapa não gera arquivo
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmando(null)}>
                Cancelar
              </Button>
              <Button
                disabled={executando}
                onClick={() =>
                  iniciar(async () => {
                    const acao =
                      confirmando === "enviar_cliente"
                        ? () => enviarParaCliente(subtarefa.id)
                        : () => enviarParaAprovacao(subtarefa.id);
                    const ok = terminar(await chamarAcao(acao));
                    if (ok) setConfirmando(null);
                  })
                }
              >
                {executando ? <Loader2 className="animate-spin" /> : null}
                {confirmando === "enviar_cliente" ? "Enviar ao cliente" : "Enviar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Botão desabilitado sem explicação é um beco sem saída. Quando há motivo, ele
 * vira tooltip — e o `span` em volta existe porque um botão desabilitado não
 * dispara os eventos de mouse que o tooltip escuta.
 */
function BotaoComMotivo({
  rotulo,
  motivo,
  desabilitado,
  carregando,
  tamanho,
  aoClicar,
}: {
  rotulo: string;
  motivo?: string;
  desabilitado: boolean;
  carregando: boolean;
  tamanho: "sm" | "default";
  aoClicar: () => void;
}) {
  const botao = (
    <Button size={tamanho} disabled={desabilitado} onClick={aoClicar}>
      {carregando ? <Loader2 className="animate-spin" /> : null}
      {rotulo}
    </Button>
  );

  if (!motivo) return botao;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{botao}</span>
      </TooltipTrigger>
      <TooltipContent>{motivo}</TooltipContent>
    </Tooltip>
  );
}
