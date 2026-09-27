"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { NotaDaEquipe } from "@/lib/dados/notas-fiscais";
import {
  CORES_DE_NF,
  EXPLICACAO_DE_NF,
  ROTULOS_DE_NF,
  emReais,
  interpretarValor,
  mesPorExtenso,
} from "@/lib/dominio/notas-fiscais";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { apagarNota, enviarNota } from "./acoes";

const BUCKET = "notas-fiscais";

/**
 * As minhas notas, e o envio da do mês.
 *
 * ---------------------------------------------------------------------------
 * **A RECUSADA ABRE A LISTA, com o motivo por extenso.**
 *
 * Ela não é mais uma linha com um selo vermelho: é a única da tela que pede
 * uma ação da pessoa, e o motivo é a informação que decide o que ela faz em
 * seguida. Escondido atrás de um `title`, o motivo não existe para quem usa
 * toque nem para quem varre a tela com o olho — a mesma lição da célula do
 * calendário do Full Days.
 * ---------------------------------------------------------------------------
 *
 * **O arquivo sobe pela sessão de quem está clicando**, como a capa do cliente
 * e a arte do post: o binário não atravessa o servidor do Next, e a policy do
 * bucket continua valendo. Para a action vai só o caminho.
 *
 * **E o caminho começa pela pasta da PESSOA** — a policy compara
 * `(storage.foldername(name))[1]` com quem está pedindo. Um arquivo na raiz
 * não é lido por ninguém, nem por quem o subiu.
 */
export function MinhasNotas({
  notas,
  usuarioId,
  mesesDisponiveis,
}: {
  notas: NotaDaEquipe[];
  usuarioId: string;
  mesesDisponiveis: { valor: string; rotulo: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, salvar] = useTransition();
  const [subindo, setSubindo] = useState(false);

  const [mes, setMes] = useState(mesesDisponiveis[0]?.valor ?? "");
  const [valor, setValor] = useState("");
  const [numero, setNumero] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [arquivo, setArquivo] = useState<{ caminho: string; nome: string } | null>(null);

  const recusadas = notas.filter((n) => n.status === "recusada");
  const mesesVivos = new Set(
    notas.filter((n) => n.status !== "recusada").map((n) => n.competencia.slice(0, 7)),
  );
  const oferecidos = mesesDisponiveis.filter((m) => !mesesVivos.has(m.valor));

  async function subir(escolhido: File | undefined) {
    if (!escolhido) return;
    setSubindo(true);
    try {
      const supabase = criarClienteNavegador();
      const extensao = escolhido.name.split(".").pop() ?? "pdf";
      const caminho = `${usuarioId}/${mes || "sem-mes"}-${Date.now()}.${extensao}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, escolhido, { contentType: escolhido.type });

      if (error) {
        toast.error(`Não foi possível anexar: ${error.message}`);
        return;
      }
      setArquivo({ caminho, nome: escolhido.name });
    } finally {
      setSubindo(false);
    }
  }

  function enviar() {
    const centavos = interpretarValor(valor);
    if (centavos === null) {
      toast.error("Confira o valor: escreva algo como 4.250,00.");
      return;
    }
    if (!arquivo) {
      toast.error("Anexe o PDF da nota.");
      return;
    }

    salvar(async () => {
      const resultado = await chamarEMostrar(() =>
        enviarNota({
          mes,
          valor: centavos,
          numero: numero || null,
          arquivo_url: arquivo.caminho,
          observacoes: observacoes || null,
        }),
      );
      if (resultado?.ok) {
        setAberto(false);
        setValor("");
        setNumero("");
        setObservacoes("");
        setArquivo(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* O QUE PEDE AÇÃO VEM PRIMEIRO, e só quando existe. Um bloco fixo
          dizendo "nenhuma nota recusada" ocuparia todo mês o lugar de uma
          informação que interessa em alguns meses — a mesma regra dos blocos
          de exceção da Home. */}
      {recusadas.length > 0 ? (
        <section className="bg-danger-soft rounded-xl p-4" aria-labelledby="notas-recusadas">
          <h2 id="notas-recusadas" className="text-danger flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert aria-hidden className="size-4" />
            {recusadas.length === 1
              ? "Uma nota precisa ser reenviada"
              : `${recusadas.length} notas precisam ser reenviadas`}
          </h2>
          <ul className="mt-2 space-y-2">
            {recusadas.map((nota) => (
              <li key={nota.id} className="text-sm">
                <span className="font-medium">{mesPorExtenso(nota.competencia)}</span>
                {" — "}
                <span className="text-text-secondary">{nota.motivo_recusa}</span>
              </li>
            ))}
          </ul>
          <p className="text-text-secondary mt-2 text-xs">
            Corrija e envie uma nota nova para o mesmo mês. A recusada continua aqui,
            com o motivo, para você saber o que já foi apontado.
          </p>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {notas.length === 0
            ? "Nenhuma nota enviada ainda."
            : `${notas.length} nota${notas.length === 1 ? "" : "s"} no histórico.`}
        </p>
        <Button onClick={() => setAberto(true)} disabled={oferecidos.length === 0}>
          <Plus aria-hidden />
          Enviar nota
        </Button>
      </div>

      {oferecidos.length === 0 && notas.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Os doze últimos meses já têm nota enviada.
        </p>
      ) : null}

      {notas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Você ainda não enviou nenhuma nota"
          description="Todo mês, anexe o PDF da sua nota fiscal aqui. O sócio confere, e você acompanha o pagamento por esta tela."
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {notas.map((nota) => (
            <li key={nota.id} className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-[10rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{mesPorExtenso(nota.competencia)}</p>
                  <span
                    title={EXPLICACAO_DE_NF[nota.status]}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs font-medium",
                      CORES_DE_NF[nota.status],
                    )}
                  >
                    {ROTULOS_DE_NF[nota.status]}
                  </span>
                  {nota.numero ? (
                    <Badge variant="secondary">NF {nota.numero}</Badge>
                  ) : null}
                </div>

                <p className="text-text-secondary mt-1 text-sm tabular-nums">
                  {emReais(nota.valor)}
                </p>

                {nota.status === "recusada" && nota.motivo_recusa ? (
                  <p className="text-danger mt-1 text-xs">{nota.motivo_recusa}</p>
                ) : null}
                {nota.status === "paga" && nota.pagamento ? (
                  <p className="text-text-muted mt-1 text-xs">
                    Pagamento em {nota.pagamento.split("-").reverse().join("/")}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {nota.arquivoAssinado ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={nota.arquivoAssinado} target="_blank" rel="noreferrer">
                      <Paperclip aria-hidden />
                      Ver PDF
                    </a>
                  </Button>
                ) : null}

                {/* APAGAR SÓ ENQUANTO NINGUÉM CONFERIU, e o botão some depois:
                    o banco recusa de qualquer jeito, e oferecer o que ele
                    recusa ensina a desconfiar do botão. */}
                {nota.status === "enviada" ? (
                  <ConfirmDialog
                    title="Apagar esta nota?"
                    description={`A nota de ${mesPorExtenso(nota.competencia)} sai daqui e você pode enviar outra para o mesmo mês.`}
                    confirmLabel="Apagar"
                    destructive
                    onConfirm={async () => {
                      const r = await chamarEMostrar(() => apagarNota(nota.id));
                      if (r?.ok) router.refresh();
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Apagar a nota de ${mesPorExtenso(nota.competencia)}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar nota fiscal</DialogTitle>
            <DialogDescription>
              O sócio é avisado assim que ela chega, e você acompanha o pagamento por aqui.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nf-mes">Mês a que a nota se refere</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger
                  id="nf-mes"
                  aria-label="Mês a que a nota se refere"
                  className="mt-1.5 w-full"
                >
                  <SelectValue placeholder="Escolha o mês" />
                </SelectTrigger>
                <SelectContent>
                  {oferecidos.map((m) => (
                    <SelectItem key={m.valor} value={m.valor}>
                      {m.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* A COMPETÊNCIA NÃO É A DATA DE EMISSÃO, e a frase existe porque
                  a nota de setembro costuma ser emitida em outubro. */}
              <p className="text-muted-foreground mt-1 text-xs">
                O mês do trabalho, não o dia em que a nota foi emitida.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nf-valor">Valor</Label>
                <Input
                  id="nf-valor"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="4.250,00"
                  inputMode="decimal"
                  className="mt-1.5 tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="nf-numero">Número da nota</Label>
                <Input
                  id="nf-numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="opcional"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="nf-arquivo">Arquivo da nota</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="nf-arquivo"
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={subindo || !mes}
                  onChange={(e) => subir(e.target.files?.[0])}
                />
                {subindo ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              </div>
              {arquivo ? (
                <p className="text-success mt-1 text-xs">Anexado: {arquivo.nome}</p>
              ) : (
                <p className="text-muted-foreground mt-1 text-xs">
                  PDF ou imagem. Só você e o sócio conseguem abrir.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="nf-obs">Observações</Label>
              <Textarea
                id="nf-obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Algo que o sócio precise saber para conferir."
                className="mt-1.5"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={salvando || subindo || !mes}>
              {salvando ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
