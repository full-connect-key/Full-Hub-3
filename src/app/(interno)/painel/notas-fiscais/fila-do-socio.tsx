"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Inbox, Loader2, Paperclip, Wallet, X } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
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
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { FilaDeNotas, NotaDaEquipe } from "@/lib/dados/notas-fiscais";
import { CORES_DE_NF, ROTULOS_DE_NF, emReais, mesPorExtenso } from "@/lib/dominio/notas-fiscais";
import { cn } from "@/lib/utils";

import { decidirNota } from "./acoes";

/**
 * A fila do sócio: conferir, recusar e pagar.
 *
 * ---------------------------------------------------------------------------
 * **TRÊS LISTAS, e a divisão é por QUEM ESTÁ ESPERANDO O QUÊ** — não por
 * status. "A conferir" espera uma leitura; "A pagar" espera uma
 * transferência; "Encerradas" não espera nada. São três trabalhos diferentes,
 * e num dia 5 o sócio abre a tela para fazer o segundo.
 *
 * É a mesma decisão da lista do Social Media, que agrupa por quem está
 * segurando em vez de pelos cinco status.
 * ---------------------------------------------------------------------------
 *
 * **O TOTAL A PAGAR FICA NO CABEÇALHO da segunda lista**, porque é a pergunta
 * que se faz antes de abrir o banco: quanto sai hoje. Somar de cabeça oito
 * linhas é o tipo de conta que a tela existe para não pedir.
 */
export function FilaDoSocio({ fila }: { fila: FilaDeNotas }) {
  const router = useRouter();
  const [decidindo, decidir] = useTransition();
  const [recusando, setRecusando] = useState<NotaDaEquipe | null>(null);
  const [pagando, setPagando] = useState<NotaDaEquipe | null>(null);
  const [motivo, setMotivo] = useState("");
  const [dataDoPagamento, setDataDoPagamento] = useState("");

  const totalAPagar = fila.aPagar.reduce((soma, n) => soma + n.valor, 0);

  function aprovar(nota: NotaDaEquipe) {
    decidir(async () => {
      const r = await chamarEMostrar(() => decidirNota({ id: nota.id, decisao: "aprovada" }));
      if (r?.ok) router.refresh();
    });
  }

  function confirmarRecusa() {
    if (!recusando) return;
    decidir(async () => {
      const r = await chamarEMostrar(() =>
        decidirNota({ id: recusando.id, decisao: "recusada", motivo }),
      );
      if (r?.ok) {
        setRecusando(null);
        setMotivo("");
        router.refresh();
      }
    });
  }

  function confirmarPagamento() {
    if (!pagando) return;
    decidir(async () => {
      const r = await chamarEMostrar(() =>
        decidirNota({ id: pagando.id, decisao: "paga", pagamento: dataDoPagamento }),
      );
      if (r?.ok) {
        setPagando(null);
        router.refresh();
      }
    });
  }

  function Linha({ nota, acoes }: { nota: NotaDaEquipe; acoes?: React.ReactNode }) {
    return (
      <li className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {nota.pessoa ? (
              <span className="inline-flex items-center gap-1.5">
                <UserAvatar name={nota.pessoa.nome} src={nota.pessoa.avatar_url} size="sm" />
                <span className="text-sm font-medium">{nota.pessoa.nome}</span>
              </span>
            ) : (
              <span className="text-text-muted text-sm">sem nome</span>
            )}
            <span className="text-text-muted text-sm">·</span>
            <span className="text-sm">{mesPorExtenso(nota.competencia)}</span>
            <span
              className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", CORES_DE_NF[nota.status])}
            >
              {ROTULOS_DE_NF[nota.status]}
            </span>
          </div>

          <p className="mt-1 text-sm font-semibold tabular-nums">{emReais(nota.valor)}</p>

          {nota.numero ? (
            <p className="text-text-muted text-xs">NF {nota.numero}</p>
          ) : null}
          {nota.observacoes ? (
            <p className="text-text-secondary mt-1 text-xs">{nota.observacoes}</p>
          ) : null}
          {nota.motivo_recusa ? (
            <p className="text-danger mt-1 text-xs">Recusada: {nota.motivo_recusa}</p>
          ) : null}
          {nota.pagamento ? (
            <p className="text-text-muted mt-1 text-xs">
              Pago em {nota.pagamento.split("-").reverse().join("/")}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* O PDF ANTES DOS BOTÕES, e é a mesma razão pela qual o portal põe a
              arte antes do "Aprovar": um botão numa linha sem nada para abrir
              convida a decidir sem olhar. */}
          {nota.arquivoAssinado ? (
            <Button asChild variant="outline" size="sm">
              <a href={nota.arquivoAssinado} target="_blank" rel="noreferrer">
                <Paperclip aria-hidden />
                Ver PDF
              </a>
            </Button>
          ) : null}
          {acoes}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="a-conferir">
        <h2 id="a-conferir" className="mb-2 text-sm font-semibold">
          A conferir
        </h2>
        {fila.aConferir.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhuma nota esperando"
            description="Quando alguém enviar a nota do mês, ela aparece aqui e você recebe um aviso."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {fila.aConferir.map((nota) => (
              <Linha
                key={nota.id}
                nota={nota}
                acoes={
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={decidindo}
                      onClick={() => {
                        setRecusando(nota);
                        setMotivo("");
                      }}
                    >
                      <X aria-hidden />
                      Recusar
                    </Button>
                    <Button size="sm" disabled={decidindo} onClick={() => aprovar(nota)}>
                      {decidindo ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
                      Aprovar
                    </Button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </section>

      {fila.aPagar.length > 0 ? (
        <section aria-labelledby="a-pagar">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="a-pagar" className="text-sm font-semibold">
              Aprovadas, esperando o pagamento
            </h2>
            <p className="text-text-secondary text-sm tabular-nums">
              {emReais(totalAPagar)} no total
            </p>
          </div>
          <ul className="divide-y rounded-xl border">
            {fila.aPagar.map((nota) => (
              <Linha
                key={nota.id}
                nota={nota}
                acoes={
                  <Button
                    size="sm"
                    disabled={decidindo}
                    onClick={() => {
                      setPagando(nota);
                      setDataDoPagamento("");
                    }}
                  >
                    <Wallet aria-hidden />
                    Marcar paga
                  </Button>
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      {fila.encerradas.length > 0 ? (
        <section aria-labelledby="encerradas">
          <h2 id="encerradas" className="mb-2 text-sm font-semibold">
            Encerradas
          </h2>
          <ul className="divide-y rounded-xl border">
            {fila.encerradas.map((nota) => (
              <Linha key={nota.id} nota={nota} />
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={recusando !== null} onOpenChange={(a) => !a && setRecusando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar a nota</DialogTitle>
            <DialogDescription>
              {recusando?.pessoa?.nome} recebe o motivo e envia outra para o mesmo mês.
              Esta nota fica no histórico com o que você escrever.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="nf-motivo">O que está errado</Label>
            <Textarea
              id="nf-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="O CNPJ está o da empresa antiga."
              className="mt-1.5"
              rows={3}
            />
            {/* A EXIGÊNCIA É DO BANCO — o check `team_invoices_recusa_com_motivo`
                recusa a recusa sem motivo. Esta frase só chega antes. */}
            <p className="text-muted-foreground mt-1 text-xs">
              Sem isto a pessoa manda a mesma nota de novo.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarRecusa} disabled={decidindo}>
              {decidindo ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pagando !== null} onOpenChange={(a) => !a && setPagando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como paga</DialogTitle>
            <DialogDescription>
              {pagando ? `${emReais(pagando.valor)} para ${pagando.pessoa?.nome ?? "a pessoa"}.` : null}{" "}
              Isto lança a despesa no Financeiro da agência, na competência da nota.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="nf-pagamento">Dia em que o pagamento saiu</Label>
            <Input
              id="nf-pagamento"
              type="date"
              value={dataDoPagamento}
              onChange={(e) => setDataDoPagamento(e.target.value)}
              className="mt-1.5"
            />
            {/* A DATA É DIGITADA E NÃO A DE HOJE: o sócio marca no dia em que
                lembra, e a transferência saiu no dia em que saiu. Gravar o dia
                do clique poria no relatório de caixa um dia que não aconteceu
                — é a mesma razão de o Financeiro ter três datas. */}
            <p className="text-muted-foreground mt-1 text-xs">
              É esta data que vai para o caixa, não a de hoje.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPagando(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarPagamento} disabled={decidindo || !dataDoPagamento}>
              {decidindo ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
