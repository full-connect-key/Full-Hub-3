"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Vinculos = {
  tasksAbertas: number;
  solicitacoesPendentes: number;
  clientesSobResponsabilidade: number;
  exigeTransferencia: boolean;
  total: number;
};

/**
 * Desligamento de alguém da equipe, em duas etapas.
 *
 * Primeira: explica o que acontece e lista o que está preso ao nome da pessoa.
 * Segunda: exige digitar o nome completo.
 *
 * Quando há tasks em aberto, a transferência é obrigatória — senão o trabalho
 * fica sem dono no dia seguinte.
 *
 * O que acontece NÃO é exclusão: a pessoa é desativada, o acesso é revogado e
 * o histórico continua com o nome dela. É o que preserva a autoria do que ela
 * fez enquanto esteve na agência.
 */
export function Desligamento({
  userId,
  nome,
  vinculos,
  equipeDisponivel,
}: {
  userId: string;
  nome: string;
  vinculos: Vinculos;
  equipeDisponivel: { id: string; nome: string }[];
}) {
  const [etapa, setEtapa] = useState<0 | 1 | 2>(0);
  const [destino, setDestino] = useState<string>("");
  const [nomeDigitado, setNomeDigitado] = useState("");
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  const faltaEscolherDestino = vinculos.exigeTransferencia && !destino;
  const nomeConfere = nomeDigitado.trim() === nome;

  function fechar() {
    setEtapa(0);
    setDestino("");
    setNomeDigitado("");
  }

  async function desligar() {
    setEnviando(true);
    try {
      const resposta = await fetch("/api/usuarios/colaborador/desligar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, transferirPara: destino || null }),
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        toast.error(corpo.erro ?? "Não foi possível desligar.");
        return;
      }
      toast.success(corpo.mensagem ?? "Pessoa desligada.");
      fechar();
      router.push("/painel/equipe");
    } catch {
      toast.error("Não foi possível falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Dialog open={etapa === 1} onOpenChange={(aberto) => (aberto ? setEtapa(1) : fechar())}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" onClick={() => setEtapa(1)}>
            <UserMinus aria-hidden />
            Desligar da equipe
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desligar {nome}?</DialogTitle>
            <DialogDescription>
              Entenda o que acontece antes de continuar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ul className="text-muted-foreground space-y-1.5 text-sm">
              <li>• A pessoa some das listas e dos seletores.</li>
              <li>• O acesso à plataforma é revogado — ela não consegue mais entrar.</li>
              <li>• As tasks e os registros antigos continuam com o nome dela.</li>
              <li>• Nada é apagado. Isso é desligamento, não exclusão.</li>
            </ul>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">O que está no nome dela hoje:</p>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>{vinculos.tasksAbertas} task(s) em aberto</li>
                <li>{vinculos.solicitacoesPendentes} solicitação(ões) pendente(s)</li>
                <li>{vinculos.clientesSobResponsabilidade} cliente(s) sob responsabilidade</li>
              </ul>
            </div>

            {vinculos.exigeTransferencia ? (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertDescription>
                  Há trabalho em aberto. Escolha para quem transferir antes de continuar.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="destino-da-transferencia">
                Transferir para {vinculos.exigeTransferencia ? "*" : "(opcional)"}
              </Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger id="destino-da-transferencia" className="w-full">
                  <SelectValue placeholder="Escolha quem assume" />
                </SelectTrigger>
                <SelectContent>
                  {equipeDisponivel.map((pessoa) => (
                    <SelectItem key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Sem transferência, os clientes ficam sem responsável — aparecem na lista como
                &ldquo;Sem responsável&rdquo; em vez de sumirem.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fechar} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => setEtapa(2)}
              disabled={faltaEscolherDestino || enviando}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={etapa === 2} onOpenChange={(aberto) => (aberto ? setEtapa(2) : fechar())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirme o nome</DialogTitle>
            <DialogDescription>
              Esta é a última etapa. Digite o nome completo da pessoa para confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirmacao-do-nome">
              Digite <span className="font-mono font-semibold">{nome}</span>
            </Label>
            <Input
              id="confirmacao-do-nome"
              value={nomeDigitado}
              onChange={(evento) => setNomeDigitado(evento.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEtapa(1)} disabled={enviando}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={desligar} disabled={!nomeConfere || enviando}>
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Desligar {nome}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
