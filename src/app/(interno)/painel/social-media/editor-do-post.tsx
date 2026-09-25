"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CircleAlert,
  ExternalLink,
  Film,
  Images,
  Loader2,
  Send,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  EXPLICACAO_DA_MIDIA,
  FORMATOS_SUGERIDOS,
  MIDIAS,
  PLATAFORMAS,
  ROTULO_DA_MAO,
  ROTULO_DA_MIDIA,
  ROTULO_DA_PLATAFORMA,
  SIGLA_DA_PLATAFORMA,
  faltaParaEnviar,
  maoDoPost,
  podeEnviarAoCliente,
  podeProduzir,
  type MaoDoPost,
} from "@/lib/dominio/posts";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { PostDaAgencia, VersaoDoPost } from "@/lib/dados/social-media";
import type { PlataformaSocial, PostMidia } from "@/lib/supabase/database.types";

import {
  editarPost,
  enviarAoCliente,
  excluirPost,
  gravarVersao,
  liberarPost,
  pedirAvalInterno,
} from "./acoes";

const SEM_VALOR = "__sem__";
const BUCKET = "posts-artes";

/** A corrente, desenhada. As quatro mãos, com a atual marcada. */
const CORRENTE: MaoDoPost[] = ["briefing", "producao", "revisao", "com_cliente"];

function Corrente({ atual }: { atual: MaoDoPost }) {
  const indice = atual === "encerrado" ? CORRENTE.length : CORRENTE.indexOf(atual);
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Onde o post está">
      {CORRENTE.map((mao, i) => {
        const passou = i < indice;
        const aqui = i === indice;
        return (
          <li key={mao} className="flex items-center gap-1.5">
            <span
              aria-current={aqui ? "step" : undefined}
              className={
                aqui
                  ? "bg-blue-soft text-accent-strong rounded-full px-2.5 py-1 text-xs font-medium"
                  : passou
                    ? "bg-success-soft text-success rounded-full px-2.5 py-1 text-xs"
                    : "bg-muted text-text-muted rounded-full px-2.5 py-1 text-xs"
              }
            >
              {ROTULO_DA_MAO[mao]}
            </span>
            {i < CORRENTE.length - 1 ? (
              <span aria-hidden className="text-text-muted text-xs">
                ›
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export type QuemLe = { id: string; ehGestor: boolean };

/**
 * O EDITOR DO POST, e ele é UM SÓ.
 *
 * A mesma peça serve à coluna direita da Lista e ao painel lateral do
 * Calendário — é `compacto` que muda, e mais nada. Duas telas parecidas
 * divergiriam na primeira mudança, e a divergência apareceria no lugar mais
 * caro: o botão que manda material para fora da agência.
 *
 * **Salva sozinho o que é texto**, com 600 ms de pausa, como a tela da Task.
 * O que NÃO salva sozinho é a versão: subir arte é um ato, e uma versão por
 * tecla encheria o histórico de linhas que ninguém pediu.
 */
export function EditorDoPost({
  post,
  versoes,
  equipe,
  quemLe,
  compacto = false,
  aoFechar,
}: {
  post: PostDaAgencia;
  versoes: VersaoDoPost[];
  equipe: { id: string; nome: string }[];
  quemLe: QuemLe;
  /** No painel lateral do calendário a grade de campos vira uma coluna. */
  compacto?: boolean;
  aoFechar?: () => void;
}) {
  const [tema, setTema] = useState(post.tema);
  const [legenda, setLegenda] = useState(post.legenda ?? "");
  const [videoUrl, setVideoUrl] = useState(post.videoUrl ?? "");
  const [subindo, setSubindo] = useState(false);
  const [emAcao, iniciar] = useTransition();
  const arquivoRef = useRef<HTMLInputElement>(null);

  const versaoAtual = versoes[0] ?? null;
  const slides = versaoAtual?.arquivos ?? [];
  const mao = maoDoPost(post);
  const posso = podeProduzir(post, quemLe);
  const envio = podeEnviarAoCliente(post, quemLe);
  const faltam = faltaParaEnviar(post);

  // SEM EFEITO PARA RESSINCRONIZAR O ESTADO, e a ausência é o conserto: quem
  // troca de post é o `key={post.id}` lá em `social-media.tsx`, que remonta a
  // peça inteira. Reescrever estado dentro de um `useEffect` dispara uma
  // renderização em cascata — e, pior, sobrescreveria o que a pessoa acabou
  // de digitar no instante em que o servidor revalidasse a página.
  function salvarDepois(campos: Record<string, unknown>) {
    if (!posso) return;
    const t = setTimeout(async () => {
      const r = await chamarAcao(() => editarPost(post.id, campos));
      if (!r.ok) toast.error(r.error);
    }, 600);
    return () => clearTimeout(t);
  }
  useEffect(() => {
    if (tema === post.tema) return;
    return salvarDepois({ tema });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema]);
  useEffect(() => {
    if ((post.legenda ?? "") === legenda) return;
    return salvarDepois({ legenda });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legenda]);
  useEffect(() => {
    if ((post.videoUrl ?? "") === videoUrl) return;
    if (videoUrl && !/^https?:\/\//i.test(videoUrl)) return;
    return salvarDepois({ video_url: videoUrl || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  async function agir(tarefa: () => Promise<{ ok: boolean; mensagem?: string; error?: string }>) {
    const r = await tarefa();
    if (r.ok) toast.success(r.mensagem ?? "Pronto.");
    else toast.error(r.error ?? "Não deu.");
  }

  /**
   * Subir arte.
   *
   * **O CAMINHO COMEÇA PELO id DA EMPRESA**, e não é capricho: a policy
   * "posts-artes: cliente le" compara `(storage.foldername(name))[1]` com as
   * empresas de quem está pedindo. Um arquivo solto na raiz a equipe vê e o
   * cliente não — e a arte aparece quebrada na tela dele.
   */
  async function subir(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setSubindo(true);
    try {
      const supabase = criarClienteNavegador();
      const subidos: { url: string; nome: string }[] = [];

      for (const arquivo of Array.from(arquivos)) {
        const extensao = arquivo.name.split(".").pop() ?? "png";
        const caminho = `${post.clienteId}/${post.id}-${Date.now()}-${subidos.length}.${extensao}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(caminho, arquivo, { contentType: arquivo.type });
        if (error) {
          toast.error(`Não foi possível enviar ${arquivo.name}: ${error.message}`);
          return;
        }
        subidos.push({ url: caminho, nome: arquivo.name });
      }

      const r = await chamarAcao(() =>
        gravarVersao(
          post.id,
          post.midia === "carrossel"
            ? { arquivos: subidos, legenda }
            : { arte_url: subidos[0].url, arquivos: [], legenda },
        ),
      );
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.error);
    } finally {
      setSubindo(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  }

  const grade = compacto ? "grid gap-3" : "grid gap-3 sm:grid-cols-2";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-text-muted text-xs tracking-wide uppercase">
            {post.cliente} ·{" "}
            {format(parseISO(post.dataPublicacao), "d 'de' MMMM", { locale: ptBR })}
          </p>
          <h2 className="text-text-primary mt-0.5 truncate text-lg font-semibold">
            {post.tema}
          </h2>
        </div>
        {aoFechar ? (
          <Button variant="ghost" size="sm" onClick={aoFechar} aria-label="Fechar">
            ✕
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <span aria-hidden>{SIGLA_DA_PLATAFORMA[post.plataforma]}</span>
          <span className="sr-only">{ROTULO_DA_PLATAFORMA[post.plataforma]}</span>
          {post.formato ?? ROTULO_DA_MIDIA[post.midia]}
        </Badge>
        {post.responsavel ? (
          <span className="text-text-secondary text-xs">com {post.responsavel}</span>
        ) : (
          <span className="text-warning text-xs">sem responsável</span>
        )}
      </div>

      <Corrente atual={mao} />

      {/* A ARTE ANTES DOS BOTÕES, como no portal: botão antes da arte convida
          a decidir sem olhar. Aqui a razão é a mesma, um passo antes. */}
      {post.midia === "video" ? (
        <div className="space-y-2">
          <Label htmlFor={`video-${post.id}`}>Link do vídeo</Label>
          <Input
            id={`video-${post.id}`}
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            disabled={!posso}
          />
          {/* O CUSTO DITO EM VOZ ALTA. Vídeo é por link e não por upload
              (decisão do usuário): o cliente sai do portal para assistir, e
              decide longe do botão de aprovar. */}
          <p className="text-text-muted text-xs">
            O cliente assiste fora do portal, numa aba nova. Sem o link, o banco
            recusa o envio.
          </p>
          {videoUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden className="size-4" />
                Abrir o vídeo
              </a>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="bg-muted grid aspect-[4/5] max-h-72 place-items-center overflow-hidden rounded-lg">
            {post.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.thumbnailUrl}
                alt={`Arte de ${post.tema}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-text-muted text-sm">sem arte ainda</span>
            )}
          </div>

          {/* A FAIXA DE SLIDES só existe no carrossel, e a capa é o primeiro —
              é ele que o calendário, o card e o portal mostram. */}
          {post.midia === "carrossel" && slides.length > 0 ? (
            <ol className="flex flex-wrap gap-1.5">
              {slides.map((s, i) => (
                <li key={s.url} className="relative">
                  <span className="bg-muted block size-12 overflow-hidden rounded-md">
                    {s.assinada ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.assinada}
                        alt={`Slide ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="bg-surface-card text-text-secondary absolute right-0.5 bottom-0.5 rounded px-1 text-[10px]">
                    {i + 1}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          {posso ? (
            <>
              <input
                ref={arquivoRef}
                type="file"
                accept="image/*"
                multiple={post.midia === "carrossel"}
                className="sr-only"
                onChange={(e) => subir(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center"
                disabled={subindo}
                onClick={() => arquivoRef.current?.click()}
              >
                {subindo ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : post.midia === "carrossel" ? (
                  <Images aria-hidden className="size-4" />
                ) : (
                  <Upload aria-hidden className="size-4" />
                )}
                {post.midia === "carrossel"
                  ? "Subir os slides"
                  : post.arteUrl
                    ? "Trocar a arte"
                    : "Subir a arte"}
              </Button>
              <p className="text-text-muted text-xs">
                Cada subida grava uma versão nova. As anteriores continuam no
                histórico.
              </p>
            </>
          ) : null}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`tema-${post.id}`}>Tema</Label>
        <Input
          id={`tema-${post.id}`}
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          disabled={!posso}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`legenda-${post.id}`}>Legenda</Label>
        <Textarea
          id={`legenda-${post.id}`}
          rows={compacto ? 4 : 6}
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          disabled={!posso}
        />
        <p className="text-text-muted text-xs tabular-nums">
          {legenda.length} caracteres
          {post.midia === "carrossel" && slides.length > 0
            ? ` · ${slides.length} slides`
            : ""}
        </p>
      </div>

      {/* MÍDIA, REDE E FORMATO. A mídia decide o editor, então trocá-la com
          slides no ar é recusado pela própria tela — ver a frase abaixo. */}
      <div className={grade}>
        <div className="space-y-1.5">
          <Label htmlFor={`midia-${post.id}`}>Mídia</Label>
          <Select
            value={post.midia}
            disabled={!posso || slides.length > 1}
            onValueChange={(v) =>
              iniciar(() =>
                agir(() => chamarAcao(() => editarPost(post.id, { midia: v as PostMidia }))),
              )
            }
          >
            <SelectTrigger id={`midia-${post.id}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MIDIAS.map((m) => (
                <SelectItem key={m} value={m}>
                  {ROTULO_DA_MIDIA[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-text-muted text-xs">
            {slides.length > 1
              ? "Para trocar, remova os slides antes — senão eles ficariam no bucket sem tela que os mostre."
              : EXPLICACAO_DA_MIDIA[post.midia]}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`rede-${post.id}`}>Rede</Label>
          <Select
            value={post.plataforma}
            disabled={!posso}
            onValueChange={(v) =>
              iniciar(() =>
                agir(() =>
                  chamarAcao(() => editarPost(post.id, { plataforma: v as PlataformaSocial })),
                ),
              )
            }
          >
            <SelectTrigger id={`rede-${post.id}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATAFORMAS.map((p) => (
                <SelectItem key={p} value={p}>
                  {ROTULO_DA_PLATAFORMA[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`formato-${post.id}`}>Formato</Label>
          {/* TEXTO COM SUGESTÃO, e não `<select>`: `formato` é texto desde a
              0032 justamente porque nome comercial de plataforma muda a cada
              temporada. Uma lista fechada pediria deploy no dia do nome novo. */}
          <Input
            id={`formato-${post.id}`}
            list={`formatos-${post.id}`}
            defaultValue={post.formato ?? ""}
            disabled={!posso}
            placeholder="Feed, Stories, Reels…"
            onBlur={(e) =>
              e.target.value !== (post.formato ?? "") &&
              iniciar(() =>
                agir(() => chamarAcao(() => editarPost(post.id, { formato: e.target.value }))),
              )
            }
          />
          <datalist id={`formatos-${post.id}`}>
            {(FORMATOS_SUGERIDOS[post.plataforma] ?? []).map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>

        {quemLe.ehGestor ? (
          <div className="space-y-1.5">
            <Label htmlFor={`resp-${post.id}`}>Responsável</Label>
            <Select
              value={post.responsavelId ?? SEM_VALOR}
              onValueChange={(v) =>
                iniciar(() =>
                  agir(() => chamarAcao(() => liberarPost(post.id, v === SEM_VALOR ? null : v))),
                )
              }
            >
              <SelectTrigger id={`resp-${post.id}`} className="w-full">
                <SelectValue placeholder="Liberar para…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_VALOR}>Ninguém ainda</SelectItem>
                {equipe.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {/* AS AÇÕES DA CORRENTE. O botão de enviar aparece DESLIGADO com a razão
          escrita, em vez de sumir: um botão que some ensina que não existe; um
          desligado que diz por quê ensina a regra — e a regra é do banco. */}
      <div className="border-border space-y-3 border-t pt-4">
        {post.enviadoEm ? (
          <p className="bg-blue-soft text-accent-strong rounded-lg px-3 py-2 text-sm">
            Enviado ao cliente em{" "}
            {format(parseISO(post.enviadoEm.slice(0, 10)), "dd/MM", { locale: ptBR })}.
            {post.esperandoCliente ? " Ele ainda não decidiu." : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {!post.avalInterno && posso && !post.enviadoEm ? (
            <Button
              variant="outline"
              size="sm"
              disabled={emAcao}
              onClick={() =>
                iniciar(() => agir(() => chamarAcao(() => pedirAvalInterno(post.id))))
              }
            >
              <UserPlus aria-hidden className="size-4" />
              Marcar como pronto
            </Button>
          ) : null}

          <Button
            size="sm"
            disabled={!envio.pode || emAcao}
            title={envio.porque ?? undefined}
            onClick={() =>
              iniciar(() => agir(() => chamarAcao(() => enviarAoCliente(post.id))))
            }
          >
            <Send aria-hidden className="size-4" />
            Enviar ao cliente
          </Button>

          {quemLe.ehGestor ? (
            <ConfirmDialog
              title="Excluir este post?"
              description="A arte, as versões e os comentários somem junto. Se ele já foi ao cliente, a decisão dele some também."
              confirmLabel="Excluir"
              destructive
              onConfirm={async () => {
                await agir(() => chamarAcao(() => excluirPost(post.id)));
                aoFechar?.();
              }}
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive ml-auto">
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              }
            />
          ) : null}
        </div>

        {!envio.pode && envio.porque ? (
          <p className="text-text-secondary flex items-start gap-2 text-xs">
            <CircleAlert aria-hidden className="text-warning mt-0.5 size-3.5 shrink-0" />
            {envio.porque}
          </p>
        ) : null}
        {faltam.length === 0 && !envio.pode && !quemLe.ehGestor ? null : null}
      </div>

      {versoes.length > 0 ? (
        <div className="border-border border-t pt-4">
          <p className="text-text-muted mb-2 text-xs tracking-wide uppercase">Versões</p>
          <ul className="space-y-1.5">
            {versoes.map((v) => (
              <li key={v.id} className="text-text-secondary text-xs">
                v{v.numero} · {format(parseISO(v.quando.slice(0, 10)), "dd/MM")} ·{" "}
                {v.autor ?? "—"}
                {v.arquivos.length > 0 ? (
                  <span className="text-text-muted"> — {v.arquivos.length} slides</span>
                ) : null}
                {v.videoUrl ? (
                  <span className="text-text-muted">
                    {" "}
                    — <Film aria-hidden className="inline size-3" /> vídeo
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {/* SEM BOTÃO DE REVERTER, nem aqui. Reverter muda o que vai ao ar; o
              caminho é subir a versão nova, que é o que o histórico registra. */}
        </div>
      ) : null}
    </div>
  );
}
