"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

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

/**
 * Confirmação antes de uma ação.
 *
 * Em dois modos:
 *   - simples: título, texto e os dois botões;
 *   - digitação: passe `confirmationText` e a pessoa precisa digitar aquele
 *     nome para o botão liberar.
 *
 * O segundo modo é para o que não tem volta — apagar um cliente, remover
 * alguém da equipe. Um clique distraído não deve conseguir destruir dados.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  confirmationText,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Quando informado, exige digitar exatamente este texto. */
  confirmationText?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [executando, setExecutando] = useState(false);

  const precisaDigitar = Boolean(confirmationText);
  const liberado = !precisaDigitar || digitado.trim() === confirmationText;

  async function confirmar() {
    if (!liberado || executando) return;
    setExecutando(true);
    try {
      await onConfirm();
      setAberto(false);
      setDigitado("");
    } finally {
      setExecutando(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        setAberto(proximo);
        if (!proximo) setDigitado("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {precisaDigitar ? (
          <div className="space-y-2">
            <Label htmlFor="confirmacao-por-digitacao">
              Digite <span className="font-mono font-semibold">{confirmationText}</span> para
              confirmar
            </Label>
            <Input
              id="confirmacao-por-digitacao"
              value={digitado}
              onChange={(evento) => setDigitado(evento.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={executando}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirmar}
            disabled={!liberado || executando}
          >
            {executando ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
