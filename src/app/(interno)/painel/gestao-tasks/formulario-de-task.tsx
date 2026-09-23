"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { EditorRico } from "@/components/shared/editor-rico";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORIDADES, ROTULOS_DE_PRIORIDADE } from "@/lib/dominio/tasks";
import { interpretarTempo } from "@/lib/dominio/tempo";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type {
  ExigenciaAprovacao,
  TaskPrioridade,
  TeamFuncao,
} from "@/lib/supabase/database.types";

import { criarTask, sugerirEtapasDoTipo } from "./acoes";
import { EscolhaDaExigencia } from "./escolha-da-exigencia";
import { SecaoDoFormulario } from "@/components/shared/secao-do-formulario";
import { chamarAcao } from "@/lib/acoes/cliente";

const SEM_VALOR = "__nenhum__";
const TAMANHO_MAXIMO = 15 * 1024 * 1024;

const HOJE = () => new Date().toISOString().slice(0, 10);

type SubtarefaNova = {
  chave: string;
  titulo: string;
  responsavel_id: string;
  prazo: string;
  prioridade: TaskPrioridade;
  /** SEM_VALOR = não precisa de aprovação. */
  aprovacao: string;
  estimativa: string;
  /** Chave da subtarefa de que esta depende, no próprio formulário. */
  depende_de: string;
};
type ReferenciaNova = {
  chave: string;
  tipo: "link" | "arquivo";
  url: string;
  titulo: string;
  arquivo_nome?: string;
};

function novaChave() {
  return Math.random().toString(36).slice(2);
}

/**
 * Criação de task.
 *
 * Subtarefas e referências são montadas aqui e gravadas junto com a task, numa
 * ação só — quem está abrindo uma demanda costuma já saber as etapas, e fazer
 * isso em telas separadas quebraria o raciocínio.
 *
 * O arquivo de referência sobe antes da task existir, para uma pasta de
 * rascunho. O bucket é privado, então o que guardamos é o caminho, não uma URL
 * pública: quem abrir depois recebe uma URL assinada e temporária.
 */
export function FormularioDeTask({
  aberto,
  aoFechar,
  clientes,
  equipe,
  tipos,
}: {
  aberto: boolean;
  aoFechar: () => void;
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string; funcao?: TeamFuncao | null }[];
  /** Workflows: os globais e os de cada cliente. */
  tipos: { id: string; nome: string; client_id: string | null }[];
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [aplicando, iniciarAplicacao] = useTransition();

  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState("");
  const [tipo, setTipo] = useState(SEM_VALOR);
  const [dataInicio, setDataInicio] = useState(HOJE);
  const [dataFim, setDataFim] = useState("");
  const [prioridade, setPrioridade] = useState<TaskPrioridade>("normal");
  const [exigencia, setExigencia] = useState<ExigenciaAprovacao>("nenhuma");
  const [linkEntrega, setLinkEntrega] = useState("");
  const [briefing, setBriefing] = useState<{ json: JSONContent; texto: string } | null>(null);
  const [subtarefas, setSubtarefas] = useState<SubtarefaNova[]>([]);
  const [snapshot, setSnapshot] = useState<unknown>(null);
  const [referencias, setReferencias] = useState<ReferenciaNova[]>([]);
  const [novoLink, setNovoLink] = useState("");
  const [novoLinkTitulo, setNovoLinkTitulo] = useState("");

  // Um tipo específico de cliente só aparece para aquele cliente; os globais
  // valem para todos.
  const tiposVisiveis = tipos.filter(
    (t) => t.client_id === null || (cliente !== "" && t.client_id === cliente),
  );

  function limpar() {
    setTitulo("");
    setCliente("");
    setTipo(SEM_VALOR);
    setDataInicio(HOJE());
    setDataFim("");
    setPrioridade("normal");
    setExigencia("nenhuma");
    setLinkEntrega("");
    setBriefing(null);
    setSubtarefas([]);
    setSnapshot(null);
    setReferencias([]);
    setNovoLink("");
    setNovoLinkTitulo("");
  }

  function subtarefaVazia(): SubtarefaNova {
    return {
      chave: novaChave(),
      titulo: "",
      responsavel_id: SEM_VALOR,
      prazo: "",
      prioridade: "normal",
      aprovacao: SEM_VALOR,
      estimativa: "",
      depende_de: SEM_VALOR,
    };
  }

  function adicionarSubtarefa() {
    setSubtarefas((atual) => [...atual, subtarefaVazia()]);
  }

  /** Reordenar é o que permite ajustar um fluxo aplicado antes de salvar. */
  function mover(chave: string, direcao: -1 | 1) {
    setSubtarefas((atual) => {
      const indice = atual.findIndex((s) => s.chave === chave);
      const destino = indice + direcao;
      if (indice < 0 || destino < 0 || destino >= atual.length) return atual;
      const copia = [...atual];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  /**
   * Aplica o fluxo do tipo escolhido.
   *
   * As etapas viram subtarefas comuns do formulário: dá para trocar o
   * responsável, mexer no prazo, acrescentar, remover e reordenar antes de
   * salvar. Escolher um tipo é um atalho, não uma camisa de força.
   */
  function aplicarTipo(novoTipo: string) {
    setTipo(novoTipo);
    if (novoTipo === SEM_VALOR) {
      setSnapshot(null);
      return;
    }
    iniciarAplicacao(async () => {
      const resultado = await chamarAcao(() => sugerirEtapasDoTipo(novoTipo, dataInicio));
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      const aplicado = resultado.dados;
      if (!aplicado) {
        toast.info(resultado.mensagem);
        return;
      }

      const chaves = aplicado.etapas.map(() => novaChave());
      setSnapshot(aplicado.snapshot);
      setSubtarefas(
        aplicado.etapas.map((etapa, indice) => ({
          chave: chaves[indice],
          titulo: etapa.titulo,
          // O modelo diz a FUNÇÃO ("Design"); a pessoa daquela função entra
          // como sugestão, e quem abre a demanda confirma ou troca.
          responsavel_id:
            etapa.responsavel_id ??
            equipe.find((p) => etapa.funcao_padrao && p.funcao === etapa.funcao_padrao)?.id ??
            SEM_VALOR,
          prazo: etapa.prazo ?? "",
          prioridade: etapa.prioridade,
          aprovacao: etapa.requer_aprovacao ? (etapa.tipo_aprovacao ?? "interna") : SEM_VALOR,
          estimativa: "",
          depende_de: etapa.depende_de ? chaves[etapa.depende_de - 1] : SEM_VALOR,
        })),
      );
      toast.success(`${aplicado.etapas.length} etapa(s) sugeridas. Ajuste como quiser.`);
    });
  }

  function mudarSubtarefa(chave: string, campos: Partial<SubtarefaNova>) {
    setSubtarefas((atual) =>
      atual.map((sub) => (sub.chave === chave ? { ...sub, ...campos } : sub)),
    );
  }

  /**
   * O link entra num campo da própria tela, e não num `window.prompt`.
   *
   * O prompt do navegador não dá para colar com o teclado do celular, não
   * valida nada, some se a pessoa clicar fora e perde o que já estava
   * digitado. Pior: em alguns navegadores ele simplesmente não abre, e o
   * botão vira um botão que não faz nada.
   */
  function adicionarLink() {
    const endereco = novoLink.trim();
    if (!/^https?:\/\/\S+$/.test(endereco)) {
      toast.error("O link precisa começar com http:// ou https://.");
      return;
    }
    setReferencias((atual) => [
      ...atual,
      { chave: novaChave(), tipo: "link", url: endereco, titulo: novoLinkTitulo.trim() },
    ]);
    setNovoLink("");
    setNovoLinkTitulo("");
  }

  async function enviarArquivo(arquivo: File) {
    if (arquivo.size > TAMANHO_MAXIMO) {
      toast.error("O arquivo precisa ter no máximo 15 MB.");
      return;
    }
    setEnviandoArquivo(true);
    try {
      const supabase = criarClienteNavegador();
      const caminho = `rascunhos/${novaChave()}-${arquivo.name}`;
      const { error } = await supabase.storage
        .from("task-arquivos")
        .upload(caminho, arquivo, { contentType: arquivo.type });

      if (error) {
        toast.error(`Não foi possível enviar: ${error.message}`);
        return;
      }
      setReferencias((atual) => [
        ...atual,
        {
          chave: novaChave(),
          tipo: "arquivo",
          url: caminho,
          titulo: arquivo.name,
          arquivo_nome: arquivo.name,
        },
      ]);
      toast.success("Arquivo anexado.");
    } finally {
      setEnviandoArquivo(false);
    }
  }

  async function salvar() {
    if (titulo.trim().length < 2) {
      toast.error("Informe o título da task.");
      return;
    }
    if (!cliente) {
      toast.error("Toda task pertence a um cliente. Escolha de quem é esta demanda.");
      return;
    }
    if (!linkEntrega.trim()) {
      toast.error(
        "Informe a pasta de entrega: onde o material final vai ficar. É a seção 6.",
      );
      return;
    }
    if (!/^https?:\/\/\S+$/.test(linkEntrega.trim())) {
      toast.error("A pasta de entrega precisa começar com http:// ou https://.");
      return;
    }
    if (dataFim && dataFim < dataInicio) {
      toast.error("O fim da demanda não pode ser antes do início.");
      return;
    }

    // A exigência é uma promessa que alguém vai ter que cumprir. Se nenhuma
    // etapa pede a aprovação que a demanda exige, o banco recusa o "entregue"
    // lá na frente — e quem descobre é quem for encerrar, semanas depois. O
    // aviso é aqui, e não bloqueia: dá para montar as etapas depois.
    const etapasValidas = subtarefas.filter((sub) => sub.titulo.trim().length > 0);
    if (
      exigencia !== "nenhuma" &&
      etapasValidas.length > 0 &&
      !etapasValidas.some((sub) => sub.aprovacao === exigencia)
    ) {
      toast.warning(
        exigencia === "cliente"
          ? "Esta demanda exige aprovação do cliente, mas nenhuma etapa pede essa aprovação. Dá para ajustar depois — só não vai dar para encerrar sem isso."
          : "Esta demanda exige aprovação interna, mas nenhuma etapa pede essa aprovação. Dá para ajustar depois — só não vai dar para encerrar sem isso.",
      );
    }
    setSalvando(true);
    try {
      const validas = subtarefas.filter((sub) => sub.titulo.trim().length > 0);
      const posicao = new Map(validas.map((sub, indice) => [sub.chave, indice + 1]));

      const resultado = await chamarAcao(() => criarTask({
        titulo,
        client_id: cliente,
        task_type_id: tipo === SEM_VALOR ? null : tipo,
        workflow_snapshot: snapshot,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        prioridade,
        exigencia_aprovacao: exigencia,
        link_entrega: linkEntrega.trim() || null,
        briefing_rico: briefing?.json ?? null,
        briefing_texto: briefing?.texto ?? null,
        subtarefas: validas.map((sub) => ({
          titulo: sub.titulo,
          prazo: sub.prazo || null,
          responsavel_id: sub.responsavel_id === SEM_VALOR ? null : sub.responsavel_id,
          prioridade: sub.prioridade,
          requer_aprovacao: sub.aprovacao !== SEM_VALOR,
          tipo_aprovacao: sub.aprovacao === SEM_VALOR ? null : (sub.aprovacao as "interna" | "cliente"),
          estimativa: sub.estimativa || null,
          depende_de: posicao.get(sub.depende_de) ?? null,
        })),
        referencias: referencias.map((ref) => ({
          tipo: ref.tipo,
          url: ref.url,
          titulo: ref.titulo || null,
          arquivo_nome: ref.arquivo_nome ?? null,
        })),
      }));

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.mensagem);

      limpar();
      aoFechar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(estado) => (estado ? null : aoFechar())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nova Task</DialogTitle>
          <DialogDescription>
            A Task é o agrupador do job. Os responsáveis e os prazos são definidos nas subtarefas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ----------------------------------------------------------------
              1. Quem pediu, de quem é, e o que é.
             ---------------------------------------------------------------- */}
          <SecaoDoFormulario
            numero={1}
            titulo="Informações gerais da demanda"
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
                <div className="space-y-2">
                  <Label htmlFor="task-titulo">Nome da Task *</Label>
                  <Input
                    id="task-titulo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Campanha Dia das Mães"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-cliente">Cliente *</Label>
                  <Select
                    value={cliente}
                    onValueChange={(v) => {
                      setCliente(v);
                      // Um tipo do cliente anterior não vale para o novo.
                      if (tipo !== SEM_VALOR) {
                        const escolhido = tipos.find((t) => t.id === tipo);
                        if (escolhido?.client_id && escolhido.client_id !== v) setTipo(SEM_VALOR);
                      }
                    }}
                  >
                    <SelectTrigger id="task-cliente" className="w-full">
                      <SelectValue placeholder="Escolha o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome_empresa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Briefing e orientações gerais</Label>
                <EditorRico conteudo={null} onChange={setBriefing} />
                <p className="text-text-muted text-xs">
                  Objetivo, conceito, referências e o que mais a equipe precisa saber para executar
                  sem perguntar.
                </p>
              </div>
            </div>
          </SecaoDoFormulario>

          {/* ----------------------------------------------------------------
              2. Quando, e com que urgência.

              NÃO existe seletor de status aqui, e a ausência é deliberada: o
              status da Task é calculado por trigger a partir das subtarefas e
              das rodadas de aprovação. Um "Status Geral" digitado na abertura
              seria desfeito pelo recálculo um milissegundo depois de salvar,
              e a pessoa veria a própria escolha sumir sem explicação. Os
              únicos status que alguém marca à mão são "Entregue" e
              "Aguardando informações", e nenhum dos dois faz sentido numa
              demanda que está nascendo.
             ---------------------------------------------------------------- */}
          <SecaoDoFormulario
            numero={2}
            titulo="Período e prioridade"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="task-inicio">Data de início *</Label>
                <Input
                  id="task-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-fim">Data de encerramento</Label>
                <Input
                  id="task-fim"
                  type="date"
                  value={dataFim}
                  min={dataInicio}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-prioridade">Prioridade geral</Label>
                <Select
                  value={prioridade}
                  onValueChange={(v) => setPrioridade(v as TaskPrioridade)}
                >
                  <SelectTrigger id="task-prioridade" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {ROTULOS_DE_PRIORIDADE[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SecaoDoFormulario>

          {/* ----------------------------------------------------------------
              3. O que a demanda inteira precisa antes de sair.
             ---------------------------------------------------------------- */}
          <SecaoDoFormulario
            numero={3}
            titulo="Exigência de aprovação da demanda"
          >
            <EscolhaDaExigencia valor={exigencia} aoMudar={setExigencia} />
          </SecaoDoFormulario>

          {/* ----------------------------------------------------------------
              4. O atalho: um workflow traz as etapas prontas.
             ---------------------------------------------------------------- */}
          <SecaoDoFormulario
            numero={4}
            titulo="Workflow (opcional)"
          >
            <Select value={tipo} onValueChange={aplicarTipo} disabled={aplicando}>
              <SelectTrigger id="task-tipo" className="w-full sm:max-w-md">
                <SelectValue placeholder="Sem workflow — monto as etapas à mão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_VALOR}>Sem workflow — monto as etapas à mão</SelectItem>
                {tiposVisiveis.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                    {t.client_id ? " (deste cliente)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SecaoDoFormulario>

          {/* ----------------------------------------------------------------
              5. A unidade de trabalho de verdade.
             ---------------------------------------------------------------- */}
          <SecaoDoFormulario
            numero={5}
            titulo="Subtarefas e entregas"
            acao={
              <Button type="button" variant="outline" size="sm" onClick={adicionarSubtarefa}>
                <Plus aria-hidden />
                Subtarefa
              </Button>
            }
          >
            {subtarefas.length === 0 ? (
              <p className="text-text-muted rounded-card border border-dashed px-4 py-6 text-center text-sm">
                Nenhuma subtarefa ainda. Acrescente pelo menos uma, com responsável e data de
                entrega, para a equipe ter o que executar — ou escolha um workflow acima e
                ajuste as etapas que vierem.
              </p>
            ) : (
              <ul className="space-y-2">
                {subtarefas.map((sub, indice) => (
                  <li key={sub.chave} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-text-muted w-5 shrink-0 pt-2 text-xs tabular-nums">
                        {indice + 1}
                      </span>
                      <Input
                        className="flex-1"
                        placeholder="Nome da etapa (ex: Redação do copy)"
                        value={sub.titulo}
                        onChange={(e) => mudarSubtarefa(sub.chave, { titulo: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Subir"
                        disabled={indice === 0}
                        onClick={() => mover(sub.chave, -1)}
                      >
                        <ChevronUp aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Descer"
                        disabled={indice === subtarefas.length - 1}
                        onClick={() => mover(sub.chave, 1)}
                      >
                        <ChevronDown aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover subtarefa"
                        onClick={() =>
                          setSubtarefas((atual) => atual.filter((s) => s.chave !== sub.chave))
                        }
                      >
                        <X aria-hidden />
                      </Button>
                    </div>

                    <div className="grid gap-2 pl-7 sm:grid-cols-2 lg:grid-cols-3">
                      <Select
                        value={sub.responsavel_id}
                        onValueChange={(v) => mudarSubtarefa(sub.chave, { responsavel_id: v })}
                      >
                        <SelectTrigger className="w-full" aria-label="Responsável">
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEM_VALOR}>Sem responsável</SelectItem>
                          {equipe.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="date"
                        aria-label="Data de entrega"
                        value={sub.prazo}
                        onChange={(e) => mudarSubtarefa(sub.chave, { prazo: e.target.value })}
                      />

                      {/* A estimativa aceita "2h30", "2,5h", "150" e "90min".
                          Hora decimal é uma conta que a pessoa faz de cabeça
                          antes de digitar; o campo faz essa conta por ela. */}
                      <Input
                        aria-label="Estimativa de tempo"
                        placeholder="2h30"
                        value={sub.estimativa}
                        onChange={(e) => mudarSubtarefa(sub.chave, { estimativa: e.target.value })}
                        className={
                          sub.estimativa.trim() && interpretarTempo(sub.estimativa) === undefined
                            ? "border-danger"
                            : undefined
                        }
                      />

                      <Select
                        value={sub.prioridade}
                        onValueChange={(v) =>
                          mudarSubtarefa(sub.chave, { prioridade: v as TaskPrioridade })
                        }
                      >
                        <SelectTrigger className="w-full" aria-label="Prioridade da subtarefa">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORIDADES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {ROTULOS_DE_PRIORIDADE[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Aprovação: o tipo diz para onde ela vai no fim. Toda
                          aprovação passa primeiro pela validação interna. */}
                      <Select
                        value={sub.aprovacao}
                        onValueChange={(v) => mudarSubtarefa(sub.chave, { aprovacao: v })}
                      >
                        <SelectTrigger className="w-full" aria-label="Aprovação">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEM_VALOR}>Sem aprovação</SelectItem>
                          <SelectItem value="interna">Aprovação interna</SelectItem>
                          <SelectItem value="cliente">Aprovação do cliente</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={sub.depende_de}
                        onValueChange={(v) => mudarSubtarefa(sub.chave, { depende_de: v })}
                      >
                        <SelectTrigger className="w-full" aria-label="Depende de">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEM_VALOR}>Não depende de nada</SelectItem>
                          {subtarefas
                            .filter((outra, i) => outra.chave !== sub.chave && i < indice)
                            .map((outra, i) => (
                              <SelectItem key={outra.chave} value={outra.chave}>
                                Depende de {i + 1}. {outra.titulo || "(sem título)"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SecaoDoFormulario>

          {/* ----------------------------------------------------------------
              6. Onde o material vive.

              O link de ENTREGA é um só, e é separado das referências: o que
              alguém procura semanas depois é a pasta do material final, e
              achá-la no meio de oito links de apoio é o mesmo que não tê-la.
             ---------------------------------------------------------------- */}
          <SecaoDoFormulario
            numero={6}
            titulo="Materiais e links"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-link-entrega">Pasta de entrega *</Label>
                <div className="relative">
                  <FolderOpen
                    aria-hidden
                    className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  />
                  <Input
                    id="task-link-entrega"
                    className="pl-9"
                    value={linkEntrega}
                    onChange={(e) => setLinkEntrega(e.target.value)}
                    placeholder="https://figma.com/… ou https://drive.google.com/…"
                  />
                </div>
                <p className="text-text-muted text-xs">
                  Onde o material final vai ficar. Quem procura a peça pronta procura aqui — e
                  costuma ser outra pessoa, semanas depois.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Referências e links de apoio</Label>

                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    className="min-w-[14rem] flex-1"
                    aria-label="Endereço da referência"
                    value={novoLink}
                    onChange={(e) => setNovoLink(e.target.value)}
                    placeholder="https://…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarLink();
                      }
                    }}
                  />
                  <Input
                    className="min-w-[10rem] flex-1"
                    aria-label="Nome da referência"
                    value={novoLinkTitulo}
                    onChange={(e) => setNovoLinkTitulo(e.target.value)}
                    placeholder="Como chamar (opcional)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarLink();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={adicionarLink}
                    disabled={!novoLink.trim()}
                  >
                    <Link2 aria-hidden />
                    Adicionar
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <label className="cursor-pointer">
                      {enviandoArquivo ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Paperclip aria-hidden />
                      )}
                      Arquivo
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(e) => {
                          const arquivo = e.target.files?.[0];
                          if (arquivo) void enviarArquivo(arquivo);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </Button>
                </div>

                {referencias.length > 0 ? (
                  <ul className="space-y-1.5">
                    {referencias.map((ref) => (
                      <li
                        key={ref.chave}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        {ref.tipo === "link" ? (
                          <Link2 aria-hidden className="text-text-muted size-4 shrink-0" />
                        ) : (
                          <Paperclip aria-hidden className="text-text-muted size-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{ref.titulo || ref.url}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Remover referência"
                          onClick={() =>
                            setReferencias((atual) => atual.filter((r) => r.chave !== ref.chave))
                          }
                        >
                          <X aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted text-xs">Nenhuma referência adicionada.</p>
                )}
              </div>
            </div>
          </SecaoDoFormulario>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" /> : null}
            Criar task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
