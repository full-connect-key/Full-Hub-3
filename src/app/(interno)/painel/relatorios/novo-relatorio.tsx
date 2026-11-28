"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

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
import { chamarEMostrar } from "@/lib/acoes/cliente";

import { criarRelatorio } from "./acoes";

/** A porta de entrada: conta, título e período. O resto é no editor. */
export function NovoRelatorio({
  contas,
  inicioSugerido,
  fimSugerido,
}: {
  contas: { id: string; nome: string }[];
  inicioSugerido: string;
  fimSugerido: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [clienteId, setClienteId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [inicio, setInicio] = useState(inicioSugerido);
  const [fim, setFim] = useState(fimSugerido);

  const criar = () =>
    iniciar(async () => {
      const r = await chamarEMostrar(() =>
        criarRelatorio({
          clienteId,
          titulo,
          periodoInicio: inicio,
          periodoFim: fim,
        }),
      );
      if (r.ok && r.dados) router.push(`/painel/relatorios/${r.dados.id}`);
    });

  return (
    <div
      className="bg-card grid items-end gap-4 rounded-xl border p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_160px_auto]"
      data-tour="relatorios-novo"
    >
      <div className="space-y-1.5">
        <Label>Conta</Label>
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Escolha a conta" />
          </SelectTrigger>
          <SelectContent>
            {contas.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Título</Label>
        <Input
          placeholder="Relatório de outubro"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Início</Label>
        <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Fim</Label>
        <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
      </div>
      <Button type="button" disabled={pendente} onClick={criar}>
        <Plus className="size-4" /> Criar relatório
      </Button>
    </div>
  );
}
