"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, ExternalLink, Paperclip, Trash2 } from "lucide-react";

import {
  apagarAnexo,
  escreverNaSolicitacao,
  registrarAnexo,
} from "@/app/(cliente)/portal/_actions/solicitacoes";
import { PageHeader } from "@/components/shared/page-header";
import { SeloDaSolicitacao } from "@/components/shared/selo-da-solicitacao";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { PedidoCompleto } from "@/lib/dados/solicitacoes";
import {
  BUCKET_DOS_PEDIDOS,
  EXPLICACAO_PARA_O_CLIENTE,
  camposDoRoteiro,
  respostasParaLer,
} from "@/lib/dominio/solicitacoes";
import { criarClienteNavegador } from "@/lib/supabase/client";

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
  somenteLeitura = false,
}: {
  pedido: PedidoCompleto;
  base: string;
  somenteLeitura?: boolean;
}) {
  const [executando, comecar] = useTransition();
  const [subindo, setSubindo] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  const campos = camposDoRoteiro(pedido.roteiro?.campos_json);
  const respostas = respostasParaLer(campos, pedido.respostas);
  const cheio = pedido.anexos.length >= TETO_DE_ARQUIVOS;

  async function subir(escolhido: File | undefined) {
    if (!escolhido) return;
    setSubindo(true);
    try {
      const supabase = criarClienteNavegador();
      const extensao = escolhido.name.split(".").pop() ?? "bin";
      // A PASTA DA EMPRESA NA FRENTE, porque é ela que a policy do Storage
      // confere — `(storage.foldername(name))[1]`. Um caminho montado de outro
      // jeito é recusado pelo bucket, não por esta tela.
      const caminho = `${pedido.client_id}/${pedido.id}/${Date.now()}.${extensao}`;

      const { error } = await supabase.storage
        .from(BUCKET_DOS_PEDIDOS)
        .upload(caminho, escolhido, { contentType: escolhido.type });

      if (error) {
        toast.error(`Não foi possível anexar: ${error.message}`);
        return;
      }

      await chamarEMostrar(() =>
        registrarAnexo(pedido.id, {
          caminho,
          nome: escolhido.name,
          tipo: escolhido.type,
          tamanho: escolhido.size,
        }),
      );
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
        <p className="bg-danger-soft text-danger rounded-lg p-3 text-sm">{pedido.motivo_recusa}</p>
      ) : null}

      <p className="text-muted-foreground text-xs">
        Enviado em{" "}
        <span className="tabular-nums">
          {format(parseISO(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
              {format(parseISO(pedido.data_desejada), "dd/MM/yyyy", { locale: ptBR })}
            </strong>
            . A data que a Full vai assumir chega por aqui, na conversa.
          </span>
        </p>
      ) : null}

      {pedido.descricao ? (
        <p className="text-text-secondary text-sm whitespace-pre-wrap">{pedido.descricao}</p>
      ) : null}

      {respostas.length > 0 ? (
        <dl className="divide-y rounded-lg border">
          {respostas.map((r) => (
            <div key={r.rotulo} className="grid gap-1 p-3 sm:grid-cols-[12rem_1fr]">
              <dt className="text-muted-foreground text-sm">{r.rotulo}</dt>
              <dd className="text-sm whitespace-pre-wrap">{r.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Arquivos</h2>

        {pedido.anexos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum arquivo anexado.</p>
        ) : (
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
                  <span className="text-muted-foreground text-xs">Não foi possível abrir</span>
                )}
                {!somenteLeitura ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Apagar ${a.nome}`}
                    disabled={executando}
                    onClick={() =>
                      comecar(async () => {
                        await chamarEMostrar(() => apagarAnexo(a.id, pedido.id));
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
              aria-label="Escolher um arquivo para anexar"
              className="sr-only"
              onChange={(e) => subir(e.target.files?.[0])}
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
            Ainda não há conversa. Se precisar acrescentar alguma coisa, escreva abaixo.
          </p>
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
