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
import { AJUDA_DE_TEMPO, interpretarTempo, tempoParaCampo } from "@/lib/dominio/tempo";

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
 *   - **Vem sugerido.** A estimativa já chega preenchida, então o caminho
 *     comum é conferir e apertar Enter.
 *   - **Entrada livre.** `2h30`, `2,5h`, `150` e `90min` são a mesma coisa.
 *     Obrigar a pessoa a converter para decimal é pedir erro de digitação em
 *     troca de nada.
 *
 * O valor sai daqui em MINUTOS, que é como o banco guarda.
 */
export function DialogoDeTempo({
  aberto,
  aoFechar,
  titulo,
  descricao,
  sugestao,
  origemDaSugestao,
  aoConcluir,
  rotuloDeConfirmar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  /** Pré-preenchido no campo, em minutos. Null deixa vazio. */
  sugestao: number | null;
  /** De onde veio o número, dito em uma linha para a pessoa confiar nele. */
  origemDaSugestao?: string;
  /** Recebe os minutos, ou null quando a pessoa pula. True se deu certo. */
  aoConcluir: (minutos: number | null) => Promise<boolean>;
  /** O rótulo do botão que confirma. "Concluir" na maioria dos casos. */
  rotuloDeConfirmar?: string;
}) {
  const [tempo, setTempo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Repõe o valor sugerido no instante em que o diálogo abre, ajustando o
  // estado durante o render em vez de dentro de um efeito: com efeito, o
  // React renderizaria uma vez com o campo velho antes de corrigir, e o
  // compilador reclama do encadeamento. Reescrever a cada render apagaria o
  // que a pessoa está digitando, por isso a comparação com o valor anterior.
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setTempo(tempoParaCampo(sugestao));
      setErro(null);
    }
  }

  async function concluir(comTempo: boolean) {
    let minutos: number | null = null;

    if (comTempo) {
      const lido = interpretarTempo(tempo);
      if (lido === undefined) {
        setErro(`Não entendi "${tempo.trim()}". ${AJUDA_DE_TEMPO}`);
        return;
      }
      minutos = lido;
    }

    setErro(null);
    setSalvando(true);
    try {
      const deuCerto = await aoConcluir(minutos);
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
          <Label htmlFor="tempo-real">Tempo real</Label>
          <Input
            id="tempo-real"
            autoFocus
            inputMode="text"
            value={tempo}
            onChange={(evento) => setTempo(evento.target.value)}
            placeholder="2h30"
            aria-invalid={erro ? true : undefined}
            aria-describedby="ajuda-de-tempo"
          />
          <p id="ajuda-de-tempo" className="text-muted-foreground text-xs">
            {erro ?? origemDaSugestao ?? AJUDA_DE_TEMPO}
          </p>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => void concluir(false)} disabled={salvando}>
            Pular
          </Button>
          <Button onClick={() => void concluir(true)} disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" /> : null}
            {rotuloDeConfirmar ?? "Concluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
