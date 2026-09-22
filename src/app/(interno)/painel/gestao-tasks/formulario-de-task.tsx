"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { ChevronDown, ChevronUp, Link2, Loader2, Paperclip, Plus, X } from "lucide-react";
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
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { TaskPrioridade, TeamFuncao } from "@/lib/supabase/database.types";

import { criarTask, sugerirEtapasDoTipo } from "./acoes";
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
  /** Tipos de tarefa: os globais e os de cada cliente. */
  tipos: { id: string; nome: string; client_id: string | null }[];
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [aplicando, iniciarAplicacao] = useTransition();

  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState(SEM_VALOR);
  const [tipo, setTipo] = useState(SEM_VALOR);
  const [dataInicio, setDataInicio] = useState(HOJE);
  const [dataFim, setDataFim] = useState("");
  const [prioridade, setPrioridade] = useState<TaskPrioridade>("normal");
  const [briefing, setBriefing] = useState<{ json: JSONContent; texto: string } | null>(null);
  const [subtarefas, setSubtarefas] = useState<SubtarefaNova[]>([]);
  const [snapshot, setSnapshot] = useState<unknown>(null);
  const [referencias, setReferencias] = useState<ReferenciaNova[]>([]);

  // Um tipo específico de cliente só aparece para aquele cliente; os globais
  // valem para todos.
  const tiposVisiveis = tipos.filter(
    (t) => t.client_id === null || (cliente !== SEM_VALOR && t.client_id === cliente),
  );

  function limpar() {
    setTitulo("");
    setCliente(SEM_VALOR);
    setTipo(SEM_VALOR);
    setDataInicio(HOJE());
    setDataFim("");
    setPrioridade("normal");
    setBriefing(null);
    setSubtarefas([]);
    setSnapshot(null);
    setReferencias([]);
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

  function adicionarLink() {
    const endereco = window.prompt("Endereço do link", "https://");
    if (!endereco?.trim()) return;
    const nome = window.prompt("Como chamar este link? (opcional)", "") ?? "";
    setReferencias((atual) => [
      ...atual,
      { chave: novaChave(), tipo: "link", url: endereco.trim(), titulo: nome.trim() },
    ]);
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
    if (cliente === SEM_VALOR) {
      toast.error("Toda task pertence a um cliente. Escolha de quem é esta demanda.");
      return;
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nova task</DialogTitle>
          <DialogDescription>
            A Task agrupa a demanda; quem tem dono, prazo e aprovação é cada subtarefa. Escolher um
            tipo já traz as etapas daquele tipo de trabalho — e elas continuam editáveis aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="task-titulo">Título *</Label>
            <Input
              id="task-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Carrossel de lançamento"
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="space-y-2">
              <Label htmlFor="task-tipo">Tipo de tarefa</Label>
              <Select value={tipo} onValueChange={aplicarTipo} disabled={aplicando}>
                <SelectTrigger id="task-tipo" className="w-full">
                  <SelectValue placeholder="Sem tipo — monto as etapas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_VALOR}>Sem tipo — monto as etapas</SelectItem>
                  {tiposVisiveis.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                      {t.client_id ? " (deste cliente)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Briefing</Label>
            <EditorRico conteudo={null} onChange={setBriefing} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="task-inicio">Início *</Label>
              <Input
                id="task-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-fim">Fim</Label>
              <Input
                id="task-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-prioridade">Prioridade</Label>
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

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Referências</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={adicionarLink}>
                  <Link2 aria-hidden />
                  Link
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
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
            </div>

            {referencias.length > 0 ? (
              <ul className="space-y-1.5">
                {referencias.map((ref) => (
                  <li
                    key={ref.chave}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    {ref.tipo === "link" ? (
                      <Link2 aria-hidden className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <Paperclip aria-hidden className="text-muted-foreground size-4 shrink-0" />
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
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Subtarefas</Label>
              <Button type="button" variant="outline" size="sm" onClick={adicionarSubtarefa}>
                <Plus aria-hidden />
                Subtarefa
              </Button>
            </div>

            {subtarefas.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                A subtarefa é a unidade de trabalho: é nela que entra o responsável, o prazo e a
                regra de aprovação. Criar a demanda sem tipo e montar as etapas à mão é um caminho
                normal.
              </p>
            ) : (
              <ul className="space-y-2">
                {subtarefas.map((sub, indice) => (
                  <li key={sub.chave} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground w-5 shrink-0 pt-2 text-xs tabular-nums">
                        {indice + 1}
                      </span>
                      <Input
                        className="flex-1"
                        placeholder="Título da subtarefa"
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

                    <div className="grid gap-2 pl-7 sm:grid-cols-5">
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
                        aria-label="Prazo da subtarefa"
                        value={sub.prazo}
                        onChange={(e) => mudarSubtarefa(sub.chave, { prazo: e.target.value })}
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
          </section>
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
