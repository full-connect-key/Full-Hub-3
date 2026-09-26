"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  ImageIcon,
  Loader2,
  Send,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { VersaoDoConteudo } from "@/lib/dados/conteudo";
import type {
  EntregavelDoPortal,
  NoDaArvore,
} from "@/lib/dominio/campanhas";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import {
  enviarEntregavelAoCliente,
  gravarVersaoDoEntregavel,
} from "../../acoes-de-campanha";

const BUCKET = "campanhas-arquivos";

/** O que o navegador desenha. A mesma pergunta que `imagem_do_arquivo()` faz. */
const EH_IMAGEM = /\.(png|jpe?g|gif|webp|avif)$/i;

/**
 * A árvore de produção: cada peça com os arquivos, a justificativa e o envio.
 *
 * **O item abre NO LUGAR, e não numa página própria.** Quem produz uma
 * campanha está subindo arte de quatro peças seguidas — trocar de página
 * quatro vezes, e voltar quatro, é a mesma tela quatro vezes. O painel
 * lateral também não: ele cobre a árvore, que é justamente o que diz o que
 * falta.
 *
 * **Um item só aberto por vez.** Três abertos empilham três históricos de
 * versão, e a árvore — que é a razão de a tela existir — sai do campo de
 * visão.
 */
export function ArvoreDeProducao({
  clienteId,
  arvore,
  miniaturas,
  versoes,
  assinadas,
}: {
  clienteId: string;
  arvore: NoDaArvore[];
  miniaturas: Record<string, string>;
  versoes: Record<string, VersaoDoConteudo[]>;
  assinadas: Record<string, string>;
}) {
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <ul className="space-y-3">
      {arvore.map((no) => (
        <li key={no.item.id} className="bg-surface-card rounded-xl border p-4">
          {no.filhos.length > 0 ? (
            <>
              {/* O GRUPO NÃO RECEBE ARQUIVO, e é a regra da casa: quem tem
                  filho para de ser unidade de trabalho. A peça é o sub-item,
                  e um upload no grupo criaria uma entrega que não é de
                  ninguém e que nenhuma conta enxerga. */}
              <p className="font-medium">{no.item.nome}</p>
              <p className="text-text-muted mt-0.5 text-sm">
                {no.filhos.length} {no.filhos.length === 1 ? "peça" : "peças"}{" "}
                dentro
              </p>

              <ul className="mt-3 space-y-2 border-t pt-3 pl-3 sm:pl-6">
                {no.filhos.map((filho: EntregavelDoPortal) => (
                  <li key={filho.id}>
                    <Peca
                      item={filho}
                      clienteId={clienteId}
                      miniatura={miniaturas[filho.id] || null}
                      versoes={versoes[filho.id] ?? []}
                      assinadas={assinadas}
                      aberto={aberto === filho.id}
                      aoAbrir={() =>
                        setAberto((atual) =>
                          atual === filho.id ? null : filho.id,
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Peca
              item={no.item}
              clienteId={clienteId}
              miniatura={miniaturas[no.item.id] || null}
              versoes={versoes[no.item.id] ?? []}
              assinadas={assinadas}
              aberto={aberto === no.item.id}
              aoAbrir={() =>
                setAberto((atual) =>
                  atual === no.item.id ? null : no.item.id,
                )
              }
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function Peca({
  item,
  clienteId,
  miniatura,
  versoes,
  assinadas,
  aberto,
  aoAbrir,
}: {
  item: EntregavelDoPortal;
  clienteId: string;
  miniatura: string | null;
  versoes: VersaoDoConteudo[];
  assinadas: Record<string, string>;
  aberto: boolean;
  aoAbrir: () => void;
}) {
  const router = useRouter();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const [notas, setNotas] = useState("");
  const [enviando, enviar] = useTransition();

  const jaFoi = Boolean(item.enviadoEm);

  /**
   * Subir os arquivos da versão.
   *
   * **O CAMINHO COMEÇA PELA PASTA DO CLIENTE**, e não é arrumação: a policy
   * `"campanhas: cliente le"` compara `(storage.foldername(name))[1]` com as
   * empresas de quem pede. Um arquivo na raiz a equipe vê e o cliente não —
   * e a arte aparece quebrada justamente na tela para a qual foi feita.
   */
  async function subir(escolhidos: FileList | null) {
    if (!escolhidos || escolhidos.length === 0) return;
    setSubindo(true);
    try {
      const supabase = criarClienteNavegador();
      const subidos: { url: string; nome: string }[] = [];

      for (const arquivo of Array.from(escolhidos)) {
        const extensao = arquivo.name.split(".").pop() ?? "bin";
        const caminho = `${clienteId}/entregaveis/${item.id}-${Date.now()}-${subidos.length}.${extensao}`;
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
        gravarVersaoDoEntregavel(item.id, { arquivos: subidos, notas }),
      );
      if (r.ok) {
        toast.success(r.mensagem);
        setNotas("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setSubindo(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  }

  function mandar() {
    enviar(async () => {
      const r = await chamarAcao(() => enviarEntregavelAoCliente(item.id));
      if (r.ok) {
        toast.success(r.mensagem);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={aoAbrir}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 text-left"
      >
        {aberto ? (
          <ChevronDown aria-hidden className="text-text-muted size-4 shrink-0" />
        ) : (
          <ChevronRight aria-hidden className="text-text-muted size-4 shrink-0" />
        )}

        {miniatura ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={miniatura}
            alt=""
            className="size-10 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <span className="border-border bg-muted text-text-muted flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed">
            <ImageIcon aria-hidden className="size-4" />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.nome}</span>
          <span className="text-text-muted block truncate text-sm">
            {item.versaoAtual > 1 ? `v${item.versaoAtual}` : "v1"}
            {item.arquivoNome ? ` · ${item.arquivoNome}` : " · sem arquivo"}
            {jaFoi ? " · já foi ao cliente" : ""}
          </span>
        </span>

        <StatusBadge status={item.status} />
      </button>

      {aberto ? (
        <div className="mt-3 space-y-4 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor={`notas-${item.id}`}>O que mudou nesta versão</Label>
            <Textarea
              id={`notas-${item.id}`}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ajustei o logo no rodapé e troquei a foto do topo."
              rows={2}
            />
            {/* A JUSTIFICATIVA VIAJA COM A VERSÃO, e por isso o campo fica
                ACIMA do botão de subir: escrita depois, ela seria de uma
                versão que já está gravada — e o histórico diria que a v3
                mudou o que na verdade mudou na v4. */}
            <p className="text-text-muted text-sm">
              Fica no histórico, junto dos arquivos desta versão. O cliente lê.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={arquivoRef}
              type="file"
              aria-label="Escolher os arquivos desta entrega"
              multiple
              className="sr-only"
              onChange={(e) => subir(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={subindo}
              onClick={() => arquivoRef.current?.click()}
            >
              {subindo ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Upload aria-hidden className="size-4" />
              )}
              {versoes.length === 0 ? "Subir os arquivos" : "Subir nova versão"}
            </Button>

            {/* SEM `accept`, e é escolha: a entrega de campanha é PDF, PSD, AI,
                ZIP, INDD — uma lista fechada erraria na primeira extensão que
                a agência passasse a usar, e o erro seria o seletor recusando
                um arquivo sem dizer por quê. Quem decide o que vira capa é o
                banco, pela extensão. */}
            <Button size="sm" disabled={enviando || !item.arteUrl} onClick={mandar}>
              {enviando ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Send aria-hidden className="size-4" />
              )}
              {jaFoi ? "Enviar nova versão ao cliente" : "Enviar ao cliente"}
            </Button>
          </div>

          {!item.arteUrl ? (
            // O BOTÃO FICA DESLIGADO COM A RAZÃO ESCRITA, em vez de sumir: um
            // botão que some ensina que não existe; um desligado que diz o
            // que falta ensina a regra. É a mesma decisão do "Enviar ao
            // cliente" do Social Media.
            <p className="text-text-muted text-sm">
              Suba pelo menos um arquivo antes de enviar.
            </p>
          ) : null}

          <Historico versoes={versoes} assinadas={assinadas} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * O histórico, do mais novo para o mais antigo.
 *
 * **Não existe botão de reverter, nem aqui.** Reverter muda o que vai ao ar,
 * e o caminho para isso é subir de novo — o que grava uma versão a mais em
 * vez de apagar duas. Um "voltar para a v2" deixaria a v3 no banco e fora da
 * corrente, e ninguém saberia dizer qual das duas o cliente viu.
 */
function Historico({
  versoes,
  assinadas,
}: {
  versoes: VersaoDoConteudo[];
  assinadas: Record<string, string>;
}) {
  if (versoes.length === 0) {
    return (
      <p className="text-text-muted rounded-lg border border-dashed p-3 text-sm">
        Nenhum arquivo ainda. A primeira subida vira a v1.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-text-primary text-sm font-semibold">Versões</h4>
      <ul className="space-y-2">
        {versoes.map((versao, i) => (
          <li
            key={versao.id}
            className={cn(
              "rounded-lg border p-3",
              i === 0 ? "border-accent-strong" : "border-border",
            )}
          >
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">v{versao.numero}</span>
              {i === 0 ? (
                <span className="text-accent-strong text-xs">atual</span>
              ) : null}
              {versao.quem ? (
                <span className="text-text-muted">{versao.quem}</span>
              ) : null}
              <span className="text-text-muted text-xs tabular-nums">
                {new Date(versao.quando).toLocaleDateString("pt-BR")}
              </span>
            </p>

            {versao.notas ? (
              <p className="mt-1 text-sm">{versao.notas}</p>
            ) : null}

            <ArquivosDaVersao versao={versao} assinadas={assinadas} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Os arquivos de uma versão: as imagens como miniatura, o resto como linha.
 *
 * Um PSD não tem miniatura, e desenhar uma moldura cinza para ele seria dizer
 * que a imagem não carregou. O nome do arquivo é o que identifica essa
 * entrega — e é nele que se clica para baixar.
 */
function ArquivosDaVersao({
  versao,
  assinadas,
}: {
  versao: VersaoDoConteudo;
  assinadas: Record<string, string>;
}) {
  const imagens = versao.arquivos.filter((url) => EH_IMAGEM.test(url));
  const outros = versao.arquivos.filter((url) => !EH_IMAGEM.test(url));

  if (versao.arquivos.length === 0 && !versao.arteUrl) return null;

  return (
    <div className="mt-2 space-y-2">
      {imagens.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {imagens.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={assinadas[url] ?? url}
              alt=""
              className="size-14 rounded-md border object-cover"
            />
          ))}
        </div>
      ) : null}

      {outros.map((url) => (
        <a
          key={url}
          href={assinadas[url] ?? url}
          target="_blank"
          rel="noreferrer"
          className="text-accent-strong flex items-center gap-1.5 text-sm hover:underline"
        >
          <FileText aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{url.split("/").pop()}</span>
        </a>
      ))}
    </div>
  );
}
