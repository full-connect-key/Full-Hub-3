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
import {
  formatarMinutos,
  medidaSuspeita,
  minutosMedidos,
  HORAS_ATE_DESCONFIAR,
} from "@/lib/dominio/tempo";
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
  /**
   * O cronômetro (migration 0021). Opcionais porque nem toda tela carrega a
   * linha inteira da subtarefa — "Meu dia" monta a sua a partir de um resumo.
   * Sem eles, o diálogo cai na estimativa, que é o que ele fazia antes.
   */
  tempo_medido_segundos?: number;
  andando_desde?: string | null;
  /**
   * Os outros dois registros de "fui eu que fiz" (migration 0026): a rodada
   * que a própria pessoa abriu e o material que ela anexou.
   *
   * OPCIONAIS pela mesma razão das duas colunas do cronômetro acima — nem
   * toda tela carrega a linha inteira. Quando faltam, o componente assume
   * que não sou nenhum dos dois; e nas telas que não os carregam o botão de
   * decidir não aparece de qualquer forma. Quem vale é o trigger
   * `bloquear_autoaprovacao`, não isto.
   */
  rodadas?: { status: string; solicitado_por: string }[];
  entregas?: { enviado_por: string }[];
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

  // O medido é calculado no CLIQUE, não no render: ler `Date.now()` durante
  // o render faria o HTML do servidor divergir do que o navegador monta. Num
  // manipulador de evento não há esse risco — e é o instante certo, porque é
  // quando a contagem para.
  const [pedindoTempo, setPedindoTempo] = useState(false);
  const [medido, setMedido] = useState<number | null>(null);
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState<null | "enviar_aprovacao" | "enviar_cliente">(null);

  const acoes = acoesDaSubtarefa({
    status: subtarefa.status,
    requerAprovacao: subtarefa.requer_aprovacao,
    tipoAprovacao: subtarefa.tipo_aprovacao,
    souOResponsavel: subtarefa.responsavel_id === usuarioId,
    // Os outros dois registros de "fui eu que fiz" (migration 0026): a rodada
    // que eu mesmo abri, e o material que eu mesmo anexei. Sem eles o botão
    // aparecia ligado e o banco recusava depois do clique.
    souQuemPediu: (subtarefa.rodadas ?? []).some(
      (r) => r.status === "pendente" && r.solicitado_por === usuarioId,
    ),
    souQuemEntregou: (subtarefa.entregas ?? []).some((e) => e.enviado_por === usuarioId),
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
      case "concluir": {
        const doRelogio = medidoAteAgora(subtarefa);
        setMedido(doRelogio > 0 ? doRelogio : null);
        setPedindoTempo(true);
        return;
      }
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
        sugestao={medido ?? subtarefa.estimativa_minutos}
        origemDaSugestao={origemDoNumero(medido, subtarefa.estimativa_minutos)}
        alerta={
          medidaSuspeita(medido)
            ? `O relógio contou mais de ${HORAS_ATE_DESCONFIAR}h nesta etapa. Se a subtarefa ficou em andamento de um dia para o outro, o número inclui esse tempo — corrija antes de confirmar.`
            : undefined
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


/**
 * Os minutos que o cronômetro contou, incluindo a passagem em curso.
 *
 * Fora do componente de propósito: ler o relógio é efeito, e o compilador do
 * React recusa uma chamada impura dentro do corpo de um componente. Aqui é
 * uma função de módulo, chamada só no clique — que é, aliás, o instante certo
 * para perguntar, porque é quando a contagem para.
 */
function medidoAteAgora(subtarefa: SubtarefaParaAcao): number {
  return minutosMedidos(
    {
      tempo_medido_segundos: subtarefa.tempo_medido_segundos ?? 0,
      andando_desde: subtarefa.andando_desde ?? null,
    },
    Date.now(),
  );
}

/**
 * De onde saiu o número que já está no campo.
 *
 * A pessoa precisa saber: um valor pré-preenchido sem origem é um valor que
 * se confirma sem pensar. E são duas origens diferentes — o cronômetro é
 * medição, a estimativa é palpite de quem abriu a demanda.
 */
function origemDoNumero(medido: number | null, estimativa: number | null): string | undefined {
  if (medido !== null) {
    const comparacao =
      estimativa !== null ? ` A estimativa era ${formatarMinutos(estimativa)}.` : "";
    return `Medido pelo cronômetro, que corre enquanto a etapa está em andamento.${comparacao}`;
  }
  if (estimativa !== null) return "Sugerido pela estimativa da subtarefa — o cronômetro não contou nada nesta etapa.";
  return undefined;
}
