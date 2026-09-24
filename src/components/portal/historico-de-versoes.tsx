"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { VersaoDoConteudo } from "@/lib/dados/conteudo";
import { cn } from "@/lib/utils";

/**
 * O histórico de versões, em painel lateral.
 *
 * **NÃO EXISTE BOTÃO DE REVERTER AQUI, e não é esquecimento.** Reverter uma
 * versão é decisão de produção: muda o que vai ao ar, e quem responde por isso
 * é a agência. O portal mostra o que mudou e quando, para o cliente conferir
 * se o pedido dele foi atendido — e só.
 *
 * A trava de verdade não é a ausência do botão: o cliente não tem policy de
 * INSERT nem de UPDATE em `post_versions` (migration 0032), e a bateria prova
 * isso com o comando cru. Quem acrescentar um botão aqui vai descobrir pela
 * recusa do banco, que é onde se quer descobrir.
 *
 * **A comparação é lado a lado, e o texto vem junto.** Ver duas artes sem ele
 * não responde a pergunta mais comum depois de um pedido de ajuste — "mudou a
 * legenda também?" no post, "é o arquivo novo?" no entregável de campanha.
 */
export function HistoricoDeVersoes({
  versoes,
  artes,
  versaoAtual,
  rotuloDoTexto,
}: {
  versoes: VersaoDoConteudo[];
  /** Endereços já assinados, por caminho. */
  artes: Record<string, string>;
  versaoAtual: number;
  /**
   * Como se chama o texto que acompanha a arte: "Legenda" no post, "Arquivo"
   * no entregável de campanha. Quem sabe disso é a tela, porque é ela que
   * sabe de que material se trata.
   */
  rotuloDoTexto: string;
}) {
  const [comparando, setComparando] = useState<number | null>(null);

  const endereco = (caminho: string | null) =>
    caminho ? (artes[caminho] ?? caminho) : null;

  const atual = versoes.find((v) => v.numero === versaoAtual) ?? versoes[0];
  const outra = versoes.find((v) => v.numero === comparando) ?? null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <History aria-hidden className="size-4" />
          Ver histórico de versões
          {versoes.length > 0 ? (
            <span className="text-text-muted tabular-nums">
              ({versoes.length})
            </span>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Histórico de versões</SheetTitle>
          <SheetDescription>
            Da mais recente para a mais antiga. Toque em &ldquo;Comparar&rdquo;
            para ver uma versão ao lado da atual.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          {versoes.length === 0 ? (
            <p className="text-text-muted text-sm">
              Este material ainda tem uma versão só.
            </p>
          ) : null}

          {outra && atual ? (
            <div className="space-y-3 rounded-xl border p-3">
              <p className="text-sm font-medium">
                Versão {outra.numero} e versão {atual.numero}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[outra, atual].map((versao) => (
                  <figure key={versao.id} className="space-y-2">
                    <div className="bg-neutral-soft aspect-square overflow-hidden rounded-lg border">
                      {endereco(versao.arteUrl) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={endereco(versao.arteUrl)!}
                          alt={`Arte da versão ${versao.numero}`}
                          className="size-full object-contain"
                        />
                      ) : null}
                    </div>
                    <figcaption className="text-text-muted text-xs">
                      Versão {versao.numero}
                    </figcaption>
                  </figure>
                ))}
              </div>

              {/* A DIFERENÇA DA LEGENDA fica em destaque quando existe, e a
                  frase é explícita quando não existe: "igual" é informação, e
                  um espaço em branco não é. */}
              <div className="space-y-2 text-sm">
                {outra.texto === atual.texto ? (
                  <p className="text-text-muted">{rotuloDoTexto} não mudou.</p>
                ) : (
                  <>
                    <p className="text-text-muted text-xs">
                      {rotuloDoTexto} da versão {outra.numero}
                    </p>
                    <p className="bg-neutral-soft rounded-lg p-2 whitespace-pre-wrap">
                      {outra.texto || "—"}
                    </p>
                    <p className="text-text-muted text-xs">
                      {rotuloDoTexto} da versão {atual.numero}
                    </p>
                    <p className="bg-blue-soft text-text-primary rounded-lg p-2 whitespace-pre-wrap">
                      {atual.texto || "—"}
                    </p>
                  </>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setComparando(null)}
              >
                Fechar comparação
              </Button>
            </div>
          ) : null}

          <ol className="space-y-3">
            {versoes.map((versao) => (
              <li
                key={versao.id}
                className={cn(
                  "flex gap-3 rounded-xl border p-3",
                  versao.numero === versaoAtual && "border-accent-strong",
                )}
              >
                <div className="bg-neutral-soft size-16 shrink-0 overflow-hidden rounded-lg border">
                  {endereco(versao.arteUrl) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={endereco(versao.arteUrl)!}
                      alt={`Arte da versão ${versao.numero}`}
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    Versão {versao.numero}
                    {versao.numero === versaoAtual ? " · atual" : ""}
                  </p>
                  <p className="text-text-muted text-xs tabular-nums">
                    {format(parseISO(versao.quando), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                    {versao.quem ? ` · ${versao.quem}` : ""}
                  </p>
                  {versao.notas ? (
                    <p className="text-sm">{versao.notas}</p>
                  ) : (
                    <p className="text-text-muted text-sm italic">
                      Sem nota sobre o que mudou.
                    </p>
                  )}

                  {versao.numero !== versaoAtual ? (
                    <button
                      type="button"
                      onClick={() => setComparando(versao.numero)}
                      className="text-accent-strong text-xs hover:underline"
                    >
                      Comparar com a atual
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </SheetContent>
    </Sheet>
  );
}
