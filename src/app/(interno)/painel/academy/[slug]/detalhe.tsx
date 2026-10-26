"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Paperclip,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";

import { LeitorDoEbook } from "@/components/academy/leitor-do-ebook";
import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { VisualizadorRico } from "@/components/shared/editor-rico";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  EXPLICACAO_DO_TIPO,
  ROTULOS_DE_AULA,
  ROTULOS_DE_ESTADO,
  ROTULOS_DE_TIPO,
  TOM_DO_ESTADO,
  enderecoDeIncorporacao,
  modoDeAbrir,
} from "@/lib/dominio/academy";
import {
  avisoDeConfirmacaoIncompleta,
  precisaReler,
  progressoDoEbook,
} from "@/lib/dominio/ebook-interativo";
import type { ItemAberto } from "@/lib/dados/academy";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { cn } from "@/lib/utils";

import {
  confirmarLeitura,
  confirmarLeituraDoEbook,
  marcarAula,
  marcarItem,
  salvarAnotacao,
} from "../acoes";
import { MontarOItem } from "./montar";

/**
 * A TELA DE UM ITEM, UMA SÓ PARA OS TRÊS FORMATOS.
 *
 * O `switch` por tipo acontece na camada de dados, que entrega `playbook`,
 * `arquivo` ou `curso` preenchido — aqui a tela desenha o que veio. Três telas
 * parecidas divergiriam na primeira mudança, e a que divergiria é a do e-book:
 * é a que ninguém abre para testar.
 *
 * **A ANOTAÇÃO É PRIVADA, E A TELA DIZ ISSO EM VOZ ALTA.** Não é enfeite: é a
 * promessa que faz a pessoa escrever "não entendi a parte do briefing". Quem
 * garante é a policy — as quatro operações de `academy_anotacoes` fecham em
 * `auth.uid()`, e nem o sócio lê —, e a frase existe porque uma promessa que
 * ninguém vê não muda o que a pessoa escreve.
 */
export function DetalheDoItem({
  aberto,
  anotacaoInicial,
  podeEditar,
}: {
  aberto: ItemAberto;
  anotacaoInicial: string;
  podeEditar: boolean;
}) {
  const { item, estado, vistos, total, playbook, arquivo, arquivoAssinado, interativo, curso } =
    aberto;
  const tom = TOM_DO_ESTADO[estado];

  return (
    <div className="space-y-5">
      <header className="bg-card rounded-card shadow-cartao space-y-3 border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-text-muted text-[11px] font-medium tracking-wide uppercase">
              {ROTULOS_DE_TIPO[item.tipo]}
              {item.categoria ? ` · ${item.categoria}` : ""}
            </p>
            <h2 className="text-text-primary mt-1 text-2xl font-semibold">{item.titulo}</h2>
            <p className="text-text-secondary mt-1 text-sm">
              {item.resumo || EXPLICACAO_DO_TIPO[item.tipo]}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!item.publicado ? (
              <span className="bg-neutral-soft text-neutral rounded-full px-2.5 py-1 text-xs font-medium">
                Rascunho
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                tom === "sucesso" && "bg-success-soft text-success",
                tom === "atencao" && "bg-warning-soft text-warning",
                tom === "acao" && "bg-action-soft text-action-text",
                tom === "neutro" && "bg-neutral-soft text-neutral",
              )}
            >
              {ROTULOS_DE_ESTADO[estado]}
            </span>
          </div>
        </div>

        {item.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <li
                key={t}
                className="bg-neutral-soft text-neutral rounded-full px-2 py-0.5 text-[11px]"
              >
                {t}
              </li>
            ))}
          </ul>
        ) : null}

        {item.tipo === "curso" && total > 0 ? (
          <BarraDeProgresso
            valor={vistos}
            total={total}
            rotulo={`${vistos} de ${total} aulas`}
            tom={vistos >= total ? "sucesso" : "marca"}
          />
        ) : null}
      </header>

      {playbook ? <Playbook item={item.id} dados={playbook} /> : null}
      {interativo && arquivoAssinado ? (
        <EbookInterativoNaTela
          itemId={item.id}
          titulo={item.titulo}
          endereco={arquivoAssinado}
          dados={interativo}
          exigeConfirmacao={item.exige_confirmacao_leitura}
          jaConcluido={estado === "concluido"}
        />
      ) : null}

      {/* O CARTÃO DE DOWNLOAD SÓ APARECE PARA O PDF, e a condição é
          `!interativo` e não o tipo: um e-book interativo não tem o que
          baixar — ele É a tela —, e os dois juntos dariam a mesma peça duas
          vezes, uma delas prometendo um arquivo que ninguém abre fora.

          E SÃO DOIS CARTÕES E NÃO UM, porque o arquivo é duas coisas: no
          e-book ele É o conteúdo, e marcar lido ali é marcar o item lido; no
          playbook e no curso ele é ANEXO, e o botão de conclusão seria uma
          segunda porta para fechar um item cuja conclusão é a versão
          confirmada ou as aulas vistas — o item fecharia sem ninguém ter
          lido a versão, e o selo de estado ao lado diria o contrário. */}
      {arquivo && !interativo && item.tipo === "ebook" ? (
        <Ebook
          item={item.id}
          arquivo={arquivo}
          endereco={arquivoAssinado}
          lido={estado === "concluido"}
        />
      ) : null}
      {curso ? <Curso item={item.id} dados={curso} /> : null}

      {/* O ANEXO VEM DEPOIS DO CONTEÚDO, e não antes: ele é apoio, e quem
          abre um curso abre para ver as aulas. Foi a imagem que mostrou —
          no playbook ele já caía depois do texto, porque o `Playbook` é
          desenhado acima; no curso ele subia para a primeira dobra e
          empurrava os módulos para baixo. No e-book a ordem é a oposta de
          propósito, e por isso o cartão dele continua lá em cima: lá o
          arquivo não acompanha o conteúdo, ele É o conteúdo. */}
      {arquivo && !interativo && item.tipo !== "ebook" ? (
        <Anexo arquivo={arquivo} endereco={arquivoAssinado} />
      ) : null}

      <Anotacao itemId={item.id} inicial={anotacaoInicial} />

      {podeEditar ? <MontarOItem aberto={aberto} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PLAYBOOK
// ---------------------------------------------------------------------------

function Playbook({ item, dados }: { item: string; dados: NonNullable<ItemAberto["playbook"]> }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const { versaoCorrente, historico, versaoConfirmada, versaoDeReleitura } = dados;

  if (!versaoCorrente) {
    return (
      <section className="bg-card rounded-card shadow-cartao border p-5">
        <p className="text-text-secondary text-sm">
          Este playbook ainda não tem nenhuma versão publicada. Enquanto não tiver, não há
          o que ler — e é por isso que ele nasce como rascunho.
        </p>
      </section>
    );
  }

  const precisaReler =
    versaoConfirmada !== null &&
    versaoDeReleitura !== null &&
    versaoConfirmada < versaoDeReleitura;

  function confirmar() {
    começar(async () => {
      const r = await chamarAcao(() =>
        confirmarLeitura(item, versaoCorrente!.numero_versao),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <>
      {/* O AVISO DE VERSÃO VEM ANTES DO TEXTO, e não depois: quem já lei a
          anterior precisa saber O QUE mudou antes de reler, senão relê tudo
          procurando a diferença. As notas de mudança são a resposta. */}
      {precisaReler ? (
        <section className="bg-warning-soft text-warning rounded-card space-y-1 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle aria-hidden className="size-4" />O processo mudou desde a sua
            última leitura
          </p>
          <p className="text-sm">
            Você confirmou a versão {versaoConfirmada}. A atual é a{" "}
            {versaoCorrente.numero_versao}.
            {versaoCorrente.notas_mudanca ? ` ${versaoCorrente.notas_mudanca}` : ""}
          </p>
        </section>
      ) : null}

      <section className="bg-card rounded-card shadow-cartao space-y-4 border p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <p className="text-text-muted text-xs">
            Versão {versaoCorrente.numero_versao} · publicada em{" "}
            {new Date(versaoCorrente.publicado_em).toLocaleDateString("pt-BR")}
          </p>

          {versaoConfirmada === versaoCorrente.numero_versao ? (
            <span className="bg-success-soft text-success flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
              <Check aria-hidden className="size-3.5" />
              Leitura confirmada
            </span>
          ) : (
            <Button size="sm" onClick={confirmar} disabled={enviando}>
              {precisaReler ? "Li a versão nova" : "Confirmar que li"}
            </Button>
          )}
        </div>

        <VisualizadorRico conteudo={versaoCorrente.conteudo_rico as never} />
      </section>

      {/* O HISTÓRICO FICA, E NÃO TEM BOTÃO DE REVERTER. Versão fechada nunca é
          reescrita nem apagada — quem confirmou a 2 precisa poder ler a 2 para
          entender o que mudou na 3. A trava não é a ausência do botão: a
          tabela não tem policy de UPDATE nem de DELETE. */}
      {historico.length > 1 ? (
        <section className="bg-card rounded-card shadow-cartao border p-5">
          <h3 className="text-text-primary text-sm font-semibold">Versões anteriores</h3>
          <ul className="divide-border mt-3 divide-y text-sm">
            {historico.slice(1).map((v) => (
              <li key={v.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                <span className="text-text-primary font-medium tabular-nums">
                  v{v.numero_versao}
                </span>
                <span className="text-text-muted text-xs tabular-nums">
                  {new Date(v.publicado_em).toLocaleDateString("pt-BR")}
                </span>
                {v.exige_releitura ? (
                  <span className="bg-warning-soft text-warning rounded-full px-2 py-0.5 text-[11px]">
                    cobrou releitura
                  </span>
                ) : null}
                <span className="text-text-secondary basis-full text-xs">
                  {v.notas_mudanca || "Sem notas do que mudou."}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// E-BOOK
// ---------------------------------------------------------------------------

/**
 * O ANEXO de um playbook ou de um curso.
 *
 * **É O CARTÃO DO E-BOOK SEM O BOTÃO DE CONCLUSÃO**, e a ausência é a decisão
 * inteira: aqui o arquivo é material de apoio, não o conteúdo — quem fecha um
 * playbook é a versão confirmada, e quem fecha um curso são as aulas. O
 * argumento está escrito por extenso em `ArquivoDoItem`, no montar.
 *
 * **E ELE NÃO REAPROVEITA `Ebook` com uma bandeira.** Uma prop `semConclusao`
 * deixaria o botão a um booleano de distância de voltar na tela errada, e o
 * que o separa não é um detalhe de desenho: são dois fatos diferentes sobre o
 * que aquele arquivo é.
 *
 * O resto é igual de propósito — o mesmo ladrilho, a mesma linha de nome e
 * tamanho, e o mesmo botão desligado com a razão quando a assinatura não
 * volta: dois desenhos para o mesmo arquivo divergiriam na primeira mudança.
 */
function Anexo({
  arquivo,
  endereco,
}: {
  arquivo: NonNullable<ItemAberto["arquivo"]>;
  endereco: string | null;
}) {
  return (
    <section className="bg-card rounded-card shadow-cartao flex flex-wrap items-center gap-4 border p-5">
      <span
        className="bg-neutral-soft text-neutral grid size-11 shrink-0 place-items-center rounded-lg"
        aria-hidden
      >
        <Paperclip className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-text-muted text-[11px] font-medium tracking-wide uppercase">
          Anexo
        </p>
        <p className="text-text-primary text-sm font-medium">{arquivo.nome}</p>
        <p className="text-text-muted text-xs">
          {arquivo.paginas ? `${arquivo.paginas} páginas` : "Material de apoio"}
          {arquivo.tamanho_bytes
            ? ` · ${Math.round(arquivo.tamanho_bytes / 1024 / 1024)} MB`
            : ""}
        </p>
      </div>

      {endereco ? (
        <Button asChild variant="outline" size="sm">
          <a href={endereco} target="_blank" rel="noreferrer">
            <Download aria-hidden className="size-4" />
            Baixar
          </a>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled
          title="O endereço do arquivo não foi liberado. Recarregue a página; se continuar, fale com a gestão."
        >
          <Download aria-hidden className="size-4" />
          Baixar
        </Button>
      )}
    </section>
  );
}

function Ebook({
  item,
  arquivo,
  endereco,
  lido,
}: {
  item: string;
  arquivo: NonNullable<ItemAberto["arquivo"]>;
  endereco: string | null;
  lido: boolean;
}) {
  const router = useRouter();
  const [enviando, começar] = useTransition();

  function marcar() {
    começar(async () => {
      const r = await chamarAcao(() => marcarItem(item, !lido));
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <section className="bg-card rounded-card shadow-cartao flex flex-wrap items-center gap-4 border p-5">
      <span
        className="bg-action-soft text-action-text grid size-11 shrink-0 place-items-center rounded-lg"
        aria-hidden
      >
        <FileText className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-text-primary text-sm font-medium">{arquivo.nome}</p>
        <p className="text-text-muted text-xs">
          {arquivo.paginas ? `${arquivo.paginas} páginas` : "PDF"}
          {arquivo.tamanho_bytes
            ? ` · ${Math.round(arquivo.tamanho_bytes / 1024 / 1024)} MB`
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* SEM ENDEREÇO, O BOTÃO SAI DESLIGADO COM A RAZÃO, e não some: o
            arquivo existe — o nome dele está na linha de cima —, e quem não
            conseguir baixar precisa saber que o problema não é a ausência do
            material. É a decisão do "Enviar ao cliente" do Social Media: um
            botão que some ensina que não existe. */}
        {endereco ? (
          <Button asChild variant="outline" size="sm">
            <a href={endereco} target="_blank" rel="noreferrer">
              <Download aria-hidden className="size-4" />
              Baixar
            </a>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled
            title="O endereço do arquivo não foi liberado. Recarregue a página; se continuar, fale com a gestão."
          >
            <Download aria-hidden className="size-4" />
            Baixar
          </Button>
        )}
        <Button size="sm" variant={lido ? "outline" : "default"} onClick={marcar} disabled={enviando}>
          {lido ? "Desmarcar" : "Marcar como lido"}
        </Button>
      </div>
    </section>
  );
}

/**
 * O E-BOOK INTERATIVO: cabeçalho fino, e o resto é a página.
 *
 * ---------------------------------------------------------------------------
 * **O QUE O FULL HUB DESENHA POR FORA É SÓ O QUE ELE SABE E A PÁGINA NÃO:**
 * quantos capítulos foram registrados, se o processo mudou desde a última
 * leitura, e o botão de dizer que leu. Índice, busca e matriz ficam DENTRO —
 * duplicá-los por fora daria duas buscas na mesma tela, e a de fora não
 * acharia nada, porque o texto não está aqui.
 *
 * **"Baixar" NÃO SE APLICA**, e o que entra no lugar é *Abrir em nova aba*,
 * com o mesmo endereço assinado: um HTML baixado para a pasta de Downloads
 * perde o estado, perde a ponte e vira uma cópia que envelhece — exatamente o
 * problema que a versão existe para resolver.
 * ---------------------------------------------------------------------------
 */
function EbookInterativoNaTela({
  itemId,
  titulo,
  endereco,
  dados,
  exigeConfirmacao,
  jaConcluido,
}: {
  itemId: string;
  titulo: string;
  endereco: string;
  dados: NonNullable<ItemAberto["interativo"]>;
  exigeConfirmacao: boolean;
  jaConcluido: boolean;
}) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [lidos, setLidos] = useState<string[]>(dados.lidos);

  const progresso = progressoDoEbook(lidos, dados.capitulos.length);
  const releitura = precisaReler(dados.versaoConfirmada, dados.versaoDeReleitura);

  function confirmar() {
    const aviso = avisoDeConfirmacaoIncompleta(progresso.lidos, progresso.total);
    // O AVISO É UM `confirm` E NÃO UM DIÁLOGO DESENHADO, e é a única vez que o
    // produto usa um: a pergunta tem duas respostas, não tem campo nenhum, e
    // ela acontece no meio de uma leitura — um diálogo em cima do e-book
    // cobriria justamente o que a pessoa precisaria reler para decidir.
    if (aviso && !window.confirm(aviso)) return;

    começar(async () => {
      const r = await chamarAcao(() => confirmarLeituraDoEbook(itemId));
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="bg-card rounded-card shadow-cartao flex flex-wrap items-center gap-x-5 gap-y-3 border p-4">
        <div className="min-w-50 flex-1">
          {/* A CONTAGEM É O RÓTULO DA BARRA, e por isso ela sai `rotuloOculto`:
              com as duas, "9 de 23 capítulos" apareceria uma vez acima e outra
              ao lado, a um centímetro de distância. */}
          <p className="text-text-primary text-sm font-medium">
            {progresso.lidos} de {progresso.total} capítulos
          </p>
          <BarraDeProgresso
            valor={progresso.lidos}
            total={progresso.total}
            rotulo={`${progresso.lidos} de ${progresso.total} capítulos lidos`}
            rotuloOculto
            tom={progresso.lidos >= progresso.total ? "sucesso" : "marca"}
            className="mt-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={endereco} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden className="size-4" />
              Abrir em nova aba
            </a>
          </Button>

          {exigeConfirmacao ? (
            <Button
              size="sm"
              variant={jaConcluido && !releitura ? "outline" : "default"}
              onClick={confirmar}
              disabled={enviando || (jaConcluido && !releitura)}
            >
              <Check aria-hidden className="size-4" />
              {jaConcluido && !releitura ? "Leitura confirmada" : "Li e estou ciente"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* O AVISO DE RELEITURA VEM COM AS NOTAS DO QUE MUDOU, e sem elas ele
          manda a pessoa reler 109 páginas para descobrir o que mudou — que é
          o jeito mais rápido de ninguém reler nada. `--warning` e nunca
          `--danger`: o processo mudou, não há erro de ninguém. */}
      {releitura ? (
        <div className="bg-warning-soft text-warning rounded-card flex items-start gap-2.5 p-3 text-sm">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">
              Este material mudou desde a sua última leitura.
            </p>
            {dados.notasDaVersao ? (
              <p className="mt-0.5">{dados.notasDaVersao}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <LeitorDoEbook
        itemId={itemId}
        endereco={endereco}
        titulo={titulo}
        dados={dados}
        onProgresso={setLidos}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// CURSO
// ---------------------------------------------------------------------------

function Curso({ item, dados }: { item: string; dados: NonNullable<ItemAberto["curso"]> }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();

  function marcar(aulaId: string, visto: boolean) {
    começar(async () => {
      const r = await chamarAcao(() => marcarAula(item, aulaId, visto));
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  if (dados.modulos.length === 0) {
    return (
      <section className="bg-card rounded-card shadow-cartao border p-5">
        <p className="text-text-secondary text-sm">
          Este curso ainda não tem módulos. Enquanto não tiver, não há o que estudar.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {dados.modulos.map((modulo) => (
        <section key={modulo.id} className="bg-card rounded-card shadow-cartao border p-5">
          <h3 className="text-text-primary text-sm font-semibold">{modulo.titulo}</h3>
          {modulo.descricao ? (
            <p className="text-text-secondary mt-0.5 text-xs">{modulo.descricao}</p>
          ) : null}

          <ul className="divide-border mt-3 divide-y">
            {modulo.aulas.map((aula) => {
              const visto = dados.vistas.has(aula.id);
              const modo = modoDeAbrir(aula.tipo, aula.url);
              const incorporar =
                modo === "embutido" && aula.url ? enderecoDeIncorporacao(aula.url) : null;

              return (
                <li key={aula.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => marcar(aula.id, !visto)}
                      disabled={enviando}
                      aria-pressed={visto}
                      aria-label={
                        visto
                          ? `Desmarcar a aula ${aula.titulo}`
                          : `Marcar a aula ${aula.titulo} como vista`
                      }
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded border transition-colors",
                        visto
                          ? "bg-success-soft text-success border-transparent"
                          : "text-text-muted hover:border-action/40",
                      )}
                    >
                      {visto ? <Check aria-hidden className="size-3.5" /> : null}
                    </button>

                    <span className="text-text-primary min-w-0 flex-1 text-sm">
                      {aula.titulo}
                    </span>

                    <span className="text-text-muted text-[11px]">
                      {ROTULOS_DE_AULA[aula.tipo]}
                    </span>

                    {aula.duracao_minutos ? (
                      <span className="text-text-muted flex items-center gap-1 text-[11px]">
                        <Clock aria-hidden className="size-3" />
                        {formatarMinutos(aula.duracao_minutos)}
                      </span>
                    ) : null}

                    {/* O LINK ABRE FORA, E A TELA AVISA ANTES DO CLIQUE. Site
                        de terceiro preso num iframe quebra login, cookie e o
                        botão de voltar — é a regra que o módulo tem desde a
                        0017. */}
                    {modo === "fora" && aula.url ? (
                      <a
                        href={aula.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-strong flex items-center gap-1 text-xs hover:underline"
                      >
                        Abrir fora
                        <ExternalLink aria-hidden className="size-3" />
                      </a>
                    ) : null}

                    {modo === "visualizador" && aula.arquivo_url ? (
                      <a
                        href={aula.arquivo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-strong flex items-center gap-1 text-xs hover:underline"
                      >
                        Abrir o PDF
                        <ExternalLink aria-hidden className="size-3" />
                      </a>
                    ) : null}
                  </div>

                  {incorporar ? (
                    <div className="aspect-video w-full overflow-hidden rounded-lg border">
                      <iframe
                        src={incorporar}
                        title={aula.titulo}
                        allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        className="size-full"
                      />
                    </div>
                  ) : null}

                  {modo === "aqui" && aula.conteudo_rico ? (
                    <VisualizadorRico conteudo={aula.conteudo_rico as never} />
                  ) : null}
                </li>
              );
            })}
          </ul>

          {modulo.aulas.length === 0 ? (
            <p className="text-text-muted mt-2 text-xs">Este módulo ainda não tem aulas.</p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A ANOTAÇÃO
// ---------------------------------------------------------------------------

/**
 * A anotação privada, salva sozinha.
 *
 * 800 ms de pausa, como a tela de task: um `insert` por tecla seria uma ida ao
 * banco por letra. E ela salva sem botão porque o botão de salvar é justamente
 * o que faz alguém sair da página sem clicar — e aí a anotação some, que é a
 * pior forma de uma promessa de privacidade se quebrar.
 */
function Anotacao({ itemId, inicial }: { itemId: string; inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const relogio = setTimeout(async () => {
      setSalvando(true);
      const r = await chamarAcao(() => salvarAnotacao(itemId, null, texto));
      setSalvando(false);
      if (!r.ok) toast.error(r.error);
    }, 800);
    return () => clearTimeout(relogio);
  }, [texto, itemId]);

  return (
    <section className="bg-card rounded-card shadow-cartao space-y-2 border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <Lock aria-hidden className="size-4" />
          Suas anotações
        </h3>
        <span className="text-text-muted text-xs" aria-live="polite">
          {salvando ? "salvando…" : "salva sozinha"}
        </span>
      </div>

      <p className="text-text-muted text-xs">
        <strong>Só você lê isto.</strong> Nem a gestão, nem o sócio — a anotação mora numa
        tabela que fecha no seu usuário nas quatro operações.
      </p>

      <Textarea
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        rows={4}
        placeholder="O que você quer lembrar daqui."
        aria-label="A sua anotação privada sobre este item"
      />
    </section>
  );
}
