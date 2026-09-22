"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Link2, Loader2, Paperclip, Plus, X } from "lucide-react";
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
import type { TaskPrioridade } from "@/lib/supabase/database.types";

import { criarTask } from "./acoes";

const SEM_VALOR = "__nenhum__";
const TAMANHO_MAXIMO = 15 * 1024 * 1024;

type SubtarefaNova = { chave: string; titulo: string; responsavel_id: string; prazo: string };
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
}: {
  aberto: boolean;
  aoFechar: () => void;
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState(SEM_VALOR);
  const [responsavel, setResponsavel] = useState(SEM_VALOR);
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState<TaskPrioridade>("normal");
  const [estimativa, setEstimativa] = useState("");
  const [briefing, setBriefing] = useState<{ json: JSONContent; texto: string } | null>(null);
  const [subtarefas, setSubtarefas] = useState<SubtarefaNova[]>([]);
  const [referencias, setReferencias] = useState<ReferenciaNova[]>([]);

  function limpar() {
    setTitulo("");
    setCliente(SEM_VALOR);
    setResponsavel(SEM_VALOR);
    setPrazo("");
    setPrioridade("normal");
    setEstimativa("");
    setBriefing(null);
    setSubtarefas([]);
    setReferencias([]);
  }

  function adicionarSubtarefa() {
    setSubtarefas((atual) => [
      ...atual,
      { chave: novaChave(), titulo: "", responsavel_id: SEM_VALOR, prazo: "" },
    ]);
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
    setSalvando(true);
    try {
      const resultado = await criarTask({
        titulo,
        client_id: cliente === SEM_VALOR ? null : cliente,
        responsavel_id: responsavel === SEM_VALOR ? null : responsavel,
        prazo: prazo || null,
        prioridade,
        estimativa_horas: estimativa || null,
        briefing_rico: briefing?.json ?? null,
        briefing_texto: briefing?.texto ?? null,
        subtarefas: subtarefas
          .filter((sub) => sub.titulo.trim().length > 0)
          .map((sub) => ({
            titulo: sub.titulo,
            prazo: sub.prazo || null,
            responsavel_id: sub.responsavel_id === SEM_VALOR ? null : sub.responsavel_id,
          })),
        referencias: referencias.map((ref) => ({
          tipo: ref.tipo,
          url: ref.url,
          titulo: ref.titulo || null,
          arquivo_nome: ref.arquivo_nome ?? null,
        })),
      });

      if (resultado.erro && !resultado.dado) {
        toast.error(resultado.erro);
        return;
      }
      if (resultado.erro) toast.warning(resultado.erro);
      else toast.success(resultado.ok ?? "Task criada.");

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
            Só o título é obrigatório. Subtarefas podem ter prazo e responsável próprios.
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
              <Label htmlFor="task-cliente">Cliente</Label>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger id="task-cliente" className="w-full">
                  <SelectValue placeholder="Escolha o cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_VALOR}>Sem cliente (interna)</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_empresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-responsavel">Responsável</Label>
              <Select value={responsavel} onValueChange={setResponsavel}>
                <SelectTrigger id="task-responsavel" className="w-full">
                  <SelectValue placeholder="Escolha o responsável" />
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
            </div>
          </div>

          <div className="space-y-2">
            <Label>Briefing</Label>
            <EditorRico conteudo={null} onChange={setBriefing} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="task-prazo">Prazo</Label>
              <Input
                id="task-prazo"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
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
            <div className="space-y-2">
              <Label htmlFor="task-estimativa">Estimativa (horas)</Label>
              <Input
                id="task-estimativa"
                type="number"
                min={0}
                step="0.5"
                value={estimativa}
                onChange={(e) => setEstimativa(e.target.value)}
              />
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
                Cada subtarefa tem prazo e responsável próprios, e aparece no calendário no dia
                dela.
              </p>
            ) : (
              <ul className="space-y-2">
                {subtarefas.map((sub) => (
                  <li key={sub.chave} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                    <Input
                      className="sm:col-span-5"
                      placeholder="Título da subtarefa"
                      value={sub.titulo}
                      onChange={(e) => mudarSubtarefa(sub.chave, { titulo: e.target.value })}
                    />
                    <Select
                      value={sub.responsavel_id}
                      onValueChange={(v) => mudarSubtarefa(sub.chave, { responsavel_id: v })}
                    >
                      <SelectTrigger className="w-full sm:col-span-4">
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
                      className="sm:col-span-2"
                      type="date"
                      value={sub.prazo}
                      onChange={(e) => mudarSubtarefa(sub.chave, { prazo: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover subtarefa"
                      className="sm:col-span-1"
                      onClick={() =>
                        setSubtarefas((atual) => atual.filter((s) => s.chave !== sub.chave))
                      }
                    >
                      <X aria-hidden />
                    </Button>
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
