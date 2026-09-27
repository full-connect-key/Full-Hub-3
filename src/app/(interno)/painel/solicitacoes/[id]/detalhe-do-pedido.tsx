"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ExternalLink,
  Paperclip,
  Trash2,
  Wand2,
} from "lucide-react";

import { escreverNaSolicitacao } from "@/app/(cliente)/portal/_actions/solicitacoes";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SeloDaSolicitacao } from "@/components/shared/selo-da-solicitacao";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { PedidoCompleto } from "@/lib/dados/solicitacoes";
import { camposDoRoteiro, respostasParaLer } from "@/lib/dominio/solicitacoes";

import {
  apagarSolicitacao,
  converterEmDemanda,
  recusarSolicitacao,
  triarSolicitacao,
} from "../acoes";

/**
 * O pedido, do lado da agência.
 *
 * ---------------------------------------------------------------------------
 * **"Converter em demanda" ABRE UM RASCUNHO e leva para ele**, e é a decisão
 * central do sprint.
 *
 * Ela não cria a demanda pronta: cria o rascunho (0028) com título, cliente,
 * briefing e a pasta padrão da conta preenchidos, e abre a tela de detalhe —
 * que é onde o Atendimento escolhe o workflow, distribui as etapas e assume o
 * prazo. São as quatro decisões que o pedido não traz.
 *
 * **E o cliente não é avisado aqui.** O status do pedido dele só anda quando
 * a demanda for PUBLICADA, e quem o move é o trigger no banco. Avisar no
 * rascunho diria "estamos fazendo" sobre uma demanda que a equipe não enxerga.
 * ---------------------------------------------------------------------------
 */
export function DetalheDoPedido({
  pedido,
  souAtendimento,
  souGestor,
}: {
  pedido: PedidoCompleto;
  souAtendimento: boolean;
  souGestor: boolean;
  usuarioId: string;
  agoraISO: string;
}) {
  const router = useRouter();
  const [executando, comecar] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const [motivo, setMotivo] = useState("");
  const [recusando, setRecusando] = useState(false);

  const campos = camposDoRoteiro(pedido.roteiro?.campos_json);
  const respostas = respostasParaLer(campos, pedido.respostas);

  function converter() {
    comecar(async () => {
      const r = await chamarEMostrar(() => converterEmDemanda(pedido.id));
      // Leva para o rascunho, que é onde o trabalho continua. Ficar aqui
      // deixaria a pessoa numa tela que diz "pronto" sem mostrar o que nasceu.
      if (r.ok && r.dados) router.push(`/painel/gestao-tasks/${r.dados}`);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={pedido.titulo}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/painel/solicitacoes">
              <ArrowLeft aria-hidden />
              Voltar à fila
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <SeloDaSolicitacao status={pedido.status} lado="equipe" />
        <span className="text-muted-foreground">{pedido.empresa ?? "—"}</span>
        {pedido.tipo ? (
          <>
            <span aria-hidden className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{pedido.tipo}</span>
          </>
        ) : null}
        <span aria-hidden className="text-muted-foreground">·</span>
        <span className="text-muted-foreground tabular-nums">
          {format(parseISO(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </span>
        {pedido.autor ? (
          <span className="ms-2 inline-flex items-center gap-1.5">
            <UserAvatar name={pedido.autor.nome} src={pedido.autor.avatar_url} size="sm" />
            <span className="text-muted-foreground">{pedido.autor.nome}</span>
          </span>
        ) : null}
      </div>

      {/* O PRAZO DESEJADO É DESEJO, e a tela diz isso em vez de deixar a
          pessoa supor. É a mesma frase que vai para o briefing da demanda:
          `data_desejada` é o que o cliente gostaria, `tasks.data_fim` é o que
          a agência assume. */}
      {pedido.data_desejada ? (
        <p className="bg-blue-soft text-text-primary flex items-start gap-2 rounded-lg p-3 text-sm">
          <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            O cliente gostaria para{" "}
            <strong className="tabular-nums">
              {format(parseISO(pedido.data_desejada), "dd/MM/yyyy", { locale: ptBR })}
            </strong>
            . É o desejo dele, não o prazo combinado — o prazo é o que você assumir na demanda.
          </span>
        </p>
      ) : null}

      {pedido.descricao ? (
        <section className="space-y-1.5">
          <h2 className="text-sm font-semibold">O que ele escreveu</h2>
          <p className="text-text-secondary text-sm whitespace-pre-wrap">{pedido.descricao}</p>
        </section>
      ) : null}

      {respostas.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">O briefing</h2>
          <dl className="divide-y rounded-lg border">
            {respostas.map((r) => (
              <div key={r.rotulo} className="grid gap-1 p-3 sm:grid-cols-[12rem_1fr]">
                <dt className="text-muted-foreground text-sm">
                  {r.rotulo}
                  {/* A RESPOSTA ÓRFÃ APARECE, e não some: quando o roteiro
                      mudou depois do pedido, a pergunta daquela chave não
                      existe mais. Esconder a linha faria sumir uma informação
                      que o cliente escreveu. */}
                  {r.orfa ? (
                    <span className="text-warning ms-1 text-xs">(pergunta antiga)</span>
                  ) : null}
                </dt>
                <dd className="text-sm whitespace-pre-wrap">{r.valor}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {pedido.anexos.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Arquivos ({pedido.anexos.length})</h2>
          <ul className="divide-y rounded-lg border">
            {pedido.anexos.map((a) => (
              <li key={a.id} className="flex items-center gap-2 p-3 text-sm">
                <Paperclip aria-hidden className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                {a.assinado ? (
                  <a
                    href={a.assinado}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-strong inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    Abrir
                    <ExternalLink aria-hidden className="size-3" />
                  </a>
                ) : (
                  // O CAMINHO CRU NUNCA VIRA LINK: a assinatura falhou, e um
                  // href para `empresa/pedido/a.png` devolve 404. Dizer que não
                  // deu é melhor que um link quebrado.
                  <span className="text-muted-foreground text-xs">Não foi possível abrir</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pedido.status === "recusada" && pedido.motivo_recusa ? (
        <p className="bg-danger-soft text-danger rounded-lg p-3 text-sm">
          Recusado: {pedido.motivo_recusa}
        </p>
      ) : null}

      {pedido.demanda ? (
        <p className="bg-success-soft text-success flex flex-wrap items-center gap-2 rounded-lg p-3 text-sm">
          <Check aria-hidden className="size-4" />
          Este pedido virou a demanda
          <Link
            href={`/painel/gestao-tasks/${pedido.demanda.id}`}
            className="font-medium underline underline-offset-2"
          >
            {pedido.demanda.titulo}
          </Link>
        </p>
      ) : null}

      {/* AS AÇÕES FICAM DEPOIS DO QUE SE LÊ, e é a ordem da decisão: quem
          converte precisa ter lido o briefing e visto os arquivos. Botão antes
          do conteúdo convida a decidir sem olhar — a mesma razão pela qual a
          arte vem antes dos botões no portal. */}
      {souAtendimento ? (
        <section className="flex flex-wrap items-center gap-2 border-t pt-4">
          {pedido.status === "nova" ? (
            <Button
              variant="outline"
              disabled={executando}
              onClick={() =>
                comecar(async () => {
                  await chamarEMostrar(() => triarSolicitacao(pedido.id));
                })
              }
            >
              Estou olhando
            </Button>
          ) : null}

          {!pedido.demanda && pedido.status !== "recusada" ? (
            <Button disabled={executando} onClick={converter}>
              <Wand2 aria-hidden />
              Converter em demanda
            </Button>
          ) : null}

          {pedido.status !== "recusada" && !pedido.demanda ? (
            <Button variant="outline" disabled={executando} onClick={() => setRecusando((v) => !v)}>
              Recusar
            </Button>
          ) : null}

          {souGestor ? (
            <ConfirmDialog
              title="Apagar este pedido?"
              description="Apagar não deixa rastro do lado do cliente — ele simplesmente some do portal dele. Para dizer que a agência não vai seguir, recuse com o motivo: isso o cliente lê."
              confirmLabel="Apagar"
              onConfirm={async () => {
                const r = await chamarEMostrar(() => apagarSolicitacao(pedido.id));
                if (r.ok) router.push("/painel/solicitacoes");
              }}
              trigger={
                <Button variant="ghost" size="sm" className="text-danger ms-auto">
                  <Trash2 aria-hidden />
                  Apagar
                </Button>
              }
            />
          ) : null}
        </section>
      ) : (
        <p className="text-muted-foreground border-t pt-4 text-sm">
          Triar e converter é de quem abre demanda: o Atendimento e a gestão.
        </p>
      )}

      {recusando ? (
        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="motivo-da-recusa">Por que não vamos seguir</Label>
          <Textarea
            id="motivo-da-recusa"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="O cliente vai ler exatamente esta frase."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRecusando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={executando || motivo.trim().length < 5}
              onClick={() =>
                comecar(async () => {
                  const r = await chamarEMostrar(() => recusarSolicitacao(pedido.id, motivo));
                  if (r.ok) {
                    setMotivo("");
                    setRecusando(false);
                  }
                })
              }
            >
              Recusar e avisar
            </Button>
          </div>
        </div>
      ) : null}

      {/* A CONVERSA É COM O CLIENTE, e a tela diz isso em voz alta.
          Não existe comentário interno aqui: `request_messages` não tem coluna
          `interno`, de propósito. Quem precisa falar da agência para dentro
          fala nos comentários da demanda. */}
      <section className="space-y-3 border-t pt-4">
        <div>
          <h2 className="text-sm font-semibold">Conversa</h2>
          <p className="text-muted-foreground text-xs">
            O cliente lê tudo o que for escrito aqui. Para falar com a equipe, use os comentários da
            demanda.
          </p>
        </div>

        {pedido.mensagens.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ninguém escreveu nada ainda.</p>
        ) : (
          <ul className="space-y-3">
            {pedido.mensagens.map((m) => (
              <li key={m.id} className="flex gap-2">
                <UserAvatar name={m.autor?.nome ?? "—"} src={m.autor?.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-medium">{m.autor?.nome ?? "—"}</span>{" "}
                    <span className="text-muted-foreground tabular-nums">
                      {format(parseISO(m.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Label htmlFor="mensagem-ao-cliente" className="sr-only">
            Escreva para o cliente
          </Label>
          <Textarea
            id="mensagem-ao-cliente"
            rows={2}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Perguntar alguma coisa, ou dizer o que vai acontecer."
          />
          <div className="flex justify-end">
            <Button
              disabled={executando || mensagem.trim().length === 0}
              onClick={() =>
                comecar(async () => {
                  const r = await chamarEMostrar(() =>
                    escreverNaSolicitacao(pedido.id, mensagem),
                  );
                  if (r.ok) setMensagem("");
                })
              }
            >
              Enviar ao cliente
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
