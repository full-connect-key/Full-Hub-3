"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, Users } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import { diaEMes, mesPorExtenso, mesesParaEmitir } from "@/lib/dominio/notas-fiscais";

import {
  contarQuemDeveNota,
  solicitarNotasDoMes,
} from "../notas-fiscais/acoes";

/**
 * "Pedir as notas do mês" — o botão do Financeiro (0066).
 *
 * Decisão do usuário: um clique que manda o pedido para toda a equipe interna
 * de uma vez, em vez de o sócio escrever a mesma mensagem para oito pessoas em
 * oito conversas.
 *
 * ---------------------------------------------------------------------------
 * **O DIÁLOGO DIZ QUEM VAI RECEBER, PELO NOME, ANTES DO CLIQUE.**
 *
 * Um botão que dispara oito avisos e só depois conta quantos foram é um botão
 * que se aperta com medo — e o medo aqui tem razão: o aviso não se desfaz. A
 * lista de nomes é a única coisa que faz a pessoa reconhecer, antes de mandar,
 * que a Marina está ali porque a nota dela foi recusada e a Carla porque nunca
 * mandou.
 *
 * É a mesma decisão do diálogo de apagar campanha, que **conta** o que vai
 * junto em vez de perguntar "tem certeza?".
 * ---------------------------------------------------------------------------
 *
 * **E a contagem vem da MESMA função que o envio usa.** `quem_deve_nota()`
 * responde aos dois lados, pela razão de `podeEnviarAoCliente()` no Social: a
 * tela existe para escrever a frase que o banco vai confirmar. Duas contas
 * daria um diálogo prometendo cinco e um envio alcançando quatro.
 */
export function PedirNotas({
  competencia,
  hojeISO,
  pedidoAnterior,
}: {
  /** A competência da tela — `2026-09-01`. O mês do diálogo começa nela. */
  competencia: string;
  hojeISO: string;
  /** O último pedido já feito deste mês, se houver. */
  pedidoAnterior: { quantasPessoas: number; criadoEm: string } | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(competencia.slice(0, 7));
  const [nomes, setNomes] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [contando, setContando] = useState(false);
  const [mandando, mandar] = useTransition();

  const meses = mesesParaEmitir(hojeISO);

  /**
   * A conta acompanha o mês escolhido — uma ida ao servidor por troca de mês,
   * não por tecla. Trocar de mês num seletor é a interação que a pessoa faz
   * duas ou três vezes; recalcular ali é latência que ninguém percebe, e um
   * número parado seria o diálogo falando de outro mês.
   *
   * **E ela é chamada DOS EVENTOS, nunca de um `useEffect`.** Contar quem deve
   * é a resposta a abrir o diálogo e a trocar o mês — os dois são eventos, e o
   * `lint` do projeto reprova `setState` no corpo de um efeito justamente
   * porque o efeito dispara renderização em cascata. É a mesma armadilha que
   * virou `key` no editor de post e inicializador de `useState` no aviso de
   * atualização ao vivo.
   */
  async function recontar(qualMes: string) {
    setContando(true);
    setErro(null);
    try {
      const r = await contarQuemDeveNota(qualMes);
      if (r.ok) setNomes(r.nomes);
      else {
        setNomes(null);
        setErro(r.error);
      }
    } finally {
      setContando(false);
    }
  }

  function abrirOuFechar(proximo: boolean) {
    setAberto(proximo);
    // A CONTA É REFEITA A CADA ABERTURA, e não guardada da anterior: entre uma
    // e outra alguém pode ter mandado a nota, e um número velho aqui faz o
    // diálogo prometer um aviso que não vai sair.
    if (proximo) void recontar(mes);
  }

  function trocarMes(proximo: string) {
    setMes(proximo);
    void recontar(proximo);
  }

  function enviar() {
    mandar(async () => {
      const r = await chamarEMostrar(() => solicitarNotasDoMes(mes));
      if (r.ok) {
        abrirOuFechar(false);
        router.refresh();
      }
    });
  }

  const quantas = nomes?.length ?? 0;

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BellRing aria-hidden className="size-3.5" />
          Pedir as notas do mês
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedir as notas fiscais do mês</DialogTitle>
          <DialogDescription>
            Cai no sino de quem ainda não mandou. Quem já enviou não é cobrado
            de novo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mes-do-pedido">Mês de serviço</Label>
            <Select value={mes} onValueChange={trocarMes}>
              <SelectTrigger
                id="mes-do-pedido"
                className="w-full"
                aria-label="Mês de serviço da nota"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* O PRAZO É O MESMO DIA, E A FRASE VEM ANTES DO BOTÃO.
              
              Decisão do usuário: a nota precisa ser enviada no mesmo dia do
              pedido. Quem aperta precisa saber que está marcando o prazo para
              hoje — e quem recebe o aviso lê a data escrita nele, nunca a
              palavra "hoje", que passa a mentir amanhã. */}
          <p className="bg-blue-soft text-text-primary rounded-lg px-3 py-2 text-sm">
            O prazo é o <strong>mesmo dia do pedido</strong> — hoje,{" "}
            {diaEMes(hojeISO)}. Quem perder o dia continua podendo enviar: o
            atraso aparece na fila, não trava a nota.
          </p>

          {/* QUEM VAI RECEBER, PELO NOME. */}
          <div className="rounded-lg border p-3">
            {contando ? (
              <p className="text-text-muted flex items-center gap-2 text-sm">
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
                Vendo quem está devendo…
              </p>
            ) : erro ? (
              <p className="text-danger text-sm">{erro}</p>
            ) : quantas === 0 ? (
              <p className="text-text-secondary text-sm">
                Ninguém está devendo a nota de {mesPorExtenso(`${mes}-01`)}.
                Nenhum aviso será enviado.
              </p>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Users aria-hidden className="text-text-muted size-3.5" />
                  {quantas === 1
                    ? "1 pessoa vai ser avisada"
                    : `${quantas} pessoas vão ser avisadas`}
                </p>
                <p className="text-text-secondary mt-1 text-sm">
                  {nomes?.join(", ")}
                </p>
              </>
            )}
          </div>

          {/* O PEDIDO ANTERIOR APARECE, e é o que impede o clique por dúvida:
              um botão sem memória se aperta duas vezes para conferir se a
              primeira funcionou. */}
          {pedidoAnterior ? (
            <p className="text-text-muted text-sm">
              Você já pediu as notas deste mês em{" "}
              {diaEMes(pedidoAnterior.criadoEm.slice(0, 10))}, para{" "}
              {pedidoAnterior.quantasPessoas === 1
                ? "1 pessoa"
                : `${pedidoAnterior.quantasPessoas} pessoas`}
              .
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => abrirOuFechar(false)} disabled={mandando}>
            Fechar
          </Button>
          {/* DESLIGADO QUANDO NÃO HÁ NINGUÉM, com a razão escrita acima — em
              vez de sumir. Um botão que some ensina que não existe; um
              desligado ao lado de "ninguém está devendo" ensina a regra. É a
              decisão do "Enviar ao cliente" no Social. */}
          <Button onClick={enviar} disabled={mandando || contando || quantas === 0}>
            {mandando ? (
              <Loader2 aria-hidden className="size-3.5 animate-spin" />
            ) : (
              <BellRing aria-hidden className="size-3.5" />
            )}
            {quantas === 1 ? "Pedir para 1 pessoa" : `Pedir para ${quantas} pessoas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
