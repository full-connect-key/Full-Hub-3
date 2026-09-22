"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chamarAcao } from "@/lib/acoes/cliente";
import { PRIORIDADES, ROTULOS_DE_PRIORIDADE } from "@/lib/dominio/tasks";
import type { WorkflowCompleto } from "@/lib/dados/workflows";
import type { TaskPrioridade, TeamFuncao } from "@/lib/supabase/database.types";

import { arquivarWorkflow, duplicarWorkflow, salvarWorkflow } from "./acoes";

const GLOBAL = "__todos__";
const SEM_VALOR = "__sem__";

const FUNCOES: TeamFuncao[] = [
  "Atendimento",
  "Social Media",
  "Redator",
  "Design",
  "Audiovisual",
  "Trafego",
  "Desenvolvimento",
  "Gestao",
  "Outro",
];

type EtapaEmEdicao = {
  chave: string;
  nome: string;
  funcao: string;
  responsavel: string;
  prioridade: TaskPrioridade;
  offset: string;
  aprovacao: string;
  dependeDe: string;
};

function novaChave() {
  return Math.random().toString(36).slice(2);
}

/**
 * O editor dos fluxos.
 *
 * Duas decisões de desenho que valem explicar:
 *
 *   **A etapa tem FUNÇÃO, e não só pessoa.** "Arte — Design" continua fazendo
 *   sentido quando o designer muda; "Arte — Bruno" vira um modelo errado no
 *   dia em que o Bruno sai. A pessoa entra como padrão opcional, e na hora de
 *   aplicar a tela sugere quem está naquela função hoje.
 *
 *   **O prazo é em DIAS a partir do início da Task**, nunca uma data. Data
 *   fixa num modelo reutilizável faria toda demanda nova nascer vencida.
 *
 * Editar um fluxo não altera nenhuma Task já criada: a demanda guarda as
 * subtarefas materializadas e uma cópia do fluxo que as gerou.
 */
export function EditorDeWorkflows({
  workflows,
  clientes,
  equipe,
}: {
  workflows: WorkflowCompleto[];
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [editando, setEditando] = useState<WorkflowCompleto | "novo" | null>(null);

  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState(GLOBAL);
  const [etapas, setEtapas] = useState<EtapaEmEdicao[]>([]);

  function abrir(workflow: WorkflowCompleto | "novo") {
    setEditando(workflow);
    if (workflow === "novo") {
      setNome("");
      setCliente(GLOBAL);
      setEtapas([]);
      return;
    }
    setNome(workflow.nome);
    setCliente(workflow.client_id ?? GLOBAL);
    const chaves = workflow.etapas.map(() => novaChave());
    setEtapas(
      workflow.etapas.map((etapa, indice) => ({
        chave: chaves[indice],
        nome: etapa.nome,
        funcao: etapa.funcao_padrao ?? SEM_VALOR,
        responsavel: etapa.responsavel_padrao_id ?? SEM_VALOR,
        prioridade: etapa.prioridade,
        offset: etapa.prazo_offset_dias === null ? "" : String(etapa.prazo_offset_dias),
        aprovacao: etapa.requer_aprovacao ? (etapa.tipo_aprovacao ?? "interna") : SEM_VALOR,
        dependeDe:
          etapa.depende_de_ordem === null
            ? SEM_VALOR
            : (chaves[workflow.etapas.findIndex((e) => e.ordem === etapa.depende_de_ordem)] ??
              SEM_VALOR),
      })),
    );
  }

  function mudar(chave: string, campos: Partial<EtapaEmEdicao>) {
    setEtapas((atual) => atual.map((e) => (e.chave === chave ? { ...e, ...campos } : e)));
  }

  function mover(chave: string, direcao: -1 | 1) {
    setEtapas((atual) => {
      const indice = atual.findIndex((e) => e.chave === chave);
      const destino = indice + direcao;
      if (indice < 0 || destino < 0 || destino >= atual.length) return atual;
      const copia = [...atual];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  function salvar() {
    const validas = etapas.filter((e) => e.nome.trim().length > 0);
    const ordemPorChave = new Map(validas.map((e, indice) => [e.chave, indice + 1]));

    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        salvarWorkflow(editando === "novo" || editando === null ? null : editando.id, {
          nome,
          client_id: cliente === GLOBAL ? null : cliente,
          etapas: validas.map((etapa, indice) => ({
            nome: etapa.nome,
            ordem: indice + 1,
            funcao_padrao: etapa.funcao === SEM_VALOR ? null : (etapa.funcao as TeamFuncao),
            responsavel_padrao_id: etapa.responsavel === SEM_VALOR ? null : etapa.responsavel,
            prioridade: etapa.prioridade,
            prazo_offset_dias: etapa.offset === "" ? null : Number(etapa.offset),
            requer_aprovacao: etapa.aprovacao !== SEM_VALOR,
            tipo_aprovacao:
              etapa.aprovacao === SEM_VALOR ? null : (etapa.aprovacao as "interna" | "cliente"),
            depende_de_ordem: ordemPorChave.get(etapa.dependeDe) ?? null,
          })),
        }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setEditando(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => abrir("novo")}>
          <Plus aria-hidden />
          Novo fluxo
        </Button>
      </div>

      {workflows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Nenhum fluxo cadastrado.
        </p>
      ) : (
        <ul className="space-y-3">
          {workflows.map((workflow) => (
            <li
              key={workflow.id}
              className={`rounded-lg border p-4 ${workflow.ativo ? "" : "opacity-50"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="hover:text-brand text-sm font-semibold"
                  onClick={() => abrir(workflow)}
                >
                  {workflow.nome}
                </button>
                {workflow.cliente ? (
                  <Badge variant="outline">{workflow.cliente.nome_empresa}</Badge>
                ) : (
                  <Badge variant="secondary">Todos os clientes</Badge>
                )}
                <span className="text-muted-foreground text-xs">
                  {workflow.etapas.length} etapa{workflow.etapas.length === 1 ? "" : "s"}
                  {workflow.tiposQueUsam > 0
                    ? ` · usado por ${workflow.tiposQueUsam} tipo${workflow.tiposQueUsam === 1 ? "" : "s"}`
                    : ""}
                </span>

                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Duplicar ${workflow.nome}`}
                    disabled={salvando}
                    onClick={() =>
                      iniciar(async () => {
                        const r = await chamarAcao(() => duplicarWorkflow(workflow.id, null));
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success(r.mensagem);
                          router.refresh();
                        }
                      })
                    }
                  >
                    <Copy aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                      workflow.ativo ? `Arquivar ${workflow.nome}` : `Reativar ${workflow.nome}`
                    }
                    disabled={salvando}
                    onClick={() =>
                      iniciar(async () => {
                        const r = await chamarAcao(() =>
                          arquivarWorkflow(workflow.id, !workflow.ativo),
                        );
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success(r.mensagem);
                          router.refresh();
                        }
                      })
                    }
                  >
                    {workflow.ativo ? <Archive aria-hidden /> : <RotateCcw aria-hidden />}
                  </Button>
                </div>
              </div>

              {/* A cadeia, em uma linha: é como as etapas se encaixam. */}
              {workflow.etapas.length > 0 ? (
                <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1 text-xs">
                  {workflow.etapas.map((etapa, indice) => (
                    <span key={etapa.id} className="inline-flex items-center gap-1">
                      {indice > 0 ? <span aria-hidden>→</span> : null}
                      <span>{etapa.nome}</span>
                      {etapa.funcao_padrao ? (
                        <span className="opacity-70">({etapa.funcao_padrao})</span>
                      ) : null}
                      {etapa.requer_aprovacao ? (
                        <Lock className="size-3" aria-label="Exige aprovação" />
                      ) : null}
                    </span>
                  ))}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editando === "novo" ? "Novo fluxo" : "Editar fluxo"}</DialogTitle>
            <DialogDescription>
              O prazo de cada etapa é em dias depois do início da Task — assim o modelo serve para
              qualquer demanda. Alterar aqui não muda nenhuma Task já criada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fluxo-nome">Nome</Label>
                <Input
                  id="fluxo-nome"
                  value={nome}
                  autoFocus
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Post de feed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fluxo-cliente">Vale para</Label>
                <Select value={cliente} onValueChange={setCliente}>
                  <SelectTrigger id="fluxo-cliente" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GLOBAL}>Todos os clientes</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_empresa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Etapas</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEtapas((atual) => [
                      ...atual,
                      {
                        chave: novaChave(),
                        nome: "",
                        funcao: SEM_VALOR,
                        responsavel: SEM_VALOR,
                        prioridade: "normal",
                        offset: "",
                        aprovacao: SEM_VALOR,
                        dependeDe: SEM_VALOR,
                      },
                    ])
                  }
                >
                  <Plus aria-hidden />
                  Etapa
                </Button>
              </div>

              {etapas.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Sem etapas ainda. Cada uma vira uma subtarefa da demanda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {etapas.map((etapa, indice) => (
                    <li key={etapa.chave} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-5 shrink-0 pt-2 text-xs tabular-nums">
                          {indice + 1}
                        </span>
                        <Input
                          className="flex-1"
                          placeholder="Nome da etapa"
                          value={etapa.nome}
                          onChange={(e) => mudar(etapa.chave, { nome: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Subir"
                          disabled={indice === 0}
                          onClick={() => mover(etapa.chave, -1)}
                        >
                          <ChevronUp aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Descer"
                          disabled={indice === etapas.length - 1}
                          onClick={() => mover(etapa.chave, 1)}
                        >
                          <ChevronDown aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remover etapa"
                          onClick={() =>
                            setEtapas((atual) => atual.filter((e) => e.chave !== etapa.chave))
                          }
                        >
                          <X aria-hidden />
                        </Button>
                      </div>

                      <div className="grid gap-2 pl-7 sm:grid-cols-3">
                        <Select
                          value={etapa.funcao}
                          onValueChange={(v) => mudar(etapa.chave, { funcao: v })}
                        >
                          <SelectTrigger className="w-full" aria-label="Função">
                            <SelectValue placeholder="Função" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_VALOR}>Sem função definida</SelectItem>
                            {FUNCOES.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={etapa.responsavel}
                          onValueChange={(v) => mudar(etapa.chave, { responsavel: v })}
                        >
                          <SelectTrigger className="w-full" aria-label="Responsável padrão">
                            <SelectValue placeholder="Responsável padrão" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_VALOR}>Sem pessoa fixa</SelectItem>
                            {equipe.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            aria-label="Dias após o início"
                            value={etapa.offset}
                            onChange={(e) => mudar(etapa.chave, { offset: e.target.value })}
                            placeholder="0"
                          />
                          <span className="text-muted-foreground shrink-0 text-xs">
                            dias após o início
                          </span>
                        </div>

                        <Select
                          value={etapa.prioridade}
                          onValueChange={(v) =>
                            mudar(etapa.chave, { prioridade: v as TaskPrioridade })
                          }
                        >
                          <SelectTrigger className="w-full" aria-label="Prioridade">
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

                        <Select
                          value={etapa.aprovacao}
                          onValueChange={(v) => mudar(etapa.chave, { aprovacao: v })}
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
                          value={etapa.dependeDe}
                          onValueChange={(v) => mudar(etapa.chave, { dependeDe: v })}
                        >
                          <SelectTrigger className="w-full" aria-label="Depende de">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_VALOR}>Não depende de nada</SelectItem>
                            {etapas
                              .filter((outra, i) => i < indice)
                              .map((outra, i) => (
                                <SelectItem key={outra.chave} value={outra.chave}>
                                  Depende de {i + 1}. {outra.nome || "(sem nome)"}
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
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando || nome.trim().length < 2}>
              {salvando ? <Loader2 className="animate-spin" /> : null}
              Salvar fluxo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
