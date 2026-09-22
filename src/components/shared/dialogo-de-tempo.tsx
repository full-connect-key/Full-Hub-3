"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

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

/**
 * Registro do tempo real, na hora de concluir.
 *
 * É o único momento em que a agência consegue capturar quanto uma entrega
 * custou de verdade — depois ninguém lembra. Por isso a pergunta aparece
 * sozinha ao concluir, em vez de esperar alguém preencher um campo.
 *
 * Duas decisões que fazem a diferença na adoção:
 *
 *   - **Dá para pular.** Uma pergunta obrigatória vira número inventado, e
 *     número inventado é pior do que campo vazio: ele entra nos relatórios
 *     como se fosse medição.
 *   - **Vem sugerido.** A estimativa (ou a soma do que já foi registrado nas
 *     subtarefas) já chega preenchida, então o caminho comum é conferir e
 *     apertar Enter.
 */
export function DialogoDeTempo({
  aberto,
  aoFechar,
  titulo,
  descricao,
  sugestao,
  origemDaSugestao,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  /** Pré-preenchido no campo. Null deixa vazio. */
  sugestao: number | null;
  /** De onde veio o número, dito em uma linha para a pessoa confiar nele. */
  origemDaSugestao?: string;
  /** Recebe null quando a pessoa pula. Deve devolver true se deu certo. */
  aoConcluir: (horas: number | null) => Promise<boolean>;
}) {
  const [horas, setHoras] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Repõe o valor sugerido no instante em que o diálogo abre, ajustando o
  // estado durante o render em vez de dentro de um efeito: com efeito, o
  // React renderizaria uma vez com o campo velho antes de corrigir, e o
  // compilador reclama do encadeamento. Reescrever a cada render apagaria o
  // que a pessoa está digitando, por isso a comparação com o valor anterior.
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) setHoras(sugestao !== null ? String(sugestao) : "");
  }

  async function concluir(comTempo: boolean) {
    setSalvando(true);
    try {
      const valor = comTempo && horas.trim() !== "" ? Number(horas) : null;
      if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
        setSalvando(false);
        return;
      }
      const deuCerto = await aoConcluir(valor);
      if (deuCerto) aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(estaAberto) => !estaAberto && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {descricao ?? "Quanto tempo isso levou de verdade? Dá para pular."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            void concluir(true);
          }}
        >
          <Label htmlFor="tempo-real">Tempo real (horas)</Label>
          <Input
            id="tempo-real"
            type="number"
            min={0}
            step="0.5"
            autoFocus
            value={horas}
            onChange={(evento) => setHoras(evento.target.value)}
            placeholder="—"
          />
          {origemDaSugestao ? (
            <p className="text-muted-foreground text-xs">{origemDaSugestao}</p>
          ) : null}
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => void concluir(false)} disabled={salvando}>
            Pular
          </Button>
          <Button onClick={() => void concluir(true)} disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" /> : null}
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
