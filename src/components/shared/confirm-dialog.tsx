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

/**
 * Confirmação antes de uma ação: título, texto e os dois botões.
 *
 * ---------------------------------------------------------------------------
 * **O MODO "DIGITE O NOME PARA CONFIRMAR" SAIU DO PRODUTO**, por decisão do
 * usuário: *"tire a função de pedir para digitar uma frase quando vou excluir
 * algo"*.
 *
 * Ele existia desde o Sprint 1, com o argumento de que um clique distraído
 * não deve conseguir destruir dados — e o argumento é bom para um diálogo que
 * só pergunta "tem certeza?". O produto deixou de ter desses: **a decisão de
 * apagar campanha já tinha trocado a pergunta pela CONTAGEM** — *"'Apagar
 * esta campanha?' não informa nada; a contagem é a única coisa que faz alguém
 * parar"* —, e o diálogo do mês de social nasceu lendo
 * `o_que_vai_com_o_mes()` na abertura pela mesma razão.
 *
 * Com o número na tela, a digitação deixou de ser a coisa que faz parar e
 * passou a ser a coisa que atrasa quem já leu: ela cobra do caminho inteiro a
 * cerimônia, e quem apaga três campanhas numa tarde aprende a copiar e colar
 * o nome sem olhar para a frase acima dele. **Uma cerimônia que vira hábito
 * protege menos que o número que ela esconde.**
 *
 * A prop foi **apagada e não deixada opcional**, que é a decisão da 0023: um
 * parâmetro que nenhuma tela passa é o que alguém reaproveita três sprints
 * depois achando que o produto ainda pede isso em algum lugar.
 *
 * *O que fica em aberto, e é dito em vez de escondido:* o `desligamento.tsx`
 * da ficha da pessoa continua pedindo o nome completo na segunda etapa. Ele
 * não é um apagamento — ninguém com histórico é apagado neste produto —, é o
 * fluxo que transfere o trabalho em aberto antes de desativar o acesso, e a
 * digitação lá divide a tela com uma lista de vínculos que a pessoa precisa
 * ler. Tirá-la é uma linha, e é decisão de quem usa.
 * ---------------------------------------------------------------------------
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [executando, setExecutando] = useState(false);

  async function confirmar() {
    if (executando) return;
    setExecutando(true);
    try {
      await onConfirm();
      setAberto(false);
    } finally {
      setExecutando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={executando}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirmar}
            disabled={executando}
          >
            {executando ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
