import { ArrowUpRight, ExternalLink, TrendingUp } from "lucide-react";

import { ImagemAssinada } from "@/components/shared/imagem-assinada";
import {
  numeroPorExtenso,
  periodoPorExtenso,
  variacaoDaLinha,
  type BlocoDoRelatorio,
} from "@/lib/dominio/relatorios";

/**
 * A LEITURA DO RELATÓRIO — a mesma no portal do cliente e na prévia da equipe.
 *
 * Sem `"use client"` de propósito: ela não tem estado, então serve à página do
 * portal (servidor) e à prévia do editor (cliente) sem duas cópias.
 */
export function LeituraDoRelatorio({
  cliente,
  titulo,
  subtitulo,
  periodoInicio,
  periodoFim,
  blocos,
  imagens,
}: {
  cliente: string;
  titulo: string;
  subtitulo: string | null;
  periodoInicio: string;
  periodoFim: string;
  blocos: BlocoDoRelatorio[];
  imagens: Record<string, string>;
}) {
  return (
    <article className="space-y-6" data-tour="relatorio-leitura">
      <header className="bg-card rounded-2xl border p-6 sm:p-10">
        <p className="text-text-muted text-sm">{cliente}</p>
        <h2 className="mt-1 text-[clamp(26px,4vw,44px)] leading-[1.05] font-bold tracking-[-0.045em] text-balance">
          {titulo}
        </h2>
        {subtitulo ? <p className="mt-2 text-lg">{subtitulo}</p> : null}
        <p className="text-text-muted mt-4 text-sm">
          {periodoPorExtenso(periodoInicio, periodoFim)}
        </p>
      </header>

      {blocos.map((bloco, i) => (
        <section key={i} className="bg-card rounded-2xl border p-6 sm:p-8">
          <Bloco bloco={bloco} imagens={imagens} />
        </section>
      ))}
    </article>
  );
}

function Titulo({ children }: { children: string }) {
  if (!children) return null;
  return (
    <h3 className="mb-5 text-xl font-bold tracking-[-0.03em] text-balance">
      {children}
    </h3>
  );
}

function Bloco({
  bloco,
  imagens,
}: {
  bloco: BlocoDoRelatorio;
  imagens: Record<string, string>;
}) {
  switch (bloco.tipo) {
    case "destaques":
      return (
        <>
          <Titulo>{bloco.titulo}</Titulo>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bloco.itens
              .filter((i) => i.numero || i.legenda)
              .map((item, i) => (
                <div key={i} className="bg-muted rounded-xl p-5">
                  <p className="text-action text-4xl leading-none font-bold tracking-[-0.04em]">
                    {item.numero}
                  </p>
                  <p className="mt-2 font-medium">{item.legenda}</p>
                  {item.texto ? (
                    <p className="text-text-muted mt-1 text-sm">{item.texto}</p>
                  ) : null}
                </div>
              ))}
          </div>
        </>
      );

    case "crescimento":
      return (
        <>
          <Titulo>{bloco.titulo}</Titulo>
          {bloco.texto ? (
            <p className="text-text-muted mb-5 text-sm whitespace-pre-line">
              {bloco.texto}
            </p>
          ) : null}
          <div className="mb-4 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-border size-2.5 rounded-sm" /> Período anterior
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-action size-2.5 rounded-sm" /> Este período
            </span>
          </div>
          <div className="space-y-5">
            {bloco.linhas
              .filter((l) => l.metrica && (l.atual > 0 || l.anterior > 0))
              .map((linha, i) => {
                const v = variacaoDaLinha(linha);
                return (
                  <div key={i}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <p className="font-medium">{linha.metrica}</p>
                      {v.cresceu ? (
                        <p className="text-success flex items-center gap-1 text-sm font-bold">
                          <TrendingUp className="size-4" aria-hidden />
                          {v.percentual !== null
                            ? `+${v.percentual}%`
                            : `+${numeroPorExtenso(linha.atual)}`}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Barra
                        largura={v.larguraAnterior}
                        valor={linha.anterior}
                        cor="bg-border"
                      />
                      <Barra
                        largura={v.larguraAtual}
                        valor={linha.atual}
                        cor="bg-action"
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      );

    case "posts":
      return (
        <>
          <Titulo>{bloco.titulo}</Titulo>
          {bloco.rede || bloco.texto ? (
            <p className="text-text-muted mb-5 text-sm whitespace-pre-line">
              {[bloco.rede, bloco.texto].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <div className="space-y-6">
            {bloco.itens
              .filter((p) => p.nome || p.imagem)
              .map((post, i) => (
                <div
                  key={i}
                  className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]"
                >
                  <div className="bg-muted aspect-[4/5] overflow-hidden rounded-xl">
                    {post.imagem && imagens[post.imagem] ? (
                      <ImagemAssinada
                        src={imagens[post.imagem]}
                        alt={post.nome}
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-lg font-bold">{post.nome}</p>
                    {post.publicadoEm ? (
                      <p className="text-text-muted text-sm">
                        Publicado em {post.publicadoEm}
                      </p>
                    ) : null}
                    <dl className="mt-4 grid grid-cols-2 gap-3">
                      {post.metricas
                        .filter((m) => m.rotulo && m.valor)
                        .map((m, j) => (
                          <div key={j} className="bg-muted rounded-lg p-3">
                            <dd className="text-2xl leading-none font-bold tracking-[-0.03em]">
                              {m.valor}
                            </dd>
                            <dt className="text-text-muted mt-1 text-xs">
                              {m.rotulo}
                            </dt>
                          </div>
                        ))}
                    </dl>
                    {post.legenda ? (
                      <p className="mt-4 text-sm whitespace-pre-line">
                        {post.legenda}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
        </>
      );

    case "texto":
      return (
        <>
          <Titulo>{bloco.titulo}</Titulo>
          <p className="max-w-[70ch] whitespace-pre-line">{bloco.texto}</p>
        </>
      );

    case "referencias":
      return (
        <>
          <Titulo>{bloco.titulo}</Titulo>
          <div className="grid gap-4 sm:grid-cols-2">
            {bloco.itens
              .filter((r) => r.titulo || r.texto || r.imagem)
              .map((ref, i) => (
                <div key={i} className="bg-muted overflow-hidden rounded-xl">
                  {ref.imagem && imagens[ref.imagem] ? (
                    <ImagemAssinada
                      src={imagens[ref.imagem]}
                      alt={ref.titulo}
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  <div className="p-4">
                    <p className="font-bold">{ref.titulo}</p>
                    {ref.texto ? (
                      <p className="text-text-muted mt-1 text-sm whitespace-pre-line">
                        {ref.texto}
                      </p>
                    ) : null}
                    {/^https?:\/\//i.test(ref.link) ? (
                      <a
                        href={ref.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-action mt-2 inline-flex items-center gap-1 text-sm font-medium"
                      >
                        Abrir a referência
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
        </>
      );
  }
}

function Barra({
  largura,
  valor,
  cor,
}: {
  largura: number;
  valor: number;
  cor: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
        <div
          className={`${cor} h-full rounded-full`}
          style={{ width: `${Math.max(largura, 2)}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm tabular-nums">
        {numeroPorExtenso(valor)}
      </span>
    </div>
  );
}

/** O cartão de um relatório numa lista — do painel e do portal. */
export function SetaDoCartao() {
  return <ArrowUpRight className="text-text-muted size-4 shrink-0" aria-hidden />;
}
