"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ExternalLink,
  Flame,
  Heart,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { Resultado } from "@/lib/acoes/resultado";
import {
  CATEGORIAS,
  COR_DA_CATEGORIA,
  ORDENS,
  ROTULOS_DE_CATEGORIA,
  ROTULOS_DE_ORDEM,
  dominioDoLink,
  lerTags,
  tempoRelativo,
} from "@/lib/dominio/recomendacoes";
import type { EmAlta, PostDoFeed } from "@/lib/dados/recomendacoes";
import type { RecCategoria } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import {
  alternarCurtida,
  comentar,
  excluirComentario,
  excluirRecomendacao,
  publicarRecomendacao,
  removerComoGestao,
} from "./acoes";

export function Feed({
  posts,
  emAlta,
  nuvem,
  usuarioId,
  gestor,
  agoraISO,
  filtros,
}: {
  posts: PostDoFeed[];
  emAlta: EmAlta[];
  nuvem: { tag: string; quantas: number }[];
  usuarioId: string;
  gestor: boolean;
  agoraISO: string;
  filtros: { categoria: RecCategoria | null; tag: string | null; busca: string | null; ordem: "recentes" | "curtidas" };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const [executando, iniciar] = useTransition();
  const [postando, setPostando] = useState(false);
  const [termo, setTermo] = useState(filtros.busca ?? "");

  function navegar(chave: string, valor: string | null) {
    const destino = new URLSearchParams(parametros.toString());
    if (valor) destino.set(chave, valor);
    else destino.delete(chave);
    router.replace(`${pathname}?${destino.toString()}`, { scroll: false });
  }

  function responder(r: { ok: boolean; mensagem?: string; error?: string }) {
    if (r.ok) {
      toast.success(r.mensagem ?? "Pronto.");
      router.refresh();
    } else {
      toast.error(r.error ?? "Não foi possível.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div className="min-w-0 space-y-4">
        {postando ? (
          <FormularioDePost
            executando={executando}
            aoFechar={() => setPostando(false)}
            aoPublicar={(dados) =>
              iniciar(async () => {
                const r = await chamarAcao(() => publicarRecomendacao(dados));
                responder(r);
                if (r.ok) setPostando(false);
              })
            }
          />
        ) : (
          // O campo fechado é um convite, não um formulário: abrir oito campos
          // de uma vez num módulo leve é o jeito mais rápido de ninguém postar.
          <button
            type="button"
            onClick={() => setPostando(true)}
            className="rounded-card bg-surface-card text-text-muted hover:border-accent-strong w-full border px-4 py-3 text-left text-sm transition-colors"
          >
            O que você recomenda hoje?
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search
              aria-hidden
              className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              className="pl-9"
              value={termo}
              placeholder="Buscar no feed"
              aria-label="Buscar no feed"
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") navegar("busca", termo.trim() || null);
              }}
            />
          </div>

          <Select
            value={filtros.categoria ?? "todas"}
            onValueChange={(v) => navegar("categoria", v === "todas" ? null : v)}
          >
            <SelectTrigger className="w-40" aria-label="Categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {ROTULOS_DE_CATEGORIA[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            {ORDENS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => navegar("ordem", o === "recentes" ? null : o)}
                aria-pressed={filtros.ordem === o}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs",
                  filtros.ordem === o
                    ? "border-accent-strong bg-blue-soft text-accent-strong font-medium"
                    : "text-text-secondary hover:bg-muted",
                )}
              >
                {ROTULOS_DE_ORDEM[o]}
              </button>
            ))}
          </div>
        </div>

        {filtros.tag || filtros.busca ? (
          <div className="text-text-secondary flex flex-wrap items-center gap-2 text-xs">
            {filtros.tag ? (
              <Chip aoLimpar={() => navegar("tag", null)}>#{filtros.tag}</Chip>
            ) : null}
            {filtros.busca ? (
              <Chip
                aoLimpar={() => {
                  setTermo("");
                  navegar("busca", null);
                }}
              >
                “{filtros.busca}”
              </Chip>
            ) : null}
          </div>
        ) : null}

        {posts.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Nada por aqui ainda"
            description={
              filtros.categoria || filtros.tag || filtros.busca
                ? "Nenhuma recomendação combina com esse filtro."
                : "Seja a primeira pessoa a indicar alguma coisa. Um filme, um curso, uma ferramenta que economizou seu dia."
            }
          />
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id}>
                <CartaoDoPost
                  post={post}
                  usuarioId={usuarioId}
                  gestor={gestor}
                  agoraISO={agoraISO}
                  executando={executando}
                  aoFiltrarTag={(tag) => navegar("tag", tag)}
                  aoAgir={(fn) => iniciar(async () => responder(await chamarAcao(fn)))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-text-primary flex items-center gap-1.5 text-sm font-semibold">
            <Flame aria-hidden className="text-warning size-4" />
            Em alta este mês
          </h2>
          {emAlta.length === 0 ? (
            <p className="text-text-muted text-xs">
              Ainda sem curtidas nos últimos 30 dias.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {emAlta.map((item, indice) => (
                <li key={item.id} className="flex items-start gap-2 text-xs">
                  <span className="text-text-muted w-4 shrink-0 tabular-nums">
                    {indice + 1}.
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-text-primary block leading-snug">
                      {item.titulo}
                    </span>
                    <span className="text-text-muted">
                      {ROTULOS_DE_CATEGORIA[item.categoria]} · {item.quantas}{" "}
                      {item.quantas === 1 ? "curtida" : "curtidas"}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-text-primary text-sm font-semibold">Tags mais usadas</h2>
          {nuvem.length === 0 ? (
            <p className="text-text-muted text-xs">Nenhuma tag ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {nuvem.map(({ tag, quantas }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => navegar("tag", tag)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                    filtros.tag === tag
                      ? "border-accent-strong bg-blue-soft text-accent-strong"
                      : "text-text-secondary hover:bg-muted",
                  )}
                >
                  #{tag}
                  <span className="text-text-muted ml-1 tabular-nums">{quantas}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function Chip({ children, aoLimpar }: { children: React.ReactNode; aoLimpar: () => void }) {
  return (
    <span className="bg-blue-soft text-accent-strong inline-flex items-center gap-1 rounded-full px-2 py-1">
      {children}
      <button type="button" onClick={aoLimpar} aria-label="Limpar filtro">
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}

function CartaoDoPost({
  post,
  usuarioId,
  gestor,
  agoraISO,
  executando,
  aoFiltrarTag,
  aoAgir,
}: {
  post: PostDoFeed;
  usuarioId: string;
  gestor: boolean;
  agoraISO: string;
  executando: boolean;
  aoFiltrarTag: (tag: string) => void;
  aoAgir: (fn: () => Promise<Resultado<unknown>>) => void;
}) {
  const [comentando, setComentando] = useState(false);
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState<string | null>(null);

  const meu = post.autor_id === usuarioId;
  const relativo = tempoRelativo(post.created_at, agoraISO);
  const dominio = dominioDoLink(post.url);

  const raizes = post.comentarios.filter((c) => !c.respostaA);

  return (
    <article className="rounded-card bg-surface-card space-y-3 border p-4">
      <header className="flex items-start gap-3">
        <UserAvatar name={post.autor?.nome ?? "—"} src={post.autor?.avatar_url} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-sm font-medium">
            {post.autor?.nome ?? "Alguém da equipe"}
          </p>
          <p className="text-text-muted text-xs">
            {/* Acima de uma semana o relativo perde o sentido e a data seca
                informa mais — é por isso que `tempoRelativo` devolve null. */}
            {relativo ??
              format(parseISO(post.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            COR_DA_CATEGORIA[post.categoria],
          )}
        >
          {ROTULOS_DE_CATEGORIA[post.categoria]}
        </span>
      </header>

      <div className="space-y-2">
        <h3 className="text-text-primary text-sm font-semibold">{post.titulo}</h3>
        {post.descricao ? (
          <p className="text-text-secondary text-sm leading-relaxed">{post.descricao}</p>
        ) : null}

        {post.url ? (
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="text-accent-strong inline-flex items-center gap-1.5 text-xs hover:underline"
          >
            <ExternalLink aria-hidden className="size-3.5" />
            {dominio ?? post.url}
          </a>
        ) : null}

        {post.tags && post.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => aoFiltrarTag(tag)}
                className="text-text-muted hover:text-accent-strong text-xs"
              >
                #{tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={executando}
          aria-pressed={post.euCurti}
          onClick={() => aoAgir(() => alternarCurtida(post.id))}
          className={post.euCurti ? "text-danger" : "text-text-secondary"}
        >
          <Heart aria-hidden className={post.euCurti ? "fill-current" : undefined} />
          <span className="tabular-nums">{post.quantasCurtidas}</span>
          <span className="sr-only">
            {post.euCurti ? "Descurtir" : "Curtir"} “{post.titulo}”
          </span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-text-secondary"
          onClick={() => setComentando((a) => !a)}
          aria-expanded={comentando}
        >
          <MessageCircle aria-hidden />
          <span className="tabular-nums">{post.comentarios.length}</span>
          <span className="sr-only">Comentários de “{post.titulo}”</span>
        </Button>

        {meu ? (
          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="text-text-secondary ml-auto"
                disabled={executando}
              >
                <Trash2 aria-hidden />
                Apagar
              </Button>
            }
            title="Apagar sua recomendação?"
            description="Ela sai do feed junto com as curtidas e os comentários."
            confirmLabel="Apagar"
            destructive
            onConfirm={() => aoAgir(() => excluirRecomendacao(post.id))}
          />
        ) : gestor ? (
          // A gestão MODERA APAGANDO, nunca reescrevendo — a RLS de update
          // fecha no autor. E o motivo não é opcional: post que some sem
          // explicação é o jeito mais rápido de a equipe parar de postar.
          //
          // O campo do motivo mora DENTRO do diálogo, e isso é o desenho:
          // a primeira versão deixava um input aberto em cada cartão, e
          // três caixas de "Motivo da remoção" empilhadas viravam a coisa
          // mais alta da página — num feed cuja graça é ser leve. Moderar é
          // exceção; o que fica visível é curtir e comentar.
          <DialogoDeRemocao
            titulo={post.titulo}
            executando={executando}
            aoRemover={(razao) => aoAgir(() => removerComoGestao(post.id, razao))}
          />
        ) : null}
      </footer>

      {comentando || post.comentarios.length > 0 ? (
        <div className="space-y-3 border-t pt-3">
          {raizes.map((comentario) => {
            const respostas = post.comentarios.filter((c) => c.respostaA === comentario.id);
            return (
              <div key={comentario.id} className="space-y-2">
                <Comentario
                  comentario={comentario}
                  usuarioId={usuarioId}
                  gestor={gestor}
                  agoraISO={agoraISO}
                  executando={executando}
                  aoResponder={() =>
                    setRespondendo(respondendo === comentario.id ? null : comentario.id)
                  }
                  aoExcluir={() => aoAgir(() => excluirComentario(comentario.id))}
                />

                {respostas.length > 0 ? (
                  <div className="space-y-2 border-l pl-4">
                    {respostas.map((resposta) => (
                      <Comentario
                        key={resposta.id}
                        comentario={resposta}
                        usuarioId={usuarioId}
                        gestor={gestor}
                        agoraISO={agoraISO}
                        executando={executando}
                        aoExcluir={() => aoAgir(() => excluirComentario(resposta.id))}
                      />
                    ))}
                  </div>
                ) : null}

                {respondendo === comentario.id ? (
                  <CampoDeComentario
                    executando={executando}
                    placeholder={`Responder ${comentario.autor?.nome ?? ""}`}
                    aoEnviar={(t) => {
                      aoAgir(() => comentar(post.id, t, comentario.id));
                      setRespondendo(null);
                    }}
                  />
                ) : null}
              </div>
            );
          })}

          {comentando ? (
            <CampoDeComentario
              executando={executando}
              valor={texto}
              aoMudar={setTexto}
              placeholder="Escreva um comentário"
              aoEnviar={(t) => {
                aoAgir(() => comentar(post.id, t));
                setTexto("");
              }}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * A remoção pela gestão, com o motivo dentro do diálogo.
 *
 * O motivo é obrigatório na tela e na action: o autor recebe um aviso com
 * ele, e post que some sem explicação é o jeito mais rápido de a equipe
 * parar de postar. Três caracteres é o piso — não impede um motivo ruim,
 * impede o campo vazio.
 *
 * Não reaproveita o `ConfirmDialog` porque o modo de digitação de lá exige
 * um texto EXATO para liberar o botão; aqui o texto é livre e vira conteúdo
 * do aviso.
 */
function DialogoDeRemocao({
  titulo,
  executando,
  aoRemover,
}: {
  titulo: string;
  executando: boolean;
  aoRemover: (motivo: string) => void | Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [removendo, setRemovendo] = useState(false);

  const liberado = motivo.trim().length >= 3;

  async function remover() {
    if (!liberado || removendo) return;
    setRemovendo(true);
    try {
      await aoRemover(motivo.trim());
      setAberto(false);
      setMotivo("");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        setAberto(proximo);
        if (!proximo) setMotivo("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-text-secondary ml-auto"
          disabled={executando}
        >
          <Trash2 aria-hidden />
          Remover
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover “{titulo}”?</DialogTitle>
          <DialogDescription>
            A recomendação sai do feed junto com as curtidas e os comentários. Quem postou
            recebe um aviso com o motivo que você escrever aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`motivo-${titulo}`}>Motivo</Label>
          <Textarea
            id={`motivo-${titulo}`}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="O que fez esta recomendação sair do feed."
            rows={3}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={removendo}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={remover} disabled={!liberado || removendo}>
            {removendo ? <Loader2 className="animate-spin" /> : null}
            Remover e avisar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Comentario({
  comentario,
  usuarioId,
  gestor,
  agoraISO,
  executando,
  aoResponder,
  aoExcluir,
}: {
  comentario: PostDoFeed["comentarios"][number];
  usuarioId: string;
  gestor: boolean;
  agoraISO: string;
  executando: boolean;
  aoResponder?: () => void;
  aoExcluir: () => void;
}) {
  const meu = comentario.autor?.id === usuarioId;
  const relativo = tempoRelativo(comentario.created_at, agoraISO);

  return (
    <div className="flex items-start gap-2">
      <UserAvatar name={comentario.autor?.nome ?? "—"} src={comentario.autor?.avatar_url} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-text-primary text-xs">
          <span className="font-medium">{comentario.autor?.nome ?? "Alguém"}</span>{" "}
          <span className="text-text-muted">
            {relativo ?? format(parseISO(comentario.created_at), "dd/MM/yyyy")}
          </span>
        </p>
        <p className="text-text-secondary text-sm leading-relaxed">{comentario.texto}</p>

        <div className="flex gap-2">
          {/* Só o comentário RAIZ oferece responder: a thread tem um nível, e
              o trigger da 0017 recusa resposta de resposta. Oferecer o botão
              onde o banco recusa é o tipo de divergência que este produto
              evita de propósito. */}
          {aoResponder ? (
            <button
              type="button"
              onClick={aoResponder}
              className="text-text-muted hover:text-accent-strong text-xs"
            >
              Responder
            </button>
          ) : null}
          {meu || gestor ? (
            <button
              type="button"
              onClick={aoExcluir}
              disabled={executando}
              className="text-text-muted hover:text-danger text-xs"
            >
              Apagar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CampoDeComentario({
  valor,
  aoMudar,
  aoEnviar,
  placeholder,
  executando,
}: {
  valor?: string;
  aoMudar?: (v: string) => void;
  aoEnviar: (texto: string) => void;
  placeholder: string;
  executando: boolean;
}) {
  const [interno, setInterno] = useState("");
  const texto = valor ?? interno;
  const mudar = aoMudar ?? setInterno;

  return (
    <div className="flex items-end gap-2">
      <Textarea
        rows={1}
        value={texto}
        onChange={(e) => mudar(e.target.value)}
        placeholder={placeholder}
        className="min-h-9 resize-none"
      />
      <Button
        size="icon"
        variant="outline"
        aria-label="Enviar comentário"
        disabled={executando || !texto.trim()}
        onClick={() => {
          aoEnviar(texto);
          if (!aoMudar) setInterno("");
        }}
      >
        {executando ? <Loader2 className="animate-spin" /> : <Send aria-hidden />}
      </Button>
    </div>
  );
}

function FormularioDePost({
  aoFechar,
  aoPublicar,
  executando,
}: {
  aoFechar: () => void;
  aoPublicar: (dados: Record<string, unknown>) => void;
  executando: boolean;
}) {
  const [categoria, setCategoria] = useState<RecCategoria>("ferramenta");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");

  return (
    <section className="rounded-card bg-surface-card space-y-3 border p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-text-primary text-sm font-semibold">O que você recomenda?</h2>
        <Button variant="ghost" size="icon" aria-label="Fechar" onClick={aoFechar}>
          <X aria-hidden />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="rec-categoria">Categoria</Label>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as RecCategoria)}>
            <SelectTrigger id="rec-categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {ROTULOS_DE_CATEGORIA[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rec-titulo">Título *</Label>
          <Input
            id="rec-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Figma Slides"
            autoFocus
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rec-descricao">Por que vale</Label>
          <Textarea
            id="rec-descricao"
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Em uma linha: o que isso resolveu para você."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rec-url">Link</Label>
          <Input
            id="rec-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rec-tags">Tags</Label>
          <Input
            id="rec-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="design, apresentação"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={aoFechar} disabled={executando}>
          Cancelar
        </Button>
        <Button
          disabled={executando || titulo.trim().length < 2}
          onClick={() =>
            aoPublicar({ categoria, titulo, descricao, url, tags: lerTags(tags) })
          }
        >
          {executando ? <Loader2 className="animate-spin" /> : null}
          Publicar
        </Button>
      </div>
    </section>
  );
}
