"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import type { FilaDeAprovacoes, ItemDaFila } from "@/lib/dados/aprovacoes";

import {
  aprovarInterna,
  enviarParaCliente,
  solicitarAjustesInterna,
} from "../gestao-tasks/acoes-de-aprovacao";
import { enviarAoCliente } from "../social-media/acoes";

/**
 * A fila do Desenvolvedor.
 *
 * Ordenada por tempo de espera, porque é a fila justa: o que está parado há
 * mais tempo aparece primeiro, e nada some no fim da lista.
 *
 * **Todo item aparece com os botões**, inclusive o que está no nome de quem
 * olha: a 0029 tirou a trava de autoaprovação e a 0060 tirou a de envio, as
 * duas aqui e no banco. Quem chega nesta fila é gestão, e gestão decide.
 *
 * ---------------------------------------------------------------------------
 * **A FILA TEM DOIS TIPOS: etapa de demanda e POST.** O post entrou porque
 * não saía de lugar nenhum — `pedirAvalInterno()` abria a rodada e nada no
 * produto conseguia decidi-la, então ele ficava parado antes do cliente para
 * sempre. O banco já aceitava desde a 0033; faltava a tela ler.
 *
 * **O selo diz qual é qual**, e não é enfeite: os dois têm botões iguais e
 * consequências diferentes — a etapa que só pede aval interno CONCLUI ao ser
 * aprovada, o post nunca conclui, ele passa para "prontas para enviar". Sem o
 * selo, a mesma linha significaria duas coisas.
 * ---------------------------------------------------------------------------
 */
export function Fila({ fila }: { fila: FilaDeAprovacoes }) {
  if (fila.esperando.length === 0 && fila.prontasParaOCliente.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="Fila vazia"
        description="Nenhuma entrega esperando validação. Quando alguém pedir o aval interno de uma etapa ou de um post, ele aparece aqui."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">Esperando decisão</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {fila.esperando.length}
          </span>
        </div>

        {fila.esperando.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            Nada esperando você agora.
          </p>
        ) : (
          <ul className="space-y-2">
            {fila.esperando.map((item) => (
              <ItemEsperando key={item.rodadaId} item={item} />
            ))}
          </ul>
        )}
      </section>

      {fila.prontasParaOCliente.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">
              Prontas para enviar ao cliente
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {fila.prontasParaOCliente.length}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Já passaram pelo aval interno. Aprovar diz que o material está bom;
            enviar diz que é agora — e é uma decisão sua.
          </p>
          <ul className="space-y-2">
            {fila.prontasParaOCliente.map((item) => (
              <ItemProntaParaOCliente
                key={`${item.tipo}:${item.contentId}`}
                item={item}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Cabecalho({ item }: { item: ItemDaFila }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {item.cliente ? <Badge variant="outline">{item.cliente}</Badge> : null}
        <Link href={item.rota} className="hover:text-accent-strong text-sm font-medium">
          {item.titulo}
        </Link>
        {/* DE QUE TIPO É ESTA LINHA. Os botões são os mesmos e o que acontece
            depois não: a etapa de aval interno conclui, o post segue para o
            envio. */}
        <Badge variant={item.tipo === "post" ? "default" : "secondary"}>
          {item.tipo === "post" ? "Post" : "Etapa"}
        </Badge>
        <Badge variant="secondary">Rodada {item.numeroRodada}</Badge>
        <Badge variant="secondary">
          {ROTULO_DA_APROVACAO[item.tipoAprovacao]}
        </Badge>
      </div>

      <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <span>{item.contexto}</span>
        {item.responsavel ? (
          <span className="inline-flex items-center gap-1.5">
            <UserAvatar
              name={item.responsavel.nome}
              src={item.responsavel.avatar_url}
              size="sm"
            />
            {item.responsavel.nome}
          </span>
        ) : null}
        <span>
          espera há{" "}
          {formatDistanceToNowStrict(parseISO(item.desde), {
            locale: ptBR,
            addSuffix: false,
          })}
        </span>
      </p>

      {/* O MATERIAL PARA OLHAR ANTES DE DECIDIR. Aprovar sem ver é o que o
          Sprint 12 evitou ao pôr a arte antes dos botões no portal, e um
          "Aprovar" numa linha sem nada para abrir convida ao mesmo erro do
          lado de cá. */}
      {item.anexos.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pt-1">
          {item.anexos.map((anexo) => (
            <li key={anexo.id}>
              <a
                href={anexo.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-accent-strong inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
              >
                <Paperclip className="size-3" aria-hidden />
                {anexo.nome}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground pt-1 text-xs italic">
          {item.tipo === "post"
            ? "Sem arte ainda — abra o post antes de decidir."
            : "Sem arquivo anexado."}
        </p>
      )}
    </div>
  );
}

function ItemEsperando({ item }: { item: ItemDaFila }) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
      <Cabecalho item={item} />

      {/* Quem chega nesta fila é gestão, e desde a migration 0029 a gestão
          decide qualquer rodada — inclusive a da etapa que está no próprio
          nome. Não há mais motivo para desligar botão nenhum aqui. */}
      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={executando}
          onClick={() => {
            setMotivo("");
            setPedindoMotivo(true);
          }}
        >
          Solicitar ajustes
        </Button>
        <Button
          size="sm"
          disabled={executando}
          onClick={() =>
            iniciar(async () => {
              if (!item.rodadaId) return;
              const resultado = await chamarAcao(() =>
                aprovarInterna(item.rodadaId!),
              );
              if (!resultado.ok) toast.error(resultado.error);
              else {
                toast.success(resultado.mensagem);
                router.refresh();
              }
            })
          }
        >
          {executando ? <Loader2 className="animate-spin" /> : null}
          Aprovar
        </Button>
      </div>

      <Dialog
        open={pedindoMotivo}
        onOpenChange={(aberto) => !aberto && setPedindoMotivo(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que precisa ser ajustado?</DialogTitle>
            <DialogDescription>
              Vai junto com a rodada, para quem produziu. É o que ele vai ler
              para saber o que refazer.
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
              onClick={() =>
                iniciar(async () => {
                  if (!item.rodadaId) return;
                  const resultado = await chamarAcao(() =>
                    solicitarAjustesInterna(item.rodadaId!, motivo),
                  );
                  if (!resultado.ok) toast.error(resultado.error);
                  else {
                    toast.success(resultado.mensagem);
                    setPedindoMotivo(false);
                    router.refresh();
                  }
                })
              }
            >
              {executando ? <Loader2 className="animate-spin" /> : null}
              Solicitar ajustes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function ItemProntaParaOCliente({ item }: { item: ItemDaFila }) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
      <Cabecalho item={item} />
      <Button
        size="sm"
        disabled={executando}
        onClick={() =>
          iniciar(async () => {
            // CADA TIPO TEM A SUA AÇÃO DE ENVIO, e não dá para unificar:
            // no post, enviar É abrir a rodada de cliente e o carimbo
            // `enviado_em` sai do trigger da 0032; na etapa, a ação ainda
            // registra a linha no histórico da demanda. São dois caminhos
            // porque são dois fluxos, não por falta de refatoração.
            const resultado = await chamarAcao(() =>
              item.tipo === "post"
                ? enviarAoCliente(item.contentId)
                : enviarParaCliente(item.contentId),
            );
            if (!resultado.ok) toast.error(resultado.error);
            else {
              toast.success(resultado.mensagem);
              router.refresh();
            }
          })
        }
      >
        {executando ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Send aria-hidden />
        )}
        Enviar para o cliente
      </Button>
    </li>
  );
}
