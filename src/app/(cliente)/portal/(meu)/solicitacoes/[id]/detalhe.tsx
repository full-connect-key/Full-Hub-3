"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ExternalLink,
  Paperclip,
  Trash2,
} from "lucide-react";

import {
  apagarAnexo,
  escreverNaSolicitacao,
} from "@/app/(cliente)/portal/_actions/solicitacoes";
import { subirAnexoDoPedido } from "@/app/(cliente)/portal/(meu)/solicitacoes/subir-anexo";
import { CartaoDeItem } from "@/components/portal/cartao-de-item";
import { PageHeader } from "@/components/shared/page-header";
import { SeloDaSolicitacao } from "@/components/shared/selo-da-solicitacao";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { PedidoCompleto } from "@/lib/dados/solicitacoes";
import type { ItemDoPortal } from "@/lib/dominio/portal";
import {
  EXPLICACAO_PARA_O_CLIENTE,
  camposDoRoteiro,
  respostasParaLer,
} from "@/lib/dominio/solicitacoes";

/** O teto é do banco; a tela conta para não oferecer um caminho sem saída. */
const TETO_DE_ARQUIVOS = 10;

/**
 * O pedido, na tela de quem o abriu.
 *
 * ---------------------------------------------------------------------------
 * **ELE NÃO EDITA NADA DEPOIS DE MANDAR, e a ausência é o desenho.**
 *
 * Não há campo de título, nem seletor de estado, nem botão de cancelar. O
 * caminho é a CONVERSA: uma mensagem nova, com data e autor, que a agência lê
 * na fila dela. Editar o pedido que alguém já leu — ou que já virou trabalho —
 * trocaria o combinado embaixo de quem está fazendo.
 *
 * O que ele continua podendo é anexar e apagar arquivo: um arquivo é material,
 * não combinado, e mandar a referência errada é o erro mais comum de todos.
 * ---------------------------------------------------------------------------
 *
 * **E nada aqui mostra o trabalho de dentro da agência.** Nem quem vai fazer,
 * nem quanto tempo leva, nem por onde o trabalho já passou — o que ele vê é o
 * estado do PEDIDO dele, em cinco palavras.
 *
 * (Este comentário não pode nomear as peças internas do trabalho: a varredura
 * de `check:cores` passa por todo `(cliente)/` sem exceção de arquivo, e o
 * motivo é que a explicação de uma palavra proibida não pode carregá-la — ela
 * mora no CLAUDE.md, fora de `src/`.)
 */
export function DetalheDoPedido({
  pedido,
  base,
  hoje,
  materiais,
  somenteLeitura = false,
}: {
  pedido: PedidoCompleto;
  base: string;
  /** Vem do servidor, como em todo o produto: dois relógios dariam dois prazos. */
  hoje: string;
  /** O que já chegou por este pedido. A RLS decide o que entra na lista. */
  materiais: ItemDoPortal[];
  somenteLeitura?: boolean;
}) {
  const [executando, comecar] = useTransition();
  const [subindo, setSubindo] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  const campos = camposDoRoteiro(pedido.roteiro?.campos_json);
  const respostas = respostasParaLer(campos, pedido.respostas);
  const cheio = pedido.anexos.length >= TETO_DE_ARQUIVOS;

  // A SEÇÃO SÓ APARECE QUANDO TEM O QUE DIZER, e são dois casos.
  //
  // Com material, ela responde "o que já chegou por este pedido". Concluído
  // sem material, ela responde a pergunta que este pedido deixava sem
  // resposta: o estado virou "Entregue" e não havia nada para abrir. Nos
  // outros estados não há nem uma coisa nem outra — e uma caixa dizendo
  // "nada aqui" ocupa a tela todo dia para informar em alguns.
  const mostrarMateriais =
    pedido.status === "concluida" || materiais.length > 0;
  const encerrado =
    pedido.status === "concluida" || pedido.status === "recusada";

  /**
   * Sobe os arquivos escolhidos, um por um.
   *
   * **O caminho e a gravação moram em `subirAnexoDoPedido()`**, que é o mesmo
   * da tela de abrir pedido: a policy do Storage confere a pasta da empresa, e
   * duas cópias do caminho dariam uma recusa que aparece numa das duas telas e
   * numa delas só.
   *
   * **Um por um e não em paralelo**, e é de propósito: o teto de dez é contado
   * pelo banco, e dez `insert` simultâneos passariam pelas dez contagens antes
   * de qualquer uma gravar — a mesma razão pela qual a idempotência da
   * recorrência é índice único e não consulta. Em série, o décimo primeiro
   * leva a recusa com a dica.
   */
  async function subir(escolhidos: FileList | null) {
    const arquivos = Array.from(escolhidos ?? []);
    if (arquivos.length === 0) return;
    setSubindo(true);
    try {
      for (const arquivo of arquivos) {
        const r = await subirAnexoDoPedido({
          clientId: pedido.client_id,
          pedidoId: pedido.id,
          arquivo,
        });
        if (!r.ok) {
          toast.error(
            `${arquivo.name}: ${r.erro ?? "não foi possível anexar."}`,
          );
          break;
        }
      }
    } finally {
      setSubindo(false);
      if (campo.current) campo.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={pedido.titulo}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${base}/solicitacoes`}>
              <ArrowLeft aria-hidden />
              Meus pedidos
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SeloDaSolicitacao status={pedido.status} lado="cliente" />
        <span className="text-muted-foreground text-sm">
          {EXPLICACAO_PARA_O_CLIENTE[pedido.status]}
        </span>
      </div>

      {pedido.status === "recusada" && pedido.motivo_recusa ? (
        <p className="bg-danger-soft text-danger rounded-lg p-3 text-sm">
          {pedido.motivo_recusa}
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs">
        Enviado em{" "}
        <span className="tabular-nums">
          {format(parseISO(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", {
            locale: ptBR,
          })}
        </span>
        {pedido.autor ? ` por ${pedido.autor.nome}` : ""}
        {pedido.tipo ? ` · ${pedido.tipo}` : ""}
      </p>

      {pedido.data_desejada ? (
        <p className="bg-blue-soft text-text-primary flex items-start gap-2 rounded-lg p-3 text-sm">
          <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Você pediu para{" "}
            <strong className="tabular-nums">
              {format(parseISO(pedido.data_desejada), "dd/MM/yyyy", {
                locale: ptBR,
              })}
            </strong>
            .
            {/* A PROMESSA SAI QUANDO O PEDIDO FECHA. "A data que a Full vai
                assumir chega por aqui" é verdade enquanto há o que combinar;
                num pedido já concluído ela promete uma conversa que não vai
                acontecer, e num recusado promete uma data para o que não vai
                ser feito. É a razão pela qual o aviso do sino leva a data e
                nunca a palavra "hoje": o texto é escrito uma vez e lido
                depois. */}
            {encerrado
              ? ""
              : " A data que a Full vai assumir chega por aqui, na conversa."}
          </span>
        </p>
      ) : null}

      {mostrarMateriais ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Material deste pedido</h2>

          {materiais.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Este pedido foi concluído sem nenhum material para você aprovar
              por aqui. Se o que você pediu não chegou, escreva na conversa
              abaixo — é por lá que a Full responde.
            </p>
          ) : (
            <>
              {/* O MESMO CARTÃO DE "MATERIAIS", e não um resumo em linha: a
                  mesma coisa desenhada de dois jeitos parece duas coisas, e o
                  cartão já sabe quando um prazo é cobrança e quando é
                  registro. */}
              <div className="space-y-3">
                {materiais.map((m) => (
                  <CartaoDeItem
                    key={`${m.tipo}-${m.conteudoId}`}
                    item={m}
                    hoje={hoje}
                  />
                ))}
              </div>

              {/* O material que vem de uma demanda não tem tela própria — ele
                  se decide na fila de aprovações. O cartão fica sem link de
                  propósito, e o caminho vai aqui, uma vez.

                  E O LINK FICA SOZINHO NA LINHA, e não dentro de uma frase:
                  ele nasceu dentro de uma e o axe reprovou por
                  `link-in-text-block` — um link que só se distingue do texto
                  em volta pela cor não existe para quem não distingue aquela
                  cor. Todo link deste produto é `hover:underline`, e nenhum
                  outro foi acusado justamente porque nenhum outro mora no meio
                  de um parágrafo. */}
              <Link
                href={`${base}/itens`}
                className="text-accent-strong inline-flex items-center gap-1 text-sm hover:underline"
              >
                Ver em Materiais
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </>
          )}
        </section>
      ) : null}

      {pedido.descricao ? (
        <p className="text-text-secondary text-sm whitespace-pre-wrap">
          {pedido.descricao}
        </p>
      ) : null}

      {respostas.length > 0 ? (
        <dl className="divide-y rounded-lg border">
          {respostas.map((r) => (
            <div
              key={r.rotulo}
              className="grid gap-1 p-3 sm:grid-cols-[12rem_1fr]"
            >
              <dt className="text-muted-foreground text-sm">{r.rotulo}</dt>
              <dd className="text-sm whitespace-pre-wrap">{r.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Arquivos</h2>

        {pedido.anexos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum arquivo anexado.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {pedido.anexos.map((a) => (
              <li key={a.id} className="flex items-center gap-2 p-3 text-sm">
                <Paperclip
                  aria-hidden
                  className="text-muted-foreground size-4 shrink-0"
                />
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
                  <span className="text-muted-foreground text-xs">
                    Não foi possível abrir
                  </span>
                )}
                {!somenteLeitura ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Apagar ${a.nome}`}
                    disabled={executando}
                    onClick={() =>
                      comecar(async () => {
                        await chamarEMostrar(() =>
                          apagarAnexo(a.id, pedido.id),
                        );
                      })
                    }
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {!somenteLeitura ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={subindo || cheio}
              onClick={() => campo.current?.click()}
            >
              {subindo ? "Enviando…" : "Anexar arquivo"}
            </Button>
            <input
              ref={campo}
              type="file"
              // `sr-only` esconde da vista e NÃO da árvore de acessibilidade —
              // por isso o `aria-label`: sem ele o campo é anunciado como
              // "editar" e mais nada.
              aria-label="Escolher arquivos para anexar"
              className="sr-only"
              multiple
              onChange={(e) => subir(e.target.files)}
            />
            <span className="text-muted-foreground text-xs">
              {cheio
                ? `São até ${TETO_DE_ARQUIVOS} arquivos. Apague um antes de anexar outro.`
                : `${pedido.anexos.length} de ${TETO_DE_ARQUIVOS}`}
            </span>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 border-t pt-4">
        <h2 className="text-sm font-semibold">Conversa</h2>

        {pedido.mensagens.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Ainda não há conversa. Se precisar acrescentar alguma coisa, escreva
            abaixo.
          </p>
        ) : (
          <ul className="space-y-3">
            {pedido.mensagens.map((m) => (
              <li key={m.id} className="flex gap-2">
                <UserAvatar
                  name={m.autor?.nome ?? "—"}
                  src={m.autor?.avatar_url}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-medium">{m.autor?.nome ?? "—"}</span>{" "}
                    <span className="text-muted-foreground tabular-nums">
                      {format(parseISO(m.created_at), "dd/MM 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!somenteLeitura ? (
          <div className="space-y-2">
            <Label htmlFor="mensagem-do-pedido" className="sr-only">
              Escreva para a Full
            </Label>
            <Textarea
              id="mensagem-do-pedido"
              rows={2}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Acrescentar alguma coisa, ou responder o que perguntaram."
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
                Enviar
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
