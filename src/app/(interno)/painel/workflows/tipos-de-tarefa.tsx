"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Pencil, Plus, RotateCcw } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { TipoDeTarefa } from "@/lib/dados/workflows";

import { arquivarTipoDeTarefa, salvarTipoDeTarefa } from "./acoes";

const GLOBAL = "__todos__";
const SEM_FLUXO = "__sem__";

/**
 * Tipos de tarefa.
 *
 * É o atalho que a pessoa escolhe ao abrir uma demanda: "Post de feed" traz as
 * etapas de um post de feed. Ela não precisa saber que existe um objeto
 * chamado workflow — por isso o tipo vem primeiro, e o fluxo aparece como uma
 * coluna dele.
 *
 * Um tipo pode valer para todos os clientes ou ser de um só. É assim que uma
 * conta com processo próprio ganha o fluxo dela sem duplicar o resto.
 */
export function TiposDeTarefa({
  tipos,
  clientes,
  workflows,
}: {
  tipos: TipoDeTarefa[];
  clientes: { id: string; nome_empresa: string }[];
  workflows: { id: string; nome: string; client_id: string | null; ativo: boolean }[];
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [editando, setEditando] = useState<TipoDeTarefa | "novo" | null>(null);

  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState(GLOBAL);
  const [fluxo, setFluxo] = useState(SEM_FLUXO);

  function abrir(tipo: TipoDeTarefa | "novo") {
    setEditando(tipo);
    setNome(tipo === "novo" ? "" : tipo.nome);
    setCliente(tipo === "novo" ? GLOBAL : (tipo.client_id ?? GLOBAL));
    setFluxo(tipo === "novo" ? SEM_FLUXO : (tipo.workflow_template_id ?? SEM_FLUXO));
  }

  function salvar() {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        salvarTipoDeTarefa(editando === "novo" || editando === null ? null : editando.id, {
          nome,
          client_id: cliente === GLOBAL ? null : cliente,
          workflow_template_id: fluxo === SEM_FLUXO ? null : fluxo,
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
          Novo tipo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fluxo</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tipos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground text-center">
                Nenhum tipo cadastrado.
              </TableCell>
            </TableRow>
          ) : (
            tipos.map((tipo) => (
              <TableRow key={tipo.id} className={tipo.ativo ? undefined : "opacity-50"}>
                <TableCell>
                  <span className="font-medium">{tipo.nome}</span>
                  {tipo.descricao ? (
                    <p className="text-muted-foreground text-xs">{tipo.descricao}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  {tipo.cliente ? (
                    <Badge variant="outline">{tipo.cliente.nome_empresa}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Todos</span>
                  )}
                </TableCell>
                <TableCell>
                  {tipo.workflow ? (
                    <span className="text-sm">
                      {tipo.workflow.nome}
                      <span className="text-muted-foreground">
                        {" "}
                        · {tipo.workflow.etapas} etapa{tipo.workflow.etapas === 1 ? "" : "s"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sem fluxo</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${tipo.nome}`}
                    onClick={() => abrir(tipo)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tipo.ativo ? `Arquivar ${tipo.nome}` : `Reativar ${tipo.nome}`}
                    disabled={salvando}
                    onClick={() =>
                      iniciar(async () => {
                        const r = await chamarAcao(() => arquivarTipoDeTarefa(tipo.id, !tipo.ativo));
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success(r.mensagem);
                          router.refresh();
                        }
                      })
                    }
                  >
                    {tipo.ativo ? <Archive aria-hidden /> : <RotateCcw aria-hidden />}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando === "novo" ? "Novo tipo de tarefa" : "Editar tipo"}</DialogTitle>
            <DialogDescription>
              O tipo é o que a pessoa escolhe ao abrir a demanda. O fluxo vinculado vira as
              subtarefas dela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tipo-nome">Nome</Label>
              <Input
                id="tipo-nome"
                value={nome}
                autoFocus
                onChange={(e) => setNome(e.target.value)}
                placeholder="Post de feed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo-cliente">Vale para</Label>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger id="tipo-cliente" className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="tipo-fluxo">Fluxo</Label>
              <Select value={fluxo} onValueChange={setFluxo}>
                <SelectTrigger id="tipo-fluxo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_FLUXO}>Sem fluxo — etapas à mão</SelectItem>
                  {workflows
                    .filter(
                      (w) =>
                        w.ativo && (w.client_id === null || w.client_id === (cliente === GLOBAL ? null : cliente)),
                    )
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando || nome.trim().length < 2}>
              {salvando ? <Loader2 className="animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
