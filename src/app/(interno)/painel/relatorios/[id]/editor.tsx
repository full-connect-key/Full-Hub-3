"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, Pencil, Plus, Trash2 } from "lucide-react";

import { EnviarArquivos } from "@/components/shared/enviar-arquivos";
import { ImagemAssinada } from "@/components/shared/imagem-assinada";
import { LeituraDoRelatorio } from "@/components/shared/leitura-do-relatorio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { RelatorioAberto } from "@/lib/dados/relatorios";
import {
  TIPOS_DE_BLOCO,
  blocoNovo,
  postNovo,
  type BlocoDoRelatorio,
} from "@/lib/dominio/relatorios";

import { apagarRelatorio, publicarRelatorio, salvarRelatorio } from "../acoes";

const BUCKET = "posts-artes";

/**
 * O EDITOR DO RELATÓRIO. O relatório é editado e gravado INTEIRO: um estado só,
 * um botão de salvar. A prévia é o mesmo componente que o cliente lê.
 */
export function EditorDoRelatorio({
  relatorio,
  podeApagar,
}: {
  relatorio: RelatorioAberto;
  podeApagar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [previa, setPrevia] = useState(false);
  const [titulo, setTitulo] = useState(relatorio.titulo);
  const [subtitulo, setSubtitulo] = useState(relatorio.subtitulo ?? "");
  const [inicio, setInicio] = useState(relatorio.periodoInicio);
  const [fim, setFim] = useState(relatorio.periodoFim);
  const [blocos, setBlocos] = useState<BlocoDoRelatorio[]>(relatorio.blocos);
  // A imagem recém-enviada ainda não tem assinatura do servidor: a prévia usa
  // o endereço local até o próximo carregamento.
  const imagens = relatorio.imagens;
  const publicado = relatorio.publicadoEm !== null;

  const trocar = (i: number, novo: BlocoDoRelatorio) =>
    setBlocos((atuais) => atuais.map((b, j) => (j === i ? novo : b)));
  const mover = (i: number, passo: number) =>
    setBlocos((atuais) => {
      const destino = i + passo;
      if (destino < 0 || destino >= atuais.length) return atuais;
      const copia = [...atuais];
      [copia[i], copia[destino]] = [copia[destino], copia[i]];
      return copia;
    });

  const dados = () => ({
    titulo,
    subtitulo,
    periodoInicio: inicio,
    periodoFim: fim,
    blocos,
  });

  const salvar = () =>
    iniciar(async () => {
      const r = await chamarEMostrar(() => salvarRelatorio(relatorio.id, dados()));
      if (r.ok) router.refresh();
    });

  const publicar = (valor: boolean) =>
    iniciar(async () => {
      // Publicar grava antes: o cliente não pode ler a versão de ontem.
      if (valor) {
        const salvo = await chamarEMostrar(() =>
          salvarRelatorio(relatorio.id, dados()),
        );
        if (!salvo.ok) return;
      }
      const r = await chamarEMostrar(() => publicarRelatorio(relatorio.id, valor));
      if (r.ok) router.refresh();
    });

  const apagar = () => {
    if (!window.confirm("Apagar este relatório? Isto não tem volta.")) return;
    iniciar(async () => {
      const r = await chamarEMostrar(() => apagarRelatorio(relatorio.id));
      if (r.ok) router.push("/painel/relatorios");
    });
  };

  const campoDeImagem = (
    atual: string | null,
    aoTrocar: (caminho: string | null) => void,
  ) => (
    <div className="flex items-center gap-3">
      {atual && imagens[atual] ? (
        <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg">
          <ImagemAssinada src={imagens[atual]} alt="" className="object-cover" />
        </div>
      ) : null}
      <EnviarArquivos
        bucket={BUCKET}
        familias={["imagem"]}
        rotulo={atual ? "Trocar imagem" : "Enviar imagem"}
        rotuloDoCampo="Imagem"
        caminho={(arquivo) =>
          `${relatorio.clienteId}/relatorios/${relatorio.id}-${Date.now()}.${
            arquivo.name.split(".").pop() ?? "jpg"
          }`
        }
        onPronto={(arquivos) => {
          const enviado = arquivos[0];
          if (!enviado) return;
          aoTrocar(enviado.url);
          router.refresh();
        }}
      />
      {atual ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => aoTrocar(null)}>
          Remover
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <div
        className="bg-card sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border p-3"
        data-tour="relatorio-barra"
      >
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            publicado ? "bg-success-soft text-success" : "bg-muted text-text-muted"
          }`}
        >
          {publicado ? "Publicado no portal" : "Rascunho — o cliente não vê"}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setPrevia((p) => !p)}>
            {previa ? <Pencil className="size-4" /> : <Eye className="size-4" />}
            {previa ? "Voltar a editar" : "Ver como o cliente"}
          </Button>
          {podeApagar ? (
            <Button type="button" variant="outline" disabled={pendente} onClick={apagar}>
              <Trash2 className="size-4" /> Apagar
            </Button>
          ) : null}
          <Button type="button" variant="outline" disabled={pendente} onClick={salvar}>
            Salvar
          </Button>
          <Button type="button" disabled={pendente} onClick={() => publicar(!publicado)}>
            {publicado ? "Tirar do portal" : "Publicar para o cliente"}
          </Button>
        </div>
      </div>

      {previa ? (
        <LeituraDoRelatorio
          cliente={relatorio.cliente}
          titulo={titulo}
          subtitulo={subtitulo || null}
          periodoInicio={inicio}
          periodoFim={fim}
          blocos={blocos}
          imagens={imagens}
        />
      ) : (
        <>
          <div className="bg-card grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
            <Campo rotulo="Título">
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </Campo>
            <Campo rotulo="Subtítulo">
              <Input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
            </Campo>
            <Campo rotulo="Início do período">
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Campo>
            <Campo rotulo="Fim do período">
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </Campo>
          </div>

          {blocos.map((bloco, i) => (
            <div key={i} className="bg-card space-y-4 rounded-xl border p-5">
              <div className="flex items-center gap-2">
                <p className="text-text-muted text-xs font-medium uppercase">
                  {TIPOS_DE_BLOCO.find((t) => t.tipo === bloco.tipo)?.rotulo}
                </p>
                <div className="ml-auto flex gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label="Subir o bloco" disabled={i === 0} onClick={() => mover(i, -1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Descer o bloco" disabled={i === blocos.length - 1} onClick={() => mover(i, 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover o bloco" onClick={() => setBlocos((a) => a.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <Campo rotulo="Título do bloco">
                <Input value={bloco.titulo} onChange={(e) => trocar(i, { ...bloco, titulo: e.target.value })} />
              </Campo>

              {bloco.tipo === "destaques" ? (
                <>
                  {bloco.itens.map((item, j) => {
                    const muda = (p: Partial<typeof item>) =>
                      trocar(i, { ...bloco, itens: bloco.itens.map((x, k) => (k === j ? { ...x, ...p } : x)) });
                    return (
                      <div key={j} className="bg-muted grid gap-3 rounded-lg p-3 sm:grid-cols-[140px_1fr_1fr_auto]">
                        <Input placeholder="1,2 mi" aria-label="Número" value={item.numero} onChange={(e) => muda({ numero: e.target.value })} />
                        <Input placeholder="visualizações" aria-label="Legenda" value={item.legenda} onChange={(e) => muda({ legenda: e.target.value })} />
                        <Input placeholder="Comentário (opcional)" aria-label="Comentário" value={item.texto} onChange={(e) => muda({ texto: e.target.value })} />
                        <Remover aoClicar={() => trocar(i, { ...bloco, itens: bloco.itens.filter((_, k) => k !== j) })} />
                      </div>
                    );
                  })}
                  <Mais rotulo="Outro destaque" aoClicar={() => trocar(i, { ...bloco, itens: [...bloco.itens, { numero: "", legenda: "", texto: "" }] })} />
                </>
              ) : null}

              {bloco.tipo === "crescimento" ? (
                <>
                  <Campo rotulo="Leitura do crescimento">
                    <Textarea rows={2} value={bloco.texto} onChange={(e) => trocar(i, { ...bloco, texto: e.target.value })} />
                  </Campo>
                  {bloco.linhas.map((linha, j) => {
                    const muda = (p: Partial<typeof linha>) =>
                      trocar(i, { ...bloco, linhas: bloco.linhas.map((x, k) => (k === j ? { ...x, ...p } : x)) });
                    return (
                      <div key={j} className="bg-muted grid gap-3 rounded-lg p-3 sm:grid-cols-[1fr_160px_160px_auto]">
                        <Input placeholder="Métrica" aria-label="Métrica" value={linha.metrica} onChange={(e) => muda({ metrica: e.target.value })} />
                        <Input type="number" min={0} aria-label="Período anterior" placeholder="Período anterior" value={linha.anterior || ""} onChange={(e) => muda({ anterior: Number(e.target.value) || 0 })} />
                        <Input type="number" min={0} aria-label="Este período" placeholder="Este período" value={linha.atual || ""} onChange={(e) => muda({ atual: Number(e.target.value) || 0 })} />
                        <Remover aoClicar={() => trocar(i, { ...bloco, linhas: bloco.linhas.filter((_, k) => k !== j) })} />
                      </div>
                    );
                  })}
                  <Mais rotulo="Outra métrica" aoClicar={() => trocar(i, { ...bloco, linhas: [...bloco.linhas, { metrica: "", anterior: 0, atual: 0 }] })} />
                </>
              ) : null}

              {bloco.tipo === "posts" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo rotulo="Rede">
                      <Input value={bloco.rede} onChange={(e) => trocar(i, { ...bloco, rede: e.target.value })} />
                    </Campo>
                    <Campo rotulo="Texto de abertura">
                      <Input value={bloco.texto} onChange={(e) => trocar(i, { ...bloco, texto: e.target.value })} />
                    </Campo>
                  </div>
                  {bloco.itens.map((post, j) => {
                    const muda = (p: Partial<typeof post>) =>
                      trocar(i, { ...bloco, itens: bloco.itens.map((x, k) => (k === j ? { ...x, ...p } : x)) });
                    return (
                      <div key={j} className="bg-muted space-y-3 rounded-lg p-3">
                        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
                          <Input placeholder="Nome do conteúdo" aria-label="Nome do conteúdo" value={post.nome} onChange={(e) => muda({ nome: e.target.value })} />
                          <Input placeholder="12 de outubro" aria-label="Publicado em" value={post.publicadoEm} onChange={(e) => muda({ publicadoEm: e.target.value })} />
                          <Remover aoClicar={() => trocar(i, { ...bloco, itens: bloco.itens.filter((_, k) => k !== j) })} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {post.metricas.map((m, k) => (
                            <div key={k} className="space-y-1">
                              <Input aria-label="Nome da métrica" value={m.rotulo} onChange={(e) => muda({ metricas: post.metricas.map((x, y) => (y === k ? { ...x, rotulo: e.target.value } : x)) })} />
                              <Input placeholder="Valor" aria-label={`Valor de ${m.rotulo}`} value={m.valor} onChange={(e) => muda({ metricas: post.metricas.map((x, y) => (y === k ? { ...x, valor: e.target.value } : x)) })} />
                            </div>
                          ))}
                        </div>
                        <Textarea rows={2} placeholder="Por que este conteúdo se destacou" aria-label="Comentário" value={post.legenda} onChange={(e) => muda({ legenda: e.target.value })} />
                        {campoDeImagem(post.imagem, (caminho) => muda({ imagem: caminho }))}
                      </div>
                    );
                  })}
                  <Mais rotulo="Outro conteúdo" aoClicar={() => trocar(i, { ...bloco, itens: [...bloco.itens, postNovo()] })} />
                </>
              ) : null}

              {bloco.tipo === "texto" ? (
                <Campo rotulo="Texto">
                  <Textarea rows={5} value={bloco.texto} onChange={(e) => trocar(i, { ...bloco, texto: e.target.value })} />
                </Campo>
              ) : null}

              {bloco.tipo === "referencias" ? (
                <>
                  {bloco.itens.map((ref, j) => {
                    const muda = (p: Partial<typeof ref>) =>
                      trocar(i, { ...bloco, itens: bloco.itens.map((x, k) => (k === j ? { ...x, ...p } : x)) });
                    return (
                      <div key={j} className="bg-muted space-y-3 rounded-lg p-3">
                        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                          <Input placeholder="Título" aria-label="Título" value={ref.titulo} onChange={(e) => muda({ titulo: e.target.value })} />
                          <Input placeholder="https://" aria-label="Link" value={ref.link} onChange={(e) => muda({ link: e.target.value })} />
                          <Remover aoClicar={() => trocar(i, { ...bloco, itens: bloco.itens.filter((_, k) => k !== j) })} />
                        </div>
                        <Textarea rows={2} placeholder="Por que vale olhar" aria-label="Comentário" value={ref.texto} onChange={(e) => muda({ texto: e.target.value })} />
                        {campoDeImagem(ref.imagem, (caminho) => muda({ imagem: caminho }))}
                      </div>
                    );
                  })}
                  <Mais rotulo="Outra referência" aoClicar={() => trocar(i, { ...bloco, itens: [...bloco.itens, { titulo: "", texto: "", link: "", imagem: null }] })} />
                </>
              ) : null}
            </div>
          ))}

          <div className="bg-card rounded-xl border p-5" data-tour="relatorio-novo-bloco">
            <p className="mb-3 text-sm font-medium">Acrescentar um bloco</p>
            <div className="flex flex-wrap gap-2">
              {TIPOS_DE_BLOCO.map((t) => (
                <Button key={t.tipo} type="button" variant="outline" title={t.descricao} onClick={() => setBlocos((a) => [...a, blocoNovo(t.tipo)])}>
                  <Plus className="size-4" /> {t.rotulo}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{rotulo}</Label>
      {children}
    </div>
  );
}

function Mais({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={aoClicar}>
      <Plus className="size-4" /> {rotulo}
    </Button>
  );
}

function Remover({ aoClicar }: { aoClicar: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label="Remover" onClick={aoClicar}>
      <Trash2 className="size-4" />
    </Button>
  );
}
