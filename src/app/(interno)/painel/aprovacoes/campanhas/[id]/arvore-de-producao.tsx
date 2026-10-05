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
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { VersaoDoConteudo } from "@/lib/dados/conteudo";
import {
  podeEnviarPecaAoCliente,
  podePedirAnalise,
  type AnaliseDaPeca,
  type EntregavelDoPortal,
  type NoDaArvore,
} from "@/lib/dominio/campanhas";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import {
  enviarEntregavelAoCliente,
  pedirAnaliseDoEntregavel,
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
  analise,
  ehGestao,
}: {
  clienteId: string;
  arvore: NoDaArvore[];
  miniaturas: Record<string, string>;
  versoes: Record<string, VersaoDoConteudo[]>;
  assinadas: Record<string, string>;
  /** O estado do aval interno de cada peça. A chave é o id dela. */
  analise: Record<string, AnaliseDaPeca>;
  /** Quem envia ao cliente é `is_gestor()`, e o botão segue a mesma pergunta. */
  ehGestao: boolean;
}) {
  const [aberto, setAberto] = useState<string | null>(null);

  /** O cartão de uma peça, com o estado de aberto que a lista guarda. */
  const cartao = (item: EntregavelDoPortal) => (
    <Peca
      item={item}
      clienteId={clienteId}
      miniatura={miniaturas[item.id] || null}
      versoes={versoes[item.id] ?? []}
      assinadas={assinadas}
      aberto={aberto === item.id}
      aoAbrir={() => setAberto((atual) => (atual === item.id ? null : item.id))}
      analise={analise[item.id] ?? { pendente: false, aprovado: false }}
      ehGestao={ehGestao}
    />
  );

  return (
    /* O GRUPO VIROU UM RÓTULO, e a PEÇA virou o cartão.
       -----------------------------------------------------------------
       Antes o grupo era uma caixa grande com as peças dentro, e o que se lia
       primeiro era a caixa — mas ninguém decide sobre um grupo: ele não
       recebe arquivo, não tem versão e o status dele é derivado dos filhos
       desde a 0033. É a decisão dos cartões soltos de Minhas Tasks: o que
       ganha borda e sombra é a unidade sobre a qual alguém age.

       Então o nome do grupo passou a ser um rótulo em caixa alta — a mesma
       forma do cabeçalho de coluna do board e do grupo da Lista —, e cada
       peça é um cartão solto embaixo dele.

       O RECUO FICOU, e a proposta tinha tirado ele: o rótulo diz onde o grupo
       COMEÇA e não diz onde ele termina, e a imagem mostrou o preço — o
       "Tabloide", que é uma peça de topo, caía logo abaixo do sexto
       Feed/Story com o mesmo espaço entre eles, e lia como o sétimo de um
       grupo cujo rótulo diz seis. O que voltou é um FIO à esquerda, e não a
       caixa: sem topo, sem fundo, sem fundo de cor e sem sombra, ele fecha o
       grupo dos dois lados sem devolver o retângulo que se lia antes das
       peças. */
    <div className="space-y-6">
      {arvore.map((no) => (
        <section key={no.item.id} className="space-y-2">
          {no.filhos.length > 0 ? (
            <>
              {/* O GRUPO NÃO RECEBE ARQUIVO, e é a regra da casa: quem tem
                  filho para de ser unidade de trabalho. A peça é o sub-item,
                  e um upload no grupo criaria uma entrega que não é de
                  ninguém e que nenhuma conta enxerga. */}
              <h3 className="text-text-secondary flex items-baseline justify-between gap-2 pl-3 text-[11px] font-bold tracking-wider uppercase">
                {no.item.nome}
                <span className="text-text-muted tabular-nums">
                  {no.filhos.length}{" "}
                  {no.filhos.length === 1 ? "peça" : "peças"}
                </span>
              </h3>

              <ul className="border-border space-y-2 border-l-2 pl-3">
                {no.filhos.map((filho: EntregavelDoPortal) => (
                  <li
                    key={filho.id}
                    className="bg-surface-card rounded-card shadow-cartao border p-4"
                  >
                    {cartao(filho)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="bg-surface-card rounded-card shadow-cartao border p-4">
              {cartao(no.item)}
            </div>
          )}
        </section>
      ))}
    </div>
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
  analise,
  ehGestao,
}: {
  item: EntregavelDoPortal;
  clienteId: string;
  miniatura: string | null;
  versoes: VersaoDoConteudo[];
  assinadas: Record<string, string>;
  aberto: boolean;
  aoAbrir: () => void;
  analise: AnaliseDaPeca;
  ehGestao: boolean;
}) {
  const router = useRouter();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const podeAnalise = podePedirAnalise(item, analise);
  const podeEnviar = podeEnviarPecaAoCliente(item, analise);
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

  function mandarParaAnalise() {
    enviar(async () => {
      const r = await chamarAcao(() => pedirAnaliseDoEntregavel(item.id));
      if (r.ok) {
        toast.success(r.mensagem);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
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
          {/* A LINHA FECHADA DIZ QUE A PEÇA VOLTOU, senão quem produz abre
              as quinze uma a uma para descobrir qual é a dele. É a regra da
              contagem no cabeçalho do grupo dobrável: o que está recolhido
              continua dizendo o que tem dentro. */}
          <span className="text-text-muted block truncate text-sm">
            {item.versaoAtual > 1 ? `v${item.versaoAtual}` : "v1"}
            {item.arquivoNome ? ` · ${item.arquivoNome}` : " · sem arquivo"}
            {jaFoi ? " · já foi ao cliente" : ""}
            {analise.ajuste ? (
              <span className="text-warning font-semibold">
                {analise.ajuste.recusada
                  ? " · recusada na análise"
                  : " · ajustes pedidos"}
              </span>
            ) : analise.pendente ? " · na análise" : ""}
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
            {/* ------------------------------------------------- a análise --
                "ENVIAR PARA ANÁLISE" É O BOTÃO DE QUEM PRODUZ — decisão do
                usuário. Ele abre a rodada INTERNA, a gestão decide na fila de
                aprovações, e só então o envio ao cliente se liga.

                A regra está no banco desde a 0033: `validar_nova_rodada`
                recusa a rodada de cliente enquanto não houver a interna do
                mesmo número aprovada. O que faltava era este botão — até
                agora a tela só oferecia "Enviar ao cliente", e quem clicava
                levava do banco uma recusa falando de uma aprovação que não
                tinha por onde acontecer. */}
            <Button
              variant="outline"
              size="sm"
              disabled={enviando || !podeAnalise.pode}
              onClick={mandarParaAnalise}
            >
              {enviando ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <ShieldCheck aria-hidden className="size-4" />
              )}
              {analise.aprovado ? "Mandar para análise de novo" : "Enviar para análise"}
            </Button>

            {/* O ENVIO AO CLIENTE SÓ APARECE PARA A GESTÃO, e não desligado:
                aqui ele não é uma regra que quem produz precise aprender —
                é o trabalho de outra pessoa. Um botão permanentemente
                desligado na tela de quem nunca vai poder usá-lo é ruído, e a
                razão escrita ("falta o aval interno") seria dita a quem não
                decide isso. Para a gestão ele fica, desligado, com a razão. */}
            {ehGestao ? (
              <Button size="sm" disabled={enviando || !podeEnviar.pode} onClick={mandar}>
                {enviando ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Send aria-hidden className="size-4" />
                )}
                {jaFoi ? "Enviar nova versão ao cliente" : "Enviar ao cliente"}
              </Button>
            ) : null}
          </div>

          {/* A RAZÃO FICA NUMA PÍLULA ÂMBAR, e não em cinza ao lado de um
              botão cinza — ali ela lia como legenda do botão em vez de
              resposta. É a decisão do "Enviar ao cliente" desligado do Social
              Media. `--warning` e nunca `--danger`: falta um passo, não há
              erro nenhum. */}
          {/* UMA FRASE SÓ, e não duas dizendo a mesma coisa. Com a análise
              pendente, a pílula azul já responde por que os dois botões estão
              desligados — a âmbar ao lado dela repetiria "já está na fila"
              logo abaixo de "na fila de análise da gestão", a um centímetro
              de distância. É a decisão do selo que some dentro do grupo. */}
          {analise.pendente ? (
            <p className="bg-blue-soft text-blue-strong rounded-lg px-3 py-2 text-sm">
              Na fila de análise da gestão — v{item.versaoAtual}.
            </p>
          ) : analise.ajuste ? (
            /* ----------------------------------------------- o que a gestão pediu --
               O PEDIDO DE AJUSTE APARECE AQUI, e até a 0079 não aparecia em
               lugar nenhum: ele é gravado em `approval_rounds.comentario`, e
               nenhuma tela do produto lê rodada de entregável. A peça voltava
               para a produção em silêncio — "ela não está voltando", que é o
               relato exato do usuário.

               ELE VEM ANTES DOS BOTÕES na leitura da pessoa, e não depois:
               é a razão de ela estar aqui. É a mesma ordem do detalhe do
               material no portal, onde a arte vem antes das decisões — a
               informação que decide o próximo passo não pode ficar abaixo do
               passo.

               `--warning` e nunca `--danger`, inclusive na recusa: refazer
               uma arte é trabalho, não erro. Vermelho numa tela que quem
               produz abre todo dia treina o hábito de ignorar vermelho. */
            <div className="bg-warning-soft text-warning space-y-1 rounded-lg px-3 py-2 text-sm">
              <p className="font-semibold">
                {analise.ajuste.recusada
                  ? `A gestão recusou a v${item.versaoAtual}`
                  : `A gestão pediu ajustes na v${item.versaoAtual}`}
                {analise.ajuste.quando ? (
                  <span className="font-normal tabular-nums">
                    {" · "}
                    {new Date(analise.ajuste.quando).toLocaleDateString("pt-BR")}
                  </span>
                ) : null}
              </p>
              {/* `whitespace-pre-line` porque o recado é digitado numa
                  textarea: sem ele, três linhas de pedido viram um parágrafo
                  corrido e a lista de ajustes deixa de ser uma lista. */}
              {analise.ajuste.comentario ? (
                <p className="whitespace-pre-line">{analise.ajuste.comentario}</p>
              ) : null}
              <p>{podeAnalise.porque}</p>
            </div>
          ) : (ehGestao ? podeEnviar.porque : podeAnalise.porque) ? (
            <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-sm">
              {ehGestao ? podeEnviar.porque : podeAnalise.porque}
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
