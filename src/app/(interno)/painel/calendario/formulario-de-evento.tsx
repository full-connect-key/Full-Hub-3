"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  ROTULOS_DE_TIPO_DE_EVENTO,
  TIPOS_DE_EVENTO,
  type EventoDetalhado,
} from "@/lib/dominio/calendario";

import type { EventoTipo } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { salvarEvento } from "./acoes";

/**
 * Abrir e editar um evento.
 *
 * **É um formulário curto, e é de propósito.** Um evento é a coisa mais leve
 * que se cria no produto — alguém lembra da feira e anota em dez segundos.
 * Pedir briefing, responsável e pasta de entrega transformaria isso numa
 * demanda, e o resultado seria a feira continuar no WhatsApp.
 */
export function FormularioDeEvento({
  inicial,
  periodo,
  clientes,
  pessoas,
  usuarioId,
  aoFechar,
}: {
  inicial: EventoDetalhado | null;
  periodo: { de: string; ate: string };
  clientes: { id: string; nome: string }[];
  pessoas: { id: string; nome: string; avatar_url: string | null }[];
  usuarioId: string;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [tipo, setTipo] = useState<EventoTipo>(inicial?.tipo ?? "outro");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [clienteId, setClienteId] = useState(inicial?.clientId ?? "");
  const [de, setDe] = useState(inicial?.dataInicio ?? periodo.de);
  const [ate, setAte] = useState(inicial?.dataFim ?? periodo.ate);
  const [diaInteiro, setDiaInteiro] = useState(inicial?.diaInteiro ?? true);
  const [horaInicio, setHoraInicio] = useState(inicial?.horaInicio?.slice(0, 5) ?? "");
  const [horaFim, setHoraFim] = useState(inicial?.horaFim?.slice(0, 5) ?? "");
  const [local, setLocal] = useState(inicial?.local ?? "");
  const [link, setLink] = useState(inicial?.link ?? "");
  const [bloqueia, setBloqueia] = useState(inicial?.bloqueiaFerias ?? false);
  const [participantes, setParticipantes] = useState<string[]>(
    inicial?.participantes.map((p) => p.id) ?? [],
  );

  function alternarPessoa(id: string) {
    setParticipantes((atual) =>
      atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id],
    );
  }

  function salvar() {
    iniciar(async () => {
      const r = await chamarAcao(() =>
        salvarEvento(inicial?.id ?? null, {
          nome,
          tipo,
          descricao,
          client_id: clienteId || null,
          data_inicio: de,
          data_fim: ate,
          dia_inteiro: diaInteiro,
          hora_inicio: horaInicio || null,
          hora_fim: horaFim || null,
          local,
          link,
          bloqueia_ferias: bloqueia,
          participantes,
        }),
      );

      if (r.ok) {
        toast.success(r.mensagem);
        aoFechar();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{inicial ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>
            O que acontece e muda o que dá para prometer: convenção, feira, lançamento, reunião.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ev-nome">Nome *</Label>
            <Input
              id="ev-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Convenção Mundo Verde"
              autoFocus
            />
          </div>

          {/* O TIPO É UM GRUPO DE BOTÕES, e não um `<select>`: são sete, eles
              cabem, e a cor de cada um é justamente o que a pessoa vai
              reconhecer na grade depois. Fechado numa lista, ela escolheria
              sem ver o que está escolhendo. */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_DE_EVENTO.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  aria-pressed={tipo === t}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    tipo === t
                      ? "border-accent-strong bg-blue-soft text-accent-strong font-medium"
                      : "text-text-secondary hover:bg-muted",
                  )}
                >
                  {ROTULOS_DE_TIPO_DE_EVENTO[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-de">Começa em *</Label>
              <Input id="ev-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-ate">Termina em *</Label>
              <Input
                id="ev-ate"
                type="date"
                value={ate}
                min={de}
                onChange={(e) => setAte(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="ev-dia" checked={diaInteiro} onCheckedChange={setDiaInteiro} />
            <Label htmlFor="ev-dia">Dia inteiro</Label>
          </div>

          {diaInteiro ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ev-hi">Das</Label>
                <Input
                  id="ev-hi"
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-hf">Às</Label>
                <Input
                  id="ev-hf"
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ev-cliente">Cliente</Label>
            <select
              id="ev-cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="border-border bg-surface-card text-text-primary w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Da agência — não é de cliente nenhum</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-local">Local</Label>
              <Input
                id="ev-local"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Expo Center Norte"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-link">Link</Label>
              <Input
                id="ev-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Descrição</Label>
            <Textarea
              id="ev-desc"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          {/* OS PARTICIPANTES, e a frase que evita o erro mais caro aqui. */}
          <div className="space-y-1.5">
            <Label>Quem vai</Label>
            <div className="flex flex-wrap gap-1.5">
              {pessoas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => alternarPessoa(p.id)}
                  aria-pressed={participantes.includes(p.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors",
                    participantes.includes(p.id)
                      ? "border-accent-strong bg-blue-soft text-accent-strong font-medium"
                      : "text-text-secondary hover:bg-muted",
                  )}
                >
                  <UserAvatar name={p.nome} src={p.avatar_url} size="sm" />
                  {p.nome.split(" ")[0]}
                  {p.id === usuarioId ? " (você)" : ""}
                </button>
              ))}
            </div>
            <p className="text-text-muted text-xs">
              Sem ninguém marcado, o evento é <strong>da agência inteira</strong> — e não de
              ninguém.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Switch id="ev-bloq" checked={bloqueia} onCheckedChange={setBloqueia} />
              <Label htmlFor="ev-bloq">Bloquear estes dias no Full Days</Label>
            </div>
            <p className="text-text-muted text-xs">
              Quem tentar propor um período nestes dias vê o nome do evento e não consegue
              seguir. Vale para os participantes — ou para todo mundo, se não houver nenhum.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={executando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={executando || nome.trim().length < 2}>
            {executando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {inicial ? "Salvar" : "Criar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
