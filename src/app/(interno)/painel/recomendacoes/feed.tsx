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
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import type { PostDoFeed } from "@/lib/dados/recomendacoes";

import { Cartao } from "./cartao";
import type { RecCategoria } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import {
  alternarCurtida,
  buscarPreviaDoLink,
  comentar,
  excluirComentario,
  excluirRecomendacao,
  publicarRecomendacao,
  removerComoGestao,
} from "./acoes";

export function Feed({
  posts,
  destaques,
  nuvem,
  usuarioId,
  gestor,
  agoraISO,
  filtros,
}: {
  posts: PostDoFeed[];
  /** O que foi curtido no último mês, já como post inteiro — o cartão dos
   *  Destaques é o MESMO da grade, com `destaque`, e um cartão diferente ali
   *  divergiria do outro na primeira mudança. */
  destaques: PostDoFeed[];
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
  const [aberto, setAberto] = useState<string | null>(null);

  // O PAINEL LÊ DA LISTA, e não guarda uma cópia do post: curtir com ele
  // aberto atualiza a grade, e um estado próprio mostraria o coração vazio ao
  // lado do cheio. Se o post sumir da lista (filtro trocado, post apagado), o
  // painel fecha sozinho — melhor que ficar aberto sobre o que não existe.
  const emFoco =
    posts.find((p) => p.id === aberto) ??
    destaques.find((p) => p.id === aberto) ??
    null;

  const temFiltro = Boolean(filtros.categoria || filtros.tag || filtros.busca);

  // OS DESTAQUES SÓ APARECEM SEM FILTRO, e a grade NÃO REPETE o que está
  // neles.
  //
  // Foi a imagem do protótipo que mostrou: quatro recomendações viravam seis
  // cartões na tela, duas delas idênticas a um palmo de distância. "Destaque"
  // que aparece de novo logo abaixo não destaca nada — vira a suspeita de que
  // a tela duplicou.
  //
  // A alternativa era deixar a grade inteira e diferenciar os destaques só
  // pelo tamanho. Num feed de agência, com quatro ou cinco posts por mês, o
  // mesmo cartão em dois tamanhos na mesma dobra é pior que a repetição
  // óbvia: parece defeito.
  const emDestaque = temFiltro ? [] : destaques;
  const idsEmDestaque = new Set(emDestaque.map((p) => p.id));
  const naGrade = posts.filter((p) => !idsEmDestaque.has(p.id));
  /** O feed que nunca teve nada — não o que um filtro esvaziou. */
  const semNada = posts.length === 0 && !temFiltro;

  function limparFiltros() {
    setTermo("");
    router.replace(pathname, { scroll: false });
  }

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
    <div className="space-y-5">
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

      {/* BUSCA E CHIPS SOMEM NO FEED VAZIO DE VERDADE (sem post e sem filtro),
          e é a imagem do primeiro dia que pede isso: uma busca e nove
          categorias sobre um convite para postar são nove filtros de nada.
          Com filtro ativo eles FICAM, senão quem buscou "motion" e não achou
          perderia o caminho de volta. */}
      {semNada ? null : (
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

      )}

      {/* AS CATEGORIAS VIRARAM CHIPS, e não um `<select>`: são oito, cabem numa
          linha, e o que se faz com elas é trocar de uma para outra até achar.
          Num select, cada troca são dois cliques e a lista fechada esconde
          quais existem. */}
      {semNada ? null : (
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <ChipDeFiltro
          ativo={filtros.categoria === null}
          onClick={() => navegar("categoria", null)}
        >
          Todas
        </ChipDeFiltro>
        {CATEGORIAS.map((c) => (
          <ChipDeFiltro
            key={c}
            ativo={filtros.categoria === c}
            onClick={() => navegar("categoria", filtros.categoria === c ? null : c)}
          >
            {ROTULOS_DE_CATEGORIA[c]}
          </ChipDeFiltro>
        ))}
      </div>
      )}

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

      {/* DESTAQUES: o que foi curtido no último mês, em cartões maiores.
          Aparece com UM item ou mais — decisão do usuário. A regra original
          pedia três, e numa agência de nove pessoas uma semana com três posts
          curtidos não é o caso comum: o bloco passaria a maior parte do tempo
          invisível, que é o mesmo que não existir.

          **E ele some quando há filtro ativo.** "Destaques" ao lado de uma
          grade filtrada por Ferramenta seria a tela contradizendo o próprio
          filtro — a mesma decisão que a vitrine da Academy já tinha tomado. */}
      {emDestaque.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-text-primary flex items-center gap-1.5 text-sm font-semibold">
            <Flame aria-hidden className="text-warning size-4" />
            Destaques do mês
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {emDestaque.map((post) => (
              <li key={post.id}>
                <Cartao
                  post={post}
                  agoraISO={agoraISO}
                  destaque
                  curtindo={executando}
                  aoAbrir={() => setAberto(post.id)}
                  aoCurtir={() =>
                    iniciar(async () =>
                      responder(await chamarAcao(() => alternarCurtida(post.id))),
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {posts.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          // O TITULO TROCA COM O CORPO. "Nada por aqui ainda" diz que o feed
          // nunca teve nada -- sobre uma busca por "motion" ele afirma o
          // contrario do que aconteceu: tem coisa, so nao essa.
          title={temFiltro ? "Nenhum resultado" : "Nada por aqui ainda"}
          description={
            temFiltro
              ? "Nenhuma recomendação combina com esse filtro."
              : "Um filme, um curso, uma ferramenta que economizou seu dia."
          }
          action={
            temFiltro ? (
              <Button variant="outline" onClick={() => limparFiltros()}>
                Limpar os filtros
              </Button>
            ) : (
              // O VAZIO CONVIDA em vez de constatar: "nenhum resultado" é o
              // fim da conversa; um botão é a continuação dela.
              <Button onClick={() => setPostando(true)}>
                <Plus aria-hidden className="size-4" />
                Fazer a primeira recomendação
              </Button>
            )
          }
        />
      ) : (
        /* GRADE DE CARTÕES, três colunas no desktop.
           É `grid` e não colunas CSS: com `columns`, a ordem de leitura desce
           a primeira coluna inteira antes de voltar ao topo — num feed
           ordenado por "recentes", o segundo post mais novo apareceria no meio
           da tela. A altura desigual dos cartões é resolvida por
           `items-start`, e não por mosaico. */
        <ul className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {naGrade.map((post) => (
            <li key={post.id}>
              <Cartao
                post={post}
                agoraISO={agoraISO}
                curtindo={executando}
                aoAbrir={() => setAberto(post.id)}
                aoCurtir={() =>
                  iniciar(async () =>
                    responder(await chamarAcao(() => alternarCurtida(post.id))),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}

      {nuvem.length > 0 ? (
        <section className="space-y-2 border-t pt-4">
          <h2 className="text-text-muted text-xs font-medium tracking-wide uppercase">
            Tags mais usadas
          </h2>
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
        </section>
      ) : null}

      {/* O DETALHE ABRE EM PAINEL LATERAL, e não em página nova: quem está
          varrendo o feed volta para o mesmo ponto da grade, com o mesmo
          filtro, sem recarregar nada. É a mesma decisão de Minhas Tasks. */}
      <Sheet open={emFoco !== null} onOpenChange={(v) => !v && setAberto(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {emFoco ? (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{emFoco.titulo}</SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <CartaoDoPost
                  post={emFoco}
                  usuarioId={usuarioId}
                  gestor={gestor}
                  agoraISO={agoraISO}
                  executando={executando}
                  semMoldura
                  aoFiltrarTag={(tag) => {
                    setAberto(null);
                    navegar("tag", tag);
                  }}
                  aoAgir={(fn) => iniciar(async () => responder(await chamarAcao(fn)))}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Um chip de filtro: ativo em `--blue-soft` com texto `--blue-strong`. */
function ChipDeFiltro({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
        ativo
          ? "border-accent-strong bg-blue-soft text-accent-strong font-medium"
          : "text-text-secondary hover:bg-muted",
      )}
    >
      {children}
    </button>
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
  semMoldura = false,
  aoFiltrarTag,
  aoAgir,
}: {
  post: PostDoFeed;
  usuarioId: string;
  gestor: boolean;
  agoraISO: string;
  executando: boolean;
  /**
   * Dentro do painel lateral, sem borda nem fundo próprios.
   *
   * O painel JÁ É a moldura — um cartão com borda dentro de uma gaveta com
   * borda lê como duas caixas, e a de dentro parece um item de uma lista que
   * não existe ali.
   */
  semMoldura?: boolean;
  aoFiltrarTag: (tag: string) => void;
  aoAgir: (fn: () => Promise<Resultado<unknown>>) => void;
}) {
  // NO PAINEL O CAMPO JA NASCE ABERTO, e na grade nao. Sao duas perguntas
  // diferentes: quem varre a grade quer ver o que tem; quem abriu o painel
  // ja escolheu este post -- responder e uma das duas coisas que se faz ali,
  // e obrigar um clique a mais para achar a caixa de texto e pôr uma porta
  // onde havia um caminho. Foi a imagem do painel que mostrou: a thread
  // terminava no ultimo comentario, sem onde escrever o proximo.
  const [comentando, setComentando] = useState(semMoldura);
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState<string | null>(null);

  const meu = post.autor_id === usuarioId;
  const relativo = tempoRelativo(post.created_at, agoraISO);
  const dominio = dominioDoLink(post.url);

  const raizes = post.comentarios.filter((c) => !c.respostaA);

  return (
    <article
      className={cn(
        "space-y-3",
        !semMoldura && "rounded-card bg-surface-card border p-4",
      )}
    >
      {/* A ARTE GRANDE ABRE O PAINEL, e só nele: na grade ela já é a capa do
          cartão, e repeti-la aqui seria mostrar a mesma imagem duas vezes na
          mesma tela. */}
      {semMoldura && post.imagem_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imagem_url}
          alt=""
          className="aspect-video w-full rounded-lg border object-cover"
        />
      ) : null}

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
  const [imagem, setImagem] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  /**
   * Colar o link preenche o resto.
   *
   * **E só preenche o que está VAZIO.** Quem digitou o título e colou o link
   * depois não pode ver o próprio texto ser trocado pelo do site — é a mesma
   * regra do responsável padrão da recorrência, `coalesce(o que a pessoa
   * escreveu, o que veio de fora)`, nessa ordem.
   *
   * **E nada trava.** Um site sem Open Graph, fora do ar, ou recusado pelo
   * guarda de rede interna devolve o motivo num toast discreto e os campos
   * continuam manuais. O preview é atalho, não requisito.
   */
  async function puxar(endereco: string) {
    const limpo = endereco.trim();
    if (!/^https?:\/\//i.test(limpo)) return;

    setBuscando(true);
    try {
      const r = await chamarAcao(() => buscarPreviaDoLink(limpo));
      if (!r.ok) {
        toast.message("Sem prévia deste link", { description: r.error });
        return;
      }
      const previa = r.dados;
      if (!previa) return;
      if (previa.titulo && !titulo.trim()) setTitulo(previa.titulo);
      if (previa.descricao && !descricao.trim()) setDescricao(previa.descricao);
      if (previa.imagem) setImagem(previa.imagem);
    } finally {
      setBuscando(false);
    }
  }

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
            <SelectTrigger aria-label="Categoria" id="rec-categoria" className="w-full">
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

        {/* LINK E TAGS OCUPAM A LARGURA INTEIRA, e nao meia coluna cada.
            A grade e `[10rem_1fr]`: com um em cada lado, o endereco -- que e
            o valor mais longo do formulario -- caia na coluna de 10rem, e a
            linha de ajuda embaixo dele quebrava em duas. Foi a imagem que
            mostrou. */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rec-url">Link</Label>
          <div className="relative">
            <Input
              id="rec-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              // NO `paste` E NO `blur`: colar é o caminho de quem veio do
              // navegador, sair do campo é o de quem digitou. Buscar a cada
              // tecla seria uma requisição por letra.
              onPaste={(e) => {
                const colado = e.clipboardData.getData("text");
                if (colado) void puxar(colado);
              }}
              onBlur={(e) => void puxar(e.target.value)}
              placeholder="https://…"
            />
            {buscando ? (
              <Loader2
                aria-hidden
                className="text-text-muted absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
              />
            ) : null}
          </div>
          <p className="text-text-muted text-xs">
            {buscando
              ? "Buscando título e imagem…"
              : "Colar um link preenche o resto. Tudo continua editável."}
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rec-tags">Tags</Label>
          <Input
            id="rec-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="design, apresentação"
          />
        </div>

        {/* A IMAGEM ACHADA, com o botão de tirar. Ela aparece porque é o que
            vai virar a capa do cartão — sem mostrá-la, a pessoa só descobre
            qual imagem o site deu depois de publicar. */}
        {imagem ? (
          <div className="flex items-center gap-3 sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagem}
              alt=""
              className="h-16 w-28 shrink-0 rounded-md border object-cover"
            />
            <div className="min-w-0">
              <p className="text-text-secondary text-sm">Capa encontrada no link.</p>
              <Button variant="ghost" size="sm" onClick={() => setImagem(null)}>
                Usar sem imagem
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={aoFechar} disabled={executando}>
          Cancelar
        </Button>
        <Button
          disabled={executando || titulo.trim().length < 2}
          onClick={() =>
            aoPublicar({
              categoria,
              titulo,
              descricao,
              url,
              imagem_url: imagem,
              tags: lerTags(tags),
            })
          }
        >
          {executando ? <Loader2 className="animate-spin" /> : null}
          Publicar
        </Button>
      </div>
    </section>
  );
}
