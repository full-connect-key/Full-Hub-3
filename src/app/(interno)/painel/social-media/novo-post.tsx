"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  EXPLICACAO_DA_MIDIA,
  FORMATOS_SUGERIDOS,
  MIDIAS,
  PLATAFORMAS,
  ROTULO_DA_MIDIA,
  ROTULO_DA_PLATAFORMA,
} from "@/lib/dominio/posts";
import type { PlataformaSocial, PostMidia } from "@/lib/supabase/database.types";

import { abrirPost } from "./acoes";

const SEM_VALOR = "__sem__";

/**
 * Abrir o post — o primeiro elo da corrente, e é da gestão.
 *
 * **A MÍDIA SE ESCOLHE AQUI, antes de tudo**, e não no editor: ela decide qual
 * editor aparece. Escolher no meio do caminho significa trocar a tela debaixo
 * de quem está trabalhando — e quem já subiu cinco slides e muda para "imagem"
 * deixaria quatro arquivos no bucket sem tela que os mostre.
 *
 * **É diálogo e não tela**, ao contrário do "+ Nova task": a task nasce como
 * rascunho porque subtarefa, referência e comentário precisam de um `task_id`
 * para existirem. O post não tem nada disso — arte e legenda são colunas dele
 * mesmo —, então não há o que guardar em memória e nada a reimplementar.
 */
export function NovoPost({
  clientes,
  equipe,
}: {
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, iniciar] = useTransition();

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [tema, setTema] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [plataforma, setPlataforma] = useState<PlataformaSocial>("instagram");
  const [formato, setFormato] = useState("Feed");
  const [midia, setMidia] = useState<PostMidia>("imagem");
  const [responsavel, setResponsavel] = useState<string | null>(null);

  const faltam = [
    clienteId ? null : "o cliente",
    tema.trim().length >= 2 ? null : "o tema",
    data ? null : "a data",
  ].filter((f): f is string => f !== null);

  function criar() {
    iniciar(async () => {
      const r = await chamarAcao(() =>
        abrirPost({
          client_id: clienteId,
          tema: tema.trim(),
          data_publicacao: data,
          horario: horario || null,
          plataforma,
          formato: formato || null,
          midia,
          responsavel_id: responsavel,
        }),
      );
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.mensagem);
      setAberto(false);
      setTema("");
      setData("");
      router.push(`/painel/social-media?post=${r.dados}`);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden className="size-4" />
          Novo post
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir um post</DialogTitle>
          <DialogDescription>
            O briefing é seu; a arte e a legenda são de quem você liberar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-cliente">Cliente</Label>
              <Select value={clienteId ?? SEM_VALOR} onValueChange={(v) => setClienteId(v)}>
                <SelectTrigger id="np-cliente" className="w-full">
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
            <div className="space-y-1.5">
              <Label htmlFor="np-tema">Tema</Label>
              <Input
                id="np-tema"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Promoção de outubro"
              />
            </div>
          </div>

          {/* RADIOGROUP DE CARTÕES e não `<select>`: a diferença entre as três
              é o que faz a pessoa escolher, e um select a esconde atrás do
              clique. É a mesma decisão do tipo de pedido no Full Days. */}
          <div className="space-y-1.5">
            <Label>Mídia</Label>
            <div role="radiogroup" aria-label="Mídia" className="grid gap-2 sm:grid-cols-3">
              {MIDIAS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={m === midia}
                  onClick={() => setMidia(m)}
                  className={
                    m === midia
                      ? "border-primary bg-blue-soft rounded-xl border-2 p-2.5 text-left"
                      : "border-border hover:border-primary/40 rounded-xl border-2 p-2.5 text-left"
                  }
                >
                  <span className="text-text-primary block text-sm font-medium">
                    {ROTULO_DA_MIDIA[m]}
                  </span>
                  <span className="text-text-secondary mt-0.5 block text-xs">
                    {EXPLICACAO_DA_MIDIA[m]}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-text-muted text-xs">
              Ela decide o editor. Dá para trocar depois, mas não com slides já
              subidos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-rede">Rede</Label>
              <Select
                value={plataforma}
                onValueChange={(v) => setPlataforma(v as PlataformaSocial)}
              >
                <SelectTrigger id="np-rede" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATAFORMAS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {ROTULO_DA_PLATAFORMA[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-formato">Formato</Label>
              <Input
                id="np-formato"
                list="np-formatos"
                value={formato}
                onChange={(e) => setFormato(e.target.value)}
                placeholder="Feed, Stories, Reels…"
              />
              <datalist id="np-formatos">
                {(FORMATOS_SUGERIDOS[plataforma] ?? []).map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-data">Publica em</Label>
              <Input
                id="np-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-hora">Horário</Label>
              <Input
                id="np-hora"
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-resp">Liberar para</Label>
              <Select
                value={responsavel ?? SEM_VALOR}
                onValueChange={(v) => setResponsavel(v === SEM_VALOR ? null : v)}
              >
                <SelectTrigger id="np-resp" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_VALOR}>Decidir depois</SelectItem>
                  {equipe.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {faltam.length > 0 ? (
            <p className="text-text-secondary self-center text-sm">
              Falta {faltam.join(", ")}.
            </p>
          ) : (
            <span />
          )}
          <Button onClick={criar} disabled={salvando || faltam.length > 0}>
            {salvando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Abrir post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
